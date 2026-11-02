// F-UX2 Runde 2 (code-reviewer Oberfläche Runde 2, 20.10.2026, Stand 5da6891; Bericht lokal unter
// .qa/haertung/code-reviewer-ui-2.md): CR-U-2-01 Fokus nach «Spalte entfernen», -02 Ctrl+P/Ctrl+S in Eingabefeldern
// des Rasters, -03 schmale Rap-Spalte im Mindest-Trefferbereich, -04 Doppelklick auf kleinen, noch nicht gewählten
// Block, -05 Blockrand auf Gerätepixeln, -07 Hervorhebung nach Auffüllen, -08 Schreibmarke im leeren Feld,
// -09 Enter während einer IME-Komposition. Maus und Tastatur. Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planDicht, planEinfach } from './plaene';

function kopf(page: Page, tag: string): Locator {
  return page.locator('th.i2-grid-day-head').filter({ hasText: tag });
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function aktiv(page: Page): Promise<string> {
  return page.evaluate(() => {
    const a = document.activeElement;
    return a === null ? '' : `${a.tagName}|${a.getAttribute('aria-label') ?? ''}`;
  });
}

async function zoom50(page: Page): Promise<void> {
  const k = page.getByRole('button', { name: 'Verkleinern', exact: true });
  await k.click();
  await k.click();
  await expect(page.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText('50 %');
}

export function registerRunde2Tests(url: () => string): void {
  test('[R-11-07][R-5.2-09] F-UX2 CR-U-2-01: nach «Spalte entfernen» (erste Spalte, nur dieser Tag bzw. alle Tage) liegt der Fokus auf dem Nachbarkopf, Pfeiltasten wirken weiter', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R2Fokus.wap.json', planFile(planEinfach()));
    await kopf(wapPage, 'Mi 30.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Kdo', exact: true })
      .focus();
    await wapPage.keyboard.press('Delete');
    await wapPage
      .getByRole('dialog', { name: 'Spalte «Kdo» entfernen', exact: true })
      .getByRole('button', { name: 'Nur dieser Tag', exact: true })
      .click();
    await expect.poll(() => aktiv(wapPage)).toBe('BUTTON|Spaltenkopf Mö');
    await wapPage.keyboard.press('ArrowRight');
    await expect.poll(() => aktiv(wapPage)).toBe('BUTTON|Spaltenkopf Sph');
    // Erste Spalte am Mo, alle Tage mit dem Spaltensatz.
    await kopf(wapPage, 'Mo 28.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Kp Kdt', exact: true })
      .focus();
    await wapPage.keyboard.press('Delete');
    await wapPage
      .getByRole('dialog', { name: 'Spalte «Kp Kdt» entfernen', exact: true })
      .getByRole('button', { name: 'Alle Tage mit diesem Spaltensatz', exact: true })
      .click();
    await expect.poll(() => aktiv(wapPage)).toBe('BUTTON|Spaltenkopf Stv');
    await wapPage.keyboard.press('ArrowRight');
    await expect.poll(() => aktiv(wapPage)).toBe('BUTTON|Spaltenkopf Zfhr');
  });

  test('[R-11-07][R-5.1-10] F-UX2 CR-U-2-02: Ctrl+P und Ctrl+S in der Direktbearbeitung und im Spaltennamen übernehmen und öffnen die WAP-Funktion statt des Browserdialogs', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R2Kuerzel.wap.json', planFile(planEinfach()));
    await block(wapPage, 'Wache Süd').focus();
    await wapPage.keyboard.press('F2');
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await title.press('End');
    await title.pressSequentially(' Ost');
    await title.press('Control+p');
    const pdf = wapPage.getByRole('dialog', { name: 'PDF dieser Woche', exact: true });
    await expect(pdf).toBeVisible();
    await expect(block(wapPage, 'Wache Süd Ost')).toHaveCount(1);
    await wapPage.keyboard.press('Escape');
    await expect(pdf).toHaveCount(0);
    // Ctrl+S: Plan-Datei sichern (Herunterladen), die Bearbeitung ist übernommen.
    await block(wapPage, 'Wache Süd Ost').focus();
    await wapPage.keyboard.press('F2');
    await title.press('End');
    await title.pressSequentially(' 2');
    const download = wapPage.waitForEvent('download');
    await title.press('Control+s');
    expect((await download).suggestedFilename()).toMatch(/\.json$/);
    await expect(block(wapPage, 'Wache Süd Ost 2')).toHaveCount(1);
    // Spaltenname: Ctrl+P öffnet den Dialog.
    await kopf(wapPage, 'Mo 28.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Stv', exact: true })
      .focus();
    await wapPage.keyboard.press('F2');
    const name = wapPage.getByRole('textbox', { name: 'Spaltenname', exact: true });
    await expect(name).toBeFocused();
    await name.press('Control+p');
    await expect(pdf).toBeVisible();
  });

  test('[R-5.1-06][R-5.1-14] F-UX2 CR-U-2-03: schmale Rap-Spalte bei 50 % – Doppelklick im Mindest-Trefferbereich neben ihr erfasst einen Rapport (Zeiger und Wirkung gleich)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R2Rap.wap.json', planFile(planEinfach()));
    await zoom50(wapPage);
    const rap = await wapPage
      .getByRole('button', { name: 'Rap-Spalte Di', exact: true })
      .boundingBox();
    if (rap === null) throw new Error('Rap-Spalte fehlt');
    expect(rap.width).toBeLessThan(16);
    const x = rap.x - (16 - rap.width) / 2 + 1;
    const y = rap.y + 300;
    await wapPage.mouse.move(x, y);
    await expect
      .poll(() =>
        wapPage.locator('td[data-day="2026-09-29"]').evaluate((e) => getComputedStyle(e).cursor),
      )
      .toBe('cell');
    await wapPage.mouse.dblclick(x, y);
    await expect(
      wapPage.getByRole('group', { name: 'Direktbearbeitung Rapport', exact: true }),
    ).toBeVisible();
    await expect(wapPage.getByRole('textbox', { name: 'Kürzel', exact: true })).toBeFocused();
  });

  test('[R-5.1-08][R-5.1-14] F-UX2 CR-U-2-04: Doppelklick 5 px unter der Oberkante eines kleinen, noch nicht gewählten Blocks bearbeitet (Zeiger «grab»), statt aufzufüllen', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R2Klein.wap.json', planFile(planDicht()));
    await zoom50(wapPage);
    // Ein 45-Minuten-Block (bei 50 % 18 px hoch): Kante ungewählt 4 px, gewählt 6 px.
    const kandidat = wapPage.getByRole('button', { name: /^Block \S.* (\d{4})-(\d{4}) · Mo$/ });
    const namen = await kandidat.evaluateAll((els) =>
      els.map((e) => e.getAttribute('aria-label') ?? ''),
    );
    const ziel = namen.find((n) => {
      const m = / (\d{2})(\d{2})-(\d{2})(\d{2}) /.exec(n);
      if (m === null) return false;
      const d = Number(m[3]) * 60 + Number(m[4]) - (Number(m[1]) * 60 + Number(m[2]));
      return d === 45 && Number(m[1]) >= 7 && Number(m[1]) < 11;
    });
    if (ziel === undefined) throw new Error('45-Minuten-Block fehlt');
    const b = await wapPage
      .getByRole('button', { name: ziel, exact: true })
      .locator('xpath=..')
      .boundingBox();
    if (b === null) throw new Error('Fläche fehlt');
    expect(b.height).toBeGreaterThan(16);
    expect(b.height).toBeLessThan(20);
    const x = b.x + b.width / 2;
    const y = b.y + 5;
    await wapPage.mouse.move(x, y);
    await expect
      .poll(() =>
        wapPage.locator('td[data-day="2026-09-28"]').evaluate((e) => getComputedStyle(e).cursor),
      )
      .toBe('grab');
    await wapPage.mouse.dblclick(x, y);
    await expect(
      wapPage.getByRole('group', { name: 'Direktbearbeitung Block', exact: true }),
    ).toBeVisible();
    await wapPage.keyboard.press('Escape');
    await expect(wapPage.getByRole('button', { name: ziel, exact: true })).toHaveCount(1);
  });

  test('[R-5-01] F-UX2 CR-U-2-05: Rand der einfachen Blockdarstellung auf ganze Gerätepixel bei 50 %, 100 % und 200 %', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R2Rand.wap.json', planFile(planEinfach()));
    const randstaerken = () =>
      wapPage.evaluate(() => {
        const dpr = window.devicePixelRatio || 1;
        return [...document.querySelectorAll<HTMLElement>('.i2-grid-entry[data-flaeche]')]
          .map((e) => e.style.boxShadow.match(/-?[\d.]+px/g)?.[3])
          .filter((v): v is string => v !== undefined)
          .map((v) => Number.parseFloat(v) * dpr);
      });
    for (const stufe of ['100 %', '50 %', '200 %']) {
      if (stufe === '50 %') await zoom50(wapPage);
      if (stufe === '200 %')
        for (let i = 0; i < 6; i++)
          await wapPage.getByRole('button', { name: 'Vergrössern', exact: true }).click();
      const r = await randstaerken();
      expect(r.length, stufe).toBeGreaterThan(2);
      for (const v of r)
        expect(Math.abs(v - Math.round(v)), `${stufe}: ${String(v)}`).toBeLessThan(0.001);
      for (const v of r) expect(v).toBeGreaterThanOrEqual(1);
    }
  });

  test('[R-5.1-14] F-UX2 CR-U-2-07: Hervorhebung folgt nach Auffüllen per Tastatur und nach Zoom dem Eintrag unter dem ruhenden Zeiger', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R2Hover.wap.json', planFile(planEinfach()));
    const nord = await block(wapPage, 'Wache Nord').locator('xpath=..').boundingBox();
    if (nord === null) throw new Error('Fläche fehlt');
    const px = nord.x + nord.width / 2;
    const py = nord.y + nord.height / 2;
    await wapPage.mouse.move(px, py);
    const hover = wapPage.locator('.i2-grid-hover');
    await expect(hover).toBeVisible();
    /** Hervorhebung = Fläche des Eintrags unter dem Zeiger (±1 px), sonst ausgeblendet. */
    const passt = () =>
      wapPage.evaluate(
        ([x, y]) => {
          const h = document.querySelector<HTMLElement>('.i2-grid-hover');
          const entry = document
            .elementsFromPoint(x ?? 0, y ?? 0)
            .map((e) => e.closest('.i2-grid-entry'))
            .find((e) => e !== null);
          if (h === null) return false;
          if (entry === undefined || entry === null) return h.style.display === 'none';
          const a = h.getBoundingClientRect();
          const b = entry.getBoundingClientRect();
          return (
            h.style.display === 'block' &&
            Math.abs(a.top - b.top) <= 1 &&
            Math.abs(a.height - b.height) <= 1 &&
            Math.abs(a.width - b.width) <= 1
          );
        },
        [px, py],
      );
    await block(wapPage, 'Wache Nord').focus();
    await wapPage.keyboard.press('Control+Shift+ArrowDown');
    await expect(block(wapPage, 'Wache Nord')).toHaveAccessibleName(/0800-1100/);
    await expect.poll(passt).toBe(true);
    await wapPage.keyboard.press('+');
    await expect(wapPage.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText(
      '125 %',
    );
    await expect.poll(passt).toBe(true);
  });

  test('[R-5.1-09] F-UX2 CR-U-2-08/-09: leeres Feld zeigt eine Schreibmarke (Feldanzeige); Enter während einer IME-Komposition schliesst die Bearbeitung nicht', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R2Leer.wap.json', planFile(planEinfach()));
    await block(wapPage, 'Wache Nord').focus();
    await wapPage.keyboard.press('F2');
    await wapPage.keyboard.press('Tab');
    const zusatz = wapPage.getByRole('textbox', { name: 'Zusatz', exact: true });
    await expect(zusatz).toBeFocused();
    const editor = wapPage.getByRole('group', { name: 'Direktbearbeitung Block', exact: true });
    await expect(
      editor.locator('.i2-grid-inline-caret, .i2-grid-inline-valuecaret').first(),
    ).toBeVisible();
    // Enter mit isComposing (IME) wirkt nicht; danach ohne Komposition übernimmt Enter.
    await zusatz.evaluate((el) =>
      el.dispatchEvent(
        new KeyboardEvent('keydown', {
          key: 'Enter',
          bubbles: true,
          cancelable: true,
          isComposing: true,
        }),
      ),
    );
    await expect(editor).toBeVisible();
    await expect(zusatz).toBeFocused();
    await zusatz.press('Enter');
    await expect(editor).toHaveCount(0);
  });

  test('[R-11-07] F-UX2 CR-U-2-06: die Kürzelübersicht nennt Auffüllen, Spaltenkopf-Tasten, Doppelklick auf die Kante und Ctrl+Z in der Bearbeitung', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R2Kuerzel.wap.json', planFile(planEinfach()));
    await wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true }).click();
    const help = wapPage.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true });
    await expect(help).toBeVisible();
    for (const text of [
      'Ctrl+Shift+↑ / Ctrl+Shift+↓',
      'Spaltenkopf: Einfg / Shift+Einfg / Entf',
      'Doppelklick auf die obere / untere Blockkante',
      'Ctrl+Z / Ctrl+Y in der Titelbearbeitung',
    ])
      await expect(help.getByText(text, { exact: true })).toBeVisible();
  });
}
