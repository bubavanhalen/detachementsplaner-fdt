// Läufer für test:reference (Prompt §5.6 «Referenzbasierte Tests bilden die Suite test:reference. Fehlt
// eine Datei, schlägt sie fehl, nie skip»; AE-001 §2 «Läufer für test:reference»; ADR-010 §3.2 V3, §4.5).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §1 (test:reference), §3 (vitest.wap-reference.config.ts:
// globalSetup prüft WAP_REFERENCE_DIR und jede in tests/wap/reference/required-files.json genannte Datei)
// und Änderungsnotiz AE-001 §4 Nr 6 (Format der Liste, Positivfall mit temporärem WAP_REFERENCE_DIR).
// Läufe im Klon des Arbeitsstands; WAP_REFERENCE_DIR zeigt nie auf den echten Ordner reference/, sondern
// fehlt bzw. zeigt auf einen leeren Testordner. Ausgaben werden nur auf Stichwörter geprüft und nie in
// Meldungen übernommen (sie könnten Dateinamen der Referenzliste enthalten, agent-regeln 3).
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  lauf,
  MITTEL,
  neueSandbox,
  type Sandbox,
  WT,
  writeText,
} from './support/umgebung';

afterEach(aufraeumen);

const PROBE = 'tests/wap/reference/zz-probe.ref.ts';

function klonMitProbe(sb: Sandbox): string {
  const k = arbeitsstandKlon(sb);
  writeText(
    k.root,
    PROBE,
    "// @vitest-environment node\nimport { expect, it } from 'vitest';\n\nit('[R-H-28] probe', () => {\n  expect(1).toBe(1);\n});\n",
  );
  expect(existsSync(join(k.root, 'vitest.wap-reference.config.ts')), 'Konfiguration fehlt').toBe(
    true,
  );
  return k.root;
}

/** Ersetzt im Klon tests/wap/reference/required-files.json (Format Vertrag AE-001 §4 Nr 6). */
function liste(root: string, dateien: string[]): void {
  writeText(
    root,
    'tests/wap/reference/required-files.json',
    `${JSON.stringify({ version: 1, dateien }, null, 2)}\n`,
  );
}

/** nur: Dateifilter (TE-FT-01: im Positivfall nur die Probe, nicht die später hinzugekommenen echten Referenztests). */
function referenzlauf(sb: Sandbox, root: string, referenceDir: string | undefined, nur?: string) {
  const env: NodeJS.ProcessEnv = { ...sb.env, VITEST_MAX_WORKERS: '4' };
  delete env.WAP_REFERENCE_DIR;
  if (referenceDir !== undefined) env.WAP_REFERENCE_DIR = referenceDir;
  return lauf(
    process.execPath,
    [
      join(root, 'node_modules', 'vitest', 'vitest.mjs'),
      'run',
      '-c',
      'vitest.wap-reference.config.ts',
      ...(nur === undefined ? [] : [nur]),
    ],
    { cwd: root, env, timeout: MITTEL },
  );
}

