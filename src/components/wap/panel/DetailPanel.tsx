// Seitenfeld (I3 C1/C3; Beschrieb 5.1 «Ein Seitenfeld zeigt alle Angaben des gewählten Eintrags»; UI-Richtlinie 6;
// R-5.1-12). Zeigt immer die aktuelle Auswahl: nichts → Woche; Tag(e) → Tag; ein Eintrag → alle Felder seines Typs;
// mehrere → gemeinsame Felder. Esc in einem Feld gibt den Fokus ans Raster zurück.

import { useEffect, useRef } from 'react';
import { addDays, daysBetween, formatDate, isoWeek, weekdayOf } from '../../../model/wap/calendar';
import { setDayColumnSet, setDayDisplay } from '../../../model/wap/commands/days';
import { createEntry, deleteEntries, updateEntry } from '../../../model/wap/commands/entries';
import {
  STATUS_NAMES,
  setDayNote,
  setRemarkHidden,
  setWeekGoals,
  updateCommonFields,
  updateWeekFields,
} from '../../../model/wap/commands/settings';
import { renameWeek, setWeekStart } from '../../../model/wap/commands/weeks';
import { abbreviationsForWeek } from '../../../model/wap/derive/abbreviations';
import { resolveTitle } from '../../../model/wap/derive/agenda';
import { formatMilTime } from '../../../model/wap/time';
import type { DayDisplay, Entry, Id, IsoDate, Plan, Week } from '../../../model/wap/types';
import { parseDateInput, parseTimeInput } from '../i2/timeInput';
import { EntryFields, NOTE_HINT, TYPE_NAMES } from './EntryFields';
import { type Choice, FieldOwnerContext, Section, Segment, SelectField, TextField } from './fields';
import type { PanelActions, PanelTarget } from './types';
import './panel.css';

export interface DetailPanelProps {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly target: PanelTarget;
  readonly actions: PanelActions;
  readonly error: string;
  readonly onClose: () => void;
  /** Fokusauftrag: Feld (data-panel-field) bzw. erstes Feld; `seq` wechselt bei jedem Auftrag. */
  readonly focus: { readonly seq: number; readonly field: string | null };
}

/** Alt+Buchstabe im Seitenfeld: Zeit, Tag, Spalten, Kategorie, Ltg, Ort (UI-Richtlinie 13.3; UX-H-13). */
const PANEL_FIELD_KEYS: Readonly<Record<string, string>> = {
  z: 'time',
  t: 'date',
  s: 'columns',
  k: 'category',
  l: 'ltg',
  o: 'ort',
};

/** Name des Eintrags für Meldungen des Seitenfelds (Titel, Kürzel bzw. Text). */
function ownerName(plan: Plan, e: Entry): string {
  switch (e.type) {
    case 'block':
    case 'beso':
    case 'querbalken':
      return resolveTitle(plan, e.title)
        .map((r) => r.text)
        .join('')
        .trim();
    case 'rapport':
      return e.code;
    case 'dayRemark':
    case 'multiDayRemark':
      return e.text;
    default:
      return TYPE_NAMES[e.type];
  }
}

function entrySummary(plan: Plan, e: Entry): string {
  const date = 'date' in e ? `${weekdayOf(e.date)} ${formatDate(e.date, 'long')}` : '';
  switch (e.type) {
    case 'querbalken':
      return `${formatDate(e.fromDate, 'long')}–${formatDate(e.toDate, 'long')}`;
    case 'multiDayRemark':
      return e.scope.kind === 'plan'
        ? 'gilt für den ganzen Plan'
        : e.scope.kind === 'week'
          ? `gilt für ${plan.weeks.find((w) => w.id === (e.scope.kind === 'week' ? e.scope.weekId : ''))?.label ?? 'eine Woche'}`
          : `${formatDate(e.scope.fromDate, 'long')}–${formatDate(e.scope.toDate, 'long')}`;
    case 'marker':
      return `${date} · ${formatMilTime(e.at)}`;
    default:
      return date;
  }
}

