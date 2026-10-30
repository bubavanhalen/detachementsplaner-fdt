// Auswertung einer gelesenen PDF-Wochenseite (Paket E1-02e, Vertrag E1-02e Notiz «Ausarbeitung Schritt 2»
// Abschnitt C5, H1 bis H3, H8). Quelle ist nur `readPdf`/`checks.ts` (E1-01b mit Nachtrag P), nie das
// Seitenmodell. Bereichsgrenzen werden aus den PDF-Linien bestimmt (H8 b): Rahmen = grösstes gerahmtes Rechteck,
// yK = Kopf-Unterlinie, xS = senkrechte Seitenleistenlinie, y(from)/y(to) = Rasterbegrenzungen, yT =
// Termine-Oberlinie, xS − a = letzte Tagesgrenze. Strukturfehler melden sich als Assertion (ADR-010 §3.3).
// Nachgeführt nach Vertrag E1-02k §7 N7 (Gate S A3/A4): xS über das rechte Ende der Kopf-Unterlinie, die
// Seitenleistenlinie ohne Bedingung an ihr oberes Ende; Rapportkästchen nach Lage (Vertrag E1-02k §1).
import { expect } from 'vitest';
import { textOutline } from '../pdf/checks';
import type { PdfInfo, PdfStroke, PdfTextRun, Rect, Rgb } from '../pdf/read';

// ---------------------------------------------------------------------------------------------------------
// Grundlagen
// ---------------------------------------------------------------------------------------------------------

export function nahe(a: number, b: number, tol: number): boolean {
  return Math.abs(a - b) <= tol + 1e-9;
}

export function gleicheFarbe(a: Rgb | null, b: Rgb | null): boolean {
  return a !== null && b !== null && a.r === b.r && a.g === b.g && a.b === b.b;
}

export function hex(c: Rgb): string {
  const h = (n: number) => n.toString(16).toUpperCase().padStart(2, '0');
  return `#${h(c.r)}${h(c.g)}${h(c.b)}`;
}

export function ausHex(s: string): Rgb {
  const m = /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(s.trim());
  if (m === null) throw new Error(`keine Farbe: ${s}`);
  return {
    r: Number.parseInt(m[1] ?? '0', 16),
    g: Number.parseInt(m[2] ?? '0', 16),
    b: Number.parseInt(m[3] ?? '0', 16),
  };
}

/** Liegt `a` in `b` (Toleranz je Kante)? */
export function innerhalb(a: Rect, b: Rect, tol = 0.01): boolean {
  return (
    a.x >= b.x - tol &&
    a.y >= b.y - tol &&
    a.x + a.w <= b.x + b.w + tol &&
    a.y + a.h <= b.y + b.h + tol
  );
}

/** Offener Schnitt zweier Rechtecke grösser als `min` in x und y (wie `overlaps`, 0,001 pt). */
export function schneidet(a: Rect, b: Rect, min = 0.001): boolean {
  const sx = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const sy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return sx > min && sy > min;
}

export function enthaeltPunkt(r: Rect, x: number, y: number, tol = 0.01): boolean {
  return x >= r.x - tol && x <= r.x + r.w + tol && y >= r.y - tol && y <= r.y + r.h + tol;
}

