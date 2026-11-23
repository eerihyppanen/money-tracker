// @vitest-environment jsdom
/** Two DataProviders on one database behave like two open tabs of the app. */
import { cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CATEGORIES, type Entry } from '../domain/types';
import { useData, type DataContextValue } from './dataContext';
import { DataProvider } from './DataProvider';
import { repository } from './index';

const rent: Entry = {
  id: 'rent',
  name: 'Rent',
  amountCents: 95000,
  type: 'expense',
  frequency: 'monthly',
  categoryId: 'housing',
  nextDueDate: '2099-01-01',
  anchorDay: 1,
  startDate: '2025-01-01',
  active: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

function openTab() {
  const onWrite = vi.fn<() => void>();
  const tab: { data?: DataContextValue; onWrite: typeof onWrite } = { onWrite };
  function Probe() {
    tab.data = useData();
    return null;
  }
  render(
    <DataProvider onWrite={tab.onWrite}>
      <Probe />
    </DataProvider>,
  );
  return tab;
}

beforeEach(async () => {
  await repository.init();
  await repository.replaceAll({ entries: [], categories: DEFAULT_CATEGORIES });
});
afterEach(cleanup);

describe('more than one tab', () => {
  it('a change in one tab closes the Undo in another and shows the change there', async () => {
    const a = openTab();
    const b = openTab();
    await waitFor(() => expect(a.data!.loading || b.data!.loading).toBe(false));

    // Tab A deletes a category: its Undo would be offered for this write.
    const version = await a.data!.deleteCategory('housing');
    expect(a.data!.isLatestWrite(version)).toBe(true);
    a.onWrite.mockClear();

    // Tab B saves an entry.
    await b.data!.saveEntry(rent);

    await waitFor(() => expect(a.data!.isLatestWrite(version)).toBe(false));
    expect(a.onWrite).toHaveBeenCalled(); // A's pending Undo is closed
    await waitFor(() => expect(a.data!.entries.map((e) => e.name)).toEqual(['Rent']));
  });

  it("a tab's own change does not count as someone else's", async () => {
    const a = openTab();
    openTab();
    await waitFor(() => expect(a.data!.loading).toBe(false));
    const version = await a.data!.saveEntry(rent);
    await new Promise((r) => setTimeout(r, 50));
    expect(a.data!.isLatestWrite(version)).toBe(true);
  });
});
