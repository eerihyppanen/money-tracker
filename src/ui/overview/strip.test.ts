import { describe, expect, it } from 'vitest';
import { stripGeometry } from './strip';

describe('stripGeometry', () => {
  it('fills the bar with spent, still due and left over when income covers everything', () => {
    expect(stripGeometry({ incomeCents: 1000, spentCents: 300, dueCents: 200 })).toEqual({
      spentPct: 30,
      duePct: 20,
      leftPct: 50,
      overspendCents: 0,
      incomeMarkerPct: null,
    });
  });

  it('scales to expenses and marks where income ends when spending more than earning', () => {
    expect(stripGeometry({ incomeCents: 600, spentCents: 500, dueCents: 300 })).toEqual({
      spentPct: 62.5,
      duePct: 37.5,
      leftPct: 0,
      overspendCents: 200,
      incomeMarkerPct: 75,
    });
  });

  it('is empty with no money in or out', () => {
    expect(stripGeometry({ incomeCents: 0, spentCents: 0, dueCents: 0 })).toEqual({
      spentPct: 0,
      duePct: 0,
      leftPct: 0,
      overspendCents: 0,
      incomeMarkerPct: null,
    });
  });

  it('marks income at zero when there is spending but no income', () => {
    expect(stripGeometry({ incomeCents: 0, spentCents: 100, dueCents: 0 })).toMatchObject({
      spentPct: 100,
      overspendCents: 100,
      incomeMarkerPct: 0,
    });
  });
});
