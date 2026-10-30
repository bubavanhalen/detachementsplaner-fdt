// Datenschutz-Scan scripts/wap/privacy-scan.mjs, Objekt-Modi --baum und --commits – R-H-07.
// Vertrag: docs/wap-planer/pakete/H0.md, «Präzisierungen nach Eskalation 1», P44 (a) bis (e); Fälle aus
// .qa/h0/architect-eskalation-1.md Abschnitt 4.5 (S1, S2, S3, Index-Flags, sparse, Zwischencommit, Merge).
// Verbotene Muster werden zur Laufzeit zusammengesetzt; nur fiktive Daten.
import { renameSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorktree,
  cleanupSandboxes,
  GESPERRTE_NAMEN,
  git,
  initRepo,
  type RunResult,
  type Sandbox,
  SPERRLISTE,
  shortName,
  withoutSandboxPath,
  writeText,
} from './helpers';
import {
  AHV,
  ART_AHV,
  ART_MAIL,
  ART_NAME,
  ART_TELEFON,
  befundZeilen,
  blobAus,
  commitBefundZeilen,
  commitDateien,
  commonDir,
  expectBefund,
  expectCommitBefund,
  expectMasked,
  fileUrl,
  j,
  MAIL,
  mitTelefon,
  nurImObjekt,
  PLATZHALTER,
  sandbox,
  scanObjekte,
  TELEFON,
} from './helpers-objekte';

afterEach(cleanupSandboxes);

const P = 'docs/wap-planer/p.md';

function baum(
  sb: Sandbox,
  root: string,
  ref = 'HEAD',
  options: { cwd?: string; env?: NodeJS.ProcessEnv; scriptRoot?: string } = {},
): RunResult {
  return scanObjekte(sb, options.scriptRoot ?? root, ['--root', root, '--baum', ref], options);
}

function commits(
  sb: Sandbox,
  root: string,
  bereich: string,
  options: { cwd?: string; env?: NodeJS.ProcessEnv; scriptRoot?: string } = {},
): RunResult {
  return scanObjekte(
    sb,
    options.scriptRoot ?? root,
    ['--root', root, '--commits', bereich],
    options,
  );
}

/** Repo, dessen HEAD die Datei mit Telefonnummer versioniert; auf dem Datenträger fehlt sie. */
function repoMitNummerNurImObjekt(sb: Sandbox, rel = P, name = 'haupt'): string {
  const root = initRepo(sb, name);
  commitDateien(sb, root, { [rel]: `Kontakt ${TELEFON}\n` }, 'Nummer');
  nurImObjekt(root, rel);
  return root;
}

describe('privacy-scan --baum: Dateiliste und Inhalte nur aus git-Objekten (P44 a, b, e)', () => {
  it('[R-H-07] --baum HEAD: versionierte Datei mit Telefonnummer in Zeile 2, auf dem Datenträger entfernt → Exit 1, Befund «<pfad>:2: <art>» ohne Commit-Kürzel, maskiert', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { [P]: `Zeile eins\nKontakt ${TELEFON}\n` });
    nurImObjekt(root, P);
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, P, 2, ART_TELEFON);
    expect(r.out).not.toMatch(/[0-9a-f]{7,40}:docs\/wap-planer\/p\.md/);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] --baum HEAD: Arbeitsbaum mit Telefonnummer (geänderte und unversionierte Datei), versionierter Stand sauber → Exit 0 (Gegenprobe, P44 a)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { [P]: 'Hptm Muster A\n' });
    writeText(root, P, `Kontakt ${TELEFON}\n`);
    writeText(root, 'docs/wap-planer/neu.md', `Kontakt ${TELEFON}\n`);
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);

  it('[R-H-07] --baum <zweig>: geprüft wird der genannte Ref, nicht der ausgecheckte Stand → Exit 1, Befund (P44 b)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    git(sb, root, 'checkout', '-q', '-b', 'wap/p');
    commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` });
    git(sb, root, 'checkout', '-q', 'wap-planer');
    const r = baum(sb, root, 'wap/p');
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] --baum wap-planer: sauberer Ref, ein anderer Zweig enthält eine Telefonnummer → Exit 0 (Gegenprobe, P44 b)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    git(sb, root, 'checkout', '-q', '-b', 'wap/p');
    commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` });
    expect(baum(sb, root, 'wap-planer').status).toBe(0);
  }, 60_000);

  it('[R-H-07] --baum HEAD findet AHV-Nummer, Telefonnummer, E-Mail-Adresse und Sperrlisten-Namen, je eine Befundzeile, alles maskiert (P44 c, e)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const inhalt = `AHV ${AHV}\nKontakt ${TELEFON}\nMail ${MAIL}\nHptm ${GESPERRTE_NAMEN[0]}\n`;
    commitDateien(sb, root, { [P]: inhalt });
    nurImObjekt(root, P);
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_AHV);
    expectBefund(r, P, 2, ART_TELEFON);
    expectBefund(r, P, 3, ART_MAIL);
    expectBefund(r, P, 4, ART_NAME);
    for (const geheim of [AHV, TELEFON, MAIL, GESPERRTE_NAMEN[0]]) expectMasked(sb, r, geheim);
  }, 60_000);

  it('[R-H-07] --baum HEAD: Aufruf aus einem Ordner ausserhalb jedes Repos ergibt denselben Befund (Kontext nur aus --root, P44 a)', () => {
    const sb = sandbox();
    const root = repoMitNummerNurImObjekt(sb);
    const r = baum(sb, root, 'HEAD', { cwd: sb.base });
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);
});

