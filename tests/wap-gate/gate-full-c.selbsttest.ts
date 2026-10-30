// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): volle Schleuse im synthetischen Mini-Repo, Schritte von E1-01c.
// Nach V5 folgen V6-visual (runE2e chromium-visual), V7-perf (runE2e perf) und V7-vergleich (comparePerf mit
// regel prozent10oder2ms, messungen aus test-results/wap/perf.json nur, wenn V7-perf Tests ausgeführt hat).
// Pixelabweichung bzw. fehlende Baseline → V6 rot; Budget überschritten bzw. Drosselung nicht festgelegt →
// V7-vergleich rot; ohne Leistungstests und mit leerer Baseline beide V7-Schritte grün mit messgroessen 0.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.1 «gate.mjs full», §3 (gate-full-c.selbsttest.ts);
// übernommen aus dem Entwurf gate-full-v.selbsttest.entwurf.ts, Teil V6/V7. Jeder Aufruf von runGate speist
// `last` ein und entfernt WAP_GATE_SPERRE (AE-001 §2). Nur fiktive Inhalte.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import { miniRepo } from './support/mini';
import {
  aufraeumen,
  commitAlles,
  git,
  lauf,
  neueSandbox,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  SEHR_LANG,
  schrittText,
  writeText,
} from './support/umgebung';
import { type GateErgebnis, gate } from './support/vertrag';
import { FIKTIVE_APP_LIZENZ, fiktivesBuildSkript } from './support/vertrag-b';
import {
  BUDGETS,
  baselineJson,
  DROSSEL_MELDUNG,
  drosselungJson,
  FIKTIVER_PERF_EINSTIEG,
  type Messwert,
  perfDetails,
  pwKonfigC,
} from './support/vertrag-c';

afterEach(aufraeumen);

function bildSpec(farbe: string, id = 'R-1-01'): string {
  return [
    "import { expect, test } from '@playwright/test';",
    '',
    `test('[${id}] Bild fiktiv', async ({ page }) => {`,
    '  await page.setViewportSize({ width: 300, height: 200 });',
    `  await page.setContent('<html lang="de"><head><title>Fiktiv</title></head><body style="margin:0;background:#ffffff"><div style="width:200px;height:100px;background:${farbe}"></div></body></html>');`,
    "  await expect(page).toHaveScreenshot('zz-bild.png', { maxDiffPixels: 0, threshold: 0, animations: 'disabled' });",
    '});',
    '',
  ].join('\n');
}

function messSpec(m: Record<string, Messwert>): string {
  return [
    "import { mkdirSync, writeFileSync } from 'node:fs';",
    "import { join } from 'node:path';",
    "import { expect, test } from '@playwright/test';",
    '',
    "test('[R-1-02] Messung fiktiv', () => {",
    "  const ordner = join(process.cwd(), 'test-results', 'wap');",
    '  mkdirSync(ordner, { recursive: true });',
    `  writeFileSync(join(ordner, 'perf.json'), ${JSON.stringify(`${JSON.stringify({ messwerte: m }, null, 2)}\n`)});`,
    '  expect(1).toBe(1);',
    '});',
    '',
  ].join('\n');
}

/** Fiktives laufendes Paket der Rot-Phase (Kästchen 7 offen) mit einer ID (TR-E101c-04). */
const ROT_PAKET = 'P9';
const ROT_ID = 'R-9-99';

/** Leistungstest mit Paket-ID, der an einer Assertion bzw. einem TypeError scheitert. */
function rotMessSpec(art: 'assertion' | 'typeerror'): string {
  return [
    "import { expect, test } from '@playwright/test';",
    '',
    `test('[${ROT_ID}] Leistung fiktiv', () => {`,
    art === 'assertion'
      ? '  expect(1).toBe(2);'
      : '  const o = null as unknown as { x(): void };\n  o.x();',
    '});',
    '',
  ].join('\n');
}

