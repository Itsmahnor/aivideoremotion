import {forwardRef, type ButtonHTMLAttributes, type FC, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes} from 'react';
import {AlertTriangle, CheckCircle2, Info, Loader2, XCircle} from 'lucide-react';
import {cn} from '../lib/utils';

/** DOM id for a validation key such as "product.features.0.title". Used to focus the first invalid field. */
export const fieldId = (key: string): string => `f-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`;

// ---------------------------------------------------------------- buttons

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'quiet-danger'; size?: 'sm' | 'md'; loading?: boolean};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...props}, ref) => (
  <button
    ref={ref}
    type={type}
    disabled={disabled || loading}
    aria-busy={loading || undefined}
    className={cn(
      'inline-flex shrink-0 items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      size === 'md' ? 'h-10 px-4 text-sm' : 'h-8 px-3 text-[13px]',
      variant === 'primary' && 'bg-signal text-white hover:bg-signal-strong',
      variant === 'secondary' && 'border border-line bg-surface text-ink hover:bg-sunken',
      variant === 'ghost' && 'text-muted hover:bg-sunken hover:text-ink',
      variant === 'danger' && 'bg-bad text-white hover:bg-bad/90',
      variant === 'quiet-danger' && 'text-bad hover:bg-bad-soft',
      className,
    )}
    {...props}
  >
    {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
    {children}
  </button>
));
Button.displayName = 'Button';

// ---------------------------------------------------------------- layout

export const Section: FC<{title: string; description?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string; id?: string}> = ({title, description, aside, children, className, id}) => (
  <section id={id} aria-labelledby={id ? `${id}-title` : undefined} className={cn('rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6', className)}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 id={id ? `${id}-title` : undefined} className="font-display text-base font-semibold text-ink">
          {title}
        </h2>
        {description ? <p className="mt-1 max-w-prose text-sm text-muted">{description}</p> : null}
      </div>
      {aside}
    </div>
    {children}
  </section>
);

// ---------------------------------------------------------------- fields

type FieldShellProps = {
  id: string;
  label: string;
  required?: boolean;
  hint?: ReactNode;
  error?: string;
  warning?: string;
  count?: {value: number; max: number};
  className?: string;
  children: ReactNode;
};

export const describedBy = (id: string, {hint, error, warning}: {hint?: unknown; error?: string; warning?: string}): string | undefined =>
  [error ? `${id}-error` : '', warning && !error ? `${id}-warning` : '', hint ? `${id}-hint` : ''].filter(Boolean).join(' ') || undefined;

export const FieldShell: FC<FieldShellProps> = ({id, label, required, hint, error, warning, count, className, children}) => (
  <div className={cn('min-w-0', className)}>
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="ml-0.5 text-bad" aria-hidden>
            *
          </span>
        ) : (
          <span className="ml-1.5 text-xs font-normal text-faint">optional</span>
        )}
      </label>
      {count ? (
        <span className={cn('text-xs tabular-nums', count.value > count.max ? 'font-semibold text-bad' : 'text-faint')} aria-live="polite">
          {count.value}/{count.max}
        </span>
      ) : null}
    </div>
    {children}
    {error ? (
      <p id={`${id}-error`} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-bad">
        <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {error}
      </p>
    ) : warning ? (
      <p id={`${id}-warning`} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-warn">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        {warning}
      </p>
    ) : null}
    {hint ? (
      <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-muted">
        {hint}
      </p>
    ) : null}
  </div>
);

const controlClass = (invalid: boolean) =>
  cn(
    'w-full rounded-lg border bg-surface px-3 text-sm text-ink placeholder:text-faint transition-colors focus:outline-none focus-visible:outline-none focus:ring-4 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted',
    invalid ? 'border-bad focus:border-bad focus:ring-bad/15' : 'border-line hover:border-faint focus:border-signal focus:ring-signal/15',
  );

