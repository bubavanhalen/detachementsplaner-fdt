// H-TESTS (Härtung, TR-H-09, SA-H-12): bisher ohne passende ID geprüfte Abläufe im Raster mit eigenem Test und
// richtiger ID (Beschrieb 5.1, 6 «Tastatur»; UI-Richtlinie 5.3, 5.4, 13.3; R-5.1-04, R-5.1-06, R-5.1-07, R-5.1-09,
// R-6-27, R-5-02). Zu R-5.1-06/-07 prüft der Test nur «Rapport bzw. Beso entsteht, Feld offen» (Zeitform: Entscheid
// des Auftraggebers ausstehend, SA-H-13). Fiktive Daten.
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../src/model/wap/types';
import { block as addBlock, kpPlan } from '../../wap/support/i5/plan';
import { createPlan } from '../i2/support/ablauf';
import { block, box, MINUTE } from '../i2b/support/handhabung';
import { startWith } from '../i5/support/ablauf';
import { planFile } from '../i5/support/plaene';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/harness/i5.html#leer';
const FROM = 240;

/** Vier Blöcke: Alpha Mo 0800 Spalte 1, Bravo Mo 0800 Spalte 2, Charlie Mo 1000 Spalte 1, Delta Di 0700 Spalte 1. */
function tabPlan(lang = false): Plan {
  let p = kpPlan(1);
  const cols = (p.columnSets[0]?.columns ?? []).filter((c) => c.kind === 'planning');
  const c0 = cols[0]?.id ?? '';
  const c1 = cols[1]?.id ?? '';
  const at = (from: number) => ({ form: 'range' as const, from, to: from + 60 });
  p = addBlock(p, 'Alpha', { columns: { kind: 'ids', ids: [c0] }, time: at(480) }).plan;
  p = addBlock(p, 'Bravo', { columns: { kind: 'ids', ids: [c1] }, time: at(480) }).plan;
  p = addBlock(p, 'Charlie', { columns: { kind: 'ids', ids: [c0] }, time: at(600) }).plan;
  p = addBlock(p, 'Delta', {
    date: '2026-09-29',
    columns: { kind: 'ids', ids: [c0] },
    time: at(420),
  }).plan;
  if (lang)
    p = addBlock(p, 'Ausbildung Sanitätsdienst und Kartenlesen im Gelände Nord', {
      columns: { kind: 'all' },
      date: '2026-09-30',
      time: { form: 'range', from: 480, to: 600 },
    }).plan;
  return { ...p, id: 'h-tests-raster', exerciseName: 'Raster Übungsplan', service: 'FDT 2099' };
}

const named = (page: Page, title: string): Locator => block(page, title);

async function focusedName(page: Page): Promise<string> {
  return page.evaluate(() => {
    const a = document.activeElement;
    return a === null || a === document.body ? 'BODY' : (a.getAttribute('aria-label') ?? a.tagName);
  });
}

async function inGrid(page: Page): Promise<boolean> {
  return page.evaluate(
    () => document.activeElement?.closest('table[aria-label="Wochenraster"]') != null,
  );
}

