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

function isCardPayment(description: string): boolean {
  const lower = description.toLowerCase();
  return lower.includes('payment') || lower.includes('directpay') || lower.includes('autopay');
}

function parseRow(row: string[], cardType: string): ParsedTransaction | null {
  let date: string | null = null;
  let merchant: string | null = null;
  let amount: number | null = null;
  let sourceCategory: string | undefined;
  let address: string | undefined;
  let txType: 'expense' | 'credit' = 'expense';

  switch (cardType) {
    case 'amex':
      // Columns: Date(MM/DD/YYYY), Description, Amount, Extended Details,
      // Appears On Statement, Address, City/State, Zip, Country, Reference, Category
      // Positive = expense; negative = credit. Skip if negative AND a card payment.
      date = parseAmexDate(row[0]?.trim() || '');
      merchant = cleanAmexMerchantName(row[1]?.trim() || '');
      amount = parseAmount(row[2]);
      sourceCategory = row[10]?.trim() || undefined;
      const amexAddr = row[5]?.trim();
      const amexCity = row[6]?.trim();
      if (amexAddr || amexCity) {
        address = [amexAddr, amexCity].filter(Boolean).join(', ');
      }
      if (amount !== null && amount <= 0) {
        if (isCardPayment(row[1]?.trim() || '')) return null;
        txType = 'credit';
      }
      break;

    case 'capital-one':
      // Columns: Transaction Date(YYYY-MM-DD), Posted Date, Card No.,
      // Description, Category, Debit, Credit
      if (!row[5]?.trim()) {
        // No Debit value — check Credit column
        if (!row[6]?.trim() || isCardPayment(row[3]?.trim() || '')) return null;
        date = row[0]?.trim();
        merchant = row[3]?.trim();
        amount = parseAmount(row[6]);
        sourceCategory = row[4]?.trim() || undefined;
        txType = 'credit';
        break;
      }
      date = row[0]?.trim();
      merchant = row[3]?.trim();
      amount = parseAmount(row[5]);
      sourceCategory = row[4]?.trim() || undefined;
      break;

    case 'discover':
      // Columns: Trans. Date(MM/DD/YYYY), Post Date, Description, Amount, Category
      // Positive = expense; negative = credit. Skip if negative AND a card payment.
      date = parseAmexDate(row[0]?.trim() || '');
      merchant = cleanDiscoverMerchantName(row[2]?.trim() || '');
      amount = parseAmount(row[3]);
      sourceCategory = row[4]?.trim() || undefined;
      if (amount !== null && amount <= 0) {
        if (isCardPayment(row[2]?.trim() || '')) return null;
        txType = 'credit';
      }
      break;

    case 'venmo':
      // Columns: (empty), ID, Datetime, Type, Status, Note, From, To, Amount (total), ...
      // Type must be Payment or Charge; Status must be Complete.
      // Negative = Elain paid (expense); positive = Elain received (credit — reimbursement).
      if (row[3]?.trim() !== 'Payment' && row[3]?.trim() !== 'Charge') return null;
      if (row[4]?.trim() !== 'Complete') return null;
      date = row[2]?.trim().split('T')[0];
      merchant = row[5]?.trim() || `${row[6]?.trim()} → ${row[7]?.trim()}`;
      amount = parseAmount(row[8]);
      if (amount !== null && amount >= 0) {
        txType = 'credit';
      }
      break;

    case 'wells-fargo':
      // Columns: DATE(MM/DD/YYYY), DESCRIPTION, AMOUNT, CHECK#, STATUS
      // Negative = expense; positive = payment/refund. Skip if positive AND a card payment.
      date = parseAmexDate(row[0]?.trim() || '');
      merchant = cleanWellsFargoMerchantName(row[1]?.trim() || '');
      amount = parseAmount(row[2]);
      if (amount !== null && amount >= 0) {
        if (isCardPayment(row[1]?.trim() || '')) return null;
        txType = 'credit';
      }
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

  const useRawDate = cardType === 'amex' || cardType === 'capital-one' || cardType === 'venmo' || cardType === 'wells-fargo' || cardType === 'discover';
  const useRawMerchant = cardType === 'amex' || cardType === 'capital-one' || cardType === 'venmo' || cardType === 'wells-fargo' || cardType === 'discover';

  const result: ParsedTransaction = {
    date: useRawDate ? date : formatDate(date),
    merchant: useRawMerchant ? merchant : cleanMerchantName(merchant),
    amount: Math.abs(amount),
    card: cardType,
    type: txType,
  };

  if (sourceCategory) result.sourceCategory = sourceCategory;
  if (address) result.address = address;

  return result;
}

function parseAmexDate(dateStr: string): string {
  // MM/DD/YYYY → YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  return formatDate(dateStr);
}

function cleanDiscoverMerchantName(raw: string): string {
  return raw
    .replace(/\*[A-Z0-9]+.*$/, '')          // Strip * + ref code + rest (AMAZON PRIME*RH9V54E23 ...)
    .replace(/\/BILL.*$/, '')                // Strip /BILL suffix (APPLE.COM/BILL ...)
    .replace(/\s+\d{3}-\d{3}-\d{4}.*$/, '') // Strip phone numbers and trailing junk
    .replace(/\s+[A-Z0-9]{8,}$/, '')        // Strip any remaining trailing reference codes
    .trim();
}

function cleanWellsFargoMerchantName(raw: string): string {
  return raw
    .replace(/\s+[A-Z]{2}$/, '') // Strip trailing state code (NY, HI, VA, etc.)
    .replace(/\*\s*$/, '')        // Strip trailing * from processor codes
    .trim();
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
