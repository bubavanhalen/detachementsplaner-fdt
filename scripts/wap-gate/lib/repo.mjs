// Repo-Hilfen der Schleusen-Skripte (Paket E1-01, ADR-010): git-Aufrufe, Dateilisten, Pfadmuster,
// Paket-Checklisten. Nur Node-Standardbibliothek und git; Pfade repo-relativ mit «/».
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';

/**
 * Umgebung für git im untersuchten Repo: ohne GIT_*-Variablen des Aufrufers (Vertrag §1, §9 Nr 16);
 * mit `mitIndex` bleibt GIT_INDEX_FILE erhalten (gestagter Stand eines laufenden Commits, F0/F3).
 * @param {{ mitIndex?: boolean }} [optionen]
 * @returns {Record<string, string>}
 */
export function gitUmgebung(optionen = {}) {
  /** @type {Record<string, string>} */
  const env = {};
  for (const [key, wert] of Object.entries(process.env)) {
    if (wert === undefined) continue;
    const k = key.toUpperCase();
    if (k.startsWith('GIT_') && !(optionen.mitIndex && k === 'GIT_INDEX_FILE')) continue;
    env[key] = wert;
  }
  env.GIT_NO_REPLACE_OBJECTS = '1';
  return env;
}

/**
 * Führt git synchron aus; wirft nie.
 * @param {string} cwd
 * @param {string[]} args
 * @param {{ mitIndex?: boolean; input?: string }} [optionen]
 * @returns {{ status: number | null; stdout: string; stderr: string; raw: Buffer }}
 */
export function git(cwd, args, optionen = {}) {
  const r = spawnSync('git', args, {
    cwd,
    env: gitUmgebung(optionen),
    input: optionen.input,
    encoding: 'buffer',
    maxBuffer: 1024 * 1024 * 1024,
    windowsHide: true,
  });
  const raw = r.stdout ?? Buffer.alloc(0);
  return {
    status: r.error ? null : r.status,
    stdout: raw.toString('utf8'),
    stderr: (r.stderr ?? Buffer.alloc(0)).toString('utf8'),
    raw,
  };
}

/**
 * Worktree-Wurzel eines Ordners (nativ aufgelöst) oder null.
 * @param {string} dir
 * @returns {string | null}
 */
export function wurzel(dir) {
  const r = git(dir, ['rev-parse', '--show-toplevel']);
  if (r.status !== 0 || r.stdout.trim() === '') return null;
  return resolve(r.stdout.trim());
}

/**
 * Gemeinsames Git-Verzeichnis (absolut) eines Ordners oder null.
 * @param {string} dir
 * @returns {string | null}
 */
