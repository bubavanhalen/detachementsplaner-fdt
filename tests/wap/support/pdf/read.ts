// Unabhängiger PDF-Leser für die Ebene-2-Prüfung (Paket E1-01b, R-H-19, ADR-010 §7.2).
// Vertrag: docs/wap-planer/plan/vertraege/E1-01.md §4, §9 Nr 4–5, präzisiert in E1-01b.md §2 und Notiz
// Runde 2 Nr 3–4. Liest nur das fertige PDF (pdfjs-dist 6.3.289, Operatorliste), nie das Layout-Modell;
// Rgb und Rect sind deshalb hier eigenständig definiert (strukturgleich mit src/model/wap/types.ts Rgb,
// E1-02a, und Rect aus E1-02c).
// Textläufe entstehen aus den Textoperatoren der Operatorliste (je Textanzeige ein Lauf, mit Text- und
// Grafikzustand wie der Canvas-Zeichner von pdfjs); die synthetischen Leerzeichen-Stücke von
// getTextContent (ADR-005) kommen so gar nicht vor. Nur löschbare TypeScript-Syntax: die Datei läuft auch
// über die Typentfernung von Node 24 (scripts/wap-gate/pdf-artefakte.mjs). Keine Konsolenausgabe
// (verbosity 0).
// Nachtrag (Vertrag E1-02e Abschnitt P, Änderungsnotiz in E1-01b.md): Reihenfolge der Textläufe
// (PdfTextRun.order) und Bildlagen (PdfInfo.imagePlacements).
import { AnnotationMode, getDocument, OPS } from 'pdfjs-dist/legacy/build/pdf.mjs';

/** Farbe mit Ganzzahlen 0–255. */
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Rechteck in pt, Ursprung oben links, y nach unten. */
export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface PdfTextRun {
  page: number;
  text: string;
  x: number;
  baselineY: number;
  width: number;
  sizePt: number;
  fontName: string;
  bold: boolean;
  color: Rgb;
  rotation: 0 | 90 | 270;
  /** Oberlänge und Unterlänge der Schrift in em (Unterlänge ≤ 0), wie von pdfjs geliefert; fehlt ein Wert, wirft readPdf (Vertrag E1-01b, Notiz Runde 2 Nr 4). */
  ascent: number;
  descent: number;
  /**
   * Zeichenreihenfolge im ganzen Dokument: gemeinsamer Zähler mit PdfStroke.order und den Bildlagen, streng
   * steigend; Läufe aus reinem Leerraum entfallen ohne Nummer (Vertrag E1-02e, P Nr 1).
   */
  order: number;
}

export interface PdfStroke {
  page: number;
  kind: 'line' | 'rect' | 'path';
  bbox: Rect;
  widthPt: number;
  dash: number[] | null;
  color: Rgb;
  fill: Rgb | null;
  order: number;
}

export interface PdfInfo {
  pages: { widthPt: number; heightPt: number }[];
  texts: PdfTextRun[];
  strokes: PdfStroke[];
  fonts: { name: string; embedded: boolean; toUnicode: boolean; subtype: string }[];
  images: number;
  /**
   * Je Bildoperation eine Lage: Einheitsquadrat unter CTM und Ansicht, Ursprung oben links; page ab 1; Länge
   * gleich `images` (Vertrag E1-02e, P Nr 2).
   */
  imagePlacements: { page: number; bbox: Rect; order: number }[];
  metadata: Record<string, string | null>;
}

/** Affine Matrix [a, b, c, d, e, f] wie in PDF und Canvas. */
type Matrix = readonly [number, number, number, number, number, number];

const IDENTITAET: Matrix = [1, 0, 0, 1, 0, 0];
const SCHWARZ: Rgb = { r: 0, g: 0, b: 0 };
/** Grenze für «rechtwinklig» und «ohne Scherung» (relativ zur Matrixgrösse). */
const EPS = 1e-6;

/** Glyphe der Operatorliste (showText); Zahlen sind Abstände in tausendstel em. */
interface Glyphe {
  readonly unicode?: string;
  readonly width?: number;
  readonly isSpace?: boolean;
}

