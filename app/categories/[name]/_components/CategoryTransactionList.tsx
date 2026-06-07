'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Transaction } from '@/lib/types';
import TransactionMenu from '@/app/_components/TransactionMenu';

interface CardGroup {
  card: string;
  label: string;
  txs: Transaction[];
  total: number;
}

interface Props {
  cardGroups: CardGroup[];
  categories: string[];
}

export default function CategoryTransactionList({ cardGroups, categories }: Props) {
  const router = useRouter();
  const [txMap, setTxMap] = useState<Record<string, Transaction>>(() => {
    const m: Record<string, Transaction> = {};
    for (const g of cardGroups) for (const tx of g.txs) m[tx.id] = tx;
    return m;
  });
  const [saving, setSaving] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const toggleCard = (card: string) =>
    setCollapsed((prev) => ({ ...prev, [card]: !prev[card] }));

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
      setTxMap((prev) => ({ ...prev, [tx.id]: { ...prev[tx.id], category: newCategory } }));
      router.refresh();
    } catch {
      alert('Failed to update category.');
    } finally {
      setSaving(null);
    }
  };

  const handleDeductibleToggle = async (tx: Transaction) => {
    const next = !txMap[tx.id].deductible;
    setSaving(tx.id);
    try {
      const res = await fetch('/api/update-transaction', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rowIndex: rowIndex(tx.id), deductible: next }),
      });
      if (!res.ok) throw new Error();
      setTxMap((prev) => ({ ...prev, [tx.id]: { ...prev[tx.id], deductible: next } }));
      router.refresh();
    } catch {
      alert('Failed to update transaction.');
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
      setTxMap((prev) => ({ ...prev, [tx.id]: { ...prev[tx.id], date, month, year } }));
      router.refresh();
    } catch {
      alert('Failed to update date.');
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
      setTxMap((prev) => {
        const next = { ...prev };
        delete next[tx.id];
        return next;
      });
      router.refresh();
    } catch {
      alert('Failed to ignore transaction.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-6">
      {cardGroups.map(({ card, label, txs }) => {
        const liveTxs = txs.map((t) => txMap[t.id] ?? t);
        const liveTotal = liveTxs
          .filter((t) => t.type === 'expense')
          .reduce((s, t) => s + t.amount, 0);

        const isCollapsed = !!collapsed[card];

        return (
          <div key={card} className="bg-white rounded-xl border-2 border-slate-200 shadow-sm">
            <button
              onClick={() => toggleCard(card)}
              className="w-full flex items-center justify-between px-6 py-4 border-b border-slate-100 hover:bg-slate-50 transition rounded-t-xl text-left"
            >
              <Link
                href={`/cards/${encodeURIComponent(card)}`}
                onClick={(e) => e.stopPropagation()}
                className="text-lg font-bold text-slate-900 hover:text-blue-600 hover:underline transition"
              >
                {label}
              </Link>
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-400">
                  {liveTxs.length} transaction{liveTxs.length !== 1 ? 's' : ''}
                </span>
                <span className="font-bold text-slate-900">${liveTotal.toFixed(2)}</span>
                <span className="text-slate-400 text-sm">{isCollapsed ? '▶' : '▼'}</span>
              </div>
            </button>
            {!isCollapsed && (
              <div className="divide-y divide-slate-100">
                {liveTxs.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between px-6 py-4 gap-4">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/merchants/${encodeURIComponent(tx.merchant)}`}
                        className="font-semibold text-slate-900 hover:text-blue-600 hover:underline transition truncate block"
                      >
                        {tx.merchant}
                      </Link>
                      <p className="text-sm text-slate-500">
                        {tx.date}
                        {tx.deductible && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 inline-block">
                            Business
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <p className={`font-bold text-lg w-24 text-right ${tx.type === 'credit' ? 'text-green-600' : 'text-slate-900'}`}>
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
            )}
          </div>
        );
      })}
    </div>
  );
}
