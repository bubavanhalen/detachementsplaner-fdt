// Paket E1-02c: Bildschirm-Zeichner PageView in Edge (R-L-04, Leitplanke 2; Vertrag E1-02c §3.1, §3.2, §5;
// Präzisierungen P-11, P-12, P-13, P-14; V-02c-2, V-02c-4; Änderungsnotiz Vertragsprüfung V04, V05, V08, Runde 2
// V18, V21, V22). Der Browser bricht nie selbst um: jede vorberechnete Zeile ist genau ein Element mit
// white-space: pre an der berechneten Lage (Toleranz x/Breite ± 0,05 pt, Grundlinie ± 0,15 pt bei scale 1 und 2).
// Projekt edge (Gate-0-Entscheid E4 b); Zugriff über Rolle und Name, data-wap-item laut Vertrag.
import { createCanvas } from '@napi-rs/canvas';
import { expect, type Page } from '@playwright/test';
import { sanitizeImageBytes } from '../../../src/io/wap-pdf/imageBytes';
import type { PageModel, TextItem } from '../../../src/model/wap/layout/pageModel';
import { STRIKE_EM } from '../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../src/model/wap/layout/text/measure';
import { exif, pngPalette, verkette } from '../../wap/pdf/writer/support/bilder';
import { ausBase64, zuJson } from '../../wap/pdf/writer/support/seite-json';
import {
  BLAU,
  fett,
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
  VIOLETT,
  zeile,
} from '../../wap/pdf/writer/support/seiten';
import { renderPdfPage } from '../../wap/support/golden/render';
import { pdfArtefakt } from '../../wap/support/pdf/artefakt';
import { test } from '../support/fixtures';
import {
  bildschirmPixel,
  cssFarbe,
  eckfarbe,
  harnessBereit,
  type Konsolenmeldung,
  konsoleMitschneiden,
  messeZeilen,
  nahe,
  rgbBei,
  TOL_GRUNDLINIE,
  TOL_PX,
  TOL_X,
  zeige,
} from './support/messen';

// Keine Konsolenausgabe jeder Art (TR-E102c-06): jede Meldung der Seite wird gezählt, erwartet 0.
let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  expect(konsole).toEqual([]);
});

const LABEL = 'Wochenseite Übung';

/** Fiktive Seite mit Zeilen in mehreren Grössen, Schnitten, Farben, Drehungen und Durchstreichungen. */
function zeilenSeite(): PageModel {
  return seite([
    rechteck({ x: 20, y: 20, w: 801.89, h: 555.28 }, null, strich(SCHWARZ, 0.96)),
    zeile({
      x: 40.37,
      baselineY: 60.81,
      sizePt: 12,
      runs: [fett('SCHWEIZER ARMEE'), lauf(' Übung Kp', { color: BLAU })],
    }),
    zeile({
      x: 100.13,
      baselineY: 120.5,
      sizePt: 5.5,
      runs: [lauf('Ausbildung '), fett('Zugführer', ROT), lauf(' «Wache» 0700-1200')],
    }),
    zeile({ x: 100.5, baselineY: 140.25, sizePt: 4.5, runs: [lauf('Kleinste Schrift äöü ß – ’')] }),
    linie(30, 150, 800, 150, strich(GRAU, 0.48, [2, 1])),
    zeile({
      x: 60.5,
      baselineY: 400.75,
      sizePt: 6,
      rotation: 90,
      runs: [fett('FALCON'), lauf(' Zug 1')],
    }),
    zeile({
      x: 80.25,
      baselineY: 200.5,
      sizePt: 8,
      rotation: 270,
      runs: [lauf('HAWK abgesagt', { strike: true, color: ROT })],
    }),
    zeile({
      x: 300.75,
      baselineY: 300.33,
      sizePt: 10,
      runs: [
        lauf('Abgesagt ', { strike: true, color: ROT }),
        lauf('bleibt '),
        lauf('Ende', { weight: 'bold', strike: true, color: BLAU }),
      ],
    }),
    rechteck({ x: 500, y: 450, w: 100, h: 50 }, GRUEN, null),
  ]);
}

function textItems(p: PageModel): { index: number; item: TextItem }[] {
  return p.items.flatMap((item, index) => (item.kind === 'text' ? [{ index, item }] : []));
}

/** Endpunkt der Grundlinie nach Breite w in Leserichtung. */
function ende(t: TextItem, w: number): { x: number; y: number } {
  if (t.rotation === 90) return { x: t.x, y: t.baselineY - w };
  if (t.rotation === 270) return { x: t.x, y: t.baselineY + w };
  return { x: t.x + w, y: t.baselineY };
}

/** Erwartetes Rechteck der Durchstreichung eines Laufs mit Versatz `off` und Breite `w` (Vertrag §2.3 Nr 5). */
function strichSoll(
  t: TextItem,
  off: number,
  w: number,
): { x: number; y: number; w: number; h: number } {
  const c = STRIKE_EM.center * t.sizePt;
  const d = STRIKE_EM.thickness * t.sizePt;
  if (t.rotation === 90) return { x: t.x - c - d / 2, y: t.baselineY - off - w, w: d, h: w };
  if (t.rotation === 270) return { x: t.x + c - d / 2, y: t.baselineY + off, w: d, h: w };
  return { x: t.x + off, y: t.baselineY - c - d / 2, w, h: d };
}

