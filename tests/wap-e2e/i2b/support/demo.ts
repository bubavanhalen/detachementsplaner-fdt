// I2b-A: Demoplan wie I2 (pseudonymisierte KVK-Daten, fiktive FDT-Wochen), ergänzt um fiktive Einträge aller
// verschiebbaren Typen und eine Kette angrenzender Blöcke in einer Spalte (A6, A7).

import { addDays } from '../../../../src/model/wap/calendar';
import { createEntry, type EntryDraft } from '../../../../src/model/wap/commands/entries';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { createI2DemoPlans } from '../../i2/support/demo';

const context = { templates: builtInTemplates() };

function enrich(source: Plan): Plan {
  let plan = source;
  const week = plan.weeks[1];
  const columns = plan.columnSets[0]?.columns.filter((c) => c.kind === 'planning') ?? [];
  const second = columns[1];
  if (week === undefined || second === undefined) return plan;
  const mo = week.startDate;
  const di = addDays(mo, 1);
  const one = { kind: 'ids', ids: [second.id] } as const;
  const drafts: EntryDraft[] = [
    {
      type: 'querbalken',
      fromDate: mo,
      toDate: addDays(mo, 2),
      title: [{ text: 'Schiessausbildung Gruppe', bold: true }],
    },
    {
      type: 'block',
      date: di,
      time: { form: 'range', from: 1110, to: 1170 },
      columns: one,
      title: [{ text: 'Zugschule', bold: true }],
    },
    {
      type: 'block',
      date: di,
      time: { form: 'range', from: 1170, to: 1230 },
      columns: one,
      title: [{ text: 'Waffendrill', bold: true }],
    },
    {
      type: 'block',
      date: di,
      time: { form: 'range', from: 1230, to: 1290 },
      columns: one,
      title: [{ text: 'Parkdienst', bold: true }],
    },
    {
      type: 'rapport',
      date: mo,
      code: 'KR',
      time: { form: 'range', from: 1080, to: 1110 },
      ort: 'Kdo Raum',
    },
    { type: 'marker', date: mo, at: 1320, kind: 'AV', columns: { kind: 'all' } },
    {
      type: 'beso',
      date: mo,
      title: [{ text: 'Materialfassung', bold: false }],
      windows: [{ time: { form: 'range', from: 1050, to: 1080 } }],
    },
  ];
  for (const draft of drafts) plan = createEntry(plan, draft, context).plan;
  return plan;
}

export function createI2bDemoPlans(): readonly Plan[] {
  const [realistic, stress] = createI2DemoPlans();
  if (realistic === undefined || stress === undefined) return createI2DemoPlans();
  return [
    { ...enrich(realistic), id: 'i2b-demo-realistisch' },
    { ...stress, id: 'i2b-demo-belastung' },
  ];
}
