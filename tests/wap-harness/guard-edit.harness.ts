// Hook scripts/wap/guard-edit.mjs (Claude-Code PreToolUse) – R-H-03, R-H-04, R-H-08.
// Vertrag: docs/wap-planer/pakete/H0.md, «Schnittstelle der Harness-Skripte» Punkt 2, P2, P3, P3a, P13, P17.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  addWorktree,
  cleanupSandboxes,
  createSandbox,
  initRepo,
  junction,
  LOCK_PATH,
  lockFiles,
  type RunResult,
  runScript,
  type Sandbox,
  SLOW,
  shortName,
  writeText,
} from './helpers';

afterEach(cleanupSandboxes);

function hookInput(tool: string, path: string, cwd: string): string {
  const toolInput: Record<string, string> =
    tool === 'NotebookEdit'
      ? { notebook_path: path, new_source: 'x' }
      : tool === 'Write'
        ? { file_path: path, content: 'x' }
        : { file_path: path, old_string: 'a', new_string: 'b' };
  return JSON.stringify({
    session_id: 'harness-test',
    hook_event_name: 'PreToolUse',
    cwd,
    tool_name: tool,
    tool_input: toolInput,
  });
}

/** Ruft den Hook aus dem Haupt-Checkout des Temp-Repos auf (cwd = Haupt-Checkout). */
function guard(sb: Sandbox, hookRoot: string, tool: string, path: string): RunResult {
  return runScript(sb, hookRoot, 'guard-edit.mjs', [], {
    cwd: hookRoot,
    input: hookInput(tool, path, hookRoot),
  });
}

function expectBlocked(r: RunResult): void {
  expect(r.status).toBe(2);
  expect(r.stderr).toContain('lock-update');
}

function expectAllowed(r: RunResult): void {
  expect(r.status).toBe(0);
}

function setupLocked(sb: Sandbox): string {
  const root = initRepo(sb, 'haupt');
  lockFiles(root, {
    'tests/a.test.ts': 'export const a = 1;\n',
    'tests/weg/geloescht.test.ts': 'export const g = 1;\n',
  });
  // Gesperrt, aber im Arbeitsbaum gelöscht: bleibt gesperrt.
  rmSync(join(root, 'tests', 'weg'), { recursive: true, force: true });
  writeText(root, 'tests/frei.test.ts', 'export const f = 1;\n');
  return root;
}

