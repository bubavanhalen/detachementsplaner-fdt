// Node-Prüfung der Playwright-Konfiguration (R-H-27, ADR-010 §3.1 F1; Vertrag E1-01 AE-001 §3 Restteil
// «Playwright-Konfiguration ohne Wiederholung, Node-Prüfung» [R-H-11][R-H-18][R-H-27]): playwright.wap.config.ts
// ruft beim Laden pruefeNode() auf und bricht unter Node 22 mit dem Hinweis auf 24.15.0 ab; unter dem
// laufenden Node 24 lädt sie.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01b.md §2 «playwright.wap.config.ts».
// Übernommen aus node-check-spaeter.gate.entwurf.ts, Teil E1-01b (Vertrag E1-01b §3).
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { arbeitsstandKlon, aufraeumen, lauf, MITTEL, neueSandbox, WT } from './support/umgebung';

afterEach(aufraeumen);

function node22(): string {
  const p = join(process.env.APPDATA ?? '', 'nvm', 'v22.19.0', 'node.exe');
  expect(existsSync(p), `Node 22 für den Selbsttest fehlt: ${p}`).toBe(true);
  return p;
}

function listeArgs(root: string): string[] {
  return [
    join(root, 'node_modules', '@playwright', 'test', 'cli.js'),
    'test',
    '-c',
    'playwright.wap.config.ts',
    '--list',
    '--pass-with-no-tests',
  ];
}

describe('playwright.wap.config.ts und die Node-Version', () => {
  it(
    '[R-H-11][R-H-18][R-H-27] unter Node 22 → Abbruch mit Hinweis 24.15.0; unter dem laufenden Node 24 → Liste ohne Fehler',
    () => {
      expect(
        existsSync(join(WT, 'playwright.wap.config.ts')),
        'playwright.wap.config.ts fehlt',
      ).toBe(true);
      const sb = neueSandbox();
      const k = arbeitsstandKlon(sb);
      const env = { ...sb.env, WAP_E2E_PORT: '9' };
      const alt = lauf(node22(), listeArgs(k.root), { cwd: k.root, env, timeout: MITTEL });
      expect(alt.status, 'playwright.wap.config.ts lief unter Node 22 durch').not.toBe(0);
      expect(alt.out).toContain('24.15.0');
      const aktuell = lauf(process.execPath, listeArgs(k.root), {
        cwd: k.root,
        env: sb.env,
        timeout: MITTEL,
      });
      expect(aktuell.status, aktuell.out).toBe(0);
      expect(aktuell.out).not.toContain('24.15.0');
    },
    MITTEL,
  );
});
