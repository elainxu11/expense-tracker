import Papa from 'papaparse';
import { ParsedTransaction, CheckingRow, CheckingRowType } from './types';

const US_STATES = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]);

// Multi-word city prefixes common in Wells Fargo descriptions
const CITY_PREFIXES = new Set([
  'MC', 'ST', 'NEW', 'SAN', 'LOS', 'LAS', 'FORT', 'EL',
  'WEST', 'EAST', 'NORTH', 'SOUTH', 'MOUNT', 'MT', 'PORT', 'LAKE',
]);

// Shared parser: extracts "MERCHANT [CITY] STATE" from card description fields.
// Walks backwards from the end collecting city words (stops at non-alpha or non-prefix words),
// then applies cleanFn to the remaining merchant portion.
// e.g. "MTA*NYCT PAYGO NEW YORK NY"        → merchant="MTA*NYCT PAYGO", address="NEW YORK, NY"
//      "AMAZON PRIME*RH9V54E23 SEATTLE WA" → merchant="AMAZON PRIME",   address="SEATTLE, WA"
//      "ALAMO RENT-A-CAR RENTA HONOLULU HI"→ merchant="ALAMO RENT-A-CAR",address="HONOLULU, HI"
function parseMerchantLocation(
  raw: string,
  cleanFn: (s: string) => string = (s) => s.trim()
): { merchant: string; address?: string } {
  const stateMatch = raw.match(/\s+([A-Z]{2})$/);
  if (!stateMatch || !US_STATES.has(stateMatch[1])) {
    return { merchant: cleanFn(raw) };
  }
  const state = stateMatch[1];
  const beforeState = raw.slice(0, raw.length - stateMatch[0].length);
  const words = beforeState.split(/\s+/);

  const cityWords: string[] = [];
  let merchantEnd = words.length;
  for (let i = words.length - 1; i >= 0; i--) {
    const word = words[i];
    if (!/^[A-Z]+$/.test(word)) break;
    if (cityWords.length === 0) {
      cityWords.unshift(word);
      merchantEnd = i;
    } else if (cityWords.length < 2 && (word.length <= 3 || CITY_PREFIXES.has(word))) {
      cityWords.unshift(word);
      merchantEnd = i;
    } else {
      break;
    }
  }

  const merchantRaw = words.slice(0, merchantEnd).join(' ');
  const merchant = cleanFn(merchantRaw) || cleanFn(raw);
  const address = cityWords.length > 0 ? `${cityWords.join(' ')}, ${state}` : state;
  return { merchant, address };
}

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

    case 'capital-one': {
      // Columns: Transaction Date(YYYY-MM-DD), Posted Date, Card No.,
      // Description, Category, Debit, Credit
      const c1Raw = row[3]?.trim() || '';
      const c1Parsed = parseMerchantLocation(c1Raw);
      const c1Category = (row[4]?.trim() || '').toLowerCase();
      if (!row[5]?.trim()) {
        // No Debit value — check Credit column. Capital One uses "PMT" (not "payment") in description,
        // so also check the category column which reliably says "Payment/Credit" for card payments.
        if (!row[6]?.trim() || isCardPayment(c1Raw) || c1Category.includes('payment')) return null;
        date = row[0]?.trim();
        merchant = c1Parsed.merchant;
        address = c1Parsed.address;
        amount = parseAmount(row[6]);
        sourceCategory = row[4]?.trim() || undefined;
        txType = 'credit';
        break;
      }
      date = row[0]?.trim();
      merchant = c1Parsed.merchant;
      address = c1Parsed.address;
      amount = parseAmount(row[5]);
      sourceCategory = row[4]?.trim() || undefined;
      break;
    }

    case 'discover': {
      // Columns: Trans. Date(MM/DD/YYYY), Post Date, Description, Amount, Category
      // Positive = expense; negative = credit. Skip if negative AND a card payment.
      const discRaw = row[2]?.trim() || '';
      date = parseAmexDate(row[0]?.trim() || '');
      const discParsed = parseMerchantLocation(discRaw, cleanDiscoverMerchantName);
      merchant = discParsed.merchant;
      address = discParsed.address;
      amount = parseAmount(row[3]);
      sourceCategory = row[4]?.trim() || undefined;
      if (amount !== null && amount <= 0) {
        if (isCardPayment(discRaw)) return null;
        txType = 'credit';
      }
      break;
    }

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

    case 'wells-fargo': {
      // Columns: DATE(MM/DD/YYYY), DESCRIPTION, AMOUNT, CHECK#, STATUS
      // Negative = expense; positive = payment/refund. Skip if positive AND a card payment.
      const wfRaw = row[1]?.trim() || '';
      date = parseAmexDate(row[0]?.trim() || '');
      const wfParsed = parseMerchantLocation(wfRaw, cleanWellsFargoMerchantName);
      merchant = wfParsed.merchant;
      address = wfParsed.address;
      amount = parseAmount(row[2]);
      if (amount !== null && amount >= 0) {
        if (isCardPayment(wfRaw)) return null;
        txType = 'credit';
      }
      break;
    }

    case 'bofa': {
      const bofaRaw = row[1]?.trim() || '';
      const bofaParsed = parseMerchantLocation(bofaRaw);
      date = row[0]?.trim();
      merchant = bofaParsed.merchant;
      address = bofaParsed.address;
      amount = parseAmount(row[2]);
      break;
    }

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

