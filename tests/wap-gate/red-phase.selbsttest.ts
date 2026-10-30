// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): Fälle unverändert aus der gleichnamigen .gate.ts
// verschoben, weil sie ganze Schleusen, Browser, Stryker oder einen Build starten.

// Rot-Phase auf wap/<paket> (ADR-010 §3.3, Entscheid E5): Tests mit IDs des laufenden Pakets müssen
// fachlich rot sein (Assertion-Fehler oder Vertrags-Stub-Fehler des Pakets), alle übrigen grün;
// Import-, Syntax-, Typ-/Referenz-, Aufbau- und Zeitüberschreitungsfehler sind rot.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (classifyRedPhase).
// Je Fehlerart ein echter JSON-Bericht von Vitest bzw. Playwright aus einem temporären Projekt.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  aufraeumen,
  lauf,
  MITTEL,
  neueSandbox,
  nodeModules,
  type Sandbox,
  schrittText,
  writeText,
} from './support/umgebung';
import { redPhase } from './support/vertrag';

afterEach(aufraeumen);

const PAKET = 'p9';
const ID = 'R-9-99';
const STUB = 'paket.modul.f';

/** Führt eine Playwright-Datei (Chromium) aus und liefert den Pfad des JSON-Berichts. */
function playwrightBericht(sb: Sandbox, name: string, inhalt: string): string {
  const root = join(sb.base, `pw-${name}`);
  const bericht = join(root, 'bericht.json');
  writeText(
    root,
    'playwright.config.mjs',
    `export default { testDir: '.', testMatch: '**/*.probe.ts', retries: 0, workers: 1, reporter: [['json', { outputFile: ${JSON.stringify(bericht)} }]] };\n`,
  );
  writeText(root, `${name}.probe.ts`, inhalt);
  nodeModules(root);
  lauf(
    process.execPath,
    [
      join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
      'test',
      '-c',
      join(root, 'playwright.config.mjs'),
    ],
    { cwd: root, env: sb.env, timeout: 180_000 },
  );
  expect(existsSync(bericht), 'Test-Aufbau: Playwright-Bericht fehlt').toBe(true);
  return bericht;
}

async function klassifiziere(berichte: string[]) {
  const { classifyRedPhase } = await redPhase();
  return classifyRedPhase({ berichte, paket: PAKET, paketIds: [ID], stubNamen: [STUB] });
}

describe('classifyRedPhase: fachlich rot (zulässig)', () => {
  it(
    '[R-H-12] Playwright-expect mit Wartezeit («Timed out … waiting for expect») bei Paket-ID → grün',
    async () => {
      const sb = neueSandbox();
      const b = playwrightBericht(
        sb,
        'pwexpect',
        `import { expect, test } from '@playwright/test';\n\ntest('[${ID}] text', async ({ page }) => {\n  await page.setContent('<p>a</p>');\n  await expect(page.locator('p')).toHaveText('b', { timeout: 300 });\n});\n`,
      );
      expect((await klassifiziere([b])).ok).toBe(true);
    },
    MITTEL,
  );
});

describe('classifyRedPhase: nicht fachlich rot → Schleuse rot', () => {
  it(
    '[R-H-12] Playwright-Testzeitüberschreitung (ganzer Test) bei Paket-ID → rot',
    async () => {
      const sb = neueSandbox();
      const b = playwrightBericht(
        sb,
        'pwzeit',
        `import { test } from '@playwright/test';\n\ntest('[${ID}] dauer', async () => {\n  test.setTimeout(300);\n  await new Promise((r) => setTimeout(r, 3000));\n});\n`,
      );
      const r = await klassifiziere([b]);
      expect(r.ok).toBe(false);
      expect(schrittText(r)).toContain('dauer');
    },
    MITTEL,
  );
});
