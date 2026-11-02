// @vitest-environment jsdom
// Paket E1-02c: PDF-Schreiber – Seiten, Vektoren, Durchstreichung (R-10-01; Vertrag E1-02c §2.3 Nr 1–3, 5,
// §5; Präzisierung P-9; V-02c-2; Änderungsnotiz Vertragsprüfung V04, V11). Handgebaute, fiktive Seitenmodelle;
// geprüft wird nur das fertige PDF: readPdf (E1-01b), Operatorfolge über pdfjs und Rohbytes.
import { describe, expect, it } from 'vitest';
import { STRIKE_EM } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { renderPdfPage } from '../../support/golden/render';
import { readPdf } from '../../support/pdf/read';
import { ereignisse, pfade, texte } from './support/operatoren';
import { nahe, rechteckNahe, zahlenNahe } from './support/pruefen';
import { anzahlName, latin1, mediaBoxes } from './support/roh';
import { pdfMitArtefakt } from './support/schreiben';
import {
  A4_QUER,
  BLAU,
  GRAU,
  GRUEN,
  lauf,
  linie,
  ORANGE,
  pfad,
  ROT,
  rechteck,
  SCHWARZ,
  seite,
  strich,
  text,
  VIOLETT,
  zeile,
} from './support/seiten';

/** Seite mit allen Vektorarten in fester Reihenfolge (fiktive Formen). */
function vektorSeite() {
  return seite([
    rechteck({ x: 50.5, y: 60.25, w: 120.75, h: 40.5 }, ROT, strich(BLAU, 0.75, [3, 1.5])),
    rechteck({ x: 200, y: 60, w: 50, h: 30 }, GRUEN, null),
    rechteck({ x: 300, y: 60, w: 80, h: 20 }, null, strich(SCHWARZ, 0.48)),
    rechteck({ x: 400, y: 60, w: 30, h: 30 }, null, null),
    linie(50, 150, 400.5, 150, strich(GRAU, 0.96, [2, 2])),
    linie(500, 100, 500, 300, strich(ORANGE, 0.5)),
    pfad('M 600 100 L 700 100 L 650 180 Z', VIOLETT, strich(SCHWARZ, 0.72)),
    pfad('M 50 400 C 50 300 250 300 250 400', null, strich(BLAU, 1)),
    rechteck({ x: 800, y: 560, w: 30, h: 20 }, ORANGE, null),
  ]);
}

describe('writePdf: Seiten (Vertrag §2.3 Nr 1)', () => {
  it('[R-10-01] A4 quer: Seitengrösse 841,89 × 595,28 pt ± 0,01, Breite > Höhe, MediaBox exakt, kein /Rotate, keine weiteren Boxen', async () => {
    const bytes = await pdfMitArtefakt('a4-quer', [seite([text(72, 72, 'Übung KVK Woche 1')])]);
    const info = await readPdf(bytes);
    expect(info.pages).toHaveLength(1);
    const p = info.pages[0];
    nahe(p?.widthPt, 841.89, 'Breite');
    nahe(p?.heightPt, 595.28, 'Höhe');
    expect((p?.widthPt ?? 0) > (p?.heightPt ?? 0)).toBe(true);
    expect(mediaBoxes(bytes)).toEqual([[0, 0, 841.89, 595.28]]);
    for (const box of ['Rotate', 'CropBox', 'BleedBox', 'TrimBox', 'ArtBox']) {
      expect(anzahlName(bytes, box), box).toBe(0);
    }
  });

  it('[R-10-01] je PageModel eine Seite in der Reihenfolge von pages, mit eigener Grösse und eigenem Inhalt', async () => {
    const bytes = await pdfMitArtefakt('seitenfolge', [
      seite([text(72, 72, 'Seite eins')]),
      seite([text(50, 60, 'Seite zwei')], { widthPt: 600.5, heightPt: 400.25 }),
      seite([text(72, 72, 'Seite drei')], A4_QUER, 'continuation'),
    ]);
    const info = await readPdf(bytes);
    expect(info.pages).toHaveLength(3);
    nahe(info.pages[1]?.widthPt, 600.5, 'Seite 2 Breite');
    nahe(info.pages[1]?.heightPt, 400.25, 'Seite 2 Höhe');
    nahe(info.pages[2]?.widthPt, 841.89, 'Seite 3 Breite');
    expect(info.texts.map((t) => [t.page, t.text])).toEqual([
      [1, 'Seite eins'],
      [2, 'Seite zwei'],
      [3, 'Seite drei'],
    ]);
    expect(mediaBoxes(bytes)).toEqual([
      [0, 0, 841.89, 595.28],
      [0, 0, 600.5, 400.25],
      [0, 0, 841.89, 595.28],
    ]);
  });

  it('[R-10-01] Umrechnung oben links → PDF: Lage auf einer kleinen Seite (y nach unten)', async () => {
    const bytes = await pdfMitArtefakt('umrechnung', [
      seite(
        [
          rechteck({ x: 10, y: 20, w: 30, h: 40 }, BLAU, null),
          rechteck({ x: 150, y: 80.5, w: 49.5, h: 19.5 }, ROT, null),
        ],
        { widthPt: 200, heightPt: 100 },
      ),
    ]);
    const info = await readPdf(bytes);
    rechteckNahe(info.strokes[0]?.bbox, { x: 10, y: 20, w: 30, h: 40 }, 'oben links');
    rechteckNahe(info.strokes[1]?.bbox, { x: 150, y: 80.5, w: 49.5, h: 19.5 }, 'unten rechts');
  });
});

