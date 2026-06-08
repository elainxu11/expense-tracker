export type Category = string;

export type BucketKey = 'Needs' | 'Wants' | 'Savings & Debt' | 'Unassigned';

export const DEFAULT_BUCKET_MAPPING: Record<BucketKey, string[]> = {
  Needs: ['Bills', 'Groceries', 'Essentials', 'Transport', 'Subscriptions', 'Health & Wellness'],
  Wants: ['Food & Drinks', 'Unnecessary Purchases', 'Entertainment', 'Shopping', 'Travel', 'Gifts'],
  'Savings & Debt': ['Investments', 'Efuture'],
  Unassigned: [],
};

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
  deductible: boolean;
  ignored?: boolean;
  address?: string;
  refundCategory?: string; // for credits: which expense category this offsets
}

export interface IncomeEntry {
  id: string;
  date: string;
  source: 'W2' | 'Efuture' | 'Credit';
  amount: number;
  month: string;
  year: string;
  description?: string;
}

export type CheckingRowType =
  | 'income_w2'
  | 'income_efuture'
  | 'credit'
  | 'expense'
  | 'savings'
  | 'investment'
  | 'exclude';

export interface CheckingRow {
  date: string;
  description: string;
  merchantName?: string; // cleaned payee name extracted from description
  amount: number;       // absolute value
  direction: 'in' | 'out';
  rowType: CheckingRowType;
  institution?: string; // for savings/investment rows
  suggestedCategory?: string;
  month: string;
  year: string;
}

export interface SavingsEntry {
  id: string;
  date: string;
  institution: string;
  entryType: 'hy-savings' | 'investment';
  amount: number;
  month: string;
  year: string;
}

export interface UploadSession {
  id: string;
  savedAt: string;
  committedAt?: string;
  committed?: boolean;
  card: string;
  cardLabel: string;
  transactions: Transaction[];
  expenseCount: number;
  creditCount: number;
  totalAmount: number;
  sessionType?: 'checking';
  incomeRows?: IncomeEntry[];
  savingsRows?: SavingsEntry[];
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

export interface VendorRule {
  pattern: string;
  normalized: string;
  matchType: 'prefix' | 'contains' | 'contains-all';
}