describe('guard-edit: Sperre gesperrter Pfade', () => {
  it.each(['Edit', 'Write', 'MultiEdit'])(
    '[R-H-03] blockiert %s auf eine gesperrte Datei mit Exit 2 und Hinweis auf lock-update',
    (tool) => {
      const sb = createSandbox();
      const root = setupLocked(sb);
      expectBlocked(guard(sb, root, tool, join(root, 'tests', 'a.test.ts')));
    },
    60_000,
  );

  it('[R-H-03] blockiert NotebookEdit über notebook_path auf eine gesperrte Datei', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'docs/analyse.ipynb': '{"cells":[]}\n' });
    expectBlocked(guard(sb, root, 'NotebookEdit', join(root, 'docs', 'analyse.ipynb')));
  }, 60_000);

  it.each(['Edit', 'Write'])(
    '[R-H-03] erlaubt %s auf eine nicht gesperrte Datei im selben Worktree',
    (tool) => {
      const sb = createSandbox();
      const root = setupLocked(sb);
      expectAllowed(guard(sb, root, tool, join(root, 'tests', 'frei.test.ts')));
    },
    60_000,
  );

  it('[R-H-03] vergleicht exakte Pfade: ähnlich benannte Dateien bleiben frei', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    expectAllowed(guard(sb, root, 'Write', join(root, 'tests', 'a.test.tsx')));
    expectAllowed(guard(sb, root, 'Write', join(root, 'tests', 'a.test.ts.bak')));
    expectAllowed(guard(sb, root, 'Write', join(root, 'andere', 'tests', 'a.test.ts')));
  }, 60_000);

  it('[R-H-03] normalisiert Backslash und Schrägstrich im absoluten Pfad', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const target = join(root, 'tests', 'a.test.ts');
    expectBlocked(guard(sb, root, 'Edit', target.replace(/\//g, '\\')));
    expectBlocked(guard(sb, root, 'Edit', target.replace(/\\/g, '/')));
    expectBlocked(guard(sb, root, 'Edit', `${root.replace(/\\/g, '/')}\\tests/a.test.ts`));
  }, 60_000);

  it('[R-H-03] normalisiert Gross/Klein im Pfad', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    expectBlocked(guard(sb, root, 'Edit', join(root, 'TESTS', 'A.Test.TS')));
  }, 60_000);

  it('[R-H-03] löst ..-Segmente im Pfad auf', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const viaDotDot = `${root}/src/../tests/./a.test.ts`;
    expectBlocked(guard(sb, root, 'Edit', viaDotDot));
    const outside = `${root}/tests/../../haupt-kopie/tests/a.test.ts`;
    expectAllowed(guard(sb, root, 'Write', outside));
  }, 60_000);

  it('[R-H-03] blockiert eine gesperrte, im Arbeitsbaum fehlende Datei in fehlendem Unterordner', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    expectBlocked(guard(sb, root, 'Write', join(root, 'tests', 'weg', 'geloescht.test.ts')));
  }, 60_000);

  it('[R-H-03] erlaubt eine neue, nicht gesperrte Datei in nicht existierendem Unterordner', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    expectAllowed(guard(sb, root, 'Write', join(root, 'tests', 'neu', 'tief', 'x.test.ts')));
  }, 60_000);

  it('[R-H-03] blockiert bei ungültigem JSON auf stdin (sicherer Zustand)', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const r = runScript(sb, root, 'guard-edit.mjs', [], { cwd: root, input: '{ kein json' });
    expect(r.status).toBe(2);
    const leer = runScript(sb, root, 'guard-edit.mjs', [], { cwd: root, input: '' });
    expect(leer.status).toBe(2);
  }, 60_000);

  it('[R-H-03] blockiert bei ungültigem JSON in test-lock.json auch nicht gelistete Dateien', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    writeText(root, LOCK_PATH, '{ "version": 1, "files": { "tests/a.test.ts": ');
    const r = guard(sb, root, 'Write', join(root, 'tests', 'frei.test.ts'));
    expect(r.status).toBe(2);
  }, 60_000);
});

