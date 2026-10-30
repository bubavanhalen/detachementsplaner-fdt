// @vitest-environment jsdom
// Paket E1-04: Plan-Datei und Speicher – Rundreise mit Ständen aus setNewStand, Öffnen ohne lokalen Plan, Übernehmen
// als Kopie (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte D4, I2
// openFromFile, importAsCopy, exportPlanFile, listPlans, L R-5.6-17 Nr 2–4; Änderungsnotiz E1-05 J1; AR0-19, AR0-26,
// AR0-37; Entscheid R-7). Prüf-Renderer von E1-05 (echtes writePdf). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  CURRENT_FORMAT,
  compareWithLocal,
  parsePlanFile,
} from '../../../../src/io/wap-plan/planFile';
import { listStands, setNewStand, standPdf } from '../../../../src/io/wap-plan/standStore';
import type { PlanStore } from '../../../../src/io/wap-plan/store';
import { EMPTY_HISTORY } from '../../../../src/model/wap/history/history';
import type { PdfTarget } from '../../../../src/model/wap/stand/fileName';
import { sha256, UUID_V4 } from '../../support/stand/hilfen';
import { PruefRenderer } from '../../support/stand/renderer';
import { dbHash, neueFabrik, oeffnen, planHash, rohPunkt } from '../../support/storage/datenbank';
import { mottoFormat } from '../../support/storage/format';
import { SPEICHER_MELDUNG } from '../../support/storage/meldungen';
import {
  A,
  ctx,
  dateiStand,
  motto,
  planA,
  planDatei,
  speichern,
  standSetzen,
  titel,
} from '../../support/storage/plaene';
import { gleich, gleicheBytes, speicherFehler, vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

/** SHA-256 je Stand und Ziel (alle Wochen des Schnappschusses und 'plan'). */
async function standHashes(store: PlanStore): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const s of await listStands(store, A)) {
    const rec = (await store.standRecords(A)).find((r) => r.standId === s.standId && r.visible);
    const ziele: PdfTarget[] = [
      ...(rec?.plan.weeks ?? []).map((w) => ({ kind: 'week' as const, weekId: w.id })),
      { kind: 'plan' },
    ];
    for (const z of ziele) {
      const key = `${s.standId}/${z.kind === 'week' ? z.weekId : 'plan'}`;
      out[key] = sha256((await standPdf(store, A, s.standId, z)).bytes);
    }
  }
  return out;
}

