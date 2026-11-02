// Nachweis-Modi nach Code-Review Runde 9 – R-H-05, R-H-07, R-H-08.
// Vertrag: docs/wap-planer/pakete/H0.md, «Präzisierungen nach Eskalation 1», P47d, P44h (präzisiert),
// P44l, P44k (präzisiert), P44m (CR-H0S-54 bis -58; Nachbau aus .qa/h0/review-skripte-9/); Korrekturen
// nach Test-Review Runde 30 (TR-H0-119 bis -125; P47d gilt für jede Meldung, die einen Pfad nennt).
// Verbotene Muster werden zur Laufzeit zusammengesetzt; nur fiktive Daten. In Fällen mit Muster werden
// nur stille Prüfungen verwendet (keine Wiedergabe der Ausgabe in Fehlermeldungen, TR-H0-122).
// Runde 33: TR-H0-126 bis -129 und P47e (lock-update, guard-edit, privacy-scan unter P47d).
// Runde 34: TR-H0-130 bis -133 und P47f (Trennerform frei bei Pfaden aus Dateisystem oder Aufruf;
// Aufrufargumente sind Meldungsstellen mit Pfad).
import { closeSync, openSync, rmSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorktree,
  appendProtokoll,
  cleanupSandboxes,
  git,
  gitRaw,
  initRepo,
  junction,
  LOCK_PATH,
  lockFiles,
  protokollZeile,
  type RunResult,
  runScript,
  type Sandbox,
  sha256Lf,
  writeLock,
  writeText,
} from './helpers';
import { blobAus, commitDateien, sandbox, scanObjekte, TELEFON } from './helpers-objekte';
import { commitAusEintraegen, eintraegeVon } from './helpers-objekte-r8';
import {
  expectMaskiertStill,
  expectPfadMaskiertInZeilen,
  musterArten,
  zeilenMit,
} from './helpers-objekte-r9';

afterEach(cleanupSandboxes);

function lockCheck(sb: Sandbox, scriptRoot: string, ...args: string[]): RunResult {
  return runScript(sb, scriptRoot, 'lock-check.mjs', args, { cwd: scriptRoot });
}

const GESPERRT = 'tests/wap/Foo.test.ts';
const EINGEFROREN = 'eingefroren\n';
const ch = (code: number): string => String.fromCharCode(code);

/** Sperrstand auf wap-planer mit einer gesperrten Datei `rel`; gibt Wurzel und Commit zurück. */
function sperrstand(sb: Sandbox, rel = GESPERRT): { root: string; vorher: string } {
  const root = initRepo(sb, 'haupt');
  lockFiles(root, { [rel]: EINGEFROREN });
  git(sb, root, 'add', '--', rel, LOCK_PATH);
  git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Sperrstand');
  return { root, vorher: git(sb, root, 'rev-parse', 'HEAD') };
}

/** Commit-Versuch über den Hook mit einem per cacheinfo gestagten Eintrag. */
function commitVersuch(sb: Sandbox, root: string, rel: string) {
  const blob = blobAus(sb, root, 'geaendert\n');
  git(sb, root, 'update-index', '--add', '--cacheinfo', `100644,${blob},${rel}`);
  const vorher = git(sb, root, 'rev-parse', 'HEAD');
  const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
  return { r, committed: git(sb, root, 'rev-parse', 'HEAD') !== vorher };
}

function hookInstallieren(sb: Sandbox, root: string): void {
  expect(runScript(sb, root, 'install-hooks.mjs', []).status).toBe(0);
}

