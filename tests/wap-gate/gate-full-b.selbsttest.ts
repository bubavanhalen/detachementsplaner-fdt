// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): volle Schleuse im synthetischen Mini-Repo, Schritte von E1-01b.
// V4 (E2E über runE2e) und V5-ebene2 (PDF-Ebene 2 über checkPdfArtefakte) werden ausgeführt, in der
// Reihenfolge V3 < V4 < V5-ebene2 < V9, und sind bei eingebautem Verstoss rot (R-H-11). Die Schleuse
// leert test-results/wap/pdf vor dem ersten V1-Lauf und setzt WAP_PDF_ARTEFAKTE nur dort und in V4; allen
// anderen Kindprozessen entzieht sie die Variable (R-H-19).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §1, §2 (runE2e, checkPdfArtefakte, pdfArtefakt).
// Übernommen aus dem Entwurf gate-full-v.selbsttest.entwurf.ts, Teil V4 und V5-ebene2 (Vertrag E1-01b §3).
// Jeder direkte Aufruf von runGate speist `last` ein und entfernt WAP_GATE_SPERRE (AE-001 §2).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testLast } from './support/last';
import { miniRepo } from './support/mini';
import {
  aufraeumen,
  commitAlles,
  git,
  neueSandbox,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  SEHR_LANG,
  schrittText,
  writeText,
} from './support/umgebung';
import { type GateErgebnis, gate } from './support/vertrag';
import { testPdf } from './support/vertrag-b';

afterEach(aufraeumen);

function index(e: GateErgebnis, nummer: string): number {
  const re = new RegExp(`^${nummer}(?![0-9a-z])`, 'i');
  return e.schritte.findIndex((s) => re.test(s.id));
}

/** Mini-Repo auf wap/x mit node_modules (keine Schleusen-Tests darin, daher keine Rekursion über V1a). */
function mini(sb: Sandbox): string {
  prozessUmgebung(sb);
  const root = miniRepo(sb, 'mini', 'wap-planer');
  git(sb, root, 'checkout', '-q', '-b', 'wap/x');
  nodeModules(root);
  return root;
}

