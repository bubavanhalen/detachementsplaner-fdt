// F-UX2 Runde 3 (ux-critic Runde 2, 20.10.2026, Stand 5da6891; Bericht lokal unter .qa/haertung/ux-critic-2.md):
// UX-2-01 Route-Kürzel in der Direktbearbeitung (Ctrl+K, Ctrl+.), -02 zweispaltiger Block auf die schmale Det-Spalte am
// Tagesrand, -03 seitlich verbreitern bei 50 % (Maus aussen an der Kante, Shift+→/←), -05 Klick in den eigenen Block
// ausserhalb des Textes, -06 Spalte für alle Tage einfügen ohne zweite Rückfrage, -07 Pfeil am P1-Block, -09 Ctrl+Z nach
// gesetztem Stand, -10 erster getippter Buchstabe als Rückgängig-Schritt, UX-H-N2 Guillemets. Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan, Week } from '../../../../src/model/wap/types';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planDetRand, planEinfach } from './plaene';

function kopf(page: Page, tag: string): Locator {
  return page.locator('th.i2-grid-day-head').filter({ hasText: tag });
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

async function kopfBox(page: Page, tag: string, spalte: string) {
  const b = await kopf(page, tag)
    .getByRole('button', { name: `Spaltenkopf ${spalte}`, exact: true })
    .locator('xpath=..')
    .boundingBox();
  if (b === null) throw new Error('Kopf fehlt');
  return b;
}

async function aktiv(page: Page): Promise<string> {
  return page.evaluate(() => {
    const a = document.activeElement;
    return a === null ? '' : `${a.tagName}|${a.getAttribute('aria-label') ?? a.textContent ?? ''}`;
  });
}

export function registerRunde3Tests(url: () => string): void {
  test('[R-11-07] F-UX2 UX-2-01: Ctrl+K und Ctrl+. in der Direktbearbeitung übernehmen und öffnen Palette bzw. Befundliste', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Kuerzel.wap.json', planFile(planEinfach()));
    await block(wapPage, 'Wache Süd').focus();
    await wapPage.keyboard.press('F2');
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await title.press('End');
    await title.pressSequentially(' K');
    await title.press('Control+k');
    const palette = wapPage.getByRole('dialog', { name: 'Befehle des WAP-Planers', exact: true });
    await expect(palette).toBeVisible();
    await expect(block(wapPage, 'Wache Süd K')).toHaveCount(1);
    await wapPage.keyboard.press('Escape');
    await block(wapPage, 'Wache Süd K').focus();
    await wapPage.keyboard.press('F2');
    await title.press('Control+.');
    await expect(
      wapPage.getByRole('button', { name: 'Befundliste schliessen', exact: true }),
    ).toBeVisible();
  });

  test('[R-5.1-14] F-UX2 UX-2-02: zweispaltiger Block auf die schmale Det-Spalte am Tagesrand – Vorschau und Ablage enden an der letzten Planungsspalte (Trp+Det), kein stilles Zurückfedern', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Det.wap.json', planFile(planDetRand()));
    const b = await fläche(block(wapPage, 'Zweispalter'));
    const det = await kopfBox(wapPage, 'Mo 28.09.2026', 'Det');
    const trp = await kopfBox(wapPage, 'Mo 28.09.2026', 'Trp');
    const start = { x: b.x + b.width / 4, y: b.y + b.height / 2 };
    await wapPage.mouse.move(start.x, start.y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(det.x + det.width / 2, start.y, { steps: 8 });
    await expect(
      wapPage.getByRole('status', { name: 'Zeiten beim Ziehen', exact: true }),
    ).toContainText('Trp–Det');
    await wapPage.mouse.up();
    await expect
      .poll(async () => {
        const n = await fläche(block(wapPage, 'Zweispalter'));
        return Math.abs(n.x - trp.x) < 2 && Math.abs(n.x + n.width - (det.x + det.width)) < 2;
      })
      .toBe(true);
    await expect(block(wapPage, 'Zweispalter')).toHaveAccessibleName(/0800-1000/);
  });

  test('[R-5.1-14] F-UX2 UX-2-03: bei 50 % gewählten schmalen Block aussen an der rechten Kante verbreitern; Shift+→/Shift+← ändern die Spaltenspanne', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Breit.wap.json', planFile(planDetRand()));
    const k = wapPage.getByRole('button', { name: 'Verkleinern', exact: true });
    await k.click();
    await k.click();
    await expect(wapPage.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText(
      '50 %',
    );
    const vorher = await fläche(block(wapPage, 'Schmal'));
    expect(vorher.width).toBeLessThan(24);
    await wapPage.mouse.click(vorher.x + vorher.width / 2, vorher.y + vorher.height / 2);
    await expect(block(wapPage, 'Schmal')).toHaveAttribute('aria-pressed', 'true');
    const x = vorher.x + vorher.width + 2;
    const y = vorher.y + vorher.height / 2;
    await wapPage.mouse.move(x, y);
    await expect
      .poll(() =>
        wapPage.locator('td[data-day="2026-09-28"]').evaluate((e) => getComputedStyle(e).cursor),
      )
      .toBe('ew-resize');
    await wapPage.mouse.down();
    // In die Mitte der Nachbarspalte: zwei Spalten.
    await wapPage.mouse.move(x + vorher.width / 2, y, { steps: 6 });
    await wapPage.mouse.up();
    await expect
      .poll(async () => (await fläche(block(wapPage, 'Schmal'))).width)
      .toBeGreaterThan(vorher.width * 1.6);
    expect((await fläche(block(wapPage, 'Schmal'))).width).toBeLessThan(vorher.width * 2.4);
    expect(Math.abs((await fläche(block(wapPage, 'Schmal'))).x - vorher.x)).toBeLessThan(1.5);
    // Tastatur: Shift+← verkleinert auf eine Spalte, Shift+→ verbreitert wieder.
    await block(wapPage, 'Schmal').focus();
    await wapPage.keyboard.press('Shift+ArrowLeft');
    await expect
      .poll(async () => (await fläche(block(wapPage, 'Schmal'))).width)
      .toBeLessThan(vorher.width + 1.5);
    await wapPage.keyboard.press('Shift+ArrowRight');
    await expect
      .poll(async () => (await fläche(block(wapPage, 'Schmal'))).width)
      .toBeGreaterThan(vorher.width * 1.6);
    await expect(block(wapPage, 'Schmal')).toBeFocused();
  });

  test('[R-5.1-08] F-UX2 UX-2-05: Klick in den eigenen Block neben den Text setzt die Schreibmarke ans Ende, die Bearbeitung bleibt offen', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Klick.wap.json', planFile(planDetRand()));
    const b = await fläche(block(wapPage, 'Zweispalter'));
    await block(wapPage, 'Zweispalter').focus();
    await wapPage.keyboard.press('F2');
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await title.press('Home');
    // Neben den (hier gedrehten) Text, ausserhalb der Kanten oben/unten.
    await wapPage.mouse.click(b.x + 6, b.y + b.height / 2);
    await expect(
      wapPage.getByRole('group', { name: 'Direktbearbeitung Block', exact: true }),
    ).toBeVisible();
    await expect(title).toBeFocused();
    expect(await title.evaluate((i) => (i as HTMLInputElement).selectionStart)).toBe(
      'Zweispalter'.length,
    );
  });

  test('[R-5.2-08][R-11-07] F-UX2 UX-2-06: Spalte für alle Tage einfügen und benennen ohne zweite Rückfrage; Anfangsfokus «Nur dieser Tag», danach Fokus auf dem neuen Kopf', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Einf.wap.json', planFile(planEinfach()));
    await kopf(wapPage, 'Mo 28.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Stv', exact: true })
      .focus();
    await wapPage.keyboard.press('Insert');
    const frage = wapPage.getByRole('dialog', { name: 'Spalte rechts einfügen', exact: true });
    await expect(frage.getByRole('button', { name: 'Nur dieser Tag', exact: true })).toBeFocused();
    await frage
      .getByRole('button', { name: 'Alle Tage mit diesem Spaltensatz', exact: true })
      .click();
    const name = wapPage.getByRole('textbox', { name: 'Spaltenname', exact: true });
    await expect(name).toBeFocused();
    await name.fill('Zug 9');
    await name.press('Enter');
    await expect(wapPage.getByRole('dialog')).toHaveCount(0);
    await expect.poll(() => aktiv(wapPage)).toBe('BUTTON|Spaltenkopf Zug 9');
    await expect(
      kopf(wapPage, 'Di 29.09.2026').getByRole('button', {
        name: 'Spaltenkopf Zug 9',
        exact: true,
      }),
    ).toHaveCount(1);
  });

  test('[R-5.2-09][R-11-07] F-UX2 UX-2-07: Pfeil am P1-Block setzt ihn in die nächstgelegene vorhandene Spalte (Befund weg)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3P1.wap.json', planFile(planDetRand()));
    await kopf(wapPage, 'Mo 28.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Zfhr', exact: true })
      .focus();
    await wapPage.keyboard.press('Delete');
    await wapPage
      .getByRole('dialog', { name: 'Spalte «Zfhr» entfernen', exact: true })
      .getByRole('button', { name: 'Nur dieser Tag', exact: true })
      .click();
    const p1 = block(wapPage, 'Verwaist').locator('xpath=..');
    await expect(p1).toHaveClass(/i2-grid-p1/);
    await block(wapPage, 'Verwaist').focus();
    await wapPage.keyboard.press('ArrowRight');
    await expect(p1).not.toHaveClass(/i2-grid-p1/);
    await expect(block(wapPage, 'Verwaist')).toBeFocused();
    await expect(block(wapPage, 'Verwaist')).toHaveAccessibleName(/1300-1400 · Mo/);
  });

  test('[R-5.6-14][R-5.7-03] F-UX2 UX-2-09: Ctrl+Z nach gesetztem Stand meldet den Grund und den nächsten Schritt; Knopf «Rückgängig» nennt den Grund', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Stand.wap.json', planFile(planEinfach()));
    await wapPage.getByRole('button', { name: 'Neuen Stand setzen …', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Neuen Stand setzen', exact: true });
    await dialog.getByRole('button', { name: 'Stand setzen', exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(wapPage.locator('dialog[open]')).toHaveCount(0);
    await expect(wapPage.getByRole('button', { name: 'Rückgängig', exact: true })).toBeDisabled();
    await block(wapPage, 'Wache Süd').focus();
    await wapPage.keyboard.press('Control+z');
    // Seit 8f129fd: Meldung mit Ursache und nächstem Schritt (Speicher F-UX1); hier belegt.
    await expect(wapPage.getByRole('alert')).toContainText(
      'Ein gesetzter Stand lässt sich nicht rückgängig machen',
    );
    await expect(wapPage.getByRole('alert')).toContainText('Wiederherstellungspunkte');
    await expect(wapPage.getByRole('button', { name: 'Rückgängig', exact: true })).toHaveAttribute(
      'title',
      /Stand.*Wiederherstellungspunkte/,
    );
  });

  test('[R-5.1-03][R-5.1-11] F-UX2 UX-2-10: Erfassen per Tippen am Zellzeiger – Ctrl+Z nimmt auch den ersten Buchstaben zurück', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Tipp.wap.json', planFile(planEinfach()));
    await wapPage.locator('.i2-grid-cursor').focus();
    await wapPage.keyboard.type('Ausbildung');
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toHaveValue('Ausbildung');
    await title.press('Control+z');
    await expect(title).toHaveValue('');
    await expect(title).toBeFocused();
  });

  test('[R-5.6-13] F-UX2 UX-H-N2: Dialog «Plan-Datei öffnen» nennt den Plannamen mit einfachen Guillemets', async ({
    wapPage,
  }) => {
    const bytes = planFile(planEinfach());
    await startWith(wapPage, `${url()}#leer`, 'R3Name.wap.json', bytes);
    await block(wapPage, 'Nachbar').focus();
    await wapPage.keyboard.press('Delete');
    await expect(block(wapPage, 'Nachbar')).toHaveCount(0);
    const chooser = wapPage.waitForEvent('filechooser');
    await wapPage.getByRole('button', { name: 'Plan-Datei öffnen', exact: true }).click();
    await (await chooser).setFiles({
      name: 'R3Name.wap.json',
      mimeType: 'application/json',
      buffer: bytes,
    });
    const ask = wapPage.getByRole('dialog', { name: /^Plan (als Kopie öffnen|-Datei öffnen)$/ });
    await expect(ask).toContainText('auf diesem Gerät');
    const text = (await ask.textContent()) ?? '';
    expect(text).not.toContain('««');
    expect(text).not.toContain('»»');
    expect(text).toMatch(/«[^«»]+» auf diesem Gerät/);
  });

  test('[R-5.1-08] F-UX2 UX-2-14: Feldanzeige zeigt den Wert nur, wenn er im Block nicht ganz steht', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Feld.wap.json', planFile(planEinfach()));
    await block(wapPage, 'Wache Süd').focus();
    await wapPage.keyboard.press('F2');
    await wapPage.keyboard.press('Tab');
    await wapPage.keyboard.press('Tab');
    await wapPage.keyboard.type('Zfhr');
    await wapPage.keyboard.press('Tab');
    await wapPage.keyboard.type('Schiessplatz Nord');
    const card = wapPage.locator('.i2-grid-inline-card');
    await expect(card).toContainText('Ort');
    const drawn = await wapPage.locator('.i2-grid-editing').evaluate((e) => {
      const entry = [...document.querySelectorAll('.i2-grid-entry')].find((b) => {
        const r = b.getBoundingClientRect();
        const q = e.getBoundingClientRect();
        return Math.abs(r.left - q.left) < 2 && Math.abs(r.top - q.top) < 2;
      });
      return (entry?.textContent ?? '').replace(/-\s*/g, '').replace(/\s+/g, ' ');
    });
    expect(drawn.replace(/\s/g, '')).toContain('SchiessplatzNord');
    await expect(card.locator('.i2-grid-inline-value')).toHaveCount(0);
  });

  test('[R-5.7-02] F-UX2 UX-2-13: Tag ohne Spaltensatz – Hinweis im Spaltenkopf, nicht im Raster', async ({
    wapPage,
  }) => {
    const plan = planEinfach();
    const ohne: Plan = {
      ...plan,
      weeks: plan.weeks.map((w, i) =>
        i === 0
          ? {
              ...w,
              days: w.days.map((d, k) =>
                k === 1 ? { ...d, columnSetId: null } : d,
              ) as unknown as Week['days'],
            }
          : w,
      ),
    };
    await startWith(wapPage, `${url()}#leer`, 'R3Ohne.wap.json', planFile(ohne));
    const di = kopf(wapPage, 'Di 29.09.2026');
    await expect(di).toContainText('Kein Spaltensatz');
    await expect(wapPage.locator('td[data-day="2026-09-29"]')).not.toContainText(
      'Kein Spaltensatz',
    );
  });

  test('[R-5.2-09][R-11-07] F-UX2 UX-H-12 (SA-20): Spalte entfernen und P1 per Tastatur beheben – Entf, Enter, Ctrl+., Enter, → (Befundliste mit Fokus auf der ersten Meldung)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R3Sa20.wap.json', planFile(planDetRand()));
    await kopf(wapPage, 'Mo 28.09.2026')
      .getByRole('button', { name: 'Spaltenkopf Zfhr', exact: true })
      .focus();
    await wapPage.keyboard.press('Delete');
    await expect(
      wapPage
        .getByRole('dialog', { name: 'Spalte «Zfhr» entfernen', exact: true })
        .getByRole('button', { name: 'Nur dieser Tag', exact: true }),
    ).toBeFocused();
    await wapPage.keyboard.press('Enter');
    await expect(wapPage.getByRole('dialog')).toHaveCount(0);
    const p1 = block(wapPage, 'Verwaist').locator('xpath=..');
    await expect(p1).toHaveClass(/i2-grid-p1/);
    await wapPage.keyboard.press('Control+.');
    await expect(wapPage.locator(':focus')).toHaveAttribute('aria-label', /^Zur Stelle: P1 /);
    await wapPage.keyboard.press('Enter');
    await expect(block(wapPage, 'Verwaist')).toBeFocused();
    await wapPage.keyboard.press('ArrowRight');
    await expect(p1).not.toHaveClass(/i2-grid-p1/);
  });
}
