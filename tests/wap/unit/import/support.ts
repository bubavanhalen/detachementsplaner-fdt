// Gemeinsame Hilfen der Import-Tests (I4): fiktive Arbeitsmappe lesen und in einen frischen Kp-Plan importieren.
import { type ImportOutcome, importKpWorkbook } from '../../../../src/io/wap-import/index';
import { readWorkbook } from '../../../../src/io/xlsx-drawing/index';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { listRows } from '../../../../src/model/wap/list/index';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import type { Beso, Block, Entry, Person, Plan } from '../../../../src/model/wap/types';
import { buildKpWorkbook, type WeekDef } from '../../fixtures/import/kp-workbook';

export const ctx = { templates: builtInTemplates() };

export function freshPlan(monday = '2099-10-05'): Plan {
  return createPlanFromTemplate(kpTemplate(), {
    planId: 'plan-test',
    startDate: monday,
    weekCount: 1,
  });
}

export function importWeeks(
  weeks: readonly WeekDef[],
  persons: readonly Person[] = [],
): ImportOutcome {
  const target = freshPlan(weeks[0]?.monday);
  return importKpWorkbook(
    target,
    readWorkbook(buildKpWorkbook(weeks)),
    'fiktiv.xlsx',
    {
      template: kpTemplate(),
      persons,
      functionList: target.functionList,
    },
    ctx,
  );
}

export const entries = (plan: Plan): Entry[] =>
  Object.values(plan.entries).sort((a, b) => a.createdSeq - b.createdSeq);
export const blocks = (plan: Plan): Block[] =>
  entries(plan).filter((e): e is Block => e.type === 'block');
export const besos = (plan: Plan): Beso[] =>
  entries(plan).filter((e): e is Beso => e.type === 'beso');
export const titleOf = (e: { title: readonly { text: string }[] }): string =>
  e.title.map((r) => r.text).join('');
export const rows = (plan: Plan) => listRows(plan, 'plan');
export const kinds = (o: ImportOutcome) => o.report.items.map((i) => i.kind);
