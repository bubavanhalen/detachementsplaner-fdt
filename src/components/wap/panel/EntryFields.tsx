// Seitenfeld «Eintrag»: alle Angaben des gewählten Eintrags je Typ (Beschrieb 4.6 Tabelle, 5.1; UI-Richtlinie 6;
// R-5.1-12, R-5.1-25, R-4.6-13, R-4.7-10, R-4.1-10, R-4.7-16). Jede Feldänderung ist ein Befehl und ein Undo-Schritt.

import { type RefObject, useEffect, useRef, useState } from 'react';
import { addDays, daysBetween, formatDate, weekdayOf } from '../../../model/wap/calendar';
import {
  addTimeWindow,
  deadlineDateProblem,
  removeTimeWindow,
  setBesoNumberFixed,
  setWindowTime,
  updateTimeWindow,
} from '../../../model/wap/commands/beso';
import { suggestCategory, updateEntry } from '../../../model/wap/commands/entries';
import { personLabel, personShort } from '../../../model/wap/commands/persons';
import { addRapportCode, isKnownCode, STATUS_NAMES } from '../../../model/wap/commands/settings';
import {
  addSubtask,
  moveSubtask,
  removeSubtask,
  updateSubtask,
} from '../../../model/wap/commands/subtasks';
import { agendaLine, resolveTitle } from '../../../model/wap/derive/agenda';
import { dayColumns } from '../../../model/wap/derive/columns';
import { markerLabel } from '../../../model/wap/derive/marker';
import { formatTimeSpec } from '../../../model/wap/time';
import type {
  Beso,
  Block,
  Column,
  ColumnSelection,
  DayRemark,
  Entry,
  Id,
  IsoDate,
  Marker,
  MultiDayRemark,
  Plan,
  Querbalken,
  Rapport,
  RichText,
} from '../../../model/wap/types';
import { parseDateInput } from '../i2/timeInput';
import {
  CheckField,
  type Choice,
  RichTitleField,
  Section,
  Segment,
  SelectField,
  SuggestField,
  type Suggestion,
  TextField,
} from './fields';
import { parseSpec } from './timeSpec';
import type { PanelActions } from './types';

const STATUS_CHOICES: readonly Choice[] = [
  { value: 'confirmed', label: STATUS_NAMES.confirmed },
  { value: 'open', label: STATUS_NAMES.open },
  { value: 'cancelled', label: STATUS_NAMES.cancelled },
];

export const NOTE_HINT = 'Erscheint nie im PDF und nie in weitergegebenen Dateien.';

interface Ctx {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly a: PanelActions;
}

/**
 * Fokus ins erste Feld einer neu angefügten Tabellenzeile (H-UI2, UX-H-09, SA-H-20; UI-Richtlinie 13.4): `request`
 * vor dem Anfügen, danach erhält die letzte Zeile den Fokus, sobald die Zahl der Zeilen steigt.
 */
function useFocusNewRow(count: number): {
  readonly table: RefObject<HTMLTableElement | null>;
  readonly request: () => void;
} {
  const table = useRef<HTMLTableElement>(null);
  const pending = useRef<number | null>(null);
  useEffect(() => {
    const before = pending.current;
    if (before === null || count <= before) return;
    pending.current = null;
    const rows = table.current?.querySelectorAll('tbody tr');
    const input = rows?.[rows.length - 1]?.querySelector<HTMLInputElement>('input');
    input?.focus();
    input?.select();
  }, [count]);
  return {
    table,
    request: () => {
      pending.current = count;
    },
  };
}

function weekDays(plan: Plan, weekId: Id): readonly { date: IsoDate; label: string }[] {
  const week = plan.weeks.find((w) => w.id === weekId);
  if (week === undefined) return [];
  return week.days.map((d, i) => {
    const date = addDays(week.startDate, i);
    return { date, label: `${d.weekday} ${formatDate(date, 'long')}` };
  });
}

/** Spalten des Tages (aus dem Spaltensatz der Woche, in der das Datum liegt). */
export function columnsAt(plan: Plan, date: IsoDate): readonly Column[] {
  const week = plan.weeks.find((w) => {
    const d = daysBetween(w.startDate, date);
    return d >= 0 && d <= 6;
  });
  return week === undefined ? [] : dayColumns(plan, week.id, weekdayOf(date));
}

function categoryChoices(plan: Plan, none?: string): Choice[] {
  return [
    ...(none === undefined ? [] : [{ value: '', label: none }]),
    ...plan.legend.map((c) => ({ value: c.id, label: c.name })),
  ];
}

/** Vorschläge für Ltg und Tn: Personenliste und Funktionsliste (R-4.1-10, Beschrieb 4.7). */
export function personSuggestions(plan: Plan, withFunctions: boolean): Suggestion[] {
  const out: Suggestion[] = plan.persons.map((p) => ({
    value: personShort(p),
    label: personLabel(p),
    ...(p.funktion === '' ? {} : { hint: p.funktion }),
  }));
  if (withFunctions)
    for (const f of plan.functionList) {
      const cat = plan.legend.find((c) => c.id === f.categoryId);
      out.push({
        value: f.code,
        label: f.code,
        ...(cat === undefined ? {} : { hint: `Kategorie ${cat.name}` }),
      });
    }
  return out;
}

