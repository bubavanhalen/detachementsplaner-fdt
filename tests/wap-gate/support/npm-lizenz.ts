// Typen, Lader und Hilfen der Schleusen-Tests zur Änderungsnotiz «Lizenzen ohne LICENSE-Datei» (E1-01b,
// 05.10.2026; R-H-11; Grundlage R-H-23, E1-01e): gemeinsames Modul tools/wap/npm-lizenz.mjs (npmLizenz) und Ersatzliste
// tools/wap/licenses/npm-ersatz.json. Nur fiktive Pakete, fiktive Lizenztexte und fiktive Mini-Repos.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md, «Änderungsnotiz Lizenzen ohne LICENSE-Datei» Nr 2–4, 10.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { expect } from 'vitest';
import { WT, writeText } from './umgebung';

/** Rückgabe von npmLizenz (Notiz Nr 2). */
export type NpmLizenzErgebnis =
  | { ok: true; quelle: 'paket' | 'ersatz'; datei: string; text: string }
  | { ok: false; art: 'fehlt' | 'ersatz' | 'liste'; fehler: string };

/** tools/wap/npm-lizenz.mjs (Notiz Nr 2). */
export interface NpmLizenzModul {
  npmLizenz(opts: { cwd: string; paket: string; ordner: string }): NpmLizenzErgebnis;
}

/** Repo-relativer Pfad des Moduls im Paket-Worktree. */
export const NPM_LIZENZ_MODUL = 'tools/wap/npm-lizenz.mjs';

/** Repo-relativer Pfad der Ersatzliste (Notiz Nr 3 b). */
export const ERSATZ_LISTE = 'tools/wap/licenses/npm-ersatz.json';

/** Meldung bei ungültiger Liste (Notiz Nr 4). */
export const LISTE_UNGUELTIG = `Ersatz-Lizenzliste ungültig: ${ERSATZ_LISTE}`;

/** Ergänzung des nächsten Schritts von buildEinzeldatei (Notiz Nr 5). */
export const NAECHSTER_SCHRITT_ERSATZ =
  'npm-Paket ohne LICENSE*: Eintrag in tools/wap/licenses/npm-ersatz.json nur mit Entscheid';

/** Inhaltsmarke der fiktiven Lizenztexte; darf in keiner Meldung erscheinen (E10). */
export const INHALTSMARKE = 'Inhaltsmarke-Qx7Zw';

/** Fiktiver Herkunftsvermerk der Testeinträge (bewusst nicht der Vermerk der echten Rückfalldateien). */
export const FIKTIVE_HERKUNFT = 'fiktiv rekonstruiert für Schleusen-Test';

/** Fiktiver Entscheid der Testeinträge. */
export const FIKTIVER_ENTSCHEID = 'fiktiver Entscheid Schleusen-Test';

/**
 * Lädt das Modul aus dem Paket-Worktree. Rot-Nachweis an einer Assertion: zuerst existsSync, dann typeof
 * der Funktion (kein Importfehler, Notiz Nr 10).
 */
export async function npmLizenzModul(): Promise<NpmLizenzModul> {
  const datei = join(WT, ...NPM_LIZENZ_MODUL.split('/'));
  expect(existsSync(datei), `Modul des Pakets fehlt: ${NPM_LIZENZ_MODUL}`).toBe(true);
  const m = (await import(pathToFileURL(datei).href)) as Partial<NpmLizenzModul>;
  expect(typeof m.npmLizenz, 'npmLizenz ist keine Funktion').toBe('function');
  return m as NpmLizenzModul;
}

/** Eintrag der Ersatzliste (Notiz Nr 3 b). */
export interface ErsatzEintrag {
  paket: string;
  version: string;
  lizenz: string;
  datei: string;
  herkunft: string;
  entscheid: string;
}

/** Gültiger Eintrag für ein fiktives Paket; Datei tools/wap/licenses/<paket>.txt. */
export function eintrag(paket: string, abweichung: Partial<ErsatzEintrag> = {}): ErsatzEintrag {
  return {
    paket,
    version: '1.0.0',
    lizenz: 'MIT',
    datei: `tools/wap/licenses/${paket}.txt`,
    herkunft: FIKTIVE_HERKUNFT,
    entscheid: FIKTIVER_ENTSCHEID,
    ...abweichung,
  };
}

