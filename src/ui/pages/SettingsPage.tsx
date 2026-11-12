import { useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { useData } from '../../data/dataContext';
import { createBackup, parseBackup, toCSV, validateCategoryName } from '../../domain/backup';
import { OTHER_CATEGORY_ID, type Category } from '../../domain/types';
import { inputClass } from '../components/form';
import { PageHeader } from '../components/PageHeader';
import { SectionTitle } from '../components/SectionTitle';

type Status = { kind: 'ok' | 'error'; text: string } | null;

const buttonClass = 'rounded-xl border border-line bg-surface px-4 py-2.5 font-medium hover:border-accent';

function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function SettingsPage() {
  const [status, setStatus] = useState<Status>(null);
  return (
    <>
      <PageHeader title="Settings" />
      <div className="flex max-w-xl flex-col gap-10">
        <Categories />
        <Backup onStatus={setStatus} />
        <p role="status" aria-live="polite" className={status?.kind === 'error' ? 'text-expense' : 'text-income'}>
          {status?.text}
        </p>
      </div>
    </>
  );
}

function Categories() {
  const { categories, entries, saveCategory, deleteCategory } = useData();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const count = (id: string) => entries.filter((e) => e.categoryId === id).length;

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateCategoryName(name, categories);
    setError(problem);
    if (problem) return;
    await saveCategory({ id: crypto.randomUUID(), name: name.trim(), isDefault: false });
    setName('');
  };

  const onDelete = async (c: Category) => {
    const n = count(c.id);
    const moved = n > 0 ? ` Its ${n} ${n === 1 ? 'entry moves' : 'entries move'} to Other.` : '';
    if (window.confirm(`Delete the category "${c.name}"?${moved}`)) await deleteCategory(c.id);
  };

  return (
    <section aria-labelledby="categories">
      <SectionTitle id="categories" title="Categories">
        Deleting a category moves its entries to Other.
      </SectionTitle>
      <ul className="divide-y divide-line rounded-2xl border border-line bg-surface">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} count={count(c.id)} onDelete={() => onDelete(c)} />
        ))}
      </ul>
      <form onSubmit={onAdd} noValidate className="mt-3 flex gap-2">
        <label htmlFor="new-category" className="sr-only">
          New category name
        </label>
        <input
          id="new-category"
          placeholder="New category, e.g. Pets"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'new-category-error' : undefined}
          className={inputClass}
        />
        <button type="submit" className="shrink-0 rounded-xl bg-accent px-4 font-medium text-accent-ink">
          Add
        </button>
      </form>
      {error && (
        <p id="new-category-error" className="mt-1.5 text-sm text-expense">
          {error}
        </p>
      )}
    </section>
  );
}

function CategoryRow({ category, count, onDelete }: { category: Category; count: number; onDelete: () => void }) {
  const { categories, saveCategory } = useData();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    const problem = validateCategoryName(name, categories, category.id);
    setError(problem);
    if (problem) return;
    await saveCategory({ ...category, name: name.trim() });
    setEditing(false);
  };

  if (editing) {
    return (
      <li className="px-4 py-3">
        <form onSubmit={onSave} noValidate className="flex gap-2">
          <label htmlFor={`rename-${category.id}`} className="sr-only">
            New name for {category.name}
          </label>
          <input
            id={`rename-${category.id}`}
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            className={`${inputClass} py-2`}
          />
          <button type="submit" className="shrink-0 rounded-lg bg-accent px-3 font-medium text-accent-ink">
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setName(category.name);
              setError(null);
            }}
            className="shrink-0 px-2 text-muted"
          >
            Cancel
          </button>
        </form>
        {error && <p className="mt-1.5 text-sm text-expense">{error}</p>}
      </li>
    );
  }

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate">{category.name}</span>
        <span className="num block text-sm text-muted">
          {count} {count === 1 ? 'entry' : 'entries'}
        </span>
      </span>
      <button type="button" onClick={() => setEditing(true)} className="px-2 py-1 text-sm text-accent">
        Rename
      </button>
      {category.id !== OTHER_CATEGORY_ID && (
        <button type="button" onClick={onDelete} className="px-2 py-1 text-sm text-expense">
          Delete
        </button>
      )}
    </li>
  );
}

function Backup({ onStatus }: { onStatus: (s: Status) => void }) {
  const { entries, categories, today, categoryName, replaceAll, storageStatus, requestPersistentStorage } =
    useData();
  const fileInput = useRef<HTMLInputElement>(null);

  const onExport = () => {
    const backup = createBackup({ entries, categories }, new Date().toISOString());
    download(`money-tracker-backup-${today}.json`, JSON.stringify(backup, null, 2), 'application/json');
    onStatus({ kind: 'ok', text: `Backup saved with ${entries.length} entries.` });
  };

  const onCSV = () => {
    download(`money-tracker-${today}.csv`, toCSV(entries, categoryName), 'text/csv;charset=utf-8');
    onStatus({ kind: 'ok', text: `CSV saved with ${entries.length} entries.` });
  };

  const onImport = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again
    if (!file) return;
    const result = parseBackup(await file.text());
    if (!result.ok) {
      onStatus({ kind: 'error', text: `Could not import ${file.name}: ${result.error}` });
      return;
    }
    const { entries: incoming, categories: incomingCategories } = result.data;
    const ok = window.confirm(
      `Replace everything on this device with the backup?\n\n` +
        `This device: ${entries.length} entries, ${categories.length} categories.\n` +
        `Backup: ${incoming.length} entries, ${incomingCategories.length} categories.\n\n` +
        `The current data will be gone. Export a backup first if you want to keep it.`,
    );
    if (!ok) return;
    await replaceAll(result.data);
    onStatus({ kind: 'ok', text: [`Imported ${incoming.length} entries.`, ...result.warnings].join(' ') });
  };

  return (
    <section aria-labelledby="backup">
      <SectionTitle id="backup" title="Backup and export">
        Your data lives only on this device. Save a backup to keep it safe or to move it to another device.
      </SectionTitle>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onExport} className={buttonClass}>
          Save backup
        </button>
        <button type="button" onClick={() => fileInput.current?.click()} className={buttonClass}>
          Restore from backup
        </button>
        <button type="button" onClick={onCSV} className={buttonClass}>
          Export CSV
        </button>
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          onChange={onImport}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
        />
      </div>
      <p className="mt-2 text-sm text-muted">
        Restoring replaces everything on this device. The CSV opens in Excel or Numbers and can't be imported back.
      </p>
      {storageStatus === 'persistent' && (
        <p className="mt-4 text-sm">Your browser keeps this data permanently. It won't be cleared to free up space.</p>
      )}
      {storageStatus === 'best-effort' && (
        <div className="mt-4 rounded-xl border border-line px-4 py-3 text-sm">
          <p>
            Your browser may clear this data if the device runs low on space. Installing the app to your home
            screen usually stops that. Until then, save a backup now and then.
          </p>
          <button type="button" onClick={() => void requestPersistentStorage()} className="mt-2 font-medium text-accent">
            Ask the browser to keep it
          </button>
        </div>
      )}
      {storageStatus === 'unsupported' && (
        <p className="mt-4 text-sm text-muted">
          This browser can't promise to keep the data, so save a backup now and then.
        </p>
      )}
    </section>
  );
}
