// @vitest-environment jsdom
// Paket E1-02k: Seitenmodell der Nachträge Gate S A4 und R-10-53 (Vertrag E1-02k §6b, U1 bis U5) und der
// Pflichtfall TR-E102e-31 zu S3-23 (d) (Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» S3-23). Geprüft wird das
// Seitenmodell `layoutWeekPage` (Textflächen `frame`, LineItem der Seitenleiste, `texts`); Masse aus der
// Kp-Geometrie (deren Werte pinnt geometrie.test.ts an die CSV) und aus der CSV. Pseudonymisierte KVK-Fixture und
// fiktive Varianten (tests/wap/support/page/nachtrag-rahmen.ts).
import { describe, expect, it } from 'vitest';
import {
  abbreviationMeaning,
  abbreviationsForWeek,
} from '../../../../src/model/wap/derive/abbreviations';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import { kpPageGeometry } from '../../../../src/model/wap/layout/page/geometryKp';
import type { PageTextKind, WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import type {
  LineItem,
  PageItem,
  Rect,
  Stroke,
  TextItem,
} from '../../../../src/model/wap/layout/pageModel';
import { ascentPt, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { senkrechtPlan } from '../../pdf/page/b-kp/kontext';
import { multiDayRemark } from '../../support/model/builders';
import { leseBkp, ZAHL } from '../../support/page/bkp';
import { INSET, zieleUndBemerkungenPlan } from '../../support/page/nachtrag-rahmen';
import { stundenZeiten } from '../../support/page/pdf-seite';
import { einmal, seite } from '../../support/page/seite';
import { bkpZahlen, strichAus, strichVon } from '../../support/page/stile';
import { KVK_WOCHE, kvk, mitEintraegen } from '../../support/page/varianten';

const TOL = 0.01;

// ---------------------------------------------------------------------------------------------------------
// Lagen der Seite (Vertrag E1-02k 2.0) aus dem Seitenmodell und der Kp-Geometrie
// ---------------------------------------------------------------------------------------------------------

interface Lagen {
  readonly xS: number;
  readonly R: number;
  readonly a: number;
  readonly yK: number;
  readonly yH: number;
  readonly yF: number;
  readonly yTo: number;
  readonly yT: number;
  readonly yU: number;
  readonly h: number;
  /** Zeilenhöhe r = 0,5 h (B-Kp-115). */
  readonly r: number;
  /** Abschnittsabstand g = 0,5 h (B-Kp-114). */
  readonly g: number;
  /** Rechter Textrand: Rahmen rechts − ½ Rahmenstrich − textInsetPt (S3-2). */
  readonly textRechts: number;
}

function lagen(L: WeekPageLayout): Lagen {
  const pf = L.frame;
  const geo = kpPageGeometry();
  const [zeile] = bkpZahlen(
    'B-Kp-115',
    'sollwert',
    new RegExp(`^${ZAHL}; Zeilenhöhe (${ZAHL}) × h$`),
  );
  const [abstand] = bkpZahlen(
    'B-Kp-114',
    'sollwert',
    new RegExp(`^${ZAHL}; Abstand (${ZAHL}) × h$`),
  );
  const R = pf.frame.x + pf.frame.w;
  const yK = pf.grid.rect.y;
  const yH = yK + pf.grid.dayHeaderHeightPt;
  return {
    xS: pf.sidebarUpper.x,
    R,
    a: pf.grid.timeAxisWidthPt,
    yK,
    yH,
    yF: yH + pf.grid.columnHeaderHeightPt,
    yTo: pf.grid.rect.y + pf.grid.rect.h,
    yT: pf.agenda.y,
    yU: pf.frame.y + pf.frame.h,
    h: pf.h,
    r: (zeile as number) * pf.h,
    g: (abstand as number) * pf.h,
    textRechts: R - geo.frameStroke.widthPt / 2 - INSET,
  };
}

/** Textfläche zwischen zwei waagrechten Linien (S3-23 d; Vertrag E1-02k 2.0 `zwischen`). */
function zwischen(y1: number, w1: number, y2: number, w2: number): { y: number; h: number } {
  const y = y1 + w1 / 2 + INSET;
  return { y, h: y2 - w2 / 2 - INSET - y };
}

function erwarteFrame(ist: Rect, soll: Partial<Rect>, was: string): void {
  for (const k of ['x', 'y', 'w', 'h'] as const) {
    const s = soll[k];
    if (s === undefined) continue;
    expect(
      Math.abs(ist[k] - s),
      `${was}: frame.${k} ist ${ist[k].toFixed(3)}, soll ${s.toFixed(3)}`,
    ).toBeLessThanOrEqual(TOL);
  }
}

function text(t: TextItem): string {
  return t.runs.map((r) => r.text).join('');
}

/** TextItems einer Art auf einer Seite (über `texts`), mit Datum. */
function texteDerArt(
  L: WeekPageLayout,
  kind: PageTextKind,
  seiteNr = 0,
): { item: TextItem; date: string | null; standardSizePt: number | null }[] {
  return L.texts
    .filter((t) => t.kind === kind && t.page === seiteNr)
    .map((t) => {
      const it = L.pages[t.page]?.items[t.item];
      expect(it?.kind, `TextItem ${kind}`).toBe('text');
      return { item: it as TextItem, date: t.date, standardSizePt: t.standardSizePt };
    });
}

/** Genau eine Überschrift der Seitenleiste mit diesem Text auf der Seite. */
function ueberschrift(L: WeekPageLayout, inhalt: string, seiteNr = 0): TextItem {
  const l = texteDerArt(L, 'sidebarHeading', seiteNr).filter((t) => text(t.item) === inhalt);
  expect(l.length, `genau eine Überschrift «${inhalt}» auf Seite ${seiteNr}`).toBe(1);
  return (l[0] as { item: TextItem }).item;
}

/** Unterkante des Zeilenkastens der letzten Zielzeile einer Seite (Grundlinie − Oberlänge + Zeilenhöhe). */
function zieleUnten(L: WeekPageLayout, seiteNr: number): number | null {
  const z = texteDerArt(L, 'goal', seiteNr).map((t) => t.item);
  if (z.length === 0) return null;
  return Math.max(...z.map((t) => t.baselineY - ascentPt(t.sizePt) + lineHeightPt(t.sizePt)));
}

/** Volle Stunden der Wochenseite als y (E2, Vertrag E1-02k 2.2 Punkt 11). */
function stundenYs(L: WeekPageLayout, plan: Plan): number[] {
  const ts = L.grid.timeScale;
  return stundenZeiten(plan.displayRange).voll.map(
    (t) => ts.yTop + (t - ts.fromMin) * ts.ptPerMinute,
  );
}

/**
 * Strich der feinen Bemerkungslinie aus der CSV (B-Kp-116); geometrie.test.ts pinnt `pageLines.remarkRule` daran.
 */
function feineRegel(): Stroke {
  return strichVon(strichAus(leseBkp(), 'B-Kp-116'));
}

const kvkSeite = einmal(async () => seite(kvk(), KVK_WOCHE));

// ---------------------------------------------------------------------------------------------------------
// U1: TR-E102e-31 (S3-23 d), bestehendes Verhalten
// ---------------------------------------------------------------------------------------------------------

describe('TR-E102e-31: frame = Zelle nach S3-23 (d) (R-10-39; Vertrag E1-02k §6b U1)', () => {
  const faelle: [string, () => Plan][] = [
    ['KVK', kvk],
    ['KVK senkrecht', senkrechtPlan],
  ];
  for (const [name, plan] of faelle) {
    it(`[R-10-39] (U1) ${name}: (a) jeder Tageskopf mit y und h zwischen Kopf- und Tageskopf-Unterlinie, kompakte Tage auch x und w zwischen den Tagesgrenzen, volle Tage darin; (b) «Termine» in der Achse zwischen Rahmenlinie und erster Tagesgrenze, Termine-Oberlinie und Rahmenlinie; (c) jeder senkrechte Spaltenkopf zwischen seinen Spaltengrenzen und ab der Tageskopf-Unterlinie bis y(from) − textInsetPt (± 0,01)`, () => {
      const p = plan();
      const L = seite(p, KVK_WOCHE);
      const geo = kpPageGeometry();
      const lg = lagen(L);
      const db = geo.lines.dayBorder.widthPt;
      // (a) Tagesköpfe
      const kz = zwischen(
        lg.yK,
        geo.pageLines.headerBottom.widthPt,
        lg.yH,
        geo.pageLines.dayHeadBottom.widthPt,
      );
      const koepfe = texteDerArt(L, 'dayHead');
      expect(koepfe.length).toBeGreaterThan(0);
      for (const k of koepfe) {
        const tag = L.grid.days.find((d) => d.date === k.date);
        expect(tag, `Tag ${k.date}`).toBeDefined();
        const d = tag as (typeof L.grid.days)[number];
        const links = d.x + db / 2 + INSET;
        const rechts = d.x + d.w - db / 2 - INSET;
        erwarteFrame(k.item.frame, { y: kz.y, h: kz.h }, `Tageskopf ${k.date}`);
        if (d.display === 'compact') {
          erwarteFrame(
            k.item.frame,
            { x: links, w: rechts - links },
            `kompakter Tageskopf ${k.date}`,
          );
        } else {
          expect(k.item.frame.x, `voller Tageskopf ${k.date} links`).toBeGreaterThanOrEqual(
            links - TOL,
          );
          expect(
            k.item.frame.x + k.item.frame.w,
            `voller Tageskopf ${k.date} rechts`,
          ).toBeLessThanOrEqual(rechts + TOL);
        }
      }
      // (b) «Termine»
      const termine = texteDerArt(L, 'agendaLabel');
      expect(termine.length).toBe(1);
      const fx = L.frame.frame.x;
      const fs = geo.frameStroke.widthPt;
      const tx = fx + fs / 2 + INSET;
      const tz = zwischen(lg.yT, geo.pageLines.agendaTop.widthPt, lg.yU, fs);
      erwarteFrame(
        (termine[0] as { item: TextItem }).item.frame,
        { x: tx, w: fx + lg.a - db / 2 - INSET - tx, y: tz.y, h: tz.h },
        '«Termine»',
      );
      // (c) senkrechte Spaltenköpfe
      const linien = (L.pages[0]?.items ?? []).filter(
        (x): x is LineItem => x.kind === 'line' && x.x1 === x.x2,
      );
      const grenze = (x: number): number => {
        const l = linien.filter(
          (s) =>
            Math.abs(s.x1 - x) <= 1e-6 &&
            Math.min(s.y1, s.y2) <= lg.yH + TOL &&
            Math.max(s.y1, s.y2) >= lg.yF - TOL,
        );
        expect(l.length, `Grenzlinie bei x ${x.toFixed(3)}`).toBe(1);
        return (l[0] as LineItem).stroke.widthPt;
      };
      const senkrecht = texteDerArt(L, 'columnHead').filter((t) => t.item.rotation === 90);
      if (name === 'KVK senkrecht') expect(senkrecht.length).toBeGreaterThan(0);
      const top = lg.yH + geo.pageLines.dayHeadBottom.widthPt / 2 + INSET;
      for (const k of senkrecht) {
        const tag = L.grid.days.find((d) => d.date === k.date);
        expect(tag, `Tag ${k.date}`).toBeDefined();
        const mx = k.item.frame.x + k.item.frame.w / 2;
        const sp = (tag as (typeof L.grid.days)[number]).columns.find(
          (c) => mx > c.x && mx < c.x + c.w,
        );
        expect(sp, `Spalte des Kopfs ${k.date}`).toBeDefined();
        const c = sp as { x: number; w: number };
        const li = grenze(c.x);
        const re = grenze(c.x + c.w);
        erwarteFrame(
          k.item.frame,
          {
            x: c.x + li / 2 + INSET,
            w: c.w - 2 * INSET - (li + re) / 2,
            y: top,
            h: lg.yF - INSET - top,
          },
          `senkrechter Kopf ${k.date} «${text(k.item)}»`,
        );
      }
    });
  }
});

// ---------------------------------------------------------------------------------------------------------
// U2, U3: Textflächen der Überschriften (Vertrag E1-02k 2.6)
// ---------------------------------------------------------------------------------------------------------

describe('Textflächen der Seitenleisten-Überschriften (R-10-51, R-10-52; Vertrag E1-02k 2.6)', () => {
  it('[R-10-51] (U2) «Wochenziele» der Wochenseite: frame x ab Seitenleistenlinie + ½ Strich + textInsetPt bis zum Textrand, y und h zwischen Tageskopf-Unterlinie und y(from) (± 0,01)', async () => {
    const L = await kvkSeite();
    const geo = kpPageGeometry();
    const lg = lagen(L);
    const x = lg.xS + geo.pageLines.sidebarEdge.widthPt / 2 + INSET;
    const z = zwischen(
      lg.yH,
      geo.pageLines.dayHeadBottom.widthPt,
      lg.yF,
      geo.lines.gridEdge.widthPt,
    );
    erwarteFrame(
      ueberschrift(L, 'Wochenziele').frame,
      { x, w: lg.textRechts - x, y: z.y, h: z.h },
      '«Wochenziele»',
    );
  });

  it('[R-10-52] (U3) Wochenseite: «Bemerkungen», «Nr», «Was», Bemerkungsnummer (x, w wie «Nr», frame = Zeilenkasten auf der Grundlinie der ersten Textzeile) und Kürzelüberschrift; Fortsetzungsseite: «Wochenziele» ab der Tageskopf-Unterlinie und «Bemerkungen» (± 0,01)', async () => {
    const geo = kpPageGeometry();
    const T = geo.pageLines.table.widthPt;
    const F = feineRegel().widthPt;
    // Wochenseite mit einer fiktiven nummerierten Wochenbemerkung.
    const nummer = multiDayRemark('e975', 975, {
      text: 'Fiktive Bemerkung mit Nummer.',
      number: 3,
      scope: { kind: 'week', weekId: KVK_WOCHE },
    });
    const plan = mitEintraegen(kvk(), [nummer]);
    const L = seite(plan, KVK_WOCHE);
    const lg = lagen(L);
    const x = lg.xS + geo.pageLines.sidebarEdge.widthPt / 2 + INSET;
    const unten = zieleUnten(L, 0);
    expect(unten, 'Zielzeilen der KVK').not.toBeNull();
    const yB = (unten as number) + lg.g;
    const tb = zwischen(yB, T, yB + lg.r, T);
    erwarteFrame(
      ueberschrift(L, 'Bemerkungen').frame,
      { x, w: lg.textRechts - x, y: tb.y, h: tb.h },
      '«Bemerkungen»',
    );
    const kz = zwischen(yB + lg.r, T, yB + 2 * lg.r, F);
    const nrW = lg.xS + lg.a - F / 2 - INSET - x;
    erwarteFrame(ueberschrift(L, 'Nr').frame, { x, w: nrW, y: kz.y, h: kz.h }, '«Nr»');
    const wasX = lg.xS + lg.a + F / 2 + INSET;
    erwarteFrame(
      ueberschrift(L, 'Was').frame,
      { x: wasX, w: lg.textRechts - wasX, y: kz.y, h: kz.h },
      '«Was»',
    );
    const nr = texteDerArt(L, 'remarkNumber');
    expect(nr.length).toBe(1);
    const n = (nr[0] as { item: TextItem }).item;
    const zeilen = texteDerArt(L, 'remark')
      .map((t) => t.item)
      .filter((t) => t.entryId === nummer.id);
    expect(zeilen.length, 'Textzeilen der nummerierten Bemerkung').toBeGreaterThan(0);
    const erste = Math.min(...zeilen.map((t) => t.baselineY));
    expect(
      Math.abs(n.baselineY - erste),
      'Nummer auf der Grundlinie der ersten Textzeile',
    ).toBeLessThanOrEqual(TOL);
    erwarteFrame(
      n.frame,
      { x, w: nrW, y: n.baselineY - ascentPt(n.sizePt), h: lineHeightPt(n.sizePt) },
      'Bemerkungsnummer',
    );
    // Kürzelüberschrift: Titelzeile r über den Kürzel- und Legendenzeilen, Legende endet 0,5 h über y(to).
    const [ende] = bkpZahlen(
      'B-Kp-79',
      'soll',
      new RegExp(`Tabelle endet (${ZAHL}) h über der Raster-Unterlinie`),
    );
    const zeilenZahl =
      abbreviationsForWeek(plan, KVK_WOCHE).length +
      plan.legend.filter((c) => c.inLegend && !c.neutral).length;
    const yL = lg.yTo - (ende as number) * lg.h - zeilenZahl * lg.r - lg.r;
    const kl = zwischen(yL, T, yL + lg.r, T);
    erwarteFrame(
      ueberschrift(L, kpTemplate().abbreviationHeading).frame,
      { x, w: lg.textRechts - x, y: kl.y, h: kl.h },
      'Kürzelüberschrift',
    );
    // Fortsetzungsseite (fiktiv, 60 Ziele): «Wochenziele» ab yH, «Bemerkungen» g unter der letzten Zielzeile.
    const M = seite(zieleUndBemerkungenPlan(), KVK_WOCHE);
    expect(M.pages.length).toBeGreaterThanOrEqual(2);
    const mz = lagen(M);
    const zw = zwischen(mz.yH, T, mz.yH + mz.r, T);
    erwarteFrame(
      ueberschrift(M, 'Wochenziele', 1).frame,
      { x, w: mz.textRechts - x, y: zw.y, h: zw.h },
      '«Wochenziele» (Fortsetzung)',
    );
    const u2 = zieleUnten(M, 1);
    expect(u2, 'Zielzeilen auf der Fortsetzungsseite').not.toBeNull();
    const yB2 = (u2 as number) + mz.g;
    const b2 = zwischen(yB2, T, yB2 + mz.r, T);
    erwarteFrame(
      ueberschrift(M, 'Bemerkungen', 1).frame,
      { x, w: mz.textRechts - x, y: b2.y, h: b2.h },
      '«Bemerkungen» (Fortsetzung)',
    );
  });
});

// ---------------------------------------------------------------------------------------------------------
// U4: Linien der Seitenleiste (Vertrag E1-02k 2.2, 2.5)
// ---------------------------------------------------------------------------------------------------------

interface Soll {
  readonly x1: number;
  readonly y1: number;
  readonly x2: number;
  readonly y2: number;
  readonly stroke: Stroke;
  readonly was: string;
}

function gleich(l: LineItem, s: Soll): boolean {
  return (
    Math.abs(l.x1 - s.x1) <= TOL &&
    Math.abs(l.y1 - s.y1) <= TOL &&
    Math.abs(l.x2 - s.x2) <= TOL &&
    Math.abs(l.y2 - s.y2) <= TOL &&
    l.stroke.widthPt === s.stroke.widthPt &&
    JSON.stringify(l.stroke.dash) === JSON.stringify(s.stroke.dash) &&
    JSON.stringify(l.stroke.color) === JSON.stringify(s.stroke.color)
  );
}

describe('Linien der Seitenleiste im Seitenmodell (R-10-51, R-10-52; Vertrag E1-02k 2.2, 2.5)', () => {
  it('[R-10-51][R-10-52] (U4) KVK: LineItem der Rolle sidebar und Seitenleistenlinie genau nach 2.2 (Zahl, Lage ± 0,01, Strichbreite, Strichelung nach der Stundenregel); alle Formen der Seitenleiste vor ihren Texten; Farbfelder nach den Tabellenregeln', async () => {
    const plan = kvk();
    const L = await kvkSeite();
    const geo = kpPageGeometry();
    const lg = lagen(L);
    const T = geo.pageLines.table;
    const F = feineRegel();
    const stunden = stundenYs(L, plan);
    expect(stunden.length).toBeGreaterThan(0);
    const stil = (y: number, s: Stroke): Stroke =>
      stunden.some((t) => Math.abs(t - y) <= TOL) ? geo.lines.hour : s;
    const regel = (y: number, s: Stroke, was: string): Soll => ({
      x1: lg.xS,
      y1: y,
      x2: lg.R,
      y2: y,
      stroke: stil(y, s),
      was,
    });
    const soll: Soll[] = [
      regel(lg.yH, geo.pageLines.dayHeadBottom, 'S1 yH'),
      regel(lg.yF, geo.lines.gridEdge, 'S1 y(from)'),
    ];
    const unten = zieleUnten(L, 0);
    expect(unten, 'Zielzeilen der KVK').not.toBeNull();
    const yB = (unten as number) + lg.g;
    soll.push(regel(yB, T, 'Bemerkungen oben'), regel(yB + lg.r, T, 'Bemerkungen unten'));
    let y = yB + 2 * lg.r;
    soll.push({ x1: lg.xS, y1: y, x2: lg.R, y2: y, stroke: F, was: 'Kopfzeile' });
    const bemerkungen = texteDerArt(L, 'remark').map((t) => t.item);
    for (const r of remarksForWeek(plan, KVK_WOCHE)) {
      const z = bemerkungen.filter((t) => t.entryId === r.id);
      expect(z.length, `Textzeilen der Bemerkung ${r.id}`).toBeGreaterThan(0);
      y += Math.max(z.length, 1) * lineHeightPt((z[0] as TextItem).sizePt);
      soll.push({ x1: lg.xS, y1: y, x2: lg.R, y2: y, stroke: F, was: `Bemerkung ${r.id}` });
    }
    const [ende] = bkpZahlen(
      'B-Kp-79',
      'soll',
      new RegExp(`Tabelle endet (${ZAHL}) h über der Raster-Unterlinie`),
    );
    const k =
      abbreviationsForWeek(plan, KVK_WOCHE).length +
      plan.legend.filter((c) => c.inLegend && !c.neutral).length;
    const yL = lg.yTo - (ende as number) * lg.h - k * lg.r - lg.r;
    soll.push({
      x1: lg.xS + lg.a,
      y1: yB + lg.r,
      x2: lg.xS + lg.a,
      y2: yL,
      stroke: F,
      was: 'Nr-Spaltenlinie',
    });
    soll.push(regel(lg.yTo, geo.lines.gridEdge, 'y(to)'));
    soll.push({
      x1: lg.xS - lg.a,
      y1: lg.yT,
      x2: lg.R,
      y2: lg.yT,
      stroke: stil(lg.yT, geo.pageLines.agendaTop),
      was: 'yT',
    });
    const tabelle: Soll[] = [];
    for (let i = 0; i <= k + 1; i++) tabelle.push(regel(yL + i * lg.r, T, `Tabelle ${i}`));
    tabelle.push({
      x1: lg.xS + lg.a,
      y1: yL + lg.r,
      x2: lg.xS + lg.a,
      y2: lg.yTo,
      stroke: T,
      was: 'Kürzel-Spaltenlinie',
    });
    soll.push(...tabelle);

    const items: readonly PageItem[] = L.pages[0]?.items ?? [];
    const ist = items.filter((x): x is LineItem => x.kind === 'line' && x.role === 'sidebar');
    const fehlt = soll.filter((s) => !ist.some((l) => gleich(l, s))).map((s) => s.was);
    const zuviel = ist
      .filter((l) => !soll.some((s) => gleich(l, s)))
      .map((l) => `(${l.x1.toFixed(2)}, ${l.y1.toFixed(2)})`);
    expect({ fehlt, zuviel }).toEqual({ fehlt: [], zuviel: [] });
    expect(ist.length, 'Zahl der Linien der Seitenleiste').toBe(soll.length);
    // Seitenleistenlinie (sidebarEdge) von yK bis y(to), die einzige senkrechte Linie auf xS.
    const kante = items.filter(
      (x): x is LineItem => x.kind === 'line' && x.x1 === x.x2 && Math.abs(x.x1 - lg.xS) <= TOL,
    );
    expect(kante.length).toBe(1);
    expect(
      gleich(kante[0] as LineItem, {
        x1: lg.xS,
        y1: lg.yK,
        x2: lg.xS,
        y2: lg.yTo,
        stroke: geo.pageLines.sidebarEdge,
        was: 'Seitenleistenlinie',
      }),
      'Seitenleistenlinie von yK bis y(to)',
    ).toBe(true);
    // Reihenfolge (2.5, D): alle Formen der Seitenleiste vor ihren Texten, Farbfelder nach den Tabellenregeln.
    const idx = (p: (x: PageItem) => boolean) => items.flatMap((x, i) => (p(x) ? [i] : []));
    const formen = idx((x) => x.kind === 'line' && x.role === 'sidebar');
    const texte = idx((x) => x.kind === 'text' && x.role === 'sidebar');
    expect(Math.max(...formen)).toBeLessThan(Math.min(...texte));
    const tabellenIdx = idx(
      (x) => x.kind === 'line' && x.role === 'sidebar' && tabelle.some((s) => gleich(x, s)),
    );
    const felder = idx((x) => x.kind === 'rect' && x.role === 'legend' && x.fill !== null);
    expect(felder.length).toBeGreaterThan(0);
    expect(Math.min(...felder)).toBeGreaterThan(Math.max(...tabellenIdx));
  });
});

// ---------------------------------------------------------------------------------------------------------
// U5: Bedeutungsspalte (Vertrag E1-02k §4)
// ---------------------------------------------------------------------------------------------------------

describe('Bedeutungsspalte im Seitenmodell (R-10-53; Vertrag E1-02k §4)', () => {
  it('[R-10-53] (U5) KVK: texts enthält genau drei Einträge abbreviationMeaning (Gate B 28.10.2026 Nr 39: «BR 0» «Bataillonsrapport KVK», «KR» «Kompanierapport»), der von «DR» mit Text «Dienstrapport» = abbreviationMeaning(Plan, «DR», Vorlage des Plans), Standardgrösse S, Schnitt normal, Rolle sidebar, ohne Datum; frame ab Spaltenlinie + ½ Strich + textInsetPt bis zum Textrand, Grundlinie wie «DR» (± 0,01)', async () => {
    const plan = kvk();
    const L = await kvkSeite();
    const b = L.texts.filter((t) => t.kind === 'abbreviationMeaning');
    expect(b.length).toBe(3);
    const textVon = (r: (typeof L.texts)[number]): string =>
      text(L.pages[r.page]?.items[r.item] as TextItem);
    expect(b.map(textVon).sort()).toEqual([
      'Bataillonsrapport KVK',
      'Dienstrapport',
      'Kompanierapport',
    ]);
    const ref = b.find((r) => textVon(r) === 'Dienstrapport') as (typeof L.texts)[number];
    expect(plan.templateId).toBe('kp');
    const S = kpTemplate().fontSizes.standard;
    expect(ref.standardSizePt).toBe(S);
    expect(ref.date).toBeNull();
    expect(ref.page).toBe(0);
    const it = L.pages[ref.page]?.items[ref.item] as TextItem;
    expect(it.kind).toBe('text');
    expect(it.role).toBe('sidebar');
    expect(text(it)).toBe(abbreviationMeaning(plan, 'DR', kpTemplate()));
    expect(text(it)).toBe('Dienstrapport');
    expect(it.runs.every((r) => r.weight === 'regular')).toBe(true);
    // TR-E102k-06 (V-02k-6): frame von Spaltenlinie + ½·T + textInsetPt bis zum Textrand; Grundlinie wie «DR».
    const lg = lagen(L);
    const x = lg.xS + lg.a + kpPageGeometry().pageLines.table.widthPt / 2 + INSET;
    erwarteFrame(it.frame, { x, w: lg.textRechts - x }, 'Bedeutung');
    expect(Math.abs(it.x - x), 'Bedeutung linksbündig auf frame.x').toBeLessThanOrEqual(TOL);
    const dr = texteDerArt(L, 'abbreviation').filter((t) => text(t.item) === 'DR');
    expect(dr.length).toBe(1);
    expect(
      Math.abs(it.baselineY - (dr[0] as { item: TextItem }).item.baselineY),
    ).toBeLessThanOrEqual(TOL);
  });
});
