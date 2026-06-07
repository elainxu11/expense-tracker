import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { UploadSession } from '@/lib/types';

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

export async function GET() {
  const sessions = await readHistory();
  return Response.json(sessions.slice().reverse());
}

export async function POST(request: Request) {
  const body = await request.json();
  const sessions = await readHistory();
  const session: UploadSession = {
    id: `${Date.now()}`,
    savedAt: new Date().toISOString(),
    card: body.card,
    cardLabel: body.cardLabel,
    transactions: body.transactions,
    expenseCount: body.expenseCount,
    creditCount: body.creditCount,
    totalAmount: body.totalAmount,
    ...(body.sessionType && { sessionType: body.sessionType }),
    ...(body.incomeRows && { incomeRows: body.incomeRows }),
    ...(body.savingsRows && { savingsRows: body.savingsRows }),
  };
  sessions.push(session);
  await writeHistory(sessions);
  return Response.json({ id: session.id });
}
