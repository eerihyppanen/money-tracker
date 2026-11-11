import { describe, expect, it } from 'vitest';
import { emptyForm, fromEntry, toEntry, validateForm, type EntryFormValues } from './entryForm';
import type { Entry } from './types';

const NOW = '2026-11-11T10:00:00.000Z';
const newId = () => 'new-id';

function form(overrides: Partial<EntryFormValues> = {}): EntryFormValues {
  return { ...emptyForm('2026-11-11'), name: 'Rent', amount: '900', ...overrides };
}

const existing: Entry = {
  id: 'rent',
  name: 'Rent',
  amountCents: 90000,
  type: 'expense',
  frequency: 'monthly',
  categoryId: 'housing',
  nextDueDate: '2026-11-30',
  anchorDay: 31,
  startDate: '2024-01-01',
  active: true,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

describe('emptyForm', () => {
  it('defaults to a monthly expense due today, counted from the start of this month', () => {
    const f = emptyForm('2026-11-11');
    expect(f).toMatchObject({
      type: 'expense',
      frequency: 'monthly',
      categoryId: 'other',
      nextDueDate: '2026-11-11',
      startDate: '2026-11-01',
      endDate: '',
      active: true,
    });
  });
});

describe('validateForm', () => {
  it('accepts a complete form', () => {
    expect(validateForm(form())).toEqual({});
  });

  it('requires a name and a positive amount', () => {
    expect(validateForm(form({ name: '  ' }))).toHaveProperty('name');
    expect(validateForm(form({ amount: '' }))).toHaveProperty('amount');
    expect(validateForm(form({ amount: '0' }))).toHaveProperty('amount');
    expect(validateForm(form({ amount: '12,345' }))).toHaveProperty('amount');
  });

  it('requires valid dates', () => {
    expect(validateForm(form({ nextDueDate: '' }))).toHaveProperty('nextDueDate');
    expect(validateForm(form({ startDate: '' }))).toHaveProperty('startDate');
  });

  it('rejects an end date before the start date', () => {
    expect(validateForm(form({ startDate: '2026-11-01', endDate: '2026-10-31' }))).toHaveProperty(
      'endDate',
    );
    expect(validateForm(form({ startDate: '2026-11-01', endDate: '2026-11-01' }))).toEqual({});
  });

  it('ignores start and end dates for one-time entries', () => {
    expect(
      validateForm(form({ frequency: 'one-time', startDate: '', endDate: '2000-01-01' })),
    ).toEqual({});
  });
});

describe('toEntry', () => {
  it('creates a new entry with cents, a trimmed name and an anchor day', () => {
    const e = toEntry(form({ name: ' Rent ', amount: '1 234,5', nextDueDate: '2026-12-31' }), undefined, NOW, newId);
    expect(e).toMatchObject({
      id: 'new-id',
      name: 'Rent',
      amountCents: 123450,
      nextDueDate: '2026-12-31',
      anchorDay: 31,
      createdAt: NOW,
      updatedAt: NOW,
    });
    expect(e.endDate).toBeUndefined();
    expect(e.notes).toBeUndefined();
  });

  it('keeps the anchor day when editing without changing the due date', () => {
    const e = toEntry({ ...fromEntry(existing), amount: '950' }, existing, NOW, newId);
    expect(e).toMatchObject({ id: 'rent', amountCents: 95000, anchorDay: 31, createdAt: existing.createdAt });
  });

  it('takes a new anchor day when the due date changes', () => {
    const e = toEntry({ ...fromEntry(existing), nextDueDate: '2026-12-15' }, existing, NOW, newId);
    expect(e.anchorDay).toBe(15);
  });

  it('starts a one-time entry on its own date and gives it no end date', () => {
    const e = toEntry(
      form({ frequency: 'one-time', nextDueDate: '2026-10-20', startDate: '2026-11-01', endDate: '2027-01-01' }),
      undefined,
      NOW,
      newId,
    );
    expect(e.startDate).toBe('2026-10-20');
    expect(e.endDate).toBeUndefined();
  });

  it('keeps notes and an end date when given', () => {
    const e = toEntry(form({ notes: ' Trial ', endDate: '2027-01-31' }), undefined, NOW, newId);
    expect(e.notes).toBe('Trial');
    expect(e.endDate).toBe('2027-01-31');
  });
});

describe('fromEntry', () => {
  it('round-trips an entry through the form', () => {
    const e = { ...existing, endDate: '2027-06-30', notes: 'Landlord' };
    expect(toEntry(fromEntry(e), e, e.updatedAt, newId)).toEqual(e);
  });
});