describe('writePdf: Vektoren (Vertrag §2.3 Nr 2, 3; P-9; V04)', () => {
  it('[R-10-01] Rechteck, Linie und Pfad: Lage, Strichbreite, Strichelung, Farbe und Füllung wie im Modell; nichts für ein Rechteck ohne Fläche und Rahmen', async () => {
    const info = await readPdf(await pdfMitArtefakt('vektoren', [vektorSeite()]));
    const s = info.strokes;
    expect(s).toHaveLength(8);
    expect(s.map((x) => x.kind)).toEqual([
      'rect',
      'rect',
      'rect',
      'line',
      'line',
      'path',
      'path',
      'rect',
    ]);

    rechteckNahe(s[0]?.bbox, { x: 50.5, y: 60.25, w: 120.75, h: 40.5 }, 'Rechteck A');
    nahe(s[0]?.widthPt, 0.75, 'A Strichbreite');
    zahlenNahe(s[0]?.dash, [3, 1.5], 'A Strichelung');
    expect(s[0]?.color).toEqual(BLAU);
    expect(s[0]?.fill).toEqual(ROT);

    rechteckNahe(s[1]?.bbox, { x: 200, y: 60, w: 50, h: 30 }, 'Rechteck B');
    expect(s[1]?.widthPt).toBe(0);
    expect(s[1]?.dash).toBeNull();
    expect(s[1]?.fill).toEqual(GRUEN);
    expect(s[1]?.color).toEqual(GRUEN);

    rechteckNahe(s[2]?.bbox, { x: 300, y: 60, w: 80, h: 20 }, 'Rechteck C');
    nahe(s[2]?.widthPt, 0.48, 'C Strichbreite');
    expect(s[2]?.dash).toBeNull();
    expect(s[2]?.fill).toBeNull();
    expect(s[2]?.color).toEqual(SCHWARZ);

    rechteckNahe(s[3]?.bbox, { x: 50, y: 150, w: 350.5, h: 0 }, 'Linie E');
    nahe(s[3]?.widthPt, 0.96, 'E Strichbreite');
    zahlenNahe(s[3]?.dash, [2, 2], 'E Strichelung');
    expect(s[3]?.color).toEqual(GRAU);
    expect(s[3]?.fill).toBeNull();

    rechteckNahe(s[4]?.bbox, { x: 500, y: 100, w: 0, h: 200 }, 'Linie F');
    nahe(s[4]?.widthPt, 0.5, 'F Strichbreite');
    expect(s[4]?.color).toEqual(ORANGE);

    rechteckNahe(s[5]?.bbox, { x: 600, y: 100, w: 100, h: 80 }, 'Pfad G');
    nahe(s[5]?.widthPt, 0.72, 'G Strichbreite');
    expect(s[5]?.fill).toEqual(VIOLETT);
    expect(s[5]?.color).toEqual(SCHWARZ);

    // Kubische Kurve: Extremwert bei t = 0,5 → y = 325.
    rechteckNahe(s[6]?.bbox, { x: 50, y: 325, w: 200, h: 75 }, 'Pfad H');
    nahe(s[6]?.widthPt, 1, 'H Strichbreite');
    expect(s[6]?.fill).toBeNull();
    expect(s[6]?.color).toEqual(BLAU);

    rechteckNahe(s[7]?.bbox, { x: 800, y: 560, w: 30, h: 20 }, 'Rechteck am Seitenrand');
    expect(s[7]?.fill).toEqual(ORANGE);
  });

  it('[R-10-01] Reihenfolge der Malvorgänge = Reihenfolge von items (spätere liegen oben)', async () => {
    const info = await readPdf(
      await pdfMitArtefakt('reihenfolge', [
        seite([
          rechteck({ x: 100, y: 100, w: 200, h: 200 }, GRUEN, null),
          linie(50, 200, 350, 200, strich(SCHWARZ, 1)),
          rechteck({ x: 150, y: 150, w: 100, h: 100 }, ROT, null),
          pfad('M 120 120 L 280 120 L 200 280 Z', BLAU, null),
        ]),
      ]),
    );
    const sortiert = [...info.strokes].sort((a, b) => a.order - b.order);
    expect(sortiert.map((s) => s.color)).toEqual([GRUEN, SCHWARZ, ROT, BLAU]);
  });

  it('[R-10-01] Fläche und Rahmen eines Rechtecks bzw. Pfads sind ein Malvorgang (Füllen, dann Strich)', async () => {
    const e = pfade(await ereignisse(await pdfMitArtefakt('fuellen-strich', [vektorSeite()])));
    expect(e).toHaveLength(8);
    expect(e.map((p) => [p.flaeche, p.strich])).toEqual([
      [true, true],
      [true, false],
      [false, true],
      [false, true],
      [false, true],
      [true, true],
      [false, true],
      [true, false],
    ]);
  });

  it('[R-10-01] (TR-E102c-02) Füllregel nonzero: jede Füllung mit f bzw. B, nie f* bzw. B*', async () => {
    const e = pfade(await ereignisse(await pdfMitArtefakt('fuellregel-ops', [vektorSeite()])));
    const fuellungen = e.filter((p) => p.flaeche);
    expect(fuellungen).toHaveLength(4);
    for (const p of fuellungen) expect(p.geradeUngerade).toBe(false);
  });

  it('[R-10-01] (TR-E102c-02) Füllregel nonzero gerendert: die Mitte eines sich selbst schneidenden Sterns ist gefüllt', async () => {
    const stern = 'M 200 100 L 259 281 L 105 169 L 295 169 L 141 281 Z';
    const bytes = await pdfMitArtefakt('fuellregel-stern', [
      seite([pfad(stern, BLAU, null)], { widthPt: 400, heightPt: 400 }),
    ]);
    const r = await renderPdfPage(bytes, 1, 300);
    const pixel = (xPt: number, yPt: number) => {
      const i = (Math.round((yPt * 300) / 72) * r.width + Math.round((xPt * 300) / 72)) * 4;
      return Array.from(r.rgba.subarray(i, i + 3));
    };
    // Mitte (innerstes Fünfeck, Umlaufzahl 2) und eine Zacke (Umlaufzahl 1) blau, ausserhalb weiss.
    expect(pixel(200, 200)).toEqual([BLAU.r, BLAU.g, BLAU.b]);
    expect(pixel(200, 130)).toEqual([BLAU.r, BLAU.g, BLAU.b]);
    expect(pixel(120, 120)).toEqual([255, 255, 255]);
  });

  it('[R-10-01] (V04) Rechteck als Pfad ab oben links im Uhrzeigersinn: M x y, L x+w y, L x+w y+h, L x y+h, Z', async () => {
    const e = pfade(await ereignisse(await pdfMitArtefakt('rechteck-umlauf', [vektorSeite()])));
    const a = e[0];
    expect(a?.geschlossen).toBe(true);
    const soll: [number, number][] = [
      [50.5, 60.25],
      [171.25, 60.25],
      [171.25, 100.75],
      [50.5, 100.75],
    ];
    expect(a?.punkte.length).toBeGreaterThanOrEqual(4);
    soll.forEach(([x, y], i) => {
      nahe(a?.punkte[i]?.[0], x, `Ecke ${String(i)} x`);
      nahe(a?.punkte[i]?.[1], y, `Ecke ${String(i)} y`);
    });
    // Ein allfälliger fünfter Punkt schliesst nur zum Anfang zurück.
    if ((a?.punkte.length ?? 0) > 4) {
      expect(a?.punkte).toHaveLength(5);
      nahe(a?.punkte[4]?.[0], 50.5, 'Schluss x');
      nahe(a?.punkte[4]?.[1], 60.25, 'Schluss y');
    }
  });

  it('[R-10-01] (V04) Enden stumpf, Ecken spitz, Gehrungsgrenze 10, ausdrücklich gesetzt; Strichelung mit Phase 0', async () => {
    const e = pfade(await ereignisse(await pdfMitArtefakt('strich-art', [vektorSeite()])));
    const striche = e.filter((p) => p.strich);
    expect(striche).toHaveLength(6);
    for (const [i, p] of striche.entries()) {
      expect(p.cap, `Strich ${String(i)} Ende`).toBe(0);
      expect(p.join, `Strich ${String(i)} Ecke`).toBe(0);
      expect(p.miter, `Strich ${String(i)} Gehrungsgrenze`).toBe(10);
      expect(p.dashPhase, `Strich ${String(i)} Phase`).toBe(0);
    }
  });

  it('[R-10-01] (P-9) keine skalierte CTM: |det| = 1 bei jedem Malvorgang', async () => {
    const seiten = [
      vektorSeite(),
      seite([zeile({ x: 100, baselineY: 100, runs: [lauf('Abgesagt', { strike: true })] })]),
    ];
    const e = pfade(await ereignisse(await pdfMitArtefakt('ctm', seiten)));
    expect(e.length).toBeGreaterThan(8);
    for (const p of e) nahe(p.det, 1, 'det', 1e-9);
  });
});