function TagField({ c, date, onDate }: { c: Ctx; date: IsoDate; onDate: (d: IsoDate) => void }) {
  const days = weekDays(c.plan, c.weekId);
  const inWeek = days.some((d) => d.date === date);
  return (
    <SelectField
      label="Tag"
      shortcut="T"
      field="date"
      value={date}
      disabled={c.a.disabled}
      onEscape={c.a.toGrid}
      choices={[
        ...(inWeek ? [] : [{ value: date, label: formatDate(date, 'long') }]),
        ...days.map((d) => ({ value: d.date, label: d.label })),
      ]}
      onCommit={onDate}
    />
  );
}

/** Spaltenwahl «von–bis» über die Planungs- und Nebenspalten des Tages; «alle» = alle Planungsspalten. */
function ColumnsField({
  c,
  label,
  date,
  value,
  onCommit,
}: {
  c: Ctx;
  label: string;
  date: IsoDate;
  value: ColumnSelection;
  onCommit: (sel: ColumnSelection) => void;
}) {
  const columns = columnsAt(c.plan, date).filter(
    (col) => col.kind === 'planning' || col.kind === 'secondary',
  );
  const ids = value.kind === 'ids' ? value.ids : [];
  const indices = ids.map((id) => columns.findIndex((col) => col.id === id)).filter((i) => i >= 0);
  const first = value.kind === 'all' ? 'all' : (columns[Math.min(...indices)]?.id ?? '');
  const lastIndex = indices.length === 0 ? -1 : Math.max(...indices);
  const last = value.kind === 'all' ? '' : (columns[lastIndex]?.id ?? '');
  const linked =
    indices.length > 0 && Math.max(...indices) - Math.min(...indices) + 1 !== indices.length;
  const missing = ids.filter((id) => !columns.some((col) => col.id === id)).length;
  const between = (a: string, b: string): ColumnSelection => {
    if (a === 'all') return { kind: 'all' };
    const i = columns.findIndex((col) => col.id === a);
    const j = Math.max(
      i,
      columns.findIndex((col) => col.id === b),
    );
    return { kind: 'ids', ids: columns.slice(i, j + 1).map((col) => col.id) };
  };
  return (
    <div className="wap-panel-row">
      <SelectField
        label={label}
        shortcut="S"
        field="columns"
        value={first}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        choices={[
          { value: 'all', label: 'alle Planungsspalten' },
          ...(first === '' ? [{ value: '', label: 'fehlt am Tag' }] : []),
          ...columns.map((col) => ({ value: col.id, label: col.name })),
        ]}
        onCommit={(v) => onCommit(between(v, v))}
        {...(missing > 0
          ? { hint: 'Spalte fehlt im Spaltensatz dieses Tages (Befund P1): Spalte neu wählen.' }
          : linked
            ? { hint: 'Verknüpfte Teilblöcke (nicht benachbarte Spalten).' }
            : {})}
      />
      {first !== 'all' && first !== '' && (
        <SelectField
          label="bis Spalte"
          value={last}
          disabled={c.a.disabled}
          onEscape={c.a.toGrid}
          choices={columns
            .slice(
              Math.max(
                0,
                columns.findIndex((col) => col.id === first),
              ),
            )
            .map((col) => ({ value: col.id, label: col.name }))}
          onCommit={(v) => onCommit(between(first, v))}
        />
      )}
    </div>
  );
}

function StatusField({ c, e }: { c: Ctx; e: Entry }) {
  return (
    <Segment
      label="Status"
      field="status"
      value={e.status}
      choices={STATUS_CHOICES}
      disabled={c.a.disabled}
      onEscape={c.a.toGrid}
      onCommit={(v) =>
        c.a.run((p, ctx) => updateEntry(p, e.id, e.type, { status: v as Entry['status'] }, ctx))
      }
    />
  );
}

function NoteField({ c, e }: { c: Ctx; e: Entry }) {
  return (
    <TextField
      label="Interne Notiz"
      multiline
      value={e.internalNote}
      hint={NOTE_HINT}
      disabled={c.a.disabled}
      onEscape={c.a.toGrid}
      onCommit={(v) => c.a.run((p, ctx) => updateEntry(p, e.id, e.type, { internalNote: v }, ctx))}
    />
  );
}

function plainText(plan: Plan, t: RichText): string {
  return resolveTitle(plan, t)
    .map((r) => r.text)
    .join('');
}