// ---------------------------------------------------------------------------------------------
// P47d (CR-H0S-54): Kollisionsmeldungen maskiert und einzeilig
// ---------------------------------------------------------------------------------------------
describe('P47d: Kollisionsmeldungen prüfen den Pfad nach P19 und bleiben einzeilig (CR-H0S-54)', () => {
  /** Zweig wap/p = Sperrstand plus Eintrag `zusatz` (commit-tree, auch für Pfade, die der Index abweist). */
  function mitZusatz(sb: Sandbox, zusatz: string): { root: string } {
    const { root, vorher } = sperrstand(sb);
    const blob = blobAus(sb, root, 'geaendert\n');
    commitAusEintraegen(
      sb,
      root,
      [...eintraegeVon(sb, root, vorher), { modus: '100644', oid: blob, pfad: zusatz }],
      [vorher],
      'wap/p',
    );
    return { root };
  }

  it.each(musterArten())(
    '[R-H-05] K-A1: Kollisionseintrag unter Tests/ mit %s im Pfad neben tests/wap/Foo.test.ts; lock-check --ref wap/p → Exit 1 «Kollision» mit «(Pfad maskiert)», Treffer maskiert (TR-H0-120, TR-H0-123)',
    (_label, geheim, pfadteil) => {
      const sb = sandbox();
      const { root } = mitZusatz(sb, `Tests/${pfadteil}.md`);
      const r = lockCheck(sb, root, '--root', root, '--ref', 'wap/p');
      expect(r.status).toBe(1);
      expectPfadMaskiertInZeilen(r.out, 'Kollision');
      expectMaskiertStill(sb, r, geheim, [root]);
    },
    60_000,
  );

  it.each(musterArten())(
    '[R-H-08][R-H-05] K-A3: Commit-Hook, gestagter Kollisionseintrag unter Tests/ mit %s im Pfad → Commit scheitert, «Kollision» mit «(Pfad maskiert)», Treffer maskiert (TR-H0-120, TR-H0-123)',
    (_label, geheim, pfadteil) => {
      const sb = sandbox();
      const { root } = sperrstand(sb);
      hookInstallieren(sb, root);
      const v = commitVersuch(sb, root, `Tests/${pfadteil}.md`);
      expect(v.committed).toBe(false);
      expectPfadMaskiertInZeilen(v.r.out, 'Kollision');
      expectMaskiertStill(sb, v.r, geheim, [root]);
    },
    60_000,
  );

  it('[R-H-05] K-A2: Kollisionseintrag mit Zeilenumbruch und angehängter Schein-Erfolgszeile (per mktree); lock-check --ref wap/p → Exit 1, Kollisionsmeldung einzeilig mit \\x0a, keine eigene Zeile «in Ordnung»', () => {
    const sb = sandbox();
    const { root } = mitZusatz(sb, `Tests/zeile${ch(10)}Lock-Prüfung: 1 Datei in Ordnung.md`);
    const r = lockCheck(sb, root, '--root', root, '--ref', 'wap/p');
    expect(r.status).toBe(1);
    const zeilen = r.out.split(/\r?\n/);
    const kollision = zeilen.filter((z) => z.includes('Kollision'));
    expect(kollision.length).toBeGreaterThan(0);
    expect(kollision.some((z) => /\\x0a/i.test(z))).toBe(true);
    expect(zeilen.filter((z) => z.includes('in Ordnung') && !z.includes('Kollision'))).toEqual([]);
  }, 60_000);

  // TR-H0-121: Steuerzeichen (C0, C1), Bidi und Backslash in der Kollisionsmeldung.
  const ZEICHEN: Array<[string, string, RegExp]> = [
    ['Wagenrücklauf (CR) als \\x0d', ch(13), /Tests\/a\\x0db\.md/i],
    ['C1-Zeichen U+0085 als \\u{0085}', ch(0x85), /Tests\/a\\u\{0085\}b\.md/i],
    ['Bidi-Zeichen U+202E als \\u{202E}', ch(0x202e), /Tests\/a\\u\{202E\}b\.md/i],
    ['wörtlicher Backslash als \\\\', ch(92), /Tests\/a\\\\b\.md/],
  ];

  /** Prüft: genaue Escape-Form auf einer Kollisionszeile, kein rohes Zeichen in der Ausgabe. */
  function expectEscape(out: string, zeichen: string, form: RegExp): void {
    expectEscapeZeile(out, 'Kollision', zeichen, form);
  }

  it.each(ZEICHEN)(
    '[R-H-05] lock-check --ref wap/p, Kollisionseintrag Tests/a<…>b.md mit %s → Exit 1, genaue Escape-Form, kein rohes Zeichen, Meldung einzeilig (TR-H0-121)',
    (_label, zeichen, form) => {
      const sb = sandbox();
      const { root } = mitZusatz(sb, `Tests/a${zeichen}b.md`);
      const r = lockCheck(sb, root, '--root', root, '--ref', 'wap/p');
      expect(r.status).toBe(1);
      expectEscape(r.out, zeichen, form);
    },
    60_000,
  );

  it.each(ZEICHEN)(
    '[R-H-08][R-H-05] Commit-Hook (Repo mit core.protectNTFS=false), gestagter Kollisionseintrag Tests/a<…>b.md mit %s → Commit scheitert, genaue Escape-Form, kein rohes Zeichen, Meldung einzeilig (TR-H0-121)',
    (_label, zeichen, form) => {
      const sb = sandbox();
      const { root } = sperrstand(sb);
      git(sb, root, 'config', 'core.protectNTFS', 'false');
      hookInstallieren(sb, root);
      const v = commitVersuch(sb, root, `Tests/a${zeichen}b.md`);
      expect(v.committed).toBe(false);
      expectEscape(v.r.out, zeichen, form);
    },
    60_000,
  );

  it('[R-H-05] Gegenprobe: Kollisionseinträge, die sich nur durch Backslash-Text «\\x0a» gegenüber echtem Zeilenumbruch unterscheiden, ergeben verschiedene Kollisionszeilen (TR-H0-121)', () => {
    const zeileFuer = (pfad: string): string => {
      const sb = sandbox();
      const { root } = mitZusatz(sb, pfad);
      const r = lockCheck(sb, root, '--root', root, '--ref', 'wap/p');
      return zeilenMit(withoutRoot(r.out, root), 'Kollision').join('|');
    };
    const mitText = zeileFuer(`Tests/a${ch(92)}x0ab.md`);
    const mitLf = zeileFuer(`Tests/a${ch(10)}b.md`);
    expect(mitText.length).toBeGreaterThan(0);
    expect(mitText).not.toBe(mitLf);
  }, 60_000);

  it('[R-H-05] Kollisionseintrag ohne Muster (Tests/wap/Foo.test.ts); lock-check --ref wap/p → Exit 1, Kollisionsmeldung nennt den Pfad im Klartext (Gegenprobe)', () => {
    const sb = sandbox();
    const { root } = mitZusatz(sb, 'Tests/wap/Foo.test.ts');
    const r = lockCheck(sb, root, '--root', root, '--ref', 'wap/p');
    expect(r.status).toBe(1);
    const zeile = r.out.split(/\r?\n/).find((z) => z.includes('Kollision'));
    expect(zeile).toContain('Tests/wap/Foo.test.ts');
  }, 60_000);

  it('[R-H-08][R-H-05] Commit-Hook, gestagter Kollisionseintrag ohne Muster (Tests/wap/Foo.test.ts) → Commit scheitert, Kollisionsmeldung nennt den Pfad im Klartext (Gegenprobe)', () => {
    const sb = sandbox();
    const { root } = sperrstand(sb);
    hookInstallieren(sb, root);
    const v = commitVersuch(sb, root, 'Tests/wap/Foo.test.ts');
    expect(v.committed).toBe(false);
    const zeile = v.r.out.split(/\r?\n/).find((z) => z.includes('Kollision'));
    expect(zeile).toContain('Tests/wap/Foo.test.ts');
  }, 60_000);
});

/** Entfernt den Sandbox-Pfad aus einer Ausgabe (für Zeilenvergleiche zwischen zwei Sandboxen). */
function withoutRoot(out: string, root: string): string {
  return out
    .split(root)
    .join('')
    .split(root.split(ch(92)).join('/'))
    .join('');
}

