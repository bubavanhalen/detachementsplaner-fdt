// Installiert den Commit-Shim des WAP-Planers (Paket H0, R-H-08).
// Vertrag: docs/wap-planer/pakete/H0.md, Klausel 6, P9, P12, P16, P25, P47i.
// Ziel: <git-common-dir>/hooks/pre-commit und pre-merge-commit (gemeinsam für alle Worktrees).
// Der Shim greift nur auf den Zweigen wap-planer, wap-codex und wap/* (bei losgelöstem HEAD: Zweig des
// laufenden Rebase, sonst konservativ, sobald test-lock.json und pre-commit.mjs vorhanden sind)
// und nur, wenn der aktuelle Worktree scripts/wap/pre-commit.mjs enthält; sonst Exit 0.
// Fremde Hooks werden nie überschrieben; beide Hooks werden gemeinsam und transaktional geschrieben.
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  fehler,
  info,
  runGit,
  TransaktionsFehler,
  writeTransaktion,
  zeigePfad,
} from './lib/common.mjs';

const KENNZEILE = '# wap-planer-harness-shim (verwaltet von scripts/wap/install-hooks.mjs)';
const HOOKS = ['pre-commit', 'pre-merge-commit'];

const SHIM = [
  '#!/bin/sh',
  KENNZEILE,
  '# Datenschutz-Scan und Lock-Prüfung nur auf den Zweigen wap-planer, wap-codex und wap/* (R-H-08, P16).',
  'top=$(git rev-parse --show-toplevel) || exit 1',
  'pruefung="$top/scripts/wap/pre-commit.mjs"',
  '[ -f "$pruefung" ] || exit 0',
  'branch=$(git symbolic-ref --short -q HEAD)',
  'if [ -z "$branch" ]; then',
  '  gitdir=$(git rev-parse --git-dir) || exit 1',
  '  for datei in "$gitdir/rebase-merge/head-name" "$gitdir/rebase-apply/head-name"; do',
  '    if [ -f "$datei" ]; then',
  '      ref=',
  '      read -r ref < "$datei"',
  '      # Nur refs/heads/<zweig> gilt als Zweig (P28); «detached HEAD» u.a. -> konservativ.',
  '      case "$ref" in',
  // biome-ignore lint/suspicious/noTemplateCurlyInString: Shell-Parametererweiterung im Shim-Text, kein JS-Template.
  '        refs/heads/*) branch=${ref#refs/heads/} ;;',
  '      esac',
  '      break',
  '    fi',
  '  done',
  'fi',
  'if [ -z "$branch" ]; then',
  '  # Losgelöster HEAD ohne ermittelbaren Zweig: konservativ prüfen, sobald eine Sperrdatei existiert.',
  '  [ -f "$top/docs/wap-planer/test-lock.json" ] || exit 0',
  '  exec node "$pruefung"',
  'fi',
  'case "$branch" in',
  '  wap-planer|wap-codex|wap/*) exec node "$pruefung" ;;',
  '  *) exit 0 ;;',
  'esac',
  '',
].join('\n');

/**
 * Zustand eines Hook-Pfads: fehlt, eigen (Kennzeile) oder fremd (inkl. Ordner, nicht lesbar).
 * @param {string} file
 * @returns {'fehlt' | 'eigen' | 'fremd'}
 */
function zustand(file) {
  if (!existsSync(file)) return 'fehlt';
  try {
    if (!statSync(file).isFile()) return 'fremd';
    return readFileSync(file, 'utf8').includes(KENNZEILE) ? 'eigen' : 'fremd';
  } catch {
    return 'fremd';
  }
}

function main() {
  const r = runGit(['rev-parse', '--path-format=absolute', '--git-common-dir']);
  if (r.status !== 0 || r.stdout.trim() === '') {
    fehler('install-hooks: kein git-Repo im aktuellen Verzeichnis; im Worktree aufrufen.');
    return 1;
  }
  const hooksPath = runGit(['config', '--get', 'core.hooksPath']);
  if (hooksPath.status === 0 && hooksPath.stdout.trim() !== '') {
    fehler(
      'install-hooks: core.hooksPath ist gesetzt; Hooks unter <git-common-dir>/hooks würden nicht ' +
        'ausgeführt. Nichts installiert. core.hooksPath prüfen und erneut aufrufen.',
    );
    return 1;
  }
  const dir = join(resolve(r.stdout.trim()), 'hooks');
  const fremd = HOOKS.filter((name) => zustand(join(dir, name)) === 'fremd');
  if (fremd.length > 0) {
    fehler(
      `install-hooks: fremder Hook vorhanden (${fremd.join(', ')}: fremder Inhalt, Ordner oder nicht ` +
        'lesbar); nichts installiert oder geändert. Den Hook prüfen und die WAP-Prüfung ' +
        '(node scripts/wap/pre-commit.mjs) dort von Hand einbinden.',
    );
    return 1;
  }
  try {
    mkdirSync(dir, { recursive: true });
    writeTransaktion(HOOKS.map((name) => ({ file: join(dir, name), content: SHIM, mode: 0o755 })));
  } catch (e) {
    const offen = e instanceof TransaktionsFehler ? e.nichtZurueckgesetzt : [];
    const reste = e instanceof TransaktionsFehler ? e.tmpReste : [];
    if (e instanceof TransaktionsFehler && offen.length === 0 && reste.length === 0) {
      fehler(
        'install-hooks: Hook liess sich nicht schreiben (Schreibschutz oder gesperrt); keine Änderung ' +
          'vorgenommen, beide Hooks sind auf dem Ausgangsstand. Schreibrechte prüfen und erneut aufrufen.',
      );
    } else {
      // P33 sinngemäss (P25): gescheiterte Rücksetzung ehrlich melden; Pfade nur über zeigePfad
      // (P47e, P47i).
      const liste = (/** @type {string[]} */ pfade) =>
        pfade.map((p) => zeigePfad(p.split('\\').join('/'))).join(', ');
      fehler(
        'install-hooks: Hook liess sich nicht schreiben, und der Ausgangsstand ist nicht gesichert' +
          (offen.length > 0 ? ` (nicht zurückgesetzt: ${liste(offen)})` : '') +
          (reste.length > 0 ? ` (Zwischendateien nicht entfernt: ${liste(reste)})` : '') +
          '. Hooks im Ordner prüfen und erneut aufrufen.',
      );
    }
    return 1;
  }
  info(`install-hooks: ${HOOKS.join(' und ')} installiert.`);
  return 0;
}

process.exitCode = main();