/** Ltg mit Vorschlag der Kategorie gemäss Funktionsliste (R-4.7-10): nur Vorschlag, übernommen per Aktion. */
function LtgField({
  c,
  value,
  categoryId,
  onLtg,
  onCategory,
}: {
  c: Ctx;
  value: string;
  categoryId: Id | null;
  onLtg: (v: string) => void;
  onCategory: (id: Id) => void;
}) {
  const proposal = suggestCategory(c.plan, value);
  const cat = proposal === null ? undefined : c.plan.legend.find((k) => k.id === proposal);
  return (
    <>
      <SuggestField
        label="Ltg"
        shortcut="L"
        field="ltg"
        value={value}
        suggestions={personSuggestions(c.plan, true)}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={onLtg}
      />
      {cat !== undefined && proposal !== categoryId && (
        <fieldset className="wap-panel-proposal" aria-label="Vorschlag Kategorie">
          <span>Vorschlag gemäss Funktionsliste: Kategorie «{cat.name}»</span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={c.a.disabled}
            onClick={() => onCategory(cat.id)}
          >
            Kategorie «{cat.name}» übernehmen
          </button>
        </fieldset>
      )}
    </>
  );
}

function BlockFields({ c, e }: { c: Ctx; e: Block }) {
  const up = (changes: Parameters<typeof updateEntry<'block'>>[3]) =>
    c.a.run((p, ctx) => updateEntry(p, e.id, 'block', changes, ctx));
  return (
    <>
      <RichTitleField
        label="Titel"
        field="title"
        value={e.title}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(title) => up({ title })}
      />
      <TextField
        label="Zusatz"
        value={e.supplement}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(supplement) => up({ supplement })}
      />
      <TagField c={c} date={e.date} onDate={(date) => up({ date })} />
      <TextField
        label="Zeit"
        shortcut="Z"
        field="time"
        value={formatTimeSpec(e.time, e.date)}
        hint="Zum Beispiel 0800-1200, ab 1900, bis 1200 oder 0730"
        validate={(v) => {
          const r = parseSpec(v, e.date, 'Zeit', ['point', 'range', 'from', 'until']);
          return r.ok ? '' : r.message;
        }}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => {
          const r = parseSpec(v, e.date, 'Zeit', ['point', 'range', 'from', 'until']);
          if (r.ok && r.value.form !== 'deadline') up({ time: r.value });
        }}
      />
      <ColumnsField
        c={c}
        label="Spalten"
        date={e.date}
        value={e.columns}
        onCommit={(columns) => up({ columns })}
      />
      <SelectField
        label="Kategorie"
        shortcut="K"
        field="category"
        value={e.categoryId}
        choices={categoryChoices(c.plan)}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(categoryId) => up({ categoryId })}
      />
      <SelectField
        label="Gemeinsame Leitung (zweite Kategorie)"
        value={e.secondCategoryId ?? ''}
        choices={categoryChoices(c.plan, 'keine')}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => up({ secondCategoryId: v === '' ? null : v })}
      />
      <LtgField
        c={c}
        value={e.ltg}
        categoryId={e.categoryId}
        onLtg={(ltg) => up({ ltg })}
        onCategory={(categoryId) => up({ categoryId })}
      />
      <TextField
        label="Ort"
        shortcut="O"
        field="ort"
        value={e.ort}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(ort) => up({ ort })}
      />
      <div className="wap-panel-row">
        <SuggestField
          label="Tn"
          value={e.tn}
          suggestions={personSuggestions(c.plan, true)}
          disabled={c.a.disabled}
          onEscape={c.a.toGrid}
          onCommit={(tn) => up({ tn })}
        />
        <CheckField
          label="Tn drucken"
          checked={e.printTn}
          disabled={c.a.disabled}
          onEscape={c.a.toGrid}
          onCommit={(printTn) => up({ printTn })}
        />
      </div>
      <TextField
        label="Tpt"
        value={e.tpt}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(tpt) => up({ tpt })}
      />
      <div className="wap-panel-row">
        <TextField
          label="Tenue"
          value={e.tenue}
          disabled={c.a.disabled}
          onEscape={c.a.toGrid}
          onCommit={(tenue) => up({ tenue })}
        />
        <CheckField
          label="Tenue drucken"
          checked={e.printTenue}
          disabled={c.a.disabled}
          onEscape={c.a.toGrid}
          onCommit={(printTenue) => up({ printTenue })}
        />
      </div>
      <StatusField c={c} e={e} />
      <Segment
        label="Textrichtung"
        value={e.textDirection}
        choices={[
          { value: 'auto', label: 'automatisch' },
          { value: 'horizontal', label: 'waagrecht' },
          { value: 'vertical', label: 'senkrecht' },
        ]}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => up({ textDirection: v as Block['textDirection'] })}
      />
      <CheckField
        label="Offenes Ende"
        checked={e.openEnd}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(openEnd) => up({ openEnd })}
      />
      <SubtaskTable c={c} e={e} />
      <NoteField c={c} e={e} />
    </>
  );
}

