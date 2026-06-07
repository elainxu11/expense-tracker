import { getIncome } from '@/lib/googleSheets';
import { IncomeEntry } from '@/lib/types';
import YearPicker from '@/app/_components/YearPicker';
import Link from 'next/link';

function groupByMonth(entries: IncomeEntry[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const e of entries) {
    const key = `${e.year}-${e.month}`;
    result[key] = (result[key] ?? 0) + e.amount;
  }
  return result;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const allIncome = await getIncome();
  const { year } = await searchParams;

  const now = new Date();
  const availableYears = [...new Set(allIncome.map((e) => e.year))].sort().reverse();
  if (!availableYears.includes(String(now.getFullYear()))) availableYears.unshift(String(now.getFullYear()));
  const selectedYear = year ?? availableYears[0] ?? String(now.getFullYear());

  const yearIncome = allIncome.filter((e) => e.year === selectedYear);
  const w2 = yearIncome.filter((e) => e.source === 'W2');
  const efuture = yearIncome.filter((e) => e.source === 'Efuture');
  const credits = yearIncome.filter((e) => e.source === 'Credit');

  const totalW2 = w2.reduce((s, e) => s + e.amount, 0);
  const totalEfuture = efuture.reduce((s, e) => s + e.amount, 0);
  const totalCredits = credits.reduce((s, e) => s + e.amount, 0);
  const totalIncome = totalW2 + totalEfuture + totalCredits;

  const w2ByMonth = groupByMonth(w2);
  const efutureByMonth = groupByMonth(efuture);
  const creditsByMonth = groupByMonth(credits);

  const months = Array.from({ length: 12 }, (_, i) => {
    const m = String(i + 1).padStart(2, '0');
    return { key: `${selectedYear}-${m}`, label: MONTH_NAMES[i], m };
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-slate-900">Income</h1>
        <YearPicker selectedYear={selectedYear} availableYears={availableYears} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200 shadow">
          <p className="text-sm font-semibold text-blue-700 mb-1">Total Income {selectedYear}</p>
          <p className="text-4xl font-bold text-blue-900">${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
        </div>
        <Link href="/income/w2" className="bg-gradient-to-br from-indigo-50 to-indigo-100 rounded-xl p-6 border-2 border-indigo-200 shadow hover:border-indigo-400 hover:shadow-md transition-all block">
          <p className="text-sm font-semibold text-indigo-700 mb-1">W2 — Moodys Analytics</p>
          <p className="text-4xl font-bold text-indigo-900">${totalW2.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-indigo-600 mt-1">{w2.length} paychecks</p>
        </Link>
        <Link href="/income/efuture" className="bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl p-6 border-2 border-violet-200 shadow hover:border-violet-400 hover:shadow-md transition-all block">
          <p className="text-sm font-semibold text-violet-700 mb-1">eFuture / YYK</p>
          <p className="text-4xl font-bold text-violet-900">${totalEfuture.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-violet-600 mt-1">{efuture.length} transfers</p>
        </Link>
        <Link href="/income/credits" className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-6 border-2 border-green-200 shadow hover:border-green-400 hover:shadow-md transition-all block">
          <p className="text-sm font-semibold text-green-700 mb-1">Credits & Refunds</p>
          <p className="text-4xl font-bold text-green-900">${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <p className="text-xs text-green-600 mt-1">{credits.length} entries</p>
        </Link>
      </div>

      {/* Monthly breakdown table */}
      {yearIncome.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm overflow-x-auto">
          <h2 className="text-xl font-bold text-slate-900 mb-4">Monthly Breakdown</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-slate-100">
                <th className="text-left py-2 font-semibold text-slate-600">Month</th>
                <th className="text-right py-2 font-semibold text-indigo-700">W2</th>
                <th className="text-right py-2 font-semibold text-violet-700">eFuture</th>
                <th className="text-right py-2 font-semibold text-green-700">Credits</th>
                <th className="text-right py-2 font-semibold text-slate-900">Total</th>
              </tr>
            </thead>
            <tbody>
              {months.map(({ key, label }) => {
                const w2amt = w2ByMonth[key] ?? 0;
                const efuamt = efutureByMonth[key] ?? 0;
                const credamt = creditsByMonth[key] ?? 0;
                const total = w2amt + efuamt;
                if (total === 0 && credamt === 0) return null;
                return (
                  <tr key={key} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2.5 font-medium text-slate-700">{label} {selectedYear}</td>
                    <td className="py-2.5 text-right text-indigo-800 font-medium">
                      {w2amt > 0 ? `$${w2amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-2.5 text-right text-violet-800 font-medium">
                      {efuamt > 0 ? `$${efuamt.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-2.5 text-right text-green-800 font-medium">
                      {credamt > 0 ? `$${credamt.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—'}
                    </td>
                    <td className="py-2.5 text-right font-bold text-slate-900">
                      ${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200">
                <td className="py-2.5 font-bold text-slate-900">YTD Total</td>
                <td className="py-2.5 text-right font-bold text-indigo-900">${totalW2.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="py-2.5 text-right font-bold text-violet-900">${totalEfuture.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="py-2.5 text-right font-bold text-green-900">${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                <td className="py-2.5 text-right font-bold text-slate-900">${(totalW2 + totalEfuture).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6 items-start" style={{ gridTemplateColumns: credits.length > 0 ? 'repeat(3, 1fr)' : 'repeat(2, 1fr)' }}>
        {/* W2 paychecks */}
        {w2.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-indigo-100 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">W2 Paychecks — Moodys</h2>
            <div className="space-y-2">
              {[...w2].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">{e.date}</span>
                  <span className="font-bold text-indigo-900">${e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* eFuture transfers */}
        {efuture.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-violet-100 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">eFuture Income</h2>
            <div className="space-y-2">
              {[...efuture].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50">
                  <span className="text-slate-500">{e.date}</span>
                  <span className="font-bold text-violet-900">${e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Credits & Refunds */}
        {credits.length > 0 && (
          <div className="bg-white rounded-xl border-2 border-green-100 p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-4">Credits & Refunds</h2>
            <div className="space-y-2">
              {[...credits].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                <div key={e.id} className="flex items-center justify-between text-sm py-1.5 border-b border-slate-50">
                  <div>
                    <span className="text-slate-500 mr-3">{e.date}</span>
                    {e.description && <span className="text-slate-600">{e.description}</span>}
                  </div>
                  <span className="font-bold text-green-900">${e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {yearIncome.length === 0 && (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-12 text-center">
          <p className="text-slate-400 font-medium text-lg">No income data for {selectedYear}.</p>
          <p className="text-slate-400 text-sm mt-2">Upload your BofA Personal Checking or eFuture Checking statement to get started.</p>
        </div>
      )}
    </div>
  );
}
