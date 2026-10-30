// Muster des Datenschutz-Scans und Ausgabe von Pfaden (Paket H0).
// Vertrag: docs/wap-planer/pakete/H0.md, Klausel 5, P8, P19, P20, P22, P29, P30, P32, P35–P35d, P40,
// P47d–P47g. Gemeinsam für alle Harness-Skripte; bewusst ohne Import von common.mjs (kein Zyklus).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const SPERRLISTE = 'datenschutz-sperrliste.txt';
export const ANTHROPIC_TRAILER = ['noreply', 'anthropic.com'].join('@');
export const PFAD_MASKIERT = '(Pfad maskiert)';

/**
 * WAP-Pfadmenge (P35): Nur hier werden Inhaltsmuster geprüft. Alle Muster sind an der Repo-Wurzel
 * verankert und gelten segmentweise (P35b, P35c); `**` steht für null oder mehr Verzeichnisse,
 * `*` für beliebige Zeichen innerhalb eines Segments.
 */
const WAP_PFADMENGE = [
  'docs/wap-planer/**',
  'scripts/wap/**',
  'scripts/wap-gate/**',
  'tests/wap-harness/**',
  'tests/wap/**',
  'tests/wap-e2e/**',
  'tests/wap-gate/**',
  'tests/wap-perf/**',
  'src/**/wap/**',
  'src/**/wap-*/**',
  'src/io/xlsx-drawing/**',
  'src/assets/wap-fonts/**',
  'tools/wap/**',
  '.claude/**',
  'vitest.wap*',
  'playwright.wap*',
  'AGENTS.md',
  // P40: weitere WAP-Dateien und die Suite-Dateien, die Etappe-1-Pakete laut plan/etappe-1.md §9
  // ändern. Weitere Einträge nur über lock-update mit Grund.
  'src/pages/Wap*',
  'stryker.wap*',
  'tsconfig.wap*',
  'src/io/wap/**',
  'src/App.tsx',
  'src/components/Shell.tsx',
  'src/components/CommandPalette.tsx',
  'src/components/Icon.tsx',
  'tools/build-offline.mjs',
  'package.json',
  '.gitignore',
  '.gitattributes',
  'biome.json',
];

/**
 * Übersetzt ein Muster der Pfadmenge in einen wurzelverankerten regulären Ausdruck (P35b, P35c).
 * @param {string} muster
 */
