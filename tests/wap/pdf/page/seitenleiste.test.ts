// @vitest-environment jsdom
// Paket E1-02e: Seitenleiste im PDF (R-4.1-07, R-4.2-06, R-4.6-31, R-4.7-05, R-4.7-15, R-4.9-09, R-10-21 bis
// R-10-26, R-15-04, R-15-08, R-10-38; Vertrag E1-02e Notiz «Ausarbeitung Schritt 2» E4, H1, J; Gate 0 B-F-05;
// V-02e-4, -7, -8, -12, -14). Nur readPdf; Sollwerte aus anhang-b-kp.csv. Pseudonymisierte KVK-Fixture, KVK+ und
// fiktive Varianten.
import { describe, expect, it } from 'vitest';
import { abbreviationsForWeek } from '../../../../src/model/wap/derive/abbreviations';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { Plan, Rgb } from '../../../../src/model/wap/types';
import { rapport } from '../../support/model/builders';
import { analysiere } from '../../support/page/analyse';
import { ZAHL } from '../../support/page/bkp';
import {
  ausHex,
  type Bereiche,
  bereiche,
  type Flaeche,
  flaechen,
  gleicheFarbe,
  innerhalb,
  laeufe,
  mitte,
  nahe,
  norm,
  schneidet,
  striche,
  umriss,
} from '../../support/page/pdf-seite';
import { einmal, seitePdf } from '../../support/page/seite';
import { bkp, bkpZahlen, form, mindestgroesse } from '../../support/page/stile';
import {
  BEREITSCHAFT,
  KVK_PLUS_NEUTRAL,
  KVK_WOCHE,
  kvk,
  kvkPlus,
  MI,
  mitEintraegen,
  mitWoche,
  NUMMER_BEMERKUNG,
  woche,
} from '../../support/page/varianten';
import { base64, pngEinfarbig, pngIhdrGebrochen } from '../../support/page/wappen';
import { minFontSize } from '../../support/pdf/checks';
import type { PdfInfo, PdfStroke, PdfTextRun, Rect } from '../../support/pdf/read';

const kvkPdf = einmal(() => seitePdf('leiste-kvk', kvk(), KVK_WOCHE));
const plusPdf = einmal(() => seitePdf('leiste-kvk-plus', kvkPlus(), KVK_WOCHE));

function oben(b: Bereiche): Rect {
  return { x: b.xS, y: b.yK, w: b.rechts - b.xS, h: b.yTo - b.yK };
}
function unten(b: Bereiche): Rect {
  return { x: b.xSa, y: b.yTo, w: b.rechts - b.xSa, h: b.yU - b.yTo };
}

/** Läufe, deren Umriss im Rechteck liegt. */
function laeufeIm(info: PdfInfo, r: Rect): PdfTextRun[] {
  return laeufe(info).filter((t) => innerhalb(umriss(t), r, 0.01));
}

function einzig(ls: PdfTextRun[], text: string): PdfTextRun {
  const l = ls.filter((t) => t.text.trim() === text);
  expect(l.length, `genau ein Lauf «${text}» in der Seitenleiste`).toBe(1);
  return l[0] as PdfTextRun;
}

function unterkante(r: Rect): number {
  return r.y + r.h;
}

