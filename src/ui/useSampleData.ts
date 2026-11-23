import { useData } from '../data/dataContext';
import { isSample, sampleEntries } from '../domain/sample';
import { OTHER_CATEGORY_ID } from '../domain/types';
import { useUndo } from './undoContext';

/** Loading and removing the example entries; real entries are never touched. */
export function useSampleData() {
  const { entries, categories, today, restore, deleteEntries, isLatestWrite } = useData();
  const showUndo = useUndo();
  const samples = entries.filter(isSample);

  const load = async () => {
    // Categories may have been renamed or deleted; anything unknown goes to Other.
    const known = new Set(categories.map((c) => c.id));
    const loaded = sampleEntries(today, new Date().toISOString()).map((e) =>
      known.has(e.categoryId) ? e : { ...e, categoryId: OTHER_CATEGORY_ID },
    );
    await restore({ entries: loaded });
  };

  const remove = async () => {
    const change = await deleteEntries(samples.map((e) => e.id));
    if (change.deleted.length === 0) return;
    // Undo restores the stored versions that were really removed, not this screen's copies.
    showUndo('Removed the sample data', () => restore({ entries: change.deleted }, change), () => isLatestWrite(change));
  };

  return { hasSample: samples.length > 0, load, remove };
}
