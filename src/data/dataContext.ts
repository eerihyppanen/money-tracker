import { createContext, useContext } from 'react';
import type { Category, Entry, ISODate } from '../domain/types';
import type { StorageStatus } from './persistence';
import type { AppData } from './repository';

/**
 * What a change returns, so an Undo can later check that nothing has changed since:
 * `tab` counts changes seen by this tab (including other tabs' announcements) and decides
 * whether an Undo is offered at all; `stored` is the change number saved with the data, which
 * storage checks again, inside the Undo's own transaction, before undoing anything.
 */
export interface Change {
  tab: number;
  stored: number;
}

export interface DataContextValue {
  loading: boolean;
  error: string | null;
  /** Whether the browser has promised not to clear the data; null until checked. */
  storageStatus: StorageStatus | null;
  /** Asks the browser again for permanent storage (some only agree after a tap). */
  requestPersistentStorage: () => Promise<void>;
  /** Today's date, refreshed whenever the app comes back to the foreground. */
  today: ISODate;
  entries: Entry[];
  categories: Category[];
  categoryName: (id: string) => string;
  saveEntry: (entry: Entry) => Promise<Change>;
  deleteEntry: (id: string) => Promise<Change>;
  deleteEntries: (ids: string[]) => Promise<Change>;
  saveCategory: (category: Category) => Promise<Change>;
  /** Also says which entries the delete actually moved to Other. */
  deleteCategory: (id: string) => Promise<Change & { movedEntryIds: string[] }>;
  replaceAll: (data: AppData) => Promise<Change>;
  /**
   * Puts deleted records back as they were (Undo, sample data); existing records are never
   * overwritten. With `after` (the delete's change), only while nothing has changed since.
   * Resolves to null when it did nothing for that reason.
   */
  restore: (data: Partial<AppData>, after?: Change) => Promise<Change | null>;
  /**
   * Undoes a category delete, only while nothing has changed since `after`: brings the
   * category back and moves back the entries the delete moved. Null when it did nothing.
   */
  undoCategoryDelete: (category: Category, entryIds: string[], after: Change) => Promise<Change | null>;
  /** True while this tab has seen no other change since this one. */
  isLatestWrite: (change: Change) => boolean;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
