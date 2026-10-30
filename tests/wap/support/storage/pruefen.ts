// Erwartungshilfen für die Tests von Paket E1-04 (Vertrag docs/wap-planer/plan/vertraege/E1-04.md, Notiz
// «Ausarbeitung Schritt 2» Abschnitte G, L «Gemeinsam», P). Ablehnungen und Würfe werden nur über Erwartungen
// geprüft: Wird nichts abgelehnt, scheitert der Test mit einer Erwartung; ein Fehler einer anderen Klasse wird
// unverändert weitergeworfen (im Stub-Stand also der Vertrags-Stub-Fehler mit seinem Namen, Abschnitt P).
// «strukturell gleich» = structurallyEqual (E1-03). Keine E1-04-Logik.
import { expect } from 'vitest';
import { PlanFileError, type PlanFileErrorCode } from '../../../../src/io/wap-plan/planFile';
import { StorageError, type StorageErrorCode } from '../../../../src/io/wap-plan/store';
import { structurallyEqual } from '../../../../src/model/wap/commands/command';
import { WapError } from '../../../../src/model/wap/errors';

/** Ablehnungsgrund eines Promise; bei Erfüllung scheitert der Test (Erwartung). */
export async function ablehnung(p: Promise<unknown>, was = 'Ablehnung'): Promise<unknown> {
  try {
    await p;
  } catch (e: unknown) {
    return e;
  }
  return expect.fail(`erwartet: ${was}; erhalten: Erfüllung`);
}

/** Wurf eines synchronen Aufrufs; ohne Wurf scheitert der Test (Erwartung). */
export function wurf(fn: () => unknown, was = 'Wurf'): unknown {
  try {
    fn();
  } catch (e: unknown) {
    return e;
  }
  return expect.fail(`erwartet: ${was}; erhalten: kein Fehler`);
}

/** Erwartet StorageError mit `code` (und optional `userMessage` wörtlich); andere Fehler gehen unverändert durch. */
export async function speicherFehler(
  p: Promise<unknown>,
  code: StorageErrorCode,
  meldung?: { readonly cause: string; readonly nextStep: string },
): Promise<StorageError> {
  const e = await ablehnung(p, `StorageError '${code}'`);
  if (!(e instanceof StorageError)) throw e;
  expect(e).toBeInstanceOf(WapError);
  expect(e.code).toBe(code);
  if (meldung !== undefined) expect(e.userMessage).toEqual(meldung);
  return e;
}

/** Erwartet PlanFileError mit `code` aus einem synchronen Aufruf; andere Fehler gehen unverändert durch. */
export function dateiFehler(
  fn: () => unknown,
  code: PlanFileErrorCode,
  meldung?: { readonly cause: string; readonly nextStep: string },
): PlanFileError {
  const e = wurf(fn, `PlanFileError '${code}'`);
  if (!(e instanceof PlanFileError)) throw e;
  expect(e).toBeInstanceOf(WapError);
  expect(e.code).toBe(code);
  if (meldung !== undefined) expect(e.userMessage).toEqual(meldung);
  return e;
}

/** Erwartet einen Programmfehler `RangeError` (Ablehnung). */
export async function bereichsFehler(p: Promise<unknown>): Promise<void> {
  const e = await ablehnung(p, 'RangeError');
  expect(e).toBeInstanceOf(RangeError);
}

/** Strukturell gleich (structurallyEqual, E1-03). */
export function gleich(ist: unknown, soll: unknown, text = 'strukturell gleich'): void {
  expect(structurallyEqual(ist, soll), text).toBe(true);
}

/** Strukturell verschieden. */
export function ungleich(ist: unknown, soll: unknown, text = 'strukturell verschieden'): void {
  expect(structurallyEqual(ist, soll), text).toBe(false);
}

/** Wert ist nicht null; liefert ihn typisiert. */
export function vorhanden<T>(x: T | null | undefined, text = 'vorhanden'): T {
  expect(x, text).not.toBeNull();
  expect(x, text).not.toBeUndefined();
  return x as T;
}

/** Bytes gleich (auch über Realm-Grenzen, Spike S-1). */
export function gleicheBytes(ist: Uint8Array | undefined, soll: Uint8Array | undefined): void {
  expect(ist, 'Bytes vorhanden').toBeDefined();
  expect(Array.from(ist ?? []), 'Bytes gleich').toEqual(Array.from(soll ?? []));
}
