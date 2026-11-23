import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { todayISO } from '../domain/dates';
import { rollForward } from '../domain/schedule';
import { OTHER_CATEGORY_ID, type Category, type Entry } from '../domain/types';
import { DataContext, type Change, type DataContextValue } from './dataContext';
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

  /**
   * Every change made through the context gets the next number, after closing any pending
   * Undo. An Undo is only offered while its delete is still the latest change (isLatestWrite).
   */
  const writeCount = useRef(0);
  const beginWrite = useCallback(() => {
    onWrite?.();
    return ++writeCount.current;
  }, [onWrite]);

  /** Messages to and from other open tabs of the app (same browser), about changed data. */
  const otherTabs = useRef<BroadcastChannel | null>(null);

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

  // Another tab changed the data: treat it like a write here (closes a pending Undo and makes
  // older Undo offers stale), then reload. A tab never receives its own messages.
  useEffect(() => {
    if (typeof BroadcastChannel !== 'function') return;
    const channel = new BroadcastChannel('money-tracker:changes');
    otherTabs.current = channel;
    channel.onmessage = () => {
      beginWrite();
      void refresh();
    };
    return () => {
      channel.close();
      otherTabs.current = null;
    };
  }, [beginWrite, refresh]);

  const value = useMemo<DataContextValue>(() => {
    const names = new Map(categories.map((c) => [c.id, c.name]));

    /** One change: closes a pending Undo, stores it, tells other tabs, reloads. */
    const write = async (store: () => Promise<number>): Promise<Change> => {
      const tab = beginWrite();
      const stored = await store();
      otherTabs.current?.postMessage('changed');
      await refresh();
      return { tab, stored };
    };
    /** Like `write`, for an Undo that storage refuses (null) when something changed since. */
    const writeIfLatest = async (store: () => Promise<number | null>): Promise<Change | null> => {
      const tab = beginWrite();
      const stored = await store();
      if (stored !== null) otherTabs.current?.postMessage('changed');
      await refresh();
      return stored === null ? null : { tab, stored };
    };

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
      isLatestWrite: (change) => change.tab === writeCount.current,
      saveEntry: (entry) =>
        write(() => repository.putEntry(rollForward({ ...entry, updatedAt: new Date().toISOString() }, todayISO()))),
      deleteEntry: (id) => write(() => repository.deleteEntry(id)),
      deleteEntries: (ids) => write(() => repository.deleteEntries(ids)),
      saveCategory: (category) => write(() => repository.putCategory(category)),
      async deleteCategory(id) {
        if (id === OTHER_CATEGORY_ID) throw new Error('The Other category cannot be deleted.');
        let movedEntryIds: string[] = [];
        const change = await write(async () => {
          const result = await repository.deleteCategory(id, OTHER_CATEGORY_ID);
          movedEntryIds = result.movedEntryIds;
          return result.change;
        });
        return { ...change, movedEntryIds };
      },
      replaceAll: (data) => write(() => repository.replaceAll(data)),
      restore: ({ entries: restored = [], categories: restoredCategories = [] }, after) =>
        writeIfLatest(() =>
          repository.restoreMissing(
            { categories: restoredCategories, entries: restored.map((e) => rollForward(e, todayISO())) },
            after?.stored,
          ),
        ),
      undoCategoryDelete: (category, entryIds, after) =>
        writeIfLatest(() => repository.undoCategoryDelete(category, entryIds, OTHER_CATEGORY_ID, after.stored)),
    };
  }, [loading, error, storageStatus, today, entries, categories, refresh, beginWrite]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}