/** Felder des Schriftobjekts von pdfjs, die der Leser auswertet (mit fontExtraProperties). */
interface Schrift {
  readonly name?: string;
  readonly loadedName?: string;
  readonly ascent?: number;
  readonly descent?: number;
  readonly missingFile?: boolean;
  readonly fontMatrix?: readonly number[];
  readonly type?: string;
  readonly subtype?: string;
  readonly toUnicode?: unknown;
}

/** Grafik- und Textzustand (PDF 32000-1, 8.4 und 9.3). */
interface Zustand {
  ctm: Matrix;
  fill: Rgb;
  stroke: Rgb;
  lineWidth: number;
  dash: number[];
  schrift: Schrift | null;
  groesse: number;
  zeichenAbstand: number;
  wortAbstand: number;
  hSkala: number;
  zeilenAbstand: number;
  hebung: number;
}

/** Textlage innerhalb von BT … ET (Textraum vor der Textmatrix). */
interface TextLage {
  tm: Matrix;
  x: number;
  y: number;
  zeileX: number;
  zeileY: number;
}

/** Verknüpfung: erst `n`, dann `m` (Canvas-Semantik von transform). */
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
  const liste = Array.from(wert as ArrayLike<unknown>);
  const [a, b, c, d, e, f] = liste;
  if (
    liste.length !== 6 ||
    typeof a !== 'number' ||
    typeof b !== 'number' ||
    typeof c !== 'number' ||
    typeof d !== 'number' ||
    typeof e !== 'number' ||
    typeof f !== 'number'
  ) {
    return null;
  }
  return [a, b, c, d, e, f];
}

function zahl(wert: unknown, ersatz: number): number {
  return typeof wert === 'number' && Number.isFinite(wert) ? wert : ersatz;
}

function zahlen(wert: unknown): number[] {
  return Array.isArray(wert) ? wert.filter((v): v is number => typeof v === 'number') : [];
}

/** Farbe aus «#rrggbb» (pdfjs wandelt alle Farbräume im Worker in RGB-Hex) oder [r, g, b]. */
function farbe(wert: unknown): Rgb | null {
  if (typeof wert === 'string') {
    const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(wert);
    if (m === null) return null;
    return {
      r: Number.parseInt(m[1] ?? '0', 16),
      g: Number.parseInt(m[2] ?? '0', 16),
      b: Number.parseInt(m[3] ?? '0', 16),
    };
  }
  if (wert !== null && typeof wert === 'object' && 'length' in wert) {
    const [r, g, b] = Array.from(wert as ArrayLike<unknown>);
    if (typeof r === 'number' && typeof g === 'number' && typeof b === 'number') {
      return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
    }
  }
  return null;
}

/** Schriftname ohne Teilmengen-Präfix «ABCDEF+». */
function ohnePraefix(name: string): string {
  return name.replace(/^[A-Z]{6}\+/, '');
}

/** Hat die Schrift eine Unicode-Tabelle mit Einträgen (ToUnicode bzw. Kodierung, keine Identität)? */
function mitToUnicode(s: Schrift): boolean {
  const t = s.toUnicode;
  if (t === null || typeof t !== 'object' || !('_map' in t)) return false;
  const map: unknown = t._map;
  if (map === null || typeof map !== 'object') return false;
  return Object.values(map).some((v) => typeof v === 'string' && v !== '');
}

/** Drehung der Textmatrix gegen den Uhrzeigersinn im PDF-Raum; wirft bei anderen Lagen (§9 Nr 5). */
function drehung(m: Matrix): 0 | 90 | 270 {
  const [a, b, c, d] = m;
  const grad = (Math.atan2(b, a) * 180) / Math.PI;
  const normiert = ((Math.round(grad) % 360) + 360) % 360;
  const l1 = Math.hypot(a, b);
  const l2 = Math.hypot(c, d);
  const gross = Math.max(l1, l2, Number.MIN_VALUE);
  const rechtwinklig = Math.abs(a * c + b * d) <= EPS * gross * gross;
  const gleich = Math.abs(l1 - l2) <= EPS * gross;
  const gespiegelt = a * d - b * c <= 0;
  const viertel = Math.round(grad / 90);
  const aufViertel = Math.abs(grad - viertel * 90) <= 1e-6;
  const lage = ((viertel % 4) + 4) % 4;
  if (rechtwinklig && gleich && !gespiegelt && aufViertel) {
    if (lage === 0) return 0;
    if (lage === 1) return 90;
    if (lage === 3) return 270;
  }
  throw new Error(`PDF-Text mit nicht unterstützter Drehung: ${String(normiert)}`);
}

