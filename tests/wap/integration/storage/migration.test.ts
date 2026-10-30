// @vitest-environment jsdom
// Paket E1-04: Migrations-Fixture der Etappe 1 und Formatversion (Vertrag docs/wap-planer/plan/vertraege/E1-04.md,
// Notiz «Ausarbeitung Schritt 2» Abschnitte C3, C7, F1–F5, G1, K1, L R-H-33 Nr 1–8 und 4a, M2; Prompt §7 Migration;
// ADR-006 Punkt 2c; ADR-007 Punkt 2 mit Änderungsnotiz E1-04; Arbeitsannahme Q-047 für F5). Testformat v2 über die
// Prüfnaht F1 (tests/wap/support/storage/format.ts). Alle Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import {
  CURRENT_FORMAT,
  migratePlanFile,
  migrationBackupFileName,
  type PlanFile,
  parsePlanFile,
  serializeLegacyPlanFile,
  serializePlanFile,
} from '../../../../src/io/wap-plan/planFile';
import { listStands, standPdf } from '../../../../src/io/wap-plan/standStore';
import { DB_NAME } from '../../../../src/io/wap-plan/store';
import { ModelError } from '../../../../src/model/wap/errors';
import type { Entry, Plan } from '../../../../src/model/wap/types';
import { sha256 } from '../../support/stand/hilfen';
import {
  datenbankVersion,
  datensaetze,
  dbHash,
  neueFabrik,
  oeffnen,
  planDatensatz,
  rohPunkt,
  werteVonPlan,
} from '../../support/storage/datenbank';
import { FIXTURE_PLAN_ID, fixtureBytes, fixtureRoh } from '../../support/storage/fixture';
import {
  identitaetsFormat,
  KENNWORT,
  MOTTO_ZUSATZ,
  mottoFormat,
  mottoMigration,
  testFormatV2,
} from '../../support/storage/format';
import {
  migrationFailedMeldung,
  neuereVersionMeldung,
  SPEICHER_MELDUNG,
} from '../../support/storage/meldungen';
import {
  A,
  alsText,
  jsonBytes,
  motto,
  PLAN_B_ID,
  planA,
  planB,
  planDatei,
  rohDatei,
  speichern,
  standSetzen,
} from '../../support/storage/plaene';
import {
  dateiFehler,
  gleich,
  gleicheBytes,
  speicherFehler,
  vorhanden,
  wurf,
} from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

function alleEintraege(plan: Plan): Entry[] {
  return [...Object.values(plan.entries), ...plan.deletedWeeks.flatMap((d) => d.entries)];
}

/**
 * Zwei Pläne in einem Speicher v1: A mit Stand (älter), B ohne Stand (neuer). B ist neuer, aber nach Plan-ID der
 * zweite; so unterscheidet die Reihenfolge der Sicherungen «modifiedAt absteigend» von «planId» (TR-E104-12).
 */
async function zweiPlaeneV1(
  f: IDBFactory,
  uhr: TestUhr,
  b: Plan = planB(),
): Promise<{ readonly a: Plan; readonly b: Plan }> {
  const s1 = await oeffnen(f);
  uhr.setze(zeitpunkt('2026-10-05', 9));
  await s1.create(planA(), uhr);
  await standSetzen(s1, A, uhr, { standId: 'stand-a' });
  uhr.setze(zeitpunkt('2026-10-05', 10));
  await s1.create(b, uhr);
  const a = vorhanden(await s1.load(A)).plan;
  const bb = vorhanden(await s1.load(PLAN_B_ID)).plan;
  s1.close();
  return { a, b: bb };
}

