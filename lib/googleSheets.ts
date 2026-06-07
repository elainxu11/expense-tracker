import { google } from 'googleapis';
import { Transaction, IncomeEntry, SavingsEntry, DEFAULT_CATEGORIES, VendorRule } from './types';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID;

export async function appendTransactions(
  transactions: Transaction[]
): Promise<number> {
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
    t.deductible ? 'TRUE' : 'FALSE',
  ]);

  const response = await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:I',
    valueInputOption: 'USER_ENTERED',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });

  // updatedRange e.g. "Transactions!A5:H12" — parse first sheet row, convert to 0-based data index
  const range = response.data.updates?.updatedRange ?? '';
  const match = range.match(/[A-Z](\d+)/);
  const sheetRow = match ? parseInt(match[1], 10) : 2;
  return sheetRow - 2;
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
    i.description ?? '',
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Income!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function getIncome(): Promise<IncomeEntry[]> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Income!A:F',
    });
    const rows = response.data.values || [];
    return rows.slice(1).filter((r) => r[0]).map((row, i) => ({
      id: `inc-${i}`,
      date: row[0],
      source: (row[1] as 'W2' | 'Efuture' | 'Credit') || 'W2',
      amount: parseFloat(row[2]) || 0,
      month: String(row[3]).padStart(2, '0'),
      year: row[4],
      description: row[5] || undefined,
    }));
  } catch {
    return [];
  }
}

async function ensureSheet(title: string): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  try {
    await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: `${title}!A1` });
  } catch {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
  }
}

export async function appendSavingsEntries(entries: SavingsEntry[]): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  if (entries.length === 0) return;
  await ensureSheet('Savings');
  const values = entries.map((s) => [s.date, s.institution, s.entryType, s.amount, s.month, s.year]);
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Savings!A:F',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values },
  });
}

export async function getSavings(): Promise<SavingsEntry[]> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Savings!A:F',
    });
    const rows = response.data.values || [];
    return rows.slice(1).filter((r) => r[0]).map((row, i) => ({
      id: `sav-${i}`,
      date: row[0],
      institution: row[1],
      entryType: (row[2] as 'hy-savings' | 'investment') || 'hy-savings',
      amount: parseFloat(row[3]) || 0,
      month: String(row[4]).padStart(2, '0'),
      year: row[5],
    }));
  } catch {
    return [];
  }
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

export async function getFullMerchantMapping(): Promise<{
  categories: Record<string, string>;
  deductible: Record<string, boolean>;
}> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Merchant_Map!A:C',
    });
    const rows = response.data.values || [];
    const categories: Record<string, string> = {};
    const deductible: Record<string, boolean> = {};
    rows.slice(1).forEach((row) => {
      if (row[0]) {
        if (row[1]) categories[row[0].toLowerCase()] = row[1];
        if (row[2] === 'TRUE') deductible[row[0].toLowerCase()] = true;
      }
    });
    return { categories, deductible };
  } catch {
    return { categories: {}, deductible: {} };
  }
}

export async function upsertDeductibleMapping(merchant: string, deductible: boolean): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  const merchantLower = merchant.toLowerCase();

  let rows: string[][] = [];
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Merchant_Map!A:A',
    });
    rows = (existing.data.values as string[][]) || [];
  } catch {}

  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0]?.toLowerCase() === merchantLower);

  if (rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Merchant_Map!C${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[deductible ? 'TRUE' : '']] },
    });
  } else if (deductible) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Merchant_Map!A:C',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[merchantLower, '', 'TRUE']] },
    });
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

export async function batchUpsertMerchantMappings(
  entries: { merchant: string; category: string }[]
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  if (entries.length === 0) return;

  // Deduplicate: last entry for each merchant wins
  const dedupMap = new Map<string, string>();
  for (const { merchant, category } of entries) {
    dedupMap.set(merchant.toLowerCase(), category);
  }

  // Ensure the Merchant_Map sheet exists before reading or writing
  let rows: string[][] = [];
  try {
    const existing = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Merchant_Map!A:B',
    });
    rows = (existing.data.values as string[][]) || [];
  } catch {
    // Sheet doesn't exist yet — create it
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { requests: [{ addSheet: { properties: { title: 'Merchant_Map' } } }] },
    });
  }

  const toAppend: string[][] = [];
  const updateData: { range: string; values: string[][] }[] = [];

  for (const [merchantLower, category] of dedupMap.entries()) {
    const rowIndex = rows.findIndex((row, i) => i > 0 && row[0]?.toLowerCase() === merchantLower);
    if (rowIndex > 0) {
      updateData.push({ range: `Merchant_Map!B${rowIndex + 1}`, values: [[category]] });
    } else {
      toAppend.push([merchantLower, category]);
    }
  }

  if (updateData.length > 0) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'USER_ENTERED', data: updateData },
    });
  }

  if (toAppend.length > 0) {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Merchant_Map!A:B',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: toAppend },
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

export async function updateTransactionDeductible(
  rowIndex: number,
  deductible: boolean
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Transactions!I${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[deductible ? 'TRUE' : 'FALSE']] },
  });
}

