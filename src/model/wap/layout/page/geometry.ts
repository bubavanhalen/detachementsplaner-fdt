// Seitengeometrie und Bereiche der Seite (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt B, C;
// R-10-06, Anhang B-Kp). Rein und deterministisch (R-L-02).

import { dayColumns, requireWeek } from '../../derive/columns';
import type { LevelTemplate } from '../../template';
import type { Id, Plan } from '../../types';
import { PageLayoutError } from './errors';
import { kpPageGeometry } from './geometryKp';
import { weekColumnHeaderHeight } from './headHeight';
import type { PageFrame, PageGeometry } from './types';

/** mm → pt. */
const MM = 72 / 25.4;

/**
 * 'kp' → kpPageGeometry().
 * @throws PageLayoutError 'unknownPageGeometry' bei jeder anderen id.
 */
export function pageGeometryFor(id: string): PageGeometry {
  if (id === 'kp') return kpPageGeometry();
  throw new PageLayoutError('unknownPageGeometry');
}

/**
 * C1: senkrechte Spaltenköpfe, sobald an einem sichtbaren Tag eine Planungs- oder Nebenspalte
 * `labelOrientation 'vertical'` hat; Rap- und Beso-Köpfe stehen immer waagrecht (V-02e-16).
 */
function hasVerticalHeads(plan: Plan, weekId: Id): boolean {
  const week = requireWeek(plan, weekId);
  return week.days.some(
    (d) =>
      d.display !== 'hidden' &&
      dayColumns(plan, weekId, d.weekday).some(
        (c) =>
          (c.kind === 'planning' || c.kind === 'secondary') && c.labelOrientation === 'vertical',
      ),
  );
}

/**
 * Rahmen, Seiteneinheit h und Bereiche nach Abschnitt C1 bis C3 und C5. Mit `template` wächst die Spaltenkopfzeile
 * bei Bedarf einheitlich für die Woche (F-LAYOUT2 Punkt 11, weekColumnHeaderHeight); Rasterrahmen und übrige Bereiche
 * bleiben, das Raster beginnt tiefer.
 * @throws ModelError 'unknownWeek', wenn weekId im Plan fehlt.
 */
export function pageFrame(
  geometry: PageGeometry,
  plan: Plan,
  weekId: Id,
  template?: LevelTemplate,
): PageFrame {
  const standard = standardFrame(geometry, plan, weekId);
  if (template === undefined) return standard;
  const height = weekColumnHeaderHeight(geometry, template, plan, weekId, standard);
  if (height === standard.grid.columnHeaderHeightPt) return standard;
  return { ...standard, grid: { ...standard.grid, columnHeaderHeightPt: height } };
}

/** Rahmen mit der Standardhöhe der Spaltenkopfzeile (C1). */
function standardFrame(geometry: PageGeometry, plan: Plan, weekId: Id): PageFrame {
  const vertical = hasVerticalHeads(plan, weekId);
  const { paper, marginsMm: m, heightsH: hh, widthShares } = geometry;
  const stroke = geometry.frameStroke.widthPt;
  // C1: Rahmen auf der Strichmitte.
  const fx = m.left * MM + stroke / 2;
  const fy = m.top * MM + stroke / 2;
  const WR = paper.widthPt - (m.left + m.right) * MM - stroke;
  const HR = paper.heightPt - (m.top + m.bottom) * MM - stroke;
  const c = vertical ? hh.columnHeaderVertical : hh.columnHeaderHorizontal;
  const h = HR / (hh.header + hh.dayHeader + c + hh.grid + hh.gap + hh.agenda);
  // C2: waagrecht.
  const a = widthShares.timeAxis * WR;
  const s = widthShares.sidebar * WR;
  const right = fx + WR;
  const xS = right - s;
  // C3: senkrecht.
  const yK = fy + hh.header * h;
  const yTo = yK + (hh.dayHeader + c + hh.grid) * h;
  const yT = yTo + hh.gap * h;
  const yU = fy + HR;
  return {
    frame: { x: fx, y: fy, w: WR, h: HR },
    h,
    verticalColumnHeads: vertical,
    header: { x: fx, y: fy, w: xS - fx, h: yK - fy },
    standCell: { x: xS, y: fy, w: right - xS, h: yK - fy },
    grid: {
      rect: { x: fx, y: yK, w: xS - fx, h: yTo - yK },
      timeAxisWidthPt: a,
      dayHeaderHeightPt: hh.dayHeader * h,
      columnHeaderHeightPt: c * h,
      lines: geometry.lines,
    },
    sidebarUpper: { x: xS, y: yK, w: right - xS, h: yTo - yK },
    agenda: { x: fx, y: yT, w: xS - a - fx, h: yU - yT },
    sidebarLower: { x: xS - a, y: yTo, w: right - (xS - a), h: yU - yTo },
  };
}
