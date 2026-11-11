import { useData } from '../../data/dataContext';
import { PageHeader } from '../components/PageHeader';

export function SettingsPage() {
  const { categories } = useData();
  return (
    <>
      <PageHeader title="Settings" />
      <section>
        <h2 className="mb-3 text-lg font-medium">Categories</h2>
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {categories.map((c) => (
            <li key={c.id} className="px-4 py-3">
              {c.name}
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted">
          Adding and renaming categories, backups and CSV export arrive in stage 5.
        </p>
      </section>
    </>
  );
}
