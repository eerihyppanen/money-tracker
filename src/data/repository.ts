import type { Category, Entry, ISODate } from '../domain/types';

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
  /**
   * Moves every passed due date forward (see `rollForward`). Runs as one transaction that
   * changes only due dates, so it can never undo an edit or a delete made at the same time.
   */
  advanceDueDates(today: ISODate): Promise<void>;

  listCategories(): Promise<Category[]>;
  putCategory(category: Category): Promise<void>;
  /** Deletes a category and moves its entries to `fallbackCategoryId`. */
  deleteCategory(id: string, fallbackCategoryId: string): Promise<void>;

  /**
   * Puts back records that no longer exist, for Undo. Records that exist are left alone, so
   * an Undo can never overwrite a change made since (in this tab or another). One transaction.
   */
  restoreMissing(data: Partial<AppData>): Promise<void>;
  /**
   * Undoes a category delete: re-creates the category if it is still gone, and moves back the
   * given entries that are still in `fromCategoryId`. Only their category changes. One transaction.
   */
  undoCategoryDelete(category: Category, entryIds: string[], fromCategoryId: string): Promise<void>;

  /** Replaces all data at once (used by backup import). */
  replaceAll(data: AppData): Promise<void>;
}
