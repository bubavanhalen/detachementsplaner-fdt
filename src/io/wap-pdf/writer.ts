// PDF-Schreiber: Seitenmodell → PDF (Vertrag E1-02c Abschnitt 2; ADR-005; Leitplanken 2 und 4).
// Vektoriell, Text als Text mit ToUnicode, Arimo als Teilmenge eingebettet, deterministisch.

import {
  appendBezierCurve,
  beginText,
  closePath,
  concatTransformationMatrix,
  drawObject,
  endText,
  fillAndStroke,
  LineCapStyle,
  LineJoinStyle,
  lineTo,
  moveTo,
  PDFDocument,
  type PDFFont,
  type PDFImage,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames,
  type PDFPage,
  popGraphicsState,
  pushGraphicsState,
  setDashPattern,
  setFillingRgbColor,
  setFontAndSize,
  setLineCap,
  setLineJoin,
  setLineWidth,
  setStrokingRgbColor,
  setTextMatrix,
  showText,
  fill as zeichneFlaeche,
  stroke as zeichneStrich,
} from 'pdf-lib';
import { fontBytes } from '../../assets/wap-fonts/index';
import { type UserMessage, WapError } from '../../model/wap/errors';
import {
  type ImageItem,
  type PageModel,
  type Rect,
  STRIKE_EM,
  type Stroke,
  type TextItem,
} from '../../model/wap/layout/pageModel';
import { measureRuns } from '../../model/wap/layout/text/measure';
import type { FontWeight } from '../../model/wap/layout/text/types';
import type { Rgb } from '../../model/wap/types';
import { createFontkitAdapter, type FontkitModule } from './fontkitAdapter';
import { sanitizeImageBytes } from './imageBytes';
import { firstMissingGlyph, invalidItemProblem, pageSizeValid } from './itemCheck';
import { type PathSegment, parsePathData } from './pathData';

export interface PdfWriteInput {
  /** Seiten in Ausgabereihenfolge; mindestens eine. */
  readonly pages: readonly PageModel[];
  /** Info-Feld `Title` (Dateinamen-Konvention ohne `.pdf`, ADR-005 Punkt 3). */
  readonly title: string;
}

/**
 * 'fontLoad': Schrift oder fontkit nicht lesbar; 'invalidItem': ungültige Eingabe (Vertrag §2.4 und
 * Änderungsnotiz Vertragsprüfung V01, V13); 'missingGlyph': Zeichen ohne Glyphe im Schnitt seines Laufs.
 */
export type PdfWriteErrorCode = 'fontLoad' | 'invalidItem' | 'missingGlyph';

export interface PdfWriteErrorDetails {
  /** Index der Seite in `pages` (0-basiert). */
  readonly pageIndex?: number;
  /** Index des Elements in `page.items` (0-basiert). */
  readonly itemIndex?: number;
  /** Bei 'missingGlyph' und bei 'invalidItem' wegen eines gesperrten Codepunkts: das erste solche Zeichen. */
  readonly character?: string;
}

/**
 * Verbindliche Meldungstexte (Änderungsnotiz Vertragsprüfung V07). In `missingGlyph.cause` ersetzt der Schreiber
 * `{zeichen}` durch das Zeichen und `{code}` durch «U+» und mindestens vier hexadezimale Grossbuchstaben
 * (z.B. «U+2713», «U+1F600»); die Guillemets um `{zeichen}` gehören zum Text (Runde 2 V20). Beispiel:
 * «Der Plan enthält das Zeichen «✓» (U+2713), das die Schrift des WAP-Planers nicht darstellen kann.»
 */
export const PDF_WRITE_MESSAGES: { readonly [C in PdfWriteErrorCode]: UserMessage } = {
  invalidItem: {
    cause: 'Das PDF konnte nicht erzeugt werden, weil ein Element der Seite ungültig ist.',
    nextStep:
      'Den WAP-Planer neu laden und das PDF erneut erzeugen. Bleibt der Fehler, die zuletzt geänderten Einträge prüfen.',
  },
  missingGlyph: {
    cause:
      'Der Plan enthält das Zeichen «{zeichen}» ({code}), das die Schrift des WAP-Planers nicht darstellen kann.',
    nextStep: 'Das Zeichen im betroffenen Eintrag ersetzen und das PDF erneut erzeugen.',
  },
  fontLoad: {
    cause: 'Die Schrift für das PDF konnte nicht geladen werden.',
    nextStep: 'Seite neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.',
  },
};

