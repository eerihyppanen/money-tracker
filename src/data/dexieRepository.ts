import Dexie, { type EntityTable } from 'dexie';
import { rollForward } from '../domain/schedule';
import { DEFAULT_CATEGORIES, type Category, type Entry } from '../domain/types';
import type { AppData, Repository } from './repository';

class TrackerDB extends Dexie {
  entries!: EntityTable<Entry, 'id'>;
  categories!: EntityTable<Category, 'id'>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      entries: 'id, type, categoryId, frequency, nextDueDate',
      categories: 'id',
    });
  }
}

/** IndexedDB storage. This is the only file that knows about Dexie. */
export function createDexieRepository(dbName = 'money-tracker'): Repository {
  const db = new TrackerDB(dbName);

  return {
    async init() {
      await db.transaction('rw', db.categories, async () => {
        if ((await db.categories.count()) === 0) {
          await db.categories.bulkAdd(DEFAULT_CATEGORIES);
        }
      });
    },

    listEntries: () => db.entries.toArray(),
    putEntry: async (entry) => {
      await db.entries.put(entry);
    },
    putEntries: async (entries) => {
      await db.entries.bulkPut(entries);
    },
    deleteEntry: (id) => db.entries.delete(id),
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

    listCategories: () => db.categories.toArray(),
    putCategory: async (category) => {
      await db.categories.put(category);
    },
    async deleteCategory(id, fallbackCategoryId) {
      await db.transaction('rw', db.entries, db.categories, async () => {
        await db.entries.where('categoryId').equals(id).modify({ categoryId: fallbackCategoryId });
        await db.categories.delete(id);
      });
    },

    async restoreMissing({ entries = [], categories = [] }) {
      await db.transaction('rw', db.entries, db.categories, async () => {
        for (const c of categories) if (!(await db.categories.get(c.id))) await db.categories.add(c);
        for (const e of entries) if (!(await db.entries.get(e.id))) await db.entries.add(e);
      });
    },

    async undoCategoryDelete(category, entryIds, fromCategoryId) {
      await db.transaction('rw', db.entries, db.categories, async () => {
        if (!(await db.categories.get(category.id))) await db.categories.add(category);
        await db.entries
          .where(':id')
          .anyOf(entryIds)
          .filter((e) => e.categoryId === fromCategoryId)
          .modify({ categoryId: category.id });
      });
    },

    async replaceAll(data: AppData) {
      await db.transaction('rw', db.entries, db.categories, async () => {
        await db.entries.clear();
        await db.categories.clear();
        await db.categories.bulkAdd(data.categories);
        await db.entries.bulkAdd(data.entries);
      });
    },
  };
}
