import { deleteTransactions } from '@/lib/googleSheets';

export async function DELETE(request: Request) {
  try {
    const { rowIndices } = await request.json();
    if (!Array.isArray(rowIndices) || rowIndices.some((i) => typeof i !== 'number')) {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }
    await deleteTransactions(rowIndices);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Delete error:', error);
    return Response.json({ error: 'Failed to delete transactions' }, { status: 500 });
  }
}
