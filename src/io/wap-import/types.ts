// Typen des Excel-Imports (Vertrag E1-08 §1, §1a; Gate S A2: Arten «verdeckt», «teilweise verdeckt»).

import type { UserMessage } from '../../model/wap/errors';
import { WapError } from '../../model/wap/errors';
import type { LevelTemplate } from '../../model/wap/template';
import type { FunctionEntry, Id, IsoDate, Person } from '../../model/wap/types';
import type { Rect } from './geometry';

export interface ImportOptions {
  /** Etappe 1: Kp. */
  readonly template: LevelTemplate;
  /** Für Regel 12 (Klammer = Name → Ltg). */
  readonly persons: readonly Person[];
  readonly functionList: readonly FunctionEntry[];
}

export type ImportReportKind =
  | 'unassignedShape'
  | 'overlappingShapes'
  | 'besoInRapColumn'
  | 'numberOrder'
  | 'boxTimeDeviation'
  | 'numberedWithoutTime'
  | 'boxWithoutText'
  | 'textWithoutBox'
  | 'edgeOffGrid'
  | 'edgeOffGridGrouped'
  | 'unclearColor'
  | 'uncertainParse'
  | 'secondaryColumnCreated'
  | 'truncatedToPlanning'
  | 'gapColumnMerged'
  | 'partlyCancelled'
  | 'cancelled'
  | 'changed'
  | 'missingGlyph'
  /** Gate S A2: Form zu mindestens 99 % verdeckt, kein Eintrag (R-8.2-39). */
  | 'hidden'
  /** Gate S A2: Form zu 5 % bis unter 99 % verdeckt (R-8.2-40). */
  | 'partlyHidden'
  /** F-IMPORT2 (Entscheid 9, 19.10.2026): Text der Wochenziele im Excel nicht sichtbar, nicht übernommen. */
  | 'notVisible'
  /** Kopfangabe der Datei fehlt (z.B. Stand-Datum), Vorgabe übernommen. */
  | 'missingHeader'
  /** Regel 6: nummeriertes Kästchen in einer Planungsspalte → Zeitfenster dieser Spalte. */
  | 'besoInPlanningColumn'
  /** F-UX4 (UX-AB-F-06): Rapport in Rap- und Planungsspalte mit verschiedener Zeit, zwei Rapporte (Hinweis). */
  | 'rapportTwice';

export interface ImportReportItem {
  readonly id: string;
  readonly sheet: string;
  readonly weekId: Id | null;
  readonly date: IsoDate | null;
  readonly kind: ImportReportKind;
  readonly message: UserMessage;
  /** Sprung zur Stelle (R-8.2-21, E1-16). */
  readonly target: {
    readonly entryId: Id | null;
    readonly shapeIndex: number | null;
    readonly originalBox: Rect | null;
  };
  /** Nur bei kind 'edgeOffGridGrouped' (§1a): Anzahl Kanten ≥ 1 und betroffene Blöcke; sonst null. */
  readonly group: { readonly count: number; readonly members: readonly Id[] } | null;
  /** Nur bei Beso-Meldungen: Beso-Nummer, sonst null (Zuordnung im Bericht ohne Inhalte). */
  readonly besoNumber: number | null;
  /** «verdeckt» bzw. «teilweise verdeckt»: ursprüngliche Spanne der Form in Minuten (R-8.2-41), sonst null. */
  readonly span: { readonly from: number; readonly to: number } | null;
  /**
   * Nicht übernommener Text (F-UX1 Runde 2, CR-D-2-02, CR-D-2-04): nur zur Anzeige im lokalen Importbericht, nie
   * Teil der Meldung (die ohne Inhalte bleibt); fehlt bei Meldungen ohne verlorenen Text.
   */
  readonly notTakenText?: readonly string[];
}

/** gelesen = zugeordnet + nicht zugeordnet (R-8.2-20). */
export interface SheetBalance {
  readonly sheet: string;
  readonly weekId: Id | null;
  readonly shapesRead: number;
  readonly assigned: number;
  readonly unassigned: number;
}

export interface ImportReport {
  readonly fileName: string;
  readonly sheets: readonly SheetBalance[];
  readonly items: readonly ImportReportItem[];
}

export type ImportErrorCode =
  | 'notXlsx'
  | 'oldXlsFormat'
  | 'corrupt'
  | 'tooLarge'
  | 'unsupported'
  | 'noWeekSheets'
  | 'calibrationFailed'
  | 'aborted'
  | 'standRenderFailed'
  | 'planNotFound';

export const IMPORT_MESSAGES: { readonly [C in ImportErrorCode]: UserMessage } = {
  notXlsx: {
    cause: 'Die gewählte Datei ist keine Excel-Arbeitsmappe (.xlsx).',
    nextStep: 'Die Excel-Datei des WAP wählen (Endung .xlsx).',
  },
  oldXlsFormat: {
    cause: 'Die Datei ist im alten Excel-Format (.xls) oder verschlüsselt gespeichert.',
    nextStep:
      'Die Datei in Excel öffnen, ohne Kennwort als .xlsx speichern und erneut importieren.',
  },
  corrupt: {
    cause: 'Die Excel-Datei ist beschädigt und kann nicht gelesen werden.',
    nextStep: 'Die Datei in Excel öffnen, neu speichern und erneut importieren.',
  },
  tooLarge: {
    cause: 'Die Datei ist zu gross für den Import.',
    nextStep: 'Speichern Sie die Arbeitsmappe in Excel ohne nicht benötigte Blätter neu.',
  },
  unsupported: {
    cause: 'Die Arbeitsmappe hat keinen lesbaren Aufbau (Arbeitsblätter fehlen).',
    nextStep: 'Prüfen, ob es die WAP-Datei ist, und die Datei in Excel neu speichern.',
  },
  noWeekSheets: {
    cause:
      'In der Arbeitsmappe ist kein Blatt mit einer WAP-Woche (Tageskopf und Zeitachse 0500 … 2300).',
    nextStep: 'Die Excel-Datei des WAP wählen; Blätter ohne Zeitachse werden nicht importiert.',
  },
  calibrationFailed: {
    cause: 'Die Zeitachse eines Blatts konnte nicht erkannt werden.',
    nextStep: 'Prüfen, ob die Stundenbeschriftungen (0500 … 2300) im Blatt vorhanden sind.',
  },
  aborted: {
    cause: 'Der Import wurde abgebrochen. Nichts importiert; der Plan ist unverändert.',
    nextStep: 'Den Import bei Bedarf erneut starten.',
  },
  standRenderFailed: {
    cause:
      'Das PDF für den Stand des Imports konnte nicht erzeugt werden. Nichts importiert; der Plan ist unverändert.',
    nextStep:
      'Die Datei prüfen und den Import erneut starten. Bleibt der Fehler, den WAP-Planer neu laden.',
  },
  planNotFound: {
    cause: 'Der Plan für den Import ist im Speicher nicht vorhanden.',
    nextStep: 'Den Import erneut starten.',
  },
};

/** Fehler des Imports; nichts geändert (Vertrag E1-08 §1). */
export class ImportError extends WapError {
  declare readonly code: ImportErrorCode;

  constructor(code: ImportErrorCode, options?: { cause?: unknown }) {
    super(code, IMPORT_MESSAGES[code], options);
  }
}