describe('Plan-Datei mit dem Speicher', () => {
  it('[R-5.6-17][R-5.5-06] Rundreise mit Ständen aus setNewStand: exportPlanFile → neue Fabrik → parsePlanFile → openFromFile → standPdf je Woche und Gesamtplan mit denselben SHA-256', async () => {
    const f1 = neueFabrik();
    const s1 = await oeffnen(f1);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await s1.create(planA(), uhr);
    await setNewStand(s1, A, { date: '2026-09-17' }, new PruefRenderer(), uhr, { ctx });
    await speichern(s1, A, titel('e101', 'Nach Stand 1 (fiktiv)'), uhr);
    await setNewStand(s1, A, { date: '2026-09-17' }, new PruefRenderer(), uhr, { ctx });
    await speichern(s1, A, motto('Nach Stand 2 (fiktiv)'), uhr);
    const vorher = await standHashes(s1);
    expect(Object.keys(vorher)).toHaveLength(10);
    const gespeichert = vorhanden(await s1.load(A));

    uhr.setze(zeitpunkt('2026-10-07', 10));
    const exp = await s1.exportPlanFile(A, uhr);
    expect(exp.fileName).toBe('01_02_WAP_FDT_2026_Plan_2026-10-07.wap.json');
    expect(exp.containsInternalNotes).toBe(false);
    expect(
      vorhanden(await s1.load(A)).lastFileSaveAt,
      'exportPlanFile setzt lastFileSaveAt nicht',
    ).toBeNull();

    const datei = parsePlanFile(exp.bytes);
    gleich(datei.plan, gespeichert.plan);
    expect(datei.revision).toBe(gespeichert.revision);
    expect(datei.modifiedAt).toBe(gespeichert.modifiedAt);
    expect(datei.savedAt).toBe(zeitpunkt('2026-10-07', 10));
    expect(datei.stands.map((s) => s.version)).toEqual([2, 1]);
    expect(datei.stands.map((s) => s.standsSameDay)).toEqual([2, 1]);

    const f2 = neueFabrik();
    const s2 = await oeffnen(f2);
    expect(compareWithLocal(datei, await s2.load(A))).toBe('noLocal');
    await s2.openFromFile(datei, uhr);
    expect(await standHashes(s2)).toEqual(vorher);
    expect((await listStands(s2, A)).map((s) => [s.standId, s.version, s.standsSameDay])).toEqual(
      (await listStands(s1, A)).map((s) => [s.standId, s.version, s.standsSameDay]),
    );
    const zweiteDatei = parsePlanFile((await s2.exportPlanFile(A, uhr)).bytes);
    gleich(zweiteDatei.plan, datei.plan);
    for (const [i, s] of datei.stands.entries()) {
      for (const [k, b] of s.pdfs) gleicheBytes(zweiteDatei.stands[i]?.pdfs.get(k), b);
    }
  });

  it('[R-5.6-17] openFromFile ohne lokalen Plan: Plan-ID, Revision, modifiedAt wie Datei; alle Stände sichtbar mit seq 0; commit und undo ändern ihre Sichtbarkeit nicht; vorhandene Plan-ID → planExists ohne Schreiben', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const datei = planDatei(planA(), {
      revision: 17,
      modifiedAt: zeitpunkt('2026-10-01', 7),
      savedAt: zeitpunkt('2026-10-02', 8),
      stands: [
        dateiStand(planA(), 'stand-f1', { standsSameDay: 1 }),
        dateiStand(planA(), 'stand-f2', { date: '2026-09-24', version: 2, standsSameDay: 3 }),
      ],
    });
    expect(compareWithLocal(datei, await store.load(A))).toBe('noLocal');
    const o = await store.openFromFile(datei, uhr);
    expect(o.plan.id).toBe(A);
    gleich(o.plan, datei.plan);
    expect(o.revision).toBe(17);
    expect(o.modifiedAt).toBe(zeitpunkt('2026-10-01', 7));
    expect(o.lastFileSaveAt, 'Entscheid R-7').toBe(zeitpunkt('2026-10-02', 8));
    expect(o.copyCreatedAt).toBeNull();
    expect(o.history).toEqual(EMPTY_HISTORY);
    expect(await store.listRestorePoints(A), 'kein Punkt beim Öffnen').toEqual([]);

    const pruefeStaende = async (schritt: string): Promise<void> => {
      const records = await store.standRecords(A);
      expect(records.map((r) => r.standId).sort(), schritt).toEqual(['stand-f1', 'stand-f2']);
      for (const r of records) {
        expect(r.seq, schritt).toBe(0);
        expect(r.hiddenBySeq, schritt).toBeNull();
        expect(r.visible, schritt).toBe(true);
        const quelle = datei.stands.find((s) => s.standId === r.standId);
        expect(r.standsSameDay).toBe(quelle?.standsSameDay);
        gleich(r.plan, quelle?.plan);
        for (const [k, b] of quelle?.pdfs ?? []) gleicheBytes(r.pdfs.get(k), b);
      }
    };
    await pruefeStaende('nach dem Öffnen');
    await speichern(store, A, motto('Danach (fiktiv)'), uhr);
    await pruefeStaende('nach commit');
    vorhanden(await store.undo(A, uhr));
    await pruefeStaende('nach undo');
    expect(compareWithLocal(datei, await store.load(A))).toBe('localNewer');

    const hash = await dbHash(f);
    await speicherFehler(store.openFromFile(datei, uhr), 'planExists', SPEICHER_MELDUNG.planExists);
    expect(await dbHash(f)).toBe(hash);
  });

  it('[R-5.6-17] importAsCopy: neue Plan-ID (UUID v4), Stände mit neuer standId sichtbar und bytegleich, copyCreatedAt = jetzt; der lokale Plan mit der alten Plan-ID bleibt unverändert', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await speichern(store, A, motto('Lokal (fiktiv)'), uhr);
    const lokalHash = await planHash(f, A);
    const dateiPlan = { ...planA(), motto: 'Aus Datei (fiktiv)' };
    const datei = planDatei(dateiPlan, {
      revision: 9,
      stands: [dateiStand(planA(), 'stand-f1', { standsSameDay: 2 })],
    });
    expect(compareWithLocal(datei, await store.load(A))).toBe('localNewer');

    uhr.setze(zeitpunkt('2026-10-07', 11));
    const k = await store.importAsCopy(datei, uhr);
    expect(k.plan.id).toMatch(UUID_V4);
    gleich(k.plan, { ...dateiPlan, id: k.plan.id });
    expect(k.revision).toBe(0);
    expect(k.modifiedAt).toBe(zeitpunkt('2026-10-07', 11));
    expect(k.lastFileSaveAt).toBeNull();
    expect(k.copyCreatedAt).toBe(zeitpunkt('2026-10-07', 11));
    expect(k.history).toEqual(EMPTY_HISTORY);
    gleich(vorhanden(await store.load(k.plan.id)).plan, k.plan);

    const records = await store.standRecords(k.plan.id);
    expect(records).toHaveLength(1);
    const r = vorhanden(records[0]);
    expect(r.standId).not.toBe('stand-f1');
    expect(r.planId).toBe(k.plan.id);
    expect(r.visible).toBe(true);
    expect(r.seq).toBe(0);
    expect(r.standsSameDay).toBe(2);
    gleich(r.plan, datei.stands[0]?.plan, 'Schnappschuss unverändert');
    for (const [key, b] of datei.stands[0]?.pdfs ?? []) gleicheBytes(r.pdfs.get(key), b);

    expect(await planHash(f, A), 'lokaler Plan unverändert').toBe(lokalHash);
    const liste = await store.listPlans();
    expect(liste).toHaveLength(2);
    expect(liste[0]).toEqual({
      id: k.plan.id,
      name: 'FDT 2026',
      unit: dateiPlan.unit,
      service: 'FDT 2026',
      modifiedAt: zeitpunkt('2026-10-07', 11),
      copyCreatedAt: zeitpunkt('2026-10-07', 11),
    });
    expect(liste[1]?.id).toBe(A);
    expect(liste[1]?.copyCreatedAt).toBeNull();
    expect(await store.listRestorePoints(k.plan.id)).toEqual([]);
  });

  it('[R-5.6-17][R-5.6-08] nur sichtbare Stände: ein rückgängig gemachter Stand fehlt in Plan-Datei, Sicherung vor dem Update und Löschpunkt; Reihenfolge nach Version, nicht nach recordId (TR-E104-15)', async () => {
    const f = neueFabrik();
    let store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    // recordId absichtlich gegenläufig zur erwarteten Reihenfolge (Version absteigend, E1-05 D4).
    const s1 = await standSetzen(store, A, uhr, {
      standId: 'stand-sichtbar-1',
      recordId: 'rec-b',
      version: 1,
    });
    const s2 = await standSetzen(store, A, uhr, {
      standId: 'stand-sichtbar-2',
      recordId: 'rec-c',
      version: 2,
    });
    await standSetzen(store, A, uhr, { standId: 'stand-weg', recordId: 'rec-a', version: 3 });
    vorhanden(await store.undo(A, uhr));
    const records = await store.standRecords(A);
    expect(records.map((r) => [r.standId, r.visible]).sort()).toEqual([
      ['stand-sichtbar-1', true],
      ['stand-sichtbar-2', true],
      ['stand-weg', false],
    ]);
    const erwartet = ['stand-sichtbar-2', 'stand-sichtbar-1'];

    // Plan-Datei (D4, I2 exportPlanFile).
    const datei = parsePlanFile((await store.exportPlanFile(A, uhr)).bytes);
    expect(
      datei.stands.map((s) => s.standId),
      'Plan-Datei',
    ).toEqual(erwartet);
    expect(datei.stands.map((s) => s.version)).toEqual([2, 1]);
    for (const [s, auftrag] of [
      [datei.stands[0], s2.standRecord],
      [datei.stands[1], s1.standRecord],
    ] as const) {
      for (const [k, b] of auftrag.pdfs) gleicheBytes(s?.pdfs.get(k), b);
    }

    // Sicherung vor dem Update (F3 pendingMigration: Stände wie exportPlanFile); liest nur.
    store.close();
    const v2 = await oeffnen(f, mottoFormat());
    const pm = vorhanden(await v2.pendingMigration(uhr));
    const sicherung = parsePlanFile(vorhanden(pm.backups[0]).bytes(), CURRENT_FORMAT);
    expect(sicherung.stands.map((s) => s.standId).sort(), 'Sicherung vor dem Update').toEqual(
      [...erwartet].sort(),
    );
    v2.close();
    store = await oeffnen(f);

    // Löschpunkt (I2 deletePlan, restoreDeletedPlan).
    const { restorePointId } = await store.deletePlan(A, uhr);
    const punkt = await rohPunkt(f, restorePointId);
    expect(
      (punkt.stands as { standId: string }[]).map((s) => s.standId).sort(),
      'Löschpunkt',
    ).toEqual([...erwartet].sort());
    uhr.setze(zeitpunkt('2026-10-07', 10));
    await store.restoreDeletedPlan(restorePointId, uhr);
    const zurueck = await store.standRecords(A);
    expect(zurueck.map((r) => [r.standId, r.seq, r.visible]).sort()).toEqual([
      ['stand-sichtbar-1', 0, true],
      ['stand-sichtbar-2', 0, true],
    ]);
    expect((await listStands(store, A)).map((s) => s.standId)).toEqual(erwartet);
  });
});
