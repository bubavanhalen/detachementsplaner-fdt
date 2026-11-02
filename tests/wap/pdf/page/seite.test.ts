// @vitest-environment jsdom
// Paket E1-02e: die ganze Wochenseite im PDF (R-10-02, R-10-06, R-10-37, R-10-38, R-10-42, R-10-44, R-14.2-03,
// R-14.3-01, R-14.3-02, R-6-08, R-L-01; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» C4, C5, E3, E4, E6, F, G2,
// G3, H2 bis H9, J; V-02e-2, -3, -18, V01, V12). Nur readPdf/checks.ts; Sollwerte aus anhang-b-kp.csv.
// Pseudonymisierte KVK-Fixture, KVK+, synthetischer Plan (E1-02a) und fiktive Varianten.
// Nachtrag E1-02k (Vertrag E1-02k §7 N3, Gate S A4): Seitenleistenlinie der Fortsetzungsseite ab yK (R-10-52).
// Hinweis Q-032 (HALT, Auftraggeber): Die Erwartung «KVK: fallbacks leer in allen Regionen einschliesslich block
// und band» zu R-10-37 ist bis zum Entscheid nicht Teil dieser Datei (siehe describe «Schriftgrössen (R-10-37)»).
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { PdfWriteError, writePdf } from '../../../../src/io/wap-pdf/writer';
import { abbreviationsForWeek } from '../../../../src/model/wap/derive/abbreviations';
import { agendaLinesForDate } from '../../../../src/model/wap/derive/agenda';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { LtgCategory, Plan } from '../../../../src/model/wap/types';
import { beso, block, dayRemark, multiDayRemark, rt, win } from '../../support/model/builders';
import {
  analysiere,
  type SeitenAnalyse,
  sichtbareTage,
  textVerstoesse,
  ueberlappungen,
} from '../../support/page/analyse';
import { ZAHL } from '../../support/page/bkp';
import {
  bereiche,
  fortsetzungsBereiche,
  istSenkrecht,
  istWaagrecht,
  laeufe,
  mitte,
  nahe,
  norm,
  passtStil,
  striche,
  umriss,
  yVon,
} from '../../support/page/pdf-seite';
import { codePunkt, einmal, PDF_TITEL, seite, seitePdf } from '../../support/page/seite';
import { bkpZahlen, MUSTER_108, mindestgroesse } from '../../support/page/stile';
import {
  EINTAG,
  eintagPlan,
  KVK_WOCHE,
  kvk,
  kvkPlus,
  MO,
  mitEintraegen,
  mitTagen,
  mitWoche,
  woche,
} from '../../support/page/varianten';
import { edgesOffTime, minFontSize } from '../../support/pdf/checks';
import type { PdfInfo, PdfTextRun } from '../../support/pdf/read';
import { readPdf } from '../../support/pdf/read';
import { syntheticPlan } from '../../support/synthetic-plan';

/** Weiches Trennzeichen U+00AD und kombinierendes Trema U+0308 (als Code, sichtbar und nicht normalisiert). */
const SHY = String.fromCodePoint(0xad);
const TREMA = String.fromCodePoint(0x308);

const kvkPdf = einmal(() => seitePdf('seite-kvk', kvk(), KVK_WOCHE));
const plusPdf = einmal(() => seitePdf('seite-kvk-plus', kvkPlus(), KVK_WOCHE));
const synthetisch = einmal(async () => {
  const plan = syntheticPlan();
  const aus: { weekId: string; info: PdfInfo; pages: number; fallbacks: number }[] = [];
  for (const w of plan.weeks) {
    const p = await seitePdf(`seite-synthetisch-${w.id}`, plan, w.id);
    aus.push({
      weekId: w.id,
      info: p.info,
      pages: p.layout.pages.length,
      fallbacks: p.layout.fallbacks.length,
    });
  }
  return { plan, wochen: aus };
});

function bemerkungen(n: number, prefix: string, start: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `e${start + i}`,
    text: `${prefix} ${String(i + 1).padStart(2, '0')}`,
  }));
}

