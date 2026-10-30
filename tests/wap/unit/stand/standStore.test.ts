// @vitest-environment jsdom
// Paket E1-05: Stand atomar setzen und gespeicherte Stände lesen, über den Port StandStore (Vertrag
// docs/wap-planer/plan/vertraege/E1-05.md, Notiz «Ausarbeitung Schritt 2» Abschnitte B, C1, C2, D3–D6, E, F, G).
// R-5.5-03 (Ergebnis von setNewStand), R-5.5-04 (1) (gespeicherte Fassung eingefroren), R-5.5-05 (ein Plan für
// alle Varianten), R-5.6-07 (Wiederherstellungspunkt), R-6-10 (Titel, exportTitle, Pflichtfall (e)), R-6-12
// (standsSameDay, Pflichtfälle (b), (c), (d) erster Satz; listStands, standPdf). In-Memory-Double und
// Prüf-Renderer nach Abschnitt H; alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  exportTitle,
  listStands,
  nextStandsSameDay,
  prepareStandRecord,
  StandError,
  setNewStand,
  standPdf,
} from '../../../../src/io/wap-plan/standStore';
import { WapError } from '../../../../src/model/wap/errors';
import type { PdfTarget } from '../../../../src/model/wap/stand/fileName';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Plan } from '../../../../src/model/wap/types';
import {
  aufzeichnung,
  bytesFuer,
  neuerStore,
  planMitInhalt,
  schritte,
  setzen,
  titelAendern,
} from '../../support/stand/ablauf';
import { StandStoreDouble } from '../../support/stand/double';
import {
  ablehnungVon,
  beobachte,
  fehlerVon,
  kopie,
  sha256,
  shaJeSchluessel,
  Tor,
  UUID_V4,
} from '../../support/stand/hilfen';
import { MELDUNG } from '../../support/stand/meldungen';
import { ctx, DATUM, JETZT, PLAN_ID, pruefPlan, wocheId } from '../../support/stand/plan';
import { PruefRenderer } from '../../support/stand/renderer';

const P0 = pruefPlan();
const KVK_ID = wocheId(P0, 'KVK');
const WO1_ID = wocheId(P0, 'Wo1');
const WO2_ID = wocheId(P0, 'Wo2');
const WO3_ID = wocheId(P0, 'Wo3');
const WO1: PdfTarget = { kind: 'week', weekId: WO1_ID };
const PLAN: PdfTarget = { kind: 'plan' };
const SCHLUESSEL = [KVK_ID, WO1_ID, WO2_ID, WO3_ID, 'plan'];

function erwarteStandError(
  e: unknown,
  code: StandError['code'],
  variant: string | null = null,
): StandError {
  expect(e).toBeInstanceOf(StandError);
  expect(e).toBeInstanceOf(WapError);
  const f = e as StandError;
  expect(f.code).toBe(code);
  expect(f.variant).toBe(variant);
  expect(f.userMessage).toEqual(MELDUNG[code]);
  return f;
}

