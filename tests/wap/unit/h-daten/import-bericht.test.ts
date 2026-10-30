// @vitest-environment jsdom
// H-DATEN (Härtung vor Gate B): ein verworfener Entwurf mit mehreren Formen meldet jede Form einzeln
// (CR-H-D-07). Beschrieb 8.2 Regel 8; R-8.2-20. Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import { besoBox, emptyWeek, normal } from '../../fixtures/import/kp-workbook';
import { besos, importWeeks } from '../import/support';

describe('CR-H-D-07: verworfener Entwurf mit mehreren Formen', () => {
  it('[R-8.2-20] Beso mit zwei Kästchen und Frist ausserhalb des Plans: beide Kästchen nicht zugeordnet, Bilanz stimmt', () => {
    const o = importWeeks([
      emptyWeek({
        shapes: [besoBox(0, 4, '0900', 12), besoBox(0, 4, '1500', 12)],
        agenda: [{ day: 0, paragraphs: [[normal('12 bis 15.12.2099: Fiktive Frist.')]] }],
      }),
    ]);
    expect(besos(o.result.plan)).toHaveLength(0);
    const unassigned = o.report.items.filter((i) => i.kind === 'unassignedShape');
    const shapeIndexes = new Set(unassigned.map((i) => i.target.shapeIndex));
    const [sheet] = o.report.sheets;
    expect(shapeIndexes.size).toBe(2);
    expect(shapeIndexes.has(null)).toBe(false);
    expect(sheet?.unassigned).toBe(2);
    expect(sheet?.shapesRead).toBe((sheet?.assigned ?? 0) + (sheet?.unassigned ?? 0));
  });
});
