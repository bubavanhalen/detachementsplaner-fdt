// Strukturelle Validierung (Vertrag E1-02a Abschnitt 3 und 8 P-9, P-10, P-14, P-16). Befunde sind Rückgabewerte.
// Die Fabriken (factories.ts) nutzen dieselben Regeln im Umfang von P-9 (ohne Plan-Bezüge).

import { addDays, daysBetween, isIsoDate, weekdayOf } from './calendar';
import { dayColumns } from './derive/columns';
import type { UserMessage } from './errors';
import { isMilTime, isValidTimeSpec } from './time';
import type { Column, ColumnKind, ColumnSet, Entry, IsoDate, Plan, TimeForm, Week } from './types';

export type ValidationIssueCode =
  | 'missingField'
  | 'invalidDate'
  | 'invalidTime'
  | 'timeFormNotAllowed'
  | 'dateOrder'
  | 'emptyColumns'
  | 'unknownCategory'
  | 'sameSecondCategory'
  | 'besoWithoutWindow'
  | 'duplicateWindowId'
  | 'invalidPlacement'
  | 'unknownWeek'
  | 'invalidNumber'
  | 'columnOrder'
  | 'rapColumnCount'
  | 'besoColumnCount'
  | 'secondaryColumnCount'
  | 'duplicateColumnId'
  // Vertrag E1-02h Abschnitt 2 (Gate S A1, V-02e-4):
  | 'subtasksNotAllowed'
  | 'emptySubtasks'
  | 'invalidAbbreviationMeanings';

export interface ValidationIssue {
  readonly code: ValidationIssueCode;
  readonly field: string;
  readonly message: UserMessage;
}

/** Laufzeitsicht auf einen Eintrag: Felder können trotz Typ fehlen (P-9). */
type Fields = Readonly<Record<string, unknown>>;

const TIME_FORMS: readonly TimeForm[] = ['point', 'range', 'from', 'until', 'deadline'];
const MARKER_KINDS: readonly string[] = ['AV', 'ABV', 'HV', 'custom'];

const FIELD_LABELS: Readonly<Record<string, string>> = {
  type: 'Typ',
  date: 'Datum',
  time: 'Zeit',
  columns: 'Spalten',
  displayColumns: 'Spalten der Anzeige',
  categoryId: 'Kategorie',
  secondCategoryId: 'zweite Kategorie',
  fromDate: 'Datum von',
  toDate: 'Datum bis',
  at: 'Zeitpunkt',
  kind: 'Art',
  customKind: 'Bezeichnung der Art',
  code: 'Kürzel',
  windows: 'Zeitfenster',
  besoNumber: 'Nr',
  number: 'Nummer',
  scope: 'Zeitraum',
  subtasks: 'Teilaufgaben',
};

/** Bezeichnung eines Feldes in Meldungen, z.B. 'windows[1].time' → «Zeit im Zeitfenster 2». */
function fieldLabel(field: string): string {
  const win = /^windows\[(\d+)\]\.(\w+)$/.exec(field);
  if (win !== null) {
    const n = Number(win[1]) + 1;
    const part = win[2] === 'time' ? 'Zeit' : win[2] === 'columnId' ? 'Spalte' : 'Kennung';
    return `${part} im Zeitfenster ${n}`;
  }
  // Teilaufgaben (Vertrag E1-02h Abschnitt 2b): «Teilaufgabe 2», «Titel der Teilaufgabe 2» usw.
  const sub = /^subtasks\[(\d+)\](?:\.(\w+))?$/.exec(field);
  if (sub !== null) {
    const n = Number(sub[1]) + 1;
    if (sub[2] === undefined) return `Teilaufgabe ${n}`;
    const part = sub[2] === 'title' ? 'Titel' : sub[2] === 'ltg' ? 'Ltg' : 'Ort';
    return `${part} der Teilaufgabe ${n}`;
  }
  return FIELD_LABELS[field] ?? field;
}

function issue(code: ValidationIssueCode, field: string, message: UserMessage): ValidationIssue {
  return { code, field, message };
}

function missing(field: string): ValidationIssue {
  const label = fieldLabel(field);
  return issue('missingField', field, {
    cause: `Die Angabe «${label}» fehlt.`,
    nextStep: `«${label}» ergänzen.`,
  });
}

function invalidDate(field: string): ValidationIssue {
  return issue('invalidDate', field, {
    cause: `«${fieldLabel(field)}» ist kein gültiges Kalenderdatum.`,
    nextStep: 'Das Datum als dd.mm.yyyy eingeben, z.B. 28.09.2026.',
  });
}

