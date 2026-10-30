// E2E-Anteil der Abdeckung V2 (R-H-16, ADR-010 §6.1 b; FT-A-02, F-TOOLS, Koordinator 20.10.2026).
// Startet die funktionalen E2E im Projekt «edge» (Entwicklungsserver, --workers=2) mit WAP_E2E_COVERAGE: wapPage
// legt je Test die V8-Abdeckung der Quellen unter /src/ ab (tests/wap-e2e/support/fixtures.ts). Danach rechnet
// derselbe Umrechner wie in Vitest (ast-v8-to-istanbul, MIT) die V8-Daten über die eingebetteten Quellzuordnungen von Vite
// in einen Istanbul-Datensatz um: test-results/wap/coverage/e2e/coverage-final.json (Pfade repo-relativ), den
// coverage-check.mjs mit dem Vitest-Datensatz zusammenführt. Rote E2E-Tests zählen nur als Hinweis (Wertung V4).
// Aufruf: node scripts/wap-gate/coverage-e2e.mjs [--root <dir>] [--nur-umrechnen]
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { runE2e } from './e2e.mjs';
import { fehlerMeldung, hinweis } from './lib/out.mjs';
import { musterRegex } from './lib/repo.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ path?: string; s: Record<string, number>; f: Record<string, number>; b: Record<string, number[]>; [k: string]: unknown }} IstanbulDatei */

/** Rohdaten je Test und umgerechneter Istanbul-Datensatz (nicht versioniert). */
export const E2E_ROH = 'test-results/wap/coverage/e2e-roh';
export const E2E_ISTANBUL = 'test-results/wap/coverage/e2e/coverage-final.json';

/**
 * Repo-relativer Pfad einer Quelle aus der Quellzuordnung bzw. URL des Entwicklungsservers; null ausserhalb.
 * @param {string} root
 * @param {string} pfad
 * @returns {string | null}
 */
