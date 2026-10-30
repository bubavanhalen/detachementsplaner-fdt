// Ebene-2-Prüfung der erzeugten PDF (Paket E1-01b, R-H-19; ADR-010 §3.2 V5, §3.5 S6, §7.2): prüft jedes PDF
// unter test-results/wap/pdf/ mit den Prüfhilfen tests/wap/support/pdf/ (nur das PDF, nie das Layout-Modell)
// auf Mindestschriftgrösse (R-10-38) und eingebettete Schriften (R-10-36). Schritt «V5-ebene2».
// Aufruf: node scripts/wap-gate/pdf-artefakte.mjs [--root <verzeichnis>]
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 und Entscheid zu TR-E101b-05 (wert je Befundart).
// Die Prüfhilfen werden aus dem eigenen Checkout geladen (Typentfernung von Node 24). Meldungen nennen nur
// Dateien, Schriftnamen und Grössen, nie Text aus dem PDF.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { zeigePfad } from '../wap/lib/common.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {'schriftgroesse' | 'nicht-eingebettet' | 'nicht-lesbar'} Art */
/** @typedef {{ datei: string; art: Art; wert: string }} Befund */

const ID = 'V5-ebene2';

/** Mindestschriftgrösse (R-10-38). */
const MINDEST_PT = 4.5;

/** Toleranz der Grössenprüfung (pt). */
const TOLERANZ = 0.001;

/** Wurzel des Checkouts, aus dem dieses Skript geladen ist (dort liegen die Prüfhilfen). */
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** @typedef {import('../../tests/wap/support/pdf/read').PdfInfo} PdfInfo */

/**
 * Prüfhilfen des eigenen Checkouts (readPdf, minFontSize).
 * @returns {Promise<{ readPdf: (b: Uint8Array) => Promise<PdfInfo>; minFontSize: (info: PdfInfo) => number }>}
 */
async function pruefhilfen() {
  const pdf = join(WURZEL, 'tests', 'wap', 'support', 'pdf');
  const [lesen, pruefen] = await Promise.all([
    import(pathToFileURL(join(pdf, 'read.ts')).href),
    import(pathToFileURL(join(pdf, 'checks.ts')).href),
  ]);
  return { readPdf: lesen.readPdf, minFontSize: pruefen.minFontSize };
}

/**
 * Alle *.pdf unter `ordner` (rekursiv, sortiert).
 * @param {string} ordner
 * @returns {string[]}
 */
function pdfDateien(ordner) {
  /** @type {string[]} */
  const aus = [];
  /** @param {string} dir */
  const gehe = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
    )) {
      const pfad = join(dir, e.name);
      if (e.isDirectory()) gehe(pfad);
      else if (e.isFile() && /\.pdf$/i.test(e.name)) aus.push(pfad);
    }
  };
  gehe(ordner);
  return aus;
}

/**
 * Pfad für Meldungen: relativ zu `cwd` (mit «/»), sonst relativ zum geprüften Ordner.
 * @param {string} cwd
 * @param {string} ordner
 * @param {string} datei
 * @returns {string}
 */
function anzeige(cwd, ordner, datei) {
  const imRepo = relative(cwd, datei);
  const rel =
    imRepo !== '' && !imRepo.startsWith('..') && !isAbsolute(imRepo)
      ? imRepo
      : relative(ordner, datei);
  return rel.split(sep).join('/');
}

/**
 * Zahl in pt für Meldungen (Komma, höchstens drei Nachkommastellen).
 * @param {number} pt
 * @returns {string}
 */
function ptText(pt) {
  return String(Math.round(pt * 1000) / 1000).replace('.', ',');
}

/**
 * Ursache eines Lesefehlers ohne PDF-Inhalt: nur die Art des Fehlers (Fehlerklasse von pdfjs bzw. die
 * festen Meldungen des Lesers ohne ihren variablen Teil), nie die Meldung von pdfjs selbst.
 * @param {unknown} e
 * @returns {string}
 */
