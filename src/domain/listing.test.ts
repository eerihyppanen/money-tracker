import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_FILTER, filterAndSort, parseListFilter, type ListFilter } from './listing';
import type { Entry } from './types';

function entry(id: string, overrides: Partial<Entry> = {}): Entry {
  return {
    id,
    name: id,
    amountCents: 1000,
    type: 'expense',
    frequency: 'monthly',
    categoryId: 'other',
    nextDueDate: '2026-12-01',
    anchorDay: 1,
    startDate: '2026-01-01',
    active: true,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

const entries = [
  entry('rent', { amountCents: 90000, categoryId: 'housing', nextDueDate: '2026-12-01' }),
  entry('salary', { type: 'income', amountCents: 300000, nextDueDate: '2026-11-25' }),
  entry('insurance', { frequency: 'yearly', amountCents: 24000, categoryId: 'insurance', nextDueDate: '2027-03-10' }),
  entry('netflix', { amountCents: 1500, categoryId: 'subscriptions', nextDueDate: '2026-11-15' }),
  entry('paused', { active: false, amountCents: 999999, nextDueDate: '2026-11-12' }),
  entry('ended', { endDate: '2026-10-31', nextDueDate: '2026-10-01' }),
];

const ids = (filter: Partial<ListFilter>) =>
  filterAndSort(entries, { ...DEFAULT_LIST_FILTER, ...filter }, '2026-11-11').map((e) => e.id);

describe('filterAndSort', () => {
  it('sorts by the next payment the row shows, with no upcoming payment after the rest', () => {
    const list = [
      // Last payment 1.11., ends 30.11.: the stored due date stays 1.11., but nothing is coming.
      entry('last-done', { nextDueDate: '2026-11-01', endDate: '2026-11-30' }),
      entry('soon', { nextDueDate: '2026-11-12', anchorDay: 12 }),
      entry('tyres', { frequency: 'one-time', nextDueDate: '2026-10-03', startDate: '2026-10-03' }),
      // Due date before the start: the first payment that counts is 1.12.
      entry('starts', { nextDueDate: '2026-10-01', startDate: '2026-12-01' }),
    ];
    expect(filterAndSort(list, DEFAULT_LIST_FILTER, '2026-11-11').map((e) => e.id)).toEqual([
      'soon',
      'starts',
      'tyres', // nothing coming: by stored date (3.10. before 1.11.)
      'last-done',
    ]);
  });

  it('sorts by next due date by default, with paused and ended entries last', () => {
    // Among the dormant ones too, a coming date (paused, next 12.11.) sorts before none (ended).
    expect(ids({})).toEqual(['netflix', 'salary', 'rent', 'insurance', 'paused', 'ended']);
  });

  it('sorts by amount, largest first', () => {
    expect(ids({ sort: 'amount' })).toEqual(['salary', 'rent', 'insurance', 'netflix', 'paused', 'ended']);
  });

  it('filters by type, category and frequency', () => {
    expect(ids({ type: 'income' })).toEqual(['salary']);
    expect(ids({ categoryId: 'housing' })).toEqual(['rent']);
    expect(ids({ frequency: 'yearly' })).toEqual(['insurance']);
    expect(ids({ type: 'expense', frequency: 'monthly', sort: 'amount' })).toEqual([
      'rent',
      'netflix',
      'paused',
      'ended',
    ]);
  });
});

describe('parseListFilter', () => {
  const none = { type: null, category: null, frequency: null, sort: null };
  const ids = ['housing', 'other'];

  it('reads valid values', () => {
    expect(parseListFilter({ type: 'income', category: 'housing', frequency: 'yearly', sort: 'amount' }, ids)).toEqual({
      type: 'income',
      categoryId: 'housing',
      frequency: 'yearly',
      sort: 'amount',
    });
    expect(parseListFilter(none, ids)).toEqual(DEFAULT_LIST_FILTER);
  });

  it('ignores a deleted category and other unknown values', () => {
    expect(parseListFilter({ type: 'gift', category: 'pets', frequency: 'daily', sort: 'name' }, ids)).toEqual(
      DEFAULT_LIST_FILTER,
    );
  });
});
