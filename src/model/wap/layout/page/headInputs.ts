// Eingaben der Spaltenköpfe eines Tages (Vertrag E1-02e Abschnitt E2; E1-02l R1, R-10-54): Textflächen je Spalte und
// Kopfbereich des Tages. Gemeinsam für das Zeichnen (gridChrome) und die Höhe der Kopfzeile (headHeight, F-LAYOUT2
// Punkt 11). Intern: nicht über page/index.ts exportiert. Rein (R-L-02).

import type { FontSizes } from '../../template';
import type { Column } from '../../types';
import type { ColumnGeometry, DayGeometry, GridLineStyles } from '../grid';
import type { Rect, Stroke } from '../pageModel';
import type { ColumnHeadInput } from './columnHeads';
import { INSET, measureRuns, plainRuns } from './common';

/** Grenzstrich links der Spalte j eines Tages (E2: links der Rap-Spalte `rapSeparator`, sonst `columnBorder`). */
export function borderLeftOf(
  lines: GridLineStyles,
  cols: readonly ColumnGeometry[],
  j: number,
): Stroke {
  if (j === 0) return lines.dayBorder;
  return (cols[j] as ColumnGeometry).kind === 'rap' ? lines.rapSeparator : lines.columnBorder;
}

export function borderRightOf(
  lines: GridLineStyles,
  cols: readonly ColumnGeometry[],
  j: number,
): Stroke {
  return j === cols.length - 1 ? lines.dayBorder : borderLeftOf(lines, cols, j + 1);
}

/** Text eines Spaltenkopfs (E2; R-4.4-08, F-42). */
function headText(
  fontSizes: FontSizes,
  day: DayGeometry,
  col: ColumnGeometry,
  column: Column | undefined,
  usable: number,
): string {
  if (col.kind === 'rap') return 'Rap';
  if (col.kind === 'beso') {
    if (day.display === 'compact') return 'Bes';
    const S = fontSizes.standard;
    return measureRuns([{ text: 'Beso', weight: 'bold' }], S) <= usable ? 'Beso' : 'Bes';
  }
  return column?.name ?? '';
}

export interface DayHeadSetup {
  readonly inputs: readonly ColumnHeadInput[];
  /** Kopfbereich des Tages (alle Spalten, Höhe der Spaltenköpfe). */
  readonly area: Rect;
}

/**
 * Köpfe und Kopfbereich eines Tages zwischen der Tageskopf-Unterlinie `yHead` und der Rasterbegrenzung oben
 * `yFrom`. Nutzbreite = Spaltenbreite − 2·textInsetPt − (linker + rechter Grenzstrich)/2.
 */
export function dayHeadSetup(
  lines: GridLineStyles,
  headBottom: Stroke,
  fontSizes: FontSizes,
  day: DayGeometry,
  columns: readonly Column[],
  yHead: number,
  yFrom: number,
): DayHeadSetup {
  const frameTop = yHead + headBottom.widthPt / 2 + INSET;
  const inputs: ColumnHeadInput[] = day.columns.map((col, j) => {
    const left = borderLeftOf(lines, day.columns, j).widthPt;
    const rightW = borderRightOf(lines, day.columns, j).widthPt;
    const usable = col.w - 2 * INSET - (left + rightW) / 2;
    const column = columns.find((c) => c.id === col.columnId);
    // Textfläche (S3-23 d): zwischen den Strichmitten der Grenzlinien, Tageskopf-Unterlinie und Rasterbegrenzung
    // oben, je um den halben Strich und textInsetPt verkleinert.
    const frame: Rect = {
      x: col.x + left / 2 + INSET,
      y: frameTop,
      w: usable,
      h: yFrom - lines.gridEdge.widthPt / 2 - INSET - frameTop,
    };
    // Senkrechte Köpfe: Grundlinienbeginn auf Rasterbegrenzung oben − textInsetPt (E2, S3-18); ihre Textfläche
    // reicht unten bis dorthin, ihre Länge ist um ½ Strich der Rasterbegrenzung grösser (Ausnahme zu S3-23 d).
    const frameV: Rect = { ...frame, h: yFrom - INSET - frameTop };
    const system = col.kind === 'rap' || col.kind === 'beso';
    return {
      columnId: col.columnId,
      runs: plainRuns(headText(fontSizes, day, col, column, usable), 'bold'),
      frame,
      frameV,
      prefer: !system && column?.labelOrientation === 'vertical' ? 'vertical' : 'horizontal',
      hyphenate: system ? 'never' : 'ifWordDoesNotFit',
    };
  });
  const dayLeft = day.x + lines.dayBorder.widthPt / 2 + INSET;
  const area: Rect = {
    x: dayLeft,
    y: frameTop,
    w: day.x + day.w - lines.dayBorder.widthPt / 2 - INSET - dayLeft,
    h: yFrom - INSET - frameTop,
  };
  return { inputs, area };
}
