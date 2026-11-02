// Anhang B-Kp als Testquelle (Paket E1-02e, Vertrag E1-02e §4 und Notiz «Ausarbeitung Schritt 2» Abschnitt I;
// Gate 0 F-51, B-F-10, Q-015). Einzige Quelle der Sollwerte ist die versionierte, pseudonymisierte CSV
// docs/wap-planer/anhaenge/anhang-b-kp.csv (gesperrt). Gelesen werden nur ID, Soll, Sollwert, Einheit, Toleranz
// und Anforderung; die übrigen Spalten nur auf Platzhalter (I «Platzhalter»), nie ihr Inhalt.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');
export const BKP_PFAD = join(WURZEL, 'docs', 'wap-planer', 'anhaenge', 'anhang-b-kp.csv');

/** Kopfzeile nach normalisierung.md §11. */
export const BKP_KOPF = [
  'ID',
  'Bereich',
  'Element',
  'Soll',
  'Sollwert',
  'Einheit',
  'Toleranz',
  'Messmethode',
  'Quelle',
  'Anforderung',
  'Bemerkung',
] as const;

export interface BkpZeile {
  readonly id: string;
  readonly soll: string;
  readonly sollwert: string;
  readonly einheit: string;
  readonly toleranz: string;
  readonly anforderung: readonly string[];
  /** Alle Zellen (nur für die Platzhalter-Prüfung über alle Spalten). */
  readonly zellen: readonly string[];
}

/** CSV mit Semikolon und Anführungszeichen (Zellen mit Zeilenumbruch). */
export function parseCsv(text: string): string[][] {
  const zeilen: string[][] = [];
  let zeile: string[] = [];
  let feld = '';
  let inAnf = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i] as string;
    if (inAnf) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          feld += '"';
          i++;
        } else inAnf = false;
      } else feld += c;
    } else if (c === '"') inAnf = true;
    else if (c === ';') {
      zeile.push(feld);
      feld = '';
    } else if (c === '\n') {
      zeile.push(feld.replace(/\r$/, ''));
      zeilen.push(zeile);
      zeile = [];
      feld = '';
    } else feld += c;
  }
  if (feld !== '' || zeile.length > 0) {
    zeile.push(feld.replace(/\r$/, ''));
    zeilen.push(zeile);
  }
  return zeilen;
}

export interface BkpDatei {
  readonly kopf: readonly string[];
  readonly zeilen: readonly BkpZeile[];
}

/** Liest die CSV; fehlt sie, scheitert der Test (nie «skip»). */
export function leseBkp(): BkpDatei {
  const roh = parseCsv(readFileSync(BKP_PFAD, 'utf8')).filter((z) => z.some((f) => f !== ''));
  const [kopf, ...rest] = roh;
  return {
    kopf: kopf ?? [],
    zeilen: rest.map((z) => ({
      id: (z[0] ?? '').trim(),
      soll: (z[3] ?? '').trim(),
      sollwert: (z[4] ?? '').trim(),
      einheit: (z[5] ?? '').trim(),
      toleranz: (z[6] ?? '').trim(),
      anforderung: (z[9] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== ''),
      zellen: z,
    })),
  };
}

/** Deutsche Dezimalzahl («0,48», «−0,7», «+1,4») → Zahl. */
export function zahl(s: string): number {
  const t = s.trim().replace('−', '-').replace('+', '').replace(',', '.');
  const n = Number(t);
  if (t === '' || !Number.isFinite(n)) throw new Error(`keine Zahl: «${s}»`);
  return n;
}

/** Muster einer deutschen Dezimalzahl mit optionalem Vorzeichen. */
export const ZAHL = '[−+-]?\\d+(?:,\\d+)?';

/** Platzhalter der Tabelle in Abschnitt I (Vertrag E1-02e). */
export const PLATZHALTER = [
  '<Einheit>',
  '<Bezeichnung>',
  '<dd.mm.yyyy>',
  '<dd.mm.yy>',
  '<nn>',
  '<…>',
  '<Grad Name Vorname>',
  '<Funktion>',
  '<Ltg>',
  '<Ort>',
  '<Nr>',
  '<hhmm>',
  '<Kürzel 1>',
  '<Kürzel n>',
] as const;
export type Platzhalter = (typeof PLATZHALTER)[number];

/** Platzhalter (Muster `<[^>]+>`) in einem Text in ihrer Reihenfolge. */
export function platzhalterIn(text: string): string[] {
  return [...text.matchAll(/<[^>]+>/g)].map((m) => m[0]);
}

