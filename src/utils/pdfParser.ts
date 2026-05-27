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

// ─── フォーマット定義 ─────────────────────────────────────────────────────────
// S: 新統一フォーマット（ヘッダー行あり: カテゴリー/製品名/数量/単価/金額）
// A: ロット番号ありフォーマット（A列 x<75 にコードあり）
// B: カテゴリー x≈142 のフォーマット（ロットなし、合計金額が本数の左）
// C: 旧フォーマット（カテゴリー x≈77-102、品名 x≈104+）

type Format = 'S' | 'A' | 'B' | 'C';

// S: 新統一フォーマット
const COL_S = {
  B_CAT_MIN:    60, B_CAT_MAX:  115, // カテゴリー列 (Ca, MP, 特注, 試作 など)
  C_NAME_MIN:  115, C_NAME_MAX: 265, // 製品名列
  D_COUNT_MIN: 265, D_COUNT_MAX: 320, // 数量列
  E_PRICE_MIN: 320, E_PRICE_MAX: 395, // 単価列
  F_AMT_MIN:   395,                   // 金額列
} as const;

// A: ロット番号ありフォーマット
const COL_A = {
  A_LOT_MAX:    70,            // リリー(x=74)がコード列に入らないよう70に調整
  B_CAT_MIN:    70, B_CAT_MAX: 108,  // 品名はx=110から始まる
  C_NAME_MIN:  108, C_NAME_MAX: 285,
  D_COUNT_MIN: 285, D_COUNT_MAX: 385,
  E_PRICE_MIN: 385, E_PRICE_MAX: 465,
  F_AMT_MIN:   465,
} as const;

// B: 合計金額が本数の左に来るフォーマット
const COL_B = {
  B_CAT_MIN:  130, B_CAT_MAX:  158,
  C_NAME_MIN: 158, C_NAME_MAX: 295,
  F_AMT_MIN:  295, F_AMT_MAX:  342,
  D_COUNT_MIN: 342, D_COUNT_MAX: 460,
  E_PRICE_MIN: 460,
} as const;

