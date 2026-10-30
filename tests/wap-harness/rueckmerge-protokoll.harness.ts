// E1-01h, R-H-38: echte synthetische Git-Historien und beide öffentlichen Lock-CLI-Modi.
// Vertrag: docs/wap-planer/plan/vertraege/E1-01h.md; H0 P14/P27/P44/P47 bleiben erhalten.
// Statischer Entwurf: sämtliche Repos/Commits entstehen erst bei einem später freigegebenen Lauf.
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ALTE_PROTOKOLLZEILE,
  addWorktree,
  appendProtokoll,
  cleanupSandboxes,
  FINDINGS_PATH,
  FINDINGS_TEMPLATE,
  git,
  gitRaw,
  initRepo,
  lockFiles,
  protokollZeile,
  type RunResult,
  readLock,
  readText,
  runScript,
  type Sandbox,
  sha256Lf,
  writeLock,
  writeText,
} from './helpers';
import { sandbox } from './helpers-objekte';

const ALT = 'tests/alt.test.ts';
const PAKET = 'tests/paket.test.ts';
const INTEGRATION = 'tests/integration.test.ts';
const WEITER = 'tests/weiter.test.ts';
const PAKET_ZEILE = protokollZeile([PAKET], 'Aufnahme Paket');
const QUELLE_ZEILE = protokollZeile([INTEGRATION], 'Aufnahme Integration');
const WEITER_ZEILE = protokollZeile([WEITER], 'Aufnahme Weiter');
const INHALT = 'export const fiktion = 1;\n';
const MODI = ['arbeitsbaum', 'objekt'] as const;
type Modus = (typeof MODI)[number];

interface Historie {
  sb: Sandbox;
  root: string;
  paket: string;
  quelle: string;
  quellCommit: string;
  paketCommit: string;
  mergeCommit: string;
  paketRef?: string;
  hookVorMerge?: {
    head: string;
    mergeHead: string;
    findings: string;
    files: Record<string, string>;
    fehlversuch: RunResult;
    commit: RunResult;
  };
}

interface Kontrollstand {
  head: string;
  eltern: string[];
  text: string;
  files: Record<string, string>;
  inhalt: Record<string, string>;
}

afterEach(cleanupSandboxes);

function commit(sb: Sandbox, root: string, nachricht: string): string {
  git(sb, root, 'add', '.');
  git(sb, root, 'commit', '-q', '-m', nachricht);
  return git(sb, root, 'rev-parse', 'HEAD');
}

function protokoll(root: string, zeilen: string[]): void {
  writeText(root, FINDINGS_PATH, FINDINGS_TEMPLATE);
  appendProtokoll(root, ...zeilen);
}

function hinzufuegen(root: string, pfad: string, zeile: string): void {
  writeText(root, pfad, INHALT);
  writeLock(root, { ...readLock(root).files, [pfad]: sha256Lf(INHALT) });
  appendProtokoll(root, zeile);
}

