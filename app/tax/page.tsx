import Link from 'next/link';
import { getTransactions } from '@/lib/googleSheets';
import { Transaction } from '@/lib/types';
import YearPicker from '../_components/YearPicker';

function groupByCategory(txs: Transaction[]): [string, Transaction[]][] {
  const groups: Record<string, Transaction[]> = {};
  for (const tx of txs) {
    if (!groups[tx.category]) groups[tx.category] = [];
    groups[tx.category].push(tx);
  }
  return Object.entries(groups).sort(
    (a, b) =>
      b[1].reduce((s, t) => s + t.amount, 0) -
      a[1].reduce((s, t) => s + t.amount, 0)
  );
}

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const allTransactions = await getTransactions();
  const { year } = await searchParams;

  const now = new Date();
  const availableYears = [...new Set(allTransactions.map((t) => t.year))].sort().reverse();
  if (!availableYears.includes(String(now.getFullYear()))) {
    availableYears.unshift(String(now.getFullYear()));
  }
  const selectedYear = year ?? availableYears[0] ?? String(now.getFullYear());

  const deductible = allTransactions.filter(
    (t) => t.deductible && t.type === 'expense' && t.year === selectedYear
  );

  const totalDeductible = deductible.reduce((s, t) => s + t.amount, 0);
  const byCategory = groupByCategory(deductible);

  const sorted = [...deductible].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Tax Summary</h1>
          <p className="text-slate-500 mt-1 text-sm">Business expenses you marked as tax deductible</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/tax/merchants"
            className="px-4 py-2 rounded-lg border-2 border-slate-200 bg-white text-slate-700 hover:border-blue-400 font-semibold text-sm transition"
          >
            Manage Merchants
          </Link>
          <YearPicker selectedYear={selectedYear} availableYears={availableYears} />
        </div>
      </div>

      {/* Top summary */}
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-800 mb-1">Total Deductible Expenses — {selectedYear}</p>
          <p className="text-5xl font-bold text-green-900">${totalDeductible.toFixed(2)}</p>
          <p className="text-green-700 mt-2 text-sm">{deductible.length} transaction{deductible.length !== 1 ? 's' : ''} across {byCategory.length} categor{byCategory.length !== 1 ? 'ies' : 'y'}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200 shadow flex flex-col justify-center">
          <p className="text-sm font-semibold text-blue-800 mb-3">Schedule C — Net Loss</p>
          <p className="text-xs text-blue-700 leading-relaxed">
            These deductions reduce your Efuture net income (or increase your loss), which flows directly to your personal Form 1040 and offsets your W2 income.
          </p>
        </div>
      </div>

      {deductible.length === 0 ? (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-12 text-center">
          <p className="text-slate-400 font-medium text-lg">No deductible transactions for {selectedYear}</p>
          <p className="text-slate-400 text-sm mt-1">Mark expenses as Tax Deductible while categorizing to see them here.</p>
        </div>
      ) : (
        <>
          {/* By category */}
          <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">By Category</h2>
            <div className="space-y-3">
              {byCategory.map(([cat, txs]) => {
                const total = txs.reduce((s, t) => s + t.amount, 0);
                const pct = totalDeductible > 0 ? (total / totalDeductible) * 100 : 0;
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-slate-800">{cat}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-500">{txs.length} transaction{txs.length !== 1 ? 's' : ''}</span>
                        <span className="font-bold text-slate-900 w-24 text-right">${total.toFixed(2)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-1.5">
                      <div
                        className="bg-green-500 h-1.5 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-3 border-t-2 border-slate-200">
                <span className="font-bold text-slate-900">Total</span>
                <span className="font-bold text-green-700 text-lg">${totalDeductible.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Transaction list */}
          <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h2 className="text-xl font-bold text-slate-900">All Deductible Transactions</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {sorted.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-400 w-24 shrink-0">{tx.date}</span>
                    <span className="font-medium text-slate-900">{tx.merchant}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{tx.category}</span>
                    <span className="font-bold text-slate-900 w-20 text-right">${tx.amount.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}