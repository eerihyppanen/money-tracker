import { describe, expect, it } from 'vitest';
import { DEFAULT_LIST_FILTER, filterAndSort, type ListFilter } from './listing';
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
  it('sorts by next due date by default, with paused and ended entries last', () => {
    expect(ids({})).toEqual(['netflix', 'salary', 'rent', 'insurance', 'ended', 'paused']);
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
