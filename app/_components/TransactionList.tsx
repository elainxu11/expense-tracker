'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Transaction, DEFAULT_CATEGORIES } from '@/lib/types';

export default function TransactionList({
  transactions,
  categories = DEFAULT_CATEGORIES,
}: {
  transactions: Transaction[];
  categories?: string[];
}) {
  const [txs, setTxs] = useState(transactions);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const handleCategoryChange = async (tx: Transaction, newCategory: string) => {
    const rowIndex = parseInt(tx.id.replace('tx-', ''), 10);
    setSaving(tx.id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex, category: newCategory }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setTxs((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, category: newCategory } : t))
      );
    } catch {
      alert('Failed to update category. Please try again.');
    } finally {
      setSaving(null);
      setEditing(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm divide-y divide-slate-100">
      {txs.map((tx) => (
        <div key={tx.id} className="flex items-center justify-between px-6 py-4">
          <div className="flex-1 min-w-0">
            <Link
              href={`/merchants/${encodeURIComponent(tx.merchant)}`}
              className="font-semibold text-slate-900 hover:text-blue-600 hover:underline transition truncate"
            >
              {tx.merchant}
            </Link>
            <p className="text-sm text-slate-500">{tx.date} · {tx.card}</p>
          </div>
          <div className="ml-6 flex items-center gap-4">
            {editing === tx.id ? (
              <select
                autoFocus
                defaultValue={tx.category}
                disabled={saving === tx.id}
                onChange={(e) => handleCategoryChange(tx, e.target.value)}
                onBlur={() => setEditing(null)}
                className="px-2 py-1 rounded-lg border-2 border-blue-400 text-sm font-semibold text-slate-800 focus:outline-none"
              >
                {categories.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            ) : (
              <button
                onClick={() => setEditing(tx.id)}
                className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800 transition"
                title="Click to change category"
              >
                {saving === tx.id ? '...' : tx.category}
              </button>
            )}
            <p className={`font-bold text-lg w-24 text-right ${tx.type === 'credit' ? 'text-green-600' : 'text-slate-900'}`}>
              {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
