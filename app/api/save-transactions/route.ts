import { appendTransactions, upsertMerchantMapping } from '@/lib/googleSheets';
import { Transaction } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { transactions } = await request.json();

    if (!transactions || !Array.isArray(transactions)) {
      return Response.json(
        { error: 'Invalid transactions format' },
        { status: 400 }
      );
    }

    await appendTransactions(transactions);

    // Save merchant mappings
    for (const tx of transactions) {
      await upsertMerchantMapping(tx.merchant, tx.category);
    }

    return Response.json({
      success: true,
      count: transactions.length,
    });
  } catch (error) {
    console.error('Save error:', error);
    return Response.json(
      { error: 'Failed to save transactions' },
      { status: 500 }
    );
  }
}
