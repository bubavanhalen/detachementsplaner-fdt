// Selbsttest der Schleusen (R-H-31, Prompt §5.3 Punkt 2, ADR-010 §3.5).
// Aufruf: node scripts/wap-gate/selftest.mjs [--nur S1,S2,…]   (Beleglauf, nur nach Vorgabe des Orchestrators)
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 `runSelftest`, §8, §9 Nr 13 und Änderungsnotiz
// AE-001 §1, §2, §4 Nr 4, 8 (TR-E101-13: commonDir aus dem Aufrufverzeichnis; --nur-Namen vor F1,
// F0-sperre und F0-last geprüft).
// Ablauf: Klon des aktuellen Arbeitsstands in einem temporären Ordner (eigenes Repo, keine Hooks des
// gemeinsamen Git-Verzeichnisses), je Verstoss ein frischer Klon mit genau einem eingebauten Fehler,
// danach die zuständige Schleuse bzw. ihr Schritt; erwartet «rot» mit dem richtigen Grund (Datei, Test,
// ID). Verbotene Muster und fiktive Daten werden zur Laufzeit gebildet; der Name für V11 steht nur in
// einer temporären, fiktiven Sperrliste (nie die echte Liste, AGENTS.md).
// Paket F-TOOLS (Auftraggeber 19.10.2026 «7: ja»): Zusatzfälle Z-lizenz-gpl (F10), Z-lizenztext
// (V10-lizenztexte), Z-abdeckung (V2), Z-golden-kette und Z-golden-pixel (V5-golden), Z-mutation (V8); Runde 2:
// S7 Leistungsregression (V7-vergleich, R-H-32), Z-suite-worker (F7-worker, R-H-37), Z-utf16 (V11-deep, CR-E101-P07).
import { spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { messeAbdeckung } from './coverage-check.mjs';
import { schleusenSchritte } from './gate.mjs';
import { belegeSperre, pruefeFremdlast, testUmgebung } from './last.mjs';
import { fehlerMeldung, hinweis } from './lib/out.mjs';
import { starteNode } from './lib/prozess.mjs';
import { commitVon, git, pakete, wurzel, zweigVon } from './lib/repo.mjs';
import { checkBundledLicenses } from './license-check.mjs';
import { runMutation } from './mutation.mjs';
import { checkNode } from './node-check.mjs';
import { deepPrivacyScan } from './privacy-deep.mjs';
import { checkPython, pythonProbe } from './python-check.mjs';
import { planZeilen } from './trace.mjs';

/** @typedef {import('./lib/types.mjs').Schritt} Schritt */
/** @typedef {{ verstoss: string; erwartet: string; erkannt: string | null; ok: boolean }} Eintrag */

const GATE_DIR = dirname(fileURLToPath(import.meta.url));

/**
 * Verstösse von E1-01-min (Vertrag §9 Nr 13, AE-001 §1) und S6 aus E1-01b (Vertrag E1-01b §2 «S6»: Schrift
 * unter der Mindestgrösse im PDF, erkannt von V5-ebene2) mit der erwarteten Schleuse bzw. dem Schritt.
 */
export const VERSTOESSE = /** @type {const} */ ([
  ['S1', 'F4, F5'],
  ['S2', 'F4'],
  ['S3a', 'Hook guard-edit (Exit 2)'],
  ['S3b', 'F2'],
  ['S4', 'F3'],
  ['S5', 'F9'],
  ['Z-only', 'F4, F5'],
  ['Z-console', 'F4, F5'],
  ['Z-any', 'F4, F5'],
  ['Z-biome-ignore', 'F4'],
  ['Z-suite-datei', 'F7'],
  ['Z-referenz-fehlt', 'V3'],
  ['Z-fremde-id', 'F9'],
  ['Z-ungesperrt', 'F7'],
  ['Z-name-v11', 'V11'],
  ['Z-python2', 'V10-python'],
  ['S6', 'V5-ebene2'],
  ['Z-lizenz-gpl', 'F10'],
  ['Z-lizenztext', 'V10-lizenztexte'],
  ['Z-abdeckung', 'V2'],
  ['Z-golden-kette', 'V5-golden'],
  ['Z-golden-pixel', 'V5-golden'],
  ['Z-mutation', 'V8'],
  ['S7', 'V7-vergleich'],
  ['Z-suite-worker', 'F7-worker'],
  ['Z-utf16', 'V11-deep'],
]);

const w = (/** @type {string[]} */ ...t) => t.join('');
const KOPF = "// @vitest-environment jsdom\nimport { expect, it } from 'vitest';\n\n";

// Jeder Fall der schnellen Schleuse führt genau die Schritte aus, deren Rot er erwartet (Kommentar oben: «die
// zuständige Schleuse bzw. ihr Schritt»). Bis F-TOOLS Runde 2 liefen alle F3–F9; gewertet wurden aber nur die
// erwarteten Schritte, die Schritte F3–F9 hängen nicht voneinander ab (kein Abbruch zwischen ihnen, F9 «fast»
// liest Vitest-Listen statt des F8-Berichts). Die übrigen Schritte kosteten je Fall den ganzen Vitest-Lauf
// (F8) und die Testlisten (F9), zusammen fast 3 min (F-TOOLS3 Auftrag 1, FT3-01). F2 bleibt ausgenommen:
// ein umgebungsabhängiges Rot von F2 bricht die Schleuse ab (ADR-010 §3) und belegt nur S3b.

/**
 * Wählt die Verstösse; wirft bei unbekannten Namen mit der Liste der gültigen.
 * @param {string[] | undefined} nur
 * @returns {string[]}
 */
export function waehleVerstoesse(nur) {
  const alle = VERSTOESSE.map(([n]) => n);
  if (nur === undefined || nur.length === 0) return alle;
  /** @type {string[]} */
  const gewaehlt = [];
  /** @type {string[]} */
  const unbekannt = [];
  for (const roh of nur) {
    const name = alle.find((n) => n.toLowerCase() === roh.trim().toLowerCase());
    if (name === undefined) unbekannt.push(roh);
    else if (!gewaehlt.includes(name)) gewaehlt.push(name);
  }
  if (unbekannt.length > 0) {
    throw new Error(
      `Unbekannter Verstoss ${unbekannt.map((u) => `«${u}»`).join(', ')}. Gültige Namen: ${alle.join(', ')}`,
    );
  }
  return alle.filter((n) => gewaehlt.includes(n));
}

/**
 * git im Klon; wirft bei Fehler.
 * @param {string} cwd
 * @param {string[]} args
 * @returns {string}
 */
function gitOk(cwd, args) {
  const r = git(cwd, args);
  if (r.status !== 0) throw new Error(`git ${args[0] ?? ''} im Selbsttest-Klon gescheitert`);
  return r.stdout.trim();
}

/**
 * Klont ein Repo in einen temporären Ordner (gleicher Zweig, lokale Zweige main und wap-planer,
 * fiktive Identität, keine Hooks, node_modules verknüpft).
 * @param {string} quelle
 * @param {string} ziel
 * @param {string} zweig
 * @param {string} nodeModules
 * @param {string} keineHooks leerer Ordner für core.hooksPath
 */
function klone(quelle, ziel, zweig, nodeModules, keineHooks) {
  gitOk(dirname(ziel), ['clone', '-q', quelle, ziel]);
  gitOk(ziel, ['config', 'user.name', 'WAP Selbsttest']);
  gitOk(ziel, ['config', 'user.email', w('selbsttest', '@', 'example.invalid')]);
  gitOk(ziel, ['config', 'core.autocrlf', 'false']);
  gitOk(ziel, ['config', 'commit.gpgsign', 'false']);
  gitOk(ziel, ['config', 'core.hooksPath', keineHooks]);
  for (const b of ['main', 'wap-planer']) {
    if (b === zweig || commitVon(ziel, `refs/heads/${b}`) !== null) continue;
    if (commitVon(ziel, `refs/remotes/origin/${b}`) !== null)
      gitOk(ziel, ['branch', '-q', b, `origin/${b}`]);
  }
  if (zweig !== '' && zweigVon(ziel) !== zweig) gitOk(ziel, ['checkout', '-q', '-B', zweig]);
  if (existsSync(nodeModules)) symlinkSync(nodeModules, join(ziel, 'node_modules'), 'junction');
}

/**
 * Überträgt die nicht committeten Änderungen des Arbeitsbaums in den Klon und committet sie.
 * @param {string} root
 * @param {string} ziel
 */
function arbeitsstand(root, ziel) {
  const geaendert = git(root, ['ls-files', '-z', '-m', '-o', '--exclude-standard']).stdout;
  for (const rel of new Set(geaendert.split('\0').filter((p) => p !== ''))) {
    const quelle = join(root, ...rel.split('/'));
    if (!existsSync(quelle)) continue;
    const z = join(ziel, ...rel.split('/'));
    mkdirSync(dirname(z), { recursive: true });
    copyFileSync(quelle, z);
  }
  const geloescht = git(root, ['ls-files', '-z', '-d']).stdout;
  for (const rel of geloescht.split('\0').filter((p) => p !== '')) {
    rmSync(join(ziel, ...rel.split('/')), { force: true });
  }
  gitOk(ziel, ['add', '-A']);
  gitOk(ziel, ['commit', '-q', '--allow-empty', '-m', 'Arbeitsstand (Selbsttest)']);
}

/**
 * Schreibt eine Datei im Klon.
 * @param {string} root
 * @param {string} rel
 * @param {string} inhalt
 */
function schreibe(root, rel, inhalt) {
  const datei = join(root, ...rel.split('/'));
  mkdirSync(dirname(datei), { recursive: true });
  writeFileSync(datei, inhalt);
}

/**
 * Prüft, ob die erwarteten Schritte rot sind und ihre Ursache die Nennung enthält.
 * @param {Schritt[]} schritte
 * @param {string[]} nummern
 * @param {string} nennung
 * @returns {{ ok: boolean; erkannt: string }}
 */
function erwartung(schritte, nummern, nennung) {
  let alle = true;
  /** @type {string[]} */
  const teile = [];
  for (const nr of nummern) {
    const re = new RegExp(`^${nr}(?![0-9a-z])`, 'i');
    const rote = schritte.filter((s) => re.test(s.id) && !s.ok);
    const passend = rote.find((s) =>
      `${s.ursache ?? ''} ${JSON.stringify(s.details ?? null)}`.includes(nennung),
    );
    if (passend !== undefined) {
      // Steht die Nennung erst hinter den ersten 240 Zeichen (z.B. V2-abdeckung mit vielen Modulen), folgt ein
      // Auszug um sie, damit das Protokoll die eingebaute Stelle zeigt (F-TOOLS3, FT3-04).
      const ursache = passend.ursache ?? '';
      const stelle = ursache.indexOf(nennung);
      const auszug =
        stelle < 0 || stelle + nennung.length <= 240
          ? ursache.slice(0, 240)
          : `${ursache.slice(0, 160)} … ${ursache.slice(Math.max(160, stelle - 40), stelle + nennung.length + 40)}`;
      teile.push(`${passend.id}: ${auszug}`);
    } else {
      alle = false;
      teile.push(
        rote.length > 0 ? `${nr} rot, aber ohne Nennung der eingebauten Stelle` : `${nr} nicht rot`,
      );
    }
  }
  return { ok: alle, erkannt: teile.join('; ') };
}

/**
 * Baut den Verstoss ein und führt die zuständige Schleuse bzw. ihren Schritt aus.
 * @param {string} name
 * @param {{ root: string; zweig: string; paket: string | null; sperre: string | undefined; tmp: string; wt: string }} k
 * @returns {Promise<{ ok: boolean; erkannt: string }>}
 */
async function pruefeVerstoss(name, k) {
  /** @type {Schritt[]} */
  const schritte = [];
  /**
   * @param {'fast' | 'full'} modus
   * @param {string[]} [nur]
   */
  const schleuse = (modus, nur) =>
    schleusenSchritte(modus, {
      root: k.root,
      zweig: k.zweig,
      paket: k.paket,
      preCommit: false,
      sperre: k.sperre,
      melde: (s) => schritte.push(s),
      ...(nur === undefined ? {} : { nur }),
    });
  const test = (/** @type {string} */ rel, /** @type {string} */ koerper) =>
    schreibe(k.root, rel, `${KOPF}${koerper}`);
  switch (name) {
    case 'S1': {
      const rel = 'tests/wap/unit/zz-selbsttest-s1.test.ts';
      test(
        rel,
        `it${w('.sk', 'ip')}('[R-H-31] Selbsttest S1', () => {\n  expect(1).toBe(1);\n});\n`,
      );
      await schleuse('fast', ['F4', 'F5']);
      return erwartung(schritte, ['F4', 'F5'], rel);
    }
    case 'S2': {
      const rel = 'src/model/wap/zz-selbsttest-s2.ts';
      schreibe(k.root, rel, `// ${w('TO', 'DO')} Selbsttest\nexport const s2 = 1;\n`);
      await schleuse('fast', ['F4']);
      return erwartung(schritte, ['F4'], rel);
    }
    case 'S3a': {
      const lock = /** @type {{ files: Record<string, string> }} */ (
        JSON.parse(readFileSync(join(k.root, 'docs', 'wap-planer', 'test-lock.json'), 'utf8'))
      );
      const gesperrt = Object.keys(lock.files).find((p) =>
        existsSync(join(k.root, ...p.split('/'))),
      );
      if (gesperrt === undefined) return { ok: false, erkannt: 'keine gesperrte Datei im Klon' };
      const r = await starteNode(join(GATE_DIR, '..', 'wap', 'guard-edit.mjs'), [], {
        cwd: k.root,
        env: testUmgebung(process.env, 'sonst'),
        input: JSON.stringify({
          tool_name: 'Edit',
          tool_input: { file_path: join(k.root, ...gesperrt.split('/')) },
          cwd: k.root,
        }),
        timeoutMs: 60_000,
      });
      return {
        ok: r.status === 2,
        erkannt: `Hook guard-edit: Exit ${String(r.status)} für eine gesperrte Datei (${gesperrt})`,
      };
    }
    case 'S3b': {
      const lock = /** @type {{ files: Record<string, string> }} */ (
        JSON.parse(readFileSync(join(k.root, 'docs', 'wap-planer', 'test-lock.json'), 'utf8'))
      );
      const gesperrt = Object.keys(lock.files).find(
        (p) => p.startsWith('tests/') && existsSync(join(k.root, ...p.split('/'))),
      );
      if (gesperrt === undefined)
        return { ok: false, erkannt: 'keine gesperrte Testdatei im Klon' };
      appendFileSync(
        join(k.root, ...gesperrt.split('/')),
        '\n// per Befehl geändert (Selbsttest S3b)\n',
      );
      await schleuse('fast', ['F2']);
      return erwartung(schritte, ['F2'], gesperrt);
    }
    case 'S4': {
      const rel = 'docs/wap-planer/zz-selbsttest-s4.md';
      schreibe(k.root, rel, `Selbsttest S4: ${w('75', '6.1234.5678.97')}\n`);
      gitOk(k.root, ['add', rel]);
      await schleuse('fast', ['F3']);
      return erwartung(schritte, ['F3'], rel);
    }
    case 'S5': {
      const titel = 'ohne Kennung im Selbsttest';
      test(
        'tests/wap/unit/zz-selbsttest-s5.test.ts',
        `it('${titel}', () => {\n  expect(1).toBe(1);\n});\n`,
      );
      await schleuse('fast', ['F9']);
      return erwartung(schritte, ['F9'], titel);
    }
    case 'Z-only': {
      const rel = 'tests/wap/unit/zz-selbsttest-only.test.ts';
      test(
        rel,
        `it${w('.on', 'ly')}('[R-H-31] Selbsttest nur dieser', () => {\n  expect(1).toBe(1);\n});\n`,
      );
      await schleuse('fast', ['F4', 'F5']);
      return erwartung(schritte, ['F4', 'F5'], rel);
    }
    case 'Z-console': {
      const rel = 'src/model/wap/zz-selbsttest-console.ts';
      schreibe(k.root, rel, `export const c = (): void => {\n  ${w('con', 'sole')}.log(1);\n};\n`);
      await schleuse('fast', ['F4', 'F5']);
      return erwartung(schritte, ['F4', 'F5'], rel);
    }
    case 'Z-any': {
      const rel = 'src/model/wap/zz-selbsttest-any.ts';
      schreibe(k.root, rel, `export const z: ${w('an', 'y')} = 1;\n`);
      await schleuse('fast', ['F4', 'F5']);
      return erwartung(schritte, ['F4', 'F5'], rel);
    }
    case 'Z-biome-ignore': {
      const rel = 'src/model/wap/zz-selbsttest-ausnahme.ts';
      schreibe(
        k.root,
        rel,
        `// ${w('biome', '-ignore')} lint/style/useConst: kurz\nexport let e = 1;\n`,
      );
      await schleuse('fast', ['F4']);
      return erwartung(schritte, ['F4'], rel);
    }
    case 'Z-suite-datei': {
      const rel = 'src/model/pisa.ts';
      if (!existsSync(join(k.root, rel))) return { ok: false, erkannt: `${rel} fehlt im Klon` };
      appendFileSync(join(k.root, rel), '\n// Änderung ausserhalb der Freigabe (Selbsttest)\n');
      await schleuse('fast', ['F7']);
      return erwartung(schritte, ['F7'], rel);
    }
    case 'Z-referenz-fehlt': {
      const rel = 'tests/wap/reference/required-files.json';
      const fehlend = 'zz-selbsttest/fehlt.csv';
      /** @type {string[]} */
      let alt = [];
      if (existsSync(join(k.root, rel))) {
        /** @type {{ dateien?: unknown }} */
        const daten = JSON.parse(readFileSync(join(k.root, rel), 'utf8'));
        if (Array.isArray(daten.dateien)) alt = daten.dateien.map(String);
      }
      schreibe(
        k.root,
        rel,
        `${JSON.stringify({ version: 1, dateien: [...alt, fehlend] }, null, 2)}\n`,
      );
      await schleuse('full', ['V3']);
      return erwartung(schritte, ['V3'], 'Referenzdatei fehlt');
    }
    case 'Z-fremde-id': {
      const eingefroren = new Set(
        pakete(k.root)
          .filter((p) => p.eingefroren)
          .map((p) => p.name.toLowerCase()),
      );
      const zeile = planZeilen(k.root).find(
        (z) =>
          z.paket.toLowerCase() !== (k.paket ?? '') &&
          !eingefroren.has(z.paket.toLowerCase()) &&
          z.testart !== 'Verweis',
      );
      if (zeile === undefined)
        return { ok: false, erkannt: 'keine ID eines fremden Pakets im Plan' };
      test(
        'tests/wap/unit/zz-selbsttest-fremd.test.ts',
        `it('[${zeile.id}] Selbsttest fremde ID', () => {\n  expect(1).toBe(1);\n});\n`,
      );
      await schleuse('fast', ['F9']);
      return erwartung(schritte, ['F9'], zeile.id);
    }
    case 'Z-ungesperrt': {
      const rel = 'scripts/wap-gate/zz-selbsttest-ungesperrt.mjs';
      schreibe(k.root, rel, 'export const ungesperrt = 1;\n');
      await schleuse('fast', ['F7']);
      return erwartung(schritte, ['F7'], rel);
    }
    case 'Z-name-v11': {
      const liste = join(k.tmp, 'fiktive-sperrliste');
      const fiktiv = w('Quabbel', 'witz', '-Selbsttest');
      schreibe(liste, 'datenschutz-sperrliste.txt', `# fiktiv (Selbsttest)\n${fiktiv}\n`);
      const rel = 'src/components/ZzSelbsttestName.tsx';
      schreibe(k.root, rel, `// ${fiktiv}\nexport const zzName = 1;\n`);
      gitOk(k.root, ['add', rel]);
      gitOk(k.root, ['commit', '-q', '-m', 'Selbsttest V11']);
      const env = testUmgebung(process.env, 'sonst');
      env.WAP_REFERENCE_DIR = liste;
      const r = await starteNode(
        join(GATE_DIR, 'privacy-names.mjs'),
        ['--root', k.root, '--baum', 'HEAD'],
        { cwd: k.root, env, timeoutMs: 600_000 },
      );
      const ausgabe = `${r.stdout}\n${r.stderr}`;
      const ok =
        r.status === 1 &&
        ausgabe.includes(rel) &&
        !ausgabe.toLowerCase().includes(fiktiv.toLowerCase());
      return {
        ok,
        erkannt: ok
          ? `V11-namen: Treffer in ${rel} (Name maskiert)`
          : `V11-namen: Exit ${String(r.status)}, Treffer nicht erkannt`,
      };
    }
    case 'Z-python2': {
      const exe = join(k.tmp, 'python27', 'python.exe');
      const csc = join(
        process.env.SystemRoot ?? 'C:\\Windows',
        'Microsoft.NET',
        'Framework64',
        'v4.0.30319',
        'csc.exe',
      );
      const quelle = join(k.wt, 'tests', 'wap-gate', 'fixtures', 'python-fake', 'fake.cs');
      mkdirSync(dirname(exe), { recursive: true });
      const c = spawnSync(csc, ['-nologo', `-out:${exe}`, quelle], {
        windowsHide: true,
        encoding: 'utf8',
      });
      if (c.status !== 0 || !existsSync(exe))
        return { ok: false, erkannt: 'csc.exe fehlt oder Übersetzung gescheitert' };
      const probe = join(k.tmp, 'python27', 'probe.txt');
      writeFileSync(probe, pythonProbe());
      writeFileSync(
        join(k.tmp, 'python27', 'python.fake.txt'),
        `probe=${probe}\nversion=2 7 18\nexe=${join(k.tmp, 'python27', 'python.exe')}\n`,
      );
      const systemRoot = process.env.SystemRoot ?? 'C:\\Windows';
      const s = await checkPython({
        cwd: k.root,
        env: { PATH: `${dirname(exe)};${join(systemRoot, 'System32')}`, SystemRoot: systemRoot },
      });
      schritte.push(s);
      return erwartung(schritte, ['V10-python'], 'Python 3 nicht gefunden');
    }
    case 'S6': {
      // Vertrag E1-01b §2 «S6»: ein Textlauf in 4 pt, eingebettete Liberation-Schrift aus pdfjs-dist; nur V5.
      const rel = 'test-results/wap/pdf/s6-probe.pdf';
      const { PDFDocument, rgb } = await import('pdf-lib');
      const fontkitName = 'fontkit';
      /** @type {{ default?: unknown }} */
      const fk = await import(fontkitName);
      const doc = await PDFDocument.create();
      doc.registerFontkit(
        /** @type {Parameters<typeof doc.registerFontkit>[0]} */ (fk.default ?? fk),
      );
      const ttf = readFileSync(
        join(k.root, 'node_modules', 'pdfjs-dist', 'standard_fonts', 'LiberationSans-Regular.ttf'),
      );
      const schrift = await doc.embedFont(ttf, { subset: false });
      doc.addPage([300, 200]).drawText('Selbsttest S6 0700', {
        x: 20,
        y: 100,
        size: 4,
        font: schrift,
        color: rgb(0, 0, 0),
      });
      const datei = join(k.root, ...rel.split('/'));
      mkdirSync(dirname(datei), { recursive: true });
      writeFileSync(datei, await doc.save({ useObjectStreams: false }));
      await schleuse('full', ['V5']);
      const e = erwartung(schritte, ['V5'], 's6-probe.pdf');
      return { ok: e.ok && e.erkannt.includes('Schrift unter Mindestgrösse'), erkannt: e.erkannt };
    }
    case 'Z-lizenz-gpl': {
      // Neue Entwicklungs-Abhängigkeit mit GPL-Lizenz im package-lock (fiktives Paket, nicht installiert).
      const datei = join(k.root, 'package-lock.json');
      const lock = /** @type {{ packages: Record<string, unknown> }} */ (
        JSON.parse(readFileSync(datei, 'utf8'))
      );
      lock.packages['node_modules/zz-gpl-paket'] = {
        version: '1.0.0',
        resolved: 'https://registry.npmjs.org/zz-gpl-paket/-/zz-gpl-paket-1.0.0.tgz',
        integrity: 'sha512-AAAA',
        dev: true,
        license: 'GPL-3.0-only',
      };
      writeFileSync(datei, `${JSON.stringify(lock, null, 2)}\n`);
      await schleuse('fast', ['F10']);
      return erwartung(schritte, ['F10'], 'zz-gpl-paket@1.0.0');
    }
    case 'Z-lizenztext': {
      // Build im Klon, danach der Lizenzblock von react-dom aus beiden Dateien entfernt (R-H-23 Kriterium 2).
      const bau = await starteNode(join(k.root, 'tools', 'build-offline.mjs'), [], {
        cwd: k.root,
        env: testUmgebung(process.env, 'sonst'),
        timeoutMs: 600_000,
      });
      if (bau.status !== 0) {
        return { ok: false, erkannt: `Build im Klon gescheitert (Exit ${String(bau.status)})` };
      }
      for (const datei of ['index.html', 'offline.html']) {
        const pfad = join(k.root, 'dist', datei);
        const text = readFileSync(pfad, 'utf8');
        const start = text.indexOf('\n\nreact-dom\n');
        const ende = start < 0 ? -1 : text.indexOf('\n\n', start + 2);
        if (start < 0 || ende < 0) {
          return { ok: false, erkannt: 'Block react-dom im Build nicht gefunden' };
        }
        writeFileSync(pfad, `${text.slice(0, start)}${text.slice(ende)}`);
      }
      const { erwartet: _erwartet, fehlend, ...s } = await checkBundledLicenses({ cwd: k.root });
      schritte.push({ ...s, details: { fehlend } });
      return erwartung(schritte, ['V10-lizenztexte'], 'react-dom');
    }
    case 'Z-abdeckung': {
      // Neues Modul der Fachlogik mit Zweigen ohne Test (eigener Modulordner, Nennung eindeutig).
      const rel = 'src/model/wap/zz-selbsttest/abdeckung.ts';
      schreibe(
        k.root,
        rel,
        [
          'export function stufe(n: number): number {',
          '  if (n < 0) return -1;',
          '  if (n === 0) return 0;',
          '  if (n > 100) return 2;',
          '  return 1;',
          '}',
          '',
        ].join('\n'),
      );
      // Nur der Schritt V2-abdeckung (wie Z-lizenztext, S7, Z-utf16 mit ihrem Schritt): V2-e2e startet die
      // ganze E2E-Suite (Projekt edge, über 10 min) und kann ein Modul ohne Aufrufer nicht decken; ohne
      // E2E-Datensatz ist die Abdeckung höchstens kleiner, das Rot also nicht abgeschwächt. Die Verdrahtung
      // von V2 (E2E, dann Abdeckung) prüft gate-f-tools.gate.ts (FT3-01).
      const env = testUmgebung(process.env, 'vitest');
      if (k.sperre !== undefined) env.WAP_GATE_SPERRE = k.sperre;
      schritte.push(await messeAbdeckung({ cwd: k.root, env, zusaetzlich: [] }));
      return erwartung(schritte, ['V2'], 'src/model/wap/zz-selbsttest');
    }
    case 'Z-golden-kette': {
      const rel = 'tests/wap/golden/render-chain.json';
      const datei = join(k.root, ...rel.split('/'));
      if (!existsSync(datei)) return { ok: false, erkannt: `${rel} fehlt im Klon` };
      const kette = /** @type {{ pdf: Record<string, unknown> }} */ (
        JSON.parse(readFileSync(datei, 'utf8'))
      );
      kette.pdf.pdfjsDist = '0.0.0-selbsttest';
      writeFileSync(datei, `${JSON.stringify(kette, null, 2)}\n`);
      await schleuse('full', ['V5']);
      return erwartung(schritte, ['V5-golden'], 'Render-Kette geändert');
    }
    case 'Z-golden-pixel': {
      // Ein Pixel der ersten Baseline umgefärbt (SHA-256 im Manifest nachgeführt); ohne Baseline (Aufnahme
      // ausstehend) eine 1 × 1 grosse weisse Baseline für den ersten Kandidaten.
      const g = await import('./golden.mjs');
      const mDatei = join(k.root, 'tests', 'wap', 'golden', 'manifest.json');
      const m = g.ladeManifest(mDatei);
      if (!m.ok) return { ok: false, erkannt: `Golden-Manifest: ${m.grund}` };
      const erstes = m.manifest.bilder[0];
      /** @type {import('./golden.mjs').ManifestBild} */
      let bild;
      /** @type {Uint8Array} */
      let png;
      if (erstes !== undefined) {
        bild = erstes;
        const b = g.pngLesen(
          readFileSync(join(k.root, 'tests', 'wap', 'golden', ...bild.datei.split('/'))),
        );
        b.rgba[0] = (b.rgba[0] ?? 0) ^ 0xff;
        png = g.pngSchreiben(b);
      } else {
        png = g.pngSchreiben({ width: 1, height: 1, rgba: Uint8Array.from([255, 255, 255, 255]) });
        bild = {
          datei: 'baselines/kvk-woche-s1.png',
          sha256: '',
          status: 'vorläufig',
          anforderungen: ['R-H-20'],
          grund: 'Selbsttest',
          commit: 'selbsttest',
        };
      }
      const ziel = join(k.root, 'tests', 'wap', 'golden', ...bild.datei.split('/'));
      mkdirSync(dirname(ziel), { recursive: true });
      writeFileSync(ziel, png);
      const bilder = [
        { ...bild, sha256: g.sha256(png) },
        ...m.manifest.bilder.filter((x) => x.datei !== bild.datei),
      ];
      writeFileSync(mDatei, g.manifestText({ ...m.manifest, bilder }));
      await schleuse('full', ['V5']);
      const name = (bild.datei.split('/').at(-1) ?? '').replace(/\.png$/, '');
      // Nennung aus der Meldung des Tests (nicht aus seinem Namen): Pixel- bzw. Grössenabweichung des Bildes.
      return erwartung(
        schritte,
        ['V5-golden'],
        erstes === undefined
          ? `Golden-Bild ${name}: Bildgrösse geändert`
          : `Golden-Bild ${name}: 1 Pixel abweichend`,
      );
    }
    case 'Z-mutation': {
      // Mini-Repo mit der Stryker-Konfiguration des Klons (Läufer, Vitest-Konfiguration für Stryker), einem neuen
      // Modul der Fachlogik und einem schwachen Test; V8 über die gegenüber HEAD neuen Dateien. Eigenes Mini-Repo
      // statt des Klons: der Trockenlauf aller 2228 Tests braucht ein echtes node_modules (Werkzeugaufrufe per
      // Pfad) und dauert im Klon über 6 min; geprüft wird hier die Wertung von V8.
      const mini = join(k.tmp, 'z-mutation');
      mkdirSync(mini, { recursive: true });
      gitOk(mini, ['init', '-q']);
      gitOk(mini, ['config', 'user.name', 'WAP Selbsttest']);
      gitOk(mini, ['config', 'user.email', w('selbsttest', '@', 'example.invalid')]);
      gitOk(mini, ['config', 'commit.gpgsign', 'false']);
      for (const rel of [
        'stryker.wap.conf.mjs',
        'vitest.wap-stryker.config.ts',
        'scripts/wap-gate/stryker-vitest-wap.mjs',
      ]) {
        schreibe(mini, rel, readFileSync(join(k.root, ...rel.split('/')), 'utf8'));
      }
      schreibe(
        mini,
        'vitest.wap.config.ts',
        "export default { test: { include: ['tests/wap/**/*.test.ts'], environment: 'node', retry: 0 } };\n",
      );
      schreibe(mini, '.gitignore', 'node_modules\ntest-results\n');
      if (existsSync(join(k.wt, 'node_modules'))) {
        symlinkSync(join(k.wt, 'node_modules'), join(mini, 'node_modules'), 'junction');
      }
      gitOk(mini, ['add', '-A']);
      gitOk(mini, ['commit', '-q', '-m', 'Basis (Selbsttest)']);
      schreibe(
        mini,
        'src/model/wap/zz-selbsttest/mutation.ts',
        [
          'export function einstufen(n: number): string {',
          "  if (n < 0) return 'negativ';",
          "  if (n === 0) return 'null';",
          "  if (n > 100) return 'gross';",
          "  return 'positiv';",
          '}',
          '',
        ].join('\n'),
      );
      schreibe(
        mini,
        'tests/wap/unit/zz-selbsttest-mutation.test.ts',
        `// @vitest-environment node\nimport { describe, expect, it } from 'vitest';\nimport { einstufen } from '../../../src/model/wap/zz-selbsttest/mutation';\n\ndescribe('Selbsttest', () => {\n  it('[R-H-31] schwacher Test', () => {\n    expect(typeof einstufen(5)).toBe('string');\n  });\n});\n`,
      );
      const s = await runMutation({
        cwd: mini,
        basis: 'HEAD',
        env: testUmgebung(process.env, 'stryker'),
        concurrency: 2,
      });
      schritte.push(s);
      return erwartung(schritte, ['V8'], 'Mutationsscore unter 80 %: Fachlogik (');
    }
    case 'S7': {
      // R-H-32 (Prompt §5.3 Punkt 2): Leistungsregression. Fiktive Messgrösse in Baseline und Messung des Klons,
      // Messung 30 % über der Baseline; V7-vergleich wie in der vollen Schleuse (comparePerf, Regel E7 a).
      const name = 'zzSelbsttestPdfWoche';
      const basisDatei = join(k.root, 'docs', 'wap-planer', 'perf', 'perf-baseline.json');
      const basis = /** @type {{ messwerte: Record<string, unknown> }} */ (
        JSON.parse(readFileSync(basisDatei, 'utf8'))
      );
      basis.messwerte[name] = { medianMs: 100, budgetMs: 3000, anforderung: 'R-11-15' };
      writeFileSync(basisDatei, `${JSON.stringify(basis, null, 2)}\n`);
      const messungen = join(k.root, 'test-results', 'wap', 'perf.json');
      mkdirSync(dirname(messungen), { recursive: true });
      const alle = Object.fromEntries(
        Object.entries(basis.messwerte).map(([n, v]) => [n, /** @type {object} */ (v)]),
      );
      alle[name] = { medianMs: 130, budgetMs: 3000, anforderung: 'R-11-15' };
      writeFileSync(messungen, `${JSON.stringify({ messwerte: alle }, null, 2)}\n`);
      const { comparePerf } = await import('./perf-compare.mjs');
      schritte.push(
        comparePerf({
          messungen,
          baseline: basisDatei,
          drosselung: join(k.root, 'docs', 'wap-planer', 'perf', 'drosselung.json'),
          budgets: join(k.root, 'docs', 'wap-planer', 'perf', 'budgets.json'),
          regel: 'prozent10oder2ms',
        }),
      );
      return erwartung(schritte, ['V7'], `Leistungsregression: ${name}`);
    }
    case 'Z-suite-worker': {
      // R-H-37: Suite-Konfiguration ohne Begrenzung der Worker → F7-worker rot.
      const datei = join(k.root, 'vitest.config.ts');
      writeFileSync(datei, readFileSync(datei, 'utf8').replace(/\n\s*maxWorkers: 4,/, ''));
      await schleuse('fast', ['F7']);
      return erwartung(schritte, ['F7-worker'], 'ohne Begrenzung der Worker');
    }
    case 'Z-utf16': {
      // CR-E101-P07: UTF-16-Datei ohne BOM mit fiktiver AHV-Nummer unter test-results/wap → V11-deep rot.
      const rel = 'test-results/wap/zz-selbsttest-utf16.txt';
      const datei = join(k.root, ...rel.split('/'));
      mkdirSync(dirname(datei), { recursive: true });
      writeFileSync(
        datei,
        Buffer.from(`Selbsttest UTF-16: ${w('75', '6.1234.5678.97')}\n`, 'utf16le'),
      );
      schritte.push(
        await deepPrivacyScan({ cwd: k.root, pfade: ['test-results/wap/zz-selbsttest-utf16.txt'] }),
      );
      return erwartung(schritte, ['V11'], rel);
    }
    default:
      return { ok: false, erkannt: `unbekannter Verstoss ${name}` };
  }
}

/**
 * Baut je Verstoss genau einen Fehler in einen temporären Klon ein und erwartet «rot» mit dem richtigen Grund.
 * Reihenfolge: --nur-Namen, F1, F0-sperre, F0-last (TR-E101-01, -13).
 * @param {{ cwd: string; nur?: string[]; last?: import('./last.mjs').Last }} opts
 * @returns {Promise<Eintrag[]>}
 */
export async function runSelftest(opts) {
  const namen = waehleVerstoesse(opts.nur);
  const root = wurzel(resolve(opts.cwd)) ?? resolve(opts.cwd);
  const f1 = checkNode({ packageJson: join(root, 'package.json'), nvmrc: join(root, '.nvmrc') });
  if (!f1.ok) {
    return [
      {
        verstoss: 'F1',
        erwartet: 'Node gemäss engines.node',
        erkannt: f1.ursache ?? null,
        ok: false,
      },
    ];
  }
  const sperre = await belegeSperre({
    modus: 'selftest',
    worktree: root,
    env: process.env,
    ...(opts.last === undefined ? {} : { last: opts.last }),
  });
  if (!sperre.ok) {
    return [
      {
        verstoss: 'F0-sperre',
        erwartet: 'frei',
        erkannt: sperre.schritt.ursache ?? null,
        ok: false,
      },
    ];
  }
  /** @type {string | null} */
  let tmp = null;
  try {
    if (!sperre.geschachtelt) {
      const l = await pruefeFremdlast({
        eigenePid: process.pid,
        ...(opts.last === undefined ? {} : { last: opts.last }),
      });
      if (!l.ok) {
        return [
          {
            verstoss: 'F0-last',
            erwartet: 'keine fremde Last',
            erkannt: l.ursache ?? null,
            ok: false,
          },
        ];
      }
    }
    tmp = mkdtempSync(join(tmpdir(), 'wap-selbsttest-'));
    const keineHooks = join(tmp, 'keine-hooks');
    mkdirSync(keineHooks);
    const zweig = zweigVon(root);
    const paket = zweig.startsWith('wap/') ? zweig.slice(4).toLowerCase() : null;
    const nodeModules = join(root, 'node_modules');
    const basis = join(tmp, 'basis');
    klone(root, basis, zweig, nodeModules, keineHooks);
    arbeitsstand(root, basis);
    /** @type {Eintrag[]} */
    const liste = [];
    for (const name of namen) {
      const ziel = join(tmp, `v-${name.toLowerCase()}`);
      const erwartet = VERSTOESSE.find(([n]) => n === name)?.[1] ?? '';
      try {
        klone(basis, ziel, zweig, nodeModules, keineHooks);
        const r = await pruefeVerstoss(name, {
          root: ziel,
          zweig,
          paket,
          sperre: sperre.envWert,
          tmp,
          wt: root,
        });
        liste.push({ verstoss: name, erwartet, erkannt: r.erkannt, ok: r.ok });
      } catch (e) {
        liste.push({
          verstoss: name,
          erwartet,
          erkannt: `Aufbau gescheitert: ${e instanceof Error ? e.message : String(e)}`,
          ok: false,
        });
      }
    }
    return liste;
  } finally {
    await sperre.freigeben();
    if (tmp !== null) rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  }
}

// CLI: Aufruf als Skript (Vertrag §1, §9 Nr 13).
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--nur');
  const nur = i >= 0 ? (args[i + 1] ?? '').split(',').filter((n) => n.trim() !== '') : undefined;
  /** @type {string[] | null} */
  let gewaehlt = null;
  try {
    if (
      (i >= 0 && (nur === undefined || nur.length === 0)) ||
      args.some((_a, k) => k !== i && k !== i + 1)
    ) {
      throw new Error(
        `Aufruf: node scripts/wap-gate/selftest.mjs [--nur S1,S2,…]. Gültige Namen: ${VERSTOESSE.map(([n]) => n).join(', ')}`,
      );
    }
    gewaehlt = waehleVerstoesse(nur);
  } catch (e) {
    fehlerMeldung(e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  }
  if (gewaehlt !== null) {
    const liste = await runSelftest({ cwd: process.cwd(), ...(nur === undefined ? {} : { nur }) });
    hinweis('Verstoss | erwartet | erkannt | Ergebnis');
    for (const e of liste) {
      hinweis(
        `${e.verstoss} | ${e.erwartet} | ${e.erkannt ?? '–'} | ${e.ok ? 'erkannt' : 'NICHT ERKANNT'}`,
      );
    }
    const ok = liste.length > 0 && liste.every((e) => e.ok);
    hinweis(
      ok ? `Selbsttest: alle ${String(liste.length)} Verstösse erkannt.` : 'Selbsttest: rot.',
    );
    process.exitCode = ok ? 0 : 1;
  }
}