describe('Migrations-Fixture der Etappe 1 (M2)', () => {
  it('[R-H-33] Fixture: parsePlanFile ohne Fehler und mit allen Pflichtinhalten; serialisieren → lesen strukturell gleich; zweites Serialisieren bytegleich', () => {
    const datei = parsePlanFile(fixtureBytes());
    const plan = datei.plan;
    expect(datei.planId).toBe(FIXTURE_PLAN_ID);
    expect(datei.version).toBe(1);
    expect(datei.containsInternalNotes).toBe(true);

    // Pflichtinhalte nach M2 (die Fixture deckt das Schema ab).
    const e = alleEintraege(plan);
    expect(new Set(e.map((x) => x.type))).toEqual(
      new Set(['block', 'querbalken', 'marker', 'rapport', 'beso', 'dayRemark', 'multiDayRemark']),
    );
    const zeiten = e.flatMap((x) =>
      x.type === 'beso' ? x.windows.map((w) => w.time) : 'time' in x ? [x.time] : [],
    );
    expect(new Set(zeiten.map((t) => t.form))).toEqual(
      new Set(['point', 'range', 'from', 'until', 'deadline']),
    );
    const fristen = zeiten.filter((t) => t.form === 'deadline');
    expect(fristen.some((t) => 'to' in t && t.to !== undefined)).toBe(true);
    expect(fristen.some((t) => !Object.hasOwn(t, 'to'))).toBe(true);
    const auswahl = e.flatMap((x) => ('columns' in x ? [x.columns.kind] : []));
    expect(new Set(auswahl)).toEqual(new Set(['all', 'ids']));
    expect(new Set(e.flatMap((x) => (x.type === 'multiDayRemark' ? [x.scope.kind] : [])))).toEqual(
      new Set(['plan', 'week', 'range']),
    );
    expect(new Set(e.flatMap((x) => (x.type === 'marker' ? [x.kind] : [])))).toEqual(
      new Set(['AV', 'ABV', 'HV', 'custom']),
    );
    expect(new Set(e.flatMap((x) => (x.type === 'rapport' ? [x.display] : [])))).toEqual(
      new Set(['rapColumn', 'alsoInColumns', 'onlyInColumns']),
    );
    expect(new Set(e.map((x) => x.status))).toEqual(new Set(['confirmed', 'open', 'cancelled']));
    expect(e.some((x) => 'title' in x && x.title.some((r) => typeof r.besoRef === 'string'))).toBe(
      true,
    );
    const besos = e.filter((x) => x.type === 'beso');
    expect(besos.map((b) => (b.type === 'beso' ? b.agendaOverride === null : null)).sort()).toEqual(
      [false, true],
    );
    expect(besos.map((b) => (b.type === 'beso' ? b.besoNumber === null : null)).sort()).toEqual([
      false,
      true,
    ]);
    const bloecke = e.filter((x) => x.type === 'block');
    const mitTeil = bloecke.filter((b) => b.type === 'block' && b.subtasks !== undefined);
    expect(mitTeil).toHaveLength(1);
    const teile = mitTeil[0]?.type === 'block' ? (mitTeil[0].subtasks ?? []) : [];
    expect(teile).toHaveLength(2);
    expect(
      teile.some(
        (t) =>
          t.ltg !== '' &&
          t.ort !== '' &&
          t.title.some((r) => r.bold) &&
          t.title.some((r) => !r.bold),
      ),
    ).toBe(true);
    expect(teile.some((t) => t.ltg === '' && t.ort === '')).toBe(true);
    expect(bloecke.some((b) => !Object.hasOwn(b, 'subtasks'))).toBe(true);
    expect(Object.keys(plan.abbreviationMeanings ?? {}).sort()).toEqual(['DR', 'Ukft']);
    expect(plan.deletedWeeks.some((d) => d.entries.length > 0)).toBe(true);
    expect(plan.acknowledgedFindings.length).toBeGreaterThan(0);
    expect(plan.persons.length).toBeGreaterThan(0);
    const ziele = plan.weeks.flatMap((w) => w.weekGoals);
    expect(
      ziele.some((g) => g.group === null) && ziele.some((g) => typeof g.group === 'string'),
    ).toBe(true);
    const sonne = plan.weeks.flatMap((w) => [w.sunOverride.sunrise, w.sunOverride.sunset]);
    expect(sonne.some((x) => x === null) && sonne.some((x) => typeof x === 'number')).toBe(true);
    expect(plan.stand).not.toBeNull();
    expect(plan.signatureImage?.mime).toBe('image/png');
    expect(plan.coatOfArms?.mime).toBe('image/png');
    expect(datei.stands).toHaveLength(1);
    expect([...(datei.stands[0]?.pdfs.keys() ?? [])]).toEqual([plan.weeks[0]?.id ?? '', 'plan']);

    const uhr = new TestUhr(zeitpunkt('2026-10-07', 12));
    const bytes1 = serializePlanFile(datei, uhr);
    const zurueck = parsePlanFile(bytes1);
    gleich(zurueck.plan, datei.plan, 'Rundreise ohne Feldverlust');
    gleich(zurueck.stands[0]?.plan, datei.stands[0]?.plan);
    expect(zurueck.revision).toBe(datei.revision);
    expect(zurueck.modifiedAt).toBe(datei.modifiedAt);
    expect(zurueck.containsInternalNotes).toBe(true);
    for (const [k, b] of datei.stands[0]?.pdfs ?? [])
      gleicheBytes(zurueck.stands[0]?.pdfs.get(k), b);
    const block = Object.values(zurueck.plan.entries).filter((x) => x.type === 'block');
    expect(block.filter((b) => Object.hasOwn(b, 'subtasks'))).toHaveLength(1);
    expect(zurueck.plan.abbreviationMeanings).toEqual(datei.plan.abbreviationMeanings);
    const bytes2 = serializePlanFile(zurueck, new TestUhr(zeitpunkt('2026-10-07', 12)));
    expect(Array.from(bytes2), 'zweites Serialisieren bytegleich').toEqual(Array.from(bytes1));

    // Kanonische Form nach D3/E4 für jedes Objekt (auch Woche, TextRun, Commander): Die Fixture ist kanonisch
    // geschrieben (JSON.stringify mit Einzug 2 und LF am Ende); mit ihrem savedAt serialisiert ergibt sie genau
    // ihren Text ohne den abschliessenden Zeilenumbruch (C1 (4); TR-E104-05).
    const fixtureText = alsText(fixtureBytes());
    expect(fixtureText.endsWith('}\n')).toBe(true);
    expect(
      alsText(serializePlanFile(datei, new TestUhr(datei.savedAt))),
      'Serialisieren der Fixture = Fixture-Text (kanonische Schlüsselreihenfolge)',
    ).toBe(fixtureText.slice(0, -1));
  });

  it('[R-H-33] Fixture → openFromFile → exportPlanFile → parsePlanFile: Plan strukturell gleich, Stand-Bytes gleich', async () => {
    const datei = parsePlanFile(fixtureBytes());
    const store = await oeffnen(neueFabrik());
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 12));
    await store.openFromFile(datei, uhr);
    const exp = await store.exportPlanFile(FIXTURE_PLAN_ID, uhr);
    const zurueck = parsePlanFile(exp.bytes);
    gleich(zurueck.plan, datei.plan);
    expect(zurueck.revision).toBe(datei.revision);
    expect(zurueck.modifiedAt).toBe(datei.modifiedAt);
    expect(zurueck.stands.map((s) => s.standId)).toEqual(['stand-fixture-1']);
    gleich(zurueck.stands[0]?.plan, datei.stands[0]?.plan);
    for (const [k, b] of datei.stands[0]?.pdfs ?? [])
      gleicheBytes(zurueck.stands[0]?.pdfs.get(k), b);
    expect(exp.containsInternalNotes).toBe(true);
    expect(exp.fileName).toBe('01_02_WAP_FDT_2026_Plan_2026-10-07.wap.json');
  });

  it('[R-H-33] Fixture mit version + 1 → newerVersion; Datei- und DB-Hash gleich', async () => {
    expect(parsePlanFile(fixtureBytes()).version).toBe(1);
    const f = neueFabrik();
    const store = await oeffnen(f);
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 12));
    await store.create(planA(), uhr);
    const dbVorher = await dbHash(f);
    const roh = fixtureRoh();
    roh.version = Number(roh.version) + 1;
    const bytes = jsonBytes(roh);
    const shaVorher = sha256(bytes);
    const e = dateiFehler(() => parsePlanFile(bytes), 'newerVersion', neuereVersionMeldung(2, 1));
    expect(e.version).toBe(2);
    expect(sha256(bytes)).toBe(shaVorher);
    expect(await dbHash(f)).toBe(dbVorher);
  });
});

