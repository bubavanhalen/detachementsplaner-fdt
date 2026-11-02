// Kp-Vorlage (Vertrag E1-02a Abschnitt 2 «Inhalt der Kp-Vorlage»; Beschrieb 4.7, 4.9).

import type { Column } from '../types';
import type {
  LevelTemplate,
  TemplateColumnSet,
  TemplateDayPreset,
  TemplateWeekPreset,
} from './types';

type TemplateColumn = Omit<Column, 'id' | 'defaultCategoryId'>;

/** Planungsspalte der Beispiel-Spaltensätze: normal, waagrecht, frei (P-8). */
function planning(name: string): TemplateColumn {
  return {
    name,
    kind: 'planning',
    weight: 'normal',
    labelOrientation: 'horizontal',
    origin: 'manual',
  };
}

/** Spaltensatz mit Rap-Spalte «Rap» und Beso-Spalte «Beso» am Ende (R-2-02, R-4.9-19). */
function columnSet(name: string, planningNames: readonly string[]): TemplateColumnSet {
  return {
    name,
    columns: [
      ...planningNames.map(planning),
      {
        name: 'Rap',
        kind: 'rap',
        weight: 'normal',
        labelOrientation: 'horizontal',
        origin: 'manual',
      },
      {
        name: 'Beso',
        kind: 'beso',
        weight: 'normal',
        labelOrientation: 'horizontal',
        origin: 'manual',
      },
    ],
  };
}

const STUFEN = 'KVK Stufen';
const MI_FR = 'KVK Mi–Fr';
const WOCHENENDE = 'Wochenende kompakt';

const voll = (columnSetName: string): TemplateDayPreset => ({ columnSetName, display: 'full' });
const kompakt = (columnSetName: string): TemplateDayPreset => ({
  columnSetName,
  display: 'compact',
});

/**
 * Tage jeder Woche eines neuen Kp-Plans (H-LAYOUT, SA-H-14; Beschrieb 4.4 «KVK Mo–Di … KVK Mi–Fr»): Mo–Di
 * «KVK Stufen», Mi–Fr «KVK Mi–Fr», Sa–So «Wochenende kompakt» kompakt. Gleich für alle Wochen: Die Zug-Spaltensätze
 * der Folgewochen entstehen pro Plan (F-53). Ein frischer Plan hat so keinen Befund.
 */
function kpNewPlanDays(): TemplateWeekPreset {
  return {
    Mo: voll(STUFEN),
    Di: voll(STUFEN),
    Mi: voll(MI_FR),
    Do: voll(MI_FR),
    Fr: voll(MI_FR),
    Sa: kompakt(WOCHENENDE),
    So: kompakt(WOCHENENDE),
  };
}

/** Kp-Vorlage als frisches Objekt je Aufruf (keine geteilten Daten, AR0-18). */
export function kpTemplate(): LevelTemplate {
  return {
    id: 'kp',
    level: 'kp',
    label: 'Kp',
    titlePattern: '{unit} Arbeitsplan {weekLabel}',
    ltgInBlock: 'withOrt',
    besoBox: { height: 'fixed30', numberBold: false },
    standColor: { r: 0, g: 0, b: 0 },
    abbreviationHeading: 'Legende',
    agendaHeading: 'Termine',
    secondaryColumnName: 'Det',
    rapportAsMarker: [],
    legend: [
      {
        name: 'Ltg Bat',
        legendLabel: 'Leitung Bat',
        color: { r: 204, g: 236, b: 255 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'Ltg Kp',
        legendLabel: 'Leitung Kp',
        color: { r: 255, g: 255, b: 153 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'Ltg Zfhr',
        legendLabel: 'Leitung Zfhr',
        color: { r: 253, g: 234, b: 218 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'Extern',
        legendLabel: 'Extern',
        color: { r: 191, g: 191, b: 191 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'Ltg S2',
        legendLabel: 'Ltg S2',
        color: { r: 255, g: 204, b: 153 },
        neutral: false,
        inLegend: true,
      },
      {
        name: 'neutral',
        legendLabel: 'neutral',
        color: { r: 255, g: 255, b: 255 },
        neutral: true,
        inLegend: false,
      },
    ],
    functionList: [
      { code: 'Zfhr', categoryName: 'Ltg Zfhr', singleFunction: false },
      { code: 'S2', categoryName: 'Ltg S2', singleFunction: false },
      { code: 'Bat Kdt', categoryName: 'Ltg Bat', singleFunction: false },
      { code: 'S3', categoryName: 'Ltg Bat', singleFunction: false },
      { code: 'S4', categoryName: 'Ltg Bat', singleFunction: false },
      { code: 'Kp Kdt', categoryName: 'Ltg Kp', singleFunction: true },
      { code: 'Kdt Stv', categoryName: 'Ltg Kp', singleFunction: true },
      { code: 'Einh Fw', categoryName: 'Ltg Kp', singleFunction: true },
      { code: 'Four', categoryName: 'Ltg Kp', singleFunction: true },
    ],
    // Bedeutungen nach der Arbeitsannahme Q-045 (d) (Vertrag E1-02h Abschnitt 5; R-4.7-20); ARK und BR 0–3 nach
    // Gate B 28.10.2026 Nr 39 (Antwort des Auftraggebers), KR nach der Antwort vom 29.10.2026.
    rapportCodes: [
      { code: 'KR', categoryName: 'Ltg Kp', meaning: 'Kompanierapport' },
      { code: 'DR', categoryName: 'Ltg Kp', meaning: 'Dienstrapport' },
      { code: 'AR1', categoryName: 'Ltg Kp', meaning: 'Arbeitsrapport 1' },
      { code: 'AR2', categoryName: 'Ltg Kp', meaning: 'Arbeitsrapport 2' },
      { code: 'ARK', categoryName: 'Ltg Kp', meaning: 'Ausbildungsrapport Kompanie' },
      { code: 'BR 0', categoryName: 'Ltg Bat', meaning: 'Bataillonsrapport KVK' },
      { code: 'BR 1', categoryName: 'Ltg Bat', meaning: 'Bataillonsrapport Wo 1' },
      { code: 'BR 2', categoryName: 'Ltg Bat', meaning: 'Bataillonsrapport Wo 2' },
      { code: 'BR 3', categoryName: 'Ltg Bat', meaning: 'Bataillonsrapport Wo 3' },
    ],
    columnSets: [
      columnSet(STUFEN, ['Kp Kdt', 'Stv', 'Zfhr', 'Uof', 'höh Uof', 'Trp']),
      columnSet(MI_FR, ['Kdo', 'Mö', 'Sph']),
      columnSet(WOCHENENDE, ['Kp']),
    ],
    newPlanDays: kpNewPlanDays(),
    markerLabels: [
      { kind: 'AV', withTime: false },
      { kind: 'ABV', withTime: true },
      { kind: 'HV', withTime: false },
      { kind: 'custom', withTime: false },
    ],
    fontSizes: { standard: 5, blockTitle: 5.5, besoNumber: 5, rapportCode: 5, min: 4.5 },
    pageGeometryId: 'kp',
  };
}
