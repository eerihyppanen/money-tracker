export type EntryType = 'expense' | 'income';

export type Frequency =
  | 'weekly'
  | 'monthly'
  | 'quarterly'
  | 'semi-annually'
  | 'yearly'
  | 'one-time';

export const FREQUENCIES: Frequency[] = [
  'weekly',
  'monthly',
  'quarterly',
  'semi-annually',
  'yearly',
  'one-time',
];

export const FREQUENCY_LABELS: Record<Frequency, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  'semi-annually': 'Semi-annually',
  yearly: 'Yearly',
  'one-time': 'One-time',
};

/** A calendar date as 'YYYY-MM-DD'. Plain strings avoid timezone bugs and sort correctly. */
export type ISODate = string;

export interface Entry {
  id: string;
  name: string;
  /** Always a positive integer number of cents; the sign comes from `type`. */
  amountCents: number;
  type: EntryType;
  frequency: Frequency;
  categoryId: string;
  nextDueDate: ISODate;
  /** The intended day of month (1–31). Month-based steps clamp to shorter months but return to this day. */
  anchorDay: number;
  startDate: ISODate;
  endDate?: ISODate;
  active: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  isDefault: boolean;
}

export const OTHER_CATEGORY_ID = 'other';

export const DEFAULT_CATEGORIES: Category[] = [
  { id: 'housing', name: 'Housing', isDefault: true },
  { id: 'subscriptions', name: 'Subscriptions', isDefault: true },
  { id: 'insurance', name: 'Insurance', isDefault: true },
  { id: 'transport', name: 'Transport', isDefault: true },
  { id: 'food', name: 'Food', isDefault: true },
  { id: OTHER_CATEGORY_ID, name: 'Other', isDefault: true },
];

/** One payment landing on a specific date. */
export interface Charge {
  entry: Entry;
  date: ISODate;
}
