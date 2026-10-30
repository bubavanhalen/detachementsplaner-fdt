// Hilfen für die Harness-Tests nach Code-Review Runde 8 (Paket H0, P44g–P44k, P35d, P47b, P9a).
// Ergänzt helpers.ts und helpers-objekte.ts (beide eingefroren); Bäume und Commits werden direkt aus
// git-Objekten gebaut (mktree, commit-tree), damit auch Pfade entstehen, die der Index unter Windows
// abweist. Nur fiktive Daten.
import { git, type Sandbox } from './helpers';
import { gitMitEingabe } from './helpers-objekte';

/** Ein Baumeintrag mit vollem Pfad relativ zur Wurzel. */
export interface Eintrag {
  modus: string;
  oid: string;
  pfad: string;
}

/** Alle Blob-, Symlink- und Gitlink-Einträge eines Commits (rekursiv, -z). */
export function eintraegeVon(sb: Sandbox, root: string, ref: string): Eintrag[] {
  const out = git(sb, root, 'ls-tree', '-r', '-z', ref);
  return out
    .split('\0')
    .filter((z) => z !== '')
    .map((z) => {
      const tab = z.indexOf('\t');
      const [modus, , oid] = z.slice(0, tab).split(' ');
      return { modus, oid, pfad: z.slice(tab + 1) };
    });
}

/** Baut aus Einträgen mit vollen Pfaden rekursiv einen Baum (mktree -z) und gibt seine ID zurück. */
export function baumAusEintraegen(sb: Sandbox, root: string, eintraege: Eintrag[]): string {
  const dateien: string[] = [];
  const ordner = new Map<string, Eintrag[]>();
  for (const e of eintraege) {
    const i = e.pfad.indexOf('/');
    if (i < 0) {
      const typ = e.modus === '160000' ? 'commit' : 'blob';
      dateien.push(`${e.modus} ${typ} ${e.oid}\t${e.pfad}\0`);
    } else {
      const kopf = e.pfad.slice(0, i);
      const liste = ordner.get(kopf) ?? [];
      liste.push({ ...e, pfad: e.pfad.slice(i + 1) });
      ordner.set(kopf, liste);
    }
  }
  for (const [kopf, liste] of ordner) {
    dateien.push(`040000 tree ${baumAusEintraegen(sb, root, liste)}\t${kopf}\0`);
  }
  return gitMitEingabe(sb, root, dateien.join(''), 'mktree', '-z');
}

/**
 * Commit aus Einträgen (commit-tree, feste Zeitstempel über sb.env) mit den genannten Eltern; setzt
 * optional `refs/heads/<zweig>` darauf. Gibt die Commit-ID zurück.
 */
export function commitAusEintraegen(
  sb: Sandbox,
  root: string,
  eintraege: Eintrag[],
  eltern: string[],
  zweig?: string,
  msg = 'Stand aus Objekten',
): string {
  const baum = baumAusEintraegen(sb, root, eintraege);
  const args = ['commit-tree', baum, ...eltern.flatMap((e) => ['-p', e]), '-m', msg];
  const commit = git(sb, root, ...args);
  if (zweig) git(sb, root, 'update-ref', `refs/heads/${zweig}`, commit);
  return commit;
}

/** Inhalt eines Git-LFS-Zeigers (fiktive OID). */
export function lfsZeiger(): string {
  return [
    'version https://git-lfs.github.com/spec/v1',
    `oid sha256:${'a'.repeat(64)}`,
    'size 12',
    '',
  ].join('\n');
}

/**
 * Fiktive, nicht vorhandene Commit-ID als Gitlink-Ziel (TR-H0-112): Es gibt kein Objekt, das als Inhalt
 * gelesen einen zufälligen Treffer erzeugen könnte; keine Ziffern.
 */
export const FIKTIVE_OID = 'ab'.repeat(20);

/** `.gitmodules` mit `ignore = all` für einen Untermodul-Pfad. */
export function gitmodulesIgnoreAll(pfad: string): string {
  return `[submodule "s"]\n\tpath = ${pfad}\n\turl = ./x\n\tignore = all\n`;
}
