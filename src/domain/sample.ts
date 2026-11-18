/**
 * Realistic example data for trying the app out, e.g. from a portfolio link. Every date is
 * worked out from `today`, so the demo always looks current. Pure, no storage.
 */
import { addDays, addMonths, parseISO, toISO } from './dates';
import { rollForward } from './schedule';
import type { Entry, EntryType, Frequency, ISODate } from './types';

const PREFIX = 'sample-';

/** Sample entries have ids starting with "sample-", so they can be removed on their own. */
export function isSample(entry: Pick<Entry, 'id'>): boolean {
  return entry.id.startsWith(PREFIX);
}

interface Spec {
  slug: string;
  name: string;
  euros: number;
  type?: EntryType;
  frequency: Frequency;
  categoryId: string;
  /** Day of month the payment lands on (ignored for weekly). */
  day: number;
  /** For quarterly, yearly and one-time: how many months from now the next payment is. */
  monthsAhead?: number;
  active?: boolean;
  notes?: string;
}

const SPECS: Spec[] = [
  { slug: 'salary', name: 'Salary', euros: 2850, type: 'income', frequency: 'monthly', categoryId: 'other', day: 25 },
  { slug: 'freelance', name: 'Freelance invoices', euros: 1200, type: 'income', frequency: 'quarterly', categoryId: 'other', day: 15, monthsAhead: 1 },
  { slug: 'rent', name: 'Rent', euros: 950, frequency: 'monthly', categoryId: 'housing', day: 1, notes: 'Water included.' },
  { slug: 'electricity', name: 'Electricity', euros: 45.9, frequency: 'monthly', categoryId: 'housing', day: 20 },
  { slug: 'internet', name: 'Home internet', euros: 24.9, frequency: 'monthly', categoryId: 'housing', day: 12 },
  { slug: 'netflix', name: 'Netflix', euros: 13.99, frequency: 'monthly', categoryId: 'subscriptions', day: 15 },
  { slug: 'spotify', name: 'Spotify', euros: 11.99, frequency: 'monthly', categoryId: 'subscriptions', day: 28 },
  { slug: 'phone', name: 'Phone plan', euros: 19.9, frequency: 'monthly', categoryId: 'subscriptions', day: 8 },
  { slug: 'bus', name: 'Bus season ticket', euros: 64.7, frequency: 'monthly', categoryId: 'transport', day: 31 },
  { slug: 'groceries', name: 'Groceries', euros: 85, frequency: 'weekly', categoryId: 'food', day: 0 },
  { slug: 'home-insurance', name: 'Home insurance', euros: 62, frequency: 'quarterly', categoryId: 'insurance', day: 10, monthsAhead: 0 },
  { slug: 'car-insurance', name: 'Car insurance', euros: 480, frequency: 'yearly', categoryId: 'insurance', day: 15, monthsAhead: 4 },
  { slug: 'semester-fee', name: 'Student union fee', euros: 55, frequency: 'semi-annually', categoryId: 'other', day: 1, monthsAhead: 2 },
  { slug: 'tyres', name: 'Winter tyres', euros: 520, frequency: 'one-time', categoryId: 'transport', day: 3, monthsAhead: 1 },
  { slug: 'gym', name: 'Gym', euros: 39, frequency: 'monthly', categoryId: 'other', day: 5, active: false, notes: 'Paused for the summer.' },
];

/** The sample entries, all due on or after `today`. `now` is the creation timestamp. */
export function sampleEntries(today: ISODate, now: string): Entry[] {
  const { y, m } = parseISO(today);
  const thisMonth = toISO({ y, m, d: 1 });
  const startDate = addMonths(thisMonth, -6, 1);

  return SPECS.map((s) => {
    const firstDue =
      s.frequency === 'weekly' ? addDays(today, 2) : addMonths(thisMonth, s.monthsAhead ?? 0, s.day);
    const entry: Entry = {
      id: PREFIX + s.slug,
      name: s.name,
      amountCents: Math.round(s.euros * 100),
      type: s.type ?? 'expense',
      frequency: s.frequency,
      categoryId: s.categoryId,
      nextDueDate: s.frequency === 'one-time' && firstDue < today ? addMonths(firstDue, 1, s.day) : firstDue,
      anchorDay: s.frequency === 'weekly' ? parseISO(firstDue).d : s.day,
      startDate,
      active: s.active ?? true,
      createdAt: now,
      updatedAt: now,
    };
    if (s.notes) entry.notes = s.notes;
    return rollForward(entry, today);
  });
}
