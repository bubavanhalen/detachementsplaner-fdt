// @vitest-environment jsdom
// Paket E1-04: Stand-Aufzeichnungen im Speicher – Port StandStore, Sichtbarkeit nach AR0-45 über Ersetzen, Undo und
// Redo, Sonderfall «Stand im Redo-Zweig und in der Datei», standsSameDay (Vertrag docs/wap-planer/plan/vertraege/
// E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte H, I1 Nr 6, I2 commitAtomic, standRecords, replaceFromFile,
// I3, J, L R-5.6-14 Nr 5–8; Änderungsnotiz E1-05 J1; Vertrag E1-05 Abschnitt E). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  listStands,
  type StandCommitWrite,
  type StandStore,
  standPdf,
} from '../../../../src/io/wap-plan/standStore';
import type { PlanStore } from '../../../../src/io/wap-plan/store';
import type { IsoDate } from '../../../../src/model/wap/types';
import {
  dbHash,
  neueFabrik,
  neuLaden,
  oeffnen,
  rohPunkte,
  werteVonPlan,
} from '../../support/storage/datenbank';
import { SPEICHER_MELDUNG } from '../../support/storage/meldungen';
import {
  A,
  dateiStand,
  motto,
  planA,
  planDatei,
  speichern,
  standAuftrag,
  standSetzen,
} from '../../support/storage/plaene';
import { gleich, gleicheBytes, speicherFehler, vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

async function sichtbar(store: PlanStore): Promise<string[]> {
  return (await listStands(store, A)).map((s) => s.standId).sort();
}

describe('Port StandStore (E1-05 Abschnitt E)', () => {
  it('[R-5.6-14][R-5.5-06] load, commitAtomic mit StandCommitWrite, standRecords: ein Punkt «stand», ein Schritt, Aufzeichnung unverändert, Bytes als Uint8Array', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const port: StandStore = store;
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await speichern(store, A, motto('Vorher (fiktiv)'), uhr);
    const r0 = vorhanden(await port.load(A));
    expect(r0.revision).toBe(1);
    const punkteVorher = (await rohPunkte(f, A)).filter((p) => p.reason === 'stand').length;
    const schritteVorher = vorhanden(await store.load(A)).history.steps.length;

    uhr.setze(zeitpunkt('2026-10-07', 10));
    const { result, standRecord } = standAuftrag(r0.plan, {
      standId: 'stand-port',
      recordId: 'rec-port',
      version: 4,
      standsSameDay: 2,
    });
    const auftrag: StandCommitWrite = {
      expectedRevision: r0.revision,
      result,
      restorePoint: 'stand',
      standRecord,
    };
    const s = await port.commitAtomic(A, auftrag, uhr);
    expect(s).toEqual({ savedAt: zeitpunkt('2026-10-07', 10), revision: 2, seq: 2 });

    const punkte = (await rohPunkte(f, A)).filter((p) => p.reason === 'stand');
    expect(punkte).toHaveLength(punkteVorher + 1);
    gleich(punkte.at(-1)?.plan, r0.plan, 'Punkt «stand» enthält das Dokument der Revision R0');
    expect(punkte.at(-1)?.standVersion).toBe(4);
    expect(punkte.at(-1)?.revision).toBe(1);
    const geladen = vorhanden(await store.load(A));
    expect(geladen.history.steps).toHaveLength(schritteVorher + 1);
    expect(geladen.history.steps.at(-1)?.label).toBe(result.label);
    expect(geladen.history.steps.at(-1)?.seq).toBe(s.seq);
    gleich(geladen.plan, result.plan);

    const records = await port.standRecords(A);
    expect(records).toHaveLength(1);
    const rec = vorhanden(records[0]);
    expect(rec.recordId).toBe('rec-port');
    expect(rec.standId).toBe('stand-port');
    expect(rec.planId).toBe(A);
    expect(rec.date).toBe(standRecord.date);
    expect(rec.version).toBe(4);
    expect(rec.standsSameDay).toBe(2);
    expect(rec.seq).toBe(s.seq);
    expect(rec.hiddenBySeq).toBeNull();
    expect(rec.visible).toBe(true);
    gleich(rec.plan, standRecord.snapshot, 'snapshot als plan');
    expect([...rec.pdfs.keys()]).toEqual([...standRecord.pdfs.keys()]);
    for (const [k, b] of standRecord.pdfs) {
      const gelesen = rec.pdfs.get(k);
      expect(gelesen, `Bytes ${k} sind Uint8Array (I1 Nr 6)`).toBeInstanceOf(Uint8Array);
      gleicheBytes(gelesen, b);
    }
    expect(rec.pdfs).toBeInstanceOf(Map);

    // Undo und Redo des commitAtomic-Schritts stellen das Dokument exakt her (TR-E104-07).
    gleich(vorhanden(await store.undo(A, uhr)).plan, r0.plan, 'undo = Dokument vor commitAtomic');
    expect((await port.standRecords(A)).map((r) => r.visible)).toEqual([false]);
    gleich(vorhanden(await store.redo(A, uhr)).plan, result.plan, 'redo = result.plan');
    expect((await port.standRecords(A)).map((r) => r.visible)).toEqual([true]);
  });

  it('[R-5.6-14] Port mit unbekanntem Plan: load null, standRecords [], commitAtomic planNotFound ohne Schreiben; vorhandene recordId → ConstraintError ohne Schreiben', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const d0 = (await store.create(planA(), uhr)).plan;
    await standSetzen(store, A, uhr, { standId: 'stand-1', recordId: 'rec-doppelt' });
    const hash = await dbHash(f);
    expect(await store.load('p-unbekannt')).toBeNull();
    expect(await store.standRecords('p-unbekannt')).toEqual([]);
    await speicherFehler(
      store.commitAtomic(
        'p-unbekannt',
        { expectedRevision: 0, restorePoint: 'stand', ...standAuftrag(d0, { standId: 's2' }) },
        uhr,
      ),
      'planNotFound',
      SPEICHER_MELDUNG.planNotFound,
    );
    const aktuell = vorhanden(await store.load(A));
    let fehler: unknown;
    try {
      await store.commitAtomic(
        A,
        {
          expectedRevision: aktuell.revision,
          restorePoint: 'stand',
          ...standAuftrag(aktuell.plan, { standId: 'stand-2', recordId: 'rec-doppelt' }),
        },
        uhr,
      );
    } catch (e: unknown) {
      fehler = e;
    }
    expect((fehler as { name?: unknown } | undefined)?.name, 'IndexedDB-Fehler unverändert').toBe(
      'ConstraintError',
    );
    expect(await dbHash(f), 'nichts geschrieben').toBe(hash);
  });
});

