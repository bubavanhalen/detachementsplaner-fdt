// Zeilen der Listenansicht und Export im Format der Soll-Listen (Vertrag E1-08 §2; Beschrieb 6
// «Listenansicht»; anhaenge/normalisierung.md Abschnitte 2–7; R-6-13, R-6-16, R-6-40).
// Rein: keine Uhr, kein DOM. Interne Notizen erscheinen nie in einer Zeile und nie im Export (R-6-40).

import { addDays, daysBetween, formatDate, weekdayOf } from '../calendar';
import { resolveTitle } from '../derive/agenda';
import { dayColumns, resolveColumns } from '../derive/columns';
import { remarksForWeek } from '../derive/remarks';
import { formatMilTime } from '../time';
import type {
  Column,
  ColumnSelection,
  Entry,
  EntryStatus,
  Id,
  IsoDate,
  Plan,
  RichText,
  TimeSpec,
  Week,
  Weekday,
} from '../types';

export type ListType =
  | 'Block'
  | 'Querbalken'
  | 'Marker'
  | 'Rapport'
  | 'Beso'
  | 'TagBemerkung'
  | 'MehrtagBemerkung';

export type ListStatus = 'bestätigt' | 'gestrichen' | 'geändert' | 'offen';

/** 13 Pflichtfelder gemäss normalisierung.md Abschnitt 2/3, plus Bemerkung (F-50) und entryId für die Oberfläche. */
export interface ListRow {
  readonly entryId: Id;
  /** Zeitfenster eines Beso (eine Zeile je Zeitfenster), sonst null. */
  readonly windowId: Id | null;
  readonly weekId: Id;
  readonly woche: string;
  readonly tag: Weekday | '';
  readonly typ: ListType;
  readonly titel: string;
  readonly zeitform: string;
  readonly von: string;
  readonly bis: string;
  readonly spalten: string;
  readonly kategorie: string;
  readonly ltg: string;
  readonly ort: string;
  readonly nr: string;
  readonly status: ListStatus;
  readonly bemerkung: string;
}

export type ListScope = { readonly weekId: Id } | 'plan';

/** Kopfzeile des Exports, exakt gemäss normalisierung.md Abschnitt 2. */
export const LIST_CSV_HEADER =
  'Woche;Tag;Typ;Titel;Zeitform;von;bis;Spalten;Kategorie;Ltg;Ort;Nr;Status;Bemerkung';

const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
const TYPE_ORDER: readonly ListType[] = [
  'Querbalken',
  'Marker',
  'Block',
  'Rapport',
  'Beso',
  'TagBemerkung',
  'MehrtagBemerkung',
];

