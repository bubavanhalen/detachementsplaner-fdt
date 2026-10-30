// Lagewerte der Zeilen der Kp-Seite (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt B «Die Lagewerte
// der Zeilen … sind interne Konstanten», C, E; Änderungsnotiz Tests Schritt 3). Einzige Quelle ist die CSV
// docs/wap-planer/anhaenge/anhang-b-kp.csv (Nennwert = Sollwert; bei einem Bereich der in der Notiz genannte
// Wert); Werte mit [V]/[T] stammen aus den Vorschlägen bzw. technischen Festlegungen der Notiz. Nur Masse, keine
// Referenztexte. Intern: nicht über page/index.ts exportiert. Werte mit «H» sind Vielfache der Seiteneinheit h.

import { PageLayoutError } from './errors';
import type { PageGeometry } from './types';

export interface PageLage {
  /** B-Kp-17: x = Rahmen links + 1,2; Grundlinie = Rahmen oben + 0,29 h (S3-15: mindestens Abstand zum Feld). */
  readonly armyX: number;
  readonly firstBaselineH: number;
  /** S3-15: Abstand zwischen den Strichbändern von Rahmen und Klassifizierungsfeld. */
  readonly firstRowStrokeGap: number;
  /** B-Kp-18: Grundlinie = Kopf-Unterlinie − 2,2; x = Rahmen links + 26,2. */
  readonly weekLineAboveHeaderBottom: number;
  readonly weekLineX: number;
  /** B-Kp-20: Breite = längere Zeile + 2 × 3,2; oben 1,7 unter der Rahmenoberkante; Höhe in h (0,95–1,00). */
  readonly titlePadX: number;
  readonly titleTop: number;
  readonly titleHeightH: number;
  /** [T] Abstand des Titelrahmens zu den Texten links und zum Stand-Feld. */
  readonly titleGap: number;
  /** B-Kp-25: rechte Textkante K = Rahmen rechts − 1,2. */
  readonly rightTextInset: number;
  /** S3-4 [T]: x(«Stand») = xS + 0,4; B-Kp-26: Grundlinie = Rahmen oben + 0,77 h. */
  readonly standX: number;
  readonly standBaselineH: number;
  /** V-02e-17: Innenabstand des Klassifizierungsfelds waagrecht/senkrecht, Abstand zur Einheit. */
  readonly classPadX: number;
  readonly classPadY: number;
  readonly classGap: number;
  /** B-Kp-28: Wochentag x = Tag links + 3,8; Datum x = Tag links + 5,1 u; Grundlinie 0,61 der Zeilenhöhe. */
  readonly dayNameX: number;
  readonly dayDateU: number;
  readonly dayBaselineShare: number;
  /** [T] Abstand zwischen Wochentag und Datum, wenn das Datum ausweichen muss. */
  readonly dayGap: number;
  /** B-Kp-87: «Was» x = Tag links + 1,1. B-Kp-90: Terminzeilen x = Tag links + 1,0, rechts ebenso. */
  readonly wasX: number;
  readonly agendaX: number;
  /** B-Kp-74 (S3-2): «-» bei xS + 1,0, Folgezeilen bei xS + 4,6. */
  readonly goalX: number;
  readonly goalIndentX: number;
  /** B-Kp-75: Höhe des Bereitschaftskastens 2,53 h. */
  readonly readinessHeightH: number;
  /** V-02e-15: Abstand zwischen den Abschnitten der Seitenleiste 0,5 h. */
  readonly sectionGapH: number;
  /** B-Kp-77, -79: Zeilenhöhe der Kürzel- und Legendentabelle 0,5 h; Tabelle endet 0,5 h über y(to). */
  readonly tableRowH: number;
  readonly legendEndAboveGridH: number;
  /** B-Kp-81 (S3-7): x = xS − a + 4,7; Grundlinien Einheit 0,77 h und Name 2,51 h unter yT. */
  readonly signatureX: number;
  readonly signatureUnitH: number;
  readonly signatureNameH: number;
  /** B-Kp-82: Kasten 3,94 h × 3,87 h, Oberkante 3,4 pt unter der Grundlinie der Funktion. */
  readonly coatWidthH: number;
  readonly coatHeightH: number;
  readonly coatTop: number;
  /** B-Kp-83: Grundlinie des Mottos 7 pt unter dem Wappen. */
  readonly mottoBelow: number;
  /** B-Kp-84: Zelle 0,5 h, Wertzelle 3 Symbolzellen, Abstand zum Rahmen 0,6 pt. */
  readonly sunCellH: number;
  readonly sunValueCells: number;
  readonly sunMargin: number;
}

const KP_LAGE: PageLage = Object.freeze({
  armyX: 1.2,
  firstBaselineH: 0.29,
  firstRowStrokeGap: 0.1,
  weekLineAboveHeaderBottom: 2.2,
  weekLineX: 26.2,
  titlePadX: 3.2,
  titleTop: 1.7,
  titleHeightH: 1.0,
  titleGap: 2.0,
  rightTextInset: 1.2,
  standX: 0.4,
  standBaselineH: 0.77,
  classPadX: 1.0,
  classPadY: 0.5,
  classGap: 2.0,
  dayNameX: 3.8,
  dayDateU: 5.1,
  dayBaselineShare: 0.61,
  dayGap: 2.0,
  wasX: 1.1,
  agendaX: 1.0,
  goalX: 1.0,
  goalIndentX: 4.6,
  readinessHeightH: 2.53,
  sectionGapH: 0.5,
  tableRowH: 0.5,
  legendEndAboveGridH: 0.5,
  signatureX: 4.7,
  signatureUnitH: 0.77,
  signatureNameH: 2.51,
  coatWidthH: 3.94,
  coatHeightH: 3.87,
  coatTop: 3.4,
  mottoBelow: 7,
  sunCellH: 0.5,
  sunValueCells: 3,
  sunMargin: 0.6,
});

/** Lagewerte zur Seitengeometrie; nur 'kp' ist bekannt (sonst wie pageGeometryFor). */
export function pageLage(geometry: PageGeometry): PageLage {
  if (geometry.id !== 'kp') throw new PageLayoutError('unknownPageGeometry');
  return KP_LAGE;
}