function lesefehler(e) {
  if (!(e instanceof Error)) return 'PDF nicht lesbar';
  for (const fest of ['PDF-Text mit nicht unterstützter Drehung', 'PDF-Schrift ohne Metrik']) {
    if (e.message.startsWith(fest)) return `PDF nicht lesbar: ${fest}`;
  }
  // Gedrehte Seite (Notiz Code-Review Runde 1 Nr 6): Seitenzahl und Grad sind Zahlen, kein PDF-Inhalt.
  const gedreht = /^PDF-Seite (\d+) ist gedreht \(\/Rotate (\d+)\)/.exec(e.message);
  if (gedreht !== null) {
    return `PDF nicht lesbar: Seite ${gedreht[1] ?? '?'} gedreht (/Rotate ${gedreht[2] ?? '?'}), readPdf liest nur ungedrehte Seiten`;
  }
  const art = /^[A-Za-z]+$/.test(e.name) ? e.name : 'Error';
  return `PDF nicht lesbar (${art})`;
}

/**
 * Prüft jedes PDF unter `ordner` (Standard <cwd>/test-results/wap/pdf, rekursiv); fehlt der Ordner oder ist er
 * leer: grün.
 * @param {{ cwd: string; ordner?: string; mindestPt?: number }} opts
 * @returns {Promise<Schritt & { geprueft: number; befunde: Befund[] }>}
 */
export async function checkPdfArtefakte(opts) {
  const beginn = Date.now();
  const cwd = resolve(opts.cwd);
  const ordner = resolve(opts.ordner ?? join(cwd, 'test-results', 'wap', 'pdf'));
  const mindest = opts.mindestPt ?? MINDEST_PT;
  const dateien = existsSync(ordner) && statSync(ordner).isDirectory() ? pdfDateien(ordner) : [];
  /** @type {Befund[]} */
  const befunde = [];
  if (dateien.length === 0)
    return { id: ID, ok: true, ms: Date.now() - beginn, geprueft: 0, befunde };
  const { readPdf, minFontSize } = await pruefhilfen();
  /** @type {string[]} */
  const eintraege = [];
  for (const datei of dateien) {
    const name = anzeige(cwd, ordner, datei);
    /** @type {string[]} */
    const teile = [];
    try {
      const info = await readPdf(new Uint8Array(readFileSync(datei)));
      const min = minFontSize(info);
      if (min < mindest - TOLERANZ) {
        befunde.push({ datei: name, art: 'schriftgroesse', wert: ptText(min) });
        teile.push(
          `Schrift unter Mindestgrösse ${ptText(mindest)} pt (kleinste ${ptText(min)} pt)`,
        );
      }
      const fremd = [
        ...new Set(info.fonts.filter((f) => !f.embedded).map((f) => f.name || '(ohne Namen)')),
      ];
      if (fremd.length > 0) {
        const liste = fremd.join(', ');
        befunde.push({ datei: name, art: 'nicht-eingebettet', wert: liste });
        teile.push(`Schrift nicht eingebettet (${liste})`);
      }
    } catch (e) {
      const wert = lesefehler(e);
      befunde.push({ datei: name, art: 'nicht-lesbar', wert });
      teile.push(wert);
    }
    if (teile.length > 0) eintraege.push(`${zeigePfad(name)}: ${teile.join('; ')}`);
  }
  if (befunde.length === 0) {
    return { id: ID, ok: true, ms: Date.now() - beginn, geprueft: dateien.length, befunde };
  }
  return {
    id: ID,
    ok: false,
    ms: Date.now() - beginn,
    ursache: `PDF-Befunde in ${String(eintraege.length)} von ${String(dateien.length)} Dateien: ${kurzeListe(eintraege)}`,
    naechsterSchritt:
      'Erzeugung der PDF korrigieren: Schriftgrösse ≥ 4,5 pt (R-10-38), Schriften eingebettet (R-10-36), PDF gültig; Prüfung mit den Prüfhilfen tests/wap/support/pdf/',
    details: { geprueft: dateien.length, befunde: befunde.length },
    geprueft: dateien.length,
    befunde,
  };
}

// CLI: Aufruf als Skript (Vertrag E1-01 §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  const root = i >= 0 ? args[i + 1] : undefined;
  if (
    (i >= 0 && (root === undefined || root.startsWith('--'))) ||
    args.length !== (i >= 0 ? 2 : 0)
  ) {
    fehlerMeldung('Aufruf: node scripts/wap-gate/pdf-artefakte.mjs [--root <verzeichnis>]');
    process.exitCode = 1;
  } else {
    const s = await checkPdfArtefakte({ cwd: resolve(root ?? '.') });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}
