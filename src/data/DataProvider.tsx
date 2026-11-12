import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { todayISO } from '../domain/dates';
import { rollForward } from '../domain/schedule';
import { OTHER_CATEGORY_ID, type Category, type Entry } from '../domain/types';
import { DataContext, type DataContextValue } from './dataContext';
import { repository } from './index';
import { ensurePersistentStorage, type StorageStatus } from './persistence';

/** Alphabetical, with the catch-all "Other" always last. */
function sortCategories(categories: Category[]): Category[] {
  return [...categories].sort((a, b) =>
    a.id === OTHER_CATEGORY_ID ? 1 : b.id === OTHER_CATEGORY_ID ? -1 : a.name.localeCompare(b.name),
  );
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => todayISO());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);

  /** Moves passed due dates forward, saves the changes, then reloads everything. */
  const refresh = useCallback(async () => {
    const now = todayISO();
    const stored = await repository.listEntries();
    const rolled = stored.map((e) => rollForward(e, now));
    const changed = rolled.filter((e, i) => e !== stored[i]);
    if (changed.length > 0) await repository.putEntries(changed);
    setToday(now);
    setEntries(rolled);
    setCategories(sortCategories(await repository.listCategories()));
  }, []);

  useEffect(() => {
    const start = async () => {
      try {
        await repository.init();
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoading(false);
      }
    };
    void start();
    // Ask the browser not to clear the database; runs alongside loading, never blocks it.
    void ensurePersistentStorage().then(setStorageStatus);

    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refresh]);

  const value = useMemo<DataContextValue>(() => {
    const names = new Map(categories.map((c) => [c.id, c.name]));
    return {
      loading,
      error,
      storageStatus,
      async requestPersistentStorage() {
        setStorageStatus(await ensurePersistentStorage());
      },
      today,
      entries,
      categories,
      categoryName: (id) => names.get(id) ?? 'Other',
      async saveEntry(entry) {
        const stamped = { ...entry, updatedAt: new Date().toISOString() };
        await repository.putEntry(rollForward(stamped, todayISO()));
        await refresh();
      },
      async deleteEntry(id) {
        await repository.deleteEntry(id);
        await refresh();
      },
      async saveCategory(category) {
        await repository.putCategory(category);
        await refresh();
      },
      async deleteCategory(id) {
        if (id === OTHER_CATEGORY_ID) throw new Error('The Other category cannot be deleted.');
        await repository.deleteCategory(id, OTHER_CATEGORY_ID);
        await refresh();
      },
      async replaceAll(data) {
        await repository.replaceAll(data);
        await refresh();
      },
    };
  }, [loading, error, storageStatus, today, entries, categories, refresh]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}