// Auswertung eines Blatts der Kp-Mappe (Beschrieb 8.2 Regeln 1–12; ADR-008 Entscheid 3; Gate S A1, A2).
// Ergebnis ist ein Entwurf ohne Plan-IDs: Tage mit Spalten, Eintragsentwürfe und Berichtseinträge. Die
// IDs vergibt assemble.ts. Rein (kein DOM ausser den gelesenen Knoten, keine Uhr).

import { addDays, isIsoDate } from '../../model/wap/calendar';
import type { UserMessage } from '../../model/wap/errors';
import { formatMilTime } from '../../model/wap/time';
import type {
  ColumnKind,
  ColumnWeight,
  DayDisplay,
  EntryStatus,
  Id,
  IsoDate,
  LtgCategory,
  MarkerKind,
  Plan,
  RichText,
  Subtask,
  TimeSpec,
  Weekday,
} from '../../model/wap/types';
import {
  type CellRichRun,
  calibrateSheetTime,
  detectSheetLayout,
  type ReadSheet,
  type ShapeTextRun,
  type SheetColumn,
  type SheetLayout,
  type SheetTimeScale,
  type WapShape,
} from '../xlsx-drawing/index';
import { type ParsedAgendaLine, parseAgendaLine } from './agenda-text';
import { type ColorCandidate, hexToRgb, nearestColor, onWhite } from './colors';
import { cleanText, type FormTextContext, parseShapeText } from './formtext';
import { coveredShare, overlap1d, type Rect, visibleSpan } from './geometry';
import { visibleTextLines } from './textfit';
import { rowTimeScale } from './timescale';
import type { ImportReportKind } from './types';

export const WEEKDAYS: readonly Weekday[] = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

// ---------------------------------------------------------------------------------------------------------
// Entwürfe

export interface ColumnDraft {
  readonly name: string;
  readonly kind: ColumnKind;
  readonly weight: ColumnWeight;
  /** Ganze Breite samt zugeschlagener Zwischenspalte (Regel 7). */
  readonly x0: number;
  readonly x1: number;
  /** Beschriftete Breite ohne Zwischenspalte; massgebend für die Überdeckung. */
  readonly core0: number;
  readonly core1: number;
}

export interface DayDraft {
  readonly weekday: Weekday;
  readonly date: IsoDate;
  readonly display: DayDisplay;
  /** In Anzeigereihenfolge (planning*, secondary?, rap, beso); null bei ausgeblendetem Tag. */
  columns: ColumnDraft[] | null;
  readonly x0: number;
  readonly x1: number;
}

/** Spaltenauswahl über Indizes in `DayDraft.columns`. */
export type ColumnPick =
  | { readonly kind: 'all' }
  | { readonly kind: 'index'; readonly indexes: readonly number[] };

interface DraftBase {
  /** Lokaler Schlüssel, eindeutig in der Arbeitsmappe. */
  readonly key: string;
  readonly shapes: readonly number[];
  readonly status: EntryStatus;
  readonly changed: boolean;
  readonly removedText: readonly string[];
}
export interface BlockDraft extends DraftBase {
  readonly type: 'block';
  readonly weekday: Weekday;
  readonly time: Extract<TimeSpec, { form: 'range' }>;
  columns: ColumnPick;
  readonly title: RichText;
  readonly supplement: string;
  readonly ltg: string;
  readonly ort: string;
  readonly tenue: string;
  readonly categoryId: Id;
  readonly secondCategoryId: Id | null;
  readonly openEnd: boolean;
  readonly subtasks: readonly Subtask[];
  /** Ungerundete Kanten in Minuten (Regel 4). */
  readonly rawFrom: number;
  readonly rawTo: number;
  readonly box: Rect;
}
export interface QuerbalkenDraft extends DraftBase {
  readonly type: 'querbalken';
  readonly title: RichText;
  readonly fromDate: IsoDate;
  readonly toDate: IsoDate;
  readonly categoryId: Id | null;
}
export interface MarkerDraft extends DraftBase {
  readonly type: 'marker';
  readonly weekday: Weekday;
  readonly at: number;
  readonly kind: MarkerKind;
  readonly customKind: string;
  readonly columns: ColumnPick;
  readonly asFlatBlock: boolean;
  /** Dauer als flacher Block (Kästchen mit Marker-Text und eigener Höhe), sonst null. */
  readonly flatBlockMinutes: number | null;
}
export interface RapportDraft extends DraftBase {
  readonly type: 'rapport';
  readonly weekday: Weekday;
  readonly code: string;
  readonly time: Extract<TimeSpec, { form: 'point' | 'range' }>;
  readonly ort: string;
  readonly categoryId: Id;
  inRap: boolean;
  displayColumns: ColumnPick | null;
}
export interface BesoWindowDraft {
  readonly time: TimeSpec;
  /** Index in den Spalten des Tags oder null (Beso-Spalte). */
  readonly column: number | null;
  readonly supplement: string;
}
export interface BesoDraft extends DraftBase {
  readonly type: 'beso';
  readonly date: IsoDate;
  readonly title: RichText;
  readonly windows: readonly BesoWindowDraft[];
  readonly ltg: string;
  readonly tn: string;
  readonly tpt: string;
  readonly ort: string;
  readonly categoryId: Id;
  readonly besoNumber: number;
  readonly agendaOverride: string | null;
}
export interface DayRemarkDraft extends DraftBase {
  readonly type: 'dayRemark';
  readonly date: IsoDate;
  readonly text: string;
}
export interface MultiDayRemarkDraft extends DraftBase {
  readonly type: 'multiDayRemark';
  readonly text: string;
  readonly number: number | null;
}
export type EntryDraft =
  | BlockDraft
  | QuerbalkenDraft
  | MarkerDraft
  | RapportDraft
  | BesoDraft
  | DayRemarkDraft
  | MultiDayRemarkDraft;

export interface ReportDraft {
  readonly kind: ImportReportKind;
  readonly message: UserMessage;
  readonly date: IsoDate | null;
  readonly entryKey: string | null;
  readonly shapeIndex: number | null;
  readonly box: Rect | null;
  readonly group: { readonly count: number; readonly members: readonly string[] } | null;
  readonly besoNumber: number | null;
  /** Ursprüngliche Zeitspanne der Form in Minuten (auf 5 Min gerundet), sonst null. */
  readonly span: { readonly from: number; readonly to: number } | null;
  /** Nicht übernommener Text, nur für die Anzeige im Bericht (ImportReportItem.notTakenText). */
  readonly notTakenText?: readonly string[];
}

export interface SheetDraft {
  readonly sheet: string;
  readonly shortName: string;
  readonly label: string;
  readonly startDate: IsoDate;
  readonly days: readonly DayDraft[];
  readonly entries: readonly EntryDraft[];
  readonly reports: readonly ReportDraft[];
  readonly weekGoals: readonly string[];
  readonly heightenedReadiness: string;
  readonly sun: { readonly sunrise: number | null; readonly sunset: number | null };
  readonly motto: string;
  readonly unit: string;
  readonly beilage: string;
  readonly standDate: IsoDate | null;
  readonly abbreviations: ReadonlyMap<string, string>;
  /** Je Form ihre Rolle (zugeordnet) oder null (nicht zugeordnet). */
  readonly shapeRoles: readonly (string | null)[];
}

export interface SheetContext {
  readonly plan: Plan;
  readonly formText: FormTextContext;
  readonly date1904: boolean;
  readonly rapportCodes: readonly string[];
  /** Schlüssel-Präfix für Einträge dieses Blatts. */
  readonly prefix: string;
}

// ---------------------------------------------------------------------------------------------------------
// Hilfen

const cx = (b: Rect): number => (b.x0 + b.x1) / 2;
const cy = (b: Rect): number => (b.y0 + b.y1) / 2;
const round5 = (m: number): number => Math.floor(m / 5 + 0.5) * 5;
const msg = (cause: string, nextStep: string): UserMessage => ({ cause, nextStep });
const hhmm = (m: number): string => formatMilTime(Math.max(0, Math.min(2880, round5(m))));
const textOf = (s: WapShape): string =>
  cleanText(s.lines.filter((l) => l.trim() !== '').join(' ')).trim();

/** Kurzname nach Beschrieb 4.2: «KVK», «Wo1» … aus dem Blattnamen. */
export function shortNameOf(sheetName: string): string {
  const name = sheetName.trim();
  const m = /^w(?:o(?:che)?)?\.?\s*(\d+)$/i.exec(name);
  if (m !== null) return `Wo${m[1] ?? ''}`;
  return name.replace(/\s+/g, '').slice(0, 12) || 'Woche';
}

function serialToIso(serial: number, date1904: boolean): IsoDate {
  const days = Math.floor(serial) + (date1904 ? 1462 : 0);
  return new Date(Date.UTC(1899, 11, 30) + days * 86_400_000).toISOString().slice(0, 10);
}

function dateFromText(text: string, refYear: number): IsoDate | null {
  const m = /(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})?/.exec(text);
  if (m === null) return null;
  const y = m[3] === undefined ? refYear : m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  const iso = `${String(y).padStart(4, '0')}-${(m[2] ?? '').padStart(2, '0')}-${(m[1] ?? '').padStart(2, '0')}`;
  return isIsoDate(iso) ? iso : null;
}