function historie(
  quelle = 'wap-codex',
  mitMerge = true,
  doppelteQuelle = false,
  optionen: { hooksVorMerge?: boolean; adrBasis?: boolean } = {},
): Historie {
  const sb = sandbox();
  const root = initRepo(sb, 'integration', { branch: quelle });
  lockFiles(root, { [ALT]: INHALT });
  commit(sb, root, 'synthetischer Ausgangsstand');
  if (optionen.adrBasis && quelle !== 'wap-planer') git(sb, root, 'branch', 'wap-planer', 'HEAD');
  const paket = addWorktree(sb, root, join(sb.base, 'paket'), 'wap/e1-01h-fixture');
  hinzufuegen(paket, PAKET, PAKET_ZEILE);
  const paketCommit = commit(sb, paket, 'synthetische Paketsperre');
  hinzufuegen(root, INTEGRATION, QUELLE_ZEILE);
  if (doppelteQuelle) appendProtokoll(root, QUELLE_ZEILE);
  const quellCommit = commit(sb, root, 'synthetische Integrationssperre');
  if (optionen.hooksVorMerge) {
    const installiert = runScript(sb, root, 'install-hooks.mjs', []);
    expect(installiert.status).toBe(0);
    pruefeBeideShims(sb, root);
    sb.env.GIT_TRACE = '1';
  }
  if (mitMerge) {
    const merge = gitRaw(sb, paket, 'merge', '--no-ff', '--no-commit', quelle);
    expect(merge.status, 'synthetischer Rückmerge erzeugt die erwarteten Konflikte').toBe(1);
    expect(git(sb, paket, 'rev-parse', 'MERGE_HEAD')).toBe(quellCommit);
  }
  // Konfliktauflösung als Vereinigung; die Paketzeile steht vor der neueren Quellzeile.
  writeLock(paket, {
    ...readLock(root).files,
    [PAKET]: sha256Lf(INHALT),
  });
  writeText(paket, INTEGRATION, INHALT);
  protokoll(
    paket,
    doppelteQuelle ? [PAKET_ZEILE, QUELLE_ZEILE, QUELLE_ZEILE] : [PAKET_ZEILE, QUELLE_ZEILE],
  );
  let hookVorMerge: Historie['hookVorMerge'];
  if (optionen.hooksVorMerge) {
    git(sb, paket, 'add', '.');
    const headFindings = gitRaw(sb, paket, 'show', `HEAD:${FINDINGS_PATH}`);
    const indexFindings = gitRaw(sb, paket, 'show', `:${FINDINGS_PATH}`);
    const indexLock = gitRaw(sb, paket, 'show', ':docs/wap-planer/test-lock.json');
    const headLock = gitRaw(sb, paket, 'show', 'HEAD:docs/wap-planer/test-lock.json');
    for (const r of [headFindings, indexFindings, indexLock, headLock]) expect(r.status).toBe(0);
    const headFiles = JSON.parse(headLock.stdout).files as Record<string, string>;
    const files = JSON.parse(indexLock.stdout).files as Record<string, string>;
    expect(indexFindings.stdout.startsWith(headFindings.stdout)).toBe(true);
    expect(indexFindings.stdout.slice(headFindings.stdout.length)).toBe(`${QUELLE_ZEILE}\n`);
    expect(files).toEqual({ ...headFiles, [INTEGRATION]: sha256Lf(INHALT) });
    expect(git(sb, paket, 'rev-parse', 'HEAD')).toBe(paketCommit);
    expect(git(sb, paket, 'rev-parse', 'MERGE_HEAD')).toBe(quellCommit);
    // Derselbe echte MERGE_HEAD legitimiert eine unerlaubte HEAD→Index-Umordnung nicht.
    writeText(
      paket,
      FINDINGS_PATH,
      indexFindings.stdout.replace(
        `${PAKET_ZEILE}\n${QUELLE_ZEILE}`,
        `${QUELLE_ZEILE}\n${PAKET_ZEILE}`,
      ),
    );
    git(sb, paket, 'add', FINDINGS_PATH);
    const fehlversuch = gitRaw(
      sb,
      paket,
      'commit',
      '-q',
      '-m',
      'synthetische unerlaubte Auflösung',
    );
    erwarteRot(fehlversuch);
    expect(fehlversuch.out).toContain('Protokollzeile geändert oder entfernt');
    expect(fehlversuch.out).toContain('pre-commit');
    expect(git(sb, paket, 'rev-parse', 'HEAD')).toBe(paketCommit);
    expect(git(sb, paket, 'rev-parse', 'MERGE_HEAD')).toBe(quellCommit);
    writeText(paket, FINDINGS_PATH, indexFindings.stdout);
    git(sb, paket, 'add', FINDINGS_PATH);
    const commit = gitRaw(sb, paket, 'commit', '-q', '-m', 'synthetischer normaler Rückmerge');
    expect(commit.status, commit.out).toBe(0);
    expect(commit.out).toContain('WAP-Commit-Prüfung: in Ordnung.');
    expect(commit.out).toContain('pre-commit');
    hookVorMerge = {
      head: paketCommit,
      mergeHead: quellCommit,
      findings: indexFindings.stdout,
      files,
      fehlversuch,
      commit,
    };
  } else commit(sb, paket, mitMerge ? 'synthetischer Rückmerge' : 'synthetische Kopie');
  const mergeCommit = git(sb, paket, 'rev-parse', 'HEAD');
  if (mitMerge) {
    expect(git(sb, paket, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ')).toEqual([
      mergeCommit,
      paketCommit,
      quellCommit,
    ]);
  }
  expect(git(sb, root, 'status', '--porcelain')).toBe('');
  expect(git(sb, paket, 'status', '--porcelain')).toBe('');
  return { sb, root, paket, quelle, quellCommit, paketCommit, mergeCommit, hookVorMerge };
}

function pruefeBeideShims(sb: Sandbox, root: string): void {
  const common = git(sb, root, 'rev-parse', '--path-format=absolute', '--git-common-dir');
  for (const name of ['pre-commit', 'pre-merge-commit']) {
    const shim = readText(common, `hooks/${name}`);
    expect(shim).toContain('# wap-planer-harness-shim');
    expect(shim).toContain('exec node "$pruefung"');
  }
}

function check(h: Historie, modus: Modus, basis = h.quellCommit): RunResult {
  const args =
    modus === 'arbeitsbaum'
      ? ['--root', h.paket, '--gegen', basis]
      : ['--root', h.root, '--ref', h.paketRef ?? 'wap/e1-01h-fixture', '--gegen', basis];
  // Insbesondere kein impliziter Repo-Kontext aus cwd oder Pfad des ausgeführten Skripts.
  return runScript(h.sb, h.root, 'lock-check.mjs', args, { cwd: h.sb.base });
}

// Kontrolliert genau den Git-/Blob-Ausgangsstand, der danach weitergeführt oder
// angegriffen wird. Die zurückgegebenen tatsächlichen Daten treiben die Gegenprobe.
function erlaubterRueckmerge(h: Historie, modus: Modus): Kontrollstand {
  const head = git(h.sb, h.paket, 'rev-parse', 'HEAD');
  const blob = gitRaw(h.sb, h.root, 'show', `${head}:${FINDINGS_PATH}`);
  expect(blob.status, 'Kontrollaufbau: tatsächlicher FINDINGS-Blob lesbar').toBe(0);
  const text = modus === 'objekt' ? blob.stdout : readText(h.paket, FINDINGS_PATH);
  const files = readLock(h.paket).files;
  const inhalt = Object.fromEntries(
    Object.keys(files).map((path) => [path, readText(h.paket, path)]),
  );
  for (const [path, hash] of Object.entries(files)) {
    expect(sha256Lf(inhalt[path]), 'Kontrollaufbau: korrekte echte Sperrbytes').toBe(hash);
  }
  expect(git(h.sb, h.root, 'rev-parse', '--path-format=absolute', '--git-common-dir')).toBe(
    git(h.sb, h.paket, 'rev-parse', '--path-format=absolute', '--git-common-dir'),
  );
  const eltern = git(h.sb, h.paket, 'rev-list', '--parents', '-n', '1', head).split(' ').slice(1);
  expect(eltern, 'Kontrollaufbau: tatsächliche zwei Merge-Eltern').toEqual([
    h.paketCommit,
    h.quellCommit,
  ]);
  const r = check(h, modus);
  expect(r.status, 'gültige Rückmerge-Ausnahme für den konkreten Gegenprobenstand').toBe(0);
  expect(r.out).toContain(`${Object.keys(files).length} Dateien in Ordnung`);
  expect(git(h.sb, h.paket, 'rev-parse', 'HEAD')).toBe(head);
  expect(text).toContain(`${PAKET_ZEILE}\n${QUELLE_ZEILE}`);
  return {
    head,
    text,
    files,
    eltern,
    inhalt,
  };
}

