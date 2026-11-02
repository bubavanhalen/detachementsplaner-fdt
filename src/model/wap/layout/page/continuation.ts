// Linien und Tagesköpfe der Fortsetzungsseite (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt C4, D;
// R-10-42, V-02e-2). Kein Raster, keine Rasterbegrenzung, keine Termine-Oberlinie. Intern: nicht über
// page/index.ts exportiert. Rein (R-L-02).

import type { GridLayout } from '../grid';
import { dayArea, dayEdges, dayHeads } from './chromeParts';
import { lineItem, RegionBuilder } from './common';
import type { PageContext, RegionLayout } from './types';

/**
 * Tageskopf-Unterlinie (X0 bis X0 + W), Seitenleistenlinie auf xS von yK bis yU (Vertrag E1-02k §2.3), Tagesgrenzen
 * von yK bis yU (zwischen zusammengefasstem Sa und So nur in der Tageskopfzeile), «Was»-Linie; danach die Tagesköpfe.
 */
export function continuationChrome(ctx: PageContext, grid: GridLayout): RegionLayout {
  const { geometry: g, frame: pf } = ctx;
  const b = new RegionBuilder();
  const { X0, W } = dayArea(ctx);
  const yK = pf.grid.rect.y;
  const yHead = yK + pf.grid.dayHeaderHeightPt;
  const yWas = yK + (g.heightsH.dayHeader + g.heightsH.agendaHead) * pf.h;
  const yU = pf.frame.y + pf.frame.h;
  const xS = pf.standCell.x;
  b.shape(lineItem('gridLine', X0, yHead, X0 + W, yHead, g.pageLines.dayHeadBottom));
  b.shape(lineItem('gridLine', xS, yK, xS, yU, g.pageLines.sidebarEdge)); // ab der Kopf-Unterlinie (B-Kp-119)
  for (const e of dayEdges(ctx, grid)) {
    b.shape(lineItem('gridLine', e.x, yK, e.x, e.weekendInner ? yHead : yU, g.lines.dayBorder));
  }
  b.shape(lineItem('gridLine', X0, yWas, X0 + W, yWas, g.pageLines.agendaHeadBottom));
  dayHeads(ctx, grid, b, false);
  return b.build();
}
