// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»): Aufnahme-Befehl der Golden-Bilder Ebene 3 (R-H-20, Prompt
// §5.2 Schritt 8, ADR-010 §7.3) im Klon des Arbeitsstands: «node scripts/wap-gate/golden-aufnahme.mjs --grund …»
// rendert alle Kandidaten, legt die Baselines ab und trägt sie mit Status «vorläufig», SHA-256, Anforderungen,
// Grund und Commit ins Manifest ein; der Bericht Vorher/Nachher/Differenz gegen HEAD nennt sie «neu»; danach ist
// der Golden-Lauf grün, und ein zweiter Aufnahme-Lauf ändert nichts (Bilder deterministisch).
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  arbeitsstandKlon,
  aufraeumen,
  commitAlles,
  LANG,
  lauf,
  neueSandbox,
  node,
  prozessUmgebung,
  sha256,
} from './support/umgebung';

afterEach(aufraeumen);

interface Bild {
  datei: string;
  sha256: string;
  status: string;
  anforderungen: string[];
  grund: string;
  commit: string;
}

describe('golden-aufnahme.mjs', () => {
  it(
    '[R-H-20] Aufnahme im Klon: Baselines «vorläufig» im Manifest, Bericht «neu», danach Golden-Lauf grün, zweite Aufnahme ohne Änderung',
    () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = arbeitsstandKlon(sb);
      // F-TOOLS3 (FT3-04): Seit der Erstaufnahme (20.10.2026) liegen Baselines im Repo; der Test stellt im Klon den
      // Stand vor der Erstaufnahme her (keine Baselines, leeres Manifest, committet), damit «neu» und der Grund
      // der Aufnahme geprüft bleiben.
      const goldenOrdner = join(k.root, 'tests', 'wap', 'golden');
      rmSync(join(goldenOrdner, 'baselines'), { recursive: true, force: true });
      const vorher = JSON.parse(readFileSync(join(goldenOrdner, 'manifest.json'), 'utf8')) as {
        bilder: Bild[];
      };
      writeFileSync(
        join(goldenOrdner, 'manifest.json'),
        `${JSON.stringify({ ...vorher, bilder: [] }, null, 2)}\n`,
      );
      commitAlles(sb, k.root, 'Stand vor der Erstaufnahme (Selbsttest)');
      const env = { ...sb.env, VITEST_MAX_WORKERS: '4' };
      const skript = join(k.root, 'scripts', 'wap-gate', 'golden-aufnahme.mjs');
      const r = node(skript, ['--grund', 'Selbsttest Aufnahme (fiktiv)'], {
        cwd: k.root,
        env,
        timeout: LANG,
      });
      expect(r.status, r.out).toBe(0);
      const m = JSON.parse(
        readFileSync(join(k.root, 'tests', 'wap', 'golden', 'manifest.json'), 'utf8'),
      ) as {
        bilder: Bild[];
      };
      expect(m.bilder.length).toBeGreaterThanOrEqual(4);
      for (const b of m.bilder) {
        expect(b.status).toBe('vorläufig');
        expect(b.grund).toBe('Selbsttest Aufnahme (fiktiv)');
        expect(b.anforderungen).toContain('R-H-20');
        expect(b.commit).toMatch(/^[0-9a-f]{7}$/);
        const datei = join(k.root, 'tests', 'wap', 'golden', ...b.datei.split('/'));
        expect(existsSync(datei), b.datei).toBe(true);
        expect(sha256(readFileSync(datei))).toBe(b.sha256);
      }
      const bericht = readFileSync(
        join(k.root, 'test-results', 'wap', 'golden', 'bericht', 'bericht.md'),
        'utf8',
      );
      expect(bericht).toContain('| baselines/kvk-woche-s1.png | neu |');
      const vitest = join(k.root, 'node_modules', 'vitest', 'vitest.mjs');
      const golden = lauf(process.execPath, [vitest, 'run', '-c', 'vitest.wap-golden.config.ts'], {
        cwd: k.root,
        env,
        timeout: LANG,
      });
      expect(golden.status, golden.out.slice(-1500)).toBe(0);
      const zweite = node(skript, ['--grund', 'zweiter Lauf'], { cwd: k.root, env, timeout: LANG });
      expect(zweite.status, zweite.out).toBe(0);
      expect(zweite.out).toContain('keine neuen oder geänderten Bilder');
    },
    LANG,
  );
});
