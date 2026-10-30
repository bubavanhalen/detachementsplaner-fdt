// Speicher und Datenbank für die Tests von Paket E1-04 (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz
// «Ausarbeitung Schritt 2» Abschnitte H, L «Gemeinsam» und M1): Speicher aus fake-indexeddb öffnen und neu laden,
// Datensätze der sechs Speicherbereiche roh lesen (Abschnitt H), DB-Hash (SHA-256 über alle Datensätze in
// Schlüsselreihenfolge; Map als Liste von Paaren, Bytes als Hex, Objekte mit sortierten Schlüsseln), Zahl je
// Speicherbereich, werfende Testfabrik für `quotaExceeded` (Prototyp von IDBObjectStore vorübergehend ersetzt und
// im finally zurückgesetzt, Spike S-6). Keine E1-04-Logik; liest nur, ausser der werfenden Fabrik.
import { createHash } from 'node:crypto';
import { IDBFactory, IDBObjectStore } from 'fake-indexeddb';
import { expect } from 'vitest';
import type { PlanFormat } from '../../../../src/io/wap-plan/planFile';
import { DB_NAME, openPlanStore, type PlanStore } from '../../../../src/io/wap-plan/store';
import type { Id } from '../../../../src/model/wap/types';

/** Die sechs Speicherbereiche nach Abschnitt H, in fester Reihenfolge. */
export const SPEICHERBEREICHE = [
  'plans',
  'history',
  'restorePoints',
  'stands',
  'importReports',
  'meta',
] as const;
export type Speicherbereich = (typeof SPEICHERBEREICHE)[number];

/** Neue, leere Fabrik (je Test eine). */
export function neueFabrik(): IDBFactory {
  return new IDBFactory();
}

/** Speicher auf der Fabrik; `format` nur für die Prüfnaht F1. `storage` null (Abschnitt L). */
export function oeffnen(fabrik: IDBFactory, format?: PlanFormat): Promise<PlanStore> {
  return openPlanStore({
    indexedDB: fabrik,
    storage: null,
    ...(format === undefined ? {} : { format }),
  });
}

/** «Neuladen» (Abschnitt L): Verbindung schliessen und den Speicher mit derselben Fabrik neu öffnen. */
export function neuLaden(
  store: PlanStore,
  fabrik: IDBFactory,
  format?: PlanFormat,
): Promise<PlanStore> {
  store.close();
  return oeffnen(fabrik, format);
}

