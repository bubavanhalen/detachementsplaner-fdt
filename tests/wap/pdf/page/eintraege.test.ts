// @vitest-environment jsdom
// Paket E1-02e: Einträge im PDF (R-4.6-03, -06, -08, -10, -12, -20, -27, -54, -59, R-4.9-03, R-4.9-05, R-5.1-13,
// R-10-16 bis R-10-20, R-10-38; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» E5, H1, H3, J; Vertrag E1-02d 2d–2f,
// V-02d-13, V-02d-18, V13). Die Layout-Schicht des Rasters ist E1-02d; hier wird ihr Ergebnis im fertigen PDF
// geprüft. Nur readPdf; Sollwerte aus anhang-b-kp.csv. Pseudonymisierte KVK-Fixture und fiktive Varianten.
// Nachtrag E1-02k (Vertrag E1-02k §7 N1, Gate S A3): Rapportrahmen dünn wie der Blockrahmen (R-10-50).
import { describe, expect, it } from 'vitest';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Entry, Id, Plan, Rgb } from '../../../../src/model/wap/types';
import {
  beso,
  block,
  CAT,
  marker,
  querbalken,
  rapport,
  rt,
  week,
  win,
} from '../../support/model/builders';
import { analysiere, datumBei, laeufeIn, type SeitenAnalyse } from '../../support/page/analyse';
import { ZAHL } from '../../support/page/bkp';
import { gezeichneteSpanne } from '../../support/page/orakel';
import {
  type Eintrag,
  type Flaeche,
  gleicheFarbe,
  innerhalb,
  laeufe,
  mitte,
  nahe,
  passtStil,
  schneidet,
  type TagPdf,
  umriss,
  yVon,
} from '../../support/page/pdf-seite';
import { einmal, seitePdf } from '../../support/page/seite';
import { bkpZahlen, mindestgroesse } from '../../support/page/stile';
import {
  EINTAG,
  eintagPlan,
  KVK_WOCHE,
  kvk,
  leererKvk,
  MO,
  mitEintraegen,
} from '../../support/page/varianten';
import { minFontSize } from '../../support/pdf/checks';
import type { PdfInfo, PdfStroke, PdfTextRun, Rect } from '../../support/pdf/read';

const kvkPdf = einmal(() => seitePdf('eintraege-kvk', kvk(), KVK_WOCHE));

function farbe(plan: Plan, k: Id): Rgb {
  const c = plan.legend.find((x) => x.id === k);
  if (c === undefined) throw new Error(`Kategorie ${k} fehlt`);
  return c.color;
}

/** Flächen eines Eintrags über seine (im Testplan eindeutige) Farbe. */
function flaechenMitFarbe(an: SeitenAnalyse, c: Rgb): Eintrag[] {
  return an.inhalt.eintraege.filter((e) => gleicheFarbe(e.flaeche.fill, c));
}

function eineFlaeche(an: SeitenAnalyse, c: Rgb, was: string): Flaeche {
  const f = flaechenMitFarbe(an, c);
  expect(f.length, `genau eine Fläche ${was}`).toBe(1);
  return (f[0] as Eintrag).flaeche;
}

async function seiteAnalyse(
  fall: string,
  plan: Plan,
  weekId = KVK_WOCHE,
): Promise<{ info: PdfInfo; an: SeitenAnalyse }> {
  const { info } = await seitePdf(fall, plan, weekId);
  return { info, an: analysiere(info, plan, weekId) };
}

/** Läufe im Rechteck (Umriss darin) mit getrimmtem Text. */
function texteIn(info: PdfInfo, r: Rect, seite = 1): string[] {
  return laeufeIn(info, r, seite).map((t) => t.text.trim());
}

/** Strich-Attrappe für passtStil (nur Breite und Muster werden gelesen). */
const dummy: PdfStroke = {
  page: 1,
  kind: 'rect' as const,
  bbox: { x: 0, y: 0, w: 0, h: 0 },
  widthPt: 0,
  dash: null as number[] | null,
  color: { r: 0, g: 0, b: 0 },
  fill: null,
  order: 0,
};

