// Kleine Dialoge des Rasters für I3 (UI-Richtlinie 5.4 Tabelle «nach Tastatur», 10 «Tag neu nummerieren»):
// Querbalken (Titel, von, bis), Marker (Art, Zeitpunkt), ganztägige Bemerkung (Text) und «Tag neu nummerieren»
// mit Vorschau alt → neu (R-5.3-08). Enter übernimmt, Esc bricht ab; Fehler mit Ursache und nächstem Schritt.

import { useEffect, useId, useRef, useState } from 'react';
import { daysBetween, formatDate } from '../../../model/wap/calendar';
import { isRenderable } from '../../../model/wap/layout/text/measure';
import { formatMilTime } from '../../../model/wap/time';
import type { IsoDate, MarkerKind } from '../../../model/wap/types';
import { GLYPH_MESSAGE } from '../panel/fields';
import { I2Dialog } from './I2Dialog';
import { parseDateInput, parseTimeInput } from './timeInput';

function useFirstFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    ref.current?.focus();
    if (ref.current instanceof HTMLInputElement) ref.current.select();
  }, []);
  return ref;
}

export function QuerbalkenDialog({
  fromDate,
  toDate,
  onCreate,
  onClose,
}: {
  fromDate: IsoDate;
  toDate: IsoDate;
  onCreate: (title: string, from: IsoDate, to: IsoDate) => void;
  onClose: () => void;
}) {
  const first = useFirstFocus<HTMLInputElement>();
  const errorId = useId();
  const [title, setTitle] = useState('');
  const [from, setFrom] = useState(formatDate(fromDate, 'long'));
  const [to, setTo] = useState(formatDate(toDate, 'long'));
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState<'title' | 'from' | 'to' | null>(null);
  return (
    <I2Dialog
      title="Neuer Querbalken"
      description="Querbalken liegen im Band über 0500 und dürfen über Wochengrenzen reichen."
      onClose={onClose}
    >
      <form
        className="wap-i2-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (title.trim() === '') {
            setInvalid('title');
            setError('Der Querbalken hat keinen Titel. Einen Titel eingeben, zum Beispiel «OLMA».');
            return;
          }
          if (!isRenderable(title)) {
            setInvalid('title');
            setError(GLYPH_MESSAGE);
            return;
          }
          const a = parseDateInput(from, 'Datum von');
          if (!a.ok) {
            setInvalid('from');
            setError(a.message);
            return;
          }
          const b = parseDateInput(to, 'Datum bis');
          if (!b.ok) {
            setInvalid('to');
            setError(b.message);
            return;
          }
          if (daysBetween(a.value, b.value) < 0) {
            setInvalid('to');
            setError('«Datum bis» liegt vor «Datum von». Ein späteres Enddatum eingeben.');
            return;
          }
          onCreate(title.trim(), a.value, b.value);
        }}
      >
        <label>
          Titel
          <input
            ref={first}
            value={title}
            aria-invalid={invalid === 'title'}
            aria-describedby={invalid === 'title' ? errorId : undefined}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <label>
          Datum von
          <input
            value={from}
            aria-invalid={invalid === 'from'}
            aria-describedby={invalid === 'from' ? errorId : undefined}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label>
          Datum bis
          <input
            value={to}
            aria-invalid={invalid === 'to'}
            aria-describedby={invalid === 'to' ? errorId : undefined}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        {error !== '' && (
          <p role="alert" id={errorId} className="wap-i2-field-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          Querbalken anlegen
        </button>
      </form>
    </I2Dialog>
  );
}

const MARKER_KINDS: readonly { value: MarkerKind; label: string }[] = [
  { value: 'AV', label: 'AV' },
  { value: 'ABV', label: 'ABV' },
  { value: 'HV', label: 'HV' },
  { value: 'custom', label: 'frei' },
];

