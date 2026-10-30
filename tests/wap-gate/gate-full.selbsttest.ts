// Selbsttest-Teil (Vertrag E1-01 §9 Nr 17): ganze volle Schleuse im synthetischen Mini-Repo.
// E1-01-min (Vertrag E1-01, Änderungsnotiz AE-001 §1; ADR-010 Änderungsnotiz AE-001 §1): F1–F9, F0-last,
// V1, V1a, V3, V9, V10 (test:oracle über checkPython, PATH nur im Kindprozess) und V11. Die übrigen
// Schritte und der R-H-11-Teil kommen mit E1-01b–e (Entwurf gate-full-v.selbsttest.entwurf.ts).
// Jeder direkte Aufruf von runGate speist `last` ein und entfernt WAP_GATE_SPERRE (AE-001 §2).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §1, §2 (runGate, checkPython), §6c (1), §9 Nr 8.
// Läufe nur im synthetischen Mini-Repo (keine Schleusen-Tests darin, daher keine Rekursion über V1a).
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { testLast } from './support/last';
import { miniRepo, pfadOhnePython } from './support/mini';
import { aufrufe, type Faelschungen, lege, uebersetzeFaelschung } from './support/python-fake';
import {
  ahvNummer,
  aufraeumen,
  commitAlles,
  FIKTIVER_NAME,
  git,
  LANG,
  neueSandbox,
  nodeModules,
  prozessUmgebung,
  schrittText,
  writeText,
} from './support/umgebung';
import { type GateErgebnis, gate, SCHRITT_ID, schrittMit } from './support/vertrag';

let f: Faelschungen;

beforeAll(() => {
  f = uebersetzeFaelschung();
});

afterAll(() => {
  rmSync(f.dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
});

afterEach(aufraeumen);

/** Schritte der vollen Schleuse in E1-01-min (ADR-010 Änderungsnotiz AE-001 §1). */
const MIN_SCHRITTE = [
  'F1',
  'F2',
  'F3',
  'F4',
  'F5',
  'F6',
  'F7',
  'F8',
  'F9',
  'V1',
  'V1a',
  'V3',
  'V9',
  'V10',
  'V11',
];

function schritteMit(e: GateErgebnis, nummer: string) {
  const re = new RegExp(`^${nummer}(?![0-9a-z])`, 'i');
  return e.schritte.filter((s) => re.test(s.id));
}

/** PDF mit einer zur Laufzeit gebildeten AHV-Nummer, als Base64 (für einen Test im Mini-Repo). */
async function pdfMitNummer(): Promise<string> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.addPage([300, 200]).drawText(`Kontakt ${ahvNummer()}`, { x: 20, y: 100, size: 10, font });
  return Buffer.from(await doc.save()).toString('base64');
}