describe('guard-edit: Worktree der Zieldatei', () => {
  function setupWorktrees(sb: Sandbox): { main: string; wt: string; nested: string } {
    const main = initRepo(sb, 'haupt');
    const wt = addWorktree(sb, main, join(sb.base, 'wt', 'paket'), 'wap/paket');
    const nested = addWorktree(
      sb,
      main,
      join(main, '.claude', 'worktrees', 'verschachtelt'),
      'wap/verschachtelt',
    );
    lockFiles(main, { 'tests/a.test.ts': 'export const a = 1;\n' });
    writeText(main, 'tests/b.test.ts', 'export const b = 1;\n');
    for (const dir of [wt, nested]) {
      writeText(dir, 'tests/a.test.ts', 'export const a = 2;\n');
      lockFiles(dir, { 'tests/b.test.ts': 'export const b = 2;\n' });
    }
    return { main, wt, nested };
  }

  it(
    '[R-H-03] entscheidet im Paket-Worktree gegen dessen test-lock.json, nicht gegen das des Haupt-Checkouts',
    () => {
      const sb = createSandbox();
      const { main, wt } = setupWorktrees(sb);
      // Hook läuft mit cwd = Haupt-Checkout; massgebend ist der Worktree der Zieldatei.
      expectAllowed(guard(sb, main, 'Edit', join(wt, 'tests', 'a.test.ts')));
      expectBlocked(guard(sb, main, 'Edit', join(wt, 'tests', 'b.test.ts')));
      expectBlocked(guard(sb, main, 'Edit', join(main, 'tests', 'a.test.ts')));
      expectAllowed(guard(sb, main, 'Edit', join(main, 'tests', 'b.test.ts')));
    },
    SLOW,
  );

  it(
    '[R-H-03] erkennt einen im Haupt-Checkout verschachtelten Worktree als eigenen Worktree',
    () => {
      const sb = createSandbox();
      const { main, nested } = setupWorktrees(sb);
      expectAllowed(guard(sb, main, 'Edit', join(nested, 'tests', 'a.test.ts')));
      expectBlocked(guard(sb, main, 'Edit', join(nested, 'tests', 'b.test.ts')));
    },
    SLOW,
  );

  it(
    '[R-H-03] ermittelt den Worktree über das nächste existierende Elternverzeichnis',
    () => {
      const sb = createSandbox();
      const { main, wt } = setupWorktrees(sb);
      lockFiles(wt, {
        'tests/b.test.ts': 'export const b = 2;\n',
        'tests/neu/sub/c.test.ts': 'export const c = 1;\n',
      });
      rmSync(join(wt, 'tests', 'neu'), { recursive: true, force: true });
      expectBlocked(guard(sb, main, 'Write', join(wt, 'tests', 'neu', 'sub', 'c.test.ts')));
      expectAllowed(guard(sb, main, 'Write', join(wt, 'tests', 'neu', 'sub', 'd.test.ts')));
    },
    SLOW,
  );

  it(
    '[R-H-03][R-H-08] erlaubt alles in einem Worktree ohne test-lock.json, auch wenn der Haupt-Checkout eines hat',
    () => {
      const sb = createSandbox();
      const { main, wt } = setupWorktrees(sb);
      rmSync(join(wt, ...LOCK_PATH.split('/')));
      expectAllowed(guard(sb, main, 'Edit', join(wt, 'tests', 'a.test.ts')));
      expectAllowed(guard(sb, main, 'Edit', join(wt, 'tests', 'b.test.ts')));
    },
    SLOW,
  );
});

describe('guard-edit: übrige Suite unberührt', () => {
  it('[R-H-08] erlaubt Edit und Write in einem Repo ohne test-lock.json', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'suite', { branch: 'main' });
    writeText(root, 'tests/a.test.ts', 'export const a = 1;\n');
    expectAllowed(guard(sb, root, 'Edit', join(root, 'tests', 'a.test.ts')));
    expectAllowed(guard(sb, root, 'Write', join(root, 'src', 'neu', 'x.ts')));
  }, 60_000);

  it('[R-H-08] erlaubt Schreiben ausserhalb jedes Git-Repos', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    expectAllowed(guard(sb, root, 'Write', join(sb.base, 'notizen', 'frei.txt')));
  }, 60_000);
});

