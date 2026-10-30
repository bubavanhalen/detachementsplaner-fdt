// Fiktive Varianten und PDF-Hilfen für die Nachträge der Gate-S-Auflagen A3 und A4 und die Bedeutungsspalte
// (Paket E1-02k, Vertrag docs/wap-planer/plan/vertraege/E1-02k.md §2, §4, §6, §9). Alle Varianten entstehen im
// Testcode aus der pseudonymisierten KVK-Fixture bzw. aus den Bausteinen von tests/wap/support/model/builders.ts;
// alle neuen Texte und Kürzel sind erfunden. Die PDF-Hilfen lesen nur `readPdf` (H1); Sollwerte aus der CSV.
import { expect } from 'vitest';
import { remarksForWeek } from '../../../../src/model/wap/derive/remarks';
import { GRID_CONSTANTS } from '../../../../src/model/wap/layout/grid';
import { ascentPt, lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { Entry, Plan, WeekGoal } from '../../../../src/model/wap/types';
import { block, CAT, multiDayRemark, rapport, rt } from '../model/builders';
import type { PdfInfo, PdfStroke, PdfTextRun, Rect } from '../pdf/read';
import { leseBkp, ZAHL } from './bkp';
import {
  type Bereiche,
  istSenkrecht,
  istWaagrecht,
  type LinienStil,
  laeufe,
  nahe,
  passtStil,
  striche,
  umriss,
} from './pdf-seite';
import { bkpZahlen, strichAus } from './stile';
import { eintagPlan, KVK_WOCHE, kvk, MO, mitEintraegen, mitWoche, woche } from './varianten';

/** Innenabstand der Texte (E1-02d 2e, `textInsetPt`). */
export const INSET = GRID_CONSTANTS.textInsetPt;

// ---------------------------------------------------------------------------------------------------------
// Sollwerte aus der CSV (B-Kp-45, -113 bis -119)
// ---------------------------------------------------------------------------------------------------------

export interface LeistenSoll {
  /** Regel T 0,48 durchgezogen (B-Kp-115). */
  readonly T: LinienStil;
  /** Feine Regel F 0,12 durchgezogen (B-Kp-116). */
  readonly F: LinienStil;
  /** Stil der Stundenlinie (B-Kp-45). */
  readonly Std: LinienStil;
  /** Linie am Abschluss am Raster (B-Kp-118). */
  readonly E: LinienStil;
  /** Linien der Wochenziele-Titelzeile (B-Kp-113). */
  readonly S1: LinienStil;
  /** Seitenleistenlinie (B-Kp-119). */
  readonly kante: LinienStil;
  /** Titel- und Kopfzeilenhöhe in h (B-Kp-115, -117) und ihre Toleranz in h. */
  readonly zeileH: number;
  readonly zeileTolH: number;
  /** Abschnittsabstand in h und seine Toleranz in pt (B-Kp-114). */
  readonly abstandH: number;
  readonly abstandTol: number;
  /** Toleranz der Linienenden in pt (B-Kp-113). */
  readonly endenTol: number;
}

/** Sollwerte der Seitenleiste aus der CSV (Formmuster; Zahlen nur aus der CSV). */
export function leistenSoll(): LeistenSoll {
  const d = leseBkp();
  const zeile = bkpZahlen(
    'B-Kp-115',
    'sollwert',
    new RegExp(`^${ZAHL}; Zeilenhöhe (${ZAHL}) × h$`),
  );
  const zeileTol = bkpZahlen('B-Kp-115', 'toleranz', new RegExp(`^±${ZAHL} pt; ±(${ZAHL}) h$`));
  const abstand = bkpZahlen('B-Kp-114', 'sollwert', new RegExp(`^${ZAHL}; Abstand (${ZAHL}) × h$`));
  const abstandTol = bkpZahlen(
    'B-Kp-114',
    'toleranz',
    new RegExp(`^±${ZAHL} pt; Enden ±${ZAHL} pt; Abstand ±(${ZAHL}) pt$`),
  );
  const enden = bkpZahlen('B-Kp-113', 'toleranz', new RegExp(`^±${ZAHL} pt; Enden ±(${ZAHL}) pt$`));
  return {
    T: strichAus(d, 'B-Kp-115'),
    F: strichAus(d, 'B-Kp-116'),
    Std: strichAus(d, 'B-Kp-45'),
    E: strichAus(d, 'B-Kp-118'),
    S1: strichAus(d, 'B-Kp-113'),
    kante: strichAus(d, 'B-Kp-119'),
    zeileH: zeile[0] as number,
    zeileTolH: zeileTol[0] as number,
    abstandH: abstand[0] as number,
    abstandTol: abstandTol[0] as number,
    endenTol: enden[0] as number,
  };
}

// ---------------------------------------------------------------------------------------------------------
// PDF-Hilfen der Seitenleiste
// ---------------------------------------------------------------------------------------------------------

/** Zeilenkasten eines Laufs (Grundlinie − Oberlänge der Metrik, Höhe `lineHeightPt`; E1-02b). */
export function zeilenkasten(t: PdfTextRun): { top: number; bottom: number } {
  const top = t.baselineY - ascentPt(t.sizePt);
  return { top, bottom: top + lineHeightPt(t.sizePt) };
}

/**
 * Waagrechte Regeln der Seitenleiste einer Seite: Linien von `x0` (Standard xS) bis zum Rahmen rechts, beide
 * Enden ± `tol`; nach y sortiert.
 */
export function regeln(
  info: PdfInfo,
  seite: number,
  x0: number,
  rechts: number,
  tol = 0.5,
): PdfStroke[] {
  return striche(info, seite)
    .filter(istWaagrecht)
    .filter((s) => nahe(s.bbox.x, x0, tol) && nahe(s.bbox.x + s.bbox.w, rechts, tol))
    .sort((a, b) => a.bbox.y - b.bbox.y);
}

/** Senkrechte Linien auf `x` (± tol), nach oberem Ende sortiert. */
export function senkrechteBei(info: PdfInfo, seite: number, x: number, tol = 0.5): PdfStroke[] {
  return striche(info, seite)
    .filter(istSenkrecht)
    .filter((s) => nahe(s.bbox.x, x, tol))
    .sort((a, b) => a.bbox.y - b.bbox.y);
}

/** Regeln mit y = `y` (± tol). */
export function regelnBei(rs: readonly PdfStroke[], y: number, tol = 0.01): PdfStroke[] {
  return rs.filter((s) => nahe(s.bbox.y, y, tol));
}

/** Nächste Regel über bzw. auf `y` (+ 0,01); Assertion, wenn keine. */
export function regelUeber(rs: readonly PdfStroke[], y: number, was: string): PdfStroke {
  const l = rs.filter((s) => s.bbox.y <= y + 0.01);
  expect(l.length, `Regel über ${was}`).toBeGreaterThan(0);
  return l[l.length - 1] as PdfStroke;
}

/** Nächste Regel unter bzw. auf `y` (− 0,01); Assertion, wenn keine. */
export function regelUnter(rs: readonly PdfStroke[], y: number, was: string): PdfStroke {
  const l = rs.filter((s) => s.bbox.y >= y - 0.01);
  expect(l.length, `Regel unter ${was}`).toBeGreaterThan(0);
  return l[0] as PdfStroke;
}

/** Liegt y auf einer Stundenlinie (± 0,01; Vertrag E1-02k 2.2 Punkt 11)? */
export function aufStunde(y: number, stundenYs: readonly number[]): boolean {
  return stundenYs.some((s) => Math.abs(s - y) <= 0.01);
}

/**
 * Strich einer Regel 0,48 nach der Stundenregel (2.2 Punkt 11): auf einer Stundenlinie im Stil B-Kp-45, sonst
 * durchgezogen nach `T`. Auf Fortsetzungsseiten ist `stundenYs` leer (alle durchgezogen).
 */
export function erwarteRegelStil(
  s: PdfStroke,
  soll: LeistenSoll,
  stundenYs: readonly number[],
  was: string,
): void {
  const stil = aufStunde(s.bbox.y, stundenYs) ? soll.Std : soll.T;
  expect(
    passtStil(s, stil),
    `${was} bei y ${s.bbox.y.toFixed(3)}: Strich ${s.widthPt} ${JSON.stringify(s.dash)} statt ${stil.breite} ${JSON.stringify(stil.muster)}`,
  ).toBe(true);
}

/** Genau ein Lauf mit diesem Text auf der Seite rechts von xS (Seitenleiste). */
export function leistenLauf(info: PdfInfo, seite: number, xS: number, text: string): PdfTextRun {
  const l = laeufe(info, seite).filter((t) => t.text.trim() === text && t.x >= xS - 0.01);
  expect(l.length, `genau ein Lauf «${text}» in der Seitenleiste von Seite ${seite}`).toBe(1);
  return l[0] as PdfTextRun;
}

/** Liegt der Umriss des Laufs senkrecht zwischen y0 und y1 (± 0,01)? */
export function zwischenY(t: PdfTextRun, y0: number, y1: number): boolean {
  const u = umriss(t);
  return u.y >= y0 - 0.01 && u.y + u.h <= y1 + 0.01;
}

/** Rechteck der Seitenleiste oberhalb y(to) (xS … Rahmen rechts, yK … y(to)). */
export function leisteOben(b: Bereiche): Rect {
  return { x: b.xS, y: b.yK, w: b.rechts - b.xS, h: b.yTo - b.yK };
}

/** Stundenlagen aus den Stundenlinien des PDF (H2). */
export function stundenLagen(stunden: readonly { readonly y: number }[]): number[] {
  return stunden.map((s) => s.y);
}

// ---------------------------------------------------------------------------------------------------------
// Fiktive Varianten (Vertrag E1-02k §6a)
// ---------------------------------------------------------------------------------------------------------

/** Fiktive Wochenziele «Ziel 01 fiktiv» …, Gruppe wie das erste Ziel der Fixture. */
export function fiktiveZiele(
  n: number,
  text = (i: number) => `Ziel ${String(i + 1).padStart(2, '0')} fiktiv`,
): WeekGoal[] {
  const gruppe = woche(kvk(), KVK_WOCHE).weekGoals[0]?.group ?? null;
  return Array.from({ length: n }, (_, i) => ({ id: `zf${i + 1}`, text: text(i), group: gruppe }));
}

/** P4: KVK ohne Wochenziele. */
export function ohneZielePlan(): Plan {
  return mitWoche(kvk(), KVK_WOCHE, { weekGoals: [] });
}

/** P2: je ein Rapport KR, DR, AR1, AR2, ARK, BR 0 bis BR 3 und das frei gewählte Kürzel «QX» in der Rap-Spalte. */
export const P2_KUERZEL = [
  'KR',
  'DR',
  'AR1',
  'AR2',
  'ARK',
  'BR 0',
  'BR 1',
  'BR 2',
  'BR 3',
  'QX',
] as const;

export function rapportePlan(): Plan {
  const rs: Entry[] = P2_KUERZEL.map((code, i) =>
    rapport(`e${960 + i}`, 960 + i, {
      date: MO,
      code,
      time: { form: 'range', from: 300 + 60 * i, to: 345 + 60 * i },
      categoryId: CAT.kp,
      display: 'rapColumn',
    }),
  );
  return eintagPlan(rs);
}

/** P11: KVK mit 60 einzeiligen fiktiven Zielen; Ziele und Bemerkungen gehen teils auf die Fortsetzungsseite. */
export function zieleUndBemerkungenPlan(): Plan {
  return mitWoche(kvk(), KVK_WOCHE, { weekGoals: fiktiveZiele(60) });
}

/**
 * P13: Bedeutungen im Plan für «DR» und das gewählte Kürzel «QZK» (in einer fiktiven Wochenbemerkung). Die Bedeutung
 * von «QZK» enthält CR LF, CR und LF (E6: je ein Leerzeichen, einzeilig; TR-E102k-06).
 */
export const P13 = {
  kuerzel: 'QZK',
  dr: 'Fiktiver Tagesrapport',
  qzk: 'Fiktive\r\nBedeutung\rdes\nKürzels',
  qzkEinzeilig: 'Fiktive Bedeutung des Kürzels',
  bemerkung: 'Treffpunkt QZK beim Eingang (fiktiv).',
} as const;

/**
 * P13 (TR-E102k-06, Reihenfolge F): zwei gewählte fiktive Kürzel, die selbst nicht in die Kürzelspalte passen, je
 * mit einer Bedeutung, die auch in Mindestgrösse nicht passt. Erwartet: je Zeile das Ereignis des Kürzels, dann das
 * der Bedeutung.
 */
export const EREIGNISFOLGE_KUERZEL = ['QZKLANGESKUERZEL', 'QZKZWEITESLANGES'] as const;

export function ereignisfolgePlan(lang: string): Plan {
  const p = kvk();
  const [a, b] = EREIGNISFOLGE_KUERZEL;
  return mitEintraegen(
    {
      ...p,
      abbreviationsSelected: [...p.abbreviationsSelected, a, b],
      abbreviationMeanings: { [a]: lang, [b]: lang },
    },
    [
      multiDayRemark('e972', 972, {
        text: `Fiktive Bemerkung mit ${a} und ${b}.`,
        scope: { kind: 'week', weekId: KVK_WOCHE },
      }),
    ],
  );
}

export function bedeutungenPlan(): Plan {
  const p = kvk();
  const mit: Plan = {
    ...p,
    abbreviationsSelected: [...p.abbreviationsSelected, P13.kuerzel],
    abbreviationMeanings: { DR: P13.dr, [P13.kuerzel]: P13.qzk },
  };
  return mitEintraegen(mit, [
    multiDayRemark('e970', 970, {
      text: P13.bemerkung,
      scope: { kind: 'week', weekId: KVK_WOCHE },
    }),
  ]);
}

/** P14: KVK mit eigener Bedeutung für «DR». */
export function bedeutungDrPlan(text: string): Plan {
  return { ...kvk(), abbreviationMeanings: { DR: text } };
}

/**
 * P15: 45 gewählte fiktive Kürzel «QA01» … «QA45» mit Bedeutung «Bedeutung 01» …, alle im Zusatz eines fiktiven
 * Blocks am Mo; die Kürzelzeilen gehen teils auf die Fortsetzungsseite. Die Bedeutung des letzten Kürzels ist
 * `lang` (Kürzung auf der Fortsetzungsseite).
 */
export function kuerzelVerschobenPlan(lang: string): Plan {
  const codes = Array.from({ length: 45 }, (_, i) => `QA${String(i + 1).padStart(2, '0')}`);
  const bedeutungen: Record<string, string> = Object.fromEntries(
    codes.map((c, i) => [
      c,
      i === codes.length - 1 ? lang : `Bedeutung ${String(i + 1).padStart(2, '0')}`,
    ]),
  );
  const p = kvk();
  return mitEintraegen({ ...p, abbreviationsSelected: codes, abbreviationMeanings: bedeutungen }, [
    block('e980', 980, {
      date: MO,
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'all' },
      title: rt('Kürzeltest', true),
      supplement: codes.join(' '),
      categoryId: CAT.kp,
    }),
  ]);
}

