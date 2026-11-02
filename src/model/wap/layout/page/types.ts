// Typen der Seitenkomposition (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt B und C;
// Beschrieb 10, Anhang B-Kp; ADR-004, Leitplanke 2). Masse in pt, Ursprung oben links, y nach unten.

import type { LevelTemplate, TemplateSet } from '../../template';
import type { Id, IsoDate, Plan, Rgb, Week } from '../../types';
import type { DroppedLine, FallbackKind, GridFrame, GridLayout, GridLineStyles } from '../grid';
import type { PageItem, PageModel, Rect, Stroke } from '../pageModel';

/** Seitengeometrie einer Vorlage; Werte der Kp-Seite nur aus Anhang B-Kp (CSV), Abschnitt C. */
export interface PageGeometry {
  readonly id: string;
  /** Kp 841,89 × 595,28 (R-10-01, B-Kp-01). */
  readonly paper: { readonly widthPt: number; readonly heightPt: number };
  /** Bis Aussenkante Rahmenstrich (B-Kp-04, -05). */
  readonly marginsMm: {
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
    readonly left: number;
  };
  /** B-Kp-02. */
  readonly frameStroke: Stroke;
  /** Vielfache der Seiteneinheit h (C1). */
  readonly heightsH: {
    /** B-Kp-08. */
    readonly header: number;
    /** B-Kp-09. */
    readonly dayHeader: number;
    /** B-Kp-10. */
    readonly columnHeaderHorizontal: number;
    /** B-Kp-10. */
    readonly columnHeaderVertical: number;
    /** B-Kp-12. */
    readonly grid: number;
    /** B-Kp-13. */
    readonly gap: number;
    /** B-Kp-14. */
    readonly agenda: number;
    /** B-Kp-87. */
    readonly agendaHead: number;
  };
  /** Anteil an W_R (B-Kp-15, -16). */
  readonly widthShares: { readonly timeAxis: number; readonly sidebar: number };
  /** Linienarten des Rasters (Vertrag E1-02d §5). */
  readonly lines: GridLineStyles;
  readonly pageLines: {
    /** B-Kp-27. */
    readonly headerBottom: Stroke;
    /** B-Kp-19. */
    readonly titleFrame: Stroke;
    /** B-Kp-24. */
    readonly classificationFrame: Stroke;
    /** V-02e-15: wie lines.gridEdge. */
    readonly sidebarEdge: Stroke;
    /** V-02e-15: wie lines.gridEdge. */
    readonly dayHeadBottom: Stroke;
    /** B-Kp-13. */
    readonly agendaTop: Stroke;
    /** B-Kp-87. */
    readonly agendaHeadBottom: Stroke;
    /** B-Kp-78. */
    readonly table: Stroke;
    /** B-Kp-75. */
    readonly readinessFrame: Stroke;
    /** B-Kp-84. */
    readonly sunTable: Stroke;
    /** B-Kp-116: feine Zeilen- und Nr-Spaltenlinie der Bemerkungen (Vertrag E1-02k §2 S3; Gate S A4). */
    readonly remarkRule: Stroke;
  };
  /**
   * text und readinessGrey nach B-Kp-99, -98. statusRed = {192, 0, 0} (#c00000, Gate 0 Q-009 UI-F-1,
   * Vertrag E1-10); [K] B-Kp-100 nennt die Referenzfarbe, Prüfung in E1-10 (I).
   */
  readonly colors: { readonly text: Rgb; readonly readinessGrey: Rgb; readonly statusRed: Rgb };
  /** B-Kp-108. */
  readonly fontSizes: {
    readonly title: number;
    readonly beilage: number;
    readonly weekLine: number;
    readonly signature: number;
    readonly motto: number;
    readonly sunTime: number;
    readonly readiness: number;
  };
}

/** Optionen der Wochenseite (unverändert gegenüber §1 des Vertrags). */
export interface PageOptions {
  /** 'A3' in E1-10 (Stub `layout.page.a3` bis dahin, F-43). */
  readonly paper: 'A4' | 'A3';
  /**
   * Rote Status-Darstellung (Beschrieb 10 «Status», R-10-27 bis R-10-29; pro PDF abschaltbar, R-10-31). Allein
   * massgebend (F-LAYOUT2, TE-I3-01 entschieden 19.10.2026 «1: ja»).
   */
  readonly showStatus: boolean;
  /**
   * Ohne Wirkung (F-LAYOUT2, TE-I3-01 entschieden): der frühere Übergangsschalter der Status-Darstellung. Nur noch
   * angenommen, damit bestehende Aufrufer (Oberfläche, eingefrorene Testhilfen) ihn weiter setzen dürfen.
   * @deprecated Nicht mehr setzen; massgebend ist `showStatus`.
   */
  readonly statusRendering?: boolean;
  /**
   * «Änderungen markieren» (Beschrieb 10; I5): Einträge, die seit dem letzten Stand neu oder geändert sind, im
   * Raster und in den Terminen rot. Leer oder fehlend = aus. Der Aufrufer vergleicht mit dem letzten Stand.
   */
  readonly changedEntryIds?: readonly Id[];
  /** Für das Stand-PDF (E1-05). */
  readonly standOverride?: { readonly date: IsoDate; readonly version: number };
  /** Vorlagen als Daten (AR0-18); gewählt wird über plan.templateId. */
  readonly templates: TemplateSet;
}

