/** Converting between what the add/edit form holds (strings) and a stored Entry. */
import { firstOfMonth, isValidISO, minDate, parseISO } from './dates';
import { formatAmountInput, parseAmount } from './format';
import { OTHER_CATEGORY_ID, type Entry, type EntryType, type Frequency, type ISODate } from './types';

export interface EntryFormValues {
  type: EntryType;
  name: string;
  /** As typed, e.g. '12,50'. */
  amount: string;
  frequency: Frequency;
  categoryId: string;
  nextDueDate: ISODate;
  startDate: ISODate;
  /** '' means no end date. */
  endDate: ISODate | '';
  active: boolean;
  notes: string;
}

export type FormErrors = Partial<Record<keyof EntryFormValues, string>>;

/**
 * A blank form. The start date defaults to the first of this month so an existing bill
 * you add mid-month still counts in this month's totals.
 */
export function emptyForm(today: ISODate): EntryFormValues {
  const { y, m } = parseISO(today);
  return {
    type: 'expense',
    name: '',
    amount: '',
    frequency: 'monthly',
    categoryId: OTHER_CATEGORY_ID,
    nextDueDate: today,
    startDate: minDate(today, firstOfMonth(y, m)),
    endDate: '',
    active: true,
    notes: '',
  };
}

export function fromEntry(entry: Entry): EntryFormValues {
  return {
    type: entry.type,
    name: entry.name,
    amount: formatAmountInput(entry.amountCents),
    frequency: entry.frequency,
    categoryId: entry.categoryId,
    nextDueDate: entry.nextDueDate,
    startDate: entry.startDate,
    endDate: entry.endDate ?? '',
    active: entry.active,
    notes: entry.notes ?? '',
  };
}

export function validateForm(v: EntryFormValues): FormErrors {
  const errors: FormErrors = {};
  if (v.name.trim() === '') errors.name = 'Enter a name.';
  const cents = parseAmount(v.amount);
  if (cents === null || cents === 0) errors.amount = 'Enter an amount, like 12,50.';
  if (!isValidISO(v.nextDueDate)) errors.nextDueDate = 'Pick a date.';
  if (v.frequency !== 'one-time') {
    if (!isValidISO(v.startDate)) errors.startDate = 'Pick a start date.';
    if (v.endDate !== '' && isValidISO(v.startDate) && v.endDate < v.startDate) {
      errors.endDate = 'The end date must be on or after the start date.';
    }
  }
  return errors;
}

/** Builds the entry to save. Call only with a form that passed `validateForm`. */
export function toEntry(
  v: EntryFormValues,
  original: Entry | undefined,
  nowTimestamp: string,
  newId: () => string,
): Entry {
  const oneTime = v.frequency === 'one-time';
  // Keep the stored anchor day (e.g. 31) unless the user picked a different due date.
  const anchorDay =
    original && original.nextDueDate === v.nextDueDate
      ? original.anchorDay
      : parseISO(v.nextDueDate).d;
  const notes = v.notes.trim();

  return {
    id: original?.id ?? newId(),
    name: v.name.trim(),
    amountCents: parseAmount(v.amount) ?? 0,
    type: v.type,
    frequency: v.frequency,
    categoryId: v.categoryId,
    nextDueDate: v.nextDueDate,
    anchorDay,
    startDate: oneTime ? v.nextDueDate : v.startDate,
    endDate: oneTime || v.endDate === '' ? undefined : v.endDate,
    active: v.active,
    notes: notes === '' ? undefined : notes,
    createdAt: original?.createdAt ?? nowTimestamp,
    updatedAt: nowTimestamp,
  };
}