// ---------------------------------------------------------------------------------------------
// P47d für alle übrigen Pfadmeldungen (TR-H0-119)
// ---------------------------------------------------------------------------------------------
describe('P47d: jede Meldung, die einen gesperrten Pfad nennt, ist nach P19 maskiert (TR-H0-119)', () => {
  type Einstieg = (
    sb: Sandbox,
    root: string,
    rel: string,
  ) => { r: { status: number | null; out: string }; wort: string };

  const EINSTIEGE: Array<[string, Einstieg]> = [
    [
      'lock-check (Arbeitsbaum), Datei geändert',
      (sb, root, rel) => {
        writeText(root, rel, 'geaendert\n');
        return { r: lockCheck(sb, root, '--root', root), wort: 'geändert' };
      },
    ],
    [
      'lock-check --ref wap-planer, Datei im Stand geändert',
      (sb, root, rel) => {
        commitDateien(sb, root, { [rel]: 'geaendert\n' }, 'geändert');
        return { r: lockCheck(sb, root, '--root', root, '--ref', 'wap-planer'), wort: 'geändert' };
      },
    ],
    [
      'lock-check --gegen HEAD (Arbeitsbaum), Hash ohne Protokoll nachgeführt',
      (sb, root, rel) => {
        lockFiles(root, { [rel]: 'nachgefuehrt\n' });
        return {
          r: lockCheck(sb, root, '--root', root, '--gegen', 'HEAD'),
          wort: 'nicht protokolliert',
        };
      },
    ],
    [
      'Commit-Hook, geänderte Datei gestagt',
      (sb, root, rel) => {
        hookInstallieren(sb, root);
        writeText(root, rel, 'geaendert\n');
        git(sb, root, 'add', '--', rel);
        const vorher = git(sb, root, 'rev-parse', 'HEAD');
        const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
        expect(git(sb, root, 'rev-parse', 'HEAD')).toBe(vorher);
        return { r, wort: 'geändert' };
      },
    ],
    // TR-H0-126: «fehlt», «nicht im Index», «ungültiger Hash für».
    [
      'lock-check (Arbeitsbaum), gesperrte Datei gelöscht («fehlt», TR-H0-126 a)',
      (sb, root, rel) => {
        rmSync(join(root, ...rel.split('/')), { force: true });
        return { r: lockCheck(sb, root, '--root', root), wort: 'fehlt' };
      },
    ],
    [
      'lock-check --ref wap-planer, Datei im Stand gelöscht («fehlt», TR-H0-126 b)',
      (sb, root, rel) => {
        git(sb, root, 'rm', '-q', '--', rel);
        git(sb, root, 'commit', '-q', '--no-verify', '-m', 'gelöscht');
        return { r: lockCheck(sb, root, '--root', root, '--ref', 'wap-planer'), wort: 'fehlt' };
      },
    ],
    [
      'Commit-Hook nach git rm --cached («nicht im Index», TR-H0-126 c)',
      (sb, root, rel) => {
        hookInstallieren(sb, root);
        git(sb, root, 'rm', '-q', '--cached', '--', rel);
        return { r: hookCommit(sb, root), wort: 'nicht im Index' };
      },
    ],
    [
      'lock-check (Arbeitsbaum), Sperrdatei mit ungültigem Hash («ungültiger Hash für», TR-H0-126 d)',
      (sb, root, rel) => {
        writeLock(root, { [rel]: 'kein-hash' });
        return { r: lockCheck(sb, root, '--root', root), wort: 'ungültiger Hash für' };
      },
    ],
    [
      'lock-check --ref wap-planer, Sperrdatei im Stand mit ungültigem Hash («ungültiger Hash für», TR-H0-126 d)',
      (sb, root, rel) => {
        writeLock(root, { [rel]: 'kein-hash' });
        git(sb, root, 'add', LOCK_PATH);
        git(sb, root, 'commit', '-q', '--no-verify', '-m', 'ungültig');
        return {
          r: lockCheck(sb, root, '--root', root, '--ref', 'wap-planer'),
          wort: 'ungültiger Hash für',
        };
      },
    ],
    [
      'Commit-Hook, gestagte Sperrdatei mit ungültigem Hash («ungültiger Hash für», TR-H0-126 d)',
      (sb, root, rel) => {
        hookInstallieren(sb, root);
        writeLock(root, { [rel]: 'kein-hash' });
        git(sb, root, 'add', LOCK_PATH);
        return { r: hookCommit(sb, root), wort: 'ungültiger Hash für' };
      },
    ],
    // TR-H0-128: «nicht protokolliert» in --ref --gegen und im Hook, «protokolliert, aber ohne
    // Abweichung», «ungültig: … ausserhalb».
    [
      'lock-check --ref wap-planer --gegen <vorher>, Hash ohne Protokoll nachgeführt («nicht protokolliert», TR-H0-128)',
      (sb, root, rel) => {
        const vorher = git(sb, root, 'rev-parse', 'HEAD');
        lockFiles(root, { [rel]: 'nachgefuehrt\n' });
        git(sb, root, 'add', '--', rel, LOCK_PATH);
        git(sb, root, 'commit', '-q', '--no-verify', '-m', 'nachgeführt');
        return {
          r: lockCheck(sb, root, '--root', root, '--ref', 'wap-planer', '--gegen', vorher),
          wort: 'nicht protokolliert',
        };
      },
    ],
    [
      'Commit-Hook, gestagte Nachführung ohne Protokoll («nicht protokolliert», TR-H0-128)',
      (sb, root, rel) => {
        hookInstallieren(sb, root);
        lockFiles(root, { [rel]: 'nachgefuehrt\n' });
        git(sb, root, 'add', '--', rel, LOCK_PATH);
        return { r: hookCommit(sb, root), wort: 'nicht protokolliert' };
      },
    ],
    [
      'lock-check --gegen HEAD, Protokollzeile nennt den unveränderten Pfad («protokolliert, aber ohne Abweichung», TR-H0-128)',
      (sb, root, rel) => {
        const zusatz = 'tests/wap/zusatz.test.ts';
        lockFiles(root, { [rel]: EINGEFROREN, [zusatz]: 'z\n' });
        appendProtokoll(root, protokollZeile([zusatz, rel]));
        return {
          r: lockCheck(sb, root, '--root', root, '--gegen', 'HEAD'),
          wort: 'protokolliert, aber ohne Abweichung',
        };
      },
    ],
    [
      'lock-check (Arbeitsbaum), Sperrschlüssel ../<pfad> («ungültig: … ausserhalb», TR-H0-128)',
      (sb, root, rel) => {
        writeLock(root, { [`../${rel}`]: sha256Lf(EINGEFROREN) });
        return { r: lockCheck(sb, root, '--root', root), wort: 'ungültig' };
      },
    ],
  ];

  /** Commit über den Hook; HEAD muss unverändert bleiben. */
  function hookCommit(sb: Sandbox, root: string): RunResult {
    const vorher = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    expect(git(sb, root, 'rev-parse', 'HEAD')).toBe(vorher);
    return r;
  }

  const FAELLE: Array<[string, string, Einstieg, string, string]> = [];
  for (const [einstieg, f] of EINSTIEGE) {
    for (const [art, geheim, pfadteil] of musterArten()) {
      FAELLE.push([einstieg, art, f, geheim, pfadteil]);
    }
  }

  it.each(FAELLE)(
    '[R-H-05][R-H-07] %s, gesperrter Pfad tests/wap/<…>.test.ts mit %s → Exit 1, Meldung nennt den Pfad nur als «(Pfad maskiert)», Treffer maskiert',
    (_einstieg, _art, f, geheim, pfadteil) => {
      const sb = sandbox();
      const rel = `tests/wap/${pfadteil}.test.ts`;
      const { root } = sperrstand(sb, rel);
      const { r, wort } = f(sb, root, rel);
      expect(r.status).toBe(1);
      expectPfadMaskiertInZeilen(r.out, wort);
      expectMaskiertStill(sb, r as RunResult, geheim, [root]);
    },
    60_000,
  );

  it.each(EINSTIEGE)(
    '[R-H-05] %s, gesperrter Pfad ohne Muster (tests/wap/Foo.test.ts) → Exit 1, Meldung nennt den Pfad im Klartext (Gegenprobe)',
    (_einstieg, f) => {
      const sb = sandbox();
      const { root } = sperrstand(sb);
      const { r, wort } = f(sb, root, GESPERRT);
      expect(r.status).toBe(1);
      expect(zeilenMit(r.out, wort).some((z) => z.includes(GESPERRT))).toBe(true);
    },
    60_000,
  );

  it('[R-H-05] lock-check --ref wap-planer, gesperrter Schlüssel mit Zeilenumbruch und Schein-Erfolgszeile, im Stand geändert → Exit 1, Zeile «geändert» mit \\x0a, keine eigene Zeile «in Ordnung» (TR-H0-129)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const vorher = git(sb, root, 'rev-parse', 'HEAD');
    const schluessel = `tests/wap/a${ch(10)}Lock-Prüfung: 1 Datei in Ordnung.test.ts`;
    const lock = `${JSON.stringify({ version: 1, files: { [schluessel]: sha256Lf(EINGEFROREN) } }, null, 2)}\n`;
    commitAusEintraegen(
      sb,
      root,
      [
        ...eintraegeVon(sb, root, vorher),
        { modus: '100644', oid: blobAus(sb, root, lock), pfad: LOCK_PATH },
        { modus: '100644', oid: blobAus(sb, root, 'geaendert\n'), pfad: schluessel },
      ],
      [vorher],
      'wap-planer',
    );
    const r = lockCheck(sb, root, '--root', root, '--ref', 'wap-planer');
    expect(r.status).toBe(1);
    const zeilen = r.out.split(/\r?\n/);
    expect(zeilenMit(r.out, 'geändert').some((z) => /\\x0a/i.test(z))).toBe(true);
    expect(zeilen.filter((z) => z.includes('in Ordnung') && !z.includes('geändert'))).toEqual([]);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------
// P47d/P47e in privacy-scan: Escape-Regel für Befundpfade (TR-H0-127)
// ---------------------------------------------------------------------------------------------
describe('P47d/P47e: privacy-scan gibt Pfade mit C1-, Bidi- und Backslash-Zeichen in Escape-Form aus (TR-H0-127)', () => {
  // TR-H0-133: Die Befundzeile wird über «<pfad>:<zeile>:» gefunden, nicht über den Wortlaut der Art.
  const ZEICHEN_SCAN: Array<[string, string, RegExp]> = [
    ['C1-Zeichen U+0085 als \\u{0085}', ch(0x85), /docs\/wap-planer\/a\\u\{0085\}b\.md:1:/i],
    ['Bidi-Zeichen U+202E als \\u{202E}', ch(0x202e), /docs\/wap-planer\/a\\u\{202E\}b\.md:1:/i],
    ['wörtlicher Backslash als \\\\', ch(92), /docs\/wap-planer\/a\\\\b\.md:1:/],
  ];
  const MODI = ['--staged (core.protectNTFS=false)', '--baum', '--commits'];
  const FAELLE: Array<[string, string, string, RegExp]> = [];
  for (const modus of MODI) {
    for (const [label, zeichen, form] of ZEICHEN_SCAN) FAELLE.push([modus, label, zeichen, form]);
  }

  /** Datei docs/wap-planer/a<zeichen>b.md mit Telefonnummer im Inhalt im gewählten Objekt-Modus prüfen. */
  function scanMit(sb: Sandbox, modus: string, pfad: string): { r: RunResult; root: string } {
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    const blob = blobAus(sb, root, `Kontakt ${TELEFON}\n`);
    if (modus.startsWith('--staged')) {
      git(sb, root, 'config', 'core.protectNTFS', 'false');
      git(sb, root, 'update-index', '--add', '--cacheinfo', `100644,${blob},${pfad}`);
      return { r: scanObjekte(sb, root, ['--staged']), root };
    }
    commitAusEintraegen(
      sb,
      root,
      [...eintraegeVon(sb, root, basis), { modus: '100644', oid: blob, pfad }],
      [basis],
      'sonder',
    );
    const args =
      modus === '--baum'
        ? ['--root', root, '--baum', 'sonder']
        : ['--root', root, '--commits', `${basis}..sonder`];
    return { r: scanObjekte(sb, root, args), root };
  }

  it.each(FAELLE)(
    '[R-H-07] %s: Datei docs/wap-planer/a<…>b.md mit %s und Telefonnummer im Inhalt → Exit 1, genaue Escape-Form auf der Befundzeile, kein rohes Zeichen, Treffer still maskiert',
    (modus, _label, zeichen, form) => {
      const sb = sandbox();
      const { r, root } = scanMit(sb, modus, `docs/wap-planer/a${zeichen}b.md`);
      expect(r.status).toBe(1);
      expectEscapeZeile(r.out, ':1:', zeichen, form);
      expectMaskiertStill(sb, r, TELEFON, [root]);
    },
    60_000,
  );

  it.each(ZEICHEN_SCAN.filter(([, zeichen]) => zeichen !== ch(92)))(
    '[R-H-07] Pfad-Modus: Datei docs/wap-planer/a<…>b.md mit %s auf NTFS und Telefonnummer im Inhalt → Exit 1, genaue Escape-Form auf der Befundzeile, kein rohes Zeichen, Treffer still maskiert',
    (_label, zeichen, form) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      writeText(root, `docs/wap-planer/a${zeichen}b.md`, `Kontakt ${TELEFON}\n`);
      const r = scanObjekte(sb, root, ['docs/wap-planer']);
      expect(r.status).toBe(1);
      // P47f (a): Pfad aus dem Dateisystem, Trenner in jeder erlaubten Form.
      expectEscapeZeile(r.out, ':1:', zeichen, trennerFrei(form));
      expectMaskiertStill(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07] --baum: Dateien a<Text \\x0a>b.md und a<Zeilenumbruch>b.md mit Telefonnummer ergeben verschiedene Befundzeilen (Gegenprobe)', () => {
    const zeileFuer = (pfad: string): string => {
      const sb = sandbox();
      const { r, root } = scanMit(sb, '--baum', pfad);
      return zeilenMit(withoutRoot(r.out, root), ':1:').join('|');
    };
    const mitText = zeileFuer(`docs/wap-planer/a${ch(92)}x0ab.md`);
    const mitLf = zeileFuer(`docs/wap-planer/a${ch(10)}b.md`);
    expect(mitText.length).toBeGreaterThan(0);
    expect(mitText === mitLf, 'gleiche Befundzeilen').toBe(false);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------
// P47e: lock-update.mjs und guard-edit.mjs fallen unter P47d
// ---------------------------------------------------------------------------------------------
describe('P47e: lock-update nennt Pfade nur nach P19 maskiert und in Escape-Form', () => {
  function lockUpdate(sb: Sandbox, root: string, ...args: string[]): RunResult {
    return runScript(sb, root, 'lock-update.mjs', ['--grund', 'Test', ...args], { cwd: root });
  }

  /** `name`: in der Gegenprobe ohne Muster sichtbarer Teil (Standard: Dateiname von `rel`). */
  type Fall = (
    sb: Sandbox,
    root: string,
    rel: string,
  ) => { r: RunResult; wort: string; name?: string };

  const FAELLE_LU: Array<[string, Fall]> = [
    [
      '--add auf eine nicht existierende Datei («existiert nicht»)',
      (sb, root, rel) => ({ r: lockUpdate(sb, root, '--add', rel), wort: 'existiert nicht' }),
    ],
    [
      '--add auf einen Ordner («ist keine Datei»)',
      (sb, root, rel) => {
        writeText(root, `${rel}/innen.txt`, 'x\n');
        return { r: lockUpdate(sb, root, '--add', rel), wort: 'keine Datei' };
      },
    ],
    [
      '--remove auf einen nicht gesperrten Pfad («nicht gesperrt»)',
      (sb, root, rel) => {
        lockFiles(root, { 'tests/wap/anders.test.ts': EINGEFROREN });
        writeText(root, rel, 'x\n');
        return { r: lockUpdate(sb, root, '--remove', rel), wort: 'nicht gesperrt' };
      },
    ],
    [
      '--add auf eine Datei ausserhalb des Worktrees, relativ mit / übergeben («liegt ausserhalb», TR-H0-130)',
      (sb, root, rel) => {
        writeText(sb.base, `aussen/${rel}`, 'x\n');
        return { r: lockUpdate(sb, root, '--add', `../aussen/${rel}`), wort: 'ausserhalb' };
      },
    ],
    [
      '--add mit «|» im Pfad («im Pfad ist nicht erlaubt», TR-H0-131)',
      (sb, root, rel) => {
        const mitStrich = rel.replace('tests/wap/', 'tests/wap/a|');
        return {
          r: lockUpdate(sb, root, '--add', mitStrich),
          wort: 'nicht erlaubt',
          name: mitStrich.split('/').pop(),
        };
      },
    ],
    [
      '--add über eine Junction nach ausserhalb des Worktrees («liegt ausserhalb», TR-H0-131)',
      (sb, root, rel) => {
        const ordner = rel.replace(/\.test\.ts$/, '');
        writeText(sb.base, 'aussen-j/f.test.ts', 'x\n');
        junction(join(root, ...ordner.split('/')), join(sb.base, 'aussen-j'));
        return {
          r: lockUpdate(sb, root, '--add', `${ordner}/f.test.ts`),
          wort: 'ausserhalb',
          name: ordner.split('/').pop(),
        };
      },
    ],
    [
      'Pfad ohne Aktion («Unbekanntes Argument», P47f b, TR-H0-131)',
      (sb, root, rel) => ({ r: lockUpdate(sb, root, rel), wort: 'Unbekanntes Argument' }),
    ],
    [
      '--refresh-all mit ungültigem Hash in der Sperrdatei («ungültiger Hash für»)',
      (sb, root, rel) => {
        writeLock(root, { [rel]: 'kein-hash' });
        return { r: lockUpdate(sb, root, '--refresh-all'), wort: 'ungültiger Hash für' };
      },
    ],
  ];

  const FAELLE: Array<[string, string, Fall, string, string]> = [];
  for (const [fall, f] of FAELLE_LU) {
    for (const [art, geheim, pfadteil] of musterArten())
      FAELLE.push([fall, art, f, geheim, pfadteil]);
  }

  it.each(FAELLE)(
    '[R-H-06] lock-update %s, Pfad tests/wap/<…>.test.ts mit %s → Exit 1, Meldung nennt den Pfad nur als «(Pfad maskiert)», Treffer maskiert',
    (_fall, _art, f, geheim, pfadteil) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const { r, wort } = f(sb, root, `tests/wap/${pfadteil}.test.ts`);
      expect(r.status).toBe(1);
      expectPfadMaskiertInZeilen(r.out, wort);
      expectMaskiertStill(sb, r, geheim, [root]);
    },
    60_000,
  );

  it.each(FAELLE_LU)(
    '[R-H-06] lock-update %s, Pfad ohne Muster (tests/wap/Foo.test.ts) → Exit 1, Meldung nennt den Pfad im Klartext (Gegenprobe)',
    (_fall, f) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const { r, wort, name } = f(sb, root, GESPERRT);
      expect(r.status).toBe(1);
      // TR-H0-130, P47f (a): nur der Name wird verlangt, die Trennerform ist frei.
      const sichtbar = name ?? (GESPERRT.split('/').pop() as string);
      expect(zeilenMit(r.out, wort).some((z) => z.includes(sichtbar))).toBe(true);
    },
    60_000,
  );

  it.each([
    ['C1-Zeichen U+0085 als \\u{0085}', ch(0x85), /tests\/a\\u\{0085\}b\.ts/i],
    ['Bidi-Zeichen U+202E als \\u{202E}', ch(0x202e), /tests\/a\\u\{202E\}b\.ts/i],
    ['Zeilenumbruch (LF) als \\x0a (TR-H0-132)', ch(10), /tests\/a\\x0ab\.ts/i],
  ] as Array<[string, string, RegExp]>)(
    '[R-H-06] lock-update --remove auf den nicht gesperrten Pfad tests/a<…>b.ts mit %s → Exit 1, genaue Escape-Form auf der Zeile «nicht gesperrt», kein rohes Zeichen, keine Folgezeile',
    (_label, zeichen, form) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const rel = `tests/a${zeichen}b.ts`;
      lockFiles(root, { 'tests/wap/anders.test.ts': EINGEFROREN });
      if (zeichen !== ch(10)) writeText(root, rel, 'x\n');
      const r = lockUpdate(sb, root, '--remove', rel);
      expect(r.status).toBe(1);
      expectEscapeZeile(r.out, 'nicht gesperrt', zeichen, trennerFrei(form));
    },
    60_000,
  );
});

describe('P47e: guard-edit nennt Pfade nur nach P19 maskiert und in Escape-Form', () => {
  function guard(sb: Sandbox, root: string, ziel: string): RunResult {
    const input = JSON.stringify({
      session_id: 'harness-test',
      hook_event_name: 'PreToolUse',
      cwd: root,
      tool_name: 'Edit',
      tool_input: { file_path: ziel, old_string: 'a', new_string: 'b' },
    });
    return runScript(sb, root, 'guard-edit.mjs', [], { cwd: root, input });
  }

  type Fall = (sb: Sandbox, root: string, pfadteil: string) => { r: RunResult; wort: string };

  const FAELLE_GE: Array<[string, Fall]> = [
    [
      'Edit auf eine in test-lock.json gesperrte Datei («R-H-03»)',
      (sb, root, pfadteil) => {
        const rel = `tests/wap/${pfadteil}.test.ts`;
        lockFiles(root, { [rel]: EINGEFROREN });
        return { r: guard(sb, root, join(root, ...rel.split('/'))), wort: 'R-H-03' };
      },
    ],
    [
      'Edit auf eine Harness-Datei unter scripts/wap/ («R-H-04»)',
      (sb, root, pfadteil) => {
        lockFiles(root, { [GESPERRT]: EINGEFROREN });
        return {
          r: guard(sb, root, join(root, 'scripts', 'wap', `${pfadteil}.mjs`)),
          wort: 'R-H-04',
        };
      },
    ],
    [
      'Edit bei Sperrdatei mit ungültigem Hash («ungültiger Hash für»)',
      (sb, root, pfadteil) => {
        writeLock(root, { [`tests/wap/${pfadteil}.test.ts`]: 'kein-hash' });
        return { r: guard(sb, root, join(root, 'README.md')), wort: 'ungültiger Hash für' };
      },
    ],
  ];

  const FAELLE: Array<[string, string, Fall, string, string]> = [];
  for (const [fall, f] of FAELLE_GE) {
    for (const [art, geheim, pfadteil] of musterArten())
      FAELLE.push([fall, art, f, geheim, pfadteil]);
  }

  it.each(FAELLE)(
    '[R-H-03][R-H-04] guard-edit %s, Pfad mit %s → Exit 2, Meldung nennt den Pfad nur als «(Pfad maskiert)», Treffer maskiert',
    (_fall, _art, f, geheim, pfadteil) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const { r, wort } = f(sb, root, pfadteil);
      expect(r.status).toBe(2);
      expectPfadMaskiertInZeilen(r.out, wort);
      expectMaskiertStill(sb, r, geheim, [root]);
    },
    60_000,
  );

  it.each(FAELLE_GE)(
    '[R-H-03][R-H-04] guard-edit %s, Pfad ohne Muster → Exit 2, Meldung nennt den Pfad im Klartext (Gegenprobe)',
    (_fall, f) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const { r, wort } = f(sb, root, 'Foo');
      expect(r.status).toBe(2);
      expect(zeilenMit(r.out, wort).some((z) => z.includes('Foo'))).toBe(true);
    },
    60_000,
  );

  it.each([
    ['C1-Zeichen U+0085 als \\u{0085}', ch(0x85), /tests\/a\\u\{0085\}b\.ts/i],
    ['Bidi-Zeichen U+202E als \\u{202E}', ch(0x202e), /tests\/a\\u\{202E\}b\.ts/i],
    ['Zeilenumbruch (LF) als \\x0a (TR-H0-132)', ch(10), /tests\/a\\x0ab\.ts/i],
  ] as Array<[string, string, RegExp]>)(
    '[R-H-03] guard-edit Edit auf die gesperrte Datei tests/a<…>b.ts mit %s → Exit 2, genaue Escape-Form auf der Zeile «R-H-03», kein rohes Zeichen, keine Folgezeile',
    (_label, zeichen, form) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const rel = `tests/a${zeichen}b.ts`;
      if (zeichen === ch(10)) {
        // Sperrschlüssel mit LF; die Datei selbst kann es unter Windows nicht geben.
        writeLock(root, { [rel]: sha256Lf(EINGEFROREN) });
        writeText(root, 'tests/frei.ts', 'x\n');
      } else {
        lockFiles(root, { [rel]: EINGEFROREN });
      }
      const r = guard(sb, root, join(root, 'tests', `a${zeichen}b.ts`));
      expect(r.status).toBe(2);
      expectEscapeZeile(r.out, 'R-H-03', zeichen, trennerFrei(form));
    },
    60_000,
  );
});