describe('writePdf: Durchstreichung (Vertrag §2.3 Nr 5, V-02c-2, V11)', () => {
  const c = STRIKE_EM.center;
  const t = STRIKE_EM.thickness;

  it('[R-10-01] (V-02c-2) waagrecht: Linie in Laufbreite im Abstand center × sizePt über der Grundlinie, Dicke thickness × sizePt, Farbe des Laufs, durchgezogen', async () => {
    const runs = [
      lauf('Abgesagt ', { strike: true, color: ROT }),
      lauf('bleibt '),
      lauf('Ende', { weight: 'bold', strike: true, color: BLAU }),
    ];
    const z = zeile({ x: 100.25, baselineY: 300.5, sizePt: 10, runs });
    const info = await readPdf(await pdfMitArtefakt('strike-waagrecht', [seite([z])]));
    const w = runs.map((r) => measureRuns([r], 10));
    expect(info.strokes).toHaveLength(2);
    const [s1, s2] = info.strokes;
    expect(s1?.kind).toBe('line');
    rechteckNahe(s1?.bbox, { x: 100.25, y: 300.5 - c * 10, w: w[0] ?? 0, h: 0 }, 'Strich 1');
    nahe(s1?.widthPt, t * 10, 'Strich 1 Dicke');
    expect(s1?.color).toEqual(ROT);
    expect(s1?.dash).toBeNull();
    expect(s2?.kind).toBe('line');
    rechteckNahe(
      s2?.bbox,
      { x: 100.25 + (w[0] ?? 0) + (w[1] ?? 0), y: 300.5 - c * 10, w: w[2] ?? 0, h: 0 },
      'Strich 2',
    );
    nahe(s2?.widthPt, t * 10, 'Strich 2 Dicke');
    expect(s2?.color).toEqual(BLAU);
  });

  it('[R-10-01] (V-02c-2) gedreht 90 und 270: Strich parallel zur Grundlinie auf der Oberlängenseite', async () => {
    const r90 = lauf('Neunzig', { strike: true, color: GRUEN });
    const r270 = lauf('Zweisiebzig', { strike: true, color: VIOLETT });
    const info = await readPdf(
      await pdfMitArtefakt('strike-gedreht', [
        seite([
          zeile({ x: 200, baselineY: 400, sizePt: 8, rotation: 90, runs: [r90] }),
          zeile({ x: 300, baselineY: 100, sizePt: 6, rotation: 270, runs: [r270] }),
        ]),
      ]),
    );
    const w90 = measureRuns([r90], 8);
    const w270 = measureRuns([r270], 6);
    expect(info.strokes).toHaveLength(2);
    // 90: liest von unten nach oben, Oberlänge links.
    rechteckNahe(
      info.strokes[0]?.bbox,
      { x: 200 - c * 8, y: 400 - w90, w: 0, h: w90 },
      'Strich 90',
    );
    nahe(info.strokes[0]?.widthPt, t * 8, 'Strich 90 Dicke');
    expect(info.strokes[0]?.color).toEqual(GRUEN);
    // 270: liest von oben nach unten, Oberlänge rechts.
    rechteckNahe(info.strokes[1]?.bbox, { x: 300 + c * 6, y: 100, w: 0, h: w270 }, 'Strich 270');
    nahe(info.strokes[1]?.widthPt, t * 6, 'Strich 270 Dicke');
    expect(info.strokes[1]?.color).toEqual(VIOLETT);
  });

  it('[R-10-01] (V-02c-2) gezeichnet unmittelbar nach dem Lauf, vor dem nächsten Lauf', async () => {
    const z = zeile({
      x: 100,
      baselineY: 200,
      runs: [lauf('Eins ', { strike: true }), lauf('Zwei '), lauf('Drei', { strike: true })],
    });
    const e = (await ereignisse(await pdfMitArtefakt('strike-folge', [seite([z])]))).filter(
      (x) => x.art !== 'bild',
    );
    expect(e.map((x) => (x.art === 'text' ? x.text : 'strich'))).toEqual([
      'Eins ',
      'strich',
      'Zwei ',
      'Drei',
      'strich',
    ]);
  });

  it('[R-10-01] (V11) leerer Lauf mit strike: weder Text noch Strich; Lauf nur aus Leerzeichen mit strike: Strich in Laufbreite', async () => {
    const leer = lauf('', { strike: true, color: ROT });
    const leerzeichen = lauf('   ', { strike: true, color: BLAU });
    const info = await readPdf(
      await pdfMitArtefakt('strike-leer', [
        seite([
          zeile({ x: 100, baselineY: 100, runs: [leer] }),
          zeile({ x: 100, baselineY: 200, runs: [lauf('A'), leer, lauf('B')] }),
          zeile({ x: 100, baselineY: 300, runs: [leerzeichen] }),
        ]),
      ]),
    );
    expect(info.strokes).toHaveLength(1);
    expect(info.strokes[0]?.color).toEqual(BLAU);
    rechteckNahe(
      info.strokes[0]?.bbox,
      { x: 100, y: 300 - c * 10, w: measureRuns([leerzeichen], 10), h: 0 },
      'Strich über Leerzeichen',
    );
    expect(info.texts.map((x) => x.text)).toEqual(['A', 'B']);
    nahe(info.texts[1]?.x, 100 + measureRuns([lauf('A')], 10), 'B nach leerem Lauf');
  });

  it('[R-10-01] Text ohne Formen: kein Pfad, kein Bild im PDF (Text nicht als Pfad oder Bild)', async () => {
    const bytes = await pdfMitArtefakt('nur-text', [
      seite([
        text(100, 100, 'Nur Text, keine Formen'),
        text(100, 120, 'Zweite Zeile', { weight: 'bold' }),
      ]),
    ]);
    const info = await readPdf(bytes);
    expect(info.strokes).toEqual([]);
    expect(info.images).toBe(0);
    expect(texte(await ereignisse(bytes)).map((x) => x.text)).toEqual([
      'Nur Text, keine Formen',
      'Zweite Zeile',
    ]);
    expect(latin1(bytes).includes('/Subtype /Image')).toBe(false);
  });
});
