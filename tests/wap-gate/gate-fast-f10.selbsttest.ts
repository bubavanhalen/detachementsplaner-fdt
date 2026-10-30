// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»; Härtung vor Gate B): übernommen aus dem Entwurf von
// E1-01d/E1-01e (Vertrag E1-01, Änderungsnotiz AE-001 §3), geprüft und an die Umsetzung angepasst.

// Schnelle Schleuse mit F10 (R-H-23 Kriterium 1, R-H-10; ADR-010 §3.1): neue Entwicklungs-Abhängigkeit mit
// GPL-Lizenz im package-lock eines Klons des Arbeitsstands → F10 rot mit name@version, F10 nach F9.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { testLast } from './support/last';
import {
  arbeitsstandKlon,
  aufraeumen,
  commitAlles,
  LANG,
  neueSandbox,
  node,
  prozessUmgebung,
  readText,
  sha256Lf,
  writeText,
} from './support/umgebung';
import { gate, schrittMit } from './support/vertrag';

afterEach(aufraeumen);

const REF_LOCK = 'docs/wap-planer/reference-lock.json';
const FIKTIVER_ANHANG = 'Mass;Wert\nRand;10\n';

describe('runGate fast: F10 Lizenzen (F-TOOLS)', () => {
  it(
    '[R-H-23][R-H-10] neue Abhängigkeit mit unzulässiger Lizenz → F10 rot, Ursache nennt name@version; F1–F9 laufen davor',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = arbeitsstandKlon(sb);
      // F-TOOLS3 (FT3-04): fiktive Referenz-Sperre wie gate-fast.selbsttest.ts (gesperrterKlon). Ohne sie ist
      // F2-referenz im Sandbox-Referenzordner rot und bricht die Schleuse vor F10 ab (ADR-010 §3).
      writeText(sb.referenceDir, 'anhaenge/zz-fiktiv.csv', FIKTIVER_ANHANG);
      writeText(
        k.root,
        REF_LOCK,
        `${JSON.stringify(
          { version: 1, files: { 'anhaenge/zz-fiktiv.csv': sha256Lf(FIKTIVER_ANHANG) } },
          null,
          2,
        )}\n`,
      );
      const r = node(
        join(k.root, 'scripts', 'wap', 'lock-update.mjs'),
        ['--grund', 'Testaufbau: fiktive Referenz-Sperre', '--refresh', REF_LOCK],
        { cwd: k.root, env: sb.env },
      );
      if (r.status !== 0) throw new Error(`Test-Aufbau: lock-update scheiterte: ${r.out}`);
      const lock = JSON.parse(readText(k.root, 'package-lock.json')) as {
        packages: Record<string, unknown>;
      };
      lock.packages['node_modules/zz-gpl-paket'] = {
        version: '1.0.0',
        resolved: 'https://registry.npmjs.org/zz-gpl-paket/-/zz-gpl-paket-1.0.0.tgz',
        integrity: 'sha512-AAAA',
        dev: true,
        license: 'GPL-3.0-only',
      };
      writeText(k.root, 'package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
      commitAlles(sb, k.root, 'GPL-Paket');
      const t = testLast(sb);
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: k.root, last: t.last });
      const f10 = schrittMit(e, 'F10');
      expect(f10?.ok).toBe(false);
      expect(f10?.ursache ?? '').toContain('zz-gpl-paket@1.0.0');
      const f9 = schrittMit(e, 'F9');
      expect(f9).toBeDefined();
      expect(e.schritte.indexOf(f9 as NonNullable<typeof f9>)).toBeLessThan(
        e.schritte.indexOf(f10 as NonNullable<typeof f10>),
      );
    },
    LANG,
  );
});
