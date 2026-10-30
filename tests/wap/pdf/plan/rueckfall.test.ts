// @vitest-environment jsdom
// Paket E1-02f: Rückfallereignisse im Wochen- und Gesamt-PDF (R-10-03; Vertrag E1-02f Notiz «Ausarbeitung
// Schritt 2» B1, B2, C «Rückfallereignisse sind keine Fehler», J P7; L: keine bestimmte Zahl für die KVK).
// Fiktive Variante der pseudonymisierten KVK-Fixture: Einheit mit 200 Zeichen (wie E1-02e R-10-11).
import { describe, expect, it } from 'vitest';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { Plan } from '../../../../src/model/wap/types';
import { KVK_WOCHE, kvk } from '../../support/page/varianten';
import { gesamtPdf, wochenPdf } from './support/pdf-plan';
import { mitFolgewoche, optionen } from './support/plaene';

/** KVK mit einer Einheit aus 200 Zeichen (fiktiv). */
function langeEinheit(): Plan {
  return { ...kvk(), unit: 'Einheit '.repeat(25).slice(0, 200) };
}

describe('Rückfallereignisse (R-10-03; B1, B2, J P7)', () => {
  it('[R-10-03] Einheit mit 200 Zeichen: renderWeekPdf(…).fallbacks = layoutWeekPage(…).fallbacks.length ≥ 1, kein Fehler', async () => {
    const plan = langeEinheit();
    const { pdf, info } = await wochenPdf('einheit-200', plan, KVK_WOCHE);
    const soll = layoutWeekPage(plan, KVK_WOCHE, optionen()).fallbacks.length;
    expect(soll).toBeGreaterThanOrEqual(1);
    expect(pdf.fallbacks).toBe(soll);
    expect(pdf.pageCount).toBe(info.pages.length);
  });

  it('[R-10-03] Gesamt-PDF zweier Wochen mit langer Einheit: fallbacks = Summe der fallbacks.length beider Wochen', async () => {
    const plan = mitFolgewoche(langeEinheit());
    const { pdf, info } = await gesamtPdf('einheit-200-gesamt', plan);
    const je = plan.weeks.map((w) => layoutWeekPage(plan, w.id, optionen()).fallbacks.length);
    expect(je.length).toBe(2);
    expect(je.every((n) => n >= 1)).toBe(true);
    expect(pdf.fallbacks).toBe(je.reduce((s, n) => s + n, 0));
    expect(pdf.pageCount).toBe(info.pages.length);
  });
});