describe('runGate full im Mini-Repo: V4 und V5-ebene2 (E1-01b)', () => {
  it(
    '[R-H-11] V4 und V5-ebene2 ausgeführt, Reihenfolge V3 < V4 < V5-ebene2 < V9; V4 rot bei rotem E2E-Test mit Ursache und nächstem Schritt',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      writeText(
        root,
        'playwright.wap.config.ts',
        [
          'export default {',
          "  testDir: 'tests/wap-e2e',",
          '  retries: 0,',
          '  forbidOnly: true,',
          "  outputDir: 'test-results/wap/playwright-ausgabe',",
          "  reporter: [['json', { outputFile: 'test-results/wap/playwright.json' }]],",
          "  projects: [{ name: 'edge' }],",
          '};',
          '',
        ].join('\n'),
      );
      writeText(
        root,
        'tests/wap-e2e/rot.spec.ts',
        "import { expect, test } from '@playwright/test';\n\ntest('[R-1-01] eingebauter Verstoss', () => {\n  expect(1).toBe(2);\n});\n",
      );
      commitAlles(sb, root, 'Roter E2E-Test');
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      const v4 = e.schritte.find((s) => /^V4(?![0-9a-z])/i.test(s.id));
      expect(v4, 'Schritt V4 fehlt').toBeDefined();
      expect(v4?.ok).toBe(false);
      expect((v4?.ursache ?? '').length).toBeGreaterThan(0);
      expect((v4?.naechsterSchritt ?? '').length).toBeGreaterThan(0);
      expect(
        e.schritte.some((s) => s.id === 'V5-ebene2'),
        'Schritt V5-ebene2 fehlt',
      ).toBe(true);
      expect(e.ok).toBe(false);
      const [v3, i4, i5, v9] = [
        index(e, 'V3'),
        index(e, 'V4'),
        e.schritte.findIndex((s) => s.id === 'V5-ebene2'),
        index(e, 'V9'),
      ];
      expect(v3).toBeGreaterThanOrEqual(0);
      expect(
        v3 < i4 && i4 < i5 && i5 < v9,
        `Reihenfolge V3 ${String(v3)}, V4 ${String(i4)}, V5-ebene2 ${String(i5)}, V9 ${String(v9)}`,
      ).toBe(true);
    },
    SEHR_LANG,
  );

  it(
    '[R-H-19][R-H-11] V5-ebene2 prüft die PDF aus V1 und V4: Ordner vor V1 geleert; WAP_PDF_ARTEFAKTE nur im ersten V1-Lauf und in V4, entzogen in F8, den Zeitzonen-Läufen und V3; 4-pt-PDF → V5-ebene2 rot mit beiden Dateien',
    async () => {
      const sb = neueSandbox();
      const root = mini(sb);
      const quelle = writeText(
        sb.base,
        'vier.pdf',
        await testPdf({ groessePt: 4, eingebettet: true }),
      );
      const protokoll = join(sb.base, 'umgebung.txt');
      const zeile = (wer: string) =>
        `appendFileSync(${JSON.stringify(protokoll)}, ${JSON.stringify(wer)} + '|' + (process.env.TZ ?? '-') + '|' + (process.env.WAP_PDF_ARTEFAKTE ?? '-') + '\\n');`;
      const kopie = (name: string) =>
        `const ziel = process.env.WAP_PDF_ARTEFAKTE;\n  if (ziel) {\n    mkdirSync(ziel, { recursive: true });\n    copyFileSync(${JSON.stringify(quelle)}, join(ziel, ${JSON.stringify(name)}));\n  }`;
      const KOPF =
        "import { appendFileSync, copyFileSync, mkdirSync } from 'node:fs';\nimport { join } from 'node:path';\n";
      writeText(
        root,
        'vitest.wap.config.ts',
        "export default { test: { include: ['tests/wap/**/*.test.ts'], environment: 'node', retry: 0 } };\n",
      );
      writeText(
        root,
        'tests/wap/unit/erzeugt.test.ts',
        `// @vitest-environment node\n${KOPF}import { expect, it } from 'vitest';\n\nit('[R-1-01] erzeugt ein PDF', () => {\n  ${zeile('vitest')}\n  ${kopie('v1-4pt.pdf')}\n  expect(1).toBe(1);\n});\n`,
      );
      writeText(
        root,
        'vitest.wap-reference.config.ts',
        "export default { test: { include: ['tests/wap/reference/**/*.ref.ts'], environment: 'node', retry: 0 } };\n",
      );
      writeText(
        root,
        'tests/wap/reference/required-files.json',
        `${JSON.stringify({ version: 1, dateien: ['anhaenge/zz-mini-fiktiv.csv'] }, null, 2)}\n`,
      );
      writeText(
        root,
        'tests/wap/reference/umgebung.ref.ts',
        `// @vitest-environment node\n${KOPF}import { expect, it } from 'vitest';\n\nit('[R-1-02] Referenz', () => {\n  ${zeile('v3')}\n  ${kopie('v3-4pt.pdf')}\n  expect(1).toBe(1);\n});\n`,
      );
      writeText(
        root,
        'playwright.wap.config.ts',
        [
          'export default {',
          "  testDir: 'tests/wap-e2e',",
          '  retries: 0,',
          '  forbidOnly: true,',
          "  outputDir: 'test-results/wap/playwright-ausgabe',",
          "  reporter: [['json', { outputFile: 'test-results/wap/playwright.json' }]],",
          "  projects: [{ name: 'edge' }],",
          '};',
          '',
        ].join('\n'),
      );
      writeText(
        root,
        'tests/wap-e2e/erzeugt.spec.ts',
        `${KOPF}import { expect, test } from '@playwright/test';\n\ntest('[R-1-03] erzeugt ein PDF', () => {\n  ${zeile('v4')}\n  ${kopie('v4-4pt.pdf')}\n  expect(1).toBe(1);\n});\n`,
      );
      commitAlles(sb, root, 'Erzeugende Tests');
      writeText(root, 'test-results/wap/pdf/alt-4pt.pdf', readFileSync(quelle));
      // Eine fremde Variable im Prozess der Schleuse darf in keinem Kindprozess ankommen.
      vi.stubEnv('WAP_PDF_ARTEFAKTE', join(sb.base, 'fremd'));

      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });

      const v4 = e.schritte.find((s) => /^V4(?![0-9a-z])/i.test(s.id));
      expect(v4, 'Schritt V4 fehlt').toBeDefined();
      expect(v4?.ok, schrittText(v4 ?? {})).toBe(true);
      const v5 = e.schritte.find((s) => s.id === 'V5-ebene2');
      expect(v5, 'Schritt V5-ebene2 fehlt').toBeDefined();
      expect(v5?.ok).toBe(false);
      expect(v5?.ursache ?? '').toContain('Schrift unter Mindestgrösse');
      expect(v5?.ursache ?? '').toContain('v1-4pt.pdf');
      expect(v5?.ursache ?? '').toContain('v4-4pt.pdf');
      expect(v5?.ursache ?? '').not.toContain('alt-4pt.pdf');
      expect(v5?.ursache ?? '').not.toContain('v3-4pt.pdf');
      expect(index(e, 'V1')).toBeLessThan(e.schritte.indexOf(v5 as NonNullable<typeof v5>));
      expect(index(e, 'V4')).toBeLessThan(e.schritte.indexOf(v5 as NonNullable<typeof v5>));

      const ordner = join(root, 'test-results', 'wap', 'pdf').toLowerCase();
      expect(existsSync(protokoll), 'kein erzeugender Test lief').toBe(true);
      const zeilen = readFileSync(protokoll, 'utf8')
        .split('\n')
        .filter((z) => z !== '')
        .map((z) => z.split('|') as [string, string, string]);
      expect(
        zeilen.some(([, , w]) => w.toLowerCase().includes('fremd')),
        'fremde Variable durchgereicht',
      ).toBe(false);
      const vitestMit = zeilen.filter(([wer, , w]) => wer === 'vitest' && w !== '-');
      expect(vitestMit, 'genau ein Vitest-Lauf mit WAP_PDF_ARTEFAKTE').toHaveLength(1);
      expect(vitestMit[0]?.[2].toLowerCase()).toBe(ordner);
      expect(['UTC', 'America/New_York']).not.toContain(vitestMit[0]?.[1]);
      const zeitzonen = zeilen.filter(
        ([wer, tz]) => wer === 'vitest' && (tz === 'UTC' || tz === 'America/New_York'),
      );
      expect(zeitzonen.length, 'Zeitzonen-Läufe von V1').toBe(2);
      for (const [, tz, w] of zeitzonen) expect(w, tz).toBe('-');
      const v3 = zeilen.filter(([wer]) => wer === 'v3');
      expect(v3.length, 'Referenztest lief nicht').toBeGreaterThan(0);
      for (const [, , w] of v3) expect(w).toBe('-');
      const v4Zeilen = zeilen.filter(([wer]) => wer === 'v4');
      expect(v4Zeilen.length, 'E2E-Test lief nicht').toBeGreaterThan(0);
      for (const [, , w] of v4Zeilen) expect(w.toLowerCase()).toBe(ordner);
    },
    SEHR_LANG,
  );
});

