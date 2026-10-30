// Einstieg des Raster-Layouts für die Seitenkomposition (E1-02e: `from '../grid'`; Vertrag E1-02d Abschnitt 1).

export { GRID_CONSTANTS } from './constants';
export { GRID_LAYOUT_MESSAGES, GridLayoutError, type GridLayoutErrorCode } from './errors';
export { columnWeight, columnWidths, dayWidths, timeToY } from './geometry';
export { layoutGrid } from './layout';
export type {
  ColumnGeometry,
  DayGeometry,
  DroppedLine,
  EntryGeometry,
  EntryPiece,
  FallbackEvent,
  FallbackKind,
  GridFrame,
  GridLayout,
  GridLayoutInput,
  GridLineStyles,
  LaneGeometry,
  PieceKind,
  TimeScale,
  TimeSpan,
} from './types';
