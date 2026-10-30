// Migrations-Fixture der Etappe 1 (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz «Ausarbeitung Schritt 2»
// Abschnitt M2; R-H-33): Plan-Datei Version 1 mit nur fiktiven Inhalten. Liest die Datei als Bytes (für
// Hash-Vergleiche) bzw. als rohes Objekt (für abgewandelte Fälle). Keine E1-04-Logik.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pfad der Fixture (Zeichenkette statt URL-Objekt: unter jsdom ist URL die Klasse von jsdom). */
export const FIXTURE_PFAD = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../fixtures/migration/etappe-1.wap.json',
);

/** Bytes der Fixture (Uint8Array dieses Realms). */
export function fixtureBytes(): Uint8Array {
  return Uint8Array.from(readFileSync(FIXTURE_PFAD));
}

/** Rohes Objekt der Fixture (wie aus JSON.parse), frisch je Aufruf. */
export function fixtureRoh(): Record<string, unknown> {
  return JSON.parse(readFileSync(FIXTURE_PFAD, 'utf8')) as Record<string, unknown>;
}

/** Plan-ID der Fixture. */
export const FIXTURE_PLAN_ID = 'p-migration-etappe-1';
