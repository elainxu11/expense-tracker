import { getSettings, getTransactions } from '@/lib/googleSheets';
import SettingsClient from './_components/SettingsClient';
import VendorRulesClient from './_components/VendorRulesClient';

export default async function SettingsPage() {
  const [settings, transactions] = await Promise.all([
    getSettings(),
    getTransactions(),
  ]);

  const categoryCounts: Record<string, number> = {};
  for (const tx of transactions.filter((t) => t.type === 'expense')) {
    categoryCounts[tx.category] = (categoryCounts[tx.category] || 0) + 1;
  }

  // Seed cards from transaction data if none saved yet
  const cards = settings.cards.length > 0
    ? settings.cards
    : [...new Set(transactions.map((t) => t.card).filter(Boolean))].sort();

  return (
    <div className="space-y-8">
      <SettingsClient
        initialCategories={settings.categories}
        initialCards={cards}
        categoryCounts={categoryCounts}
      />
      <VendorRulesClient />
    </div>
  );
}
