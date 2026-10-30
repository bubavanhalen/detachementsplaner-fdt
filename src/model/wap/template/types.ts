// Vorlage (Stufe) als Daten (Vertrag E1-02a Abschnitt 2; Beschrieb 4.9; F-60, AR0-18).

import type {
  Column,
  DayDisplay,
  LtgCategory,
  MarkerLabelSetting,
  PlanLevel,
  Rgb,
  Weekday,
} from '../types';

/** Schriftgrössen in pt; Kp 5 / 5,5 / 5 / 5 / 4,5 (Beschrieb 10, 15; Gate S). */
export interface FontSizes {
  readonly standard: number;
  readonly blockTitle: number;
  readonly besoNumber: number;
  readonly rapportCode: number;
  readonly min: number;
}

/** Vorbelegung der Funktionsliste (R-4.7-08, R-4.7-09); Kategorie über ihren Namen. */
export interface TemplateFunctionEntry {
  readonly code: string;
  readonly categoryName: string | null;
  readonly singleFunction: boolean;
}

/** Rapportkürzel mit Standard-Kategorie über ihren Namen (R-4.9-18, F-09). */
export interface TemplateRapportCode {
  readonly code: string;
  readonly categoryName: string;
  /** Bedeutung in der Kürzelliste (R-4.7-20, V-02e-4); fehlt oder '' = keine (Vertrag E1-02h). */
  readonly meaning?: string;
}

/** Vorbelegter Spaltensatz (R-4.9-19, F-53); Spalten in Anzeigereihenfolge. */
export interface TemplateColumnSet {
  readonly name: string;
  readonly columns: readonly Omit<Column, 'id' | 'defaultCategoryId'>[];
}

/** Vorbelegung eines Tages im neuen Plan (H-LAYOUT, SA-H-14): Spaltensatz über seinen Namen und Darstellung. */
export interface TemplateDayPreset {
  readonly columnSetName: string;
  readonly display: Exclude<DayDisplay, 'hidden'>;
}

/** Vorbelegung der sieben Wochentage. */
export type TemplateWeekPreset = Readonly<Record<Weekday, TemplateDayPreset>>;

export interface LevelTemplate {
  readonly id: string;
  readonly level: PlanLevel;
  readonly label: string;
  /** Platzhalter {unit}, {weekLabel}; Kp «{unit} Arbeitsplan {weekLabel}» (R-4.9-01). */
  readonly titlePattern: string;
  readonly ltgInBlock: 'withOrt' | 'ownLinePrefixed';
  readonly besoBox: { readonly height: 'fixed30' | 'duration'; readonly numberBold: boolean };
  readonly standColor: Rgb;
  readonly abbreviationHeading: string;
  readonly agendaHeading: string;
  readonly secondaryColumnName: string;
  readonly rapportAsMarker: readonly string[];
  readonly legend: readonly Omit<LtgCategory, 'id'>[];
  readonly functionList: readonly TemplateFunctionEntry[];
  readonly rapportCodes: readonly TemplateRapportCode[];
  readonly columnSets: readonly TemplateColumnSet[];
  /**
   * Tage jeder Woche eines Plans, der mit «Neuer Plan aus Vorlage» entsteht (H-LAYOUT, SA-H-14; Beschrieb 4.4).
   * Fehlt = alle Tage mit dem ersten Spaltensatz, voll.
   */
  readonly newPlanDays?: TemplateWeekPreset;
  readonly markerLabels: readonly MarkerLabelSetting[];
  readonly fontSizes: FontSizes;
  /** Verweis auf die Seitengeometrie der Layout-Schicht (E1-02e, pageGeometryFor). */
  readonly pageGeometryId: string;
}

/** Vorlagen als Parameter, keine globale Registry (AR0-18). */
export type TemplateSet = ReadonlyMap<string, LevelTemplate>;