describe('guard-edit: Selbstschutz', () => {
  it('[R-H-04] blockiert test-lock.json selbst, auch wenn es nicht in files steht', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, {});
    const lock = join(root, ...LOCK_PATH.split('/'));
    expectBlocked(guard(sb, root, 'Edit', lock));
    expectBlocked(guard(sb, root, 'Write', lock));
    expectBlocked(guard(sb, root, 'Write', join(root, 'DOCS', 'Wap-Planer', 'Test-Lock.JSON')));
    expectBlocked(guard(sb, root, 'Write', lock.replace(/\\/g, '/')));
  }, 60_000);

  it('[R-H-04] blockiert gesperrte Skripte unter scripts/wap/ und die Hook-Konfiguration', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, {
      'scripts/wap/lock-check.mjs': '// gesperrt\n',
      '.claude/settings.json': '{ "hooks": {} }\n',
    });
    expectBlocked(guard(sb, root, 'Edit', join(root, 'scripts', 'wap', 'lock-check.mjs')));
    expectBlocked(guard(sb, root, 'Write', join(root, '.claude', 'settings.json')));
    // TR-H0-05, P2: lokale Einstellungen könnten Hooks abschalten und sind daher ebenfalls gesperrt.
    expectBlocked(guard(sb, root, 'Write', join(root, '.claude', 'settings.local.json')));
  }, 60_000);

  it('[R-H-04] sperrt bei vorhandener test-lock.json immer scripts/wap/** und die Hook-Konfiguration, auch ohne Eintrag in files', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt');
    lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
    expectBlocked(guard(sb, root, 'Edit', join(root, 'scripts', 'wap', 'guard-edit.mjs')));
    expectBlocked(guard(sb, root, 'Write', join(root, 'scripts', 'wap', 'neu.mjs')));
    expectBlocked(guard(sb, root, 'Write', join(root, 'scripts', 'wap', 'unter', 'tief', 'x.mjs')));
    expectBlocked(guard(sb, root, 'Write', join(root, 'Scripts', 'WAP', 'privacy-allow.txt')));
    expectBlocked(guard(sb, root, 'Write', join(root, '.claude', 'settings.json')));
    expectBlocked(guard(sb, root, 'Write', join(root, '.claude', 'settings.local.json')));
    // Nachbarpfade bleiben frei.
    expectAllowed(guard(sb, root, 'Write', join(root, 'scripts', 'wapx', 'a.mjs')));
    expectAllowed(guard(sb, root, 'Write', join(root, 'scripts', 'andere.mjs')));
    expectAllowed(guard(sb, root, 'Write', join(root, '.claude', 'agents', 'x.md')));
  }, 60_000);

  it('[R-H-04][R-H-08] ohne test-lock.json bleiben scripts/wap/ und .claude/settings*.json frei', () => {
    const sb = createSandbox();
    const root = initRepo(sb, 'suite', { branch: 'main' });
    expectAllowed(guard(sb, root, 'Write', join(root, 'scripts', 'wap', 'neu.mjs')));
    expectAllowed(guard(sb, root, 'Write', join(root, '.claude', 'settings.json')));
    expectAllowed(guard(sb, root, 'Write', join(root, '.claude', 'settings.local.json')));
  }, 60_000);
});

