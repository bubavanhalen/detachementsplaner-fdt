// Nachweis-Modi nach Code-Review Runde 8 – R-H-05, R-H-07, R-H-08.
// Vertrag: docs/wap-planer/pakete/H0.md, «Präzisierungen nach Eskalation 1», P44g, P44h, P44i, P44k,
// P35d, P47b, P47c, P9a (CR-H0S-47 bis -53; Nachbau aus .qa/h0/review-skripte-8/angriff-r8-*.mjs;
// Korrekturen nach Test-Review Runde 28: TR-H0-112 bis -116).
// Verbotene Muster werden zur Laufzeit zusammengesetzt; nur fiktive Daten.
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupSandboxes,
  git,
  gitRaw,
  initRepo,
  LOCK_PATH,
  lockFiles,
  type RunResult,
  runScript,
  type Sandbox,
  writeText,
} from './helpers';
import {
  ART_TELEFON,
  blobAus,
  commitDateien,
  expectBefund,
  expectCommitBefund,
  expectMasked,
  mitTelefon,
  PLATZHALTER,
  sandbox,
  scanObjekte,
  TELEFON,
} from './helpers-objekte';
import {
  commitAusEintraegen,
  eintraegeVon,
  FIKTIVE_OID,
  gitmodulesIgnoreAll,
  lfsZeiger,
} from './helpers-objekte-r8';

afterEach(cleanupSandboxes);

const P = 'docs/wap-planer/p.md';

function baum(sb: Sandbox, root: string, ref: string): RunResult {
  return scanObjekte(sb, root, ['--root', root, '--baum', ref]);
}

function commits(sb: Sandbox, root: string, bereich: string): RunResult {
  return scanObjekte(sb, root, ['--root', root, '--commits', bereich]);
}

function staged(sb: Sandbox, root: string): RunResult {
  return scanObjekte(sb, root, ['--staged']);
}

function lockCheck(sb: Sandbox, root: string, ...args: string[]): RunResult {
  return runScript(sb, root, 'lock-check.mjs', ['--root', root, ...args], { cwd: root });
}

/** Stagt einen Gitlink (160000) auf eine fiktive, nicht vorhandene Commit-ID (TR-H0-112). */
function gitlinkStagen(sb: Sandbox, root: string, rel: string): void {
  git(sb, root, 'update-index', '--add', '--cacheinfo', `160000,${FIKTIVE_OID},${rel}`);
}

