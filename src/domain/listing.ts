import { isEnded } from './schedule';
import type { Entry, EntryType, Frequency, ISODate } from './types';

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