/** Erwartete Hex-Farbe einer B-Kp-Zeile (Sollwert «#RRGGBB»). */
function hexAus(id: string): Rgb {
  const z = bkp(id);
  return ausHex((form(id, 'Sollwert', z.sollwert, /^(#[0-9A-F]{6})$/)[1] ?? '').trim());
}

/** Legendenzeilen: Farbfeld in der Kürzelspalte (Breite a) und Beschriftung rechts davon in derselben Zeile. */
function legendenZeilen(info: PdfInfo, b: Bereiche): { feld: Flaeche; text: PdfTextRun | null }[] {
  const felder = flaechen(info)
    .filter(
      (f) =>
        innerhalb(f.rect, oben(b), 0.01) && nahe(f.rect.x, b.xS, 0.5) && nahe(f.rect.w, b.a, 0.5),
    )
    .sort((p, q) => p.rect.y - q.rect.y);
  const ls = laeufeIm(info, oben(b));
  return felder.map((feld) => {
    const t = ls.filter((r) => {
      const m = mitte(umriss(r));
      return (
        r.x >= feld.rect.x + feld.rect.w - 0.01 &&
        m.y > feld.rect.y &&
        m.y < feld.rect.y + feld.rect.h
      );
    });
    return { feld, text: t.length === 1 ? (t[0] as PdfTextRun) : null };
  });
}

describe('Unterschriftblock (R-4.1-07, R-10-25)', () => {
  it('[R-4.1-07] nameOrder «gradVornameName» → «Hptm Max Muster C», «gradNameVorname» → «Hptm Muster C Max»; leere Teile entfallen', async () => {
    const p = kvk();
    const faelle: [string, Plan, string][] = [
      ['leiste-name-vorname', p, 'Hptm Max Muster C'],
      [
        'leiste-name-name',
        { ...p, commander: { ...p.commander, nameOrder: 'gradNameVorname' } },
        'Hptm Muster C Max',
      ],
      [
        'leiste-name-ohne-vorname',
        { ...p, commander: { ...p.commander, vorname: '' } },
        'Hptm Muster C',
      ],
    ];
    for (const [fall, plan, name] of faelle) {
      const { info } = await seitePdf(fall, plan, KVK_WOCHE);
      const b = bereiche(info);
      einzig(laeufeIm(info, unten(b)), name);
    }
  });

  it('[R-10-25] Einheit, Name und Funktion in dieser Reihenfolge im unteren Teil der Seitenleiste, normal', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const ls = laeufeIm(info, unten(b));
    const e = einzig(ls, 'Inf Ustü Kp 61/4');
    const n = einzig(ls, 'Hptm Max Muster C');
    const f = einzig(ls, 'Kommandant');
    expect(e.baselineY).toBeLessThan(n.baselineY);
    expect(n.baselineY).toBeLessThan(f.baselineY);
    expect([e, n, f].every((t) => !t.bold)).toBe(true);
  });
});

describe('Erhöhte Bereitschaft (R-4.2-06, R-10-22; V-02e-7)', () => {
  it('[R-4.2-06] leer (KVK): keine graue Fläche über die Seitenleistenbreite, kein Bereitschaftstext', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const grau = hexAus('B-Kp-98');
    const breite = flaechen(info).filter(
      (f) => gleicheFarbe(f.fill, grau) && innerhalb(f.rect, oben(b), 0.01) && f.rect.w > b.a + 1,
    );
    expect(breite).toEqual([]);
    expect(laeufe(info).filter((t) => t.text.includes(BEREITSCHAFT))).toEqual([]);
  });

  it('[R-4.2-06][R-10-22] «Zug 1 in Bereitschaft» (KVK+): Fläche in der Farbe nach B-Kp-98 über die volle Seitenleistenbreite, Text fett darin', async () => {
    const { info } = await plusPdf();
    const b = bereiche(info);
    const grau = hexAus('B-Kp-98');
    const f = flaechen(info).filter(
      (x) => gleicheFarbe(x.fill, grau) && innerhalb(x.rect, oben(b), 0.01) && x.rect.w > b.a + 1,
    );
    expect(f.length).toBe(1);
    const r = (f[0] as Flaeche).rect;
    expect(nahe(r.x, b.xS, 0.01)).toBe(true);
    expect(nahe(r.x + r.w, b.rechts, 0.01)).toBe(true);
    const t = einzig(laeufeIm(info, r), BEREITSCHAFT);
    expect(t.bold).toBe(true);
  });
});

describe('Bemerkungen (R-4.6-31, R-10-23; V-02e-14)', () => {
  it('[R-10-23] Läufe «Nr» und «Was» fett unter «Bemerkungen» in der Seitenleiste; «Nr» in der Nr-Spalte (Breite a)', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const ls = laeufeIm(info, oben(b));
    const titel = einzig(ls, 'Bemerkungen');
    const nr = einzig(ls, 'Nr');
    const was = einzig(ls, 'Was');
    for (const t of [titel, nr, was]) expect(t.bold).toBe(true);
    expect(nr.baselineY).toBeGreaterThan(titel.baselineY);
    expect(nahe(nr.baselineY, was.baselineY, 0.01)).toBe(true);
    expect(umriss(nr).x + umriss(nr).w).toBeLessThanOrEqual(b.xS + b.a + 0.01);
    expect(was.x).toBeGreaterThanOrEqual(b.xS + b.a - 0.01);
  });

  it('[R-4.6-31] Bemerkung Nr 2 (Woche, KVK+): Lauf «2» in der Nr-Spalte, Text in der Was-Spalte unter «Bemerkungen»; Bemerkungen ohne Nummer mit leerer Nr-Zelle', async () => {
    const { info } = await plusPdf();
    const b = bereiche(info);
    const ls = laeufeIm(info, oben(b));
    const titel = einzig(ls, 'Bemerkungen');
    const kopf = einzig(ls, 'Nr');
    const legende = einzig(ls, 'Legende');
    const nrSpalte = ls.filter(
      (t) =>
        umriss(t).x + umriss(t).w <= b.xS + b.a + 0.01 &&
        t.baselineY > kopf.baselineY + 0.01 &&
        t.baselineY < legende.baselineY,
    );
    expect(nrSpalte.map((t) => t.text.trim())).toEqual([String(NUMMER_BEMERKUNG.nummer)]);
    const zwei = nrSpalte[0] as PdfTextRun;
    expect(zwei.baselineY).toBeGreaterThan(titel.baselineY);
    const textZeile = ls.filter((t) => nahe(t.baselineY, zwei.baselineY, 0.01) && t !== zwei);
    expect(norm(textZeile.map((t) => t.text).join(''))).not.toBe('');
    expect(
      norm(NUMMER_BEMERKUNG.text).startsWith(norm(textZeile.map((t) => t.text).join(''))),
    ).toBe(true);
    for (const t of textZeile) expect(t.x).toBeGreaterThanOrEqual(b.xS + b.a - 0.01);
    // Die übrigen Bemerkungen der Woche (ohne Nummer) stehen ebenfalls in der Was-Spalte.
    const sichtbar = remarksForWeek(kvkPlus(), KVK_WOCHE);
    expect(sichtbar.length).toBe(4);
    const alles = norm(
      ls
        .filter((t) => t.x >= b.xS + b.a - 0.01)
        .map((t) => t.text)
        .join(''),
    );
    for (const r of sichtbar) expect(alles).toContain(norm(r.text));
  });
});

describe('Kürzelliste und Legende (R-4.7-05, R-4.7-15, R-4.9-09, R-10-24, R-15-04)', () => {
  it('[R-4.7-15] KVK: Kürzel in der Reihenfolge von abbreviationsForWeek, fett in der Kürzelspalte; das unbenutzte «ARK» fehlt', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const ls = laeufeIm(info, oben(b));
    const titel = einzig(ls, 'Legende');
    const ersteFarbe = legendenZeilen(info, b)[0];
    expect(ersteFarbe).toBeDefined();
    const kuerzel = ls
      .filter(
        (t) =>
          t.baselineY > titel.baselineY + 0.01 &&
          umriss(t).y + umriss(t).h <= (ersteFarbe?.feld.rect.y ?? 0) + 0.01 &&
          umriss(t).x + umriss(t).w <= b.xS + b.a + 0.01,
      )
      .sort((p, q) => p.baselineY - q.baselineY);
    const erwartet = abbreviationsForWeek(kvk(), KVK_WOCHE);
    expect(erwartet).not.toContain('ARK');
    expect(erwartet.length).toBeGreaterThan(0);
    expect(kuerzel.map((t) => t.text.trim())).toEqual([...erwartet]);
    expect(kuerzel.every((t) => t.bold)).toBe(true);
    expect(ls.filter((t) => t.text.trim() === 'ARK')).toEqual([]);
  });

  it('[R-4.7-15] Gegenprobe: mit einem Rapport «ARK» in der Woche steht «ARK» in der Kürzelliste', async () => {
    const plan = mitEintraegen(kvk(), [
      rapport('e120', 120, {
        date: MI,
        code: 'ARK',
        time: { form: 'range', from: 1080, to: 1110 },
      }),
    ]);
    const { info } = await seitePdf('leiste-ark', plan, KVK_WOCHE);
    const b = bereiche(info);
    expect(abbreviationsForWeek(plan, KVK_WOCHE)).toContain('ARK');
    const ark = laeufeIm(info, oben(b)).filter((t) => t.text.trim() === 'ARK');
    expect(ark.length).toBe(1);
    expect(umriss(ark[0] as PdfTextRun).x + umriss(ark[0] as PdfTextRun).w).toBeLessThanOrEqual(
      b.xS + b.a + 0.01,
    );
  });

  it('[R-4.9-09] Lauf «Legende» fett über der ersten Kürzelzeile', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const ls = laeufeIm(info, oben(b));
    const titel = einzig(ls, 'Legende');
    expect(titel.bold).toBe(true);
    const erstes = abbreviationsForWeek(kvk(), KVK_WOCHE)[0] ?? '';
    const k = ls.filter((t) => t.text.trim() === erstes && t.bold);
    expect(k.length).toBeGreaterThan(0);
    expect(umriss(titel).y + umriss(titel).h).toBeLessThanOrEqual(
      Math.min(...k.map((t) => umriss(t).y)) + 0.01,
    );
  });

  it('[R-4.7-05] neuer Plan aus kpTemplate(): 5 Legendenzeilen «Leitung Bat», «Leitung Kp», «Leitung Zfhr», «Extern», «Ltg S2»; Farbfelder = B-Kp-92 bis -96 exakt', async () => {
    const plan = createPlanFromTemplate(kpTemplate(), {
      planId: 'plan-neu',
      startDate: '2026-09-28',
      weekCount: 1,
    });
    const w = plan.weeks[0];
    const { info } = await seitePdf('leiste-neuer-plan', plan, w?.id ?? '');
    expect(w).toBeDefined();
    const b = bereiche(info);
    const z = legendenZeilen(info, b);
    expect(z.map((x) => x.text?.text.trim())).toEqual([
      'Leitung Bat',
      'Leitung Kp',
      'Leitung Zfhr',
      'Extern',
      'Ltg S2',
    ]);
    const farben = ['B-Kp-92', 'B-Kp-93', 'B-Kp-94', 'B-Kp-95', 'B-Kp-96'].map(hexAus);
    z.forEach((x, i) => {
      expect(x.feld.fill, `Farbfeld ${i + 1}`).toEqual(farben[i]);
    });
    expect(z.every((x) => x.text !== null && !x.text.bold)).toBe(true);
  });

  it('[R-4.7-05] geänderte Legendenbeschriftung «Bataillon» erscheint statt «Leitung Bat»; der Kategoriename «Ltg Bat» bleibt und erscheint nicht in der Legende', async () => {
    const plan = createPlanFromTemplate(kpTemplate(), {
      planId: 'plan-neu',
      startDate: '2026-09-28',
      weekCount: 1,
    });
    const geaendert: Plan = {
      ...plan,
      legend: plan.legend.map((c, i) => (i === 0 ? { ...c, legendLabel: 'Bataillon' } : c)),
    };
    const { info } = await seitePdf('leiste-legende-bataillon', geaendert, plan.weeks[0]?.id ?? '');
    expect(geaendert.legend[0]?.name).toBe('Ltg Bat');
    const b = bereiche(info);
    const z = legendenZeilen(info, b);
    expect(z.map((x) => x.text?.text.trim())).toEqual([
      'Bataillon',
      'Leitung Kp',
      'Leitung Zfhr',
      'Extern',
      'Ltg S2',
    ]);
    expect(
      laeufe(info).filter((t) => t.text.trim() === 'Leitung Bat' || t.text.trim() === 'Ltg Bat'),
    ).toEqual([]);
  });

  it('[R-10-24] je Legendenkategorie (inLegend, nicht neutral) ein Farbfeld in ihrer Farbe und rechts davon ihre Legendenbeschriftung', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const plan = kvk();
    const kat = plan.legend.filter((c) => c.inLegend && !c.neutral);
    const z = legendenZeilen(info, b);
    expect(z.length).toBe(kat.length);
    kat.forEach((c, i) => {
      const zeile = z[i];
      expect(zeile?.feld.fill).toEqual(c.color);
      expect(zeile?.text?.text.trim()).toBe(c.legendLabel);
    });
  });

  it('[R-15-04] neutrale Kategorie mit inLegend true erscheint nicht in der Legende; ein Block mit neutraler Füllung ist im Raster', async () => {
    const p = kvkPlus();
    const plan: Plan = {
      ...p,
      legend: p.legend.map((c) => (c.neutral ? { ...c, inLegend: true } : c)),
    };
    const { info } = await seitePdf('leiste-neutral', plan, KVK_WOCHE);
    const an = analysiere(info, plan, KVK_WOCHE);
    const b = an.b;
    const neutral = plan.legend.find((c) => c.neutral);
    expect(neutral).toBeDefined();
    const z = legendenZeilen(info, b);
    expect(z.length).toBe(5);
    expect(z.some((x) => gleicheFarbe(x.feld.fill, neutral?.color ?? null))).toBe(false);
    expect(laeufeIm(info, oben(b)).filter((t) => t.text.trim() === neutral?.legendLabel)).toEqual(
      [],
    );
    const weiss = an.inhalt.eintraege.filter(
      (e) => e.klasse === 'block' && gleicheFarbe(e.flaeche.fill, neutral?.color ?? null),
    );
    expect(weiss.length).toBeGreaterThan(0);
    expect(laeufe(info).some((t) => t.text.trim() === KVK_PLUS_NEUTRAL.titel)).toBe(true);
  });
});

