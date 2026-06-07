import { getTransactions } from '@/lib/googleSheets';
import Link from 'next/link';

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

export default async function MerchantBreakdownPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const merchant = decodeURIComponent(name);

  const all = await getTransactions();
  const txs = all.filter((t) => t.merchant === merchant && t.type === 'expense');

  type MonthData = Record<string, number>;
  type YearData = { months: Record<string, MonthData>; yearTotal: number; byCard: Record<string, number> };

  const yearData: Record<string, YearData> = {};

  for (const tx of txs) {
    yearData[tx.year] ??= { months: {}, yearTotal: 0, byCard: {} };
    yearData[tx.year].months[tx.month] ??= {};
    yearData[tx.year].months[tx.month][tx.card] =
      (yearData[tx.year].months[tx.month][tx.card] || 0) + tx.amount;
    yearData[tx.year].yearTotal += tx.amount;
    yearData[tx.year].byCard[tx.card] =
      (yearData[tx.year].byCard[tx.card] || 0) + tx.amount;
  }

  const sortedYears = Object.keys(yearData).sort((a, b) => Number(b) - Number(a));

  if (txs.length === 0) {
    return (
      <div className="space-y-6">
        <Link
          href={`/merchants/${encodeURIComponent(merchant)}`}
          className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition"
        >
          ← {merchant}
        </Link>
        <p className="text-slate-500">No expense transactions found for this merchant.</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <div className="flex items-center gap-4">
        <Link
          href={`/merchants/${encodeURIComponent(merchant)}`}
          className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition"
        >
          ← {merchant}
        </Link>
      </div>

      <div>
        <h1 className="text-4xl font-bold text-slate-900">{merchant}</h1>
        <p className="text-slate-500 mt-1">Monthly &amp; Annual Breakdown</p>
      </div>

      {sortedYears.map((year) => {
        const yd = yearData[year];
        const presentKeys = MONTH_KEYS.filter((mk) => yd.months[mk]);
        const yearCards = [
          ...new Set(presentKeys.flatMap((mk) => Object.keys(yd.months[mk]))),
        ].sort((a, b) => (yd.byCard[b] || 0) - (yd.byCard[a] || 0));

        return (
          <div key={year} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-slate-800">{year}</h2>
              <span className="text-2xl font-bold text-slate-900">
                ${yd.yearTotal.toFixed(2)}
              </span>
            </div>

            {yearCards.length > 1 && (
              <div className="flex flex-wrap gap-3 mb-1">
                {yearCards.map((card) => (
                  <span
                    key={card}
                    className="inline-flex items-center gap-1.5 bg-slate-100 text-slate-700 rounded-full px-3 py-1 text-sm font-medium"
                  >
                    {CARD_LABELS[card] ?? card}
                    <span className="font-bold text-slate-900">${(yd.byCard[card] || 0).toFixed(2)}</span>
                  </span>
                ))}
              </div>
            )}

            <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
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
                  {presentKeys.map((mk) => {
                    const md = yd.months[mk];
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
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="px-5 py-3 font-bold text-slate-800">Year Total</td>
                    {yearCards.map((card) => (
                      <td key={card} className="px-5 py-3 text-right font-bold text-slate-800">
                        ${(yd.byCard[card] || 0).toFixed(2)}
                      </td>
                    ))}
                    <td className="px-5 py-3 text-right font-bold text-slate-900 text-base">
                      ${yd.yearTotal.toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}