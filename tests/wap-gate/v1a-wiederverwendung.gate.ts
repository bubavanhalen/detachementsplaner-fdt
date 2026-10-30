// Paket F-TOOLS Runde 2 (Koordinator 20.10.2026, SA-2-03): R-H-36 wiederhergestellt. Unverändert übernommen aus
// dem in E1-01i geprüften und eingefrorenen Test (37ad236; Umsetzung 387ac7d, mit dem roten Merge zurückgenommen).
// E1-01i, R-H-36: bestehender V1a-Aufrufpfad, echte fiktive Gitstände, synthetischer Prozessadapter.
// Kein nativer Full-Beleg. Geprüft werden Auswahl, grüner Commitbeleg, Berichtsweitergabe und Queue.
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const adapter = vi.hoisted(() => ({
  calls: [] as string[],
  gitError: false,
  childRed: false,
  signal: false,
  startError: false,
  unhandled: false,
  laterRed: false,
  writingReport: false,
  writeFailure: null as null | 'queue' | 'bericht',
  duringSelf: null as null | ((root: string) => void),
}));
vi.mock('node:fs', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const guard =
    (name: 'writeFileSync' | 'appendFileSync' | 'renameSync', targetIndex = 0) =>
    (...args: unknown[]) => {
      const path = String(args[targetIndex]).replace(/\\/g, '/');
      const blocked =
        adapter.writeFailure === 'queue'
          ? path.endsWith('/docs/wap-planer/claude-review-warteschlange.md')
          : adapter.writeFailure === 'bericht' &&
            path.endsWith('/test-results/wap/vitest-selbsttest.json');
      if (blocked && !adapter.writingReport) throw new Error('Fiktiver Schreibfehler');
      return (actual[name] as (...args: unknown[]) => unknown)(...args);
    };
  return {
    ...actual,
    writeFileSync: guard('writeFileSync'),
    appendFileSync: guard('appendFileSync'),
    renameSync: guard('renameSync', 1),
  };
});
vi.mock('../../scripts/wap-gate/lib/prozess.mjs', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  werkzeug: () => process.execPath,
  starteNode: async (_file: string, args: string[], opts: { cwd: string }) => {
    const config = args[args.indexOf('-c') + 1] ?? '';
    adapter.calls.push(config);
    const self = config.includes('selbsttest');
    if (self) adapter.duringSelf?.(opts.cwd);
    const output = args.find((x) => x.startsWith('--outputFile.json='))?.slice(18);
    if (output) {
      const path = join(opts.cwd, output);
      mkdirSync(dirname(path), { recursive: true });
      adapter.writingReport = true;
      try {
        writeFileSync(path, adapter.childRed && self ? JSON.stringify(report(true)) : rawReport());
      } finally {
        adapter.writingReport = false;
      }
    }
    return {
      status: adapter.childRed && self ? 1 : 0,
      signal: self && adapter.signal ? 'SIGTERM' : null,
      stdout: '',
      stderr: self && adapter.unhandled ? 'Unhandled Errors during test run' : '',
      fehler: self && adapter.startError ? 'Fiktiver Startfehler' : null,
      ms: 1,
    };
  },
}));
vi.mock('../../scripts/wap-gate/lib/repo.mjs', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const git = actual.git as (cwd: string, args: string[]) => unknown;
  return {
    ...actual,
    git: (cwd: string, args: string[]) =>
      adapter.gitError && args[0] === 'diff'
        ? { status: 128, stdout: '', stderr: 'Fiktiver Gitfehler', raw: Buffer.alloc(0) }
        : git(cwd, args),
  };
});
vi.mock('../../scripts/wap-gate/trace.mjs', async (original) => {
  const actual = await original<Record<string, unknown>>();
  return {
    ...actual,
    trace: async (...args: unknown[]) =>
      adapter.laterRed
        ? { id: 'V9-trace', ok: false, ms: 0, ursache: 'Fiktiver späterer Full-Schritt rot' }
        : (actual.trace as (...args: unknown[]) => unknown)(...args),
  };
});

