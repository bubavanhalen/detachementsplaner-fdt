// Feldbausteine des Seitenfelds und der Plan-Einstellungen (UI-Richtlinie 6 «Übernahme»: Textfelder beim Verlassen
// oder mit Enter, Auswahlfelder und Schalter sofort; Esc stellt den Wert wieder her und gibt den Fokus ans Raster
// zurück). Jede übernommene Änderung ist ein Undo-Schritt (durch den aufrufenden Befehl).

import {
  createContext,
  type KeyboardEvent,
  type ReactNode,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { isRenderable } from '../../../model/wap/layout/text/measure';
import type { RichText } from '../../../model/wap/types';
import { type BoldText, boldTextOf, editBold, richOf, sameBold, toggleBold } from './richText';

/** Meldung bei einem Zeichen ohne Glyphe in der Druckschrift (UI-Richtlinie 5.4, 12 «Zeichen (Eingabe)»). */
export const GLYPH_MESSAGE =
  'Ein Zeichen kann im PDF nicht dargestellt werden. Das Zeichen durch Buchstaben oder Zahlen ersetzen.';

/**
 * Eintrag bzw. Bereich, zu dem die Felder gehören, und Meldung an das Seitenfeld (UX-H-01): Verschwindet ein Feld mit
 * einer ungültigen, nicht übernommenen Eingabe (Auswahlwechsel), meldet es das sichtbar statt still zu verwerfen.
 */
export interface FieldOwner {
  readonly name: string;
  readonly notice: (message: string) => void;
}
export const FieldOwnerContext = createContext<FieldOwner | null>(null);

/**
 * Sicherung beim Verschwinden eines Felds (Auswahlwechsel, Schliessen): eine gültige, noch nicht übernommene Eingabe
 * wird übernommen, eine ungültige sichtbar gemeldet (UX-H-01; UI-Richtlinie 6 «Übernahme»).
 */
function useLeaveGuard(
  label: string,
  pending: () => {
    readonly changed: boolean;
    readonly problem: string;
    readonly commit: () => void;
  },
): void {
  const owner = useContext(FieldOwnerContext);
  const latest = useRef({ owner, pending, label });
  latest.current = { owner, pending, label };
  useEffect(
    () => () => {
      const { owner: o, pending: get, label: l } = latest.current;
      const now = get();
      if (!now.changed) return;
      if (now.problem === '') now.commit();
      else
        o?.notice(
          `«${l}»${o.name === '' ? '' : ` von «${o.name}»`} nicht übernommen: ${now.problem}`,
        );
    },
    [],
  );
}

interface Common {
  readonly label: string;
  /** Tastenzeichen rechts neben der Beschriftung (UI-Richtlinie 6, 13.3). */
  readonly shortcut?: string;
  readonly disabled?: boolean;
  /** Esc im Feld: Fokus zurück ans Raster. */
  readonly onEscape?: () => void;
  readonly hint?: string;
  /** Kennung für Feldsprung-Tasten (Z, T, S, K, L, O). */
  readonly field?: string;
}

function Label({
  label,
  shortcut,
  htmlFor,
}: {
  label: string;
  shortcut?: string | undefined;
  htmlFor: string;
}) {
  // Das Tastenzeichen steht neben der Beschriftung, nicht in ihr: der zugängliche Name bleibt das Feld.
  return (
    <div className="wap-panel-label">
      <label htmlFor={htmlFor}>{label}</label>
      {shortcut !== undefined && (
        <kbd title={`Feldsprung: Taste ${shortcut} am gewählten Eintrag`}>{shortcut}</kbd>
      )}
    </div>
  );
}

export function TextField({
  label,
  value,
  onCommit,
  multiline = false,
  validate,
  placeholder,
  shortcut,
  disabled,
  onEscape,
  hint,
  field,
  inputMode,
}: Common & {
  readonly value: string;
  readonly onCommit: (value: string) => void;
  readonly multiline?: boolean;
  /** Prüfung vor dem Übernehmen; Rückgabe '' = in Ordnung, sonst Meldung (Wert nicht übernommen). */
  readonly validate?: (value: string) => string;
  readonly placeholder?: string;
  readonly inputMode?: 'numeric' | 'text';
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');
  const focused = useRef(false);
  /** Zuletzt übernommener Wert (bis der Plan ihn zurückmeldet), damit nichts doppelt übernommen wird. */
  const committed = useRef<string | null>(null);
  useEffect(() => {
    if (!focused.current) setDraft(value);
    committed.current = null;
  }, [value]);
  const check = (v: string): string => {
    // Mehrzeilig: Zeilenumbrüche sind keine Zeichen der Druckschrift, geprüft wird je Zeile (FA2-04, R-4.2-04).
    const lines = multiline ? v.split(/\r\n|\r|\n/) : [v];
    if (!lines.every(isRenderable)) return GLYPH_MESSAGE;
    return validate?.(v) ?? '';
  };
  const commit = (): boolean => {
    if (draft === value || draft === committed.current) {
      setError('');
      return true;
    }
    const problem = check(draft);
    if (problem !== '') {
      setError(problem);
      return false;
    }
    setError('');
    committed.current = draft;
    onCommit(draft);
    return true;
  };
  const draftNow = useRef(draft);
  draftNow.current = draft;
  useLeaveGuard(label, () => {
    const d = draftNow.current;
    return {
      changed: d !== value && d !== committed.current,
      problem: check(d),
      commit: () => {
        committed.current = d;
        onCommit(d);
      },
    };
  });
  const key = (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') {
      // Ohne Rücksprung ins Raster (z.B. im Dialog) schliesst Esc den Dialog wie gewohnt.
      if (onEscape !== undefined) {
        event.preventDefault();
        event.stopPropagation();
      }
      setDraft(value);
      setError('');
      onEscape?.();
    } else if (event.key === 'Enter' && (!multiline || event.ctrlKey)) {
      event.preventDefault();
      commit();
    }
  };
  const props = {
    id,
    value: draft,
    disabled,
    placeholder,
    'aria-invalid': error !== '',
    'aria-describedby':
      error !== '' ? `${id}-error` : hint !== undefined ? `${id}-hint` : undefined,
    'data-panel-field': field,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: () => {
      focused.current = false;
      if (!commit()) return;
    },
    onKeyDown: key,
  };
  return (
    <div className="wap-panel-field">
      <Label label={label} shortcut={shortcut} htmlFor={id} />
      {multiline ? (
        <textarea {...props} rows={3} onChange={(e) => setDraft(e.target.value)} />
      ) : (
        <input {...props} inputMode={inputMode} onChange={(e) => setDraft(e.target.value)} />
      )}
      {hint !== undefined && error === '' && (
        <p id={`${id}-hint`} className="wap-panel-hint">
          {hint}
        </p>
      )}
      {error !== '' && (
        <p id={`${id}-error`} className="wap-panel-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** Titel mit Fett-Knopf (Beschrieb 5.1; R-5.1-23): Ctrl+B im Feld oder Knopf «Fett» schaltet die Markierung um. */
export function RichTitleField({
  label,
  value,
  onCommit,
  shortcut,
  disabled,
  onEscape,
  field,
  required = true,
}: Common & {
  readonly value: RichText;
  readonly onCommit: (value: RichText) => void;
  readonly required?: boolean;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const initial = boldTextOf(value);
  const [draft, setDraft] = useState<BoldText>(initial);
  const [error, setError] = useState('');
  const focused = useRef(false);
  /** Zuletzt übernommener Wert (bis der Plan ihn zurückmeldet), damit nichts doppelt übernommen wird. */
  const committed = useRef<BoldText | null>(null);
  const key = JSON.stringify(value);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur bei geändertem Planwert neu setzen
  useEffect(() => {
    if (!focused.current) setDraft(boldTextOf(value));
    committed.current = null;
  }, [key]);
  const problemOf = (d: BoldText): string =>
    required && d.text.trim() === ''
      ? `«${label}» ist leer. Einen Text eingeben oder mit Esc verwerfen.`
      : isRenderable(d.text)
        ? ''
        : GLYPH_MESSAGE;
  const unchanged = (d: BoldText): boolean =>
    sameBold(d, boldTextOf(value)) ||
    (committed.current !== null && sameBold(d, committed.current));
  const commit = (): boolean => {
    if (unchanged(draft)) {
      setError('');
      return true;
    }
    const problem = problemOf(draft);
    if (problem !== '') {
      setError(problem);
      return false;
    }
    setError('');
    committed.current = draft;
    onCommit(richOf(draft));
    return true;
  };
  const draftNow = useRef(draft);
  draftNow.current = draft;
  useLeaveGuard(label, () => {
    const d = draftNow.current;
    return {
      changed: !unchanged(d),
      problem: problemOf(d),
      commit: () => {
        committed.current = d;
        onCommit(richOf(d));
      },
    };
  });
  const toggle = () => {
    const el = input.current;
    if (el === null) return;
    const start = el.selectionStart ?? 0;
    const end = el.selectionEnd ?? 0;
    setDraft((d) => toggleBold(d, start, end));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start, end);
    });
  };
  const preview = richOf(draft);
  return (
    <div className="wap-panel-field">
      <Label label={label} shortcut={shortcut} htmlFor={id} />
      <div className="wap-panel-rich">
        <input
          ref={input}
          id={id}
          value={draft.text}
          disabled={disabled}
          data-panel-field={field}
          aria-invalid={error !== ''}
          aria-describedby={`${id}-preview${error !== '' ? ` ${id}-error` : ''}`}
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(e) => setDraft((d) => editBold(d, e.target.value, d.mask[0] ?? true))}
          // Jeder Fokusverlust übernimmt, auch Tab zum Knopf «Fett» (UX-H-01: sonst ging die Änderung beim
          // nächsten Auswahlwechsel still verloren). Ein Mausklick auf «Fett» nimmt den Fokus nicht.
          onBlur={() => {
            focused.current = false;
            commit();
          }}
          onKeyDown={(event) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
              event.preventDefault();
              event.stopPropagation();
              toggle();
            } else if (event.key === 'Escape') {
              // Ohne Rücksprung ins Raster (z.B. im Dialog) schliesst Esc den Dialog wie gewohnt.
              if (onEscape !== undefined) {
                event.preventDefault();
                event.stopPropagation();
              }
              setDraft(boldTextOf(value));
              setError('');
              onEscape?.();
            } else if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            }
          }}
        />
        <button
          type="button"
          className="btn btn-sm"
          data-bold-for={id}
          disabled={disabled}
          aria-label="Fett (Ctrl+B)"
          title="Markierten Teil fett bzw. normal (Ctrl+B)"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => {
            toggle();
          }}
        >
          <strong>F</strong>
        </button>
      </div>
      <p id={`${id}-preview`} className="wap-panel-preview">
        {preview.length === 0 ? (
          <span className="wap-panel-muted">leer</span>
        ) : (
          preview.map((r, i) =>
            r.bold ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: Läufe ohne eigene ID, Reihenfolge fest
              <strong key={i}>{r.text}</strong>
            ) : (
              // biome-ignore lint/suspicious/noArrayIndexKey: Läufe ohne eigene ID, Reihenfolge fest
              <span key={i}>{r.text}</span>
            ),
          )
        )}
      </p>
      {error !== '' && (
        <p id={`${id}-error`} className="wap-panel-error">
          {error}
        </p>
      )}
    </div>
  );
}

