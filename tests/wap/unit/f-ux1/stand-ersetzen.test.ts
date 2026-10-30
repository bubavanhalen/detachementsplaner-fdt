// @vitest-environment jsdom
// F-UX1 Runde 2, CR-D-2-01 (code-reviewer Daten Runde 2, blockierend): Ein früherer Stand, den «Ersetzen» aus einer
// Plan-Datei ausgeblendet hat, ging beim nächsten «Neuen Stand setzen» (Undo-Grenze) samt PDF endgültig verloren.
// Regel (ADR-006 Änderungsnotiz F-UX1 Runde 2): Der Wiederherstellungspunkt «vor Ersetzen» enthält die sichtbaren
// Stände samt PDF; «Wiederherstellen» macht fehlende davon wieder sichtbar (bytegleich, auch nach Neuladen), als
// gewöhnlicher, rückgängig machbarer Schritt. Speicher aus fake-indexeddb. Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  listStands,
  type SetNewStandResult,
  type StandRenderers,
  setNewStand,
  standPdf,
} from '../../../../src/io/wap-plan/standStore';
import type { PlanStore } from '../../../../src/io/wap-plan/store';
import type { Id } from '../../../../src/model/wap/types';
import { neueFabrik, neuLaden, oeffnen } from '../../support/storage/datenbank';
import { A, ctx, DATUM, planA, planDatei } from '../../support/storage/plaene';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

const bytes = (text: string): Uint8Array =>
  Uint8Array.from(Array.from(text, (c) => c.charCodeAt(0) & 0xff));
const RENDER: StandRenderers = {
  week: async (_plan, weekId, title) => bytes(`%PDF-fiktiv ${weekId} ${title}`),
  plan: async (_plan, title) => bytes(`%PDF-fiktiv plan ${title}`),
};

async function aufbau(): Promise<{
  f: IDBFactory;
  store: PlanStore;
  uhr: TestUhr;
  v1: SetNewStandResult;
}> {
  const f = neueFabrik();
  const store = await oeffnen(f);
  const uhr = new TestUhr(zeitpunkt('2026-10-14', 9));
  await store.create(planA(), uhr);
  const v1 = await setNewStand(store, A, { date: DATUM }, RENDER, uhr, { ctx });
  // Ersetzen durch eine Datei desselben Plans ohne V1 (z.B. ältere Sicherung eines anderen Geräts): V1 ausgeblendet.
  const geladen = await store.load(A);
  if (geladen === null) throw new Error('Testaufbau: Plan fehlt');
  await store.replaceFromFile(A, planDatei({ ...geladen.plan, stand: null }, { stands: [] }), uhr);
  expect((await listStands(store, A)).map((s) => s.standId)).toEqual([]);
  return { f, store, uhr, v1 };
}

async function vorErsetzen(store: PlanStore): Promise<Id> {
  const punkt = (await store.listRestorePoints(A)).find((p) => p.reason === 'fileReplace');
  if (punkt === undefined) throw new Error('Punkt «vor Ersetzen» fehlt');
  return punkt.id;
}

async function gleichesPdf(store: PlanStore, v1: SetNewStandResult): Promise<void> {
  for (const [variante, erwartet] of v1.pdfs) {
    const target =
      variante === 'plan'
        ? ({ kind: 'plan' } as const)
        : ({ kind: 'week', weekId: variante } as const);
    expect([...(await standPdf(store, A, v1.standId, target)).bytes], variante).toEqual([
      ...erwartet,
    ]);
  }
}

describe('F-UX1 Runde 2 (CR-D-2-01): Stände eines ersetzten Plans gehen nie verloren', () => {
  it('[R-5.5-06][R-5.6-09] Stand V1, Ersetzen ohne V1, Stand V2 (Grenze): «Wiederherstellen» des Punkts «vor Ersetzen» macht V1 wieder sichtbar, PDF bytegleich, auch nach Neuladen', async () => {
    const { f, store: s0, uhr, v1 } = await aufbau();
    let store = s0;
    const v2 = await setNewStand(store, A, { date: DATUM, version: 2 }, RENDER, uhr, { ctx });
    expect((await listStands(store, A)).map((s) => s.standId)).toEqual([v2.standId]);
    await store.restore(A, await vorErsetzen(store), uhr);
    expect((await listStands(store, A)).map((s) => [s.standId, s.version])).toEqual([
      [v2.standId, 2],
      [v1.standId, 1],
    ]);
    expect((await store.load(A))?.plan.stand?.version).toBe(1);
    await gleichesPdf(store, v1);
    store = await neuLaden(store, f);
    await gleichesPdf(store, v1);
    store.close();
  });

  it('[R-5.6-09][R-5.6-14] das Wiederherstellen ist ein gewöhnlicher Schritt: Undo blendet V1 wieder aus, Redo zeigt es; der Punkt «vor Ersetzen» bleibt', async () => {
    const { store, uhr, v1 } = await aufbau();
    const id = await vorErsetzen(store);
    await store.restore(A, id, uhr);
    expect((await listStands(store, A)).map((s) => s.standId)).toEqual([v1.standId]);
    await store.undo(A, uhr);
    expect((await listStands(store, A)).map((s) => s.standId)).toEqual([]);
    await store.redo(A, uhr);
    expect((await listStands(store, A)).map((s) => s.standId)).toEqual([v1.standId]);
    await gleichesPdf(store, v1);
    expect((await store.listRestorePoints(A)).some((p) => p.id === id)).toBe(true);
    store.close();
  });

  it('[R-5.6-09] ein Stand, der beim Wiederherstellen schon sichtbar ist, wird nicht verdoppelt', async () => {
    const { store, uhr, v1 } = await aufbau();
    await store.undo(A, uhr);
    expect((await listStands(store, A)).map((s) => s.standId)).toEqual([v1.standId]);
    const vorher = (await store.standRecords(A)).length;
    await store.restore(A, await vorErsetzen(store), uhr);
    expect((await store.standRecords(A)).length).toBe(vorher);
    expect((await listStands(store, A)).map((s) => s.standId)).toEqual([v1.standId]);
    store.close();
  });
});
