// Hook-Konfiguration .claude/settings.json – R-H-03 (Klausel 7, P10, P17; Befunde TR-H0-13, CR-H0S-05).
// Statischer Test: liest die versionierte Konfiguration des Arbeits-Checkouts nur.
// Das Verhalten im laufenden Claude Code belegt zusätzlich der Selbsttest R-H-09 (3).
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { CHECKOUT_ROOT, CHILD_TIMEOUT, cleanupSandboxes, createSandbox } from './helpers';

afterEach(cleanupSandboxes);

const SETTINGS = join(CHECKOUT_ROOT, '.claude', 'settings.json');
/** P17: fail-closed – jeder Exit-Code ausser 0 wird zu 2 (Blockierung). */
const BEFEHL = 'node "$CLAUDE_PROJECT_DIR/scripts/wap/guard-edit.mjs" || exit 2';

interface HookCommand {
  type?: string;
  command?: string;
}
interface HookEntry {
  matcher?: string;
  hooks?: HookCommand[];
}

function preToolUse(): HookEntry[] {
  expect(existsSync(SETTINGS), '.claude/settings.json fehlt').toBe(true);
  const settings = JSON.parse(readFileSync(SETTINGS, 'utf8')) as {
    hooks?: { PreToolUse?: HookEntry[] };
  };
  const entries = settings.hooks?.PreToolUse;
  expect(Array.isArray(entries), 'hooks.PreToolUse fehlt oder ist keine Liste').toBe(true);
  return entries as HookEntry[];
}

function guardEntries(): HookEntry[] {
  return preToolUse().filter((entry) =>
    (entry.hooks ?? []).some((h) => (h.command ?? '').includes('scripts/wap/guard-edit.mjs')),
  );
}

describe('Hook-Konfiguration', () => {
  it('[R-H-03] .claude/settings.json ruft guard-edit.mjs mit «|| exit 2» unter hooks.PreToolUse auf (P17)', () => {
    const treffer = preToolUse().filter((entry) =>
      (entry.hooks ?? []).some((h) => h.type === 'command' && h.command === BEFEHL),
    );
    expect(treffer.length).toBeGreaterThanOrEqual(1);
  });

  it('[R-H-03] der Matcher des guard-edit-Hooks ist genau Edit|Write|MultiEdit|NotebookEdit', () => {
    const treffer = guardEntries();
    expect(treffer).toHaveLength(1);
    const matcher = treffer[0].matcher ?? '';
    expect(matcher).toBe('Edit|Write|MultiEdit|NotebookEdit');
  });

  it('[R-H-03] der konfigurierte Befehl blockiert (Exit 2), wenn das Skript fehlt (P17, fail-closed)', () => {
    const treffer = guardEntries();
    expect(treffer).toHaveLength(1);
    const befehl = (treffer[0].hooks ?? []).find((h) =>
      (h.command ?? '').includes('scripts/wap/guard-edit.mjs'),
    )?.command as string;
    const sb = createSandbox();
    // Projektverzeichnis ohne scripts/wap/guard-edit.mjs: node scheitert.
    const r = spawnSync('sh', ['-c', befehl], {
      cwd: sb.base,
      env: { ...sb.env, CLAUDE_PROJECT_DIR: sb.base.replace(/\\/g, '/') },
      input: '{}',
      encoding: 'utf8',
      timeout: CHILD_TIMEOUT,
    });
    expect(r.status, 'sh nicht aufrufbar oder Zeitlimit').not.toBeNull();
    expect(r.status).toBe(2);
  });
});
