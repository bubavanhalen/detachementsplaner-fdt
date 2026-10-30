// Minimales synthetisches Repo für Schleusen-Läufe ohne Rekursion (enthält keine Schleusen-Tests).
// F1 (Node) und F2 (Lock, Referenz-Sperre mit fiktivem Anhang) sind darin grün, sofern WAP_REFERENCE_DIR
// auf sb.referenceDir zeigt (prozessUmgebung); alle übrigen Werkzeuge und Konfigurationen fehlen, sofern
// ein Test sie nicht ausdrücklich anlegt («eingebauter Verstoss» durch Fehlen, ADR-010 §3: «Fehlt ein
// Werkzeug oder eine Datei, ist der Schritt rot»).
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, readFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { expect } from 'vitest';
import { git, NODE_DIR, neuesRepo, type Sandbox, sha256Lf, WT, writeText } from './umgebung';

/** Fiktive Referenz-Sperre des Mini-Repos (Pfade relativ zu Repo bzw. WAP_REFERENCE_DIR). */
export const MINI_REFERENCE_LOCK = 'docs/wap-planer/reference-lock.json';
export const MINI_ANHANG = 'anhaenge/zz-mini-fiktiv.csv';
const MINI_ANHANG_INHALT = 'Mass;Wert\nRand;10\n';

export function miniRepo(sb: Sandbox, name = 'mini', branch = 'wap-planer'): string {
  const root = neuesRepo(sb, name, branch);
  const pkg = JSON.parse(readFileSync(join(WT, 'package.json'), 'utf8')) as {
    engines?: Record<string, string>;
  };
  writeText(
    root,
    'package.json',
    `${JSON.stringify({ name: 'mini', private: true, type: 'module', engines: pkg.engines }, null, 2)}\n`,
  );
  writeText(root, '.nvmrc', readFileSync(join(WT, '.nvmrc'), 'utf8'));
  cpSync(join(WT, 'scripts', 'wap'), join(root, 'scripts', 'wap'), { recursive: true });
  writeText(root, 'scripts/wap/privacy-allow.txt', '');
  // Fiktive Referenz-Sperre mit passendem fiktivem Anhang im Sandbox-Referenzordner (WAP_REFERENCE_DIR),
  // damit F2-referenz auch dann grün ist, wenn die Schleuse sie immer prüft (CR-E101-08, TR-E101-202).
  writeText(sb.referenceDir, MINI_ANHANG, MINI_ANHANG_INHALT);
  writeText(
    root,
    MINI_REFERENCE_LOCK,
    `${JSON.stringify({ version: 1, files: { [MINI_ANHANG]: sha256Lf(MINI_ANHANG_INHALT) } }, null, 2)}\n`,
  );
  git(sb, root, 'add', '-A');
  git(sb, root, 'commit', '-q', '-m', 'Mini-Projekt');
  return root;
}

/** Ordner von git.exe (bevorzugt Git\cmd), ohne Python darin. */
export function gitOrdner(sb: Sandbox): string {
  const r = spawnSync('where', ['git'], { env: sb.env, encoding: 'utf8', windowsHide: true });
  const zeilen = r.stdout.split(/\r?\n/).filter((z) => z.trim() !== '');
  const wahl = zeilen.find((z) => /\\cmd\\git\.exe$/i.test(z)) ?? zeilen[0];
  expect(wahl, 'git.exe nicht gefunden').toBeDefined();
  const ordner = dirname(wahl as string);
  for (const p of ['python.exe', 'python3.exe', 'py.exe']) {
    expect(existsSync(join(ordner, p)), `Test-Aufbau: ${p} im git-Ordner`).toBe(false);
  }
  return ordner;
}

/** PATH für Schleusen-Läufe mit gefälschtem Python: Fälschungsordner, git, Node, System32. */
export function pfadOhnePython(sb: Sandbox, faelschungen: string): string {
  const system32 = join(process.env.SystemRoot ?? 'C:\\Windows', 'System32');
  return [faelschungen, gitOrdner(sb), NODE_DIR, system32].join(delimiter);
}
