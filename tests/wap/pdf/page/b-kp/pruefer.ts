// Prüfer je Zeile von Anhang B-Kp (Paket E1-02e, R-14.2-01; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» I, H,
// J R-14.2-01; ADR-010 §7.1). Je ID ein Prüfer mit Formmuster für Einheit, Sollwert und Toleranz (regulärer
// Ausdruck, deutsches Dezimalkomma). Die Zahlen liest der Prüfer aus der CSV, nie aus dem Testcode; Werte, die der
// Vertrag statt der CSV festlegt (Sonderfälle in I), sind mit ihrer Stelle genannt. Geprüft wird nur das gelesene
// PDF (H1). Aufgeschoben an E1-10: B-Kp-55, B-Kp-56, B-Kp-100.
// Nachtrag E1-02k (Vertrag E1-02k §3, §7 N4; Gate S A3/A4, R-10-50 bis R-10-53): B-Kp-06 ohne Prüfung der
// Oberkante der Seitenleistenlinie (steht in B-Kp-119), B-Kp-58 «= Blockrahmen», B-Kp-77 mit Bedeutungsspalte,
// B-Kp-78 Stil nach Stunde und Spaltenlinie bis zur Raster-Unterlinie, neue Prüfer B-Kp-113 bis B-Kp-119.
import { expect } from 'vitest';
import {
  abbreviationMeaning,
  abbreviationsForWeek,
} from '../../../../../src/model/wap/derive/abbreviations';
import { agendaLinesForDate } from '../../../../../src/model/wap/derive/agenda';
import { markerLabel } from '../../../../../src/model/wap/derive/marker';
import { remarksForWeek } from '../../../../../src/model/wap/derive/remarks';
import { measureRuns } from '../../../../../src/model/wap/layout/text/measure';
import { ascentPt, lineHeightPt } from '../../../../../src/model/wap/layout/text/metrics';
import { kpTemplate } from '../../../../../src/model/wap/template';
import { formatMilTime } from '../../../../../src/model/wap/time';
import type { Column, ColumnSet, Plan, Rgb } from '../../../../../src/model/wap/types';
import { block, CAT, col, rapport, rt } from '../../../support/model/builders';
import { type BkpZeile, ersetze, leseBkp, ZAHL, zahl, zitate } from '../../../support/page/bkp';
import { aufStunde, regeln, zeilenkasten } from '../../../support/page/nachtrag-rahmen';
import { gezeichneteSpanne } from '../../../support/page/orakel';
import {
  ausHex,
  type Bereiche,
  type Eintrag,
  type Flaeche,
  flaechen,
  gleicheFarbe,
  innerhalb,
  istSenkrecht,
  istWaagrecht,
  laeufe,
  mitte,
  nahe,
  norm,
  passtStil,
  schneidet,
  striche,
  type TagPdf,
  umriss,
  yVon,
  type Zeile,
  zeilen,
} from '../../../support/page/pdf-seite';
import { bewerte, itemZuLauf, traegerGruppen } from '../../../support/page/rueckfall';
import { bkp, form, strichAus } from '../../../support/page/stile';
import {
  EINTAG,
  eintagPlan,
  KVK_PLUS_NEUTRAL,
  KVK_PLUS_QUERBALKEN,
  KVK_TAGE,
  KVK_WOCHE,
  kvk,
  leererKvk,
  MO,
  mitTagen,
  mitWoche,
  WOCHENTAG_LANG,
  woche,
} from '../../../support/page/varianten';
import { edgesOffTime, minFontSize } from '../../../support/pdf/checks';
import type { PdfInfo, PdfStroke, PdfTextRun, Rect } from '../../../support/pdf/read';
import { type Kontext, platzhalterWerte, type Seite } from './kontext';

export interface Werte {
  readonly z: BkpZeile;
  readonly soll: RegExpExecArray | null;
  readonly sollwert: RegExpExecArray;
  readonly toleranz: RegExpExecArray;
}

export interface Pruefer {
  /** Kurzbeschreibung für den Testnamen (eigene Worte, kein Referenztext). */
  readonly titel: string;
  /** Kennungen von Vorschlägen bzw. Konflikten im Testnamen (PL0-16). */
  readonly kennung?: string;
  readonly einheit: string;
  readonly sollwert: RegExp;
  readonly toleranz: RegExp;
  readonly soll?: RegExp;
  pruefe(k: Kontext, w: Werte): Promise<void>;
}

/** An E1-10 aufgeschoben (Vertrag I «Vollständigkeit»). */
export const AUFGESCHOBEN: ReadonlySet<string> = new Set(['B-Kp-55', 'B-Kp-56', 'B-Kp-100']);

const Z = ZAHL;
const R = (s: string) => new RegExp(s);
const n = (m: RegExpExecArray | null, i: number): number => zahl(m?.[i] ?? '');
const K = 72 / 25.4;
const SCHWARZ: Rgb = { r: 0, g: 0, b: 0 };
const INSET = 0.5;

function nah(ist: number, soll: number, tol: number, was: string): void {
  expect(
    Math.abs(ist - soll),
    `${was}: ist ${ist.toFixed(3)}, soll ${soll.toFixed(3)} ± ${tol}`,
  ).toBeLessThanOrEqual(tol + 1e-9);
}

function imBereich(ist: number, lo: number, hi: number, was: string): void {
  expect(ist, `${was} ≥ ${lo}`).toBeGreaterThanOrEqual(lo - 1e-9);
  expect(ist, `${was} ≤ ${hi}`).toBeLessThanOrEqual(hi + 1e-9);
}

function laeufeIm(info: PdfInfo, r: Rect, tol = 0.01): PdfTextRun[] {
  return laeufe(info).filter((t) => innerhalb(umriss(t), r, tol));
}

function genau(ls: PdfTextRun[], text: string, was = ''): PdfTextRun {
  const l = ls.filter((t) => t.text.trim() === text);
  expect(l.length, `genau ein Lauf «${text}» ${was}`).toBe(1);
  return l[0] as PdfTextRun;
}

function kopf(b: Bereiche): Rect {
  return { x: b.rahmen.x, y: b.rahmen.y, w: b.rahmen.w, h: b.yK - b.rahmen.y };
}
function oben(b: Bereiche): Rect {
  return { x: b.xS, y: b.yK, w: b.rechts - b.xS, h: b.yTo - b.yK };
}
function unten(b: Bereiche): Rect {
  return { x: b.xSa, y: b.yTo, w: b.rechts - b.xSa, h: b.yU - b.yTo };
}
function raster(b: Bereiche): Rect {
  return { x: b.X0, y: b.yFrom, w: b.xSa - b.X0, h: b.yTo - b.yFrom };
}
const rechts = (t: PdfTextRun) => t.x + t.width;
const mitteX = (t: PdfTextRun) => t.x + t.width / 2;

/** Einheitslauf rechts im Kopf. */
function einheit(s: Seite): PdfTextRun {
  const l = laeufeIm(s.info, kopf(s.b)).filter((t) => t.text.trim() === s.plan.unit && !t.bold);
  expect(l.length, 'Einheit im Kopf').toBe(1);
  return l[0] as PdfTextRun;
}

/** Titelrahmen: gerahmtes Rechteck im Kopf, das den Titellauf enthält. */
function titelRahmen(s: Seite, titel: PdfTextRun): PdfStroke {
  const r = striche(s.info).filter(
    (x) =>
      x.kind === 'rect' &&
      x.widthPt > 0 &&
      x !== s.b.rahmenStrich &&
      innerhalb(umriss(titel), x.bbox),
  );
  expect(r.length, 'Titelrahmen').toBe(1);
  return r[0] as PdfStroke;
}

function titelLauf(s: Seite): PdfTextRun {
  const w = woche(s.plan);
  return genau(laeufeIm(s.info, kopf(s.b)), `${s.plan.unit} Arbeitsplan ${w.label}`, 'Titel');
}

function spalteVon(t: TagPdf, i: number): TagPdf['spalten'][number] {
  const s = t.spalten[i];
  expect(s, `Spalte ${i}`).toBeDefined();
  return s as TagPdf['spalten'][number];
}

/** Kopfläufe einer Spalte (Mitte zwischen Tageskopf-Unterlinie und y(from)). */
function kopfLaeufe(s: Seite, sp: { x: number; w: number }): PdfTextRun[] {
  return laeufe(s.info).filter((t) => {
    const m = mitte(umriss(t));
    return m.x > sp.x && m.x < sp.x + sp.w && m.y > s.b.tageskopfUnten && m.y < s.b.yFrom;
  });
}

/** Gewicht einer Spalte (E1-02d 2a Nr 3). */
/**
 * Nebenspalte 2 statt 1 nach Entscheid Auftraggeber 19.10.2026 «12: ja» (Q-HL-03, F-LAYOUT2): bewusste Abweichung von
 * Beschrieb 4.4 und vom Referenzwert B-Kp-37 («Nebenspalte 1»); die übrigen Gewichte wie B-Kp-37.
 */
const NEBENSPALTE_GEWICHT = 2;

function gewicht(c: Column): number {
  if (c.kind === 'planning') return c.weight === 'narrow' ? 1 : c.weight === 'normal' ? 2 : 3;
  if (c.kind === 'secondary') return NEBENSPALTE_GEWICHT;
  return c.kind === 'beso' ? 2 : 1;
}

function spaltenDesTags(plan: Plan, i: number): readonly Column[] {
  const w = woche(plan);
  const id = w.days[i]?.columnSetId ?? null;
  return plan.columnSets.find((x) => x.id === id)?.columns ?? [];
}

function eintraege(s: Seite, klasse: Eintrag['klasse']): Flaeche[] {
  return s.an.inhalt.eintraege.filter((e) => e.klasse === klasse).map((e) => e.flaeche);
}

function sichtbareIndizes(plan: Plan): number[] {
  return woche(plan).days.flatMap((d, i) => (d.display === 'hidden' ? [] : [i]));
}

/** Fläche, die einen Rasterlauf trägt: zuletzt vor ihm gezeichnet und seine Mitte enthaltend (H8 a). */
function traeger(s: Seite, t: PdfTextRun): Eintrag | undefined {
  const m = mitte(umriss(t));
  return s.an.inhalt.eintraege
    .filter(
      (e) =>
        e.flaeche.order < t.order &&
        m.x >= e.flaeche.rect.x &&
        m.x <= e.flaeche.rect.x + e.flaeche.rect.w &&
        m.y >= e.flaeche.rect.y &&
        m.y <= e.flaeche.rect.y + e.flaeche.rect.h,
    )
    .sort((p, q) => q.flaeche.order - p.flaeche.order)[0];
}

/** Läufe, deren Trägerfläche `f` ist. */
function texteAuf(s: Seite, f: Flaeche): PdfTextRun[] {
  return laeufe(s.info).filter((t) => traeger(s, t)?.flaeche === f);
}

/** Sichtbare Blöcke der Woche mit Farbe ihrer Kategorie. */
function farbeVon(plan: Plan, id: string): Rgb {
  const c = plan.legend.find((x) => x.id === id);
  expect(c, `Kategorie ${id}`).toBeDefined();
  return (c as { color: Rgb }).color;
}

/** WCAG-Kontrast: Schwarz oder Weiss (E1-02d 2e «Farbe»), eigene Rechnung des Tests. */
function textFarbeAuf(f: Rgb): Rgb {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const L = 0.2126 * lin(f.r) + 0.7152 * lin(f.g) + 0.0722 * lin(f.b);
  const schwarz = (L + 0.05) / 0.05;
  const weiss = 1.05 / (L + 0.05);
  return schwarz >= weiss ? SCHWARZ : { r: 255, g: 255, b: 255 };
}

function legendenFelder(s: Seite): Flaeche[] {
  return flaechen(s.info)
    .filter(
      (f) =>
        innerhalb(f.rect, oben(s.b), 0.01) &&
        nahe(f.rect.x, s.b.xS, 0.5) &&
        nahe(f.rect.w, s.b.a, 0.5),
    )
    .sort((p, q) => p.rect.y - q.rect.y);
}

function legendenText(s: Seite, f: Flaeche): PdfTextRun | null {
  const l = laeufeIm(s.info, oben(s.b)).filter((t) => {
    const m = mitte(umriss(t));
    return t.x >= f.rect.x + f.rect.w - 0.01 && m.y > f.rect.y && m.y < f.rect.y + f.rect.h;
  });
  return l.length === 1 ? (l[0] as PdfTextRun) : null;
}

/** Gruppen von Terminzeilen-Läufen je Terminspalte (Tagesgrenzen; Sa+So in KVK zusammengefasst). */
function terminZeilen(s: Seite, x0: number, x1: number): Zeile[] {
  return zeilen(
    laeufe(s.info).filter((t) => {
      const u = umriss(t);
      const m = mitte(u);
      return u.y > s.b.wasLinie && m.x > x0 && m.x < x1 && u.x + u.w <= s.b.xSa + 0.01;
    }),
  ).sort((p, q) => p.baselineY - q.baselineY);
}

function wasLaeufe(s: Seite): PdfTextRun[] {
  return laeufe(s.info)
    .filter((t) => t.text.trim() === 'Was')
    .filter((t) => {
      const m = mitte(umriss(t));
      return m.y > s.b.yT && m.y < s.b.wasLinie && m.x < s.b.xSa;
    })
    .sort((p, q) => p.x - q.x);
}

const groessen108 = R(
  `^Titel (${Z}); Beilage (${Z}); Woche (${Z}); Unterschrift (${Z}); Motto (${Z}); Sonnenzeiten (${Z}); Erh\\. Bereitschaft (${Z})$`,
);

const stufe = (ist: number, std: number) => {
  const k = (std - ist) / 0.25;
  return (
    ist >= kpTemplate().fontSizes.min - 1e-9 &&
    ist <= std + 0.05 &&
    (Math.abs(ist - std) <= 0.05 || Math.abs(k - Math.round(k)) < 1e-6)
  );
};

// ---------------------------------------------------------------------------------------------------------
// Prüfer
// ---------------------------------------------------------------------------------------------------------

const PT = R(`^±(${Z}) pt$`);
const EINZEL = R(`^(${Z})$`);
const VERH_H = R(`^(${Z}) × h$`);
const TOL_H = R(`^±(${Z}) h$`);
const HEX = R('^(#[0-9A-F]{6})$');

/** Höhe h aus dem PDF (Stundenabstand, H2). */
const hVon = (s: Seite) => s.an.bandHoehe;

function strichPruefer(
  titel: string,
  waehle: (s: Seite) => PdfStroke[],
  extra?: (s: Seite, l: PdfStroke[]) => void,
  muster = false,
): Pruefer {
  return {
    titel,
    einheit: 'pt',
    sollwert: muster ? R(`^(${Z}); Muster (${Z})/(${Z})$`) : EINZEL,
    toleranz: muster ? R(`^±(${Z}) pt; Muster ±(${Z}) pt$`) : PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const l = waehle(s);
      expect(l.length, `${w.z.id}: Linien gefunden`).toBeGreaterThan(0);
      for (const x of l) {
        nah(x.widthPt, n(w.sollwert, 1), n(w.toleranz, 1), `${w.z.id} Strichbreite`);
        expect(x.color, `${w.z.id} schwarz`).toEqual(SCHWARZ);
        if (muster) {
          expect(x.dash?.length, `${w.z.id} Muster`).toBe(2);
          nah(x.dash?.[0] ?? 0, n(w.sollwert, 2), n(w.toleranz, 2), `${w.z.id} Strich`);
          nah(x.dash?.[1] ?? 0, n(w.sollwert, 3), n(w.toleranz, 2), `${w.z.id} Lücke`);
        } else expect(x.dash === null || x.dash.length === 0, `${w.z.id} durchgezogen`).toBe(true);
      }
      extra?.(s, l);
    },
  };
}

function farbPruefer(titel: string, quelle: (k: Kontext, soll: Rgb) => Promise<void>): Pruefer {
  return {
    titel,
    einheit: 'sRGB',
    sollwert: HEX,
    toleranz: R('^exakt(?: \\(ΔE2000 ≤ 1 nach Rendering\\))?$'),
    async pruefe(k, w) {
      await k.kvk();
      await quelle(k, ausHex(w.sollwert[1] ?? ''));
    },
  };
}

function legendenFarbe(i: number): (k: Kontext, soll: Rgb) => Promise<void> {
  return async (k, soll) => {
    const s = await k.kvk();
    const kat = s.plan.legend.filter((c) => c.inLegend && !c.neutral)[i];
    expect(kat, `Kategorie ${i + 1}`).toBeDefined();
    const f = legendenFelder(s)[i];
    expect(f?.fill, 'Farbfeld der Legende').toEqual(soll);
    expect(kat?.color).toEqual(soll);
    const bloecke = eintraege(s, 'block').filter((x) => gleicheFarbe(x.fill, soll));
    const verwendet = Object.values(s.plan.entries).some(
      (e) =>
        e.type === 'block' &&
        e.categoryId === kat?.id &&
        e.date >= MO &&
        e.date <= (KVK_TAGE[6] as string),
    );
    if (verwendet) expect(bloecke.length, 'Blockfläche in dieser Farbe').toBeGreaterThan(0);
  };
}

/**
 * Grösse eines Eintragslaufs nach S3-10: Sollgrösse ± Toleranz; kleiner nur in einer 0,25-pt-Stufe unter der
 * Sollgrösse und ≥ fontSizes.min, und nur, wenn sein Textträger nach dem Orakel R-10-39 (a) in Standardgrösse nicht
 * passt (Zuordnung PDF-Lauf ↔ TextItem über Seite, Text, Grösse, x, Grundlinie ± 0,01; Ausnahme zu H1).
 */
