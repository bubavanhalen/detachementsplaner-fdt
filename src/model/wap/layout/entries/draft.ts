// Interne Zwischenstände des Raster-Layouts (Vertrag E1-02d Abschnitt 2d–2f): Teilstücke mit Zeichenangaben und
// Textauftrag, bevor Text, Reihenfolge und Teilstück-Indizes feststehen.

import type { LevelTemplate } from '../../template';
import type { Column, Entry, EntryType, Id, IsoDate, Plan, Rgb } from '../../types';
import type { DayGeometry, GridLineStyles, PieceKind, TimeScale, TimeSpan } from '../grid/types';
import type { ItemRole, Rect, Stroke } from '../pageModel';
import type { FontWeight, StyledRun } from '../text/types';
import type { Continuation } from './spans';
import type { BlockTextSpec, RapportBoxTextSpec } from './text';

/** Sichtbarer Tag mit den Spalten seines Spaltensatzes (gleiche Reihenfolge wie `geo.columns`). */
export interface DayContext {
  readonly geo: DayGeometry;
  readonly columns: readonly Column[];
  /** Einträge des Tages nach `entriesOnDate` (E1-02a). */
  readonly entries: readonly Entry[];
}

export interface EntriesContext {
  readonly plan: Plan;
  readonly template: LevelTemplate;
  readonly lines: GridLineStyles;
  readonly scale: TimeScale;
  /** Zeitbereich der zeitlichen Einträge: Bandende V0 und Anzeigeende V1 (2a Nr 5). */
  readonly v0: number;
  readonly v1: number;
  readonly days: readonly DayContext[];
  /** Rote Status-Darstellung (Beschrieb 10; R-10-27 bis R-10-31); fehlt = aus. */
  readonly showStatus?: boolean;
  /** «Änderungen markieren» (Beschrieb 10): Einträge, die seit dem letzten Stand geändert sind, rot. */
  readonly changedEntryIds?: ReadonlySet<Id>;
}

/** Was auf einem Textträger zu setzen ist (2e). */
export type TextSpec =
  | { readonly kind: 'block'; readonly spec: BlockTextSpec }
  | { readonly kind: 'rapportBox'; readonly spec: RapportBoxTextSpec }
  | { readonly kind: 'number'; readonly text: string; readonly weight: FontWeight }
  | {
      readonly kind: 'singleLine';
      readonly head: readonly StyledRun[];
      readonly tail: readonly StyledRun[];
    }
  | { readonly kind: 'omitted' };

/** Hindernis für Eintragstexte (2e «Ausweichen»): nur für Block-Text oder für Block- und Kästchen-Text. */
export type Obstacle = 'blockText' | 'allText' | null;

export interface PieceDraft {
  readonly kind: PieceKind;
  readonly date: IsoDate;
  readonly rect: Rect;
  readonly span: TimeSpan | null;
  readonly part: number;
  readonly windowId: Id | null;
  readonly textCarrier: boolean;
  readonly openTop: boolean;
  readonly openBottom: boolean;
  readonly continuation: Continuation;
  readonly fill: Rgb | null;
  /** Gemeinsame Leitung (R-4.7-03): zweite Füllung, diagonal geteilt von links unten nach rechts oben. */
  readonly secondFill?: Rgb | null;
  /** Offenes Ende (R-4.7-13): unterer Rand als Wellenlinie. */
  readonly wavyBottom?: boolean;
  readonly stroke: Stroke;
  readonly role: ItemRole;
  /** Marker-Linie: y ihrer Achse; sonst null. */
  readonly lineY: number | null;
  readonly text: TextSpec | null;
  readonly obstacle: Obstacle;
}

/** Ein Element in der Zeichenreihenfolge (2f): Gruppe, dann Sortierschlüssel. */
export interface Drawable {
  readonly entryId: Id;
  readonly type: EntryType;
  /** (1) Querbalken, (2) Block und Rapport-Block, (3) Rapport-Kästchen, (4) Beso-Kästchen, (5) Marker. */
  readonly group: 1 | 2 | 3 | 4 | 5;
  /** Querbalken: Lage im Band; sonst 0. */
  readonly bandLevel: number;
  readonly date: IsoDate;
  /** Gezeichneter Beginn in Minuten. */
  readonly start: number;
  readonly seq: number;
  /** Fensterindex beim Beso, sonst 0. */
  readonly sub: number;
  readonly pieces: readonly PieceDraft[];
}

/** Vergleich von IDs nach UTF-16-Codeeinheiten. */
export function compareIds(a: Id, b: Id): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Erfassungsreihenfolge: createdSeq, dann id (2d, 2f). */
export function compareEntries(
  a: { readonly createdSeq: number; readonly id: Id },
  b: { readonly createdSeq: number; readonly id: Id },
): number {
  return a.createdSeq - b.createdSeq || compareIds(a.id, b.id);
}
