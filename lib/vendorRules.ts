import { VendorRule } from './types';

export function applyVendorRules(merchant: string, rules: VendorRule[]): string {
  const lower = merchant.toLowerCase();
  for (const rule of rules) {
    const pat = rule.pattern.toLowerCase();
    const matches = rule.matchType === 'prefix' ? lower.startsWith(pat) : lower.includes(pat);
    if (matches) return rule.normalized;
  }
  return merchant;
}
