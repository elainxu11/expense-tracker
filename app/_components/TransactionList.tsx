'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
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

export default function TransactionList({
  transactions,
  categories = DEFAULT_CATEGORIES,
}: {
  transactions: Transaction[];
  categories?: string[];
}) {
  const router = useRouter();
  const [txs, setTxs] = useState(transactions);
  const [editing, setEditing] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rowIndex = (id: string) => parseInt(id.replace('tx-', ''), 10);

  const handleCategoryChange = async (tx: Transaction, newCategory: string) => {
    setSaving(tx.id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: rowIndex(tx.id), category: newCategory }),
      });
      if (!res.ok) throw new Error('Failed to update');
      setTxs((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, category: newCategory } : t))
      );
      router.refresh();
    } catch {
      alert('Failed to update category. Please try again.');
    } finally {
      setSaving(null);
      setEditing(null);
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

  const handleRefundCategoryChange = async (tx: Transaction, newRefundCategory: string) => {
    setSaving(tx.id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: rowIndex(tx.id), refundCategory: newRefundCategory }),
      });
      if (!res.ok) throw new Error();
      setTxs((prev) => prev.map((t) => t.id === tx.id ? { ...t, refundCategory: newRefundCategory || undefined } : t));
      router.refresh();
    } catch {
      alert('Failed to update reimbursement category. Please try again.');
    } finally {
      setSaving(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allSelected = txs.length > 0 && selected.size === txs.length;

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(txs.map((t) => t.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setConfirmDelete(false);
  };

  const handleDelete = async () => {
    const rowIndices = [...selected].map((id) => parseInt(id.replace('tx-', ''), 10));
    setDeleting(true);
    try {
      const res = await fetch('/api/delete-transactions', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndices }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      setTxs((prev) => prev.filter((t) => !selected.has(t.id)));
      router.refresh();
      exitSelectMode();
    } catch {
      alert('Failed to delete transactions. Please try again.');
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {editing && (
        <div className="fixed inset-0 z-10" onClick={() => setEditing(null)} />
      )}
      {/* Toolbar */}
      <div className="flex items-center justify-between min-h-[2rem]">
        {selectMode ? (
          <>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                />
                {allSelected ? 'Deselect all' : 'Select all'}
              </label>
              {selected.size > 0 && (
                <span className="text-sm text-slate-500">{selected.size} selected</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {selected.size > 0 && !confirmDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="px-4 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 transition"
                >
                  Delete {selected.size}
                </button>
              )}
              {confirmDelete && (
                <>
                  <span className="text-sm text-red-700 font-medium">
                    Delete {selected.size} transaction{selected.size !== 1 ? 's' : ''}?
                  </span>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                  >
                    {deleting ? 'Deleting...' : 'Confirm'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting}
                    className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-sm font-semibold hover:bg-slate-200 disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                </>
              )}
              <button
                onClick={exitSelectMode}
                className="px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition"
              >
                Done
              </button>
            </div>
          </>
        ) : (
          <button
            onClick={() => setSelectMode(true)}
            className="ml-auto px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition"
          >
            Select
          </button>
        )}
      </div>

      {/* Transaction rows */}
      <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm divide-y divide-slate-100">
        {txs.map((tx) => (
          <div
            key={tx.id}
            className={`flex items-center justify-between px-6 py-4 gap-4 ${selectMode && selected.has(tx.id) ? 'bg-blue-50' : ''}`}
          >
            {selectMode && (
              <input
                type="checkbox"
                checked={selected.has(tx.id)}
                onChange={() => toggleSelect(tx.id)}
                className="mr-2 w-4 h-4 rounded border-slate-300 accent-blue-600 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <Link
                href={`/merchants/${encodeURIComponent(tx.merchant)}`}
                className="font-semibold text-slate-900 hover:text-blue-600 hover:underline transition truncate"
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
                {tx.deductible && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 inline-block">
                    Business
                  </span>
                )}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {/* Inline category pill — quick access */}
              {editing === tx.id ? (
                <div className="relative z-20">
                  <div className="absolute right-0 bottom-full mb-2 bg-white border-2 border-blue-400 rounded-xl shadow-xl p-3 w-72">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            handleCategoryChange(tx, cat);
                          }}
                          className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                            tx.category === cat
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800'
                          } ${saving === tx.id ? 'opacity-50 pointer-events-none' : ''}`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => !selectMode && setEditing(tx.id)}
                  className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800 transition"
                  title={selectMode ? undefined : 'Click to change category'}
                >
                  {saving === tx.id ? '...' : tx.category}
                </button>
              )}
              <p className={`font-bold text-lg w-24 text-right ${tx.type === 'credit' ? 'text-green-600' : 'text-slate-900'}`}>
                {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
              </p>
              {!selectMode && (
                <TransactionMenu
                  category={tx.category}
                  deductible={tx.deductible}
                  ignored={tx.ignored ?? false}
                  date={tx.date}
                  categories={categories}
                  saving={saving === tx.id}
                  isCredit={tx.type === 'credit'}
                  refundCategory={tx.refundCategory}
                  onCategoryChange={(cat) => handleCategoryChange(tx, cat)}
                  onDeductibleToggle={() => handleDeductibleToggle(tx)}
                  onIgnore={() => handleIgnore(tx)}
                  onDateChange={(date, month, year) => handleDateChange(tx, date, month, year)}
                  onRefundCategoryChange={(cat) => handleRefundCategoryChange(tx, cat)}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
