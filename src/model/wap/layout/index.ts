// Einstieg der Layout-Schicht (Vertrag E1-02e, Notiz «Ausarbeitung Schritt 2» Abschnitt B, V20;
// ADR-004, Leitplanke 2). E1-02f importiert PageOptions und layoutWeekPage von hier.

export * from './grid';
export * from './page';
export * from './pageModel';
export type { BreakOptions, BreakResult, BrokenLine } from './text/break';
export { breakText } from './text/break';
export { isRenderable, measureRuns, missingGlyphs } from './text/measure';
export type { FontMetrics } from './text/metrics';
export { ascentPt, fontMetrics, lineHeightPt } from './text/metrics';
export type { FontWeight, StyledRun } from './text/types';
export { FONT_FAMILY_SCREEN } from './text/types';
