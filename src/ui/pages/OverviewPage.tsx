import { Link } from 'react-router-dom';
import { useData } from '../../data/dataContext';
import { formatCents, formatDayLabel, formatMonth } from '../../domain/format';
import { averageMonth, monthProgress, upcoming, type Totals } from '../../domain/schedule';
import type { Charge } from '../../domain/types';
import { PageHeader } from '../components/PageHeader';
import { MonthStrip } from '../overview/MonthStrip';

export function OverviewPage() {
  const { entries, today } = useData();
  const progress = monthProgress(entries, today);

  return (
    <>
      <PageHeader title={formatMonth(progress.year, progress.month)} />

      {entries.length === 0 ? (
        <Welcome />
      ) : (
        <div className="flex flex-col gap-10">
          <MonthStrip progress={progress} />
          <div className="grid gap-10 md:grid-cols-2 md:gap-8">
            <AverageMonth totals={averageMonth(entries, today)} />
            <Upcoming charges={upcoming(entries, today)} />
          </div>
        </div>
      )}
    </>
  );
}

function SectionTitle({ id, title, children }: { id: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-3">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {children && <p className="text-sm text-muted">{children}</p>}
    </div>
  );
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

function Upcoming({ charges }: { charges: Charge[] }) {
  const { today, categoryName } = useData();
  const dueCents = charges.filter((c) => c.entry.type === 'expense').reduce((s, c) => s + c.entry.amountCents, 0);

  return (
    <section aria-labelledby="upcoming">
      <SectionTitle id="upcoming" title="Next 30 days">
        {charges.length > 0 ? <span className="num">{formatCents(dueCents)} in payments due</span> : undefined}
      </SectionTitle>
      {charges.length === 0 ? (
        <p className="border-y border-line py-4 text-muted">Nothing due in the next 30 days.</p>
      ) : (
        <ul className="divide-y divide-line border-y border-line">
          {charges.map(({ entry, date }) => (
            <li key={`${entry.id}-${date}`}>
              <Link to={`/entry/${entry.id}`} className="flex items-baseline gap-3 py-2.5 hover:bg-surface/60">
                <span
                  className={`num w-24 shrink-0 text-sm ${date === today ? 'font-medium text-ink' : 'text-muted'}`}
                >
                  {formatDayLabel(date, today)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{entry.name}</span>
                  <span className="block text-sm text-muted">{categoryName(entry.categoryId)}</span>
                </span>
                <span className={`num shrink-0 ${entry.type === 'income' ? 'text-income' : 'text-expense'}`}>
                  {entry.type === 'income' ? '+' : '−'}
                  {formatCents(entry.amountCents)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
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
