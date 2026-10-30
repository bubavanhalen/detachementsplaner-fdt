import {
  type CSSProperties,
  type FocusEvent,
  type FormEvent,
  Fragment,
  type JSX,
  type KeyboardEvent,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { addDays, daysBetween, formatDate } from '../../../model/wap/calendar';
import {
  type ArrangeMode,
  type Arrangement,
  applyArrangement,
  arrangeBlocks,
  arrangementSize,
  type BlockGesture,
  combineResults,
  placeTimeWindow,
} from '../../../model/wap/commands/arrange';
import { renumberDay, renumberDayPreview } from '../../../model/wap/commands/beso';
import { carryColumnSelection } from '../../../model/wap/commands/columns';
import type { CommandContext, CommandResult } from '../../../model/wap/commands/command';
import { CommandError } from '../../../model/wap/commands/command';
import {
  type ColumnScope,
  columnSetUsage,
  type DayColumnChanges,
  type DayColumnInsertRemove,
  insertOrRemoveDayColumn,
  updateDayColumn,
} from '../../../model/wap/commands/dayColumns';
import {
  copyEntries,
  copyEntryToDates,
  createEntry,
  deleteEntries,
  type MoveSpec,
  updateEntries,
  updateEntry,
} from '../../../model/wap/commands/entries';
import { updateCommonFields } from '../../../model/wap/commands/settings';
import { agendaLinesForDate, resolveTitle } from '../../../model/wap/derive/agenda';
import { MARKER_COLUMNS } from '../../../model/wap/derive/marker';
import { agendaTextArea } from '../../../model/wap/layout/page/agendaParts';
import { agendaAvailPt } from '../../../model/wap/layout/page/agendaScreen';
import { hourTimes } from '../../../model/wap/layout/page/chromeParts';
import { layoutWeekPage } from '../../../model/wap/layout/page/compose';
import { pageFrame, pageGeometryFor } from '../../../model/wap/layout/page/geometry';
import type { Stroke } from '../../../model/wap/layout/pageModel';
import { isRenderable, measureRuns } from '../../../model/wap/layout/text/measure';
import {
  builtInTemplates,
  kpTemplate,
  type LevelTemplate,
  templateById,
} from '../../../model/wap/template';
import { formatMilTime, formatTimeSpec } from '../../../model/wap/time';
import type {
  Beso,
  Block,
  Column,
  ColumnSelection,
  ColumnWeight,
  Entry,
  Id,
  IsoDate,
  Plan,
  Rapport,
  TimeSpec,
} from '../../../model/wap/types';
import { DetailPanel } from '../panel/DetailPanel';
import { boldTextOf, editBold, richOf, toggleBold } from '../panel/richText';
import type { PanelActions, PanelTarget } from '../panel/types';
import { MarkerDialog, QuerbalkenDialog, RemarkDialog, RenumberDialog } from './CreateDialogs';
import { clipboard } from './clipboard';
import {
  blockSpan,
  columnsRect,
  dayViews,
  type EntryView,
  plainTitle,
  querbalkenLanes,
  RAPPORT_IN_COLUMNS,
  type Rect,
  rapportSpan,
} from './entryViews';
import { createFeedbackStore, type FeedbackStore, useFeedback } from './feedbackStore';
import { fillTarget } from './fill';
import { GoToDialog, OtherDaysDialog } from './GridDialogs';
import { GridMenu, type MenuItem } from './GridMenu';
import {
  AXIS_WIDTH,
  autoscrollSpeed,
  type DayBox,
  dayBoxes,
  nextZoom,
  type PageBasis,
  pageBasis,
  pageFactor,
  pageScaleOf,
  type Scale,
  stepWeight,
  timeLabel,
  weightAtBoundary,
  weightName,
  type ZoomSetting,
  zoomLabel,
} from './geometry';
import {
  columnAt,
  GRIP_H,
  GRIP_W,
  type Grip,
  type GripZone,
  gripsOf,
  type Hit,
  hitEntry,
  markerLine,
  ZONE_CURSOR,
  type Zone,
} from './hitTest';
import { I2Dialog } from './I2Dialog';
import { caretBox, indexNear, placeFields, selectionBoxes, textBoxes, wordAt } from './inlineText';
import { columnsBetween, drawingTime, moveAcrossDayBoundary, snapMinutes } from './interaction';
import {
  adjacentItem,
  type CellRange,
  type Cursor,
  type CursorMove,
  cellRange,
  cursorLabel,
  initialCursor,
  itemAfterCursor,
  itemKey,
  moveCursor,
  normalizeCursor,
  STEP,
} from './keyboard';
import { Line, Lines, RenderedEntry } from './LayoutRender';
import {
  layoutViews,
  pageAgendaColumns,
  pageAgendaFrame,
  pageHeads,
  type ScreenAgenda,
  type ScreenHeads,
  type ScreenLine,
  screenAgenda,
  screenFactor,
  screenHeads,
} from './layoutViews';
import { type BarItem, OverflowBar } from './OverflowBar';
import { withPreview } from './preview';
import { useElementCache, useLatest } from './renderCache';
import {
  duplicateSelection,
  entryDate,
  entrySpan,
  missingColumns,
  moveSelection,
  pasteEntries,
  referencePoint,
  resizeEnd,
} from './selectionCommands';
import { parseTimeInput } from './timeInput';
import type { WapCommand } from './WapPalette';
import './grid.css';

type RunCommand = (plan: Plan, context: CommandContext) => CommandResult;

/** Meldung mit «Rückgängig» (I2b-B B5); `undo` ist das Verb im Namen des Knopfs («Löschen rückgängig machen»). */
export interface GridToast {
  readonly text: string;
  readonly undo?: string;
}

/** Fokus nach Rückgängig, Datei öffnen, Wochenwechsel (I2b-B B5): betroffener Eintrag, sonst Zellzeiger. */
export interface FocusRequest {
  readonly seq: number;
  readonly ids: readonly Id[];
  /** Vom Raster gesetzt, sobald der Fokus gesetzt ist (ein Auftrag gilt nur einmal). */
  handled: boolean;
  /** Nur wählen und zeigen, den Fokus nicht verschieben (Sprung aus dem offenen Importbericht, H-UI2 UX-H-10). */
  readonly reveal?: boolean;
  /**
   * Stelle ohne Eintrag (z.B. verdeckte, nicht übernommene Form aus dem Importbericht): als gestrichelter Geist an der
   * Originallage zeigen, Zellzeiger dorthin (UI-Richtlinie 9; UX-AB-07).
   */
  readonly place?: GhostPlace;
}

/** Geist einer nicht übernommenen Form: Tag, Spanne in Minuten, Beschriftung (UX-AB-07). */
export interface GhostPlace {
  readonly date: IsoDate;
  readonly from: number;
  readonly to: number;
  readonly label: string;
}

/** Lage des Zellzeigers über den Wochenwechsel (UI-Richtlinie 3): Wochentag, Zeit, Spaltenname. */
export interface CursorMemory {
  weekday: number;
  minute: number;
  columnName: string;
}

export interface I2GridEditorProps {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly onCommand: (run: RunCommand) => Promise<void>;
  readonly readOnly: boolean;
  /** Bedienelemente der Werkzeugleiste vor den Rasterwerkzeugen (I2b-A A5: eine Zeile; H-UI2: mit Überlauf). */
  readonly toolbarItems?: readonly BarItem[];
  /** Befehle des Rasters für die Befehlspalette (H-UI2, UX-H-08); das Raster schreibt sie bei jedem Zeichnen. */
  readonly commands?: { current: readonly WapCommand[] };
  readonly onToast?: (toast: GridToast) => void;
  readonly focusRequest?: FocusRequest;
  readonly cursorMemory?: { current: CursorMemory | null };
  /** Prüfmarken je Eintrag (I5 D1; UI-Richtlinie 4.2): Stufe und Text, nur am Bildschirm. */
  readonly findingMarks?: ReadonlyMap<Id, FindingMark>;
  /** Weiterer Seitenbereich neben dem Seitenfeld (I5: Befundliste). */
  readonly aside?: ReactNode;
}

/** Prüfmarke eines Eintrags: höchste Stufe der offenen Befunde und ihre Regeln (UI-Richtlinie 4.2). */
export interface FindingMark {
  readonly severity: 'error' | 'warning' | 'hint';
  readonly text: string;
}

interface Placement {
  readonly date: IsoDate;
  readonly from: number;
  readonly to: number;
  readonly columns: ColumnSelection;
}
interface Selection {
  readonly id: Id;
  readonly windowId: Id | null;
}
interface EditValues {
  readonly title: string;
  /** Fett je Zeichen des Titels (Beschrieb 5.1 «ein Teil fett»; Ctrl+B, R-5.1-23). */
  readonly mask: readonly boolean[];
  readonly supplement: string;
  readonly ltg: string;
  readonly ort: string;
}
/** Art der Direktbearbeitung: Block (Titel, Zusatz, Ltg, Ort), Rapport (Kürzel), Beso (Termintext; B8). */
type EditType = 'block' | 'rapport' | 'beso';
type Editing =
  | {
      readonly kind: 'block';
      readonly id: Id;
      readonly windowId: Id | null;
      readonly entryType: EditType;
      readonly values: EditValues;
      readonly original: EditValues;
      readonly selectAll: boolean;
    }
  | {
      readonly kind: 'draft';
      readonly entryType: EditType;
      readonly placement: Placement;
      readonly mode: ArrangeMode;
      readonly values: EditValues;
      readonly original: EditValues;
      readonly selectAll: boolean;
    };
/** Feld, das beim Öffnen den Fokus erhält (Direktbefehle Z, T, S; B7). */
type FormField = 'title' | 'begin' | 'date' | 'columns';
interface BlockForm {
  readonly entryId: Id | null;
  readonly title: string;
  readonly date: string;
  readonly begin: string;
  readonly end: string;
  /** Ende von Hand geändert: sonst folgt es dem Beginn mit gleicher Dauer. */
  readonly endTouched: boolean;
  readonly duration: number;
  /** 'keep', 'all' oder die erste Spalte des Bereichs (B7 «Spaltenbereich von–bis»). */
  readonly columnId: string;
  /** Letzte Spalte des Bereichs; '' = nur die erste. */
  readonly columnTo: string;
  readonly initialColumns: ColumnSelection;
  readonly focus: FormField;
  readonly invalid: 'title' | 'begin' | 'end' | null;
}
type GestureKind = 'create' | 'band' | 'move' | 'start' | 'end' | 'left' | 'right' | 'marquee';
interface Target {
  readonly date: IsoDate;
  readonly from: number;
  readonly to: number;
  readonly columns: ColumnSelection;
  readonly columnId: Id | null;
  readonly dayOffset: number;
  /** Kante am Tagesende bzw. -beginn angehalten (UX-FUX3-02): der Zeiger liegt darüber hinaus. */
  readonly dayLimit?: true;
}
interface Live {
  readonly kind: GestureKind;
  /** Grundgrösse des angehobenen Blocks (F-UX3): Grösse einmal setzen, danach nur transform (translate, scale). */
  liftBase?: { readonly w: number; readonly h: number };
  /** Zeitschild in dieser Geste schon gesetzt (erstes Bild ohne Gleiten; F-PERF). */
  labelPlaced?: boolean;
  /**
   * Lage des Blocks beim Greifen (Inhaltskoordinaten, UX-FUX3-01): die Textebene des angehobenen Blocks bleibt beim
   * Kantenzug an dieser Lage (nicht gestreckt), solange die Kante nicht über den Text hinweg nach innen rückt.
   */
  liftOrigin?: { readonly left: number; readonly top: number } | undefined;
  /** Ausstehendes Bild (requestAnimationFrame): Zeigerereignisse sammeln, je Bild einmal verarbeiten (F-UX3). */
  pending?: number | undefined;
  /**
   * Neuzeichnen des Rasters (Vorschau der Nachbarn) im nächsten Bild (F-PERF, FL2-04): bei Zeigerbewegung zeichnet
   * dieses Bild den angehobenen Block und das Schild, das nächste die Nachbarn; so verteilt sich ein Rasterschritt
   * auf zwei Bilder. Tasten (Shift/Alt) zeichnen sofort (≤ 1 Bild, Runde 4).
   */
  dragFrame?: number | undefined;
  nextDrag?: DragView | undefined;
  /** Klick ohne Ziehen: nur diesen wählen, aufnehmen/herausnehmen (Ctrl), Bereich (Shift), Auswahl behalten. */
  readonly clickMode: 'plain' | 'toggle' | 'range' | 'keep';
  /** Einträge, die beim Ziehen gemeinsam verschoben werden (B2). */
  readonly group: readonly Id[];
  /** Alt+Ziehen auf einem Block: Titel des Blocks, zu dem der neue parallel liegt. */
  readonly parallelTo: string | null;
  readonly entry: Entry | null;
  readonly windowId: Id | null;
  readonly view: EntryView | null;
  /** Ziehen in der Rap- bzw. Beso-Spalte erzeugt einen Rapport bzw. Beso (R-5.1-24). */
  readonly special: Column | null;
  readonly originDay: DayBox;
  readonly originMinute: number;
  readonly originColumn: number;
  readonly originX: number;
  readonly originY: number;
  readonly wrapper: { readonly left: number; readonly top: number };
  readonly scroll0: { readonly left: number; readonly top: number };
  /**
   * Rolllage während der Geste (Runde 3): beim Beginn gelesen, danach vom Autoscroll gesetzt bzw. im Scroll-Ereignis
   * nachgeführt – keine Layout-Lesung je Bild. `scrollMax` = grösste Rolllage beim Beginn.
   */
  scrollNow: { left: number; top: number };
  readonly scrollMax: { readonly left: number; readonly top: number };
  /** Zuletzt gezeichnete Lage des angehobenen Blocks (Raster, Inhaltskoordinaten); Text nur bei Wechsel. */
  liftRect?: Rect;
  readonly bodyTop: number;
  /**
   * Lage des Rasterbereichs und Fenstergrösse beim Beginn (PERF): beim Ziehen nicht neu gelesen, sonst erzwänge jedes
   * Bild nach einer Änderung eine sofortige Layout-Berechnung.
   */
  readonly frame: {
    readonly left: number;
    readonly top: number;
    readonly width: number;
    readonly height: number;
    readonly windowWidth: number;
    readonly windowHeight: number;
  };
  readonly base: Placement;
  readonly element: HTMLElement;
  readonly pointerId: number;
  started: boolean;
  target: Target;
  key: string;
  /** Vorschau der Nachbarn beim letzten Neuzeichnen des Rasters (PERF: neu zeichnen nur bei Änderung). */
  structure: string | null;
  shift: boolean;
  alt: boolean;
  /** Ctrl (bzw. Cmd) gedrückt: beim Loslassen eine Kopie ablegen (UI-Richtlinie 5.5; CR-H-U-10). */
  ctrl: boolean;
  pointerX: number;
  pointerY: number;
  cancelling: boolean;
}
interface DragView {
  readonly kind: GestureKind;
  readonly entryId: Id | null;
  readonly windowId: Id | null;
  readonly entryKind: EntryView['kind'] | 'create';
  readonly target: Target;
  readonly label: string;
  readonly arrangement: Arrangement | null;
  /** Shift (folgende mitschieben), Alt (parallel, ohne Anpassung) oder Variante c (F-UX3, bewegung-v1). */
  readonly mode: ArrangeMode;
  /** Plakette am Zeitschild (Runde 3, 1a): Modus mit Anzahl bzw. «dockt an …» (leer: keine Plakette). */
  readonly badge: string;
}
interface ColumnEdit {
  readonly date: IsoDate;
  readonly columnId: Id;
  readonly value: string;
  /** Eben eingefügte Spalte: Geltungsbereich des Einfügens gilt auch für den Namen (keine zweite Rückfrage; UX-2-06). */
  readonly scope?: ColumnScope;
}
interface ScopeQuestion {
  readonly title: string;
  readonly description: string;
  readonly weekday: DayBox['weekday'];
  readonly columnId: Id;
  readonly changes: DayColumnChanges;
  /** Einfügen bzw. Entfernen statt Name/Breite (F-UX2 P6). */
  readonly op?: DayColumnInsertRemove;
}

const WEEKDAY_ORDER = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
function weekdayIndex(weekday: string): number {
  return Math.max(0, WEEKDAY_ORDER.indexOf(weekday as (typeof WEEKDAY_ORDER)[number]));
}

const EMPTY_VALUES: EditValues = { title: '', mask: [], supplement: '', ltg: '', ort: '' };

/** Getippter Anfang eines neuen Titels: ganz fett (neue Blocktitel sind fett, UI-Richtlinie 5.4). */
/** Textfelder der Direktbearbeitung in Tab-Reihenfolge. */
type EditField = 'title' | 'supplement' | 'ltg' | 'ort';
const EDIT_FIELDS: readonly EditField[] = ['title', 'supplement', 'ltg', 'ort'];

function typedValues(base: EditValues, typed: string): EditValues {
  return { ...base, title: typed, mask: Array.from({ length: typed.length }, () => true) };
}
const HOVER_DELAY = 400;
/** Ereignis am Raster bei jedem Wechsel von Eintrag oder Zone unter dem Zeiger (F-UX3; `detail`: HoverZone | null). */
export const HOVER_EVENT = 'i2-hover';
/** Eintrag und Zone unter dem Zeiger (F-UX3). */
export interface HoverZone {
  readonly key: string;
  readonly id: Id;
  readonly windowId: Id | null;
  readonly zone: Zone;
  /** Art des Eintrags und seine Fläche in Inhaltskoordinaten des Rasters (Lage der Griffe, Runde 3). */
  readonly kind: EntryView['kind'];
  readonly rect: Rect;
}

/** Griffe (Runde 3, 5a): Pille 34 × 16 px mit Doppelpfeil und Griffpunkten; senkrecht um 90° gedreht. */
const GRIP_ZONES: readonly GripZone[] = ['start', 'end', 'left', 'right', 'marker'];

/** Griff an seine Mitte (Inhaltskoordinaten) setzen; nur transform. */
/** Vergrösserung des gegriffenen Griffs (CSS `.is-grab`, 1,2) für die Lage innen an der Kante. */
const GRIP_GRAB_SCALE = 1.2;

/**
 * Gegriffener Griff innen an der Kante (UX-FUX3-05): die vergrösserte Pille liegt beim Ziehen ganz im gezogenen Block
 * und verdeckt den Nachbarn an der Kante samt Plakette nicht; bei kleinem Block höchstens mittig.
 */
function gripInside(g: Grip, rect: Rect): Grip {
  const half = ((g.vertical ? GRIP_W : GRIP_H) * GRIP_GRAB_SCALE) / 2 + 1;
  const halfX = ((g.vertical ? GRIP_H : GRIP_W) * GRIP_GRAB_SCALE) / 2 + 1;
  const midY = rect.top + rect.height / 2;
  const midX = rect.left + rect.width / 2;
  switch (g.zone) {
    case 'end':
      return { ...g, cy: Math.max(midY, rect.top + rect.height - half) };
    case 'start':
      return { ...g, cy: Math.min(midY, rect.top + half) };
    case 'right':
      return { ...g, cx: Math.max(midX, rect.left + rect.width - halfX) };
    case 'left':
      return { ...g, cx: Math.min(midX, rect.left + halfX) };
    default:
      return g;
  }
}

function placeGrip(el: HTMLElement, g: Grip): void {
  const w = g.vertical ? GRIP_H : GRIP_W;
  const h = g.vertical ? GRIP_W : GRIP_H;
  el.style.transform = `translate3d(${String(Math.round(g.cx - w / 2))}px, ${String(Math.round(g.cy - h / 2))}px, 0)`;
}

/** Zeichnung der Pille (eigene SVG, offline); `hot`: gefüllt in der Modusfarbe, Symbol weiss. */
function GripShape({ vertical, hot }: { vertical: boolean; hot: boolean }): JSX.Element {
  const inner = (
    <>
      <rect className="i2-grip-bg" x="1" y="1" width="32" height="14" rx="7" />
      <path className="i2-grip-ic" d="M14 6.8l3-2.7 3 2.7M14 9.2l3 2.7 3-2.7" />
      <circle className="i2-grip-dot" cx="8.6" cy="6.4" r="1" />
      <circle className="i2-grip-dot" cx="8.6" cy="9.6" r="1" />
      <circle className="i2-grip-dot" cx="25.4" cy="6.4" r="1" />
      <circle className="i2-grip-dot" cx="25.4" cy="9.6" r="1" />
    </>
  );
  return vertical ? (
    <svg
      className={hot ? 'is-h' : 'is-n'}
      width={GRIP_H}
      height={GRIP_W}
      viewBox={`0 0 ${String(GRIP_H)} ${String(GRIP_W)}`}
      aria-hidden="true"
    >
      <g transform={`translate(${String(GRIP_H)},0) rotate(90)`}>{inner}</g>
    </svg>
  ) : (
    <svg
      className={hot ? 'is-h' : 'is-n'}
      width={GRIP_W}
      height={GRIP_H}
      viewBox={`0 0 ${String(GRIP_W)} ${String(GRIP_H)}`}
      aria-hidden="true"
    >
      {inner}
    </svg>
  );
}

/** Dauer als «45 Min» bzw. «1 h 30 Min» (Plaketten der Nachbarn). */
function durationText(minutes: number): string {
  const m = Math.abs(minutes);
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h === 0
    ? `${String(r)} Min`
    : r === 0
      ? `${String(h)} h`
      : `${String(h)} h ${String(r)} Min`;
}
/** Touch (UX-H-02): Langdruck vor dem Ändern; Bewegung darüber gilt als Wischen (Rollen). */
const LONG_PRESS_MS = 450;
const TOUCH_SLOP = 8;
/** Obere Randlinie des Terminbereichs am Bildschirm (px, CSS border-top). */
/** Obere Randlinie des Terminbereichs: jetzt als Linie der Seite gezeichnet (VQA-2-02). */
const AGENDA_BORDER = 0;
const PANEL_KEY = 'wap-planer:seitenfeld';
/** Feldsprung-Tasten im Seitenfeld (UI-Richtlinie 13.3): Zeit, Tag, Spalten, Kategorie, Ltg, Ort. */
/** «0800-1200» bzw. «08:00–12:00» als Beginn und Ende; sonst null. */
function splitRange(value: string): { readonly begin: string; readonly end: string } | null {
  const m = /^\s*(\d{1,2}:?\d{2})\s*[-–]\s*(\d{1,2}:?\d{2})\s*$/.exec(value);
  return m === null || m[1] === undefined || m[2] === undefined ? null : { begin: m[1], end: m[2] };
}

/** Zoomtasten im Raster: 1 vergrössern, -1 verkleinern, 0 einpassen (UI-Richtlinie 4.1; H-UI2, SA-H-22). */
const ZOOM_KEYS: Readonly<Record<string, 1 | -1 | 0>> = { '+': 1, '-': -1, '−': -1, '0': 0 };
/** Mit Ctrl: auch «=» (Plus ohne Shift) und «_» (Minus mit Shift). */
const ZOOM_KEYS_CTRL: Readonly<Record<string, 1 | -1 | 0>> = {
  ...ZOOM_KEYS,
  '=': 1,
  _: -1,
};

const FIELD_KEYS: Readonly<Record<string, string>> = {
  z: 'time',
  t: 'date',
  s: 'columns',
  k: 'category',
  l: 'ltg',
  o: 'ort',
};

/**
 * Spalten (Indizes) nach dem Verschieben der linken bzw. rechten Aussengrenze auf `edge`: nur die äussere Grenze
 * ändert sich, Lücken zwischen verknüpften Teilblöcken bleiben (R-4.6-60/-61, CR-3-01); mindestens eine Spalte.
 */
function spanEdge(chosen: readonly number[], side: 'left' | 'right', edge: number): Set<number> {
  const first = Math.min(...chosen);
  const last = Math.max(...chosen);
  const out = new Set<number>();
  if (side === 'right') {
    const to = Math.max(edge, first);
    for (const i of chosen) if (i <= to) out.add(i);
    for (let i = last + 1; i <= to; i++) out.add(i);
  } else {
    const from = Math.min(edge, last);
    for (const i of chosen) if (i >= from) out.add(i);
    for (let i = from; i < first; i++) out.add(i);
  }
  return out;
}

/** Breite der Terminspalte eines Tages in px (zusammengefasstes Wochenende: Sa bis Ende So; VQA-3-04). */
function agendaWidthOf(
  days: readonly DayBox[],
  groups: ReadonlyMap<IsoDate, readonly IsoDate[]>,
  day: DayBox,
): number {
  const dates = groups.get(day.date) ?? [day.date];
  const boxes = days.filter((d) => dates.includes(d.date));
  const last = boxes[boxes.length - 1];
  return boxes.length < 2 || last === undefined ? day.width : last.left + last.width - day.left;
}

/** Element in den sichtbaren Teil von `box` holen, ohne die Seite zu rollen (UX-AB-02, UX-AB-07). */
function revealIn(box: HTMLElement | null, element: HTMLElement | null | undefined): void {
  if (element === null || element === undefined || box === null) return;
  const a = box.getBoundingClientRect();
  const b = element.getBoundingClientRect();
  if (b.top < a.top) box.scrollTop -= a.top - b.top + 8;
  else if (b.bottom > a.bottom) box.scrollTop += b.bottom - a.bottom + 8;
  if (b.left < a.left) box.scrollLeft -= a.left - b.left + 8;
  else if (b.right > a.right) box.scrollLeft += b.right - a.right + 8;
}

/** Hinweis im Spaltenkopf eines Tages ohne Spaltensatz (UX-2-13). */
const NO_COLUMN_SET =
  'Kein Spaltensatz. Tageskopf wählen und im Seitenfeld einen Spaltensatz zuweisen.';

/**
 * Route-weite Kürzel, die auch in Eingabefeldern des Rasters wirken (UI-Richtlinie 13.2; CR-U-2-02): Ctrl+S, P, O,
 * K, L, Ctrl+. (Befundliste) und F8 / Shift+F8 (nächster bzw. vorheriger Befund; UX-2-01).
 */
function routeKey(event: KeyboardEvent<HTMLElement>): boolean {
  const ctrl = event.ctrlKey || event.metaKey;
  if (event.key === 'F8') return !ctrl && !event.altKey;
  if (!ctrl || event.altKey || event.shiftKey) return false;
  return ['s', 'p', 'o', 'k', 'l', '.'].includes(event.key.toLowerCase());
}

function readPanel(): boolean {
  try {
    return localStorage.getItem(PANEL_KEY) === 'offen';
  } catch {
    return false;
  }
}

function writePanel(open: boolean): void {
  try {
    localStorage.setItem(PANEL_KEY, open ? 'offen' : 'zu');
  } catch {
    /* Bequemlichkeit je Gerät. */
  }
}

interface MenuState {
  readonly label: string;
  readonly items: readonly MenuItem[];
  readonly x: number;
  readonly y: number;
  readonly refocus: () => void;
}

type CreateRequest =
  | { readonly kind: 'querbalken'; readonly from: IsoDate; readonly to: IsoDate }
  | {
      readonly kind: 'marker';
      readonly date: IsoDate;
      readonly at: number;
      readonly columns: ColumnSelection;
    }
  | { readonly kind: 'remark'; readonly date: IsoDate };

interface AgendaEdit {
  /** null = neue ganztägige Bemerkung. */
  readonly id: Id | null;
  readonly date: IsoDate;
  readonly value: string;
}
const FOCUS_DELAY = 800;
/** Esc gleitet in 200 ms zurück, Einschwingen 180 ms (Runde 3, Variante B; UI-Richtlinie 1.6: ≤ 200 ms). */
const SNAP_MS = 200;
const SETTLE_MS = 180;
const NO_LINES: readonly ScreenLine[] = [];
const NO_VIEWS: readonly EntryView[] = [];
const sortedOf = new WeakMap<readonly EntryView[], readonly EntryView[]>();

/** Ansichten eines Tages nach Beginn, je Liste einmal sortiert (PERF: nicht bei jedem Neuzeichnen). */
function sortedViews(list: readonly EntryView[] | undefined): readonly EntryView[] {
  if (list === undefined) return NO_VIEWS;
  let sorted = sortedOf.get(list);
  if (sorted === undefined) {
    sorted = [...list].sort((a, b) => a.from - b.from);
    sortedOf.set(list, sorted);
  }
  return sorted;
}

interface ViewSlot {
  readonly deps: readonly unknown[];
  readonly element: JSX.Element;
}

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

const stableOf = new WeakMap<
  readonly EntryView[],
  WeakMap<readonly EntryView[], readonly EntryView[]>
>();

/**
 * Reihenfolge der Elemente beim Ziehen (F-PERF, FL2-04): wie vor der Geste (`base`), Vorschauen an der Stelle ihres
 * Eintrags, neue Teilstücke danach. Sortiert nach der Vorschauzeit verschöbe React die Elemente im DOM bei jedem
 * Rasterschritt (Entfernen und Einfügen), was Tabelle und Dokument neu berechnen liess. Gezeichnet wird nach z-index,
 * die Reihenfolge ändert die Darstellung nicht.
 */
function stableViews(
  base: readonly EntryView[],
  current: readonly EntryView[] | undefined,
): readonly EntryView[] {
  if (current === undefined) return NO_VIEWS;
  if (current === base) return sortedViews(base);
  let inner = stableOf.get(base);
  if (inner === undefined) {
    inner = new WeakMap();
    stableOf.set(base, inner);
  }
  const known = inner.get(current);
  if (known !== undefined) return known;
  const byKey = new Map(current.map((v) => [v.key, v]));
  const out: EntryView[] = [];
  for (const v of sortedViews(base)) {
    const now = byKey.get(v.key);
    if (now === undefined) continue;
    out.push(now);
    byKey.delete(v.key);
  }
  out.push(...[...byKey.values()].sort((a, b) => a.from - b.from));
  inner.set(current, out);
  return out;
}

/** Zeichnet einen Wert der Rückmeldung beim Ziehen; nur diese Komponente zeichnet dann neu (PERF). */
function Feedback<T>({
  store,
  render,
}: {
  readonly store: FeedbackStore<T>;
  readonly render: (value: T) => ReactNode;
}): JSX.Element {
  return <>{render(useFeedback(store))}</>;
}

/** Zustand, den das Element einer Ansicht zeichnet (PERF: Schlüssel des Zwischenspeichers). */
interface ViewState {
  readonly key: string;
  readonly isSelected: boolean;
  readonly isDragged: boolean;
  readonly adjusting: boolean;
  readonly focused: boolean;
  readonly cut: boolean;
  readonly p1: boolean;
  /** Griffe zum Ändern der Grösse (genau ein gewählter Eintrag, keine Bearbeitung, kein Ziehen). */
  readonly handles: boolean;
  /**
   * Hervorhebung beim Ziehen (F-UX3, Runde 3 «Aufleuchten aus C»): mitgeschobener (Shift, Bernstein) bzw. angepasster
   * oder angedockter Nachbar (Blau), paralleler Block (Alt, Violett).
   */
  readonly motion: 'follow' | 'adjust' | 'parallel' | null;
  /** Plakette am Nachbarn: «+45 Min», «−30 Min», «geteilt», «Teil», «dockt an» (leer: keine). */
  readonly tag: string;
}
/**
 * Vorschaurahmen auf eigener Ebene (F-UX3): Lage nur über `transform`, damit das Einrasten auf dem Compositor gleitet
 * und keine Layout-Eigenschaft pro Bild wechselt; die Grösse ändert sich nur mit der Spanne.
 */
function ghostStyle(r: {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}): CSSProperties {
  return {
    transform: `translate3d(${String(r.left)}px, ${String(r.top)}px, 0)`,
    width: r.width,
    height: r.height,
  };
}

/** Anzeige des Ziehmodus am Zeitschild (F-UX3, bewegung-v1). */
const MODE_TEXT: Readonly<Record<ArrangeMode, string>> = {
  adjust: 'Nachbarn werden angepasst',
  shift: 'Shift: folgende Blöcke mitschieben',
  none: 'Alt: parallel, ohne Anpassung',
};
/** Höhe der Tageszeile und Mindesthöhe der Spaltenköpfe in px (I2b-A A5). */
const DAY_LABEL_HEIGHT = 20;
/** Befund am Spaltensatz (E1-02l R1, R-10-54): Ursache und nächster Schritt. */
const TOO_MANY_COLUMNS =
  'Zu viele Spalten für diesen Tag: Nicht alle Spaltenköpfe passen in ihre Spalte. Spalten schmaler stellen, zusammenfassen oder auf einen anderen Spaltensatz wechseln.';

function messageOf(error: unknown): string {
  if (typeof error === 'object' && error !== null && 'userMessage' in error) {
    const message = error.userMessage as { cause?: unknown; nextStep?: unknown };
    if (typeof message.cause === 'string' && typeof message.nextStep === 'string') {
      return `${message.cause} ${message.nextStep}`;
    }
  }
  return 'Die Änderung konnte nicht gespeichert werden. Eingaben prüfen und erneut übernehmen.';
}

/** Sichtbar machen (Zellzeiger bleibt beim Bewegen im Blick); ohne scrollIntoView (z.B. jsdom) nichts. */
function reveal(node: HTMLElement): void {
  if (typeof node.scrollIntoView === 'function')
    node.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function reducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

function readZoom(planId: Id): ZoomSetting {
  try {
    const raw = localStorage.getItem(`wap-planer:zoom:${planId}`);
    if (raw === 'fit') return { kind: 'fit' };
    const value = Number(raw);
    if (raw !== null && Number.isFinite(value) && value >= 0.25 && value <= 4)
      return { kind: 'level', value };
  } catch {
    /* Zoom ist eine Bequemlichkeit je Gerät. */
  }
  return { kind: 'level', value: 1 };
}

function writeZoom(planId: Id, zoom: ZoomSetting): void {
  try {
    localStorage.setItem(
      `wap-planer:zoom:${planId}`,
      zoom.kind === 'fit' ? 'fit' : String(zoom.value),
    );
  } catch {
    /* Zoom ist eine Bequemlichkeit je Gerät. */
  }
}

function shiftTime(t: TimeSpec, d: number): TimeSpec {
  switch (t.form) {
    case 'point':
      return { form: 'point', at: t.at + d };
    case 'range':
      return { form: 'range', from: t.from + d, to: t.to + d };
    case 'from':
      return { form: 'from', from: t.from + d };
    case 'until':
      return { form: 'until', to: t.to + d };
    case 'deadline':
      return t.to === undefined ? t : { form: 'deadline', to: t.to + d };
  }
}

function blockValues(plan: Plan, b: Block): EditValues {
  const bold = boldTextOf(resolveTitle(plan, b.title));
  return { title: bold.text, mask: bold.mask, supplement: b.supplement, ltg: b.ltg, ort: b.ort };
}

/** Beso-Titel mit Fett-Maske für die Direktbearbeitung (CR-H-U-06). */
function besoValues(plan: Plan, b: Beso): EditValues {
  const bold = boldTextOf(resolveTitle(plan, b.title));
  return { ...EMPTY_VALUES, title: bold.text, mask: bold.mask };
}

function sameMask(a: readonly boolean[], b: readonly boolean[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

function entryTitle(plan: Plan, e: Entry): string {
  switch (e.type) {
    case 'block':
    case 'beso':
    case 'querbalken':
      return plainTitle(plan, e.title);
    case 'rapport':
      return e.code;
    case 'marker':
      return e.kind === 'custom' ? e.customKind : e.kind;
    default:
      return e.text;
  }
}

function typeName(e: Entry): string {
  return {
    block: 'Block',
    rapport: 'Rapport',
    beso: 'Beso',
    marker: 'Marker',
    querbalken: 'Querbalken',
    dayRemark: 'Bemerkung',
    multiDayRemark: 'Bemerkung',
  }[e.type];
}

export function I2GridEditor({
  plan,
  weekId,
  onCommand,
  readOnly,
  toolbarItems,
  commands,
  onToast,
  focusRequest,
  cursorMemory,
  findingMarks,
  aside,
}: I2GridEditorProps): JSX.Element {
  const week = plan.weeks.find((candidate) => candidate.id === weekId);
  const template = useMemo((): LevelTemplate => {
    try {
      return templateById(plan.templateId, builtInTemplates());
    } catch {
      return kpTemplate();
    }
  }, [plan.templateId]);
  /** Linien der Vorlage (Stärken und Strichmuster wie im PDF, F-UX2 P3). */
  const lineStyles = useMemo(() => pageGeometryFor(template.pageGeometryId).lines, [template]);
  const [zoom, setZoomState] = useState<ZoomSetting>(() => readZoom(plan.id));
  const [available, setAvailable] = useState({ width: 1200, height: 600 });
  const [weightPreview, setWeightPreview] = useState<{
    date: IsoDate;
    columnId: Id;
    weight: ColumnWeight;
  } | null>(null);
  const range = plan.displayRange.to - plan.displayRange.from;
  const dayInputs = useMemo(() => {
    if (week === undefined) return [];
    return week.days.map((config, index) => {
      const date = addDays(week.startDate, index);
      const set = plan.columnSets.find((s) => s.id === config.columnSetId);
      const columns = (set?.columns ?? []).map(
        (c): Column =>
          weightPreview !== null && weightPreview.date === date && weightPreview.columnId === c.id
            ? { ...c, weight: weightPreview.weight }
            : c,
      );
      return {
        date,
        weekday: config.weekday,
        display: config.display,
        setId: set?.id ?? null,
        columns,
      };
    });
  }, [plan.columnSets, week, weightPreview]);
  // Terminbereich unter dem Raster (Beschrieb 4.8; I3 C2): Höhe nach der längsten Terminliste der Woche.
  // Terminzeilen je Tag einmal je Planstand (PERF: nicht bei jedem Neuzeichnen, etwa beim Ziehen).
  // Höhe des Terminbereichs: Textfläche der Termine der Wochenseite in pt, in der Zoomstufe (CR-H-U-04). Eine Zahl,
  // damit Einpassen und Massstab bei Änderungen des Plans stabil bleiben (PERF).
  const agendaAvail = useMemo(() => {
    if (week === undefined) return 0;
    try {
      return agendaAvailPt(plan, week.id, template);
    } catch {
      return 0;
    }
  }, [plan, week, template]);
  // Bildschirm = PDF (F-UX2 P1; CR-H-U-02/-03): Raster, Spaltenköpfe und Termine im Rahmen der PDF-Seite, nur mit
  // einem Faktor (px je pt) skaliert. Zoom und Einpassen ändern nur den Faktor, nie die Umbrüche.
  const basis = useMemo((): PageBasis => {
    const displays = dayInputs.map((d) => d.display);
    try {
      if (week === undefined) throw new RangeError('Woche fehlt');
      const frame = pageFrame(pageGeometryFor(template.pageGeometryId), plan, week.id, template);
      return pageBasis(frame.grid, displays, range);
    } catch {
      return pageBasis(
        {
          rect: { w: 700, h: 420 },
          timeAxisWidthPt: 0,
          dayHeaderHeightPt: 0,
          columnHeaderHeightPt: 14,
        },
        displays,
        range,
      );
    }
  }, [dayInputs, plan, week, template, range]);
  // Termine wie auf der Wochenseite: Lücke, Termine-Oberlinie und «Was»-Zeile über der Textfläche (VQA-2-02).
  const agendaLeadPt = useMemo(() => {
    if (week === undefined) return 0;
    try {
      const geometry = pageGeometryFor(template.pageGeometryId);
      const frame = pageFrame(geometry, plan, week.id, template);
      return Math.max(
        0,
        agendaTextArea(geometry, frame, 0).top - (frame.grid.rect.y + frame.grid.rect.h),
      );
    } catch {
      return 0;
    }
  }, [plan, week, template]);
  const factor = pageFactor(
    zoom,
    basis,
    available,
    DAY_LABEL_HEIGHT + 1 + AGENDA_BORDER + 2,
    agendaAvail + agendaLeadPt,
  );
  // Stabil je Zoom und Platz: sonst würden Tage, Köpfe und Ansichten bei jedem Neuzeichnen neu berechnet (E1-02l).
  const scale: Scale = useMemo(() => pageScaleOf(basis, factor), [basis, factor]);
  const agendaHeight =
    Math.round((agendaAvail + agendaLeadPt) * screenFactor(scale)) + AGENDA_BORDER;
  // Wochenseite wie im PDF (`layoutWeekPage`): Spaltenköpfe und «Was»-Zeilen aus derselben Layout-Ausgabe
  // (VQA-2-01/-02). Einmal je Planstand und Woche (nicht beim Ziehen).
  const weekPage = useMemo(() => {
    if (week === undefined) return null;
    try {
      return layoutWeekPage(plan, week.id, {
        paper: 'A4',
        showStatus: true,
        templates: builtInTemplates(),
      });
    } catch {
      return null;
    }
  }, [plan, week]);
  /**
   * Terminspalten wie auf der Wochenseite (VQA-3-04): Spalte → ihre Tage; beim zusammengefassten Wochenende zeigt
   * der Sa auch die Termine des So, der So keine eigenen. Ohne Seitenlayout je Tag eine Spalte.
   */
  const agendaGroups = useMemo(() => {
    const map = new Map<IsoDate, readonly IsoDate[]>();
    if (week === undefined) return map;
    const columns =
      weekPage === null
        ? null
        : (() => {
            try {
              return pageAgendaColumns(weekPage, plan, week, template);
            } catch {
              return null;
            }
          })();
    for (let i = 0; i < 7; i++) map.set(addDays(week.startDate, i), [addDays(week.startDate, i)]);
    for (const dates of columns ?? []) {
      const [host, ...rest] = dates;
      if (host === undefined || rest.length === 0) continue;
      map.set(host, dates);
      for (const d of rest) map.set(d, []);
    }
    return map;
  }, [plan, week, weekPage, template]);
  /** Spalte, in der die Termine eines Tages stehen (So beim zusammengefassten Wochenende: Sa). */
  const agendaHost = useCallback(
    (date: IsoDate): IsoDate => {
      if ((agendaGroups.get(date) ?? [date]).length > 0) return date;
      for (const [host, dates] of agendaGroups) if (dates.includes(date)) return host;
      return date;
    },
    [agendaGroups],
  );
  const agendaLines = useMemo(() => {
    const map = new Map<IsoDate, ReturnType<typeof agendaLinesForDate>>();
    if (week === undefined) return map;
    for (let i = 0; i < 7; i++) {
      const date = addDays(week.startDate, i);
      map.set(
        date,
        (agendaGroups.get(date) ?? [date]).flatMap((d) => agendaLinesForDate(plan, d)),
      );
    }
    return map;
  }, [plan, week, agendaGroups]);
  const agendaFrame = useMemo(
    () => (weekPage === null ? null : pageAgendaFrame(weekPage, template, scale)),
    [weekPage, template, scale],
  );
  const days = useMemo(() => dayBoxes(dayInputs, scale), [dayInputs, scale]);
  // Terminzeilen am Bildschirm aus der Layout-Schicht je Tag, einmal je Planstand und Massstab (CR-H-U-04, PERF).
  const agendaLayouts = useMemo(() => {
    const map = new Map<IsoDate, ScreenAgenda>();
    for (const day of days) {
      const dates = agendaGroups.get(day.date) ?? [day.date];
      if (dates.length === 0) continue;
      map.set(
        day.date,
        screenAgenda({
          plan,
          date: day.date,
          dates,
          widthPx: agendaWidthOf(days, agendaGroups, day),
          availPt: agendaAvail,
          scale,
          template,
        }),
      );
    }
    return map;
  }, [plan, days, agendaAvail, scale, template, agendaGroups]);
  const agendaWidth = (day: DayBox): number => agendaWidthOf(days, agendaGroups, day);
  const gridHeight = range * scale.minute;

  // Mehrfachauswahl (B2): der letzte Eintrag ist der fokussierte («primäre») Eintrag.
  const [selection, setSelection] = useState<readonly Selection[]>([]);
  const selected = selection[selection.length - 1] ?? null;
  const setSelected = useCallback((next: Selection | null) => {
    setSelection(next === null ? [] : [next]);
  }, []);
  const selectedIds = useMemo(() => new Set(selection.map((s) => s.id)), [selection]);
  /** Schlüssel der Auswahl: ID (alle Zeitfenster) bzw. ID:Zeitfenster. */
  const selectedKeys = useMemo(
    () => new Set(selection.map((s) => (s.windowId === null ? s.id : `${s.id}:${s.windowId}`))),
    [selection],
  );
  const [cursor, setCursorState] = useState<Cursor | null>(null);
  const [anchor, setAnchor] = useState<Cursor | null>(null);
  const [focusKey, setFocusKey] = useState<string>('cursor');
  const [goTo, setGoTo] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState<string | null>(null);
  const categoryByKeyboard = useRef(false);
  const [otherDays, setOtherDays] = useState<Id | null>(null);
  const [cutIds, setCutIds] = useState<ReadonlySet<Id>>(() => {
    const c = clipboard.get();
    return new Set(c?.cut && c.planId === plan.id ? c.ids : []);
  });
  const [editing, setEditing] = useState<Editing | null>(null);
  /** Schritte zum Rückgängigmachen innerhalb einer Direktbearbeitung (F-UX2 P2). */
  const editHistory = useRef<{ past: EditValues[]; future: EditValues[]; last: string | null }>({
    past: [],
    future: [],
    last: null,
  });
  /** Stand vor dem getippten Startzeichen einer Bearbeitung (erster Rückgängig-Schritt; UX-2-10). */
  const editSeed = useRef<EditValues | null>(null);
  /** Feld und Markierung der Direktbearbeitung im Block (F-UX2 P2). */
  const [inlineSel, setInlineSel] = useState<{
    readonly field: EditField;
    readonly start: number;
    readonly end: number;
  } | null>(null);
  const [editError, setEditError] = useState('');
  /** Feld der Direktbearbeitung mit dem Fehler (rot, Fokus; UI-Richtlinie 5.4, CR-H-U-05). */
  const [editErrorField, setEditErrorField] = useState<EditField | null>(null);
  const [form, setForm] = useState<BlockForm | null>(null);
  const [error, setError] = useState('');
  const errorId = useId();
  const hintId = useId();
  /** Stand des Ziehens für das Raster: neu nur bei Beginn, Ende und geänderter Vorschau der Nachbarn (PERF). */
  const [drag, setDrag] = useState<DragView | null>(null);
  /** Ziel und Zeiten beim Ziehen, bei jeder Lageänderung (Vorschaurahmen, Zeitschild). */
  const [dragFeedback] = useState(() => createFeedbackStore<DragView | null>(null));
  /**
   * Zustand der Zusatztasten während einer Geste (F-UX3): ein Ereignis je Drücken/Loslassen von Shift, Alt, Ctrl.
   * Abonnenten (Zeitschild `data-mode`, spätere Hervorhebung nach dem gewählten Prototyp) zeichnen sich selbst.
   */
  const [modifierStore] = useState(() =>
    createFeedbackStore<{ shift: boolean; alt: boolean; ctrl: boolean }>({
      shift: false,
      alt: false,
      ctrl: false,
    }),
  );
  useEffect(
    () =>
      modifierStore.subscribe(() => {
        const m = modifierStore.get();
        const node = statusRef.current;
        if (node !== null) node.dataset.mode = m.alt ? 'none' : m.shift ? 'shift' : 'adjust';
      }),
    [modifierStore],
  );
  /**
   * Modusfarbe nur an den Marken (Runde 3, Befund Designer): angehobener Block, gegriffener Griff und Rahmen um das
   * Raster (Shift Bernstein, Alt Violett) – nie am ganzen Baum, sonst würden alle Elemente neu berechnet.
   */
  useEffect(
    () =>
      dragFeedback.subscribe(() => {
        const d = dragFeedback.get();
        const mode =
          d === null || (d.entryKind !== 'block' && d.entryKind !== 'create') ? null : d.mode;
        const marks = [scrollRef.current, liftRef.current, ...gripRefs.current.values()];
        for (const m of marks) {
          if (m === null) continue;
          const value = d === null ? '' : (mode ?? 'adjust');
          if ((m.dataset.mode ?? '') !== value) {
            if (value === '') delete m.dataset.mode;
            else m.dataset.mode = value;
          }
        }
      }),
    [dragFeedback],
  );
  const [status, setStatus] = useState('');
  /**
   * Detail beim Überfahren (A5) in einem eigenen Speicher (Runde 3, Leistung beim Überfahren): Ein- und Ausblenden
   * zeichnet nur die Karte neu, nicht das ganze Raster (vorher eine Aufgabe > 50 ms bei gedrosselter CPU).
   */
  const [hoverCardStore] = useState(() =>
    createFeedbackStore<{ id: Id; windowId: Id | null; rect: DOMRect } | null>(null),
  );
  const setHover = (value: { id: Id; windowId: Id | null; rect: DOMRect } | null): void =>
    hoverCardStore.set(value);
  const [colEdit, setColEdit] = useState<ColumnEdit | null>(null);
  const [scopeQuestion, setScopeQuestion] = useState<ScopeQuestion | null>(null);
  const [pendingFocus, setPendingFocus] = useState<string | null>(null);
  // Seitenfeld (I3 C1): ein- und ausblendbar, Zustand je Gerät; Fokusauftrag mit Feld.
  const [panelOpen, setPanelOpenState] = useState(readPanel);
  const [panelFocus, setPanelFocus] = useState<{ seq: number; field: string | null }>({
    seq: 0,
    field: null,
  });
  const [panelError, setPanelError] = useState('');
  /** Touch (UX-H-02): wartender Langdruck (Abbruch), Geste aus dem Langdruck, Aufruf aus dem Langdruck. */
  const touchPending = useRef<(() => void) | null>(null);
  const touchDrag = useRef(false);
  const touchGated = useRef(false);
  /** Gewählte Tage (Klick auf den Tageskopf; UI-Richtlinie 5.1, 5.9). */
  const [daySelection, setDaySelection] = useState<readonly IsoDate[]>([]);
  /** Anker der Tagesauswahl: Shift-Klick und Shift+←/→ bilden den Bereich ab hier (H-UI2, UX-H-06). */
  const dayAnchor = useRef<IsoDate | null>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [creating, setCreating] = useState<CreateRequest | null>(null);
  const [renumberDate, setRenumberDate] = useState<IsoDate | null>(null);
  const [agendaEdit, setAgendaEdit] = useState<AgendaEdit | null>(null);
  // Terminbereich als Tab-Stopp, sobald er nach der tatsächlichen Höhe rollt (H-UI2, SA-H-07; axe
  // scrollable-region-focusable). Gemessen nur, wenn sich Inhalt, Höhe oder Zoom ändern (nicht beim Ziehen, PERF).
  // biome-ignore lint/correctness/useExhaustiveDependencies: Messung im DOM nach Änderung von Inhalt, Höhe oder Zoom
  useLayoutEffect(() => {
    for (const td of scrollRef.current?.querySelectorAll<HTMLElement>('td[data-agenda-cell]') ??
      []) {
      const rolls = td.scrollHeight > td.clientHeight + 0.5;
      if (rolls && td.tabIndex !== 0) td.tabIndex = 0;
      else if (!rolls && td.hasAttribute('tabindex')) td.removeAttribute('tabindex');
    }
  }, [agendaHeight, agendaLayouts, agendaEdit, days, scale]);
  const agendaButtons = useRef(new Map<string, HTMLButtonElement>());

  const live = useRef<Live | null>(null);
  const draggedClick = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const liftRef = useRef<HTMLDivElement>(null);
  /** Letzte Zeigerlage über dem Raster (Hervorhebung nach Änderungen neu berechnen, CR-U-2-07). */
  const lastHover = useRef<{ x: number; y: number } | null>(null);
  /** Zone beim ersten Drücken (Doppelklick wertet sie, CR-U-2-04). */
  const firstPress = useRef<{
    key: string;
    zone: Zone;
    at: number;
    x: number;
    y: number;
  } | null>(null);
  /** Hervorhebung des Eintrags unter dem Zeiger (F-UX2 P4) und sein Schlüssel. */
  const hoverRef = useRef<HTMLDivElement>(null);
  const hoverKey = useRef<string | null>(null);
  /** Zuletzt gezeichnete Lage der Hervorhebung: Stil nur bei Änderung schreiben (F-UX3). */
  const hoverPainted = useRef<string>('');
  /**
   * Lage von Raster und Tagen für das Überfahren (F-UX3): einmal gelesen und verworfen bei Rollen, Grössen- und
   * Ansichtsänderung bzw. beim Verlassen des Tags – keine Layoutabfrage je Mausbewegung.
   */
  const hoverGeo = useRef<{ wrapper: DOMRect; bodies: Map<string, DOMRect> } | null>(null);
  /** Letzte Zeigerlage über einem Tag; ausgewertet einmal je Bild (requestAnimationFrame). */
  const hoverAt = useRef<{
    day: DayBox;
    body: HTMLElement;
    x: number;
    y: number;
    editor: boolean;
  } | null>(null);
  const hoverFrame = useRef<number | null>(null);
  /** Griffe am überfahrenen Eintrag (Runde 3, 5a) und Zeitgeber für das Ausblenden des angehobenen Blocks. */
  const gripRefs = useRef(new Map<GripZone, HTMLDivElement>());
  const liftTimer = useRef<number | undefined>(undefined);
  /** Flächen der Ansichten im letzten Bild (Gleiten der Nachbarn beim Ziehen und nach Esc, FLIP ohne DOM-Lesen). */
  const lastRects = useRef(new Map<string, Rect>());
  const flipNext = useRef(false);
  /**
   * Moduswechsel (Shift/Alt, Runde 4): die neue Vorschau gilt im selben Bild – Nachbarn und angehobener Block springen
   * (kein Gleiten), Plakette ohne Einblenden.
   */
  const modeJump = useRef(false);
  /** Einträge mit laufendem Gleiten (FLIP); nach dem Loslassen sofort an der Endlage (Bildschirm = PDF). */
  const flipActive = useRef(new Set<HTMLElement>());
  /** Während des laufenden Bilds kam eine weitere Zeigerlage (wird am Bildbeginn ausgewertet). */
  const hoverPending = useRef(false);
  /**
   * Griffe gelten nur, wenn der Zeiger den Eintrag selbst überfahren hat (nicht nach einer Planänderung unter dem
   * ruhenden Zeiger, z.B. ein eben aufgezogener Block): sonst träfe ein Drücken knapp unter ihm seinen Griff.
   */
  const hoverByPointer = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLFieldSetElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const entryButtons = useRef(new Map<string, HTMLButtonElement>());
  /**
   * Zustand «Zeiger über» je Eintrag mit Zone (F-UX3): ein Ereignis je Wechsel von Eintrag oder Zone, nie je
   * Mausbewegung. Abonnenten: `data-hover` (Zone) am Eintrag und das Ereignis `i2-hover` am Raster – Haken für die
   * Griff-Elemente der gewählten Prototyp-Variante.
   */
  const [hoverStore] = useState(() => createFeedbackStore<HoverZone | null>(null));
  useEffect(() => {
    let marked: HTMLElement | null = null;
    return hoverStore.subscribe(() => {
      const h = hoverStore.get();
      if (marked !== null) {
        delete marked.dataset.hover;
        marked = null;
      }
      const entry = h === null ? null : (entryButtons.current.get(h.key)?.parentElement ?? null);
      if (h !== null && entry !== null) {
        entry.dataset.hover = h.zone;
        marked = entry;
      }
      // Griffe des überfahrenen Eintrags (Runde 3, 5a): an die Kanten setzen, einblenden; die Kante unter dem Zeiger
      // gefüllt. Während einer Geste führt sie paintLift.
      if (live.current?.started !== true) {
        const grips = h === null ? [] : gripsOf({ kind: h.kind, rect: h.rect } as EntryView);
        for (const z of GRIP_ZONES) {
          const el = gripRefs.current.get(z);
          if (el === undefined) continue;
          const g = grips.find((x) => x.zone === z);
          if (g === undefined) {
            el.classList.remove('is-on', 'is-hot', 'is-grab');
            continue;
          }
          placeGrip(el, g);
          el.classList.add('is-on');
          el.classList.toggle('is-hot', h?.kind === 'marker' ? z === 'marker' : h?.zone === z);
        }
      }
      wrapperRef.current?.dispatchEvent(
        new CustomEvent<HoverZone | null>(HOVER_EVENT, { detail: h }),
      );
    });
  }, [hoverStore]);
  const emptyButtons = useRef(new Map<string, HTMLButtonElement>());
  const newBlockRef = useRef<HTMLButtonElement>(null);
  const newEntryRef = useRef<HTMLButtonElement>(null);
  const statusIdBase = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const formTitleRef = useRef<HTMLInputElement>(null);
  const hoverTimer = useRef<number | undefined>(undefined);
  const colEditDone = useRef(false);
  const autoscroll = useRef<number | undefined>(undefined);
  const cursorRef = useRef<HTMLButtonElement>(null);
  const scrollCursor = useRef(false);
  const categoryRef = useRef<HTMLSelectElement>(null);
  /** Fokus per Ctrl-Klick bzw. Ctrl+Pfeil: die Mehrfachauswahl bleibt (onFocus setzt sonst nur diesen Eintrag). */
  const keepSelection = useRef(false);
  /** Letzte Lage des Mauszeigers über dem Raster (Einfügen am Mauszeiger, B3). */
  const lastPointer = useRef<{ x: number; y: number; at: number } | null>(null);
  const lastKeyboardMove = useRef(0);
  /** Alt beim Ziehen: das folgende Loslassen von Alt darf nicht ins Edge-Menü springen (UI-Richtlinie 19 K-5). */
  const swallowAlt = useRef(false);
  const disabled = readOnly;

  const openColumnEdit = (date: IsoDate, column: Column, scope?: ColumnScope) => {
    if (disabled) return;
    colEditDone.current = false;
    setColEdit({
      date,
      columnId: column.id,
      value: column.name,
      ...(scope === undefined ? {} : { scope }),
    });
  };
  const setZoom = (next: ZoomSetting) => {
    setZoomState(next);
    writeZoom(plan.id, next);
  };

  // Verfügbarer Platz für «Einpassen» (A5): das Raster ohne Kopf und Zeitachse.
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node === null) return;
    // Ganze Höhe der Arbeitsfläche: Spaltenköpfe und Termine wachsen mit dem Faktor (pageFactor rechnet sie ein).
    const measure = () => {
      setAvailable({
        width: Math.max(200, node.clientWidth - AXIS_WIDTH - 2),
        height: Math.max(150, node.clientHeight - 2),
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Ctrl+Mausrad über dem Papier zoomt um den Mauszeiger (UI-Richtlinie 4.1; H-UI2, SA-H-22). Der Browser-Zoom bleibt
  // ausserhalb des Rasters. Eigener Listener, weil React Mausrad-Ereignisse passiv anmeldet.
  const wheelZoom = useRef<{
    zoom: ZoomSetting;
    scale: Scale;
    set: (z: ZoomSetting) => void;
  } | null>(null);
  wheelZoom.current = { zoom, scale, set: setZoom };
  const zoomAnchor = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
    day: number;
    minute: number;
  } | null>(null);
  useEffect(() => {
    const node = scrollRef.current;
    if (node === null) return;
    const wheel = (event: WheelEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.deltaY === 0) return;
      const z = wheelZoom.current;
      if (z === null) return;
      event.preventDefault();
      const box = node.getBoundingClientRect();
      zoomAnchor.current = {
        x: event.clientX - box.left,
        y: event.clientY - box.top,
        left: node.scrollLeft,
        top: node.scrollTop,
        day: z.scale.day,
        minute: z.scale.minute,
      };
      z.set(nextZoom(z.zoom, z.scale, event.deltaY < 0 ? 1 : -1));
    };
    node.addEventListener('wheel', wheel, { passive: false });
    return () => node.removeEventListener('wheel', wheel);
  }, []);
  // Nach dem Zoomen per Mausrad bleibt die Stelle unter dem Zeiger stehen.
  useLayoutEffect(() => {
    const a = zoomAnchor.current;
    const node = scrollRef.current;
    if (a === null || node === null) return;
    zoomAnchor.current = null;
    const fx = a.day > 0 ? scale.day / a.day : 1;
    const fy = a.minute > 0 ? scale.minute / a.minute : 1;
    node.scrollLeft = Math.max(0, (a.left + a.x) * fx - a.x);
    node.scrollTop = Math.max(0, (a.top + a.y) * fy - a.y);
  }, [scale]);

  const entriesInWeek = useMemo((): readonly Entry[] => {
    if (week === undefined) return [];
    const last = addDays(week.startDate, 6);
    return Object.values(plan.entries).filter((e) => {
      if (e.type === 'querbalken')
        return daysBetween(e.fromDate, last) >= 0 && daysBetween(week.startDate, e.toDate) >= 0;
      return (
        'date' in e && daysBetween(week.startDate, e.date) >= 0 && daysBetween(e.date, last) >= 0
      );
    });
  }, [plan.entries, week]);

  // Vorschau der Nachbarn (A7): angepasste Zeiten und Teilstücke, ohne den gezogenen Block selbst.
  const previewIds = useMemo(() => {
    const ids = new Set<Id>();
    for (const c of drag?.arrangement?.changes ?? []) ids.add(c.id);
    for (const x of drag?.arrangement?.shifts ?? []) ids.add(x.id);
    return ids;
  }, [drag]);
  /**
   * Nachbarn der Vorschau nach Kennung (F-PERF, FL2-04): je Ansicht ein Nachschlagen statt einer Suche in allen
   * Änderungen (bei 1000 Einträgen und vielen verdrängten Nachbarn je Neuzeichnen sonst Ansichten × Änderungen).
   */
  const neighbourIndex = useMemo(() => {
    const a = drag?.arrangement;
    return {
      changes: new Map((a?.changes ?? []).map((c) => [c.id, c])),
      shifts: a?.shifts ?? [],
      shiftIds: new Set((a?.shifts ?? []).map((x) => x.id)),
      splitIds: new Set((a?.splits ?? []).map((x) => x.sourceId)),
    };
  }, [drag]);
  /** Tage mit Vorschau: Tag der angepassten Nachbarn und der Teilstücke (PERF). */
  const previewDates = useMemo(() => {
    const dates = new Set<IsoDate>();
    const a = drag?.arrangement;
    for (const id of [
      ...(a?.changes ?? []).map((c) => c.id),
      ...(a?.splits ?? []).map((s) => s.sourceId),
      ...(a?.shifts ?? []).map((x) => x.id),
    ]) {
      const e = plan.entries[id];
      if (e !== undefined && 'date' in e) dates.add(e.date);
    }
    return dates;
  }, [drag, plan.entries]);
  /**
   * Tage, deren Einträge die Geste zeichnet (F-PERF): Vorschau, Tag des gezogenen Eintrags und des angedockten
   * Nachbarn. `null` = alle Tage (Eintrag ohne einzelnen Tag, z.B. Querbalken). Die übrigen Tage zeichnen sich beim
   * Ziehen nicht neu.
   */
  const dragDates = useMemo((): ReadonlySet<IsoDate> | null => {
    if (drag === null) return new Set();
    const dates = new Set(previewDates);
    for (const id of [drag.entryId, drag.arrangement?.dock ?? null]) {
      if (id === null) continue;
      const e = plan.entries[id];
      if (e === undefined) continue;
      if (!('date' in e)) return null;
      dates.add(e.date);
    }
    return dates;
  }, [drag, previewDates, plan.entries]);
  const displayEntries = useMemo((): readonly Entry[] => {
    const a = drag?.arrangement;
    const shifts = a?.shifts ?? [];
    if (!a || (a.changes.length === 0 && a.splits.length === 0 && shifts.length === 0))
      return entriesInWeek;
    const changed = new Map(a.changes.map((c) => [c.id, c]));
    // Nach Kennung (F-PERF): sonst je Eintrag der Woche eine Suche in allen Verschiebungen.
    const shiftsOf = new Map<Id, (typeof shifts)[number][]>();
    for (const x of shifts) shiftsOf.set(x.id, [...(shiftsOf.get(x.id) ?? []), x]);
    const out: Entry[] = entriesInWeek.map((e) => {
      const c = changed.get(e.id);
      if (c !== undefined && e.type === 'block')
        return { ...e, time: { form: 'range', from: c.from, to: c.to } };
      // Mitrückende Rapporte und Beso-Zeitfenster (Runde 4) in der Vorschau.
      const own = shiftsOf.get(e.id) ?? [];
      if (own.length === 0) return e;
      if (e.type === 'rapport')
        return { ...e, time: shiftTime(e.time, own[0]?.delta ?? 0) as Rapport['time'] };
      if (e.type === 'beso')
        return {
          ...e,
          windows: e.windows.map((w) => {
            const x = own.find((y) => y.windowId === w.id);
            return x === undefined ? w : { ...w, time: shiftTime(w.time, x.delta) };
          }),
        };
      return e;
    });
    a.splits.forEach((s, i) => {
      const source = plan.entries[s.sourceId];
      if (source?.type === 'block')
        out.push({
          ...source,
          id: `${s.sourceId}~${i}`,
          time: { form: 'range', from: s.from, to: s.to },
        });
    });
    return out;
  }, [drag, entriesInWeek, plan.entries]);
  // Direktbearbeitung im Block (F-UX2 P2): der bearbeitete Eintrag mit den getippten Werten, gelegt von der
  // Layout-Schicht wie im PDF (der Browser bricht nie selbst um). Ein neuer Eintrag erscheint als Vorschau «<ID>~edit».
  const editPreview = useMemo((): {
    readonly entries: readonly Entry[];
    readonly id: Id;
  } | null => {
    if (editing === null) return null;
    const v = editing.values;
    const title = richOf({ text: v.title, mask: v.mask });
    if (editing.kind === 'block') {
      const e = plan.entries[editing.id];
      if (e === undefined) return null;
      const next: Entry | null =
        e.type === 'block'
          ? { ...e, title, supplement: v.supplement, ltg: v.ltg, ort: v.ort }
          : e.type === 'rapport'
            ? { ...e, code: v.title }
            : e.type === 'beso'
              ? { ...e, title }
              : null;
      if (next === null) return null;
      return { entries: entriesInWeek.map((x) => (x.id === e.id ? next : x)), id: e.id };
    }
    const pl = editing.placement;
    try {
      const ctx = { templates: builtInTemplates() };
      const r =
        editing.entryType === 'rapport'
          ? createEntry(
              plan,
              {
                type: 'rapport',
                date: pl.date,
                code: v.title,
                time: { form: 'range', from: pl.from, to: pl.to },
              },
              ctx,
            )
          : editing.entryType === 'beso'
            ? createEntry(
                plan,
                {
                  type: 'beso',
                  date: pl.date,
                  title,
                  windows: [{ time: { form: 'range', from: pl.from, to: pl.to } }],
                },
                ctx,
              )
            : createEntry(
                plan,
                {
                  type: 'block',
                  date: pl.date,
                  time: { form: 'range', from: pl.from, to: pl.to },
                  columns: pl.columns,
                  title,
                  supplement: v.supplement,
                  ltg: v.ltg,
                  ort: v.ort,
                },
                ctx,
              );
      const made = r.plan.entries[r.entryId];
      if (made === undefined) return null;
      const id = `${r.entryId}~edit`;
      return { entries: [...entriesInWeek, { ...made, id } as Entry], id };
    } catch {
      // Unvollständige Eingabe (z.B. leeres Kürzel): nur der Rahmen der Bearbeitung.
      return null;
    }
  }, [editing, entriesInWeek, plan]);
  const layoutEntries = editPreview?.entries ?? entriesInWeek;
  // Querbalken ändern sich beim Ziehen nicht (die Vorschau betrifft nur Blöcke): Bahnen aus dem Planstand.
  const lanes = useMemo(
    () => querbalkenLanes(entriesInWeek.filter((e) => e.type === 'querbalken')),
    [entriesInWeek],
  );
  // E1-02l: Lage, Flächen und Texte aus der gemeinsamen Layout-Schicht (wie im PDF). Ansichten nur für Tage mit
  // geändertem Layout (PERF, R-5.1-14: nach einer Änderung nur die betroffenen Tage).
  const laidViews = useMemo(() => {
    const laid = layoutViews({
      plan,
      weekId,
      days,
      entries: layoutEntries,
      scale,
      template,
      viewsOf: (day) => dayViews(plan, day, layoutEntries, scale, template, lanes),
    });
    // Während der Bearbeitung behält der Eintrag seinen Namen (Bedienung über Rolle und Name); nur die Zeichnung
    // folgt der Eingabe. Ausserhalb des Zwischenspeichers, der nach Inhalt teilt (F-UX2 P2).
    const id = editPreview?.id;
    if (id === undefined || id.includes('~')) return laid;
    const out = new Map(laid);
    for (const day of days) {
      const list = laid.get(day.date);
      if (list === undefined || !list.some((v) => v.id === id)) continue;
      const base = dayViews(plan, day, entriesInWeek, scale, template, lanes);
      out.set(
        day.date,
        list.map((v) =>
          v.id === id ? { ...v, label: base.find((x) => x.key === v.key)?.label ?? v.label } : v,
        ),
      );
    }
    return out;
  }, [days, layoutEntries, entriesInWeek, editPreview, plan, weekId, scale, template, lanes]);
  // Beim Ziehen (PERF, R-5.1-14): nur die Vorschau wird neu berechnet, das volle Layout erst nach dem Loslassen.
  const views = useMemo(
    () =>
      withPreview(
        laidViews,
        days,
        (day) => dayViews(plan, day, displayEntries, scale, template, lanes),
        previewIds,
        previewDates,
      ),
    [laidViews, days, displayEntries, plan, scale, template, lanes, previewIds, previewDates],
  );

  /**
   * Nachbarn gleiten (Runde 3, Variante B: 180 ms `cubic-bezier(.2,.8,.2,1)`; Esc 200 ms) an die Vorschaulage bzw.
   * zurück: FLIP aus den Flächen der Ansichten (alt aus dem letzten Bild, neu gezeichnet), Versatz als transform setzen
   * und über zwei Bilder auf 0 laufen lassen – ohne Layout-Lesung und ohne erzwungenen Reflow. Nur während einer Geste
   * und direkt nach Esc; Zoom, Wochenwechsel und Loslassen springen (die Endlage steht sofort, Bildschirm = PDF).
   */
  const flipScale = useRef(scale);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur bei neu gelegten Ansichten (Geste und Massstab aus diesem Bild)
  useLayoutEffect(() => {
    const prev = lastRects.current;
    const next = new Map<string, Rect>();
    const count = new Map<string, number>();
    for (const list of views.values())
      for (const v of list) {
        if (v.kind !== 'block' || v.id.includes('~')) continue;
        const k = itemKey(v);
        next.set(k, v.rect);
        count.set(k, (count.get(k) ?? 0) + 1);
      }
    const glide =
      (drag !== null || flipNext.current) &&
      flipScale.current === scale &&
      !modeJump.current &&
      !reducedMotion();
    const esc = flipNext.current;
    flipNext.current = false;
    modeJump.current = false;
    flipScale.current = scale;
    lastRects.current = next;
    // Nach dem Loslassen (keine Geste, kein Esc): laufendes Gleiten abbrechen, Endlage sofort.
    if (drag === null && !esc)
      for (const el of flipActive.current) {
        el.style.transition = 'none';
        el.style.transform = '';
        flipActive.current.delete(el);
      }
    if (!glide) return;
    const duration = drag === null ? SNAP_MS : 180;
    for (const [k, r] of next) {
      const o = prev.get(k);
      if (o === undefined || count.get(k) !== 1 || k === drag?.entryId) continue;
      if (o.left === r.left && o.top === r.top && o.width === r.width && o.height === r.height)
        continue;
      const el = entryButtons.current.get(k)?.parentElement;
      if (el === null || el === undefined || r.width <= 0 || r.height <= 0) continue;
      flipActive.current.add(el);
      el.style.transition = 'none';
      el.style.transformOrigin = '0 0';
      el.style.transform = `translate(${String(o.left - r.left)}px, ${String(o.top - r.top)}px) scale(${String(o.width / r.width)}, ${String(o.height / r.height)})`;
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          el.style.transition = `transform ${String(duration)}ms cubic-bezier(0.2, 0.8, 0.2, 1)`;
          el.style.transform = '';
          window.setTimeout(() => {
            if (el.style.transform === '') el.style.transition = '';
            flipActive.current.delete(el);
          }, duration + 40);
        }),
      );
    }
  }, [views]);

  // Spaltenköpfe aus der Layout-Schicht (E1-02l R1): nie gekürzt; reicht die Kopfhöhe nicht, wächst sie. Höhe wie die
  // Spaltenköpfe der PDF-Seite, im selben Faktor (F-UX2 P1).
  const headBase = Math.max(8, Math.round(basis.columnHeadPt * screenFactor(scale)));
  const heads = useMemo(() => {
    // Köpfe der Wochenseite (VQA-2-01); nur während des Ziehens einer Spaltengrenze (Vorschau der Breite) neu gesetzt.
    // Lage relativ zur Rasteroberkante wie im PDF: Unterkante des Tageskopfs (1 px Rand; VQA-3-05).
    if (weekPage !== null && weightPreview === null) return pageHeads(weekPage, scale, 1);
    const map = new Map<IsoDate, ScreenHeads>();
    for (const day of days)
      map.set(
        day.date,
        screenHeads(day, headBase, scale, template, (column, usablePt) => {
          if (column.kind === 'rap') return 'Rap';
          if (column.kind === 'beso')
            return day.display === 'compact' ||
              measureRuns([{ text: 'Beso', weight: 'bold' }], template.fontSizes.standard) >
                usablePt
              ? 'Bes'
              : 'Beso';
          return column.name;
        }),
      );
    return map;
  }, [days, scale, template, headBase, weekPage, weightPreview]);
  const headHeight = Math.max(headBase, ...[...heads.values()].map((h) => h.heightPx));
  // Bündig (F-UX2 P3): Blockränder, Spalten-, Tages- und Zeitlinien aus derselben Geometrie auf ganze Gerätepixel
  // gerundet, im Inhalt des Rasters (Tageskante = Zeitachse + Tagesbeginn, Oberkante = Kopfhöhe).
  const dpr = typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1;
  const bodyTopPx = DAY_LABEL_HEIGHT + headHeight + 1;
  const snap = (v: number): number => Math.round(v * dpr) / dpr;
  const snapX = (day: DayBox, x: number): number =>
    snap(AXIS_WIDTH + day.left + x) - snap(AXIS_WIDTH + day.left);
  const snapY = (y: number): number => snap(bodyTopPx + y) - snap(bodyTopPx);
  /**
   * Abstand der auf Gerätepixel gerundeten Lage des Tages zu seiner genauen Lage (px): Köpfe und Termine stehen damit
   * wie im PDF, obwohl die Tagesspalten bündig auf Gerätepixeln liegen (VQA-3-05).
   */
  const dayShift = (day: DayBox): number =>
    day.left - (snap(AXIS_WIDTH + day.left) - snap(AXIS_WIDTH));
  const snapRect = (day: DayBox, r: Rect): Rect => {
    const left = snapX(day, r.left);
    const top = snapY(r.top);
    return {
      left,
      top,
      width: Math.max(1 / dpr, snapX(day, r.left + r.width) - left),
      height: Math.max(1 / dpr, snapY(r.top + r.height) - top),
    };
  };
  /** Strichstärke in px: pt × Faktor, mindestens ein Gerätepixel, auf ganze Gerätepixel gerundet. */
  const strokePx = (widthPt: number): number =>
    Math.max(1, Math.round(widthPt * screenFactor(scale) * dpr)) / dpr;

  /**
   * Einträge in Leserichtung: Tag, Sortierzeit, Spalte (UI-Richtlinie 13.4). Aus den gelegten Ansichten (F-PERF):
   * beim Ziehen gilt die Reihenfolge vor der Geste, nach dem Loslassen die neue.
   */
  const readingOrder = useMemo(() => {
    const list: { id: Id; windowId: Id | null; date: IsoDate; time: number; left: number }[] = [];
    for (const day of days)
      for (const v of laidViews.get(day.date) ?? [])
        if (!v.id.includes('~') && (v.kind !== 'querbalken' || v.first))
          list.push({
            id: v.id,
            windowId: v.windowId,
            date: day.date,
            time: v.from,
            left: v.rect.left,
          });
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.time - b.time || a.left - b.left);
  }, [days, laidViews]);

  const selectedEntry = selected === null ? undefined : plan.entries[selected.id];

  // ---------------------------------------------------------------------------------------------
  // Zellzeiger (B1): eine 15-Min-Zelle × Spalte, Bereich nach Shift+Pfeil, ein einziger Tab-Stopp
  // ---------------------------------------------------------------------------------------------

  const bounds = useMemo(
    () => ({ from: plan.displayRange.from, to: plan.displayRange.to }),
    [plan.displayRange.from, plan.displayRange.to],
  );
  const activeCursor = useMemo((): Cursor | null => {
    if (cursor !== null) return normalizeCursor(cursor, days, bounds);
    const memory = cursorMemory?.current ?? null;
    if (memory !== null) {
      const day = days.find((d) => weekdayIndex(d.weekday) === memory.weekday);
      if (day !== undefined) {
        const index = day.columns.findIndex((c) => c.column.name === memory.columnName);
        return normalizeCursor(
          { date: day.date, minute: memory.minute, column: Math.max(0, index) },
          days,
          bounds,
        );
      }
    }
    return initialCursor(days, bounds);
  }, [cursor, days, bounds, cursorMemory]);
  const cells: CellRange | null = activeCursor === null ? null : cellRange(activeCursor, anchor);
  const cursorDay =
    activeCursor === null ? undefined : days.find((d) => d.date === activeCursor.date);

  useEffect(() => {
    if (cursorMemory === undefined || activeCursor === null) return;
    const day = days.find((d) => d.date === activeCursor.date);
    cursorMemory.current = {
      weekday: day === undefined ? 0 : weekdayIndex(day.weekday),
      minute: activeCursor.minute,
      columnName: day?.columns[activeCursor.column]?.column.name ?? '',
    };
  }, [activeCursor, days, cursorMemory]);

  function focusCursor(scroll: boolean): void {
    setFocusKey('cursor');
    const node = cursorRef.current;
    if (node === null) {
      setPendingFocus('cursor');
      return;
    }
    node.focus({ preventScroll: true });
    if (scroll) reveal(node);
  }

  function moveCursorTo(next: Cursor | null, focus: boolean, keepAnchor = false): void {
    if (next === null) return;
    setCursorState(next);
    if (!keepAnchor) setAnchor(null);
    if (focus) {
      setPendingFocus('cursor');
      setFocusKey('cursor');
    }
  }

  /** Zelle eines Eintrags: Tag, Beginn (15-Min-Zeile), erste Spalte bzw. Rap-/Beso-Spalte. */
  function cursorForEntry(e: Entry, windowId: Id | null = null): Cursor | null {
    const date = entryDate(e);
    const day =
      days.find((d) => d.date === date) ?? (e.type === 'querbalken' ? days[0] : undefined);
    if (day === undefined || date === null) return null;
    const span = entrySpan(e);
    let column = 0;
    if (e.type === 'block' || e.type === 'marker') {
      const ids = columnsRect(plan, day, e.type === 'marker' ? MARKER_COLUMNS : e.columns).ids;
      column = Math.max(
        0,
        day.columns.findIndex((c) => ids.includes(c.column.id)),
      );
    } else if (e.type === 'rapport') {
      column = Math.max(
        0,
        day.columns.findIndex((c) => c.column.kind === 'rap'),
      );
    } else if (e.type === 'beso') {
      const w = e.windows.find((x) => x.id === windowId) ?? e.windows[0];
      column = Math.max(
        0,
        day.columns.findIndex((c) =>
          w?.columnId == null ? c.column.kind === 'beso' : c.column.id === w.columnId,
        ),
      );
    }
    return normalizeCursor(
      { date: day.date, minute: span?.from ?? plan.displayRange.from + 60, column },
      days,
      bounds,
    );
  }

  /** Eintrag auf der Zelle des Zellzeigers (Mitte der Zelle in einem Rechteck). */
  const occupant = useMemo((): EntryView | null => {
    if (activeCursor === null || cursorDay === undefined) return null;
    const box = cursorDay.columns[activeCursor.column];
    if (box === undefined) return null;
    const x = box.left + box.width / 2;
    const y = (activeCursor.minute + STEP / 2 - plan.displayRange.from) * scale.minute;
    const hits = (views.get(cursorDay.date) ?? []).filter(
      (v) =>
        !v.id.includes('~') &&
        x >= v.rect.left &&
        x <= v.rect.left + v.rect.width &&
        y >= v.rect.top &&
        y <= v.rect.top + Math.max(v.rect.height, 2),
    );
    return hits.sort((a, b) => b.z - a.z)[0] ?? null;
  }, [activeCursor, cursorDay, views, plan.displayRange.from, scale.minute]);

  const cursorName = useMemo(() => {
    if (cells === null || cursorDay === undefined) return '';
    const entry = occupant === null ? undefined : plan.entries[occupant.id];
    return cursorLabel(
      cursorDay,
      cells,
      occupant === null || entry === undefined
        ? null
        : {
            type: typeName(entry),
            title: entryTitle(plan, entry),
            time:
              occupant.kind === 'querbalken'
                ? ''
                : `${formatMilTime(occupant.from)}${occupant.to > occupant.from ? `-${formatMilTime(Math.min(2880, occupant.to))}` : ''}`,
          },
    );
  }, [cells, cursorDay, occupant, plan]);

  // Ansage gedrosselt: 300 ms nach der letzten Bewegung (UI-Richtlinie 13.6).
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => setAnnounce(cursorName), 300);
    return () => window.clearTimeout(timer);
  }, [cursorName]);

  useLayoutEffect(() => {
    if (!scrollCursor.current) return;
    scrollCursor.current = false;
    const node = cursorRef.current;
    if (node === null) return;
    // Über die Tagesgrenze entsteht der Zellzeiger in der Zelle des neuen Tags neu: Fokus mitnehmen.
    if (document.activeElement !== node) node.focus({ preventScroll: true });
    reveal(node);
  });

  // Aus den gelegten Ansichten (F-PERF): die Vorschau beim Ziehen ändert keine Schlüssel, nur Lagen.
  const visibleKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const list of laidViews.values()) for (const v of list) keys.add(itemKey(v));
    return keys;
  }, [laidViews]);
  const cursorTabbable = focusKey === 'cursor' || !visibleKeys.has(focusKey);

  useEffect(() => {
    if (pendingFocus === null) return;
    if (pendingFocus === 'cursor') {
      const node = cursorRef.current;
      if (node !== null) {
        node.focus({ preventScroll: true });
        reveal(node);
        setPendingFocus(null);
      }
      return;
    }
    const button =
      entryButtons.current.get(pendingFocus) ??
      emptyButtons.current.get(pendingFocus) ??
      (pendingFocus.startsWith('agenda:')
        ? agendaButtons.current.get(pendingFocus.slice('agenda:'.length))
        : (entryButtons.current.get(`${pendingFocus}:${RAPPORT_IN_COLUMNS}`) ??
          agendaButtons.current.get(pendingFocus)));
    if (button !== undefined) {
      button.focus({ preventScroll: false });
      keepSelection.current = false;
      setPendingFocus(null);
    }
  });

  /** Nur im Raster rollen, nie die Seite (die Liste daneben bleibt, wo sie ist; UX-AB-02). */
  const revealInGrid = (element: HTMLElement | null | undefined): void =>
    revealIn(scrollRef.current, element);
  /** Terminzeile, die nach dem Neuzeichnen gezeigt bzw. fokussiert wird (Sprung aus der Liste; UX-AB-02). */
  const pendingAgenda = useRef<{ id: Id; focus: boolean } | null>(null);
  useEffect(() => {
    const want = pendingAgenda.current;
    if (want === null) return;
    const button = agendaButtons.current.get(want.id);
    if (button === undefined || !button.isConnected) return;
    pendingAgenda.current = null;
    if (want.focus) button.focus();
    else revealInGrid(button);
  });

  /** Geist an der Originallage einer nicht übernommenen Form (UX-AB-07); weg mit dem nächsten Sprung. */
  const [ghost, setGhost] = useState<GhostPlace | null>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ghost !== null) revealIn(scrollRef.current, ghostRef.current);
  }, [ghost]);
  // Fokus nach Rückgängig, Datei öffnen, Wochenwechsel (B5): betroffener Eintrag, sonst Zellzeiger.
  useEffect(() => {
    if (focusRequest === undefined || focusRequest.handled) return;
    focusRequest.handled = true;
    const place = focusRequest.place;
    setGhost(place ?? null);
    if (place !== undefined && days.some((d) => d.date === place.date)) {
      const minute = Math.max(
        plan.displayRange.from,
        Math.min(plan.displayRange.to - STEP, Math.floor(place.from / STEP) * STEP),
      );
      moveCursorTo({ date: place.date, minute, column: 0 }, focusRequest.reveal !== true);
      return;
    }
    for (const id of focusRequest.ids) {
      const view = [...views.values()].flat().find((v) => v.id === id && !v.id.includes('~'));
      if (view !== undefined) {
        setSelected({ id: view.id, windowId: view.windowId });
        if (focusRequest.reveal === true) revealInGrid(entryButtons.current.get(itemKey(view)));
        else setPendingFocus(itemKey(view));
        return;
      }
      // Ganztägige Bemerkung bzw. Beso nur im Terminbereich: die Terminzeile wählen und zeigen (UX-AB-02).
      const inAgenda = [...agendaLines.values()].some((lines) =>
        lines.some((l) => l.entryId === id),
      );
      if (inAgenda) {
        setSelection([{ id, windowId: null }]);
        pendingAgenda.current = { id, focus: focusRequest.reveal !== true };
        return;
      }
    }
    if (focusRequest.reveal !== true) focusCursor(false);
  });

  // Fokus ins Titelfeld nur beim Öffnen einer Bearbeitung, nicht bei jeder Eingabe.
  const editKey = editing === null ? null : editing.kind === 'block' ? editing.id : 'draft';
  const editSelectAll = editing?.selectAll ?? false;
  useEffect(() => {
    // Mit getipptem Startzeichen eröffnet: der Stand davor ist der erste Rückgängig-Schritt, weiteres Tippen gehört
    // zum selben Schritt (Ctrl+Z nimmt auch den ersten Buchstaben zurück; UX-2-10).
    const seed = editSeed.current;
    editSeed.current = null;
    editHistory.current =
      seed === null || editKey === null
        ? { past: [], future: [], last: null }
        : { past: [seed], future: [], last: 'title:ein' };
    if (editKey === null) return;
    const input = titleRef.current;
    if (input === null) return;
    input.focus({ preventScroll: true });
    if (editSelectAll) input.select();
    else input.setSelectionRange(input.value.length, input.value.length);
  }, [editKey, editSelectAll]);
  const formOpen = form !== null;
  const formFocus = form?.focus ?? 'title';
  useEffect(() => {
    if (!formOpen) return;
    const node = formRef.current?.querySelector<HTMLInputElement | HTMLSelectElement>(
      `[data-form-field="${formFocus}"]`,
    );
    const target = node ?? formTitleRef.current;
    target?.focus();
    if (target instanceof HTMLInputElement) target.select();
  }, [formOpen, formFocus]);

  function dispatch(run: RunCommand, focusKey?: string): void {
    setError('');
    if (focusKey !== undefined) setPendingFocus(focusKey);
    onCommand(run).catch((failure: unknown) => setError(messageOf(failure)));
  }

  // ---------------------------------------------------------------------------------------------
  // Seitenfeld (I3 C1; UI-Richtlinie 6): Auswahl → Felder; Esc im Feld → zurück ins Raster
  // ---------------------------------------------------------------------------------------------

  function setPanelOpen(open: boolean): void {
    setPanelOpenState(open);
    writePanel(open);
    if (!open) setPanelError('');
  }

  function openPanel(field: string | null): void {
    setPanelOpen(true);
    setPanelError('');
    setPanelFocus((f) => ({ seq: f.seq + 1, field }));
  }

  /** Fokus auf den gewählten Eintrag (Ansicht im Raster bzw. Terminzeile), sonst auf den Zellzeiger. */
  function focusSelectedOrCursor(): void {
    const sel = selected;
    if (sel !== null) {
      const key = itemKey(sel);
      if (entryButtons.current.has(key)) {
        focusItem(sel, true);
        return;
      }
      const view = [...views.values()].flat().find((v) => v.id === sel.id && !v.id.includes('~'));
      if (view !== undefined) {
        focusItem({ id: view.id, windowId: view.windowId }, true);
        return;
      }
      const line = agendaButtons.current.get(sel.id);
      if (line !== undefined) {
        keepSelection.current = true;
        line.focus();
        keepSelection.current = false;
        return;
      }
    }
    if (daySelection.length > 0) {
      const head = emptyButtons.current.get(`day:${daySelection[daySelection.length - 1] ?? ''}`);
      if (head !== undefined) {
        head.focus();
        return;
      }
    }
    focusCursor(false);
  }

  const panelTarget: PanelTarget =
    selection.length > 0
      ? { kind: 'entries', ids: [...selectedIds], windowId: selected?.windowId ?? null }
      : daySelection.length > 0
        ? { kind: 'days', dates: daySelection }
        : { kind: 'week' };
  const hasSelection = selection.length > 0;
  useEffect(() => {
    if (hasSelection) setDaySelection([]);
  }, [hasSelection]);

  const panelActions: PanelActions = {
    run: (cmd) => {
      setPanelError('');
      onCommand(cmd).catch((failure: unknown) => setPanelError(messageOf(failure)));
    },
    toGrid: () => focusSelectedOrCursor(),
    remove: (ids) => removeEntries(ids),
    renumber: (date) => setRenumberDate(date),
    notice: (message) => setPanelError(message),
    disabled,
  };

  /** Streichen bzw. Streichung aufheben (Taste X; UI-Richtlinie 13.3): «gestrichen» ↔ «bestätigt», ein Undo-Schritt. */
  function toggleCancelled(ids: readonly Id[]): void {
    if (disabled) return;
    const entries = ids.map((id) => plan.entries[id]).filter((e): e is Entry => e !== undefined);
    const first = entries[0];
    if (first === undefined) return;
    const all = entries.every((e) => e.status === 'cancelled');
    const status = all ? 'confirmed' : 'cancelled';
    keepSelection.current = true;
    dispatch(
      (p, ctx) => updateCommonFields(p, ids, { status }, ctx),
      selected === null ? undefined : itemKey(selected),
    );
    const what =
      entries.length === 1
        ? entryTitle(plan, first) === ''
          ? typeName(first)
          : `«${entryTitle(plan, first)}»`
        : `${entries.length} Einträge`;
    onToast?.({
      text: `${what} ${all ? 'nicht mehr gestrichen' : 'gestrichen'}`,
      undo: 'Streichen',
    });
  }

  /** Einträge mit einer Spalte, die es am Tag nicht gibt (Befund P1, Marke am Bildschirm; Beschrieb 5.2). */
  const p1Ids = useMemo(() => {
    const ids = new Set<Id>();
    for (const e of entriesInWeek)
      if (e.type !== 'querbalken' && missingColumns(plan, [e.id]).length > 0) ids.add(e.id);
    return ids;
  }, [entriesInWeek, plan]);

  /**
   * Leere Woche zeigt den nächsten sinnvollen Schritt (Beschrieb 5.7; UI-Richtlinie 11.1, Ansicht 02; R-5.7-02):
   * ohne Spaltensatz «Spaltensatz wählen», sonst «Einträge ins Raster ziehen».
   */
  const emptyWeek = useMemo(() => {
    if (week === undefined || entriesInWeek.length > 0) return null;
    const withoutSet = dayInputs.filter((d) => d.setId === null && d.display !== 'hidden');
    return {
      withoutSet: withoutSet.map((d) => d.date),
      weekdays: withoutSet.map((d) => d.weekday),
    };
  }, [week, entriesInWeek, dayInputs]);

  // ---------------------------------------------------------------------------------------------
  // Direktbearbeitung (A2)
  // ---------------------------------------------------------------------------------------------

  /** Direktbearbeitung eines Eintrags: Block (A2), Rapport-Kürzel und Beso-Termintext (B8). */
  function startEdit(entry: Entry, typed?: string, windowId: Id | null = null): void {
    if (disabled) return;
    if (entry.type !== 'block' && entry.type !== 'rapport' && entry.type !== 'beso') return;
    setForm(null);
    setEditError('');
    setSelected({ id: entry.id, windowId: entry.type === 'beso' ? windowId : null });
    // Beso: Titel mit Fett-Maske wie bei Blöcken, damit fette Teile erhalten bleiben (CR-H-U-06).
    const original =
      entry.type === 'block'
        ? blockValues(plan, entry)
        : entry.type === 'beso'
          ? besoValues(plan, entry)
          : { ...EMPTY_VALUES, title: entry.code };
    editSeed.current = typed === undefined ? null : original;
    setEditing({
      kind: 'block',
      id: entry.id,
      windowId: entry.type === 'beso' ? windowId : null,
      entryType: entry.type,
      original,
      values: typed === undefined ? original : typedValues(original, typed),
      selectAll: typed === undefined,
    });
  }

  /** Neuer Eintrag am Zellzeiger bzw. nach Ziehen oder Doppelklick; Titel sofort eintippen. */
  function startDraft(
    placement: Placement,
    entryType: EditType,
    mode: ArrangeMode,
    typed = '',
  ): void {
    if (disabled) return;
    setForm(null);
    setEditError('');
    setSelected(null);
    setAnchor(null);
    setCursorState({
      date: placement.date,
      minute: Math.floor(placement.from / STEP) * STEP,
      column: Math.max(
        0,
        (days.find((d) => d.date === placement.date)?.columns ?? []).findIndex(
          (c) => placement.columns.kind === 'ids' && placement.columns.ids[0] === c.column.id,
        ),
      ),
    });
    editSeed.current = typed === '' ? null : EMPTY_VALUES;
    setEditing({
      kind: 'draft',
      entryType,
      placement,
      mode,
      values: typedValues(EMPTY_VALUES, typed),
      original: EMPTY_VALUES,
      selectAll: false,
    });
  }

  function invalidValue(
    values: EditValues,
    entryType: EditType,
  ): { readonly message: string; readonly field: EditField; readonly glyph: boolean } | null {
    if (values.title.trim() === '')
      return {
        field: 'title',
        glyph: false,
        message:
          entryType === 'rapport'
            ? 'Der Rapport hat kein Kürzel. Ein Kürzel eingeben, zum Beispiel «KR», oder mit Esc verwerfen.'
            : entryType === 'beso'
              ? 'Der Beso hat keinen Termintext. Einen Text eingeben oder mit Esc verwerfen.'
              : 'Der Block hat keinen Titel. Einen Titel eingeben oder mit Esc verwerfen.',
      };
    for (const field of EDIT_FIELDS)
      if (!isRenderable(values[field]))
        return {
          field,
          glyph: true,
          message:
            'Ein Zeichen kann im PDF nicht dargestellt werden. Das Zeichen durch Buchstaben oder Zahlen ersetzen oder mit Esc verwerfen.',
        };
    return null;
  }

  /**
   * Übernimmt die offene Bearbeitung. Ungültig bleibt sie offen (Feld rot, Meldung, Fokus im Feld): bei Enter
   * (`strict`) immer, sonst bei einem Zeichen ohne Glyphe (UI-Richtlinie 5.4; CR-H-U-05). Ohne Titel verwirft Klick
   * ausserhalb wie bisher. Rückgabe false = Bearbeitung bleibt offen.
   */
  function commitEdit(strict: boolean): boolean {
    const current = editing;
    if (current === null) return true;
    const problem = invalidValue(current.values, current.entryType);
    if (problem !== null) {
      if (strict || problem.glyph) {
        setEditError(problem.message);
        setEditErrorField(problem.field);
        editorRef.current
          ?.querySelector<HTMLInputElement>(`[data-field="${problem.field}"]`)
          ?.focus();
        return false;
      }
      cancelEdit(false);
      // Sichtbar als Meldung, nicht nur in der Statuszeile (H-UI2, ux-critic «leerer Titel verwirft ohne Meldung»).
      setStatus(`Bearbeitung verworfen: ${problem.message}`);
      onToast?.({ text: `Bearbeitung verworfen: ${problem.message}` });
      return true;
    }
    const v = current.values;
    setEditing(null);
    setEditError('');
    setEditErrorField(null);
    if (current.kind === 'block') {
      const id = current.id;
      const focus = current.windowId === null ? id : `${id}:${current.windowId}`;
      if (current.entryType === 'rapport') {
        if (v.title !== current.original.title)
          dispatch((p, ctx) => updateEntry(p, id, 'rapport', { code: v.title }, ctx), focus);
        else setPendingFocus(focus);
        return true;
      }
      if (current.entryType === 'beso') {
        if (v.title !== current.original.title || !sameMask(v.mask, current.original.mask))
          dispatch(
            (p, ctx) =>
              updateEntry(p, id, 'beso', { title: richOf({ text: v.title, mask: v.mask }) }, ctx),
            focus,
          );
        else setPendingFocus(focus);
        return true;
      }
      const changes = {
        ...(v.title === current.original.title && sameMask(v.mask, current.original.mask)
          ? {}
          : { title: richOf({ text: v.title, mask: v.mask }) }),
        ...(v.supplement === current.original.supplement ? {} : { supplement: v.supplement }),
        ...(v.ltg === current.original.ltg ? {} : { ltg: v.ltg }),
        ...(v.ort === current.original.ort ? {} : { ort: v.ort }),
      };
      if (Object.keys(changes).length > 0)
        dispatch((p, ctx) => updateEntry(p, id, 'block', changes, ctx), id);
      else setPendingFocus(id);
      return true;
    }
    const placement = current.placement;
    const mode = current.mode;
    let createdKey: string | null = null;
    if (current.entryType === 'rapport' || current.entryType === 'beso') {
      const type = current.entryType;
      dispatch((p, ctx) => {
        const r =
          type === 'rapport'
            ? createEntry(
                p,
                {
                  type: 'rapport',
                  date: placement.date,
                  code: v.title,
                  time: { form: 'range', from: placement.from, to: placement.to },
                },
                ctx,
              )
            : createEntry(
                p,
                {
                  type: 'beso',
                  date: placement.date,
                  title: [{ text: v.title, bold: false }],
                  windows: [{ time: { form: 'range', from: placement.from, to: placement.to } }],
                },
                ctx,
              );
        const created = r.plan.entries[r.entryId];
        const windowId = created?.type === 'beso' ? (created.windows[0]?.id ?? null) : null;
        createdKey = windowId === null ? r.entryId : `${r.entryId}:${windowId}`;
        setSelected({ id: r.entryId, windowId });
        return r;
      });
      if (createdKey !== null) setPendingFocus(createdKey);
      return true;
    }
    dispatch((p, ctx) => {
      const r = applyArrangement(
        p,
        { kind: 'create', target: placement },
        mode,
        (base, time) =>
          createEntry(
            base,
            {
              type: 'block',
              date: placement.date,
              time: { form: 'range', from: time.from, to: time.to },
              columns: placement.columns,
              title: richOf({ text: v.title, mask: v.mask }),
              supplement: v.supplement,
              ltg: v.ltg,
              ort: v.ort,
            },
            ctx,
          ),
        ctx,
      );
      createdKey = r.entryId;
      setSelected({ id: r.entryId, windowId: null });
      return r;
    });
    if (createdKey !== null) setPendingFocus(createdKey);
    return true;
  }

  function cancelEdit(refocus = true): void {
    const current = editing;
    setEditing(null);
    setEditError('');
    setEditErrorField(null);
    if (!refocus || current === null) return;
    if (current.kind === 'block')
      setPendingFocus(current.windowId === null ? current.id : `${current.id}:${current.windowId}`);
    else focusCursor(false);
  }

  // Klick ausserhalb übernimmt und schliesst; Ziehen bleibt möglich (A2). Bleibt die Bearbeitung offen (Zeichen ohne
  // Glyphe, CR-H-U-05), wird der Klick nicht ausgeführt und der Fokus bleibt im Feld.
  useEffect(() => {
    if (editing === null) return;
    const swallow = (event: Event) => {
      event.preventDefault();
      event.stopPropagation();
    };
    const outside = (event: globalThis.PointerEvent) => {
      const root = editorRef.current;
      if (root !== null && event.target instanceof Node && root.contains(event.target)) return;
      if (commitEdit(false)) return;
      swallow(event);
      document.addEventListener('mousedown', swallow, { capture: true, once: true });
      document.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => {
        document.removeEventListener('mousedown', swallow, true);
        document.removeEventListener('click', swallow, true);
      }, 1000);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  });
  useEffect(() => {
    if (form === null) return;
    const outside = (event: globalThis.PointerEvent) => {
      const root = formRef.current;
      if (root !== null && event.target instanceof Node && root.contains(event.target)) return;
      if (!submitForm()) setForm(null);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  });

  // ---------------------------------------------------------------------------------------------
  // Tastaturformular (Neuer Block, Block bearbeiten; schwebt über dem Raster)
  // ---------------------------------------------------------------------------------------------

  function beginForm(entry?: Block, placement?: Placement, focus: FormField = 'title'): void {
    const day = days.find((candidate) => candidate.planning.length > 0);
    if (disabled || day === undefined) return;
    if (editing !== null && !commitEdit(false)) return;
    const position =
      placement ??
      (entry === undefined
        ? {
            date: day.date,
            from: 480,
            to: 540,
            columns: columnsBetween(
              day.columns.map((c) => c.column),
              0,
              0,
            ),
          }
        : { date: entry.date, ...blockSpan(entry.time, plan), columns: entry.columns });
    setError('');
    setForm({
      entryId: entry?.id ?? null,
      title: entry === undefined ? '' : plainTitle(plan, entry.title),
      date: position.date,
      begin: formatMilTime(position.from),
      end: formatMilTime(Math.min(2880, position.to)),
      endTouched: false,
      duration: Math.max(15, position.to - position.from),
      columnId: 'keep',
      columnTo: '',
      initialColumns: position.columns,
      focus,
      invalid: null,
    });
  }

  function closeForm(): void {
    const id = form?.entryId;
    setForm(null);
    setError('');
    if (id === null || id === undefined) newBlockRef.current?.focus();
    else setPendingFocus(id);
  }

  /** Beginn geändert: Ende folgt mit gleicher Dauer, solange es nicht von Hand geändert wurde (B7). */
  function setBegin(value: string): void {
    if (form === null) return;
    const parsed = parseTimeInput(value, 'Beginn');
    const end =
      !form.endTouched && parsed.ok
        ? formatMilTime(Math.min(2880, parsed.value + form.duration))
        : form.end;
    setForm({
      ...form,
      begin: value,
      end,
      invalid: form.invalid === 'begin' ? null : form.invalid,
    });
  }

  /** Übernimmt das Formular; false bei ungültiger Eingabe (Feld markiert, Meldung nennt Feld, Ursache, Beispiel). */
  function submitForm(event?: FormEvent<HTMLFormElement>): boolean {
    event?.preventDefault();
    if (form === null || disabled) return false;
    const problem = invalidValue({ ...EMPTY_VALUES, title: form.title }, 'block');
    if (problem !== null) {
      setError(problem.message);
      setForm({ ...form, invalid: 'title' });
      return false;
    }
    // «0800-1200» im Feld Beginn: Beginn und Ende zugleich (H-UI2, ux-critic «Z-Formular lehnt 0800-1200 ab»).
    const range = splitRange(form.begin);
    const begin = parseTimeInput(range?.begin ?? form.begin, 'Beginn');
    const end = parseTimeInput(range?.end ?? form.end, 'Ende');
    if (!begin.ok || !end.ok) {
      setError(!begin.ok ? begin.message : end.ok ? '' : end.message);
      setForm({ ...form, invalid: !begin.ok ? 'begin' : 'end' });
      return false;
    }
    const from = begin.value;
    let to = end.value;
    if (to < from) to += 1440;
    if (to === from) {
      setError('«Ende» ist gleich wie «Beginn». Ein späteres Ende eingeben, zum Beispiel 0930.');
      setForm({ ...form, invalid: 'end' });
      return false;
    }
    const values = form;
    const formDayColumns = days.find((d) => d.date === values.date)?.planning ?? [];
    const fromIndex = formDayColumns.findIndex((c) => c.column.id === values.columnId);
    const toIndex = formDayColumns.findIndex((c) => c.column.id === values.columnTo);
    const columns: ColumnSelection =
      values.columnId === 'keep'
        ? values.initialColumns
        : values.columnId === 'all'
          ? { kind: 'all' }
          : {
              kind: 'ids',
              ids: formDayColumns
                .slice(fromIndex, Math.max(fromIndex, toIndex) + 1)
                .map((c) => c.column.id),
            };
    let createdId: Id | null = null;
    setForm(null);
    dispatch((current, context) => {
      if (values.entryId === null) {
        const result = createEntry(
          current,
          {
            type: 'block',
            date: values.date,
            time: { form: 'range', from, to },
            columns,
            title: [{ text: values.title, bold: true }],
          },
          context,
        );
        createdId = result.entryId;
        return result;
      }
      const entry = current.entries[values.entryId];
      return updateEntry(
        current,
        values.entryId,
        'block',
        {
          date: values.date,
          time: { form: 'range', from, to },
          ...(values.columnId === 'keep' ? {} : { columns }),
          ...(entry?.type === 'block' && plainTitle(current, entry.title) === values.title
            ? {}
            : { title: [{ text: values.title, bold: true }] }),
        },
        context,
      );
    });
    const id = values.entryId ?? createdId;
    if (id !== null) {
      setSelected({ id, windowId: null });
      setPendingFocus(id);
    }
    return true;
  }

  // ---------------------------------------------------------------------------------------------
  // Löschen (A1)
  // ---------------------------------------------------------------------------------------------

  /** Löscht die Einträge (B2: ganze Auswahl); Fokus zum nächsten Eintrag in Leserichtung, sonst Zellzeiger (B5). */
  function removeEntries(ids: readonly Id[]): void {
    if (disabled) return;
    const entries = ids.map((id) => plan.entries[id]).filter((e): e is Entry => e !== undefined);
    const first = entries[0];
    if (first === undefined) return;
    const gone = new Set(entries.map((e) => e.id));
    const order = readingOrder.filter((r, i, all) => all.findIndex((x) => x.id === r.id) === i);
    const index = Math.max(...entries.map((e) => order.findIndex((r) => r.id === e.id)));
    const next =
      order.slice(index + 1).find((r) => !gone.has(r.id)) ??
      [...order].reverse().find((r) => !gone.has(r.id));
    setSelected(next === undefined ? null : { id: next.id, windowId: next.windowId });
    setHover(null);
    if (next === undefined) moveCursorTo(cursorForEntry(first) ?? cursor, false);
    dispatch(
      (current, context) => deleteEntries(current, [...gone], context),
      next === undefined ? 'cursor' : itemKey(next),
    );
    const title = entryTitle(plan, first);
    onToast?.({
      text:
        entries.length > 1
          ? `${entries.length} Einträge gelöscht`
          : title === ''
            ? `${typeName(first)} gelöscht`
            : `«${title}» gelöscht`,
      undo: 'Löschen',
    });
  }

  // ---------------------------------------------------------------------------------------------
  // Ziehen (A3, A4, A6, A7)
  // ---------------------------------------------------------------------------------------------

  function hitAt(l: Live, clientX: number, clientY: number) {
    // Rolllage aus der Geste, nicht aus dem DOM (Runde 3: keine Layout-Lesung je Bild).
    const dx = l.scrollNow.left - l.scroll0.left;
    const dy = l.scrollNow.top - l.scroll0.top;
    const x = clientX - l.wrapper.left + dx - AXIS_WIDTH;
    const y = clientY - l.wrapper.top + dy - l.bodyTop;
    let day = days[0] as DayBox;
    let best = Number.POSITIVE_INFINITY;
    for (const d of days) {
      const distance = x < d.left ? d.left - x : x > d.left + d.width ? x - d.left - d.width : 0;
      if (distance < best) {
        best = distance;
        day = d;
      }
    }
    const inDay = x - day.left;
    // Spalte unter dem Zeiger mit Mindest-Trefferbreite schmaler Spalten (F-UX2 P4, Det/Nebenspalte).
    const column = Math.max(0, columnAt(day.planning, inDay));
    const over =
      inDay >= 0 && inDay < day.width ? (day.columns[columnAt(day.columns, inDay)] ?? null) : null;
    return {
      day,
      column,
      over,
      minute: plan.displayRange.from + y / scale.minute,
      x,
      y,
    };
  }

  function targetFor(l: Live, hit: ReturnType<typeof hitAt>): Target {
    const base = l.base;
    const plain = { columnId: null, dayOffset: 0 };
    const entry = l.entry;
    if (l.kind === 'band') {
      return {
        ...plain,
        date: base.date,
        from: plan.displayRange.from,
        to: plan.displayRange.from + 60,
        columns: { kind: 'all' },
        dayOffset: daysBetween(l.originDay.date, hit.day.date),
      };
    }
    if (l.kind === 'create' && l.special !== null) {
      return {
        ...plain,
        date: base.date,
        ...drawingTime(l.originMinute, hit.minute),
        columns: { kind: 'ids', ids: [l.special.id] },
      };
    }
    if (l.kind === 'create') {
      const column =
        hit.day.date === l.originDay.date
          ? hit.column
          : hit.day.date < l.originDay.date
            ? 0
            : l.originDay.planning.length - 1;
      return {
        ...plain,
        date: base.date,
        ...drawingTime(l.originMinute, hit.minute),
        columns: columnsBetween(
          l.originDay.columns.map((c) => c.column),
          l.originColumn,
          column,
        ),
      };
    }
    const delta = hit.minute - l.originMinute;
    if (entry?.type === 'querbalken') {
      const offset = daysBetween(l.originDay.date, hit.day.date);
      if (l.kind === 'left') {
        const from = addDays(entry.fromDate, offset);
        return {
          ...plain,
          date: base.date,
          from: 0,
          to: 0,
          columns: base.columns,
          dayOffset:
            daysBetween(from, entry.toDate) < 0
              ? daysBetween(entry.fromDate, entry.toDate)
              : offset,
        };
      }
      if (l.kind === 'right') {
        const to = addDays(entry.toDate, offset);
        return {
          ...plain,
          date: base.date,
          from: 0,
          to: 0,
          columns: base.columns,
          dayOffset:
            daysBetween(entry.fromDate, to) < 0
              ? -daysBetween(entry.fromDate, entry.toDate)
              : offset,
        };
      }
      return {
        ...plain,
        date: base.date,
        from: 0,
        to: 0,
        columns: base.columns,
        dayOffset: offset,
      };
    }
    if (entry?.type === 'marker') {
      const at = Math.max(0, Math.min(1440, snapMinutes(base.from + delta)));
      return { ...plain, date: base.date, from: at, to: at, columns: MARKER_COLUMNS };
    }
    if (l.kind === 'move') {
      const time = moveAcrossDayBoundary(hit.day.date, base.from, base.to, delta);
      const targetDay = days.find((d) => d.date === time.date);
      if (entry?.type === 'beso') {
        const over = hit.over?.column;
        const current =
          l.windowId === null
            ? null
            : (entry.windows.find((w) => w.id === l.windowId)?.columnId ?? null);
        const columnId =
          over === undefined
            ? current
            : over.kind === 'beso'
              ? null
              : over.kind === 'planning' || over.kind === 'secondary'
                ? over.id
                : current;
        return { ...plain, ...time, columns: base.columns, columnId };
      }
      if (entry?.type === 'rapport') return { ...plain, ...time, columns: base.columns };
      let columns = base.columns;
      if (time.date === base.date && columns.kind === 'ids') {
        // Spalten wie gezeichnet: fehlt eine am Tag (P1), gilt ihre gleiche relative Lage (UX-H-05, F-48).
        const drawn = new Set(columnsRect(plan, l.originDay, columns).ids);
        const chosen = l.originDay.planning
          .map((c, index) => (drawn.has(c.column.id) ? index : -1))
          .filter((index) => index >= 0);
        const first = Math.min(...chosen);
        const last = Math.max(...chosen);
        // Am Tagesrand endet der Block an der ersten bzw. letzten Planungsspalte (z.B. auf eine schmale Det-Spalte
        // gezogen: Trp+Det statt still zurück; UX-2-02). Vorschau, Zeitschild und Ablage zeigen dasselbe Ziel.
        const shift = Math.max(
          -first,
          Math.min(hit.day.planning.length - 1 - last, hit.column - l.originColumn),
        );
        // Jede gewählte Spalte einzeln verschieben: verknüpfte Teilblöcke in nicht benachbarten Spalten bleiben
        // getrennt und füllen die Zwischenspalte nicht (R-4.6-61, FD-02).
        const moved = new Set(chosen.map((index) => index + shift));
        if (chosen.length > 0 && first + shift >= 0 && last + shift < hit.day.planning.length)
          columns = {
            kind: 'ids',
            ids: hit.day.planning.filter((_, index) => moved.has(index)).map((c) => c.column.id),
          };
        else if (chosen.length === 0) {
          // Spalte ohne bekannte frühere Lage (ganze Breite, Q-027): Ablage in der Spalte unter dem Zeiger (UX-3-02).
          const under = hit.day.planning[hit.column];
          if (under !== undefined) columns = { kind: 'ids', ids: [under.column.id] };
        }
      } else if (targetDay !== undefined)
        columns = carryColumnSelection(
          plan,
          columns,
          targetDay.columns.map((c) => c.column),
        );
      return { ...plain, ...time, columns };
    }
    // Kanten relativ zur Greiflage (UX-FUX3-06): der Abstand zur Kante beim Greifen wird nicht aufs Raster gerundet.
    // Am Tagesende bzw. -beginn hält die Kante in jeder Betriebsart an wie mit Shift (UX-FUX3-02); über Mitternacht
    // nur per Eingabe. Ein Block, der schon über Mitternacht reicht, behält seine Grenze von 24 h.
    if (l.kind === 'start') {
      const raw = snapMinutes(base.from + delta);
      return {
        ...plain,
        date: base.date,
        to: base.to,
        columns: base.columns,
        from: Math.max(0, Math.min(1425, base.to - 15, raw)),
        ...(raw < 0 ? { dayLimit: true as const } : {}),
      };
    }
    if (l.kind === 'end') {
      const raw = snapMinutes(base.to + delta);
      const limit = base.to <= 1440 ? 1440 : base.from + 1440;
      return {
        ...plain,
        date: base.date,
        from: base.from,
        columns: base.columns,
        to: Math.min(limit, Math.max(base.from + 15, raw)),
        ...(raw > limit && limit === 1440 ? { dayLimit: true as const } : {}),
      };
    }
    const chosen = l.originDay.planning
      .map((c, i) =>
        columnsRect(plan, l.originDay, base.columns).ids.includes(c.column.id) ? i : -1,
      )
      .filter((i) => i >= 0);
    if (chosen.length === 0) return { ...plain, ...base };
    const index = hit.day.date === l.originDay.date ? hit.column : l.originColumn;
    return {
      ...plain,
      ...base,
      columns: {
        kind: 'ids',
        ids: l.originDay.planning
          .filter((_, i) => spanEdge(chosen, l.kind === 'left' ? 'left' : 'right', index).has(i))
          .map((c) => c.column.id),
      },
    };
  }

  function modeOf(l: Live): ArrangeMode {
    return l.alt ? 'none' : l.shift ? 'shift' : 'adjust';
  }

  /** Verschieben mit Ctrl: legt beim Loslassen eine Kopie ab, das Original bleibt (UI-Richtlinie 5.5). */
  function copies(l: Live): boolean {
    return l.ctrl && l.kind === 'move' && l.entry !== null;
  }

  function blockGesture(l: Live, t: Target): BlockGesture | null {
    if (l.kind === 'create') return l.special === null ? { kind: 'create', target: t } : null;
    if (l.kind === 'band') return null;
    if (l.entry?.type !== 'block' || l.entry.time.form !== 'range') return null;
    // Eine Kopie wird wie ein neuer Block am Ziel angeordnet; das Original ist dann ein Nachbar.
    if (l.kind === 'move' && copies(l)) return { kind: 'create', target: t };
    if (l.kind === 'move') return { kind: 'move', blockId: l.entry.id, target: t };
    if (l.kind === 'start') return { kind: 'start', blockId: l.entry.id, edge: t.from };
    if (l.kind === 'end') return { kind: 'end', blockId: l.entry.id, edge: t.to };
    return null;
  }

  function columnNames(day: DayBox | undefined, sel: ColumnSelection): readonly string[] {
    if (day === undefined) return [];
    const ids = columnsRect(plan, day, sel).ids;
    return day.columns.filter((c) => ids.includes(c.column.id)).map((c) => c.column.name);
  }

  /**
   * Plakette am Zeitschild (Runde 3, 1a mit dem Aufleuchten aus C): Shift mit Anzahl der mitgeschobenen Blöcke, Alt
   * «parallel, ohne Anpassung», ohne Taste «dockt an …» bzw. Anzahl der angepassten Nachbarn; sonst keine.
   */
  function badgeFor(l: Live, a: Arrangement | null, t: Target | null = null): string {
    if (l.kind === 'band' || (l.kind === 'create' && l.special !== null)) return '';
    if (l.kind !== 'create' && l.entry?.type !== 'block') return '';
    const mode = modeOf(l);
    // Am Tagesende kein Platz (CR-F3-01): Ursache und nächster Schritt.
    if (mode !== 'none' && a?.dayEnd === true)
      return `${mode === 'shift' ? '⇧ Shift · ' : ''}Folgende reichen über Tagesende · Alt = parallel`;
    // Die Kante selbst hält am Tagesende bzw. -beginn (UX-FUX3-02), in jeder Betriebsart.
    if (t?.dayLimit === true) {
      const prefix = mode === 'none' ? 'Alt · ' : mode === 'shift' ? '⇧ Shift · ' : '';
      return l.kind === 'start'
        ? `${prefix}Tagesbeginn 0000 · vor Mitternacht: Zeit eingeben (Z)`
        : `${prefix}Tagesende 2400 · über Mitternacht: Zeit eingeben (Z)`;
    }
    if (mode === 'none') return 'Alt · parallel, ohne Anpassung';
    const n = a === null ? 0 : arrangementSize(a);
    if (mode === 'shift') {
      const nur = (a?.shifts ?? []).length === 0;
      const wort = nur ? (n === 1 ? 'Block' : 'Blöcke') : n === 1 ? 'Eintrag' : 'Einträge';
      return `⇧ Shift · Folgende mitschieben${n === 0 ? '' : ` · ${String(n)} ${wort}`}`;
    }
    if (a?.limit === true) return 'Nachbar mind. 15 Min · Shift = mitschieben';
    if (a?.dock !== undefined) {
      const d = plan.entries[a.dock];
      return `dockt an «${d === undefined ? '' : entryTitle(plan, d)}» · Alt = darüber`;
    }
    // Genau ein Nachbar schrumpft (gemeinsame Kante, Runde 4): Name und Dauer.
    if (n === 1 && a !== null && a.changes.length === 1 && a.splits.length === 0) {
      const c = a.changes[0];
      const e = c === undefined ? undefined : plan.entries[c.id];
      if (c !== undefined && e?.type === 'block' && e.time.form === 'range') {
        const d = c.to - c.from - (e.time.to - e.time.from);
        if (d < 0) return `«${entryTitle(plan, e)}» schrumpft · −${durationText(d)}`;
      }
    }
    return n === 0 ? '' : `Nachbarn passen sich an · ${String(n)}`;
  }

  function labelFor(l: Live, t: Target, a: Arrangement | null): string {
    const text = labelText(l, t, a);
    return copies(l) ? `${text} · Kopie` : text;
  }

  function labelText(l: Live, t: Target, a: Arrangement | null): string {
    const entry = l.entry;
    if (l.kind === 'band') {
      const end = addDays(l.originDay.date, t.dayOffset);
      const [from, to] = t.dayOffset < 0 ? [end, l.originDay.date] : [l.originDay.date, end];
      return `${formatDate(from, 'long').slice(0, 6)}–${formatDate(to, 'long').slice(0, 6)} · neuer Querbalken`;
    }
    if (l.kind === 'create' && l.special !== null) {
      const day = days.find((d) => d.date === t.date);
      return `${timeLabel(day?.weekday ?? l.originDay.weekday, t.date, t.from, t.to, [l.special.kind === 'rap' ? 'Rap' : 'Beso'])} · neuer ${l.special.kind === 'rap' ? 'Rapport' : 'Beso'}`;
    }
    if (entry?.type === 'querbalken') {
      const from = l.kind === 'right' ? entry.fromDate : addDays(entry.fromDate, t.dayOffset);
      const to = l.kind === 'left' ? entry.toDate : addDays(entry.toDate, t.dayOffset);
      return `${formatDate(from, 'long').slice(0, 6)}–${formatDate(to, 'long').slice(0, 6)} · Querbalken`;
    }
    const day = days.find((d) => d.date === t.date);
    const weekday = day?.weekday ?? l.originDay.weekday;
    const from = a?.target.from ?? t.from;
    const to = a?.target.to ?? t.to;
    // Marker: Art und Zeit, Tag, immer alle Planungsspalten (Runde 3, Marker-Zeitgriff).
    if (entry?.type === 'marker')
      return `${entry.kind === 'custom' ? entry.customKind : entry.kind} ${formatMilTime(from)} · ${weekday} ${formatDate(t.date, 'long').slice(0, 6)} · alle Planungsspalten`;
    const names =
      entry?.type === 'beso'
        ? [
            t.columnId === null
              ? 'Beso'
              : (day?.columns.find((c) => c.column.id === t.columnId)?.column.name ?? 'Beso'),
          ]
        : entry?.type === 'rapport'
          ? ['Rap']
          : columnNames(day, t.columns);
    const extra =
      a === null || (a.changes.length === 0 && a.splits.length === 0)
        ? l.parallelTo !== null
          ? ` · parallel zu «${l.parallelTo}»`
          : l.alt && entry?.type !== 'beso'
            ? ' · ohne Anpassung'
            : ''
        : ` · ${new Set([...a.changes.map((c) => c.id), ...a.splits.map((s) => s.sourceId)]).size} angepasst`;
    return `${timeLabel(weekday, t.date, from, to, names)}${extra}`;
  }

  function contentRect(t: Target, l: Live, a: Arrangement | null): Rect | null {
    const day = days.find((d) => d.date === t.date) ?? l.originDay;
    const entry = l.entry;
    let left: number;
    let width: number;
    let from = a?.target.from ?? t.from;
    let to = a?.target.to ?? t.to;
    if (entry?.type === 'querbalken' && l.view !== null) {
      return null;
    }
    if (entry?.type === 'rapport') {
      const rap = day.columns.find((c) => c.column.kind === 'rap');
      left = rap?.left ?? 0;
      width = rap?.width ?? 40;
      to = Math.max(to, from + 30);
    } else if (entry?.type === 'beso') {
      const col = day.columns.find((c) =>
        t.columnId === null ? c.column.kind === 'beso' : c.column.id === t.columnId,
      );
      left = col?.left ?? 0;
      width = col?.width ?? 40;
      const span =
        l.view === null ? { from, to } : { from: from, to: from + (l.view.to - l.view.from) };
      from = span.from;
      to = span.to;
    } else if (entry?.type === 'marker') {
      const r = columnsRect(plan, day, t.columns);
      left = r.left;
      width = r.width;
      return {
        left: AXIS_WIDTH + day.left + left,
        top: l.bodyTop + (from - plan.displayRange.from) * scale.minute - 6,
        width,
        height: 12,
      };
    } else {
      const r = columnsRect(plan, day, t.columns);
      left = r.left;
      width = r.width;
    }
    const top = Math.max(plan.displayRange.from, from);
    const bottom = Math.min(plan.displayRange.to, to);
    return {
      left: AXIS_WIDTH + day.left + left,
      top: l.bodyTop + (top - plan.displayRange.from) * scale.minute,
      width: Math.max(8, width - 2),
      height: Math.max(4, (bottom - top) * scale.minute),
    };
  }

  /**
   * Zeitschild am Zeiger nur über transform (eigene Ebene, kein Layout je Bild; F-UX3). Es folgt dem Zeiger mit einem
   * kurzen Übergang (CSS, 32 ms): als Animation des Compositors kostet die Bewegung je Bild keine neue Aufteilung der
   * Ebenen (Layerize), die bei 1000 Einträgen je Bild rund 3 ms kostete (F-PERF, FL2-04). Erstes Bild ohne Übergang.
   */
  function paintLabel(l: Live): void {
    const label = statusRef.current;
    if (label === null) return;
    const lx = Math.min(l.frame.windowWidth - 260, l.pointerX + 16);
    const ly = Math.min(l.frame.windowHeight - 30, l.pointerY + 20);
    if (l.labelPlaced !== true) {
      l.labelPlaced = true;
      label.classList.add('is-jump');
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => label.classList.remove('is-jump')),
      );
    }
    label.style.transform = `translate3d(${String(lx)}px, ${String(ly)}px, 0)`;
  }

  /** Lage unter dem Zeiger (Querbalkenband, Querbalken): wo es keine eingerastete Lage des Eintrags gibt. */
  function pointerRect(l: Live, hit: ReturnType<typeof hitAt>): Rect | null {
    const v = l.view;
    const dayLeft = AXIS_WIDTH + l.originDay.left;
    const pxX = hit.x + AXIS_WIDTH;
    if (l.kind === 'band') {
      const ox = dayLeft;
      const right = Math.max(pxX, ox + l.originDay.width);
      return {
        left: Math.min(ox, pxX),
        top: l.bodyTop,
        width: Math.abs(right - Math.min(ox, pxX)),
        height: 60 * scale.minute,
      };
    }
    if (v === null) return null;
    const ox = dayLeft + v.rect.left;
    const oy = l.bodyTop + v.rect.top;
    const dx = pxX - (l.originX - l.wrapper.left);
    if (l.kind === 'move')
      return { left: ox + dx, top: oy, width: v.rect.width, height: v.rect.height };
    if (l.kind === 'left')
      return {
        left: Math.min(pxX, ox + v.rect.width - 8),
        top: oy,
        width: Math.max(8, ox + v.rect.width - pxX),
        height: v.rect.height,
      };
    return { left: ox, top: oy, width: Math.max(8, pxX - ox), height: v.rect.height };
  }

  /**
   * Abbild eines gezeichneten Eintrags für den angehobenen Block (einmal je Geste, ohne Layout-Lesung): ohne Knöpfe
   * bzw. mit deren Inhalt als Text (`keepText`), ohne Kennungen und Zustände – zählt nirgends als Eintrag, nicht
   * bedienbar.
   */
  function liftCopy(source: HTMLElement, keepText: boolean): HTMLElement {
    const copy = source.cloneNode(true) as HTMLElement;
    for (const b of copy.querySelectorAll('button')) {
      if (!keepText) {
        b.remove();
        continue;
      }
      const s = document.createElement('span');
      s.className = b.className;
      const style = b.getAttribute('style');
      if (style !== null) s.setAttribute('style', style);
      s.append(...b.childNodes);
      b.replaceWith(s);
    }
    copy.classList.replace('i2-grid-entry', 'i2-lift-copy');
    for (const el of [copy, ...copy.querySelectorAll<HTMLElement>('*')]) {
      el.removeAttribute('id');
      el.removeAttribute('tabindex');
      el.removeAttribute('aria-describedby');
      el.removeAttribute('aria-label');
      el.removeAttribute('data-entry-id');
      el.removeAttribute('data-view-key');
      el.removeAttribute('data-hover');
    }
    copy.inert = true;
    copy.classList.remove(
      'is-dragged',
      'is-selected',
      'is-follow',
      'is-shift-follow',
      'is-adjust-follow',
    );
    copy.style.left = '0px';
    copy.style.top = '0px';
    copy.style.zIndex = '';
    copy.style.transform = '';
    copy.style.transition = '';
    copy.style.opacity = '1';
    return copy;
  }

  /** Teile des angehobenen Blocks (Runde 3, Variante B): Fläche, Schatten, Leuchtrahmen, vier Kanten, Text. */
  function liftParts(lift: HTMLElement) {
    const q = (c: string) => lift.querySelector<HTMLElement>(`.i2-lift-${c}`);
    return {
      z: q('z'),
      areas: [q('f'), q('sh'), q('gl')],
      top: q('et'),
      bottom: q('eb'),
      left: q('el'),
      right: q('er'),
      text: q('tx'),
    };
  }

  /**
   * Angehobener Block an der eingerasteten Lage (Runde 3, Entscheid 1a «Variante B»): rastet ein und gleitet in 110 ms
   * von Raster zu Raster (Übergang auf `transform`). Grundgrösse einmal je Geste; danach Lage nur `translate3d`, Grösse
   * nur `scale` der Fläche mit getrennten Kanten (oben/unten nur scaleX, links/rechts nur scaleY), damit die
   * Strichstärke gleich bleibt. Die Texthülle wird je Rasterschritt einmal gesetzt, nie animiert. Kein Layout lesen.
   */
  function paintLift(l: Live, rect: Rect): void {
    const lift = liftRef.current;
    if (lift === null) return;
    const parts = liftParts(lift);
    let base = l.liftBase;
    if (base === undefined) {
      base = { w: Math.max(1, rect.width), h: Math.max(1, rect.height) };
      l.liftBase = base;
      window.clearTimeout(liftTimer.current);
      lift.classList.remove('is-settle');
      // Erstes Bild ohne Übergang (kein Gleiten von der vorigen Geste her), danach mit (über zwei Bilder, ohne Reflow).
      lift.classList.add('is-jump');
      lift.dataset.kind = l.kind;
      lift.style.width = `${String(base.w)}px`;
      lift.style.height = `${String(base.h)}px`;
      const v = l.view;
      const fill = parts.areas[0];
      if (fill !== null && fill !== undefined) {
        fill.replaceChildren();
        fill.style.background = v === null ? '' : v.fill;
        // Verschieben: der angehobene Block sieht aus wie der Block (Abbild des gezeichneten Eintrags, einmal je Geste,
        // ohne Layout-Lesung); Grösse ändern: Fläche und Kanten (ein Abbild würde mitgestreckt).
        const source =
          l.kind === 'move' && v !== null && v.kind !== 'marker'
            ? entryButtons.current.get(itemKey(v))?.parentElement
            : undefined;
        if (source !== null && source !== undefined) fill.append(liftCopy(source, false));
        lift.classList.toggle('is-copy', source !== null && source !== undefined);
      }
      // Kante (UX-FUX3-01): der Text bleibt in eigener Ebene wie gezeichnet (Abbild der Zeilen der Layout-Schicht,
      // gleiche Schrift und Lage); nur Fläche und Kanten folgen per scale. Ohne Abbild der bisherige Titel.
      l.liftOrigin = undefined;
      if (parts.text !== null) {
        parts.text.replaceChildren();
        const textSource =
          l.kind !== 'move' && v !== null && v.kind !== 'marker'
            ? entryButtons.current.get(itemKey(v))?.parentElement
            : undefined;
        const origin =
          textSource === null || textSource === undefined
            ? null
            : contentRect({ ...l.base, columnId: null, dayOffset: 0 }, l, null);
        if (textSource !== null && textSource !== undefined && origin !== null) {
          const inner = document.createElement('span');
          inner.className = 'i2-lift-txin';
          inner.append(liftCopy(textSource, true));
          parts.text.append(inner);
          l.liftOrigin = { left: origin.left, top: origin.top };
        } else parts.text.textContent = v === null || v.kind === 'marker' ? '' : v.text;
        lift.classList.toggle('is-text', l.liftOrigin !== undefined);
      }
      lift.classList.toggle('is-create', v === null);
      // Marker: nur die Linie in der Modusfarbe (die Beschriftung steht im Zeitschild).
      lift.classList.toggle('is-marker', v?.kind === 'marker');
      // Anheben beim Verschieben: 1,015 um die Mitte (konstant je Geste).
      if (parts.z !== null)
        parts.z.style.transform =
          l.kind === 'move' && v !== null && v.kind !== 'marker'
            ? `translate(${String(base.w / 2)}px, ${String(base.h / 2)}px) scale(1.015) translate(${String(-base.w / 2)}px, ${String(-base.h / 2)}px)`
            : '';
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => lift.classList.remove('is-jump')),
      );
    }
    const before = l.liftRect;
    if (
      before !== undefined &&
      before.left === rect.left &&
      before.top === rect.top &&
      before.width === rect.width &&
      before.height === rect.height
    )
      return;
    l.liftRect = rect;
    const sx = rect.width / base.w;
    const sy = rect.height / base.h;
    lift.style.transform = `translate3d(${String(rect.left)}px, ${String(rect.top)}px, 0)`;
    for (const a of parts.areas)
      if (a !== null && a !== undefined) a.style.transform = `scale(${String(sx)}, ${String(sy)})`;
    if (parts.top !== null) parts.top.style.transform = `scaleX(${String(sx)})`;
    if (parts.bottom !== null)
      parts.bottom.style.transform = `translate3d(0, ${String(rect.height - 1)}px, 0) scaleX(${String(sx)})`;
    if (parts.left !== null) parts.left.style.transform = `scaleY(${String(sy)})`;
    if (parts.right !== null)
      parts.right.style.transform = `translate3d(${String(rect.width - 1)}px, 0, 0) scaleY(${String(sy)})`;
    if (
      parts.text !== null &&
      (before === undefined || before.width !== rect.width || before.height !== rect.height)
    ) {
      parts.text.style.width = `${String(rect.width)}px`;
      parts.text.style.height = `${String(rect.height)}px`;
    }
    // Textebene an der Lage beim Greifen (gleitet gegenläufig zum Block, steht also still); rückt die Kante nach innen
    // über den Beginn, wandert sie mit der Kante (UX-FUX3-01).
    const origin = l.liftOrigin;
    const inner = origin === undefined ? null : (parts.text?.firstElementChild ?? null);
    if (origin !== undefined && inner instanceof HTMLElement)
      inner.style.transform = `translate3d(${String(Math.max(0, origin.left - rect.left))}px, ${String(Math.max(0, origin.top - rect.top))}px, 0)`;
    if (lift.style.display !== 'block') lift.style.display = 'block';
    // Der gegriffene Griff bleibt an der Kante und folgt ihr (Runde 3, 5a).
    const grabbed = l.kind === 'move' && l.view?.kind === 'marker' ? 'marker' : l.kind;
    const el = gripRefs.current.get(grabbed as GripZone);
    if (el !== undefined && l.view !== null) {
      const g = gripsOf({ ...l.view, rect, hitRects: [] }).find((x) => x.zone === grabbed);
      if (g !== undefined) placeGrip(el, gripInside(g, rect));
    }
  }

  /** Auswahlrahmen (Shift+Ziehen, B2; auch auf einem Eintrag, 3a) in Inhaltskoordinaten des Rasters. */
  function marqueeRect(l: Live, hit: ReturnType<typeof hitAt>) {
    const ox = l.originX - l.wrapper.left;
    const oy = l.originY - l.wrapper.top;
    const px = hit.x + AXIS_WIDTH;
    const py = hit.y + l.bodyTop;
    return {
      left: Math.min(ox, px),
      top: Math.min(oy, py),
      width: Math.abs(px - ox),
      height: Math.abs(py - oy),
    };
  }

  function paintMarquee(l: Live, hit: ReturnType<typeof hitAt>): void {
    const lift = liftRef.current;
    if (lift === null) return;
    const r = marqueeRect(l, hit);
    lift.classList.add('is-marquee');
    lift.style.transform = `translate3d(${String(r.left)}px, ${String(r.top)}px, 0)`;
    lift.style.width = `${r.width}px`;
    lift.style.height = `${r.height}px`;
    lift.style.display = 'block';
    const count = viewsInRect({
      left: r.left - AXIS_WIDTH,
      top: r.top - l.bodyTop,
      width: r.width,
      height: r.height,
    }).length;
    setStatus(count === 1 ? '1 Eintrag im Rahmen' : `${count} Einträge im Rahmen`);
  }

  /** Einträge, deren Rechteck den Bereich schneidet (x ab Beginn des ersten Tags, y ab Anzeigebeginn). */
  function viewsInRect(r: Rect): readonly Selection[] {
    const out = new Map<string, Selection>();
    for (const day of days)
      for (const v of views.get(day.date) ?? []) {
        if (v.id.includes('~')) continue;
        const x = day.left + v.rect.left;
        const y = v.rect.top;
        const h = Math.max(v.rect.height, 4);
        if (
          x < r.left + r.width &&
          x + v.rect.width > r.left &&
          y < r.top + r.height &&
          y + h > r.top
        )
          out.set(itemKey(v), { id: v.id, windowId: v.windowId });
      }
    return [...out.values()];
  }

  /** Shift-Klick: alle Einträge im Rechteck zwischen dem zuletzt gewählten und dem angeklickten (UI-Richtlinie 5.1). */
  function selectBetween(from: Selection, to: EntryView, toDay: DayBox): void {
    let fromDay: DayBox | undefined;
    let fromView: EntryView | undefined;
    for (const d of days) {
      const v = (views.get(d.date) ?? []).find((x) => itemKey(x) === itemKey(from));
      if (v !== undefined) {
        fromDay = d;
        fromView = v;
        break;
      }
    }
    if (fromDay === undefined || fromView === undefined) {
      setSelected({ id: to.id, windowId: to.windowId });
      return;
    }
    const ax = fromDay.left + fromView.rect.left;
    const bx = toDay.left + to.rect.left;
    const left = Math.min(ax, bx);
    const top = Math.min(fromView.rect.top, to.rect.top);
    const found = viewsInRect({
      left,
      top,
      width: Math.max(ax + fromView.rect.width, bx + to.rect.width) - left,
      height:
        Math.max(fromView.rect.top + fromView.rect.height, to.rect.top + to.rect.height) - top,
    });
    const last = { id: to.id, windowId: to.windowId };
    setSelection([...found.filter((x) => itemKey(x) !== itemKey(last)), last]);
  }

  function process(l: Live, defer = false): void {
    if (l.cancelling) return;
    const hit = hitAt(l, l.pointerX, l.pointerY);
    if (!l.started) {
      if (Math.hypot(l.pointerX - l.originX, l.pointerY - l.originY) < 4) return;
      l.started = true;
      setHover(null);
      window.clearTimeout(hoverTimer.current);
      startAutoscroll();
      // Nur der gegriffene Griff bleibt sichtbar und folgt der Kante (Runde 3, 5a).
      const grabbed: GripZone | null =
        l.view?.kind === 'marker'
          ? 'marker'
          : l.kind === 'start' || l.kind === 'end' || l.kind === 'left' || l.kind === 'right'
            ? l.kind
            : null;
      for (const z of GRIP_ZONES) {
        const el = gripRefs.current.get(z);
        if (el === undefined) continue;
        if (z === grabbed) el.classList.add('is-on', 'is-hot', 'is-grab', 'is-follow');
        else el.classList.remove('is-on', 'is-hot', 'is-grab', 'is-follow');
      }
    }
    if (l.kind === 'marquee') {
      paintMarquee(l, hit);
      return;
    }
    paintLabel(l);
    // Querbalkenband und Querbalken folgen dem Zeiger; alles andere rastet ein (Variante B, 1a).
    const follows = l.kind === 'band' || l.entry?.type === 'querbalken';
    if (follows) {
      const r = pointerRect(l, hit);
      if (r !== null) paintLift(l, r);
    }
    const t = targetFor(l, hit);
    const key = `${t.date}|${t.from}|${t.to}|${JSON.stringify(t.columns)}|${t.columnId}|${t.dayOffset}|${t.dayLimit === true}|${l.shift}|${l.alt}|${l.ctrl}`;
    if (key === l.key && dragFeedback.get() !== null) return;
    l.key = key;
    l.target = t;
    const gesture = blockGesture(l, t);
    const arrangement = gesture === null ? null : arrangeBlocks(plan, gesture, modeOf(l));
    if (!follows) {
      const r = contentRect(t, l, arrangement) ?? pointerRect(l, hit);
      if (r !== null) paintLift(l, r);
    }
    const next: DragView = {
      kind: l.kind,
      entryId: l.entry?.id ?? null,
      windowId: l.windowId,
      entryKind: l.kind === 'create' ? 'create' : (l.view?.kind ?? 'block'),
      target: t,
      label: labelFor(l, t, arrangement),
      arrangement,
      mode: modeOf(l),
      badge: badgeFor(l, arrangement, t),
    };
    // Ziel und Zeiten zeichnet die Rückmeldung allein; das Raster nur bei geänderter Vorschau der Nachbarn (PERF).
    dragFeedback.set(next);
    // Auch ein Wechsel von Shift/Alt allein zeichnet das Raster neu (Hervorhebung der Nachbarn; F-UX3).
    const structure = `${modeOf(l)}|${
      arrangement === null
        ? ''
        : JSON.stringify([
            arrangement.changes,
            arrangement.splits,
            arrangement.dock ?? null,
            arrangement.shifts ?? null,
            arrangement.limit === true,
          ])
    }`;
    if (structure !== l.structure) {
      l.structure = structure;
      if (defer) {
        l.nextDrag = next;
        l.dragFrame ??= window.requestAnimationFrame(() => {
          l.dragFrame = undefined;
          const d = l.nextDrag;
          l.nextDrag = undefined;
          if (live.current === l && d !== undefined) setDrag(d);
        });
      } else {
        if (l.dragFrame !== undefined) window.cancelAnimationFrame(l.dragFrame);
        l.dragFrame = undefined;
        l.nextDrag = undefined;
        setDrag(next);
      }
    }
  }

  function startAutoscroll(): void {
    window.cancelAnimationFrame(autoscroll.current ?? 0);
    const tick = () => {
      const l = live.current;
      const node = scrollRef.current;
      if (l === null || node === null || l.cancelling) return;
      const r = l.frame;
      const headBottom = r.top + l.bodyTop;
      const left = r.left + AXIS_WIDTH;
      const right = r.left + r.width;
      const bottom = r.top + r.height;
      const vx =
        l.pointerX < left + 40
          ? -autoscrollSpeed(l.pointerX - left)
          : l.pointerX > right - 40
            ? autoscrollSpeed(right - l.pointerX)
            : 0;
      const vy =
        l.pointerY < headBottom + 40
          ? -autoscrollSpeed(l.pointerY - headBottom)
          : l.pointerY > bottom - 40
            ? autoscrollSpeed(bottom - l.pointerY)
            : 0;
      // Rolllage selbst führen (Runde 3): schreiben, nicht lesen.
      const now = l.scrollNow;
      const nextLeft =
        vx !== 0 && l.entry?.type !== 'marker'
          ? Math.min(l.scrollMax.left, Math.max(0, now.left + vx))
          : now.left;
      const nextTop =
        vy !== 0 && l.entry?.type !== 'querbalken'
          ? Math.min(l.scrollMax.top, Math.max(0, now.top + vy))
          : now.top;
      if (nextLeft !== now.left || nextTop !== now.top) {
        if (nextLeft !== now.left) node.scrollLeft = nextLeft;
        if (nextTop !== now.top) node.scrollTop = nextTop;
        l.scrollNow = { left: nextLeft, top: nextTop };
        process(l, true);
      }
      autoscroll.current = window.requestAnimationFrame(tick);
    };
    autoscroll.current = window.requestAnimationFrame(tick);
  }

  /**
   * Touch (UX-H-02; Beschrieb 11): Wischen rollt das Raster (touch-action pan-x pan-y), Tippen wirkt wie ein Klick
   * (wählen, Zellzeiger), Ändern (Verschieben, Grösse, Erfassen) erst nach einem Langdruck. Maus und Stift
   * unverändert. `start` erhält ein Abbild des Ereignisses beim Berühren.
   */
  function deferTouch(
    event: PointerEvent<HTMLElement>,
    start: (frozen: PointerEvent<HTMLElement>) => void,
    tap: ((frozen: PointerEvent<HTMLElement>) => void) | null,
  ): void {
    if (disabled || event.button !== 0) return;
    touchPending.current?.();
    const element = event.currentTarget;
    const target = event.target;
    const pointerId = event.pointerId;
    const x0 = event.clientX;
    const y0 = event.clientY;
    const frozen = (): PointerEvent<HTMLElement> =>
      ({
        button: 0,
        buttons: 1,
        pointerId,
        pointerType: 'touch',
        clientX: x0,
        clientY: y0,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        shiftKey: false,
        currentTarget: element,
        target,
        preventDefault: () => undefined,
        stopPropagation: () => undefined,
      }) as unknown as PointerEvent<HTMLElement>;
    const run = (fn: (e: PointerEvent<HTMLElement>) => void): void => {
      touchGated.current = true;
      try {
        fn(frozen());
      } finally {
        touchGated.current = false;
      }
    };
    const stop = (): void => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', up, true);
      window.removeEventListener('pointercancel', stop, true);
      if (touchPending.current === stop) touchPending.current = null;
    };
    const move = (e: globalThis.PointerEvent): void => {
      if (e.pointerId === pointerId && Math.hypot(e.clientX - x0, e.clientY - y0) > TOUCH_SLOP)
        stop();
    };
    const up = (e: globalThis.PointerEvent): void => {
      if (e.pointerId !== pointerId) return;
      stop();
      if (tap !== null) run(tap);
    };
    const timer = window.setTimeout(() => {
      stop();
      touchDrag.current = true;
      run(start);
    }, LONG_PRESS_MS);
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', up, true);
    window.addEventListener('pointercancel', stop, true);
    touchPending.current = stop;
  }

  // ---------------------------------------------------------------------------------------------
  // Treffen, Zeiger und Hervorhebung (F-UX2 P4; Gestaltung raster-bedienung-v2 §2)
  // ---------------------------------------------------------------------------------------------

  /** Eintrag und Zone unter dem Zeiger im Tag, aus der Geometrie der Ansichten (nicht aus der Stapelung). */
  function hitInDay(
    day: DayBox,
    body: HTMLElement,
    clientX: number,
    clientY: number,
    withGrips = true,
  ): Hit | null {
    const r = body.getBoundingClientRect();
    const only = selection.length === 1 && selected !== null ? itemKey(selected) : null;
    // Griffe zählen nur, wo sie sichtbar am überfahrenen Eintrag stehen; nach Zoom bzw. Planänderung unter dem ruhenden
    // Zeiger zählt allein der Eintrag (CR-U-2-07).
    const hovered = withGrips && hoverByPointer.current ? (hoverStore.get()?.key ?? null) : null;
    return hitEntry(
      sortedViews(views.get(day.date)),
      clientX - r.left,
      clientY - r.top,
      only,
      hovered,
    );
  }

  function inEditor(target: EventTarget | null): boolean {
    return target instanceof Element && target.closest('.i2-grid-editing') !== null;
  }

  /** Drücken im Tag: Eintrag nach Treffer, sonst leere Fläche der Spalte unter dem Zeiger (Mindest-Trefferbreite). */
  function bodyPointerDown(event: PointerEvent<HTMLElement>, day: DayBox): void {
    if (event.button !== 0 || inEditor(event.target)) return;
    const body = event.currentTarget;
    cancelHoverFrame();
    // Treffer mit den Griffen des überfahrenen Eintrags (Runde 3), erst danach den Zustand «über» löschen.
    const hit = hitInDay(day, body, event.clientX, event.clientY);
    paintHover(null, body);
    setHoverZone(null);
    if (hit !== null) {
      event.stopPropagation();
      // Zone des ersten Drückens für einen folgenden Doppelklick (CR-U-2-04).
      // (PointerEvent.detail ist im Browser 0: das zweite Drücken eines Doppelklicks erkennt die Zeit.)
      const prev = firstPress.current;
      const pressed = itemKey(hit.view);
      const second =
        prev !== null &&
        prev.key === pressed &&
        Date.now() - prev.at <= 500 &&
        Math.hypot(event.clientX - prev.x, event.clientY - prev.y) <= 4;
      if (!second)
        firstPress.current = {
          key: pressed,
          zone: hit.zone,
          at: Date.now(),
          x: event.clientX,
          y: event.clientY,
        };
      beginGesture(event, day, hit.zone === 'body' ? 'move' : hit.zone, hit.view);
      // Zeiger am Knopf des getroffenen Eintrags festhalten: Klick und Doppelklick gehen an ihn (nicht an den Tag).
      const button = entryButtons.current.get(itemKey(hit.view));
      if (live.current !== null && button !== undefined && button.isConnected)
        button.setPointerCapture(event.pointerId);
      return;
    }
    // Leere Fläche: massgebend ist die Spalte unter dem Zeiger mit Mindest-Trefferbreite (wie Mauszeiger und
    // Zellzeiger; CR-U-2-03). Der Knopf dieser Spalte erfasst selbst; sonst (Nachbarknopf, Eintragsbeschriftung) der Tag.
    const col = emptyColumnAt(day, body, event.clientX);
    if (col === undefined || ownEmptyButton(event.target, col.column.id)) return;
    event.stopPropagation();
    const special = col.column.kind === 'rap' || col.column.kind === 'beso' ? col.column : null;
    beginGesture(event, day, 'create', null, special);
  }

  /** Spalte unter dem Zeiger im Tag (Mindest-Trefferbreite); ohne Spaltensatz keine. */
  function emptyColumnAt(day: DayBox, body: HTMLElement, clientX: number) {
    if (day.planning.length === 0) return undefined;
    return day.columns[columnAt(day.columns, clientX - body.getBoundingClientRect().left)];
  }

  /** Der Knopf der leeren Fläche unter dem Zeiger gehört zur Spalte `columnId`. */
  function ownEmptyButton(target: EventTarget | null, columnId: Id): boolean {
    if (!(target instanceof Element)) return false;
    const button = target.closest<HTMLElement>('[data-empty-column]');
    return button !== null && button.dataset.emptyColumn === columnId;
  }

  /**
   * Doppelklick im Tag: Kante oben/unten füllt auf (P5), sonst Direktbearbeitung des getroffenen Eintrags. Die Zone gilt
   * wie beim ersten Drücken (Auswahl vergrössert die Kante erst danach; CR-U-2-04). Leere Fläche: Spalte unter dem
   * Zeiger (CR-U-2-03).
   */
  function bodyDoubleClick(event: MouseEvent<HTMLElement>, day: DayBox): void {
    if (inEditor(event.target)) return;
    const body = event.currentTarget;
    const hit = hitInDay(day, body, event.clientX, event.clientY);
    if (hit === null) {
      const col = emptyColumnAt(day, body, event.clientX);
      if (col === undefined || ownEmptyButton(event.target, col.column.id)) return;
      event.stopPropagation();
      event.preventDefault();
      if (col.column.kind === 'rap' || col.column.kind === 'beso') {
        const cell = cellAt(event, day, col.column.id);
        if (cell === null) return;
        moveCursorTo(cell, false);
        startDraft(
          {
            date: day.date,
            from: cell.minute,
            to: cell.minute + 30,
            columns: { kind: 'ids', ids: [col.column.id] },
          },
          col.column.kind === 'rap' ? 'rapport' : 'beso',
          'adjust',
        );
      } else setStatus(`Leere Fläche ${col.column.name}: Zum Erfassen ziehen oder Enter.`);
      return;
    }
    event.stopPropagation();
    event.preventDefault();
    const entry = plan.entries[hit.view.id];
    if (entry === undefined) return;
    const first = firstPress.current;
    const zone =
      first !== null &&
      first.key === itemKey(hit.view) &&
      Date.now() - first.at < 800 &&
      Math.hypot(event.clientX - first.x, event.clientY - first.y) <= 4
        ? first.zone
        : hit.zone;
    if ((zone === 'start' || zone === 'end') && entry.type === 'block') {
      fillBlock(entry, zone);
      return;
    }
    startEdit(entry, undefined, hit.view.windowId);
  }

  /** Rahmen um den Eintrag, den ein Drücken treffen würde, und Balken an der Kantenzone (ohne Neuzeichnen). */
  function paintHover(
    hit: Hit | null,
    body: HTMLElement,
    rects?: { readonly wrapper: DOMRect; readonly body: DOMRect },
  ): void {
    const node = hoverRef.current;
    const wrapper = wrapperRef.current;
    if (node === null || wrapper === null) return;
    if (hit === null) {
      hoverPainted.current = '';
      if (node.style.display !== 'none') node.style.display = 'none';
      return;
    }
    const w = rects?.wrapper ?? wrapper.getBoundingClientRect();
    const b = rects?.body ?? body.getBoundingClientRect();
    const r = hit.view.rect;
    const x = b.left - w.left + r.left;
    const y = b.top - w.top + r.top;
    // Stil nur bei geänderter Lage schreiben (F-UX3: keine Layoutarbeit je Mausbewegung); die Zone nur als Attribut.
    const painted = `${String(x)}:${String(y)}:${String(r.width)}:${String(r.height)}`;
    if (hoverPainted.current !== painted || node.style.display === 'none') {
      hoverPainted.current = painted;
      node.style.display = 'block';
      node.style.transform = `translate(${String(x)}px, ${String(y)}px)`;
      node.style.width = `${String(Math.max(2, r.width))}px`;
      node.style.height = `${String(Math.max(2, r.height))}px`;
    }
    if (node.dataset.zone !== hit.zone) node.dataset.zone = hit.zone;
    // Marker: hellblaues Band auf der Linie statt Rahmen (Runde 3).
    if (node.dataset.kind !== hit.view.kind) node.dataset.kind = hit.view.kind;
  }

  /**
   * Eintrag und Zone unter dem Zeiger als Zustand (Ereignis nur bei Wechsel; F-UX3). `offset` = Lage des Tags im
   * Raster (Inhaltskoordinaten), damit die Griffe ohne Layout-Lesung gesetzt werden.
   */
  function setHoverZone(
    hit: Hit | null,
    offset?: { readonly x: number; readonly y: number },
  ): void {
    if (hit === null) {
      hoverStore.set(null);
      return;
    }
    const key = itemKey(hit.view);
    const now = hoverStore.get();
    const o = offset ?? {
      x: now?.key === key ? now.rect.left - hit.view.rect.left : 0,
      y: now?.key === key ? now.rect.top - hit.view.rect.top : 0,
    };
    // Marker: Linie statt Fläche (Zeitgriff mitten auf der Linie, Runde 3).
    const r =
      hit.view.kind === 'marker'
        ? { ...markerLine(hit.view), left: hit.view.rect.left, width: hit.view.rect.width }
        : hit.view.rect;
    const rect = { left: o.x + r.left, top: o.y + r.top, width: r.width, height: r.height };
    if (
      now !== null &&
      now.key === key &&
      now.zone === hit.zone &&
      now.rect.left === rect.left &&
      now.rect.top === rect.top &&
      now.rect.width === rect.width &&
      now.rect.height === rect.height
    )
      return;
    hoverStore.set({
      key,
      id: hit.view.id,
      windowId: hit.view.windowId,
      zone: hit.zone,
      kind: hit.view.kind,
      rect,
    });
  }

  /** Lage von Raster und Tag aus dem Zwischenspeicher (einmal gelesen, F-UX3). */
  function hoverRects(
    date: IsoDate,
    body: HTMLElement,
  ): { readonly wrapper: DOMRect; readonly body: DOMRect } | null {
    const wrapper = wrapperRef.current;
    if (wrapper === null) return null;
    let g = hoverGeo.current;
    if (g === null) {
      g = { wrapper: wrapper.getBoundingClientRect(), bodies: new Map() };
      hoverGeo.current = g;
    }
    let b = g.bodies.get(date);
    if (b === undefined) {
      b = body.getBoundingClientRect();
      g.bodies.set(date, b);
    }
    return { wrapper: g.wrapper, body: b };
  }

  function cancelHoverFrame(): void {
    if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current);
    hoverFrame.current = null;
    hoverPending.current = false;
  }

  /**
   * Zeiger über dem Tag: Treffer, Mauszeiger je Zone, Hervorhebung und Zustand «über» höchstens einmal je Bild (F-UX3,
   * Leistungsbudget wie beim Ziehen): die erste Bewegung sofort, weitere im selben Bild nur gemerkt und am nächsten
   * Bildbeginn mit der letzten Lage ausgewertet. Gilt für jeden Eintrag, nicht nur den gewählten.
   */
  function bodyPointerMove(event: PointerEvent<HTMLElement>, day: DayBox): void {
    if (live.current !== null || event.pointerType === 'touch') return;
    lastHover.current = { x: event.clientX, y: event.clientY };
    hoverAt.current = {
      day,
      body: event.currentTarget,
      x: event.clientX,
      y: event.clientY,
      editor: inEditor(event.target),
    };
    if (hoverFrame.current !== null) {
      hoverPending.current = true;
      return;
    }
    hoverNow();
    hoverFrame.current = requestAnimationFrame(() => {
      hoverFrame.current = null;
      if (!hoverPending.current) return;
      hoverPending.current = false;
      hoverTick.current();
    });
  }

  function hoverNow(): void {
    const at = hoverAt.current;
    if (at === null || live.current !== null) return;
    const { day, body } = at;
    if (at.editor) {
      paintHover(null, body);
      setHoverZone(null);
      return;
    }
    const rects = hoverRects(day.date, body);
    if (rects === null) return;
    const only = selection.length === 1 && selected !== null ? itemKey(selected) : null;
    const x = at.x - rects.body.left;
    const hovered = hoverByPointer.current ? (hoverStore.get()?.key ?? null) : null;
    const hit = hitEntry(sortedViews(views.get(day.date)), x, at.y - rects.body.top, only, hovered);
    let cursor: string = ZONE_CURSOR.empty;
    if (hit !== null)
      cursor = hit.view.kind === 'marker' ? ZONE_CURSOR.marker : ZONE_CURSOR[hit.zone];
    else {
      const col = day.columns[columnAt(day.columns, x)];
      if (col !== undefined && (col.column.kind === 'rap' || col.column.kind === 'beso'))
        cursor = ZONE_CURSOR.special;
    }
    if (body.style.cursor !== cursor) body.style.cursor = cursor;
    paintHover(editing === null ? hit : null, body, rects);
    hoverByPointer.current = hit !== null;
    setHoverZone(editing === null ? hit : null, {
      x: rects.body.left - rects.wrapper.left,
      y: rects.body.top - rects.wrapper.top,
    });
    const key = hit === null ? null : itemKey(hit.view);
    if (key === hoverKey.current) return;
    hoverKey.current = key;
    hoverEnd();
    const button = key === null ? undefined : entryButtons.current.get(key);
    if (hit !== null && button !== undefined) hoverLater(hit.view, button, HOVER_DELAY);
  }
  const hoverTick = useLatest(hoverNow);
  useEffect(
    () => () => {
      if (hoverFrame.current !== null) cancelAnimationFrame(hoverFrame.current);
    },
    [],
  );

  function bodyPointerLeave(body: HTMLElement): void {
    lastHover.current = null;
    hoverKey.current = null;
    hoverAt.current = null;
    hoverGeo.current = null;
    cancelHoverFrame();
    paintHover(null, body);
    setHoverZone(null);
    if (live.current === null) hoverEnd();
  }

  /** Hervorhebung nach Planänderung, Zoom und Rollen aus der letzten Zeigerlage neu (CR-U-2-07). */
  function repaintHover(): void {
    hoverGeo.current = null;
    const at = lastHover.current;
    const wrapper = wrapperRef.current;
    if (at === null || wrapper === null || live.current !== null) return;
    for (const day of days) {
      const body = wrapper.querySelector<HTMLElement>(`[data-day="${day.date}"]`);
      const r = body?.getBoundingClientRect();
      if (body === null || body === undefined || r === undefined) continue;
      if (at.x < r.left || at.x >= r.right || at.y < r.top || at.y >= r.bottom) continue;
      const hit = hitInDay(day, body, at.x, at.y, false);
      hoverByPointer.current = false;
      hoverKey.current = hit === null ? null : itemKey(hit.view);
      paintHover(editing === null ? hit : null, body);
      const w = wrapper.getBoundingClientRect();
      setHoverZone(editing === null ? hit : null, { x: r.left - w.left, y: r.top - w.top });
      return;
    }
    const node = hoverRef.current;
    if (node !== null) node.style.display = 'none';
    hoverPainted.current = '';
    setHoverZone(null);
  }
  const repaint = useLatest(repaintHover);
  // biome-ignore lint/correctness/useExhaustiveDependencies: neu bei geänderten Ansichten und Massstab
  useEffect(() => {
    repaint.current();
  }, [views, scale]);
  useEffect(() => {
    const node = scrollRef.current;
    if (node === null) return;
    const onScroll = () => {
      // Während einer Geste: Rolllage im Scroll-Ereignis nachführen (z.B. Mausrad), nicht je Bild lesen (Runde 3).
      const l = live.current;
      if (l !== null && !l.cancelling) {
        l.scrollNow = { left: node.scrollLeft, top: node.scrollTop };
        return;
      }
      repaint.current();
    };
    // Lage des Rasters ändert sich auch durch Rollen der Seite und Grössenänderungen (F-UX3: Zwischenspeicher).
    const drop = () => {
      hoverGeo.current = null;
    };
    node.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('scroll', drop, { passive: true, capture: true });
    window.addEventListener('resize', drop);
    // Das Raster kann sich ohne Zoomwechsel verschieben (Fenstergrösse, Seitenfeld bzw. Seitenleiste auf/zu, Leisten
    // umbrechen; CR-F3-05): bei jeder Grössenänderung des Rasters, seiner Umgebung oder der Seite die gespeicherten
    // Lagen verwerfen und die Hervorhebung unter dem ruhenden Zeiger neu bestimmen (nie je Mausbewegung).
    const relayout = () => {
      drop();
      if (live.current === null) repaint.current();
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(relayout);
    for (const el of [
      node,
      node.parentElement,
      node.closest('.i2-grid-editor'),
      document.body,
      document.documentElement,
    ])
      if (el !== null) observer?.observe(el);
    return () => {
      node.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', drop, { capture: true });
      window.removeEventListener('resize', drop);
      observer?.disconnect();
    };
  }, [repaint]);

  /**
   * Doppelklick auf die obere bzw. untere Kante (F-UX2 P5): bis zum Ende des vorangehenden bzw. Beginn des folgenden
   * Blocks, der mindestens eine Spalte teilt, sonst bis zum Rasterbeginn unter dem Band bzw. zum Ende des
   * Anzeigebereichs. Nachbarn nach Variante c, ein Undo-Schritt.
   */
  function fillBlock(entry: Block, edge: 'start' | 'end'): void {
    if (disabled) return;
    if (entry.time.form !== 'range') {
      setStatus(
        'Auffüllen geht nur bei Blöcken mit Beginn und Ende. Zeit im Seitenfeld anpassen (Z).',
      );
      return;
    }
    const target = fillTarget(plan, entry, edge);
    const span = blockSpan(entry.time, plan);
    if (edge === 'start' ? target >= span.from : target <= span.to) {
      setStatus(
        `«${entryTitle(plan, entry)}» grenzt ${edge === 'start' ? 'oben' : 'unten'} schon an: nichts aufzufüllen.`,
      );
      return;
    }
    const id = entry.id;
    const date = entry.date;
    keepSelection.current = true;
    setSelected({ id, windowId: null });
    dispatch(
      (document, context) =>
        applyArrangement(
          document,
          { kind: edge, blockId: id, edge: target },
          'adjust',
          (p, time) => ({
            ...updateEntry(
              p,
              id,
              'block',
              { date, time: { form: 'range', from: time.from, to: time.to } },
              context,
            ),
            entryId: id,
          }),
          context,
        ),
      id,
    );
    setStatus(
      `«${entryTitle(plan, entry)}» ${edge === 'start' ? 'beginnt' : 'endet'} jetzt ${formatMilTime(target)}.`,
    );
  }

  function beginGesture(
    event: PointerEvent<HTMLElement>,
    day: DayBox,
    requested: GestureKind,
    clicked: EntryView | null,
    special: Column | null = null,
  ): void {
    if (disabled || event.button !== 0) return;
    if (event.pointerType === 'touch' && !touchGated.current) {
      deferTouch(
        event,
        (frozen) => beginGesture(frozen, day, requested, clicked, special),
        (frozen) => {
          // Tippen: wie ein Klick ohne Ziehen (wählen bzw. Zellzeiger setzen).
          beginGesture(frozen, day, requested, clicked, special);
          pointerUp(frozen);
        },
      );
      return;
    }
    if (clicked?.id.includes('~')) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const clickedEntry = clicked === null ? null : (plan.entries[clicked.id] ?? null);
    // Alt+Ziehen auf einem Block erzeugt einen parallelen Block bzw. eine Ausnahme (B8; Beschrieb 5.1, 4.6).
    const altCreate = event.altKey && requested === 'move' && clickedEntry?.type === 'block';
    const view = altCreate ? null : clicked;
    const entry = altCreate ? null : clickedEntry;
    // Shift beim Drücken (3a, präzisiert Runde 4, Koordinator 21.10.2026): auf leerer Fläche Auswahlrahmen; auf einem
    // Eintrag wählt ein Klick ohne Ziehen den Bereich, sobald gezogen wird, schiebt Shift sofort mit.
    const kind: GestureKind = altCreate
      ? 'create'
      : event.shiftKey && view === null
        ? 'marquee'
        : requested;
    if (live.current?.cancelling) endGesture();
    const scroller = scrollRef.current;
    const wrapper = wrapperRef.current;
    const body = wrapper?.querySelector(`[data-day="${day.date}"]`);
    if (scroller === null || wrapper === null || !(body instanceof HTMLElement)) return;
    event.stopPropagation();
    const element = event.currentTarget;
    // Ein Klick wählt und setzt den Fokus auf genau diesen Eintrag (A1); Ziehen ohne Textauswahl.
    event.preventDefault();
    let clickMode: Live['clickMode'] = 'plain';
    let group: readonly Id[] = [];
    if (view !== null) {
      const key = itemKey(view);
      const inSelection = selection.some((x) => itemKey(x) === key);
      if (ctrl) {
        // Ctrl-Klick nimmt auf oder heraus (B2).
        clickMode = 'toggle';
        const next = inSelection
          ? selection.filter((x) => itemKey(x) !== key)
          : [...selection, { id: view.id, windowId: view.windowId }];
        setSelection(next);
        group = [...new Set(next.map((x) => x.id))];
      } else if (event.shiftKey && selection.length > 0) {
        clickMode = 'range';
        group = [view.id];
      } else if (inSelection && selection.length > 1) {
        // Ziehen verschiebt die ganze Auswahl; ein Klick ohne Ziehen wählt beim Loslassen nur diesen Eintrag.
        clickMode = 'keep';
        group = [...selectedIds];
        setSelection([
          ...selection.filter((x) => itemKey(x) !== key),
          { id: view.id, windowId: view.windowId },
        ]);
      } else {
        setSelected({ id: view.id, windowId: view.windowId });
        group = [view.id];
      }
      keepSelection.current = clickMode !== 'plain';
      entryButtons.current.get(key)?.focus({ preventScroll: true });
      keepSelection.current = false;
    } else {
      if (kind !== 'marquee') setSelected(null);
      // Klick auf leere Fläche setzt den Zellzeiger (UI-Richtlinie 5.1).
      const rect = wrapper.getBoundingClientRect();
      const bodyTopNow = body.getBoundingClientRect().top - rect.top;
      const minuteAt =
        plan.displayRange.from + (event.clientY - rect.top - bodyTopNow) / scale.minute;
      const x = event.clientX - rect.left - AXIS_WIDTH - day.left;
      const columnIndex = Math.max(0, columnAt(day.columns, x));
      const cell = normalizeCursor(
        { date: day.date, minute: minuteAt, column: columnIndex },
        days,
        bounds,
      );
      if (cell !== null) {
        if (event.shiftKey && kind !== 'marquee') moveCursorTo(cell, false, true);
        else moveCursorTo(cell, false);
      }
      setFocusKey('cursor');
      cursorRef.current?.focus({ preventScroll: true });
    }
    // Eine eben übernommene Bearbeitung darf den Fokus nicht zurückholen: der Klick bestimmt ihn.
    setPendingFocus(null);
    element.setPointerCapture(event.pointerId);
    draggedClick.current = false;
    const wrapperRect = wrapper.getBoundingClientRect();
    const bodyTop = body.getBoundingClientRect().top - wrapperRect.top;
    const scrollerRect = scroller.getBoundingClientRect();
    const pre: Pick<Live, 'wrapper' | 'scroll0' | 'scrollNow' | 'scrollMax' | 'bodyTop' | 'frame'> =
      {
        wrapper: { left: wrapperRect.left, top: wrapperRect.top },
        scroll0: { left: scroller.scrollLeft, top: scroller.scrollTop },
        scrollNow: { left: scroller.scrollLeft, top: scroller.scrollTop },
        scrollMax: {
          left: Math.max(0, scroller.scrollWidth - scroller.clientWidth),
          top: Math.max(0, scroller.scrollHeight - scroller.clientHeight),
        },
        bodyTop,
        frame: {
          left: scrollerRect.left,
          top: scrollerRect.top,
          width: scroller.clientWidth,
          height: scroller.clientHeight,
          windowWidth: window.innerWidth,
          windowHeight: window.innerHeight,
        },
      };
    const minute =
      plan.displayRange.from + (event.clientY - wrapperRect.top - bodyTop) / scale.minute;
    const inDay = event.clientX - wrapperRect.left - AXIS_WIDTH - day.left;
    const column = Math.max(0, columnAt(day.planning, inDay));
    let base: Placement;
    if (entry === null) {
      base = {
        date: day.date,
        ...drawingTime(minute, minute),
        columns: columnsBetween(
          day.columns.map((c) => c.column),
          column,
          column,
        ),
      };
    } else if (entry.type === 'block') {
      base = { date: entry.date, ...blockSpan(entry.time, plan), columns: entry.columns };
    } else if (entry.type === 'rapport') {
      base = { date: entry.date, ...rapportSpan(entry.time), columns: { kind: 'all' } };
    } else if (entry.type === 'marker') {
      base = { date: entry.date, from: entry.at, to: entry.at, columns: entry.columns };
    } else if (entry.type === 'beso') {
      base = {
        date: entry.date,
        from: view?.from ?? 0,
        to: view?.to ?? 30,
        columns: { kind: 'all' },
      };
    } else if (entry.type === 'querbalken') {
      base = { date: day.date, from: 0, to: 0, columns: entry.columns };
    } else return;
    if (special !== null && entry === null)
      base = { ...base, columns: { kind: 'ids', ids: [special.id] } };
    const target: Target = { ...base, columnId: null, dayOffset: 0 };
    // Ziehen im Band über 0500 erzeugt einen Querbalken über die überstrichenen Tage (R-5.1-24, UI-Richtlinie 5.2).
    const inBand =
      kind === 'create' &&
      entry === null &&
      special === null &&
      !altCreate &&
      minute < plan.displayRange.from + 60;
    live.current = {
      kind: inBand ? 'band' : kind,
      special: entry === null && kind === 'create' ? special : null,
      clickMode,
      group,
      parallelTo:
        altCreate && clickedEntry !== null ? entryTitle(plan, clickedEntry) || 'Block' : null,
      entry,
      windowId: view?.windowId ?? null,
      view,
      originDay: day,
      originMinute: minute,
      originColumn: column,
      originX: event.clientX,
      originY: event.clientY,
      ...pre,
      base,
      element,
      pointerId: event.pointerId,
      started: false,
      structure: null,
      target,
      key: '',
      shift: event.shiftKey,
      alt: event.altKey,
      ctrl: ctrl,
      pointerX: event.clientX,
      pointerY: event.clientY,
      cancelling: false,
    };
    modifierStore.set({ shift: event.shiftKey, alt: event.altKey, ctrl });
    setError('');
  }

  function pointerMove(event: PointerEvent<HTMLElement>): void {
    // Lage des Mauszeigers für «Einfügen am Mauszeiger» (B3); nur ein Wert, kein Neuzeichnen.
    lastPointer.current = { x: event.clientX, y: event.clientY, at: Date.now() };
    const l = live.current;
    if (l === null) return;
    l.pointerX = event.clientX;
    l.pointerY = event.clientY;
    setModifiers(l, event.shiftKey, event.altKey, event.ctrlKey || event.metaKey, false);
    schedule(l);
  }

  /** Je Bild einmal verarbeiten (requestAnimationFrame-Takt; F-UX3): Zeigerereignisse dazwischen nur merken. */
  function schedule(l: Live): void {
    if (l.pending !== undefined) return;
    l.pending = window.requestAnimationFrame(() => {
      l.pending = undefined;
      if (live.current === l) process(l, true);
    });
  }

  /**
   * Zustand Shift/Alt/Ctrl der Geste (F-UX3): ändert er sich, sofort neu bewerten (Vorschau, Zeitschild, Ansage) –
   * auch beim Drücken oder Loslassen ohne Mausbewegung. `now` verarbeitet sofort statt im nächsten Bild.
   */
  function setModifiers(l: Live, shift: boolean, alt: boolean, ctrl: boolean, now: boolean): void {
    if (l.shift === shift && l.alt === alt && l.ctrl === ctrl) return;
    if (l.shift !== shift || l.alt !== alt) {
      modeJump.current = true;
      window.requestAnimationFrame(() =>
        window.requestAnimationFrame(() => {
          modeJump.current = false;
        }),
      );
      const lift = liftRef.current;
      if (lift !== null && l.started) {
        lift.classList.add('is-jump');
        window.requestAnimationFrame(() =>
          window.requestAnimationFrame(() => lift.classList.remove('is-jump')),
        );
      }
    }
    l.shift = shift;
    l.alt = alt;
    l.ctrl = ctrl;
    modifierStore.set({ shift, alt, ctrl });
    if (now) {
      if (l.pending !== undefined) {
        window.cancelAnimationFrame(l.pending);
        l.pending = undefined;
      }
      process(l);
    }
  }

  /**
   * Geste beenden. `settle`: der angehobene Block blendet an der Endlage in 180 ms aus (Einschwingen, Variante B), der
   * Eintrag steht dort sofort; sonst sofort ausblenden.
   */
  function endGesture(settle = false): void {
    window.cancelAnimationFrame(autoscroll.current ?? 0);
    const lift = liftRef.current;
    if (lift !== null) {
      lift.style.transition = '';
      lift.classList.remove('is-marquee');
      window.clearTimeout(liftTimer.current);
      const clear = () => {
        lift.style.display = 'none';
        lift.classList.remove('is-settle', 'is-copy');
        lift.querySelector('.i2-lift-f')?.replaceChildren();
      };
      if (settle && lift.style.display === 'block' && !reducedMotion()) {
        lift.classList.add('is-settle');
        liftTimer.current = window.setTimeout(clear, SETTLE_MS);
      } else clear();
    }
    for (const el of gripRefs.current.values()) el.classList.remove('is-grab', 'is-follow');
    const label = statusRef.current;
    if (label !== null) {
      // Zurück ohne Gleiten (das Schild verlässt die Lage sofort; F-PERF).
      label.classList.add('is-jump');
      label.style.transform = '';
    }
    if (live.current?.pending !== undefined) window.cancelAnimationFrame(live.current.pending);
    if (live.current?.dragFrame !== undefined) window.cancelAnimationFrame(live.current.dragFrame);
    live.current = null;
    touchDrag.current = false;
    setDrag(null);
    dragFeedback.set(null);
  }

  function pointerUp(event: PointerEvent<HTMLElement>): void {
    const l = live.current;
    if (l === null) return;
    if (l.cancelling) return;
    if (l.pending !== undefined) {
      window.cancelAnimationFrame(l.pending);
      l.pending = undefined;
    }
    l.shift = event.shiftKey;
    l.alt = event.altKey;
    l.ctrl = event.ctrlKey || event.metaKey;
    if (!l.started) {
      if (l.view !== null && l.clickMode === 'keep')
        setSelected({ id: l.view.id, windowId: l.view.windowId });
      if (l.view !== null && l.clickMode === 'range' && selected !== null)
        selectBetween(selected, l.view, l.originDay);
      endGesture();
      return;
    }
    l.pointerX = event.clientX;
    l.pointerY = event.clientY;
    if (l.kind === 'marquee') {
      const r = marqueeRect(l, hitAt(l, l.pointerX, l.pointerY));
      const found = viewsInRect({
        left: r.left - AXIS_WIDTH,
        top: r.top - l.bodyTop,
        width: r.width,
        height: r.height,
      });
      draggedClick.current = true;
      endGesture();
      setSelection(found);
      setStatus(found.length === 1 ? '1 Eintrag gewählt' : `${found.length} Einträge gewählt`);
      const last = found[found.length - 1];
      if (last !== undefined) {
        keepSelection.current = true;
        setPendingFocus(itemKey(last));
      }
      return;
    }
    const t = targetFor(l, hitAt(l, l.pointerX, l.pointerY));
    draggedClick.current = true;
    const mode = modeOf(l);
    const entry = l.entry;
    // Einschwingen (Variante B): der angehobene Block blendet an der Endlage aus, der Eintrag steht dort sofort.
    endGesture(entry !== null);
    if (disabled) return;
    if (l.kind === 'band') {
      const end = addDays(l.originDay.date, t.dayOffset);
      const [from, to] = t.dayOffset < 0 ? [end, l.originDay.date] : [l.originDay.date, end];
      setCreating({ kind: 'querbalken', from, to });
      return;
    }
    if (l.kind === 'create' && l.special !== null) {
      startDraft(
        { ...t, to: Math.max(t.to, t.from + 30) },
        l.special.kind === 'rap' ? 'rapport' : 'beso',
        mode,
      );
      return;
    }
    if (l.kind === 'create') {
      startDraft(t, 'block', mode);
      if (l.parallelTo !== null) swallowAlt.current = true;
      return;
    }
    if (entry === null) return;
    if (copies(l)) {
      copyOnDrop(l, entry, t, mode);
      return;
    }
    const id = entry.id;
    const focusKey = l.windowId === null ? id : `${id}:${l.windowId}`;
    // Mehrere gewählte Einträge verschieben sich gemeinsam (B2), ein Undo-Schritt, Nachbarn nach Variante c.
    if (l.kind === 'move' && l.group.length > 1 && l.group.includes(id)) {
      const spec = groupMove(l, t);
      if (spec === null) return;
      const ids = l.group;
      keepSelection.current = true;
      dispatch((p, ctx) => moveSelection(p, ids, spec, mode, ctx), focusKey);
      onToast?.({ text: `${ids.length} Einträge verschoben`, undo: 'Verschieben' });
      return;
    }
    if (entry.type === 'block') {
      const gesture = blockGesture(l, t);
      // Auch angehalten passt nichts (CR-F3-01): nichts ändern, nur der Hinweis – kein Fehler beim Ablegen.
      if (gesture !== null && arrangeBlocks(plan, gesture, mode).blocked === true) {
        setStatus(
          'Folgende reichen über Tagesende – nichts geändert. Weniger weit ziehen oder mit Alt parallel legen.',
        );
        return;
      }
      dispatch((document, context) => {
        const place = (p: Plan, time: { from: number; to: number }) => ({
          ...updateEntry(
            p,
            id,
            'block',
            {
              date: t.date,
              time: { form: 'range', from: time.from, to: time.to },
              ...(t.date === l.base.date || l.kind !== 'move' ? { columns: t.columns } : {}),
            },
            context,
          ),
          entryId: id,
        });
        return gesture === null
          ? place(document, { from: t.from, to: t.to })
          : applyArrangement(document, gesture, mode, place, context);
      }, focusKey);
      return;
    }
    if (entry.type === 'rapport') {
      const time =
        l.kind === 'move' && entry.time.form === 'point'
          ? ({ form: 'point', at: t.from } as const)
          : ({
              form: 'range',
              from: t.from,
              to:
                l.kind === 'move'
                  ? t.from + (entry.time.form === 'range' ? entry.time.to - entry.time.from : 30)
                  : t.to,
            } as const);
      dispatch((p, ctx) => updateEntry(p, id, 'rapport', { date: t.date, time }, ctx), focusKey);
      return;
    }
    if (entry.type === 'marker') {
      if (t.from !== entry.at)
        dispatch((p, ctx) => updateEntry(p, id, 'marker', { at: t.from }, ctx), focusKey);
      return;
    }
    if (entry.type === 'querbalken') {
      const fromDate = l.kind === 'right' ? entry.fromDate : addDays(entry.fromDate, t.dayOffset);
      const toDate = l.kind === 'left' ? entry.toDate : addDays(entry.toDate, t.dayOffset);
      if (fromDate !== entry.fromDate || toDate !== entry.toDate)
        dispatch((p, ctx) => updateEntry(p, id, 'querbalken', { fromDate, toDate }, ctx), focusKey);
      return;
    }
    if (entry.type === 'beso' && l.windowId !== null) {
      const windowId = l.windowId;
      const w = entry.windows.find((x) => x.id === windowId);
      if (w === undefined) return;
      const time = shiftTime(w.time, t.from - l.base.from);
      const run: RunCommand = (p, ctx) =>
        placeTimeWindow(p, id, windowId, { date: t.date, time, columnId: t.columnId }, ctx);
      try {
        const preview = run(plan, { templates: builtInTemplates() });
        const after = preview.plan.entries[id];
        if (after?.type === 'beso' && after.besoNumber !== entry.besoNumber)
          setStatus(
            `Beso «${entryTitle(plan, entry)}»: Nr ${entry.besoNumber ?? '–'} → ${after.besoNumber ?? '–'}`,
          );
      } catch (failure) {
        setError(messageOf(failure));
        return;
      }
      dispatch(run, focusKey);
    }
  }

  /**
   * Ctrl beim Loslassen (UI-Richtlinie 5.5, Windows-Konvention; CR-H-U-10): eine unabhängige Kopie an der Zielstelle,
   * das Original bleibt. Mehrere gewählte Einträge werden gemeinsam kopiert. Ein Befehl, ein Undo-Schritt.
   */
  function copyOnDrop(l: Live, entry: Entry, t: Target, mode: ArrangeMode): void {
    const id = entry.id;
    if (l.group.length > 1 && l.group.includes(id)) {
      const spec = groupMove(l, t);
      if (spec === null) return;
      const ids = l.group;
      let created: readonly Id[] = [];
      keepSelection.current = true;
      dispatch((p, ctx) => {
        const r = copyEntries(p, ids, spec, ctx);
        created = r.newIds;
        setSelection(r.newIds.map((n) => ({ id: n, windowId: null })));
        return r;
      });
      const last = created[created.length - 1];
      if (last !== undefined) setPendingFocus(last);
      onToast?.({ text: `${ids.length} Einträge kopiert`, undo: 'Kopieren' });
      return;
    }
    if (sameAsOrigin(l, entry, t)) return;
    /** Kopie am Ausgangsort, danach wie beim Verschieben an die Zielstelle gesetzt. */
    const copyFirst = (p: Plan, ctx: CommandContext): { result: CommandResult; copyId: Id } => {
      const r = copyEntries(p, [id], {}, ctx);
      const copyId = r.newIds[0];
      if (copyId === undefined) throw new RangeError('Kopie fehlt.');
      return { result: r, copyId };
    };
    let focusKey: string | null = null;
    const done = (copyId: Id, windowId: Id | null): void => {
      focusKey = windowId === null ? copyId : `${copyId}:${windowId}`;
      setSelected({ id: copyId, windowId });
    };
    if (entry.type === 'block') {
      const gesture = blockGesture(l, t);
      // Auch angehalten passt nichts (CR-F3-01): nichts ändern, nur der Hinweis – kein Fehler beim Ablegen.
      if (gesture !== null && arrangeBlocks(plan, gesture, mode).blocked === true) {
        setStatus(
          'Folgende reichen über Tagesende – nichts geändert. Weniger weit ziehen oder mit Alt parallel legen.',
        );
        return;
      }
      dispatch((document, context) => {
        const place = (p: Plan, time: { from: number; to: number }) => {
          const c = copyFirst(p, context);
          const u = updateEntry(
            c.result.plan,
            c.copyId,
            'block',
            {
              date: t.date,
              time: { form: 'range', from: time.from, to: time.to },
              ...(t.date === l.base.date ? { columns: t.columns } : {}),
            },
            context,
          );
          done(c.copyId, null);
          return { ...combineResults(c.result, u, c.result.label), entryId: c.copyId };
        };
        return gesture === null
          ? place(document, { from: t.from, to: t.to })
          : applyArrangement(document, gesture, mode, place, context);
      });
    } else if (entry.type === 'rapport') {
      const time =
        entry.time.form === 'point'
          ? ({ form: 'point', at: t.from } as const)
          : ({
              form: 'range',
              from: t.from,
              to: t.from + (entry.time.to - entry.time.from),
            } as const);
      dispatch((p, ctx) => {
        const c = copyFirst(p, ctx);
        const u = updateEntry(c.result.plan, c.copyId, 'rapport', { date: t.date, time }, ctx);
        done(c.copyId, null);
        return combineResults(c.result, u, c.result.label);
      });
    } else if (entry.type === 'marker') {
      dispatch((p, ctx) => {
        const c = copyFirst(p, ctx);
        const u = updateEntry(c.result.plan, c.copyId, 'marker', { at: t.from }, ctx);
        done(c.copyId, null);
        return combineResults(c.result, u, c.result.label);
      });
    } else if (entry.type === 'querbalken') {
      const fromDate = addDays(entry.fromDate, t.dayOffset);
      const toDate = addDays(entry.toDate, t.dayOffset);
      dispatch((p, ctx) => {
        const c = copyFirst(p, ctx);
        const u = updateEntry(c.result.plan, c.copyId, 'querbalken', { fromDate, toDate }, ctx);
        done(c.copyId, null);
        return combineResults(c.result, u, c.result.label);
      });
    } else if (entry.type === 'beso' && l.windowId !== null) {
      const index = entry.windows.findIndex((x) => x.id === l.windowId);
      const w = entry.windows[index];
      if (w === undefined) return;
      const time = shiftTime(w.time, t.from - l.base.from);
      dispatch((p, ctx) => {
        const c = copyFirst(p, ctx);
        const copy = c.result.plan.entries[c.copyId];
        const windowId = copy?.type === 'beso' ? (copy.windows[index]?.id ?? null) : null;
        if (windowId === null) throw new RangeError('Zeitfenster der Kopie fehlt.');
        const u = placeTimeWindow(
          c.result.plan,
          c.copyId,
          windowId,
          { date: t.date, time, columnId: t.columnId },
          ctx,
        );
        done(c.copyId, windowId);
        return combineResults(c.result, u, c.result.label);
      });
    } else return;
    if (focusKey !== null) setPendingFocus(focusKey);
    onToast?.({
      text: `${entryTitle(plan, entry) === '' ? typeName(entry) : `«${entryTitle(plan, entry)}»`} kopiert`,
      undo: 'Kopieren',
    });
  }

  /** Ziel gleich Ausgang (nach dem Einrasten): keine Kopie. */
  function sameAsOrigin(l: Live, entry: Entry, t: Target): boolean {
    if (entry.type === 'querbalken') return t.dayOffset === 0;
    return (
      t.date === l.base.date &&
      t.from === l.base.from &&
      JSON.stringify(t.columns) === JSON.stringify(l.base.columns) &&
      (entry.type !== 'beso' ||
        t.columnId === (entry.windows.find((x) => x.id === l.windowId)?.columnId ?? null))
    );
  }

  /** Verschiebung der ganzen Auswahl aus der Geste des gezogenen Eintrags: Zeit, Tage, Spalten (gleicher Tag). */
  function groupMove(l: Live, t: Target): MoveSpec | null {
    const entry = l.entry;
    if (entry === null) return null;
    if (entry.type === 'querbalken') return t.dayOffset === 0 ? null : { dayOffset: t.dayOffset };
    const dayOffset = daysBetween(l.base.date, t.date);
    const deltaMinutes = Math.round((t.from - l.base.from) / 5) * 5;
    let columnShift = 0;
    if (
      dayOffset === 0 &&
      entry.type === 'block' &&
      t.columns.kind === 'ids' &&
      l.base.columns.kind === 'ids'
    ) {
      const order = l.originDay.planning.map((c) => c.column.id);
      const before = order.indexOf(l.base.columns.ids[0] ?? '');
      const after = order.indexOf(t.columns.ids[0] ?? '');
      if (before >= 0 && after >= 0) columnShift = after - before;
    }
    if (deltaMinutes === 0 && dayOffset === 0 && columnShift === 0) return null;
    return { deltaMinutes, dayOffset, columnShift };
  }

  /** Esc bricht ab und lässt die Vorschau kurz zum Ausgang zurückgleiten (A3). */
  function cancelGesture(): void {
    const l = live.current;
    if (l === null) return;
    draggedClick.current = l.started;
    const lift = liftRef.current;
    if (!l.started || lift === null || reducedMotion() || l.view === null) {
      endGesture();
      return;
    }
    l.cancelling = true;
    window.cancelAnimationFrame(autoscroll.current ?? 0);
    // Esc: Block und Nachbarn gleiten in 200 ms an die Ausgangslage zurück, nichts wird gespeichert (Variante B).
    lift.classList.add('is-esc');
    paintLift(l, {
      left: AXIS_WIDTH + l.originDay.left + l.view.rect.left,
      top: l.bodyTop + l.view.rect.top,
      width: l.view.rect.width,
      height: l.view.rect.height,
    });
    lift.classList.add('is-settle');
    flipNext.current = true;
    setDrag(null);
    dragFeedback.set(null);
    window.setTimeout(() => {
      lift.classList.remove('is-esc');
      if (live.current === l) endGesture();
    }, SNAP_MS);
  }

  // Zeigerlage mit voller Rate (pointerrawupdate, wo vorhanden) nur merken; verarbeitet wird je Bild (F-UX3).
  useEffect(() => {
    const raw = (event: globalThis.PointerEvent) => {
      const l = live.current;
      if (l === null || l.cancelling) return;
      l.pointerX = event.clientX;
      l.pointerY = event.clientY;
      schedule(l);
    };
    window.addEventListener('pointerrawupdate', raw as EventListener, { passive: true });
    return () => window.removeEventListener('pointerrawupdate', raw as EventListener);
  });

  useEffect(() => {
    const node = scrollRef.current;
    if (node === null) return;
    const hold = (event: TouchEvent) => {
      if (touchDrag.current && event.cancelable) event.preventDefault();
    };
    node.addEventListener('touchmove', hold, { passive: false });
    return () => node.removeEventListener('touchmove', hold);
  }, []);
  useEffect(
    () => () => {
      touchPending.current?.();
    },
    [],
  );

  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      const l = live.current;
      if (l === null) {
        if (event.type === 'keyup' && event.key === 'Alt' && swallowAlt.current) {
          swallowAlt.current = false;
          event.preventDefault();
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        cancelGesture();
        return;
      }
      if (event.key === 'Shift' || event.key === 'Alt') {
        event.preventDefault();
        setModifiers(l, event.shiftKey, event.altKey, l.ctrl, true);
      } else if (event.key === 'Control' || event.key === 'Meta') {
        // Ctrl während des Ziehens: Zeitschild «Kopie» (UI-Richtlinie 5.5).
        setModifiers(l, l.shift, l.alt, event.ctrlKey || event.metaKey, true);
      }
    };
    // Fokuswechsel (Fenster verliert den Fokus, Runde 4): gedrückte Tasten gelten als losgelassen – sonst bliebe ein
    // Modus hängen, dessen keyup nie ankommt.
    const blur = () => {
      const l = live.current;
      if (l !== null && !l.cancelling) setModifiers(l, false, false, false, true);
    };
    window.addEventListener('keydown', key, true);
    window.addEventListener('keyup', key, true);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', key, true);
      window.removeEventListener('keyup', key, true);
      window.removeEventListener('blur', blur);
    };
  });

  // Ctrl+G «Gehe zu» (B4; UI-Richtlinie 13.2), überall in der Route ausser in Dialogen.
  useEffect(() => {
    const key = (event: globalThis.KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'g')
        return;
      if (document.querySelector('dialog[open]') !== null) return;
      event.preventDefault();
      setGoTo(true);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  // ---------------------------------------------------------------------------------------------
  // Spaltenkopf (A8)
  // ---------------------------------------------------------------------------------------------

  function applyColumn(day: DayBox, columnId: Id, changes: DayColumnChanges, scope: ColumnScope) {
    const weekdayKey = day.weekday;
    dispatch((p, ctx) => updateDayColumn(p, weekId, weekdayKey, columnId, changes, scope, ctx));
  }

  /** Fokus nach «Spalte entfernen»: Tag, Stelle und Planstand vor dem Befehl (CR-U-2-01). */
  const pendingHead = useRef<{ date: IsoDate; index: number; plan: Plan; at: number } | null>(null);
  useEffect(() => {
    const want = pendingHead.current;
    if (want === null || want.plan === plan) return;
    pendingHead.current = null;
    // Nur unmittelbar nach dem eigenen Befehl (ein gescheiterter Befehl lässt den Fokus später nicht springen).
    if (Date.now() - want.at > 5000) return;
    const day = days.find((d) => d.date === want.date);
    const column = day?.columns[Math.min(want.index, (day?.columns.length ?? 1) - 1)]?.column;
    const button =
      day === undefined || column === undefined
        ? undefined
        : emptyButtons.current.get(`head:${day.date}:${column.id}`);
    if (button !== undefined) button.focus();
    else focusCursor(false);
  });
  /** Anfangsfokus der Rückfrage «Nur dieser Tag / Alle Tage» auf «Nur dieser Tag» (nach showModal; UX-2-06). */
  const scopeFirst = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (scopeQuestion !== null) scopeFirst.current?.focus();
  }, [scopeQuestion]);
  /** Neue Spalte: nach dem Einfügen sofort umbenennen (Kennung aus dem Befehl, F-UX2 P6). */
  const pendingRename = useRef<{ date: IsoDate; id: Id | null; scope: ColumnScope } | null>(null);
  useEffect(() => {
    const want = pendingRename.current;
    if (want === null || want.id === null) return;
    const day = days.find((d) => d.date === want.date);
    const column = day?.columns.find((c) => c.column.id === want.id)?.column;
    if (day === undefined || column === undefined) return;
    pendingRename.current = null;
    openColumnEdit(day.date, column, want.scope);
  });

  /** Einträge, die eine Spalte belegen (am Tag bzw. an allen Tagen mit dem Spaltensatz). */
  function entriesInColumn(day: DayBox, columnId: Id, scope: ColumnScope): number {
    const dates = new Set<IsoDate>();
    if (scope === 'day') dates.add(day.date);
    else
      for (const w of plan.weeks)
        w.days.forEach((d, i) => {
          if (d.columnSetId === day.setId) dates.add(addDays(w.startDate, i));
        });
    let n = 0;
    for (const e of Object.values(plan.entries)) {
      if (!('date' in e) || !dates.has(e.date)) continue;
      const ids =
        e.type === 'block' || e.type === 'marker'
          ? e.columns.kind === 'ids'
            ? e.columns.ids
            : []
          : e.type === 'beso'
            ? e.windows.map((w) => w.columnId)
            : e.type === 'rapport' && e.displayColumns.kind === 'ids'
              ? e.displayColumns.ids
              : [];
      if (ids.includes(columnId)) n++;
    }
    return n;
  }

  function applyColumnOp(day: DayBox, op: DayColumnInsertRemove, scope: ColumnScope): void {
    const weekdayKey = day.weekday;
    const before = op.op === 'remove' ? entriesInColumn(day, op.columnId, scope) : 0;
    const name =
      op.op === 'remove'
        ? (day.columns.find((c) => c.column.id === op.columnId)?.column.name ?? '')
        : op.name;
    if (op.op === 'insert') pendingRename.current = { date: day.date, id: null, scope };
    dispatch((p, ctx) => {
      const r = insertOrRemoveDayColumn(p, weekId, weekdayKey, op, scope, ctx);
      if (op.op === 'insert' && pendingRename.current !== null)
        pendingRename.current.id = r.columnId;
      return r;
    });
    if (op.op === 'remove') {
      // Fokus nach dem Befehl aus dem neuen Planstand: Kopf an derselben Stelle (CR-U-2-01; neue IDs bei «nur
      // dieser Tag»), sonst die letzte Spalte, Rückfall Zellzeiger.
      pendingHead.current = {
        date: day.date,
        index: Math.max(
          0,
          day.columns.findIndex((c) => c.column.id === op.columnId),
        ),
        plan,
        at: Date.now(),
      };
      onToast?.({
        text: `Spalte «${name}» entfernt${before === 0 ? '' : ` · ${String(before)} ${before === 1 ? 'Eintrag trägt' : 'Einträge tragen'} Befund P1 (nichts gelöscht)`}`,
        undo: 'Entfernen',
      });
    }
  }

  /** Einfügen bzw. Entfernen mit Rückfrage «nur dieser Tag / alle Tage mit diesem Spaltensatz» (F-UX2 P6). */
  function askScopeOp(day: DayBox, op: DayColumnInsertRemove, title: string): void {
    const set = plan.columnSets.find((s) => s.id === day.setId);
    if (set === undefined || disabled) return;
    const usage = columnSetUsage(plan, set.id);
    if (usage <= 1) {
      applyColumnOp(day, op, 'set');
      return;
    }
    setScopeQuestion({
      title,
      description: `Der Spaltensatz «${set.name}» wird an ${usage} Tagen verwendet. Die Änderung nur für ${day.weekday} ${formatDate(day.date, 'long')} oder für alle Tage mit diesem Spaltensatz übernehmen.${op.op === 'remove' ? ' Einträge in der Spalte bleiben erhalten und tragen danach den Befund P1.' : ''}`,
      weekday: day.weekday,
      columnId: op.op === 'remove' ? op.columnId : '',
      changes: {},
      op,
    });
  }

  function newColumnName(day: DayBox): string {
    const taken = new Set(day.columns.map((c) => c.column.name));
    let name = 'Neue Spalte';
    for (let n = 2; taken.has(name); n++) name = `Neue Spalte ${String(n)}`;
    return name;
  }

  function insertColumn(day: DayBox, index: number, side: 'left' | 'right'): void {
    const at = side === 'left' ? index : index + 1;
    const name = newColumnName(day);
    askScopeOp(
      day,
      { op: 'insert', index: at, name },
      `Spalte ${side === 'left' ? 'links' : 'rechts'} einfügen`,
    );
  }

  function canRemoveColumn(day: DayBox, column: Column): boolean {
    if (column.kind === 'rap' || column.kind === 'beso') return false;
    return (
      column.kind === 'secondary' ||
      day.columns.filter((c) => c.column.kind === 'planning').length > 1
    );
  }

  function removeColumn(day: DayBox, column: Column): void {
    if (!canRemoveColumn(day, column)) {
      setStatus(
        column.kind === 'rap' || column.kind === 'beso'
          ? `Die ${column.kind === 'rap' ? 'Rap' : 'Beso'}-Spalte gehört zu jedem Spaltensatz und kann nicht entfernt werden.`
          : 'Der Tag braucht mindestens eine Planungsspalte. Zuerst eine andere einfügen.',
      );
      return;
    }
    askScopeOp(day, { op: 'remove', columnId: column.id }, `Spalte «${column.name}» entfernen`);
  }

  /** Kontextmenü des Spaltenkopfs (F-UX2 P6): einfügen links/rechts, umbenennen, entfernen. */
  function openColumnMenu(day: DayBox, index: number, x: number, y: number): void {
    const column = day.columns[index]?.column;
    if (column === undefined) return;
    openMenu(
      `Spalte ${column.name}`,
      [
        {
          label: 'Spalte links einfügen',
          key: 'Shift+Einfg',
          disabled,
          run: () => insertColumn(day, index, 'left'),
        },
        {
          label: 'Spalte rechts einfügen',
          key: 'Einfg',
          disabled: disabled || column.kind !== 'planning',
          run: () => insertColumn(day, index, 'right'),
        },
        { label: 'Umbenennen', key: 'F2', disabled, run: () => openColumnEdit(day.date, column) },
        {
          label: 'Spalte entfernen',
          key: 'Entf',
          separatorBefore: true,
          disabled: disabled || !canRemoveColumn(day, column),
          run: () => removeColumn(day, column),
        },
      ],
      x,
      y,
    );
  }

  function askScope(day: DayBox, columnId: Id, changes: DayColumnChanges, title: string): void {
    const set = plan.columnSets.find((s) => s.id === day.setId);
    if (set === undefined) return;
    const usage = columnSetUsage(plan, set.id);
    if (usage <= 1) {
      applyColumn(day, columnId, changes, 'set');
      return;
    }
    setScopeQuestion({
      title,
      description: `Der Spaltensatz «${set.name}» wird an ${usage} Tagen verwendet. Die Änderung nur für ${day.weekday} ${formatDate(day.date, 'long')} oder für alle Tage mit diesem Spaltensatz übernehmen.`,
      weekday: day.weekday,
      columnId,
      changes,
    });
  }

  function finishColumnEdit(commit: boolean, moveNext = false): void {
    const edit = colEdit;
    if (edit === null || colEditDone.current) return;
    colEditDone.current = true;
    setColEdit(null);
    const day = days.find((d) => d.date === edit.date);
    const column = day?.columns.find((c) => c.column.id === edit.columnId)?.column;
    if (day === undefined || column === undefined) return;
    if (moveNext) {
      const index = day.columns.findIndex((c) => c.column.id === edit.columnId);
      const next = day.columns[index + 1]?.column;
      if (next !== undefined) setPendingFocus(`head:${day.date}:${next.id}`);
    } else setPendingFocus(`head:${day.date}:${column.id}`);
    if (!commit) return;
    const name = edit.value.trim();
    if (name === '' || name === column.name) {
      if (name === '') setStatus('Spaltenname leer: nicht übernommen. Einen Namen eingeben.');
      return;
    }
    if (!isRenderable(name)) {
      setStatus(
        'Ein Zeichen im Spaltennamen kann im PDF nicht dargestellt werden. Nicht übernommen.',
      );
      return;
    }
    // Name der eben eingefügten Spalte: Geltungsbereich wie beim Einfügen (UX-2-06).
    if (edit.scope === 'set') applyColumn(day, column.id, { name }, 'set');
    else askScope(day, column.id, { name }, `Spalte «${column.name}» umbenennen`);
  }

  function beginWeightDrag(event: PointerEvent<HTMLElement>, day: DayBox, index: number): void {
    if (disabled || event.button !== 0) return;
    if (event.pointerType === 'touch' && !touchGated.current) {
      deferTouch(event, (frozen) => beginWeightDrag(frozen, day, index), null);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const element = event.currentTarget;
    element.setPointerCapture(event.pointerId);
    const head = element.closest('.i2-grid-column-heads');
    const left = head?.getBoundingClientRect().left ?? 0;
    const columns = day.columns.map((c) => c.column);
    const column = columns[index];
    if (column === undefined) return;
    const move = (e: globalThis.PointerEvent) => {
      const weight = weightAtBoundary(columns, index, e.clientX - left, day.width);
      setWeightPreview((prev) =>
        prev !== null && prev.weight === weight
          ? prev
          : { date: day.date, columnId: column.id, weight },
      );
    };
    const up = (e: globalThis.PointerEvent) => {
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerup', up);
      element.removeEventListener('pointercancel', up);
      const weight = weightAtBoundary(columns, index, e.clientX - left, day.width);
      setWeightPreview(null);
      if (e.type === 'pointerup' && weight !== column.weight)
        askScope(day, column.id, { weight }, `Breite von «${column.name}» ändern`);
    };
    element.addEventListener('pointermove', move);
    element.addEventListener('pointerup', up);
    element.addEventListener('pointercancel', up);
  }

  // ---------------------------------------------------------------------------------------------
  // Tastatur im Raster (A1, A2, B1–B3, B7)
  // ---------------------------------------------------------------------------------------------

  /** Einträge, auf die eine Taste wirkt: die ganze Auswahl, wenn der Eintrag dazugehört, sonst nur er. */
  function groupOf(id: Id): readonly Id[] {
    return selectedIds.has(id) && selectedIds.size > 1 ? [...selectedIds] : [id];
  }

  function focusItem(item: { readonly id: Id; readonly windowId: Id | null }, keep = false): void {
    keepSelection.current = keep;
    const key = itemKey(item);
    const button = entryButtons.current.get(key);
    if (button !== undefined) {
      button.focus({ preventScroll: false });
      keepSelection.current = false;
    } else setPendingFocus(key);
  }

  /** Nächster Eintrag in Pfeilrichtung (Ctrl+Pfeil; Auswahl bleibt, UI-Richtlinie 13.3). */
  function neighbour(from: string, direction: 'left' | 'right' | 'up' | 'down'): EntryView | null {
    let origin: { x: number; y: number } | null = null;
    const all: { view: EntryView; x: number; y: number }[] = [];
    for (const day of days)
      for (const v of views.get(day.date) ?? []) {
        if (v.id.includes('~')) continue;
        const x = day.left + v.rect.left + v.rect.width / 2;
        const y = v.rect.top + v.rect.height / 2;
        if (itemKey(v) === from) origin = { x, y };
        else all.push({ view: v, x, y });
      }
    if (origin === null) return null;
    const o = origin;
    const candidates = all.filter(({ x, y }) =>
      direction === 'left'
        ? x < o.x - 1
        : direction === 'right'
          ? x > o.x + 1
          : direction === 'up'
            ? y < o.y - 1
            : y > o.y + 1,
    );
    const vertical = direction === 'up' || direction === 'down';
    candidates.sort(
      (a, b) =>
        (vertical ? Math.abs(a.y - o.y) : Math.abs(a.x - o.x)) +
        3 * (vertical ? Math.abs(a.x - o.x) : Math.abs(a.y - o.y)) -
        ((vertical ? Math.abs(b.y - o.y) : Math.abs(b.x - o.x)) +
          3 * (vertical ? Math.abs(b.x - o.x) : Math.abs(b.y - o.y))),
    );
    return candidates[0]?.view ?? null;
  }

  /** Ctrl+A: alle Einträge des Tages, beim zweiten Mal der Woche (B2). */
  function selectAll(date: IsoDate): void {
    const dayItems = new Map<string, Selection>();
    for (const v of views.get(date) ?? [])
      if (!v.id.includes('~')) dayItems.set(itemKey(v), { id: v.id, windowId: v.windowId });
    const current = new Set(selection.map(itemKey));
    const sameAsDay =
      dayItems.size > 0 &&
      current.size === dayItems.size &&
      [...dayItems.keys()].every((k) => current.has(k));
    let next: readonly Selection[] = [...dayItems.values()];
    if (sameAsDay || dayItems.size === 0) {
      const week = new Map<string, Selection>();
      for (const list of views.values())
        for (const v of list)
          if (!v.id.includes('~')) week.set(itemKey(v), { id: v.id, windowId: v.windowId });
      next = [...week.values()];
    }
    setSelection(next);
    setStatus(
      next.length === 0
        ? 'Keine Einträge zum Wählen.'
        : `${next.length} ${next.length === 1 ? 'Eintrag' : 'Einträge'} gewählt${sameAsDay ? ' (ganze Woche)' : ''}. Ctrl+A erneut wählt die ganze Woche.`,
    );
  }

  /** Ziel beim Einfügen: Zellzeiger, Mauszeiger (zuletzt bewegt) oder gleicher Wochentag/Zeit (UI-Richtlinie 5.7). */
  function pasteTarget(
    onEntry: boolean,
    ids: readonly Id[],
  ): { date: IsoDate; minute: number } | null {
    const pointer = lastPointer.current;
    const wrapper = wrapperRef.current;
    if (pointer !== null && pointer.at > lastKeyboardMove.current && wrapper !== null) {
      const rect = wrapper.getBoundingClientRect();
      const body = wrapper.querySelector('.i2-grid-day-body');
      const bodyTop = body === null ? 58 : body.getBoundingClientRect().top - rect.top;
      const x = pointer.x - rect.left - AXIS_WIDTH;
      const day = days.find((d) => x >= d.left && x < d.left + d.width);
      const minute = plan.displayRange.from + (pointer.y - rect.top - bodyTop) / scale.minute;
      if (day !== undefined && minute >= plan.displayRange.from && minute < plan.displayRange.to)
        return { date: day.date, minute: Math.floor(minute / STEP) * STEP };
    }
    if (onEntry && week !== undefined) {
      const ref = referencePoint(
        ids.map((id) => plan.entries[id]).filter((e): e is Entry => e !== undefined),
      );
      if (ref === null) return null;
      const weekday = ((daysBetween(week.startDate, ref.date) % 7) + 7) % 7;
      return { date: addDays(week.startDate, weekday), minute: ref.minute };
    }
    return activeCursor === null ? null : { date: activeCursor.date, minute: activeCursor.minute };
  }

  function copySelection(ids: readonly Id[], cut: boolean): void {
    if (ids.length === 0) {
      setStatus('Nichts gewählt. Zuerst einen Eintrag wählen, dann Ctrl+C oder Ctrl+X.');
      return;
    }
    clipboard.set({ planId: plan.id, ids, cut });
    setCutIds(new Set(cut ? ids : []));
    const what = ids.length === 1 ? '1 Eintrag' : `${ids.length} Einträge`;
    setStatus(
      cut
        ? `${what} ausgeschnitten. Mit Ctrl+V am Ziel einfügen (verschiebt), Esc bricht ab.`
        : `${what} kopiert. Mit Ctrl+V am Zellzeiger einfügen, auch in einer anderen Woche.`,
    );
  }

  function paste(target: { date: IsoDate; minute: number } | null): void {
    const content = clipboard.get();
    if (content === null) {
      setStatus('Die Zwischenablage ist leer. Zuerst Einträge wählen und Ctrl+C drücken.');
      return;
    }
    if (content.planId !== plan.id) {
      setStatus('Einfügen geht nur im selben Plan. Die Einträge im anderen Plan erneut kopieren.');
      return;
    }
    if (target === null) return;
    let preview: ReturnType<typeof pasteEntries>;
    try {
      preview = pasteEntries(plan, content.ids, target, content.cut, {
        templates: builtInTemplates(),
      });
    } catch (failure) {
      setError(
        failure instanceof RangeError
          ? 'Die kopierten Einträge gibt es nicht mehr. Einträge erneut wählen und kopieren.'
          : messageOf(failure),
      );
      return;
    }
    const ids = content.ids;
    const cut = content.cut;
    const first = preview.newIds[0];
    const created = preview.newIds
      .map((id) => preview.plan.entries[id])
      .filter((e): e is Entry => e !== undefined);
    keepSelection.current = true;
    setSelection(
      created.map((e) => ({
        id: e.id,
        windowId: e.type === 'beso' ? (e.windows[0]?.id ?? null) : null,
      })),
    );
    const firstEntry = first === undefined ? undefined : preview.plan.entries[first];
    const focus =
      firstEntry === undefined
        ? undefined
        : firstEntry.type === 'beso'
          ? `${firstEntry.id}:${firstEntry.windows[0]?.id ?? ''}`
          : firstEntry.id;
    dispatch((p, ctx) => pasteEntries(p, ids, target, cut, ctx), focus);
    if (cut) {
      clipboard.set(null);
      setCutIds(new Set());
    }
    const n = preview.newIds.length;
    const missing =
      preview.missing.length === 0
        ? ''
        : ` · ${preview.missing.join(', ')} fehlt am Ziel: gleiche relative Lage (Befund P1)`;
    onToast?.({
      text: `${n === 1 ? '1 Eintrag' : `${n} Einträge`} ${cut ? 'verschoben' : 'eingefügt'}${missing}`,
      undo: cut ? 'Verschieben' : 'Einfügen',
    });
  }

  function duplicate(ids: readonly Id[]): void {
    let preview: ReturnType<typeof duplicateSelection>;
    try {
      preview = duplicateSelection(plan, ids, { templates: builtInTemplates() });
    } catch (failure) {
      setError(messageOf(failure));
      return;
    }
    const created = preview.newIds
      .map((id) => preview.plan.entries[id])
      .filter((e): e is Entry => e !== undefined);
    const sel = created.map((e) => ({
      id: e.id,
      windowId: e.type === 'beso' ? (e.windows[0]?.id ?? null) : null,
    }));
    keepSelection.current = true;
    setSelection(sel);
    const last = sel[sel.length - 1];
    dispatch(
      (p, ctx) => duplicateSelection(p, ids, ctx),
      last === undefined ? undefined : itemKey(last),
    );
    if (ids.length > 1)
      onToast?.({ text: `${ids.length} Einträge dupliziert`, undo: 'Duplizieren' });
  }

  /** Neuer Eintrag am Zellzeiger bzw. Bereich (B1): Block, in der Rap-Spalte Rapport, in der Beso-Spalte Beso. */
  function createAtCursor(typed: string): void {
    if (cells === null || cursorDay === undefined) return;
    const boxes = cursorDay.columns.slice(cells.firstColumn, cells.lastColumn + 1);
    const first = boxes[0]?.column;
    if (first === undefined) return;
    if (first.kind === 'rap' || first.kind === 'beso') {
      startDraft(
        {
          date: cells.date,
          from: cells.from,
          to: Math.max(cells.to, cells.from + 30),
          columns: { kind: 'ids', ids: [first.id] },
        },
        first.kind === 'rap' ? 'rapport' : 'beso',
        'adjust',
        typed,
      );
      return;
    }
    const ids = boxes
      .filter((b) => b.column.kind === 'planning' || b.column.kind === 'secondary')
      .map((b) => b.column.id);
    startDraft(
      { date: cells.date, from: cells.from, to: cells.to, columns: { kind: 'ids', ids } },
      'block',
      'adjust',
      typed,
    );
  }

  function focusColumnHead(date: IsoDate, column: number): void {
    const day = days.find((d) => d.date === date);
    const col = day?.columns[column]?.column;
    if (day === undefined || col === undefined) return;
    emptyButtons.current.get(`head:${day.date}:${col.id}`)?.focus();
  }

  /** Spaltenkopf: ←/→ Nachbar, ↓ ins Raster, Shift+←/→ Breite, Enter/F2 umbenennen (B1, A8). */
  function columnHeadKey(event: KeyboardEvent<HTMLElement>, day: DayBox, index: number): void {
    const column = day.columns[index]?.column;
    if (column === undefined) return;
    if (event.key === 'F2' || event.key === 'Enter') {
      event.preventDefault();
      openColumnEdit(day.date, column);
    } else if (event.key === 'Insert') {
      // Einfg rechts, Shift+Einfg links einfügen; Entf entfernt (F-UX2 P6).
      event.preventDefault();
      if (event.shiftKey || column.kind !== 'planning') insertColumn(day, index, 'left');
      else insertColumn(day, index, 'right');
    } else if (event.key === 'Delete') {
      event.preventDefault();
      removeColumn(day, column);
    } else if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault();
      const r = event.currentTarget.getBoundingClientRect();
      openColumnMenu(day, index, r.left, r.bottom);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveCursorTo({ date: day.date, minute: plan.displayRange.from, column: index }, true);
    } else if (event.key === 'ArrowUp') {
      // Spaltenkopf → Tageskopf (UI-Richtlinie 13.3).
      event.preventDefault();
      focusDayHead(day.date);
    } else if ((event.key === 'ArrowLeft' || event.key === 'ArrowRight') && event.shiftKey) {
      event.preventDefault();
      if (column.kind !== 'planning') return;
      const weight = stepWeight(column.weight, event.key === 'ArrowRight' ? 1 : -1);
      if (weight !== column.weight)
        askScope(day, column.id, { weight }, `Breite von «${column.name}» ändern`);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = moveCursor(
        { date: day.date, minute: plan.displayRange.from, column: index },
        event.key === 'ArrowLeft' ? 'left' : 'right',
        days,
        bounds,
      );
      if (next !== null) focusColumnHead(next.date, next.column);
    }
  }

  const CURSOR_KEYS: Readonly<Record<string, CursorMove>> = {
    ArrowLeft: 'left',
    ArrowRight: 'right',
    ArrowUp: 'up',
    ArrowDown: 'down',
    PageUp: 'pageUp',
    PageDown: 'pageDown',
    Home: 'home',
    End: 'end',
  };

  function printable(event: KeyboardEvent<HTMLElement>): boolean {
    return (
      event.key.length === 1 &&
      event.key !== ' ' &&
      event.key !== '?' &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    );
  }

  function cursorKey(event: KeyboardEvent<HTMLElement>): void {
    const c = activeCursor;
    if (c === null) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const move = CURSOR_KEYS[event.key];
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault();
      const r = cursorRef.current?.getBoundingClientRect();
      openCursorMenu(r?.left ?? 0, r?.bottom ?? 0);
      return;
    }
    // ↓ unter der letzten Zeitzeile: in den Terminbereich des Tages (UI-Richtlinie 13.3).
    if (
      move === 'down' &&
      !ctrl &&
      !event.shiftKey &&
      !event.altKey &&
      c.minute >= bounds.to - STEP
    ) {
      event.preventDefault();
      focusAgenda(c.date, 0);
      return;
    }
    if (move !== undefined && !event.altKey) {
      let m: CursorMove = move;
      if (ctrl && (event.key === 'ArrowLeft' || event.key === 'ArrowRight'))
        m = event.key === 'ArrowLeft' ? 'previousDay' : 'nextDay';
      else if (ctrl) return;
      event.preventDefault();
      const next = moveCursor(c, m, days, bounds);
      if (next === null) {
        focusColumnHead(c.date, c.column);
        return;
      }
      lastKeyboardMove.current = Date.now();
      if (event.shiftKey && next.date === c.date) {
        setAnchor(anchor ?? c);
        setCursorState(next);
      } else {
        setAnchor(null);
        setCursorState(next);
      }
      scrollCursor.current = true;
      return;
    }
    if (event.key === 'Tab') {
      const box = cursorDay?.columns[c.column];
      const item = itemAfterCursor(
        readingOrder,
        { date: c.date, time: c.minute, left: box?.left ?? 0 },
        event.shiftKey ? -1 : 1,
      );
      if (item !== null) {
        event.preventDefault();
        focusItem(item);
      }
      return;
    }
    if (event.key === 'Escape') {
      setAnchor(null);
      setSelection([]);
      setDaySelection([]);
      if (cutIds.size > 0) {
        clipboard.set(null);
        setCutIds(new Set());
      }
      return;
    }
    if (ctrl && key === 'a') {
      event.preventDefault();
      selectAll(c.date);
      return;
    }
    if (ctrl && (key === 'c' || key === 'x')) {
      event.preventDefault();
      copySelection([...selectedIds], key === 'x');
      return;
    }
    if (disabled) return;
    if (ctrl && key === 'v') {
      event.preventDefault();
      paste(pasteTarget(false, []));
      return;
    }
    if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      if (occupant !== null && anchor === null) focusItem(occupant);
      else createAtCursor('');
      return;
    }
    if (printable(event)) {
      event.preventDefault();
      createAtCursor(event.key);
    }
  }

  /**
   * Shift+→ / Shift+←: rechte Spaltengrenze des Blocks um eine Spalte nach rechts bzw. links (wie Ziehen an der rechten
   * Kante); am Rand bzw. bei anderen Einträgen eine Meldung mit dem Weg (UX-2-03).
   */
  function spanKey(entry: Entry, direction: 'left' | 'right', self: string): void {
    // Wirkt auf die ganze Auswahl (CR-3-06); jeder Block für sich, ein Rückgängig-Schritt.
    const targets = groupOf(entry.id)
      .map((id) => plan.entries[id])
      .filter((e): e is Entry => e !== undefined);
    const changes: { id: Id; columns: ColumnSelection }[] = [];
    let problem = '';
    for (const e of targets) {
      const day = days.find((d) => d.date === entryDate(e));
      if (e.type !== 'block' || day === undefined) {
        problem = 'Spalten dieses Eintrags im Seitenfeld ändern (S).';
        continue;
      }
      const ids = columnsRect(plan, day, e.columns).ids;
      const chosen = day.planning
        .map((c, i) => (ids.includes(c.column.id) ? i : -1))
        .filter((i) => i >= 0);
      if (chosen.length === 0) {
        problem = 'Spalte des Blocks fehlt am Tag. Mit ← / → in eine vorhandene Spalte setzen.';
        continue;
      }
      const first = Math.min(...chosen);
      const last = Math.max(...chosen);
      const next = last + (direction === 'right' ? 1 : -1);
      if (next < first || next >= day.planning.length) {
        problem =
          direction === 'right'
            ? 'Der Block reicht schon bis zur letzten Planungsspalte.'
            : 'Der Block belegt nur noch eine Spalte. Mit ← / → verschieben.';
        continue;
      }
      // Nur die rechte Grenze ändert sich; Lücken verknüpfter Teilblöcke bleiben (R-4.6-61).
      const kept = spanEdge(chosen, 'right', next);
      changes.push({
        id: e.id,
        columns: {
          kind: 'ids',
          ids: day.planning.filter((_, i) => kept.has(i)).map((c) => c.column.id),
        },
      });
    }
    if (changes.length === 0) {
      setStatus(problem);
      return;
    }
    if (problem !== '') setStatus(problem);
    keepSelection.current = true;
    dispatch((p, ctx) => {
      let result: CommandResult | null = null;
      for (const c of changes) {
        const base: Plan = result === null ? p : result.plan;
        const r: CommandResult = updateEntry(base, c.id, 'block', { columns: c.columns }, ctx);
        result = result === null ? r : combineResults(result, r, result.label);
      }
      return result as CommandResult;
    }, self);
  }

  /**
   * ← / → am Block mit fehlender Spalte (P1): von der gezeichneten Lage (gleiche relative Lage wie beim Ziehen) eine
   * Spalte weiter in vorhandene Spalten setzen, am Rand an Ort; sonst eine Meldung mit dem Weg (UX-2-07, UX-H-05).
   */
  function p1Key(entry: Entry, direction: 'left' | 'right', self: string): void {
    const day = days.find((d) => d.date === entryDate(entry));
    if (entry.type !== 'block' || entry.columns.kind !== 'ids' || day === undefined) {
      setStatus('Spalte fehlt: im Seitenfeld eine vorhandene Spalte wählen (S).');
      return;
    }
    const drawn = new Set(columnsRect(plan, day, entry.columns).ids);
    const chosen = day.planning
      .map((c, i) => (drawn.has(c.column.id) ? i : -1))
      .filter((i) => i >= 0);
    if (chosen.length === 0) {
      // Keine frühere Lage bekannt (über die ganze Breite gezeichnet, Q-027): → setzt in die letzte, ← in die erste
      // Planungsspalte (UX-3-02); weiter mit ← / → oder S im Seitenfeld.
      const target = day.planning[direction === 'right' ? day.planning.length - 1 : 0];
      if (target === undefined) {
        setStatus('Spalte fehlt: im Seitenfeld eine vorhandene Spalte wählen (S).');
        return;
      }
      setStatus(
        `In Spalte «${target.column.name}» gesetzt. Mit ← / → weiter oder S im Seitenfeld.`,
      );
      lastKeyboardMove.current = Date.now();
      keepSelection.current = true;
      dispatch(
        (p, ctx) =>
          updateEntry(
            p,
            entry.id,
            'block',
            { columns: { kind: 'ids', ids: [target.column.id] } },
            ctx,
          ),
        self,
      );
      return;
    }
    const first = Math.min(...chosen);
    const last = Math.max(...chosen);
    const shift = Math.max(
      -first,
      Math.min(day.planning.length - 1 - last, direction === 'right' ? 1 : -1),
    );
    // Jede gewählte Spalte einzeln verschieben (wie beim Ziehen; R-4.6-61, FD-02).
    const moved = new Set(chosen.map((i) => i + shift));
    const columns: ColumnSelection = {
      kind: 'ids',
      ids: day.planning.filter((_, i) => moved.has(i)).map((c) => c.column.id),
    };
    lastKeyboardMove.current = Date.now();
    keepSelection.current = true;
    dispatch((p, ctx) => updateEntry(p, entry.id, 'block', { columns }, ctx), self);
  }

  function entryKey(event: KeyboardEvent<HTMLElement>, id: Id, windowId: Id | null): void {
    const entry = plan.entries[id];
    if (entry === undefined) return;
    const ctrl = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    const self = itemKey({ id, windowId });
    if (event.key === 'Escape') {
      event.preventDefault();
      setSelection([]);
      moveCursorTo(cursorForEntry(entry, windowId), true);
      return;
    }
    if (event.key === 'Tab' && !ctrl) {
      const next = adjacentItem(readingOrder, self, event.shiftKey ? -1 : 1);
      if (next !== null) {
        event.preventDefault();
        focusItem(next);
      }
      return;
    }
    // Auffüllen nach oben bzw. unten bis zum Nachbarblock (F-UX2 P5): Ctrl+Shift+↑ / Ctrl+Shift+↓.
    if (ctrl && event.shiftKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      event.preventDefault();
      if (entry.type === 'block') fillBlock(entry, event.key === 'ArrowUp' ? 'start' : 'end');
      return;
    }
    if (ctrl && event.key.startsWith('Arrow')) {
      event.preventDefault();
      const direction = event.key.slice(5).toLowerCase() as 'left' | 'right' | 'up' | 'down';
      const next = neighbour(self, direction);
      if (next !== null) focusItem(next, true);
      return;
    }
    if (event.key === ' ') {
      event.preventDefault();
      if (ctrl) {
        const inSel = selection.some((x) => itemKey(x) === self);
        keepSelection.current = true;
        setSelection(
          inSel ? selection.filter((x) => itemKey(x) !== self) : [...selection, { id, windowId }],
        );
      } else setSelected({ id, windowId });
      return;
    }
    if (ctrl && key === 'a') {
      event.preventDefault();
      const date = entryDate(entry);
      if (date !== null) selectAll(date);
      return;
    }
    if (ctrl && (key === 'c' || key === 'x')) {
      event.preventDefault();
      copySelection(groupOf(id), key === 'x');
      return;
    }
    if (disabled) return;
    if (ctrl && key === 'v') {
      event.preventDefault();
      const content = clipboard.get();
      paste(pasteTarget(true, content?.ids ?? []));
      return;
    }
    if (ctrl && key === 'd') {
      event.preventDefault();
      duplicate(groupOf(id));
      return;
    }
    if (event.key === 'Delete') {
      event.preventDefault();
      removeEntries(groupOf(id));
      return;
    }
    if (event.key === 'F2' || event.key === 'Enter') {
      event.preventDefault();
      startEdit(entry, undefined, windowId);
      return;
    }
    const moveKey = CURSOR_KEYS[event.key];
    if (moveKey !== undefined && !ctrl && !event.altKey) {
      event.preventDefault();
      if (event.shiftKey) {
        if (moveKey === 'up' || moveKey === 'down') {
          const delta = moveKey === 'down' ? STEP : -STEP;
          keepSelection.current = true;
          dispatch((p, ctx) => resizeEnd(p, id, delta, ctx), self);
        } else if (moveKey === 'left' || moveKey === 'right') spanKey(entry, moveKey, self);
        return;
      }
      if (moveKey === 'home' || moveKey === 'end') return;
      const ids = groupOf(id);
      if ((moveKey === 'left' || moveKey === 'right') && ids.length === 1 && p1Ids.has(id)) {
        p1Key(entry, moveKey, self);
        return;
      }
      const vertical: Readonly<Record<string, number>> = {
        up: -STEP,
        down: STEP,
        pageUp: -60,
        pageDown: 60,
      };
      const deltaMinutes = vertical[moveKey];
      const direction = moveKey === 'left' ? -1 : 1;
      const run: RunCommand =
        deltaMinutes !== undefined
          ? (p, ctx) =>
              entry.type === 'querbalken'
                ? moveSelection(p, ids, {}, 'adjust', ctx)
                : moveSelection(p, ids, { deltaMinutes }, 'adjust', ctx)
          : (p, ctx) => {
              if (entry.type === 'block' && entry.columns.kind === 'ids') {
                try {
                  return moveSelection(p, ids, { columnShift: direction }, 'adjust', ctx);
                } catch (failure) {
                  if (!(failure instanceof CommandError) || failure.code !== 'invalidPlacement')
                    throw failure;
                }
              }
              return moveSelection(p, ids, { dayOffset: direction }, 'adjust', ctx);
            };
      lastKeyboardMove.current = Date.now();
      keepSelection.current = true;
      dispatch(run, self);
      if (ids.length > 1)
        onToast?.({ text: `${ids.length} Einträge verschoben`, undo: 'Verschieben' });
      return;
    }
    if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault();
      const r =
        event.target instanceof HTMLElement
          ? event.target.getBoundingClientRect()
          : event.currentTarget.getBoundingClientRect();
      openEntryMenu(id, windowId, r.left, r.bottom);
      return;
    }
    if (!printable(event)) return;
    // Seitenfeld (I3 C1): E öffnet es mit dem ersten Feld; bei offenem Seitenfeld springen Z, T, S, K, L, O ins Feld.
    if (key === 'e') {
      event.preventDefault();
      openPanel(null);
      return;
    }
    if (key === 'x') {
      event.preventDefault();
      toggleCancelled(groupOf(id));
      return;
    }
    const panelField = FIELD_KEYS[key];
    if (panelOpen && panelField !== undefined) {
      event.preventDefault();
      openPanel(panelField);
      return;
    }
    // Direktbefehle (B7): Z Zeit, T Tag, S Spalten; A «Auch an anderen Tagen»; K Kategorie (B2).
    if (key === 'z' || key === 't' || key === 's') {
      event.preventDefault();
      if (entry.type === 'block')
        beginForm(entry, undefined, key === 'z' ? 'begin' : key === 't' ? 'date' : 'columns');
      // Übrige Einträge (Beso, Rapport, Marker, Querbalken): Seitenfeld beim Feld Zeit, Tag bzw. Spalten
      // (UI-Richtlinie 13.3; H-UI2, UX-H-09).
      else openPanel(key === 'z' ? 'time' : key === 't' ? 'date' : 'columns');
      return;
    }
    if (key === 'a') {
      event.preventDefault();
      if ('date' in entry) setOtherDays(entry.id);
      return;
    }
    if (key === 'k') {
      event.preventDefault();
      // Ist die Auswahlliste ins Menü «Mehr …» ausgewichen, öffnet K das Seitenfeld beim Feld Kategorie (H-UI2).
      const select = categoryRef.current;
      if (select !== null && select.offsetParent !== null) select.focus();
      else openPanel('category');
      return;
    }
    if (entry.type === 'block') {
      event.preventDefault();
      startEdit(entry, event.key);
    }
  }

  function gridKey(event: KeyboardEvent<HTMLElement>): void {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    if (target.matches('input,textarea,select')) return;
    if (event.key === 'Escape' && live.current !== null) {
      cancelGesture();
      return;
    }
    if (event.key === 'Escape') setHover(null);
    // Zoom (UI-Richtlinie 4.1; H-UI2, SA-H-22): + / − / 0 und im Raster auch Ctrl+Plus / Ctrl+Minus / Ctrl+0.
    const ctrlZoom = (event.ctrlKey || event.metaKey) && !event.altKey;
    const zoomKey = ctrlZoom
      ? ZOOM_KEYS_CTRL[event.key]
      : !event.ctrlKey && !event.metaKey && !event.altKey
        ? ZOOM_KEYS[event.key]
        : undefined;
    if (zoomKey !== undefined && target.closest('.i2-grid') !== null) {
      event.preventDefault();
      setZoom(zoomKey === 0 ? { kind: 'fit' } : nextZoom(zoom, scale, zoomKey));
      return;
    }
    // Tagesköpfe und Terminbereich behandeln ihre Tasten selbst.
    if (target.dataset.dayHead !== undefined || target.dataset.agenda !== undefined) return;
    if (target === cursorRef.current) {
      cursorKey(event);
      return;
    }
    // Tasten wirken auf den fokussierten Eintrag, sonst (Griff, leere Fläche) auf die Auswahl (A1).
    const entryId = target.dataset.entryId ?? selected?.id;
    if (entryId === undefined || target.dataset.head !== undefined) return;
    const windowId =
      target.dataset.entryId === undefined
        ? (selected?.windowId ?? null)
        : (target.dataset.windowId ?? null);
    entryKey(event, entryId, windowId === '' ? null : windowId);
  }

  // ---------------------------------------------------------------------------------------------
  // Detail beim Überfahren (A5): direkt am Eintrag, immer sichtbar
  // ---------------------------------------------------------------------------------------------

  function hoverLater(view: EntryView, element: HTMLElement, delay: number): void {
    window.clearTimeout(hoverTimer.current);
    if (live.current !== null || editing !== null || view.id.includes('~')) return;
    hoverTimer.current = window.setTimeout(() => {
      if (live.current === null && element.isConnected)
        setHover({ id: view.id, windowId: view.windowId, rect: element.getBoundingClientRect() });
    }, delay);
  }
  function hoverEnd(): void {
    window.clearTimeout(hoverTimer.current);
    setHover(null);
  }
  useEffect(() => () => window.clearTimeout(hoverTimer.current), []);

  // ---------------------------------------------------------------------------------------------
  // Tagesköpfe, Kontextmenü, Erfassen aller Typen (I3 C2, C3; UI-Richtlinie 5.1, 5.9, 5.10)
  // ---------------------------------------------------------------------------------------------

  /** Klick auf den Tageskopf wählt den Tag, Shift einen Bereich, Ctrl einzelne Tage (UI-Richtlinie 5.1). */
  function selectDay(
    date: IsoDate,
    event: {
      readonly ctrlKey: boolean;
      readonly metaKey: boolean;
      readonly shiftKey: boolean;
    } | null,
  ): void {
    setSelection([]);
    const order = days.map((d) => d.date);
    setDaySelection((current) => {
      if (event !== null && (event.ctrlKey || event.metaKey)) {
        dayAnchor.current = date;
        return current.includes(date) ? current.filter((d) => d !== date) : [...current, date];
      }
      // Bereich vom Anker (dem zuletzt ohne Shift gewählten Tag) bis zum Ziel; ohne Anker gilt der zuletzt gewählte.
      const anchor =
        dayAnchor.current !== null && current.includes(dayAnchor.current)
          ? dayAnchor.current
          : current[current.length - 1];
      if (event?.shiftKey === true && anchor !== undefined) {
        dayAnchor.current = anchor;
        const a = order.indexOf(anchor);
        const b = order.indexOf(date);
        const range = order.slice(Math.min(a, b), Math.max(a, b) + 1);
        return [...range.filter((d) => d !== date), date];
      }
      dayAnchor.current = date;
      return [date];
    });
  }

  function focusDayHead(date: IsoDate): void {
    emptyButtons.current.get(`day:${date}`)?.focus();
  }

  /** Tageskopf: ←/→ nächster Tag, Shift+←/→ Bereich, S Spaltensatz, D Darstellung, Enter Seitenfeld «Tag». */
  function dayHeadKey(event: KeyboardEvent<HTMLButtonElement>, day: DayBox): void {
    event.stopPropagation();
    const index = days.findIndex((d) => d.date === day.date);
    const key = event.key.toLowerCase();
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      const next = days[index + (event.key === 'ArrowRight' ? 1 : -1)];
      if (next === undefined) return;
      if (event.shiftKey) {
        // Ohne Auswahl ist der fokussierte Tag der Anker (UI-Richtlinie 13.3 «Shift+←/→ Bereich»).
        if (daySelection.length === 0) selectDay(day.date, null);
        selectDay(next.date, { ctrlKey: false, metaKey: false, shiftKey: true });
      }
      focusDayHead(next.date);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusColumnHead(day.date, 0);
    } else if (event.key === ' ') {
      event.preventDefault();
      selectDay(day.date, {
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
      });
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (!daySelection.includes(day.date)) selectDay(day.date, null);
      openPanel(null);
    } else if (key === 's' || key === 'd') {
      event.preventDefault();
      if (!daySelection.includes(day.date)) selectDay(day.date, null);
      openPanel(key === 's' ? 'columnSet' : 'display');
    } else if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault();
      if (!daySelection.includes(day.date)) selectDay(day.date, null);
      const r = event.currentTarget.getBoundingClientRect();
      openDayMenu(day, r.left, r.bottom);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setDaySelection([]);
      focusCursor(false);
    }
  }

  function openMenu(label: string, items: readonly MenuItem[], x: number, y: number): void {
    const back = document.activeElement;
    setMenu({
      label,
      items,
      x,
      y,
      refocus: () => {
        if (back instanceof HTMLElement && back.isConnected) back.focus({ preventScroll: true });
      },
    });
  }

  function openDayMenu(day: DayBox, x: number, y: number): void {
    openMenu(
      `Tag ${day.weekday} ${formatDate(day.date, 'long')}`,
      [
        { label: 'Spaltensatz …', key: 'S', run: () => openPanel('columnSet') },
        { label: 'Darstellung …', key: 'D', run: () => openPanel('display') },
        { label: 'Tag neu nummerieren …', key: 'U', run: () => setRenumberDate(day.date) },
        { label: 'Interne Notiz des Tages', key: 'I', run: () => openPanel(null) },
        {
          label: 'Ganztägige Bemerkung …',
          key: 'G',
          disabled,
          run: () => setCreating({ kind: 'remark', date: day.date }),
        },
      ],
      x,
      y,
    );
  }

  /** Neuer Eintrag am Zellzeiger: Typ nach Kürzel (UI-Richtlinie 5.10 «Leere Fläche»). */
  function createTypeAtCursor(
    type: 'block' | 'beso' | 'rapport' | 'querbalken' | 'marker' | 'remark',
    at: CellRange | null = cells,
  ): void {
    const cursorDay = at === null ? undefined : days.find((d) => d.date === at.date);
    if (disabled || at === null || cursorDay === undefined) return;
    const cells = at;
    const date = cells.date;
    if (type === 'querbalken') {
      setCreating({ kind: 'querbalken', from: date, to: date });
      return;
    }
    if (type === 'remark') {
      setCreating({ kind: 'remark', date });
      return;
    }
    const boxes = cursorDay.columns.slice(cells.firstColumn, cells.lastColumn + 1);
    const planning = boxes
      .filter((b) => b.column.kind === 'planning' || b.column.kind === 'secondary')
      .map((b) => b.column.id);
    if (type === 'marker') {
      // Marker immer über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026).
      setCreating({ kind: 'marker', date, at: cells.from, columns: MARKER_COLUMNS });
      return;
    }
    if (type === 'block') {
      const ids =
        planning.length > 0 ? planning : cursorDay.planning.slice(0, 1).map((c) => c.column.id);
      startDraft(
        { date, from: cells.from, to: cells.to, columns: { kind: 'ids', ids } },
        'block',
        'adjust',
      );
      return;
    }
    const special = cursorDay.columns.find(
      (c) => c.column.kind === (type === 'rapport' ? 'rap' : 'beso'),
    );
    if (special === undefined) {
      setStatus(
        `Dieser Tag hat keine ${type === 'rapport' ? 'Rap' : 'Beso'}-Spalte. Zuerst den Spaltensatz des Tages anpassen.`,
      );
      return;
    }
    startDraft(
      {
        date,
        from: cells.from,
        to: Math.max(cells.to, cells.from + 30),
        columns: { kind: 'ids', ids: [special.column.id] },
      },
      type,
      'adjust',
    );
  }

  function openCursorMenu(x: number, y: number, at: CellRange | null = cells): void {
    openMenu(
      'Leere Fläche',
      [
        { label: 'Neuer Block', key: 'N', disabled, run: () => createTypeAtCursor('block', at) },
        { label: 'Beso', key: 'B', disabled, run: () => createTypeAtCursor('beso', at) },
        { label: 'Rapport', key: 'R', disabled, run: () => createTypeAtCursor('rapport', at) },
        {
          label: 'Querbalken …',
          key: 'Q',
          disabled,
          run: () => createTypeAtCursor('querbalken', at),
        },
        { label: 'Marker …', key: 'M', disabled, run: () => createTypeAtCursor('marker', at) },
        {
          label: 'Ganztägige Bemerkung …',
          key: 'G',
          disabled,
          run: () => createTypeAtCursor('remark', at),
        },
        {
          label: 'Einfügen',
          key: 'Ctrl+V',
          disabled: disabled || clipboard.get() === null,
          separatorBefore: true,
          run: () =>
            paste(at === null ? pasteTarget(false, []) : { date: at.date, minute: at.from }),
        },
      ],
      x,
      y,
    );
  }

  function openEntryMenu(id: Id, windowId: Id | null, x: number, y: number): void {
    const entry = plan.entries[id];
    if (entry === undefined) return;
    const ids = groupOf(id);
    const setStatusOf = (status: Entry['status']) => {
      keepSelection.current = true;
      dispatch((p, ctx) => updateCommonFields(p, ids, { status }, ctx), itemKey({ id, windowId }));
    };
    openMenu(
      `${typeName(entry)} ${entryTitle(plan, entry)}`,
      [
        {
          label: 'Titel bearbeiten',
          key: 'F2',
          disabled:
            disabled ||
            (entry.type !== 'block' && entry.type !== 'rapport' && entry.type !== 'beso'),
          run: () => startEdit(entry, undefined, windowId),
        },
        { label: 'Seitenfeld', key: 'E', run: () => openPanel(null) },
        {
          label: 'Auch an anderen Tagen …',
          key: 'A',
          disabled: disabled || !('date' in entry),
          run: () => setOtherDays(entry.id),
        },
        {
          label: 'Kopieren',
          key: 'Ctrl+C',
          separatorBefore: true,
          run: () => copySelection(ids, false),
        },
        { label: 'Ausschneiden', key: 'Ctrl+X', run: () => copySelection(ids, true) },
        { label: 'Duplizieren', key: 'Ctrl+D', disabled, run: () => duplicate(ids) },
        ...(entry.type === 'block'
          ? [
              {
                label: 'Nach oben auffüllen',
                key: 'Ctrl+Shift+↑',
                disabled,
                run: () => fillBlock(entry, 'start'),
              },
              {
                label: 'Nach unten auffüllen',
                key: 'Ctrl+Shift+↓',
                disabled,
                run: () => fillBlock(entry, 'end'),
              },
            ]
          : []),
        {
          label: 'Status: bestätigt',
          separatorBefore: true,
          disabled,
          run: () => setStatusOf('confirmed'),
        },
        { label: 'Status: offen', disabled, run: () => setStatusOf('open') },
        {
          label: 'Streichen / Streichung aufheben',
          key: 'X',
          disabled,
          run: () => toggleCancelled(ids),
        },
        {
          label: 'Löschen',
          key: 'Entf',
          separatorBefore: true,
          disabled,
          run: () => removeEntries(ids),
        },
      ],
      x,
      y,
    );
  }

  /** Rechtsklick: Kontextmenü des Eintrags bzw. der leeren Fläche an der Zelle unter dem Zeiger (UI-Richtlinie 5.10). */
  function gridContextMenu(event: MouseEvent<HTMLElement>): void {
    // Langdruck auf Touch ist das Ziehen (UX-H-02), kein Kontextmenü.
    if (touchDrag.current || touchPending.current !== null) {
      event.preventDefault();
      return;
    }
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    // Eintrag nach dem Treffer aus der Geometrie (F-UX2 P4), sonst nach dem Element (Tastatur: Menütaste).
    const dayBody = target.closest<HTMLElement>('[data-day]');
    const hitDay = days.find((d) => d.date === dayBody?.dataset.day);
    if (dayBody !== null && hitDay !== undefined && !inEditor(target) && event.button === 2) {
      const h = hitInDay(hitDay, dayBody, event.clientX, event.clientY);
      if (h !== null) {
        event.preventDefault();
        if (!selectedIds.has(h.view.id)) setSelected({ id: h.view.id, windowId: h.view.windowId });
        openEntryMenu(h.view.id, h.view.windowId, event.clientX, event.clientY);
        return;
      }
    }
    const hit = target.closest<HTMLElement>('[data-entry-id]');
    if (hit !== null) {
      event.preventDefault();
      const id = hit.dataset.entryId ?? '';
      const windowId = hit.dataset.windowId === '' ? null : (hit.dataset.windowId ?? null);
      if (!selectedIds.has(id)) setSelected({ id, windowId });
      openEntryMenu(id, windowId, event.clientX, event.clientY);
      return;
    }
    if (target.closest('.i2-grid-empty') === null) return;
    event.preventDefault();
    const body = target.closest<HTMLElement>('[data-day]');
    const day = days.find((d) => d.date === body?.dataset.day);
    if (body === null || day === undefined) return;
    const rect = body.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const cell = normalizeCursor(
      {
        date: day.date,
        minute: plan.displayRange.from + (event.clientY - rect.top) / scale.minute,
        column: Math.max(0, columnAt(day.columns, x)),
      },
      days,
      bounds,
    );
    if (cell === null) return;
    setSelection([]);
    moveCursorTo(cell, false);
    openCursorMenu(event.clientX, event.clientY, cellRange(cell, null));
  }

  /** Neue Einträge aus den Dialogen (Querbalken, Marker, ganztägige Bemerkung); Fokus auf den neuen Eintrag. */
  function createFromDialog(
    request: CreateRequest,
    run: (p: Plan, ctx: CommandContext) => CommandResult & { readonly entryId: Id },
  ): void {
    setCreating(null);
    let created: Id | null = null;
    dispatch((p, ctx) => {
      const r = run(p, ctx);
      created = r.entryId;
      return r;
    });
    if (created === null) return;
    const id: Id = created;
    setSelected({ id, windowId: null });
    setPendingFocus(request.kind === 'remark' ? `agenda:${id}` : id);
  }

  // ---------------------------------------------------------------------------------------------
  // Terminbereich am Bildschirm (I3 C2; Beschrieb 4.8, 5.3): Klick wählt, Doppelklick bearbeitet
  // ---------------------------------------------------------------------------------------------

  function agendaLinesOf(date: IsoDate) {
    return agendaLines.get(date) ?? agendaLinesForDate(plan, date);
  }

  function focusAgenda(date: IsoDate, index: number): void {
    const lines = agendaLinesOf(date);
    const line = lines[Math.max(0, Math.min(index, lines.length - 1))];
    const button =
      line === undefined
        ? emptyButtons.current.get(`agenda-empty:${date}`)
        : agendaButtons.current.get(line.entryId);
    button?.focus();
  }

  function startAgendaEdit(date: IsoDate, id: Id | null): void {
    if (disabled) return;
    if (id === null) {
      setAgendaEdit({ id: null, date, value: '' });
      return;
    }
    const e = plan.entries[id];
    if (e?.type === 'beso')
      setAgendaEdit({ id, date, value: e.agendaOverride ?? plainTitle(plan, e.title) });
    else if (e?.type === 'dayRemark') setAgendaEdit({ id, date, value: e.text });
  }

  /** Übernimmt die Bearbeitung im Terminbereich: neue Bemerkung, Termintext eines Beso, Text einer Bemerkung. */
  function commitAgendaEdit(keep: boolean): void {
    const edit = agendaEdit;
    if (edit === null) return;
    setAgendaEdit(null);
    if (!keep) {
      if (edit.id !== null) setPendingFocus(`agenda:${edit.id}`);
      else emptyButtons.current.get(`agenda-empty:${edit.date}`)?.focus();
      return;
    }
    const text = edit.value.trim();
    if (!isRenderable(text)) {
      setStatus(
        'Ein Zeichen kann im PDF nicht dargestellt werden. Nicht übernommen; das Zeichen ersetzen.',
      );
      return;
    }
    if (edit.id === null) {
      if (text === '') {
        emptyButtons.current.get(`agenda-empty:${edit.date}`)?.focus();
        return;
      }
      createFromDialog({ kind: 'remark', date: edit.date }, (p, ctx) =>
        createEntry(p, { type: 'dayRemark', date: edit.date, text }, ctx),
      );
      return;
    }
    const id = edit.id;
    const e = plan.entries[id];
    if (e === undefined || text === '') {
      if (text === '')
        setStatus('Leerer Text wird nicht übernommen. Den Eintrag mit Entf löschen.');
      setPendingFocus(`agenda:${id}`);
      return;
    }
    if (e.type === 'dayRemark' && text !== e.text)
      dispatch((p, ctx) => updateEntry(p, id, 'dayRemark', { text }, ctx), `agenda:${id}`);
    else if (e.type === 'beso' && e.agendaOverride !== null && text !== e.agendaOverride)
      dispatch(
        (p, ctx) => updateEntry(p, id, 'beso', { agendaOverride: text }, ctx),
        `agenda:${id}`,
      );
    else if (e.type === 'beso' && e.agendaOverride === null && text !== plainTitle(plan, e.title))
      // Fette Teile bleiben erhalten: Maske folgt der Eingabe (gemeinsamer Anfang und Ende; CR-H-U-06).
      dispatch(
        (p, ctx) =>
          updateEntry(
            p,
            id,
            'beso',
            { title: richOf(editBold(boldTextOf(resolveTitle(plan, e.title)), text, false)) },
            ctx,
          ),
        `agenda:${id}`,
      );
    else setPendingFocus(`agenda:${id}`);
  }

  /** Tasten im Terminbereich: ↑/↓ Zeilen, ←/→ Nachbartag, Enter/F2 bearbeiten, Entf, E, X, Esc. */
  function agendaKey(
    event: KeyboardEvent<HTMLButtonElement>,
    date: IsoDate,
    id: Id | null,
    index: number,
  ): void {
    event.stopPropagation();
    const key = event.key.toLowerCase();
    const lines = agendaLinesOf(date);
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (index <= 0 || id === null) {
        const c = activeCursor;
        moveCursorTo(
          { date, minute: plan.displayRange.to - STEP, column: c?.date === date ? c.column : 0 },
          true,
        );
      } else focusAgenda(date, index - 1);
    } else if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (id !== null && index < lines.length - 1) focusAgenda(date, index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      // Nächste Terminspalte (zusammengefasstes Wochenende: Sa und So eine Spalte; VQA-3-04).
      const step = event.key === 'ArrowRight' ? 1 : -1;
      let i = days.findIndex((d) => d.date === date) + step;
      while (days[i] !== undefined && agendaHost((days[i] as DayBox).date) === agendaHost(date))
        i += step;
      const next = days[i];
      if (next !== undefined) focusAgenda(agendaHost(next.date), index);
    } else if (event.key === 'Enter' || event.key === 'F2') {
      event.preventDefault();
      startAgendaEdit(date, id);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setSelection([]);
      moveCursorTo({ date, minute: plan.displayRange.to - STEP, column: 0 }, true);
    } else if (id === null) {
      if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
        event.preventDefault();
        const r = event.currentTarget.getBoundingClientRect();
        openDayMenu(days.find((d) => d.date === date) as DayBox, r.left, r.top);
      }
    } else if (event.key === 'Delete') {
      event.preventDefault();
      removeEntries([id]);
    } else if (event.key === ' ') {
      event.preventDefault();
      setSelected({ id, windowId: null });
    } else if (key === 'e' && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      setSelected({ id, windowId: null });
      openPanel(null);
    } else if (key === 'x' && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      toggleCancelled([id]);
    } else if ((event.key === 'F10' && event.shiftKey) || event.key === 'ContextMenu') {
      event.preventDefault();
      const r = event.currentTarget.getBoundingClientRect();
      openEntryMenu(id, null, r.left, r.bottom);
    }
  }

  /**
   * Terminbereich eines Tages aus dem Zwischenspeicher (PERF, R-5.1-14): neu erzeugt nur bei geänderten Terminzeilen,
   * Auswahl darin, Bearbeitung an diesem Tag oder Plan – nicht beim Ziehen im Raster.
   */
  function cachedAgenda(day: DayBox): JSX.Element {
    const lines = agendaLinesOf(day.date);
    const edit =
      agendaEdit !== null &&
      (agendaEdit.id === null
        ? (agendaGroups.get(day.date) ?? [day.date]).includes(agendaEdit.date)
        : lines.some((l) => l.entryId === agendaEdit.id))
        ? agendaEdit
        : null;
    const chosen = lines
      .filter((l) => selectedIds.has(l.entryId))
      .map((l) => l.entryId)
      .join('|');
    return cached(
      `agenda:${day.date}`,
      [
        day,
        lines,
        agendaLayouts.get(day.date),
        plan.entries,
        agendaHeight,
        disabled,
        edit,
        chosen,
        agendaFrame,
        dpr,
        agendaWidth(day),
      ],
      () => agendaCell(day),
    );
  }

  function agendaCell(day: DayBox): JSX.Element {
    const lines = agendaLinesOf(day.date);
    const laid = agendaLayouts.get(day.date);
    const units = new Map((laid?.units ?? []).map((u) => [u.entryId, u] as const));
    const contentPx = laid?.contentPx ?? 0;
    const editNew =
      agendaEdit !== null &&
      agendaEdit.id === null &&
      (agendaGroups.get(day.date) ?? [day.date]).includes(agendaEdit.date);
    // Gemeinsame Spalte Sa+So: Doppelklick bzw. Kontextmenü in der Hälfte des So gilt dem So (UX-AB-19).
    const dateAt = (clientX: number, element: HTMLElement): IsoDate => {
      const dates = agendaGroups.get(day.date) ?? [day.date];
      const x = clientX - element.getBoundingClientRect().left;
      const hit = days.find(
        (d) => dates.includes(d.date) && x >= d.left - day.left && x < d.left - day.left + d.width,
      );
      return hit?.date ?? day.date;
    };
    // Handler über `on`: das Element kann aus einem früheren Neuzeichnen stammen (Zwischenspeicher, PERF).
    const input = (edit: AgendaEdit, top: number) => (
      <input
        className="i2-grid-agenda-input"
        style={{ top }}
        aria-label={edit.id === null ? 'Text der Bemerkung' : 'Termintext'}
        // biome-ignore lint/a11y/noAutofocus: Bearbeitung im Terminbereich beginnt im Feld (Doppelklick, Enter)
        autoFocus
        value={edit.value}
        onChange={(event) => setAgendaEdit({ ...edit, value: event.target.value })}
        onBlur={() => on.current.commitAgendaEdit(true)}
        onKeyDown={(event) => {
          // Route-Kürzel übernehmen den Text und wirken weiter (CR-U-2-02).
          if (routeKey(event)) {
            on.current.commitAgendaEdit(true);
            return;
          }
          event.stopPropagation();
          if (event.nativeEvent.isComposing) return;
          if (event.key === 'Enter') {
            event.preventDefault();
            on.current.commitAgendaEdit(true);
          } else if (event.key === 'Escape') {
            event.preventDefault();
            on.current.commitAgendaEdit(false);
          }
        }}
      />
    );
    // Zusammengefasstes Wochenende: die Spalte des Sa reicht über den So (wie im PDF; VQA-3-04).
    const widthPx = agendaWidth(day);
    const wide = widthPx > day.width + 0.5;
    return (
      <td
        className="i2-grid-agenda"
        style={
          wide ? { height: agendaHeight, width: widthPx, zIndex: 2 } : { height: agendaHeight }
        }
        aria-label={`Terminbereich ${day.weekday} ${formatDate(day.date, 'long')}`}
        // Rollt der Terminbereich tatsächlich, ist er per Tastatur erreichbar (I5 D5, WCAG 2.1.1; H-UI2 SA-H-07):
        // `tabindex` setzt die Messung nach dem Zeichnen (useAgendaFocus), nicht eine Schätzung aus den Zeilen.
        data-agenda-cell=""
      >
        <button
          type="button"
          className="i2-grid-agenda-empty"
          tabIndex={-1}
          disabled={disabled}
          aria-label={`Termine ${day.weekday}: neue ganztägige Bemerkung (Doppelklick oder Enter)`}
          data-agenda=""
          ref={(element) => {
            if (element === null) emptyButtons.current.delete(`agenda-empty:${day.date}`);
            else emptyButtons.current.set(`agenda-empty:${day.date}`, element);
          }}
          onPointerDown={() => setSelection([])}
          onDoubleClick={(event) =>
            on.current.startAgendaEdit(dateAt(event.clientX, event.currentTarget), null)
          }
          onKeyDown={(event) => on.current.agendaKey(event, day.date, null, lines.length)}
          onContextMenu={(event) => {
            event.preventDefault();
            const date = dateAt(event.clientX, event.currentTarget);
            on.current.openDayMenu(
              days.find((d) => d.date === date) ?? day,
              event.clientX,
              event.clientY,
            );
          }}
        />
        {/* Terminzeilen: vorberechnete Zeilen der Layout-Schicht (Schrift WAP Arimo, white-space: pre), nie vom
            Browser umgebrochen; jede Terminzeile ist ein Knopf über ihrer Fläche (CR-H-U-04, ADR-004 Punkt 4). */}
        {/* Wie auf der Wochenseite (VQA-2-02): Termine-Oberlinie, «Was»-Zeile und -Linie, Tageskante; die
            Terminzeilen beginnen an der Lage der Seite. */}
        {agendaFrame !== null && (
          <span className="i2-grid-agenda-chrome" aria-hidden="true">
            {[agendaFrame.topLinePx, agendaFrame.wasLinePx].map((y) => {
              const w = strokePx(agendaFrame.lineWidthPt);
              return (
                <span
                  key={y}
                  className="i2-grid-line-h"
                  data-linie="termine"
                  style={{
                    top: snap(y) - Math.floor((w * dpr) / 2) / dpr,
                    height: w,
                    width: snapX(day, widthPx),
                  }}
                />
              );
            })}
            <span
              className="i2-grid-line-v"
              data-linie="tag"
              style={{
                left: snapX(day, widthPx) - strokePx(lineStyles.dayBorder.widthPt),
                width: strokePx(lineStyles.dayBorder.widthPt),
                height: agendaHeight,
              }}
            />
            <Lines lines={agendaFrame.was.get(day.date) ?? NO_LINES} left={dayShift(day)} />
          </span>
        )}
        <ul
          className="i2-grid-agenda-list"
          style={{
            height: Math.max(contentPx, editNew ? contentPx + 20 : 0),
            marginTop: agendaFrame?.textTopPx ?? 0,
            left: dayShift(day),
          }}
          aria-label={`Termine ${day.weekday} ${formatDate(day.date, 'long')}`}
        >
          {lines.map((line, index) => {
            const e = plan.entries[line.entryId];
            const unit = units.get(line.entryId);
            const isSelected = selectedIds.has(line.entryId);
            const editing = agendaEdit !== null && agendaEdit.id === line.entryId;
            const text = line.text.map((r) => r.text).join('');
            const top = unit?.top ?? 0;
            return (
              <li
                key={line.entryId}
                className="i2-grid-agenda-item"
                style={{ top, height: unit?.height ?? 0 }}
              >
                {editing && agendaEdit !== null ? (
                  input(agendaEdit, 0)
                ) : (
                  <button
                    type="button"
                    className={`i2-grid-agenda-line${isSelected ? ' is-selected' : ''}`}
                    tabIndex={-1}
                    aria-pressed={isSelected}
                    aria-label={`Terminzeile ${text}${e?.status === 'cancelled' ? ', gestrichen' : e?.status === 'open' ? ', offen' : ''}`}
                    data-agenda=""
                    ref={(element) => {
                      if (element === null) agendaButtons.current.delete(line.entryId);
                      else agendaButtons.current.set(line.entryId, element);
                    }}
                    onFocus={() => {
                      if (
                        !keepSelection.current &&
                        !(on.current.selection.length === 1 && isSelected)
                      )
                        setSelected({ id: line.entryId, windowId: null });
                    }}
                    onClick={() => {
                      setSelected({ id: line.entryId, windowId: null });
                    }}
                    onDoubleClick={() => on.current.startAgendaEdit(day.date, line.entryId)}
                    onKeyDown={(event) =>
                      on.current.agendaKey(event, day.date, line.entryId, index)
                    }
                    onContextMenu={(event) => {
                      event.preventDefault();
                      setSelected({ id: line.entryId, windowId: null });
                      on.current.openEntryMenu(line.entryId, null, event.clientX, event.clientY);
                    }}
                  >
                    {/* Zeilen direkt im Knopf: der erste Lauf trägt Farbe und Durchstreichung (Status). */}
                    {unit?.lines.map((l, i) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: Zeilen in fester Reihenfolge
                      <Line key={i} line={l} />
                    ))}
                  </button>
                )}
              </li>
            );
          })}
          {editNew && agendaEdit !== null && (
            <li className="i2-grid-agenda-item" style={{ top: contentPx, height: 20 }}>
              {input(agendaEdit, 0)}
            </li>
          )}
        </ul>
      </td>
    );
  }

  // ---------------------------------------------------------------------------------------------
  // Darstellung
  // ---------------------------------------------------------------------------------------------

  /** Zelle unter dem Zeiger in einer Spalte (für Klick und Doppelklick in Rap- und Beso-Spalte). */
  function cellAt(event: { readonly clientY: number }, day: DayBox, columnId: Id): Cursor | null {
    const body = wrapperRef.current?.querySelector(`[data-day="${day.date}"]`);
    if (!(body instanceof HTMLElement)) return null;
    const minute =
      plan.displayRange.from + (event.clientY - body.getBoundingClientRect().top) / scale.minute;
    const column = day.columns.findIndex((c) => c.column.id === columnId);
    return normalizeCursor({ date: day.date, minute, column }, days, bounds);
  }

  /** Zellzeiger (B1): sichtbarer Rahmen über der Zelle bzw. dem Bereich, der eine Tab-Stopp des Rasters. */
  function cursorElement(day: DayBox, r: CellRange): JSX.Element {
    const first = day.columns[r.firstColumn];
    const last = day.columns[r.lastColumn] ?? first;
    const left = first?.left ?? 0;
    const width = (last?.left ?? 0) + (last?.width ?? 0) - left;
    return (
      <button
        type="button"
        ref={cursorRef}
        className={`i2-grid-cursor${anchor !== null ? ' is-range' : ''}`}
        aria-roledescription="Zellzeiger"
        aria-label={cursorName}
        aria-describedby={hintId}
        tabIndex={cursorTabbable ? 0 : -1}
        onFocus={() => setFocusKey('cursor')}
        style={{
          left,
          width: Math.max(4, width - 1),
          top: (r.from - plan.displayRange.from) * scale.minute,
          height: Math.max(4, (r.to - r.from) * scale.minute),
        }}
      />
    );
  }

  /**
   * Tageskopf mit Spaltenköpfen aus dem Zwischenspeicher (PERF, R-5.1-14): neu erzeugt nur bei geänderten Köpfen,
   * Tagesauswahl oder Umbenennen an diesem Tag – nicht beim Ziehen im Raster.
   */
  function dayHeadCell(day: DayBox): JSX.Element {
    const edit = colEdit !== null && colEdit.date === day.date ? colEdit : null;
    return cached(
      `head:${day.date}`,
      [day, heads.get(day.date), headHeight, daySelection.includes(day.date), edit, disabled, dpr],
      () => (
        <th
          scope="row"
          className="i2-grid-day-head"
          style={{ height: DAY_LABEL_HEIGHT + headHeight + 1 }}
        >
          <strong>
            <button
              type="button"
              className="i2-grid-day-select"
              aria-label={`Tag ${day.weekday} ${formatDate(day.date, 'long')}`}
              aria-pressed={daySelection.includes(day.date)}
              title="Klick wählt den Tag (Ctrl/Shift: mehrere) · Seitenfeld «Tag»: Spaltensatz, Darstellung"
              tabIndex={-1}
              data-day-head={day.date}
              ref={(element) => {
                if (element === null) emptyButtons.current.delete(`day:${day.date}`);
                else emptyButtons.current.set(`day:${day.date}`, element);
              }}
              onClick={(event) => on.current.selectDay(day.date, event)}
              onKeyDown={(event) => on.current.dayHeadKey(event, day)}
              onContextMenu={(event) => {
                event.preventDefault();
                on.current.selectDay(day.date, null);
                on.current.openDayMenu(day, event.clientX, event.clientY);
              }}
            >
              {day.weekday} {formatDate(day.date, 'long')}
            </button>
            {heads.get(day.date)?.tooManyColumns === true && (
              <span
                className="i2-grid-day-warning"
                role="img"
                aria-label={TOO_MANY_COLUMNS}
                title={TOO_MANY_COLUMNS}
              >
                !
              </span>
            )}
          </strong>
          <div className="i2-grid-column-heads" style={{ height: headHeight }}>
            <Lines lines={heads.get(day.date)?.lines ?? NO_LINES} left={dayShift(day)} />
            {day.planning.length === 0 && (
              <span className="i2-grid-colhead-hint" title={NO_COLUMN_SET}>
                {NO_COLUMN_SET}
              </span>
            )}
            {day.columns.map((c, index) => {
              const editingHead =
                colEdit !== null && colEdit.date === day.date && colEdit.columnId === c.column.id;
              const headKey = `head:${day.date}:${c.column.id}`;
              return (
                <span
                  key={c.column.id}
                  className="i2-grid-colhead-cell"
                  style={{
                    width: snapX(day, c.left + c.width) - snapX(day, c.left),
                    ...(index === 0
                      ? {}
                      : { borderLeftWidth: strokePx(lineStyles.columnBorder.widthPt) }),
                  }}
                >
                  {editingHead ? (
                    <input
                      className="i2-grid-colhead-input"
                      aria-label="Spaltenname"
                      // biome-ignore lint/a11y/noAutofocus: Umbenennen beginnt im Feld (A8)
                      autoFocus
                      value={colEdit.value}
                      onFocus={(event) => event.currentTarget.select()}
                      onChange={(event) => setColEdit({ ...colEdit, value: event.target.value })}
                      onBlur={() => on.current.finishColumnEdit(true)}
                      onKeyDown={(event) => {
                        // Route-Kürzel übernehmen den Namen und wirken weiter (CR-U-2-02).
                        if (routeKey(event)) {
                          on.current.finishColumnEdit(true);
                          return;
                        }
                        event.stopPropagation();
                        if (event.nativeEvent.isComposing) return;
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          on.current.finishColumnEdit(true);
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          on.current.finishColumnEdit(false);
                        } else if (event.key === 'Tab') {
                          event.preventDefault();
                          on.current.finishColumnEdit(true, true);
                        }
                      }}
                    />
                  ) : (
                    <button
                      type="button"
                      className={`i2-grid-colhead${c.width < 34 ? ' is-vertical' : ''}`}
                      aria-label={`Spaltenkopf ${c.column.name}`}
                      title={`${c.column.name} · Doppelklick oder F2 benennt um · Rechtsklick: einfügen, entfernen`}
                      ref={(element) => {
                        if (element === null) emptyButtons.current.delete(headKey);
                        else emptyButtons.current.set(headKey, element);
                      }}
                      disabled={disabled}
                      tabIndex={-1}
                      data-head=""
                      onDoubleClick={() => on.current.openColumnEdit(day.date, c.column)}
                      onKeyDown={(event) => on.current.columnHeadKey(event, day, index)}
                      onContextMenu={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        on.current.openColumnMenu(day, index, event.clientX, event.clientY);
                      }}
                    ></button>
                  )}
                  {c.column.kind === 'planning' && (
                    // biome-ignore lint/a11y/useSemanticElements: ziehbarer Trenner mit Wert (WAI-ARIA separator)
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={`Breite von «${c.column.name}»`}
                      aria-valuemin={1}
                      aria-valuemax={3}
                      aria-valuenow={
                        c.column.weight === 'narrow' ? 1 : c.column.weight === 'wide' ? 3 : 2
                      }
                      aria-valuetext={weightName(c.column.weight)}
                      tabIndex={-1}
                      className="i2-grid-col-resize"
                      onPointerDown={(event) => on.current.beginWeightDrag(event, day, index)}
                      onKeyDown={(event) => {
                        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
                        event.preventDefault();
                        event.stopPropagation();
                        const weight = stepWeight(
                          c.column.weight,
                          event.key === 'ArrowRight' ? 1 : -1,
                        );
                        if (weight !== c.column.weight)
                          on.current.askScope(
                            day,
                            c.column.id,
                            { weight },
                            `Breite von «${c.column.name}» ändern`,
                          );
                      }}
                    />
                  )}
                </span>
              );
            })}
          </div>
        </th>
      ),
    );
  }

  /**
   * Linien des Tages wie im PDF (F-UX2 P3; Vorlage B-Kp-38 bis -46): Halbstunden fein, Stunden gestrichelt, Spalten-
   * grenzen, Trennlinie vor der Rap-Spalte gestrichelt, Bahngrenze der Beso-Spalte, Tageskante. Eine Linie der Stärke
   * s liegt ab round(x) − ⌊s/2⌋, die Tageskante innen am rechten Rand. Aus dem Zwischenspeicher (PERF).
   */
  function gridLines(day: DayBox): JSX.Element {
    return cached(
      `lines:${day.date}`,
      [day, scale, dpr, bodyTopPx, plan.displayRange.from, plan.displayRange.to, lineStyles],
      () => {
        const f = screenFactor(scale);
        const height = snapY(gridHeight);
        const width = snapX(day, day.width);
        const out: JSX.Element[] = [];
        const vertical = (key: string, x: number, stroke: Stroke, kind: string) => {
          const w = strokePx(stroke.widthPt);
          const left = kind === 'tag' ? width - w : snapX(day, x) - Math.floor((w * dpr) / 2) / dpr;
          out.push(
            <span
              key={key}
              className={`i2-grid-line-v${stroke.dash === null ? '' : ' is-dashed'}`}
              data-linie={kind}
              style={{
                left,
                width: w,
                height,
                ...(stroke.dash === null
                  ? {}
                  : {
                      ['--i2-dash' as string]: `${String(stroke.dash[0] ?? 1)}px`,
                      ['--i2-gap' as string]: `${String(stroke.dash[1] ?? 1)}px`,
                      backgroundSize: `100% ${String(((stroke.dash[0] ?? 1) + (stroke.dash[1] ?? 1)) * f)}px`,
                      backgroundImage: `linear-gradient(to bottom, var(--i2-ink-line) 0 ${String((stroke.dash[0] ?? 1) * f)}px, transparent ${String((stroke.dash[0] ?? 1) * f)}px)`,
                    }),
              }}
            />,
          );
        };
        const horizontal = (key: string, y: number, stroke: Stroke, kind: string) => {
          const w = strokePx(stroke.widthPt);
          const top = snapY(y) - Math.floor((w * dpr) / 2) / dpr;
          out.push(
            <span
              key={key}
              className={`i2-grid-line-h${stroke.dash === null ? '' : ' is-dashed'}`}
              data-linie={kind}
              style={{
                top,
                height: w,
                width,
                ...(stroke.dash === null
                  ? {}
                  : {
                      backgroundSize: `${String(((stroke.dash[0] ?? 1) + (stroke.dash[1] ?? 1)) * f)}px 100%`,
                      backgroundImage: `linear-gradient(to right, var(--i2-ink-line) 0 ${String((stroke.dash[0] ?? 1) * f)}px, transparent ${String((stroke.dash[0] ?? 1) * f)}px)`,
                    }),
              }}
            />,
          );
        };
        const { hours, halves } = hourTimes(plan.displayRange);
        for (const t of halves)
          horizontal(
            `h${String(t)}`,
            (t - plan.displayRange.from) * scale.minute,
            lineStyles.halfHour,
            'halb',
          );
        for (const t of hours)
          horizontal(
            `s${String(t)}`,
            (t - plan.displayRange.from) * scale.minute,
            lineStyles.hour,
            'stunde',
          );
        day.columns.forEach((c, j) => {
          if (j > 0)
            vertical(
              `c${c.column.id}`,
              c.left,
              c.column.kind === 'rap' ? lineStyles.rapSeparator : lineStyles.columnBorder,
              'spalte',
            );
          if (c.column.kind === 'beso')
            vertical(`b${c.column.id}`, c.left + c.width / 2, lineStyles.laneBorder, 'bahn');
        });
        vertical('tag', day.width, lineStyles.dayBorder, 'tag');
        return (
          <span className="i2-grid-gridlines" aria-hidden="true">
            {out}
          </span>
        );
      },
    );
  }

  /** Zustand, den das Element einer Ansicht zeichnet (zugleich Schlüssel des Zwischenspeichers, PERF). */
  function viewState(view: EntryView): ViewState {
    const isSelected = selectedKeys.has(view.id) || selectedKeys.has(itemKey(view));
    const key = view.windowId === null ? view.id : `${view.id}:${view.windowId}`;
    return {
      key,
      isSelected,
      isDragged:
        drag !== null &&
        drag.entryId === view.id &&
        (drag.windowId === null || drag.windowId === view.windowId),
      adjusting: previewIds.has(view.id) || view.id.includes('~'),
      focused: focusKey === key,
      cut: cutIds.has(view.id),
      p1: p1Ids.has(view.id),
      handles:
        isSelected && selection.length === 1 && !disabled && editing === null && drag === null,
      ...neighbourMark(view),
    };
  }

  /** Hervorhebung und Plakette eines Nachbarn beim Ziehen (Runde 3; Zeiten aus dem Plan vor der Geste). */
  function neighbourMark(view: EntryView): Pick<ViewState, 'motion' | 'tag'> {
    const a = drag?.arrangement;
    if (drag === null) return { motion: null, tag: '' };
    if (drag.mode === 'none')
      return { motion: drag.entryId === view.id ? 'parallel' : null, tag: '' };
    const motion = drag.mode === 'shift' ? 'follow' : 'adjust';
    if (view.id.includes('~')) return { motion, tag: 'Teil' };
    if (a === null || a === undefined) return { motion: null, tag: '' };
    if (a.dock === view.id) return { motion: 'adjust', tag: 'dockt an' };
    const sign = (d: number) => `${d > 0 ? '+' : '−'}${durationText(d)}`;
    const index = neighbourIndex;
    // Mitrückender Rapport bzw. Beso-Zeitfenster (Runde 4).
    const x = index.shiftIds.has(view.id)
      ? index.shifts.find(
          (y) => y.id === view.id && (y.windowId === null || y.windowId === view.windowId),
        )
      : undefined;
    if (x !== undefined) return { motion, tag: sign(x.delta) };
    const c = index.changes.get(view.id);
    if (c === undefined) return { motion: null, tag: '' };
    if (index.splitIds.has(view.id)) return { motion, tag: 'geteilt' };
    const e = plan.entries[view.id];
    if (e?.type !== 'block' || e.time.form !== 'range') return { motion, tag: '' };
    const dauer = c.to - c.from - (e.time.to - e.time.from);
    const lage = c.from - e.time.from;
    // Shift: Versatz; ohne Taste: Dauer (schrumpft/wächst) bzw. «rückt» (verdrängt, Dauer gleich).
    if (drag.mode === 'shift') return { motion, tag: lage === 0 ? '' : sign(lage) };
    if (dauer !== 0) return { motion, tag: sign(dauer) };
    return { motion, tag: lage === 0 ? '' : `rückt ${sign(lage)}` };
  }

  /**
   * Element einer Ansicht aus dem Zwischenspeicher des Tages (PERF, R-5.1-14): neu erzeugt nur, wenn sich die Ansicht
   * selbst oder ihr Zustand geändert hat. Beim Ziehen sind das der gezogene Eintrag, die Vorschau und die Nachbarn.
   */
  function cachedView(
    day: DayBox,
    view: EntryView,
    before: ReadonlyMap<string, ViewSlot>,
    now: Map<string, ViewSlot>,
  ): JSX.Element {
    const s = viewState(view);
    const deps = [
      day,
      view,
      s.isSelected,
      s.isDragged,
      s.adjusting,
      s.focused,
      s.cut,
      s.p1,
      s.handles,
      s.motion,
      s.tag,
      disabled,
      // Rundung auf Gerätepixel (P3).
      dpr,
      bodyTopPx,
      // Prüfmarke (I5 D1): Stufe und Text zeichnet das Element.
      findingMarks?.get(view.id)?.severity,
      findingMarks?.get(view.id)?.text,
    ];
    const known = before.get(view.key);
    if (known !== undefined && sameDeps(known.deps, deps)) {
      now.set(view.key, known);
      return known.element;
    }
    const element = viewElement(day, view, s);
    now.set(view.key, { deps, element });
    return element;
  }

  /**
   * Einträge eines Tages (F-PERF, FL2-04): ein Tag, den die Geste nicht betrifft, gibt beim Ziehen dasselbe Element
   * zurück (React überspringt ihn ganz); betroffene Tage je Ansicht aus dem Zwischenspeicher des Tages. `deps` sind
   * alle tagesübergreifenden Daten, die viewState und viewElement lesen.
   */
  function dayEntries(day: DayBox): JSX.Element {
    const list =
      drag === null
        ? sortedViews(views.get(day.date))
        : stableViews(laidViews.get(day.date) ?? NO_VIEWS, views.get(day.date));
    const affected = drag !== null && (dragDates === null || dragDates.has(day.date));
    const deps = [
      day,
      list,
      selectedKeys,
      selection.length,
      focusKey,
      cutIds,
      p1Ids,
      disabled,
      editing === null,
      drag === null,
      affected ? drag : null,
      affected ? neighbourIndex : null,
      dpr,
      bodyTopPx,
      findingMarks,
    ];
    const known = dayCache.current.get(day.date);
    if (known !== undefined && sameDeps(known.deps, deps)) return known.element;
    const before = known?.views ?? new Map<string, ViewSlot>();
    const now = new Map<string, ViewSlot>();
    const element = <Fragment>{list.map((view) => cachedView(day, view, before, now))}</Fragment>;
    dayCache.current.set(day.date, { deps, element, views: now });
    return element;
  }

  function viewElement(day: DayBox, view: EntryView, s: ViewState): JSX.Element {
    const isPreview = view.id.includes('~');
    const { isSelected, isDragged, adjusting, key } = s;
    const short = view.rect.height < 30;
    const rendered = view.render !== undefined;
    const simple = view.render?.simple ?? null;
    // Bündig (P3): Rechteck auf ganze Gerätepixel wie die Linien.
    const at = snapRect(day, view.rect);
    const style: CSSProperties = rendered
      ? {
          left: at.left,
          top: at.top,
          width: at.width,
          height: at.height,
          zIndex: view.z + (isSelected ? 20 : 0),
          ...(simple === null
            ? {}
            : {
                background: simple.fill,
                // Rand auf ganze Gerätepixel wie die Rasterlinien (P3, CR-U-2-05).
                boxShadow: `inset 0 0 0 ${String(Math.max(1, Math.round(simple.borderPx * dpr)) / dpr)}px ${simple.border}`,
              }),
        }
      : {
          left: view.rect.left,
          top: view.rect.top,
          width: Math.max(
            view.kind === 'marker' ? 20 : 12,
            view.rect.width - (view.kind === 'querbalken' && !view.last ? 0 : 2),
          ),
          height: view.rect.height,
          zIndex: view.z + (isSelected ? 20 : 0),
          ...(view.pieces.length === 0 && view.kind !== 'marker'
            ? { background: view.fill, color: view.ink }
            : { color: view.ink }),
        };
    const className = [
      'i2-grid-entry',
      `i2-grid-${view.kind}`,
      isSelected ? 'is-selected' : '',
      short ? 'is-short' : '',
      adjusting ? 'is-adjusting' : '',
      isDragged ? 'is-dragged' : '',
      s.motion === 'follow'
        ? 'is-shift-follow is-follow'
        : s.motion === 'adjust'
          ? 'is-adjust-follow is-follow'
          : s.motion === 'parallel'
            ? 'is-parallel'
            : '',
      view.cancelled ? 'is-cancelled' : '',
      rendered ? 'is-rendered' : '',
      s.cut ? 'is-cut' : '',
      s.p1 ? 'i2-grid-p1' : '',
      view.kind === 'querbalken'
        ? `${view.first ? 'is-first' : ''} ${view.last ? 'is-last' : ''}`
        : '',
    ]
      .filter((c) => c !== '')
      .join(' ');
    const content =
      view.render !== undefined ? null : (
        <>
          <strong>{view.text || (view.kind === 'block' ? 'Ohne Titel' : '')}</strong>
          {!short && view.sub !== '' && <span>{view.sub}</span>}
        </>
      );
    // Formen wie die Rasterlinien auf Gerätepixel gerundet, Zeilen an ihrer wahren Lage (P3).
    const origin = { x: AXIS_WIDTH + day.left, y: bodyTopPx };
    const pixel = {
      x: origin.x + view.rect.left,
      y: origin.y + view.rect.top,
      ex: snap(origin.x) + at.left,
      ey: snap(origin.y) + at.top,
      dpr,
    };
    const drawing = view.render !== undefined && (
      <RenderedEntry render={view.render} snap={pixel} />
    );
    if (isPreview)
      return (
        <div
          key={view.key}
          className={className}
          style={style}
          data-view-key={view.key}
          aria-hidden="true"
          {...(simple === null ? {} : { 'data-flaeche': '' })}
        >
          {drawing}
          {content}
          {s.tag !== '' && <span className="i2-grid-tag">{s.tag}</span>}
        </div>
      );
    // Handler über `on`: das Element kann aus einem früheren Neuzeichnen stammen (Zwischenspeicher, PERF).
    const entryNow = () => on.current.plan.entries[view.id];
    const resizable = view.kind === 'block' || view.kind === 'rapport';
    const edgeKind = (event: PointerEvent<HTMLElement>): GestureKind => {
      if (!resizable || view.rect.height < 18) return 'move';
      const box = event.currentTarget.getBoundingClientRect();
      if (event.clientY - box.top <= 5) return 'start';
      if (box.bottom - event.clientY <= 5) return 'end';
      return 'move';
    };
    return (
      <div
        key={view.key}
        className={className}
        style={style}
        data-view-key={view.key}
        {...(simple === null ? {} : { 'data-flaeche': '' })}
        {...(s.p1
          ? {
              title:
                'Spalte fehlt im Spaltensatz dieses Tages (Befund P1): Spalte wählen (S) oder den Spaltensatz des Tages anpassen.',
            }
          : {})}
      >
        {drawing}
        {/* Plakette des Nachbarn beim Ziehen (Runde 3): «+45 Min», «dockt an» usw.; im Namen nicht angesagt. */}
        {s.tag !== '' && (
          <span className="i2-grid-tag" aria-hidden="true">
            {s.tag}
          </span>
        )}
        {view.changed === true && !view.id.includes('~') && (
          // Marke «geändert» bis zum nächsten Stand (UI-Richtlinie 4.2; R-4.6-67; nur Bildschirm, nie im PDF).
          <span
            className="i2-grid-changed"
            aria-hidden="true"
            title="geändert seit letztem Stand"
          />
        )}
        {findingMarks?.has(view.id) === true && !view.id.includes('~') && (
          <span
            className={`i2-grid-finding is-${findingMarks.get(view.id)?.severity ?? 'error'}`}
            aria-hidden="true"
            title={findingMarks.get(view.id)?.text}
          />
        )}
        {view.pieces.map((p) => (
          <div
            key={`${p.left}:${p.top}`}
            className="i2-grid-piece"
            aria-hidden="true"
            style={{
              left: p.left,
              top: p.top,
              width: p.width,
              height: p.height,
              background: view.fill,
            }}
          />
        ))}
        {(view.cancelled || view.changed === true) && (
          <span id={`${statusIdBase}-${key}`} hidden>
            {[
              view.cancelled ? 'gestrichen' : '',
              view.changed === true ? 'geändert seit letztem Stand' : '',
            ]
              .filter((w) => w !== '')
              .join(', ')}
          </span>
        )}
        <button
          type="button"
          className="i2-grid-entry-hit"
          aria-label={view.label}
          // Status als Beschreibung (H-UI2, SA-H-09 und ux-critic «gestrichen»; UI-Richtlinie 4.2, 14.2).
          {...(view.cancelled || view.changed === true
            ? { 'aria-describedby': `${statusIdBase}-${key}` }
            : {})}
          aria-pressed={isSelected}
          tabIndex={s.focused ? 0 : -1}
          ref={(element) => {
            if (element === null) entryButtons.current.delete(key);
            else entryButtons.current.set(key, element);
          }}
          style={
            view.pieces.length > 0
              ? {
                  paddingLeft: (view.pieces[view.textPiece]?.left ?? 0) + 4,
                  paddingTop: (view.pieces[view.textPiece]?.top ?? 0) + 2,
                }
              : undefined
          }
          onClick={(event) => {
            if (draggedClick.current) {
              draggedClick.current = false;
              return;
            }
            // Gewählt wird beim Drücken nach dem Treffer aus der Geometrie (F-UX2 P4), nicht nach dem Element unter
            // dem Zeiger; Enter/Leertaste über die Tastatur (B1).
            void event;
          }}
          onDoubleClick={() => {
            const entry = entryNow();
            if (entry !== undefined) on.current.startEdit(entry, undefined, view.windowId);
          }}
          data-entry-id={view.id}
          data-window-id={view.windowId ?? ''}
          onFocus={(event) => {
            setFocusKey(key);
            if (!keepSelection.current && !(on.current.selection.length === 1 && isSelected))
              setSelected({ id: view.id, windowId: view.windowId });
            on.current.hoverLater(view, event.currentTarget, FOCUS_DELAY);
          }}
          onBlur={() => on.current.hoverEnd()}
          onPointerDown={(event) => on.current.beginGesture(event, day, edgeKind(event), view)}
        >
          {content}
        </button>
        {s.handles &&
          (view.kind === 'block'
            ? (['start', 'end', 'left', 'right'] as const)
            : view.kind === 'rapport'
              ? (['start', 'end'] as const)
              : view.kind === 'querbalken'
                ? ([...(view.first ? ['left'] : []), ...(view.last ? ['right'] : [])] as (
                    | 'left'
                    | 'right'
                  )[])
                : []
          ).map((kind) => (
            <button
              key={kind}
              type="button"
              tabIndex={-1}
              className={`i2-grid-handle i2-grid-handle-${kind}`}
              aria-label={
                view.kind === 'querbalken'
                  ? kind === 'left'
                    ? 'Ersten Tag ändern'
                    : 'Letzten Tag ändern'
                  : {
                      start: 'Beginn ändern',
                      end: 'Ende ändern',
                      left: 'Linke Spaltengrenze ändern',
                      right: 'Rechte Spaltengrenze ändern',
                    }[kind]
              }
              onPointerDown={(event) => on.current.beginGesture(event, day, kind, view)}
              onClick={() => {
                if (draggedClick.current) {
                  draggedClick.current = false;
                  return;
                }
                const entry = entryNow();
                if (entry?.type === 'block') on.current.beginForm(entry);
              }}
            />
          ))}
      </div>
    );
  }

  /** Ziehen aus der Direktbearbeitung heraus: übernehmen, dann wie ein Ziehen am Block ab dem Druckpunkt. */
  function moveFromEdit(
    view: EntryView,
    day: DayBox,
    start: { readonly x: number; readonly y: number; readonly pointerId: number },
    now: { readonly clientX: number; readonly clientY: number },
  ): void {
    if (!commitEdit(false)) return;
    const button = entryButtons.current.get(itemKey(view));
    if (button === undefined) return;
    const frozen = {
      button: 0,
      buttons: 1,
      pointerId: start.pointerId,
      pointerType: 'mouse',
      clientX: start.x,
      clientY: start.y,
      ctrlKey: false,
      metaKey: false,
      altKey: false,
      shiftKey: false,
      currentTarget: button,
      target: button,
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    } as unknown as PointerEvent<HTMLElement>;
    beginGesture(frozen, day, 'move', view);
    const l = live.current;
    if (l === null) return;
    l.pointerX = now.clientX;
    l.pointerY = now.clientY;
    process(l);
  }

  function editorElement(day: DayBox): JSX.Element | null {
    if (editing === null) return null;
    let rect: Rect | null = null;
    const previewId = editPreview?.id ?? null;
    const view = (views.get(day.date) ?? []).find((v) =>
      editing.kind === 'draft'
        ? previewId !== null && v.id === previewId
        : v.id === editing.id &&
          v.kind === editing.entryType &&
          (editing.windowId === null || v.windowId === editing.windowId),
    );
    if (editing.kind === 'draft') {
      if (editing.placement.date !== day.date) return null;
      const { left, width } = columnsRect(plan, day, editing.placement.columns);
      rect = view?.rect ?? {
        left,
        width,
        top: (editing.placement.from - plan.displayRange.from) * scale.minute,
        height: (editing.placement.to - editing.placement.from) * scale.minute,
      };
    } else {
      if (view === undefined) return null;
      rect = view.rect;
    }
    const values = editing.values;
    // Rückgängig innerhalb der Bearbeitung (Ctrl+Z, Ctrl+Y): eigene Schritte, zusammenhängendes Tippen in einem Feld
    // ist ein Schritt (wie im Eingabefeld des Browsers; die Zeichnung des Blocks folgt jeder Taste).
    const set = (patch: Partial<EditValues>, step: string | null = null) => {
      setEditError('');
      setEditErrorField(null);
      const h = editHistory.current;
      if (step === null || step !== h.last) {
        h.past.push(values);
        if (h.past.length > 200) h.past.shift();
      }
      h.future = [];
      h.last = step;
      setEditing({ ...editing, values: { ...values, ...patch } });
    };
    const typed = (field: EditField, before: string, after: string): string =>
      `${field}:${after.length >= before.length ? 'ein' : 'weg'}`;
    const undoInline = (field: EditField, redo: boolean): void => {
      const h = editHistory.current;
      const target = redo ? h.future.pop() : h.past.pop();
      if (target === undefined) return;
      (redo ? h.past : h.future).push(values);
      h.last = null;
      setEditing({ ...editing, values: target });
      const input = editorRef.current?.querySelector<HTMLInputElement>(`[data-field="${field}"]`);
      requestAnimationFrame(() => {
        if (input === null || input === undefined) return;
        input.setSelectionRange(input.value.length, input.value.length);
        setInlineSel({ field, start: input.value.length, end: input.value.length });
      });
    };
    const isBlock = editing.entryType === 'block';
    const fields: readonly EditField[] = isBlock ? EDIT_FIELDS : ['title'];
    const titleName =
      editing.entryType === 'rapport'
        ? 'Kürzel'
        : editing.entryType === 'beso'
          ? 'Termintext'
          : 'Titel';
    const names: Readonly<Record<EditField, string>> = {
      title: titleName,
      supplement: 'Zusatz',
      ltg: 'Ltg',
      ort: 'Ort',
    };
    // Lage der Felder im gezeichneten Text (F-UX2 P2): Schreibmarke und Markierung im Block selbst. Der Beso zeigt
    // im Kästchen nur seine Nummer; sein Termintext steht in der Feldanzeige.
    const inline =
      view?.render === undefined || editing.entryType === 'beso'
        ? null
        : placeFields(
            view.render.lines,
            fields.map((f) => values[f]),
          );
    const sel = inlineSel !== null && fields.includes(inlineSel.field) ? inlineSel : null;
    const fieldIndex = sel === null ? -1 : fields.indexOf(sel.field);
    const placement = inline?.fields[fieldIndex];
    const caret =
      inline === null || sel === null || sel.start !== sel.end
        ? null
        : caretBox(inline, fieldIndex, sel.end);
    const marked =
      inline === null || sel === null ? [] : selectionBoxes(inline, fieldIndex, sel.start, sel.end);
    const inputOf = (field: EditField): HTMLInputElement | null =>
      editorRef.current?.querySelector<HTMLInputElement>(`[data-field="${field}"]`) ?? null;
    const track = (field: EditField, el: HTMLInputElement) =>
      setInlineSel({
        field,
        start: el.selectionStart ?? el.value.length,
        end: el.selectionEnd ?? el.value.length,
      });
    const keyOf = (field: EditField) => (event: KeyboardEvent<HTMLInputElement>) => {
      // Route-Kürzel (Ctrl+S, P, O, K, L; UI-Richtlinie 13.2): Bearbeitung übernehmen und an die Route weitergeben,
      // nie der Browserdialog (CR-U-2-02). Bleibt die Bearbeitung offen (Zeichen ohne Glyphe), wirkt die Taste nicht.
      if (routeKey(event)) {
        if (!commitEdit(false)) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      event.stopPropagation();
      // Während einer IME-Komposition gehören Enter, Esc und Tab der Komposition (CR-U-2-09).
      if (event.nativeEvent.isComposing || event.keyCode === 229) return;
      const ctrl = (event.ctrlKey || event.metaKey) && !event.altKey;
      const k = event.key.toLowerCase();
      if (ctrl && (k === 'z' || k === 'y')) {
        event.preventDefault();
        undoInline(field, k === 'y' || event.shiftKey);
        return;
      }
      if (event.key === 'Enter') {
        event.preventDefault();
        commitEdit(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        cancelEdit();
      } else if (event.key === 'Tab') {
        const index = fields.indexOf(field) + (event.shiftKey ? -1 : 1);
        event.preventDefault();
        const nextField = fields[index];
        if (index >= fields.length) commitEdit(false);
        else if (nextField !== undefined) {
          const next = inputOf(nextField);
          next?.focus({ preventScroll: true });
          next?.select();
        }
      }
    };
    // Klick in den Text setzt die Schreibmarke, Ziehen markiert, Shift-Klick erweitert, Doppelklick wählt ein Wort.
    const pointAt = (event: { clientX: number; clientY: number }, el: HTMLElement) => {
      if (inline === null) return null;
      const r = el.getBoundingClientRect();
      return indexNear(inline, event.clientX - r.left, event.clientY - r.top);
    };
    // Ganze Blockfläche ausser den Kanten oben/unten ist Bearbeitungsfläche: ein Klick neben oder unter die Zeilen
    // setzt die Marke ans Ende der nächstgelegenen Zeile (UX-2-05); die Kanten bleiben zum Ändern der Zeit greifbar.
    const surfaceOf = (target: HTMLElement): HTMLElement =>
      target.closest<HTMLElement>('.i2-grid-inline-surface') ??
      target.parentElement?.querySelector<HTMLElement>('.i2-grid-inline-surface') ??
      target;
    const surfaceDown = (event: PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const el = surfaceOf(event.currentTarget);
      const hit = pointAt(event, el);
      const field = hit === null ? (sel?.field ?? 'title') : (fields[hit.field] ?? 'title');
      const input = inputOf(field);
      if (input === null) return;
      input.focus({ preventScroll: true });
      const at = hit === null ? input.value.length : hit.index;
      const anchorAt = event.shiftKey && sel !== null && sel.field === field ? sel.start : at;
      input.setSelectionRange(Math.min(anchorAt, at), Math.max(anchorAt, at));
      track(field, input);
      if (event.detail >= 2) return;
      el.setPointerCapture(event.pointerId);
      const x0 = event.clientX;
      const y0 = event.clientY;
      const pointerId = event.pointerId;
      const move = (e: globalThis.PointerEvent) => {
        // Aus dem Block hinaus gezogen: die Bearbeitung wird übernommen und der Block verschoben (Ziehen ist
        // jederzeit möglich, UI-Richtlinie 5.4; I2b A2). Innerhalb des Blocks markiert Ziehen Text.
        const box = el.getBoundingClientRect();
        const out =
          e.clientX < box.left - 6 ||
          e.clientX > box.right + 6 ||
          e.clientY < box.top - 6 ||
          e.clientY > box.bottom + 6;
        if (out && editing.kind === 'block' && view !== undefined) {
          up();
          if (el.hasPointerCapture(pointerId)) el.releasePointerCapture(pointerId);
          moveFromEdit(view, day, { x: x0, y: y0, pointerId }, e);
          return;
        }
        const h = pointAt(e, el);
        if (h === null || fields[h.field] !== field) return;
        input.setSelectionRange(Math.min(anchorAt, h.index), Math.max(anchorAt, h.index));
        track(field, input);
      };
      const up = () => {
        el.removeEventListener('pointermove', move);
        el.removeEventListener('pointerup', up);
        el.removeEventListener('pointercancel', up);
      };
      el.addEventListener('pointermove', move);
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
    };
    const surfaceDouble = (event: MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const hit = pointAt(event, surfaceOf(event.currentTarget));
      if (hit === null) return;
      const field = fields[hit.field] ?? 'title';
      const input = inputOf(field);
      if (input === null) return;
      const w = wordAt(input.value, Math.max(0, hit.index - 1));
      input.focus({ preventScroll: true });
      input.setSelectionRange(w.start, w.end);
      track(field, input);
    };
    const below = rect.top + rect.height + 60 < gridHeight;
    const current: EditField = sel?.field ?? 'title';
    // Leeres Feld hat keine Lage im Block: Marke in der Feldanzeige (CR-U-2-08).
    const shown = placement?.complete === true && values[current] !== '';
    const at = sel?.start ?? values[current].length;
    const hidden = (field: EditField) => ({
      'data-field': field,
      className: 'i2-grid-inline-hidden',
      'aria-label': names[field],
      'aria-invalid': editError !== '' && editErrorField === field,
      value: values[field],
      autoComplete: 'off',
      spellCheck: false,
      onFocus: (event: FocusEvent<HTMLInputElement>) => track(field, event.currentTarget),
      onSelect: (event: SyntheticEvent<HTMLInputElement>) => track(field, event.currentTarget),
      onKeyUp: (event: KeyboardEvent<HTMLInputElement>) => track(field, event.currentTarget),
    });
    return (
      <fieldset
        ref={editorRef}
        className={`i2-grid-editing${editing.kind === 'draft' ? ' is-draft' : ''}`}
        aria-label={`Direktbearbeitung ${isBlock ? 'Block' : editing.entryType === 'rapport' ? 'Rapport' : 'Beso'}`}
        style={{
          left: rect.left,
          top: rect.top,
          width: Math.max(12, rect.width),
          height: rect.height,
        }}
      >
        {/* Eingaben gehen in unsichtbare Felder; gezeichnet wird der Text der Layout-Schicht im Block (P2). */}
        <input
          ref={titleRef}
          {...hidden('title')}
          onChange={(event) => {
            set(
              {
                title: event.target.value,
                mask: editBold(
                  { text: values.title, mask: values.mask },
                  event.target.value,
                  values.mask[0] ?? isBlock,
                ).mask,
              },
              typed('title', values.title, event.target.value),
            );
            track('title', event.target);
          }}
          onKeyDown={(event) => {
            // Ctrl+B schaltet die markierte Stelle fett/normal (Beschrieb 5.1; UI-Richtlinie 5.4; R-5.1-23).
            if (isBlock && (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
              event.preventDefault();
              event.stopPropagation();
              const el = event.currentTarget;
              const start = el.selectionStart ?? 0;
              const end = el.selectionEnd ?? 0;
              set({ mask: toggleBold({ text: values.title, mask: values.mask }, start, end).mask });
              requestAnimationFrame(() => el.setSelectionRange(start, end));
              return;
            }
            keyOf('title')(event);
          }}
        />
        {isBlock &&
          (['supplement', 'ltg', 'ort'] as const).map((field) => (
            <input
              key={field}
              {...hidden(field)}
              onChange={(event) => {
                set(
                  { [field]: event.target.value },
                  typed(field, values[field], event.target.value),
                );
                track(field, event.target);
              }}
              onKeyDown={keyOf(field)}
            />
          ))}
        {inline !== null && (
          <div
            className="i2-grid-inline-pad"
            aria-hidden="true"
            // Ganze Fläche (UX-FUX3-04): während der Bearbeitung wirken die Kantenzonen nicht, ein Klick setzt die
            // Schreibmarke; Ziehen über den Block hinaus verschiebt (moveFromEdit), Grösse ändern nach der Bearbeitung.
            style={{ top: 0, bottom: 0 }}
            onPointerDown={surfaceDown}
            onDoubleClick={surfaceDouble}
          />
        )}
        <div
          className="i2-grid-inline-surface"
          aria-hidden="true"
          onPointerDown={surfaceDown}
          onDoubleClick={surfaceDouble}
        >
          {(inline === null ? [] : textBoxes(inline)).map((b) => (
            <span
              key={`t${String(b.left)}:${String(b.top)}`}
              className="i2-grid-inline-text"
              style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
            />
          ))}
          {marked.map((b) => (
            <span
              key={`${String(b.left)}:${String(b.top)}`}
              className="i2-grid-inline-mark"
              style={{ left: b.left, top: b.top, width: b.width, height: b.height }}
            />
          ))}
          {caret !== null && (
            <span
              key={`${current}:${String(sel?.end ?? 0)}:${String(values[current].length)}`}
              className="i2-grid-inline-caret"
              style={{ left: caret.left, top: caret.top, width: caret.width, height: caret.height }}
            />
          )}
        </div>
        <div className={`i2-grid-inline-card${below ? '' : ' is-above'}`}>
          <span className="i2-grid-inline-field">
            {names[current]}
            {/* Auch leer: Marke in der Feldanzeige, wo das Feld (noch) keine Lage im Block hat (CR-U-2-08). */}
            {!shown && (
              <>
                {': '}
                <span className="i2-grid-inline-value">
                  {values[current].slice(0, at)}
                  <span className="i2-grid-inline-valuecaret" />
                  {values[current].slice(at)}
                </span>
              </>
            )}
          </span>
          {editError !== '' ? (
            <p className="i2-grid-inline-error" role="alert">
              {editError}
            </p>
          ) : (
            <p className="i2-grid-inline-hint">
              {isBlock
                ? 'Enter übernimmt · Esc verwirft · Tab nächstes Feld · Ctrl+B fett'
                : 'Enter übernimmt · Esc verwirft'}
            </p>
          )}
        </div>
      </fieldset>
    );
  }

  /** Vorschaurahmen des gezogenen Eintrags am Ziel (Rückmeldung, PERF: ohne Neuzeichnen des Rasters). */
  function ghostFor(drag: DragView | null): JSX.Element | null {
    const l = live.current;
    if (drag === null || l === null || !l.started) return null;
    if (drag.entryKind === 'querbalken') {
      const entry = l.entry;
      if (entry?.type !== 'querbalken') return null;
      const from =
        drag.kind === 'right' ? entry.fromDate : addDays(entry.fromDate, drag.target.dayOffset);
      const to = drag.kind === 'left' ? entry.toDate : addDays(entry.toDate, drag.target.dayOffset);
      const inWeek = days.filter(
        (d) => daysBetween(from, d.date) >= 0 && daysBetween(d.date, to) >= 0,
      );
      const first = inWeek[0];
      const last = inWeek[inWeek.length - 1];
      if (first === undefined || last === undefined || l.view === null) return null;
      return (
        <div
          className="i2-grid-ghost"
          aria-hidden="true"
          style={ghostStyle({
            left: AXIS_WIDTH + first.left,
            top: l.bodyTop + l.view.rect.top,
            width: last.left + last.width - first.left - 2,
            height: l.view.rect.height,
          })}
        />
      );
    }
    const rect = contentRect(drag.target, l, drag.arrangement);
    if (rect === null) return null;
    // Beim Verschieben ist der angehobene Block selbst die Ziellage; bei Kanten zeigt der Rahmen die Ziellage (B).
    return (
      <div
        className="i2-grid-ghost"
        aria-hidden="true"
        data-kind={drag.kind === 'move' || drag.kind === 'create' ? 'move' : 'edge'}
        data-mode={drag.mode}
        style={ghostStyle(rect)}
      />
    );
  }

  function hoverCard(
    hover: { id: Id; windowId: Id | null; rect: DOMRect } | null,
  ): JSX.Element | null {
    if (hover === null || drag !== null || editing !== null) return null;
    const entry = plan.entries[hover.id];
    if (entry === undefined) return null;
    const width = 280;
    const right = hover.rect.right + 8;
    const left =
      right + width > window.innerWidth ? Math.max(8, hover.rect.left - width - 8) : right;
    const top = Math.max(8, Math.min(window.innerHeight - 160, hover.rect.top));
    const time =
      entry.type === 'block' || entry.type === 'rapport'
        ? formatTimeSpec(entry.time, entry.date)
        : entry.type === 'marker'
          ? formatMilTime(entry.at)
          : entry.type === 'beso'
            ? entry.windows.map((w) => formatTimeSpec(w.time, entry.date)).join(', ')
            : entry.type === 'querbalken'
              ? `${formatDate(entry.fromDate, 'long')}–${formatDate(entry.toDate, 'long')}`
              : '';
    return (
      <aside
        className="i2-grid-detail"
        aria-label="Details zum Eintrag"
        role="tooltip"
        style={{ left, top, width }}
        onMouseEnter={() => window.clearTimeout(hoverTimer.current)}
        onMouseLeave={hoverEnd}
      >
        <span className="i2-grid-detail-type">
          {typeName(entry)}
          {entry.type === 'beso' ? ` ${entry.besoNumber ?? '–'}` : ''}
        </span>
        <strong>{entryTitle(plan, entry) || 'Ohne Titel'}</strong>
        <span>
          {'date' in entry ? `${formatDate(entry.date, 'long')} · ` : ''}
          {time}
        </span>
        {'supplement' in entry && entry.supplement !== '' && <span>{entry.supplement}</span>}
        {'ltg' in entry && entry.ltg !== '' && <span>Ltg: {entry.ltg}</span>}
        {'ort' in entry && entry.ort !== '' && <span>Ort: {entry.ort}</span>}
        {'tn' in entry && entry.tn !== '' && <span>Tn: {entry.tn}</span>}
        {'tpt' in entry && entry.tpt !== '' && <span>Tpt: {entry.tpt}</span>}
        {entry.type === 'beso' && (
          <span>
            Terminzeile:{' '}
            {agendaLinesForDate(plan, entry.date)
              .find((l) => l.entryId === entry.id)
              ?.text.map((r) => r.text)
              .join('') ?? ''}
          </span>
        )}
        {entry.type === 'block' && (entry.subtasks ?? []).length > 0 && (
          <span>
            Teilaufgaben:{' '}
            {(entry.subtasks ?? [])
              .map((t) =>
                [plainTitle(plan, t.title), t.ltg, t.ort === '' ? '' : `(${t.ort})`]
                  .filter((x) => x !== '')
                  .join(' '),
              )
              .join('; ')}
          </span>
        )}
        {entry.status !== 'confirmed' && (
          <span>Status: {entry.status === 'open' ? 'offen' : 'gestrichen'}</span>
        )}
        {entry.internalNote !== '' && <span>Notiz: {entry.internalNote}</span>}
      </aside>
    );
  }

  const formDay = days.find((day) => day.date === form?.date);
  const categoryChoice = useMemo((): string | null => {
    const ids = new Set<string>();
    for (const id of selectedIds) {
      const e = plan.entries[id];
      if (e === undefined) continue;
      if (e.type === 'block' || e.type === 'rapport') ids.add(e.categoryId);
      else if ((e.type === 'querbalken' || e.type === 'beso') && e.categoryId !== null)
        ids.add(e.categoryId);
    }
    if (ids.size === 0) return null;
    return ids.size === 1 ? ([...ids][0] ?? '') : '';
  }, [selectedIds, plan.entries]);

  /** Leitungskategorie der ganzen Auswahl (B2): ein Befehl, ein Undo-Schritt. */
  function applyCategory(categoryId: string, refocus = true): void {
    setCategoryDraft(null);
    categoryByKeyboard.current = false;
    if (categoryId === '' || categoryId === categoryChoice || disabled) return;
    const ids = [...selectedIds];
    const name = plan.legend.find((c) => c.id === categoryId)?.name ?? '';
    keepSelection.current = true;
    dispatch(
      (p, ctx) => updateEntries(p, ids, { categoryId }, ctx),
      refocus && selected !== null ? itemKey(selected) : undefined,
    );
    if (ids.length > 1)
      onToast?.({ text: `${ids.length} Einträge: Kategorie «${name}»`, undo: 'Ändern' });
  }
  const scopeDay =
    scopeQuestion === null ? undefined : days.find((d) => d.weekday === scopeQuestion.weekday);
  const selectedKind = selectedEntry?.type;
  // PERF (R-5.1-14): Ansichten, Tagesköpfe und Terminbereich kommen aus dem Zwischenspeicher; ihre Handler rufen über
  // `on` immer die Fassung des letzten Neuzeichnens auf.
  const cached = useElementCache();
  /** Elemente je Tag samt ihrer Ansichten (F-PERF); Tage anderer Wochen entfallen beim nächsten Neuzeichnen. */
  const dayCache = useRef(
    new Map<
      IsoDate,
      { deps: readonly unknown[]; element: JSX.Element; views: Map<string, ViewSlot> }
    >(),
  );
  for (const date of dayCache.current.keys())
    if (!days.some((d) => d.date === date)) dayCache.current.delete(date);
  const on = useLatest({
    plan,
    selection,
    beginGesture,
    startEdit,
    beginForm,
    hoverLater,
    hoverEnd,
    commitAgendaEdit,
    startAgendaEdit,
    agendaKey,
    openDayMenu,
    openEntryMenu,
    selectDay,
    dayHeadKey,
    finishColumnEdit,
    openColumnEdit,
    columnHeadKey,
    beginWeightDrag,
    askScope,
    openColumnMenu,
  });

  // Werkzeugleiste des Rasters (H-UI2, UX-H-03): Zoom fest, die übrigen weichen nach Priorität ins Menü «Mehr …» aus.
  const zoomOut = () => setZoom(nextZoom(zoom, scale, -1));
  const zoomIn = () => setZoom(nextZoom(zoom, scale, 1));
  const zoomFit = () =>
    setZoom(zoom.kind === 'fit' ? { kind: 'level', value: 1 } : { kind: 'fit' });
  const togglePanel = () => (panelOpen ? setPanelOpen(false) : openPanel(null));
  const canCreateBlock = !disabled && days.some((day) => day.planning.length > 0);
  const openNewEntryMenu = () => {
    const r = newEntryRef.current?.getBoundingClientRect();
    openCursorMenu(r?.left ?? 200, r?.bottom ?? 120);
  };
  const toolItems: BarItem[] = [
    {
      id: 'zoom',
      node: (
        <fieldset className="i2-grid-zoom" aria-label="Zoom">
          <button
            type="button"
            aria-label="Verkleinern"
            title="Verkleinern (−, Ctrl+Minus)"
            onClick={zoomOut}
          >
            −
          </button>
          <output aria-label="Zoomstufe">{zoomLabel(zoom, scale)}</output>
          <button
            type="button"
            aria-label="Vergrössern"
            title="Vergrössern (+, Ctrl+Plus)"
            onClick={zoomIn}
          >
            +
          </button>
          <button
            type="button"
            aria-pressed={zoom.kind === 'fit'}
            title="Ganze Woche einpassen (0, Ctrl+0)"
            onClick={zoomFit}
          >
            Einpassen
          </button>
        </fieldset>
      ),
    },
    {
      id: 'seitenfeld',
      priority: 87,
      node: (
        <button
          type="button"
          aria-pressed={panelOpen}
          title="Seitenfeld ein/aus (E am gewählten Eintrag)"
          onClick={togglePanel}
        >
          Seitenfeld
        </button>
      ),
      menu: [{ label: 'Seitenfeld', checked: panelOpen, run: togglePanel }],
    },
    {
      id: 'neuer-block',
      priority: 90,
      node: (
        <button
          ref={newBlockRef}
          type="button"
          onClick={() => beginForm()}
          disabled={!canCreateBlock}
        >
          Neuer Block
        </button>
      ),
      menu: [{ label: 'Neuer Block (N)', disabled: !canCreateBlock, run: () => beginForm() }],
    },
    {
      id: 'neuer-eintrag',
      priority: 20,
      node: (
        <button
          ref={newEntryRef}
          type="button"
          aria-haspopup="menu"
          title="Neuer Eintrag am Zellzeiger: Block, Beso, Rapport, Querbalken, Marker, ganztägige Bemerkung (Shift+F10)"
          disabled={disabled}
          onClick={openNewEntryMenu}
        >
          Neuer Eintrag …
        </button>
      ),
      menu: [
        { label: 'Neuer Eintrag … (Shift+F10)', disabled, run: () => openCursorMenu(200, 120) },
      ],
    },
  ];
  // Befehle der Auswahl in der Statuszeile (H-UI2, UX-H-03; UI-Richtlinie 2.2 «Statuszeile: Ort und Auswahl»): Die
  // Werkzeugleiste springt beim Wählen nicht, und die Befehle der Auswahl bleiben bei 1366 px sichtbar.
  const selectionItems: BarItem[] = [];
  if (selection.length > 1)
    selectionItems.push(
      {
        id: 'auswahl-anzahl',
        priority: 50,
        node: <span className="i2-grid-count">{selectedIds.size} Einträge gewählt</span>,
      },
      {
        id: 'auswahl-loeschen',
        priority: 88,
        node: (
          <button type="button" disabled={disabled} onClick={() => removeEntries([...selectedIds])}>
            Auswahl löschen
          </button>
        ),
        menu: [
          {
            label: `Auswahl löschen (${String(selectedIds.size)} Einträge, Entf)`,
            disabled,
            run: () => removeEntries([...selectedIds]),
          },
        ],
      },
    );
  if (selection.length === 1 && selectedEntry?.type === 'block')
    selectionItems.push(
      {
        id: 'block-bearbeiten',
        priority: 88,
        node: (
          <button
            type="button"
            aria-label="Block bearbeiten"
            title="Block bearbeiten (Zeit, Tag, Spalten)"
            disabled={disabled}
            onClick={() => beginForm(selectedEntry)}
          >
            Bearbeiten
          </button>
        ),
        menu: [{ label: 'Block bearbeiten', disabled, run: () => beginForm(selectedEntry) }],
      },
      {
        id: 'block-loeschen',
        priority: 89,
        node: (
          <button
            type="button"
            aria-label="Block löschen"
            title="Block löschen (Entf)"
            disabled={disabled}
            onClick={() => removeEntries([selectedEntry.id])}
          >
            Löschen
          </button>
        ),
        menu: [
          {
            label: 'Block löschen (Entf)',
            disabled,
            run: () => removeEntries([selectedEntry.id]),
          },
        ],
      },
    );
  if (selection.length === 1 && selectedEntry !== undefined && selectedKind !== 'block')
    selectionItems.push({
      id: 'eintrag-loeschen',
      priority: 89,
      node: (
        <button type="button" disabled={disabled} onClick={() => removeEntries([selectedEntry.id])}>
          {typeName(selectedEntry)} löschen
        </button>
      ),
      menu: [
        {
          label: `${typeName(selectedEntry)} löschen (Entf)`,
          disabled,
          run: () => removeEntries([selectedEntry.id]),
        },
      ],
    });
  if (selection.length > 0 && categoryChoice !== null)
    selectionItems.push({
      id: 'kategorie',
      priority: 85,
      node: (
        <label title="Leitungskategorie der Auswahl (K)">
          <span className="wap-i2-sr">Kategorie</span>
          <select
            ref={categoryRef}
            aria-label="Kategorie"
            title="Leitungskategorie der Auswahl (K)"
            disabled={disabled}
            value={categoryDraft ?? categoryChoice}
            onPointerDown={() => {
              categoryByKeyboard.current = false;
            }}
            onKeyDown={(event) => {
              categoryByKeyboard.current = true;
              if (event.key === 'Enter') {
                event.preventDefault();
                applyCategory(categoryDraft ?? categoryChoice);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                setCategoryDraft(null);
                if (selected !== null) focusItem(selected, true);
              }
            }}
            onChange={(event) => {
              if (categoryByKeyboard.current) setCategoryDraft(event.target.value);
              else applyCategory(event.target.value);
            }}
            onBlur={() => {
              if (categoryDraft !== null) applyCategory(categoryDraft, false);
            }}
          >
            {categoryChoice === '' && <option value="">verschieden</option>}
            {plan.legend.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      ),
      menu: [{ label: 'Kategorie … (K)', disabled, run: () => openPanel('category') }],
    });
  if (selection.length === 1 && selectedEntry !== undefined && 'date' in selectedEntry)
    selectionItems.push({
      id: 'andere-tage',
      priority: 60,
      node: (
        <button
          type="button"
          disabled={disabled}
          title="A"
          onClick={() => setOtherDays(selectedEntry.id)}
        >
          Auch an anderen Tagen …
        </button>
      ),
      menu: [
        {
          label: 'Auch an anderen Tagen … (A)',
          disabled,
          run: () => setOtherDays(selectedEntry.id),
        },
      ],
    });
  // Befehle des Rasters für die Befehlspalette (Ctrl+K; UI-Richtlinie 13.1 Ebene c).
  if (commands !== undefined)
    commands.current = [
      { id: 'raster-gehe-zu', label: 'Gehe zu …', hint: 'Ctrl+G', run: () => setGoTo(true) },
      {
        id: 'raster-neuer-block',
        label: 'Neuer Block',
        hint: 'N',
        disabled: !canCreateBlock,
        run: () => beginForm(),
      },
      {
        id: 'raster-neuer-eintrag',
        label: 'Neuer Eintrag am Zellzeiger …',
        hint: 'Shift+F10',
        keywords: 'beso rapport querbalken marker bemerkung',
        disabled,
        run: () => openCursorMenu(200, 120),
      },
      {
        id: 'raster-seitenfeld',
        label: panelOpen ? 'Seitenfeld schliessen' : 'Seitenfeld öffnen',
        hint: 'E',
        run: togglePanel,
      },
      { id: 'raster-vergroessern', label: 'Zoom vergrössern', hint: '+', run: zoomIn },
      { id: 'raster-verkleinern', label: 'Zoom verkleinern', hint: '−', run: zoomOut },
      {
        id: 'raster-einpassen',
        label: 'Ganze Woche einpassen',
        hint: '0',
        run: () => setZoom({ kind: 'fit' }),
      },
      {
        id: 'raster-zoom-100',
        label: 'Zoom 100 %',
        run: () => setZoom({ kind: 'level', value: 1 }),
      },
      ...(selectedEntry === undefined
        ? []
        : [
            {
              id: 'raster-loeschen',
              label: `Auswahl löschen (${String(selectedIds.size)})`,
              hint: 'Entf',
              disabled,
              run: () => removeEntries([...selectedIds]),
            },
            {
              id: 'raster-kategorie',
              label: 'Kategorie der Auswahl …',
              hint: 'K',
              disabled,
              run: () => openPanel('category'),
            },
          ]),
      ...(selectedEntry !== undefined && 'date' in selectedEntry && selection.length === 1
        ? [
            {
              id: 'raster-andere-tage',
              label: 'Auch an anderen Tagen …',
              hint: 'A',
              disabled,
              run: () => setOtherDays(selectedEntry.id),
            },
          ]
        : []),
    ];

  return (
    <section className="i2-grid-editor" aria-label="Rasterbearbeitung">
      <OverflowBar
        className="i2-grid-tools"
        role="toolbar"
        label="Woche und Raster"
        moreLabel="Weitere Befehle"
        items={[...(toolbarItems ?? []), ...toolItems]}
      />
      {error !== '' && form === null && (
        <p role="alert" id={errorId} className="i2-grid-error">
          {error}
        </p>
      )}
      <div className="i2-grid-area">
        {emptyWeek !== null && week !== undefined && (
          <div className="i2-grid-next-step" role="note" aria-label="Nächster Schritt">
            {emptyWeek.withoutSet.length > 0 ? (
              <>
                <p>
                  {week.shortName.replace(/^Wo(\d)/, 'Wo $1')} ist noch leer – Nächster Schritt: für{' '}
                  {emptyWeek.weekdays.join(', ')} einen Spaltensatz wählen (Tageskopf anklicken,
                  Seitenfeld «Spaltensatz»).
                </p>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setSelection([]);
                    setDaySelection(emptyWeek.withoutSet);
                    openPanel(null);
                  }}
                >
                  Spaltensatz für {emptyWeek.weekdays.join(', ')} wählen …
                </button>
              </>
            ) : (
              <p>
                {week.shortName.replace(/^Wo(\d)/, 'Wo $1')} ist noch leer – Nächster Schritt:
                Einträge ins Raster ziehen oder am Zellzeiger Enter bzw. Shift+F10 drücken.
              </p>
            )}
          </div>
        )}
        {form !== null && (
          <form
            ref={formRef}
            className="i2-grid-form"
            aria-label={form.entryId === null ? 'Neuer Block' : 'Block bearbeiten'}
            onSubmit={(event) => void submitForm(event)}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && !disabled) {
                event.preventDefault();
                closeForm();
              } else if (event.key === 'Enter' && event.target instanceof HTMLSelectElement) {
                // Enter in Auswahlfeldern übernimmt (B7).
                event.preventDefault();
                submitForm();
              }
            }}
          >
            <label>
              Titel
              <input
                ref={formTitleRef}
                data-form-field="title"
                aria-label="Titel"
                aria-invalid={form.invalid === 'title'}
                aria-describedby={form.invalid === 'title' ? errorId : undefined}
                value={form.title}
                disabled={disabled}
                onChange={(event) =>
                  setForm({
                    ...form,
                    title: event.target.value,
                    invalid: form.invalid === 'title' ? null : form.invalid,
                  })
                }
              />
            </label>
            <label>
              Tag
              <select
                data-form-field="date"
                aria-label="Tag"
                value={form.date}
                disabled={disabled}
                onChange={(event) => {
                  const date = event.target.value;
                  const target = days.find((day) => day.date === date);
                  setForm({
                    ...form,
                    date,
                    columnId: 'keep',
                    columnTo: '',
                    initialColumns:
                      target === undefined
                        ? form.initialColumns
                        : carryColumnSelection(
                            plan,
                            form.initialColumns,
                            target.columns.map((c) => c.column),
                          ),
                  });
                }}
              >
                {days.map((day) => (
                  <option key={day.date} value={day.date}>
                    {day.weekday} {formatDate(day.date, 'long')}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Beginn
              <input
                data-form-field="begin"
                aria-label="Beginn"
                inputMode="numeric"
                aria-invalid={form.invalid === 'begin'}
                aria-describedby={form.invalid === 'begin' ? errorId : undefined}
                value={form.begin}
                disabled={disabled}
                onChange={(event) => setBegin(event.target.value)}
                onBlur={() => {
                  const range = splitRange(form.begin);
                  if (range !== null) {
                    const b = parseTimeInput(range.begin, 'Beginn');
                    const e = parseTimeInput(range.end, 'Ende');
                    if (b.ok && e.ok)
                      setForm((f) =>
                        f === null
                          ? null
                          : {
                              ...f,
                              begin: formatMilTime(b.value),
                              end: formatMilTime(e.value),
                              endTouched: true,
                            },
                      );
                    return;
                  }
                  const parsed = parseTimeInput(form.begin, 'Beginn');
                  if (parsed.ok)
                    setForm((f) =>
                      f === null ? null : { ...f, begin: formatMilTime(parsed.value) },
                    );
                }}
              />
            </label>
            <label>
              Ende
              <input
                data-form-field="end"
                aria-label="Ende"
                inputMode="numeric"
                aria-invalid={form.invalid === 'end'}
                aria-describedby={form.invalid === 'end' ? errorId : undefined}
                value={form.end}
                disabled={disabled}
                onChange={(event) =>
                  setForm({
                    ...form,
                    end: event.target.value,
                    endTouched: true,
                    invalid: form.invalid === 'end' ? null : form.invalid,
                  })
                }
                onBlur={() => {
                  const parsed = parseTimeInput(form.end, 'Ende');
                  if (parsed.ok)
                    setForm((f) =>
                      f === null ? null : { ...f, end: formatMilTime(parsed.value) },
                    );
                }}
              />
            </label>
            <label>
              Spalte
              <select
                data-form-field="columns"
                aria-label="Spalte"
                value={form.columnId}
                disabled={disabled}
                onChange={(event) =>
                  setForm({ ...form, columnId: event.target.value, columnTo: '' })
                }
              >
                <option value="keep">Gewählte Spalten beibehalten</option>
                <option value="all">Alle Planungsspalten</option>
                {formDay?.planning.map((column) => (
                  <option key={column.column.id} value={column.column.id}>
                    {column.column.name}
                  </option>
                ))}
              </select>
            </label>
            {form.columnId !== 'keep' && form.columnId !== 'all' && (
              <label>
                bis Spalte
                <select
                  aria-label="bis Spalte"
                  value={form.columnTo}
                  disabled={disabled}
                  onChange={(event) => setForm({ ...form, columnTo: event.target.value })}
                >
                  <option value="">nur diese Spalte</option>
                  {(formDay?.planning ?? [])
                    .slice(
                      Math.max(
                        0,
                        (formDay?.planning ?? []).findIndex((c) => c.column.id === form.columnId) +
                          1,
                      ),
                    )
                    .map((column) => (
                      <option key={column.column.id} value={column.column.id}>
                        {column.column.name}
                      </option>
                    ))}
                </select>
              </label>
            )}
            {error !== '' && (
              <p role="alert" id={errorId} className="i2-grid-error i2-grid-form-error">
                {error}
              </p>
            )}
            <button type="submit" disabled={disabled}>
              Übernehmen
            </button>
            <button type="button" disabled={disabled} onClick={closeForm}>
              Abbrechen
            </button>
          </form>
        )}
        <div
          className="i2-grid-scroll"
          ref={scrollRef}
          style={{ ['--i2-minute' as string]: `${scale.minute}px` }}
        >
          <div className="i2-grid-content" ref={wrapperRef}>
            <table
              aria-label="Wochenraster"
              className="i2-grid"
              onPointerMove={pointerMove}
              onPointerUp={pointerUp}
              onPointerCancel={() => cancelGesture()}
              onKeyDown={gridKey}
              onContextMenu={gridContextMenu}
            >
              <tbody className="i2-grid-rows">
                <tr className="i2-grid-axis" style={{ width: AXIS_WIDTH }}>
                  <th
                    scope="row"
                    className="i2-grid-axis-head"
                    style={{ height: DAY_LABEL_HEIGHT + headHeight + 1 }}
                  >
                    Zeit
                  </th>
                  <td className="i2-grid-axis-body" style={{ height: gridHeight }}>
                    {Array.from(
                      { length: Math.ceil(range / 60) },
                      (_, index) => plan.displayRange.from + index * 60,
                    ).map((minute) => (
                      <span
                        key={minute}
                        style={{ top: (minute - plan.displayRange.from) * scale.minute }}
                      >
                        {formatMilTime(minute)}
                      </span>
                    ))}
                  </td>
                  <td className="i2-grid-axis-agenda" style={{ height: agendaHeight }}>
                    {template.agendaHeading}
                  </td>
                </tr>
                {days.map((day) => (
                  <tr
                    key={day.date}
                    className="i2-grid-day"
                    style={{ width: snapX(day, day.width) }}
                  >
                    {dayHeadCell(day)}
                    <td
                      aria-label={`${day.weekday} ${formatDate(day.date, 'long')}`}
                      className="i2-grid-day-body"
                      data-day={day.date}
                      style={{ height: gridHeight }}
                      onPointerDownCapture={(event) => bodyPointerDown(event, day)}
                      onDoubleClickCapture={(event) => bodyDoubleClick(event, day)}
                      onPointerMove={(event) => bodyPointerMove(event, day)}
                      onPointerLeave={(event) => bodyPointerLeave(event.currentTarget)}
                    >
                      <div
                        className="i2-grid-band"
                        aria-hidden="true"
                        style={{ height: 60 * scale.minute }}
                      />
                      {/* Ohne Spaltensatz steht der Hinweis im Spaltenkopf, nicht im Raster (UX-2-13). */}
                      {day.planning.length === 0
                        ? null
                        : day.planning.map((c) => {
                            const key = `${day.date}:${c.column.id}`;
                            return (
                              <button
                                key={c.column.id}
                                type="button"
                                className="i2-grid-empty"
                                data-empty-column={c.column.id}
                                aria-label={`Leere Fläche ${day.weekday} ${c.column.name}`}
                                disabled={disabled}
                                ref={(element) => {
                                  if (element === null) emptyButtons.current.delete(key);
                                  else emptyButtons.current.set(key, element);
                                }}
                                style={{ left: c.left, width: c.width, height: gridHeight }}
                                tabIndex={-1}
                                onPointerDown={(event) => beginGesture(event, day, 'create', null)}
                                onClick={() => {
                                  draggedClick.current = false;
                                }}
                                onDoubleClick={() =>
                                  setStatus(
                                    `Leere Fläche ${c.column.name}: Zum Erfassen ziehen oder Enter.`,
                                  )
                                }
                              />
                            );
                          })}
                      {day.columns
                        .filter((c) => c.column.kind === 'rap' || c.column.kind === 'beso')
                        .map((c) => (
                          <button
                            key={c.column.id}
                            type="button"
                            className="i2-grid-empty is-special"
                            data-empty-column={c.column.id}
                            aria-label={`${c.column.kind === 'rap' ? 'Rap-Spalte' : 'Beso-Spalte'} ${day.weekday}`}
                            title="Doppelklick erfasst einen neuen Eintrag"
                            disabled={disabled}
                            tabIndex={-1}
                            style={{ left: c.left, width: c.width, height: gridHeight }}
                            onPointerDown={(event) => {
                              if (event.button !== 0) return;
                              // Ziehen erzeugt einen Rapport bzw. Beso über die Zeit (R-5.1-24); Klick setzt den Zellzeiger.
                              beginGesture(event, day, 'create', null, c.column);
                            }}
                            onDoubleClick={(event) => {
                              const cell = cellAt(event, day, c.column.id);
                              if (cell === null) return;
                              moveCursorTo(cell, false);
                              // Doppelklick erzeugt Rapport bzw. Beso mit offenem Termintext (B8; Beschrieb 5.1).
                              startDraft(
                                {
                                  date: day.date,
                                  from: cell.minute,
                                  to: cell.minute + 30,
                                  columns: { kind: 'ids', ids: [c.column.id] },
                                },
                                c.column.kind === 'rap' ? 'rapport' : 'beso',
                                'adjust',
                              );
                            }}
                          />
                        ))}
                      {gridLines(day)}
                      {ghost !== null && ghost.date === day.date && (
                        <div
                          ref={ghostRef}
                          className="i2-grid-import-ghost"
                          role="note"
                          aria-label={ghost.label}
                          style={{
                            left: day.planning[0]?.left ?? 0,
                            width:
                              (day.planning[day.planning.length - 1]?.left ?? 0) +
                              (day.planning[day.planning.length - 1]?.width ?? day.width) -
                              (day.planning[0]?.left ?? 0),
                            top: (ghost.from - plan.displayRange.from) * scale.minute,
                            height: Math.max(8, (ghost.to - ghost.from) * scale.minute),
                          }}
                        >
                          <span>{ghost.label}</span>
                        </div>
                      )}
                      {dayEntries(day)}
                      {cursorDay?.date === day.date && cells !== null && cursorElement(day, cells)}
                      {editorElement(day)}
                    </td>
                    {cachedAgenda(day)}
                  </tr>
                ))}
              </tbody>
            </table>
            <Feedback store={dragFeedback} render={ghostFor} />
            {/* Angehobener Block (Runde 3, Variante B): Hebe-Schatten, Leuchtrahmen in der Modusfarbe, Fläche, vier
                eigene Kanten und Text; Lage und Grösse nur über transform (paintLift). */}
            <div className="i2-grid-lift" ref={liftRef} aria-hidden="true">
              <div className="i2-lift-z">
                <i className="i2-lift-sh" />
                <i className="i2-lift-gl" />
                <i className="i2-lift-f" />
                <i className="i2-lift-e i2-lift-et" />
                <i className="i2-lift-e i2-lift-eb" />
                <i className="i2-lift-e i2-lift-el" />
                <i className="i2-lift-e i2-lift-er" />
                <span className="i2-lift-tx" />
              </div>
            </div>
            <div className="i2-grid-hover" ref={hoverRef} aria-hidden="true" />
            {/* Griffe des überfahrenen Eintrags (Runde 3, 5a): Pille mit Doppelpfeil an den Kanten, Zeitgriff am Marker. */}
            {GRIP_ZONES.map((z) => (
              <div
                key={z}
                className="i2-grid-grip"
                data-grip={z}
                aria-hidden="true"
                ref={(el) => {
                  if (el === null) gripRefs.current.delete(z);
                  else gripRefs.current.set(z, el);
                }}
              >
                <div className="i2-grip-in">
                  <GripShape vertical={z === 'left' || z === 'right'} hot={false} />
                  <GripShape vertical={z === 'left' || z === 'right'} hot />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Seitenbereich: Seitenfeld, Befundliste, Importbericht; mehrere offen → untereinander, keiner verdeckt
            den anderen (UI-Richtlinie 2.2; UX-AB-11). */}
        <div className="i2-grid-side">
          {panelOpen && (
            <DetailPanel
              plan={plan}
              weekId={weekId}
              target={panelTarget}
              actions={panelActions}
              error={panelError}
              focus={panelFocus}
              onClose={() => {
                setPanelOpen(false);
                focusSelectedOrCursor();
              }}
            />
          )}
          {aside}
        </div>
      </div>
      <div className={`i2-grid-statusbar${selectionItems.length > 0 ? ' has-selection' : ''}`}>
        {selectionItems.length > 0 && (
          <OverflowBar
            className="i2-grid-selection-tools"
            role="toolbar"
            label="Auswahl"
            moreLabel="Weitere Befehle der Auswahl"
            items={selectionItems}
          />
        )}
        <div
          ref={statusRef}
          className={`i2-grid-time-status${drag !== null ? ' is-floating' : ''}`}
          role="status"
          aria-label="Zeiten beim Ziehen"
        >
          <Feedback
            store={dragFeedback}
            render={(d) =>
              d !== null ? (
                <>
                  {d.label}
                  {/* Shift/Alt deutlich (F-UX3): farbiges Band am Zeitschild, im DOM nach den Zeiten. */}
                  {/* Plakette (Runde 3): bei jedem Wechsel neu eingesetzt, damit sie kurz aufleuchtet (≤ 200 ms). */}
                  {d.badge !== '' && (
                    <span key={d.mode} className={`i2-grid-mode is-${d.mode}`} data-mode={d.mode}>
                      {d.badge}
                    </span>
                  )}
                </>
              ) : status !== '' ? (
                status
              ) : (
                'Einrasten: 15 Minuten. Shift: Folgeblöcke rücken mit · Alt: ohne Anpassung'
              )
            }
          />
        </div>
        {/* Kurze Ansage beim Wechsel von Shift/Alt (aria-live; F-UX3). */}
        <span className="wap-i2-sr" role="status" aria-label="Ziehmodus">
          <Feedback
            store={dragFeedback}
            render={(d) => (d === null || d.entryKind === 'create' ? '' : MODE_TEXT[d.mode])}
          />
        </span>
        <span className="i2-grid-where" aria-hidden="true">
          {cursorName}
        </span>
        <span id={hintId} className="i2-grid-shortcuts">
          Pfeile bewegen · Enter erfasst · F2 bearbeitet · Entf löscht · Ctrl+C/V · ? Kürzel
        </span>
        <span className="wap-i2-sr" role="status" aria-label="Zellzeiger">
          {announce}
        </span>
      </div>
      <Feedback store={hoverCardStore} render={hoverCard} />
      {goTo && (
        <GoToDialog
          days={days.map((d) => ({
            date: d.date,
            weekday: d.weekday,
            columns: d.columns.map((c) => c.column.name),
          }))}
          entries={readingOrder.map((r) => {
            const e = plan.entries[r.id];
            const view = (views.get(r.date) ?? []).find((v) => itemKey(v) === itemKey(r));
            return {
              key: itemKey(r),
              label: view?.label ?? r.id,
              title: e === undefined ? '' : entryTitle(plan, e),
              besoNumber: e?.type === 'beso' ? e.besoNumber : null,
            };
          })}
          onClose={() => {
            setGoTo(false);
            focusCursor(false);
          }}
          onGo={(target) => {
            setGoTo(false);
            if (target.kind === 'entry') {
              const item = readingOrder.find((r) => itemKey(r) === target.key);
              if (item !== undefined) {
                setSelected({ id: item.id, windowId: item.windowId });
                setPendingFocus(target.key);
              }
              return;
            }
            const c = activeCursor;
            moveCursorTo(
              normalizeCursor(
                {
                  date: target.date,
                  minute: target.minute ?? c?.minute ?? 480,
                  column: target.column ?? c?.column ?? 0,
                },
                days,
                bounds,
              ),
              true,
            );
            lastKeyboardMove.current = Date.now();
          }}
        />
      )}
      {otherDays !== null && plan.entries[otherDays] !== undefined && week !== undefined && (
        <OtherDaysDialog
          title={entryTitle(plan, plan.entries[otherDays] as Entry)}
          days={week.days.map((d, i) => ({ date: addDays(week.startDate, i), weekday: d.weekday }))}
          sourceDate={entryDate(plan.entries[otherDays] as Entry) ?? week.startDate}
          onClose={() => {
            const id = otherDays;
            setOtherDays(null);
            if (id !== null)
              setPendingFocus(selected !== null && selected.id === id ? itemKey(selected) : id);
          }}
          onApply={(dates) => {
            const id = otherDays;
            setOtherDays(null);
            if (id === null) return;
            const focus = selected !== null && selected.id === id ? itemKey(selected) : id;
            dispatch((p, ctx) => copyEntryToDates(p, id, dates, ctx), focus);
            const names = dates
              .map((d) => days.find((x) => x.date === d)?.weekday ?? '')
              .filter((n) => n !== '');
            onToast?.({
              text: `${dates.length} ${dates.length === 1 ? 'Kopie' : 'Kopien'} erstellt (${names.join(', ')})`,
              undo: 'Kopieren',
            });
          }}
        />
      )}
      {scopeQuestion !== null && (
        <I2Dialog
          title={scopeQuestion.title}
          description={scopeQuestion.description}
          onClose={() => setScopeQuestion(null)}
        >
          <div className="i2-grid-scope">
            <button
              ref={scopeFirst}
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const q = scopeQuestion;
                setScopeQuestion(null);
                if (scopeDay === undefined) return;
                if (q.op !== undefined) applyColumnOp(scopeDay, q.op, 'day');
                else applyColumn(scopeDay, q.columnId, q.changes, 'day');
              }}
            >
              Nur dieser Tag
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                const q = scopeQuestion;
                setScopeQuestion(null);
                if (scopeDay === undefined) return;
                if (q.op !== undefined) applyColumnOp(scopeDay, q.op, 'set');
                else applyColumn(scopeDay, q.columnId, q.changes, 'set');
              }}
            >
              Alle Tage mit diesem Spaltensatz
            </button>
          </div>
        </I2Dialog>
      )}
      {menu !== null && (
        <GridMenu
          label={menu.label}
          items={menu.items}
          x={menu.x}
          y={menu.y}
          onClose={(refocus) => {
            const back = menu.refocus;
            setMenu(null);
            if (refocus) back();
          }}
        />
      )}
      {creating?.kind === 'querbalken' && (
        <QuerbalkenDialog
          fromDate={creating.from}
          toDate={creating.to}
          onClose={() => {
            setCreating(null);
            focusCursor(false);
          }}
          onCreate={(title, fromDate, toDate) =>
            createFromDialog(creating, (p, ctx) =>
              createEntry(
                p,
                { type: 'querbalken', fromDate, toDate, title: [{ text: title, bold: true }] },
                ctx,
              ),
            )
          }
        />
      )}
      {creating?.kind === 'marker' && (
        <MarkerDialog
          date={creating.date}
          at={creating.at}
          onClose={() => {
            setCreating(null);
            focusCursor(false);
          }}
          onCreate={(kind, customKind, at, date) =>
            createFromDialog(creating, (p, ctx) =>
              createEntry(
                p,
                {
                  type: 'marker',
                  date,
                  at,
                  kind,
                  customKind,
                  // Immer über alle Planungsspalten (Entscheid Auftraggeber 21.10.2026).
                  columns: MARKER_COLUMNS,
                },
                ctx,
              ),
            )
          }
        />
      )}
      {creating?.kind === 'remark' && (
        <RemarkDialog
          date={creating.date}
          onClose={() => {
            setCreating(null);
            focusCursor(false);
          }}
          onCreate={(text) =>
            createFromDialog(creating, (p, ctx) =>
              createEntry(p, { type: 'dayRemark', date: creating.date, text }, ctx),
            )
          }
        />
      )}
      {renumberDate !== null && (
        <RenumberDialog
          date={renumberDate}
          rows={renumberDayPreview(plan, renumberDate).map((r) => {
            const e = plan.entries[r.besoId];
            return {
              title: e === undefined ? '' : entryTitle(plan, e),
              from: r.from,
              to: r.to,
            };
          })}
          onClose={() => setRenumberDate(null)}
          onConfirm={() => {
            const date = renumberDate;
            setRenumberDate(null);
            dispatch((p, ctx) => renumberDay(p, date, ctx));
            onToast?.({
              text: `${formatDate(date, 'long')} neu nummeriert`,
              undo: 'Neu nummerieren',
            });
          }}
        />
      )}
    </section>
  );
}
