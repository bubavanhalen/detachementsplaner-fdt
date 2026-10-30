// @vitest-environment jsdom
// Paket E1-04b (Nachtrag E1-04, CR-E104-02): Kürzen und Verwerfen der Historie ohne Lesen der Stand-Aufzeichnungen,
// solange kein betroffener Schritt eine Aufzeichnung koppelt oder ausblendet (Kopplungsmerker `standSeqs`; Vertrag
// docs/wap-planer/plan/vertraege/E1-04.md, «Änderungsnotiz Runde 2» R2-0, R2-2, R2-7, R2-8; ADR-006, Änderungsnotiz
// Vertrag E1-04 Runde 2; Katalog-Notiz E1-04b R-L-13 mit Zusatz 3). Pflichtfälle N2-a und N2-b tragen R-L-13 und
// die alte ID R-5.6-15, Gegenfälle N2-c bis N2-g nur R-5.6-15 (Plan Etappe 1 Regel 1.1; N2-g und `getAllRecords` im
// Lesezähler nach Test-Review E1-04b R1, TR-E104b-01/-02). Der Lesezähler steht nur in dieser Datei (R2-7). Echter
// Speicher auf fake-indexeddb, je Ablauf eine neue Fabrik. Alle Inhalte fiktiv.
import { IDBIndex, IDBObjectStore } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { DB_NAME, type PlanStore } from '../../../../src/io/wap-plan/store';
import { pruefPlan } from '../../support/stand/plan';
import { neueFabrik, neuLaden, oeffnen, werteVonPlan } from '../../support/storage/datenbank';
import {
  A,
  dateiStand,
  motto,
  planDatei,
  speichern,
  standSetzen,
} from '../../support/storage/plaene';
import { vorhanden } from '../../support/storage/pruefen';
import { TestUhr, zeitpunkt } from '../../support/storage/uhr';

/** Zeitgrenze der Fälle mit 210 `commit` (R2-2, V05; wie `LANG` in undo-speicher.test.ts). */
const LANG = 60_000;

/** Merkt sich das Ergebnis des ersten Aufrufs (auch eine Ablehnung); erstmals in einem `it` aufgerufen (R2-0). */
function einmal<T>(f: () => Promise<T>): () => Promise<T> {
  let p: Promise<T> | undefined;
  return () => {
    p ??= f();
    return p;
  };
}

interface LeseZaehler {
  /** Lesezugriffe auf `stands` seit dem letzten Zurücksetzen. */
  wert(): number;
  zuruecksetzen(): void;
}

/** Methode `getAllRecords` (fake-indexeddb 6.2.5; nicht in der DOM-Typbibliothek), falls vorhanden. */
type AlleDatensaetze = (this: unknown, ...a: unknown[]) => unknown;

/**
 * Lesezähler (R2-2): ersetzt während `rumpf` die Methoden `get`, `getAll`, `openCursor` und, falls vorhanden,
 * `getAllRecords` von `IDBObjectStore.prototype` und `IDBIndex.prototype` (fake-indexeddb) durch Hüllen, die einen
 * Aufruf auf dem Speicherbereich `stands` bzw. einem seiner Indizes zählen; im finally zurückgesetzt.
 */
