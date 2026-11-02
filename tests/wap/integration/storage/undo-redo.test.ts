// @vitest-environment jsdom
// Paket E1-04: Rückgängig und Wiederholen über den Speicher (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz
// «Ausarbeitung Schritt 2» Abschnitte B5, G1, I1, I2, J, L R-5.6-14 Nr 1–4, 9, 10; Beschrieb 5.6 Punkt 6;
// Leitplanke 5; ADR-006 Punkt 2a, 2d; AR0-31, AR0-41; Änderungsnotizen E1-05 R1 V01 und R2 V12). Echter Speicher
// auf fake-indexeddb. Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { openPlanStore, type PlanStore } from '../../../../src/io/wap-plan/store';
import { updateColumnSet } from '../../../../src/model/wap/commands/columns';
import type { CommandResult } from '../../../../src/model/wap/commands/command';
import {
  moveEntries,
  updateEntries,
  updateEntry,
} from '../../../../src/model/wap/commands/entries';
import { addSubtask } from '../../../../src/model/wap/commands/subtasks';
import { EMPTY_HISTORY } from '../../../../src/model/wap/history/history';
import type { Plan } from '../../../../src/model/wap/types';
import {
  dbHash,
  neueFabrik,
  neuLaden,
  oeffnen,
  rohPunkt,
  werteVonPlan,
} from '../../support/storage/datenbank';
import { KONFLIKT, SPEICHER_MELDUNG } from '../../support/storage/meldungen';
import {
  A,
  ctx,
  erstes,
  importieren,
  leeresErgebnis,
  motto,
  planA,
  planDatei,
  speichern,
  standAuftrag,
  standSetzen,
  zaehlerErhoehen,
} from '../../support/storage/plaene';
import {
  bereichsFehler,
  gleich,
  speicherFehler,
  ungleich,
  vorhanden,
} from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

type Befehl = (p: Plan) => CommandResult;

const AENDERUNGSARTEN: readonly (readonly [string, Befehl])[] = [
  [
    'Einzeländerung (updateEntry)',
    (p) =>
      updateEntry(p, 'e101', 'block', { title: [{ text: 'Geändert (fiktiv)', bold: true }] }, ctx),
  ],
  [
    'Massenänderung (updateEntries)',
    (p) => updateEntries(p, ['e101', 'e111', 'e102'], { status: 'cancelled' }, ctx),
  ],
  [
    'Massenänderung (moveEntries)',
    (p) => moveEntries(p, ['e101', 'e111'], { deltaMinutes: 60 }, ctx),
  ],
  [
    'Spaltensatz (updateColumnSet)',
    (p) =>
      updateColumnSet(
        p,
        erstes(p.columnSets, 'Spaltensatz').id,
        { op: 'add', index: 0, column: { name: 'Zug 9 (fiktiv)', kind: 'planning' } },
        ctx,
      ),
  ],
  [
    'Teilaufgabe (addSubtask)',
    (p) =>
      addSubtask(
        p,
        'e101',
        {
          title: [{ text: 'Teilaufgabe (fiktiv)', bold: false }],
          ltg: 'Zfhr',
          ort: 'Platz (fiktiv)',
        },
        ctx,
      ),
  ],
];

async function neuerSpeicher(stunde = 9): Promise<{
  readonly f: IDBFactory;
  readonly store: PlanStore;
  readonly uhr: TestUhr;
  readonly d0: Plan;
}> {
  const f = neueFabrik();
  const store = await oeffnen(f);
  const uhr = new TestUhr(zeitpunkt('2026-10-07', stunde));
  const d0 = (await store.create(planA(), uhr)).plan;
  return { f, store, uhr, d0 };
}

