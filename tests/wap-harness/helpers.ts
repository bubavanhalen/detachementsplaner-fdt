// Gemeinsame Hilfen für die Harness-Tests (Paket H0, R-H-03 bis R-H-08).
// Alle Tests arbeiten in frischen temporären Git-Repos unter os.tmpdir(), nie im Arbeits-Checkout.
// Die Skripte werden ausschliesslich als Prozess aufgerufen (Vertrag: docs/wap-planer/pakete/H0.md,
// «Schnittstelle der Harness-Skripte» und «Präzisierungen nach Test-Review Runde 1» P1–P12).
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from 'vitest';

/** Wurzel des Arbeits-Checkouts (wird nur gelesen). */
export const CHECKOUT_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Quelle der Harness-Skripte im Arbeits-Checkout (wird nur gelesen und kopiert). */
export const SCRIPT_SOURCE = join(CHECKOUT_ROOT, 'scripts', 'wap');

export const LOCK_PATH = 'docs/wap-planer/test-lock.json';
export const FINDINGS_PATH = 'docs/wap-planer/FINDINGS.md';
export const SPERRLISTE = 'datenschutz-sperrliste.txt';

/** Zeitlimit der Kindprozesse; deutlich unter dem Test-Timeout, damit ein Hänger als Assertion endet. */
export const CHILD_TIMEOUT = 20_000;
export const SLOW = 120_000;

/** Fiktive Git-Identität; die E-Mail-Adresse wird zur Laufzeit zusammengesetzt. */
export const TEST_USER = 'Harness Test';
export const TEST_MAIL = ['test', 'example.invalid'].join('@');

/** Fiktive Namen der Test-Sperrliste (erster und letzter Eintrag werden gezielt geprüft). */
export const GESPERRTE_NAMEN = ['Zwirbelmann', 'Quendolin', 'Üngerbühl', 'Zappel-Wimmer'];

const BEFUND_TABELLE = [
  '# WAP-Planer – Befundregister',
  '',
  '| ID | Quelle (Agent, Paket, Runde) | Stufe | Anforderung / Stelle | Fundstelle | Status | Begründung / Entscheid | Verifiziert durch |',
  '| --- | --- | --- | --- | --- | --- | --- | --- |',
  '',
  '## Protokoll `test-lock.json`',
  '',
  '| Datum | Commit | Pfade | Grund | Befund-ID |',
  '| --- | --- | --- | --- | --- |',
];

/** FINDINGS.md mit einer bestehenden Protokollzeile, LF. */
export const FINDINGS_TEMPLATE = [
  ...BEFUND_TABELLE,
  '| 01.09.2026 | abc1234 | tests/alt.test.ts | Aufnahme: Startbestand | – |',
  '',
].join('\n');

/** FINDINGS.md wie im echten Repo: leere Befund- und leere Protokoll-Tabelle (Zeilenenden je Test). */
export const FINDINGS_LEER_ZEILEN = [...BEFUND_TABELLE, ''];

/** Trennzeile der (8-spaltigen) Befund-Tabelle. */
export const BEFUND_TRENNZEILE = '| --- | --- | --- | --- | --- | --- | --- | --- |';

/** Protokollzeile im Vertragsformat (Klausel 4, P4) mit den genannten Pfaden. */
export function protokollZeile(pfade: string[], aktion = 'Nachführung'): string {
  return `| 01.10.2026 | abc1234 | ${pfade.join(', ')} | ${aktion}: Testgrund | – |`;
}

/** Hängt Zeilen an FINDINGS.md an; im Template ist die Protokoll-Tabelle der letzte Abschnitt. */
export function appendProtokoll(root: string, ...zeilen: string[]): void {
  const text = readText(root, FINDINGS_PATH);
  writeText(root, FINDINGS_PATH, `${text}${zeilen.map((z) => `${z}\n`).join('')}`);
}