/** Teilaufgaben (Gate S A1; R-5.1-25): Tabelle `grid`, hinzufügen, bearbeiten, verschieben, entfernen. */
function SubtaskTable({ c, e }: { c: Ctx; e: Block }) {
  const list = e.subtasks ?? [];
  const run = c.a.run;
  const newRow = useFocusNewRow(list.length);
  return (
    <Section title="Teilaufgaben">
      {list.length > 0 && (
        // biome-ignore lint/a11y/noNoninteractiveElementToInteractiveRole: R-5.1-25 verlangt die Tabelle «Teilaufgaben» mit Rolle grid
        <table ref={newRow.table} role="grid" aria-label="Teilaufgaben" className="wap-panel-table">
          <thead>
            <tr>
              <th scope="col">Titel</th>
              <th scope="col">Ltg</th>
              <th scope="col">Ort</th>
              <th scope="col">
                <span className="wap-i2-sr">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: Teilaufgaben haben keine ID; die Lage ist ihr Schlüssel
              <tr key={i}>
                <td>
                  <TextField
                    label={`Titel Teilaufgabe ${i + 1}`}
                    value={plainText(c.plan, s.title)}
                    validate={(v) =>
                      v.trim() === '' ? 'Die Teilaufgabe braucht einen Titel.' : ''
                    }
                    disabled={c.a.disabled}
                    onEscape={c.a.toGrid}
                    onCommit={(v) =>
                      run((p, ctx) =>
                        updateSubtask(p, e.id, i, { title: [{ text: v, bold: false }] }, ctx),
                      )
                    }
                  />
                </td>
                <td>
                  <SuggestField
                    label={`Ltg Teilaufgabe ${i + 1}`}
                    value={s.ltg}
                    suggestions={personSuggestions(c.plan, true)}
                    disabled={c.a.disabled}
                    onEscape={c.a.toGrid}
                    onCommit={(ltg) => run((p, ctx) => updateSubtask(p, e.id, i, { ltg }, ctx))}
                  />
                </td>
                <td>
                  <TextField
                    label={`Ort Teilaufgabe ${i + 1}`}
                    value={s.ort}
                    disabled={c.a.disabled}
                    onEscape={c.a.toGrid}
                    onCommit={(ort) => run((p, ctx) => updateSubtask(p, e.id, i, { ort }, ctx))}
                  />
                </td>
                <td className="wap-panel-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Teilaufgabe ${i + 1} nach oben`}
                    disabled={c.a.disabled || i === 0}
                    onClick={() => run((p, ctx) => moveSubtask(p, e.id, i, i - 1, ctx))}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Teilaufgabe ${i + 1} nach unten`}
                    disabled={c.a.disabled || i === list.length - 1}
                    onClick={() => run((p, ctx) => moveSubtask(p, e.id, i, i + 1, ctx))}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Teilaufgabe ${i + 1} entfernen`}
                    disabled={c.a.disabled}
                    onClick={() => run((p, ctx) => removeSubtask(p, e.id, i, ctx))}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <button
        type="button"
        className="btn btn-sm"
        disabled={c.a.disabled}
        onClick={() => {
          newRow.request();
          run((p, ctx) =>
            addSubtask(
              p,
              e.id,
              { title: [{ text: `Teilaufgabe ${list.length + 1}`, bold: false }] },
              ctx,
            ),
          );
        }}
      >
        Teilaufgabe hinzufügen
      </button>
    </Section>
  );
}

function BesoFields({ c, e }: { c: Ctx; e: Beso }) {
  const up = (changes: Parameters<typeof updateEntry<'beso'>>[3]) =>
    c.a.run((p, ctx) => updateEntry(p, e.id, 'beso', changes, ctx));
  const [confirmLast, setConfirmLast] = useState(false);
  const newWindow = useFocusNewRow(e.windows.length);
  const columns = columnsAt(c.plan, e.date).filter(
    (col) => col.kind === 'planning' || col.kind === 'secondary',
  );
  const freeText = e.agendaOverride !== null;
  return (
    <>
      <div className="wap-panel-field">
        <span className="wap-panel-label">
          <span>Nr</span>
        </span>
        <p className="wap-panel-number">
          <strong>{e.besoNumber ?? '–'}</strong> · {e.numberFixed ? 'fixiert' : 'laufend'}
          {e.besoNumber === null && ' (Nummernkreis voll, Befund P17)'}
        </p>
        <div className="wap-panel-row">
          <button
            type="button"
            className="btn btn-sm"
            disabled={c.a.disabled || (!e.numberFixed && e.besoNumber === null)}
            onClick={() =>
              c.a.run((p, ctx) => setBesoNumberFixed(p, e.id, !e.numberFixed, null, ctx))
            }
          >
            {e.numberFixed ? 'Fixierung lösen' : 'Nummer fixieren'}
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={c.a.disabled}
            onClick={() => c.a.renumber(e.date)}
          >
            Tag neu nummerieren …
          </button>
        </div>
        <TextField
          label="Nummer fixieren als"
          inputMode="numeric"
          value={e.besoNumber === null ? '' : String(e.besoNumber)}
          validate={(v) => (/^\d{1,2}$/.test(v.trim()) ? '' : 'Eine Nummer wie 12 eingeben.')}
          disabled={c.a.disabled}
          onEscape={c.a.toGrid}
          onCommit={(v) =>
            c.a.run((p, ctx) => setBesoNumberFixed(p, e.id, true, Number(v.trim()), ctx))
          }
        />
      </div>
      <RichTitleField
        label="Titel"
        field="title"
        value={e.title}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(title) => up({ title })}
      />
      <TagField c={c} date={e.date} onDate={(date) => up({ date })} />
      <Section title="Zeitfenster">
        <table ref={newWindow.table} className="wap-panel-table" aria-label="Zeitfenster">
          <thead>
            <tr>
              <th scope="col">Zeit</th>
              <th scope="col">Spalte</th>
              <th scope="col">Zusatz</th>
              <th scope="col">
                <span className="wap-i2-sr">Aktionen</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {e.windows.map((w, i) => (
              <tr key={w.id}>
                <td>
                  <TextField
                    label={`Zeit ${i + 1}`}
                    {...(i === 0 ? { field: 'time' } : {})}
                    value={formatTimeSpec(w.time, e.date)}
                    validate={(v) => {
                      const r = parseSpec(v, e.date, 'Zeit', [
                        'point',
                        'range',
                        'from',
                        'until',
                        'deadline',
                      ]);
                      if (!r.ok) return r.message;
                      // Frist an einem anderen Tag (FA2-03): mit mehreren Zeitfenstern Meldung am Feld.
                      const problem = deadlineDateProblem(c.plan, e.id, r.value, r.deadlineDate);
                      return problem === null ? '' : `${problem.cause} ${problem.nextStep}`;
                    }}
                    disabled={c.a.disabled}
                    onEscape={c.a.toGrid}
                    onCommit={(v) => {
                      const r = parseSpec(v, e.date, 'Zeit', [
                        'point',
                        'range',
                        'from',
                        'until',
                        'deadline',
                      ]);
                      // Frist mit Datum: der Beso rückt auf den Frist-Tag (FA2-03).
                      if (r.ok)
                        c.a.run((p, ctx) =>
                          setWindowTime(p, e.id, w.id, r.value, r.deadlineDate, ctx),
                        );
                    }}
                  />
                </td>
                <td>
                  <SelectField
                    label={`Spalte ${i + 1}`}
                    value={w.columnId ?? ''}
                    choices={[
                      { value: '', label: 'Beso-Spalte' },
                      ...columns.map((col) => ({ value: col.id, label: col.name })),
                    ]}
                    disabled={c.a.disabled}
                    onEscape={c.a.toGrid}
                    onCommit={(v) =>
                      c.a.run((p, ctx) =>
                        updateTimeWindow(p, e.id, w.id, { columnId: v === '' ? null : v }, ctx),
                      )
                    }
                  />
                </td>
                <td>
                  <TextField
                    label={`Zusatz ${i + 1}`}
                    value={w.supplement}
                    disabled={c.a.disabled}
                    onEscape={c.a.toGrid}
                    onCommit={(supplement) =>
                      c.a.run((p, ctx) => updateTimeWindow(p, e.id, w.id, { supplement }, ctx))
                    }
                  />
                </td>
                <td className="wap-panel-actions">
                  <button
                    type="button"
                    className="btn btn-sm"
                    aria-label={`Zeitfenster ${i + 1} entfernen`}
                    disabled={c.a.disabled}
                    onClick={() => {
                      if (e.windows.length === 1) setConfirmLast(true);
                      else c.a.run((p, ctx) => removeTimeWindow(p, e.id, w.id, ctx));
                    }}
                  >
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {confirmLast && (
          <fieldset className="wap-panel-proposal" aria-label="Letztes Zeitfenster">
            <span>Das ist das letzte Zeitfenster. Den ganzen Beso samt Terminzeile löschen?</span>
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                setConfirmLast(false);
                c.a.remove([e.id]);
              }}
            >
              Beso löschen
            </button>
            <button type="button" className="btn btn-sm" onClick={() => setConfirmLast(false)}>
              Abbrechen
            </button>
          </fieldset>
        )}
        <div className="wap-panel-row">
          <button
            type="button"
            className="btn btn-sm"
            disabled={c.a.disabled}
            onClick={() => {
              const last = e.windows[e.windows.length - 1];
              const at =
                last === undefined
                  ? 480
                  : Math.min(
                      1380,
                      (last.time.form === 'range'
                        ? last.time.to
                        : last.time.form === 'point'
                          ? last.time.at + 60
                          : 600) % 1440,
                    );
              newWindow.request();
              c.a.run((p, ctx) => addTimeWindow(p, e.id, { time: { form: 'point', at } }, ctx));
            }}
          >
            Zeitfenster hinzufügen
          </button>
          {e.windows.length === 1 && (
            <button
              type="button"
              className="btn btn-sm"
              disabled={c.a.disabled}
              title="Ein Eintrag ohne Zeit wird zur ganztägigen Bemerkung (Beschrieb 5.3)"
              onClick={() => {
                const w = e.windows[0];
                if (w !== undefined)
                  c.a.run((p, ctx) => updateTimeWindow(p, e.id, w.id, { time: null }, ctx));
              }}
            >
              Ohne Zeit (wird Bemerkung)
            </button>
          )}
        </div>
      </Section>
      <LtgField
        c={c}
        value={e.ltg}
        categoryId={e.categoryId}
        onLtg={(ltg) => up({ ltg })}
        onCategory={(categoryId) => up({ categoryId })}
      />
      <SuggestField
        label="Tn"
        value={e.tn}
        suggestions={personSuggestions(c.plan, true)}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(tn) => up({ tn })}
      />
      <TextField
        label="Tpt"
        value={e.tpt}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(tpt) => up({ tpt })}
      />
      <TextField
        label="Ort"
        shortcut="O"
        field="ort"
        value={e.ort}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(ort) => up({ ort })}
      />
      <SelectField
        label="Kategorie"
        shortcut="K"
        field="category"
        value={e.categoryId ?? ''}
        // Beso: Leitungskategorie optional, «keine» wie ein Beso ohne Kästchen im Import (UX-AB-15).
        choices={categoryChoices(c.plan, 'keine')}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(categoryId) => up({ categoryId: categoryId === '' ? null : categoryId })}
      />
      <StatusField c={c} e={e} />
      <Segment
        label="Terminzeile"
        value={freeText ? 'free' : 'fields'}
        choices={[
          { value: 'fields', label: 'aus den Feldern' },
          { value: 'free', label: 'Freitext' },
        ]}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) =>
          up({
            agendaOverride: v === 'free' ? plainText(c.plan, e.title) || 'Freitext' : null,
          })
        }
      />
      {freeText && (
        <TextField
          label="Freitext der Terminzeile"
          value={e.agendaOverride ?? ''}
          hint="Die Nummer steht automatisch davor (F-57)."
          disabled={c.a.disabled}
          onEscape={c.a.toGrid}
          onCommit={(v) => up({ agendaOverride: v.trim() === '' ? null : v })}
        />
      )}
      <p className="wap-panel-preview">
        <span className="wap-panel-muted">Vorschau Terminzeile: </span>
        {agendaLine(e, c.plan)
          .map((r) => r.text)
          .join('')}
      </p>
      <NoteField c={c} e={e} />
    </>
  );
}