function erwarteRot(r: RunResult): void {
  expect(r.status).toBe(1);
  expect(r.out).toContain('Lock-Prüfung');
  expect(r.out).not.toMatch(/SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module/);
}

function objektstand(h: Historie, modus: Modus): void {
  if (modus === 'objekt') commit(h.sb, h.paket, 'synthetischer negativer Objektstand');
}

describe('E1-01h: Rückmerge darf zwei unveränderte Protokollfolgen verschachteln', () => {
  for (const quelle of ['wap-codex', 'wap-planer']) {
    for (const modus of MODI) {
      it(`[R-H-38] ${quelle}, ${modus}: echter Rückmerge mit Paketzeile vor neuer Quellzeile grün`, () => {
        const h = historie(quelle);
        const r = check(h, modus);
        expect(r.status, r.out).toBe(0);
        expect(r.out).toContain('3 Dateien in Ordnung');
        expect(readText(h.paket, FINDINGS_PATH)).toContain(`${PAKET_ZEILE}\n${QUELLE_ZEILE}`);
        expect(git(h.sb, h.paket, 'rev-parse', 'HEAD')).toBe(h.mergeCommit);
      });
    }
  }

  it.each(MODI)(
    '[R-H-38] %s: volle Integrations-Ref und Hash bezeichnen denselben geprüften Rückmerge',
    (modus) => {
      const h = historie();
      expect(check(h, modus, 'refs/heads/wap-codex').status).toBe(0);
      expect(check(h, modus, h.quellCommit).status).toBe(0);
    },
  );

  it.each(MODI)(
    '[R-H-38] %s: neue reguläre Paketsperre nach Rückmerge wird weiterhin durch eine neue Zeile belegt',
    (modus) => {
      const h = historie();
      const stand = erlaubterRueckmerge(h, modus);
      hinzufuegen(h.paket, WEITER, WEITER_ZEILE);
      expect(readLock(h.paket).files).toEqual({ ...stand.files, [WEITER]: sha256Lf(INHALT) });
      objektstand(h, modus);
      const r = check(h, modus);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain('4 Dateien in Ordnung');
    },
  );

  it('[R-H-38] zwei gleiche bestehende Quellzeilen behalten ihre Häufigkeit, eine entfernte Zeile bleibt rot', () => {
    const h = historie('wap-codex', true, true);
    const stand = erlaubterRueckmerge(h, 'objekt');
    expect(stand.text.split(QUELLE_ZEILE).length - 1).toBe(2);
    writeText(
      h.paket,
      FINDINGS_PATH,
      stand.text.replace(`${QUELLE_ZEILE}\n${QUELLE_ZEILE}`, QUELLE_ZEILE),
    );
    commit(h.sb, h.paket, 'synthetische Entfernung eines Vorkommens');
    erwarteRot(check(h, 'objekt'));
  });

  it('[R-H-38] zweiter echter Rückmerge mit weiteren verschachtelten Paket- und Quellzeilen bleibt grün', () => {
    const h = historie();
    const stand = erlaubterRueckmerge(h, 'objekt');
    hinzufuegen(h.paket, WEITER, WEITER_ZEILE);
    const ersterElternteil = commit(h.sb, h.paket, 'synthetische weitere Paketsperre');
    expect(git(h.sb, h.paket, 'rev-parse', `${ersterElternteil}^1`)).toBe(stand.head);
    const neu = 'tests/integration-zwei.test.ts';
    const zeile = protokollZeile([neu], 'Aufnahme Integration zwei');
    hinzufuegen(h.root, neu, zeile);
    const quellCommit = commit(h.sb, h.root, 'synthetische weitere Integrationssperre');
    expect(gitRaw(h.sb, h.paket, 'merge', '--no-ff', '--no-commit', h.quelle).status).toBe(1);
    writeText(h.paket, neu, INHALT);
    writeLock(h.paket, {
      ...readLock(h.root).files,
      [PAKET]: sha256Lf(INHALT),
      [WEITER]: sha256Lf(INHALT),
    });
    protokoll(h.paket, [PAKET_ZEILE, QUELLE_ZEILE, WEITER_ZEILE, zeile]);
    const neuerMerge = commit(h.sb, h.paket, 'synthetischer zweiter Rückmerge');
    expect(git(h.sb, h.paket, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ')).toEqual([
      neuerMerge,
      ersterElternteil,
      quellCommit,
    ]);
    for (const modus of MODI) {
      const r = check(h, modus, quellCommit);
      expect(r.status, r.out).toBe(0);
      expect(r.out).toContain('5 Dateien in Ordnung');
    }
  });
});

