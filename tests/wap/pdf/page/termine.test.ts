// @vitest-environment jsdom
// Paket E1-02e: Terminbereich im PDF (R-4.4-14, R-4.6-30, R-4.8-01 bis R-4.8-03, R-4.8-07, R-4.9-11, R-4.3-04,
// R-10-38; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» E3, H1, J; F-10, V-02e-13). Nur readPdf; Sollwerte aus
// anhang-b-kp.csv. Pseudonymisierte KVK-Fixture und fiktive Varianten.
import { describe, expect, it } from 'vitest';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import type { Plan } from '../../../../src/model/wap/types';
import { beso, dayRemark, rt, win } from '../../support/model/builders';
import { ZAHL } from '../../support/page/bkp';
import {
  type Bereiche,
  bereiche,
  laeufe,
  mitte,
  nahe,
  norm,
  umriss,
  type Zeile,
  zeilen,
} from '../../support/page/pdf-seite';
import { einmal, seitePdf } from '../../support/page/seite';
import { bkpZahlen, mindestgroesse } from '../../support/page/stile';
import {
  KVK_TAGE,
  KVK_WOCHE,
  kvk,
  leererKvk,
  MO,
  mitEintraegen,
  mitTagen,
  mitWoche,
  SA,
  SO,
} from '../../support/page/varianten';
import { minFontSize } from '../../support/pdf/checks';
import type { PdfInfo, PdfTextRun } from '../../support/pdf/read';

const kvkPdf = einmal(() => seitePdf('termine-kvk', kvk(), KVK_WOCHE));

/** Läufe der Terminzeilen (unter der «Was»-Linie, links der rechten Zeitachse). */
function terminLaeufe(info: PdfInfo, b: Bereiche): PdfTextRun[] {
  return laeufe(info).filter((t) => {
    const u = umriss(t);
    return u.y > b.wasLinie && u.x >= b.X0 - 0.01 && u.x + u.w <= b.xSa + 0.01;
  });
}

/** «Was»-Läufe (zwischen Termine-Oberlinie und «Was»-Linie). */
function wasLaeufe(info: PdfInfo, b: Bereiche): PdfTextRun[] {
  return laeufe(info)
    .filter((t) => t.text.trim() === 'Was')
    .filter((t) => {
      const m = mitte(umriss(t));
      return m.y > b.yT && m.y < b.wasLinie && m.x < b.xSa;
    })
    .sort((p, q) => p.x - q.x);
}

/** Zeilen einer Terminspalte [x0, x1] in y-Reihenfolge. */
function spaltenZeilen(info: PdfInfo, b: Bereiche, x0: number, x1: number): Zeile[] {
  return zeilen(
    terminLaeufe(info, b).filter((t) => mitte(umriss(t)).x > x0 && mitte(umriss(t)).x < x1),
  ).sort((p, q) => p.baselineY - q.baselineY);
}

