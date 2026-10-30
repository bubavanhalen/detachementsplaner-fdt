// I5 D5: Leistung nach Beschrieb 11 mit dem synthetischen Plan (4 Wochen, 1000 Einträge), gedrosselt nach
// docs/wap-planer/perf/drosselung.json, Median aus fünf Läufen nach einem Aufwärmlauf (ADR-010 §8). Fiktive Daten.
import { expect, test } from '@playwright/test';
import {
  medianOf5,
  messeImBrowser,
  perfHarnessUrl,
  recordMetric,
  withThrottle,
} from './support/perf';

const FAELLE = [
  ['i5Wochenwechsel', 'R-11-12', 300, 'Wochenwechsel bis zur fertigen Darstellung'],
  ['i5Pruefungen', 'R-11-14', 500, 'Prüfungen nach einer Änderung'],
  ['i5PdfWoche', 'R-11-15', 3000, 'PDF einer Woche'],
  ['i5PdfPlan', 'R-11-16', 10000, 'PDF des ganzen Plans'],
] as const;

for (const [name, anforderung, budget, was] of FAELLE) {
  test(`[${anforderung}] I5 D5: ${was} höchstens ${String(budget)} ms (Median, gedrosselt)`, async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.goto(perfHarnessUrl());
    const r = await withThrottle(page, () => medianOf5(() => messeImBrowser(page, name)));
    recordMetric(name, anforderung, r.median, budget);
    expect(r.median, `${was}: Läufe ${r.laeufe.join(', ')}`).toBeLessThanOrEqual(budget);
  });
}
