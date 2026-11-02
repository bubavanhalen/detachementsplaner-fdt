// F-UX2 Runde 6 (code-reviewer-4 CR-4-02/-03; Beschrieb 4.4, 5.2): aufbewahrter Spaltensatz «… (vor Entfernen von
// «…»)» – Löschen in den Plan-Einstellungen fragt mit der Anzahl betroffener Einträge nach; ist kein Eintrag mehr in
// der entfernten Spalte, verschwindet der Satz im selben Rückgängig-Schritt. Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { columnsOf } from './plaene';

/** Mo «Zwei» in Zfhr (KVK Stufen an Mo und Di). */
function planZfhr(): Plan {
  let plan = kpPlan(1);
  const zfhr = columnsOf(plan, 'KVK Stufen').find((c) => c.name === 'Zfhr');
  if (zfhr === undefined) throw new Error('Spalte fehlt');
  plan = add(plan, {
    type: 'block',
    date: MO,
    time: { form: 'range', from: 900, to: 1020 },
    columns: { kind: 'ids', ids: [zfhr.id] },
    title: [{ text: 'Zwei', bold: true }],
  }).plan;
  return { ...plan, id: 'fux2-zfhr', exerciseName: 'Zfhr Übungsplan', service: 'FDT 2099' };
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

/** Zfhr für alle Tage mit dem Spaltensatz entfernen (Mo und Di). */
async function zfhrEntfernen(page: Page): Promise<void> {
  await page
    .locator('th.i2-grid-day-head')
    .filter({ hasText: 'Mo 28.09.2026' })
    .getByRole('button', { name: 'Spaltenkopf Zfhr', exact: true })
    .focus();
  await page.keyboard.press('Delete');
  await page
    .getByRole('dialog', { name: 'Spalte «Zfhr» entfernen', exact: true })
    .getByRole('button', { name: 'Alle Tage mit diesem Spaltensatz', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(block(page, 'Zwei').locator('xpath=..')).toHaveClass(/i2-grid-p1/);
}

async function sätze(page: Page): Promise<string[]> {
  await page.getByRole('button', { name: 'Plan-Einstellungen …', exact: true }).click();
  const s = page.getByRole('dialog', { name: 'Plan-Einstellungen', exact: true });
  await s.getByRole('tab', { name: 'Spaltensätze', exact: true }).click();
  const namen = await s
    .getByRole('combobox', { name: 'Spaltensatz', exact: true })
    .locator('option')
    .allTextContents();
  return namen;
}

export function registerRunde6Tests(url: () => string): void {
  test('[R-5.2-09] F-UX2 CR-4-02: aufbewahrten Satz löschen fragt mit der Anzahl betroffener Einträge nach; «Behalten» ist vorgewählt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R6Loeschen.wap.json', planFile(planZfhr()));
    await zfhrEntfernen(wapPage);
    const namen = await sätze(wapPage);
    const kept = namen.find((n) => n.includes('vor Entfernen von «Zfhr»'));
    expect(kept).toBeDefined();
    const s = wapPage.getByRole('dialog', { name: 'Plan-Einstellungen', exact: true });
    await s
      .getByRole('combobox', { name: 'Spaltensatz', exact: true })
      .selectOption({ label: kept as string });
    await s.getByRole('button', { name: 'Spaltensatz löschen', exact: true }).click();
    const frage = wapPage.getByRole('dialog', {
      name: `Spaltensatz «${kept}» löschen`,
      exact: true,
    });
    await expect(frage).toContainText('1 Eintrag verweist');
    await expect(frage.getByRole('button', { name: 'Behalten', exact: true })).toBeFocused();
    await frage.getByRole('button', { name: 'Behalten', exact: true }).click();
    await expect(frage).toHaveCount(0);
    await expect(
      s.getByRole('combobox', { name: 'Spaltensatz', exact: true }).locator('option', {
        hasText: 'vor Entfernen',
      }),
    ).toHaveCount(1);
  });

  test('[R-5.2-09] F-UX2 CR-4-03: Block aus der entfernten Spalte in eine vorhandene gesetzt – der aufbewahrte Satz verschwindet, Ctrl+Z stellt beides her', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R6Aufraeumen.wap.json', planFile(planZfhr()));
    await zfhrEntfernen(wapPage);
    await block(wapPage, 'Zwei').focus();
    await wapPage.keyboard.press('ArrowRight');
    await expect(block(wapPage, 'Zwei').locator('xpath=..')).not.toHaveClass(/i2-grid-p1/);
    expect((await sätze(wapPage)).filter((n) => n.includes('vor Entfernen'))).toEqual([]);
    await wapPage.keyboard.press('Escape');
    await expect(wapPage.getByRole('dialog')).toHaveCount(0);
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(block(wapPage, 'Zwei').locator('xpath=..')).toHaveClass(/i2-grid-p1/);
    expect((await sätze(wapPage)).filter((n) => n.includes('vor Entfernen'))).toHaveLength(1);
  });
}
