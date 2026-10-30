// H-TESTS (Härtung, TR-H-09, TR-H-13): Kriterien, deren IDs bisher auch Tests mit anderem Inhalt trugen, mit eigenem
// Test (R-5.1-14 Einrasten beim Verschieben, R-5.6-01 Tab schliessen und neu öffnen) und Autoscroll am Rand mit
// Abfrage statt fester Wartezeit (R-5.1-14, R-5.1-16). Beschrieb 5.1, 5.6 Pkt 1. Nur fiktive Daten.
import { expect } from '@playwright/test';
import { createPlan } from '../i2/support/ablauf';
import { area, block, box, drawBlock, MINUTE } from '../i2b/support/handhabung';
import { test } from '../support/fixtures';

// F-FLAKY3: läuft exklusiv im Projekt edge-zeit (playwright.wap.config.ts), nach allen
// übrigen Tests und mit einem Worker, damit kein paralleler Worker die Messung belastet.
const ZEITKRITISCH = { tag: '@zeitkritisch' };

const URL = '/tests/wap-e2e/harness/i5.html#leer';

test.describe('H-TESTS Verschieben, Einrasten, sofortiges Speichern', () => {
  test('[R-5.1-14] Verschieben um 22 Min rastet auf 15 bzw. 30 Min ein; seitlich über die halbe Spaltenbreite auf die Spaltengrenze der Nachbarspalte', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, URL, 'Einrasten Übungsplan');
    await drawBlock(wapPage, 'Raster', 480, 540);
    const b = await box(block(wapPage, 'Raster'));
    const x = b.x + b.width / 2;
    const y = b.y + b.height / 2;
    // Senkrecht 22 Min nach unten: neue Zeit 0815 oder 0830, nie 0822.
    await wapPage.mouse.move(x, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, y + 22 * MINUTE, { steps: 8 });
    await wapPage.mouse.up();
    await expect(block(wapPage, 'Raster')).toHaveAccessibleName(
      /^Block Raster 08(15-0915|30-0930) · Mo$/,
    );
    const nach = await box(block(wapPage, 'Raster'));
    // Seitlich um 0,6 Spaltenbreiten: der Block liegt danach genau in der zweiten Spalte.
    const zweite = await box(area(wapPage, 'Mo', 1));
    await wapPage.mouse.move(nach.x + nach.width / 2, nach.y + nach.height / 2);
    await wapPage.mouse.down();
    await wapPage.mouse.move(nach.x + nach.width / 2 + 0.6 * nach.width, nach.y + nach.height / 2, {
      steps: 8,
    });
    await wapPage.mouse.up();
    const seitlich = await box(block(wapPage, 'Raster'));
    expect(Math.abs(seitlich.x - zweite.x)).toBeLessThanOrEqual(3);
    expect(Math.abs(seitlich.x + seitlich.width - (zweite.x + zweite.width))).toBeLessThanOrEqual(
      3,
    );
    await expect(block(wapPage, 'Raster')).toHaveAccessibleName(/^Block Raster 08(15|30)-/);
  });

  test('[R-5.6-01] Änderung, sofort danach den Tab schliessen und neu öffnen: die Änderung ist vorhanden', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, URL, 'Schliessen Übungsplan');
    await drawBlock(wapPage, 'Vor dem Schliessen', 480, 540);
    // Tab sofort schliessen (ohne Warten auf die Speicheranzeige) und im selben Profil neu öffnen.
    const context = wapPage.context();
    const neu = await context.newPage();
    await wapPage.close({ runBeforeUnload: true });
    await neu.goto(URL);
    await expect(neu.getByRole('button', { name: /^Block Vor dem Schliessen / })).toBeVisible();
    await neu.close();
  });

  test(
    '[R-5.1-14][R-5.1-16] Ziehen nahe am rechten Rand scrollt das Raster stetig (Abfrage statt Wartezeit) und verschiebt den Block über mehrere Tage; unten am Rand scrollt die Zeit',
    ZEITKRITISCH,
    async ({ wapPage }) => {
      await createPlan(wapPage, URL, 'Rand Übungsplan');
      await drawBlock(wapPage, 'Randblock', 480, 540);
      // Der Rollbereich des Rasters hat keine eigene Rolle: nächster rollbare Vorfahr der Tabelle.
      const scroller = wapPage
        .getByRole('table', { name: 'Wochenraster', exact: true })
        .locator('xpath=ancestor::*[contains(concat(" ", @class, " "), " i2-grid-scroll ")]');
      const frame = await box(scroller);
      const scrollTop = () => scroller.evaluate((e) => e.scrollTop);
      const b = await box(block(wapPage, 'Randblock'));
      await wapPage.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
      await wapPage.mouse.down();
      // F-FLAKY2 (FL2-02): scrollLeft je Bild im Browser aufzeichnen (Bildbezug über requestAnimationFrame). Die frühere
      // Abfrage im Takt der Wanduhr verpasste die Zwischenstände, wenn das Raster den Rest der Rollweite (Vorgabezoom
      // rund 215 px) zwischen zwei Abfragen durchlief: «mitte» war dann schon das Ende und die zweite Bedingung unerfüllbar.
      await scroller.evaluate((e) => {
        const w = window as unknown as { __randVerlauf?: number[] };
        const verlauf: number[] = [];
        w.__randVerlauf = verlauf;
        const takt = () => {
          verlauf.push(e.scrollLeft);
          if (verlauf.length < 3000) requestAnimationFrame(takt);
        };
        requestAnimationFrame(takt);
      });
      await wapPage.mouse.move(frame.x + frame.width - 12, b.y + b.height / 2, { steps: 10 });
      // Stetig: erst um mehr als 50 px, danach von dort um weitere mehr als 50 px (wie bisher, aber je Bild beobachtet).
      const stetig = () =>
        wapPage.evaluate(() => {
          const v = (window as unknown as { __randVerlauf?: number[] }).__randVerlauf ?? [];
          const first = v[0] ?? 0;
          const i = v.findIndex((s) => s > first + 50);
          const mitte = v[i] ?? 0;
          return {
            erreicht: i >= 0 && v.slice(i + 1).some((s) => s > mitte + 50),
            bilder: v.length,
          };
        });
      await expect.poll(async () => (await stetig()).erreicht, { timeout: 10_000 }).toBe(true);
      await wapPage.mouse.move(frame.x + frame.width - 70, b.y + b.height / 2, { steps: 2 });
      await wapPage.mouse.up();
      await expect(block(wapPage, 'Randblock')).toHaveAccessibleName(
        /^Block Randblock 0800-0900 · (Mi|Do|Fr|Sa|So)$/,
      );
      // Senkrecht: unten am Rand scrollt die Zeit.
      await scroller.evaluate((e) => {
        e.scrollTop = 0;
      });
      await expect.poll(scrollTop).toBe(0);
      const c = await box(block(wapPage, 'Randblock'));
      await wapPage.mouse.move(c.x + c.width / 2, c.y + c.height / 2);
      await wapPage.mouse.down();
      await wapPage.mouse.move(c.x + c.width / 2, frame.y + frame.height - 8, { steps: 8 });
      await expect.poll(scrollTop, { timeout: 5000 }).toBeGreaterThan(20);
      await wapPage.keyboard.press('Escape');
      await wapPage.mouse.up();
    },
  );
});