async function zeigeUndWarte(
  page: Page,
  p: PageModel,
  scale: number,
  label = LABEL,
): Promise<void> {
  await zeige(page, p, { scale, label });
  const c = page.getByRole('document', { name: label });
  await expect(c.locator('span[data-wap-item]')).toHaveCount(textItems(p).length);
  // Neu gezeichnet erst, wenn der Container die Grösse der neuen Zoomstufe hat (sonst misst der Test den alten Stand).
  await expect
    .poll(async () => Math.abs(((await c.boundingBox())?.width ?? 0) - p.widthPt * scale))
    .toBeLessThanOrEqual(TOL_PX);
}

test.describe('PageView: Zeilen (Vertrag §3.2 «Zeile»)', () => {
  test('[R-L-04] je TextItem genau ein span[data-wap-item] mit dem Index in items; textContent = Lauftexte; gleiche Zeilenzahl bei scale 1 und 2', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = zeilenSeite();
    const soll = textItems(p);
    for (const scale of [1, 2]) {
      await zeigeUndWarte(wapPage, p, scale);
      const z = await messeZeilen(wapPage, LABEL, scale);
      expect(
        z.map((x) => x.index),
        `scale ${String(scale)}`,
      ).toEqual(soll.map((s) => String(s.index)));
      expect(z.map((x) => x.text)).toEqual(
        soll.map((s) => s.item.runs.map((r) => r.text).join('')),
      );
      expect(z.map((x) => x.laeufe.map((l) => l.text))).toEqual(
        soll.map((s) => s.item.runs.map((r) => r.text)),
      );
    }
  });

  test('[R-L-04] (V21) berechneter Stil je Zeile: white-space pre, font-kerning none, Schrift «WAP Arimo», keine Ligaturen, keine Synthese, bidi-override, ltr, font-size = sizePt × 4 px', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = zeilenSeite();
    await zeigeUndWarte(wapPage, p, 1);
    const z = await messeZeilen(wapPage, LABEL, 1);
    const soll = textItems(p);
    expect(z).toHaveLength(soll.length);
    z.forEach((x, i) => {
      const name = `Zeile ${String(i)}`;
      expect(x.stil.whiteSpace, name).toBe('pre');
      expect(x.stil.fontKerning, name).toBe('none');
      expect(x.stil.fontFamily.replace(/["']/g, '').split(',')[0]?.trim(), name).toBe('WAP Arimo');
      expect(x.stil.ligaturen, name).toBe('none');
      expect(x.stil.synthese, name).toBe('none');
      expect(x.stil.unicodeBidi, name).toBe('bidi-override');
      expect(x.stil.direction, name).toBe('ltr');
      expect(x.stil.position, name).toBe('absolute');
      nahe(
        Number.parseFloat(x.stil.fontSize),
        (soll[i]?.item.sizePt ?? 0) * 4,
        0.001,
        `${name} font-size`,
      );
    });
  });

  test('[R-L-04] je Lauf ein span mit Gewicht 400/700 und Farbe des Laufs', async ({ wapPage }) => {
    await harnessBereit(wapPage);
    const p = zeilenSeite();
    await zeigeUndWarte(wapPage, p, 1);
    const z = await messeZeilen(wapPage, LABEL, 1);
    textItems(p).forEach(({ item }, i) => {
      expect(z[i]?.laeufe.map((l) => [l.text, l.weight, l.color])).toEqual(
        item.runs.map((r) => [r.text, r.weight === 'bold' ? '700' : '400', cssFarbe(r.color)]),
      );
    });
  });

  test('[R-L-04] Lage bei scale 1 und 2: Grundlinienbeginn x ± 0,05 pt, Grundlinie ± 0,15 pt, Zeilenbreite = measureRuns ± 0,05 pt, auch gedreht 90/270; kein Umbruch', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = zeilenSeite();
    for (const scale of [1, 2]) {
      await zeigeUndWarte(wapPage, p, scale);
      const z = await messeZeilen(wapPage, LABEL, scale);
      textItems(p).forEach(({ item }, i) => {
        const n = `scale ${String(scale)} Zeile ${String(i)} (Drehung ${String(item.rotation)})`;
        const g = z[i];
        const w = measureRuns(item.runs, item.sizePt);
        const e = ende(item, w);
        if (item.rotation === 0) {
          nahe(g?.start.x, item.x, TOL_X, `${n} x`);
          nahe(g?.start.y, item.baselineY, TOL_GRUNDLINIE, `${n} Grundlinie`);
          nahe(g?.ende.x, e.x, TOL_X, `${n} Ende x (Breite)`);
          nahe(g?.ende.y, e.y, TOL_GRUNDLINIE, `${n} Ende Grundlinie (kein Umbruch)`);
        } else {
          nahe(g?.start.x, item.x, TOL_GRUNDLINIE, `${n} Grundlinie`);
          nahe(g?.start.y, item.baselineY, TOL_X, `${n} Beginn`);
          nahe(g?.ende.x, e.x, TOL_GRUNDLINIE, `${n} Ende Grundlinie (kein Umbruch)`);
          nahe(g?.ende.y, e.y, TOL_X, `${n} Ende (Breite)`);
        }
      });
    }
  });

  test('[R-L-04] (V-02c-2, P-11) Durchstreichung je durchgestrichenem Lauf als leeres span mit aria-hidden: Lage und Dicke nach STRIKE_EM, auch gedreht', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = zeilenSeite();
    for (const scale of [1, 2]) {
      await zeigeUndWarte(wapPage, p, scale);
      const z = await messeZeilen(wapPage, LABEL, scale);
      textItems(p).forEach(({ item }, i) => {
        const soll: { x: number; y: number; w: number; h: number }[] = [];
        let off = 0;
        for (const r of item.runs) {
          const w = measureRuns([r], item.sizePt);
          if (r.strike && r.text !== '') soll.push(strichSoll(item, off, w));
          off += w;
        }
        const ist = [...(z[i]?.striche ?? [])].sort((a, b) => a.x + a.y - (b.x + b.y));
        const n = `scale ${String(scale)} Zeile ${String(i)}`;
        expect(ist, n).toHaveLength(soll.length);
        // Längs der Grundlinie ± 0,05 pt, quer dazu ± 0,15 pt (wie Grundlinie); Länge und Dicke ± 0,05 pt.
        const tolX = item.rotation === 0 ? TOL_X : TOL_GRUNDLINIE;
        const tolY = item.rotation === 0 ? TOL_GRUNDLINIE : TOL_X;
        soll.forEach((s, k) => {
          nahe(ist[k]?.x, s.x, tolX, `${n} Strich ${String(k)} x`);
          nahe(ist[k]?.y, s.y, tolY, `${n} Strich ${String(k)} y`);
          nahe(ist[k]?.w, s.w, TOL_X, `${n} Strich ${String(k)} w`);
          nahe(ist[k]?.h, s.h, TOL_X, `${n} Strich ${String(k)} h`);
        });
      });
    }
    const strichElemente = wapPage
      .getByRole('document', { name: LABEL })
      .locator('span[data-wap-item] > [aria-hidden="true"]');
    await expect(strichElemente).toHaveCount(3);
    for (const el of await strichElemente.all()) await expect(el).toHaveText('');
  });

  test('[R-L-04] (V-02c-2) Farbe der Durchstreichung = Farbe des Laufs (Lauf aus Leerzeichen, scale 2)', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = seite(
      [
        zeile({
          x: 20,
          baselineY: 60,
          sizePt: 24,
          runs: [lauf('      ', { strike: true, color: ROT })],
        }),
      ],
      {
        widthPt: 200,
        heightPt: 100,
      },
    );
    await zeige(wapPage, p, { scale: 2, label: LABEL });
    await expect(
      wapPage.getByRole('document', { name: LABEL }).locator('span[data-wap-item]'),
    ).toHaveCount(1);
    const pix = await bildschirmPixel(wapPage, LABEL);
    const w = measureRuns(p.items[0]?.kind === 'text' ? p.items[0].runs : [], 24);
    const mitteY = (60 - STRIKE_EM.center * 24) * 2;
    const treffer = [-2, -1, 0, 1, 2].map((dy) => rgbBei(pix, (20 + w / 2) * 2, mitteY + dy));
    expect(treffer.map((t) => t.join(','))).toContain(
      `${String(ROT.r)},${String(ROT.g)},${String(ROT.b)}`,
    );
  });

  test('[R-L-04] (V11, TR-E102c-09) leerer durchgestrichener Lauf: am Bildschirm kein Strich, kein Text; der folgende Lauf ohne Versatz', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const runs = [
      lauf('Vor'),
      lauf('', { strike: true, color: ROT }),
      lauf('nach', { weight: 'bold' }),
    ];
    const p = seite([
      zeile({ x: 100, baselineY: 100, sizePt: 10, runs }),
      zeile({
        x: 100,
        baselineY: 140,
        sizePt: 10,
        runs: [lauf('', { strike: true, color: BLAU })],
      }),
    ]);
    await zeigeUndWarte(wapPage, p, 1);
    const z = await messeZeilen(wapPage, LABEL, 1);
    expect(z.map((x) => x.text)).toEqual(['Vornach', '']);
    expect(z.map((x) => x.striche.length)).toEqual([0, 0]);
    const nach = z[0]?.zeichen.find((c) => c.z === 'n');
    nahe(nach?.x, 100 + measureRuns([lauf('Vor')], 10), TOL_X, 'Beginn von «nach»');
    nahe(z[0]?.ende.x, 100 + measureRuns(runs, 10), TOL_X, 'Zeilenende');
  });

  test('[R-L-04] (V21) Bidi-Override je Zeile: «(\u05E9\u05DC\u05D5\u05DD) 12» steht in Speicherfolge, x je Zeichen monoton steigend', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = seite([
      zeile({ x: 100, baselineY: 100, sizePt: 12, runs: [lauf('(\u05E9\u05DC\u05D5\u05DD) 12')] }),
    ]);
    await zeigeUndWarte(wapPage, p, 1);
    const z = await messeZeilen(wapPage, LABEL, 1);
    const zeichen = z[0]?.zeichen ?? [];
    expect(zeichen.map((c) => c.z).join('')).toBe('(\u05E9\u05DC\u05D5\u05DD) 12');
    nahe(zeichen[0]?.x, 100, TOL_X, 'erstes Zeichen');
    for (let i = 1; i < zeichen.length; i++) {
      expect(zeichen[i]?.x ?? 0, `Zeichen ${String(i)}`).toBeGreaterThan(zeichen[i - 1]?.x ?? 0);
    }
  });
});

