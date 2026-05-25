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
  // Dynamic import to avoid worker setup issues at module load time
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
    const pageText = content.items
      .map((item) => ('str' in item ? (item as { str: string }).str : ''))
      .join('\n');
    fullText += pageText + '\n';
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

  // Collect all 本数 values (appears as "XX本" pattern)
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

  // The last count value is the total
  const totalCount = countValues.length > 0 ? countValues[countValues.length - 1] : 0;

  // Match count values to items (countValues[0..n-2] map to items, countValues[n-1] is total)
  const itemCounts = countValues.slice(0, countValues.length - 1);
  items.forEach((item, i) => {
    if (i < itemCounts.length) {
      item.count = itemCounts[i];
      item.excluded = !!excludedFlags[i];
    }
  });

  // Total amount: find the last standalone large number in the text
  let totalAmount = 0;
  for (const line of lines) {
    const standaloneNum = line.match(/^([\d,]+)$/);
    if (standaloneNum) {
      const n = parseInt(standaloneNum[1].replace(/,/g, ''));
      if (n >= 100000) {
        totalAmount = n;
      }
    }
  }

  // If we couldn't find a standalone total, sum the item amounts
  if (totalAmount === 0 && items.length > 0) {
    totalAmount = items.reduce((sum, item) => sum + item.amount, 0);
  }

  return { year, month, totalCount, totalAmount, items };
}