/** Bestehende Protokollzeile im Template (liegt nach initRepo in HEAD). */
export const ALTE_PROTOKOLLZEILE =
  '| 01.09.2026 | abc1234 | tests/alt.test.ts | Aufnahme: Startbestand | – |';

/** Ersetzt eine ganze Zeile in FINDINGS.md (ersatz = null löscht sie). */
export function ersetzeZeile(root: string, alt: string, ersatz: string | null): void {
  const lines = readText(root, FINDINGS_PATH).split('\n');
  const i = lines.indexOf(alt);
  if (i < 0) throw new Error('Test-Aufbau: Zeile in FINDINGS.md fehlt');
  if (ersatz === null) lines.splice(i, 1);
  else lines[i] = ersatz;
  writeText(root, FINDINGS_PATH, lines.join('\n'));
}

/** Fügt eine Zeile unmittelbar vor einer bestehenden Zeile ein. */
export function fuegeVorZeileEin(root: string, vor: string, zeile: string): void {
  const lines = readText(root, FINDINGS_PATH).split('\n');
  const i = lines.indexOf(vor);
  if (i < 0) throw new Error('Test-Aufbau: Zeile in FINDINGS.md fehlt');
  lines.splice(i, 0, zeile);
  writeText(root, FINDINGS_PATH, lines.join('\n'));
}

/** Vertauscht zwei bestehende Zeilen in FINDINGS.md. */
export function vertauscheZeilen(root: string, a: string, b: string): void {
  const lines = readText(root, FINDINGS_PATH).split('\n');
  const i = lines.indexOf(a);
  const k = lines.indexOf(b);
  if (i < 0 || k < 0) throw new Error('Test-Aufbau: Zeile in FINDINGS.md fehlt');
  lines[i] = b;
  lines[k] = a;
  writeText(root, FINDINGS_PATH, lines.join('\n'));
}

/** Zeilennummer (ab 1) von ALTE_PROTOKOLLZEILE im FINDINGS_TEMPLATE. */
export const ALTE_PROTOKOLLZEILE_NR =
  FINDINGS_TEMPLATE.split('\n').indexOf(ALTE_PROTOKOLLZEILE) + 1;

/**
 * P27/P34a: Die Meldung «Protokollzeile geändert oder entfernt» nennt die Zeilennummer der ersten
 * geänderten bzw. fehlenden alten Protokollzeile. Geprüft wird die Zeile der Ausgabe mit der Meldung;
 * die Nummer darf nicht Teil eines Datums, einer längeren Zahl oder eines Worts bzw. Commit-Hashes sein.
 */
export function expectProtokollMeldung(out: string, nr: number): void {
  const zeile = out.split(/\r?\n/).find((l) => l.includes('Protokollzeile geändert oder entfernt'));
  expect(zeile, 'Meldung «Protokollzeile geändert oder entfernt» fehlt').toBeDefined();
  expect(zeile).toMatch(new RegExp(`(?<![0-9A-Za-z.])${nr}(?![0-9A-Za-z.])`));
}

/** Titelzeile des Protokollabschnitts in FINDINGS.md. */
export const PROTOKOLL_TITEL = '## Protokoll `test-lock.json`';

/** Kopf- und Trennzeile der Protokoll-Tabelle. */
export const PROTOKOLL_KOPF = '| Datum | Commit | Pfade | Grund | Befund-ID |';
export const PROTOKOLL_TRENN = '| --- | --- | --- | --- | --- |';

/** P38a: späterer Abschnitt `## Anhang` mit Tabelle und HTML-Kommentar (kein Verstoss). */
export const ANHANG_ABSCHNITT =
  '\n## Anhang\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n<!-- Notiz im Anhang -->\n';

/** P38a: späterer Abschnitt mit Überschrift der Ebene `#` (TR-H0-55). */
export const ANHANG_H1_ABSCHNITT =
  '\n# Anhang\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n\n<!-- Notiz im Anhang -->\n';

/** P38a: `###`-Unterüberschrift beendet den Protokollabschnitt nicht. */
export const UNTERABSCHNITT_MIT_TABELLE =
  '\n### Unterabschnitt\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n';
