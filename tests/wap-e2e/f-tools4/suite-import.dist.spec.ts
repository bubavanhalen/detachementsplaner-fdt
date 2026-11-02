// F-TOOLS4 in der gebauten Suite-Einzeldatei: tools/build-offline.mjs (wie npm run build, ohne Typprüfung) baut
// dist/offline.html; die Datei liegt für den Test unter test-results/wap/einzeldatei/suite-app.html (dort erlaubt die
// Vorrichtung file://) und wird unter #/wap geöffnet. Damit ist der Excel-Import in der Suite-Datei automatisch
// geprüft (FT3-02). Nur fiktive Daten.
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { einzeldateiUrl, test } from '../support/fixtures';
import { registerSuiteImportTests } from './support/suite-import';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// biome-ignore lint/correctness/noEmptyPattern: Playwright verlangt Objekt-Destrukturierung im ersten Hook-Parameter
test.beforeAll(async ({}, testInfo) => {
  testInfo.setTimeout(180_000);
  execFileSync(process.execPath, [join(WURZEL, 'tools', 'build-offline.mjs')], {
    cwd: WURZEL,
    stdio: 'pipe',
    timeout: 170_000,
  });
  const ziel = join(WURZEL, 'test-results', 'wap', 'einzeldatei');
  mkdirSync(ziel, { recursive: true });
  copyFileSync(join(WURZEL, 'dist', 'offline.html'), join(ziel, 'suite-app.html'));
});

registerSuiteImportTests(() => `${einzeldateiUrl('suite-app')}#/wap`, 'einzeldatei');