describe('setNewStand: Ergebnis und Schreibauftrag (C1 Punkte 7–9)', () => {
  it('[R-5.5-03] Ergebnis: recordId und standId UUID v4 und verschieden; planId; date/version aus dem Stand; plan = Dokument nach dem Stand; hiddenBySeq null; standsSameDay 1; seq, savedAt und revision aus commitAtomic', async () => {
    const plan = planMitInhalt();
    const store = neuerStore(plan);
    const render = new PruefRenderer();
    const rec = await setzen(store, render);
    expect(rec.recordId).toMatch(UUID_V4);
    expect(rec.standId).toMatch(UUID_V4);
    expect(rec.recordId).not.toBe(rec.standId);
    expect(rec.planId).toBe(PLAN_ID);
    expect([rec.date, rec.version]).toEqual([DATUM, 1]);
    expect(rec.plan).toEqual(applyStand(plan, { date: DATUM }, ctx).plan);
    expect(rec.plan.stand).toEqual({ date: DATUM, version: 1 });
    expect(rec.hiddenBySeq).toBeNull();
    expect(rec.standsSameDay).toBe(1);
    const schritt = store.schritte(PLAN_ID).at(-1);
    expect(rec.seq).toBe(schritt?.seq);
    expect(rec.savedAt).toBe(JETZT.toISOString());
    expect(rec.revision).toBe(1);
    expect(rec.revision).toBe(store.revision(PLAN_ID));
  });

  it('[R-5.5-03] Schreibauftrag: genau ein commitAtomic mit standRecord { recordId, standId, date, version, snapshot, pdfs, standsSameDay }; pdfs ist dieselbe Map wie im Ergebnis, Schlüssel Wochen in Planreihenfolge, dann «plan»', async () => {
    const store = neuerStore();
    const render = new PruefRenderer();
    const rec = await setzen(store, render);
    const commits = store.commits();
    expect(commits).toHaveLength(1);
    const w = commits[0]?.write;
    expect(w?.standRecord.recordId).toBe(rec.recordId);
    expect(w?.standRecord.standId).toBe(rec.standId);
    expect(w?.standRecord.date).toBe(DATUM);
    expect(w?.standRecord.version).toBe(1);
    expect(w?.standRecord.snapshot).toEqual(rec.plan);
    expect(w?.standRecord.standsSameDay).toBe(1);
    expect(w?.standRecord.pdfs).toBe(rec.pdfs);
    expect([...rec.pdfs.keys()]).toEqual(SCHLUESSEL);
    expect(Object.keys(w?.standRecord ?? {}).sort()).toEqual(
      ['date', 'pdfs', 'recordId', 'snapshot', 'standId', 'standsSameDay', 'version'].sort(),
    );
  });

  it('[R-5.5-03] Port: genau load, standRecords, commitAtomic in dieser Reihenfolge; die Uhr geht nur an commitAtomic', async () => {
    const store = neuerStore();
    // Zählende Uhr: jeder Aufruf liefert eine Minute später (TR-E105-04).
    let uhrAufrufe = 0;
    const uhr = {
      now: (): Date => new Date(Date.UTC(2026, 8, 17, 9, 15 + uhrAufrufe++)),
    };
    const rec = await setNewStand(store, PLAN_ID, { date: DATUM }, new PruefRenderer(), uhr, {
      ctx,
    });
    expect(store.methoden()).toEqual(['load', 'standRecords', 'commitAtomic']);
    expect(store.commits()[0]?.clock).toBe(uhr);
    expect(uhrAufrufe, 'Uhr genau einmal gelesen (durch commitAtomic im Double)').toBe(1);
    expect(rec.savedAt).toBe('2026-09-17T09:15:00.000Z');
  });

  it('[R-5.5-03] setNewStand wirft nie synchron: unbekannter Plan → abgelehntes Promise mit planNotFound', async () => {
    const store = new StandStoreDouble();
    let p: Promise<unknown> | undefined;
    expect(
      fehlerVon(() => {
        p = setzen(store, new PruefRenderer());
      }),
    ).toBeUndefined();
    erwarteStandError(await ablehnungVon(p as Promise<unknown>), 'planNotFound');
  });

  it('[R-5.5-04] die gespeicherte Fassung bleibt nach einer weiteren Änderung über das Double gleich: plan strukturell gleich record.plan, Bytes je Schlüssel gleich (SHA-256)', async () => {
    const store = neuerStore();
    const rec = await setzen(store, new PruefRenderer());
    const planKopie = kopie(rec.plan);
    const sha = shaJeSchluessel(rec.pdfs);
    store.aendern(PLAN_ID, titelAendern('e101', 'Ausbildung KVK geändert (fiktiv)'));
    expect(store.dokument(PLAN_ID)).not.toEqual(planKopie);
    const gespeichert = (await store.standRecords(PLAN_ID)).find(
      (r) => r.recordId === rec.recordId,
    );
    expect(gespeichert?.visible).toBe(true);
    expect(gespeichert?.plan).toEqual(planKopie);
    expect(gespeichert?.plan).toEqual(rec.plan);
    expect(shaJeSchluessel(gespeichert?.pdfs ?? new Map())).toEqual(sha);
    const wo1 = await standPdf(store, PLAN_ID, rec.standId, WO1);
    expect(sha256(wo1.bytes)).toBe(sha.find(([k]) => k === WO1_ID)?.[1]);
  });

  it('[R-5.6-07] genau ein commitAtomic mit restorePoint «stand», expectedRevision = R0 und result.plan = record.plan; im Double genau ein neuer Wiederherstellungspunkt «stand» mit dem Dokument von R0 und genau ein neuer Schritt «Stand V1 vom 17.09.2026 gesetzt»', async () => {
    const store = neuerStore();
    store.aendern(PLAN_ID, titelAendern('e101', 'Vorher 1 (fiktiv)'));
    store.aendern(PLAN_ID, titelAendern('e111', 'Vorher 2 (fiktiv)'));
    const r0 = store.revision(PLAN_ID);
    expect(r0).toBe(2);
    const dokumentR0 = kopie(store.dokument(PLAN_ID));
    const vorher = store.zaehler(PLAN_ID);
    const rec = await setzen(store, new PruefRenderer());
    const commits = store.commits();
    expect(commits).toHaveLength(1);
    expect(commits[0]?.write?.restorePoint).toBe('stand');
    expect(commits[0]?.write?.expectedRevision).toBe(r0);
    expect(commits[0]?.write?.result.plan).toEqual(rec.plan);
    const nachher = store.zaehler(PLAN_ID);
    expect(nachher.wiederherstellungspunkte).toBe(vorher.wiederherstellungspunkte + 1);
    expect(nachher.schritte).toBe(vorher.schritte + 1);
    expect(nachher.aufzeichnungen).toBe(vorher.aufzeichnungen + 1);
    const punkt = store.wiederherstellungspunkte(PLAN_ID).at(-1);
    expect(punkt?.grund).toBe('stand');
    expect(punkt?.dokument).toEqual(dokumentR0);
    expect(store.schritte(PLAN_ID).at(-1)?.label).toBe('Stand V1 vom 17.09.2026 gesetzt');
    expect(rec.revision).toBe(r0 + 1);
  });
});

