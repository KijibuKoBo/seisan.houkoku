import { KijiItem } from '../types';

export interface PdfParseResult {
  year?: number;
  month?: number;
  totalCount: number;
  totalAmount: number;
  items: KijiItem[];
}

export async function parsePdf(file: File, contextYear?: number, contextMonth?: number): Promise<PdfParseResult> {
  const buffer = await file.arrayBuffer();
  const rawItems = await extractRawItems(buffer);
  return parseRawItems(rawItems, contextYear, contextMonth);
}

interface RawTextItem {
  str: string;
  x: number;
  y: number;
}

async function extractRawItems(buffer: ArrayBuffer): Promise<RawTextItem[]> {
  const pdfjsLib = await import('pdfjs-dist');
  // Worker file is renamed .mjs → .js at build time (vite.config.ts plugin)
  // so Apache/XServer serves it with correct application/javascript MIME type
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString().replace(/\.mjs(\?.*)?$/, '.js$1');

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  const result: RawTextItem[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    for (const raw of content.items) {
      if (!('str' in raw)) continue;
      const item = raw as { str: string; transform: number[] };
      if (!item.str.trim()) continue;
      result.push({ str: item.str, x: Math.round(item.transform[4]), y: Math.round(item.transform[5]) });
    }
  }
  return result;
}

// ─── PDF列レイアウト定義 ────────────────────────────────────────────────────────
// A列: ロット番号  B列: カテゴリー  C列: 製品名  D列: 本数  E列: 単価  F列: 合計金額

// 標準フォーマット（A列ロット番号あり）
const COL = {
  A_LOT_MAX:   75,           // A列: ロット番号
  B_CAT_MIN:   75, B_CAT_MAX:  115,  // B列: カテゴリー
  C_NAME_MIN: 115, C_NAME_MAX: 285,  // C列: 製品名
  D_COUNT_MIN: 285, D_COUNT_MAX: 385, // D列: 本数
  E_PRICE_MIN: 385, E_PRICE_MAX: 465, // E列: 単価
  F_AMT_MIN:  465,           // F列: 合計金額
} as const;

// 旧フォーマット（A列ロット番号なし、B列から始まる）
const COL_OLD = {
  A_LOT_MAX:   75,
  B_CAT_MIN:   75, B_CAT_MAX:  105,
  C_NAME_MIN: 105, C_NAME_MAX: 278,
  D_COUNT_MIN: 278, D_COUNT_MAX: 385,
  E_PRICE_MIN: 385, E_PRICE_MAX: 465,
  F_AMT_MIN:  465,
} as const;

// A列（x<75）にデータがあれば標準フォーマット（ロット番号あり）
function detectFormat(items: RawTextItem[]): 'standard' | 'old' {
  const ys = items.map(i => i.y);
  const yMax = Math.max(...ys), yMin = Math.min(...ys);
  const dataRows = items.filter(i => i.y < yMax - 20 && i.y > yMin + 20);
  return dataRows.some(i => i.x < COL.A_LOT_MAX) ? 'standard' : 'old';
}

function parseRawItems(rawItems: RawTextItem[], ctxYear?: number, ctxMonth?: number): PdfParseResult {
  const layout = detectFormat(rawItems) === 'standard' ? COL : COL_OLD;

  // 同じY座標（10px以内）の文字を同一行にグループ化
  const rowMap = new Map<number, RawTextItem[]>();
  for (const item of rawItems) {
    const yBucket = Math.round(item.y / 10) * 10;
    const row = rowMap.get(yBucket) ?? [];
    row.push(item);
    rowMap.set(yBucket, row);
  }

  // 行を上→下の順にソート（PDFのY軸は下が小さい）
  const rows = [...rowMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x));

  // タイトル行から年月を抽出
  let year = ctxYear;
  let month = ctxMonth;
  const fullText = rows.map(r => r.map(i => i.str).join('')).join('\n');
  const titleMatch = fullText.match(/令和(\d+)年[　\s]*(\d+)月/);
  if (titleMatch) {
    year = year ?? parseInt(titleMatch[1]);
    month = month ?? parseInt(titleMatch[2]);
  }

  // 各行からA〜F列を読み取って品目リストを生成
  const items: KijiItem[] = [];

  for (const row of rows) {
    // A列: ロット番号
    const colA = row.filter(i => i.x < layout.A_LOT_MAX).map(i => i.str).join('');
    // B列: カテゴリー
    const colB = row.filter(i => i.x >= layout.B_CAT_MIN && i.x < layout.B_CAT_MAX).map(i => i.str).join('');
    // C列: 製品名
    const colC = row.filter(i => i.x >= layout.C_NAME_MIN && i.x < layout.C_NAME_MAX).map(i => i.str).join('');
    // D列: 本数
    const colD = row.filter(i => i.x >= layout.D_COUNT_MIN && i.x < layout.D_COUNT_MAX).map(i => i.str).join('');
    // E列: 単価
    const colE = row.filter(i => i.x >= layout.E_PRICE_MIN && i.x < layout.F_AMT_MIN).map(i => i.str).join('');
    // F列: 合計金額
    const colF = row.filter(i => i.x >= layout.F_AMT_MIN).map(i => i.str).join('');

    const identity = colA + colB + colC;
    if (!identity.trim()) continue;
    if (/令和|生産高/.test(identity)) continue;

    const excluded = colD.includes('本数に含めない') || colC.includes('本数に含めない');
    const countMatch = colD.replace(/\s/g, '').match(/^(\d+)/);
    const count = countMatch ? parseInt(countMatch[1]) : 0;
    const unitPrice = parseJpNum(colE);
    const amount = parseJpNum(colF);

    // 4桁コードかカテゴリーか製品名があれば品目行と判定
    if (!/^\d{4}$/.test(colA) && !colB && !colC) continue;

    items.push({
      year: year ?? 0,
      month: month ?? 0,
      code: colA,
      category: colB,
      name: colC,
      count,
      unitPrice,
      amount,
      excluded,
    });
  }

  // 合計本数：全文中の最後の「N本」形式
  const groupedText = rows.map(r => r.map(i => i.str).join('')).join('\n');
  const allCounts = [...groupedText.matchAll(/(\d+)本/g)];
  const totalCount = allCounts.length > 0 ? parseInt(allCounts[allCounts.length - 1][1]) : 0;

  // 合計金額：最後の10万以上のカンマ区切り数値
  let totalAmount = 0;
  for (const row of rows) {
    const line = row.map(i => i.str).join('');
    for (const m of line.matchAll(/\d{1,3}(?:,\d{3})+/g)) {
      const n = parseInt(m[0].replace(/,/g, ''));
      if (n >= 100000) totalAmount = n;
    }
  }
  if (totalAmount === 0) {
    totalAmount = items.filter(i => !i.excluded).reduce((s, i) => s + i.amount, 0);
  }

  return { year, month, totalCount, totalAmount, items };
}

function parseJpNum(s: string): number {
  const m = s.replace(/\s/g, '').match(/[\d,]+/);
  if (!m) return 0;
  return parseInt(m[0].replace(/,/g, '')) || 0;
}