export function mitte(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

export function istWaagrecht(s: PdfStroke): boolean {
  return s.kind === 'line' && s.bbox.h < 1e-6 && s.bbox.w > 1e-6;
}

export function istSenkrecht(s: PdfStroke): boolean {
  return s.kind === 'line' && s.bbox.w < 1e-6 && s.bbox.h > 1e-6;
}

/** Strichband einer Linie bzw. Rechteck mit halbem Strich (für H8 c). */
export function strichband(s: PdfStroke): Rect {
  const d = s.widthPt / 2;
  return { x: s.bbox.x - d, y: s.bbox.y - d, w: s.bbox.w + 2 * d, h: s.bbox.h + 2 * d };
}

export function laeufe(info: PdfInfo, seite = 1): PdfTextRun[] {
  return info.texts.filter((t) => t.page === seite);
}

export function striche(info: PdfInfo, seite = 1): PdfStroke[] {
  return info.strokes.filter((s) => s.page === seite);
}

/** Umriss (Ober- und Unterlänge) eines Laufs, wie `checks.ts` (Nachtrag P). */
export function umriss(t: PdfTextRun): Rect {
  return textOutline(t);
}

/** Text ohne Leerraum, weiche Trennungen und Bindestriche (Vergleich umbrochener Texte). */
export function norm(s: string): string {
  return s.normalize('NFC').replace(/[\s\u00AD-]/gu, '');
}

/** Alle Läufe mit genau diesem Text (nach Trimmen). */
export function laeufeMit(info: PdfInfo, text: string, seite?: number): PdfTextRun[] {
  return info.texts.filter(
    (t) => (seite === undefined || t.page === seite) && t.text.trim() === text,
  );
}

/** Genau ein Lauf mit diesem Text (Assertion sonst). */
export function einLauf(info: PdfInfo, text: string, seite?: number, wo?: Rect): PdfTextRun {
  const l = laeufeMit(info, text, seite).filter(
    (t) => wo === undefined || innerhalb(umriss(t), wo, 0.5),
  );
  expect(l.length, `genau ein Lauf «${text}»`).toBe(1);
  return l[0] as PdfTextRun;
}

// ---------------------------------------------------------------------------------------------------------
// Zeilen
// ---------------------------------------------------------------------------------------------------------

export interface Zeile {
  readonly seite: number;
  readonly laeufe: readonly PdfTextRun[];
  readonly text: string;
  readonly rotation: 0 | 90 | 270;
  /** Beginn der Grundlinie des ersten Laufs. */
  readonly x: number;
  readonly baselineY: number;
  readonly breite: number;
  readonly sizePt: number;
  readonly umriss: Rect;
}

function vereinigung(rs: readonly Rect[]): Rect {
  const x0 = Math.min(...rs.map((r) => r.x));
  const y0 = Math.min(...rs.map((r) => r.y));
  const x1 = Math.max(...rs.map((r) => r.x + r.w));
  const y1 = Math.max(...rs.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function huelle(rs: readonly Rect[]): Rect {
  return vereinigung(rs);
}

/**
 * Fasst Läufe zu Zeilen zusammen: gleiche Seite, Drehung und Grundlinie (± 0,01) und lückenlos aneinander
 * (± 0,05 pt), wie der Schreiber eine Zeile Lauf für Lauf ausgibt (E1-02c §2.3 Nr 4).
 */
export function zeilen(ls: readonly PdfTextRun[]): Zeile[] {
  const rest = [...ls].sort((a, b) => a.order - b.order);
  const aus: Zeile[] = [];
  const gruppen: PdfTextRun[][] = [];
  for (const t of rest) {
    const g = gruppen.find((gr) => {
      const l = gr[gr.length - 1] as PdfTextRun;
      if (l.page !== t.page || l.rotation !== t.rotation) return false;
      if (t.rotation === 0)
        return nahe(l.baselineY, t.baselineY, 0.01) && nahe(l.x + l.width, t.x, 0.05);
      if (t.rotation === 90)
        return nahe(l.x, t.x, 0.01) && nahe(l.baselineY - l.width, t.baselineY, 0.05);
      return nahe(l.x, t.x, 0.01) && nahe(l.baselineY + l.width, t.baselineY, 0.05);
    });
    if (g === undefined) gruppen.push([t]);
    else g.push(t);
  }
  for (const g of gruppen) {
    const erster = g[0] as PdfTextRun;
    aus.push({
      seite: erster.page,
      laeufe: g,
      text: g.map((t) => t.text).join(''),
      rotation: erster.rotation,
      x: erster.x,
      baselineY: erster.baselineY,
      breite: g.reduce((s, t) => s + t.width, 0),
      sizePt: erster.sizePt,
      umriss: vereinigung(g.map(umriss)),
    });
  }
  return aus;
}

// ---------------------------------------------------------------------------------------------------------
// Bereiche der Wochenseite (C5, H8 b)
// ---------------------------------------------------------------------------------------------------------

export interface Bereiche {
  readonly seite: number;
  /** Rahmen auf der Strichmitte (Pfadkoordinaten). */
  readonly rahmen: Rect;
  readonly rahmenStrich: PdfStroke;
  readonly rechts: number;
  readonly yU: number;
  readonly xS: number;
  readonly seitenleistenLinie: PdfStroke;
  readonly yK: number;
  readonly kopfUnterlinie: PdfStroke;
  readonly yFrom: number;
  readonly yTo: number;
  readonly rasterOben: PdfStroke;
  readonly rasterUnten: PdfStroke;
  readonly yT: number;
  readonly termineOberlinie: PdfStroke;
  readonly tagesgrenzen: readonly PdfStroke[];
  readonly X0: number;
  readonly xSa: number;
  /** Breite der Zeitachse a = X0 − Rahmen links. */
  readonly a: number;
  readonly tageskopfUnten: number;
  readonly tageskopfLinie: PdfStroke;
  readonly wasLinie: number;
  readonly wasLinieStrich: PdfStroke;
}

/**
 * Rechtes Ende der Kopf-Unterlinie: oberste waagrechte Linie, die am Rahmen links beginnt (Vertrag E1-02k N7; H8 b).
 */
function kopfUnterlinieEnde(st: readonly PdfStroke[], f: Rect): number {
  const kand = st
    .filter(istWaagrecht)
    .filter((s) => nahe(s.bbox.x, f.x, 0.5) && s.bbox.y > f.y + 1)
    .sort((a, b) => a.bbox.y - b.bbox.y);
  expect(kand.length, 'waagrechte Linie ab Rahmen links (Kopf-Unterlinie)').toBeGreaterThan(0);
  const k = kand[0] as PdfStroke;
  return k.bbox.x + k.bbox.w;
}

/**
 * Senkrechte Linien auf dem x der Seitenleiste (± 0,5), länger als 0,3 der Rahmenhöhe (Vertrag E1-02k N7; ohne
 * Bedingung an das obere Ende).
 */
function seitenleistenKandidaten(st: readonly PdfStroke[], f: Rect, xKopf: number): PdfStroke[] {
  return st.filter(istSenkrecht).filter((s) => s.bbox.h > 0.3 * f.h && nahe(s.bbox.x, xKopf, 0.5));
}

/** Bereichsgrenzen einer Wochenseite aus den Linien des PDF (H8 b). */
export function bereiche(info: PdfInfo, seite = 1): Bereiche {
  const st = striche(info, seite);
  const gerahmt = st.filter((s) => s.kind === 'rect' && s.widthPt > 0);
  expect(gerahmt.length, 'gerahmte Rechtecke auf der Seite').toBeGreaterThan(0);
  const rahmenStrich = gerahmt.reduce((m, s) =>
    s.bbox.w * s.bbox.h > m.bbox.w * m.bbox.h ? s : m,
  );
  const f = rahmenStrich.bbox;
  const rechts = f.x + f.w;
  const yU = f.y + f.h;
  const senk = st.filter(istSenkrecht);
  const waag = st.filter(istWaagrecht);
  const xSKand = seitenleistenKandidaten(st, f, kopfUnterlinieEnde(st, f)).filter(
    (s) => s.bbox.x > f.x + 1 && s.bbox.x < rechts - 1,
  );
  expect(
    xSKand.length,
    'genau eine senkrechte Seitenleistenlinie am Ende der Kopf-Unterlinie',
  ).toBe(1);
  const seitenleistenLinie = xSKand[0] as PdfStroke;
  const xS = seitenleistenLinie.bbox.x;
  const voll = waag
    .filter((s) => nahe(s.bbox.x, f.x, 0.5) && nahe(s.bbox.x + s.bbox.w, xS, 0.5))
    .sort((a, b) => a.bbox.y - b.bbox.y);
  expect(
    voll.length,
    'waagrechte Linien von Rahmen links bis xS: Kopf-Unterlinie, Rasterbegrenzung oben und unten',
  ).toBe(3);
  const [kopfUnterlinie, rasterOben, rasterUnten] = voll as [PdfStroke, PdfStroke, PdfStroke];
  const yK = kopfUnterlinie.bbox.y;
  const yFrom = rasterOben.bbox.y;
  const yTo = rasterUnten.bbox.y;
  const tagesgrenzen = senk
    .filter(
      (s) =>
        nahe(s.bbox.y, yK, 0.5) &&
        (nahe(s.bbox.y + s.bbox.h, yU, 0.5) || nahe(s.bbox.y + s.bbox.h, yTo, 0.5)) &&
        s.bbox.x > f.x + 0.5 &&
        s.bbox.x < xS - 0.5,
    )
    .sort((a, b) => a.bbox.x - b.bbox.x);
  expect(tagesgrenzen.length, 'Tagesgrenzen (mindestens links und rechts)').toBeGreaterThan(1);
  const X0 = (tagesgrenzen[0] as PdfStroke).bbox.x;
  const xSa = (tagesgrenzen[tagesgrenzen.length - 1] as PdfStroke).bbox.x;
  const kopfLinien = waag.filter(
    (s) =>
      nahe(s.bbox.x, X0, 0.5) &&
      nahe(s.bbox.x + s.bbox.w, xSa, 0.5) &&
      s.bbox.y > yK + 0.1 &&
      s.bbox.y < yFrom - 0.1,
  );
  expect(kopfLinien.length, 'genau eine Tageskopf-Unterlinie').toBe(1);
  const tageskopfLinie = kopfLinien[0] as PdfStroke;
  const unter = waag
    .filter((s) => s.bbox.y > yTo + 0.1 && nahe(s.bbox.x, f.x, 0.5))
    .sort((a, b) => a.bbox.y - b.bbox.y);
  expect(unter.length, 'Termine-Oberlinie').toBeGreaterThan(0);
  const termineOberlinie = unter[0] as PdfStroke;
  const yT = termineOberlinie.bbox.y;
  const was = waag
    .filter(
      (s) => s.bbox.y > yT + 0.1 && s.bbox.x <= X0 + 0.5 && nahe(s.bbox.x + s.bbox.w, xSa, 0.5),
    )
    .sort((a, b) => a.bbox.y - b.bbox.y);
  expect(was.length, '«Was»-Linie').toBeGreaterThan(0);
  const wasLinieStrich = was[0] as PdfStroke;
  return {
    seite,
    rahmen: f,
    rahmenStrich,
    rechts,
    yU,
    xS,
    seitenleistenLinie,
    yK,
    kopfUnterlinie,
    yFrom,
    yTo,
    rasterOben,
    rasterUnten,
    yT,
    termineOberlinie,
    tagesgrenzen,
    X0,
    xSa,
    a: X0 - f.x,
    tageskopfUnten: tageskopfLinie.bbox.y,
    tageskopfLinie,
    wasLinie: wasLinieStrich.bbox.y,
    wasLinieStrich,
  };
}

/** Bereiche als Rechtecke nach C5 (Wochenseite). */
export function bereichsRechtecke(b: Bereiche): {
  kopf: Rect;
  stand: Rect;
  raster: Rect;
  seitenleisteOben: Rect;
  termine: Rect;
  seitenleisteUnten: Rect;
} {
  const f = b.rahmen;
  return {
    kopf: { x: f.x, y: f.y, w: b.xS - f.x, h: b.yK - f.y },
    stand: { x: b.xS, y: f.y, w: b.rechts - b.xS, h: b.yK - f.y },
    raster: { x: f.x, y: b.yK, w: b.xS - f.x, h: b.yTo - b.yK },
    seitenleisteOben: { x: b.xS, y: b.yK, w: b.rechts - b.xS, h: b.yTo - b.yK },
    termine: { x: f.x, y: b.yT, w: b.xSa - f.x, h: b.yU - b.yT },
    seitenleisteUnten: { x: b.xSa, y: b.yTo, w: b.rechts - b.xSa, h: b.yU - b.yTo },
  };
}

/** Bereiche einer Fortsetzungsseite (C4, C5): Kopf, Stand-Feld, Termine, Seitenleiste. */
export function fortsetzungsBereiche(
  info: PdfInfo,
  seite: number,
): { rahmen: Rect; xS: number; yK: number; yU: number; rechtecke: Rect[] } {
  const st = striche(info, seite);
  const gerahmt = st.filter((s) => s.kind === 'rect' && s.widthPt > 0);
  expect(gerahmt.length, 'Rahmen der Fortsetzungsseite').toBeGreaterThan(0);
  const f = gerahmt.reduce((m, s) => (s.bbox.w * s.bbox.h > m.bbox.w * m.bbox.h ? s : m)).bbox;
  const rechts = f.x + f.w;
  const yU = f.y + f.h;
  const xSKand = seitenleistenKandidaten(st, f, kopfUnterlinieEnde(st, f)).filter(
    (s) => s.bbox.x > f.x + 1 && s.bbox.x < rechts - 1,
  );
  expect(xSKand.length, 'Seitenleistenlinie der Fortsetzungsseite').toBe(1);
  const xS = (xSKand[0] as PdfStroke).bbox.x;
  const kopf = st
    .filter(istWaagrecht)
    .filter((s) => nahe(s.bbox.x, f.x, 0.5) && nahe(s.bbox.x + s.bbox.w, xS, 0.5))
    .sort((a, b) => a.bbox.y - b.bbox.y);
  expect(kopf.length, 'Kopf-Unterlinie der Fortsetzungsseite').toBeGreaterThan(0);
  const yK = (kopf[0] as PdfStroke).bbox.y;
  return {
    rahmen: f,
    xS,
    yK,
    yU,
    rechtecke: [
      { x: f.x, y: f.y, w: xS - f.x, h: yK - f.y },
      { x: xS, y: f.y, w: rechts - xS, h: yK - f.y },
      { x: f.x, y: yK, w: xS - f.x, h: yU - yK },
      { x: xS, y: yK, w: rechts - xS, h: yU - yK },
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Tage und Spalten (aus den Grenzlinien)
// ---------------------------------------------------------------------------------------------------------

export interface SpaltePdf {
  readonly x: number;
  readonly w: number;
  readonly linksStrich: PdfStroke;
  readonly rechtsStrich: PdfStroke;
}

export interface TagPdf {
  readonly links: number;
  readonly rechts: number;
  readonly spalten: readonly SpaltePdf[];
  readonly bahngrenzen: readonly PdfStroke[];
}

/** Sichtbare Tage von links mit ihren Spalten (Spaltengrenzen ab Tageskopf-Unterlinie, Bahngrenzen ab y(from)). */
export function tageAusPdf(info: PdfInfo, b: Bereiche): TagPdf[] {
  const senk = striche(info, b.seite).filter(istSenkrecht);
  const tage: TagPdf[] = [];
  for (let i = 0; i + 1 < b.tagesgrenzen.length; i++) {
    const l = b.tagesgrenzen[i] as PdfStroke;
    const r = b.tagesgrenzen[i + 1] as PdfStroke;
    const innen = senk.filter((s) => s.bbox.x > l.bbox.x + 0.01 && s.bbox.x < r.bbox.x - 0.01);
    const grenzen = innen
      .filter((s) => nahe(s.bbox.y, b.tageskopfUnten, 0.5) && nahe(s.bbox.y + s.bbox.h, b.yTo, 0.5))
      .sort((a, c) => a.bbox.x - c.bbox.x);
    const bahngrenzen = innen.filter(
      (s) => nahe(s.bbox.y, b.yFrom, 0.5) && nahe(s.bbox.y + s.bbox.h, b.yTo, 0.5),
    );
    const kanten = [l, ...grenzen, r];
    const spalten: SpaltePdf[] = [];
    for (let k = 0; k + 1 < kanten.length; k++) {
      const a = kanten[k] as PdfStroke;
      const c = kanten[k + 1] as PdfStroke;
      spalten.push({ x: a.bbox.x, w: c.bbox.x - a.bbox.x, linksStrich: a, rechtsStrich: c });
    }
    tage.push({
      links: l.bbox.x,
      rechts: r.bbox.x,
      spalten: grenzen.length === 0 ? [] : spalten,
      bahngrenzen,
    });
  }
  return tage;
}

// ---------------------------------------------------------------------------------------------------------
// Zeitskala (H2, B-Kp-42)
// ---------------------------------------------------------------------------------------------------------

export interface LinienStil {
  readonly breite: number;
  readonly breiteTol: number;
  readonly muster: readonly number[] | null;
  readonly musterTol: number;
}

export function passtStil(s: PdfStroke, stil: LinienStil): boolean {
  if (!nahe(s.widthPt, stil.breite, stil.breiteTol)) return false;
  if (stil.muster === null) return s.dash === null || s.dash.length === 0;
  const m = stil.muster;
  return (
    s.dash !== null &&
    s.dash.length === m.length &&
    s.dash.every((d, i) => nahe(d, m[i] as number, stil.musterTol))
  );
}

export interface Skala {
  readonly yTop: number;
  readonly ptPerMinute: number;
  readonly fromMin: number;
  /** Grösste Abweichung einer Stunden- oder Halbstundenlinie von der Ausgleichsgeraden. */
  readonly residuum: number;
  readonly stunden: readonly { readonly t: number; readonly y: number; readonly s: PdfStroke }[];
  readonly halbstunden: readonly {
    readonly t: number;
    readonly y: number;
    readonly s: PdfStroke;
  }[];
}

export function yVon(s: Pick<Skala, 'yTop' | 'ptPerMinute' | 'fromMin'>, t: number): number {
  return s.yTop + (t - s.fromMin) * s.ptPerMinute;
}

/** Erwartete volle Stunden V0 ≤ t < to (E2) und Halbstunden from < t < to, t ≡ 30 (mod 60). */
export function stundenZeiten(range: { from: number; to: number }): {
  voll: number[];
  halb: number[];
} {
  const V0 = range.from + 60;
  const voll: number[] = [];
  for (let t = Math.ceil(V0 / 60) * 60; t < range.to; t += 60) voll.push(t);
  const halb: number[] = [];
  for (let t = Math.floor(range.from / 60) * 60 + 30; t < range.to; t += 60) {
    if (t > range.from) halb.push(t);
  }
  return { voll, halb };
}

/**
 * Zeitskala aus den Stundenlinien (H2): waagrechte Linien im Stil `stunde`, über alle Tage (X0 bis xS − a), in
 * y-Reihenfolge den Stunden ⌈V0/60⌉·60 … < to zugeordnet; Ausgleichsgerade nach kleinsten Quadraten.
 */
export function zeitskala(
  info: PdfInfo,
  b: Bereiche,
  range: { from: number; to: number },
  stunde: LinienStil,
  halbstunde: LinienStil,
): Skala {
  const waag = striche(info, b.seite)
    .filter(istWaagrecht)
    .filter((s) => nahe(s.bbox.x, b.X0, 0.5) && nahe(s.bbox.x + s.bbox.w, b.xSa, 0.5))
    .filter((s) => s.bbox.y > b.yFrom - 0.5 && s.bbox.y < b.yTo + 0.5);
  const { voll, halb } = stundenZeiten(range);
  const sl = waag.filter((s) => passtStil(s, stunde)).sort((a, c) => a.bbox.y - c.bbox.y);
  const hl = waag.filter((s) => passtStil(s, halbstunde)).sort((a, c) => a.bbox.y - c.bbox.y);
  expect(sl.length, 'Zahl der Stundenlinien').toBe(voll.length);
  const stunden = sl.map((s, i) => ({ t: voll[i] as number, y: s.bbox.y, s }));
  const n = stunden.length;
  const mt = stunden.reduce((s, p) => s + p.t, 0) / n;
  const my = stunden.reduce((s, p) => s + p.y, 0) / n;
  const sxy = stunden.reduce((s, p) => s + (p.t - mt) * (p.y - my), 0);
  const sxx = stunden.reduce((s, p) => s + (p.t - mt) ** 2, 0);
  const ptPerMinute = sxy / sxx;
  const yTop = my + (range.from - mt) * ptPerMinute;
  const skala = { yTop, ptPerMinute, fromMin: range.from };
  const halbstunden = hl.map((s, i) => ({ t: halb[i] ?? Number.NaN, y: s.bbox.y, s }));
  const residuum = Math.max(
    ...stunden.map((p) => Math.abs(p.y - yVon(skala, p.t))),
    ...halbstunden.map((p) => Math.abs(p.y - yVon(skala, p.t))),
  );
  return { ...skala, residuum, stunden, halbstunden };
}

// ---------------------------------------------------------------------------------------------------------
// Flächen und Einträge (H3)
// ---------------------------------------------------------------------------------------------------------

export interface Flaeche {
  readonly seite: number;
  readonly rect: Rect;
  readonly fill: Rgb;
  /** Strichbreite des Rahmens; null ohne Rahmen. */
  readonly rand: number | null;
  readonly randFarbe: Rgb | null;
  readonly randMuster: readonly number[] | null;
  /** Rahmen über eigene Strichelemente (offene Kanten, E1-02d 2f). */
  readonly offen: boolean;
  readonly order: number;
  readonly art: 'rect' | 'path';
}

/**
 * Gefüllte Flächen einer Seite. Ein Rechteck nur mit Füllung gehört zu den unmittelbar folgenden
 * Strichelementen: einem Strichpfad bzw. bei zwei offenen Kanten zwei Linien links und rechts (H3, V25).
 */
export function flaechen(info: PdfInfo, seite = 1): Flaeche[] {
  const st = striche(info, seite).sort((a, b) => a.order - b.order);
  const nachOrder = new Map(st.map((s) => [s.order, s]));
  const aus: Flaeche[] = [];
  for (const s of st) {
    if (s.fill === null || (s.kind !== 'rect' && s.kind !== 'path')) continue;
    if (s.widthPt > 0) {
      aus.push({
        seite,
        rect: s.bbox,
        fill: s.fill,
        rand: s.widthPt,
        randFarbe: s.color,
        randMuster: s.dash,
        offen: false,
        order: s.order,
        art: s.kind,
      });
      continue;
    }
    const n1 = nachOrder.get(s.order + 1);
    const n2 = nachOrder.get(s.order + 2);
    let rand: PdfStroke | null = null;
    if (n1 !== undefined && n1.fill === null && n1.widthPt > 0 && n1.kind === 'path') rand = n1;
    else if (
      n1 !== undefined &&
      n2 !== undefined &&
      istSenkrecht(n1) &&
      istSenkrecht(n2) &&
      n1.fill === null &&
      n2.fill === null &&
      nahe(n1.bbox.x, s.bbox.x, 0.01) &&
      nahe(n2.bbox.x, s.bbox.x + s.bbox.w, 0.01)
    )
      rand = n1;
    aus.push({
      seite,
      rect: s.bbox,
      fill: s.fill,
      rand: rand === null ? null : rand.widthPt,
      randFarbe: rand === null ? null : rand.color,
      randMuster: rand === null ? null : rand.dash,
      offen: rand !== null,
      order: s.order,
      art: s.kind,
    });
  }
  return aus;
}

export type Klasse = 'block' | 'rapportBox' | 'besoBox' | 'querbalken' | 'markerFeld' | 'unbekannt';

export interface RandBreiten {
  readonly block: LinienStil;
  /** Rapportrahmen (B-Kp-58); die Klasse 'rapportBox' folgt der Lage, nicht diesem Stil (Vertrag E1-02k N7). */
  readonly rapport: LinienStil;
  readonly beso: LinienStil;
  readonly querbalken: LinienStil;
  readonly markerFeld: LinienStil;
  readonly markerLinie: LinienStil;
}

export interface Eintrag {
  readonly flaeche: Flaeche;
  readonly klasse: Klasse;
}

export interface RasterInhalt {
  readonly eintraege: readonly Eintrag[];
  readonly markerLinien: readonly PdfStroke[];
}

function randPasst(f: Flaeche, stil: LinienStil): boolean {
  return f.rand !== null && nahe(f.rand, stil.breite, stil.breiteTol);
}

/**
 * Rap-Spalten einer Seite (Vertrag E1-02k §1): Fläche zwischen einer gestrichelten senkrechten Rap-Grenze
 * (B-Kp-40) im Raster und der nächsten senkrechten Grenze rechts davon. Gezählt werden senkrechte Linien, die
 * y(from) bis y(to) überdecken.
 */
function rapSpalten(info: PdfInfo, b: Bereiche): { x0: number; x1: number }[] {
  const senk = striche(info, b.seite)
    .filter(istSenkrecht)
    .filter((s) => s.bbox.y <= b.yFrom + 0.5 && s.bbox.y + s.bbox.h >= b.yTo - 0.5);
  return senk
    .filter(
      (s) =>
        s.dash !== null && s.dash.length > 0 && s.bbox.x > b.X0 + 0.01 && s.bbox.x < b.xSa - 0.01,
    )
    .map((s) => ({
      x0: s.bbox.x,
      x1: Math.min(...senk.map((t) => t.bbox.x).filter((x) => x > s.bbox.x + 0.5)),
    }));
}

/**
 * Einträge im Raster (H3): Flächen zwischen y(from) und y(to) innerhalb X0 … xS − a. Rapportkästchen nach Lage
 * (Vertrag E1-02k §1, N7): ausserhalb des Bands und ganz in einer Rap-Spalte (± 0,01), ohne Strichbreite; die
 * übrigen Klassen nach Strichbreite. Markerfeld = Rahmen `markerFieldBorder`, Ober- bzw. Unterkante 0,5 pt
 * (± 0,01) unter bzw. über einer Markerlinie; Querbalken im Band. Eine Breite, die zu mehreren Klassen passt, gilt
 * für die nächstliegende.
 */
export function rasterInhalt(
  info: PdfInfo,
  b: Bereiche,
  band: { y0: number; y1: number },
  breiten: RandBreiten,
): RasterInhalt {
  const rasterRect: Rect = { x: b.X0, y: b.yFrom, w: b.xSa - b.X0, h: b.yTo - b.yFrom };
  const markerLinien = striche(info, b.seite)
    .filter(istWaagrecht)
    .filter((s) => passtStil(s, breiten.markerLinie))
    .filter((s) => innerhalb({ ...s.bbox, h: 0 }, rasterRect, 0.01));
  const fl = flaechen(info, b.seite).filter((f) => innerhalb(f.rect, rasterRect, 0.01));
  const rap = rapSpalten(info, b);
  const inRap = (r: Rect) => rap.some((c) => r.x >= c.x0 - 0.01 && r.x + r.w <= c.x1 + 0.01);
  const eintraege = fl.map((f): Eintrag => {
    const imBand = f.rect.y + f.rect.h <= band.y1 + 0.01 && f.rect.y >= band.y0 - 0.01;
    if (!imBand && inRap(f.rect)) return { flaeche: f, klasse: 'rapportBox' };
    const kand: { k: Klasse; stil: LinienStil }[] = [
      { k: 'block', stil: breiten.block },
      { k: imBand ? 'querbalken' : 'besoBox', stil: imBand ? breiten.querbalken : breiten.beso },
    ];
    const passend = kand.filter((c) => randPasst(f, c.stil));
    if (passend.length === 0) return { flaeche: f, klasse: 'unbekannt' };
    passend.sort(
      (p, q) => Math.abs((f.rand ?? 0) - p.stil.breite) - Math.abs((f.rand ?? 0) - q.stil.breite),
    );
    let klasse = (passend[0] as { k: Klasse }).k;
    if (klasse === 'block' && randPasst(f, breiten.markerFeld)) {
      const feld = markerLinien.some(
        (m) =>
          m.bbox.x <= f.rect.x + 0.01 &&
          m.bbox.x + m.bbox.w >= f.rect.x + f.rect.w - 0.01 &&
          (nahe(f.rect.y, m.bbox.y + 0.5, 0.01) || nahe(f.rect.y + f.rect.h, m.bbox.y - 0.5, 0.01)),
      );
      if (feld) klasse = 'markerFeld';
    }
    return { flaeche: f, klasse };
  });
  return { eintraege, markerLinien };
}

/** Linienstil aus Breite und Toleranz (durchgezogen). */
export function stil(
  breite: number,
  breiteTol: number,
  muster: readonly number[] | null = null,
  musterTol = 0,
): LinienStil {
  return { breite, breiteTol, muster, musterTol };
}
