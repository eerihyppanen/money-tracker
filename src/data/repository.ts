import type { Category, Entry, ISODate } from '../domain/types';

/** Everything the app stores. Also the shape of a JSON backup. */
export interface AppData {
  entries: Entry[];
  categories: Category[];
}

/**
 * Storage boundary. The UI only talks to this interface, so the IndexedDB
 * implementation can be swapped for a Supabase one later without touching views.
 *
 * Change numbers: every change a person makes (save, delete, restore, Undo) increases a number
 * stored with the data, in the same transaction, and returns the new value. An Undo passes back
 * the number its delete returned (`ifLatest`) and only goes ahead, inside its own transaction,
 * while that is still the latest change. So an Undo can never mix old data into anything saved
 * since: in this tab, in another tab, or by restoring a backup. A delete that finds nothing to
 * delete changes nothing and keeps the number as it is.
 */
export interface Repository {
  /** Creates the default categories on first run. Safe to call every start. */
  init(): Promise<void>;

  listEntries(): Promise<Entry[]>;
  listCategories(): Promise<Category[]>;

  putEntry(entry: Entry): Promise<number>;
  putEntries(entries: Entry[]): Promise<number>;
  /**
   * Deletes entries and returns what was really deleted, read in the same transaction: the
   * stored version (maybe newer than what a screen showed), and nothing for ids already gone.
   * Undo puts back exactly these.
   */
  deleteEntry(id: string): Promise<{ change: number; deleted: Entry[] }>;
  deleteEntries(ids: string[]): Promise<{ change: number; deleted: Entry[] }>;
  putCategory(category: Category): Promise<number>;
  /**
   * Deletes a category and moves its entries to `fallbackCategoryId`. Returns the category as
   * stored when deleted (null if it was already gone) and which entries it really moved.
   */
  deleteCategory(
    id: string,
    fallbackCategoryId: string,
  ): Promise<{ change: number; deleted: Category | null; movedEntryIds: string[] }>;
  /** Replaces all data at once (used by backup import). */
  replaceAll(data: AppData): Promise<number>;

  /**
   * Puts back records that no longer exist (Undo, sample data). Existing records are never
   * overwritten. With `ifLatest`, only while that is still the latest change. Returns the new
   * change number, or null when nothing was done because something changed since.
   */
  restoreMissing(data: Partial<AppData>, ifLatest?: number): Promise<number | null>;
  /**
   * Undoes a category delete, only while `ifLatest` is still the latest change: re-creates the
   * category if it is still gone and moves the given entries back if they are still in
   * `fromCategoryId` (only their category changes). Returns the new change number, or null.
   */
  undoCategoryDelete(
    category: Category,
    entryIds: string[],
    fromCategoryId: string,
    ifLatest: number,
  ): Promise<number | null>;

  /**
   * Moves every passed due date forward (see `rollForward`). Runs as one transaction that
   * changes only due dates, so it can never undo an edit or a delete made at the same time.
   * Automatic, not a person's change: it leaves the change number alone.
   */
  advanceDueDates(today: ISODate): Promise<void>;
}
