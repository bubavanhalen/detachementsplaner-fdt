// @vitest-environment jsdom
// Paket E1-04b (Nachtrag E1-04, CR-E104-06): Barriere der Umstellung und vom Browser geschlossene Verbindung
// (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, «Änderungsnotiz Runde 2» R2-0, R2-4, R2-7, R2-8; Abschnitt G1;
// Katalog-Notiz E1-04b R-L-15 mit Zusatz 2 und 3). Pflichtfälle N4-a bis N4-c tragen R-L-15 und eine alte ID von
// E1-04 (Plan Etappe 1 Regel 1.1). Beide Aufrufe von N4-a und N4-b stehen im selben synchronen Abschnitt und werden
// mit Promise.allSettled ausgewertet; Fehler werden als Wert erfasst (R2-0). Alle Inhalte fiktiv.
import { forceCloseDatabase } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import {
  type PendingMigration,
  type PlanStore,
  StorageError,
} from '../../../../src/io/wap-plan/store';
import { neueFabrik, oeffnen } from '../../support/storage/datenbank';
import { MOTTO_ZUSATZ, mottoFormat } from '../../support/storage/format';
import { SPEICHER_MELDUNG } from '../../support/storage/meldungen';
import { A, motto, planA } from '../../support/storage/plaene';
import { vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

const uhrNeu = (): TestUhr => new TestUhr(zeitpunkt('2026-10-07', 11));

/** Ablehnungsgrund als Wert (null bei Erfüllung). */
function grund(r: PromiseSettledResult<unknown>): unknown {
  return r.status === 'rejected' ? (r.reason as unknown) : null;
}

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

/** Speicher in Formatversion 1 mit planA(), geschlossen, danach mit dem Testformat v2 geöffnet (R2-4). */
async function speicherV1AlsV2(
  uhr: TestUhr,
): Promise<{ readonly store: PlanStore; readonly mottoAlt: string }> {
  const f = neueFabrik();
  const s1 = await oeffnen(f);
  const geladen = await s1.create(planA(), uhr);
  s1.close();
  return { store: await oeffnen(f, mottoFormat()), mottoAlt: geladen.plan.motto };
}

/** Erwartungen (1) bis (4) von N4-a und N4-b. */
async function pruefeRennen(
  store: PlanStore,
  uhr: TestUhr,
  mottoAlt: string,
  ra: PromiseSettledResult<PendingMigration | null>,
  rb: PromiseSettledResult<void>,
): Promise<void> {
  expect(grund(ra), '(1) pendingMigration erfüllt').toBeNull();
  expect(grund(rb), '(2) runMigration erfüllt').toBeNull();
  const offen = ra.status === 'fulfilled' ? ra.value : null;
  if (offen !== null) {
    expect(offen.fromVersion, '(3) fromVersion').toBe(1);
    expect(offen.toVersion, '(3) toVersion').toBe(2);
    expect(offen.backups, '(3) eine Sicherung').toHaveLength(1);
    const sicherung = vorhanden(offen.backups[0]);
    let fehler: unknown = null;
    let motto: string | null = null;
    try {
      motto = parsePlanFile(sicherung.bytes()).plan.motto;
    } catch (e: unknown) {
      fehler = e;
    }
    expect(fehler, '(3) Sicherung mit parsePlanFile lesbar').toBeNull();
    expect(motto, '(3) Sicherung mit altem Motto').toBe(mottoAlt);
  }
  const danach = await erfasse(store.load(A));
  expect(danach.fehler, '(4) load danach ohne Fehler').toBeNull();
  expect(vorhanden(danach.wert).plan.motto, '(4) Plan umgestellt').toBe(
    `${mottoAlt}${MOTTO_ZUSATZ}`,
  );
  const nochOffen = await erfasse(store.pendingMigration(uhr));
  expect(nochOffen.fehler, '(4) pendingMigration danach ohne Fehler').toBeNull();
  expect(nochOffen.wert, '(4) keine Umstellung mehr offen').toBeNull();
}

describe('E1-04b Barriere der Umstellung und geschlossene Verbindung (R2-4)', () => {
  it('[R-L-15][R-H-33] pendingMigration und danach runMigration im selben Abschnitt: keine rohe DOMException', async () => {
    const uhr = uhrNeu();
    const { store, mottoAlt } = await speicherV1AlsV2(uhr);
    const a = store.pendingMigration(uhr);
    const b = store.runMigration(uhr);
    const [ra, rb] = await Promise.allSettled([a, b]);
    await pruefeRennen(store, uhr, mottoAlt, ra, rb);
    store.close();
  });

  it('[R-L-15][R-H-33] runMigration und danach pendingMigration im selben Abschnitt: nie die Zielversion als Ausgangsversion', async () => {
    const uhr = uhrNeu();
    const { store, mottoAlt } = await speicherV1AlsV2(uhr);
    const b = store.runMigration(uhr);
    const a = store.pendingMigration(uhr);
    const [ra, rb] = await Promise.allSettled([a, b]);
    await pruefeRennen(store, uhr, mottoAlt, ra, rb);
    store.close();
  });

  it('[R-L-15][R-5.6-14] vom Browser geschlossene Verbindung: nächste Methode lehnt mit StorageError unavailable ab', async () => {
    const uhr = uhrNeu();
    const f = neueFabrik();
    const verbindungen: IDBDatabase[] = [];
    const open = f.open.bind(f);
    (f as { open: IDBFactory['open'] }).open = (name: string, version?: number) => {
      const r = open(name, version);
      r.addEventListener('success', () => {
        verbindungen.push(r.result);
      });
      return r;
    };
    const store = await oeffnen(f);
    const geladen = await store.create(planA(), uhr);
    const letzte = vorhanden(verbindungen.at(-1), 'Verbindung des Speichers');
    // Typangabe von fake-indexeddb nennt die Klasse statt der Instanz; zur Laufzeit wird die Verbindung erwartet.
    forceCloseDatabase(letzte as never);

    const laden = await erfasse(store.load(A));
    expect(laden.fehler, 'load').toBeInstanceOf(StorageError);
    expect((laden.fehler as StorageError).code, 'load').toBe('unavailable');
    expect((laden.fehler as StorageError).userMessage, 'load').toEqual(
      SPEICHER_MELDUNG.unavailable,
    );

    const aendern = await erfasse(
      store.commit(A, motto('Nach dem Schliessen (fiktiv)')(geladen.plan), uhr),
    );
    expect(aendern.fehler, 'commit').toBeInstanceOf(StorageError);
    expect((aendern.fehler as StorageError).code, 'commit').toBe('unavailable');
    expect((aendern.fehler as StorageError).userMessage, 'commit').toEqual(
      SPEICHER_MELDUNG.unavailable,
    );
    store.close();
  });
});
