import { describe, expect, it } from 'vitest';
import { createBackup, parseBackup } from './backup';
import { isSample, sampleEntries } from './sample';
import { averageMonth, monthProgress } from './schedule';
import { DEFAULT_CATEGORIES, FREQUENCIES } from './types';

const NOW = '2026-11-18T10:00:00.000Z';

describe('sampleEntries', () => {
  for (const today of ['2026-11-18', '2027-01-31', '2028-02-29', '2026-12-31']) {
    it(`gives valid entries that are all due from ${today} on`, () => {
      const entries = sampleEntries(today, NOW);
      const parsed = parseBackup(JSON.stringify(createBackup({ entries, categories: DEFAULT_CATEGORIES }, NOW)));
      expect(parsed).toMatchObject({ ok: true, warnings: [] });
      for (const e of entries) expect(e.nextDueDate >= today, `${e.name} ${e.nextDueDate}`).toBe(true);
    });
  }

  it('shows every frequency, a paused entry and a month with money left over', () => {
    const entries = sampleEntries('2026-11-18', NOW);
    expect(new Set(entries.map((e) => e.frequency))).toEqual(new Set(FREQUENCIES));
    expect(entries.some((e) => !e.active)).toBe(true);
    expect(averageMonth(entries, '2026-11-18').netCents).toBeGreaterThan(0);
    expect(monthProgress(entries, '2026-11-18').charges.length).toBeGreaterThan(5);
  });

  it('marks its entries so they can be removed without touching real ones', () => {
    const entries = sampleEntries('2026-11-18', NOW);
    expect(entries.every(isSample)).toBe(true);
    expect(new Set(entries.map((e) => e.id)).size).toBe(entries.length);
    expect(isSample({ id: 'f3a1c2d4-real-entry' })).toBe(false);
  });
});
