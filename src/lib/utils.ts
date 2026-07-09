import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Normalizes shouty/mixed-case names (e.g. "DIAZVILLE HOERSKOOL") to
// "Diazville Hoerskool" while preserving separators like hyphens and apostrophes.
export function toTitleCase(str: string | undefined): string {
  if (!str) return '';
  return str.toLowerCase().replace(/(^|[\s'-])\S/g, (match) => match.toUpperCase());
}

export function formatCurrency(amount: number | string | undefined): string {
  if (amount === undefined || amount === null) return '0.00';
  const val = typeof amount === 'string' ? parseFloat(amount.replace(/[\s,]/g, '')) : amount;
  if (isNaN(val)) return '0.00';
  return val.toLocaleString('en-ZA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
