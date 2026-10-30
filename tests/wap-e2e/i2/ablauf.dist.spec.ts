import { expect } from '@playwright/test';
import { einzeldateiUrl, test } from '../support/fixtures';
import {
  activateButton,
  createBlockWithKeyboard,
  createPlan,
  registerI2Tests,
} from './support/ablauf';

registerI2Tests(() => einzeldateiUrl('i2'));

test('[R-5.6-01][R-5.6-16][R-11-01] AE-005: Einzeldatei arbeitet offline, speichert und erhält Rückgängig nach Neuladen', async ({
  wapPage,
  requests,
}) => {
  const consoleMessages: string[] = [];
  wapPage.on('console', (message) => consoleMessages.push(message.type()));
  await wapPage.context().setOffline(true);
  await createPlan(wapPage, `${einzeldateiUrl('i2')}#leer`, 'Offline Übungsplan');
  await createBlockWithKeyboard(wapPage, 'Offline Block');
  await expect(wapPage.getByRole('button', { name: /^Block Offline Block / })).toBeVisible();
  await wapPage.reload();
  await expect(wapPage.getByRole('button', { name: /^Block Offline Block / })).toBeVisible();
  await activateButton(wapPage.getByRole('button', { name: 'Rückgängig', exact: true }));
  await expect(wapPage.getByRole('button', { name: /^Block Offline Block / })).toHaveCount(0);
  expect(requests.filter((url) => !/^(file:|data:|blob:)/.test(url))).toEqual([]);
  expect(consoleMessages).toEqual([]);
});