/** Spalten, die eine x-Spanne überdeckt: Überlappung ≥ 50 % der Spaltenbreite, sonst die mit der grössten Überlappung. */
function coveredColumns(columns: readonly ColumnDraft[], x0: number, x1: number): number[] {
  const out: number[] = [];
  let best = -1;
  let bestOverlap = 0;
  columns.forEach((c, i) => {
    const width = c.core1 - c.core0;
    const o = overlap1d(c.core0, c.core1, x0, x1);
    if (width > 0 && o >= width * 0.5) out.push(i);
    if (o > bestOverlap) {
      bestOverlap = o;
      best = i;
    }
  });
  if (out.length === 0 && best >= 0) out.push(best);
  if (out.length === 0) {
    // Ganz in einer unbeschrifteten Zwischenspalte: sie gehört zur linken Nachbarspalte, deren Spanne sie
    // einschliesst (normalisierung 7, F-32; Befund FA-06).
    columns.forEach((c, i) => {
      const o = overlap1d(c.x0, c.x1, x0, x1);
      if (o > bestOverlap) {
        bestOverlap = o;
        best = i;
      }
    });
    if (best >= 0) out.push(best);
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------
// Tage und Spalten (Regel 7, F-32)

function weightOf(width: number, normal: number): ColumnWeight {
  if (normal <= 0) return 'normal';
  const ratio = width / normal;
  return ratio < 0.7 ? 'narrow' : ratio > 1.45 ? 'wide' : 'normal';
}

function dayColumnsOf(columns: readonly SheetColumn[]): {
  columns: ColumnDraft[];
  merged: boolean;
} {
  const out: {
    name: string;
    kind: ColumnKind;
    x0: number;
    x1: number;
    core0: number;
    core1: number;
  }[] = [];
  let merged = false;
  let pendingLeft: number | null = null;
  const labelledWidths = columns
    .filter((c) => c.kind !== 'unlabeled')
    .map((c) => c.x1 - c.x0)
    .sort((a, b) => a - b);
  const typical = labelledWidths[Math.floor(labelledWidths.length / 2)] ?? 0;
  for (const c of columns) {
    if (c.kind === 'unlabeled') {
      // Ein schmaler Rest (unter 30 % einer Spalte, z.B. bis zur Zeitachse) ist keine Zwischenspalte.
      if (c.x1 - c.x0 >= typical * 0.3) merged = true;
      const last = out.at(-1);
      if (last !== undefined) last.x1 = c.x1;
      else pendingLeft = Math.min(pendingLeft ?? c.x0, c.x0);
      continue;
    }
    const kind: ColumnKind = c.kind === 'rap' ? 'rap' : c.kind === 'beso' ? 'beso' : 'planning';
    out.push({ name: c.name, kind, x0: pendingLeft ?? c.x0, x1: c.x1, core0: c.x0, core1: c.x1 });
    pendingLeft = null;
  }
  // Reihenfolge planning*, rap, beso (R-2-02): fehlende Rap- bzw. Beso-Spalte wird ohne Breite ergänzt.
  const planning = out.filter((c) => c.kind === 'planning');
  const rap = out.find((c) => c.kind === 'rap');
  const beso = out.find((c) => c.kind === 'beso');
  const end = out.at(-1)?.x1 ?? 0;
  const at = (x: number) => ({ x0: x, x1: x, core0: x, core1: x });
  const rapCol = rap ?? { name: 'Rap', kind: 'rap' as const, ...at(beso?.x0 ?? end) };
  const besoCol = beso ?? { name: 'Beso', kind: 'beso' as const, ...at(end) };
  const widths = planning.map((c) => c.core1 - c.core0).sort((a, b) => a - b);
  const normal = widths[Math.floor(widths.length / 2)] ?? 0;
  const draft = (c: {
    name: string;
    kind: ColumnKind;
    x0: number;
    x1: number;
    core0: number;
    core1: number;
  }): ColumnDraft => ({
    name: c.kind === 'rap' ? 'Rap' : c.kind === 'beso' ? 'Beso' : c.name,
    kind: c.kind,
    weight: c.kind === 'planning' ? weightOf(c.core1 - c.core0, normal) : 'normal',
    x0: c.x0,
    x1: c.x1,
    core0: c.core0,
    core1: c.core1,
  });
  return { columns: [...planning.map(draft), draft(rapCol), draft(besoCol)], merged };
}

// ---------------------------------------------------------------------------------------------------------
// Legende (Regel 5)

const norm = (s: string): string =>
  cleanText(s)
    .trim()
    .toLowerCase()
    .replace(/^leitung\b/, 'ltg');

interface LegendMap {
  readonly candidates: readonly ColorCandidate<Id>[];
  readonly neutral: Id | null;
  readonly fallback: Id;
}

function legendOf(read: ReadSheet, plan: Plan): LegendMap {
  const sheet = read.model;
  const found = new Map<Id, { r: number; g: number; b: number }>();
  for (const cell of sheet.cells) {
    const t = norm(cell.text);
    if (t === '') continue;
    const category = plan.legend.find(
      (c) => !c.neutral && (norm(c.legendLabel) === t || norm(c.name) === t),
    );
    if (category === undefined || found.has(category.id)) continue;
    const range = sheet.rangeAt(cell.row, cell.col);
    let rgb: { r: number; g: number; b: number } | null = null;
    for (let col = range.c0 - 1; col >= Math.max(0, range.c0 - 2) && rgb === null; col--) {
      const swatch = sheet.rangeAt(cell.row, col);
      rgb = hexToRgb(sheet.fillOf(sheet.cellAt(swatch.r0, swatch.c0)));
      if (rgb !== null && rgb.r === 255 && rgb.g === 255 && rgb.b === 255) rgb = null;
    }
    rgb ??= hexToRgb(sheet.fillOf(cell));
    if (rgb !== null && !(rgb.r === 255 && rgb.g === 255 && rgb.b === 255))
      found.set(category.id, rgb);
  }
  const candidates: ColorCandidate<Id>[] = plan.legend.map((c: LtgCategory) => ({
    key: c.id,
    color: found.get(c.id) ?? c.color,
  }));
  // Vorlagenfarben bleiben zusätzlich Kandidaten, wenn die Legende des Blatts abweicht.
  for (const c of plan.legend) if (found.has(c.id)) candidates.push({ key: c.id, color: c.color });
  const neutral = plan.legend.find((c) => c.neutral)?.id ?? null;
  const kp = plan.legend.find((c) => norm(c.name) === 'ltg kp')?.id;
  return { candidates, neutral, fallback: kp ?? plan.legend[0]?.id ?? '' };
}

interface CategoryResult {
  readonly first: Id;
  readonly second: Id | null;
  readonly unclear: boolean;
}

function categoryOf(shape: WapShape, read: ReadSheet, legend: LegendMap): CategoryResult {
  const extras = read.fills.get(shape.index);
  const stops = extras?.fillStops ?? [];
  const match = (hex: string | null, alpha: number | null): { id: Id | null; unclear: boolean } => {
    const rgb = hexToRgb(hex);
    if (rgb === null) return { id: legend.neutral, unclear: false };
    const color = alpha === null ? rgb : onWhite(rgb, alpha);
    const m = nearestColor(color, legend.candidates);
    return { id: m.key, unclear: m.unclear };
  };
  if (stops.length >= 2) {
    const a = stops[0];
    const b = stops.at(-1);
    const ma = a === undefined ? null : match(a.color, a.alpha);
    const mb = b === undefined ? null : match(b.color, b.alpha);
    if (ma?.id && mb?.id && ma.id !== mb.id)
      return { first: ma.id, second: mb.id, unclear: ma.unclear || mb.unclear };
    // Unklar nur ohne passende Legendenfarbe, nicht wenn die Farbe zufällig die des Rückfalls ist (F-31; FA-05).
    const id = ma?.id ?? mb?.id ?? null;
    return {
      first: id ?? legend.fallback,
      second: null,
      unclear: (ma?.unclear ?? true) || id === null,
    };
  }
  const m = match(shape.fill, extras?.fillAlpha ?? null);
  return { first: m.id ?? legend.neutral ?? legend.fallback, second: null, unclear: m.unclear };
}

// ---------------------------------------------------------------------------------------------------------
// Kopf und Seitenleiste

interface Header {
  unit: string;
  label: string;
  beilage: string;
  standDate: IsoDate | null;
  titleShape: number | null;
}

function readHeader(read: ReadSheet, date1904: boolean): Header {
  const header: Header = { unit: '', label: '', beilage: '', standDate: null, titleShape: null };
  const title = read.shapes.find((s) => s.lines.some((l) => /\barbeitsplan\b/i.test(l)));
  if (title !== undefined) {
    header.titleShape = title.index;
    const lines = title.lines.map((l) => cleanText(l).trim()).filter((l) => l !== '');
    const head = lines.find((l) => /\barbeitsplan\b/i.test(l)) ?? '';
    const m = /^(.*?)\s*\barbeitsplan\b\s*(.*)$/i.exec(head);
    header.unit = (m?.[1] ?? '').trim();
    header.label = (m?.[2] ?? '').trim();
    header.beilage = lines.find((l) => /\bbeilage\b/i.test(l)) ?? '';
  }
  const sheet = read.model;
  for (const cell of sheet.cells) {
    if (!/^\s*stand\b/i.test(cell.text)) continue;
    const inline = dateFromText(cell.text, 2000);
    if (inline !== null) {
      header.standDate = inline;
      break;
    }
    const next = sheet.cells
      .filter((c) => c.row === cell.row && c.col > cell.col && c.col <= cell.col + 6)
      .sort((a, b) => a.col - b.col)
      .find(
        (c) =>
          (c.value !== undefined && c.value > 30000 && c.value < 80000) ||
          dateFromText(c.text, 2000) !== null,
      );
    if (next !== undefined) {
      header.standDate =
        next.value !== undefined && next.value > 30000 && next.value < 80000
          ? serialToIso(next.value, date1904)
          : dateFromText(next.text, 2000);
      break;
    }
  }
  return header;
}

interface SidebarCells {
  readonly goalsRow: number | null;
  readonly remarksRow: number | null;
  readonly legendRow: number | null;
  readonly legendEndY: number | null;
  readonly legendTopY: number | null;
  readonly x0: number;
  readonly abbreviations: Map<string, string>;
  readonly remarkCells: { text: string; number: number | null }[];
}

function readSidebarCells(read: ReadSheet, x0: number, plan: Plan): SidebarCells {
  const sheet = read.model;
  const side = sheet.cells.filter((c) => sheet.colX(c.col) >= x0 - 1 && c.text.trim() !== '');
  const rowOf = (re: RegExp): number | null =>
    side.find((c) => re.test(c.text.trim()))?.row ?? null;
  const goalsRow = rowOf(/^wochenziel/i);
  const remarksRow = rowOf(/^bemerkung/i);
  const legendRow = rowOf(/^(?:legende|abkürzungen|kürzel)\b/i);
  const abbreviations = new Map<string, string>();
  const legendLabels = new Set(plan.legend.flatMap((c) => [norm(c.legendLabel), norm(c.name)]));
  let legendEndRow = legendRow;
  if (legendRow !== null) {
    for (const c of side) {
      if (c.row <= legendRow) continue;
      const code = c.text.trim();
      if (legendLabels.has(norm(code))) legendEndRow = Math.max(legendEndRow ?? c.row, c.row);
      if (!/^[A-ZÄÖÜ][A-Za-zÄÖÜäöü]{0,4}\s?\d?$/.test(code)) continue;
      const range = sheet.rangeAt(c.row, c.col);
      const meaning = side.find(
        (o) => o.row === c.row && o.col > range.c1 && o.col <= range.c1 + 2,
      );
      if (meaning !== undefined && meaning.text.trim().length > code.length) {
        abbreviations.set(code, cleanText(meaning.text).trim());
        legendEndRow = Math.max(legendEndRow ?? c.row, c.row);
      }
    }
  }
  const remarkCells: { text: string; number: number | null }[] = [];
  if (remarksRow !== null) {
    const stop = legendRow ?? Number.POSITIVE_INFINITY;
    const rows = [
      ...new Set(side.filter((c) => c.row > remarksRow && c.row < stop).map((c) => c.row)),
    ].sort((a, b) => a - b);
    for (const row of rows) {
      const cells = side.filter((c) => c.row === row).sort((a, b) => a.col - b.col);
      const texts = cells.map((c) => cleanText(c.text).trim()).filter((t) => t !== '');
      if (texts.length === 0) continue;
      if (texts.length === 2 && /^nr\.?$/i.test(texts[0] ?? '') && /^was$/i.test(texts[1] ?? ''))
        continue;
      const first = texts[0] ?? '';
      const numbered = /^\d{1,2}$/.test(first) && texts.length > 1;
      remarkCells.push({
        text: (numbered ? texts.slice(1) : texts).join(' '),
        number: numbered ? Number(first) : null,
      });
    }
  }
  return {
    goalsRow,
    remarksRow,
    legendRow,
    legendTopY: legendRow === null ? null : sheet.rowY(legendRow),
    legendEndY: legendEndRow === null ? null : sheet.rowY(legendEndRow + 1),
    x0,
    abbreviations,
    remarkCells,
  };
}

const BULLET = /^[-–—•·*]\s*/;

// ---------------------------------------------------------------------------------------------------------
// Auswertung

/** Kopfzellen des Terminbereichs (keine Termine). */
const AGENDA_HEADING = /^(?:nr\.?|nummer|was|wer|wo|wann|zeit|ort|termine?|bemerkungen?|beso)$/i;

/** Spaltenbuchstaben einer 0-basierten Spalte (Zelladresse für Rich Text). */
function columnLetters(index: number): string {
  let n = index + 1;
  let out = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    out = String.fromCharCode(65 + r) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

/** Läufe einer Zelle als Zeilen (Zeilenumbruch in der Zelle beginnt eine neue Zeile). */
function cellTextLines(runs: readonly CellRichRun[]): ShapeTextRun[][] {
  const lines: ShapeTextRun[][] = [[]];
  for (const r of runs) {
    r.text.split(/\r?\n/).forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part === '') return;
      lines[lines.length - 1]?.push({
        paragraph: 0,
        line: lines.length - 1,
        text: part,
        bold: r.bold,
        strike: r.strike,
        color: r.color,
        sizePt: null,
      });
    });
  }
  return lines.filter((l) => l.length > 0);
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

const MARKER = /^(AV|ABV|HV)(?:\s+(\d{4}))?(?:\s*\(([^()]*)\))?$/;

/** Wertet ein Blatt aus; null, wenn es keine WAP-Woche ist (keine Zeitachse oder kein Tageskopf). */
export function analyzeSheet(read: ReadSheet, ctx: SheetContext): SheetDraft | null {
  let time: SheetTimeScale;
  let layout: SheetLayout;
  try {
    const byLabels = calibrateSheetTime(read.shapes);
    layout = detectSheetLayout(read.model, byLabels, ctx.date1904);
    time = rowTimeScale(byLabels, read.model);
  } catch {
    return null;
  }
  const firstDay = layout.days[0];
  const lastDay = layout.days.at(-1);
  if (firstDay === undefined || lastDay === undefined || layout.startDate === null) return null;
  const startDate = layout.startDate;
  const header = readHeader(read, ctx.date1904);
  const reports: ReportDraft[] = [];
  const roles: (string | null)[] = read.shapes.map(() => null);
  const entries: EntryDraft[] = [];
  let seq = 0;
  const nextKey = (): string => `${ctx.prefix}e${seq++}`;
  const report = (r: Partial<ReportDraft> & Pick<ReportDraft, 'kind' | 'message'>): void => {
    reports.push({
      date: null,
      entryKey: null,
      shapeIndex: null,
      box: null,
      group: null,
      besoNumber: null,
      span: null,
      ...r,
    });
  };

  // Tage (Beschrieb 4.3): voll, kompakt (schmal) oder ausgeblendet (fehlt im Kopf).
  const fullWidth = Math.max(...layout.days.map((d) => d.x1 - d.x0));
  const days: DayDraft[] = WEEKDAYS.map((weekday, i) => {
    const date = addDays(startDate, i);
    const d = layout.days.find((x) => x.day === weekday);
    if (d === undefined) return { weekday, date, display: 'hidden', columns: null, x0: 0, x1: 0 };
    const { columns, merged } = dayColumnsOf(d.columns);
    if (merged)
      report({
        kind: 'gapColumnMerged',
        date,
        message: msg(
          `Eine unbeschriftete Zwischenspalte am ${weekday} ${date.slice(8, 10)}.${date.slice(5, 7)}. wurde der Nachbarspalte zugeschlagen.`,
          'Spaltensatz des Tages in den Tag-Einstellungen prüfen.',
        ),
      });
    return {
      weekday,
      date,
      display: d.x1 - d.x0 < fullWidth * 0.6 ? 'compact' : 'full',
      columns,
      x0: d.x0,
      x1: d.x1,
    };
  });
  const visibleDays = days.filter((d) => d.columns !== null);
  const dayAt = (x: number): DayDraft | null =>
    visibleDays.find((d) => x >= d.x0 && x < d.x1) ?? null;

  const legend = legendOf(read, ctx.plan);
  const gridX0 = firstDay.x0;
  const gridX1 = lastDay.x1;
  const perHour = (time.toY(780) - time.toY(300)) / 8;
  const yGridEnd = time.toY(1440);
  const subHeaderBottom = read.model.rowY((layout.subHeaderRow ?? layout.headerRow) + 1);
  const y0500 = time.toY(300);
  const sidebar = readSidebarCells(read, gridX1, ctx.plan);

  // Rollen ohne Eintrag.
  if (header.titleShape !== null) roles[header.titleShape] = 'Titel';
  for (const i of time.labelShapes) roles[i] = 'Zeitachse';

  // Verdeckende Formen (R-8.2-42): später gezeichnet, gefüllt, deckend, keine Linie.
  const opaque = (s: WapShape): boolean => {
    if (s.kind === 'cxn' || s.geometry === 'line') return false;
    if (s.box.x1 - s.box.x0 <= 0 || s.box.y1 - s.box.y0 <= 0) return false;
    if (s.kind === 'pic') return true;
    if (s.kind !== 'sp' || s.fill === null) return false;
    const extras = read.fills.get(s.index);
    if (extras !== undefined && extras.fillStops.length > 0)
      return extras.fillStops.every((st) => st.alpha >= 1);
    return extras?.fillAlpha === null || extras?.fillAlpha === undefined || extras.fillAlpha >= 1;
  };
  const coversOf = (s: WapShape): Rect[] =>
    read.shapes.filter((o) => o.index > s.index && opaque(o)).map((o) => o.box);

  // Klassifikation der Formen im Raster.
  const grid: WapShape[] = [];
  const agenda: WapShape[] = [];
  const side: WapShape[] = [];
  for (const s of read.shapes) {
    if (roles[s.index] !== null) continue;
    const x = cx(s.box);
    const y = cy(s.box);
    if (x >= gridX1) side.push(s);
    else if (s.box.y0 >= yGridEnd - perHour * 0.25 && x >= gridX0) agenda.push(s);
    else if (x >= gridX0 && y > subHeaderBottom && s.box.y0 >= subHeaderBottom - perHour * 0.25)
      grid.push(s);
    else if (x < gridX0 && y > subHeaderBottom && y < yGridEnd) {
      // Links neben dem Raster (z.B. Zeitachse ohne Marke): nicht zugeordnet.
    }
  }

  const isLine = (s: WapShape): boolean =>
    s.kind === 'cxn' || s.geometry === 'line' || s.box.y1 - s.box.y0 < perHour * 0.04;
  const lines = grid.filter(isLine);
  const markerLabels: {
    shape: WapShape;
    kind: MarkerKind;
    at: number | null;
    /**
     * Art frei mit der ganzen Beschriftung, wenn sie eine Ortsklammer trägt (Gate B 28.10.2026, Entscheid 14 b: der Ort
     * bleibt Teil der Beschriftung; Marker haben kein Ort-Feld, Beschrieb 4.6); sonst ''.
     */
    customKind: string;
  }[] = [];
  const besoBoxes: { shape: WapShape; number: number }[] = [];
  const contents: WapShape[] = [];
  for (const s of grid) {
    if (isLine(s)) continue;
    const text = textOf(s);
    const marker = MARKER.exec(text);
    if (marker !== null && s.box.y1 - s.box.y0 <= perHour * 0.8) {
      const t = marker[2];
      const withOrt = marker[3] !== undefined && marker[3].trim() !== '';
      markerLabels.push({
        shape: s,
        kind: withOrt ? 'custom' : (marker[1] as MarkerKind),
        at: t === undefined ? null : Number(t.slice(0, 2)) * 60 + Number(t.slice(2)),
        customKind: withOrt ? text : '',
      });
      continue;
    }
    if (/^\d{2}$/.test(text) && Number(text) >= 10 && Number(text) <= 79) {
      besoBoxes.push({ shape: s, number: Number(text) });
      continue;
    }
    contents.push(s);
  }

  // Gate S A2: Verdeckung (R-8.2-39 bis -41).
  const visible = (s: WapShape): { box: Rect; share: number } | null => {
    const covers = coversOf(s);
    const share = coveredShare(s.box, covers);
    if (share >= 0.99) return null;
    if (share < 0.05) return { box: s.box, share };
    const span = visibleSpan(s.box, covers);
    if (span === null) return null;
    return { box: { ...s.box, y0: span.y0, y1: span.y1 }, share };
  };
  const hiddenReport = (s: WapShape, day: DayDraft | null): void => {
    roles[s.index] = null;
    const text = s.lines.filter((l) => l.trim() !== '');
    report({
      kind: 'hidden',
      date: day?.date ?? null,
      shapeIndex: s.index,
      box: s.box,
      span: { from: round5(time.toMinute(s.box.y0)), to: round5(time.toMinute(s.box.y1)) },
      // Inhalt der verdeckten Form nur für die Anzeige im lokalen Bericht, nie in der Meldung (UX-AB-07, CR-D-2-04).
      ...(text.length === 0 ? {} : { notTakenText: text }),
      message: msg(
        `Eine Form${day === null ? '' : ` am ${day.weekday}`} (${hhmm(time.toMinute(s.box.y0))}–${hhmm(time.toMinute(s.box.y1))}) ist von anderen Formen ganz verdeckt und wurde nicht übernommen.`,
        'Im Excel prüfen, ob der Eintrag gilt; wenn ja, im Raster neu erfassen.',
      ),
    });
  };
  const partlyReport = (s: WapShape, day: DayDraft, share: number, key: string): void => {
    report({
      kind: 'partlyHidden',
      date: day.date,
      shapeIndex: s.index,
      box: s.box,
      span: { from: round5(time.toMinute(s.box.y0)), to: round5(time.toMinute(s.box.y1)) },
      entryKey: key,
      message: msg(
        `Eine Form am ${day.weekday} (ursprünglich ${hhmm(time.toMinute(s.box.y0))}–${hhmm(time.toMinute(s.box.y1))}) ist teilweise verdeckt (${Math.floor(share * 100 + 1e-6)} %); übernommen wurde die sichtbare Zeit.`,
        'Zeit des Eintrags in der Liste oder im Raster prüfen.',
      ),
    });
  };

  // --- Querbalken, Rapporte, Blöcke -------------------------------------------------------------------
  const blockDrafts: BlockDraft[] = [];
  const rapportDrafts: RapportDraft[] = [];
  /** Rapporte, deren Form teilweise verdeckt und dadurch zeitlich gekürzt ist (Q-042, R-8.2-41). */
  const cutRapports = new Set<string>();
  const codeRe = new RegExp(
    `^(${[...ctx.rapportCodes]
      .sort((a, b) => b.length - a.length)
      .map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s?'))
      .join('|')})(?![A-Za-z0-9])`,
  );
  const secondaryNeeded = new Set<Weekday>();
  const blockMarkers: Mutable<MarkerDraft>[] = [];
  for (const s of contents) {
    const day = dayAt(cx(s.box));
    const text = textOf(s);
    if (day === null || day.columns === null) {
      continue;
    }
    // Querbalken im Band oberhalb 0500 (F-02, B-F-06).
    if (cy(s.box) < y0500 && s.box.y1 <= y0500 + perHour * 0.25 && text !== '') {
      const v = visible(s);
      if (v === null) {
        hiddenReport(s, day);
        continue;
      }
      const parsed = parseShapeText(read.runs.get(s.index) ?? [], ctx.formText);
      const year = Number(startDate.slice(0, 4));
      const range = /(\d{1,2}\.\d{1,2}\.(?:\d{2,4})?)\s*-\s*(\d{1,2}\.\d{1,2}\.(?:\d{2,4})?)/.exec(
        text,
      );
      const lastCovered = dayAt(s.box.x1 - 1) ?? day;
      const firstCovered = dayAt(s.box.x0 + 1) ?? day;
      let fromDate = firstCovered.date;
      let toDate = lastCovered.date;
      if (range !== null) {
        const toIso = dateFromText(range[2] ?? '', year);
        const toYear = toIso === null ? year : Number(toIso.slice(0, 4));
        const fromIso = dateFromText(range[1] ?? '', toYear);
        // Der Zeitraum im Titel gilt nur, wenn er die gezeichneten Tage umfasst (z.B. über die Woche hinaus);
        // nennt der Titel nur einen Teil der Tage, bleibt die Lage massgebend (normalisierung 13 N-15).
        if (fromIso !== null && toIso !== null && fromIso <= fromDate && toIso >= toDate) {
          fromDate = fromIso;
          toDate = toIso;
        }
      }
      const key = nextKey();
      const cat = categoryOf(s, read, legend);
      entries.push({
        type: 'querbalken',
        key,
        shapes: [s.index],
        status: parsed.cancelled ? 'cancelled' : 'confirmed',
        changed: parsed.changed,
        removedText: parsed.removedText,
        title: [
          {
            text: cleanText(s.lines.filter(Boolean).join(' ')).trim(),
            bold: parsed.title.some((r) => r.bold),
          },
        ],
        fromDate,
        toDate,
        categoryId: s.fill === null ? null : cat.first,
      });
      roles[s.index] = key;
      continue;
    }
    const v = visible(s);
    if (v === null) {
      hiddenReport(s, day);
      continue;
    }
    if (text === '') {
      report({
        kind: 'unassignedShape',
        date: day.date,
        shapeIndex: s.index,
        box: s.box,
        message: msg(
          `Eine Form ohne Text am ${day.weekday} (${hhmm(time.toMinute(s.box.y0))}–${hhmm(time.toMinute(s.box.y1))}) wurde nicht übernommen.`,
          'Im Excel prüfen, ob sie etwas bedeutet; wenn ja, den Eintrag im Raster erfassen.',
        ),
      });
      continue;
    }
    const parsed = parseShapeText(read.runs.get(s.index) ?? [], ctx.formText);
    const columns = day.columns;
    const covered = coveredColumns(columns, v.box.x0, v.box.x1);
    const planningIdx = covered.filter((i) => columns[i]?.kind === 'planning');
    const inRap = covered.some((i) => columns[i]?.kind === 'rap');
    const inBeso = covered.some((i) => columns[i]?.kind === 'beso');
    const rawFrom = time.toMinute(v.box.y0);
    const rawTo = time.toMinute(v.box.y1);
    const titleText = parsed.title
      .map((r) => r.text)
      .join('')
      .trim();
    const code = codeRe.exec(titleText)?.[1] ?? null;
    const key = nextKey();
    const cat = categoryOf(s, read, legend);
    if (v.share >= 0.05) partlyReport(s, day, v.share, key);
    if (parsed.uncertain)
      report({
        kind: 'uncertainParse',
        date: day.date,
        entryKey: key,
        shapeIndex: s.index,
        box: s.box,
        message: msg(
          `Der Text einer Form am ${day.weekday} ${hhmm(rawFrom)} wurde unsicher zerlegt (${parsed.uncertainReasons.join(', ')}).`,
          'Titel, Ltg und Ort des Eintrags prüfen.',
        ),
      });
    // Rapport: Kürzel der Vorlage am Titelanfang oder Kästchen ohne Nummer ganz in der Rap-Spalte (N-14).
    if (code !== null || (planningIdx.length === 0 && inRap && !inBeso)) {
      const label = parsed.timeInText;
      let t: Extract<TimeSpec, { form: 'point' | 'range' }> = {
        form: 'range',
        from: round5(rawFrom),
        to: Math.max(round5(rawFrom) + 5, round5(rawTo)),
      };
      if (label !== null) {
        const [a, b] = label.split('-');
        const m = (x: string | undefined) =>
          x === undefined ? NaN : Number(x.slice(0, 2)) * 60 + Number(x.slice(2));
        const fa = round5(m(a));
        const fb = round5(m(b));
        if (Number.isFinite(fa) && Number.isFinite(fb) && fb > fa)
          t = { form: 'range', from: fa, to: fb };
        else if (Number.isFinite(fa)) t = { form: 'point', at: fa };
      }
      const rapportCode = code ?? (titleText === '' ? textOf(s) : titleText);
      if (code === null)
        report({
          kind: 'uncertainParse',
          date: day.date,
          entryKey: key,
          shapeIndex: s.index,
          box: s.box,
          message: msg(
            `Ein Kästchen ohne Nummer in der Rap-Spalte am ${day.weekday} ${hhmm(rawFrom)} wurde als Rapport übernommen; das Kürzel ist keines der Vorlage.`,
            'Kürzel des Rapports prüfen.',
          ),
        });
      const rapport: RapportDraft = {
        type: 'rapport',
        key,
        shapes: [s.index],
        status: parsed.cancelled ? 'cancelled' : 'confirmed',
        changed: parsed.changed,
        removedText: parsed.removedText,
        weekday: day.weekday,
        code: rapportCode,
        time: t,
        ort: parsed.ort,
        categoryId: s.fill === null ? legend.fallback : cat.first,
        inRap,
        displayColumns: planningIdx.length > 0 ? { kind: 'index', indexes: planningIdx } : null,
      };
      if (v.box.y0 !== s.box.y0 || v.box.y1 !== s.box.y1) cutRapports.add(key);
      rapportDrafts.push(rapport);
      roles[s.index] = key;
      continue;
    }
    // Regel 6: ganz in Rap- oder Beso-Spalte → Nebenspalte; teilweise → auf Planungsspalten gekürzt.
    let pick: ColumnPick;
    if (planningIdx.length === 0) {
      secondaryNeeded.add(day.weekday);
      pick = { kind: 'index', indexes: [-1] };
      report({
        kind: 'secondaryColumnCreated',
        date: day.date,
        entryKey: key,
        shapeIndex: s.index,
        box: s.box,
        message: msg(
          `Eine Form ohne Nummer liegt am ${day.weekday} ${hhmm(rawFrom)} ganz in der ${inBeso ? 'Beso' : 'Rap'}-Spalte; sie wurde ein Block der Nebenspalte «${ctx.plan.templateId === 'kp' ? 'Det' : 'Stab 2'}».`,
          'Spalte des Blocks prüfen.',
        ),
      });
    } else {
      if (inRap || inBeso)
        report({
          kind: 'truncatedToPlanning',
          date: day.date,
          entryKey: key,
          shapeIndex: s.index,
          box: s.box,
          message: msg(
            `Eine Form am ${day.weekday} ${hhmm(rawFrom)} ragt in die ${inBeso ? 'Beso' : 'Rap'}-Spalte; sie wurde auf die Planungsspalten gekürzt.`,
            'Spalten des Blocks prüfen.',
          ),
        });
      const planningCount = columns.filter((c) => c.kind === 'planning').length;
      pick =
        planningIdx.length === planningCount
          ? { kind: 'all' }
          : { kind: 'index', indexes: planningIdx };
    }
    if (cat.unclear)
      report({
        kind: 'unclearColor',
        date: day.date,
        entryKey: key,
        shapeIndex: s.index,
        box: s.box,
        message: msg(
          `Die Füllfarbe einer Form am ${day.weekday} ${hhmm(rawFrom)} passt zu keiner Legendenfarbe eindeutig; übernommen wurde die nächste.`,
          'Leitungskategorie des Blocks prüfen.',
        ),
      });
    const from = round5(rawFrom);
    const to = Math.max(from + 5, round5(rawTo));
    // Eine nicht fette Zeile «ABV hhmm» im Block ist zusätzlich ein Marker (normalisierung 13 N-10:
    // nur eine fette Zeile «ABV …» bleibt reiner Block).
    let supplement = parsed.supplement;
    const markerLine = /(?:^|\s)(AV|ABV|HV)\s+(\d{4})$/.exec(supplement);
    if (
      markerLine !== null &&
      !/\b(?:AV|ABV|HV)\b/.test(parsed.title.map((r) => r.text).join(''))
    ) {
      const at = Number(markerLine[2]?.slice(0, 2)) * 60 + Number(markerLine[2]?.slice(2));
      if (at >= 0 && at <= 1440 && at % 5 === 0) {
        supplement = supplement.slice(0, markerLine.index).trim();
        const marker: Mutable<MarkerDraft> = {
          type: 'marker',
          key: nextKey(),
          shapes: [],
          status: 'confirmed',
          changed: false,
          removedText: [],
          weekday: day.weekday,
          at,
          kind: markerLine[1] as MarkerKind,
          customKind: '',
          columns: pick,
          asFlatBlock: true,
          flatBlockMinutes: null,
        };
        entries.push(marker);
        blockMarkers.push(marker);
      }
    }
    blockDrafts.push({
      type: 'block',
      key,
      shapes: [s.index],
      status: parsed.cancelled ? 'cancelled' : 'confirmed',
      changed: parsed.changed,
      removedText: parsed.removedText,
      weekday: day.weekday,
      time: { form: 'range', from, to },
      columns: pick,
      title: parsed.title,
      supplement,
      ltg: parsed.ltg,
      ort: parsed.ort,
      tenue: parsed.tenue,
      categoryId: cat.first,
      secondCategoryId: cat.second,
      openEnd: /wave|punchedtape/i.test(s.geometry),
      subtasks: parsed.subtasks,
      rawFrom,
      rawTo,
      box: v.box,
    });
    roles[s.index] = key;
  }

  // Nebenspalte «Det» an den Tagen, die sie brauchen (Regel 6): vor der Rap-Spalte, ohne Breite.
  for (const day of days) {
    if (day.columns === null || !secondaryNeeded.has(day.weekday)) continue;
    const rapIndex = day.columns.findIndex((c) => c.kind === 'rap');
    const rap = day.columns[rapIndex];
    day.columns.splice(rapIndex, 0, {
      name: ctx.plan.templateId === 'kp' ? 'Det' : 'Stab 2',
      kind: 'secondary',
      weight: 'narrow',
      x0: rap?.x0 ?? day.x1,
      x1: rap?.x0 ?? day.x1,
      core0: rap?.x0 ?? day.x1,
      core1: rap?.x0 ?? day.x1,
    });
    for (const b of blockDrafts) {
      if (b.weekday !== day.weekday || b.columns.kind !== 'index') continue;
      b.columns = {
        kind: 'index',
        indexes: b.columns.indexes.map((i) => (i === -1 ? rapIndex : i >= rapIndex ? i + 1 : i)),
      };
    }
    // Marker aus Blöcken der Nebenspalte liegen mit dem Block in der Nebenspalte (CR-H-D-06).
    for (const m of blockMarkers) {
      if (m.weekday !== day.weekday || m.columns.kind !== 'index') continue;
      m.columns = {
        kind: 'index',
        indexes: m.columns.indexes.map((i) => (i === -1 ? rapIndex : i >= rapIndex ? i + 1 : i)),
      };
    }
    for (const r of rapportDrafts) {
      if (
        r.weekday !== day.weekday ||
        r.displayColumns === null ||
        r.displayColumns.kind !== 'index'
      )
        continue;
      r.displayColumns = {
        kind: 'index',
        indexes: r.displayColumns.indexes.map((i) => (i >= rapIndex ? i + 1 : i)),
      };
    }
  }

  // Verknüpfte Formen (normalisierung 5.1, N-17/N-18): gleicher Text, gleiche Zeit, gleiche Kategorie → ein Block.
  const merged: BlockDraft[] = [];
  const plainKey = (b: BlockDraft): string =>
    `${b.weekday}|${b.time.from}|${b.time.to}|${b.categoryId}|${b.title
      .map((r) => r.text)
      .join('')
      .trim()}|${b.ltg}|${b.ort}`;
  for (const b of blockDrafts) {
    const twin = merged.find((m) => {
      if (plainKey(m) !== plainKey(b) || b.columns.kind !== 'index' || m.columns.kind !== 'index')
        return false;
      // Angrenzend oder durch je genau eine Spalte getrennt (Aussparung, Beschrieb 4.6); weiter
      // auseinanderliegende gleiche Formen bleiben eigene Einträge (wie Anhang A).
      const all = [...new Set([...m.columns.indexes, ...b.columns.indexes])].sort((x, y) => x - y);
      return all.every((v, i) => i === 0 || v - (all[i - 1] ?? v) <= 2);
    });
    if (twin !== undefined && twin.columns.kind === 'index' && b.columns.kind === 'index') {
      const indexes = [...new Set([...twin.columns.indexes, ...b.columns.indexes])].sort(
        (x, y) => x - y,
      );
      const day = days.find((d) => d.weekday === b.weekday);
      const planningCount = day?.columns?.filter((c) => c.kind === 'planning').length ?? 0;
      const allPlanning =
        day?.columns !== null &&
        day?.columns !== undefined &&
        indexes.length === planningCount &&
        indexes.every((i) => day.columns?.[i]?.kind === 'planning');
      twin.columns = allPlanning ? { kind: 'all' } : { kind: 'index', indexes };
      (twin.shapes as number[]).push(...b.shapes);
      for (const i of b.shapes) roles[i] = twin.key;
      for (const r of reports)
        if (r.entryKey === b.key) (r as { entryKey: string | null }).entryKey = twin.key;
      continue;
    }
    merged.push(b);
  }

  // Rapporte: derselbe Rapport in Rap- und Planungsspalten (gleiches Kürzel, gleiche Zeit) → ein Objekt.
  const rapports: RapportDraft[] = [];
  for (const r of rapportDrafts) {
    const span = (t: RapportDraft['time']): [number, number] =>
      t.form === 'point' ? [t.at, t.at + 30] : [t.from, t.to];
    // Gleicher Rapport in Rap- und Planungsspalten: gleiches Kürzel, sich überschneidende Zeit; massgebend bleibt
    // die Zeit in der Rap-Spalte. Ist eine der Formen teilweise verdeckt und dadurch gekürzt, gilt sie nur bei
    // gleicher Zeit als derselbe Rapport, sonst bleibt sie ein eigener mit ihrer sichtbaren Zeit (Q-042,
    // Auftraggeber 19.10.2026; normalisierung.md 5.4 «gleiche Zeit»).
    const twin = rapports.find((o) => {
      if (o.weekday !== r.weekday || o.code !== r.code || o.inRap === r.inRap) return false;
      const [a0, a1] = span(o.time);
      const [b0, b1] = span(r.time);
      if ((cutRapports.has(o.key) || cutRapports.has(r.key)) && (a0 !== b0 || a1 !== b1))
        return false;
      return Math.min(a1, b1) > Math.max(a0, b0);
    });
    if (twin !== undefined) {
      const cols = twin.displayColumns ?? r.displayColumns;
      if (!twin.inRap && r.inRap) (twin as { time: RapportDraft['time'] }).time = r.time;
      twin.inRap = true;
      twin.displayColumns = cols;
      (twin.shapes as number[]).push(...r.shapes);
      for (const i of r.shapes) roles[i] = twin.key;
      for (const rep of reports)
        if (rep.entryKey === r.key) (rep as { entryKey: string | null }).entryKey = twin.key;
      continue;
    }
    // Derselbe Rapport in Rap- und Planungsspalte mit verschiedener Zeit (z.B. teilweise verdeckt): zwei Rapporte wie
    // bisher, ohne Zusammenführung (Gate-B-Entscheid 12 offen), aber mit Hinweis (UX-AB-F-06).
    const other = rapports.find((o) => {
      if (o.weekday !== r.weekday || o.code !== r.code || o.inRap === r.inRap) return false;
      const [a0, a1] = span(o.time);
      const [b0, b1] = span(r.time);
      return Math.min(a1, b1) > Math.max(a0, b0);
    });
    if (other !== undefined) {
      const inColumns = r.inRap ? other : r;
      const day = days.find((d) => d.weekday === r.weekday);
      const [start] = span(r.inRap ? r.time : other.time);
      report({
        kind: 'rapportTwice',
        date: day?.date ?? null,
        entryKey: inColumns.key,
        shapeIndex: inColumns.shapes[0] ?? null,
        message: msg(
          `Ein Rapport am ${r.weekday} ${hhmm(start)} steht in der Rap-Spalte und in einer Planungsspalte mit verschiedener Zeit; übernommen als zwei Rapporte.`,
          'Prüfen, ob es derselbe Rapport ist; dann einen löschen und beim anderen in der Liste die Spalten «Rap, …» wählen. Sonst keine Aktion nötig.',
        ),
      });
    }
    rapports.push(r);
  }

  // Regel 4 (R-8.2-11, Q-006 b): Blockkanten neben der 15-Min-Linie.
  const grouped = new Map<IsoDate, { count: number; members: string[] }>();
  for (const b of merged) {
    const day = days.find((d) => d.weekday === b.weekday);
    if (day === undefined) continue;
    for (const edge of [b.rawFrom, b.rawTo]) {
      const a = Math.round(Math.abs(edge - Math.round(edge / 15) * 15) * 100) / 100;
      if (a <= 2) continue;
      if (a <= 4) {
        const g = grouped.get(day.date) ?? { count: 0, members: [] };
        g.count++;
        if (!g.members.includes(b.key)) g.members.push(b.key);
        grouped.set(day.date, g);
      } else {
        report({
          kind: 'edgeOffGrid',
          date: day.date,
          entryKey: b.key,
          shapeIndex: b.shapes[0] ?? null,
          box: b.box,
          message: msg(
            `Blockkante ${hhmm(Math.floor(edge + 0.5))} liegt ${Math.round(a)} Min neben der 15-Min-Linie, gerundet auf ${hhmm(edge)}.`,
            'Zeit des Blocks prüfen.',
          ),
        });
      }
    }
  }
  for (const [date, g] of [...grouped.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    report({
      kind: 'edgeOffGridGrouped',
      date,
      group: { count: g.count, members: g.members },
      message: msg(
        `${g.count} Blockkanten 2–4 Min neben der 15-Min-Linie, auf 5 Min gerundet`,
        'Bei Bedarf die betroffenen Blöcke aufklappen und die Zeiten prüfen.',
      ),
    });

  // --- Marker (Beschrieb 4.6; normalisierung 5.3, N-10) ---------------------------------------------
  const usedLines = new Set<number>();
  // Eine Linie über mehrere Tage trägt je Tag höchstens einen Marker (VQA-H1 c).
  const lineDays = new Map<number, Set<Weekday>>();
  for (const m of markerLabels) {
    const day = dayAt(cx(m.shape.box));
    if (day === null || day.columns === null) continue;
    const v = visible(m.shape);
    if (v === null) {
      hiddenReport(m.shape, day);
      continue;
    }
    const labelTop = time.toMinute(m.shape.box.y0);
    // Als Linie zählt erst, was mindestens 10 % der schmalsten Planungsspalte des Tags lang ist; kürzer ist ein
    // unsichtbarer Rest, z.B. am Spaltenrand (VQA-3-01, CR-4-05). Unter den Linien bis 30 Min neben der Beschriftung
    // gewinnt die längste innerhalb von 2 Min der kleinsten Abweichung, bei gleicher Länge die nähere.
    // Länge quer zur Zeitachse: nur (annähernd) waagrechte Linien tragen einen Marker, eine senkrechte Linie im Tag
    // hat keine Breite und zählt nicht (CR-5-02).
    const length = (l: WapShape): number => l.box.x1 - l.box.x0;
    const widths = day.columns.filter((c) => c.kind === 'planning').map((c) => c.core1 - c.core0);
    const minLength = widths.length === 0 ? 1 : Math.min(...widths) / 10;
    const near = lines
      .filter(
        (l) =>
          length(l) >= minLength &&
          !(lineDays.get(l.index)?.has(day.weekday) ?? false) &&
          (dayAt(cx(l.box)) === day ||
            (l.box.x0 <= cx(m.shape.box) && cx(m.shape.box) <= l.box.x1)),
      )
      .map((l) => ({ l, d: Math.abs(time.toMinute(cy(l.box)) - labelTop) }))
      .filter((x) => x.d <= 30);
    const best = Math.min(...near.map((x) => x.d));
    const line = near
      .filter((x) => x.d <= best + 2)
      .sort((a, b) => length(b.l) - length(a.l) || a.d - b.d)[0]?.l;
    if (line !== undefined) {
      usedLines.add(line.index);
      lineDays.set(line.index, new Set([...(lineDays.get(line.index) ?? []), day.weekday]));
    }
    // Zeit der Marke: Zeit in der Beschriftung hat Vorrang (normalisierung 5.3); sonst die Zeit der zugeordneten
    // Linie (von = Zeit der Linie; Befund FA-07, Lage aus dem Zeichnungsanker R-8.2-44), ohne Linie die
    // 15-Min-Linie am oberen Rand der Beschriftung (AV/HV liegen auf Viertelstunden; Beschriftung bis 7 Min
    // daneben gesetzt).
    const labelBottom = time.toMinute(m.shape.box.y1);
    const at =
      m.at !== null && Math.abs(m.at - labelTop) <= 60
        ? m.at
        : line !== undefined
          ? time.toMinute(cy(line.box))
          : Math.round((labelTop + 2) / 15) * 15;
    // Ohne Linienform: ein Kästchen mit eigener Höhe (ab 25 Min) ist ein Marker als flacher Block mit dieser
    // Dauer; eine kleine Beschriftung bleibt die Beschriftung einer Linie (VQA-H1 c).
    const flat = line === undefined && labelBottom - labelTop >= 25;
    const key = nextKey();
    const pick: ColumnPick =
      line === undefined
        ? { kind: 'all' }
        : (() => {
            const idx = coveredColumns(
              day.columns,
              Math.max(line.box.x0, day.x0),
              Math.min(line.box.x1, day.x1),
            ).filter((i) => day.columns?.[i]?.kind === 'planning');
            const count = day.columns.filter((c) => c.kind === 'planning').length;
            return idx.length === 0 || idx.length === count
              ? { kind: 'all' as const }
              : { kind: 'index' as const, indexes: idx };
          })();
    entries.push({
      type: 'marker',
      key,
      shapes: line === undefined ? [m.shape.index] : [m.shape.index, line.index],
      status: 'confirmed',
      changed: false,
      removedText: [],
      weekday: day.weekday,
      at: Math.min(1440, Math.max(0, round5(at))),
      kind: m.kind,
      customKind: m.customKind,
      columns: pick,
      asFlatBlock: flat,
      flatBlockMinutes: flat ? Math.max(5, round5(labelBottom - labelTop)) : null,
    });
    roles[m.shape.index] = key;
    if (line !== undefined) roles[line.index] = key;
  }
  for (const l of lines) {
    if (usedLines.has(l.index)) continue;
    const day = dayAt(cx(l.box));
    report({
      kind: 'unassignedShape',
      date: day?.date ?? null,
      shapeIndex: l.index,
      box: l.box,
      message: msg(
        `Eine Linie ohne Beschriftung${day === null ? '' : ` am ${day.weekday}`} bei ${hhmm(time.toMinute(cy(l.box)))} wurde nicht übernommen; ohne Beschriftung ist die Art des Markers nicht bestimmbar.`,
        'Die Art aus der Planung ergänzen (AV, ABV, HV oder eine freie Art mit Bezeichnung) oder die Meldung ignorieren, wenn die Linie nichts bedeutet.',
      ),
    });
  }

  // --- Termine und Beso (Regel 1, 3, 6, 10, 11; normalisierung 5.5) -----------------------------------
  interface AgendaItem {
    readonly parsed: ParsedAgendaLine;
    readonly day: DayDraft;
    /** Textfeld (Form) oder null bei einer Zelle des Terminbereichs. */
    readonly shapeIndex: number | null;
    readonly box: Rect;
    readonly order: number;
    /** Läufe aller Zeilen des Termins (Folgezeilen eingeschlossen). */
    readonly runs: readonly ShapeTextRun[];
  }
  interface AgendaLine {
    readonly runs: readonly ShapeTextRun[];
    readonly shapeIndex: number | null;
    readonly box: Rect;
  }
  const items: AgendaItem[] = [];
  const continued = new Set<number>();
  let order = 0;
  /** Zeilen einer Quelle (Textfeld bzw. Zellen eines Tags) in Termine zerlegen; Folgezeilen anhängen. */
  const readAgendaLines = (lines: readonly AgendaLine[], sourceDay: DayDraft): void => {
    let previous: AgendaItem | null = null;
    for (const line of lines) {
      const parsed = parseAgendaLine(line.runs);
      if (parsed.number === null && parsed.title === '') {
        // Ganz rot gestrichene Zeile ohne Nummer (z.B. Folgezeile eines gestrichenen Termins, CR-D-2-02): nicht
        // übernommen, aber gemeldet; der Text steht nur in der Anzeige des Berichts.
        if (parsed.cancelledParts.length > 0) {
          const day = previous?.day ?? sourceDay;
          const n = previous?.parsed.number ?? null;
          report({
            kind: 'partlyCancelled',
            date: day.date,
            shapeIndex: line.shapeIndex,
            box: line.box,
            besoNumber: n,
            notTakenText: [parsed.cancelledParts.join(' ')],
            message: msg(
              `Eine ganz rot durchgestrichene Zeile ohne Nummer am ${day.weekday}${n === null ? '' : ` (nach Termin Nr ${String(n)})`} wurde nicht übernommen.`,
              'Text im Bericht prüfen; gehört er zu einem gültigen Eintrag, dort ergänzen, sonst ist nichts zu tun.',
            ),
          });
        }
        continue;
      }
      if (parsed.number === null && previous !== null && !/[.]$/.test(previous.parsed.rest)) {
        // Folgezeile des vorherigen Termins (CR-H-D-01): die Zeilen werden als ein Text neu zerlegt, damit
        // Titel, Freitext und Bemerkungstext die Folgezeile enthalten; die Zusammenführung ist unsicher.
        const gap: ShapeTextRun = {
          paragraph: line.runs[0]?.paragraph ?? 0,
          line: line.runs[0]?.line ?? 0,
          text: ' ',
          bold: false,
          strike: false,
          color: null,
          sizePt: null,
        };
        const joined = [...previous.runs, gap, ...line.runs];
        const merged: AgendaItem = { ...previous, parsed: parseAgendaLine(joined), runs: joined };
        items[items.length - 1] = merged;
        previous = merged;
        if (!continued.has(merged.order)) {
          continued.add(merged.order);
          report({
            kind: 'uncertainParse',
            date: merged.day.date,
            shapeIndex: line.shapeIndex,
            box: line.box,
            besoNumber: merged.parsed.number,
            message: msg(
              `Eine Zeile ohne Nummer am ${merged.day.weekday} wurde ${merged.parsed.number === null ? 'der vorherigen Bemerkung' : `dem Termin Nr ${merged.parsed.number}`} angehängt.`,
              'Text im Eintrag prüfen; gehört die Zeile nicht dazu, als eigene Bemerkung erfassen.',
            ),
          });
        }
        continue;
      }
      const decade = parsed.number === null ? null : Math.floor(parsed.number / 10);
      const dayByNumber =
        decade !== null && decade >= 1 && decade <= 7 ? days[decade - 1] : undefined;
      const item: AgendaItem = {
        parsed,
        day: dayByNumber !== undefined && dayByNumber.columns !== null ? dayByNumber : sourceDay,
        shapeIndex: line.shapeIndex,
        box: line.box,
        order: order++,
        runs: line.runs,
      };
      items.push(item);
      previous = item;
    }
  };
  for (const s of agenda) {
    const runs = read.runs.get(s.index) ?? [];
    const lineIndexes = [...new Set(runs.map((r) => r.line))].sort((a, b) => a - b);
    const boxDay =
      dayAt(Math.min(s.box.x0 + (s.box.x1 - s.box.x0) * 0.1, s.box.x1 - 1)) ?? dayAt(cx(s.box));
    if (lineIndexes.length === 0) {
      // Leeres Textfeld im Terminbereich: Rahmen ohne Inhalt, nichts geht verloren.
      roles[s.index] = 'Termine (leer)';
      continue;
    }
    if (boxDay === null) {
      report({
        kind: 'unassignedShape',
        shapeIndex: s.index,
        box: s.box,
        message: msg(
          'Ein Textfeld im Terminbereich liegt unter keinem Tag und wurde nicht übernommen.',
          'Die Termine im Raster bzw. in der Liste erfassen.',
        ),
      });
      continue;
    }
    roles[s.index] = 'Termine';
    readAgendaLines(
      lineIndexes.map((li) => ({
        runs: runs.filter((r) => r.line === li),
        shapeIndex: s.index,
        box: s.box,
      })),
      boxDay,
    );
  }
  // Regel 1 (CR-H-D-02): Termintexte auch aus den Zellen des Terminbereichs, je Tag von oben nach unten,
  // nach den Textfeldern. Kopfzellen («Nr.», «Was» …) und von deckenden Formen verdeckte Zellen entfallen.
  const cellLines = new Map<DayDraft, { row: number; col: number; lines: AgendaLine[] }[]>();
  for (const c of read.model.cells) {
    const text = cleanText(c.text).trim();
    if (text === '' || AGENDA_HEADING.test(text)) continue;
    const range = read.model.rangeAt(c.row, c.col);
    if (range.r0 !== c.row || range.c0 !== c.col) continue;
    const box: Rect = {
      x0: read.model.colX(range.c0),
      x1: read.model.colX(range.c1 + 1),
      y0: read.model.rowY(range.r0),
      y1: read.model.rowY(range.r1 + 1),
    };
    const x = cx(box);
    if (x < gridX0 || x >= gridX1 || box.y0 < yGridEnd - perHour * 0.25) continue;
    const y = cy(box);
    if (
      read.shapes.some(
        (s) => opaque(s) && x >= s.box.x0 && x <= s.box.x1 && y >= s.box.y0 && y <= s.box.y1,
      )
    )
      continue;
    const day = dayAt(Math.min(box.x0 + (box.x1 - box.x0) * 0.1, box.x1 - 1)) ?? dayAt(x);
    if (day === null) {
      report({
        kind: 'uncertainParse',
        box,
        message: msg(
          'Eine Zelle im Terminbereich liegt unter keinem Tag und wurde nicht übernommen.',
          'Die Termine im Raster bzw. in der Liste erfassen.',
        ),
      });
      continue;
    }
    const rich = read.richText.get(`${columnLetters(c.col)}${String(c.row + 1)}`);
    const lines = cellTextLines(
      rich ?? [{ text: c.text, bold: false, strike: false, color: null }],
    );
    const list = cellLines.get(day) ?? [];
    list.push({
      row: c.row,
      col: c.col,
      lines: lines.map((runs) => ({ runs, shapeIndex: null, box })),
    });
    cellLines.set(day, list);
  }
  for (const [day, cells] of cellLines)
    readAgendaLines(
      [...cells].sort((a, b) => a.row - b.row || a.col - b.col).flatMap((c) => c.lines),
      day,
    );

  const boxesByNumber = new Map<number, { shape: WapShape; number: number }[]>();
  for (const b of besoBoxes) {
    const v = visible(b.shape);
    if (v === null) {
      hiddenReport(b.shape, dayAt(cx(b.shape.box)));
      continue;
    }
    const list = boxesByNumber.get(b.number) ?? [];
    list.push(b);
    boxesByNumber.set(b.number, list);
  }
  const textByNumber = new Map<number, AgendaItem>();
  for (const it of items) {
    if (it.parsed.number === null) {
      const key = nextKey();
      entries.push({
        type: 'dayRemark',
        key,
        shapes: it.shapeIndex === null ? [] : [it.shapeIndex],
        status: it.parsed.cancelled ? 'cancelled' : 'confirmed',
        changed: it.parsed.changed,
        removedText: it.parsed.cancelledParts,
        date: it.day.date,
        text: it.parsed.rest,
      });
      continue;
    }
    if (textByNumber.has(it.parsed.number)) {
      report({
        kind: 'uncertainParse',
        date: it.day.date,
        shapeIndex: it.shapeIndex,
        box: it.box,
        besoNumber: it.parsed.number,
        message: msg(
          `Die Termin-Nummer ${it.parsed.number} kommt im Terminbereich mehrfach vor; übernommen wurde der erste Text.`,
          'Termintexte und Nummern prüfen.',
        ),
      });
      continue;
    }
    textByNumber.set(it.parsed.number, it);
  }

  const boxTime = (s: WapShape): { from: number; to: number } => ({
    from: time.toMinute(s.box.y0),
    to: time.toMinute(s.box.y1),
  });
  const boxColumn = (s: WapShape, day: DayDraft): { column: number | null; inRap: boolean } => {
    const cols = day.columns ?? [];
    const idx = coveredColumns(cols, s.box.x0, s.box.x1);
    const best = idx
      .map((i) => ({ i, o: overlap1d(cols[i]?.x0 ?? 0, cols[i]?.x1 ?? 0, s.box.x0, s.box.x1) }))
      .sort((a, b) => b.o - a.o)[0];
    const col = best === undefined ? undefined : cols[best.i];
    if (col === undefined || col.kind === 'beso') return { column: null, inRap: false };
    if (col.kind === 'rap') return { column: null, inRap: true };
    return { column: best?.i ?? null, inRap: false };
  };
  const startOf = (t: TimeSpec): number | null =>
    t.form === 'point'
      ? t.at
      : t.form === 'range' || t.form === 'from'
        ? t.from
        : t.form === 'until'
          ? t.to - 30
          : (t.to ?? null);

  const besoDrafts: BesoDraft[] = [];
  const numbers = [...new Set([...textByNumber.keys(), ...boxesByNumber.keys()])].sort(
    (a, b) => a - b,
  );
  for (const number of numbers) {
    const it = textByNumber.get(number);
    const boxes = [...(boxesByNumber.get(number) ?? [])].sort(
      (a, b) => a.shape.box.y0 - b.shape.box.y0,
    );
    const firstBox = boxes[0];
    const key = nextKey();
    const boxDayOf = (s: WapShape): DayDraft | null => dayAt(cx(s.box));
    const p = it?.parsed;
    const hasTime = p !== undefined && p.time !== null;
    if (p !== undefined && !hasTime) {
      // Nummerierter Termin ohne Zeit → ganztägige Bemerkung (R-8.2-27); ein Kästchen ergibt zusätzlich einen Beso (N-08).
      const remarkKey = nextKey();
      entries.push({
        type: 'dayRemark',
        key: remarkKey,
        shapes: it === undefined || it.shapeIndex === null ? [] : [it.shapeIndex],
        status: p.cancelled ? 'cancelled' : 'confirmed',
        changed: p.changed,
        removedText: p.cancelledParts,
        date: it?.day.date ?? startDate,
        text: p.rest,
      });
      report({
        kind: 'numberedWithoutTime',
        date: it?.day.date ?? null,
        entryKey: remarkKey,
        shapeIndex: it?.shapeIndex ?? null,
        box: it?.box ?? null,
        besoNumber: number,
        message: msg(
          `Der Termin Nr ${number} hat keine Zeit; er wurde als ganztägige Bemerkung übernommen.`,
          // Mit Kästchen derselben Nummer bleiben Bemerkung und Beso getrennt richtig; dann keine Empfehlung zum
          // Umwandeln (UX-AB-08).
          firstBox === undefined
            ? 'Zeit ergänzen und in einen Beso umwandeln, falls ein Zeitpunkt gilt.'
            : `Keine Aktion nötig, wenn der Termin ganztägig gilt; das Kästchen Nr ${number} bleibt ein eigener Beso (siehe «Kästchen ohne Termintext»).`,
        ),
      });
      if (firstBox === undefined) continue;
    }
    const day: DayDraft | null =
      hasTime && it !== undefined
        ? it.day
        : firstBox === undefined
          ? null
          : boxDayOf(firstBox.shape);
    if (day === null || day.columns === null) continue;
    let date = day.date;
    if (p !== undefined && p.deadline !== null) {
      const iso = `${String(p.deadline.year ?? Number(startDate.slice(0, 4)))}-${String(p.deadline.month).padStart(2, '0')}-${String(p.deadline.day).padStart(2, '0')}`;
      if (isIsoDate(iso)) date = iso;
    }
    const windows: BesoWindowDraft[] = [];
    const textWindows = hasTime && p !== undefined ? p.windows : [];
    if (boxes.length === 0) {
      for (const w of textWindows)
        windows.push({ time: w.time, column: null, supplement: w.supplement });
      report({
        kind: 'textWithoutBox',
        date,
        entryKey: key,
        shapeIndex: it?.shapeIndex ?? null,
        box: it?.box ?? null,
        besoNumber: number,
        message: msg(
          `Zum Termin Nr ${number} gibt es kein Kästchen im Raster; das Kästchen liegt jetzt in der Beso-Spalte.`,
          'Lage des Kästchens prüfen.',
        ),
      });
    } else {
      const usedText = new Set<number>();
      for (const b of boxes) {
        const bt = boxTime(b.shape);
        const bDay = boxDayOf(b.shape) ?? day;
        const { column, inRap } = boxColumn(b.shape, bDay);
        const col = bDay === day ? column : null;
        if (col !== null)
          report({
            kind: 'besoInPlanningColumn',
            date,
            entryKey: key,
            shapeIndex: b.shape.index,
            box: b.shape.box,
            besoNumber: number,
            message: msg(
              `Das Kästchen Nr ${number} liegt in der Spalte «${bDay.columns?.[col]?.name ?? ''}»; es wurde ein Zeitfenster des Beso in dieser Spalte.`,
              'Keine Aktion nötig, wenn das Kästchen dort hingehört.',
            ),
          });
        if (inRap)
          report({
            kind: 'besoInRapColumn',
            date,
            entryKey: key,
            shapeIndex: b.shape.index,
            box: b.shape.box,
            besoNumber: number,
            message: msg(
              `Das Kästchen Nr ${number} liegt in der Rap-Spalte; es wurde in die Beso-Spalte verschoben.`,
              'Lage des Kästchens prüfen.',
            ),
          });
        if (textWindows.length === 0) {
          // Kästchen ohne Termintext: Zeit von–bis aus den Kanten (normalisierung 5.5, Abschnitt 6).
          const from = Math.min(1435, round5(bt.from));
          const to = Math.min(from + 1440, Math.max(from + 5, round5(bt.to)));
          windows.push({ time: { form: 'range', from, to }, column: col, supplement: '' });
          continue;
        }
        // Zeitfenster des Termintexts mit der kleinsten Abweichung (Regel 3: Text hat Vorrang).
        // Ein Zeitfenster mit Uhrzeit innerhalb 15 Min passt vor einer Frist ohne Uhrzeit, die keine Lage hat (FA-08).
        const ranked = textWindows
          .map((w, i) => {
            const start = startOf(w.time);
            const d = Math.abs((start ?? bt.from) - bt.from);
            return { w, i, d, fits: start !== null && d <= 15 };
          })
          .sort(
            (a, b) =>
              Number(usedText.has(a.i)) - Number(usedText.has(b.i)) ||
              Number(b.fits) - Number(a.fits) ||
              a.d - b.d,
          );
        const pickWin = ranked[0];
        if (pickWin === undefined) continue;
        usedText.add(pickWin.i);
        windows.push({ time: pickWin.w.time, column: col, supplement: pickWin.w.supplement });
        if (pickWin.d > 15)
          report({
            kind: 'boxTimeDeviation',
            date,
            entryKey: key,
            shapeIndex: b.shape.index,
            box: b.shape.box,
            besoNumber: number,
            message: msg(
              `Das Kästchen Nr ${number} liegt bei ${hhmm(bt.from)}, der Termintext nennt eine um ${Math.round(pickWin.d)} Min abweichende Zeit; übernommen wurde die Zeit des Termintexts.`,
              'Zeit des Beso prüfen.',
            ),
          });
      }
      textWindows.forEach((w, i) => {
        if (!usedText.has(i))
          windows.push({ time: w.time, column: null, supplement: w.supplement });
      });
    }
    if (windows.length === 0) continue;
    if (p === undefined || !hasTime) {
      report({
        kind: 'boxWithoutText',
        date,
        entryKey: key,
        shapeIndex: firstBox?.shape.index ?? null,
        box: firstBox?.shape.box ?? null,
        besoNumber: number,
        // Termin ohne Zeit (Text als ganztägige Bemerkung): derselbe Weg wie «Nummerierte Termine ohne Zeit», kein
        // Rat zum Erfassen eines schon vorhandenen Textes (UX-AB-F-02).
        message:
          p === undefined
            ? msg(
                `Zum Kästchen Nr ${number} gibt es keinen Termintext; der Beso hat einen leeren Titel.`,
                'Termintext des Beso erfassen.',
              )
            : msg(
                `Zum Kästchen Nr ${number} gibt es nur einen Termintext ohne Zeit; er wurde als ganztägige Bemerkung übernommen (siehe «Nummerierte Termine ohne Zeit»), der Beso hat einen leeren Titel.`,
                'Keine Aktion nötig, wenn der Termin ganztägig gilt; gilt er zur Zeit des Kästchens, den Text der Bemerkung als Titel des Beso übernehmen und die Bemerkung löschen.',
              ),
      });
    }
    const cat = firstBox === undefined ? null : categoryOf(firstBox.shape, read, legend);
    const textParsed = hasTime ? p : undefined;
    const draft: BesoDraft = {
      type: 'beso',
      key,
      shapes: [...boxes.map((b) => b.shape.index), ...(it === undefined ? [] : [])],
      status: textParsed?.cancelled ? 'cancelled' : 'confirmed',
      changed: textParsed?.changed ?? false,
      removedText: textParsed?.cancelledParts ?? [],
      date,
      title:
        textParsed === undefined || textParsed.title === ''
          ? textParsed?.freeText
            ? [{ text: textParsed.freeText, bold: false }]
            : []
          : [{ text: textParsed.title, bold: false }],
      windows,
      ltg: textParsed?.ltg ?? '',
      tn: textParsed?.tn ?? '',
      tpt: textParsed?.tpt ?? '',
      ort: textParsed?.ort ?? '',
      categoryId: cat?.first ?? legend.fallback,
      besoNumber: number,
      agendaOverride: textParsed?.freeText ?? null,
    };
    besoDrafts.push(draft);
    for (const b of boxes) roles[b.shape.index] = key;
  }

  // Überlappende Kästchen (Regel 11; R-14.5-01, -02): zwei Kästchen verschiedener Nummern, die sich zeitlich
  // überschneiden und neben- oder übereinander liegen (Anhang A «Bericht: Überlappung mit ‹Nr›»).
  const allBoxes = besoDrafts.flatMap((d) =>
    (boxesByNumber.get(d.besoNumber) ?? []).map((b) => ({ d, b })),
  );
  for (let i = 0; i < allBoxes.length; i++)
    for (let j = i + 1; j < allBoxes.length; j++) {
      const a = allBoxes[i];
      const b = allBoxes[j];
      if (a === undefined || b === undefined || a.d === b.d) continue;
      const ra = a.b.shape.box;
      const rb = b.b.shape.box;
      const oy = Math.min(ra.y1, rb.y1) - Math.max(ra.y0, rb.y0);
      const ox = Math.min(ra.x1, rb.x1) - Math.max(ra.x0, rb.x0);
      const touch = Math.min(ra.x1 - ra.x0, rb.x1 - rb.x0) * 0.05;
      if (oy <= 0 || ox < -touch) continue;
      const [first, second] = a.d.besoNumber <= b.d.besoNumber ? [a, b] : [b, a];
      report({
        kind: 'overlappingShapes',
        date: first.d.date,
        entryKey: first.d.key,
        shapeIndex: first.b.shape.index,
        box: first.b.shape.box,
        besoNumber: first.d.besoNumber,
        group: null,
        message: msg(
          `Die Kästchen Nr ${first.d.besoNumber} und ${second.d.besoNumber} überlagern sich zeitlich.`,
          'Kästchen prüfen; im WAP-Planer weichen sie automatisch in die zweite Bahn aus.',
        ),
      });
    }

  // Nummern in falscher Reihenfolge zur Sortierzeit (Regel 10, 11; R-8.2-25).
  const sortTimeOf = (t: TimeSpec): number =>
    t.form === 'point'
      ? t.at
      : t.form === 'range' || t.form === 'from'
        ? t.from
        : t.form === 'until'
          ? t.to
          : (t.to ?? 0);
  for (const day of days) {
    // Fristen ohne Uhrzeit haben keine Tageszeit und bleiben ausserhalb der Reihenfolge.
    const list = besoDrafts
      .filter((d) => d.date === day.date && !d.windows.every((w) => w.time.form === 'deadline'))
      .map((d) => ({ d, t: Math.min(...d.windows.map((w) => sortTimeOf(w.time))) }))
      .sort((a, b) => a.t - b.t || a.d.besoNumber - b.d.besoNumber);
    list.forEach((x, i) => {
      const smaller = list.slice(i + 1).filter((y) => y.d.besoNumber < x.d.besoNumber);
      if (smaller.length === 0) return;
      report({
        kind: 'numberOrder',
        date: day.date,
        entryKey: x.d.key,
        besoNumber: x.d.besoNumber,
        message: msg(
          `Die Beso-Nummer ${x.d.besoNumber} liegt nach der Sortierzeit vor ${smaller.map((y) => y.d.besoNumber).join(', ')}; die Nummern bleiben.`,
          'Bei Bedarf «Tag neu nummerieren» verwenden.',
        ),
      });
    });
  }

  // Status-Meldungen (Regel 2).
  for (const e of [...merged, ...rapports, ...besoDrafts, ...entries]) {
    if (e.status === 'cancelled')
      report({
        kind: 'cancelled',
        entryKey: e.key,
        shapeIndex: e.shapes[0] ?? null,
        message: msg(
          'Ein rot durchgestrichener Eintrag wurde als gestrichen übernommen.',
          'Keine Aktion nötig.',
        ),
      });
    else if (e.removedText.length > 0)
      report({
        kind: 'partlyCancelled',
        entryKey: e.key,
        shapeIndex: e.shapes[0] ?? null,
        message: msg(
          'Ein rot durchgestrichener Textteil wurde entfernt und als gestrichener Teil vermerkt.',
          'Text des Eintrags prüfen.',
        ),
      });
    if (e.changed)
      report({
        kind: 'changed',
        entryKey: e.key,
        shapeIndex: e.shapes[0] ?? null,
        message: msg(
          'Roter Text wurde als «geändert seit letztem Stand» übernommen.',
          'Keine Aktion nötig.',
        ),
      });
  }

  // --- Seitenleiste: Wochenziele, Erhöhte Bereitschaft, Bemerkungen ---------------------------------
  const weekGoals: string[] = [];
  let heightenedReadiness = '';
  const sun: { sunrise: number | null; sunset: number | null } = { sunrise: null, sunset: null };
  let motto = '';
  const remarkEntries: MultiDayRemarkDraft[] = [];
  const legendTop = sidebar.legendTopY;
  const legendBottom = sidebar.legendEndY;
  for (const s of side) {
    const lines = s.lines.map((l) => cleanText(l).trim()).filter((l) => l !== '');
    const head = lines[0] ?? '';
    if (/^bemerkung/i.test(head)) {
      roles[s.index] = 'Bemerkungen';
      const items: string[] = [];
      const bulleted = lines.slice(1).filter((l) => BULLET.test(l)).length;
      for (const l of lines.slice(1)) {
        if (bulleted > 0 && !BULLET.test(l) && items.length > 0)
          items[items.length - 1] = `${items.at(-1) ?? ''} ${l}`;
        else items.push(l.replace(BULLET, '').trim());
      }
      let firstKey: string | null = null;
      for (const text of items) {
        if (text === '') continue;
        const key = nextKey();
        firstKey ??= key;
        remarkEntries.push({
          type: 'multiDayRemark',
          key,
          shapes: [s.index],
          status: 'confirmed',
          changed: false,
          removedText: [],
          text,
          number: null,
        });
      }
      const overLegend =
        legendTop !== null &&
        legendBottom !== null &&
        overlap1d(s.box.y0, s.box.y1, legendTop, legendBottom) > 0;
      const overOther = side.some(
        (o) =>
          o !== s &&
          o.lines.some((l) => l.trim() !== '') &&
          overlap1d(o.box.x0, o.box.x1, s.box.x0, s.box.x1) > 0 &&
          overlap1d(o.box.y0, o.box.y1, s.box.y0, s.box.y1) > 0,
      );
      // Textüberlauf (Beschrieb 1 «Box Bemerkungen überlagert die Legende»): geschätzte Texthöhe über der Box.
      const runs = read.runs.get(s.index) ?? [];
      const sizePt = Math.max(8, ...runs.map((r) => r.sizePt ?? 0)) || 10;
      const widthPt = (s.box.x1 - s.box.x0) / 12700;
      const perLine = Math.max(1, Math.floor(widthPt / (sizePt * 0.5)));
      const textLines = s.lines.reduce((n, l) => n + Math.max(1, Math.ceil(l.length / perLine)), 0);
      const overflow = textLines * sizePt * 1.2 > (s.box.y1 - s.box.y0) / 12700 + 2;
      if (overLegend || overOther || overflow)
        report({
          kind: 'overlappingShapes',
          entryKey: firstKey,
          shapeIndex: s.index,
          box: s.box,
          message: msg(
            'Die Box «Bemerkungen» überlagert in der Seitenleiste die Legende bzw. ein anderes Feld.',
            'Keine Aktion nötig; im WAP-Planer stehen Bemerkungen und Legende getrennt.',
          ),
        });
      continue;
    }
    if (/^erh.hte\s+bereitschaft/i.test(head)) {
      roles[s.index] = 'Erhöhte Bereitschaft';
      heightenedReadiness = lines.slice(1).join(' ');
      continue;
    }
    if (
      /^wochenziel/i.test(head) ||
      (sidebar.goalsRow !== null &&
        sidebar.remarksRow !== null &&
        s.box.y0 >= read.model.rowY(sidebar.goalsRow) &&
        s.box.y1 <= read.model.rowY(sidebar.remarksRow + 1) &&
        lines.length > 0 &&
        s.kind === 'sp')
    ) {
      roles[s.index] = 'Wochenziele';
      // Entscheid 9 (19.10.2026): nur der im Excel sichtbare Text; der Rest kommt in den Bericht.
      const runs = read.runs.get(s.index) ?? [];
      const sizes = (i: number): number[] =>
        runs.flatMap((r) => (r.sizePt !== null && (i < 0 || r.line === i) ? [r.sizePt] : []));
      const fallback = sizes(-1);
      const shown = visibleTextLines(
        s.box,
        s.lines.map((text, i) => {
          const own = sizes(i);
          const size = own.length > 0 ? own : fallback;
          return { text, sizePt: size.length > 0 ? Math.max(...size) : null };
        }),
        coversOf(s),
      );
      let headSkipped = !/^wochenziel/i.test(head);
      let hiddenLines = 0;
      let hiddenChars = 0;
      const hiddenText: string[] = [];
      s.lines.forEach((raw, i) => {
        const l = cleanText(raw).trim();
        if (l === '') return;
        if (!headSkipped) {
          headSkipped = true;
          return;
        }
        const text = l.replace(BULLET, '').trim();
        if (text === '') return;
        if (shown[i] === true) weekGoals.push(text);
        else {
          hiddenLines++;
          hiddenChars += text.length;
          hiddenText.push(text);
        }
      });
      if (hiddenLines > 0)
        report({
          kind: 'notVisible',
          shapeIndex: s.index,
          box: s.box,
          // Text der Zeilen nur für die Anzeige im lokalen Bericht (CR-D-2-04), nicht in der Meldung.
          notTakenText: hiddenText,
          message: msg(
            `Wochenziele: ${String(hiddenLines)} ${hiddenLines === 1 ? 'Zeile' : 'Zeilen'} mit ${String(hiddenChars)} Zeichen im Excel nicht sichtbar, nicht übernommen.`,
            'Im Excel prüfen, ob der Text gilt; wenn ja, die Wochenziele der Woche im Seitenfeld «Woche» ergänzen.',
          ),
        });
      continue;
    }
    if (s.geometry === 'sun' || s.geometry === 'moon') {
      roles[s.index] = 'Sonnenzeiten-Symbol';
      continue;
    }
    // Sonnenzeiten (Beschrieb 4.8, Etappe 1 von Hand): Zeit «hhmm» auf der Höhe von Sonne bzw. Mond.
    const only = lines.length === 1 ? (lines[0] ?? '') : '';
    const sunTime = /^([01]\d|2[0-3])[.:]?([0-5]\d)$/.exec(only);
    if (sunTime !== null) {
      const symbol = side.find(
        (o) =>
          (o.geometry === 'sun' || o.geometry === 'moon') &&
          overlap1d(o.box.y0, o.box.y1, s.box.y0, s.box.y1) > 0,
      );
      if (symbol !== undefined) {
        const t = Number(sunTime[1]) * 60 + Number(sunTime[2]);
        if (symbol.geometry === 'sun') sun.sunrise = round5(t);
        else sun.sunset = round5(t);
        roles[s.index] = 'Sonnenzeit';
        continue;
      }
    }
    // Rahmen ohne Text und ohne Füllung: Gestaltung der Seitenleiste, kein Inhalt.
    if (lines.length === 0 && s.kind === 'sp' && (s.fill === null || s.fill === 'FFFFFF')) {
      roles[s.index] = 'Seitenleiste (Rahmen)';
      continue;
    }
    // Motto: eine Zeile in Grossbuchstaben im unteren Teil der Seitenleiste (Beschrieb 4.1).
    if (
      lines.length === 1 &&
      /^[A-ZÄÖÜ0-9 &.,!-]{4,}$/.test(only) &&
      /[A-ZÄÖÜ]{3}/.test(only) &&
      (legendBottom === null || s.box.y0 >= legendBottom)
    ) {
      motto = only;
      roles[s.index] = 'Motto';
      continue;
    }
    report({
      kind: 'unassignedShape',
      shapeIndex: s.index,
      box: s.box,
      message: msg(
        s.kind === 'pic'
          ? 'Ein Bild in der Seitenleiste (z.B. Wappen) wurde nicht übernommen.'
          : 'Ein Feld der Seitenleiste (z.B. Unterschrift, Motto oder Sonnenzeiten) wurde nicht übernommen.',
        'Diese Angaben in den Plan-Einstellungen erfassen.',
      ),
    });
  }
  for (const c of sidebar.remarkCells) {
    remarkEntries.push({
      type: 'multiDayRemark',
      key: nextKey(),
      shapes: [],
      status: 'confirmed',
      changed: false,
      removedText: [],
      text: c.text,
      number: c.number,
    });
  }

  // Formen in Raster und Terminbereich, die nichts geworden sind.
  for (const s of read.shapes) {
    if (roles[s.index] !== null) continue;
    if (reports.some((r) => r.shapeIndex === s.index)) continue;
    const day = dayAt(cx(s.box));
    report({
      kind: 'unassignedShape',
      date: day?.date ?? null,
      shapeIndex: s.index,
      box: s.box,
      message: msg(
        `Eine Form${day === null ? ' ausserhalb des Rasters' : ` am ${day.weekday}`} wurde keinem Eintrag zugeordnet.`,
        'Im Excel prüfen, ob sie etwas bedeutet; wenn ja, den Eintrag erfassen.',
      ),
    });
  }

  return {
    sheet: read.name,
    shortName: shortNameOf(read.name),
    label: header.label || read.name.trim(),
    startDate,
    days,
    entries: [
      ...entries.filter((e) => e.type !== 'dayRemark' && e.type !== 'marker'),
      ...entries.filter((e) => e.type === 'marker'),
      ...merged,
      ...rapports,
      ...besoDrafts,
      ...entries.filter((e) => e.type === 'dayRemark'),
      ...remarkEntries,
    ],
    reports,
    weekGoals,
    heightenedReadiness,
    sun,
    motto,
    unit: header.unit,
    beilage: header.beilage,
    standDate: header.standDate,
    abbreviations: sidebar.abbreviations,
    shapeRoles: roles,
  };
}