const tol43 = () => bkpZahlen('B-Kp-43', 'toleranz', new RegExp(`^≤ (${ZAHL}) pt`))[0] as number;

describe('Blöcke (R-4.6-03, R-10-16 bis R-10-18, R-4.9-03, R-5.1-13)', () => {
  it('[R-4.6-03] Block Mo 0800-1000 über die Spalten 2–3: x = Grenzen der Spalten 2/3 (± 0,1), y nach B-Kp-43', async () => {
    const b = block('e30', 30, {
      date: MO,
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'ids', ids: ['c9', 'c10'] },
      categoryId: CAT.bat,
    });
    const plan = mitEintraegen(leererKvk(), [b]);
    const { an } = await seiteAnalyse('eintraege-block-2-3', plan);
    const f = eineFlaeche(an, farbe(plan, CAT.bat), 'des Blocks');
    const mo = an.tage[0] as TagPdf;
    const s2 = mo.spalten[1] as TagPdf['spalten'][number];
    const s3 = mo.spalten[2] as TagPdf['spalten'][number];
    expect(nahe(f.rect.x, s2.x, 0.1)).toBe(true);
    expect(nahe(f.rect.x + f.rect.w, s3.x + s3.w, 0.1)).toBe(true);
    expect(nahe(f.rect.y, yVon(an.skala, 480), tol43())).toBe(true);
    expect(nahe(f.rect.y + f.rect.h, yVon(an.skala, 600), tol43())).toBe(true);
  });

  it('[R-10-16] KVK: jede Blockfläche deckend in einer Legendenfarbe; je verwendete Kategorie mindestens eine Fläche; Rahmen schwarz nach B-Kp-50; keine Transparenz im PDF', async () => {
    const { info, bytes } = await kvkPdf();
    const plan = kvk();
    const an = analysiere(info, plan, KVK_WOCHE);
    const bloecke = an.inhalt.eintraege.filter((e) => e.klasse === 'block');
    expect(bloecke.length).toBeGreaterThan(0);
    const legende = plan.legend.map((c) => c.color);
    for (const e of bloecke) {
      expect(legende.some((c) => gleicheFarbe(c, e.flaeche.fill))).toBe(true);
      expect(e.flaeche.randFarbe).toEqual({ r: 0, g: 0, b: 0 });
      expect(
        passtStil(
          {
            ...dummy,
            widthPt: e.flaeche.rand ?? 0,
            dash: e.flaeche.randMuster === null ? null : [...e.flaeche.randMuster],
          },
          an.stile.block,
        ),
      ).toBe(true);
    }
    const kategorien = new Set(
      Object.values(plan.entries).flatMap((e) => (e.type === 'block' ? [e.categoryId] : [])),
    );
    for (const k of kategorien) {
      expect(
        bloecke.some((e) => gleicheFarbe(e.flaeche.fill, farbe(plan, k))),
        `Kategorie ${k}`,
      ).toBe(true);
    }
    const roh = new TextDecoder('latin1').decode(bytes);
    const gs = [...roh.matchAll(/\/ExtGState\s*(<<[\s\S]*?>>|\d+\s+\d+\s+R)/g)].map(
      (m) => m[1] ?? '',
    );
    expect(
      gs.every((d) => /^<<\s*>>$/.test(d)),
      'jedes /ExtGState-Dict leer',
    ).toBe(true);
    expect(roh).not.toMatch(/\/SMask\b/);
    expect(roh).not.toMatch(/\/Transparency\b/);
    expect(roh).not.toMatch(/\/(?:ca|CA)\s/);
  });

  it('[R-10-17] Block mit Titel, Zusatz, Ltg und Ort: Titel fett, Zusatz und «Ltg (Ort)» normal, alle Zeilen im Blockrechteck', async () => {
    const b = block('e31', 31, {
      date: MO,
      time: { form: 'range', from: 480, to: 720 },
      columns: { kind: 'ids', ids: [EINTAG.p1] },
      title: rt('Gefechtsausbildung', true),
      supplement: 'mit Funk',
      ltg: 'Lt Muster B',
      ort: 'Kaserne',
      categoryId: CAT.zfhr,
    });
    const plan = eintagPlan([b]);
    const { info, an } = await seiteAnalyse('eintraege-block-felder', plan);
    const f = eineFlaeche(an, farbe(plan, CAT.zfhr), 'des Blocks');
    const innen = laeufeIn(info, f.rect);
    const nach = (t: string) => innen.filter((x) => x.text.trim() === t);
    expect(nach('Gefechtsausbildung').map((x) => x.bold)).toEqual([true]);
    expect(nach('mit Funk').map((x) => x.bold)).toEqual([false]);
    expect(nach('Lt Muster B (Kaserne)').map((x) => x.bold)).toEqual([false]);
    const y = ['Gefechtsausbildung', 'mit Funk', 'Lt Muster B (Kaserne)'].map(
      (t) => (nach(t)[0] as PdfTextRun).baselineY,
    );
    expect(y[0]).toBeLessThan(y[1] as number);
    expect(y[1]).toBeLessThan(y[2] as number);
  });

  it('[R-4.9-03] Ltg «Einh Fw», Ort «Ukft»: eine Zeile «Einh Fw (Ukft)» im Block, ohne Präfix «Ltg»', async () => {
    const b = block('e32', 32, {
      date: MO,
      time: { form: 'range', from: 480, to: 720 },
      columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
      title: rt('Einrichten Ukft', true),
      ltg: 'Einh Fw',
      ort: 'Ukft',
      categoryId: CAT.kp,
    });
    const plan = eintagPlan([b]);
    const { info, an } = await seiteAnalyse('eintraege-ltg-ort', plan);
    const f = flaechenMitFarbe(an, farbe(plan, CAT.kp)).filter((e) => e.klasse === 'block');
    expect(f.length).toBe(1);
    const t = texteIn(info, (f[0] as Eintrag).flaeche.rect);
    expect(t).toContain('Einh Fw (Ukft)');
    expect(t.filter((x) => x.includes('Ltg'))).toEqual([]);
  });

  it('[R-5.1-13] Titel [«AVOR» fett, « Fahne» normal]: zwei Läufe auf einer Zeile, getrimmt «AVOR» fett und «Fahne» normal', async () => {
    const b = block('e33', 33, {
      date: MO,
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
      title: [
        { text: 'AVOR', bold: true },
        { text: ' Fahne', bold: false },
      ],
      categoryId: CAT.extern,
    });
    const plan = eintagPlan([b]);
    const { info, an } = await seiteAnalyse('eintraege-titel-teilfett', plan);
    const f = eineFlaeche(an, farbe(plan, CAT.extern), 'des Blocks');
    const innen = laeufeIn(info, f.rect);
    const avor = innen.filter((x) => x.text.trim() === 'AVOR');
    const fahne = innen.filter((x) => x.text.trim() === 'Fahne');
    expect(avor.map((x) => x.bold)).toEqual([true]);
    expect(fahne.map((x) => x.bold)).toEqual([false]);
    expect(nahe((avor[0] as PdfTextRun).baselineY, (fahne[0] as PdfTextRun).baselineY, 0.01)).toBe(
      true,
    );
    expect((avor[0] as PdfTextRun).x).toBeLessThan((fahne[0] as PdfTextRun).x);
    expect(nahe((avor[0] as PdfTextRun).sizePt, (fahne[0] as PdfTextRun).sizePt, 0.01)).toBe(true);
  });

  it('[R-10-18] Tn «Zfhr», Tenue «B»: ohne Häkchen kein «Tn: Zfhr» und kein «Tenue B»; mit Häkchen beide im Block', async () => {
    for (const [druck, fall] of [
      [false, 'eintraege-tn-ohne'],
      [true, 'eintraege-tn-mit'],
    ] as const) {
      const b = block('e34', 34, {
        date: MO,
        time: { form: 'range', from: 480, to: 720 },
        columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
        title: rt('Schiessen', true),
        tn: 'Zfhr',
        tenue: 'B',
        printTn: druck,
        printTenue: druck,
        categoryId: CAT.s2,
      });
      const plan = eintagPlan([b]);
      const { info, an } = await seiteAnalyse(fall, plan);
      const f = eineFlaeche(an, farbe(plan, CAT.s2), 'des Blocks');
      const alle = laeufe(info).map((t) => t.text.trim());
      const innen = texteIn(info, f.rect);
      if (druck) {
        expect(innen).toContain('Tn: Zfhr');
        expect(innen).toContain('Tenue B');
      } else {
        expect(alle.filter((t) => t.includes('Tn: Zfhr') || t.includes('Tenue B'))).toEqual([]);
        expect(innen).toContain('Schiessen');
      }
    }
  });
});

