import { revalidatePath } from 'next/cache';
import { updateTransactionCategory, updateTransactionDeductible, updateTransactionIgnored, updateTransactionDate } from '@/lib/googleSheets';

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { rowIndex } = body;
    if (typeof rowIndex !== 'number') {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    if ('category' in body) {
      if (!body.category) return Response.json({ error: 'Invalid request' }, { status: 400 });
      await updateTransactionCategory(rowIndex, body.category);
    } else if ('deductible' in body) {
      await updateTransactionDeductible(rowIndex, Boolean(body.deductible));
    } else if ('ignored' in body) {
      await updateTransactionIgnored(rowIndex, Boolean(body.ignored));
    } else if ('date' in body) {
      if (!body.date || !body.month || !body.year) return Response.json({ error: 'Invalid request' }, { status: 400 });
      await updateTransactionDate(rowIndex, body.date, body.month, body.year);
    } else {
      return Response.json({ error: 'Invalid request' }, { status: 400 });
    }

    revalidatePath('/', 'layout');
    return Response.json({ success: true });
  } catch (error) {
    console.error('Update error:', error);
    return Response.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}