describe('runGate full im Mini-Repo (E1-01-min)', () => {
  it(
    '[R-H-28][R-H-34][R-H-24][R-H-15] F1–F9, F0-last, V1, V1a, V3, V9, V10, V11 ausgeführt; V10-python rot (nur Python 2.7), V10-oracle nicht gestartet; V11 rot für Namen in Suite-Datei und AHV-Nummer in einem erzeugten PDF, beides maskiert; PATH des Prozesses unverändert',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = miniRepo(sb, 'mini', 'wap-planer');
      git(sb, root, 'checkout', '-q', '-b', 'wap/x');
      // Eingebauter Verstoss für V11 (R-H-34): fiktiver Sperrlisten-Name in einer Suite-Textdatei.
      writeText(root, 'src/components/Name.tsx', `// ${FIKTIVER_NAME}\nexport const n = 1;\n`);
      // Eingebauter Verstoss für V11 (R-H-24): ein Test erzeugt in V1 ein PDF mit AHV-Nummer.
      writeText(
        root,
        'vitest.wap.config.ts',
        "export default { test: { include: ['tests/wap/**/*.test.ts'], environment: 'node', retry: 0 } };\n",
      );
      writeText(
        root,
        'tests/wap/unit/erzeugt.test.ts',
        [
          '// @vitest-environment node',
          "import { mkdirSync, writeFileSync } from 'node:fs';",
          "import { expect, it } from 'vitest';",
          '',
          `const B64 = ${JSON.stringify(await pdfMitNummer())};`,
          '',
          "it('[R-1-01] erzeugt eine Ausgabe', () => {",
          "  mkdirSync('test-results/wap/pdf', { recursive: true });",
          "  writeFileSync('test-results/wap/pdf/zz-erzeugt.pdf', Buffer.from(B64, 'base64'));",
          '  expect(1).toBe(1);',
          '});',
          '',
        ].join('\n'),
      );
      nodeModules(root);
      commitAlles(sb, root, 'Suite-Datei mit Namen, erzeugender Test');
      // Eingebauter Verstoss für V10: `python` ist 2.7.18, kein Python 3.
      const a = join(f.dir, 'voll-a');
      mkdirSync(a, { recursive: true });
      const log = lege(f, a, 'python', { version: '2 7 18', exe: 'C:\\Fake27\\python.exe' });
      const pfad = pfadOhnePython(sb, a);
      vi.stubEnv('PATH', pfad);
      const t = testLast(sb);

      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: t.last });

      expect(e.modus).toBe('full');
      expect(e.ok).toBe(false);
      expect(e.zweig).toBe('wap/x');
      expect(process.env.PATH).toBe(pfad);
      for (const s of e.schritte)
        expect(s.id, 'Schritt-ID nach Vertrag §9 Nr 8').toMatch(SCHRITT_ID);
      for (const n of MIN_SCHRITTE) {
        expect(schritteMit(e, n).length, `Schritt ${n} fehlt`).toBeGreaterThan(0);
      }
      expect(e.schritte.find((s) => s.id === 'F0-sperre')?.ok).toBe(true);
      expect(e.schritte.find((s) => s.id === 'F0-last')?.ok).toBe(true);
      expect(schrittMit(e, 'F1')?.ok).toBe(true);
      expect(schrittMit(e, 'F2')?.ok).toBe(true);
      for (const s of e.schritte.filter((x) => !x.ok)) {
        expect((s.ursache ?? '').length, `Schritt ${s.id} ohne Ursache`).toBeGreaterThan(0);
        expect(
          (s.naechsterSchritt ?? '').length,
          `Schritt ${s.id} ohne nächsten Schritt`,
        ).toBeGreaterThan(0);
      }
      // V10: Python-Prüfung vor test:oracle (Vertrag §6c Fall 1).
      const python = e.schritte.find((s) => s.id === 'V10-python');
      expect(python?.ok).toBe(false);
      expect(python?.ursache ?? '').toContain('Python 3 nicht gefunden');
      expect(python?.ursache ?? '').toContain('2.7.18');
      const oracle = e.schritte.find((s) => s.id === 'V10-oracle');
      expect(oracle?.ok ?? false).toBe(false);
      expect(aufrufe(log).filter((z) => z.includes('unittest'))).toEqual([]);
      expect(
        e.schritte.findIndex((s) => s.id === 'V10-python'),
        'V10-python fehlt',
      ).toBeGreaterThanOrEqual(0);
      if (oracle !== undefined) {
        expect(e.schritte.indexOf(oracle)).toBeGreaterThan(
          e.schritte.findIndex((s) => s.id === 'V10-python'),
        );
      }
      // V11: Treffer mit Pfad, ohne Name und ohne Nummer.
      const v11 = schritteMit(e, 'V11')
        .filter((s) => !s.ok)
        .map((s) => schrittText(s))
        .join('\n');
      expect(v11).toContain('src/components/Name.tsx');
      expect(v11).toContain('zz-erzeugt.pdf');
      expect(v11.toLowerCase()).not.toContain(FIKTIVER_NAME.toLowerCase());
      expect(v11).not.toContain(ahvNummer().slice(4));
      expect(JSON.stringify(e)).not.toContain(ahvNummer().slice(4));
    },
    LANG,
  );

  it(
    '[R-H-34] --etappen-abschluss: V11 prüft alle Commits seit main (Name nur in einem Zwischencommit auf wap-planer); ohne Option nicht',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = miniRepo(sb, 'mini', 'main');
      git(sb, root, 'checkout', '-q', '-b', 'wap-planer');
      writeText(root, 'docs/alt.md', `Notiz ${FIKTIVER_NAME}\n`);
      const zwischen = commitAlles(sb, root, 'Zwischenstand mit Namen');
      writeText(root, 'docs/alt.md', 'Notiz bereinigt\n');
      commitAlles(sb, root, 'Bereinigt');
      git(sb, root, 'checkout', '-q', '-b', 'wap/x');
      writeText(root, 'docs/paket.md', 'Paketinhalt\n');
      commitAlles(sb, root, 'Paket');
      const a = join(f.dir, 'etappe-a');
      mkdirSync(a, { recursive: true });
      lege(f, a, 'python', { version: '2 7 18', exe: 'C:\\Fake27\\python.exe' });
      vi.stubEnv('PATH', pfadOhnePython(sb, a));
      const kuerzel = zwischen.slice(0, 7);

      const { runGate } = await gate();
      const mit = await runGate('full', {
        cwd: root,
        etappenAbschluss: 1,
        last: testLast(sb, { name: 'mit' }).last,
      });
      const v11mit = schritteMit(mit, 'V11');
      expect(v11mit.length).toBeGreaterThan(0);
      const textMit = v11mit.map((s) => schrittText(s)).join('\n');
      expect(v11mit.some((s) => !s.ok)).toBe(true);
      expect(textMit).toContain(kuerzel);
      expect(textMit).toContain('docs/alt.md');
      expect(textMit.toLowerCase()).not.toContain(FIKTIVER_NAME.toLowerCase());

      const ohne = await runGate('full', { cwd: root, last: testLast(sb, { name: 'ohne' }).last });
      const textOhne = schritteMit(ohne, 'V11')
        .map((s) => schrittText(s))
        .join('\n');
      expect(schritteMit(ohne, 'V11').length).toBeGreaterThan(0);
      expect(textOhne).not.toContain(kuerzel);
    },
    LANG,
  );
});