/**
 * Prüft still: mindestens eine Zeile mit `wort` enthält die genaue Escape-Form, und das rohe Zeichen
 * steht nirgends in der Ausgabe (ausser dem wörtlichen Backslash, der in Windows-Pfaden der Ausgabe
 * vorkommen kann). Ein CR zählt nur als roh, wenn ihm kein LF folgt: CRLF-Zeilenenden, die Git für
 * Windows selbst ausgibt, sind keine rohe Ausgabe eines Pfads (Frage 2 test-reviewer Runde 31).
 */
function expectEscapeZeile(out: string, wort: string, zeichen: string, form: RegExp): void {
  const zeilen = zeilenMit(out, wort);
  expect(zeilen.length, `keine Zeile mit «${wort}»`).toBeGreaterThan(0);
  expect(
    zeilen.some((z) => form.test(z)),
    `Zeile mit «${wort}» ohne die genaue Escape-Form`,
  ).toBe(true);
  if (zeichen === ch(92)) return;
  if (zeichen === ch(10)) {
    // TR-H0-132: Ein rohes LF zeigte sich als eigene Folgezeile, die mit dem Rest des Namens beginnt.
    const folge = out.split(/\r?\n/).filter((z) => /^b\.(ts|md)\b/.test(z)).length;
    expect(folge, 'eigene Folgezeile mit dem Rest des Pfads (Anzahl)').toBe(0);
    return;
  }
  const pruefbar = zeichen === ch(13) ? out.split(`${ch(13)}${ch(10)}`).join(ch(10)) : out;
  expect(pruefbar.includes(zeichen), 'rohes Zeichen in der Ausgabe').toBe(false);
}