function pruefeEintragsGroesse(
  s: Seite,
  t: PdfTextRun,
  soll: number,
  tol: number,
  was: string,
): void {
  if (Math.abs(t.sizePt - soll) <= tol + 1e-9) return;
  const k = (soll - t.sizePt) / 0.25;
  expect(t.sizePt, `${was}: kleiner als Soll`).toBeLessThan(soll);
  expect(Math.abs(k - Math.round(k)), `${was}: 0,25-pt-Stufe`).toBeLessThan(1e-6);
  expect(t.sizePt, `${was}: ≥ fontSizes.min`).toBeGreaterThanOrEqual(
    kpTemplate().fontSizes.min - 1e-9,
  );
  const it = itemZuLauf(s.layout, t);
  expect(it, `${was}: TextItem zum Lauf`).toBeDefined();
  const gruppe = traegerGruppen(s.layout).find((g) => g.some((x) => x === it));
  expect(gruppe, `${was}: Textträger`).toBeDefined();
  const b = bewerte(s.layout, s.plan, gruppe ?? []);
  expect(b?.passtStandard, `${was}: verkleinert, obwohl in Standardgrösse passend`).toBe(false);
}

function groessenPruefer(
  titel: string,
  waehle: (s: Seite) => Promise<{ laeufe: PdfTextRun[]; fett: boolean | null }>,
): Pruefer {
  return {
    titel,
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const { laeufe: ls, fett } = await waehle(s);
      expect(ls.length, `${w.z.id}: Läufe`).toBeGreaterThan(0);
      const soll = n(w.sollwert, 1);
      const tol = n(w.toleranz, 1);
      for (const t of ls) {
        if (fett !== null) expect(t.bold, `${w.z.id} Schnitt «${t.text}»`).toBe(fett);
        pruefeEintragsGroesse(s, t, soll, tol, `${w.z.id} «${t.text}»`);
      }
      expect(
        ls.some((t) => Math.abs(t.sizePt - soll) <= tol),
        `${w.z.id}: mindestens einer in Sollgrösse`,
      ).toBe(true);
    },
  };
}

/** Läufe in Flächen einer Klasse (Trägerfläche nach H8 a). */
function laeufeInKlasse(s: Seite, klasse: Eintrag['klasse']): PdfTextRun[] {
  const r = raster(s.b);
  return laeufe(s.info).filter((t) => {
    const m = mitte(umriss(t));
    if (!(m.x > r.x && m.x < r.x + r.w && m.y > r.y && m.y < r.y + r.h)) return false;
    return traeger(s, t)?.klasse === klasse;
  });
}

/** Farbe aus einer B-Kp-Zeile mit Sollwert «#RRGGBB». */
function hexAus(id: string): Rgb {
  const z = bkp(id);
  return ausHex(form(id, 'Sollwert', z.sollwert, HEX)[1] ?? '');
}

function wochenSatz(): ColumnSet {
  return {
    id: 's400',
    name: 'Gewichte',
    columns: [
      col('c401', 'Schmal', 'planning', { weight: 'narrow' }),
      col('c402', 'Normal', 'planning', { weight: 'normal' }),
      col('c403', 'Breit', 'planning', { weight: 'wide' }),
      col('c404', 'Det', 'secondary', { weight: 'wide' }),
      col('c405', 'Rap', 'rap', { weight: 'wide' }),
      col('c406', 'Beso', 'beso', { weight: 'narrow' }),
    ],
  };
}

// ---------------------------------------------------------------------------------------------------------
// Seitenleiste nach Vertrag E1-02k (Gate S A4; B-Kp-77, -78, -113 bis -119)
// ---------------------------------------------------------------------------------------------------------

/** Toleranz der Linienenden (B-Kp-27 «Enden ±0,5 pt»; Vertrag E1-02k P6, P8 bis P10). */
function endenTol(): number {
  return n(
    form('B-Kp-27', 'Toleranz', bkp('B-Kp-27').toleranz, R(`^±${Z} pt; Enden ±(${Z}) pt$`)),
    1,
  );
}

/** Waagrechte Regeln der Seitenleiste auf Seite 1: von xS bis zum Rahmen rechts (Enden ± tol), nach y. */
function leistenRegeln(s: Seite, tol = endenTol()): PdfStroke[] {
  return regeln(s.info, 1, s.b.xS, s.b.rechts, tol);
}

/** Stundenlagen der Wochenseite aus den Stundenlinien des PDF (H2). */
function stundenVon(s: Seite): number[] {
  return s.an.skala.stunden.map((x) => x.y);
}

/**
 * Regel 0,48 nach der Stundenregel (Vertrag E1-02k 2.2 Punkt 11): auf einer Stundenlinie im Stil B-Kp-45, sonst
 * Breite `breite` ± `tol` durchgezogen.
 */
function pruefeRegel(
  l: PdfStroke,
  breite: number,
  tol: number,
  stunden: readonly number[],
  was: string,
): void {
  if (aufStunde(l.bbox.y, stunden)) {
    expect(passtStil(l, strichAus(leseBkp(), 'B-Kp-45')), `${was}: Stil der Stundenlinie`).toBe(
      true,
    );
    return;
  }
  nah(l.widthPt, breite, tol, `${was}: Strichbreite`);
  expect(l.dash === null || l.dash.length === 0, `${was}: durchgezogen`).toBe(true);
}

/** Nächste Regel über (bzw. unter) y. */
function regelBei(
  rs: readonly PdfStroke[],
  y: number,
  richtung: 'ueber' | 'unter',
  was: string,
): PdfStroke {
  const l =
    richtung === 'ueber'
      ? rs.filter((x) => x.bbox.y <= y + 0.01).slice(-1)
      : rs.filter((x) => x.bbox.y >= y - 0.01).slice(0, 1);
  expect(l.length, `Regel ${richtung === 'ueber' ? 'über' : 'unter'} ${was}`).toBe(1);
  return l[0] as PdfStroke;
}

/** Unterkante des Zeilenkastens der letzten Zielzeile (Läufe der Seitenleiste zwischen y(from) und bisY). */
function zielUnterkante(s: Seite, bisY: number): number {
  const ls = laeufeIm(s.info, oben(s.b)).filter(
    (t) => t.rotation === 0 && t.baselineY > s.b.yFrom + 0.01 && t.baselineY < bisY - 0.01,
  );
  expect(ls.length, 'Zielzeilen').toBeGreaterThan(0);
  return Math.max(...ls.map((t) => zeilenkasten(t).bottom));
}