function invalidTime(field: string): ValidationIssue {
  return issue('invalidTime', field, {
    cause: `«${fieldLabel(field)}» ist keine gültige Zeit. Zeiten sind auf 5 Minuten genau (0000 bis 2400); bei von–bis liegt das Ende nach dem Beginn und höchstens 24 Stunden später.`,
    nextStep: 'Die Zeit korrigieren, z.B. 0830 oder 0900-1200.',
  });
}

function invalidNumber(field: string): ValidationIssue {
  return issue('invalidNumber', field, {
    cause: `«${fieldLabel(field)}» ist keine ganze Zahl ab 0.`,
    nextStep: 'Eine ganze Zahl ab 0 eingeben oder das Feld leeren.',
  });
}

function dateOrder(field: string): ValidationIssue {
  return issue('dateOrder', field, {
    cause: 'Das Enddatum liegt vor dem Anfangsdatum.',
    nextStep: 'Das Anfangs- oder das Enddatum korrigieren.',
  });
}

/**
 * Regeln je Lauf: ohne Plan (plan null) Umfang der Fabriken P-9 ohne Plan-Bezüge; mit Plan alle Regeln
 * von validateEntry (P-10, P-14).
 */
interface Ctx {
  readonly plan: Plan | null;
  readonly out: ValidationIssue[];
  /** Platzierungsbefund (P-10), wird beim zugehörigen Feld eingereiht. */
  readonly placement: ValidationIssue | null;
}

function emitPlacement(ctx: Ctx, field: string): void {
  if (ctx.placement !== null && ctx.placement.field === field) ctx.out.push(ctx.placement);
}

function checkDate(ctx: Ctx, f: Fields, field: string): boolean {
  const v = f[field];
  if (typeof v !== 'string' || v === '') {
    ctx.out.push(missing(field));
    return false;
  }
  if (!isIsoDate(v)) {
    ctx.out.push(invalidDate(field));
    return false;
  }
  return true;
}

function timeFormMessage(type: string): UserMessage {
  return type === 'block'
    ? {
        cause: 'Ein Block kann keine Frist haben.',
        nextStep: 'Als Zeitform Zeitpunkt, von–bis, ab oder bis wählen.',
      }
    : {
        cause: 'Ein Rapport hat einen Zeitpunkt oder eine Zeit von–bis.',
        nextStep: 'Als Zeitform Zeitpunkt oder von–bis wählen.',
      };
}

function checkTime(
  ctx: Ctx,
  value: unknown,
  field: string,
  allowed: readonly TimeForm[],
  type: string,
): void {
  if (value === undefined || value === null) {
    ctx.out.push(missing(field));
    return;
  }
  const form = typeof value === 'object' ? (value as { readonly form?: unknown }).form : undefined;
  const known = TIME_FORMS.find((t) => t === form);
  if (known !== undefined && !allowed.includes(known)) {
    ctx.out.push(issue('timeFormNotAllowed', field, timeFormMessage(type)));
    return;
  }
  if (!isValidTimeSpec(value)) ctx.out.push(invalidTime(field));
}

/** Kategorie (P-14): leer → missingField; nicht in der Legende → unknownCategory (nur mit Plan). */
function checkCategory(ctx: Ctx, value: unknown, field: string, nullable: boolean): void {
  if (value === null && nullable) return;
  if (typeof value !== 'string' || value === '') {
    ctx.out.push(missing(field));
    return;
  }
  if (ctx.plan !== null && !ctx.plan.legend.some((c) => c.id === value)) {
    ctx.out.push(
      issue('unknownCategory', field, {
        cause: `Die ${fieldLabel(field)} ist in der Legende des Plans nicht vorhanden.`,
        nextStep: 'Eine Kategorie aus der Legende wählen.',
      }),
    );
  }
}

function checkNumber(ctx: Ctx, value: unknown, field: string): void {
  if (value === null) return;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    ctx.out.push(invalidNumber(field));
  }
}