describe('Seitenzahl und Fortsetzung (R-10-02, R-10-42; C4, E3, E4, V-02e-2, -3, -18)', () => {
  it('[R-10-02] KVK: genau eine Seite A4 quer; 40 Tagesbemerkungen am Mo: 2 Seiten, Seite 2 mit «Fortsetzung – KVK»', async () => {
    const { info } = await kvkPdf();
    expect(info.pages.length).toBe(1);
    const viele = bemerkungen(40, 'Bemerkung', 600).map((b, i) =>
      dayRemark(b.id, 600 + i, { date: MO, text: b.text }),
    );
    const v = await seitePdf('seite-40-tagesbemerkungen', mitEintraegen(kvk(), viele), KVK_WOCHE);
    expect(v.info.pages.length).toBe(2);
    expect(
      v.info.texts.filter((t) => t.page === 2 && t.text.trim() === 'Fortsetzung – KVK').length,
    ).toBe(1);
    expect(v.info.texts.filter((t) => t.page === 1 && t.text.includes('Fortsetzung'))).toEqual([]);
  });

  it('[R-10-42] 40 einzeilige Tagesbemerkungen am Mo: Titel «Fortsetzung – KVK» an der Titelstelle von Seite 2; die Mo-Zeilen auf Seite 1 als Anfang und auf Seite 2 als Rest, jede genau einmal; Ereignis continuationPage (agenda, Mo)', async () => {
    const liste = bemerkungen(40, 'Bemerkung', 600);
    const viele = liste.map((b, i) => dayRemark(b.id, 600 + i, { date: MO, text: b.text }));
    const plan = mitEintraegen(kvk(), viele);
    const { info, layout } = await seitePdf('seite-40-tagesbemerkungen', plan, KVK_WOCHE);
    expect(info.pages.length).toBe(2);
    const fb = fortsetzungsBereiche(info, 2);
    const titel = info.texts.filter((t) => t.page === 2 && t.text.trim() === 'Fortsetzung – KVK');
    expect(titel.length).toBe(1);
    const t = titel[0] as PdfTextRun;
    expect(umriss(t).y + umriss(t).h).toBeLessThanOrEqual(fb.yK + 0.01);
    const [tolMitte] = bkpZahlen('B-Kp-21', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    expect(nahe(t.x + t.width / 2, fb.rahmen.x + fb.rahmen.w / 2, tolMitte as number)).toBe(true);
    expect(t.bold).toBe(true);
    const seiteVon = liste.map((b) => {
      const l = info.texts.filter((x) => x.text.trim() === b.text);
      expect(l.length, `«${b.text}» genau einmal`).toBe(1);
      return (l[0] as PdfTextRun).page;
    });
    const k = seiteVon.indexOf(2);
    expect(k).toBeGreaterThan(0);
    expect(seiteVon.slice(0, k).every((p) => p === 1)).toBe(true);
    expect(seiteVon.slice(k).every((p) => p === 2)).toBe(true);
    const nr = agendaLinesForDate(plan, MO).filter((l) => l.number !== null);
    for (const l of nr) {
      const n = norm(l.text.map((r) => r.text).join(''));
      const seite1 = norm(
        info.texts
          .filter((x) => x.page === 1)
          .map((x) => x.text)
          .join(''),
      );
      expect(seite1.includes(n.slice(0, 12))).toBe(true);
    }
    expect(layout.fallbacks).toContainEqual({
      kind: 'continuationPage',
      region: 'agenda',
      weekId: KVK_WOCHE,
      date: MO,
      entryId: (liste[k] as { id: string }).id,
      piece: null,
      dropped: [],
      field: 'agendaLine',
      columnId: null,
    });
    expect(layout.pages[1]?.kind).toBe('continuation');
  });

  it('[R-10-42] 40 Bemerkungen in der Seitenleiste: jede genau einmal, Anfang auf Seite 1, Rest auf Seite 2; Ereignis continuationPage (sidebar, field remark, erste verschobene Bemerkung)', async () => {
    const liste = bemerkungen(40, 'Notiz', 700);
    const plan = mitEintraegen(
      kvk(),
      liste.map((b, i) =>
        multiDayRemark(b.id, 700 + i, { text: b.text, scope: { kind: 'week', weekId: KVK_WOCHE } }),
      ),
    );
    const { info, layout } = await seitePdf('seite-40-bemerkungen-leiste', plan, KVK_WOCHE);
    expect(info.pages.length).toBeGreaterThanOrEqual(2);
    const seiteVon = liste.map((b) => {
      const l = info.texts.filter((x) => x.text.trim() === b.text);
      expect(l.length, `«${b.text}» genau einmal`).toBe(1);
      return (l[0] as PdfTextRun).page;
    });
    const k = seiteVon.findIndex((p) => p > 1);
    expect(k).toBeGreaterThanOrEqual(0);
    expect(seiteVon.slice(0, k).every((p) => p === 1)).toBe(true);
    expect(
      seiteVon.slice(k).every((p, i, a) => p > 1 && (i === 0 || p >= (a[i - 1] as number))),
    ).toBe(true);
    const ereignisse = layout.fallbacks.filter(
      (e) => e.kind === 'continuationPage' && e.region === 'sidebar',
    );
    expect(ereignisse.filter((e) => e.field === 'remark')).toEqual([
      {
        kind: 'continuationPage',
        region: 'sidebar',
        weekId: KVK_WOCHE,
        date: null,
        entryId: (liste[k] as { id: string }).id,
        piece: null,
        dropped: [],
        field: 'remark',
        columnId: null,
      },
    ]);
    // Seitenleiste der Fortsetzungsseite: Überschrift «Bemerkungen» nur zusammen mit Einheiten.
    const p2 = info.texts.filter((x) => x.page === 2);
    expect(p2.some((x) => x.text.trim() === 'Bemerkungen')).toBe(true);
  });

  it('[R-10-42] (V01, V-02e-18) Abbruch: Beso-Freitext, Bemerkung und Bereitschaft mit je 3000 Zeichen → endlich viele Seiten (≤ Einheiten + 1); jede dieser Einheiten endet auf ihrer Seite mit «…» (Ereignis ellipsis)', async () => {
    const wort = 'WWWWWWWWW';
    const lang = `${Array.from({ length: 301 }, () => wort)
      .join(' ')
      .slice(0, 2999)}W`;
    const p = mitWoche(kvk(), KVK_WOCHE, { heightenedReadiness: lang });
    const plan = mitEintraegen(p, [
      beso('e800', 800, {
        date: MO,
        windows: [win('t800', { time: { form: 'point', at: 1260 } })],
        besoNumber: 19,
        agendaOverride: lang,
      }),
      multiDayRemark('e801', 801, { text: lang, scope: { kind: 'week', weekId: KVK_WOCHE } }),
    ]);
    const { info, layout } = await seitePdf('seite-abbruch', plan, KVK_WOCHE);
    expect(lang.length).toBe(3000);
    const w = woche(plan);
    const einheiten =
      sichtbareTage(plan, KVK_WOCHE).reduce(
        (s, d) => s + agendaLinesForDate(plan, d.date).length,
        0,
      ) +
      remarksForWeek(plan, KVK_WOCHE).length +
      w.weekGoals.length +
      abbreviationsForWeek(plan, KVK_WOCHE).length +
      1 +
      plan.legend.filter((c) => c.inLegend && !c.neutral).length;
    expect(info.pages.length).toBeGreaterThanOrEqual(2);
    expect(info.pages.length).toBeLessThanOrEqual(einheiten + 1);
    for (const [field, entryId] of [
      ['agendaLine', 'e800'],
      ['remark', 'e801'],
      ['readiness', null],
    ] as const) {
      expect(layout.fallbacks, `ellipsis ${field}`).toContainEqual(
        expect.objectContaining({ kind: 'ellipsis', field, entryId, piece: null, dropped: [] }),
      );
    }
    const enden = info.texts.filter((t) => t.page > 1 && t.text.trimEnd().endsWith('…'));
    expect(enden.length).toBeGreaterThanOrEqual(3);
  });

  it('[R-10-42] 60 Legendenkategorien: jede Beschriftung genau einmal über alle Seiten; Ereignis continuationPage mit field legendLabel', async () => {
    const p = kvk();
    const extra: LtgCategory[] = Array.from({ length: 60 }, (_, i) => ({
      id: `kx${i}`,
      name: `Kat ${i}`,
      legendLabel: `Kategorie ${String(i + 1).padStart(2, '0')}`,
      color: { r: 30 + i, g: 120, b: 200 },
      neutral: false,
      inLegend: true,
    }));
    const plan: Plan = { ...p, legend: [...p.legend, ...extra] };
    const { info, layout } = await seitePdf('seite-60-kategorien', plan, KVK_WOCHE);
    expect(info.pages.length).toBeGreaterThanOrEqual(2);
    for (const c of [...p.legend.filter((x) => x.inLegend && !x.neutral), ...extra]) {
      expect(info.texts.filter((t) => t.text.trim() === c.legendLabel).length, c.legendLabel).toBe(
        1,
      );
    }
    expect(layout.fallbacks).toContainEqual(
      expect.objectContaining({
        kind: 'continuationPage',
        region: 'sidebar',
        field: 'legendLabel',
        date: null,
      }),
    );
  });

  it('[R-10-42] (H9) synthetischer Plan je Woche: je Terminspalte über alle Seiten genau die Terminzeilen des Tages in Reihenfolge, keine doppelt oder verloren (ohne Erwartung an die Zahl der Ereignisse)', async () => {
    const { plan, wochen } = await synthetisch();
    let geprueft = 0;
    for (const w of wochen) {
      const L = seite(plan, w.weekId);
      const b = bereiche(w.info, 1);
      const gekuerzt = new Set(
        L.fallbacks
          .filter(
            (e) => e.region === 'agenda' && (e.kind === 'ellipsis' || e.kind === 'textOmitted'),
          )
          .map((e) => e.date),
      );
      for (const sp of terminSpalten(plan, w.weekId, b)) {
        if (sp.daten.some((d) => gekuerzt.has(d))) continue;
        const soll = norm(
          sp.daten
            .flatMap((d) =>
              agendaLinesForDate(plan, d).map((l) => l.text.map((r) => r.text).join('')),
            )
            .join(''),
        );
        expect(spaltenText(w.info, b, sp.x0, sp.x1), `${w.weekId} ${sp.daten.join('+')}`).toBe(
          soll,
        );
        geprueft++;
      }
    }
    expect(geprueft).toBeGreaterThan(0);
  });
});

/** Terminspalten der Woche (E3, F-10): je sichtbarem Tag, Sa+So zusammengefasst nach agendaWeekend. */
function terminSpalten(plan: Plan, weekId: string, b: ReturnType<typeof bereiche>) {
  const w = woche(plan, weekId);
  const sicht = sichtbareTage(plan, weekId);
  const sa = w.days[5];
  const so = w.days[6];
  const beideSichtbar = sa?.display !== 'hidden' && so?.display !== 'hidden';
  const zusammen =
    beideSichtbar &&
    (w.agendaWeekend === 'combined' ||
      (w.agendaWeekend === 'auto' && sa?.display === 'compact' && so?.display === 'compact'));
  const g = b.tagesgrenzen.map((x) => x.bbox.x);
  const aus: { daten: string[]; x0: number; x1: number }[] = [];
  sicht.forEach((d, i) => {
    if (zusammen && d.index === 6) return;
    const ende = zusammen && d.index === 5 ? i + 2 : i + 1;
    aus.push({
      daten:
        zusammen && d.index === 5 ? [d.date, (sicht[i + 1] as { date: string }).date] : [d.date],
      x0: g[i] as number,
      x1: g[ende] as number,
    });
  });
  return aus;
}

/** Normalisierter Text einer Terminspalte über alle Seiten (unter der «Was»-Linie, in Seiten- und Zeilenfolge). */
function spaltenText(
  info: PdfInfo,
  b: ReturnType<typeof bereiche>,
  x0: number,
  x1: number,
): string {
  const teile: PdfTextRun[] = [];
  for (let p = 1; p <= info.pages.length; p++) {
    let ab = b.wasLinie;
    if (p > 1) {
      const linien = striche(info, p)
        .filter(istWaagrecht)
        .filter((s) => nahe(s.bbox.x, b.X0, 0.5) && nahe(s.bbox.x + s.bbox.w, b.xSa, 0.5))
        .sort((a, c) => a.bbox.y - c.bbox.y);
      const was = linien[1];
      if (was === undefined) continue;
      ab = was.bbox.y;
    }
    teile.push(
      ...laeufe(info, p)
        .filter((t) => {
          const u = umriss(t);
          const m = mitte(u);
          return u.y > ab && m.x > x0 && m.x < x1 && u.x + u.w <= b.xSa + 0.01;
        })
        .sort((a, c) => a.baselineY - c.baselineY || a.x - c.x),
    );
  }
  return norm(teile.map((t) => t.text).join(''));
}

describe('Geometrie der Fortsetzungsseite (R-10-42; C4, V-02e-2)', () => {
  it('[R-10-42][R-10-52] (C4, V-02e-2) Fortsetzungsseite: Rahmen, Kopf-Unterlinie und xS wie die Wochenseite; Tageskopf-Unterlinie und «Was»-Linie bei yK + 0,64 h bzw. yK + (0,64 + 0,47) h über X0 … xS − a; Tagesgrenzen an denselben x von yK bis yU (Sa/So nur in der Tageskopfzeile); Seitenleistenlinie von yK bis yU (B-Kp-119); kein Raster, keine Termine-Oberlinie; «Termine» senkrecht in der linken Achse in [yK, yU] zentriert', async () => {
    const viele = bemerkungen(40, 'Bemerkung', 600).map((b, i) =>
      dayRemark(b.id, 600 + i, { date: MO, text: b.text }),
    );
    const plan = mitEintraegen(kvk(), viele);
    const { info } = await seitePdf('seite-fortsetzung-geometrie', plan, KVK_WOCHE);
    expect(info.pages.length).toBe(2);
    const an = analysiere(info, plan, KVK_WOCHE);
    const b = an.b;
    const h = an.bandHoehe;
    const [tagKopf] = bkpZahlen('B-Kp-09', 'sollwert', new RegExp(`^(${ZAHL}) × h$`));
    const [wasZeile] = bkpZahlen('B-Kp-87', 'soll', new RegExp(`Kopfzeile (${ZAHL}) h`));
    const st2 = striche(info, 2);
    const rahmen2 = st2
      .filter((x) => x.kind === 'rect' && x.widthPt > 0)
      .reduce((m, x) => (x.bbox.w * x.bbox.h > m.bbox.w * m.bbox.h ? x : m));
    for (const k of ['x', 'y', 'w', 'h'] as const)
      expect(nahe(rahmen2.bbox[k], b.rahmen[k], 0.01)).toBe(true);
    const waag = st2
      .filter(istWaagrecht)
      .filter((x) => x.bbox.x < b.xS - 0.5 && x.bbox.y > b.yK - 0.5);
    const ys = waag.map((x) => x.bbox.y).sort((p, q) => p - q);
    const yTk = b.yK + (tagKopf as number) * h;
    const yW = b.yK + ((tagKopf as number) + (wasZeile as number)) * h;
    expect(ys.length).toBe(3);
    expect(nahe(ys[0] as number, b.yK, 0.01)).toBe(true);
    expect(nahe(ys[1] as number, yTk, 0.01)).toBe(true);
    expect(nahe(ys[2] as number, yW, 0.01)).toBe(true);
    for (const x of waag.filter((l) => l.bbox.y > b.yK + 0.5)) {
      expect(nahe(x.bbox.x, b.X0, 0.01) && nahe(x.bbox.x + x.bbox.w, b.xSa, 0.01)).toBe(true);
    }
    expect(
      waag.filter((l) => passtStil(l, an.stile.stunde) || passtStil(l, an.stile.halbstunde)),
    ).toEqual([]);
    const senk = st2.filter(istSenkrecht);
    const leiste = senk.filter((x) => nahe(x.bbox.x, b.xS, 0.01));
    expect(leiste.length).toBe(1);
    // Vertrag E1-02k §2.3 S7 (B-Kp-119): Seitenleistenlinie ab der Kopf-Unterlinie, Stand-Feld links offen.
    expect(nahe((leiste[0] as { bbox: { y: number } }).bbox.y, b.yK, 0.01)).toBe(true);
    expect(
      nahe(
        (leiste[0] as { bbox: { y: number; h: number } }).bbox.y +
          (leiste[0] as { bbox: { h: number } }).bbox.h,
        b.yU,
        0.01,
      ),
    ).toBe(true);
    const grenzen = senk.filter((x) => x.bbox.x < b.xS - 0.5).sort((p, q) => p.bbox.x - q.bbox.x);
    expect(grenzen.map((x) => Math.round(x.bbox.x * 100))).toEqual(
      b.tagesgrenzen.map((x) => Math.round(x.bbox.x * 100)),
    );
    grenzen.forEach((x, i) => {
      expect(nahe(x.bbox.y, b.yK, 0.01)).toBe(true);
      const ende = i === 6 ? yTk : b.yU;
      expect(nahe(x.bbox.y + x.bbox.h, ende, 0.01), `Tagesgrenze ${i + 1}`).toBe(true);
    });
    const termine = laeufe(info, 2).filter((t) => t.text.trim() === 'Termine');
    expect(termine.length).toBe(1);
    const t = termine[0] as PdfTextRun;
    expect(t.rotation).toBe(90);
    const [tol] = bkpZahlen('B-Kp-86', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    const m = mitte(umriss(t));
    expect(nahe(m.x, (b.rahmen.x + b.X0) / 2, tol as number)).toBe(true);
    expect(nahe(m.y, (b.yK + b.yU) / 2, tol as number)).toBe(true);
  });
});

describe('Seitenaufbau (R-10-06; C5)', () => {
  it('[R-10-06] Bereiche aus den PDF-Linien: Kopf über ganzer Rahmenbreite, Raster links mit Zeitachsen, Seitenleiste rechts bis zum Rahmen unten, Termine unter dem Raster; Masse nach B-Kp-08, -12, -13, -14, -15, -16', async () => {
    const { info } = await kvkPdf();
    const an = analysiere(info, kvk(), KVK_WOCHE);
    const b = an.b;
    const h = an.bandHoehe;
    expect(b.yK).toBeLessThan(b.yFrom);
    expect(b.yTo).toBeLessThan(b.yT);
    expect(b.xSa).toBeLessThan(b.xS);
    expect(nahe(b.seitenleistenLinie.bbox.y + b.seitenleistenLinie.bbox.h, b.yTo, 0.5)).toBe(true);
    const verh = (id: string) =>
      bkpZahlen(id, 'sollwert', new RegExp(`^(${ZAHL}) × h`))[0] as number;
    const tolH = (id: string) =>
      bkpZahlen(id, 'toleranz', new RegExp(`^±(${ZAHL}) h`))[0] as number;
    expect(nahe((b.yK - b.rahmen.y) / h, verh('B-Kp-08'), tolH('B-Kp-08'))).toBe(true);
    expect(nahe((b.yTo - b.yFrom) / h, verh('B-Kp-12'), tolH('B-Kp-12'))).toBe(true);
    expect(nahe((b.yT - b.yTo) / h, verh('B-Kp-13'), tolH('B-Kp-13'))).toBe(true);
    expect(nahe((b.yU - b.yT) / h, verh('B-Kp-14'), tolH('B-Kp-14'))).toBe(true);
    const [a0, a1] = bkpZahlen('B-Kp-15', 'toleranz', new RegExp(`^(${ZAHL})–(${ZAHL}) %`));
    const [s0, s1] = bkpZahlen('B-Kp-16', 'toleranz', new RegExp(`^(${ZAHL})–(${ZAHL}) %`));
    const WR = b.rahmen.w;
    for (const achse of [b.a, b.xS - b.xSa]) {
      expect(achse / WR).toBeGreaterThanOrEqual((a0 as number) / 100);
      expect(achse / WR).toBeLessThanOrEqual((a1 as number) / 100);
    }
    expect((b.rechts - b.xS) / WR).toBeGreaterThanOrEqual((s0 as number) / 100);
    expect((b.rechts - b.xS) / WR).toBeLessThanOrEqual((s1 as number) / 100);
  });
});

describe('Schriftgrössen (R-10-37, R-10-38)', () => {
  // Q-032 (HALT): Der Pflichtfall «KVK: fallbacks leer in allen Regionen einschliesslich block und band» wird
  // nach dem Entscheid des Auftraggebers als eigener Test in diesem describe ergänzt (siehe Bericht des
  // test-engineer). Die folgenden Erwartungen hängen nicht davon ab.
  it('[R-10-37] KVK: Grössen je Textart nach E6 (Kopf, Achsen, Köpfe, Termine, Seitenleiste nach Vorlage und B-Kp-108); Eintragstexte in Standardgrösse oder in 0,25-pt-Stufen ≥ 4,5', async () => {
    const { info } = await kvkPdf();
    const plan = kvk();
    const an = analysiere(info, plan, KVK_WOCHE);
    const b = an.b;
    const S = kpTemplate().fontSizes.standard;
    const T = kpTemplate().fontSizes.blockTitle;
    const g = bkpZahlen('B-Kp-108', 'sollwert', MUSTER_108);
    const stufe = (ist: number, std: number) => {
      const k = (std - ist) / 0.25;
      return (
        ist >= kpTemplate().fontSizes.min - 1e-9 &&
        ist <= std + 1e-9 &&
        Math.abs(k - Math.round(k)) < 1e-6
      );
    };
    const fest: [string, number][] = [
      ['Inf Ustü Kp 61/4 Arbeitsplan KVK', g[0] as number],
      ['Beilage 01-02 zum Allgemeinen Befehl für den FDT 2026', g[1] as number],
      ['Woche vom 28.09.2026 bis 04.10.2026 KW 40', g[2] as number],
      ['Hptm Max Muster C', g[3] as number],
      ['Kommandant', g[3] as number],
      ['TRAGEN & SCHLAGEN', g[4] as number],
      ['0735', g[5] as number],
      ['1645', g[5] as number],
      ['SCHWEIZER ARMEE', S],
      ['Stand', S],
      ['17.09.2026', S],
      ['Zeit', S],
      ['Termine', S],
      ['Wochenziele', S],
      ['Bemerkungen', S],
      ['Legende', S],
      ['Nr', S],
    ];
    for (const [text, soll] of fest) {
      const l = laeufe(info).filter((t) => t.text.trim() === text);
      expect(l.length, `«${text}»`).toBeGreaterThan(0);
      for (const t of l) expect(nahe(t.sizePt, soll, 0.01), `Grösse «${text}»`).toBe(true);
    }
    // Stundenbeschriftung, «Was» und Legendenbeschriftungen in Standardgrösse.
    for (const t of laeufe(info).filter(
      (x) =>
        /^\d{4}$/.test(x.text.trim()) &&
        (umriss(x).x + umriss(x).w <= b.X0 || umriss(x).x >= b.xSa) &&
        umriss(x).y < b.yTo,
    )) {
      expect(nahe(t.sizePt, S, 0.01)).toBe(true);
    }
    for (const c of plan.legend.filter((x) => x.inLegend && !x.neutral)) {
      for (const t of laeufe(info).filter((x) => x.text.trim() === c.legendLabel))
        expect(nahe(t.sizePt, S, 0.01)).toBe(true);
    }
    // Eintragstexte: in Standardgrösse oder 0,25-pt-Stufen bis 4,5 (Blockflächen ab 5,5, übrige ab 5).
    const raster = laeufe(info).filter((t) => {
      const m = mitte(umriss(t));
      return m.x > b.X0 && m.x < b.xSa && m.y > b.yFrom && m.y < b.yTo;
    });
    expect(raster.length).toBeGreaterThan(0);
    for (const t of raster) {
      const m = mitte(umriss(t));
      const traeger = an.inhalt.eintraege
        .filter(
          (e) =>
            e.flaeche.order < t.order &&
            m.x >= e.flaeche.rect.x &&
            m.x <= e.flaeche.rect.x + e.flaeche.rect.w &&
            m.y >= e.flaeche.rect.y &&
            m.y <= e.flaeche.rect.y + e.flaeche.rect.h,
        )
        .sort((p, q) => q.flaeche.order - p.flaeche.order)[0];
      expect(traeger, `Fläche zu «${t.text}»`).toBeDefined();
      const std = traeger?.klasse === 'block' ? T : S;
      expect(stufe(t.sizePt, std), `Grösse ${t.sizePt} von «${t.text}»`).toBe(true);
    }
    // Terminzeilen und Seitenleistentexte: Standardgrösse oder 0,25-pt-Stufen bis 4,5.
    for (const t of laeufe(info).filter(
      (x) => umriss(x).y > b.wasLinie && umriss(x).x >= b.X0 && umriss(x).x < b.xSa,
    )) {
      expect(stufe(t.sizePt, S), `Terminzeile «${t.text}»`).toBe(true);
    }
  });

  it('[R-10-37] KVK+: Bereitschaft in der Grösse nach B-Kp-108, Klassifizierung in Standardgrösse', async () => {
    const { info } = await plusPdf();
    const g = bkpZahlen('B-Kp-108', 'sollwert', MUSTER_108);
    const r = laeufe(info).filter((t) => t.text.trim() === 'Zug 1 in Bereitschaft');
    expect(r.length).toBe(1);
    expect(nahe((r[0] as PdfTextRun).sizePt, g[6] as number, 0.01)).toBe(true);
    const k = laeufe(info).filter((t) => t.text.trim() === 'INTERN');
    expect(k.length).toBe(1);
    expect(nahe((k[0] as PdfTextRun).sizePt, kpTemplate().fontSizes.standard, 0.01)).toBe(true);
  });

  it('[R-10-38] KVK, KVK+ und synthetischer Plan: kein Textlauf unter 4,5 pt', async () => {
    expect(minFontSize((await kvkPdf()).info)).toBeGreaterThanOrEqual(mindestgroesse());
    expect(minFontSize((await plusPdf()).info)).toBeGreaterThanOrEqual(mindestgroesse());
    for (const w of (await synthetisch()).wochen)
      expect(minFontSize(w.info)).toBeGreaterThanOrEqual(mindestgroesse());
  });
});

describe('Datumsformat (R-10-44)', () => {
  const MUSTER = /\d{1,2}[./]\d{1,2}[./]\d{2,4}/g;
  const KOMPAKT = /^(Mo|Di|Mi|Do|Fr|Sa|So) \d{2}\.\d{2}\.\d{2}$/;

  function falsche(info: PdfInfo): string[] {
    const aus: string[] = [];
    for (const t of info.texts) {
      for (const m of t.text.matchAll(MUSTER)) {
        const d = m[0];
        if (/^\d{2}\.\d{2}\.\d{4}$/.test(d)) continue;
        if (/^\d{2}\.\d{2}\.\d{2}$/.test(d) && KOMPAKT.test(t.text.trim())) continue;
        aus.push(d);
      }
    }
    return aus;
  }

  it('[R-10-44] KVK und KVK+: jedes Datum im PDF als dd.mm.yyyy, nur in kompakten Tagesköpfen dd.mm.yy; kein «/» in einem Datum', async () => {
    for (const p of [await kvkPdf(), await plusPdf()]) {
      expect(falsche(p.info)).toEqual([]);
      const daten = p.info.texts.flatMap((t) => [...t.text.matchAll(MUSTER)].map((m) => m[0]));
      expect(daten.length).toBeGreaterThan(9);
    }
  });

  it('[R-10-44] die Prüfung erkennt falsche Formen («10/5/2026», «28/09/2026», «5.10.2026»)', async () => {
    const { info } = await kvkPdf();
    const kaputt: PdfInfo = {
      ...info,
      texts: [
        ...info.texts.slice(0, 1),
        ...['10/5/2026', '28/09/2026', 'bis 5.10.2026'].map((text) => ({
          ...(info.texts[0] as PdfTextRun),
          text,
        })),
      ],
    };
    expect(falsche(kaputt)).toEqual(['10/5/2026', '28/09/2026', '5.10.2026']);
  });
});

describe('Blockkanten auf der Zeit (R-14.2-03; H2, H6)', () => {
  it('[R-14.2-03] KVK: Linearität der Stundenlinien nach B-Kp-42 (Residuum, y(0400) und y(2400) auf den Rasterbegrenzungen); Kanten der Eintragsflächen ohne Markerfelder und Achsen der Markerlinien nach B-Kp-43 auf ihrer Zeit', async () => {
    const { info } = await kvkPdf();
    const an = analysiere(info, kvk(), KVK_WOCHE);
    const [res] = bkpZahlen('B-Kp-42', 'toleranz', new RegExp(`^≤ (${ZAHL}) pt$`));
    expect(an.skala.residuum).toBeLessThanOrEqual(res as number);
    expect(nahe(yVon(an.skala, 240), an.b.yFrom, res as number)).toBe(true);
    expect(nahe(yVon(an.skala, 1440), an.b.yTo, res as number)).toBe(true);
    const [tol] = bkpZahlen('B-Kp-43', 'toleranz', new RegExp(`^≤ (${ZAHL}) pt`));
    // Träger einer Beschriftung neben dem Kästchen (E1-02l R2; F-LAYOUT2 Punkt 13 «13: ja»: Ort eines Rapports)
    // liegen im freien Bereich, nicht auf einer Zeit; sie sind keine Kante eines Eintrags.
    const traeger = seite(kvk(), KVK_WOCHE)
      .grid.entries.flatMap((e) => e.pieces)
      .filter((p) => p.kind === 'outsideLabel')
      .map((p) => p.rect);
    const istTraeger = (r: { x: number; y: number; w: number; h: number }) =>
      traeger.some(
        (t) =>
          Math.abs(t.x - r.x) < 0.05 &&
          Math.abs(t.y - r.y) < 0.05 &&
          Math.abs(t.w - r.w) < 0.05 &&
          Math.abs(t.h - r.h) < 0.05,
      );
    const kanten = an.inhalt.eintraege
      .filter((e) => e.klasse !== 'markerFeld' && !istTraeger(e.flaeche.rect))
      .flatMap((e) => [e.flaeche.rect.y, e.flaeche.rect.y + e.flaeche.rect.h]);
    const achsen = an.inhalt.markerLinien.map((m) => m.bbox.y);
    expect(kanten.length).toBeGreaterThan(100);
    expect(achsen.length).toBe(9);
    expect(edgesOffTime([...kanten, ...achsen], an.skala, tol as number)).toEqual([]);
    // Gegenprobe: eine um 0,5 pt verschobene Kante wird erkannt.
    expect(edgesOffTime([(kanten[0] as number) + 0.5], an.skala, tol as number)).toEqual([
      (kanten[0] as number) + 0.5,
    ]);
  });
});

function pruefeSeiten(info: PdfInfo, plan: Plan, weekId: string): string[] {
  const aus: string[] = [];
  for (let p = 1; p <= info.pages.length; p++) {
    const an: SeitenAnalyse | null = p === 1 ? analysiere(info, plan, weekId) : null;
    aus.push(...ueberlappungen(info, an, p).map((v) => `S${p} ${v}`));
  }
  return aus;
}

function textPruefung(info: PdfInfo, plan: Plan, weekId: string): string[] {
  const aus: string[] = [];
  for (let p = 1; p <= info.pages.length; p++) {
    const an: SeitenAnalyse | null = p === 1 ? analysiere(info, plan, weekId) : null;
    aus.push(...textVerstoesse(info, an, p).map((v) => `S${p} ${v}`));
  }
  return aus;
}

describe('Keine Überlappung (R-14.3-01; H7, H9)', () => {
  it('[R-14.3-01] KVK und KVK+: keine zwei Kästchen, keine zwei Blockflächen und keine zwei Textumrisse überlappen (> 0,001 pt)', async () => {
    expect(pruefeSeiten((await kvkPdf()).info, kvk(), KVK_WOCHE)).toEqual([]);
    expect(pruefeSeiten((await plusPdf()).info, kvkPlus(), KVK_WOCHE)).toEqual([]);
  });

  it('[R-14.3-01] synthetischer Plan (4 Wochen, 1000 Einträge): je Woche und Seite keine Überlappung', async () => {
    const { plan, wochen } = await synthetisch();
    for (const w of wochen) expect(pruefeSeiten(w.info, plan, w.weekId), w.weekId).toEqual([]);
  });

  it('[R-14.3-01] die Prüfung erkennt überlappende Textumrisse und Kästchen (Gegenprobe)', async () => {
    const { info } = await kvkPdf();
    const t0 = info.texts[0] as PdfTextRun;
    const doppelt: PdfInfo = {
      ...info,
      texts: [...info.texts, { ...t0, x: t0.x + 0.5, order: 99999 }],
    };
    expect(ueberlappungen(doppelt, null, 1).length).toBeGreaterThan(0);
  });
});

describe('Kein abgeschnittener oder verdeckter Text (R-14.3-02; H8, H9, G2)', () => {
  it('[R-14.3-02] KVK und KVK+: (a) Eintragstexte in ihrer Fläche, (b) jeder Text in genau einem Bereich, (c) nichts später Gezeichnetes überdeckt einen Text', async () => {
    expect(textPruefung((await kvkPdf()).info, kvk(), KVK_WOCHE)).toEqual([]);
    expect(textPruefung((await plusPdf()).info, kvkPlus(), KVK_WOCHE)).toEqual([]);
  });

  it('[R-14.3-02] synthetischer Plan: je Woche und Seite keine Verstösse nach H8', async () => {
    const { plan, wochen } = await synthetisch();
    for (const w of wochen) expect(textPruefung(w.info, plan, w.weekId), w.weekId).toEqual([]);
  });

  it('[R-14.3-02] die Prüfung erkennt einen verdeckten und einen ausserhalb liegenden Text (Gegenprobe)', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const t0 = laeufe(info).find((t) => t.text.trim() === 'SCHWEIZER ARMEE') as PdfTextRun;
    const ueber = {
      page: 1,
      kind: 'rect' as const,
      bbox: umriss(t0),
      widthPt: 0,
      dash: null,
      color: { r: 0, g: 0, b: 0 },
      fill: { r: 0, g: 0, b: 0 },
      order: t0.order + 100000,
    };
    const verdeckt: PdfInfo = { ...info, strokes: [...info.strokes, ueber] };
    expect(textVerstoesse(verdeckt, null, 1).some((v) => v.startsWith('(c)'))).toBe(true);
    const draussen: PdfInfo = { ...info, texts: [{ ...t0, x: b.rahmen.x - 30 }] };
    expect(textVerstoesse(draussen, null, 1).some((v) => v.startsWith('(b)'))).toBe(true);
  });

  const zeichenFaelle: [string, string, 'invalidCharacter' | 'missingGlyph', string][] = [
    ['weiches-trennzeichen', `Kontrolle${SHY}ergebnis`, 'invalidCharacter', SHY],
    ['zerlegtes-ae', `A${TREMA}rztliche Kontrolle`, 'invalidCharacter', TREMA],
    ['haekchen', 'Kontrolle ✓', 'missingGlyph', '✓'],
  ];
  for (const [fall, titel, code, zeichen] of zeichenFaelle) {
    it(`[R-14.3-02] (T-2) Lauf mit ${codePunkt(zeichen)}: genau eine Warnung «${code}» mit Zeichen und Code, und writePdf lehnt die Seiten ab`, async () => {
      const b = block('e900', 900, {
        date: MO,
        time: { form: 'range', from: 480, to: 720 },
        columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
        title: rt(titel, true),
      });
      const L = seite(eintagPlan([b]), KVK_WOCHE);
      expect(L.warnings).toEqual([
        expect.objectContaining({
          code,
          character: zeichen,
          codePoint: codePunkt(zeichen),
          entryId: 'e900',
        }),
      ]);
      let fehler: unknown;
      try {
        await writePdf({ pages: L.pages, title: PDF_TITEL });
      } catch (e) {
        fehler = e;
      }
      expect(fehler, fall).toBeInstanceOf(PdfWriteError);
      expect(['invalidItem', 'missingGlyph']).toContain((fehler as PdfWriteError).code);
    });
  }

  it('[R-14.3-02] (T-2) ohne Warnung erzeugt writePdf das PDF (U+00C4 «Ä», Gedankenstrich, Auslassungszeichen)', async () => {
    const b = block('e901', 901, {
      date: MO,
      time: { form: 'range', from: 480, to: 720 },
      columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
      title: rt('Ärztliche Kontrolle – Teil 2 …', true),
    });
    const L = seite(eintagPlan([b]), KVK_WOCHE);
    expect(L.warnings).toEqual([]);
    const { info } = await seitePdf('seite-ohne-warnung', eintagPlan([b]), KVK_WOCHE);
    expect(info.texts.some((t) => t.text.includes('Ärztliche'))).toBe(true);
  });
});

describe('Interne Notizen (R-6-08)', () => {
  it('[R-6-08] Kennwort «GEHEIMWORT» in internalNote (Block, Tag) und removedText: kein Lauf des PDF enthält es', async () => {
    const k = 'GEHEIMWORT';
    const b = block('e910', 910, {
      date: MO,
      time: { form: 'range', from: 480, to: 720 },
      columns: { kind: 'ids', ids: [EINTAG.p1] },
      title: rt('Ausbildung', true),
      internalNote: `intern ${k}`,
      removedText: [k],
    });
    const plan = mitTagen(eintagPlan([b]), KVK_WOCHE, (d, i) =>
      i === 0 ? { internalNote: k } : d,
    );
    const { info, bytes } = await seitePdf('seite-notiz', plan, KVK_WOCHE);
    expect(info.texts.filter((t) => t.text.includes(k))).toEqual([]);
    expect(info.texts.some((t) => t.text.includes('Ausbildung'))).toBe(true);
    expect(new TextDecoder('latin1').decode(bytes).includes(k)).toBe(false);
  });
});

describe('Determinismus des PDF (R-L-01)', () => {
  it('[R-10-06][R-L-01] PDF der KVK-Seite: zweimal und unter TZ=America/New_York derselbe SHA-256', async () => {
    const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
    const a = (await seitePdf('seite-determinismus', kvk(), KVK_WOCHE)).bytes;
    const b2 = await writePdf({ pages: seite(kvk(), KVK_WOCHE).pages, title: PDF_TITEL });
    const vorher = process.env.TZ;
    process.env.TZ = 'America/New_York';
    try {
      const c = await writePdf({ pages: seite(kvk(), KVK_WOCHE).pages, title: PDF_TITEL });
      expect(sha(b2)).toBe(sha(a));
      expect(sha(c)).toBe(sha(a));
    } finally {
      if (vorher === undefined) delete process.env.TZ;
      else process.env.TZ = vorher;
    }
    const gelesen = await readPdf(a);
    expect(gelesen.metadata.Title).toBe(PDF_TITEL);
  });
});