export async function updateTransactionIgnored(
  rowIndex: number,
  ignored: boolean
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Transactions!J${sheetRow}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[ignored ? 'TRUE' : '']] },
  });
}

export async function updateTransactionDate(
  rowIndex: number,
  date: string,
  month: string,
  year: string
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  const sheetRow = rowIndex + 2;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: [
        { range: `Transactions!A${sheetRow}`, values: [[date]] },
        { range: `Transactions!F${sheetRow}`, values: [[month]] },
        { range: `Transactions!G${sheetRow}`, values: [[year]] },
      ],
    },
  });
}

export async function deleteTransactions(rowIndices: number[]): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const txSheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.title === 'Transactions'
  );
  if (!txSheet?.properties || txSheet.properties.sheetId == null) {
    throw new Error('Transactions sheet not found');
  }
  const sheetId = txSheet.properties.sheetId;

  // Delete from highest index first so earlier deletes don't shift later indices
  const sorted = [...rowIndices].sort((a, b) => b - a);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: sorted.map((rowIndex) => ({
        deleteDimension: {
          range: {
            sheetId,
            dimension: 'ROWS',
            // rowIndex is 0-based data index; +1 skips header row (sheet uses 0-based indexing)
            startIndex: rowIndex + 1,
            endIndex: rowIndex + 2,
          },
        },
      })),
    },
  });
}

// Generic helper — deletes rows by 0-based data indices (header is row 0) from any named sheet
async function deleteRowsFromSheet(sheetTitle: string, rowIndices: number[]): Promise<void> {
  if (rowIndices.length === 0) return;
  const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId: SHEET_ID });
  const sheet = spreadsheet.data.sheets?.find((s) => s.properties?.title === sheetTitle);
  if (!sheet?.properties || sheet.properties.sheetId == null) return; // sheet missing, nothing to delete
  const sheetId = sheet.properties.sheetId;
  const sorted = [...rowIndices].sort((a, b) => b - a);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      requests: sorted.map((rowIndex) => ({
        deleteDimension: {
          range: { sheetId, dimension: 'ROWS', startIndex: rowIndex + 1, endIndex: rowIndex + 2 },
        },
      })),
    },
  });
}

// Key helpers for content-based matching (amounts rounded to cents to avoid float drift)
function cents(v: string | number) { return Math.round(parseFloat(String(v)) * 100); }

export async function deleteMerchantMappingEntries(merchants: string[]): Promise<void> {
  if (!SHEET_ID || merchants.length === 0) return;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Merchant_Map!A:A' });
  const rows = (res.data.values || []).slice(1);
  const toDelete = new Set(merchants.map((m) => m.toLowerCase()));
  const indices = rows
    .map((r, i) => ({ i, name: String(r[0] || '').toLowerCase() }))
    .filter(({ name }) => toDelete.has(name))
    .map(({ i }) => i);
  await deleteRowsFromSheet('Merchant_Map', indices);
}

export async function deleteTransactionsByContent(transactions: Transaction[]): Promise<void> {
  if (!SHEET_ID || transactions.length === 0) return;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Transactions!A:I' });
  const rows = (res.data.values || []).slice(1);
  const keys = new Set(transactions.map((t) => `${t.date}|${t.merchant}|${cents(t.amount)}|${t.card}|${t.type}`));
  const indices = rows
    .map((r, i) => ({ i, key: `${r[0]}|${r[1]}|${cents(r[2])}|${r[3]}|${r[7] || 'expense'}` }))
    .filter(({ key }) => keys.has(key))
    .map(({ i }) => i);
  await deleteRowsFromSheet('Transactions', indices);
}

export async function deleteIncomeRowsByContent(entries: IncomeEntry[]): Promise<void> {
  if (!SHEET_ID || entries.length === 0) return;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Income!A:F' });
  const rows = (res.data.values || []).slice(1);
  const keys = new Set(entries.map((e) => `${e.date}|${e.source}|${cents(e.amount)}`));
  const indices = rows
    .map((r, i) => ({ i, key: `${r[0]}|${r[1]}|${cents(r[2])}` }))
    .filter(({ key }) => keys.has(key))
    .map(({ i }) => i);
  await deleteRowsFromSheet('Income', indices);
}

