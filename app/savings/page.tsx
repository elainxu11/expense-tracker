import { getIncome, getSavings, getTransactions } from '@/lib/googleSheets';
import { SavingsEntry } from '@/lib/types';
import YearPicker from '@/app/_components/YearPicker';

function groupByInstitution(entries: SavingsEntry[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const e of entries) {
    result[e.institution] = (result[e.institution] ?? 0) + e.amount;
  }
  return result;
}

export default async function SavingsPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const [allIncome, allSavings, allTransactions] = await Promise.all([
    getIncome(),
    getSavings(),
    getTransactions(),
  ]);

  const { year } = await searchParams;
  const now = new Date();

  const allYears = [
    ...new Set([
      ...allIncome.map((e) => e.year),
      ...allSavings.map((e) => e.year),
      ...allTransactions.map((t) => t.year),
    ]),
  ].sort().reverse();
  if (!allYears.includes(String(now.getFullYear()))) allYears.unshift(String(now.getFullYear()));
  const selectedYear = year ?? allYears[0] ?? String(now.getFullYear());

  const income = allIncome.filter((e) => e.year === selectedYear);
  const savings = allSavings.filter((e) => e.year === selectedYear);
  const transactions = allTransactions.filter((t) => t.year === selectedYear);

  const totalIncome = income.filter((e) => e.source !== 'Credit').reduce((s, e) => s + e.amount, 0);
  // Credits deposited to checking (tax refunds, Zelle reimbursements, etc.)
  const totalCheckingCredits = income.filter((e) => e.source === 'Credit').reduce((s, e) => s + e.amount, 0);
  // Credits on credit card statements (refunds, chargebacks)
  const totalCardCredits = transactions.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
  const totalCredits = totalCheckingCredits + totalCardCredits;

  // Investment transfers from checking land in Transactions with category='Investments', not the Savings sheet
  const investmentTxs = transactions.filter((t) => t.type === 'expense' && t.category === 'Investments');
  const totalInvestmentTxs = investmentTxs.reduce((s, t) => s + t.amount, 0);

  // Expenses excluding investment transfers (which are shown as their own line)
  const totalExpenses = transactions.filter((t) => t.type === 'expense' && t.category !== 'Investments').reduce((s, t) => s + t.amount, 0);

  const hySavings = savings.filter((s) => s.entryType === 'hy-savings');
  const savingsSheetInvestments = savings.filter((s) => s.entryType === 'investment');

  const totalHY = hySavings.reduce((s, e) => s + e.amount, 0);
  const totalSavingsInvestments = savingsSheetInvestments.reduce((s, e) => s + e.amount, 0);
  const totalInvestments = totalInvestmentTxs + totalSavingsInvestments;
  const totalSaved = totalHY + totalInvestments;

  const netCash = totalIncome + totalCredits - totalExpenses - totalSaved;

  // Unified investment list: savings sheet entries + investment transactions from checking
  const allInvestmentEntries = [
    ...savingsSheetInvestments.map((e) => ({ date: e.date, label: e.institution, amount: e.amount, id: e.id })),
    ...investmentTxs.map((t) => ({ date: t.date, label: t.merchant, amount: t.amount, id: t.id })),
  ];

  const hyByInstitution = groupByInstitution(hySavings);
  const invByInstitution: Record<string, number> = {};
  for (const e of allInvestmentEntries) {
    invByInstitution[e.label] = (invByInstitution[e.label] ?? 0) + e.amount;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-slate-900">Savings & Investments</h1>
        <YearPicker selectedYear={selectedYear} availableYears={allYears} />
      </div>

      {/* Net summary */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-slate-700 mb-4">Net Cash Flow — {selectedYear}</h2>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Total Income</span>
            <span className="font-bold text-blue-700">+${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Credits & Reimbursements</span>
            <span className="font-bold text-green-700">+${totalCredits.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Total Expenses</span>
            <span className="font-bold text-red-700">−${totalExpenses.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Moved to HY Savings</span>
            <span className="font-bold text-emerald-700">−${totalHY.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-slate-100">
            <span className="text-slate-600 font-medium">Moved to Investments</span>
            <span className="font-bold text-purple-700">−${totalInvestments.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>
          <div className={`flex justify-between items-center py-3 rounded-lg px-3 ${netCash >= 0 ? 'bg-green-50' : 'bg-red-50'}`}>
            <span className="font-bold text-slate-900 text-lg">Net Remaining</span>
            <span className={`font-bold text-2xl ${netCash >= 0 ? 'text-green-800' : 'text-red-800'}`}>
              {netCash >= 0 ? '+' : ''}${netCash.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* HY Savings */}
        <div className="bg-white rounded-xl border-2 border-emerald-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">High Yield Savings</h2>
            <span className="text-2xl font-bold text-emerald-800">${totalHY.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          {Object.entries(hyByInstitution).length > 0 ? (
            <>
              <div className="space-y-2 mb-4">
                {Object.entries(hyByInstitution).sort((a, b) => b[1] - a[1]).map(([inst, amt]) => (
                  <div key={inst} className="flex justify-between items-center text-sm">
                    <span className="text-slate-700 font-medium">{inst}</span>
                    <span className="font-bold text-emerald-800">${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto border-t border-slate-100 pt-3">
                {[...hySavings].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 mr-2">{e.date}</span>
                      <span className="text-slate-600">{e.institution}</span>
                    </div>
                    <span className="font-semibold text-emerald-700">${e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">No HY savings transfers for {selectedYear}.</p>
          )}
        </div>

        {/* Investments */}
        <div className="bg-white rounded-xl border-2 border-purple-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-900">Investments</h2>
            <span className="text-2xl font-bold text-purple-800">${totalInvestments.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          </div>

          {allInvestmentEntries.length > 0 ? (
            <>
              <div className="space-y-2 mb-4">
                {Object.entries(invByInstitution).sort((a, b) => b[1] - a[1]).map(([inst, amt]) => (
                  <div key={inst} className="flex justify-between items-center text-sm">
                    <span className="text-slate-700 font-medium">{inst}</span>
                    <span className="font-bold text-purple-800">${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto border-t border-slate-100 pt-3">
                {[...allInvestmentEntries].sort((a, b) => b.date.localeCompare(a.date)).map((e) => (
                  <div key={e.id} className="flex items-center justify-between text-xs">
                    <div>
                      <span className="text-slate-400 mr-2">{e.date}</span>
                      <span className="text-slate-600">{e.label}</span>
                    </div>
                    <span className="font-semibold text-purple-700">${e.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-slate-400 text-sm">No investment transfers for {selectedYear}.</p>
          )}
        </div>
      </div>

      {/* Total saved summary */}
      {totalSaved > 0 && (
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-emerald-700">HY Savings Allocated</p>
            <p className="text-3xl font-bold text-emerald-900">${totalHY.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-purple-700">Investments Allocated</p>
            <p className="text-3xl font-bold text-purple-900">${totalInvestments.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          </div>
          <div className="bg-slate-50 border-2 border-slate-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-700">Total Allocated</p>
            <p className="text-3xl font-bold text-slate-900">${totalSaved.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            {totalIncome > 0 && (
              <p className="text-xs text-slate-500 mt-1">{((totalSaved / totalIncome) * 100).toFixed(1)}% of income</p>
            )}
          </div>
        </div>
      )}

      {savings.length === 0 && income.length === 0 && (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-12 text-center">
          <p className="text-slate-400 font-medium text-lg">No data for {selectedYear}.</p>
          <p className="text-slate-400 text-sm mt-2">Upload your BofA checking statements to populate this page.</p>
        </div>
      )}
    </div>
  );
}
