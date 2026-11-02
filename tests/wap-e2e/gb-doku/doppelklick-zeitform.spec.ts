// GB-DOKU: Zeitform beim Doppelklick in die leere Rap- bzw. Beso-Spalte nach Gate B 28.10.2026, Entscheid 20 a
// («2: ja» bestätigt): es entsteht ein Zeitfenster von 30 Min (Vorgabe) statt eines Zeitpunkts (Katalog R-5.1-06,
// R-5.1-07, Änderungsnotiz Gate B; SA-2-02, SA-H-13). Ergänzt `h-tests/erfassen.spec.ts`, der die Zeitform offen
// liess. Fiktive Daten.
import { expect } from '@playwright/test';
import { createPlan } from '../i2/support/ablauf';
import { box, MINUTE } from '../i2b/support/handhabung';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/harness/i5.html#leer';
/** Erste sichtbare Rasterminute (0400). */
const FROM = 240;

test.describe('GB-DOKU – Doppelklick erzeugt ein Zeitfenster von 30 Min (Gate B Nr 20 a)', () => {
  test('[R-5.1-06] Doppelklick auf die leere Rap-Spalte bei 0700 erzeugt einen Rapport 0700-0730 (von–bis), das Feld «Kürzel» ist offen', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, URL, 'Zeitform Rap');
    const rap = await box(wapPage.getByRole('button', { name: 'Rap-Spalte Mo', exact: true }));
    await wapPage.mouse.dblclick(rap.x + rap.width / 2, rap.y + (420 - FROM) * MINUTE + 2);
    const code = wapPage.getByRole('textbox', { name: 'Kürzel', exact: true });
    await expect(code).toBeFocused();
    await wapPage.keyboard.type('DR');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: 'Rapport DR 0700-0730 · Mo', exact: true }),
    ).toHaveCount(1);
    // Kein Zeitpunkt «0700» ohne Ende (frühere Fassung des Kriteriums).
    await expect(
      wapPage.getByRole('button', { name: 'Rapport DR 0700 · Mo', exact: true }),
    ).toHaveCount(0);
  });

  test('[R-5.1-07] Doppelklick auf die leere Beso-Spalte bei 1400 erzeugt einen Beso mit einem Zeitfenster 1400-1430 (von–bis), das Feld für den Termintext ist offen', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, URL, 'Zeitform Beso');
    const beso = await box(wapPage.getByRole('button', { name: 'Beso-Spalte Mo', exact: true }));
    await wapPage.mouse.dblclick(beso.x + beso.width / 2, beso.y + (840 - FROM) * MINUTE + 2);
    const text = wapPage.getByRole('textbox', { name: 'Termintext', exact: true });
    await expect(text).toBeFocused();
    await wapPage.keyboard.type('Arztvisite');
    await wapPage.keyboard.press('Enter');
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite 1400-1430 · Mo$/ }),
    ).toHaveCount(1);
    await expect(
      wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite 1400 · Mo$/ }),
    ).toHaveCount(0);
  });
});
