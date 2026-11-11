export interface StripInput {
  incomeCents: number;
  spentCents: number;
  dueCents: number;
}

export interface StripGeometry {
  spentPct: number;
  duePct: number;
  leftPct: number;
  /** How much expenses exceed income (0 when they don't). */
  overspendCents: number;
  /** Where income ends on the bar, shown only when expenses exceed it. */
  incomeMarkerPct: number | null;
}

/**
 * Widths for the month strip. The bar's full width is whichever is larger: income or expenses.
 * Segments, left to right: spent so far, still due, left over.
 */
export function stripGeometry({ incomeCents, spentCents, dueCents }: StripInput): StripGeometry {
  const expenses = spentCents + dueCents;
  const scale = Math.max(incomeCents, expenses);
  if (scale === 0) {
    return { spentPct: 0, duePct: 0, leftPct: 0, overspendCents: 0, incomeMarkerPct: null };
  }
  const pct = (cents: number) => (cents / scale) * 100;
  const overspendCents = Math.max(0, expenses - incomeCents);
  return {
    spentPct: pct(spentCents),
    duePct: pct(dueCents),
    leftPct: pct(Math.max(0, incomeCents - expenses)),
    overspendCents,
    incomeMarkerPct: overspendCents > 0 ? pct(incomeCents) : null,
  };
}