describe('privacy-scan --baum: lokale Zustände wirken nicht (P44 a; Eskalation 1, S1, S2, S3, Index-Flags, sparse)', () => {
  it('[R-H-07] S1 doppelte Verschachtelung: git init in docs/wap-planer/x und x/y, versionierte x/y/p.md mit Telefonnummer → --baum Exit 1, Befund mit Pfad relativ zu --root', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const rel = 'docs/wap-planer/x/y/p.md';
    commitDateien(sb, root, { [rel]: `Kontakt ${TELEFON}\n` });
    git(sb, join(root, 'docs', 'wap-planer', 'x'), 'init', '-q');
    git(sb, join(root, 'docs', 'wap-planer', 'x', 'y'), 'init', '-q');
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, rel, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] S2 Gross/Klein: Ordner x auf dem Datenträger in X umbenannt und git init in X → --baum Exit 1, Befund mit der Schreibweise aus dem Baum', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const rel = 'docs/wap-planer/x/p.md';
    commitDateien(sb, root, { [rel]: `Kontakt ${TELEFON}\n` });
    const wap = join(root, 'docs', 'wap-planer');
    renameSync(join(wap, 'x'), join(wap, 'X_'));
    renameSync(join(wap, 'X_'), join(wap, 'X'));
    git(sb, join(wap, 'X'), 'init', '-q');
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, rel, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] S3: committendes Repo M unter .claude/worktrees eines äusseren Repos O → --root M: Befund in M/docs/wap-planer, Pfade relativ zu M, tests/io.test.ts ausserhalb der Pfadmenge «nicht geprüft»', () => {
    const sb = sandbox();
    const o = initRepo(sb, 'aussen');
    commitDateien(sb, o, { '.claude/worktrees/liesmich.md': 'x\n' }, 'O');
    const m = initRepo(sb, 'aussen/.claude/worktrees/m', { branch: 'wap/m' });
    commitDateien(
      sb,
      m,
      {
        'docs/wap-planer/i/p.md': `Kontakt ${TELEFON}\n`,
        'tests/io.test.ts': `// fiktiv ${TELEFON}\n`,
      },
      'M',
    );
    git(sb, join(m, 'docs', 'wap-planer', 'i'), 'init', '-q');
    const r = baum(sb, m, 'HEAD', { scriptRoot: o });
    expect(r.status).toBe(1);
    expectBefund(r, 'docs/wap-planer/i/p.md', 1, ART_TELEFON);
    expect(befundZeilen(r.out, 'tests/io.test.ts', 1)).toHaveLength(0);
    expect(r.out).not.toMatch(/\.claude\/worktrees\/m\/(docs|tests)\//);
    expect(r.out).toContain('nicht geprüft');
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it.each(['--skip-worktree', '--assume-unchanged'])(
    '[R-H-07] update-index %s, Datei auf dem Datenträger sauber, git status leer → --baum findet die versionierte Telefonnummer (Exit 1, Befund, maskiert)',
    (flag) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` });
      git(sb, root, 'update-index', flag, P);
      writeText(root, P, 'sauber\n');
      expect(git(sb, root, 'status', '--porcelain', '--', P)).toBe('');
      const r = baum(sb, root);
      expect(r.status).toBe(1);
      expectBefund(r, P, 1, ART_TELEFON);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07] sparse checkout ohne docs/: versionierte Datei mit Telefonnummer fehlt auf dem Datenträger → --baum Exit 1, Befund', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const rel = 'docs/wap-planer/geheim/p.md';
    commitDateien(sb, root, { [rel]: `Kontakt ${TELEFON}\n`, 'src/a.ts': 'x\n' });
    git(sb, root, 'sparse-checkout', 'set', '--no-cone', '/src/');
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, rel, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] versionierte .gitattributes mit textconv und Filter, die «sauber» liefern: Inhalt nur per cat-file → --baum Exit 1, Befund (P44 c)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` });
    commitDateien(sb, root, { '.gitattributes': '*.md diff=leer filter=leer\n' }, 'Attribute');
    git(sb, root, 'config', 'diff.leer.textconv', 'sh -c "echo sauber"');
    git(sb, root, 'config', 'filter.leer.smudge', 'sh -c "echo sauber"');
    git(sb, root, 'config', 'filter.leer.clean', 'sh -c "echo sauber"');
    nurImObjekt(root, P);
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);
});

describe('privacy-scan --baum: Symlink- und Gitlink-Einträge (P44 c)', () => {
  function symlinkEintrag(sb: Sandbox, root: string, rel: string, ziel: string): void {
    const blob = blobAus(sb, root, ziel);
    git(sb, root, 'update-index', '--add', '--cacheinfo', `120000,${blob},${rel}`);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Verweis');
  }

  it('[R-H-07] Symlink-Eintrag (120000), dessen Ziel eine Telefonnummer enthält → Exit 1, Befund «<pfad>:1:» (Ziel als Text geprüft), maskiert', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    symlinkEintrag(sb, root, 'docs/wap-planer/verweis', `../Kontakt ${TELEFON}.md`);
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, 'docs/wap-planer/verweis', 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] Symlink-Eintrag (120000) mit sauberem Ziel → Exit 0, kein Abbruch wegen Verknüpfung (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    symlinkEintrag(sb, root, 'docs/wap-planer/verweis', 'ziel.md');
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);

  function gitlink(sb: Sandbox, root: string, rel: string): void {
    const head = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'update-index', '--add', '--cacheinfo', `160000,${head},${rel}`);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Untermodul');
  }

  it.each(['docs/wap-planer/sub', 'lib/sub'])(
    '[R-H-07] Gitlink-Eintrag (160000) unter %s → --baum Exit 1 «Untermodul nicht prüfbar»; vor dem Gitlink Exit 0',
    (rel) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      expect(baum(sb, root).status).toBe(0);
      gitlink(sb, root, rel);
      const r = baum(sb, root);
      expect(r.status).toBe(1);
      expect(r.out).toContain('Untermodul nicht prüfbar');
    },
    60_000,
  );

  it('[R-H-07] Gitlink-Eintrag (160000) in einem Commit des Bereichs → --commits Exit 1 «Untermodul nicht prüfbar»', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    gitlink(sb, root, 'docs/wap-planer/sub');
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expect(r.out).toContain('Untermodul nicht prüfbar');
  }, 60_000);
});

