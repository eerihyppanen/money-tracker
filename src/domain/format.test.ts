import { describe, expect, it } from 'vitest';
import { formatAmountInput, formatCents, formatDate, formatDayLabel, formatMonth, parseAmount } from './format';

// Intl uses non-breaking spaces and a real minus sign; normalise them for readable assertions.
const plain = (s: string) => s.replace(/[  ]/g, ' ').replace(/−/g, '-');

describe('formatCents', () => {
  it('uses Finnish grouping and a decimal comma', () => {
    expect(plain(formatCents(123450))).toBe('1 234,50 €');
    expect(plain(formatCents(5))).toBe('0,05 €');
    expect(plain(formatCents(0))).toBe('0,00 €');
    expect(plain(formatCents(123456789))).toBe('1 234 567,89 €');
  });

  it('shows negative amounts', () => {
    expect(plain(formatCents(-123450))).toBe('-1 234,50 €');
  });
});

describe('formatDate', () => {
  it('uses d.m.yyyy', () => {
    expect(formatDate('2026-11-11')).toBe('11.11.2026');
    expect(formatDate('2026-02-01')).toBe('1.2.2026');
  });
});

describe('formatMonth', () => {
  it('gives an English month name and year', () => {
    expect(formatMonth(2026, 11)).toBe('November 2026');
  });
});

describe('parseAmount', () => {
  it('accepts a comma or a dot as the decimal separator', () => {
    expect(parseAmount('12,5')).toBe(1250);
    expect(parseAmount('12.50')).toBe(1250);
    expect(parseAmount('12')).toBe(1200);
    expect(parseAmount('0,05')).toBe(5);
  });

  it('ignores spaces, thousands separators and the euro sign', () => {
    expect(parseAmount(' 1 234,50 € ')).toBe(123450);
    expect(parseAmount('1 234,50')).toBe(123450);
  });

  it('avoids floating point errors', () => {
    expect(parseAmount('0,29')).toBe(29);
    expect(parseAmount('1.15')).toBe(115);
  });

  it('rejects invalid input', () => {
    expect(parseAmount('')).toBeNull();
    expect(parseAmount('abc')).toBeNull();
    expect(parseAmount('1,234')).toBeNull();
    expect(parseAmount('-5')).toBeNull();
    expect(parseAmount('1,2,3')).toBeNull();
  });
});

describe('formatAmountInput', () => {
  it('turns cents back into an editable string', () => {
    expect(formatAmountInput(123450)).toBe('1234,50');
    expect(formatAmountInput(5)).toBe('0,05');
  });
});

describe('formatDayLabel', () => {
  it('names today and tomorrow, otherwise weekday and short date', () => {
    expect(formatDayLabel('2026-11-11', '2026-11-11')).toBe('Today');
    expect(formatDayLabel('2026-11-12', '2026-11-11')).toBe('Tomorrow');
    expect(formatDayLabel('2026-11-13', '2026-11-11')).toBe('Fri 13.11.');
    expect(formatDayLabel('2027-01-04', '2026-11-11')).toBe('Mon 4.1.');
  });
});
