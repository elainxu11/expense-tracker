'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { UploadSession } from '@/lib/types';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function CoveragePage() {
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [cards, setCards] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());

  useEffect(() => {
    Promise.all([
      fetch('/api/upload-history').then((r) => r.json()),
      fetch('/api/settings').then((r) => r.json()),
    ])
      .then(([sessionsData, settingsData]) => {
        setSessions(sessionsData);
        setCards(settingsData.cards || []);
      })
      .finally(() => setLoading(false));
  }, []);

  const committed = useMemo(() => sessions.filter((s) => s.committed), [sessions]);

  const availableYears = useMemo(() => {
    const years = new Set<string>();
    for (const session of committed) {
      for (const tx of session.transactions) {
        if (tx.year) years.add(tx.year);
      }
      for (const row of session.incomeRows ?? []) {
        if (row.year) years.add(row.year);
      }
      for (const row of session.savingsRows ?? []) {
        if (row.year) years.add(row.year);
      }
    }
    const sorted = Array.from(years).sort((a, b) => Number(b) - Number(a));
    // always include current year
    const current = new Date().getFullYear().toString();
    if (!sorted.includes(current)) sorted.unshift(current);
    return sorted;
  }, [committed]);

  // all cards: settings + any card seen in committed sessions
  const allCards = useMemo(() => {
    const sessionCards = committed.map((s) => s.card).filter(Boolean);
    return Array.from(new Set([...cards, ...sessionCards]));
  }, [cards, committed]);

  // coverage[card] = Set<month "01"–"12"> for selectedYear
  const coverage = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const card of allCards) map[card] = new Set();
    for (const session of committed) {
      if (!session.card) continue;
      if (!map[session.card]) map[session.card] = new Set();
      for (const tx of session.transactions) {
        if (tx.year === selectedYear) map[session.card].add(tx.month);
      }
      for (const row of session.incomeRows ?? []) {
        if (row.year === selectedYear) map[session.card].add(row.month);
      }
      for (const row of session.savingsRows ?? []) {
        if (row.year === selectedYear) map[session.card].add(row.month);
      }
    }
    return map;
  }, [allCards, committed, selectedYear]);

  const coveredCount = (card: string) => coverage[card]?.size ?? 0;

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">Coverage</h1>
        <p className="text-xl text-slate-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-4xl font-bold text-slate-900">Coverage</h1>
          <p className="text-slate-500 mt-1">Months uploaded &amp; saved per card</p>
        </div>
        <div className="flex items-center gap-2">
          {availableYears.map((y) => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition ${
                selectedYear === y
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      {allCards.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border-4 border-slate-200">
          <p className="text-2xl font-bold text-slate-500">No cards configured</p>
          <p className="text-lg text-slate-400 mt-2">
            Add your credit cards in{' '}
            <Link href="/settings" className="text-blue-600 hover:underline">
              Settings
            </Link>{' '}
            to track coverage.
          </p>
        </div>
      ) : (
        <div className="bg-white border-4 border-slate-200 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b-2 border-slate-200">
                <tr>
                  <th className="text-left py-3 px-5 font-bold text-slate-600 min-w-[180px]">
                    Card
                  </th>
                  {MONTHS.map((m) => (
                    <th key={m} className="py-3 px-1 font-bold text-slate-600 text-center w-12">
                      {m}
                    </th>
                  ))}
                  <th className="py-3 px-4 font-bold text-slate-600 text-right whitespace-nowrap">
                    Covered
                  </th>
                </tr>
              </thead>
              <tbody>
                {allCards.map((card, rowIdx) => {
                  const covered = coverage[card] ?? new Set();
                  const count = covered.size;
                  return (
                    <tr
                      key={card}
                      className={`border-t border-slate-100 ${rowIdx % 2 === 1 ? 'bg-slate-50/50' : ''}`}
                    >
                      <td className="py-3 px-5 font-semibold text-slate-900">{card}</td>
                      {MONTHS.map((_, i) => {
                        const monthNum = String(i + 1).padStart(2, '0');
                        const isCovered = covered.has(monthNum);
                        return (
                          <td key={monthNum} className="py-3 px-1 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-md border-2 transition ${
                                isCovered
                                  ? 'border-green-400 bg-green-50 text-green-600'
                                  : 'border-slate-200 bg-white text-slate-200'
                              }`}
                              title={
                                isCovered
                                  ? `${MONTHS[i]} ${selectedYear} — covered`
                                  : `${MONTHS[i]} ${selectedYear} — not uploaded`
                              }
                            >
                              {isCovered ? (
                                <svg viewBox="0 0 12 12" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="2,6 5,9 10,3" />
                                </svg>
                              ) : (
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-200 block" />
                              )}
                            </span>
                          </td>
                        );
                      })}
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-bold text-sm ${
                            count === 12
                              ? 'text-green-600'
                              : count > 0
                              ? 'text-blue-600'
                              : 'text-slate-400'
                          }`}
                        >
                          {count}/12
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="border-t-2 border-slate-200 bg-slate-50">
                <tr>
                  <td className="py-3 px-5 font-bold text-slate-600">Total</td>
                  {MONTHS.map((_, i) => {
                    const monthNum = String(i + 1).padStart(2, '0');
                    const coveredCards = allCards.filter((c) => coverage[c]?.has(monthNum)).length;
                    return (
                      <td key={monthNum} className="py-3 px-1 text-center">
                        <span
                          className={`text-xs font-semibold ${
                            coveredCards === allCards.length && allCards.length > 0
                              ? 'text-green-600'
                              : coveredCards > 0
                              ? 'text-blue-500'
                              : 'text-slate-300'
                          }`}
                        >
                          {coveredCards > 0 ? `${coveredCards}/${allCards.length}` : '—'}
                        </span>
                      </td>
                    );
                  })}
                  <td className="py-3 px-4 text-right">
                    <span className="text-xs font-semibold text-slate-500">
                      {allCards.reduce((sum, c) => sum + coveredCount(c), 0)}/{allCards.length * 12}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
