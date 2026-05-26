import Papa from 'papaparse';
import { ParsedTransaction } from './types';

export function parseCSV(
  csvText: string,
  cardType: string
): ParsedTransaction[] {
  const result = Papa.parse(csvText, { header: false, skipEmptyLines: true });
  const rows = result.data as string[][];

  const transactions: ParsedTransaction[] = [];

  // Skip header row
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
  let amexCategory: string | undefined;

  switch (cardType) {
    case 'amex':
      // AMEX CSV columns (0-indexed):
      // 0: Date (MM/DD/YYYY)
      // 1: Description
      // 2: Amount (positive = charge, negative = payment/credit)
      // 3: Extended Details
      // 4: Appears On Your Statement As
      // 5: Address
      // 6: City/State
      // 7: Zip Code
      // 8: Country
      // 9: Reference
      // 10: Category
      date = parseAmexDate(row[0]?.trim() || '');
      merchant = cleanAmexMerchantName(row[1]?.trim() || '');
      amount = parseAmount(row[2]);
      amexCategory = row[10]?.trim() || undefined;
      break;

    case 'capital-one':
      date = row[0]?.trim() || row[1]?.trim();
      merchant = row[2]?.trim();
      amount = parseAmount(row[3]);
      break;

    case 'discover':
      date = row[1]?.trim() || row[0]?.trim();
      merchant = row[2]?.trim();
      amount = parseAmount(row[4]);
      break;

    case 'venmo':
      date = row[0]?.trim();
      merchant = row[4]?.trim() || row[5]?.trim();
      amount = parseAmount(row[7]);
      break;

    case 'bofa':
      date = row[0]?.trim();
      merchant = row[1]?.trim();
      amount = parseAmount(row[2]);
      break;

    default:
      date = row[0]?.trim();
      merchant = row[1]?.trim();
      amount = parseAmount(row[2]);
  }

  if (!date || !merchant || amount === null) return null;

  // AMEX: skip payments and credits (negative amounts)
  if (cardType === 'amex' && amount <= 0) return null;

  const result: ParsedTransaction = {
    date: cardType === 'amex' ? date : formatDate(date),
    merchant: cardType === 'amex' ? merchant : cleanMerchantName(merchant),
    amount: Math.abs(amount),
    card: cardType,
  };

  if (amexCategory) result.amexCategory = amexCategory;

  return result;
}

function parseAmexDate(dateStr: string): string {
  // AMEX format: MM/DD/YYYY → YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return formatDate(dateStr);
}

function cleanAmexMerchantName(raw: string): string {
  return raw
    .replace(/^AplPay\s+/i, '')   // Strip Apple Pay prefix
    .replace(/\s{2,}.*$/, '')     // Strip trailing city/state (AMEX uses 2+ spaces as separator)
    .replace(/^[A-Z]{2,4}\*/, '') // Strip payment processor codes (e.g. FGT*, TST*, FH*)
    .trim();
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
    .replace(/^[A-Z0-9]+\s+/i, '')
    .replace(/\s+$/, '')
    .split(' ')[0];
}