describe('runGate full: test:oracle über py -3 (TR-E101-04; Vertrag §2 checkPython, §6c Fall 3; AE-001 §1)', () => {
  it(
    '[R-H-28] `py -3` meldet 3.13.0, `python` im PATH ist 2.7 → V10-python grün mit Wahl py -3; V10-oracle startet `python -m unittest` aus dem Ordner von sys.executable (nicht das 2.7); PATH des Prozesses unverändert',
    async () => {
      const sb = neueSandbox();
      prozessUmgebung(sb);
      const root = miniRepo(sb, 'mini', 'wap-planer');
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<
        string,
        unknown
      >;
      writeText(
        root,
        'package.json',
        `${JSON.stringify({ ...pkg, scripts: { 'test:oracle': 'python -m unittest discover -s tests -p test_*.py' } }, null, 2)}\n`,
      );
      commitAlles(sb, root, 'test:oracle');
      const a = join(f.dir, 'oracle-launcher');
      const b = join(f.dir, 'oracle-py313');
      mkdirSync(a, { recursive: true });
      mkdirSync(b, { recursive: true });
      const exe313 = join(b, 'python.exe');
      const logPy = lege(f, a, 'py', { vor: '-3', version: '3 13 0', exe: exe313 });
      const log27 = lege(f, a, 'python', { version: '2 7 18', exe: 'C:Fake27python.exe' });
      const log313 = lege(f, b, 'python', { version: '3 13 0', exe: exe313 });
      const pfad = pfadOhnePython(sb, a);
      vi.stubEnv('PATH', pfad);
      const t = testLast(sb);

      const { runGate } = await gate();
      const e = await runGate('full', { cwd: root, last: t.last });

      expect(process.env.PATH).toBe(pfad);
      const python = e.schritte.find((s) => s.id === 'V10-python');
      expect(python?.ok, schrittText(python ?? {})).toBe(true);
      const oracle = e.schritte.find((s) => s.id === 'V10-oracle');
      expect(oracle, 'V10-oracle nicht gestartet').toBeDefined();
      expect(e.schritte.indexOf(oracle as NonNullable<typeof oracle>)).toBeGreaterThan(
        e.schritte.indexOf(python as NonNullable<typeof python>),
      );
      expect(aufrufe(log313).some((z) => z.startsWith('-m|unittest'))).toBe(true);
      expect(aufrufe(log27).some((z) => z.includes('unittest'))).toBe(false);
      expect(aufrufe(logPy).some((z) => z.startsWith('-3|-c|'))).toBe(true);
    },
    LANG,
  );
});
