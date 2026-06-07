import { upsertMerchantMapping, upsertDeductibleMapping } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const { merchant, category, deductible } = await request.json();
    if (!merchant) {
      return Response.json({ error: 'Missing merchant' }, { status: 400 });
    }
    if (category) await upsertMerchantMapping(merchant, category);
    if (typeof deductible === 'boolean') await upsertDeductibleMapping(merchant, deductible);
    return Response.json({ success: true });
  } catch (error) {
    console.error('Save merchant mapping error:', error);
    return Response.json({ error: 'Failed to save mapping' }, { status: 500 });
  }
}
