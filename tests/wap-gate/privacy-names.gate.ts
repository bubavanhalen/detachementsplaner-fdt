// V11 Namensprüfung aller versionierten Textdateien (Gate-0-Entscheid 11 b, ADR-010 §3.2 V11).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §2 (scanNames), §6b Fälle (1)–(8).
// Temporäre Repos mit eigener fiktiver Sperrliste über WAP_REFERENCE_DIR (nie die echte Liste).
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ahvNummer,
  aufraeumen,
  commitAlles,
  FIKTIVER_NAME,
  git,
  KURZ,
  neueSandbox,
  neuesRepo,
  node,
  prozessUmgebung,
  type Sandbox,
  WT,
  writeText,
} from './support/umgebung';
import { privacyNames } from './support/vertrag';

afterEach(aufraeumen);

const CLI = join(WT, 'scripts', 'wap-gate', 'privacy-names.mjs');

function repo(sb: Sandbox, name = 'repo'): string {
  prozessUmgebung(sb);
  return neuesRepo(sb, name);
}

function ohneName(text: string): void {
  expect(text.toLowerCase()).not.toContain(FIKTIVER_NAME.toLowerCase());
}

function anzahlEintraege(sb: Sandbox, root: string): number {
  return git(sb, root, 'ls-tree', '-r', '--name-only', 'HEAD')
    .split('\n')
    .filter((z) => z !== '').length;
}

describe('scanNames im Stand (baum)', () => {
  it('[R-H-34] (1) fiktiver Sperrlisten-Name in einer Suite-Textdatei ausserhalb der WAP-Pfadmenge → rot mit Pfad und Anzahl, ohne Namen', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(
      root,
      'src/components/Beispiel.tsx',
      `// Ansprechperson: ${FIKTIVER_NAME}\nexport const wer = '${FIKTIVER_NAME}';\n`,
    );
    commitAlles(sb, root, 'Beispiel');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(false);
    expect(r.treffer).toEqual([{ commit: null, pfad: 'src/components/Beispiel.tsx', anzahl: 2 }]);
    ohneName(JSON.stringify(r));
  });

  it('[R-H-34] ohne Namen im Stand → grün; geprueft zählt alle Textdateien des Baums', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'src/components/Sauber.tsx', 'export const wer = "Hptm Muster A";\n');
    commitAlles(sb, root, 'Sauber');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(true);
    expect(r.treffer).toEqual([]);
    expect(r.nichtText).toBe(0);
    expect(r.geprueft).toBe(anzahlEintraege(sb, root));
  });

  it('[R-H-34] Name nur im Arbeitsbaum (nicht committet) → baum HEAD grün (nur aus git-Objekten)', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'docs/notiz.md', `${FIKTIVER_NAME}\n`);
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(true);
  });

  it('[R-H-34] Name in anderer Gross-/Kleinschreibung → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'tools/notiz.txt', `${FIKTIVER_NAME.toUpperCase()}\n`);
    commitAlles(sb, root, 'Notiz');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(false);
    expect(r.treffer.map((t) => t.pfad)).toEqual(['tools/notiz.txt']);
  });

  it('[R-H-34] (3) Name in einer Binärdatei (NUL-Byte) → nicht gewertet, nichtText zählt sie', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const bytes = Buffer.concat([
      Buffer.from([0x00, 0x01, 0x02]),
      Buffer.from(` ${FIKTIVER_NAME} `, 'utf8'),
      Buffer.from([0x00]),
    ]);
    writeText(root, 'src/assets/bild.bin', bytes);
    commitAlles(sb, root, 'Binär');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(true);
    expect(r.nichtText).toBe(1);
    expect(r.geprueft).toBe(anzahlEintraege(sb, root) - 1);
  });

  it('[R-H-34] (4) Name in einer UTF-16-Datei mit BOM → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const text = Buffer.from(`Liste\r\n${FIKTIVER_NAME}\r\n`, 'utf16le');
    writeText(root, 'docs/liste-utf16.txt', Buffer.concat([Buffer.from([0xff, 0xfe]), text]));
    commitAlles(sb, root, 'UTF-16');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(false);
    expect(r.treffer.map((t) => t.pfad)).toEqual(['docs/liste-utf16.txt']);
  });

  it('[R-H-34] (5) Freigabe <Name>@<pfad> gilt für genau diesen Pfad, ein anderer Pfad bleibt rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'scripts/wap/privacy-allow.txt', `${FIKTIVER_NAME}@docs/frei.md\n`);
    writeText(root, 'docs/frei.md', `${FIKTIVER_NAME}\n`);
    commitAlles(sb, root, 'Freigabe');
    const { scanNames } = await privacyNames();
    const gruen = await scanNames({ root, baum: 'HEAD' });
    expect(gruen.ok).toBe(true);
    writeText(root, 'docs/anders.md', `${FIKTIVER_NAME}\n`);
    commitAlles(sb, root, 'Anderer Pfad');
    const rot = await scanNames({ root, baum: 'HEAD' });
    expect(rot.ok).toBe(false);
    expect(rot.treffer.map((t) => t.pfad)).toEqual(['docs/anders.md']);
    ohneName(JSON.stringify(rot));
  });

  it('[R-H-34] (7) AHV-Nummer ausserhalb der WAP-Pfadmenge → von scanNames nicht gewertet', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'src/components/Nummer.tsx', `export const n = '${ahvNummer()}';\n`);
    commitAlles(sb, root, 'Nummer');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(true);
    expect(r.treffer).toEqual([]);
  });

  it('[R-H-34] (8) Gitlink (Untermodul) → rot «Untermodul nicht prüfbar»', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const kopf = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'update-index', '--add', '--cacheinfo', `160000,${kopf},extern/modul`);
    git(sb, root, 'commit', '-q', '-m', 'Gitlink');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(false);
    expect(r.ursache ?? '').toContain('Untermodul nicht prüfbar');
  });
});

