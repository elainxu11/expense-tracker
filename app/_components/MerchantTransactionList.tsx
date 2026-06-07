'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Transaction, DEFAULT_CATEGORIES } from '@/lib/types';
import TransactionMenu from './TransactionMenu';

const CARD_LABELS: Record<string, string> = {
  amex: 'American Express',
  'capital-one': 'Capital One Venture X',
  discover: 'Discover',
  venmo: 'Venmo',
  'wells-fargo': 'Wells Fargo Autograph',
  bofa: 'Bank of America',
  other: 'Other',
};

const LIMITS = [5, 25, 50, 100] as const;
type Limit = (typeof LIMITS)[number] | 'all';

interface Props {
  transactions: Transaction[];
  categories?: string[];
}

export default function MerchantTransactionList({
  transactions,
  categories = DEFAULT_CATEGORIES,
}: Props) {
  const router = useRouter();
  const [txs, setTxs] = useState(transactions);
  const [saving, setSaving] = useState<string | null>(null);
  const [limit, setLimit] = useState<Limit>(5);
  const [page, setPage] = useState(0);

  const total = txs.length;
  const pageSize = limit === 'all' ? total : limit;
  const totalPages = limit === 'all' ? 1 : Math.ceil(total / pageSize);
  const displayed = txs.slice(page * pageSize, page * pageSize + pageSize);
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = page * pageSize + displayed.length;

  const changeLimit = (next: Limit) => {
    setLimit(next);
    setPage(0);
  };

  const rowIndex = (id: string) => parseInt(id.replace('tx-', ''), 10);

  const handleCategoryChange = async (tx: Transaction, newCategory: string) => {
    setSaving(tx.id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: rowIndex(tx.id), category: newCategory }),
      });
      if (!res.ok) throw new Error();
      setTxs((prev) => prev.map((t) => (t.id === tx.id ? { ...t, category: newCategory } : t)));
      router.refresh();
    } catch {
      alert('Failed to update category. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleDeductibleToggle = async (tx: Transaction) => {
    const next = !tx.deductible;
    setSaving(tx.id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: rowIndex(tx.id), deductible: next }),
      });
      if (!res.ok) throw new Error();
      setTxs((prev) => prev.map((t) => (t.id === tx.id ? { ...t, deductible: next } : t)));
      router.refresh();
    } catch {
      alert('Failed to update transaction. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleDateChange = async (tx: Transaction, date: string, month: string, year: string) => {
    setSaving(tx.id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: rowIndex(tx.id), date, month, year }),
      });
      if (!res.ok) throw new Error();
      setTxs((prev) => prev.map((t) => (t.id === tx.id ? { ...t, date, month, year } : t)));
      router.refresh();
    } catch {
      alert('Failed to update date. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const handleIgnore = async (tx: Transaction) => {
    setSaving(tx.id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: rowIndex(tx.id), ignored: true }),
      });
      if (!res.ok) throw new Error();
      setTxs((prev) => prev.filter((t) => t.id !== tx.id));
      router.refresh();
    } catch {
      alert('Failed to ignore transaction. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h2 className="text-xl font-bold text-slate-900">Transactions</h2>
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

      <div className="divide-y divide-slate-100">
        {displayed.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between px-6 py-4 gap-4">
            <div className="flex-1 min-w-0">
              <Link
                href={`/merchants/${encodeURIComponent(tx.merchant)}`}
                className="font-semibold text-slate-900 hover:text-blue-600 hover:underline transition truncate block"
              >
                {tx.merchant}
              </Link>
              <p className="text-sm text-slate-500">
                {tx.date} ·{' '}
                <Link
                  href={`/cards/${encodeURIComponent(tx.card)}`}
                  className="hover:text-blue-500 hover:underline transition"
                >
                  {CARD_LABELS[tx.card] ?? tx.card}
                </Link>
                {' · '}{tx.category}
                {tx.deductible && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 inline-block">
                    Business
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <p
                className={`font-bold text-lg ${
                  tx.type === 'credit' ? 'text-green-600' : 'text-slate-900'
                }`}
              >
                {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
              </p>
              <TransactionMenu
                category={tx.category}
                deductible={tx.deductible}
                ignored={tx.ignored ?? false}
                date={tx.date}
                categories={categories}
                saving={saving === tx.id}
                onCategoryChange={(cat) => handleCategoryChange(tx, cat)}
                onDeductibleToggle={() => handleDeductibleToggle(tx)}
                onIgnore={() => handleIgnore(tx)}
                onDateChange={(date, month, year) => handleDateChange(tx, date, month, year)}
              />
            </div>
          </div>
        ))}
      </div>

      {limit !== 'all' && totalPages > 1 && (
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
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
