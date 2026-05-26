import { Category } from './types';

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
];