export const PRUEFER: Readonly<Record<string, Pruefer>> = {
  'B-Kp-01': {
    titel: 'Format A4 quer, eine Seite je Woche',
    einheit: 'pt',
    sollwert: R(`^(${Z}) × (${Z})$`),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      expect(s.info.pages.length).toBe(1);
      const p = s.info.pages[0] as { widthPt: number; heightPt: number };
      nah(p.widthPt, n(w.sollwert, 1), n(w.toleranz, 1), 'Breite');
      nah(p.heightPt, n(w.sollwert, 2), n(w.toleranz, 1), 'Höhe');
    },
  },
  'B-Kp-02': strichPruefer('Seitenrahmen durchgezogen, schwarz', (s) => [s.b.rahmenStrich]),
  'B-Kp-03': {
    titel: 'Rahmen auf der Seite zentriert',
    einheit: 'pt',
    sollwert: R(`^≤ (${Z})$`),
    toleranz: R('^exakt \\(Grenzwert\\)$'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const f = s.b.rahmen;
      const hw = s.b.rahmenStrich.widthPt / 2;
      const p = s.info.pages[0] as { widthPt: number; heightPt: number };
      const links = f.x - hw;
      const rechtsR = p.widthPt - (f.x + f.w + hw);
      const obenR = f.y - hw;
      const untenR = p.heightPt - (f.y + f.h + hw);
      expect(Math.abs(links - rechtsR)).toBeLessThanOrEqual(n(w.sollwert, 1));
      expect(Math.abs(obenR - untenR)).toBeLessThanOrEqual(n(w.sollwert, 1));
    },
  },
  'B-Kp-04': {
    titel: 'Ränder links und rechts bis Rahmen-Aussenkante',
    einheit: 'mm',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z}) mm$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const f = s.b.rahmen;
      const hw = s.b.rahmenStrich.widthPt / 2;
      const p = s.info.pages[0] as { widthPt: number };
      nah((f.x - hw) / K, n(w.sollwert, 1), n(w.toleranz, 1), 'Rand links mm');
      nah((p.widthPt - (f.x + f.w + hw)) / K, n(w.sollwert, 1), n(w.toleranz, 1), 'Rand rechts mm');
    },
  },
  'B-Kp-05': {
    titel: 'Ränder oben und unten bis Rahmen-Aussenkante',
    einheit: 'mm',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z}) mm$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const f = s.b.rahmen;
      const hw = s.b.rahmenStrich.widthPt / 2;
      const p = s.info.pages[0] as { heightPt: number };
      nah((f.y - hw) / K, n(w.sollwert, 1), n(w.toleranz, 1), 'Rand oben mm');
      nah((p.heightPt - (f.y + f.h + hw)) / K, n(w.sollwert, 1), n(w.toleranz, 1), 'Rand unten mm');
    },
  },
  'B-Kp-06': {
    titel: 'Anordnung der Bereiche (Maschinenteil; Sicht an Gate S)',
    einheit: 'Reihenfolge',
    sollwert: R('^Kopf > Raster \\| Seitenleiste > Termine \\| Seitenleiste$'),
    toleranz: R('^exakt$'),
    async pruefe(k) {
      const { b } = await k.kvk();
      expect(
        nahe(b.kopfUnterlinie.bbox.x, b.rahmen.x, 0.5) &&
          nahe(b.kopfUnterlinie.bbox.x + b.kopfUnterlinie.bbox.w, b.xS, 0.5),
      ).toBe(true);
      expect(b.yK).toBeLessThan(b.yFrom);
      expect(b.X0).toBeGreaterThan(b.rahmen.x);
      expect(b.xS).toBeGreaterThan(b.xSa);
      // Oberes Ende der Seitenleistenlinie: B-Kp-119 (Vertrag E1-02k N4).
      expect(nahe(b.seitenleistenLinie.bbox.y + b.seitenleistenLinie.bbox.h, b.yTo, 0.5)).toBe(
        true,
      );
      expect(b.yT).toBeGreaterThan(b.yTo);
      expect(nahe(b.termineOberlinie.bbox.x, b.rahmen.x, 0.5)).toBe(true);
      expect(nahe(b.termineOberlinie.bbox.x + b.termineOberlinie.bbox.w, b.xSa, 0.5)).toBe(true);
      expect(b.yU).toBeGreaterThan(b.yT);
    },
  },
  'B-Kp-07': {
    titel: 'Stundenhöhe h aus der Rahmenhöhe, waagrechte und senkrechte Spaltenköpfe',
    einheit: 'Verhältnis',
    sollwert: R(
      `^H_R / (${Z}) \\(senkrechte Spaltenköpfe\\) bzw\\. H_R / (${Z}) \\(waagrechte\\)$`,
    ),
    toleranz: R(`^±(${Z}) %$`),
    async pruefe(k, w) {
      const waag = await k.kvk();
      const senk = await k.senkrecht();
      const tol = n(w.toleranz, 1) / 100;
      const sw = waag.b.rahmen.h / n(w.sollwert, 2);
      const ss = senk.b.rahmen.h / n(w.sollwert, 1);
      nah(hVon(waag), sw, tol * sw, 'h waagrecht');
      nah(hVon(senk), ss, tol * ss, 'h senkrecht');
    },
  },
  'B-Kp-08': {
    titel: 'Kopfhöhe in h',
    einheit: 'Verhältnis',
    sollwert: VERH_H,
    toleranz: TOL_H,
    async pruefe(k, w) {
      const s = await k.kvk();
      nah((s.b.yK - s.b.rahmen.y) / hVon(s), n(w.sollwert, 1), n(w.toleranz, 1), 'Kopf / h');
    },
  },
  'B-Kp-09': {
    titel: 'Höhe der Tageskopfzeile in h',
    einheit: 'Verhältnis',
    sollwert: VERH_H,
    toleranz: TOL_H,
    async pruefe(k, w) {
      const s = await k.kvk();
      nah(
        (s.b.tageskopfUnten - s.b.yK) / hVon(s),
        n(w.sollwert, 1),
        n(w.toleranz, 1),
        'Tageskopf / h',
      );
    },
  },
  'B-Kp-10': {
    titel: 'Höhe der Spaltenkopfzeile, waagrecht und mit senkrechtem Kopf',
    einheit: 'Verhältnis',
    sollwert: R(`^(${Z}) × h / (${Z}) × h$`),
    toleranz: TOL_H,
    async pruefe(k, w) {
      const waag = await k.kvk();
      const senk = await k.senkrecht();
      nah(
        (waag.b.yFrom - waag.b.tageskopfUnten) / hVon(waag),
        n(w.sollwert, 1),
        n(w.toleranz, 1),
        'waagrecht',
      );
      nah(
        (senk.b.yFrom - senk.b.tageskopfUnten) / hVon(senk),
        n(w.sollwert, 2),
        n(w.toleranz, 1),
        'senkrecht',
      );
    },
  },
  'B-Kp-11': {
    titel: 'Band oberhalb 0500 = eine Stunde, ohne eigenen Streifen',
    einheit: 'Verhältnis',
    sollwert: VERH_H,
    toleranz: TOL_H,
    async pruefe(k, w) {
      const s = await k.kvk();
      const y0500 = s.an.skala.stunden[0] as { t: number; y: number };
      expect(y0500.t).toBe(300);
      nah((y0500.y - s.b.yFrom) / hVon(s), n(w.sollwert, 1), n(w.toleranz, 1), 'Band / h');
    },
  },
  'B-Kp-12': {
    titel: 'Rasterhöhe 0400 bis 2400 in h',
    einheit: 'Verhältnis',
    sollwert: VERH_H,
    toleranz: TOL_H,
    async pruefe(k, w) {
      const s = await k.kvk();
      nah((s.b.yTo - s.b.yFrom) / hVon(s), n(w.sollwert, 1), n(w.toleranz, 1), 'Raster / h');
    },
  },
  'B-Kp-13': {
    titel: 'Abstand Raster–Termine mit zwei Linien',
    einheit: 'Verhältnis',
    sollwert: VERH_H,
    toleranz: TOL_H,
    soll: R(`waagrechte Linien (${Z}) pt`),
    async pruefe(k, w) {
      const s = await k.kvk();
      nah((s.b.yT - s.b.yTo) / hVon(s), n(w.sollwert, 1), n(w.toleranz, 1), 'Abstand / h');
      for (const l of [s.b.rasterUnten, s.b.termineOberlinie]) {
        nah(l.widthPt, n(w.soll, 1), s.an.stile.rasterkante.breiteTol, 'Linienbreite');
      }
    },
  },
  'B-Kp-14': {
    titel: 'Höhe des Terminbereichs bis Rahmenunterkante',
    einheit: 'Verhältnis',
    sollwert: R(`^(${Z}) × h \\(inkl\\. «Was»-Zeile\\)$`),
    toleranz: TOL_H,
    async pruefe(k, w) {
      const s = await k.kvk();
      nah((s.b.yU - s.b.yT) / hVon(s), n(w.sollwert, 1), n(w.toleranz, 1), 'Termine / h');
    },
  },
  'B-Kp-15': {
    titel: 'Zeitachsspalten links und rechts gleich breit',
    einheit: 'Verhältnis',
    sollwert: R(`^(${Z}) % von W_R$`),
    toleranz: R(`^(${Z})–(${Z}) % \\(Spannweite Referenz\\); links = rechts ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const WR = s.b.rahmen.w;
      const l = s.b.a;
      const r = s.b.xS - s.b.xSa;
      for (const a of [l, r])
        imBereich((a / WR) * 100, n(w.toleranz, 1), n(w.toleranz, 2), 'Achse %');
      nah(l, r, n(w.toleranz, 3), 'links = rechts');
    },
  },
  'B-Kp-16': {
    titel: 'Seitenleistenbreite, unten zusätzlich über die rechte Zeitachse',
    einheit: 'Verhältnis',
    sollwert: R(`^(${Z}) % von W_R$`),
    toleranz: R(`^(${Z})–(${Z}) % \\(Spannweite Referenz\\)$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      imBereich(
        ((s.b.rechts - s.b.xS) / s.b.rahmen.w) * 100,
        n(w.toleranz, 1),
        n(w.toleranz, 2),
        'Seitenleiste %',
      );
      nah(
        s.b.termineOberlinie.bbox.x + s.b.termineOberlinie.bbox.w,
        s.b.xSa,
        0.5,
        'Termine enden an der rechten Achse',
      );
    },
  },
  'B-Kp-17': {
    titel: 'Kopf links «SCHWEIZER ARMEE» und Einheit auf derselben Zeile',
    kennung: '[K Q-012: fett]',
    einheit: 'pt',
    sollwert: R(`^x = Rahmen links \\+ (${Z}); Grundlinie = Rahmen oben \\+ (${Z}) h$`),
    toleranz: PT,
    soll: R('«<Einheit>»'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const t = genau(laeufeIm(s.info, kopf(s.b)), 'SCHWEIZER ARMEE');
      expect(t.bold).toBe(true);
      nah(t.x, s.b.rahmen.x + n(w.sollwert, 1), n(w.toleranz, 1), 'x');
      nah(t.baselineY, s.b.rahmen.y + n(w.sollwert, 2) * hVon(s), n(w.toleranz, 1), 'Grundlinie');
      const e = ersetze(zitate(w.z.soll)[0] ?? '', platzhalterWerte(s.plan));
      const ein = genau(
        laeufeIm(s.info, kopf(s.b)).filter((x) => !x.bold),
        e,
        'Einheit',
      );
      nah(ein.baselineY, t.baselineY, n(w.toleranz, 1), 'gleiche Zeile');
      expect(ein.x).toBeGreaterThan(t.x);
    },
  },
  'B-Kp-18': {
    titel: 'Kopf links Wochenzeile fett',
    einheit: 'pt',
    sollwert: R(`^Grundlinie = Kopf-Unterlinie − (${Z}) pt; x = Rahmen links \\+ (${Z}) pt$`),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const text = ersetze(zitate(w.z.soll)[0] ?? '', platzhalterWerte(s.plan));
      expect(text).toBe('Woche vom 28.09.2026 bis 04.10.2026 KW 40');
      const t = genau(laeufeIm(s.info, kopf(s.b)), text);
      expect(t.bold).toBe(true);
      nah(t.baselineY, s.b.yK - n(w.sollwert, 1), n(w.toleranz, 1), 'Grundlinie');
      nah(t.x, s.b.rahmen.x + n(w.sollwert, 2), n(w.toleranz, 1), 'x');
    },
  },
  'B-Kp-19': {
    titel: 'Rahmen um Titel und Beilage',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const r = titelRahmen(s, titelLauf(s));
      nah(r.widthPt, n(w.sollwert, 1), n(w.toleranz, 1), 'Rahmenbreite');
      const beilage = genau(laeufeIm(s.info, kopf(s.b)), `Beilage ${s.plan.beilage}`);
      expect(innerhalb(umriss(beilage), r.bbox)).toBe(true);
    },
  },
  'B-Kp-20': {
    titel: 'Masse des Titelrahmens',
    einheit: 'Verhältnis',
    sollwert: R(`^Höhe (${Z})–(${Z}) × h$`),
    toleranz: R(`^±(${Z}) h; Breite ±(${Z}) pt$`),
    soll: R(
      `^Höhe ≈ 1 h; Breite = längere Zeile \\+ 2 × (${Z}) pt; oben (${Z}) pt unter Rahmenoberkante$`,
    ),
    async pruefe(k, w) {
      const s = await k.kvk();
      const titel = titelLauf(s);
      const beilage = genau(laeufeIm(s.info, kopf(s.b)), `Beilage ${s.plan.beilage}`);
      const r = titelRahmen(s, titel).bbox;
      const h = hVon(s);
      imBereich(
        r.h / h,
        n(w.sollwert, 1) - n(w.toleranz, 1),
        n(w.sollwert, 2) + n(w.toleranz, 1),
        'Höhe / h',
      );
      nah(r.w, Math.max(titel.width, beilage.width) + 2 * n(w.soll, 1), n(w.toleranz, 2), 'Breite');
      nah(r.y, s.b.rahmen.y + n(w.soll, 2), n(w.toleranz, 2), 'Oberkante');
    },
  },
  'B-Kp-21': {
    titel: 'Titelrahmen waagrecht in der Rahmenbreite zentriert',
    einheit: 'pt',
    sollwert: R('^Mitte = W_R / 2$'),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const r = titelRahmen(s, titelLauf(s)).bbox;
      nah(r.x + r.w / 2, s.b.rahmen.x + s.b.rahmen.w / 2, n(w.toleranz, 1), 'Mitte');
    },
  },
  'B-Kp-22': {
    titel: 'Titel fett, erste Zeile im Rahmen zentriert',
    einheit: 'Text',
    sollwert: R('^fett$'),
    toleranz: R(`^Mitte ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const text = ersetze(zitate(w.z.soll)[0] ?? '', platzhalterWerte(s.plan));
      const t = genau(laeufeIm(s.info, kopf(s.b)), text);
      expect(t.bold).toBe(true);
      const r = titelRahmen(s, t).bbox;
      nah(mitteX(t), r.x + r.w / 2, n(w.toleranz, 1), 'Mitte');
      const beilage = genau(laeufeIm(s.info, kopf(s.b)), `Beilage ${s.plan.beilage}`);
      expect(t.baselineY).toBeLessThan(beilage.baselineY);
    },
  },
  'B-Kp-23': {
    titel: 'Beilage normal, zweite Zeile im Rahmen zentriert',
    einheit: 'Text',
    sollwert: R('^normal$'),
    toleranz: R(`^Mitte ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const text = ersetze(zitate(w.z.soll)[0] ?? '', platzhalterWerte(s.plan));
      const t = genau(laeufeIm(s.info, kopf(s.b)), text);
      expect(t.bold).toBe(false);
      const r = titelRahmen(s, titelLauf(s)).bbox;
      expect(innerhalb(umriss(t), r)).toBe(true);
      nah(mitteX(t), r.x + r.w / 2, n(w.toleranz, 1), 'Mitte');
    },
  },
  'B-Kp-24': {
    titel: 'Klassifizierung als eigenes gerahmtes Feld nur wenn gesetzt',
    einheit: 'Text',
    sollwert: R(`^Rahmen (${Z}) pt; Text fett, zentriert$`),
    toleranz: R('^exakt \\(vorhanden/nicht vorhanden\\)$'),
    async pruefe(k, w) {
      const ohne = await k.kvk();
      const mit = await k.plus();
      const breite = n(w.sollwert, 1);
      const rahmenMit = (s: Seite) =>
        striche(s.info).filter(
          (x) =>
            x.kind === 'rect' && nahe(x.widthPt, breite, 0.01) && innerhalb(x.bbox, kopf(s.b), 0.5),
        );
      const t = genau(laeufeIm(mit.info, kopf(mit.b)), mit.plan.classification);
      expect(t.bold).toBe(true);
      const r = rahmenMit(mit).filter((x) => innerhalb(umriss(t), x.bbox));
      expect(r.length).toBe(1);
      nah(
        mitteX(t),
        (r[0] as PdfStroke).bbox.x + (r[0] as PdfStroke).bbox.w / 2,
        0.01,
        'zentriert',
      );
      const titel = titelLauf(ohne);
      expect(rahmenMit(ohne).filter((x) => !innerhalb(umriss(titel), x.bbox))).toEqual([]);
      expect(laeufe(ohne.info).filter((x) => x.text.trim() === mit.plan.classification)).toEqual(
        [],
      );
    },
  },
  'B-Kp-25': {
    titel: 'Einheit normal rechtsbündig im Kopf',
    einheit: 'pt',
    sollwert: R(`^rechte Textkante = Rahmen rechts − (${Z})$`),
    toleranz: PT,
    soll: R('«<Einheit>»'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const text = ersetze(zitate(w.z.soll)[0] ?? '', platzhalterWerte(s.plan));
      const t = genau(
        laeufeIm(s.info, kopf(s.b)).filter((x) => !x.bold),
        text,
      );
      nah(rechts(t), s.b.rechts - n(w.sollwert, 1), n(w.toleranz, 1), 'rechte Kante');
    },
  },
  'B-Kp-26': {
    titel: 'Stand und Datum fett im Stand-Feld, schwarz',
    einheit: 'pt / sRGB',
    sollwert: R(
      `^x\\(«Stand»\\) = Seitenleiste links ±(${Z}); Grundlinie = Rahmen oben \\+ (${Z}) h; (#[0-9A-F]{6})$`,
    ),
    toleranz: R(`^±(${Z}) pt; Farbe exakt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const ls = laeufeIm(s.info, kopf(s.b));
      const stand = genau(ls, 'Stand');
      const datum = genau(ls, '17.09.2026');
      nah(stand.x, s.b.xS, n(w.sollwert, 1), 'x(«Stand»)');
      nah(
        stand.baselineY,
        s.b.rahmen.y + n(w.sollwert, 2) * hVon(s),
        n(w.toleranz, 1),
        'Grundlinie',
      );
      const farbe = ausHex(w.sollwert[3] ?? '');
      for (const t of [stand, datum]) {
        expect(t.bold).toBe(true);
        expect(t.color).toEqual(farbe);
      }
      nah(datum.baselineY, stand.baselineY, 0.01, 'gleiche Grundlinie');
      nah(rechts(datum), rechts(einheit(s)), 0.01, 'Datum rechtsbündig (V21)');
    },
  },
  'B-Kp-27': ((p: Pruefer): Pruefer => ({
    ...p,
    toleranz: R(`^±(${Z}) pt; Enden ±(${Z}) pt$`),
    async pruefe(k, w) {
      await p.pruefe(k, w);
      const s = await k.kvk();
      const l = s.b.kopfUnterlinie;
      nah(l.bbox.x, s.b.rahmen.x, n(w.toleranz, 2), 'linkes Ende');
      nah(l.bbox.x + l.bbox.w, s.b.xS, n(w.toleranz, 2), 'rechtes Ende');
    },
  }))(
    strichPruefer('Kopf-Unterlinie von Rahmen links bis Seitenleiste', (s) => [s.b.kopfUnterlinie]),
  ),
  'B-Kp-28': {
    titel: 'Tageskopf voller Tag: Wochentag ausgeschrieben und Datum, fett',
    einheit: 'pt',
    sollwert: R(
      `^Wochentag x = Tag links \\+ (${Z}); Datum «dd\\.mm\\.yyyy» x = Tag links \\+ (${Z}) u$`,
    ),
    toleranz: PT,
    soll: R(`Grundlinie (${Z}) der Zeilenhöhe`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const sicht = sichtbareIndizes(s.plan);
      s.an.tage.forEach((t, j) => {
        const i = sicht[j] as number;
        if (woche(s.plan).days[i]?.display !== 'full') return;
        const zeile: Rect = {
          x: t.links,
          y: s.b.yK,
          w: t.rechts - t.links,
          h: s.b.tageskopfUnten - s.b.yK,
        };
        const ls = laeufeIm(s.info, zeile);
        const name = genau(ls, WOCHENTAG_LANG[i] as string);
        const [y, m, d] = (KVK_TAGE[i] as string).split('-');
        const datum = genau(ls, `${d}.${m}.${y}`);
        const u =
          (t.rechts - t.links) / spaltenDesTags(s.plan, i).reduce((a, c) => a + gewicht(c), 0);
        expect(name.bold && datum.bold).toBe(true);
        nah(name.x, t.links + n(w.sollwert, 1), n(w.toleranz, 1), `${name.text} x`);
        nah(datum.x, t.links + n(w.sollwert, 2) * u, n(w.toleranz, 1), `${datum.text} x`);
        nah(name.baselineY, s.b.yK + n(w.soll, 1) * zeile.h, n(w.toleranz, 1), 'Grundlinie');
      });
    },
  },
  'B-Kp-29': {
    titel: 'Tageskopf kompakter Tag «Sa dd.mm.yy» zentriert',
    einheit: 'pt',
    sollwert: R('^Mitte = Tagmitte$'),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const sa = ersetze(zitate(w.z.soll)[0] ?? '', platzhalterWerte(s.plan));
      expect(sa).toBe('Sa 03.10.26');
      for (const [i, text] of [
        [5, sa],
        [6, 'So 04.10.26'],
      ] as const) {
        const t = s.an.tage[i] as TagPdf;
        const r = genau(
          laeufeIm(s.info, {
            x: t.links,
            y: s.b.yK,
            w: t.rechts - t.links,
            h: s.b.tageskopfUnten - s.b.yK,
          }),
          text,
        );
        expect(r.bold).toBe(true);
        nah(mitteX(r), (t.links + t.rechts) / 2, n(w.toleranz, 1), 'Mitte');
      }
    },
  },
  'B-Kp-30': {
    titel: 'Achsköpfe «Zeit» fett in beiden Zeitachsen',
    einheit: 'Text',
    sollwert: R('^«(Zeit)»$'),
    toleranz: R('^exakt$'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const text = w.sollwert[1] ?? '';
      for (const [x0, x1] of [
        [s.b.rahmen.x, s.b.X0],
        [s.b.xSa, s.b.xS],
      ] as const) {
        const t = genau(
          laeufeIm(s.info, { x: x0, y: s.b.yK, w: x1 - x0, h: s.b.tageskopfUnten - s.b.yK }),
          text,
        );
        expect(t.bold).toBe(true);
      }
    },
  },
  'B-Kp-31': {
    titel: 'Spaltenköpfe waagrecht fett, in der Spalte zentriert',
    einheit: 'pt',
    sollwert: R('^Mitte = Spaltenmitte$'),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      let anzahl = 0;
      for (const t of s.an.tage) {
        t.spalten.forEach((sp, i) => {
          const ls = kopfLaeufe(s, sp);
          expect(ls.length, 'Kopf vorhanden').toBeGreaterThan(0);
          // S3-19 (c): Rap- und Beso-Köpfe (die letzten zwei Spalten des Tags) mit rotation 90 nach S3-18 sind von
          // «rotation 0» und der waagrechten Lageprüfung ausgenommen; ihre Lage prüft raster.test.ts.
          const rapOderBeso = i >= t.spalten.length - 2;
          for (const z of zeilen(ls)) {
            expect(z.laeufe.every((x) => x.bold)).toBe(true);
            anzahl++;
            if (rapOderBeso && z.rotation === 90) continue;
            // F-LAYOUT2 Punkt 12 («12: ja», Nebenspalte Gewicht 2): die Planungsspalten werden schmaler; ein Kopf, der
            // waagrecht auch in Mindestgrösse 4,5 pt nicht in die Spalte passt, steht nach Entscheid «2 a» senkrecht.
            if (
              z.rotation === 90 &&
              measureRuns([{ text: z.text, weight: 'bold' }], 4.5) > sp.w - 2 * 0.5 - 0.12
            )
              continue;
            expect(z.rotation).toBe(0);
            nah(z.x + z.breite / 2, sp.x + sp.w / 2, n(w.toleranz, 1), `Kopf «${z.text}»`);
          }
        });
      }
      expect(anzahl).toBeGreaterThanOrEqual(39);
    },
  },
  'B-Kp-32': {
    titel: 'Spaltenkopf senkrecht: um 90° gedreht, zentriert, unten bündig',
    einheit: 'Text',
    sollwert: R('^Drehwinkel (\\d+)°$'),
    toleranz: R(`^exakt; Mitte ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.senkrecht();
      for (const i of [2, 3, 4]) {
        const sp = spalteVon(s.an.tage[i] as TagPdf, 0);
        const ls = kopfLaeufe(s, sp);
        expect(ls.map((x) => x.text)).toEqual(['Kdo']);
        const t = ls[0] as PdfTextRun;
        expect(t.rotation).toBe(Number(w.sollwert[1]));
        expect(t.bold).toBe(true);
        nah(mitte(umriss(t)).x, sp.x + sp.w / 2, n(w.toleranz, 1), 'Mitte');
        nah(t.baselineY, s.b.yFrom - INSET, 0.01, 'unten bündig (E2: Kopf-Unterkante − 0,5)');
      }
    },
  },
  'B-Kp-33': {
    titel: 'Köpfe der Rap- und Beso-Spalte',
    kennung: '(F-42)',
    einheit: 'Text',
    sollwert: R('^«(Rap)» / «(Beso)» / «(Bes)»$'),
    toleranz: R('^exakt$'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const [rap, beso, bes] = [w.sollwert[1] ?? '', w.sollwert[2] ?? '', w.sollwert[3] ?? ''];
      s.an.tage.forEach((t, j) => {
        const m = t.spalten.length;
        expect(kopfLaeufe(s, spalteVon(t, m - 2)).map((x) => x.text)).toEqual([rap]);
        const b = spalteVon(t, m - 1);
        const kompakt =
          woche(s.plan).days[sichtbareIndizes(s.plan)[j] as number]?.display === 'compact';
        const nutz = b.w - 2 * INSET - (b.linksStrich.widthPt + b.rechtsStrich.widthPt) / 2;
        const passt =
          measureRuns([{ text: beso, weight: 'bold' }], kpTemplate().fontSizes.standard) <= nutz;
        expect(kopfLaeufe(s, b).map((x) => x.text)).toEqual([kompakt || !passt ? bes : beso]);
      });
    },
  },
  'B-Kp-34': {
    titel: 'Alle vollen Tage gleich breit',
    einheit: 'pt',
    sollwert: R('^gleich$'),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const voll = s.an.tage.filter(
        (_, j) => woche(s.plan).days[sichtbareIndizes(s.plan)[j] as number]?.display === 'full',
      );
      expect(voll.length).toBe(5);
      const b0 = (voll[0] as TagPdf).rechts - (voll[0] as TagPdf).links;
      for (const t of voll) nah(t.rechts - t.links, b0, n(w.toleranz, 1), 'Tagesbreite');
    },
  },
  'B-Kp-35': {
    titel: 'Kompakter Tag ein Drittel eines vollen Tags',
    einheit: 'Verhältnis',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z})$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const breite = (t: TagPdf) => t.rechts - t.links;
      const voll = breite(s.an.tage[0] as TagPdf);
      for (const i of [5, 6])
        nah(
          breite(s.an.tage[i] as TagPdf) / voll,
          n(w.sollwert, 1),
          n(w.toleranz, 1),
          'kompakt / voll',
        );
    },
  },
  'B-Kp-36': {
    titel: 'Ausgeblendeter Tag fehlt, übrige Tage füllen die Rasterbreite',
    einheit: 'pt',
    sollwert: R('^Summe Tagesbreiten = Rasterbreite$'),
    toleranz: PT,
    async pruefe(k, w) {
      await k.kvk();
      const s = await k.variante('sa-so-ausgeblendet', () =>
        mitTagen(kvk(), KVK_WOCHE, (d, i) => (i >= 5 ? { display: 'hidden' } : d)),
      );
      expect(s.an.tage.length).toBe(5);
      const summe = s.an.tage.reduce((a, t) => a + (t.rechts - t.links), 0);
      const W = s.b.xS - s.b.rahmen.x - 2 * s.b.a;
      nah(summe, W, n(w.toleranz, 1), 'Summe der Tagesbreiten');
      nah(s.b.xS - s.b.xSa, s.b.a, n(w.toleranz, 1), 'rechte Achse');
    },
  },
  'B-Kp-37': {
    titel: 'Spaltenbreiten nach Gewicht (schmal, normal, breit, Neben-, Rap-, Beso-Spalte)',
    einheit: 'Verhältnis',
    sollwert: R(`^(\\d+) : (\\d+) : (\\d+) : (\\d+) : (\\d+) : (\\d+)$`),
    toleranz: R(`^±(${Z}) pt je Spalte$`),
    async pruefe(k, w) {
      await k.kvk();
      // Sollwert aus B-Kp-37, an Stelle 4 (Nebenspalte) das Gewicht nach Entscheid «12: ja» (NEBENSPALTE_GEWICHT).
      const g = [1, 2, 3, 4, 5, 6].map((i) =>
        i === 4 ? NEBENSPALTE_GEWICHT : Number(w.sollwert[i]),
      );
      const satz = wochenSatz();
      const s = await k.variante('gewichte', () =>
        mitTagen(
          { ...leererKvk(), columnSets: [...leererKvk().columnSets, satz] },
          KVK_WOCHE,
          (d, i) => (i === 0 ? { columnSetId: satz.id } : d),
        ),
      );
      const t = s.an.tage[0] as TagPdf;
      const summe = g.reduce((a, b) => a + b, 0);
      t.spalten.forEach((sp, i) => {
        nah(
          sp.w,
          ((t.rechts - t.links) * (g[i] as number)) / summe,
          n(w.toleranz, 1),
          `Spalte ${i + 1}`,
        );
      });
      const kv = await k.kvk();
      for (const [i, j] of [
        [0, 0],
        [2, 2],
      ] as const) {
        const tag = kv.an.tage[j] as TagPdf;
        const cols = spaltenDesTags(kv.plan, i);
        const s2 = cols.reduce((a, c) => a + gewicht(c), 0);
        tag.spalten.forEach((sp, m) => {
          const soll = ((tag.rechts - tag.links) * gewicht(cols[m] as Column)) / s2;
          nah(sp.w, soll, n(w.toleranz, 1), `KVK Spalte ${m + 1}`);
        });
      }
    },
  },
  'B-Kp-38': strichPruefer(
    'Tagesgrenzen kräftig, von Tageskopf-Oberkante bis Rahmenunterkante',
    (s) => [...s.b.tagesgrenzen],
    (s, l) => {
      for (const g of l) nah(g.bbox.y, s.b.yK, 0.5, 'Beginn an der Tageskopf-Oberkante');
      const bisUnten = l.filter((g) => nahe(g.bbox.y + g.bbox.h, s.b.yU, 0.5));
      expect(bisUnten.length).toBe(l.length - 1);
    },
  ),
  'B-Kp-39': strichPruefer(
    'Spaltengrenzen der Planungsspalten fein, ab Spaltenkopf-Oberkante bis 2400',
    (s) =>
      s.an.tage.flatMap((t, j) => {
        const cols = spaltenDesTags(s.plan, sichtbareIndizes(s.plan)[j] as number);
        return t.spalten
          .slice(1)
          .flatMap((sp, m) => (cols[m + 1]?.kind === 'rap' ? [] : [sp.linksStrich]));
      }),
    (s, l) => {
      for (const x of l) {
        nah(x.bbox.y, s.b.tageskopfUnten, 0.5, 'Beginn');
        nah(x.bbox.y + x.bbox.h, s.b.yTo, 0.5, 'Ende 2400');
      }
    },
  ),
  'B-Kp-40': strichPruefer(
    'Grenze vor der Rap-Spalte gestrichelt',
    (s) =>
      s.an.tage.flatMap((t, j) => {
        const cols = spaltenDesTags(s.plan, sichtbareIndizes(s.plan)[j] as number);
        return t.spalten.flatMap((sp, m) => (cols[m]?.kind === 'rap' ? [sp.linksStrich] : []));
      }),
    undefined,
    true,
  ),
  'B-Kp-41': strichPruefer(
    'Bahngrenze in der Beso-Spalte, 0400–2400, nicht im Kopf',
    (s) => s.an.tage.flatMap((t) => [...t.bahngrenzen]),
    (s, l) => {
      expect(l.length).toBe(s.an.tage.length);
      s.an.tage.forEach((t) => {
        const b = spalteVon(t, t.spalten.length - 1);
        const g = t.bahngrenzen[0] as PdfStroke;
        nah(g.bbox.x, b.x + b.w / 2, 0.01, 'Mitte der Beso-Spalte');
        nah(g.bbox.y, s.b.yFrom, 0.01, 'ab 0400');
        nah(g.bbox.y + g.bbox.h, s.b.yTo, 0.01, 'bis 2400');
      });
    },
  ),
  'B-Kp-42': {
    titel: 'Zeit → y linear, y(0400) und y(2400) auf den Rasterbegrenzungen',
    einheit: 'pt',
    sollwert: R('^Residuum aller Stunden- und Halbstundenlinien$'),
    toleranz: R(`^≤ (${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const tol = n(w.toleranz, 1);
      expect(s.an.skala.residuum).toBeLessThanOrEqual(tol);
      nah(yVon(s.an.skala, 240), s.b.yFrom, tol, 'y(0400)');
      nah(yVon(s.an.skala, 1440), s.b.yTo, tol, 'y(2400)');
      expect(s.an.skala.halbstunden.length).toBe(20);
    },
  },
  'B-Kp-43': {
    titel: 'Jede waagrechte Kante eines Eintrags und jede Markerlinie auf ihrer Zeit',
    einheit: 'pt',
    sollwert: R('^\\|y − y\\(t\\)\\|$'),
    toleranz: R(`^≤ (${Z}) pt \\(≈ (${Z}) min\\)$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      // Träger einer Beschriftung neben dem Kästchen (E1-02l R2; F-LAYOUT2 Punkt 13 «13: ja»: Ort eines Rapports)
      // liegen im freien Bereich, nicht auf einer Zeit; sie sind keine Kante eines Eintrags.
      const traeger = s.layout.grid.entries
        .flatMap((e) => e.pieces)
        .filter((p) => p.kind === 'outsideLabel')
        .map((p) => p.rect);
      const istTraeger = (r: Rect) =>
        traeger.some(
          (t) =>
            Math.abs(t.x - r.x) < 0.05 &&
            Math.abs(t.y - r.y) < 0.05 &&
            Math.abs(t.w - r.w) < 0.05 &&
            Math.abs(t.h - r.h) < 0.05,
        );
      const kanten = s.an.inhalt.eintraege
        .filter((e) => e.klasse !== 'markerFeld' && !istTraeger(e.flaeche.rect))
        .flatMap((e) => [e.flaeche.rect.y, e.flaeche.rect.y + e.flaeche.rect.h]);
      const achsen = s.an.inhalt.markerLinien.map((m) => m.bbox.y);
      expect(kanten.length).toBeGreaterThan(0);
      expect(edgesOffTime([...kanten, ...achsen], s.an.skala, n(w.toleranz, 1))).toEqual([]);
    },
  },
  'B-Kp-44': {
    titel: 'Stundenbeschriftung 0500 bis 2300 links und rechts',
    einheit: 'pt',
    sollwert: R(`^Grundlinie − y\\(Linie\\) ∈ \\[(${Z}); (${Z})\\]$`),
    toleranz: R(`^Bereich wie Sollwert; Mitte ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      for (const [x0, x1] of [
        [s.b.rahmen.x, s.b.X0],
        [s.b.xSa, s.b.xS],
      ] as const) {
        const ls = laeufeIm(s.info, {
          x: x0,
          y: s.b.yFrom - 2,
          w: x1 - x0,
          h: s.b.yTo - s.b.yFrom + 4,
        }).sort((a, b) => a.baselineY - b.baselineY);
        expect(ls.map((t) => t.text)).toEqual(s.an.skala.stunden.map((x) => formatMilTime(x.t)));
        ls.forEach((t, i) => {
          expect(t.bold).toBe(true);
          imBereich(
            t.baselineY - (s.an.skala.stunden[i] as { y: number }).y,
            n(w.sollwert, 1),
            n(w.sollwert, 2),
            'Grundlinie − y',
          );
          nah(mitteX(t), (x0 + x1) / 2, n(w.toleranz, 1), 'Mitte');
        });
      }
    },
  },
  'B-Kp-45': strichPruefer(
    'Stundenlinien 0500–2300 gestrichelt über alle Tage',
    (s) => s.an.skala.stunden.map((x) => x.s),
    (s, l) => {
      expect(l.length).toBe(19);
      for (const x of l) {
        nah(x.bbox.x, s.b.X0, 0.01, 'über alle Tage');
        nah(x.bbox.x + x.bbox.w, s.b.xSa, 0.01, 'über alle Tage');
      }
    },
    true,
  ),
  'B-Kp-46': strichPruefer(
    'Halbstundenlinien 0430–2330 fein und durchgezogen',
    (s) => s.an.skala.halbstunden.map((x) => x.s),
    (s, l) => {
      expect(l.length).toBe(20);
      expect(s.an.skala.halbstunden[0]?.t).toBe(270);
    },
  ),
  'B-Kp-47': {
    titel: 'Keine Viertelstundenlinien',
    einheit: 'Anzahl',
    sollwert: R('^(\\d+)$'),
    toleranz: R('^exakt$'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const viertel: number[] = [];
      for (let t = 255; t < 1440; t += 30) viertel.push(yVon(s.an.skala, t));
      const linien = striche(s.info)
        .filter(istWaagrecht)
        .filter((x) => !passtStil(x, s.an.stile.markerLinie))
        .filter((x) => x.bbox.x < s.b.xSa && x.bbox.x + x.bbox.w > s.b.X0)
        .filter((x) => viertel.some((y) => Math.abs(y - x.bbox.y) < 0.25));
      expect(linien.length).toBe(Number(w.sollwert[1]));
    },
  },
  'B-Kp-48': strichPruefer(
    'Rasterbegrenzung oben und unten',
    (s) => [s.b.rasterOben, s.b.rasterUnten],
    (s, l) => {
      for (const x of l) {
        nah(x.bbox.x, s.b.rahmen.x, 0.5, 'Beginn');
        nah(x.bbox.x + x.bbox.w, s.b.xS, 0.5, 'Ende');
      }
    },
  ),
  'B-Kp-49': {
    titel: 'Blockfüllung deckend in der Legendenfarbe',
    einheit: 'sRGB',
    sollwert: R('^Legendenfarbe$'),
    toleranz: R('^exakt \\(#RRGGBB\\)$'),
    async pruefe(k) {
      const s = await k.kvk();
      const legende = s.plan.legend.map((c) => c.color);
      const bl = eintraege(s, 'block');
      expect(bl.length).toBeGreaterThan(0);
      for (const f of bl) expect(legende.some((c) => gleicheFarbe(c, f.fill))).toBe(true);
      const kategorien = new Set(
        Object.values(s.plan.entries).flatMap((e) => (e.type === 'block' ? [e.categoryId] : [])),
      );
      for (const id of kategorien) {
        expect(
          bl.some((f) => gleicheFarbe(f.fill, farbeVon(s.plan, id))),
          `Kategorie ${id}`,
        ).toBe(true);
      }
      const roh = s.info.strokes.filter((x) => x.fill !== null);
      expect(roh.length).toBeGreaterThan(0);
    },
  },
  'B-Kp-50': {
    titel: 'Blockrahmen dünn und schwarz',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      expect(eintraege(s, 'unbekannt')).toEqual([]);
      const bl = eintraege(s, 'block');
      expect(bl.length).toBeGreaterThan(50);
      for (const f of bl) {
        nah(f.rand ?? 0, n(w.sollwert, 1), n(w.toleranz, 1), 'Blockrahmen');
        expect(f.randFarbe).toEqual(SCHWARZ);
      }
    },
  },
  'B-Kp-51': {
    titel: 'Blocktext waagrecht zentriert, Textblock senkrecht zentriert',
    einheit: 'pt',
    sollwert: R(`^\\|Δx\\| ≤ (${Z}); Textmitte − Blockmitte (${Z}) … \\+(${Z})$`),
    toleranz: R('^wie Sollwert$'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const alle = s.an.inhalt.eintraege;
      let geprueft = 0;
      for (const e of alle.filter((x) => x.klasse === 'block' && !x.flaeche.offen)) {
        const f = e.flaeche;
        if (
          alle.some(
            (x) => x !== e && x.flaeche.order > f.order && schneidet(x.flaeche.rect, f.rect),
          )
        )
          continue;
        if (
          s.an.inhalt.markerLinien.some((m) =>
            schneidet({ ...m.bbox, y: m.bbox.y - 1, h: 2 }, f.rect),
          )
        )
          continue;
        const zs = zeilen(texteAuf(s, f)).sort((a, b) => a.baselineY - b.baselineY);
        if (zs.length === 0 || zs.some((z) => z.rotation !== 0)) continue;
        for (const z of zs)
          expect(Math.abs(z.x + z.breite / 2 - (f.rect.x + f.rect.w / 2))).toBeLessThanOrEqual(
            n(w.sollwert, 1) + 1e-9,
          );
        const erste = zs[0] as Zeile;
        const letzte = zs[zs.length - 1] as Zeile;
        const oberkante = erste.baselineY - ascentPt(erste.sizePt);
        const unterkante = letzte.baselineY - ascentPt(letzte.sizePt) + lineHeightPt(letzte.sizePt);
        const d = (oberkante + unterkante) / 2 - (f.rect.y + f.rect.h / 2);
        imBereich(d, n(w.sollwert, 2) - 0.01, n(w.sollwert, 3), 'Textmitte − Blockmitte');
        geprueft++;
      }
      expect(geprueft).toBeGreaterThan(10);
    },
  },
  'B-Kp-52': {
    titel: 'Blocktext Grundlinienabstand',
    einheit: 'Verhältnis',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z})$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      let paare = 0;
      for (const f of eintraege(s, 'block')) {
        const zs = zeilen(texteAuf(s, f))
          .filter((z) => z.rotation === 0)
          .sort((a, b) => a.baselineY - b.baselineY);
        for (let i = 1; i < zs.length; i++) {
          const a = zs[i - 1] as Zeile;
          const b = zs[i] as Zeile;
          if (!nahe(a.sizePt, b.sizePt, 0.001)) continue;
          nah(
            (b.baselineY - a.baselineY) / a.sizePt,
            n(w.sollwert, 1),
            n(w.toleranz, 1),
            'Abstand / Grösse',
          );
          paare++;
        }
      }
      expect(paare).toBeGreaterThan(0);
    },
  },
  'B-Kp-53': {
    titel: 'Blocktext: Titel fett, «Ltg (Ort)» normal auf einer Zeile ohne Präfix',
    einheit: 'Text',
    sollwert: R('^Titel fett; Ltg-Zeile normal$'),
    toleranz: R('^exakt$'),
    soll: R('«<Ltg> \\(<Ort>\\)»'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const muster = zitate(w.z.soll).find((x) => x.includes('<Ltg>')) ?? '';
      let gefunden = 0;
      for (const e of Object.values(s.plan.entries)) {
        if (e.type !== 'block' || e.ltg.trim() === '' || e.ort.trim() === '') continue;
        const text = ersetze(muster, { '<Ltg>': [e.ltg.trim()], '<Ort>': [e.ort.trim()] });
        const ls = laeufe(s.info).filter((t) => t.text.trim() === text);
        for (const t of ls) {
          expect(t.bold).toBe(false);
          expect(laeufeInKlasse(s, 'block')).toContain(t);
          gefunden++;
        }
      }
      expect(gefunden).toBeGreaterThan(0);
      const titel = laeufeInKlasse(s, 'block').filter((t) =>
        Object.values(s.plan.entries).some(
          (e) =>
            e.type === 'block' &&
            e.title.length === 1 &&
            e.title[0]?.bold === true &&
            e.title[0]?.text.trim() === t.text.trim(),
        ),
      );
      expect(titel.length).toBeGreaterThan(0);
      for (const t of titel) expect(t.bold).toBe(true);
    },
  },
  'B-Kp-54': {
    titel: 'Senkrechter Blocktext um 90° gedreht',
    einheit: 'Text',
    sollwert: R('^(\\d+)°$'),
    toleranz: R('^exakt$'),
    async pruefe(k, w) {
      const kv = await k.kvk();
      const grad = Number(w.sollwert[1]);
      for (const t of laeufeInKlasse(kv, 'block')) expect([0, grad]).toContain(t.rotation);
      const s = await k.variante('senkrechter-block', () =>
        eintagPlan([
          block('e930', 930, {
            date: MO,
            time: { form: 'range', from: 480, to: 720 },
            columns: { kind: 'ids', ids: [EINTAG.p1] },
            title: rt('Senkrecht', true),
            textDirection: 'vertical',
          }),
        ]),
      );
      const t = laeufe(s.info).filter((x) => x.text.trim() === 'Senkrecht');
      expect(t.map((x) => x.rotation)).toEqual([grad]);
    },
  },
  'B-Kp-57': {
    titel: 'Rapportkästchen in der Rap-Spalte, volle Breite, Höhe = Dauer, mindestens 0,5 h',
    einheit: 'Verhältnis',
    sollwert: R(`^Breite (${Z}) u; Höhe ≥ (${Z}) × h$`),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const boxen = eintraege(s, 'rapportBox');
      expect(boxen.length).toBe(7);
      const tmpl = kpTemplate();
      for (const f of boxen) {
        const j = s.an.tage.findIndex(
          (t) => mitte(f.rect).x > t.links && mitte(f.rect).x < t.rechts,
        );
        const t = s.an.tage[j] as TagPdf;
        const rap = spalteVon(t, t.spalten.length - 2);
        nah(f.rect.w, n(w.sollwert, 1) * rap.w, n(w.toleranz, 1), 'Breite = Rap-Spalte');
        nah(f.rect.x, rap.x, n(w.toleranz, 1), 'in der Rap-Spalte');
        expect(f.rect.h).toBeGreaterThanOrEqual(n(w.sollwert, 2) * hVon(s) - n(w.toleranz, 1));
        const d = KVK_TAGE[sichtbareIndizes(s.plan)[j] as number] as string;
        const passend = Object.values(s.plan.entries).filter(
          (e) => e.type === 'rapport' && e.display !== 'onlyInColumns' && e.date === d,
        );
        expect(
          passend.some((e) => {
            const sp = gezeichneteSpanne(e, d, s.plan, tmpl)[0];
            return (
              sp !== undefined &&
              nahe(f.rect.h, (sp.to - sp.from) * s.an.skala.ptPerMinute, n(w.toleranz, 1))
            );
          }),
        ).toBe(true);
      }
    },
  },
  'B-Kp-58': {
    titel: 'Rapportrahmen dünn wie der Blockrahmen (Rapportkästchen nach Lage)',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: PT,
    soll: R('wie der Blockrahmen \\(B-Kp-50\\)'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const boxen = eintraege(s, 'rapportBox');
      expect(boxen.length).toBe(7);
      const block = eintraege(s, 'block')[0];
      expect(block?.rand ?? null, 'Blockrahmen').not.toBeNull();
      for (const f of boxen) {
        nah(f.rand ?? 0, n(w.sollwert, 1), n(w.toleranz, 1), 'Rapportrahmen');
        expect(f.randFarbe).toEqual(SCHWARZ);
        nah(f.rand ?? 0, block?.rand ?? Number.NaN, 0.01, 'Rapportrahmen = Blockrahmen');
      }
    },
  },
  'B-Kp-59': {
    titel: 'Rapportkürzel fett, waagrecht zentriert, oben; Ort in Klammern darunter',
    einheit: 'pt',
    sollwert: R(`^fett; \\|Δx\\| ≤ (${Z})$`),
    toleranz: R('^wie Sollwert$'),
    async pruefe(k, w) {
      const s = await k.kvk();
      for (const f of eintraege(s, 'rapportBox')) {
        const zs = zeilen(texteAuf(s, f)).sort((a, b) => a.baselineY - b.baselineY);
        expect(zs.length).toBeGreaterThan(0);
        const kuerzel = zs[0] as Zeile;
        expect(kuerzel.laeufe.every((t) => t.bold)).toBe(true);
        expect(
          Math.abs(kuerzel.x + kuerzel.breite / 2 - (f.rect.x + f.rect.w / 2)),
        ).toBeLessThanOrEqual(n(w.sollwert, 1) + 1e-9);
      }
      const v = await k.variante('rapport-ort', () =>
        eintagPlan([
          rapport('e931', 931, {
            date: MO,
            code: 'KR',
            ort: 'Kaserne',
            time: { form: 'range', from: 600, to: 660 },
            categoryId: CAT.zfhr,
            display: 'rapColumn',
          }),
        ]),
      );
      const box = eintraege(v, 'rapportBox');
      expect(box.length).toBe(1);
      const zs = zeilen(texteAuf(v, box[0] as Flaeche)).sort((a, b) => a.baselineY - b.baselineY);
      expect(zs.map((z) => z.text.trim())).toEqual(['KR', '(Kaserne)']);
      expect((zs[1] as Zeile).laeufe.every((t) => !t.bold)).toBe(true);
    },
  },
  'B-Kp-60': {
    titel: 'Beso-Kästchen eine Bahn breit und 30 Minuten hoch',
    einheit: 'Verhältnis',
    sollwert: R(`^(${Z}) u × (${Z}) h$`),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const boxen = eintraege(s, 'besoBox');
      expect(boxen.length).toBe(24);
      for (const f of boxen) {
        const t = s.an.tage.find(
          (x) => mitte(f.rect).x > x.links && mitte(f.rect).x < x.rechts,
        ) as TagPdf;
        const beso = spalteVon(t, t.spalten.length - 1);
        const u = beso.w / 2;
        nah(f.rect.w, n(w.sollwert, 1) * u, n(w.toleranz, 1), 'Breite');
        nah(f.rect.h, n(w.sollwert, 2) * hVon(s), n(w.toleranz, 1), 'Höhe');
      }
    },
  },
  'B-Kp-61': {
    titel: 'Beso-Kästchen mit feinem schwarzem Rahmen',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const boxen = eintraege(s, 'besoBox');
      expect(boxen.length).toBe(24);
      for (const f of boxen) {
        nah(f.rand ?? 0, n(w.sollwert, 1), n(w.toleranz, 1), 'Rahmen');
        expect(f.randFarbe).toEqual(SCHWARZ);
      }
    },
  },
  'B-Kp-62': {
    titel: 'Beso-Kästchen in der Farbe der Leitungskategorie',
    einheit: 'sRGB',
    sollwert: R('^Legendenfarbe$'),
    toleranz: R('^exakt$'),
    async pruefe(k) {
      const s = await k.kvk();
      for (const f of eintraege(s, 'besoBox')) expect(f.fill).toEqual(farbeVon(s.plan, CAT.kp));
    },
  },
  'B-Kp-63': {
    titel: 'Beso-Nummer normal, im Kästchen zentriert',
    einheit: 'pt',
    sollwert: R(`^normal; \\|Δx\\| ≤ (${Z}); senkrecht zentriert ±(${Z})$`),
    toleranz: R('^wie Sollwert$'),
    async pruefe(k, w) {
      const s = await k.kvk();
      for (const f of eintraege(s, 'besoBox')) {
        const ls = texteAuf(s, f);
        expect(ls.length).toBe(1);
        const t = ls[0] as PdfTextRun;
        expect(t.bold).toBe(false);
        expect(Math.abs(mitteX(t) - (f.rect.x + f.rect.w / 2))).toBeLessThanOrEqual(
          n(w.sollwert, 1) + 1e-9,
        );
        const oberkante = t.baselineY - ascentPt(t.sizePt);
        const m = oberkante + lineHeightPt(t.sizePt) / 2;
        expect(Math.abs(m - (f.rect.y + f.rect.h / 2))).toBeLessThanOrEqual(
          n(w.sollwert, 2) + 1e-9,
        );
      }
    },
  },
  'B-Kp-64': {
    titel: 'Zweites gleichzeitiges Beso-Kästchen in der rechten Bahn ohne Überlappung',
    einheit: 'pt',
    sollwert: R(`^Bahn 1 x = Beso-Spalte links; Bahn 2 x = \\+ (${Z}) u$`),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const boxen = eintraege(s, 'besoBox');
      let paare = 0;
      for (const a of boxen) {
        for (const b of boxen) {
          if (a === b || a.rect.x >= b.rect.x) continue;
          if (!(a.rect.y < b.rect.y + b.rect.h && b.rect.y < a.rect.y + a.rect.h)) continue;
          const t = s.an.tage.find(
            (x) => mitte(a.rect).x > x.links && mitte(a.rect).x < x.rechts,
          ) as TagPdf;
          // Nur Kästchen derselben Beso-Spalte (desselben Tags) bilden ein Paar.
          if (!(mitte(b.rect).x > t.links && mitte(b.rect).x < t.rechts)) continue;
          const beso = spalteVon(t, t.spalten.length - 1);
          nah(a.rect.x, beso.x, n(w.toleranz, 1), 'Bahn 1');
          nah(b.rect.x, beso.x + n(w.sollwert, 1) * (beso.w / 2), n(w.toleranz, 1), 'Bahn 2');
          expect(schneidet(a.rect, b.rect)).toBe(false);
          paare++;
        }
      }
      expect(paare).toBeGreaterThan(0);
    },
  },
  'B-Kp-65': {
    titel: 'Markerlinie kräftig über die gewählten Spalten',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const alle = striche(s.info)
        .filter(istWaagrecht)
        .filter((x) => innerhalb({ ...x.bbox, h: 0 }, raster(s.b), 0.01))
        .filter((x) => x.widthPt > 1);
      expect(alle.length).toBe(9);
      for (const l of alle) {
        nah(l.widthPt, n(w.sollwert, 1), n(w.toleranz, 1), 'Breite');
        expect(l.color).toEqual(SCHWARZ);
        const mx = l.bbox.x + l.bbox.w / 2;
        const t = s.an.tage.find((x) => mx > x.links && mx < x.rechts) as TagPdf;
        const j = s.an.tage.indexOf(t);
        const cols = spaltenDesTags(s.plan, sichtbareIndizes(s.plan)[j] as number);
        const plan = t.spalten.filter((_, m) => cols[m]?.kind === 'planning');
        nah(l.bbox.x, (plan[0] as { x: number }).x, 0.1, 'Beginn erste Planungsspalte');
        const letzte = plan[plan.length - 1] as { x: number; w: number };
        nah(l.bbox.x + l.bbox.w, letzte.x + letzte.w, 0.1, 'Ende letzte Planungsspalte');
      }
    },
  },
  'B-Kp-66': {
    titel: 'Beschriftungsfeld des Markers',
    kennung: '(V-02d-13, V-02d-18)',
    einheit: 'Verhältnis',
    sollwert: R(`^(${Z}) u × (${Z}) h; Oberkante = Linie \\+ (${Z}) pt$`),
    toleranz: R(`^Breite ±(${Z}) pt; Höhe ±(${Z}) h; Mitte ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const felder = eintraege(s, 'markerFeld');
      expect(felder.length).toBeGreaterThan(0);
      const S = kpTemplate().fontSizes.standard;
      let geprueft = 0;
      for (const m of Object.values(s.plan.entries)) {
        if (m.type !== 'marker') continue;
        const j = sichtbareIndizes(s.plan).indexOf(
          KVK_TAGE.indexOf(m.date as (typeof KVK_TAGE)[number]),
        );
        const t = s.an.tage[j] as TagPdf;
        const Y = yVon(s.an.skala, Math.min(Math.max(m.at, 300), 1440));
        const linie = s.an.inhalt.markerLinien.find(
          (l) => nahe(l.bbox.y, Y, 0.1) && l.bbox.x >= t.links - 0.01 && l.bbox.x < t.rechts,
        );
        expect(linie, `Linie ${m.id}`).toBeDefined();
        const f = felder.find(
          (x) =>
            x.rect.x >= t.links - 0.01 &&
            x.rect.x < t.rechts &&
            (nahe(x.rect.y, Y + n(w.sollwert, 3), 0.01) ||
              nahe(x.rect.y + x.rect.h, Y - n(w.sollwert, 3), 0.01)),
        );
        if (f === undefined) continue;
        const cols = spaltenDesTags(s.plan, sichtbareIndizes(s.plan)[j] as number);
        const unit = (t.rechts - t.links) / cols.reduce((a, c) => a + gewicht(c), 0);
        const label = markerLabel(m, s.plan);
        const lauf = (linie as PdfStroke).bbox.w;
        const breite = Math.min(
          lauf,
          Math.max(
            n(w.sollwert, 1) * unit,
            measureRuns([{ text: label, weight: 'bold' }], S) + 2 * INSET,
          ),
        );
        const hoehe = Math.max(
          n(w.sollwert, 2) * hVon(s),
          lineHeightPt(S) + 2 * (INSET + (f.rand ?? 0) / 2),
        );
        nah(f.rect.w, breite, n(w.toleranz, 1), 'Breite (V-02d-13)');
        nah(f.rect.h, hoehe, n(w.toleranz, 2) * hVon(s), 'Höhe (V-02d-18)');
        nah(
          f.rect.x + f.rect.w / 2,
          (linie as PdfStroke).bbox.x + lauf / 2,
          n(w.toleranz, 3),
          'Mitte',
        );
        geprueft++;
      }
      expect(geprueft).toBeGreaterThan(5);
    },
  },
  'B-Kp-67': {
    titel: 'Beschriftungsfeld: Rahmen wie Blockrahmen, Füllung Ltg Kp',
    einheit: 'pt / sRGB',
    sollwert: R(`^(${Z}) pt; (#[0-9A-F]{6})$`),
    toleranz: R(`^±(${Z}) pt; Farbe exakt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const felder = eintraege(s, 'markerFeld');
      expect(felder.length).toBeGreaterThan(0);
      for (const f of felder) {
        nah(f.rand ?? 0, n(w.sollwert, 1), n(w.toleranz, 1), 'Rahmen');
        expect(f.fill).toEqual(ausHex(w.sollwert[2] ?? ''));
      }
    },
  },
  'B-Kp-68': {
    titel: 'Markerbeschriftung fett und zentriert',
    einheit: 'Text',
    sollwert: R('^fett$'),
    toleranz: R(`^Mitte ±(${Z}) pt$`),
    soll: R('«ABV <hhmm>»'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const abv = zitate(w.z.soll).find((x) => x.includes('<hhmm>')) ?? '';
      let geprueft = 0;
      for (const f of eintraege(s, 'markerFeld')) {
        const ls = texteAuf(s, f);
        if (ls.length === 0) continue;
        const z = zeilen(ls)[0] as Zeile;
        expect(z.laeufe.every((t) => t.bold)).toBe(true);
        expect(Math.abs(z.x + z.breite / 2 - (f.rect.x + f.rect.w / 2))).toBeLessThanOrEqual(
          n(w.toleranz, 1) + 1e-9,
        );
        const moeglich = Object.values(s.plan.entries).flatMap((m) =>
          m.type !== 'marker'
            ? []
            : [
                m.kind === 'ABV'
                  ? ersetze(abv, { '<hhmm>': [formatMilTime(m.at)] })
                  : markerLabel(m, s.plan),
              ],
        );
        expect(moeglich).toContain(z.text.trim());
        geprueft++;
      }
      expect(geprueft).toBeGreaterThan(5);
    },
  },
  'B-Kp-69': {
    titel: 'Querbalken im Band, unterste Lage 0430–0500, 0,5 h hoch',
    einheit: 'Verhältnis',
    sollwert: R(`^Höhe (${Z}) × h$`),
    toleranz: TOL_H,
    async pruefe(k, w) {
      await k.kvk();
      const s = await k.plus();
      const q = eintraege(s, 'querbalken');
      expect(q.length).toBe(1);
      const f = q[0] as Flaeche;
      nah(f.rect.h / hVon(s), n(w.sollwert, 1), n(w.toleranz, 1), 'Höhe / h');
      nah(
        f.rect.y + f.rect.h,
        yVon(s.an.skala, 300),
        n(w.toleranz, 1) * hVon(s),
        'Unterkante = y(0500)',
      );
    },
  },
  'B-Kp-70': {
    titel: 'Querbalken: Füllung der Kategorie, feiner Rahmen',
    einheit: 'pt',
    sollwert: R(`^(${Z}) pt$`),
    toleranz: PT,
    async pruefe(k, w) {
      await k.kvk();
      const s = await k.plus();
      const f = eintraege(s, 'querbalken')[0] as Flaeche;
      expect(f).toBeDefined();
      nah(f.rand ?? 0, n(w.sollwert, 1), n(w.toleranz, 1), 'Rahmen');
      expect(f.fill).toEqual(farbeVon(s.plan, CAT.s2));
    },
  },
  'B-Kp-71': {
    titel: 'Querbalkentext eine Zeile, zentriert, Schwarz oder Weiss nach Füllung',
    einheit: 'pt',
    sollwert: R('^Mitte = Balkenmitte$'),
    toleranz: PT,
    async pruefe(k, w) {
      await k.kvk();
      const s = await k.plus();
      const f = eintraege(s, 'querbalken')[0] as Flaeche;
      const ls = texteAuf(s, f);
      expect(ls.map((t) => t.text.trim())).toEqual([KVK_PLUS_QUERBALKEN.titel]);
      const t = ls[0] as PdfTextRun;
      nah(mitteX(t), f.rect.x + f.rect.w / 2, n(w.toleranz, 1), 'Mitte');
      expect(t.color).toEqual(textFarbeAuf(f.fill));
    },
  },
  'B-Kp-72': {
    titel: 'Reihenfolge der Seitenleiste von oben',
    einheit: 'Reihenfolge',
    sollwert: R('^wie Soll$'),
    toleranz: R('^exakt \\(y-Reihenfolge\\)$'),
    async pruefe(k) {
      await k.kvk();
      const s = await k.plus();
      const ls = laeufe(s.info);
      const b = s.b;
      const stand = genau(laeufeIm(s.info, kopf(b)), 'Stand');
      const kopfOben = (t: PdfTextRun) => umriss(t).y;
      const imOben = laeufeIm(s.info, oben(b));
      const ziel = genau(imOben, 'Wochenziele');
      const grau = flaechen(s.info).filter(
        (f) =>
          gleicheFarbe(f.fill, hexAus('B-Kp-98')) &&
          f.rect.w > b.a + 1 &&
          innerhalb(f.rect, oben(b)),
      );
      expect(grau.length).toBe(1);
      const bem = genau(imOben, 'Bemerkungen');
      const legende = genau(imOben, 'Legende');
      const felder = legendenFelder(s);
      const folge = [
        kopfOben(stand),
        kopfOben(ziel),
        (grau[0] as Flaeche).rect.y,
        kopfOben(bem),
        kopfOben(legende),
        (felder[0] as Flaeche).rect.y,
      ];
      folge.forEach((y, i) => {
        if (i > 0)
          expect(y, `Element ${i + 1} unter Element ${i}`).toBeGreaterThan(folge[i - 1] as number);
      });
      // Unter der Rasterunterkante: Unterkanten streng steigend (wie R-10-21, J), alle unter y(to).
      const imUnten = laeufeIm(s.info, unten(b));
      const unterkante = (r: Rect) => r.y + r.h;
      const name = platzhalterWerte(s.plan)['<Grad Name Vorname>']?.[0] ?? '';
      const unterschrift = [s.plan.unit, name, s.plan.commander.funktion].map((t) =>
        umriss(genau(imUnten, t)),
      );
      const wappen = (s.info.imagePlacements[0] as { bbox: Rect }).bbox;
      const motto = umriss(genau(imUnten, s.plan.motto));
      const sonne = ['0735', '1645'].map((t) => umriss(genau(imUnten, t)));
      const unten2 = [
        Math.max(...unterschrift.map(unterkante)),
        unterkante(wappen),
        unterkante(motto),
        Math.max(...sonne.map(unterkante)),
      ];
      unten2.forEach((y, i) => {
        if (i > 0)
          expect(y, `Unterkante Element ${i + 1} unter Element ${i}`).toBeGreaterThan(
            unten2[i - 1] as number,
          );
      });
      for (const r of [...unterschrift, wappen, motto, ...sonne]) {
        expect(r.y).toBeGreaterThanOrEqual(b.yTo - 0.01);
      }
      expect(Math.min(...unterschrift.map((r) => r.y))).toBeGreaterThan(folge[5] as number);
      expect(ls.length).toBeGreaterThan(0);
    },
  },
  'B-Kp-73': {
    titel: '«Wochenziele» fett zentriert in der Zeile der Spaltenköpfe',
    einheit: 'pt',
    sollwert: R('^Mitte = Seitenleistenmitte$'),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const t = genau(laeufeIm(s.info, oben(s.b)), 'Wochenziele');
      expect(t.bold).toBe(true);
      nah(mitteX(t), (s.b.xS + s.b.rechts) / 2, n(w.toleranz, 1), 'Mitte');
      const m = mitte(umriss(t)).y;
      expect(m).toBeGreaterThan(s.b.tageskopfUnten);
      expect(m).toBeLessThan(s.b.yFrom);
    },
  },
  'B-Kp-74': {
    titel: 'Wochenziele als Aufzählung mit «- » und hängendem Einzug',
    kennung: '(Einzug ab Seitenleiste links)',
    einheit: 'pt',
    sollwert: R(`^x\\(«-»\\) = Seitenleiste links \\+ (${Z}); Einzug (${Z})$`),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const ziele = woche(s.plan).weekGoals;
      const titel = genau(laeufeIm(s.info, oben(s.b)), 'Wochenziele');
      const grenze = genau(laeufeIm(s.info, oben(s.b)), 'Bemerkungen');
      const zs = zeilen(
        laeufeIm(s.info, oben(s.b)).filter(
          (t) => t.baselineY > titel.baselineY + 0.01 && t.baselineY < grenze.baselineY - 0.01,
        ),
      ).sort((a, b) => a.baselineY - b.baselineY);
      const starts = zs.filter((z) => z.text.startsWith('- '));
      expect(starts.length).toBe(ziele.length);
      for (const z of starts) nah(z.x, s.b.xS + n(w.sollwert, 1), n(w.toleranz, 1), 'x(«-»)');
      const folge = zs.filter((z) => !z.text.startsWith('- '));
      expect(folge.length).toBeGreaterThan(0);
      for (const z of folge) nah(z.x, s.b.xS + n(w.sollwert, 2), n(w.toleranz, 1), 'Einzug');
    },
  },
  'B-Kp-75': {
    titel: 'Erhöhte Bereitschaft grau hinterlegt, gerahmt, Text fett zentriert',
    einheit: 'sRGB / pt',
    sollwert: R(`^Füllung (#[0-9A-F]{6}); Rahmen (${Z}); Höhe (${Z}) × h$`),
    toleranz: R(`^Farbe exakt; ±(${Z}) pt; ±(${Z}) h$`),
    async pruefe(k, w) {
      await k.kvk();
      const s = await k.plus();
      const farbe = ausHex(w.sollwert[1] ?? '');
      const f = flaechen(s.info).filter(
        (x) => gleicheFarbe(x.fill, farbe) && x.rect.w > s.b.a + 1 && innerhalb(x.rect, oben(s.b)),
      );
      expect(f.length).toBe(1);
      const r = f[0] as Flaeche;
      nah(r.rand ?? 0, n(w.sollwert, 2), n(w.toleranz, 1), 'Rahmen');
      nah(r.rect.h / hVon(s), n(w.sollwert, 3), n(w.toleranz, 2), 'Höhe / h');
      nah(r.rect.x, s.b.xS, 0.01, 'volle Breite links');
      nah(r.rect.x + r.rect.w, s.b.rechts, 0.01, 'volle Breite rechts');
      const t = genau(laeufeIm(s.info, r.rect), woche(s.plan).heightenedReadiness);
      expect(t.bold).toBe(true);
      nah(mitteX(t), r.rect.x + r.rect.w / 2, 0.01, 'zentriert');
    },
  },
  'B-Kp-76': {
    titel: 'Bemerkungen mit Titel, Spalten «Nr» und «Was», ohne Überlappung mit der Kürzelliste',
    einheit: 'pt',
    sollwert: R('^Unterkante Bemerkungen < Oberkante «Legende»$'),
    toleranz: R(`^≥ (${Z}) pt Abstand$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const ls = laeufeIm(s.info, oben(s.b));
      const titel = genau(ls, 'Bemerkungen');
      const nr = genau(ls, 'Nr');
      const was = genau(ls, 'Was');
      const legende = genau(ls, 'Legende');
      for (const t of [titel, nr, was]) expect(t.bold).toBe(true);
      nah(mitteX(titel), (s.b.xS + s.b.rechts) / 2, 0.5, 'Titel zentriert');
      const bem = norm(
        remarksForWeek(s.plan, KVK_WOCHE)
          .map((r) => r.text)
          .join(''),
      );
      const zeilenBem = ls.filter(
        (t) => t.baselineY > nr.baselineY && norm(t.text).length > 2 && bem.includes(norm(t.text)),
      );
      expect(zeilenBem.length).toBeGreaterThan(0);
      const unterkante = Math.max(...zeilenBem.map((t) => umriss(t).y + umriss(t).h));
      expect(umriss(legende).y - unterkante).toBeGreaterThanOrEqual(n(w.toleranz, 1));
    },
  },
  'B-Kp-77': {
    titel:
      'Kürzelliste «Legende»: Zeilenhöhe 0,5 h, Kürzelspalte = Zeitachsbreite, Kürzel fett, Bedeutung normal rechts auf der Kürzelgrundlinie',
    kennung: '(Q-045 d)',
    einheit: 'Verhältnis',
    sollwert: R(
      `^Zeilenhöhe (${Z}) × h; Kürzelspalte = Breite Zeitachsspalte; Bedeutung x = Spaltenlinie \\+ (${Z})$`,
    ),
    toleranz: R(`^±(${Z}) h; ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const ls = laeufeIm(s.info, oben(s.b));
      const titel = genau(ls, 'Legende');
      expect(titel.bold).toBe(true);
      nah(mitteX(titel), (s.b.xS + s.b.rechts) / 2, 0.5, 'Titel zentriert');
      const felder = legendenFelder(s);
      const kuerzel = abbreviationsForWeek(s.plan, KVK_WOCHE);
      const tabelle = striche(s.info)
        .filter(istWaagrecht)
        .filter((x) => nahe(x.bbox.x, s.b.xS, 0.5) && innerhalb(x.bbox, oben(s.b), 0.5))
        .map((x) => x.bbox.y)
        .sort((a, b) => a - b);
      const kRuns = ls.filter(
        (t) =>
          kuerzel.includes(t.text.trim()) &&
          t.baselineY > titel.baselineY &&
          umriss(t).x + umriss(t).w <= s.b.xS + s.b.a + 0.01,
      );
      expect(kRuns.length).toBe(kuerzel.length);
      for (const t of kRuns) {
        const m = mitte(umriss(t)).y;
        const ueber = Math.max(...tabelle.filter((y) => y <= m));
        const unter = Math.min(...tabelle.filter((y) => y >= m));
        nah(
          (unter - ueber) / hVon(s),
          n(w.sollwert, 1),
          n(w.toleranz, 1),
          `Zeilenhöhe «${t.text}» / h`,
        );
      }
      const senk = striche(s.info)
        .filter(istSenkrecht)
        .filter(
          (x) => nahe(x.bbox.x, s.b.xS + s.b.a, n(w.toleranz, 2)) && x.bbox.y >= umriss(titel).y,
        );
      expect(senk.length, 'senkrechte Linie nach der Kürzelspalte').toBeGreaterThan(0);
      const spalte = (senk[0] as PdfStroke).bbox.x;
      // Kürzelspalte: genau die Kürzel der Woche in ihrer Reihenfolge, fett.
      const zeilenK = ls
        .filter(
          (t) =>
            t.baselineY > titel.baselineY &&
            t.baselineY < (felder[0] as Flaeche).rect.y &&
            umriss(t).x + umriss(t).w <= spalte + 0.01,
        )
        .sort((a, b) => a.baselineY - b.baselineY);
      expect(zeilenK.map((t) => t.text.trim())).toEqual([...kuerzel]);
      // Bedeutung (R-10-53): Planfeld vor Vorlage; leer → kein Lauf; sonst normal auf der Kürzelgrundlinie.
      for (const t of zeilenK) {
        expect(t.bold).toBe(true);
        const soll = abbreviationMeaning(s.plan, t.text.trim(), kpTemplate());
        const rechtsDavon = zeilen(
          ls.filter((x) => x.x >= spalte - 0.01 && nahe(x.baselineY, t.baselineY, 0.01)),
        );
        if (soll === '') {
          expect(rechtsDavon, `«${t.text.trim()}» ohne Bedeutung`).toEqual([]);
          continue;
        }
        expect(rechtsDavon.length, `Bedeutung von «${t.text.trim()}»`).toBe(1);
        const z = rechtsDavon[0] as Zeile;
        expect(z.text.trim()).toBe(soll);
        expect(
          z.laeufe.every((x) => !x.bold),
          'Bedeutung normal',
        ).toBe(true);
        nah(
          z.x,
          spalte + n(w.sollwert, 2),
          n(w.toleranz, 2),
          `x der Bedeutung von «${t.text.trim()}»`,
        );
      }
      expect(
        zeilenK.some((t) => abbreviationMeaning(s.plan, t.text.trim(), kpTemplate()) !== ''),
        'KVK: mindestens eine Bedeutung',
      ).toBe(true);
    },
  },
  'B-Kp-78': {
    titel:
      'Tabellenlinien der Kürzelliste und Legende: auf voller Stunde im Stil der Stundenlinie, sonst durchgezogen; Kürzel-Spaltenlinie bis zur Raster-Unterlinie',
    einheit: 'pt',
    sollwert: R(`^(${Z}); an vollen Stunden Stil wie B-Kp-45$`),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const legende = genau(laeufeIm(s.info, oben(s.b)), 'Legende');
      const rs = leistenRegeln(s).filter((x) => x.bbox.y < s.b.yTo - 0.5);
      const yL = regelBei(rs, umriss(legende).y, 'ueber', '«Legende»').bbox.y;
      const tab = rs.filter((x) => x.bbox.y >= yL - 0.01);
      expect(tab.length).toBeGreaterThan(2);
      const stunden = stundenVon(s);
      for (const l of tab) {
        pruefeRegel(
          l,
          n(w.sollwert, 1),
          n(w.toleranz, 1),
          stunden,
          `Tabellenlinie y ${l.bbox.y.toFixed(2)}`,
        );
      }
      expect(
        tab.filter((l) => aufStunde(l.bbox.y, stunden)).length,
        'Tabellenlinien auf vollen Stunden',
      ).toBeGreaterThan(0);
      const senk = striche(s.info)
        .filter(istSenkrecht)
        .filter((x) => nahe(x.bbox.x, s.b.xS + s.b.a, endenTol()) && x.bbox.y >= yL - 0.01);
      expect(senk.length, 'senkrechte Linie nach der Kürzelspalte').toBe(1);
      const sp = senk[0] as PdfStroke;
      nah(sp.widthPt, n(w.sollwert, 1), n(w.toleranz, 1), 'Spaltenlinie');
      nah(
        sp.bbox.y,
        (tab[1] as PdfStroke).bbox.y,
        endenTol(),
        'Spaltenlinie ab der Unterlinie der Titelzeile',
      );
      nah(sp.bbox.y + sp.bbox.h, s.b.yTo, endenTol(), 'Spaltenlinie bis zur Raster-Unterlinie');
      // Vollständigkeit wie bisher (TR-E102k-05): jede Linie im Tabellenbereich (xS … Rahmen rechts, y_L … y(to),
      // ± 0,5) ausser der Seitenleistenlinie ist eine der geprüften Regeln, die Regel auf y(to) oder die
      // Kürzel-Spaltenlinie; alle Regeln mit Strich nach der Stundenregel.
      const amEnde = leistenRegeln(s).filter((x) => nahe(x.bbox.y, s.b.yTo, 0.5));
      for (const l of amEnde) {
        pruefeRegel(l, n(w.sollwert, 1), n(w.toleranz, 1), stunden, 'Regel auf y(to)');
      }
      const erlaubt = new Set<PdfStroke>([...tab, ...amEnde, sp]);
      const fremd = striche(s.info).filter(
        (x) =>
          x.kind === 'line' &&
          x !== s.b.seitenleistenLinie &&
          !erlaubt.has(x) &&
          x.bbox.x >= s.b.xS - 0.5 &&
          x.bbox.x + x.bbox.w <= s.b.rechts + 0.5 &&
          x.bbox.y >= yL - 0.5 &&
          x.bbox.y + x.bbox.h <= s.b.yTo + 0.5,
      );
      expect(
        fremd.map((x) => `(${x.bbox.x.toFixed(2)}, ${x.bbox.y.toFixed(2)}) ${x.widthPt}`),
        'weitere Linien im Tabellenbereich',
      ).toEqual([]);
    },
  },
  'B-Kp-79': {
    titel:
      'Legende: Farbfeld links, Beschriftung rechts, Reihenfolge der Vorlage, endet 0,5 h über 2400',
    einheit: 'Reihenfolge',
    sollwert: R('^(.+)$'),
    toleranz: R(`^exakt; Feld ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const namen = (w.sollwert[1] ?? '').split(',').map((x) => x.trim());
      expect(namen.length).toBe(5);
      const felder = legendenFelder(s);
      expect(felder.length).toBe(namen.length);
      const tol = n(w.toleranz, 1);
      felder.forEach((f, i) => {
        const kat = s.plan.legend.find((c) => c.name === namen[i]);
        expect(kat, `Kategorie ${namen[i]}`).toBeDefined();
        expect(f.fill).toEqual(kat?.color);
        expect(legendenText(s, f)?.text.trim()).toBe(kat?.legendLabel);
        expect(legendenText(s, f)?.bold).toBe(false);
        nah(f.rect.w, s.b.a, tol, 'Feldbreite');
        nah(f.rect.h, 0.5 * hVon(s), tol, 'Feldhöhe');
      });
      const letztes = felder[felder.length - 1] as Flaeche;
      nah(
        letztes.rect.y + letztes.rect.h,
        s.b.yTo - 0.5 * hVon(s),
        tol,
        'Ende 0,5 h über der Raster-Unterlinie',
      );
    },
  },
  'B-Kp-80': {
    titel: 'Neutrale Kategorie nicht in der Legende',
    einheit: 'Text',
    sollwert: R('^nicht vorhanden$'),
    toleranz: R('^exakt$'),
    async pruefe(k) {
      await k.kvk();
      const s = await k.plus();
      const neutral = s.plan.legend.find((c) => c.neutral);
      expect(neutral).toBeDefined();
      expect(eintraege(s, 'block').some((f) => gleicheFarbe(f.fill, neutral?.color ?? null))).toBe(
        true,
      );
      expect(legendenFelder(s).some((f) => gleicheFarbe(f.fill, neutral?.color ?? null))).toBe(
        false,
      );
      expect(
        laeufeIm(s.info, oben(s.b)).filter((t) => t.text.trim() === neutral?.legendLabel),
      ).toEqual([]);
      expect(laeufe(s.info).some((t) => t.text.trim() === KVK_PLUS_NEUTRAL.titel)).toBe(true);
    },
  },
  'B-Kp-81': {
    titel: 'Unterschriftblock linksbündig unter der Rasterunterkante',
    einheit: 'Verhältnis',
    sollwert: R(
      `^x = Seitenleiste-unten links \\+ (${Z}); Grundlinien (${Z}) h / (${Z}) h / (${Z}) h unter Terminbereich-Oberlinie; Zeilenabstand (${Z})$`,
    ),
    toleranz: R(`^±(${Z}) h; ±(${Z}) pt$`),
    soll: R('<Einheit>.*<Grad Name Vorname>.*<Funktion>'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const werte = platzhalterWerte(s.plan);
      const texte = ['<Einheit>', '<Grad Name Vorname>', '<Funktion>'].map((p) =>
        ersetze(p, werte),
      );
      const imUnten = laeufeIm(s.info, unten(s.b));
      const h = hVon(s);
      texte.forEach((t, i) => {
        const r = genau(imUnten, t);
        expect(r.bold).toBe(false);
        nah(r.x, s.b.xSa + n(w.sollwert, 1), n(w.toleranz, 2), `x «${t}»`);
        nah(
          r.baselineY,
          s.b.yT + n(w.sollwert, 2 + i) * h,
          n(w.toleranz, 1) * h,
          `Grundlinie «${t}»`,
        );
      });
      const name = genau(imUnten, texte[1] as string);
      const funktion = genau(imUnten, texte[2] as string);
      nah(
        funktion.baselineY - name.baselineY,
        n(w.sollwert, 5) * name.sizePt,
        n(w.toleranz, 2),
        'Zeilenabstand Name–Funktion',
      );
    },
  },
  'B-Kp-82': {
    titel: 'Wappen unter dem Unterschriftblock (Bildlage)',
    kennung: '(V-02e-12)',
    einheit: 'Verhältnis',
    sollwert: R(
      `^Breite (${Z}) × h; Höhe (${Z}) × h; Oberkante (${Z}) pt unter Grundlinie Funktion$`,
    ),
    toleranz: TOL_H,
    async pruefe(k, w) {
      await k.kvk();
      const s = await k.plus();
      expect(s.info.imagePlacements.length).toBe(1);
      const r = (s.info.imagePlacements[0] as { bbox: Rect }).bbox;
      const h = hVon(s);
      const tol = n(w.toleranz, 1) * h;
      const funktion = genau(laeufeIm(s.info, unten(s.b)), s.plan.commander.funktion);
      nah(r.w, n(w.sollwert, 1) * h, tol, 'Breite');
      nah(r.h, n(w.sollwert, 2) * h, tol, 'Höhe');
      nah(r.y, funktion.baselineY + n(w.sollwert, 3), tol, 'Oberkante');
      expect(innerhalb(r, unten(s.b))).toBe(true);
    },
  },
  'B-Kp-83': {
    titel: 'Motto unter dem Wappen, auf die Wappenmitte zentriert',
    einheit: 'pt',
    sollwert: R(`^Mitte = Wappenmitte; Grundlinie (${Z}) pt unter Wappen$`),
    toleranz: PT,
    async pruefe(k, w) {
      await k.kvk();
      const s = await k.plus();
      const r = (s.info.imagePlacements[0] as { bbox: Rect }).bbox;
      const m = genau(laeufeIm(s.info, unten(s.b)), s.plan.motto);
      expect(m.bold).toBe(false);
      nah(mitteX(m), r.x + r.w / 2, n(w.toleranz, 1), 'Mitte');
      nah(m.baselineY, r.y + r.h + n(w.sollwert, 1), n(w.toleranz, 1), 'Grundlinie');
    },
  },
  'B-Kp-84': {
    titel: 'Sonnenzeiten-Tabelle unten rechts mit Symbolen',
    einheit: 'Verhältnis',
    sollwert: R(
      `^Zelle (${Z}) × h hoch; Symbolzelle quadratisch; Wertzelle (${Z}) × Symbolzelle; Rahmen (${Z}) pt; Abstand zum Rahmen (${Z}) pt$`,
    ),
    toleranz: R(`^±(${Z}) h; ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const h = hVon(s);
      const zelle = n(w.sollwert, 1) * h;
      const strichBreite = n(w.sollwert, 3);
      const tab = striche(s.info).filter(
        (x) =>
          innerhalb(x.bbox, unten(s.b), 0.5) &&
          x.fill === null &&
          nahe(x.widthPt, strichBreite, 0.01),
      );
      expect(tab.length).toBeGreaterThan(0);
      const x0 = Math.min(...tab.map((x) => x.bbox.x));
      const y0 = Math.min(...tab.map((x) => x.bbox.y));
      const x1 = Math.max(...tab.map((x) => x.bbox.x + x.bbox.w));
      const y1 = Math.max(...tab.map((x) => x.bbox.y + x.bbox.h));
      nah(y1 - y0, 2 * zelle, 2 * n(w.toleranz, 1) * h, 'Tabellenhöhe (2 Zeilen)');
      nah(x1 - x0, zelle * (1 + n(w.sollwert, 2)), n(w.toleranz, 2), 'Tabellenbreite');
      nah(s.b.rechts - x1, n(w.sollwert, 4), n(w.toleranz, 2), 'Abstand rechts');
      nah(s.b.yU - y1, n(w.sollwert, 4), n(w.toleranz, 2), 'Abstand unten');
      const sym = striche(s.info)
        .filter(
          (x) =>
            x.kind === 'path' &&
            x.fill !== null &&
            innerhalb(x.bbox, { x: x0, y: y0, w: zelle, h: 2 * zelle }, 0.01),
        )
        .sort((a, b) => a.bbox.y - b.bbox.y);
      expect(sym.length).toBe(2);
      sym.forEach((x, i) => {
        const symbolZelle = { x: x0, y: y0 + i * zelle, w: zelle, h: zelle };
        expect(innerhalb(x.bbox, symbolZelle, 0.01)).toBe(true);
      });
      const werte = ['0735', '1645'].map((t) =>
        genau(laeufeIm(s.info, { x: x0 + zelle, y: y0, w: x1 - x0 - zelle, h: y1 - y0 }), t),
      );
      nah(rechts(werte[0] as PdfTextRun), rechts(werte[1] as PdfTextRun), 0.01, 'rechtsbündig');
    },
  },
  'B-Kp-85': {
    titel: 'Terminbereich von der Rahmenlinie bis zur rechten Zeitachse, bis Rahmenunterkante',
    einheit: 'pt',
    sollwert: R('^x wie Raster \\(ohne rechte Achsspalte\\)$'),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const l = s.b.termineOberlinie.bbox;
      nah(l.x, s.b.rahmen.x, n(w.toleranz, 1), 'links');
      nah(l.x + l.w, s.b.xSa, n(w.toleranz, 1), 'rechts');
      expect(s.b.yU).toBeGreaterThan(l.y);
    },
  },
  'B-Kp-86': {
    titel: '«Termine» fett, gedreht, in der linken Achse zentriert',
    einheit: 'pt',
    sollwert: R('^(\\d+)°; Mitte = Mitte Terminbereich$'),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const t = genau(laeufe(s.info), 'Termine');
      expect(t.bold).toBe(true);
      expect(t.rotation).toBe(Number(w.sollwert[1]));
      const m = mitte(umriss(t));
      nah(m.x, (s.b.rahmen.x + s.b.X0) / 2, n(w.toleranz, 1), 'Mitte x');
      nah(m.y, (s.b.yT + s.b.yU) / 2, n(w.toleranz, 1), 'Mitte y');
    },
  },
  'B-Kp-87': {
    titel: 'Kopf «Was» je Terminspalte mit Linie darunter',
    einheit: 'pt',
    sollwert: R(`^x = Tag links \\+ (${Z})$`),
    toleranz: R(`^±(${Z}) pt; Zeile ±(${Z}) h$`),
    soll: R(`Kopfzeile (${Z}) h mit Linie (${Z}) pt darunter`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const was = wasLaeufe(s);
      expect(was.length).toBe(6);
      was.forEach((t, i) => {
        expect(t.bold).toBe(true);
        nah(
          t.x,
          (s.b.tagesgrenzen[i] as PdfStroke).bbox.x + n(w.sollwert, 1),
          n(w.toleranz, 1),
          '«Was» x',
        );
      });
      nah((s.b.wasLinie - s.b.yT) / hVon(s), n(w.soll, 1), n(w.toleranz, 2), 'Kopfzeile / h');
      nah(s.b.wasLinieStrich.widthPt, n(w.soll, 2), s.an.stile.rasterkante.breiteTol, 'Linie');
    },
  },
  'B-Kp-88': {
    titel: 'Terminspalten genau unter den Tagen',
    einheit: 'pt',
    sollwert: R('^Kanten = Tagesgrenzen$'),
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const g = s.b.tagesgrenzen.map((x) => x.bbox.x);
      const spalten: [number, number][] = [0, 1, 2, 3, 4].map((i) => [
        g[i] as number,
        g[i + 1] as number,
      ]);
      spalten.push([g[5] as number, g[7] as number]);
      for (const t of laeufe(s.info).filter(
        (x) => umriss(x).y > s.b.wasLinie && umriss(x).x < s.b.xSa && umriss(x).x >= s.b.X0 - 0.01,
      )) {
        const u = umriss(t);
        expect(
          spalten.filter(
            ([a, b]) => u.x >= a - n(w.toleranz, 1) && u.x + u.w <= b + n(w.toleranz, 1),
          ).length,
        ).toBe(1);
      }
      s.b.tagesgrenzen.forEach((x, i) => {
        if (i !== 6)
          nah(x.bbox.y + x.bbox.h, s.b.yU, n(w.toleranz, 1), 'Tagesgrenze durch die Termine');
      });
    },
  },
  'B-Kp-89': {
    titel: 'Wochenende im Terminbereich einzeln oder zusammengefasst nach Einstellung',
    kennung: '[K F-10: KVK auto → zusammengefasst]',
    einheit: 'Text',
    sollwert: R('^S1: einzeln$'),
    toleranz: R('^exakt$'),
    async pruefe(k) {
      await k.kvk();
      const getrennt = await k.variante('we-separate', () =>
        mitWoche(kvk(), KVK_WOCHE, { agendaWeekend: 'separate' }),
      );
      const zusammen = await k.variante('we-combined', () =>
        mitWoche(kvk(), KVK_WOCHE, { agendaWeekend: 'combined' }),
      );
      expect(wasLaeufe(getrennt).length).toBe(7);
      expect(wasLaeufe(zusammen).length).toBe(6);
      const grenze = (s: Seite) => s.b.tagesgrenzen[6] as PdfStroke;
      nah(
        grenze(getrennt).bbox.y + grenze(getrennt).bbox.h,
        getrennt.b.yU,
        0.1,
        'getrennt bis unten',
      );
      nah(
        grenze(zusammen).bbox.y + grenze(zusammen).bbox.h,
        zusammen.b.yTo,
        0.1,
        'zusammengefasst bis 2400',
      );
    },
  },
  'B-Kp-90': {
    titel: 'Terminzeilen: erste Zeile x, erste Grundlinie unter der «Was»-Linie, Zeilenabstand',
    einheit: 'Verhältnis',
    sollwert: R(`^Zeilenabstand (${Z})$`),
    toleranz: R(`^±(${Z}); x ±(${Z}) pt$`),
    soll: R(`Erste Zeile x = Tag links \\+ (${Z})`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const g = s.b.tagesgrenzen.map((x) => x.bbox.x);
      const spalten: [number, number][] = [0, 1, 2, 3, 4].map((i) => [
        g[i] as number,
        g[i + 1] as number,
      ]);
      spalten.push([g[5] as number, g[7] as number]);
      let paare = 0;
      for (const [x0, x1] of spalten) {
        const zs = terminZeilen(s, x0, x1);
        if (zs.length === 0) continue;
        const erste = zs[0] as Zeile;
        nah(erste.x, x0 + n(w.soll, 1), n(w.toleranz, 2), 'erste Zeile x');
        expect(erste.baselineY).toBeGreaterThan(s.b.wasLinie);
        for (let i = 1; i < zs.length; i++) {
          const a = zs[i - 1] as Zeile;
          const b = zs[i] as Zeile;
          nah(
            (b.baselineY - a.baselineY) / a.sizePt,
            n(w.sollwert, 1),
            n(w.toleranz, 1),
            'Zeilenabstand',
          );
          paare++;
        }
      }
      expect(paare).toBeGreaterThan(10);
    },
  },
  'B-Kp-91': {
    titel: 'Hängender Einzug nach der Nummer',
    einheit: 'pt',
    sollwert: R('^x\\(Folgezeile\\) = x\\(erstes Zeichen nach Nr\\)$'),
    toleranz: PT,
    soll: R('«<Nr> »'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const muster = zitate(w.z.soll).find((x) => x.includes('<Nr>')) ?? '';
      const g = s.b.tagesgrenzen.map((x) => x.bbox.x);
      let folge = 0;
      for (let i = 0; i < 5; i++) {
        const d = KVK_TAGE[i] as string;
        const units = agendaLinesForDate(s.plan, d);
        const zs = terminZeilen(s, g[i] as number, g[i + 1] as number);
        let aktuell: { x: number; einzug: number } | null = null;
        for (const z of zs) {
          const beso = units.find(
            (u) =>
              u.number !== null &&
              z.text.startsWith(ersetze(muster, { '<Nr>': [String(u.number)] })),
          );
          const start = units.find(
            (u) =>
              norm(z.text).length > 3 &&
              norm(u.text.map((r) => r.text).join('')).startsWith(norm(z.text)),
          );
          if (beso !== undefined) {
            const prefix = ersetze(muster, { '<Nr>': [String(beso.number)] });
            aktuell = {
              x: z.x,
              einzug: measureRuns(
                [{ text: prefix, weight: (z.laeufe[0] as PdfTextRun).bold ? 'bold' : 'regular' }],
                z.sizePt,
              ),
            };
            continue;
          }
          if (start !== undefined && start.number === null) {
            aktuell = null;
            continue;
          }
          if (aktuell !== null) {
            nah(
              z.x,
              aktuell.x + aktuell.einzug,
              n(w.toleranz, 1),
              `Folgezeile «${z.text.slice(0, 12)}»`,
            );
            folge++;
          }
        }
      }
      expect(folge).toBeGreaterThan(5);
    },
  },
  'B-Kp-92': farbPruefer('Legenden- und Füllfarbe der ersten Kategorie', legendenFarbe(0)),
  'B-Kp-93': farbPruefer('Legenden- und Füllfarbe der zweiten Kategorie', legendenFarbe(1)),
  'B-Kp-94': farbPruefer('Legenden- und Füllfarbe der dritten Kategorie', legendenFarbe(2)),
  'B-Kp-95': farbPruefer('Legenden- und Füllfarbe der vierten Kategorie', legendenFarbe(3)),
  'B-Kp-96': farbPruefer('Legenden- und Füllfarbe der fünften Kategorie', legendenFarbe(4)),
  'B-Kp-97': farbPruefer('Füllfarbe der neutralen Kategorie', async (k, soll) => {
    const s = await k.plus();
    expect(s.plan.legend.find((c) => c.neutral)?.color).toEqual(soll);
    expect(eintraege(s, 'block').some((f) => gleicheFarbe(f.fill, soll))).toBe(true);
  }),
  'B-Kp-98': farbPruefer('Hintergrund der erhöhten Bereitschaft', async (k, soll) => {
    const s = await k.plus();
    const f = flaechen(s.info).filter(
      (x) => gleicheFarbe(x.fill, soll) && x.rect.w > s.b.a + 1 && innerhalb(x.rect, oben(s.b)),
    );
    expect(f.length).toBe(1);
  }),
  'B-Kp-99': farbPruefer('Linien und Texte schwarz', async (k, soll) => {
    const s = await k.kvk();
    // Ausnahme Status-Darstellung (Beschrieb 10 «Status», R-10-28; TE-I3-01 entschieden, Auftraggeber 19.10.2026
    // «1: ja», F-LAYOUT2): In der KVK-Fixture (alle Einträge bestätigt) ist nur der Feldwert «offen» rot (#c00000).
    const rot = { r: 192, g: 0, b: 0 };
    for (const t of s.info.texts) {
      expect(t.color, `Text «${t.text}»`).toEqual(t.text.trim() === 'offen' ? rot : soll);
    }
    for (const x of s.info.strokes.filter((y) => y.widthPt > 0)) expect(x.color).toEqual(soll);
  }),
  'B-Kp-101': {
    titel: 'Eine serifenlose eingebettete Schrift in Normal und Fett',
    einheit: 'Text',
    sollwert: R('^(Arimo) Regular/Bold \\(ADR-003\\)$'),
    toleranz: R('^exakt$'),
    async pruefe(k, w) {
      const s = await k.kvk();
      const name = w.sollwert[1] ?? '';
      const namen = [...new Set(s.info.fonts.map((f) => f.name))].sort();
      expect(namen).toEqual([name, `${name}-Bold`]);
      expect(s.info.fonts.every((f) => f.embedded)).toBe(true);
    },
  },
  'B-Kp-102': {
    titel: 'Standardtexte 5 pt, verkleinert bis 4,5 pt nur bei Platzmangel',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z}) pt \\(verkleinert bis (${Z}) nur bei Platzmangel, R-10-39\\)$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const soll = n(w.sollwert, 1);
      const tol = n(w.toleranz, 1);
      const fest = ['SCHWEIZER ARMEE', 'Zeit', 'Wochenziele', 'Bemerkungen', 'Legende', 'Nr'];
      for (const text of fest) {
        const ls = laeufe(s.info).filter((t) => t.text.trim() === text);
        expect(ls.length, text).toBeGreaterThan(0);
        for (const t of ls) nah(t.sizePt, soll, tol, text);
      }
      nah(einheit(s).sizePt, soll, tol, 'Einheit im Kopf');
      for (const c of s.plan.legend.filter((x) => x.inLegend && !x.neutral)) {
        for (const t of laeufe(s.info).filter((x) => x.text.trim() === c.legendLabel))
          nah(t.sizePt, soll, tol, c.legendLabel);
      }
      const termine = laeufe(s.info).filter(
        (t) => umriss(t).y > s.b.wasLinie && umriss(t).x < s.b.xSa && umriss(t).x >= s.b.X0,
      );
      expect(termine.length).toBeGreaterThan(0);
      for (const t of termine) imBereich(t.sizePt, n(w.toleranz, 2), soll + tol, 'Terminzeile');
    },
  },
  'B-Kp-103': groessenPruefer('Blocktitel fett 5,5 pt (kleiner nur nach S3-10)', async (s) => ({
    laeufe: laeufeInKlasse(s, 'block').filter((t) => t.bold),
    fett: true,
  })),
  'B-Kp-104': groessenPruefer('Beso-Nummer normal 5 pt', async (s) => ({
    laeufe: laeufeInKlasse(s, 'besoBox'),
    fett: false,
  })),
  'B-Kp-105': groessenPruefer('Rapportkürzel fett 5 pt', async (s) => ({
    laeufe: laeufeInKlasse(s, 'rapportBox').filter((t) => t.bold),
    fett: true,
  })),
  'B-Kp-106': {
    titel: 'Querbalken normal, Markerbeschriftung fett, je 5 pt',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: PT,
    async pruefe(k, w) {
      await k.kvk();
      const s = await k.plus();
      const q = laeufeInKlasse(s, 'querbalken');
      const m = laeufeInKlasse(s, 'markerFeld');
      expect(q.length).toBeGreaterThan(0);
      expect(m.length).toBeGreaterThan(0);
      for (const t of q) {
        expect(t.bold).toBe(false);
        pruefeEintragsGroesse(s, t, n(w.sollwert, 1), n(w.toleranz, 1), `Querbalken «${t.text}»`);
      }
      for (const t of m) {
        expect(t.bold).toBe(true);
        pruefeEintragsGroesse(s, t, n(w.sollwert, 1), n(w.toleranz, 1), `Marker «${t.text}»`);
      }
    },
  },
  'B-Kp-107': {
    titel: 'Kein Textlauf kleiner als die Mindestgrösse',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: R(`^≥ (${Z}) pt \\(exakt\\)$`),
    async pruefe(k, w) {
      for (const s of [await k.kvk(), await k.plus(), await k.senkrecht()]) {
        expect(minFontSize(s.info)).toBeGreaterThanOrEqual(n(w.sollwert, 1));
      }
    },
  },
  'B-Kp-108': {
    titel: 'Grössere Texte in ihrer Referenzgrösse',
    einheit: 'pt',
    sollwert: groessen108,
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const p = await k.plus();
      const tol = n(w.toleranz, 1);
      const wk = woche(s.plan);
      const pruefe = (info: PdfInfo, text: string, soll: number) => {
        const ls = laeufe(info).filter((t) => t.text.trim() === text);
        expect(ls.length, text).toBe(1);
        nah((ls[0] as PdfTextRun).sizePt, soll, tol, text);
      };
      pruefe(s.info, `${s.plan.unit} Arbeitsplan ${wk.label}`, n(w.sollwert, 1));
      pruefe(s.info, `Beilage ${s.plan.beilage}`, n(w.sollwert, 2));
      pruefe(s.info, 'Woche vom 28.09.2026 bis 04.10.2026 KW 40', n(w.sollwert, 3));
      pruefe(s.info, platzhalterWerte(s.plan)['<Grad Name Vorname>']?.[0] ?? '', n(w.sollwert, 4));
      pruefe(s.info, s.plan.commander.funktion, n(w.sollwert, 4));
      pruefe(s.info, s.plan.motto, n(w.sollwert, 5));
      pruefe(s.info, '0735', n(w.sollwert, 6));
      pruefe(s.info, '1645', n(w.sollwert, 6));
      pruefe(p.info, woche(p.plan).heightenedReadiness, n(w.sollwert, 7));
      const einheiten = laeufeIm(s.info, unten(s.b)).filter((t) => t.text.trim() === s.plan.unit);
      expect(einheiten.length).toBe(1);
      nah((einheiten[0] as PdfTextRun).sizePt, n(w.sollwert, 4), tol, 'Unterschrift Einheit');
    },
  },
  'B-Kp-109': {
    titel: '«Was» und «Termine» fett 5 pt',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const ls = [...wasLaeufe(s), genau(laeufe(s.info), 'Termine')];
      expect(ls.length).toBe(7);
      for (const t of ls) {
        expect(t.bold).toBe(true);
        nah(t.sizePt, n(w.sollwert, 1), n(w.toleranz, 1), t.text);
      }
    },
  },
  'B-Kp-110': {
    titel: 'Innerhalb einer Woche gleiche Grösse je Textart',
    einheit: 'pt',
    sollwert: R('^eine Grösse je Art$'),
    toleranz: R('^exakt, ausser verkleinerte \\(R-10-39\\)$'),
    async pruefe(k) {
      const s = await k.kvk();
      const arten: [string, PdfTextRun[]][] = [
        [
          'Stundenbeschriftung',
          laeufe(s.info).filter(
            (t) =>
              /^\d{4}$/.test(t.text.trim()) &&
              (umriss(t).x + umriss(t).w <= s.b.X0 ||
                (umriss(t).x >= s.b.xSa && umriss(t).x < s.b.xS)) &&
              umriss(t).y < s.b.yTo,
          ),
        ],
        ['Achskopf', laeufe(s.info).filter((t) => t.text.trim() === 'Zeit')],
        ['Was', wasLaeufe(s)],
        [
          'Tageskopf',
          laeufe(s.info).filter((t) => {
            const m = mitte(umriss(t));
            return m.y > s.b.yK && m.y < s.b.tageskopfUnten && m.x > s.b.X0 && m.x < s.b.xSa;
          }),
        ],
        [
          'Legende',
          s.plan.legend
            .filter((c) => c.inLegend && !c.neutral)
            .flatMap((c) => laeufe(s.info).filter((t) => t.text.trim() === c.legendLabel)),
        ],
        [
          'Überschriften',
          laeufeIm(s.info, oben(s.b)).filter((t) =>
            ['Wochenziele', 'Bemerkungen', 'Legende'].includes(t.text.trim()),
          ),
        ],
      ];
      for (const [art, ls] of arten) {
        expect(ls.length, art).toBeGreaterThan(1);
        const groessen = [...new Set(ls.map((t) => t.sizePt.toFixed(3)))];
        expect(groessen, art).toHaveLength(1);
      }
      const nummern = laeufeInKlasse(s, 'besoBox');
      const max = Math.max(...nummern.map((t) => t.sizePt));
      for (const t of nummern) expect(t.sizePt === max || stufe(t.sizePt, max)).toBe(true);
    },
  },
  'B-Kp-111': {
    titel: 'Text markier- und durchsuchbar',
    einheit: 'Text',
    sollwert: R('^vorhanden$'),
    toleranz: R('^exakt$'),
    async pruefe(k) {
      const s = await k.kvk();
      expect(s.info.fonts.length).toBeGreaterThan(0);
      expect(s.info.fonts.every((f) => f.toUnicode)).toBe(true);
      const alles = s.info.texts.map((t) => t.text).join(' ');
      for (const t of ['SCHWEIZER ARMEE', 'Termine', 'Legende', 'Wochenziele', s.plan.unit])
        expect(alles).toContain(t);
    },
  },
  'B-Kp-112': {
    titel: 'Datumsformat dd.mm.yyyy, kompakte Tagesköpfe dd.mm.yy',
    einheit: 'Text',
    sollwert: R('^dd\\.mm\\.yyyy$'),
    toleranz: R('^exakt \\(Regex\\)$'),
    async pruefe(k) {
      const s = await k.kvk();
      const falsch: string[] = [];
      for (const t of s.info.texts) {
        for (const m of t.text.matchAll(/\d{1,2}[./]\d{1,2}[./]\d{2,4}/g)) {
          const d = m[0];
          if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) continue;
          if (
            /^\d{2}\.\d{2}\.\d{2}$/.test(d) &&
            /^(Mo|Di|Mi|Do|Fr|Sa|So) \d{2}\.\d{2}\.\d{2}$/.test(t.text.trim())
          )
            continue;
          falsch.push(d);
        }
      }
      expect(falsch).toEqual([]);
    },
  },
  'B-Kp-113': {
    titel:
      'Wochenziele-Titelzeile gerahmt: Linien auf der Tageskopf-Unterlinie und auf y(from) über die Seitenleiste',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z}) pt; Enden ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const rs = leistenRegeln(s, n(w.toleranz, 2));
      for (const [y, was] of [
        [s.b.tageskopfUnten, 'Tageskopf-Unterlinie'],
        [s.b.yFrom, 'y(from)'],
      ] as const) {
        const l = rs.filter((x) => nahe(x.bbox.y, y, 0.01));
        expect(l.length, `${w.z.id}: Linie auf ${was} von xS bis zum Rahmen rechts`).toBe(1);
        pruefeRegel(l[0] as PdfStroke, n(w.sollwert, 1), n(w.toleranz, 1), [], `${w.z.id} ${was}`);
      }
      const t = genau(laeufeIm(s.info, oben(s.b)), 'Wochenziele');
      const u = umriss(t);
      imBereich(u.y, s.b.tageskopfUnten, s.b.yFrom, '«Wochenziele» oben');
      imBereich(u.y + u.h, s.b.tageskopfUnten, s.b.yFrom, '«Wochenziele» unten');
    },
  },
  'B-Kp-114': {
    titel:
      'Wochenziele-Kasten unten geschlossen: Linie 0,5 h unter der letzten Zielzeile bzw. Rahmen der Bereitschaft',
    einheit: 'pt',
    sollwert: R(`^(${Z}); Abstand (${Z}) × h$`),
    toleranz: R(`^±(${Z}) pt; Enden ±(${Z}) pt; Abstand ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const rs = leistenRegeln(s, n(w.toleranz, 2));
      const bem = genau(laeufeIm(s.info, oben(s.b)), 'Bemerkungen');
      const abstand = n(w.sollwert, 2) * hVon(s);
      const zielEnde = zielUnterkante(s, bem.baselineY);
      const abschluss = regelBei(rs, umriss(bem).y, 'ueber', '«Bemerkungen»');
      nah(
        abschluss.bbox.y,
        zielEnde + abstand,
        n(w.toleranz, 3),
        'Abschluss unter der letzten Zielzeile',
      );
      pruefeRegel(abschluss, n(w.sollwert, 1), n(w.toleranz, 1), stundenVon(s), 'Abschluss');
      // Mit Erhöhter Bereitschaft (KVK+) schliesst deren Rahmen; keine zusätzliche Linie.
      const p = await k.plus();
      const grau = flaechen(p.info).filter(
        (f) =>
          gleicheFarbe(f.fill, hexAus('B-Kp-98')) &&
          nahe(f.rect.x, p.b.xS, 0.5) &&
          nahe(f.rect.x + f.rect.w, p.b.rechts, 0.5),
      );
      expect(grau.length).toBe(1);
      const kasten = (grau[0] as Flaeche).rect;
      nah(
        kasten.y,
        zielUnterkante(p, kasten.y) + n(w.sollwert, 2) * hVon(p),
        n(w.toleranz, 3),
        'Bereitschaftskasten unter der letzten Zielzeile',
      );
      expect(
        leistenRegeln(p, n(w.toleranz, 2)).filter(
          (x) => x.bbox.y > p.b.yFrom + 0.01 && x.bbox.y < kasten.y + 0.01,
        ),
        'keine Linie zwischen Zielen und Bereitschaft',
      ).toEqual([]);
    },
  },
  'B-Kp-115': {
    titel:
      'Bemerkungen: Titelzeile 0,5 h zwischen zwei Linien, darunter Kopfzeile «Nr»/«Was» 0,5 h',
    einheit: 'pt',
    sollwert: R(`^(${Z}); Zeilenhöhe (${Z}) × h$`),
    toleranz: R(`^±(${Z}) pt; ±(${Z}) h$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const rs = leistenRegeln(s);
      const ls = laeufeIm(s.info, oben(s.b));
      const bem = genau(ls, 'Bemerkungen');
      const r = n(w.sollwert, 2) * hVon(s);
      const tol = n(w.toleranz, 2) * hVon(s);
      const o = regelBei(rs, umriss(bem).y, 'ueber', '«Bemerkungen»');
      const u = regelBei(rs, umriss(bem).y + umriss(bem).h, 'unter', '«Bemerkungen»');
      nah(u.bbox.y - o.bbox.y, r, tol, 'Titelzeile');
      for (const l of [o, u]) {
        pruefeRegel(
          l,
          n(w.sollwert, 1),
          n(w.toleranz, 1),
          stundenVon(s),
          'Titelzeile «Bemerkungen»',
        );
      }
      const kopf = rs.filter((x) => x.bbox.y > u.bbox.y + 0.01)[0];
      expect(kopf, 'Linie unter der Kopfzeile').toBeDefined();
      const yKopf = (kopf as PdfStroke).bbox.y;
      nah(yKopf - u.bbox.y, r, tol, 'Kopfzeile');
      for (const t of ['Nr', 'Was']) {
        const x = genau(ls, t);
        expect(x.bold).toBe(true);
        imBereich(umriss(x).y, u.bbox.y, yKopf, `«${t}» oben`);
        imBereich(umriss(x).y + umriss(x).h, u.bbox.y, yKopf, `«${t}» unten`);
      }
    },
  },
  'B-Kp-116': {
    titel:
      'Bemerkungen: feine Linie unter der Kopfzeile und unter jeder Bemerkung, Zeilen kompakt; Nr-Spaltenlinie',
    kennung: '(Q-048)',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: PT,
    async pruefe(k, w) {
      const s = await k.kvk();
      const rs = leistenRegeln(s);
      const fein = rs.filter((x) => nahe(x.widthPt, n(w.sollwert, 1), n(w.toleranz, 1)));
      const bemerkungen = remarksForWeek(s.plan, KVK_WOCHE);
      expect(fein.length, 'Kopfzeile und je Bemerkung eine feine Linie').toBe(
        bemerkungen.length + 1,
      );
      for (const l of fein)
        expect(l.dash === null || l.dash.length === 0, 'fein durchgezogen').toBe(true);
      const wasX = s.b.xS + s.b.a;
      for (let i = 0; i + 1 < fein.length; i++) {
        const y0 = (fein[i] as PdfStroke).bbox.y;
        const y1 = (fein[i + 1] as PdfStroke).bbox.y;
        const zs = zeilen(
          laeufeIm(s.info, oben(s.b)).filter(
            (t) => t.x >= wasX - 0.01 && t.baselineY > y0 && t.baselineY < y1,
          ),
        );
        expect(zs.length, `Bemerkung ${i + 1} mit Text`).toBeGreaterThan(0);
        const groesse = (zs[0] as Zeile).sizePt;
        const zahlZ = new Set(zs.map((z) => z.baselineY.toFixed(2))).size;
        nah(y1 - y0, zahlZ * lineHeightPt(groesse), 0.01, `Zeilenhöhe Bemerkung ${i + 1}`);
      }
      const bem = genau(laeufeIm(s.info, oben(s.b)), 'Bemerkungen');
      const legende = genau(laeufeIm(s.info, oben(s.b)), 'Legende');
      const titelUnten = regelBei(rs, umriss(bem).y + umriss(bem).h, 'unter', '«Bemerkungen»').bbox
        .y;
      const yL = regelBei(rs, umriss(legende).y, 'ueber', '«Legende»').bbox.y;
      const nr = striche(s.info)
        .filter(istSenkrecht)
        .filter(
          (x) =>
            nahe(x.bbox.x, wasX, endenTol()) && nahe(x.widthPt, n(w.sollwert, 1), n(w.toleranz, 1)),
        );
      expect(nr.length, 'Nr-Spaltenlinie').toBe(1);
      const l = nr[0] as PdfStroke;
      nah(l.bbox.y, titelUnten, endenTol(), 'Nr-Spaltenlinie oben');
      nah(l.bbox.y + l.bbox.h, yL, endenTol(), 'Nr-Spaltenlinie unten');
    },
  },
  'B-Kp-117': {
    titel:
      'Kürzelliste: Titelzeile «Legende» 0,5 h zwischen zwei Linien; die Oberlinie schliesst die Bemerkungen',
    einheit: 'pt',
    sollwert: R(`^(${Z}); Zeilenhöhe (${Z}) × h$`),
    toleranz: R(`^±(${Z}) pt; ±(${Z}) h$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const rs = leistenRegeln(s);
      const legende = genau(laeufeIm(s.info, oben(s.b)), 'Legende');
      const o = regelBei(rs, umriss(legende).y, 'ueber', '«Legende»');
      const u = regelBei(rs, umriss(legende).y + umriss(legende).h, 'unter', '«Legende»');
      nah(
        u.bbox.y - o.bbox.y,
        n(w.sollwert, 2) * hVon(s),
        n(w.toleranz, 2) * hVon(s),
        'Titelzeile',
      );
      for (const l of [o, u]) {
        pruefeRegel(l, n(w.sollwert, 1), n(w.toleranz, 1), stundenVon(s), 'Titelzeile «Legende»');
      }
      const f116 = n(form('B-Kp-116', 'Sollwert', bkp('B-Kp-116').sollwert, EINZEL), 1);
      const t116 = n(form('B-Kp-116', 'Toleranz', bkp('B-Kp-116').toleranz, PT), 1);
      const fein = rs.filter((x) => nahe(x.widthPt, f116, t116) && x.bbox.y < o.bbox.y);
      expect(fein.length, 'feine Linien der Bemerkungen darüber').toBeGreaterThan(0);
      const letzte = (fein[fein.length - 1] as PdfStroke).bbox.y;
      expect(
        rs.filter((x) => x.bbox.y > letzte + 0.01 && x.bbox.y < o.bbox.y - 0.01),
        'zwischen letzter Bemerkung und Titelzeile keine Linie',
      ).toEqual([]);
    },
  },
  'B-Kp-118': {
    titel:
      'Abschluss am Raster: Raster-Unterlinie und Termine-Oberlinie bis zum Rahmen rechts, Unterschriftblock innen ohne Linien',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z}) pt; Enden ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const tol = n(w.toleranz, 2);
      const unten1 = regeln(s.info, 1, s.b.xS, s.b.rechts, tol).filter((x) =>
        nahe(x.bbox.y, s.b.yTo, 0.01),
      );
      expect(unten1.length, 'Linie auf y(to) von xS bis zum Rahmen rechts').toBe(1);
      const oben1 = regeln(s.info, 1, s.b.xSa, s.b.rechts, tol).filter((x) =>
        nahe(x.bbox.y, s.b.yT, 0.01),
      );
      expect(oben1.length, 'Linie auf yT von xS − a bis zum Rahmen rechts').toBe(1);
      for (const l of [...unten1, ...oben1]) {
        pruefeRegel(l, n(w.sollwert, 1), n(w.toleranz, 1), [], 'Abschluss am Raster');
      }
      const sonne = n(
        form('B-Kp-84', 'Sollwert', bkp('B-Kp-84').sollwert, R(`Rahmen (${Z}) pt;`)),
        1,
      );
      const innen = striche(s.info).filter(
        (x) =>
          x.widthPt > 0 &&
          x.fill === null &&
          x.bbox.x > s.b.xSa + 0.5 &&
          x.bbox.x + x.bbox.w < s.b.rechts - 0.5 &&
          x.bbox.y > s.b.yT + 0.5 &&
          x.bbox.y + x.bbox.h < s.b.yU - 0.5,
      );
      expect(innen.length, 'Sonnentabelle').toBeGreaterThan(0);
      for (const x of innen) nah(x.widthPt, sonne, 0.01, 'nur Linien der Sonnentabelle');
    },
  },
  'B-Kp-119': {
    titel:
      'Seitenleistenlinie von der Kopf-Unterlinie bis zur Raster-Unterlinie; Stand-Feld links und unten offen',
    einheit: 'pt',
    sollwert: EINZEL,
    toleranz: R(`^±(${Z}) pt; Enden ±(${Z}) pt$`),
    async pruefe(k, w) {
      const s = await k.kvk();
      const tol = n(w.toleranz, 2);
      const st = striche(s.info);
      const kante = st.filter((x) => istSenkrecht(x) && nahe(x.bbox.x, s.b.xS, tol));
      expect(kante.length, 'genau eine senkrechte Linie auf xS').toBe(1);
      const l = kante[0] as PdfStroke;
      pruefeRegel(l, n(w.sollwert, 1), n(w.toleranz, 1), [], 'Seitenleistenlinie');
      nah(l.bbox.y, s.b.yK, tol, 'Seitenleistenlinie oben = Kopf-Unterlinie');
      nah(l.bbox.y + l.bbox.h, s.b.yTo, tol, 'Seitenleistenlinie unten = Raster-Unterlinie');
      expect(
        st.filter(
          (x) =>
            istSenkrecht(x) &&
            x.bbox.x > s.b.xS - tol &&
            x.bbox.x < s.b.rechts - tol &&
            x.bbox.y < s.b.yK - tol,
        ),
        'keine senkrechte Linie im Stand-Feld',
      ).toEqual([]);
      expect(
        st.filter(
          (x) =>
            istWaagrecht(x) &&
            x.bbox.x + x.bbox.w > s.b.xS + tol &&
            x.bbox.y >= s.b.yK - tol &&
            x.bbox.y < s.b.tageskopfUnten - tol,
        ),
        'Stand-Feld unten offen',
      ).toEqual([]);
    },
  },
};
