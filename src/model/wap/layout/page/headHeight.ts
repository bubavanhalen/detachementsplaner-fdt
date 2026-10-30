// Höhe der Spaltenkopfzeile einer Woche (F-LAYOUT2 Punkt 11, Entscheid Auftraggeber 19.10.2026 «11: ja»; Q-HL-01;
// R-10-54; Beschrieb 10 «Raster», «Schrift»). Passt ein Spaltenkopf auch in Mindestgrösse nicht in den Kopfbereich
// (er ragte nach E1-02l R1 ins Band), wächst die Kopfzeile der ganzen Woche einheitlich, bis an jedem Tag alle Köpfe
// im Kopfbereich liegen; das Raster beginnt tiefer, Rasterrahmen und Seite bleiben. Rein (R-L-02).

import { dayColumns, requireWeek } from '../../derive/columns';
import type { LevelTemplate } from '../../template';
import type { Id, Plan, Week } from '../../types';
import { dayGeometries } from '../grid/layout';
import { headsFit } from './columnHeads';
import { dayHeadSetup } from './headInputs';
import type { PageFrame, PageGeometry } from './types';

/** Schritt der Höhe in pt. */
const STEP_PT = 0.25;

/** Kleinstes k in (lo, hi] mit ok(k), wenn ok(lo) falsch und ok(hi) wahr ist (mehr Höhe gibt nie weniger Platz). */
function smallest(lo: number, hi: number, ok: (k: number) => boolean): number {
  let a = lo;
  let b = hi;
  while (b - a > 1) {
    const mid = (a + b) >> 1;
    if (ok(mid)) b = mid;
    else a = mid;
  }
  return b;
}

/**
 * Kopfhöhe der Woche: die Standardhöhe `frame.grid.columnHeaderHeightPt`, solange an jedem Tag alle Köpfe im
 * Kopfbereich liegen (in ihrer Spalte oder nach H-LAYOUT daneben). Ragte an einem Tag ein Kopf hinaus, gilt die
 * kleinste Höhe in 0,25-pt-Schritten, bei der dort jeder Kopf ganz in seiner Spalte steht (ohne zeichenweisen
 * Notumbruch), höchstens um den Unterschied der beiden Kopfhöhen der Vorlage (senkrecht − waagrecht, B-Kp-10)
 * grösser. Ist das an einem Tag auch so nicht erreichbar, bleibt dieser Tag beim Befund «zu viele Spalten für diesen
 * Tag» (E1-02l R1) und bestimmt die Höhe nicht.
 */
export function weekColumnHeaderHeight(
  geometry: PageGeometry,
  template: LevelTemplate,
  plan: Plan,
  weekId: Id,
  frame: PageFrame,
): number {
  const week = requireWeek(plan, weekId);
  // Zwischenspeicher: das Ergebnis hängt nur von Woche, Spaltensätzen, Vorlage und Seitengeometrie ab (alle
  // unveränderlich; der Rahmen folgt aus Geometrie, Woche und Spaltensätzen).
  const bySets = cache.get(week) ?? new WeakMap();
  cache.set(week, bySets);
  const byTemplate = bySets.get(plan.columnSets) ?? new WeakMap();
  bySets.set(plan.columnSets, byTemplate);
  const byGeometry = byTemplate.get(template) ?? new WeakMap();
  byTemplate.set(template, byGeometry);
  const known = byGeometry.get(geometry);
  if (known !== undefined) return known;
  const height = compute(geometry, template, plan, week, frame);
  byGeometry.set(geometry, height);
  return height;
}

type Cache = WeakMap<
  Week,
  WeakMap<Plan['columnSets'], WeakMap<LevelTemplate, WeakMap<PageGeometry, number>>>
>;
const cache: Cache = new WeakMap();

function compute(
  geometry: PageGeometry,
  template: LevelTemplate,
  plan: Plan,
  week: Week,
  frame: PageFrame,
): number {
  const weekId = week.id;
  const g = frame.grid;
  const base = g.columnHeaderHeightPt;
  const hh = geometry.heightsH;
  const steps = Math.ceil(
    (Math.max(0, hh.columnHeaderVertical - hh.columnHeaderHorizontal) * frame.h) / STEP_PT - 1e-9,
  );
  if (steps === 0) return base;
  const sizes = { standard: template.fontSizes.standard, min: template.fontSizes.min };
  const yHead = g.rect.y + g.dayHeaderHeightPt;
  const days = dayGeometries(
    plan,
    week,
    g.rect.x + g.timeAxisWidthPt,
    g.rect.w - 2 * g.timeAxisWidthPt,
  );
  const heightAt = (k: number): number => base + k * STEP_PT;
  let need = 0;
  for (const day of days) {
    const columns = dayColumns(plan, weekId, day.weekday);
    const status = (k: number) => {
      const s = dayHeadSetup(
        g.lines,
        geometry.pageLines.dayHeadBottom,
        template.fontSizes,
        day,
        columns,
        yHead,
        yHead + heightAt(k),
      );
      return headsFit(s.inputs, s.area, sizes);
    };
    const inColumns = (k: number): boolean => status(k) === 'columns';
    const inArea = (k: number): boolean => status(k) !== 'none';
    // Bedarf nur, wo ein Kopf in der Standardhöhe aus dem Kopfbereich ragte (ins Band bzw. Raster).
    if (inArea(0) || inColumns(need)) continue;
    // Dann wächst die Kopfzeile, bis jeder Kopf ganz in seiner Spalte steht (ohne zeichenweisen Notumbruch, kein
    // Befund «zu viele Spalten»). Ist das auch in der grössten Höhe nicht erreichbar, bleibt dieser Tag bei E1-02l R1.
    if (inColumns(steps)) need = smallest(need, steps, inColumns);
  }
  return heightAt(need);
}