export function MarkerDialog({
  date,
  at,
  onCreate,
  onClose,
}: {
  date: IsoDate;
  at: number;
  onCreate: (kind: MarkerKind, customKind: string, at: number, date: IsoDate) => void;
  onClose: () => void;
}) {
  const first = useFirstFocus<HTMLSelectElement>();
  const errorId = useId();
  const [kind, setKind] = useState<MarkerKind>('AV');
  const [custom, setCustom] = useState('');
  const [time, setTime] = useState(formatMilTime(at));
  // Tag sichtbar und änderbar (nicht nur der Tag des Zellzeigers; UX-AB-18).
  const [day, setDay] = useState(formatDate(date, 'long'));
  const [error, setError] = useState('');
  return (
    <I2Dialog
      title="Neuer Marker"
      // Marker gelten immer über alle Planungsspalten des Tags (Entscheid Auftraggeber 21.10.2026).
      description="Die Beschriftung wird aus der Art gebildet. Der Marker gilt über alle Planungsspalten des Tags."
      onClose={onClose}
    >
      <form
        className="wap-i2-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (kind === 'custom' && custom.trim() === '') {
            setError('Die freie Art braucht eine Bezeichnung, zum Beispiel «Appell».');
            return;
          }
          if (!isRenderable(custom)) {
            setError(GLYPH_MESSAGE);
            return;
          }
          const d = parseDateInput(day, 'Tag');
          if (!d.ok) {
            setError(d.message);
            return;
          }
          const t = parseTimeInput(time, 'Zeitpunkt');
          if (!t.ok) {
            setError(t.message);
            return;
          }
          onCreate(kind, custom.trim(), t.value, d.value);
        }}
      >
        <label>
          Art
          <select
            ref={first}
            value={kind}
            onChange={(e) => setKind(e.target.value as MarkerKind)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
          >
            {MARKER_KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        {kind === 'custom' && (
          <label>
            Freie Art
            <input value={custom} onChange={(e) => setCustom(e.target.value)} />
          </label>
        )}
        <label>
          Tag
          <input
            value={day}
            aria-describedby={error === '' ? undefined : errorId}
            onChange={(e) => setDay(e.target.value)}
          />
        </label>
        <label>
          Zeitpunkt
          <input
            value={time}
            inputMode="numeric"
            aria-describedby={error === '' ? undefined : errorId}
            onChange={(e) => setTime(e.target.value)}
          />
        </label>
        {error !== '' && (
          <p role="alert" id={errorId} className="wap-i2-field-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          Marker anlegen
        </button>
      </form>
    </I2Dialog>
  );
}

export function RemarkDialog({
  date,
  onCreate,
  onClose,
}: {
  date: IsoDate;
  onCreate: (text: string) => void;
  onClose: () => void;
}) {
  const first = useFirstFocus<HTMLInputElement>();
  const errorId = useId();
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  return (
    <I2Dialog
      title="Ganztägige Bemerkung"
      description={`Im Terminbereich am ${formatDate(date, 'long')}, ohne Nummer und ohne Kästchen.`}
      onClose={onClose}
    >
      <form
        className="wap-i2-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (text.trim() === '') {
            setError('Die Bemerkung hat keinen Text. Einen Text eingeben oder mit Esc abbrechen.');
            return;
          }
          if (!isRenderable(text)) {
            setError(GLYPH_MESSAGE);
            return;
          }
          onCreate(text.trim());
        }}
      >
        <label>
          Text
          <input
            ref={first}
            value={text}
            aria-invalid={error !== ''}
            aria-describedby={error === '' ? undefined : errorId}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
        {error !== '' && (
          <p role="alert" id={errorId} className="wap-i2-field-error">
            {error}
          </p>
        )}
        <button type="submit" className="btn btn-primary">
          Bemerkung anlegen
        </button>
      </form>
    </I2Dialog>
  );
}

export interface RenumberRow {
  readonly title: string;
  readonly from: number | null;
  readonly to: number | null;
}

/** «Tag neu nummerieren» mit Vorschau alt → neu (R-5.3-08); Abbrechen ändert nichts. */
export function RenumberDialog({
  date,
  rows,
  onConfirm,
  onClose,
}: {
  date: IsoDate;
  rows: readonly RenumberRow[];
  onConfirm: () => void;
  onClose: () => void;
}) {
  const cancel = useFirstFocus<HTMLButtonElement>();
  const changed = rows.filter((r) => r.from !== r.to).length;
  const n = (v: number | null) => (v === null ? '–' : String(v));
  return (
    <I2Dialog
      title="Tag neu nummerieren"
      description={`Beso vom ${formatDate(date, 'long')} nach Sortierzeit neu nummerieren. ${changed === 0 ? 'Alle Nummern bleiben.' : `${changed} ${changed === 1 ? 'Nummer ändert' : 'Nummern ändern'} sich.`} Verweise in Titeln werden nachgeführt.`}
      onClose={onClose}
    >
      <table className="wap-panel-table" aria-label="Vorschau alt → neu">
        <thead>
          <tr>
            <th scope="col">Beso</th>
            <th scope="col">alt</th>
            <th scope="col">neu</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: Vorschau in Sortierreihenfolge
            <tr key={i}>
              <td>{r.title || 'ohne Titel'}</td>
              <td>{n(r.from)}</td>
              <td>{r.from === r.to ? n(r.to) : <strong>{n(r.to)}</strong>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="i2-grid-scope">
        <button type="button" ref={cancel} className="btn" onClick={onClose}>
          Abbrechen
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={rows.length === 0}
          onClick={onConfirm}
        >
          Neu nummerieren
        </button>
      </div>
    </I2Dialog>
  );
}
