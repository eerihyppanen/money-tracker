import { parseISO } from './dates';
import type { ISODate } from './types';

const euro = new Intl.NumberFormat('fi-FI', { style: 'currency', currency: 'EUR' });
const monthName = new Intl.DateTimeFormat('en-GB', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
});

/** 123450 → "1 234,50 €" */
export function formatCents(cents: number): string {
  return euro.format(cents / 100);
}

/** '2026-11-11' → '11.11.2026', '2026-02-01' → '1.2.2026' (Finnish style). */
export function formatDate(date: ISODate): string {
  const { y, m, d } = parseISO(date);
  return `${d}.${m}.${y}`;
}

/** (2026, 11) → 'November 2026' */
export function formatMonth(year: number, month: number): string {
  return monthName.format(new Date(Date.UTC(year, month - 1, 1)));
}

/**
 * Parses what a user types into the amount field into cents, without floating point.
 * Accepts '12', '12,5', '12.50', '1 234,50 €'. Returns null for anything else.
 */
export function parseAmount(input: string): number | null {
  const s = input.replace(/[\s  €]/g, '');
  if (!/^\d+([.,]\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split(/[.,]/);
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** 123450 → '1234,50', for pre-filling the amount field. */
export function formatAmountInput(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, '0')}`;
}