async function mitLeseZaehler<T>(rumpf: (z: LeseZaehler) => Promise<T>): Promise<T> {
  const sp = IDBObjectStore.prototype;
  const ip = IDBIndex.prototype;
  const vorher = {
    sGet: sp.get,
    sGetAll: sp.getAll,
    sOpenCursor: sp.openCursor,
    iGet: ip.get,
    iGetAll: ip.getAll,
    iOpenCursor: ip.openCursor,
  };
  let zahl = 0;
  const zaehle = (name: string): void => {
    if (name === 'stands') zahl += 1;
  };
  sp.get = function get(this: IDBObjectStore, ...a: Parameters<IDBObjectStore['get']>) {
    zaehle(this.name);
    return vorher.sGet.apply(this, a);
  };
  sp.getAll = function getAll(this: IDBObjectStore, ...a: Parameters<IDBObjectStore['getAll']>) {
    zaehle(this.name);
    return vorher.sGetAll.apply(this, a);
  };
  sp.openCursor = function openCursor(
    this: IDBObjectStore,
    ...a: Parameters<IDBObjectStore['openCursor']>
  ) {
    zaehle(this.name);
    return vorher.sOpenCursor.apply(this, a);
  };
  ip.get = function get(this: IDBIndex, ...a: Parameters<IDBIndex['get']>) {
    zaehle(this.objectStore.name);
    return vorher.iGet.apply(this, a);
  };
  ip.getAll = function getAll(this: IDBIndex, ...a: Parameters<IDBIndex['getAll']>) {
    zaehle(this.objectStore.name);
    return vorher.iGetAll.apply(this, a);
  };
  ip.openCursor = function openCursor(this: IDBIndex, ...a: Parameters<IDBIndex['openCursor']>) {
    zaehle(this.objectStore.name);
    return vorher.iOpenCursor.apply(this, a);
  };
  const spx = sp as unknown as { getAllRecords?: AlleDatensaetze };
  const ipx = ip as unknown as { getAllRecords?: AlleDatensaetze };
  const sAlle = spx.getAllRecords;
  const iAlle = ipx.getAllRecords;
  if (sAlle !== undefined) {
    spx.getAllRecords = function getAllRecords(this: unknown, ...a: unknown[]) {
      zaehle((this as IDBObjectStore).name);
      return sAlle.apply(this, a);
    };
  }
  if (iAlle !== undefined) {
    ipx.getAllRecords = function getAllRecords(this: unknown, ...a: unknown[]) {
      zaehle((this as IDBIndex).objectStore.name);
      return iAlle.apply(this, a);
    };
  }
  try {
    return await rumpf({
      wert: () => zahl,
      zuruecksetzen() {
        zahl = 0;
      },
    });
  } finally {
    if (sAlle !== undefined) spx.getAllRecords = sAlle;
    if (iAlle !== undefined) ipx.getAllRecords = iAlle;
    sp.get = vorher.sGet;
    sp.getAll = vorher.sGetAll;
    sp.openCursor = vorher.sOpenCursor;
    ip.get = vorher.iGet;
    ip.getAll = vorher.iGetAll;
    ip.openCursor = vorher.iOpenCursor;
  }
}

/**
 * Ein `commit` (Motto ändern) mit Zählfenster: Das Dokument wird vorher geladen; gezählt wird vom Zurücksetzen
 * unmittelbar vor `commit` bis unmittelbar danach.
 */
async function gezaehlterCommit(
  store: PlanStore,
  z: LeseZaehler,
  text: string,
  uhr: TestUhr,
): Promise<{ readonly seq: number; readonly zugriffe: number }> {
  const geladen = vorhanden(await store.load(A), 'Plan geladen');
  const result = motto(text)(geladen.plan);
  z.zuruecksetzen();
  const s = await store.commit(A, result, uhr);
  const zugriffe = z.wert();
  return { seq: s.seq, zugriffe };
}

/** Anzahl roher Aufzeichnungen des Plans mit `standId` im Speicherbereich `stands`. */
async function rohAnzahl(f: IDBFactory, standId: string): Promise<number> {
  return (await werteVonPlan(f, 'stands', A)).filter((r) => r.standId === standId).length;
}

/** Rohe Aufzeichnung mit `standId` (genau eine erwartet). */
async function rohEine(f: IDBFactory, standId: string): Promise<Record<string, unknown>> {
  const treffer = (await werteVonPlan(f, 'stands', A)).filter((r) => r.standId === standId);
  expect(treffer, `genau eine rohe Aufzeichnung ${standId}`).toHaveLength(1);
  return treffer[0] as Record<string, unknown>;
}

/** Ist die Aufzeichnung mit `standId` nach `standRecords` sichtbar? (keine sichtbare → false) */
async function sichtbar(store: PlanStore, standId: string): Promise<boolean> {
  return (await store.standRecords(A)).some((r) => r.standId === standId && r.visible);
}

const uhrNeu = (): TestUhr => new TestUhr(zeitpunkt('2026-10-07', 9));

interface ErgebnisK {
  /** Je `commit` mit seq ≥ 201: [gekürzte seq t, Lesezugriffe]. */
  readonly paare: readonly (readonly [number, number])[];
  /** Je t: Zahl roher Aufzeichnungen L nach dem `commit` (ausserhalb des Zählfensters). */
  readonly lRoh: ReadonlyMap<number, number>;
  /** L nach t = 2 sichtbar? */
  readonly lSichtbarNachT2: boolean;
  /** Ersetzen-Schritt S und seq von L. */
  readonly seqL: number;
  readonly seqS: number;
  /** F am Ende sichtbar? */
  readonly fSichtbarEnde: boolean;
  /** Zahl der Schritt-Datensätze am Ende. */
  readonly schritte: number;
}