describe('E1-01h: Inhalt, Häufigkeit, Pfadpflicht und Lock werden nicht gelockert', () => {
  const angriffe: Array<[string, (h: Historie, stand: Kontrollstand) => void, string]> = [
    [
      'Quellzeile entfernt',
      (h, stand) => writeText(h.paket, FINDINGS_PATH, stand.text.replace(`${QUELLE_ZEILE}\n`, '')),
      'Protokollzeile',
    ],
    [
      'Quellzeile inhaltlich verändert',
      (h, stand) =>
        writeText(
          h.paket,
          FINDINGS_PATH,
          stand.text.replace(QUELLE_ZEILE, QUELLE_ZEILE.replace('Testgrund', 'anderer Grund')),
        ),
      'Protokollzeile',
    ],
    [
      'Paketsperre ohne neue Protokollzeile',
      (h, stand) => writeText(h.paket, FINDINGS_PATH, stand.text.replace(`${PAKET_ZEILE}\n`, '')),
      PAKET,
    ],
    [
      'neue Protokollzeile ohne passende Sperränderung',
      (h, stand) => writeText(h.paket, FINDINGS_PATH, `${stand.text}${WEITER_ZEILE}\n`),
      WEITER,
    ],
    [
      'vorhandene Quellzeile erneut eingeschoben',
      (h, stand) =>
        writeText(
          h.paket,
          FINDINGS_PATH,
          stand.text.replace(QUELLE_ZEILE, `${QUELLE_ZEILE}\n${QUELLE_ZEILE}`),
        ),
      INTEGRATION,
    ],
    [
      'neue Änderung mit nur alter Aufnahmezeile',
      (h, stand) => {
        writeText(h.paket, ALT, 'export const fiktion = 2;\n');
        writeLock(h.paket, {
          ...stand.files,
          [ALT]: sha256Lf('export const fiktion = 2;\n'),
        });
      },
      ALT,
    ],
    [
      'gesperrte Datei per Befehl verändert',
      (h, stand) => writeText(h.paket, PAKET, `${stand.inhalt[PAKET]}// synthetischer Zusatz\n`),
      'geändert',
    ],
    [
      'ungeprüfte neue Tabellenzeile ausserhalb des Protokollblocks',
      (h, stand) => writeText(h.paket, FINDINGS_PATH, `${stand.text}\nText.\n${WEITER_ZEILE}\n`),
      'ausserhalb',
    ],
  ];
  for (const [name, angriff, meldung] of angriffe) {
    for (const modus of MODI) {
      it(`[R-H-38][R-H-05][R-H-06] ${modus}: ${name} bleibt rot`, () => {
        const h = historie();
        const stand = erlaubterRueckmerge(h, modus);
        angriff(h, stand);
        objektstand(h, modus);
        const r = check(h, modus);
        erwarteRot(r);
        expect(r.out).toContain(meldung);
      });
    }
  }

  it.each(MODI)(
    '[R-H-38] %s: bestehende Paketzeile nach dem Rückmerge umgeschrieben bleibt rot',
    (modus) => {
      const h = historie();
      const stand = erlaubterRueckmerge(h, modus);
      writeText(
        h.paket,
        FINDINGS_PATH,
        stand.text.replace(PAKET_ZEILE, PAKET_ZEILE.replace('Testgrund', 'Manipulation')),
      );
      objektstand(h, modus);
      erwarteRot(check(h, modus));
    },
  );

  it.each(MODI)(
    '[R-H-38] %s: alte Quellreihenfolge darf trotz richtiger Pfadmenge nicht vertauscht werden',
    (modus) => {
      const h = historie();
      const stand = erlaubterRueckmerge(h, modus);
      const text = stand.text.replace(
        `${ALTE_PROTOKOLLZEILE}\n${PAKET_ZEILE}\n${QUELLE_ZEILE}`,
        `${QUELLE_ZEILE}\n${PAKET_ZEILE}\n${ALTE_PROTOKOLLZEILE}`,
      );
      writeText(h.paket, FINDINGS_PATH, text);
      objektstand(h, modus);
      erwarteRot(check(h, modus));
    },
  );
});

