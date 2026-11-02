// Hilfen für die Harness-Tests nach Code-Review Runde 9 (Paket H0, P47d, P44h, P44l, P44k, P44m).
// Ergänzt helpers.ts, helpers-objekte.ts und helpers-objekte-r8.ts (alle eingefroren). Nur fiktive Daten.
// Alle Prüfungen hier sind «still»: Scheitert eine, gibt die Fehlermeldung die geprüfte Ausgabe nicht
// wieder, damit ein im Klartext ausgegebenes Muster nicht in der Testausgabe landet (TR-H0-122).
import { expect } from 'vitest';
import { GESPERRTE_NAMEN, git, type RunResult, type Sandbox, withoutSandboxPath } from './helpers';
import { AHV, MAIL, TELEFON } from './helpers-objekte';

/**
 * P8/P19 wie `expectMasked` (helpers-objekte.ts), aber ohne die geprüfte Ausgabe in die Fehlermeldung
 * zu übernehmen. Commit-Kürzel der genannten Repos werden vorher entfernt.
 */
export function expectMaskiertStill(
  sb: Sandbox,
  r: RunResult,
  secret: string,
  repos: string[] = [],
): void {
  // P47f (a): Der Sandbox-Pfad kann auch mit verdoppelten Backslashes erscheinen; auch diese Form
  // entfernen, damit zufällige Ziffern im Sandbox-Namen nicht als Treffer zählen.
  const bs = String.fromCharCode(92);
  let out = withoutSandboxPath(sb, r.out)
    .split(sb.base.split(bs).join(bs + bs))
    .join('');
  if (repos.length > 0) {
    const hashes = repos.flatMap((root) =>
      git(sb, root, 'rev-list', '--all', '--reflog')
        .split('\n')
        .filter((h) => h !== ''),
    );
    out = out.replace(/(?<![0-9a-f])[0-9a-f]{4,40}(?![0-9a-f])/g, (tok) =>
      hashes.some((h) => h.startsWith(tok)) ? '' : tok,
    );
  }
  expect(
    out.toLowerCase().includes(secret.toLowerCase()),
    'Treffer steht im Klartext in der Ausgabe (Ausgabe hier bewusst nicht wiedergegeben)',
  ).toBe(false);
  const digits = secret.replace(/\D/g, '');
  if (digits.length < 9) return;
  let rest = digits;
  if (secret.startsWith('+41')) rest = digits.slice(2);
  else if (digits.startsWith('0041')) rest = digits.slice(4);
  else if (digits.startsWith('756')) rest = digits.slice(3);
  else if (digits.startsWith('0')) rest = digits.slice(1);
  let offen = 0;
  for (let i = 0; i + 3 <= rest.length; i++) if (out.includes(rest.slice(i, i + 3))) offen++;
  expect(offen, 'Zifferngruppen des Treffers stehen unmaskiert in der Ausgabe (Anzahl)').toBe(0);
}

/** Stille Prüfung: `text` enthält `teil` (Fehlermeldung ohne `text`). */
export function expectEnthaeltStill(text: string, teil: string, was: string): void {
  expect(text.includes(teil), `${was} fehlt (Ausgabe hier bewusst nicht wiedergegeben)`).toBe(true);
}

/** Zeilen der Ausgabe, die `wort` enthalten. */
export function zeilenMit(out: string, wort: string): string[] {
  return out.split(/\r?\n/).filter((z) => z.includes(wort));
}

/**
 * P47d (TR-H0-123): Es gibt mindestens eine Zeile mit `wort`, und jede solche Zeile nennt den Pfad nur
 * als «(Pfad maskiert)». Still.
 */
export function expectPfadMaskiertInZeilen(out: string, wort: string): void {
  const zeilen = zeilenMit(out, wort);
  expect(zeilen.length, `keine Zeile mit «${wort}»`).toBeGreaterThan(0);
  const ohne = zeilen.filter((z) => !z.includes('(Pfad maskiert)')).length;
  expect(ohne, `Zeilen mit «${wort}» ohne «(Pfad maskiert)» (Anzahl)`).toBe(0);
}

/**
 * P19-Muster für Pfadteile (TR-H0-120): [Bezeichnung, Geheimnis, Pfadteil]. Der Pfadteil endet mit einem
 * Leerzeichen und einem Wort, damit kein Punkt oder Buchstabe direkt an die Nummer grenzt (P20).
 */
export function musterArten(): Array<[string, string, string]> {
  return [
    ['Telefonnummer', TELEFON, `Kontakt ${TELEFON} x`],
    ['AHV-Nummer', AHV, `AHV ${AHV} x`],
    ['E-Mail-Adresse', MAIL, `${MAIL} x`],
    ['Sperrlisten-Name', GESPERRTE_NAMEN[0], `Hptm ${GESPERRTE_NAMEN[0]} x`],
  ];
}
