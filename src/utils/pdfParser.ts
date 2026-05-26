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
// フォーマットA（標準）: A=ロット番号 / B=カテゴリー / C=製品名 / D=本数 / E=単価 / F=合計金額
// フォーマットB（ロットなし）: B=カテゴリー / C=製品名 / F=合計金額 / D=本数 / E=単価
//   ※ フォーマットBは合計金額が本数の左側に来る独自レイアウト
// フォーマットC（旧形式）: B=カテゴリー / C=製品名 / D=本数 / E=単価 / F=合計金額

type Format = 'A' | 'B' | 'C';

// フォーマットA: A列ロット番号あり（x<75）
const COL_A = {
  A_LOT_MAX:    75,
  B_CAT_MIN:    75, B_CAT_MAX:   115,
  C_NAME_MIN:  115, C_NAME_MAX:  285,
  D_COUNT_MIN: 285, D_COUNT_MAX: 385,
  E_PRICE_MIN: 385, E_PRICE_MAX: 465,
  F_AMT_MIN:   465,
} as const;

// フォーマットC: 旧形式（カテゴリーx≈77-78、品名x≈104）
const COL_C = {
  A_LOT_MAX:    75,
  B_CAT_MIN:    75, B_CAT_MAX:   104, // x=77-102 のカテゴリー ("Ca","MP","仏","特")
  C_NAME_MIN:  104, C_NAME_MAX:  278, // x=104+ の品名（4月形式はx=125、3月形式はx=104）
  D_COUNT_MIN: 278, D_COUNT_MAX: 385,
  E_PRICE_MIN: 385, E_PRICE_MAX: 465,
  F_AMT_MIN:   465,
} as const;

// フォーマットB: ロットなし形式（カテゴリーx≈142、合計金額が本数の左側）
const COL_B = {
  B_CAT_MIN:   130, B_CAT_MAX:   158,
  C_NAME_MIN:  158, C_NAME_MAX:  295,
  F_AMT_MIN:   295, F_AMT_MAX:   342, // 合計金額（本数より左に位置）
  D_COUNT_MIN: 342, D_COUNT_MAX: 460, // 本数（"N本"形式）
  E_PRICE_MIN: 460,                   // 単価
} as const;

interface RowFields {
  code: string;
  category: string;
  name: string;
  count: string;
  unitPrice: string;
  amount: string;
}

function extractRowFields(row: RawTextItem[], format: Format): RowFields {
  if (format === 'B') {
    return {
      code: '',
      category: row.filter(i => i.x >= COL_B.B_CAT_MIN && i.x < COL_B.B_CAT_MAX).map(i => i.str).join(''),
      name:     row.filter(i => i.x >= COL_B.C_NAME_MIN && i.x < COL_B.C_NAME_MAX).map(i => i.str).join(''),
      amount:   row.filter(i => i.x >= COL_B.F_AMT_MIN  && i.x < COL_B.F_AMT_MAX).map(i => i.str).join(''),
      count:    row.filter(i => i.x >= COL_B.D_COUNT_MIN && i.x < COL_B.D_COUNT_MAX).map(i => i.str).join(''),
      unitPrice: row.filter(i => i.x >= COL_B.E_PRICE_MIN).map(i => i.str).join(''),
    };
  }

  const layout = format === 'A' ? COL_A : COL_C;
  return {
    code:      row.filter(i => i.x < layout.A_LOT_MAX).map(i => i.str).join(''),
    category:  row.filter(i => i.x >= layout.B_CAT_MIN  && i.x < layout.B_CAT_MAX).map(i => i.str).join(''),
    name:      row.filter(i => i.x >= layout.C_NAME_MIN  && i.x < layout.C_NAME_MAX).map(i => i.str).join(''),
    count:     row.filter(i => i.x >= layout.D_COUNT_MIN && i.x < layout.D_COUNT_MAX).map(i => i.str).join(''),
    unitPrice: row.filter(i => i.x >= layout.E_PRICE_MIN && i.x < layout.F_AMT_MIN).map(i => i.str).join(''),
    amount:    row.filter(i => i.x >= layout.F_AMT_MIN).map(i => i.str).join(''),
  };
}

