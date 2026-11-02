// @vitest-environment jsdom
// Paket E1-04: Speicher voll und Nachtragen (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung
// Schritt 2» Abschnitte B5, B5a, G1 quotaExceeded, I1 Nr 2, I2 restore und exportPlanFile mit override, L R-5.6-14
// Nr 11, 12; Leitplanke 6; ADR-006 Punkt 3; Vertragsprüfung R1 V02, V03, R2 V17, V18). Werfende Testfabrik nach M1.
// Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import { listStands, standPdf } from '../../../../src/io/wap-plan/standStore';
import { weekDates } from '../../../../src/model/wap/calendar';
import { deleteEntries } from '../../../../src/model/wap/commands/entries';
import { rootReplaceResult } from '../../../../src/model/wap/history/history';
import type { Plan } from '../../../../src/model/wap/types';
import {
  dbHash,
  mitVollemSpeicher,
  neueFabrik,
  oeffnen,
  rohPunkte,
} from '../../support/storage/datenbank';
import { SPEICHER_MELDUNG } from '../../support/storage/meldungen';
import {
  A,
  ctx,
  motto,
  nacheinander,
  planA,
  speichern,
  standAuftrag,
  standSetzen,
  titel,
} from '../../support/storage/plaene';
import {
  bereichsFehler,
  gleich,
  gleicheBytes,
  speicherFehler,
  ungleich,
  vorhanden,
} from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

/** Höchstzahl der Versuche beim Durchlaufen aller Schreibstellen (Schutz gegen Endlosschleifen). */
const HOECHSTENS = 100;

