// F7 Lock-Abdeckung (R-H-10, R-H-18; ADR-010 §3.1 F7 und Änderungsnotiz AE-001 §1; Vertrag §7, PL0-18).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `checkLockCoverage` und Änderungsnotiz AE-001 §2
// (Testpfadmenge scripts/wap-gate/testpfade.json, fail-closed).
// Aufruf: node scripts/wap-gate/lock-coverage.mjs [--root <verzeichnis>]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readLock, zeigePfad } from '../wap/lib/common.mjs';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';
import { kurzeListe } from './lib/prozess.mjs';
import { arbeitsbaumDateien, git, mergeBasis, musterRegex, pakete } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */

const TESTPFADE_REL = 'scripts/wap-gate/testpfade.json';

/** WAP-Konfigurationen, die gesperrt sein müssen, sobald sie in der Merge-Basis existieren. */
const KONFIG =
  /^(?:vitest\.wap[^/]*\.config\.ts|playwright\.wap\.config\.ts|stryker\.wap\.conf\.mjs|tsconfig\.wap\.json)$/;

/**
 * Rot bei einer ungesperrten Datei unter scripts/wap-gate/, unter der Testpfadmenge eines eingefrorenen
 * Pakets oder bei einer ungesperrten WAP-Konfiguration aus der Merge-Basis mit wap-planer; rot, wenn
 * testpfade.json fehlt oder einem eingefrorenen Paket der Eintrag fehlt. Ein Paket, dessen Kästchen 6
 * «entfällt» (kein Test-Freeze, z.B. H0), braucht keinen Eintrag.
 * @param {{ cwd: string }} opts
 * @returns {Promise<Schritt>}
 */
export async function checkLockCoverage(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: 'F7-lock',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
  });
  const lock = readLock(root);
  if (lock.kind !== 'ok') {
    return rotSchritt(
      lock.kind === 'fehlt' ? 'test-lock.json fehlt' : lock.grund,
      'Sperrdatei mit lock-update herstellen',
    );
  }
  const gesperrt = new Set(Object.keys(lock.files));
  const dateien = arbeitsbaumDateien(root);
  if (dateien === null) {
    return rotSchritt('Dateiliste nicht lesbar (git ls-files gescheitert)', 'git-Zustand prüfen');
  }
  /** @type {string[]} */
  const ungesperrt = [];
  /** @type {string[]} */
  const gruende = [];
  for (const p of dateien)
    if (p.startsWith('scripts/wap-gate/') && !gesperrt.has(p)) ungesperrt.push(p);

  /** @type {Record<string, unknown> | null} */
  let testpfade = null;
  const tpDatei = join(root, ...TESTPFADE_REL.split('/'));
  if (existsSync(tpDatei)) {
    try {
      const d = JSON.parse(readFileSync(tpDatei, 'utf8'));
      if (d !== null && typeof d === 'object' && !Array.isArray(d)) {
        testpfade = /** @type {Record<string, unknown>} */ (d);
      }
    } catch {
      testpfade = null;
    }
  }
  if (testpfade === null) {
    gruende.push(`${TESTPFADE_REL} fehlt oder ist ungültig`);
  } else {
    const eintraege = new Map(Object.entries(testpfade).map(([k, v]) => [k.toLowerCase(), v]));
    for (const paket of pakete(root)) {
      if (!paket.eingefroren || paket.freezeEntfaellt) continue;
      const globs = eintraege.get(paket.name.toLowerCase());
      if (!Array.isArray(globs) || globs.some((g) => typeof g !== 'string')) {
        gruende.push(`eingefrorenes Paket ${paket.name} ohne gültigen Eintrag in ${TESTPFADE_REL}`);
        continue;
      }
      const res = globs.map((g) => musterRegex(String(g)));
      for (const p of dateien) {
        if (res.some((re) => re.test(p)) && !gesperrt.has(p) && !ungesperrt.includes(p)) {
          ungesperrt.push(p);
        }
      }
    }
  }

  const basis = mergeBasis(root, 'HEAD', 'wap-planer');
  if (basis === null) {
    gruende.push('Merge-Basis mit wap-planer nicht bestimmbar (Zweig wap-planer fehlt)');
  } else {
    const baum = git(root, ['ls-tree', '--name-only', '-z', basis]);
    if (baum.status !== 0) {
      gruende.push('Stand der Merge-Basis nicht lesbar (git ls-tree)');
    } else {
      for (const p of baum.stdout.split('\0')) {
        if (
          KONFIG.test(p) &&
          existsSync(join(root, p)) &&
          !gesperrt.has(p) &&
          !ungesperrt.includes(p)
        ) {
          ungesperrt.push(p);
        }
      }
    }
  }
  if (ungesperrt.length > 0) {
    gruende.unshift(
      `${String(ungesperrt.length)} ungesperrte Dateien: ${kurzeListe(ungesperrt.map((p) => zeigePfad(p)))}`,
    );
  }
  if (gruende.length === 0) return { id: 'F7-lock', ok: true, ms: Date.now() - beginn };
  return {
    ...rotSchritt(
      gruende.join('; '),
      'Dateien per «node scripts/wap/lock-update.mjs --grund <text> --add <pfad>» sperren (nur Orchestrator) bzw. testpfade.json nachführen',
    ),
    details: { ungesperrt },
  };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  if ((i >= 0 && args[i + 1] === undefined) || args.length > (i >= 0 ? 2 : 0)) {
    fehlerMeldung('Aufruf: node scripts/wap-gate/lock-coverage.mjs [--root <verzeichnis>]');
    process.exitCode = 1;
  } else {
    const s = await checkLockCoverage({ cwd: resolve(i >= 0 ? (args[i + 1] ?? '.') : '.') });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}