/**
 * Gemeinsamer Ablauf K (R2-2): create; commit (seq 1); Stand L (seq 2); replaceFromFile mit genau Stand F, ohne L
 * (S = 3; L ausgeblendet durch 3, F an 3 gekoppelt); Neuladen; 210 × commit (seq 4 bis 213).
 */
const ablaufK = einmal(async (): Promise<ErgebnisK> => {
  const f = neueFabrik();
  return mitLeseZaehler(async (z) => {
    const uhr = uhrNeu();
    let store = await oeffnen(f);
    await store.create(pruefPlan(), uhr);
    const eins = await speichern(store, A, motto('K 1 (fiktiv)'), uhr);
    expect(eins.seq, 'Aufbau: erster Schritt').toBe(1);
    const l = await standSetzen(store, A, uhr, { standId: 'stand-L' });
    expect(l.seq, 'Aufbau: Stand L').toBe(2);
    const doc = vorhanden(await store.load(A)).plan;
    const ersetzt = await store.replaceFromFile(
      A,
      planDatei(doc, { stands: [dateiStand(doc, 'stand-F')] }),
      uhr,
    );
    expect(ersetzt.seq, 'Aufbau: Ersetzen-Schritt').toBe(3);
    store = await neuLaden(store, f);

    const paare: [number, number][] = [];
    const lRoh = new Map<number, number>();
    let lSichtbarNachT2 = true;
    for (let i = 4; i <= 213; i++) {
      const c = await gezaehlterCommit(store, z, `K ${String(i)} (fiktiv)`, uhr);
      expect(c.seq, 'Aufbau: fortlaufende seq').toBe(i);
      if (c.seq >= 201) {
        const t = c.seq - 200;
        paare.push([t, c.zugriffe]);
        lRoh.set(t, await rohAnzahl(f, 'stand-L'));
        if (t === 2) lSichtbarNachT2 = await sichtbar(store, 'stand-L');
      }
    }
    const fSichtbarEnde = await sichtbar(store, 'stand-F');
    store.close();
    const schritte = (await werteVonPlan(f, 'history', A)).length;
    return {
      paare,
      lRoh,
      lSichtbarNachT2,
      seqL: l.seq,
      seqS: ersetzt.seq,
      fSichtbarEnde,
      schritte,
    };
  });
});

