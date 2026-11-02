// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17, Test mit npm run build): Die Einzeldatei der Build-Hilfe trägt
// dieselbe CSP wie die ausgelieferte Suite (R-H-11). Im Klon des Arbeitsstands: npm run build →
// dist/index.html; buildEinzeldatei mit einem fiktiven Einstieg → test-results/wap/einzeldatei/; beide
// CSP-Meta-Inhalte sind gleich und gleich suiteCsp(klon).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 (buildEinzeldatei, suiteCsp).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  LANG,
  lauf,
  neueSandbox,
  prozessUmgebung,
  schrittText,
  writeText,
} from './support/umgebung';
import {
  einzeldateiModul,
  harnessEinstieg,
  type JsdomKlasse,
  jsdomKlasse,
} from './support/vertrag-b';

afterEach(aufraeumen);

let JSDOM: JsdomKlasse;

beforeAll(async () => {
  JSDOM = await jsdomKlasse();
});

function csp(datei: string): string | null {
  return (
    new JSDOM(readFileSync(datei, 'utf8')).window.document
      .querySelector('meta[http-equiv="Content-Security-Policy"]')
      ?.getAttribute('content') ?? null
  );
}

describe('Einzeldatei und Suite-Build', () => {
  it(
    '[R-H-11] CSP der Einzeldatei = CSP von dist/index.html nach npm run build = suiteCsp(klon)',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = arbeitsstandKlon(sb);
      const einstieg = writeText(
        k.root,
        'tests/wap-e2e/harness/zz-csp-vergleich.tsx',
        harnessEinstieg('CSP-Vergleich'),
      );
      const aus = join(k.root, 'test-results', 'wap', 'einzeldatei', 'zz-csp-vergleich.html');
      const { buildEinzeldatei, suiteCsp } = await einzeldateiModul();
      const r = await buildEinzeldatei({
        cwd: k.root,
        entry: einstieg,
        outFile: aus,
        titel: 'CSP-Vergleich',
      });
      expect(r.ok, schrittText(r)).toBe(true);
      const npm = join(process.execPath, '..', 'node_modules', 'npm', 'bin', 'npm-cli.js');
      const b = lauf(process.execPath, [npm, 'run', 'build'], {
        cwd: k.root,
        env: sb.env,
        timeout: LANG,
      });
      expect(b.status, b.out).toBe(0);
      const suite = csp(join(k.root, 'dist', 'index.html'));
      expect(suite, 'dist/index.html ohne CSP').not.toBeNull();
      expect(csp(aus)).toBe(suite);
      expect(suiteCsp(k.root)).toBe(suite);
    },
    LANG,
  );
});