describe('guard-edit: Eingaben und Fehlerfälle (P2, P3)', () => {
  function guardPayload(sb: Sandbox, root: string, payload: unknown, env?: NodeJS.ProcessEnv) {
    return runScript(sb, root, 'guard-edit.mjs', [], {
      cwd: root,
      input: JSON.stringify(payload),
      env,
    });
  }

  it('[R-H-03] löst relative Pfade gegen cwd aus dem Hook-JSON auf', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const andere = initRepo(sb, 'andere');
    // Hook-Prozess läuft in einem anderen Repo; massgebend ist cwd aus dem Hook-JSON.
    const payload = (p: string, cwd: string) => ({
      hook_event_name: 'PreToolUse',
      cwd,
      tool_name: 'Edit',
      tool_input: { file_path: p, old_string: 'a', new_string: 'b' },
    });
    expectBlocked(guardPayload(sb, andere, payload('tests/a.test.ts', root)));
    expectBlocked(guardPayload(sb, andere, payload('src\\..\\tests\\a.test.ts', root)));
    expectBlocked(guardPayload(sb, andere, payload('a.test.ts', join(root, 'tests'))));
    expectAllowed(guardPayload(sb, andere, payload('tests/frei.test.ts', root)));
  }, 60_000);

  it('[R-H-03] blockiert einen relativen Pfad ohne cwd, auch für eine freie Datei', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const r = guardPayload(sb, root, {
      hook_event_name: 'PreToolUse',
      tool_name: 'Write',
      tool_input: { file_path: 'tests/frei.test.ts', content: 'x' },
    });
    expect(r.status).toBe(2);
  }, 60_000);

  it('[R-H-03] blockiert gültiges JSON ohne file_path bzw. notebook_path', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const ohnePfad = guardPayload(sb, root, {
      hook_event_name: 'PreToolUse',
      cwd: root,
      tool_name: 'Edit',
      tool_input: { old_string: 'a', new_string: 'b' },
    });
    expect(ohnePfad.status).toBe(2);
    const ohneInput = guardPayload(sb, root, {
      hook_event_name: 'PreToolUse',
      cwd: root,
      tool_name: 'Write',
    });
    expect(ohneInput.status).toBe(2);
  }, 60_000);

  it('[R-H-03] vergleicht Gross/Klein über den ganzen Pfad, auch im Wurzelteil (Windows)', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const target = join(root, 'tests', 'a.test.ts');
    expectBlocked(guard(sb, root, 'Edit', target.toLowerCase()));
    expectBlocked(guard(sb, root, 'Edit', target.toUpperCase()));
  }, 60_000);

  it('[R-H-03] blockiert, wenn git nicht aufrufbar ist (nur «not a git repository» erlaubt)', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const leer = join(sb.base, 'leerer-pfad');
    rmSync(leer, { recursive: true, force: true });
    writeText(leer, 'platzhalter.txt', '');
    const env: NodeJS.ProcessEnv = {};
    for (const [key, value] of Object.entries(sb.env)) {
      if (key.toUpperCase() !== 'PATH') env[key] = value;
    }
    env.PATH = leer;
    const r = guardPayload(
      sb,
      root,
      {
        hook_event_name: 'PreToolUse',
        cwd: root,
        tool_name: 'Write',
        tool_input: { file_path: join(root, 'tests', 'frei.test.ts'), content: 'x' },
      },
      env,
    );
    expect(r.status).toBe(2);
  }, 60_000);
});

