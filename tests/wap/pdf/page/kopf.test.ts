// @vitest-environment jsdom
// Paket E1-02e: Kopf der Wochenseite im PDF (R-10-07 bis R-10-12, R-4.9-01, R-4.9-07, R-10-38; Vertrag E1-02e
// Notiz «Ausarbeitung Schritt 2» E1, E6, H1, J; Gate 0 Q-012, B-F-02, B-F-03; V-02e-5, -6, -9, -17, V21). Geprüft
// wird nur das gelesene PDF (readPdf); Sollwerte aus anhang-b-kp.csv. Pseudonymisierte KVK-Fixture, KVK+ und
// fiktive Varianten.
import { describe, expect, it } from 'vitest';
import { fontMetrics } from '../../../../src/model/wap/layout/text/metrics';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { leseBkp, ZAHL } from '../../support/page/bkp';
import {
  type Bereiche,
  bereiche,
  bereichsRechtecke,
  einLauf,
  innerhalb,
  laeufeMit,
  nahe,
  schneidet,
  striche,
  umriss,
} from '../../support/page/pdf-seite';
import { einmal, optionen, seitePdf } from '../../support/page/seite';
import {
  bkpZahlen,
  farbeAus,
  MUSTER_108,
  mindestgroesse,
  stileAusCsv,
} from '../../support/page/stile';
import { KLASSIFIZIERUNG, KVK_WOCHE, kvk, kvkPlus } from '../../support/page/varianten';
import { minFontSize } from '../../support/pdf/checks';
import type { PdfInfo, PdfStroke, PdfTextRun } from '../../support/pdf/read';

const KVK_TITEL = 'Inf Ustü Kp 61/4 Arbeitsplan KVK';
const KVK_EINHEIT = 'Inf Ustü Kp 61/4';
const KVK_BEILAGE = 'Beilage 01-02 zum Allgemeinen Befehl für den FDT 2026';

const kvkPdf = einmal(() => seitePdf('kopf-kvk', kvk(), KVK_WOCHE));
const plusPdf = einmal(() => seitePdf('kopf-kvk-plus', kvkPlus(), KVK_WOCHE));

function rechteKante(t: PdfTextRun): number {
  return t.x + t.width;
}

/** Lauf im Kopf (Umriss oberhalb der Kopf-Unterlinie). */
function imKopf(info: PdfInfo, b: Bereiche, text: string): PdfTextRun[] {
  return laeufeMit(info, text, 1).filter((t) => umriss(t).y + umriss(t).h <= b.yK + 0.01);
}

/** Der Einheitslauf rechts im Kopf (normal, links von der Seitenleiste … rechts bis K). */
function einheitImKopf(info: PdfInfo, b: Bereiche, text: string): PdfTextRun {
  const l = imKopf(info, b, text).filter((t) => !t.bold);
  expect(l.length, `Einheit «${text}» im Kopf`).toBe(1);
  return l[0] as PdfTextRun;
}

/** Gerahmte Rechtecke im Kopf mit dem Strich `stil`. */
function kopfRahmen(info: PdfInfo, b: Bereiche, breite: number, tol: number): PdfStroke[] {
  return striche(info, 1).filter(
    (s) =>
      s.kind === 'rect' &&
      nahe(s.widthPt, breite, tol) &&
      s.bbox.y + s.bbox.h <= b.yK + 0.01 &&
      s !== b.rahmenStrich,
  );
}

