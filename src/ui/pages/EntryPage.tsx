import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useData } from '../../data/dataContext';
import {
  emptyForm,
  fromEntry,
  toEntry,
  validateForm,
  type EntryFormValues,
  type FormErrors,
} from '../../domain/entryForm';
import { formatCents, parseAmount } from '../../domain/format';
import { monthlyEquivalent, yearlyEquivalent } from '../../domain/schedule';
import { FREQUENCIES, FREQUENCY_LABELS, type Entry } from '../../domain/types';
import { Field, inputClass, Segmented } from '../components/form';
import { PageHeader } from '../components/PageHeader';

export function EntryPage() {
  const { id } = useParams();
  const { entries } = useData();
  const original = id ? entries.find((e) => e.id === id) : undefined;

  if (id && !original) {
    return (
      <>
        <PageHeader title="Entry not found" />
        <p className="text-muted">
          This entry may have been deleted.{' '}
          <Link to="/list" className="text-accent underline">
            Go to entries
          </Link>
        </p>
      </>
    );
  }
  // Keyed so switching between entries resets the form state.
  return <EntryForm key={id ?? 'new'} original={original} />;
}

function EntryForm({ original }: { original?: Entry }) {
  const { today, categories, saveEntry, deleteEntry } = useData();
  const navigate = useNavigate();
  const location = useLocation();
  const [values, setValues] = useState<EntryFormValues>(() =>
    original ? fromEntry(original) : emptyForm(today),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof EntryFormValues>(key: K, value: EntryFormValues[K]) => {
    const next = { ...values, [key]: value };
    setValues(next);
    // After the first save attempt, re-check as the user fixes things.
    if (submitted) setErrors(validateForm(next));
  };

  const goBack = () => (location.key !== 'default' ? navigate(-1) : navigate('/list'));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const found = validateForm(values);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    try {
      await saveEntry(toEntry(values, original, new Date().toISOString(), () => crypto.randomUUID()));
      goBack();
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!original) return;
    if (!window.confirm(`Delete "${original.name}"? This can't be undone.`)) return;
    await deleteEntry(original.id);
    goBack();
  };

  const oneTime = values.frequency === 'one-time';
  const cents = parseAmount(values.amount);
  const preview =
    cents && !oneTime && values.frequency !== 'monthly'
      ? monthlyEquivalent({ amountCents: cents, frequency: values.frequency })
      : null;
  const yearly =
    cents && !oneTime ? yearlyEquivalent({ amountCents: cents, frequency: values.frequency }) : null;

  const invalid = (key: keyof EntryFormValues) => ({
    'aria-invalid': errors[key] ? true : undefined,
    'aria-describedby': errors[key] ? `${key}-error` : undefined,
  });

  return (
    <form onSubmit={onSubmit} noValidate className="mx-auto max-w-xl">
      <PageHeader title={original ? 'Edit entry' : 'New entry'}>
        <button type="button" onClick={goBack} className="text-muted hover:text-ink">
          Cancel
        </button>
      </PageHeader>

      <div className="flex flex-col gap-5">
        <Segmented
          label="Type"
          value={values.type}
          onChange={(v) => set('type', v)}
          options={[
            { value: 'expense', label: 'Expense' },
            { value: 'income', label: 'Income' },
          ]}
        />

        <Field label="Amount" htmlFor="amount" error={errors.amount}>
          <div className="relative">
            <input
              id="amount"
              inputMode="decimal"
              autoComplete="off"
              autoFocus={!original}
              placeholder="0,00"
              value={values.amount}
              onChange={(e) => set('amount', e.target.value)}
              className={`${inputClass} num pr-10 text-3xl font-semibold tracking-tight ${
                values.type === 'income' ? 'text-income' : 'text-expense'
              }`}
              {...invalid('amount')}
            />
            <span className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-2xl text-muted">€</span>
          </div>
          {yearly !== null && !errors.amount && (
            <p className="num text-sm text-muted">
              {preview !== null && <>{formatCents(preview)} a month, </>}
              {formatCents(yearly)} a year
            </p>
          )}
        </Field>

        <Field label="Name" htmlFor="name" error={errors.name}>
          <input
            id="name"
            autoComplete="off"
            autoCapitalize="sentences"
            placeholder={values.type === 'income' ? 'Salary' : 'Rent, Netflix, car insurance…'}
            value={values.name}
            onChange={(e) => set('name', e.target.value)}
            className={inputClass}
            {...invalid('name')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="How often" htmlFor="frequency">
            <select
              id="frequency"
              value={values.frequency}
              onChange={(e) => set('frequency', e.target.value as EntryFormValues['frequency'])}
              className={inputClass}
            >
              {FREQUENCIES.map((f) => (
                <option key={f} value={f}>
                  {FREQUENCY_LABELS[f]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Category" htmlFor="category">
            <select
              id="category"
              value={values.categoryId}
              onChange={(e) => set('categoryId', e.target.value)}
              className={inputClass}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          label={oneTime ? 'Date' : 'Next due date'}
          htmlFor="nextDueDate"
          error={errors.nextDueDate}
          hint={oneTime ? undefined : 'Later dates follow from this one automatically.'}
        >
          <input
            id="nextDueDate"
            type="date"
            value={values.nextDueDate}
            onChange={(e) => set('nextDueDate', e.target.value)}
            className={inputClass}
            {...invalid('nextDueDate')}
          />
        </Field>

        {!oneTime && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Started" htmlFor="startDate" error={errors.startDate}>
              <input
                id="startDate"
                type="date"
                value={values.startDate}
                onChange={(e) => set('startDate', e.target.value)}
                className={inputClass}
                {...invalid('startDate')}
              />
            </Field>
            <Field label="Ends (optional)" htmlFor="endDate" error={errors.endDate}>
              <input
                id="endDate"
                type="date"
                value={values.endDate}
                onChange={(e) => set('endDate', e.target.value)}
                className={inputClass}
                {...invalid('endDate')}
              />
            </Field>
          </div>
        )}

        <Field label="Notes" htmlFor="notes">
          <textarea
            id="notes"
            rows={2}
            value={values.notes}
            onChange={(e) => set('notes', e.target.value)}
            className={inputClass}
          />
        </Field>

        {original && (
          <label className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3">
            <span>
              <span className="block font-medium">Paused</span>
              <span className="block text-sm text-muted">Left out of all totals until you turn it back on.</span>
            </span>
            <input
              type="checkbox"
              checked={!values.active}
              onChange={(e) => set('active', !e.target.checked)}
              className="size-6 shrink-0 accent-accent"
            />
          </label>
        )}
      </div>

      <div
        className="sticky z-10 -mx-4 mt-8 flex gap-3 bg-bg/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:bg-transparent md:px-0"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}
      >
        {original && (
          <button
            type="button"
            onClick={onDelete}
            className="rounded-xl border border-line px-5 py-3 font-medium text-expense"
          >
            Delete
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-accent px-5 py-3 font-medium text-accent-ink disabled:opacity-60"
        >
          {original ? 'Save changes' : 'Add entry'}
        </button>
      </div>
    </form>
  );
}
