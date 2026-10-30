// Typen des Rasters und der Einträge (Vertrag E1-02d Abschnitt 1; ADR-004, Leitplanke 2).
// Masse in pt, Ursprung oben links, y nach unten; Zeiten in Minuten seit 0000 des Tages.
// Rasterlinien und Köpfe zeichnet E1-02e aus `days`, `timeScale` und `band`; `items` enthält nur Einträge.

import type { LevelTemplate } from '../../template';
import type {
  ColumnKind,
  DayDisplay,
  EntryType,
  Id,
  IsoDate,
  MilTime,
  Plan,
  Weekday,
} from '../../types';
import type { PageItem, Rect, Stroke } from '../pageModel';

/**
 * Linienarten aus Anhang B-Kp; die Werte setzt E1-02e (`PageGeometry.lines`). E1-02d verwendet nur die
 * Eintragsrahmen `blockBorder`, `rapportBorder`, `besoBoxBorder`, `querbalkenBorder`, `markerLine`,
 * `markerFieldBorder`.
 */
export interface GridLineStyles {
  readonly hour: Stroke;
  readonly halfHour: Stroke;
  readonly gridEdge: Stroke;
  readonly dayBorder: Stroke;
  readonly columnBorder: Stroke;
  readonly rapSeparator: Stroke;
  readonly laneBorder: Stroke;
  readonly blockBorder: Stroke;
  readonly rapportBorder: Stroke;
  readonly besoBoxBorder: Stroke;
  readonly querbalkenBorder: Stroke;
  readonly markerLine: Stroke;
  readonly markerFieldBorder: Stroke;
}

/**
 * Rasterfläche: links Zeitachse, Tage, rechts Zeitachse; oben Tageskopf und Spaltenkopf, darunter
 * y(from) bis y(to) = Unterkante von `rect`.
 */
export interface GridFrame {
  readonly rect: Rect;
  readonly timeAxisWidthPt: number;
  readonly dayHeaderHeightPt: number;
  readonly columnHeaderHeightPt: number;
  readonly lines: GridLineStyles;
}

export interface GridLayoutInput {
  readonly plan: Plan;
  readonly weekId: Id;
  readonly template: LevelTemplate;
  readonly frame: GridFrame;
  /** Rote Status-Darstellung (Beschrieb 10, R-10-31: pro PDF abschaltbar); fehlt = aus. */
  readonly showStatus?: boolean;
  /** «Änderungen markieren» (Beschrieb 10): seit dem letzten Stand geänderte Einträge rot; fehlt = aus. */
  readonly changedEntryIds?: readonly Id[];
}

/** Lineare Abbildung Zeit → y; `yTop` = y(fromMin). */
export interface TimeScale {
  readonly fromMin: MilTime;
  readonly toMin: MilTime;
  readonly yTop: number;
  readonly ptPerMinute: number;
}

export interface LaneGeometry {
  readonly x: number;
  readonly w: number;
}

/** `lanes`: Beso-Spalte linke und rechte Hälfte, sonst leer. */
export interface ColumnGeometry {
  readonly columnId: Id;
  readonly kind: ColumnKind;
  readonly x: number;
  readonly w: number;
  readonly lanes: readonly LaneGeometry[];
}

/** Nur sichtbare Tage. `unitPt` = Tagesbreite / Summe der Spaltengewichte (0 ohne Spalten). */
export interface DayGeometry {
  readonly date: IsoDate;
  readonly weekday: Weekday;
  readonly display: Exclude<DayDisplay, 'hidden'>;
  readonly x: number;
  readonly w: number;
  readonly unitPt: number;
  readonly columns: readonly ColumnGeometry[];
}

/** Zeitspanne in Minuten des Tages; darf rechnerisch unter 0 oder über 1440 liegen. */
export interface TimeSpan {
  readonly from: number;
  readonly to: number;
}

export type PieceKind =
  | 'querbalken'
  | 'block'
  | 'rapportBox'
  | 'besoBox'
  | 'markerLine'
  | 'markerField'
  /**
   * E1-02l R2: Träger des Rapportkürzels bzw. der Beso-Nummer neben dem Kästchen; `part` = Index des beschrifteten
   * Kästchens in `EntryGeometry.pieces`, `windowId` null, `span` wie das Kästchen.
   */
  | 'outsideLabel';