function detectFormat(items: RawTextItem[]): Format {
  const ys = items.map(i => i.y);
  const yMax = Math.max(...ys), yMin = Math.min(...ys);
  // 上下余白（タイトル/フッター行）を除いたデータ行のみで判定
  const dataRows = items.filter(i => i.y < yMax - 20 && i.y > yMin + 20);

  // A: x<75にロット番号がある
  if (dataRows.some(i => i.x < COL_A.A_LOT_MAX)) return 'A';

  // B: カテゴリーがx≈142から始まるフォーマット（x 95-125 の範囲にデータなし）
  //    C/旧形式はカテゴリーがx≈102にあるため、この範囲にデータが存在する
  if (!dataRows.some(i => i.x >= 95 && i.x < 125)) return 'B';

  return 'C'; // 旧形式: カテゴリーx≈75-105
}

function parseRawItems(rawItems: RawTextItem[], ctxYear?: number, ctxMonth?: number): PdfParseResult {
  const format = detectFormat(rawItems);

  // 同じY座標（10px以内）の文字を同一行にグループ化
  const rowMap = new Map<number, RawTextItem[]>();
  for (const item of rawItems) {
    const yBucket = Math.round(item.y / 10) * 10;
    const row = rowMap.get(yBucket) ?? [];
    row.push(item);
    rowMap.set(yBucket, row);
  }

  // 行を上→下の順にソート
  const rows = [...rowMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x));

  // タイトル行から年月を抽出
  let year = ctxYear;
  let month = ctxMonth;
  const fullText = rows.map(r => r.map(i => i.str).join('')).join('\n');
  const titleMatch = fullText.match(/令和(\d+)年[　\s]*(\d+)月/) ||
                     fullText.match(/令和([一二三四五六七八九十]+)年[　\s]*(\d+)月/);
  if (titleMatch) {
    const reiwaNum = kanjiToNum(titleMatch[1]);
    year = year ?? reiwaNum;
    month = month ?? parseInt(titleMatch[2]);
  }

  // 各行からA〜F列を読み取って品目リストを生成
  const items: KijiItem[] = [];

  for (const row of rows) {
    const f = extractRowFields(row, format);
    const identity = f.code + f.category + f.name;
    if (!identity.trim()) continue;
    if (/令和|生産高/.test(identity)) continue;

    const excluded = f.count.includes('本数に含めない') || f.name.includes('本数に含めない');
    const countMatch = f.count.replace(/\s/g, '').match(/^(\d+)/);
    const count = countMatch ? parseInt(countMatch[1]) : 0;
    const unitPrice = parseJpNum(f.unitPrice);
    const amount = parseJpNum(f.amount);

    if (!/^\d{4}$/.test(f.code) && !f.category && !f.name) continue;

    items.push({
      year: year ?? 0,
      month: month ?? 0,
      code: f.code,
      category: f.category,
      name: f.name,
      count,
      unitPrice,
      amount,
      excluded,
    });
  }

  // 合計本数・合計金額: PDFヘッダーではなくアイテムから直接集計（フォーマット依存しない）
  const activeItems = items.filter(i => !i.excluded);
  const totalCount = activeItems.reduce((s, i) => s + i.count, 0);
  const totalAmount = activeItems.reduce((s, i) => s + i.amount, 0);

  return { year, month, totalCount, totalAmount, items };
}

// 漢数字→整数（令和元〜十年程度の範囲）
function kanjiToNum(s: string): number {
  const n = parseInt(s);
  if (!isNaN(n)) return n;
  const map: Record<string, number> = {
    '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '元': 1,
  };
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (map[s[1]] ?? 0);
  if (s.endsWith('十')) return (map[s[0]] ?? 0) * 10;
  return map[s] ?? 0;
}

function parseJpNum(s: string): number {
  const m = s.replace(/\s/g, '').match(/[\d,]+/);
  if (!m) return 0;
  return parseInt(m[0].replace(/,/g, '')) || 0;
}