describe('setNewStand: Rendern (C1 Punkt 5)', () => {
  it('[R-5.5-05] jeder Renderer-Aufruf erhält dasselbe Dokument nach dem Stand: Wochen in Planreihenfolge, dann Gesamt-PDF, je mit stand { 2026-09-17, V1 }', async () => {
    const store = neuerStore();
    const render = new PruefRenderer();
    const rec = await setzen(store, render);
    expect(render.aufrufe.map((a) => [a.art, a.weekId])).toEqual([
      ['week', KVK_ID],
      ['week', WO1_ID],
      ['week', WO2_ID],
      ['week', WO3_ID],
      ['plan', null],
    ]);
    for (const a of render.aufrufe) {
      expect(a.stand).toEqual({ date: DATUM, version: 1 });
      expect(a.plan).toEqual(rec.plan);
    }
  });

  it('[R-6-10] Titel je Variante = pdfFileName(Dokument nach dem Stand, Ziel, n) ohne «.pdf»', async () => {
    const store = neuerStore();
    const render = new PruefRenderer();
    await setzen(store, render);
    expect(render.aufrufe.map((a) => a.title)).toEqual([
      '01_02_WAP_FDT_2026_KVK_Stand_2026-09-17',
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17',
      '01_02_WAP_FDT_2026_Wo2_Stand_2026-09-17',
      '01_02_WAP_FDT_2026_Wo3_Stand_2026-09-17',
      '01_02_WAP_FDT_2026_Plan_Stand_2026-09-17',
    ]);
  });

  it('[R-6-12] zweiter Stand am selben Tag (V2): Titel aller Varianten mit «_V2»; pdfs je Schlüssel unverändert wie vom Renderer geliefert', async () => {
    const store = neuerStore();
    const geliefert = new Map<string, Uint8Array>();
    const ersterRenderer = new PruefRenderer();
    await setzen(store, ersterRenderer);
    const render = new PruefRenderer();
    SCHLUESSEL.forEach((k, i) => {
      const bytes = Uint8Array.from(new TextEncoder().encode(`fiktive Bytes ${k}`));
      geliefert.set(k, bytes);
      render.bei(i + 1, { liefern: bytes });
    });
    const rec = await setzen(store, render);
    expect(render.aufrufe.map((a) => a.title)).toEqual([
      '01_02_WAP_FDT_2026_KVK_Stand_2026-09-17_V2',
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V2',
      '01_02_WAP_FDT_2026_Wo2_Stand_2026-09-17_V2',
      '01_02_WAP_FDT_2026_Wo3_Stand_2026-09-17_V2',
      '01_02_WAP_FDT_2026_Plan_Stand_2026-09-17_V2',
    ]);
    expect(rec.standsSameDay).toBe(2);
    for (const k of SCHLUESSEL) expect(rec.pdfs.get(k)).toBe(geliefert.get(k));
  });

  it('[R-5.5-04] nacheinander: ein Renderer-Aufruf beginnt erst, wenn der vorige erfüllt ist', async () => {
    const store = neuerStore();
    const tor = new Tor();
    const render = new PruefRenderer().bei(1, { tor });
    const b = beobachte(setzen(store, render));
    const erster = await Promise.race([tor.erreicht.then(() => 'erreicht'), b.erledigt]);
    expect(erster).toBe('erreicht');
    await new Promise<void>((r) => {
      setTimeout(r, 20);
    });
    expect(render.aufrufe).toHaveLength(1);
    tor.oeffnen();
    const ergebnis = await b.erledigt;
    expect(ergebnis.ok).toBe(true);
    expect(render.aufrufe).toHaveLength(5);
  });
});

