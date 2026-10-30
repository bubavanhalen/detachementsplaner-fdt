// I2b-B «Tastatur, Mehrfachauswahl, Feinschliff» (B1–B8): Abläufe über Rolle und Name, nur fiktive Daten.
// B1 zählt die Tastaturaktionen gegen die Soll-Werte aus docs/wap-planer/standardaufgaben.md (Zählregeln dort).
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import { parsePlanFile } from '../../../../src/io/wap-plan/planFile';
import { createPlan } from '../../i2/support/ablauf';
import { area, block, box, drawBlock, MINUTE } from '../../i2b/support/handhabung';
import { test } from '../../support/fixtures';

/** Soll nur Tastatur (standardaufgaben.md): SA-03 16, SA-14 7, SA-06 7, SA-11 2. */
export const SOLL = { erfassen: 16, verschieben: 7, spalte: 7, groesse: 7, loeschen: 2 } as const;

/** Zählt Tastaturaktionen nach den Zählregeln: Tastendruck oder Kombination = 1, zusammenhängende Eingabe = 1. */
export function counter(page: Page) {
  let n = 0;
  return {
    async press(key: string, times = 1) {
      for (let i = 0; i < times; i++) {
        await page.keyboard.press(key);
        n++;
      }
    },
    async type(text: string) {
      await page.keyboard.type(text);
      n++;
    },
    take(): number {
      const v = n;
      n = 0;
      return v;
    },
  };
}

export function cursor(page: Page): Locator {
  return page.getByRole('table', { name: 'Wochenraster', exact: true }).locator('.i2-grid-cursor');
}

/** Elemente im Raster, die Tab erreicht (ein Tab-Stopp, B1). */
async function tabStops(page: Page): Promise<number> {
  return page.evaluate(() => {
    const grid = document.querySelector('table.i2-grid');
    if (grid === null) return -1;
    return [...grid.querySelectorAll<HTMLElement>('button, input, select, [tabindex]')].filter(
      (e) => e.tabIndex >= 0 && !(e as HTMLButtonElement).disabled,
    ).length;
  });
}

async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const a = document.activeElement;
    return a === null || a === document.body ? 'BODY' : (a.getAttribute('aria-label') ?? a.tagName);
  });
}

