/** JSON backups, CSV export and category-name rules. Pure functions, no storage. */
import { isValidISO } from './dates';
import { formatAmountInput, formatDate } from './format';
import { monthlyEquivalent, yearlyEquivalent } from './schedule';
import {
  DEFAULT_CATEGORIES,
  FREQUENCIES,
  FREQUENCY_LABELS,
  OTHER_CATEGORY_ID,
  type Category,
  type Entry,
  type Frequency,
} from './types';

export const BACKUP_VERSION = 1;
const APP_ID = 'money-tracker';

export interface BackupData {
  entries: Entry[];
  categories: Category[];
}

export interface BackupFile extends BackupData {
  app: typeof APP_ID;
  version: number;
  exportedAt: string;
}

export type ParseResult =
  | { ok: true; data: BackupData; warnings: string[] }
  | { ok: false; error: string };

export function createBackup(data: BackupData, nowTimestamp: string): BackupFile {
  return { app: APP_ID, version: BACKUP_VERSION, exportedAt: nowTimestamp, ...data };
}

type Raw = Record<string, unknown>;
const isObject = (v: unknown): v is Raw => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string';
const isNonEmpty = (v: unknown): v is string => isText(v) && v.trim() !== '';

/** Field checks for one entry; returns the first broken field name, or null. */
function brokenEntryField(e: Raw): string | null {
  const checks: [string, boolean][] = [
    ['id', isNonEmpty(e.id)],
    ['name', isNonEmpty(e.name)],
    ['amountCents', Number.isSafeInteger(e.amountCents) && (e.amountCents as number) > 0],
    ['type', e.type === 'expense' || e.type === 'income'],
    ['frequency', FREQUENCIES.includes(e.frequency as Frequency)],
    ['categoryId', isNonEmpty(e.categoryId)],
    ['nextDueDate', isValidISO(e.nextDueDate)],
    ['anchorDay', Number.isInteger(e.anchorDay) && (e.anchorDay as number) >= 1 && (e.anchorDay as number) <= 31],
    ['startDate', isValidISO(e.startDate)],
    ['endDate', e.endDate === undefined || isValidISO(e.endDate)],
    ['active', typeof e.active === 'boolean'],
    ['notes', e.notes === undefined || isText(e.notes)],
    ['createdAt', isText(e.createdAt)],
    ['updatedAt', isText(e.updatedAt)],
  ];
  return checks.find(([, ok]) => !ok)?.[0] ?? null;
}

/** Copies only the known fields, so stray properties never reach the database. */
function cleanEntry(e: Raw): Entry {
  const entry: Entry = {
    id: e.id as string,
    name: e.name as string,
    amountCents: e.amountCents as number,
    type: e.type as Entry['type'],
    frequency: e.frequency as Frequency,
    categoryId: e.categoryId as string,
    nextDueDate: e.nextDueDate as string,
    anchorDay: e.anchorDay as number,
    startDate: e.startDate as string,
    active: e.active as boolean,
    createdAt: e.createdAt as string,
    updatedAt: e.updatedAt as string,
  };
  if (e.endDate !== undefined) entry.endDate = e.endDate as string;
  if (e.notes !== undefined) entry.notes = e.notes as string;
  return entry;
}

/** Reads a backup file's text. Never throws: problems come back as a readable error. */
export function parseBackup(text: string): ParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' };
  }
  if (!isObject(raw) || raw.app !== APP_ID || !Array.isArray(raw.entries) || !Array.isArray(raw.categories)) {
    return { ok: false, error: 'This file is not a backup from this app.' };
  }
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, error: 'This backup was made by a newer version of the app. Update the app and try again.' };
  }

  const categories: Category[] = [];
  for (const [i, c] of raw.categories.entries()) {
    if (!isObject(c) || !isNonEmpty(c.id) || !isNonEmpty(c.name) || typeof c.isDefault !== 'boolean') {
      return { ok: false, error: `Category ${i + 1} is incomplete.` };
    }
    if (categories.some((x) => x.id === c.id)) return { ok: false, error: `Category "${c.name}" appears twice.` };
    categories.push({ id: c.id, name: c.name, isDefault: c.isDefault });
  }
  if (!categories.some((c) => c.id === OTHER_CATEGORY_ID)) {
    categories.push(DEFAULT_CATEGORIES.find((c) => c.id === OTHER_CATEGORY_ID)!);
  }

  const known = new Set(categories.map((c) => c.id));
  const entries: Entry[] = [];
  let orphans = 0;
  for (const [i, e] of raw.entries.entries()) {
    const label = isObject(e) && isText(e.name) ? `Entry ${i + 1} ("${e.name}")` : `Entry ${i + 1}`;
    if (!isObject(e)) return { ok: false, error: `${label} is not an entry.` };
    const broken = brokenEntryField(e);
    if (broken) return { ok: false, error: `${label} has an invalid ${broken}.` };
    if (entries.some((x) => x.id === e.id)) return { ok: false, error: `${label} appears twice.` };
    const entry = cleanEntry(e);
    if (!known.has(entry.categoryId)) {
      entry.categoryId = OTHER_CATEGORY_ID;
      orphans++;
    }
    entries.push(entry);
  }

  const warnings =
    orphans > 0
      ? [`${orphans} ${orphans === 1 ? 'entry had a missing category and was' : 'entries had missing categories and were'} moved to Other.`]
      : [];
  return { ok: true, data: { entries, categories }, warnings };
}

/**
 * One CSV field. Text starting with = + - @ (or a tab/CR) gets a leading apostrophe so
 * Excel and similar apps show it as text instead of running it as a formula. Then the field
 * is quoted only when it contains a separator, quote or line break.
 */
function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * A spreadsheet-friendly export. Semicolons and decimal commas match what Excel expects
 * with Finnish settings; the byte-order mark makes it read the file as UTF-8.
 */
export function toCSV(entries: Entry[], categoryName: (id: string) => string): string {
  const header = [
    'Name',
    'Type',
    'Amount',
    'Frequency',
    'Category',
    'Next due date',
    'Start date',
    'End date',
    'Active',
    'Monthly equivalent',
    'Yearly equivalent',
    'Notes',
  ];
  const rows = entries.map((e) => {
    const oneTime = e.frequency === 'one-time';
    return [
      e.name,
      e.type === 'income' ? 'Income' : 'Expense',
      formatAmountInput(e.amountCents),
      FREQUENCY_LABELS[e.frequency],
      categoryName(e.categoryId),
      formatDate(e.nextDueDate),
      formatDate(e.startDate),
      e.endDate ? formatDate(e.endDate) : '',
      e.active ? 'Yes' : 'No',
      oneTime ? '' : formatAmountInput(monthlyEquivalent(e)),
      oneTime ? '' : formatAmountInput(yearlyEquivalent(e)),
      e.notes ?? '',
    ];
  });
  return '﻿' + [header, ...rows].map((r) => r.map(csvField).join(';') + '\r\n').join('');
}

/** Returns an error message, or null when the name can be used. */
export function validateCategoryName(name: string, categories: Category[], exceptId?: string): string | null {
  const trimmed = name.trim();
  if (trimmed === '') return 'Enter a name.';
  const clash = categories.find((c) => c.id !== exceptId && c.name.toLowerCase() === trimmed.toLowerCase());
  return clash ? `There is already a category called ${clash.name}.` : null;
}
