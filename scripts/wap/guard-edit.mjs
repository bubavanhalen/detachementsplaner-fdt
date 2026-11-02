// Claude-Code-Hook PreToolUse für Edit, Write, MultiEdit und NotebookEdit (Paket H0, R-H-03, R-H-04, R-H-08).
// Vertrag: docs/wap-planer/pakete/H0.md, Klausel 2, P2, P3, P13, P17, P47d, P47e.
// Exit 0 = erlauben, Exit 2 = blockieren (Grund auf stderr). Im Zweifel blockieren (sicherer Zustand).
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import {
  fehler,
  LOCK_REL,
  readLock,
  realPath,
  relInside,
  worktreeOf,
  zeigePfad,
} from './lib/common.mjs';

const HINWEIS =
  'Gesperrte Dateien ändert nur der Orchestrator über «node scripts/wap/lock-update.mjs --grund …» ' +
  '(Eintrag in docs/wap-planer/FINDINGS.md). Ist die Änderung nötig, erhebe einen Einwand in deiner Schlussmeldung.';

/** Immer gesperrt, sobald der Worktree eine test-lock.json hat (P2). */
const IMMER_GESPERRT = new Set([LOCK_REL, '.claude/settings.json', '.claude/settings.local.json']);

/** Trägt die Entscheidung aus `entscheide` heraus; `main` übersetzt sie in den Exit-Code. */
class Entscheid extends Error {
  /**
   * @param {0 | 2} code
   * @param {string} grund
   */
  constructor(code, grund) {
    super(grund);
    this.code = code;
  }
}

/**
 * @param {string} grund
 * @returns {never}
 */
function blockieren(grund) {
  throw new Entscheid(2, grund);
}

/** @returns {never} */
function erlauben() {
  throw new Entscheid(0, '');
}

/**
 * P13: NTFS-Datenströme – jeder `:` ausserhalb des Laufwerksbuchstabens.
 * @param {string} p absoluter Pfad
 */
function hatDatenstrom(p) {
  let rest = p.replace(/^[\\/]{2}[?.][\\/]/, '');
  if (/^[A-Za-z]:/.test(rest)) rest = rest.slice(2);
  return rest.includes(':');
}

/**
 * Massgebender Pfad nach P13: existiert das Ziel, der ganze Pfad nativ aufgelöst (8.3-Kurznamen,
 * Junctions, Gross/Klein); sonst das nächste existierende Elternverzeichnis nativ aufgelöst und
 * der nicht existierende Rest angehängt.
 * @param {string} target absoluter, normalisierter Pfad
 * @returns {{ dir: string, real: string, rest: string[] }}
 */
function massgebend(target) {
  if (existsSync(target)) {
    try {
      const real = realpathSync.native(target);
      const dir = statSync(real).isDirectory() ? real : dirname(real);
      return { dir, real, rest: [] };
    } catch {
      // Nicht auflösbar: über das Elternverzeichnis weiter.
    }
  }
  const rest = [basename(target)];
  let dir = dirname(target);
  for (;;) {
    let istOrdner = false;
    try {
      istOrdner = statSync(dir).isDirectory();
    } catch {
      istOrdner = false;
    }
    if (istOrdner) break;
    const parent = dirname(dir);
    if (parent === dir) break;
    rest.unshift(basename(dir));
    dir = parent;
  }
  const realDir = realPath(dir);
  return { dir: realDir, real: join(realDir, ...rest), rest };
}

/**
 * Entscheidet über die Hook-Eingabe; endet immer mit einer `Entscheid`-Ausnahme.
 * @param {string} text
 * @returns {never}
 */
function entscheide(text) {
  /** @type {unknown} */
  let input;
  try {
    input = JSON.parse(text);
  } catch {
    blockieren('Hook-Eingabe ist kein gültiges JSON.');
  }
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    blockieren('Hook-Eingabe ist kein JSON-Objekt.');
  }
  const record = /** @type {Record<string, unknown>} */ (input);
  const toolInput = record.tool_input;
  if (toolInput === null || typeof toolInput !== 'object' || Array.isArray(toolInput)) {
    blockieren('Hook-Eingabe enthält kein tool_input-Objekt.');
  }
  const ti = /** @type {Record<string, unknown>} */ (toolInput);
  /** @type {string} */
  let pfad;
  if (typeof ti.file_path === 'string' && ti.file_path !== '') pfad = ti.file_path;
  else if (typeof ti.notebook_path === 'string' && ti.notebook_path !== '') pfad = ti.notebook_path;
  else blockieren('Hook-Eingabe enthält weder file_path noch notebook_path als Text.');

  const cwd = typeof record.cwd === 'string' && record.cwd !== '' ? record.cwd : null;
  /** @type {string} */
  let target;
  if (isAbsolute(pfad)) target = resolve(pfad);
  else if (cwd !== null && isAbsolute(cwd)) target = resolve(cwd, pfad);
  else blockieren('Relativer Pfad ohne cwd in der Hook-Eingabe.');

  if (hatDatenstrom(target)) {
    blockieren(
      'Pfade mit «:» ausserhalb des Laufwerksbuchstabens (NTFS-Datenströme) sind gesperrt.',
    );
  }

  const { dir, real, rest } = massgebend(target);
  const wt = worktreeOf(dir);
  if (wt.kind === 'kein-repo') erlauben();
  if (wt.kind === 'fehler') blockieren(`Worktree der Zieldatei nicht bestimmbar (${wt.grund}).`);
  const root = wt.root;
  if (!existsSync(join(root, ...LOCK_REL.split('/')))) erlauben();

  const lock = readLock(root);
  if (lock.kind !== 'ok') {
    const grund = lock.kind === 'ungueltig' ? lock.grund : `${LOCK_REL} nicht lesbar`;
    blockieren(`${grund}; alle Schreibzugriffe in diesem Worktree bleiben gesperrt.`);
  }
  if (rest.some((teil) => /~\d/.test(teil))) {
    blockieren('Nicht auflösbarer Pfadteil der Form ~<Ziffer> (8.3-Kurzname) ist gesperrt.');
  }

  const rel = relInside(root, real);
  if (rel === null) erlauben();
  const key = rel.toLowerCase();
  if (IMMER_GESPERRT.has(key) || key === 'scripts/wap' || key.startsWith('scripts/wap/')) {
    // P47d, P47e: Pfad nach P19 maskiert bzw. in Escape-Form.
    blockieren(`${zeigePfad(rel)} gehört zum Harness und ist gesperrt (R-H-04).`);
  }
  for (const locked of Object.keys(lock.files)) {
    if (locked.split('\\').join('/').toLowerCase() === key) {
      blockieren(`${zeigePfad(rel)} ist in ${LOCK_REL} gesperrt (R-H-03).`);
    }
  }
  erlauben();
}

function main() {
  let text = '';
  try {
    text = readFileSync(0, 'utf8');
  } catch {
    text = '';
  }
  try {
    entscheide(text);
  } catch (e) {
    if (e instanceof Entscheid) {
      if (e.code === 2) fehler(`WAP-Sperre: ${e.message}\n${HINWEIS}`);
      return e.code;
    }
  }
  // P17: jeder unerwartete Fehler blockiert.
  fehler(`WAP-Sperre: unerwarteter Fehler im Hook; Schreibzugriff blockiert.\n${HINWEIS}`);
  return 2;
}

process.exitCode = main();