describe('Mehrere Stände am selben Tag (R-6-12, F-24 b; Notiz E1-02f)', () => {
  it('[R-6-12] gezählt wird am Datum des neuen Stands: A am 17.09., B am 18.09. → B standsSameDay 1; C wieder am 17.09. → 2 mit «_V3»', async () => {
    const store = neuerStore();
    const a = await setzen(store, new PruefRenderer());
    const b = await setzen(store, new PruefRenderer(), { date: '2026-09-18' });
    const c = await setzen(store, new PruefRenderer());
    expect([a.standsSameDay, b.standsSameDay, c.standsSameDay]).toEqual([1, 1, 2]);
    expect((await standPdf(store, PLAN_ID, b.standId, WO1)).fileName).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-18.pdf',
    );
    expect((await standPdf(store, PLAN_ID, c.standId, WO1)).fileName).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V3.pdf',
    );
  });

  it('[R-6-12] (V-02f-4) eine durch hiddenBySeq ausgeblendete Aufzeichnung zählt erst wieder, wenn der ausblendende Schritt rückgängig gemacht ist', async () => {
    const store = neuerStore();
    const [, s2] = schritte(store, 2) as [number, number];
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-x', standId: 'S-X', seq: 0, version: 1, hiddenBySeq: s2 }),
    );
    expect(await nextStandsSameDay(store, PLAN_ID, DATUM)).toBe(1);
    store.undo(PLAN_ID);
    expect(await nextStandsSameDay(store, PLAN_ID, DATUM)).toBe(2);
    const b = await setzen(store, new PruefRenderer(), { date: DATUM, version: 2 });
    expect(b.standsSameDay).toBe(2);
    const liste = await listStands(store, PLAN_ID);
    expect(liste.map((s) => [s.standId, s.standsSameDay])).toEqual([
      [b.standId, 2],
      ['S-X', 1],
    ]);
  });

  it('[R-6-12] nextStandsSameDay: eine sichtbare und eine ausgeblendete Aufzeichnung am Datum → 2 (V-02f-4)', async () => {
    const store = neuerStore();
    const [s1, s2] = schritte(store, 2);
    store.undo(PLAN_ID);
    store.ablegen(PLAN_ID, aufzeichnung({ recordId: 'r-a', standId: 'S-A', seq: s1 as number }));
    store.ablegen(PLAN_ID, aufzeichnung({ recordId: 'r-b', standId: 'S-B', seq: s2 as number }));
    expect(store.aufzeichnungen(PLAN_ID).map((r) => r.visible)).toEqual([true, false]);
    expect(await nextStandsSameDay(store, PLAN_ID, DATUM)).toBe(2);
  });

  it('[R-6-12] nextStandsSameDay: zählt verschiedene standId der sichtbaren Aufzeichnungen des Datums; anderes Datum und durch hiddenBySeq ausgeblendete zählen nicht; standRecords genau einmal (V-02f-4)', async () => {
    const store = neuerStore();
    const [s1, s2] = schritte(store, 2) as [number, number];
    store.ablegen(PLAN_ID, aufzeichnung({ recordId: 'r-a1', standId: 'S-A', seq: s1 }));
    store.ablegen(PLAN_ID, aufzeichnung({ recordId: 'r-a2', standId: 'S-A', seq: s2 }));
    store.ablegen(PLAN_ID, aufzeichnung({ recordId: 'r-b', standId: 'S-B', seq: 0 }));
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-c', standId: 'S-C', seq: s1, hiddenBySeq: s2 }),
    );
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-d', standId: 'S-D', seq: s1, date: '2026-09-18' }),
    );
    store.aufrufe.length = 0;
    expect(await nextStandsSameDay(store, PLAN_ID, DATUM)).toBe(3);
    expect(store.methoden()).toEqual(['standRecords']);
    expect(await nextStandsSameDay(store, PLAN_ID, '2026-09-18')).toBe(2);
    expect(await nextStandsSameDay(store, PLAN_ID, '2026-09-19')).toBe(1);
  });

  it('[R-6-12] nextStandsSameDay: Fehler des Ports wird als dasselbe Objekt abgelehnt', async () => {
    const store = neuerStore();
    const e = new Error('Port nicht lesbar (fiktiv)');
    store.fehler.standRecords = e;
    expect(await ablehnungVon(nextStandsSameDay(store, PLAN_ID, DATUM))).toBe(e);
  });

  it('[R-6-12] Pflichtfall (b): Stand A (V1) und Stand B (V2) am selben Tag → A standsSameDay 1, Name ohne «_V»; B 2, Name endet auf «_Stand_2026-09-17_V2.pdf»', async () => {
    const store = neuerStore();
    const a = await setzen(store, new PruefRenderer());
    const b = await setzen(store, new PruefRenderer());
    expect([a.version, b.version]).toEqual([1, 2]);
    expect(a.standsSameDay).toBe(1);
    expect(b.standsSameDay).toBe(2);
    const nameA = (await standPdf(store, PLAN_ID, a.standId, WO1)).fileName;
    const nameB = (await standPdf(store, PLAN_ID, b.standId, WO1)).fileName;
    expect(nameA).toBe('01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17.pdf');
    expect(nameA).not.toContain('_V');
    expect(nameB.endsWith('_Stand_2026-09-17_V2.pdf')).toBe(true);
    expect(nameB).toBe('01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V2.pdf');
  });

  it('[R-6-12] Pflichtfall (c) (V-02f-4): Stand A, Undo im Double, Stand B am selben Tag → B standsSameDay 1, ohne «_V»', async () => {
    const store = neuerStore();
    await setzen(store, new PruefRenderer());
    store.undo(PLAN_ID);
    const b = await setzen(store, new PruefRenderer());
    expect(b.version).toBe(1);
    expect(b.standsSameDay).toBe(1);
    const name = (await standPdf(store, PLAN_ID, b.standId, PLAN)).fileName;
    expect(name).toBe('01_02_WAP_FDT_2026_Plan_Stand_2026-09-17.pdf');
  });

  it('[R-6-12] Pflichtfall (d) erster Satz: Stand X, Stand A am selben Tag, Undo, Redo → A wieder sichtbar mit unverändertem standsSameDay 2; X unverändert 1', async () => {
    const store = neuerStore();
    const x = await setzen(store, new PruefRenderer());
    const a = await setzen(store, new PruefRenderer());
    expect(a.standsSameDay).toBe(2);
    store.undo(PLAN_ID);
    expect((await listStands(store, PLAN_ID)).map((s) => s.standId)).toEqual([x.standId]);
    store.redo(PLAN_ID);
    const liste = await listStands(store, PLAN_ID);
    expect(liste.map((s) => [s.standId, s.standsSameDay])).toEqual([
      [a.standId, 2],
      [x.standId, 1],
    ]);
    expect((await standPdf(store, PLAN_ID, a.standId, WO1)).fileName).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V2.pdf',
    );
  });

  it('[R-6-12] Pflichtfall (d): eine abgelegte sichtbare Aufzeichnung mit standsSameDay 3 als einzige des Tages → listStands und standPdf verwenden 3, Name mit «_V5»', async () => {
    const store = neuerStore();
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-x', standId: 'S-X', seq: 0, version: 5, standsSameDay: 3 }),
    );
    expect((await listStands(store, PLAN_ID)).map((s) => s.standsSameDay)).toEqual([3]);
    expect((await standPdf(store, PLAN_ID, 'S-X', WO1)).fileName).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V5.pdf',
    );
    expect(await nextStandsSameDay(store, PLAN_ID, DATUM)).toBe(2);
  });
});