/** Fehler des PDF-Schreibers mit Fundstelle (Vertrag E1-02c Abschnitt 2.4). */
export class PdfWriteError extends WapError {
  declare readonly code: PdfWriteErrorCode;
  readonly pageIndex: number | null;
  readonly itemIndex: number | null;
  readonly character: string | null;

  constructor(
    code: PdfWriteErrorCode,
    userMessage: UserMessage,
    details?: PdfWriteErrorDetails,
    options?: { cause?: unknown },
  ) {
    super(code, userMessage, options);
    this.pageIndex = details?.pageIndex ?? null;
    this.itemIndex = details?.itemIndex ?? null;
    this.character = details?.character ?? null;
  }
}

// ---------------------------------------------------------------- Fehler

/** `invalidItem` mit Fundstelle nach Vertragsprüfung V07 (null-Werte entfallen). */
function ungueltig(
  pageIndex: number | null,
  itemIndex: number | null,
  character: string | null = null,
): PdfWriteError {
  return new PdfWriteError('invalidItem', PDF_WRITE_MESSAGES.invalidItem, {
    ...(pageIndex === null ? {} : { pageIndex }),
    ...(itemIndex === null ? {} : { itemIndex }),
    ...(character === null ? {} : { character }),
  });
}

/** «U+» und mindestens vier hexadezimale Grossbuchstaben (V07). */
function codeVon(zeichen: string): string {
  return `U+${(zeichen.codePointAt(0) as number).toString(16).toUpperCase().padStart(4, '0')}`;
}

/** `missingGlyph` mit dem Zeichen in der Meldung (V20). */
function fehlendeGlyphe(pageIndex: number, itemIndex: number, character: string): PdfWriteError {
  const vorlage = PDF_WRITE_MESSAGES.missingGlyph;
  const cause = vorlage.cause
    .replace('{zeichen}', () => character)
    .replace('{code}', () => codeVon(character));
  return new PdfWriteError(
    'missingGlyph',
    { cause, nextStep: vorlage.nextStep },
    { pageIndex, itemIndex, character },
  );
}

function schriftFehler(cause: unknown): PdfWriteError {
  return new PdfWriteError('fontLoad', PDF_WRITE_MESSAGES.fontLoad, {}, { cause });
}

// ---------------------------------------------------------------- Eingabeprüfung

/** Eingebettete Bilder je Seite (Schlüssel: Index in `items`). */
type Bilder = readonly ReadonlyMap<number, PDFImage>[];

/**
 * Bettet das bereinigte Bild ein und schreibt es sofort in den Kontext (`embed()`), damit jeder Fehler hier
 * als nicht lesbares Bild mit Fundstelle erscheint und nicht erst beim Speichern (CR-E102c-05); `null`, wenn
 * es nicht lesbar ist (V13, V17, V18).
 */
async function bettBildEin(doc: PDFDocument, item: ImageItem): Promise<PDFImage | null> {
  const sauber = sanitizeImageBytes(item.mime, item.bytes);
  if (sauber === null) return null;
  try {
    const bild =
      item.mime === 'image/png' ? await doc.embedPng(sauber) : await doc.embedJpg(sauber);
    await bild.embed();
    return bild;
  } catch {
    return null;
  }
}

/**
 * Prüft die ganze Eingabe vor dem Laden der Schrift (§2.4): zuerst `pages` leer, dann je Seite die Grösse
 * und die Elemente in Reihenfolge, je Element zuerst `invalidItem`, dann `missingGlyph`. Bilder werden dabei
 * bereinigt und eingebettet, weil erst pdf-lib zeigt, ob sie lesbar sind (V13).
 */
async function pruefe(doc: PDFDocument, pages: readonly PageModel[]): Promise<Bilder> {
  if (pages.length === 0) throw ungueltig(null, null);
  const bilder: Map<number, PDFImage>[] = [];
  for (const [pi, page] of pages.entries()) {
    if (!pageSizeValid(page)) throw ungueltig(pi, null);
    const seitenBilder = new Map<number, PDFImage>();
    for (const [ii, item] of page.items.entries()) {
      const problem = invalidItemProblem(item);
      if (problem !== null) throw ungueltig(pi, ii, problem.character);
      if (item.kind === 'image') {
        const bild = await bettBildEin(doc, item);
        if (bild === null) throw ungueltig(pi, ii);
        seitenBilder.set(ii, bild);
      } else if (item.kind === 'text') {
        const fehlt = firstMissingGlyph(item);
        if (fehlt !== null) throw fehlendeGlyphe(pi, ii, fehlt);
      }
    }
    bilder.push(seitenBilder);
  }
  return bilder;
}

