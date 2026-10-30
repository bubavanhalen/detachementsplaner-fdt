// H-UI, Befund UX-H-15 (ux-critic Härtung Runde 1; UI-Richtlinie 11.5 Rückmeldungen): Die Meldung «… gelöscht ·
// Rückgängig» bietet Rückgängig nur an, solange die Löschung der letzte Schritt ist; nach einer weiteren Änderung
// verschwindet sie, damit «Rückgängig» nie eine andere Änderung zurücknimmt. Nur fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { block, column, kpPlan } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';

function planZwei() {
  let plan = block(kpPlan(1), 'Alpha').plan;
  plan = block(plan, 'Bravo', { columns: { kind: 'ids', ids: [column(plan, 2).id] } }).plan;
  return { ...plan, id: 'hui-e2e-meldung', exerciseName: 'Meldung Übungsplan' };
}

function blockNamed(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

export function registerMeldungTests(url: () => string): void {
  test('[R-5.7-03][R-5.6-01] H-UI UX-H-15: «gelöscht · Rückgängig» bringt das Gelöschte zurück; nach einer weiteren Änderung ist die Meldung weg', async ({
    wapPage,
  }) => {
    await startWith(wapPage, url(), 'meldung.wap.json', planFile(planZwei()));
    const toast = wapPage.getByRole('status', { name: 'Meldung', exact: true });
    // Löschen und sofort aus der Meldung zurücknehmen: der Block ist wieder da.
    await blockNamed(wapPage, 'Alpha').click();
    await wapPage.keyboard.press('Delete');
    await expect(toast).toContainText('«Alpha» gelöscht');
    await toast.getByRole('button', { name: /rückgängig machen$/ }).click();
    await expect(blockNamed(wapPage, 'Alpha')).toBeVisible();
    // Löschen, dann eine andere Änderung: die alte Meldung bietet kein Rückgängig mehr an.
    await blockNamed(wapPage, 'Alpha').click();
    await wapPage.keyboard.press('Delete');
    await expect(toast).toContainText('«Alpha» gelöscht');
    await blockNamed(wapPage, 'Bravo').dblclick();
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await title.fill('Bravo neu');
    await title.press('Enter');
    await expect(blockNamed(wapPage, 'Bravo neu')).toBeVisible();
    await expect(toast.getByRole('button', { name: /rückgängig machen$/ })).toHaveCount(0);
    await expect(blockNamed(wapPage, 'Alpha')).toHaveCount(0);
  });
}