/**
 * Aufzeichnungen für listStands/standPdf (D4, D5): Schritte 1–6, Schritt 6 rückgängig (nicht angewendet).
 * Sichtbar: r-a, r-b1, r-b2 (S-B), r-e (seq 0), r-f, r-g1, r-g2 (S-G, gleiche seq), r-h (hiddenBySeq 6 nicht
 * angewendet), r-i, r-j. Ausgeblendet: r-c (seq 6 nicht angewendet), r-d (hiddenBySeq 5 angewendet).
 */
function storeMitAufzeichnungen(): StandStoreDouble {
  const store = neuerStore();
  schritte(store, 6);
  store.undo(PLAN_ID);
  const ab = (r: Parameters<typeof aufzeichnung>[0]): void =>
    store.ablegen(PLAN_ID, aufzeichnung(r));
  ab({ recordId: 'r-a', standId: 'S-A', version: 1, date: '2026-09-15', seq: 1 });
  ab({ recordId: 'r-b1', standId: 'S-B', version: 2, date: DATUM, seq: 2, standsSameDay: 1 });
  ab({ recordId: 'r-b2', standId: 'S-B', version: 2, date: DATUM, seq: 4, standsSameDay: 2 });
  ab({ recordId: 'r-c', standId: 'S-C', version: 3, date: DATUM, seq: 6 });
  ab({ recordId: 'r-d', standId: 'S-D', version: 3, date: '2026-09-16', seq: 3, hiddenBySeq: 5 });
  ab({ recordId: 'r-e', standId: 'S-E', version: 3, date: '2026-09-16', seq: 0 });
  ab({ recordId: 'r-f', standId: 'S-F', version: 3, date: '2026-09-18', seq: 3 });
  ab({ recordId: 'r-g2', standId: 'S-G', version: 2, date: DATUM, seq: 5 });
  ab({ recordId: 'r-g1', standId: 'S-G', version: 2, date: DATUM, seq: 5 });
  ab({ recordId: 'r-i', standId: 'S-I', version: 3, date: '2026-09-18', seq: 5 });
  ab({ recordId: 'r-h', standId: 'S-H', version: 3, date: '2026-09-18', seq: 5, hiddenBySeq: 6 });
  // Datumskriterium (TR-E105-02): gleiche Version wie r-a, früheres Datum, aber grössere seq → nach r-a.
  ab({ recordId: 'r-j', standId: 'S-J', version: 1, date: '2026-09-14', seq: 5 });
  store.aufrufe.length = 0;
  return store;
}

describe('listStands (D4)', () => {
  it('[R-6-12] nur sichtbare, je standId eine (grösste seq, bei Gleichstand kleinste recordId), sortiert nach version ab, date ab, seq ab, recordId auf', async () => {
    const store = storeMitAufzeichnungen();
    const liste = await listStands(store, PLAN_ID);
    expect(liste.map((s) => s.recordId)).toEqual([
      'r-h',
      'r-i',
      'r-f',
      'r-e',
      'r-g1',
      'r-b2',
      'r-a',
      'r-j',
    ]);
    expect(store.methoden()).toEqual(['standRecords']);
  });

  it('[R-6-12] jedes Element hat genau die Schlüssel recordId, standId, planId, date, version, seq, hiddenBySeq, standsSameDay mit den gespeicherten Werten', async () => {
    const store = storeMitAufzeichnungen();
    const liste = await listStands(store, PLAN_ID);
    for (const s of liste) {
      expect(Object.keys(s).sort()).toEqual(
        [
          'date',
          'hiddenBySeq',
          'planId',
          'recordId',
          'seq',
          'standId',
          'standsSameDay',
          'version',
        ].sort(),
      );
    }
    expect(liste.find((s) => s.recordId === 'r-b2')).toEqual({
      recordId: 'r-b2',
      standId: 'S-B',
      planId: PLAN_ID,
      date: DATUM,
      version: 2,
      seq: 4,
      hiddenBySeq: null,
      standsSameDay: 2,
    });
    expect(liste.find((s) => s.recordId === 'r-h')?.hiddenBySeq).toBe(6);
  });

  it('[R-6-12] unbekannter Plan → leere Liste; Fehler des Ports als dasselbe Objekt', async () => {
    const store = storeMitAufzeichnungen();
    expect(await listStands(store, 'p-unbekannt')).toEqual([]);
    const e = new Error('Port nicht lesbar (fiktiv)');
    store.fehler.standRecords = e;
    expect(await ablehnungVon(listStands(store, PLAN_ID))).toBe(e);
  });
});

