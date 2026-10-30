// @vitest-environment jsdom
// Paket E1-04: Behalten von Wiederherstellungspunkten, gelöschte Pläne, «Ältere löschen …» (Vertrag
// docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2» Abschnitte I2, K1, K3, K4, L R-5.6-08;
// ADR-006 Punkt 2b; AR0-51; Entscheide Orchestrator R-4, R-6). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { listStands, standPdf } from '../../../../src/io/wap-plan/standStore';
import { RESTORE_POINTS_KEPT } from '../../../../src/io/wap-plan/store';
import { EMPTY_HISTORY } from '../../../../src/model/wap/history/history';
import { sha256, UUID_V4 } from '../../support/stand/hilfen';
import {
  dbHash,
  kanonisch,
  neueFabrik,
  oeffnen,
  rohPunkte,
  werteVonPlan,
} from '../../support/storage/datenbank';
import { SPEICHER_MELDUNG } from '../../support/storage/meldungen';
import {
  A,
  importieren,
  motto,
  PLAN_B_ID,
  planA,
  planB,
  planDatei,
  speichern,
  standSetzen,
} from '../../support/storage/plaene';
import { gleich, speicherFehler, vorhanden } from '../../support/storage/pruefen';
import { TAG_MS, TestUhr, zeitpunkt } from '../../support/storage/uhr';