function RapportFields({ c, e }: { c: Ctx; e: Rapport }) {
  const up = (changes: Parameters<typeof updateEntry<'rapport'>>[3]) =>
    c.a.run((p, ctx) => updateEntry(p, e.id, 'rapport', changes, ctx));
  const known = isKnownCode(c.plan, e.code);
  return (
    <>
      <SuggestField
        label="Kürzel"
        field="title"
        value={e.code}
        suggestions={c.plan.rapportCodes.map((r) => {
          const cat = c.plan.legend.find((k) => k.id === r.categoryId);
          return { value: r.code, label: r.code, ...(cat === undefined ? {} : { hint: cat.name }) };
        })}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(code) => {
          const listed = c.plan.rapportCodes.find((r) => r.code === code.trim());
          up({
            code,
            ...(listed !== undefined && listed.categoryId !== e.categoryId
              ? { categoryId: listed.categoryId }
              : {}),
          });
        }}
      />
      {!known && (
        <fieldset className="wap-panel-proposal" aria-label="Unbekanntes Kürzel">
          <span>«{e.code}» steht nicht in der Abkürzungsliste.</span>
          <button
            type="button"
            className="btn btn-sm"
            disabled={c.a.disabled}
            onClick={() => c.a.run((p, ctx) => addRapportCode(p, e.code, e.categoryId, ctx))}
          >
            «{e.code}» in Abkürzungsliste aufnehmen
          </button>
        </fieldset>
      )}
      <TagField c={c} date={e.date} onDate={(date) => up({ date })} />
      <TextField
        label="Zeit"
        shortcut="Z"
        field="time"
        value={formatTimeSpec(e.time, e.date)}
        hint="Zeitpunkt (0700) oder von–bis (0700-0730)"
        validate={(v) => {
          const r = parseSpec(v, e.date, 'Zeit', ['point', 'range']);
          return r.ok ? '' : r.message;
        }}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => {
          const r = parseSpec(v, e.date, 'Zeit', ['point', 'range']);
          if (r.ok && (r.value.form === 'point' || r.value.form === 'range')) up({ time: r.value });
        }}
      />
      <TextField
        label="Ort"
        shortcut="O"
        field="ort"
        value={e.ort}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(ort) => up({ ort })}
      />
      <SuggestField
        label="Tn"
        value={e.tn}
        suggestions={personSuggestions(c.plan, true)}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(tn) => up({ tn })}
      />
      <SelectField
        label="Kategorie"
        shortcut="K"
        field="category"
        value={e.categoryId}
        choices={categoryChoices(c.plan)}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(categoryId) => up({ categoryId })}
      />
      <Segment
        label="Anzeige"
        value={e.display}
        choices={[
          { value: 'rapColumn', label: 'nur Rap-Spalte' },
          { value: 'alsoInColumns', label: 'auch in Spalten' },
          { value: 'onlyInColumns', label: 'nur in Spalten' },
        ]}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) =>
          up({
            display: v as Rapport['display'],
            ...(v !== 'rapColumn' &&
            e.displayColumns.kind === 'ids' &&
            e.displayColumns.ids.length === 0
              ? { displayColumns: { kind: 'all' } as const }
              : {}),
          })
        }
      />
      {e.display !== 'rapColumn' && (
        <ColumnsField
          c={c}
          label="Anzeige in Spalten"
          date={e.date}
          value={e.displayColumns}
          onCommit={(displayColumns) => up({ displayColumns })}
        />
      )}
      <StatusField c={c} e={e} />
      <NoteField c={c} e={e} />
    </>
  );
}