test.describe('PageView: Container, Papier, Overlay (Vertrag §3.2, P-12)', () => {
  test('[R-L-04] (P-12) Container role=document mit Name, Grösse widthPt × scale; Papier als erstes Kind mit 4 px/pt, scale(scale/4), Ursprung 0 0', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = zeilenSeite();
    for (const scale of [1, 2, 0.5]) {
      await zeigeUndWarte(wapPage, p, scale);
      const c = wapPage.getByRole('document', { name: LABEL });
      const box = await c.boundingBox();
      nahe(box?.width, p.widthPt * scale, TOL_PX, `Breite scale ${String(scale)}`);
      nahe(box?.height, p.heightPt * scale, TOL_PX, `Höhe scale ${String(scale)}`);
      const stil = await c.evaluate((el) => {
        const papier = el.firstElementChild;
        const ps = papier === null ? null : getComputedStyle(papier);
        const cs = getComputedStyle(el);
        return {
          position: cs.position,
          overflow: cs.overflow,
          papierBreite: ps?.width ?? '',
          papierHoehe: ps?.height ?? '',
          transform: ps?.transform ?? '',
          ursprung: ps?.transformOrigin ?? '',
          ariaHidden: papier?.getAttribute('aria-hidden') ?? null,
        };
      });
      expect(stil.position).toBe('relative');
      expect(stil.overflow).toBe('hidden');
      nahe(Number.parseFloat(stil.papierBreite), p.widthPt * 4, TOL_PX, 'Papierbreite');
      nahe(Number.parseFloat(stil.papierHoehe), p.heightPt * 4, TOL_PX, 'Papierhöhe');
      const m =
        /^matrix\(([^)]*)\)$/
          .exec(stil.transform)?.[1]
          ?.split(',')
          .map((v) => Number(v)) ?? [];
      expect(m).toHaveLength(6);
      nahe(m[0], scale / 4, 1e-6, 'Skalierung x');
      nahe(m[3], scale / 4, 1e-6, 'Skalierung y');
      expect([m[1], m[2], m[4], m[5]]).toEqual([0, 0, 0, 0]);
      expect(stil.ursprung).toBe('0px 0px');
      expect(stil.ariaHidden).toBeNull();
    }
  });

  test('[R-L-04] (P-12) Overlay als letztes Kind ausserhalb des Papiers; semanticsProvidedByOverlay setzt das Papier aria-hidden', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = zeilenSeite();
    await zeige(wapPage, p, { scale: 1, label: LABEL, overlay: true });
    const c = wapPage.getByRole('document', { name: LABEL });
    await expect(c.locator('span[data-wap-item]')).toHaveCount(textItems(p).length);
    await expect(c.getByRole('button', { name: 'Prüfmarke' })).toBeVisible();
    const lage = await c.evaluate((el) => ({
      letztes: el.lastElementChild?.textContent ?? null,
      imPapier: el.firstElementChild?.querySelector('button') !== null,
      papierHidden: el.firstElementChild?.getAttribute('aria-hidden') ?? null,
    }));
    expect(lage).toEqual({ letztes: 'Prüfmarke', imPapier: false, papierHidden: null });

    await zeige(wapPage, p, {
      scale: 1,
      label: LABEL,
      overlay: true,
      semanticsProvidedByOverlay: true,
    });
    await expect(c.locator(':scope > :first-child')).toHaveAttribute('aria-hidden', 'true');
    await expect(c.getByRole('button', { name: 'Prüfmarke' })).toBeVisible();
    await expect(c.locator('span[data-wap-item]')).toHaveCount(textItems(p).length);
  });
});

