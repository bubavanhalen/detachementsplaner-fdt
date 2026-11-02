// Prüflauf (Beschrieb 7 Einleitung; Vertrag E1-06 Abschnitt 1; R-7-01, R-7-02, R-7-04, R-7-05, R-7-34, R-11-14).
// Rein. createCheckRunner hält je Woche das letzte P8-Ergebnis, solange Woche, Planangaben und Einträge der Woche
// dieselben Objekte sind (unveränderliches Dokument, ADR-002): eine Änderung prüft nur die betroffene Woche neu.

import { addDays, daysBetween, isIsoDate } from '../calendar';
import { builtInTemplates, templateById } from '../template';
import type { Entry, Id, Plan, Week } from '../types';
import { checkP8 } from './p8';
import { checkP1, checkP16, checkP17, type RawFinding } from './rules';
import type { CheckInput, Finding, FindingSeverity } from './types';

const SEVERITY_ORDER: Readonly<Record<FindingSeverity, number>> = { error: 0, warning: 1, hint: 2 };
const DEFAULT_MIN_PT = 4.5;

function minSize(plan: Plan): number {
  try {
    return templateById(plan.templateId, builtInTemplates()).fontSizes.min;
  } catch {
    return DEFAULT_MIN_PT;
  }
}

/** Planangaben, die das Seitenlayout einer Woche beeinflussen (alles ausser Einträgen und Zählern). */
function planRefs(plan: Plan): readonly unknown[] {
  return [
    plan.templateId,
    plan.level,
    plan.unit,
    plan.parentUnit,
    plan.service,
    plan.exerciseName,
    plan.beilage,
    plan.classification,
    plan.sunLocation,
    plan.commander,
    plan.signatureImage,
    plan.signatureEnabled,
    plan.coatOfArms,
    plan.motto,
    plan.persons,
    plan.functionList,
    plan.legend,
    plan.rapportCodes,
    plan.abbreviationsSelected,
    plan.abbreviationMeanings,
    plan.markerLabels,
    plan.columnSets,
    plan.displayRange,
    plan.stand,
  ];
}

/** Einträge, die auf der Seite einer Woche erscheinen können (Vortag wegen Mitternacht, Bemerkungen immer). */
function weekEntries(plan: Plan, week: Week): readonly Entry[] {
  if (!isIsoDate(week.startDate)) return Object.values(plan.entries);
  const from = addDays(week.startDate, -1);
  const to = addDays(week.startDate, 6);
  const out: Entry[] = [];
  for (const e of Object.values(plan.entries)) {
    if (e.type === 'multiDayRemark') out.push(e);
    else if (e.type === 'querbalken') {
      if (e.fromDate <= to && e.toDate >= from) out.push(e);
    } else if (e.date >= from && e.date <= to) out.push(e);
  }
  return out;
}

function sameRefs(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function order(plan: Plan, findings: RawFinding[]): RawFinding[] {
  const weekIndex = new Map(plan.weeks.map((w, i) => [w.id, i] as const));
  return findings.sort(
    (a, b) =>
      (weekIndex.get(a.weekId) ?? 0) - (weekIndex.get(b.weekId) ?? 0) ||
      SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] ||
      (a.date ?? '').localeCompare(b.date ?? '') ||
      (a.sortMinute ?? -1) - (b.sortMinute ?? -1) ||
      (a.key < b.key ? -1 : a.key > b.key ? 1 : 0),
  );
}

function acknowledge(plan: Plan, raw: readonly RawFinding[]): readonly Finding[] {
  const acks = new Map(plan.acknowledgedFindings.map((a) => [a.key, a] as const));
  return raw.map((f): Finding => {
    const a = acks.get(f.key);
    return {
      ...f,
      acknowledged: a !== undefined,
      acknowledgement: a === undefined ? null : { at: a.at, reason: a.reason },
    };
  });
}

function p8For(plan: Plan, week: Week, input: CheckInput, min: number): RawFinding[] {
  try {
    return checkP8(plan, week, input.layoutFor(week.id), min);
  } catch {
    // Eine Woche, die sich nicht setzen lässt (z.B. Anzeigebereich zu klein), liefert kein P8.
    return [];
  }
}

/** Alle Befunde der aktiven Regeln; Reihenfolge Woche, Stufe, Datum, Sortierzeit (Vertrag E1-06). */
export function runChecks(input: CheckInput): readonly Finding[] {
  const { plan } = input;
  const min = minSize(plan);
  const raw: RawFinding[] = [...checkP1(plan), ...checkP16(plan), ...checkP17(plan)];
  for (const week of plan.weeks) raw.push(...p8For(plan, week, input, min));
  return acknowledge(plan, order(plan, raw));
}

/** Prüflauf mit Zwischenspeicher je Woche für P8 (R-11-14: ≤ 500 ms nach einer Änderung). */
export function createCheckRunner(): (input: CheckInput) => readonly Finding[] {
  const cache = new Map<Id, { refs: readonly unknown[]; findings: RawFinding[] }>();
  return (input) => {
    const { plan } = input;
    const min = minSize(plan);
    const raw: RawFinding[] = [...checkP1(plan), ...checkP16(plan), ...checkP17(plan)];
    const shared = planRefs(plan);
    const live = new Set<Id>();
    for (const week of plan.weeks) {
      live.add(week.id);
      const refs = [plan.id, week, ...shared, ...weekEntries(plan, week)];
      const hit = cache.get(week.id);
      if (hit !== undefined && sameRefs(hit.refs, refs)) {
        raw.push(...hit.findings);
        continue;
      }
      const findings = p8For(plan, week, input, min);
      cache.set(week.id, { refs, findings });
      raw.push(...findings);
    }
    for (const id of [...cache.keys()]) if (!live.has(id)) cache.delete(id);
    return acknowledge(plan, order(plan, raw));
  };
}

/** Offene, nicht quittierte Befunde (R-7-02, R-7-34). */
export function countOpen(findings: readonly Finding[]): number {
  return findings.filter((f) => !f.acknowledged).length;
}

/** Zähler je Stufe der offenen Befunde (UI-Richtlinie 8.1). */
export function countBySeverity(
  findings: readonly Finding[],
): Readonly<Record<FindingSeverity, number>> {
  const out = { error: 0, warning: 0, hint: 0 };
  for (const f of findings) if (!f.acknowledged) out[f.severity]++;
  return out;
}

/** Befunde der betroffenen Wochen für den PDF-Export; Bestätigung nötig bei offenen Fehlern (R-7-04, R-7-05). */
export function findingsForExport(
  findings: readonly Finding[],
  weekIds: readonly Id[],
): { readonly list: readonly Finding[]; readonly hasErrors: boolean } {
  const wanted = new Set(weekIds);
  const list = findings.filter((f) => wanted.has(f.weekId));
  return { list, hasErrors: list.some((f) => f.severity === 'error' && !f.acknowledged) };
}

/** Woche eines Datums (für Sprünge zur Stelle); null ausserhalb der Wochen. */
export function weekIdOfDate(plan: Plan, date: string): Id | null {
  if (!isIsoDate(date)) return null;
  for (const w of plan.weeks) {
    if (!isIsoDate(w.startDate)) continue;
    const d = daysBetween(w.startDate, date);
    if (d >= 0 && d < 7) return w.id;
  }
  return null;
}