/** Entfernt das Feld `standSeqs` im Datensatz `plans` von A über eine eigene Verbindung (N2-f). */
async function merkerEntfernen(f: IDBFactory): Promise<void> {
  const db = await new Promise<IDBDatabase>((res, rej) => {
    const r = f.open(DB_NAME);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  try {
    await new Promise<void>((res, rej) => {
      const tx = db.transaction(['plans'], 'readwrite');
      const st = tx.objectStore('plans');
      const g = st.get(A);
      g.onsuccess = () => {
        const w = g.result as Record<string, unknown>;
        delete w.standSeqs;
        st.put(w);
      };
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  } finally {
    db.close();
  }
}

describe('E1-04b Kürzen und Verwerfen ohne Lesen der Stand-Aufzeichnungen (R2-2)', () => {
  it(
    '[R-L-13][R-5.6-15] reines Kürzen ohne gekoppelten Schritt liest keine Stand-Aufzeichnung (auch nach Neuladen)',
    async () => {
      const k = await ablaufK();
      expect(
        k.paare.map(([t]) => t),
        'Aufbau: gekürzte Schritte 1 bis 13',
      ).toEqual(Array.from({ length: 13 }, (_, i) => i + 1));
      expect(
        k.paare.filter(([t]) => t !== 2 && t !== 3),
        'Lesezugriffe auf stands je Kürzen [t, Zugriffe]',
      ).toEqual([1, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((t) => [t, 0]));
    },
    LANG,
  );

  it('[R-L-13][R-5.6-15] Verwerfen eines Redo-Zweigs ohne gekoppelte Aufzeichnung liest keine Stand-Aufzeichnung', async () => {
    const f = neueFabrik();
    await mitLeseZaehler(async (z) => {
      const uhr = uhrNeu();
      const store = await oeffnen(f);
      await store.create(pruefPlan(), uhr);
      const st = await standSetzen(store, A, uhr, { standId: 'stand-1' });
      expect(st.seq, 'Aufbau: Stand an seq 1').toBe(1);
      for (let i = 2; i <= 4; i++) await speichern(store, A, motto(`V ${String(i)} (fiktiv)`), uhr);
      vorhanden(await store.undo(A, uhr), 'undo 1');
      vorhanden(await store.undo(A, uhr), 'undo 2');
      const c = await gezaehlterCommit(store, z, 'V neu (fiktiv)', uhr);
      expect(c.zugriffe, 'Lesezugriffe auf stands beim Verwerfen von 3 und 4').toBe(0);
      expect(c.seq).toBe(5);
      expect(await sichtbar(store, 'stand-1'), 'Aufzeichnung sichtbar').toBe(true);
      expect(await store.redo(A, uhr), 'Redo-Zweig verworfen').toBeNull();
      store.close();
    });
  });

  it(
    '[R-5.6-15] durch Ersetzen ausgeblendete Aufzeichnung wird nach Neuladen beim Kürzen ihres Ersetzen-Schritts gelöscht',
    async () => {
      const k = await ablaufK();
      expect([k.seqL, k.seqS], 'Aufbau: L an 2, Ersetzen an 3').toEqual([2, 3]);
      expect(k.lRoh.get(2), 'L nach dem Kürzen von 2 roh in stands').toBe(1);
      expect(k.lSichtbarNachT2, 'L nach dem Kürzen von 2 nicht sichtbar').toBe(false);
      expect(k.lRoh.get(3), 'L nach dem Kürzen von 3 nicht mehr in stands').toBe(0);
      expect(k.fSichtbarEnde, 'F am Ende sichtbar').toBe(true);
      expect(k.schritte, 'Schritt-Datensätze am Ende').toBe(200);
    },
    LANG,
  );

  it('[R-5.6-15] Verwerfen nach Neuladen: gekoppelte Aufzeichnung gelöscht, Ausblendung aufgehoben', async () => {
    const f = neueFabrik();
    const uhr = uhrNeu();
    let store = await oeffnen(f);
    await store.create(pruefPlan(), uhr);
    // (i) gekoppelte Aufzeichnung L wird beim Verwerfen ihres Schritts nach Neuladen gelöscht
    await speichern(store, A, motto('D 1 (fiktiv)'), uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-L' });
    vorhanden(await store.undo(A, uhr), 'undo L');
    store = await neuLaden(store, f);
    await speichern(store, A, motto('D 2 (fiktiv)'), uhr);
    expect(await rohAnzahl(f, 'stand-L'), '(i) L nicht mehr roh in stands').toBe(0);
    // (ii) Ausblendung von M durch Ersetzen S wird beim Verwerfen von S nach Neuladen aufgehoben
    await standSetzen(store, A, uhr, { standId: 'stand-M' });
    await speichern(store, A, motto('D 3 (fiktiv)'), uhr);
    const doc = vorhanden(await store.load(A)).plan;
    await store.replaceFromFile(A, planDatei(doc, { stands: [] }), uhr);
    expect(await sichtbar(store, 'stand-M'), 'Aufbau: M durch Ersetzen ausgeblendet').toBe(false);
    vorhanden(await store.undo(A, uhr), 'undo Ersetzen');
    store = await neuLaden(store, f);
    await speichern(store, A, motto('D 4 (fiktiv)'), uhr);
    const m = await rohEine(f, 'stand-M');
    expect(m.hiddenBySeq, '(ii) Ausblendung von M aufgehoben').toBeNull();
    expect(await sichtbar(store, 'stand-M'), '(ii) M sichtbar').toBe(true);
    store.close();
  });

  it('[R-5.6-15] Merker nach einem Durchgang im selben Vorgang: neu gekoppelte Aufzeichnung wird beim späteren Verwerfen gelöscht (Commit-Weg)', async () => {
    const f = neueFabrik();
    const uhr = uhrNeu();
    let store = await oeffnen(f);
    await store.create(pruefPlan(), uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-X' });
    vorhanden(await store.undo(A, uhr), 'undo X');
    await standSetzen(store, A, uhr, { standId: 'stand-Y' });
    expect(await rohAnzahl(f, 'stand-X'), 'X beim Setzen von Y verworfen und gelöscht').toBe(0);
    expect(await rohAnzahl(f, 'stand-Y'), 'Aufbau: Y roh').toBe(1);
    vorhanden(await store.undo(A, uhr), 'undo Y');
    store = await neuLaden(store, f);
    await speichern(store, A, motto('E 1 (fiktiv)'), uhr);
    expect(await rohAnzahl(f, 'stand-Y'), 'Y nicht roh in stands').toBe(0);
    store.close();
  });

  it('[R-5.6-15] Merker nach einem Durchgang im selben Vorgang: neu gekoppelte Aufzeichnung wird beim späteren Verwerfen gelöscht (Ersetzen-Weg)', async () => {
    const f = neueFabrik();
    const uhr = uhrNeu();
    let store = await oeffnen(f);
    await store.create(pruefPlan(), uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-X' });
    vorhanden(await store.undo(A, uhr), 'undo X');
    const doc = vorhanden(await store.load(A)).plan;
    await store.replaceFromFile(A, planDatei(doc, { stands: [dateiStand(doc, 'stand-X')] }), uhr);
    expect(await rohAnzahl(f, 'stand-X'), 'X nach dem Ersetzen genau einmal roh').toBe(1);
    vorhanden(await store.undo(A, uhr), 'undo Ersetzen');
    store = await neuLaden(store, f);
    await speichern(store, A, motto('E 2 (fiktiv)'), uhr);
    expect(await rohAnzahl(f, 'stand-X'), 'X nicht roh in stands').toBe(0);
    store.close();
  });

  it('[R-5.6-15] fehlender Merker gilt als unbekannt: Verwerfen löscht die gekoppelte Aufzeichnung', async () => {
    const f = neueFabrik();
    const uhr = uhrNeu();
    let store = await oeffnen(f);
    await store.create(pruefPlan(), uhr);
    await standSetzen(store, A, uhr, { standId: 'stand-L' });
    store.close();
    await merkerEntfernen(f);
    store = await oeffnen(f);
    vorhanden(await store.undo(A, uhr), 'undo L');
    await speichern(store, A, motto('F 1 (fiktiv)'), uhr);
    expect(await rohAnzahl(f, 'stand-L'), 'L nicht roh in stands').toBe(0);
    store.close();
  });

  it('[R-5.6-15] Durchgang behält die Ausblendung im Merker: Verwerfen des Ersetzen-Schritts hebt sie auf', async () => {
    const f = neueFabrik();
    const uhr = uhrNeu();
    const store = await oeffnen(f);
    await store.create(pruefPlan(), uhr);
    const m = await standSetzen(store, A, uhr, { standId: 'stand-M' });
    expect(m.seq, 'Aufbau: M an seq 1').toBe(1);
    const doc = vorhanden(await store.load(A)).plan;
    const ersetzt = await store.replaceFromFile(A, planDatei(doc, { stands: [] }), uhr);
    expect(ersetzt.seq, 'Aufbau: Ersetzen S = 2').toBe(2);
    expect(await sichtbar(store, 'stand-M'), 'Aufbau: M durch Ersetzen ausgeblendet').toBe(false);
    const x = await standSetzen(store, A, uhr, { standId: 'stand-X' });
    expect(x.seq, 'Aufbau: X an seq 3').toBe(3);
    vorhanden(await store.undo(A, uhr), 'undo X');
    const vier = await speichern(store, A, motto('G 1 (fiktiv)'), uhr);
    expect(vier.seq, 'Aufbau: seq 4 verwirft X (Durchgang)').toBe(4);
    expect(await rohAnzahl(f, 'stand-X'), 'Aufbau: X verworfen und gelöscht').toBe(0);
    vorhanden(await store.undo(A, uhr), 'undo 4');
    vorhanden(await store.undo(A, uhr), 'undo Ersetzen');
    await speichern(store, A, motto('G 2 (fiktiv)'), uhr);
    const mRoh = await rohEine(f, 'stand-M');
    expect(mRoh.hiddenBySeq, 'Ausblendung von M aufgehoben').toBeNull();
    expect(await sichtbar(store, 'stand-M'), 'M sichtbar').toBe(true);
    store.close();
  });
});
