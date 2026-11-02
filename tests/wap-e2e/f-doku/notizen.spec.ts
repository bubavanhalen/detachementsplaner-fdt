// F-DOKU, Befund SA-2-01: Beleg für R-6-39 unter der eigenen ID (bisher nur unter [R-11-07] in H-UI2). Kriterium
// (Katalog, F-46): Plan mit Notiz → Sichern zeigt den Hinweis «enthält interne Notizen»; Plan ohne Notiz → kein
// Hinweis. Geprüft am Knopf «Plan-Datei sichern» (Tooltip), an der Meldung nach dem Sichern und an der gesicherten
// Datei (Kennzeichen `containsInternalNotes`), für Notizen an einem Eintrag und an einem Tag; per Maus und Ctrl+S.
// Entwicklungsserver; nur fiktive Daten.
import { readFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { startWith } from '../i5/support/ablauf';
import { planFile } from '../i5/support/plaene';
import { test } from '../support/fixtures';
import { planNotizEintrag, planNotizTag, planOhneNotiz } from './support/plaene';

const URL = '/tests/wap-e2e/harness/i5.html#leer';

function meldung(page: Page) {
  return page.getByRole('status', { name: 'Meldung', exact: true });
}

/** Sichert per Maus bzw. Ctrl+S und liefert das Kennzeichen der gesicherten Datei. */
async function sichern(page: Page, art: 'maus' | 'tastatur'): Promise<unknown> {
  const download = page.waitForEvent('download');
  if (art === 'maus')
    await page.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click();
  else await page.keyboard.press('Control+s');
  const pfad = await (await download).path();
  if (pfad === null) throw new Error('Datei fehlt');
  const datei = JSON.parse(readFileSync(pfad, 'utf8')) as { containsInternalNotes?: unknown };
  return datei.containsInternalNotes;
}

test('[R-6-39] Notiz an einem Eintrag: «Plan-Datei sichern» kennzeichnet die Datei als «enthält interne Notizen» (Tooltip, Meldung, Kennzeichen der Datei)', async ({
  wapPage,
}) => {
  await startWith(wapPage, URL, 'NotizEintrag.wap.json', planFile(planNotizEintrag()));
  const knopf = wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true });
  await expect(knopf).toHaveAttribute('title', /enthält interne Notizen/);
  expect(await sichern(wapPage, 'maus')).toBe(true);
  await expect(meldung(wapPage)).toContainText('enthält interne Notizen');
});

test('[R-6-39] Notiz nur an einem Tag: Ctrl+S kennzeichnet die Datei ebenfalls als «enthält interne Notizen»', async ({
  wapPage,
}) => {
  await startWith(wapPage, URL, 'NotizTag.wap.json', planFile(planNotizTag()));
  await expect(
    wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true }),
  ).toHaveAttribute('title', /enthält interne Notizen/);
  expect(await sichern(wapPage, 'tastatur')).toBe(true);
  await expect(meldung(wapPage)).toContainText('enthält interne Notizen');
});

test('[R-6-39] Plan ohne Notiz: kein Hinweis am Knopf, in der Meldung und in der Datei', async ({
  wapPage,
}) => {
  await startWith(wapPage, URL, 'OhneNotiz.wap.json', planFile(planOhneNotiz()));
  await expect(
    wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true }),
  ).not.toHaveAttribute('title', /interne Notizen/);
  expect(await sichern(wapPage, 'maus')).toBe(false);
  await expect(meldung(wapPage)).toContainText('gesichert');
  await expect(meldung(wapPage)).not.toContainText('interne Notizen');
});