describe('E1-01h: Provenienz und normaler Commit bleiben streng', () => {
  it.each(['boolesche Behauptung', 'nicht passende Objekt-IDs'])(
    '[R-H-38] %s: roher Kontext gewährt keine Ausnahme, gültiger strikter Vergleich bleibt erlaubt',
    (name) => {
      const h = historie();
      const data = kontextDaten(h, 'objekt');
      const good = kontextVergleich(h, data);
      expect(good.status, 'gültige, frisch an dieselben Blobs gebundene Ausnahme').toBe(0);
      expect(good.result.fehler).toEqual([]);
      const kontext =
        name === 'boolesche Behauptung'
          ? { rueckmerge: true }
          : {
              ...data.context,
              basis: { ...data.context.basis, id: h.paketCommit },
              ziel: { ...data.context.ziel, id: data.context.basis.id },
            };
      // Nur die Provenienzbindung wird getauscht; exakt dieselben echten Blobs
      // benötigen nun strikten Fallback. Ein regulärer Präfix bleibt weiterhin erlaubt.
      const strikt = { ...data, newText: `${data.oldText.trimEnd()}\n${PAKET_ZEILE}\n` };
      expect(kontextVergleich(h, strikt, kontext).status).toBe(0);
      const r = kontextVergleich(h, data, kontext);
      expect(r.status).toBe(1);
      expect(r.result.fehler.join('\n')).toContain('Protokollzeile');
    },
  );

  it('[R-H-38] Ziel nur als Objekt-ID oder losgelöstes HEAD gewährt ohne Paketref keine Ausnahme', () => {
    const h = historie();
    const stand = erlaubterRueckmerge(h, 'objekt');
    const args = ['--root', h.root, '--ref', stand.head, '--gegen', stand.eltern[1]];
    erwarteRot(runScript(h.sb, h.root, 'lock-check.mjs', args));
    git(h.sb, h.root, 'switch', '--detach', '-q', stand.head);
    args[3] = 'HEAD';
    erwarteRot(runScript(h.sb, h.root, 'lock-check.mjs', args));
  });

  it.each(MODI)('[R-H-38] %s: blosse Datenkopie ohne Git-Rückmerge bleibt rot', (modus) => {
    const h = historie();
    const stand = erlaubterRueckmerge(h, modus);
    // Derselbe gültige Resultatbaum wird mit normalem Commit auf einem echten
    // Ein-Eltern-Paketzweig kopiert; kein gefälschter Mergegraph, kein Hook-Bypass.
    const copy = join(h.sb.base, 'kopie');
    git(h.sb, h.root, 'worktree', 'add', '-q', '-b', 'wap/e1-01h-kopie', copy, stand.eltern[0]);
    for (const [path, text] of Object.entries(stand.inhalt)) writeText(copy, path, text);
    writeLock(copy, stand.files);
    writeText(copy, FINDINGS_PATH, stand.text);
    const copiedHead = commit(h.sb, copy, 'synthetische Datenkopie ohne Rückmerge');
    expect(git(h.sb, copy, 'rev-list', '--parents', '-n', '1', copiedHead).split(' ')).toEqual([
      copiedHead,
      stand.eltern[0],
    ]);
    expect(readText(copy, FINDINGS_PATH)).toBe(stand.text);
    const copied = { ...h, paket: copy, paketRef: 'wap/e1-01h-kopie', mergeCommit: copiedHead };
    erwarteRot(check(copied, modus, stand.eltern[1]));
  });

  for (const quelle of ['wap-codex-extra', 'wap-planer-alt', 'wap/anderes-paket']) {
    it(`[R-H-38] ${quelle}: ähnlicher Name oder fremdes Paket gewährt keine Integrationsausnahme`, () => {
      const h = historie();
      const stand = erlaubterRueckmerge(h, 'objekt');
      // Gleiche Eltern/Blobs, aber die tatsächliche exakte Quelle existiert nicht
      // mehr. Der neue Vergleich darf die ähnliche aktuelle Ref nicht akzeptieren.
      git(h.sb, h.root, 'branch', '-m', 'wap-codex', quelle);
      expect(git(h.sb, h.root, 'rev-parse', `refs/heads/${quelle}`)).toBe(stand.eltern[1]);
      erwarteRot(check(h, 'objekt', stand.eltern[1]));
    });
  }

  it('[R-H-38] gleichnamiger Tag aus fremdem Zweig ersetzt die exakte Integrationsquelle nicht', () => {
    const h = historie();
    const stand = erlaubterRueckmerge(h, 'objekt');
    git(h.sb, h.root, 'branch', '-m', 'wap-codex', 'feature/fremd');
    git(h.sb, h.root, 'tag', 'wap-codex', stand.eltern[1]);
    expect(git(h.sb, h.root, 'rev-parse', 'refs/tags/wap-codex')).toBe(stand.eltern[1]);
    erwarteRot(check(h, 'objekt', 'wap-codex'));
  });

  it('[R-H-38] vorhandenes wap-codex mit blossem gemeinsamen Stamm macht den fremden Merge nicht zur Integrationsquelle', () => {
    const h = historie();
    const stand = erlaubterRueckmerge(h, 'objekt');
    git(h.sb, h.root, 'branch', '-m', 'wap-codex', 'feature/fremd');
    const ancestor = git(h.sb, h.root, 'rev-parse', `${stand.eltern[1]}^1`);
    git(h.sb, h.root, 'branch', 'wap-codex', ancestor);
    expect(git(h.sb, h.root, 'merge-base', 'wap-codex', stand.head)).toBe(ancestor);
    expect(ancestor).not.toBe(stand.eltern[1]);
    erwarteRot(check(h, 'objekt', stand.eltern[1]));
  });

  it('[R-H-38][R-H-05][R-H-06] normaler installierter Commit-Hook weist Umordnung nach gültigem Rückmerge ab', () => {
    const h = historie();
    const stand = erlaubterRueckmerge(h, 'objekt');
    expect(runScript(h.sb, h.root, 'install-hooks.mjs', []).status).toBe(0);
    // Das Protokoll bleibt mengenmässig identisch; der HEAD→Index-Vergleich muss dennoch rot sein.
    writeText(
      h.paket,
      FINDINGS_PATH,
      stand.text.replace(`${PAKET_ZEILE}\n${QUELLE_ZEILE}`, `${QUELLE_ZEILE}\n${PAKET_ZEILE}`),
    );
    git(h.sb, h.paket, 'add', FINDINGS_PATH);
    const r = gitRaw(h.sb, h.paket, 'commit', '-q', '-m', 'synthetische Umordnung');
    erwarteRot(r);
    expect(r.out).toContain('Protokollzeile geändert oder entfernt');
    expect(git(h.sb, h.paket, 'rev-parse', 'HEAD')).toBe(stand.head);
  });

  it('[R-H-38][R-H-06] lock-update hängt auch nach Rückmerge ausschliesslich am Ende an', () => {
    const h = historie();
    const stand = erlaubterRueckmerge(h, 'arbeitsbaum');
    writeText(h.paket, WEITER, INHALT);
    const vorher = stand.text;
    const r = runScript(
      h.sb,
      h.root,
      'lock-update.mjs',
      ['--grund', 'synthetische neue Sperre', '--add', WEITER],
      { cwd: h.paket },
    );
    expect(r.status, r.out).toBe(0);
    expect(readText(h.paket, FINDINGS_PATH).startsWith(vorher)).toBe(true);
    expect(readLock(h.paket).files[WEITER]).toBe(sha256Lf(INHALT));
    expect(check(h, 'arbeitsbaum').status).toBe(0);
  });
});

