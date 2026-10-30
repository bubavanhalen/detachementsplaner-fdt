// Linienarten und Strichbreiten aus Anhang B-Kp (Paket E1-02e, Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» H3:
// «Breiten aus der CSV und E1-02d §5»). Die Zahlen stehen nur in der CSV; hier werden sie mit Formmuster gelesen.
// Weicht eine Zelle ab, scheitert der Test mit einer Assertion, die die Zeile nennt.
import { expect } from 'vitest';
import { type BkpDatei, type BkpZeile, leseBkp, ZAHL, zahl } from './bkp';
import { ausHex, type LinienStil } from './pdf-seite';

let datei: BkpDatei | undefined;

/** Zeile der CSV (Datei einmal je Testdatei gelesen). */
export function bkp(id: string): BkpZeile {
  datei ??= leseBkp();
  return zeile(datei, id);
}

/** Zahlen einer Zelle nach Formmuster (Gruppen in Reihenfolge). */
export function bkpZahlen(
  id: string,
  spalte: 'soll' | 'sollwert' | 'toleranz',
  muster: RegExp,
): number[] {
  const z = bkp(id);
  const m = form(id, spalte, z[spalte], muster);
  return m.slice(1).map((g) => zahl(g ?? ''));
}

export function zeile(d: BkpDatei, id: string): BkpZeile {
  const z = d.zeilen.find((x) => x.id === id);
  expect(z, `${id} in anhang-b-kp.csv`).toBeDefined();
  return z as BkpZeile;
}

/** Wendet ein Formmuster an; ohne Treffer scheitert der Test mit der Zeilen-ID. */
export function form(id: string, spalte: string, wert: string, muster: RegExp): RegExpExecArray {
  const m = muster.exec(wert);
  expect(m, `${id}: Form der Spalte ${spalte} weicht ab`).not.toBeNull();
  return m as RegExpExecArray;
}

/** Strich «0,48» (± «0,12 pt») bzw. «0,48; Muster 1,56/0,48» (± «…; Muster ±0,15 pt»). */
export function strichAus(d: BkpDatei, id: string): LinienStil {
  const z = zeile(d, id);
  const s = form(
    id,
    'Sollwert',
    z.sollwert,
    new RegExp(`^(${ZAHL})(?: pt)?(?:; Muster (${ZAHL})/(${ZAHL}))?(?:;.*)?$`),
  );
  const t = form(
    id,
    'Toleranz',
    z.toleranz,
    new RegExp(`^±(${ZAHL}) pt(?:; Muster ±(${ZAHL}) pt)?(?:;.*)?$`),
  );
  const muster = s[2] === undefined ? null : [zahl(s[2]), zahl(s[3] ?? '')];
  return {
    breite: zahl(s[1] ?? ''),
    breiteTol: zahl(t[1] ?? ''),
    muster,
    musterTol: t[2] === undefined ? 0 : zahl(t[2]),
  };
}

export interface Stile {
  readonly rahmen: LinienStil;
  readonly kopfUnterlinie: LinienStil;
  readonly titelRahmen: LinienStil;
  readonly abstandLinien: LinienStil;
  readonly tagesgrenze: LinienStil;
  readonly spaltengrenze: LinienStil;
  readonly rapGrenze: LinienStil;
  readonly bahngrenze: LinienStil;
  readonly stunde: LinienStil;
  readonly halbstunde: LinienStil;
  readonly rasterkante: LinienStil;
  readonly block: LinienStil;
  readonly rapport: LinienStil;
  readonly beso: LinienStil;
  readonly markerLinie: LinienStil;
  readonly markerFeld: LinienStil;
  readonly querbalken: LinienStil;
  readonly tabelle: LinienStil;
  readonly markerFeldFarbe: { r: number; g: number; b: number };
}

