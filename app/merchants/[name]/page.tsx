import { getTransactions, getVendorRules } from '@/lib/googleSheets';
import { applyVendorRules } from '@/lib/vendorRules';
import Link from 'next/link';
import MerchantTransactionList from '@/app/_components/MerchantTransactionList';
import MerchantSpendingChart from '@/app/_components/MerchantSpendingChart';
import type { ChartDatum } from '@/app/_components/MerchantSpendingChart';

const CARD_LABELS: Record<string, string> = {
  amex: 'American Express',
  'capital-one': 'Capital One Venture X',
  discover: 'Discover',
  venmo: 'Venmo',
  'wells-fargo': 'Wells Fargo Autograph',
  bofa: 'Bank of America',
  other: 'Other',
};

// tx.month is stored as "01"–"12"
const MONTH_KEYS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTH_LABEL: Record<string, string> = {
  '01': 'January',  '02': 'February', '03': 'March',    '04': 'April',
  '05': 'May',      '06': 'June',     '07': 'July',     '08': 'August',
  '09': 'September','10': 'October',  '11': 'November', '12': 'December',
};

export default async function MerchantPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const merchant = decodeURIComponent(name);

  const [all, vendorRules] = await Promise.all([
    getTransactions(),
    getVendorRules(),
  ]);
  const txs = all
    .filter((t) => applyVendorRules(t.merchant, vendorRules) === merchant)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const expenses = txs.filter((t) => t.type === 'expense');
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const totalCredits = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);

  // yearData[year][monthKey]["01"-"12"][card] = total
  const yearData: Record<string, Record<string, Record<string, number>>> = {};
  for (const tx of expenses) {
    yearData[tx.year] ??= {};
    yearData[tx.year][tx.month] ??= {};
    yearData[tx.year][tx.month][tx.card] =
      (yearData[tx.year][tx.month][tx.card] || 0) + tx.amount;
  }

  const sortedYears = Object.keys(yearData).sort((a, b) => Number(b) - Number(a));

  // Per-year totals for widgets
  const yearTotals = sortedYears.map((yr) => ({
    year: yr,
    total: Object.values(yearData[yr])
      .flatMap((m) => Object.values(m))
      .reduce((s: number, v: number) => s + v, 0),
  }));

  // All-time card totals (determines sort order)
  const cardTotals: Record<string, number> = {};
  for (const tx of expenses) {
    cardTotals[tx.card] = (cardTotals[tx.card] || 0) + tx.amount;
  }
  const sortedCards = Object.keys(cardTotals).sort(
    (a, b) => (cardTotals[b] || 0) - (cardTotals[a] || 0)
  );

  // Chart: all month-years in chronological order
  const chartData: ChartDatum[] = [];
  for (const yr of [...sortedYears].reverse()) {
    for (const mo of MONTH_KEYS) {
      if (!yearData[yr]?.[mo]) continue;
      const datum: ChartDatum = { label: `${MONTH_LABEL[mo].slice(0, 3)} ${yr}` };
      for (const card of sortedCards) {
        datum[card] = yearData[yr][mo][card] || 0;
      }
      chartData.push(datum);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link
          href="/"
          className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition"
        >
          ← Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-4xl font-bold text-slate-900">{merchant}</h1>
        <p className="text-slate-500 mt-1">
          {txs.length} transaction{txs.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Summary cards */}
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

      {/* Annual total widgets */}
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

      {/* Monthly spending bar chart */}
      {chartData.length > 0 && (
        <MerchantSpendingChart data={chartData} cards={sortedCards} />
      )}

      {/* Monthly breakdown table, one per year */}
      {sortedYears.map((year) => {
        const months = MONTH_KEYS.filter((mk) => yearData[year]?.[mk]);
        const yearCards = [
          ...new Set(months.flatMap((mk) => Object.keys(yearData[year][mk]))),
        ];
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Month</th>
                  {yearCards.map((card) => (
                    <th key={card} className="text-right px-5 py-3 font-semibold text-slate-600">
                      {CARD_LABELS[card] ?? card}
                    </th>
                  ))}
                  <th className="text-right px-5 py-3 font-semibold text-slate-900">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {months.map((mk) => {
                  const md = yearData[year][mk];
                  const monthTotal = Object.values(md).reduce((s: number, v: number) => s + v, 0);
                  return (
                    <tr key={mk} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700">{MONTH_LABEL[mk]}</td>
                      {yearCards.map((card) => (
                        <td key={card} className="px-5 py-3 text-right text-slate-600">
                          {md[card] ? `$${md[card].toFixed(2)}` : '—'}
                        </td>
                      ))}
                      <td className="px-5 py-3 text-right font-bold text-slate-900">
                        ${monthTotal.toFixed(2)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-800">Total</td>
                  {yearCards.map((card) => {
                    const cardYearTotal = months.reduce(
                      (s: number, mk: string) => s + (yearData[year][mk][card] || 0),
                      0
                    );
                    return (
                      <td key={card} className="px-5 py-3 text-right font-bold text-slate-800">
                        ${cardYearTotal.toFixed(2)}
                      </td>
                    );
                  })}
                  <td className="px-5 py-3 text-right font-bold text-slate-900">
                    ${yearTotal.toFixed(2)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}

      {/* Collapsible transaction list */}
      <MerchantTransactionList transactions={txs} />
    </div>
  );
}