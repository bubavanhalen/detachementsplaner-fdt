// Golden-Kandidaten aus den PDF-Artefakten von Paket E1-02f (Vertrag docs/wap-planer/plan/vertraege/E1-02f.md,
// Notiz «Ausarbeitung Schritt 2» Abschnitt I2; Prompt §5.2 Schritt 8, §7 Ebene 3; AE-001 §2). Liest die vier
// Kandidaten nach der Tabelle I1 aus den Artefakten (pdfArtefakt, H1) und rendert sie mit renderPdfPage (E1-01b;
// pdfjs-dist 6.3.289, @napi-rs/canvas, 300 dpi), geladen über die Typentfernung von Node 24 wie
// checkPdfArtefakte. Schreibt je Kandidat das PNG und dazu kandidaten.json (Name, Quelle, Seite, SHA-256).
// Ausgabe nur Dateinamen und SHA-256, nie Inhalte; fehlt ein Artefakt: Exit 1 mit dessen Namen.
// Aufruf: node tests/wap/pdf/plan/support/golden-kandidaten.mjs --pdf-ordner test-results/wap/pdf --ziel <ordner>
// Die Artefakte stammen nur aus der pseudonymisierten KVK-Fixture und fiktiven Varianten (I6).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

/** Wurzel des Checkouts, aus dem dieses Skript geladen ist (dort liegt die Prüfhilfe renderPdfPage). */
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', '..');

/**
 * Kandidaten nach Vertrag I1: Name des Bildes, Artefakt (ohne «.pdf»), Seite (ab 1).
 * @type {readonly { name: string; quelle: string; seite: number }[]}
 */
export const KANDIDATEN = [
  { name: 'kvk-woche-s1.png', quelle: 'e1-02f-kvk-woche', seite: 1 },
  { name: 'kvk-plus-s1.png', quelle: 'e1-02f-kvk-plus', seite: 1 },
  { name: 'kvk-fortsetzung-s1.png', quelle: 'e1-02f-kvk-fortsetzung', seite: 1 },
  { name: 'kvk-fortsetzung-s2.png', quelle: 'e1-02f-kvk-fortsetzung', seite: 2 },
];

/**
 * @param {Uint8Array} bytes
 * @returns {string}
 */
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Wert der Option `name` aus den Argumenten; undefined, wenn sie fehlt oder ohne Wert ist.
 * @param {readonly string[]} args
 * @param {string} name
 * @returns {string | undefined}
 */
function option(args, name) {
  const i = args.indexOf(name);
  const wert = i >= 0 ? args[i + 1] : undefined;
  return wert === undefined || wert.startsWith('--') ? undefined : wert;
}

/**
 * Erzeugt die Kandidaten. Liefert den Exit-Code (0 = alle geschrieben, 1 = Aufruf falsch oder Artefakt fehlt).
 * @param {{ pdfOrdner: string; ziel: string; aus?: (text: string) => void; fehler?: (text: string) => void }} opts
 * @returns {Promise<number>}
 */
export async function erzeugeKandidaten(opts) {
  const aus = opts.aus ?? ((t) => process.stdout.write(`${t}\n`));
  const fehler = opts.fehler ?? ((t) => process.stderr.write(`${t}\n`));
  const pdfOrdner = resolve(opts.pdfOrdner);
  const ziel = resolve(opts.ziel);
  const fehlend = [...new Set(KANDIDATEN.map((k) => `${k.quelle}.pdf`))].filter(
    (d) => !existsSync(join(pdfOrdner, d)),
  );
  if (fehlend.length > 0) {
    fehler(`Artefakt fehlt: ${fehlend.join(', ')}`);
    return 1;
  }
  /** @type {{ renderPdfPage: (bytes: Uint8Array, seite: number, dpi: 300) => Promise<{ png: Uint8Array }> }} */
  const render = await import(
    pathToFileURL(join(WURZEL, 'tests', 'wap', 'support', 'golden', 'render.ts')).href
  );
  mkdirSync(ziel, { recursive: true });
  /** @type {{ name: string; quelle: string; seite: number; sha256: string }[]} */
  const liste = [];
  for (const k of KANDIDATEN) {
    const bytes = new Uint8Array(readFileSync(join(pdfOrdner, `${k.quelle}.pdf`)));
    const bild = await render.renderPdfPage(bytes, k.seite, 300);
    writeFileSync(join(ziel, k.name), bild.png);
    const eintrag = { name: k.name, quelle: `${k.quelle}.pdf`, seite: k.seite, sha256: sha256(bild.png) };
    liste.push(eintrag);
    aus(`${eintrag.name} ${eintrag.sha256}`);
  }
  writeFileSync(join(ziel, 'kandidaten.json'), `${JSON.stringify(liste, null, 2)}\n`);
  aus('kandidaten.json');
  return 0;
}

// CLI
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const pdfOrdner = option(args, '--pdf-ordner');
  const ziel = option(args, '--ziel');
  if (pdfOrdner === undefined || ziel === undefined || args.length !== 4) {
    process.stderr.write(
      'Aufruf: node tests/wap/pdf/plan/support/golden-kandidaten.mjs --pdf-ordner <ordner> --ziel <ordner>\n',
    );
    process.exitCode = 1;
  } else {
    process.exitCode = await erzeugeKandidaten({ pdfOrdner, ziel });
  }
}
