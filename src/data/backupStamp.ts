/**
 * The date of the last saved backup, kept in localStorage on this device. Saving a backup is
 * about this device's copy of the data, so it is not part of the repository or the backup itself.
 * Storage can be unavailable (private mode, blocked site data); then it simply reads as never.
 */
import { isValidISO } from '../domain/dates';

const KEY = 'money-tracker:last-backup';

export function readLastBackup(): string | null {
  try {
    const value = localStorage.getItem(KEY);
    return isValidISO(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeLastBackup(date: string): void {
  try {
    localStorage.setItem(KEY, date);
  } catch {
    // Nothing to do: the reminder will just show again.
  }
}