describe('Terminspalten (R-4.4-14, R-4.8-01, R-4.8-02; F-10, V-02e-13)', () => {
  it('[R-4.4-14] KVK: jeder Terminlauf liegt in genau einer Terminspalte unter ihrem Tag (Sa+So zusammengefasst); Tagesgrenzen durchgehend bis zum Rahmen unten (± 0,1)', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const g = b.tagesgrenzen.map((s) => s.bbox.x);
    expect(g.length).toBe(8);
    const spalten: [number, number][] = [
      ...[0, 1, 2, 3, 4].map((i): [number, number] => [g[i] as number, g[i + 1] as number]),
      [g[5] as number, g[7] as number],
    ];
    const ls = terminLaeufe(info, b);
    expect(ls.length).toBeGreaterThan(0);
    for (const t of ls) {
      const u = umriss(t);
      const n = spalten.filter(([x0, x1]) => u.x >= x0 - 0.1 && u.x + u.w <= x1 + 0.1).length;
      expect(n, `Lauf «${t.text}» in einer Terminspalte`).toBe(1);
    }
    b.tagesgrenzen.forEach((s, i) => {
      if (i === 6) expect(nahe(s.bbox.y + s.bbox.h, b.yTo, 0.1)).toBe(true);
      else expect(nahe(s.bbox.y + s.bbox.h, b.yU, 0.1)).toBe(true);
    });
    // Die Zeilen eines Tages stehen in seiner Spalte (So: in der zusammengefassten Spalte).
    const so = spaltenZeilen(info, b, g[5] as number, g[7] as number);
    expect(so.length).toBeGreaterThan(0);
  });

  it('[R-4.8-01] KVK: 6 Läufe «Was» fett (5 volle Tage, Sa+So zusammengefasst), x = Tag links + 1,1 nach B-Kp-87', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const was = wasLaeufe(info, b);
    expect(was.length).toBe(6);
    const [dx] = bkpZahlen('B-Kp-87', 'sollwert', new RegExp(`^x = Tag links \\+ (${ZAHL})$`));
    const [tol] = bkpZahlen('B-Kp-87', 'toleranz', new RegExp(`^±(${ZAHL}) pt`));
    const links = [0, 1, 2, 3, 4, 5].map(
      (i) => (b.tagesgrenzen[i] as { bbox: { x: number } }).bbox.x,
    );
    was.forEach((t, i) => {
      expect(t.bold).toBe(true);
      expect(nahe(t.x, (links[i] as number) + (dx as number), tol as number)).toBe(true);
    });
  });

  it('[R-4.8-02] (V-02e-13) combined → eine Spalte, separate → zwei, auto mit beiden kompakt → eine, auto mit Sa voll → zwei; zusammengefasst: Sa-Zeilen vor So-Zeilen', async () => {
    const basis = mitEintraegen(leererKvk(), [
      dayRemark('e101', 101, { date: SO, text: 'Hinweis So' }),
      dayRemark('e100', 100, { date: SA, text: 'Hinweis Sa' }),
    ]);
    const faelle: [string, Plan, number][] = [
      ['termine-we-combined', mitWoche(basis, KVK_WOCHE, { agendaWeekend: 'combined' }), 6],
      ['termine-we-separate', mitWoche(basis, KVK_WOCHE, { agendaWeekend: 'separate' }), 7],
      ['termine-we-auto-kompakt', mitWoche(basis, KVK_WOCHE, { agendaWeekend: 'auto' }), 6],
      [
        'termine-we-auto-sa-voll',
        mitTagen(mitWoche(basis, KVK_WOCHE, { agendaWeekend: 'auto' }), KVK_WOCHE, (d, i) =>
          i === 5 ? { display: 'full' } : d,
        ),
        7,
      ],
    ];
    for (const [fall, plan, n] of faelle) {
      const { info } = await seitePdf(fall, plan, KVK_WOCHE);
      const b = bereiche(info);
      expect(wasLaeufe(info, b).length, fall).toBe(n);
      const saSo = b.tagesgrenzen[6];
      expect(saSo).toBeDefined();
      const bis = (saSo?.bbox.y ?? 0) + (saSo?.bbox.h ?? 0);
      expect(nahe(bis, n === 6 ? b.yTo : b.yU, 0.1), `${fall}: Grenze Sa/So`).toBe(true);
      const sa = laeufe(info).find((t) => t.text.includes('Hinweis Sa'));
      const so = laeufe(info).find((t) => t.text.includes('Hinweis So'));
      expect(sa && so).toBeTruthy();
      if (n === 6) {
        expect((sa as PdfTextRun).baselineY).toBeLessThan((so as PdfTextRun).baselineY);
        expect(nahe((sa as PdfTextRun).x, (so as PdfTextRun).x, 0.01)).toBe(true);
      } else {
        expect((so as PdfTextRun).x).toBeGreaterThanOrEqual((saSo?.bbox.x ?? 0) - 0.01);
        expect((sa as PdfTextRun).x + (sa as PdfTextRun).width).toBeLessThanOrEqual(
          (saSo?.bbox.x ?? 0) + 0.01,
        );
      }
    }
  });

  it('[R-4.3-04] Sa ausgeblendet: keine Terminspalte und kein «Was» für Sa; So getrennt mit eigenem «Was» unter So', async () => {
    const plan = mitTagen(kvk(), KVK_WOCHE, (d, i) => (i === 5 ? { display: 'hidden' } : d));
    const { info } = await seitePdf('termine-sa-ausgeblendet', plan, KVK_WOCHE);
    const b = bereiche(info);
    expect(b.tagesgrenzen.length).toBe(7);
    const was = wasLaeufe(info, b);
    expect(was.length).toBe(6);
    const soLinks = (b.tagesgrenzen[5] as { bbox: { x: number } }).bbox.x;
    const [dx] = bkpZahlen('B-Kp-87', 'sollwert', new RegExp(`^x = Tag links \\+ (${ZAHL})$`));
    const [tol] = bkpZahlen('B-Kp-87', 'toleranz', new RegExp(`^±(${ZAHL}) pt`));
    expect(nahe((was[5] as PdfTextRun).x, soLinks + (dx as number), tol as number)).toBe(true);
    for (const s of b.tagesgrenzen) expect(nahe(s.bbox.y + s.bbox.h, b.yU, 0.1)).toBe(true);
  });
});

