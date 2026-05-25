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

// New format (with ロット番号 column): codes at x<75
const COL_NEW = {
  CODE_MAX: 75,
  CAT_MIN: 75, CAT_MAX: 110,
  NAME_MIN: 110, NAME_MAX: 280,
  COUNT_MIN: 280, COUNT_MAX: 380,
  PRICE_MIN: 380, PRICE_MAX: 460,
  AMT_MIN: 460,
} as const;

// Old format (no ロット番号): prefix/cat at x75-100, name at x100+, count at x275+
const COL_OLD = {
  CODE_MAX: 75,
  CAT_MIN: 75, CAT_MAX: 100,
  NAME_MIN: 100, NAME_MAX: 275,
  COUNT_MIN: 275, COUNT_MAX: 380,
  PRICE_MIN: 380, PRICE_MAX: 460,
  AMT_MIN: 460,
} as const;

// New format has product codes at x<75; old format starts at x76+
function detectFormat(items: RawTextItem[]): 'new' | 'old' {
  const ys = items.map(i => i.y);
  const yMax = Math.max(...ys), yMin = Math.min(...ys);
  const data = items.filter(i => i.y < yMax - 20 && i.y > yMin + 20);
  return data.some(i => i.x < 75) ? 'new' : 'old';
}

function parseRawItems(rawItems: RawTextItem[], ctxYear?: number, ctxMonth?: number): PdfParseResult {
  const COL = detectFormat(rawItems) === 'new' ? COL_NEW : COL_OLD;

  // Group by Y coordinate with 10px tolerance
  const rowMap = new Map<number, RawTextItem[]>();
  for (const item of rawItems) {
    const yBucket = Math.round(item.y / 10) * 10;
    const row = rowMap.get(yBucket) ?? [];
    row.push(item);
    rowMap.set(yBucket, row);
  }

  // Sort rows top-to-bottom (PDF y-axis is inverted)
  const rows = [...rowMap.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, items]) => items.sort((a, b) => a.x - b.x));

  // Extract title for year/month
  let year = ctxYear;
  let month = ctxMonth;
  const fullText = rows.map(r => r.map(i => i.str).join('')).join('\n');
  const titleMatch = fullText.match(/令和(\d+)年[　\s]*(\d+)月/);
  if (titleMatch) {
    year = year ?? parseInt(titleMatch[1]);
    month = month ?? parseInt(titleMatch[2]);
  }

  // Extract items from rows
  const items: KijiItem[] = [];

  for (const row of rows) {
    const codeStr = row.filter(i => i.x < COL.CODE_MAX).map(i => i.str).join('');
    const catStr = row.filter(i => i.x >= COL.CAT_MIN && i.x < COL.CAT_MAX).map(i => i.str).join('');
    const nameStr = row.filter(i => i.x >= COL.NAME_MIN && i.x < COL.NAME_MAX).map(i => i.str).join('');
    const countStr = row.filter(i => i.x >= COL.COUNT_MIN && i.x < COL.COUNT_MAX).map(i => i.str).join('');
    const priceStr = row.filter(i => i.x >= COL.PRICE_MIN && i.x < COL.AMT_MIN).map(i => i.str).join('');
    const amtStr = row.filter(i => i.x >= COL.AMT_MIN).map(i => i.str).join('');

    const identity = codeStr + catStr + nameStr;
    if (!identity.trim()) continue;
    // Skip title rows
    if (/令和|生産高/.test(identity)) continue;
    // Skip pure total rows (no code/cat/name but has count/amount)
    if (!identity.trim() && (countStr || amtStr)) continue;

    const excluded = countStr.includes('本数に含めない') || nameStr.includes('本数に含めない');
    const countMatch = countStr.match(/^(\d+)/);
    const count = countMatch ? parseInt(countMatch[1]) : 0;
    const unitPrice = parseJpNum(priceStr);
    const amount = parseJpNum(amtStr);

    // Must be a product row: either has a 4-digit code or a meaningful name
    if (!/^\d{4}$/.test(codeStr) && !catStr && !nameStr) continue;

    items.push({
      year: year ?? 0,
      month: month ?? 0,
      code: codeStr,
      category: catStr,
      name: nameStr,
      count,
      unitPrice,
      amount,
      excluded,
    });
  }

  // Total count: last (\d+)本 in all text (grouped lines so "79" and "本" merge)
  const groupedText = rows.map(r => r.map(i => i.str).join('')).join('\n');
  const allCounts = [...groupedText.matchAll(/(\d+)本/g)];
  const totalCount = allCounts.length > 0 ? parseInt(allCounts[allCounts.length - 1][1]) : 0;

  // Total amount: last comma-formatted number >= 100,000
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
  const m = s.match(/[\d,]+/);
  if (!m) return 0;
  return parseInt(m[0].replace(/,/g, '')) || 0;
}
