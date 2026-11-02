// @vitest-environment node
// Paket H-LAYOUT, Befund SA-H-14 (R-5.2-01, R-4.9-19, R-10-54, R-10-55; Beschrieb 4.4): «Neuer Plan aus Vorlage»
// startet ohne Befund – Spaltensätze je Wochentyp aus der Kp-Vorlage (KVK Mo–Di «KVK Stufen», Mi–Fr «KVK Mi–Fr»,
// Wochenende kompakt; in jeder Woche gleich), und zweistellige Beso-Nummern passen in die Beso-Spalte eines
// vollen Tages. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { addDays } from '../../../../src/model/wap/calendar';
import { runChecks } from '../../../../src/model/wap/checks/run';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import {
  applyNewPlanDays,
  builtInTemplates,
  kpTemplate,
  type LevelTemplate,
} from '../../../../src/model/wap/template';
import type { Beso, Plan } from '../../../../src/model/wap/types';
import { beso, win, withEntries } from '../../support/model/builders';

const OPTS = { paper: 'A4' as const, showStatus: true, templates: builtInTemplates() };
const START = '2026-09-28';

function neuerPlan(weekCount: number, template: LevelTemplate = kpTemplate()): Plan {
  const p = createPlanFromTemplate(template, { planId: 'p-neu', startDate: START, weekCount });
  return applyNewPlanDays(p, template);
}

function befunde(plan: Plan) {
  return runChecks({ plan, layoutFor: (id) => layoutWeekPage(plan, id, OPTS) });
}

function tage(plan: Plan, w: number): string[] {
  const names = new Map(plan.columnSets.map((s) => [s.id, s.name]));
  return (plan.weeks[w]?.days ?? []).map(
    (d) => `${d.weekday}:${names.get(d.columnSetId ?? '') ?? '-'}:${d.display}`,
  );
}

describe('Neuer Plan aus Vorlage (SA-H-14)', () => {
  it('[R-5.2-01][R-10-54] neuer Kp-Plan mit 1 bis 6 Wochen: 0 Befunde (kein «zu viele Spalten», kein P8)', () => {
    for (let n = 1; n <= 6; n++) expect(befunde(neuerPlan(n)), `${n} Wochen`).toEqual([]);
  });

  it('[R-4.9-19] Tage nach Wochentyp: KVK Mo–Di «KVK Stufen», Mi–Fr «KVK Mi–Fr», Sa–So «Wochenende kompakt» kompakt, in jeder Woche gleich', () => {
    const p = neuerPlan(3);
    for (const w of [0, 1, 2]) {
      expect(tage(p, w), `Woche ${w + 1}`).toEqual([
        'Mo:KVK Stufen:full',
        'Di:KVK Stufen:full',
        'Mi:KVK Mi–Fr:full',
        'Do:KVK Mi–Fr:full',
        'Fr:KVK Mi–Fr:full',
        'Sa:Wochenende kompakt:compact',
        'So:Wochenende kompakt:compact',
      ]);
    }
  });

  it('[R-4.9-19] Vorlage ohne Vorbelegung: alle Tage mit dem ersten Spaltensatz, voll; unbekannter Name lässt den Tag leer', () => {
    const { newPlanDays: _weg, ...ohne } = kpTemplate();
    expect(tage(neuerPlan(1, ohne), 0).every((t) => t.endsWith(':KVK Stufen:full'))).toBe(true);
    const preset = kpTemplate().newPlanDays;
    expect(preset).toBeDefined();
    if (preset === undefined) return;
    const fremd: LevelTemplate = {
      ...kpTemplate(),
      newPlanDays: { ...preset, Mo: { columnSetName: 'Gibt es nicht', display: 'full' } },
    };
    expect(tage(neuerPlan(1, fremd), 0)[0]).toBe('Mo:-:full');
  });

  it('[R-10-55] Beso-Nummern 10–79 (je Tag zehn) im neuen Plan: alle in ihrem Kästchen, kein «neben dem Kästchen», keine Befunde', () => {
    const p = neuerPlan(1);
    const kp = p.legend.find((c) => c.name === 'Ltg Kp')?.id ?? '';
    const besos: Beso[] = [];
    let n = 10;
    for (let d = 0; d < 7 && n < 80; d++) {
      for (let k = 0; k < 10 && n < 80; k++, n++) {
        besos.push(
          beso(`b${n}`, n, {
            date: addDays(START, d),
            categoryId: kp,
            besoNumber: n,
            windows: [win(`t${n}`, { time: { form: 'point', at: 360 + k * 90 } })],
          }),
        );
      }
    }
    const plan = withEntries(p, besos);
    const L = layoutWeekPage(plan, plan.weeks[0]?.id ?? '', OPTS);
    expect(L.fallbacks.filter((e) => e.kind === 'labelOutside')).toEqual([]);
    expect(befunde(plan)).toEqual([]);
    const nummern = L.grid.items
      .filter((i) => i.kind === 'text' && i.entryId?.startsWith('b'))
      .map((i) => (i.kind === 'text' ? i.runs.map((r) => r.text).join('') : ''));
    for (let i = 10; i < 80; i++) expect(nummern).toContain(String(i));
  });
});