describe('Wiederherstellungspunkte und gelöschte Pläne', () => {
  it('[R-5.6-08] 35 × createRestorePoint → genau die 30 neuesten, neuester zuerst; ein Punkt «planDelete» derselben Plan-ID bleibt', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const { restorePointId: geloeschtId } = await store.deletePlan(A, uhr);
    await store.openFromFile(planDatei(planA()), uhr);

    const ids: string[] = [];
    for (let i = 1; i <= 35; i++) {
      uhr.vor(60_000);
      ids.push((await store.createRestorePoint(A, 'import', uhr)).id);
      const ohne = (await store.listRestorePoints(A)).filter((p) => p.reason !== 'planDelete');
      if (i === 30)
        expect(
          ohne.map((p) => p.id),
          'bis 30 bleibt jeder Punkt',
        ).toEqual([...ids].reverse());
      if (i === 31) expect(ohne.map((p) => p.id)).toEqual(ids.slice(1).reverse());
    }
    expect(RESTORE_POINTS_KEPT).toBe(30);
    const liste = await store.listRestorePoints(A);
    const ohne = liste.filter((p) => p.reason !== 'planDelete');
    expect(ohne).toHaveLength(30);
    expect(ohne.map((p) => p.id)).toEqual(ids.slice(5).reverse());
    expect(ohne.map((p) => p.at)).toEqual([...ohne.map((p) => p.at)].sort().reverse());
    expect(liste.map((p) => p.id)).toContain(geloeschtId);
    expect(liste.at(-1)?.reason, 'ältester Punkt zuletzt').toBe('planDelete');
    expect((await rohPunkte(f, A)).length).toBe(31);
  });

  it('[R-5.6-08] Behalten je Plan (K1): 35 Punkte von A lassen die drei älteren Punkte von Plan B unverändert (TR-E104-08)', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planB(), uhr);
    const b: string[] = [];
    for (let i = 1; i <= 3; i++) {
      uhr.vor(60_000);
      b.push((await store.createRestorePoint(PLAN_B_ID, 'import', uhr)).id);
    }
    const rohB = await rohPunkte(f, PLAN_B_ID);
    await store.create(planA(), uhr);
    const ids: string[] = [];
    for (let i = 1; i <= 35; i++) {
      uhr.vor(60_000);
      ids.push((await store.createRestorePoint(A, 'import', uhr)).id);
    }
    expect((await store.listRestorePoints(A)).map((p) => p.id)).toEqual(ids.slice(5).reverse());
    expect(
      (await store.listRestorePoints(PLAN_B_ID)).map((p) => p.id),
      'Punkte von Plan B bleiben (K1 gilt je Plan)',
    ).toEqual([...b].reverse());
    expect(kanonisch(await rohPunkte(f, PLAN_B_ID))).toEqual(kanonisch(rohB));
  });

  it('[R-5.6-08] deletePlan → listDeletedPlans mit Frist 30 Tage; 1 ms vor Ablauf gelistet, bei Ablauf Punkt und übrige Punkte gelöscht; restoreDeletedPlan danach → restorePointNotFound', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const geloeschtAm = zeitpunkt('2026-10-07', 10);
    const uhr = new TestUhr(zeitpunkt('2026-10-06', 10));
    await store.create(planA(), uhr);
    await store.createRestorePoint(A, 'import', uhr);
    await speichern(store, A, motto('Geändert (fiktiv)'), uhr);
    uhr.setze(geloeschtAm);
    const { restorePointId } = await store.deletePlan(A, uhr);
    expect(await store.load(A)).toBeNull();
    expect((await store.listPlans()).map((p) => p.id)).toEqual([]);
    expect(await store.standRecords(A)).toEqual([]);

    const ablauf = new Date(Date.parse(geloeschtAm) + 30 * TAG_MS).toISOString();
    expect(ablauf).toBe('2026-11-06T10:00:00.000Z');
    uhr.setze(new Date(Date.parse(ablauf) - 1).toISOString());
    const vorAblauf = await store.listDeletedPlans(uhr);
    expect(vorAblauf).toEqual([
      { planId: A, name: 'FDT 2026', deletedAt: geloeschtAm, restorePointId, expiresAt: ablauf },
    ]);
    expect((await rohPunkte(f, A)).length).toBeGreaterThanOrEqual(3);

    uhr.setze(ablauf);
    expect(await store.listDeletedPlans(uhr)).toEqual([]);
    expect(await rohPunkte(f, A), 'Punkt und übrige Punkte der Plan-ID gelöscht').toEqual([]);
    expect(await store.listRestorePoints(A)).toEqual([]);
    await speicherFehler(
      store.restoreDeletedPlan(restorePointId, uhr),
      'restorePointNotFound',
      SPEICHER_MELDUNG.restorePointNotFound,
    );
  });

  it('[R-5.6-08] Fristablauf bei wieder vorhandenem Plan gleicher Plan-ID: nur der Punkt «planDelete» verfällt, die Punkte von vor und nach dem Löschen bleiben (TR-E104-09)', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const geloeschtAm = zeitpunkt('2026-10-07', 10);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const vorLoeschen = await store.createRestorePoint(A, 'import', uhr);
    uhr.setze(geloeschtAm);
    const { restorePointId } = await store.deletePlan(A, uhr);
    await store.openFromFile(planDatei({ ...planA(), motto: 'Aus Datei (fiktiv)' }), uhr);
    uhr.setze(zeitpunkt('2026-10-07', 11));
    const nachOeffnen = await store.createRestorePoint(A, 'import', uhr);
    const geoeffnet = vorhanden(await store.load(A));

    const ablauf = Date.parse(geloeschtAm) + 30 * TAG_MS;
    uhr.setze(new Date(ablauf - 1).toISOString());
    expect((await store.listDeletedPlans(uhr)).map((d) => d.restorePointId)).toEqual([
      restorePointId,
    ]);
    uhr.setze(new Date(ablauf).toISOString());
    expect(await store.listDeletedPlans(uhr)).toEqual([]);
    expect(
      (await store.listRestorePoints(A)).map((p) => p.id),
      'Punkt «planDelete» verfallen; übrige Punkte des bestehenden Plans bleiben',
    ).toEqual([nachOeffnen.id, vorLoeschen.id]);
    expect(await rohPunkte(f, A)).toHaveLength(2);
    await speicherFehler(store.restoreDeletedPlan(restorePointId, uhr), 'restorePointNotFound');
    const danach = vorhanden(await store.load(A));
    gleich(danach.plan, geoeffnet.plan);
    expect(danach.revision).toBe(geoeffnet.revision);
  });

  it('[R-5.6-08] restoreDeletedPlan → Plan zurück (Dokument gleich, Revision + 1, Stände sichtbar und bytegleich), asCopy false, Punkt verbraucht', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const stand = await standSetzen(store, A, uhr, { standId: 'stand-1' });
    await speichern(store, A, motto('Vor dem Löschen (fiktiv)'), uhr);
    const vorher = vorhanden(await store.load(A));
    await store.setLastFileSave(A, zeitpunkt('2026-10-07', 8));
    const bytesVorher = await Promise.all(
      [...stand.standRecord.pdfs.keys()].map(async (k) =>
        sha256(
          (
            await standPdf(
              store,
              A,
              'stand-1',
              k === 'plan' ? { kind: 'plan' } : { kind: 'week', weekId: k },
            )
          ).bytes,
        ),
      ),
    );
    const { restorePointId } = await store.deletePlan(A, uhr);

    uhr.setze(zeitpunkt('2026-10-08', 9));
    const zurueck = await store.restoreDeletedPlan(restorePointId, uhr);
    expect(zurueck.asCopy).toBe(false);
    expect(zurueck.plan.id).toBe(A);
    gleich(zurueck.plan, vorher.plan);
    expect(zurueck.revision).toBe(vorher.revision + 1);
    expect(zurueck.modifiedAt).toBe(zeitpunkt('2026-10-08', 9));
    expect(zurueck.lastFileSaveAt).toBe(zeitpunkt('2026-10-07', 8));
    expect(zurueck.copyCreatedAt).toBeNull();
    expect(zurueck.history).toEqual(EMPTY_HISTORY);
    gleich(vorhanden(await store.load(A)).plan, vorher.plan);

    const records = await store.standRecords(A);
    expect(records).toHaveLength(1);
    expect(records[0]?.standId).toBe('stand-1');
    expect(records[0]?.seq).toBe(0);
    expect(records[0]?.hiddenBySeq).toBeNull();
    expect(records[0]?.visible).toBe(true);
    expect(records[0]?.recordId).not.toBe(stand.standRecord.recordId);
    const bytesNachher = await Promise.all(
      [...stand.standRecord.pdfs.keys()].map(async (k) =>
        sha256(
          (
            await standPdf(
              store,
              A,
              'stand-1',
              k === 'plan' ? { kind: 'plan' } : { kind: 'week', weekId: k },
            )
          ).bytes,
        ),
      ),
    );
    expect(bytesNachher).toEqual(bytesVorher);

    expect(await store.listDeletedPlans(uhr), 'Punkt verbraucht').toEqual([]);
    expect((await store.listRestorePoints(A)).map((p) => p.reason)).not.toContain('planDelete');
    await speicherFehler(store.restoreDeletedPlan(restorePointId, uhr), 'restorePointNotFound');
    expect((await store.listPlans()).map((p) => p.id)).toEqual([A]);
  });

  it('[R-5.6-08] deletePlan entfernt Schritte, Aufzeichnungen und Importberichte des Plans; nach restoreDeletedPlan leere Historie, keine Importberichte, neue Schritte ab seq 1 ohne ConstraintError (TR-E104-03)', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await speichern(store, A, motto('Schritt 1 (fiktiv)'), uhr);
    const imp = await importieren(store, A, uhr, motto('Import (fiktiv)'), {
      art: 'Import (fiktiv)',
      zeilen: [1],
    });
    expect(imp.seq).toBe(2);
    await standSetzen(store, A, uhr, { standId: 'stand-1' });
    for (const b of ['history', 'stands', 'importReports'] as const) {
      expect((await werteVonPlan(f, b, A)).length, `${b} vor dem Löschen`).toBeGreaterThan(0);
    }
    const vorher = vorhanden(await store.load(A));
    const { restorePointId } = await store.deletePlan(A, uhr);
    for (const b of ['plans', 'history', 'stands', 'importReports'] as const) {
      expect(await werteVonPlan(f, b, A), `${b}: Datensätze des Plans gelöscht`).toEqual([]);
    }

    uhr.setze(zeitpunkt('2026-10-07', 10));
    const zurueck = await store.restoreDeletedPlan(restorePointId, uhr);
    expect(zurueck.asCopy).toBe(false);
    gleich(zurueck.plan, vorher.plan);
    expect(vorhanden(await store.load(A)).history).toEqual(EMPTY_HISTORY);
    expect(await store.importReports(A)).toEqual([]);
    expect(await werteVonPlan(f, 'history', A)).toEqual([]);
    expect(await werteVonPlan(f, 'importReports', A)).toEqual([]);
    expect((await store.standRecords(A)).map((r) => [r.standId, r.seq, r.visible])).toEqual([
      ['stand-1', 0, true],
    ]);

    const s1 = await speichern(store, A, motto('Nach dem Herstellen 1 (fiktiv)'), uhr);
    const s2 = await speichern(store, A, motto('Nach dem Herstellen 2 (fiktiv)'), uhr);
    expect([s1.seq, s2.seq], 'seq beginnt wieder bei 1 (I1 Nr 10)').toEqual([1, 2]);
    const geladen = vorhanden(await store.load(A));
    expect(geladen.history.steps.map((x) => x.seq)).toEqual([1, 2]);
    expect(geladen.history.steps.map((x) => x.label)).toEqual([s1.result.label, s2.result.label]);
    gleich(geladen.plan, s2.result.plan);
    expect(await store.importReports(A), 'kein alter Importbericht sichtbar').toEqual([]);
    gleich(vorhanden(await store.undo(A, uhr)).plan, s1.result.plan);
    gleich(vorhanden(await store.undo(A, uhr)).plan, vorher.plan);
    expect(await store.undo(A, uhr), 'keine alten Schritte').toBeNull();
  });

  it('[R-5.6-08] AR0-51: gelöschter Plan, danach openFromFile derselben Plan-ID → restoreDeletedPlan als Kopie mit neuer Plan-ID; der geöffnete Plan bleibt unverändert', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create({ ...planA(), motto: 'Gelöscht (fiktiv)' }, uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-alt' });
    const geloescht = vorhanden(await store.load(A));
    const { restorePointId } = await store.deletePlan(A, uhr);
    await store.openFromFile(planDatei({ ...planA(), motto: 'Aus Datei (fiktiv)' }), uhr);
    // «Unverändert» nur über Dokument, Historie, Aufzeichnungen und Importberichte von A: restoreDeletedPlan
    // verbraucht den Punkt «planDelete» mit der Plan-ID A (I2, R-6; TR-E104-02).
    const ohnePunkte = async (): Promise<string> =>
      JSON.stringify(
        await Promise.all(
          (['plans', 'history', 'stands', 'importReports'] as const).map(async (b) =>
            kanonisch(await werteVonPlan(f, b, A)),
          ),
        ),
      );
    const hashGeoeffnet = await ohnePunkte();
    const punkteVorher = await rohPunkte(f, A);
    expect(punkteVorher.map((p) => p.reason)).toContain('planDelete');

    uhr.setze(zeitpunkt('2026-10-07', 11));
    const kopie = await store.restoreDeletedPlan(restorePointId, uhr);
    expect(kopie.asCopy).toBe(true);
    expect(kopie.plan.id).toMatch(UUID_V4);
    expect(kopie.plan.id).not.toBe(A);
    gleich(kopie.plan, { ...geloescht.plan, id: kopie.plan.id });
    expect(kopie.revision).toBe(0);
    expect(kopie.copyCreatedAt).toBe(zeitpunkt('2026-10-07', 11));
    expect(kopie.lastFileSaveAt).toBeNull();
    expect(kopie.history).toEqual(EMPTY_HISTORY);
    expect(await ohnePunkte(), 'geöffneter Plan unverändert').toBe(hashGeoeffnet);
    const punkteNachher = await rohPunkte(f, A);
    expect(
      punkteNachher.map((p) => p.reason),
      'Punkt «planDelete» verbraucht',
    ).not.toContain('planDelete');
    expect(kanonisch(punkteNachher), 'übrige Punkte von A unverändert').toEqual(
      kanonisch(punkteVorher.filter((p) => p.reason !== 'planDelete')),
    );
    expect(vorhanden(await store.load(A)).plan.motto).toBe('Aus Datei (fiktiv)');

    const staende = await listStands(store, kopie.plan.id);
    expect(staende).toHaveLength(1);
    expect(staende[0]?.standId).not.toBe('stand-alt');
    expect(staende[0]?.planId).toBe(kopie.plan.id);
    const plaene = await store.listPlans();
    expect(plaene.map((p) => p.id).sort()).toEqual([A, kopie.plan.id].sort());
    expect(plaene.find((p) => p.id === kopie.plan.id)?.copyCreatedAt).toBe(
      zeitpunkt('2026-10-07', 11),
    );
    expect(await store.listDeletedPlans(uhr)).toEqual([]);
  });

  it('[R-5.6-08] «Ältere löschen …»: deleteRestorePointsOlderThan löscht ältere Punkte ausser «planDelete»; Bezug p1 → 0; Fehlerfälle ohne Schreiben', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    await store.deletePlan(A, uhr);
    await store.openFromFile(planDatei(planA()), uhr);
    await store.create(planB(), uhr);
    const fremd = await store.createRestorePoint(PLAN_B_ID, 'import', uhr);
    const p: string[] = [];
    for (let i = 1; i <= 5; i++) {
      uhr.vor(60_000);
      p.push((await store.createRestorePoint(A, 'import', uhr)).id);
    }
    const [p1, , p3, p4, p5] = p;
    const vorher = vorhanden(await store.load(A));

    const hashVorP1 = await dbHash(f);
    expect(
      await store.deleteRestorePointsOlderThan(A, String(p1)),
      'älter als p1 ist nur der Punkt «planDelete»; er bleibt',
    ).toEqual({ deleted: 0 });
    expect(await dbHash(f)).toBe(hashVorP1);

    expect(await store.deleteRestorePointsOlderThan(A, String(p3))).toEqual({ deleted: 2 });
    const liste = await store.listRestorePoints(A);
    expect(liste.map((x) => x.id).slice(0, 3)).toEqual([p5, p4, p3]);
    expect(liste.map((x) => x.reason)).toEqual(['import', 'import', 'import', 'planDelete']);
    const nachher = vorhanden(await store.load(A));
    expect(nachher.revision).toBe(vorher.revision);
    expect(nachher.modifiedAt).toBe(vorher.modifiedAt);
    gleich(nachher.plan, vorher.plan);
    expect(nachher.history).toEqual(vorher.history);

    const hash = await dbHash(f);
    expect(await store.deleteRestorePointsOlderThan(A, String(p3))).toEqual({ deleted: 0 });
    await speicherFehler(
      store.deleteRestorePointsOlderThan(A, String(p1)),
      'restorePointNotFound',
      SPEICHER_MELDUNG.restorePointNotFound,
    );
    expect(await dbHash(f)).toBe(hash);
    await speicherFehler(
      store.deleteRestorePointsOlderThan(A, fremd.id),
      'restorePointNotFound',
      SPEICHER_MELDUNG.restorePointNotFound,
    );
    await speicherFehler(
      store.deleteRestorePointsOlderThan(A, 'unbekannt'),
      'restorePointNotFound',
    );
    await speicherFehler(
      store.deleteRestorePointsOlderThan('p-unbekannt', String(p3)),
      'planNotFound',
      SPEICHER_MELDUNG.planNotFound,
    );
    expect(await dbHash(f), 'Fehlerfälle schreiben nichts').toBe(hash);
  });
});