describe('privacy-scan --commits: jeder Commit einzeln (P44 b, e)', () => {
  it('[R-H-07] Zwischencommit fügt eine Telefonnummer ein, Folgecommit entfernt sie → --commits Exit 1, Befund mit dem Kürzel des Zwischencommits, maskiert', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    const zwischen = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'Nummer');
    commitDateien(sb, root, { [P]: 'Hptm Muster A\n' }, 'entfernt');
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expectCommitBefund(r, zwischen, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] derselbe Verlauf (Nummer eingefügt und wieder entfernt) mit --baum HEAD → Exit 0 (Gegenprobe: nur --commits sieht Zwischencommits)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'Nummer');
    commitDateien(sb, root, { [P]: 'Hptm Muster A\n' }, 'entfernt');
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);

  /** Zweig «seite» mit Telefonnummer, auf wap-planer ein sauberer Commit, dann Merge --no-ff. */
  function mitMerge(sb: Sandbox): { root: string; merge: string } {
    const root = initRepo(sb, 'haupt');
    git(sb, root, 'checkout', '-q', '-b', 'seite');
    commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'Seite');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    commitDateien(sb, root, { 'docs/wap-planer/haupt.md': 'Hptm Muster A\n' }, 'Haupt');
    git(sb, root, 'merge', '-q', '--no-ff', '--no-edit', 'seite');
    return { root, merge: git(sb, root, 'rev-parse', 'HEAD') };
  }

  it('[R-H-07] Merge-Commit bringt gegenüber dem ersten Elternteil eine Datei mit Telefonnummer, Bereich seite..HEAD → --commits Exit 1, Befund mit dem Kürzel des Merge-Commits', () => {
    const sb = sandbox();
    const { root, merge } = mitMerge(sb);
    const r = commits(sb, root, 'seite..HEAD');
    expect(r.status).toBe(1);
    expectCommitBefund(r, merge, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] Merge-Commit mit Änderung nur im Merge selbst (keiner der Elternteile enthält die Datei) → --commits Exit 1, Befund mit dem Kürzel des Merge-Commits', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'checkout', '-q', '-b', 'seite');
    commitDateien(sb, root, { 'docs/wap-planer/s.md': 'Hptm Muster A\n' }, 'Seite');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    commitDateien(sb, root, { 'docs/wap-planer/h.md': 'Hptm Muster B\n' }, 'Haupt');
    git(sb, root, 'merge', '-q', '--no-ff', '--no-commit', 'seite');
    writeText(root, 'docs/wap-planer/b.md', `Kontakt ${TELEFON}\n`);
    git(sb, root, 'add', 'docs/wap-planer/b.md');
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Merge mit Zusatz');
    const merge = git(sb, root, 'rev-parse', 'HEAD');
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expectCommitBefund(r, merge, 'docs/wap-planer/b.md', 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] Bereich nach dem Merge (Merge..HEAD mit sauberem Folgecommit) → --commits Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const { root, merge } = mitMerge(sb);
    commitDateien(sb, root, { 'docs/wap-planer/danach.md': 'Hptm Muster C\n' }, 'danach');
    expect(commits(sb, root, `${merge}..HEAD`).status).toBe(0);
  }, 60_000);

  /** TR-H0-99: Seitenzweig mit Z (Telefonnummer) und W (wieder sauber), Hauptcommit, Merge --no-ff. */
  function seitenzweigMitZwischencommit(sb: Sandbox): { root: string; basis: string; z: string } {
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'checkout', '-q', '-b', 'seite');
    const z = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'Z');
    commitDateien(sb, root, { [P]: 'Hptm Muster A\n' }, 'W');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    commitDateien(sb, root, { 'docs/wap-planer/haupt.md': 'Hptm Muster B\n' }, 'Haupt');
    git(sb, root, 'merge', '-q', '--no-ff', '--no-edit', 'seite');
    return { root, basis, z };
  }

  it('[R-H-07] Seitenzweig: Zwischencommit Z fügt eine Telefonnummer ein, W entfernt sie, danach Merge --no-ff → --commits <basis>..HEAD Exit 1, Befund mit dem Kürzel von Z, maskiert (TR-H0-99)', () => {
    const sb = sandbox();
    const { root, basis, z } = seitenzweigMitZwischencommit(sb);
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expectCommitBefund(r, z, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] derselbe Seitenzweig-Verlauf mit --baum HEAD → Exit 0 (Gegenprobe, TR-H0-99)', () => {
    const sb = sandbox();
    const { root } = seitenzweigMitZwischencommit(sb);
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);

  it('[R-H-07] Merge-Commit, Eintrag nur gegenüber dem zweiten Elternteil neu (X auf wap-planer fügt p.md mit Telefonnummer hinzu, seite zweigt vor X ab) → --commits X..HEAD Exit 1, genau ein Befund mit dem Kürzel des Merge-Commits (P44f 1, TR-H0-102)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    git(sb, root, 'checkout', '-q', '-b', 'seite');
    commitDateien(sb, root, { 'docs/wap-planer/s.md': 'Hptm Muster A\n' }, 'Seite');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    const x = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'X');
    git(sb, root, 'merge', '-q', '--no-ff', '--no-edit', 'seite');
    const merge = git(sb, root, 'rev-parse', 'HEAD');
    const r = commits(sb, root, `${x}..HEAD`);
    expect(r.status).toBe(1);
    expectCommitBefund(r, merge, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  /** TR-H0-110: C1 fügt p.md sauber hinzu (A), C2 ändert sie und fügt die Nummer ein (M), C3 macht sie wieder sauber (M). */
  function aenderungMitNummer(sb: Sandbox): { root: string; basis: string; c2: string } {
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    commitDateien(sb, root, { [P]: 'Hptm Muster A\n' }, 'C1');
    const c2 = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'C2');
    commitDateien(sb, root, { [P]: 'Hptm Muster B\n' }, 'C3');
    expect(git(sb, root, 'diff-tree', '-r', '--name-status', c2)).toMatch(/^M\s/m);
    return { root, basis, c2 };
  }

  it.each([
    ['<basis>..HEAD (mit C3)', 'HEAD'],
    ['<basis>..C2', 'C2'],
  ])(
    '[R-H-07] Treffer entsteht durch Änderung (M) eines zuvor sauberen Pfads in C2, Bereich %s → --commits Exit 1, Befund mit dem Kürzel von C2, maskiert (TR-H0-110)',
    (_label, ende) => {
      const sb = sandbox();
      const { root, basis, c2 } = aenderungMitNummer(sb);
      const r = commits(sb, root, `${basis}..${ende === 'C2' ? c2 : 'HEAD'}`);
      expect(r.status).toBe(1);
      expectCommitBefund(r, c2, P, 1, ART_TELEFON);
      expectMasked(sb, r, TELEFON, [root]);
    },
    60_000,
  );

  it('[R-H-07] derselbe Verlauf C1 (A, sauber), C2 (M, Nummer), C3 (M, sauber) mit --baum HEAD → Exit 0 (Gegenprobe, TR-H0-110)', () => {
    const sb = sandbox();
    const { root } = aenderungMitNummer(sb);
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);

  it('[R-H-07] Wurzel-Commit eines verwaisten Zweigs mit Telefonnummer, Bereich wap-planer..neu → --commits Exit 1, Befund mit dem Kürzel des Wurzel-Commits', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    git(sb, root, 'checkout', '-q', '--orphan', 'neu');
    const wurzel = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'Wurzel');
    expect(git(sb, root, 'rev-list', '--parents', '-n', '1', wurzel)).toBe(wurzel);
    const r = commits(sb, root, 'wap-planer..neu');
    expect(r.status).toBe(1);
    expectCommitBefund(r, wurzel, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] jedes Paar Pfad/Blob einmal: derselbe Blob zweimal unter p.md (entfernt und wieder eingefügt) ergibt einen Befund, unter q.md einen weiteren', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    const inhalt = `Kontakt ${TELEFON}\n`;
    commitDateien(sb, root, { [P]: inhalt }, 'eins');
    git(sb, root, 'rm', '-q', P);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'weg');
    commitDateien(sb, root, { [P]: inhalt }, 'wieder');
    commitDateien(sb, root, { 'docs/wap-planer/q.md': inhalt }, 'kopie');
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expect(commitBefundZeilen(r.out, P, 1)).toHaveLength(1);
    expect(commitBefundZeilen(r.out, 'docs/wap-planer/q.md', 1)).toHaveLength(1);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] Umbenennung einer Datei mit Telefonnummer im Bereich (Basis enthält sie schon) → --commits Exit 1, Befund am neuen Pfad (--no-renames)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const basis = commitDateien(sb, root, { 'lib/alt.md': `Kontakt ${TELEFON}\n` }, 'ausserhalb');
    git(sb, root, 'mv', 'lib/alt.md', 'docs/wap-planer/neu.md');
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'umbenannt');
    const umbenannt = git(sb, root, 'rev-parse', 'HEAD');
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expectCommitBefund(r, umbenannt, 'docs/wap-planer/neu.md', 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] Typwechsel im Bereich: reguläre Datei wird Symlink-Eintrag mit Telefonnummer im Ziel → --commits Exit 1, Befund (--diff-filter T)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const basis = commitDateien(sb, root, { [P]: 'Hptm Muster A\n' }, 'regulär');
    const blob = blobAus(sb, root, `../Kontakt ${TELEFON}.md`);
    git(sb, root, 'update-index', '--cacheinfo', `120000,${blob},${P}`);
    git(sb, root, 'commit', '-q', '--no-verify', '-m', 'Typwechsel');
    const wechsel = git(sb, root, 'rev-parse', 'HEAD');
    expect(git(sb, root, 'diff-tree', '-r', '--name-status', wechsel)).toMatch(/^T\s/m);
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expectCommitBefund(r, wechsel, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it.each(['HEAD..HEAD', 'wap-planer..wap-planer'])(
    '[R-H-07] leerer Bereich %s → --commits Exit 0 mit Zählung 0',
    (bereich) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` });
      const r = commits(sb, root, bereich);
      expect(r.status).toBe(0);
      // TR-H0-106: allein stehende Ziffer 0; danach Satzzeichen erlaubt, aber keine weitere Ziffer.
      expect(withoutSandboxPath(sb, r.out)).toMatch(/(?<![\w.,])0(?!\w|[.,]\d)/);
    },
    60_000,
  );
});

describe('privacy-scan Objekt-Modi: ungültige Refs, Bereiche und Repo-Zustände → Exit 1 (P44 d)', () => {
  const UNGUELTIG: Array<[string, string[]]> = [
    ['--baum mit unbekanntem Ref', ['--baum', 'nichtda']],
    ['--commits mit unbekannter Basis', ['--commits', 'nichtda..HEAD']],
    ['--commits mit unbekanntem Ref', ['--commits', 'HEAD..nichtda']],
    ['--commits ohne Bereich «..»', ['--commits', 'HEAD']],
  ];

  it.each(UNGUELTIG)(
    '[R-H-07] %s → Exit 1; derselbe saubere Stand mit gültigem Ref bzw. Bereich → Exit 0',
    (_label, args) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const gueltig = args[0] === '--baum' ? ['--baum', 'HEAD'] : ['--commits', 'HEAD~0..HEAD'];
      expect(scanObjekte(sb, root, ['--root', root, ...gueltig]).status).toBe(0);
      expect(scanObjekte(sb, root, ['--root', root, ...args]).status).toBe(1);
    },
    60_000,
  );

  it.each(['--baum', '--commits'])(
    '[R-H-07] <git-common-dir>/info/grafts vorhanden → %s Exit 1; ohne grafts Exit 0',
    (modus) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      const head = commitDateien(sb, root, { 'docs/wap-planer/h.md': 'Hptm Muster A\n' });
      const lauf = () =>
        modus === '--baum' ? baum(sb, root) : commits(sb, root, `${basis}..HEAD`);
      expect(lauf().status).toBe(0);
      writeText(commonDir(sb, root), 'info/grafts', `${head}\n`);
      expect(lauf().status).toBe(1);
    },
    60_000,
  );

  it('[R-H-07] flacher Klon (--depth 1) → --baum Exit 1; vollständiger Klon desselben Repos → Exit 0', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { 'docs/wap-planer/h.md': 'Hptm Muster A\n' });
    git(sb, sb.base, 'clone', '-q', fileUrl(root), 'voll');
    git(sb, sb.base, 'clone', '-q', '--depth', '1', fileUrl(root), 'flach');
    const voll = join(sb.base, 'voll');
    const flach = join(sb.base, 'flach');
    expect(git(sb, flach, 'rev-parse', '--is-shallow-repository')).toBe('true');
    expect(baum(sb, voll, 'HEAD', { scriptRoot: root }).status).toBe(0);
    expect(baum(sb, flach, 'HEAD', { scriptRoot: root }).status).toBe(1);
  }, 60_000);

  it.each(['--baum', '--commits'])(
    '[R-H-07] git replace ersetzt den versionierten Blob mit Telefonnummer durch einen sauberen → %s findet die Nummer trotzdem (Exit 1, Befund, maskiert)',
    (modus) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      const commit = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` });
      const schmutzig = git(sb, root, 'rev-parse', `HEAD:${P}`);
      git(sb, root, 'replace', schmutzig, blobAus(sb, root, 'sauber\n'));
      nurImObjekt(root, P);
      const r = modus === '--baum' ? baum(sb, root) : commits(sb, root, `${basis}..HEAD`);
      expect(r.status).toBe(1);
      if (modus === '--baum') expectBefund(r, P, 1, ART_TELEFON);
      else expectCommitBefund(r, commit, P, 1, ART_TELEFON);
      expectMasked(sb, r, TELEFON, [root]);
    },
    60_000,
  );

  it('[R-H-07] git replace ersetzt einen sauberen versionierten Blob durch einen mit Telefonnummer → --baum Exit 0 (Gegenprobe: Ersetzungen wirken nicht)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { [P]: 'Hptm Muster A\n' });
    const sauber = git(sb, root, 'rev-parse', `HEAD:${P}`);
    git(sb, root, 'replace', sauber, blobAus(sb, root, `Kontakt ${TELEFON}\n`));
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);
});