describe('Reihenfolge und Wappen (R-10-21; V-02e-12)', () => {
  it('[R-10-21] KVK+: Unterkanten streng steigend: Wochenziele, Bereitschaft, Bemerkungen, Kürzelliste, Legende, Unterschriftblock, Wappen, Motto, Sonnenzeiten', async () => {
    const { info } = await plusPdf();
    const plan = kvkPlus();
    const b = bereiche(info);
    const ls = laeufe(info);
    const imOben = laeufeIm(info, oben(b));
    const ziele = norm(
      woche(plan)
        .weekGoals.map((g) => g.text)
        .join(''),
    );
    const bem = norm(
      remarksForWeek(plan, KVK_WOCHE)
        .map((r) => r.text)
        .join(''),
    );
    const ausschliesslich = (inhalt: string, anders: string) =>
      imOben.filter((t) => {
        const n = norm(t.text);
        return n.length >= 3 && inhalt.includes(n) && !anders.includes(n);
      });
    const zielLaeufe = ausschliesslich(ziele, bem);
    const bemLaeufe = ausschliesslich(bem, ziele);
    expect(zielLaeufe.length).toBeGreaterThan(0);
    expect(bemLaeufe.length).toBeGreaterThan(0);
    const grau = hexAus('B-Kp-98');
    const bereit = flaechen(info).filter(
      (f) => gleicheFarbe(f.fill, grau) && innerhalb(f.rect, oben(b), 0.01) && f.rect.w > b.a + 1,
    );
    expect(bereit.length).toBe(1);
    const legende = legendenZeilen(info, b);
    const kuerzel = abbreviationsForWeek(plan, KVK_WOCHE);
    const kuerzelLaeufe = imOben.filter(
      (t) =>
        kuerzel.includes(t.text.trim()) && t.bold && umriss(t).x + umriss(t).w <= b.xS + b.a + 0.01,
    );
    expect(kuerzelLaeufe.length).toBe(kuerzel.length);
    const imUnten = laeufeIm(info, unten(b));
    const unterschrift = ['Inf Ustü Kp 61/4', 'Hptm Max Muster C', 'Kommandant'].map((t) =>
      einzig(imUnten, t),
    );
    expect(info.imagePlacements.length).toBe(1);
    const wappen = (info.imagePlacements[0] as (typeof info.imagePlacements)[number]).bbox;
    const motto = einzig(imUnten, plan.motto);
    const sonne = ['0735', '1645'].map((t) => einzig(imUnten, t));
    const max = (rs: Rect[]) => Math.max(...rs.map(unterkante));
    const kanten = [
      max(zielLaeufe.map(umriss)),
      unterkante((bereit[0] as Flaeche).rect),
      max(bemLaeufe.map(umriss)),
      max(kuerzelLaeufe.map(umriss)),
      max(legende.map((z) => z.feld.rect)),
      max(unterschrift.map(umriss)),
      unterkante(wappen),
      unterkante(umriss(motto)),
      max(sonne.map(umriss)),
    ];
    kanten.forEach((k, i) => {
      if (i > 0)
        expect(k, `Abschnitt ${i + 1} unter Abschnitt ${i}`).toBeGreaterThan(
          kanten[i - 1] as number,
        );
    });
    expect(ls.length).toBeGreaterThan(0);
  });

  it('[R-10-21] (V-02e-12) Wappen über imagePlacements nach B-Kp-82: Breite 3,94 h, Höhe 3,87 h, Oberkante 3,4 pt unter der Grundlinie der Funktion (± 0,1 h), unter dem Unterschriftblock', async () => {
    const { info } = await plusPdf();
    const an = analysiere(info, kvkPlus(), KVK_WOCHE);
    const h = an.bandHoehe;
    const [bw, bh, abstand] = bkpZahlen(
      'B-Kp-82',
      'sollwert',
      new RegExp(
        `^Breite (${ZAHL}) × h; Höhe (${ZAHL}) × h; Oberkante (${ZAHL}) pt unter Grundlinie Funktion$`,
      ),
    );
    const [tol] = bkpZahlen('B-Kp-82', 'toleranz', new RegExp(`^±(${ZAHL}) h$`));
    const w = (info.imagePlacements[0] as (typeof info.imagePlacements)[number]).bbox;
    const funktion = einzig(laeufeIm(info, unten(an.b)), 'Kommandant');
    expect(nahe(w.w, (bw as number) * h, (tol as number) * h)).toBe(true);
    expect(nahe(w.h, (bh as number) * h, (tol as number) * h)).toBe(true);
    expect(nahe(w.y, funktion.baselineY + (abstand as number), (tol as number) * h)).toBe(true);
    expect(innerhalb(w, unten(an.b), 0.01)).toBe(true);
  });
});

