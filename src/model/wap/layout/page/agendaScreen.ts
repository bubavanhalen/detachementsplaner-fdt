// Terminbereich am Bildschirm aus der Layout-Schicht (Befund CR-H-U-04; ADR-004 Punkt 4, Leitplanke 2; Beschrieb 10):
// dieselben Einheiten, Umbrüche (hängender Einzug, R-4.8-07) und Verkleinerung in 0,25-pt-Schritten bis zur
// Mindestgrösse wie die Termine der PDF-Wochenseite (agendaFlow). Rein (R-L-02).

import type { LevelTemplate } from '../../template';
import type { Id, IsoDate, Plan } from '../../types';
import { styleAgendaRuns } from '../entries/status';
import type { TextItem } from '../pageModel';
import { agendaTextArea, agendaUnits, height, type LaidUnit, layUnit } from './agendaParts';
import { ascentPt, FIT_EPS, lineHeightPt, sizeSteps, textItem } from './common';
import { pageFrame, pageGeometryFor } from './geometry';
import { pageLage } from './geometryKpLage';

/** Eine Terminzeile (Einheit) mit ihren vorberechneten Zeilen; y relativ zur Oberkante des Terminbereichs. */
export interface AgendaScreenUnit {
  readonly entryId: Id;
  readonly date: IsoDate;
  /** Oberkante und Höhe der Einheit in pt. */
  readonly top: number;
  readonly height: number;
  readonly lines: readonly TextItem[];
}

export interface AgendaScreenLayout {
  /** Schriftgrösse aller Zeilen der Spalte (wie im PDF eine Grösse je Spalte). */
  readonly sizePt: number;
  /** Verfügbare Höhe in pt (Textfläche der Termine auf der Wochenseite). */
  readonly availPt: number;
  /** Benötigte Höhe aller Zeilen in pt. */
  readonly heightPt: number;
  /** Auch in Mindestgrösse passen nicht alle Zeilen (im PDF: Fortsetzungsseite; am Bildschirm rollt der Bereich). */
  readonly overflow: boolean;
  readonly units: readonly AgendaScreenUnit[];
}

/** Höhe der Textfläche der Termine auf der Wochenseite in pt (wie agendaFlow, Seite 1). */
export function agendaAvailPt(plan: Plan, weekId: Id, template: LevelTemplate): number {
  const geometry = pageGeometryFor(template.pageGeometryId);
  const area = agendaTextArea(geometry, pageFrame(geometry, plan, weekId), 0);
  return Math.max(0, area.bottom - area.top);
}

/**
 * Termine einer Terminspalte (`dates`, Breite `columnWidthPt` wie eine Terminspalte der Wochenseite) mit den Regeln
 * der Wochenseite: Einheiten je Tag und Eintrag, Umbruch mit hängendem Einzug, gemeinsame Grösse der Spalte von
 * Standard bis Mindestgrösse. Passt auch die Mindestgrösse nicht, stehen alle Einheiten in Mindestgrösse da
 * (`overflow`; im PDF folgt der Rest auf der Fortsetzungsseite). Status-Darstellung nach `showStatus`.
 * Koordinaten: x ab der linken Kante der Spalte, y ab der Oberkante der Textfläche.
 */
export function layoutAgendaScreen(input: {
  readonly plan: Plan;
  readonly dates: readonly IsoDate[];
  readonly columnWidthPt: number;
  readonly availPt: number;
  readonly template: LevelTemplate;
  readonly showStatus: boolean;
}): AgendaScreenLayout {
  const { plan, dates, columnWidthPt, availPt, template, showStatus } = input;
  const geometry = pageGeometryFor(template.pageGeometryId);
  const lage = pageLage(geometry);
  const standard = template.fontSizes.standard;
  const min = template.fontSizes.min;
  const w = columnWidthPt - 2 * lage.agendaX;
  const units = agendaUnits(plan, dates);
  if (w <= 0 || units.length === 0)
    return { sizePt: standard, availPt, heightPt: 0, overflow: false, units: [] };
  let sizePt = min;
  let laid: readonly LaidUnit[] | null = null;
  for (const size of sizeSteps(standard, min)) {
    const candidate = units.map((u) => layUnit(u, w, size));
    if (height(candidate, size) <= availPt + FIT_EPS) {
      laid = candidate;
      sizePt = size;
      break;
    }
  }
  const overflow = laid === null;
  const placed = laid ?? units.map((u) => layUnit(u, w, min));
  const lh = lineHeightPt(sizePt);
  const frame = { x: lage.agendaX, y: 0, w, h: availPt };
  let y = 0;
  const out: AgendaScreenUnit[] = placed.map((lu) => {
    const top = y;
    const lines = lu.lines.map((runs, i) => {
      const item = textItem({
        role: 'agenda',
        entryId: lu.unit.entryId,
        x: frame.x + (i === 0 ? 0 : lu.indent),
        baselineY: y + i * lh + ascentPt(sizePt),
        sizePt,
        runs,
        color: geometry.colors.text,
        frame,
      });
      return {
        ...item,
        runs: styleAgendaRuns(item.runs, plan.entries[lu.unit.entryId], showStatus),
      };
    });
    y += lu.lines.length * lh;
    return { entryId: lu.unit.entryId, date: lu.unit.date, top, height: y - top, lines };
  });
  return { sizePt, availPt, heightPt: y, overflow, units: out };
}
