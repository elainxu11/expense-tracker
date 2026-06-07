'use client';

import { useState, useCallback } from 'react';
import { Transaction } from '@/lib/types';

const MONTH_KEYS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const MONTH_LABEL: Record<string, string> = {
  '01': 'January',  '02': 'February', '03': 'March',    '04': 'April',
  '05': 'May',      '06': 'June',     '07': 'July',     '08': 'August',
  '09': 'September','10': 'October',  '11': 'November', '12': 'December',
};

interface Props {
  transactions: Transaction[];
  initialBudget: Record<string, number>;
  year: string;
  incomeByMonth: Record<string, number>; // "01".."12" -> total income
}

export default function MonthlyBreakdown({ transactions, initialBudget, year, incomeByMonth }: Props) {
  const [budget, setBudget] = useState<Record<string, number>>(initialBudget);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const expenses = transactions.filter((t) => t.type === 'expense' && t.year === year);

  const monthData: Record<string, Record<string, number>> = {};
  for (const tx of expenses) {
    monthData[tx.month] ??= {};
    monthData[tx.month][tx.category] = (monthData[tx.month][tx.category] || 0) + tx.amount;
  }

  // Include months with expenses OR income
  const hasIncome = Object.keys(incomeByMonth).length > 0;
  const months = MONTH_KEYS.filter((mk) => monthData[mk] || incomeByMonth[mk]);

  const categories = [
    ...new Set(months.flatMap((mk) => Object.keys(monthData[mk] ?? {}))),
  ].sort((a, b) => {
    const totA = months.reduce((s, mk) => s + (monthData[mk]?.[a] || 0), 0);
    const totB = months.reduce((s, mk) => s + (monthData[mk]?.[b] || 0), 0);
    return totB - totA;
  });

  const yearSpent = months.reduce(
    (s, mk) => s + Object.values(monthData[mk] ?? {}).reduce((a, v) => a + v, 0),
    0
  );
  const yearIncome = months.reduce((s, mk) => s + (incomeByMonth[mk] || 0), 0);
  const yearNet = yearIncome - yearSpent;

  const handleBudgetChange = (cat: string, val: string) => {
    const num = parseFloat(val);
    setBudget((prev) => ({ ...prev, [cat]: isNaN(num) ? 0 : num }));
    setDirty(true);
  };

  const saveBudgetFn = useCallback(async () => {
    setSaving(true);
    try {
      await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budget),
      });
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }, [budget]);

  if (months.length === 0) return null;

  const budgetRowTotal = categories.reduce((s, cat) => s + (budget[cat] || 0), 0);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">{year} Monthly Breakdown</h2>
        <div className="flex items-center gap-3">
          {dirty && (
            <button
              onClick={saveBudgetFn}
              disabled={saving}
              className="px-3 py-1.5 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
            >
              {saving ? 'Saving…' : 'Save Budget'}
            </button>
          )}
          <span className="text-lg font-bold text-slate-900">${yearSpent.toFixed(2)}</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-5 py-3 font-semibold text-slate-600 whitespace-nowrap">Month</th>
              {categories.map((cat) => (
                <th key={cat} className="text-right px-4 py-3 font-semibold text-slate-600 whitespace-nowrap">
                  {cat}
                </th>
              ))}
              <th className="text-right px-5 py-3 font-semibold text-slate-800 whitespace-nowrap border-l border-slate-200">
                Spent
              </th>
              {hasIncome && (
                <>
                  <th className="text-right px-5 py-3 font-semibold text-green-700 whitespace-nowrap">Income</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-700 whitespace-nowrap">Net</th>
                </>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {months.map((mk) => {
              const md = monthData[mk] ?? {};
              const monthSpent = Object.values(md).reduce((s, v) => s + v, 0);
              const monthIncome = incomeByMonth[mk] || 0;
              const monthNet = monthIncome - monthSpent;
              return (
                <tr key={mk} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium text-slate-700 whitespace-nowrap">{MONTH_LABEL[mk]}</td>
                  {categories.map((cat) => {
                    const val = md[cat];
                    const budgetVal = budget[cat] || 0;
                    const overBudget = budgetVal > 0 && val !== undefined && val > budgetVal;
                    return (
                      <td
                        key={cat}
                        className={`px-4 py-3 text-right whitespace-nowrap font-medium ${
                          overBudget ? 'text-red-600' : 'text-slate-600'
                        }`}
                      >
                        {val !== undefined ? `$${val.toFixed(2)}` : '—'}
                      </td>
                    );
                  })}
                  <td className="px-5 py-3 text-right font-bold text-slate-900 whitespace-nowrap border-l border-slate-200">
                    {monthSpent > 0 ? `$${monthSpent.toFixed(2)}` : '—'}
                  </td>
                  {hasIncome && (
                    <>
                      <td className="px-5 py-3 text-right font-semibold text-green-700 whitespace-nowrap">
                        {monthIncome > 0 ? `$${monthIncome.toFixed(2)}` : '—'}
                      </td>
                      <td className={`px-5 py-3 text-right font-bold whitespace-nowrap ${
                        monthIncome === 0 ? 'text-slate-400' :
                        monthNet >= 0 ? 'text-green-700' : 'text-red-600'
                      }`}>
                        {monthIncome === 0 ? '—' : `${monthNet >= 0 ? '+' : ''}$${monthNet.toFixed(2)}`}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>

          <tfoot>
            {/* Budget row */}
            <tr className="border-t border-amber-200 bg-amber-50">
              <td className="px-5 py-3 font-semibold text-amber-800 whitespace-nowrap text-sm">Budget / mo</td>
              {categories.map((cat) => (
                <td key={cat} className="px-3 py-2 text-right whitespace-nowrap">
                  <div className="flex items-center justify-end">
                    <span className="text-amber-600 text-xs mr-0.5">$</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={budget[cat] ?? 0}
                      onChange={(e) => handleBudgetChange(cat, e.target.value)}
                      className="w-20 text-right text-sm font-semibold text-amber-900 bg-transparent border border-amber-200 rounded px-2 py-1 focus:outline-none focus:border-amber-400 focus:bg-white hover:border-amber-300 transition"
                    />
                  </div>
                </td>
              ))}
              <td className="px-5 py-3 text-right font-bold text-amber-800 whitespace-nowrap border-l border-amber-200">
                ${budgetRowTotal.toFixed(2)}
              </td>
              {hasIncome && <td colSpan={2} />}
            </tr>

            {/* Total row */}
            <tr className="border-t-2 border-slate-200 bg-slate-50">
              <td className="px-5 py-3 font-bold text-slate-800">Total</td>
              {categories.map((cat) => {
                const catTotal = months.reduce((s, mk) => s + (monthData[mk]?.[cat] || 0), 0);
                return (
                  <td key={cat} className="px-4 py-3 text-right font-bold text-slate-800 whitespace-nowrap">
                    ${catTotal.toFixed(2)}
                  </td>
                );
              })}
              <td className="px-5 py-3 text-right font-bold text-slate-900 whitespace-nowrap border-l border-slate-200">
                ${yearSpent.toFixed(2)}
              </td>
              {hasIncome && (
                <>
                  <td className="px-5 py-3 text-right font-bold text-green-700 whitespace-nowrap">
                    ${yearIncome.toFixed(2)}
                  </td>
                  <td className={`px-5 py-3 text-right font-bold whitespace-nowrap ${yearNet >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {yearNet >= 0 ? '+' : ''}${yearNet.toFixed(2)}
                  </td>
                </>
              )}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
