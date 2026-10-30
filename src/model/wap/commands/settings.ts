// Plan-, Wochen- und Tageseinstellungen (I3 C1/C3; Beschrieb 4.1, 4.2, 4.3, 4.4, 4.7, 4.8; Plan §4.19 E1-14).
// Jede Änderung ist genau ein Befehl und ein Undo-Schritt (Beschrieb 5.6 Punkt 6, E1-03).

import { castDraft } from 'immer';
import type {
  Column,
  ColumnSet,
  Commander,
  EntryStatus,
  FunctionEntry,
  Id,
  ImageAsset,
  LtgCategory,
  MarkerLabelSetting,
  MilTime,
  Plan,
  RapportCode,
  Rgb,
  TextDirection,
  Week,
  Weekday,
} from '../types';
import { validateColumnSet } from '../validate';
import {
  type CommandContext,
  CommandError,
  type CommandResult,
  command,
  requireEntry,
  structurallyEqual,
  writeEntry,
} from './command';

const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function invalid(field: string, cause: string, nextStep: string): CommandError {
  return new CommandError('invalidEntry', { cause, nextStep }, { field });
}

// ---------------------------------------------------------------------------------------------------------
// Plan (Beschrieb 4.1)
// ---------------------------------------------------------------------------------------------------------

/** Textfelder und Bilder des Plans (R-4.1-02 bis R-4.1-06, R-4.1-08, R-4.1-13). */
export interface PlanFieldChanges {
  readonly unit?: string;
  readonly parentUnit?: string;
  readonly service?: string;
  readonly exerciseName?: string;
  readonly beilage?: string;
  readonly classification?: string;
  readonly sunLocation?: string;
  readonly motto?: string;
  readonly commander?: Commander;
  readonly coatOfArms?: ImageAsset | null;
  readonly signatureImage?: ImageAsset | null;
  readonly signatureEnabled?: boolean;
}

const TEXT_FIELDS = [
  'unit',
  'parentUnit',
  'service',
  'exerciseName',
  'beilage',
  'classification',
  'sunLocation',
  'motto',
] as const;

function checkImage(field: string, image: ImageAsset | null | undefined): void {
  if (image === undefined || image === null) return;
  if (
    (image.mime !== 'image/png' && image.mime !== 'image/jpeg') ||
    typeof image.dataBase64 !== 'string' ||
    image.dataBase64 === ''
  ) {
    throw invalid(
      field,
      'Das Bild ist keine PNG- oder JPEG-Datei.',
      'Eine PNG- oder JPEG-Datei von diesem Gerät wählen.',
    );
  }
}