describe('Umstellung des Speichers über die Prüfnaht F1', () => {
  it('[R-H-33] Speicher v1 mit zwei Plänen, Öffnen mit v2 (Motto-Migration, additive false): migrationPending; pendingMigration mit Sicherungen; runMigration mit Fortschritt; Punkt «migration» mit altem Dokument; Stände sichtbar', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    const alt = await zweiPlaeneV1(f, uhr);
    const standBytes = (await standPdfBytes(f, A)).plan;
    expect(await datenbankVersion(f)).toBe(1);

    const s2 = await oeffnen(f, mottoFormat());
    const m = SPEICHER_MELDUNG.migrationPending;
    await speicherFehler(s2.load(A), 'migrationPending', m);
    await speicherFehler(s2.listPlans(), 'migrationPending', m);
    await speicherFehler(s2.commit(A, motto('X')(alt.a), uhr), 'migrationPending', m);
    expect(await s2.persistence()).toEqual({
      persisted: false,
      usageBytes: null,
      quotaBytes: null,
      nearFull: false,
    });
    expect(await s2.requestPersistence()).toBe(false);

    uhr.setze(zeitpunkt('2026-10-07', 12));
    const pm = vorhanden(await s2.pendingMigration(uhr));
    expect(pm.fromVersion).toBe(1);
    expect(pm.toVersion).toBe(2);
    expect(A < PLAN_B_ID, 'Plan-ID von A kommt zuerst').toBe(true);
    expect(
      pm.backups.map((b) => b.planId),
      'modifiedAt absteigend (B ist neuer)',
    ).toEqual([PLAN_B_ID, A]);
    const [bb, ba] = [vorhanden(pm.backups[0]), vorhanden(pm.backups[1])];
    expect(ba.planName).toBe('FDT 2026');
    expect(bb.planName).toBe('WK 2027 «ZWEI»');
    expect(ba.standLabel).toBe('Stand V1 vom 17.09.2026');
    expect(bb.standLabel).toBeNull();
    expect(ba.fileName).toBe('01_02_WAP_FDT_2026_Plan_vor-Update_Format1_2026-10-07.wap.json');
    expect(bb.fileName).toBe('01_02_WAP_WK_2027_Plan_vor-Update_Format1_2026-10-07.wap.json');
    expect(bb.modifiedAt).toBe(zeitpunkt('2026-10-05', 10));
    expect(ba.modifiedAt).toBe(zeitpunkt('2026-10-05', 9));
    const sicherungA = parsePlanFile(ba.bytes(), CURRENT_FORMAT);
    gleich(sicherungA.plan, alt.a, 'Sicherung = altes Dokument');
    expect(sicherungA.savedAt).toBe(zeitpunkt('2026-10-07', 12));
    expect(sicherungA.stands.map((s) => s.standId)).toEqual(['stand-a']);
    gleicheBytes(sicherungA.stands[0]?.pdfs.get('plan'), standBytes);
    gleich(parsePlanFile(bb.bytes(), CURRENT_FORMAT).plan, alt.b);
    expect(Array.from(ba.bytes()), 'bytes() je Aufruf gleich').toEqual(Array.from(ba.bytes()));
    expect(await datenbankVersion(f), 'pendingMigration liest nur').toBe(1);

    const fortschritt: { done: number; total: number }[] = [];
    await s2.runMigration(uhr, (p) => fortschritt.push({ ...p }));
    expect(fortschritt).toEqual([
      { done: 1, total: 2 },
      { done: 2, total: 2 },
    ]);
    expect(await datenbankVersion(f)).toBe(2);
    gleich(vorhanden(await s2.load(A)).plan, mottoMigration(alt.a));
    gleich(vorhanden(await s2.load(PLAN_B_ID)).plan, mottoMigration(alt.b));
    expect(vorhanden(await s2.load(A)).plan.motto).toBe(`${alt.a.motto}${MOTTO_ZUSATZ}`);
    for (const [id, dok] of [
      [A, alt.a],
      [PLAN_B_ID, alt.b],
    ] as const) {
      const punkte = (await s2.listRestorePoints(id)).filter((p) => p.reason === 'migration');
      expect(punkte, `${id}: genau ein Punkt «migration»`).toHaveLength(1);
      expect(punkte[0]?.formatVersion).toBe(1);
      gleich((await rohPunkt(f, String(punkte[0]?.id))).plan, dok);
    }
    const staende = await listStands(s2, A);
    expect(staende.map((s) => s.standId)).toEqual(['stand-a']);
    const rec = vorhanden((await s2.standRecords(A))[0]);
    expect(rec.visible).toBe(true);
    expect(rec.plan.motto, 'Schnappschuss migriert (F3 (3))').toBe(`${alt.a.motto}${MOTTO_ZUSATZ}`);
    gleicheBytes((await standPdf(s2, A, 'stand-a', { kind: 'plan' })).bytes, standBytes);
    expect(await s2.pendingMigration(uhr), 'nach der Umstellung').toBeNull();
  });

  it('[R-H-33] (Q-047) Historie bei der Migration: additive true mit Identitätsmigration → Historie unverändert, Undo/Redo wie vorher; additive false mit Motto-Migration → Undo leer, Redo-Zweig verworfen, nextSeq bleibt', async () => {
    // (i) Identitätsmigration (additive: true). E4 lässt in Etappe 1 kein weiteres Feld zu; eine echt ergänzende
    // Migration ist deshalb nicht baubar, die Umstellung ist hier die Identität.
    const f1 = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-06', 9));
    const v1 = await oeffnen(f1);
    const d0 = (await v1.create(planA(), uhr)).plan;
    const d1 = (await speichern(v1, A, motto('Schritt 1 (fiktiv)'), uhr)).result.plan;
    await standSetzen(v1, A, uhr, { standId: 'stand-redo' });
    const d2 = vorhanden(await v1.load(A)).plan;
    vorhanden(await v1.undo(A, uhr));
    const historieVorher = vorhanden(await v1.load(A)).history;
    expect(historieVorher.cursor).toBe(1);
    expect(historieVorher.nextSeq).toBe(3);
    const rohVorher = await datensaetze(f1, 'history');
    const kopfVorher = vorhanden(await planDatensatz(f1, A)).historyHead;
    v1.close();

    const id = await oeffnen(f1, identitaetsFormat());
    uhr.setze(zeitpunkt('2026-10-07', 9));
    await id.runMigration(uhr);
    expect(await datensaetze(f1, 'history'), 'Schritt-Datensätze unverändert').toEqual(rohVorher);
    expect(vorhanden(await planDatensatz(f1, A)).historyHead).toEqual(kopfVorher);
    const historieNachher = vorhanden(await id.load(A)).history;
    expect(historieNachher.cursor).toBe(1);
    expect(historieNachher.nextSeq).toBe(3);
    expect(historieNachher.steps.map((s) => s.seq)).toEqual([1, 2]);
    gleich(vorhanden(await id.undo(A, uhr)).plan, d0, 'undo nach der Umstellung wie vorher');
    gleich(vorhanden(await id.redo(A, uhr)).plan, d1);
    gleich(vorhanden(await id.redo(A, uhr)).plan, d2, 'redo des Redo-Zweigs wie vorher');
    expect((await listStands(id, A)).map((s) => s.standId)).toEqual(['stand-redo']);

    // (ii) Motto-Migration (additive: false): strukturelle Umstellung → Schnitt.
    const f2 = neueFabrik();
    uhr.setze(zeitpunkt('2026-10-06', 9));
    const w1 = await oeffnen(f2);
    await w1.create(planA(), uhr);
    await speichern(w1, A, motto('Schritt 1 (fiktiv)'), uhr);
    await standSetzen(w1, A, uhr, { standId: 'stand-redo' });
    vorhanden(await w1.undo(A, uhr));
    w1.close();
    const w2 = await oeffnen(f2, mottoFormat());
    uhr.setze(zeitpunkt('2026-10-07', 9));
    await w2.runMigration(uhr);
    const h = vorhanden(await w2.load(A)).history;
    expect(h).toEqual({ steps: [], cursor: 0, nextSeq: 3, truncatedThroughSeq: 1 });
    expect(await w2.undo(A, uhr)).toBeNull();
    expect(await w2.redo(A, uhr)).toBeNull();
    expect(await w2.standRecords(A), 'Aufzeichnung des Redo-Zweigs gelöscht').toEqual([]);
    expect(await werteVonPlan(f2, 'history', A)).toEqual([]);
    expect(vorhanden(await planDatensatz(f2, A)).historyHead).toEqual({
      cursor: 0,
      nextSeq: 3,
      truncatedThroughSeq: 1,
    });
    const weiter = await speichern(w2, A, motto('Nach der Umstellung (fiktiv)'), uhr);
    expect(weiter.seq, 'seq wird nie wiederverwendet').toBe(3);
  });

  it('[R-H-33] runMigration scheitert am zweiten Plan → migrationFailed mit Anzeigename, Speicher unverändert; mit v1 liest die alte Version beide Pläne unverändert', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    const alt = await zweiPlaeneV1(f, uhr, planB({ motto: `Motto ${KENNWORT} (fiktiv)` }));
    const s2 = await oeffnen(f, mottoFormat());
    expect(vorhanden(await s2.pendingMigration(uhr)).backups).toHaveLength(2);
    const hash = await dbHash(f);
    const e = await speicherFehler(
      s2.runMigration(uhr),
      'migrationFailed',
      migrationFailedMeldung('WK 2027 «ZWEI»'),
    );
    expect(e.planName).toBe('WK 2027 «ZWEI»');
    expect(e.cause).toBeInstanceOf(Error);
    expect(await datenbankVersion(f)).toBe(1);
    expect(await dbHash(f), 'Speicher unverändert').toBe(hash);
    await speicherFehler(s2.load(A), 'migrationPending');
    s2.close();

    const v1 = await oeffnen(f);
    gleich(vorhanden(await v1.load(A)).plan, alt.a);
    gleich(vorhanden(await v1.load(PLAN_B_ID)).plan, alt.b);
    expect((await v1.listRestorePoints(A)).map((p) => p.reason)).not.toContain('migration');
  });

  it('[R-H-33] restore eines Punkts mit formatVersion 1 nach der Migration → Dokument migriert', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    const v1 = await oeffnen(f);
    await v1.create({ ...planA(), motto: 'Alt (fiktiv)' }, uhr);
    const punkt = await v1.createRestorePoint(A, 'import', uhr);
    expect(punkt.formatVersion).toBe(1);
    await speichern(v1, A, motto('Neu (fiktiv)'), uhr);
    v1.close();

    const v2 = await oeffnen(f, mottoFormat());
    uhr.setze(zeitpunkt('2026-10-07', 9));
    await v2.runMigration(uhr);
    expect(vorhanden(await v2.load(A)).plan.motto).toBe('Neu (fiktiv) (v2)');
    const info = (await v2.listRestorePoints(A)).find((p) => p.id === punkt.id);
    expect(info?.formatVersion, 'gespeicherte Version').toBe(1);
    const r = await v2.restore(A, punkt.id, uhr);
    expect(r.plan.motto).toBe('Alt (fiktiv) (v2)');
    gleich(vorhanden(await v2.load(A)).plan, r.plan);
    expect(vorhanden(await v2.undo(A, uhr)).plan.motto).toBe('Neu (fiktiv) (v2)');
    const neuePunkte = (await v2.listRestorePoints(A)).filter((p) => p.reason === 'restore');
    expect(neuePunkte[0]?.formatVersion, 'neue Punkte in der Zielversion').toBe(2);
  });

  it('[R-H-33] blocked ist endgültig (Nachtrag F3): runMigration bei offenem anderem Tab → blocked; nach dem Schliessen keine Umstellung im Hintergrund; ein zweiter runMigration stellt um', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    const s1 = await oeffnen(f);
    const alt = (await s1.create(planA(), uhr)).plan;
    s1.close();
    // Rohe Verbindung ohne onversionchange-Behandlung: blockiert jeden Versionswechsel.
    const andererTab = await new Promise<IDBDatabase>((res, rej) => {
      const r = f.open(DB_NAME);
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const s2 = await oeffnen(f, mottoFormat());
    uhr.setze(zeitpunkt('2026-10-07', 9));
    let hash = '';
    try {
      expect(vorhanden(await s2.pendingMigration(uhr)).fromVersion).toBe(1);
      hash = await dbHash(f);
      const e = await speicherFehler(s2.runMigration(uhr), 'blocked', SPEICHER_MELDUNG.blocked);
      expect(e.code).toBe('blocked');
    } finally {
      andererTab.close();
    }

    const pm = vorhanden(await s2.pendingMigration(uhr), 'weiterhin Umstellung offen');
    expect(pm.fromVersion).toBe(1);
    expect(pm.toVersion).toBe(2);
    expect(await datenbankVersion(f), 'keine Umstellung im Hintergrund').toBe(1);
    expect(
      await dbHash(f),
      'Speicher unverändert (kein Punkt «migration», Motto unverändert)',
    ).toBe(hash);
    await speicherFehler(s2.load(A), 'migrationPending');

    await s2.runMigration(uhr);
    expect(await datenbankVersion(f)).toBe(2);
    expect(vorhanden(await s2.load(A)).plan.motto).toBe(`${alt.motto}${MOTTO_ZUSATZ}`);
    const punkte = (await s2.listRestorePoints(A)).filter((p) => p.reason === 'migration');
    expect(punkte).toHaveLength(1);
    expect(punkte[0]?.formatVersion).toBe(1);
  });

  it('[R-H-33] Datenbank v2, openPlanStore mit v1 → newerSchema', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 9));
    const v2 = await oeffnen(f, mottoFormat());
    await v2.create(planA(), uhr);
    v2.close();
    expect(await datenbankVersion(f)).toBe(2);
    await speicherFehler(oeffnen(f), 'newerSchema', SPEICHER_MELDUNG.newerSchema);
    expect(await datenbankVersion(f), 'ohne mit Version zu öffnen').toBe(2);
    const wieder = await oeffnen(f, mottoFormat());
    expect(vorhanden(await wieder.load(A)).plan.id).toBe(A);
  });

  it('[R-H-33] migrationBackupFileName nach C7; migratePlanFile einer v1-Datei mit Testformat v2 → version 2, Plan und Schnappschüsse migriert; migrate wirft → corrupt mit Pfad plan bzw. stands[0].plan', () => {
    const p = planA();
    expect(migrationBackupFileName(p, 1, '2026-10-01')).toBe(
      '01_02_WAP_FDT_2026_Plan_vor-Update_Format1_2026-10-01.wap.json',
    );
    expect(migrationBackupFileName({ ...p, service: 'FDT/2026' }, 3, '2026-10-01')).toBe(
      '01_02_WAP_FDT_2026_Plan_vor-Update_Format3_2026-10-01.wap.json',
    );
    for (const v of [0, 1.5, -1, Number.NaN]) {
      expect(
        wurf(() => migrationBackupFileName(p, v, '2026-10-01')),
        String(v),
      ).toBeInstanceOf(RangeError);
    }
    const datum = wurf(() => migrationBackupFileName(p, 1, '2026-13-01'));
    expect(datum).toBeInstanceOf(ModelError);
    expect((datum as ModelError).code).toBe('invalidDate');

    const datei: PlanFile = planDatei(p, {
      stands: [
        {
          standId: 'stand-1',
          date: '2026-09-17',
          version: 1,
          standsSameDay: 1,
          plan: { ...p, stand: { date: '2026-09-17', version: 1 } },
          pdfs: new Map([['plan', Uint8Array.from([37, 80, 68, 70])]]),
        },
      ],
    });
    const roh = rohDatei(datei);
    const rohVorher = JSON.stringify(roh);
    const m = migratePlanFile(roh, mottoFormat());
    expect(JSON.stringify(roh), 'Eingabe unverändert').toBe(rohVorher);
    expect(m.version).toBe(2);
    expect(m.plan.motto).toBe(`${p.motto}${MOTTO_ZUSATZ}`);
    gleich(m.plan, mottoMigration(roh.plan));
    expect(m.stands[0]?.plan.motto).toBe(`${p.motto}${MOTTO_ZUSATZ}`);
    gleicheBytes(m.stands[0]?.pdfs.get('plan'), Uint8Array.from([37, 80, 68, 70]));
    expect(migratePlanFile(rohDatei(datei)).version, 'ohne Format: CURRENT_FORMAT').toBe(1);

    const kaputtPlan = rohDatei({ ...datei, plan: { ...p, motto: KENNWORT } });
    const e1 = dateiFehler(() => migratePlanFile(kaputtPlan, mottoFormat()), 'corrupt');
    expect(e1.path).toBe('plan');
    expect(e1.cause).toBeInstanceOf(Error);
    const kaputtStand = rohDatei(datei);
    ((kaputtStand.stands as Record<string, unknown>[])[0]?.plan as Record<string, unknown>).motto =
      KENNWORT;
    expect(dateiFehler(() => migratePlanFile(kaputtStand, mottoFormat()), 'corrupt').path).toBe(
      'stands[0].plan',
    );
    expect(
      wurf(() => migratePlanFile(rohDatei(datei), { version: 2, migrations: [] })),
      'Format mit fehlender Migration',
    ).toBeInstanceOf(RangeError);
    expect(
      parsePlanFile(jsonBytes(rohDatei(datei)), testFormatV2(mottoMigration, false)).version,
    ).toBe(2);
  });

  it('[R-H-33] serializeLegacyPlanFile: Hülle mit alter Version, Dokument ungeprüft und unverändert', () => {
    const p = { ...planA(), zusatzAusAlterVersion: 'bleibt (fiktiv)' } as unknown as Plan;
    const uhr = new TestUhr(zeitpunkt('2026-10-07', 12));
    const bytes = serializeLegacyPlanFile(
      { version: 1, plan: p, revision: 2, modifiedAt: zeitpunkt('2026-10-06', 9), stands: [] },
      uhr,
    );
    expect(uhr.aufrufe).toBe(1);
    const obj = JSON.parse(alsText(bytes)) as Record<string, unknown>;
    expect(Object.keys(obj)).toEqual([
      'format',
      'version',
      'planId',
      'revision',
      'modifiedAt',
      'savedAt',
      'containsInternalNotes',
      'plan',
      'stands',
    ]);
    expect(obj.version).toBe(1);
    expect(obj.savedAt).toBe(zeitpunkt('2026-10-07', 12));
    expect(Object.keys(obj.plan as object), 'gespeicherte Schlüsselreihenfolge').toEqual(
      Object.keys(p),
    );
    expect((obj.plan as Record<string, unknown>).zusatzAusAlterVersion).toBe('bleibt (fiktiv)');
    expect(alsText(bytes).endsWith('}')).toBe(true);
  });
});

/** PDF-Bytes eines Stands roh aus dem Speicher (für Vergleiche über die Umstellung). */
async function standPdfBytes(
  f: IDBFactory,
  planId: string,
): Promise<{ readonly plan: Uint8Array | undefined }> {
  const rec = (await werteVonPlan(f, 'stands', planId))[0];
  const pdfs = rec?.pdfs as Map<string, Uint8Array> | undefined;
  const plan = pdfs?.get('plan');
  return { plan: plan === undefined ? undefined : Uint8Array.from(plan) };
}