type TextFieldProps = Omit<FieldShellProps, 'children' | 'count'> & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  max?: number;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
  inputProps?: InputHTMLAttributes<HTMLInputElement>;
  textareaProps?: TextareaHTMLAttributes<HTMLTextAreaElement>;
};

/** Label + input/textarea + counter + inline error, wired for screen readers. Length is counted after trimming. */
export const TextField: FC<TextFieldProps> = ({id, label, required, hint, error, warning, className, value, onChange, onBlur, max, multiline, rows = 3, placeholder, disabled, inputProps, textareaProps}) => {
  const common = {
    id,
    value,
    placeholder,
    disabled,
    onBlur,
    'aria-invalid': error ? true : undefined,
    'aria-required': required || undefined,
    'aria-describedby': describedBy(id, {hint, error, warning}),
  };
  return (
    <FieldShell id={id} label={label} required={required} hint={hint} error={error} warning={warning} className={className} count={max ? {value: value.trim().length, max} : undefined}>
      {multiline ? (
        <textarea {...textareaProps} {...common} rows={rows} onChange={(e) => onChange(e.target.value)} className={cn(controlClass(Boolean(error)), 'resize-y py-2 leading-relaxed', textareaProps?.className)} />
      ) : (
        <input {...inputProps} {...common} type="text" onChange={(e) => onChange(e.target.value)} className={cn(controlClass(Boolean(error)), 'h-10', inputProps?.className)} />
      )}
    </FieldShell>
  );
};

type SelectFieldProps = Omit<FieldShellProps, 'children' | 'count'> & {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  options: readonly {value: string; label: string}[];
  placeholder?: string;
  disabled?: boolean;
  selectProps?: SelectHTMLAttributes<HTMLSelectElement>;
};

