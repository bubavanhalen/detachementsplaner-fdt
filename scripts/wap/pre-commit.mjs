// Commit-Prüfung bis zur Einrichtung der Schleusen (Paket H0, R-H-08; R-H-05, R-H-07).
// Vertrag: docs/wap-planer/pakete/H0.md, Klausel 6, P9, P9a, P14, P21, P45, P47d–P47g.
// Führt aus: lock-check (Arbeitsbaum); Abgleich gesperrter Pfade im gestagten Stand (P9, P21);
// Protokollpflicht für eine gestagte Änderung an test-lock.json gegenüber HEAD (P14);
// privacy-scan --staged. Aufgerufen vom Shim aus install-hooks.mjs (pre-commit, pre-merge-commit).
// H0-Ergänzung A-1 (Vertrag E1-01 §1a, R-H-10, ADR-010 §3.1): Sind diese Prüfungen grün und ist
// scripts/wap-gate/gate.mjs in test-lock.json gesperrt (Arbeitsbaum oder gestagt), folgt die schnelle
// Schleuse dieses Worktrees mit «gate.mjs fast --pre-commit»; rot, Signal oder Startfehler → Abbruch.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FINDINGS_REL,
  fehler,
  gitBlob,
  info,
  kollisionen,
  LOCK_REL,
  parseLock,
  protokollPruefung,
  readLock,
  runGit,
  sha256Lf,
  worktreeOf,
  zeigePfad,
} from './lib/common.mjs';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));

/** Schnelle Schleuse; aktiv, sobald sie gesperrt ist (H0-Ergänzung A-1, Vertrag E1-01 §1a). */
const GATE_REL = 'scripts/wap-gate/gate.mjs';

/**
 * @param {string} name
 * @param {string[]} args
 */
function runSkript(name, args) {
  const r = spawnSync(process.execPath, [join(SCRIPT_DIR, name), ...args], {
    stdio: 'inherit',
    windowsHide: true,
  });
  return r.status === 0;
}

/**
 * Sperrdatei in einem git-Stand; fehlt sie, gilt ein leeres `files` (P14).
 * @param {string} root
 * @param {string} spec
 * @returns {{ files: Record<string, string> } | { grund: string }}
 */
function lockIn(root, spec) {
  const bytes = gitBlob(root, spec);
  if (bytes === null) return { files: {} };
  const lock = parseLock(bytes.toString('utf8'));
  return lock.kind === 'ok' ? { files: lock.files } : { grund: lock.grund };
}

/**
 * Gestagter Stand gesperrter Pfade und Protokollpflicht.
 * @returns {string[]} Meldungen (leer = in Ordnung)
 */
function pruefeGestagt() {
  const wt = worktreeOf(process.cwd());
  if (wt.kind !== 'ok') return [];
  const root = wt.root;
  /** @type {string[]} */
  const meldungen = [];

  const gestagt = lockIn(root, `:${LOCK_REL}`);
  if ('grund' in gestagt) return [`gestagt: ${gestagt.grund}`];
  const arbeitsbaum = readLock(root);

  // P9, P21: jeder gesperrte Eintrag (Arbeitsbaum und Index) muss im Index auflösbar sein und
  // dort den gesperrten Hash haben.
  /** @type {Array<[string, string]>} */
  const eintraege = Object.entries(gestagt.files);
  if (arbeitsbaum.kind === 'ok') eintraege.push(...Object.entries(arbeitsbaum.files));
  const gemeldet = new Set();
  for (const [rel, hash] of eintraege) {
    const schluessel = `${rel}\0${hash}`;
    if (gemeldet.has(schluessel)) continue;
    gemeldet.add(schluessel);
    const blob = gitBlob(root, `:${rel}`);
    if (blob === null) {
      meldungen.push(
        `nicht im Index: ${zeigePfad(rel)} (gesperrt, aber nicht versioniert oder andere ` +
          'Schreibweise)',
      );
    } else if (sha256Lf(blob) !== hash) {
      meldungen.push(`geändert (gestagt): ${zeigePfad(rel)}`);
    }
  }

  // P9a, P47c: Gross/Klein-Kollision eines Index-Eintrags mit einem geschützten Pfad.
  const index = runGit(['ls-files', '-z'], { cwd: root });
  if (index.status !== 0) {
    meldungen.push('Index nicht lesbar (git ls-files)');
  } else {
    const gesperrt = new Set(eintraege.map(([rel]) => rel));
    const pfade = index.stdout.split('\0').filter((p) => p !== '');
    for (const k of kollisionen(pfade, gesperrt)) {
      meldungen.push(
        `Kollision: ${zeigePfad(k)} (gleicht einem gesperrten Pfad ohne Beachtung von Gross/Klein)`,
      );
    }
  }

  // P27 und P14: gestagtes Protokoll und gestagte Sperrdatei gegenüber HEAD.
  const head = lockIn(root, `HEAD:${LOCK_REL}`);
  if ('grund' in head) return [...meldungen, `HEAD: ${head.grund}`];
  const altFindings = gitBlob(root, `HEAD:${FINDINGS_REL}`)?.toString('utf8') ?? '';
  const neuFindings = gitBlob(root, `:${FINDINGS_REL}`)?.toString('utf8') ?? '';
  const pruefung = protokollPruefung(head.files, gestagt.files, altFindings, neuFindings);
  // P42: Verstösse im Vergleichsstand (HEAD) sind Hinweise, keine Blockade.
  for (const h of pruefung.hinweise) info(`Lock-Prüfung (gestagt): ${h} (HEAD)`);
  for (const m of pruefung.fehler) meldungen.push(`${m} (gestagter Stand gegenüber HEAD)`);
  return meldungen;
}