/** Ändert Plan-Felder; Texte werden am Rand getrimmt gespeichert (leere Klassifizierung = keine, R-15-01). */
export function updatePlanFields(
  plan: Plan,
  changes: PlanFieldChanges,
  ctx: CommandContext,
): CommandResult {
  checkImage('coatOfArms', changes.coatOfArms);
  checkImage('signatureImage', changes.signatureImage);
  const commander =
    changes.commander === undefined
      ? undefined
      : {
          grad: changes.commander.grad.trim(),
          name: changes.commander.name.trim(),
          vorname: changes.commander.vorname.trim(),
          funktion: changes.commander.funktion.trim(),
          nameOrder: changes.commander.nameOrder,
        };
  if (
    commander !== undefined &&
    commander.nameOrder !== 'gradVornameName' &&
    commander.nameOrder !== 'gradNameVorname'
  ) {
    throw invalid(
      'commander.nameOrder',
      'Die Reihenfolge im Unterschriftblock ist unbekannt.',
      '«Grad Vorname Name» oder «Grad Name Vorname» wählen.',
    );
  }
  return command(
    plan,
    'Plan-Einstellungen geändert',
    (d) => {
      for (const f of TEXT_FIELDS) {
        const value = changes[f];
        if (value !== undefined && d[f] !== value.trim()) d[f] = value.trim();
      }
      if (commander !== undefined && !structurallyEqual(d.commander, commander))
        d.commander = commander;
      if (changes.coatOfArms !== undefined && !structurallyEqual(d.coatOfArms, changes.coatOfArms))
        d.coatOfArms = changes.coatOfArms === null ? null : { ...changes.coatOfArms };
      if (
        changes.signatureImage !== undefined &&
        !structurallyEqual(d.signatureImage, changes.signatureImage)
      )
        d.signatureImage = changes.signatureImage === null ? null : { ...changes.signatureImage };
      if (changes.signatureEnabled !== undefined && d.signatureEnabled !== changes.signatureEnabled)
        d.signatureEnabled = changes.signatureEnabled;
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------------------------------------
// Woche (Beschrieb 4.2, 4.8)
// ---------------------------------------------------------------------------------------------------------

export interface WeekFieldChanges {
  readonly heightenedReadiness?: string;
  readonly sunOverride?: { readonly sunrise: MilTime | null; readonly sunset: MilTime | null };
  readonly hiddenRemarkIds?: readonly Id[];
  readonly agendaWeekend?: Week['agendaWeekend'];
}

function requireWeekIndex(plan: Plan, weekId: Id): number {
  const i = plan.weeks.findIndex((w) => w.id === weekId);
  if (i < 0) {
    throw new CommandError('unknownWeek', {
      cause: 'Die Woche ist im Plan nicht vorhanden.',
      nextStep: 'Eine vorhandene Woche wählen.',
    });
  }
  return i;
}

function checkSunTime(field: string, t: MilTime | null): void {
  if (t === null) return;
  if (!Number.isInteger(t) || t < 0 || t >= 1440 || t % 5 !== 0) {
    throw invalid(
      field,
      'Die Sonnenzeit liegt nicht im 5-Minuten-Raster eines Tages.',
      'Eine Zeit wie 0715 oder 1930 eingeben (auf 5 Minuten).',
    );
  }
}

/** Erhöhte Bereitschaft, Sonnenzeiten von Hand (R-4.8-11), ausgeblendete Plan-Bemerkungen (R-4.2-08). */
export function updateWeekFields(
  plan: Plan,
  weekId: Id,
  changes: WeekFieldChanges,
  ctx: CommandContext,
): CommandResult {
  const index = requireWeekIndex(plan, weekId);
  if (changes.sunOverride !== undefined) {
    checkSunTime('sunOverride.sunrise', changes.sunOverride.sunrise);
    checkSunTime('sunOverride.sunset', changes.sunOverride.sunset);
  }
  const week = plan.weeks[index] as Week;
  return command(
    plan,
    `Woche «${week.label}» geändert`,
    (d) => {
      const w = d.weeks[index];
      if (w === undefined) return;
      if (
        changes.heightenedReadiness !== undefined &&
        w.heightenedReadiness !== changes.heightenedReadiness.trim()
      )
        w.heightenedReadiness = changes.heightenedReadiness.trim();
      if (
        changes.sunOverride !== undefined &&
        !structurallyEqual(w.sunOverride, changes.sunOverride)
      )
        w.sunOverride = { ...changes.sunOverride };
      if (
        changes.hiddenRemarkIds !== undefined &&
        !structurallyEqual(w.hiddenRemarkIds, changes.hiddenRemarkIds)
      )
        w.hiddenRemarkIds = [...new Set(changes.hiddenRemarkIds)];
      if (changes.agendaWeekend !== undefined && w.agendaWeekend !== changes.agendaWeekend)
        w.agendaWeekend = changes.agendaWeekend;
    },
    ctx,
  );
}

/** Wochenziele als Aufzählung (R-4.2-04): Reihenfolge und Text; leere Zeilen entfallen, IDs bleiben je Lage. */
export function setWeekGoals(
  plan: Plan,
  weekId: Id,
  goals: readonly string[],
  ctx: CommandContext,
): CommandResult {
  const index = requireWeekIndex(plan, weekId);
  const week = plan.weeks[index] as Week;
  const texts = goals.map((g) => g.trim()).filter((g) => g !== '');
  return command(
    plan,
    `Wochenziele von «${week.label}» geändert`,
    (d, t) => {
      const w = d.weeks[index];
      if (w === undefined) return;
      const next = texts.map((text, i) => ({
        id: w.weekGoals[i]?.id ?? t.newId('g'),
        text,
        group: w.weekGoals[i]?.group ?? null,
      }));
      if (!structurallyEqual(w.weekGoals, next)) w.weekGoals = next;
    },
    ctx,
  );
}

/** Plan-Bemerkung («gelten durchgehend») in einer Woche aus- bzw. wieder einblenden (R-4.2-08). */
export function setRemarkHidden(
  plan: Plan,
  weekId: Id,
  remarkId: Id,
  hidden: boolean,
  ctx: CommandContext,
): CommandResult {
  const index = requireWeekIndex(plan, weekId);
  const remark = requireEntry(plan, remarkId);
  if (remark.type !== 'multiDayRemark') {
    throw invalid('remarkId', 'Der Eintrag ist keine Bemerkung.', 'Eine Bemerkung wählen.');
  }
  const week = plan.weeks[index] as Week;
  const set = new Set(week.hiddenRemarkIds);
  if (hidden) set.add(remarkId);
  else set.delete(remarkId);
  return command(
    plan,
    `Bemerkung in «${week.label}» ${hidden ? 'ausgeblendet' : 'eingeblendet'}`,
    (d) => {
      const w = d.weeks[index];
      if (w !== undefined && !structurallyEqual(w.hiddenRemarkIds, [...set]))
        w.hiddenRemarkIds = [...set];
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------------------------------------
// Tag (Beschrieb 4.3)
// ---------------------------------------------------------------------------------------------------------

/** Interne Notiz des Tages (R-6-07): erscheint nie im PDF. */
export function setDayNote(
  plan: Plan,
  weekId: Id,
  weekday: Weekday,
  note: string,
  ctx: CommandContext,
): CommandResult {
  const index = requireWeekIndex(plan, weekId);
  const day = WEEKDAYS.indexOf(weekday);
  if (day < 0) throw new RangeError(`setDayNote: unbekannter Wochentag «${weekday}».`);
  return command(
    plan,
    `Interne Notiz ${weekday} geändert`,
    (d) => {
      const target = d.weeks[index]?.days[day];
      if (target !== undefined && target.internalNote !== note) target.internalNote = note;
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------------------------------------
// Legende (Beschrieb 4.7; F-58)
// ---------------------------------------------------------------------------------------------------------

export interface CategoryInput {
  readonly id?: Id;
  readonly name: string;
  readonly legendLabel: string;
  readonly color: Rgb;
  readonly neutral: boolean;
  readonly inLegend: boolean;
}

function checkColor(c: Rgb): Rgb {
  const ok = (v: number) => Number.isInteger(v) && v >= 0 && v <= 255;
  if (!ok(c.r) || !ok(c.g) || !ok(c.b)) {
    throw invalid(
      'color',
      'Die Farbe ist ungültig.',
      'Eine Farbe wählen, zum Beispiel #FFFF00 für gelb.',
    );
  }
  return { r: c.r, g: c.g, b: c.b };
}

/** Kategorie anlegen bzw. ändern (R-4.7-01): Name nicht leer und im Plan eindeutig. */
export function upsertCategory(
  plan: Plan,
  input: CategoryInput,
  ctx: CommandContext,
): CommandResult & { readonly categoryId: Id } {
  const name = input.name.trim();
  if (name === '')
    throw invalid(
      'name',
      'Die Kategorie hat keinen Namen.',
      'Einen Namen eingeben, z.B. «Ltg Kp».',
    );
  if (plan.legend.some((c) => c.name === name && c.id !== input.id)) {
    throw invalid(
      'name',
      `Eine Kategorie «${name}» gibt es schon.`,
      'Einen anderen Namen wählen oder die vorhandene Kategorie ändern.',
    );
  }
  const color = checkColor(input.color);
  const index = input.id === undefined ? -1 : plan.legend.findIndex((c) => c.id === input.id);
  if (input.id !== undefined && index < 0) {
    throw invalid('id', 'Die Kategorie ist im Plan nicht vorhanden.', 'Die Legende neu öffnen.');
  }
  let categoryId = input.id ?? '';
  const r = command(
    plan,
    index < 0 ? `Kategorie «${name}» angelegt` : `Kategorie «${name}» geändert`,
    (d, t) => {
      const value = {
        name,
        legendLabel: input.legendLabel.trim(),
        color,
        neutral: input.neutral,
        inLegend: input.inLegend,
      };
      if (index < 0) {
        categoryId = t.newId('k');
        d.legend.push({ id: categoryId, ...value });
        return;
      }
      const target = d.legend[index];
      if (target !== undefined && !structurallyEqual({ ...target, id: undefined }, value)) {
        target.name = value.name;
        target.legendLabel = value.legendLabel;
        target.color = value.color;
        target.neutral = value.neutral;
        target.inLegend = value.inLegend;
      }
    },
    ctx,
  );
  return { ...r, categoryId };
}

/** Wird die Kategorie verwendet (Einträge auch gelöschter Wochen, Spalten, Funktionsliste, Rapportkürzel)? */
export function categoryUsage(plan: Plan, id: Id): number {
  let n = 0;
  const all = [...Object.values(plan.entries), ...plan.deletedWeeks.flatMap((w) => w.entries)];
  for (const e of all) {
    if ('categoryId' in e && e.categoryId === id) n += 1;
    else if (e.type === 'block' && e.secondCategoryId === id) n += 1;
  }
  for (const s of plan.columnSets)
    for (const c of s.columns) if (c.defaultCategoryId === id) n += 1;
  n += plan.functionList.filter((f) => f.categoryId === id).length;
  n += plan.rapportCodes.filter((r) => r.categoryId === id).length;
  return n;
}

/**
 * Löscht eine Kategorie (R-4.7-01, F-58): Wird sie verwendet, ist eine Ersatzkategorie Pflicht; alle Verweise
 * wechseln in einem Undo-Schritt. Die letzte Kategorie bleibt.
 */
export function deleteCategory(
  plan: Plan,
  id: Id,
  replacementId: Id | null,
  ctx: CommandContext,
): CommandResult {
  const index = plan.legend.findIndex((c) => c.id === id);
  const cat = plan.legend[index];
  if (cat === undefined)
    throw invalid('id', 'Die Kategorie ist im Plan nicht vorhanden.', 'Die Legende neu öffnen.');
  if (plan.legend.length === 1) {
    throw invalid(
      'id',
      'Das ist die einzige Kategorie der Legende.',
      'Zuerst eine weitere Kategorie anlegen.',
    );
  }
  const used = categoryUsage(plan, id);
  if (used > 0 && (replacementId === null || replacementId === id)) {
    throw invalid(
      'replacementId',
      `«${cat.name}» wird ${used}-mal verwendet.`,
      'Eine Ersatzkategorie für alle betroffenen Einträge wählen.',
    );
  }
  if (replacementId !== null && !plan.legend.some((c) => c.id === replacementId && c.id !== id)) {
    throw invalid('replacementId', 'Die Ersatzkategorie fehlt.', 'Eine andere Kategorie wählen.');
  }
  const to = replacementId;
  return command(
    plan,
    `Kategorie «${cat.name}» gelöscht`,
    (d) => {
      d.legend.splice(index, 1);
      if (to === null) return;
      // Auch Einträge gelöschter Wochen wechseln, damit die Woche wiederherstellbar bleibt (CR-H-D-04).
      for (const e of [...Object.values(d.entries), ...d.deletedWeeks.flatMap((w) => w.entries)]) {
        if ('categoryId' in e && e.categoryId === id) e.categoryId = to;
        // Wird die zweite Kategorie der ersten gleich (gelöschte erste oder zweite = Ersatz), entfällt sie (FA-02).
        if (e.type === 'block' && e.secondCategoryId !== null) {
          const second = e.secondCategoryId === id ? to : e.secondCategoryId;
          e.secondCategoryId = second === e.categoryId ? null : second;
        }
      }
      for (const s of d.columnSets)
        for (const c of s.columns) if (c.defaultCategoryId === id) c.defaultCategoryId = to;
      for (const f of d.functionList) if (f.categoryId === id) f.categoryId = to;
      for (const r of d.rapportCodes) if (r.categoryId === id) r.categoryId = to;
      if (d.lastUsedCategoryId === id) d.lastUsedCategoryId = to;
    },
    ctx,
  );
}

/** Reihenfolge der Legende ändern (eine Stelle nach oben bzw. unten). */
export function moveCategory(
  plan: Plan,
  id: Id,
  direction: -1 | 1,
  ctx: CommandContext,
): CommandResult {
  const i = plan.legend.findIndex((c) => c.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= plan.legend.length) return command(plan, '', () => {}, ctx);
  const name = plan.legend[i]?.name ?? '';
  return command(
    plan,
    `Kategorie «${name}» verschoben`,
    (d) => {
      const [c] = d.legend.splice(i, 1);
      if (c !== undefined) d.legend.splice(j, 0, c);
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------------------------------------
// Funktionsliste, Rapportkürzel, Kürzelliste (Beschrieb 4.7)
// ---------------------------------------------------------------------------------------------------------

function checkCategoryRef(plan: Plan, field: string, id: Id | null): void {
  if (id !== null && !plan.legend.some((c) => c.id === id)) {
    throw invalid(
      field,
      'Die Kategorie ist im Plan nicht vorhanden.',
      'Eine Kategorie der Legende wählen.',
    );
  }
}

/** Funktionsliste (Kürzel, Kategorie, Einzelfunktion; R-4.7-09); Kürzel eindeutig, leere Zeilen entfallen. */
export function updateFunctionList(
  plan: Plan,
  list: readonly FunctionEntry[],
  ctx: CommandContext,
): CommandResult {
  const seen = new Set<string>();
  const next: FunctionEntry[] = [];
  list.forEach((f, i) => {
    const code = f.code.trim();
    if (code === '') return;
    if (seen.has(code)) {
      throw invalid(
        `functionList[${i}].code`,
        `Die Funktion «${code}» steht doppelt in der Liste.`,
        'Eine der beiden Zeilen entfernen.',
      );
    }
    seen.add(code);
    checkCategoryRef(plan, `functionList[${i}].categoryId`, f.categoryId);
    next.push({ code, categoryId: f.categoryId, singleFunction: f.singleFunction });
  });
  return command(
    plan,
    'Funktionsliste geändert',
    (d) => {
      if (!structurallyEqual(d.functionList, next)) d.functionList = next;
    },
    ctx,
  );
}

/** Rapportkürzel mit Kategorie (R-4.9-18); Kürzel eindeutig, leere entfallen. */
export function updateRapportCodes(
  plan: Plan,
  list: readonly RapportCode[],
  ctx: CommandContext,
): CommandResult {
  const seen = new Set<string>();
  const next: RapportCode[] = [];
  list.forEach((r, i) => {
    const code = r.code.trim();
    if (code === '') return;
    if (seen.has(code)) {
      throw invalid(
        `rapportCodes[${i}].code`,
        `Das Rapportkürzel «${code}» steht doppelt in der Liste.`,
        'Eine der beiden Zeilen entfernen.',
      );
    }
    seen.add(code);
    checkCategoryRef(plan, `rapportCodes[${i}].categoryId`, r.categoryId);
    next.push({ code, categoryId: r.categoryId });
  });
  return command(
    plan,
    'Rapportkürzel geändert',
    (d) => {
      if (!structurallyEqual(d.rapportCodes, next)) d.rapportCodes = next;
    },
    ctx,
  );
}

/** Kennt der Plan das Kürzel (Rapportkürzel oder gewähltes Kürzel)? Sonst Vorschlag zur Aufnahme (R-4.7-16). */
export function isKnownCode(plan: Plan, code: string): boolean {
  const c = code.trim();
  return (
    c === '' ||
    plan.rapportCodes.some((r) => r.code === c) ||
    plan.abbreviationsSelected.includes(c)
  );
}

/** Nimmt ein unbekanntes Rapportkürzel in die Abkürzungsliste auf (als Rapportkürzel mit Kategorie, R-4.7-16). */
export function addRapportCode(
  plan: Plan,
  code: string,
  categoryId: Id,
  ctx: CommandContext,
): CommandResult {
  const c = code.trim();
  if (c === '' || isKnownCode(plan, c)) return command(plan, '', () => {}, ctx);
  checkCategoryRef(plan, 'categoryId', categoryId);
  return command(
    plan,
    `«${c}» in die Abkürzungsliste aufgenommen`,
    (d) => {
      d.rapportCodes.push({ code: c, categoryId });
    },
    ctx,
  );
}

/**
 * Kürzelliste (R-4.7-14, R-4.7-21, R-4.7-22): gewählte weitere Kürzel und Bedeutungen je Kürzel. Leere Bedeutung
 * entfernt den eigenen Wert (dann gilt die Vorlage); ohne eigene Werte entfällt das Feld (kanonisch, E1-02h).
 */
export function updateAbbreviations(
  plan: Plan,
  selected: readonly string[],
  meanings: Readonly<Record<string, string>>,
  ctx: CommandContext,
): CommandResult {
  const chosen = [...new Set(selected.map((s) => s.trim()).filter((s) => s !== ''))];
  const own: Record<string, string> = {};
  for (const [k, v] of Object.entries(meanings)) {
    const key = k.trim();
    if (key === '' || key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
    if (v.trim() !== '') own[key] = v.trim();
  }
  return command(
    plan,
    'Kürzelliste geändert',
    (d) => {
      if (!structurallyEqual(d.abbreviationsSelected, chosen)) d.abbreviationsSelected = chosen;
      const before = d.abbreviationMeanings ?? {};
      if (Object.keys(own).length === 0) {
        if (d.abbreviationMeanings !== undefined) delete d.abbreviationMeanings;
      } else if (!structurallyEqual({ ...before }, own)) d.abbreviationMeanings = own;
    },
    ctx,
  );
}

/** Markerbeschriftung je Art: mit oder ohne Zeit (F-55). */
export function updateMarkerLabels(
  plan: Plan,
  labels: readonly MarkerLabelSetting[],
  ctx: CommandContext,
): CommandResult {
  const next = labels.map((l) => ({ kind: l.kind, withTime: l.withTime }));
  return command(
    plan,
    'Markerbeschriftung geändert',
    (d) => {
      if (!structurallyEqual(d.markerLabels, next)) d.markerLabels = next;
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------------------------------------
// Spaltensätze als Vorlagen (Beschrieb 4.4, 5.2)
// ---------------------------------------------------------------------------------------------------------

function requireSet(plan: Plan, setId: Id): number {
  const i = plan.columnSets.findIndex((s) => s.id === setId);
  if (i < 0) {
    throw new CommandError('unknownColumnSet', {
      cause: 'Der Spaltensatz ist im Plan nicht vorhanden.',
      nextStep: 'Einen vorhandenen Spaltensatz wählen.',
    });
  }
  return i;
}

function checkSetName(plan: Plan, name: string, except: Id | null): string {
  const n = name.trim();
  if (n === '') {
    throw invalid(
      'name',
      'Der Spaltensatz hat keinen Namen.',
      'Einen Namen eingeben, z.B. «Woche mit FALCON/HAWK».',
    );
  }
  if (plan.columnSets.some((s) => s.name === n && s.id !== except)) {
    throw invalid('name', `Einen Spaltensatz «${n}» gibt es schon.`, 'Einen anderen Namen wählen.');
  }
  return n;
}

function checkSet(set: ColumnSet): void {
  const first = validateColumnSet(set)[0];
  if (first !== undefined)
    throw new CommandError('invalidColumnSet', first.message, { field: first.field });
}

/**
 * Neuer Spaltensatz: als Kopie eines vorhandenen (`fromSetId`) mit neuen Spalten-IDs oder mit einer Planungsspalte
 * und den Spalten Rap und Beso (R-2-02).
 */
export function createColumnSet(
  plan: Plan,
  name: string,
  fromSetId: Id | null,
  ctx: CommandContext,
): CommandResult & { readonly setId: Id } {
  const n = checkSetName(plan, name, null);
  const source = fromSetId === null ? null : plan.columnSets[requireSet(plan, fromSetId)];
  let setId = '';
  const r = command(
    plan,
    `Spaltensatz «${n}» angelegt`,
    (d, t) => {
      setId = t.newId('s');
      const base: readonly Omit<Column, 'id'>[] = source?.columns ?? [
        {
          name: 'Spalte 1',
          kind: 'planning',
          weight: 'normal',
          labelOrientation: 'horizontal',
          defaultCategoryId: null,
          origin: 'manual',
        },
        {
          name: 'Rap',
          kind: 'rap',
          weight: 'narrow',
          labelOrientation: 'horizontal',
          defaultCategoryId: null,
          origin: 'manual',
        },
        {
          name: 'Beso',
          kind: 'beso',
          weight: 'normal',
          labelOrientation: 'horizontal',
          defaultCategoryId: null,
          origin: 'manual',
        },
      ];
      const set: ColumnSet = {
        id: setId,
        name: n,
        columns: base.map((c) => ({ ...c, id: t.newId('c'), origin: 'manual' as const })),
      };
      checkSet(set);
      d.columnSets.push(castDraft(set));
    },
    ctx,
  );
  return { ...r, setId };
}

export function renameColumnSet(
  plan: Plan,
  setId: Id,
  name: string,
  ctx: CommandContext,
): CommandResult {
  const i = requireSet(plan, setId);
  const n = checkSetName(plan, name, setId);
  return command(
    plan,
    `Spaltensatz «${n}» umbenannt`,
    (d) => {
      const s = d.columnSets[i];
      if (s !== undefined && s.name !== n) s.name = n;
    },
    ctx,
  );
}

/** Spaltensatz löschen: nur wenn kein Tag ihn verwendet (sonst Meldung mit nächstem Schritt). */
export function deleteColumnSet(plan: Plan, setId: Id, ctx: CommandContext): CommandResult {
  const i = requireSet(plan, setId);
  const set = plan.columnSets[i] as ColumnSet;
  const used = plan.weeks.reduce(
    (n, w) => n + w.days.filter((d) => d.columnSetId === setId).length,
    0,
  );
  if (used > 0) {
    throw invalid(
      'setId',
      `«${set.name}» ist an ${used} ${used === 1 ? 'Tag' : 'Tagen'} zugewiesen.`,
      'Diesen Tagen zuerst einen anderen Spaltensatz zuweisen.',
    );
  }
  // Gelöschte Wochen behalten ihren Spaltensatz, damit sie unverändert wiederherstellbar sind (CR-H-D-05).
  const inDeleted = plan.deletedWeeks.filter((w) =>
    w.week.days.some((d) => d.columnSetId === setId),
  );
  if (inDeleted.length > 0) {
    throw invalid(
      'setId',
      `«${set.name}» wird von der gelöschten Woche «${inDeleted[0]?.week.label ?? ''}»${inDeleted.length > 1 ? ` und ${inDeleted.length - 1} weiteren` : ''} verwendet.`,
      'Die Woche unter «Gelöschte Wochen» wiederherstellen und ihren Tagen einen anderen Spaltensatz zuweisen.',
    );
  }
  return command(
    plan,
    `Spaltensatz «${set.name}» gelöscht`,
    (d) => {
      d.columnSets.splice(i, 1);
    },
    ctx,
  );
}

/**
 * Spalte innerhalb des Satzes um eine Stelle verschieben (Reihenfolge planning*, secondary?, rap, beso bleibt
 * gültig, R-2-02); Einträge bleiben in ihrer Spalte.
 */
export function moveColumn(
  plan: Plan,
  setId: Id,
  columnId: Id,
  direction: -1 | 1,
  ctx: CommandContext,
): CommandResult {
  const i = requireSet(plan, setId);
  const set = plan.columnSets[i] as ColumnSet;
  const from = set.columns.findIndex((c) => c.id === columnId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= set.columns.length) return command(plan, '', () => {}, ctx);
  const columns = [...set.columns];
  const [c] = columns.splice(from, 1);
  if (c === undefined) return command(plan, '', () => {}, ctx);
  columns.splice(to, 0, c);
  checkSet({ ...set, columns });
  return command(
    plan,
    `Spalte «${c.name}» verschoben`,
    (d) => {
      const s = d.columnSets[i];
      if (s === undefined) return;
      const [moved] = s.columns.splice(from, 1);
      if (moved !== undefined) s.columns.splice(to, 0, moved);
    },
    ctx,
  );
}

// ---------------------------------------------------------------------------------------------------------
// Mehrfachauswahl: gemeinsame Felder (UI-Richtlinie 5.7; R-5.1-21)
// ---------------------------------------------------------------------------------------------------------

export interface CommonChanges {
  readonly categoryId?: Id;
  readonly status?: EntryStatus;
  readonly textDirection?: TextDirection;
}

/** Kategorie, Status und Textrichtung mehrerer Einträge in einem Undo-Schritt (Felder nur, wo der Typ sie hat). */
export function updateCommonFields(
  plan: Plan,
  ids: readonly Id[],
  changes: CommonChanges,
  ctx: CommandContext,
): CommandResult {
  const entries = [...new Set(ids)].map((id) => requireEntry(plan, id));
  if (changes.categoryId !== undefined) checkCategoryRef(plan, 'categoryId', changes.categoryId);
  const label = entries.length === 1 ? 'Eintrag geändert' : `${entries.length} Einträge geändert`;
  return command(
    plan,
    label,
    (d) => {
      for (const e of entries) {
        let next = e;
        if (changes.status !== undefined && next.status !== changes.status)
          next = { ...next, status: changes.status };
        if (changes.categoryId !== undefined && 'categoryId' in next) {
          if (next.categoryId !== changes.categoryId)
            next = { ...next, categoryId: changes.categoryId };
          if (next.type === 'block' && next.secondCategoryId === changes.categoryId)
            next = { ...next, secondCategoryId: null };
        }
        if (
          changes.textDirection !== undefined &&
          next.type === 'block' &&
          next.textDirection !== changes.textDirection
        )
          next = { ...next, textDirection: changes.textDirection };
        if (next !== e) writeEntry(d, e, next);
      }
    },
    ctx,
  );
}

/** Kurzwort des Status für Meldungen und Seitenfeld (Glossar «Status»). */
export const STATUS_NAMES: Readonly<Record<EntryStatus, string>> = {
  confirmed: 'bestätigt',
  open: 'offen',
  cancelled: 'gestrichen',
};

/** Kategorie aus der Legende oder null. */
export function categoryOf(plan: Plan, id: Id | null): LtgCategory | null {
  return id === null ? null : (plan.legend.find((c) => c.id === id) ?? null);
}