/** Katalog, Plan-Anhang A, Checkliste (Kästchen 6 und 7 offen) und Vertrag mit Stub-Namen für ROT_PAKET. */
function rotPhaseDokumente(root: string): void {
  writeText(
    root,
    'docs/wap-planer/requirements.md',
    `# Anforderungskatalog (fiktiv)\n\n## 9 Test\n\n| ID | Stelle | Wortlaut | Et. | Prüfart | Abnahmekriterium | Beispiel (FDT 2026) |\n| --- | --- | --- | --- | --- | --- | --- |\n| ${ROT_ID} | 9 Test | Fiktive Anforderung. | 1 | Integration | Fiktives Kriterium | – |\n`,
  );
  writeText(
    root,
    'docs/wap-planer/plan/etappe-1.md',
    [
      '# Etappenplan 1 (fiktiv)',
      '',
      '## Anhang A – Zuordnung Katalog-IDs der Etappe 1 (maschinenlesbar)',
      '',
      '| ID | Paket | Testart | Verweis auf | Hinweis |',
      '| --- | --- | --- | --- | --- |',
      `| ${ROT_ID} | ${ROT_PAKET} | Integration | – | – |`,
      '',
      '## Anhang B – Vorgeschlagene Werkzeug- und Leitplanken-IDs (Etappe 1)',
      '',
      '| ID | Paket | Testart | Verweis auf | Hinweis |',
      '| --- | --- | --- | --- | --- |',
      '',
      '## Anhang C – Zählungen',
      '',
      'Keine.',
      '',
    ].join('\n'),
  );
  writeText(
    root,
    `docs/wap-planer/pakete/${ROT_PAKET}.md`,
    [
      `# Paket ${ROT_PAKET} – fiktiv`,
      '',
      '- Etappe: 1',
      `- Anforderungen: ${ROT_ID}`,
      '',
      '- [x] 1 Paket-Worktree angelegt und installiert',
      '- [x] 2 Schnittstellenvertrag und Stubs',
      '- [x] 3 Tests',
      '- [ ] 6 Test-Freeze',
      '- [ ] 7 Umsetzung',
      '',
    ].join('\n'),
  );
  writeText(
    root,
    `docs/wap-planer/plan/vertraege/${ROT_PAKET}.md`,
    '# Vertrag P9 (fiktiv)\n\n## Stub-Namen\n\n`fiktiv.modul.f`\n',
  );
}

/**
 * Mini-Repo auf wap/x mit Playwright-Konfiguration (edge, chromium-visual, perf), Build-Skript, fiktivem
 * Harness-Einstieg, Budgettabelle (Kopie), Drosselung und Baseline der Leistung.
 */
function mini(
  sb: Sandbox,
  o: { faktor: number | null; baseline: Record<string, Messwert>; rotPhase?: boolean },
): string {
  prozessUmgebung(sb);
  const root = miniRepo(sb, 'mini', 'wap-planer');
  git(
    sb,
    root,
    'checkout',
    '-q',
    '-b',
    o.rotPhase === true ? `wap/${ROT_PAKET.toLowerCase()}` : 'wap/x',
  );
  if (o.rotPhase === true) rotPhaseDokumente(root);
  writeText(root, 'LICENSE', FIKTIVE_APP_LIZENZ);
  writeText(root, 'tools/build-offline.mjs', fiktivesBuildSkript());
  writeText(root, 'playwright.wap.config.ts', pwKonfigC(['edge', 'chromium-visual', 'perf']));
  writeText(root, 'tests/wap-perf/harness/index.ts', FIKTIVER_PERF_EINSTIEG);
  writeText(root, 'docs/wap-planer/perf/budgets.json', readFileSync(BUDGETS, 'utf8'));
  writeText(root, 'docs/wap-planer/perf/drosselung.json', drosselungJson(o.faktor, 'festgelegt'));
  writeText(root, 'docs/wap-planer/perf/perf-baseline.json', baselineJson(o.baseline, 1.5));
  nodeModules(root);
  return root;
}

