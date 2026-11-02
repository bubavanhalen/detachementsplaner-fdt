// @vitest-environment jsdom
// Paket E1-04: täglicher Wiederherstellungspunkt (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz
// «Ausarbeitung Schritt 2» Abschnitte I1 Nr 3–5, I2 localDay, K2, L R-5.6-04; F-20; ADR-006 Punkt 2). Zeitpunkte
// 12:00 UTC (K2: gleicher Kalendertag in allen drei Zeitzonen der Schleuse). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { localDay } from '../../../../src/io/wap-plan/store';
import {
  neueFabrik,
  oeffnen,
  rohPunkt,
  rohPunkte,
  werteVonPlan,
} from '../../support/storage/datenbank';
import {
  A,
  leeresErgebnis,
  motto,
  planA,
  planDatei,
  speichern,
  standSetzen,
} from '../../support/storage/plaene';
import { gleich, vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

describe('Tagespunkt', () => {
  it('[R-5.6-04] localDay: lokaler Kalendertag yyyy-mm-dd aus den lokalen Datumsteilen, zweistellig aufgefüllt', () => {
    expect(localDay(new Date(2026, 9, 7, 12, 0, 0))).toBe('2026-10-07');
    expect(localDay(new Date(2026, 9, 7, 0, 0, 0, 0)), 'Beginn des lokalen Tags').toBe(
      '2026-10-07',
    );
    expect(localDay(new Date(2026, 9, 7, 23, 59, 59, 999)), 'Ende des lokalen Tags').toBe(
      '2026-10-07',
    );
    expect(localDay(new Date(2026, 0, 5, 12)), 'Monat und Tag zweistellig').toBe('2026-01-05');
    expect(localDay(new Date(2026, 11, 31, 23, 30)), 'Jahresende').toBe('2026-12-31');
  });

  it('[R-5.6-04] commit an drei Kalendertagen → drei Tagespunkte; zweite Änderung am selben Tag → kein weiterer; Dokument = Zustand vor der ersten Änderung des Tags', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-05'));
    const d0 = (await store.create(planA(), uhr)).plan;
    expect(await store.listRestorePoints(A), 'keine Punkte bei der Neuanlage').toEqual([]);

    const t1a = await speichern(store, A, motto('Tag 1a (fiktiv)'), uhr);
    const t1b = await speichern(store, A, motto('Tag 1b (fiktiv)'), uhr);
    uhr.setze(zeitpunkt('2026-10-06'));
    const t2 = await speichern(store, A, motto('Tag 2 (fiktiv)'), uhr);
    uhr.setze(zeitpunkt('2026-10-07'));
    await speichern(store, A, motto('Tag 3a (fiktiv)'), uhr);
    await speichern(store, A, motto('Tag 3b (fiktiv)'), uhr);

    const punkte = await store.listRestorePoints(A);
    expect(punkte.map((p) => p.reason)).toEqual(['daily', 'daily', 'daily']);
    expect(punkte.map((p) => p.at)).toEqual([
      zeitpunkt('2026-10-07'),
      zeitpunkt('2026-10-06'),
      zeitpunkt('2026-10-05'),
    ]);
    for (const p of punkte) {
      expect(p.planId).toBe(A);
      expect(p.formatVersion).toBe(1);
      expect(p.standVersion).toBeNull();
    }
    const roh = await rohPunkte(f, A);
    gleich(roh[0]?.plan, d0, 'Tagespunkt Tag 1 = Dokument vor der ersten Änderung');
    gleich(
      roh[1]?.plan,
      t1b.result.plan,
      'Tagespunkt Tag 2 = Dokument nach den Änderungen von Tag 1',
    );
    gleich(roh[2]?.plan, t2.result.plan, 'Tagespunkt Tag 3 = Dokument nach der Änderung von Tag 2');
    expect(roh.map((p) => p.revision)).toEqual([0, t1b.revision, t2.revision]);
    expect(t1a.revision).toBe(1);
    expect(vorhanden(punkte[2]).entryCount).toBe(Object.keys(d0.entries).length);
  });

  it('[R-5.6-04] undo als erste Änderung eines Tags → Tagespunkt; leerer commit, createRestorePoint, setLastFileSave → keiner', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-05'));
    await store.create(planA(), uhr);
    const r = await speichern(store, A, motto('Tag 1 (fiktiv)'), uhr);

    uhr.setze(zeitpunkt('2026-10-06'));
    const leer = await store.commit(A, leeresErgebnis(r.result.plan), uhr);
    expect(leer.seq).toBe(0);
    await store.createRestorePoint(A, 'import', uhr);
    await store.setLastFileSave(A, zeitpunkt('2026-10-06'));
    const tag2 = (await rohPunkte(f, A)).filter((p) => p.at === zeitpunkt('2026-10-06'));
    expect(
      tag2.map((p) => p.reason),
      'nur der ausdrücklich angelegte Punkt',
    ).toEqual(['import']);

    uhr.setze(zeitpunkt('2026-10-07'));
    vorhanden(await store.undo(A, uhr));
    const tag3 = (await rohPunkte(f, A)).filter((p) => p.at === zeitpunkt('2026-10-07'));
    expect(tag3.map((p) => p.reason)).toEqual(['daily']);
    gleich(tag3[0]?.plan, r.result.plan, 'Tagespunkt = Dokument vor dem Undo');
    expect(tag3[0]?.revision).toBe(1);

    expect(await store.undo(A, uhr), 'kein weiterer Schritt').toBeNull();
    uhr.setze(zeitpunkt('2026-10-08'));
    expect(await store.undo(A, uhr)).toBeNull();
    const tag4 = (await rohPunkte(f, A)).filter((p) => p.at === zeitpunkt('2026-10-08'));
    expect(tag4, 'undo ohne Schritt erhöht die Revision nicht → kein Tagespunkt').toEqual([]);
  });

  it('[R-5.6-04] commitAtomic als erste Änderung des Tags → zuerst Tagespunkt, dann Punkt «stand», beide mit dem Dokument davor', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-05'));
    await store.create(planA(), uhr);
    const vorher = await speichern(store, A, motto('Tag 1 (fiktiv)'), uhr);
    const anzahlTag1 = (await rohPunkte(f, A)).length;

    uhr.setze(zeitpunkt('2026-10-06'));
    const s = await standSetzen(store, A, uhr, { standId: 'stand-1', version: 3 });
    const neu = (await rohPunkte(f, A)).slice(anzahlTag1);
    expect(neu.map((p) => p.reason)).toEqual(['daily', 'stand']);
    expect(Number(neu[0]?.ordinal)).toBeLessThan(Number(neu[1]?.ordinal));
    gleich(neu[0]?.plan, vorher.result.plan);
    gleich(neu[1]?.plan, vorher.result.plan);
    expect(neu[1]?.standVersion).toBe(3);
    expect(neu[0]?.standVersion).toBeNull();

    const liste = await store.listRestorePoints(A);
    expect(
      liste.slice(0, 2).map((p) => p.reason),
      'neuester zuerst',
    ).toEqual(['stand', 'daily']);
    expect(liste[0]?.standVersion).toBe(3);
    const stand = await rohPunkt(f, String(liste[0]?.id));
    expect(stand.revision).toBe(vorher.revision);
    expect(s.revision).toBe(vorher.revision + 1);
    expect(await werteVonPlan(f, 'stands', A)).toHaveLength(1);

    await speichern(store, A, motto('Tag 2 danach (fiktiv)'), uhr);
    const tag2 = (await rohPunkte(f, A)).filter(
      (p) => p.reason === 'daily' && p.at === zeitpunkt('2026-10-06'),
    );
    expect(tag2, 'nur ein Tagespunkt je Tag').toHaveLength(1);
  });

  it('[R-5.6-04] restore, replaceFromFile und redo als erste Änderung eines Tags → zuerst Tagespunkt mit dem Dokument davor, dann «restore» bzw. «fileReplace» (TR-E104-11)', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-05'));
    await store.create(planA(), uhr);
    const punkt = await store.createRestorePoint(A, 'import', uhr);
    const d1 = (await speichern(store, A, motto('Tag 1 (fiktiv)'), uhr)).result.plan;
    const punkteAm = async (tag: string) =>
      (await rohPunkte(f, A)).filter((p) => p.at === zeitpunkt(tag));

    uhr.setze(zeitpunkt('2026-10-06'));
    const d2 = (await store.restore(A, punkt.id, uhr)).plan;
    const tag2 = await punkteAm('2026-10-06');
    expect(tag2.map((p) => p.reason)).toEqual(['daily', 'restore']);
    gleich(tag2[0]?.plan, d1, 'Tagespunkt = Dokument vor dem Wiederherstellen');

    uhr.setze(zeitpunkt('2026-10-07'));
    const d3 = (
      await store.replaceFromFile(A, planDatei({ ...planA(), motto: 'Datei (fiktiv)' }), uhr)
    ).plan;
    const tag3 = await punkteAm('2026-10-07');
    expect(tag3.map((p) => p.reason)).toEqual(['daily', 'fileReplace']);
    gleich(tag3[0]?.plan, d2, 'Tagespunkt = Dokument vor dem Ersetzen');

    uhr.setze(zeitpunkt('2026-10-08'));
    gleich(vorhanden(await store.undo(A, uhr)).plan, d2);
    uhr.setze(zeitpunkt('2026-10-09'));
    gleich(vorhanden(await store.redo(A, uhr)).plan, d3);
    const tag5 = await punkteAm('2026-10-09');
    expect(tag5.map((p) => p.reason)).toEqual(['daily']);
    gleich(tag5[0]?.plan, d2, 'Tagespunkt = Dokument vor dem Redo');
  });
});
