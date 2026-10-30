// Wochenbefehle (I3 C3; Beschrieb 5.2 «Woche einfügen, duplizieren, umbenennen, löschen; gelöschte Wochen sind
// wiederherstellbar», 4.2; F-16, F-17; R-5.2-02 bis R-5.2-06, R-4.1-16). Jeder Befehl ist ein Undo-Schritt (E1-03).

import { castDraft, type Draft } from 'immer';
import { addDays, daysBetween, formatDate, isIsoDate, isMonday } from '../calendar';
import type { Entry, Id, IsoDate, Plan, Week } from '../types';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  type CommandTools,
  clonePlain,
  command,
} from './command';

/** Optionen für Einfügen und Duplizieren: Folgewochen um eine Woche nach hinten schieben (F-16, nur auf Bestätigung). */
export interface InsertWeekOptions {
  readonly shiftFollowing: boolean;
}

export interface RenameWeekInput {
  readonly label: string;
  readonly shortName: string;
}

/** Vorschau «Woche einfügen»: Daten der neuen Woche und der Folgewochen, die verschoben werden müssten (F-16). */
export interface InsertPreview {
  readonly startDate: IsoDate;
  /** Folgewochen, deren Daten die neue Woche belegen würde (nur sie müssen weichen). */
  readonly collides: boolean;
  readonly shifted: readonly {
    readonly weekId: Id;
    readonly from: IsoDate;
    readonly to: IsoDate;
  }[];
}

function requireWeekIndex(plan: Plan, weekId: Id): number {
  const index = plan.weeks.findIndex((w) => w.id === weekId);
  if (index < 0) {
    throw new CommandError('unknownWeek', {
      cause: 'Die Woche ist im Plan nicht vorhanden.',
      nextStep: 'Eine vorhandene Woche wählen.',
    });
  }
  return index;
}

function lastDay(w: { readonly startDate: IsoDate }): IsoDate {
  return addDays(w.startDate, 6);
}

function inRange(date: IsoDate, from: IsoDate, to: IsoDate): boolean {
  return isIsoDate(date) && daysBetween(from, date) >= 0 && daysBetween(date, to) >= 0;
}

/** Liegt der Eintrag ganz in den Tagen von `from` bis `to`? Plan-Bemerkungen gehören zu keiner Woche. */
function entryInside(e: Entry, from: IsoDate, to: IsoDate, weekId: Id): boolean {
  switch (e.type) {
    case 'querbalken':
      return inRange(e.fromDate, from, to) && inRange(e.toDate, from, to);
    case 'multiDayRemark':
      if (e.scope.kind === 'week') return e.scope.weekId === weekId;
      if (e.scope.kind === 'range')
        return inRange(e.scope.fromDate, from, to) && inRange(e.scope.toDate, from, to);
      return false;
    default:
      return inRange(e.date, from, to);
  }
}

/** Verschiebt alle Daten eines Eintrags um `days` Tage (Wochenwechsel: Vielfaches von 7, Wochentag bleibt). */
function shiftEntry(e: Draft<Entry>, days: number): void {
  switch (e.type) {
    case 'querbalken':
      e.fromDate = addDays(e.fromDate, days);
      e.toDate = addDays(e.toDate, days);
      return;
    case 'multiDayRemark':
      if (e.scope.kind === 'range') {
        e.scope.fromDate = addDays(e.scope.fromDate, days);
        e.scope.toDate = addDays(e.scope.toDate, days);
      }
      return;
    default:
      e.date = addDays(e.date, days);
  }
}

/** Kurzname «Wo‹n›» mit der kleinsten freien Zahl ab der Wochennummer (Kurzname für Dateinamen, R-4.2-01). */
function freeShortName(plan: Plan, from: number): { label: string; shortName: string } {
  const taken = new Set(plan.weeks.map((w) => w.shortName));
  let n = Math.max(1, from);
  while (taken.has(`Wo${n}`)) n += 1;
  return { label: `Woche ${n}`, shortName: `Wo${n}` };
}

/** Wochen in Datumsreihenfolge (R-4.1-16: geordnete Liste, stabil nach Einfügen, Löschen, Wiederherstellen). */
function sortWeeks(d: Draft<Plan>): void {
  d.weeks.sort((a, b) => daysBetween(b.startDate, a.startDate));
}

