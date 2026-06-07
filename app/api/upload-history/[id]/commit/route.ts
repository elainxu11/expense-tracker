import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { UploadSession } from '@/lib/types';
import { appendTransactions, appendIncome, appendSavingsEntries, batchUpsertMerchantMappings } from '@/lib/googleSheets';

const HISTORY_PATH = join(process.cwd(), 'data', 'upload-history.json');

async function readHistory(): Promise<UploadSession[]> {
  try {
    const raw = await readFile(HISTORY_PATH, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeHistory(sessions: UploadSession[]): Promise<void> {
  await writeFile(HISTORY_PATH, JSON.stringify(sessions, null, 2));
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessions = await readHistory();
  const idx = sessions.findIndex((s) => s.id === id);

  if (idx === -1) {
    return Response.json({ error: 'Session not found' }, { status: 404 });
  }

  const session = sessions[idx];

  const txsToCommit = session.transactions.filter((t) => !t.ignored);
  const txsForMapping = txsToCommit;

  let startRowIndex = -1;
  try {
    if (session.sessionType === 'checking') {
      // Checking sessions: commit income + savings + transactions in parallel
      const [, , txIdx] = await Promise.all([
        session.incomeRows?.length ? appendIncome(session.incomeRows) : Promise.resolve(),
        session.savingsRows?.length ? appendSavingsEntries(session.savingsRows) : Promise.resolve(),
        txsToCommit.length ? appendTransactions(txsToCommit) : Promise.resolve(-1),
      ]);
      startRowIndex = (txIdx as number) ?? -1;
      if (txsForMapping.length) {
        await batchUpsertMerchantMappings(
          txsForMapping.map((tx) => ({ merchant: tx.merchant, category: tx.category }))
        );
      }
    } else {
      if (txsToCommit.length) {
        startRowIndex = await appendTransactions(txsToCommit);
        await batchUpsertMerchantMappings(
          txsForMapping.map((tx) => ({ merchant: tx.merchant, category: tx.category }))
        );
      }
    }
  } catch (error) {
    console.error('Commit error:', error);
    const message = error instanceof Error ? error.message : 'Failed to save to Google Sheets';
    return Response.json({ error: message }, { status: 500 });
  }

  // Re-assign transaction IDs to actual sheet row indices for non-ignored transactions.
  // Ignored transactions were not written to Sheets, so their IDs are left unchanged.
  let rowOffset = 0;
  const updatedTransactions = startRowIndex >= 0
    ? session.transactions.map((tx) => {
        if (tx.ignored) return tx;
        const updated = { ...tx, id: `tx-${startRowIndex + rowOffset}` };
        rowOffset++;
        return updated;
      })
    : session.transactions;

  sessions[idx] = {
    ...session,
    committed: true,
    committedAt: new Date().toISOString(),
    transactions: updatedTransactions,
  };

  await writeHistory(sessions);

  return Response.json({ success: true, count: session.transactions.length });
}