describe('privacy-scan Objekt-Modi: --root ist Pflicht und bestätigt (P44 a)', () => {
  const FALSCHE_WURZEL: Array<[string, (sb: Sandbox, root: string) => string[]]> = [
    ['--root fehlt', () => ['--baum', 'HEAD']],
    [
      '--root ist ein Unterordner der Wurzel',
      (_sb, root) => ['--root', join(root, 'docs'), '--baum', 'HEAD'],
    ],
    [
      '--root ist ein Ordner ausserhalb jedes Repos',
      (sb) => {
        const leer = join(sb.base, 'leer');
        writeText(leer, 'x.md', 'x\n');
        return ['--root', leer, '--baum', 'HEAD'];
      },
    ],
    ['--root existiert nicht', (sb) => ['--root', join(sb.base, 'fehlt'), '--baum', 'HEAD']],
  ];

  it.each(FALSCHE_WURZEL)(
    '[R-H-07] %s → Exit 1; derselbe saubere Stand mit bestätigter Wurzel → Exit 0',
    (_label, args) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      expect(baum(sb, root).status).toBe(0);
      expect(scanObjekte(sb, root, args(sb, root)).status).toBe(1);
    },
    60_000,
  );

  it('[R-H-07] --root in anderer Gross/Klein-Schreibung und mit / statt \\ wird nativ aufgelöst und bestätigt → Befund wie mit der genauen Schreibweise', () => {
    const sb = sandbox();
    const root = repoMitNummerNurImObjekt(sb);
    const anders = root.toUpperCase().split(String.fromCharCode(92)).join('/');
    const r = scanObjekte(sb, root, ['--root', anders, '--baum', 'HEAD']);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);
});