export const UNTERABSCHNITT_MIT_KOMMENTAR = '\n### Unterabschnitt\n\n<!-- Notiz -->\n';

/** Hängt freien Text (mit eigenen Zeilenumbrüchen) an FINDINGS.md an. */
export function appendFindingsText(root: string, text: string): void {
  writeText(root, FINDINGS_PATH, `${readText(root, FINDINGS_PATH)}${text}`);
}

/** P42: zweite Tabelle nach einem Absatz im Protokollabschnitt (Verstoss gegen P37). */
export const ZWEITE_TABELLE = '\nText.\n\n| x | y |\n| --- | --- |\n';

/** Gefälschte Protokollzeile für die Verschleierungs-Angriffe (P43). */
const FAKE_ZEILE = '| 01.01.2026 | 0000000 | tests/a.test.ts | Aufnahme: gefälscht | – |';

/**
 * B1: zweiter Titel mit einem Cf-Zeichen (zur Laufzeit gebildet) am Ende oder mitten im Titel
 * (TR-H0-68), mit gefälschter Kopie.
 */
function zweiterTitelMitCf(
  code: number,
  position: 'ende' | 'mitte' = 'ende',
): (t: string) => string {
  const cf = String.fromCharCode(code);
  const titel =
    position === 'ende'
      ? `${PROTOKOLL_TITEL}${cf}`
      : PROTOKOLL_TITEL.replace('`test-lock.json`', `\`test-${cf}lock.json\``);
  return (t) =>
    t.replace(
      PROTOKOLL_TITEL,
      [titel, '', PROTOKOLL_KOPF, PROTOKOLL_TRENN, FAKE_ZEILE, '', '# G', '', PROTOKOLL_TITEL].join(
        '\n',
      ),
    );
}

/** B3: Setext-Titel (Unterstreichung `---` oder `===`) als zweiter Abschnitt mit Kopie. */
function setextTitel(unterstrich: string): (t: string) => string {
  return (t) =>
    `${t}\n# H\n\nProtokoll \`test-lock.json\`\n${unterstrich}\n\n${PROTOKOLL_KOPF}\n${PROTOKOLL_TRENN}\n${FAKE_ZEILE}\n`;
}

/**
 * P43 (CR-H0S-30): Verschleierungs-Angriffe B1–B3 auf FINDINGS.md. Cf-Zeichen werden zur Laufzeit
 * gebildet (kein Escape im Quelltext). B1 mit mehreren Zeichen der Kategorie Cf, B3 mit `---` und
 * `===` (TR-H0-63).
 */
export const VERSCHLEIERUNG: Array<[string, (text: string) => string]> = [
  ['B1: zweiter Titel mit Zero-Width-Zeichen und gefälschter Kopie', zweiterTitelMitCf(0x200b)],
  ['B1: zweiter Titel mit Word Joiner (Cf) und gefälschter Kopie', zweiterTitelMitCf(0x2060)],
  [
    'B1: zweiter Titel mit weichem Trennstrich (Cf) und gefälschter Kopie',
    zweiterTitelMitCf(0x00ad),
  ],
  ['B1: zweiter Titel mit BOM-Zeichen (Cf) und gefälschter Kopie', zweiterTitelMitCf(0xfeff)],
  ['B1: zweiter Titel mit Zero-Width-Joiner (Cf) und gefälschter Kopie', zweiterTitelMitCf(0x200d)],
  [
    'B1: zweiter Titel mit Zero-Width-Zeichen mitten im Titel und gefälschter Kopie',
    zweiterTitelMitCf(0x200b, 'mitte'),
  ],
  [
    'B1: zweiter Titel mit weichem Trennstrich (Cf) mitten im Titel und gefälschter Kopie',
    zweiterTitelMitCf(0x00ad, 'mitte'),
  ],
  [
    'B2: Kommentar-Anfang vor dem Titel, Ende nach der Tabelle',
    (t) => `${t.replace(PROTOKOLL_TITEL, `<!--\n${PROTOKOLL_TITEL}`)}-->\n`,
  ],
  ['B3: Setext-Titel als zweiter Abschnitt mit Kopie', setextTitel('---')],
  ['B3: Setext-Titel mit === als zweiter Abschnitt mit Kopie', setextTitel('===')],
];

