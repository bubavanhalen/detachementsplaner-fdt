// H-UI2, Befunde SA-H-07, SA-H-08 und SA-H-09 (R-6-39 mit F-46, R-4.6-67 mit Q-026, R-11-07, R-11-09; UI-Richtlinie
// 4.2 «geändert», 14.1): Der Terminbereich ist per Tastatur erreichbar, sobald er tatsächlich rollt (axe
// scrollable-region-focusable), bei jeder Zoomstufe; «Plan-Datei sichern» kennzeichnet die Datei als «enthält interne
// Notizen», wenn der Plan Notizen enthält; nach dem ersten Stand markiert jede Änderung eines Beso «geändert», sichtbar
// in Raster und Liste, bis zum nächsten Stand. Abläufe über Rolle und Name. Nur fiktive Daten.
import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planNotiz, planOhneNotiz, planStand, planTermine, planTermineLang } from './plaene';

async function agendaState(page: Page) {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('td.i2-grid-agenda')].map((td) => ({
      rollt: td.scrollHeight > td.clientHeight + 0.5,
      fokus: td.tabIndex === 0,
    })),
  );
}

async function scrollableViolations(page: Page): Promise<number> {
  const r = await new AxeBuilder({ page })
    .include('.i2-grid')
    .withRules(['scrollable-region-focusable'])
    .analyze();
  return r.violations.reduce((n, v) => n + v.nodes.length, 0);
}

function meldung(page: Page) {
  return page.getByRole('status', { name: 'Meldung', exact: true });
}