export function registerI2cTests(url: () => string): void {
  let consoleMessages: string[] = [];
  test.beforeEach(({ wapPage }) => {
    consoleMessages = [];
    wapPage.on('console', (message) => {
      const source = message.location().url;
      const vite = message.type() === 'debug' && /\/@vite\/client(?:\?|$)/.test(source);
      const react =
        message.type() === 'info' &&
        source.startsWith('http://127.0.0.1:') &&
        /React DevTools/.test(message.text());
      if (!vite && !react) consoleMessages.push(message.type());
    });
  });
  test.afterEach(() => {
    expect(consoleMessages, 'Die App schreibt keine Konsolenmeldungen.').toEqual([]);
  });

  test('[R-5.1-02][R-5.1-03][R-5.1-14] I2b-B B1: Raster mit einem Tab-Stopp und Zellzeiger; rein per Tastatur erfassen, verschieben, Spalte, Dauer, löschen – Aktionen höchstens Soll', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Tastatur Übungsplan');
    const c = cursor(wapPage);
    // Nach dem Anlegen liegt der Fokus im Raster (UI-Richtlinie 13.4): Mo, erste Planungsspalte, 0800.
    await expect(c).toBeFocused();
    await expect(c).toHaveAccessibleName('Mo 28.09. 0800 Kp Kdt, leer');
    expect(await tabStops(wapPage), 'Das Raster ist ein einziger Tab-Stopp.').toBe(1);
    const k = counter(wapPage);
    // Navigation: Bild↓ eine Stunde, Pos1/Ende, Ctrl+→ nächster Tag, ↑ aus der ersten Zeile zum Spaltenkopf.
    await k.press('PageDown');
    await expect(c).toHaveAccessibleName(/^Mo 28\.09\. 0900 Kp Kdt/);
    await k.press('End');
    await expect(c).toHaveAccessibleName(/^Mo 28\.09\. 2345 Kp Kdt/);
    await k.press('Home');
    await expect(c).toHaveAccessibleName(/^Mo 28\.09\. 0400 Kp Kdt/);
    await k.press('ArrowUp');
    await expect(wapPage.getByRole('button', { name: 'Spaltenkopf Kp Kdt' }).first()).toBeFocused();
    await k.press('ArrowDown');
    await expect(c).toBeFocused();
    await k.press('Control+ArrowRight');
    await expect(c).toHaveAccessibleName(/^Di 29\.09\. 0400 Kp Kdt/);
    await k.press('Control+ArrowLeft');
    await k.press('PageDown', 4);
    await expect(c).toHaveAccessibleName('Mo 28.09. 0800 Kp Kdt, leer');
    k.take();

    // F3 Block erfassen Mo 0900-1000 «Stv» (Soll SA-03: 16).
    await k.press('ArrowRight');
    await k.press('ArrowDown', 4);
    await k.press('Shift+ArrowDown', 3);
    await expect(c).toHaveAccessibleName('Mo 28.09. 0900-1000 Stv, Bereich');
    await k.press('Enter');
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toBeFocused();
    await k.type('Material vorbereiten');
    await k.press('Enter');
    const created = block(wapPage, 'Material vorbereiten');
    await expect(created).toHaveAccessibleName('Block Material vorbereiten 0900-1000 · Mo');
    await expect(created).toBeFocused();
    const erfassen = k.take();
    expect(erfassen).toBeLessThanOrEqual(SOLL.erfassen);

    // F5 auf Di 1100 verschieben: T (Tag) ↓, Tab zum Beginn, «1100», Enter (Soll SA-14: 7).
    await k.press('t');
    await expect(wapPage.getByRole('combobox', { name: 'Tag', exact: true })).toBeFocused();
    await k.press('ArrowDown');
    await k.press('Tab');
    await expect(wapPage.getByRole('textbox', { name: 'Beginn', exact: true })).toBeFocused();
    await k.type('1100');
    await k.press('Enter');
    await expect(created).toHaveAccessibleName('Block Material vorbereiten 1100-1200 · Di');
    await expect(created).toBeFocused();
    const verschieben = k.take();
    expect(verschieben).toBeLessThanOrEqual(SOLL.verschieben);

    // F6 andere Spalte: → verschiebt um eine Spalte (Soll 7).
    const before = await box(created);
    await k.press('ArrowRight');
    await expect
      .poll(async () => (await box(created)).x, { message: 'Eine Spalte nach rechts' })
      .toBeGreaterThan(before.x + 10);
    await expect(created).toBeFocused();
    const spalte = k.take();
    expect(spalte).toBeLessThanOrEqual(SOLL.spalte);

    // F7 Dauer auf 1100-1230: Shift+↓ zweimal (Soll SA-06: 7).
    await k.press('Shift+ArrowDown', 2);
    await expect(created).toHaveAccessibleName('Block Material vorbereiten 1100-1230 · Di');
    const groesse = k.take();
    expect(groesse).toBeLessThanOrEqual(SOLL.groesse);

    // Pfeile verschieben um 15 Min; Bild↓ um eine Stunde; Esc hebt die Auswahl auf, Zellzeiger an der Stelle.
    await wapPage.keyboard.press('ArrowDown');
    await expect(created).toHaveAccessibleName('Block Material vorbereiten 1115-1245 · Di');
    await wapPage.keyboard.press('ArrowUp');
    await wapPage.keyboard.press('Escape');
    await expect(created).toHaveAttribute('aria-pressed', 'false');
    await expect(c).toBeFocused();
    await expect(c).toHaveAccessibleName(
      /^Di 29\.09\. 1100 Zfhr, Block Material vorbereiten 1100-1230$/,
    );
    // Tab springt zum nächsten Eintrag, Enter auf belegter Zelle wählt ihn.
    await wapPage.keyboard.press('Home');
    await wapPage.keyboard.press('Tab');
    await expect(created).toBeFocused();
    await wapPage.keyboard.press('Escape');
    await wapPage.keyboard.press('Enter');
    await expect(created).toBeFocused();
    expect(await tabStops(wapPage)).toBe(1);

    // F8 Löschen (Soll SA-11: 2); der Fokus geht nie auf body.
    await k.press('Delete');
    await expect(created).toHaveCount(0);
    expect(k.take()).toBeLessThanOrEqual(SOLL.loeschen);
    await expect.poll(() => focusedName(wapPage)).not.toBe('BODY');
    await expect(c).toBeFocused();
    test.info().annotations.push({
      type: 'Tastatur-Aktionen (Ist/Soll)',
      description: `F3 ${erfassen}/${SOLL.erfassen} · F5 ${verschieben}/${SOLL.verschieben} · F6 ${spalte}/${SOLL.spalte} · F7 ${groesse}/${SOLL.groesse} · F8 1/${SOLL.loeschen}`,
    });
  });

  test('[R-5.1-03][R-5.1-08][R-5.1-10] I2b-B B1: Tippen am Zellzeiger erfasst, Ctrl+D dupliziert anschliessend, Shift+↑ verkürzt, Ctrl+Pfeil fokussiert den Nachbarn', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Tippen Übungsplan');
    const c = cursor(wapPage);
    await expect(c).toBeFocused();
    await wapPage.keyboard.type('Appell');
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toHaveValue(
      'Appell',
    );
    await wapPage.keyboard.press('Enter');
    const appell = block(wapPage, 'Appell');
    await expect(appell).toHaveAccessibleName('Block Appell 0800-0815 · Mo');
    await wapPage.keyboard.press('Shift+ArrowDown');
    await wapPage.keyboard.press('Shift+ArrowDown');
    await wapPage.keyboard.press('Shift+ArrowUp');
    await expect(appell).toHaveAccessibleName('Block Appell 0800-0830 · Mo');
    await wapPage.keyboard.press('Control+d');
    const copies = wapPage.getByRole('button', { name: /^Block Appell / });
    await expect(copies).toHaveCount(2);
    await expect(
      wapPage.getByRole('button', { name: 'Block Appell 0830-0900 · Mo' }),
    ).toBeFocused();
    await wapPage.keyboard.press('Control+ArrowUp');
    await expect(appell.first()).toBeFocused();
    await expect(
      wapPage.getByRole('button', { name: 'Block Appell 0830-0900 · Mo' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await wapPage.keyboard.press('Control+z');
    await expect(copies).toHaveCount(1);
  });

  test('[R-5.1-14][R-5.1-16] I2b-B B2: Shift-Rahmen, Ctrl- und Shift-Klick, Ctrl+A; gemeinsam verschieben (Maus und Pfeile), Kategorie ändern, löschen – je ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Auswahl Übungsplan');
    await drawBlock(wapPage, 'Eins', 480, 540);
    await drawBlock(wapPage, 'Zwei', 600, 660);
    await drawBlock(wapPage, 'Drei', 720, 780);
    await drawBlock(wapPage, 'Nachbar', 900, 960);
    // Normales Ziehen auf leerer Fläche erzeugt weiterhin einen Block; Shift-Ziehen zieht einen Rahmen.
    const a = await box(area(wapPage, 'Mo', 0));
    await wapPage.keyboard.down('Shift');
    await wapPage.mouse.move(a.x + 3, a.y + (460 - 240) * MINUTE);
    await wapPage.mouse.down();
    await wapPage.mouse.move(a.x + a.width - 3, a.y + (700 - 240) * MINUTE, { steps: 6 });
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Shift');
    await expect(block(wapPage, 'Eins')).toHaveAttribute('aria-pressed', 'true');
    await expect(block(wapPage, 'Zwei')).toHaveAttribute('aria-pressed', 'true');
    await expect(block(wapPage, 'Drei')).toHaveAttribute('aria-pressed', 'false');
    await expect(wapPage.locator('.i2-grid-count')).toHaveText('2 Einträge gewählt');
    // Ctrl-Klick nimmt auf; gemeinsam per Maus um eine Stunde verschieben.
    await block(wapPage, 'Drei').click({ modifiers: ['Control'] });
    await expect(block(wapPage, 'Drei')).toHaveAttribute('aria-pressed', 'true');
    const zwei = await box(block(wapPage, 'Zwei'));
    await wapPage.mouse.move(zwei.x + zwei.width / 2, zwei.y + zwei.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(zwei.x + zwei.width / 2, zwei.y + zwei.height / 2 + 60 * MINUTE, {
      steps: 8,
    });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Eins')).toHaveAccessibleName(/0900-1000/);
    await expect(block(wapPage, 'Zwei')).toHaveAccessibleName(/1100-1200/);
    await expect(block(wapPage, 'Drei')).toHaveAccessibleName(/1300-1400/);
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      '3 Einträge verschoben',
    );
    // Pfeile verschieben die Auswahl gemeinsam; Variante c kürzt den überdeckten Nachbarn ausserhalb.
    await expect(block(wapPage, 'Zwei')).toBeFocused();
    await wapPage.keyboard.press('PageDown');
    await expect(block(wapPage, 'Drei')).toHaveAccessibleName(/1400-1500/);
    await wapPage.keyboard.press('ArrowDown');
    await wapPage.keyboard.press('ArrowDown');
    await expect(block(wapPage, 'Drei')).toHaveAccessibleName(/1430-1530/);
    await expect(block(wapPage, 'Eins')).toHaveAccessibleName(/1030-1130/);
    await expect(
      block(wapPage, 'Nachbar'),
      'Variante c kürzt den Nachbarn ausserhalb der Auswahl',
    ).toHaveAccessibleName(/1530-1600/);
    // Ein Undo-Schritt je Taste: zurück auf den Stand nach dem ersten Pfeil.
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(block(wapPage, 'Nachbar')).toHaveAccessibleName(/1515-1600/);
    await expect(block(wapPage, 'Drei')).toHaveAccessibleName(/1415-1515/);
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(block(wapPage, 'Drei')).toHaveAccessibleName(/1300-1400/);
    // Kategorie der ganzen Auswahl (ein Undo-Schritt).
    await block(wapPage, 'Eins').click();
    await block(wapPage, 'Drei').click({ modifiers: ['Shift'] });
    await expect(block(wapPage, 'Zwei')).toHaveAttribute('aria-pressed', 'true');
    const category = wapPage.getByRole('combobox', { name: 'Kategorie', exact: true });
    await category.selectOption({ label: 'Extern' });
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      '3 Einträge: Kategorie «Extern»',
    );
    await expect(category).toHaveValue(
      (await category.locator('option', { hasText: 'Extern' }).getAttribute('value')) ?? '',
    );
    await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
    await expect(category).not.toHaveValue(
      (await category.locator('option', { hasText: 'Extern' }).getAttribute('value')) ?? '',
    );
    // Ctrl+A: alle Einträge des Tages, zweimal: der Woche; Entf löscht alle in einem Schritt.
    await block(wapPage, 'Eins').focus();
    await wapPage.keyboard.press('Control+a');
    await expect(wapPage.locator('.i2-grid-count')).toHaveText('4 Einträge gewählt');
    await wapPage.keyboard.press('Delete');
    await expect(wapPage.locator('.i2-grid-entry-hit')).toHaveCount(0);
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      '4 Einträge gelöscht',
    );
    await wapPage.getByRole('button', { name: 'Löschen rückgängig machen' }).click();
    await expect(wapPage.locator('.i2-grid-entry-hit')).toHaveCount(4);
    await expect.poll(() => focusedName(wapPage)).toMatch(/^Block /);
  });

  test('[R-5.1-14] I2b-B B2: SA-13 nur Tastatur – drei Blöcke wählen und umfärben, höchstens 10 Aktionen, ein Undo-Schritt', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Umfärben Übungsplan');
    await drawBlock(wapPage, 'Eins', 480, 540);
    await drawBlock(wapPage, 'Zwei', 600, 660);
    await drawBlock(wapPage, 'Drei', 720, 780);
    await block(wapPage, 'Eins').focus();
    const k = counter(wapPage);
    // Fokus auf dem ersten Block (1), dann (Ctrl+↓, Ctrl+Leertaste) ×2, K, Wahl, Enter (UI-Richtlinie 17).
    await k.press('Control+ArrowDown');
    await k.press('Control+Space');
    await k.press('Control+ArrowDown');
    await k.press('Control+Space');
    await expect(wapPage.locator('.i2-grid-count')).toHaveText('3 Einträge gewählt');
    await k.press('k');
    const category = wapPage.getByRole('combobox', { name: 'Kategorie', exact: true });
    await expect(category).toBeFocused();
    const extern =
      (await category.locator('option', { hasText: 'Extern' }).getAttribute('value')) ?? '';
    // Wahl per Tippsuche im Auswahlfeld («e» = «Extern»).
    await k.press('e');
    await k.press('Enter');
    await expect(category).toHaveValue(extern);
    const n = k.take();
    expect(n + 1, 'SA-13 nur Tastatur: Soll 10 (Fokus 1 eingerechnet)').toBeLessThanOrEqual(10);
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      '3 Einträge: Kategorie «Extern»',
    );
    await wapPage.keyboard.press('Control+z');
    await expect(category).not.toHaveValue(extern);
    test
      .info()
      .annotations.push({ type: 'SA-13 nur Tastatur (Ist/Soll)', description: `${n + 1}/10` });
  });

  test('[R-5.1-17][R-5.1-18] I2b-B B3: Kopieren, Ausschneiden und Einfügen am Zellzeiger, auch in eine andere Woche; relative Lage bleibt; «Auch an anderen Tagen»', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Ablage Übungsplan');
    await drawBlock(wapPage, 'Morgen', 480, 540);
    await drawBlock(wapPage, 'Später', 600, 660, { column: 1 });
    await block(wapPage, 'Morgen').click();
    await block(wapPage, 'Später').click({ modifiers: ['Control'] });
    await wapPage.keyboard.press('Control+c');
    // Andere Woche: Alt+Bild↓, Zellzeiger Di 1300, Ctrl+V.
    await wapPage.keyboard.press('Escape');
    await wapPage.keyboard.press('Alt+PageDown');
    await expect(wapPage.getByRole('tab', { name: 'Wo 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    const c = cursor(wapPage);
    await expect(c).toBeFocused();
    await wapPage.keyboard.press('Control+g');
    await wapPage.getByRole('textbox', { name: 'Gehe zu', exact: true }).fill('Di 1300');
    await wapPage.keyboard.press('Enter');
    await expect(c).toHaveAccessibleName(/^Di 06\.10\. 1300 /);
    await wapPage.keyboard.press('Control+v');
    await expect(block(wapPage, 'Morgen')).toHaveAccessibleName('Block Morgen 1300-1400 · Di');
    await expect(block(wapPage, 'Später')).toHaveAccessibleName('Block Später 1500-1600 · Di');
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      '2 Einträge eingefügt',
    );
    // Spalten nach Namen: «Später» bleibt in «Stv».
    const stv = await box(area(wapPage, 'Di', 1));
    expect(Math.abs((await box(block(wapPage, 'Später'))).x - stv.x)).toBeLessThan(4);
    await wapPage.getByRole('button', { name: 'Einfügen rückgängig machen' }).click();
    await expect(block(wapPage, 'Morgen')).toHaveCount(0);
    // Ausschneiden verschiebt erst beim Einfügen (zurück in die KVK-Woche, Mi 0700).
    await wapPage.keyboard.press('Alt+PageUp');
    await block(wapPage, 'Morgen').click();
    await wapPage.keyboard.press('Control+x');
    await expect(block(wapPage, 'Morgen').locator('..')).toHaveClass(/is-cut/);
    await wapPage.keyboard.press('Control+g');
    await wapPage.getByRole('textbox', { name: 'Gehe zu', exact: true }).fill('Mi 0700');
    await wapPage.keyboard.press('Enter');
    await wapPage.keyboard.press('Control+v');
    await expect(block(wapPage, 'Morgen')).toHaveAccessibleName('Block Morgen 0700-0800 · Mi');
    await expect(wapPage.getByRole('button', { name: /^Block Morgen / })).toHaveCount(1);
    // Einfügen am Mauszeiger: zuletzt bewegt über Do 1500.
    await block(wapPage, 'Morgen').click();
    await wapPage.keyboard.press('Control+c');
    const thursday = await box(area(wapPage, 'Do', 0));
    await wapPage.mouse.move(thursday.x + 10, thursday.y + (900 - 240) * MINUTE + 2);
    await wapPage.keyboard.press('Control+v');
    await expect(
      wapPage.getByRole('button', { name: 'Block Morgen 1500-1600 · Do' }),
    ).toBeVisible();
    await wapPage.keyboard.press('Control+z');
    await expect(wapPage.getByRole('button', { name: /^Block Morgen / })).toHaveCount(1);
    // «Auch an anderen Tagen»: A, Ziffern, Enter – ein Undo-Schritt.
    await block(wapPage, 'Morgen').focus();
    await wapPage.keyboard.press('a');
    const dialog = wapPage.getByRole('dialog', { name: 'Auch an anderen Tagen', exact: true });
    await expect(dialog).toBeVisible();
    await wapPage.keyboard.press('4');
    await wapPage.keyboard.press('5');
    await wapPage.keyboard.press('Enter');
    await expect(wapPage.getByRole('button', { name: /^Block Morgen / })).toHaveCount(3);
    await expect(
      wapPage.getByRole('button', { name: 'Block Morgen 0700-0800 · Fr' }),
    ).toBeVisible();
    await wapPage.keyboard.press('Control+z');
    await expect(wapPage.getByRole('button', { name: /^Block Morgen / })).toHaveCount(1);
  });

  test('[R-5.7-05][R-11-01] I2b-B B4: Wochen als Tabs, Alt+Bild↑/↓, Ctrl+P PDF, Ctrl+S, Ctrl+O, Ctrl+G und «?» Tastenkürzel', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Kürzel Übungsplan');
    const tabs = wapPage.getByRole('tablist', { name: 'Wochen' }).getByRole('tab');
    await expect(tabs).toHaveText(['KVK', 'Wo 1', 'Wo 2', 'Wo 3']);
    await wapPage.getByRole('tab', { name: 'Wo 1' }).click();
    await expect(wapPage.getByRole('tab', { name: 'Wo 1' })).toBeFocused();
    await wapPage.keyboard.press('ArrowRight');
    await expect(wapPage.getByRole('tab', { name: 'Wo 2' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(wapPage.getByRole('tab', { name: 'Wo 2' })).toBeFocused();
    await cursor(wapPage).focus();
    await wapPage.keyboard.press('Alt+PageUp');
    await expect(wapPage.getByRole('tab', { name: 'Wo 1' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(cursor(wapPage)).toBeFocused();
    await expect(cursor(wapPage)).toHaveAccessibleName(/^Mo 05\.10\. 0800 /);
    const pdf = wapPage.waitForEvent('download');
    await wapPage.keyboard.press('Control+p');
    // TE-I5-01 entschieden (Auftraggeber 19.10.2026 «6: ja»): Ctrl+P zeigt die Befunde der Woche; ohne Befund
    // hat «Exportieren» den Fokus, Enter startet den Export.
    const pdfDialog = wapPage.getByRole('dialog', { name: 'PDF dieser Woche', exact: true });
    await expect(pdfDialog).toContainText('Keine offenen Befunde.');
    await expect(pdfDialog.getByRole('button', { name: 'Exportieren', exact: true })).toBeFocused();
    await wapPage.keyboard.press('Enter');
    const file = await pdf;
    expect(file.suggestedFilename()).toBe('WAP_Kürzel_Übungsplan_Wo1_Entwurf.pdf');
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      'PDF «WAP_Kürzel_Übungsplan_Wo1_Entwurf.pdf» erstellt',
    );
    const saved = wapPage.waitForEvent('download');
    await wapPage.keyboard.press('Control+s');
    expect((await saved).suggestedFilename()).toMatch(
      /^WAP_Kürzel_Übungsplan_Plan_\d{4}-\d{2}-\d{2}_\d{4}\.wap\.json$/,
    );
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText('gesichert');
    const chooser = wapPage.waitForEvent('filechooser');
    await wapPage.keyboard.press('Control+o');
    await chooser;
    await wapPage.keyboard.press('?');
    const help = wapPage.getByRole('dialog', { name: 'Tastenkürzel – WAP-Planer', exact: true });
    await expect(help).toBeVisible();
    await expect(help).toContainText('Alt+Bild↑ / Alt+Bild↓');
    await wapPage.keyboard.press('Escape');
    await expect(help).toHaveCount(0);
    await wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true }).click();
    await expect(help).toBeVisible();
    await wapPage.keyboard.press('Escape');
    await expect(wapPage.getByRole('button', { name: 'Tastenkürzel', exact: true })).toBeFocused();
  });

  test('[R-5.6-01][R-5.6-02][R-5.6-16] I2b-B B5: Meldungen mit Rückgängig, Fokus nie auf body, Speicheranzeige mit letzter Datei-Sicherung, Erinnerung beim Schliessen', async ({
    wapPage,
    clockAt,
  }) => {
    await clockAt('2026-10-13T09:15:00+02:00');
    await createPlan(wapPage, `${url()}#leer`, 'Meldung Übungsplan');
    await drawBlock(wapPage, 'Erster', 480, 540);
    await drawBlock(wapPage, 'Zweiter', 600, 660);
    await expect(wapPage.getByText('· letzte Datei-Sicherung noch nie')).toBeVisible();
    await block(wapPage, 'Zweiter').click();
    await wapPage.keyboard.press('Delete');
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      '«Zweiter» gelöscht',
    );
    await expect(block(wapPage, 'Erster')).toBeFocused();
    await wapPage.getByRole('button', { name: 'Löschen rückgängig machen' }).click();
    await expect(block(wapPage, 'Zweiter')).toBeFocused();
    // Rückgängig per Ctrl+Z: Fokus auf den betroffenen Eintrag.
    await wapPage.keyboard.press('Delete');
    await expect(block(wapPage, 'Zweiter')).toHaveCount(0);
    await wapPage.keyboard.press('Control+z');
    await expect(block(wapPage, 'Zweiter')).toBeFocused();
    await expect.poll(() => focusedName(wapPage)).not.toBe('BODY');
    // Ohne Datei-Sicherung seit mehr als einem Arbeitstag erinnert das Schliessen.
    const reminded = () =>
      wapPage.evaluate(() => {
        const event = new Event('beforeunload', { cancelable: true });
        window.dispatchEvent(event);
        return event.defaultPrevented;
      });
    expect(await reminded(), 'Am selben Tag keine Erinnerung.').toBe(false);
    await clockAt('2026-10-15T17:00:00+02:00');
    expect(await reminded(), 'Zwei Arbeitstage ohne Datei-Sicherung.').toBe(true);
    const save = wapPage.waitForEvent('download');
    await wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click();
    await save;
    await expect(wapPage.getByText('· letzte Datei-Sicherung heute')).toBeVisible();
    expect(await reminded(), 'Nach der Sicherung keine Erinnerung.').toBe(false);
    await expect(wapPage.getByRole('status', { name: 'Speicher', exact: true })).toContainText(
      /^gespeichert \d{2}:\d{2}$/i,
    );
  });

  test('[R-5.5-07][R-5.6-01] I2b-B B6: Plan-Datei öffnen bei lokal neuerem Stand – behalten, ersetzen (rückgängig machbar), als Kopie; nie still', async ({
    wapPage,
  }) => {
    // F-FLAKY (FL-03): keine Zeitanforderung; Sicherung und dreimal Öffnen mit Dialog, zusammen 3–5 s, unter Rechnerlast
    // über 30 s (Warten auf den Download) – Zeitlimit als Schutz vor Hängern statt der Vorgabe 30 s.
    test.setTimeout(120_000);
    await createPlan(wapPage, `${url()}#leer`, 'Ersetzen Übungsplan');
    await drawBlock(wapPage, 'Dateistand', 480, 540);
    const pending = wapPage.waitForEvent('download');
    await wapPage.getByRole('button', { name: 'Plan-Datei sichern', exact: true }).click();
    const download = await pending;
    const path = await download.path();
    if (path === null) throw new Error('Sicherung fehlt.');
    const bytes = readFileSync(path);
    expect(parsePlanFile(new Uint8Array(bytes)).plan.exerciseName).toBe('Ersetzen Übungsplan');
    await block(wapPage, 'Dateistand').dblclick();
    await wapPage.getByRole('textbox', { name: 'Titel', exact: true }).fill('Lokal neuer');
    await wapPage.keyboard.press('Enter');
    const open = async () => {
      const chooser = wapPage.waitForEvent('filechooser');
      await wapPage.getByRole('button', { name: 'Plan-Datei öffnen', exact: true }).click();
      await (await chooser).setFiles({
        name: download.suggestedFilename(),
        mimeType: 'application/json',
        buffer: bytes,
      });
      const dialog = wapPage.getByRole('dialog', { name: 'Plan als Kopie öffnen', exact: true });
      await expect(dialog).toBeVisible();
      await expect(dialog).toContainText('ist neuer als');
      return dialog;
    };
    // Behalten: nichts ändert sich (Anfangsfokus auf der sicheren Wahl).
    let dialog = await open();
    await expect(dialog.getByRole('button', { name: 'Lokalen Stand behalten' })).toBeFocused();
    await dialog.getByRole('button', { name: 'Lokalen Stand behalten' }).click();
    await expect(block(wapPage, 'Lokal neuer')).toBeVisible();
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText('nicht geöffnet');
    // Ersetzen: vorher Wiederherstellungspunkt, mit Rückgängig zurück.
    dialog = await open();
    await dialog.getByRole('button', { name: 'Durch Datei ersetzen' }).click();
    await expect(block(wapPage, 'Dateistand')).toBeVisible();
    await expect(block(wapPage, 'Lokal neuer')).toHaveCount(0);
    await expect(wapPage.getByRole('status', { name: 'Meldung' })).toContainText(
      'Wiederherstellungspunkt gesichert',
    );
    await expect.poll(() => focusedName(wapPage)).not.toBe('BODY');
    await wapPage.getByRole('button', { name: 'Ersetzen rückgängig machen' }).click();
    await expect(block(wapPage, 'Lokal neuer')).toBeVisible();
    // Als Kopie: zweiter Plan, der vorhandene bleibt.
    dialog = await open();
    await dialog.getByRole('button', { name: 'Als Kopie öffnen', exact: true }).click();
    await expect(block(wapPage, 'Dateistand')).toBeVisible();
    await expect(
      wapPage.getByRole('combobox', { name: 'Plan', exact: true }).getByRole('option'),
    ).toHaveCount(2);
  });

  test('[R-5.2-01][R-5.7-03] I2b-B B7: tolerante Zeitfelder, Startdatum dd.mm.yyyy mit Montagshinweis, eigene Meldung bei leerem Planname, Z/T/S öffnen das Feld, Spaltenbereich', async ({
    wapPage,
  }) => {
    await wapPage.goto(`${url()}#leer`);
    await wapPage.reload();
    await wapPage.getByRole('button', { name: 'Neuer Plan aus Vorlage', exact: true }).click();
    const dialog = wapPage.getByRole('dialog', { name: 'Neuer Plan aus Vorlage', exact: true });
    await dialog.getByRole('button', { name: 'Anlegen', exact: true }).click();
    const name = dialog.getByRole('textbox', { name: 'Planname', exact: true });
    await expect(name).toHaveAttribute('aria-invalid', 'true');
    await expect(name).toBeFocused();
    await expect(dialog.getByRole('alert')).toContainText('«Planname» ist leer');
    await name.fill('Eingabe Übungsplan');
    const start = dialog.getByRole('textbox', { name: 'Startdatum', exact: true });
    await start.fill('30.09.2026');
    await expect(dialog).toContainText('Der 30.09.2026 ist ein Mittwoch.');
    await dialog.getByRole('button', { name: 'Montag 28.09.2026 übernehmen' }).click();
    await expect(start).toHaveValue('28.09.2026');
    await dialog.getByRole('button', { name: 'Anlegen', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(
      wapPage.getByRole('tablist', { name: 'Wochen' }).getByRole('tab').first(),
    ).toHaveText('KVK');
    // Zeitfelder: «9», «9:30» und «09.45» werden zu 0900, 0930, 0945; ungültig: Feld markiert, Meldung.
    await wapPage.getByRole('button', { name: 'Neuer Block', exact: true }).click();
    await wapPage.getByRole('textbox', { name: 'Titel', exact: true }).fill('Zeitprobe');
    const begin = wapPage.getByRole('textbox', { name: 'Beginn', exact: true });
    const end = wapPage.getByRole('textbox', { name: 'Ende', exact: true });
    await begin.fill('9');
    await end.fill('0933');
    await end.press('Enter');
    await expect(end).toHaveAttribute('aria-invalid', 'true');
    await expect(wapPage.getByRole('alert')).toContainText(
      '«Ende»: «0933» liegt nicht im 5-Minuten-Raster',
    );
    await end.fill('9:30');
    await wapPage
      .getByRole('combobox', { name: 'Spalte', exact: true })
      .selectOption({ label: 'Stv' });
    await wapPage
      .getByRole('combobox', { name: 'bis Spalte', exact: true })
      .selectOption({ label: 'Uof' });
    await wapPage.getByRole('combobox', { name: 'bis Spalte', exact: true }).press('Enter');
    const probe = block(wapPage, 'Zeitprobe');
    await expect(probe).toHaveAccessibleName('Block Zeitprobe 0900-0930 · Mo');
    const stv = await box(area(wapPage, 'Mo', 1));
    const uof = await box(area(wapPage, 'Mo', 3));
    const b = await box(probe);
    expect(Math.abs(b.x - stv.x)).toBeLessThan(4);
    expect(Math.abs(b.x + b.width - (uof.x + uof.width))).toBeLessThan(6);
    // Z: Zeit mit Fokus; Ende folgt dem Beginn mit gleicher Dauer.
    await probe.focus();
    await wapPage.keyboard.press('z');
    await expect(begin).toBeFocused();
    await wapPage.keyboard.type('09.45');
    await wapPage.keyboard.press('Enter');
    await expect(probe).toHaveAccessibleName('Block Zeitprobe 0945-1015 · Mo');
    // T: Tag mit Fokus, Enter im Auswahlfeld übernimmt.
    await probe.focus();
    await wapPage.keyboard.press('t');
    await expect(wapPage.getByRole('combobox', { name: 'Tag', exact: true })).toBeFocused();
    await wapPage.keyboard.press('ArrowDown');
    await wapPage.keyboard.press('Enter');
    await expect(probe).toHaveAccessibleName('Block Zeitprobe 0945-1015 · Di');
    // S: Spalten mit Fokus.
    await probe.focus();
    await wapPage.keyboard.press('s');
    await expect(wapPage.getByRole('combobox', { name: 'Spalte', exact: true })).toBeFocused();
    await wapPage.keyboard.press('Escape');
  });

  test('[R-5.1-01][R-5.1-08][R-5.7-03] I2b-B B8: Doppelklick in Rap- und Beso-Spalte erfasst, Hinweis in Planungsspalten, Alt+Ziehen erzeugt parallelen Block, Griffe 8 px über die ganze Kante', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, `${url()}#leer`, 'Feinschliff Übungsplan');
    const rap = await box(wapPage.getByRole('button', { name: 'Rap-Spalte Mo', exact: true }));
    await wapPage.mouse.dblclick(rap.x + rap.width / 2, rap.y + (780 - 240) * MINUTE + 2);
    const code = wapPage.getByRole('textbox', { name: 'Kürzel', exact: true });
    await expect(code).toBeFocused();
    await wapPage.keyboard.type('AR2');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Rapport AR2 1300-1330 · Mo$/ }),
    ).toBeVisible();
    const beso = await box(wapPage.getByRole('button', { name: 'Beso-Spalte Mo', exact: true }));
    await wapPage.mouse.dblclick(beso.x + beso.width / 2, beso.y + (600 - 240) * MINUTE + 2);
    const text = wapPage.getByRole('textbox', { name: 'Termintext', exact: true });
    await expect(text).toBeFocused();
    await wapPage.keyboard.type('Arztvisite');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite 1000-1030 · Mo$/ }),
    ).toBeVisible();
    // Per Tastatur: Zellzeiger in die Rap-Spalte, Enter erfasst einen Rapport.
    await wapPage.getByRole('button', { name: /^Rapport AR2 / }).focus();
    await wapPage.keyboard.press('Escape');
    await expect(cursor(wapPage)).toHaveAccessibleName(/^Mo 28\.09\. 1300 Rap, Rapport AR2/);
    await wapPage.keyboard.press('PageDown');
    await wapPage.keyboard.press('Enter');
    await expect(code).toBeFocused();
    await wapPage.keyboard.type('KR');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Rapport KR 1400-1430 · Mo$/ }),
    ).toBeFocused();
    // Planungsspalte: Doppelklick erfasst nichts, nennt den Weg.
    const plan = await box(area(wapPage, 'Mo', 0));
    await wapPage.mouse.dblclick(plan.x + plan.width / 2, plan.y + 400);
    await expect(wapPage.getByRole('button', { name: /^Block / })).toHaveCount(0);
    await expect(wapPage.getByRole('status', { name: 'Zeiten beim Ziehen' })).toContainText(
      'Zum Erfassen ziehen oder Enter',
    );
    // Alt+Ziehen auf einem Block erzeugt einen parallelen Block, verschiebt nicht.
    await drawBlock(wapPage, 'Basis', 480, 600);
    const basis = await box(block(wapPage, 'Basis'));
    await wapPage.keyboard.down('Alt');
    await wapPage.mouse.move(basis.x + basis.width / 2, basis.y + 30 * MINUTE + 1);
    await wapPage.mouse.down();
    await wapPage.mouse.move(basis.x + basis.width / 2, basis.y + 90 * MINUTE - 1, { steps: 6 });
    await expect(wapPage.getByRole('status', { name: 'Zeiten beim Ziehen' })).toContainText(
      'parallel zu «Basis»',
    );
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Alt');
    await expect(wapPage.getByRole('textbox', { name: 'Titel', exact: true })).toBeFocused();
    await wapPage.keyboard.type('Parallel');
    await wapPage.keyboard.press('Enter');
    await expect(block(wapPage, 'Basis')).toHaveAccessibleName(/0800-1000/);
    await expect(block(wapPage, 'Parallel')).toHaveAccessibleName(/0830-0930/);
    // Griffe: 8 px hoch über die ganze Breite des Blocks.
    await block(wapPage, 'Basis').click();
    const handle = await box(wapPage.getByRole('button', { name: 'Ende ändern', exact: true }));
    const now = await box(block(wapPage, 'Basis'));
    expect(handle.height).toBeGreaterThanOrEqual(8);
    expect(handle.width).toBeGreaterThanOrEqual(now.width - 4);
  });
}
