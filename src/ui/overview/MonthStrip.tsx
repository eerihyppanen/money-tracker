import { formatCents } from '../../domain/format';
import type { MonthProgress } from '../../domain/schedule';
import { stripGeometry } from './strip';

/** Striped fill for money that is still to come this month. */
const pendingFill = {
  backgroundImage:
    'repeating-linear-gradient(135deg, var(--c-expense) 0 6px, color-mix(in srgb, var(--c-expense) 45%, transparent) 6px 12px)',
};

/**
 * One bar for the whole month: income is the full width, split into what has been spent,
 * what is still due and what's left over. If spending exceeds income, the bar scales to
 * spending and a marker shows where income runs out.
 */
export function MonthStrip({ progress }: { progress: MonthProgress }) {
  const g = stripGeometry({
    incomeCents: progress.incomeCents,
    spentCents: progress.spentSoFarCents,
    dueCents: progress.stillDueCents,
  });
  const short = progress.netCents < 0;

  return (
    <section aria-labelledby="this-month">
      <h2 id="this-month" className="num text-4xl leading-tight font-semibold tracking-tight md:text-5xl">
        <span className={short ? 'text-expense' : 'text-income'}>
          {formatCents(Math.abs(progress.netCents))}
        </span>{' '}
        <span className="text-ink">{short ? 'short' : 'left over'}</span>
      </h2>
      <p className="mt-1 text-muted">
        {short
          ? "This month's payments add up to more than this month's income."
          : 'After everything that lands this month.'}
      </p>

      <div className="relative mt-6">
        <div
          className="flex h-11 overflow-hidden rounded-lg bg-line"
          role="img"
          aria-label={`Spent so far ${formatCents(progress.spentSoFarCents)}, still due ${formatCents(
            progress.stillDueCents,
          )}, left over ${formatCents(Math.max(0, progress.netCents))}`}
        >
          {g.spentPct > 0 && <div className="bg-expense" style={{ width: `${g.spentPct}%` }} />}
          {g.duePct > 0 && <div style={{ width: `${g.duePct}%`, ...pendingFill }} />}
          {g.leftPct > 0 && <div className="bg-income" style={{ width: `${g.leftPct}%` }} />}
        </div>
        {g.incomeMarkerPct !== null && (
          <div
            className="pointer-events-none absolute -top-2 -bottom-2 w-0.5 bg-ink"
            style={{ left: `calc(${g.incomeMarkerPct}% - 1px)` }}
          >
            <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs whitespace-nowrap text-ink">
              Income ends
            </span>
          </div>
        )}
      </div>

      <dl className="num mt-5 grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-4">
        <Figure label="Income" value={progress.incomeCents}>
          {progress.stillExpectedCents > 0 && progress.receivedSoFarCents > 0
            ? `${formatCents(progress.stillExpectedCents)} still to come`
            : progress.stillExpectedCents > 0
              ? 'Not received yet'
              : progress.incomeCents > 0
                ? 'All received'
                : undefined}
        </Figure>
        <Figure label="Spent so far" value={progress.spentSoFarCents} swatch={<span className="bg-expense" />} />
        <Figure label="Still due" value={progress.stillDueCents} swatch={<span style={pendingFill} />} />
        <Figure
          label="Left over"
          value={Math.max(0, progress.netCents)}
          swatch={<span className="bg-income" />}
        >
          {g.overspendCents > 0 ? `${formatCents(g.overspendCents)} over budget` : undefined}
        </Figure>
      </dl>
    </section>
  );
}

function Figure({
  label,
  value,
  swatch,
  children,
}: {
  label: string;
  value: number;
  swatch?: React.ReactElement<{ className?: string }>;
  children?: string;
}) {
  return (
    <div>
      <dt className="flex items-center gap-2 text-sm text-muted">
        {swatch && (
          <span aria-hidden="true" className="flex size-3 overflow-hidden rounded-sm *:size-full">
            {swatch}
          </span>
        )}
        {label}
      </dt>
      <dd className="text-lg font-medium">{formatCents(value)}</dd>
      {children && <dd className="text-sm text-muted">{children}</dd>}
    </div>
  );
}
