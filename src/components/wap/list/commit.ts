// Zelländerung in der Listenansicht als Befehl (Vertrag E1-15 §2 «commitCell»; R-6-15, R-4-01). Jede Änderung
// ist genau ein Befehl der Fachlogik (E1-03) und damit ein Undo-Schritt; das Raster folgt ohne weitere Aktion.

import { setWindowTime } from '../../../model/wap/commands/beso';
import type { CommandContext, CommandResult } from '../../../model/wap/commands/command';
import { updateEntry } from '../../../model/wap/commands/entries';
import { dayColumns } from '../../../model/wap/derive/columns';
import { type UserMessage, WapError } from '../../../model/wap/errors';
import { type ListRow, type ListStatus, statusFromList } from '../../../model/wap/list/index';
import { parseTimeSpec } from '../../../model/wap/time';
import type {
  Column,
  ColumnSelection,
  Entry,
  MarkerKind,
  Plan,
  RapportDisplay,
  RichText,
} from '../../../model/wap/types';

export type ListColumnKey =
  | 'tag'
  | 'zeit'
  | 'typ'
  | 'titel'
  | 'spalten'
  | 'ltg'
  | 'ort'
  | 'nr'
  | 'kategorie'
  | 'status'
  | 'teilaufgaben';

export type CellCommand = (plan: Plan, ctx: CommandContext) => CommandResult;

export class ListEditError extends WapError {}

const fail = (cause: string, nextStep: string): never => {
  throw new ListEditError('listEdit', { cause, nextStep });
};

/**
 * Titel als Text; der Fettdruck des ersten Laufs bleibt erhalten (Beschrieb 5.1 «ein Teil fett»). Ohne früheren
 * Titel: Block und Querbalken fett, Beso normal (Terminzeile wie die Referenz; UX-AB-04).
 */
function titleRuns(previous: RichText, text: string, boldWhenNew: boolean): RichText {
  const bold = previous[0]?.bold ?? boldWhenNew;
  return text.trim() === '' ? [] : [{ text: text.trim(), bold }];
}

/** Ist die Zelle in dieser Zeile bearbeitbar? */
export function isEditable(row: ListRow, key: ListColumnKey, plan: Plan): boolean {
  const e = plan.entries[row.entryId];
  if (e === undefined) return false;
  switch (key) {
    case 'titel':
      return true;
    case 'zeit':
      return e.type === 'block' || e.type === 'rapport' || e.type === 'marker' || e.type === 'beso';
    case 'ltg':
      return e.type === 'block' || e.type === 'beso';
    case 'ort':
      return e.type === 'block' || e.type === 'beso' || e.type === 'rapport';
    case 'kategorie':
      return (
        e.type === 'block' || e.type === 'beso' || e.type === 'rapport' || e.type === 'querbalken'
      );
    case 'status':
      return true;
    case 'spalten':
      // Auswahlzelle (UI-Richtlinie 7; UX-AB-F-07): Blöcke und Rapporte; Marker gelten immer über alle Planungsspalten.
      return e.type === 'block' || e.type === 'rapport';
    default:
      return false;
  }
}

/** Wahl der Spalten-Zelle: `value` für commitCell, `label` wie in der Liste («, » zwischen den Spalten). */
export interface SpaltenChoice {
  readonly value: string;
  readonly label: string;
}

function planningOf(plan: Plan, row: ListRow): readonly Column[] {
  if (row.tag === '' || !plan.weeks.some((w) => w.id === row.weekId)) return [];
  return dayColumns(plan, row.weekId, row.tag).filter((c) => c.kind === 'planning');
}

function nameOf(c: Column): string {
  return c.name.replace(/\s+/g, ' ').trim();
}

/** «alle» und jede zusammenhängende Spanne der Planungsspalten des Tages (von links nach rechts). */
function spans(planning: readonly Column[]): readonly { sel: string; label: string }[] {
  const out: { sel: string; label: string }[] = [{ sel: 'all', label: 'alle' }];
  for (let i = 0; i < planning.length; i++)
    for (let j = i; j < planning.length; j++) {
      const part = planning.slice(i, j + 1);
      if (part.length === planning.length) continue;
      out.push({
        sel: `ids:${part.map((c) => c.id).join(',')}`,
        label: part.map(nameOf).join(', '),
      });
    }
  return out;
}

function selValue(sel: ColumnSelection): string {
  return sel.kind === 'all' ? 'all' : `ids:${sel.ids.join(',')}`;
}

