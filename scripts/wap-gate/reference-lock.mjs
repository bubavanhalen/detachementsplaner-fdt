// Sperre der bestätigten Anhänge unter WAP_REFERENCE_DIR (bis H0-Ergänzung B; R-14-01, R-14-03;
// ADR-010 §7.1). Läuft in der Schleuse als Teil von F2 (Lock-Prüfung).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `checkReferenceLock`, §6 und Änderungsnotiz AE-001
// §4 Nr 9. Ausgaben nennen Dateien nur über zeigePfad; Inhalte werden nie ausgegeben (agent-regeln 3).
// Aufruf: node scripts/wap-gate/reference-lock.mjs [--root <verzeichnis>] [--reference-dir <ordner>]
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256Lf, zeigePfad } from '../wap/lib/common.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';
import { gemeinsamesGitVerzeichnis } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */

export const REFERENCE_LOCK_REL = 'docs/wap-planer/reference-lock.json';

/**
 * Referenzordner: WAP_REFERENCE_DIR, sonst reference/ des Haupt-Checkouts (Elternordner des
 * gemeinsamen Git-Verzeichnisses), wie H0 für die Sperrliste.
 * @param {string} root
 * @returns {string | null}
 */
export function standardReferenzOrdner(root) {
  const env = process.env.WAP_REFERENCE_DIR;
  if (env !== undefined && env.trim() !== '') return resolve(env);
  const common = gemeinsamesGitVerzeichnis(root);
  return common === null ? null : join(dirname(common), 'reference');
}

/**
 * Vergleicht die SHA-256 der Dateien aus docs/wap-planer/reference-lock.json unter referenceDir.
 * @param {{ cwd: string; referenceDir: string }} opts
 * @returns {Promise<Schritt>}
 */
export async function checkReferenceLock(opts) {
  const beginn = Date.now();
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: 'F2-referenz',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
  });
  const datei = join(resolve(opts.cwd), ...REFERENCE_LOCK_REL.split('/'));
  if (!existsSync(datei)) {
    return rotSchritt(
      `${REFERENCE_LOCK_REL} fehlt`,
      'Sperre der bestätigten Anhänge anlegen (Orchestrator, lock-update)',
    );
  }
  /** @type {Record<string, unknown>} */
  let files;
  try {
    const d = /** @type {{ version?: unknown; files?: unknown }} */ (
      JSON.parse(readFileSync(datei, 'utf8'))
    );
    if (
      d.version !== 1 ||
      d.files === null ||
      typeof d.files !== 'object' ||
      Array.isArray(d.files)
    ) {
      throw new Error('Format');
    }
    files = /** @type {Record<string, unknown>} */ (d.files);
  } catch {
    return rotSchritt(
      `${REFERENCE_LOCK_REL} ist ungültig (erwartet { "version": 1, "files": { … } })`,
      'Datei korrigieren (Orchestrator, lock-update)',
    );
  }
  if (!existsSync(opts.referenceDir) || !statSync(opts.referenceDir).isDirectory()) {
    return rotSchritt(
      'Referenzordner fehlt (WAP_REFERENCE_DIR bzw. reference/ des Haupt-Checkouts)',
      'WAP_REFERENCE_DIR auf den Ordner reference/ setzen',
    );
  }
  /** @type {string[]} */
  const befunde = [];
  for (const [rel, hash] of Object.entries(files)) {
    if (
      typeof hash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(hash) ||
      rel.includes('\\') ||
      isAbsolute(rel) ||
      rel.split('/').includes('..')
    ) {
      befunde.push(`ungültig: ${zeigePfad(rel)}`);
      continue;
    }
    const abs = join(opts.referenceDir, ...rel.split('/'));
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      befunde.push(`fehlt: ${zeigePfad(rel)}`);
      continue;
    }
    if (sha256Lf(readFileSync(abs)) !== hash) befunde.push(`geändert: ${zeigePfad(rel)}`);
  }
  if (befunde.length === 0) {
    return {
      id: 'F2-referenz',
      ok: true,
      ms: Date.now() - beginn,
      details: { geprueft: Object.keys(files).length },
    };
  }
  return {
    ...rotSchritt(
      `bestätigte Anhänge abweichend: ${kurzeListe(befunde)}`,
      'Anhang wiederherstellen; eine bestätigte Änderung nur über lock-update der reference-lock.json mit Grund (Orchestrator)',
    ),
    details: { befunde },
  };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const wert = (/** @type {string} */ name) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : undefined;
  };
  const root = resolve(wert('--root') ?? '.');
  const ref = wert('--reference-dir') ?? standardReferenzOrdner(root);
  if (ref === null || ref === undefined) {
    fehlerMeldung(
      'Referenzordner nicht bestimmbar: WAP_REFERENCE_DIR setzen oder --reference-dir angeben.',
    );
    process.exitCode = 1;
  } else {
    const s = await checkReferenceLock({ cwd: root, referenceDir: ref });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}
