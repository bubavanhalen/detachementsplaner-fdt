// Orakel «passt in Standardgrösse» der Eintragstexte (Paket E1-02e, R-10-39 (a); Vertrag E1-02e Notiz «Änderungs-
// notiz Tests Schritt 3» S3-8 (a), S3-9, S3-10; Vertrag E1-02d 2e, V-02d-7, V01, V14). Gemeinsam genutzt von
// tests/wap/property/page/rueckfall.test.ts und den Prüfern B-Kp-103 bis -106 (S3-10: Ausnahme zu H1, Zuordnung
// PDF-Lauf ↔ TextItem über Seite, Text, Grösse, x und Grundlinie ± 0,01).
import { resolveTitle } from '../../../../src/model/wap/derive/agenda';
import type { WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import type { PageModel, Rect, TextItem } from '../../../../src/model/wap/layout/pageModel';
import { breakText } from '../../../../src/model/wap/layout/text/break';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { StyledRun } from '../../../../src/model/wap/layout/text/types';
import { kpTemplate } from '../../../../src/model/wap/template';
import { formatTimeSpec } from '../../../../src/model/wap/time';
import type { Entry, Plan } from '../../../../src/model/wap/types';
import type { PdfTextRun } from '../pdf/read';

export const G = kpTemplate().fontSizes;
export const EPS = 1e-6;

export function textVon(t: TextItem): string {
  return t.runs.map((r) => r.text).join('');
}

function innen(a: Rect, b: Rect): boolean {
  return (
    a.x >= b.x - 0.01 &&
    a.y >= b.y - 0.01 &&
    a.x + a.w <= b.x + b.w + 0.01 &&
    a.y + a.h <= b.y + b.h + 0.01
  );
}

export function styled(runs: readonly { text: string; bold: boolean }[]): StyledRun[] {
  return runs
    .map((r) => ({
      text: r.text.replace(/\r\n?/g, '\n'),
      weight: (r.bold ? 'bold' : 'regular') as StyledRun['weight'],
    }))
    .filter((r) => r.text !== '');
}

/** Läufe ab dem n-ten UTF-16-Zeichen. */
function abZeichen(runs: readonly StyledRun[], n: number): StyledRun[] {
  const aus: StyledRun[] = [];
  let rest = n;
  for (const r of runs) {
    if (rest >= r.text.length) {
      rest -= r.text.length;
      continue;
    }
    aus.push({ text: r.text.slice(rest), weight: r.weight });
    rest = 0;
  }
  return aus;
}

/** Zeilen eines Absatzes mit hängendem Einzug: Zeile 1 auf w1, der Rest auf wR (E3; Einzug auch nach LF). */
export function zeilenzahl(
  runs: readonly StyledRun[],
  w1: number,
  wR: number,
  size: number,
): number | null {
  if (runs.length === 0) return 0;
  if (w1 <= 0.01 || wR <= 0.01) return null;
  const r1 = breakText(runs, { maxWidthPt: w1, sizePt: size, hyphenate: 'ifWordDoesNotFit' });
  const l1 = r1.lines[0];
  if (l1 === undefined) return 0;
  if (r1.lines.length === 1) return r1.fits ? 1 : null;
  const gebraucht =
    l1.runs.map((x) => x.text).join('').length - (l1.endsWithHyphen ? 1 : 0) + l1.trailing.length;
  const rest = abZeichen(runs, gebraucht);
  if (rest.length === 0) return 1;
  const r2 = breakText(rest, { maxWidthPt: wR, sizePt: size, hyphenate: 'ifWordDoesNotFit' });
  if (!r1.fits || !r2.fits) return null;
  return 1 + r2.lines.length;
}

export interface Absatz {
  readonly runs: StyledRun[];
  readonly size: number;
  readonly trennung: 'ifWordDoesNotFit' | 'never';
}

/** Passt ein Satz Absätze in die Fläche (E1-02d 2e «Passen»)? */
export function passt(absaetze: readonly Absatz[], breite: number, hoehe: number): boolean {
  if (breite <= 0.01 || hoehe <= 0.01) return false;
  let summe = 0;
  for (const a of absaetze) {
    if (a.runs.length === 0) continue;
    const r = breakText(a.runs, { maxWidthPt: breite, sizePt: a.size, hyphenate: a.trennung });
    if (!r.fits) return false;
    summe += r.lines.length * lineHeightPt(a.size);
  }
  return summe <= hoehe + EPS;
}

/**
 * Kennzahlen t und U nach E1-02d Notiz Q-032 A2 eines Satzes Absätze bei Zeilenbreite `breite`: t = Zeilen mit
 * eingefügtem Trennstrich (`endsWithHyphen`), U = Zeilen minus nicht leere Absätze.
 */
function kennzahlen(absaetze: readonly Absatz[], breite: number): { t: number; u: number } {
  let t = 0;
  let u = 0;
  for (const a of absaetze) {
    if (a.runs.length === 0) continue;
    const r = breakText(a.runs, { maxWidthPt: breite, sizePt: a.size, hyphenate: a.trennung });
    t += r.lines.filter((l) => l.endsWithHyphen).length;
    u += r.lines.length - 1;
  }
  return { t, u };
}

function stueck(L: WeekPageLayout, entryId: string, frame: Rect): number {
  const g = L.grid.entries.find((x) => x.entryId === entryId);
  return g?.pieces.findIndex((p) => innen(frame, p.rect)) ?? -1;
}

const trim = (s: string) => s.trim();

/** Absätze eines Blocks nach V-02d-7 ohne die entfallenen Arten (Grössen T, S). */
function blockAbsaetze(
  plan: Plan,
  e: Extract<Entry, { type: 'block' }>,
  weg: readonly string[],
  T: number,
  S: number,
): Absatz[] {
  const titel = styled(resolveTitle(plan, e.title));
  const ltg = weg.includes('ltg') ? '' : trim(e.ltg);
  const ort = weg.includes('ort') ? '' : trim(e.ort);
  const ltgOrt =
    ltg !== '' && ort !== '' ? `${ltg} (${ort})` : ltg !== '' ? ltg : ort !== '' ? `(${ort})` : '';
  const zeilen = [
    weg.includes('supplement') ? '' : trim(e.supplement),
    ltgOrt,
    e.printTn && !weg.includes('tn') && trim(e.tn) !== '' ? `Tn: ${trim(e.tn)}` : '',
    e.printTenue && !weg.includes('tenue') && trim(e.tenue) !== '' ? `Tenue ${trim(e.tenue)}` : '',
  ];
  return [
    { runs: titel, size: T, trennung: 'ifWordDoesNotFit' },
    ...zeilen
      .filter((z) => z !== '')
      .map(
        (z): Absatz => ({
          runs: [{ text: z, weight: 'regular' }],
          size: S,
          trennung: 'ifWordDoesNotFit',
        }),
      ),
  ];
}

/** Zeilen eines Textträgers in Lesereihenfolge (rotation 0 nach Grundlinie, 90 von links). */
export function lesefolge(ts: readonly TextItem[]): TextItem[] {
  return [...ts].sort((a, b) => (a.rotation === 0 ? a.baselineY - b.baselineY : a.x - b.x));
}

/**
 * Zahl k ≥ 1 der Zeilen der Zeitzeile ab Stelle `ab` (S3-9): kleinste Zahl aufeinanderfolgender Zeilen, deren
 * getrimmte Texte aneinandergereiht ohne Leerzeichen `soll` ergeben; 0, wenn es keine gibt.
 */
export function zeitzeilen(folge: readonly TextItem[], ab: number, soll: string): number {
  const ziel = soll.replace(/\s/g, '');
  let bisher = '';
  for (let k = 1; ab + k - 1 < folge.length; k++) {
    bisher += textVon(folge[ab + k - 1] as TextItem)
      .trim()
      .replace(/\s/g, '');
    if (bisher === ziel) return k;
    if (!ziel.startsWith(bisher)) return 0;
  }
  return 0;
}

/** Textträger: Eintragstexte gruppiert nach Seite, Eintrag, Rolle und Textfläche. */
export function traegerGruppen(L: WeekPageLayout): TextItem[][] {
  const gruppen = new Map<string, TextItem[]>();
  for (const r of L.texts) {
    if (r.kind !== 'entry') continue;
    const t = (L.pages[r.page] as PageModel).items[r.item] as TextItem;
    const k = `${r.page}|${t.entryId ?? ''}|${t.role}|${JSON.stringify(t.frame)}`;
    gruppen.set(k, [...(gruppen.get(k) ?? []), t]);
  }
  return [...gruppen.values()];
}

export interface Bewertung {
  readonly id: string;
  readonly rolle: TextItem['role'];
  /** Kleiner als die Standardgrösse der Art (Stufe d > 0). */
  readonly verkleinert: boolean;
  /** Ereignis ellipsis oder textOmitted für dieses Teilstück. */
  readonly gekuerzt: boolean;
  /** Passen die Absätze (ohne entfallene, mit Zeitzeile) in Standardgrösse in der gezeichneten Ausrichtung? */
  readonly passtStandard: boolean;
  /** Nur Rapport-Kästchen: Passen sie in Standardgrösse waagrecht? */
  readonly waagrechtPasstStandard: boolean | null;
  /**
   * Nur Rapport-Kästchen: Wählt E1-02d Notiz Q-032 A3 Stufe 5 in Standardgrösse senkrecht? Das heisst, die Absätze
   * passen waagrecht und senkrecht, und es gilt t(S) < t(W) und U(S) ≤ U(W).
   */
  readonly senkrechtStufe5: boolean | null;
}

/**
 * Bewertung eines Textträgers nach R-10-39 (a). Bei gekürztem Text (ellipsis) gilt passtStandard = false: er passt
 * nach E1-02d 2e nicht einmal in Mindestgrösse, also auch nicht in Standardgrösse.
 */
export function bewerte(L: WeekPageLayout, plan: Plan, ts: readonly TextItem[]): Bewertung | null {
  const t0 = ts[0] as TextItem;
  const id = t0.entryId ?? '';
  const e = plan.entries[id];
  if (e === undefined) return null;
  const p = stueck(L, id, t0.frame);
  const ev = L.fallbacks.filter((f) => f.entryId === id && f.piece === p && f.region === 'block');
  const gekuerzt = ev.some((f) => f.kind === 'ellipsis' || f.kind === 'textOmitted');
  const weg = ev.flatMap((f) => f.dropped);
  const senkrecht = t0.rotation !== 0;
  const breite = senkrecht ? t0.frame.h : t0.frame.w;
  const hoehe = senkrecht ? t0.frame.w : t0.frame.h;
  const gross = Math.max(...ts.map((x) => x.sizePt));
  const folge = lesefolge(ts);
  const zeitAbsatz = (ab: number): Absatz[] => {
    if (e.type !== 'block' && e.type !== 'rapport') return [];
    const soll = formatTimeSpec(e.time, e.date);
    return zeitzeilen(folge, ab, soll) > 0
      ? [{ runs: [{ text: soll, weight: 'regular' }], size: G.standard, trennung: 'never' }]
      : [];
  };
  const ortAbsatz = (o: string): Absatz[] =>
    weg.includes('ort') || trim(o) === ''
      ? []
      : [
          {
            runs: [{ text: `(${trim(o)})`, weight: 'regular' }],
            size: G.standard,
            trennung: 'ifWordDoesNotFit',
          },
        ];
  const basis = { id, rolle: t0.role, gekuerzt };
  if (t0.role === 'block' && e.type === 'block') {
    const abs = [...zeitAbsatz(0), ...blockAbsaetze(plan, e, weg, G.blockTitle, G.standard)];
    return {
      ...basis,
      verkleinert: gross < G.blockTitle - EPS,
      passtStandard: !gekuerzt && passt(abs, breite, hoehe),
      waagrechtPasstStandard: null,
      senkrechtStufe5: null,
    };
  }
  if (t0.role === 'block' && e.type === 'rapport') {
    const abs: Absatz[] = [
      ...zeitAbsatz(0),
      { runs: [{ text: e.code, weight: 'bold' }], size: G.blockTitle, trennung: 'never' },
      ...ortAbsatz(e.ort),
    ];
    return {
      ...basis,
      verkleinert: gross < G.blockTitle - EPS,
      passtStandard: !gekuerzt && passt(abs, breite, hoehe),
      waagrechtPasstStandard: null,
      senkrechtStufe5: null,
    };
  }
  if (t0.role === 'rapport' && e.type === 'rapport') {
    const kuerzel = folge.findIndex((x) => !x.runs.every((r) => r.weight === 'bold'));
    const ab = kuerzel < 0 ? folge.length : kuerzel;
    const abs: Absatz[] = [
      { runs: [{ text: e.code, weight: 'bold' }], size: G.rapportCode, trennung: 'never' },
      ...zeitAbsatz(ab),
      ...ortAbsatz(e.ort),
    ];
    return {
      ...basis,
      verkleinert: gross < G.rapportCode - EPS,
      passtStandard: !gekuerzt && passt(abs, breite, hoehe),
      waagrechtPasstStandard: !gekuerzt && passt(abs, t0.frame.w, t0.frame.h),
      senkrechtStufe5:
        !gekuerzt &&
        passt(abs, t0.frame.w, t0.frame.h) &&
        passt(abs, t0.frame.h, t0.frame.w) &&
        kennzahlen(abs, t0.frame.h).t < kennzahlen(abs, t0.frame.w).t &&
        kennzahlen(abs, t0.frame.h).u <= kennzahlen(abs, t0.frame.w).u,
    };
  }
  const std = t0.role === 'besoBox' ? G.besoNumber : G.standard;
  const runs = t0.runs.map((r) => ({ text: r.text, weight: r.weight }));
  const passtEinzeilig = measureRuns(runs, std) <= breite + EPS && lineHeightPt(std) <= hoehe + EPS;
  return {
    ...basis,
    verkleinert: gross < std - EPS,
    passtStandard: !gekuerzt && passtEinzeilig,
    waagrechtPasstStandard: null,
    senkrechtStufe5: null,
  };
}

/** TextItem eines Eintragstexts zu einem PDF-Lauf: Seite, Text, Grösse, x und Grundlinie ± 0,01 (S3-10). */
export function itemZuLauf(L: WeekPageLayout, t: PdfTextRun): TextItem | undefined {
  const seite = L.pages[t.page - 1];
  if (seite === undefined) return undefined;
  for (const it of seite.items) {
    if (it.kind !== 'text' || it.entryId === undefined) continue;
    if (Math.abs(it.sizePt - t.sizePt) > 0.01) continue;
    let versatz = 0;
    for (const r of it.runs) {
      const x = it.rotation === 0 ? it.x + versatz : it.x;
      const y =
        it.rotation === 0
          ? it.baselineY
          : it.rotation === 90
            ? it.baselineY - versatz
            : it.baselineY + versatz;
      if (r.text === t.text && Math.abs(x - t.x) <= 0.01 && Math.abs(y - t.baselineY) <= 0.01)
        return it;
      versatz += measureRuns([{ text: r.text, weight: r.weight }], it.sizePt);
    }
  }
  return undefined;
}