test.describe('H-TESTS Raster: Erfassen und Tastatur', () => {
  test('[R-5.1-04] Alt+Ziehen über «MiE» in einer Spalte erzeugt einen neuen Block, «MiE» bleibt und ist dort ausgespart; nach dem Loslassen von Alt Fokus im Raster, Alt-Taste ohne Browser-Menü', async ({
    wapPage,
  }) => {
    // «MiE» über alle Spalten wie im Kp Wo 2 Di (Beschrieb 4.6 «Ausnahme»).
    let base = kpPlan(1);
    base = addBlock(base, 'MiE', {
      columns: { kind: 'all' },
      time: { form: 'range', from: 420, to: 720 },
    }).plan;
    await startWith(
      wapPage,
      URL,
      'alt.wap.json',
      planFile({ ...base, id: 'h-tests-alt', exerciseName: 'Alt Übungsplan', service: 'FDT 2099' }),
    );
    const mie = named(wapPage, 'MiE');
    /** Gefüllte Flächen von «MiE» (Teilstücke) im Bildschirm. */
    const flaechen = () =>
      mie.locator('xpath=..').evaluate((el) => {
        const own = el.hasAttribute('data-flaeche') ? [el] : [];
        return [...own, ...el.querySelectorAll('[data-flaeche]')].map((e) => {
          const r = e.getBoundingClientRect();
          return { x0: r.left, x1: r.right, y0: r.top, y1: r.bottom };
        });
      });
    const m = await box(mie);
    const kopf = await box(wapPage.getByRole('button', { name: 'Spaltenkopf Kp Kdt' }).first());
    const x = kopf.x + kopf.width / 2;
    // Vorher deckt «MiE» die Stelle 0800-0900 in der Spalte Kp Kdt.
    const mitte = { x, y: m.y + 90 * MINUTE };
    const deckt = (f: { x0: number; x1: number; y0: number; y1: number }[]) =>
      f.some((r) => r.x0 < mitte.x && mitte.x < r.x1 && r.y0 < mitte.y && mitte.y < r.y1);
    expect(deckt(await flaechen())).toBe(true);
    // Die Seite meldet, ob das Loslassen von Alt verbraucht wurde (kein Browser-Menü, Q-009 K-5).
    await wapPage.evaluate(() => {
      const w = window as Window & { __altUp?: boolean[] };
      w.__altUp = [];
      window.addEventListener('keyup', (e) => {
        if (e.key === 'Alt') w.__altUp?.push(e.defaultPrevented);
      });
    });
    await wapPage.keyboard.down('Alt');
    await wapPage.mouse.move(x, m.y + 60 * MINUTE + 1);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x, m.y + 120 * MINUTE - 1, { steps: 6 });
    await wapPage.mouse.up();
    await wapPage.keyboard.up('Alt');
    expect(
      await wapPage.evaluate(() => (window as Window & { __altUp?: boolean[] }).__altUp),
    ).toEqual([true]);
    const title = wapPage.getByRole('textbox', { name: 'Titel', exact: true });
    await expect(title).toBeFocused();
    expect(await inGrid(wapPage)).toBe(true);
    await wapPage.keyboard.type('Ausnahme');
    await wapPage.keyboard.press('Enter');
    const neu = named(wapPage, 'Ausnahme');
    await expect(neu).toHaveAccessibleName('Block Ausnahme 0800-0900 · Mo');
    await expect(neu).toBeFocused();
    expect(await inGrid(wapPage)).toBe(true);
    // «MiE» behält Zeit und Spalten und ist an der Stelle des neuen Blocks ausgespart (Teilstücke).
    await expect(mie).toHaveAccessibleName('Block MiE 0700-1200 · Mo');
    const nachher = await flaechen();
    expect(nachher.length).toBeGreaterThanOrEqual(2);
    expect(deckt(nachher)).toBe(false);
  });

  test('[R-5.1-06] Doppelklick auf die leere Rap-Spalte bei 0700 erzeugt einen Rapport ab 0700, das Feld «Kürzel» ist offen', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, URL, 'Rap Übungsplan');
    const rap = await box(wapPage.getByRole('button', { name: 'Rap-Spalte Mo', exact: true }));
    await wapPage.mouse.dblclick(rap.x + rap.width / 2, rap.y + (420 - FROM) * MINUTE + 2);
    const code = wapPage.getByRole('textbox', { name: 'Kürzel', exact: true });
    await expect(code).toBeFocused();
    await expect(code).toBeEditable();
    await wapPage.keyboard.type('DR');
    await wapPage.keyboard.press('Enter');
    const r = wapPage.getByRole('button', { name: /^Rapport DR 0700\b/ });
    await expect(r).toHaveCount(1);
    await expect(r).toHaveAccessibleName(/ · Mo$/);
  });

  test('[R-5.1-07] Doppelklick auf die leere Beso-Spalte bei 1400 erzeugt einen Beso mit einem Zeitfenster ab 1400, das Feld für den Termintext ist sofort offen', async ({
    wapPage,
  }) => {
    await createPlan(wapPage, URL, 'Beso Übungsplan');
    const beso = await box(wapPage.getByRole('button', { name: 'Beso-Spalte Mo', exact: true }));
    await wapPage.mouse.dblclick(beso.x + beso.width / 2, beso.y + (840 - FROM) * MINUTE + 2);
    const text = wapPage.getByRole('textbox', { name: 'Termintext', exact: true });
    await expect(text).toBeFocused();
    await expect(text).toBeEditable();
    await wapPage.keyboard.type('Arztvisite');
    await wapPage.keyboard.press('Enter');
    const b = wapPage.getByRole('button', { name: /^Beso \S+ Arztvisite 1400\b/ });
    await expect(b).toHaveCount(1);
    await expect(b).toHaveAccessibleName(/ · Mo$/);
  });

  test('[R-5.1-09] Direktbearbeitung eines Blocks: Tab springt vom Titel zum nächsten Feld in der Reihenfolge der UI-Richtlinie (Titel → Zusatz → Ltg → Ort)', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'raster.wap.json', planFile(tabPlan()));
    await named(wapPage, 'Alpha').dblclick();
    const reihe: string[] = [await focusedName(wapPage)];
    for (let i = 0; i < 3; i++) {
      await wapPage.keyboard.press('Tab');
      reihe.push(await focusedName(wapPage));
    }
    expect(reihe).toEqual(['Titel', 'Zusatz', 'Ltg', 'Ort']);
    // Shift+Tab geht zurück; Esc schliesst ohne Änderung.
    await wapPage.keyboard.press('Shift+Tab');
    expect(await focusedName(wapPage)).toBe('Ltg');
    await wapPage.keyboard.press('Escape');
    await expect(named(wapPage, 'Alpha')).toHaveAccessibleName('Block Alpha 0800-0900 · Mo');
  });

  test('[R-6-27] Ausserhalb der Bearbeitung: Tab folgt Tag, Sortierzeit, Spalte, Shift+Tab umgekehrt, Auswahl folgt; nach dem letzten Eintrag verlässt Tab das Raster; Ctrl+Pfeile fokussieren den Nachbarn, die Auswahl bleibt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'raster.wap.json', planFile(tabPlan()));
    const soll = [
      'Block Alpha 0800-0900 · Mo',
      'Block Bravo 0800-0900 · Mo',
      'Block Charlie 1000-1100 · Mo',
      'Block Delta 0700-0800 · Di',
    ];
    await named(wapPage, 'Alpha').click();
    const vor: string[] = [await focusedName(wapPage)];
    for (let i = 0; i < 3; i++) {
      await wapPage.keyboard.press('Tab');
      vor.push(await focusedName(wapPage));
      await expect(wapPage.getByRole('button', { name: vor[i + 1] ?? '' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    }
    expect(vor).toEqual(soll);
    await wapPage.keyboard.press('Tab');
    expect(await inGrid(wapPage)).toBe(false);
    await wapPage.keyboard.press('Shift+Tab');
    const zurueck: string[] = [await focusedName(wapPage)];
    for (let i = 0; i < 3; i++) {
      await wapPage.keyboard.press('Shift+Tab');
      zurueck.push(await focusedName(wapPage));
    }
    expect(zurueck).toEqual([...soll].reverse());
    // Ctrl+Pfeile: Fokus zum Nachbarn in Pfeilrichtung, Auswahl bleibt bei Alpha.
    await named(wapPage, 'Alpha').click();
    const alpha = named(wapPage, 'Alpha');
    await wapPage.keyboard.press('Control+ArrowRight');
    expect(await focusedName(wapPage)).toBe(soll[1]);
    await expect(alpha).toHaveAttribute('aria-pressed', 'true');
    await expect(named(wapPage, 'Bravo')).toHaveAttribute('aria-pressed', 'false');
    await wapPage.keyboard.press('Control+ArrowLeft');
    expect(await focusedName(wapPage)).toBe(soll[0]);
    await wapPage.keyboard.press('Control+ArrowDown');
    expect(await focusedName(wapPage)).toBe(soll[2]);
    await expect(alpha).toHaveAttribute('aria-pressed', 'true');
    await expect(named(wapPage, 'Charlie')).toHaveAttribute('aria-pressed', 'false');
  });

  test('[R-5-02] Zoom 50 %, 100 %, 200 % per Maus (Knöpfe) und Tastatur (− und + im Raster): Zeilen und Umbrüche bleiben unverändert, die Lage skaliert', async ({
    wapPage,
  }) => {
    await startWith(wapPage, URL, 'raster.wap.json', planFile(tabPlan(true)));
    const grid = wapPage.getByRole('table', { name: 'Wochenraster', exact: true });
    const stufe = wapPage.getByRole('status', { name: 'Zoomstufe', exact: true });
    const zeilen = () => grid.locator('.i2-grid-line').allInnerTexts();
    const lang = named(wapPage, 'Ausbildung Sanitätsdienst');
    await expect(stufe).toHaveText('100 %');
    const z100 = await zeilen();
    const h100 = (await box(lang)).height;
    // Der lange Titel ist umbrochen (mehrere Zeilen).
    expect(
      z100.filter((z) => /Ausbildung|Sanitätsdienst|Kartenlesen|Gelände|Nord/.test(z)).length,
    ).toBeGreaterThan(1);
    // Maus: zweimal «Verkleinern» → 50 %.
    await wapPage.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await wapPage.getByRole('button', { name: 'Verkleinern', exact: true }).click();
    await expect(stufe).toHaveText('50 %');
    expect(await zeilen()).toEqual(z100);
    expect((await box(lang)).height).toBeCloseTo(h100 / 2, 0);
    // Tastatur: + im Raster bis 200 %.
    await named(wapPage, 'Alpha').focus();
    for (const s of ['75 %', '100 %', '125 %', '150 %', '175 %', '200 %']) {
      await wapPage.keyboard.press('+');
      await expect(stufe).toHaveText(s);
    }
    expect(await zeilen()).toEqual(z100);
    expect((await box(lang)).height).toBeCloseTo(h100 * 2, 0);
    // Tastatur − zurück auf 100 %, Maus «Vergrössern» auf 125 %.
    for (let i = 0; i < 4; i++) await wapPage.keyboard.press('-');
    await expect(stufe).toHaveText('100 %');
    await wapPage.getByRole('button', { name: 'Vergrössern', exact: true }).click();
    await expect(stufe).toHaveText('125 %');
    expect(await zeilen()).toEqual(z100);
  });
});
