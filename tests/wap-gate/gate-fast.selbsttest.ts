// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): ganze schnelle Schleuse im Klon des Arbeitsstands.
// E1-01-min (Vertrag E1-01, Änderungsnotiz AE-001 §1; ADR-010 Änderungsnotiz AE-001 §1): F1–F9 und
// F0-last; F10 (Lizenzen) kommt mit E1-01e (Entwurf gate-fast-f10.selbsttest.entwurf.ts).
// Jeder direkte Aufruf von runGate speist `last` ein (temporäres commonDir, keine fremden Prozesse,
// CPU-Last 0) und entfernt WAP_GATE_SPERRE (AE-001 §2).

// Schnelle Schleuse (ADR-010 §3.1): ein Befehl; F1–F9 in Reihenfolge; ohne Verstoss grün; je Schritt
// ein eingebauter Verstoss rot mit dem richtigen Grund; Node- und Lock-Prüfung brechen sofort ab;
// --pre-commit mit F0-arbeitsbaum ohne F2/Datenschutz-Scan; Ausgabeformat lib/out.mjs.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §1, §2 (runGate, ok, rot).
// Läufe in einem Klon des aktuellen Arbeitsstands (eigenes Repo, keine Hooks), Sperren wie nach dem
// Merge von E1-01-min (lock-update --add für scripts/wap-gate/**, Tests und Konfigurationen, ADR-010 §2).
import { copyFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { testLast } from './support/last';
import {
  ahvNummer,
  arbeitsstandKlon,
  aufraeumen,
  commitAlles,
  git,
  LANG,
  lauf,
  MITTEL,
  neueSandbox,
  node,
  prozessUmgebung,
  readText,
  type Sandbox,
  schrittText,
  sha256Lf,
  WT,
  wort,
  writeText,
} from './support/umgebung';
import { type GateErgebnis, gate, SCHRITT_ID, schrittMit } from './support/vertrag';

/** --pre-commit: F2 fehlt ganz, F3 nur als F3-deep (Vertrag §9 Nr 14). */
function preCommitSchritte(e: GateErgebnis): void {
  expect(e.schritte.some((s) => /^F2(?![0-9a-z])/i.test(s.id))).toBe(false);
  const f3 = e.schritte.filter((s) => /^F3(?![0-9a-z])/i.test(s.id)).map((s) => s.id);
  expect(f3).toEqual(['F3-deep']);
}

afterEach(aufraeumen);

const F_SCHRITTE = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9'];

/** Gesperrte Pfadmengen von E1-01-min nach dem Merge (ADR-010 §2, Vertrag §7 und AE-001). */
const SPERRMENGEN = [
  /^scripts\/wap-gate\//,
  /^tests\/wap-gate\//,
  /^tests\/wap\/support\/common\//,
  /^tests\/wap-harness\/pre-commit-gate\.harness\.ts$/,
  /^vitest\.wap[a-z-]*\.config\.ts$/,
  /^tsconfig\.wap\.json$/,
  /^docs\/wap-planer\/reference-lock\.json$/,
];

const REF_LOCK = 'docs/wap-planer/reference-lock.json';
const FIKTIVER_ANHANG = 'Mass;Wert\nRand;10\n';

/**
 * Klon mit gesperrten Schleusen-Dateien (Protokollzeile über lock-update, wie der Orchestrator) und einer
 * fiktiven Referenz-Sperre: Anhang anhaenge/zz-fiktiv.csv im Sandbox-Referenzordner (WAP_REFERENCE_DIR),
 * reference-lock.json im Klon mit dessen SHA-256 (Vertrag §6, Notiz AE-001 §4 Nr 9; Einwand 2 E1-01-min).
 */
function gesperrterKlon(sb: Sandbox): { root: string; zweig: string } {
  const k = arbeitsstandKlon(sb);
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
  commitAlles(sb, k.root, 'Fiktive Referenz-Sperre');
  const lock = JSON.parse(readText(k.root, 'docs/wap-planer/test-lock.json')) as {
    files: Record<string, string>;
  };
  const lockUpdate = (aktion: '--add' | '--refresh', pfade: string[], grund: string): void => {
    const r = node(
      join(k.root, 'scripts', 'wap', 'lock-update.mjs'),
      ['--grund', grund, aktion, ...pfade],
      { cwd: k.root, env: sb.env },
    );
    if (r.status !== 0) throw new Error(`Test-Aufbau: lock-update scheiterte: ${r.out}`);
  };
  const neu = git(sb, k.root, 'ls-files')
    .split('\n')
    .filter((p) => p !== '' && SPERRMENGEN.some((re) => re.test(p)) && !(p in lock.files));
  const ohneRef = neu.filter((p) => p !== REF_LOCK);
  if (ohneRef.length > 0) {
    lockUpdate('--add', ohneRef, 'Testaufbau: Sperre wie nach dem Merge von E1-01');
  }
  lockUpdate(
    REF_LOCK in lock.files ? '--refresh' : '--add',
    [REF_LOCK],
    'Testaufbau: fiktive Referenz-Sperre',
  );
  commitAlles(sb, k.root, 'Sperre wie nach dem Merge');
  return k;
}

function index(e: GateErgebnis, nummer: string): number {
  const s = schrittMit(e, nummer);
  return s === undefined ? -1 : e.schritte.indexOf(s);
}

describe('runGate fast im Klon des Arbeitsstands', () => {
  it(
    '[R-H-10] ohne Verstoss grün: alle Schritte F1–F9 ausgeführt, in Reihenfolge und grün; F0-last grün',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = gesperrterKlon(sb);
      const t = testLast(sb);
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: k.root, last: t.last });
      const rot = e.schritte.filter((s) => !s.ok).map((s) => `${s.id}: ${s.ursache ?? ''}`);
      expect(rot).toEqual([]);
      expect(e.ok).toBe(true);
      expect(e.modus).toBe('fast');
      expect(e.zweig).toBe(k.zweig);
      if (k.zweig.startsWith('wap/')) {
        expect(e.paket?.toLowerCase()).toBe(k.zweig.slice(4).toLowerCase());
      }
      const pos = F_SCHRITTE.map((n) => index(e, n));
      for (const [i, p] of pos.entries()) {
        expect(p, `Schritt ${F_SCHRITTE[i] ?? ''} fehlt`).toBeGreaterThanOrEqual(0);
      }
      expect([...pos].sort((a, b) => a - b)).toEqual(pos);
      expect(e.schritte.some((s) => s.id === 'F0-arbeitsbaum')).toBe(false);
      expect(e.schritte.find((s) => s.id === 'F0-sperre')?.ok).toBe(true);
      expect(e.schritte.find((s) => s.id === 'F0-last')?.ok).toBe(true);
      // Die fiktive Referenz-Sperre wurde tatsächlich geprüft, nicht leer bestanden.
      expect(e.schritte.find((s) => s.id === 'F2-referenz')?.details).toEqual({ geprueft: 1 });
      expect(e.schritte.every((s) => Number.isFinite(s.ms) && s.ms >= 0)).toBe(true);
      for (const s of e.schritte)
        expect(s.id, 'Schritt-ID nach Vertrag §9 Nr 8').toMatch(SCHRITT_ID);
    },
    LANG,
  );

  it(
    '[R-H-10][R-H-13][R-H-14][R-H-29][R-H-30][R-H-15][R-H-24] je Schritt F3–F9 ein eingebauter Verstoss → jeder Schritt rot mit seinem Grund, kein Abbruch',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = gesperrterKlon(sb);
      const r = k.root;
      // F4: verbotenes Muster in Produktcode
      writeText(
        r,
        'src/model/wap/zz-muster.ts',
        `// ${wort('TO', 'DO')} später\nexport const a = 1;\n`,
      );
      // F5: Biome-Befund (Formatierung)
      writeText(r, 'src/model/wap/zz-format.ts', 'export   const b=2\n');
      // F6: Typfehler in der WAP-Pfadmenge
      writeText(r, 'src/model/wap/zz-typ.ts', "export const c: number = 'drei';\n");
      // F7: Modulgrenze (Modell importiert Oberfläche), Suite-Grenze, ungesperrte Schleusen-Datei
      writeText(r, 'src/components/wap/zz-ziel.ts', 'export const z = 1;\n');
      writeText(
        r,
        'src/model/wap/zz-grenze.ts',
        "import { z } from '../../components/wap/zz-ziel';\nexport const d = z;\n",
      );
      writeText(r, 'src/model/pisa.ts', `${readText(r, 'src/model/pisa.ts')}// Änderung\n`);
      writeText(r, 'scripts/wap-gate/zz-neu.mjs', 'export const e = 1;\n');
      // F8: roter Test ohne ID des laufenden Pakets (H0 ist eingefroren)
      writeText(
        r,
        'tests/wap/unit/zz-rot.test.ts',
        "// @vitest-environment node\nimport { expect, it } from 'vitest';\n\nit('[R-H-01] zz rot', () => {\n  expect(1).toBe(2);\n});\n",
      );
      // F9: Test ohne ID
      writeText(
        r,
        'tests/wap/unit/zz-ohne-id.test.ts',
        // Testname zur Laufzeit gebildet: dieser Quelltext enthält selbst keinen Test ohne ID.
        `// @vitest-environment node\nimport { expect, it } from 'vitest';\n\nit(${JSON.stringify(['ohne', 'Kennung'].join(' '))}, () => {\n  expect(1).toBe(1);\n});\n`,
      );
      commitAlles(sb, r, 'Verstösse');
      // F3: AHV-Nummer gestagt (nicht committet)
      writeText(r, 'docs/wap-planer/zz-notiz.md', `Nummer ${ahvNummer()}\n`);
      git(sb, r, 'add', 'docs/wap-planer/zz-notiz.md');

      const t = testLast(sb);
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: r, last: t.last });
      expect(e.ok).toBe(false);
      expect(schrittMit(e, 'F1')?.ok).toBe(true);
      expect(schrittMit(e, 'F2')?.ok).toBe(true);
      const f3 = e.schritte.filter((s) => /^F3(?![0-9a-z])/i.test(s.id));
      expect(f3.some((s) => !s.ok)).toBe(true);
      expect(f3.map((s) => schrittText(s)).join(' ')).not.toContain(ahvNummer().slice(4));
      for (const s of e.schritte)
        expect(s.id, 'Schritt-ID nach Vertrag §9 Nr 8').toMatch(SCHRITT_ID);
      for (const s of e.schritte.filter((x) => !x.ok)) {
        expect((s.ursache ?? '').length, `${s.id} ohne Ursache`).toBeGreaterThan(0);
        expect((s.naechsterSchritt ?? '').length, `${s.id} ohne nächsten Schritt`).toBeGreaterThan(
          0,
        );
      }
      const erwartet: Array<[string, string[]]> = [
        ['F4', ['src/model/wap/zz-muster.ts']],
        ['F5', ['src/model/wap/zz-format.ts']],
        ['F6', ['src/model/wap/zz-typ.ts']],
        ['F7', ['src/model/wap/zz-grenze.ts', 'src/model/pisa.ts', 'scripts/wap-gate/zz-neu.mjs']],
        ['F8', ['zz rot']],
        ['F9', ['ohne Kennung']],
      ];
      for (const [nummer, inhalte] of erwartet) {
        const re = new RegExp(`^${nummer}(?![0-9a-z])`, 'i');
        const schritte = e.schritte.filter((s) => re.test(s.id));
        expect(schritte.length, `Schritt ${nummer} fehlt`).toBeGreaterThan(0);
        expect(
          schritte.some((s) => !s.ok),
          `Schritt ${nummer} trotz Verstoss grün`,
        ).toBe(true);
        // Vertrag §9 Nr 8: die Ursache nennt Datei, Test bzw. Paket (name@version).
        const text = schritte.map((s) => s.ursache ?? '').join('\n');
        for (const inhalt of inhalte) {
          expect(text, `Grund von ${nummer} nennt ${inhalt} nicht`).toContain(inhalt);
        }
      }
    },
    LANG,
  );

  it(
    '[R-H-10] Lock-Prüfung (F2) rot bricht sofort ab: keine Schritte nach F2; CLI Exit 1 mit «ROT» und nächstem Schritt',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = gesperrterKlon(sb);
      const lock = JSON.parse(readText(k.root, 'docs/wap-planer/test-lock.json')) as {
        files: Record<string, string>;
      };
      const gesperrt = Object.keys(lock.files).find((p) => p.startsWith('tests/wap-harness/'));
      expect(gesperrt).toBeDefined();
      const pfad = gesperrt as string;
      writeText(k.root, pfad, `${readText(k.root, pfad)}\n// geändert\n`);
      const t = testLast(sb);
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: k.root, last: t.last });
      expect(e.ok).toBe(false);
      expect(e.schritte.some((x) => /^F2(?![0-9a-z])/i.test(x.id) && !x.ok)).toBe(true);
      expect(e.schritte.at(-1)?.id).toMatch(/^F2(?![0-9a-z])/i);
      for (const n of ['F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9']) {
        expect(schrittMit(e, n), `Schritt ${n} nach Abbruch ausgeführt`).toBeUndefined();
      }
      const cli = node(join(WT, 'scripts', 'wap-gate', 'gate.mjs'), ['fast'], {
        cwd: k.root,
        env: sb.env,
      });
      expect(cli.status).toBe(1);
      expect(cli.out).toMatch(/ROT F2[^\n]*: /);
      expect(cli.out).toContain('Nächster Schritt:');
    },
    MITTEL,
  );
});