/** Schreibt die Ersatzliste (Objekt als JSON oder Rohtext). */
export function schreibeListe(cwd: string, inhalt: unknown): void {
  const text = typeof inhalt === 'string' ? inhalt : `${JSON.stringify(inhalt, null, 2)}\n`;
  writeText(cwd, ERSATZ_LISTE, text);
}

/** Schreibt eine gültige Liste mit den Einträgen. */
export function schreibeEintraege(cwd: string, eintraege: ErsatzEintrag[]): void {
  schreibeListe(cwd, { version: 1, ersatz: eintraege });
}

/** Fiktiver Lizenztext mit Herkunftsvermerk (optional ohne) und Inhaltsmarke; LF, UTF-8 ohne BOM. */
export function fiktiverText(paket: string, herkunft: string | null = FIKTIVE_HERKUNFT): string {
  return [
    `${paket} 1.0.0: ${herkunft ?? 'ohne Vermerk'}`,
    '',
    'MIT License',
    '',
    `Fiktiver Lizenztext ${INHALTSMARKE} für das fiktive Paket ${paket}.`,
    '',
  ].join('\n');
}

/** Schreibt den Ersatztext an den repo-relativen Ort; gibt den absoluten Pfad zurück. */
export function schreibeText(cwd: string, rel: string, text: string): string {
  return writeText(cwd, rel, text);
}

/**
 * Fiktives npm-Paket unter <cwd>/node_modules/<name>: package.json (Felder frei wählbar), ein ESM-Einstieg
 * index.js, der eine Zeichenkette exportiert, und optional Lizenzdateien. Gibt den Paketordner zurück.
 */
export function fiktivesPaket(
  cwd: string,
  name: string,
  opts: {
    pkg?: Record<string, unknown> | undefined;
    ohneLicenseFeld?: boolean | undefined;
    lizenzDateien?: Record<string, string> | undefined;
    ohnePackageJson?: boolean;
    packageJsonRoh?: string;
  } = {},
): string {
  const ordner = join(cwd, 'node_modules', ...name.split('/'));
  mkdirSync(ordner, { recursive: true });
  const pkg: Record<string, unknown> = {
    name,
    version: '1.0.0',
    type: 'module',
    main: 'index.js',
    ...(opts.ohneLicenseFeld === true ? {} : { license: 'MIT' }),
    ...(opts.pkg ?? {}),
  };
  if (opts.packageJsonRoh !== undefined) {
    writeFileSync(join(ordner, 'package.json'), opts.packageJsonRoh);
  } else if (opts.ohnePackageJson !== true) {
    writeFileSync(join(ordner, 'package.json'), `${JSON.stringify(pkg, null, 2)}\n`);
  }
  const bezeichner = name.replace(/[^A-Za-z0-9]/g, '_');
  writeFileSync(join(ordner, 'index.js'), `export const ${bezeichner} = 'fiktiv ${name}';\n`);
  for (const [datei, text] of Object.entries(opts.lizenzDateien ?? {})) {
    mkdirSync(dirname(join(ordner, datei)), { recursive: true });
    writeFileSync(join(ordner, datei), text);
  }
  return ordner;
}

/** Name des von fiktivesPaket exportierten Bezeichners. */
export function exportName(name: string): string {
  return name.replace(/[^A-Za-z0-9]/g, '_');
}

/** Absoluter Pfad im Text: Laufwerksbuchstabe, UNC oder POSIX-Wurzel vor einem Pfadteil. */
export const ABSOLUTER_PFAD = /(?:^|[\s(«"'=:])(?:[A-Za-z]:[\\/]|\\\\|\/(?:Users|tmp|home|c)\/)/;

/** Text einer Datei des Paket-Worktrees (UTF-8). */
export function wtText(rel: string): string {
  return readFileSync(join(WT, ...rel.split('/')), 'utf8');
}
