// H-UI2, Befunde UX-H-08, SA-H-11 und SA-H-21 in der ganzen Suite (UI-Richtlinie 2.1, 11.6, 13.1, 14.1, 18 S-1):
// Auf /wap zeigt die Suite-Palette (Ctrl+K) die Befehle des WAP-Planers in der Gruppe «WAP-Planer» und führt sie aus;
// unter file:// auch «Hinweis zum gemeinsamen Speicher». Die Suite-Seitenleiste erreicht auf /wap Kontrast ≥ 4,5:1
// (hell und dunkel, ein- und ausgeklappt); es gibt genau eine Überschrift h1 und einen Knopf «Tastenkürzel».
// Abläufe über Rolle und Name. Nur fiktive Daten.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { createPlan } from '../../i2/support/ablauf';
import { test } from '../../support/fixtures';

function suitePalette(page: Page) {
  return page.getByRole('dialog', { name: 'Befehle und Suche', exact: true });
}

async function contrast(page: Page): Promise<string[]> {
  const r = await new AxeBuilder({ page })
    .include('.sidebar')
    .withRules(['color-contrast'])
    .analyze();
  return r.violations.flatMap((v) => v.nodes.map((n) => `${v.id} ${n.target.join(' ')}`));
}

export function registerSuiteTests(url: () => string, local: boolean): void {
  test('[R-11-07] H-UI2 UX-H-08: auf /wap zeigt die Suite-Palette (Ctrl+K) die Befehle des WAP-Planers (Gruppe «WAP-Planer») und führt sie aus', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#/wap`, 'Palette Übungsplan');
    await wapPage.keyboard.press('Control+k');
    const p = suitePalette(wapPage);
    await expect(p).toBeVisible();
    await expect(p.getByText('WAP-Planer', { exact: true })).toBeVisible();
    await wapPage.keyboard.type('Plan-Datei sichern');
    await expect(p.getByRole('option', { name: /^Plan-Datei sichern/ })).toHaveCount(1);
    const download = wapPage.waitForEvent('download');
    await wapPage.keyboard.press('Enter');
    expect((await download).suggestedFilename()).toMatch(/\.wap\.json$/);
    await expect(p).toHaveCount(0);
    // Ein Befehl des Rasters.
    await wapPage.keyboard.press('Control+k');
    await expect(p).toBeVisible();
    await wapPage.keyboard.type('Gehe zu');
    await wapPage.keyboard.press('Enter');
    await expect(wapPage.getByRole('dialog', { name: 'Gehe zu', exact: true })).toBeVisible();
    await wapPage.keyboard.press('Escape');
    // Hinweis zum gemeinsamen Speicher nur unter file://.
    await wapPage.keyboard.press('Control+k');
    await wapPage.keyboard.type('gemeinsamen Speicher');
    await expect(p.getByRole('option', { name: /^Hinweis zum gemeinsamen Speicher/ })).toHaveCount(
      local ? 1 : 0,
    );
    if (local) {
      await wapPage.keyboard.press('Enter');
      await expect(
        wapPage
          .getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true })
          .getByRole('heading', { name: 'Gemeinsamer Browserspeicher' }),
      ).toBeFocused();
    }
    await wapPage.keyboard.press('Escape');
    // Ausserhalb von /wap keine Befehle des WAP-Planers.
    await wapPage.keyboard.press('Alt+5');
    await expect(wapPage).toHaveURL(/#\/persons$/);
    await wapPage.keyboard.press('Control+k');
    await wapPage.keyboard.type('Plan-Datei sichern');
    await expect(p.getByRole('option', { name: /^Plan-Datei sichern/ })).toHaveCount(0);
    await wapPage.keyboard.press('Escape');
  });

  test('[R-11-09][R-11-07] H-UI2 SA-H-21: Suite-Seitenleiste auf /wap mit Kontrast ≥ 4,5:1 (hell und dunkel, ausgeklappt); genau eine h1 und ein Knopf «Tastenkürzel»', async ({
    wapPage,
  }) => {
    // F-FLAKY (FL-03): keine Zeitanforderung; Plan anlegen und vier Kontrastprüfungen (axe), zusammen 4–8 s, unter
    // Rechnerlast über 30 s – Zeitlimit als Schutz vor Hängern statt der Vorgabe 30 s.
    test.setTimeout(120_000);
    await createPlan(wapPage, `${url()}#/wap`, 'Kontrast Übungsplan');
    await expect(wapPage.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(wapPage.getByRole('heading', { name: 'WAP-Planer', level: 1 })).toHaveCount(1);
    await expect(wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true })).toHaveCount(1);
    await wapPage.locator('body').click({ position: { x: 2, y: 2 } });
    for (const scheme of ['light', 'dark'] as const) {
      await wapPage.emulateMedia({ colorScheme: scheme });
      // Ausgeklappt (Ctrl+B) und wieder eingeklappt.
      const toggle = wapPage
        .getByRole('complementary', { name: 'Seitenleiste', exact: true })
        .getByRole('button', { name: /^Seitenleiste (aus|ein)klappen$/ });
      if ((await toggle.getAttribute('aria-label')) === 'Seitenleiste ausklappen')
        await toggle.click();
      await expect(toggle).toHaveAccessibleName('Seitenleiste einklappen');
      expect(await contrast(wapPage), `${scheme}, ausgeklappt`).toEqual([]);
      await toggle.click();
      await expect(toggle).toHaveAccessibleName('Seitenleiste ausklappen');
      expect(await contrast(wapPage), `${scheme}, eingeklappt`).toEqual([]);
    }
  });
}
