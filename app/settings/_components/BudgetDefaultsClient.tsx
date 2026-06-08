'use client';

import { useState, useCallback } from 'react';
import { IncomeEntry } from '@/lib/types';

interface Props {
  categories: string[];
  initialDefaults: Record<string, number>;
  initialYear: string;
  availableYears: string[];
  allIncome: IncomeEntry[];
}

function monthlyAvgIncome(income: IncomeEntry[], year: string): number | null {
  const entries = income.filter((e) => e.year === year && e.source !== 'Credit');
  if (entries.length === 0) return null;
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const months = new Set(entries.map((e) => e.month)).size;
  return total / months;
}

export default function BudgetDefaultsClient({
  categories,
  initialDefaults,
  initialYear,
  availableYears,
  allIncome,
}: Props) {
  const [year, setYear] = useState(initialYear);
  const [defaults, setDefaults] = useState<Record<string, number>>(initialDefaults);
  const [inputValues, setInputValues] = useState<Record<string, string>>(
    () => Object.fromEntries(categories.map((c) => [c, String(initialDefaults[c] ?? 0)]))
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const avg = monthlyAvgIncome(allIncome, year);

  const loadYear = useCallback(async (newYear: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/budget/defaults?year=${newYear}`);
      const data = await res.json() as Record<string, number>;
      setDefaults(data);
      setInputValues(Object.fromEntries(categories.map((c) => [c, String(data[c] ?? 0)])));
    } finally {
      setLoading(false);
    }
  }, [categories]);

  const handleYearChange = (newYear: string) => {
    setYear(newYear);
    loadYear(newYear);
  };

  const saveToServer = useCallback(async (budget: Record<string, number>, forYear: string) => {
    setSaving(true);
    setSavedFlash(false);
    try {
      await fetch('/api/budget/defaults', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year: forYear, budget }),
      });
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSaving(false);
    }
  }, []);

  const handleInput = (cat: string, val: string) => {
    setInputValues((prev) => ({ ...prev, [cat]: val }));
  };

  const handleBlur = (cat: string, val: string, currentDefaults: Record<string, number>, currentYear: string) => {
    const num = parseFloat(val);
    const finalNum = val.trim() === '' || isNaN(num) ? 0 : num;
    const updated = { ...currentDefaults, [cat]: finalNum };
    setDefaults(updated);
    setInputValues((prev) => ({ ...prev, [cat]: String(finalNum) }));
    saveToServer(updated, currentYear);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-1">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Budget Defaults</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Restored when you click &ldquo;Reset to Defaults&rdquo; on the dashboard.
          </p>
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          {saving && <span className="text-sm text-slate-400 font-medium">Saving…</span>}
          {savedFlash && !saving && <span className="text-sm text-green-600 font-medium">Saved</span>}
          <select
            value={year}
            onChange={(e) => handleYearChange(e.target.value)}
            disabled={loading}
            className="px-3 py-1.5 text-sm font-semibold border border-slate-300 rounded-lg focus:outline-none focus:border-blue-400 bg-white text-slate-800 disabled:opacity-50"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Monthly avg income banner */}
      <div className={`flex items-center gap-2 px-4 py-3 rounded-lg mb-5 mt-4 ${
        avg !== null ? 'bg-green-50 border border-green-200' : 'bg-slate-50 border border-slate-200'
      }`}>
        <span className="text-sm font-medium text-slate-600">Monthly avg income ({year}):</span>
        <span className={`text-sm font-bold ${avg !== null ? 'text-green-700' : 'text-slate-400'}`}>
          {avg !== null ? `$${avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
        </span>
        {avg !== null && (
          <span className="text-xs text-slate-400 ml-1">(running avg across months with income)</span>
        )}
      </div>

      {/* Category budget inputs */}
      {loading ? (
        <div className="text-sm text-slate-400 py-4 text-center">Loading…</div>
      ) : categories.length === 0 ? (
        <p className="text-sm text-slate-400">No categories found. Add categories above first.</p>
      ) : (
        <>
          <div className="space-y-2">
            {categories.map((cat) => (
              <div key={cat} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-lg">
                <span className="font-medium text-slate-800">{cat}</span>
                <div className="flex items-center gap-1">
                  <span className="text-slate-500 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="10"
                    value={inputValues[cat] ?? String(defaults[cat] ?? 0)}
                    onChange={(e) => handleInput(cat, e.target.value)}
                    onBlur={(e) => handleBlur(cat, e.target.value, defaults, year)}
                    className="w-24 text-right text-sm font-semibold text-slate-800 border border-slate-300 rounded px-2 py-1 focus:outline-none focus:border-blue-400 focus:bg-white hover:border-slate-400 bg-white transition"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Summary footer */}
          {(() => {
            const totalBudget = categories.reduce((s, cat) => s + (defaults[cat] ?? 0), 0);
            const leftover = avg !== null ? avg - totalBudget : null;
            return (
              <div className="mt-4 border-t border-slate-200 pt-4 space-y-2">
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-100 rounded-lg">
                  <span className="font-semibold text-slate-700">Total budgeted / mo</span>
                  <span className="font-bold text-slate-900">
                    ${totalBudget.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg ${
                  leftover === null
                    ? 'bg-slate-50'
                    : leftover >= 0
                    ? 'bg-green-50 border border-green-200'
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <span className={`font-semibold ${
                    leftover === null ? 'text-slate-400' : leftover >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    Leftover / mo
                  </span>
                  <span className={`font-bold ${
                    leftover === null ? 'text-slate-400' : leftover >= 0 ? 'text-green-700' : 'text-red-700'
                  }`}>
                    {leftover === null
                      ? '—'
                      : `${leftover >= 0 ? '+' : '-'}$${Math.abs(leftover).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
                {leftover === null && (
                  <p className="text-xs text-slate-400 px-1">Add income entries to see how much is left over each month.</p>
                )}
              </div>
            );
          })()}
        </>
      )}
    </div>
  );
}