/** TR-H0-65: mehrzeiliger, vor dem Titel geschlossener Kommentar (kein Verstoss). */
export function kommentarVorTitelGeschlossen(t: string): string {
  return t.replace(PROTOKOLL_TITEL, `<!--\nHinweis zum Befundregister\n-->\n\n${PROTOKOLL_TITEL}`);
}

/** P42b (a): Vergleichsstand mit zweiter Titelzeile und eigenem Block hinter dem ersten. */
export const ZWEITER_TITEL_MIT_BLOCK = `\n${PROTOKOLL_TITEL}\n\n${PROTOKOLL_KOPF}\n${PROTOKOLL_TRENN}\n${protokollZeile(['tests/zweit.test.ts'], 'Aufnahme')}\n`;

/** P42c: reiner Textabsatz im Protokollabschnitt (kein eigener Verstoss). */
export const ZUSATZ_ABSATZ = '\nNoch ein erläuternder Absatz.\n';

/** P42d: Vergleichsstand mit P37-Verstoss und einem folgenden `## Danach`-Abschnitt. */
export const VERSTOSS_MIT_DANACH = `${ZWEITE_TABELLE}\n## Danach\n\nText danach.\n`;

/**
 * P42d (Angriff C1): offener Kommentar vor dem Titel, Ende erst im nächsten `##`-Abschnitt
 * (Fehlerart «Kommentar offen», die im Vergleichsstand nicht vorkommt).
 */
export function kommentarBisDanach(t: string): string {
  return t
    .replace(PROTOKOLL_TITEL, `<!--\n${PROTOKOLL_TITEL}`)
    .replace('## Danach\n', '## Danach\n\n-->\n');
}

/** P43d: Titel nur als `###`-Überschrift (ATX-Ebene 3). */
export const TITEL_H3 = PROTOKOLL_TITEL.replace('## ', '### ');

/** P43d: Titeltext mit beliebiger ATX-Ebene. */
function titelEbene(rauten: string): string {
  return PROTOKOLL_TITEL.replace('## ', `${rauten} `);
}

/** P43d: Setext-Fassung des Titels (Titeltext, darunter `---` bzw. `===`). */
function titelSetext(unterstrich: string): string {
  return `${PROTOKOLL_TITEL.replace('## ', '')}\n${unterstrich}`;
}

/** P43d: Umformungen, die ohne gültigen bzw. eindeutigen `##`-Titel enden (TR-H0-75). */
export const TITEL_EBENEN: Array<[string, (text: string) => string]> = [
  ['einziger Titel als ### (Angriff A5)', (t) => t.replace(PROTOKOLL_TITEL, TITEL_H3)],
  ['##-Titel plus gleichlautender ###-Titel', (t) => `${t}\n${TITEL_H3}\n\nText.\n`],
  ['einziger Titel als #', (t) => t.replace(PROTOKOLL_TITEL, titelEbene('#'))],
  ['einziger Titel als ####', (t) => t.replace(PROTOKOLL_TITEL, titelEbene('####'))],
  ['einziger Titel als ######', (t) => t.replace(PROTOKOLL_TITEL, titelEbene('######'))],
  ['##-Titel plus gleichlautender #-Titel', (t) => `${t}\n${titelEbene('#')}\n\nText.\n`],
  ['##-Titel plus gleichlautender ####-Titel', (t) => `${t}\n${titelEbene('####')}\n\nText.\n`],
  ['einziger Titel als Setext ---', (t) => t.replace(PROTOKOLL_TITEL, titelSetext('---'))],
  ['einziger Titel als Setext ===', (t) => t.replace(PROTOKOLL_TITEL, titelSetext('==='))],
];

