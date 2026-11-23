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