test.describe('PageView: Formen und Ebenen (Vertrag §3.2, P-12, V04, V08, V22)', () => {
  /** Fläche A, Linie B, Zeile T1, Pfad C (schneidet frame von T1), Zeile T2, Fläche D (schneidet frame von T2). */
  function ebenenSeite(): PageModel {
    return seite([
      rechteck({ x: 50, y: 50, w: 100, h: 40 }, GRUEN, strich(BLAU, 0.75, [3, 1.5])),
      linie(40, 30, 300, 30, strich(ORANGE, 0.5)),
      zeile({
        x: 60,
        baselineY: 70,
        runs: [lauf('Zeile eins')],
        frame: { x: 50, y: 55, w: 100, h: 20 },
      }),
      pfad('M 55 58 L 140 58 L 140 72 Z', ROT, null),
      zeile({
        x: 60,
        baselineY: 100,
        runs: [lauf('Zeile zwei')],
        frame: { x: 50, y: 88, w: 100, h: 16 },
      }),
      rechteck({ x: 50, y: 90, w: 100, h: 10 }, BLAU, null),
    ]);
  }

  test('[R-L-04] (P-12, V08) Reihenfolge wie items: jede Folge von Nicht-Text-Elementen ein eigenes svg zwischen den Zeilen', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    await zeigeUndWarte(wapPage, ebenenSeite(), 1);
    const folge = await wapPage
      .getByRole('document', { name: LABEL })
      .evaluate((el) =>
        [...el.querySelectorAll('svg, span[data-wap-item]')].map((n) =>
          n.tagName.toLowerCase() === 'svg'
            ? `svg:${String(n.querySelectorAll('path, rect, line, polyline, polygon, image, circle, ellipse').length)}`
            : `zeile:${n.getAttribute('data-wap-item') ?? ''}`,
        ),
      );
    expect(folge).toEqual(['svg:2', 'zeile:2', 'svg:1', 'zeile:4', 'svg:1']);
  });

  test('[R-L-04] (V22) eine spätere Fläche, die das frame einer Zeile schneidet, liegt in einem svg nach dem Zeilen-span; die frühere Fläche davor', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = seite([
      rechteck({ x: 100, y: 100, w: 200, h: 60 }, GRUEN, null),
      zeile({
        x: 110,
        baselineY: 130,
        sizePt: 12,
        runs: [lauf('Überdeckte Zeile')],
        frame: { x: 105, y: 115, w: 150, h: 20 },
      }),
      rechteck({ x: 240, y: 110, w: 40, h: 40 }, ROT, null),
    ]);
    await zeigeUndWarte(wapPage, p, 1);
    const lage = await wapPage.getByRole('document', { name: LABEL }).evaluate(
      (el, [farbeGruen, farbeRot]) => {
        const span = el.querySelector('span[data-wap-item]');
        const svgMit = (farbe: string) =>
          [...el.querySelectorAll('svg')].find((s) =>
            [...s.querySelectorAll('*')].some((k) => getComputedStyle(k).fill === farbe),
          );
        const gruen = svgMit(farbeGruen);
        const rot = svgMit(farbeRot);
        if (span === null || gruen === undefined || rot === undefined) return null;
        return {
          gruenVorZeile:
            (gruen.compareDocumentPosition(span) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          rotNachZeile:
            (span.compareDocumentPosition(rot) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          verschieden: gruen !== rot,
        };
      },
      [cssFarbe(GRUEN), cssFarbe(ROT)] as const,
    );
    expect(lage).toEqual({ gruenVorZeile: true, rotNachZeile: true, verschieden: true });
  });

  /** Lage der grünen Fläche und der Form in Farbe `farbe` relativ zum Zeilen-span. */
  async function lageZurZeile(page: Page, farbe: string) {
    return page.getByRole('document', { name: LABEL }).evaluate(
      (el, [farbeGruen, farbeForm]) => {
        const span = el.querySelector('span[data-wap-item]');
        const svgMit = (f: string) =>
          [...el.querySelectorAll('svg')].find((s) =>
            [...s.querySelectorAll('*')].some((k) => {
              const st = getComputedStyle(k);
              return st.fill === f || st.stroke === f;
            }),
          );
        const gruen = svgMit(farbeGruen);
        const form = svgMit(farbeForm);
        if (span === null || gruen === undefined || form === undefined) return null;
        return {
          gruenVorZeile:
            (gruen.compareDocumentPosition(span) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
          formNachZeile:
            (span.compareDocumentPosition(form) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0,
        };
      },
      [cssFarbe(GRUEN), farbe] as const,
    );
  }

  test('[R-L-04] (V22, TR-E102c-03) Strichzugabe 5 × widthPt zählt: eine Fläche, deren Geometrie das frame nicht berührt, deren Strichzugabe es aber schneidet, liegt nach dem Zeilen-span', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    // frame x 105–255; Fläche ab x 260 (Abstand 5 pt), Strich 2 pt → Zugabe 10 pt je Seite → ab x 250.
    const p = seite([
      rechteck({ x: 100, y: 100, w: 140, h: 60 }, GRUEN, null),
      zeile({
        x: 110,
        baselineY: 130,
        sizePt: 12,
        runs: [lauf('Zeile mit Rahmen')],
        frame: { x: 105, y: 115, w: 150, h: 20 },
      }),
      rechteck({ x: 260, y: 110, w: 40, h: 40 }, null, strich(ORANGE, 2)),
    ]);
    await zeigeUndWarte(wapPage, p, 1);
    expect(await lageZurZeile(wapPage, cssFarbe(ORANGE))).toEqual({
      gruenVorZeile: true,
      formNachZeile: true,
    });
  });

  test('[R-L-04] (V22, TR-E102c-03) Kontrollpunkte zählen: ein Pfad, dessen Kurve das frame nicht berührt, dessen Kontrollpunkt aber im frame liegt, liegt nach dem Zeilen-span', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    // frame x 105–255, y 115–135; Kontrollpunkt (230, 125) im frame, die Kurve selbst bleibt rechts von x 270.
    const p = seite([
      rechteck({ x: 100, y: 100, w: 140, h: 60 }, GRUEN, null),
      zeile({
        x: 110,
        baselineY: 130,
        sizePt: 12,
        runs: [lauf('Zeile mit Rahmen')],
        frame: { x: 105, y: 115, w: 150, h: 20 },
      }),
      pfad('M 300 100 C 230 125 330 125 300 150 Z', VIOLETT, null),
    ]);
    await zeigeUndWarte(wapPage, p, 1);
    expect(await lageZurZeile(wapPage, cssFarbe(VIOLETT))).toEqual({
      gruenVorZeile: true,
      formNachZeile: true,
    });
  });

  test('[R-L-04] (P-12) jedes svg: aria-hidden, viewBox 0 0 widthPt heightPt, Seitengrösse, position absolute, pointer-events none', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = ebenenSeite();
    for (const scale of [1, 2]) {
      await zeigeUndWarte(wapPage, p, scale);
      const svgs = await wapPage.getByRole('document', { name: LABEL }).evaluate((el) => {
        const cr = el.getBoundingClientRect();
        return [...el.querySelectorAll('svg')].map((s) => {
          const r = s.getBoundingClientRect();
          const vb = s.viewBox.baseVal;
          const st = getComputedStyle(s);
          return {
            ariaHidden: s.getAttribute('aria-hidden'),
            viewBox: [vb.x, vb.y, vb.width, vb.height],
            links: r.left - cr.left,
            oben: r.top - cr.top,
            breite: r.width,
            hoehe: r.height,
            position: st.position,
            zeiger: st.pointerEvents,
          };
        });
      });
      expect(svgs.length).toBeGreaterThan(0);
      for (const s of svgs) {
        expect(s.ariaHidden).toBe('true');
        expect(s.position).toBe('absolute');
        expect(s.zeiger).toBe('none');
        nahe(s.viewBox[0], 0, 1e-9, 'viewBox x');
        nahe(s.viewBox[1], 0, 1e-9, 'viewBox y');
        nahe(s.viewBox[2], p.widthPt, 1e-3, 'viewBox Breite');
        nahe(s.viewBox[3], p.heightPt, 1e-3, 'viewBox Höhe');
        nahe(s.links, 0, TOL_PX, 'svg links');
        nahe(s.oben, 0, TOL_PX, 'svg oben');
        nahe(s.breite, p.widthPt * scale, TOL_PX, 'svg Breite');
        nahe(s.hoehe, p.heightPt * scale, TOL_PX, 'svg Höhe');
      }
    }
  });

  test('[R-L-04] (V04) Rechteck als Pfad ab oben links im Uhrzeigersinn; Strich, Strichelung, stumpfe Enden, spitze Ecken, Gehrungsgrenze 10, Füllregel nonzero, Farben', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    await zeigeUndWarte(wapPage, ebenenSeite(), 1);
    const formen = await wapPage.getByRole('document', { name: LABEL }).evaluate((el) =>
      [...el.querySelectorAll('svg *')]
        .filter((k) => k instanceof SVGGeometryElement)
        .map((k) => {
          const st = getComputedStyle(k);
          const bb = (k as SVGGraphicsElement).getBBox();
          return {
            tag: k.tagName.toLowerCase(),
            d: k.getAttribute('d'),
            fill: st.fill,
            stroke: st.stroke,
            breite: st.strokeWidth,
            strichelung: st.strokeDasharray,
            versatz: st.strokeDashoffset,
            enden: st.strokeLinecap,
            ecken: st.strokeLinejoin,
            gehrung: st.strokeMiterlimit,
            regel: st.fillRule,
            bbox: [bb.x, bb.y, bb.width, bb.height],
          };
        }),
    );
    expect(formen).toHaveLength(4);
    const a = formen[0];
    expect(a?.tag).toBe('path');
    const teile = [...(a?.d ?? '').matchAll(/([MLZ])([^MLZ]*)/g)].map((m) => [
      m[1],
      ...(m[2] ?? '')
        .trim()
        .split(/[\s,]+/)
        .filter((v) => v !== '')
        .map(Number),
    ]);
    expect(teile).toEqual([['M', 50, 50], ['L', 150, 50], ['L', 150, 90], ['L', 50, 90], ['Z']]);
    expect(a?.fill).toBe(cssFarbe(GRUEN));
    expect(a?.stroke).toBe(cssFarbe(BLAU));
    expect(Number.parseFloat(a?.breite ?? '')).toBe(0.75);
    expect((a?.strichelung ?? '').split(',').map((v) => Number.parseFloat(v))).toEqual([3, 1.5]);
    expect(Number.parseFloat(a?.versatz ?? '')).toBe(0);
    // Strich-Eigenschaften gelten für Formen mit Strich, die Füllregel für Formen mit Fläche.
    const mitStrich = formen.filter((f) => f.stroke !== 'none');
    expect(mitStrich).toHaveLength(2);
    for (const f of mitStrich) {
      expect(f.enden).toBe('butt');
      expect(f.ecken).toBe('miter');
      expect(f.gehrung).toBe('10');
    }
    // Formen mit Fläche im Modell: A, C, D (die Linie B hat keine).
    for (const i of [0, 2, 3]) expect(formen[i]?.regel).toBe('nonzero');
    const [, linieB, pfadC, flaecheD] = formen;
    expect(linieB?.stroke).toBe(cssFarbe(ORANGE));
    expect(linieB?.strichelung).toBe('none');
    expect(linieB?.bbox).toEqual([40, 30, 260, 0]);
    expect(pfadC?.fill).toBe(cssFarbe(ROT));
    expect(pfadC?.stroke).toBe('none');
    expect(pfadC?.bbox).toEqual([55, 58, 85, 14]);
    expect(flaecheD?.fill).toBe(cssFarbe(BLAU));
    expect(flaecheD?.stroke).toBe('none');
    expect(flaecheD?.bbox).toEqual([50, 90, 100, 10]);
  });

  test('[R-L-04] (P-12) Text unter einer späteren Fläche bleibt markierbar (svg ohne Zeigerereignisse)', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const p = seite([
      zeile({ x: 100, baselineY: 100, sizePt: 12, runs: [lauf('Markierbarer Text')] }),
      rechteck({ x: 90, y: 80, w: 200, h: 40 }, ROT, null),
    ]);
    await zeigeUndWarte(wapPage, p, 1);
    const c = wapPage.getByRole('document', { name: LABEL });
    const box = await c.boundingBox();
    const x = (box?.x ?? 0) + 100 + measureRuns([lauf('Markierbar')], 12) / 2;
    const y = (box?.y ?? 0) + 100 - 4;
    const getroffen = await wapPage.evaluate(
      ([px, py]) => document.elementFromPoint(px, py)?.closest('span[data-wap-item]') !== null,
      [x, y] as const,
    );
    expect(getroffen).toBe(true);
    await wapPage.mouse.click(x, y, { clickCount: 3 });
    expect(await wapPage.evaluate(() => getSelection()?.toString() ?? '')).toContain(
      'Markierbarer Text',
    );
  });
});