// ---------------------------------------------------------------------------------------------
// P44g (CR-H0S-47): Gitlinks werden nie ausgeblendet
// ---------------------------------------------------------------------------------------------
describe('P44g: .gitmodules «ignore = all» und diff.ignoreSubmodules blenden Gitlinks nicht aus (CR-H0S-47)', () => {
  const GITLINK_PFADE: Array<[string, string]> = [
    ['in der Pfadmenge (docs/wap-planer/sub)', 'docs/wap-planer/sub'],
    [`mit Telefonnummer im Pfad (lib/Kontakt ${PLATZHALTER})`, `lib/Kontakt ${PLATZHALTER}`],
  ];

  /**
   * Arten, einen Gitlink in Diffs auszublenden. Probe (Runde 29): `diff-tree` beachtet `.gitmodules`
   * (ignore = all) und `submodule.<name>.ignore`, nicht aber `diff.ignoreSubmodules`; `diff --cached`
   * beachtet alle drei.
   */
  const AUSBLENDEN: Array<[string, (sb: Sandbox, root: string, rel: string) => void]> = [
    [
      'versioniertes .gitmodules mit ignore = all',
      (sb, root, rel) => {
        commitDateien(sb, root, { '.gitmodules': gitmodulesIgnoreAll(rel) });
      },
    ],
    [
      'Repo-Konfiguration diff.ignoreSubmodules=all',
      (sb, root) => git(sb, root, 'config', 'diff.ignoreSubmodules', 'all'),
    ],
    [
      'versioniertes .gitmodules ohne ignore, Repo-Konfiguration submodule.s.ignore=all',
      (sb, root, rel) => {
        commitDateien(sb, root, {
          '.gitmodules': gitmodulesIgnoreAll(rel).replace('\tignore = all\n', ''),
        });
        git(sb, root, 'config', 'submodule.s.ignore', 'all');
      },
    ],
  ];
  const FAELLE: Array<[string, string, string, (sb: Sandbox, root: string, rel: string) => void]> =
    [];
  for (const [pfadLabel, rel] of GITLINK_PFADE) {
    for (const [art, ausblenden] of AUSBLENDEN) FAELLE.push([pfadLabel, art, rel, ausblenden]);
  }

  it.each(FAELLE)(
    '[R-H-07] --commits: Gitlink nur in einem Zwischencommit, %s, %s → Exit 1 «Untermodul nicht prüfbar», maskiert',
    (_pfadLabel, _art, relPlatzhalter, ausblenden) => {
      const sb = sandbox();
      const rel = mitTelefon(relPlatzhalter);
      const root = initRepo(sb, 'haupt');
      ausblenden(sb, root, rel);
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      gitlinkStagen(sb, root, rel);
      git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Gitlink');
      git(sb, root, 'rm', '-q', '--cached', rel);
      git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Gitlink entfernt');
      const r = commits(sb, root, `${basis}..HEAD`);
      expect(r.status).toBe(1);
      expect(r.out).toContain('Untermodul nicht prüfbar');
      expectMasked(sb, r, TELEFON, [root]);
    },
    60_000,
  );

  it.each(FAELLE)(
    '[R-H-07] --staged: gestagter Gitlink %s, %s → Exit 1 «Untermodul nicht prüfbar», maskiert',
    (_pfadLabel, _art, relPlatzhalter, ausblenden) => {
      const sb = sandbox();
      const rel = mitTelefon(relPlatzhalter);
      const root = initRepo(sb, 'haupt');
      ausblenden(sb, root, rel);
      gitlinkStagen(sb, root, rel);
      const r = staged(sb, root);
      expect(r.status).toBe(1);
      expect(r.out).toContain('Untermodul nicht prüfbar');
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07] --commits: .gitmodules mit ignore = all, Zwischencommit ohne Gitlink (nur saubere Datei) → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { '.gitmodules': gitmodulesIgnoreAll('docs/wap-planer/sub') });
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    commitDateien(sb, root, { [P]: 'Hptm Muster A\n' });
    expect(commits(sb, root, `${basis}..HEAD`).status).toBe(0);
  }, 60_000);

  it('[R-H-07] --staged: .gitmodules mit ignore = all, gestagt nur eine saubere Datei → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { '.gitmodules': gitmodulesIgnoreAll('docs/wap-planer/sub') });
    writeText(root, P, 'Hptm Muster A\n');
    git(sb, root, 'add', P);
    expect(staged(sb, root).status).toBe(0);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------
// P44h (CR-H0S-48): eindeutige Auflösung von Ref-Namen
// ---------------------------------------------------------------------------------------------
describe('P44h: Ref-Namen werden eindeutig aufgelöst, refs/heads/<name> hat Vorrang (CR-H0S-48)', () => {
  /** wap-planer mit Basis; Zweig wap/p enthält zusätzlich p.md mit Telefonnummer. */
  function mitPaketZweig(sb: Sandbox): { root: string; basis: string; paket: string } {
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'checkout', '-q', '-b', 'wap/p');
    const paket = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'Paket');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    return { root, basis, paket };
  }

  const SCHATTEN: Array<[string, (sb: Sandbox, root: string, ziel: string) => void]> = [
    ['Tag wap/p', (sb, root, ziel) => git(sb, root, 'tag', 'wap/p', ziel)],
    ['refs/wap/p', (sb, root, ziel) => git(sb, root, 'update-ref', 'refs/wap/p', ziel)],
  ];
  const FAELLE_O9: Array<[string, string, (sb: Sandbox, root: string, ziel: string) => void]> = [];
  for (const [label, anlegen] of SCHATTEN) {
    for (const modus of ['--baum wap/p', '--commits wap-planer..wap/p']) {
      FAELLE_O9.push([label, modus, anlegen]);
    }
  }

  it.each(FAELLE_O9)(
    '[R-H-07] %s zeigt auf die saubere Basis; Zweig wap/p enthält eine Telefonnummer; %s → Exit 1, Befund aus dem Zweig, maskiert (O9b, O9c, O9d)',
    (_label, modus, anlegen) => {
      const sb = sandbox();
      const { root, basis, paket } = mitPaketZweig(sb);
      anlegen(sb, root, basis);
      if (modus.startsWith('--baum')) {
        const r = baum(sb, root, 'wap/p');
        expect(r.status).toBe(1);
        expectBefund(r, P, 1, ART_TELEFON);
        expectMasked(sb, r, TELEFON);
      } else {
        const r = commits(sb, root, 'wap-planer..wap/p');
        expect(r.status).toBe(1);
        expectCommitBefund(r, paket, P, 1, ART_TELEFON);
        expectMasked(sb, r, TELEFON, [root]);
      }
    },
    60_000,
  );

  it.each(['--commits <vorher>..wap-planer', '--baum wap-planer'])(
    '[R-H-07] Tag wap-planer zeigt auf den Stand davor, Zweig wap-planer enthält eine Telefonnummer; %s → Exit 1, Befund aus dem Zweig, maskiert (O9g, O9h)',
    (modus) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const vorher = git(sb, root, 'rev-parse', 'HEAD');
      const neu = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'neu');
      git(sb, root, 'tag', 'wap-planer', vorher);
      if (modus.startsWith('--baum')) {
        const r = baum(sb, root, 'wap-planer');
        expect(r.status).toBe(1);
        expectBefund(r, P, 1, ART_TELEFON);
        expectMasked(sb, r, TELEFON);
      } else {
        const r = commits(sb, root, `${vorher}..wap-planer`);
        expect(r.status).toBe(1);
        expectCommitBefund(r, neu, P, 1, ART_TELEFON);
        expectMasked(sb, r, TELEFON, [root]);
      }
    },
    60_000,
  );

  it.each([
    [
      'vollem Namen refs/heads/wap/p (Zweig mit Telefonnummer) → Exit 1, Befund',
      'refs/heads/wap/p',
      1,
    ],
    ['vollem Namen refs/tags/wap/p (Tag auf die saubere Basis) → Exit 0', 'refs/tags/wap/p', 0],
  ] as Array<[string, string, number]>)(
    '[R-H-07] Tag wap/p auf die saubere Basis; --baum mit %s (gilt wörtlich, Gegenprobe)',
    (_label, name, exit) => {
      const sb = sandbox();
      const { root, basis } = mitPaketZweig(sb);
      git(sb, root, 'tag', 'wap/p', basis);
      const r = baum(sb, root, name);
      expect(r.status).toBe(exit);
      if (exit === 1) expectBefund(r, P, 1, ART_TELEFON);
    },
    60_000,
  );

  it('[R-H-07] Tag wap/p auf die saubere Basis; --baum mit der Commit-ID des Zweigs gilt wörtlich → Exit 1, Befund (Gegenprobe)', () => {
    const sb = sandbox();
    const { root, basis, paket } = mitPaketZweig(sb);
    git(sb, root, 'tag', 'wap/p', basis);
    const r = baum(sb, root, paket);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
  }, 60_000);

  it('[R-H-07] Tag wap-planer zeigt auf den Paket-Commit von wap/p; --commits wap-planer..wap/p (linkes Ende, refs/heads/wap-planer hat Vorrang) → Exit 1, Befund mit dem Kürzel des Paket-Commits, maskiert (TR-H0-114)', () => {
    const sb = sandbox();
    const { root, paket } = mitPaketZweig(sb);
    git(sb, root, 'tag', 'wap-planer', paket);
    const r = commits(sb, root, 'wap-planer..wap/p');
    expect(r.status).toBe(1);
    expectCommitBefund(r, paket, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  /** Repo mit gesperrter Datei (für die lock-check-Fälle der Mehrdeutigkeit). */
  function sperrstand(sb: Sandbox): string {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Sperrstand');
    return root;
  }

  const MEHRDEUTIG: Array<[string, (sb: Sandbox, root: string) => RunResult]> = [
    ['--baum x', (sb, root) => baum(sb, root, 'x')],
    ['--commits x..HEAD', (sb, root) => commits(sb, root, 'x..HEAD')],
    ['--commits HEAD..x', (sb, root) => commits(sb, root, 'HEAD..x')],
    ['lock-check --ref x', (sb, root) => lockCheck(sb, root, '--ref', 'x')],
    [
      'lock-check --ref HEAD --gegen x',
      (sb, root) => lockCheck(sb, root, '--ref', 'HEAD', '--gegen', 'x'),
    ],
  ];

  it.each(MEHRDEUTIG)(
    '[R-H-07][R-H-05] mehrdeutiger Name ohne refs/heads/x (Tag x und refs/x): %s → Exit 1; nur mit Tag x → Exit 0',
    (_label, lauf) => {
      const sb = sandbox();
      const root = sperrstand(sb);
      git(sb, root, 'tag', 'x', 'HEAD');
      expect(lauf(sb, root).status).toBe(0);
      git(sb, root, 'update-ref', 'refs/x', 'HEAD');
      expect(lauf(sb, root).status).toBe(1);
    },
    60_000,
  );

  /** Sperrstand auf wap-planer (vorher); Zweig wap/p ändert die gesperrte Datei ohne Nachführung. */
  function geaendertImZweig(sb: Sandbox): { root: string; vorher: string } {
    const root = sperrstand(sb);
    const vorher = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'checkout', '-q', '-b', 'wap/p');
    commitDateien(sb, root, { 'tests/a.test.ts': 'export const a = 0; // abgeschwächt\n' });
    git(sb, root, 'checkout', '-q', 'wap-planer');
    return { root, vorher };
  }

  it.each(['--ref wap/p', '--ref wap/p --gegen <vorher>'])(
    '[R-H-05] Tag wap/p zeigt auf den Stand davor, gesperrte Datei im Zweig wap/p geändert; lock-check %s → Exit 1 «geändert» (L5, L5b)',
    (modus) => {
      const sb = sandbox();
      const { root, vorher } = geaendertImZweig(sb);
      git(sb, root, 'tag', 'wap/p', vorher);
      const args = modus.includes('--gegen')
        ? ['--ref', 'wap/p', '--gegen', vorher]
        : ['--ref', 'wap/p'];
      const r = lockCheck(sb, root, ...args);
      expect(r.status).toBe(1);
      expect(r.out).toContain('geändert');
      expect(r.out).toContain('tests/a.test.ts');
    },
    60_000,
  );

  it('[R-H-05] Tag wap-planer zeigt auf den Paket-Stand; Zweig wap/p mit nachgeführter test-lock.json ohne Protokoll; lock-check --ref wap/p --gegen wap-planer → Exit 1 mit Pfad (--gegen aufgelöst auf refs/heads/wap-planer)', () => {
    const sb = sandbox();
    const root = sperrstand(sb);
    git(sb, root, 'checkout', '-q', '-b', 'wap/p');
    lockFiles(root, { 'tests/a.test.ts': 'export const a = 0; // abgeschwächt\n' });
    git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'nachgeführt ohne Protokoll');
    const paket = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    git(sb, root, 'tag', 'wap-planer', paket);
    const r = lockCheck(sb, root, '--ref', 'wap/p', '--gegen', 'wap-planer');
    expect(r.status).toBe(1);
    expect(r.out).toContain('tests/a.test.ts');
  }, 60_000);

  /** Zweig wap/p entfernt die test-lock.json. */
  function ohneLockImZweig(sb: Sandbox): { root: string; ohne: string } {
    const root = sperrstand(sb);
    git(sb, root, 'checkout', '-q', '-b', 'wap/p');
    git(sb, root, 'rm', '-q', LOCK_PATH);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Lock entfernt');
    const ohne = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    return { root, ohne };
  }

  it.each(['heads/wap/p', 'refs/heads/wap/p'])(
    '[R-H-05] lock-check --ref %s, Zweig wap/p ohne test-lock.json → Exit 1 (WAP-Zweig nach aufgelöstem vollem Namen, L6c, P31)',
    (name) => {
      const sb = sandbox();
      const { root } = ohneLockImZweig(sb);
      expect(lockCheck(sb, root, '--ref', name).status).toBe(1);
    },
    60_000,
  );

  it('[R-H-05] lock-check --ref <Commit-ID> desselben Stands ohne test-lock.json (kein Zweigname, Nicht-WAP) → Exit 0 (Gegenprobe, P34b)', () => {
    const sb = sandbox();
    const { root, ohne } = ohneLockImZweig(sb);
    expect(lockCheck(sb, root, '--ref', ohne).status).toBe(0);
  }, 60_000);
});