describe('guard-edit: Windows-Pfadformen (P13, CR-H0S-01)', () => {
  function setupLong(sb: Sandbox): string {
    const root = initRepo(sb, 'haupt');
    lockFiles(root, {
      'tests/gesperrt-lange-datei.test.ts': 'export const g = 1;\n',
      'tests/langer-ordnername/innen.test.ts': 'export const i = 1;\n',
    });
    writeText(root, 'tests/frei-lange-datei.test.ts', 'export const f = 1;\n');
    writeText(root, '.claude/settings.json', '{ "hooks": {} }\n');
    return root;
  }

  it('[R-H-03] blockiert den 8.3-Kurznamen einer gesperrten Datei', () => {
    const sb = createSandbox();
    const root = setupLong(sb);
    const kurz = shortName(join(root, 'tests'), 'gesperrt-lange-datei.test.ts');
    expectBlocked(guard(sb, root, 'Write', join(root, 'tests', kurz)));
    expectBlocked(guard(sb, root, 'Edit', join(root, 'tests', kurz.toLowerCase())));
  }, 60_000);

  it('[R-H-03] blockiert eine gesperrte Datei über den 8.3-Kurznamen ihres Ordners', () => {
    const sb = createSandbox();
    const root = setupLong(sb);
    const kurz = shortName(join(root, 'tests'), 'langer-ordnername');
    expectBlocked(guard(sb, root, 'Write', join(root, 'tests', kurz, 'innen.test.ts')));
  }, 60_000);

  it('[R-H-03][R-H-04] löst bei nicht existierendem Ziel den Kurznamen des Elternordners auf (P13, zweiter Zweig)', () => {
    const sb = createSandbox();
    const root = setupLong(sb);
    lockFiles(root, {
      'tests/gesperrt-lange-datei.test.ts': 'export const g = 1;\n',
      'tests/langer-ordnername/innen.test.ts': 'export const i = 1;\n',
      'tests/langer-ordnername/geloescht.test.ts': 'export const d = 1;\n',
    });
    rmSync(join(root, 'tests', 'langer-ordnername', 'geloescht.test.ts'));
    // Positiv: gesperrt, aber nicht existierend, über den Kurznamen des Ordners.
    const ordnerKurz = shortName(join(root, 'tests'), 'langer-ordnername');
    expectBlocked(guard(sb, root, 'Write', join(root, 'tests', ordnerKurz, 'geloescht.test.ts')));
    // Positiv: settings.local.json existiert nicht, gesperrt nach P2, über den Kurznamen von .claude.
    const claudeKurz = shortName(root, '.claude');
    expectBlocked(guard(sb, root, 'Write', join(root, claudeKurz, 'settings.local.json')));
    // Negativ: neue freie Datei unter einem auflösbaren Kurznamen bleibt erlaubt.
    expectAllowed(guard(sb, root, 'Write', join(root, 'tests', ordnerKurz, 'neu.test.ts')));
  }, 60_000);

  it('[R-H-04] blockiert test-lock.json, .claude/settings.json und scripts/wap/ über 8.3-Kurznamen', () => {
    const sb = createSandbox();
    const root = setupLong(sb);
    const lockDir = join(root, 'docs', 'wap-planer');
    expectBlocked(guard(sb, root, 'Write', join(lockDir, shortName(lockDir, 'test-lock.json'))));
    const claudeDir = join(root, '.claude');
    expectBlocked(guard(sb, root, 'Write', join(claudeDir, shortName(claudeDir, 'settings.json'))));
    const claudeKurz = shortName(root, '.claude');
    expectBlocked(guard(sb, root, 'Write', join(root, claudeKurz, 'settings.json')));
    const scriptDir = join(root, 'scripts', 'wap');
    expectBlocked(
      guard(sb, root, 'Edit', join(scriptDir, shortName(scriptDir, 'privacy-scan.mjs'))),
    );
  }, 60_000);

  it('[R-H-03] erlaubt den 8.3-Kurznamen einer freien Datei', () => {
    const sb = createSandbox();
    const root = setupLong(sb);
    const kurz = shortName(join(root, 'tests'), 'frei-lange-datei.test.ts');
    expectAllowed(guard(sb, root, 'Write', join(root, 'tests', kurz)));
  }, 60_000);

  it('[R-H-03] blockiert einen nicht auflösbaren Pfadteil der Form ~<Ziffer>', () => {
    const sb = createSandbox();
    const root = setupLong(sb);
    expectBlocked(guard(sb, root, 'Write', join(root, 'tests', 'NEUERO~1', 'x.test.ts')));
    expectBlocked(guard(sb, root, 'Write', join(root, 'tests', 'NEUDAT~2.TS')));
    // Tilde ohne folgende Ziffer ist kein 8.3-Muster.
    expectAllowed(guard(sb, root, 'Write', join(root, 'tests', 'notiz~alt.test.ts')));
  }, 60_000);

  it.each([
    ['gesperrte Datei', 'tests/gesperrt-lange-datei.test.ts::$DATA'],
    ['test-lock.json', 'docs/wap-planer/test-lock.json::$DATA'],
    ['.claude/settings.json', '.claude/settings.json::$DATA'],
    ['freie Datei mit Datenstrom', 'tests/frei-lange-datei.test.ts:zone'],
    ['neue Datei mit Datenstrom', 'tests/neu.test.ts::$DATA'],
  ])(
    '[R-H-03][R-H-04] blockiert NTFS-Datenströme (%s)',
    (_label, rel) => {
      const sb = createSandbox();
      const root = setupLong(sb);
      expectBlocked(guard(sb, root, 'Write', join(root, ...rel.split('/'))));
    },
    60_000,
  );

  it('[R-H-03] blockiert eine gesperrte Datei über eine Junction von ausserhalb', () => {
    const sb = createSandbox();
    const root = setupLong(sb);
    const link = join(sb.base, 'verknuepfung');
    junction(link, join(root, 'tests'));
    expectBlocked(guard(sb, root, 'Write', join(link, 'gesperrt-lange-datei.test.ts')));
    expectAllowed(guard(sb, root, 'Write', join(link, 'frei-lange-datei.test.ts')));
  }, 60_000);
});

