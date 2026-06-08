import { getTransactions, getSettings } from '@/lib/googleSheets';
import Link from 'next/link';
import MerchantTransactionList from '@/app/_components/MerchantTransactionList';

const CARD_LABELS: Record<string, string> = {
  amex: 'American Express',
  'capital-one': 'Capital One Venture X',
  discover: 'Discover',
  venmo: 'Venmo',
  'wells-fargo': 'Wells Fargo Autograph',
  bofa: 'Bank of America',
  other: 'Other',
};

function groupByYear(txs: { date: string; year: string; amount: number }[]) {
  const totals: Record<string, number> = {};
  for (const tx of txs) {
    totals[tx.year] = (totals[tx.year] || 0) + tx.amount;
  }
  return Object.entries(totals)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([year, total]) => ({ year, total }));
}

export default async function CardCreditsPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const card = decodeURIComponent(name);

  const [all, settings] = await Promise.all([getTransactions(), getSettings()]);
  const credits = all
    .filter((t) => t.card === card && t.type === 'credit')
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const total = credits.reduce((s, t) => s + t.amount, 0);
  const yearTotals = groupByYear(credits);
  const cardLabel = CARD_LABELS[card] ?? card;

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
        <h1 className="text-4xl font-bold text-slate-900">{cardLabel}</h1>
        <p className="text-slate-500 mt-1">
          Credits · {credits.length} transaction{credits.length !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-900 mb-2">Total Credits</p>
          <p className="text-4xl font-bold text-green-900">+${total.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200 shadow">
          <p className="text-sm font-semibold text-purple-900 mb-2">Transactions</p>
          <p className="text-4xl font-bold text-purple-900">{credits.length}</p>
        </div>
      </div>

      {yearTotals.length > 0 && (
        <div>
          <h2 className="text-lg font-bold text-slate-700 mb-3">By Year</h2>
          <div className="flex flex-wrap gap-4">
            {yearTotals.map(({ year, total: yearTotal }) => (
              <div
                key={year}
                className="bg-white rounded-xl border-2 border-slate-200 px-6 py-4 shadow-sm min-w-[140px]"
              >
                <p className="text-sm font-semibold text-slate-500">{year}</p>
                <p className="text-2xl font-bold text-green-700">+${yearTotal.toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {credits.length > 0 ? (
        <MerchantTransactionList transactions={credits} categories={settings.categories} />
      ) : (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-8 text-center">
          <p className="text-slate-400 font-medium">No credits found for this card</p>
        </div>
      )}
    </div>
  );
}
