// Ausgabehelfer der Schleusen-Skripte (Paket E1-01, ADR-010 §3, §4.1).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 «Gemeinsam». Einzige Stelle mit Ausgabe auf die
// Konsole unter scripts/wap-gate/ (über process.stdout bzw. process.stderr; Biome noConsole).

/**
 * Meldet einen grünen Schritt: «OK <schritt> (<ms> ms)».
 * @param {string} schritt
 * @param {number} ms
 * @returns {void}
 */
export function ok(schritt, ms) {
  process.stdout.write(`OK ${schritt} (${String(Math.round(ms))} ms)\n`);
}

/**
 * Meldet einen roten Schritt: «ROT <schritt>: <ursache>. Nächster Schritt: <naechsterSchritt>».
 * Ein abschliessender Punkt der Ursache wird nicht verdoppelt.
 * @param {string} schritt
 * @param {string} ursache
 * @param {string} naechsterSchritt
 * @returns {void}
 */
export function rot(schritt, ursache, naechsterSchritt) {
  const grund = ursache.replace(/[.\s]+$/, '');
  process.stdout.write(`ROT ${schritt}: ${grund}. Nächster Schritt: ${naechsterSchritt}\n`);
}

/**
 * Hinweiszeile ohne Wertung (Zusammenfassung, Protokoll, Liste der Ausnahmen).
 * @param {string} text
 * @returns {void}
 */
export function hinweis(text) {
  process.stdout.write(`${text}\n`);
}

/**
 * Fehlermeldung eines Skripts (Aufruffehler, Abbruch) auf stderr.
 * @param {string} text
 * @returns {void}
 */
export function fehlerMeldung(text) {
  process.stderr.write(`${text}\n`);
}