describe('standPdf (D5)', () => {
  it('[R-6-12] mehrere sichtbare Aufzeichnungen derselben standId → die mit der grössten seq: Bytes und Name aus ihr (standsSameDay 2 → «_V2»)', async () => {
    const store = storeMitAufzeichnungen();
    const r = await standPdf(store, PLAN_ID, 'S-B', WO1);
    expect(r.bytes).toEqual(bytesFuer('r-b2', WO1_ID));
    expect(r.fileName).toBe('01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V2.pdf');
    expect(store.methoden()).toEqual(['standRecords']);
  });

  it('[R-6-12] gleiche seq → kleinste recordId (r-g1 vor r-g2)', async () => {
    const store = storeMitAufzeichnungen();
    const r = await standPdf(store, PLAN_ID, 'S-G', PLAN);
    expect(r.bytes).toEqual(bytesFuer('r-g1', 'plan'));
    expect(r.fileName).toBe('01_02_WAP_FDT_2026_Plan_Stand_2026-09-17.pdf');
  });

  it('[R-6-12] ausgeblendete (seq nicht angewendet, hiddenBySeq angewendet) oder unbekannte standId → standNotFound', async () => {
    const store = storeMitAufzeichnungen();
    for (const standId of ['S-C', 'S-D', 'S-unbekannt']) {
      erwarteStandError(
        await ablehnungVon(standPdf(store, PLAN_ID, standId, WO1)),
        'standNotFound',
      );
    }
    const r = await standPdf(store, PLAN_ID, 'S-H', WO1);
    expect(r.bytes).toEqual(bytesFuer('r-h', WO1_ID));
  });

  it('[R-6-12] fehlende Woche → variantNotStored mit variant = weekId; fehlendes Gesamt-PDF → variant «plan»; unbekannte weekId → variantNotStored vor jeder Namensbildung', async () => {
    const store = neuerStore();
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-1', standId: 'S-1', seq: 0, ohne: [WO3_ID, 'plan'] }),
    );
    erwarteStandError(
      await ablehnungVon(standPdf(store, PLAN_ID, 'S-1', { kind: 'week', weekId: WO3_ID })),
      'variantNotStored',
      WO3_ID,
    );
    erwarteStandError(
      await ablehnungVon(standPdf(store, PLAN_ID, 'S-1', PLAN)),
      'variantNotStored',
      'plan',
    );
    erwarteStandError(
      await ablehnungVon(standPdf(store, PLAN_ID, 'S-1', { kind: 'week', weekId: 'w-fehlt' })),
      'variantNotStored',
      'w-fehlt',
    );
    const ok = await standPdf(store, PLAN_ID, 'S-1', WO1);
    expect(ok.bytes).toEqual(bytesFuer('r-1', WO1_ID));
  });

  it('[R-6-12] Fehler des Ports als dasselbe Objekt', async () => {
    const store = storeMitAufzeichnungen();
    const e = new Error('Port nicht lesbar (fiktiv)');
    store.fehler.standRecords = e;
    expect(await ablehnungVon(standPdf(store, PLAN_ID, 'S-A', WO1))).toBe(e);
  });
});

