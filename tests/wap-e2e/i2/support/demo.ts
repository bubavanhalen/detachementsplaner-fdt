// Only the separate demo entry imports these pseudonymised/fictitious fixtures.

import { addDays } from '../../../../src/model/wap/calendar';
import { createEntry } from '../../../../src/model/wap/commands/entries';
import { allocateIds } from '../../../../src/model/wap/factories';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Plan, Week } from '../../../../src/model/wap/types';
import { loadKvkPlan } from '../../../wap/support/model/kvk-fixture';
import { syntheticPlan } from '../../../wap/support/synthetic-plan';

export function createI2DemoPlans(): readonly Plan[] {
  let plan: Plan = {
    ...loadKvkPlan(),
    id: 'i2-demo-realistisch',
    exerciseName: 'KVK und FDT – Beispiel',
  };
  const base = plan.weeks[0];
  const columns = plan.columnSets[0];
  if (!base || !columns) throw new Error('Demoplan ist unvollständig');
  const allocated = allocateIds(plan, 'w', 1);
  const weeks: Week[] = allocated.ids.map((id, index) => ({
    ...base,
    id,
    label: `FDT Woche ${index + 1}`,
    shortName: `Wo${index + 1}`,
    startDate: addDays(base.startDate, (index + 1) * 7),
    days: base.days.map((day) => ({
      ...day,
      columnSetId: columns.id,
      display: 'full',
      internalNote: '',
    })) as unknown as Week['days'],
    weekGoals: [],
    hiddenRemarkIds: [],
    heightenedReadiness: '',
  }));
  plan = { ...plan, weeks: [base, ...weeks], nextId: allocated.nextId };
  const context = { templates: builtInTemplates() };
  const titles = [
    'Ausbildung im Zug',
    'Fachdienst und Einsatzvorbereitung',
    'Übung im Verband',
    'WPD und Tagesabschluss',
  ];
  const ranges = [
    [420, 600],
    [630, 720],
    [810, 930],
    [960, 1020],
  ] as const;
  for (const week of weeks)
    for (let day = 0; day < 5; day++) {
      for (let slot = 0; slot < ranges.length; slot++) {
        const time = ranges[slot];
        if (!time) continue;
        plan = createEntry(
          plan,
          {
            type: 'block',
            date: addDays(week.startDate, day),
            time: { form: 'range', from: time[0], to: time[1] },
            columns: { kind: 'all' },
            title: [{ text: titles[(slot + day) % titles.length] ?? 'Ausbildung', bold: false }],
            ltg: 'Zfhr',
            ort: day === 2 ? 'Übungsplatz' : 'Ausbildungsraum',
          },
          context,
        ).plan;
      }
    }
  return [
    plan,
    { ...syntheticPlan(), id: 'i2-demo-belastung', exerciseName: 'Belastungstest – fiktive Daten' },
  ];
}
