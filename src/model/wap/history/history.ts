// Historie für Rückgängig/Wiederholen (Vertrag E1-04, Notiz «Ausarbeitung Schritt 2 (07.10.2026)» Abschnitt B;
// ADR-006 Punkt 1, 2a, 2d; Beschrieb 5.6 Punkt 6; R-5.6-14, R-5.6-15). Rein: keine Uhr, kein Zufall, kein Speicher.
// Undo wendet die inversen Patches eines Schritts an, Redo seine Patches (immer `applyPatches`). Das Patches-Plugin
// schaltet `commands/command.ts` beim Laden ein; dieses Modul lädt es deshalb über einen Seiteneffekt-Import
// (Änderungsnotiz aus Vertrag E1-03).

import '../commands/command';
import { applyPatches, type Patch } from 'immer';
import { weekDates } from '../calendar';
import { type CommandResult, structurallyEqual } from '../commands/command';
import type { Plan } from '../types';

/** Für `src/io/wap-plan/` (darf `immer` nicht importieren, ADR-010 §4.4). */
export type { Patch } from 'immer';

/** Höchstzahl gespeicherter Schritte; Beschrieb 5.6 Punkt 6 verlangt mindestens 200 (R-5.6-15). */
export const HISTORY_LIMIT = 200;

/** Ein Historienschritt; `seq` je Plan fortlaufend ab 1, nie wiederverwendet (AR0-41, AR0-48). */
export interface HistoryStep {
  readonly seq: number;
  /** Anzeige im Undo, z.B. «Block «Mö Sch» verschoben» (CommandResult.label). */
  readonly label: string;
  /** ISO-Zeitpunkt (Date#toISOString) vom Clock des Aufrufers. */
  readonly at: string;
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
}

export interface HistoryState {
  /** Gespeicherte Schritte, aufsteigend nach seq (Lücken möglich nach dem Verwerfen eines Redo-Zweigs). */
  readonly steps: readonly HistoryStep[];
  /** Anzahl angewendeter Schritte: steps[0..cursor) angewendet, steps[cursor..) bilden den Redo-Zweig. */
  readonly cursor: number;
  /** Nächste zu vergebende seq; beginnt bei 1 (0 = ungekoppelte Aufzeichnung). Nie zurückgesetzt. */
  readonly nextSeq: number;
  /** Höchste seq, die durch Kürzen entfernt wurde (0 = nie gekürzt); solche Schritte gelten als angewendet. */
  readonly truncatedThroughSeq: number;
}

export const EMPTY_HISTORY: HistoryState = {
  steps: [],
  cursor: 0,
  nextSeq: 1,
  truncatedThroughSeq: 0,
};

/** Ergebnis von pushStep und cutHistory (Abschnitt B2, B6). */
export interface HistoryChange {
  readonly history: HistoryState;
  /** seq des Redo-Zweigs, der verworfen wurde, aufsteigend. */
  readonly discardedSeqs: readonly number[];
  /** seq der gekürzten (dauerhaft angewendeten) Schritte, aufsteigend. */
  readonly truncatedSeqs: readonly number[];
}

/** Hängt einen Schritt an (Abschnitt B2): seq = nextSeq, Redo-Zweig verworfen, auf HISTORY_LIMIT gekürzt. */
export function pushStep(
  h: HistoryState,
  step: Omit<HistoryStep, 'seq'>,
): HistoryChange & { readonly seq: number } {
  const discardedSeqs = h.steps.slice(h.cursor).map((s) => s.seq);
  const appended = [...h.steps.slice(0, h.cursor), { ...step, seq: h.nextSeq }];
  const excess = Math.max(0, appended.length - HISTORY_LIMIT);
  const truncatedSeqs = appended.slice(0, excess).map((s) => s.seq);
  const steps = appended.slice(excess);
  return {
    history: {
      steps,
      cursor: steps.length,
      nextSeq: h.nextSeq + 1,
      truncatedThroughSeq: truncatedSeqs.at(-1) ?? h.truncatedThroughSeq,
    },
    seq: h.nextSeq,
    discardedSeqs,
    truncatedSeqs,
  };
}

