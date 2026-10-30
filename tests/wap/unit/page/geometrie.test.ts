// @vitest-environment jsdom
// Paket E1-02e: Seitengeometrie, Bereiche, Fehlerreihenfolge, Einstieg und Zeichenreihenfolge (R-10-06; Vertrag
// E1-02e Notiz «Ausarbeitung Schritt 2» Abschnitt B, C1 bis C5, D (T-1), J R-10-06 «U»). Werte der Kp-Seite nur
// aus der versionierten CSV anhang-b-kp.csv (Q-015); pseudonymisierte KVK-Fixture und fiktive Varianten.
// Nachtrag E1-02k (Vertrag E1-02k §7 N2, Gate S A3/A4): rapportBorder nach B-Kp-58 neu, remarkRule nach B-Kp-116.
import { describe, expect, it } from 'vitest';
import { ModelError } from '../../../../src/model/wap/errors';
import * as Layout from '../../../../src/model/wap/layout';
import * as Grid from '../../../../src/model/wap/layout/grid';
import { GridLayoutError } from '../../../../src/model/wap/layout/grid';
import * as A3 from '../../../../src/model/wap/layout/page/a3';
import * as Agenda from '../../../../src/model/wap/layout/page/agenda';
import * as Compose from '../../../../src/model/wap/layout/page/compose';
import {
  LAYOUT_WARNING_MESSAGES,
  PAGE_LAYOUT_MESSAGES,
  PageLayoutError,
} from '../../../../src/model/wap/layout/page/errors';
import * as Geometry from '../../../../src/model/wap/layout/page/geometry';
import * as GeometryKp from '../../../../src/model/wap/layout/page/geometryKp';
import * as GridChrome from '../../../../src/model/wap/layout/page/gridChrome';
import * as Header from '../../../../src/model/wap/layout/page/header';
import * as Sidebar from '../../../../src/model/wap/layout/page/sidebar';
import * as Texts from '../../../../src/model/wap/layout/page/texts';
import type { PageGeometry, WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import * as Warnings from '../../../../src/model/wap/layout/page/warnings';
import type {
  LineItem,
  PageItem,
  PageModel,
  Stroke,
  TextItem,
} from '../../../../src/model/wap/layout/pageModel';
import { breakText } from '../../../../src/model/wap/layout/text/break';
import {
  isRenderable,
  measureRuns,
  missingGlyphs,
} from '../../../../src/model/wap/layout/text/measure';
import { ascentPt, fontMetrics, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { FONT_FAMILY_SCREEN } from '../../../../src/model/wap/layout/text/types';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { dayRemark } from '../../support/model/builders';
import { leseBkp, ZAHL, zahl } from '../../support/page/bkp';
import { optionen, seite } from '../../support/page/seite';
import {
  farbeAus,
  form,
  MUSTER_07,
  MUSTER_108,
  strichAus,
  strichVon,
  zeile,
} from '../../support/page/stile';
import { KVK_WOCHE, kvk, MO, mitEintraegen, mitTagen } from '../../support/page/varianten';

const K = 72 / 25.4;
const SCHWARZ = { r: 0, g: 0, b: 0 };

function strich(widthPt: number, dash: readonly number[] | null = null): Stroke {
  return { color: SCHWARZ, widthPt, dash };
}

function nahe(ist: number, soll: number, tol: number, was: string): void {
  expect(Math.abs(ist - soll), `${was}: ${ist} statt ${soll} (± ${tol})`).toBeLessThanOrEqual(
    tol + 1e-9,
  );
}

/** Werte der CSV mit Formmuster (Vertrag I: Zahlen nur aus der CSV). */
function csvWerte() {
  const d = leseBkp();
  const v = (id: string, re: RegExp, spalte: 'sollwert' | 'soll' = 'sollwert'): RegExpExecArray =>
    form(id, spalte, zeile(d, id)[spalte], re);
  const papier = v('B-Kp-01', new RegExp(`^(${ZAHL}) × (${ZAHL})$`));
  const h10 = v('B-Kp-10', new RegExp(`^(${ZAHL}) × h / (${ZAHL}) × h$`));
  const was = v('B-Kp-87', new RegExp(`Kopfzeile (${ZAHL}) h`), 'soll');
  const groessen = v('B-Kp-108', MUSTER_108);
  const faktor = (id: string) => zahl(v(id, new RegExp(`^(${ZAHL}) × h`))[1] ?? '');
  const prozent = (id: string) => zahl(v(id, new RegExp(`^(${ZAHL}) % von W_R$`))[1] ?? '') / 100;
  const einzel = (id: string) => zahl(v(id, new RegExp(`^(${ZAHL})$`))[1] ?? '');
  const n = (m: RegExpExecArray, i: number) => zahl(m[i] ?? '');
  return {
    papier: { w: n(papier, 1), h: n(papier, 2) },
    rand: { lr: einzel('B-Kp-04'), ou: einzel('B-Kp-05') },
    rahmen: einzel('B-Kp-02'),
    kopf: faktor('B-Kp-08'),
    tageskopf: faktor('B-Kp-09'),
    spaltenkopf: { waagrecht: n(h10, 1), senkrecht: n(h10, 2) },
    raster: faktor('B-Kp-12'),
    abstand: faktor('B-Kp-13'),
    termine: faktor('B-Kp-14'),
    wasZeile: zahl(was[1] ?? ''),
    achse: prozent('B-Kp-15'),
    seitenleiste: prozent('B-Kp-16'),
    groessen: {
      title: n(groessen, 1),
      beilage: n(groessen, 2),
      weekLine: n(groessen, 3),
      signature: n(groessen, 4),
      motto: n(groessen, 5),
      sunTime: n(groessen, 6),
      readiness: n(groessen, 7),
    },
    h07: v('B-Kp-07', MUSTER_07),
  };
}

describe('Seitengeometrie der Kp-Vorlage (R-10-06, Abschnitt B, C)', () => {
  it('[R-10-06] pageGeometryFor("kp") liefert kpPageGeometry(), jedes Mal dasselbe eingefrorene Objekt', () => {
    const g = Geometry.pageGeometryFor('kp');
    expect(g).toBe(GeometryKp.kpPageGeometry());
    expect(GeometryKp.kpPageGeometry()).toBe(GeometryKp.kpPageGeometry());
    expect(Object.isFrozen(g)).toBe(true);
    expect(g.id).toBe('kp');
  });

  it('[R-10-06] unbekannte Seitengeometrie → PageLayoutError «unknownPageGeometry» mit verbindlicher Meldung', () => {
    expect(Geometry.pageGeometryFor('kp').id).toBe('kp');
    for (const id of ['bat', '', 'KP', 'kp ']) {
      let fehler: unknown;
      try {
        Geometry.pageGeometryFor(id);
      } catch (e) {
        fehler = e;
      }
      expect(fehler, `id «${id}»`).toBeInstanceOf(PageLayoutError);
      const f = fehler as PageLayoutError;
      expect(f.code).toBe('unknownPageGeometry');
      expect(f.userMessage).toEqual(PAGE_LAYOUT_MESSAGES.unknownPageGeometry);
      expect(f.message).toBe('Die Seitenvorlage des Plans ist unbekannt.');
      expect(f.userMessage.nextStep).toBe(
        'Den WAP-Planer neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.',
      );
    }
  });

  it('[R-10-06] Werte der Kp-Geometrie = Sollwerte der CSV (Papier, Ränder, Rahmen, Höhen in h, Breitenanteile, Schriftgrössen B-Kp-108)', () => {
    const g = GeometryKp.kpPageGeometry();
    const c = csvWerte();
    expect(g.paper).toEqual({ widthPt: c.papier.w, heightPt: c.papier.h });
    expect(g.marginsMm).toEqual({
      top: c.rand.ou,
      right: c.rand.lr,
      bottom: c.rand.ou,
      left: c.rand.lr,
    });
    expect(g.frameStroke).toEqual(strich(c.rahmen));
    expect(g.heightsH).toEqual({
      header: c.kopf,
      dayHeader: c.tageskopf,
      columnHeaderHorizontal: c.spaltenkopf.waagrecht,
      columnHeaderVertical: c.spaltenkopf.senkrecht,
      grid: c.raster,
      gap: c.abstand,
      agenda: c.termine,
      agendaHead: c.wasZeile,
    });
    nahe(g.widthShares.timeAxis, c.achse, 1e-12, 'Zeitachse');
    nahe(g.widthShares.sidebar, c.seitenleiste, 1e-12, 'Seitenleiste');
    expect(g.fontSizes).toEqual(c.groessen);
  });

  it('[R-10-06][R-10-50][R-10-52] Linienarten nach E1-02d §5 und B-Kp; Seitenlinien (V-02e-15) und feine Bemerkungslinie (B-Kp-116); Rapportrahmen dünn (B-Kp-58); Farben', () => {
    const g = GeometryKp.kpPageGeometry();
    const d = leseBkp();
    const s = (id: string) => strichVon(strichAus(d, id));
    const zahlIn = (id: string, spalte: 'soll' | 'sollwert', re: RegExp) =>
      strich(zahl(form(id, spalte, zeile(d, id)[spalte], re)[1] ?? ''));
    expect(g.lines).toEqual({
      hour: s('B-Kp-45'),
      halfHour: s('B-Kp-46'),
      gridEdge: s('B-Kp-48'),
      dayBorder: s('B-Kp-38'),
      columnBorder: s('B-Kp-39'),
      rapSeparator: s('B-Kp-40'),
      laneBorder: s('B-Kp-41'),
      blockBorder: s('B-Kp-50'),
      rapportBorder: s('B-Kp-58'),
      besoBoxBorder: s('B-Kp-61'),
      querbalkenBorder: s('B-Kp-70'),
      markerLine: s('B-Kp-65'),
      markerFieldBorder: s('B-Kp-67'),
    });
    expect(g.pageLines).toEqual({
      headerBottom: s('B-Kp-27'),
      titleFrame: s('B-Kp-19'),
      classificationFrame: zahlIn('B-Kp-24', 'sollwert', new RegExp(`^Rahmen (${ZAHL}) pt;`)),
      sidebarEdge: g.lines.gridEdge,
      dayHeadBottom: g.lines.gridEdge,
      agendaTop: zahlIn('B-Kp-13', 'soll', new RegExp(`waagrechte Linien (${ZAHL}) pt`)),
      agendaHeadBottom: zahlIn('B-Kp-87', 'soll', new RegExp(`mit Linie (${ZAHL}) pt darunter`)),
      table: s('B-Kp-78'),
      readinessFrame: zahlIn('B-Kp-75', 'sollwert', new RegExp(`Rahmen (${ZAHL});`)),
      sunTable: zahlIn('B-Kp-84', 'sollwert', new RegExp(`Rahmen (${ZAHL}) pt;`)),
      // Vertrag E1-02k §5 (Gate S A4): feine Zeilen- und Nr-Spaltenlinie der Bemerkungen.
      remarkRule: s('B-Kp-116'),
    });
    // Gate S A3 (Vertrag E1-02k §1): Rapportrahmen gleich dem Blockrahmen.
    expect(g.lines.rapportBorder).toEqual(g.lines.blockBorder);
    expect(g.colors).toEqual({
      text: farbeAus('B-Kp-99'),
      readinessGrey: farbeAus('B-Kp-98'),
      // Statusrot nach Gate 0 Q-009 (#c00000, Vertrag B «colors»); B-Kp-100 ist an E1-10 aufgeschoben.
      statusRed: { r: 192, g: 0, b: 0 },
    });
  });
});

/** Erwarteter Seitenrahmen nach C1 bis C3 aus den Werten der Geometrie. */
function erwarteterRahmen(g: PageGeometry, senkrecht: boolean) {
  const w = g.frameStroke.widthPt;
  const fx = g.marginsMm.left * K + w / 2;
  const fy = g.marginsMm.top * K + w / 2;
  const WR = g.paper.widthPt - (g.marginsMm.left + g.marginsMm.right) * K - w;
  const HR = g.paper.heightPt - (g.marginsMm.top + g.marginsMm.bottom) * K - w;
  const hh = g.heightsH;
  const c = senkrecht ? hh.columnHeaderVertical : hh.columnHeaderHorizontal;
  const h = HR / (hh.header + hh.dayHeader + c + hh.grid + hh.gap + hh.agenda);
  const a = g.widthShares.timeAxis * WR;
  const s = g.widthShares.sidebar * WR;
  const xS = fx + WR - s;
  const yK = fy + hh.header * h;
  const yTo = yK + (hh.dayHeader + c + hh.grid) * h;
  const yT = yTo + hh.gap * h;
  const yU = fy + HR;
  const rechts = fx + WR;
  return {
    frame: { x: fx, y: fy, w: WR, h: HR },
    h,
    header: { x: fx, y: fy, w: xS - fx, h: yK - fy },
    standCell: { x: xS, y: fy, w: rechts - xS, h: yK - fy },
    gridRect: { x: fx, y: yK, w: xS - fx, h: yTo - yK },
    timeAxisWidthPt: a,
    dayHeaderHeightPt: hh.dayHeader * h,
    columnHeaderHeightPt: c * h,
    sidebarUpper: { x: xS, y: yK, w: rechts - xS, h: yTo - yK },
    agenda: { x: fx, y: yT, w: xS - a - fx, h: yU - yT },
    sidebarLower: { x: xS - a, y: yTo, w: rechts - (xS - a), h: yU - yTo },
  };
}

function rechteckNahe(
  ist: { x: number; y: number; w: number; h: number },
  soll: { x: number; y: number; w: number; h: number },
  was: string,
): void {
  nahe(ist.x, soll.x, 0.01, `${was} x`);
  nahe(ist.y, soll.y, 0.01, `${was} y`);
  nahe(ist.w, soll.w, 0.01, `${was} w`);
  nahe(ist.h, soll.h, 0.01, `${was} h`);
}

function senkrechterKopfPlan(i: number, kind: 'planning' | 'secondary' | 'rap' | 'beso'): Plan {
  const p = kvk();
  return {
    ...p,
    columnSets: p.columnSets.map((s) =>
      s.id === 's16'
        ? {
            ...s,
            columns: s.columns.map((c, j) =>
              j === i && c.kind === kind ? { ...c, labelOrientation: 'vertical' as const } : c,
            ),
          }
        : s,
    ),
  };
}

describe('pageFrame nach C1 bis C3 (R-10-06)', () => {
  it('[R-10-06] KVK (waagrechte Köpfe): Rahmen, h, Kopf, Stand-Feld, Raster, Seitenleiste oben und unten, Termine ± 0,01', () => {
    const g = GeometryKp.kpPageGeometry();
    const f = Geometry.pageFrame(g, kvk(), KVK_WOCHE);
    const e = erwarteterRahmen(g, false);
    expect(f.verticalColumnHeads).toBe(false);
    rechteckNahe(f.frame, e.frame, 'Rahmen');
    nahe(f.h, e.h, 0.01, 'h');
    rechteckNahe(f.header, e.header, 'Kopf');
    rechteckNahe(f.standCell, e.standCell, 'Stand-Feld');
    rechteckNahe(f.grid.rect, e.gridRect, 'Raster');
    nahe(f.grid.timeAxisWidthPt, e.timeAxisWidthPt, 0.01, 'Zeitachse');
    nahe(f.grid.dayHeaderHeightPt, e.dayHeaderHeightPt, 0.01, 'Tageskopf');
    nahe(f.grid.columnHeaderHeightPt, e.columnHeaderHeightPt, 0.01, 'Spaltenkopf');
    expect(f.grid.lines).toEqual(g.lines);
    rechteckNahe(f.sidebarUpper, e.sidebarUpper, 'Seitenleiste oben');
    rechteckNahe(f.agenda, e.agenda, 'Termine');
    rechteckNahe(f.sidebarLower, e.sidebarLower, 'Seitenleiste unten');
  });

  it('[R-10-06] h aus der Rahmenhöhe nach B-Kp-07 (H_R / 30,77 waagrecht, H_R / 31,97 senkrecht, ± 0,5 %); 60 · ptPerMinute = h bei 0400–2400 (C3)', () => {
    const g = GeometryKp.kpPageGeometry();
    const c = csvWerte();
    const waag = Geometry.pageFrame(g, kvk(), KVK_WOCHE);
    const senk = Geometry.pageFrame(g, senkrechterKopfPlan(0, 'planning'), KVK_WOCHE);
    const tolW = 0.005 * (waag.frame.h / zahl(c.h07[2] ?? ''));
    nahe(waag.h, waag.frame.h / zahl(c.h07[2] ?? ''), tolW, 'h waagrecht');
    nahe(senk.h, senk.frame.h / zahl(c.h07[1] ?? ''), 0.005 * senk.h, 'h senkrecht');
    const L = seite(kvk(), KVK_WOCHE);
    nahe(60 * L.grid.timeScale.ptPerMinute, L.frame.h, 0.01, '60 · ptPerMinute');
  });

  it('[R-10-06] (V-02e-16) senkrechter Kopf einer Planungs- oder Nebenspalte an einem sichtbaren Tag → c = 1,83 h; Rap- und Beso-Köpfe und ausgeblendete Tage wirken nicht', () => {
    const g = GeometryKp.kpPageGeometry();
    const planung = Geometry.pageFrame(g, senkrechterKopfPlan(1, 'planning'), KVK_WOCHE);
    expect(planung.verticalColumnHeads).toBe(true);
    const e = erwarteterRahmen(g, true);
    nahe(planung.h, e.h, 0.01, 'h senkrecht');
    nahe(planung.grid.columnHeaderHeightPt, e.columnHeaderHeightPt, 0.01, 'Kopfhöhe senkrecht');
    rechteckNahe(planung.agenda, e.agenda, 'Termine senkrecht');
    // Nebenspalte «Det» im Satz s7 (Mo, Di).
    const p = kvk();
    const neben: Plan = {
      ...p,
      columnSets: p.columnSets.map((s) =>
        s.id === 's7'
          ? {
              ...s,
              columns: s.columns.map((c) =>
                c.kind === 'secondary' ? { ...c, labelOrientation: 'vertical' as const } : c,
              ),
            }
          : s,
      ),
    };
    expect(Geometry.pageFrame(g, neben, KVK_WOCHE).verticalColumnHeads).toBe(true);
    expect(
      Geometry.pageFrame(g, senkrechterKopfPlan(3, 'rap'), KVK_WOCHE).verticalColumnHeads,
    ).toBe(false);
    expect(
      Geometry.pageFrame(g, senkrechterKopfPlan(4, 'beso'), KVK_WOCHE).verticalColumnHeads,
    ).toBe(false);
    // Senkrechter Kopf nur an ausgeblendeten Tagen (Mi–Fr ausgeblendet).
    const verborgen = mitTagen(senkrechterKopfPlan(0, 'planning'), KVK_WOCHE, (d, i) => ({
      display: i >= 2 && i <= 4 ? 'hidden' : d.display,
    }));
    expect(Geometry.pageFrame(g, verborgen, KVK_WOCHE).verticalColumnHeads).toBe(false);
  });

  it('[R-10-06] pageFrame mit unbekannter Woche → ModelError «unknownWeek»', () => {
    const g = GeometryKp.kpPageGeometry();
    let fehler: unknown;
    try {
      Geometry.pageFrame(g, kvk(), 'w99');
    } catch (e) {
      fehler = e;
    }
    expect(fehler).toBeInstanceOf(ModelError);
    expect((fehler as ModelError).code).toBe('unknownWeek');
  });

  it('[R-10-06] WeekPageLayout: frame = pageFrame, regions nach B (grid = frame.grid.rect, sidebar = frame.sidebarUpper), Seitengrösse 841,89 × 595,28, erste Seite «week»', () => {
    const L = seite(kvk(), KVK_WOCHE);
    const f = Geometry.pageFrame(GeometryKp.kpPageGeometry(), kvk(), KVK_WOCHE);
    expect(L.frame).toEqual(f);
    expect(L.regions).toEqual({
      header: f.header,
      grid: f.grid.rect,
      sidebar: f.sidebarUpper,
      agenda: f.agenda,
    });
    expect(L.pages.length).toBe(1);
    const p = L.pages[0] as PageModel;
    expect(p.kind).toBe('week');
    expect(p.widthPt).toBe(841.89);
    expect(p.heightPt).toBe(595.28);
  });

  it('[R-10-06] texts: je TextItem aller Seiten genau ein Eintrag mit gültigem Index; Einträge des Rasters mit Art «entry» und standardSizePt null', () => {
    const L = seite(kvk(), KVK_WOCHE);
    const alle: string[] = [];
    L.pages.forEach((p, pi) => {
      p.items.forEach((it, ii) => {
        if (it.kind === 'text') alle.push(`${pi}/${ii}`);
      });
    });
    const refs = L.texts.map((t) => `${t.page}/${t.item}`);
    expect(new Set(refs).size).toBe(refs.length);
    expect([...refs].sort()).toEqual([...alle].sort());
    const g0 = teilfolge((L.pages[0] as PageModel).items, L.grid.items);
    expect(g0).toBeGreaterThanOrEqual(0);
    const imRaster = (page: number, item: number) =>
      page === 0 && item >= g0 && item < g0 + L.grid.items.length;
    for (const t of L.texts) {
      expect((L.pages[t.page] as PageModel).items[t.item]?.kind).toBe('text');
      if (imRaster(t.page, t.item)) {
        expect(t.kind).toBe('entry');
        expect(t.standardSizePt).toBeNull();
      } else {
        expect(t.kind).not.toBe('entry');
        expect(t.standardSizePt).not.toBeNull();
      }
    }
  });
});

describe('Fehlerreihenfolge von layoutWeekPage (Abschnitt B «Fehlerverhalten»)', () => {
  const fang = (f: () => unknown): unknown => {
    try {
      f();
    } catch (e) {
      return e;
    }
    return undefined;
  };

  it('[R-10-06] 1. unbekannte Woche vor unbekannter Vorlage, Geometrie und A3', () => {
    expect(seite(kvk(), KVK_WOCHE).pages.length).toBeGreaterThan(0);
    const e1 = fang(() => Compose.layoutWeekPage(kvk(), 'w99', optionen()));
    expect(e1).toBeInstanceOf(ModelError);
    expect((e1 as ModelError).code).toBe('unknownWeek');
    const e2 = fang(() =>
      Compose.layoutWeekPage(
        { ...kvk(), templateId: 'xx' },
        'w99',
        optionen({ paper: 'A3', templates: new Map() }),
      ),
    );
    expect((e2 as ModelError).code).toBe('unknownWeek');
  });

  it('[R-10-06] 2. unbekannte Vorlage → ModelError «unknownTemplate», auch mit A3 und ungültigem Anzeigebereich', () => {
    expect(seite(kvk(), KVK_WOCHE).pages.length).toBeGreaterThan(0);
    const p: Plan = { ...kvk(), templateId: 'xx', displayRange: { from: 240, to: 300 } };
    const e = fang(() => Compose.layoutWeekPage(p, KVK_WOCHE, optionen({ paper: 'A3' })));
    expect(e).toBeInstanceOf(ModelError);
    expect((e as ModelError).code).toBe('unknownTemplate');
  });

  it('[R-10-06] 3. Vorlage mit unbekannter Seitengeometrie → PageLayoutError «unknownPageGeometry» vor A3 und Rasterfehlern', () => {
    expect(seite(kvk(), KVK_WOCHE).pages.length).toBeGreaterThan(0);
    const t = { ...kpTemplate(), pageGeometryId: 'bat' };
    const templates = new Map([[t.id, t]]);
    const p: Plan = { ...kvk(), displayRange: { from: 240, to: 300 } };
    const e = fang(() =>
      Compose.layoutWeekPage(p, KVK_WOCHE, optionen({ paper: 'A3', templates })),
    );
    expect(e).toBeInstanceOf(PageLayoutError);
    expect((e as PageLayoutError).code).toBe('unknownPageGeometry');
    expect((e as PageLayoutError).userMessage).toEqual(PAGE_LAYOUT_MESSAGES.unknownPageGeometry);
  });

  it('[R-10-06] 4. paper «A3» → Stub-Fehler layout.page.a3 bis E1-10, vor den Fehlern von layoutGrid', () => {
    expect(seite(kvk(), KVK_WOCHE).pages.length).toBeGreaterThan(0);
    const p: Plan = { ...kvk(), displayRange: { from: 240, to: 300 } };
    const e = fang(() => Compose.layoutWeekPage(p, KVK_WOCHE, optionen({ paper: 'A3' })));
    expect(e).toBeInstanceOf(Error);
    expect((e as Error).message).toBe('nicht implementiert: layout.page.a3');
  });

  it('[R-10-06] 5. danach die Fehler von layoutGrid unverändert: invalidDisplayRange, RangeError bei ungültigen fontSizes', () => {
    expect(seite(kvk(), KVK_WOCHE).pages.length).toBeGreaterThan(0);
    const e1 = fang(() =>
      Compose.layoutWeekPage(
        { ...kvk(), displayRange: { from: 240, to: 300 } },
        KVK_WOCHE,
        optionen(),
      ),
    );
    expect(e1).toBeInstanceOf(GridLayoutError);
    expect((e1 as GridLayoutError).code).toBe('invalidDisplayRange');
    const t = kpTemplate();
    const kaputt = { ...t, fontSizes: { ...t.fontSizes, min: 0 } };
    const e2 = fang(() =>
      Compose.layoutWeekPage(
        kvk(),
        KVK_WOCHE,
        optionen({ templates: new Map([[kaputt.id, kaputt]]) }),
      ),
    );
    expect(e2).toBeInstanceOf(RangeError);
  });

  it('[R-10-42] fachliche Zustände sind Rückgabewerte: übervoller Terminbereich wirft nicht, sondern ergibt eine Fortsetzungsseite', () => {
    const viele = Array.from({ length: 60 }, (_, i) =>
      dayRemark(`e${600 + i}`, 600 + i, {
        date: MO,
        text: `Hinweis ${String(i + 1).padStart(2, '0')}`,
      }),
    );
    const L = seite(mitEintraegen(kvk(), viele), KVK_WOCHE);
    expect(L.pages.length).toBeGreaterThan(1);
  });
});

describe('Einstieg layout/index.ts (V20)', () => {
  it('[R-10-06] layout/index.ts exportiert Seitenkomposition, Raster, Seitenmodell und Textsatz mit denselben Objekten', () => {
    expect(seite(kvk(), KVK_WOCHE).pages.length).toBeGreaterThan(0);
    const L = Layout as Record<string, unknown>;
    const erwartet: Record<string, unknown> = {
      layoutWeekPage: Compose.layoutWeekPage,
      pageGeometryFor: Geometry.pageGeometryFor,
      pageFrame: Geometry.pageFrame,
      kpPageGeometry: GeometryKp.kpPageGeometry,
      weekTitle: Texts.weekTitle,
      weekRangeText: Texts.weekRangeText,
      fitSingleLine: Texts.fitSingleLine,
      layoutHeader: Header.layoutHeader,
      layoutGridChrome: GridChrome.layoutGridChrome,
      layoutAgenda: Agenda.layoutAgenda,
      layoutSidebar: Sidebar.layoutSidebar,
      textWarnings: Warnings.textWarnings,
      a3: A3.a3,
      PageLayoutError,
      PAGE_LAYOUT_MESSAGES,
      LAYOUT_WARNING_MESSAGES,
      layoutGrid: Grid.layoutGrid,
      GRID_CONSTANTS: Grid.GRID_CONSTANTS,
      breakText,
      measureRuns,
      missingGlyphs,
      isRenderable,
      ascentPt,
      fontMetrics,
      lineHeightPt,
      FONT_FAMILY_SCREEN,
    };
    for (const [name, wert] of Object.entries(erwartet)) {
      expect(L[name], `Export ${name}`).toBe(wert);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// Zeichenreihenfolge D (T-1)
// ---------------------------------------------------------------------------------------------------------

type Kat =
  | 'halbstunde'
  | 'stunde'
  | 'grenze'
  | 'tageskopf'
  | 'rasterOben'
  | 'rasterUnten'
  | 'seitenleiste'
  | 'tagesgrenze'
  | 'termine'
  | 'was'
  | 'andere';

function gleicherStrich(a: Stroke, b: Stroke): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function kategorie(l: LineItem, L: WeekPageLayout, g: PageGeometry): Kat {
  const f = L.frame;
  const waag = Math.abs(l.y1 - l.y2) < 1e-9;
  const senk = Math.abs(l.x1 - l.x2) < 1e-9;
  const yK = f.grid.rect.y;
  const kopfUnten = yK + f.grid.dayHeaderHeightPt;
  const yFrom = kopfUnten + f.grid.columnHeaderHeightPt;
  const yTo = f.grid.rect.y + f.grid.rect.h;
  const xS = f.grid.rect.x + f.grid.rect.w;
  const n = (a: number, b: number) => Math.abs(a - b) < 0.01;
  if (waag && gleicherStrich(l.stroke, g.lines.halfHour) && l.y1 > yFrom && l.y1 < yTo)
    return 'halbstunde';
  if (waag && gleicherStrich(l.stroke, g.lines.hour) && l.y1 > yFrom && l.y1 < yTo) return 'stunde';
  if (senk && n(Math.min(l.y1, l.y2), kopfUnten) && n(Math.max(l.y1, l.y2), yTo)) return 'grenze';
  if (senk && n(Math.min(l.y1, l.y2), yFrom) && n(Math.max(l.y1, l.y2), yTo)) return 'grenze';
  if (waag && n(l.y1, kopfUnten)) return 'tageskopf';
  if (waag && n(l.y1, yFrom)) return 'rasterOben';
  if (waag && n(l.y1, yTo)) return 'rasterUnten';
  if (senk && n(l.x1, xS)) return 'seitenleiste';
  if (senk && n(Math.min(l.y1, l.y2), yK)) return 'tagesgrenze';
  if (waag && n(l.y1, f.agenda.y)) return 'termine';
  if (waag && l.y1 > f.agenda.y) return 'was';
  return 'andere';
}

/** Index, ab dem `teil` strukturell gleich in `alle` steht (−1, wenn nicht). */
function teilfolge(alle: readonly PageItem[], teil: readonly PageItem[]): number {
  const t = teil.map((x) => JSON.stringify(x));
  const a = alle.map((x) => (x.kind === 'image' ? '' : JSON.stringify(x)));
  for (let k = 0; k + t.length <= a.length; k++) {
    if (t.every((v, j) => a[k + j] === v)) return k;
  }
  return -1;
}

function abschnitte(kats: readonly Kat[]): Kat[] {
  return kats.filter((k, i) => i === 0 || kats[i - 1] !== k);
}

describe('Zeichenreihenfolge der Wochenseite (D, T-1)', () => {
  it('[R-10-06] (T-1) Rahmen zuerst, dann Kopf (Formen vor Texten), Rasterlinien, Rasterköpfe, GridLayout.items unverändert, Termine, Seitenleiste (Formen vor Texten)', () => {
    const L = seite(kvk(), KVK_WOCHE);
    const items = (L.pages[0] as PageModel).items;
    const erstes = items[0] as PageItem;
    expect(erstes.kind).toBe('rect');
    expect(erstes.role).toBe('frame');
    const rollen = items.map((i) => i.role);
    const start = rollen.indexOf('header');
    expect(start).toBe(1);
    let i = start;
    while (rollen[i] === 'header') i++;
    const kopf = items.slice(start, i);
    const ersterText = kopf.findIndex((x) => x.kind === 'text');
    expect(ersterText).toBeGreaterThan(0);
    expect(kopf.slice(ersterText).every((x) => x.kind === 'text')).toBe(true);
    // Rasterlinien und Köpfe bis zum Beginn von GridLayout.items.
    expect(L.grid.items.length).toBeGreaterThan(0);
    const g0 = teilfolge(items, L.grid.items);
    expect(g0).toBeGreaterThan(i);
    const chrome = items.slice(i, g0);
    expect(
      chrome.every((x) => ['gridLine', 'timeAxis', 'dayHeader', 'columnHeader'].includes(x.role)),
    ).toBe(true);
    const linien = chrome.filter((x): x is LineItem => x.kind === 'line');
    const texte = chrome.filter((x): x is TextItem => x.kind === 'text');
    expect(linien.length + texte.length).toBe(chrome.length);
    expect(chrome.findIndex((x) => x.kind === 'text')).toBe(linien.length);
    expect(items.slice(g0, g0 + L.grid.items.length)).toEqual(L.grid.items);
    // Termine, dann Seitenleiste.
    const nachRaster = items.slice(g0 + L.grid.items.length);
    const t0 = nachRaster.findIndex((x) => x.role !== 'agenda');
    expect(t0).toBeGreaterThan(0);
    const termine = nachRaster.slice(0, t0);
    expect(termine.every((x) => x.kind === 'text')).toBe(true);
    const leiste = nachRaster.slice(t0);
    expect(leiste.every((x) => ['sidebar', 'legend', 'signature', 'sun'].includes(x.role))).toBe(
      true,
    );
    const lt = leiste.findIndex((x) => x.kind === 'text');
    expect(lt).toBeGreaterThan(0);
    expect(leiste.slice(lt).every((x) => x.kind === 'text')).toBe(true);
  });

  it('[R-10-06] (T-1) Rasterlinien: Halbstunden und Stunden je von oben, Spalten-/Bahngrenzen von links, Tageskopf-Unterlinie, Rasterbegrenzung oben und unten, Seitenleistenlinie, Tagesgrenzen von links, Termine-Oberlinie, «Was»-Linie', () => {
    const L = seite(kvk(), KVK_WOCHE);
    const g = GeometryKp.kpPageGeometry();
    const items = (L.pages[0] as PageModel).items;
    const linien = items.filter((x): x is LineItem => x.kind === 'line' && x.role === 'gridLine');
    const kats = linien.map((l) => kategorie(l, L, g));
    expect(kats.filter((k) => k === 'andere')).toEqual([]);
    expect(abschnitte(kats)).toEqual([
      'halbstunde',
      'stunde',
      'grenze',
      'tageskopf',
      'rasterOben',
      'rasterUnten',
      'seitenleiste',
      'tagesgrenze',
      'termine',
      'was',
    ]);
    const nach = (k: Kat) => linien.filter((_, j) => kats[j] === k);
    const aufsteigend = (xs: number[]) =>
      xs.every((v, j) => j === 0 || v > (xs[j - 1] as number) - 1e-9);
    expect(aufsteigend(nach('halbstunde').map((l) => l.y1))).toBe(true);
    expect(aufsteigend(nach('stunde').map((l) => l.y1))).toBe(true);
    expect(aufsteigend(nach('grenze').map((l) => l.x1))).toBe(true);
    expect(aufsteigend(nach('tagesgrenze').map((l) => l.x1))).toBe(true);
    expect(nach('halbstunde').length).toBe(20);
    expect(nach('stunde').length).toBe(19);
  });

  it('[R-10-06] (T-1) Rastertexte: «Zeit» links, rechts; Stundenbeschriftung links von oben, dann rechts; Tagesköpfe; Spaltenköpfe', () => {
    const L = seite(kvk(), KVK_WOCHE);
    const items = (L.pages[0] as PageModel).items;
    const texte = items.filter(
      (x): x is TextItem =>
        x.kind === 'text' && ['timeAxis', 'dayHeader', 'columnHeader'].includes(x.role),
    );
    const rollen = texte.map((t) => t.role).filter((r, j, a) => j === 0 || a[j - 1] !== r);
    expect(rollen).toEqual(['timeAxis', 'dayHeader', 'columnHeader']);
    const achse = texte.filter((t) => t.role === 'timeAxis');
    const text = (t: TextItem) => t.runs.map((r) => r.text).join('');
    expect(achse.slice(0, 2).map(text)).toEqual(['Zeit', 'Zeit']);
    expect((achse[0] as TextItem).x).toBeLessThan((achse[1] as TextItem).x);
    const stunden = achse.slice(2);
    expect(stunden.length).toBe(38);
    const links = stunden.slice(0, 19);
    const rechts = stunden.slice(19);
    expect(links.map(text)).toEqual(rechts.map(text));
    expect(links.map(text)[0]).toBe('0500');
    expect(links.map(text)[18]).toBe('2300');
    expect(
      links.every((t, j) => j === 0 || t.baselineY > (links[j - 1] as TextItem).baselineY),
    ).toBe(true);
    expect(Math.max(...links.map((t) => t.x))).toBeLessThan(Math.min(...rechts.map((t) => t.x)));
  });

  it('[R-10-06] (T-1) Fortsetzungsseite: dieselbe Ordnung ohne GridLayout.items (Rahmen, Kopf, Linien, Termine, Seitenleiste)', () => {
    const viele = Array.from({ length: 40 }, (_, i) =>
      dayRemark(`e${600 + i}`, 600 + i, {
        date: MO,
        text: `Bemerkung ${String(i + 1).padStart(2, '0')}`,
      }),
    );
    const L = seite(mitEintraegen(kvk(), viele), KVK_WOCHE);
    expect(L.pages.length).toBe(2);
    const p = L.pages[1] as PageModel;
    expect(p.kind).toBe('continuation');
    const items = p.items;
    expect((items[0] as PageItem).role).toBe('frame');
    const rasterRollen = ['querbalken', 'block', 'marker', 'rapport', 'besoBox', 'band'];
    expect(items.filter((x) => rasterRollen.includes(x.role))).toEqual([]);
    const reihen = abschnitte(
      items.map((x) =>
        x.role === 'header' || x.role === 'continuation'
          ? ('kopf' as Kat)
          : x.role === 'gridLine' ||
              x.role === 'dayHeader' ||
              x.role === 'timeAxis' ||
              x.role === 'columnHeader'
            ? ('raster' as Kat)
            : x.role === 'agenda'
              ? ('termine' as Kat)
              : x.role === 'frame'
                ? ('rahmen' as Kat)
                : ('leiste' as Kat),
      ),
    );
    const ohneLeiste = reihen.filter((r) => (r as string) !== 'leiste');
    expect(ohneLeiste.slice(0, 3)).toEqual(['rahmen', 'kopf', 'raster']);
    expect(reihen.indexOf('termine')).toBeGreaterThan(reihen.indexOf('raster' as Kat));
  });
});