export function istBekannterPlatzhalter(p: string): p is Platzhalter {
  return (PLATZHALTER as readonly string[]).includes(p);
}

/**
 * Ersetzt die Platzhalter eines Soll-Textes. `werte` nennt je Platzhalter die Ersatzwerte in Reihenfolge des
 * Vorkommens (z.B. zweimal `<dd.mm.yyyy>` in B-Kp-18). Unbekannte oder nicht belegte Platzhalter → Fehler.
 */
export function ersetze(
  text: string,
  werte: Partial<Record<Platzhalter, readonly string[]>>,
): string {
  const zaehler = new Map<string, number>();
  return text.replace(/<[^>]+>/g, (p) => {
    if (!istBekannterPlatzhalter(p)) throw new Error(`unbekannter Platzhalter ${p}`);
    const liste = werte[p];
    const i = zaehler.get(p) ?? 0;
    zaehler.set(p, i + 1);
    const w = liste?.[Math.min(i, (liste?.length ?? 1) - 1)];
    if (w === undefined) throw new Error(`kein Ersatz für ${p}`);
    return w;
  });
}

/** Texte in «…» (Guillemets) eines Soll-Textes. */
export function zitate(text: string): string[] {
  return [...text.matchAll(/«([^»]*)»/g)].map((m) => m[1] ?? '');
}

/**
 * IDs der Pakete E1-02e und E1-02k: die 78 Anforderungs-IDs von E1-02e (pakete/E1-02e.md, Vertrag J) und die
 * 4 von E1-02k (R-10-50 bis R-10-53; Vertrag E1-02k §7 N6).
 */
export const PAKET_IDS: ReadonlySet<string> = new Set([
  'R-4.1-07',
  'R-4.2-06',
  'R-4.3-04',
  'R-4.4-02',
  'R-4.4-08',
  'R-4.4-14',
  'R-4.5-03',
  'R-4.5-04',
  'R-4.5-05',
  'R-4.5-06',
  'R-4.6-03',
  'R-4.6-06',
  'R-4.6-08',
  'R-4.6-10',
  'R-4.6-12',
  'R-4.6-20',
  'R-4.6-27',
  'R-4.6-30',
  'R-4.6-31',
  'R-4.6-54',
  'R-4.6-59',
  'R-4.7-04',
  'R-4.7-05',
  'R-4.7-15',
  'R-4.8-01',
  'R-4.8-02',
  'R-4.8-03',
  'R-4.8-07',
  'R-4.9-01',
  'R-4.9-03',
  'R-4.9-05',
  'R-4.9-07',
  'R-4.9-09',
  'R-4.9-11',
  'R-4.9-16',
  'R-4.9-17',
  'R-5.1-13',
  'R-5.4-08',
  'R-6-05',
  'R-6-08',
  'R-7-06',
  'R-10-02',
  'R-10-06',
  'R-10-07',
  'R-10-08',
  'R-10-09',
  'R-10-10',
  'R-10-11',
  'R-10-12',
  'R-10-13',
  'R-10-14',
  'R-10-15',
  'R-10-16',
  'R-10-17',
  'R-10-18',
  'R-10-19',
  'R-10-20',
  'R-10-21',
  'R-10-22',
  'R-10-23',
  'R-10-24',
  'R-10-25',
  'R-10-26',
  'R-10-37',
  'R-10-38',
  'R-10-39',
  'R-10-42',
  'R-10-44',
  'R-10-45',
  'R-10-50',
  'R-10-51',
  'R-10-52',
  'R-10-53',
  'R-14.2-01',
  'R-14.2-02',
  'R-14.2-03',
  'R-14.2-04',
  'R-14.3-01',
  'R-14.3-02',
  'R-15-04',
  'R-15-05',
  'R-15-08',
]);

/** Verweis-IDs ohne eigenen Test (Vertrag J; ADR-010 §5 Regel 3). */
export const VERWEIS_IDS: ReadonlySet<string> = new Set([
  'R-4.9-17',
  'R-5.4-08',
  'R-10-45',
  'R-14.2-02',
  'R-14.2-04',
  'R-15-05',
]);

/** Testnamen-IDs einer Zeile: R-14.2-01 und die E1-02e-IDs aus der Spalte Anforderung (ohne Verweise). */
export function testIds(z: BkpZeile): string[] {
  const eigene = z.anforderung.filter((id) => PAKET_IDS.has(id) && !VERWEIS_IDS.has(id));
  return ['R-14.2-01', ...eigene.filter((id) => id !== 'R-14.2-01')];
}
