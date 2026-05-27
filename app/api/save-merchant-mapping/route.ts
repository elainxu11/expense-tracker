import { upsertMerchantMapping } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const { merchant, category } = await request.json();
    if (!merchant || !category) {
      return Response.json({ error: 'Missing merchant or category' }, { status: 400 });
    }
    await upsertMerchantMapping(merchant, category);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Save merchant mapping error:', error);
    return Response.json({ error: 'Failed to save mapping' }, { status: 500 });
  }
}
