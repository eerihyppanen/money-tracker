/** Whether the browser has promised to keep this app's data. */
export type StorageStatus = 'persistent' | 'best-effort' | 'unsupported';

type StorageLike = Pick<StorageManager, 'persisted' | 'persist'>;

/**
 * Asks the browser to treat the database as permanent, so it isn't cleared when the
 * device runs low on space or the site hasn't been visited for a while. Never throws.
 */
export async function ensurePersistentStorage(
  storage: StorageLike | undefined = typeof navigator !== 'undefined' ? navigator.storage : undefined,
): Promise<StorageStatus> {
  if (!storage?.persisted || !storage.persist) return 'unsupported';
  try {
    if (await storage.persisted()) return 'persistent';
    return (await storage.persist()) ? 'persistent' : 'best-effort';
  } catch {
    return 'unsupported';
  }
}
