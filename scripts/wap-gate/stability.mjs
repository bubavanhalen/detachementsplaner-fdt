// Stabilitätslauf (R-H-18, ADR-010 §3.4 und Änderungsnotiz AE-001 §2 «Stabilitätslauf»).
// Aufruf: node scripts/wap-gate/stability.mjs   (Beleglauf: beide Profile, nur nach Vorgabe des Orchestrators)
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `runStability` und Änderungsnotiz AE-001 §2, §4.
// Suite-`npm test` und WAP-Vitest je 3 × «normal» und 3 × «Grenzlast» (⌈25 % der Kerne⌉ Lastthreads im
// eigenen Prozess); jeder Kindlauf mit VITEST_MAX_WORKERS=4. Jede Abweichung ist blockierend.
// E1-01c §2.1: funktionale E2E und chromium-visual je dreimal nach dem normalen Profil, ohne
// Grenzlast; fehlende Bild-Baselines werden gesondert gemeldet. perf wird nie wiederholt.
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Worker } from 'node:worker_threads';
import { runE2e } from './e2e.mjs';
import { belegeSperre, lastRegeln, pruefeFremdlast, testUmgebung } from './last.mjs';
import { ok, rot } from './lib/out.mjs';
import { kurzeListe, npmCli, starte, starteNode, werkzeug } from './lib/prozess.mjs';
import { wurzel } from './lib/repo.mjs';
import { checkNode } from './node-check.mjs';
import { leseBericht } from './red-phase.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ suites?: PwSuite[]; specs?: { tests?: { projectName?: string; results?: { status?: string }[] }[]; title?: string }[]; title?: string }} PwSuite */

/** Wurzel des Checkouts dieser Skripte (Node-Prüfung, falls das Ziel keine engines/.nvmrc hat). */
const SKRIPT_WURZEL = resolve(fileURLToPath(import.meta.url), '..', '..', '..');

/**
 * Startet Lastthreads (Profil «Grenzlast»).
 * @param {number} anzahl
 * @returns {() => Promise<void>} beendet die Threads
 */
function grenzlast(anzahl) {
  const threads = Array.from(
    { length: anzahl },
    () => new Worker('for (;;) { Math.sqrt(Math.random()); }', { eval: true }),
  );
  return async () => {
    await Promise.all(threads.map((t) => t.terminate()));
  };
}

/**
 * WAP-Vitest und Suite-`npm test` je dreimal in den angegebenen Profilen; jede Abweichung → rot.
 * @param {{ cwd: string; last?: import('./last.mjs').Last; profile?: ('normal' | 'grenzlast')[] }} opts
 * @returns {Promise<Schritt>}
 */