describe('Sichtbarkeit über Ersetzen, Undo und Redo (AR0-45)', () => {
  it('[R-5.6-14] lokaler Stand L, Datei mit Stand F: replaceFromFile {F}; undo {L}; undo von s {}; redo {L}; redo {F}; nach Neuladen an jeder Stelle gleich', async () => {
    const f = neueFabrik();
    let store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-L' });
    const datei = planDatei(planA(), {
      stands: [dateiStand(planA(), 'stand-F', { date: '2026-09-24' })],
    });

    const pruefe = async (soll: string[], schritt: string): Promise<void> => {
      expect(await sichtbar(store), schritt).toEqual(soll);
      store = await neuLaden(store, f);
      expect(await sichtbar(store), `${schritt} (nach Neuladen)`).toEqual(soll);
    };
    await pruefe(['stand-L'], 'vor dem Ersetzen');
    await store.replaceFromFile(A, datei, uhr);
    await pruefe(['stand-F'], 'nach dem Ersetzen');
    vorhanden(await store.undo(A, uhr));
    await pruefe(['stand-L'], 'Undo des Ersetzens');
    vorhanden(await store.undo(A, uhr));
    await pruefe([], 'Undo von s');
    vorhanden(await store.redo(A, uhr));
    await pruefe(['stand-L'], 'Redo von s');
    vorhanden(await store.redo(A, uhr));
    await pruefe(['stand-F'], 'Redo des Ersetzens');
  });

  it('[R-5.6-14] Stand X im Redo-Zweig, Datei enthält X → replaceFromFile: X als Datei-Aufzeichnung sichtbar, Bytes der Datei; undo → X nicht sichtbar', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-X' });
    vorhanden(await store.undo(A, uhr));
    expect(await sichtbar(store), 'X im Redo-Zweig nicht sichtbar').toEqual([]);

    const xDatei = dateiStand(planA(), 'stand-X');
    const e = await store.replaceFromFile(A, planDatei(planA(), { stands: [xDatei] }), uhr);
    expect(await sichtbar(store)).toEqual(['stand-X']);
    const records = await store.standRecords(A);
    const x = records.filter((r) => r.standId === 'stand-X' && r.visible);
    expect(x).toHaveLength(1);
    expect(x[0]?.seq, 'an den Ersetzen-Schritt gekoppelt').toBe(e.seq);
    for (const [k, b] of xDatei.pdfs) {
      const ziel =
        k === 'plan' ? ({ kind: 'plan' } as const) : ({ kind: 'week', weekId: k } as const);
      gleicheBytes((await standPdf(store, A, 'stand-X', ziel)).bytes, b);
    }
    vorhanden(await store.undo(A, uhr));
    expect(await sichtbar(store)).toEqual([]);
  });

  it('[R-5.6-14][R-6-12] Ersetzen und Undo des Ersetzens lassen standsSameDay jeder Aufzeichnung unverändert', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-L1', standsSameDay: 1 });
    await standSetzen(store, A, uhr, { standId: 'stand-L2', standsSameDay: 2 });
    const tag: IsoDate = '2026-09-24';
    const datei = planDatei(planA(), {
      stands: [
        dateiStand(planA(), 'stand-F1', { date: tag, version: 1, standsSameDay: 3 }),
        dateiStand(planA(), 'stand-F2', { date: tag, version: 2, standsSameDay: 5 }),
      ],
    });
    const soll: Record<string, number> = {
      'stand-L1': 1,
      'stand-L2': 2,
      'stand-F1': 3,
      'stand-F2': 5,
    };
    const pruefe = async (schritt: string): Promise<void> => {
      for (const r of await store.standRecords(A)) {
        expect(r.standsSameDay, `${schritt}: ${r.standId}`).toBe(soll[r.standId]);
      }
    };
    await store.replaceFromFile(A, datei, uhr);
    expect(await sichtbar(store)).toEqual(['stand-F1', 'stand-F2']);
    await pruefe('nach dem Ersetzen');
    vorhanden(await store.undo(A, uhr));
    expect(await sichtbar(store)).toEqual(['stand-L1', 'stand-L2']);
    await pruefe('nach Undo');
    vorhanden(await store.redo(A, uhr));
    await pruefe('nach Redo');
    expect((await store.standRecords(A)).map((r) => r.standId).sort()).toEqual(
      Object.keys(soll).sort(),
    );
    expect(await werteVonPlan(f, 'stands', A)).toHaveLength(4);
  });

  it('[R-5.6-14] replaceFromFile behält eine sichtbare lokale Aufzeichnung mit gleicher standId; der Punkt «fileReplace» und der Schritt entstehen auch bei gleichem Dokument', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const lokal = await standSetzen(store, A, uhr, { standId: 'stand-gleich' });
    const vorher = vorhanden(await store.load(A));
    const e = await store.replaceFromFile(
      A,
      planDatei(vorher.plan, { stands: [dateiStand(planA(), 'stand-gleich')] }),
      uhr,
    );
    expect(e.revision).toBe(vorher.revision + 1);
    expect(e.seq).toBe(lokal.seq + 1);
    gleich(e.plan, vorher.plan);
    const records = await store.standRecords(A);
    expect(records).toHaveLength(1);
    expect(records[0]?.recordId, 'lokale Aufzeichnung bleibt').toBe(lokal.standRecord.recordId);
    expect(records[0]?.hiddenBySeq).toBeNull();
    expect(records[0]?.visible).toBe(true);
    gleicheBytes(
      (await standPdf(store, A, 'stand-gleich', { kind: 'plan' })).bytes,
      lokal.standRecord.pdfs.get('plan'),
    );
    expect((await store.listRestorePoints(A)).map((p) => p.reason)).toContain('fileReplace');
  });
});
