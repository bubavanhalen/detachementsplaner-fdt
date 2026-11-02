// @vitest-environment jsdom
// I4 (E1-08): Kopf und Seitenleiste der Kp-Mappe (Beschrieb 4.1, 4.2, 4.8, 8.2 Regel 8, 10; Prompt §9). Jede Form
// ist gezählt: Rahmen, Symbole und Sonnenzeiten zugeordnet, Unbekanntes einzeln im Bericht. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { emptyWeek, geometryOf, normal, rawShape, yOf } from '../../fixtures/import/kp-workbook';
import { importWeeks } from './support';

const week = emptyWeek({
  goals: ['Ausbildung abschliessen', 'Material fassen'],
  remarks: ['Eins', 'Zwei'],
});
const g = geometryOf(week);
const sx0 = g.colX(g.sideCol);
const sx1 = g.colX(g.sideCol + 3);
const y = yOf(1500);
const side = [
  rawShape(sx0, y, sx0 + 200_000, y + 150_000, { geometry: 'sun', fill: 'FFC000' }),
  rawShape(sx0 + 220_000, y, sx0 + 600_000, y + 150_000, {
    fill: null,
    paragraphs: [[normal('0715')]],
  }),
  rawShape(sx0, y + 200_000, sx0 + 200_000, y + 350_000, { geometry: 'moon', fill: 'FFC000' }),
  rawShape(sx0 + 220_000, y + 200_000, sx0 + 600_000, y + 350_000, {
    fill: null,
    paragraphs: [[normal('1845')]],
  }),
  rawShape(sx0, y + 400_000, sx1, y + 500_000, { fill: null }),
  rawShape(sx0, yOf(1420), sx1, yOf(1440), {
    fill: null,
    paragraphs: [[normal('FIKTIV & STARK')]],
  }),
  rawShape(sx0, yOf(1300), sx1, yOf(1360), {
    fill: null,
    paragraphs: [[normal('Inf Fik Kp 99/9')], [normal('Hptm Muster')], [normal('Kp Kdt')]],
  }),
];

describe('Kopf und Seitenleiste', () => {
  it('[R-8.2-01] Titel, Beilage, Einheit, Dienst und Stand aus dem Kopf; Woche mit Kurzname', () => {
    const { result } = importWeeks([week]);
    const plan = result.plan;
    expect(plan.unit).toBe('Inf Fik Kp 99/9');
    expect(plan.beilage).toBe('Beilage 01-02 zum Allgemeinen Befehl für den FDT 2099');
    expect(plan.service).toBe('FDT 2099');
    expect(plan.weeks.map((w) => [w.shortName, w.label, w.startDate])).toEqual([
      ['Wo1', 'Woche 1', '2099-10-05'],
    ]);
    expect(plan.weeks[0]?.days.map((d) => d.display)).toEqual([
      'full',
      'full',
      'full',
      'full',
      'full',
      'compact',
      'compact',
    ]);
    expect(plan.abbreviationMeanings).toEqual({ KR: 'Kp Rapport fiktiv' });
  });

  it('[R-8.2-20] Wochenziele, Bemerkungen, Sonnenzeiten und Motto übernommen; übrige Felder einzeln im Bericht', () => {
    const o = importWeeks([{ ...week, rawShapes: side }]);
    const plan = o.result.plan;
    const w = plan.weeks[0];
    expect(w?.weekGoals.map((x) => x.text)).toEqual(['Ausbildung abschliessen', 'Material fassen']);
    expect(w?.sunOverride).toEqual({ sunrise: 435, sunset: 1125 });
    expect(plan.motto).toBe('FIKTIV & STARK');
    const remarks = Object.values(plan.entries).filter((e) => e.type === 'multiDayRemark');
    expect(remarks.map((r) => (r.type === 'multiDayRemark' ? r.text : ''))).toEqual([
      'Eins',
      'Zwei',
    ]);
    const sheet = o.report.sheets[0];
    expect(sheet?.shapesRead).toBe((sheet?.assigned ?? 0) + (sheet?.unassigned ?? 0));
    // Nur der Unterschriftblock bleibt nicht zugeordnet (Rahmen und Symbole sind zugeordnet).
    const unassigned = o.report.items.filter((i) => i.kind === 'unassignedShape');
    expect(unassigned).toHaveLength(1);
    expect(unassigned[0]?.message.nextStep).toMatch(/Plan-Einstellungen/);
  });
});
