import { suggestCategory, mapSourceCategory } from '@/lib/merchants';
import { getFullMerchantMapping } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const { merchant, sourceCategory } = await request.json();

    if (!merchant) {
      return Response.json({ error: 'Missing merchant' }, { status: 400 });
    }

    const { categories, deductible: deductibleMap } = await getFullMerchantMapping();
    const key = merchant.toLowerCase();
    const learnedDeductible = deductibleMap[key] ?? false;

    // Learned category corrections take highest priority
    const learnedCategory = categories[key];
    if (learnedCategory) return Response.json({ category: learnedCategory, deductible: learnedDeductible });

    // Then bank-provided source category
    if (sourceCategory) {
      const mapped = mapSourceCategory(sourceCategory);
      if (mapped) return Response.json({ category: mapped, deductible: learnedDeductible });
    }

    // Fall back to default merchant name heuristics
    const category = await suggestCategory(merchant);
    return Response.json({ category, deductible: learnedDeductible });
  } catch (error) {
    console.error('Category suggestion error:', error);
    return Response.json({ category: 'Shopping', deductible: false }, { status: 200 });
  }
}