describe('Kopf links (R-10-07; Q-012)', () => {
  it('[R-10-07] «SCHWEIZER ARMEE» in Arimo-Bold und «Woche vom 28.09.2026 bis 04.10.2026 KW 40» links im Kopf', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const armee = einLauf(info, 'SCHWEIZER ARMEE', 1);
    expect(armee.fontName).toBe('Arimo-Bold');
    expect(armee.bold).toBe(true);
    const woche = einLauf(info, 'Woche vom 28.09.2026 bis 04.10.2026 KW 40', 1);
    const mitteSeite = b.rahmen.x + b.rahmen.w / 2;
    for (const t of [armee, woche]) {
      const u = umriss(t);
      expect(u.y + u.h).toBeLessThanOrEqual(b.yK + 0.01);
      expect(u.y).toBeGreaterThanOrEqual(b.rahmen.y - 0.01);
      expect(u.x + u.w).toBeLessThan(mitteSeite);
      expect(u.x).toBeGreaterThanOrEqual(b.rahmen.x);
    }
  });

  it('[R-10-07] keine Emblem-Grafik im Kopf (keine Bildlage im Kopf) und nur die Schriften Arimo und Arimo-Bold im PDF', async () => {
    const { info } = await plusPdf();
    const b = bereiche(info);
    const kopf = { x: b.rahmen.x, y: b.rahmen.y, w: b.rahmen.w, h: b.yK - b.rahmen.y };
    expect(info.imagePlacements.filter((p) => p.page === 1 && schneidet(p.bbox, kopf))).toEqual([]);
    expect(info.imagePlacements.length).toBe(1);
    const namen = [...new Set(info.fonts.map((f) => f.name))].sort();
    expect(namen).toEqual(['Arimo', 'Arimo-Bold']);
  });
});

