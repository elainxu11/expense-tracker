import { getTransactions, getSettings } from '@/lib/googleSheets';
import TransactionList from '@/app/_components/TransactionList';

export default async function TransactionsPage() {
  const [transactions, settings] = await Promise.all([getTransactions(), getSettings()]);
  const sorted = [...transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-slate-900">Transactions</h1>
        <span className="text-slate-500 font-medium">{transactions.length} total</span>
      </div>

      {sorted.length === 0 ? (
        <div className="bg-white rounded-lg p-6 border border-slate-200">
          <p className="text-slate-600">No transactions yet. Upload a statement to see them here.</p>
        </div>
      ) : (
        <TransactionList transactions={sorted} categories={settings.categories} />
      )}
    </div>
  );
}
