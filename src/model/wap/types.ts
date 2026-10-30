// Datenmodell des WAP-Planers (ADR-002): ein unveränderliches Dokument ohne Positionen.
// Vertrag E1-02a Abschnitt 1 (docs/wap-planer/plan/vertraege/E1-02a.md); alle Felder der Etappe 1.

export type Id = string;
export type IsoDate = string; // 'yyyy-mm-dd'
export type MilTime = number; // Minuten seit 0000, Vielfaches von 5
export type Weekday = 'Mo' | 'Di' | 'Mi' | 'Do' | 'Fr' | 'Sa' | 'So';
export type PlanLevel = 'kp' | 'bat';
export type DayDisplay = 'full' | 'compact' | 'hidden';
export type ColumnKind = 'planning' | 'secondary' | 'rap' | 'beso';
export type ColumnWeight = 'narrow' | 'normal' | 'wide';
export type LabelOrientation = 'horizontal' | 'vertical';
export type TextDirection = 'auto' | 'horizontal' | 'vertical';
export type EntryStatus = 'confirmed' | 'open' | 'cancelled';
export type MarkerKind = 'AV' | 'ABV' | 'HV' | 'custom';
export type RapportDisplay = 'rapColumn' | 'alsoInColumns' | 'onlyInColumns';
export type EntryType =
  | 'block'
  | 'querbalken'
  | 'marker'
  | 'rapport'
  | 'beso'
  | 'dayRemark'
  | 'multiDayRemark';
/** Präfixe der Plan-IDs (Abschnitt 8 P-3): w Woche, e Eintrag, c Spalte, s Spaltensatz, k Leitungskategorie, t Zeitfenster, g Wochenziel, r Person (roster). */
export type IdPrefix = 'w' | 'e' | 'c' | 's' | 'k' | 't' | 'g' | 'r';
export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Titel als Rich Text (Beschrieb 5.1 «ein Teil fett»). `besoRef`: Verweis auf einen Beso (R-5.3-11); `text` ist dann leer und wird aus der aktuellen Nummer gebildet «(21)». */
export interface TextRun {
  readonly text: string;
  readonly bold: boolean;
  readonly besoRef?: Id;
}
export type RichText = readonly TextRun[];

/** Zeitformen (Beschrieb 4.6). 'range': from < to ≤ from + 1440; to > 1440 = über Mitternacht (R-4.5-10). 'deadline': Frist am Tag des Eintrags, ohne `to` ganztägig (R-4.6-36). */
export type TimeSpec =
  | { readonly form: 'point'; readonly at: MilTime }
  | { readonly form: 'range'; readonly from: MilTime; readonly to: MilTime }
  | { readonly form: 'from'; readonly from: MilTime }
  | { readonly form: 'until'; readonly to: MilTime }
  | { readonly form: 'deadline'; readonly to?: MilTime };
export type TimeForm = TimeSpec['form']; // Glossar «Zeitform» (Abschnitt 8 P-1)

/** 'all' = alle Planungsspalten des Tages, bleibt beim Tageswechsel «alle» (R-5.1-19). 'ids': Reihenfolge von links; nicht benachbarte IDs = verknüpfte Teilblöcke eines Eintrags (ADR-002 Punkt 5). */
export type ColumnSelection =
  | { readonly kind: 'all' }
  | { readonly kind: 'ids'; readonly ids: readonly Id[] };

export interface Column {
  readonly id: Id;
  readonly name: string;
  readonly kind: ColumnKind;
  readonly weight: ColumnWeight;
  readonly labelOrientation: LabelOrientation;
  readonly defaultCategoryId: Id | null;
  readonly origin: 'manual' | 'detachementsplaner';
}
/** Spalten in Anzeigereihenfolge: planning*, secondary?, rap, beso (R-2-02; validiert). */
export interface ColumnSet {
  readonly id: Id;
  readonly name: string;
  readonly columns: readonly Column[];
}

export interface DayConfig {
  readonly weekday: Weekday;
  readonly columnSetId: Id | null;
  readonly display: DayDisplay;
  readonly internalNote: string;
}
export interface WeekGoal {
  readonly id: Id;
  readonly text: string;
  readonly group: string | null;
}
export interface Week {
  readonly id: Id;
  readonly label: string;
  readonly shortName: string;
  readonly startDate: IsoDate; // Montag
  readonly days: readonly [
    DayConfig,
    DayConfig,
    DayConfig,
    DayConfig,
    DayConfig,
    DayConfig,
    DayConfig,
  ];
  readonly weekGoals: readonly WeekGoal[];
  readonly heightenedReadiness: string;
  readonly sunOverride: { readonly sunrise: MilTime | null; readonly sunset: MilTime | null }; // Etappe 1: von Hand (R-4.8-11)
  readonly agendaWeekend: 'auto' | 'separate' | 'combined'; // F-10
  readonly hiddenRemarkIds: readonly Id[]; // R-4.2-08
}