/** Extremwerte einer kubischen Bézierkurve je Achse (Endpunkte und Nullstellen der Ableitung). */
function bezierWerte(p0: number, p1: number, p2: number, p3: number): number[] {
  const werte = [p0, p3];
  const a = -p0 + 3 * p1 - 3 * p2 + p3;
  const b = 2 * (p0 - 2 * p1 + p2);
  const c = p1 - p0;
  const ts: number[] = [];
  if (Math.abs(a) < 1e-12) {
    if (Math.abs(b) > 1e-12) ts.push(-c / b);
  } else {
    const disk = b * b - 4 * a * c;
    if (disk >= 0) {
      const w = Math.sqrt(disk);
      ts.push((-b + w) / (2 * a), (-b - w) / (2 * a));
    }
  }
  for (const t of ts) {
    if (t > 0 && t < 1) {
      const u = 1 - t;
      werte.push(u * u * u * p0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * p3);
    }
  }
  return werte;
}

/** Ausgewerteter Pfad: Grenzen im Seitenraum (PDF, y nach oben) und Art. */
interface Pfad {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  art: 'line' | 'rect' | 'path';
}

/** Vier Ecken, geschlossen, Kanten abwechselnd waagrecht und senkrecht (im Seitenraum). */
function istRechteck(roh: [number, number][], geschlossen: boolean): boolean {
  const ecken = [...roh];
  const erste = ecken[0];
  const letzte = ecken[ecken.length - 1];
  const gleich = (p: [number, number], q: [number, number]) =>
    Math.abs(p[0] - q[0]) <= 1e-6 && Math.abs(p[1] - q[1]) <= 1e-6;
  let zu = geschlossen;
  if (ecken.length === 5 && erste !== undefined && letzte !== undefined && gleich(erste, letzte)) {
    ecken.pop();
    zu = true;
  }
  if (!zu || ecken.length !== 4) return false;
  let waagrecht = 0;
  let senkrecht = 0;
  for (let k = 0; k < 4; k++) {
    const p = ecken[k];
    const q = ecken[(k + 1) % 4];
    if (p === undefined || q === undefined) return false;
    const dx = Math.abs(p[0] - q[0]);
    const dy = Math.abs(p[1] - q[1]);
    if (dy <= 1e-6 && dx > 1e-6) waagrecht += 1;
    else if (dx <= 1e-6 && dy > 1e-6) senkrecht += 1;
    else return false;
  }
  return waagrecht === 2 && senkrecht === 2;
}

/**
 * Wertet die Pfaddaten von constructPath aus (DrawOPS: 0 moveTo, 1 lineTo, 2 curveTo, 3 quadraticCurveTo,
 * 4 closePath); Koordinaten werden mit der CTM in den Seitenraum gebracht. Ein moveTo ohne folgendes
 * Segment (z.B. zwei moveTo hintereinander bei pdf-lib drawLine) zeichnet nichts und entfällt.
 */
