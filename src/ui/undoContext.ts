import { createContext, useContext } from 'react';

/** Shows a short message with an Undo button; a new message replaces the previous one. */
export type ShowUndo = (message: string, undo: () => Promise<void>) => void;

export const UndoContext = createContext<ShowUndo | null>(null);

export function useUndo(): ShowUndo {
  const show = useContext(UndoContext);
  if (!show) throw new Error('useUndo must be used inside <UndoProvider>');
  return show;
}
