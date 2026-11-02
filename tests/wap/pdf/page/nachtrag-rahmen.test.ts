// @vitest-environment jsdom
// Paket E1-02k: Gate-S-Auflagen A3 (dünner Rapportrahmen, R-10-50) und A4 (Seitenleiste nach der Referenz,
// R-10-51, R-10-52) sowie die Bedeutungsspalte der Kürzelliste (R-10-53) im PDF; Pflichtfälle P1 bis P18 nach
// Vertrag E1-02k §6a (Abschnitte 1, 2.2, 2.3, 4; B-Kp-58, -77, -78, -113 bis -119). Nur readPdf (H1); das
// Seitenmodell dient nur zum Erzeugen der Bytes, `fallbacks` sind Rückgabewerte (wie seite.test.ts). Sollwerte aus
// anhang-b-kp.csv. Pseudonymisierte KVK-Fixture und fiktive Varianten (tests/wap/support/page/nachtrag-rahmen.ts).
import { describe, expect, it } from 'vitest';
import {
  abbreviationMeaning,
  abbreviationsForWeek,
} from '../../../../src/model/wap/derive/abbreviations';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import type { PageFallbackEvent } from '../../../../src/model/wap/layout/page/types';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import { kpTemplate } from '../../../../src/model/wap/template';
import type { LtgCategory, Plan } from '../../../../src/model/wap/types';
import { dayRemark } from '../../support/model/builders';
import { analysiere, type SeitenAnalyse } from '../../support/page/analyse';
import { ZAHL } from '../../support/page/bkp';
import {
  aufStunde,
  bedeutungDrPlan,
  bedeutungenPlan,
  EREIGNISFOLGE_KUERZEL,
  ereignisfolgePlan,
  erwarteRegelStil,
  INSET,
  kuerzelVerschobenPlan,
  LEERE_BEMERKUNG,
  type LeistenSoll,
  leereBemerkungPlan,
  leistenLauf,
  leistenSoll,
  ohneTabellenzeilenPlan,
  ohneZielePlan,
  P2_KUERZEL,
  P13,
  rapportePlan,
  regeln,
  regelnBei,
  regelUeber,
  regelUnter,
  senkrechteBei,
  stundenLagen,
  stundenPlan,
  stundenVariante,
  zeilenkasten,
  zieleLetzterAbschnittPlan,
  zieleUndBemerkungenPlan,
  zwischenY,
} from '../../support/page/nachtrag-rahmen';
import {
  type Bereiche,
  flaechen,
  fortsetzungsBereiche,
  gleicheFarbe,
  istSenkrecht,
  istWaagrecht,
  laeufe,
  nahe,
  norm,
  passtStil,
  striche,
  umriss,
  type Zeile,
  zeilen,
} from '../../support/page/pdf-seite';
import { einmal, seitePdf } from '../../support/page/seite';
import { bkpZahlen, farbeAus } from '../../support/page/stile';
import {
  KVK_WOCHE,
  kvk,
  kvkPlus,
  langerText,
  MO,
  mitEintraegen,
} from '../../support/page/varianten';
import type { PdfInfo, PdfStroke, PdfTextRun } from '../../support/pdf/read';

const ELLIPSE = String.fromCodePoint(0x2026);

// ---------------------------------------------------------------------------------------------------------
// Auswertung einer Wochenseite (Seite 1) und ihrer Fortsetzungsseiten
// ---------------------------------------------------------------------------------------------------------

interface Leiste {
  readonly plan: Plan;
  readonly info: PdfInfo;
  readonly fallbacks: readonly PageFallbackEvent[];
  readonly an: SeitenAnalyse;
  readonly b: Bereiche;
  readonly soll: LeistenSoll;
  /** Seiteneinheit h aus dem PDF: Rasterhöhe / 20 (B-Kp-12; unabhängig vom Anzeigebereich). */
  readonly h: number;
  /** Titelzeilenhöhe r = 0,5 h (B-Kp-115). */
  readonly r: number;
  /** Abschnittsabstand g = 0,5 h (B-Kp-114). */
  readonly g: number;
  /** Waagrechte Regeln von xS bis zum Rahmen rechts auf Seite 1. */
  readonly rs: readonly PdfStroke[];
  readonly stunden: readonly number[];
}

async function leiste(fall: string, plan: Plan): Promise<Leiste> {
  const { info, layout } = await seitePdf(fall, plan, KVK_WOCHE);
  const an = analysiere(info, plan, KVK_WOCHE);
  const soll = leistenSoll();
  const [raster] = bkpZahlen('B-Kp-12', 'sollwert', new RegExp(`^(${ZAHL}) × h$`));
  const h = (an.b.yTo - an.b.yFrom) / (raster as number);
  return {
    plan,
    info,
    fallbacks: layout.fallbacks,
    an,
    b: an.b,
    soll,
    h,
    r: soll.zeileH * h,
    g: soll.abstandH * h,
    rs: regeln(info, 1, an.b.xS, an.b.rechts, soll.endenTol),
    stunden: stundenLagen(an.skala.stunden),
  };
}

const kvkLeiste = einmal(() => leiste('rahmen-kvk', kvk()));
const plusLeiste = einmal(() => leiste('rahmen-kvk-plus', kvkPlus()));
/** Fiktive Woche ohne Kürzel- und Legendenzeilen (TR-E102k-02), mit Vorbedingung. */
const ohneZeilenLeiste = einmal(async () => {
  const plan = ohneTabellenzeilenPlan();
  expect(abbreviationsForWeek(plan, KVK_WOCHE), 'Vorbedingung: keine Kürzelzeilen').toEqual([]);
  expect(
    plan.legend.filter((c) => c.inLegend && !c.neutral),
    'Vorbedingung: keine Legendenzeilen',
  ).toEqual([]);
  return leiste('rahmen-ohne-tabellenzeilen', plan);
});

/** Höhe-Toleranz der Titelzeilen (± 0,02 h, B-Kp-115). */
const zeilenTol = (L: Leiste) => L.soll.zeileTolH * L.h;

/** Unterkante des Zeilenkastens der letzten Zielzeile zwischen y(from) und `bisY` (null ohne Ziele). */
function zieleUnterkante(L: Leiste, bisY: number, seite = 1, abY = L.b.yFrom): number | null {
  const ls = laeufe(L.info, seite).filter(
    (t) =>
      t.x >= L.b.xS - 0.01 &&
      t.rotation === 0 &&
      t.baselineY > abY + 0.01 &&
      t.baselineY < bisY - 0.01,
  );
  if (ls.length === 0) return null;
  return Math.max(...ls.map((t) => zeilenkasten(t).bottom));
}

/** S1 (B-Kp-113): je genau eine Regel auf yH und auf y(from), «Wochenziele» dazwischen. */
function pruefeS1(L: Leiste): { yH: PdfStroke; yF: PdfStroke } {
  const yH = regelnBei(L.rs, L.b.tageskopfUnten);
  expect(yH.length, 'Regel auf der Tageskopf-Unterlinie über die Seitenleistenbreite').toBe(1);
  const yF = regelnBei(L.rs, L.b.yFrom);
  expect(yF.length, 'Regel auf y(from) über die Seitenleistenbreite').toBe(1);
  for (const s of [...yH, ...yF]) {
    expect(passtStil(s, L.soll.S1), `Strich nach B-Kp-113 bei y ${s.bbox.y.toFixed(3)}`).toBe(true);
  }
  const titel = leistenLauf(L.info, 1, L.b.xS, 'Wochenziele');
  expect(zwischenY(titel, L.b.tageskopfUnten, L.b.yFrom), '«Wochenziele» zwischen den Linien').toBe(
    true,
  );
  return { yH: yH[0] as PdfStroke, yF: yF[0] as PdfStroke };
}