// Nachtrag: gültiger Kontrollvergleich und Gegenprobe teilen dieselben echten Quellen.
function kontextDaten(h: Historie, modus: Modus) {
  const object = modus === 'objekt';
  const read = (id: string, path: string) => {
    const r = gitRaw(h.sb, h.root, 'show', `${id}:${path}`);
    expect(r.status).toBe(0);
    return r.stdout;
  };
  return {
    oldLock: JSON.parse(read(h.quellCommit, 'docs/wap-planer/test-lock.json')).files as Record<
      string,
      string
    >,
    newLock: object
      ? (JSON.parse(read(h.mergeCommit, 'docs/wap-planer/test-lock.json')).files as Record<
          string,
          string
        >)
      : readLock(h.paket).files,
    oldText: read(h.quellCommit, FINDINGS_PATH),
    newText: object ? read(h.mergeCommit, FINDINGS_PATH) : readText(h.paket, FINDINGS_PATH),
    context: {
      root: object ? h.root : h.paket,
      modus,
      basis: { id: h.quellCommit, voll: 'refs/heads/wap-codex' },
      ziel: { id: h.mergeCommit, voll: 'refs/heads/wap/e1-01h-fixture' },
    },
  };
}

function kontextVergleich(
  h: Historie,
  data: ReturnType<typeof kontextDaten>,
  context: unknown = data.context,
) {
  writeText(
    h.root,
    'scripts/wap/bindungs-probe.mjs',
    [
      "import { protokollPruefung } from './lib/common.mjs';",
      'const args = process.argv.slice(2).map(JSON.parse);',
      'const r = protokollPruefung(...args);',
      'process.stdout.write(JSON.stringify(r));',
      'process.exitCode = r.fehler.length === 0 ? 0 : 1;',
    ].join('\n'),
  );
  const r = runScript(
    h.sb,
    h.root,
    'bindungs-probe.mjs',
    [data.oldLock, data.newLock, data.oldText, data.newText, context].map((x) => JSON.stringify(x)),
    { cwd: h.sb.base },
  );
  expect(r.out).not.toMatch(/SyntaxError|ERR_MODULE_NOT_FOUND|Cannot find module/);
  const result = JSON.parse(r.stdout) as { fehler: string[]; hinweise: string[] };
  return { ...r, result };
}

const bindungsAngriffe: Array<[string, (h: Historie, d: ReturnType<typeof kontextDaten>) => void]> =
  [
    [
      'fremde Wurzel ohne die angegebenen Objekte',
      (h, d) => {
        d.context.root = h.sb.base;
      },
    ],
    [
      'Basis-ID passt nicht zur exakten Basisref',
      (h, d) => {
        d.context.basis.id = h.paketCommit;
      },
    ],
    [
      'Ziel-ID passt nicht zur exakten Paketref',
      (h, d) => {
        d.context.ziel.id = h.quellCommit;
      },
    ],
    [
      'Ziel als Integrationsref statt Paketref',
      (_h, d) => {
        d.context.ziel.voll = 'refs/heads/wap-codex';
      },
    ],
    [
      'gleiche erfundene Althashes in beiden Datenargumenten',
      (_h, d) => {
        d.oldLock = { ...d.oldLock, [ALT]: sha256Lf('export const fiktion = 9;\n') };
        d.newLock = { ...d.newLock, [ALT]: d.oldLock[ALT] };
      },
    ],
    [
      'gleicher erfundener Quellzeilentext in beiden Datenargumenten',
      (_h, d) => {
        d.oldText = d.oldText.replace(
          QUELLE_ZEILE,
          QUELLE_ZEILE.replace('Testgrund', 'Erfundener Grund'),
        );
        d.newText = d.newText.replace(
          QUELLE_ZEILE,
          QUELLE_ZEILE.replace('Testgrund', 'Erfundener Grund'),
        );
      },
    ],
    [
      'frei erfundener neuer Lock und dazu passende zusätzliche Zeile',
      (_h, d) => {
        d.newLock = { ...d.newLock, [WEITER]: sha256Lf(INHALT) };
        d.newText = `${d.newText}${WEITER_ZEILE}\n`;
      },
    ],
  ];

for (const modus of MODI) {
  for (const [name, attack] of bindungsAngriffe) {
    it(`[R-H-38] Bindung ${modus}: ${name} gewährt keine Ausnahme`, () => {
      const h = historie();
      const data = kontextDaten(h, modus);
      const good = kontextVergleich(h, data);
      expect(good.status, good.out).toBe(0);
      expect(good.result.fehler).toEqual([]);
      attack(h, data);
      const bad = kontextVergleich(h, data);
      expect(bad.status).toBe(1);
      expect(bad.result.fehler.join('\n')).toContain('Protokollzeile');
      expect(git(h.sb, h.paket, 'rev-parse', 'HEAD')).toBe(h.mergeCommit);
    });
  }
}