/** P43f: Titelzeile mit Einrückung (Leerzeichen bzw. Tabulator, zur Laufzeit gebildet). */
export function titelEingerueckt(einrueckung: string): (t: string) => string {
  return (t) => t.replace(PROTOKOLL_TITEL, `${einrueckung}${PROTOKOLL_TITEL}`);
}

/** P43f: Einrückungen, mit denen die Zeile keine Überschrift mehr ist (≥ 4 Leerzeichen, Tabulator). */
export const EINRUECKUNG_KEIN_TITEL: Array<[string, string]> = [
  ['4 Leerzeichen', '    '],
  ['Tabulator', String.fromCharCode(9)],
];

/** P43g: gültiges Protokoll, danach ein Abschnitt mit sehr langen ATX-Zeilen voller Leerzeichen. */
export function langeLeerraumZeilen(anzahl: number, laenge: number): string {
  const zeilen = Array.from({ length: anzahl }, () => `## a${' '.repeat(laenge)}b`);
  return `\n## Danach\n\n${zeilen.join('\n')}\n`;
}

/** P43g (TR-H0-86): ATX-Zeile mit Titeltext, danach sehr viele Leerzeichen, im Abschnitt «## Danach». */
export function langeTitelZeile(laenge: number): string {
  return `\n## Danach\n\n${PROTOKOLL_TITEL} x${' '.repeat(laenge)}b\n`;
}

/** P43f (TR-H0-85 a): eingerückte gleichlautende `###`-Zeile ist keine Überschrift. */
export function eingerueckterH3Titel(einrueckung: string): string {
  return `\n${einrueckung}${TITEL_H3}\n`;
}

/** P43f (TR-H0-85 b): Zeile «## Weiteres» (optional eingerückt), danach eine `|`-Zeile. */
export function weiteresMitTabelle(einrueckung: string, rauten = '##'): string {
  return `\n${einrueckung}${rauten} Weiteres\n| a | b |\n`;
}

/** P43f (TR-H0-91 a): Überschriften mit 1–3 Leerzeichen Einrückung beenden den Abschnitt. */
export const UEBERSCHRIFT_EINGERUECKT_GUELTIG: Array<[string, string, string]> = [
  ['«## Weiteres» mit 1 Leerzeichen', ' ', '##'],
  ['«## Weiteres» mit 3 Leerzeichen', '   ', '##'],
  ['«# Weiteres» mit 3 Leerzeichen', '   ', '#'],
];

/** P42b (a) präzisiert (K6): `###`-Titel mit eigenem Block vor dem massgebenden `##`-Titel. */
export const H3_BLOCK_VOR_TITEL = `${TITEL_H3}\n\n${PROTOKOLL_KOPF}\n${PROTOKOLL_TRENN}\n${protokollZeile(['tests/drei.test.ts'], 'Aufnahme')}\n\n`;

/** TR-H0-96: eingerückter Schein-`##`-Titel (keine Überschrift, P43f) mit eigenem Block vor dem Titel. */
export function scheinblockVorTitel(einrueckung: string): string {
  return `${einrueckung}${PROTOKOLL_TITEL}\n\n${PROTOKOLL_KOPF}\n${PROTOKOLL_TRENN}\n${protokollZeile(['tests/schein.test.ts'], 'Aufnahme')}\n\n`;
}

/** P43e: FINDINGS.md mit sehr vielen Titelzeilen (zur Laufzeit erzeugt, ca. 3 MB). */
export function vieleTitel(anzahl: number): string {
  const block = [
    PROTOKOLL_TITEL,
    '',
    PROTOKOLL_KOPF,
    PROTOKOLL_TRENN,
    '| a | b | c | d | e |',
    'Fülltext '.repeat(20),
  ].join('\n');
  return ['# WAP-Planer – Befundregister', '', ...Array.from({ length: anzahl }, () => block)].join(
    '\n',
  );
}

