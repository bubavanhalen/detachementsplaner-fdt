// @vitest-environment jsdom
// F-IMPORT2 (Entscheid 9 des Auftraggebers vom 19.10.2026): Der Import übernimmt aus den Wochenzielen nur den im
// Excel sichtbaren Text. Zeilen eines Textfelds ohne Breite (z.B. ausserhalb des Zellbereichs), unterhalb des
// Textfelds (abgeschnitten) oder unter einer später gezeichneten gefüllten Form kommen nicht in die Woche, sondern
// in den Importbericht «nicht sichtbar, nicht übernommen» mit Anzahl Zeichen (Beschrieb 4.2, 8.2 Regel 8;
// R-4.2-04, R-8.2-20). Fiktive Arbeitsmappe.
import { describe, expect, it } from 'vitest';
import {
  emptyWeek,
  GRID_ROW_EMU,
  geometryOf,
  HEADER_ROW_EMU,
  HEADER_ROWS,
  normal,
  rawShape,
} from '../../fixtures/import/kp-workbook';
import { importWeeks } from '../import/support';

const base = emptyWeek();
const g = geometryOf(base);
const sx0 = g.colX(g.sideCol);
const sx1 = g.colX(g.sideCol + 3);
/** Obere Kante der Blattzeile `r` (0-basiert; ab Zeile 6 Rasterzeilen). */
const rowY = (r: number): number =>
  r <= HEADER_ROWS
    ? r * HEADER_ROW_EMU
    : HEADER_ROWS * HEADER_ROW_EMU + (r - HEADER_ROWS) * GRID_ROW_EMU;
/** Zeilenhöhe einer Textzeile in 8 pt (Schriftgrösse des Baukastens) in EMU. */
const LINE = 8 * 1.2 * 12700;
const Y0 = rowY(7);

const bullets = (texts: readonly string[]) => texts.map((t) => [normal(`- ${t}`)]);
const goalsBox = (x0: number, y0: number, x1: number, y1: number, texts: readonly string[]) =>
  rawShape(x0, y0, x1, y1, { fill: null, paragraphs: bullets(texts) });

function imported(rawShapes: readonly string[]) {
  const o = importWeeks([{ ...base, rawShapes }]);
  const week = o.result.plan.weeks[0];
  return {
    o,
    goals: week?.weekGoals.map((x) => x.text) ?? [],
    notVisible: o.report.items.filter((i) => i.kind === 'notVisible'),
  };
}

describe('Wochenziele: nur der sichtbare Text', () => {
  it('[R-4.2-04] alles sichtbar: alle Wochenziele übernommen, kein Bericht «nicht sichtbar»', () => {
    const { goals, notVisible } = imported([
      goalsBox(sx0, Y0, sx1, Y0 + 6 * LINE, ['Ausbildung abschliessen', 'Material fassen']),
    ]);
    expect(goals).toEqual(['Ausbildung abschliessen', 'Material fassen']);
    expect(notVisible).toEqual([]);
  });

  it('[R-4.2-04] Textfeld ohne Breite ausserhalb des Zellbereichs: nichts übernommen, Bericht mit Anzahl Zeilen und Zeichen', () => {
    const hidden = ['Zusatzziel eins', 'Zusatzziel zwei mit mehr Text', 'Drei'];
    const { o, goals, notVisible } = imported([
      goalsBox(sx0, Y0, sx1, Y0 + 6 * LINE, ['Ausbildung abschliessen']),
      goalsBox(sx1, Y0, sx1 + 919, rowY(24), hidden),
    ]);
    expect(goals).toEqual(['Ausbildung abschliessen']);
    expect(notVisible).toHaveLength(1);
    const chars = hidden.reduce((n, t) => n + t.length, 0);
    expect(notVisible[0]?.message.cause).toContain('3 Zeilen');
    expect(notVisible[0]?.message.cause).toContain(`${String(chars)} Zeichen`);
    expect(notVisible[0]?.message.cause).toContain('nicht sichtbar, nicht übernommen');
    expect(notVisible[0]?.message.nextStep).not.toBe('');
    expect(notVisible[0]?.target.shapeIndex).not.toBeNull();
    expect(notVisible[0]?.target.entryId).toBeNull();
    expect(notVisible[0]?.weekId).toBe(o.result.plan.weeks[0]?.id);
  });

  it('[R-4.2-04] Textfeld zu niedrig: nur die Zeilen innerhalb des Textfelds übernommen, der Rest im Bericht', () => {
    const { goals, notVisible } = imported([
      goalsBox(sx0, Y0, sx1, Y0 + 2.3 * LINE, ['Ziel A', 'Ziel B', 'Ziel C', 'Ziel D']),
    ]);
    expect(goals).toEqual(['Ziel A', 'Ziel B']);
    expect(notVisible).toHaveLength(1);
    expect(notVisible[0]?.message.cause).toContain('2 Zeilen');
    expect(notVisible[0]?.message.cause).toContain('12 Zeichen');
  });

  it('[R-4.2-04] von einer später gezeichneten gefüllten Form über die ganze Breite verdeckt: verdeckte Zeilen nicht übernommen', () => {
    const { goals, notVisible } = imported([
      goalsBox(sx0, Y0, sx1, Y0 + 8 * LINE, ['Ziel A', 'Ziel B', 'Ziel C', 'Ziel D']),
      rawShape(sx0, Y0 + 2 * LINE, sx1, Y0 + 8 * LINE, { fill: 'D9D9D9' }),
    ]);
    expect(goals).toEqual(['Ziel A', 'Ziel B']);
    expect(notVisible).toHaveLength(1);
    expect(notVisible[0]?.message.cause).toContain('2 Zeilen');
  });

  it('[R-4.2-04] ein langes Ziel mit Umbruch belegt mehrere Zeilen; was danach unter dem Rand liegt, fehlt', () => {
    const long = 'Sehr langes Wochenziel '.repeat(6).trim();
    const { goals, notVisible } = imported([
      goalsBox(sx0, Y0, sx1, Y0 + 3.3 * LINE, [long, 'Kurz']),
    ]);
    expect(goals).toEqual([long]);
    expect(notVisible[0]?.message.cause).toContain('1 Zeile mit 4 Zeichen');
  });

  it('[R-8.2-20] eine Form mit nicht sichtbaren Wochenzielen bleibt zugeordnet: gelesen = zugeordnet + nicht zugeordnet', () => {
    const { o } = imported([
      goalsBox(sx0, Y0, sx1, Y0 + 6 * LINE, ['Ausbildung abschliessen']),
      goalsBox(sx1, Y0, sx1 + 919, rowY(24), ['Unsichtbar']),
    ]);
    const s = o.report.sheets[0];
    expect(s?.shapesRead).toBe((s?.assigned ?? 0) + (s?.unassigned ?? 0));
    const unassigned = o.report.items.filter((i) => i.kind === 'unassignedShape').length;
    const before = importWeeks([
      { ...base, rawShapes: [goalsBox(sx0, Y0, sx1, Y0 + 6 * LINE, ['Ausbildung abschliessen'])] },
    ]).report.items.filter((i) => i.kind === 'unassignedShape').length;
    expect(unassigned).toBe(before);
  });
});