function checkBlock(ctx: Ctx, f: Fields): void {
  checkDate(ctx, f, 'date');
  checkTime(ctx, f.time, 'time', ['point', 'range', 'from', 'until'], 'block');
  const sel = f.columns as { readonly kind?: unknown; readonly ids?: unknown } | undefined;
  if (typeof sel !== 'object' || sel === null || (sel.kind !== 'all' && sel.kind !== 'ids')) {
    ctx.out.push(missing('columns'));
  } else if (sel.kind === 'ids' && (!Array.isArray(sel.ids) || sel.ids.length === 0)) {
    ctx.out.push(
      issue('emptyColumns', 'columns', {
        cause: 'Der Block liegt in keiner Spalte.',
        nextStep: 'Mindestens eine Spalte wählen.',
      }),
    );
  }
  emitPlacement(ctx, 'columns');
  checkCategory(ctx, f.categoryId, 'categoryId', false);
  const second = f.secondCategoryId;
  if (second !== null && second !== '' && second !== undefined && second === f.categoryId) {
    ctx.out.push(
      issue('sameSecondCategory', 'secondCategoryId', {
        cause: 'Die zweite Kategorie ist gleich der ersten.',
        nextStep: 'Eine andere zweite Kategorie wählen oder sie entfernen.',
      }),
    );
  } else {
    checkCategory(ctx, second, 'secondCategoryId', true);
  }
  checkSubtasks(ctx, f);
}

/**
 * Titel einer Teilaufgabe (Abschnitt 2b): Array aus Läufen mit `text` vom Typ String und nicht leer, d.h. ein
 * Lauf trägt einen Beso-Verweis oder der verbundene Text ist nach Trimmen nicht leer (Q-045 (a), E1-02a N-3).
 */
function isFilledTitle(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  let text = '';
  let hasRef = false;
  for (const run of value as readonly unknown[]) {
    if (typeof run !== 'object' || run === null) return false;
    const r = run as Fields;
    if (typeof r.text !== 'string') return false;
    text += r.text;
    if (typeof r.besoRef === 'string' && r.besoRef !== '') hasRef = true;
  }
  return hasRef || text.trim() !== '';
}

/** Teilaufgaben eines Blocks (Vertrag E1-02h Abschnitt 2b; R-4.6-63): nach allen übrigen Befunden des Blocks. */
function checkSubtasks(ctx: Ctx, f: Fields): void {
  const list = f.subtasks;
  if (list === undefined) return;
  if (!Array.isArray(list)) {
    ctx.out.push(missing('subtasks'));
    return;
  }
  if (list.length === 0) {
    ctx.out.push(
      issue('emptySubtasks', 'subtasks', {
        cause: 'Die Liste der Teilaufgaben ist leer.',
        nextStep: 'Eine Teilaufgabe erfassen oder die Liste entfernen.',
      }),
    );
    return;
  }
  (list as readonly unknown[]).forEach((item, i) => {
    if (typeof item !== 'object' || item === null) {
      ctx.out.push(missing(`subtasks[${i}]`));
      return;
    }
    const s = item as Fields;
    if (!isFilledTitle(s.title)) ctx.out.push(missing(`subtasks[${i}].title`));
    if (typeof s.ltg !== 'string') ctx.out.push(missing(`subtasks[${i}].ltg`));
    if (typeof s.ort !== 'string') ctx.out.push(missing(`subtasks[${i}].ort`));
  });
}

function checkQuerbalken(ctx: Ctx, f: Fields): void {
  const fromOk = checkDate(ctx, f, 'fromDate');
  const toOk = checkDate(ctx, f, 'toDate');
  if (fromOk && toOk && daysBetween(f.fromDate as string, f.toDate as string) < 0) {
    ctx.out.push(dateOrder('toDate'));
  }
  emitPlacement(ctx, 'columns');
  if (ctx.plan !== null) checkCategory(ctx, f.categoryId, 'categoryId', true);
}

function checkMarker(ctx: Ctx, f: Fields): void {
  checkDate(ctx, f, 'date');
  if (f.at === undefined || f.at === null) ctx.out.push(missing('at'));
  else if (!isMilTime(f.at)) ctx.out.push(invalidTime('at'));
  if (typeof f.kind !== 'string' || !MARKER_KINDS.includes(f.kind)) {
    ctx.out.push(
      issue('missingField', 'kind', {
        cause: 'Die Art des Markers fehlt oder ist unbekannt.',
        nextStep: 'AV, ABV, HV oder «frei» mit einer Bezeichnung wählen.',
      }),
    );
  } else if (
    f.kind === 'custom' &&
    (typeof f.customKind !== 'string' || f.customKind.trim() === '')
  ) {
    ctx.out.push(missing('customKind'));
  }
  emitPlacement(ctx, 'columns');
}