/** legendLabel: Beschriftung in der PDF-Legende, frei änderbar; name bleibt der Kategoriename im Tool (Gate 0, B-F-05; R-4.7-05, R-10-24).
 *  Kp-Vorlage: name «Ltg Bat», «Ltg Kp», «Ltg Zfhr», «Extern», «Ltg S2» (Beschrieb 4.7) mit legendLabel «Leitung Bat», «Leitung Kp», «Leitung Zfhr», «Extern», «Ltg S2». */
export interface LtgCategory {
  readonly id: Id;
  readonly name: string;
  readonly legendLabel: string;
  readonly color: Rgb;
  readonly neutral: boolean;
  readonly inLegend: boolean;
}
export interface FunctionEntry {
  readonly code: string;
  readonly categoryId: Id | null;
  readonly singleFunction: boolean;
}
export interface RapportCode {
  readonly code: string;
  readonly categoryId: Id;
} // R-4.9-18
export interface MarkerLabelSetting {
  readonly kind: MarkerKind;
  readonly withTime: boolean;
} // F-55
export interface Person {
  readonly id: Id;
  readonly grad: string;
  readonly name: string;
  readonly vorname: string;
  readonly funktion: string;
}
export type NameOrder = 'gradVornameName' | 'gradNameVorname';
export interface Commander {
  readonly grad: string;
  readonly name: string;
  readonly vorname: string;
  readonly funktion: string;
  readonly nameOrder: NameOrder;
}
export interface ImageAsset {
  readonly mime: 'image/png' | 'image/jpeg';
  readonly dataBase64: string;
}

/**
 * Teilaufgabe eines Blocks (Gate S A1; R-4.6-63; Vertrag E1-02h Abschnitt 1). Ein Wert ohne ID; die Lage in
 * `Block.subtasks` ist die Anzeigereihenfolge. Titel nach Trimmen nicht leer (Q-045 (a)); `ltg` und `ort`
 * '' = leer (Ltg optional, Abweichung nach Q-045 (g)). Kein Feld «Stufe», bis Q-041 entschieden ist.
 */
export interface Subtask {
  readonly title: RichText;
  readonly ltg: string;
  readonly ort: string;
}

interface EntryBase {
  readonly id: Id;
  readonly status: EntryStatus;
  readonly changed: boolean;
  readonly createdSeq: number; // Erfassungsreihenfolge (R-4.6-40)
  readonly internalNote: string; // nie im PDF, nie im Listen-Export (R-6-08, R-6-40)
  readonly removedText: readonly string[]; // entfernte Textteile aus dem Import (F-30)
}
export interface Block extends EntryBase {
  readonly type: 'block';
  readonly date: IsoDate;
  readonly time: Exclude<TimeSpec, { form: 'deadline' }>; // F-04
  readonly columns: ColumnSelection;
  readonly title: RichText;
  readonly supplement: string;
  readonly ltg: string;
  readonly tn: string;
  readonly tpt: string;
  readonly ort: string;
  readonly tenue: string;
  readonly printTn: boolean;
  readonly printTenue: boolean; // F-27
  readonly categoryId: Id;
  readonly secondCategoryId: Id | null;
  readonly textDirection: TextDirection;
  readonly openEnd: boolean;
  /** Teilaufgaben (Gate S A1, R-4.6-63); fehlt = keine, nie eine leere Liste (kanonisch, Vertrag E1-02h). Nur bei Blöcken (R-4.6-64). */
  readonly subtasks?: readonly Subtask[];
}
export interface Querbalken extends EntryBase {
  readonly type: 'querbalken';
  readonly title: RichText;
  readonly fromDate: IsoDate;
  readonly toDate: IsoDate;
  readonly columns: ColumnSelection;
  readonly categoryId: Id | null;
}
export interface Marker extends EntryBase {
  readonly type: 'marker';
  readonly date: IsoDate;
  readonly at: MilTime;
  readonly kind: MarkerKind;
  readonly customKind: string; // nur bei kind 'custom' (Art «frei»)
  readonly columns: ColumnSelection;
  readonly asFlatBlock: boolean;
  /** Dauer des flachen Blocks in Minuten (Import: Höhe des Kästchens, VQA-H1 c); fehlt: Vorgabe der Darstellung. */
  readonly flatBlockMinutes?: number;
}
export interface Rapport extends EntryBase {
  readonly type: 'rapport';
  readonly date: IsoDate;
  readonly code: string;
  readonly time: Extract<TimeSpec, { form: 'point' | 'range' }>; // F-04
  readonly ort: string;
  readonly tn: string;
  readonly categoryId: Id;
  readonly display: RapportDisplay;
  readonly displayColumns: ColumnSelection;
}
export interface BesoTimeWindow {
  readonly id: Id;
  readonly time: TimeSpec;
  readonly columnId: Id | null;
  readonly supplement: string;
}
export interface Beso extends EntryBase {
  readonly type: 'beso';
  readonly date: IsoDate;
  readonly title: RichText;
  readonly windows: readonly BesoTimeWindow[]; // ≥ 1 (R-4.6-25)
  readonly ltg: string;
  readonly tn: string;
  readonly tpt: string;
  readonly ort: string;
  readonly categoryId: Id | null; // null = keine Leitungskategorie (Beschrieb 4.6 Feldtabelle Beso optional; UX-AB-15)
  readonly besoNumber: number | null; // null nur beim 11. Beso eines Tages (F-14)
  readonly numberFixed: boolean;
  readonly agendaOverride: string | null; // Freitext ohne Nummer (F-57)
}
export interface DayRemark extends EntryBase {
  readonly type: 'dayRemark';
  readonly date: IsoDate;
  readonly text: string;
}
export type RemarkScope =
  | { readonly kind: 'plan' }
  | { readonly kind: 'week'; readonly weekId: Id }
  | { readonly kind: 'range'; readonly fromDate: IsoDate; readonly toDate: IsoDate };