export const SelectField: FC<SelectFieldProps> = ({id, label, required, hint, error, warning, className, value, onChange, onBlur, options, placeholder, disabled, selectProps}) => (
  <FieldShell id={id} label={label} required={required} hint={hint} error={error} warning={warning} className={className}>
    <select
      id={id}
      value={value}
      disabled={disabled}
      onBlur={onBlur}
      onChange={(e) => onChange(e.target.value)}
      aria-invalid={error ? true : undefined}
      aria-required={required || undefined}
      aria-describedby={describedBy(id, {hint, error, warning})}
      className={cn(controlClass(Boolean(error)), 'h-10 pr-8')}
      {...selectProps}
    >
      {placeholder ? (
        <option value="" disabled>
          {placeholder}
        </option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  </FieldShell>
);

export const Toggle: FC<{id: string; checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string; disabled?: boolean}> = ({id, checked, onChange, label, description, disabled}) => (
  <div className="flex items-start justify-between gap-4">
    <div className="min-w-0">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        {label}
      </label>
      {description ? (
        <p id={`${id}-hint`} className="mt-0.5 text-[13px] text-muted">
          {description}
        </p>
      ) : null}
    </div>
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-describedby={description ? `${id}-hint` : undefined}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50', checked ? 'bg-signal' : 'bg-line')}
    >
      <span className={cn('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[22px]' : 'translate-x-0.5')} />
    </button>
  </div>
);

/** A group of large radio "cards". Arrow keys move between options (native radio behaviour). */
export function ChoiceCards<T extends string>({
  name,
  legend,
  value,
  onChange,
  options,
  columns = 'sm:grid-cols-3',
  hideLegend,
}: {
  name: string;
  legend: string;
  value: T;
  onChange: (value: T) => void;
  options: readonly {value: T; title: string; description?: string; visual?: ReactNode}[];
  columns?: string;
  hideLegend?: boolean;
}) {
  return (
    <fieldset>
      <legend className={cn('mb-2 text-sm font-medium text-ink', hideLegend && 'sr-only')}>{legend}</legend>
      <div className={cn('grid grid-cols-1 gap-2', columns)}>
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={cn(
                'relative flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors focus-within:ring-2 focus-within:ring-signal focus-within:ring-offset-1',
                checked ? 'border-signal bg-signal-soft/60' : 'border-line bg-surface hover:border-faint',
              )}
            >
              <input type="radio" name={name} value={option.value} checked={checked} onChange={() => onChange(option.value)} className="sr-only" />
              {option.visual}
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-ink">{option.title}</span>
                {option.description ? <span className="mt-0.5 block text-[13px] leading-snug text-muted">{option.description}</span> : null}
              </span>
              {checked ? <CheckCircle2 className="absolute right-2.5 top-2.5 h-4 w-4 text-signal" aria-hidden /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ---------------------------------------------------------------- feedback

type Tone = 'info' | 'success' | 'warning' | 'error';
const TONE_STYLE: Record<Tone, string> = {
  info: 'border-signal/25 bg-signal-soft/60 text-ink',
  success: 'border-ok/25 bg-ok-soft text-ink',
  warning: 'border-warn/30 bg-warn-soft text-ink',
  error: 'border-bad/30 bg-bad-soft text-ink',
};
const TONE_ICON: Record<Tone, FC<{className?: string}>> = {info: Info, success: CheckCircle2, warning: AlertTriangle, error: XCircle};
const TONE_ICON_COLOR: Record<Tone, string> = {info: 'text-signal', success: 'text-ok', warning: 'text-warn', error: 'text-bad'};

export const Notice: FC<{tone?: Tone; title?: string; children?: ReactNode; actions?: ReactNode; className?: string; live?: boolean}> = ({tone = 'info', title, children, actions, className, live}) => {
  const Icon = TONE_ICON[tone];
  return (
    <div role={live ? (tone === 'error' ? 'alert' : 'status') : undefined} className={cn('flex gap-3 rounded-xl border p-3.5 text-sm', TONE_STYLE[tone], className)}>
      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', TONE_ICON_COLOR[tone])} aria-hidden />
      <div className="min-w-0 flex-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn('text-[13px] leading-relaxed text-ink/80', title && 'mt-0.5')}>{children}</div> : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
};

export const Badge: FC<{tone?: 'neutral' | 'signal' | 'ok' | 'warn' | 'bad'; children: ReactNode; className?: string}> = ({tone = 'neutral', children, className}) => (
  <span
    className={cn(
      'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium',
      tone === 'neutral' && 'bg-sunken text-muted ring-1 ring-inset ring-line',
      tone === 'signal' && 'bg-signal-soft text-signal-strong',
      tone === 'ok' && 'bg-ok-soft text-ok',
      tone === 'warn' && 'bg-warn-soft text-warn',
      tone === 'bad' && 'bg-bad-soft text-bad',
      className,
    )}
  >
    {children}
  </span>
);

export const ProgressBar: FC<{value: number; label: string; indeterminate?: boolean}> = ({value, label, indeterminate}) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={indeterminate ? undefined : Math.round(value * 100)}
    className="h-2 w-full overflow-hidden rounded-full bg-line"
  >
    <div className={cn('h-full rounded-full bg-signal transition-[width] duration-500', indeterminate && 'w-1/3 animate-pulse')} style={indeterminate ? undefined : {width: `${Math.round(value * 100)}%`}} />
  </div>
);

export const EmptyState: FC<{icon: ReactNode; title: string; children?: ReactNode; actions?: ReactNode}> = ({icon, title, children, actions}) => (
  <div className="flex flex-col items-center rounded-2xl border border-dashed border-line bg-sunken px-6 py-10 text-center">
    <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface text-muted shadow-card">{icon}</div>
    <p className="font-display text-base font-semibold text-ink">{title}</p>
    {children ? <div className="mt-1.5 max-w-md text-sm text-muted">{children}</div> : null}
    {actions ? <div className="mt-5 flex flex-wrap justify-center gap-2">{actions}</div> : null}
  </div>
);

export const Kbd: FC<{children: ReactNode}> = ({children}) => <kbd className="rounded border border-line bg-sunken px-1.5 py-0.5 font-mono text-[11px] text-muted">{children}</kbd>;