/**
 * P47f (a): Pfadtrenner in Windows-Pfaden aus Dateisystem oder Aufruf dürfen als `/`, `\` oder `\\`
 * erscheinen. Ersetzt in einer Erwartung jedes `\/` (Trenner) durch eine Gruppe, die alle drei Formen
 * zulässt; Escape-Formen für Zeichen im Namen bleiben exakt (TR-H0-130).
 */
function trennerFrei(form: RegExp): RegExp {
  return new RegExp(form.source.split('\\/').join('(?:\\/|\\\\{1,2})'), form.flags);
}

// ---------------------------------------------------------------------------------------------
// P44h präzisiert (CR-H0S-55): eindeutige Auflösung auch für --gegen im Arbeitsbaum-Modus
// ---------------------------------------------------------------------------------------------
describe('P44h präzisiert: lock-check --gegen im Arbeitsbaum-Modus löst den Ref eindeutig auf (CR-H0S-55)', () => {
  /** Paket-Worktree auf wap/p, der einen Hash nachführt (optional mit Protokollzeile) und committet. */
  function paketMitNachfuehrung(sb: Sandbox, protokolliert: boolean): { root: string; wt: string } {
    const { root } = sperrstand(sb);
    const wt = addWorktree(sb, root, join(sb.base, 'wt', 'p'), 'wap/p');
    lockFiles(wt, { [GESPERRT]: 'nachgefuehrt\n' });
    if (protokolliert) appendProtokoll(wt, protokollZeile([GESPERRT]));
    git(sb, wt, 'add', '-A', '--', 'tests', 'docs');
    git(sb, wt, 'commit', '-q', '--no-verify', '-m', 'nachgeführt');
    return { root, wt };
  }

  const SCHATTEN: Array<[string, (sb: Sandbox, root: string) => void]> = [
    ['ohne Tag (G1, Gegenprobe)', () => undefined],
    ['Tag wap-planer auf wap/p (G2)', (sb, root) => git(sb, root, 'tag', 'wap-planer', 'wap/p')],
    [
      'refs/wap-planer auf wap/p (G4)',
      (sb, root) => git(sb, root, 'update-ref', 'refs/wap-planer', 'wap/p'),
    ],
  ];

  it.each(SCHATTEN)(
    '[R-H-05] Paket-Worktree mit nachgeführtem Hash ohne Protokoll, %s; lock-check --root <paket> --gegen wap-planer → Exit 1 «nicht protokolliert»',
    (_label, anlegen) => {
      const sb = sandbox();
      const { root, wt } = paketMitNachfuehrung(sb, false);
      anlegen(sb, root);
      const r = lockCheck(sb, root, '--root', wt, '--gegen', 'wap-planer');
      expect(r.status).toBe(1);
      expect(r.out).toContain('nicht protokolliert');
    },
    60_000,
  );

  it('[R-H-05] Paket-Worktree mit korrekt protokollierter Nachführung, Tag wap-planer auf wap/p; lock-check --root <paket> --gegen wap-planer → Exit 0 (Positivfall, TR-H0-125)', () => {
    const sb = sandbox();
    const { root, wt } = paketMitNachfuehrung(sb, true);
    git(sb, root, 'tag', 'wap-planer', 'wap/p');
    expect(lockCheck(sb, root, '--root', wt, '--gegen', 'wap-planer').status).toBe(0);
  }, 60_000);

  it('[R-H-05] mehrdeutiger Name ohne refs/heads/x (Tag x und refs/x); lock-check --root <wurzel> --gegen x → Exit 1; nur mit Tag x → Exit 0 (TR-H0-125)', () => {
    const sb = sandbox();
    const { root } = sperrstand(sb);
    git(sb, root, 'tag', 'x', 'HEAD');
    expect(lockCheck(sb, root, '--root', root, '--gegen', 'x').status).toBe(0);
    git(sb, root, 'update-ref', 'refs/x', 'HEAD');
    expect(lockCheck(sb, root, '--root', root, '--gegen', 'x').status).toBe(1);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------
// P44l (CR-H0S-56): grosse Blobs ausserhalb der Pfadmenge führen nicht zum Abbruch
// ---------------------------------------------------------------------------------------------
describe('P44l: --staged mit grossen Blobs (über 512 MiB) (CR-H0S-56)', () => {
  const MIB = 1024 * 1024;

  /**
   * Stagt Blobs der genannten Grössen unter `ordner/`. Die Quelldatei entsteht zur Laufzeit im
   * Sandbox-Ordner, jede Variante unterscheidet sich im letzten Byte; die Datei wird danach gelöscht.
   */
  function grosseBlobsStagen(
    sb: Sandbox,
    root: string,
    ordner: string,
    kopf: string,
    groessen: number[],
  ): void {
    const datei = join(sb.base, 'gross.tmp');
    const block = Buffer.alloc(16 * MIB, 'a');
    try {
      for (const [i, groesse] of groessen.entries()) {
        const fd = openSync(datei, 'w');
        try {
          writeSync(fd, Buffer.from(kopf));
          for (let n = kopf.length; n < groesse - 1; n += block.length) {
            writeSync(fd, block, 0, Math.min(block.length, groesse - 1 - n));
          }
          writeSync(fd, Buffer.from(String.fromCharCode(97 + i)));
        } finally {
          closeSync(fd);
        }
        const oid = git(sb, root, 'hash-object', '-w', '--no-filters', datei);
        git(sb, root, 'update-index', '--add', '--cacheinfo', `100644,${oid},${ordner}/b${i}.txt`);
      }
    } finally {
      rmSync(datei, { force: true });
    }
  }

  // Runde 33: Der Fall 2 × 257 MiB unter medien/ entfällt (TR-H0-124 lässt den Ersatz zu). Der
  // Einzelblob von 513 MiB deckt auch «Summe über 512 MiB» ab; mit beiden Fällen zusammen überschritten
  // eingefrorene Tests unter der Last die Kindprozess-Zeitgrenze von 20 s (Lauf wh45-1).
  it('[R-H-07] --staged: ein einzelner gestagter Blob von 513 MiB unter medien/ (ausserhalb der Pfadmenge) → Exit 0, «nicht geprüft» (TR-H0-124)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    grosseBlobsStagen(sb, root, 'medien', 'Fülltext\n', [513 * MIB]);
    const r = scanObjekte(sb, root, ['--staged']);
    expect(r.status).toBe(0);
    expect(r.out).toContain('nicht geprüft');
  }, 300_000);

  it('[R-H-07] --staged: zwei Blobs zu je 257 MiB in der Pfadmenge (docs/wap-planer/), Telefonnummer am Anfang → Exit 1, kein stilles Bestehen (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    grosseBlobsStagen(sb, root, 'docs/wap-planer', `Kontakt ${TELEFON}\n`, [257 * MIB, 257 * MIB]);
    const r = scanObjekte(sb, root, ['--staged']);
    expect(r.status).toBe(1);
    expectMaskiertStill(sb, r, TELEFON);
  }, 300_000);
});

// ---------------------------------------------------------------------------------------------
// P44k präzisiert (CR-H0S-57): LFS-Alias-Kopfzeilen
// ---------------------------------------------------------------------------------------------
describe('P44k präzisiert: LFS-Zeiger mit Alias-Kopfzeilen hawser und git-media → «nicht prüfbar» (CR-H0S-57)', () => {
  const KOPF: Array<[string, string]> = [
    ['hawser', 'version https://hawser.github.com/spec/v1'],
    ['git-media', 'version http://git-media.io/v/2'],
  ];

  function zeiger(kopf: string): string {
    return [kopf, `oid sha256:${'c'.repeat(64)}`, 'size 12', ''].join('\n');
  }

  /** Führt den Modus über einen Stand mit `inhalt` unter `rel` aus; liefert Status vorher und Ergebnis. */
  function lauf(sb: Sandbox, modus: string, rel: string, inhalt: string) {
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    const ausfuehren = () =>
      modus === '--baum'
        ? scanObjekte(sb, root, ['--root', root, '--baum', 'HEAD'])
        : modus === '--commits'
          ? scanObjekte(sb, root, ['--root', root, '--commits', `${basis}..HEAD`])
          : scanObjekte(sb, root, ['--staged']);
    const vorher = ausfuehren().status;
    const blob = blobAus(sb, root, inhalt);
    git(sb, root, 'update-index', '--add', '--cacheinfo', `100644,${blob},${rel}`);
    if (modus !== '--staged') git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Datei');
    return { vorher, r: ausfuehren() };
  }

  const FAELLE: Array<[string, string, string]> = [];
  for (const [label, kopf] of KOPF) {
    for (const modus of ['--staged', '--baum', '--commits']) FAELLE.push([modus, label, kopf]);
  }

  it.each(FAELLE)(
    '[R-H-07] %s: LFS-Zeiger mit Kopfzeile %s in der Pfadmenge → Exit 1 «nicht prüfbar»; vorher ohne die Datei Exit 0',
    (modus, _label, kopf) => {
      const sb = sandbox();
      const { vorher, r } = lauf(sb, modus, 'docs/wap-planer/tabelle.xlsx', zeiger(kopf));
      expect(vorher).toBe(0);
      expect(r.status).toBe(1);
      expect(r.out).toContain('nicht prüfbar');
    },
    60_000,
  );

  it.each(FAELLE)(
    '[R-H-07] %s: Text, der die Kopfzeile %s erst in Zeile 2 nennt (kein Zeiger) → Exit 0 (Gegenprobe)',
    (modus, _label, kopf) => {
      const sb = sandbox();
      const { r } = lauf(sb, modus, 'docs/wap-planer/notiz.md', `Notiz\n${zeiger(kopf)}`);
      expect(r.status).toBe(0);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------------------------
// P44m (CR-H0S-58): lock-check --ref nur mit Zweigname, exaktem vollem Ref-Namen oder Objekt-ID
// ---------------------------------------------------------------------------------------------
describe('P44m: lock-check --ref weist Ausdrücke mit ~, ^, @ und falsch geschriebene volle Namen ab (CR-H0S-58)', () => {
  const AUSDRUECKE = [
    'wap-planer~0',
    'wap-planer^0',
    'HEAD~0',
    'wap-planer@{0}',
    'refs/heads/WAP-PLANER',
  ];

  it.each(AUSDRUECKE)(
    '[R-H-05] lock-check --ref %s bei intaktem Sperrstand → Exit 1; mit --ref wap-planer → Exit 0',
    (ausdruck) => {
      const sb = sandbox();
      const { root } = sperrstand(sb);
      expect(lockCheck(sb, root, '--root', root, '--ref', 'wap-planer').status).toBe(0);
      expect(lockCheck(sb, root, '--root', root, '--ref', ausdruck).status).toBe(1);
    },
    60_000,
  );

  it.each(AUSDRUECKE)(
    '[R-H-05] lock-check --ref %s --gegen <vorher>, Sperrdatei im Stand gelöscht → Exit 1 (L2)',
    (ausdruck) => {
      const sb = sandbox();
      const { root, vorher } = sperrstand(sb);
      git(sb, root, 'rm', '-q', LOCK_PATH);
      git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Lock entfernt');
      expect(lockCheck(sb, root, '--root', root, '--ref', ausdruck, '--gegen', vorher).status).toBe(
        1,
      );
    },
    60_000,
  );

  /** Gegenproben wie bisher: Zweigname und voller Name → Exit 0 bzw. 1 (ohne Lock), Objekt-ID → P34b. */
  const GEGENPROBEN: Array<[string, (root: string, id: string) => string, number, number]> = [
    ['Zweigname wap-planer', () => 'wap-planer', 0, 1],
    ['vollem Namen refs/heads/wap-planer', () => 'refs/heads/wap-planer', 0, 1],
    ['Objekt-ID des Stands', (_root, id) => id, 0, 0],
  ];

  it.each(GEGENPROBEN)(
    '[R-H-05] lock-check --ref mit %s: intakter Sperrstand → Exit 0, ohne Sperrdatei → Exit wie bisher (Gegenprobe)',
    (_label, name, intakt, ohneLock) => {
      const sb = sandbox();
      const { root } = sperrstand(sb);
      const id = git(sb, root, 'rev-parse', 'HEAD');
      expect(lockCheck(sb, root, '--root', root, '--ref', name(root, id)).status).toBe(intakt);
      git(sb, root, 'rm', '-q', LOCK_PATH);
      git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Lock entfernt');
      const ohne = git(sb, root, 'rev-parse', 'HEAD');
      expect(lockCheck(sb, root, '--root', root, '--ref', name(root, ohne)).status).toBe(ohneLock);
    },
    60_000,
  );
});
