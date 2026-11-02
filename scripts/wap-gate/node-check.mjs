// F1 Node-Version (F-001, R-H-27, ADR-010 §3.1).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `checkNode`.
// Aufruf: node scripts/wap-gate/node-check.mjs [--root <verzeichnis>]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fehlerMeldung, ok, rot } from './lib/out.mjs';

/**
 * @param {string} text
 * @returns {[number, number, number] | null}
 */
function version(text) {
  const m = /^v?(\d+)(?:\.(\d+))?(?:\.(\d+))?$/.exec(text.trim());
  if (m === null) return null;
  return [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)];
}

/**
 * @param {[number, number, number]} a
 * @param {[number, number, number]} b
 * @returns {number}
 */
function vergleiche(a, b) {
  for (let i = 0; i < 3; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Prüft eine Version gegen einen engines-Bereich («>=24.15.0 <25», auch mit «||»).
 * @param {[number, number, number]} v
 * @param {string} bereich
 * @returns {boolean | null} null, wenn der Bereich nicht lesbar ist
 */
function erfuellt(v, bereich) {
  const alternativen = bereich.split('||').map((t) => t.trim());
  let lesbar = true;
  const treffer = alternativen.some((alt) => {
    const teile = alt.split(/\s+/).filter((t) => t !== '');
    if (teile.length === 0) {
      lesbar = false;
      return false;
    }
    return teile.every((teil) => {
      const m = /^(>=|<=|>|<|=)?(.+)$/.exec(teil);
      const ziel = m?.[2] === undefined ? null : version(m[2]);
      if (m === null || ziel === null) {
        lesbar = false;
        return false;
      }
      const d = vergleiche(v, ziel);
      switch (m[1]) {
        case '>=':
          return d >= 0;
        case '<=':
          return d <= 0;
        case '>':
          return d > 0;
        case '<':
          return d < 0;
        default:
          return d === 0;
      }
    });
  });
  return lesbar ? treffer : null;
}

/**
 * Kleinste verlangte Version («>=x.y.z» im ersten Teil des Bereichs), sonst null.
 * @param {string} bereich
 * @returns {string | null}
 */
function mindestversion(bereich) {
  const m = />=\s*v?(\d+(?:\.\d+){0,2})/.exec(bereich);
  return m?.[1] ?? null;
}

/**
 * Ordner der verlangten Node-Version unter nvm-windows (ADR-010 §3.1 F1).
 * @param {string} v
 * @returns {string}
 */
function nvmPfad(v) {
  const appdata = process.env.APPDATA;
  return appdata === undefined || appdata === ''
    ? `%APPDATA%\\nvm\\v${v}`
    : join(appdata, 'nvm', `v${v}`);
}

/**
 * Rot, wenn die Version ausserhalb von engines.node liegt oder die Hauptversion von .nvmrc abweicht.
 * version fehlt → process.versions.node.
 * @param {{ packageJson: string; nvmrc: string; version?: string }} opts
 * @returns {import('./lib/types.mjs').Schritt}
 */
export function checkNode(opts) {
  const beginn = Date.now();
  const ist = opts.version ?? process.versions.node;
  /**
   * @param {string} ursache
   * @param {string} naechsterSchritt
   * @returns {import('./lib/types.mjs').Schritt}
   */
  const rotSchritt = (ursache, naechsterSchritt) => ({
    id: 'F1-node',
    ok: false,
    ms: Date.now() - beginn,
    ursache,
    naechsterSchritt,
  });
  if (!existsSync(opts.packageJson)) {
    return rotSchritt(
      'package.json fehlt; die verlangte Node-Version ist nicht bestimmbar',
      'Schleuse in der Wurzel des Worktrees starten',
    );
  }
  if (!existsSync(opts.nvmrc)) {
    return rotSchritt(
      '.nvmrc fehlt; die verlangte Node-Hauptversion ist nicht bestimmbar',
      '.nvmrc mit der Hauptversion (24) anlegen bzw. den Worktree vollständig auschecken',
    );
  }
  /** @type {string | undefined} */
  let bereich;
  try {
    const pkg = /** @type {{ engines?: { node?: unknown } }} */ (
      JSON.parse(readFileSync(opts.packageJson, 'utf8'))
    );
    bereich = typeof pkg.engines?.node === 'string' ? pkg.engines.node : undefined;
  } catch {
    return rotSchritt('package.json ist kein gültiges JSON', 'package.json korrigieren');
  }
  if (bereich === undefined) {
    return rotSchritt(
      'package.json nennt kein engines.node',
      'engines.node in package.json eintragen (z.B. «>=24.15.0 <25»)',
    );
  }
  const nvmrc = version(readFileSync(opts.nvmrc, 'utf8'));
  const v = version(ist);
  const min = mindestversion(bereich) ?? (nvmrc === null ? ist : nvmrc.join('.'));
  const hinweis =
    `Node ${min} verwenden («nvm use ${min}», Ordner ${nvmPfad(min)}) und den Befehl ` +
    'in einer neuen Konsole erneut starten';
  if (v === null) return rotSchritt(`Node-Version ${ist} ist nicht lesbar`, hinweis);
  const passt = erfuellt(v, bereich);
  if (passt === null) {
    return rotSchritt(`engines.node «${bereich}» ist nicht lesbar`, 'engines.node korrigieren');
  }
  if (!passt) {
    return rotSchritt(
      `Node ${ist} liegt ausserhalb von engines.node «${bereich}» (verlangt ${min}, Ordner ${nvmPfad(min)})`,
      hinweis,
    );
  }
  if (nvmrc === null) {
    return rotSchritt('.nvmrc ist nicht lesbar', '.nvmrc mit der Hauptversion (24) füllen');
  }
  if (nvmrc[0] !== v[0]) {
    return rotSchritt(
      `Node ${ist} weicht von der Hauptversion ${String(nvmrc[0])} aus .nvmrc ab`,
      hinweis,
    );
  }
  return { id: 'F1-node', ok: true, ms: Date.now() - beginn };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  const unbekannt = args.filter((a, k) => a !== '--root' && k !== i + 1);
  if ((i >= 0 && args[i + 1] === undefined) || unbekannt.length > 0) {
    fehlerMeldung('Aufruf: node scripts/wap-gate/node-check.mjs [--root <verzeichnis>]');
    process.exitCode = 1;
  } else {
    const root = resolve(i >= 0 ? (args[i + 1] ?? '.') : '.');
    const s = checkNode({
      packageJson: join(root, 'package.json'),
      nvmrc: join(root, '.nvmrc'),
    });
    if (s.ok) ok(s.id, s.ms);
    else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
    process.exitCode = s.ok ? 0 : 1;
  }
}
