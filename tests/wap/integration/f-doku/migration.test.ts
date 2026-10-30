// @vitest-environment jsdom
// F-DOKU, Befund SA-2-01: Belege für R-5.6-18 und R-L-10 unter den eigenen IDs (bisher nur unter [R-H-33] bzw. [R-L-07]
// geprüft). Prüfart-Abweichung (Katalog E2E → Integration, Begründung im Katalog, Änderungsnotiz F-DOKU): Mit
// Formatversion 1 gibt es in der ausgelieferten App kein älteres Schema, und die Sitzung der Oberfläche hat keine
// Prüfnaht für das Format (Befund FD-01). Geprüft wird deshalb der Speicher über die Prüfnaht F1 (Testformat v2,
// Vertrag E1-04 Notiz «Ausarbeitung Schritt 2»), genau so, wie ihn die Sitzung nutzt (`pendingMigration` beim Start,
// `runMigration` nach dem Entscheid im Dialog, danach Laden). Das Esc-Verhalten des Dialogs prüft der E2E
// `tests/wap-e2e/f-doku/sperre.spec.ts`. Alle Inhalte fiktiv; fiktive lokale Datenbank (fake-indexeddb).
import { describe, expect, it } from 'vitest';
import { CURRENT_FORMAT, parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import type { Plan } from '../../../../src/model/wap/types';
import {
  datenbankVersion,
  dbHash,
  neueFabrik,
  neuLaden,
  oeffnen,
  rohPunkt,
} from '../../support/storage/datenbank';
import { KENNWORT, MOTTO_ZUSATZ, mottoFormat, mottoMigration } from '../../support/storage/format';
import { migrationFailedMeldung, SPEICHER_MELDUNG } from '../../support/storage/meldungen';
import { A, PLAN_B_ID, planA, planB, standSetzen } from '../../support/storage/plaene';
import { gleich, speicherFehler, vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

/** Fiktiver Speicher im Format 1 mit Plan A (mit Stand) und Plan B. */
async function speicherV1(
  f: IDBFactory,
  uhr: TestUhr,
  b: Plan = planB(),
): Promise<{ readonly a: Plan; readonly b: Plan }> {
  const s = await oeffnen(f);
  uhr.setze(zeitpunkt('2026-10-05', 9));
  await s.create(planA(), uhr);
  await standSetzen(s, A, uhr, { standId: 'stand-a' });
  uhr.setze(zeitpunkt('2026-10-05', 10));
  await s.create(b, uhr);
  const a = vorhanden(await s.load(A)).plan;
  const bb = vorhanden(await s.load(PLAN_B_ID)).plan;
  s.close();
  return { a, b: bb };
}

/** Muster des Dateinamens nach R-L-10 (Beilage mit «_», Dienst, Formatversion, Datum). */
const SICHERUNG = /^[^_]+(?:_[^_]+)*_WAP_.+_Plan_vor-Update_Format1_\d{4}-\d{2}-\d{2}\.wap\.json$/;

describe('F-DOKU R-5.6-18: ohne Entscheid im Dialog «Sicherung vor dem Update» öffnet kein Plan', () => {
  it('[R-5.6-18] älteres Schema → Umstellung ausstehend, bevor ein Plan geladen wird; kein Plan lesbar, Datenbank unverändert', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    await speicherV1(f, uhr);
    const vorher = await dbHash(f);
    const s = await oeffnen(f, mottoFormat());
    // Der Dialog erscheint, weil eine Umstellung aussteht (die Sitzung fragt das beim Start zuerst ab).
    expect(await s.pendingMigration(uhr)).not.toBeNull();
    // Ohne Entscheid: weder Liste noch Plan noch Speichern.
    await speicherFehler(s.listPlans(), 'migrationPending', SPEICHER_MELDUNG.migrationPending);
    await speicherFehler(s.load(A), 'migrationPending', SPEICHER_MELDUNG.migrationPending);
    expect(await datenbankVersion(f), 'Schemaversion gleich').toBe(1);
    expect(await dbHash(f), 'Inhalt gleich').toBe(vorher);
    s.close();
  });

  it('[R-5.6-18] Neuladen ohne Entscheid → Umstellung wieder ausstehend (Dialog erneut), Datenbank weiter unverändert', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    await speicherV1(f, uhr);
    const vorher = await dbHash(f);
    const s1 = await oeffnen(f, mottoFormat());
    expect(await s1.pendingMigration(uhr)).not.toBeNull();
    const s2 = await neuLaden(s1, f, mottoFormat());
    const pm = vorhanden(await s2.pendingMigration(uhr), 'nach dem Neuladen');
    expect([pm.fromVersion, pm.toVersion]).toEqual([1, 2]);
    await speicherFehler(s2.load(A), 'migrationPending');
    expect(await datenbankVersion(f)).toBe(1);
    expect(await dbHash(f)).toBe(vorher);
    s2.close();
  });

  it('[R-5.6-18] «Ohne Sicherung fortfahren» (Umstellung ohne Download) → Pläne umgestellt und geöffnet, keine Umstellung mehr ausstehend', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    const alt = await speicherV1(f, uhr);
    const s = await oeffnen(f, mottoFormat());
    expect(await s.pendingMigration(uhr)).not.toBeNull();
    uhr.setze(zeitpunkt('2026-10-07', 12));
    await s.runMigration(uhr);
    expect(await datenbankVersion(f)).toBe(2);
    expect((await s.listPlans()).map((p) => p.id).sort()).toEqual([A, PLAN_B_ID].sort());
    const geladen = vorhanden(await s.load(A)).plan;
    gleich(geladen, mottoMigration(alt.a));
    expect(geladen.motto).toBe(`${alt.a.motto}${MOTTO_ZUSATZ}`);
    expect(await s.pendingMigration(uhr)).toBeNull();
    s.close();
  });
});

