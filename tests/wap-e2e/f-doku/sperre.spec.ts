// F-DOKU, Befund SA-2-01: Beleg für R-5.6-18 (Teil «Esc schliesst den Dialog nicht») unter der eigenen ID. Der
// Dialog «Sicherung vor dem Update» der App ist ein I2Dialog mit `dismissible={false}`; die Prüfseite
// `harness/h-ui2-sperre.tsx#sicherung` zeigt genau diesen Dialog ohne Datenbank (mit Formatversion 1 gibt es in der
// App kein älteres Schema, Befund FD-01). Die Sperre ohne Entscheid, das Neuladen und «Ohne Sicherung fortfahren»
// prüft `tests/wap/integration/f-doku/migration.test.ts` am Speicher. Nur fiktive Texte.
import { expect } from '@playwright/test';
import { test } from '../support/fixtures';

test('[R-5.6-18] «Sicherung vor dem Update»: Esc einmal, mehrfach und nach einem Klick in den Dialog → Dialog bleibt offen, kein Schliessen gemeldet; nur der Entscheid schliesst', async ({
  wapPage,
}) => {
  await wapPage.goto('/tests/wap-e2e/harness/h-ui2-sperre.html#sicherung');
  const dialog = wapPage.getByRole('dialog', { name: 'Sicherung vor dem Update', exact: true });
  await expect(dialog).toBeVisible();
  await wapPage.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 5; i++) await wapPage.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await dialog.getByRole('heading', { name: 'Sicherung vor dem Update' }).click();
  await wapPage.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  // Kein Schliessknopf, und die Anwendung hat kein Schliessen erhalten.
  await expect(dialog.getByRole('button', { name: 'Dialog schliessen' })).toHaveCount(0);
  await expect(wapPage.locator('main')).toHaveAttribute('data-geschlossen', '0');
  await dialog.getByRole('button', { name: 'Plan-Dateien sichern und fortfahren' }).click();
  await expect(dialog).toHaveCount(0);
});
