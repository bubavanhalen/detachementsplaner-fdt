// Paket F-TOOLS3, Auftrag 3 (Koordinator 23.10.2026, Befund FT3-03; R-H-16, ADR-010 §6.2): Die WAP-Werkzeuge unter
// tools/wap/** gehören zur Pfadmenge «übriger WAP-Code», ihre Tests liegen aber in der Gate-Konfiguration
// (npm-lizenz.gate.ts). coverage-check.mjs misst sie in einem zweiten Lauf (messeWerkzeuge, nur tools/wap/**) und
// führt den Datensatz je Zweigort mit Vitest und E2E zusammen. Fiktives Mini-Repo mit fiktivem Werkzeug.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { aufraeumen, junction, ladeModul, neueSandbox, WT, writeText } from './support/umgebung';

afterEach(aufraeumen);

interface WerkzeugModul {
  WERKZEUG_MESSUNG: {
    konfig: string;
    tests: readonly string[];
    muster: string;
    ordner: string;
  };
  WERKZEUG_ISTANBUL: string;
  messeWerkzeuge(opts: {
    cwd: string;
    env?: Record<string, string>;
  }): Promise<
    { ok: true; datei: string | null } | { ok: false; ursache: string; naechsterSchritt: string }
  >;
}

const modul = () => ladeModul<WerkzeugModul>('scripts/wap-gate/coverage-check.mjs');

/** Fiktives Werkzeug mit zwei Zweigorten (if/else), der Test nimmt nur den ersten Zweig. */
const WERKZEUG = 'export function stufe(n) {\n  if (n > 0) return 1;\n  return 0;\n}\n';

/** Mini-Repo mit der Werkzeug-Testdatei am gelisteten Pfad, eigener Vitest-Konfiguration und node_modules. */
async function miniRepo(
  konfig: string,
  testText?: string,
): Promise<{ root: string; env: Record<string, string> }> {
  const sb = neueSandbox();
  const { WERKZEUG_MESSUNG } = await modul();
  const root = join(sb.base, 'repo');
  junction(join(root, 'node_modules'), join(WT, 'node_modules'));
  writeText(root, 'tools/wap/zz-werkzeug.mjs', WERKZEUG);
  writeText(root, WERKZEUG_MESSUNG.konfig, konfig);
  const test = WERKZEUG_MESSUNG.tests[0] ?? '';
  writeText(
    root,
    test,
    testText ??
      [
        "import { expect, it } from 'vitest';",
        "import { stufe } from '../../tools/wap/zz-werkzeug.mjs';",
        '',
        "it('[R-H-16] fiktives Werkzeug', () => {",
        '  expect(stufe(5)).toBe(1);',
        '});',
        '',
      ].join('\n'),
  );
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(sb.env)) if (v !== undefined) env[k] = v;
  env.VITEST_MAX_WORKERS = '1';
  return { root, env };
}

const KONFIG =
  "export default { test: { include: ['tests/wap-gate/**/*.gate.ts'], environment: 'node', retry: 0 } };\n";

describe('coverage-check: Werkzeug-Messlauf tools/wap (FT3-03)', () => {
  it('[R-H-16] die gelisteten Werkzeugtests liegen in der Gate-Konfiguration; nach Gate-B-Entscheid 34c gehört das Muster zu keiner Pfadmenge, im Arbeitsbaum entfällt der Lauf', async () => {
    const { WERKZEUG_MESSUNG } = await modul();
    expect(existsSync(join(WT, WERKZEUG_MESSUNG.konfig))).toBe(true);
    expect(WERKZEUG_MESSUNG.tests.length).toBeGreaterThan(0);
    for (const t of WERKZEUG_MESSUNG.tests)
      expect(existsSync(join(WT, ...t.split('/'))), t).toBe(true);
    const schwellen = JSON.parse(
      readFileSync(join(WT, 'scripts', 'wap-gate', 'coverage-schwellen.json'), 'utf8'),
    ) as { mengen: { name: string; muster: string[] }[] };
    // Gate B 28.10.2026, Entscheid 34c: tools/wap/** ausserhalb der Pfadmengen → kein Werkzeug-Messlauf.
    expect(schwellen.mengen.some((m) => m.muster.includes(WERKZEUG_MESSUNG.muster))).toBe(false);
    const { messeWerkzeuge } = await modul();
    expect(await messeWerkzeuge({ cwd: WT })).toEqual({ ok: true, datei: null });
  });

  it('[R-H-16] Mini-Repo: Werkzeugtest deckt einen von zwei Zweigorten → Datensatz nur mit tools/wap, Zweig ungedeckt bleibt sichtbar', async () => {
    const { messeWerkzeuge, WERKZEUG_ISTANBUL } = await modul();
    const { root, env } = await miniRepo(KONFIG);
    const r = await messeWerkzeuge({ cwd: root, env });
    expect(r.ok, JSON.stringify(r)).toBe(true);
    if (!r.ok) return;
    expect(r.datei).toBe(join(root, ...WERKZEUG_ISTANBUL.split('/')));
    const daten = JSON.parse(readFileSync(r.datei ?? '', 'utf8')) as Record<
      string,
      { b: Record<string, number[]> }
    >;
    const dateien = Object.keys(daten).map((d) => d.replace(/\\/g, '/'));
    expect(dateien.every((d) => d.includes('/tools/wap/'))).toBe(true);
    const eintrag = Object.entries(daten).find(([d]) =>
      d.replace(/\\/g, '/').endsWith('tools/wap/zz-werkzeug.mjs'),
    );
    const zweige = Object.values(eintrag?.[1].b ?? {}).flat();
    expect(zweige.length).toBe(2);
    expect(zweige.filter((n) => n > 0).length).toBe(1);
  });

  it('[R-H-16] Mini-Repo: Werkzeug-Messlauf ohne Datensatz (Konfiguration unlesbar) → rot mit Ursache und nächstem Schritt', async () => {
    const { messeWerkzeuge } = await modul();
    const { root, env } = await miniRepo('export default {\n');
    const r = await messeWerkzeuge({ cwd: root, env });
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.ursache).toContain('Werkzeug-Messlauf ohne Abdeckungsdaten');
    expect(r.naechsterSchritt).toContain('--coverage.enabled=true');
  });

  it('[R-H-16] Mini-Repo ohne die Werkzeugtests → kein Datensatz, kein Rot (Schleusen-Tests ohne Werkzeuge)', async () => {
    const { messeWerkzeuge } = await modul();
    const sb = neueSandbox();
    const root = join(sb.base, 'leer');
    writeText(root, 'README.md', 'fiktiv\n');
    const r = await messeWerkzeuge({ cwd: root });
    expect(r).toEqual({ ok: true, datei: null });
  });
});
