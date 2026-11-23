import Dexie, { type EntityTable } from 'dexie';
import { rollForward } from '../domain/schedule';
import { DEFAULT_CATEGORIES, type Category, type Entry } from '../domain/types';
import type { AppData, Repository } from './repository';

/** Small bookkeeping values kept with the data, such as the change number. */
interface Meta {
  key: string;
  value: number;
}

const CHANGE = 'change';

class TrackerDB extends Dexie {
  entries!: EntityTable<Entry, 'id'>;
  categories!: EntityTable<Category, 'id'>;
  meta!: EntityTable<Meta, 'key'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      entries: 'id, type, categoryId, frequency, nextDueDate',
      categories: 'id',
    });
    // Version 2 adds the change number; existing data is kept as it is.
    this.version(2).stores({
      entries: 'id, type, categoryId, frequency, nextDueDate',
      categories: 'id',
      meta: 'key',
    });
  }
}

/** IndexedDB storage. This is the only file that knows about Dexie. */
export function createDexieRepository(dbName = 'money-tracker'): Repository {
  const db = new TrackerDB(dbName);

  // Both must run inside a transaction that includes db.meta.
  const latestChange = async () => (await db.meta.get(CHANGE))?.value ?? 0;
  const nextChange = async () => {
    const change = (await latestChange()) + 1;
    await db.meta.put({ key: CHANGE, value: change });
    return change;
  };

  /** Runs `work` and records it as a change, all in one transaction. */
  const change = (tables: Dexie.Table[], work: () => Promise<unknown>) =>
    db.transaction('rw', [...tables, db.meta], async () => {
      await work();
      return nextChange();
    });

  /** Deletes entries, returning the stored versions that were really there (for Undo). */
  const deleteEntries = (ids: string[]) =>
    db.transaction('rw', db.entries, db.meta, async () => {
      const deleted = (await db.entries.bulkGet(ids)).filter((e): e is Entry => e !== undefined);
      // Nothing there (e.g. another tab deleted it first): no change, so that tab's Undo still works.
      if (deleted.length === 0) return { change: await latestChange(), deleted };
      await db.entries.bulkDelete(ids);
      return { change: await nextChange(), deleted };
    });

  return {
    async init() {
      await db.transaction('rw', db.categories, async () => {
        if ((await db.categories.count()) === 0) {
          await db.categories.bulkAdd(DEFAULT_CATEGORIES);
        }
      });
    },

    listEntries: () => db.entries.toArray(),
    listCategories: () => db.categories.toArray(),

    putEntry: (entry) => change([db.entries], () => db.entries.put(entry)),
    putEntries: (entries) => change([db.entries], () => db.entries.bulkPut(entries)),
    deleteEntry: (id) => deleteEntries([id]),
    deleteEntries,
    putCategory: (category) => change([db.categories], () => db.categories.put(category)),

    deleteCategory(id, fallbackCategoryId) {
      return db.transaction('rw', db.entries, db.categories, db.meta, async () => {
        // The entries really in the category now, not what some screen showed earlier.
        const deleted = (await db.categories.get(id)) ?? null;
        const movedEntryIds = (await db.entries.where('categoryId').equals(id).primaryKeys()) as string[];
        if (!deleted && movedEntryIds.length === 0) return { change: await latestChange(), deleted, movedEntryIds };
        await db.entries.where(':id').anyOf(movedEntryIds).modify({ categoryId: fallbackCategoryId });
        await db.categories.delete(id);
        return { change: await nextChange(), deleted, movedEntryIds };
      });
    },

    replaceAll: (data: AppData) =>
      change([db.entries, db.categories], async () => {
        await db.entries.clear();
        await db.categories.clear();
        await db.categories.bulkAdd(data.categories);
        await db.entries.bulkAdd(data.entries);
      }),

    restoreMissing({ entries = [], categories = [] }, ifLatest) {
      return db.transaction('rw', db.entries, db.categories, db.meta, async () => {
        if (ifLatest !== undefined && (await latestChange()) !== ifLatest) return null;
        for (const c of categories) if (!(await db.categories.get(c.id))) await db.categories.add(c);
        for (const e of entries) if (!(await db.entries.get(e.id))) await db.entries.add(e);
        return nextChange();
      });
    },

    undoCategoryDelete(category, entryIds, fromCategoryId, ifLatest) {
      return db.transaction('rw', db.entries, db.categories, db.meta, async () => {
        if ((await latestChange()) !== ifLatest) return null;
        if (!(await db.categories.get(category.id))) await db.categories.add(category);
        await db.entries
          .where(':id')
          .anyOf(entryIds)
          .filter((e) => e.categoryId === fromCategoryId)
          .modify({ categoryId: category.id });
        return nextChange();
      });
    },

    async advanceDueDates(today) {
      await db.transaction('rw', db.entries, async () => {
        await db.entries
          .where('nextDueDate')
          .below(today)
          .modify((entry) => {
            entry.nextDueDate = rollForward(entry, today).nextDueDate;
          });
      });
    },
  };
}