for (const modus of MODI) {
  for (const kind of ['entfernt', 'verdoppelt', 'umgeordnet'] as const) {
    it(`[R-H-38] Pakethistorie ${modus}: zwei bestehende Paketzeilen werden nicht ${kind}`, () => {
      const h = historie();
      hinzufuegen(h.paket, WEITER, WEITER_ZEILE);
      commit(h.sb, h.paket, 'synthetische weitere unveränderte Paketzeile');
      const good = check(h, modus);
      expect(good.status, good.out).toBe(0);
      const rows =
        kind === 'entfernt'
          ? [PAKET_ZEILE, QUELLE_ZEILE]
          : kind === 'verdoppelt'
            ? [PAKET_ZEILE, QUELLE_ZEILE, WEITER_ZEILE, WEITER_ZEILE]
            : [WEITER_ZEILE, QUELLE_ZEILE, PAKET_ZEILE];
      protokoll(h.paket, rows);
      objektstand(h, modus);
      erwarteRot(check(h, modus));
    });
  }
}

it('[R-H-38] Objektbeleg liest tatsächlichen Commit trotz repariertem Arbeitsbaum', () => {
  const h = historie();
  const good = check(h, 'objekt');
  expect(good.status, good.out).toBe(0);
  const saved = readText(h.paket, FINDINGS_PATH);
  protokoll(h.paket, [QUELLE_ZEILE, PAKET_ZEILE]);
  commit(h.sb, h.paket, 'synthetische umgeordnete Objektzeile');
  writeText(h.paket, FINDINGS_PATH, saved);
  erwarteRot(check(h, 'objekt'));
});

it('[R-H-38] gültiger Objektbeleg heilt keine umgeordnete Arbeitsbaumzeile', () => {
  const h = historie();
  const good = check(h, 'objekt');
  expect(good.status, good.out).toBe(0);
  protokoll(h.paket, [QUELLE_ZEILE, PAKET_ZEILE]);
  expect(check(h, 'objekt').status).toBe(0);
  erwarteRot(check(h, 'arbeitsbaum'));
});

// PROV-01: unveränderte installierte Shims prüfen den echten normalen Mergepfad.
it.each(MODI)(
  '[R-H-38] Hookablauf %s: normaler Konflikt-Rückmerge mit beiden zuvor installierten Shims und strikt geprüftem Zielpräfix',
  (modus) => {
    const h = historie('wap-codex', true, false, { hooksVorMerge: true });
    const index = h.hookVorMerge;
    expect(index).toBeDefined();
    const stand = erlaubterRueckmerge(h, modus);
    expect(stand.text).toBe(index?.findings);
    expect(stand.files).toEqual(index?.files);
    expect(stand.eltern).toEqual([index?.head, index?.mergeHead]);
    expect(index?.fehlversuch.status).toBe(1);
    expect(index?.commit.status).toBe(0);
    pruefeBeideShims(h.sb, h.root);
  },
);

it.each(MODI)(
  '[R-H-38] Hookablauf %s: konfliktfreier automatischer zweiter Rückmerge läuft über installierten pre-merge-commit',
  (modus) => {
    const h = historie('wap-codex', true, false, { hooksVorMerge: true });
    const stand = erlaubterRueckmerge(h, modus);
    hinzufuegen(h.paket, WEITER, WEITER_ZEILE);
    const paketHead = commit(h.sb, h.paket, 'synthetischer normaler Paketappend');
    expect(git(h.sb, h.paket, 'rev-parse', `${paketHead}^1`)).toBe(stand.head);
    writeText(h.root, 'docs/wap-planer/PROGRESS.md', '# Synthetischer Fortschritt\n');
    const quelleHead = commit(h.sb, h.root, 'synthetischer reiner Fortschritt');
    expect(
      gitRaw(h.sb, h.root, 'merge-base', '--is-ancestor', stand.eltern[1], quelleHead).status,
    ).toBe(0);
    pruefeBeideShims(h.sb, h.root);

    // Privater Preview-Worktree hat denselben echten Ziel-HEAD. Vor dem automatischen
    // Commit werden tatsächlicher Index/MERGE_HEAD/Präfix geprüft; der spätere
    // automatische Commit muss exakt diesen Baum und beide echten Eltern verwenden.
    const preview = join(h.sb.base, 'automatischer-index');
    git(h.sb, h.root, 'worktree', 'add', '-q', '-b', 'wap/e1-01h-preview', preview, paketHead);
    expect(
      gitRaw(h.sb, preview, 'merge', '--no-ff', '--no-commit', 'refs/heads/wap-codex').status,
    ).toBe(0);
    expect(git(h.sb, preview, 'rev-parse', 'HEAD')).toBe(paketHead);
    expect(git(h.sb, preview, 'rev-parse', 'MERGE_HEAD')).toBe(quelleHead);
    const oldFindings = gitRaw(h.sb, preview, 'show', `HEAD:${FINDINGS_PATH}`);
    const indexFindings = gitRaw(h.sb, preview, 'show', `:${FINDINGS_PATH}`);
    const oldLock = gitRaw(h.sb, preview, 'show', 'HEAD:docs/wap-planer/test-lock.json');
    const indexLock = gitRaw(h.sb, preview, 'show', ':docs/wap-planer/test-lock.json');
    for (const r of [oldFindings, indexFindings, oldLock, indexLock]) expect(r.status).toBe(0);
    expect(indexFindings.stdout.startsWith(oldFindings.stdout)).toBe(true);
    expect(indexFindings.stdout).toBe(oldFindings.stdout);
    expect(JSON.parse(indexLock.stdout).files).toEqual(JSON.parse(oldLock.stdout).files);
    const previewTree = git(h.sb, preview, 'write-tree');
    const automatisch = gitRaw(
      h.sb,
      h.paket,
      'merge',
      '--no-ff',
      '-m',
      'synthetischer automatischer Rückmerge',
      'refs/heads/wap-codex',
    );
    expect(automatisch.status, automatisch.out).toBe(0);
    expect(automatisch.out).toContain('pre-merge-commit');
    expect(automatisch.out).toContain('WAP-Commit-Prüfung: in Ordnung.');
    expect(git(h.sb, h.paket, 'rev-parse', 'HEAD^{tree}')).toBe(previewTree);
    const mergeHead = git(h.sb, h.paket, 'rev-parse', 'HEAD');
    expect(git(h.sb, h.paket, 'rev-list', '--parents', '-n', '1', 'HEAD').split(' ')).toEqual([
      mergeHead,
      paketHead,
      quelleHead,
    ]);
    expect(readText(h.paket, FINDINGS_PATH)).toBe(indexFindings.stdout);
    const r = check(h, modus, stand.eltern[1]);
    expect(r.status, r.out).toBe(0);
    expect(r.out).toContain('4 Dateien in Ordnung');
  },
);

