// Allgemeine Testhilfen für Paket E1-05 (Vertrag docs/wap-planer/plan/vertraege/E1-05.md, Notiz «Ausarbeitung
// Schritt 2» Abschnitt H): Tor zum Verzögern, Beobachter für Promises ohne unbehandelte Ablehnung, SHA-256,
// Fehler einer Funktion bzw. eines Promise. Keine E1-05-Logik. Alle Inhalte sind fiktiv.
import { createHash } from 'node:crypto';

/**
 * Tor: Wer `warten()` aufruft, bleibt stehen, bis der Test `oeffnen()` aufruft. `erreicht` erfüllt sich beim
 * ersten `warten()`. Ein nie geöffnetes Tor bildet eine Promise, die nie erfüllt (Abschnitt G, R-5.5-04 (5)).
 */
export class Tor {
  private oeffnenFn: () => void = () => undefined;
  private erreichtFn: () => void = () => undefined;
  private readonly offen: Promise<void>;
  /** Erfüllt sich, sobald jemand am Tor wartet. */
  readonly erreicht: Promise<void>;
  istErreicht = false;
  istOffen = false;

  constructor() {
    this.offen = new Promise<void>((r) => {
      this.oeffnenFn = r;
    });
    this.erreicht = new Promise<void>((r) => {
      this.erreichtFn = r;
    });
  }

  warten(): Promise<void> {
    this.istErreicht = true;
    this.erreichtFn();
    return this.offen;
  }

  oeffnen(): void {
    this.istOffen = true;
    this.oeffnenFn();
  }
}

/** Zustand eines beobachteten Promise; die Ablehnung gilt damit als behandelt. */
export interface Beobachtet<T> {
  readonly promise: Promise<T>;
  /** Erfüllt sich mit dem Ergebnis, sobald das Promise erledigt ist (nie abgelehnt). */
  readonly erledigt: Promise<
    { readonly ok: true; readonly wert: T } | { readonly ok: false; readonly fehler: unknown }
  >;
  status(): 'offen' | 'erfuellt' | 'abgelehnt';
}

/** Beobachtet ein Promise, ohne dass eine Ablehnung unbehandelt bleibt. */
export function beobachte<T>(promise: Promise<T>): Beobachtet<T> {
  let zustand: 'offen' | 'erfuellt' | 'abgelehnt' = 'offen';
  const erledigt = promise.then(
    (wert) => {
      zustand = 'erfuellt';
      return { ok: true as const, wert };
    },
    (fehler: unknown) => {
      zustand = 'abgelehnt';
      return { ok: false as const, fehler };
    },
  );
  return { promise, erledigt, status: () => zustand };
}

/** Lässt `n` Makrotask-Runden verstreichen (echte Zeitgeber, ohne Wartezeit von Bedeutung). */
export async function runden(n = 5): Promise<void> {
  for (let i = 0; i < n; i++) {
    await new Promise<void>((r) => {
      setTimeout(r, 0);
    });
  }
}

/** SHA-256 als Hex. */
export function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** SHA-256 je Schlüssel einer PDF-Map, Schlüssel in Map-Reihenfolge. */
export function shaJeSchluessel(pdfs: ReadonlyMap<string, Uint8Array>): [string, string][] {
  return [...pdfs.entries()].map(([k, v]) => [k, sha256(v)]);
}

/** Fehler eines synchronen Aufrufs; `undefined`, wenn nichts geworfen wurde. */
export function fehlerVon(fn: () => unknown): unknown {
  try {
    fn();
  } catch (e: unknown) {
    return e;
  }
  return undefined;
}

/** Ablehnungsgrund eines Promise; `undefined` bei Erfüllung (der Test prüft den Grund mit expect). */
export async function ablehnungVon(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (e: unknown) {
    return e;
  }
  return undefined;
}

/** Tiefe Kopie reiner Daten (Pläne) für Vorher-nachher-Vergleiche. */
export function kopie<T>(wert: T): T {
  return structuredClone(wert);
}

/** UUID Version 4 (Abschnitt G, R-5.5-03 (8)). */
export const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