// ── BofA Checking CSV Parser ─────────────────────────────────────────────────
// BofA checking exports have a 5-row summary block followed by a blank line,
// then the real transaction table starting with "Date,Description,Amount,Running Bal."

function classifyCheckingRow(
  desc: string,
  amount: number,
  accountType: 'personal-checking' | 'efuture-checking'
): { rowType: CheckingRowType; institution?: string; suggestedCategory?: string } {
  const d = desc.trim();

  // Always skip
  if (/beginning balance/i.test(d)) return { rowType: 'exclude' };
  if (amount === 0) return { rowType: 'exclude' };

  if (accountType === 'personal-checking') {
    // W2 income
    if (/MOODYS ANALYTICS.*PAYROLL/i.test(d)) return { rowType: 'income_w2' };

    // Exclude: eFuture → personal draw (avoid double-count)
    if (/Zelle payment from EFUTURE/i.test(d)) return { rowType: 'exclude' };

    // Credits: tax refunds
    if (/IRS TREAS 310/i.test(d) || /NY STATE.*NYSTTAXRFD/i.test(d)) return { rowType: 'credit' };

    // Credits: family / personal reimbursements
    if (/XU,\s*HAISHI/i.test(d) || /Zelle payment from KAI XU/i.test(d) || /Lopez et al/i.test(d)) return { rowType: 'credit' };
    if (/Zelle payment from .* Conf#/i.test(d) && !/EFUTURE/i.test(d) && amount > 0) return { rowType: 'credit' };

    // Exclude: matching Kai Xu pass-through (sent back same day)
    if (/Zelle payment to Kai Xu/i.test(d)) return { rowType: 'exclude' };

    // HY savings
    if (/GOLDMAN SACHS/i.test(d) && /TRANSFER/i.test(d)) return { rowType: 'savings', institution: 'Goldman Sachs' };
    if (/BETTERMENT/i.test(d) && /TRANSFER/i.test(d)) return { rowType: 'savings', institution: 'Betterment' };
    if (/MARCUS.*TRANSFER|GS BANK.*TRANSFER/i.test(d)) return { rowType: 'savings', institution: 'Goldman Sachs' };

    // Investments
    if (/SCHWAB.*MONEYLINK|SCHWAB.*TRANSFER/i.test(d) && !/KEEP THE CHANGE/i.test(d)) return { rowType: 'investment', institution: 'Schwab' };
    if (/FID BKG SVC.*MONEYLINE|FIDELITY.*MONEYLINE/i.test(d)) return { rowType: 'investment', institution: 'Fidelity' };
    if (/VANGUARD.*TRANSFER|VANGUARD.*ACH/i.test(d)) return { rowType: 'investment', institution: 'Vanguard' };

    // Exclude: credit card payments
    if (/AMERICAN EXPRESS.*ACH PMT/i.test(d)) return { rowType: 'exclude' };
    if (/WELLS FARGO CARD/i.test(d)) return { rowType: 'exclude' };
    if (/WF Credit Card/i.test(d)) return { rowType: 'exclude' };
    if (/DISCOVER.*E-PAYMENT/i.test(d)) return { rowType: 'exclude' };
    if (/CAPITAL ONE.*MOBILE PMT/i.test(d)) return { rowType: 'exclude' };
    if (/CITI CARD ONLINE.*PAYMENT/i.test(d)) return { rowType: 'exclude' };

    // Exclude: Venmo (tracked separately)
    if (/VENMO \*/i.test(d)) return { rowType: 'exclude' };

    // Exclude: BofA auto-savings (ignore for now)
    if (/KEEP THE CHANGE TRANSFER/i.test(d)) return { rowType: 'exclude' };

    // Expenses or misc credits
    if (amount < 0) return { rowType: 'expense', suggestedCategory: suggestCheckingCategory(d) };
    return { rowType: 'credit' };
  }

  // ── eFuture checking ──────────────────────────────────────────────────────
  // Income: YYK transfers into this account
  if (/transfer from CHK 1837.*YYK INTERNATIONAL/i.test(d)) return { rowType: 'income_efuture' };

  // Exclude: client check pass-throughs
  if (/BKOFAMERICA MOBILE.*DEPOSIT/i.test(d)) return { rowType: 'exclude' };

  // Exclude: forwarding checks to YYK / internal
  if (/transfer to CHK 1837.*YYK INTERNATIONAL/i.test(d)) return { rowType: 'exclude' };
  if (/Transfer MV5272/i.test(d)) return { rowType: 'exclude' };

  // Exclude: personal draw
  if (/Zelle.*payment to Elain Xu/i.test(d)) return { rowType: 'exclude' };

  // Exclude: credit card payment
  if (/Online Banking payment to CRD/i.test(d)) return { rowType: 'exclude' };

  // Credits: cashback
  if (/CASHREWARD.*EFUTURE/i.test(d)) return { rowType: 'credit' };

  // Expense: rent
  if (/WESTING INVESTMENT/i.test(d)) return { rowType: 'expense', suggestedCategory: 'Bills' };

  if (amount < 0) return { rowType: 'expense', suggestedCategory: suggestCheckingCategory(d) };
  return { rowType: 'credit' };
}

function extractCheckingMerchant(desc: string): string | undefined {
  // "Zelle (Scheduled) payment to [RECIPIENT] (for '...' | Conf# | ; | EOL)"
  const m = desc.match(
    /Zelle(?:\s+Scheduled)?\s+payment\s+to\s+([^;]+?)(?:\s+for\s+['"]|\s+Conf#|;|$)/i
  );
  if (m?.[1]) return m[1].trim() || undefined;
  return undefined;
}

function suggestCheckingCategory(desc: string): string {
  const d = desc.toLowerCase();
  if (/openai/i.test(d)) return 'Subscriptions';
  if (/usps|post office/i.test(d)) return 'Essentials';
  if (/zelle payment to/i.test(d)) return 'Bills';
  return 'Bills';
}

export function parseCheckingCSV(
  csvText: string,
  accountType: 'personal-checking' | 'efuture-checking'
): CheckingRow[] {
  const { data } = Papa.parse<string[]>(csvText, { header: false, skipEmptyLines: false });
  const rows = data as string[][];

  // Find the header row: "Date,Description,Amount,Running Bal."
  const headerIdx = rows.findIndex((r) => r[0]?.trim() === 'Date' && r[1]?.trim() === 'Description');
  if (headerIdx === -1) return [];

  const result: CheckingRow[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => !c?.trim())) continue;

    const dateStr = row[0]?.trim();
    const desc = row[1]?.trim() || '';
    const amountStr = row[2]?.trim();

    if (!dateStr || !amountStr) continue;

    const raw = parseFloat(amountStr.replace(/[^0-9.-]/g, ''));
    if (isNaN(raw)) continue;

    const date = parseAmexDate(dateStr); // MM/DD/YYYY → YYYY-MM-DD
    const [year, month] = date.split('-');

    const { rowType, institution, suggestedCategory } = classifyCheckingRow(desc, raw, accountType);
    if (rowType === 'exclude') continue;

    const merchantName = rowType === 'expense' ? extractCheckingMerchant(desc) : undefined;

    result.push({
      date,
      description: desc,
      ...(merchantName && { merchantName }),
      amount: Math.abs(raw),
      direction: raw >= 0 ? 'in' : 'out',
      rowType,
      institution,
      suggestedCategory,
      month,
      year,
    });
  }

  return result;
}
