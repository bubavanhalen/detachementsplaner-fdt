// Datenschutz-Scan, Pfad-Modus: reference/-Regel relativ zu jeder bestimmten Wurzel – R-H-07.
// Vertrag: docs/wap-planer/pakete/H0.md, «Präzisierungen nach Eskalation 1», P39h (CR-H0S-45; Nachbau von
// .qa/h0/review-skripte-7/angriff-r7-referenz.mjs). Nur fiktive Daten.
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  cleanupSandboxes,
  git,
  initRepo,
  type RunResult,
  runScript,
  type Sandbox,
} from './helpers';
import { commitDateien, sandbox } from './helpers-objekte';

afterEach(cleanupSandboxes);

/**
 * Repo R versioniert `wt/<rel>`; danach wird `wt` entfernt und als verknüpfter Worktree W (verwaister
 * Zweig wap/p) neu angelegt, der `<rel>` selbst versioniert. R ist das versionierende äussere Repo,
 * W die bestätigte innere Wurzel.
 */
function aufbau(sb: Sandbox, rel: string, rVersioniert = true): { r: string; w: string } {
  const r = initRepo(sb, 'R');
  if (rVersioniert) {
    commitDateien(sb, r, { [`wt/${rel}`]: 'binaer\n' }, 'R versioniert die Datei unter wt/');
    rmSync(join(r, 'wt'), { recursive: true, force: true });
  }
  git(sb, r, 'worktree', 'add', '-q', '--orphan', '-b', 'wap/p', join(r, 'wt'));
  const w = join(r, 'wt');
  commitDateien(sb, w, { [rel]: 'binaer\n' }, 'W versioniert die Datei');
  expect(git(sb, w, 'ls-files', rel)).toBe(rel);
  if (rVersioniert) expect(git(sb, r, 'ls-files', `wt/${rel}`)).toBe(`wt/${rel}`);
  return { r, w };
}

function scanAus(sb: Sandbox, r: string, cwd: string, args: string[]): RunResult {
  return runScript(sb, r, 'privacy-scan.mjs', args, { cwd });
}

describe('privacy-scan Pfad-Modus: reference/ relativ zur inneren Wurzel bei versionierendem äusserem Repo (P39h, CR-H0S-45)', () => {
  it('[R-H-07] Scan von reference/a.txt aus Worktree W; R versioniert wt/reference/a.txt → Exit 1, Meldung «reference/»', () => {
    const sb = sandbox();
    const { r, w } = aufbau(sb, 'reference/a.txt');
    const res = scanAus(sb, r, w, ['reference/a.txt']);
    expect(res.status).toBe(1);
    expect(res.out).toContain('reference/');
  }, 60_000);

  it('[R-H-07] Scan desselben Pfads absolut aus dem Arbeits-Checkout R → Exit 1, Meldung «reference/»', () => {
    const sb = sandbox();
    const { r, w } = aufbau(sb, 'reference/a.txt');
    const res = scanAus(sb, r, r, [join(w, 'reference', 'a.txt')]);
    expect(res.status).toBe(1);
    expect(res.out).toContain('reference/');
  }, 60_000);

  it('[R-H-07] Scan von docs/reference/a.txt aus W (weder für W noch für R oberste Ebene, ausserhalb der Pfadmenge, sauber) → Exit 0 (Gegenprobe)', () => {
    const sb = sandbox();
    const { r, w } = aufbau(sb, 'docs/reference/a.txt');
    expect(scanAus(sb, r, w, ['docs/reference/a.txt']).status).toBe(0);
  }, 60_000);

  it('[R-H-07] Scan von reference/a.txt aus W ohne Versionierung durch R → Exit 1, Meldung «reference/» (Gegenprobe ohne äusseres Repo)', () => {
    const sb = sandbox();
    const { r, w } = aufbau(sb, 'reference/a.txt', false);
    const res = scanAus(sb, r, w, ['reference/a.txt']);
    expect(res.status).toBe(1);
    expect(res.out).toContain('reference/');
  }, 60_000);

  // TR-H0-107: zweiter Fall aus angriff-r7-referenz.mjs, Durchsuchen des Ordners «.» aus W. Weil R die
  // Datei versioniert, gelten die Ausschlüsse relativ zu R (P39g: wt/reference ist dort nicht oberste
  // Ebene, wird also durchsucht); die reference/-Regel gilt relativ zu W (P39h).
  it('[R-H-07] Scan des Ordners «.» aus Worktree W; R versioniert wt/reference/a.txt → Exit 1, Meldung «reference/» (TR-H0-107)', () => {
    const sb = sandbox();
    const { r, w } = aufbau(sb, 'reference/a.txt');
    const res = scanAus(sb, r, w, ['.']);
    expect(res.status).toBe(1);
    expect(res.out).toContain('reference/');
  }, 60_000);

  it('[R-H-07] Scan des Ordners «.» aus W mit docs/reference/a.txt (für keine Wurzel oberste Ebene, sauber) → Exit 0 (Gegenprobe, TR-H0-107)', () => {
    const sb = sandbox();
    const { r, w } = aufbau(sb, 'docs/reference/a.txt');
    expect(scanAus(sb, r, w, ['.']).status).toBe(0);
  }, 60_000);
});