export function gemeinsamesGitVerzeichnis(dir) {
  const r = git(dir, ['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (r.status !== 0 || r.stdout.trim() === '') return null;
  return resolve(r.stdout.trim());
}

/**
 * Aktueller Zweig (leer bei losgelöstem HEAD).
 * @param {string} root
 * @returns {string}
 */
export function zweigVon(root) {
  const r = git(root, ['symbolic-ref', '--short', '-q', 'HEAD']);
  return r.status === 0 ? r.stdout.trim() : '';
}

/**
 * Commit-ID eines Refs oder null.
 * @param {string} root
 * @param {string} ref
 * @returns {string | null}
 */
export function commitVon(root, ref) {
  const r = git(root, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
  const id = r.stdout.trim();
  return r.status === 0 && /^[0-9a-f]{40,64}$/.test(id) ? id : null;
}

/**
 * Merge-Basis zweier Refs oder null.
 * @param {string} root
 * @param {string} a
 * @param {string} b
 * @returns {string | null}
 */
export function mergeBasis(root, a, b) {
  if (commitVon(root, a) === null || commitVon(root, b) === null) return null;
  const r = git(root, ['merge-base', a, b]);
  const id = r.stdout.trim();
  return r.status === 0 && /^[0-9a-f]{40,64}$/.test(id) ? id : null;
}

/**
 * Versionierte und nicht ignorierte Dateien des Arbeitsbaums (repo-relativ, «/»), nur vorhandene.
 * @param {string} root
 * @returns {string[] | null} null, wenn git scheitert
 */
export function arbeitsbaumDateien(root) {
  const r = git(root, ['ls-files', '-z', '-c', '-o', '--exclude-standard']);
  if (r.status !== 0) return null;
  const pfade = new Set(r.stdout.split('\0').filter((p) => p !== ''));
  return [...pfade].filter((p) => existsSync(join(root, ...p.split('/')))).sort();
}

/**
 * Repo-relativer Pfad mit «/».
 * @param {string} root
 * @param {string} abs
 * @returns {string}
 */
export function relPfad(root, abs) {
  return relative(root, abs).split(sep).join('/');
}

/**
 * Übersetzt ein Pfadmuster («**» = beliebig viele Ordner, «*» = Zeichen innerhalb eines Segments)
 * in einen wurzelverankerten regulären Ausdruck (ohne Beachtung von Gross/Klein).
 * @param {string} muster
 * @returns {RegExp}
 */
export function musterRegex(muster) {
  const segmente = muster.split('/');
  let quelle = '^';
  segmente.forEach((seg, i) => {
    const letztes = i === segmente.length - 1;
    if (seg === '**') {
      quelle += letztes ? '.+' : '(?:[^/]+/)*';
      return;
    }
    quelle += seg
      .split('*')
      .map((teil) => teil.replace(/[.+?^${}()|[\]\\]/g, '\\$&'))
      .join('[^/]*');
    if (!letztes) quelle += '/';
  });
  return new RegExp(`${quelle}$`, 'i');
}

/**
 * Trifft ein Pfad eines der Muster?
 * @param {string} rel
 * @param {string[]} muster
 * @returns {boolean}
 */
export function passt(rel, muster) {
  return muster.some((m) => musterRegex(m).test(rel));
}

/** WAP-Pfadmenge (ADR-010 §4.2). */
export const WAP_PFADMENGE = [
  'src/model/wap/**',
  'src/io/wap-plan/**',
  'src/io/wap-pdf/**',
  'src/io/wap-import/**',
  'src/io/wap-persons/**',
  'src/io/xlsx-drawing/**',
  'src/components/wap/**',
  'src/pages/WapPage.tsx',
  'src/assets/wap-fonts/**',
  'tests/wap/**',
  'tests/wap-e2e/**',
  'tests/wap-perf/**',
  'tests/wap-gate/**',
];

/** Skripte der Werkzeugkette (F-003): Teil des Geltungsbereichs von F4 und F5. */
export const WAP_SKRIPTE = ['scripts/wap/**', 'scripts/wap-gate/**', 'tools/wap/**'];

/**
 * Eigene Dateien des WAP-Planers ausserhalb der Suite (für die Suite-Grenze F7, R-H-30): WAP-Pfadmenge,
 * Skripte, Dokumente, Harness-Tests und WAP-Konfigurationen.
 */
export const WAP_EIGENE = [
  ...WAP_PFADMENGE,
  ...WAP_SKRIPTE,
  'docs/wap-planer/**',
  'tests/wap-harness/**',
  'vitest.wap*.config.ts',
  'playwright.wap.config.ts',
  'stryker.wap.conf.mjs',
  'tsconfig.wap.json',
];

/**
 * @typedef {object} Paket
 * @property {string} name Dateiname ohne .md (z.B. «E1-01»)
 * @property {string} datei repo-relativ
 * @property {number | null} etappe
 * @property {string | null} anforderungen Rohtext der Zeile «- Anforderungen: …»
 * @property {boolean} eingefroren Kästchen 6 angekreuzt
 * @property {boolean} freezeEntfaellt Kästchen 6 mit «entfällt» (kein Test-Freeze)
 * @property {boolean} umgesetzt Kästchen 7 angekreuzt
 */

/**
 * Liest die Paket-Checklisten unter docs/wap-planer/pakete/ (ohne _vorlage.md).
 * @param {string} root
 * @returns {Paket[]}
 */
export function pakete(root) {
  const dir = join(root, 'docs', 'wap-planer', 'pakete');
  if (!existsSync(dir)) return [];
  /** @type {Paket[]} */
  const out = [];
  for (const datei of readdirSync(dir).sort()) {
    if (!datei.toLowerCase().endsWith('.md') || datei.startsWith('_')) continue;
    const text = readFileSync(join(dir, datei), 'utf8');
    const zeilen = text.split(/\r?\n/);
    const etappe = zeilen.map((z) => /^- Etappe:\s*(\d+)/.exec(z)).find((m) => m !== null);
    const anf = zeilen.map((z) => /^- Anforderungen:\s*(.*)$/.exec(z)).find((m) => m !== null);
    const kaestchen = (/** @type {number} */ n) =>
      zeilen.find((z) => new RegExp(`^- \\[[ xX]\\] ${String(n)}(?![0-9])`).test(z)) ?? '';
    const k6 = kaestchen(6);
    const k7 = kaestchen(7);
    out.push({
      name: datei.slice(0, -3),
      datei: `docs/wap-planer/pakete/${datei}`,
      etappe: etappe?.[1] === undefined ? null : Number(etappe[1]),
      anforderungen: anf?.[1] ?? null,
      eingefroren: /^- \[[xX]\]/.test(k6),
      freezeEntfaellt: /^- \[[xX]\]/.test(k6) && /entfällt/i.test(k6),
      umgesetzt: /^- \[[xX]\]/.test(k7),
    });
  }
  return out;
}
