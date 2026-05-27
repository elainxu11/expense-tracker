import { suggestCategory, mapSourceCategory } from '@/lib/merchants';
import { getMerchantMapping } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const { merchant, sourceCategory } = await request.json();

    if (!merchant) {
      return Response.json(
        { error: 'Missing merchant' },
        { status: 400 }
      );
    }

    const merchantMapping = await getMerchantMapping();

    // Learned corrections take highest priority
    const learned = merchantMapping[merchant.toLowerCase()];
    if (learned) return Response.json({ category: learned });

    // Then bank-provided source category
    if (sourceCategory) {
      const mapped = mapSourceCategory(sourceCategory);
      if (mapped) return Response.json({ category: mapped });
    }

    // Fall back to default merchant name heuristics
    const category = await suggestCategory(merchant);
    return Response.json({ category });
  } catch (error) {
    console.error('Category suggestion error:', error);
    return Response.json(
      { category: 'Shopping' },
      { status: 200 }
    );
  }
}