function MarkerFields({ c, e }: { c: Ctx; e: Marker }) {
  const up = (changes: Parameters<typeof updateEntry<'marker'>>[3]) =>
    c.a.run((p, ctx) => updateEntry(p, e.id, 'marker', changes, ctx));
  return (
    <>
      <Segment
        label="Art"
        field="title"
        value={e.kind}
        choices={[
          { value: 'AV', label: 'AV' },
          { value: 'ABV', label: 'ABV' },
          { value: 'HV', label: 'HV' },
          { value: 'custom', label: 'frei' },
        ]}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) =>
          up({
            kind: v as Marker['kind'],
            ...(v === 'custom' && e.customKind.trim() === '' ? { customKind: 'Marker' } : {}),
          })
        }
      />
      {e.kind === 'custom' && (
        <TextField
          label="Freie Art"
          value={e.customKind}
          validate={(v) => (v.trim() === '' ? 'Die freie Art braucht eine Bezeichnung.' : '')}
          disabled={c.a.disabled}
          onEscape={c.a.toGrid}
          onCommit={(customKind) => up({ customKind })}
        />
      )}
      <div className="wap-panel-field">
        <span className="wap-panel-label">
          <span>Beschriftung</span>
        </span>
        <output className="wap-panel-output" aria-label="Beschriftung des Markers">
          {markerLabel(e, c.plan)}
        </output>
        <p className="wap-panel-hint">
          Aus der Art gebildet, nicht frei änderbar; mit oder ohne Zeit gemäss Plan-Einstellungen.
        </p>
      </div>
      <TagField c={c} date={e.date} onDate={(date) => up({ date })} />
      <TextField
        label="Zeitpunkt"
        shortcut="Z"
        field="time"
        value={formatTimeSpec({ form: 'point', at: e.at }, e.date)}
        validate={(v) => {
          const r = parseSpec(v, e.date, 'Zeitpunkt', ['point']);
          return r.ok ? '' : r.message;
        }}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => {
          const r = parseSpec(v, e.date, 'Zeitpunkt', ['point']);
          if (r.ok && r.value.form === 'point') up({ at: r.value.at });
        }}
      />
      {/* Marker gelten immer über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026): keine Spaltenwahl. */}
      <p className="wap-panel-hint">
        Spalten: alle Planungsspalten (Marker gelten immer über den ganzen Tag).
      </p>
      <CheckField
        label="Als flacher Block"
        checked={e.asFlatBlock}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(asFlatBlock) => up({ asFlatBlock })}
      />
      <StatusField c={c} e={e} />
      <NoteField c={c} e={e} />
    </>
  );
}

