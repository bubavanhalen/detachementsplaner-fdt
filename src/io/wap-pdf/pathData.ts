// Pfaddaten `PathItem.d` (Vertrag E1-02c §1, Änderungsnotiz Vertragsprüfung V06): eine Grammatik für den
// PDF-Schreiber und den Bildschirm-Zeichner, damit beide denselben Pfad zeichnen (Leitplanke 2). Rein, ohne DOM.

/** Ein Segment mit absoluten Koordinaten in pt (Seitenraum, y nach unten). */
export interface PathSegment {
  readonly cmd: 'M' | 'L' | 'C' | 'Z';
  /** M, L: [x, y]; C: [x1, y1, x2, y2, x, y]; Z: []. */
  readonly values: readonly number[];
}

/** Begrenzung in pt (geschlossene Intervalle). */
export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
}

const ANZAHL: { readonly [K in PathSegment['cmd']]: number } = { M: 2, L: 2, C: 6, Z: 0 };

const LEERRAUM = /[\t\n\f\r ]*/y;
const BEFEHL = /[MLCZ]/y;
const ZAHL = /-?(?:\d+(?:\.\d+)?|\.\d+)/y;
/** Zwischen zwei Zahlen: ein Komma mit optionalem Leerraum oder Leerraum (mindestens ein Zeichen). */
const TRENNER = /[\t\n\f\r ]*,[\t\n\f\r ]*|[\t\n\f\r ]+/y;

/** Ende des Leerraums ab `pos` (auch ohne Leerraum). */
function nachLeerraum(text: string, pos: number): number {
  LEERRAUM.lastIndex = pos;
  LEERRAUM.exec(text);
  return LEERRAUM.lastIndex;
}

/** Wendet ein klebendes Muster an der Stelle `pos` an; liefert Ende und Text oder `null`. */
function treffer(muster: RegExp, text: string, pos: number): { ende: number; wert: string } | null {
  muster.lastIndex = pos;
  const m = muster.exec(text);
  return m === null ? null : { ende: muster.lastIndex, wert: m[0] };
}

/**
 * Zerlegt `d` nach der Grammatik V06: am Anfang und Ende Leerraum erlaubt, dann `M`; je Segment genau ein
 * Befehl M, L, C oder Z mit 2, 2, 6 bzw. 0 Zahlen; Zahl `-?(\d+(\.\d+)?|\.\d+)` ohne Exponent; zwischen
 * Befehl und Zahl sowie zwischen Segmenten optional Leerraum; zwischen Zahlen Leerraum oder ein Komma mit
 * optionalem Leerraum. Liefert `null` bei jeder Abweichung, bei leerem `d` und bei nicht endlichen Zahlen.
 */
export function parsePathData(d: string): readonly PathSegment[] | null {
  const segmente: PathSegment[] = [];
  let pos = nachLeerraum(d, 0);
  while (pos < d.length) {
    const befehl = treffer(BEFEHL, d, pos);
    if (befehl === null) return null;
    const cmd = befehl.wert as PathSegment['cmd'];
    if (segmente.length === 0 && cmd !== 'M') return null;
    pos = befehl.ende;
    const values: number[] = [];
    for (let k = 0; k < ANZAHL[cmd]; k++) {
      const vor = k === 0 ? nachLeerraum(d, pos) : (treffer(TRENNER, d, pos)?.ende ?? -1);
      const zahl = vor < 0 ? null : treffer(ZAHL, d, vor);
      if (zahl === null) return null;
      const wert = Number(zahl.wert);
      if (!Number.isFinite(wert)) return null;
      values.push(wert);
      pos = zahl.ende;
    }
    segmente.push({ cmd, values });
    pos = nachLeerraum(d, pos);
  }
  return segmente.length === 0 ? null : segmente;
}

/** Pfaddaten in Normalform («M x y L x y C … Z»), wie sie der Bildschirm-Zeichner verwendet. */
export function formatPathData(segmente: readonly PathSegment[]): string {
  return segmente.map((s) => [s.cmd, ...s.values.map((v) => String(v))].join(' ')).join(' ');
}

/**
 * Begrenzung aller Koordinaten (einschliesslich der Kontrollpunkte). Für Ergebnisse von `parsePathData`
 * (beginnen mit `M`) immer endlich.
 */
export function pathBounds(segmente: readonly PathSegment[]): Bounds {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const s of segmente) {
    for (let i = 0; i + 1 < s.values.length; i += 2) {
      const x = s.values[i] as number;
      const y = s.values[i + 1] as number;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }
  return { minX, minY, maxX, maxY };
}
