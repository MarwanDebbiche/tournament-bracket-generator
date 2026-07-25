import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

/**
 * Integer input that allows free typing (including a transient empty field) and
 * commits a clamped value, normalizing on blur.
 */
export function IntInput({
  value,
  min = 0,
  max,
  onChange,
  ariaLabel,
  className,
}: {
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  ariaLabel?: string;
  className?: string;
}) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);

  const clamp = (n: number) => {
    let v = Math.max(min, n);
    if (max !== undefined) v = Math.min(max, v);
    return v;
  };

  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={text}
      aria-label={ariaLabel}
      onChange={(e) => {
        setText(e.target.value);
        const parsed = Number.parseInt(e.target.value, 10);
        if (!Number.isNaN(parsed)) onChange(clamp(parsed));
      }}
      onBlur={() => {
        const parsed = Number.parseInt(text, 10);
        const next = Number.isNaN(parsed) ? min : clamp(parsed);
        setText(String(next));
        onChange(next);
      }}
      className={cn(inputClass, className)}
    />
  );
}

/** Labelled form row with an optional hint. */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-slate-700">{label}</div>
      {hint && <div className="text-xs text-slate-400">{hint}</div>}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** A titled card that groups related controls. */
export function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

/** Accessible on/off switch with a label and optional description. */
export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span>
        <span className="block text-sm font-medium text-slate-700">{label}</span>
        {description && (
          <span className="block text-xs text-slate-400">{description}</span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-6 w-11 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300',
          checked ? 'bg-indigo-600' : 'bg-slate-300',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            checked && 'translate-x-5',
          )}
        />
      </button>
    </div>
  );
}

export interface CardOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledReason?: string;
}

/** Radio-style group rendered as selectable cards. */
export function OptionCards<T extends string>({
  value,
  onChange,
  options,
  columns = 2,
}: {
  value: T;
  onChange: (value: T) => void;
  options: CardOption<T>[];
  columns?: 2 | 3;
}) {
  return (
    <div
      className={cn(
        'grid gap-2',
        columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2',
      )}
    >
      {options.map((option) => {
        const selected = option.value === value && !option.disabled;
        return (
          <button
            key={option.value}
            type="button"
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            aria-pressed={selected}
            className={cn(
              'rounded-lg border p-3 text-left transition',
              selected
                ? 'border-indigo-500 bg-indigo-50/60 ring-2 ring-indigo-200'
                : 'border-slate-200 hover:border-slate-300',
              option.disabled && 'cursor-not-allowed opacity-60 hover:border-slate-200',
            )}
          >
            <span className="block text-sm font-semibold text-slate-800">
              {option.label}
            </span>
            {option.description && !option.disabled && (
              <span className="mt-0.5 block text-xs text-slate-500">
                {option.description}
              </span>
            )}
            {option.disabled && option.disabledReason && (
              <span className="mt-0.5 block text-xs text-amber-600">
                {option.disabledReason}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