function checkRapport(ctx: Ctx, f: Fields): void {
  checkDate(ctx, f, 'date');
  if (typeof f.code !== 'string' || f.code.trim() === '') ctx.out.push(missing('code'));
  checkTime(ctx, f.time, 'time', ['point', 'range'], 'rapport');
  if (ctx.plan !== null) checkCategory(ctx, f.categoryId, 'categoryId', false);
  emitPlacement(ctx, 'displayColumns');
}

function checkBeso(ctx: Ctx, f: Fields): void {
  checkDate(ctx, f, 'date');
  const windows = f.windows;
  if (!Array.isArray(windows) || windows.length === 0) {
    ctx.out.push(
      issue('besoWithoutWindow', 'windows', {
        cause: 'Ein Beso braucht mindestens ein Zeitfenster.',
        nextStep: 'Ein Zeitfenster mit Zeit erfassen.',
      }),
    );
  } else {
    const seen = new Set<unknown>();
    windows.forEach((w: unknown, i) => {
      const win = (typeof w === 'object' && w !== null ? w : {}) as Fields;
      if (ctx.plan !== null) {
        if (seen.has(win.id)) {
          ctx.out.push(
            issue('duplicateWindowId', `windows[${i}].id`, {
              cause: 'Zwei Zeitfenster dieses Beso haben dieselbe Kennung.',
              nextStep: 'Das doppelte Zeitfenster löschen und neu erfassen.',
            }),
          );
        }
        seen.add(win.id);
      }
      checkTime(ctx, win.time, `windows[${i}].time`, TIME_FORMS, 'beso');
      emitPlacement(ctx, `windows[${i}].columnId`);
    });
  }
  if (ctx.plan !== null) {
    // Beso: Leitungskategorie optional (null = keine; Beschrieb 4.6 Feldtabelle; UX-AB-15).
    checkCategory(ctx, f.categoryId, 'categoryId', true);
    checkNumber(ctx, f.besoNumber, 'besoNumber');
  }
}

function checkMultiDayRemark(ctx: Ctx, f: Fields): void {
  const scope = (typeof f.scope === 'object' && f.scope !== null ? f.scope : {}) as Fields;
  if (scope.kind === 'range') {
    if (!isIsoDate(scope.fromDate) || !isIsoDate(scope.toDate)) {
      ctx.out.push(invalidDate('scope'));
    } else if (daysBetween(scope.fromDate, scope.toDate) < 0) {
      ctx.out.push(dateOrder('scope'));
    }
  } else if (scope.kind === 'week') {
    const plan = ctx.plan;
    if (plan !== null && !plan.weeks.some((w) => w.id === scope.weekId)) {
      ctx.out.push(
        issue('unknownWeek', 'scope', {
          cause: 'Die Bemerkung gilt für eine Woche, die im Plan nicht vorhanden ist.',
          nextStep: 'Eine vorhandene Woche oder einen Zeitraum wählen.',
        }),
      );
    }
  } else if (scope.kind !== 'plan') {
    ctx.out.push(missing('scope'));
  }
  if (ctx.plan !== null) checkNumber(ctx, f.number, 'number');
}

function collect(e: Entry, ctx: Ctx): readonly ValidationIssue[] {
  const f = e as unknown as Fields;
  switch (f.type) {
    case 'block':
      checkBlock(ctx, f);
      break;
    case 'querbalken':
      checkQuerbalken(ctx, f);
      break;
    case 'marker':
      checkMarker(ctx, f);
      break;
    case 'rapport':
      checkRapport(ctx, f);
      break;
    case 'beso':
      checkBeso(ctx, f);
      break;
    case 'dayRemark':
      checkDate(ctx, f, 'date');
      break;
    case 'multiDayRemark':
      checkMultiDayRemark(ctx, f);
      break;
    default:
      ctx.out.push(missing('type'));
      return ctx.out;
  }
  // Teilaufgaben nur bei Blöcken (R-4.6-64, Arbeitsannahme Q-038): genau ein Befund am Ende.
  if (f.type !== 'block' && Object.hasOwn(f, 'subtasks') && f.subtasks !== undefined) {
    ctx.out.push(
      issue('subtasksNotAllowed', 'subtasks', {
        cause: 'Teilaufgaben gibt es nur bei Blöcken.',
        nextStep: 'Die Teilaufgaben entfernen oder den Eintrag als Block erfassen.',
      }),
    );
  }
  return ctx.out;
}

