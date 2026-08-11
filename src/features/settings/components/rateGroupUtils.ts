import { RateTier } from '../../../types';

export function newTier(label = ''): RateTier {
  return { id: crypto.randomUUID(), label, ratePerQuarterHour: 0 };
}

export function tiersEqual(a: RateTier[], b: RateTier[]): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function isTierValid(tier: RateTier): boolean {
  return tier.label.trim().length > 0 && tier.ratePerQuarterHour >= 0;
}
