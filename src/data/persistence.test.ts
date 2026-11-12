import { describe, expect, it } from 'vitest';
import { ensurePersistentStorage } from './persistence';

function fakeStorage(persisted: boolean, grants: boolean) {
  const calls = { persist: 0 };
  return {
    calls,
    storage: {
      persisted: async () => persisted,
      persist: async () => {
        calls.persist++;
        return grants;
      },
    },
  };
}

describe('ensurePersistentStorage', () => {
  it('does not ask again when storage is already persistent', async () => {
    const { storage, calls } = fakeStorage(true, false);
    expect(await ensurePersistentStorage(storage)).toBe('persistent');
    expect(calls.persist).toBe(0);
  });

  it('asks the browser and reports when it agrees', async () => {
    const { storage, calls } = fakeStorage(false, true);
    expect(await ensurePersistentStorage(storage)).toBe('persistent');
    expect(calls.persist).toBe(1);
  });

  it('reports best-effort storage when the browser declines', async () => {
    expect(await ensurePersistentStorage(fakeStorage(false, false).storage)).toBe('best-effort');
  });

  it('reports unsupported when the browser has no storage API or it fails', async () => {
    expect(await ensurePersistentStorage(undefined)).toBe('unsupported');
    const broken = { persisted: async () => Promise.reject(new Error('nope')), persist: async () => true };
    expect(await ensurePersistentStorage(broken)).toBe('unsupported');
  });
});
