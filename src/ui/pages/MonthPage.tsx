import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../../data/dataContext';
import { parseMonthParam, shiftMonth, toMonthParam } from '../../domain/dates';
import { formatCents, formatMonth } from '../../domain/format';
import { expensesByCategory, monthProgress, type MonthProgress } from '../../domain/schedule';
import { CategoryChart } from '../components/CategoryChart';
import { ChargeList } from '../components/ChargeList';
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { SectionTitle } from '../components/SectionTitle';
import { MonthStrip } from '../overview/MonthStrip';

const monthOnly = new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' });

export function MonthPage() {
  const { entries, today } = useData();
  const [params] = useSearchParams();
  const current = { year: Number(today.slice(0, 4)), month: Number(today.slice(5, 7)) };
  const { year, month } = parseMonthParam(params.get('m')) ?? current;
  const isCurrent = year === current.year && month === current.month;
  const progress = monthProgress(entries, today, year, month);

  const link = (delta: number) => {
    const next = shiftMonth(year, month, delta);
    const isNextCurrent = next.year === current.year && next.month === current.month;
    return isNextCurrent ? '/month' : `/month?m=${toMonthParam(next.year, next.month)}`;
  };
  const navButton = 'flex size-10 items-center justify-center rounded-full border border-line hover:bg-surface';

  const expenseNames = new Map<string, string[]>();
  for (const { entry } of progress.charges) {
    if (entry.type !== 'expense') continue;
    const list = expenseNames.get(entry.categoryId) ?? [];
    if (!list.includes(entry.name)) expenseNames.set(entry.categoryId, [...list, entry.name]);
  }

  return (
    <>
      <PageHeader title={formatMonth(year, month)}>
        <nav aria-label="Change month" className="flex items-center gap-2">
          {!isCurrent && (
            <Link to="/month" className="mr-1 text-sm text-accent">
              This month
            </Link>
          )}
          <Link to={link(-1)} replace className={navButton} aria-label="Previous month">
            <ChevronLeftIcon width={20} height={20} />
          </Link>
          <Link to={link(1)} replace className={navButton} aria-label="Next month">
            <ChevronRightIcon width={20} height={20} />
          </Link>
        </nav>
      </PageHeader>

      {entries.length === 0 ? (
        <p className="text-muted">
          Nothing to show yet.{' '}
          <Link to="/entry/new" className="text-accent underline">
            Add an entry
          </Link>{' '}
          to see what lands in each month.
        </p>
      ) : (
        <div className="flex flex-col gap-10">
          <MonthStrip progress={progress} caption={caption(progress, isCurrent, current)} />
          <div className="grid gap-10 md:grid-cols-2 md:gap-8">
            <section aria-labelledby="payments">
              <SectionTitle id="payments" title="Payments">
                {progress.charges.length > 0 ? (
                  <span className="num">
                    {progress.charges.length} {progress.charges.length === 1 ? 'payment' : 'payments'},{' '}
                    {formatCents(progress.expenseCents)} out and {formatCents(progress.incomeCents)} in
                  </span>
                ) : undefined}
              </SectionTitle>
              <ChargeList charges={progress.charges} empty={`Nothing lands in ${monthOnly.format(new Date(Date.UTC(year, month - 1)))}.`} />
            </section>
            <section aria-labelledby="month-categories">
              <SectionTitle id="month-categories" title="Expenses by category">
                What is actually charged this month.
              </SectionTitle>
              <CategoryChart
                label={`Expenses by category in ${formatMonth(year, month)}`}
                rows={expensesByCategory(progress.charges)}
                names={expenseNames}
                empty="No expenses this month."
              />
            </section>
          </div>
        </div>
      )}
    </>
  );
}

function caption(p: MonthProgress, isCurrent: boolean, current: { year: number; month: number }): string {
  const name = monthOnly.format(new Date(Date.UTC(p.year, p.month - 1)));
  const short = p.netCents < 0;
  if (isCurrent) {
    return short
      ? "This month's payments add up to more than this month's income."
      : 'After everything that lands this month.';
  }
  const past = p.year * 12 + p.month < current.year * 12 + current.month;
  if (past) {
    return short ? `Payments in ${name} added up to more than income.` : `What was left after everything in ${name}.`;
  }
  return short
    ? `Payments due in ${name} add up to more than the income expected.`
    : `If everything in ${name} goes as planned.`;
}