/**
 * Strukturelle Regeln der Fabriken (P-9) ohne Plan-Bezüge: Befunde in Feldreihenfolge des Typs.
 * Ergänzend zu P-9 wird jedes Datumsfeld auf ein gültiges Kalenderdatum geprüft.
 */
export function checkEntryStructure(e: Entry): readonly ValidationIssue[] {
  return collect(e, { plan: null, out: [], placement: null });
}

/** Tage aller Wochen des Plans mit ihrer Woche; liegt ein Tag in mehreren Wochen, gilt die erste. */
function weekByDay(plan: Plan): ReadonlyMap<IsoDate, Week> {
  const byDay = new Map<IsoDate, Week>();
  for (const w of plan.weeks.filter((x) => isIsoDate(x.startDate))) {
    for (let i = 0; i < 7; i++) {
      const day = addDays(w.startDate, i);
      if (!byDay.has(day)) byDay.set(day, w);
    }
  }
  return byDay;
}

/**
 * Platzierung gegen die Spalten des Tages (P-10): Einträge mit Datum an ihrem Tag; Querbalken mit
 * gültigen, geordneten Daten an jedem Tag des Zeitraums in einer Woche, aufsteigend, erster Befund
 * (Änderungsnotiz N-1). Tage ausserhalb der Wochen ergeben keinen Befund.
 */
function placementInPlan(plan: Plan, e: Entry): ValidationIssue | null {
  const f = e as unknown as Fields;
  const byDay = weekByDay(plan);
  let days: readonly IsoDate[] = [];
  if (f.type === 'querbalken') {
    const { fromDate, toDate } = f;
    if (isIsoDate(fromDate) && isIsoDate(toDate)) {
      days = [...byDay.keys()].filter((d) => fromDate <= d && d <= toDate).sort();
    }
  } else if (isIsoDate(f.date)) {
    days = [f.date];
  }
  for (const day of days) {
    const w = byDay.get(day);
    if (w === undefined) continue;
    const found = validateEntryPlacement(e, dayColumns(plan, w.id, weekdayOf(day)));
    if (found !== null) return found;
  }
  return null;
}

/** Alle Befunde eines Eintrags im Plan; leer = gültig. */
export function validateEntry(plan: Plan, e: Entry): readonly ValidationIssue[] {
  return collect(e, { plan, out: [], placement: placementInPlan(plan, e) });
}

function placementIssue(field: string, column: Column): ValidationIssue {
  const cause =
    column.kind === 'rap'
      ? `«${column.name}» ist die Rap-Spalte; sie zeigt nur Rapporte.`
      : `«${column.name}» ist die Beso-Spalte; sie zeigt nur Beso.`;
  return issue('invalidPlacement', field, {
    cause,
    nextStep: 'Eine Planungsspalte oder die Nebenspalte wählen.',
  });
}

/** Erste Rap- oder Beso-Spalte unter den genannten IDs; unbekannte IDs zählen nicht (P-10). */
function forbiddenColumn(ids: readonly unknown[], columns: readonly Column[]): Column | null {
  for (const id of ids) {
    const c = columns.find((col) => col.id === id);
    if (c !== undefined && (c.kind === 'rap' || c.kind === 'beso')) return c;
  }
  return null;
}

function selectionIds(sel: unknown): readonly unknown[] {
  if (typeof sel !== 'object' || sel === null) return [];
  const s = sel as { readonly kind?: unknown; readonly ids?: unknown };
  return s.kind === 'ids' && Array.isArray(s.ids) ? s.ids : [];
}

/** Spaltenauswahl nur Planungs- und Nebenspalten (R-4.4-05, R-4.4-06, R-4.4-07); erster Befund oder null. */
export function validateEntryPlacement(
  e: Entry,
  columns: readonly Column[],
): ValidationIssue | null {
  const f = e as unknown as Fields;
  switch (f.type) {
    case 'block':
    case 'marker':
    case 'querbalken': {
      const c = forbiddenColumn(selectionIds(f.columns), columns);
      return c === null ? null : placementIssue('columns', c);
    }
    case 'rapport': {
      const c = forbiddenColumn(selectionIds(f.displayColumns), columns);
      return c === null ? null : placementIssue('displayColumns', c);
    }
    case 'beso': {
      const windows: readonly unknown[] = Array.isArray(f.windows) ? f.windows : [];
      for (const [i, w] of windows.entries()) {
        const id = typeof w === 'object' && w !== null ? (w as Fields).columnId : null;
        const c = forbiddenColumn([id], columns);
        if (c !== null) return placementIssue(`windows[${i}].columnId`, c);
      }
      return null;
    }
    default:
      return null;
  }
}