describe('Kopf Mitte (R-10-08, R-10-09, R-4.9-01; B-F-02, V-02e-6)', () => {
  it('[R-10-08][R-4.9-01] Titellauf «‹unit› Arbeitsplan ‹label›» fett in Titelgrösse (B-Kp-108), im Rahmen nach B-Kp-19 mit Beilage; Rahmenmitte nach B-Kp-21', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const stile = stileAusCsv(leseBkp());
    const titel = einLauf(info, KVK_TITEL, 1);
    expect(titel.bold).toBe(true);
    const [titelGroesse] = bkpZahlen('B-Kp-108', 'sollwert', MUSTER_108);
    const [tolGroesse] = bkpZahlen('B-Kp-108', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    expect(nahe(titel.sizePt, titelGroesse as number, tolGroesse as number)).toBe(true);
    const beilage = einLauf(info, KVK_BEILAGE, 1);
    const rahmen = kopfRahmen(
      info,
      b,
      stile.titelRahmen.breite,
      stile.titelRahmen.breiteTol,
    ).filter((s) => innerhalb(umriss(titel), s.bbox) && innerhalb(umriss(beilage), s.bbox));
    expect(rahmen.length, 'ein Rahmen nach B-Kp-19 um Titel und Beilage').toBe(1);
    const r = (rahmen[0] as PdfStroke).bbox;
    const [tolMitte] = bkpZahlen('B-Kp-21', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    expect(nahe(r.x + r.w / 2, b.rahmen.x + b.rahmen.w / 2, tolMitte as number)).toBe(true);
  });

  it('[R-10-09] Beilage «Beilage ‹beilage›» normal und vollständig unter dem Titel im Rahmen', async () => {
    const { info } = await kvkPdf();
    const titel = einLauf(info, KVK_TITEL, 1);
    const beilage = einLauf(info, KVK_BEILAGE, 1);
    expect(beilage.bold).toBe(false);
    expect(umriss(beilage).y).toBeGreaterThanOrEqual(umriss(titel).y + umriss(titel).h - 0.01);
  });

  it('[R-10-09] (V-02e-6) Beilage, die schon mit «Beilage» beginnt, ohne doppeltes Wort; leere Beilage ohne Zeile, Rahmen gleich hoch', async () => {
    const mit = await kvkPdf();
    const p = kvk();
    const schon = await seitePdf(
      'kopf-beilage-doppelt',
      { ...p, beilage: '  Beilage 3 zum Befehl ' },
      KVK_WOCHE,
    );
    einLauf(schon.info, 'Beilage 3 zum Befehl', 1);
    expect(schon.info.texts.filter((t) => t.text.includes('Beilage Beilage'))).toEqual([]);
    const leer = await seitePdf('kopf-beilage-leer', { ...p, beilage: '' }, KVK_WOCHE);
    expect(leer.info.texts.filter((t) => t.text.trim().startsWith('Beilage'))).toEqual([]);
    const stile = stileAusCsv(leseBkp());
    const rahmenUm = (info: PdfInfo) => {
      const b = bereiche(info);
      const titel = einLauf(info, KVK_TITEL, 1);
      const r = kopfRahmen(info, b, stile.titelRahmen.breite, stile.titelRahmen.breiteTol).filter(
        (s) => innerhalb(umriss(titel), s.bbox),
      );
      expect(r.length).toBe(1);
      return (r[0] as PdfStroke).bbox;
    };
    expect(nahe(rahmenUm(leer.info).h, rahmenUm(mit.info).h, 0.01)).toBe(true);
    expect(nahe(rahmenUm(leer.info).y, rahmenUm(mit.info).y, 0.01)).toBe(true);
  });
});

describe('Kopf rechts (R-10-10, R-10-11, R-10-12, R-4.9-07; B-F-03, V-02e-5, V-02e-9, V-02e-17, V21)', () => {
  it('[R-10-10] (V-02e-17) «INTERN»: fetter Lauf in Standardgrösse, Rahmen nach B-Kp-24 mit 1,0 pt bzw. 0,5 pt Abstand, gleiche Grundlinie wie die Einheit, rechte Kante 2,0 pt vor der Einheit', async () => {
    const { info } = await plusPdf();
    const b = bereiche(info);
    const k = einLauf(info, KLASSIFIZIERUNG, 1);
    expect(k.bold).toBe(true);
    expect(nahe(k.sizePt, kpTemplate().fontSizes.standard, 0.01)).toBe(true);
    const einheit = einheitImKopf(info, b, KVK_EINHEIT);
    expect(nahe(k.baselineY, einheit.baselineY, 0.01)).toBe(true);
    const [breite] = bkpZahlen(
      'B-Kp-24',
      'sollwert',
      new RegExp(`^Rahmen (${ZAHL}) pt; Text fett, zentriert$`),
    );
    const r = kopfRahmen(info, b, breite as number, 0.01).filter((s) =>
      innerhalb(umriss(k), s.bbox),
    );
    expect(r.length, 'Rahmen um die Klassifizierung').toBe(1);
    const f = (r[0] as PdfStroke).bbox;
    const m = fontMetrics();
    const ober = (m.ascender / m.unitsPerEm) * k.sizePt;
    const unter = (m.descender / m.unitsPerEm) * k.sizePt;
    expect(nahe(f.x, k.x - 1, 0.01)).toBe(true);
    expect(nahe(f.w, k.width + 2, 0.01)).toBe(true);
    expect(nahe(f.y, k.baselineY - ober - 0.5, 0.01)).toBe(true);
    expect(nahe(f.y + f.h, k.baselineY - unter + 0.5, 0.01)).toBe(true);
    expect(nahe(f.x + f.w, einheit.x - 2, 0.01)).toBe(true);
  });

  it('[R-10-10] leere Klassifizierung (KVK, auch nur Leerraum): weder Rahmen noch Lauf', async () => {
    for (const [fall, plan] of [
      ['kopf-klass-leer', kvk()],
      ['kopf-klass-leerraum', { ...kvk(), classification: '   ' }],
    ] as const) {
      const { info } = await seitePdf(fall, plan as Plan, KVK_WOCHE);
      const b = bereiche(info);
      const [breite] = bkpZahlen(
        'B-Kp-24',
        'sollwert',
        new RegExp(`^Rahmen (${ZAHL}) pt; Text fett, zentriert$`),
      );
      const titel = einLauf(info, KVK_TITEL, 1);
      const andere = kopfRahmen(info, b, breite as number, 0.01).filter(
        (s) => !innerhalb(umriss(titel), s.bbox),
      );
      expect(andere).toEqual([]);
      expect(laeufeMit(info, KLASSIFIZIERUNG)).toEqual([]);
    }
  });

  it('[R-10-11] Einheit normal rechts im Kopf, rechte Kante = K nach B-Kp-25', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const e = einheitImKopf(info, b, KVK_EINHEIT);
    const [abstand] = bkpZahlen(
      'B-Kp-25',
      'sollwert',
      new RegExp(`^rechte Textkante = Rahmen rechts − (${ZAHL})$`),
    );
    const [tol] = bkpZahlen('B-Kp-25', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    expect(nahe(rechteKante(e), b.rechts - (abstand as number), tol as number)).toBe(true);
    expect(umriss(e).x).toBeGreaterThan(b.rahmen.x + b.rahmen.w / 2);
  });

  it('[R-10-11] (V-02e-9) Einheit mit 200 Zeichen: im Kopf in Mindestgrösse, endet mit «…», Ereignis ellipsis in Region header', async () => {
    const lang = 'Einheit '.repeat(25).slice(0, 200);
    const { info, layout } = await seitePdf(
      'kopf-einheit-lang',
      { ...kvk(), unit: lang },
      KVK_WOCHE,
    );
    const b = bereiche(info);
    const kandidaten = info.texts.filter(
      (t) =>
        t.page === 1 &&
        !t.bold &&
        t.text.endsWith('…') &&
        umriss(t).y + umriss(t).h <= b.yK + 0.01 &&
        lang.startsWith(t.text.slice(0, -1).trimEnd()),
    );
    expect(kandidaten.length).toBe(1);
    expect(nahe((kandidaten[0] as PdfTextRun).sizePt, kpTemplate().fontSizes.min, 0.01)).toBe(true);
    expect(layout.fallbacks).toContainEqual(
      expect.objectContaining({
        kind: 'ellipsis',
        region: 'header',
        field: 'unit',
        entryId: null,
        piece: null,
      }),
    );
  });

  it('[R-10-12][R-4.9-07] «Stand» und «17.09.2026» fett in Schwarz (B-Kp-26, -99), gleiche Grundlinie, rechte Kante des Datums = K (V21)', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const stand = einLauf(info, 'Stand', 1);
    const datum = einLauf(info, '17.09.2026', 1);
    const e = einheitImKopf(info, b, KVK_EINHEIT);
    for (const t of [stand, datum]) {
      expect(t.bold).toBe(true);
      expect(t.color).toEqual(farbeAus('B-Kp-99'));
    }
    expect(nahe(stand.baselineY, datum.baselineY, 0.01)).toBe(true);
    expect(nahe(rechteKante(datum), rechteKante(e), 0.01)).toBe(true);
    expect(stand.x).toBeLessThan(datum.x);
  });

  it('[R-10-12] standOverride → dessen Datum; ohne Stand «Entwurf» (V-02e-5)', async () => {
    const ueber = await seitePdf(
      'kopf-stand-override',
      kvk(),
      KVK_WOCHE,
      optionen({ standOverride: { date: '2026-10-01', version: 4 } }),
    );
    einLauf(ueber.info, '01.10.2026', 1, bereichsRechtecke(bereiche(ueber.info)).stand);
    expect(laeufeMit(ueber.info, '17.09.2026')).toEqual([]);
    const ohne = await seitePdf('kopf-stand-entwurf', { ...kvk(), stand: null }, KVK_WOCHE);
    const b = bereiche(ohne.info);
    const entwurf = einLauf(ohne.info, 'Entwurf', 1);
    expect(entwurf.bold).toBe(true);
    expect(umriss(entwurf).y + umriss(entwurf).h).toBeLessThanOrEqual(b.yK + 0.01);
    expect(umriss(entwurf).x).toBeGreaterThanOrEqual(b.xS - 0.01);
    einLauf(ohne.info, 'Stand', 1);
  });

  it('[R-4.9-07] Farbe des Stands = standColor der Vorlage: Kp schwarz; fiktive Vorlage mit Rot → «Stand» und Datum rot', async () => {
    const rot = { r: 200, g: 30, b: 30 };
    const t = { ...kpTemplate(), standColor: rot };
    const templates = new Map([...builtInTemplates(), [t.id, t]]);
    const { info } = await seitePdf('kopf-stand-farbe', kvk(), KVK_WOCHE, optionen({ templates }));
    expect(einLauf(info, 'Stand', 1).color).toEqual(rot);
    expect(einLauf(info, '17.09.2026', 1).color).toEqual(rot);
    expect(einLauf(info, KVK_TITEL, 1).color).toEqual({ r: 0, g: 0, b: 0 });
  });
});

describe('Mindestgrösse (R-10-38)', () => {
  it('[R-10-38] KVK und KVK+: kein Textlauf unter 4,5 pt', async () => {
    for (const p of [await kvkPdf(), await plusPdf()]) {
      expect(minFontSize(p.info)).toBeGreaterThanOrEqual(mindestgroesse());
      expect(p.info.texts.length).toBeGreaterThan(100);
    }
  });
});