describe('Beschriftung «Termine» (R-4.8-03, R-4.9-11)', () => {
  it('[R-4.8-03][R-4.9-11] «Termine» fett, rotation 90, Mitte = Mitte des Terminbereichs in der linken Zeitachse nach B-Kp-86', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const t = laeufe(info).filter((x) => x.text.trim() === 'Termine');
    expect(t.length).toBe(1);
    const r = t[0] as PdfTextRun;
    expect(r.bold).toBe(true);
    expect(r.rotation).toBe(90);
    const [tol] = bkpZahlen('B-Kp-86', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    const m = mitte(umriss(r));
    expect(nahe(m.x, (b.rahmen.x + b.X0) / 2, tol as number)).toBe(true);
    expect(nahe(m.y, (b.yT + b.yU) / 2, tol as number)).toBe(true);
  });
});

describe('Terminzeilen (R-4.6-30, R-4.8-07)', () => {
  it('[R-4.6-30] KVK-Tagesbemerkung (Fr): Text in der Terminspalte ihres Tages, ohne vorangestellte Nummer, kein Kästchen mit diesem Text im Raster', async () => {
    const { info } = await kvkPdf();
    const plan = kvk();
    const b = bereiche(info);
    const bem = plan.entries.e162;
    expect(bem?.type).toBe('dayRemark');
    const text = bem?.type === 'dayRemark' ? bem.text : '';
    expect(bem?.type === 'dayRemark' && bem.date).toBe(KVK_TAGE[4]);
    const g = b.tagesgrenzen.map((s) => s.bbox.x);
    const fr = spaltenZeilen(info, b, g[4] as number, g[5] as number);
    const alles = norm(fr.map((z) => z.text).join(''));
    expect(alles).toContain(norm(text));
    const erstesWort = text.trim().split(/\s+/)[0] ?? '';
    const start = fr.find(
      (z) =>
        norm(z.text).startsWith(norm(erstesWort)) &&
        norm(text).startsWith(norm(z.text).slice(0, 10)),
    );
    expect(start, 'erste Zeile der Bemerkung').toBeDefined();
    expect((start as Zeile).text.trim().startsWith(erstesWort)).toBe(true);
    const raster = laeufe(info).filter((t) => {
      const m = mitte(umriss(t));
      return m.y > b.yFrom && m.y < b.yTo && m.x > b.X0 && m.x < b.xSa;
    });
    const imRaster = norm(raster.map((t) => t.text).join(''));
    expect(imRaster.includes(norm(text).slice(0, 24))).toBe(false);
  });

  it('[R-4.8-07] Beso mit langem Titel (≥ 2 Zeilen) und einem LF: Folgezeilen bei x + Breite(«24 ») ± 0,3, auch nach dem LF; umbrochene Tagesbemerkung ohne Einzug', async () => {
    const s = beso('e110', 110, {
      date: MO,
      title: rt(
        'Fiktive Besonderheit mit einem sehr langen Titel für die Terminzeile und noch weiteren Wörtern\nZweiter Absatz nach dem Zeilenwechsel mit weiteren Wörtern',
      ),
      windows: [win('t110', { time: { form: 'point', at: 780 } })],
      besoNumber: 24,
    });
    const r = dayRemark('e111', 111, {
      date: MO,
      text: 'Hinweis zur Tagesbemerkung mit genügend vielen Wörtern, damit sie in der Terminspalte sicher umbricht und mehrere Zeilen belegt.',
    });
    const plan = mitEintraegen(leererKvk(), [s, r]);
    const { info } = await seitePdf('termine-einzug', plan, KVK_WOCHE);
    const b = bereiche(info);
    const g = b.tagesgrenzen.map((x) => x.bbox.x);
    const mo = spaltenZeilen(info, b, g[0] as number, g[1] as number);
    const iRem = mo.findIndex((z) => z.text.trim().startsWith('Hinweis zur'));
    expect(iRem).toBeGreaterThan(1);
    const besoZeilen = mo.slice(0, iRem);
    const remZeilen = mo.slice(iRem);
    expect(besoZeilen.length).toBeGreaterThanOrEqual(3);
    expect((besoZeilen[0] as Zeile).text.startsWith('24 ')).toBe(true);
    expect(norm(besoZeilen.map((z) => z.text).join(''))).toContain(norm('Zweiter Absatz'));
    const x0 = (besoZeilen[0] as Zeile).x;
    const s0 = (besoZeilen[0] as Zeile).sizePt;
    const einzug = measureRuns([{ text: '24 ', weight: 'regular' }], s0);
    for (const z of besoZeilen.slice(1))
      expect(nahe(z.x, x0 + einzug, 0.3), `Folgezeile «${z.text}»`).toBe(true);
    expect(remZeilen.length).toBeGreaterThanOrEqual(2);
    for (const z of remZeilen) expect(nahe(z.x, x0, 0.3), `Bemerkungszeile «${z.text}»`).toBe(true);
  });

  it('[R-4.8-07] (E3, V11) Absatztext: CR LF und CR werden zu LF (harter Umbruch): Tagesbemerkung in drei Zeilen ohne Einzug, Beso-Titel mit CR LF in zwei Zeilen mit Einzug; kein CR im PDF', async () => {
    const CR = String.fromCharCode(13);
    const LF = String.fromCharCode(10);
    const s = beso('e120', 120, {
      date: MO,
      title: rt(`Kurzer Titel${CR}${LF}Zweiter Teil`),
      windows: [win('t120', { time: { form: 'point', at: 780 } })],
      besoNumber: 7,
    });
    const r = dayRemark('e121', 121, {
      date: MO,
      text: `Erste Zeile${CR}${LF}Zweite Zeile${CR}Dritte Zeile`,
    });
    const plan = mitEintraegen(leererKvk(), [s, r]);
    const { info } = await seitePdf('termine-cr', plan, KVK_WOCHE);
    const b = bereiche(info);
    const g = b.tagesgrenzen.map((x) => x.bbox.x);
    const mo = spaltenZeilen(info, b, g[0] as number, g[1] as number);
    expect(mo.map((z) => z.text.trim())).toEqual([
      '7 1300: Kurzer Titel',
      'Zweiter Teil.',
      'Erste Zeile',
      'Zweite Zeile',
      'Dritte Zeile',
    ]);
    const x0 = (mo[0] as Zeile).x;
    const einzug = measureRuns([{ text: '7 ', weight: 'regular' }], (mo[0] as Zeile).sizePt);
    expect(nahe((mo[1] as Zeile).x, x0 + einzug, 0.3), 'Folgezeile nach CR LF mit Einzug').toBe(
      true,
    );
    for (const z of mo.slice(2))
      expect(nahe(z.x, x0, 0.3), `Bemerkungszeile «${z.text}»`).toBe(true);
    mo.forEach((z, i) => {
      if (i > 0) expect(z.baselineY).toBeGreaterThan((mo[i - 1] as Zeile).baselineY);
    });
    expect(laeufe(info).filter((t) => t.text.includes(CR))).toEqual([]);
  });
});

describe('Mindestgrösse (R-10-38)', () => {
  it('[R-10-38] KVK: kein Textlauf unter 4,5 pt', async () => {
    expect(minFontSize((await kvkPdf()).info)).toBeGreaterThanOrEqual(mindestgroesse());
  });
});