describe('privacy-scan Objekt-Modi: Umgebung des Aufrufers wirkt nicht (P44 d)', () => {
  /**
   * Köder-Repo: Variablen zeigen dorthin; würde das Skript sie übernehmen, änderte sich das Ergebnis.
   * Trennende Wirkung bei --baum haben GIT_DIR, GIT_WORK_TREE und GIT_OBJECT_DIRECTORY.
   * GIT_INDEX_FILE und GIT_CEILING_DIRECTORIES: keine trennende Wirkung (ls-tree und --show-toplevel
   * bleiben gleich, TR-H0-100); sie bleiben nur als Ergänzung drin und zählen nicht als Deckung von
   * P44 (d). Wirksamer Vertreter für «jede GIT_*-Variable» (P44f) ist GIT_GRAFT_FILE bei --commits.
   */
  const VARIABLEN: Array<[string, (koeder: string) => string]> = [
    ['GIT_DIR', (k) => join(k, '.git')],
    ['GIT_WORK_TREE', (k) => k],
    ['GIT_INDEX_FILE', (k) => join(k, '.git', 'index')],
    ['GIT_CEILING_DIRECTORIES', (k) => k],
    ['GIT_OBJECT_DIRECTORY', (k) => join(k, '.git', 'objects')],
  ];

  /** Basis, Z (Telefonnummer), H (sauber); eine Graft-Datei ausserhalb des Repos macht die Basis zum Elternteil von H. */
  function mitGraftDatei(sb: Sandbox): { root: string; basis: string; z: string; graft: string } {
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    const z = commitDateien(sb, root, { [P]: `Kontakt ${TELEFON}\n` }, 'Z');
    const h = commitDateien(sb, root, { [P]: 'Hptm Muster A\n' }, 'H');
    const graft = writeText(sb.base, 'graft-aussen.txt', `${h} ${basis}\n`);
    const mitGraft = { ...sb, env: { ...sb.env, GIT_GRAFT_FILE: graft } };
    expect(
      git(mitGraft, root, 'rev-list', '--count', `${basis}..HEAD`),
      'Aufbau: die Graft-Datei blendet Z aus',
    ).toBe('1');
    return { root, basis, z, graft };
  }

  it('[R-H-07] GIT_GRAFT_FILE (Graft-Datei ausserhalb des Repos blendet den Zwischencommit Z aus) → --commits Exit 1, Befund mit dem Kürzel von Z, maskiert (P44 d, P44f)', () => {
    const sb = sandbox();
    const { root, basis, z, graft } = mitGraftDatei(sb);
    const r = commits(sb, root, `${basis}..HEAD`, { env: { ...sb.env, GIT_GRAFT_FILE: graft } });
    expect(r.status).toBe(1);
    expectCommitBefund(r, z, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] derselbe Verlauf ohne GIT_GRAFT_FILE → --commits Exit 1, Befund mit dem Kürzel von Z (Gegenprobe)', () => {
    const sb = sandbox();
    const { root, basis, z } = mitGraftDatei(sb);
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expectCommitBefund(r, z, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it.each(VARIABLEN)(
    '[R-H-07] %s auf ein sauberes Köder-Repo gesetzt, HEAD von --root mit Telefonnummer → --baum Exit 1, Befund wie ohne Variable',
    (name, wert) => {
      const sb = sandbox();
      const root = repoMitNummerNurImObjekt(sb);
      const koeder = initRepo(sb, 'koeder');
      const env = { ...sb.env, [name]: wert(koeder) };
      const r = baum(sb, root, 'HEAD', { env });
      expect(r.status).toBe(1);
      expectBefund(r, P, 1, ART_TELEFON);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(VARIABLEN)(
    '[R-H-07] %s auf ein Köder-Repo mit Telefonnummer gesetzt, HEAD von --root sauber → --baum Exit 0 wie ohne Variable',
    (name, wert) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const koeder = repoMitNummerNurImObjekt(sb, P, 'koeder');
      const env = { ...sb.env, [name]: wert(koeder) };
      expect(baum(sb, root, 'HEAD', { env }).status).toBe(0);
    },
    60_000,
  );
});

describe('privacy-scan Objekt-Modi: Aufruf aus dem Arbeits-Checkout auf einen Paket-Zweig (P44 a, b)', () => {
  function mitPaketWorktree(sb: Sandbox): { root: string; wt: string; commit: string } {
    const root = initRepo(sb, 'haupt');
    const wt = addWorktree(sb, root, join(sb.base, 'wt', 'p'), 'wap/p');
    const commit = commitDateien(sb, wt, { [P]: `Kontakt ${TELEFON}\n` }, 'Paket');
    return { root, wt, commit };
  }

  it('[R-H-07] aus dem Arbeits-Checkout: --root <Arbeits-Checkout> --baum wap/p (Zweig eines verknüpften Worktrees) → Exit 1, Befund, maskiert', () => {
    const sb = sandbox();
    const { root } = mitPaketWorktree(sb);
    const r = baum(sb, root, 'wap/p');
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] aus dem Arbeits-Checkout: --commits wap-planer..wap/p → Exit 1, Befund mit dem Kürzel des Paket-Commits', () => {
    const sb = sandbox();
    const { root, commit } = mitPaketWorktree(sb);
    const r = commits(sb, root, 'wap-planer..wap/p');
    expect(r.status).toBe(1);
    expectCommitBefund(r, commit, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON, [root]);
  }, 60_000);

  it('[R-H-07] aus dem Arbeits-Checkout: --baum wap-planer, während der Paket-Zweig eine Telefonnummer enthält → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const { root } = mitPaketWorktree(sb);
    expect(baum(sb, root, 'wap-planer').status).toBe(0);
  }, 60_000);
});

describe('privacy-scan Objekt-Modi: Pfadmenge, P19 und reference/ relativ zu --root (P44 c)', () => {
  it.each(['lib/p.md', 'vendor/docs/wap-planer/p.md', 'docs/AGENTS.md'])(
    '[R-H-07] versionierte Datei %s mit Telefonnummer liegt ausserhalb der Pfadmenge → Exit 0, «nicht geprüft»',
    (rel) => {
      const sb = sandbox();
      const root = repoMitNummerNurImObjekt(sb, rel);
      const r = baum(sb, root);
      expect(r.status).toBe(0);
      expect(r.out).toContain('nicht geprüft');
    },
    60_000,
  );

  it.each([
    'package.json',
    'AGENTS.md',
    'src/io/wap/p.ts',
    'docs/wap-planer/reference/p.md',
    '.claude/notiz.md',
  ])(
    '[R-H-07] versionierte Datei %s (in der Pfadmenge) mit Telefonnummer → Exit 1, Befund «<pfad>:1:», maskiert',
    (rel) => {
      const sb = sandbox();
      const root = repoMitNummerNurImObjekt(sb, rel);
      const r = baum(sb, root);
      expect(r.status).toBe(1);
      expectBefund(r, rel, 1, ART_TELEFON);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(['lib/Kontakt <Tel>/p.md', 'docs/wap-planer/Kontakt <Tel>.md', 'Kontakt <Tel>.txt'])(
    '[R-H-07] P19: sauberer Inhalt unter dem Pfad «%s» → Exit 1, Befund maskiert; vorher ohne die Datei Exit 0',
    (relPlatzhalter) => {
      const sb = sandbox();
      const rel = mitTelefon(relPlatzhalter);
      const root = initRepo(sb, 'haupt');
      expect(baum(sb, root).status).toBe(0);
      commitDateien(sb, root, { [rel]: 'Hptm Muster A\n' });
      nurImObjekt(root, rel);
      const r = baum(sb, root);
      expect(r.status).toBe(1);
      expect(r.out).toContain('Pfad');
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07] versionierte reference/a.txt (oberste Ebene) → Exit 1, Meldung «reference/», Dateiname maskiert; vorher ohne die Datei Exit 0', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    expect(baum(sb, root).status).toBe(0);
    commitDateien(sb, root, { 'reference/Geheimliste.txt': 'binaer\n' });
    nurImObjekt(root, 'reference');
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expect(r.out).toContain('reference/');
    expect(r.out).not.toContain('Geheimliste');
  }, 60_000);

  it('[R-H-07] versionierte lib/reference/a.txt (nicht oberste Ebene, ausserhalb der Pfadmenge, sauber) → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { 'lib/reference/a.txt': 'binaer\n' });
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);

  it('[R-H-07] --commits: Commit versioniert reference/a.txt → Exit 1, Meldung «reference/»', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    commitDateien(sb, root, { 'reference/a.txt': 'binaer\n' });
    const r = commits(sb, root, `${basis}..HEAD`);
    expect(r.status).toBe(1);
    expect(r.out).toContain('reference/');
  }, 60_000);
});

describe('privacy-scan Objekt-Modi: keine Ausschlüsse nach P24a (P44 c)', () => {
  it.each(['dist', 'spikes', 'coverage', '.qa'])(
    '[R-H-07] versionierte Datei «%s/Kontakt <Tel>.md» (Telefonnummer im Pfad, Ordner auf oberster Ebene) → Exit 1, Befund maskiert; vorher Exit 0',
    (ordner) => {
      const sb = sandbox();
      const rel = mitTelefon(`${ordner}/Kontakt ${PLATZHALTER}.md`);
      const root = initRepo(sb, 'haupt');
      expect(baum(sb, root).status).toBe(0);
      commitDateien(sb, root, { [rel]: 'Hptm Muster A\n' });
      const r = baum(sb, root);
      expect(r.status).toBe(1);
      expect(r.out).toContain('Pfad');
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it.each(['docs/wap-planer/node_modules/p.md', 'docs/wap-planer/dist/p.md'])(
    '[R-H-07] versionierte Datei %s mit Telefonnummer → Exit 1, Befund «<pfad>:1:», maskiert',
    (rel) => {
      const sb = sandbox();
      const root = repoMitNummerNurImObjekt(sb, rel);
      const r = baum(sb, root);
      expect(r.status).toBe(1);
      expectBefund(r, rel, 1, ART_TELEFON);
      expectMasked(sb, r, TELEFON);
    },
    60_000,
  );

  it('[R-H-07] versionierte saubere dist/a.md → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { 'dist/a.md': 'Hptm Muster A\n' });
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);
});

describe('privacy-scan Objekt-Modi: Regeln von --staged (P44 c: P18, P20, P22, P32, P36, P41a)', () => {
  it('[R-H-07] P18: versionierte UTF-16-LE-Datei mit BOM und Telefonnummer → Exit 1, Befund «<pfad>:1:», maskiert', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const bytes = Buffer.concat([
      Buffer.from([0xff, 0xfe]),
      Buffer.from(`Kontakt ${TELEFON}\n`, 'utf16le'),
    ]);
    commitDateien(sb, root, { [P]: bytes });
    nurImObjekt(root, P);
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] P32: Telefonnummer mit geschütztem Leerzeichen gegliedert → Exit 1, Befund, maskiert', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const nbsp = String.fromCharCode(0xa0);
    const nummer = j('07', '9', nbsp, '483', nbsp, '26', nbsp, '15');
    commitDateien(sb, root, { [P]: `Kontakt ${nummer}\n` });
    nurImObjekt(root, P);
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, nummer);
  }, 60_000);

  it('[R-H-07] P22: Sperrlisten-Name in NFD-Schreibweise → Exit 1, Befund, maskiert', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, { [P]: `Lt ${GESPERRTE_NAMEN[2].normalize('NFD')} B\n` });
    nurImObjekt(root, P);
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_NAME);
    expectMasked(sb, r, GESPERRTE_NAMEN[2]);
  }, 60_000);

  it('[R-H-07] P20: Datumsangaben und die aufsteigende Ziffernfolge ab 0 (zehn Ziffern) → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    commitDateien(sb, root, {
      [P]: `Beginn 30.09.2026, Ende 01.10.2026\nFolge ${j('01234', '56789')}\n`,
    });
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);

  const PROMPT = 'docs/wap-planer/PROMPT_WAP_Planer.md';

  it('[R-H-07] P36: Positivliste «<Name>@PROMPT» im Checkout des Skripts erlaubt den Namen nur in PROMPT; derselbe Name in andere.md → Exit 1, nur dort ein Befund', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'scripts/wap/privacy-allow.txt', `${GESPERRTE_NAMEN[0]}@${PROMPT}\n`);
    commitDateien(sb, root, {
      [PROMPT]: `Hptm ${GESPERRTE_NAMEN[0]}\n`,
      'docs/wap-planer/andere.md': `Hptm ${GESPERRTE_NAMEN[0]}\n`,
    });
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, 'docs/wap-planer/andere.md', 1, ART_NAME);
    expect(befundZeilen(r.out, PROMPT, 1)).toHaveLength(0);
    expectMasked(sb, r, GESPERRTE_NAMEN[0]);
  }, 60_000);

  it('[R-H-07] P36: Positivliste «<Name>@PROMPT», Name nur in PROMPT → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'scripts/wap/privacy-allow.txt', `${GESPERRTE_NAMEN[0]}@${PROMPT}\n`);
    commitDateien(sb, root, { [PROMPT]: `Hptm ${GESPERRTE_NAMEN[0]}\n` });
    expect(baum(sb, root).status).toBe(0);
  }, 60_000);

  it('[R-H-07] P41a: Zeile «<Name> @ PROMPT» (Leerraum um das @) ist kein Eintrag → Name in PROMPT bleibt ein Befund (Exit 1, maskiert)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    writeText(root, 'scripts/wap/privacy-allow.txt', `${GESPERRTE_NAMEN[0]} @ ${PROMPT}\n`);
    commitDateien(sb, root, { [PROMPT]: `Hptm ${GESPERRTE_NAMEN[0]}\n` });
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, PROMPT, 1, ART_NAME);
    expectMasked(sb, r, GESPERRTE_NAMEN[0]);
  }, 60_000);

  it('[R-H-07] P18: versionierte UTF-16-BE-Datei mit BOM und Telefonnummer → Exit 1, Befund «<pfad>:1:», maskiert (TR-H0-109)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const le = Buffer.from(`Kontakt ${TELEFON}\n`, 'utf16le');
    const be = Buffer.alloc(le.length);
    for (let i = 0; i + 1 < le.length; i += 2) {
      be[i] = le[i + 1];
      be[i + 1] = le[i];
    }
    commitDateien(sb, root, { [P]: Buffer.concat([Buffer.from([0xfe, 0xff]), be]) });
    nurImObjekt(root, P);
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);

  it('[R-H-07] P36a/P41: versionierte privacy-allow.txt im Selbst-Scan – Name links in der eigenen «<Name>@<pfad>»-Zeile erlaubt, anderer Name in einer Kommentarzeile → Exit 1, nur Zeile 2 als Befund (TR-H0-109)', () => {
    const sb = sandbox();
    const root = initRepo(sb, 'haupt');
    const allow = `${GESPERRTE_NAMEN[0]}@${PROMPT}\n# Hinweis ${GESPERRTE_NAMEN[1]}\n`;
    writeText(root, 'scripts/wap/privacy-allow.txt', allow);
    commitDateien(sb, root, { 'scripts/wap/privacy-allow.txt': allow });
    const r = baum(sb, root);
    expect(r.status).toBe(1);
    expectBefund(r, 'scripts/wap/privacy-allow.txt', 2, ART_NAME);
    expect(befundZeilen(r.out, 'scripts/wap/privacy-allow.txt', 1)).toHaveLength(0);
    expectMasked(sb, r, GESPERRTE_NAMEN[0]);
    expectMasked(sb, r, GESPERRTE_NAMEN[1]);
  }, 60_000);
});