describe('Rapporte und Beso (R-10-19, R-10-20, R-4.6-20, R-4.6-27, R-4.9-05)', () => {
  it('[R-10-19][R-10-50] KVK: 7 Rapport-Kästchen mit Rahmen nach B-Kp-58 (= Blockrahmen), 24 Beso-Kästchen, keine Fläche mit anderer Rahmenbreite; Variante: Rapport und Block je 0,48 nach B-Kp-58/-50', async () => {
    const { info } = await kvkPdf();
    const an = analysiere(info, kvk(), KVK_WOCHE);
    const zahl = (k: string) => an.inhalt.eintraege.filter((e) => e.klasse === k).length;
    expect(zahl('rapportBox')).toBe(7);
    expect(zahl('besoBox')).toBe(24);
    expect(zahl('unbekannt')).toBe(0);
    // Gate S A3 (Vertrag E1-02k §1): jedes Rapportkästchen (nach Lage) mit Rahmen nach B-Kp-58.
    for (const e of an.inhalt.eintraege.filter((x) => x.klasse === 'rapportBox')) {
      expect(passtStil({ ...dummy, widthPt: e.flaeche.rand ?? 0 }, an.stile.rapport)).toBe(true);
    }
    const r = rapport('e40', 40, {
      date: MO,
      code: 'KR',
      time: { form: 'range', from: 600, to: 660 },
      categoryId: CAT.zfhr,
      display: 'rapColumn',
    });
    const b = block('e41', 41, {
      date: MO,
      time: { form: 'range', from: 600, to: 720 },
      columns: { kind: 'ids', ids: [EINTAG.p1] },
      categoryId: CAT.bat,
    });
    const plan = eintagPlan([r, b]);
    const v = await seiteAnalyse('eintraege-rahmen', plan);
    const box = eineFlaeche(v.an, farbe(plan, CAT.zfhr), 'des Rapports');
    const blk = eineFlaeche(v.an, farbe(plan, CAT.bat), 'des Blocks');
    const [r58, t58] = [
      bkpZahlen('B-Kp-58', 'sollwert', new RegExp(`^(${ZAHL})$`))[0] as number,
      bkpZahlen('B-Kp-58', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`))[0] as number,
    ];
    const [r50, t50] = [
      bkpZahlen('B-Kp-50', 'sollwert', new RegExp(`^(${ZAHL})$`))[0] as number,
      bkpZahlen('B-Kp-50', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`))[0] as number,
    ];
    expect(nahe(box.rand ?? 0, r58, t58)).toBe(true);
    expect(nahe(blk.rand ?? 0, r50, t50)).toBe(true);
    // Gate S A3: Rapportrahmen gleich dem Blockrahmen (Vertrag E1-02k §1, Differenz ≤ 0,01).
    expect(Math.abs((box.rand ?? 0) - (blk.rand ?? Number.POSITIVE_INFINITY))).toBeLessThanOrEqual(
      0.01,
    );
  });

  it('[R-4.6-20] Rapport «KR» mit Ort «Kaserne»: Lauf «KR» fett und Lauf «(Kaserne)» normal im Kästchen', async () => {
    const r = rapport('e42', 42, {
      date: MO,
      code: 'KR',
      ort: 'Kaserne',
      time: { form: 'range', from: 600, to: 660 },
      categoryId: CAT.zfhr,
      display: 'rapColumn',
    });
    const plan = eintagPlan([r]);
    const { info, an } = await seiteAnalyse('eintraege-rapport-ort', plan);
    const box = eineFlaeche(an, farbe(plan, CAT.zfhr), 'des Rapports');
    const innen = laeufeIn(info, box.rect);
    expect(innen.filter((t) => t.text.trim() === 'KR').map((t) => t.bold)).toEqual([true]);
    expect(innen.filter((t) => t.text.trim() === '(Kaserne)').map((t) => t.bold)).toEqual([false]);
  });

  it('[R-10-20] KVK: jedes Beso-Kästchen höchstens bahnbreit (+ 0,01) und in der Farbe seiner Kategorie', async () => {
    const { info } = await kvkPdf();
    const plan = kvk();
    const an = analysiere(info, plan, KVK_WOCHE);
    const boxen = an.inhalt.eintraege.filter((e) => e.klasse === 'besoBox');
    expect(boxen.length).toBe(24);
    for (const e of boxen) {
      const i = an.tage.findIndex(
        (t) => mitte(e.flaeche.rect).x > t.links && mitte(e.flaeche.rect).x < t.rechts,
      );
      const t = an.tage[i] as TagPdf;
      const besoSpalte = t.spalten[t.spalten.length - 1] as TagPdf['spalten'][number];
      expect(e.flaeche.rect.w).toBeLessThanOrEqual(besoSpalte.w / 2 + 0.01);
      expect(
        innerhalb(e.flaeche.rect, {
          x: besoSpalte.x,
          y: an.b.yFrom,
          w: besoSpalte.w,
          h: an.b.yTo - an.b.yFrom,
        }),
      ).toBe(true);
      expect(e.flaeche.fill).toEqual(farbe(plan, CAT.kp));
    }
  });

  it('[R-4.6-27][R-4.9-05] KVK: jedes Beso-Kästchen enthält genau einen Lauf mit seiner Nummer, normal (ohne «-Bold»); je Tag dieselben Nummern wie die Zeitfenster; keine Ausnahme (V08)', async () => {
    const { info } = await kvkPdf();
    const plan = kvk();
    const an = analysiere(info, plan, KVK_WOCHE);
    const tmpl = kpTemplate();
    const proTag = new Map<string, string[]>();
    for (const e of an.inhalt.eintraege.filter((x) => x.klasse === 'besoBox')) {
      const innen = laeufe(info).filter((t) => {
        const m = mitte(umriss(t));
        return (
          m.x > e.flaeche.rect.x &&
          m.x < e.flaeche.rect.x + e.flaeche.rect.w &&
          m.y > e.flaeche.rect.y &&
          m.y < e.flaeche.rect.y + e.flaeche.rect.h
        );
      });
      expect(innen.length, 'genau ein Lauf im Kästchen').toBe(1);
      const t = innen[0] as PdfTextRun;
      expect(t.fontName.endsWith('-Bold')).toBe(false);
      expect(t.bold).toBe(false);
      expect(innerhalb(umriss(t), e.flaeche.rect)).toBe(true);
      const d = datumBei(an, e.flaeche.rect) ?? '';
      proTag.set(d, [...(proTag.get(d) ?? []), t.text.trim()]);
    }
    for (const d of an.daten) {
      const erwartet = Object.values(plan.entries)
        .filter((e): e is Extract<Entry, { type: 'beso' }> => e.type === 'beso' && e.date === d)
        .flatMap((e) =>
          gezeichneteSpanne(e, d, plan, tmpl).map(() =>
            e.besoNumber === null ? '–' : String(e.besoNumber),
          ),
        );
      expect([...(proTag.get(d) ?? [])].sort(), d).toEqual([...erwartet].sort());
    }
  });
});