// PROV-02: tatsächliche ADR-010-Basis und gerichtete historische Quellenrelation.
for (const quelle of ['wap-codex', 'wap-planer']) {
  for (const modus of MODI) {
    it(`[R-H-38] ADR-010 ${quelle}, ${modus}: echte Hash-Mergebasis, Fortschrittscommit und normaler Paketappend bleiben gültig`, () => {
      const h = historie(quelle, true, false, { hooksVorMerge: true, adrBasis: true });
      const stand = erlaubterRueckmerge(h, modus);
      expect(git(h.sb, h.paket, 'rev-parse', 'HEAD')).toBe(stand.head);
      const basis = git(h.sb, h.paket, 'merge-base', 'HEAD', 'wap-planer');
      expect(basis).toMatch(/^[0-9a-f]{40,64}$/);
      expect(gitRaw(h.sb, h.root, 'merge-base', '--is-ancestor', basis, stand.head).status).toBe(0);
      const vor = check(h, modus, basis);
      expect(vor.status, vor.out).toBe(0);

      const oldLockBlob = git(
        h.sb,
        h.root,
        'rev-parse',
        `${stand.eltern[1]}:docs/wap-planer/test-lock.json`,
      );
      const oldFindingsBlob = git(h.sb, h.root, 'rev-parse', `${stand.eltern[1]}:${FINDINGS_PATH}`);
      writeText(h.root, 'docs/wap-planer/PROGRESS.md', '# Synthetische Fortschrittsnachführung\n');
      const aktuell = commit(h.sb, h.root, 'synthetischer reiner Integrationsfortschritt');
      expect(git(h.sb, h.root, 'diff', '--name-only', stand.eltern[1], aktuell)).toBe(
        'docs/wap-planer/PROGRESS.md',
      );
      expect(git(h.sb, h.root, 'rev-parse', `refs/heads/${quelle}`)).toBe(aktuell);
      expect(aktuell).not.toBe(stand.eltern[1]);
      expect(
        gitRaw(h.sb, h.root, 'merge-base', '--is-ancestor', stand.eltern[1], aktuell).status,
      ).toBe(0);
      expect(
        gitRaw(h.sb, h.root, 'merge-base', '--is-ancestor', aktuell, stand.eltern[1]).status,
      ).toBe(1);
      expect(git(h.sb, h.root, 'rev-parse', `${aktuell}:docs/wap-planer/test-lock.json`)).toBe(
        oldLockBlob,
      );
      expect(git(h.sb, h.root, 'rev-parse', `${aktuell}:${FINDINGS_PATH}`)).toBe(oldFindingsBlob);
      const danach = check(h, modus, basis);
      expect(danach.status, danach.out).toBe(0);
      expect(check(h, modus, `refs/heads/${quelle}`).status).toBe(0);
      hinzufuegen(h.paket, WEITER, WEITER_ZEILE);
      expect(readLock(h.paket).files).toEqual({ ...stand.files, [WEITER]: sha256Lf(INHALT) });
      const paketHead = commit(
        h.sb,
        h.paket,
        'synthetischer regulärer Paketappend nach Integrationsfortschritt',
      );
      expect(git(h.sb, h.paket, 'rev-parse', `${paketHead}^1`)).toBe(stand.head);
      expect(git(h.sb, h.paket, 'merge-base', 'HEAD', 'wap-planer')).toBe(basis);
      const append = check(h, modus, basis);
      expect(append.status, append.out).toBe(0);
      expect(append.out).toContain('4 Dateien in Ordnung');
    });
  }
}

it.each(MODI)(
  '[R-H-38] Ref-Frische %s: historischer Quellenelternteil ist erlaubt, veraltete volle Basisref-ID bleibt strikt',
  (modus) => {
    const h = historie('wap-codex', true, false, { adrBasis: true });
    const data = kontextDaten(h, modus);
    const initial = kontextVergleich(h, data);
    expect(initial.status, initial.out).toBe(0);
    writeText(h.root, 'docs/wap-planer/PROGRESS.md', '# Synthetischer weiterer Fortschritt\n');
    const tip = commit(h.sb, h.root, 'synthetischer neuer Integrationsref');
    expect(
      gitRaw(h.sb, h.root, 'merge-base', '--is-ancestor', data.context.basis.id, tip).status,
    ).toBe(0);
    const frisch = {
      ...data,
      context: { ...data.context, basis: { ...data.context.basis, id: tip } },
    };
    const erlaubt = kontextVergleich(h, frisch);
    expect(erlaubt.status, erlaubt.out).toBe(0);
    expect(erlaubt.result.fehler).toEqual([]);
    const stale = kontextVergleich(h, data);
    expect(stale.status).toBe(1);
    expect(stale.result.fehler.join('\n')).toContain('Protokollzeile');
  },
);
