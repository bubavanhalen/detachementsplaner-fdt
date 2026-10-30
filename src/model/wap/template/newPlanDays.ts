// Tage eines Plans aus «Neuer Plan aus Vorlage» (Paket H-LAYOUT, Befund SA-H-14; Beschrieb 4.4, R-5.2-01). Rein.
// createPlanFromTemplate lässt die Tage ohne Spaltensatz (P-6); diese Funktion setzt danach Spaltensatz und
// Darstellung nach der Vorlage, damit ein frischer Plan ohne Befund startet.

import type { DayConfig, Plan, Week } from '../types';
import type { LevelTemplate, TemplateDayPreset } from './types';

/**
 * Spaltensatz (über den Namen, erster Treffer) und Darstellung je Tag nach `template.newPlanDays`, gleich für jede
 * Woche. Ohne Vorbelegung: alle Tage mit dem ersten Spaltensatz des Plans, voll.
 * Ein Name ohne Spaltensatz im Plan lässt den Tag unverändert.
 */
export function applyNewPlanDays(plan: Plan, template: LevelTemplate): Plan {
  const preset = template.newPlanDays;
  const first = plan.columnSets[0];
  const setId = (name: string): string | null =>
    plan.columnSets.find((s) => s.name === name)?.id ?? null;
  const dayOf = (d: DayConfig, p: TemplateDayPreset | undefined): DayConfig => {
    if (p === undefined) {
      return first === undefined ? d : { ...d, columnSetId: first.id, display: 'full' };
    }
    const id = setId(p.columnSetName);
    return id === null ? d : { ...d, columnSetId: id, display: p.display };
  };
  const weeks = plan.weeks.map((w): Week => {
    // map erhält die Länge der sieben Tage.
    const days = w.days.map((d) => dayOf(d, preset?.[d.weekday])) as unknown as Week['days'];
    return { ...w, days };
  });
  return { ...plan, weeks };
}