// ---------------------------------------------------------------- Schriften

const SCHNITTE: readonly FontWeight[] = ['regular', 'bold'];
const SCHRIFTNAME: { readonly [W in FontWeight]: string } = {
  regular: 'Arimo',
  bold: 'Arimo-Bold',
};
/** Feste Namen in den Seitenressourcen (ohne Zufallszusatz von pdf-lib). */
const SCHRIFT_RESSOURCE: { readonly [W in FontWeight]: PDFName } = {
  regular: PDFName.of('WapArimo'),
  bold: PDFName.of('WapArimoBold'),
};

type Schriften = { readonly [W in FontWeight]?: PDFFont };

/** Codepunkte aller gezeichneten Läufe je Schnitt im Dokument. */
function codepunkteJeSchnitt(pages: readonly PageModel[]): { [W in FontWeight]: Set<number> } {
  const mengen = { regular: new Set<number>(), bold: new Set<number>() };
  for (const page of pages) {
    for (const item of page.items) {
      if (item.kind !== 'text') continue;
      for (const r of item.runs) {
        for (const z of r.text) mengen[r.weight].add(z.codePointAt(0) as number);
      }
    }
  }
  return mengen;
}

/**
 * Teilmengen-Präfix (§2.3 Nr 6, V12): sechs Buchstaben A–Z aus der Codepunktmenge (FNV-1a über drei Bytes je
 * Codepunkt, aufsteigend, ohne Doppelte). Hängt nur von der Menge ab, nicht von Reihenfolge oder Anzahl.
 */
function praefix(menge: ReadonlySet<number>): string {
  let h = 0x811c9dc5;
  for (const cp of [...menge].sort((a, b) => a - b)) {
    for (const byte of [(cp >> 16) & 0xff, (cp >> 8) & 0xff, cp & 0xff]) {
      h = Math.imul(h ^ byte, 0x01000193) >>> 0;
    }
  }
  let tag = '';
  for (let i = 0; i < 6; i++) {
    tag += String.fromCharCode(65 + (h % 26));
    h = Math.floor(h / 26);
  }
  return tag;
}

/**
 * Lädt fontkit (erst hier, ADR-001) und bettet je verwendetem Schnitt Arimo als Teilmenge ein (§2.3 Nr 6).
 * Ohne Text wird nichts geladen. Jeder Aufruf lädt neu; nach einem Fehler bleibt kein Zustand (V13).
 */
async function bettSchriftenEin(doc: PDFDocument, pages: readonly PageModel[]): Promise<Schriften> {
  const mengen = codepunkteJeSchnitt(pages);
  const benoetigt = SCHNITTE.filter((w) => mengen[w].size > 0);
  if (benoetigt.length === 0) return {};
  let fontkit: FontkitModule;
  try {
    fontkit = await import('fontkit');
  } catch (e: unknown) {
    throw schriftFehler(e);
  }
  doc.registerFontkit(createFontkitAdapter(fontkit));
  const schriften: { [W in FontWeight]?: PDFFont } = {};
  for (const w of benoetigt) {
    try {
      schriften[w] = await doc.embedFont(fontBytes(w), {
        subset: true,
        customName: `${praefix(mengen[w])}+${SCHRIFTNAME[w]}`,
      });
    } catch (e: unknown) {
      throw schriftFehler(e);
    }
  }
  return schriften;
}

// ---------------------------------------------------------------- Zeichnen

/** Gehrungsgrenze in PDF und SVG (V04); pdf-lib hat dafür keine eigene Funktion. */
const GEHRUNGSGRENZE = PDFOperator.of(PDFOperatorNames.SetLineMiterLimit, [PDFNumber.of(10)]);

/** Farbanteile für DeviceRGB (r/255, g/255, b/255). */
function anteile(c: Rgb): [number, number, number] {
  return [c.r / 255, c.g / 255, c.b / 255];
}

/** Strichzustand nach `Stroke`: Breite, stumpfe Enden, spitze Ecken, Gehrungsgrenze 10, Strichelung Phase 0. */
function strichZustand(s: Stroke): PDFOperator[] {
  return [
    setLineWidth(s.widthPt),
    setLineCap(LineCapStyle.Butt),
    setLineJoin(LineJoinStyle.Miter),
    GEHRUNGSGRENZE,
    setDashPattern(s.dash === null ? [] : [...s.dash], 0),
    setStrokingRgbColor(...anteile(s.color)),
  ];
}