/** Erzeugt die Baseline des Bild-Tests im Mini-Repo (Playwright-Chromium, nur Test-Aufbau). */
function erzeugeBaseline(sb: Sandbox, root: string): void {
  const r = lauf(
    process.execPath,
    [
      join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      '-c',
      'playwright.wap.config.ts',
      '--project',
      'chromium-visual',
      '--update-snapshots=all',
    ],
    { cwd: root, env: sb.env, timeout: SEHR_LANG },
  );
  expect(r.status, `Test-Aufbau: Baseline nicht erzeugt: ${r.out.slice(-800)}`).toBe(0);
}

function schritt(e: GateErgebnis, id: string) {
  const s = e.schritte.find((x) => x.id === id);
  expect(s, `Schritt ${id} fehlt`).toBeDefined();
  return s as NonNullable<typeof s>;
}

describe('runGate full im Mini-Repo: V6-visual, V7-perf, V7-vergleich (E1-01c)', () => {
  it(
    '[R-H-21][R-H-22][R-H-11] V6-visual, V7-perf und V7-vergleich vorhanden, in dieser Reihenfolge nach V5; Pixelabweichung → V6 rot; Budget überschritten → V7-vergleich rot mit Messgrösse; Regel E7 a (Baseline 10 ms, Messung 11,9 ms) nicht gemeldet',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb, {
        faktor: 1.5,
        baseline: { wochenwechsel: { medianMs: 10, budgetMs: 300, anforderung: 'R-11-12' } },
      });
      writeText(root, 'tests/wap-e2e/bild.visual.spec.ts', bildSpec('#2d63b5'));
      erzeugeBaseline(sb, root);
      writeText(root, 'tests/wap-e2e/bild.visual.spec.ts', bildSpec('#2d63b6'));
      writeText(
        root,
        'tests/wap-perf/messung.perf.ts',
        messSpec({
          pdfWoche: { medianMs: 3001, budgetMs: 3000, anforderung: 'R-11-15' },
          wochenwechsel: { medianMs: 11.9, budgetMs: 300, anforderung: 'R-11-12' },
        }),
      );
      commitAlles(sb, root, 'Bild geändert, Messung über dem Budget');
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      const v6 = schritt(e, 'V6-visual');
      const v7 = schritt(e, 'V7-perf');
      const v7v = schritt(e, 'V7-vergleich');
      const i = (id: string) => e.schritte.findIndex((x) => x.id === id);
      const i5 = i('V5-ebene2');
      expect(i5).toBeGreaterThanOrEqual(0);
      expect(
        i5 < i('V6-visual') && i('V6-visual') < i('V7-perf') && i('V7-perf') < i('V7-vergleich'),
        `Reihenfolge V5-ebene2 ${String(i5)}, V6 ${String(i('V6-visual'))}, V7-perf ${String(i('V7-perf'))}, V7-vergleich ${String(i('V7-vergleich'))}`,
      ).toBe(true);
      expect(v6.ok).toBe(false);
      expect(v6.ursache ?? '').toContain('Bild fiktiv');
      expect((v6.naechsterSchritt ?? '').length).toBeGreaterThan(0);
      expect(v7.ok, schrittText(v7)).toBe(true);
      expect(v7v.ok).toBe(false);
      expect(v7v.ursache ?? '').toContain('pdfWoche');
      // Regel prozent10oder2ms (E7 a, TR-E101c-08 c): 11,9 ms gegen 10 ms ist keine Regression.
      expect(v7v.ursache ?? '').not.toContain('wochenwechsel');
      expect(e.ok).toBe(false);
    },
    SEHR_LANG,
  );

  it(
    '[R-H-21][R-H-22][R-H-11] fehlende Baseline → V6 rot «Baseline fehlt: 1 Kernzustände (Schritt 8)», nichts geschrieben; faktor null → V7-vergleich rot «Drosselungsfaktor nicht festgelegt (Umgebungsprobe ausstehend)»',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb, { faktor: null, baseline: {} });
      writeText(root, 'tests/wap-e2e/bild.visual.spec.ts', bildSpec('#2d63b5'));
      commitAlles(sb, root, 'Bild ohne Baseline, Drosselung offen');
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      const v6 = schritt(e, 'V6-visual');
      expect(v6.ok).toBe(false);
      expect(v6.ursache ?? '').toContain('Baseline fehlt: 1 Kernzustände (Schritt 8)');
      expect(
        git(sb, root, 'status', '--porcelain', '--', 'tests/wap-e2e'),
        'Baseline geschrieben',
      ).toBe('');
      const v7v = schritt(e, 'V7-vergleich');
      expect(v7v.ok).toBe(false);
      expect(v7v.ursache ?? '').toContain(DROSSEL_MELDUNG);
    },
    SEHR_LANG,
  );

  it(
    '[R-H-21][R-H-22][R-H-11] ohne Leistungstests und mit leerer Baseline → V7-perf und V7-vergleich grün, details.messgroessen 0; Bild unverändert → V6 grün',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb, { faktor: 1.5, baseline: {} });
      writeText(root, 'tests/wap-e2e/bild.visual.spec.ts', bildSpec('#2d63b5'));
      erzeugeBaseline(sb, root);
      commitAlles(sb, root, 'Bild mit Baseline, keine Leistungstests');
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      const v6 = schritt(e, 'V6-visual');
      expect(v6.ok, schrittText(v6)).toBe(true);
      const v7 = schritt(e, 'V7-perf');
      expect(v7.ok, schrittText(v7)).toBe(true);
      const v7v = schritt(e, 'V7-vergleich');
      expect(v7v.ok, schrittText(v7v)).toBe(true);
      expect(perfDetails(v7v).messgroessen).toBe(0);
    },
    SEHR_LANG,
  );
});