/** Abschnitt B3: seq 0, seq ≤ truncatedThroughSeq oder unter steps[0..cursor). */
export function isStepApplied(h: HistoryState, seq: number): boolean {
  return (
    seq === 0 ||
    seq <= h.truncatedThroughSeq ||
    h.steps.slice(0, h.cursor).some((s) => s.seq === seq)
  );
}

/** Sichtbarkeit einer Stand-Aufzeichnung (AR0-45; Abschnitt B3). */
export function isRecordVisible(
  h: HistoryState,
  r: { readonly seq: number; readonly hiddenBySeq: number | null },
): boolean {
  return isStepApplied(h, r.seq) && (r.hiddenBySeq === null || !isStepApplied(h, r.hiddenBySeq));
}

/** Abschnitt B4: inverse Patches des Schritts steps[cursor − 1]; null ohne angewendeten Schritt. */
export function undo(
  plan: Plan,
  h: HistoryState,
): { readonly plan: Plan; readonly history: HistoryState; readonly step: HistoryStep } | null {
  if (h.cursor === 0) return null;
  const step = h.steps[h.cursor - 1];
  if (step === undefined) throw new RangeError('Ungültiger Historiencursor.');
  return {
    plan: applyPatches(plan, step.inversePatches),
    history: { ...h, cursor: h.cursor - 1 },
    step,
  };
}

/** Abschnitt B4: Patches des Schritts steps[cursor]; null ohne Redo-Zweig. */
export function redo(
  plan: Plan,
  h: HistoryState,
): { readonly plan: Plan; readonly history: HistoryState; readonly step: HistoryStep } | null {
  if (h.cursor === h.steps.length) return null;
  const step = h.steps[h.cursor];
  if (step === undefined) throw new RangeError('Ungültiger Historiencursor.');
  return { plan: applyPatches(plan, step.patches), history: { ...h, cursor: h.cursor + 1 }, step };
}

/**
 * Ein Schritt, der das ganze Dokument ersetzt (Abschnitt B5a; restore, replaceFromFile, Nachtragen nach
 * quotaExceeded in E1-11): Wurzel-Ersatz als Patch, betroffen ist der ganze Plan (alle Einträge und Tage);
 * strukturell gleich → leere Patches und Listen, plan === before.
 */
export function rootReplaceResult(before: Plan, after: Plan, label: string): CommandResult {
  if (structurallyEqual(before, after)) {
    return {
      plan: before,
      patches: [],
      inversePatches: [],
      label,
      affectedDates: [],
      affectedEntryIds: [],
    };
  }
  return {
    plan: after,
    patches: [{ op: 'replace', path: [], value: after }],
    inversePatches: [{ op: 'replace', path: [], value: before }],
    label,
    affectedEntryIds: [
      ...new Set([...Object.keys(before.entries), ...Object.keys(after.entries)]),
    ].sort(),
    affectedDates: [
      ...new Set([...before.weeks, ...after.weeks].flatMap((w) => weekDates(w.startDate))),
    ].sort(),
  };
}

/** Schnitt bei der Schema-Migration (Abschnitt B6): Redo-Zweig verwerfen, alle angewendeten Schritte kürzen. */
export function cutHistory(h: HistoryState): HistoryChange {
  const truncatedSeqs = h.steps.slice(0, h.cursor).map((s) => s.seq);
  return {
    discardedSeqs: h.steps.slice(h.cursor).map((s) => s.seq),
    truncatedSeqs,
    history: {
      steps: [],
      cursor: 0,
      nextSeq: h.nextSeq,
      truncatedThroughSeq: Math.max(h.truncatedThroughSeq, truncatedSeqs.at(-1) ?? 0),
    },
  };
}
