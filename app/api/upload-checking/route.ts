import { appendIncome, appendSavingsEntries, appendTransactions } from '@/lib/googleSheets';
import { CheckingRow, IncomeEntry, SavingsEntry, Transaction } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const { rows, accountType }: { rows: CheckingRow[]; accountType: string } = await request.json();

    const incomeRows = rows.filter((r) => r.rowType === 'income_w2' || r.rowType === 'income_efuture');
    const savingsRows = rows.filter((r) => r.rowType === 'savings');
    const investmentRows = rows.filter((r) => r.rowType === 'investment');
    const expenseRows = rows.filter((r) => r.rowType === 'expense');
    const creditRows = rows.filter((r) => r.rowType === 'credit');

    const income: IncomeEntry[] = incomeRows.map((r, i) => ({
      id: `${Date.now()}-${i}`,
      date: r.date,
      source: r.rowType === 'income_w2' ? 'W2' : 'Efuture',
      amount: r.amount,
      month: r.month,
      year: r.year,
      description: r.description,
    }));

    const savingsEntries: SavingsEntry[] = [
      ...savingsRows.map((r, i) => ({
        id: `${Date.now()}-sav-${i}`,
        date: r.date,
        institution: r.institution ?? 'Unknown',
        entryType: 'hy-savings' as const,
        amount: r.amount,
        month: r.month,
        year: r.year,
      })),
      ...investmentRows.map((r, i) => ({
        id: `${Date.now()}-inv-${i}`,
        date: r.date,
        institution: r.institution ?? 'Unknown',
        entryType: 'investment' as const,
        amount: r.amount,
        month: r.month,
        year: r.year,
      })),
    ];

    const transactions: Transaction[] = [
      ...expenseRows.map((r, i) => ({
        id: `${Date.now()}-exp-${i}`,
        date: r.date,
        merchant: r.description,
        amount: r.amount,
        card: accountType,
        category: r.suggestedCategory ?? 'Bills',
        month: r.month,
        year: r.year,
        type: 'expense' as const,
        deductible: false,
      })),
      ...creditRows.map((r, i) => ({
        id: `${Date.now()}-crd-${i}`,
        date: r.date,
        merchant: r.description,
        amount: r.amount,
        card: accountType,
        category: 'Reimbursements',
        month: r.month,
        year: r.year,
        type: 'credit' as const,
        deductible: false,
      })),
    ];

    await Promise.all([
      income.length > 0 ? appendIncome(income) : Promise.resolve(),
      savingsEntries.length > 0 ? appendSavingsEntries(savingsEntries) : Promise.resolve(),
      transactions.length > 0 ? appendTransactions(transactions) : Promise.resolve(),
    ]);

    return Response.json({
      incomeCount: income.length,
      savingsCount: savingsEntries.length,
      transactionCount: transactions.length,
    });
  } catch (err) {
    console.error('upload-checking error:', err);
    return Response.json({ error: 'Failed to save checking data' }, { status: 500 });
  }
}
