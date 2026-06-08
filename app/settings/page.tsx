import { getSettings, getTransactions, getDefaultBudget, getIncome, getBucketMapping } from '@/lib/googleSheets';
import { IncomeEntry, BucketKey } from '@/lib/types';
import SettingsClient from './_components/SettingsClient';
import VendorRulesClient from './_components/VendorRulesClient';
import BudgetSplitClient from './_components/BudgetSplitClient';

export default async function SettingsPage() {
  const currentYear = String(new Date().getFullYear());

  const [settings, transactions, defaultBudget, allIncome, bucketMapping] = await Promise.all([
    getSettings(),
    getTransactions(),
    getDefaultBudget(currentYear),
    getIncome(),
    getBucketMapping(),
  ]);

  const categoryCounts: Record<string, number> = {};
  for (const tx of transactions.filter((t) => t.type === 'expense')) {
    categoryCounts[tx.category] = (categoryCounts[tx.category] || 0) + 1;
  }

  const cards = settings.cards.length > 0
    ? settings.cards
    : [...new Set(transactions.map((t) => t.card).filter(Boolean))].sort();

  const availableYears = [...new Set([
    ...transactions.map((t) => t.year),
    ...(allIncome as IncomeEntry[]).map((e) => e.year),
    currentYear,
  ])].filter(Boolean).sort().reverse();

  return (
    <div className="space-y-8">
      <SettingsClient
        initialCategories={settings.categories}
        initialCards={cards}
        categoryCounts={categoryCounts}
      />
      <BudgetSplitClient
        categories={settings.categories}
        initialAmounts={defaultBudget}
        initialMapping={bucketMapping as Record<BucketKey, string[]>}
        allIncome={allIncome as IncomeEntry[]}
        initialYear={currentYear}
        availableYears={availableYears}
      />
      <VendorRulesClient />
    </div>
  );
}
