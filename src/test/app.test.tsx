// @vitest-environment jsdom
/**
 * Screen-level tests: the whole app rendered in a simulated browser with an in-memory
 * IndexedDB, driven the way a person would use it. "Today" is fixed to 11.11.2026.
 */
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { repository } from '../data';
import { DEFAULT_CATEGORIES, type Entry } from '../domain/types';

function entry(overrides: Partial<Entry>): Entry {
  return {
    id: 'rent',
    name: 'Rent',
    amountCents: 95000,
    type: 'expense',
    frequency: 'monthly',
    categoryId: 'housing',
    nextDueDate: '2026-12-01',
    anchorDay: 1,
    startDate: '2025-01-01',
    active: true,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/** Opens the app at a route and waits until data has loaded. */
async function openApp(hash: string) {
  window.location.hash = hash;
  render(<App />);
  await screen.findByRole('heading', { level: 1 });
  return userEvent.setup();
}

/** Text with Intl's non-breaking spaces turned into ordinary ones, for readable assertions. */
const text = (el: HTMLElement) => (el.textContent ?? '').replace(/[  ]/g, ' ');

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(2026, 10, 11, 10, 0) });
  await repository.init();
  await repository.replaceAll({ entries: [], categories: DEFAULT_CATEGORIES });
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('adding an entry', () => {
  it('shows the new entry in the list and in the overview totals', async () => {
    const user = await openApp('#/entry/new');

    await user.type(screen.getByLabelText('Amount'), '900,5');
    await user.type(screen.getByLabelText('Name'), 'Rent');
    await user.selectOptions(screen.getByLabelText('Category'), 'housing');
    fireEvent.change(screen.getByLabelText('Next due date'), { target: { value: '2026-12-01' } });
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    // Back on the list
    const row = (await screen.findByText('Rent')).closest('a')!;
    expect(text(row)).toContain('Housing, monthly');
    expect(text(row)).toContain('−900,50 €');
    expect(text(row)).toContain('10 806,00 € / year');

    // Overview: counted in the average month and listed as upcoming
    await user.click(screen.getAllByRole('link', { name: 'Overview' })[0]);
    const average = await screen.findByRole('region', { name: 'Average month' });
    expect(text(average)).toContain('−900,50 €');
    const upcoming = screen.getByRole('region', { name: 'Next 30 days' });
    expect(text(upcoming)).toContain('Tue 1.12.');
    expect(text(upcoming)).toContain('Rent');
  });

  it('refuses to save an empty form and explains why', async () => {
    const user = await openApp('#/entry/new');
    await user.click(screen.getByRole('button', { name: 'Add entry' }));

    expect(screen.getByText('Enter a name.')).toBeInTheDocument();
    expect(screen.getByText('Enter an amount, like 12,50.')).toBeInTheDocument();
    expect(await repository.listEntries()).toHaveLength(0);
  });
});

describe('editing and deleting', () => {
  it('saves a new amount, then deletes the entry without asking', async () => {
    await repository.putEntry(entry({}));
    const user = await openApp('#/entry/rent');

    const amount = screen.getByLabelText('Amount');
    expect(amount).toHaveValue('950,00');
    await user.clear(amount);
    await user.type(amount, '1000');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));

    const row = (await screen.findByText('Rent')).closest('a')!;
    expect(text(row)).toContain('−1 000,00 €');

    const confirm = vi.spyOn(window, 'confirm');
    await user.click(row);
    await user.click(await screen.findByRole('button', { name: 'Delete' }));

    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByText('No entries yet')).toBeInTheDocument();
    expect(screen.getByText('Deleted "Rent"')).toBeInTheDocument();
    expect(await repository.listEntries()).toHaveLength(0);
  });

  it('brings a deleted entry back exactly as it was with Undo', async () => {
    const rent = entry({ notes: 'Paid by e-invoice' });
    await repository.putEntry(rent);
    const user = await openApp('#/entry/rent');

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));

    expect(await screen.findByText('Rent')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(await repository.listEntries()).toEqual([rent]);
  });
});

