import { useRef } from 'react';
import { useData } from '../data/dataContext';
import { isSample, sampleEntries } from '../domain/sample';
import { OTHER_CATEGORY_ID } from '../domain/types';
import { useUndo } from './undoContext';

/** Loading and removing the example entries; real entries are never touched. */
export function useSampleData() {
  const { entries, categories, today, restore, deleteEntries, isLatestWrite } = useData();
  const showUndo = useUndo();
  const samples = entries.filter(isSample);
  const removing = useRef(false);

  const load = async () => {
    // Categories may have been renamed or deleted; anything unknown goes to Other.
    const known = new Set(categories.map((c) => c.id));
    const loaded = sampleEntries(today, new Date().toISOString()).map((e) =>
      known.has(e.categoryId) ? e : { ...e, categoryId: OTHER_CATEGORY_ID },
    );
    await restore({ entries: loaded });
  };

  const remove = async () => {
    // One removal at a time: a quick second tap would count as a newer change and cancel the
    // first one's Undo.
    if (removing.current) return;
    removing.current = true;
    try {
      const change = await deleteEntries(samples.map((e) => e.id));
      if (change.deleted.length === 0) return;
      // Undo restores the stored versions that were really removed, not this screen's copies.
      showUndo('Removed the sample data', () => restore({ entries: change.deleted }, change), () => isLatestWrite(change));
    } finally {
      removing.current = false;
    }
  };

  return { hasSample: samples.length > 0, load, remove };
}
