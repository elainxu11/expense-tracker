import Link from 'next/link';
import { getTransactions, getVendorRules, getBudget, getIncome } from '@/lib/googleSheets';
import { Transaction, VendorRule } from '@/lib/types';
import { applyVendorRules } from '@/lib/vendorRules';
import MonthYearPicker from './_components/MonthYearPicker';
import CategoryPieChart from './_components/CategoryPieChart';
import RecentTransactions from './_components/RecentTransactions';
import VendorList from './_components/VendorList';
import MonthlyBreakdown from './_components/MonthlyBreakdown';

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

function groupByMerchant(txs: Transaction[], rules: VendorRule[]): Record<string, number> {
  const grouped: Record<string, number> = {};
  for (const tx of txs.filter((t) => t.type === 'expense')) {
    const name = applyVendorRules(tx.merchant, rules);
    grouped[name] = (grouped[name] || 0) + tx.amount;
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

function creditsByCard(txs: Transaction[]): { card: string; total: number }[] {
  const totals: Record<string, number> = {};
  for (const tx of txs.filter((t) => t.type === 'credit')) {
    totals[tx.card] = (totals[tx.card] || 0) + tx.amount;
  }
  return Object.entries(totals).sort((a, b) => b[1] - a[1]).map(([card, total]) => ({ card, total }));
}

function txCountByCard(txs: Transaction[]): { card: string; count: number }[] {
  const counts: Record<string, number> = {};
  for (const tx of txs) {
    counts[tx.card] = (counts[tx.card] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([card, count]) => ({ card, count }));
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; ytd?: string }>;
}) {
  const [transactions, vendorRules, budget, allIncome] = await Promise.all([
    getTransactions(),
    getVendorRules(),
    getBudget(),
    getIncome(),
  ]);
  const { month, year, ytd } = await searchParams;

  const now = new Date();
  const isYTD = ytd !== 'false';
  const selectedMonth = month ?? String(now.getMonth() + 1).padStart(2, '0');
  const selectedYear = year ?? String(now.getFullYear());

  // income keyed by month "01".."12" for the selected year
  const incomeByMonth: Record<string, number> = {};
  for (const e of allIncome.filter((e) => e.year === selectedYear && e.source !== 'Credit')) {
    incomeByMonth[e.month] = (incomeByMonth[e.month] || 0) + e.amount;
  }

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

  const byMerchant = groupByMerchant(filtered, vendorRules);
  const sortedMerchants = Object.entries(byMerchant).sort((a, b) => b[1] - a[1]);

  const cardSummaries = groupByCard(filtered);
  const cardCredits = creditsByCard(filtered);
  const cardTxCounts = txCountByCard(filtered);

  const recentTxs = [...filtered]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

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
          <p className="text-4xl font-bold text-blue-900 mb-4">${totalSpent.toFixed(2)}</p>
          {cardSummaries.length > 0 && (
            <div className="space-y-1.5 border-t border-blue-200 pt-3">
              {cardSummaries.map(({ card, total }) => (
                <Link
                  key={card}
                  href={`/cards/${encodeURIComponent(card)}`}
                  className="flex items-center justify-between text-sm hover:bg-blue-200/50 rounded px-1 -mx-1 transition"
                >
                  <span className="text-blue-800 truncate">{card}</span>
                  <span className="font-semibold text-blue-900 ml-2 shrink-0">${total.toFixed(2)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-900 mb-2">Credits {periodLabel}</p>
          <p className="text-4xl font-bold text-green-900 mb-4">+${totalCredits.toFixed(2)}</p>
          {cardCredits.length > 0 && (
            <div className="space-y-1.5 border-t border-green-200 pt-3">
              {cardCredits.map(({ card, total }) => (
                <Link
                  key={card}
                  href={`/cards/${encodeURIComponent(card)}/credits`}
                  className="flex items-center justify-between text-sm hover:bg-green-200/50 rounded px-1 -mx-1 transition"
                >
                  <span className="text-green-800 truncate">{card}</span>
                  <span className="font-semibold text-green-900 ml-2 shrink-0">+${total.toFixed(2)}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200 shadow">
          <p className="text-sm font-semibold text-purple-900 mb-2">Transactions</p>
          <p className="text-4xl font-bold text-purple-900 mb-4">{filtered.length}</p>
          {cardTxCounts.length > 0 && (
            <div className="space-y-1.5 border-t border-purple-200 pt-3">
              {cardTxCounts.map(({ card, count }) => (
                <Link
                  key={card}
                  href={`/cards/${encodeURIComponent(card)}`}
                  className="flex items-center justify-between text-sm hover:bg-purple-200/50 rounded px-1 -mx-1 transition"
                >
                  <span className="text-purple-800 truncate">{card}</span>
                  <span className="font-semibold text-purple-900 ml-2 shrink-0">{count}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pie chart + By Category side by side */}
      <div className="grid grid-cols-2 gap-6 items-start">
        <CategoryPieChart
          data={sortedCategories.map(([name, value]) => ({ name, value }))}
        />
        {sortedCategories.length > 0 ? (
          <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">By Category</h2>
            <div className="space-y-3">
              {sortedCategories.map(([cat, total]) => (
                <div key={cat} className="flex items-center justify-between">
                  <Link
                    href={`/categories/${encodeURIComponent(cat)}`}
                    className="text-slate-700 font-medium hover:text-blue-600 hover:underline transition"
                  >
                    {cat}
                  </Link>
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
      </div>

      {/* Monthly breakdown — full width, right under pie chart */}
      <MonthlyBreakdown
        transactions={transactions}
        initialBudget={budget}
        year={selectedYear}
        incomeByMonth={incomeByMonth}
      />

      {/* Vendor list, recent transactions, by card */}
      <div className="grid grid-cols-2 gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {sortedMerchants.length > 0 && (
            <VendorList vendors={sortedMerchants.map(([name, total]) => ({ name, total }))} />
          )}
          {recentTxs.length > 0 && (
            <RecentTransactions transactions={recentTxs} />
          )}
        </div>

        {cardSummaries.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">By Credit Card</h2>
            <div className="space-y-5">
              {cardSummaries.map(({ card, total, topCategories }) => (
                <div key={card}>
                  <div className="flex items-center justify-between mb-1.5">
                    <Link
                      href={`/cards/${encodeURIComponent(card)}`}
                      className="font-semibold text-slate-900 hover:text-blue-600 hover:underline transition"
                    >
                      {card}
                    </Link>
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
      </div>
    </div>
  );
}
