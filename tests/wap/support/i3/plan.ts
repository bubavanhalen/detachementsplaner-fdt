// Testhilfen I3 (Schnellspur AE-005/AE-006): fiktiver Kp-Plan aus der Vorlage wie in der App («Neuer Plan aus
// Vorlage»: erster Spaltensatz an allen Tagen), Befehle anwenden, Undo über die inversen Patches. Ohne Layout-
// Schicht, damit auch die E2E-Tests (Node-Lader von Playwright) sie laden können.
// Nur fiktive Daten.
import { applyPatches } from 'immer';
import type { CommandContext, CommandResult } from '../../../../src/model/wap/commands/command';
import { setDayColumnSet } from '../../../../src/model/wap/commands/days';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import type { Column, Id, Plan, Weekday } from '../../../../src/model/wap/types';

export const CTX: CommandContext = { templates: builtInTemplates() };

/** Fiktiver Kp-Plan: Montag 28.09.2026, `weeks` Wochen, Spaltensatz «KVK Stufen» an allen Tagen. */
export function kpPlan(weeks = 3, startDate = '2026-09-28'): Plan {
  let plan = createPlanFromTemplate(kpTemplate(), {
    planId: 'i3-test-plan',
    startDate,
    weekCount: weeks,
  });
  plan = { ...plan, exerciseName: 'Übung Beispiel' };
  const set = plan.columnSets[0];
  if (set !== undefined)
    for (const w of plan.weeks)
      plan = setDayColumnSet(
        plan,
        w.id,
        ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'],
        set.id,
        CTX,
      ).plan;
  return plan;
}

export function weekId(plan: Plan, index: number): Id {
  const w = plan.weeks[index];
  if (w === undefined) throw new Error(`Woche ${index} fehlt`);
  return w.id;
}

/** Undo eines Befehls: inverse Patches auf das Ergebnis (wie die Historie, E1-04). */
export function undo(result: CommandResult): Plan {
  return applyPatches(result.plan, [...result.inversePatches]);
}

export function columnsOf(plan: Plan, weekIndex: number, weekday: Weekday): readonly Column[] {
  const w = plan.weeks[weekIndex];
  const setId = w?.days.find((d) => d.weekday === weekday)?.columnSetId;
  return plan.columnSets.find((s) => s.id === setId)?.columns ?? [];
}