/**
 * P16: KVK mit 70 fiktiven Zielen, ohne Bemerkungen (ausgeblendet), ohne Rapporte und ohne Legendenzeilen; so sind
 * die Ziele auf der Fortsetzungsseite der letzte Abschnitt.
 */
export function zieleLetzterAbschnittPlan(): Plan {
  return ohneTabellenzeilen(
    mitWoche(kvk(), KVK_WOCHE, {
      weekGoals: fiktiveZiele(70),
      hiddenRemarkIds: remarksForWeek(kvk(), KVK_WOCHE).map((r) => r.id),
    }),
  );
}

/** Plan ohne Rapporte und ohne Legendenzeilen (alle Kategorien `inLegend: false`): keine Tabellenzeilen. */
export function ohneTabellenzeilen(p: Plan): Plan {
  return {
    ...p,
    entries: Object.fromEntries(Object.entries(p.entries).filter(([, e]) => e.type !== 'rapport')),
    legend: p.legend.map((c) => ({ ...c, inLegend: false })),
  };
}

/** P7/P8 (TR-E102k-02): KVK ohne Kürzel- und Legendenzeilen. */
export function ohneTabellenzeilenPlan(): Plan {
  return ohneTabellenzeilen(kvk());
}

/** P17: Wochenbemerkung ohne Text und ohne Nummer (fiktiv, Entscheid V02). */
export const LEERE_BEMERKUNG = 'e990';

export function leereBemerkungPlan(): Plan {
  return mitEintraegen(kvk(), [
    multiDayRemark(LEERE_BEMERKUNG, 1, {
      text: '',
      number: null,
      scope: { kind: 'week', weekId: KVK_WOCHE },
    }),
  ]);
}

/**
 * P18: Anzeigebereich 0500–2155 und zwei einzeilige Ziele «Ziel 1», «Ziel 2», keine Erhöhte Bereitschaft (Vertrag
 * E1-02k §6a, Entscheid Nr 20).
 */
export function stundenPlan(): Plan {
  return stundenVariante(2, 300, 1315);
}

/**
 * Fiktive Variante der Stundenregel: KVK, w26 ohne Erhöhte Bereitschaft, `ziele` einzeilige Ziele «Ziel 1» …,
 * Anzeigebereich `from` bis `to` (P18; Orchestrator-Zeile Test-Review Runde 1 (a), (c)).
 */
export function stundenVariante(ziele: number, from: number, to: number): Plan {
  const p = mitWoche(kvk(), KVK_WOCHE, {
    weekGoals: fiktiveZiele(ziele, (i) => `Ziel ${i + 1}`),
    heightenedReadiness: '',
  });
  return { ...p, displayRange: { from, to } };
}
