import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { UploadSession } from '@/lib/types';
import {
  updateTransactionCategory,
  updateTransactionDeductible,
  updateTransactionIgnored,
  appendTransactions,
  batchUpsertMerchantMappings,
  deleteTransactionsByContent,
  deleteIncomeRowsByContent,
  deleteSavingsRowsByContent,
  deleteMerchantMappingEntries,
} from '@/lib/googleSheets';

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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessions = await readHistory();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return Response.json({ success: true });

  const session = sessions[idx];

  if (session.committed) {
    const merchants = session.transactions.map((t) => t.merchant);
    await Promise.all([
      session.transactions.length
        ? deleteTransactionsByContent(session.transactions)
        : Promise.resolve(),
      session.incomeRows?.length
        ? deleteIncomeRowsByContent(session.incomeRows)
        : Promise.resolve(),
      session.savingsRows?.length
        ? deleteSavingsRowsByContent(session.savingsRows)
        : Promise.resolve(),
      merchants.length
        ? deleteMerchantMappingEntries(merchants)
        : Promise.resolve(),
    ]);
  }

  const filtered = sessions.filter((s) => s.id !== id);
  await writeHistory(filtered);
  return Response.json({ success: true });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const sessions = await readHistory();
  const idx = sessions.findIndex((s) => s.id === id);
  if (idx === -1) return Response.json({ error: 'Not found' }, { status: 404 });

  const session = sessions[idx];

  if (body.action === 'update-category') {
    const { txIndex, category } = body as { txIndex: number; category: string };
    const tx = session.transactions[txIndex];

    if (session.committed) {
      if (tx.ignored) {
        // Transaction was ignored at commit time — append it to Sheets now
        const newRowIndex = await appendTransactions([{ ...tx, category, ignored: false }]);
        await batchUpsertMerchantMappings([{ merchant: tx.merchant, category }]);
        sessions[idx] = {
          ...session,
          transactions: session.transactions.map((t, i) =>
            i === txIndex ? { ...t, category, ignored: false, id: `tx-${newRowIndex}` } : t
          ),
        };
      } else {
        const rowIndex = parseInt(tx.id.replace('tx-', ''), 10);
        await updateTransactionCategory(rowIndex, category);
        sessions[idx] = {
          ...session,
          transactions: session.transactions.map((t, i) =>
            i === txIndex ? { ...t, category } : t
          ),
        };
      }
    } else {
      // Not yet committed — just update JSON; clear ignored so it commits normally
      sessions[idx] = {
        ...session,
        transactions: session.transactions.map((t, i) =>
          i === txIndex ? { ...t, category, ...(t.ignored && { ignored: false }) } : t
        ),
      };
    }

    await writeHistory(sessions);
    return Response.json({ success: true, session: sessions[idx] });
  }

  if (body.action === 'remove') {
    const { txIndices } = body as { txIndices: number[] };
    const toRemove = new Set(txIndices);

    if (session.committed) {
      // Ignored transactions were never written to Sheets, so only delete non-ignored ones
      const txsToDelete = txIndices
        .map((i) => session.transactions[i])
        .filter((tx) => !tx.ignored);
      if (txsToDelete.length > 0) await deleteTransactionsByContent(txsToDelete);
    }

    const remaining = sessions[idx].transactions.filter((_, i) => !toRemove.has(i));
    sessions[idx] = {
      ...sessions[idx],
      transactions: remaining,
      expenseCount: remaining.filter((t) => t.type === 'expense').length,
      creditCount: remaining.filter((t) => t.type === 'credit').length,
      totalAmount: remaining
        .filter((t) => t.type === 'expense')
        .reduce((sum, t) => sum + t.amount, 0),
    };

    const updatedSession = sessions[idx];
    if (updatedSession.transactions.length === 0) {
      sessions.splice(idx, 1);
    }

    await writeHistory(sessions);
    return Response.json({ success: true, session: updatedSession });
  }

  if (body.action === 'toggle-deductible') {
    const { txIndex } = body as { txIndex: number };
    const tx = session.transactions[txIndex];
    const deductible = !tx.deductible;
    if (session.committed) {
      const rowIndex = parseInt(tx.id.replace('tx-', ''), 10);
      await updateTransactionDeductible(rowIndex, deductible);
    }
    sessions[idx] = {
      ...session,
      transactions: session.transactions.map((t, i) =>
        i === txIndex ? { ...t, deductible } : t
      ),
    };
    await writeHistory(sessions);
    return Response.json({ success: true, session: sessions[idx] });
  }

  if (body.action === 'toggle-ignored') {
    const { txIndex } = body as { txIndex: number };
    const tx = session.transactions[txIndex];
    const newIgnored = !tx.ignored;

    if (session.committed && /^tx-\d+$/.test(tx.id)) {
      // Transaction is in Sheets — sync the ignored flag there
      const rowIndex = parseInt(tx.id.replace('tx-', ''), 10);
      await updateTransactionIgnored(rowIndex, newIgnored);
    }

    sessions[idx] = {
      ...session,
      transactions: session.transactions.map((t, i) =>
        i === txIndex ? { ...t, ignored: newIgnored } : t
      ),
    };
    await writeHistory(sessions);
    return Response.json({ success: true, session: sessions[idx] });
  }

  if (body.action === 'rename') {
    const { label } = body as { label: string };
    sessions[idx] = { ...session, cardLabel: label.trim() };
    await writeHistory(sessions);
    return Response.json({ success: true, session: sessions[idx] });
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 });
}