function pfad(daten: ArrayLike<number>, ctm: Matrix): Pfad | null {
  const xs: number[] = [];
  const ys: number[] = [];
  const ecken: [number, number][] = [];
  let teilpfade = 0;
  let kurven = false;
  let geschlossen = false;
  let letzter: [number, number] = [0, 0];
  let nurStart = false;
  const an = (k: number) => zahl(daten[k], 0);
  const leererStartWeg = () => {
    if (!nurStart) return;
    xs.pop();
    ys.pop();
    ecken.pop();
    teilpfade -= 1;
    nurStart = false;
  };
  let i = 0;
  while (i < daten.length) {
    const op = daten[i];
    if (op === 0 || op === 1) {
      if (op === 0) leererStartWeg();
      const p = punkt(ctm, an(i + 1), an(i + 2));
      xs.push(p[0]);
      ys.push(p[1]);
      if (op === 0) teilpfade += 1;
      nurStart = op === 0;
      ecken.push(p);
      letzter = p;
      i += 3;
    } else if (op === 2 || op === 3) {
      nurStart = false;
      kurven = true;
      const start = letzter;
      let k1: [number, number];
      let k2: [number, number];
      let ende: [number, number];
      if (op === 2) {
        k1 = punkt(ctm, an(i + 1), an(i + 2));
        k2 = punkt(ctm, an(i + 3), an(i + 4));
        ende = punkt(ctm, an(i + 5), an(i + 6));
        i += 7;
      } else {
        // Quadratische Kurve als kubische (Kontrollpunkte auf zwei Dritteln).
        const k = punkt(ctm, an(i + 1), an(i + 2));
        ende = punkt(ctm, an(i + 3), an(i + 4));
        k1 = [start[0] + (2 / 3) * (k[0] - start[0]), start[1] + (2 / 3) * (k[1] - start[1])];
        k2 = [ende[0] + (2 / 3) * (k[0] - ende[0]), ende[1] + (2 / 3) * (k[1] - ende[1])];
        i += 5;
      }
      xs.push(...bezierWerte(start[0], k1[0], k2[0], ende[0]));
      ys.push(...bezierWerte(start[1], k1[1], k2[1], ende[1]));
      letzter = ende;
    } else if (op === 4) {
      geschlossen = true;
      i += 1;
    } else {
      return null;
    }
  }
  leererStartWeg();
  if (xs.length === 0) return null;
  const grenzen = {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
  if (!kurven && teilpfade === 1 && ecken.length === 2 && !geschlossen) {
    return { ...grenzen, art: 'line' };
  }
  if (!kurven && teilpfade === 1 && istRechteck(ecken, geschlossen)) {
    return { ...grenzen, art: 'rect' };
  }
  return { ...grenzen, art: 'path' };
}

/** Werte des Info-Wörterbuchs: Zeichenketten bleiben, Zahlen und Wahrheitswerte als Text. */
function metadaten(info: unknown): Record<string, string | null> {
  const aus: Record<string, string | null> = {};
  if (info === null || typeof info !== 'object') return aus;
  for (const [k, v] of Object.entries(info)) {
    if (typeof v === 'string') aus[k] = v;
    else if (v === null) aus[k] = null;
    else if (typeof v === 'number' || typeof v === 'boolean') aus[k] = String(v);
  }
  return aus;
}

const BILD_OPS = new Set<number>([
  OPS.paintImageXObject,
  OPS.paintInlineImageXObject,
  OPS.paintInlineImageXObjectGroup,
  OPS.paintImageXObjectRepeat,
  OPS.paintImageMaskXObject,
  OPS.paintImageMaskXObjectGroup,
  OPS.paintImageMaskXObjectRepeat,
  OPS.paintSolidColorImageMask,
]);

const STRICH_OPS = new Set<number>([
  OPS.stroke,
  OPS.closeStroke,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

const FUELL_OPS = new Set<number>([
  OPS.fill,
  OPS.eoFill,
  OPS.fillStroke,
  OPS.eoFillStroke,
  OPS.closeFillStroke,
  OPS.closeEOFillStroke,
]);

function startZustand(): Zustand {
  return {
    ctm: IDENTITAET,
    fill: SCHWARZ,
    stroke: SCHWARZ,
    lineWidth: 1,
    dash: [],
    schrift: null,
    groesse: 0,
    zeichenAbstand: 0,
    wortAbstand: 0,
    hSkala: 1,
    zeilenAbstand: 0,
    hebung: 0,
  };
}

function neueTextLage(tm: Matrix = IDENTITAET): TextLage {
  return { tm, x: 0, y: 0, zeileX: 0, zeileY: 0 };
}

/**
 * Sammelt Seiten, Läufe, Striche, Schriften und Bilder eines Dokuments. Ein gemeinsamer Zähler `reihenfolge`
 * nummeriert Striche, abgelegte Textläufe und Bildlagen in der Folge der Operatorlisten, Seite für Seite.
 */
class Sammler {
  readonly info: PdfInfo = {
    pages: [],
    texts: [],
    strokes: [],
    fonts: [],
    images: 0,
    imagePlacements: [],
    metadata: {},
  };
  private readonly schriften = new Set<string>();
  private reihenfolge = 0;

  /** Wertet die Operatorliste einer Seite aus. */
  seite(
    n: number,
    ansicht: Matrix,
    fnArray: readonly number[],
    argsArray: readonly unknown[],
    schriftVon: (id: string) => Schrift | null,
  ): void {
    let z = startZustand();
    const stapel: Zustand[] = [];
    let t = neueTextLage();
    const sichern = () => stapel.push({ ...z, dash: [...z.dash] });
    const verschiebe = (dx: number, dy: number) => {
      t.zeileX += dx;
      t.zeileY += dy;
      t.x = t.zeileX;
      t.y = t.zeileY;
    };
    for (let i = 0; i < fnArray.length; i++) {
      const fn = fnArray[i];
      const roh = argsArray[i];
      const args: unknown[] = Array.isArray(roh) ? roh : [];
      switch (fn) {
        case OPS.save:
        case OPS.beginGroup:
          sichern();
          break;
        case OPS.restore:
        case OPS.endGroup:
        case OPS.paintFormXObjectEnd:
          z = stapel.pop() ?? z;
          break;
        case OPS.paintFormXObjectBegin: {
          sichern();
          const m = alsMatrix(args[0]);
          if (m !== null) z.ctm = mal(z.ctm, m);
          break;
        }
        case OPS.transform: {
          const m = alsMatrix(args);
          if (m !== null) z.ctm = mal(z.ctm, m);
          break;
        }
        case OPS.setLineWidth:
          z.lineWidth = zahl(args[0], z.lineWidth);
          break;
        case OPS.setDash:
          z.dash = zahlen(args[0]);
          break;
        case OPS.setGState:
          for (const eintrag of Array.isArray(args[0]) ? args[0] : []) {
            if (!Array.isArray(eintrag)) continue;
            const [schluessel, wert]: unknown[] = eintrag;
            if (schluessel === 'LW') z.lineWidth = zahl(wert, z.lineWidth);
            if (schluessel === 'D' && Array.isArray(wert)) z.dash = zahlen(wert[0]);
          }
          break;
        case OPS.setFillRGBColor:
          z.fill = farbe(args[0]) ?? farbe(args) ?? z.fill;
          break;
        case OPS.setStrokeRGBColor:
          z.stroke = farbe(args[0]) ?? farbe(args) ?? z.stroke;
          break;
        case OPS.beginText:
          t = neueTextLage();
          break;
        case OPS.setTextMatrix: {
          const m = alsMatrix(args[0]) ?? alsMatrix(args);
          if (m !== null) t = neueTextLage(m);
          break;
        }
        case OPS.moveText:
          verschiebe(zahl(args[0], 0), zahl(args[1], 0));
          break;
        case OPS.setLeadingMoveText:
          z.zeilenAbstand = -zahl(args[1], 0);
          verschiebe(zahl(args[0], 0), zahl(args[1], 0));
          break;
        case OPS.setLeading:
          z.zeilenAbstand = zahl(args[0], 0);
          break;
        case OPS.nextLine:
          verschiebe(0, -z.zeilenAbstand);
          break;
        case OPS.setCharSpacing:
          z.zeichenAbstand = zahl(args[0], 0);
          break;
        case OPS.setWordSpacing:
          z.wortAbstand = zahl(args[0], 0);
          break;
        case OPS.setHScale:
          z.hSkala = zahl(args[0], 100) / 100;
          break;
        case OPS.setTextRise:
          z.hebung = zahl(args[0], 0);
          break;
        case OPS.setFont: {
          const id = typeof args[0] === 'string' ? args[0] : '';
          z.schrift = schriftVon(id);
          z.groesse = zahl(args[1], 0);
          if (z.schrift !== null) this.schrift(z.schrift, id);
          break;
        }
        case OPS.showText:
          this.text(n, ansicht, z, t, Array.isArray(args[0]) ? args[0] : []);
          break;
        case OPS.constructPath:
          this.pfad(n, ansicht, z, args);
          break;
        default:
          if (fn !== undefined && BILD_OPS.has(fn)) this.bild(n, ansicht, z);
      }
    }
  }

  private schrift(s: Schrift, id: string): void {
    const schluessel = s.loadedName ?? id;
    if (this.schriften.has(schluessel)) return;
    this.schriften.add(schluessel);
    this.info.fonts.push({
      name: ohnePraefix(s.name ?? ''),
      embedded: s.missingFile !== true,
      toUnicode: mitToUnicode(s),
      subtype: s.subtype ?? s.type ?? '',
    });
  }

  /** Ein Lauf je Textanzeige; schiebt die Textlage um den Vorschub weiter. */
  private text(n: number, ansicht: Matrix, z: Zustand, t: TextLage, glyphen: unknown[]): void {
    const s = z.schrift;
    const richtung = z.groesse < 0 ? -1 : 1;
    const groesse = Math.abs(z.groesse);
    const fm0 = zahl(s?.fontMatrix?.[0], 0.001);
    let vorschub = 0;
    let text = '';
    for (const g of glyphen) {
      if (typeof g === 'number') {
        vorschub -= (g * groesse) / 1000;
        continue;
      }
      if (g === null || typeof g !== 'object') continue;
      const glyphe: Glyphe = g;
      text += glyphe.unicode ?? '';
      const abstand = (glyphe.isSpace === true ? z.wortAbstand : 0) + z.zeichenAbstand;
      vorschub += zahl(glyphe.width, 0) * groesse * fm0 + abstand * richtung;
    }
    const breiteText = vorschub * z.hSkala * richtung;
    const startX = t.x;
    const startY = t.y + z.hebung;
    t.x += breiteText;
    // Läufe nur aus Leerraum entfallen (Vertrag E1-01b §2 «Prüfhilfen»).
    if (text.trim() === '' || s === null) return;
    const m = mal(z.ctm, t.tm);
    const rotation = drehung(m);
    const [x, baselineY] = punkt(mal(ansicht, m), startX, startY);
    const fontName = ohnePraefix(s.name ?? '');
    const { ascent, descent } = s;
    if (
      typeof ascent !== 'number' ||
      typeof descent !== 'number' ||
      !Number.isFinite(ascent) ||
      !Number.isFinite(descent)
    ) {
      throw new Error(`PDF-Schrift ohne Metrik: ${fontName}`);
    }
    const skala = Math.hypot(m[0], m[1]);
    this.reihenfolge += 1;
    this.info.texts.push({
      page: n,
      text,
      x,
      baselineY,
      width: Math.abs(breiteText) * skala,
      sizePt: groesse * skala,
      fontName,
      bold: /bold/i.test(fontName),
      color: z.fill,
      rotation,
      ascent,
      descent,
      order: this.reihenfolge,
    });
  }

  /**
   * Eine Bildoperation: zählt `images` und legt die Lage ab. Das Bild füllt das Einheitsquadrat unter der
   * aktuellen CTM; die bbox umschliesst alle vier Ecken in Seitenkoordinaten. Bei …Repeat/…Group eine Lage
   * mit der aktuellen CTM (Vertrag E1-02e, P Nr 2).
   */
  private bild(n: number, ansicht: Matrix, z: Zustand): void {
    const m = mal(ansicht, z.ctm);
    const ecken = [punkt(m, 0, 0), punkt(m, 1, 0), punkt(m, 0, 1), punkt(m, 1, 1)];
    const xs = ecken.map((p) => p[0]);
    const ys = ecken.map((p) => p[1]);
    const x = Math.min(...xs);
    const y = Math.min(...ys);
    this.reihenfolge += 1;
    this.info.images += 1;
    this.info.imagePlacements.push({
      page: n,
      bbox: { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y },
      order: this.reihenfolge,
    });
  }

  /** Gezeichneter Pfad (Strich und/oder Füllung); reine Clip-Pfade entfallen. */
  private pfad(n: number, ansicht: Matrix, z: Zustand, args: unknown[]): void {
    const art = typeof args[0] === 'number' ? args[0] : -1;
    const strich = STRICH_OPS.has(art);
    const fuellung = FUELL_OPS.has(art);
    if (!strich && !fuellung) return;
    const huelle = Array.isArray(args[1]) ? args[1] : [];
    const daten: unknown = huelle[0];
    if (daten === null || typeof daten !== 'object' || !('length' in daten)) return;
    const p = pfad(daten as ArrayLike<number>, z.ctm);
    if (p === null) return;
    const [x0, y0] = punkt(ansicht, p.minX, p.maxY);
    const [x1, y1] = punkt(ansicht, p.maxX, p.minY);
    const skala = Math.sqrt(Math.abs(z.ctm[0] * z.ctm[3] - z.ctm[1] * z.ctm[2]));
    this.reihenfolge += 1;
    this.info.strokes.push({
      page: n,
      kind: p.art,
      bbox: {
        x: Math.min(x0, x1),
        y: Math.min(y0, y1),
        w: Math.abs(x1 - x0),
        h: Math.abs(y1 - y0),
      },
      widthPt: strich ? z.lineWidth * skala : 0,
      dash: strich && z.dash.length > 0 ? z.dash.map((d) => d * skala) : null,
      color: strich ? z.stroke : z.fill,
      fill: fuellung ? z.fill : null,
      order: this.reihenfolge,
    });
  }
}

/**
 * Liest Text, Lage, Grössen, Schriften, Linien und Bildlagen; Koordinaten in pt, Ursprung oben links. Wirft
 * bei einer Seite mit /Rotate ≠ 0 «PDF-Seite <n> ist gedreht (/Rotate <grad>): …» (Vertrag E1-01b, Notiz
 * CR1 Nr 6).
 */
export async function readPdf(bytes: Uint8Array): Promise<PdfInfo> {
  const aufgabe = getDocument({
    data: new Uint8Array(bytes),
    verbosity: 0,
    fontExtraProperties: true,
    disableFontFace: true,
    useSystemFonts: false,
    stopAtErrors: true,
  });
  try {
    const pdf = await aufgabe.promise;
    const sammler = new Sammler();
    for (let n = 1; n <= pdf.numPages; n++) {
      const seite = await pdf.getPage(n);
      // Seiten-/Rotate (von pdfjs normalisiert, auch geerbt): Lage aus dem Viewport und Drehung aus der
      // Textmatrix passen dann nicht zusammen (CR-E101b-08). Gedrehter Text über die Textmatrix bleibt erlaubt.
      const drehung = seite.rotate;
      if (drehung !== 0) {
        throw new Error(
          `PDF-Seite ${String(n)} ist gedreht (/Rotate ${String(drehung)}): readPdf liest nur ungedrehte Seiten`,
        );
      }
      const ansicht = seite.getViewport({ scale: 1 });
      sammler.info.pages.push({ widthPt: ansicht.width, heightPt: ansicht.height });
      const liste = await seite.getOperatorList({ annotationMode: AnnotationMode.DISABLE });
      const schriftVon = (id: string): Schrift | null => {
        if (id === '' || !seite.commonObjs.has(id)) return null;
        const s: unknown = seite.commonObjs.get(id);
        return s !== null && typeof s === 'object' ? s : null;
      };
      sammler.seite(
        n,
        alsMatrix(ansicht.transform) ?? IDENTITAET,
        liste.fnArray,
        liste.argsArray,
        schriftVon,
      );
    }
    const meta = await pdf.getMetadata();
    sammler.info.metadata = metadaten(meta.info);
    return sammler.info;
  } finally {
    await aufgabe.destroy();
  }
}
