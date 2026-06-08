import { getTransactions, getSettings } from '@/lib/googleSheets';
import Link from 'next/link';
import { Transaction } from '@/lib/types';
import CategoryTransactionList from './_components/CategoryTransactionList';
import CategoryMonthlyChart from './_components/CategoryMonthlyChart';

const MONTH_LABEL: Record<string, string> = {
  '01': 'January',  '02': 'February', '03': 'March',    '04': 'April',
  '05': 'May',      '06': 'June',     '07': 'July',     '08': 'August',
  '09': 'September','10': 'October',  '11': 'November', '12': 'December',
};

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
    .map(([card, cardTxs]) => {
      const expenses = cardTxs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const credits = cardTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0);
      return {
        card,
        label: CARD_LABELS[card] ?? card,
        txs: cardTxs,
        total: expenses - credits,
      };
    })
    .sort((a, b) => b.total - a.total);
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ name: string }>;
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const [{ name }, { year: filterYear, month: filterMonth }] = await Promise.all([
    params,
    searchParams,
  ]);
  const category = decodeURIComponent(name);
  const isMonthFiltered = !!(filterYear && filterMonth);

  const [all, settings] = await Promise.all([getTransactions(), getSettings()]);

  const allCategoryTxs = all
    .filter((t) => t.category === category)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const txs = isMonthFiltered
    ? allCategoryTxs.filter((t) => t.year === filterYear && t.month === filterMonth)
    : allCategoryTxs;

  const totalSpent = txs.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const creditsTx = all.filter(
    (t) =>
      t.type === 'credit' &&
      t.refundCategory === category &&
      (!isMonthFiltered || (t.year === filterYear && t.month === filterMonth)),
  );
  const totalCredits = creditsTx.reduce((s, t) => s + t.amount, 0);

  const txIds = new Set(txs.map((t) => t.id));
  const creditsTxExtra = creditsTx.filter((t) => !txIds.has(t.id));
  const cardGroups = groupByCard([...txs, ...creditsTxExtra]);
  const displayedCount = txs.length + creditsTxExtra.length;

  const backHref = isMonthFiltered ? `/months/${filterYear}/${filterMonth}` : '/';
  const backLabel = isMonthFiltered
    ? `← ${MONTH_LABEL[filterMonth!] ?? filterMonth} ${filterYear}`
    : '← Dashboard';

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href={backHref} className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition">
          {backLabel}
        </Link>
        {isMonthFiltered && (
          <Link
            href={`/categories/${encodeURIComponent(name)}`}
            className="text-slate-400 hover:text-slate-700 font-semibold text-sm transition"
          >
            View all months →
          </Link>
        )}
      </div>

      <div>
        <h1 className="text-4xl font-bold text-slate-900">{category}</h1>
        <p className="text-slate-500 mt-1">
          {isMonthFiltered
            ? `${MONTH_LABEL[filterMonth!] ?? filterMonth} ${filterYear} · `
            : ''}
          {displayedCount} transaction{displayedCount !== 1 ? 's' : ''}
        </p>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border-2 border-blue-200 shadow">
          <p className="text-sm font-semibold text-blue-900 mb-2">Total Spent</p>
          <p className="text-4xl font-bold text-blue-900">${totalSpent.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border-2 border-green-200 shadow">
          <p className="text-sm font-semibold text-green-900 mb-2">Credits</p>
          <p className="text-4xl font-bold text-green-900">-${totalCredits.toFixed(2)}</p>
        </div>
        <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-6 border-2 border-teal-200 shadow">
          <p className="text-sm font-semibold text-teal-900 mb-2">Net Spent</p>
          <p className={`text-4xl font-bold ${totalSpent - totalCredits < 0 ? 'text-green-700' : 'text-teal-900'}`}>
            ${(totalSpent - totalCredits).toFixed(2)}
          </p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 border-2 border-purple-200 shadow">
          <p className="text-sm font-semibold text-purple-900 mb-2">Transactions</p>
          <p className="text-4xl font-bold text-purple-900">{displayedCount}</p>
        </div>
      </div>

      {!isMonthFiltered && <CategoryMonthlyChart txs={allCategoryTxs} category={category} />}

      <CategoryTransactionList cardGroups={cardGroups} categories={settings.categories} />
    </div>
  );
}