describe('Speicher voll (QuotaExceededError)', () => {
  it('[R-5.6-14] commit bei vollem Speicher → quotaExceeded, DB-Hash gleich (kein halber Schritt, kein Tagespunkt); danach undo und redo um die letzte gespeicherte Änderung', async () => {
    await mitVollemSpeicher(async (voll) => {
      const f = voll.fabrik;
      const store = await oeffnen(f);
      const uhr = new TestUhr(zeitpunkt('2026-10-06', 9));
      const d0 = (await store.create(planA(), uhr)).plan;
      const d1 = (await speichern(store, A, titel('e101', 'Gespeichert (fiktiv)'), uhr)).result
        .plan;

      uhr.setze(zeitpunkt('2026-10-07', 9));
      const hash = await dbHash(f);
      const nichtGespeichert = titel('e101', 'Nicht gespeichert (fiktiv)')(d1);
      voll.arm();
      const e = await speicherFehler(
        store.commit(A, nichtGespeichert, uhr),
        'quotaExceeded',
        SPEICHER_MELDUNG.quotaExceeded,
      );
      expect(e.planName).toBeNull();
      expect(voll.ausgeloest()).toBe(1);
      expect(await dbHash(f), 'nichts geschrieben').toBe(hash);
      expect((await rohPunkte(f, A)).filter((p) => p.at === zeitpunkt('2026-10-07', 9))).toEqual(
        [],
      );

      voll.entschaerfen();
      const u = vorhanden(await store.undo(A, uhr));
      gleich(u.plan, d0, 'undo = Stand vor der letzten gespeicherten Änderung');
      const w = vorhanden(await store.redo(A, uhr));
      gleich(w.plan, d1);
      expect(await store.redo(A, uhr)).toBeNull();
    });
  });

  it('[R-5.6-14] commit: QuotaExceededError an jeder Schreibstelle → quotaExceeded und nichts geschrieben; ohne Fehler gespeichert', async () => {
    await mitVollemSpeicher(async (voll) => {
      const f = voll.fabrik;
      const store = await oeffnen(f);
      const uhr = new TestUhr(zeitpunkt('2026-10-06', 9));
      const d0 = (await store.create(planA(), uhr)).plan;
      uhr.setze(zeitpunkt('2026-10-07', 9));
      const r = titel('e101', 'Neu (fiktiv)')(d0);
      let gelungen = false;
      let stellen = 0;
      for (let k = 0; k < HOECHSTENS && !gelungen; k++) {
        const hash = await dbHash(f);
        const vorher = voll.ausgeloest();
        voll.arm(k);
        try {
          await store.commit(A, r, uhr);
          gelungen = true;
          expect(voll.ausgeloest(), 'ohne ausgelösten Fehler gespeichert').toBe(vorher);
        } catch (fehler: unknown) {
          await speicherFehler(
            Promise.reject(fehler),
            'quotaExceeded',
            SPEICHER_MELDUNG.quotaExceeded,
          );
          expect(await dbHash(f), `Schreibstelle ${String(k + 1)}: nichts geschrieben`).toBe(hash);
          stellen += 1;
        }
        voll.entschaerfen();
      }
      expect(gelungen).toBe(true);
      expect(stellen, 'mindestens eine Schreibstelle').toBeGreaterThan(0);
      gleich(vorhanden(await store.load(A)).plan, r.plan);
      expect(vorhanden(await store.load(A)).revision).toBe(1);
    });
  });

  it('[R-5.6-14] commitAtomic mit standRecord bei vollem Speicher → quotaExceeded, nichts geschrieben; danach undo und redo um die letzte gespeicherte Änderung', async () => {
    await mitVollemSpeicher(async (voll) => {
      const f = voll.fabrik;
      const store = await oeffnen(f);
      const uhr = new TestUhr(zeitpunkt('2026-10-06', 9));
      const d0 = (await store.create(planA(), uhr)).plan;
      const d1 = (await speichern(store, A, motto('Gespeichert (fiktiv)'), uhr)).result.plan;
      uhr.setze(zeitpunkt('2026-10-07', 9));
      const geladen = vorhanden(await store.load(A));
      const auftrag = standAuftrag(geladen.plan, { standId: 'stand-voll' });

      const hash = await dbHash(f);
      voll.arm();
      const e = await speicherFehler(
        store.commitAtomic(
          A,
          { expectedRevision: geladen.revision, restorePoint: 'stand', ...auftrag },
          uhr,
        ),
        'quotaExceeded',
        SPEICHER_MELDUNG.quotaExceeded,
      );
      expect(e.planName).toBeNull();
      expect(voll.ausgeloest()).toBe(1);
      expect(await dbHash(f), 'nichts geschrieben').toBe(hash);
      expect(await store.standRecords(A)).toEqual([]);

      voll.entschaerfen();
      gleich(
        vorhanden(await store.undo(A, uhr)).plan,
        d0,
        'undo = Stand vor der letzten gespeicherten Änderung',
      );
      gleich(vorhanden(await store.redo(A, uhr)).plan, d1);
    });
  });

  it('[R-5.6-14] commitAtomic mit standRecord: QuotaExceededError an jeder Schreibstelle → nichts geschrieben; ohne Fehler Stand gespeichert', async () => {
    await mitVollemSpeicher(async (voll) => {
      const f = voll.fabrik;
      const store = await oeffnen(f);
      const uhr = new TestUhr(zeitpunkt('2026-10-06', 9));
      await store.create(planA(), uhr);
      await speichern(store, A, motto('Gespeichert (fiktiv)'), uhr);
      uhr.setze(zeitpunkt('2026-10-07', 9));
      const geladen = vorhanden(await store.load(A));
      const auftrag = standAuftrag(geladen.plan, { standId: 'stand-voll', version: 2 });
      const standPunkteVorher = (await rohPunkte(f, A)).filter((p) => p.reason === 'stand');
      expect(standPunkteVorher).toEqual([]);
      let gelungen = false;
      let stellen = 0;
      for (let k = 0; k < HOECHSTENS && !gelungen; k++) {
        const hash = await dbHash(f);
        const vorher = voll.ausgeloest();
        voll.arm(k);
        try {
          await store.commitAtomic(
            A,
            { expectedRevision: geladen.revision, restorePoint: 'stand', ...auftrag },
            uhr,
          );
          gelungen = true;
          // Erfolg nur ohne ausgelösten Fehler: ein abgefangener QuotaExceededError wäre eine stille
          // Verwerfung (ADR-006 Punkt 3; TR-E104-06).
          expect(voll.ausgeloest(), 'ohne ausgelösten Fehler gespeichert').toBe(vorher);
        } catch (fehler: unknown) {
          await speicherFehler(Promise.reject(fehler), 'quotaExceeded');
          expect(await dbHash(f), `Schreibstelle ${String(k + 1)}: nichts geschrieben`).toBe(hash);
          stellen += 1;
        }
        voll.entschaerfen();
      }
      expect(gelungen).toBe(true);
      expect(stellen).toBeGreaterThan(0);
      expect((await listStands(store, A)).map((s) => s.standId)).toEqual(['stand-voll']);
      const standPunkte = (await rohPunkte(f, A)).filter((p) => p.reason === 'stand');
      expect(standPunkte, 'genau ein neuer Punkt «stand»').toHaveLength(1);
      expect(standPunkte[0]?.standVersion).toBe(auftrag.standRecord.version);
      gleich(standPunkte[0]?.plan, geladen.plan, 'Punkt «stand» mit dem Dokument davor');
    });
  });
});

