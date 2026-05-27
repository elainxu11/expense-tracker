import Link from 'next/link';
import { getTransactions } from '@/lib/googleSheets';
import { Transaction } from '@/lib/types';
import MonthYearPicker from './_components/MonthYearPicker';
import CategoryPieChart from './_components/CategoryPieChart';

function sumExpenses(txs: Transaction[]) {
  return txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
}

function groupByCategory(txs: Transaction[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const tx of txs.filter((t) => t.type === 'expense')) {
    grouped[tx.category] = (grouped[tx.category] || 0) + tx.amount;
  }
  return grouped;
}

function groupByMerchant(txs: Transaction[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const tx of txs.filter((t) => t.type === 'expense')) {
    grouped[tx.merchant] = (grouped[tx.merchant] || 0) + tx.amount;
  }
  return grouped;
}

interface CardSummary {
  card: string;
  total: number;
  topCategories: [string, number][];
}

function groupByCard(txs: Transaction[]): CardSummary[] {
  const cardTotals: Record<string, number> = {};
  const cardCategories: Record<string, Record<string, number>> = {};
  for (const tx of txs.filter((t) => t.type === 'expense')) {
    cardTotals[tx.card] = (cardTotals[tx.card] || 0) + tx.amount;
    if (!cardCategories[tx.card]) cardCategories[tx.card] = {};
    cardCategories[tx.card][tx.category] = (cardCategories[tx.card][tx.category] || 0) + tx.amount;
  }
  return Object.entries(cardTotals)
    .sort((a, b) => b[1] - a[1])
    .map(([card, total]) => ({
      card,
      total,
      topCategories: Object.entries(cardCategories[card]).sort((a, b) => b[1] - a[1]).slice(0, 3),
    }));
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; ytd?: string }>;
}) {
  const transactions = await getTransactions();
  const { month, year, ytd } = await searchParams;

  const now = new Date();
  const isYTD = ytd === 'true';
  const selectedMonth = month ?? String(now.getMonth() + 1).padStart(2, '0');
  const selectedYear = year ?? String(now.getFullYear());

  const availableYears = [...new Set(transactions.map((t) => t.year))].sort().reverse();
  if (!availableYears.includes(selectedYear)) availableYears.unshift(selectedYear);

  const filtered = isYTD
    ? transactions.filter((t) => t.year === selectedYear)
    : transactions.filter((t) => t.month === selectedMonth && t.year === selectedYear);

  const totalSpent = sumExpenses(filtered);
  const totalCredits = filtered
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  const byCategory = groupByCategory(filtered);
  const sortedCategories = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  const byMerchant = groupByMerchant(filtered);
  const sortedMerchants = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]);

  const cardSummaries = groupByCard(filtered);

  const recentTxs = [...filtered]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const periodLabel = isYTD ? `${selectedYear} Year to Date` : 'This Month';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-slate-900">Dashboard</h1>
        <MonthYearPicker
          selectedMonth={selectedMonth}
          selectedYear={selectedYear}
          availableYears={availableYears}
          isYTD={isYTD}
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200 shadow">
          <p className="text-sm font-semibold text-blue-900 mb-2">Spent {periodLabel}</p>
          <p className="text-4xl font-bold text-blue-900">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-900 mb-2">Credits {periodLabel}</p>
          <p className="text-4xl font-bold text-green-900">+${totalCredits.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200 shadow">
          <p className="text-sm font-semibold text-purple-900 mb-2">Transactions</p>
          <p className="text-4xl font-bold text-purple-900">{filtered.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <CategoryPieChart
          data={sortedCategories.map(([name, value]) => ({ name, value }))}
        />

        {sortedCategories.length > 0 ? (
          <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">By Category</h2>
            <div className="space-y-3">
              {sortedCategories.map(([cat, total]) => (
                <div key={cat} className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">{cat}</span>
                  <span className="font-bold text-slate-900">${total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm flex items-center justify-center">
            <p className="text-slate-400 font-medium">No transactions for this period</p>
          </div>
        )}

        {sortedMerchants.length > 0 ? (
          <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">By Vendor</h2>
            <div className="space-y-3">
              {sortedMerchants.map(([merchant, total]) => (
                <div key={merchant} className="flex items-center justify-between">
                  <Link
                    href={`/merchants/${encodeURIComponent(merchant)}`}
                    className="text-slate-700 font-medium hover:text-blue-600 hover:underline transition truncate"
                  >
                    {merchant}
                  </Link>
                  <span className="font-bold text-slate-900 ml-4 shrink-0">${total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {cardSummaries.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">By Credit Card</h2>
            <div className="space-y-5">
              {cardSummaries.map(({ card, total, topCategories }) => (
                <div key={card}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-900">{card}</span>
                    <span className="font-bold text-slate-900">${total.toFixed(2)}</span>
                  </div>
                  <div className="space-y-1 pl-3 border-l-2 border-slate-100">
                    {topCategories.map(([cat, amount]) => (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <span className="text-slate-500">{cat}</span>
                        <span className="text-slate-700 font-medium">${amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {recentTxs.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Recent Transactions</h2>
            <div className="space-y-3">
              {recentTxs.map((tx) => (
                <div key={tx.id} className="flex items-center justify-between">
                  <div>
                    <Link
                      href={`/merchants/${encodeURIComponent(tx.merchant)}`}
                      className="font-semibold text-slate-900 hover:text-blue-600 hover:underline transition"
                    >
                      {tx.merchant}
                    </Link>
                    <p className="text-sm text-slate-500">{tx.date} · {tx.category}</p>
                  </div>
                  <span className={`font-bold ${tx.type === 'credit' ? 'text-green-600' : 'text-slate-900'}`}>
                    {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
