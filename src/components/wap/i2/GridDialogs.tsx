// Kleine Dialoge des Rasters (I2b-B): «Gehe zu» (Ctrl+G, UI-Richtlinie 10) und «Auch an anderen Tagen»
// (Beschrieb 6 Etappe 1, UI-Richtlinie 5.8: Tage ankreuzen, Ziffern 1–7, Mo–Fr, Enter übernimmt).

import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import type { IsoDate, Weekday } from '../../../model/wap/types';
import { I2Dialog } from './I2Dialog';
import { dayLabel } from './keyboard';
import { parseTimeInput } from './timeInput';

const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export interface GoToDay {
  readonly date: IsoDate;
  readonly weekday: Weekday;
  readonly columns: readonly string[];
}

export interface GoToEntry {
  readonly key: string;
  readonly label: string;
  readonly title: string;
  readonly besoNumber: number | null;
}

export type GoToTarget =
  | {
      readonly kind: 'cell';
      readonly date: IsoDate;
      readonly minute: number | null;
      readonly column: number | null;
    }
  | { readonly kind: 'entry'; readonly key: string };

interface Option {
  readonly id: string;
  readonly text: string;
  readonly target: GoToTarget;
}

/** Vorschläge zu einer Eingabe «Mo 0800 COBRA 10», «Di», «21» (Beso-Nr) oder einem Titelanfang. */
export function goToOptions(
  input: string,
  days: readonly GoToDay[],
  entries: readonly GoToEntry[],
): readonly Option[] {
  const text = input.trim();
  if (text === '') return [];
  const out: Option[] = [];
  if (/^\d{2}$/.test(text)) {
    for (const e of entries)
      if (e.besoNumber === Number(text))
        out.push({ id: `e:${e.key}`, text: e.label, target: { kind: 'entry', key: e.key } });
  }
  const tokens = text.split(/\s+/);
  const first = tokens[0]?.toLowerCase() ?? '';
  const day = days.find((d) => d.weekday.toLowerCase() === first);
  if (day !== undefined) {
    let minute: number | null = null;
    let rest = tokens.slice(1);
    const time = rest[0] === undefined ? null : parseTimeInput(rest[0], 'Zeit');
    if (time?.ok) {
      minute = Math.floor(time.value / 15) * 15;
      rest = rest.slice(1);
    }
    const wanted = rest.join(' ').toLowerCase();
    const columns =
      wanted === ''
        ? [null]
        : day.columns
            .map((name, index) => ({ name, index }))
            .filter((c) => c.name.toLowerCase().startsWith(wanted))
            .map((c) => c.index);
    for (const column of columns) {
      const name = column === null ? '' : ` ${day.columns[column] ?? ''}`;
      const at =
        minute === null
          ? ''
          : ` ${String(Math.floor(minute / 60)).padStart(2, '0')}${String(minute % 60).padStart(2, '0')}`;
      out.push({
        id: `c:${day.date}:${minute ?? ''}:${column ?? ''}`,
        text: `${dayLabel(day.weekday, day.date)}${at}${name}`,
        target: { kind: 'cell', date: day.date, minute, column },
      });
    }
  }
  if (out.length === 0) {
    const lower = text.toLowerCase();
    const starts = entries.filter((e) => e.title.toLowerCase().startsWith(lower));
    const contains = entries.filter(
      (e) => !e.title.toLowerCase().startsWith(lower) && e.title.toLowerCase().includes(lower),
    );
    for (const e of [...starts, ...contains])
      out.push({ id: `e:${e.key}`, text: e.label, target: { kind: 'entry', key: e.key } });
  }
  return out.slice(0, 8);
}