describe('Querbalken (R-4.6-06, R-4.6-08, R-4.6-10)', () => {
  function zweiQuerbalken(): Plan {
    return mitEintraegen(leererKvk(), [
      querbalken('e50', 50, {
        title: rt('Wachtdienst'),
        fromDate: MO,
        toDate: '2026-09-30',
        columns: { kind: 'all' },
        categoryId: CAT.s2,
      }),
      querbalken('e51', 51, {
        title: rt('Messe'),
        fromDate: MO,
        toDate: MO,
        columns: { kind: 'all' },
        categoryId: CAT.bat,
      }),
    ]);
  }

  it('[R-4.6-06] zwei Querbalken: beide zwischen y(0400) und y(0500), je 0,5 h hoch nach B-Kp-69, untereinander ohne Überlappung', async () => {
    const plan = zweiQuerbalken();
    const { an } = await seiteAnalyse('eintraege-querbalken-zwei', plan);
    const [hoehe] = bkpZahlen('B-Kp-69', 'sollwert', new RegExp(`^Höhe (${ZAHL}) × h$`));
    const [tol] = bkpZahlen('B-Kp-69', 'toleranz', new RegExp(`^±(${ZAHL}) h$`));
    const y0500 = yVon(an.skala, 300);
    const balken = [CAT.s2, CAT.bat].map((k) => eineFlaeche(an, farbe(plan, k), `Querbalken ${k}`));
    for (const f of balken) {
      expect(f.rect.y).toBeGreaterThanOrEqual(an.b.yFrom - 0.01);
      expect(f.rect.y + f.rect.h).toBeLessThanOrEqual(y0500 + 0.01);
      expect(nahe(f.rect.h / an.bandHoehe, hoehe as number, tol as number)).toBe(true);
    }
    expect(schneidet((balken[0] as Flaeche).rect, (balken[1] as Flaeche).rect)).toBe(false);
  });

  it('[R-4.6-08] Text jedes Querbalkens waagrecht zentriert: Textmitte = Balkenmitte ± 0,5 (B-Kp-71)', async () => {
    const plan = zweiQuerbalken();
    const { info, an } = await seiteAnalyse('eintraege-querbalken-zwei', plan);
    const [tol] = bkpZahlen('B-Kp-71', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    for (const [k, titel] of [
      [CAT.s2, 'Wachtdienst'],
      [CAT.bat, 'Messe'],
    ] as const) {
      const f = eineFlaeche(an, farbe(plan, k), titel);
      const t = laeufeIn(info, f.rect).filter((x) => x.text.trim() === titel);
      expect(t.length).toBe(1);
      const r = t[0] as PdfTextRun;
      expect(nahe(r.x + r.width / 2, f.rect.x + f.rect.w / 2, tol as number)).toBe(true);
    }
  });

  it('[R-4.6-10] Querbalken «OLMA 08.10.–18.10.2026» vom 08.10. bis 18.10.2026 im Zwei-Wochen-Plan ab 05.10.2026: Wo 1 über Do–So, Wo 2 über Mo–So, je genau ein Lauf mit vollem Titel im Balken, kein ellipsis/textOmitted', async () => {
    const titel = 'OLMA 08.10.–18.10.2026';
    const p = leererKvk();
    const plan: Plan = mitEintraegen(
      { ...p, weeks: [week('w1', '2026-10-05'), week('w2', '2026-10-12')] },
      [
        querbalken('e60', 60, {
          title: rt(titel),
          fromDate: '2026-10-08',
          toDate: '2026-10-18',
          columns: { kind: 'all' },
          categoryId: CAT.s2,
        }),
      ],
    );
    for (const [w, von] of [
      ['w1', 3],
      ['w2', 0],
    ] as const) {
      const { info, layout } = await seitePdf(`eintraege-olma-${w}`, plan, w);
      const an = analysiere(info, plan, w);
      const f = eineFlaeche(an, farbe(plan, CAT.s2), `OLMA ${w}`);
      const links = an.tage[von] as TagPdf;
      const rechts = an.tage[6] as TagPdf;
      expect(nahe(f.rect.x, links.links, 0.1)).toBe(true);
      expect(nahe(f.rect.x + f.rect.w, rechts.rechts, 0.1)).toBe(true);
      const runs = laeufe(info).filter((t) => t.text === titel);
      expect(runs.length).toBe(1);
      expect(innerhalb(umriss(runs[0] as PdfTextRun), f.rect)).toBe(true);
      expect(
        layout.fallbacks.filter(
          (e) => e.entryId === 'e60' && (e.kind === 'ellipsis' || e.kind === 'textOmitted'),
        ),
      ).toEqual([]);
    }
  });
});

describe('Marker (R-4.6-12; V-02d-13, V-02d-18)', () => {
  it('[R-4.6-12] (V-02d-13, V-02d-18) AV 0700: Linie nach B-Kp-65 mit Achse y(0700) ± 0,1 über die Planungsspalten; Feld mit Rahmen und Füllung nach B-Kp-67, 0,5 pt unter der Linie, Masse nach V-02d-13/-18, Text «AV» darin', async () => {
    const m = marker('e70', 70, { date: MO, at: 420, kind: 'AV', columns: { kind: 'all' } });
    const plan = mitEintraegen(leererKvk(), [m]);
    const { info, an } = await seiteAnalyse('eintraege-marker-av', plan);
    expect(an.inhalt.markerLinien.length).toBe(1);
    const l = an.inhalt.markerLinien[0] as (typeof an.inhalt.markerLinien)[number];
    const Y = yVon(an.skala, 420);
    expect(nahe(l.bbox.y, Y, 0.1)).toBe(true);
    expect(passtStil(l, an.stile.markerLinie)).toBe(true);
    const mo = an.tage[0] as TagPdf;
    const ersteP = mo.spalten[0] as TagPdf['spalten'][number];
    const letzteP = mo.spalten[5] as TagPdf['spalten'][number];
    expect(nahe(l.bbox.x, ersteP.x, 0.1)).toBe(true);
    expect(nahe(l.bbox.x + l.bbox.w, letzteP.x + letzteP.w, 0.1)).toBe(true);
    const felder = an.inhalt.eintraege.filter((e) => e.klasse === 'markerFeld');
    expect(felder.length).toBe(1);
    const f = (felder[0] as Eintrag).flaeche;
    expect(f.fill).toEqual(an.stile.markerFeldFarbe);
    expect(passtStil({ ...dummy, widthPt: f.rand ?? 0 }, an.stile.markerFeld)).toBe(true);
    expect(nahe(f.rect.y, l.bbox.y + 0.5, 0.01)).toBe(true);
    // Mo mit Nebenspalte: 12 Einheiten (Nebenspalte 2, Entscheid Auftraggeber 19.10.2026 «12: ja», F-LAYOUT2).
    const unit = (mo.rechts - mo.links) / 12;
    const lauf = l.bbox.w;
    const breite = Math.min(
      lauf,
      Math.max(2 * unit, measureRuns([{ text: 'AV', weight: 'bold' }], 5) + 2 * 0.5),
    );
    const hoehe = Math.max(
      15 * an.skala.ptPerMinute,
      lineHeightPt(5) + 2 * (0.5 + (f.rand ?? 0) / 2),
    );
    expect(nahe(f.rect.w, breite, 0.01)).toBe(true);
    expect(nahe(f.rect.h, hoehe, 0.01)).toBe(true);
    expect(nahe(f.rect.x + f.rect.w / 2, l.bbox.x + l.bbox.w / 2, 0.01)).toBe(true);
    expect(texteIn(info, f.rect)).toEqual(['AV']);
  });
});

describe('Überdeckung: Beso-Kästchen und Marker über Blöcken (R-4.6-54, R-4.6-59)', () => {
  it('[R-4.6-54] Block 0800-1200 mit Beso «bis 1200» in seiner Spalte: Kästchen nach dem Block gezeichnet (order), [1130, 1200] in der Spalte, kein Blocktext-Umriss schneidet es', async () => {
    const b = block('e80', 80, {
      date: MO,
      time: { form: 'range', from: 480, to: 720 },
      columns: { kind: 'ids', ids: [EINTAG.p1] },
      title: rt('Ausb Gefechtsschiessen', true),
      supplement: 'Zug 1 und 2',
      categoryId: CAT.bat,
    });
    const s = beso('e81', 81, {
      date: MO,
      windows: [win('t81', { time: { form: 'until', to: 720 }, columnId: EINTAG.p1 })],
      categoryId: CAT.extern,
      besoNumber: 13,
    });
    const plan = eintagPlan([b, s]);
    const { info, an } = await seiteAnalyse('eintraege-beso-ueber-block', plan);
    const blk = eineFlaeche(an, farbe(plan, CAT.bat), 'des Blocks');
    const box = eineFlaeche(an, farbe(plan, CAT.extern), 'des Kästchens');
    expect(box.order).toBeGreaterThan(blk.order);
    expect(innerhalb(box.rect, blk.rect)).toBe(true);
    expect(nahe(box.rect.y, yVon(an.skala, 690), 0.1)).toBe(true);
    expect(nahe(box.rect.y + box.rect.h, yVon(an.skala, 720), 0.1)).toBe(true);
    const blockTexte = laeufeIn(info, blk.rect).filter((t) => !innerhalb(umriss(t), box.rect));
    expect(blockTexte.map((t) => t.text.trim())).toContain('Ausb Gefechtsschiessen');
    expect(blockTexte.filter((t) => schneidet(umriss(t), box.rect))).toEqual([]);
    expect(texteIn(info, box.rect)).toEqual(['13']);
  });

  it('[R-4.6-59] Block 0700-0900 und AV 0700 in denselben Spalten: Markerlinie und Feld nach der Blockfläche; Oberkante des ersten Titellaufs ≥ Feldunterkante', async () => {
    const b = block('e82', 82, {
      date: MO,
      time: { form: 'range', from: 420, to: 540 },
      columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
      title: rt('Morgenappell', true),
      categoryId: CAT.bat,
    });
    const m = marker('e83', 83, {
      date: MO,
      at: 420,
      kind: 'AV',
      columns: { kind: 'ids', ids: [EINTAG.p1, EINTAG.p2] },
    });
    const plan = eintagPlan([b, m]);
    const { info, an } = await seiteAnalyse('eintraege-marker-ueber-block', plan);
    const blk = eineFlaeche(an, farbe(plan, CAT.bat), 'des Blocks');
    const feld = an.inhalt.eintraege.filter((e) => e.klasse === 'markerFeld');
    expect(feld.length).toBe(1);
    const f = (feld[0] as Eintrag).flaeche;
    const linie = an.inhalt.markerLinien[0];
    expect(linie).toBeDefined();
    expect(linie?.order ?? 0).toBeGreaterThan(blk.order);
    expect(f.order).toBeGreaterThan(blk.order);
    const titel = laeufeIn(info, blk.rect).filter((t) => t.text.trim() === 'Morgenappell');
    expect(titel.length).toBe(1);
    expect(umriss(titel[0] as PdfTextRun).y).toBeGreaterThanOrEqual(f.rect.y + f.rect.h - 0.01);
  });
});

describe('Mindestgrösse (R-10-38)', () => {
  it('[R-10-38] KVK und alle Varianten dieser Datei: kein Textlauf unter 4,5 pt', async () => {
    const { info } = await kvkPdf();
    expect(minFontSize(info)).toBeGreaterThanOrEqual(mindestgroesse());
    const v = await seitePdf(
      'eintraege-min',
      eintagPlan([
        block('e90', 90, {
          date: MO,
          time: { form: 'range', from: 480, to: 495 },
          columns: { kind: 'ids', ids: [EINTAG.p1] },
        }),
      ]),
      KVK_WOCHE,
    );
    expect(minFontSize(v.info)).toBeGreaterThanOrEqual(mindestgroesse());
  });
});