describe('Undo und Redo je Änderungsart', () => {
  for (const [art, befehl] of AENDERUNGSARTEN) {
    for (const laden of [false, true]) {
      it(`[R-5.6-14] ${art}${laden ? ' mit Neuladen' : ''}: undo ergibt das Dokument davor, redo das danach`, async () => {
        const { f, uhr, d0, store: s0 } = await neuerSpeicher();
        let store = s0;
        const r = befehl(d0);
        expect(r.patches.length, 'Befehl ändert den Plan').toBeGreaterThan(0);
        const s = await store.commit(A, r, uhr);
        expect(s.seq).toBe(1);
        if (laden) store = await neuLaden(store, f);
        gleich(vorhanden(await store.load(A)).plan, r.plan, 'gespeichert = Ergebnis des Befehls');
        const u = vorhanden(await store.undo(A, uhr));
        gleich(u.plan, d0, 'undo = Dokument davor');
        if (laden) store = await neuLaden(store, f);
        gleich(vorhanden(await store.load(A)).plan, d0);
        const w = vorhanden(await store.redo(A, uhr));
        gleich(w.plan, r.plan, 'redo = Dokument danach');
        if (laden) store = await neuLaden(store, f);
        gleich(vorhanden(await store.load(A)).plan, r.plan);
        expect(vorhanden(await store.load(A)).history.steps[0]?.label).toBe(r.label);
      });
    }
  }

  for (const laden of [false, true]) {
    it(`[R-5.6-14] replaceFromFile${laden ? ' mit Neuladen' : ''}: undo ergibt das lokale Dokument, redo das der Datei`, async () => {
      const { f, uhr, store: s0 } = await neuerSpeicher();
      let store = s0;
      const lokal = (await speichern(store, A, motto('Lokal (fiktiv)'), uhr)).result.plan;
      const dateiPlan: Plan = { ...planA(), motto: 'Aus der Datei (fiktiv)', nextId: lokal.nextId };
      const e = await store.replaceFromFile(A, planDatei(dateiPlan), uhr);
      expect(e.seq).toBe(2);
      gleich(e.plan, dateiPlan);
      if (laden) store = await neuLaden(store, f);
      const u = vorhanden(await store.undo(A, uhr));
      gleich(u.plan, lokal);
      if (laden) store = await neuLaden(store, f);
      const w = vorhanden(await store.redo(A, uhr));
      gleich(w.plan, dateiPlan);
      expect(vorhanden(await store.load(A)).history.steps.at(-1)?.label).toBe(
        'Plan durch Datei ersetzt',
      );
    });

    it(`[R-5.6-14] restore${laden ? ' mit Neuladen' : ''}: undo ergibt das Dokument vor dem Wiederherstellen, redo das des Punkts`, async () => {
      const { f, uhr, d0, store: s0 } = await neuerSpeicher();
      let store = s0;
      const punkt = await store.createRestorePoint(A, 'import', uhr);
      const geaendert = (await speichern(store, A, motto('Nach dem Punkt (fiktiv)'), uhr)).result
        .plan;
      const r = await store.restore(A, punkt.id, uhr);
      gleich(r.plan, d0);
      if (laden) store = await neuLaden(store, f);
      const u = vorhanden(await store.undo(A, uhr));
      gleich(u.plan, geaendert);
      if (laden) store = await neuLaden(store, f);
      const w = vorhanden(await store.redo(A, uhr));
      gleich(w.plan, d0);
      expect(vorhanden(await store.load(A)).history.steps.at(-1)?.label).toBe(
        'Wiederherstellungspunkt wiederhergestellt',
      );
    });
  }
});

