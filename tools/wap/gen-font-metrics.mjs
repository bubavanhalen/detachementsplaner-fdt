// Erzeugt src/model/wap/layout/text/metrics.generated.ts aus den Arimo-Dateien (Vertrag E1-02b, ADR-004).
// Aufruf: node tools/wap/gen-font-metrics.mjs [--check]
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Genutzte Felder von fontkit 2 (das Paket bringt keine Typdeklarationen mit, Vertrag Abschnitt 5).
 * @typedef {{ readonly advanceWidth: number }} FkGlyph
 * @typedef {{ readonly ascent: number, readonly descent: number, readonly lineGap: number }} FkHhea
 * @typedef {{
 *   readonly unitsPerEm: number,
 *   readonly characterSet: readonly number[],
 *   readonly hhea: FkHhea,
 *   glyphForCodePoint(codePoint: number): FkGlyph,
 *   getGlyph(id: number): FkGlyph,
 * }} FkFont
 * @typedef {{ create(buffer: Buffer): unknown }} FkModule
 * @typedef {'regular' | 'bold'} Weight
 */

/** fontkit 2.0.4 (nur Werkzeug und Tests, nie im Modul layout/text; ADR-010 §4.4). */
const fontkit = /** @type {FkModule} */ (createRequire(import.meta.url)('fontkit'));

/** SHA-256 der gebundenen Schriftdateien (Vertrag E1-02b Abschnitt 1, ADR-003). */
const FONT_SHA256 = /** @type {const} */ ({
  regular: '88cc899855d30f9c779b73c3319d0e077b098f927187aafce11ca029add707a6',
  bold: 'ec96ac9fdd94766f66f6140c1375bf011577558f88d43f76b3b59307d2a6bca3',
});

const FONT_FILES = /** @type {const} */ ({
  regular: 'Arimo-Regular.ttf',
  bold: 'Arimo-Bold.ttf',
});

/** @type {readonly Weight[]} */
const WEIGHTS = ['regular', 'bold'];

const FONT_DIR = ['src', 'assets', 'wap-fonts'];
const OUTPUT = ['src', 'model', 'wap', 'layout', 'text', 'metrics.generated.ts'];

/** Zeilenbreite und Einzug wie in biome.json (P-14). */
const LINE_WIDTH = 100;
const ARRAY_INDENT = '      ';

/**
 * Prüft den SHA-256 eines Schnitts gegen Vertrag Abschnitt 1 (P-17: vor jedem Parsen).
 * @param {Uint8Array} bytes
 * @param {Weight} weight
 */
function checkSha256(bytes, weight) {
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== FONT_SHA256[weight]) {
    throw new Error(
      `Schriftdatei ${FONT_FILES[weight]} (Schnitt ${weight}): SHA-256 weicht von Vertrag E1-02b ab. ` +
        'Die Datei byte-gleich aus @expo-google-fonts/arimo@0.4.3 ablegen und erneut erzeugen.',
    );
  }
}

/**
 * Schriftdatei mit fontkit lesen (nach der SHA-256-Prüfung).
 * @param {Uint8Array} bytes
 * @returns {FkFont}
 */
function parseFont(bytes) {
  return /** @type {FkFont} */ (fontkit.create(Buffer.from(bytes)));
}

/**
 * Flache Paarliste [cp0, adv0, cp1, adv1, …], aufsteigend nach Codepunkt, genau die cmap.
 * @param {FkFont} font
 * @returns {number[]}
 */
function advancePairs(font) {
  const codePoints = [...font.characterSet].sort((a, b) => a - b);
  /** @type {number[]} */
  const pairs = [];
  for (const cp of codePoints) pairs.push(cp, font.glyphForCodePoint(cp).advanceWidth);
  return pairs;
}

/**
 * Zahlenliste im Füll-Layout von Biome: so viele Werte je Zeile, wie in die Zeilenbreite passen.
 * Werte sind ganze Zahlen aus der Schriftdatei; `String` schreibt sie nach P-21.
 * @param {readonly number[]} values
 * @returns {string[]}
 */
