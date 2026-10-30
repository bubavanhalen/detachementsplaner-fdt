// H-UI, Befund CR-H-U-04 (R-5-01; Leitplanke 2, ADR-004 Punkt 4, Beschrieb 10): Der Terminbereich zeichnet
// vorberechnete Zeilen der Layout-Schicht in der Druckschrift WAP Arimo mit `white-space: pre` (der Browser bricht nie
// selbst um); der Zoom skaliert Schrift und Lage, die Zeilen bleiben dieselben. Bedienung (Wählen, Doppelklick) wie
// bisher. Nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

function planTermine() {
  const plan = add(kpPlan(1), {
    type: 'beso',
    date: MO,
    title: [
      {
        text: 'Materialfassung und Kontrolle der persönlichen Ausrüstung im Zeughaus mit Abgabe der Leihgeräte',
        bold: false,
      },
    ],
    windows: [{ time: { form: 'range', from: 600, to: 630 } }],
  }).plan;
  return { ...plan, id: 'hui-e2e-termine', exerciseName: 'Termine Übungsplan' };
}

function line(page: Page): Locator {
  return page.getByRole('button', { name: /^Terminzeile \S+ 1000-1030: Materialfassung/ });
}

async function drawn(page: Page) {
  return line(page)
    .locator('.i2-grid-line')
    .evaluateAll((els) =>
      els.map((el) => {
        const cs = getComputedStyle(el);
        return {
          text: el.textContent ?? '',
          font: cs.fontFamily,
          whiteSpace: cs.whiteSpace,
          size: Number.parseFloat(cs.fontSize),
          width: el.getBoundingClientRect().width,
        };
      }),
    );
}

export function registerTerminbereichTests(url: () => string): void {
  test('[R-5-01] H-UI CR-H-U-04: Terminzeilen als vorberechnete Zeilen in WAP Arimo (white-space: pre); Zoom skaliert nur', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'termine.wap.json', planFile(planTermine()));
    await expect(line(wapPage)).toBeVisible();
    const a = await drawn(wapPage);
    expect(a.length).toBeGreaterThan(1);
    for (const l of a) {
      expect(l.font).toContain('WAP Arimo');
      expect(l.whiteSpace).toBe('pre');
    }
    expect(
      a
        .map((l) => l.text)
        .join(' ')
        .replace(/\s+/g, ' '),
    ).toContain('Materialfassung und Kontrolle');
    // Zoom +: gleiche Zeilen, grössere Schrift.
    await wapPage.getByRole('button', { name: 'Vergrössern', exact: true }).click();
    await expect
      .poll(async () => (await drawn(wapPage))[0]?.size ?? 0)
      .toBeGreaterThan(a[0]?.size ?? 0);
    const b = await drawn(wapPage);
    expect(b.map((l) => l.text)).toEqual(a.map((l) => l.text));
    // Bedienung wie bisher: Klick wählt, Doppelklick bearbeitet den Termintext.
    await line(wapPage).click();
    await expect(line(wapPage)).toHaveAttribute('aria-pressed', 'true');
    await line(wapPage).dblclick();
    await expect(wapPage.getByRole('textbox', { name: 'Termintext', exact: true })).toBeFocused();
  });
}
