import { isEnded, nextPayment } from './schedule';
import { FREQUENCIES, type Entry, type EntryType, type Frequency, type ISODate } from './types';

export type ListSort = 'due' | 'amount';

export interface ListFilter {
  type: 'all' | EntryType;
  categoryId: 'all' | string;
  frequency: 'all' | Frequency;
  sort: ListSort;
}

export const DEFAULT_LIST_FILTER: ListFilter = {
  type: 'all',
  categoryId: 'all',
  frequency: 'all',
  sort: 'due',
};

/**
 * Filters, then sorts. Paused and ended entries always go to the bottom. "Due date" order uses
 * the same next payment the list row shows (nextPayment); entries with no payment coming (the
 * last one is done, or a one-time date has passed) follow the ones that have one.
 */
export function filterAndSort(entries: Entry[], f: ListFilter, today: ISODate): Entry[] {
  const dormant = (e: Entry) => (!e.active || isEnded(e, today) ? 1 : 0);
  const upcoming = new Map(entries.map((e) => [e.id, nextPayment(e, today)]));
  const comingOn = (e: Entry) => {
    const next = upcoming.get(e.id);
    return next != null && next >= today ? next : null;
  };
  const byDue = (a: Entry, b: Entry) => {
    const [x, y] = [comingOn(a), comingOn(b)];
    if (x !== null && y !== null) return x.localeCompare(y);
    // Nothing coming goes after every real date; among themselves, by the stored date.
    return Number(x === null) - Number(y === null) || a.nextDueDate.localeCompare(b.nextDueDate);
  };
  const byKey = f.sort === 'amount' ? (a: Entry, b: Entry) => b.amountCents - a.amountCents : byDue;

  return entries
    .filter(
      (e) =>
        (f.type === 'all' || e.type === f.type) &&
        (f.categoryId === 'all' || e.categoryId === f.categoryId) &&
        (f.frequency === 'all' || e.frequency === f.frequency),
    )
    .sort((a, b) => dormant(a) - dormant(b) || byKey(a, b) || a.name.localeCompare(b.name));
}

/**
 * Reads the filter from URL values. Anything unknown (a deleted category, a hand-edited
 * address) falls back to the default, so the list never hides entries for no visible reason.
 */
export function parseListFilter(
  raw: { type: string | null; category: string | null; frequency: string | null; sort: string | null },
  categoryIds: string[],
): ListFilter {
  const d = DEFAULT_LIST_FILTER;
  return {
    type: raw.type === 'expense' || raw.type === 'income' ? raw.type : d.type,
    categoryId: raw.category !== null && categoryIds.includes(raw.category) ? raw.category : d.categoryId,
    frequency: FREQUENCIES.includes(raw.frequency as Frequency) ? (raw.frequency as Frequency) : d.frequency,
    sort: raw.sort === 'amount' || raw.sort === 'due' ? raw.sort : d.sort,
  };
}
