// Operatorfolge eines PDF für Prüfungen, die readPdf (E1-01b) nicht abdeckt (Paket E1-02c; Vertrag E1-02c
// §2.3 Nr 2–5 und Vertragsprüfung V04): Reihenfolge von Text und Pfaden, Startpunkt und Umlaufsinn von Pfaden,
// Linienenden, Ecken, Gehrungsgrenze, Phase der Strichelung, Determinante der CTM je Malvorgang und
// Zeichen-, Wort- und Breitenabstand je Textanzeige. Liest nur das fertige PDF über pdfjs-dist (wie readPdf).
import { AnnotationMode, getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

type Matrix = readonly [number, number, number, number, number, number];

const IDENTITAET: Matrix = [1, 0, 0, 1, 0, 0];

export interface TextEreignis {
  readonly art: 'text';
  readonly seite: number;
  readonly text: string;
  /** Tc, Tw und Tz (Prozent) beim Zeichnen. */
  readonly tc: number;
  readonly tw: number;
  readonly tz: number;
}

export interface PfadEreignis {
  readonly art: 'pfad';
  readonly seite: number;
  /** Punkte von moveTo und lineTo sowie Endpunkte von Kurven in Seitenkoordinaten (pt, oben links). */
  readonly punkte: readonly (readonly [number, number])[];
  readonly geschlossen: boolean;
  readonly strich: boolean;
  readonly flaeche: boolean;
  /** Füllung mit der Gerade-ungerade-Regel (f*, B*, b*) statt nonzero (f, B, b). */
  readonly geradeUngerade: boolean;
  /** Linienende (0 stumpf), Ecke (0 spitz), Gehrungsgrenze, Phase der Strichelung beim Malvorgang. */
  readonly cap: number;
  readonly join: number;
  readonly miter: number;
  readonly dashPhase: number;
  /** |det| der CTM beim Malvorgang. */
  readonly det: number;
}

export interface BildEreignis {
  readonly art: 'bild';
  readonly seite: number;
}

export type Ereignis = TextEreignis | PfadEreignis | BildEreignis;

interface Zustand {
  ctm: Matrix;
  cap: number;
  join: number;
  miter: number;
  dashPhase: number;
  tc: number;
  tw: number;
  tz: number;
}

function mal(m: Matrix, n: Matrix): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function punkt(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

function alsMatrix(wert: unknown): Matrix | null {
  if (wert === null || typeof wert !== 'object' || !('length' in wert)) return null;
  const l = Array.from(wert as ArrayLike<unknown>);
  if (l.length !== 6 || !l.every((v) => typeof v === 'number')) return null;
  const [a, b, c, d, e, f] = l as number[];
  return [a ?? 0, b ?? 0, c ?? 0, d ?? 0, e ?? 0, f ?? 0];
}

function zahl(wert: unknown, ersatz: number): number {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : ersatz;
}

const STRICH = new Set<number>([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);
const FLAECHE = new Set<number>([
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);
const GERADE_UNGERADE = new Set<number>([OPS.eoFill, OPS.eoFillStroke, OPS.closeEOFillStroke]);
const BILD = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageXObjectRepeat,
]);

/** Ereignisse aller Seiten in Zeichenreihenfolge. */
export async function ereignisse(bytes: Uint8Array): Promise<Ereignis[]> {
  const aufgabe = getDocument({
    data: new Uint8Array(bytes),
    verbosity: 0,
    fontExtraProperties: true,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
  });
  const aus: Ereignis[] = [];
  try {
    const pdf = await aufgabe.promise;
    for (let n = 1; n <= pdf.numPages; n++) {
      const s = await pdf.getPage(n);
      const ansicht = alsMatrix(s.getViewport({ scale: 1 }).transform) ?? IDENTITAET;
      const liste = await s.getOperatorList({ annotationMode: AnnotationMode.DISABLE });
      let z: Zustand = {
        ctm: IDENTITAET,
        // Linienende, Ecke und Gehrungsgrenze unbekannt, bis das PDF sie setzt (V04: ausdrücklich gesetzt).
        cap: Number.NaN,
        join: Number.NaN,
        miter: Number.NaN,
        dashPhase: 0,
        tc: 0,
        tw: 0,
        tz: 100,
      };
      const stapel: Zustand[] = [];
      for (let i = 0; i < liste.fnArray.length; i++) {
        const fn = liste.fnArray[i];
        const roh = liste.argsArray[i];
        const args: unknown[] = Array.isArray(roh) ? roh : [];
        switch (fn) {
          case OPS.save:
            stapel.push({ ...z });
            break;
          case OPS.restore:
            z = stapel.pop() ?? z;
            break;
          case OPS.transform: {
            const m = alsMatrix(args);
            if (m !== null) z.ctm = mal(z.ctm, m);
            break;
          }
          case OPS.setLineCap:
            z.cap = zahl(args[0], z.cap);
            break;
          case OPS.setLineJoin:
            z.join = zahl(args[0], z.join);
            break;
          case OPS.setMiterLimit:
            z.miter = zahl(args[0], z.miter);
            break;
          case OPS.setDash:
            z.dashPhase = zahl(args[1], 0);
            break;
          case OPS.setGState:
            for (const eintrag of Array.isArray(args[0]) ? args[0] : []) {
              if (!Array.isArray(eintrag)) continue;
              const [k, v]: unknown[] = eintrag;
              if (k === 'LC') z.cap = zahl(v, z.cap);
              if (k === 'LJ') z.join = zahl(v, z.join);
              if (k === 'ML') z.miter = zahl(v, z.miter);
              if (k === 'D' && Array.isArray(v)) z.dashPhase = zahl(v[1], 0);
            }
            break;
          case OPS.setCharSpacing:
            z.tc = zahl(args[0], 0);
            break;
          case OPS.setWordSpacing:
            z.tw = zahl(args[0], 0);
            break;
          case OPS.setHScale:
            z.tz = zahl(args[0], 100);
            break;
          case OPS.showText: {
            const glyphen = Array.isArray(args[0]) ? args[0] : [];
            let t = '';
            for (const g of glyphen) {
              if (g !== null && typeof g === 'object' && 'unicode' in g) {
                const u: unknown = g.unicode;
                if (typeof u === 'string') t += u;
              }
            }
            aus.push({ art: 'text', seite: n, text: t, tc: z.tc, tw: z.tw, tz: z.tz });
            break;
          }
          case OPS.constructPath: {
            const malart = typeof args[0] === 'number' ? args[0] : -1;
            const strich = STRICH.has(malart);
            const flaeche = FLAECHE.has(malart);
            if (!strich && !flaeche) break;
            const huelle = Array.isArray(args[1]) ? args[1] : [];
            const daten: unknown = huelle[0];
            if (daten === null || typeof daten !== 'object' || !('length' in daten)) break;
            const d = daten as ArrayLike<number>;
            const punkte: [number, number][] = [];
            let geschlossen = false;
            const gesamt = mal(ansicht, z.ctm);
            let k = 0;
            while (k < d.length) {
              const op = d[k];
              if (op === 0 || op === 1) {
                punkte.push(punkt(gesamt, zahl(d[k + 1], 0), zahl(d[k + 2], 0)));
                k += 3;
              } else if (op === 2) {
                punkte.push(punkt(gesamt, zahl(d[k + 5], 0), zahl(d[k + 6], 0)));
                k += 7;
              } else if (op === 3) {
                punkte.push(punkt(gesamt, zahl(d[k + 3], 0), zahl(d[k + 4], 0)));
                k += 5;
              } else if (op === 4) {
                geschlossen = true;
                k += 1;
              } else {
                break;
              }
            }
            const det = Math.abs(z.ctm[0] * z.ctm[3] - z.ctm[1] * z.ctm[2]);
            aus.push({
              art: 'pfad',
              seite: n,
              punkte,
              geschlossen,
              strich,
              flaeche,
              geradeUngerade: GERADE_UNGERADE.has(malart),
              cap: z.cap,
              join: z.join,
              miter: z.miter,
              dashPhase: z.dashPhase,
              det,
            });
            break;
          }
          default:
            if (fn !== undefined && BILD.has(fn)) aus.push({ art: 'bild', seite: n });
        }
      }
    }
    return aus;
  } finally {
    await aufgabe.destroy();
  }
}

/** Nur die Pfad-Ereignisse. */
export function pfade(e: readonly Ereignis[]): PfadEreignis[] {
  return e.filter((x): x is PfadEreignis => x.art === 'pfad');
}

/** Nur die Text-Ereignisse. */
export function texte(e: readonly Ereignis[]): TextEreignis[] {
  return e.filter((x): x is TextEreignis => x.art === 'text');
}
