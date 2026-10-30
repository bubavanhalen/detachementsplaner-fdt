// @vitest-environment jsdom
// H-DATEN (Härtung vor Gate B): importierte Beso-Nummern gelten als fixiert, auch ohne Stand-Datum in der Datei
// (CR-H-D-03). Beschrieb 8.2 Regel 10; R-8.2-23. Fiktive Arbeitsmappen.
import { describe, expect, it } from 'vitest';
import { moveEntries } from '../../../../src/model/wap/commands/entries';
import { besoBox, emptyWeek, normal, type WeekDef } from '../../fixtures/import/kp-workbook';
import { besos, ctx, importWeeks, kinds } from '../import/support';

const week = (stand: string | null): WeekDef => {
  const { stand: _vorgabe, ...base } = emptyWeek({
    shapes: [besoBox(0, 4, '0900', 12), besoBox(0, 4, '1400', 11)],
    agenda: [
      {
        day: 0,
        paragraphs: [[normal('12 0900: Fiktiv eins.')], [normal('11 1400: Fiktiv zwei.')]],
      },
    ],
  });
  return stand === null ? base : { ...base, stand };
};

describe('CR-H-D-03: Nummern ohne Stand-Datum', () => {
  it('[R-8.2-23] ohne Stand-Datum: Nummern fixiert, Bericht «Kopfangabe fehlt»', () => {
    const o = importWeeks([week(null)]);
    expect(o.result.plan.stand).toBeNull();
    expect(kinds(o)).toContain('missingHeader');
    expect(besos(o.result.plan).map((b) => [b.besoNumber, b.numberFixed])).toEqual([
      [11, true],
      [12, true],
    ]);
  });

  it('[R-8.2-23] ohne Stand-Datum: die nächste Änderung nummeriert die importierten Beso nicht neu', () => {
    const plan = importWeeks([week(null)]).result.plan;
    const before = besos(plan).map((b) => b.besoNumber);
    const [first] = besos(plan);
    const moved = moveEntries(plan, [first?.id ?? ''], { deltaMinutes: 15 }, ctx).plan;
    expect(besos(moved).map((b) => b.besoNumber)).toEqual(before);
  });

  it('[R-8.2-23] mit Stand-Datum: erster Stand gesetzt, Nummern bleiben', () => {
    const plan = importWeeks([week('2099-09-17')]).result.plan;
    expect(plan.stand?.date).toBe('2099-09-17');
    const [first] = besos(plan);
    const moved = moveEntries(plan, [first?.id ?? ''], { deltaMinutes: 15 }, ctx).plan;
    expect(besos(moved).map((b) => b.besoNumber)).toEqual([11, 12]);
  });
});
