// @vitest-environment jsdom
// F-UX1 «Stand» (Entscheid des Auftraggebers vom 19.10.2026 «Stand: ja»; ADR-006 Änderungsnotiz F-UX1): Ein mit
// «Neuen Stand setzen» gesetzter Stand ist eine Grenze der Undo-Historie. Undo an der Grenze lehnt mit Meldung ab
// und schreibt nichts; Stände und ihre PDF werden nie durch Verwerfen eines Redo-Zweigs gelöscht; eine Version, die
// ein sichtbarer Stand schon trägt, wird nicht ein zweites Mal vergeben (R-5.5-03). Speicher aus fake-indexeddb.
// Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  listStands,
  type StandRenderers,
  StandVersionError,
  setNewStand,
} from '../../../../src/io/wap-plan/standStore';
import { type PlanStore, StorageError } from '../../../../src/io/wap-plan/store';
import { neuerStore } from '../../support/stand/ablauf';
import { PLAN_ID } from '../../support/stand/plan';
import { dbHash, neueFabrik, neuLaden, oeffnen } from '../../support/storage/datenbank';
import { A, ctx, DATUM, motto, planA, speichern, standSetzen } from '../../support/storage/plaene';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

const GRENZE = 'Ein gesetzter Stand lässt sich nicht rückgängig machen';

/** Fiktive PDF-Bytes je Variante (Inhalt aus Titel und Woche, damit verschiedene Stände verschiedene Bytes haben). */
const bytes = (text: string): Uint8Array =>
  Uint8Array.from(Array.from(text, (c) => c.charCodeAt(0) & 0xff));
const RENDER: StandRenderers = {
  week: async (_plan, weekId, title) => bytes(`%PDF-fiktiv ${weekId} ${title}`),
  plan: async (_plan, title) => bytes(`%PDF-fiktiv plan ${title}`),
};

function stand(store: PlanStore, uhr: TestUhr, version?: number) {
  return setNewStand(
    store,
    A,
    { date: DATUM, ...(version === undefined ? {} : { version }) },
    RENDER,
    uhr,
    { ctx },
  );
}

async function grenzeAbgelehnt(p: Promise<unknown>): Promise<void> {
  const e = await p.then(
    () => null,
    (error: unknown) => error,
  );
  expect(e).toBeInstanceOf(StorageError);
  const f = e as StorageError;
  expect(f.code).toBe('standNotUndoable');
  expect(f.userMessage.cause.startsWith(GRENZE)).toBe(true);
  expect(f.userMessage.nextStep).toContain('Wiederherstellungspunkte');
}

async function neu(): Promise<{ f: IDBFactory; store: PlanStore; uhr: TestUhr }> {
  const f = neueFabrik();
  const store = await oeffnen(f);
  const uhr = new TestUhr(zeitpunkt('2026-10-14', 9));
  await store.create(planA(), uhr);
  return { f, store, uhr };
}