function anfrage<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise<T>((res, rej) => {
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

/**
 * Eigene Leseverbindung zur Datenbank (ohne Version, also ohne Versionswechsel). Fehlt die Datenbank oder einer der
 * sechs Speicherbereiche, scheitert der Test mit einer Erwartung (nicht mit einem Laufzeitfehler).
 */
async function leseVerbindung(fabrik: IDBFactory): Promise<IDBDatabase> {
  const namen = (await fabrik.databases()).map((d) => d.name);
  expect(namen, `Datenbank ${DB_NAME} vorhanden`).toContain(DB_NAME);
  const db = await new Promise<IDBDatabase>((res, rej) => {
    const r = fabrik.open(DB_NAME);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  const vorhanden = Array.from(db.objectStoreNames);
  for (const b of SPEICHERBEREICHE) {
    if (!vorhanden.includes(b)) db.close();
    expect(vorhanden, `Speicherbereich ${b} vorhanden`).toContain(b);
  }
  return db;
}

/** Version der Datenbank (IDBDatabase.version) oder null, wenn es sie nicht gibt. */
export async function datenbankVersion(fabrik: IDBFactory): Promise<number | null> {
  const info = (await fabrik.databases()).find((d) => d.name === DB_NAME);
  return info?.version ?? null;
}

export interface Rohdatensatz {
  readonly schluessel: unknown;
  readonly wert: unknown;
}

/** Alle Datensätze eines Speicherbereichs in Schlüsselreihenfolge, roh (strukturiert geklont). */
export async function datensaetze(
  fabrik: IDBFactory,
  bereich: Speicherbereich,
): Promise<Rohdatensatz[]> {
  const db = await leseVerbindung(fabrik);
  try {
    const tx = db.transaction([bereich], 'readonly');
    const st = tx.objectStore(bereich);
    const [schluessel, werte] = await Promise.all([anfrage(st.getAllKeys()), anfrage(st.getAll())]);
    return schluessel.map((k, i) => ({ schluessel: k, wert: werte[i] }));
  } finally {
    db.close();
  }
}

/** Werte eines Speicherbereichs, die zu `planId` gehören (Feld `planId`). */
export async function werteVonPlan(
  fabrik: IDBFactory,
  bereich: Exclude<Speicherbereich, 'meta'>,
  planId: Id,
): Promise<Record<string, unknown>[]> {
  return (await datensaetze(fabrik, bereich))
    .map((d) => d.wert as Record<string, unknown>)
    .filter((w) => w.planId === planId);
}

/** Datensatz `plans` eines Plans (Abschnitt H) oder undefined. */
export async function planDatensatz(
  fabrik: IDBFactory,
  planId: Id,
): Promise<Record<string, unknown> | undefined> {
  return (await werteVonPlan(fabrik, 'plans', planId))[0];
}

/** Wiederherstellungspunkte eines Plans, roh, nach `ordinal` aufsteigend. */
export async function rohPunkte(
  fabrik: IDBFactory,
  planId: Id,
): Promise<Record<string, unknown>[]> {
  return (await werteVonPlan(fabrik, 'restorePoints', planId)).sort(
    (a, b) => Number(a.ordinal) - Number(b.ordinal),
  );
}

/** Ein Wiederherstellungspunkt roh nach `id`. */
export async function rohPunkt(fabrik: IDBFactory, id: Id): Promise<Record<string, unknown>> {
  const p = (await datensaetze(fabrik, 'restorePoints'))
    .map((d) => d.wert as Record<string, unknown>)
    .find((w) => w.id === id);
  expect(p, 'Wiederherstellungspunkt vorhanden').toBeDefined();
  return p as Record<string, unknown>;
}

/** Zahl der Datensätze je Speicherbereich. */
export async function anzahlen(fabrik: IDBFactory): Promise<Record<Speicherbereich, number>> {
  const out = {} as Record<Speicherbereich, number>;
  for (const b of SPEICHERBEREICHE) out[b] = (await datensaetze(fabrik, b)).length;
  return out;
}

function istTag(v: unknown, tag: string): boolean {
  return Object.prototype.toString.call(v) === `[object ${tag}]`;
}

/** Kanonische Form für den Hash: Map als Paare, Bytes als Hex, Objekte mit sortierten Schlüsseln. */
export function kanonisch(v: unknown): unknown {
  if (v === undefined) return ['undefined'];
  if (v === null || typeof v !== 'object') return v;
  if (ArrayBuffer.isView(v)) {
    const b = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
    return ['bytes', Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')];
  }
  if (istTag(v, 'Map')) {
    return [
      'map',
      Array.from((v as Map<unknown, unknown>).entries(), ([k, x]) => [kanonisch(k), kanonisch(x)]),
    ];
  }
  if (Array.isArray(v)) return v.map((x: unknown) => kanonisch(x));
  const o = v as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(o).sort()) out[k] = kanonisch(o[k]);
  return out;
}

function sha256Text(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** «DB-Hash» (Abschnitt L): SHA-256 über alle Datensätze aller sechs Speicherbereiche in Schlüsselreihenfolge. */
export async function dbHash(fabrik: IDBFactory): Promise<string> {
  const teile: unknown[] = [];
  for (const b of SPEICHERBEREICHE) {
    teile.push([b, (await datensaetze(fabrik, b)).map((d) => kanonisch([d.schluessel, d.wert]))]);
  }
  return sha256Text(JSON.stringify(teile));
}

/** Hash aller Datensätze eines Plans (Feld `planId`) in den fünf planbezogenen Speicherbereichen. */
export async function planHash(fabrik: IDBFactory, planId: Id): Promise<string> {
  const teile: unknown[] = [];
  for (const b of SPEICHERBEREICHE) {
    if (b === 'meta') continue;
    teile.push([b, (await werteVonPlan(fabrik, b, planId)).map((w) => kanonisch(w))]);
  }
  return sha256Text(JSON.stringify(teile));
}

/** Werfende Testfabrik (M1): nach `arm()` wirft ein Aufruf von `put` bzw. `add` synchron `QuotaExceededError`. */
export interface VollerSpeicher {
  readonly fabrik: IDBFactory;
  /**
   * Scharf schalten: Der (`ueberspringen` + 1)-te Aufruf von `put` oder `add` danach wirft synchron
   * `new DOMException('…', 'QuotaExceededError')`; danach ist die Fabrik wieder entschärft. Standard: der nächste.
   */
  arm(ueberspringen?: number): void;
  /** Entschärfen ohne Auslösen. */
  entschaerfen(): void;
  /** Wie oft die Fabrik bisher geworfen hat. */
  ausgeloest(): number;
}

/**
 * Führt `rumpf` mit einer werfenden Fabrik aus. Der Prototyp von `IDBObjectStore` (fake-indexeddb) ist nur während
 * `rumpf` ersetzt und wird im finally zurückgesetzt (Spike S-6).
 */
export async function mitVollemSpeicher<T>(rumpf: (v: VollerSpeicher) => Promise<T>): Promise<T> {
  const proto = IDBObjectStore.prototype;
  const putVorher = proto.put;
  const addVorher = proto.add;
  let scharf = false;
  let rest = 0;
  let ausgeloest = 0;
  const pruefen = (): void => {
    if (!scharf) return;
    if (rest > 0) {
      rest -= 1;
      return;
    }
    scharf = false;
    ausgeloest += 1;
    throw new DOMException('Speicher voll (Testfabrik, fiktiv)', 'QuotaExceededError');
  };
  proto.put = function put(this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
    pruefen();
    return putVorher.apply(this, args);
  };
  proto.add = function add(this: IDBObjectStore, ...args: Parameters<IDBObjectStore['add']>) {
    pruefen();
    return addVorher.apply(this, args);
  };
  try {
    return await rumpf({
      fabrik: new IDBFactory(),
      arm(ueberspringen = 0) {
        scharf = true;
        rest = ueberspringen;
      },
      entschaerfen() {
        scharf = false;
        rest = 0;
      },
      ausgeloest: () => ausgeloest,
    });
  } finally {
    proto.put = putVorher;
    proto.add = addVorher;
  }
}