function selOf(value: string): ColumnSelection | null {
  if (value === 'all') return { kind: 'all' };
  if (!value.startsWith('ids:')) return null;
  const ids = value
    .slice(4)
    .split(',')
    .filter((x) => x !== '');
  return ids.length === 0 ? null : { kind: 'ids', ids };
}

/** Aktueller Wert der Spalten-Zelle (für die Auswahl). */
export function spaltenValue(plan: Plan, row: ListRow): string {
  const e = plan.entries[row.entryId];
  if (e?.type === 'block') return selValue(e.columns);
  if (e?.type === 'rapport')
    return e.display === 'rapColumn'
      ? 'rap'
      : `${e.display === 'alsoInColumns' ? 'rap+' : 'only:'}${selValue(e.displayColumns)}`;
  return '';
}

/**
 * Auswahl der Spalten-Zelle (UX-AB-F-07): Block «alle» und zusammenhängende Spannen der Planungsspalten des Tages;
 * Rapport «Rap», «Rap, ‹Spannen›» (auch in Spalten) und «‹Spannen›» (nur in Spalten). Ein abweichender aktueller Wert
 * (z.B. getrennte Teilblöcke, Nebenspalte) bleibt als eigene Wahl erhalten.
 */
export function spaltenChoices(plan: Plan, row: ListRow): readonly SpaltenChoice[] {
  const e = plan.entries[row.entryId];
  const options = spans(planningOf(plan, row));
  let out: SpaltenChoice[] = [];
  if (e?.type === 'block') out = options.map((o) => ({ value: o.sel, label: o.label }));
  else if (e?.type === 'rapport')
    out = [
      { value: 'rap', label: 'Rap' },
      ...options.map((o) => ({ value: `rap+${o.sel}`, label: `Rap, ${o.label}` })),
      ...options.map((o) => ({ value: `only:${o.sel}`, label: o.label })),
    ];
  const current = spaltenValue(plan, row);
  if (current !== '' && !out.some((c) => c.value === current))
    out = [{ value: current, label: row.spalten.replaceAll('|', ', ') }, ...out];
  return out;
}

function rapportSpalten(value: string): {
  readonly display: RapportDisplay;
  readonly displayColumns: ColumnSelection;
} | null {
  if (value === 'rap') return { display: 'rapColumn', displayColumns: { kind: 'ids', ids: [] } };
  const also = value.startsWith('rap+');
  const only = value.startsWith('only:');
  if (!also && !only) return null;
  const sel = selOf(value.slice(also ? 4 : 5));
  return sel === null
    ? null
    : { display: also ? 'alsoInColumns' : 'onlyInColumns', displayColumns: sel };
}

/** Spalten des Tages, die eine Zelle nennen darf (Planungs- und Nebenspalten). */
function namedOf(plan: Plan, row: ListRow): readonly Column[] {
  if (row.tag === '' || !plan.weeks.some((w) => w.id === row.weekId)) return [];
  return dayColumns(plan, row.weekId, row.tag).filter(
    (c) => c.kind === 'planning' || c.kind === 'secondary',
  );
}

const norm = (t: string): string => t.replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Spalten als Text (UX-AB-G-01): «alle», «Rap» und Spaltennamen des Tages, getrennt mit «,» (auch «|» oder «+»), z.B.
 * «Rap, Kp Kdt». Mehrere Spalten sind möglich; ein unbekannter Name wird mit Ursache und nächstem Schritt abgelehnt,
 * nie still durch eine andere Spalte ersetzt.
 */
function spaltenAusText(
  plan: Plan,
  row: ListRow,
  e: Extract<Entry, { type: 'block' | 'rapport' }>,
  value: string,
): { readonly rap: boolean; readonly sel: ColumnSelection | null } {
  const columns = namedOf(plan, row);
  const tokens = value
    .split(/[,|+]/)
    .map((t) => t.trim())
    .filter((t) => t !== '');
  let rap = false;
  let all = false;
  const ids = new Set<string>();
  for (const t of tokens) {
    const n = norm(t);
    if (n === 'alle') {
      all = true;
      continue;
    }
    if (n === 'rap') {
      if (e.type === 'block')
        fail(
          'Ein Block liegt nicht in der Rap-Spalte.',
          'Planungsspalten des Tages eingeben, z.B. «alle» oder Spaltennamen mit Komma.',
        );
      rap = true;
      continue;
    }
    const c = columns.find((x) => norm(x.name) === n);
    if (c === undefined)
      fail(
        `Die Spalte «${t}» gibt es an diesem Tag nicht.`,
        'Spaltennamen des Tages mit Komma eingeben, z.B. «Rap, …» (Vorschläge mit Alt+↓), oder die Spalten im Seitenfeld wählen.',
      );
    else ids.add(c.id);
  }
  if (all) {
    const extra = columns.filter((c) => c.kind !== 'planning' && ids.has(c.id));
    return {
      rap,
      sel:
        extra.length === 0
          ? { kind: 'all' }
          : {
              kind: 'ids',
              ids: columns.filter((c) => c.kind === 'planning' || ids.has(c.id)).map((c) => c.id),
            },
    };
  }
  const ordered = columns.filter((c) => ids.has(c.id)).map((c) => c.id);
  return { rap, sel: ordered.length === 0 ? null : { kind: 'ids', ids: ordered } };
}