// ---------------------------------------------------------------------------------------------
// P44i (CR-H0S-51): --baum nur für Commits
// ---------------------------------------------------------------------------------------------
describe('P44i: --baum akzeptiert nur Commits (CR-H0S-51)', () => {
  const OBJEKTE: Array<[string, string]> = [
    ['Wurzelbaum-ID des Commits', 'HEAD^{tree}'],
    ['Baum-ID des Teilbaums docs', 'HEAD:docs'],
    ['Blob-ID einer Datei', 'HEAD:README.md'],
  ];

  it.each(OBJEKTE)(
    '[R-H-07] --baum mit der %s → Exit 1; derselbe saubere Stand als Commit → Exit 0',
    (_label, ausdruck) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      expect(baum(sb, root, 'HEAD').status).toBe(0);
      const oid = git(sb, root, 'rev-parse', ausdruck);
      expect(baum(sb, root, oid).status).toBe(1);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------------------------
// P44k (CR-H0S-53): Git-LFS-Zeiger sind nicht prüfbar
// ---------------------------------------------------------------------------------------------
describe('P44k: Git-LFS-Zeiger in der Pfadmenge → Exit 1 (CR-H0S-53)', () => {
  const ZEIGER_PFAD = 'docs/wap-planer/tabelle.xlsx';

  /** Führt den Modus über einen Stand mit `inhalt` unter `rel` aus (vorher: Lauf ohne die Datei). */
  function lauf(
    sb: Sandbox,
    modus: string,
    rel: string,
    inhalt: string,
  ): { vorher: number | null; r: RunResult } {
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    const ausfuehren = () =>
      modus === '--baum'
        ? baum(sb, root, 'HEAD')
        : modus === '--commits'
          ? commits(sb, root, `${basis}..HEAD`)
          : staged(sb, root);
    const vorher = ausfuehren().status;
    const blob = blobAus(sb, root, inhalt);
    git(sb, root, 'update-index', '--add', '--cacheinfo', `100644,${blob},${rel}`);
    if (modus !== '--staged') git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Datei');
    return { vorher, r: ausfuehren() };
  }

  it.each(['--baum', '--commits', '--staged'])(
    '[R-H-07] %s: LFS-Zeiger als Blob in der Pfadmenge → Exit 1 «nicht prüfbar»; vorher ohne die Datei Exit 0',
    (modus) => {
      const sb = sandbox();
      const { vorher, r } = lauf(sb, modus, ZEIGER_PFAD, lfsZeiger());
      expect(vorher).toBe(0);
      expect(r.status).toBe(1);
      expect(r.out).toContain('nicht prüfbar');
    },
    60_000,
  );

  it.each(['--baum', '--commits', '--staged'])(
    '[R-H-07] %s: normale Datei in der Pfadmenge mit «version» ohne LFS-URL → Exit 0 (Gegenprobe)',
    (modus) => {
      const sb = sandbox();
      const { r } = lauf(
        sb,
        modus,
        'docs/wap-planer/notiz.md',
        'version 2 des Dokuments\nsize 12\n',
      );
      expect(r.status).toBe(0);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------------------------
// P35d (CR-H0S-50): Pfadmenge auch für Pfade mit Steuerzeichen
// ---------------------------------------------------------------------------------------------
describe('P35d: Pfade mit Zeilenumbruch oder Wagenrücklauf in der Pfadmenge (CR-H0S-50)', () => {
  const STEUERZEICHEN: Array<[string, string]> = [
    ['Zeilenumbruch', String.fromCharCode(10)],
    ['Wagenrücklauf', String.fromCharCode(13)],
  ];
  const FAELLE: Array<[string, string, string]> = [];
  for (const [label, zeichen] of STEUERZEICHEN) {
    for (const modus of ['--baum', '--commits']) FAELLE.push([modus, label, zeichen]);
  }

  it.each(FAELLE)(
    '[R-H-07] %s: Datei docs/wap-planer/zeile<%s>umbruch.md (per mktree) mit Telefonnummer → Exit 1, Befund Telefonnummer, maskiert',
    (modus, _label, zeichen) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      const blob = blobAus(sb, root, `Kontakt ${TELEFON}\n`);
      const eintraege = [
        ...eintraegeVon(sb, root, 'HEAD'),
        { modus: '100644', oid: blob, pfad: `docs/wap-planer/zeile${zeichen}umbruch.md` },
      ];
      commitAusEintraegen(sb, root, eintraege, [basis], 'sonder');
      const r =
        modus === '--baum' ? baum(sb, root, 'sonder') : commits(sb, root, `${basis}..sonder`);
      expect(r.status).toBe(1);
      expect(r.out).toMatch(ART_TELEFON);
      expectMasked(sb, r, TELEFON, [root]);
    },
    60_000,
  );

  it.each(STEUERZEICHEN)(
    '[R-H-07] --staged (Repo mit core.protectNTFS=false, sonst weist Git für Windows den Pfad ab): gestagter Pfad mit %s in der Pfadmenge und Telefonnummer → Exit 1, maskiert',
    (_label, zeichen) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      git(sb, root, 'config', 'core.protectNTFS', 'false');
      const blob = blobAus(sb, root, `Kontakt ${TELEFON}\n`);
      git(
        sb,
        root,
        'update-index',
        '--add',
        '--cacheinfo',
        `100644,${blob},docs/wap-planer/zeile${zeichen}umbruch.md`,
      );
      const r = staged(sb, root);
      expect(r.status).toBe(1);
      expect(r.out).toMatch(ART_TELEFON);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07] --baum: Pfad mit Zeilenumbruch in der Pfadmenge, sauberer Inhalt → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    const blob = blobAus(sb, root, 'Hptm Muster A\n');
    const eintraege = [
      ...eintraegeVon(sb, root, 'HEAD'),
      {
        modus: '100644',
        oid: blob,
        pfad: `docs/wap-planer/zeile${String.fromCharCode(10)}umbruch.md`,
      },
    ];
    commitAusEintraegen(sb, root, eintraege, [basis], 'sonder');
    expect(baum(sb, root, 'sonder').status).toBe(0);
  }, 60_000);

  // TR-H0-116: Steuerzeichen in einem Zwischensegment (src/**/wap/**) und im «*» von src/**/wap-*/**;
  // Regressionsschutz (unterscheidet heute nicht).
  it.each([
    ['Zwischensegment unter src/**/wap/** (src/a<Zeilenumbruch>b/wap/x.ts)', 'src/a\nb/wap/x.ts'],
    ['Stern in src/**/wap-*/** (src/wap-a<Zeilenumbruch>b/x.ts)', 'src/wap-a\nb/x.ts'],
  ])(
    '[R-H-07] --baum: Steuerzeichen im %s, Datei mit Telefonnummer → Exit 1, Befund Telefonnummer, maskiert',
    (_label, pfad) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      const blob = blobAus(sb, root, `Kontakt ${TELEFON}\n`);
      commitAusEintraegen(
        sb,
        root,
        [...eintraegeVon(sb, root, 'HEAD'), { modus: '100644', oid: blob, pfad }],
        [basis],
        'sonder',
      );
      const r = baum(sb, root, 'sonder');
      expect(r.status).toBe(1);
      expect(r.out).toMatch(ART_TELEFON);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );
});

// ---------------------------------------------------------------------------------------------
// P47b (CR-H0S-49) und P9a: Gross/Klein-Kollision mit einem gesperrten Pfad
// ---------------------------------------------------------------------------------------------
const GESPERRT = 'tests/wap/Foo.test.ts';
const EINGEFROREN = 'eingefroren\n';

const KOLLISIONEN: Array<[string, string]> = [
  ['Datei in anderer Schreibweise (tests/wap/foo.test.ts)', 'tests/wap/foo.test.ts'],
  ['Verzeichnisteil in anderer Schreibweise (Tests/wap/Foo.test.ts)', 'Tests/wap/Foo.test.ts'],
  // P47c: Eintrag gleicht einem Verzeichnisteil des gesperrten Pfads; Sperrdatei und Protokoll selbst.
  ['Datei tests/WAP neben dem Ordner tests/wap (P47c)', 'tests/WAP'],
  ['docs/wap-planer/TEST-LOCK.json neben der Sperrdatei (P47c)', 'docs/wap-planer/TEST-LOCK.json'],
  ['docs/wap-planer/findings.md neben FINDINGS.md (P47c)', 'docs/wap-planer/findings.md'],
];

/** Mit und ohne --gegen (P47b, P47c; TR-H0-113). */
const MIT_OHNE_GEGEN = ['ohne --gegen', 'mit --gegen <vorher>'];
const KOLLISIONEN_GEGEN: Array<[string, string, string]> = [];
for (const [label, zusatz] of KOLLISIONEN) {
  for (const art of MIT_OHNE_GEGEN) KOLLISIONEN_GEGEN.push([label, art, zusatz]);
}

describe('P47b: lock-check --ref meldet Gross/Klein-Kollisionen mit gesperrten Pfaden (CR-H0S-49)', () => {
  /** Sperrstand auf wap-planer; wap/p fügt per commit-tree einen Eintrag `zusatz` mit geändertem Inhalt hinzu. */
  function mitZusatz(sb: Sandbox, zusatz: string): { root: string; vorher: string; paket: string } {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { [GESPERRT]: EINGEFROREN });
    git(sb, root, 'add', GESPERRT, LOCK_PATH);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Sperrstand');
    const vorher = git(sb, root, 'rev-parse', 'HEAD');
    const blob = blobAus(sb, root, 'geaendert\n');
    const paket = commitAusEintraegen(
      sb,
      root,
      [...eintraegeVon(sb, root, vorher), { modus: '100644', oid: blob, pfad: zusatz }],
      [vorher],
      'wap/p',
    );
    return { root, vorher, paket };
  }

  function gegenArgs(art: string, vorher: string): string[] {
    return art === 'ohne --gegen' ? [] : ['--gegen', vorher];
  }

  it.each(KOLLISIONEN_GEGEN)(
    '[R-H-05] K1: Zweig wap/p mit zusätzlichem Eintrag, %s; lock-check --ref wap/p %s → Exit 1 «Kollision»',
    (_label, art, zusatz) => {
      const sb = sandbox();
      const { root, vorher } = mitZusatz(sb, zusatz);
      const r = lockCheck(sb, root, '--ref', 'wap/p', ...gegenArgs(art, vorher));
      expect(r.status).toBe(1);
      expect(r.out).toContain('Kollision');
    },
    60_000,
  );

  it.each(KOLLISIONEN_GEGEN)(
    '[R-H-05] K3: nach dem Merge von wap/p in wap-planer (commit-tree, zwei Eltern), %s; lock-check --ref wap-planer %s → Exit 1 «Kollision»',
    (_label, art, zusatz) => {
      const sb = sandbox();
      const { root, vorher, paket } = mitZusatz(sb, zusatz);
      commitAusEintraegen(
        sb,
        root,
        eintraegeVon(sb, root, paket),
        [vorher, paket],
        'wap-planer',
        'Merge',
      );
      const r = lockCheck(sb, root, '--ref', 'wap-planer', ...gegenArgs(art, vorher));
      expect(r.status).toBe(1);
      expect(r.out).toContain('Kollision');
    },
    60_000,
  );

  it.each(MIT_OHNE_GEGEN)(
    '[R-H-05] Zweig wap/p mit zusätzlichem Eintrag ohne Kollision (tests/wap/bar.test.ts); lock-check --ref wap/p %s → Exit 0 (Gegenprobe)',
    (art) => {
      const sb = sandbox();
      const { root, vorher } = mitZusatz(sb, 'tests/wap/bar.test.ts');
      expect(lockCheck(sb, root, '--ref', 'wap/p', ...gegenArgs(art, vorher)).status).toBe(0);
    },
    60_000,
  );

  it.each(MIT_OHNE_GEGEN)(
    '[R-H-05] Zweig wap/p mit zusätzlichen Einträgen tests/wapx und docs/wap-planer/lock.json (ähnlich, aber keine Kollision); lock-check --ref wap/p %s → Exit 0 (Gegenprobe P47c)',
    (art) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      lockFiles(root, { [GESPERRT]: EINGEFROREN });
      git(sb, root, 'add', GESPERRT, LOCK_PATH);
      git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Sperrstand');
      const vorher = git(sb, root, 'rev-parse', 'HEAD');
      const blob = blobAus(sb, root, 'geaendert\n');
      commitAusEintraegen(
        sb,
        root,
        [
          ...eintraegeVon(sb, root, vorher),
          { modus: '100644', oid: blob, pfad: 'tests/wapx' },
          { modus: '100644', oid: blob, pfad: 'docs/wap-planer/lock.json' },
        ],
        [vorher],
        'wap/p',
      );
      expect(lockCheck(sb, root, '--ref', 'wap/p', ...gegenArgs(art, vorher)).status).toBe(0);
    },
    60_000,
  );
});

describe('P9a: Commit-Hook weist eine Gross/Klein-Kollision mit einem gesperrten Pfad im Index ab', () => {
  function setup(sb: Sandbox): string {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { [GESPERRT]: EINGEFROREN });
    git(sb, root, 'add', GESPERRT, LOCK_PATH);
    git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
    expect(runScript(sb, root, 'install-hooks.mjs', []).status).toBe(0);
    return root;
  }

  function commitVersuch(sb: Sandbox, root: string, rel: string) {
    const blob = blobAus(sb, root, 'geaendert\n');
    git(sb, root, 'update-index', '--add', '--cacheinfo', `100644,${blob},${rel}`);
    const vorher = git(sb, root, 'rev-parse', 'HEAD');
    const r = gitRaw(sb, root, 'commit', '-q', '-m', 'Versuch');
    return {
      status: r.status,
      out: r.out,
      committed: git(sb, root, 'rev-parse', 'HEAD') !== vorher,
    };
  }

  it.each(KOLLISIONEN)(
    '[R-H-08][R-H-05] gestagter Eintrag %s neben dem gesperrten tests/wap/Foo.test.ts → Commit scheitert mit «Kollision», HEAD unverändert',
    (_label, zusatz) => {
      const sb = sandbox();
      const root = setup(sb);
      const v = commitVersuch(sb, root, zusatz);
      expect(v.committed).toBe(false);
      expect(v.status).not.toBe(0);
      expect(v.out).toContain('Kollision');
    },
    60_000,
  );

  it.each(['tests/wapx', 'docs/wap-planer/lock.json'])(
    '[R-H-08][R-H-05] gestagter Eintrag %s (ähnlich, aber keine Kollision) → Commit gelingt (Gegenprobe P47c)',
    (rel) => {
      const sb = sandbox();
      const root = setup(sb);
      const v = commitVersuch(sb, root, rel);
      expect(v.status).toBe(0);
      expect(v.committed).toBe(true);
    },
    60_000,
  );

  it('[R-H-08][R-H-05] gestagter Eintrag ohne Kollision (tests/wap/bar.test.ts) → Commit gelingt (Gegenprobe)', () => {
    const sb = sandbox();
    const root = setup(sb);
    const v = commitVersuch(sb, root, 'tests/wap/bar.test.ts');
    expect(v.status).toBe(0);
    expect(v.committed).toBe(true);
  }, 60_000);
});
