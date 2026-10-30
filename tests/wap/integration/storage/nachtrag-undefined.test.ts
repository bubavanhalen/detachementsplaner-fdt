// @vitest-environment jsdom
// Paket E1-04b (Nachtrag E1-04, CR-E104-05): Eigene Schlüssel mit dem Wert `undefined` gelten beim Wiederherstellen
// eines Punkts, beim Herstellen eines gelöschten Plans und bei der Umstellung als fehlend, so streng wie beim Sichern
// (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, «Änderungsnotiz Runde 2» R2-0, R2-3, R2-7, R2-8; Katalog-Notiz
// E1-04b R-L-14 mit Zusatz 3). Pflichtfälle N3-a bis N3-c tragen R-L-14 und eine alte ID von E1-04, der Gegenfall
// N3-d nur R-H-33 (Plan Etappe 1 Regel 1.1). Fehler werden als Wert erfasst (R2-0). Schlüssel `zusatz` und alle
// Inhalte fiktiv.
import { describe, expect, it } from 'vitest';
import { StorageError } from '../../../../src/io/wap-plan/store';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { dbHash, neueFabrik, oeffnen } from '../../support/storage/datenbank';
import { MOTTO_ZUSATZ, mottoFormat } from '../../support/storage/format';
import { A, motto, planA, speichern, standSetzen } from '../../support/storage/plaene';
import { gleich, vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

/** Ergebnis oder Ablehnungsgrund eines Promise als Wert. */
async function erfasse<T>(
  p: Promise<T>,
): Promise<{ readonly wert: T | null; readonly fehler: unknown }> {
  try {
    return { wert: await p, fehler: null };
  } catch (fehler: unknown) {
    return { wert: null, fehler };
  }
}

const uhrNeu = (): TestUhr => new TestUhr(zeitpunkt('2026-10-07', 10));

/**
 * Dokument U (R2-3): `planA()` mit dem eigenen Schlüssel `zusatz: undefined` auf der obersten Ebene und im ersten
 * Eintrag e. `basis` ist dasselbe Dokument ohne diese Schlüssel.
 */
function dokumentU(): { readonly u: Plan; readonly basis: Plan; readonly e: Id } {
  const basis = planA();
  const e = vorhanden(Object.keys(basis.entries)[0], 'erster Eintrag');
  const eintraege = basis.entries as unknown as Record<string, object>;
  const u = {
    ...basis,
    zusatz: undefined,
    entries: { ...eintraege, [e]: { ...eintraege[e], zusatz: undefined } },
  } as unknown as Plan;
  return { u, basis, e };
}

/** Kein eigener Schlüssel `zusatz` im Dokument und im Eintrag e. */
function ohneZusatz(p: Plan, e: Id, was: string): void {
  expect(Object.hasOwn(p, 'zusatz'), `${was}: kein eigener Schlüssel zusatz im Dokument`).toBe(
    false,
  );
  const eintrag = vorhanden(
    (p.entries as unknown as Record<string, object>)[e],
    `${was}: Eintrag e`,
  );
  expect(
    Object.hasOwn(eintrag, 'zusatz'),
    `${was}: kein eigener Schlüssel zusatz im Eintrag e`,
  ).toBe(false);
}

/** Kopie von `p` ohne die beiden Schlüssel `zusatz` (oben und im Eintrag e), sonst unverändert. */
function zusatzEntfernt(p: Plan, e: Id): Plan {
  const { zusatz: _oben, ...rest } = p as unknown as Record<string, unknown>;
  const eintraege = { ...(rest.entries as Record<string, Record<string, unknown>>) };
  const { zusatz: _innen, ...eintrag } = vorhanden(eintraege[e], 'Eintrag e');
  eintraege[e] = eintrag;
  return { ...rest, entries: eintraege } as unknown as Plan;
}

describe('E1-04b undefined beim Zurückholen wie fehlend (R2-3)', () => {
  it('[R-L-14][R-5.6-14] restore eines Punkts mit eigenem Schlüssel mit Wert undefined gelingt', async () => {
    const { u, basis, e } = dokumentU();
    const uhr = uhrNeu();
    const store = await oeffnen(neueFabrik());
    await store.create(u, uhr);
    const punkt = await store.createRestorePoint(A, 'adoption', uhr);
    await speichern(store, A, motto('Motto danach (fiktiv)'), uhr);
    const r = await erfasse(store.restore(A, punkt.id, uhr));
    expect(r.fehler, 'kein Fehler bei restore').toBeNull();
    const plan = vorhanden(r.wert).plan;
    gleich(plan, basis, 'Dokument strukturell gleich U ohne die Schlüssel mit Wert undefined');
    ohneZusatz(plan, e, 'Ergebnis von restore');
    ohneZusatz(vorhanden(await store.load(A)).plan, e, 'gespeichertes Dokument');
    store.close();
  });

  it('[R-L-14][R-5.6-08] restoreDeletedPlan mit eigenem Schlüssel mit Wert undefined gelingt', async () => {
    const { u, e } = dokumentU();
    const uhr = uhrNeu();
    const store = await oeffnen(neueFabrik());
    await store.create(u, uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-u' });
    const vorher = vorhanden(await store.load(A)).plan;
    const { restorePointId } = await store.deletePlan(A, uhr);
    const r = await erfasse(store.restoreDeletedPlan(restorePointId, uhr));
    expect(r.fehler, 'kein Fehler bei restoreDeletedPlan').toBeNull();
    const hergestellt = vorhanden(r.wert);
    expect(hergestellt.asCopy, 'nicht als Kopie').toBe(false);
    gleich(
      hergestellt.plan,
      zusatzEntfernt(vorher, e),
      'Dokument strukturell gleich dem Dokument vor dem Löschen ohne die Schlüssel mit Wert undefined',
    );
    ohneZusatz(hergestellt.plan, e, 'hergestelltes Dokument');
    const sichtbar = (await store.standRecords(A)).filter((x) => x.visible).map((x) => x.standId);
    expect(sichtbar, 'Stand sichtbar').toEqual(['stand-u']);
    store.close();
  });

  it('[R-L-14][R-H-33] runMigration mit eigenem Schlüssel mit Wert undefined stellt um', async () => {
    const { u, e } = dokumentU();
    const uhr = uhrNeu();
    const f = neueFabrik();
    const s1 = await oeffnen(f);
    await s1.create(u, uhr);
    await standSetzen(s1, A, uhr, { standId: 'stand-u' });
    const vorher = vorhanden(await s1.load(A)).plan;
    s1.close();
    const s2 = await oeffnen(f, mottoFormat());
    const r = await erfasse(s2.runMigration(uhr));
    expect(r.fehler, 'kein Fehler bei runMigration').toBeNull();
    const nachher = vorhanden(await s2.load(A)).plan;
    expect(nachher.motto, 'Motto genau einmal umgestellt').toBe(`${vorher.motto}${MOTTO_ZUSATZ}`);
    const punkte = (await s2.listRestorePoints(A)).filter((p) => p.reason === 'migration');
    expect(punkte, "genau ein Punkt 'migration'").toHaveLength(1);
    ohneZusatz(nachher, e, 'umgestelltes Dokument');
    s2.close();
  });

  it('[R-H-33] restore: eigener unbekannter Schlüssel mit Wert ergibt weiterhin migrationFailed', async () => {
    const uhr = uhrNeu();
    const f = neueFabrik();
    const store = await oeffnen(f);
    await store.create({ ...planA(), zusatz: 'x' } as unknown as Plan, uhr);
    const punkt = await store.createRestorePoint(A, 'adoption', uhr);
    await speichern(store, A, motto('Motto danach (fiktiv)'), uhr);
    const vorher = await dbHash(f);
    const r = await erfasse(store.restore(A, punkt.id, uhr));
    expect(r.fehler).toBeInstanceOf(StorageError);
    expect((r.fehler as StorageError).code).toBe('migrationFailed');
    expect(await dbHash(f), 'DB-Hash unverändert').toBe(vorher);
    store.close();
  });
});
