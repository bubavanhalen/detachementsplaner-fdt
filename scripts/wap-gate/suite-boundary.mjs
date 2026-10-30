// F7 Suite-Grenze (R-H-30, Prompt §5.6, ADR-010 §3.1, Plan Etappe 1 §9, suite-allowlist.json).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `checkSuiteBoundary`, §6.
// Aufruf: node scripts/wap-gate/suite-boundary.mjs [--root <verzeichnis>] [--basis <ref>]
// (Standard-Basis: git merge-base main HEAD)
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { zeigePfad } from '../wap/lib/common.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';
import { commitVon, git, mergeBasis, passt, WAP_EIGENE } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */

const ALLOWLIST_REL = 'scripts/wap-gate/suite-allowlist.json';

/**
 * Rot bei jeder gegenüber basis geänderten Suite-Datei ausserhalb von suite-allowlist.json
 * (geändert, neu oder gelöscht; committet, gestagt, im Arbeitsbaum oder nicht versioniert).
 * Die Einträge der Liste sind Pfade oder Muster («*», «**»).
 * @param {{ cwd: string; basis: string }} opts basis = git merge-base main HEAD
 * @returns {Promise<Schritt>}
 */
export async function checkSuiteBoundary(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: 'F7-suite',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
  });
  /** @type {string[]} */
  let freigegeben;
  try {
    const d = /** @type {{ dateien?: unknown }} */ (
      JSON.parse(readFileSync(join(root, ...ALLOWLIST_REL.split('/')), 'utf8'))
    );
    if (!Array.isArray(d.dateien)) throw new Error('dateien fehlt');
    freigegeben = d.dateien.filter((x) => typeof x === 'string');
  } catch {
    return rotSchritt(
      `${ALLOWLIST_REL} fehlt oder ist ungültig (Feld «dateien»)`,
      'freigegebene Suite-Dateien (Plan Etappe 1 §9) in suite-allowlist.json eintragen',
    );
  }
  if (commitVon(root, opts.basis) === null) {
    return rotSchritt(
      `Vergleichsstand «${zeigePfad(opts.basis)}» ist kein Commit`,
      'Zweig main bereitstellen (git merge-base main HEAD) und erneut starten',
    );
  }
  const diff = git(root, ['diff', '--name-only', '-z', '--no-renames', opts.basis]);
  const neu = git(root, ['ls-files', '-z', '-o', '--exclude-standard']);
  if (diff.status !== 0 || neu.status !== 0) {
    return rotSchritt('Änderungsliste nicht lesbar (git diff gescheitert)', 'git-Zustand prüfen');
  }
  const geaendert = [
    ...new Set([...diff.stdout.split('\0'), ...neu.stdout.split('\0')].filter((p) => p !== '')),
  ].sort();
  const verboten = geaendert.filter((p) => !passt(p, WAP_EIGENE) && !passt(p, freigegeben));
  if (verboten.length === 0) {
    return {
      id: 'F7-suite',
      ok: true,
      ms: Date.now() - beginn,
      details: { geaendert: geaendert.length },
    };
  }
  return {
    ...rotSchritt(
      `${String(verboten.length)} Suite-Dateien ausserhalb der Freigabe geändert: ${kurzeListe(
        verboten.map((p) => zeigePfad(p)),
      )}`,
      'Änderung zurücknehmen oder Freigabe beim Auftraggeber einholen (Plan Etappe 1 §9) und suite-allowlist.json per lock-update nachführen',
    ),
    details: { verboten },
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
  const basis = wert('--basis') ?? mergeBasis(root, 'main', 'HEAD');
  if (basis === undefined || basis === null) {
    fehlerMeldung('Vergleichsstand fehlt: Zweig main nicht gefunden; --basis <ref> angeben.');
    process.exitCode = 1;
  } else {
    const s = await checkSuiteBoundary({ cwd: root, basis });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}