/**
 * Ist die schnelle Schleuse gesperrt (Eintrag in test-lock.json im Arbeitsbaum oder im gestagten Stand)?
 * @param {string} root
 */
function schleuseGesperrt(root) {
  const arbeitsbaum = readLock(root);
  if (arbeitsbaum.kind === 'ok' && Object.hasOwn(arbeitsbaum.files, GATE_REL)) return true;
  const gestagt = lockIn(root, `:${LOCK_REL}`);
  return !('grund' in gestagt) && Object.hasOwn(gestagt.files, GATE_REL);
}

/**
 * Startet die schnelle Schleuse dieses Worktrees (fail-closed: Exit ≠ 0, Signal oder Startfehler → rot).
 * Die Umgebung bleibt unverändert (GIT_INDEX_FILE für F0-arbeitsbaum, Vertrag E1-01 §1).
 * @param {string} root
 */
function schnelleSchleuse(root) {
  const r = spawnSync(
    process.execPath,
    [join(root, ...GATE_REL.split('/')), 'fast', '--pre-commit'],
    {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  return r.error === undefined && r.signal === null && r.status === 0;
}

function main() {
  const lockOk = runSkript('lock-check.mjs', []);
  const gestagt = pruefeGestagt();
  for (const m of gestagt) fehler(`Lock-Prüfung (gestagt): ${m}`);
  if (gestagt.length > 0) {
    fehler(
      'Gestagte Änderung an Sperren: gesperrte Dateien und test-lock.json nur über lock-update ' +
        'ändern und FINDINGS.md mitstagen; sonst mit «git restore --staged <pfad>» zurücknehmen.',
    );
  }
  const scanOk = runSkript('privacy-scan.mjs', ['--staged']);
  const wt = worktreeOf(process.cwd());
  const root = wt.kind === 'ok' ? wt.root : null;
  const aktiv = root !== null && schleuseGesperrt(root);
  if (!aktiv) {
    info(
      'Schnelle Schleuse noch nicht eingerichtet (scripts/wap-gate/gate.mjs nicht gesperrt): ' +
        'nur Lock-Prüfung und Datenschutz-Scan.',
    );
  }
  if (lockOk && gestagt.length === 0 && scanOk) {
    if (aktiv && root !== null && !schnelleSchleuse(root)) {
      fehler('Schnelle Schleuse rot: Commit abgebrochen.');
      return 1;
    }
    info('WAP-Commit-Prüfung: in Ordnung.');
    return 0;
  }
  fehler(
    'WAP-Commit-Prüfung gescheitert: Commit abgebrochen. Befunde oben beheben und erneut committen.',
  );
  return 1;
}

process.exitCode = main();
