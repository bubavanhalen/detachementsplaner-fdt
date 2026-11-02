// Vergleicher Bildschirm ↔ PDF des Paritätstests von Paket E1-02f (R-5-01, Leitplanke 2; Vertrag E1-02f, Notiz
// «Ausarbeitung Schritt 2» Abschnitt G3 bis G9; ADR-004 Punkt 5; ADR-010 §7.4). Bildschirm: Messung aus
// messen-woche.ts; PDF: nur readPdf (E1-01b, ADR-010 §7.2). Seite k am Bildschirm (Container in DOM-Reihenfolge)
// entspricht Seite k + 1 im PDF. Parität heisst: die Liste der Abweichungen ist leer. `soll` (PDF) und `ist`
// (Bildschirm) enthalten nur Zahlen und Codes, bei `text` Länge und ersten abweichenden Codepunkt, nie Texte.
import { STRIKE_EM } from '../../../../src/model/wap/layout/pageModel';
import type { PdfInfo, PdfStroke, PdfTextRun, Rect } from '../../../wap/support/pdf/read';
import type { FormGemessen, LaufGemessen, Rechteck, SeiteGemessen } from './messen-woche';

export type AbweichungsArt =
  | 'anzahl'
  | 'text'
  | 'drehung'
  | 'lage'
  | 'groesse'
  | 'schnitt'
  | 'farbe'
  | 'strich'
  | 'form'
  | 'bild';

export type Klasse = 'seiten' | 'laeufe' | 'striche' | 'formen' | 'bilder';

export interface Abweichung {
  readonly art: AbweichungsArt;
  readonly klasse: Klasse;
  /** Seite ab 1 (PDF-Zählung); 0 bei der Klasse «seiten». */
  readonly seite: number;
  /** Index (ab 0) in der Klasse der Seite; −1 bei `anzahl`. */
  readonly index: number;
  readonly soll: string;
  readonly ist: string;
}

/** Toleranzen (Vertrag G4 [K], strenger als der Katalog): entlang der Schrift ± 0,05 pt, quer ± 0,15 pt. */
export const TOL_ENTLANG = 0.05;
export const TOL_QUER = 0.15;
/** Schriftgrösse ± 0,001 pt; Strichbreite und Strichelung ± 0,001 pt (G4, G6). */
export const TOL_GROESSE = 0.001;
export const TOL_STRICHBREITE = 0.001;
/** Umschliessendes Rechteck von Formen und Bildern ± 0,05 pt (G6). */
export const TOL_FORM = 0.05;
/** Zuordnung einer Durchstreichung: Dicke ± 0,01 pt, Länge ± 0,05 pt (G5). */
const TOL_STRICH_DICKE = 0.01;
const TOL_STRICH_LAENGE = 0.05;
/** «parallel zur Grundlinie»: Ausdehnung quer ≤ 0,01 pt. */
const TOL_PARALLEL = 0.01;

