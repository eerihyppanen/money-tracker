import { createContext, useContext } from 'react';
import type { Category, Entry, ISODate } from '../domain/types';
import type { StorageStatus } from './persistence';
import type { AppData } from './repository';

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
  // Every change resolves to its write number, for isLatestWrite.
  saveEntry: (entry: Entry) => Promise<number>;
  deleteEntry: (id: string) => Promise<number>;
  deleteEntries: (ids: string[]) => Promise<number>;
  saveCategory: (category: Category) => Promise<number>;
  deleteCategory: (id: string) => Promise<number>;
  replaceAll: (data: AppData) => Promise<number>;
  /** Puts deleted or changed records back exactly as they were, for Undo. */
  restore: (data: Partial<AppData>) => Promise<number>;
  /** True while no other change has started since the write with this number. */
  isLatestWrite: (version: number) => boolean;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