/** Zeilen- und Absatzumbrüche, Tabulatoren → ein Leerzeichen; am Rand getrimmt (Abschnitt 4 Punkt 3, 4). */
function oneLine(text: string): string {
  return text
    .replace(/[\r\n\t\u2028\u2029]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

function plainTitle(plan: Plan, title: RichText): string {
  return oneLine(
    resolveTitle(plan, title)
      .map((r) => r.text)
      .join(''),
  );
}

function statusOf(e: Entry): ListStatus {
  if (e.status === 'cancelled') return 'gestrichen';
  if (e.status === 'open') return 'offen';
  return e.changed ? 'geändert' : 'bestätigt';
}

/** Statuswert der Liste → Modell (für die Bearbeitung in der Liste). */
export function statusFromList(value: ListStatus): { status: EntryStatus; changed: boolean } {
  switch (value) {
    case 'gestrichen':
      return { status: 'cancelled', changed: false };
    case 'offen':
      return { status: 'open', changed: false };
    case 'geändert':
      return { status: 'confirmed', changed: true };
    case 'bestätigt':
      return { status: 'confirmed', changed: false };
  }
}

interface TimeFields {
  readonly zeitform: string;
  readonly von: string;
  readonly bis: string;
  readonly overMidnight: boolean;
}

/** Zeitform, von, bis nach normalisierung.md Abschnitt 6; date = Datum des Eintrags (Frist). */
export function timeFields(t: TimeSpec, date: IsoDate): TimeFields {
  switch (t.form) {
    case 'point':
      return { zeitform: 'Zeitpunkt', von: formatMilTime(t.at), bis: '', overMidnight: false };
    case 'range':
      return {
        zeitform: 'von-bis',
        von: formatMilTime(t.from),
        bis: formatMilTime(t.to),
        overMidnight: t.to > 1440,
      };
    case 'from':
      return { zeitform: 'ab', von: formatMilTime(t.from), bis: '', overMidnight: false };
    case 'until':
      return { zeitform: 'bis', von: '', bis: formatMilTime(t.to), overMidnight: false };
    case 'deadline': {
      const day = formatDate(date, 'long');
      return {
        zeitform: 'Frist',
        von: '',
        bis: t.to === undefined ? day : `${day} ${formatMilTime(t.to)}`,
        overMidnight: false,
      };
    }
  }
}

function weekOf(plan: Plan, date: IsoDate): Week | null {
  for (const w of plan.weeks) {
    const offset = daysBetween(w.startDate, date);
    if (offset >= 0 && offset <= 6) return w;
  }
  return null;
}

function canonicalName(c: Column): string {
  if (c.kind === 'rap') return 'Rap';
  if (c.kind === 'beso') return 'Beso';
  return oneLine(c.name);
}

/**
 * Spalten nach normalisierung.md Abschnitt 7: «alle» = alle Planungsspalten des Tages (auch bei nur einer),
 * mit Nebenspalte «alle|‹Name›»; sonst die Namen von links nach rechts, mit «|» getrennt.
 */
export function columnsText(sel: ColumnSelection, columns: readonly Column[]): string {
  if (sel.kind === 'all') return 'alle';
  const chosen = resolveColumns(sel, columns);
  const planning = columns.filter((c) => c.kind === 'planning');
  const chosenIds = new Set(chosen.map((c) => c.id));
  const allPlanning = planning.length > 0 && planning.every((c) => chosenIds.has(c.id));
  if (allPlanning) {
    const extra = chosen.filter((c) => c.kind !== 'planning').map(canonicalName);
    return ['alle', ...extra].join('|');
  }
  return chosen.map(canonicalName).join('|');
}

function categoryText(plan: Plan, first: Id | null, second: Id | null): string {
  const label = (id: Id | null): { text: string; index: number } | null => {
    if (id === null) return null;
    const index = plan.legend.findIndex((c) => c.id === id);
    const c = plan.legend[index];
    if (c === undefined) return null;
    return { text: c.neutral ? 'neutral' : oneLine(c.legendLabel), index };
  };
  const a = label(first);
  const b = label(second);
  if (a === null) return b?.text ?? '';
  if (b === null) return a.text;
  return a.index <= b.index ? `${a.text}+${b.text}` : `${b.text}+${a.text}`;
}

function columnsOfDate(plan: Plan, date: IsoDate): readonly Column[] {
  const week = weekOf(plan, date);
  return week === null ? [] : dayColumns(plan, week.id, weekdayOf(date));
}

function remarks(parts: readonly (string | false | null | undefined)[]): string {
  return parts.filter((p): p is string => typeof p === 'string' && p !== '').join(' / ');
}

type RowDraft = Omit<ListRow, 'weekId' | 'woche'>;

function rowsOfDatedEntry(
  plan: Plan,
  e: Exclude<Entry, { type: 'querbalken' | 'multiDayRemark' }>,
): RowDraft[] {
  const tag = weekdayOf(e.date);
  const status = statusOf(e);
  const columns = columnsOfDate(plan, e.date);
  switch (e.type) {
    case 'block': {
      const t = timeFields(e.time, e.date);
      const open = e.openEnd && e.time.form === 'range';
      return [
        {
          entryId: e.id,
          windowId: null,
          tag,
          typ: 'Block',
          titel: plainTitle(plan, e.title),
          zeitform: open ? 'ab' : t.zeitform,
          von: t.von,
          bis: open ? '' : t.bis,
          spalten: columnsText(e.columns, columns),
          kategorie: categoryText(plan, e.categoryId, e.secondCategoryId),
          ltg: oneLine(e.ltg),
          ort: oneLine(e.ort),
          nr: '',
          status,
          bemerkung: remarks([open && 'offenes Ende', t.overMidnight && 'über Mitternacht']),
        },
      ];
    }
    case 'marker': {
      return [
        {
          entryId: e.id,
          windowId: null,
          tag,
          typ: 'Marker',
          titel: oneLine(e.kind === 'custom' ? e.customKind : e.kind),
          zeitform: 'Zeitpunkt',
          von: formatMilTime(e.at),
          bis: '',
          // Marker immer über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026).
          spalten: 'alle',
          kategorie: '',
          ltg: '',
          ort: '',
          nr: '',
          status,
          bemerkung: '',
        },
      ];
    }
    case 'rapport': {
      const t = timeFields(e.time, e.date);
      const shown = columnsText(e.displayColumns, columns);
      const spalten =
        e.display === 'rapColumn'
          ? 'Rap'
          : e.display === 'onlyInColumns'
            ? shown
            : shown === ''
              ? 'Rap'
              : `Rap|${shown}`;
      return [
        {
          entryId: e.id,
          windowId: null,
          tag,
          typ: 'Rapport',
          titel: oneLine(e.code),
          zeitform: t.zeitform,
          von: t.von,
          bis: t.bis,
          spalten,
          kategorie: categoryText(plan, e.categoryId, null),
          ltg: '',
          ort: oneLine(e.ort),
          nr: '',
          status,
          bemerkung: remarks([t.overMidnight && 'über Mitternacht']),
        },
      ];
    }
    case 'beso': {
      const titel = plainTitle(plan, e.title);
      const nr = e.besoNumber === null ? '' : String(e.besoNumber).padStart(2, '0');
      const kategorie = categoryText(plan, e.categoryId, null);
      return e.windows.map((w) => {
        const t = timeFields(w.time, e.date);
        const column = w.columnId === null ? undefined : columns.find((c) => c.id === w.columnId);
        return {
          entryId: e.id,
          windowId: w.id,
          tag,
          typ: 'Beso',
          titel,
          zeitform: t.zeitform,
          von: t.von,
          bis: t.bis,
          spalten: column === undefined ? 'Beso' : canonicalName(column),
          kategorie,
          ltg: oneLine(e.ltg),
          ort: oneLine(e.ort),
          nr,
          status,
          bemerkung: remarks([
            w.supplement.trim() !== '' && `Zusatz: ${oneLine(w.supplement)}`,
            t.overMidnight && 'über Mitternacht',
          ]),
        };
      });
    }
    case 'dayRemark':
      return [
        {
          entryId: e.id,
          windowId: null,
          tag,
          typ: 'TagBemerkung',
          titel: oneLine(e.text),
          zeitform: 'ganztags',
          von: '',
          bis: '',
          spalten: '',
          kategorie: '',
          ltg: '',
          ort: '',
          nr: '',
          status,
          bemerkung: '',
        },
      ];
  }
}

function weekDates(w: Week): readonly IsoDate[] {
  return WEEKDAYS.map((_, i) => addDays(w.startDate, i));
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortRows(plan: Plan, rows: ListRow[]): ListRow[] {
  const weekIndex = new Map(plan.weeks.map((w, i) => [w.id, i]));
  const dayIndex = (t: Weekday | ''): number => (t === '' ? 7 : WEEKDAYS.indexOf(t));
  return rows
    .map((row, i) => ({ row, i }))
    .sort(
      (a, b) =>
        (weekIndex.get(a.row.weekId) ?? 0) - (weekIndex.get(b.row.weekId) ?? 0) ||
        dayIndex(a.row.tag) - dayIndex(b.row.tag) ||
        TYPE_ORDER.indexOf(a.row.typ) - TYPE_ORDER.indexOf(b.row.typ) ||
        compareText(a.row.von, b.row.von) ||
        compareText(a.row.spalten, b.row.spalten) ||
        compareText(a.row.nr, b.row.nr) ||
        a.i - b.i,
    )
    .map((x) => x.row);
}

/** Zeilen der Liste; sortiert: Woche, Tag, Typ, von, Spalten, Nr (Vertrag E1-08 §2). */
export function listRows(plan: Plan, scope: ListScope): readonly ListRow[] {
  const weeks = scope === 'plan' ? plan.weeks : plan.weeks.filter((w) => w.id === scope.weekId);
  const rows: ListRow[] = [];
  const entries = Object.values(plan.entries).sort((a, b) => a.createdSeq - b.createdSeq);
  for (const week of weeks) {
    const dates = new Set(weekDates(week));
    const add = (draft: RowDraft): void => {
      rows.push({ ...draft, weekId: week.id, woche: week.shortName });
    };
    for (const e of entries) {
      if (e.type === 'multiDayRemark') continue;
      if (e.type === 'querbalken') {
        const first = weekDates(week).find((d) => e.fromDate <= d && d <= e.toDate);
        if (first === undefined) continue;
        add({
          entryId: e.id,
          windowId: null,
          tag: weekdayOf(first),
          typ: 'Querbalken',
          titel: plainTitle(plan, e.title),
          zeitform: 'Datum',
          von: formatDate(e.fromDate, 'long'),
          bis: formatDate(e.toDate, 'long'),
          spalten: columnsText(e.columns, dayColumns(plan, week.id, weekdayOf(first))),
          kategorie: categoryText(plan, e.categoryId, null),
          ltg: '',
          ort: '',
          nr: '',
          status: statusOf(e),
          bemerkung: '',
        });
        continue;
      }
      if (!dates.has(e.date)) continue;
      for (const draft of rowsOfDatedEntry(plan, e)) add(draft);
    }
    for (const r of remarksForWeek(plan, week.id)) {
      const ranged = r.scope.kind === 'range';
      add({
        entryId: r.id,
        windowId: null,
        tag: '',
        typ: 'MehrtagBemerkung',
        titel: oneLine(r.text),
        zeitform: ranged ? 'Datum' : '',
        von: r.scope.kind === 'range' ? formatDate(r.scope.fromDate, 'long') : '',
        bis: r.scope.kind === 'range' ? formatDate(r.scope.toDate, 'long') : '',
        spalten: '',
        kategorie: '',
        ltg: '',
        ort: '',
        nr: r.number === null ? '' : String(r.number),
        status: statusOf(r),
        bemerkung: '',
      });
    }
  }
  return sortRows(plan, rows);
}

/** RFC 4180: Felder mit «;», «"» oder Zeilenumbruch in Anführungszeichen, «"» verdoppelt. */
function csvField(value: string): string {
  return /[;"\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Werte einer Zeile in der Reihenfolge der Kopfzeile. */
export function csvValues(row: ListRow): readonly string[] {
  // «geändert» ist eine Markierung, kein Status: der Export führt den Status (Gate B 28.10.2026, Entscheid 15 a;
  // UX-AB-05, UX-AB-F-09); die Markierung bleibt im Plan und in der Listenansicht.
  const status: ListStatus = row.status === 'geändert' ? 'bestätigt' : row.status;
  return [
    row.woche,
    row.tag,
    row.typ,
    row.titel,
    row.zeitform,
    row.von,
    row.bis,
    row.spalten,
    row.kategorie,
    row.ltg,
    row.ort,
    row.nr,
    status,
    row.bemerkung,
  ];
}

/** UTF-8 ohne BOM, LF, «;», RFC-4180-Quoting, Kopfzeile exakt gemäss normalisierung.md; interne Notizen nie enthalten (R-6-40). */
export function listCsv(plan: Plan, scope: ListScope): string {
  const lines = [
    LIST_CSV_HEADER,
    ...listRows(plan, scope).map((r) => csvValues(r).map(csvField).join(';')),
  ];
  return `${lines.join('\n')}\n`;
}