describe('runGate full in der Rot-Phase (wap/p9, Kästchen 7 offen; Orchestrator-Zeile 07.10.2026, TR-E101c-04)', () => {
  it(
    '[R-H-21][R-H-22][R-H-11] Bildtest mit Paket-ID und Pixelabweichung → V6 rot (ohne Rot-Phasen-Wertung); Leistungstest mit Paket-ID scheitert an einer Assertion → V7-perf ok (wie V4 gewertet)',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb, { faktor: 1.5, baseline: {}, rotPhase: true });
      writeText(root, 'tests/wap-e2e/bild.visual.spec.ts', bildSpec('#2d63b5', ROT_ID));
      erzeugeBaseline(sb, root);
      writeText(root, 'tests/wap-e2e/bild.visual.spec.ts', bildSpec('#2d63b6', ROT_ID));
      writeText(root, 'tests/wap-perf/messung.perf.ts', rotMessSpec('assertion'));
      commitAlles(sb, root, 'Rot-Phase: Bild geändert, Leistungstest fachlich rot');
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      expect(e.paket).toBe(ROT_PAKET.toLowerCase());
      const v6 = schritt(e, 'V6-visual');
      expect(v6.ok, 'V6 in der Rot-Phase wie fachlich rot gewertet').toBe(false);
      expect(v6.ursache ?? '').toContain('Bild fiktiv');
      const v7 = schritt(e, 'V7-perf');
      expect(v7.ok, schrittText(v7)).toBe(true);
    },
    SEHR_LANG,
  );

  it(
    '[R-H-22][R-H-11] Leistungstest mit Paket-ID scheitert an einem TypeError → V7-perf rot «nicht fachlich rot»',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb, { faktor: 1.5, baseline: {}, rotPhase: true });
      writeText(root, 'tests/wap-perf/messung.perf.ts', rotMessSpec('typeerror'));
      commitAlles(sb, root, 'Rot-Phase: Leistungstest mit TypeError');
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      expect(e.paket).toBe(ROT_PAKET.toLowerCase());
      const v7 = schritt(e, 'V7-perf');
      expect(v7.ok).toBe(false);
      expect(schrittText(v7)).toContain('nicht fachlich rot');
    },
    SEHR_LANG,
  );
});