export interface Choice {
  readonly value: string;
  readonly label: string;
}

/**
 * Auswahlfeld: mit der Maus sofort übernommen; mit der Tastatur (Pfeile, Tippsuche) erst mit Enter oder beim
 * Verlassen (sonst wäre jeder Pfeil ein Undo-Schritt).
 */
export function SelectField({
  label,
  value,
  choices,
  onCommit,
  shortcut,
  disabled,
  onEscape,
  field,
  hint,
}: Common & {
  readonly value: string;
  readonly choices: readonly Choice[];
  readonly onCommit: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const byKeyboard = useRef(false);
  const apply = (v: string) => {
    setDraft(null);
    byKeyboard.current = false;
    if (v !== value) onCommit(v);
  };
  return (
    <div className="wap-panel-field">
      <Label label={label} shortcut={shortcut} htmlFor={id} />
      <select
        id={id}
        value={draft ?? value}
        disabled={disabled}
        data-panel-field={field}
        aria-describedby={hint === undefined ? undefined : `${id}-hint`}
        onPointerDown={() => {
          byKeyboard.current = false;
        }}
        onKeyDown={(event) => {
          byKeyboard.current = true;
          if (event.key === 'Enter') {
            event.preventDefault();
            apply(draft ?? value);
          } else if (event.key === 'Escape') {
            // Ohne Rücksprung ins Raster (z.B. im Dialog) schliesst Esc den Dialog wie gewohnt.
            if (onEscape !== undefined) {
              event.preventDefault();
              event.stopPropagation();
            }
            setDraft(null);
            onEscape?.();
          }
        }}
        onChange={(event) => {
          if (byKeyboard.current) setDraft(event.target.value);
          else apply(event.target.value);
        }}
        onBlur={() => {
          if (draft !== null) apply(draft);
        }}
      >
        {choices.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>
      {hint !== undefined && (
        <p id={`${id}-hint`} className="wap-panel-hint">
          {hint}
        </p>
      )}
    </div>
  );
}

/** Segmentschalter als `radiogroup` (Pfeile wählen und übernehmen sofort). */
export function Segment({
  label,
  value,
  choices,
  onCommit,
  disabled,
  shortcut,
  onEscape,
  field,
}: Common & {
  readonly value: string;
  readonly choices: readonly Choice[];
  readonly onCommit: (value: string) => void;
}) {
  const labelId = useId();
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const index = Math.max(
    0,
    choices.findIndex((c) => c.value === value),
  );
  return (
    <div className="wap-panel-field">
      <div className="wap-panel-label">
        <span id={labelId}>{label}</span>
        {shortcut !== undefined && (
          <kbd title={`Feldsprung: Taste ${shortcut} am gewählten Eintrag`}>{shortcut}</kbd>
        )}
      </div>
      <div role="radiogroup" aria-labelledby={labelId} className="wap-panel-segment">
        {choices.map((c, i) => (
          // biome-ignore lint/a11y/useSemanticElements: Segment-Knopf mit Rolle radio (WAI-ARIA radiogroup)
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={c.value === value}
            tabIndex={i === index ? 0 : -1}
            disabled={disabled}
            data-panel-field={i === index ? field : undefined}
            ref={(el) => {
              if (el === null) refs.current.delete(c.value);
              else refs.current.set(c.value, el);
            }}
            onClick={() => {
              if (c.value !== value) onCommit(c.value);
            }}
            onKeyDown={(event) => {
              const step =
                event.key === 'ArrowRight' || event.key === 'ArrowDown'
                  ? 1
                  : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
                    ? -1
                    : 0;
              if (event.key === 'Escape') {
                // Ohne Rücksprung ins Raster (z.B. im Dialog) schliesst Esc den Dialog wie gewohnt.
                if (onEscape !== undefined) {
                  event.preventDefault();
                  event.stopPropagation();
                }
                onEscape?.();
                return;
              }
              if (step === 0) return;
              event.preventDefault();
              const next = choices[(i + step + choices.length) % choices.length];
              if (next === undefined) return;
              refs.current.get(next.value)?.focus();
              if (next.value !== value) onCommit(next.value);
            }}
          >
            {c.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CheckField({
  label,
  checked,
  onCommit,
  disabled,
  onEscape,
  field,
}: Common & { readonly checked: boolean; readonly onCommit: (value: boolean) => void }) {
  const id = useId();
  return (
    <div className="wap-panel-check">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        data-panel-field={field}
        onChange={(e) => onCommit(e.target.checked)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            // Ohne Rücksprung ins Raster (z.B. im Dialog) schliesst Esc den Dialog wie gewohnt.
            if (onEscape !== undefined) {
              event.preventDefault();
              event.stopPropagation();
            }
            onEscape?.();
          }
        }}
      />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

export interface Suggestion {
  readonly value: string;
  readonly label: string;
  /** Kategorie gemäss Funktionsliste (R-4.7-10), nur Anzeige. */
  readonly hint?: string;
}

/**
 * Textfeld mit Vorschlagsliste (Glossar «Vorschlag»; R-4.1-10): ↓/↑ wählen, Enter oder Tab übernimmt, Esc schliesst
 * die Liste. Getippter Text wird wie in einem Textfeld übernommen.
 */
export function SuggestField({
  label,
  value,
  suggestions,
  onCommit,
  shortcut,
  disabled,
  onEscape,
  field,
  hint,
}: Common & {
  readonly value: string;
  readonly suggestions: readonly Suggestion[];
  readonly onCommit: (value: string) => void;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);
  const q = draft.trim().toLowerCase();
  const list = (
    q === ''
      ? suggestions
      : suggestions.filter(
          (s) => s.value.toLowerCase().includes(q) || s.label.toLowerCase().includes(q),
        )
  ).slice(0, 8);
  const commitValue = (v: string): boolean => {
    setOpen(false);
    setActive(-1);
    if (v === value) {
      setError('');
      return true;
    }
    if (!isRenderable(v)) {
      setError(GLYPH_MESSAGE);
      return false;
    }
    setError('');
    setDraft(v);
    onCommit(v);
    return true;
  };
  return (
    <div className="wap-panel-field wap-panel-suggest">
      <Label label={label} shortcut={shortcut} htmlFor={id} />
      <input
        id={id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open && list.length > 0}
        aria-controls={`${id}-list`}
        aria-activedescendant={active >= 0 ? `${id}-o${active}` : undefined}
        aria-invalid={error !== ''}
        aria-describedby={
          error !== '' ? `${id}-error` : hint === undefined ? undefined : `${id}-hint`
        }
        value={draft}
        disabled={disabled}
        data-panel-field={field}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onBlur={() => {
          focused.current = false;
          commitValue(draft);
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
            const n = list.length;
            if (n === 0) return;
            setActive((a) => (event.key === 'ArrowDown' ? (a + 1) % n : a <= 0 ? n - 1 : a - 1));
            return;
          }
          if (event.key === 'Enter' || (event.key === 'Tab' && open && active >= 0)) {
            const chosen = open && active >= 0 ? list[active] : undefined;
            if (event.key === 'Enter') event.preventDefault();
            commitValue(chosen?.value ?? draft);
            return;
          }
          if (event.key === 'Escape') {
            // Ohne Rücksprung ins Raster (z.B. im Dialog) schliesst Esc den Dialog wie gewohnt.
            if (onEscape !== undefined) {
              event.preventDefault();
              event.stopPropagation();
            }
            if (open) {
              event.preventDefault();
              event.stopPropagation();
              setOpen(false);
              setActive(-1);
              return;
            }
            setDraft(value);
            setError('');
            onEscape?.();
          }
        }}
      />
      {open && list.length > 0 && (
        <div
          id={`${id}-list`}
          role="listbox"
          aria-label={`Vorschläge ${label}`}
          className="wap-panel-options"
        >
          {list.map((s, i) => (
            // biome-ignore lint/a11y/useFocusableInteractive: Combobox-Muster mit aria-activedescendant, der Fokus bleibt im Feld
            <div
              key={`${s.value}:${s.label}`}
              id={`${id}-o${i}`}
              role="option"
              aria-selected={i === active}
              onPointerDown={(e) => {
                e.preventDefault();
                commitValue(s.value);
              }}
            >
              <span>{s.label}</span>
              {s.hint !== undefined && <small>{s.hint}</small>}
            </div>
          ))}
        </div>
      )}
      {hint !== undefined && error === '' && (
        <p id={`${id}-hint`} className="wap-panel-hint">
          {hint}
        </p>
      )}
      {error !== '' && (
        <p id={`${id}-error`} className="wap-panel-error">
          {error}
        </p>
      )}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="wap-panel-section" aria-labelledby={id}>
      <h3 id={id}>{title}</h3>
      {children}
    </section>
  );
}