export async function deleteSavingsRowsByContent(entries: SavingsEntry[]): Promise<void> {
  if (!SHEET_ID || entries.length === 0) return;
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Savings!A:F' });
  const rows = (res.data.values || []).slice(1);
  // Savings schema: date, institution, entryType, amount, month, year
  const keys = new Set(entries.map((e) => `${e.date}|${e.institution}|${e.entryType}|${cents(e.amount)}`));
  const indices = rows
    .map((r, i) => ({ i, key: `${r[0]}|${r[1]}|${r[2]}|${cents(r[3])}` }))
    .filter(({ key }) => keys.has(key))
    .map(({ i }) => i);
  await deleteRowsFromSheet('Savings', indices);
}

export async function getTransactions(): Promise<Transaction[]> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');

  try {
    const [txResponse, { deductible: deductibleMap }] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Transactions!A:J' }),
      getFullMerchantMapping(),
    ]);

    const rows = txResponse.data.values || [];
    const transactions: Transaction[] = [];

    rows.slice(1).forEach((row, index) => {
      if (row[0]) {
        if (row[9] === 'TRUE') return; // ignored — exclude from all views
        const explicitFlag = row[8] === 'TRUE';
        const merchantFlag = deductibleMap[String(row[1]).toLowerCase()] ?? false;
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
          deductible: explicitFlag || merchantFlag,
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

// ── Budget ───────────────────────────────────────────────────────────────────
// Sheet: Settings  Column: C1 = JSON string mapping category -> monthly budget

export const DEFAULT_BUDGET: Record<string, number> = {
  'Food & Drinks': 400,
  'Shopping': 200,
  'Groceries': 300,
  'Travel': 400,
  'Entertainment': 150,
  'Gifts': 75,
  'Subscriptions': 80,
  'Transport': 120,
  'Bills': 150,
  'Essentials': 100,
  'Health & Wellness': 100,
  'Investments': 500,
  'Unnecessary Purchases': 100,
  'Donations': 50,
};

export async function getBudget(): Promise<Record<string, number>> {
  if (!SHEET_ID) return DEFAULT_BUDGET;
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Settings!C1' });
    const raw = res.data.values?.[0]?.[0];
    if (raw) return { ...DEFAULT_BUDGET, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_BUDGET;
}

export async function saveBudget(budget: Record<string, number>): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  await ensureSettingsSheet();
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Settings!C1',
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [[JSON.stringify(budget)]] },
  });
}

// ── Vendor Rules ─────────────────────────────────────────────────────────────
// Sheet: Vendor_Rules  Columns: A=Pattern  B=Normalized  C=MatchType

export async function getVendorRules(): Promise<VendorRule[]> {
  if (!SHEET_ID) return [];
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Vendor_Rules!A:C',
    });
    const rows = response.data.values || [];
    return rows.slice(1).filter((r) => r[0] && r[1]).map((row) => ({
      pattern: row[0],
      normalized: row[1],
      matchType: (row[2] === 'contains' ? 'contains' : 'prefix') as 'prefix' | 'contains',
    }));
  } catch {
    return [];
  }
}

export async function upsertVendorRule(
  pattern: string,
  normalized: string,
  matchType: 'prefix' | 'contains'
): Promise<void> {
  if (!SHEET_ID) throw new Error('GOOGLE_SHEET_ID not set');
  await ensureSheet('Vendor_Rules');

  let rows: string[][] = [];
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Vendor_Rules!A:A',
    });
    rows = (res.data.values as string[][]) || [];
  } catch {}

  const rowIndex = rows.findIndex((row, i) => i > 0 && row[0]?.toLowerCase() === pattern.toLowerCase());
  if (rowIndex > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Vendor_Rules!A${rowIndex + 1}:C${rowIndex + 1}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[pattern, normalized, matchType]] },
    });
  } else {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Vendor_Rules!A:C',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [[pattern, normalized, matchType]] },
    });
  }
}

export async function deleteVendorRule(pattern: string): Promise<void> {
  if (!SHEET_ID) return;
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Vendor_Rules!A:A',
    });
    const rows = ((res.data.values || []) as string[][]).slice(1);
    const lowerPattern = pattern.toLowerCase();
    const indices = rows
      .map((r, i) => ({ i, val: String(r[0] || '').toLowerCase() }))
      .filter(({ val }) => val === lowerPattern)
      .map(({ i }) => i);
    await deleteRowsFromSheet('Vendor_Rules', indices);
  } catch {}
}
