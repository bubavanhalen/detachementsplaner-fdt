// H-UI2, niedrige Punkte aus dem ux-critic-Bericht Runde 1 (UI-Richtlinie 4.1, 5.4, 12, 13.3, 14.2; R-5.7-03,
// R-11-07): Das Z-Formular übernimmt «0800-1200» im Feld Beginn als Beginn und Ende; ein leerer Titel verwirft nicht
// still, sondern mit Meldung; nach dem Neuladen öffnet die zuletzt offene Woche; «gestrichen» gehört zur Beschreibung
// des Eintrags. Abläufe über Rolle und Name. Nur fiktive Daten.
import { expect } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planLeisten } from './plaene';

export function registerNiedrigTests(url: () => string): void {
  test('[R-11-07] H-UI2 UX niedrig: Z öffnet das Zeitformular; «0800-1200» im Feld Beginn gilt als Beginn und Ende', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Zeit.wap.json', planFile(planLeisten()));
    await wapPage.getByRole('button', { name: /^Block Wache Nord / }).click();
    await wapPage.keyboard.press('z');
    const beginn = wapPage.getByRole('textbox', { name: 'Beginn', exact: true });
    await expect(beginn).toBeFocused();
    await beginn.fill('0900-1200');
    await beginn.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Block Wache Nord 0900-1200 · Mo/ }),
    ).toHaveCount(1);
  });

  test('[R-5.7-03] H-UI2 UX niedrig: ein leerer Titel verwirft die Erfassung mit einer Meldung (Ursache und nächster Schritt)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Leer.wap.json', planFile(planLeisten()));
    await wapPage
      .getByRole('button', { name: /^Mo 28\.09\. 0800 / })
      .first()
      .focus();
    // Eine Spalte weiter (leere Zelle neben dem Block), Enter beginnt die Erfassung.
    await wapPage.keyboard.press('ArrowRight');
    await wapPage.keyboard.press('Enter');
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    await wapPage.getByRole('heading', { name: 'WAP-Planer', level: 1 }).click();
    await expect(title).toHaveCount(0);
    await expect(wapPage.getByRole('status', { name: 'Meldung', exact: true })).toContainText(
      'Bearbeitung verworfen',
    );
  });

  test('[R-11-07] H-UI2 UX niedrig: nach dem Neuladen ist die zuletzt offene Woche des Plans wieder offen', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Woche.wap.json', planFile(planLeisten()));
    const tabs = wapPage.getByRole('tablist', { name: 'Wochen', exact: true }).getByRole('tab');
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true');
    await tabs.nth(2).click();
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
    await wapPage.reload();
    await expect(wapPage.getByRole('table', { name: 'Wochenraster', exact: true })).toBeVisible();
    await expect(tabs.nth(2)).toHaveAttribute('aria-selected', 'true');
  });

  test('[R-11-07] H-UI2 UX niedrig: «gestrichen» gehört zur zugänglichen Beschreibung des Eintrags (X)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Gestrichen.wap.json', planFile(planLeisten()));
    const block = wapPage.getByRole('button', { name: /^Block Wache Nord / });
    await block.click();
    await wapPage.keyboard.press('x');
    await expect(block).toHaveAccessibleDescription(/gestrichen/);
    await wapPage.keyboard.press('x');
    await expect(block).not.toHaveAccessibleDescription(/gestrichen/);
  });
}