/**
 * Ein Malvorgang (§2.3 Nr 2, 3): Fläche und Rahmen zusammen (Füllen, dann Strich), Füllregel nonzero, in
 * q … Q gekapselt; Koordinaten bereits im PDF-Raum, die CTM bleibt unverändert (P-9).
 */
function malvorgang(
  pfad: readonly PDFOperator[],
  flaeche: Rgb | null,
  strich: Stroke | null,
): PDFOperator[] {
  if (flaeche === null && strich === null) return [];
  const ops = [pushGraphicsState()];
  if (strich !== null) ops.push(...strichZustand(strich));
  if (flaeche !== null) ops.push(setFillingRgbColor(...anteile(flaeche)));
  ops.push(...pfad);
  if (flaeche !== null && strich !== null) ops.push(fillAndStroke());
  else ops.push(flaeche === null ? zeichneStrich() : zeichneFlaeche());
  ops.push(popGraphicsState());
  return ops;
}

/** Rechteck als Pfad ab oben links im Uhrzeigersinn (V04). */
function rechteckPfad(r: Rect, hoehe: number): PDFOperator[] {
  return [
    moveTo(r.x, hoehe - r.y),
    lineTo(r.x + r.w, hoehe - r.y),
    lineTo(r.x + r.w, hoehe - (r.y + r.h)),
    lineTo(r.x, hoehe - (r.y + r.h)),
    closePath(),
  ];
}

/** Pfadsegmente (Seitenraum, y nach unten) als PDF-Operatoren. */
function segmentPfad(segmente: readonly PathSegment[], hoehe: number): PDFOperator[] {
  return segmente.map((s) => {
    const v = (i: number) => s.values[i] as number;
    switch (s.cmd) {
      case 'M':
        return moveTo(v(0), hoehe - v(1));
      case 'L':
        return lineTo(v(0), hoehe - v(1));
      case 'C':
        return appendBezierCurve(v(0), hoehe - v(1), v(2), hoehe - v(3), v(4), hoehe - v(5));
      default:
        return closePath();
    }
  });
}

/** Leserichtung, Oberlängenseite (Bildschirmraum) und Textmatrix je Drehung (§1, §2.3 Nr 4, 5). */
const DREHUNG: {
  readonly [R in TextItem['rotation']]: {
    readonly richtung: readonly [number, number];
    readonly oben: readonly [number, number];
    readonly matrix: readonly [number, number, number, number];
  };
} = {
  0: { richtung: [1, 0], oben: [0, -1], matrix: [1, 0, 0, 1] },
  90: { richtung: [0, -1], oben: [-1, 0], matrix: [0, 1, -1, 0] },
  270: { richtung: [0, 1], oben: [1, 0], matrix: [0, -1, 1, 0] },
};

/**
 * Eine Zeile: je Lauf eine Textanzeige (Schnitt, Grösse, Farbe, Drehung, ohne Tc/Tw/Tz), Lauf k um die Summe
 * der Breiten der vorherigen Läufe versetzt; leere Läufe ohne Text und Strich; Durchstreichung als Linie
 * unmittelbar nach dem Lauf (§2.3 Nr 4, 5, V11).
 */
function zeile(item: TextItem, hoehe: number, schriften: Schriften): PDFOperator[] {
  const ops: PDFOperator[] = [];
  const { richtung, oben, matrix } = DREHUNG[item.rotation];
  let versatz = 0;
  for (const r of item.runs) {
    const breite = measureRuns([r], item.sizePt);
    const schrift = schriften[r.weight];
    if (r.text !== '' && schrift !== undefined) {
      const x = item.x + versatz * richtung[0];
      const y = item.baselineY + versatz * richtung[1];
      ops.push(
        beginText(),
        setFontAndSize(SCHRIFT_RESSOURCE[r.weight], item.sizePt),
        setFillingRgbColor(...anteile(r.color)),
        setTextMatrix(...matrix, x, hoehe - y),
        showText(schrift.encodeText(r.text)),
        endText(),
      );
      if (r.strike === true) {
        const abstand = STRIKE_EM.center * item.sizePt;
        const x1 = x + abstand * oben[0];
        const y1 = y + abstand * oben[1];
        const linie = [
          moveTo(x1, hoehe - y1),
          lineTo(x1 + breite * richtung[0], hoehe - (y1 + breite * richtung[1])),
        ];
        const strich = { color: r.color, widthPt: STRIKE_EM.thickness * item.sizePt, dash: null };
        ops.push(...malvorgang(linie, null, strich));
      }
    }
    versatz += breite;
  }
  return ops;
}

