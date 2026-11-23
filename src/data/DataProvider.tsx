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
   * An Undo is only offered while its delete is still the latest change (isLatestWrite):
   * - `writeCount` numbers this tab's own changes as they start, after closing any pending Undo,
   *   so a change started here while a delete was finishing makes that delete's Undo stale;
   * - `newestStored` is the highest stored change number this tab knows of, from its own changes
   *   and from other tabs' messages, so only a change stored *after* a delete makes it stale.
   */
  const writeCount = useRef(0);
  const newestStored = useRef(0);
  const beginWrite = useCallback(() => {
    onWrite?.();
    return ++writeCount.current;
  }, [onWrite]);
  const sawStored = (change: number) => {
    newestStored.current = Math.max(newestStored.current, change);
  };

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

  /**
   * Reloads after a stored change. The change has already happened, so a failed reload must not
   * make it look failed (no Undo, "nothing was changed"): report it and try again shortly.
   */
  const reloadAfterChange = useCallback(async () => {
    try {
      await refresh();
    } catch (error) {
      console.error('Could not reload after a change; trying again.', error);
      setTimeout(() => void refresh().catch((again) => console.error('Reload failed again.', again)), 1000);
    }
  }, [refresh]);

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

  // Another tab stored a change (its message carries the change number): reload, and if it is
  // newer than anything this tab knew of, close a pending Undo and make older offers stale. A
  // late message about an older change leaves a newer Undo alone. A tab never hears itself.
  useEffect(() => {
    if (typeof BroadcastChannel !== 'function') return;
    const channel = new BroadcastChannel('money-tracker:changes');
    otherTabs.current = channel;
    channel.onmessage = (event: MessageEvent<{ change?: unknown }>) => {
      const change = event.data?.change;
      const newer = typeof change !== 'number' || change > newestStored.current;
      if (newer) {
        newestStored.current = typeof change === 'number' ? change : Infinity;
        onWrite?.();
      }
      void refresh();
    };
    return () => {
      channel.close();
      otherTabs.current = null;
    };
  }, [onWrite, refresh]);

  const value = useMemo<DataContextValue>(() => {
    const names = new Map(categories.map((c) => [c.id, c.name]));

    /**
     * One change: closes a pending Undo, stores it, tells other tabs, reloads. Anything else the
     * storage call returns next to its change number (e.g. what a delete removed) is passed on.
     */
    const write = async <T extends { change: number }>(store: () => Promise<T>) => {
      const tab = beginWrite();
      const { change: stored, ...rest } = await store();
      sawStored(stored);
      otherTabs.current?.postMessage({ change: stored });
      await reloadAfterChange();
      return { tab, stored, ...rest };
    };
    const numbered = (pending: Promise<number>) => pending.then((change) => ({ change }));
    /** Like `write`, for an Undo that storage refuses (null) when something changed since. */
    const writeIfLatest = async (store: () => Promise<number | null>): Promise<Change | null> => {
      const tab = beginWrite();
      const stored = await store();
      if (stored !== null) {
        sawStored(stored);
        otherTabs.current?.postMessage({ change: stored });
      }
      await reloadAfterChange();
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
      isLatestWrite: (change) => change.tab === writeCount.current && change.stored >= newestStored.current,
      saveEntry: (entry) =>
        write(() =>
          numbered(repository.putEntry(rollForward({ ...entry, updatedAt: new Date().toISOString() }, todayISO()))),
        ),
      deleteEntry: (id) => write(() => repository.deleteEntry(id)),
      deleteEntries: (ids) => write(() => repository.deleteEntries(ids)),
      saveCategory: (category) => write(() => numbered(repository.putCategory(category))),
      deleteCategory(id) {
        if (id === OTHER_CATEGORY_ID) return Promise.reject(new Error('The Other category cannot be deleted.'));
        return write(() => repository.deleteCategory(id, OTHER_CATEGORY_ID));
      },
      replaceAll: (data) => write(() => numbered(repository.replaceAll(data))),
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
  }, [loading, error, storageStatus, today, entries, categories, reloadAfterChange, beginWrite]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}