describe('Wappen mit abweichendem Seitenverhältnis und Motto ohne Wappen (R-10-21; E4, V-02e-12)', () => {
  /** KVK+ mit anderem Wappen-PNG bzw. ohne Wappen (fiktiv einfarbig). */
  function mitWappen(png: Uint8Array | null): Plan {
    return {
      ...kvkPlus(),
      coatOfArms: png === null ? null : { mime: 'image/png', dataBase64: base64(png) },
    };
  }
  const breitPdf = einmal(() =>
    seitePdf('leiste-wappen-breit', mitWappen(pngEinfarbig(200, 100)), KVK_WOCHE),
  );
  const hochPdf = einmal(() =>
    seitePdf('leiste-wappen-hoch', mitWappen(pngEinfarbig(100, 300)), KVK_WOCHE),
  );
  const ohnePdf = einmal(() => seitePdf('leiste-wappen-ohne', mitWappen(null), KVK_WOCHE));

  /** Kasten nach B-Kp-82 (Breite, Höhe, Oberkante aus der CSV) und waagrechte Mitte aus KVK+ (Bild im Kastenverhältnis). */
  async function kasten(info: PdfInfo): Promise<{ r: Rect; tol: number; mitteX: number }> {
    const an = analysiere(info, kvkPlus(), KVK_WOCHE);
    const h = an.bandHoehe;
    const [bw, bh, abstand] = bkpZahlen(
      'B-Kp-82',
      'sollwert',
      new RegExp(
        `^Breite (${ZAHL}) × h; Höhe (${ZAHL}) × h; Oberkante (${ZAHL}) pt unter Grundlinie Funktion$`,
      ),
    );
    const [tol] = bkpZahlen('B-Kp-82', 'toleranz', new RegExp(`^±(${ZAHL}) h$`));
    const funktion = einzig(laeufeIm(info, unten(an.b)), 'Kommandant');
    const normal = (await plusPdf()).info;
    expect(normal.imagePlacements.length).toBe(1);
    const nb = (normal.imagePlacements[0] as (typeof normal.imagePlacements)[number]).bbox;
    return {
      r: {
        x: nb.x + nb.w / 2 - ((bw as number) * h) / 2,
        y: funktion.baselineY + (abstand as number),
        w: (bw as number) * h,
        h: (bh as number) * h,
      },
      tol: (tol as number) * h,
      mitteX: nb.x + nb.w / 2,
    };
  }

  /** Motto: einzig, normal, waagrecht auf `mitteX` zentriert (Toleranz B-Kp-83). */
  function mottoPruefen(info: PdfInfo, b: Bereiche, mitteX: number): PdfTextRun {
    const m = einzig(laeufeIm(info, unten(b)), kvkPlus().motto);
    const [tol] = bkpZahlen('B-Kp-83', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    expect(m.bold).toBe(false);
    expect(nahe(mitte(umriss(m)).x, mitteX, tol as number), 'Motto waagrecht zentriert').toBe(true);
    return m;
  }

  it('[R-10-21] (E4) breites Wappen 200 × 100: volle Kastenbreite, Höhe halb so gross, oben bündig, waagrecht zentriert; Motto auf die Wappenmitte, Grundlinie nach B-Kp-83', async () => {
    const { info } = await breitPdf();
    const k = await kasten(info);
    expect(info.imagePlacements.length).toBe(1);
    const w = (info.imagePlacements[0] as (typeof info.imagePlacements)[number]).bbox;
    expect(nahe(w.w, k.r.w, k.tol), 'Breite = Kastenbreite').toBe(true);
    expect(nahe(w.h, w.w / 2, 0.01), 'Seitenverhältnis 2 : 1').toBe(true);
    expect(w.h).toBeLessThan(k.r.h - k.tol);
    expect(nahe(w.y, k.r.y, k.tol), 'oben bündig').toBe(true);
    expect(nahe(w.x + w.w / 2, k.mitteX, k.tol), 'waagrecht zentriert').toBe(true);
    const m = mottoPruefen(info, analysiere(info, kvkPlus(), KVK_WOCHE).b, w.x + w.w / 2);
    const [abstand] = bkpZahlen(
      'B-Kp-83',
      'sollwert',
      new RegExp(`^Mitte = Wappenmitte; Grundlinie (${ZAHL}) pt unter Wappen$`),
    );
    const [tol] = bkpZahlen('B-Kp-83', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    expect(
      nahe(m.baselineY, w.y + w.h + (abstand as number), tol as number),
      'Grundlinie Motto',
    ).toBe(true);
  });

  it('[R-10-21] (E4) hohes Wappen 100 × 300: volle Kastenhöhe, Breite ein Drittel davon, oben bündig, waagrecht im Kasten zentriert', async () => {
    const { info } = await hochPdf();
    const k = await kasten(info);
    expect(info.imagePlacements.length).toBe(1);
    const w = (info.imagePlacements[0] as (typeof info.imagePlacements)[number]).bbox;
    expect(nahe(w.h, k.r.h, k.tol), 'Höhe = Kastenhöhe').toBe(true);
    expect(nahe(w.w, w.h / 3, 0.01), 'Seitenverhältnis 1 : 3').toBe(true);
    expect(w.w).toBeLessThan(k.r.w - k.tol);
    expect(nahe(w.y, k.r.y, k.tol), 'oben bündig').toBe(true);
    expect(nahe(w.x + w.w / 2, k.mitteX, k.tol), 'waagrecht zentriert').toBe(true);
    expect(nahe(w.x + w.w / 2, k.r.x + k.r.w / 2, k.tol)).toBe(true);
  });

  /** S3-17: Motto ohne Bild auf der Kastenmitte, Grundlinie = Kastenunterkante + Abstand B-Kp-83; keine Überlappung. */
  async function ohneBildPruefen(info: PdfInfo): Promise<void> {
    expect(info.imagePlacements).toEqual([]);
    const k = await kasten(info);
    const an = analysiere(info, kvkPlus(), KVK_WOCHE);
    const m = mottoPruefen(info, an.b, k.mitteX);
    const [abstand] = bkpZahlen(
      'B-Kp-83',
      'sollwert',
      new RegExp(`^Mitte = Wappenmitte; Grundlinie (${ZAHL}) pt unter Wappen$`),
    );
    const [tol] = bkpZahlen('B-Kp-83', 'toleranz', new RegExp(`^±(${ZAHL}) pt$`));
    expect(
      nahe(m.baselineY, k.r.y + k.r.h + (abstand as number), tol as number),
      'Grundlinie Motto = Kastenunterkante + Abstand',
    ).toBe(true);
    expect(innerhalb(umriss(m), unten(an.b), 0.01)).toBe(true);
    const mu = umriss(m);
    const andere = laeufe(info).filter(
      (t) => t.page === m.page && t.order !== m.order && t.text.trim() !== '',
    );
    for (const t of andere)
      expect(schneidet(mu, umriss(t)), `Motto überlappt «${t.text.trim()}»`).toBe(false);
  }

  it('[R-10-21] (E4, S3-17) ohne Wappen: kein Bild, Motto einzeilig auf die Kastenmitte zentriert, Grundlinie = Kastenunterkante nach B-Kp-82 + Abstand nach B-Kp-83, überlappt keinen anderen Text', async () => {
    const { info } = await ohnePdf();
    await ohneBildPruefen(info);
  });

  it('[R-10-21] (E4, S3-17) unlesbares Wappen (invalidImage): kein Bild, Motto wie ohne Wappen', async () => {
    const { info } = await seitePdf(
      'leiste-wappen-unlesbar',
      mitWappen(pngIhdrGebrochen()),
      KVK_WOCHE,
    );
    await ohneBildPruefen(info);
  });
});

describe('Sonnenzeiten (R-10-26, R-15-08; V-02e-8)', () => {
  function sonnenSymbole(info: PdfInfo, b: Bereiche) {
    return striche(info)
      .filter((s) => s.kind === 'path' && s.fill !== null && innerhalb(s.bbox, unten(b), 0.01))
      .sort((p, q) => p.bbox.y - q.bbox.y);
  }

  it('[R-10-26] zwei Zeilen: je ein gefülltes Symbol links und «0735» bzw. «1645» rechtsbündig; ohne Wert «–»', async () => {
    const { info } = await kvkPdf();
    const b = bereiche(info);
    const sym = sonnenSymbole(info, b);
    expect(sym.length).toBe(2);
    const imUnten = laeufeIm(info, unten(b));
    const werte = ['0735', '1645'].map((t) => einzig(imUnten, t));
    werte.forEach((t, i) => {
      const s = sym[i] as PdfStroke;
      expect(s.bbox.x + s.bbox.w).toBeLessThanOrEqual(t.x + 0.01);
      const m = mitte(umriss(t)).y;
      expect(m).toBeGreaterThan(s.bbox.y - 2);
      expect(m).toBeLessThan(s.bbox.y + s.bbox.h + 2);
      expect(t.bold).toBe(false);
    });
    expect(
      nahe(
        (werte[0] as PdfTextRun).x + (werte[0] as PdfTextRun).width,
        (werte[1] as PdfTextRun).x + (werte[1] as PdfTextRun).width,
        0.01,
      ),
    ).toBe(true);
    const ohne = mitWoche(kvk(), KVK_WOCHE, { sunOverride: { sunrise: null, sunset: 1005 } });
    const v = await seitePdf('leiste-sonne-ohne', ohne, KVK_WOCHE);
    const vb = bereiche(v.info);
    const vu = laeufeIm(v.info, unten(vb));
    einzig(vu, '–');
    einzig(vu, '1645');
    expect(vu.filter((t) => t.text.trim() === '0735')).toEqual([]);
  });

  it('[R-15-08] zwei Pläne mit anderen sunOverride: Lage der Tabelle und Pfade der Symbole gleich, nur die Werte verschieden', async () => {
    const a = await kvkPdf();
    const andere = mitWoche(kvk(), KVK_WOCHE, { sunOverride: { sunrise: 380, sunset: 1210 } });
    const z = await seitePdf('leiste-sonne-andere', andere, KVK_WOCHE);
    const ba = bereiche(a.info);
    const bz = bereiche(z.info);
    const tabelle = (info: PdfInfo, b: Bereiche) =>
      striche(info)
        .filter((s) => innerhalb(s.bbox, unten(b), 0.01) && s.widthPt > 0 && s.widthPt < 0.4)
        .map((s) => s.bbox);
    expect(tabelle(z.info, bz)).toEqual(tabelle(a.info, ba));
    expect(sonnenSymbole(z.info, bz).map((s) => s.bbox)).toEqual(
      sonnenSymbole(a.info, ba).map((s) => s.bbox),
    );
    const wa = ['0735', '1645'].map((t) => einzig(laeufeIm(a.info, unten(ba)), t));
    const wz = ['0620', '2010'].map((t) => einzig(laeufeIm(z.info, unten(bz)), t));
    wa.forEach((t, i) => {
      const u = wz[i] as PdfTextRun;
      expect(nahe(t.x + t.width, u.x + u.width, 0.01)).toBe(true);
      expect(nahe(t.baselineY, u.baselineY, 0.01)).toBe(true);
    });
  });
});

describe('Mindestgrösse (R-10-38)', () => {
  it('[R-10-38] KVK und KVK+: kein Textlauf unter 4,5 pt', async () => {
    for (const p of [await kvkPdf(), await plusPdf()])
      expect(minFontSize(p.info)).toBeGreaterThanOrEqual(mindestgroesse());
  });
});
