import { updateTransactionCategory } from '@/lib/googleSheets';

export async function PUT(request: Request) {
  try {
    const { rowIndex, category } = await request.json();
    if (typeof rowIndex !== 'number' || !category) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    await updateTransactionCategory(rowIndex, category);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Update error:', error);
    return Response.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}