/** P42/P42a: Verstösse im Vergleichsstand (TR-H0-62 a). */
export const VERGLEICHSSTAND_VERSTOESSE: Array<[string, string, boolean]> = [
  // [Bezeichnung, angehängter Text, Hinweis enthält die P37-Meldung]
  ['zweite Tabelle (P37)', ZWEITE_TABELLE, true],
  ['HTML-Kommentar im Abschnitt (P38)', '\n<!-- Notiz -->\n', false],
  ['doppelte Titelzeile (P38)', `\n${PROTOKOLL_TITEL}\n\nLeer.\n`, false],
];

/** Wendet eine Umformung auf FINDINGS.md an. */
export function umformenFindings(root: string, f: (text: string) => string): void {
  writeText(root, FINDINGS_PATH, f(readText(root, FINDINGS_PATH)));
}

/** Zeilennummer (ab 1) der ersten Zeile in FINDINGS.md, die genau `zeile` lautet. */
export function zeilenNr(root: string, zeile: string): number {
  const i = readText(root, FINDINGS_PATH).split(/\r?\n/).indexOf(zeile);
  if (i < 0) throw new Error('Test-Aufbau: Zeile in FINDINGS.md fehlt');
  return i + 1;
}

/**
 * P37: Meldung «Zeile ausserhalb der Protokoll-Tabelle» mit Zeilennummer (Zeile der Ausgabe mit der
 * Meldung; Nummer nicht Teil einer Zahl, eines Worts oder Datums).
 */
export function expectAusserhalbMeldung(out: string, nr: number): void {
  const zeile = out
    .split(/\r?\n/)
    .find((l) => l.includes('Zeile ausserhalb der Protokoll-Tabelle'));
  expect(zeile, 'Meldung «Zeile ausserhalb der Protokoll-Tabelle» fehlt').toBeDefined();
  expect(zeile).toMatch(new RegExp(`(?<![0-9A-Za-z.])${nr}(?![0-9A-Za-z.])`));
}

/** Fügt eine Zeile direkt nach der Trennzeile der Befund-Tabelle ein (falsche Tabelle, P14). */
export function insertInBefundTabelle(root: string, zeile: string): void {
  const lines = readText(root, FINDINGS_PATH).split('\n');
  const i = lines.indexOf(BEFUND_TRENNZEILE);
  if (i < 0) throw new Error('Test-Aufbau: Befund-Tabelle fehlt');
  lines.splice(i + 1, 0, zeile);
  writeText(root, FINDINGS_PATH, lines.join('\n'));
}

export interface Sandbox {
  base: string;
  env: NodeJS.ProcessEnv;
  /** Verzeichnis mit der Standard-Sperrliste (über WAP_REFERENCE_DIR). */
  referenceDir: string;
}

export interface RunResult {
  status: number | null;
  stdout: string;
  stderr: string;
  out: string;
}

const sandboxes: string[] = [];

export function createSandbox(): Sandbox {
  const base = realpathSync.native(mkdtempSync(join(tmpdir(), 'wap-harness-')));
  sandboxes.push(base);
  const emptyConfig = join(base, 'leer.gitconfig');
  writeFileSync(emptyConfig, '');
  const referenceDir = join(base, 'extern-referenz');
  mkdirSync(referenceDir);
  writeFileSync(
    join(referenceDir, SPERRLISTE),
    ['# Fiktive Sperrliste für Tests', '', ...GESPERRTE_NAMEN, ''].join('\n'),
  );
  const env: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (key.toUpperCase().startsWith('GIT_')) continue;
    if (key.toUpperCase() === 'WAP_REFERENCE_DIR') continue;
    env[key] = value;
  }
  env.GIT_CONFIG_NOSYSTEM = '1';
  env.GIT_CONFIG_GLOBAL = emptyConfig;
  env.WAP_REFERENCE_DIR = referenceDir;
  return { base, env, referenceDir };
}

