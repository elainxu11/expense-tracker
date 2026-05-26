import { google } from 'googleapis';
import { Transaction, IncomeEntry } from './types';

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
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:G',
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

export async function saveMerchantMapping(
  merchant: string,
  category: string
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Merchant_Map!A:B',
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[merchant, category]],
    },
  });
}

export async function getTransactions(): Promise<Transaction[]> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Transactions!A:G',
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
          month: row[5],
          year: row[6],
        });
      }
    });

    return transactions;
  } catch {
    return [];
  }
}