function timeOf(value: string, e: Entry): ReturnType<typeof parseTimeSpec> {
  const date = 'date' in e ? e.date : '';
  try {
    return parseTimeSpec(value, date);
  } catch (error) {
    const m: UserMessage =
      error instanceof WapError
        ? error.userMessage
        : { cause: 'Die Zeit ist ungültig.', nextStep: 'Zeit wie «0800-1200» eingeben.' };
    return fail(m.cause, 'Zeit wie «0800-1200», «0800», «ab 1900» oder «bis 1200» eingeben.');
  }
}

const MARKER_KINDS: readonly MarkerKind[] = ['AV', 'ABV', 'HV'];

/**
 * Befehl für eine Zelländerung; ListEditError mit Ursache und nächstem Schritt, wenn der Wert ungültig ist.
 * `value` ist bei «Kategorie» die ID der Leitungskategorie, bei «Status» der Listenwert.
 */
export function commitCell(
  plan: Plan,
  row: ListRow,
  key: ListColumnKey,
  value: string,
): CellCommand {
  const e = plan.entries[row.entryId];
  if (e === undefined)
    return fail('Der Eintrag ist nicht mehr vorhanden.', 'Die Liste neu sortieren oder filtern.');
  const id = e.id;
  switch (key) {
    case 'titel':
      switch (e.type) {
        case 'block':
          return (p, ctx) =>
            updateEntry(p, id, 'block', { title: titleRuns(e.title, value, true) }, ctx);
        case 'beso':
          return (p, ctx) =>
            updateEntry(p, id, 'beso', { title: titleRuns(e.title, value, false) }, ctx);
        case 'querbalken':
          return (p, ctx) =>
            updateEntry(p, id, 'querbalken', { title: titleRuns(e.title, value, true) }, ctx);
        case 'rapport':
          if (value.trim() === '')
            return fail('Das Kürzel des Rapports fehlt.', 'Ein Kürzel wie «KR» eingeben.');
          return (p, ctx) => updateEntry(p, id, 'rapport', { code: value }, ctx);
        case 'marker': {
          const kind = MARKER_KINDS.find((k) => k === value.trim().toUpperCase());
          return kind === undefined
            ? (p, ctx) =>
                updateEntry(p, id, 'marker', { kind: 'custom', customKind: value.trim() }, ctx)
            : (p, ctx) => updateEntry(p, id, 'marker', { kind, customKind: '' }, ctx);
        }
        case 'dayRemark':
          return (p, ctx) => updateEntry(p, id, 'dayRemark', { text: value }, ctx);
        case 'multiDayRemark':
          return (p, ctx) => updateEntry(p, id, 'multiDayRemark', { text: value }, ctx);
      }
      break;
    case 'ltg':
      if (e.type === 'block')
        return (p, ctx) => updateEntry(p, id, 'block', { ltg: value.trim() }, ctx);
      if (e.type === 'beso')
        return (p, ctx) => updateEntry(p, id, 'beso', { ltg: value.trim() }, ctx);
      break;
    case 'ort':
      if (e.type === 'block')
        return (p, ctx) => updateEntry(p, id, 'block', { ort: value.trim() }, ctx);
      if (e.type === 'beso')
        return (p, ctx) => updateEntry(p, id, 'beso', { ort: value.trim() }, ctx);
      if (e.type === 'rapport')
        return (p, ctx) => updateEntry(p, id, 'rapport', { ort: value.trim() }, ctx);
      break;
    case 'zeit': {
      const { time, deadlineDate } = timeOf(value, e);
      switch (e.type) {
        case 'block':
          if (time.form === 'deadline')
            return fail('Ein Block kann keine Frist haben.', 'Zeit wie «0800-1200» eingeben.');
          return (p, ctx) => updateEntry(p, id, 'block', { time }, ctx);
        case 'rapport':
          if (time.form !== 'point' && time.form !== 'range')
            return fail(
              'Ein Rapport hat einen Zeitpunkt oder eine Zeit von–bis.',
              'Zeit wie «0700» oder «0700-0730» eingeben.',
            );
          return (p, ctx) => updateEntry(p, id, 'rapport', { time }, ctx);
        case 'marker':
          if (time.form !== 'point')
            return fail('Ein Marker hat einen Zeitpunkt.', 'Zeit wie «2330» eingeben.');
          return (p, ctx) => updateEntry(p, id, 'marker', { at: time.at }, ctx);
        case 'beso': {
          const windowId = row.windowId ?? e.windows[0]?.id;
          if (windowId === undefined)
            return fail('Der Beso hat kein Zeitfenster.', 'Den Beso im Raster bearbeiten.');
          // Frist mit Datum: der Beso rückt auf den Frist-Tag bzw. Meldung (FA2-03).
          return (p, ctx) => setWindowTime(p, id, windowId, time, deadlineDate, ctx);
        }
        default:
          break;
      }
      break;
    }
    case 'kategorie': {
      // Beso: «keine» Leitungskategorie (leer; Beschrieb 4.6 Feldtabelle Beso optional; UX-AB-15).
      if (value === '' && e.type === 'beso')
        return (p, ctx) => updateEntry(p, id, 'beso', { categoryId: null }, ctx);
      if (!plan.legend.some((c) => c.id === value))
        return fail(
          'Die Kategorie ist in der Legende nicht vorhanden.',
          'Eine Kategorie aus der Liste wählen.',
        );
      if (e.type === 'block')
        return (p, ctx) => updateEntry(p, id, 'block', { categoryId: value }, ctx);
      if (e.type === 'beso')
        return (p, ctx) => updateEntry(p, id, 'beso', { categoryId: value }, ctx);
      if (e.type === 'rapport')
        return (p, ctx) => updateEntry(p, id, 'rapport', { categoryId: value }, ctx);
      if (e.type === 'querbalken')
        return (p, ctx) => updateEntry(p, id, 'querbalken', { categoryId: value }, ctx);
      break;
    }
    case 'spalten': {
      // Wert einer Wahl (Kennung) oder Text wie in der Liste («Rap, Kp Kdt»; UX-AB-G-01).
      if (e.type === 'block') {
        const known = selOf(value);
        const columns = known ?? spaltenAusText(plan, row, e, value).sel;
        if (columns === null)
          return fail(
            'Ein Block braucht mindestens eine Spalte.',
            'Spaltennamen des Tages eingeben, z.B. «alle».',
          );
        return (p, ctx) => updateEntry(p, id, 'block', { columns }, ctx);
      }
      if (e.type === 'rapport') {
        const known = rapportSpalten(value);
        if (known !== null) return (p, ctx) => updateEntry(p, id, 'rapport', known, ctx);
        const { rap, sel } = spaltenAusText(plan, row, e, value);
        if (sel === null && !rap)
          return fail(
            'Der Rapport braucht eine Spalte.',
            '«Rap» oder Spaltennamen des Tages eingeben, z.B. «Rap, …».',
          );
        const next: { display: RapportDisplay; displayColumns: ColumnSelection } =
          sel === null
            ? { display: 'rapColumn', displayColumns: { kind: 'ids', ids: [] } }
            : { display: rap ? 'alsoInColumns' : 'onlyInColumns', displayColumns: sel };
        return (p, ctx) => updateEntry(p, id, 'rapport', next, ctx);
      }
      break;
    }
    case 'status': {
      // «geändert» ist eine Markierung (aus dem Import bzw. bis zum nächsten Stand; Beschrieb 4.6, R-4.6-33/-67), kein
      // wählbarer Status: die Liste setzt nur bestätigt, offen oder gestrichen und lässt die Markierung, wie sie ist
      // (UX-AB-05).
      const values: readonly ListStatus[] = ['bestätigt', 'offen', 'gestrichen'];
      const v = values.find((x) => x === value);
      if (v === undefined)
        return fail(
          value === 'geändert'
            ? '«geändert» ist eine Markierung, kein Status; sie gilt bis zum nächsten Stand.'
            : 'Der Status ist unbekannt.',
          'Bestätigt, offen oder gestrichen wählen.',
        );
      const { status } = statusFromList(v);
      return (p, ctx) => updateEntry(p, id, e.type, { status }, ctx);
    }
    default:
      break;
  }
  return fail(
    'Diese Zelle lässt sich in der Liste nicht ändern.',
    'Den Eintrag im Raster bearbeiten.',
  );
}
