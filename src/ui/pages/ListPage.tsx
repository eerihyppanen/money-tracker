import { useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useData } from '../../data/dataContext';
import { formatCents, formatDate } from '../../domain/format';
import { DEFAULT_LIST_FILTER, filterAndSort, type ListFilter } from '../../domain/listing';
import { isEnded, monthlyEquivalent, yearlyEquivalent } from '../../domain/schedule';
import { FREQUENCIES, FREQUENCY_LABELS, type Entry } from '../../domain/types';
import { Segmented } from '../components/form';
import { PageHeader } from '../components/PageHeader';

const selectClass =
  'rounded-lg border border-line bg-surface py-1.5 pr-8 pl-3 text-sm text-ink focus:border-accent focus:outline-none';

/** Filters live in the URL so they survive opening an entry and coming back. */
function useListFilter(): [ListFilter, (patch: Partial<ListFilter>) => void] {
  const [params, setParams] = useSearchParams();
  // Track the newest params ourselves: React Router's setter reads the params from the
  // render it came from, so two quick changes would otherwise overwrite each other.
  const latest = useRef(params);
  latest.current = params;

  const update = (patch: Partial<ListFilter>) => {
    const next = { ...readFilter(latest.current), ...patch };
    const p = new URLSearchParams();
    if (next.type !== 'all') p.set('type', next.type);
    if (next.categoryId !== 'all') p.set('category', next.categoryId);
    if (next.frequency !== 'all') p.set('frequency', next.frequency);
    if (next.sort !== DEFAULT_LIST_FILTER.sort) p.set('sort', next.sort);
    latest.current = p;
    setParams(p, { replace: true });
  };
  return [readFilter(params), update];
}

function readFilter(params: URLSearchParams): ListFilter {
  return {
    type: (params.get('type') as ListFilter['type']) ?? DEFAULT_LIST_FILTER.type,
    categoryId: params.get('category') ?? DEFAULT_LIST_FILTER.categoryId,
    frequency: (params.get('frequency') as ListFilter['frequency']) ?? DEFAULT_LIST_FILTER.frequency,
    sort: (params.get('sort') as ListFilter['sort']) ?? DEFAULT_LIST_FILTER.sort,
  };
}

export function ListPage() {
  const { entries, categories, today } = useData();
  const [filter, update] = useListFilter();
  const shown = filterAndSort(entries, filter, today);
  const filtering = filter.type !== 'all' || filter.categoryId !== 'all' || filter.frequency !== 'all';

  return (
    <>
      <PageHeader title="Entries">
        <span className="num text-sm text-muted">
          {shown.length === entries.length ? entries.length : `${shown.length} of ${entries.length}`}
        </span>
      </PageHeader>

      {entries.length === 0 ? (
        <EmptyState />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3 md:max-w-md">
            <Segmented
              label="Show"
              size="sm"
              value={filter.type}
              onChange={(type) => update({ type })}
              options={[
                { value: 'all', label: 'All' },
                { value: 'expense', label: 'Expenses' },
                { value: 'income', label: 'Income' },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <select
                aria-label="Category"
                value={filter.categoryId}
                onChange={(e) => update({ categoryId: e.target.value })}
                className={selectClass}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <select
                aria-label="How often"
                value={filter.frequency}
                onChange={(e) => update({ frequency: e.target.value as ListFilter['frequency'] })}
                className={selectClass}
              >
                <option value="all">Any frequency</option>
                {FREQUENCIES.map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
              <select
                aria-label="Sort by"
                value={filter.sort}
                onChange={(e) => update({ sort: e.target.value as ListFilter['sort'] })}
                className={selectClass}
              >
                <option value="due">Sort by due date</option>
                <option value="amount">Sort by amount</option>
              </select>
            </div>
          </div>

          {shown.length === 0 ? (
            <p className="py-8 text-muted">
              Nothing matches these filters.{' '}
              {filtering && (
                <button
                  type="button"
                  className="text-accent underline"
                  onClick={() => update({ type: 'all', categoryId: 'all', frequency: 'all' })}
                >
                  Clear filters
                </button>
              )}
            </p>
          ) : (
            <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
              {shown.map((e) => (
                <EntryRow key={e.id} entry={e} />
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}

function EntryRow({ entry }: { entry: Entry }) {
  const { categoryName, today } = useData();
  const ended = isEnded(entry, today);
  const dormant = !entry.active || ended;
  const oneTime = entry.frequency === 'one-time';
  const sign = entry.type === 'income' ? '+' : '−';

  return (
    <li>
      <Link
        to={`/entry/${entry.id}`}
        className={`flex items-start justify-between gap-4 px-4 py-3.5 hover:bg-bg/60 ${dormant ? 'opacity-55' : ''}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{entry.name}</span>
            {!entry.active && <Badge>Paused</Badge>}
            {entry.active && ended && <Badge>Ended</Badge>}
          </div>
          <div className="text-sm text-muted">
            {categoryName(entry.categoryId)}, {FREQUENCY_LABELS[entry.frequency].toLowerCase()}
          </div>
          {!ended && (
            <div className="num text-sm text-muted">
              {oneTime ? 'On' : 'Next'} {formatDate(entry.nextDueDate)}
            </div>
          )}
        </div>
        <div className="num shrink-0 text-right">
          <div className={`font-semibold ${entry.type === 'income' ? 'text-income' : 'text-expense'}`}>
            {sign}
            {formatCents(entry.amountCents)}
          </div>
          {!oneTime && (
            <>
              <div className="text-sm text-muted">{formatCents(monthlyEquivalent(entry))} / month</div>
              <div className="text-sm text-muted">{formatCents(yearlyEquivalent(entry))} / year</div>
            </>
          )}
        </div>
      </Link>
    </li>
  );
}

function Badge({ children }: { children: string }) {
  return <span className="shrink-0 rounded-md border border-line px-1.5 text-xs text-muted">{children}</span>;
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-line px-6 py-10">
      <p className="font-medium">No entries yet</p>
      <p className="mt-1 text-muted">
        Add your rent, subscriptions, insurance and salary to see what's left over each month.
      </p>
      <Link
        to="/entry/new"
        className="mt-4 inline-block rounded-xl bg-accent px-4 py-2.5 font-medium text-accent-ink"
      >
        Add your first entry
      </Link>
    </div>
  );
}
