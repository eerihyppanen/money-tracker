import { useData } from '../../data/dataContext';
import { formatCents } from '../../domain/format';

export interface CategoryRow {
  categoryId: string;
  cents: number;
}

const percent = new Intl.NumberFormat('fi-FI', { style: 'percent', maximumFractionDigits: 0 });

/**
 * Ranked horizontal bars, one series (expenses), so one colour and no legend: each bar is
 * named by its label, and its value is printed beside it so the chart doubles as a table.
 * Hovering or focusing a row shows its share of the total and the entries behind it.
 */
export function CategoryChart({
  rows,
  names,
  label,
  empty,
}: {
  rows: CategoryRow[];
  /** Entry names per category, shown in the hover details. */
  names: Map<string, string[]>;
  label: string;
  empty: string;
}) {
  const { categoryName } = useData();
  const total = rows.reduce((s, r) => s + r.cents, 0);
  const max = rows[0]?.cents ?? 0;

  if (rows.length === 0) return <p className="border-y border-line py-4 text-muted">{empty}</p>;

  return (
    <ul aria-label={label} className="flex flex-col gap-3.5">
      {rows.map((r) => {
        const share = total > 0 ? r.cents / total : 0;
        const entryNames = names.get(r.categoryId) ?? [];
        return (
          <li
            key={r.categoryId}
            tabIndex={0}
            className="group relative rounded-md outline-offset-4"
            aria-label={`${categoryName(r.categoryId)}: ${formatCents(r.cents)}, ${percent.format(share)} of expenses`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate">{categoryName(r.categoryId)}</span>
              <span className="num shrink-0">{formatCents(r.cents)}</span>
            </div>
            {/* Bars start square at the baseline and round only at the data end. */}
            <div className="mt-1.5 h-2.5">
              <div
                className="h-full rounded-r bg-expense"
                style={{ width: `${Math.max((r.cents / max) * 100, 1)}%` }}
              />
            </div>
            <div
              role="tooltip"
              className="pointer-events-none invisible absolute top-full right-0 z-10 mt-2 max-w-64 rounded-lg border border-line bg-surface px-3 py-2 text-sm shadow-md group-hover:visible group-focus:visible"
            >
              <div className="num font-medium">{percent.format(share)} of expenses</div>
              {entryNames.length > 0 && <div className="text-muted">{entryNames.join(', ')}</div>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
