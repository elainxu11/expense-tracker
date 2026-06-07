import { getTransactions, getSettings } from '@/lib/googleSheets';
import Link from 'next/link';
import { Transaction } from '@/lib/types';
import CategoryTransactionList from './_components/CategoryTransactionList';
import CategoryMonthlyChart from './_components/CategoryMonthlyChart';

const CARD_LABELS: Record<string, string> = {
  amex: 'American Express',
  'capital-one': 'Capital One Venture X',
  discover: 'Discover',
  venmo: 'Venmo',
  'wells-fargo': 'Wells Fargo Autograph',
  bofa: 'Bank of America',
  other: 'Other',
};

function groupByCard(txs: Transaction[]) {
  const groups: Record<string, Transaction[]> = {};
  for (const tx of txs) {
    if (!groups[tx.card]) groups[tx.card] = [];
    groups[tx.card].push(tx);
  }
  return Object.entries(groups)
    .map(([card, cardTxs]) => ({
      card,
      label: CARD_LABELS[card] ?? card,
      txs: cardTxs,
      total: cardTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0),
    }))
    .sort((a, b) => b.total - a.total);
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const category = decodeURIComponent(name);

  const [all, settings] = await Promise.all([getTransactions(), getSettings()]);

  const txs = all
    .filter((t) => t.category === category)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSpent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const totalCredits = txs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);

  const cardGroups = groupByCard(txs);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition"
        >
          ← Dashboard
        </Link>
      </div>

      <div>
        <h1 className="text-4xl font-bold text-slate-900">{category}</h1>
        <p className="text-slate-500 mt-1">
          {txs.length} transaction{txs.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200 shadow">
          <p className="text-sm font-semibold text-blue-900 mb-2">Total Spent</p>
          <p className="text-4xl font-bold text-blue-900">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-900 mb-2">Total Credits</p>
          <p className="text-4xl font-bold text-green-900">+${totalCredits.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200 shadow">
          <p className="text-sm font-semibold text-purple-900 mb-2">Transactions</p>
          <p className="text-4xl font-bold text-purple-900">{txs.length}</p>
        </div>
      </div>

      <CategoryMonthlyChart txs={txs} category={category} />

      <CategoryTransactionList cardGroups={cardGroups} categories={settings.categories} />
    </div>
  );
}