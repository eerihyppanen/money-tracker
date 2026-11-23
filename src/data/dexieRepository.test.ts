import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import type { Entry } from '../domain/types';
import { createDexieRepository } from './dexieRepository';

let dbCount = 0;
const freshRepository = async () => {
  const repo = createDexieRepository(`repository-test-${++dbCount}`);
  await repo.init();
  return repo;
};

const rent: Entry = {
  id: 'rent',
  name: 'Rent',
  amountCents: 95000,
  type: 'expense',
  frequency: 'monthly',
  categoryId: 'housing',
  nextDueDate: '2026-10-01', // passed: should move to 1.12.2026 on 11.11.2026
  anchorDay: 1,
  startDate: '2025-01-01',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

describe('advanceDueDates', () => {
  it('moves passed due dates forward and leaves everything else alone', async () => {
    const repo = await freshRepository();
    const future = { ...rent, id: 'gym', nextDueDate: '2026-12-05', anchorDay: 5 };
    await repo.putEntries([rent, future]);

    await repo.advanceDueDates('2026-11-11');

    const byId = Object.fromEntries((await repo.listEntries()).map((e) => [e.id, e]));
    expect(byId.rent).toEqual({ ...rent, nextDueDate: '2026-12-01' });
    expect(byId.gym).toEqual(future);
  });

  it('never undoes an edit made at the same time', async () => {
    const repo = await freshRepository();
    await repo.putEntry(rent);

    // The user saves a new amount while the automatic update is running.
    await Promise.all([repo.advanceDueDates('2026-11-11'), repo.putEntry({ ...rent, amountCents: 100000 })]);

    expect((await repo.listEntries())[0].amountCents).toBe(100000);
  });

  it('never brings back an entry deleted at the same time', async () => {
    const repo = await freshRepository();
    await repo.putEntry(rent);

    await Promise.all([repo.advanceDueDates('2026-11-11'), repo.deleteEntry('rent')]);

    expect(await repo.listEntries()).toEqual([]);
  });
});

describe('Undo in storage', () => {
  const housing = { id: 'housing', name: 'Housing', isDefault: true };

  it('restoreMissing puts back what is gone and never overwrites what exists', async () => {
    const repo = await freshRepository();
    const edited = { ...rent, amountCents: 100000 }; // changed meanwhile, e.g. in another tab
    await repo.putEntry(edited);

    const gym = { ...rent, id: 'gym', name: 'Gym' };
    await repo.restoreMissing({ entries: [rent, gym] });

    const byId = Object.fromEntries((await repo.listEntries()).map((e) => [e.id, e]));
    expect(byId.rent).toEqual(edited);
    expect(byId.gym).toEqual(gym);
  });

  it('deleteCategory reports only the entries it really moved', async () => {
    const repo = await freshRepository();
    // Water was already moved from Housing to Other (say, in another tab) before the delete.
    await repo.putEntries([rent, { ...rent, id: 'water', name: 'Water', categoryId: 'other' }]);

    const { movedEntryIds } = await repo.deleteCategory('housing', 'other');

    expect(movedEntryIds).toEqual(['rent']);
  });

  it('undoCategoryDelete brings back the category and only the entries the delete moved', async () => {
    const repo = await freshRepository();
    await repo.putEntries([rent, { ...rent, id: 'water', name: 'Water', categoryId: 'other' }]);
    const { change, movedEntryIds } = await repo.deleteCategory('housing', 'other');

    expect(await repo.undoCategoryDelete(housing, movedEntryIds, 'other', change)).toBe(change + 1);

    const byId = Object.fromEntries((await repo.listEntries()).map((e) => [e.id, e]));
    expect(byId.rent.categoryId).toBe('housing');
    expect(byId.water.categoryId).toBe('other'); // it was in Other before the delete
    expect((await repo.listCategories()).some((c) => c.id === 'housing')).toBe(true);
  });

  it('refuses a category Undo once anything has changed since, even in another tab', async () => {
    const repo = await freshRepository();
    await repo.putEntry(rent);
    const { change, movedEntryIds } = await repo.deleteCategory('housing', 'other');
    await repo.putEntry({ ...rent, categoryId: 'other', amountCents: 100000 }); // another tab

    expect(await repo.undoCategoryDelete(housing, movedEntryIds, 'other', change)).toBeNull();

    expect(await repo.listEntries()).toMatchObject([{ categoryId: 'other', amountCents: 100000 }]);
    expect((await repo.listCategories()).some((c) => c.id === 'housing')).toBe(false);
  });

  it('refuses to put a deleted entry back into a backup restored since', async () => {
    const repo = await freshRepository();
    await repo.putEntry(rent);
    const { change } = await repo.deleteEntry('rent');
    const gym = { ...rent, id: 'gym', name: 'Gym' };
    await repo.replaceAll({ entries: [gym], categories: [housing] }); // another tab restores a backup

    expect(await repo.restoreMissing({ entries: [rent] }, change)).toBeNull();
    expect(await repo.listEntries()).toEqual([gym]);
  });

  it('puts a deleted entry back while nothing has changed since', async () => {
    const repo = await freshRepository();
    await repo.putEntry(rent);
    const { change } = await repo.deleteEntry('rent');
    expect(await repo.restoreMissing({ entries: [rent] }, change)).toBe(change + 1);
    expect(await repo.listEntries()).toEqual([rent]);
  });

  it('a delete returns the stored version it removed, which may be newer than a screen showed', async () => {
    const repo = await freshRepository();
    await repo.putEntry(rent);
    await repo.putEntry({ ...rent, amountCents: 100000 }); // saved in another tab

    expect((await repo.deleteEntry('rent')).deleted).toEqual([{ ...rent, amountCents: 100000 }]);
    expect((await repo.deleteEntries(['rent', 'gone'])).deleted).toEqual([]); // already deleted
  });

  it('a category delete returns the category as stored', async () => {
    const repo = await freshRepository();
    await repo.putCategory({ ...housing, name: 'Home' }); // renamed in another tab
    expect((await repo.deleteCategory('housing', 'other')).deleted).toEqual({ ...housing, name: 'Home' });
    expect((await repo.deleteCategory('housing', 'other')).deleted).toBeNull();
  });
});

describe('change numbers', () => {
  it('stay the same when a delete finds nothing to delete', async () => {
    const repo = await freshRepository();
    await repo.putEntry(rent);
    const first = await repo.deleteEntry('rent');
    // Another tab deletes the same entry a moment later: nothing left to delete.
    const second = await repo.deleteEntry('rent');
    expect(second).toEqual({ change: first.change, deleted: [] });
    // So the delete that really happened can still be undone.
    expect(await repo.restoreMissing({ entries: first.deleted }, first.change)).toBe(first.change + 1);
  });

  it('stay the same when a category is deleted twice', async () => {
    const repo = await freshRepository();
    await repo.putEntry(rent);
    const first = await repo.deleteCategory('housing', 'other');
    const second = await repo.deleteCategory('housing', 'other');
    expect(second).toEqual({ change: first.change, deleted: null, movedEntryIds: [] });
    expect(await repo.undoCategoryDelete(first.deleted!, first.movedEntryIds, 'other', first.change)).toBe(first.change + 1);
  });

  it('go up with every change and not with the automatic due-date update', async () => {
    const repo = await freshRepository();
    const first = await repo.putEntry(rent);
    expect(await repo.putCategory({ id: 'pets', name: 'Pets', isDefault: false })).toBe(first + 1);
    await repo.advanceDueDates('2026-11-11');
    expect((await repo.deleteEntry('rent')).change).toBe(first + 2);
  });

  it('are added to an existing database without touching its data', async () => {
    const name = `repository-test-upgrade-${++dbCount}`;
    const old = new Dexie(name);
    old.version(1).stores({ entries: 'id, type, categoryId, frequency, nextDueDate', categories: 'id' });
    await old.table('entries').put(rent);
    await old.table('categories').put({ id: 'housing', name: 'Housing', isDefault: true });
    old.close();

    const repo = createDexieRepository(name);
    await repo.init();
    expect(await repo.listEntries()).toEqual([rent]);
    expect(await repo.listCategories()).toEqual([{ id: 'housing', name: 'Housing', isDefault: true }]);
    expect(await repo.putEntry(rent)).toBe(1);
  });
});
