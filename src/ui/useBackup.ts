import { useState } from 'react';
import { readLastBackup, writeLastBackup } from '../data/backupStamp';
import { useData } from '../data/dataContext';
import { createBackup } from '../domain/backup';

/** Starts a browser download of a text file. */
export function download(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The last backup date on this device, and a function that saves a new backup file. */
export function useBackup() {
  const { entries, categories, today } = useData();
  const [lastBackup, setLastBackup] = useState(readLastBackup);

  const saveBackup = () => {
    const backup = createBackup({ entries, categories }, new Date().toISOString());
    download(`money-tracker-backup-${today}.json`, JSON.stringify(backup, null, 2), 'application/json');
    writeLastBackup(today);
    setLastBackup(today);
  };

  return { lastBackup, saveBackup };
}