describe('nextId bei restore und replaceFromFile (AR0-31, AR0-41)', () => {
  it('[R-5.6-14] restore: Punkt mit kleinerem nextId → nextId bleibt (Maximum); mit grösserem → Wert des Punkts; undo stellt nextId exakt her', async () => {
    const { uhr, d0, store } = await neuerSpeicher();
    const klein = await store.createRestorePoint(A, 'import', uhr);
    const hoch = (await speichern(store, A, zaehlerErhoehen(7), uhr)).result.plan;
    expect(hoch.nextId).toBe(d0.nextId + 7);

    const r1 = await store.restore(A, klein.id, uhr);
    expect(r1.plan.nextId, 'Maximum aus aktuellem Dokument und Punkt').toBe(hoch.nextId);
    gleich(r1.plan, { ...d0, nextId: hoch.nextId });
    const u1 = vorhanden(await store.undo(A, uhr));
    expect(u1.plan.nextId).toBe(hoch.nextId);
    gleich(u1.plan, hoch);

    const gross = await store.createRestorePoint(A, 'import', uhr);
    const zurueck = vorhanden(await store.undo(A, uhr));
    expect(zurueck.plan.nextId).toBe(d0.nextId);
    const r2 = await store.restore(A, gross.id, uhr);
    expect(r2.plan.nextId, 'Wert des Punkts').toBe(hoch.nextId);
    const u2 = vorhanden(await store.undo(A, uhr));
    expect(u2.plan.nextId, 'undo exakt').toBe(d0.nextId);
    gleich(u2.plan, d0);
  });

  it('[R-5.6-14] replaceFromFile: Datei mit kleinerem nextId → nextId bleibt; mit grösserem → Wert der Datei; undo stellt nextId exakt her', async () => {
    const { uhr, d0, store } = await neuerSpeicher();
    const hoch = (await speichern(store, A, zaehlerErhoehen(5), uhr)).result.plan;
    const r1 = await store.replaceFromFile(
      A,
      planDatei({ ...d0, motto: 'Datei klein (fiktiv)' }),
      uhr,
    );
    expect(r1.plan.nextId).toBe(hoch.nextId);
    gleich(r1.plan, { ...d0, motto: 'Datei klein (fiktiv)', nextId: hoch.nextId });
    const u1 = vorhanden(await store.undo(A, uhr));
    gleich(u1.plan, hoch);

    const r2 = await store.replaceFromFile(
      A,
      planDatei({ ...d0, motto: 'Datei gross (fiktiv)', nextId: hoch.nextId + 20 }),
      uhr,
    );
    expect(r2.plan.nextId).toBe(hoch.nextId + 20);
    const u2 = vorhanden(await store.undo(A, uhr));
    expect(u2.plan.nextId).toBe(hoch.nextId);
    gleich(u2.plan, hoch);
  });
});