describe('runGate fast --pre-commit (F0-arbeitsbaum, Vertrag §1)', () => {
  it(
    '[R-H-10] nicht gestagte Änderung an einer versionierten Datei und nicht versionierte Datei → F0-arbeitsbaum rot als erster Schritt, Ursache mit Anzahl, nächster Schritt; keine Lock-Prüfung',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = gesperrterKlon(sb);
      writeText(k.root, 'README.md', `${readText(k.root, 'README.md')}\nNachtrag\n`);
      writeText(k.root, 'docs/zz-neu.md', 'neu\n');
      const t = testLast(sb);
      const { runGate } = await gate();
      const e = await runGate('fast', { cwd: k.root, preCommit: true, last: t.last });
      expect(e.ok).toBe(false);
      const f0 = e.schritte[0];
      expect(f0?.id).toBe('F0-arbeitsbaum');
      expect(f0?.ok).toBe(false);
      expect(f0?.ursache ?? '').toMatch(/(?<![0-9])2(?![0-9])/);
      expect(f0?.naechsterSchritt ?? '').toContain(
        'Änderungen stagen oder zurücknehmen, dann erneut committen',
      );
      preCommitSchritte(e);
    },
    LANG,
  );

  it(
    '[R-H-10] nur gestagte Änderung im Index aus GIT_INDEX_FILE (wie git commit <pfad>) → F0 grün, ohne GIT_INDEX_FILE rot; Schleuse sonst grün',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const k = gesperrterKlon(sb);
      writeText(k.root, 'docs/wap-planer/zz-notiz.md', 'Notiz ohne Personendaten\n');
      const gitDir = join(k.root, '.git');
      const alt = join(gitDir, 'index.commit');
      copyFileSync(join(gitDir, 'index'), alt);
      const r = lauf('git', ['add', 'docs/wap-planer/zz-notiz.md'], {
        cwd: k.root,
        env: { ...sb.env, GIT_INDEX_FILE: alt },
      });
      expect(r.status).toBe(0);
      const t = testLast(sb);
      const { runGate } = await gate();
      vi.stubEnv('GIT_INDEX_FILE', alt);
      const mit = await runGate('fast', { cwd: k.root, preCommit: true, last: t.last });
      expect(mit.schritte[0]?.id).toBe('F0-arbeitsbaum');
      expect(mit.schritte[0]?.ok).toBe(true);
      preCommitSchritte(mit);
      expect(mit.schritte.filter((s) => !s.ok).map((s) => s.id)).toEqual([]);
      expect(mit.ok).toBe(true);
      vi.stubEnv('GIT_INDEX_FILE', undefined);
      expect(existsSync(alt)).toBe(true);
      const ohne = await runGate('fast', { cwd: k.root, preCommit: true, last: t.last });
      expect(ohne.schritte[0]?.id).toBe('F0-arbeitsbaum');
      expect(ohne.schritte[0]?.ok).toBe(false);
    },
    LANG,
  );
});