function overlaps(a: IsoDate, b: IsoDate): boolean {
  return Math.abs(daysBetween(a, b)) < 7;
}

/** Vorschau für «Woche danach einfügen» bzw. «duplizieren» (F-16): neue Woche = Woche + 7 Tage. */
export function insertWeekPreview(plan: Plan, afterWeekId: Id): InsertPreview {
  const index = requireWeekIndex(plan, afterWeekId);
  const after = plan.weeks[index] as Week;
  const startDate = addDays(after.startDate, 7);
  const later = plan.weeks
    .filter((w) => daysBetween(after.startDate, w.startDate) > 0)
    .sort((a, b) => daysBetween(b.startDate, a.startDate));
  const collides = later.some((w) => overlaps(w.startDate, startDate));
  // Nur die zusammenhängenden Folgewochen weichen je um eine Woche; nach der ersten Lücke bleibt alles.
  const shifted: { weekId: Id; from: IsoDate; to: IsoDate }[] = [];
  let occupied = startDate;
  for (const w of collides ? later : []) {
    if (!overlaps(w.startDate, occupied)) break;
    const to = addDays(w.startDate, 7);
    shifted.push({ weekId: w.id, from: w.startDate, to });
    occupied = to;
  }
  return { startDate, collides, shifted };
}

const COLLISION = (date: IsoDate) =>
  new CommandError(
    'invalidDate',
    {
      cause: `Ab ${formatDate(date, 'long')} liegt schon eine Woche des Plans.`,
      nextStep:
        'Die Folgewochen um eine Woche verschieben (ihre Einträge wandern mit) oder abbrechen.',
    },
    { field: 'startDate' },
  );

/** Schiebt die Folgewochen der Vorschau um 7 Tage; ihre Einträge wandern mit (F-16). */
function shiftFollowing(d: Draft<Plan>, plan: Plan, preview: InsertPreview): void {
  for (const s of preview.shifted) {
    const week = d.weeks.find((w) => w.id === s.weekId);
    if (week === undefined) continue;
    const from = week.startDate;
    for (const e of Object.values(d.entries)) {
      const before = plan.entries[e.id];
      if (before !== undefined && entryInside(before, from, lastDay(week), week.id))
        shiftEntry(e, 7);
    }
    week.startDate = s.to;
  }
}

function newWeek(
  tools: CommandTools,
  source: Week,
  startDate: IsoDate,
  names: { label: string; shortName: string },
  copyContent: boolean,
): Week {
  return {
    id: tools.newId('w'),
    label: names.label,
    shortName: names.shortName,
    startDate,
    days: source.days.map((day) => ({
      weekday: day.weekday,
      columnSetId: day.columnSetId,
      display: day.display,
      internalNote: copyContent ? day.internalNote : '',
    })) as unknown as Week['days'],
    weekGoals: copyContent
      ? source.weekGoals.map((g) => ({ id: tools.newId('g'), text: g.text, group: g.group }))
      : [],
    heightenedReadiness: copyContent ? source.heightenedReadiness : '',
    sunOverride: copyContent ? { ...source.sunOverride } : { sunrise: null, sunset: null },
    agendaWeekend: source.agendaWeekend,
    hiddenRemarkIds: copyContent ? [...source.hiddenRemarkIds] : [],
  };
}

/**
 * Leere Woche nach `afterWeekId` (R-5.2-02): Startdatum = Woche + 7 Tage, Spaltensätze und Darstellung der Tage wie
 * die Vorwoche. Liegen dort schon Folgewochen, nur mit `shiftFollowing` (F-16), sonst Fehler mit nächstem Schritt.
 */
export function insertWeek(
  plan: Plan,
  afterWeekId: Id,
  options: InsertWeekOptions,
  ctx: CommandContext,
): CommandResult & { readonly weekId: Id } {
  const index = requireWeekIndex(plan, afterWeekId);
  const after = plan.weeks[index] as Week;
  const preview = insertWeekPreview(plan, afterWeekId);
  if (preview.collides && !options.shiftFollowing) throw COLLISION(preview.startDate);
  const names = freeShortName(plan, index + 1);
  let weekId = '';
  const r = command(
    plan,
    `Woche «${names.label}» eingefügt`,
    (d, t) => {
      if (preview.collides) shiftFollowing(d, plan, preview);
      const week = newWeek(t, after, preview.startDate, names, false);
      weekId = week.id;
      d.weeks.push(castDraft(week));
      sortWeeks(d);
    },
    ctx,
  );
  return { ...r, weekId };
}