describe('Revisionsregel (Änderungsnotiz E1-05 R1 V01, I1 Nr 3)', () => {
  it('[R-5.6-14] create 0, commit +1, leerer commit ±0 ohne Schreiben, commitAtomic +1, undo/redo +1, undo ohne Schritt ±0', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const c = await store.create(planA(), uhr);
    expect(c.revision).toBe(0);
    expect(c.modifiedAt).toBe(zeitpunkt('2026-10-07', 9));
    expect(c.lastFileSaveAt).toBeNull();
    expect(c.copyCreatedAt).toBeNull();
    expect(c.history).toEqual(EMPTY_HISTORY);
    expect(await store.undo(A, uhr), 'undo ohne Schritt').toBeNull();
    expect(await store.redo(A, uhr), 'redo ohne Schritt').toBeNull();
    expect(vorhanden(await store.load(A)).revision).toBe(0);

    uhr.setze(zeitpunkt('2026-10-07', 10));
    const s1 = await speichern(store, A, motto('Eins (fiktiv)'), uhr);
    expect(s1.revision).toBe(1);
    const nach1 = vorhanden(await store.load(A));
    expect(nach1.revision).toBe(1);
    expect(nach1.modifiedAt).toBe(zeitpunkt('2026-10-07', 10));

    uhr.setze(zeitpunkt('2026-10-07', 11));
    const hash = await dbHash(f);
    const leer = await store.commit(A, leeresErgebnis(nach1.plan), uhr);
    expect(leer).toEqual({ savedAt: zeitpunkt('2026-10-07', 10), revision: 1, seq: 0 });
    expect(await dbHash(f), 'leerer commit schreibt nichts').toBe(hash);

    const atomar = await standSetzen(store, A, uhr, { standId: 'stand-1' });
    expect(atomar.revision).toBe(2);
    const u = vorhanden(await store.undo(A, uhr));
    expect(u.revision).toBe(3);
    expect(u.savedAt).toBe(zeitpunkt('2026-10-07', 11));
    expect(u.history.cursor).toBe(1);
    const w = vorhanden(await store.redo(A, uhr));
    expect(w.revision).toBe(4);
    expect(w.history.cursor).toBe(2);
    expect(vorhanden(await store.load(A)).revision).toBe(4);
  });

  it('[R-5.6-14] restore +1, replaceFromFile +1, createRestorePoint und setLastFileSave ±0, openFromFile = Revision der Datei', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const punkt = await store.createRestorePoint(A, 'import', uhr);
    expect(vorhanden(await store.load(A)).revision).toBe(0);
    await store.setLastFileSave(A, zeitpunkt('2026-10-07', 8));
    const nachSichern = vorhanden(await store.load(A));
    expect(nachSichern.revision).toBe(0);
    expect(nachSichern.modifiedAt).toBe(zeitpunkt('2026-10-07', 9));
    expect(nachSichern.lastFileSaveAt).toBe(zeitpunkt('2026-10-07', 8));
    await bereichsFehler(store.setLastFileSave(A, '07.10.2026'));
    await bereichsFehler(store.setLastFileSave(A, '2026-10-07T08:00:00Z'));

    uhr.setze(zeitpunkt('2026-10-07', 10));
    const r = await store.restore(A, punkt.id, uhr);
    expect(r.revision).toBe(1);
    expect(r.savedAt).toBe(zeitpunkt('2026-10-07', 10));
    const e = await store.replaceFromFile(A, planDatei(planA(), { revision: 40 }), uhr);
    expect(e.revision, 'replaceFromFile +1, nicht die Revision der Datei').toBe(2);
    expect(
      vorhanden(await store.load(A)).lastFileSaveAt,
      'replaceFromFile lässt lastFileSaveAt',
    ).toBe(zeitpunkt('2026-10-07', 8));

    const f2 = neueFabrik();
    const s2 = await oeffnen(f2);
    const o = await s2.openFromFile(
      planDatei(planA(), { revision: 17, modifiedAt: zeitpunkt('2026-10-01', 7) }),
      uhr,
    );
    expect(o.revision).toBe(17);
    expect(o.modifiedAt).toBe(zeitpunkt('2026-10-01', 7));
  });

  it('[R-5.6-14] commitAtomic mit der Revision von vor einem undo → conflict, nichts geschrieben', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await speichern(store, A, motto('Eins (fiktiv)'), uhr);
    const r0 = vorhanden(await store.load(A));
    const auftrag = standAuftrag(r0.plan, { standId: 'stand-veraltet' });
    vorhanden(await store.undo(A, uhr));
    const hash = await dbHash(f);
    await speicherFehler(
      store.commitAtomic(
        A,
        { expectedRevision: r0.revision, restorePoint: 'stand', ...auftrag },
        uhr,
      ),
      'conflict',
      KONFLIKT.stand,
    );
    expect(await dbHash(f)).toBe(hash);
  });
});