describe('privacy-scan Objekt-Modi: Pfade mit Nicht-ASCII-Zeichen (-z, P19, P22; TR-H0-104)', () => {
  it.each(['--baum', '--commits'])(
    '[R-H-07] %s: saubere Datei, deren Name ein Sperrlisten-Name mit Umlaut ist → Exit 1, Pfadbefund maskiert; vorher Exit 0',
    (modus) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      const lauf = () =>
        modus === '--baum' ? baum(sb, root) : commits(sb, root, `${basis}..HEAD`);
      expect(lauf().status).toBe(0);
      const rel = `docs/wap-planer/${GESPERRTE_NAMEN[2]}.md`;
      commitDateien(sb, root, { [rel]: 'Hptm Muster A\n' });
      nurImObjekt(root, rel);
      const r = lauf();
      expect(r.status).toBe(1);
      expect(r.out).toContain('Pfad');
      expectMasked(sb, r, GESPERRTE_NAMEN[2], [root]);
    },
    60_000,
  );

  it.each(['--baum', '--commits'])(
    '[R-H-07] %s: docs/wap-planer/Übersicht.md mit Telefonnummer → Exit 1, Befund mit dem Pfad im Klartext, maskiert',
    (modus) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      const rel = 'docs/wap-planer/Übersicht.md';
      const commit = commitDateien(sb, root, { [rel]: `Kontakt ${TELEFON}\n` });
      nurImObjekt(root, rel);
      const r = modus === '--baum' ? baum(sb, root) : commits(sb, root, `${basis}..HEAD`);
      expect(r.status).toBe(1);
      if (modus === '--baum') expectBefund(r, rel, 1, ART_TELEFON);
      else expectCommitBefund(r, commit, rel, 1, ART_TELEFON);
      expectMasked(sb, r, TELEFON, [root]);
    },
    60_000,
  );
});

