// globalSetup von vitest.wap-reference.config.ts (test:reference; Paket E1-01, R-H-28, R-H-27; Vertrag
// E1-01 §1, §3 und Änderungsnotiz AE-001 §4 Nr 6; Prompt §5.6 «Fehlt eine Datei, schlägt sie fehl, nie
// skip»): Node-Prüfung, feste Workerzahl, WAP_REFERENCE_DIR und jede Datei aus
// tests/wap/reference/required-files.json. Ausgaben nennen Dateien nur über zeigePfad (agent-regeln 3).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { zeigePfad } from '../wap/lib/common.mjs';
import {
  pruefeNode,
  pruefeWorker,
  SKRIPT_WURZEL,
  vorgeseheneWorker,
} from './lib/vitest-pruefung.mjs';

/** Liste der verlangten Referenzdateien relativ zur Wurzel. */
const LISTE_REL = 'tests/wap/reference/required-files.json';

/** Platzhalter, die in der Liste nicht vorkommen dürfen (zur Laufzeit gebildet, F4). */
const PLATZHALTER = new RegExp(`[<>]|${['TO', 'DO'].join('')}|platzhalter`, 'i');

/**
 * Ist ein Listeneintrag gültig (relativ, «/», ohne «..», ohne Platzhalter)?
 * @param {unknown} e
 * @returns {e is string}
 */
function gueltig(e) {
  return (
    typeof e === 'string' &&
    e.trim() !== '' &&
    !/^[A-Za-z]:|^[\\/]/.test(e) &&
    !isAbsolute(e) &&
    !e.includes('\\') &&
    !e.split('/').includes('..') &&
    !PLATZHALTER.test(e)
  );
}

/**
 * Prüft WAP_REFERENCE_DIR und die verlangten Referenzdateien; wirft mit Ursache und nächstem Schritt.
 * @param {Record<string, string | undefined>} env
 * @param {string} wurzel
 * @returns {void}
 */
export function pruefeReferenzen(env, wurzel) {
  const dir = env.WAP_REFERENCE_DIR;
  if (dir === undefined || dir.trim() === '') {
    throw new Error(
      'WAP_REFERENCE_DIR ist nicht gesetzt; test:reference braucht die lokalen Referenzdateien. ' +
        'Nächster Schritt: WAP_REFERENCE_DIR auf den Ordner reference/ des Haupt-Checkouts setzen.',
    );
  }
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw new Error(
      'WAP_REFERENCE_DIR zeigt auf keinen vorhandenen Ordner. ' +
        'Nächster Schritt: Pfad von WAP_REFERENCE_DIR prüfen.',
    );
  }
  const liste = join(wurzel, ...LISTE_REL.split('/'));
  if (!existsSync(liste)) {
    throw new Error(`${LISTE_REL} fehlt. Nächster Schritt: Liste der Referenzdateien anlegen.`);
  }
  /** @type {unknown} */
  let daten;
  try {
    daten = JSON.parse(readFileSync(liste, 'utf8'));
  } catch {
    throw new Error(`${LISTE_REL} ist kein gültiges JSON. Nächster Schritt: Liste korrigieren.`);
  }
  const roh = /** @type {{ version?: unknown; dateien?: unknown }} */ (daten ?? {});
  const dateien = Array.isArray(roh.dateien) ? roh.dateien : null;
  if (roh.version !== 1 || dateien === null || dateien.length === 0) {
    throw new Error(
      `${LISTE_REL} muss { "version": 1, "dateien": [ … ] } mit mindestens einer Datei sein. ` +
        'Nächster Schritt: Liste korrigieren.',
    );
  }
  const ungueltig = dateien.filter((e) => !gueltig(e)).length;
  if (ungueltig > 0) {
    throw new Error(
      `${LISTE_REL}: ${String(ungueltig)} ungültige Einträge (absolut, mit «..», «\\» oder Platzhalter). ` +
        'Nächster Schritt: nur Pfade relativ zu WAP_REFERENCE_DIR mit «/» eintragen.',
    );
  }
  const fehlend = dateien.filter((e) => {
    const abs = join(dir, ...String(e).split('/'));
    return !existsSync(abs) || !statSync(abs).isFile();
  });
  if (fehlend.length > 0) {
    throw new Error(
      `Referenzdatei fehlt: ${String(fehlend.length)} von ${String(dateien.length)} ` +
        `(${fehlend.map((e) => zeigePfad(String(e))).join(', ')}). ` +
        'Nächster Schritt: Dateien in WAP_REFERENCE_DIR bereitstellen (nie überspringen, Prompt §5.6).',
    );
  }
}

/**
 * Vitest-globalSetup von test:reference.
 * @param {{ config: { maxWorkers?: number; provide?: Record<string, unknown>; root?: string } }} project
 * @returns {Promise<void>}
 */
export default async function setup(project) {
  pruefeNode();
  pruefeWorker(process.env, vorgeseheneWorker(project));
  pruefeReferenzen(process.env, project.config.root ?? SKRIPT_WURZEL);
}