export function cleanupSandboxes(): void {
  while (sandboxes.length > 0) {
    const dir = sandboxes.pop();
    if (dir) rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

export function git(sb: Sandbox, cwd: string, ...args: string[]): string {
  const r = spawnSync('git', args, { cwd, env: sb.env, encoding: 'utf8', timeout: CHILD_TIMEOUT });
  if (r.status !== 0) {
    throw new Error(`Test-Aufbau: git ${args.join(' ')} scheiterte: ${r.stderr}`);
  }
  return r.stdout.trim();
}

export function gitRaw(sb: Sandbox, cwd: string, ...args: string[]): RunResult {
  const r = spawnSync('git', args, { cwd, env: sb.env, encoding: 'utf8', timeout: CHILD_TIMEOUT });
  expect(r.status, `git ${args[0]} ohne Exit-Code (Zeitlimit oder Signal)`).not.toBeNull();
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: r.stdout + r.stderr };
}

export function writeText(root: string, rel: string, content: string | Buffer): string {
  const file = join(root, ...rel.split('/'));
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
  return file;
}

export function readText(root: string, rel: string): string {
  return readFileSync(join(root, ...rel.split('/')), 'utf8');
}

export function readBytes(root: string, rel: string): Buffer {
  return readFileSync(join(root, ...rel.split('/')));
}

/**
 * SHA-256 laut Vertrag (Klausel 1, P1): über die Rohbytes; einzige Normalisierung auf Byte-Ebene
 * 0x0D 0x0A -> 0x0A; keine Textdekodierung. Ergebnis hex klein.
 */
export function sha256Lf(content: string | Buffer): string {
  const bytes = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  const out: number[] = [];
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === 0x0d && bytes[i + 1] === 0x0a) continue;
    out.push(bytes[i]);
  }
  return createHash('sha256').update(Buffer.from(out)).digest('hex');
}

/** Schreibt test-lock.json im Vertragsformat mit sortierten Einträgen. */
export function writeLock(root: string, files: Record<string, string>): void {
  const sorted: Record<string, string> = {};
  for (const key of Object.keys(files).sort()) sorted[key] = files[key];
  writeText(root, LOCK_PATH, `${JSON.stringify({ version: 1, files: sorted }, null, 2)}\n`);
}

/** Legt Dateien an und sperrt sie mit dem Hash ihres Inhalts. */
export function lockFiles(root: string, files: Record<string, string | Buffer>): void {
  const hashes: Record<string, string> = {};
  for (const [rel, content] of Object.entries(files)) {
    writeText(root, rel, content);
    hashes[rel] = sha256Lf(content);
  }
  writeLock(root, hashes);
}

export function readLock(root: string): { version: number; files: Record<string, string> } {
  return JSON.parse(readText(root, LOCK_PATH));
}

export function installScripts(root: string): void {
  if (existsSync(SCRIPT_SOURCE)) {
    cpSync(SCRIPT_SOURCE, join(root, 'scripts', 'wap'), { recursive: true });
  }
  // Leere, versionierte Positivliste im Temp-Repo (Tests setzen sie bei Bedarf selbst).
  writeText(root, 'scripts/wap/privacy-allow.txt', '');
}

export interface RepoOptions {
  branch?: string;
  scripts?: boolean;
}

/** Frisches Git-Repo mit einem ersten Commit (README, FINDINGS) und kopierten Skripten. */
export function initRepo(sb: Sandbox, name: string, options: RepoOptions = {}): string {
  const root = join(sb.base, name);
  mkdirSync(root, { recursive: true });
  git(sb, root, 'init', '-q', '-b', options.branch ?? 'wap-planer');
  git(sb, root, 'config', 'user.name', TEST_USER);
  git(sb, root, 'config', 'user.email', TEST_MAIL);
  git(sb, root, 'config', 'core.autocrlf', 'false');
  git(sb, root, 'config', 'core.quotePath', 'true');
  git(sb, root, 'config', 'commit.gpgsign', 'false');
  writeText(root, 'README.md', '# Testrepo\n');
  writeText(root, FINDINGS_PATH, FINDINGS_TEMPLATE);
  git(sb, root, 'add', 'README.md', FINDINGS_PATH);
  git(sb, root, 'commit', '-q', '-m', 'Start');
  if (options.scripts ?? true) installScripts(root);
  return root;
}

