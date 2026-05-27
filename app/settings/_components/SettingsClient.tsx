'use client';

import { useState } from 'react';

interface Props {
  initialCategories: string[];
  initialCards: string[];
  categoryCounts: Record<string, number>;
}

interface PendingDelete {
  type: 'category' | 'card';
  name: string;
  count?: number;
}

async function persistSettings(updates: { categories?: string[]; cards?: string[] }) {
  await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });
}

export default function SettingsClient({ initialCategories, initialCards, categoryCounts }: Props) {
  const [categories, setCategories] = useState(initialCategories);
  const [cards, setCards] = useState(initialCards);
  const [newCategory, setNewCategory] = useState('');
  const [newCard, setNewCard] = useState('');
  const [saving, setSaving] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const save = async (updates: { categories?: string[]; cards?: string[] }) => {
    setSaving(true);
    try { await persistSettings(updates); } finally { setSaving(false); }
  };

  const handleAddCategory = async () => {
    const name = newCategory.trim();
    if (!name || categories.includes(name)) return;
    const updated = [...categories, name];
    setCategories(updated);
    setNewCategory('');
    await save({ categories: updated });
  };

  const handleDeleteCategory = (name: string) => {
    const count = categoryCounts[name] ?? 0;
    if (count > 0) {
      setPendingDelete({ type: 'category', name, count });
    } else {
      confirmDelete({ type: 'category', name });
    }
  };

  const handleAddCard = async () => {
    const name = newCard.trim();
    if (!name || cards.includes(name)) return;
    const updated = [...cards, name];
    setCards(updated);
    setNewCard('');
    await save({ cards: updated });
  };

  const handleDeleteCard = (name: string) => {
    setPendingDelete({ type: 'card', name });
  };

  const confirmDelete = async (target: PendingDelete) => {
    if (target.type === 'category') {
      const updated = categories.filter((c) => c !== target.name);
      setCategories(updated);
      setPendingDelete(null);
      await save({ categories: updated });
    } else {
      const updated = cards.filter((c) => c !== target.name);
      setCards(updated);
      setPendingDelete(null);
      await save({ cards: updated });
    }
  };

  return (
    <div className="space-y-8">
      <h1 className="text-4xl font-bold text-slate-900">Settings</h1>

      {/* Credit Cards */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Credit Cards</h2>
        <div className="space-y-2 mb-4">
          {cards.length === 0 && (
            <p className="text-sm text-slate-400">No cards added yet.</p>
          )}
          {cards.map((card) => (
            <div key={card} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-lg">
              <span className="font-medium text-slate-800">{card}</span>
              <button
                onClick={() => handleDeleteCard(card)}
                className="text-sm font-medium text-red-500 hover:text-red-700 transition"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            value={newCard}
            onChange={(e) => setNewCard(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCard()}
            placeholder="e.g. Chase Sapphire"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleAddCard}
            disabled={saving || !newCard.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
          >
            Add Card
          </button>
        </div>
      </div>

      {/* Categories */}
      <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900 mb-4">Categories</h2>
        <div className="space-y-2 mb-4">
          {categories.map((cat) => {
            const count = categoryCounts[cat] ?? 0;
            return (
              <div key={cat} className="flex items-center justify-between px-4 py-2.5 bg-slate-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="font-medium text-slate-800">{cat}</span>
                  {count > 0 && (
                    <span className="text-xs text-slate-400">
                      {count} transaction{count !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteCategory(cat)}
                  className="text-sm font-medium text-red-500 hover:text-red-700 transition"
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
        <div className="flex gap-2">
          <input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            placeholder="New category name"
            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:border-blue-400"
          />
          <button
            onClick={handleAddCategory}
            disabled={saving || !newCategory.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-40 transition"
          >
            Add Category
          </button>
        </div>
      </div>

      {/* Warning Modal */}
      {pendingDelete && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 shadow-2xl max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-slate-900 mb-3">
              {pendingDelete.type === 'category' ? 'Delete category?' : 'Remove card?'}
            </h3>
            {pendingDelete.type === 'category' && pendingDelete.count ? (
              <p className="text-slate-600 mb-6">
                <span className="font-semibold">{pendingDelete.name}</span> is currently assigned to{' '}
                <span className="font-semibold text-amber-600">
                  {pendingDelete.count} transaction{pendingDelete.count !== 1 ? 's' : ''}
                </span>
                . Deleting it removes it from this list but won&apos;t change the label on existing transactions.
              </p>
            ) : (
              <p className="text-slate-600 mb-6">
                Are you sure you want to remove{' '}
                <span className="font-semibold">{pendingDelete.name}</span>?
              </p>
            )}
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingDelete(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => confirmDelete(pendingDelete)}
                className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
              >
                {pendingDelete.type === 'category' ? 'Delete Anyway' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
