import type { Category, Entry } from '../domain/types';

/** Everything the app stores. Also the shape of a JSON backup. */
export interface AppData {
  entries: Entry[];
  categories: Category[];
}

/**
 * Storage boundary. The UI only talks to this interface, so the IndexedDB
 * implementation can be swapped for a Supabase one later without touching views.
 */
export interface Repository {
  /** Creates the default categories on first run. Safe to call every start. */
  init(): Promise<void>;

  listEntries(): Promise<Entry[]>;
  putEntry(entry: Entry): Promise<void>;
  putEntries(entries: Entry[]): Promise<void>;
  deleteEntry(id: string): Promise<void>;

  listCategories(): Promise<Category[]>;
  putCategory(category: Category): Promise<void>;
  /** Deletes a category and moves its entries to `fallbackCategoryId`. */
  deleteCategory(id: string, fallbackCategoryId: string): Promise<void>;

  /** Replaces all data at once (used by backup import). */
  replaceAll(data: AppData): Promise<void>;
}
