import { createDexieRepository } from './dexieRepository';
import type { Repository } from './repository';

/** The app's active storage. Swap this line to change backends. */
export const repository: Repository = createDexieRepository();