describe('F-UX1: «Neuen Stand setzen» ist eine Grenze der Undo-Historie', () => {
  it('[R-5.5-04][R-5.6-14] nach dem Stand keine Undo-Schritte; Undo lehnt mit standNotUndoable ab und schreibt nichts; Stand und Änderung davor bleiben, auch nach Neuladen', async () => {
    const { f, store: s0, uhr } = await neu();
    let store = s0;
    await speichern(store, A, motto('Vor dem Stand (fiktiv)'), uhr);
    const r = await stand(store, uhr);
    const geladen = await store.load(A);
    expect(geladen?.history.cursor).toBe(0);
    expect(geladen?.history.steps).toEqual([]);
    expect(geladen?.history.truncatedThroughSeq).toBe(r.seq);
    expect(geladen?.plan.stand).toEqual({ date: DATUM, version: 1 });
    expect(geladen?.plan.motto).toBe('Vor dem Stand (fiktiv)');
    const vorher = await dbHash(f);
    await grenzeAbgelehnt(store.undo(A, uhr));
    expect(await dbHash(f)).toBe(vorher);
    store = await neuLaden(store, f);
    await grenzeAbgelehnt(store.undo(A, uhr));
    expect(await dbHash(f)).toBe(vorher);
    expect((await listStands(store, A)).map((x) => x.standId)).toEqual([r.standId]);
    store.close();
  });

  it('[R-5.5-06][R-5.6-14] Änderungen nach dem Stand sind rückgängig machbar bis zur Grenze; das Verwerfen ihres Redo-Zweigs lässt Aufzeichnung und PDF-Bytes unverändert sichtbar', async () => {
    const { store, uhr } = await neu();
    const r = await stand(store, uhr);
    await speichern(store, A, motto('Nach dem Stand 1 (fiktiv)'), uhr);
    await speichern(store, A, motto('Nach dem Stand 2 (fiktiv)'), uhr);
    expect(await store.undo(A, uhr)).not.toBeNull();
    expect(await store.undo(A, uhr)).not.toBeNull();
    await grenzeAbgelehnt(store.undo(A, uhr));
    expect((await store.load(A))?.plan.stand?.version).toBe(1);
    // Neue Änderung verwirft den Redo-Zweig mit beiden Schritten.
    await speichern(store, A, motto('Neuer Zweig (fiktiv)'), uhr);
    expect((await store.load(A))?.history.steps).toHaveLength(1);
    const records = await store.standRecords(A);
    expect(records).toHaveLength(1);
    expect(records[0]?.visible).toBe(true);
    expect([...(records[0]?.pdfs ?? new Map()).entries()]).toEqual([...r.pdfs.entries()]);
    store.close();
  });

  it('[R-5.6-09][R-5.6-14] Wiederherstellen nach dem Stand ist ein gewöhnlicher Schritt: rückgängig machbar, danach wieder die Grenze', async () => {
    const { store, uhr } = await neu();
    await stand(store, uhr);
    const punkt = (await store.listRestorePoints(A)).find((p) => p.reason === 'stand');
    if (punkt === undefined) throw new Error('Punkt «vor Stand» fehlt');
    await store.restore(A, punkt.id, uhr);
    expect((await store.load(A))?.plan.stand).toBeNull();
    const zurueck = await store.undo(A, uhr);
    expect(zurueck?.plan.stand?.version).toBe(1);
    await grenzeAbgelehnt(store.undo(A, uhr));
    store.close();
  });

  it('[R-5.6-14] commitAtomic ohne Grenze (Import mit erstem Stand, Vertrag E1-04) bleibt rückgängig machbar', async () => {
    const { store, uhr } = await neu();
    await standSetzen(store, A, uhr, { standId: 'stand-ohne-grenze', importReport: { n: 1 } });
    const r = await store.undo(A, uhr);
    expect(r?.plan.stand).toBeNull();
    store.close();
  });

  it('[R-5.5-04] setNewStand verlangt die Grenze im Schreibauftrag (undoBoundary)', async () => {
    const double = neuerStore();
    await setNewStand(double, PLAN_ID, { date: DATUM }, RENDER, uhrFest(), { ctx });
    expect(double.commits()[0]?.write?.undoBoundary).toBe(true);
  });
});

function uhrFest(): TestUhr {
  return new TestUhr(zeitpunkt('2026-10-14', 10));
}

describe('F-UX1: Versionsnummer eindeutig nach Wiederherstellen (R-5.5-03)', () => {
  it('[R-5.5-03] Stand V1, Wiederherstellen «vor Stand V1», Stand mit Version 1 → Fehler versionInUse, nichts geschrieben; Version 2 → beide Stände sichtbar', async () => {
    const { f, store, uhr } = await neu();
    const v1 = await stand(store, uhr);
    const punkt = (await store.listRestorePoints(A)).find((p) => p.reason === 'stand');
    if (punkt === undefined) throw new Error('Punkt «vor Stand» fehlt');
    await store.restore(A, punkt.id, uhr);
    const vorher = await dbHash(f);
    const e = await stand(store, uhr, 1).then(
      () => null,
      (error: unknown) => error,
    );
    expect(e).toBeInstanceOf(StandVersionError);
    expect((e as StandVersionError).code).toBe('versionInUse');
    expect((e as StandVersionError).userMessage.nextStep).toContain('Version');
    expect(await dbHash(f)).toBe(vorher);
    const v2 = await stand(store, uhr, 2);
    expect((await listStands(store, A)).map((x) => [x.standId, x.version])).toEqual([
      [v2.standId, 2],
      [v1.standId, 1],
    ]);
    store.close();
  });
});
