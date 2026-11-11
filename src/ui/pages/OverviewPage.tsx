import { Link } from 'react-router-dom';
import { useData } from '../../data/dataContext';
import { formatCents, formatMonth } from '../../domain/format';
import { averageMonth, byCategory, isEnded, monthProgress, upcoming, type Totals } from '../../domain/schedule';
import type { Entry } from '../../domain/types';
import { CategoryChart } from '../components/CategoryChart';
import { ChargeList } from '../components/ChargeList';
import { PageHeader } from '../components/PageHeader';
import { SectionTitle } from '../components/SectionTitle';
import { MonthStrip } from '../overview/MonthStrip';

export function OverviewPage() {
  const { entries, today } = useData();
  const progress = monthProgress(entries, today);
  const charges = upcoming(entries, today);
  const dueCents = charges.filter((c) => c.entry.type === 'expense').reduce((s, c) => s + c.entry.amountCents, 0);

  return (
    <>
      <PageHeader title={formatMonth(progress.year, progress.month)} />

      {entries.length === 0 ? (
        <Welcome />
      ) : (
        <div className="flex flex-col gap-10">
          <MonthStrip
            progress={progress}
            caption={
              progress.netCents < 0
                ? "This month's payments add up to more than this month's income."
                : 'After everything that lands this month.'
            }
          />
          <div className="grid gap-10 md:grid-cols-2 md:gap-8">
            <div className="flex flex-col gap-10">
              <AverageMonth totals={averageMonth(entries, today)} />
              <section aria-labelledby="by-category">
                <SectionTitle id="by-category" title="Expenses by category">
                  An average month, recurring entries only.
                </SectionTitle>
                <CategoryChart
                  label="Average monthly expenses by category"
                  rows={byCategory(entries, today).map((r) => ({ categoryId: r.categoryId, cents: r.monthlyCents }))}
                  names={recurringNamesByCategory(entries, today)}
                  empty="No recurring expenses yet."
                />
              </section>
            </div>
            <section aria-labelledby="upcoming">
              <SectionTitle id="upcoming" title="Next 30 days">
                {charges.length > 0 ? <span className="num">{formatCents(dueCents)} in payments due</span> : undefined}
              </SectionTitle>
              <ChargeList charges={charges} empty="Nothing due in the next 30 days." />
            </section>
          </div>
        </div>
      )}
    </>
  );
}

/** Names of the recurring expenses behind each category, biggest first. */
function recurringNamesByCategory(entries: Entry[], today: string): Map<string, string[]> {
  const names = new Map<string, string[]>();
  [...entries]
    .filter((e) => e.type === 'expense' && e.active && e.frequency !== 'one-time' && !isEnded(e, today))
    .sort((a, b) => b.amountCents - a.amountCents)
    .forEach((e) => names.set(e.categoryId, [...(names.get(e.categoryId) ?? []), e.name]));
  return names;
}

function AverageMonth({ totals }: { totals: Totals }) {
  const negative = totals.netCents < 0;
  return (
    <section aria-labelledby="average-month">
      <SectionTitle id="average-month" title="Average month">
        Recurring entries spread evenly over a month, so yearly and quarterly bills count a little every
        month.
      </SectionTitle>
      <dl className="num divide-y divide-line border-y border-line">
        <Row label="Income" value={`+${formatCents(totals.incomeCents)}`} className="text-income" />
        <Row label="Expenses" value={`−${formatCents(totals.expenseCents)}`} className="text-expense" />
        <Row
          label={negative ? 'Shortfall' : 'Left over'}
          value={`${negative ? '−' : ''}${formatCents(Math.abs(totals.netCents))}`}
          className={`text-lg font-semibold ${negative ? 'text-expense' : 'text-income'}`}
        />
      </dl>
      <p className="num mt-2 text-sm text-muted">
        {negative ? 'Short by' : 'Adds up to'} {formatCents(Math.abs(totals.netCents) * 12)} a year.
      </p>
    </section>
  );
}

function Row({ label, value, className }: { label: string; value: string; className: string }) {
  return (
    <div className="flex items-baseline justify-between py-2.5">
      <dt>{label}</dt>
      <dd className={className}>{value}</dd>
    </div>
  );
}

function Welcome() {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10">
      <p className="text-xl font-semibold tracking-tight">See what's left over each month</p>
      <p className="mt-2 max-w-prose text-muted">
        Add your salary and your recurring costs, like rent, subscriptions and insurance. This page then
        shows what lands this month, what's coming up and what an average month looks like.
      </p>
      <Link
        to="/entry/new"
        className="mt-5 inline-block rounded-xl bg-accent px-4 py-2.5 font-medium text-accent-ink"
      >
        Add your first entry
      </Link>
    </div>
  );
}
