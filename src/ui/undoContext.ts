import { createContext, useContext } from 'react';

/**
 * Shows a short message with an Undo button; a new message replaces the previous one.
 * `isCurrent` says whether the change being undone is still the latest one: if anything else
 * has changed the data since, the bar isn't shown, or Undo just closes it.
 */
export type ShowUndo = (message: string, undo: () => Promise<unknown>, isCurrent: () => boolean) => void;

export interface UndoControls {
  show: ShowUndo;
  /** Closes the Undo bar without undoing, e.g. because the data changed since. */
  dismiss: () => void;
}

export const UndoContext = createContext<UndoControls | null>(null);

function useUndoControls(): UndoControls {
  const controls = useContext(UndoContext);
  if (!controls) throw new Error('Undo hooks must be used inside <UndoProvider>');
  return controls;
}

export function useUndo(): ShowUndo {
  return useUndoControls().show;
}

export function useDismissUndo(): () => void {
  return useUndoControls().dismiss;
}
