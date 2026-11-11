import type { ISODate } from './types';

export interface YMD {
  y: number;
  m: number; // 1–12
  d: number;
}

export function parseISO(date: ISODate): YMD {
  const [y, m, d] = date.split('-').map(Number);
  return { y, m, d };
}

export function toISO({ y, m, d }: YMD): ISODate {
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function isValidISO(date: unknown): date is ISODate {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const { y, m, d } = parseISO(date);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m);
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function addDays(date: ISODate, days: number): ISODate {
  const { y, m, d } = parseISO(date);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return toISO({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

/** Adds whole months, landing on `anchorDay` clamped to the target month's length. */
export function addMonths(date: ISODate, months: number, anchorDay: number): ISODate {
  const { y, m } = parseISO(date);
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return toISO({ y: ny, m: nm, d: Math.min(anchorDay, daysInMonth(ny, nm)) });
}

export function daysBetween(from: ISODate, to: ISODate): number {
  const a = parseISO(from);
  const b = parseISO(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = parseISO(from);
  const b = parseISO(to);
  return b.y * 12 + b.m - (a.y * 12 + a.m);
}

export function firstOfMonth(year: number, month: number): ISODate {
  return toISO({ y: year, m: month, d: 1 });
}

export function lastOfMonth(year: number, month: number): ISODate {
  return toISO({ y: year, m: month, d: daysInMonth(year, month) });
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

/** Today's date in the device's local timezone. The only impure function here. */
export function todayISO(now: Date = new Date()): ISODate {
  return toISO({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });
}