/** Legt einen Worktree an (neuer Zweig) und gibt seinen Pfad zurück. */
export function addWorktree(sb: Sandbox, root: string, path: string, branch: string): string {
  mkdirSync(dirname(path), { recursive: true });
  git(sb, root, 'worktree', 'add', '-q', '-b', branch, path);
  return realpathSync.native(path);
}

/**
 * Ruft ein Harness-Skript als Prozess auf. Fehlt das Skript, scheitert der Test mit einem
 * Assertion-Fehler (Rot-Nachweis), nicht mit einem Import-Fehler.
 */
export function runScript(
  sb: Sandbox,
  scriptRoot: string,
  name: string,
  args: string[],
  options: { cwd?: string; input?: string; env?: NodeJS.ProcessEnv } = {},
): RunResult {
  const script = join(scriptRoot, 'scripts', 'wap', name);
  expect(existsSync(script), `Skript fehlt: scripts/wap/${name}`).toBe(true);
  const r = spawnSync(process.execPath, [script, ...args], {
    cwd: options.cwd ?? scriptRoot,
    env: options.env ?? sb.env,
    input: options.input ?? '',
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT,
  });
  expect(r.status, `scripts/wap/${name} ohne Exit-Code (Zeitlimit oder Signal)`).not.toBeNull();
  return { status: r.status, stdout: r.stdout, stderr: r.stderr, out: r.stdout + r.stderr };
}

/** Entfernt den zufälligen Sandbox-Pfad aus einer Ausgabe (für Ziffernprüfungen). */
export function withoutSandboxPath(sb: Sandbox, text: string): string {
  return text.split(sb.base).join('').split(sb.base.replace(/\\/g, '/')).join('');
}

/**
 * Ermittelt den 8.3-Kurznamen eines Eintrags per `cmd /c dir /x` (Windows). Sind 8.3-Namen auf dem
 * Temp-Laufwerk inaktiv, scheitert der Aufrufer mit klarer Assertion-Meldung (kein Überspringen).
 */
export function shortName(dir: string, longName: string): string {
  const r = spawnSync('cmd', ['/c', 'dir', '/x', dir], {
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT,
  });
  expect(r.status, `cmd /c dir /x ${dir} scheiterte`).toBe(0);
  const line = r.stdout.split(/\r?\n/).find((l) => l.endsWith(` ${longName}`)) ?? '';
  const m = /(\S+~\d+(?:\.\S+)?)$/.exec(line.slice(0, -longName.length).trimEnd());
  expect(
    m,
    `Kein 8.3-Kurzname für ${longName}: 8.3-Namen sind auf dem Laufwerk von os.tmpdir() inaktiv (fsutil 8dot3name query)`,
  ).not.toBeNull();
  return (m as RegExpExecArray)[1];
}

/** Legt eine Verzeichnis-Junction an (Windows, ohne Administratorrechte). */
export function junction(link: string, target: string): void {
  mkdirSync(dirname(link), { recursive: true });
  const r = spawnSync('cmd', ['/c', 'mklink', '/J', link, target], {
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT,
  });
  if (r.status !== 0) throw new Error(`Test-Aufbau: mklink /J scheiterte: ${r.stdout}${r.stderr}`);
}

/** Alle Dateien unterhalb von root (ohne .git), als relative Pfade mit /. */
export function listFiles(root: string, rel = ''): string[] {
  const dir = rel === '' ? root : join(root, ...rel.split('/'));
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const child = rel === '' ? e.name : `${rel}/${e.name}`;
    if (e.name === '.git') return [];
    return e.isDirectory() ? listFiles(root, child) : [child];
  });
}

export function today(date = new Date()): string {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${date.getFullYear()}`;
}
