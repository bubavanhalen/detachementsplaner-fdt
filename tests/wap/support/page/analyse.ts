// Gemeinsame Auswertung einer PDF-Wochenseite für die PDF- und Eigenschaftstests (Paket E1-02e, Vertrag E1-02e
// Notiz «Ausarbeitung Schritt 2» H2 bis H8). Nur `readPdf`/`checks.ts`; Erwartungen aus Plan, Metrik, CSV und
// Vertrag.
import { expect } from 'vitest';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import type { Id, IsoDate, Plan, Rgb, Weekday } from '../../../../src/model/wap/types';
import { overlaps } from '../pdf/checks';
import type { PdfInfo, PdfTextRun, Rect } from '../pdf/read';
import { leseBkp } from './bkp';
import type { MarkerAchse, TagSpalten, ZeitFlaeche } from './orakel';
import {
  type Bereiche,
  bereiche,
  bereichsRechtecke,
  enthaeltPunkt,
  type Flaeche,
  flaechen,
  fortsetzungsBereiche,
  gleicheFarbe,
  innerhalb,
  laeufe,
  mitte,
  type RasterInhalt,
  rasterInhalt,
  type Skala,
  schneidet,
  strichband,
  striche,
  type TagPdf,
  tageAusPdf,
  umriss,
  zeitskala,
} from './pdf-seite';
import { type Stile, stileAusCsv } from './stile';
import { tagDatum } from './varianten';

const WT: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

export interface SeitenAnalyse {
  readonly info: PdfInfo;
  readonly b: Bereiche;
  readonly skala: Skala;
  /** Seiteneinheit aus dem PDF: Höhe des Bands = 60 · ptPerMinute (H2). */
  readonly bandHoehe: number;
  readonly tage: readonly TagPdf[];
  /** Datum je sichtbarem Tag (gleiche Reihenfolge wie `tage`). */
  readonly daten: readonly IsoDate[];
  readonly inhalt: RasterInhalt;
  readonly stile: Stile;
}

/** Sichtbare Tage der Woche in Reihenfolge. */
export function sichtbareTage(
  plan: Plan,
  weekId: Id,
): { date: IsoDate; weekday: Weekday; index: number }[] {
  const w = plan.weeks.find((x) => x.id === weekId);
  if (w === undefined) throw new Error(`Woche ${weekId} fehlt`);
  return w.days
    .map((d, i) => ({
      date: tagDatum(w.startDate, i),
      weekday: WT[i] as Weekday,
      index: i,
      display: d.display,
    }))
    .filter((d) => d.display !== 'hidden')
    .map(({ date, weekday, index }) => ({ date, weekday, index }));
}

/** Auswertung der Wochenseite `seite` (Standard 1). */
export function analysiere(info: PdfInfo, plan: Plan, weekId: Id, seite = 1): SeitenAnalyse {
  const stile = stileAusCsv(leseBkp());
  const b = bereiche(info, seite);
  const skala = zeitskala(info, b, plan.displayRange, stile.stunde, stile.halbstunde);
  const bandHoehe = 60 * skala.ptPerMinute;
  const tage = tageAusPdf(info, b);
  const sicht = sichtbareTage(plan, weekId);
  expect(tage.length, 'Zahl der Tage im PDF = sichtbare Tage').toBe(sicht.length);
  const inhalt = rasterInhalt(
    info,
    b,
    { y0: b.yFrom, y1: b.yFrom + bandHoehe },
    {
      block: stile.block,
      rapport: stile.rapport,
      beso: stile.beso,
      querbalken: stile.querbalken,
      markerFeld: stile.markerFeld,
      markerLinie: stile.markerLinie,
    },
  );
  return { info, b, skala, bandHoehe, tage, daten: sicht.map((d) => d.date), inhalt, stile };
}

/** Datum des Tages, in dessen x-Bereich das Rechteck liegt (null, wenn keiner). */
export function datumBei(an: SeitenAnalyse, r: Rect): IsoDate | null {
  const m = mitte(r);
  const i = an.tage.findIndex((t) => m.x >= t.links - 0.01 && m.x <= t.rechts + 0.01);
  return i < 0 ? null : (an.daten[i] ?? null);
}

/** Spalten je sichtbarem Tag mit IDs aus dem Plan und x-Bereich aus dem PDF (für das Orakel H5). */
export function tagSpalten(an: SeitenAnalyse, plan: Plan, weekId: Id): TagSpalten[] {
  const sicht = sichtbareTage(plan, weekId);
  return an.tage.map((t, i) => {
    const d = sicht[i] as { date: IsoDate; weekday: Weekday };
    const cols = dayColumns(plan, weekId, d.weekday);
    expect(t.spalten.length, `Spaltenzahl am ${d.date}`).toBe(cols.length);
    return {
      date: d.date,
      spalten: cols.map((c, j) => {
        const s = t.spalten[j] as { x: number; w: number };
        return { id: c.id, kind: c.kind, x: s.x, w: s.w };
      }),
    };
  });
}

/** Flächen mit Farbkennung den Einträgen zuordnen (H4). */
export function zeitFlaechen(an: SeitenAnalyse, farbe: ReadonlyMap<Id, Rgb>): ZeitFlaeche[] {
  const aus: ZeitFlaeche[] = [];
  for (const e of an.inhalt.eintraege) {
    const art =
      e.klasse === 'block'
        ? 'block'
        : e.klasse === 'rapportBox'
          ? 'rapportBox'
          : e.klasse === 'besoBox'
            ? 'besoBox'
            : null;
    if (art === null) continue;
    const id = [...farbe.entries()].find(([, c]) => gleicheFarbe(c, e.flaeche.fill))?.[0];
    const date = datumBei(an, e.flaeche.rect);
    if (id === undefined || date === null) continue;
    aus.push({ entryId: id, date, rect: e.flaeche.rect, art });
  }
  return aus;
}

