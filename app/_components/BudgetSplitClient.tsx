'use client';

import { useState, useRef, useCallback } from 'react';
import { IncomeEntry, BucketKey, DEFAULT_BUCKET_MAPPING } from '@/lib/types';

const ORDERED_BUCKETS: BucketKey[] = ['Needs', 'Wants', 'Savings & Debt'];

const BUCKET_DISPLAY_LABEL: Record<BucketKey, string> = {
  Needs: 'Needs',
  Wants: 'Wants',
  'Savings & Debt': 'Savings',
  Unassigned: 'Unassigned',
};

const BUCKET_BAR_COLOR: Record<BucketKey, string> = {
  Needs: 'bg-blue-500',
  Wants: 'bg-violet-400',
  'Savings & Debt': 'bg-emerald-500',
  Unassigned: 'bg-slate-300',
};

const BUCKET_BORDER_COLOR: Record<BucketKey, string> = {
  Needs: 'border-blue-200',
  Wants: 'border-violet-200',
  'Savings & Debt': 'border-emerald-200',
  Unassigned: 'border-slate-200',
};

const BUCKET_BG: Record<BucketKey, string> = {
  Needs: 'bg-blue-50',
  Wants: 'bg-violet-50',
  'Savings & Debt': 'bg-emerald-50',
  Unassigned: 'bg-slate-50',
};

const BUCKET_TEXT: Record<BucketKey, string> = {
  Needs: 'text-blue-700',
  Wants: 'text-violet-700',
  'Savings & Debt': 'text-emerald-700',
  Unassigned: 'text-slate-500',
};

interface Props {
  categories: string[];
  initialAmounts: Record<string, number>;
  initialMapping: Record<BucketKey, string[]>;
  allIncome: IncomeEntry[];
  year: string;
}

function monthlyAvgIncome(income: IncomeEntry[], year: string): number | null {
  const entries = income.filter((e) => e.year === year && e.source !== 'Credit');
  if (entries.length === 0) return null;
  const total = entries.reduce((s, e) => s + e.amount, 0);
  const months = new Set(entries.map((e) => e.month)).size;
  return total / months;
}

function normalizeMapping(
  mapping: Record<BucketKey, string[]>,
  categories: string[]
): Record<BucketKey, string[]> {
  const assigned = new Set(Object.values(mapping).flat());
  const unassigned = categories.filter((c) => !assigned.has(c));
  return { ...mapping, Unassigned: [...(mapping.Unassigned ?? []), ...unassigned] };
}

