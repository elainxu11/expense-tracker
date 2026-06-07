import { parseCSV, parseCheckingCSV } from '@/lib/csvParser';

const CHECKING_TYPES = new Set(['personal-checking', 'efuture-checking']);

export async function POST(request: Request) {
  try {
    const { csv, cardType } = await request.json();

    if (!csv || !cardType) {
      return Response.json({ error: 'Missing csv or cardType' }, { status: 400 });
    }

    if (CHECKING_TYPES.has(cardType)) {
      const rows = parseCheckingCSV(csv, cardType as 'personal-checking' | 'efuture-checking');
      if (rows.length === 0) {
        return Response.json({ error: 'No transactions found in CSV' }, { status: 400 });
      }
      return Response.json({ rows });
    }

    const transactions = parseCSV(csv, cardType);

    if (transactions.length === 0) {
      return Response.json({ error: 'No transactions found in CSV' }, { status: 400 });
    }

    return Response.json({ transactions });
  } catch (error) {
    console.error('Parse error:', error);
    return Response.json({ error: 'Failed to parse CSV' }, { status: 500 });
  }
}