describe('exportTitle (D6, Notiz E1-02f)', () => {
  it('[R-6-10] Pflichtfall (e): exportTitle der Arbeitsfassung direkt nach einem Stand = standPdf(…).fileName ohne «.pdf», für «Wo1» und «plan», auch beim zweiten Stand des Tages', async () => {
    const store = neuerStore();
    for (let i = 0; i < 2; i++) {
      const rec = await setzen(store, new PruefRenderer());
      for (const ziel of [WO1, PLAN]) {
        const name = (await standPdf(store, PLAN_ID, rec.standId, ziel)).fileName;
        expect(name.endsWith('.pdf')).toBe(true);
        expect(await exportTitle(store, PLAN_ID, store.dokument(PLAN_ID), ziel)).toBe(
          name.slice(0, -4),
        );
      }
    }
    expect(await exportTitle(store, PLAN_ID, store.dokument(PLAN_ID), WO1)).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V2',
    );
  });

  it('[R-6-10] (V-05-1) ohne Stand → Entwurfsform ohne Zugriff auf den Speicher', async () => {
    const store = neuerStore();
    expect(await exportTitle(store, PLAN_ID, P0, WO1)).toBe('01_02_WAP_FDT_2026_Wo1_Entwurf');
    expect(await exportTitle(store, PLAN_ID, P0, PLAN)).toBe('01_02_WAP_FDT_2026_Plan_Entwurf');
    expect(store.aufrufe).toHaveLength(0);
  });

  it('[R-6-12] Stand ohne passende sichtbare Aufzeichnung (z.B. aus einer Datei) → n 1, ohne «_V»; standRecords genau einmal', async () => {
    const store = neuerStore();
    const plan: Plan = { ...P0, stand: { date: DATUM, version: 4 } };
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-1', standId: 'S-1', seq: 0, version: 3, standsSameDay: 2 }),
    );
    store.ablegen(
      PLAN_ID,
      aufzeichnung({
        recordId: 'r-2',
        standId: 'S-2',
        seq: 0,
        version: 4,
        date: '2026-09-18',
        standsSameDay: 2,
      }),
    );
    store.aufrufe.length = 0;
    expect(await exportTitle(store, PLAN_ID, plan, WO1)).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17',
    );
    expect(store.methoden()).toEqual(['standRecords']);
  });

  it('[R-6-12] Kandidaten nur sichtbare mit date und version wie plan.stand: ausgeblendete, andere Version und anderes Datum zählen nicht', async () => {
    const store = neuerStore();
    const [s1, , s3] = schritte(store, 3) as [number, number, number];
    store.undo(PLAN_ID);
    const plan: Plan = { ...P0, stand: { date: DATUM, version: 4 } };
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-1', standId: 'S-1', seq: s1, version: 4, standsSameDay: 1 }),
    );
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-3', standId: 'S-3', seq: s3, version: 4, standsSameDay: 5 }),
    );
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-4', standId: 'S-4', seq: 0, version: 3, standsSameDay: 2 }),
    );
    store.ablegen(
      PLAN_ID,
      aufzeichnung({
        recordId: 'r-5',
        standId: 'S-5',
        seq: 0,
        version: 4,
        date: '2026-09-18',
        standsSameDay: 2,
      }),
    );
    expect(await exportTitle(store, PLAN_ID, plan, WO1)).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17',
    );
  });

  it('[R-6-12] Wahl unter den Kandidaten: grösste seq vor kleinerer seq', async () => {
    const store = neuerStore();
    const [s1, s2] = schritte(store, 2) as [number, number];
    const plan: Plan = { ...P0, stand: { date: DATUM, version: 4 } };
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-1', standId: 'S-1', seq: s1, version: 4, standsSameDay: 1 }),
    );
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-2', standId: 'S-2', seq: s2, version: 4, standsSameDay: 2 }),
    );
    expect(await exportTitle(store, PLAN_ID, plan, WO1)).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V4',
    );
    const umgekehrt = neuerStore();
    const [t1, t2] = schritte(umgekehrt, 2) as [number, number];
    umgekehrt.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-1', standId: 'S-1', seq: t1, version: 4, standsSameDay: 2 }),
    );
    umgekehrt.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-2', standId: 'S-2', seq: t2, version: 4, standsSameDay: 1 }),
    );
    expect(await exportTitle(umgekehrt, PLAN_ID, plan, WO1)).toBe(
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17',
    );
  });

  it('[R-6-12] gleiche seq: das grössere standsSameDay entscheidet vor der recordId (2 vor 1 → mit «_V»)', async () => {
    const store = neuerStore();
    const plan: Plan = { ...P0, stand: { date: DATUM, version: 4 } };
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-a', standId: 'S-A', seq: 0, version: 4, standsSameDay: 1 }),
    );
    store.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-b', standId: 'S-B', seq: 0, version: 4, standsSameDay: 2 }),
    );
    expect(await exportTitle(store, PLAN_ID, plan, PLAN)).toBe(
      '01_02_WAP_FDT_2026_Plan_Stand_2026-09-17_V4',
    );
    // Umgekehrte Einfügereihenfolge (TR-E105-03): erst standsSameDay 2, dann 1 → weiterhin «_V4».
    const umgekehrt = neuerStore();
    umgekehrt.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-b', standId: 'S-B', seq: 0, version: 4, standsSameDay: 2 }),
    );
    umgekehrt.ablegen(
      PLAN_ID,
      aufzeichnung({ recordId: 'r-a', standId: 'S-A', seq: 0, version: 4, standsSameDay: 1 }),
    );
    expect(await exportTitle(umgekehrt, PLAN_ID, plan, PLAN)).toBe(
      '01_02_WAP_FDT_2026_Plan_Stand_2026-09-17_V4',
    );
  });

  it('[R-6-10] Fehler aus pdfFileName als Ablehnung (unbekannte Woche, auch ohne Stand); Fehler des Ports als dasselbe Objekt', async () => {
    const store = neuerStore();
    for (const plan of [P0, { ...P0, stand: { date: DATUM, version: 1 } }]) {
      let p: Promise<string> | undefined;
      expect(
        fehlerVon(() => {
          p = exportTitle(store, PLAN_ID, plan, { kind: 'week', weekId: 'w-fehlt' });
        }),
      ).toBeUndefined();
      const e = await ablehnungVon(p as Promise<string>);
      expect((e as { code?: unknown }).code).toBe('unknownWeek');
    }
    const fehler = new Error('Port nicht lesbar (fiktiv)');
    store.fehler.standRecords = fehler;
    expect(
      await ablehnungVon(
        exportTitle(store, PLAN_ID, { ...P0, stand: { date: DATUM, version: 1 } }, WO1),
      ),
    ).toBe(fehler);
  });
});

