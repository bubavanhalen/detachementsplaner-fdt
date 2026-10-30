// H-TESTS (Härtung, TR-H-04): Leistung nach Beschrieb 11 als eigene Tests mit literalen Namen, gedrosselt nach
// docs/wap-planer/perf/drosselung.json, synthetischer Plan (4 Wochen, 1000 Einträge, Startwert 20260928); dieselbe
// Messung wie tests/wap-perf/i5.perf.ts (Median aus fünf Läufen nach einem Aufwärmlauf, ADR-010 §8). R-11-11 und
// R-11-17 siehe Befunde HT-05 und HT-08. Nur fiktive Daten.
import { expect, type Page, test } from '@playwright/test';
import {
  medianOf5,
  messeImBrowser,
  perfHarnessUrl,
  recordMetric,
  withThrottle,
} from '../support/perf';

async function median(page: Page, eintrag: string): Promise<{ median: number; laeufe: number[] }> {
  await page.goto(perfHarnessUrl());
  return withThrottle(page, () => medianOf5(() => messeImBrowser(page, eintrag)));
}

test('[R-11-12] H-TESTS: Wochenwechsel bis zur fertigen Darstellung höchstens 300 ms (Median, gedrosselt)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const r = await median(page, 'i5Wochenwechsel');
  recordMetric('hTestsWochenwechsel', 'R-11-12', r.median, 300);
  expect(r.median, `Wochenwechsel: Läufe ${r.laeufe.join(', ')}`).toBeLessThanOrEqual(300);
});

test('[R-11-14] H-TESTS: Prüfungen nach einer Änderung höchstens 500 ms (Median, gedrosselt)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const r = await median(page, 'i5Pruefungen');
  recordMetric('hTestsPruefungen', 'R-11-14', r.median, 500);
  expect(r.median, `Prüfungen: Läufe ${r.laeufe.join(', ')}`).toBeLessThanOrEqual(500);
});

test('[R-11-15] H-TESTS: PDF einer Woche höchstens 3 s (Median, gedrosselt)', async ({ page }) => {
  test.setTimeout(240_000);
  const r = await median(page, 'i5PdfWoche');
  recordMetric('hTestsPdfWoche', 'R-11-15', r.median, 3000);
  expect(r.median, `PDF Woche: Läufe ${r.laeufe.join(', ')}`).toBeLessThanOrEqual(3000);
});

test('[R-11-16] H-TESTS: PDF des ganzen Plans höchstens 10 s (Median, gedrosselt)', async ({
  page,
}) => {
  test.setTimeout(240_000);
  const r = await median(page, 'i5PdfPlan');
  recordMetric('hTestsPdfPlan', 'R-11-16', r.median, 10000);
  expect(r.median, `PDF Plan: Läufe ${r.laeufe.join(', ')}`).toBeLessThanOrEqual(10000);
});