describe('scanNames über Commits', () => {
  it('[R-H-34] (2) Name nur in einem Zwischencommit, im Endstand entfernt → baum grün, commits rot mit Commit-Kürzel', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    writeText(root, 'docs/notiz.md', `Besprechung mit ${FIKTIVER_NAME}\n`);
    const zwischen = commitAlles(sb, root, 'Zwischenstand');
    writeText(root, 'docs/notiz.md', 'Besprechung mit Hptm Muster A\n');
    commitAlles(sb, root, 'Bereinigt');
    const { scanNames } = await privacyNames();
    const baum = await scanNames({ root, baum: 'HEAD' });
    expect(baum.ok).toBe(true);
    const commits = await scanNames({ root, commits: `${basis}..HEAD` });
    expect(commits.ok).toBe(false);
    expect(commits.treffer).toHaveLength(1);
    const t = commits.treffer[0];
    expect(t?.pfad).toBe('docs/notiz.md');
    expect(t?.anzahl).toBe(1);
    expect(t?.commit?.length ?? 0).toBeGreaterThanOrEqual(7);
    expect(zwischen.startsWith(t?.commit ?? '-')).toBe(true);
    ohneName(JSON.stringify(commits));
  });

  it('[R-H-34] Bereich ohne Namen in allen Commits → grün', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    writeText(root, 'docs/notiz.md', 'Besprechung mit Hptm Muster A\n');
    commitAlles(sb, root, 'Notiz');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, commits: `${basis}..HEAD` });
    expect(r.ok).toBe(true);
    expect(r.treffer).toEqual([]);
  });

  it('[R-H-34] Merge-Commit: Name in einer gegenüber einem Elternteil hinzugefügten Datei → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const basis = git(sb, root, 'rev-parse', 'HEAD');
    git(sb, root, 'checkout', '-q', '-b', 'thema');
    writeText(root, 'docs/thema.md', `${FIKTIVER_NAME}\n`);
    commitAlles(sb, root, 'Thema');
    git(sb, root, 'checkout', '-q', 'wap-planer');
    writeText(root, 'docs/haupt.md', 'Haupt\n');
    commitAlles(sb, root, 'Haupt');
    git(sb, root, 'merge', '-q', '--no-ff', '-m', 'Integration', 'thema');
    git(sb, root, 'rm', '-q', 'docs/thema.md');
    commitAlles(sb, root, 'Entfernt');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, commits: `${basis}..HEAD` });
    expect(r.ok).toBe(false);
    expect(r.treffer.every((t) => t.pfad === 'docs/thema.md')).toBe(true);
  });
});

describe('scanNames: Fehlerfälle → rot', () => {
  it('[R-H-34] root ist keine Worktree-Wurzel (Unterordner) → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'docs/unter/a.md', 'a\n');
    commitAlles(sb, root, 'Unterordner');
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root: join(root, 'docs'), baum: 'HEAD' });
    expect(r.ok).toBe(false);
  });

  it('[R-H-34] ungültiger Ref bzw. Bereich → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const { scanNames } = await privacyNames();
    expect((await scanNames({ root, baum: 'gibt-es-nicht' })).ok).toBe(false);
    expect((await scanNames({ root, commits: 'gibt-es-nicht..HEAD' })).ok).toBe(false);
  });

  it('[R-H-34] weder baum noch commits bzw. beide zugleich → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    const { scanNames } = await privacyNames();
    const keiner = await scanNames({ root });
    expect(keiner.ok).toBe(false);
    expect(keiner.ursache ?? '').toContain('genau eines von baum oder commits angeben');
    const beide = await scanNames({ root, baum: 'HEAD', commits: 'HEAD~0..HEAD' });
    expect(beide.ok).toBe(false);
    expect(beide.ursache ?? '').toContain('genau eines von baum oder commits angeben');
  });

  it('[R-H-34] info/grafts im Repo → rot', async () => {
    const sb = neueSandbox();
    const root = repo(sb);
    writeText(root, 'a.md', 'a\n');
    const kopf = commitAlles(sb, root, 'A');
    writeText(root, '.git/info/grafts', `${kopf}\n`);
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root, baum: 'HEAD' });
    expect(r.ok).toBe(false);
  });

  it('[R-H-34] flaches Repo (shallow) → rot', async () => {
    const sb = neueSandbox();
    const quelle = repo(sb, 'quelle');
    writeText(quelle, 'a.md', 'a\n');
    commitAlles(sb, quelle, 'A');
    writeText(quelle, 'b.md', 'b\n');
    commitAlles(sb, quelle, 'B');
    const flach = join(sb.base, 'flach');
    const url = `file:///${quelle.replace(/\\/g, '/')}`;
    git(sb, sb.base, 'clone', '-q', '--depth', '1', url, flach);
    const { scanNames } = await privacyNames();
    const r = await scanNames({ root: flach, baum: 'HEAD' });
    expect(r.ok).toBe(false);
  });
});