/** Stile der Kp-Seite aus der CSV (B-Kp-02, -13, -19, -27, -38 bis -41, -45, -46, -48, -50, -58, -61, -65, -67, -70, -78). */
export function stileAusCsv(d: BkpDatei): Stile {
  const z67 = zeile(d, 'B-Kp-67');
  const f67 = form(
    'B-Kp-67',
    'Sollwert',
    z67.sollwert,
    new RegExp(`^(${ZAHL}) pt; (#[0-9A-F]{6})$`),
  );
  const t67 = form('B-Kp-67', 'Toleranz', z67.toleranz, new RegExp(`^±(${ZAHL}) pt; Farbe exakt$`));
  const z13 = zeile(d, 'B-Kp-13');
  const s13 = form('B-Kp-13', 'Soll', z13.soll, new RegExp(`waagrechte Linien (${ZAHL}) pt`));
  return {
    rahmen: strichAus(d, 'B-Kp-02'),
    kopfUnterlinie: strichAus(d, 'B-Kp-27'),
    titelRahmen: strichAus(d, 'B-Kp-19'),
    // Toleranz der Breite wie die Rasterbegrenzung (B-Kp-48), die eine der beiden Linien ist.
    abstandLinien: {
      breite: zahl(s13[1] ?? ''),
      breiteTol: strichAus(d, 'B-Kp-48').breiteTol,
      muster: null,
      musterTol: 0,
    },
    tagesgrenze: strichAus(d, 'B-Kp-38'),
    spaltengrenze: strichAus(d, 'B-Kp-39'),
    rapGrenze: strichAus(d, 'B-Kp-40'),
    bahngrenze: strichAus(d, 'B-Kp-41'),
    stunde: strichAus(d, 'B-Kp-45'),
    halbstunde: strichAus(d, 'B-Kp-46'),
    rasterkante: strichAus(d, 'B-Kp-48'),
    block: strichAus(d, 'B-Kp-50'),
    rapport: strichAus(d, 'B-Kp-58'),
    beso: strichAus(d, 'B-Kp-61'),
    markerLinie: strichAus(d, 'B-Kp-65'),
    markerFeld: {
      breite: zahl(f67[1] ?? ''),
      breiteTol: zahl(t67[1] ?? ''),
      muster: null,
      musterTol: 0,
    },
    querbalken: strichAus(d, 'B-Kp-70'),
    tabelle: strichAus(d, 'B-Kp-78'),
    markerFeldFarbe: ausHex(f67[2] ?? ''),
  };
}

/** Formmuster des Sollwerts von B-Kp-108 (Grössen der grösseren Texte). */
export const MUSTER_108 = new RegExp(
  `^Titel (${ZAHL}); Beilage (${ZAHL}); Woche (${ZAHL}); Unterschrift (${ZAHL}); Motto (${ZAHL}); Sonnenzeiten (${ZAHL}); Erh[.] Bereitschaft (${ZAHL})$`,
);

/** Formmuster des Sollwerts von B-Kp-28 (Tageskopf voller Tag). */
export const MUSTER_28 = new RegExp(
  `^Wochentag x = Tag links [+] (${ZAHL}); Datum «dd[.]mm[.]yyyy» x = Tag links [+] (${ZAHL}) u$`,
);

/** Formmuster des Sollwerts von B-Kp-07 (Stundenhöhe h aus der Rahmenhöhe). */
export const MUSTER_07 = new RegExp(
  `^H_R / (${ZAHL}) [(]senkrechte Spaltenköpfe[)] bzw[.] H_R / (${ZAHL}) [(]waagrechte[)]$`,
);

/** Farbe einer B-Kp-Zeile mit Sollwert «#RRGGBB». */
export function farbeAus(id: string): { r: number; g: number; b: number } {
  const z = bkp(id);
  return ausHex(form(id, 'Sollwert', z.sollwert, /^(#[0-9A-F]{6})$/)[1] ?? '');
}

/** Mindestgrösse aller Texte nach B-Kp-107 (Sollwert «4,5»; R-10-38). */
export function mindestgroesse(): number {
  return bkpZahlen('B-Kp-107', 'sollwert', new RegExp(`^(${ZAHL})$`))[0] as number;
}

/** Strich (schwarz) aus einem Linienstil der CSV. */
export function strichVon(s: LinienStil): {
  color: { r: number; g: number; b: number };
  widthPt: number;
  dash: number[] | null;
} {
  return {
    color: { r: 0, g: 0, b: 0 },
    widthPt: s.breite,
    dash: s.muster === null ? null : [...s.muster],
  };
}