const KIND_RANK: Readonly<Record<ColumnKind, number>> = {
  planning: 0,
  secondary: 1,
  rap: 2,
  beso: 3,
};

function countIssue(
  code: 'rapColumnCount' | 'besoColumnCount',
  count: number,
  name: string,
): ValidationIssue {
  return issue(code, 'columns', {
    cause: `Ein Spaltensatz braucht genau eine ${name}; dieser hat ${count}.`,
    nextStep: count === 0 ? `Eine ${name} ergänzen.` : `Überzählige ${name}n entfernen.`,
  });
}

/** Reihenfolge planning*, secondary?, rap, beso (R-2-02); genau eine Rap- und Beso-Spalte (P-10, P-16). */
export function validateColumnSet(s: ColumnSet): readonly ValidationIssue[] {
  const out: ValidationIssue[] = [];
  let maxRank = -1;
  for (const [i, c] of s.columns.entries()) {
    const rank = KIND_RANK[c.kind];
    if (rank < maxRank) {
      out.push(
        issue('columnOrder', `columns[${i}]`, {
          cause:
            'Die Spalten stehen nicht in der Reihenfolge Planungsspalten, Nebenspalte, Rap-Spalte, Beso-Spalte.',
          nextStep: 'Die Spalten in diese Reihenfolge verschieben.',
        }),
      );
      break;
    }
    maxRank = rank;
  }
  const count = (kind: ColumnKind): number => s.columns.filter((c) => c.kind === kind).length;
  if (count('rap') !== 1) out.push(countIssue('rapColumnCount', count('rap'), 'Rap-Spalte'));
  if (count('beso') !== 1) out.push(countIssue('besoColumnCount', count('beso'), 'Beso-Spalte'));
  if (count('secondary') > 1) {
    out.push(
      issue('secondaryColumnCount', 'columns', {
        cause: 'Ein Spaltensatz hat höchstens eine Nebenspalte.',
        nextStep: 'Überzählige Nebenspalten entfernen oder in Planungsspalten umwandeln.',
      }),
    );
  }
  const ids = new Set<string>();
  for (const [i, c] of s.columns.entries()) {
    if (ids.has(c.id)) {
      out.push(
        issue('duplicateColumnId', `columns[${i}]`, {
          cause: 'Zwei Spalten dieses Spaltensatzes haben dieselbe Kennung.',
          nextStep: 'Die doppelte Spalte löschen und neu anlegen.',
        }),
      );
    }
    ids.add(c.id);
  }
  return out;
}

/** Schlüssel, die nie als Kürzel gelten (Prototyp-Namen, CR-E103-07). */
const RESERVED_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Planfeld `abbreviationMeanings` (Vertrag E1-02h Abschnitt 2c; R-4.7-21): fehlt → []; sonst ein Objekt mit
 * mindestens einem eigenen Schlüssel, jeder Schlüssel nach Trimmen nicht leer und kein Prototyp-Name, jeder Wert
 * ein String. Befund `invalidAbbreviationMeanings` mit field 'abbreviationMeanings' bzw. 'abbreviationMeanings[<Kürzel>]'.
 */
export function validateAbbreviationMeanings(plan: Plan): readonly ValidationIssue[] {
  const value: unknown = (plan as unknown as Fields).abbreviationMeanings;
  if (value === undefined) return [];
  const invalid = (field: string): ValidationIssue =>
    issue('invalidAbbreviationMeanings', field, {
      cause: 'Die Bedeutungen der Kürzelliste sind ungültig.',
      nextStep:
        'Die Plan-Datei aus einer Sicherung öffnen oder die Bedeutungen in den Plan-Einstellungen neu erfassen.',
    });
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return [invalid('abbreviationMeanings')];
  }
  const proto: unknown = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return [invalid('abbreviationMeanings')];
  const keys = Object.keys(value);
  if (keys.length === 0) return [invalid('abbreviationMeanings')];
  const out: ValidationIssue[] = [];
  for (const key of keys) {
    const trimmed = key.trim();
    const badKey = trimmed === '' || trimmed !== key || RESERVED_KEYS.has(key);
    if (badKey || typeof Object.getOwnPropertyDescriptor(value, key)?.value !== 'string') {
      out.push(invalid(`abbreviationMeanings[${key}]`));
    }
  }
  return out;
}