/** Titelzeile: Regel über und unter dem Lauf, Abstand r (± 0,02 h); gibt beide Regeln zurück. */
function titelzeile(
  L: Leiste,
  rs: readonly PdfStroke[],
  t: PdfTextRun,
  was: string,
): { oben: PdfStroke; unten: PdfStroke } {
  const u = umriss(t);
  const oben = regelUeber(rs, u.y, was);
  const unten = regelUnter(rs, u.y + u.h, was);
  expect(
    Math.abs(unten.bbox.y - oben.bbox.y - L.r),
    `Höhe der Titelzeile ${was} = 0,5 h`,
  ).toBeLessThanOrEqual(zeilenTol(L) + 1e-9);
  return { oben, unten };
}

/** Zeilen der Was-Spalte (rechts der Nr-Spalte) zwischen y0 und y1 auf einer Seite. */
function wasZeilen(L: Leiste, seite: number, y0: number, y1: number): Zeile[] {
  return zeilen(
    laeufe(L.info, seite).filter(
      (t) =>
        t.rotation === 0 &&
        t.x >= L.b.xS + L.b.a - 0.01 &&
        t.baselineY > y0 + 0.01 &&
        t.baselineY < y1 + 0.01,
    ),
  ).sort((p, q) => p.baselineY - q.baselineY);
}

interface BemZeile {
  readonly y0: number;
  readonly y1: number;
  readonly zeilen: readonly Zeile[];
}

/**
 * Bemerkungen einer Seite (2.2 Punkt 6): Titelzeile (Regeln yB, yB + r), Kopfzeile bis zur ersten Regel F, dann je
 * Bemerkung eine Zeile bis zur nächsten Regel F. Gibt die Zeilen zwischen aufeinanderfolgenden Regeln F zurück.
 */
function bemerkungsZeilen(
  L: Leiste,
  seite: number,
  rs: readonly PdfStroke[],
): { yB: number; titel: PdfTextRun; fein: PdfStroke[]; zeilen: BemZeile[] } {
  const titel = leistenLauf(L.info, seite, L.b.xS, 'Bemerkungen');
  const { oben, unten } = titelzeile(L, rs, titel, '«Bemerkungen»');
  const yB = oben.bbox.y;
  const fein = rs.filter((s) => s.bbox.y > unten.bbox.y + 0.01 && passtStil(s, L.soll.F));
  expect(fein.length, 'Regel F unter der Kopfzeile «Nr»/«Was»').toBeGreaterThan(0);
  const kopf = fein[0] as PdfStroke;
  expect(
    Math.abs(kopf.bbox.y - (yB + 2 * L.r)),
    'Regel F unter der Kopfzeile auf yB + 2r',
  ).toBeLessThanOrEqual(2 * zeilenTol(L) + 1e-9);
  for (const t of ['Nr', 'Was']) {
    const l = leistenLauf(L.info, seite, L.b.xS, t);
    expect(zwischenY(l, unten.bbox.y, kopf.bbox.y), `«${t}» in der Kopfzeile`).toBe(true);
  }
  const zs: BemZeile[] = [];
  for (let i = 0; i + 1 < fein.length; i++) {
    const y0 = (fein[i] as PdfStroke).bbox.y;
    const y1 = (fein[i + 1] as PdfStroke).bbox.y;
    zs.push({ y0, y1, zeilen: wasZeilen(L, seite, y0, y1) });
  }
  return { yB, titel, fein, zeilen: zs };
}

/** Prüft eine Bemerkungszeile: Höhe = max(Zeilen, 1) × lineHeightPt(σ) (± 0,01), Zeilenkästen darin. */
function pruefeBemZeile(z: BemZeile, sigma: number, was: string): void {
  const n = Math.max(z.zeilen.length, 1);
  expect(
    Math.abs(z.y1 - z.y0 - n * lineHeightPt(sigma)),
    `${was}: Zeilenhöhe kompakt`,
  ).toBeLessThanOrEqual(0.01);
  for (const l of z.zeilen) {
    const k = zeilenkasten(l.laeufe[0] as PdfTextRun);
    expect(k.top, `${was}: Zeile oben in der Bemerkungszeile`).toBeGreaterThanOrEqual(z.y0 - 0.01);
    expect(k.bottom, `${was}: Zeile unten in der Bemerkungszeile`).toBeLessThanOrEqual(z.y1 + 0.01);
  }
}

/** Kürzel-Spaltenlinie (senkrecht auf xS + a, Strich 0,48) einer Seite. */
function kuerzelSpaltenlinie(L: Leiste, seite: number): PdfStroke {
  const l = senkrechteBei(L.info, seite, L.b.xS + L.b.a).filter((s) => passtStil(s, L.soll.T));
  expect(l.length, `Kürzel-Spaltenlinie auf Seite ${seite}`).toBe(1);
  return l[0] as PdfStroke;
}

/** Zeile rechts der Kürzelspalte auf der Grundlinie eines Kürzellaufs (± 0,01), oder null. */
function bedeutungZu(L: Leiste, k: PdfTextRun, spalte: number): Zeile | null {
  const z = zeilen(
    laeufe(L.info, k.page).filter(
      (t) => t.rotation === 0 && t.x >= spalte - 0.01 && nahe(t.baselineY, k.baselineY, 0.01),
    ),
  );
  expect(z.length, `höchstens eine Zeile rechts von «${k.text.trim()}»`).toBeLessThanOrEqual(1);
  return z[0] ?? null;
}

/** Kürzellauf (fett, links der Kürzelspalte) mit diesem Text auf irgendeiner Seite. */
function kuerzelLauf(L: Leiste, text: string, spalte: number): PdfTextRun {
  const l = L.info.texts.filter(
    (t) =>
      t.text.trim() === text && t.bold && t.x >= L.b.xS - 0.01 && t.x + t.width <= spalte + 0.01,
  );
  expect(l.length, `genau ein Kürzellauf «${text}»`).toBe(1);
  return l[0] as PdfTextRun;
}

/** Bedeutung x = Spaltenlinie + 1,2 und Toleranz ± 0,5 (B-Kp-77). */
function bedeutungLage(): { dx: number; tol: number } {
  const [dx] = bkpZahlen(
    'B-Kp-77',
    'sollwert',
    new RegExp(
      `^Zeilenhöhe ${ZAHL} × h; Kürzelspalte = Breite Zeitachsspalte; Bedeutung x = Spaltenlinie \\+ (${ZAHL})$`,
    ),
  );
  const [, tol] = bkpZahlen('B-Kp-77', 'toleranz', new RegExp(`^±(${ZAHL}) h; ±(${ZAHL}) pt$`));
  return { dx: dx as number, tol: tol as number };
}

/** Tageskopf-Unterlinie einer Fortsetzungsseite (X0 … xS − a, erste Linie unter yK). */
function tageskopfFortsetzung(L: Leiste, seite: number, yK: number): number {
  const l = striche(L.info, seite)
    .filter(istWaagrecht)
    .filter(
      (s) =>
        nahe(s.bbox.x, L.b.X0, 0.5) &&
        nahe(s.bbox.x + s.bbox.w, L.b.xSa, 0.5) &&
        s.bbox.y > yK + 0.5,
    )
    .sort((p, q) => p.bbox.y - q.bbox.y);
  expect(l.length, `Tageskopf-Unterlinie der Fortsetzungsseite ${seite}`).toBeGreaterThan(0);
  return (l[0] as PdfStroke).bbox.y;
}

/** Seiten, auf denen ein Lauf mit diesem Text in der Seitenleiste steht. */
function seitenMit(info: PdfInfo, text: string, xS: number): number[] {
  return info.texts.filter((t) => t.text.trim() === text && t.x >= xS - 0.01).map((t) => t.page);
}

