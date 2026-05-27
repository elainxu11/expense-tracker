import { getTransactions } from '@/lib/googleSheets';
import Link from 'next/link';

const CARD_LABELS: Record<string, string> = {
  amex: 'American Express',
  'capital-one': 'Capital One Venture X',
  discover: 'Discover',
  venmo: 'Venmo',
  'wells-fargo': 'Wells Fargo Autograph',
  bofa: 'Bank of America',
  other: 'Other',
};

export default async function MerchantPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const merchant = decodeURIComponent(name);

  const all = await getTransactions();
  const txs = all
    .filter((t) => t.merchant === merchant)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const totalSpent = txs
    .filter((t) => t.type === 'expense')
    .reduce((s, t) => s + t.amount, 0);
  const totalCredits = txs
    .filter((t) => t.type === 'credit')
    .reduce((s, t) => s + t.amount, 0);

  const cardTotals: Record<string, number> = {};
  for (const tx of txs.filter((t) => t.type === 'expense')) {
    cardTotals[tx.card] = (cardTotals[tx.card] || 0) + tx.amount;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link
          href="/transactions"
          className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition"
        >
          ← Transactions
        </Link>
      </div>

      <div>
        <h1 className="text-4xl font-bold text-slate-900">{merchant}</h1>
        <p className="text-slate-500 mt-1">{txs.length} transaction{txs.length !== 1 ? 's' : ''}</p>
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
          <p className="text-sm font-semibold text-purple-900 mb-2">Net</p>
          <p className="text-4xl font-bold text-purple-900">
            ${(totalSpent - totalCredits).toFixed(2)}
          </p>
        </div>
      </div>

      {Object.keys(cardTotals).length > 1 && (
        <div className="bg-white rounded-xl border-2 border-slate-200 p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900 mb-4">By Card</h2>
          <div className="space-y-2">
            {Object.entries(cardTotals)
              .sort((a, b) => b[1] - a[1])
              .map(([card, total]) => (
                <div key={card} className="flex items-center justify-between">
                  <span className="text-slate-700 font-medium">
                    {CARD_LABELS[card] ?? card}
                  </span>
                  <span className="font-bold text-slate-900">${total.toFixed(2)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl border-2 border-slate-200 shadow-sm divide-y divide-slate-100">
        {txs.map((tx) => (
          <div key={tx.id} className="flex items-center justify-between px-6 py-4">
            <div>
              <p className="font-semibold text-slate-900">{tx.date}</p>
              <p className="text-sm text-slate-500">
                {CARD_LABELS[tx.card] ?? tx.card} · {tx.category}
              </p>
            </div>
            <p className={`font-bold text-lg ${tx.type === 'credit' ? 'text-green-600' : 'text-slate-900'}`}>
              {tx.type === 'credit' ? '+' : '-'}${tx.amount.toFixed(2)}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}