describe('Konfliktmeldungen (Vorrangregel V12)', () => {
  it('[R-5.6-14] veraltete expectedRevision: nur standRecord → Stand-Text; standRecord und importReport → Import-Text; nur importReport → Import-Text; commit → Änderungs-Text; je nichts geschrieben', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const alt = vorhanden(await store.load(A));
    await speichern(store, A, motto('Zwischenänderung (fiktiv)'), uhr);
    const hash = await dbHash(f);
    const { result, standRecord } = standAuftrag(alt.plan, { standId: 'stand-k' });
    const bericht = { report: { art: 'Importbericht (fiktiv)' } };

    await speicherFehler(
      store.commitAtomic(
        A,
        { expectedRevision: 0, result, restorePoint: 'stand', standRecord },
        uhr,
      ),
      'conflict',
      KONFLIKT.stand,
    );
    await speicherFehler(
      store.commitAtomic(
        A,
        { expectedRevision: 0, result, restorePoint: 'import', standRecord, importReport: bericht },
        uhr,
      ),
      'conflict',
      KONFLIKT.import,
    );
    await speicherFehler(
      store.commitAtomic(
        A,
        {
          expectedRevision: 0,
          result: motto('Import (fiktiv)')(alt.plan),
          restorePoint: 'import',
          importReport: bericht,
        },
        uhr,
      ),
      'conflict',
      KONFLIKT.import,
    );
    await speicherFehler(
      store.commit(A, motto('Veraltet (fiktiv)')(alt.plan), uhr, { expectedRevision: 0 }),
      'conflict',
      KONFLIKT.change,
    );
    await speicherFehler(store.undo(A, uhr, { expectedRevision: 0 }), 'conflict', KONFLIKT.change);
    await speicherFehler(store.redo(A, uhr, { expectedRevision: 0 }), 'conflict', KONFLIKT.change);
    expect(await dbHash(f), 'nichts geschrieben').toBe(hash);

    const passend = await store.commit(
      A,
      motto('Passend (fiktiv)')(vorhanden(await store.load(A)).plan),
      uhr,
      {
        expectedRevision: 1,
      },
    );
    expect(passend.revision).toBe(2);
  });

  it('[R-5.6-14] commitAtomic mit Grund «planDelete» → RangeError, nichts geschrieben', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const d0 = (await store.create(planA(), uhr)).plan;
    const hash = await dbHash(f);
    await bereichsFehler(
      store.commitAtomic(
        A,
        { expectedRevision: 0, result: motto('X (fiktiv)')(d0), restorePoint: 'planDelete' },
        uhr,
      ),
    );
    await bereichsFehler(store.createRestorePoint(A, 'planDelete', uhr));
    expect(await dbHash(f)).toBe(hash);
  });
});

describe('Unbekannter Plan, geschlossene Verbindung (I1 Nr 8, 9)', () => {
  it('[R-5.6-14] unbekannter Plan: load null, standRecords und importReports [], schreibende Methoden planNotFound ohne Schreiben', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const d0 = (await store.create(planA(), uhr)).plan;
    const hash = await dbHash(f);
    const X = 'p-unbekannt';
    expect(await store.load(X)).toBeNull();
    expect(await store.standRecords(X)).toEqual([]);
    expect(await store.importReports(X)).toEqual([]);
    expect(await store.listRestorePoints(X)).toEqual([]);
    const m = SPEICHER_MELDUNG.planNotFound;
    await speicherFehler(store.commit(X, motto('X')(d0), uhr), 'planNotFound', m);
    await speicherFehler(
      store.commitAtomic(
        X,
        { expectedRevision: 0, ...standAuftrag(d0, { standId: 's' }), restorePoint: 'stand' },
        uhr,
      ),
      'planNotFound',
      m,
    );
    await speicherFehler(store.undo(X, uhr), 'planNotFound', m);
    await speicherFehler(store.redo(X, uhr), 'planNotFound', m);
    await speicherFehler(store.createRestorePoint(X, 'import', uhr), 'planNotFound', m);
    await speicherFehler(store.restore(X, 'irgendein-punkt', uhr), 'planNotFound', m);
    await speicherFehler(
      store.replaceFromFile(X, planDatei({ ...d0, id: X }), uhr),
      'planNotFound',
      m,
    );
    await speicherFehler(store.exportPlanFile(X, uhr), 'planNotFound', m);
    await speicherFehler(store.deletePlan(X, uhr), 'planNotFound', m);
    await speicherFehler(store.setLastFileSave(X, zeitpunkt('2026-10-07', 9)), 'planNotFound', m);
    await speicherFehler(store.create(planA(), uhr), 'planExists', SPEICHER_MELDUNG.planExists);
    await speicherFehler(store.restore(A, 'kein-punkt', uhr), 'restorePointNotFound');
    await bereichsFehler(store.replaceFromFile(A, planDatei({ ...d0, id: 'p-anders' }), uhr));
    expect(await dbHash(f), 'nichts geschrieben').toBe(hash);
  });

  it('[R-5.6-14] nach close lehnen die Methoden mit unavailable ab; close mehrfach ohne Fehler', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const d0 = (await store.create(planA(), uhr)).plan;
    store.close();
    store.close();
    const m = SPEICHER_MELDUNG.unavailable;
    await speicherFehler(store.load(A), 'unavailable', m);
    await speicherFehler(store.commit(A, motto('X (fiktiv)')(d0), uhr), 'unavailable', m);
    await speicherFehler(store.listPlans(), 'unavailable', m);
    const neu = await oeffnen(f);
    gleich(vorhanden(await neu.load(A)).plan, d0);
    expect(globalThis.indexedDB, 'Testumgebung ohne globale IndexedDB').toBeUndefined();
    await speicherFehler(openPlanStore({ storage: null }), 'unavailable', m);
  });
});