describe('F-DOKU R-L-10: Sicherung vor dem Update, Wiederherstellungspunkt und Scheitern', () => {
  it('[R-L-10] je Plan genau eine Sicherung im alten Format; Dateiname nach dem Muster mit Formatversion 1 und Datum', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    const alt = await speicherV1(f, uhr);
    const s = await oeffnen(f, mottoFormat());
    uhr.setze(zeitpunkt('2026-10-07', 12));
    const pm = vorhanden(await s.pendingMigration(uhr));
    expect(pm.backups.map((b) => b.planId).sort()).toEqual([A, PLAN_B_ID].sort());
    for (const b of pm.backups) {
      expect(b.fileName, b.planId).toMatch(SICHERUNG);
      expect(b.fileName.endsWith('_Format1_2026-10-07.wap.json')).toBe(true);
      const roh = JSON.parse(new TextDecoder().decode(b.bytes())) as { version?: unknown };
      expect(roh.version, 'Inhalt im alten Format (Formatversion der Datei)').toBe(1);
      const datei = parsePlanFile(b.bytes(), CURRENT_FORMAT);
      expect(datei.version).toBe(1);
      gleich(datei.plan, b.planId === A ? alt.a : alt.b, 'Sicherung = Dokument vor dem Update');
    }
    expect(new Set(pm.backups.map((b) => b.fileName)).size, 'eindeutige Dateinamen').toBe(2);
    s.close();
  });

  it('[R-L-10] nach der Umstellung je Plan genau ein Wiederherstellungspunkt «migration» mit dem Dokument im alten Format', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    const alt = await speicherV1(f, uhr);
    const s = await oeffnen(f, mottoFormat());
    await s.runMigration(uhr);
    for (const [id, dok] of [
      [A, alt.a],
      [PLAN_B_ID, alt.b],
    ] as const) {
      const punkte = (await s.listRestorePoints(id)).filter((p) => p.reason === 'migration');
      expect(punkte, id).toHaveLength(1);
      expect(punkte[0]?.formatVersion).toBe(1);
      gleich((await rohPunkt(f, String(punkte[0]?.id))).plan, dok);
    }
    s.close();
  });

  it('[R-L-10] Scheitern beim zweiten Plan → Datenbank im alten Format (Schemaversion und Inhalt beider Pläne gleich), Meldung «Update gescheitert» nennt den Plan und den nächsten Schritt', async () => {
    const f = neueFabrik();
    const uhr = new TestUhr(zeitpunkt('2026-10-05', 9));
    const alt = await speicherV1(f, uhr, planB({ motto: `Motto ${KENNWORT} (fiktiv)` }));
    const vorher = await dbHash(f);
    const s = await oeffnen(f, mottoFormat());
    const e = await speicherFehler(
      s.runMigration(uhr),
      'migrationFailed',
      migrationFailedMeldung('WK 2027 «ZWEI»'),
    );
    expect(e.planName).toBe('WK 2027 «ZWEI»');
    expect(e.userMessage.cause).toContain('«WK 2027 «ZWEI»»');
    expect(e.userMessage.nextStep.length).toBeGreaterThan(10);
    expect(await datenbankVersion(f)).toBe(1);
    expect(await dbHash(f)).toBe(vorher);
    s.close();
    const v1 = await oeffnen(f);
    gleich(vorhanden(await v1.load(A)).plan, alt.a);
    gleich(vorhanden(await v1.load(PLAN_B_ID)).plan, alt.b);
    expect((await v1.listRestorePoints(A)).map((p) => p.reason)).not.toContain('migration');
    v1.close();
  });
});
