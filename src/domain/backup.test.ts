import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup, toCSV, validateCategoryName } from './backup';
import { DEFAULT_CATEGORIES, type Category, type Entry } from './types';

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: 'rent',
    name: 'Rent',
    amountCents: 123450,
    type: 'expense',
    frequency: 'monthly',
    categoryId: 'housing',
    nextDueDate: '2026-12-01',
    anchorDay: 1,
    startDate: '2024-01-01',
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const data = { entries: [entry(), entry({ id: 'trial', name: 'Trial', endDate: '2027-01-31', notes: 'Cancel!' })], categories: DEFAULT_CATEGORIES };

describe('createBackup / parseBackup', () => {
  it('round-trips all data', () => {
    const json = JSON.stringify(createBackup(data, '2026-11-11T10:00:00.000Z'));
    const result = parseBackup(json);
    expect(result).toEqual({ ok: true, data, warnings: [] });
  });

  it('labels the file with the app, a version and the export time', () => {
    expect(createBackup(data, 'NOW')).toMatchObject({ app: 'money-tracker', version: 1, exportedAt: 'NOW' });
  });

  it('rejects text that is not JSON', () => {
    expect(parseBackup('not json')).toEqual({ ok: false, error: 'This file is not valid JSON.' });
  });

  it('rejects JSON that is not a backup from this app', () => {
    expect(parseBackup('{"hello": 1}')).toMatchObject({ ok: false, error: expect.stringContaining('not a backup') });
  });

  it('rejects a backup from a newer version', () => {
    const json = JSON.stringify({ ...createBackup(data, 'NOW'), version: 2 });
    expect(parseBackup(json)).toMatchObject({ ok: false, error: expect.stringContaining('newer version') });
  });

  it('names the broken entry and field', () => {
    const bad = createBackup({ ...data, entries: [entry({ amountCents: 12.5 })] }, 'NOW');
    expect(parseBackup(JSON.stringify(bad))).toEqual({
      ok: false,
      error: 'Entry 1 ("Rent") has an invalid amountCents.',
    });
    const badDate = createBackup({ ...data, entries: [entry({ nextDueDate: '2026-02-30' })] }, 'NOW');
    expect(parseBackup(JSON.stringify(badDate))).toMatchObject({
      ok: false,
      error: expect.stringContaining('nextDueDate'),
    });
  });

  it('adds the Other category if missing and moves orphaned entries into it', () => {
    const categories: Category[] = [{ id: 'housing', name: 'Housing', isDefault: true }];
    const json = JSON.stringify(createBackup({ categories, entries: [entry({ categoryId: 'gone' })] }, 'NOW'));
    const result = parseBackup(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.categories.map((c) => c.id)).toEqual(['housing', 'other']);
    expect(result.data.entries[0].categoryId).toBe('other');
    expect(result.warnings).toEqual(['1 entry had a missing category and was moved to Other.']);
  });

  it('rejects duplicate ids', () => {
    const json = JSON.stringify(createBackup({ ...data, entries: [entry(), entry()] }, 'NOW'));
    expect(parseBackup(json)).toMatchObject({ ok: false, error: expect.stringContaining('twice') });
  });
});

describe('toCSV', () => {
  const name = (id: string) => (id === 'housing' ? 'Housing' : 'Other');

  it('writes a semicolon-separated sheet with Finnish numbers and dates', () => {
    const csv = toCSV([entry()], name);
    const [bom, rest] = [csv[0], csv.slice(1)];
    expect(bom).toBe('﻿');
    expect(rest.split('\r\n')).toEqual([
      'Name;Type;Amount;Frequency;Category;Next due date;Start date;End date;Active;Monthly equivalent;Yearly equivalent;Notes',
      'Rent;Expense;1234,50;Monthly;Housing;1.12.2026;1.1.2024;;Yes;1234,50;14814,00;',
      '',
    ]);
  });

  it('quotes fields containing separators, quotes or line breaks', () => {
    const csv = toCSV([entry({ name: 'Rent; flat "A"', notes: 'line 1\nline 2', active: false })], name);
    expect(csv).toContain('"Rent; flat ""A""";');
    expect(csv).toContain(';No;');
    expect(csv).toContain('"line 1\nline 2"');
  });
});

describe('validateCategoryName', () => {
  it('requires a unique, non-empty name', () => {
    expect(validateCategoryName('  ', DEFAULT_CATEGORIES)).toBe('Enter a name.');
    expect(validateCategoryName('housing ', DEFAULT_CATEGORIES)).toBe('There is already a category called Housing.');
    expect(validateCategoryName('Pets', DEFAULT_CATEGORIES)).toBeNull();
  });

  it('allows keeping the same name when renaming', () => {
    expect(validateCategoryName('Housing', DEFAULT_CATEGORIES, 'housing')).toBeNull();
  });
});