/** Bild in `rect` (Seitenverhältnis nicht erhalten, V05). */
function bild(name: PDFName, r: Rect, hoehe: number): PDFOperator[] {
  return [
    pushGraphicsState(),
    concatTransformationMatrix(r.w, 0, 0, r.h, r.x, hoehe - (r.y + r.h)),
    drawObject(name),
    popGraphicsState(),
  ];
}

/** Zeichnet die Elemente einer Seite in der Reihenfolge von `items` (§2.3 Nr 2). */
function zeichneSeite(
  ziel: PDFPage,
  seite: PageModel,
  bilder: ReadonlyMap<number, PDFImage>,
  schriften: Schriften,
): void {
  const hoehe = seite.heightPt;
  const ops: PDFOperator[] = [];
  for (const [ii, item] of seite.items.entries()) {
    switch (item.kind) {
      case 'rect':
        ops.push(...malvorgang(rechteckPfad(item.rect, hoehe), item.fill, item.stroke));
        break;
      case 'line':
        ops.push(
          ...malvorgang(
            [moveTo(item.x1, hoehe - item.y1), lineTo(item.x2, hoehe - item.y2)],
            null,
            item.stroke,
          ),
        );
        break;
      case 'path':
        ops.push(
          ...malvorgang(segmentPfad(parsePathData(item.d) ?? [], hoehe), item.fill, item.stroke),
        );
        break;
      case 'image': {
        // Ohne Fläche ist nichts zu sehen; eine singuläre Matrix bliebe so aus dem Inhalt.
        const ref = bilder.get(ii)?.ref;
        if (ref === undefined || item.rect.w === 0 || item.rect.h === 0) break;
        const name = PDFName.of(`WapBild${String(ii)}`);
        ziel.node.setXObject(name, ref);
        ops.push(...bild(name, item.rect, hoehe));
        break;
      }
      default:
        for (const r of item.runs) {
          const schrift = schriften[r.weight];
          if (r.text !== '' && schrift !== undefined) {
            ziel.node.setFontDictionary(SCHRIFT_RESSOURCE[r.weight], schrift.ref);
          }
        }
        ops.push(...zeile(item, hoehe, schriften));
    }
  }
  // In Teilen übergeben, damit sehr volle Seiten die Grenze für Funktionsargumente nicht erreichen.
  for (let i = 0; i < ops.length; i += 4096) ziel.pushOperators(...ops.slice(i, i + 4096));
}

/**
 * Schreibt die Seiten als PDF (Regeln: Vertrag E1-02c Abschnitt 2.3). Gleiche Eingabe → gleiche Bytes
 * (R-L-01): feste Metadaten (nur Title, Producer, Creator), keine Uhr, kein Zufall, feste Ressourcennamen,
 * Speichern ohne Objektströme. fontkit wird erst im ersten Aufruf geladen (ADR-001, ADR-005 Punkt 2).
 * @throws PdfWriteError (als abgelehntes Promise) bei ungültiger Eingabe oder unlesbarer Schrift.
 */
export async function writePdf(input: PdfWriteInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create({ updateMetadata: false });
  const bilder = await pruefe(doc, input.pages);
  const schriften = await bettSchriftenEin(doc, input.pages);
  for (const [pi, seite] of input.pages.entries()) {
    const ziel = doc.addPage([seite.widthPt, seite.heightPt]);
    zeichneSeite(ziel, seite, bilder[pi] ?? new Map<number, PDFImage>(), schriften);
  }
  doc.setTitle(input.title);
  doc.setProducer('WAP-Planer');
  doc.setCreator('WAP-Planer');
  try {
    return await doc.save({
      useObjectStreams: false,
      addDefaultPage: false,
      updateFieldAppearances: false,
    });
  } catch (e: unknown) {
    // Bilder sind in `pruefe` bereits eingebettet (CR-E102c-05); beim Speichern entstehen nur noch die
    // Schriften samt Teilmenge (fontkit). Ein Fehler hier gilt darum als nicht lesbare Schrift.
    throw schriftFehler(e);
  }
}