// C: 旧フォーマット
const COL_C = {
  A_LOT_MAX:    75,
  B_CAT_MIN:    75, B_CAT_MAX:  104,
  C_NAME_MIN:  104, C_NAME_MAX: 278,
  D_COUNT_MIN: 278, D_COUNT_MAX: 385,
  E_PRICE_MIN: 385, E_PRICE_MAX: 465,
  F_AMT_MIN:   465,
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
  if (format === 'S') {
    return {
      code: '',
      category: row.filter(i => i.x >= COL_S.B_CAT_MIN  && i.x < COL_S.B_CAT_MAX).map(i => i.str).join(''),
      name:     row.filter(i => i.x >= COL_S.C_NAME_MIN  && i.x < COL_S.C_NAME_MAX).map(i => i.str).join(' ').trim(),
      count:    row.filter(i => i.x >= COL_S.D_COUNT_MIN && i.x < COL_S.D_COUNT_MAX).map(i => i.str).join(''),
      unitPrice: row.filter(i => i.x >= COL_S.E_PRICE_MIN && i.x < COL_S.F_AMT_MIN).map(i => i.str).join(''),
      amount:   row.filter(i => i.x >= COL_S.F_AMT_MIN).map(i => i.str).join(''),
    };
  }

  if (format === 'B') {
    return {
      code: '',
      category: row.filter(i => i.x >= COL_B.B_CAT_MIN  && i.x < COL_B.B_CAT_MAX).map(i => i.str).join(''),
      name:     row.filter(i => i.x >= COL_B.C_NAME_MIN  && i.x < COL_B.C_NAME_MAX).map(i => i.str).join(''),
      amount:   row.filter(i => i.x >= COL_B.F_AMT_MIN   && i.x < COL_B.F_AMT_MAX).map(i => i.str).join(''),
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

function detectFormat(rawItems: RawTextItem[], fullText: string): Format {
  // 新統一フォーマット: 列ヘッダー「数量」または「カテゴリー」が存在する
  if (fullText.includes('数量') || fullText.includes('カテゴリー')) return 'S';

  const ys = rawItems.map(i => i.y);
  const yMax = Math.max(...ys), yMin = Math.min(...ys);
  const dataRows = rawItems.filter(i => i.y < yMax - 20 && i.y > yMin + 20);

  if (dataRows.some(i => i.x < COL_A.A_LOT_MAX)) return 'A';
  if (!dataRows.some(i => i.x >= 95 && i.x < 125)) return 'B';
  return 'C';
}

// フォーマットA/C: 本数列が他の列と異なるY座標帯にあるPDFをマージ
// （データ行：品番+品名+単価+金額、別帯：本数のみ または 品名+本数）
function mergeDetachedCounts(rows: RawTextItem[][], format: 'A' | 'C'): RawTextItem[][] {
  const layout = format === 'A' ? COL_A : COL_C;

  const hasAmt  = (row: RawTextItem[]) => row.some(i => i.x >= layout.F_AMT_MIN && /\d/.test(i.str));
  const hasCnt  = (row: RawTextItem[]) => row.some(i => i.x >= layout.D_COUNT_MIN && i.x < layout.D_COUNT_MAX && /\d/.test(i.str));
  const hasId   = (row: RawTextItem[]) => row.some(i =>
    i.x < layout.A_LOT_MAX ||
    (i.x >= layout.B_CAT_MIN && i.x < layout.B_CAT_MAX) ||
    (i.x >= layout.C_NAME_MIN && i.x < layout.C_NAME_MAX)
  );

  // 検出：金額ありで本数なしのデータ行と、本数のみ行が両方3件以上あるか
  let dataNoCount = 0;
  let cntOnly = 0;
  for (const row of rows) {
    if (hasAmt(row) && hasId(row) && !hasCnt(row)) dataNoCount++;
    if (hasCnt(row) && !hasAmt(row)) cntOnly++;
  }
  if (dataNoCount < 3 || cntOnly < 3) return rows;

  const dataRows: RawTextItem[][] = [];
  const cntRows:  RawTextItem[][] = [];
  const otherRows: RawTextItem[][] = [];
  for (const row of rows) {
    if (hasAmt(row) && hasId(row))    dataRows.push(row);
    else if (hasCnt(row) && !hasAmt(row)) cntRows.push(row);
    else                              otherRows.push(row);
  }

  const merged = dataRows.map((dRow, i) => {
    const cRow = cntRows[i];
    if (!cRow) return dRow;
    const countItems = cRow.filter(it => it.x >= layout.D_COUNT_MIN && it.x < layout.D_COUNT_MAX);
    const dataHasName = dRow.some(it => it.x >= layout.C_NAME_MIN && it.x < layout.C_NAME_MAX);
    const nameItems   = dataHasName ? [] : cRow.filter(it => it.x >= layout.C_NAME_MIN && it.x < layout.C_NAME_MAX);
    return [...dRow, ...countItems, ...nameItems];
  });

  return [...merged, ...otherRows];
}

// フォーマットSで品名が次行に続く場合（名前なし行 + 名前だけの行）をマージ
function mergeSplitRows(rows: RawTextItem[][]): RawTextItem[][] {
  const result: RawTextItem[][] = [];
  let i = 0;
  while (i < rows.length) {
    const row = rows[i];
    const next = rows[i + 1];
    if (next) {
      const rowHasName  = row.some(it => it.x >= COL_S.C_NAME_MIN && it.x < COL_S.C_NAME_MAX);
      const rowHasCount = row.some(it => it.x >= COL_S.D_COUNT_MIN && it.x < COL_S.D_COUNT_MAX && /\d/.test(it.str));
      const nextHasName  = next.some(it => it.x >= COL_S.C_NAME_MIN && it.x < COL_S.C_NAME_MAX);
      const nextHasCount = next.some(it => it.x >= COL_S.D_COUNT_MIN && it.x < COL_S.D_COUNT_MAX && /\d/.test(it.str));

      // 現在行に数量あり・品名なし、次行に品名あり・数量なし → マージ
      if (rowHasCount && !rowHasName && nextHasName && !nextHasCount) {
        result.push([...row, ...next]);
        i += 2;
        continue;
      }
    }
    result.push(row);
    i++;
  }
  return result;
}

function parseRawItems(rawItems: RawTextItem[], ctxYear?: number, ctxMonth?: number): PdfParseResult {
  const fullTextRaw = rawItems.map(i => i.str).join('');
  const format = detectFormat(rawItems, fullTextRaw);

  // 同じY座標（10px以内）の文字を同一行にグループ化
  const rowMap = new Map<number, RawTextItem[]>();
  for (const item of rawItems) {
    const yBucket = Math.round(item.y / 10) * 10;
    const row = rowMap.get(yBucket) ?? [];
    row.push(item);
    rowMap.set(yBucket, row);
  }

  // 行を上→下の順にソート
  let rows = [...rowMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x));

  // フォーマットSで品名が次行に分かれているケースをマージ
  if (format === 'S') rows = mergeSplitRows(rows);

  // タイトル行から年月を抽出（漢数字対応）
  // ※ここより先でmergeDetachedCountsを呼ぶと年月抽出に影響するため先に抽出
  let year = ctxYear;
  let month = ctxMonth;
  const fullText = rows.map(r => r.map(i => i.str).join('')).join('\n');
  const titleMatch = fullText.match(/令和([一二三四五六七八九十元\d]+)年[　\s]*(\d+)月/);
  if (titleMatch) {
    year  = year  ?? kanjiToNum(titleMatch[1]);
    month = month ?? parseInt(titleMatch[2]);
  }

  // フォーマットA/Cで本数列が別Y座標帯にあるケースをマージ
  if (format === 'A' || format === 'C') rows = mergeDetachedCounts(rows, format);

  // 各行からフィールドを抽出して品目リストを生成
  const items: KijiItem[] = [];

  for (const row of rows) {
    const f = extractRowFields(row, format);
    const identity = f.code + f.category + f.name;

    if (!identity.trim()) continue;
    // タイトル行・ヘッダー行・合計行をスキップ
    if (/令和|生産高|カテゴリー|数量|単価|金額/.test(identity)) continue;
    if (!f.category && /^合計$/.test(f.name.trim())) continue;

    const excluded = f.count.includes('本数に含めない') || f.name.includes('本数に含めない');
    const countMatch = f.count.replace(/[,\s]/g, '').match(/^(\d+)/);
    const count = countMatch ? parseInt(countMatch[1]) : 0;
    const unitPrice = parseJpNum(f.unitPrice);
    const amount = parseJpNum(f.amount);

    if (!/^\d{4}$/.test(f.code) && !f.category && !f.name) continue;

    const category = normalizeCategory(f.category);

    items.push({
      year: year ?? 0,
      month: month ?? 0,
      code: f.code,
      category,
      name: f.name,
      count,
      unitPrice,
      amount,
      excluded,
    });
  }

  // 合計をアイテムから直接集計
  const activeItems = items.filter(i => !i.excluded);
  const totalCount = activeItems.reduce((s, i) => s + i.count, 0);
  const totalAmount = activeItems.reduce((s, i) => s + i.amount, 0);

  return { year, month, totalCount, totalAmount, items };
}

function kanjiToNum(s: string): number {
  const n = parseInt(s);
  if (!isNaN(n)) return n;
  const map: Record<string, number> = {
    '元': 1, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
  };
  if (s === '十') return 10;
  if (s.startsWith('十')) return 10 + (map[s[1]] ?? 0);
  if (s.endsWith('十')) return (map[s[0]] ?? 0) * 10;
  if (s.length === 2 && s[1] === '十') return (map[s[0]] ?? 1) * 10;
  return map[s] ?? 0;
}

const CATEGORY_NORM: Record<string, string> = {
  'Ca': 'Co', 'Continue': 'Co',
  'Master Piece': 'MP', 'MasterPiece': 'MP',
  'Petit.Continue': 'PC', 'Petit Continue': 'PC', 'Petit': 'PC',
  '仏': '仏壇',
  '特': '特注',
};

function normalizeCategory(cat: string): string {
  const t = cat.trim();
  return CATEGORY_NORM[t] ?? t;
}

function parseJpNum(s: string): number {
  const m = s.replace(/[\s,，]/g, '').match(/[\d]+/);
  if (!m) return 0;
  return parseInt(m[0]) || 0;
}
