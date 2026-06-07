import { getIncome } from '@/lib/googleSheets';
import Link from 'next/link';

const MONTH_KEYS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTH_LABEL: Record<string, string> = {
  '01': 'January',  '02': 'February', '03': 'March',    '04': 'April',
  '05': 'May',      '06': 'June',     '07': 'July',     '08': 'August',
  '09': 'September','10': 'October',  '11': 'November', '12': 'December',
};

export default async function CreditsDetailPage() {
  const allIncome = await getIncome();
  const entries = allIncome
    .filter((e) => e.source === 'Credit')
    .sort((a, b) => b.date.localeCompare(a.date));

  const total = entries.reduce((s, e) => s + e.amount, 0);
  const avg = entries.length > 0 ? total / entries.length : 0;

  const yearData: Record<string, Record<string, number>> = {};
  for (const e of entries) {
    yearData[e.year] ??= {};
    yearData[e.year][e.month] = (yearData[e.year][e.month] ?? 0) + e.amount;
  }
  const sortedYears = Object.keys(yearData).sort((a, b) => Number(b) - Number(a));

  const yearTotals = sortedYears.map((yr) => ({
    year: yr,
    total: Object.values(yearData[yr]).reduce((s, v) => s + v, 0),
  }));

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <Link href="/income" className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition">
          ← Income
        </Link>
      </div>

      <div>
        <h1 className="text-4xl font-bold text-slate-900">Credits & Refunds</h1>
        <p className="text-slate-500 mt-1">{entries.length} entr{entries.length !== 1 ? 'ies' : 'y'} all time</p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-700 mb-1">Total Received</p>
          <p className="text-4xl font-bold text-green-900">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-6 border-2 border-emerald-200 shadow">
          <p className="text-sm font-semibold text-emerald-700 mb-1">Entries</p>
          <p className="text-4xl font-bold text-emerald-900">{entries.length}</p>
        </div>
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-6 border-2 border-slate-200 shadow">
          <p className="text-sm font-semibold text-slate-600 mb-1">Avg per Entry</p>
          <p className="text-4xl font-bold text-slate-900">${avg.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {yearTotals.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-700 mb-3">Annual Totals</h2>
          <div className="flex flex-wrap gap-4">
            {yearTotals.map(({ year, total: yt }) => (
              <div key={year} className="bg-white rounded-xl border-2 border-green-100 px-6 py-4 shadow-sm min-w-[140px]">
                <p className="text-sm font-semibold text-slate-500">{year}</p>
                <p className="text-2xl font-bold text-green-900">${yt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {sortedYears.map((year) => {
        const months = MONTH_KEYS.filter((mk) => yearData[year]?.[mk]);
        const yearTotal = months.reduce((s, mk) => s + (yearData[year][mk] ?? 0), 0);
        return (
          <div key={year} className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h2 className="text-lg font-bold text-slate-800">{year} Monthly Breakdown</h2>
              <span className="text-lg font-bold text-slate-900">${yearTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Month</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Entries</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-900">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {months.map((mk) => {
                  const monthEntries = entries.filter((e) => e.year === year && e.month === mk);
                  return (
                    <tr key={mk} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 font-medium text-slate-700">{MONTH_LABEL[mk]}</td>
                      <td className="px-5 py-3 text-right text-slate-500">{monthEntries.length}</td>
                      <td className="px-5 py-3 text-right font-bold text-green-900">
                        ${(yearData[year][mk] ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="px-5 py-3 font-bold text-slate-800">Total</td>
                  <td className="px-5 py-3 text-right text-slate-500">
                    {months.reduce((s, mk) => s + entries.filter((e) => e.year === year && e.month === mk).length, 0)}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900">
                    ${yearTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}

      {entries.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-green-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
            <h2 className="text-lg font-bold text-slate-800">All Entries</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors">
                <div>
                  <span className="text-slate-500 text-sm">{e.date}</span>
                  {e.description && <span className="text-slate-600 text-sm ml-3">{e.description}</span>}
                </div>
                <span className="font-bold text-green-900">${e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {entries.length === 0 && (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-12 text-center">
          <p className="text-slate-400 font-medium text-lg">No credits or refunds data found.</p>
        </div>
      )}
    </div>
  );
}
