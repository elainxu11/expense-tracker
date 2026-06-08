'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
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
  defaultBudget: Record<string, number>;
  year: string;
  incomeByMonth: Record<string, number>;
}

export default function MonthlyBreakdown({ transactions, initialBudget, defaultBudget, year, incomeByMonth }: Props) {
  const [budget, setBudget] = useState<Record<string, number>>(initialBudget);
  const [inputValues, setInputValues] = useState<Record<string, string>>(
    () => Object.fromEntries(Object.entries(initialBudget).map(([k, v]) => [k, String(v)]))
  );
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const monthData: Record<string, Record<string, number>> = {};
  for (const tx of transactions.filter((t) => t.year === year)) {
    monthData[tx.month] ??= {};
    if (tx.type === 'expense') {
      monthData[tx.month][tx.category] = (monthData[tx.month][tx.category] || 0) + tx.amount;
    } else if (tx.type === 'credit' && tx.refundCategory) {
      // Deduct from the expense category this credit applies to, in the month it arrived
      monthData[tx.month][tx.refundCategory] = (monthData[tx.month][tx.refundCategory] || 0) - tx.amount;
    }
  }

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
    (s, mk) => s + Object.values(monthData[mk] ?? {}).reduce((a, v) => a + Math.max(0, v), 0),
    0
  );
  const yearIncome = months.reduce((s, mk) => s + (incomeByMonth[mk] || 0), 0);
  const yearNet = yearIncome - yearSpent;

  const saveBudgetToServer = useCallback(async (budgetToSave: Record<string, number>) => {
    setSaving(true);
    setSavedFlash(false);
    try {
      await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(budgetToSave),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleBudgetInput = (cat: string, val: string) => {
    setInputValues((prev) => ({ ...prev, [cat]: val }));
  };

  const handleBudgetBlur = useCallback((cat: string, val: string, currentBudget: Record<string, number>) => {
    const num = parseFloat(val);
    const finalNum = val.trim() === '' || isNaN(num) ? 0 : num;
    const newBudget = { ...currentBudget, [cat]: finalNum };
    setBudget(newBudget);
    setInputValues((prev) => ({ ...prev, [cat]: String(finalNum) }));
    saveBudgetToServer(newBudget);
  }, [saveBudgetToServer]);

  const handleResetToDefaults = () => {
    setBudget(defaultBudget);
    setInputValues(Object.fromEntries(Object.entries(defaultBudget).map(([k, v]) => [k, String(v)])));
    saveBudgetToServer(defaultBudget);
  };

  if (months.length === 0) return null;

  const budgetRowTotal = categories.reduce((s, cat) => s + (budget[cat] || 0), 0);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
        <h2 className="text-lg font-bold text-slate-800">{year} Monthly Breakdown</h2>
        <div className="flex items-center gap-3">
          {saving && (
            <span className="text-sm text-slate-400 font-medium">Saving…</span>
          )}
          {savedFlash && !saving && (
            <span className="text-sm text-green-600 font-medium">Saved</span>
          )}
          <button
            onClick={handleResetToDefaults}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 disabled:opacity-40 transition border border-slate-300"
          >
            Reset to Defaults
          </button>
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
              const monthSpent = Object.values(md).reduce((s, v) => s + Math.max(0, v), 0);
              const monthIncome = incomeByMonth[mk] || 0;
              const monthNet = monthIncome - monthSpent;
              return (
                <tr key={mk} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3 font-medium whitespace-nowrap">
                    <Link
                      href={`/months/${year}/${mk}`}
                      className="text-slate-700 hover:text-blue-600 hover:underline transition"
                    >
                      {MONTH_LABEL[mk]}
                    </Link>
                  </td>
                  {categories.map((cat) => {
                    const val = md[cat];
                    const budgetVal = budget[cat] || 0;
                    const overBudget = budgetVal > 0 && val !== undefined && val > budgetVal;
                    const isCredit = val !== undefined && val < 0;
                    return (
                      <td
                        key={cat}
                        className={`px-4 py-3 text-right whitespace-nowrap font-medium ${
                          isCredit ? 'text-green-600' : overBudget ? 'text-red-600' : 'text-slate-600'
                        }`}
                      >
                        {val !== undefined ? `${isCredit ? '-' : ''}$${Math.abs(val).toFixed(2)}` : '—'}
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
                      value={inputValues[cat] ?? String(budget[cat] ?? 0)}
                      onChange={(e) => handleBudgetInput(cat, e.target.value)}
                      onBlur={(e) => handleBudgetBlur(cat, e.target.value, budget)}
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
