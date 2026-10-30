// AE-004 §3: identische Schleusen auf dem exakten Integrationszweig.
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import {
  CHILD_TIMEOUT,
  cleanupSandboxes,
  createSandbox,
  git,
  gitRaw,
  initRepo,
  LOCK_PATH,
  lockFiles,
  runScript,
  writeText,
} from './helpers';

afterEach(cleanupSandboxes);

it('[R-H-39][R-H-08] intakter Commit auf wap-codex passiert den installierten Hook', () => {
  const sb = createSandbox();
  const root = initRepo(sb, 'haupt', { branch: 'wap-codex' });
  lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
  git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH);
  git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
  expect(runScript(sb, root, 'install-hooks.mjs', []).status).toBe(0);
  writeText(root, 'docs/sauber.md', 'Fiktiver Plan\n');
  git(sb, root, 'add', 'docs/sauber.md');
  const result = gitRaw(sb, root, 'commit', '-q', '-m', 'Erlaubt');
  expect(result.status).toBe(0);
  expect(result.out).toContain('WAP-Commit-Prüfung: in Ordnung');
});

it('[R-H-39][R-H-08] geänderte gesperrte Datei verhindert echten Commit auf wap-codex', () => {
  const sb = createSandbox();
  const root = initRepo(sb, 'haupt', { branch: 'wap-codex' });
  lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
  git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH);
  git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
  expect(runScript(sb, root, 'install-hooks.mjs', []).status).toBe(0);
  const before = git(sb, root, 'rev-parse', 'HEAD');
  writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
  git(sb, root, 'add', 'tests/a.test.ts');
  const result = gitRaw(sb, root, 'commit', '-q', '-m', 'Verboten');
  expect(result.status).toBe(1);
  expect(result.out).toContain('geändert');
  expect(git(sb, root, 'rev-parse', 'HEAD')).toBe(before);
});

it('[R-H-39][R-H-08] installierter Merge-Hook blockiert denselben Verstoss auf wap-codex', () => {
  const sb = createSandbox();
  const root = initRepo(sb, 'haupt', { branch: 'wap-codex' });
  lockFiles(root, { 'tests/a.test.ts': 'export const a = 1;\n' });
  git(sb, root, 'add', 'tests/a.test.ts', LOCK_PATH);
  git(sb, root, 'commit', '-q', '-m', 'Sperrstand');
  expect(runScript(sb, root, 'install-hooks.mjs', []).status).toBe(0);
  writeText(root, 'tests/a.test.ts', 'export const a = 2;\n');
  git(sb, root, 'add', 'tests/a.test.ts');
  const hook = join(root, '.git', 'hooks', 'pre-merge-commit');
  const result = spawnSync('sh', [hook], {
    cwd: root,
    env: sb.env,
    encoding: 'utf8',
    timeout: CHILD_TIMEOUT,
  });
  expect(result.status).toBe(1);
  expect(result.stdout + result.stderr).toContain('geändert');
});

it('[R-H-39][R-H-08] fehlende Sperrdatei auf wap-codex wird im Arbeitsbaum abgelehnt', () => {
  const sb = createSandbox();
  const root = initRepo(sb, 'haupt', { branch: 'wap-codex' });
  const result = runScript(sb, root, 'lock-check.mjs', []);
  expect(result.status).toBe(1);
  expect(result.out).toContain('fehlt');
});

it('[R-H-39][R-H-08] fehlende Sperrdatei auf wap-codex wird auch mit --ref abgelehnt', () => {
  const sb = createSandbox();
  const root = initRepo(sb, 'haupt', { branch: 'wap-codex' });
  const result = runScript(sb, root, 'lock-check.mjs', ['--root', root, '--ref', 'wap-codex']);
  expect(result.status).toBe(1);
  expect(result.out).toContain('fehlt');
});

it('[R-H-39][R-H-08] ähnliche Zweignamen erweitern den WAP-Zweigfilter nicht', () => {
  for (const branch of ['wap-codex-alt', 'feature/wap-codex', 'wap-codexx']) {
    const sb = createSandbox();
    const root = initRepo(sb, 'haupt', { branch });
    expect(runScript(sb, root, 'install-hooks.mjs', []).status).toBe(0);
    writeText(root, 'docs/sauber.md', 'Fiktiver Plan\n');
    git(sb, root, 'add', 'docs/sauber.md');
    expect(gitRaw(sb, root, 'commit', '-q', '-m', 'Fremdzweig').status).toBe(0);
    expect(runScript(sb, root, 'lock-check.mjs', []).status).toBe(0);
    expect(runScript(sb, root, 'lock-check.mjs', ['--root', root, '--ref', branch]).status).toBe(0);
  }
});
