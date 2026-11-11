import { describe, expect, it } from 'vitest';
import type { Entry } from './types';
import {
  addInterval,
  averageMonth,
  byCategory,
  isEnded,
  monthSummary,
  monthlyEquivalent,
  occurrencesInRange,
  rollForward,
  upcoming,
  yearlyEquivalent,
} from './schedule';

function entry(overrides: Partial<Entry> = {}): Entry {
  const nextDueDate = overrides.nextDueDate ?? '2026-01-15';
  return {
    id: 'e1',
    name: 'Test',
    amountCents: 1000,
    type: 'expense',
    frequency: 'monthly',
    categoryId: 'other',
    nextDueDate,
    anchorDay: Number(nextDueDate.slice(8, 10)),
    startDate: '2020-01-01',
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

const dates = (e: Entry, from: string, to: string) =>
  occurrencesInRange(e, from, to).map((c) => c.date);

describe('monthlyEquivalent / yearlyEquivalent', () => {
  it('normalises every frequency to a month', () => {
    expect(monthlyEquivalent(entry({ frequency: 'weekly', amountCents: 1200 }))).toBe(5200);
    expect(monthlyEquivalent(entry({ frequency: 'monthly', amountCents: 1299 }))).toBe(1299);
    expect(monthlyEquivalent(entry({ frequency: 'quarterly', amountCents: 3000 }))).toBe(1000);
    expect(monthlyEquivalent(entry({ frequency: 'semi-annually', amountCents: 6000 }))).toBe(1000);
    expect(monthlyEquivalent(entry({ frequency: 'yearly', amountCents: 12000 }))).toBe(1000);
    expect(monthlyEquivalent(entry({ frequency: 'one-time', amountCents: 40000 }))).toBe(0);
  });

  it('rounds to whole cents', () => {
    // 1000 / 12 = 83.33…
    expect(monthlyEquivalent(entry({ frequency: 'yearly', amountCents: 1000 }))).toBe(83);
    // 999 * 52 / 12 = 4329
    expect(monthlyEquivalent(entry({ frequency: 'weekly', amountCents: 999 }))).toBe(4329);
    // 1000 / 3 = 333.33…
    expect(monthlyEquivalent(entry({ frequency: 'quarterly', amountCents: 1000 }))).toBe(333);
  });

  it('gives yearly totals', () => {
    expect(yearlyEquivalent(entry({ frequency: 'weekly', amountCents: 1000 }))).toBe(52000);
    expect(yearlyEquivalent(entry({ frequency: 'monthly', amountCents: 1000 }))).toBe(12000);
    expect(yearlyEquivalent(entry({ frequency: 'quarterly', amountCents: 1000 }))).toBe(4000);
    expect(yearlyEquivalent(entry({ frequency: 'semi-annually', amountCents: 1000 }))).toBe(2000);
    expect(yearlyEquivalent(entry({ frequency: 'yearly', amountCents: 1000 }))).toBe(1000);
    expect(yearlyEquivalent(entry({ frequency: 'one-time', amountCents: 1000 }))).toBe(0);
  });
});

describe('addInterval', () => {
  it('keeps the 31st through short months in a normal year', () => {
    expect(addInterval('2027-01-31', 'monthly', 31)).toBe('2027-02-28');
    expect(addInterval('2027-02-28', 'monthly', 31)).toBe('2027-03-31');
    expect(addInterval('2027-03-31', 'monthly', 31)).toBe('2027-04-30');
    expect(addInterval('2027-04-30', 'monthly', 31)).toBe('2027-05-31');
  });

  it('lands on 29 February in a leap year', () => {
    expect(addInterval('2028-01-31', 'monthly', 31)).toBe('2028-02-29');
    expect(addInterval('2028-02-29', 'monthly', 31)).toBe('2028-03-31');
    expect(addInterval('2028-01-30', 'monthly', 30)).toBe('2028-02-29');
  });

  it('handles yearly entries from 29 February', () => {
    expect(addInterval('2028-02-29', 'yearly', 29)).toBe('2029-02-28');
    expect(addInterval('2031-02-28', 'yearly', 29)).toBe('2032-02-29');
  });

  it('handles quarterly from 30 November', () => {
    expect(addInterval('2026-11-30', 'quarterly', 30)).toBe('2027-02-28');
    expect(addInterval('2027-02-28', 'quarterly', 30)).toBe('2027-05-30');
  });

  it('handles semi-annual steps across a year boundary', () => {
    expect(addInterval('2026-08-31', 'semi-annually', 31)).toBe('2027-02-28');
  });

  it('adds 7 days for weekly, across month and year ends', () => {
    expect(addInterval('2026-12-29', 'weekly', 29)).toBe('2027-01-05');
    expect(addInterval('2028-02-26', 'weekly', 26)).toBe('2028-03-04');
  });

  it('steps backwards with negative steps', () => {
    expect(addInterval('2027-03-31', 'monthly', 31, -1)).toBe('2027-02-28');
    expect(addInterval('2027-01-05', 'weekly', 5, -1)).toBe('2026-12-29');
  });

  it('never moves one-time entries', () => {
    expect(addInterval('2026-05-05', 'one-time', 5)).toBe('2026-05-05');
  });
});

describe('rollForward', () => {
  it('leaves entries that are not yet due alone', () => {
    const e = entry({ nextDueDate: '2026-11-20' });
    expect(rollForward(e, '2026-11-11')).toBe(e);
  });

  it('treats a due date of today as still due', () => {
    const e = entry({ nextDueDate: '2026-11-11' });
    expect(rollForward(e, '2026-11-11')).toBe(e);
  });

  it('advances a passed due date to the next one on or after today', () => {
    const e = entry({ nextDueDate: '2026-10-05' });
    expect(rollForward(e, '2026-11-11').nextDueDate).toBe('2026-12-05');
  });

  it('skips several missed periods and keeps the anchor day', () => {
    const e = entry({ nextDueDate: '2027-01-31' });
    expect(rollForward(e, '2027-03-01').nextDueDate).toBe('2027-03-31');
    expect(rollForward(e, '2027-02-15').nextDueDate).toBe('2027-02-28');
  });

  it('advances weekly entries', () => {
    const e = entry({ frequency: 'weekly', nextDueDate: '2026-11-02' });
    expect(rollForward(e, '2026-11-11').nextDueDate).toBe('2026-11-16');
  });

  it('does not move one-time entries', () => {
    const e = entry({ frequency: 'one-time', nextDueDate: '2026-10-01' });
    expect(rollForward(e, '2026-11-11')).toBe(e);
  });

  it('does not move past the end date', () => {
    const e = entry({ nextDueDate: '2026-08-15', endDate: '2026-10-31' });
    expect(rollForward(e, '2026-11-11').nextDueDate).toBe('2026-10-15');
  });
});

describe('isEnded', () => {
  it('is true only once the end date has passed', () => {
    expect(isEnded(entry(), '2026-11-11')).toBe(false);
    expect(isEnded(entry({ endDate: '2026-11-11' }), '2026-11-11')).toBe(false);
    expect(isEnded(entry({ endDate: '2026-11-10' }), '2026-11-11')).toBe(true);
  });
});

describe('occurrencesInRange', () => {
  it('lists monthly charges in a range, both before and after the next due date', () => {
    const e = entry({ nextDueDate: '2026-11-15' });
    expect(dates(e, '2026-09-01', '2027-01-31')).toEqual([
      '2026-09-15',
      '2026-10-15',
      '2026-11-15',
      '2026-12-15',
      '2027-01-15',
    ]);
  });

  it('keeps the anchor day when projecting backwards over February', () => {
    const e = entry({ nextDueDate: '2027-04-30', anchorDay: 31 });
    expect(dates(e, '2027-01-01', '2027-04-30')).toEqual([
      '2027-01-31',
      '2027-02-28',
      '2027-03-31',
      '2027-04-30',
    ]);
  });

  it('includes the range boundaries', () => {
    const e = entry({ nextDueDate: '2026-11-01' });
    expect(dates(e, '2026-11-01', '2026-11-30')).toEqual(['2026-11-01']);
    const f = entry({ nextDueDate: '2026-11-30' });
    expect(dates(f, '2026-11-01', '2026-11-30')).toEqual(['2026-11-30']);
  });

  it('finds 4 or 5 weekly charges depending on the month', () => {
    const e = entry({ frequency: 'weekly', nextDueDate: '2026-11-02' }); // Mondays
    expect(dates(e, '2026-11-01', '2026-11-30')).toHaveLength(5);
    expect(dates(e, '2027-02-01', '2027-02-28')).toHaveLength(4);
  });

  it('skips quarterly entries in the months between', () => {
    const e = entry({ frequency: 'quarterly', nextDueDate: '2026-12-01', anchorDay: 1 });
    expect(dates(e, '2027-01-01', '2027-02-28')).toEqual([]);
    expect(dates(e, '2027-03-01', '2027-03-31')).toEqual(['2027-03-01']);
  });

  it('stops at the end date, even in the middle of a month', () => {
    const e = entry({ frequency: 'weekly', nextDueDate: '2026-11-02', endDate: '2026-11-15' });
    expect(dates(e, '2026-11-01', '2026-11-30')).toEqual(['2026-11-02', '2026-11-09']);
    const f = entry({ nextDueDate: '2026-11-20', endDate: '2026-12-31' });
    expect(dates(f, '2027-01-01', '2027-12-31')).toEqual([]);
  });

  it('does not start before the start date', () => {
    const e = entry({ nextDueDate: '2027-02-10', startDate: '2027-02-01' });
    expect(dates(e, '2026-11-01', '2027-03-31')).toEqual(['2027-02-10', '2027-03-10']);
  });

  it('returns nothing for paused entries', () => {
    const e = entry({ active: false });
    expect(dates(e, '2026-01-01', '2026-12-31')).toEqual([]);
  });

  it('returns a one-time entry only in its own range', () => {
    const e = entry({ frequency: 'one-time', nextDueDate: '2026-11-20' });
    expect(dates(e, '2026-11-01', '2026-11-30')).toEqual(['2026-11-20']);
    expect(dates(e, '2026-12-01', '2026-12-31')).toEqual([]);
  });

  it('handles yearly entries from 29 February over several years', () => {
    const e = entry({ frequency: 'yearly', nextDueDate: '2028-02-29', anchorDay: 29 });
    expect(dates(e, '2026-01-01', '2029-12-31')).toEqual([
      '2026-02-28',
      '2027-02-28',
      '2028-02-29',
      '2029-02-28',
    ]);
  });
});

describe('monthSummary', () => {
  const salary = entry({
    id: 'salary',
    type: 'income',
    amountCents: 300000,
    nextDueDate: '2026-11-25',
  });
  const rent = entry({ id: 'rent', amountCents: 90000, nextDueDate: '2026-12-01', anchorDay: 1 });
  const gym = entry({ id: 'gym', frequency: 'weekly', amountCents: 1000, nextDueDate: '2026-11-02' });
  const insurance = entry({ id: 'ins', frequency: 'yearly', amountCents: 24000, nextDueDate: '2027-03-10' });
  const repair = entry({ id: 'repair', frequency: 'one-time', amountCents: 40000, nextDueDate: '2026-11-20' });
  const paused = entry({ id: 'paused', active: false, amountCents: 5000, nextDueDate: '2026-11-05' });

  it('sums what actually lands in the month, sorted by date', () => {
    const s = monthSummary([salary, rent, gym, insurance, repair, paused], 2026, 11);
    expect(s.charges.map((c) => `${c.entry.id}@${c.date}`)).toEqual([
      'rent@2026-11-01',
      'gym@2026-11-02',
      'gym@2026-11-09',
      'gym@2026-11-16',
      'repair@2026-11-20',
      'gym@2026-11-23',
      'salary@2026-11-25',
      'gym@2026-11-30',
    ]);
    expect(s.incomeCents).toBe(300000);
    expect(s.expenseCents).toBe(90000 + 5 * 1000 + 40000);
    expect(s.netCents).toBe(300000 - 135000);
  });

  it('includes a yearly charge only in its month', () => {
    expect(monthSummary([insurance], 2027, 2).expenseCents).toBe(0);
    expect(monthSummary([insurance], 2027, 3).expenseCents).toBe(24000);
  });
});

describe('averageMonth', () => {
  it('normalises recurring entries and ignores one-time, paused and ended ones', () => {
    const entries = [
      entry({ id: 'salary', type: 'income', amountCents: 300000 }),
      entry({ id: 'rent', amountCents: 90000 }),
      entry({ id: 'ins', frequency: 'yearly', amountCents: 24000 }),
      entry({ id: 'repair', frequency: 'one-time', amountCents: 40000 }),
      entry({ id: 'paused', active: false, amountCents: 5000 }),
      entry({ id: 'ended', amountCents: 7000, endDate: '2026-10-31' }),
    ];
    expect(averageMonth(entries, '2026-11-11')).toEqual({
      incomeCents: 300000,
      expenseCents: 92000,
      netCents: 208000,
    });
  });
});

describe('upcoming', () => {
  it('lists the next 30 days of charges in date order', () => {
    const entries = [
      entry({ id: 'rent', amountCents: 90000, nextDueDate: '2026-12-01', anchorDay: 1 }),
      entry({ id: 'stream', amountCents: 1299, nextDueDate: '2026-11-11' }),
      entry({ id: 'far', frequency: 'yearly', nextDueDate: '2027-06-01' }),
      entry({ id: 'paused', active: false, nextDueDate: '2026-11-12' }),
    ];
    const result = upcoming(entries, '2026-11-11');
    expect(result.map((c) => `${c.entry.id}@${c.date}`)).toEqual([
      'stream@2026-11-11',
      'rent@2026-12-01',
      'stream@2026-12-11',
    ]);
  });

  it('includes the day 30 days ahead but not the day after', () => {
    const e = entry({ frequency: 'one-time', nextDueDate: '2026-12-11' });
    expect(upcoming([e], '2026-11-11')).toHaveLength(1);
    expect(upcoming([e], '2026-11-10')).toHaveLength(0);
  });
});

describe('byCategory', () => {
  it('totals monthly-equivalent expenses per category, largest first', () => {
    const entries = [
      entry({ id: 'rent', categoryId: 'housing', amountCents: 90000 }),
      entry({ id: 'water', categoryId: 'housing', frequency: 'quarterly', amountCents: 6000 }),
      entry({ id: 'netflix', categoryId: 'subscriptions', amountCents: 1500 }),
      entry({ id: 'salary', type: 'income', categoryId: 'other', amountCents: 300000 }),
      entry({ id: 'paused', categoryId: 'food', active: false, amountCents: 5000 }),
    ];
    expect(byCategory(entries, '2026-11-11')).toEqual([
      { categoryId: 'housing', monthlyCents: 92000 },
      { categoryId: 'subscriptions', monthlyCents: 1500 },
    ]);
  });
});
