'use client';

import { useState } from 'react';

export interface MerchantSummary {
  merchant: string;
  topCategory: string;
  totalAmount: number;
  txCount: number;
  deductible: boolean;
}

export default function MerchantDeductibleList({ merchants: initial }: { merchants: MerchantSummary[] }) {
  const [merchants, setMerchants] = useState(initial);
  const [saving, setSaving] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const toggle = async (merchant: string, current: boolean) => {
    setSaving(merchant);
    setMerchants((prev) =>
      prev.map((m) => (m.merchant === merchant ? { ...m, deductible: !current } : m))
    );
    try {
      await fetch('/api/save-merchant-mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant, deductible: !current }),
      });
    } catch {
      setMerchants((prev) =>
        prev.map((m) => (m.merchant === merchant ? { ...m, deductible: current } : m))
      );
    } finally {
      setSaving(null);
    }
  };

  const filtered = merchants.filter((m) =>
    m.merchant.toLowerCase().includes(query.toLowerCase())
  );

  const deductibleCount = merchants.filter((m) => m.deductible).length;
  const deductibleTotal = merchants
    .filter((m) => m.deductible)
    .reduce((s, m) => s + m.totalAmount, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <input
          type="text"
          placeholder="Search merchants..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 px-4 py-2 rounded-lg border-2 border-slate-200 focus:outline-none focus:border-blue-400 text-sm"
        />
        <div className="text-sm text-slate-500 shrink-0">
          <span className="font-semibold text-green-700">{deductibleCount}</span> deductible ·{' '}
          <span className="font-semibold text-green-700">${deductibleTotal.toFixed(2)}</span> total
        </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-4 px-5 py-2.5 bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wide">
          <span>Merchant</span>
          <span className="text-right">Category</span>
          <span className="text-right">Total</span>
          <span className="text-right">Tax Status</span>
        </div>
        <div className="divide-y divide-slate-100">
          {filtered.map((m) => (
            <div key={m.merchant} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 items-center px-5 py-3 hover:bg-slate-50">
              <span className="font-medium text-slate-900 truncate">{m.merchant}</span>
              <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium whitespace-nowrap">
                {m.topCategory}
              </span>
              <span className="text-sm font-semibold text-slate-700 text-right whitespace-nowrap">
                ${m.totalAmount.toFixed(2)}
                <span className="text-slate-400 font-normal ml-1">({m.txCount})</span>
              </span>
              <div className="flex justify-end">
                <button
                  onClick={() => toggle(m.merchant, m.deductible)}
                  disabled={saving === m.merchant}
                  className={`flex rounded-lg border-2 overflow-hidden text-xs font-bold transition-opacity ${saving === m.merchant ? 'opacity-50' : ''}`}
                >
                  <span className={`px-3 py-1.5 transition ${!m.deductible ? 'bg-slate-200 text-slate-700' : 'bg-white text-slate-400'}`}>
                    No
                  </span>
                  <span className={`px-3 py-1.5 transition ${m.deductible ? 'bg-green-500 text-white' : 'bg-white text-slate-400'}`}>
                    Deductible
                  </span>
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-8 text-center text-slate-400 text-sm">No merchants found</div>
          )}
        </div>
      </div>
    </div>
  );
}
