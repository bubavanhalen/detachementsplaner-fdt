// @vitest-environment jsdom
// Paket E1-02e: Rasterlinien, Zeitachsen, Tages- und Spaltenköpfe im PDF (R-4.3-04, R-4.4-02, R-4.4-08, R-4.5-03
// bis R-4.5-06, R-10-13 bis R-10-15, R-10-38; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» E2, H2, J; F-42,
// V-02e-16, V05). Nur das gelesene PDF; Sollwerte aus anhang-b-kp.csv. Pseudonymisierte KVK-Fixture und fiktive
// Varianten.
import { describe, expect, it } from 'vitest';
import { GRID_CONSTANTS } from '../../../../src/model/wap/layout/grid';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { ColumnSet, Plan } from '../../../../src/model/wap/types';
import { col } from '../../support/model/builders';
import { analysiere } from '../../support/page/analyse';
import { ZAHL } from '../../support/page/bkp';
import {
  type Bereiche,
  bereiche,
  istWaagrecht,
  laeufe,
  mitte,
  nahe,
  passtStil,
  striche,
  type TagPdf,
  tageAusPdf,
  umriss,
  yVon,
} from '../../support/page/pdf-seite';
import { einmal, seitePdf } from '../../support/page/seite';
import { bkpZahlen, MUSTER_28, mindestgroesse } from '../../support/page/stile';
import { KVK_TAGE, KVK_WOCHE, kvk, mitTagen, WOCHENTAG_LANG } from '../../support/page/varianten';
import { minFontSize } from '../../support/pdf/checks';
import type { PdfInfo, PdfStroke, PdfTextRun } from '../../support/pdf/read';

const kvkPdf = einmal(() => seitePdf('raster-kvk', kvk(), KVK_WOCHE));
const PLAN_0215 = (): Plan => ({ ...kvk(), displayRange: { from: 135, to: 1415 } });
const pdf0215 = einmal(() => seitePdf('raster-0215-2335', PLAN_0215(), KVK_WOCHE));

/** Innenabstand der Textfläche (E1-02d V-02d-9; E2, S3-23 (d)). */
const INSET = GRID_CONSTANTS.textInsetPt;

