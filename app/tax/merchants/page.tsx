import { getTransactions, getFullMerchantMapping } from '@/lib/googleSheets';
import MerchantDeductibleList, { MerchantSummary } from '@/app/_components/MerchantDeductibleList';
import Link from 'next/link';

export default async function MerchantTaxPage() {
  const [transactions, { deductible: deductibleMap }] = await Promise.all([
    getTransactions(),
    getFullMerchantMapping(),
  ]);

  const expenses = transactions.filter((t) => t.type === 'expense');

  const merchantMap = new Map<string, { topCategory: string; totalAmount: number; txCount: number; categoryCounts: Record<string, number> }>();

  for (const tx of expenses) {
    const existing = merchantMap.get(tx.merchant);
    if (existing) {
      existing.totalAmount += tx.amount;
      existing.txCount += 1;
      existing.categoryCounts[tx.category] = (existing.categoryCounts[tx.category] ?? 0) + 1;
    } else {
      merchantMap.set(tx.merchant, {
        topCategory: tx.category,
        totalAmount: tx.amount,
        txCount: 1,
        categoryCounts: { [tx.category]: 1 },
      });
    }
  }

  const merchants: MerchantSummary[] = Array.from(merchantMap.entries())
    .map(([merchant, data]) => {
      const topCategory = Object.entries(data.categoryCounts).sort((a, b) => b[1] - a[1])[0][0];
      return {
        merchant,
        topCategory,
        totalAmount: data.totalAmount,
        txCount: data.txCount,
        deductible: deductibleMap[merchant.toLowerCase()] ?? false,
      };
    })
    .sort((a, b) => {
      if (a.deductible !== b.deductible) return a.deductible ? -1 : 1;
      return b.totalAmount - a.totalAmount;
    });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/tax" className="text-slate-400 hover:text-slate-600 text-sm font-medium">← Tax Summary</Link>
      </div>
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Merchant Tax Status</h1>
        <p className="text-slate-500 mt-1 text-sm">
          Mark merchants as deductible — applies to all their transactions, past and future.
        </p>
      </div>
      <MerchantDeductibleList merchants={merchants} />
    </div>
  );
}