export function GoToDialog({
  days,
  entries,
  onGo,
  onClose,
}: {
  days: readonly GoToDay[];
  entries: readonly GoToEntry[];
  onGo: (target: GoToTarget) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState('');
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Nach showModal des Dialogs (Effekt des Kinds läuft zuerst): Ctrl+G beginnt im Feld (UI-Richtlinie 10).
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  const options = useMemo(() => goToOptions(value, days, entries), [value, days, entries]);
  const current = options[Math.min(active, options.length - 1)];
  const go = (option: Option | undefined) => {
    if (option !== undefined) onGo(option.target);
  };
  return (
    <I2Dialog
      title="Gehe zu"
      onClose={onClose}
      description="Tag, Zeit und Spalte («Mo 0800 Kp Kdt»), eine Beso-Nummer («21») oder den Anfang eines Titels eingeben. Enter springt."
    >
      <div className="wap-i2-goto">
        <input
          ref={inputRef}
          aria-label="Gehe zu"
          aria-describedby={listId}
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setActive(0);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const n = options.length;
              if (n > 0) setActive((a) => (a + (event.key === 'ArrowDown' ? 1 : n - 1)) % n);
            } else if (event.key === 'Enter') {
              event.preventDefault();
              go(current);
            }
          }}
        />
        <p id={listId} className="wap-i2-sr" aria-live="polite">
          {current === undefined
            ? value.trim() === ''
              ? ''
              : 'Nichts gefunden.'
            : `Enter springt zu: ${current.text}`}
        </p>
        <ul aria-label="Vorschläge">
          {options.map((o) => (
            <li key={o.id}>
              <button
                type="button"
                tabIndex={-1}
                className={o === current ? 'is-active' : ''}
                aria-current={o === current}
                onClick={() => go(o)}
              >
                {o.text}
              </button>
            </li>
          ))}
          {value.trim() !== '' && options.length === 0 && (
            <li>Nichts gefunden. Zum Beispiel «Mo 0800» oder den Anfang eines Titels eingeben.</li>
          )}
        </ul>
      </div>
    </I2Dialog>
  );
}

export function OtherDaysDialog({
  title,
  days,
  sourceDate,
  onApply,
  onClose,
}: {
  title: string;
  days: readonly { readonly date: IsoDate; readonly weekday: Weekday }[];
  sourceDate: IsoDate;
  onApply: (dates: readonly IsoDate[]) => void;
  onClose: () => void;
}) {
  const [chosen, setChosen] = useState<ReadonlySet<IsoDate>>(new Set());
  const [error, setError] = useState('');
  const firstRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    firstRef.current?.focus();
  }, []);
  const toggle = (date: IsoDate) => {
    if (date === sourceDate) return;
    setError('');
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };
  const choose = (weekdays: readonly Weekday[]) => {
    setError('');
    setChosen(
      new Set(
        days
          .filter((d) => weekdays.includes(d.weekday) && d.date !== sourceDate)
          .map((d) => d.date),
      ),
    );
  };
  const apply = () => {
    if (chosen.size === 0) {
      setError('Kein Tag gewählt. Mindestens einen Tag ankreuzen (Ziffern 1–7) und Enter drücken.');
      return;
    }
    onApply([...chosen].sort());
  };
  const keys = (event: KeyboardEvent<HTMLDivElement>) => {
    const digit = /^[1-7]$/.test(event.key) ? Number(event.key) : 0;
    if (digit > 0 && !event.ctrlKey && !event.altKey && !event.metaKey) {
      event.preventDefault();
      const day = days.find((d) => d.weekday === WEEKDAYS[digit - 1]);
      if (day !== undefined) toggle(day.date);
    } else if (event.key === 'Enter' && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      apply();
    }
  };
  return (
    <I2Dialog
      title="Auch an anderen Tagen"
      onClose={onClose}
      description={`«${title}» an den angekreuzten Tagen dieser Woche als unabhängige Kopie anlegen. Ziffern 1–7 schalten die Tage, Enter übernimmt.`}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: Ziffern 1–7 und Enter im ganzen Dialog (UI-Richtlinie 5.8) */}
      <div className="wap-i2-otherdays" onKeyDown={keys}>
        <fieldset>
          <legend>Tage</legend>
          {days.map((d, i) => (
            <label key={d.date}>
              <input
                ref={
                  d.date !== sourceDate && days.findIndex((x) => x.date !== sourceDate) === i
                    ? firstRef
                    : undefined
                }
                type="checkbox"
                checked={d.date === sourceDate || chosen.has(d.date)}
                disabled={d.date === sourceDate}
                onChange={() => toggle(d.date)}
              />
              {i + 1} · {dayLabel(d.weekday, d.date)}
              {d.date === sourceDate ? ' (Ausgangstag)' : ''}
            </label>
          ))}
        </fieldset>
        <div className="wap-i2-otherdays-quick">
          <button
            type="button"
            className="btn"
            onClick={() => choose(['Mo', 'Di', 'Mi', 'Do', 'Fr'])}
          >
            Mo–Fr
          </button>
          <button type="button" className="btn" onClick={() => choose(WEEKDAYS)}>
            Ganze Woche
          </button>
        </div>
        {error !== '' && (
          <p className="wap-i2-field-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="btn btn-primary" onClick={apply}>
          Übernehmen
        </button>
      </div>
    </I2Dialog>
  );
}
