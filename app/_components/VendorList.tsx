'use client';

import { useState } from 'react';
import Link from 'next/link';

const LIMITS = [5, 25, 50, 100] as const;
type Limit = typeof LIMITS[number] | 'all';

interface Props {
  vendors: { name: string; total: number }[];
}

export default function VendorList({ vendors }: Props) {
  const [limit, setLimit] = useState<Limit>(5);
  const [page, setPage] = useState(0);

  const total = vendors.length;
  const pageSize = limit === 'all' ? total : limit;
  const totalPages = limit === 'all' ? 1 : Math.ceil(total / pageSize);
  const displayed = vendors.slice(page * pageSize, page * pageSize + pageSize);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = page * pageSize + displayed.length;

  const changeLimit = (next: Limit) => {
    setLimit(next);
    setPage(0);
  };

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm w-full min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-900">By Vendor</h2>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {total > 5 && (
            <>
              <span className="text-xs text-slate-400 font-medium">Show:</span>
              {LIMITS.map((n) => (
                <button
                  key={n}
                  onClick={() => changeLimit(n)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    limit === n
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => changeLimit('all')}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  limit === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All
              </button>
            </>
          )}
          <span className="text-sm text-slate-400">
            {total === 0 ? '0' : `${from}–${to}`} of {total}
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {displayed.map(({ name, total: vendorTotal }) => (
          <div key={name} className="flex items-center justify-between min-w-0">
            <Link
              href={`/merchants/${encodeURIComponent(name)}`}
              className="text-slate-700 font-medium hover:text-blue-600 hover:underline transition truncate min-w-0"
            >
              {name}
            </Link>
            <span className="font-bold text-slate-900 ml-4 shrink-0">${vendorTotal.toFixed(2)}</span>
          </div>
        ))}
      </div>

      {limit !== 'all' && totalPages > 1 && (
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            ← Prev
          </button>
          <span className="text-sm text-slate-400">
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= totalPages - 1}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