function DateField({
  c,
  label,
  value,
  onCommit,
  field,
}: {
  c: Ctx;
  label: string;
  value: IsoDate;
  onCommit: (d: IsoDate) => void;
  field?: string;
}) {
  return (
    <TextField
      label={label}
      {...(field === undefined ? {} : { field })}
      value={formatDate(value, 'long')}
      placeholder="dd.mm.yyyy"
      validate={(v) => {
        const r = parseDateInput(v, label);
        return r.ok ? '' : r.message;
      }}
      disabled={c.a.disabled}
      onEscape={c.a.toGrid}
      onCommit={(v) => {
        const r = parseDateInput(v, label);
        if (r.ok) onCommit(r.value);
      }}
    />
  );
}

function QuerbalkenFields({ c, e }: { c: Ctx; e: Querbalken }) {
  const up = (changes: Parameters<typeof updateEntry<'querbalken'>>[3]) =>
    c.a.run((p, ctx) => updateEntry(p, e.id, 'querbalken', changes, ctx));
  return (
    <>
      <RichTitleField
        label="Titel"
        field="title"
        value={e.title}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(title) => up({ title })}
      />
      <div className="wap-panel-row">
        <DateField
          c={c}
          label="Datum von"
          field="date"
          value={e.fromDate}
          onCommit={(fromDate) =>
            up({ fromDate, ...(daysBetween(fromDate, e.toDate) < 0 ? { toDate: fromDate } : {}) })
          }
        />
        <DateField
          c={c}
          label="Datum bis"
          value={e.toDate}
          onCommit={(toDate) =>
            up({ toDate, ...(daysBetween(e.fromDate, toDate) < 0 ? { fromDate: toDate } : {}) })
          }
        />
      </div>
      <p className="wap-panel-hint">
        Auch über Wochengrenzen; erscheint auf jeder betroffenen Seite.
      </p>
      <ColumnsField
        c={c}
        label="Spalten"
        date={e.fromDate}
        value={e.columns}
        onCommit={(columns) => up({ columns })}
      />
      <SelectField
        label="Kategorie"
        shortcut="K"
        field="category"
        value={e.categoryId ?? ''}
        choices={categoryChoices(c.plan, 'keine (weiss)')}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => up({ categoryId: v === '' ? null : v })}
      />
      <StatusField c={c} e={e} />
      <NoteField c={c} e={e} />
    </>
  );
}

