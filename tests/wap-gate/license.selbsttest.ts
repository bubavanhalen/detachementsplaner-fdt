// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): Fälle unverändert aus der gleichnamigen .gate.ts
// verschoben, weil sie ganze Schleusen, Browser, Stryker oder einen Build starten.

// Lizenzprüfung (ADR-010 §9): F10 checkLicenses (Kriterium 1: neue Abhängigkeiten nur MIT, Apache-2.0,
// BSD, ISC, 0BSD; Schriften OFL) und V10-lizenztexte checkBundledLicenses (Kriterium 2: Lizenztexte aller
// gebündelten Laufzeit-Abhängigkeiten und Schriften in der Einzeldatei).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (checkLicenses, checkBundledLicenses), §6d (1)–(11).
// Fiktive Pakete und eine fiktive Schrift in temporären Ordnern; Fall (11) baut im Klon des
// Arbeitsstands (das dist/ des Paket-Worktrees bleibt unberührt).
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  LANG,
  neueSandbox,
  node,
  prozessUmgebung,
  writeText,
} from './support/umgebung';
import { license } from './support/vertrag';

afterEach(aufraeumen);

describe('checkBundledLicenses (V10-lizenztexte, §6d)', () => {
  it(
    '[R-H-23] (11) echter Lauf ohne modulIds nach dem Build (Klon des Arbeitsstands): grün mit react, react-dom und WK Util Suite; Gegenprobe an einer Kopie von dist ohne react-dom-Block → rot',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = arbeitsstandKlon(sb);
      const build = node(join(k.root, 'tools', 'build-offline.mjs'), [], {
        cwd: k.root,
        env: sb.env,
        timeout: LANG,
      });
      expect(
        build.status,
        `tools/build-offline.mjs im Klon gescheitert: ${build.out.slice(-800)}`,
      ).toBe(0);
      expect(existsSync(join(k.root, 'dist', 'index.html'))).toBe(true);
      const { checkBundledLicenses } = await license();
      const r = await checkBundledLicenses({ cwd: k.root });
      expect(r.fehlend).toEqual([]);
      expect(r.ok).toBe(true);
      const namen = r.erwartet.map((e) => e.name);
      expect(namen).toContain('react');
      expect(namen).toContain('react-dom');
      expect(namen).toContain('WK Util Suite');
      expect(r.erwartet.find((e) => e.name === 'WK Util Suite')?.quelle).toBe('app');

      // Gegenprobe: ganzen Block «react-dom\n<Text>» bis zum nächsten erwarteten Block bzw. bis </pre>
      // aus beiden Dateien entfernen.
      const andere = r.erwartet.map((e) => e.name).filter((n) => n !== 'react-dom');
      const kopie = join(sb.base, 'dist-kopie');
      cpSync(join(k.root, 'dist'), kopie, { recursive: true });
      for (const datei of ['index.html', 'offline.html']) {
        const text = readFileSync(join(kopie, datei), 'utf8');
        const start = text.indexOf('\n\nreact-dom\n');
        expect(start, 'Block react-dom im Build nicht gefunden').toBeGreaterThan(0);
        const kandidaten = [
          text.indexOf('</pre>', start),
          ...andere.map((n) =>
            text.indexOf(`\n\n${n.replaceAll('&', '&amp;').replaceAll('<', '&lt;')}\n`, start + 2),
          ),
        ].filter((i) => i > start);
        const ende = Math.min(...kandidaten);
        expect(Number.isFinite(ende), 'Ende des Blocks react-dom nicht gefunden').toBe(true);
        writeText(kopie, datei, `${text.slice(0, start)}${text.slice(ende)}`);
      }
      const gegen = await checkBundledLicenses({ cwd: k.root, distDir: kopie });
      expect(gegen.ok).toBe(false);
      expect(gegen.fehlend).toEqual(['react-dom']);
    },
    LANG,
  );
});