/** Achsen der Markerlinien je Tag. */
export function markerAchsen(an: SeitenAnalyse): MarkerAchse[] {
  return an.inhalt.markerLinien.flatMap((m) => {
    const date = datumBei(an, m.bbox);
    return date === null ? [] : [{ date, y: m.bbox.y }];
  });
}

// ---------------------------------------------------------------------------------------------------------
// R-14.3-01 und R-14.3-02 (H7, H8)
// ---------------------------------------------------------------------------------------------------------

/** Überlappungen nach H7: Kästchen untereinander, Blockflächen untereinander, Textumrisse untereinander. */
export function ueberlappungen(info: PdfInfo, an: SeitenAnalyse | null, seite = 1): string[] {
  const aus: string[] = [];
  if (an !== null) {
    const boxen = an.inhalt.eintraege
      .filter((e) => e.klasse === 'besoBox' || e.klasse === 'rapportBox')
      .map((e) => e.flaeche.rect);
    const bloecke = an.inhalt.eintraege
      .filter((e) => e.klasse === 'block')
      .map((e) => e.flaeche.rect);
    for (const [a] of overlaps(boxen)) aus.push(`Kästchen überlappen bei y ${a.y.toFixed(2)}`);
    for (const [a] of overlaps(bloecke))
      aus.push(`Blockflächen überlappen bei y ${a.y.toFixed(2)}`);
  }
  const ls = laeufe(info, seite);
  for (const [a, b] of overlaps(ls.map(umriss))) {
    aus.push(
      `Textumrisse überlappen bei (${a.x.toFixed(1)}, ${a.y.toFixed(1)}) und (${b.x.toFixed(1)}, ${b.y.toFixed(1)})`,
    );
  }
  return aus;
}

/** Text-Verstösse nach H8 (a) bis (c) einer Seite; `an` null bei Fortsetzungsseiten (nur b und c). */
export function textVerstoesse(info: PdfInfo, an: SeitenAnalyse | null, seite = 1): string[] {
  const aus: string[] = [];
  const ls = laeufe(info, seite);
  const fl: Flaeche[] = flaechen(info, seite);
  // (a) Eintragstexte im Raster: in der zuletzt vor ihnen gezeichneten gefüllten Fläche, die ihre Mitte enthält.
  if (an !== null) {
    const raster: Rect = {
      x: an.b.X0,
      y: an.b.yFrom,
      w: an.b.xSa - an.b.X0,
      h: an.b.yTo - an.b.yFrom,
    };
    for (const t of ls) {
      const u = umriss(t);
      const m = mitte(u);
      if (!enthaeltPunkt(raster, m.x, m.y, 0)) continue;
      const traeger = fl
        .filter((f) => f.order < t.order && enthaeltPunkt(f.rect, m.x, m.y, 0.01))
        .sort((p, q) => q.order - p.order)[0];
      if (traeger === undefined || !innerhalb(u, traeger.rect, 0.01)) {
        aus.push(`(a) Eintragstext «${t.text}» nicht in seiner Fläche`);
      }
    }
  }
  // (b) Jeder Text im Rahmen und in genau einem Bereich nach C5.
  const rechtecke =
    an !== null
      ? Object.values(bereichsRechtecke(an.b))
      : fortsetzungsBereiche(info, seite).rechtecke;
  for (const t of ls) {
    const u = umriss(t);
    const n = rechtecke.filter((r) => innerhalb(u, r, 0.01)).length;
    if (n !== 1) aus.push(`(b) Text «${t.text}» in ${n} Bereichen`);
  }
  // (c) Keine später gezeichnete Fläche, Linie (mit Strichband) oder Bildlage schneidet den Umriss. Ausgenommen ist
  // die rote Durchstreichung eines roten Textes (Status gestrichen, Beschrieb 10, R-10-29; TE-I3-01 entschieden,
  // Auftraggeber 19.10.2026 «1: ja», F-LAYOUT2): eine Linie in Status-Rot längs durch einen Lauf in Status-Rot (waagrecht bzw. bei gedrehtem Text senkrecht)
  // (die Linie gilt der ganzen Zeile und kann daher über den einzelnen Lauf hinausreichen).
  const st = striche(info, seite);
  const bilder = info.imagePlacements.filter((p) => p.page === seite);
  const rot = (c: { r: number; g: number; b: number }): boolean =>
    c.r === 192 && c.g === 0 && c.b === 0;
  for (const t of ls) {
    const u = umriss(t);
    for (const s of st) {
      if (s.order <= t.order) continue;
      const durchstreichung =
        s.kind === 'line' &&
        rot(s.color) &&
        rot(t.color) &&
        ((s.bbox.h <= 0.01 && s.bbox.y > u.y && s.bbox.y < u.y + u.h) ||
          (s.bbox.w <= 0.01 && s.bbox.x > u.x && s.bbox.x < u.x + u.w));
      if (durchstreichung) continue;
      const r = s.fill !== null && s.widthPt === 0 ? s.bbox : strichband(s);
      if (schneidet(u, r)) aus.push(`(c) Text «${t.text}» später überdeckt (Element ${s.kind})`);
    }
    for (const p of bilder) {
      if (p.order > t.order && schneidet(u, p.bbox))
        aus.push(`(c) Text «${t.text}» von Bild überdeckt`);
    }
  }
  return aus;
}

/** Läufe im Rechteck (Umriss vollständig darin, ± tol). */
export function laeufeIn(info: PdfInfo, r: Rect, seite = 1, tol = 0.01): PdfTextRun[] {
  return laeufe(info, seite).filter((t) => innerhalb(umriss(t), r, tol));
}
