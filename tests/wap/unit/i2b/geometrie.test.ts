// @vitest-environment node
// I2b-A A3–A5: Zeitschild, Autoscroll-Geschwindigkeit, Tagesbreiten und Einpassen.
import { describe, expect, it } from 'vitest';
import {
  autoscrollSpeed,
  dayBoxes,
  fitScale,
  nextZoom,
  timeLabel,
  zoomLabel,
} from '../../../../src/components/wap/i2/geometry';
import { col } from '../../support/model/builders';

describe('I2b Geometrie', () => {
  it('[R-5.1-15] Zeitschild am Zeiger mit Tag, Zeit und Spalten', () => {
    expect(timeLabel('Mo', '2026-10-05', 540, 600, ['COBRA 10'])).toBe(
      'Mo 05.10. · 0900-1000 · COBRA 10',
    );
    expect(timeLabel('Di', '2026-10-06', 480, 720, ['COBRA 10', 'FALCON', 'HAWK'])).toBe(
      'Di 06.10. · 0800-1200 · COBRA 10–HAWK',
    );
    expect(timeLabel('Mi', '2026-10-07', 1320, null, [])).toBe('Mi 07.10. · 2200');
  });

  it('[R-5.1-16] Autoscroll: stetig am Rand, schneller je näher, nichts ausserhalb von 40 px', () => {
    expect(autoscrollSpeed(40)).toBe(0);
    expect(autoscrollSpeed(100)).toBe(0);
    expect(autoscrollSpeed(39)).toBeGreaterThanOrEqual(1);
    expect(autoscrollSpeed(20)).toBeLessThan(autoscrollSpeed(5));
    expect(autoscrollSpeed(0)).toBe(22);
    expect(autoscrollSpeed(-30)).toBe(22);
  });

  it('[R-4.4-10][R-4.4-11][R-4.4-12] volle Tage gleich breit, kompakt ein Drittel, ausgeblendete fehlen', () => {
    const columns = [col('a', 'A', 'planning'), col('r', 'Rap', 'rap'), col('s', 'Beso', 'beso')];
    const days = dayBoxes(
      [
        { date: '2026-10-05', weekday: 'Mo', display: 'full', setId: 's', columns },
        {
          date: '2026-10-06',
          weekday: 'Di',
          display: 'full',
          setId: 's',
          columns: [...columns, col('b', 'B', 'planning')],
        },
        { date: '2026-10-10', weekday: 'Sa', display: 'compact', setId: 's', columns },
        { date: '2026-10-11', weekday: 'So', display: 'hidden', setId: 's', columns },
      ],
      { day: 360, minute: 0.8 },
    );
    expect(days.map((d) => [d.weekday, d.left, d.width])).toEqual([
      ['Mo', 0, 360],
      ['Di', 360, 360],
      ['Sa', 720, 120],
    ]);
  });

  it('[R-4.4-11] Einpassen: ganze Woche und ganzer Anzeigebereich; Zoomstufen', () => {
    const fit = fitScale(
      { width: 1260, height: 600 },
      ['full', 'full', 'full', 'full', 'full', 'compact', 'compact'],
      1200,
    );
    expect(fit.day * (5 + 2 / 3)).toBeLessThanOrEqual(1260);
    expect(fit.minute * 1200).toBeLessThanOrEqual(600);
    expect(nextZoom({ kind: 'level', value: 1 }, fit, 1)).toEqual({ kind: 'level', value: 1.25 });
    expect(nextZoom({ kind: 'level', value: 1 }, fit, -1)).toEqual({ kind: 'level', value: 0.75 });
    expect(zoomLabel({ kind: 'level', value: 1.5 }, fit)).toBe('150 %');
  });
});