describe('Nachtragen nach vollem Speicher (V02, V17, V18)', () => {
  it('[R-5.6-14] rootReplaceResult(D, D′) als ein Schritt: load = D′, undo = D exakt; betroffene Einträge und Tage des ganzen Plans', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const d = (await speichern(store, A, motto('Gespeichert (fiktiv)'), uhr)).result.plan;
    const gespeichert = vorhanden(await store.load(A));
    const befehle = [
      titel('e101', 'Ungespeichert (fiktiv)'),
      (p: Plan) => deleteEntries(p, ['e111'], ctx),
    ];
    const dStrich = nacheinander(d, befehle).at(-1)?.plan ?? d;
    ungleich(dStrich, d);

    const r = rootReplaceResult(d, dStrich, 'Nicht gespeicherte Änderungen nachgetragen');
    expect(r.plan).toBe(dStrich);
    expect(r.label).toBe('Nicht gespeicherte Änderungen nachgetragen');
    expect(r.patches).toEqual([{ op: 'replace', path: [], value: dStrich }]);
    expect(r.inversePatches).toEqual([{ op: 'replace', path: [], value: d }]);
    const ids = [...new Set([...Object.keys(d.entries), ...Object.keys(dStrich.entries)])].sort();
    expect(r.affectedEntryIds).toEqual(ids);
    expect(r.affectedEntryIds).toContain('e111');
    const tage = [
      ...new Set([...d.weeks, ...dStrich.weeks].flatMap((w) => [...weekDates(w.startDate)])),
    ].sort();
    expect(r.affectedDates).toEqual(tage);
    expect(r.affectedDates).toHaveLength(28);

    const s = await store.commit(A, r, uhr, { expectedRevision: gespeichert.revision });
    expect(s.revision).toBe(gespeichert.revision + 1);
    gleich(vorhanden(await store.load(A)).plan, dStrich);
    expect(vorhanden(await store.load(A)).history.steps.at(-1)?.label).toBe(
      'Nicht gespeicherte Änderungen nachgetragen',
    );
    const u = vorhanden(await store.undo(A, uhr));
    gleich(u.plan, d, 'undo = D exakt');
    expect(u.plan.nextId).toBe(d.nextId);
  });

  it('[R-5.6-14] rootReplaceResult(D, D) hat leere Patches und Listen, plan === D; commit damit schreibt nichts', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const d = (await store.create(planA(), uhr)).plan;
    const r = rootReplaceResult(
      d,
      structuredClone(d),
      'Nicht gespeicherte Änderungen nachgetragen',
    );
    expect(r.plan).toBe(d);
    expect(r.patches).toEqual([]);
    expect(r.inversePatches).toEqual([]);
    expect(r.affectedDates).toEqual([]);
    expect(r.affectedEntryIds).toEqual([]);
    expect(r.label).toBe('Nicht gespeicherte Änderungen nachgetragen');
    const hash = await dbHash(f);
    const s = await store.commit(A, r, uhr, { expectedRevision: 0 });
    expect(s.seq).toBe(0);
    expect(s.revision).toBe(0);
    expect(await dbHash(f)).toBe(hash);
  });

  it('[R-5.6-14] restore eines Punkts, dessen Dokument dem aktuellen gleicht → trotzdem Punkt «restore», neuer Schritt, Revision + 1', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const d0 = (await store.create(planA(), uhr)).plan;
    const punkt = await store.createRestorePoint(A, 'import', uhr);
    const r = await store.restore(A, punkt.id, uhr);
    expect(r.revision).toBe(1);
    expect(r.seq).toBe(1);
    gleich(r.plan, d0);
    expect(r.history.steps.map((s) => s.label)).toEqual([
      'Wiederherstellungspunkt wiederhergestellt',
    ]);
    expect((await store.listRestorePoints(A)).map((p) => p.reason)).toContain('restore');
    const u = vorhanden(await store.undo(A, uhr));
    gleich(u.plan, d0);
    expect(u.revision).toBe(2);
  });

  it('[R-5.6-14] exportPlanFile mit override: Datei mit D′ und den Ständen aus dem Speicher; override.plan.id anders → RangeError', async () => {
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    await store.create(planA(), uhr);
    const stand = await standSetzen(store, A, uhr, { standId: 'stand-1' });
    const gespeichert = vorhanden(await store.load(A));
    const dStrich = titel('e101', 'Nur auf der Seite (fiktiv)')(gespeichert.plan).plan;
    uhr.setze(zeitpunkt('2026-10-07', 10));
    const hash = await dbHash(f);
    const exp = await store.exportPlanFile(A, uhr, {
      override: {
        plan: dStrich,
        revision: gespeichert.revision,
        modifiedAt: zeitpunkt('2026-10-07', 10),
      },
    });
    expect(await dbHash(f), 'exportPlanFile liest nur').toBe(hash);
    const datei = parsePlanFile(exp.bytes);
    gleich(datei.plan, dStrich);
    expect(datei.revision).toBe(gespeichert.revision);
    expect(datei.modifiedAt).toBe(zeitpunkt('2026-10-07', 10));
    expect(datei.savedAt).toBe(zeitpunkt('2026-10-07', 10));
    expect(datei.stands.map((s) => s.standId)).toEqual(['stand-1']);
    for (const [k, b] of stand.standRecord.pdfs) gleicheBytes(datei.stands[0]?.pdfs.get(k), b);
    gleicheBytes(
      (await standPdf(store, A, 'stand-1', { kind: 'plan' })).bytes,
      datei.stands[0]?.pdfs.get('plan'),
    );
    expect(exp.fileName).toBe('01_02_WAP_FDT_2026_Plan_2026-10-07.wap.json');
    await bereichsFehler(
      store.exportPlanFile(A, uhr, {
        override: {
          plan: { ...dStrich, id: 'p-anders' },
          revision: 1,
          modifiedAt: zeitpunkt('2026-10-07', 10),
        },
      }),
    );
  });
});
