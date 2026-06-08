import { BucketKey } from '@/lib/types';

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
  actualByCategory: Record<string, number>;
  mapping: Record<BucketKey, string[]>;
  incomeForPeriod: number | null;
  periodLabel: string;
}

export default function ActualSpendBuckets({ actualByCategory, mapping, incomeForPeriod, periodLabel }: Props) {
  const bucketTotal = (bucket: BucketKey) =>
    mapping[bucket].reduce((s, c) => s + Math.max(0, actualByCategory[c] ?? 0), 0);

  const bucketPct = (bucket: BucketKey): number | null =>
    incomeForPeriod && incomeForPeriod > 0
      ? (bucketTotal(bucket) / incomeForPeriod) * 100
      : null;

  const leftover =
    incomeForPeriod != null
      ? incomeForPeriod - ORDERED_BUCKETS.reduce((s, b) => s + bucketTotal(b), 0)
      : null;

  // Positive leftover is treated as implicit savings
  const leftoverPositive = leftover !== null && leftover > 0 ? leftover : 0;
  const effectiveSavingsTotal = bucketTotal('Savings & Debt') + leftoverPositive;
  const effectiveSavingsPct: number | null =
    incomeForPeriod && incomeForPeriod > 0
      ? (effectiveSavingsTotal / incomeForPeriod) * 100
      : null;

  const displayTotal = (bucket: BucketKey) =>
    bucket === 'Savings & Debt' ? effectiveSavingsTotal : bucketTotal(bucket);

  const displayPct = (bucket: BucketKey): number | null =>
    bucket === 'Savings & Debt' ? effectiveSavingsPct : bucketPct(bucket);

  const usedPct = ORDERED_BUCKETS.reduce((s, b) => s + (displayPct(b) ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-xl font-bold text-slate-900">Budget Breakdown</h2>
        <p className="text-sm text-slate-500 mt-0.5">{periodLabel} · % of income</p>
      </div>

      {/* Income line */}
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-lg mb-5 ${
        incomeForPeriod ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 border border-slate-200'
      }`}>
        <span className="text-sm font-medium text-slate-600">Income this period:</span>
        <span className={`text-sm font-bold ${incomeForPeriod ? 'text-emerald-700' : 'text-slate-400'}`}>
          {incomeForPeriod
            ? `$${incomeForPeriod.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
            : '—'}
        </span>
        {!incomeForPeriod && (
          <span className="text-xs text-slate-400">Add income entries to see percentages</span>
        )}
      </div>

      {/* Stacked bar */}
      {incomeForPeriod !== null && (
        <div className="flex h-9 rounded-xl overflow-hidden mb-2">
          {ORDERED_BUCKETS.map((bucket) => {
            const p = displayPct(bucket) ?? 0;
            if (p <= 0) return null;
            return (
              <div
                key={bucket}
                style={{ width: `${Math.min(p, 100)}%` }}
                className={`${BUCKET_BAR_COLOR[bucket]} flex items-center justify-center transition-all duration-300`}
                title={`${BUCKET_DISPLAY_LABEL[bucket]}: ${p.toFixed(1)}%`}
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

      {/* Legend */}
      {incomeForPeriod !== null && (
        <div className="flex gap-4 mb-5 px-1">
          {ORDERED_BUCKETS.map((bucket) => {
            const p = displayPct(bucket);
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
      <div className="grid grid-cols-3 gap-3">
        {ORDERED_BUCKETS.map((bucket) => {
          const isSavings = bucket === 'Savings & Debt';
          const categories = mapping[bucket].filter((c) => (actualByCategory[c] ?? 0) > 0);
          const total = displayTotal(bucket);
          const pct = displayPct(bucket);
          return (
            <div
              key={bucket}
              className={`rounded-xl border-2 p-3 ${BUCKET_BORDER_COLOR[bucket]} ${BUCKET_BG[bucket]}`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <span className={`text-xs font-bold uppercase tracking-wider ${BUCKET_TEXT[bucket]}`}>
                  {BUCKET_DISPLAY_LABEL[bucket]}
                </span>
                <span className="text-sm font-bold text-slate-800">
                  {pct !== null ? `${pct.toFixed(1)}%` : '—'}
                </span>
              </div>
              <div className="text-xs text-slate-400 mb-3">
                ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })} {isSavings ? 'saved' : 'spent'}
              </div>
              <div className="space-y-1.5">
                {/* Regular category rows */}
                {categories.length === 0 && !isSavings && (
                  <p className="text-xs text-slate-300 text-center py-3">No spend</p>
                )}
                {categories
                  .sort((a, b) => (actualByCategory[b] ?? 0) - (actualByCategory[a] ?? 0))
                  .map((cat) => (
                    <div
                      key={cat}
                      className="flex items-center justify-between bg-white rounded-lg px-2.5 py-1.5 border border-slate-200 shadow-sm"
                    >
                      <span className="text-xs font-medium text-slate-700 truncate mr-1 flex-1">{cat}</span>
                      <span className="text-xs font-semibold text-slate-800 shrink-0">
                        ${(actualByCategory[cat] ?? 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                      </span>
                    </div>
                  ))}

                {/* Leftover */}
                {isSavings && leftover !== null && (
                  <div className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 border shadow-sm ${
                    leftover >= 0
                      ? 'bg-emerald-100 border-emerald-300'
                      : 'bg-red-50 border-red-200'
                  }`}>
                    <span className={`text-xs font-semibold truncate mr-1 flex-1 ${leftover >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                      Leftover
                    </span>
                    <span className={`text-xs font-bold shrink-0 ${leftover >= 0 ? 'text-emerald-800' : 'text-red-700'}`}>
                      {leftover >= 0 ? '+' : '-'}${Math.abs(leftover).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </span>
                  </div>
                )}

                {isSavings && categories.length === 0 && leftover === null && (
                  <p className="text-xs text-slate-300 text-center py-3">No data</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
