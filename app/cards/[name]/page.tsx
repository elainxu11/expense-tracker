import { getTransactions } from '@/lib/googleSheets';
import Link from 'next/link';
import MerchantTransactionList from '@/app/_components/MerchantTransactionList';
import MerchantSpendingChart from '@/app/_components/MerchantSpendingChart';
import CategoryPieChart from '@/app/_components/CategoryPieChart';
import type { ChartDatum } from '@/app/_components/MerchantSpendingChart';

export const CARD_LABELS: Record<string, string> = {
  amex: 'American Express',
  'capital-one': 'Capital One Venture X',
  discover: 'Discover',
  venmo: 'Venmo',
  'wells-fargo': 'Wells Fargo Autograph',
  bofa: 'Bank of America',
  other: 'Other',
};

const MONTH_KEYS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTH_LABEL: Record<string, string> = {
  '01': 'January',  '02': 'February', '03': 'March',    '04': 'April',
  '05': 'May',      '06': 'June',     '07': 'July',     '08': 'August',
  '09': 'September','10': 'October',  '11': 'November', '12': 'December',
};

export default async function CardPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const card = decodeURIComponent(name);

  const all = await getTransactions();
  const txs = all
    .filter((t) => t.card === card)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const expenses = txs.filter((t) => t.type === 'expense');
  const credits = txs.filter((t) => t.type === 'credit');
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const totalCredits = credits.reduce((s, t) => s + t.amount, 0);
  const cardLabel = CARD_LABELS[card] ?? card;

  // Category totals (expenses only)
  const categoryTotals: Record<string, number> = {};
  for (const tx of expenses) {
    categoryTotals[tx.category] = (categoryTotals[tx.category] || 0) + tx.amount;
  }
  const sortedCategories = Object.keys(categoryTotals).sort(
    (a, b) => categoryTotals[b] - categoryTotals[a]
  );
  const pieData = sortedCategories.map((cat) => ({
    name: cat,
    value: categoryTotals[cat],
  }));

  // Monthly data by year, broken down by category
  const yearData: Record<string, Record<string, Record<string, number>>> = {};
  for (const tx of expenses) {
    yearData[tx.year] ??= {};
    yearData[tx.year][tx.month] ??= {};
    yearData[tx.year][tx.month][tx.category] =
      (yearData[tx.year][tx.month][tx.category] || 0) + tx.amount;
  }

  const sortedYears = Object.keys(yearData).sort((a, b) => Number(b) - Number(a));

  const yearTotals = sortedYears.map((yr) => ({
    year: yr,
    total: Object.values(yearData[yr])
      .flatMap((m) => Object.values(m))
      .reduce((s: number, v: number) => s + v, 0),
  }));

  // Monthly chart data (categories as bar keys)
  const chartData: ChartDatum[] = [];
  for (const yr of [...sortedYears].reverse()) {
    for (const mo of MONTH_KEYS) {
      if (!yearData[yr]?.[mo]) continue;
      const datum: ChartDatum = { label: `${MONTH_LABEL[mo].slice(0, 3)} ${yr}` };
      for (const cat of sortedCategories) {
        datum[cat] = yearData[yr][mo][cat] || 0;
      }
      chartData.push(datum);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition">
          ← Dashboard
        </Link>
        {totalCredits > 0 && (
          <Link
            href={`/cards/${encodeURIComponent(card)}/credits`}
            className="text-blue-500 hover:text-blue-700 font-semibold text-sm transition"
          >
            View credits →
          </Link>
        )}
      </div>

      <div>
        <h1 className="text-4xl font-bold text-slate-900">{cardLabel}</h1>
        <p className="text-slate-500 mt-1">
          {txs.length} transaction{txs.length !== 1 ? 's' : ''}
          {expenses.length > 0 && credits.length > 0 && ` · ${expenses.length} expenses · ${credits.length} credits`}
        </p>
      </div>

      {/* Summary widgets */}
      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200 shadow">
          <p className="text-sm font-semibold text-blue-900 mb-2">Total Spent</p>
          <p className="text-4xl font-bold text-blue-900">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-900 mb-2">Total Credits</p>
          <p className="text-4xl font-bold text-green-900">+${totalCredits.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200 shadow">
          <p className="text-sm font-semibold text-purple-900 mb-2">Net</p>
          <p className="text-4xl font-bold text-purple-900">
            ${(totalSpent - totalCredits).toFixed(2)}
          </p>
        </div>
      </div>

      {/* Annual totals */}
      {yearTotals.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-700 mb-3">Annual Totals</h2>
          <div className="flex flex-wrap gap-4">
            {yearTotals.map(({ year, total }) => (
              <div
                key={year}
                className="bg-white rounded-xl border-2 border-slate-200 px-6 py-4 shadow-sm min-w-[140px]"
              >
                <p className="text-sm font-semibold text-slate-500">{year}</p>
                <p className="text-2xl font-bold text-slate-900">${total.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category breakdown + monthly chart side by side */}
      {(pieData.length > 0 || chartData.length > 0) && (
        <div className="grid grid-cols-2 gap-6">
          {pieData.length > 0 && <CategoryPieChart data={pieData} />}
          {chartData.length > 0 && (
            <MerchantSpendingChart data={chartData} cards={sortedCategories} />
          )}
        </div>
      )}

      {/* Monthly breakdown tables, one per year */}
      {sortedYears.map((year) => {
        const months = MONTH_KEYS.filter((mk) => yearData[year]?.[mk]);
        const yearCats = [
          ...new Set(months.flatMap((mk) => Object.keys(yearData[year][mk]))),
        ].sort((a, b) => {
          const totA = months.reduce((s, mk) => s + (yearData[year][mk][a] || 0), 0);
          const totB = months.reduce((s, mk) => s + (yearData[year][mk][b] || 0), 0);
          return totB - totA;
        });
        const yearTotal = months
          .flatMap((mk) => Object.values(yearData[year][mk]))
          .reduce((s: number, v: number) => s + v, 0);

        return (
          <div
            key={year}
            className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden"
          >
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{year} Monthly Breakdown</h2>
              <span className="text-lg font-bold text-slate-900">${yearTotal.toFixed(2)}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left px-5 py-3 font-semibold text-slate-600 whitespace-nowrap">Month</th>
                    {yearCats.map((cat) => (
                      <th key={cat} className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                        {cat}
                      </th>
                    ))}
                    <th className="text-right px-5 py-3 font-semibold text-slate-900 whitespace-nowrap">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {months.map((mk) => {
                    const md = yearData[year][mk];
                    const monthTotal = Object.values(md).reduce((s: number, v: number) => s + v, 0);
                    return (
                      <tr key={mk} className="hover:bg-slate-50 transition-colors">
                        <td className="px-5 py-3 font-medium text-slate-700 whitespace-nowrap">{MONTH_LABEL[mk]}</td>
                        {yearCats.map((cat) => (
                          <td key={cat} className="px-4 py-3 text-right text-slate-600 whitespace-nowrap">
                            {md[cat] ? `$${md[cat].toFixed(2)}` : '—'}
                          </td>
                        ))}
                        <td className="px-5 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                          ${monthTotal.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-slate-200 bg-slate-50">
                    <td className="px-5 py-3 font-bold text-slate-800">Total</td>
                    {yearCats.map((cat) => {
                      const catYearTotal = months.reduce(
                        (s, mk) => s + (yearData[year][mk][cat] || 0),
                        0
                      );
                      return (
                        <td key={cat} className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                          ${catYearTotal.toFixed(2)}
                        </td>
                      );
                    })}
                    <td className="px-5 py-3 text-right font-bold text-slate-900 whitespace-nowrap">
                      ${yearTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}

      {/* All transactions */}
      {txs.length > 0 ? (
        <MerchantTransactionList transactions={txs} />
      ) : (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-8 text-center">
          <p className="text-slate-400 font-medium">No transactions found for this card</p>
        </div>
      )}
    </div>
  );
}
