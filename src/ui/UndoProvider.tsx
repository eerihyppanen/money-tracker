import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { UndoContext } from './undoContext';

/** How long the Undo bar stays up. Long enough to notice and reach it with a thumb. */
export const UNDO_MS = 8000;

interface Pending {
  id: number;
  message: string;
  undo: () => Promise<void>;
}

/**
 * Holds the current Undo message and draws the bar above the bottom tabs. It wraps the whole
 * app, so the bar stays up when a delete also leaves the page, and the data layer can close
 * it when anything else changes (an old snapshot must never overwrite newer data).
 */
export function UndoProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const show = useCallback((message: string, undo: () => Promise<void>) => {
    setPending({ id: Date.now(), message, undo });
  }, []);
  const dismiss = useCallback(() => setPending(null), []);
  const controls = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [pending]);

  const onUndo = async () => {
    if (!pending) return;
    setPending(null);
    await pending.undo();
  };

  return (
    <UndoContext.Provider value={controls}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 z-30 flex justify-center md:inset-x-auto md:right-6 md:bottom-6!"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 72px)' }}
      >
        {pending && (
          <div
            key={pending.id}
            className="toast-in pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-ink py-1.5 pr-1.5 pl-4 text-bg shadow-lg"
          >
            <span className="min-w-0 flex-1 py-1.5 leading-snug">{pending.message}</span>
            <button
              type="button"
              onClick={() => void onUndo()}
              className="shrink-0 rounded-lg px-3 py-2.5 font-semibold text-accent-on-ink"
            >
              Undo
            </button>
          </div>
        )}
      </div>
    </UndoContext.Provider>
  );
}