/** Bereiche der Seite (Abschnitt C1 bis C3, C5). */
export interface PageFrame {
  /** Rahmen auf der Strichmitte; W_R = frame.w, H_R = frame.h. */
  readonly frame: Rect;
  /** Seiteneinheit (C1). */
  readonly h: number;
  /** C1. */
  readonly verticalColumnHeads: boolean;
  /** frame.x … xS, frame.y … yK. */
  readonly header: Rect;
  /** xS … rechter Rahmen, frame.y … yK. */
  readonly standCell: Rect;
  /** Eingabe für layoutGrid (E1-02d); lines = geometry.lines. */
  readonly grid: GridFrame;
  /** xS … rechter Rahmen, yK … y(to). */
  readonly sidebarUpper: Rect;
  /** frame.x … xS − a, yT … Rahmenunterkante. */
  readonly agenda: Rect;
  /** xS − a … rechter Rahmen, y(to) … Rahmenunterkante. */
  readonly sidebarLower: Rect;
}

export interface PageContext {
  readonly plan: Plan;
  readonly week: Week;
  readonly template: LevelTemplate;
  readonly geometry: PageGeometry;
  readonly frame: PageFrame;
  readonly options: PageOptions;
}

export type PageRegion = 'header' | 'gridHead' | 'block' | 'band' | 'agenda' | 'sidebar';

export type PageTextKind =
  | 'army'
  | 'weekLine'
  | 'title'
  | 'beilage'
  | 'classification'
  | 'unit'
  | 'stand'
  | 'continuationTitle'
  | 'axisHead'
  | 'hour'
  | 'dayHead'
  | 'columnHead'
  | 'agendaLabel'
  | 'agendaHead'
  | 'agendaLine'
  | 'sidebarHeading'
  | 'goal'
  | 'readiness'
  | 'remarkNumber'
  | 'remark'
  | 'abbreviation'
  | 'legendLabel'
  /** Bedeutung eines Kürzels in der Kürzelliste (Vertrag E1-02k §4; R-10-53). */
  | 'abbreviationMeaning'
  | 'signature'
  | 'motto'
  | 'sunTime';

/** Je TextItem aller Seiten genau ein Eintrag; 'entry' = Text aus GridLayout.items (Grösse regelt E1-02d). */
export interface PageTextRef {
  readonly page: number;
  readonly item: number;
  readonly kind: PageTextKind | 'entry';
  readonly standardSizePt: number | null;
  readonly date: IsoDate | null;
}

/** Obermenge von FallbackEvent (E1-02d): Ereignisse aus dem Raster unverändert mit field und columnId null. */
export interface PageFallbackEvent {
  readonly kind: FallbackKind;
  readonly region: PageRegion;
  readonly weekId: Id;
  readonly date: IsoDate | null;
  readonly entryId: Id | null;
  readonly piece: number | null;
  readonly dropped: readonly DroppedLine[];
  readonly field: PageTextKind | null;
  /** Nur bei field 'columnHead' gesetzt (V13). */
  readonly columnId: Id | null;
  /** Nur bei kind 'tooManyColumns': Spaltensatz des Tages (E1-02l R1, Befund am Spaltensatz). */
  readonly columnSetId?: Id | null;
  /** Nur bei kind 'labelOutside' in der Kürzelliste: das betroffene Kürzel (H-LAYOUT, Meldung mit Ursache). */
  readonly text?: string;
}

export type LayoutWarningCode = 'missingGlyph' | 'invalidCharacter' | 'invalidImage';

/**
 * page/item: Index in WeekPageLayout.pages bzw. pages[page].items, beide 0-basiert (anders als
 * readPdf, das Seiten ab 1 zählt).
 */
export interface LayoutWarning {
  readonly code: LayoutWarningCode;
  readonly character: string | null;
  readonly codePoint: string | null;
  readonly entryId: Id | null;
  readonly page: number;
  readonly item: number | null;
}

export interface RegionLayout {
  readonly items: readonly PageItem[];
  /** item = Index in items. */
  readonly texts: readonly {
    readonly item: number;
    readonly kind: PageTextKind;
    readonly standardSizePt: number;
    readonly date: IsoDate | null;
  }[];
  readonly fallbacks: readonly PageFallbackEvent[];
}

/** parts[0] = Wochenseite, parts[k] = k-te Fortsetzungsseite; parts.length ≥ 1. */
export interface FlowLayout {
  readonly parts: readonly RegionLayout[];
}

export interface WeekPageLayout {
  /** [Wochenseite, …Fortsetzungsseiten] (R-10-02, R-10-42). */
  readonly pages: readonly PageModel[];
  readonly grid: GridLayout;
  readonly frame: PageFrame;
  /** grid = frame.grid.rect, sidebar = frame.sidebarUpper. */
  readonly regions: {
    readonly header: Rect;
    readonly grid: Rect;
    readonly sidebar: Rect;
    readonly agenda: Rect;
  };
  readonly texts: readonly PageTextRef[];
  readonly fallbacks: readonly PageFallbackEvent[];
  readonly warnings: readonly LayoutWarning[];
}
