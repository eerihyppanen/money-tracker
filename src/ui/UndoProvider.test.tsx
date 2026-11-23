// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useUndo } from './undoContext';
import { UNDO_MS, UndoProvider } from './UndoProvider';

function DeleteButton({
  name,
  undo,
  isCurrent = () => true,
}: {
  name: string;
  undo: () => Promise<void>;
  isCurrent?: () => boolean;
}) {
  const showUndo = useUndo();
  return <button onClick={() => showUndo(`Deleted "${name}"`, undo, isCurrent)}>Delete {name}</button>;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('UndoProvider', () => {
  it('hides the bar after a while without undoing anything', () => {
    vi.useFakeTimers();
    const undo = vi.fn(async () => {});
    render(
      <UndoProvider>
        <DeleteButton name="Rent" undo={undo} />
      </UndoProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Rent' }));
    act(() => vi.advanceTimersByTime(UNDO_MS - 100));
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(100));
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    expect(undo).not.toHaveBeenCalled();
  });

  it('replaces the previous message, and Undo only undoes the latest delete', async () => {
    const undoRent = vi.fn(async () => {});
    const undoGym = vi.fn(async () => {});
    render(
      <UndoProvider>
        <DeleteButton name="Rent" undo={undoRent} />
        <DeleteButton name="Gym" undo={undoGym} />
      </UndoProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Delete Rent' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete Gym' }));
    expect(screen.getByRole('status')).toHaveTextContent('Deleted "Gym"');

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })));
    expect(undoGym).toHaveBeenCalledOnce();
    expect(undoRent).not.toHaveBeenCalled();
  });
  it('is not shown when the data changed before the delete finished', () => {
    const undo = vi.fn(async () => {});
    render(
      <UndoProvider>
        <DeleteButton name="Pets" undo={undo} isCurrent={() => false} />
      </UndoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Pets' }));
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });

  it('only closes the bar when the data changed after it appeared', async () => {
    let current = true;
    const undo = vi.fn(async () => {});
    render(
      <UndoProvider>
        <DeleteButton name="Pets" undo={undo} isCurrent={() => current} />
      </UndoProvider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Delete Pets' }));
    current = false; // e.g. a backup restore started
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Undo' })));
    expect(undo).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
  });
});
