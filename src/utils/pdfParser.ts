export interface PdfParseResult {
  year?: number;
  month?: number;
  totalCount: number;
  totalAmount: number;
  items: PdfItem[];
}

export interface PdfItem {
  code: string;
  name: string;
  count: number;
  unitPrice: number;
  amount: number;
  excluded: boolean; // ＊本数に含めない
}

export async function parsePdf(file: File): Promise<PdfParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const text = await extractTextFromPdf(arrayBuffer);
  return parseText(text);
}

async function extractTextFromPdf(buffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();

  const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(buffer) }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group text items by Y coordinate so that "79" and "本" on the same row
    // are concatenated into "79本" rather than separated by a newline.
    const lineMap = new Map<number, string>();
    for (const raw of content.items) {
      if (!('str' in raw)) continue;
      const item = raw as { str: string; transform: number[] };
      if (!item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 4) * 4; // bucket to 4px
      lineMap.set(y, (lineMap.get(y) ?? '') + item.str);
    }

    // Sort descending by Y (PDF origin is bottom-left)
    const lines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([, t]) => t);
    fullText += lines.join('\n') + '\n';
  }
  return fullText;
}

function parseText(text: string): PdfParseResult {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Extract year and month from title like "令和7年　4月生産高"
  let year: number | undefined;
  let month: number | undefined;
  const titleMatch = text.match(/令和(\d+)年[　\s]*(\d+)月/);
  if (titleMatch) {
    year = parseInt(titleMatch[1]);
    month = parseInt(titleMatch[2]);
  }

  // Parse items - lines starting with a 4-digit product code
  const items: PdfItem[] = [];
  const productLineRegex = /^(\d{4})\s+(.+)/;

  // Extract total count: scan ALL 本 occurrences, last one is the grand total.
  // (pdfjs sometimes concatenates "1本79本" on one line when columns merge)
  const allHonsuMatches = [...text.matchAll(/(\d+)本/g)];
  const totalCount = allHonsuMatches.length > 0
    ? parseInt(allHonsuMatches[allHonsuMatches.length - 1][1])
    : 0;

  const countValues: number[] = [];
  const excludedFlags: boolean[] = [];

  for (const line of lines) {
    // Check if this is a count line like "20本" or "79本"
    const countOnlyMatch = line.match(/^(\d+)本\s*$/);
    if (countOnlyMatch) {
      countValues.push(parseInt(countOnlyMatch[1]));
      continue;
    }

    // Check for lines with 本数に含めない marker
    if (line.includes('本数に含めない') || line.includes('＊本数に含めない')) {
      const countMatch = line.match(/(\d+)本/);
      if (countMatch) {
        countValues.push(parseInt(countMatch[1]));
        excludedFlags[countValues.length - 1] = true;
      }
      continue;
    }

    // Check for product code lines
    const productMatch = line.match(productLineRegex);
    if (productMatch) {
      const rest = productMatch[2];
      // Extract numbers from the rest of the line
      const numbers = rest.match(/[\d,]+/g) || [];
      const parsedNums = numbers.map(n => parseInt(n.replace(/,/g, '')));

      let unitPrice = 0;
      let amount = 0;
      if (parsedNums.length >= 2) {
        unitPrice = parsedNums[parsedNums.length - 2];
        amount = parsedNums[parsedNums.length - 1];
      } else if (parsedNums.length === 1) {
        amount = parsedNums[0];
      }

      // Extract name (remove trailing numbers)
      const name = rest.replace(/[\d,\s]+$/, '').trim();

      items.push({
        code: productMatch[1],
        name,
        count: 0, // will be filled from count column
        unitPrice,
        amount,
        excluded: false,
      });
    }
  }

  // Match count values to items (all except last map to items; last is total)
  const itemCounts = countValues.slice(0, countValues.length - 1);
  items.forEach((item, i) => {
    if (i < itemCounts.length) {
      item.count = itemCounts[i];
      item.excluded = !!excludedFlags[i];
    }
  });

  // Total amount: scan every line for comma-formatted numbers >= 100,000.
  // After line-grouping, "1,460,000" and "79本" share a line as "1,460,00079本",
  // so we use a regex that correctly extracts "1,460,000" out of that string.
  let totalAmount = 0;
  for (const line of lines) {
    const nums = [...line.matchAll(/\d{1,3}(?:,\d{3})+/g)];
    for (const m of nums) {
      const n = parseInt(m[0].replace(/,/g, ''));
      if (n >= 100000) totalAmount = n;
    }
  }

  // Fallback: sum item amounts
  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  }

  return { year, month, totalCount, totalAmount, items };
}
