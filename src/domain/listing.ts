import { isEnded } from './schedule';
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

/** Filters, then sorts. Paused and ended entries always go to the bottom. */
export function filterAndSort(entries: Entry[], f: ListFilter, today: ISODate): Entry[] {
  const dormant = (e: Entry) => (!e.active || isEnded(e, today) ? 1 : 0);
  const byKey =
    f.sort === 'amount'
      ? (a: Entry, b: Entry) => b.amountCents - a.amountCents
      : (a: Entry, b: Entry) => a.nextDueDate.localeCompare(b.nextDueDate);

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