test.describe('PageView: Bilder (Vertrag §3.2, V05, Runde 2 V18)', () => {
  test('[R-L-04] (V18, V05) Bild als <image> mit data:-URL aus sanitizeImageBytes, preserveAspectRatio none, füllt rect', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const png = pngPalette({ metadaten: 'FIKTIV-BILDSCHIRM-7001' }).bytes;
    const p = seite([
      {
        role: 'signature',
        kind: 'image',
        rect: { x: 120, y: 80, w: 90, h: 30 },
        mime: 'image/png',
        bytes: png,
      },
    ]);
    await zeige(wapPage, p, { scale: 1, label: LABEL });
    const bild = wapPage.getByRole('document', { name: LABEL }).locator('svg image');
    await expect(bild).toHaveCount(1);
    const a = await bild.evaluate((el) => {
      const bb = (el as SVGGraphicsElement).getBBox();
      return {
        href: el.getAttribute('href') ?? el.getAttribute('xlink:href') ?? '',
        verhaeltnis: el.getAttribute('preserveAspectRatio'),
        bbox: [bb.x, bb.y, bb.width, bb.height],
      };
    });
    expect(a.verhaeltnis).toBe('none');
    expect(a.bbox).toEqual([120, 80, 90, 30]);
    const praefix = 'data:image/png;base64,';
    expect(a.href.startsWith(praefix)).toBe(true);
    expect(Array.from(ausBase64(a.href.slice(praefix.length)))).toEqual(
      Array.from(sanitizeImageBytes('image/png', png) ?? []),
    );
  });

  test('[R-L-04] (V18) nicht lesbares Bild (JPEG ohne EOI) wird nicht gezeichnet; die übrigen Elemente schon', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    const kaputt = Uint8Array.from([0xff, 0xd8, 0xff, 0xfe, 0x00, 0x04, 0x41, 0x42]);
    const p = seite([
      rechteck({ x: 10, y: 10, w: 50, h: 50 }, GRUEN, null),
      {
        role: 'signature',
        kind: 'image',
        rect: { x: 100, y: 10, w: 50, h: 50 },
        mime: 'image/jpeg',
        bytes: kaputt,
      },
      zeile({ x: 10, baselineY: 100, runs: [lauf('Text bleibt')] }),
    ]);
    await zeigeUndWarte(wapPage, p, 1);
    const c = wapPage.getByRole('document', { name: LABEL });
    await expect(c.locator('svg image')).toHaveCount(0);
    await expect(c.locator('svg')).not.toHaveCount(0);
    await expect(c.locator('span[data-wap-item]')).toHaveText('Text bleibt');
  });

  test('[R-L-04] (V18) JPEG mit EXIF-Orientierung 6: am Bildschirm dieselbe Eckenfolge wie im gerenderten PDF (unrotiert)', async ({
    wapPage,
  }) => {
    await harnessBereit(wapPage);
    // Fiktives Bild 64 × 32 px mit vier Farbecken, als JPEG mit eingefügtem EXIF (Orientierung 6).
    const leinwand = createCanvas(64, 32);
    const g = leinwand.getContext('2d');
    for (const [farbe, x, y] of [
      ['#ff0000', 0, 0],
      ['#00ff00', 32, 0],
      ['#0000ff', 0, 16],
      ['#ffff00', 32, 16],
    ] as const) {
      g.fillStyle = farbe;
      g.fillRect(x, y, 32, 16);
    }
    const roh = new Uint8Array(leinwand.toBuffer('image/jpeg', 95));
    // EXIF (APP1) nach dem APP0-Segment einfügen; ohne APP0 direkt nach SOI.
    const nachApp0 = roh[3] === 0xe0 ? 4 + (((roh[4] ?? 0) << 8) | (roh[5] ?? 0)) : 2;
    const jpeg = verkette([
      roh.subarray(0, nachApp0),
      exif(6, 'FIKTIV-ORIENTIERUNG'),
      roh.subarray(nachApp0),
    ]);
    const rect = { x: 100, y: 100, w: 128, h: 64 };
    const p = seite([{ role: 'signature', kind: 'image', rect, mime: 'image/jpeg', bytes: jpeg }], {
      widthPt: 400,
      heightPt: 300,
    });
    const punkte: [number, number][] = [
      [rect.x + 32, rect.y + 16],
      [rect.x + 96, rect.y + 16],
      [rect.x + 32, rect.y + 48],
      [rect.x + 96, rect.y + 48],
    ];
    const erwartet = ['rot', 'gruen', 'blau', 'gelb'];

    await zeige(wapPage, p, { scale: 1, label: LABEL });
    await expect(wapPage.getByRole('document', { name: LABEL }).locator('svg image')).toHaveCount(
      1,
    );
    // Warten, bis das Bild dekodiert und gezeichnet ist (Ecke oben links nicht mehr weiss).
    await expect
      .poll(
        async () =>
          eckfarbe(
            rgbBei(await bildschirmPixel(wapPage, LABEL), punkte[0]?.[0] ?? 0, punkte[0]?.[1] ?? 0),
          ),
        {
          timeout: 5_000,
        },
      )
      .not.toBe('unbekannt');
    const schirm = await bildschirmPixel(wapPage, LABEL);
    const amSchirm = punkte.map(([x, y]) => eckfarbe(rgbBei(schirm, x, y)));

    const pdf = await wapPage.evaluate(
      async ([s, t]) => (await window.wapHarness?.pdf(s, t)) ?? null,
      [[zuJson(p)], 'Fiktiv Orientierung'] as const,
    );
    expect(pdf?.ok).toBe(true);
    const bytes = pdf?.ok === true ? ausBase64(pdf.base64) : new Uint8Array(0);
    await pdfArtefakt('e1-02c-edge-orientierung', bytes);
    const r = await renderPdfPage(bytes, 1, 300);
    const imPdf = punkte.map(([x, y]) =>
      eckfarbe(rgbBei({ breite: r.width, rgba: r.rgba }, (x * 300) / 72, (y * 300) / 72)),
    );
    expect(amSchirm).toEqual(erwartet);
    expect(imPdf).toEqual(erwartet);
  });
});