describe('privacy-names.mjs als CLI', () => {
  it(
    '[R-H-34] CLI --baum: Treffer → Exit 1, Ausgabe mit Pfad und Anzahl, ohne Namen; ohne Treffer → Exit 0',
    () => {
      const sb = neueSandbox();
      const root = repo(sb);
      writeText(root, 'src/components/Sauber.tsx', 'export const a = 1;\n');
      commitAlles(sb, root, 'Sauber');
      const gruen = node(CLI, ['--root', root, '--baum', 'HEAD'], { cwd: root, env: sb.env });
      expect(gruen.status).toBe(0);
      writeText(root, 'src/components/Beispiel.tsx', `// ${FIKTIVER_NAME}\n`);
      commitAlles(sb, root, 'Beispiel');
      const rot = node(CLI, ['--root', root, '--baum', 'HEAD'], { cwd: root, env: sb.env });
      expect(rot.status).toBe(1);
      expect(rot.out).toContain('src/components/Beispiel.tsx');
      // Anzahl 1 in derselben Zeile wie der Pfad (Vertrag §2 scanNames: Pfad und Anzahl, nie der Name).
      const zeile =
        rot.out.split(/\r?\n/).find((l) => l.includes('src/components/Beispiel.tsx')) ?? '';
      expect(zeile.replace('src/components/Beispiel.tsx', '')).toMatch(/(?<![0-9])1(?![0-9])/);
      ohneName(rot.out);
    },
    KURZ,
  );

  it(
    '[R-H-34] CLI --commits <basis>..<ref>: Name im Zwischencommit → Exit 1 mit Commit-Kürzel, ohne Namen',
    () => {
      const sb = neueSandbox();
      const root = repo(sb);
      const basis = git(sb, root, 'rev-parse', 'HEAD');
      writeText(root, 'docs/notiz.md', `${FIKTIVER_NAME}\n`);
      const zwischen = commitAlles(sb, root, 'Zwischen');
      writeText(root, 'docs/notiz.md', 'sauber\n');
      commitAlles(sb, root, 'Sauber');
      const r = node(CLI, ['--root', root, '--commits', `${basis}..HEAD`], {
        cwd: root,
        env: sb.env,
      });
      expect(r.status).toBe(1);
      expect(r.out).toContain(zwischen.slice(0, 7));
      expect(r.out).toContain('docs/notiz.md');
      ohneName(r.out);
    },
    KURZ,
  );

  it(
    '[R-H-34] (6) Sperrliste fehlt → rot mit Ursache (Exit 1)',
    () => {
      const sb = neueSandbox();
      const root = repo(sb);
      const leer = join(sb.base, 'ohne-liste');
      writeText(leer, 'platzhalter.txt', 'x\n');
      const r = node(CLI, ['--root', root, '--baum', 'HEAD'], {
        cwd: root,
        env: { ...sb.env, WAP_REFERENCE_DIR: leer },
      });
      expect(r.status).toBe(1);
      expect(r.out).toContain('Sperrliste');
    },
    KURZ,
  );

  it(
    '[R-H-34] (6) Sperrliste leer (nur Kommentare) → rot mit Ursache (Exit 1)',
    () => {
      const sb = neueSandbox();
      const root = repo(sb);
      const leer = join(sb.base, 'leere-liste');
      writeText(leer, 'datenschutz-sperrliste.txt', '# nur Kommentar\n\n');
      const r = node(CLI, ['--root', root, '--baum', 'HEAD'], {
        cwd: root,
        env: { ...sb.env, WAP_REFERENCE_DIR: leer },
      });
      expect(r.status).toBe(1);
      expect(r.out).toContain('Sperrliste');
    },
    KURZ,
  );
});