const DISPLAY_CHOICES: readonly Choice[] = [
  { value: 'full', label: 'voll' },
  { value: 'compact', label: 'kompakt' },
  { value: 'hidden', label: 'ausgeblendet' },
];

function DayFields({
  plan,
  week,
  dates,
  a,
}: {
  plan: Plan;
  week: Week;
  dates: readonly IsoDate[];
  a: PanelActions;
}) {
  const indices = dates
    .map((d) => daysBetween(week.startDate, d))
    .filter((i) => i >= 0 && i < 7)
    .sort((x, y) => x - y);
  const days = indices.map((i) => week.days[i]).filter((d) => d !== undefined);
  const weekdays = days.map((d) => d.weekday);
  const sets = new Set(days.map((d) => d.columnSetId ?? ''));
  const displays = new Set(days.map((d) => d.display));
  const set = sets.size === 1 ? ([...sets][0] ?? '') : 'mixed';
  const display = displays.size === 1 ? ([...displays][0] ?? 'full') : 'mixed';
  const only = days.length === 1 ? days[0] : undefined;
  const onlyDate = indices.length === 1 ? addDays(week.startDate, indices[0] ?? 0) : null;
  return (
    <>
      <SelectField
        label="Spaltensatz"
        shortcut="S"
        field="columnSet"
        value={set}
        hint={
          days.length > 1
            ? `Gilt für ${weekdays.join(', ')} (ein Undo-Schritt). Wegfallende Spalten markieren Einträge (P1), nichts wird gelöscht.`
            : 'Wegfallende Spalten markieren Einträge (P1), nichts wird gelöscht.'
        }
        disabled={a.disabled}
        onEscape={a.toGrid}
        choices={[
          ...(set === 'mixed' ? [{ value: 'mixed', label: 'verschieden' }] : []),
          ...(set === '' ? [{ value: '', label: 'kein Spaltensatz' }] : []),
          ...plan.columnSets.map((s) => ({ value: s.id, label: s.name })),
        ]}
        onCommit={(v) => {
          if (v !== 'mixed' && v !== '')
            a.run((p, ctx) => setDayColumnSet(p, week.id, weekdays, v, ctx));
        }}
      />
      <Segment
        label={display === 'mixed' ? 'Darstellung (verschieden)' : 'Darstellung'}
        shortcut="D"
        field="display"
        value={display}
        choices={DISPLAY_CHOICES}
        disabled={a.disabled}
        onEscape={a.toGrid}
        onCommit={(v) =>
          a.run((p, ctx) => setDayDisplay(p, week.id, weekdays, v as DayDisplay, ctx))
        }
      />
      {only !== undefined && (
        <TextField
          label="Interne Notiz des Tages"
          multiline
          value={only.internalNote}
          hint={NOTE_HINT}
          disabled={a.disabled}
          onEscape={a.toGrid}
          onCommit={(note) => a.run((p, ctx) => setDayNote(p, week.id, only.weekday, note, ctx))}
        />
      )}
      {onlyDate !== null && (
        <div className="wap-panel-row">
          <button
            type="button"
            className="btn btn-sm"
            disabled={a.disabled}
            onClick={() => a.renumber(onlyDate)}
          >
            Tag neu nummerieren …
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={a.disabled}
            onClick={() =>
              a.run((p, ctx) =>
                createEntry(p, { type: 'dayRemark', date: onlyDate, text: 'Bemerkung' }, ctx),
              )
            }
          >
            Ganztägige Bemerkung hinzufügen
          </button>
        </div>
      )}
      <p className="wap-panel-hint">
        Tagesbefehl-Angaben (Tagesoffizier, TB-Nr) folgen mit den Tagesbefehlen (Etappe 4).
      </p>
    </>
  );
}