export function quellPfad(root, pfad) {
  let p = pfad.replace(/\?.*$/, '').replace(/\\/g, '/');
  if (/^https?:\/\//.test(p)) p = new URL(p).pathname;
  if (p.startsWith('file://')) p = fileURLToPath(p).replace(/\\/g, '/');
  if (/^\/@fs\//.test(p)) p = p.slice('/@fs/'.length);
  const wurzel = resolve(root).replace(/\\/g, '/');
  if (p.toLowerCase().startsWith(`${wurzel.toLowerCase()}/`)) p = p.slice(wurzel.length + 1);
  p = p.replace(/^\/+/, '');
  const i = p.indexOf('src/');
  if (!p.startsWith('src/') && i >= 0) p = p.slice(i);
  return p.startsWith('src/') && !p.split('/').includes('..') ? p : null;
}

/**
 * Eingebettete Quellzuordnung (sourceMappingURL=data:…;base64,…) eines vom Entwicklungsserver gelieferten Moduls.
 * @param {string} code
 * @returns {Record<string, unknown> | undefined}
 */
function eingebetteteZuordnung(code) {
  const m =
    /\/\/# sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)\s*$/.exec(
      code,
    );
  if (m === null || m[1] === undefined) return undefined;
  try {
    return /** @type {Record<string, unknown>} */ (
      JSON.parse(Buffer.from(m[1], 'base64').toString('utf8'))
    );
  } catch {
    return undefined;
  }
}

/**
 * Summiert Istanbul-Zähler einer Datei (gleicher Umrechner, gleicher Code: gleiche IDs).
 * @param {IstanbulDatei} ziel
 * @param {IstanbulDatei} neu
 */
function addiere(ziel, neu) {
  for (const art of /** @type {const} */ (['s', 'f'])) {
    for (const [id, n] of Object.entries(neu[art] ?? {}))
      ziel[art][id] = (ziel[art][id] ?? 0) + Number(n);
  }
  for (const [id, t] of Object.entries(neu.b ?? {})) {
    const alt = ziel.b[id] ?? [];
    ziel.b[id] = /** @type {number[]} */ (t).map((n, i) => (alt[i] ?? 0) + n);
  }
}

/**
 * Rechnet die Rohdaten mit demselben Umrechner wie Vitest (ast-v8-to-istanbul über die Quellzuordnungen von
 * Vite, AST aus vite.parseAstAsync) in einen Istanbul-Datensatz um (nur Quellen der Pfadmengen).
 * @param {{ cwd: string; muster: string[] }} opts
 * @returns {Promise<{ ok: boolean; dateien: number; tests: number; grund?: string }>}
 */
export async function rechneUm(opts) {
  const root = resolve(opts.cwd);
  const roh = join(root, ...E2E_ROH.split('/'));
  if (!existsSync(roh)) return { ok: false, dateien: 0, tests: 0, grund: 'keine E2E-Rohdaten' };
  const res = opts.muster.map((m) => musterRegex(m));
  const umrechner =
    /** @type {{ default: (o: Record<string, unknown>) => Promise<Record<string, IstanbulDatei>> }} */ (
      await import(
        pathToFileURL(join(root, 'node_modules', 'ast-v8-to-istanbul', 'dist', 'index.mjs')).href
      )
    );
  const vite = /** @type {{ parseAstAsync: (code: string) => Promise<unknown> }} */ (
    await import(pathToFileURL(join(root, 'node_modules', 'vite', 'dist', 'node', 'index.js')).href)
  );
  /** @type {Record<string, IstanbulDatei>} */
  const gesamt = {};
  const dateien = readdirSync(roh).filter((n) => n.endsWith('.json'));
  let fehler = 0;
  for (const n of dateien) {
    const eintraege = /** @type {{ url: string; source?: string; functions: unknown[] }[]} */ (
      JSON.parse(readFileSync(join(roh, n), 'utf8'))
    );
    for (const e of eintraege) {
      const rel = quellPfad(root, e.url);
      if (rel === null || e.source === undefined || !res.some((r) => r.test(rel))) continue;
      const datei = join(root, ...rel.split('/'));
      try {
        const daten = await umrechner.default({
          code: e.source,
          sourceMap: eingebetteteZuordnung(e.source),
          ast: vite.parseAstAsync(e.source),
          coverage: { functions: e.functions, url: pathToFileURL(datei).href },
        });
        for (const [schluessel, wert] of Object.entries(daten)) {
          const q = quellPfad(root, String(wert.path ?? schluessel));
          if (q === null || !res.some((r) => r.test(q))) continue;
          const eintrag = { ...wert, path: q };
          if (gesamt[q] === undefined) gesamt[q] = JSON.parse(JSON.stringify(eintrag));
          else addiere(gesamt[q], eintrag);
        }
      } catch {
        fehler += 1;
      }
    }
  }
  const ziel = join(root, ...E2E_ISTANBUL.split('/'));
  rmSync(join(ziel, '..'), { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  mkdirSync(join(ziel, '..'), { recursive: true });
  writeFileSync(ziel, `${JSON.stringify(gesamt)}\n`);
  const anzahl = Object.keys(gesamt).length;
  if (anzahl === 0) {
    return {
      ok: false,
      dateien: 0,
      tests: dateien.length,
      grund: `Umrechnung ohne Ergebnis (${String(fehler)} Fehler)`,
    };
  }
  return {
    ok: true,
    dateien: anzahl,
    tests: dateien.length,
    ...(fehler > 0 ? { grund: `${String(fehler)} Module nicht umrechenbar` } : {}),
  };
}

/**
 * Messlauf E2E (Projekt edge) mit Abdeckung und Umrechnung.
 * @param {{ cwd: string; muster: string[] }} opts
 * @returns {Promise<Schritt>}
 */
export async function messeE2eAbdeckung(opts) {
  const beginn = Date.now();
  const root = resolve(opts.cwd);
  const roh = join(root, ...E2E_ROH.split('/'));
  rmSync(roh, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  mkdirSync(roh, { recursive: true });
  const vorher = process.env.WAP_E2E_COVERAGE;
  process.env.WAP_E2E_COVERAGE = roh;
  /** @type {Schritt} */
  let lauf;
  try {
    const { port: _port, ...r } = await runE2e({ cwd: root, project: 'edge' });
    lauf = r;
  } finally {
    if (vorher === undefined) delete process.env.WAP_E2E_COVERAGE;
    else process.env.WAP_E2E_COVERAGE = vorher;
  }
  const u = await rechneUm({ cwd: root, muster: opts.muster });
  if (!u.ok) {
    return {
      id: 'V2-e2e',
      ok: false,
      ms: Date.now() - beginn,
      ursache: `E2E-Abdeckung nicht erhoben: ${u.grund ?? ''} (E2E: ${lauf.ok ? 'grün' : (lauf.ursache ?? 'rot')})`,
      naechsterSchritt: 'E2E im Projekt edge prüfen (npm run wap:test:e2e), dann erneut messen',
    };
  }
  return {
    id: 'V2-e2e',
    ok: true,
    ms: Date.now() - beginn,
    details: {
      tests: u.tests,
      dateien: u.dateien,
      e2eGruen: lauf.ok,
      e2eUrsache: lauf.ursache ?? null,
    },
  };
}

// CLI
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  const root = resolve(i >= 0 ? (args[i + 1] ?? '.') : '.');
  const { ladeSchwellen, SCHWELLEN_REL } = await import('./coverage-check.mjs');
  const s = ladeSchwellen(join(root, ...SCHWELLEN_REL.split('/')));
  if (!s.ok) {
    fehlerMeldung(s.grund);
    process.exitCode = 1;
  } else {
    const muster = s.schwellen.mengen.flatMap((m) => m.muster);
    const r = args.includes('--nur-umrechnen')
      ? await rechneUm({ cwd: root, muster })
      : await messeE2eAbdeckung({ cwd: root, muster });
    hinweis(JSON.stringify(r));
    process.exitCode = r.ok ? 0 : 1;
  }
}