/** Text einer Militärzeit «hhmm». */
function mil(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, '0')}${String(t % 60).padStart(2, '0')}`;
}

/** Läufe, deren Umriss im Streifen x ∈ [x0, x1] und y ∈ [y0, y1] liegt. */
function laeufeImStreifen(
  info: PdfInfo,
  x0: number,
  x1: number,
  y0: number,
  y1: number,
): PdfTextRun[] {
  return laeufe(info).filter((t) => {
    const u = umriss(t);
    return u.x >= x0 - 0.01 && u.x + u.w <= x1 + 0.01 && u.y >= y0 - 0.01 && u.y + u.h <= y1 + 0.01;
  });
}

/** Kopfläufe einer Spalte (zwischen Tageskopf-Unterlinie und y(from), Mitte in der Spalte). */
function kopfLaeufe(info: PdfInfo, b: Bereiche, s: { x: number; w: number }): PdfTextRun[] {
  return laeufe(info).filter((t) => {
    const m = mitte(umriss(t));
    return m.x > s.x && m.x < s.x + s.w && m.y > b.tageskopfUnten && m.y < b.yFrom;
  });
}

function satzMit(id: string, planung: number, weight: 'narrow' | 'normal' | 'wide'): ColumnSet {
  return {
    id,
    name: `Satz ${id}`,
    columns: [
      ...Array.from({ length: planung }, (_, i) =>
        col(`${id}p${i}`, `P${i + 1}`, 'planning', { weight }),
      ),
      col(`${id}r`, 'Rap', 'rap'),
      col(`${id}b`, 'Beso', 'beso'),
    ],
  };
}

/** KVK, deren Montag den Satz `satz` trägt. */
function montagMitSatz(satz: ColumnSet): Plan {
  const p = kvk();
  return mitTagen({ ...p, columnSets: [...p.columnSets, satz], entries: {} }, KVK_WOCHE, (d, i) =>
    i === 0 ? { columnSetId: satz.id } : d,
  );
}

/** Nutzbreite einer Spalte aus den PDF-Grenzen (E2): Breite − 2·0,5 − (linker + rechter Grenzstrich)/2. */
function nutzbreite(s: TagPdf['spalten'][number]): number {
  return s.w - 2 * INSET - (s.linksStrich.widthPt + s.rechtsStrich.widthPt) / 2;
}

describe('Tagesköpfe (R-10-13, R-10-14, R-4.3-04)', () => {
  it('[R-10-13] volle Tage: Wochentag ausgeschrieben und Datum dd.mm.yyyy, beide fett, Lage nach B-Kp-28', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const tage = tageAusPdf(info, b);
    const [xTag, xDatumU] = bkpZahlen('B-Kp-28', 'sollwert', MUSTER_28);
    const [grundlinie] = bkpZahlen(
      'B-Kp-28',
      'soll',
      new RegExp(`Grundlinie (${ZAHL}) der Zeilenhöhe`),
    );
    const [tol] = bkpZahlen('B-Kp-28', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    // Mo/Di mit Nebenspalte: 12 Einheiten (Nebenspalte 2, Entscheid Auftraggeber 19.10.2026 «12: ja», F-LAYOUT2).
    const gewichte = [12, 12, 9, 9, 9];
    for (let i = 0; i < 5; i++) {
      const t = tage[i] as TagPdf;
      const name = laeufeImStreifen(info, t.links, t.rechts, b.yK, b.tageskopfUnten).filter(
        (x) => x.text === WOCHENTAG_LANG[i],
      );
      const [y, m, d] = (KVK_TAGE[i] as string).split('-');
      const datum = laeufeImStreifen(info, t.links, t.rechts, b.yK, b.tageskopfUnten).filter(
        (x) => x.text === `${d}.${m}.${y}`,
      );
      expect(name.length, WOCHENTAG_LANG[i]).toBe(1);
      expect(datum.length, `Datum ${KVK_TAGE[i]}`).toBe(1);
      const n = name[0] as PdfTextRun;
      const dt = datum[0] as PdfTextRun;
      expect(n.bold && dt.bold).toBe(true);
      const u = (t.rechts - t.links) / (gewichte[i] as number);
      expect(nahe(n.x, t.links + (xTag as number), tol as number)).toBe(true);
      expect(nahe(dt.x, t.links + (xDatumU as number) * u, tol as number)).toBe(true);
      const soll = b.yK + (grundlinie as number) * (b.tageskopfUnten - b.yK);
      expect(nahe(n.baselineY, soll, tol as number)).toBe(true);
      expect(nahe(dt.baselineY, n.baselineY, 0.01)).toBe(true);
    }
  });

  it('[R-10-14] kompakte Tage: «Sa 03.10.26» und «So 04.10.26» fett, Mitte = Tagmitte nach B-Kp-29', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const tage = tageAusPdf(info, b);
    const [tol] = bkpZahlen('B-Kp-29', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    for (const [i, text] of [
      [5, 'Sa 03.10.26'],
      [6, 'So 04.10.26'],
    ] as const) {
      const t = tage[i] as TagPdf;
      const l = laeufeImStreifen(info, t.links, t.rechts, b.yK, b.tageskopfUnten).filter(
        (x) => x.text === text,
      );
      expect(l.length, text).toBe(1);
      const r = l[0] as PdfTextRun;
      expect(r.bold).toBe(true);
      expect(nahe(r.x + r.width / 2, (t.links + t.rechts) / 2, tol as number)).toBe(true);
    }
    expect(laeufe(info).filter((x) => x.text === 'Samstag' || x.text === 'Sonntag')).toEqual([]);
  });

  it('[R-4.3-04] Sa ausgeblendet: kein Lauf «Samstag» bzw. «Sa 03.10.26», kein Datum des Sa, 6 Tage; So getrennt mit eigenem Kopf', async () => {
    const plan = mitTagen(kvk(), KVK_WOCHE, (d, i) => (i === 5 ? { display: 'hidden' } : d));
    const { info } = await seitePdf('raster-sa-ausgeblendet', plan, KVK_WOCHE);
    expect(
      info.texts.filter((t) => /Samstag|Sa 03\.10\.26|03\.10\.2026|03\.10\.26/.test(t.text)),
    ).toEqual([]);
    const b = bereiche(info);
    const tage = tageAusPdf(info, b);
    expect(tage.length).toBe(6);
    const so = tage[5] as TagPdf;
    const kopf = laeufeImStreifen(info, so.links, so.rechts, b.yK, b.tageskopfUnten);
    expect(kopf.map((t) => t.text)).toContain('So 04.10.26');
  });
});

describe('Spaltenköpfe (R-4.4-02, R-4.4-08; V-02e-16, F-42)', () => {
  function senkrechtPlan(): Plan {
    const p = kvk();
    return {
      ...p,
      columnSets: p.columnSets.map((s) =>
        s.id === 's16'
          ? {
              ...s,
              columns: s.columns.map((c) =>
                c.id === 'c17' || c.id === 'c20'
                  ? { ...c, labelOrientation: 'vertical' as const }
                  : c,
              ),
            }
          : s,
      ),
    };
  }

  it('[R-4.4-02] Spalte senkrecht: Kopflauf rotation 90, in der Spalte zentriert (± 0,5), Grundlinienbeginn = Kopf-Unterkante − 0,5 (± 0,01)', async () => {
    const { info } = await seitePdf('raster-kopf-senkrecht', senkrechtPlan(), KVK_WOCHE);
    const b = bereiche(info);
    const tage = tageAusPdf(info, b);
    for (const i of [2, 3, 4]) {
      const s = (tage[i] as TagPdf).spalten[0] as TagPdf['spalten'][number];
      const l = kopfLaeufe(info, b, s);
      expect(l.map((t) => t.text)).toEqual(['Kdo']);
      const t = l[0] as PdfTextRun;
      expect(t.rotation).toBe(90);
      expect(nahe(mitte(umriss(t)).x, s.x + s.w / 2, 0.5)).toBe(true);
      expect(nahe(t.baselineY, b.yFrom - INSET, 0.01)).toBe(true);
    }
  });

  it('[R-4.4-02] (V-02e-16, S3-18, S3-20) waagrechte Spalten und Rap-Kopf trotz Einstellung «senkrecht»: rotation 0; KVK: Rap- und Beso-Köpfe waagrecht in der grössten passenden 0,25-pt-Stufe ≥ 4,5 (Mo/Di «Rap» 4,75), sonst senkrecht in 5 pt (Sa/So), fett; alle anderen Kopfläufe rotation 0', async () => {
    const { info } = await seitePdf('raster-kopf-senkrecht', senkrechtPlan(), KVK_WOCHE);
    const b = bereiche(info);
    const tage = tageAusPdf(info, b);
    const mi = tage[2] as TagPdf;
    const rap = kopfLaeufe(info, b, mi.spalten[3] as TagPdf['spalten'][number]);
    expect(rap.map((t) => [t.text, t.rotation])).toEqual([['Rap', 0]]);
    const moe = kopfLaeufe(info, b, mi.spalten[1] as TagPdf['spalten'][number]);
    expect(moe.length).toBeGreaterThan(0);
    expect(moe.every((t) => t.rotation === 0)).toBe(true);
    // KVK nach S3-20 mit S3-23 (d), gerechnet aus den PDF-Grenzen: Zelle von der Strichmitte der Tageskopf-Unterlinie
    // bis zur Strichmitte der Rasterbegrenzung oben; Querabmessung = Zelle − je halbe Strichbreite − 2·textInsetPt.
    const kvkInfo = (await kvkPdf()).info;
    const kb = bereiche(kvkInfo);
    const kopfQuer =
      kb.yFrom -
      kb.tageskopfUnten -
      kb.tageskopfLinie.widthPt / 2 -
      kb.rasterOben.widthPt / 2 -
      2 * INSET;
    const S = 5;
    const stufen: number[] = [];
    for (let g = S; g >= mindestgroesse() - 1e-9; g -= 0.25) stufen.push(g);
    const senkrecht = new Set<PdfTextRun>();
    const senkrechteTage: number[] = [];
    const verkleinert: [number, string, number][] = [];
    tageAusPdf(kvkInfo, kb).forEach((tag, i) => {
      const n = tag.spalten.length;
      for (const s of [tag.spalten[n - 2], tag.spalten[n - 1]] as TagPdf['spalten'][number][]) {
        const l = kopfLaeufe(kvkInfo, kb, s);
        expect(l.length).toBe(1);
        const t = l[0] as PdfTextRun;
        const runs = [{ text: t.text.trim(), weight: 'bold' as const }];
        const sigma = stufen.find(
          (g) => measureRuns(runs, g) <= nutzbreite(s) + 1e-6 && lineHeightPt(g) <= kopfQuer + 1e-6,
        );
        expect(t.bold).toBe(true);
        if (sigma !== undefined) {
          expect(t.rotation, `Kopf «${t.text}» Tag ${i}`).toBe(0);
          expect(nahe(t.sizePt, sigma, 0.01), `Kopf «${t.text}» Tag ${i} in ${sigma} pt`).toBe(
            true,
          );
          if (sigma < S) verkleinert.push([i, t.text.trim(), sigma]);
        } else {
          const hoch =
            measureRuns(runs, S) <= kopfQuer + kb.rasterOben.widthPt / 2 + 1e-6 &&
            lineHeightPt(S) <= nutzbreite(s) + 1e-6;
          expect(hoch, `Kopf «${t.text}» Tag ${i} passt senkrecht`).toBe(true);
          expect(t.rotation, `Kopf «${t.text}» Tag ${i}`).toBe(90);
          expect(nahe(t.sizePt, S, 0.01)).toBe(true);
          expect(nahe(mitte(umriss(t)).x, s.x + s.w / 2, 0.5)).toBe(true);
          expect(nahe(t.baselineY, kb.yFrom - INSET, 0.01)).toBe(true);
          senkrecht.add(t);
          if (s === tag.spalten[n - 2]) senkrechteTage.push(i);
        }
      }
    });
    // S3-20: in der KVK steht «Rap» senkrecht in 5 pt; an Mo/Di ist die Rap-Spalte seit der Nebenspalte mit Gewicht 2
    // (Entscheid Auftraggeber 19.10.2026 «12: ja», F-LAYOUT2) zu schmal für «Rap» waagrecht in 4,5 pt.
    expect(verkleinert).toEqual([]);
    // S3-18/S3-20: in der KVK tragen Mo, Di, Sa und So «Rap» senkrecht.
    expect(senkrechteTage).toEqual([0, 1, 5, 6]);
    expect([...senkrecht].map((t) => t.text.trim())).toEqual(['Rap', 'Rap', 'Rap', 'Rap']);
    // Übrige gedrehte Köpfe nur, wo der Kopf waagrecht auch in Mindestgrösse nicht in seine (seit «12: ja» schmalere)
    // Spalte passt (Entscheid «2 a»): in der KVK «Zfhr» an Mo/Di.
    const uebrige = kvkInfo.texts.filter(
      (t) => mitte(umriss(t)).y < kb.yFrom && t.rotation !== 0 && !senkrecht.has(t),
    );
    expect(uebrige.map((t) => t.text.trim())).toEqual(['Zfhr', 'Zfhr']);
    for (const t of uebrige) {
      const spalte = tageAusPdf(kvkInfo, kb)
        .flatMap((tag) => tag.spalten)
        .find((sp) => mitte(umriss(t)).x > sp.x && mitte(umriss(t)).x < sp.x + sp.w);
      expect(
        measureRuns([{ text: t.text.trim(), weight: 'bold' }], mindestgroesse()),
      ).toBeGreaterThan(nutzbreite(spalte as TagPdf['spalten'][number]));
    }
  });

  it('[R-4.4-08] KVK: Rap-Köpfe «Rap»; Beso-Kopf am vollen Tag «Beso», wenn «Beso» fett in die Nutzbreite passt, sonst «Bes»; kompakte Tage immer «Bes»', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const tage = tageAusPdf(info, b);
    tage.forEach((t, i) => {
      const n = t.spalten.length;
      const rap = kopfLaeufe(info, b, t.spalten[n - 2] as TagPdf['spalten'][number]);
      expect(rap.map((x) => x.text)).toEqual(['Rap']);
      const besoSpalte = t.spalten[n - 1] as TagPdf['spalten'][number];
      const beso = kopfLaeufe(info, b, besoSpalte).map((x) => x.text);
      if (i >= 5) expect(beso).toEqual(['Bes']);
      else {
        const passt = measureRuns([{ text: 'Beso', weight: 'bold' }], 5) <= nutzbreite(besoSpalte);
        expect(beso).toEqual([passt ? 'Beso' : 'Bes']);
      }
    });
    expect(
      kopfLaeufe(info, b, (tage[2] as TagPdf).spalten[4] as TagPdf['spalten'][number]).map(
        (x) => x.text,
      ),
    ).toEqual(['Beso']);
  });

  it('[R-4.4-08] voller Tag mit 8 schmalen Planungsspalten: «Bes» genau dann, wenn «Beso» breiter als die Nutzbreite (aus den PDF-Grenzen)', async () => {
    const { info } = await seitePdf(
      'raster-8-schmal',
      montagMitSatz(satzMit('s8n', 8, 'narrow')),
      KVK_WOCHE,
    );
    const b = bereiche(info);
    const mo = tageAusPdf(info, b)[0] as TagPdf;
    expect(mo.spalten.length).toBe(10);
    const besoSpalte = mo.spalten[9] as TagPdf['spalten'][number];
    const zuBreit = measureRuns([{ text: 'Beso', weight: 'bold' }], 5) > nutzbreite(besoSpalte);
    expect(kopfLaeufe(info, b, besoSpalte).map((x) => x.text)).toEqual([zuBreit ? 'Bes' : 'Beso']);
  });

  it('[R-4.4-08] voller Tag mit 8 normalen Planungsspalten: «Beso» passt nicht, «Bes» passt → Kopf «Bes» an einem vollen Tag', async () => {
    const { info } = await seitePdf(
      'raster-8-normal',
      montagMitSatz(satzMit('s8m', 8, 'normal')),
      KVK_WOCHE,
    );
    const b = bereiche(info);
    const mo = tageAusPdf(info, b)[0] as TagPdf;
    const besoSpalte = mo.spalten[9] as TagPdf['spalten'][number];
    const nutz = nutzbreite(besoSpalte);
    expect(measureRuns([{ text: 'Beso', weight: 'bold' }], 5)).toBeGreaterThan(nutz);
    expect(measureRuns([{ text: 'Bes', weight: 'bold' }], 5)).toBeLessThanOrEqual(nutz);
    expect(kopfLaeufe(info, b, besoSpalte).map((x) => x.text)).toEqual(['Bes']);
  });
});

describe('Zeitachse und Stundenraster (R-4.5-03 bis R-4.5-06; B-Kp-42 bis -47, V05)', () => {
  async function achsenTest(fall: 'kvk' | '0215') {
    const { info } = fall === 'kvk' ? await kvkPdf() : await pdf0215();
    const plan = fall === 'kvk' ? kvk() : PLAN_0215();
    return { info, plan, an: analysiere(info, plan, KVK_WOCHE) };
  }

  it('[R-4.5-03] 0400–2400: je Achse 19 Läufe «0500» … «2300», fett, in der Achse zentriert (± 0,5), Grundlinie − y(Linie) im Bereich nach B-Kp-44', async () => {
    const { info, an } = await achsenTest('kvk');
    const b = an.b;
    const [unten, oben] = bkpZahlen(
      'B-Kp-44',
      'sollwert',
      new RegExp(`^Grundlinie − y\\(Linie\\) ∈ \\[(${ZAHL}); (${ZAHL})\\]$`),
    );
    for (const [x0, x1] of [
      [b.rahmen.x, b.X0],
      [b.xSa, b.xS],
    ] as const) {
      const l = laeufeImStreifen(info, x0, x1, b.yFrom - 2, b.yTo + 2).sort(
        (p, q) => p.baselineY - q.baselineY,
      );
      expect(l.map((t) => t.text)).toEqual(an.skala.stunden.map((s) => mil(s.t)));
      expect(l.length).toBe(19);
      l.forEach((t, k) => {
        expect(t.bold).toBe(true);
        expect(nahe(t.x + t.width / 2, (x0 + x1) / 2, 0.5)).toBe(true);
        const d = t.baselineY - (an.skala.stunden[k] as { y: number }).y;
        expect(d).toBeGreaterThanOrEqual((unten as number) - 1e-9);
        expect(d).toBeLessThanOrEqual((oben as number) + 1e-9);
      });
    }
  });

  it('[R-4.5-03] (V05) Anzeigebereich 0215–2335: je Achse 20 Läufe «0400» … «2300»', async () => {
    const { info, an } = await achsenTest('0215');
    const b = an.b;
    for (const [x0, x1] of [
      [b.rahmen.x, b.X0],
      [b.xSa, b.xS],
    ] as const) {
      const l = laeufeImStreifen(info, x0, x1, b.yFrom - 2, b.yTo + 2).sort(
        (p, q) => p.baselineY - q.baselineY,
      );
      expect(l.map((t) => t.text)).toEqual(Array.from({ length: 20 }, (_, i) => mil(240 + 60 * i)));
    }
  });

  it('[R-4.5-04] 19 Stundenlinien 0500–2300 über alle Tage, gestrichelt in Breite und Muster nach B-Kp-45; Variante 0215–2335: 20 Linien 0400–2300', async () => {
    const kvkA = await achsenTest('kvk');
    expect(kvkA.an.skala.stunden.map((s) => s.t)).toEqual(
      Array.from({ length: 19 }, (_, i) => 300 + 60 * i),
    );
    for (const s of kvkA.an.skala.stunden) {
      expect(passtStil(s.s, kvkA.an.stile.stunde)).toBe(true);
      expect(
        nahe(s.s.bbox.x, kvkA.an.b.X0, 0.01) && nahe(s.s.bbox.x + s.s.bbox.w, kvkA.an.b.xSa, 0.01),
      ).toBe(true);
    }
    const v = await achsenTest('0215');
    expect(v.an.skala.stunden.map((s) => s.t)).toEqual(
      Array.from({ length: 20 }, (_, i) => 240 + 60 * i),
    );
  });

  it('[R-4.5-05] 20 Halbstundenlinien 0430–2330 durchgezogen, Breite nach B-Kp-46 kleiner als die Stundenlinie; Variante 0215–2335: 22 Linien 0230–2330', async () => {
    for (const [fall, n, erste] of [
      ['kvk', 20, 270],
      ['0215', 22, 150],
    ] as const) {
      const { an } = await achsenTest(fall);
      const h = an.skala.halbstunden;
      expect(h.length).toBe(n);
      h.forEach((p, k) => {
        expect(p.t).toBe(erste + 60 * k);
        expect(p.s.dash === null || p.s.dash.length === 0).toBe(true);
        expect(p.s.widthPt).toBeLessThan(an.stile.stunde.breite);
        expect(nahe(p.y, yVon(an.skala, p.t), 0.1)).toBe(true);
      });
    }
  });

  it('[R-4.5-06] keine waagrechte Rasterlinie auf :15/:45; im Zeitbereich genau 19 + 20 (Variante 20 + 22) Linien plus 2 Begrenzungen', async () => {
    for (const [fall, n] of [
      ['kvk', 41],
      ['0215', 44],
    ] as const) {
      const { info, an } = await achsenTest(fall);
      const b = an.b;
      const linien = striche(info)
        .filter(istWaagrecht)
        .filter((s) => !passtStil(s, an.stile.markerLinie))
        .filter((s) => s.bbox.y >= b.yFrom - 0.01 && s.bbox.y <= b.yTo + 0.01)
        .filter((s) => s.bbox.x < b.xSa && s.bbox.x + s.bbox.w > b.X0);
      expect(linien.length).toBe(n);
      const viertel: number[] = [];
      const ende = fall === 'kvk' ? 1440 : 1415;
      for (let t = Math.ceil((an.skala.fromMin + 1) / 15) * 15; t < ende; t += 15) {
        if (t % 60 === 15 || t % 60 === 45) viertel.push(yVon(an.skala, t));
      }
      const aufViertel = linien.filter((s: PdfStroke) =>
        viertel.some((y) => Math.abs(y - s.bbox.y) < 0.25),
      );
      expect(aufViertel).toEqual([]);
    }
  });
});

describe('Tages- und Spaltengrenzen (R-10-15)', () => {
  it('[R-10-15] Tagesgrenzen nach B-Kp-38 kräftiger als Spaltengrenzen nach B-Kp-39; jede Tagesgrenze eine durchgehende Linie von yK bis zum Rahmen unten (Sa/So zusammengefasst bis y(to))', async () => {
    const { info } = await kvkPdf();
    const an = analysiere(info, kvk(), KVK_WOCHE);
    const b = an.b;
    expect(b.tagesgrenzen.length).toBe(8);
    for (const g of b.tagesgrenzen) {
      expect(passtStil(g, an.stile.tagesgrenze)).toBe(true);
      expect(nahe(g.bbox.y, b.yK, 0.01)).toBe(true);
    }
    const bisUnten = b.tagesgrenzen.filter((g) => nahe(g.bbox.y + g.bbox.h, b.yU, 0.01));
    expect(bisUnten.length).toBeGreaterThanOrEqual(7);
    const spaltengrenzen = an.tage.flatMap((t) => t.spalten.slice(1).map((s) => s.linksStrich));
    const fein = spaltengrenzen.filter((s) => passtStil(s, an.stile.spaltengrenze));
    expect(fein.length).toBeGreaterThan(0);
    for (const s of fein) expect(s.widthPt).toBeLessThan(b.tagesgrenzen[0]?.widthPt ?? 0);
    // keine Lücke: an jeder Tageskante genau eine Linie.
    const xs = b.tagesgrenzen.map((g) => Math.round(g.bbox.x * 100));
    expect(new Set(xs).size).toBe(xs.length);
  });
});

describe('Mindestgrösse (R-10-38)', () => {
  it('[R-10-38] KVK und Variante 0215–2335: kein Textlauf unter 4,5 pt', async () => {
    for (const p of [await kvkPdf(), await pdf0215()])
      expect(minFontSize(p.info)).toBeGreaterThanOrEqual(mindestgroesse());
  });
});