describe('guard-edit: unerwartete Fehler blockieren (P17, CR-H0S-05)', () => {
  it.each([
    ['Zahl', 42],
    ['Objekt', { pfad: 'tests/a.test.ts' }],
    ['Liste', ['tests/a.test.ts']],
    ['null', null],
  ])(
    '[R-H-03] file_path als %s führt zu Exit 2',
    (_label, wert) => {
      const sb = createSandbox();
      const root = setupLocked(sb);
      const r = runScript(sb, root, 'guard-edit.mjs', [], {
        cwd: root,
        input: JSON.stringify({
          hook_event_name: 'PreToolUse',
          cwd: root,
          tool_name: 'Write',
          tool_input: { file_path: wert, content: 'x' },
        }),
      });
      expect(r.status).toBe(2);
    },
    60_000,
  );

  it('[R-H-03] tool_input als Zeichenkette statt Objekt führt zu Exit 2', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    const r = runScript(sb, root, 'guard-edit.mjs', [], {
      cwd: root,
      input: JSON.stringify({ cwd: root, tool_name: 'Edit', tool_input: 'tests/a.test.ts' }),
    });
    expect(r.status).toBe(2);
  }, 60_000);
});

describe('guard-edit: «not a git repository: <pfad>» ist ein Fehler, keine Freigabe (P3a, CR-H0S-41)', () => {
  function gitdirInsLeere(sb: Sandbox, root: string, rel: string): void {
    const fehlt = join(sb.base, 'gibt-es-nicht').split(String.fromCharCode(92)).join('/');
    writeText(root, `${rel}/.git`, `gitdir: ${fehlt}\n`);
  }

  it('[R-H-03][R-H-04] scripts/wap/.git mit gitdir ins Leere, Edit auf scripts/wap/guard-edit.mjs → Exit 2 (P3a, Angriff H5)', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    gitdirInsLeere(sb, root, 'scripts/wap');
    const r = guard(sb, root, 'Edit', join(root, 'scripts', 'wap', 'guard-edit.mjs'));
    expectBlocked(r);
  }, 60_000);

  it('[R-H-03] tests/.git mit gitdir ins Leere, Edit auf gesperrte tests/a.test.ts → Exit 2 (P3a, Angriff H5b)', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    gitdirInsLeere(sb, root, 'tests');
    const r = guard(sb, root, 'Edit', join(root, 'tests', 'a.test.ts'));
    expectBlocked(r);
  }, 60_000);

  it('[R-H-03] tests/.git mit gitdir ins Leere, Write auf eine freie Datei darunter → Exit 2 (P3a: Fehler, nicht «ausserhalb»)', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    gitdirInsLeere(sb, root, 'tests');
    const r = guard(sb, root, 'Write', join(root, 'tests', 'frei.test.ts'));
    expectBlocked(r);
  }, 60_000);

  it('[R-H-03][R-H-08] verwaiste .git-Datei mit gitdir ins Leere ausserhalb jedes Repos, ohne Sperrdatei: Write → Exit 2 (P3a, H4, TR-H0-88)', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    gitdirInsLeere(sb, sb.base, 'frei/y');
    const r = guard(sb, root, 'Write', join(sb.base, 'frei', 'y', 'neu.txt'));
    expect(r.status).toBe(2);
  }, 60_000);

  it('[R-H-03][R-H-08] gleicher Ordner ohne .git ausserhalb jedes Repos: Write → Exit 0 (P3a, Gegenprobe H0)', () => {
    const sb = createSandbox();
    const root = setupLocked(sb);
    writeText(sb.base, 'frei/y/vorhanden.txt', 'x\n');
    const r = guard(sb, root, 'Write', join(sb.base, 'frei', 'y', 'neu.txt'));
    expect(r.status).toBe(0);
  }, 60_000);
});