export interface EntryPiece {
  readonly kind: PieceKind;
  /** Tag des Teilstücks; Querbalken über mehrere Tage: erster sichtbarer Tag des Teilstücks. */
  readonly date: IsoDate;
  readonly rect: Rect;
  /** Logische Spanne dieses Tages vor dem Zuschnitt auf den Zeitbereich; null bei Querbalken; Marker [at, at]. */
  readonly span: TimeSpan | null;
  /**
   * Teilblock bzw. Lauf von links (0-basiert); Teilstücke einer Aussparung teilen ihn. Marker-Feld: Lauf, zu dem
   * es gehört; Rapport- und Beso-Kästchen: 0.
   */
  readonly part: number;
  /** Beso-Zeitfenster, sonst null. */
  readonly windowId: Id | null;
  /** Dieses Teilstück ist für den Text vorgesehen (R-4.6-57). */
  readonly textCarrier: boolean;
  /** Ausrichtung des gezeichneten Texts; null, wenn das Teilstück keinen Text zeichnet. */
  readonly textOrientation: 'horizontal' | 'vertical' | null;
  /** Randlose Kante (Zuschnitt auf den Zeitbereich, Mitternacht). */
  readonly openTop: boolean;
  readonly openBottom: boolean;
  /** Fortsetzung über Mitternacht (R-4.5-10). */
  readonly continuation: 'none' | 'toNextDay' | 'fromPreviousDay';
}

export interface EntryGeometry {
  readonly entryId: Id;
  readonly type: EntryType;
  /** In Zeichenreihenfolge; leer, wenn der Eintrag keine Fläche hat (z.B. keine Spalte). */
  readonly pieces: readonly EntryPiece[];
}

export type FallbackKind =
  | 'lineDropped'
  | 'ellipsis'
  | 'textOmitted'
  | 'continuationPage'
  | 'bandOverflow'
  | 'bandNoCommonLane'
  /**
   * E1-02l R1 (R-10-54): Ein Spaltenkopf passt auch in Mindestgrösse nicht in seine Spalte; er ist trotzdem
   * vollständig gezeichnet. Befund am Spaltensatz «zu viele Spalten für diesen Tag» (Stufe Fehler, P8).
   */
  | 'tooManyColumns'
  /**
   * E1-02l R2 (R-10-55): Rapportkürzel bzw. Beso-Nummer passt auch in Mindestgrösse nicht ins Kästchen und steht
   * vollständig daneben im nächsten freien Bereich (Teilstück 'outsideLabel', P8).
   */
  | 'labelOutside';

/**
 * Zeilenarten der Rückfallregel (F-61; mit Teilaufgaben R-10-48, H-LAYOUT SA-H-01). Die Arten der Teilaufgaben
 * stehen je entfallener Teilaufgabe einmal in `dropped` (Leerzeile vor der Gruppe, Ort, Ltg, ganze Gruppe).
 */
export type DroppedLine =
  | 'tn'
  | 'tenue'
  | 'ltg'
  | 'ort'
  | 'supplement'
  | 'subtaskGap'
  | 'subtaskOrt'
  | 'subtaskLtg'
  | 'subtaskTitle';

export interface FallbackEvent {
  readonly kind: FallbackKind;
  /**
   * 'block' = jeder Eintragstext im Raster; 'band' = Querbalken ohne freie Lage ('bandOverflow': an diesem Tag
   * beide Lagen belegt; 'bandNoCommonLane': keine gemeinsame Lage, Ereignis am ersten sichtbaren Tag).
   */
  readonly region: 'block' | 'agenda' | 'sidebar' | 'band';
  readonly weekId: Id;
  readonly date: IsoDate | null;
  readonly entryId: Id | null;
  /** Index in `EntryGeometry.pieces` des Textträgers; null bei 'band', 'agenda', 'sidebar'. */
  readonly piece: number | null;
  readonly dropped: readonly DroppedLine[];
}

export interface GridLayout {
  readonly timeScale: TimeScale;
  readonly band: Rect;
  readonly days: readonly DayGeometry[];
  /** Nur Einträge, in Zeichenreihenfolge (spätere liegen oben). */
  readonly items: readonly PageItem[];
  readonly entries: readonly EntryGeometry[];
  readonly fallbacks: readonly FallbackEvent[];
}