function musterZuRegex(muster) {
  const segmente = muster.split('/');
  let quelle = '^';
  segmente.forEach((seg, i) => {
    const letztes = i === segmente.length - 1;
    if (seg === '**') {
      // P35d: `[^]` deckt jedes Zeichen einschliesslich Zeilenumbruch und Steuerzeichen.
      quelle += letztes ? '[^]+' : '(?:[^/]+/)*';
      return;
    }
    quelle += seg
      .split('*')
      .map((teil) => teil.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*');
    if (!letztes) quelle += '/';
  });
  // Gross/Klein egal: auf Windows ist «Docs/WAP-Planer» derselbe Ordner (im Zweifel prüfen).
  return new RegExp(`${quelle}$`, 'i');
}

const WAP_PFADMENGE_RE = WAP_PFADMENGE.map(musterZuRegex);

/**
 * Ist der Pfad Teil der WAP-Pfadmenge (P35, P35b, P35c, P35d)?
 * @param {string} rel Pfad relativ zur Worktree-Wurzel mit `/`
 */
export function istWapPfad(rel) {
  return WAP_PFADMENGE_RE.some((re) => re.test(rel));
}

// AHV-Nummer mit Punkten oder Leerraum gegliedert oder ungegliedert (P20, P32); nicht Teil eines
// Wortes, einer längeren Zahl oder einer Dezimalzahl (nur Ziffer + Punkt schliesst aus, P30).
const AHV = /(?<!\w|\d\.)756(?:[.\s]\d{4}[.\s]\d{4}[.\s]\d{2}|\d{10})(?!\w|\.\d)/g;
// Schweizer Telefonnummern (Klausel 5, P20, P32): +41 oder 0041 (je optional mit «(0)»), die
// Klammer-Vorwahl (0xx) oder 0, danach insgesamt 9 Ziffern, gegliedert durch Punkt, Strich,
// Schrägstrich oder beliebigen Leerraum (inkl. U+00A0, mehrfach). Nach der nationalen 0 folgt
// direkt eine Ziffer (sonst Dezimalzahl). Kein Treffer, wenn die Folge an eine weitere Ziffer, einen
// Buchstaben oder eine Dezimalzahl (Ziffer + Punkt, P30) grenzt.
const GLIEDERUNG = '(?:[./-]|\\s+)';
const TELEFON = new RegExp(
  '(?<![\\w+]|\\d[./-])' +
    '(?:' +
    `(?:\\+41|0041)(?:\\s*\\(0\\))?${GLIEDERUNG}?\\d(?:${GLIEDERUNG}?\\d){8}` +
    `|\\(0\\d{2}\\)\\s*\\d(?:${GLIEDERUNG}?\\d){6}` +
    `|0\\d(?:${GLIEDERUNG}?\\d){8}` +
    ')' +
    '(?!\\w|[./-]\\d)',
  'g',
);
export const EMAIL =
  /(?<![\w.%+-])[\w.%+-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)*\.[A-Za-z]{2,}(?!\w)/g;
const WORTZEICHEN = '[\\p{L}\\p{N}_]';
/** Gültiges Datum dd.mm.yyyy (Tag 01–31, Monat 01–12) mit folgender Zeitangabe (P20, P32). */
const DATUM_MIT_ZEIT = /^(?:0[1-9]|[12]\d|3[01])\.(?:0[1-9]|1[0-2])\.\d{4}\s+\d/;
/** SVG-Pfaddaten: beginnt mit M/m und einer Zahl, nur Pfadbefehle, Zahlen, Zeichen (P20). */
const SVG_PFAD = /^\s*[Mm]\s*[-+]?\.?\d[MmLlHhVvCcSsQqTtAaZz\d\s.,+-]*$/;
/** P29: neben dem Anfangsbefehl mindestens ein weiterer Pfadbefehl. */
const WEITERER_PFADBEFEHL = /[LlHhVvCcSsQqTtAaZz]/;

/**
 * @typedef {{ art: string, maske: string }} Fund
 * @typedef {{ schluessel: string, re: RegExp }} Name
 * @typedef {{ erlaubteNamen?: Set<string>, ohneEmail?: boolean }} Optionen
 */

/**
 * Maskiert eine Nummer: nur die Präfixe 756, +41, 0041, 0 bleiben, alle übrigen Ziffern werden *.
 * @param {string} wert
 * @param {'ahv' | 'telefon'} art
 */
function maskNummer(wert, art) {
  let behalten = wert.indexOf('0') + 1;
  if (art === 'ahv') behalten = 3;
  else if (wert.startsWith('+41')) behalten = 3;
  else if (wert.startsWith('0041')) behalten = 4;
  return wert.slice(0, behalten) + wert.slice(behalten).replace(/\d/g, '*');
}

/**
 * Ersetzt SVG-Pfaddaten durch Leerzeichen gleicher Länge (P20, P29): Zeichenketten-Literale bzw.
 * Attributwerte in '…', "…" oder `…`, die mit M/m und einer Zahl beginnen, nur aus Pfadzeichen
 * bestehen und mindestens einen weiteren Pfadbefehl enthalten. Alles andere wird normal geprüft.
 * @param {string} zeile
 */
function ohneSvgPfade(zeile) {
  return zeile.replace(/(['"`])((?:(?!\1)[^\\]|\\.)*)\1/g, (m, _q, inhalt) =>
    SVG_PFAD.test(inhalt) && WEITERER_PFADBEFEHL.test(inhalt.replace(/^\s*[Mm]/, ''))
      ? ' '.repeat(m.length)
      : m,
  );
}

/**
 * Telefonnummern einer Zeile mit den Ausnahmen aus P20.
 * @param {string} zeile
 * @returns {string[]}
 */
function telefonnummern(zeile) {
  const text = ohneSvgPfade(zeile);
  /** @type {string[]} */
  const out = [];
  const re = new RegExp(TELEFON.source, TELEFON.flags);
  for (let m = re.exec(text); m !== null; m = re.exec(text)) {
    const ziffern = m[0].replace(/\D/g, '');
    if (ziffern === '0123456789' || DATUM_MIT_ZEIT.test(text.slice(m.index))) {
      re.lastIndex = m.index + 1;
      continue;
    }
    out.push(m[0]);
  }
  return out;
}

/**
 * Alle Funde in einem Text (Zeile oder Pfad).
 * @param {string} text NFC-normalisiert
 * @param {Name[]} namen
 * @param {Set<string>} emails freigegebene E-Mail-Adressen (klein)
 * @param {Optionen} [optionen] erlaubteNamen: Schlüssel erlaubter Sperrlisten-Namen (P36);
 *   ohneEmail: keine E-Mail-Prüfung (gültige `<Name>@<pfad>`-Zeile der Positivliste, P36b)
 * @returns {Fund[]}
 */
export function funde(text, namen, emails, optionen = {}) {
  /** @type {Fund[]} */
  const out = [];
  for (const m of text.matchAll(AHV)) {
    out.push({ art: 'AHV-Nummer', maske: maskNummer(m[0], 'ahv') });
  }
  for (const nummer of telefonnummern(text)) {
    out.push({ art: 'Telefonnummer', maske: maskNummer(nummer, 'telefon') });
  }
  if (!optionen.ohneEmail) {
    for (const m of text.matchAll(EMAIL)) {
      if (!emails.has(m[0].toLowerCase())) out.push({ art: 'E-Mail-Adresse', maske: '***@***' });
    }
  }
  for (const { schluessel, re } of namen) {
    if (optionen.erlaubteNamen?.has(schluessel)) continue;
    re.lastIndex = 0;
    if (re.test(text)) out.push({ art: 'Name aus der Sperrliste', maske: '***' });
  }
  return out;
}

/**
 * Schlüssel eines Namens für Vergleiche (P22, P36b): NFC, Kleinschreibung.
 * @param {string} name
 */
export function namensSchluessel(name) {
  return name.trim().normalize('NFC').toLowerCase();
}

/**
 * Sperrliste laden (P8, P22, P24): WAP_REFERENCE_DIR allein massgebend, sonst reference/ des
 * Haupt-Checkouts (Elternordner von `git rev-parse --git-common-dir` im aktuellen Ordner).
 * @returns {{ ok: true, namen: Name[] } | { ok: false, grund: string }}
 */
export function ladeSperrliste() {
  const env = process.env.WAP_REFERENCE_DIR;
  let datei;
  if (env !== undefined && env !== '') {
    datei = join(env, SPERRLISTE);
  } else {
    const r = spawnSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, GIT_NO_REPLACE_OBJECTS: '1' },
    });
    const common = (r.stdout ?? '').trim();
    if (r.status !== 0 || common === '') {
      return {
        ok: false,
        grund:
          'Sperrliste nicht auffindbar: WAP_REFERENCE_DIR ist nicht gesetzt und kein git-Repo. ' +
          `WAP_REFERENCE_DIR auf den Ordner mit ${SPERRLISTE} setzen.`,
      };
    }
    datei = join(dirname(resolve(common)), 'reference', SPERRLISTE);
  }
  if (!existsSync(datei)) {
    return {
      ok: false,
      grund:
        `Sperrliste ${SPERRLISTE} fehlt (${env ? 'WAP_REFERENCE_DIR' : 'reference/ des Haupt-Checkouts'}). ` +
        'Ohne Sperrliste kein Datenschutz-Scan: Datei lokal anlegen (ein Name pro Zeile, # = Kommentar).',
    };
  }
  let text;
  try {
    text = readFileSync(datei, 'utf8');
  } catch {
    return {
      ok: false,
      grund: `Sperrliste ${SPERRLISTE} ist nicht lesbar; Zugriffsrechte prüfen.`,
    };
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const namen = text
    .split(/\r?\n/)
    .map((z) => z.trim().normalize('NFC'))
    .filter((z) => z !== '' && !z.startsWith('#'));
  if (namen.length === 0) {
    return {
      ok: false,
      grund:
        `Sperrliste ${SPERRLISTE} enthält keine Namen (nur Kommentare oder Leerzeilen). ` +
        'Ohne Namen kein Datenschutz-Scan: mindestens einen Namen eintragen.',
    };
  }
  return {
    ok: true,
    namen: namen.map((name) => ({
      schluessel: namensSchluessel(name),
      re: new RegExp(
        `(?<!${WORTZEICHEN})${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?!${WORTZEICHEN})`,
        'giu',
      ),
    })),
  };
}

/**
 * Als `\u{NNNN}` ausgegeben (P47d, P47i): Bidi-Steuerzeichen (ALM, LRM/RLM, LRE…RLO, LRI…PDI) sowie
 * Zeilen- und Absatztrenner U+2028, U+2029.
 */
const ALS_UNICODE = new Set([
  0x061c, 0x200e, 0x200f, 0x202a, 0x202b, 0x202c, 0x202d, 0x202e, 0x2028, 0x2029,
]);
for (let c = 0x2066; c <= 0x2069; c++) ALS_UNICODE.add(c);

/**
 * Pfad für die Ausgabe in Escape-Form (P47d, P47i): ein wörtlicher Backslash als `\\`, Steuerzeichen
 * (C0, DEL) als `\xNN`; C1-Zeichen (U+0080–U+009F), Bidi-Steuerzeichen, U+2028, U+2029 und einzelne
 * Surrogate (U+D800–U+DFFF ohne Partner) als `\u{NNNN}`. Jede Meldung bleibt damit eine Zeile.
 * @param {string} pfad
 */
export function escapePfad(pfad) {
  let out = '';
  // Die Iteration nach Code-Points liefert ein gültiges Surrogat-Paar als ein Zeichen (Wert ab
  // U+10000); ein einzelnes Surrogat erscheint als eigener Code-Point im Bereich D800–DFFF.
  for (const zeichen of pfad) {
    const c = /** @type {number} */ (zeichen.codePointAt(0));
    if (zeichen === '\\') out += '\\\\';
    else if (c < 0x20 || c === 0x7f) out += `\\x${c.toString(16).padStart(2, '0')}`;
    else if ((c >= 0x80 && c <= 0x9f) || (c >= 0xd800 && c <= 0xdfff) || ALS_UNICODE.has(c)) {
      out += `\\u{${c.toString(16).toUpperCase().padStart(4, '0')}}`;
    } else out += zeichen;
  }
  return out;
}

/** @type {Name[] | null | undefined} undefined = noch nicht geladen; null = Sperrliste fehlt */
let geladeneNamen;

/**
 * Pfad oder Aufrufargument für eine Meldung (P47d–P47g): Enthält er ein P19-Muster oder einen
 * Sperrlisten-Namen, erscheint nur «(Pfad maskiert)»; sonst die Escape-Form. Fehlt die Sperrliste,
 * wird jeder Pfad maskiert (im Zweifel nichts preisgeben). Repo-relative Pfade werden mit `/`
 * übergeben (P47g); die Trennerform absoluter Pfade ist frei (P47f a).
 * @param {string} pfad
 */
export function zeigePfad(pfad) {
  if (geladeneNamen === undefined) {
    const liste = ladeSperrliste();
    geladeneNamen = liste.ok ? liste.namen : null;
  }
  if (geladeneNamen === null) return PFAD_MASKIERT;
  const treffer = funde(pfad.normalize('NFC'), geladeneNamen, new Set([ANTHROPIC_TRAILER]));
  return treffer.length > 0 ? PFAD_MASKIERT : escapePfad(pfad);
}