function WeekFields({ plan, week, a }: { plan: Plan; week: Week; a: PanelActions }) {
  const remarks = Object.values(plan.entries).filter(
    (e): e is Extract<Entry, { type: 'multiDayRemark' }> => e.type === 'multiDayRemark',
  );
  const planRemarks = remarks.filter((r) => r.scope.kind === 'plan');
  const weekRemarks = remarks.filter((r) => r.scope.kind === 'week' && r.scope.weekId === week.id);
  const hidden = new Set(week.hiddenRemarkIds);
  const abbreviations = abbreviationsForWeek(plan, week.id);
  const end = addDays(week.startDate, 6);
  const sun = week.sunOverride;
  const sunCommit = (key: 'sunrise' | 'sunset', v: string) => {
    const value =
      v.trim() === ''
        ? null
        : parseTimeInput(v, key === 'sunrise' ? 'Sonnenaufgang' : 'Sonnenuntergang');
    if (value !== null && !value.ok) return;
    a.run((p, ctx) =>
      updateWeekFields(
        p,
        week.id,
        { sunOverride: { ...sun, [key]: value === null ? null : value.value } },
        ctx,
      ),
    );
  };
  return (
    <>
      <TextField
        label="Bezeichnung"
        field="title"
        value={week.label}
        disabled={a.disabled}
        onEscape={a.toGrid}
        validate={(v) =>
          v.trim() === '' ? 'Eine Bezeichnung eingeben, zum Beispiel «FDT Woche 1».' : ''
        }
        onCommit={(label) =>
          a.run((p, ctx) => renameWeek(p, week.id, { label, shortName: week.shortName }, ctx))
        }
      />
      <TextField
        label="Kurzname (für Dateinamen)"
        value={week.shortName}
        disabled={a.disabled}
        onEscape={a.toGrid}
        validate={(v) => (v.trim() === '' ? 'Einen Kurznamen eingeben, zum Beispiel «Wo1».' : '')}
        onCommit={(shortName) =>
          a.run((p, ctx) => renameWeek(p, week.id, { label: week.label, shortName }, ctx))
        }
      />
      <TextField
        label="Startdatum (Montag)"
        value={formatDate(week.startDate, 'long')}
        placeholder="dd.mm.yyyy"
        hint={`Bis ${formatDate(end, 'long')} · KW ${isoWeek(week.startDate)} · Daten und KW werden automatisch gebildet.`}
        disabled={a.disabled}
        onEscape={a.toGrid}
        validate={(v) => {
          const r = parseDateInput(v, 'Startdatum');
          return r.ok ? '' : r.message;
        }}
        onCommit={(v) => {
          const r = parseDateInput(v, 'Startdatum');
          if (r.ok) a.run((p, ctx) => setWeekStart(p, week.id, r.value, ctx));
        }}
      />
      <TextField
        label="Wochenziele (eine Zeile je Ziel)"
        multiline
        value={week.weekGoals.map((g) => g.text).join('\n')}
        hint="Ctrl+Enter übernimmt. Reihenfolge wie eingegeben."
        disabled={a.disabled}
        onEscape={a.toGrid}
        onCommit={(v) => a.run((p, ctx) => setWeekGoals(p, week.id, v.split('\n'), ctx))}
      />
      <TextField
        label="Erhöhte Bereitschaft"
        multiline
        value={week.heightenedReadiness}
        hint="Leer: Abschnitt entfällt im PDF."
        disabled={a.disabled}
        onEscape={a.toGrid}
        onCommit={(heightenedReadiness) =>
          a.run((p, ctx) => updateWeekFields(p, week.id, { heightenedReadiness }, ctx))
        }
      />
      <div className="wap-panel-row">
        <TextField
          label="Sonnenaufgang"
          inputMode="numeric"
          value={sun.sunrise === null ? '' : formatMilTime(sun.sunrise)}
          placeholder="0715"
          disabled={a.disabled}
          onEscape={a.toGrid}
          validate={(v) => {
            if (v.trim() === '') return '';
            const r = parseTimeInput(v, 'Sonnenaufgang');
            return r.ok ? '' : r.message;
          }}
          onCommit={(v) => sunCommit('sunrise', v)}
        />
        <TextField
          label="Sonnenuntergang"
          inputMode="numeric"
          value={sun.sunset === null ? '' : formatMilTime(sun.sunset)}
          placeholder="1930"
          disabled={a.disabled}
          onEscape={a.toGrid}
          validate={(v) => {
            if (v.trim() === '') return '';
            const r = parseTimeInput(v, 'Sonnenuntergang');
            return r.ok ? '' : r.message;
          }}
          onCommit={(v) => sunCommit('sunset', v)}
        />
      </div>
      <p className="wap-panel-hint">Sonnenzeiten in Etappe 1 von Hand; leer = keine Angabe.</p>
      <Section title="Bemerkungen «gelten durchgehend»">
        {planRemarks.length === 0 && <p className="wap-panel-muted">Keine Plan-Bemerkungen.</p>}
        <ul className="wap-panel-list">
          {planRemarks.map((r) => (
            <li key={r.id}>
              <label className="wap-panel-check">
                <input
                  type="checkbox"
                  checked={!hidden.has(r.id)}
                  disabled={a.disabled}
                  onChange={(event) =>
                    a.run((p, ctx) => setRemarkHidden(p, week.id, r.id, !event.target.checked, ctx))
                  }
                />
                <span>
                  In {week.label} zeigen: {r.text}
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-sm"
          disabled={a.disabled}
          onClick={() =>
            a.run((p, ctx) =>
              createEntry(
                p,
                {
                  type: 'multiDayRemark',
                  text: 'Bemerkung für den ganzen Plan',
                  scope: { kind: 'plan' },
                },
                ctx,
              ),
            )
          }
        >
          Plan-Bemerkung hinzufügen
        </button>
      </Section>
      <Section title={`Bemerkungen nur für ${week.label}`}>
        <ul className="wap-panel-list">
          {weekRemarks.map((r) => (
            <li key={r.id} className="wap-panel-row">
              <TextField
                label={`Bemerkung ${week.label}`}
                value={r.text}
                disabled={a.disabled}
                onEscape={a.toGrid}
                validate={(v) => (v.trim() === '' ? 'Die Bemerkung braucht einen Text.' : '')}
                onCommit={(text) =>
                  a.run((p, ctx) => updateEntry(p, r.id, 'multiDayRemark', { text }, ctx))
                }
              />
              <button
                type="button"
                className="btn btn-sm"
                aria-label={`Bemerkung «${r.text}» entfernen`}
                disabled={a.disabled}
                onClick={() => a.run((p, ctx) => deleteEntries(p, [r.id], ctx))}
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
        <button
          type="button"
          className="btn btn-sm"
          disabled={a.disabled}
          onClick={() =>
            a.run((p, ctx) =>
              createEntry(
                p,
                {
                  type: 'multiDayRemark',
                  text: `Bemerkung für ${week.label}`,
                  scope: { kind: 'week', weekId: week.id },
                },
                ctx,
              ),
            )
          }
        >
          Bemerkung für diese Woche ergänzen
        </button>
      </Section>
      {week.days.some((d) => d.display === 'hidden') && (
        <Section title="Ausgeblendete Tage">
          <p className="wap-panel-hint">
            Einträge an ausgeblendeten Tagen bleiben erhalten (Befund P16), erscheinen aber nicht im
            PDF.
          </p>
          <div className="wap-panel-row">
            {week.days.map((d, i) =>
              d.display === 'hidden' ? (
                <button
                  key={d.weekday}
                  type="button"
                  className="btn btn-sm"
                  disabled={a.disabled}
                  onClick={() =>
                    a.run((p, ctx) => setDayDisplay(p, week.id, [d.weekday], 'full', ctx))
                  }
                >
                  {d.weekday} {formatDate(addDays(week.startDate, i), 'long')} einblenden
                </button>
              ) : null,
            )}
          </div>
        </Section>
      )}
      <Section title="Kürzel dieser Woche">
        <p className="wap-panel-hint">
          In der Seitenleiste erscheinen nur verwendete Kürzel. Auswahl und Bedeutung in den
          Plan-Einstellungen («Kürzelliste»).
        </p>
        <p>{abbreviations.length === 0 ? 'keine' : abbreviations.join(', ')}</p>
      </Section>
    </>
  );
}

function CommonFields({ plan, ids, a }: { plan: Plan; ids: readonly Id[]; a: PanelActions }) {
  const entries = ids.map((id) => plan.entries[id]).filter((e): e is Entry => e !== undefined);
  const withCategory = entries.filter(
    (e) =>
      e.type === 'block' || e.type === 'rapport' || e.type === 'beso' || e.type === 'querbalken',
  );
  const categories = new Set(
    withCategory.map((e) => ('categoryId' in e ? (e.categoryId ?? '') : '')),
  );
  const statuses = new Set(entries.map((e) => e.status));
  const blocks = entries.filter((e): e is Extract<Entry, { type: 'block' }> => e.type === 'block');
  const directions = new Set(blocks.map((b) => b.textDirection));
  const status = statuses.size === 1 ? ([...statuses][0] ?? 'confirmed') : 'mixed';
  return (
    <>
      {withCategory.length > 0 && (
        <SelectField
          label="Kategorie"
          shortcut="K"
          field="category"
          value={categories.size === 1 ? ([...categories][0] ?? '') : 'mixed'}
          disabled={a.disabled}
          onEscape={a.toGrid}
          choices={[
            ...(categories.size === 1 ? [] : [{ value: 'mixed', label: 'verschieden' }]),
            ...plan.legend.map((c) => ({ value: c.id, label: c.name })),
          ]}
          onCommit={(v) => {
            if (v !== 'mixed')
              a.run((p, ctx) => updateCommonFields(p, ids, { categoryId: v }, ctx));
          }}
        />
      )}
      <Segment
        label={status === 'mixed' ? 'Status (verschieden)' : 'Status'}
        field="status"
        value={status}
        choices={[
          { value: 'confirmed', label: STATUS_NAMES.confirmed },
          { value: 'open', label: STATUS_NAMES.open },
          { value: 'cancelled', label: STATUS_NAMES.cancelled },
        ]}
        disabled={a.disabled}
        onEscape={a.toGrid}
        onCommit={(v) =>
          a.run((p, ctx) => updateCommonFields(p, ids, { status: v as Entry['status'] }, ctx))
        }
      />
      {blocks.length > 0 && (
        <Segment
          label={directions.size === 1 ? 'Textrichtung (Blöcke)' : 'Textrichtung (verschieden)'}
          value={directions.size === 1 ? ([...directions][0] ?? 'auto') : 'mixed'}
          choices={[
            { value: 'auto', label: 'automatisch' },
            { value: 'horizontal', label: 'waagrecht' },
            { value: 'vertical', label: 'senkrecht' },
          ]}
          disabled={a.disabled}
          onEscape={a.toGrid}
          onCommit={(v) =>
            a.run((p, ctx) =>
              updateCommonFields(
                p,
                blocks.map((b) => b.id),
                { textDirection: v as 'auto' | 'horizontal' | 'vertical' },
                ctx,
              ),
            )
          }
        />
      )}
      <button
        type="button"
        className="btn btn-sm"
        disabled={a.disabled}
        onClick={() => a.remove(ids)}
      >
        {entries.length} Einträge löschen
      </button>
    </>
  );
}

export function DetailPanel({
  plan,
  weekId,
  target,
  actions,
  error,
  onClose,
  focus,
}: DetailPanelProps) {
  const root = useRef<HTMLElement>(null);
  const week = plan.weeks.find((w) => w.id === weekId);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur bei neuem Fokusauftrag
  useEffect(() => {
    if (focus.seq === 0) return;
    const node = root.current;
    if (node === null) return;
    const wanted =
      focus.field === null
        ? null
        : node.querySelector<HTMLElement>(`[data-panel-field="${focus.field}"]`);
    const first =
      wanted ??
      node.querySelector<HTMLElement>(
        '.wap-panel-body input:not([disabled]), .wap-panel-body select:not([disabled]), .wap-panel-body textarea:not([disabled]), .wap-panel-body [role="radio"][tabindex="0"]',
      );
    first?.focus();
    if (first instanceof HTMLInputElement) first.select();
  }, [focus.seq]);

  let heading = 'Woche';
  let summary =
    week === undefined
      ? ''
      : `${week.label} · ${formatDate(week.startDate, 'long')}–${formatDate(addDays(week.startDate, 6), 'long')}`;
  let body = week === undefined ? null : <WeekFields plan={plan} week={week} a={actions} />;
  if (target.kind === 'days' && week !== undefined && target.dates.length > 0) {
    heading = target.dates.length === 1 ? 'Tag' : `${target.dates.length} Tage`;
    summary = target.dates.map((d) => `${weekdayOf(d)} ${formatDate(d, 'long')}`).join(', ');
    body = (
      <DayFields
        key={target.dates.join('|')}
        plan={plan}
        week={week}
        dates={target.dates}
        a={actions}
      />
    );
  } else if (target.kind === 'entries') {
    const entries = target.ids
      .map((id) => plan.entries[id])
      .filter((e): e is Entry => e !== undefined);
    const only = entries.length === 1 ? entries[0] : undefined;
    if (only !== undefined) {
      heading = TYPE_NAMES[only.type];
      summary = entrySummary(plan, only);
      // Eigene Feldzustände je Eintrag (UX-H-01): ein Entwurf geht nie auf einen anderen Eintrag über.
      body = (
        <FieldOwnerContext.Provider
          key={only.id}
          value={{ name: ownerName(plan, only), notice: actions.notice ?? (() => undefined) }}
        >
          <EntryFields plan={plan} weekId={weekId} entry={only} actions={actions} />
        </FieldOwnerContext.Provider>
      );
    } else if (entries.length > 1) {
      heading = `${entries.length} Einträge gewählt`;
      summary = 'Gemeinsame Felder';
      body = (
        <CommonFields
          key={entries.map((e) => e.id).join('|')}
          plan={plan}
          ids={entries.map((e) => e.id)}
          a={actions}
        />
      );
    }
  }
  return (
    // Feldsprünge im Seitenfeld mit Alt+Buchstabe (UX-H-13, Entscheid 14.10.2026): Buchstaben allein sind Text,
    // auch im frisch mit E geöffneten, ganz markierten Titel.
    <aside
      ref={root}
      className="wap-panel"
      aria-label="Seitenfeld"
      onKeyDown={(event) => {
        if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        const field = PANEL_FIELD_KEYS[event.key.toLowerCase()];
        if (field === undefined) return;
        const node = root.current?.querySelector<HTMLElement>(`[data-panel-field="${field}"]`);
        if (node === null || node === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        node.focus();
        if (node instanceof HTMLInputElement) node.select();
      }}
    >
      <header className="wap-panel-head">
        <div>
          <span className="wap-panel-type">{heading}</span>
          <p className="wap-panel-summary">{summary}</p>
        </div>
        <button
          type="button"
          className="btn btn-sm"
          aria-label="Seitenfeld schliessen"
          onClick={onClose}
        >
          ✕
        </button>
      </header>
      {error !== '' && (
        <p className="wap-panel-error wap-panel-message" role="alert">
          {error}
        </p>
      )}
      <div className="wap-panel-body">{body}</div>
    </aside>
  );
}
