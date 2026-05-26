import Papa from 'papaparse';
import { ParsedTransaction } from './types';

export function parseCSV(
  csvText: string,
  cardType: string
): ParsedTransaction[] {
  const result = Papa.parse(csvText, { header: false, skipEmptyLines: true });
  const rows = result.data as string[][];

  const transactions: ParsedTransaction[] = [];

  // Skip header rows (usually first 1-2 rows depending on bank)
  const dataRows = rows.slice(1);

  dataRows.forEach((row) => {
    if (row.length < 3) return;

    const transaction = parseRow(row, cardType);
    if (transaction) {
      transactions.push(transaction);
    }
  });

  return transactions;
}

function parseRow(row: string[], cardType: string): ParsedTransaction | null {
  let date: string | null = null;
  let merchant: string | null = null;
  let amount: number | null = null;

  // Generic parsing - most banks follow: date, description, amount pattern
  switch (cardType) {
    case 'amex':
      // Amex: Date, Reference, Description, Amount
      date = row[0]?.trim();
      merchant = row[2]?.trim();
      amount = parseAmount(row[3]);
      break;

    case 'capital-one':
      // Capital One: Transaction Date, Posted Date, Merchant, Amount
      date = row[0]?.trim() || row[1]?.trim();
      merchant = row[2]?.trim();
      amount = parseAmount(row[3]);
      break;

    case 'discover':
      // Discover: Trans. Date, Post Date, Merchant, Category, Amount, Pending
      date = row[1]?.trim() || row[0]?.trim();
      merchant = row[2]?.trim();
      amount = parseAmount(row[4]);
      break;

    case 'venmo':
      // Venmo CSV: Date, Time, Type, Status, Note, From, To, Amount, Amount in
      date = row[0]?.trim();
      merchant = row[4]?.trim() || row[5]?.trim();
      amount = parseAmount(row[7]);
      break;

    case 'bofa':
      // Bank of America: Date, Description, Amount
      date = row[0]?.trim();
      merchant = row[1]?.trim();
      amount = parseAmount(row[2]);
      break;

    default:
      // Generic: try common positions
      date = row[0]?.trim();
      merchant = row[1]?.trim();
      amount = parseAmount(row[2]);
  }

  if (!date || !merchant || amount === null) return null;

  return {
    date: formatDate(date),
    merchant: cleanMerchantName(merchant),
    amount: Math.abs(amount),
    card: cardType,
  };
}

function parseAmount(amountStr: string | undefined): number | null {
  if (!amountStr) return null;

  const cleaned = amountStr
    .replace(/[^0-9.-]/g, '')
    .replace(/,/g, '');

  const amount = parseFloat(cleaned);
  return isNaN(amount) ? null : amount;
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

function cleanMerchantName(merchant: string): string {
  return merchant
    .replace(/^[A-Z0-9]+\s+/i, '') // Remove reference numbers
    .replace(/\s+$/, '') // Trim trailing spaces
    .split(' ')[0]; // Take first meaningful word
}
