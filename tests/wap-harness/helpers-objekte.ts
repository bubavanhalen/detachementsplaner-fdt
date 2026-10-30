// Hilfen für die Harness-Tests nach Eskalation 1 (Paket H0, P44, P45, P47, P39h).
// Ergänzt helpers.ts (eingefroren); dieselben Regeln: frische temporäre Repos, Skripte nur als Prozess,
// verbotene Muster zur Laufzeit zusammengesetzt, nur fiktive Daten.
import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import {
  CHILD_TIMEOUT,
  createSandbox,
  git,
  type RunResult,
  runScript,
  type Sandbox,
  withoutSandboxPath,
  writeText,
} from './helpers';

export const j = (...parts: string[]): string => parts.join('');

/** Fiktive Treffer, zur Laufzeit gebildet. */
export const TELEFON = j('07', '9 483 26 15');
export const AHV = j('75', '6.4821.9036.57');
export const MAIL = j('vorname.nachname', '@', 'beispiel.invalid');

/** Platzhalter für Testnamen; die Nummer entsteht erst im Testkörper (TR-H0-98). */
export const PLATZHALTER = '<Tel>';
export function mitTelefon(text: string): string {
  return text.split(PLATZHALTER).join(TELEFON);
}

/** Feste Commit-Zeitstempel: Commit-Hashes und damit Kürzel in der Ausgabe sind reproduzierbar (TR-H0-103). */
export const FESTES_DATUM = '2026-01-15T12:00:00+01:00';

/**
 * Sandbox wie `createSandbox` (helpers.ts), zusätzlich mit festen GIT_AUTHOR_DATE und
 * GIT_COMMITTER_DATE für alle Commits, die die Tests selbst erzeugen (TR-H0-103).
 */
export function sandbox(): Sandbox {
  const sb = createSandbox();
  sb.env.GIT_AUTHOR_DATE = FESTES_DATUM;
  sb.env.GIT_COMMITTER_DATE = FESTES_DATUM;
  return sb;
}

/**
 * Entfernt Commit-Kürzel (Hex-Folgen ab 4 Zeichen, die Präfix eines Commits der genannten Repos sind)
 * aus einer Ausgabe; nur diese, nicht pauschal jede Hex-Folge (TR-H0-103).
 */
function ohneCommitKuerzel(sb: Sandbox, out: string, repos: string[]): string {
  if (repos.length === 0) return out;
  const hashes = repos.flatMap((root) =>
    git(sb, root, 'rev-list', '--all', '--reflog')
      .split('\n')
      .filter((h) => h !== ''),
  );
  return out.replace(/(?<![0-9a-f])[0-9a-f]{4,40}(?![0-9a-f])/g, (tok) =>
    hashes.some((h) => h.startsWith(tok)) ? '' : tok,
  );
}

/**
 * P8: Treffer erscheinen nie im Klartext. Bei Nummern darf keine Zifferngruppe ab 3 Stellen aus dem
 * Treffer ausser den Präfixen 756, +41, 0041, 0 in der Ausgabe stehen. Mit `repos` werden vorher die
 * Commit-Kürzel dieser Repos entfernt (Ausgabe von --commits, P44 e).
 */
export function expectMasked(
  sb: Sandbox,
  r: RunResult,
  secret: string,
  repos: string[] = [],
): void {
  const out = ohneCommitKuerzel(sb, withoutSandboxPath(sb, r.out), repos);
  expect(out.toLowerCase()).not.toContain(secret.toLowerCase());
  const digits = secret.replace(/\D/g, '');
  if (digits.length < 9) return;
  let rest = digits;
  if (secret.startsWith('+41')) rest = digits.slice(2);
  else if (digits.startsWith('0041')) rest = digits.slice(4);
  else if (digits.startsWith('756')) rest = digits.slice(3);
  else if (digits.startsWith('0')) rest = digits.slice(1);
  for (let i = 0; i + 3 <= rest.length; i++) {
    expect(
      out,
      `Zifferngruppe ${rest.slice(i, i + 3)} steht unmaskiert in der Ausgabe`,
    ).not.toContain(rest.slice(i, i + 3));
  }
}

/** git mit Eingabe auf stdin (z.B. hash-object --stdin); scheitert der Aufruf, ist der Test-Aufbau defekt. */
export function gitMitEingabe(sb: Sandbox, cwd: string, input: string, ...args: string[]): string {
  const r = spawnSync('git', args, {
    cwd,
    env: sb.env,
    input,
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT,
  });
  if (r.status !== 0) {
    throw new Error(`Test-Aufbau: git ${args.join(' ')} scheiterte: ${r.stderr}`);
  }
  return r.stdout.trim();
}