function fillLines(values) {
  /** @type {string[]} */
  const lines = [];
  let line = '';
  for (const value of values) {
    const item = `${String(value)},`;
    if (line === '') line = ARRAY_INDENT + item;
    else if (line.length + 1 + item.length <= LINE_WIDTH) line += ` ${item}`;
    else {
      lines.push(line);
      line = ARRAY_INDENT + item;
    }
  }
  lines.push(line);
  return lines;
}

/**
 * Text des Moduls `metrics.generated.ts`: deterministisch, LF, Biome-konform, ohne Zeitangaben.
 * @param {{ regular: Uint8Array, bold: Uint8Array }} ttf Bytes von Arimo-Regular.ttf und Arimo-Bold.ttf
 * @returns {string}
 */
export function renderFontMetricsModule(ttf) {
  for (const weight of WEIGHTS) checkSha256(ttf[weight], weight);
  const fonts = { regular: parseFont(ttf.regular), bold: parseFont(ttf.bold) };
  // Vertikale Werte aus hhea; beide gebundenen Schnitte sind gleich (P-6, P-17, Test R-L-03).
  const { unitsPerEm, hhea } = fonts.regular;
  const out = [
    '// Erzeugt von tools/wap/gen-font-metrics.mjs – nicht von Hand ändern.',
    "import type { GeneratedFontMetrics } from './types';",
    '',
    'export const ARIMO_METRICS: GeneratedFontMetrics = {',
    `  unitsPerEm: ${String(unitsPerEm)},`,
    `  ascender: ${String(hhea.ascent)},`,
    `  descender: ${String(hhea.descent)},`,
    `  lineGap: ${String(hhea.lineGap)},`,
    '  sourceSha256: {',
    ...WEIGHTS.map((w) => `    ${w}: '${FONT_SHA256[w]}',`),
    '  },',
    '  notdefAdvance: {',
    ...WEIGHTS.map((w) => `    ${w}: ${String(fonts[w].getGlyph(0).advanceWidth)},`),
    '  },',
    '  advances: {',
  ];
  for (const weight of WEIGHTS) {
    out.push(`    ${weight}: [`, ...fillLines(advancePairs(fonts[weight])), '    ],');
  }
  out.push('  },', '};', '');
  return out.join('\n');
}

/**
 * Liest eine Schriftdatei; fehlt sie, folgt ein Error mit dem Dateinamen.
 * @param {string} cwd
 * @param {Weight} weight
 * @returns {Promise<Uint8Array>}
 */
async function readFont(cwd, weight) {
  try {
    return new Uint8Array(await readFile(join(cwd, ...FONT_DIR, FONT_FILES[weight])));
  } catch (cause) {
    throw new Error(
      `Schriftdatei ${FONT_FILES[weight]} fehlt oder ist nicht lesbar (${FONT_DIR.join('/')}). ` +
        'Die Datei ablegen und erneut aufrufen.',
      { cause },
    );
  }
}

/**
 * Inhalt der bestehenden Ausgabedatei; null, wenn sie fehlt.
 * @param {string} path
 * @returns {Promise<string | null>}
 */
async function readExisting(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return null;
  }
}

/**
 * CLI: ohne Argument schreiben, mit `--check` nur vergleichen.
 * @param {readonly string[]} argv Argumente nach dem Skriptnamen
 * @param {{ cwd: string }} opts Wurzel des Repos
 * @returns {Promise<number>} Exit-Code: 0 = geschrieben bzw. aktuell, 1 = `--check` mit Abweichung
 */
export async function runGenFontMetrics(argv, opts) {
  const check = argv.includes('--check');
  const text = renderFontMetricsModule({
    regular: await readFont(opts.cwd, 'regular'),
    bold: await readFont(opts.cwd, 'bold'),
  });
  const path = join(opts.cwd, ...OUTPUT);
  if (check) {
    if ((await readExisting(path)) === text) return 0;
    process.stderr.write(
      `${OUTPUT.join('/')} fehlt oder ist veraltet. ` +
        'Mit «node tools/wap/gen-font-metrics.mjs» neu erzeugen und die Datei committen.\n',
    );
    return 1;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, 'utf8');
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runGenFontMetrics(process.argv.slice(2), { cwd: process.cwd() });
}
