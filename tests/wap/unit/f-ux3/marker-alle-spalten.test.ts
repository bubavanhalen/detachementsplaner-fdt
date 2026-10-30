// @vitest-environment jsdom
// F-UX3 (Entscheid Auftraggeber 21.10.2026 «Marker sollen per se immer über alle Det-Spalten gehen»; Änderungsnotiz
// F-UX3 zu R-4.6-14/-15, R-7-07, R-7-10): Ein Marker gilt immer über alle Planungsspalten seines Tags. Gespeicherte
// Einzelspalten älterer Pläne bleiben in der Datei erhalten (verlustfrei), wirken aber nirgends: Zeichnung, Prüfung P1,
// Liste, Verschieben um Spalten. Fiktive Pläne.
import { describe, expect, it } from 'vitest';
import { parsePlanFile, serializePlanFile } from '../../../../src/io/wap-plan/planFile';
import { runChecks } from '../../../../src/model/wap/checks';
import { setDayColumnSet } from '../../../../src/model/wap/commands/days';
import { moveEntries } from '../../../../src/model/wap/commands/entries';
import { MARKER_COLUMNS } from '../../../../src/model/wap/derive/marker';
import type { WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import { listRows } from '../../../../src/model/wap/list';
import type { Marker, Plan } from '../../../../src/model/wap/types';
import { einTeil, MO as GMO, lege, nahe, rasterPlan, STD, X0 } from '../../support/grid/build';
import { add, CTX, column, kpPlan, MO } from '../../support/i5/plan';
import { marker } from '../../support/model/builders';

/** Alter Plan: Marker mit gespeicherter Einzelspalte (Zustand, wie er aus einer Plan-Datei kommen kann). */
function alterPlan(): { plan: Plan; id: string } {
  const base = kpPlan(1);
  const r = add(base, {
    type: 'marker',
    date: MO,
    at: 1260,
    kind: 'ABV',
    columns: { kind: 'all' },
  });
  const m = r.plan.entries[r.id] as Marker;
  const alt: Marker = { ...m, columns: { kind: 'ids', ids: [column(base, 1).id] } };
  return { plan: { ...r.plan, entries: { ...r.plan.entries, [r.id]: alt } }, id: r.id };
}

describe('F-UX3: Marker immer über alle Planungsspalten', () => {
  it('[R-4.6-15] wirksame Markerspalten sind «alle»', () => {
    expect(MARKER_COLUMNS).toEqual({ kind: 'all' });
  });

  it('[R-7-07] Zeichnung: Marker mit gespeicherter Spalte p2 läuft über alle drei Planungsspalten', () => {
    const L = lege(
      rasterPlan({
        entries: [
          marker('m1', 1, {
            date: GMO,
            at: 600,
            kind: 'HV',
            columns: { kind: 'ids', ids: [STD.p2] },
          }),
        ],
      }),
      { W: 180 },
    );
    const linie = einTeil(L, 'm1', 'markerLine');
    nahe(linie.rect.x, X0);
    nahe(linie.rect.w, 120);
  });

  it('[R-7-10] Prüfung: Marker mit gespeicherter Spalte, die es am Tag nicht gibt → kein P1', () => {
    const { plan } = alterPlan();
    const set = plan.columnSets[1];
    if (set === undefined) throw new Error('Spaltensatz fehlt');
    const anders = setDayColumnSet(plan, plan.weeks[0]?.id ?? '', ['Mo'], set.id, CTX).plan;
    const layoutFor = (_: string): WeekPageLayout =>
      ({ fallbacks: [] }) as unknown as WeekPageLayout;
    const p1 = runChecks({ plan: anders, layoutFor }).filter((f) => f.rule === 'P1');
    expect(p1).toEqual([]);
  });

  it('[R-4.6-15] Liste: Spalten «alle» auch bei gespeicherter Einzelspalte', () => {
    const { plan, id } = alterPlan();
    const row = listRows(plan, 'plan').find((r) => r.entryId === id);
    expect(row?.spalten).toBe('alle');
  });

  it('[R-4.6-15] Verschieben um eine Spalte: Marker eines alten Plans hindert nicht und bleibt unverändert', () => {
    const { plan, id } = alterPlan();
    const vorher = plan.entries[id];
    const r = moveEntries(plan, [id], { columnShift: 5 }, CTX);
    expect(r.plan.entries[id]).toEqual(vorher);
  });

  it('[R-4.6-15] verlustfrei: Sichern und Öffnen behält die gespeicherte Spaltenliste unverändert', () => {
    const { plan, id } = alterPlan();
    const bytes = serializePlanFile(
      { plan, revision: 1, modifiedAt: '2099-10-21T08:00:00.000Z', stands: [] },
      { now: () => new Date('2099-10-21T08:00:00Z') },
    );
    const m = parsePlanFile(bytes).plan.entries[id] as Marker;
    expect(m.columns).toEqual((plan.entries[id] as Marker).columns);
    expect(m.columns.kind).toBe('ids');
  });
});
