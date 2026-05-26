import { suggestCategory } from '@/lib/merchants';
import { getMerchantMapping } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const { merchant } = await request.json();

    if (!merchant) {
      return Response.json(
        { error: 'Missing merchant' },
        { status: 400 }
      );
    }

    const merchantMapping = await getMerchantMapping();
    const category = await suggestCategory(merchant, merchantMapping);

    return Response.json({ category });
  } catch (error) {
    console.error('Category suggestion error:', error);
    return Response.json(
      { category: 'Shopping' },
      { status: 200 }
    );
  }
}
