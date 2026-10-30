// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17: startet einen Browser): Rot-Phase bei Playwright-Meldungen mit einem
// echten Playwright-Lauf (Playwright-Chromium, setContent; R-H-35, Befund E1-01-31). Fachlich rot sind expect mit
// eigener Meldung (toBe, toHaveText mit Wartezeit, expect.poll mit message); nicht fachlich rot bleiben ein
// schlichter Error, ein Error mit «Expected/Received»-Text und toPass um einen TypeError.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01c.md §2.6, §3 (red-phase-playwright.selbsttest.ts), §8.
// Synthetisches Projekt in der Sandbox (node_modules verknüpft), nur fiktive Seiten und Meldungen.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  MITTEL,
  neueSandbox,
  nodeModules,
  prozessUmgebung,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { kurz, playwrightLauf, pwErgebnisse, pwTest, redPhaseC } from './support/vertrag-c';

afterEach(aufraeumen);

const PAKET = 'P9';
const ID = 'R-9-99';

/** Playwright-Projekt in der Sandbox: Playwright-Chromium (ohne Kanal), JSON-Bericht über die Kommandozeile. */
function projekt(sb: Sandbox, spec: string): string {
  prozessUmgebung(sb);
  const root = join(sb.base, 'rotphase-pw');
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'fiktiv-rotphase', private: true, type: 'module' }, null, 2)}\n`,
  );
  writeText(
    root,
    'pw.config.ts',
    [
      'export default {',
      "  testDir: '.',",
      '  testMatch: /fiktiv\\.spec\\.ts$/,',
      '  retries: 0,',
      '  workers: 2,',
      "  outputDir: 'ausgabe',",
      "  use: { browserName: 'chromium', headless: true },",
      '};',
      '',
    ].join('\n'),
  );
  writeText(root, 'fiktiv.spec.ts', spec);
  nodeModules(root);
  return root;
}

const SEITE = '<html lang="de"><head><title>Fiktiv</title></head><body><p>Hallo</p></body></html>';

const ROT_SPEC = [
  "import { expect, test } from '@playwright/test';",
  '',
  `test('[${ID}] toBe mit Meldung', () => {`,
  "  expect(1, 'Meldung eins').toBe(2);",
  '});',
  '',
  `test('[${ID}] toHaveText mit Meldung', async ({ page }) => {`,
  `  await page.setContent(${JSON.stringify(SEITE)});`,
  "  await expect(page.locator('p'), 'Meldung drei').toHaveText('Welt', { timeout: 500 });",
  '});',
  '',
  `test('[${ID}] poll mit Meldung', async () => {`,
  "  await expect.poll(() => 1, { message: 'Meldung sechs', timeout: 500 }).toBe(2);",
  '});',
  '',
  "test('[R-1-01] fremd grün', () => {",
  '  expect(1).toBe(1);',
  '});',
  '',
].join('\n');

const GEGEN_SPEC = [
  "import { expect, test } from '@playwright/test';",
  '',
  `test('[${ID}] Error schlicht', () => {`,
  "  throw new Error('Meldung acht');",
  '});',
  '',
  `test('[${ID}] Error mit Expected-Text', () => {`,
  "  throw new Error('Meldung neun\\n\\nExpected: 2\\nReceived: 1');",
  '});',
  '',
  `test('[${ID}] toPass um TypeError', async () => {`,
  '  await expect(() => {',
  '    const o = null as unknown as { x(): void };',
  '    o.x();',
  "  }, 'Meldung g1').toPass({ timeout: 300 });",
  '});',
  '',
].join('\n');

describe('Rot-Phase mit einem echten Playwright-Lauf (Chromium, setContent)', () => {
  it(
    '[R-H-35][R-H-12] toBe, toHaveText und expect.poll je mit eigener Meldung → fachlich rot; classifyRedPhase → F8-rotphase grün',
    async () => {
      const sb = neueSandbox();
      const root = projekt(sb, ROT_SPEC);
      const l = playwrightLauf(sb, root, ['-c', 'pw.config.ts'], { name: 'rot', timeout: MITTEL });
      expect(l.status, kurz(l.out)).toBe(1);
      const erg = pwErgebnisse(l.bericht);
      const { fachlichRot, classifyRedPhase } = await redPhaseC();
      for (const titel of [
        `[${ID}] toBe mit Meldung`,
        `[${ID}] toHaveText mit Meldung`,
        `[${ID}] poll mit Meldung`,
      ]) {
        const t = pwTest(erg, titel);
        expect(t.status, titel).toBe('failed');
        expect(t.meldungen.length, titel).toBeGreaterThan(0);
        for (const m of t.meldungen) {
          expect(fachlichRot(`${m}\n`, []), `${titel}: ${kurz(m)}`).toBe(true);
        }
      }
      const r = classifyRedPhase({
        berichte: [l.bericht],
        paket: PAKET,
        paketIds: [ID],
        stubNamen: [],
      });
      expect(r.ok, schrittText(r)).toBe(true);
    },
    MITTEL,
  );

  it(
    '[R-H-12] Gegenfälle im echten Lauf: Error schlicht, Error mit Expected-Text und toPass um TypeError → nicht fachlich rot; classifyRedPhase rot mit allen drei',
    async () => {
      const sb = neueSandbox();
      const root = projekt(sb, GEGEN_SPEC);
      const l = playwrightLauf(sb, root, ['-c', 'pw.config.ts'], {
        name: 'gegen',
        timeout: MITTEL,
      });
      expect(l.status, kurz(l.out)).toBe(1);
      const erg = pwErgebnisse(l.bericht);
      const { fachlichRot, classifyRedPhase } = await redPhaseC();
      const titel = [
        `[${ID}] Error schlicht`,
        `[${ID}] Error mit Expected-Text`,
        `[${ID}] toPass um TypeError`,
      ];
      for (const n of titel) {
        const t = pwTest(erg, n);
        expect(t.status, n).toBe('failed');
        expect(
          t.meldungen.some((m) => fachlichRot(`${m}\n`, [])),
          `${n}: ${kurz(t.meldungen.join('\n'))}`,
        ).toBe(false);
      }
      const r = classifyRedPhase({
        berichte: [l.bericht],
        paket: PAKET,
        paketIds: [ID],
        stubNamen: [],
      });
      expect(r.ok).toBe(false);
      for (const n of titel) expect(schrittText(r)).toContain(n.slice(`[${ID}] `.length));
    },
    MITTEL,
  );
});
