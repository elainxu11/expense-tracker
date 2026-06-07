/**
 * One-off script to fix transactions where month column doesn't match the date.
 * Caused by timezone bug (new Date("YYYY-MM-DD").getMonth() uses local time).
 * Run with: npx tsx scripts/fix-month-mismatches.ts
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { google } from 'googleapis';

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '{}'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const SHEET_ID = process.env.GOOGLE_SHEET_ID!;

async function main() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Transactions!A:G',
  });

  const rows = res.data.values || [];
  const fixes: { sheetRow: number; date: string; storedMonth: string; correctMonth: string; correctYear: string; merchant: string }[] = [];

  rows.slice(1).forEach((row, i) => {
    const date: string = row[0] || '';
    const merchant: string = row[1] || '';
    const storedMonth: string = String(row[5] || '').padStart(2, '0');
    const storedYear: string = String(row[6] || '');

    if (!date.match(/^\d{4}-\d{2}-\d{2}$/)) return;

    const [year, month] = date.split('-');
    const correctMonth = month;
    const correctYear = year;

    if (storedMonth !== correctMonth || storedYear !== correctYear) {
      fixes.push({
        sheetRow: i + 2, // 1-based, +1 for header
        date,
        merchant,
        storedMonth,
        correctMonth,
        correctYear,
      });
    }
  });

  if (fixes.length === 0) {
    console.log('No mismatches found — sheet is clean!');
    return;
  }

  console.log(`Found ${fixes.length} mismatch(es):\n`);
  fixes.forEach((f) => {
    console.log(`  Row ${f.sheetRow}: ${f.date} "${f.merchant}" — month ${f.storedMonth} → ${f.correctMonth}, year → ${f.correctYear}`);
  });

  console.log('\nApplying fixes...');

  const updateData = fixes.flatMap((f) => [
    { range: `Transactions!F${f.sheetRow}`, values: [[f.correctMonth]] },
    { range: `Transactions!G${f.sheetRow}`, values: [[f.correctYear]] },
  ]);

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'USER_ENTERED',
      data: updateData,
    },
  });

  console.log('Done. All mismatches corrected.');
}

main().catch((err) => { console.error(err); process.exit(1); });