/** Fiktives laufendes Paket der Rot-Phase (Kästchen 7 offen) mit einer ID. */
const ROT_PAKET = 'P9';
const ROT_ID = 'R-9-99';

/**
 * Mini-Repo auf wap/p9 in der Rot-Phase (ADR-010 §3.3): Plan-Anhang A, Paket-Checkliste ohne Kästchen 6/7,
 * Vertrag mit Stub-Namen, Playwright-Konfiguration ohne Browser-Fixtures und eine Spezifikation.
 */
function rotPhaseRepo(sb: Sandbox, spezifikation: string): string {
  prozessUmgebung(sb);
  const root = miniRepo(sb, 'rotphase', 'wap-planer');
  git(sb, root, 'checkout', '-q', '-b', `wap/${ROT_PAKET.toLowerCase()}`);
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
  writeText(
    root,
    'playwright.wap.config.ts',
    [
      'export default {',
      "  testDir: 'tests/wap-e2e',",
      '  retries: 0,',
      '  forbidOnly: true,',
      "  outputDir: 'test-results/wap/playwright-ausgabe',",
      "  reporter: [['json', { outputFile: 'test-results/wap/playwright.json' }]],",
      "  projects: [{ name: 'edge' }],",
      '};',
      '',
    ].join('\n'),
  );
  writeText(root, 'tests/wap-e2e/rotphase.spec.ts', spezifikation);
  nodeModules(root);
  commitAlles(sb, root, 'Rot-Phase P9');
  return root;
}

function v4Schritt(e: GateErgebnis) {
  const v4 = e.schritte.find((s) => /^V4(?![0-9a-z])/i.test(s.id));
  expect(v4, 'Schritt V4 fehlt').toBeDefined();
  return v4 as NonNullable<typeof v4>;
}

describe('V4 in der Rot-Phase auf wap/<paket> (Notiz Runde 2 Nr 8)', () => {
  it(
    '[R-H-11] Test mit Paket-ID scheitert an einer Assertion → V4 fachlich rot, Schritt ok',
    async () => {
      const sb = neueSandbox();
      const root = rotPhaseRepo(
        sb,
        `import { expect, test } from '@playwright/test';\n\ntest('[${ROT_ID}] fachlich rot', () => {\n  expect(1).toBe(2);\n});\n`,
      );
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      expect(e.paket).toBe(ROT_PAKET.toLowerCase());
      const v4 = v4Schritt(e);
      expect(v4.ok, schrittText(v4)).toBe(true);
    },
    SEHR_LANG,
  );

  it(
    '[R-H-11] derselbe Test scheitert an einem Importfehler → V4 rot mit Ursache',
    async () => {
      const sb = neueSandbox();
      const root = rotPhaseRepo(
        sb,
        `import { expect, test } from '@playwright/test';\nimport { gibtEsNicht } from './gibt-es-nicht';\n\ntest('[${ROT_ID}] fachlich rot', () => {\n  expect(gibtEsNicht).toBe(2);\n});\n`,
      );
      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: testLast(sb).last });
      const v4 = v4Schritt(e);
      expect(v4.ok).toBe(false);
      expect((v4.ursache ?? '').length).toBeGreaterThan(0);
    },
    SEHR_LANG,
  );
});