export default function BudgetSplitClient({ categories, initialAmounts, initialMapping, allIncome, year }: Props) {
  const [amounts, setAmounts] = useState<Record<string, number>>(initialAmounts);
  const [inputValues, setInputValues] = useState<Record<string, string>>(
    () => Object.fromEntries(categories.map((c) => [c, String(initialAmounts[c] ?? 0)]))
  );
  const [mapping, setMapping] = useState<Record<BucketKey, string[]>>(
    () => normalizeMapping(initialMapping, categories)
  );
  const [dragOverBucket, setDragOverBucket] = useState<BucketKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const dragRef = useRef<{ category: string; fromBucket: BucketKey } | null>(null);

  const avg = monthlyAvgIncome(allIncome, year);

  const bucketTotal = (bucket: BucketKey) =>
    mapping[bucket].reduce((s, c) => s + (amounts[c] ?? 0), 0);

  const bucketPct = (bucket: BucketKey): number | null =>
    avg && avg > 0 ? (bucketTotal(bucket) / avg) * 100 : null;

  const handleDragStart = (category: string, fromBucket: BucketKey) => {
    dragRef.current = { category, fromBucket };
  };

  const handleDragEnd = () => {
    dragRef.current = null;
    setDragOverBucket(null);
  };

  const handleDrop = (toBucket: BucketKey) => {
    if (!dragRef.current) return;
    const { category, fromBucket } = dragRef.current;
    if (fromBucket === toBucket) { setDragOverBucket(null); return; }
    setMapping((prev) => ({
      ...prev,
      [fromBucket]: prev[fromBucket].filter((c) => c !== category),
      [toBucket]: [...prev[toBucket], category],
    }));
    dragRef.current = null;
    setDragOverBucket(null);
  };

  const handleAmountChange = (cat: string, val: string) => {
    setInputValues((prev) => ({ ...prev, [cat]: val }));
  };

  const handleAmountBlur = (cat: string, val: string) => {
    const num = parseFloat(val);
    const final = isNaN(num) || val.trim() === '' ? 0 : num;
    setAmounts((prev) => ({ ...prev, [cat]: final }));
    setInputValues((prev) => ({ ...prev, [cat]: String(final) }));
  };

  const save = useCallback(async () => {
    setSaving(true);
    setSavedFlash(false);
    try {
      await Promise.all([
        fetch('/api/budget/buckets', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(mapping),
        }),
        fetch('/api/budget/defaults', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ year, budget: amounts }),
        }),
      ]);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } finally {
      setSaving(false);
    }
  }, [mapping, amounts, year]);

  const resetMapping = () => {
    setMapping(normalizeMapping(DEFAULT_BUCKET_MAPPING, categories));
  };

  const usedPct = ORDERED_BUCKETS.reduce((s, b) => s + (bucketPct(b) ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Budget Split</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Drag categories between buckets · edit amounts inline · % of monthly income
          </p>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {saving && <span className="text-sm text-slate-400">Saving…</span>}
          {savedFlash && !saving && <span className="text-sm text-emerald-600 font-medium">Saved</span>}
          <button
            onClick={resetMapping}
            className="px-3 py-1.5 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Reset mapping
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-3 py-1.5 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-700 disabled:opacity-50 transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* Income banner */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg mb-5 ${
        avg !== null ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'
      }`}>
        <span className="text-sm font-medium text-slate-600">Monthly avg income ({year}):</span>
        <span className={`text-sm font-bold ${avg !== null ? 'text-emerald-700' : 'text-slate-400'}`}>
          {avg !== null
            ? `$${avg.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '—'}
        </span>
        {avg === null && (
          <span className="text-xs text-slate-400">Add income entries to see percentages</span>
        )}
      </div>

      {/* Stacked bar */}
      {avg !== null && (
        <div className="flex h-9 rounded-xl overflow-hidden mb-2">
          {ORDERED_BUCKETS.map((bucket) => {
            const p = bucketPct(bucket) ?? 0;
            if (p <= 0) return null;
            return (
              <div
                key={bucket}
                style={{ width: `${p}%` }}
                className={`${BUCKET_BAR_COLOR[bucket]} flex items-center justify-center transition-all duration-300`}
                title={`${bucket}: ${p.toFixed(1)}%`}
              >
                {p >= 7 && (
                  <span className="text-xs font-bold text-white drop-shadow">{p.toFixed(0)}%</span>
                )}
              </div>
            );
          })}
          {usedPct < 99.5 && (
            <div className="flex-1 bg-slate-100 flex items-center justify-center">
              <span className="text-xs text-slate-400">{(100 - usedPct).toFixed(0)}% left</span>
            </div>
          )}
        </div>
      )}

      {/* Bar legend */}
      {avg !== null && (
        <div className="flex gap-4 mb-5 px-1">
          {ORDERED_BUCKETS.map((bucket) => {
            const p = bucketPct(bucket);
            return (
              <div key={bucket} className="flex items-center gap-1.5">
                <span className={`w-2.5 h-2.5 rounded-full ${BUCKET_BAR_COLOR[bucket]}`} />
                <span className="text-xs text-slate-500">{BUCKET_DISPLAY_LABEL[bucket]}</span>
                {p !== null && (
                  <span className={`text-xs font-semibold ${BUCKET_TEXT[bucket]}`}>{p.toFixed(1)}%</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Three bucket columns */}
      <div className="grid grid-cols-3 gap-3 mb-3">
        {ORDERED_BUCKETS.map((bucket) => (
          <div
            key={bucket}
            onDragOver={(e) => { e.preventDefault(); setDragOverBucket(bucket); }}
            onDrop={() => handleDrop(bucket)}
            className={`rounded-xl border-2 p-3 min-h-40 transition-colors duration-150 ${
              dragOverBucket === bucket
                ? 'border-blue-400 bg-blue-50 scale-[1.01]'
                : `${BUCKET_BORDER_COLOR[bucket]} ${BUCKET_BG[bucket]}`
            }`}
          >
            {/* Bucket header */}
            <div className="flex items-baseline justify-between mb-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${BUCKET_TEXT[bucket]}`}>
                {BUCKET_DISPLAY_LABEL[bucket]}
              </span>
              <span className="text-sm font-bold text-slate-800">
                {bucketPct(bucket) !== null ? `${bucketPct(bucket)!.toFixed(1)}%` : '—'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mb-1">
              ${bucketTotal(bucket).toLocaleString('en-US', { maximumFractionDigits: 0 })} / mo
            </div>
            {bucket === 'Savings & Debt' && avg !== null && (() => {
              const totalBudgeted = ORDERED_BUCKETS.reduce((s, b) => s + bucketTotal(b), 0);
              const remainder = avg - totalBudgeted;
              return (
                <div className={`text-xs mb-2 ${remainder >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {remainder >= 0 ? '+' : ''}${Math.abs(remainder).toLocaleString('en-US', { maximumFractionDigits: 0 })} unbudgeted
                </div>
              );
            })()}

            {/* Category chips */}
            <div className="space-y-1.5">
              {mapping[bucket].map((cat) => (
                <div
                  key={cat}
                  draggable
                  onDragStart={() => handleDragStart(cat, bucket)}
                  onDragEnd={handleDragEnd}
                  className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-slate-200 cursor-grab active:cursor-grabbing shadow-sm hover:border-slate-300 hover:shadow transition-all select-none"
                >
                  <span className="text-xs font-medium text-slate-700 truncate mr-1 flex-1">{cat}</span>
                  <div
                    className="flex items-center gap-0.5 shrink-0"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <span className="text-xs text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="10"
                      value={inputValues[cat] ?? String(amounts[cat] ?? 0)}
                      onChange={(e) => handleAmountChange(cat, e.target.value)}
                      onBlur={(e) => handleAmountBlur(cat, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-16 text-right text-xs font-semibold border border-slate-200 rounded px-1.5 py-0.5 focus:outline-none focus:border-blue-400 bg-white hover:border-slate-400 transition"
                    />
                  </div>
                </div>
              ))}
              {mapping[bucket].length === 0 && (
                <p className="text-xs text-slate-300 text-center py-3">Drop here</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned row */}
      {mapping.Unassigned.length > 0 && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOverBucket('Unassigned'); }}
          onDrop={() => handleDrop('Unassigned')}
          className={`rounded-xl border-2 p-3 transition-colors ${
            dragOverBucket === 'Unassigned'
              ? 'border-blue-400 bg-blue-50'
              : 'border-slate-200 bg-slate-50'
          }`}
        >
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Unassigned</span>
          <div className="flex flex-wrap gap-2 mt-2">
            {mapping.Unassigned.map((cat) => (
              <div
                key={cat}
                draggable
                onDragStart={() => handleDragStart(cat, 'Unassigned')}
                onDragEnd={handleDragEnd}
                className="flex items-center gap-1.5 bg-white rounded-lg px-2.5 py-1.5 border border-slate-200 cursor-grab active:cursor-grabbing shadow-sm text-xs text-slate-500 font-medium select-none hover:border-slate-300"
              >
                {cat}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