describe('Importberichte und Punkte vor Ersetzen und Wiederherstellen', () => {
  it('[R-5.6-14] Importbericht: commitAtomic mit importReport sichtbar; undo → nicht; redo → wieder; nach Neuladen gleich; seq absteigend', async () => {
    const f = neueFabrik();
    let store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const bericht1 = { art: 'Import 1 (fiktiv)', zeilen: [1, 2] };
    const bericht2 = { art: 'Import 2 (fiktiv)', zeilen: [3] };
    const i1 = await importieren(store, A, uhr, motto('Import 1 (fiktiv)'), bericht1);
    uhr.setze(zeitpunkt('2026-10-07', 10));
    const vorImport2 = vorhanden(await store.load(A)).plan;
    const i2 = await importieren(store, A, uhr, motto('Import 2 (fiktiv)'), bericht2);
    const nachImport2 = vorhanden(await store.load(A)).plan;
    expect(nachImport2.motto).toBe('Import 2 (fiktiv)');
    const beide = [
      { planId: A, seq: i2.seq, at: zeitpunkt('2026-10-07', 10), report: bericht2 },
      { planId: A, seq: i1.seq, at: zeitpunkt('2026-10-07', 9), report: bericht1 },
    ];
    expect(await store.importReports(A)).toEqual(beide);
    // Undo und Redo des commitAtomic-Schritts stellen das Dokument exakt her (TR-E104-07).
    gleich(
      vorhanden(await store.undo(A, uhr)).plan,
      vorImport2,
      'undo = Dokument vor commitAtomic',
    );
    expect(await store.importReports(A)).toEqual([beide[1]]);
    store = await neuLaden(store, f);
    gleich(vorhanden(await store.load(A)).plan, vorImport2);
    expect(await store.importReports(A)).toEqual([beide[1]]);
    gleich(vorhanden(await store.redo(A, uhr)).plan, nachImport2, 'redo = result.plan');
    expect(await store.importReports(A)).toEqual(beide);
    store = await neuLaden(store, f);
    expect(await store.importReports(A)).toEqual(beide);
    expect((await store.listRestorePoints(A)).filter((p) => p.reason === 'import')).toHaveLength(2);
  });

  it('[R-5.6-14] Punkte vor replaceFromFile («fileReplace») und restore («restore») enthalten das Dokument davor', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const d0 = (await store.create(planA(), uhr)).plan;
    const punkt = await store.createRestorePoint(A, 'import', uhr);
    const d1 = (await speichern(store, A, motto('Vor dem Ersetzen (fiktiv)'), uhr)).result.plan;
    const e = await store.replaceFromFile(A, planDatei({ ...d0, motto: 'Datei (fiktiv)' }), uhr);
    const d2 = e.plan;
    await store.restore(A, punkt.id, uhr);

    const liste = await store.listRestorePoints(A);
    const ersetzen = liste.find((p) => p.reason === 'fileReplace');
    const wieder = liste.find((p) => p.reason === 'restore');
    gleich(
      (await rohPunkt(f, String(ersetzen?.id))).plan,
      d1,
      'Punkt «fileReplace» = Dokument davor',
    );
    gleich((await rohPunkt(f, String(wieder?.id))).plan, d2, 'Punkt «restore» = Dokument davor');
    ungleich(d1, d2);
    expect(ersetzen?.entryCount).toBe(Object.keys(d1.entries).length);
    expect((await rohPunkt(f, String(ersetzen?.id))).revision).toBe(1);
    expect(await werteVonPlan(f, 'history', A)).toHaveLength(3);
  });
});
