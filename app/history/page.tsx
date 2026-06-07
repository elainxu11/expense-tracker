'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { UploadSession, DEFAULT_CATEGORIES } from '@/lib/types';

const CARD_LABELS: Record<string, string> = {
  amex: 'American Express',
  'capital-one': 'Capital One Venture X',
  discover: 'Discover',
  venmo: 'Venmo',
  'wells-fargo': 'Wells Fargo Autograph',
  bofa: 'Bank of America',
  other: 'Other / Miscellaneous',
};

export default function HistoryPage() {
  const [activeTab, setActiveTab] = useState<'unsaved' | 'saved'>('unsaved');
  const [sessions, setSessions] = useState<UploadSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState<string | null>(null);
  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [committed, setCommitted] = useState<string | null>(null);
  const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);

  const [searchQuery, setSearchQuery] = useState('');

  const [editingTx, setEditingTx] = useState<{ sessionId: string; txIndex: number } | null>(null);
  const [savingTx, setSavingTx] = useState<{ sessionId: string; txIndex: number } | null>(null);
  const [selectMode, setSelectMode] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [confirmDeleteTx, setConfirmDeleteTx] = useState(false);
  const [deletingTxs, setDeletingTxs] = useState(false);
  const [confirmRemoveLog, setConfirmRemoveLog] = useState<string | null>(null);

  type SortCol = 'date' | 'merchant' | 'category' | 'amount';
  const [sortState, setSortState] = useState<Record<string, { col: SortCol; dir: 'asc' | 'desc' }>>({});
  const [editingLabel, setEditingLabel] = useState<{ sessionId: string; value: string } | null>(null);
  const [savingLabel, setSavingLabel] = useState<string | null>(null);
  const [openMenu, setOpenMenu] = useState<{ sessionId: string; txIndex: number } | null>(null);
  const [togglingDeductible, setTogglingDeductible] = useState<{ sessionId: string; txIndex: number } | null>(null);
  const [togglingIgnored, setTogglingIgnored] = useState<{ sessionId: string; txIndex: number } | null>(null);

  useEffect(() => {
    fetchSessions();
    fetch('/api/settings')
      .then((r) => r.json())
      .then((d) => { if (d.categories?.length) setCategories(d.categories); })
      .catch(() => {});
  }, []);

  async function fetchSessions() {
    setLoading(true);
    try {
      const res = await fetch('/api/upload-history');
      const data = await res.json();
      setSessions(data);
    } catch {
      setError('Failed to load history');
    } finally {
      setLoading(false);
    }
  }

  async function handleCommit(id: string) {
    setCommitting(id);
    setError('');
    try {
      const res = await fetch(`/api/upload-history/${id}/commit`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to commit');
      }
      setCommitted(id);
      await fetchSessions();
      setActiveTab('saved');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to commit to Google Sheets');
    } finally {
      setCommitting(null);
    }
  }

  async function handleDeleteSession(id: string) {
    setDeletingSession(id);
    setError('');
    try {
      const res = await fetch(`/api/upload-history/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setSessions((prev) => prev.filter((s) => s.id !== id));
      if (selectMode === id) exitSelectMode();
    } catch {
      setError('Failed to delete session');
    } finally {
      setDeletingSession(null);
    }
  }

  async function handleCategoryChange(sessionId: string, txIndex: number, category: string) {
    setSavingTx({ sessionId, txIndex });
    try {
      const res = await fetch(`/api/upload-history/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-category', txIndex, category }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const data = await res.json();
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId && data.session ? data.session : s))
      );
      setEditingTx(null);
    } catch {
      alert('Failed to update category. Please try again.');
    } finally {
      setSavingTx(null);
    }
  }

  async function handleDeleteTransactions(sessionId: string) {
    setDeletingTxs(true);
    const txIndices = [...selected];
    try {
      const res = await fetch(`/api/upload-history/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', txIndices }),
      });
      if (!res.ok) throw new Error('Failed to delete');
      const { session: updated } = await res.json();
      setSessions((prev) => {
        if (!updated || updated.transactions.length === 0) {
          return prev.filter((s) => s.id !== sessionId);
        }
        return prev.map((s) => (s.id === sessionId ? updated : s));
      });
      exitSelectMode();
    } catch {
      alert('Failed to delete transactions. Please try again.');
      setConfirmDeleteTx(false);
    } finally {
      setDeletingTxs(false);
    }
  }

  function enterSelectMode(sessionId: string) {
    setSelectMode(sessionId);
    setSelected(new Set());
    setConfirmDeleteTx(false);
    setEditingTx(null);
  }

  function exitSelectMode() {
    setSelectMode(null);
    setSelected(new Set());
    setConfirmDeleteTx(false);
  }

  function toggleSelect(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  function handleTabChange(tab: 'unsaved' | 'saved') {
    exitSelectMode();
    setEditingTx(null);
    setActiveTab(tab);
  }

  function handleSort(sessionId: string, col: SortCol) {
    setSortState((prev) => {
      const cur = prev[sessionId];
      if (cur?.col === col) {
        return { ...prev, [sessionId]: { col, dir: cur.dir === 'asc' ? 'desc' : 'asc' } };
      }
      return { ...prev, [sessionId]: { col, dir: 'asc' } };
    });
  }

  function sortedTransactions(sessionId: string, txs: UploadSession['transactions']) {
    const s = sortState[sessionId];
    const indexed = txs.map((tx, i) => ({ tx, originalIndex: i }));
    if (!s) return indexed;
    return [...indexed].sort(({ tx: a }, { tx: b }) => {
      let cmp = 0;
      if (s.col === 'date') cmp = a.date.localeCompare(b.date);
      else if (s.col === 'merchant') cmp = a.merchant.localeCompare(b.merchant);
      else if (s.col === 'category') cmp = a.category.localeCompare(b.category);
      else if (s.col === 'amount') cmp = a.amount - b.amount;
      return s.dir === 'asc' ? cmp : -cmp;
    });
  }

  function matchesSearch(tx: UploadSession['transactions'][number], query: string) {
    if (!query.trim()) return true;
    const q = query.toLowerCase().trim();
    return (
      tx.merchant.toLowerCase().includes(q) ||
      tx.category.toLowerCase().includes(q) ||
      tx.date.toLowerCase().includes(q) ||
      tx.amount.toFixed(2).includes(q)
    );
  }

  function handleSearchChange(value: string) {
    setSearchQuery(value);
    if (value && selectMode) exitSelectMode();
  }

  async function handleRenameLabel(sessionId: string) {
    if (!editingLabel || editingLabel.sessionId !== sessionId) return;
    const label = editingLabel.value.trim();
    if (!label) return;
    setSavingLabel(sessionId);
    try {
      const res = await fetch(`/api/upload-history/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', label }),
      });
      if (!res.ok) throw new Error('Failed to rename');
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, cardLabel: label } : s))
      );
      setEditingLabel(null);
    } catch {
      alert('Failed to save title. Please try again.');
    } finally {
      setSavingLabel(null);
    }
  }

  async function handleToggleDeductible(sessionId: string, txIndex: number) {
    setTogglingDeductible({ sessionId, txIndex });
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/upload-history/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-deductible', txIndex }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const { session: updated } = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch {
      alert('Failed to update. Please try again.');
    } finally {
      setTogglingDeductible(null);
    }
  }

  async function handleToggleIgnored(sessionId: string, txIndex: number) {
    setTogglingIgnored({ sessionId, txIndex });
    setOpenMenu(null);
    try {
      const res = await fetch(`/api/upload-history/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle-ignored', txIndex }),
      });
      if (!res.ok) throw new Error('Failed to update');
      const { session: updated } = await res.json();
      setSessions((prev) => prev.map((s) => (s.id === sessionId ? updated : s)));
    } catch {
      alert('Failed to update. Please try again.');
    } finally {
      setTogglingIgnored(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold text-slate-900">Upload History</h1>
        <p className="text-xl text-slate-600">Loading...</p>
      </div>
    );
  }

  const unsavedSessions = sessions.filter((s) => !s.committed);
  const savedSessions = sessions.filter((s) => s.committed);
  const activeSessions = activeTab === 'unsaved' ? unsavedSessions : savedSessions;
  const filteredSessions = searchQuery.trim()
    ? activeSessions.filter((s) => s.transactions.some((tx) => matchesSearch(tx, searchQuery)))
    : activeSessions;

  return (
    <div className="space-y-6">
      {(editingTx || openMenu) && (
        <div className="fixed inset-0 z-10" onClick={() => { setEditingTx(null); setOpenMenu(null); }} />
      )}

      {confirmRemoveLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl border-4 border-slate-200 p-8 shadow-2xl max-w-sm w-full mx-4 space-y-6">
            <div className="space-y-2">
              <p className="text-xl font-bold text-slate-900">Remove from log?</p>
              <p className="text-sm text-slate-500">
                This permanently deletes all associated data from Google Sheets (transactions, income, and savings) and removes the record from your history log.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  handleDeleteSession(confirmRemoveLog);
                  setConfirmRemoveLog(null);
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition"
              >
                Remove
              </button>
              <button
                onClick={() => setConfirmRemoveLog(null)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold text-slate-900">Upload History</h1>
        <Link
          href="/upload"
          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-lg"
        >
          + New Upload
        </Link>
      </div>

      {committed && (
        <div className="p-4 bg-green-100 border-4 border-green-400 rounded-xl text-green-900 font-semibold text-lg">
          Saved to Google Sheets successfully.
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-100 border-4 border-red-300 rounded-xl text-red-900 font-semibold text-lg">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b-2 border-slate-200">
        <button
          onClick={() => handleTabChange('unsaved')}
          className={`px-6 py-3 text-sm font-bold border-b-2 -mb-0.5 transition ${
            activeTab === 'unsaved'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Unsaved
          {unsavedSessions.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700">
              {unsavedSessions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('saved')}
          className={`px-6 py-3 text-sm font-bold border-b-2 -mb-0.5 transition ${
            activeTab === 'saved'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Saved
          {savedSessions.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600">
              {savedSessions.length}
            </span>
          )}
        </button>
      </div>

      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          placeholder="Search transactions by merchant, category, date, or amount…"
          className="w-full px-4 py-2.5 pl-10 border-2 border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 transition"
        />
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none">⌕</span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition text-lg leading-none"
          >
            ×
          </button>
        )}
      </div>

      {filteredSessions.length === 0 ? (
        <div className="text-center py-20 bg-slate-50 rounded-2xl border-4 border-slate-200">
          {searchQuery.trim() ? (
            <>
              <p className="text-2xl font-bold text-slate-500">No matching transactions</p>
              <p className="text-lg text-slate-400 mt-2">Try a different search term.</p>
            </>
          ) : activeTab === 'unsaved' ? (
            <>
              <p className="text-2xl font-bold text-slate-500">No pending uploads</p>
              <p className="text-lg text-slate-400 mt-2">
                Complete an upload to review before saving to Google Sheets.
              </p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-slate-500">No saved uploads yet</p>
              <p className="text-lg text-slate-400 mt-2">
                Saved uploads appear here after committing to Google Sheets.
              </p>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => {
            const label = session.cardLabel || CARD_LABELS[session.card] || session.card;
            const isCommitting = committing === session.id;
            const isDeletingSession = deletingSession === session.id;
            const isSelectMode = selectMode === session.id;
            const txCount = session.transactions.length;
            const allSelected = txCount > 0 && selected.size === txCount;
            const committedDate = session.committedAt
              ? new Date(session.committedAt).toLocaleString()
              : null;
            const savedDate = new Date(session.savedAt).toLocaleString();

            return (
              <div key={session.id} className="bg-white border-4 border-slate-200 rounded-2xl p-6 space-y-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    {editingLabel?.sessionId === session.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          value={editingLabel.value}
                          onChange={(e) => setEditingLabel({ sessionId: session.id, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameLabel(session.id);
                            if (e.key === 'Escape') setEditingLabel(null);
                          }}
                          className="text-xl font-bold text-slate-900 border-2 border-blue-400 rounded-lg px-2 py-0.5 outline-none w-56"
                        />
                        <button
                          onClick={() => handleRenameLabel(session.id)}
                          disabled={savingLabel === session.id}
                          className="px-3 py-1 text-sm font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {savingLabel === session.id ? '...' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingLabel(null)}
                          className="px-3 py-1 text-sm font-semibold bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <p className="text-2xl font-bold text-slate-900">{label}</p>
                        <button
                          onClick={() => setEditingLabel({ sessionId: session.id, value: label })}
                          className="text-slate-400 hover:text-slate-600 transition"
                          title="Edit title"
                        >
                          ✎
                        </button>
                      </div>
                    )}
                    <p className="text-sm text-slate-500">
                      {session.committed
                        ? `Committed ${committedDate}`
                        : `Pending · uploaded ${savedDate}`}
                    </p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xl font-bold text-slate-900">
                      ${session.totalAmount.toFixed(2)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {session.expenseCount} expense{session.expenseCount !== 1 ? 's' : ''}
                      {session.creditCount > 0 &&
                        ` · ${session.creditCount} credit${session.creditCount !== 1 ? 's' : ''}`}
                    </p>
                  </div>
                </div>

                <details
                  className="group"
                  onToggle={(e) => {
                    if (!(e.target as HTMLDetailsElement).open && selectMode === session.id) {
                      exitSelectMode();
                    }
                  }}
                >
                  <summary className="cursor-pointer text-sm font-semibold text-blue-600 hover:text-blue-800 list-none">
                    {(() => {
                      const visibleCount = searchQuery.trim()
                        ? session.transactions.filter((tx) => matchesSearch(tx, searchQuery)).length
                        : txCount;
                      return visibleCount === txCount
                        ? `View ${txCount} transaction${txCount !== 1 ? 's' : ''}`
                        : `Showing ${visibleCount} of ${txCount} transaction${txCount !== 1 ? 's' : ''}`;
                    })()} <span className="inline-block transition-transform duration-200 group-open:rotate-90">›</span>
                  </summary>
                  <div className="mt-3 space-y-2">
                    {/* Select toolbar */}
                    <div className="flex items-center justify-between min-h-[2rem]">
                      {isSelectMode ? (
                        <>
                          <div className="flex items-center gap-3">
                            <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-slate-700">
                              <input
                                type="checkbox"
                                checked={allSelected}
                                onChange={() =>
                                  allSelected
                                    ? setSelected(new Set())
                                    : setSelected(new Set(session.transactions.map((_, i) => i)))
                                }
                                className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                              />
                              {allSelected ? 'Deselect all' : 'Select all'}
                            </label>
                            {selected.size > 0 && (
                              <span className="text-sm text-slate-500">{selected.size} selected</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            {selected.size > 0 && !confirmDeleteTx && (
                              <button
                                onClick={() => setConfirmDeleteTx(true)}
                                className="px-4 py-1.5 rounded-lg bg-red-100 text-red-700 text-sm font-semibold hover:bg-red-200 transition"
                              >
                                Delete {selected.size}
                              </button>
                            )}
                            {confirmDeleteTx && (
                              <>
                                <span className="text-sm text-red-700 font-medium">
                                  Delete {selected.size} transaction{selected.size !== 1 ? 's' : ''}
                                  {session.committed ? ' from Google Sheets?' : '?'}
                                </span>
                                <button
                                  onClick={() => handleDeleteTransactions(session.id)}
                                  disabled={deletingTxs}
                                  className="px-4 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-50 transition"
                                >
                                  {deletingTxs ? 'Deleting...' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteTx(false)}
                                  disabled={deletingTxs}
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
                          onClick={() => enterSelectMode(session.id)}
                          className="ml-auto px-4 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-semibold hover:bg-slate-200 transition"
                        >
                          Select
                        </button>
                      )}
                    </div>

                    {/* Income rows (checking sessions only) */}
                    {session.incomeRows && session.incomeRows.length > 0 && (
                      <div className="border-2 border-indigo-100 rounded-xl overflow-hidden mt-3">
                        <div className="bg-indigo-50 px-4 py-2 border-b border-indigo-100">
                          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wide">Income / Credits — {session.incomeRows.length} entries</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-indigo-50/50">
                            <tr>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Date</th>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Description</th>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Source</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.incomeRows.map((inc, idx) => (
                              <tr key={idx} className="border-t border-indigo-50">
                                <td className="px-4 py-2 text-slate-700">{inc.date}</td>
                                <td className="px-4 py-2 text-slate-600 text-xs">{inc.description || '—'}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    inc.source === 'W2' ? 'bg-indigo-100 text-indigo-700' :
                                    inc.source === 'Efuture' ? 'bg-violet-100 text-violet-700' :
                                    'bg-green-100 text-green-700'
                                  }`}>{inc.source}</span>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-indigo-800">+${inc.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Savings/investment rows (checking sessions only) */}
                    {session.savingsRows && session.savingsRows.length > 0 && (
                      <div className="border-2 border-emerald-100 rounded-xl overflow-hidden mt-3">
                        <div className="bg-emerald-50 px-4 py-2 border-b border-emerald-100">
                          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">Savings & Investments — {session.savingsRows.length} entries</span>
                        </div>
                        <table className="w-full text-sm">
                          <thead className="bg-emerald-50/50">
                            <tr>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Date</th>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Institution</th>
                              <th className="px-4 py-2 text-left font-bold text-slate-600">Type</th>
                              <th className="px-4 py-2 text-right font-bold text-slate-600">Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.savingsRows.map((sav, idx) => (
                              <tr key={idx} className="border-t border-emerald-50">
                                <td className="px-4 py-2 text-slate-700">{sav.date}</td>
                                <td className="px-4 py-2 text-slate-900 font-medium">{sav.institution}</td>
                                <td className="px-4 py-2">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                                    sav.entryType === 'investment' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                                  }`}>{sav.entryType === 'investment' ? 'Investment' : 'HY Savings'}</span>
                                </td>
                                <td className="px-4 py-2 text-right font-semibold text-emerald-800">${sav.amount.toFixed(2)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Transaction table */}
                    <div className="border-2 border-slate-100 rounded-xl overflow-visible">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            {isSelectMode && <th className="w-10 px-3" />}
                            {(['date', 'merchant', 'category', 'amount'] as SortCol[]).map((col) => {
                              const active = sortState[session.id]?.col === col;
                              const dir = sortState[session.id]?.dir;
                              const arrow = active ? (dir === 'asc' ? ' ↑' : ' ↓') : '';
                              const isRight = col === 'amount';
                              return (
                                <th key={col} className={`px-4 py-2 font-bold text-slate-600 ${isRight ? 'text-right' : 'text-left'}`}>
                                  <button
                                    onClick={() => handleSort(session.id, col)}
                                    className={`hover:text-slate-900 transition capitalize ${active ? 'text-blue-600' : ''}`}
                                  >
                                    {col.charAt(0).toUpperCase() + col.slice(1)}{arrow}
                                  </button>
                                </th>
                              );
                            })}
                            <th className="w-8" />
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTransactions(session.id, session.transactions)
                            .filter(({ tx }) => matchesSearch(tx, searchQuery))
                            .map(({ tx, originalIndex: i }) => {
                            const isEditing =
                              editingTx?.sessionId === session.id && editingTx?.txIndex === i;
                            const isSaving =
                              savingTx?.sessionId === session.id && savingTx?.txIndex === i;
                            const isChecked = isSelectMode && selected.has(i);
                            return (
                              <tr
                                key={i}
                                className={`border-t border-slate-100 ${isChecked ? 'bg-blue-50' : ''}`}
                              >
                                {isSelectMode && (
                                  <td className="px-3 py-2">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => toggleSelect(i)}
                                      className="w-4 h-4 rounded border-slate-300 accent-blue-600"
                                    />
                                  </td>
                                )}
                                <td className="px-4 py-2 text-slate-700">{tx.date}</td>
                                <td className="px-4 py-2 text-slate-900 font-medium">{tx.merchant}</td>
                                <td className="px-4 py-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                  <div className="relative inline-block">
                                    <button
                                      onClick={() =>
                                        !isSelectMode &&
                                        setEditingTx({ sessionId: session.id, txIndex: i })
                                      }
                                      disabled={isSelectMode}
                                      className={`px-2 py-0.5 rounded-full text-xs font-semibold transition disabled:cursor-default ${
                                        tx.ignored
                                          ? 'bg-slate-100 text-slate-400 hover:bg-blue-100 hover:text-blue-800 disabled:hover:bg-slate-100 disabled:hover:text-slate-400'
                                          : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800 disabled:hover:bg-slate-100 disabled:hover:text-slate-700'
                                      }`}
                                      title={isSelectMode ? undefined : tx.ignored ? 'Ignored — click to set a category and un-ignore' : 'Click to change category'}
                                    >
                                      {isSaving ? '...' : tx.category}
                                    </button>
                                    {isEditing && (
                                      <div className="absolute left-0 bottom-full mb-1 z-20 bg-white border-2 border-blue-400 rounded-xl shadow-xl p-3 w-64">
                                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                                          {tx.ignored ? 'Set category to un-ignore' : 'Category'}
                                        </p>
                                        <div className="flex flex-wrap gap-1.5">
                                          {categories.map((cat) => (
                                            <button
                                              key={cat}
                                              onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleCategoryChange(session.id, i, cat);
                                              }}
                                              className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                                                tx.category === cat
                                                  ? 'bg-blue-600 text-white'
                                                  : 'bg-slate-100 text-slate-700 hover:bg-blue-100 hover:text-blue-800'
                                              } ${isSaving ? 'opacity-50 pointer-events-none' : ''}`}
                                            >
                                              {cat}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  {tx.ignored && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-200 text-slate-500">
                                      Ignored
                                    </span>
                                  )}
                                  {tx.deductible && !tx.ignored && (
                                    <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                                      Business Expense
                                    </span>
                                  )}
                                  </div>
                                </td>
                                <td
                                  className={`px-4 py-2 text-right font-semibold ${
                                    tx.type === 'credit' ? 'text-green-700' : 'text-slate-900'
                                  }`}
                                >
                                  {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
                                </td>
                                <td className="px-2 py-2 relative">
                                  {!isSelectMode && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setOpenMenu(
                                            openMenu?.sessionId === session.id && openMenu?.txIndex === i
                                              ? null
                                              : { sessionId: session.id, txIndex: i }
                                          );
                                          setEditingTx(null);
                                        }}
                                        className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100 transition text-base leading-none"
                                        title="More options"
                                      >
                                        ···
                                      </button>
                                      {openMenu?.sessionId === session.id && openMenu?.txIndex === i && (
                                        <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-lg shadow-lg py-1 w-52">
                                          <button
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              setOpenMenu(null);
                                              setEditingTx({ sessionId: session.id, txIndex: i });
                                            }}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition"
                                          >
                                            Edit category
                                          </button>
                                          <button
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleToggleDeductible(session.id, i);
                                            }}
                                            disabled={togglingDeductible?.sessionId === session.id && togglingDeductible?.txIndex === i}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition"
                                          >
                                            {togglingDeductible?.sessionId === session.id && togglingDeductible?.txIndex === i
                                              ? 'Updating...'
                                              : tx.deductible
                                              ? 'Remove business expense'
                                              : 'Mark as business expense'}
                                          </button>
                                          <button
                                            onMouseDown={(e) => {
                                              e.preventDefault();
                                              handleToggleIgnored(session.id, i);
                                            }}
                                            disabled={togglingIgnored?.sessionId === session.id && togglingIgnored?.txIndex === i}
                                            className="w-full text-left px-4 py-2 text-sm text-slate-500 hover:bg-slate-50 disabled:opacity-50 transition border-t border-slate-100"
                                          >
                                            {togglingIgnored?.sessionId === session.id && togglingIgnored?.txIndex === i
                                              ? 'Updating...'
                                              : tx.ignored
                                              ? 'Un-ignore transaction'
                                              : 'Ignore transaction'}
                                          </button>
                                        </div>
                                      )}
                                    </>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </details>

                {/* Action buttons */}
                {!session.committed ? (
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => handleCommit(session.id)}
                      disabled={isCommitting || isDeletingSession}
                      className="flex-1 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isCommitting ? 'Saving to Google Sheets...' : 'Save to Google Sheets'}
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={isCommitting || isDeletingSession}
                      className="px-6 py-3 bg-white text-red-600 border-4 border-red-200 rounded-xl hover:bg-red-50 font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeletingSession ? 'Discarding...' : 'Discard'}
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setConfirmRemoveLog(session.id)}
                      disabled={isDeletingSession}
                      className="px-4 py-2 text-sm bg-white text-slate-400 border-2 border-slate-200 rounded-lg hover:bg-slate-50 hover:text-slate-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isDeletingSession ? 'Removing...' : 'Remove from log'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
