// globalSetup der Selbsttest-Konfiguration (Paket E1-01-min, R-H-18, R-H-27; Vertrag E1-01 Änderungsnotiz
// AE-001 §2 und §4 Nr 5, 8): Node-Prüfung und VITEST_MAX_WORKERS vor der Sperre, dann Sperre belegen
// und F0-last (beides nicht, wenn geschachtelt); setzt WAP_GATE_SPERRE für die Worker.
import { belegeSperre, pruefeFremdlast } from './last.mjs';
import { pruefeNode, pruefeWorker, vorgeseheneWorker } from './lib/vitest-pruefung.mjs';

/**
 * Prüft Node-Version und VITEST_MAX_WORKERS (gesetzt und ≠ maxWorkers → Fehler), belegt die Sperre und führt F0-last aus
 * (beides nicht, wenn geschachtelt). Wirft bei jedem Verstoss einen Error mit Ursache und nächstem Schritt.
 * @param {{ env: Record<string, string | undefined>; maxWorkers: number; nodeVersion?: string; eigenePid?: number; last?: import('./last.mjs').Last }} opts
 * @returns {Promise<{ envWert: string; freigeben(): Promise<void> }>}
 */
export async function pruefeSelbsttestSetup(opts) {
  pruefeNode(opts.nodeVersion);
  pruefeWorker(opts.env, opts.maxWorkers);
  const eigenePid = opts.eigenePid ?? process.pid;
  const sperre = await belegeSperre({
    modus: 'selbsttest',
    worktree: process.cwd(),
    env: opts.env,
    eigenePid,
    ...(opts.last === undefined ? {} : { last: opts.last }),
  });
  if (!sperre.ok) {
    throw new Error(
      `${sperre.schritt.ursache ?? 'Sperre belegt'}. Nächster Schritt: ${sperre.schritt.naechsterSchritt ?? ''}`,
    );
  }
  if (!sperre.geschachtelt) {
    const last = await pruefeFremdlast({
      eigenePid,
      ...(opts.last === undefined ? {} : { last: opts.last }),
    });
    if (!last.ok) {
      await sperre.freigeben();
      throw new Error(
        `${last.ursache ?? 'F0-last rot'}. Nächster Schritt: ${last.naechsterSchritt ?? ''}`,
      );
    }
  }
  return { envWert: sperre.envWert, freigeben: sperre.freigeben };
}

/**
 * Vitest-globalSetup: ruft pruefeSelbsttestSetup mit process.env und der vorgesehenen Workerzahl der
 * Konfiguration (provide.wapMaxWorkers, sonst project.config.maxWorkers), setzt
 * process.env.WAP_GATE_SPERRE = envWert und gibt freigeben als Teardown zurück.
 * @param {{ config: { maxWorkers?: number; provide?: Record<string, unknown> } }} project
 * @returns {Promise<() => Promise<void>>}
 */
export default async function setup(project) {
  const maxWorkers = vorgeseheneWorker(project);
  const r = await pruefeSelbsttestSetup({ env: process.env, maxWorkers: maxWorkers ?? Number.NaN });
  process.env.WAP_GATE_SPERRE = r.envWert;
  return async () => {
    await r.freigeben();
  };
}
