import { Category } from './types';

// Unified map for bank-provided category strings (AMEX and Capital One)
const SOURCE_CATEGORY_MAP: Record<string, Category> = {
  // AMEX
  'Restaurant-Restaurant': 'Food & Drinks',
  'Restaurant-Bar & Café': 'Food & Drinks',
  'Restaurant-Bar & CafÃ©': 'Food & Drinks',
  'Merchandise & Supplies-Groceries': 'Groceries',
  'Merchandise & Supplies-Wholesale Stores': 'Groceries',
  'Merchandise & Supplies-Pharmacies': 'Health & Wellness',
  'Merchandise & Supplies-Clothing Stores': 'Shopping',
  'Merchandise & Supplies-Electronics Stores': 'Shopping',
  'Merchandise & Supplies-Department Stores': 'Shopping',
  'Merchandise & Supplies-General Retail': 'Shopping',
  'Travel-Airline': 'Travel',
  'Entertainment-General Events': 'Entertainment',
  'Entertainment-General Attractions': 'Entertainment',
  'Entertainment-Other Entertainment': 'Entertainment',
  'Business Services-Internet Services': 'Subscriptions',
  'Business Services-Advertising Services': 'Efuture',
  'Business Services-Other Services': 'Bills',
  'Fees & Adjustments-Fees & Adjustments': 'Bills',
  'Transportation-Fuel': 'Transport',
  'Transportation-Parking Charges': 'Transport',
  'Transportation-Tolls & Fees': 'Transport',
  'Other-Education': 'Shopping',
  // Capital One ("Other Travel" and "Other Services" omitted — too ambiguous, fall back to merchant name)
  'Dining': 'Food & Drinks',
  'Groceries': 'Groceries',
  'Health Care': 'Health & Wellness',
  'Merchandise': 'Shopping',
  'Car Rental': 'Travel',
  'Entertainment': 'Entertainment',
  'Fee/Interest Charge': 'Bills',
  // Discover
  'Restaurants': 'Food & Drinks',
  'Supermarkets': 'Groceries',
  'Gas & Automotive': 'Transport',
  'Health & Beauty': 'Health & Wellness',
  'Travel': 'Travel',
};

export function mapSourceCategory(sourceCategory: string): Category | null {
  return SOURCE_CATEGORY_MAP[sourceCategory] ?? null;
}

const defaultMappings: Record<string, Category> = {
  starbucks: 'Food & Drinks',
  uber: 'Transport',
  lyft: 'Transport',
  doordash: 'Food & Drinks',
  grubhub: 'Food & Drinks',
  whole: 'Groceries',
  kroger: 'Groceries',
  safeway: 'Groceries',
  trader: 'Groceries',
  netflix: 'Subscriptions',
  spotify: 'Subscriptions',
  hulu: 'Subscriptions',
  amazon: 'Shopping',
  target: 'Shopping',
  costco: 'Groceries',
  gym: 'Health & Wellness',
  peloton: 'Health & Wellness',
  hotel: 'Travel',
  airbnb: 'Travel',
  airline: 'Travel',
  delta: 'Travel',
  united: 'Travel',
  southwest: 'Travel',
  stripe: 'Efuture',
  quickbooks: 'Efuture',
  vimeo: 'Efuture',
};

export async function suggestCategory(
  merchant: string,
  merchantMapping?: Record<string, string>
): Promise<Category> {
  const merchantLower = merchant.toLowerCase();

  // Check custom merchant mapping first
  if (merchantMapping && merchantMapping[merchantLower]) {
    return merchantMapping[merchantLower] as Category;
  }

  // Check default mappings
  for (const [key, category] of Object.entries(defaultMappings)) {
    if (merchantLower.includes(key)) {
      return category;
    }
  }

  // If no match, return a neutral category
  return 'Shopping';
}

export const CATEGORIES: Category[] = [
  'Bills',
  'Food & Drinks',
  'Groceries',
  'Unnecessary Purchases',
  'Entertainment',
  'Essentials',
  'Shopping',
  'Transport',
  'Travel',
  'Gifts',
  'Investments',
  'Health & Wellness',
  'Efuture',
  'Subscriptions',
  'Reimbursements',
];