test.describe('PageView: Schrift laden (Vertrag §3.1, §3.2 «Laden», P-13, V-02c-4)', () => {
  test('[R-L-04] (V-02c-4) bis ensureScreenFont erfüllt ist: aria-busy="true", kein Papier, kein Text; danach die Zeilen', async ({
    wapPage,
  }) => {
    await wapPage.addInitScript(() => {
      let freigeben: () => void = () => {};
      const warten = new Promise<void>((r) => {
        freigeben = r;
      });
      (window as unknown as { wapFreigabe: () => void }).wapFreigabe = () => freigeben();
      const laden = FontFace.prototype.load;
      FontFace.prototype.load = function (this: FontFace) {
        return warten.then(() => laden.call(this));
      };
    });
    await harnessBereit(wapPage);
    const p = zeilenSeite();
    await zeige(wapPage, p, { scale: 1, label: LABEL });
    const c = wapPage.getByRole('document', { name: LABEL });
    await expect(c).toHaveAttribute('aria-busy', 'true');
    await expect(c.locator('span[data-wap-item]')).toHaveCount(0);
    await expect(c.locator('svg')).toHaveCount(0);
    await expect(c).toHaveText('');
    expect(await c.evaluate((el) => el.childElementCount)).toBe(0);
    await wapPage.evaluate(() => (window as unknown as { wapFreigabe: () => void }).wapFreigabe());
    await expect(c.locator('span[data-wap-item]')).toHaveCount(textItems(p).length);
    await expect(c).not.toHaveAttribute('aria-busy', 'true');
  });

  test('[R-L-04] (P-13) ensureScreenFont lädt beide Schnitte als FontFace «WAP Arimo» aus Bytes (400/700, normal), einmal je Dokument; kein @font-face', async ({
    wapPage,
  }) => {
    await wapPage.addInitScript(() => {
      const Original = FontFace;
      const aufrufe: { family: string; quelle: string; weight: string; style: string }[] = [];
      (window as unknown as { wapFontFaces: typeof aufrufe }).wapFontFaces = aufrufe;
      class Gezaehlt extends Original {
        constructor(...a: ConstructorParameters<typeof FontFace>) {
          super(...a);
          aufrufe.push({
            family: a[0],
            quelle: typeof a[1] === 'string' ? 'text' : 'bytes',
            weight: a[2]?.weight ?? '',
            style: a[2]?.style ?? '',
          });
        }
      }
      (window as unknown as { FontFace: typeof FontFace }).FontFace = Gezaehlt;
    });
    await harnessBereit(wapPage);
    const erg = await wapPage.evaluate(async () => (await window.wapHarness?.schrift()) ?? null);
    expect(erg?.map((e) => e.ok)).toEqual([true, true]);
    const info = await wapPage.evaluate(() => ({
      aufrufe: (window as unknown as { wapFontFaces: unknown[] }).wapFontFaces,
      geladen: [...document.fonts]
        .filter((f) => f.family.replace(/["']/g, '') === 'WAP Arimo')
        .map((f) => [f.weight, f.style, f.status])
        .sort(),
      fontFaceRegeln: [...document.styleSheets].flatMap((s) => {
        try {
          return [...s.cssRules].filter((r) => r instanceof CSSFontFaceRule).map((r) => r.cssText);
        } catch {
          return [];
        }
      }),
    }));
    expect(info.aufrufe).toHaveLength(2);
    expect(
      (info.aufrufe as { family: string; quelle: string; weight: string; style: string }[])
        .map((a) => [a.family, a.quelle, a.weight, a.style])
        .sort(),
    ).toEqual([
      ['WAP Arimo', 'bytes', '400', 'normal'],
      ['WAP Arimo', 'bytes', '700', 'normal'],
    ]);
    expect(info.geladen).toEqual([
      ['400', 'normal', 'loaded'],
      ['700', 'normal', 'loaded'],
    ]);
    expect(info.fontFaceRegeln.filter((r) => r.includes('WAP Arimo'))).toEqual([]);
    // Ein PageView danach lädt nicht erneut.
    await zeigeUndWarte(wapPage, zeilenSeite(), 1);
    expect(
      await wapPage.evaluate(
        () => (window as unknown as { wapFontFaces: unknown[] }).wapFontFaces.length,
      ),
    ).toBe(2);
  });
});