/**
 * Kopie einer Woche direkt danach (R-5.2-03): alle Einträge, Spaltensätze, Darstellungen, Wochenziele und
 * Wochenbemerkungen als unabhängige Kopien mit neuen IDs. Folgewochen wie bei `insertWeek` (F-16).
 */
export function duplicateWeek(
  plan: Plan,
  weekId: Id,
  options: InsertWeekOptions,
  ctx: CommandContext,
): CommandResult & { readonly weekId: Id } {
  const index = requireWeekIndex(plan, weekId);
  const source = plan.weeks[index] as Week;
  const preview = insertWeekPreview(plan, weekId);
  if (preview.collides && !options.shiftFollowing) throw COLLISION(preview.startDate);
  const names = {
    label: `${source.label} (Kopie)`,
    shortName: freeShortName(plan, index + 1).shortName,
  };
  const copies = Object.values(plan.entries).filter((e) =>
    entryInside(e, source.startDate, lastDay(source), source.id),
  );
  let newWeekId = '';
  const r = command(
    plan,
    `Woche «${source.label}» dupliziert`,
    (d, t) => {
      if (preview.collides) shiftFollowing(d, plan, preview);
      const week = newWeek(t, source, preview.startDate, names, true);
      newWeekId = week.id;
      d.weeks.push(castDraft(week));
      for (const e of copies) {
        const id = t.newId('e');
        const copy = clonePlain(e) as Entry & { id: Id; createdSeq: number };
        const draft = castDraft({ ...copy, id, createdSeq: t.newSeq() }) as Draft<Entry>;
        if (draft.type === 'beso') {
          for (const w of draft.windows) w.id = t.newId('t');
          draft.besoNumber = null;
          draft.numberFixed = false;
        }
        if (draft.type === 'multiDayRemark' && draft.scope.kind === 'week')
          draft.scope = { kind: 'week', weekId: week.id };
        else shiftEntry(draft, 7);
        d.entries[id] = draft;
      }
      sortWeeks(d);
    },
    ctx,
  );
  return { ...r, weekId: newWeekId };
}

function cleanText(value: string, field: 'label' | 'shortName'): string {
  const text = value.trim();
  if (text === '') {
    throw new CommandError(
      'invalidEntry',
      field === 'label'
        ? {
            cause: 'Die Bezeichnung der Woche ist leer.',
            nextStep: 'Eine Bezeichnung eingeben, zum Beispiel «FDT Woche 1».',
          }
        : {
            cause: 'Der Kurzname der Woche ist leer.',
            nextStep: 'Einen Kurznamen für Dateinamen eingeben, zum Beispiel «Wo1».',
          },
      { field },
    );
  }
  return text;
}

/** Bezeichnung und Kurzname (R-5.2-04); der Kurzname muss im Plan eindeutig sein (Dateinamen, R-4.2-01). */
export function renameWeek(
  plan: Plan,
  weekId: Id,
  input: RenameWeekInput,
  ctx: CommandContext,
): CommandResult {
  const index = requireWeekIndex(plan, weekId);
  const label = cleanText(input.label, 'label');
  const shortName = cleanText(input.shortName, 'shortName');
  if (plan.weeks.some((w, i) => i !== index && w.shortName === shortName)) {
    throw new CommandError(
      'invalidEntry',
      {
        cause: `Den Kurznamen «${shortName}» trägt schon eine andere Woche.`,
        nextStep: 'Einen anderen Kurznamen wählen; er erscheint im Dateinamen.',
      },
      { field: 'shortName' },
    );
  }
  return command(
    plan,
    `Woche «${label}» umbenannt`,
    (d) => {
      const w = d.weeks[index];
      if (w === undefined) return;
      if (w.label !== label) w.label = label;
      if (w.shortName !== shortName) w.shortName = shortName;
    },
    ctx,
  );
}

