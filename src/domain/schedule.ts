/**
 * Pure scheduling and money logic. Nothing here reads the clock or touches storage:
 * "today" is always passed in, so every function is deterministic and unit-tested.
 */
import {
  addDays,
  addMonths,
  daysBetween,
  firstOfMonth,
  lastOfMonth,
  maxDate,
  minDate,
  monthsBetween,
} from './dates';
import type { Charge, Entry, Frequency, ISODate } from './types';

const MONTHS_PER_STEP: Record<Exclude<Frequency, 'weekly' | 'one-time'>, number> = {
  monthly: 1,
  quarterly: 3,
  'semi-annually': 6,
  yearly: 12,
};

/** Monthly-equivalent amount in cents. One-time entries have none and return 0. */
export function monthlyEquivalent(entry: Entry): number {
  const a = entry.amountCents;
  switch (entry.frequency) {
    case 'weekly':
      return Math.round((a * 52) / 12);
    case 'one-time':
      return 0;
    default:
      return Math.round(a / MONTHS_PER_STEP[entry.frequency]);
  }
}

/** Yearly total in cents. One-time entries return 0. */
export function yearlyEquivalent(entry: Entry): number {
  const a = entry.amountCents;
  switch (entry.frequency) {
    case 'weekly':
      return a * 52;
    case 'one-time':
      return 0;
    default:
      return a * (12 / MONTHS_PER_STEP[entry.frequency]);
  }
}

/**
 * Moves `date` by `steps` periods of `frequency`. Month-based frequencies land on
 * `anchorDay`, clamped to the length of the target month (31 → 28/29 → 31 …).
 */
export function addInterval(
  date: ISODate,
  frequency: Frequency,
  anchorDay: number,
  steps = 1,
): ISODate {
  if (frequency === 'one-time') return date;
  if (frequency === 'weekly') return addDays(date, 7 * steps);
  return addMonths(date, MONTHS_PER_STEP[frequency] * steps, anchorDay);
}

/** The k-th occurrence counted from the entry's next due date (k may be negative). */
function occurrence(entry: Entry, k: number): ISODate {
  return addInterval(entry.nextDueDate, entry.frequency, entry.anchorDay, k);
}

/** Smallest k such that occurrence(k) >= date. Only for recurring entries. */
function firstIndexOnOrAfter(entry: Entry, date: ISODate): number {
  // Jump close with arithmetic, starting one step early, then walk forward.
  let k =
    entry.frequency === 'weekly'
      ? Math.floor(daysBetween(entry.nextDueDate, date) / 7) - 1
      : Math.floor(
          monthsBetween(entry.nextDueDate, date) /
            MONTHS_PER_STEP[entry.frequency as keyof typeof MONTHS_PER_STEP],
        ) - 1;
  while (occurrence(entry, k) < date) k++;
  return k;
}

export function isEnded(entry: Entry, today: ISODate): boolean {
  return entry.endDate !== undefined && entry.endDate < today;
}

/**
 * If the next due date has passed, moves it to the first occurrence on or after today.
 * Never moves past the end date, and never moves one-time entries.
 * Returns the same object when nothing changes.
 */
export function rollForward(entry: Entry, today: ISODate): Entry {
  if (entry.frequency === 'one-time' || entry.nextDueDate >= today) return entry;

  let k = firstIndexOnOrAfter(entry, today);
  if (entry.endDate !== undefined) {
    while (k > 0 && occurrence(entry, k) > entry.endDate) k--;
  }
  const next = occurrence(entry, k);
  return next === entry.nextDueDate ? entry : { ...entry, nextDueDate: next };
}

/** All charges of one entry between `from` and `to`, inclusive. Paused entries have none. */
export function occurrencesInRange(entry: Entry, from: ISODate, to: ISODate): Charge[] {
  if (!entry.active) return [];
  const lower = maxDate(from, entry.startDate);
  const upper = entry.endDate !== undefined ? minDate(to, entry.endDate) : to;
  if (lower > upper) return [];

  if (entry.frequency === 'one-time') {
    const d = entry.nextDueDate;
    return d >= lower && d <= upper ? [{ entry, date: d }] : [];
  }

  const charges: Charge[] = [];
  for (let k = firstIndexOnOrAfter(entry, lower); ; k++) {
    const date = occurrence(entry, k);
    if (date > upper) break;
    charges.push({ entry, date });
  }
  return charges;
}

function chargesInRange(entries: Entry[], from: ISODate, to: ISODate): Charge[] {
  return entries
    .flatMap((e) => occurrencesInRange(e, from, to))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export interface Totals {
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

function totalsOf(items: { type: Entry['type']; cents: number }[]): Totals {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const { type, cents } of items) {
    if (type === 'income') incomeCents += cents;
    else expenseCents += cents;
  }
  return { incomeCents, expenseCents, netCents: incomeCents - expenseCents };
}

export interface MonthSummary extends Totals {
  charges: Charge[];
}

/** What actually lands in the given calendar month (month is 1–12). */
export function monthSummary(entries: Entry[], year: number, month: number): MonthSummary {
  const charges = chargesInRange(entries, firstOfMonth(year, month), lastOfMonth(year, month));
  return {
    charges,
    ...totalsOf(charges.map((c) => ({ type: c.entry.type, cents: c.entry.amountCents }))),
  };
}

/** Recurring entries that count towards the "average month": active, not ended, not one-time. */
function isRecurringNow(entry: Entry, today: ISODate): boolean {
  return entry.active && !isEnded(entry, today) && entry.frequency !== 'one-time';
}

/** Income, expenses and difference with every recurring entry normalised to a month. */
export function averageMonth(entries: Entry[], today: ISODate): Totals {
  return totalsOf(
    entries
      .filter((e) => isRecurringNow(e, today))
      .map((e) => ({ type: e.type, cents: monthlyEquivalent(e) })),
  );
}

/** Charges from today up to and including `days` days ahead, in date order. */
export function upcoming(entries: Entry[], today: ISODate, days = 30): Charge[] {
  return chargesInRange(entries, today, addDays(today, days));
}

export interface CategoryTotal {
  categoryId: string;
  monthlyCents: number;
}

/** Monthly-equivalent expenses per category, largest first. */
export function byCategory(entries: Entry[], today: ISODate): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'expense' || !isRecurringNow(e, today)) continue;
    totals.set(e.categoryId, (totals.get(e.categoryId) ?? 0) + monthlyEquivalent(e));
  }
  return [...totals]
    .map(([categoryId, monthlyCents]) => ({ categoryId, monthlyCents }))
    .filter((t) => t.monthlyCents > 0)
    .sort((a, b) => b.monthlyCents - a.monthlyCents);
}