type Step = { id: string; ok: boolean; details?: unknown };
type Context = {
  root: string;
  zweig: string;
  paket: null;
  preCommit: false;
  sperre: undefined;
  nur: string[];
  melde(step: Step): void;
  etappenAbschluss?: number;
};
type Gate = { schleusenSchritte(mode: 'full', context: Context): Promise<void> };
const roots: string[] = [];
const RECEIPT = '.git/wap-gate/v1a-selbsttest-gruen.json';
const QUEUE = 'docs/wap-planer/claude-review-warteschlange.md';
const CONFIGS = [
  'vitest.wap-gate.config.ts',
  'vitest.wap-harness.config.ts',
  'vitest.wap-selbsttest.config.ts',
];
const CRITICAL = [
  'scripts/wap-gate/fiktiv.mjs',
  'scripts/wap/fiktiv.mjs',
  'tests/wap-gate/fiktiv.gate.ts',
  'tests/wap-harness/fiktiv.harness.ts',
  'vitest.config.ts',
  'vitest.wap-extra.config.mts',
  'playwright.config.ts',
  'playwright.wap-extra.config.cts',
  'package.json',
];

function report(red = false) {
  return {
    success: !red,
    numTotalTestSuites: 1,
    numPassedTestSuites: red ? 0 : 1,
    numFailedTestSuites: red ? 1 : 0,
    numPendingTestSuites: 0,
    numTotalTests: 1,
    numPassedTests: red ? 0 : 1,
    numFailedTests: red ? 1 : 0,
    numPendingTests: 0,
    testResults: [
      {
        name: 'fiktiv.selbsttest.ts',
        status: red ? 'failed' : 'passed',
        message: '',
        assertionResults: [
          {
            ancestorTitles: [],
            title: '[R-H-11] Fiktive Prozessantwort',
            fullName: '[R-H-11] Fiktive Prozessantwort',
            status: red ? 'failed' : 'passed',
            failureMessages: red ? ['AssertionError: fiktiv'] : [],
          },
        ],
      },
    ],
  };
}
function put(root: string, path: string, text: string) {
  const dest = join(root, path);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, text);
}
function git(root: string, ...args: string[]) {
  const run = spawnSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
  expect(run.status, `Fiktiver Git-Aufbau: ${args[0]} ${run.stderr}`).toBe(0);
  return run.stdout.trim();
}
function snapshot(root: string) {
  git(root, 'add', '--all');
  git(root, 'commit', '-qm', 'Fiktiver Prüfstand');
  return git(root, 'rev-parse', 'HEAD');
}
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'wap-e101i-test-'));
  roots.push(root);
  git(root, 'init', '-q');
  git(root, 'config', 'user.name', 'Fiktivtest');
  git(root, 'config', 'user.email', ['fiktiv', 'example.invalid'].join('@'));
  git(root, 'config', 'commit.gpgsign', 'false');
  git(root, 'checkout', '-qb', 'wap-planer');
  for (const path of [...CONFIGS, ...CRITICAL]) put(root, path, '// Fiktive Testdatei\n');
  put(root, QUEUE, '# Claude-Review-Warteschlange (fiktiv)\n');
  put(root, 'src/model/wap/fiktiv.ts', 'export const fiktiv = 1;\n');
  put(root, 'docs/fiktiv.md', 'Fiktive Dokumentation\n');
  const commit = snapshot(root);
  git(root, 'checkout', '-qb', 'wap/e1-01i');
  return { root, commit };
}
function rawReport() {
  return `${JSON.stringify(report(), null, 2)}\r\n`;
}
function reportSha(raw: string) {
  return createHash('sha256').update(raw).digest('hex');
}
function seed(root: string, commit: string, values: Record<string, unknown> = {}) {
  const bericht = Object.hasOwn(values, 'bericht') ? values.bericht : report();
  const raw =
    typeof values.berichtRaw === 'string'
      ? values.berichtRaw
      : Object.hasOwn(values, 'bericht')
        ? JSON.stringify(bericht)
        : rawReport();
  put(
    root,
    RECEIPT,
    JSON.stringify({
      version: 1,
      art: 'V1a-selbsttest',
      commit,
      exit: 0,
      bericht,
      berichtRaw: raw,
      berichtSha256: reportSha(raw),
      ...values,
    }),
  );
}
async function run(root: string, gateB = false, stepsToRun = ['V1a']) {
  const steps: Step[] = [];
  const gate = (await import('../../scripts/wap-gate/gate.mjs' as string)) as unknown as Gate;
  const context: Context = {
    root,
    zweig: 'wap/e1-01i',
    paket: null,
    preCommit: false,
    sperre: undefined,
    nur: stepsToRun,
    melde: (s) => steps.push(s),
  };
  if (gateB) context.etappenAbschluss = 1;
  await gate.schleusenSchritte('full', context);
  return steps;
}
function nativeCount() {
  return adapter.calls.filter((x) => x === CONFIGS[2]).length;
}
function assertFreshReceipt(root: string, commit: string) {
  expect(
    existsSync(join(root, RECEIPT)),
    'Grüner echter Schritt braucht seinen gebundenen Commitbeleg',
  ).toBe(true);
  const raw = readFileSync(join(root, RECEIPT), 'utf8');
  expect(
    () => JSON.parse(raw),
    'Echter grüner Schritt ersetzt beschädigten Beleg durch gültiges JSON',
  ).not.toThrow();
  const receipt = JSON.parse(raw) as Record<string, unknown>;
  expect(receipt.version).toBe(1);
  expect(receipt.commit).toBe(commit);
  expect(receipt.exit).toBe(0);
  expect(receipt.art).toBe('V1a-selbsttest');
  expect(receipt.bericht).toEqual(report());
  expect(receipt.berichtRaw).toBe(rawReport());
  expect(receipt.berichtSha256).toBe(reportSha(rawReport()));
}
beforeEach(() => {
  adapter.calls.length = 0;
  adapter.gitError = false;
  adapter.childRed = false;
  adapter.signal = false;
  adapter.startError = false;
  adapter.unhandled = false;
  adapter.duringSelf = null;
});
beforeEach(() => {
  adapter.laterRed = false;
  adapter.writeFailure = null;
  adapter.writingReport = false;
});
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('V1a-selbsttest: freigegebene Git-Diff-Wiederverwendung', () => {
  it('[R-H-36] Dokumentänderung übernimmt Ergebnis, meldet Commit, führt Gate/Harness weiter aus und hängt Queue an', async () => {
    const { root, commit } = setup();
    seed(root, commit);
    const queueBefore = readFileSync(join(root, QUEUE), 'utf8');
    put(root, 'docs/fiktiv.md', 'Nur Dokument geändert\n');
    snapshot(root);
    const steps = await run(root);
    expect(nativeCount(), 'V1a-selbsttest darf hier nicht erneut gestartet werden').toBe(0);
    expect(adapter.calls).toEqual([CONFIGS[0], CONFIGS[1]]);
    expect(steps.find((s) => s.id === 'V1a-selbsttest')?.ok).toBe(true);
    expect(steps.find((s) => s.id === 'V1a-selbsttest')?.details).toMatchObject({
      status: `WIEDERVERWENDET ${commit}`,
    });
    const queue = readFileSync(join(root, QUEUE), 'utf8');
    expect(queue.startsWith(queueBefore)).toBe(true);
    expect(queue).toContain(`WIEDERVERWENDET ${commit}`);
    expect(queue.split(`WIEDERVERWENDET ${commit}`).length - 1).toBe(1);
    expect(
      JSON.parse(readFileSync(join(root, 'test-results/wap/vitest-selbsttest.json'), 'utf8')),
    ).toEqual(report());
    expect(readFileSync(join(root, 'test-results/wap/vitest-selbsttest.json'))).toEqual(
      Buffer.from(rawReport()),
    );
    assertFreshReceipt(root, commit);
    await run(root);
    const queueTwice = readFileSync(join(root, QUEUE), 'utf8');
    expect(queueTwice.startsWith(queue)).toBe(true);
    expect(queueTwice.split(`WIEDERVERWENDET ${commit}`).length - 1).toBe(2);
    expect(nativeCount()).toBe(0);
    expect(adapter.calls).toEqual([...CONFIGS.slice(0, 2), ...CONFIGS.slice(0, 2)]);
  });
  it('[R-H-36] Produkt- und Dokumentdirty verhindert Wiederverwendung nicht pauschal', async () => {
    const { root, commit } = setup();
    seed(root, commit);
    put(root, 'src/model/wap/fiktiv.ts', 'export const fiktiv = 2;\n');
    put(root, 'docs/fiktiv.md', 'Nicht committierte Dokumentation\n');
    await run(root);
    expect(nativeCount()).toBe(0);
  });
  it('[R-H-36] Nicht versionierte Produktdatei verhindert Wiederverwendung nicht pauschal', async () => {
    const { root, commit } = setup();
    seed(root, commit);
    put(root, 'src/model/wap/neues-produkt.ts', 'export const fiktiv = 3;\n');
    await run(root);
    expect(nativeCount()).toBe(0);
  });
  it('[R-H-36] Grüner Beleg ist im echten anderen Paket-Worktree über git-common-dir wiederverwendbar', async () => {
    const { root, commit } = setup();
    seed(root, commit);
    const linked = join(root, 'fiktiver-zweiter-worktree');
    git(root, 'worktree', 'add', '-qb', 'wap/e1-01i-zweit', linked, commit);
    put(linked, 'docs/fiktiv.md', 'Dokumentänderung im zweiten Paketcheckout\n');
    snapshot(linked);
    const steps = await run(linked);
    expect(nativeCount()).toBe(0);
    expect(steps.find((s) => s.id === 'V1a-selbsttest')?.details).toMatchObject({
      status: `WIEDERVERWENDET ${commit}`,
    });
    expect(readFileSync(join(linked, QUEUE), 'utf8')).toContain(`WIEDERVERWENDET ${commit}`);
    assertFreshReceipt(root, commit);
  });
  it.each(CRITICAL)(
    '[R-H-36] Kritischer Pfad %s erzwingt echten Schritt und neuen grünen Commitbeleg',
    async (path) => {
      const { root, commit } = setup();
      seed(root, commit);
      put(root, path, '// Geänderter fiktiver Prüfbestand\n');
      const current = snapshot(root);
      await run(root);
      assertFreshReceipt(root, current);
      expect(nativeCount()).toBe(1);
    },
  );
  it('[R-H-36] Rename aus geschütztem Verzeichnis wird als Änderung erkannt', async () => {
    const { root, commit } = setup();
    seed(root, commit);
    git(root, 'mv', 'tests/wap-harness/fiktiv.harness.ts', 'docs/verschoben.md');
    const current = snapshot(root);
    await run(root);
    assertFreshReceipt(root, current);
    expect(nativeCount()).toBe(1);
  });
  it('[R-H-36] Fehlender Beleg erzwingt echten Schritt und speichert dessen grünen Ergebnisbeleg', async () => {
    const { root, commit } = setup();
    await run(root);
    assertFreshReceipt(root, commit);
    expect(nativeCount()).toBe(1);
  });
  it.each([
    { version: 2 },
    { art: 'V1a-gate' },
    { commit: 'nicht-ein-commit' },
    { commit: 'f'.repeat(40) },
    { exit: 1 },
    { berichtSha256: '0'.repeat(64) },
    { berichtRaw: '{' },
    { bericht: report(true) },
    { bericht: null },
    { bericht: { ...report(), numPendingTests: 1 } },
    {
      bericht: {
        ...report(),
        testResults: [{ ...report().testResults[0], message: 'Fiktiver Dateifehler' }],
      },
    },
    { bericht: { success: true, numTotalTests: 0, numPassedTests: 0, testResults: [] } },
  ])(
    '[R-H-36] Ungültiger oder roter Beleg %j wird durch einen echten grünen Lauf ersetzt',
    async (invalid) => {
      const { root, commit } = setup();
      seed(root, commit, invalid);
      await run(root);
      assertFreshReceipt(root, commit);
      expect(nativeCount()).toBe(1);
    },
  );
  it('[R-H-36] Beschädigtes JSON ist kein Wiederverwendungsbeleg', async () => {
    const { root, commit } = setup();
    put(root, RECEIPT, '{');
    await run(root);
    assertFreshReceipt(root, commit);
    expect(nativeCount()).toBe(1);
  });
  it('[R-H-36] Gate B läuft trotz grünem passenden Beleg wirklich und protokolliert keine Wiederverwendung', async () => {
    const { root, commit } = setup();
    seed(root, commit);
    put(root, 'docs/fiktiv.md', 'Gate B neuer Dokumentstand\n');
    const current = snapshot(root);
    const queueBefore = readFileSync(join(root, QUEUE), 'utf8');
    const steps = await run(root, true);
    assertFreshReceipt(root, current);
    expect(nativeCount()).toBe(1);
    expect(
      JSON.stringify(steps.find((s) => s.id === 'V1a-selbsttest')?.details ?? {}),
    ).not.toContain('WIEDERVERWENDET');
    expect(readFileSync(join(root, QUEUE), 'utf8')).toBe(queueBefore);
  });
  it('[R-H-36] Fehlende Reviewqueue erzwingt echten Lauf, keinen stillen Append-Ersatz', async () => {
    const { root, commit } = setup();
    seed(root, commit);
    rmSync(join(root, QUEUE));
    put(root, 'docs/fiktiv.md', 'Neuer Dokumentstand\n');
    const current = snapshot(root);
    await run(root);
    assertFreshReceipt(root, current);
    expect(nativeCount()).toBe(1);
    expect(existsSync(join(root, QUEUE))).toBe(false);
  });
  it.each(['queue', 'bericht'] as const)(
    '[R-H-36] Schreibfehler an %s erzwingt echten Lauf ohne falsche Wiederverwendungszeile',
    async (path) => {
      const { root, commit } = setup();
      seed(root, commit);
      const before = readFileSync(join(root, QUEUE), 'utf8');
      put(root, 'docs/fiktiv.md', 'Neuer Stand vor Schreibfehler\n');
      const current = snapshot(root);
      adapter.writeFailure = path;
      const steps = await run(root);
      expect(nativeCount()).toBe(1);
      expect(
        JSON.stringify(steps.find((s) => s.id === 'V1a-selbsttest')?.details ?? {}),
      ).not.toContain(`WIEDERVERWENDET ${commit}`);
      expect(readFileSync(join(root, QUEUE), 'utf8')).toBe(before);
      assertFreshReceipt(root, current);
    },
  );
  it('[R-H-36] Grünbeleg bleibt gültig, wenn späterer Full-Schritt rot wird', async () => {
    const { root, commit } = setup();
    adapter.laterRed = true;
    const steps = await run(root, false, ['V1a', 'V9']);
    expect(steps.find((s) => s.id === 'V1a-selbsttest')?.ok).toBe(true);
    expect(steps.find((s) => s.id === 'V9-trace')?.ok).toBe(false);
    assertFreshReceipt(root, commit);
    expect(nativeCount()).toBe(1);
  });
  it('[R-H-11] Gegenfall: Nicht versionierter kritischer Input erzeugt keinen falschen HEAD-Beleg', async () => {
    const { root } = setup();
    put(root, 'tests/wap-gate/zusatz.gate.ts', '// Fiktiver neuer Input\n');
    await run(root);
    expect(nativeCount()).toBe(1);
    expect(existsSync(join(root, RECEIPT))).toBe(false);
  });
  it('[R-H-11] Gegenfall: Vorhandener Beleg mit neuem untracked kritischem Input wird nicht wiederverwendet', async () => {
    const { root, commit } = setup();
    seed(root, commit);
    const before = readFileSync(join(root, RECEIPT), 'utf8');
    put(root, 'tests/wap-gate/zusatz.gate.ts', '// Fiktiver neuer Input\n');
    await run(root);
    expect(nativeCount()).toBe(1);
    expect(readFileSync(join(root, RECEIPT), 'utf8')).toBe(before);
  });
  it('[R-H-11] Gegenfall: Gitfehler erzwingt echten Schritt und nie einen ungeprüften neuen Anchor', async () => {
    const { root } = setup();
    adapter.gitError = true;
    await run(root);
    expect(nativeCount()).toBe(1);
    expect(existsSync(join(root, RECEIPT))).toBe(false);
  });
  it('[R-H-11] Gegenfall: Kritischer nicht committierter Input erzeugt keinen falschen HEAD-Beleg', async () => {
    const { root } = setup();
    put(root, CRITICAL[0] ?? '', '// Uncommittiertes Werkzeug\n');
    await run(root);
    expect(nativeCount()).toBe(1);
    expect(existsSync(join(root, RECEIPT))).toBe(false);
  });
  it('[R-H-11] Gegenfall: Roter aktueller Selbsttest erzeugt keinen grünen Beleg', async () => {
    const { root } = setup();
    adapter.childRed = true;
    const steps = await run(root);
    expect(nativeCount()).toBe(1);
    expect(steps.find((s) => s.id === 'V1a-selbsttest')?.ok).toBe(false);
    expect(existsSync(join(root, RECEIPT))).toBe(false);
  });
  it.each(['rot', 'gitfehler'] as const)(
    '[R-H-11] Gegenfall: Gültiger alter Anchor bleibt bei %s unverändert',
    async (failure) => {
      const { root, commit } = setup();
      seed(root, commit);
      const before = readFileSync(join(root, RECEIPT));
      if (failure === 'rot') {
        put(root, CRITICAL[0] ?? '', '// Neuer kritischer Stand\n');
        snapshot(root);
        adapter.childRed = true;
      } else adapter.gitError = true;
      await run(root);
      expect(nativeCount()).toBe(1);
      expect(readFileSync(join(root, RECEIPT))).toEqual(before);
    },
  );
  it.each(['signal', 'startError', 'unhandled'] as const)(
    '[R-H-11] Gegenfall: Prozessfehler %s erzeugt trotz grünen JSON keinen grünen Beleg',
    async (failure) => {
      const { root } = setup();
      adapter[failure] = true;
      await run(root);
      expect(nativeCount()).toBe(1);
      expect(existsSync(join(root, RECEIPT))).toBe(false);
    },
  );
  it('[R-H-11] Gegenfall: HEAD-Wechsel während des Selbsttests erzeugt keinen falschen Herkunftsbeleg', async () => {
    const { root } = setup();
    adapter.duringSelf = (cwd) => {
      put(cwd, 'docs/fiktiv.md', 'Commit während des Laufs\n');
      snapshot(cwd);
    };
    await run(root);
    expect(nativeCount()).toBe(1);
    expect(existsSync(join(root, RECEIPT))).toBe(false);
  });
  it('[R-H-11] Gegenfall: Kritischer Inputwechsel während des Selbsttests erzeugt keinen falschen Herkunftsbeleg', async () => {
    const { root } = setup();
    adapter.duringSelf = (cwd) => put(cwd, CRITICAL[0] ?? '', '// Während des Laufs geändert\n');
    await run(root);
    expect(nativeCount()).toBe(1);
    expect(existsSync(join(root, RECEIPT))).toBe(false);
  });
});