describe('prepareStandRecord (C2, Import-Stand E1-08)', () => {
  const nachStand = (): Plan => applyStand(planMitInhalt(), { date: DATUM }, ctx).plan;

  it('[R-5.5-05] rendert alle Varianten aus demselben Dokument: Wochen in Planreihenfolge, dann Gesamt-PDF; Ergebnis { pdfs } mit diesen Schlüsseln; kein Speicher', async () => {
    const plan = nachStand();
    const render = new PruefRenderer();
    const r = await prepareStandRecord(plan, render, 1);
    expect(Object.keys(r)).toEqual(['pdfs']);
    expect([...r.pdfs.keys()]).toEqual(SCHLUESSEL);
    expect(render.aufrufe.map((a) => a.weekId)).toEqual([KVK_ID, WO1_ID, WO2_ID, WO3_ID, null]);
    for (const a of render.aufrufe) expect(a.plan).toEqual(plan);
  });

  it('[R-6-12] n = standsSameDay steuert die Titel: n 2 → «…_Stand_2026-09-17_V1»', async () => {
    const render = new PruefRenderer();
    await prepareStandRecord(nachStand(), render, 2);
    expect(render.aufrufe.map((a) => a.title)).toEqual([
      '01_02_WAP_FDT_2026_KVK_Stand_2026-09-17_V1',
      '01_02_WAP_FDT_2026_Wo1_Stand_2026-09-17_V1',
      '01_02_WAP_FDT_2026_Wo2_Stand_2026-09-17_V1',
      '01_02_WAP_FDT_2026_Wo3_Stand_2026-09-17_V1',
      '01_02_WAP_FDT_2026_Plan_Stand_2026-09-17_V1',
    ]);
  });

  it('[R-6-12] Plan ohne Stand oder standsSameDay keine sichere ganze Zahl ≥ 1 → Ablehnung RangeError (nie synchron), kein Renderer-Aufruf', async () => {
    const render = new PruefRenderer();
    const faelle: [Plan, number][] = [
      [planMitInhalt(), 1],
      [nachStand(), 0],
      [nachStand(), 1.5],
      [nachStand(), -1],
      [nachStand(), Number.NaN],
      [nachStand(), 2 ** 53],
    ];
    for (const [plan, n] of faelle) {
      let p: Promise<unknown> | undefined;
      expect(
        fehlerVon(() => {
          p = prepareStandRecord(plan, render, n);
        }),
      ).toBeUndefined();
      expect(await ablehnungVon(p as Promise<unknown>), `n = ${String(n)}`).toBeInstanceOf(
        RangeError,
      );
    }
    expect(render.aufrufe).toHaveLength(0);
  });

  it('[R-5.5-04] schon abgebrochenes signal → aborted, kein Renderer-Aufruf', async () => {
    const render = new PruefRenderer();
    const ac = new AbortController();
    ac.abort();
    erwarteStandError(
      await ablehnungVon(prepareStandRecord(nachStand(), render, 1, ac.signal)),
      'aborted',
    );
    expect(render.aufrufe).toHaveLength(0);
  });

  it('[R-5.5-04] Abbruch, während ein Renderer aussteht → aborted ohne Warten; danach kein Renderer-Aufruf', async () => {
    const tor = new Tor();
    const render = new PruefRenderer().bei(2, { tor });
    const ac = new AbortController();
    const b = beobachte(prepareStandRecord(nachStand(), render, 1, ac.signal));
    expect(await Promise.race([tor.erreicht.then(() => 'erreicht'), b.erledigt])).toBe('erreicht');
    ac.abort();
    const r = await b.erledigt;
    expect(r.ok).toBe(false);
    erwarteStandError(r.ok ? undefined : r.fehler, 'aborted');
    tor.oeffnen();
    await new Promise<void>((res) => {
      setTimeout(res, 20);
    });
    expect(render.aufrufe).toHaveLength(2);
  });

  it('[R-5.5-04] Renderer lehnt ab → renderFailed mit variant und cause; kein weiterer Renderer', async () => {
    const e = new Error('Renderer-Fehler (fiktiv)');
    const render = new PruefRenderer().bei(5, { ablehnen: e });
    const f = erwarteStandError(
      await ablehnungVon(prepareStandRecord(nachStand(), render, 1)),
      'renderFailed',
      'plan',
    );
    expect(f.cause).toBe(e);
    expect(render.aufrufe).toHaveLength(5);
  });
});