describe('privacy-scan Objekt-Modi: fehlende oder leere Sperrliste (R-H-07, P24; TR-H0-105)', () => {
  const LISTEN: Array<[string, (sb: Sandbox) => string]> = [
    ['ohne Sperrliste', (sb) => join(writeText(sb.base, 'ohne-liste/liesmich.txt', 'x\n'), '..')],
    [
      'mit Sperrliste nur aus Kommentaren',
      (sb) => join(writeText(sb.base, `nur-kommentar/${SPERRLISTE}`, '# nur Kommentar\n\n'), '..'),
    ],
  ];
  const FAELLE: Array<[string, string, (sb: Sandbox) => string]> = [];
  for (const modus of ['--baum', '--commits']) {
    for (const [label, ordnerAnlegen] of LISTEN) FAELLE.push([modus, label, ordnerAnlegen]);
  }

  it.each(FAELLE)(
    '[R-H-07] %s, WAP_REFERENCE_DIR %s → Exit 1; derselbe saubere Stand mit Sperrliste → Exit 0',
    (modus, _label, ordnerAnlegen) => {
      const sb = sandbox();
      const root = initRepo(sb, 'haupt');
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      commitDateien(sb, root, { [P]: 'Hptm Muster A\n' });
      const lauf = (env?: NodeJS.ProcessEnv) =>
        modus === '--baum'
          ? baum(sb, root, 'HEAD', { env })
          : commits(sb, root, `${basis}..HEAD`, { env });
      expect(lauf().status).toBe(0);
      expect(lauf({ ...sb.env, WAP_REFERENCE_DIR: ordnerAnlegen(sb) }).status).toBe(1);
    },
    60_000,
  );
});

describe('privacy-scan Objekt-Modi: --root als 8.3-Kurzname (P44 a nativ aufgelöst; TR-H0-108)', () => {
  it('[R-H-07] --root als 8.3-Kurzname der Wurzel → bestätigt, Befund wie mit der genauen Schreibweise', () => {
    const sb = sandbox();
    const lang = 'hauptrepository-lang';
    const root = repoMitNummerNurImObjekt(sb, P, lang);
    const kurz = join(sb.base, shortName(sb.base, lang));
    expect(kurz).not.toBe(root);
    const r = scanObjekte(sb, root, ['--root', kurz, '--baum', 'HEAD']);
    expect(r.status).toBe(1);
    expectBefund(r, P, 1, ART_TELEFON);
    expectMasked(sb, r, TELEFON);
  }, 60_000);
});
