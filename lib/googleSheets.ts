import { google } from 'googleapis';
import { Transaction, IncomeEntry, DEFAULT_CATEGORIES } from './types';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function appendTransactions(
  transactions: Transaction[]
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  const values = transactions.map((t) => [
    t.date,
    t.merchant,
    t.amount,
    t.card,
    t.category,
    t.month,
    t.year,
    t.type,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:H',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function appendIncome(
  income: IncomeEntry[]
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  const values = income.map((i) => [
    i.date,
    i.source,
    i.amount,
    i.month,
    i.year,
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Income!A:E',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function getMerchantMapping(): Promise<
  Record<string, string>
> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Merchant_Map!A:B',
    });

    const rows = response.data.values || [];
    const mapping: Record<string, string> = {};

    rows.slice(1).forEach((row) => {
      if (row[0] && row[1]) {
        mapping[row[0].toLowerCase()] = row[1];
      }
    });

    return mapping;
  } catch {
    return {};
  }
}

export async function upsertMerchantMapping(
  merchant: string,
  category: string
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  const merchantLower = merchant.toLowerCase();

  let rows: string[][] = [];
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Merchant_Map!A:B',
    });
    rows = (existing.data.values as string[][]) || [];
  } catch {
    // Sheet may not exist yet — fall through to append
  }

  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0]?.toLowerCase() === merchantLower);

  if (rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Merchant_Map!B${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[category]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Merchant_Map!A:B',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[merchantLower, category]] },
    });
  }
}

export async function updateTransactionCategory(
  rowIndex: number,
  category: string
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  // rowIndex is 0-based data index; +2 accounts for 1-based rows and header row
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Transactions!E${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[category]] },
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Transactions!A:H',
    });

    const rows = response.data.values || [];
    const transactions: Transaction[] = [];

    rows.slice(1).forEach((row, index) => {
      if (row[0]) {
        transactions.push({
          id: `tx-${index}`,
          date: row[0],
          merchant: row[1],
          amount: parseFloat(row[2]),
          card: row[3],
          category: row[4],
          month: String(row[5]).padStart(2, '0'),
          year: row[6],
          type: (row[7] as 'expense' | 'credit') || 'expense',
        });
      }
    });

    return transactions;
  } catch {
    return [];
  }
}

async function ensureSettingsSheet(): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Settings!A1' });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Settings' } } }] },
    });
  }
}

export async function getSettings(): Promise<{ categories: string[]; cards: string[] }> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  try {
    const [catRes, cardRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Settings!A:A' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Settings!B:B' }),
    ]);
    const categories = (catRes.data.values || []).flat().filter(Boolean) as string[];
    const cards = (cardRes.data.values || []).flat().filter(Boolean) as string[];
    return {
      categories: categories.length > 0 ? categories : DEFAULT_CATEGORIES,
      cards,
    };
  } catch {
    return { categories: DEFAULT_CATEGORIES, cards: [] };
  }
}

export async function saveCategories(categories: string[]): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  await ensureSettingsSheet();
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'Settings!A:A' });
  if (categories.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Settings!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: categories.map((c) => [c]) },
    });
  }
}

export async function saveCards(cards: string[]): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  await ensureSettingsSheet();
  await sheets.spreadsheets.values.clear({ spreadsheetId: SHEET_ID, range: 'Settings!B:B' });
  if (cards.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Settings!B1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: cards.map((c) => [c]) },
    });
  }
}