/** Gemeinsame Grösse σ der Bemerkungstexte (S3-12): Grösse der ersten Textzeile einer Bemerkung. */
function sigmaVon(zs: readonly BemZeile[]): number {
  const z = zs.find((x) => x.zeilen.length > 0)?.zeilen[0];
  expect(z, 'Bemerkung mit Text').toBeDefined();
  return (z as Zeile).sizePt;
}

function bedeutungsEreignisse(L: Leiste): PageFallbackEvent[] {
  return L.fallbacks.filter((e) => e.field === 'abbreviationMeaning');
}

// ---------------------------------------------------------------------------------------------------------
// A3: Rapportrahmen (R-10-50)
// ---------------------------------------------------------------------------------------------------------

describe('Gate S A3: Rapportrahmen dünn (R-10-50; Vertrag E1-02k §1, B-Kp-58)', () => {
  it('[R-10-50] (P1) KVK: alle 7 Rapportkästchen (nach Lage in der Rap-Spalte) mit Rahmen nach B-Kp-58 (0,48 ± 0,12), gleich dem Blockrahmen nach B-Kp-50 (Differenz ≤ 0,01)', async () => {
    const L = await kvkLeiste();
    const boxen = L.an.inhalt.eintraege.filter((e) => e.klasse === 'rapportBox');
    expect(boxen.length).toBe(7);
    const bloecke = L.an.inhalt.eintraege.filter((e) => e.klasse === 'block');
    expect(bloecke.length).toBeGreaterThan(0);
    const blockRand = (bloecke[0] as { flaeche: { rand: number | null } }).flaeche.rand;
    expect(blockRand, 'Blockrahmen vorhanden').not.toBeNull();
    for (const e of boxen) {
      const rand = e.flaeche.rand ?? Number.NaN;
      expect(
        nahe(rand, L.an.stile.rapport.breite, L.an.stile.rapport.breiteTol),
        `Rahmen ${rand}`,
      ).toBe(true);
      expect(
        Math.abs(rand - (blockRand ?? Number.NaN)),
        'Rapportrahmen = Blockrahmen',
      ).toBeLessThanOrEqual(0.01);
      expect(e.flaeche.randFarbe).toEqual({ r: 0, g: 0, b: 0 });
    }
  });

  it('[R-10-50] (P2) synthetischer Plan: je ein Rapport KR, DR, AR1, AR2, ARK, BR 0, BR 1, BR 2, BR 3 und ein frei gewähltes Kürzel «QX» in der Rap-Spalte → jedes Rapportkästchen mit Rahmen 0,48 ± 0,12 nach B-Kp-58', async () => {
    const plan = rapportePlan();
    const L = await leiste('rahmen-rapporte', plan);
    const boxen = L.an.inhalt.eintraege.filter((e) => e.klasse === 'rapportBox');
    expect(boxen.length).toBe(P2_KUERZEL.length);
    for (const e of boxen) {
      const rand = e.flaeche.rand ?? Number.NaN;
      expect(
        nahe(rand, L.an.stile.rapport.breite, L.an.stile.rapport.breiteTol),
        `Rahmen ${rand}`,
      ).toBe(true);
    }
    // Jedes Kürzel steht in einem dieser Kästchen (die Kästchen sind die Rapporte des Plans).
    for (const k of P2_KUERZEL) {
      const t = L.info.texts.filter((x) => x.text.trim() === k && x.bold && x.x < L.b.xSa);
      expect(t.length, `Kürzel «${k}» im Raster`).toBe(1);
      const m = umriss(t[0] as PdfTextRun);
      expect(
        boxen.some(
          (e) =>
            m.x >= e.flaeche.rect.x - 0.01 &&
            m.x + m.w <= e.flaeche.rect.x + e.flaeche.rect.w + 0.01 &&
            m.y >= e.flaeche.rect.y - 0.01,
        ),
        `«${k}» in einem Rapportkästchen`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// A4: Wochenziele (R-10-51)
// ---------------------------------------------------------------------------------------------------------

describe('Gate S A4: Wochenziele gerahmt (R-10-51; Vertrag E1-02k 2.2 Punkt 2 bis 4, 2.3; B-Kp-113, -114)', () => {
  it('[R-10-51] (P3) KVK: Titelzeile «Wochenziele» zwischen je einer Linie auf der Tageskopf-Unterlinie und auf y(from) über die Seitenleistenbreite (B-Kp-113); Kasten unten geschlossen durch eine Linie 0,5 h (± 0,5) unter der letzten Zielzeile, die Oberlinie der Titelzeile «Bemerkungen» (B-Kp-114)', async () => {
    const L = await kvkLeiste();
    pruefeS1(L);
    const bem = leistenLauf(L.info, 1, L.b.xS, 'Bemerkungen');
    const unten = zieleUnterkante(L, bem.baselineY);
    expect(unten, 'Zielzeilen der KVK').not.toBeNull();
    const yZ = (unten as number) + L.g;
    const abschluss = regelUeber(L.rs, umriss(bem).y, '«Bemerkungen»');
    expect(
      Math.abs(abschluss.bbox.y - yZ),
      'Abschluss 0,5 h unter der letzten Zielzeile',
    ).toBeLessThanOrEqual(L.soll.abstandTol + 1e-9);
    erwarteRegelStil(abschluss, L.soll, L.stunden, 'Abschluss Wochenziele');
    // Die Abschlusslinie ist die Oberlinie der Titelzeile «Bemerkungen».
    titelzeile(L, L.rs, bem, '«Bemerkungen»');
    expect(
      L.rs.filter((s) => s.bbox.y > (unten as number) + 0.01 && s.bbox.y < abschluss.bbox.y - 0.01),
      'keine weitere Linie zwischen Zielen und Abschluss',
    ).toEqual([]);
  });

  it('[R-10-51] (P4) Woche ohne Wochenziele: Titelzeile wie P3; Abschluss 0,5 h unter y(from) + ½ Strich + textInsetPt (± 0,5)', async () => {
    const L = await leiste('rahmen-ohne-ziele', ohneZielePlan());
    const { yF } = pruefeS1(L);
    const bem = leistenLauf(L.info, 1, L.b.xS, 'Bemerkungen');
    expect(zieleUnterkante(L, bem.baselineY), 'keine Zielzeile').toBeNull();
    const yZ = yF.bbox.y + yF.widthPt / 2 + INSET + L.g;
    const abschluss = regelUeber(L.rs, umriss(bem).y, '«Bemerkungen»');
    expect(Math.abs(abschluss.bbox.y - yZ), 'Abschluss ohne Ziele').toBeLessThanOrEqual(
      L.soll.abstandTol + 1e-9,
    );
    expect(
      L.rs.filter((s) => s.bbox.y > yF.bbox.y + 0.01 && s.bbox.y < abschluss.bbox.y - 0.01),
      'keine Linie zwischen y(from) und dem Abschluss',
    ).toEqual([]);
  });

  it('[R-10-51] (P5) KVK+ (Erhöhte Bereitschaft): Titelzeile wie P3; Oberkante des Bereitschaftskastens 0,5 h (± 0,5) unter der letzten Zielzeile; zwischen y(from) und dem Kasten keine Linie', async () => {
    const L = await plusLeiste();
    const { yF } = pruefeS1(L);
    const grau = flaechen(L.info).filter(
      (f) =>
        gleicheFarbe(f.fill, farbeAus('B-Kp-98')) &&
        nahe(f.rect.x, L.b.xS, 0.5) &&
        nahe(f.rect.x + f.rect.w, L.b.rechts, 0.5),
    );
    expect(grau.length, 'Bereitschaftskasten').toBe(1);
    const kasten = (grau[0] as { rect: { y: number } }).rect;
    const unten = zieleUnterkante(L, kasten.y);
    expect(unten, 'Zielzeilen der KVK+').not.toBeNull();
    expect(
      Math.abs(kasten.y - ((unten as number) + L.g)),
      'Kasten 0,5 h unter dem letzten Ziel',
    ).toBeLessThanOrEqual(L.soll.abstandTol + 1e-9);
    expect(
      L.rs.filter((s) => s.bbox.y > yF.bbox.y + 0.01 && s.bbox.y < kasten.y + 0.01),
      'keine Linie zwischen Zielen und Kasten',
    ).toEqual([]);
  });

  it('[R-10-51] (P16) Fortsetzungsseite, auf der die Ziele der letzte Abschnitt sind: Titelzeile «Wochenziele» 0,5 h ab der Tageskopf-Unterlinie mit Linien oben und unten; Schlusslinie bei Unterkante der letzten Zielzeile + ½ Strich + textInsetPt (± 0,5); keine weitere Linie', async () => {
    const plan = zieleLetzterAbschnittPlan();
    const L = await leiste('rahmen-ziele-letzter', plan);
    expect(L.info.pages.length, 'Ziele gehen auf die Fortsetzungsseite').toBeGreaterThanOrEqual(2);
    const fb = fortsetzungsBereiche(L.info, 2);
    const yH2 = tageskopfFortsetzung(L, 2, fb.yK);
    const rs2 = regeln(L.info, 2, L.b.xS, L.b.rechts, L.soll.endenTol);
    const titel = leistenLauf(L.info, 2, L.b.xS, 'Wochenziele');
    const { oben, unten } = titelzeile(L, rs2, titel, '«Wochenziele» (Fortsetzung)');
    expect(
      Math.abs(oben.bbox.y - yH2),
      'Titelzeile ab der Tageskopf-Unterlinie',
    ).toBeLessThanOrEqual(L.soll.endenTol);
    // Die fiktiven Ziele sind einzeilig («- Ziel nn fiktiv»).
    const ziele = laeufe(L.info, 2).filter(
      (t) =>
        t.rotation === 0 &&
        t.x >= L.b.xS - 0.01 &&
        t.baselineY > unten.bbox.y &&
        t.text.startsWith('- Ziel'),
    );
    expect(ziele.length, 'Zielzeilen auf der Fortsetzungsseite').toBeGreaterThan(0);
    const zielUnten = Math.max(...ziele.map((t) => zeilenkasten(t).bottom));
    const schluss = rs2.filter((s) => s.bbox.y > unten.bbox.y + 0.01);
    expect(schluss.length, 'genau eine Schlusslinie unter den Zielen').toBe(1);
    const s = schluss[0] as PdfStroke;
    expect(passtStil(s, L.soll.T), 'Schlusslinie durchgezogen 0,48').toBe(true);
    expect(
      Math.abs(s.bbox.y - (zielUnten + L.soll.T.breite / 2 + INSET)),
      'Schlusslinie unter der letzten Zielzeile',
    ).toBeLessThanOrEqual(L.soll.endenTol);
    for (const x of [oben, unten]) expect(passtStil(x, L.soll.T)).toBe(true);
    expect(rs2.length, 'Linien der Seitenleiste auf der Fortsetzungsseite').toBe(3);
  });
});

// ---------------------------------------------------------------------------------------------------------
// A4: übrige Abschnitte (R-10-52)
// ---------------------------------------------------------------------------------------------------------

describe('Gate S A4: Bemerkungen, Kürzelliste, Abschluss, Seitenleistenlinie (R-10-52; Vertrag E1-02k 2.2, 2.3; B-Kp-78, -115 bis -119)', () => {
  it('[R-10-52] (P6) KVK: Titelzeile «Bemerkungen» 0,5 h mit Linien 0,48; Kopfzeile 0,5 h mit Linie 0,12; je Bemerkung genau eine Linie 0,12 auf der Zeilengrenze, Zeilenhöhe = Textzeilen × lineHeightPt(σ) (± 0,01); Nr-Spaltenlinie 0,12 auf xS + a von der Titel-Unterlinie bis zur Oberlinie der Kürzel-Titelzeile (± 0,5)', async () => {
    const L = await kvkLeiste();
    const bem = bemerkungsZeilen(L, 1, L.rs);
    const { oben, unten } = titelzeile(L, L.rs, bem.titel, '«Bemerkungen»');
    for (const s of [oben, unten])
      erwarteRegelStil(s, L.soll, L.stunden, 'Titelzeile «Bemerkungen»');
    for (const s of bem.fein) expect(passtStil(s, L.soll.F), 'Regel F nach B-Kp-116').toBe(true);
    const soll = remarksForWeek(L.plan, KVK_WOCHE);
    expect(bem.zeilen.length, 'eine Zeile je Bemerkung').toBe(soll.length);
    const sigma = sigmaVon(bem.zeilen);
    bem.zeilen.forEach((z, i) => {
      expect(norm(z.zeilen.map((x) => x.text).join('')), `Text der Bemerkung ${i + 1}`).toBe(
        norm((soll[i] as { text: string }).text),
      );
      pruefeBemZeile(z, sigma, `Bemerkung ${i + 1}`);
    });
    const legende = leistenLauf(L.info, 1, L.b.xS, 'Legende');
    const yL = regelUeber(L.rs, umriss(legende).y, '«Legende»').bbox.y;
    const nr = senkrechteBei(L.info, 1, L.b.xS + L.b.a).filter((s) => passtStil(s, L.soll.F));
    expect(nr.length, 'Nr-Spaltenlinie').toBe(1);
    const n = nr[0] as PdfStroke;
    expect(
      Math.abs(n.bbox.y - unten.bbox.y),
      'Nr-Spaltenlinie ab der Titel-Unterlinie',
    ).toBeLessThanOrEqual(L.soll.endenTol);
    expect(
      Math.abs(n.bbox.y + n.bbox.h - yL),
      'Nr-Spaltenlinie bis zur Oberlinie der Kürzel-Titelzeile',
    ).toBeLessThanOrEqual(L.soll.endenTol);
  });

  it('[R-10-52] (P7) KVK und Woche ohne Kürzel- und Legendenzeilen: Linie über und unter der Kürzelüberschrift «Legende» über die Seitenleistenbreite, Abstand 0,5 h (± 0,02 h), die Überschrift dazwischen (B-Kp-117; Linien immer, 2.2 Punkt 7)', async () => {
    const L = await kvkLeiste();
    const legende = leistenLauf(L.info, 1, L.b.xS, 'Legende');
    const { oben, unten } = titelzeile(L, L.rs, legende, '«Legende»');
    for (const s of [oben, unten]) {
      expect(nahe(s.widthPt, L.soll.T.breite, L.soll.T.breiteTol), 'Strich 0,48').toBe(true);
    }
    expect(zwischenY(legende, oben.bbox.y, unten.bbox.y)).toBe(true);
    // Die Oberlinie schliesst die Bemerkungen: sie liegt unter der letzten Regel F.
    const fein = L.rs.filter((s) => passtStil(s, L.soll.F));
    expect(fein.length).toBeGreaterThan(0);
    expect(oben.bbox.y).toBeGreaterThan((fein[fein.length - 1] as PdfStroke).bbox.y);
    // TR-E102k-02: ohne Kürzel- und Legendenzeilen (fiktiv) bleibt die Titelzeile gerahmt.
    const O = await ohneZeilenLeiste();
    const rsO = O.rs.filter((s) => s.bbox.y < O.b.yTo - 0.5);
    const lo = leistenLauf(O.info, 1, O.b.xS, 'Legende');
    const t = titelzeile(O, rsO, lo, '«Legende» ohne Tabellenzeilen');
    for (const s of [t.oben, t.unten]) {
      expect(
        nahe(s.widthPt, O.soll.T.breite, O.soll.T.breiteTol),
        `ohne Tabellenzeilen: Strich 0,48 bei y ${s.bbox.y.toFixed(3)}`,
      ).toBe(true);
    }
    expect(zwischenY(lo, t.oben.bbox.y, t.unten.bbox.y)).toBe(true);
  });

  it('[R-10-52] (P8) KVK: jede waagrechte Seitenleistenregel 0,48 der Wochenseite auf einer vollen Stunde gestrichelt nach B-Kp-45, jede andere durchgezogen, jede Regel 0,12 durchgezogen; Kürzel-Spaltenlinie bis y(to) (± 0,5), auch ohne Kürzel- und Legendenzeilen; Fortsetzungsseite mit Kürzel- bzw. Legendenzeilen: alle Tabellenregeln durchgezogen, Kürzel-Spaltenlinie bis zur letzten Tabellenregel', async () => {
    const L = await kvkLeiste();
    const alle = [
      ...L.rs,
      ...regeln(L.info, 1, L.b.xSa, L.b.rechts, L.soll.endenTol).filter(
        (s) => s.bbox.y > L.b.yTo + 0.5,
      ),
    ];
    expect(alle.length).toBeGreaterThan(0);
    let gestrichelt = 0;
    for (const s of alle) {
      if (passtStil(s, L.soll.F)) continue;
      erwarteRegelStil(s, L.soll, L.stunden, 'Seitenleistenregel');
      if (aufStunde(s.bbox.y, L.stunden)) gestrichelt++;
    }
    expect(
      gestrichelt,
      'Regeln auf einer vollen Stunde (Kürzel- und Legendentabelle)',
    ).toBeGreaterThan(0);
    for (const s of alle.filter((x) => nahe(x.widthPt, L.soll.F.breite, L.soll.F.breiteTol))) {
      expect(s.dash === null || s.dash.length === 0, 'Regel 0,12 durchgezogen').toBe(true);
    }
    const legende = leistenLauf(L.info, 1, L.b.xS, 'Legende');
    const { unten } = titelzeile(L, L.rs, legende, '«Legende»');
    const spalte = kuerzelSpaltenlinie(L, 1);
    expect(
      Math.abs(spalte.bbox.y - unten.bbox.y),
      'Kürzel-Spaltenlinie ab der Titel-Unterlinie',
    ).toBeLessThanOrEqual(L.soll.endenTol);
    expect(
      Math.abs(spalte.bbox.y + spalte.bbox.h - L.b.yTo),
      'Kürzel-Spaltenlinie bis y(to)',
    ).toBeLessThanOrEqual(L.soll.endenTol);
    // Fortsetzungsseite (60 fiktive Legendenkategorien): kein Raster, alle Tabellenregeln durchgezogen.
    const p = kvk();
    const extra: LtgCategory[] = Array.from({ length: 60 }, (_, i) => ({
      id: `kx${i}`,
      name: `Kat ${i}`,
      legendLabel: `Kategorie ${String(i + 1).padStart(2, '0')}`,
      color: { r: 30 + i, g: 120, b: 200 },
      neutral: false,
      inLegend: true,
    }));
    const F = await leiste('rahmen-60-kategorien', { ...p, legend: [...p.legend, ...extra] });
    expect(F.info.pages.length).toBeGreaterThanOrEqual(2);
    for (let seite = 2; seite <= F.info.pages.length; seite++) {
      const rs = regeln(F.info, seite, F.b.xS, F.b.rechts, F.soll.endenTol);
      expect(rs.length, `Tabellenregeln auf Seite ${seite}`).toBeGreaterThan(0);
      for (const s of rs) {
        if (nahe(s.widthPt, F.soll.F.breite, F.soll.F.breiteTol)) {
          expect(passtStil(s, F.soll.F), `Seite ${seite}: Regel 0,12 durchgezogen`).toBe(true);
        } else erwarteRegelStil(s, F.soll, [], `Seite ${seite}`);
      }
      // TR-E102k-04 (2.3): Kürzel-Spaltenlinie von der Unterlinie der Titelzeile bis zur letzten Tabellenregel.
      const lf = leistenLauf(F.info, seite, F.b.xS, 'Legende');
      const tf = titelzeile(F, rs, lf, `«Legende» Seite ${seite}`);
      const sf = kuerzelSpaltenlinie(F, seite);
      expect(
        Math.abs(sf.bbox.y - tf.unten.bbox.y),
        `Seite ${seite}: Kürzel-Spaltenlinie ab der Titel-Unterlinie`,
      ).toBeLessThanOrEqual(F.soll.endenTol);
      expect(
        Math.abs(sf.bbox.y + sf.bbox.h - (rs[rs.length - 1] as PdfStroke).bbox.y),
        `Seite ${seite}: Kürzel-Spaltenlinie bis zur letzten Tabellenregel`,
      ).toBeLessThanOrEqual(F.soll.endenTol);
    }
    // TR-E102k-02 (2.2 Punkt 8): ohne Kürzel- und Legendenzeilen (fiktiv) Kürzel-Spaltenlinie bis y(to).
    const O = await ohneZeilenLeiste();
    const rsO = O.rs.filter((s) => s.bbox.y < O.b.yTo - 0.5);
    const to = titelzeile(
      O,
      rsO,
      leistenLauf(O.info, 1, O.b.xS, 'Legende'),
      '«Legende» ohne Zeilen',
    );
    for (const s of [to.oben, to.unten]) {
      erwarteRegelStil(s, O.soll, O.stunden, 'Titelzeile «Legende» ohne Tabellenzeilen');
    }
    const so = kuerzelSpaltenlinie(O, 1);
    expect(
      Math.abs(so.bbox.y - to.unten.bbox.y),
      'ohne Tabellenzeilen: Kürzel-Spaltenlinie ab der Titel-Unterlinie',
    ).toBeLessThanOrEqual(O.soll.endenTol);
    expect(
      Math.abs(so.bbox.y + so.bbox.h - O.b.yTo),
      'ohne Tabellenzeilen: Kürzel-Spaltenlinie bis y(to)',
    ).toBeLessThanOrEqual(O.soll.endenTol);
  });

  it('[R-10-52] (P9) KVK: Linie auf y(to) von xS bis zum Rahmen rechts und Linie auf yT von xS − a bis zum Rahmen rechts (Enden ± 0,5, B-Kp-118); im Unterschriftblock keine weitere Linie ausser der Sonnentabelle', async () => {
    const L = await kvkLeiste();
    const yTo = regelnBei(L.rs, L.b.yTo);
    expect(yTo.length, 'Linie auf y(to) über die Seitenleiste').toBe(1);
    const yT = regelnBei(regeln(L.info, 1, L.b.xSa, L.b.rechts, L.soll.endenTol), L.b.yT);
    expect(yT.length, 'Linie auf yT von xS − a bis zum Rahmen rechts').toBe(1);
    for (const s of [...yTo, ...yT])
      expect(passtStil(s, L.soll.E), 'Strich nach B-Kp-118').toBe(true);
    const [sonne] = bkpZahlen('B-Kp-84', 'sollwert', new RegExp(`Rahmen (${ZAHL}) pt;`));
    const innen = striche(L.info, 1).filter(
      (s) =>
        s.widthPt > 0 &&
        s.fill === null &&
        s.bbox.x > L.b.xSa + 0.5 &&
        s.bbox.x + s.bbox.w < L.b.rechts - 0.5 &&
        s.bbox.y > L.b.yT + 0.5 &&
        s.bbox.y + s.bbox.h < L.b.yU - 0.5,
    );
    expect(innen.length, 'Sonnentabelle im Unterschriftblock').toBeGreaterThan(0);
    for (const s of innen) {
      expect(
        nahe(s.widthPt, sonne as number, 0.01),
        `nur Linien der Sonnentabelle (Strich ${s.widthPt})`,
      ).toBe(true);
    }
  });

  it('[R-10-52] (P10) KVK und Fortsetzungsseite (40 Tagesbemerkungen): die einzige senkrechte Linie auf xS beginnt auf yK (± 0,5) und endet auf y(to) bzw. yU; im Stand-Feld keine senkrechte Linie; auf beiden Seiten keine waagrechte Linie rechts von xS zwischen yK und der Tageskopf-Unterlinie (Stand-Feld unten offen)', async () => {
    const L = await kvkLeiste();
    const viele = Array.from({ length: 40 }, (_, i) =>
      dayRemark(`e${600 + i}`, 600 + i, {
        date: MO,
        text: `Bemerkung ${String(i + 1).padStart(2, '0')}`,
      }),
    );
    const { info: info2 } = await seitePdf(
      'rahmen-fortsetzung-kante',
      mitEintraegen(kvk(), viele),
      KVK_WOCHE,
    );
    expect(info2.pages.length).toBe(2);
    const fb = fortsetzungsBereiche(info2, 2);
    const F: Leiste = { ...L, info: info2 };
    const yH2 = tageskopfFortsetzung(F, 2, fb.yK);
    const faelle: {
      info: PdfInfo;
      seite: number;
      yK: number;
      yH: number;
      ende: number;
      was: string;
    }[] = [
      {
        info: L.info,
        seite: 1,
        yK: L.b.yK,
        yH: L.b.tageskopfUnten,
        ende: L.b.yTo,
        was: 'Wochenseite',
      },
      { info: info2, seite: 2, yK: fb.yK, yH: yH2, ende: fb.yU, was: 'Fortsetzungsseite' },
    ];
    for (const f of faelle) {
      const kante = senkrechteBei(f.info, f.seite, L.b.xS);
      expect(kante.length, `${f.was}: genau eine senkrechte Linie auf xS`).toBe(1);
      const k = kante[0] as PdfStroke;
      expect(passtStil(k, L.soll.kante), `${f.was}: Strich nach B-Kp-119`).toBe(true);
      expect(Math.abs(k.bbox.y - f.yK), `${f.was}: Seitenleistenlinie ab yK`).toBeLessThanOrEqual(
        L.soll.endenTol,
      );
      expect(
        Math.abs(k.bbox.y + k.bbox.h - f.ende),
        `${f.was}: Ende der Seitenleistenlinie`,
      ).toBeLessThanOrEqual(L.soll.endenTol);
      const st = striche(f.info, f.seite);
      expect(
        st.filter(
          (s) =>
            istSenkrecht(s) &&
            s.bbox.x > L.b.xS - 0.5 &&
            s.bbox.x < L.b.rechts - 0.5 &&
            s.bbox.y < f.yK - 0.5,
        ),
        `${f.was}: keine senkrechte Linie im Stand-Feld`,
      ).toEqual([]);
      expect(
        st.filter(
          (s) =>
            istWaagrecht(s) &&
            s.bbox.x + s.bbox.w > L.b.xS + 0.5 &&
            s.bbox.y >= f.yK - 0.5 &&
            s.bbox.y < f.yH - 0.5,
        ),
        `${f.was}: Stand-Feld unten offen`,
      ).toEqual([]);
    }
  });

  it('[R-10-52] (P11) Fortsetzungsseite mit verschobenen Zielen und Bemerkungen: Titelzeilen «Wochenziele» (ab der Tageskopf-Unterlinie) und «Bemerkungen» je 0,5 h mit durchgezogenen Linien oben und unten; Linie 0,12 je Bemerkung; Nr-Spaltenlinie bis zur letzten Linie 0,12', async () => {
    const L = await leiste('rahmen-ziele-bemerkungen', zieleUndBemerkungenPlan());
    expect(L.info.pages.length).toBeGreaterThanOrEqual(2);
    const fb = fortsetzungsBereiche(L.info, 2);
    const yH2 = tageskopfFortsetzung(L, 2, fb.yK);
    const rs2 = regeln(L.info, 2, L.b.xS, L.b.rechts, L.soll.endenTol);
    const ziel = titelzeile(L, rs2, leistenLauf(L.info, 2, L.b.xS, 'Wochenziele'), '«Wochenziele»');
    expect(
      Math.abs(ziel.oben.bbox.y - yH2),
      '«Wochenziele» ab der Tageskopf-Unterlinie',
    ).toBeLessThanOrEqual(L.soll.endenTol);
    const bem = bemerkungsZeilen(L, 2, rs2);
    const titelBem = titelzeile(L, rs2, bem.titel, '«Bemerkungen»');
    for (const s of [ziel.oben, ziel.unten, titelBem.oben, titelBem.unten]) {
      expect(passtStil(s, L.soll.T), `Titelzeile durchgezogen bei y ${s.bbox.y.toFixed(3)}`).toBe(
        true,
      );
    }
    const soll = remarksForWeek(L.plan, KVK_WOCHE).map((r) => norm(r.text));
    const ist = bem.zeilen.map((z) => norm(z.zeilen.map((x) => x.text).join('')));
    expect(ist.length, 'Bemerkungen auf der Fortsetzungsseite').toBeGreaterThan(0);
    // Je Bemerkung genau eine Zeile zwischen zwei Regeln F: die Zeilen sind die letzten Bemerkungen in Folge.
    expect(ist).toEqual(soll.slice(soll.length - ist.length));
    const sigma = sigmaVon(bem.zeilen);
    bem.zeilen.forEach((z, i) => {
      pruefeBemZeile(z, sigma, `Bemerkung ${i + 1} (Fortsetzung)`);
    });
    // TR-E102k-04 (2.3): Nr-Spaltenlinie von der Unterlinie der Titelzeile bis zur letzten Regel F.
    const nr = senkrechteBei(L.info, 2, L.b.xS + L.b.a).filter((s) => passtStil(s, L.soll.F));
    expect(nr.length, 'Nr-Spaltenlinie auf der Fortsetzungsseite').toBe(1);
    const n = nr[0] as PdfStroke;
    expect(
      Math.abs(n.bbox.y - titelBem.unten.bbox.y),
      'Nr-Spaltenlinie ab der Titel-Unterlinie «Bemerkungen»',
    ).toBeLessThanOrEqual(L.soll.endenTol);
    expect(
      Math.abs(n.bbox.y + n.bbox.h - (bem.fein[bem.fein.length - 1] as PdfStroke).bbox.y),
      'Nr-Spaltenlinie bis zur letzten Regel F',
    ).toBeLessThanOrEqual(L.soll.endenTol);
  });

  it('[R-10-52] (P17) Bemerkung ohne Text und ohne Nummer: eigene Zeile der Höhe lineHeightPt(σ) (± 0,01) zwischen zwei Linien 0,12; keine zwei Linien 0,12 auf gleicher Höhe', async () => {
    const plan = leereBemerkungPlan();
    const L = await leiste('rahmen-leere-bemerkung', plan);
    const soll = remarksForWeek(plan, KVK_WOCHE);
    const i = soll.findIndex((r) => r.id === LEERE_BEMERKUNG);
    expect(i).toBeGreaterThanOrEqual(0);
    const bem = bemerkungsZeilen(L, 1, L.rs);
    expect(bem.zeilen.length, 'eine Zeile je Bemerkung').toBe(soll.length);
    for (let k = 1; k < bem.fein.length; k++) {
      expect(
        (bem.fein[k] as PdfStroke).bbox.y - (bem.fein[k - 1] as PdfStroke).bbox.y,
        'Regeln F verschieden hoch',
      ).toBeGreaterThan(0.01);
    }
    const leer = bem.zeilen[i] as BemZeile;
    expect(leer.zeilen, 'leere Bemerkungszeile ohne Text').toEqual([]);
    const sigma = sigmaVon(bem.zeilen);
    expect(
      Math.abs(leer.y1 - leer.y0 - lineHeightPt(sigma)),
      'Höhe einer Textzeile',
    ).toBeLessThanOrEqual(0.01);
  });

  it('[R-10-52] (P18) Stundenregel an der Titelzeile «Bemerkungen»: Anzeigebereich 0500–2155, zwei einzeilige Ziele → Oberlinie auf einer Stundenlinie (± 0,01) und gestrichelt nach B-Kp-45, Unterlinie (+ 0,5 h ± 0,01) durchgezogen 0,48, alle Linien 0,12 durchgezogen; Gegenproben: KVK (0400–2400) beide Linien durchgezogen, Regel 0,12 auf einer Stundenlinie (0405–2310) bleibt 0,12 durchgezogen, Oberlinie 0,01 bis 0,1 pt neben einer Stunde (0445–2125) durchgezogen', async () => {
    const L = await leiste('rahmen-stunde', stundenPlan());
    const bem = leistenLauf(L.info, 1, L.b.xS, 'Bemerkungen');
    const u = umriss(bem);
    const ueber = L.rs.filter((s) => s.bbox.y <= u.y + 0.01 && s.bbox.y > u.y - L.r);
    expect(ueber.length, 'genau eine Regel über der Titelzeile «Bemerkungen»').toBe(1);
    const oben = ueber[0] as PdfStroke;
    expect(aufStunde(oben.bbox.y, L.stunden), 'Oberlinie auf einer Stundenlinie').toBe(true);
    expect(passtStil(oben, L.soll.Std), 'Oberlinie gestrichelt nach B-Kp-45').toBe(true);
    const unten = regelnBei(L.rs, oben.bbox.y + L.r);
    expect(unten.length, 'Unterlinie 0,5 h tiefer').toBe(1);
    expect(passtStil(unten[0] as PdfStroke, L.soll.T), 'Unterlinie durchgezogen 0,48').toBe(true);
    const fein = L.rs.filter((s) => nahe(s.widthPt, L.soll.F.breite, L.soll.F.breiteTol));
    expect(fein.length).toBeGreaterThan(0);
    for (const s of fein) expect(passtStil(s, L.soll.F), 'Regel 0,12 durchgezogen').toBe(true);
    // Gegenprobe KVK: Ober- und Unterlinie durchgezogen, nicht auf einer Stundenlinie.
    const K = await kvkLeiste();
    const t = titelzeile(
      K,
      K.rs,
      leistenLauf(K.info, 1, K.b.xS, 'Bemerkungen'),
      '«Bemerkungen» (KVK)',
    );
    for (const s of [t.oben, t.unten]) {
      expect(aufStunde(s.bbox.y, K.stunden)).toBe(false);
      expect(passtStil(s, K.soll.T), 'KVK: durchgezogen').toBe(true);
    }
    // TR-E102k-01: Anzeigebereich 0405–2310, zwei Ziele: eine Regel F liegt auf einer Stundenlinie und bleibt
    // 0,12 durchgezogen nach B-Kp-116 (2.2 Punkt 11: feine Regeln ausgenommen).
    const planF = stundenVariante(2, 245, 1390);
    const LF = await leiste('rahmen-stunde-fein', planF);
    const feinF = LF.rs.filter((s) => passtStil(s, LF.soll.F));
    expect(feinF.length, 'Regeln F nach B-Kp-116 = Bemerkungen + 1').toBe(
      remarksForWeek(planF, KVK_WOCHE).length + 1,
    );
    expect(
      feinF.filter((s) => aufStunde(s.bbox.y, LF.stunden)).length,
      'genau eine Regel F auf einer Stundenlinie',
    ).toBe(1);
    // TR-E102k-03: Gegenprobe nahe der Toleranz: Anzeigebereich 0445–2125, drei Ziele; die Oberlinie
    // «Bemerkungen» liegt 0,01 bis 0,1 pt neben einer Stundenlinie und bleibt durchgezogen.
    const LG = await leiste('rahmen-stunde-grenze', stundenVariante(3, 285, 1285));
    const tg = titelzeile(
      LG,
      LG.rs,
      leistenLauf(LG.info, 1, LG.b.xS, 'Bemerkungen'),
      '«Bemerkungen» (Grenze)',
    );
    const abstand = Math.min(...LG.stunden.map((y) => Math.abs(y - tg.oben.bbox.y)));
    expect(abstand, 'Vorbedingung: Oberlinie knapp neben einer Stundenlinie').toBeGreaterThan(0.01);
    expect(abstand, 'Vorbedingung: Oberlinie knapp neben einer Stundenlinie').toBeLessThan(0.1);
    expect(passtStil(tg.oben, LG.soll.T), 'Oberlinie neben der Stundenlinie durchgezogen').toBe(
      true,
    );
    for (const s of LG.rs) {
      const d = Math.min(...LG.stunden.map((y) => Math.abs(y - s.bbox.y)));
      if (d > 0.01 && d < 0.6 && !passtStil(s, LG.soll.F)) {
        expect(
          passtStil(s, LG.soll.T),
          `Regel ${d.toFixed(3)} pt neben einer Stunde durchgezogen`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------------------------------------
// R-10-53: Bedeutungsspalte
// ---------------------------------------------------------------------------------------------------------

describe('Bedeutungsspalte der Kürzelliste (R-10-53; Vertrag E1-02k §4, B-Kp-77)', () => {
  it('[R-10-53] (P12) KVK: Zeile «DR» zeigt «Dienstrapport» normal rechts der Kürzel-Spaltenlinie, x = Spaltenlinie + 1,2 (± 0,5) nach B-Kp-77, auf der Grundlinie von «DR» (± 0,01); «BR 0» zeigt «Bataillonsrapport KVK», «KR» «Kompanierapport» (Gate B 28.10.2026 Nr 39, KR 29.10.2026); kein Ereignis mit field abbreviationMeaning', async () => {
    const L = await kvkLeiste();
    expect(abbreviationMeaning(L.plan, 'DR', kpTemplate())).toBe('Dienstrapport');
    const spalte = kuerzelSpaltenlinie(L, 1).bbox.x;
    const { dx, tol } = bedeutungLage();
    const dr = kuerzelLauf(L, 'DR', spalte);
    const b = bedeutungZu(L, dr, spalte);
    expect(b?.text.trim(), 'Bedeutung von «DR»').toBe('Dienstrapport');
    const z = b as Zeile;
    expect(
      z.laeufe.every((t) => !t.bold),
      'Bedeutung normal',
    ).toBe(true);
    expect(Math.abs(z.x - (spalte + dx)), 'x = Spaltenlinie + 1,2').toBeLessThanOrEqual(tol);
    expect(Math.abs(z.baselineY - dr.baselineY)).toBeLessThanOrEqual(0.01);
    // Gate B 28.10.2026 Nr 39: Bedeutungen von «BR 0» und (Antwort 29.10.2026) «KR» aus der Vorlage.
    for (const [k, soll] of [
      ['BR 0', 'Bataillonsrapport KVK'],
      ['KR', 'Kompanierapport'],
    ] as const) {
      expect(abbreviationsForWeek(L.plan, KVK_WOCHE)).toContain(k);
      expect(
        bedeutungZu(L, kuerzelLauf(L, k, spalte), spalte)?.text.trim(),
        `Bedeutung von «${k}»`,
      ).toBe(soll);
    }
    expect(bedeutungsEreignisse(L)).toEqual([]);
  });

  it('[R-10-53] (P13) KVK mit Bedeutungen im Plan für «DR» und das gewählte Kürzel «QZK» (ohne Vorlagen-Bedeutung): beide fiktiven Texte erscheinen (Planfeld vor Vorlage), einzeilig (CR LF, CR, LF → Leerzeichen), x = Spaltenlinie + ½ Strich + textInsetPt (± 0,01), «Dienstrapport» nicht; Ereignis der Bedeutung je Zeile nach dem des Kürzels', async () => {
    const plan = bedeutungenPlan();
    expect(abbreviationsForWeek(plan, KVK_WOCHE)).toContain(P13.kuerzel);
    const L = await leiste('rahmen-bedeutungen-plan', plan);
    const linie = kuerzelSpaltenlinie(L, 1);
    const spalte = linie.bbox.x;
    for (const [k, text] of [
      ['DR', P13.dr],
      [P13.kuerzel, P13.qzkEinzeilig],
    ] as const) {
      const b = bedeutungZu(L, kuerzelLauf(L, k, spalte), spalte);
      expect(b?.text.trim(), `Bedeutung von «${k}» (einzeilig, E6)`).toBe(text);
      // TR-E102k-06: x = Spaltenlinie + ½ Strich + textInsetPt (V-02k-6, «+ 0,74»), ± 0,01.
      expect(
        Math.abs((b as Zeile).x - (spalte + linie.widthPt / 2 + INSET)),
        `x der Bedeutung von «${k}»`,
      ).toBeLessThanOrEqual(0.01);
    }
    expect(L.info.texts.filter((t) => t.text.includes('Dienstrapport'))).toEqual([]);
    // TR-E102k-06 (Reihenfolge F): je Kürzelzeile das Ereignis des Kürzels, danach das ihrer Bedeutung.
    const lang = langerText(140, 'Lang');
    const planE = ereignisfolgePlan(lang);
    for (const k of EREIGNISFOLGE_KUERZEL)
      expect(abbreviationsForWeek(planE, KVK_WOCHE)).toContain(k);
    const E = await leiste('rahmen-ereignisfolge', planE);
    expect(
      E.fallbacks
        .filter(
          (e) =>
            e.region === 'sidebar' &&
            (e.field === 'abbreviation' || e.field === 'abbreviationMeaning'),
        )
        .map((e) => `${e.kind} ${e.field}`),
    ).toEqual([
      'labelOutside abbreviation',
      'ellipsis abbreviationMeaning',
      'labelOutside abbreviation',
      'ellipsis abbreviationMeaning',
    ]);
  });

  it('[R-10-53] (P14) Bedeutung, die in 5 pt nicht passt, aber in 4,75 pt → verkleinert ohne Ereignis; Bedeutung, die auch in 4,5 pt nicht passt → «…» in 4,5 pt und genau ein Ereignis ellipsis mit field abbreviationMeaning (P8 nach R-7-11)', async () => {
    const K = await kvkLeiste();
    const spalteK = kuerzelSpaltenlinie(K, 1);
    // Breite der Textfläche nach §4: von Spaltenlinie + ½ Strich + textInsetPt bis zum rechten Textrand (S3-2).
    const breite =
      K.b.rechts -
      K.b.rahmenStrich.widthPt / 2 -
      INSET -
      (spalteK.bbox.x + spalteK.widthPt / 2 + INSET);
    const S = kpTemplate().fontSizes.standard;
    const min = kpTemplate().fontSizes.min;
    const w = (t: string, s: number) => measureRuns([{ text: t, weight: 'regular' }], s);
    let mittel = '';
    for (let n = 10; n < 120 && mittel === ''; n++) {
      const t = langerText(n, 'Bed');
      if (w(t, S) > breite + 1 && w(t, S - 0.25) < breite - 1) mittel = t;
    }
    expect(mittel, 'fiktiver Text, der nur in 4,75 pt passt').not.toBe('');
    const lang = langerText(140, 'Lang');
    expect(w(lang, min)).toBeGreaterThan(breite + 5);

    const A = await leiste('rahmen-bedeutung-mittel', bedeutungDrPlan(mittel));
    const spalteA = kuerzelSpaltenlinie(A, 1).bbox.x;
    const a = bedeutungZu(A, kuerzelLauf(A, 'DR', spalteA), spalteA);
    expect(a?.text.trim(), 'verkleinerte Bedeutung ungekürzt').toBe(mittel);
    expect(nahe((a as Zeile).sizePt, S - 0.25, 0.01), `Grösse ${(a as Zeile).sizePt}`).toBe(true);
    expect(bedeutungsEreignisse(A), 'Verkleinern ohne Ereignis').toEqual([]);

    const B = await leiste('rahmen-bedeutung-lang', bedeutungDrPlan(lang));
    const spalteB = kuerzelSpaltenlinie(B, 1).bbox.x;
    const bz = bedeutungZu(B, kuerzelLauf(B, 'DR', spalteB), spalteB);
    expect(bz?.text.trimEnd().endsWith(ELLIPSE), 'Bedeutung mit «…» gekürzt').toBe(true);
    const z = bz as Zeile;
    expect(nahe(z.sizePt, min, 0.01), 'in Mindestgrösse').toBe(true);
    expect(norm(lang).startsWith(norm(z.text.trimEnd().slice(0, -1)))).toBe(true);
    expect(z.x + z.breite).toBeLessThanOrEqual(
      B.b.rechts - B.b.rahmenStrich.widthPt / 2 - INSET + 0.01,
    );
    expect(bedeutungsEreignisse(B)).toEqual([
      {
        kind: 'ellipsis',
        region: 'sidebar',
        weekId: KVK_WOCHE,
        date: null,
        entryId: null,
        piece: null,
        dropped: [],
        field: 'abbreviationMeaning',
        columnId: null,
      },
    ]);
  });

  it('[R-10-53] (P15) Fortsetzungsseite mit verschobenen Kürzelzeilen (45 fiktive gewählte Kürzel): jede Kürzelzeile zeigt ihre Bedeutung rechts auf der Grundlinie des Kürzels (± 0,01) auf derselben Seite, jede Bedeutung genau einmal, verschobene nicht auf Seite 1; die auf der Fortsetzung gekürzte Bedeutung ergibt genau ein Ereignis', async () => {
    const lang = langerText(140, 'Lang');
    const plan = kuerzelVerschobenPlan(lang);
    const L = await leiste('rahmen-kuerzel-verschoben', plan);
    expect(L.info.pages.length).toBeGreaterThanOrEqual(2);
    const codes = abbreviationsForWeek(plan, KVK_WOCHE);
    let verschoben = 0;
    for (const k of codes) {
      const seiten = seitenMit(L.info, k, L.b.xS);
      expect(seiten.length, `Kürzel «${k}» genau einmal`).toBe(1);
      const seite = seiten[0] as number;
      const spalte = kuerzelSpaltenlinie(L, seite).bbox.x;
      const lauf = kuerzelLauf(L, k, spalte);
      const soll = abbreviationMeaning(plan, k, kpTemplate());
      const b = bedeutungZu(L, lauf, spalte);
      if (soll === '') {
        expect(b, `«${k}» ohne Bedeutung`).toBeNull();
        continue;
      }
      expect(b, `Bedeutung von «${k}» auf Seite ${seite}`).not.toBeNull();
      const z = b as Zeile;
      if (soll === lang) {
        expect(z.text.trimEnd().endsWith(ELLIPSE), 'lange Bedeutung gekürzt').toBe(true);
      } else {
        expect(z.text.trim()).toBe(soll);
        expect(
          L.info.texts.filter((t) => t.text.trim() === soll).length,
          `«${soll}» genau einmal`,
        ).toBe(1);
      }
      if (seite > 1) verschoben++;
    }
    expect(verschoben, 'Kürzelzeilen auf der Fortsetzungsseite').toBeGreaterThan(0);
    expect(
      seitenMit(L.info, 'QA45', L.b.xS)[0],
      'das letzte Kürzel ist verschoben',
    ).toBeGreaterThan(1);
    expect(bedeutungsEreignisse(L).length, 'höchstens ein Ereignis je Bedeutung').toBe(1);
  });
});