export async function runStability(opts) {
  const beginn = Date.now();
  const id = 'V1-stabilitaet';
  const root = wurzel(resolve(opts.cwd)) ?? resolve(opts.cwd);
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id,
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
  });
  const nodeWurzel =
    existsSync(join(root, 'package.json')) && existsSync(join(root, '.nvmrc'))
      ? root
      : SKRIPT_WURZEL;
  const f1 = checkNode({
    packageJson: join(nodeWurzel, 'package.json'),
    nvmrc: join(nodeWurzel, '.nvmrc'),
  });
  if (!f1.ok) return rotSchritt(f1.ursache ?? 'Node-Prüfung rot', f1.naechsterSchritt ?? '');
  const sperre = await belegeSperre({
    modus: 'stability',
    worktree: root,
    env: process.env,
    ...(opts.last === undefined ? {} : { last: opts.last }),
  });
  if (!sperre.ok) {
    return rotSchritt(
      sperre.schritt.ursache ?? 'Sperre belegt',
      sperre.schritt.naechsterSchritt ?? '',
    );
  }
  try {
    if (!sperre.geschachtelt) {
      const l = await pruefeFremdlast({
        eigenePid: process.pid,
        ...(opts.last === undefined ? {} : { last: opts.last }),
      });
      if (!l.ok) return rotSchritt(l.ursache ?? 'F0-last rot', l.naechsterSchritt ?? '');
    }
    const npm = npmCli();
    const vitest = werkzeug(root, 'vitest');
    if (npm === null || vitest === null) {
      return rotSchritt(
        npm === null ? 'npm-cli.js fehlt neben dem laufenden Node' : 'vitest fehlt in node_modules',
        '«npm ci» ausführen bzw. Node-Installation prüfen',
      );
    }
    const env = testUmgebung(process.env, 'vitest');
    env.WAP_GATE_SPERRE = sperre.envWert;
    const ordner = join(root, 'test-results', 'wap', 'stabilitaet');
    rmSync(ordner, { recursive: true, force: true });
    mkdirSync(ordner, { recursive: true });
    /** @type {Map<string, string[]>} Test → Status je Lauf */
    const verlauf = new Map();
    /** @type {string[]} */
    const fehler = [];
    let lauf = 0;
    for (const profil of opts.profile ?? ['normal', 'grenzlast']) {
      const stop = profil === 'grenzlast' ? grenzlast(lastRegeln().grenzlastThreads) : null;
      try {
        for (let n = 1; n <= 3; n++) {
          lauf += 1;
          for (const art of ['suite', 'wap']) {
            const rel = `test-results/wap/stabilitaet/${art}-${profil}-${String(n)}.json`;
            const reporter = ['--reporter=default', '--reporter=json', `--outputFile.json=${rel}`];
            const r =
              art === 'suite'
                ? await starte(process.execPath, [npm, 'test', '--', ...reporter], {
                    cwd: root,
                    env,
                    timeoutMs: 3_600_000,
                  })
                : await starteNode(
                    vitest,
                    ['run', '-c', 'vitest.wap.config.ts', '--passWithNoTests', ...reporter],
                    { cwd: root, env, timeoutMs: 3_600_000 },
                  );
            const bericht = join(root, ...rel.split('/'));
            if (r.fehler !== null || !existsSync(bericht)) {
              fehler.push(
                `${art} Lauf ${String(lauf)} (${profil}) ohne Bericht${r.fehler === null ? '' : `: ${r.fehler}`}`,
              );
              continue;
            }
            const b = leseBericht(bericht);
            if (b.dateiFehler.length > 0) {
              fehler.push(
                `${art} Lauf ${String(lauf)}: ${String(b.dateiFehler.length)} Dateien mit Fehler beim Laden`,
              );
            }
            for (const t of b.tests) {
              const schluessel = `${art}: ${t.name}`;
              const liste = verlauf.get(schluessel) ?? [];
              liste[lauf - 1] = t.status;
              verlauf.set(schluessel, liste);
            }
          }
        }
      } finally {
        await stop?.();
      }
    }
    /** @type {string[]} */
    const flatternd = [];
    if (
      existsSync(join(root, 'playwright.wap.config.ts')) &&
      (opts.profile ?? ['normal', 'grenzlast']).includes('normal')
    ) {
      const pw = werkzeug(root, 'playwright');
      const liste =
        pw === null
          ? null
          : await starteNode(
              pw,
              [
                'test',
                '-c',
                'playwright.wap.config.ts',
                '--list',
                '--reporter=json',
                '--pass-with-no-tests',
              ],
              { cwd: root, env, timeoutMs: 300_000 },
            );
      /** @type {string[]} */
      let projekte = [];
      try {
        if (liste === null || liste.status !== 0) throw new Error();
        projekte = JSON.parse(liste.stdout.slice(liste.stdout.indexOf('{'))).config.projects.map(
          (/** @type {{ name: string }} */ p) => p.name,
        );
      } catch {
        fehler.push('Playwright-Testliste nicht lesbar');
      }
      for (const projekt of [
        undefined,
        ...(projekte.includes('chromium-visual') ? ['chromium-visual'] : []),
      ]) {
        const vor = process.env.WAP_GATE_SPERRE;
        process.env.WAP_GATE_SPERRE = sperre.envWert;
        let s;
        try {
          s = await runE2e({
            cwd: root,
            repeatEach: 3,
            ...(projekt === undefined ? {} : { project: projekt }),
          });
        } finally {
          if (vor === undefined) delete process.env.WAP_GATE_SPERRE;
          else process.env.WAP_GATE_SPERRE = vor;
        }
        const d = /** @type {{ bericht?: string; fehlendeBaselines?: string[] }} */ (
          s.details ?? {}
        );
        const fehlt = new Set(d.fehlendeBaselines ?? []);
        if (fehlt.size > 0) fehler.push(`Baseline fehlt: ${String(fehlt.size)} Kernzustände`);
        if (!d.bericht) {
          fehler.push(s.ursache ?? 'E2E ohne Bericht');
          continue;
        }
        const b = leseBericht(join(root, d.bericht));
        if (b.dateiFehler.length > 0) fehler.push('E2E: Fehler beim Laden');
        /** @type {Map<string, string[]>} */
        const ergebnisse = new Map();
        // Der Projektname ist ein Feld des Läuferberichts, keine Gruppe im Testtitel.
        const roh = JSON.parse(readFileSync(join(root, d.bericht), 'utf8'));
        const gehe = (/** @type {PwSuite} */ suite, /** @type {string[]} */ pfad) => {
          for (const spec of suite.specs ?? [])
            for (const t of spec.tests ?? []) {
              const name = [...pfad, spec.title].join(' > ');
              if (fehlt.has(name)) continue;
              const key = `e2e: ${t.projectName} > ${name}`;
              const statuses = ergebnisse.get(key) ?? [];
              statuses.push(t.results?.at(-1)?.status ?? 'fehlt');
              ergebnisse.set(key, statuses);
            }
          for (const kind of suite.suites ?? []) gehe(kind, [...pfad, kind.title ?? '']);
        };
        for (const suite of roh.suites ?? []) gehe(suite, []);
        for (const [name, statuses] of ergebnisse)
          if (statuses.length !== 3 || statuses.some((s) => s !== 'passed')) flatternd.push(name);
        if (
          !s.ok &&
          fehlt.size === 0 &&
          [...ergebnisse.values()].every((statuses) =>
            statuses.every((status) => status === 'passed'),
          )
        )
          fehler.push(s.ursache ?? 'E2E rot');
      }
    }
    for (const [name, liste] of verlauf) {
      // WAP-Teil: jeder Status ≠ passed ist rot. Suite-Teil (CR-E101-03): rot bei rotem Test oder bei
      // einem Statuswechsel zwischen den Läufen; ein durchgehend übersprungener Suite-Test (z.B. skipIf
      // ohne fixtures-private) bleibt Suite-Entscheid.
      const suite = name.startsWith('suite: ');
      const rote = [];
      for (let i = 0; i < lauf; i++) {
        const s = liste[i];
        const rot = suite ? s === undefined || s === 'failed' || s === 'timedOut' : s !== 'passed';
        if (rot) rote.push(i + 1);
      }
      const wechsel = suite && new Set(Array.from({ length: lauf }, (_x, i) => liste[i])).size > 1;
      if (rote.length > 0 || wechsel) {
        const text =
          rote.length === lauf
            ? 'rot in allen Läufen'
            : rote.length > 0
              ? `rot in Lauf ${rote.join(', ')} von ${String(lauf)}`
              : `Status wechselt zwischen den Läufen (${Array.from({ length: lauf }, (_x, i) => liste[i] ?? 'fehlt').join(', ')})`;
        flatternd.push(`${name} (${text})`);
      }
    }
    if (fehler.length === 0 && flatternd.length === 0) {
      return {
        id,
        ok: true,
        ms: Date.now() - beginn,
        details: { laeufe: lauf, tests: verlauf.size },
      };
    }
    return {
      ...rotSchritt(
        `${kurzeListe([...fehler, ...flatternd])}`,
        'flatternden Test ohne Wiederholung beheben (blockierend, Prompt §7); keine Wiederholungen einschalten',
      ),
      details: { flatternd, fehler },
    };
  } finally {
    await sperre.freigeben();
  }
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»; beide Profile).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await runStability({ cwd: process.cwd() });
  if (s.ok) ok(s.id, s.ms);
  else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
  process.exitCode = s.ok ? 0 : 1;
}
