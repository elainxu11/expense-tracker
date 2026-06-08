import { VendorRule } from './types';

export function applyVendorRules(merchant: string, rules: VendorRule[]): string {
  const lower = merchant.toLowerCase();
  for (const rule of rules) {
    let matches: boolean;
    if (rule.matchType === 'contains-all') {
      const parts = rule.pattern.split('|').map((p) => p.trim().toLowerCase()).filter(Boolean);
      matches = parts.length > 0 && parts.every((p) => lower.includes(p));
    } else {
      const pat = rule.pattern.toLowerCase();
      matches = rule.matchType === 'prefix' ? lower.startsWith(pat) : lower.includes(pat);
    }
    if (matches) return rule.normalized;
  }
  return merchant;
}
