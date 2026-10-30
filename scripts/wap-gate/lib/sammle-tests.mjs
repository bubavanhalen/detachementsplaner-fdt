// Testliste einer Vitest-Konfiguration durch Sammeln ohne globalSetup (Paket E1-01, ADR-010 §5, CR-E101-09).
// Aufruf (nur von trace.mjs): node scripts/wap-gate/lib/sammle-tests.mjs <vitest/dist/node.js> <konfig> <ausgabe.json>
// Die statische Liste von `vitest list` (Vitest 5.0.1) übergeht Tests über abgeleitete Testfunktionen
// (`const t = it.extend(…); t('…')`). Diese Liste ergänzt sie: Vitest sammelt die Tests, ohne sie
// auszuführen, und ohne globalSetup (keine Sperre, kein F0-last; Vertrag E1-01, Änderungsnotiz AE-001
// §4 Nr 5: F9 belegt keine Sperre). Ausgabe: JSON-Liste { name, file } in die Datei <ausgabe.json>.
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [vitestNode, konfig, ausgabe] = process.argv.slice(2);
if (vitestNode === undefined || konfig === undefined || ausgabe === undefined) {
  process.stderr.write('Aufruf: sammle-tests.mjs <vitest/dist/node.js> <konfig> <ausgabe.json>\n');
  process.exit(1);
}

/**
 * @typedef {{ name: string; fullName: string; module: { moduleId: string } }} Fall
 * @typedef {{ children: { allTests(): Iterable<Fall> }; errors(): unknown[]; state(): string }} Modul
 * @typedef {{ collect(f: string[] | undefined, o: { staticParse: boolean }): Promise<{ testModules: Modul[]; unhandledErrors: unknown[] }>; close(): Promise<void> }} VitestInstanz
 */

const api =
  /** @type {{ createVitest(mode: string, o: Record<string, unknown>): Promise<VitestInstanz> }} */ (
    await import(pathToFileURL(vitestNode).href)
  );
const v = await api.createVitest('test', {
  config: konfig,
  watch: false,
  run: true,
  globalSetup: [],
  reporters: [],
  passWithNoTests: true,
});
let code = 0;
try {
  const r = await v.collect(undefined, { staticParse: false });
  /** @type {{ name: string; file: string }[]} */
  const liste = [];
  for (const m of r.testModules) {
    // Ein Modul mit Lade- oder Sammelfehler liefert keine vollständige Liste (CR-E101-201, fail-closed).
    if (m.errors().length > 0 || m.state() === 'failed') code = 1;
    for (const t of m.children.allTests())
      liste.push({ name: t.fullName, file: t.module.moduleId });
  }
  writeFileSync(ausgabe, JSON.stringify(liste));
  if (r.unhandledErrors.length > 0) code = 1;
} catch {
  code = 1;
} finally {
  await v.close();
}
process.exit(code);