export function registerAnzeigeTests(url: () => string): void {
  test('[R-11-07][R-11-09] H-UI2 SA-H-07: Terminbereich – rollt er tatsächlich, ist er per Tastatur erreichbar und rollt mit den Pfeilen; bei jeder Zoomstufe ohne Verstoss scrollable-region-focusable', async ({
    wapPage,
  }) => {
    // F-FLAKY (FL-03): keine Zeitanforderung; zwei Pläne mit je 9 Zoomstufen und axe-Prüfung (axe rund 0,8 s je
    // Lauf), zusammen 10–17 s, unter Rechnerlast über 30 s – Zeitlimit als Schutz vor Hängern statt der Vorgabe 30 s.
    test.setTimeout(120_000);
    // Viele Einträge und wenige, sehr lange (mehrzeilig umbrochene) Einträge: massgeblich ist die tatsächliche Höhe.
    for (const plan of [planTermine(8), planTermineLang()]) {
      await startWith(wapPage, `${url()}#leer`, 'Termine.wap.json', planFile(plan));
      const fit = wapPage.getByRole('button', { name: 'Einpassen', exact: true });
      if ((await fit.getAttribute('aria-pressed')) === 'true') await fit.click();
      for (let i = 0; i < 3; i++)
        await wapPage.getByRole('button', { name: 'Verkleinern', exact: true }).click();
      let rollte = false;
      for (let step = 0; step < 9; step++) {
        for (const s of await agendaState(wapPage)) {
          expect(s.fokus, 'Rollender Terminbereich ist ein Tab-Stopp, sonst nicht').toBe(s.rollt);
          rollte ||= s.rollt;
        }
        expect(await scrollableViolations(wapPage)).toBe(0);
        await wapPage.getByRole('button', { name: 'Vergrössern', exact: true }).click();
      }
      if (plan.id === 'hui2-termine-8')
        expect(rollte, `${plan.exerciseName}: mindestens eine Zoomstufe rollt`).toBe(true);
    }
    // Bei 50 % rollt der Terminbereich des Mo: Tab erreicht ihn, ↓ rollt.
    for (let i = 0; i < 9; i++)
      await wapPage.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    const mo = wapPage.getByRole('cell', { name: 'Terminbereich Mo 28.09.2026', exact: true });
    if ((await mo.getAttribute('tabindex')) === '0') {
      await mo.focus();
      await wapPage.keyboard.press('ArrowDown');
      await wapPage.keyboard.press('ArrowDown');
      await expect.poll(() => mo.evaluate((e) => e.scrollTop)).toBeGreaterThan(0);
    }
  });

  test('[R-11-07] H-UI2 SA-H-08: «Plan-Datei sichern» kennzeichnet die Datei als «enthält interne Notizen», wenn der Plan Notizen enthält, sonst nicht', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Notiz.wap.json', planFile(planNotiz()));
    const sichern = wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true });
    await expect(sichern).toHaveAttribute('title', /enthält interne Notizen/);
    let download = wapPage.waitForEvent('download');
    await sichern.click();
    await download;
    await expect(meldung(wapPage)).toContainText('enthält interne Notizen');
    await expect(meldung(wapPage)).toContainText('nicht weitergeben');
    await startWith(wapPage, `${url()}#leer`, 'OhneNotiz.wap.json', planFile(planOhneNotiz()));
    await expect(sichern).not.toHaveAttribute('title', /interne Notizen/);
    download = wapPage.waitForEvent('download');
    await wapPage.keyboard.press('Control+s');
    await download;
    await expect(meldung(wapPage)).toContainText('gesichert');
    await expect(meldung(wapPage)).not.toContainText('interne Notizen');
  });

  test('[R-11-07] H-UI2 SA-H-09: nach dem ersten Stand markiert jede Änderung eines Beso «geändert» (Raster und Liste), ein Block nicht; der nächste Stand setzt zurück', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-14T09:00:00+02:00');
    const { plan } = planStand();
    await startWith(wapPage, `${url()}#leer`, 'Stand.wap.json', planFile(plan));
    const visite1 = wapPage.getByRole('button', { name: /^Beso \S+ Visite 1 / });
    await expect(visite1).not.toHaveAccessibleDescription(/geändert/);
    // Titel im Seitenfeld ändern.
    await visite1.click();
    await wapPage.keyboard.press('e');
    const title = wapPage
      .getByRole('complementary', { name: 'Seitenfeld', exact: true })
      .getByRole('textbox', { name: 'Titel', exact: true });
    await title.fill('Visite 1 Nord');
    await title.press('Enter');
    const geaendert = wapPage.getByRole('button', { name: /^Beso \S+ Visite 1 Nord / });
    await expect(geaendert).toHaveAccessibleDescription(/geändert seit letztem Stand/);
    await expect(wapPage.locator('.i2-grid-changed')).toHaveCount(1);
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Visite 2 / }),
    ).not.toHaveAccessibleDescription(/geändert/);
    // Block verschieben: nicht markiert.
    const block = wapPage.getByRole('button', { name: /^Block Wache Ost / });
    await block.click();
    await wapPage.keyboard.press('ArrowDown');
    await expect(wapPage.getByRole('button', { name: /^Block Wache Ost 0815-1015/ })).toHaveCount(
      1,
    );
    await expect(
      wapPage.getByRole('button', { name: /^Block Wache Ost / }),
    ).not.toHaveAccessibleDescription(/geändert/);
    // Liste: Status «geändert» nur beim geänderten Beso.
    await wapPage.keyboard.press('Control+l');
    const grid = wapPage.getByRole('grid', { name: /^Einträge / });
    await expect(grid.getByRole('row').filter({ hasText: 'Visite 1 Nord' })).toContainText(
      'geändert',
    );
    await expect(grid.getByRole('row').filter({ hasText: 'Visite 2' })).not.toContainText(
      'geändert',
    );
    await wapPage.keyboard.press('Control+l');
    // Rückgängig nimmt die Markierung mit dem Wert zurück.
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Visite 1 / }),
    ).not.toHaveAccessibleDescription(/geändert/);
    await wapPage.getByRole('button', { name: 'Wiederholen', exact: true }).click();
    await expect(geaendert).toHaveAccessibleDescription(/geändert seit letztem Stand/);
    // Neuer Stand setzt zurück.
    await wapPage.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true });
    await dialog.getByRole('button', { name: 'Stand setzen', exact: true }).click();
    await expect(meldung(wapPage)).toContainText('Stand V2 vom 14.10.2026 gesetzt');
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Visite 1 Nord / }),
    ).not.toHaveAccessibleDescription(/geändert/);
  });
}