function z(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

function rgb(c: { readonly r: number; readonly g: number; readonly b: number }): string {
  return `rgb(${String(c.r)}, ${String(c.g)}, ${String(c.b)})`;
}

function codepunkt(s: string, i: number): string {
  const c = s.codePointAt(i);
  return c === undefined ? 'Ende' : `U+${c.toString(16).toUpperCase().padStart(4, '0')}`;
}

/** Länge und erster abweichender Codepunkt beider Texte (ohne Text des Plans). */
function textCodes(soll: string, ist: string): { soll: string; ist: string } {
  const a = [...soll];
  const b = [...ist];
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const pa = a.slice(0, i).join('').length;
  const pb = b.slice(0, i).join('').length;
  return {
    soll: `Länge ${String(a.length)}, ${codepunkt(soll, pa)}`,
    ist: `Länge ${String(b.length)}, ${codepunkt(ist, pb)}`,
  };
}

/** Einheitsvektor der Leserichtung je Drehung (G4). */
function richtung(rotation: number): { x: number; y: number } {
  if (rotation === 90) return { x: 0, y: -1 };
  if (rotation === 270) return { x: 0, y: 1 };
  return { x: 1, y: 0 };
}

/** Abweichung entlang und quer zwischen zwei Punkten bei Drehung `rotation`. */
function abstand(
  rotation: number,
  a: { x: number; y: number },
  b: { x: number; y: number },
): { entlang: number; quer: number } {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return rotation === 0 ? { entlang: dx, quer: dy } : { entlang: dy, quer: dx };
}

interface BildschirmLauf {
  readonly lauf: LaufGemessen;
  readonly drehung: number;
  readonly sizePt: number;
}

function sichtbareLaeufe(s: SeiteGemessen): BildschirmLauf[] {
  return s.zeilen.flatMap((zl) =>
    zl.laeufe
      .filter((l) => l.text.trim() !== '')
      .map((lauf) => ({ lauf, drehung: zl.drehung, sizePt: zl.schriftPx / 4 })),
  );
}

interface PdfStrich {
  readonly lauf: PdfTextRun;
  readonly strich: PdfStroke;
}

/** Durchstreichungen nach G5: Strich mit `order` direkt nach dem Lauf, gleicher Farbe, parallel, passender Dicke und Länge. */
function pdfStriche(laeufe: readonly PdfTextRun[], striche: readonly PdfStroke[]): PdfStrich[] {
  const nachOrder = new Map(striche.map((s) => [s.order, s]));
  const aus: PdfStrich[] = [];
  for (const t of laeufe) {
    const s = nachOrder.get(t.order + 1);
    if (s === undefined) continue;
    const quer = t.rotation === 0 ? s.bbox.h : s.bbox.w;
    const laenge = t.rotation === 0 ? s.bbox.w : s.bbox.h;
    if (
      s.color.r === t.color.r &&
      s.color.g === t.color.g &&
      s.color.b === t.color.b &&
      quer <= TOL_PARALLEL &&
      Math.abs(s.widthPt - STRIKE_EM.thickness * t.sizePt) <= TOL_STRICH_DICKE &&
      Math.abs(laenge - t.width) <= TOL_STRICH_LAENGE
    ) {
      aus.push({ lauf: t, strich: s });
    }
  }
  return aus;
}

function rechteckWeicht(a: Rechteck, b: Rect): number {
  return Math.max(
    Math.abs(a.x - b.x),
    Math.abs(a.y - b.y),
    Math.abs(a.w - b.w),
    Math.abs(a.h - b.h),
  );
}

type PdfForm =
  | { readonly art: 'pfad'; readonly s: PdfStroke }
  | { readonly art: 'bild'; readonly bbox: Rect };

function vergleicheLaeufe(
  seite: number,
  b: readonly BildschirmLauf[],
  p: readonly PdfTextRun[],
  aus: Abweichung[],
): void {
  if (b.length !== p.length) {
    aus.push({
      art: 'anzahl',
      klasse: 'laeufe',
      seite,
      index: -1,
      soll: String(p.length),
      ist: String(b.length),
    });
  }
  const n = Math.min(b.length, p.length);
  for (let i = 0; i < n; i++) {
    const bl = b[i] as BildschirmLauf;
    const t = p[i] as PdfTextRun;
    const neu = (art: AbweichungsArt, soll: string, ist: string) =>
      aus.push({ art, klasse: 'laeufe', seite, index: i, soll, ist });
    if (bl.lauf.text !== t.text) {
      const c = textCodes(t.text, bl.lauf.text);
      neu('text', c.soll, c.ist);
    }
    if (bl.drehung !== t.rotation) neu('drehung', String(t.rotation), String(bl.drehung));
    const r = richtung(t.rotation);
    const anfang = { x: t.x, y: t.baselineY };
    const ende = { x: t.x + r.x * t.width, y: t.baselineY + r.y * t.width };
    const a = abstand(t.rotation, anfang, bl.lauf.start);
    const e = abstand(t.rotation, ende, bl.lauf.ende);
    const entlang = Math.max(a.entlang, e.entlang);
    const quer = Math.max(a.quer, e.quer);
    if (entlang > TOL_ENTLANG || quer > TOL_QUER) {
      neu(
        'lage',
        `entlang ≤ ${z(TOL_ENTLANG)}, quer ≤ ${z(TOL_QUER)}`,
        `entlang ${z(entlang)}, quer ${z(quer)}`,
      );
    }
    if (Math.abs(bl.sizePt - t.sizePt) > TOL_GROESSE) neu('groesse', z(t.sizePt), z(bl.sizePt));
    const pdfFett = t.bold && t.fontName === 'Arimo-Bold';
    const pdfNormal = !t.bold && t.fontName === 'Arimo';
    const sollSchnitt = pdfFett
      ? '700'
      : pdfNormal
        ? '400'
        : `unbekannt (${t.bold ? 'fett' : 'normal'})`;
    if (bl.lauf.gewicht !== sollSchnitt) neu('schnitt', sollSchnitt, bl.lauf.gewicht);
    if (bl.lauf.farbe !== rgb(t.color)) neu('farbe', rgb(t.color), bl.lauf.farbe);
  }
}

function vergleicheStriche(
  seite: number,
  b: readonly { readonly r: Rechteck; readonly drehung: number }[],
  p: readonly PdfStrich[],
  aus: Abweichung[],
): void {
  if (b.length !== p.length) {
    aus.push({
      art: 'anzahl',
      klasse: 'striche',
      seite,
      index: -1,
      soll: String(p.length),
      ist: String(b.length),
    });
  }
  const n = Math.min(b.length, p.length);
  for (let i = 0; i < n; i++) {
    const { r } = b[i] as { r: Rechteck };
    const { lauf, strich } = p[i] as PdfStrich;
    const s = strich.bbox;
    const waagrecht = lauf.rotation === 0;
    const mitteQuer = waagrecht
      ? Math.abs(r.y + r.h / 2 - (s.y + s.h / 2))
      : Math.abs(r.x + r.w / 2 - (s.x + s.w / 2));
    const enden = waagrecht
      ? Math.max(Math.abs(r.x - s.x), Math.abs(r.x + r.w - (s.x + s.w)))
      : Math.max(Math.abs(r.y - s.y), Math.abs(r.y + r.h - (s.y + s.h)));
    if (mitteQuer > TOL_QUER || enden > TOL_ENTLANG) {
      aus.push({
        art: 'strich',
        klasse: 'striche',
        seite,
        index: i,
        soll: `Mitte quer ≤ ${z(TOL_QUER)}, Enden ≤ ${z(TOL_ENTLANG)}`,
        ist: `Mitte quer ${z(mitteQuer)}, Enden ${z(enden)}`,
      });
    }
  }
}

function zahlen(s: string | null): number[] | null {
  if (s === null || s.trim() === '' || s.trim() === 'none') return null;
  return s
    .trim()
    .split(/[\s,]+/)
    .map((x) => Number.parseFloat(x));
}

function vergleicheFormen(
  seite: number,
  b: readonly FormGemessen[],
  p: readonly PdfForm[],
  aus: Abweichung[],
): void {
  const bPfade = b.filter((f) => f.art === 'pfad');
  const pPfade = p.filter((f): f is Extract<PdfForm, { art: 'pfad' }> => f.art === 'pfad');
  const bBilder = b.filter((f) => f.art === 'bild');
  const pBilder = p.filter((f): f is Extract<PdfForm, { art: 'bild' }> => f.art === 'bild');
  if (bPfade.length !== pPfade.length) {
    aus.push({
      art: 'anzahl',
      klasse: 'formen',
      seite,
      index: -1,
      soll: String(pPfade.length),
      ist: String(bPfade.length),
    });
  }
  if (bBilder.length !== pBilder.length) {
    aus.push({
      art: 'anzahl',
      klasse: 'bilder',
      seite,
      index: -1,
      soll: String(pBilder.length),
      ist: String(bBilder.length),
    });
  }
  // Reihenfolge der Formen und Bilder untereinander (eins zu eins in Zeichenreihenfolge).
  if (bPfade.length === pPfade.length && bBilder.length === pBilder.length) {
    const k = b.findIndex((f, i) => f.art !== p[i]?.art);
    if (k >= 0) {
      aus.push({
        art: 'form',
        klasse: 'formen',
        seite,
        index: k,
        soll: p[k]?.art ?? '–',
        ist: b[k]?.art ?? '–',
      });
    }
  }
  for (let i = 0; i < Math.min(bPfade.length, pPfade.length); i++) {
    const f = bPfade[i] as Extract<FormGemessen, { art: 'pfad' }>;
    const { s } = pPfade[i] as Extract<PdfForm, { art: 'pfad' }>;
    const fehler: string[] = [];
    const sollFill = s.fill === null ? 'none' : rgb(s.fill);
    if ((f.fill ?? 'none') !== sollFill) fehler.push(`fill ${sollFill}/${f.fill ?? 'null'}`);
    const sollStrich = s.widthPt > 0;
    const istStrich = f.stroke !== null && f.stroke !== 'none';
    if (sollStrich !== istStrich) {
      fehler.push(`strich ${sollStrich ? 'ja' : 'nein'}/${istStrich ? 'ja' : 'nein'}`);
    } else if (sollStrich) {
      if (f.stroke !== rgb(s.color)) fehler.push(`stroke ${rgb(s.color)}/${f.stroke ?? 'null'}`);
      const breite = Number.parseFloat(f.strokeWidth ?? 'NaN');
      if (!(Math.abs(breite - s.widthPt) <= TOL_STRICHBREITE)) {
        fehler.push(`breite ${z(s.widthPt)}/${z(breite)}`);
      }
      const sollDash = s.dash;
      const istDash = zahlen(f.dash);
      const dashGleich =
        sollDash === null
          ? istDash === null
          : istDash !== null &&
            istDash.length === sollDash.length &&
            istDash.every((d, j) => Math.abs(d - (sollDash[j] ?? Number.NaN)) <= TOL_STRICHBREITE);
      if (!dashGleich) {
        fehler.push(
          `dash ${sollDash === null ? 'none' : sollDash.map(z).join(' ')}/${f.dash ?? 'none'}`,
        );
      }
    }
    const d = rechteckWeicht(f.bbox, s.bbox);
    if (!(d <= TOL_FORM)) fehler.push(`bbox ${z(d)}`);
    if (fehler.length > 0) {
      aus.push({
        art: 'form',
        klasse: 'formen',
        seite,
        index: i,
        soll: 'gleich',
        ist: fehler.join('; '),
      });
    }
  }
  for (let i = 0; i < Math.min(bBilder.length, pBilder.length); i++) {
    const f = bBilder[i] as Extract<FormGemessen, { art: 'bild' }>;
    const { bbox } = pBilder[i] as Extract<PdfForm, { art: 'bild' }>;
    const d = rechteckWeicht(f.bbox, bbox);
    if (!(d <= TOL_FORM)) {
      aus.push({
        art: 'bild',
        klasse: 'bilder',
        seite,
        index: i,
        soll: `≤ ${z(TOL_FORM)}`,
        ist: z(d),
      });
    }
  }
}

/**
 * Vergleicht die gemessenen Bildschirmseiten mit dem gelesenen PDF (Vertrag G9). Weicht eine Anzahl ab (Seiten,
 * sichtbare Läufe, Durchstreichungen, Formen, Bilder), entsteht je Klasse genau eine Abweichung `anzahl`; die
 * Paare 1 … min(n) werden trotzdem verglichen.
 */
export function vergleicheSeiten(bildschirm: readonly SeiteGemessen[], pdf: PdfInfo): Abweichung[] {
  const aus: Abweichung[] = [];
  if (bildschirm.length !== pdf.pages.length) {
    aus.push({
      art: 'anzahl',
      klasse: 'seiten',
      seite: 0,
      index: -1,
      soll: String(pdf.pages.length),
      ist: String(bildschirm.length),
    });
  }
  const n = Math.min(bildschirm.length, pdf.pages.length);
  for (let k = 0; k < n; k++) {
    const seite = k + 1;
    const b = bildschirm[k] as SeiteGemessen;
    const laeufe = pdf.texts.filter((t) => t.page === seite).sort((x, y) => x.order - y.order);
    const striche = pdf.strokes.filter((s) => s.page === seite);
    vergleicheLaeufe(seite, sichtbareLaeufe(b), laeufe, aus);
    const durch = pdfStriche(laeufe, striche);
    vergleicheStriche(
      seite,
      b.zeilen.flatMap((zl) => zl.striche.map((r) => ({ r, drehung: zl.drehung }))),
      durch,
      aus,
    );
    const durchOrder = new Set(durch.map((d) => d.strich.order));
    const formen: { order: number; f: PdfForm }[] = [
      ...striche
        .filter((s) => !durchOrder.has(s.order))
        .map((s) => ({ order: s.order, f: { art: 'pfad' as const, s } })),
      ...pdf.imagePlacements
        .filter((i) => i.page === seite)
        .map((i) => ({ order: i.order, f: { art: 'bild' as const, bbox: i.bbox } })),
    ];
    vergleicheFormen(
      seite,
      b.formen,
      formen.sort((x, y) => x.order - y.order).map((x) => x.f),
      aus,
    );
  }
  return aus;
}

/** Anzahlen je Seite aus readPdf: Läufe, Striche und Flächen, Bilder (Vertrag J X6). */
export function anzahlenPdf(pdf: PdfInfo): { laeufe: number; formen: number; bilder: number }[] {
  return pdf.pages.map((_, k) => ({
    laeufe: pdf.texts.filter((t) => t.page === k + 1).length,
    formen: pdf.strokes.filter((s) => s.page === k + 1).length,
    bilder: pdf.imagePlacements.filter((i) => i.page === k + 1).length,
  }));
}