export interface MultiDayRemark extends EntryBase {
  readonly type: 'multiDayRemark';
  readonly text: string;
  readonly scope: RemarkScope;
  readonly number: number | null;
  readonly refBoxColumnId: Id | null; // Verweis-Kästchen ab Etappe 3
}
export type Entry = Block | Querbalken | Marker | Rapport | Beso | DayRemark | MultiDayRemark;

export interface Plan {
  readonly schemaVersion: 1;
  readonly id: Id;
  readonly level: PlanLevel;
  readonly templateId: string;
  readonly unit: string;
  readonly parentUnit: string;
  readonly service: string;
  readonly exerciseName: string;
  readonly beilage: string;
  readonly classification: string; // leer = keine (R-15-01)
  readonly sunLocation: string;
  readonly commander: Commander;
  readonly signatureImage: ImageAsset | null;
  readonly signatureEnabled: boolean; // Standard aus (R-15-03)
  readonly coatOfArms: ImageAsset | null;
  readonly motto: string;
  readonly persons: readonly Person[];
  readonly functionList: readonly FunctionEntry[];
  readonly legend: readonly LtgCategory[];
  readonly rapportCodes: readonly RapportCode[];
  readonly abbreviationsSelected: readonly string[]; // vom Bearbeiter gewählte weitere Kürzel (R-4.7-14)
  /** Kürzelbedeutung je Plan, Kürzel → Text; geht der Vorlage vor (R-4.7-21, V-02e-4). Fehlt = keine eigenen; nie ein leeres Objekt (Vertrag E1-02h). */
  readonly abbreviationMeanings?: Readonly<Record<string, string>>;
  readonly markerLabels: readonly MarkerLabelSetting[];
  readonly columnSets: readonly ColumnSet[];
  readonly weeks: readonly Week[];
  readonly deletedWeeks: readonly { readonly week: Week; readonly entries: readonly Entry[] }[]; // F-17
  readonly entries: Readonly<Record<Id, Entry>>;
  readonly displayRange: { readonly from: MilTime; readonly to: MilTime }; // Standard 0400–2400 (R-4.5-01)
  readonly stand: { readonly date: IsoDate; readonly version: number } | null;
  readonly nextSeq: number; // Erfassungsreihenfolge (createdSeq)
  readonly nextId: number; // Zähler für alle IDs innerhalb des Plans (ADR-002 Punkt 8b, AR0-19); monoton über Wiederherstellen und Ersetzen (AR0-31); Undo stellt den vorherigen Wert exakt her (AR0-41)
  readonly lastUsedCategoryId: Id | null;
  readonly printDefaults: { readonly printTn: boolean; readonly printTenue: boolean };
  readonly acknowledgedFindings: readonly {
    readonly key: string;
    readonly reason: string;
    readonly at: IsoDate;
  }[]; // quittierte Befunde mit Grund und Datum (E1-16, UI-Richtlinie 8.2)
}
