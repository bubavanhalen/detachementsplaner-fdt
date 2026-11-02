// Altmodul-Liste (Entscheid E12 c, AR0-44, AR0-54): gemeinsam für F6 (typecheck.mjs) und
// coverage-check.mjs. Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `legacyUnchanged`, §6.
// Lebenszyklus (AR0-54): Die Liste gilt ab dem Merge von E1-01; eine gelistete, noch nicht vorhandene
// Datei (vor der Verschiebung durch E1-07) gilt als «verändert» und ist damit von keiner Ausnahme
// erfasst – sie erzeugt aber auch keine Meldung, die Ausnahme ist leer.
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { sha256Lf } from '../../wap/lib/common.mjs';

/** Pfad der Liste relativ zur Wurzel. */
export const LEGACY_REL = 'scripts/wap-gate/legacy-modules.json';

/**
 * Liest die Altmodul-Liste.
 * @param {string} datei absoluter Pfad
 * @returns {{ ok: true; dateien: { pfad: string; sha256: string }[] } | { ok: false; grund: string }}
 */
export function ladeLegacyListe(datei) {
  if (!existsSync(datei)) {
    return { ok: false, grund: 'Altmodul-Liste legacy-modules.json fehlt' };
  }
  /** @type {unknown} */
  let daten;
  try {
    daten = JSON.parse(readFileSync(datei, 'utf8'));
  } catch {
    return { ok: false, grund: 'Altmodul-Liste legacy-modules.json ist kein gültiges JSON' };
  }
  const liste =
    typeof daten === 'object' && daten !== null && 'dateien' in daten ? daten.dateien : null;
  if (!Array.isArray(liste)) {
    return { ok: false, grund: 'Altmodul-Liste legacy-modules.json ohne Feld «dateien»' };
  }
  /** @type {{ pfad: string; sha256: string }[]} */
  const dateien = [];
  for (const e of liste) {
    const pfad = typeof e === 'object' && e !== null && 'pfad' in e ? e.pfad : null;
    const sha = typeof e === 'object' && e !== null && 'sha256' in e ? e.sha256 : null;
    if (
      typeof pfad !== 'string' ||
      typeof sha !== 'string' ||
      !/^[0-9a-f]{64}$/.test(sha) ||
      pfad === '' ||
      pfad.includes('\\') ||
      isAbsolute(pfad) ||
      pfad.split('/').includes('..')
    ) {
      return {
        ok: false,
        grund: 'Altmodul-Liste legacy-modules.json enthält einen ungültigen Eintrag',
      };
    }
    dateien.push({ pfad, sha256: sha });
  }
  return { ok: true, dateien };
}

/**
 * Prüft je Eintrag von scripts/wap-gate/legacy-modules.json, ob der SHA-256 (Inhalt nach CRLF→LF)
 * dem eingefrorenen Wert entspricht. Fehlt eine gelistete Datei, gilt sie als verändert. Fehlt die
 * Liste oder ist sie ungültig, wirft die Funktion mit Ursache.
 * @param {{ cwd: string; liste?: string }} opts
 * @returns {Promise<{ pfad: string; unveraendert: boolean }[]>}
 */
export async function legacyUnchanged(opts) {
  const datei = opts.liste ?? join(opts.cwd, ...LEGACY_REL.split('/'));
  const liste = ladeLegacyListe(datei);
  if (!liste.ok) throw new Error(liste.grund);
  return liste.dateien.map(({ pfad, sha256 }) => {
    const abs = join(opts.cwd, ...pfad.split('/'));
    if (!existsSync(abs)) return { pfad, unveraendert: false };
    return { pfad, unveraendert: sha256Lf(readFileSync(abs)) === sha256 };
  });
}
