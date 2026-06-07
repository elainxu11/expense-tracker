import Papa from 'papaparse';

// Header fingerprints extracted from example statements in data/samples/.
// If a bank changes its CSV export format, this check will catch it on upload.
type CardSpec = {
  columns: string[];
  findHeaderRow?: (rows: string[][]) => number;
};

const SPECS: Record<string, CardSpec> = {
  'personal-checking': {
    columns: ['Date', 'Description', 'Amount', 'Running Bal.'],
    findHeaderRow: (rows) => rows.findIndex((r) => r[0]?.trim() === 'Date' && r[1]?.trim() === 'Description'),
  },
  'efuture-checking': {
    columns: ['Date', 'Description', 'Amount', 'Running Bal.'],
    findHeaderRow: (rows) => rows.findIndex((r) => r[0]?.trim() === 'Date' && r[1]?.trim() === 'Description'),
  },
  amex: {
    columns: ['Date', 'Description', 'Amount', 'Extended Details', 'Appears On Your Statement As', 'Address', 'City/State', 'Zip Code', 'Country', 'Reference', 'Category'],
  },
  'capital-one': {
    columns: ['Transaction Date', 'Posted Date', 'Card No.', 'Description', 'Category', 'Debit', 'Credit'],
  },
  discover: {
    columns: ['Trans. Date', 'Post Date', 'Description', 'Amount', 'Category'],
  },
  venmo: {
    columns: ['', 'ID', 'Datetime', 'Type', 'Status', 'Note', 'From', 'To', 'Amount (total)', 'Amount (tip)', 'Amount (tax)', 'Amount (fee)', 'Tax Rate', 'Tax Exempt', 'Funding Source', 'Destination', 'Beginning Balance', 'Ending Balance', 'Statement Period Venmo Fees', 'Terminal Location', 'Year to Date Venmo Fees', 'Disclaimer'],
    // Venmo has 2 preamble rows before the actual column headers
    findHeaderRow: (rows) => rows.findIndex((r) => r[1]?.trim() === 'ID'),
  },
  'wells-fargo': {
    // Papa strips quotes, so expected values are unquoted
    columns: ['DATE', 'DESCRIPTION', 'AMOUNT', 'CHECK #', 'STATUS'],
  },
};

export interface FormatCheckResult {
  ok: boolean;
  message?: string;
  expected?: string[];
  got?: string[];
}

export function checkCSVFormat(csvText: string, cardType: string): FormatCheckResult {
  const spec = SPECS[cardType];
  if (!spec) return { ok: true };

  const { data } = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: false });
  const rows = data as string[][];

  const rowIdx = spec.findHeaderRow ? spec.findHeaderRow(rows) : 0;
  if (rowIdx === -1 || rowIdx >= rows.length) {
    return { ok: false, message: 'Could not locate column header row in file.' };
  }

  const got = rows[rowIdx].map((c) => c.trim());
  const { columns: expected } = spec;

  if (got.length !== expected.length) {
    return {
      ok: false,
      message: `Column count changed: expected ${expected.length}, got ${got.length}.`,
      expected,
      got,
    };
  }

  const diffs = expected
    .map((col, i) => (col !== got[i] ? `col ${i + 1}: expected "${col}", got "${got[i]}"` : null))
    .filter(Boolean) as string[];

  if (diffs.length) {
    return {
      ok: false,
      message: `Column headers changed — ${diffs.join('; ')}.`,
      expected,
      got,
    };
  }

  return { ok: true };
}
