// Leistungseinträge I5 (Beschrieb 11; R-11-12, R-11-14, R-11-15, R-11-16): synthetischer Plan mit 4 Wochen und
// 1000 Einträgen (tests/wap/support/synthetic-plan.ts). Gemessen im Browser der Leistungs-Harness, fiktive Daten.
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot, type Root } from 'react-dom/client';
import { I2GridEditor } from '../../../../src/components/wap/i2/GridEditor';
import { renderPlanPdf, renderWeekPdf } from '../../../../src/io/wap-pdf/index';
import { createCheckRunner } from '../../../../src/model/wap/checks';
import { createEntry } from '../../../../src/model/wap/commands/entries';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { PageOptions } from '../../../../src/model/wap/layout/page/types';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { syntheticPlan } from '../../../wap/support/synthetic-plan';
import { registerPerfEntries } from '../harness';

const CTX = { templates: builtInTemplates() };
const OPTIONS: PageOptions = {
  paper: 'A4',
  showStatus: true,
  statusRendering: true,
  templates: CTX.templates,
};
const layoutFor = (plan: Plan) => (weekId: Id) => layoutWeekPage(plan, weekId, OPTIONS);
const week = (plan: Plan, i: number): Id => plan.weeks[i]?.id ?? '';

interface Grid {
  readonly root: Root;
  readonly host: HTMLElement;
  readonly plan: Plan;
}

function editor(plan: Plan, weekId: Id) {
  return createElement(I2GridEditor, {
    key: weekId,
    plan,
    weekId,
    readOnly: false,
    onCommand: async () => {},
  });
}

registerPerfEntries([
  {
    name: 'i5Pruefungen',
    anforderung: 'R-11-14',
    budgetMs: 500,
    async prepare(seed) {
      const plan = syntheticPlan(seed);
      const runner = createCheckRunner();
      runner({ plan, layoutFor: layoutFor(plan) });
      const next = createEntry(
        plan,
        {
          type: 'block',
          date: plan.weeks[1]?.startDate ?? '2026-10-05',
          time: { form: 'range', from: 480, to: 600 },
          columns: { kind: 'all' },
          title: [{ text: 'Messblock', bold: true }],
        },
        CTX,
      ).plan;
      return { runner, next };
    },
    async run(prepared) {
      const { runner, next } = prepared as {
        runner: ReturnType<typeof createCheckRunner>;
        next: Plan;
      };
      runner({ plan: next, layoutFor: layoutFor(next) });
    },
  },
  {
    name: 'i5PdfWoche',
    anforderung: 'R-11-15',
    budgetMs: 3000,
    async prepare(seed) {
      return syntheticPlan(seed);
    },
    async run(prepared) {
      const plan = prepared as Plan;
      await renderWeekPdf(plan, week(plan, 0), OPTIONS, 'Messung Woche');
    },
  },
  {
    name: 'i5PdfPlan',
    anforderung: 'R-11-16',
    budgetMs: 10000,
    async prepare(seed) {
      return syntheticPlan(seed);
    },
    async run(prepared) {
      await renderPlanPdf(prepared as Plan, OPTIONS, 'Messung Plan');
    },
  },
  {
    name: 'i5Wochenwechsel',
    anforderung: 'R-11-12',
    budgetMs: 300,
    async prepare(seed) {
      const plan = syntheticPlan(seed);
      document.querySelector('#wap-perf-raster')?.remove();
      const host = document.createElement('div');
      host.id = 'wap-perf-raster';
      host.style.cssText = 'width:1600px;height:1000px;position:relative';
      document.body.append(host);
      const root = createRoot(host);
      flushSync(() => root.render(editor(plan, week(plan, 0))));
      return { root, host, plan } satisfies Grid;
    },
    async run(prepared) {
      const { root, plan } = prepared as Grid;
      // Bis zur fertigen Darstellung: Render und Effekte synchron abgeschlossen.
      flushSync(() => root.render(editor(plan, week(plan, 1))));
    },
  },
]);
