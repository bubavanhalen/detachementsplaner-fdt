// Seitengeometrie der Kp-Vorlage (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt B, C, §4).
// Einzige Quelle der Werte ist docs/wap-planer/anhaenge/anhang-b-kp.csv; nur Masse und Farben, keine
// Referenztexte. Die Lagewerte der Zeilen (B-Kp-17 bis -28, -44, -73 bis -91) stehen als interne Konstanten
// in geometryKpLage.ts, damit sie nicht über page/index.ts zur Schnittstelle werden (Abschnitt B).

import type { Rgb } from '../../types';
import type { Stroke } from '../pageModel';
import type { PageGeometry } from './types';

const SCHWARZ: Rgb = { r: 0, g: 0, b: 0 };

function strich(widthPt: number, dash: readonly number[] | null = null): Stroke {
  return { color: SCHWARZ, widthPt, dash };
}

/** Friert ein Objekt samt allen verschachtelten Objekten und Arrays ein. */
function tiefGefroren<T>(o: T): T {
  if (o !== null && typeof o === 'object' && !Object.isFrozen(o)) {
    for (const v of Object.values(o)) tiefGefroren(v);
    Object.freeze(o);
  }
  return o;
}

/** B-Kp-48: Rasterbegrenzung; nach V-02e-15 auch Seitenleisten- und Tageskopflinie. */
const RASTERKANTE = strich(0.48);

const KP: PageGeometry = tiefGefroren<PageGeometry>({
  id: 'kp',
  // B-Kp-01
  paper: { widthPt: 841.89, heightPt: 595.28 },
  // B-Kp-04 (links, rechts), B-Kp-05 (oben, unten)
  marginsMm: { top: 7.5, right: 7.0, bottom: 7.5, left: 7.0 },
  // B-Kp-02
  frameStroke: strich(0.48),
  heightsH: {
    header: 1.28, // B-Kp-08
    dayHeader: 0.64, // B-Kp-09
    columnHeaderHorizontal: 0.74, // B-Kp-10
    columnHeaderVertical: 1.83, // B-Kp-10
    grid: 20.0, // B-Kp-12
    gap: 0.25, // B-Kp-13
    agenda: 7.87, // B-Kp-14
    agendaHead: 0.47, // B-Kp-87
  },
  // B-Kp-15, B-Kp-16
  widthShares: { timeAxis: 1.93 / 100, sidebar: 14.8 / 100 },
  lines: {
    hour: strich(0.48, [1.56, 0.48]), // B-Kp-45
    halfHour: strich(0.12), // B-Kp-46
    gridEdge: RASTERKANTE, // B-Kp-48
    dayBorder: strich(0.48), // B-Kp-38
    columnBorder: strich(0.12), // B-Kp-39
    rapSeparator: strich(0.48, [1.56, 0.48]), // B-Kp-40
    laneBorder: strich(0.12), // B-Kp-41
    blockBorder: strich(0.48), // B-Kp-50
    rapportBorder: strich(0.48), // B-Kp-58 (Gate S A3, gleich blockBorder)
    besoBoxBorder: strich(0.375), // B-Kp-61
    querbalkenBorder: strich(0.375), // B-Kp-70
    markerLine: strich(1.56), // B-Kp-65
    markerFieldBorder: strich(0.48), // B-Kp-67
  },
  pageLines: {
    headerBottom: strich(0.48), // B-Kp-27
    titleFrame: strich(0.72), // B-Kp-19
    classificationFrame: strich(0.72), // B-Kp-24
    sidebarEdge: RASTERKANTE, // V-02e-15
    dayHeadBottom: RASTERKANTE, // V-02e-15
    agendaTop: strich(0.48), // B-Kp-13
    agendaHeadBottom: strich(0.48), // B-Kp-87
    table: strich(0.48), // B-Kp-78
    readinessFrame: strich(0.48), // B-Kp-75
    sunTable: strich(0.375), // B-Kp-84
    remarkRule: strich(0.12), // B-Kp-116
  },
  colors: {
    text: SCHWARZ, // B-Kp-99
    readinessGrey: { r: 191, g: 191, b: 191 }, // B-Kp-98
    statusRed: { r: 192, g: 0, b: 0 }, // Gate 0 Q-009 (#c00000); B-Kp-100 an E1-10
  },
  // B-Kp-108
  fontSizes: {
    title: 7.4,
    beilage: 5.9,
    weekLine: 5.3,
    signature: 6.4,
    motto: 5.3,
    sunTime: 5.9,
    readiness: 5.8,
  },
});

/** Werte aus der CSV; jedes Mal dasselbe eingefrorene Objekt. Wirft nie. */
export function kpPageGeometry(): PageGeometry {
  return KP;
}
