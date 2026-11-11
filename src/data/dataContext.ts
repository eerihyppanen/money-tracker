import { createContext, useContext } from 'react';
import type { Category, Entry, ISODate } from '../domain/types';
import type { AppData } from './repository';

export interface DataContextValue {
  loading: boolean;
  error: string | null;
  /** Today's date, refreshed whenever the app comes back to the foreground. */
  today: ISODate;
  entries: Entry[];
  categories: Category[];
  categoryName: (id: string) => string;
  saveEntry: (entry: Entry) => Promise<void>;
  deleteEntry: (id: string) => Promise<void>;
  saveCategory: (category: Category) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;
  replaceAll: (data: AppData) => Promise<void>;
}

export const DataContext = createContext<DataContextValue | null>(null);

export function useData(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used inside <DataProvider>');
  return ctx;
}
