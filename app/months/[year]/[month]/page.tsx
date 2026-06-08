import { getTransactions, getIncome, getVendorRules, getBudget } from '@/lib/googleSheets';
import { applyVendorRules } from '@/lib/vendorRules';
import Link from 'next/link';
import VendorList from '@/app/_components/VendorList';
import MerchantTransactionList from '@/app/_components/MerchantTransactionList';

const MONTH_LABEL: Record<string, string> = {
  '01': 'January',  '02': 'February', '03': 'March',    '04': 'April',
  '05': 'May',      '06': 'June',     '07': 'July',     '08': 'August',
  '09': 'September','10': 'October',  '11': 'November', '12': 'December',
};

export default async function MonthPage({
  params,
}: {
  params: Promise<{ year: string; month: string }>;
}) {
  const { year, month } = await params;
  const monthLabel = MONTH_LABEL[month] ?? month;

  const [allTransactions, allIncome, vendorRules, budget] = await Promise.all([
    getTransactions(),
    getIncome(),
    getVendorRules(),
    getBudget(),
  ]);

  const txs = allTransactions
    .filter((t) => t.year === year && t.month === month)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const expenses = txs.filter((t) => t.type === 'expense');
  const credits = txs.filter((t) => t.type === 'credit');
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const totalCredits = credits.reduce((s, t) => s + t.amount, 0);

  const monthIncome = allIncome
    .filter((e) => e.year === year && e.month === month && e.source !== 'Credit')
    .reduce((s, e) => s + e.amount, 0);
  const net = monthIncome - totalSpent;

  // Category breakdown (net: subtract credits that offset a category)
  const byCategory: Record<string, number> = {};
  for (const tx of expenses) {
    byCategory[tx.category] = (byCategory[tx.category] || 0) + tx.amount;
  }
  for (const tx of credits) {
    if (tx.refundCategory) {
      byCategory[tx.refundCategory] = (byCategory[tx.refundCategory] || 0) - tx.amount;
    }
  }
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  // Vendor breakdown (normalized via vendor rules, same as dashboard)
  const byVendor: Record<string, number> = {};
  for (const tx of expenses) {
    const name = applyVendorRules(tx.merchant, vendorRules);
    byVendor[name] = (byVendor[name] || 0) + tx.amount;
  }
  const sortedVendors = Object.entries(byVendor)
    .sort((a, b) => b[1] - a[1])
    .map(([name, total]) => ({ name, total }));

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition">
          ← Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-4xl font-bold text-slate-900">{monthLabel} {year}</h1>
        <p className="text-slate-500 mt-1">
          {txs.length} transaction{txs.length !== 1 ? 's' : ''}
          {expenses.length > 0 && credits.length > 0 && ` · ${expenses.length} expenses · ${credits.length} credits`}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200 shadow">
          <p className="text-sm font-semibold text-blue-900 mb-2">Total Spent</p>
          <p className="text-4xl font-bold text-blue-900">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-900 mb-2">Income</p>
          <p className="text-4xl font-bold text-green-900">
            {monthIncome > 0 ? `$${monthIncome.toFixed(2)}` : '—'}
          </p>
        </div>
        <div className={`rounded-lg p-6 border-2 shadow ${
          monthIncome === 0
            ? 'bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200'
            : net >= 0
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
            : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
        }`}>
          <p className={`text-sm font-semibold mb-2 ${
            monthIncome === 0 ? 'text-purple-900' : net >= 0 ? 'text-emerald-900' : 'text-red-900'
          }`}>
            {monthIncome === 0 ? 'Credits' : 'Net Remaining'}
          </p>
          <p className={`text-4xl font-bold ${
            monthIncome === 0 ? 'text-purple-900' : net >= 0 ? 'text-emerald-900' : 'text-red-900'
          }`}>
            {monthIncome === 0
              ? `+$${totalCredits.toFixed(2)}`
              : `${net >= 0 ? '+' : ''}$${net.toFixed(2)}`}
          </p>
        </div>
      </div>

      {(sortedCategories.length > 0 || sortedVendors.length > 0) && (
        <div className="grid grid-cols-2 gap-6 items-start">
          {sortedCategories.length > 0 && (
            <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900 mb-4">By Category</h2>
              <div className="space-y-3">
                {sortedCategories.map(([cat, total]) => (
                  <div key={cat} className="flex items-center justify-between">
                    <Link
                      href={`/categories/${encodeURIComponent(cat)}?year=${year}&month=${month}`}
                      className="text-slate-700 font-medium hover:text-blue-600 hover:underline transition"
                    >
                      {cat}
                    </Link>
                    <span className={`font-bold ${budget[cat] != null && budget[cat] > 0 && total > budget[cat] ? 'text-red-600' : 'text-slate-900'}`}>
                      ${total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {sortedVendors.length > 0 && (
            <VendorList vendors={sortedVendors} />
          )}
        </div>
      )}

      {txs.length > 0 ? (
        <MerchantTransactionList transactions={txs} />
      ) : (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-8 text-center">
          <p className="text-slate-400 font-medium">No transactions for this month</p>
        </div>
      )}
    </div>
  );
}