/** Schreibt einen Blob in die Objektdatenbank und gibt seine ID zurück. */
export function blobAus(sb: Sandbox, root: string, text: string): string {
  return gitMitEingabe(sb, root, text, 'hash-object', '-w', '--stdin');
}

/**
 * Schreibt Dateien, versioniert sie (auch unter ignorierten Pfaden) und committet ohne Hooks.
 * Gibt den vollen Commit-Hash zurück.
 */
export function commitDateien(
  sb: Sandbox,
  root: string,
  files: Record<string, string | Buffer>,
  msg = 'Stand',
): string {
  for (const [rel, content] of Object.entries(files)) writeText(root, rel, content);
  git(sb, root, 'add', '-f', '--', ...Object.keys(files));
  git(sb, root, 'commit', '-q', '--no-verify', '-m', msg);
  return git(sb, root, 'rev-parse', 'HEAD');
}

/** Entfernt Dateien nur vom Datenträger; der versionierte Stand bleibt (P44 a: nur Objekte zählen). */
export function nurImObjekt(root: string, ...rels: string[]): void {
  for (const rel of rels) rmSync(join(root, ...rel.split('/')), { force: true, recursive: true });
}

/** Ruft privacy-scan.mjs aus dem Checkout `scriptRoot` auf (Standard: cwd = scriptRoot). */
export function scanObjekte(
  sb: Sandbox,
  scriptRoot: string,
  args: string[],
  options: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): RunResult {
  return runScript(sb, scriptRoot, 'privacy-scan.mjs', args, {
    cwd: options.cwd ?? scriptRoot,
    env: options.env,
  });
}

function escapeRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ausgabezeilen mit einem Befund `<pfad>:<zeile>:` (P44 e), ohne vorangestelltes Commit-Kürzel. */
export function befundZeilen(out: string, pfad: string, zeile: number): string[] {
  const re = new RegExp(`(?<![0-9a-f]:)(?<![\\w/.-])${escapeRe(pfad)}:${zeile}:`);
  return out.split(/\r?\n/).filter((l) => re.test(l));
}

/** P44 (e) bei --baum: genau eine Zeile `<pfad>:<zeile>: <art>`, Art passend. */
export function expectBefund(r: RunResult, pfad: string, zeile: number, art: RegExp): void {
  const zeilen = befundZeilen(r.out, pfad, zeile);
  expect(zeilen, `Befundzeile «${pfad}:${zeile}: …» fehlt oder ist mehrfach`).toHaveLength(1);
  expect(zeilen[0]).toMatch(art);
}

/** Ausgabezeilen mit einem Befund `<commit kurz>:<pfad>:<zeile>:` (P44 e, --commits). */
export function commitBefundZeilen(
  out: string,
  pfad: string,
  zeile: number,
): Array<{ kurz: string; zeile: string }> {
  const re = new RegExp(`(?<![0-9a-f])([0-9a-f]{4,40}):${escapeRe(pfad)}:${zeile}:`);
  const treffer: Array<{ kurz: string; zeile: string }> = [];
  for (const l of out.split(/\r?\n/)) {
    const m = re.exec(l);
    if (m) treffer.push({ kurz: m[1], zeile: l });
  }
  return treffer;
}

/**
 * P44 (e) bei --commits: genau eine Zeile `<commit kurz>:<pfad>:<zeile>: <art>`; das Kürzel ist ein
 * echter Präfix des erwarteten Commits.
 */
export function expectCommitBefund(
  r: RunResult,
  commit: string,
  pfad: string,
  zeile: number,
  art: RegExp,
): void {
  const zeilen = commitBefundZeilen(r.out, pfad, zeile);
  expect(zeilen, `Befundzeile «<commit>:${pfad}:${zeile}: …» fehlt oder ist mehrfach`).toHaveLength(
    1,
  );
  expect(zeilen[0].zeile).toMatch(art);
  expect(zeilen[0].kurz.length).toBeLessThan(40);
  expect(
    commit.startsWith(zeilen[0].kurz),
    'Commit-Kürzel gehört nicht zum erwarteten Commit',
  ).toBe(true);
}

export const ART_TELEFON = /Telefon/i;
export const ART_AHV = /AHV/i;
export const ART_MAIL = /Mail/i;
export const ART_NAME = /Name|Sperrliste/i;

/** Absolute git-common-dir eines Repos. */
export function commonDir(sb: Sandbox, root: string): string {
  return git(sb, root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
}

/** file://-URL eines lokalen Repos (für flache Klone). */
export function fileUrl(root: string): string {
  return `file:///${root.split(String.fromCharCode(92)).join('/')}`;
}
