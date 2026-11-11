import { describe, expect, it } from 'vitest';
import { parseMonthParam, shiftMonth, toMonthParam } from './dates';

describe('shiftMonth', () => {
  it('moves across year boundaries', () => {
    expect(shiftMonth(2026, 12, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth(2026, 1, -1)).toEqual({ year: 2025, month: 12 });
    expect(shiftMonth(2026, 11, 14)).toEqual({ year: 2028, month: 1 });
  });
});

describe('month URL parameter', () => {
  it('round-trips a year and month', () => {
    expect(toMonthParam(2026, 3)).toBe('2026-03');
    expect(parseMonthParam('2026-03')).toEqual({ year: 2026, month: 3 });
  });

  it('rejects anything that is not a month', () => {
    expect(parseMonthParam(null)).toBeNull();
    expect(parseMonthParam('2026-13')).toBeNull();
    expect(parseMonthParam('march')).toBeNull();
  });
});
