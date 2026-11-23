import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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

/**
 * `onWrite` runs before every change made through the context (not the automatic roll-forward
 * on start or return); the app uses it to close a pending Undo.
 */
export function DataProvider({ children, onWrite }: { children: ReactNode; onWrite?: () => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [today, setToday] = useState(() => todayISO());
  const [entries, setEntries] = useState<Entry[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [storageStatus, setStorageStatus] = useState<StorageStatus | null>(null);
  /** The day the data was last refreshed for, readable from timers without re-subscribing. */
  const dayRef = useRef(today);

  /** Numbers each refresh, so a slow older one can't overwrite what a newer one showed. */
  const refreshCount = useRef(0);
  const shownRefresh = useRef(0);

  /** Moves passed due dates forward (in storage, atomically), then reloads everything. */
  const refresh = useCallback(async () => {
    const run = ++refreshCount.current;
    const now = todayISO();
    dayRef.current = now;
    await repository.advanceDueDates(now);
    const stored = await repository.listEntries();
    const storedCategories = await repository.listCategories();
    if (run < shownRefresh.current) return;
    shownRefresh.current = run;
    setToday(now);
    setEntries(stored);
    setCategories(sortCategories(storedCategories));
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

    // "Today" moves on when the app comes back into view, when its window gets focus again,
    // and when it stays open and in front past midnight (checked once a minute).
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onFocus = () => void refresh();
    const midnightCheck = setInterval(() => {
      if (todayISO() !== dayRef.current) void refresh();
    }, 60_000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onFocus);
      clearInterval(midnightCheck);
    };
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
        onWrite?.();
        const stamped = { ...entry, updatedAt: new Date().toISOString() };
        await repository.putEntry(rollForward(stamped, todayISO()));
        await refresh();
      },
      async deleteEntry(id) {
        onWrite?.();
        await repository.deleteEntry(id);
        await refresh();
      },
      async deleteEntries(ids) {
        onWrite?.();
        for (const id of ids) await repository.deleteEntry(id);
        await refresh();
      },
      async saveCategory(category) {
        onWrite?.();
        await repository.putCategory(category);
        await refresh();
      },
      async deleteCategory(id) {
        onWrite?.();
        if (id === OTHER_CATEGORY_ID) throw new Error('The Other category cannot be deleted.');
        await repository.deleteCategory(id, OTHER_CATEGORY_ID);
        await refresh();
      },
      async restore({ entries: restored = [], categories: restoredCategories = [] }) {
        onWrite?.();
        for (const c of restoredCategories) await repository.putCategory(c);
        if (restored.length > 0) await repository.putEntries(restored.map((e) => rollForward(e, todayISO())));
        await refresh();
      },
      async replaceAll(data) {
        onWrite?.();
        await repository.replaceAll(data);
        await refresh();
      },
    };
  }, [loading, error, storageStatus, today, entries, categories, refresh, onWrite]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}