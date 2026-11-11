import { Link } from 'react-router-dom';
import { useData } from '../../data/dataContext';
import { formatCents, formatDayLabel } from '../../domain/format';
import type { Charge } from '../../domain/types';

/** Payments in date order. Dates before today are dimmed. */
export function ChargeList({ charges, empty }: { charges: Charge[]; empty: string }) {
  const { today, categoryName } = useData();

  if (charges.length === 0) {
    return <p className="border-y border-line py-4 text-muted">{empty}</p>;
  }
  return (
    <ul className="divide-y divide-line border-y border-line">
      {charges.map(({ entry, date }) => (
        <li key={`${entry.id}-${date}`}>
          <Link
            to={`/entry/${entry.id}`}
            className={`flex items-baseline gap-3 py-2.5 hover:bg-surface/60 ${date < today ? 'opacity-60' : ''}`}
          >
            <span className={`num w-24 shrink-0 text-sm ${date === today ? 'font-medium text-ink' : 'text-muted'}`}>
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
  );
}
