// Leistungs-Harness (R-H-22, PL0-13): baut tests/wap-perf/harness/ im Produktionsmodus.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.3: datenfreie Einzeldatei, Eintragsdateien
// werden im Browser alphabetisch und nacheinander registriert; leeres Register ist zulässig.

import { existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildEinzeldatei } from './einzeldatei.mjs';
import { ok, rot } from './lib/out.mjs';

/**
 * Baut das Harness und lädt jede Datei entries/<paket>.ts.
 * @param {{ cwd: string; outDir: string }} opts
 * @returns {Promise<import('./lib/types.mjs').Schritt>}
 */
export async function buildPerfHarness(opts) {
  const beginn = Date.now();
  const id = 'Leistungs-Harness';
  const cwd = resolve(opts.cwd),
    ziel = resolve(opts.outDir);
  const rel = relative(ziel, cwd);
  if (
    ziel === parse(ziel).root ||
    rel === '' ||
    (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`))
  )
    return {
      id,
      ok: false,
      ms: 0,
      ursache: 'Harness-Ziel darf weder Laufwerkswurzel noch Checkout oder dessen Vorfahr sein',
      naechsterSchritt: 'Ausgabepfad prüfen',
    };
  rmSync(ziel, { recursive: true, force: true });
  mkdirSync(ziel, { recursive: true });
  const ordner = join(cwd, 'tests/wap-perf/harness');
  const eintraege = existsSync(join(ordner, 'entries'))
    ? readdirSync(join(ordner, 'entries'))
        .filter((n) => n.endsWith('.ts'))
        .sort()
    : [];
  const s = await buildEinzeldatei({
    cwd,
    entry: join(ordner, 'index.ts'),
    outFile: join(ziel, 'index.html'),
    titel: 'WAP-Planer Leistungs-Harness',
  });
  if (!s.ok) return { ...s, id, ms: Date.now() - beginn };
  const fehlen = eintraege.filter(
    (name) => !s.module.some((m) => m.replaceAll('\\', '/').endsWith(`/entries/${name}`)),
  );
  if (fehlen.length > 0)
    return {
      id,
      ok: false,
      ms: Date.now() - beginn,
      ursache: `Eintragsdatei nicht gebündelt: ${fehlen.join(', ')}`,
      naechsterSchritt: 'Harness-Einstieg prüfen',
    };
  return { id, ok: true, ms: Date.now() - beginn, details: { eintraege } };
}

// CLI: Aufruf als Skript (Vertrag §2 «als Modul und als CLI nutzbar»).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const s = await buildPerfHarness({
    cwd: process.cwd(),
    outDir: join(process.cwd(), 'test-results/wap/perf-harness'),
  });
  if (s.ok) ok(s.id, s.ms);
  else rot(s.id, s.ursache ?? '', s.naechsterSchritt ?? '');
  process.exitCode = s.ok ? 0 : 1;
}