describe('months', () => {
  const heading = () => screen.getByRole('heading', { level: 1 }).textContent;
  const swipe = (dx: number, dy = 0) => {
    const target = screen.getByRole('heading', { level: 1 });
    fireEvent.touchStart(target, { touches: [{ clientX: 200, clientY: 300 }] });
    fireEvent.touchEnd(target, { changedTouches: [{ clientX: 200 + dx, clientY: 300 + dy }] });
  };

  it('moves between months with the arrows and with swipes', async () => {
    await repository.putEntry(entry({}));
    const user = await openApp('#/month');
    expect(heading()).toBe('November 2026');

    await user.click(screen.getByRole('link', { name: 'Next month' }));
    expect(heading()).toBe('December 2026');

    swipe(-150); // swipe left: next month
    expect(await screen.findByRole('heading', { name: 'January 2027' })).toBeInTheDocument();

    swipe(150); // swipe right: previous month
    expect(await screen.findByRole('heading', { name: 'December 2026' })).toBeInTheDocument();

    swipe(40, 400); // scrolling down is not a swipe
    expect(heading()).toBe('December 2026');

    await user.click(screen.getByRole('link', { name: 'This month' }));
    expect(heading()).toBe('November 2026');
  });

  it('shows a yearly bill only in its own month', async () => {
    await repository.putEntry(
      entry({ id: 'car', name: 'Car insurance', frequency: 'yearly', categoryId: 'insurance', amountCents: 48000, nextDueDate: '2027-03-15', anchorDay: 15 }),
    );
    await openApp('#/month?m=2027-02');
    expect(screen.queryByText('Car insurance')).not.toBeInTheDocument();

    cleanup();
    await openApp('#/month?m=2027-03');
    const payments = screen.getByRole('region', { name: 'Payments' });
    expect(text(payments)).toContain('Car insurance');
    expect(text(payments)).toContain('−480,00 €');
  });
});

describe('settings', () => {
  it('adds a category that can then be picked for an entry', async () => {
    const user = await openApp('#/settings');
    await user.type(screen.getByLabelText('New category name'), 'Pets');
    await user.click(screen.getByRole('button', { name: 'Add' }));
    expect(await screen.findByText('Pets')).toBeInTheDocument();

    await user.click(screen.getAllByRole('link', { name: 'Add entry' })[0]);
    const category = await screen.findByLabelText('Category');
    expect(within(category).getByRole('option', { name: 'Pets' })).toBeInTheDocument();
  });

  it('deletes a category, and Undo moves its entries back from Other', async () => {
    const rent = entry({});
    await repository.putEntry(rent);
    const user = await openApp('#/settings');
    const housingRow = () => screen.getByText('Housing').closest('li')!;

    await user.click(within(housingRow()).getByRole('button', { name: 'Delete' }));
    const undo = await screen.findByRole('button', { name: 'Undo' });
    expect(screen.queryByText('Housing')).not.toBeInTheDocument();
    expect(screen.getByText('Deleted "Housing", 1 entry moved to Other')).toBeInTheDocument();
    expect((await repository.listEntries())[0].categoryId).toBe('other');

    await user.click(undo);
    expect(await screen.findByText('Housing')).toBeInTheDocument();
    expect(text(housingRow())).toContain('1 entry');
    expect(await repository.listEntries()).toEqual([rent]);
  });
});

describe('backup reminder', () => {
  it('asks for a backup until one is saved, then stays quiet', async () => {
    const created = vi.fn((_blob: Blob) => 'blob:backup');
    URL.createObjectURL = created;
    URL.revokeObjectURL = vi.fn();
    const clicked = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await repository.putEntry(entry({}));
    const user = await openApp('#/');

    expect(screen.getByText("Your entries aren't backed up yet.")).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save backup' }));

    expect(clicked).toHaveBeenCalledOnce();
    const saved = JSON.parse(await created.mock.calls[0][0].text());
    expect(saved.entries.map((e: Entry) => e.name)).toEqual(['Rent']);
    expect(screen.queryByText(/backed up yet/)).not.toBeInTheDocument();

    // Still quiet after reopening the app, and Settings shows the date.
    cleanup();
    await openApp('#/');
    expect(screen.queryByRole('button', { name: 'Save backup' })).not.toBeInTheDocument();
    cleanup();
    await openApp('#/settings');
    expect(screen.getByText(/Last backup saved 11\.11\.2026\./)).toBeInTheDocument();
  });

  it('comes back 30 days after the last backup', async () => {
    localStorage.setItem('money-tracker:last-backup', '2026-10-12');
    await repository.putEntry(entry({}));
    await openApp('#/');
    expect(screen.getByText('Last backup 30 days ago.')).toBeInTheDocument();
  });
});