describe('test:reference (Vertrag §1, §3)', () => {
  it('[R-H-28] package.json: test:reference = vitest run -c vitest.wap-reference.config.ts; tests/wap/reference/required-files.json im Format { version 1, dateien: [relativ, «/», ohne «..», ohne Platzhalter] } und nicht leer (Vertrag AE-001 §4 Nr 6)', () => {
    const pkg = JSON.parse(readFileSync(join(WT, 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };
    expect(pkg.scripts?.['test:reference']).toBe('vitest run -c vitest.wap-reference.config.ts');
    const liste = join(WT, 'tests', 'wap', 'reference', 'required-files.json');
    expect(existsSync(liste), 'required-files.json fehlt').toBe(true);
    const daten = JSON.parse(readFileSync(liste, 'utf8')) as {
      version?: unknown;
      dateien?: unknown;
    };
    expect(daten.version).toBe(1);
    expect(Array.isArray(daten.dateien), 'dateien ist keine Liste').toBe(true);
    const dateien = daten.dateien as unknown[];
    expect(dateien.length).toBeGreaterThan(0);
    // Nur Form prüfen, die Dateinamen nie in Meldungen übernehmen (agent-regeln 3).
    const ungueltig = dateien.filter(
      (d) =>
        typeof d !== 'string' ||
        d.trim() === '' ||
        /^[A-Za-z]:|^[\\/]/.test(d) ||
        d.includes('\\') ||
        d.split('/').includes('..') ||
        /[<>]|TODO|platzhalter/i.test(d),
    ).length;
    expect(ungueltig, 'ungültige Einträge (Anzahl)').toBe(0);
  });

  it(
    '[R-H-28] Positivfall: required-files.json nennt eine fiktive Datei, temporärer WAP_REFERENCE_DIR enthält sie → Lauf grün, die Probe läuft',
    () => {
      const sb = neueSandbox();
      const root = klonMitProbe(sb);
      liste(root, ['anhaenge/fiktiv-a.csv']);
      const ref = join(sb.base, 'fiktive-referenz');
      writeText(ref, 'anhaenge/fiktiv-a.csv', 'Woche;Tag\n1;Mo\n');
      const r = referenzlauf(sb, root, ref, PROBE);
      expect(r.status, 'Lauf mit vorhandener Referenzdatei gescheitert').toBe(0);
      expect(/\b1 passed\b/.test(r.out), 'Probe lief nicht').toBe(true);
    },
    MITTEL,
  );

  it.each([
    ['absoluter Pfad einer vorhandenen Datei', 'absolut'],
    ['Pfad mit .. auf eine vorhandene Datei', 'oben'],
  ])(
    '[R-H-28] required-files.json mit ungültigem Eintrag (%s) → Lauf rot, obwohl die Datei vorhanden ist (TR-E101-07)',
    (_name, art) => {
      const sb = neueSandbox();
      const root = klonMitProbe(sb);
      const ref = join(sb.base, 'ref', 'innen');
      writeText(ref, 'anhaenge/fiktiv-a.csv', 'Woche;Tag\n1;Mo\n');
      const aussen = writeText(join(sb.base, 'ref'), 'ausserhalb/anhang.csv', 'x\n');
      expect(existsSync(aussen)).toBe(true);
      const eintrag = art === 'absolut' ? aussen.replace(/\\/g, '/') : '../ausserhalb/anhang.csv';
      liste(root, ['anhaenge/fiktiv-a.csv', eintrag]);
      const r = referenzlauf(sb, root, ref);
      expect(r.status !== 0, 'Lauf mit ungültigem Eintrag bestanden').toBe(true);
      expect(/\b1 passed\b/.test(r.out), 'Probe lief trotzdem').toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-28] required-files.json mit leerer Liste → Lauf rot',
    () => {
      const sb = neueSandbox();
      const root = klonMitProbe(sb);
      liste(root, []);
      const ref = join(sb.base, 'fiktive-referenz');
      writeText(ref, 'anhaenge/fiktiv-a.csv', 'Woche;Tag\n1;Mo\n');
      const r = referenzlauf(sb, root, ref);
      expect(r.status !== 0, 'Lauf mit leerer Liste bestanden').toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-28] WAP_REFERENCE_DIR nicht gesetzt → Lauf scheitert (Exit ≠ 0) mit Hinweis auf WAP_REFERENCE_DIR, kein Test als bestanden oder übersprungen',
    () => {
      const sb = neueSandbox();
      const root = klonMitProbe(sb);
      const r = referenzlauf(sb, root, undefined);
      expect(r.status !== 0, 'Lauf ohne WAP_REFERENCE_DIR bestanden').toBe(true);
      expect(r.out.includes('WAP_REFERENCE_DIR'), 'Meldung nennt WAP_REFERENCE_DIR nicht').toBe(
        true,
      );
      expect(/\b1 passed\b/.test(r.out), 'Probe lief trotzdem').toBe(false);
      expect(/\bskipped\b/i.test(r.out), 'Test als übersprungen gemeldet').toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-28] WAP_REFERENCE_DIR zeigt auf einen leeren Ordner (verlangte Dateien fehlen) → Lauf scheitert mit «fehlt», nie «skip»',
    () => {
      const sb = neueSandbox();
      const root = klonMitProbe(sb);
      const leer = join(sb.base, 'leere-referenz');
      mkdirSync(leer, { recursive: true });
      const r = referenzlauf(sb, root, leer);
      expect(r.status !== 0, 'Lauf mit fehlenden Referenzdateien bestanden').toBe(true);
      expect(r.out.includes('fehlt'), 'Meldung nennt «fehlt» nicht').toBe(true);
      expect(/\b1 passed\b/.test(r.out), 'Probe lief trotzdem').toBe(false);
      expect(/\bskipped\b/i.test(r.out), 'Test als übersprungen gemeldet').toBe(false);
    },
    MITTEL,
  );

  it(
    '[R-H-28] WAP_REFERENCE_DIR zeigt auf einen nicht vorhandenen Ordner → Lauf scheitert',
    () => {
      const sb = neueSandbox();
      const root = klonMitProbe(sb);
      const r = referenzlauf(sb, root, join(sb.base, 'gibt-es-nicht'));
      expect(r.status !== 0, 'Lauf mit fehlendem Referenzordner bestanden').toBe(true);
      expect(/\b1 passed\b/.test(r.out), 'Probe lief trotzdem').toBe(false);
    },
    MITTEL,
  );
});
