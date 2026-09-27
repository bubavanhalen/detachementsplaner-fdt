import { type InputHTMLAttributes, type ReactNode, useId, useState } from 'react';

/**
 * Local draft that follows external changes (undo, re-parse) and commits once on
 * blur/Enter, so typing does not create one history step per keystroke.
 */
function useDraft<T>(value: T): [T, (next: T) => void] {
  const [draft, setDraft] = useState(value),
    [seen, setSeen] = useState(value);
  if (!Object.is(seen, value)) {
    setSeen(value);
    setDraft(value);
  }
  return [draft, setDraft];
}

type InputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'onBlur' | 'defaultValue'
>;

export function InlineText({
  value,
  onCommit,
  ...rest
}: InputProps & { value: string; onCommit: (value: string) => void }) {
  const [draft, setDraft] = useDraft(value);
  return (
    <input
      type="text"
      {...rest}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
        if (event.key === 'Escape') setDraft(value);
      }}
    />
  );
}

export function InlineNumber({
  value,
  onCommit,
  min = 1,
  ...rest
}: Omit<InputProps, 'min'> & { value: number; min?: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useDraft(String(value));
  return (
    <input
      type="number"
      inputMode="numeric"
      min={min}
      step={1}
      {...rest}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const next = Math.round(Number(draft));
        if (!draft.trim() || !Number.isFinite(next) || next < min) setDraft(String(value));
        else if (next !== value) onCommit(next);
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.currentTarget.blur();
      }}
    />
  );
}

/** One list item per line; empty lines are dropped on commit. */
export function InlineLines({
  value,
  onCommit,
  rows = 3,
  ...rest
}: {
  value: string[];
  onCommit: (value: string[]) => void;
  rows?: number;
  'aria-label'?: string;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
}) {
  const joined = value.join('\n');
  const [draft, setDraft] = useDraft(joined);
  return (
    <textarea
      rows={rows}
      {...rest}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        const lines = draft
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean);
        if (lines.join('\n') !== joined) onCommit(lines);
        else setDraft(joined);
      }}
    />
  );
}

/** Label + control with a generated id (for custom inline inputs). */
export function Field({
  label,
  className = 'field',
  children,
}: {
  label: ReactNode;
  className?: string;
  children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
    </div>
  );
}