/**
 * Neues Startdatum (Montag); Einträge der Woche wandern mit, Kopfdaten (Enddatum, KW, Tage) folgen automatisch
 * (Beschrieb 4.2). Das neue Datum darf keine andere Woche überdecken.
 */
export function setWeekStart(
  plan: Plan,
  weekId: Id,
  startDate: IsoDate,
  ctx: CommandContext,
): CommandResult {
  const index = requireWeekIndex(plan, weekId);
  const week = plan.weeks[index] as Week;
  if (!isIsoDate(startDate) || !isMonday(startDate)) {
    throw new CommandError(
      'invalidDate',
      {
        cause: isIsoDate(startDate)
          ? `Der ${formatDate(startDate, 'long')} ist kein Montag. Wochen beginnen am Montag.`
          : 'Das Startdatum ist kein gültiges Datum.',
        nextStep: 'Einen Montag als dd.mm.yyyy eingeben, zum Beispiel 28.09.2026.',
      },
      { field: 'startDate' },
    );
  }
  const delta = daysBetween(week.startDate, startDate);
  const other = plan.weeks.find((w, i) => i !== index && overlaps(w.startDate, startDate));
  if (other !== undefined) throw COLLISION(startDate);
  const moved = Object.values(plan.entries).filter((e) =>
    entryInside(e, week.startDate, lastDay(week), week.id),
  );
  return command(
    plan,
    `Startdatum von «${week.label}» auf ${formatDate(startDate, 'long')} gesetzt`,
    (d) => {
      const w = d.weeks[index];
      if (w === undefined || delta === 0) return;
      w.startDate = startDate;
      for (const e of moved) {
        const target = d.entries[e.id];
        if (target !== undefined) shiftEntry(target, delta);
      }
      sortWeeks(d);
    },
    ctx,
  );
}

/**
 * Löscht eine Woche samt ihrer Einträge in die Liste «Gelöschte Wochen» (R-5.2-05, F-17); rückgängig machbar und
 * über `restoreWeek` wiederherstellbar. Die letzte Woche eines Plans bleibt.
 */
export function deleteWeek(plan: Plan, weekId: Id, ctx: CommandContext): CommandResult {
  const index = requireWeekIndex(plan, weekId);
  const week = plan.weeks[index] as Week;
  if (plan.weeks.length === 1) {
    throw new CommandError('unknownWeek', {
      cause: 'Das ist die einzige Woche des Plans.',
      nextStep: 'Zuerst eine weitere Woche einfügen oder den ganzen Plan löschen.',
    });
  }
  const gone = Object.values(plan.entries).filter((e) =>
    entryInside(e, week.startDate, lastDay(week), week.id),
  );
  return command(
    plan,
    `Woche «${week.label}» gelöscht`,
    (d) => {
      d.weeks.splice(index, 1);
      for (const e of gone) delete d.entries[e.id];
      d.deletedWeeks.push(castDraft({ week: clonePlain(week), entries: gone.map(clonePlain) }));
    },
    ctx,
  );
}

/**
 * Stellt eine gelöschte Woche mit allen Einträgen unverändert wieder her (R-5.2-06, F-17); `index` in
 * `plan.deletedWeeks`. Belegt inzwischen eine andere Woche die Daten, meldet der Befehl das.
 */
export function restoreWeek(plan: Plan, index: number, ctx: CommandContext): CommandResult {
  const item = plan.deletedWeeks[index];
  if (item === undefined) {
    throw new CommandError('unknownWeek', {
      cause: 'Die gelöschte Woche ist nicht mehr in der Liste.',
      nextStep: 'Die Liste «Gelöschte Wochen» neu öffnen.',
    });
  }
  if (plan.weeks.some((w) => overlaps(w.startDate, item.week.startDate)))
    throw COLLISION(item.week.startDate);
  return command(
    plan,
    `Woche «${item.week.label}» wiederhergestellt`,
    (d) => {
      d.deletedWeeks.splice(index, 1);
      d.weeks.push(castDraft(clonePlain(item.week)));
      for (const e of item.entries) d.entries[e.id] = castDraft(clonePlain(e));
      sortWeeks(d);
    },
    ctx,
  );
}