function DayRemarkFields({ c, e }: { c: Ctx; e: DayRemark }) {
  const up = (changes: Parameters<typeof updateEntry<'dayRemark'>>[3]) =>
    c.a.run((p, ctx) => updateEntry(p, e.id, 'dayRemark', changes, ctx));
  return (
    <>
      <TextField
        label="Text"
        field="title"
        value={e.text}
        validate={(v) => (v.trim() === '' ? 'Die Bemerkung braucht einen Text.' : '')}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(text) => up({ text })}
      />
      <TagField c={c} date={e.date} onDate={(date) => up({ date })} />
      <StatusField c={c} e={e} />
      <NoteField c={c} e={e} />
    </>
  );
}

function MultiDayRemarkFields({ c, e }: { c: Ctx; e: MultiDayRemark }) {
  const up = (changes: Parameters<typeof updateEntry<'multiDayRemark'>>[3]) =>
    c.a.run((p, ctx) => updateEntry(p, e.id, 'multiDayRemark', changes, ctx));
  const week = c.plan.weeks.find((w) => w.id === c.weekId);
  const scopeKind = e.scope.kind;
  return (
    <>
      <TextField
        label="Text"
        field="title"
        multiline
        value={e.text}
        validate={(v) => (v.trim() === '' ? 'Die Bemerkung braucht einen Text.' : '')}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(text) => up({ text })}
      />
      <Segment
        label="Zeitraum"
        value={scopeKind}
        choices={[
          { value: 'plan', label: 'ganzer Plan' },
          { value: 'week', label: 'diese Woche' },
          { value: 'range', label: 'von–bis' },
        ]}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => {
          if (week === undefined) return;
          up({
            scope:
              v === 'plan'
                ? { kind: 'plan' }
                : v === 'week'
                  ? { kind: 'week', weekId: week.id }
                  : { kind: 'range', fromDate: week.startDate, toDate: addDays(week.startDate, 6) },
          });
        }}
      />
      {e.scope.kind === 'range' && (
        <div className="wap-panel-row">
          <DateField
            c={c}
            label="Datum von"
            value={e.scope.fromDate}
            onCommit={(fromDate) =>
              e.scope.kind === 'range' &&
              up({ scope: { kind: 'range', fromDate, toDate: e.scope.toDate } })
            }
          />
          <DateField
            c={c}
            label="Datum bis"
            value={e.scope.toDate}
            onCommit={(toDate) =>
              e.scope.kind === 'range' &&
              up({ scope: { kind: 'range', fromDate: e.scope.fromDate, toDate } })
            }
          />
        </div>
      )}
      <TextField
        label="Nummer"
        inputMode="numeric"
        value={e.number === null ? '' : String(e.number)}
        validate={(v) =>
          v.trim() === '' || /^\d{1,3}$/.test(v.trim())
            ? ''
            : 'Eine Nummer wie 3 eingeben oder leer lassen.'
        }
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => up({ number: v.trim() === '' ? null : Number(v.trim()) })}
      />
      <SelectField
        label="Verweis-Kästchen in Spalte"
        value={e.refBoxColumnId ?? ''}
        hint="Graues Kästchen mit der Nummer an jedem betroffenen Tag; gezeichnet ab der Bat-Darstellung (Etappe 3)."
        choices={[
          { value: '', label: 'keines' },
          ...(week === undefined ? [] : columnsAt(c.plan, week.startDate))
            .filter((col) => col.kind === 'planning' || col.kind === 'secondary')
            .map((col) => ({ value: col.id, label: col.name })),
        ]}
        disabled={c.a.disabled}
        onEscape={c.a.toGrid}
        onCommit={(v) => up({ refBoxColumnId: v === '' ? null : v })}
      />
      <StatusField c={c} e={e} />
      <NoteField c={c} e={e} />
    </>
  );
}

export const TYPE_NAMES: Readonly<Record<Entry['type'], string>> = {
  block: 'Block',
  querbalken: 'Querbalken',
  marker: 'Marker',
  rapport: 'Rapport',
  beso: 'Beso',
  dayRemark: 'Ganztägige Bemerkung',
  multiDayRemark: 'Bemerkung',
};

/** Felder eines Eintrags je Typ. */
export function EntryFields({
  plan,
  weekId,
  entry,
  actions,
}: {
  plan: Plan;
  weekId: Id;
  entry: Entry;
  actions: PanelActions;
}) {
  const c: Ctx = { plan, weekId, a: actions };
  switch (entry.type) {
    case 'block':
      return <BlockFields c={c} e={entry} />;
    case 'beso':
      return <BesoFields c={c} e={entry} />;
    case 'rapport':
      return <RapportFields c={c} e={entry} />;
    case 'marker':
      return <MarkerFields c={c} e={entry} />;
    case 'querbalken':
      return <QuerbalkenFields c={c} e={entry} />;
    case 'dayRemark':
      return <DayRemarkFields c={c} e={entry} />;
    case 'multiDayRemark':
      return <MultiDayRemarkFields c={c} e={entry} />;
  }
}
