export type Category = string;

export const DEFAULT_CATEGORIES: string[] = [
  'Bills', 'Food & Drinks', 'Groceries', 'Unnecessary Purchases',
  'Entertainment', 'Essentials', 'Shopping', 'Transport', 'Travel',
  'Gifts', 'Investments', 'Health & Wellness', 'Efuture', 'Subscriptions',
  'Reimbursements',
];

export interface Transaction {
  id: string;
  date: string;
  merchant: string;
  amount: number;
  card: string;
  category: Category;
  month: string;
  year: string;
  type: 'expense' | 'credit';
}

export interface IncomeEntry {
  id: string;
  date: string;
  source: 'W2' | 'Efuture';
  amount: number;
  month: string;
  year: string;
}

export interface ParsedTransaction {
  date: string;
  merchant: string;
  amount: number;
  card: string;
  type: 'expense' | 'credit';
  sourceCategory?: string;
  address?: string;
}
