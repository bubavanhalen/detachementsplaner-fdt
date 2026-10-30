// Paket E1-02c: Bildschirmschrift nicht ladbar (R-L-05; ADR-004 Punkt 4; Vertrag E1-02c §3.1, §3.3, §5;
// Präzisierung P-13; V-02c-3; Änderungsnotiz Vertragsprüfung V14). In Edge wird die Schrift per addInitScript
// gesperrt: FontFace fehlt, der Konstruktor wirft, load() wird abgelehnt oder der Status ist «error». Erwartet:
// Meldung (role="alert") mit Ursache und nächstem Schritt, keine gezeichnete Seite, kein Text in Ersatzschrift,
// ensureScreenFont lehnt zweimal mit FontLoadError «screenFontUnavailable» ab; kein neuer Versuch.
import { expect, type Page } from '@playwright/test';
import type { PageModel } from '../../../src/model/wap/layout/pageModel';
import { fett, lauf, ROT, rechteck, seite, zeile } from '../../wap/pdf/writer/support/seiten';
import { test } from '../support/fixtures';
import { harnessBereit, type Konsolenmeldung, konsoleMitschneiden, zeige } from './support/messen';

// Keine Konsolenausgabe jeder Art (TR-E102c-06): jede Meldung der Seite wird gezählt, erwartet 0.
let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  expect(konsole).toEqual([]);
});

const LABEL = 'Wochenseite Übung';
const URSACHE =
  'Die Schrift des WAP-Planers konnte nicht geladen werden. Ohne sie würden Umbrüche vom PDF abweichen.';
const NAECHSTER_SCHRITT =
  'Seite neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.';

function probeSeite(): PageModel {
  return seite([
    rechteck({ x: 50, y: 50, w: 200, h: 100 }, ROT, null),
    zeile({
      x: 60,
      baselineY: 80,
      sizePt: 10,
      runs: [fett('Fiktive Zeile '), lauf('Übung Muster')],
    }),
    zeile({ x: 60, baselineY: 100, sizePt: 8, rotation: 90, runs: [lauf('Gedreht')] }),
  ]);
}

/** Sperrarten der Schrift (Vertrag §3.1: FontFace fehlt, Konstruktor scheitert, load() scheitert, Status error). */
const SPERREN: readonly { readonly name: string; readonly skript: () => void }[] = [
  {
    name: 'FontFace fehlt',
    skript: () => {
      Reflect.deleteProperty(window, 'FontFace');
    },
  },
  {
    name: 'Konstruktor wirft',
    skript: () => {
      (window as unknown as { FontFace: unknown }).FontFace = function gesperrt(): never {
        throw new TypeError('fiktiv: Schrift gesperrt');
      };
    },
  },
  {
    name: 'load() abgelehnt',
    skript: () => {
      FontFace.prototype.load = () =>
        Promise.reject(new DOMException('fiktiv: Schrift gesperrt', 'NetworkError'));
    },
  },
  {
    name: 'Status error',
    skript: () => {
      Object.defineProperty(FontFace.prototype, 'status', {
        get: () => 'error',
        configurable: true,
      });
      FontFace.prototype.load = function (this: FontFace) {
        return Promise.resolve(this);
      };
    },
  },
];

async function pruefeMeldung(page: Page): Promise<void> {
  const meldung = page.getByRole('alert');
  await expect(meldung).toBeVisible();
  const absaetze = meldung.locator('p');
  await expect(absaetze).toHaveCount(2);
  await expect(absaetze.nth(0)).toHaveText(URSACHE);
  await expect(absaetze.nth(1)).toHaveText(NAECHSTER_SCHRITT);
  // Das Element html hat selbst die Rolle document; geprüft wird der Container der Seite unter #root.
  await expect(page.locator('#root').getByRole('document')).toHaveCount(0);
  await expect(page.getByRole('document', { name: LABEL })).toHaveCount(0);
  await expect(page.locator('[data-wap-item]')).toHaveCount(0);
  await expect(page.locator('#root svg')).toHaveCount(0);
  const text = await page.locator('#root').innerText();
  expect(text).not.toContain('Fiktive Zeile');
  expect(text).not.toContain('Gedreht');
}

for (const sperre of SPERREN) {
  test(`[R-L-05] Schrift gesperrt (${sperre.name}): Meldung mit Ursache und nächstem Schritt, keine Seite, kein Text in Ersatzschrift`, async ({
    wapPage,
  }) => {
    await wapPage.addInitScript(sperre.skript);
    await harnessBereit(wapPage);
    await zeige(wapPage, probeSeite(), { scale: 1, label: LABEL });
    await pruefeMeldung(wapPage);
  });

  test(`[R-L-05] Schrift gesperrt (${sperre.name}): ensureScreenFont lehnt zweimal mit FontLoadError screenFontUnavailable ab`, async ({
    wapPage,
  }) => {
    await wapPage.addInitScript(sperre.skript);
    await harnessBereit(wapPage);
    const erg = await wapPage.evaluate(async () => (await window.wapHarness?.schrift()) ?? null);
    expect(erg).not.toBeNull();
    for (const e of erg ?? []) {
      expect(e).toMatchObject({
        ok: false,
        name: 'FontLoadError',
        code: 'screenFontUnavailable',
        istFontLoadError: true,
        message: URSACHE,
      });
    }
  });
}

test('[R-L-05] (V-02c-3) kein automatischer neuer Versuch: lädt die Schrift beim ersten Mal nicht, bleibt es beim Fehler, ohne neues FontFace und ohne neues load()', async ({
  wapPage,
}) => {
  await wapPage.addInitScript(() => {
    const Original = FontFace;
    const zaehler = { konstruiert: 0, geladen: 0 };
    (window as unknown as { wapZaehler: typeof zaehler }).wapZaehler = zaehler;
    class Einmal extends Original {
      constructor(...a: ConstructorParameters<typeof FontFace>) {
        super(...a);
        zaehler.konstruiert += 1;
      }
      override load(): Promise<FontFace> {
        zaehler.geladen += 1;
        // Nur die beiden ersten Ladeversuche scheitern; ein späterer Versuch hätte Erfolg.
        return zaehler.geladen <= 2
          ? Promise.reject(new DOMException('fiktiv: vorübergehend', 'NetworkError'))
          : super.load();
      }
    }
    (window as unknown as { FontFace: typeof FontFace }).FontFace = Einmal;
  });
  await harnessBereit(wapPage);
  await zeige(wapPage, probeSeite(), { scale: 1, label: LABEL });
  await pruefeMeldung(wapPage);
  const vorher = await wapPage.evaluate(() => ({
    ...(window as unknown as { wapZaehler: object }).wapZaehler,
  }));
  const erg = await wapPage.evaluate(async () => (await window.wapHarness?.schrift()) ?? null);
  expect(erg?.map((e) => (e.ok ? 'ok' : e.code))).toEqual([
    'screenFontUnavailable',
    'screenFontUnavailable',
  ]);
  await zeige(wapPage, probeSeite(), { scale: 2, label: LABEL });
  await pruefeMeldung(wapPage);
  const nachher = await wapPage.evaluate(() => ({
    ...(window as unknown as { wapZaehler: object }).wapZaehler,
  }));
  expect(nachher).toEqual(vorher);
});

test('[R-L-05] Gegenfall: mit ladbarer Schrift keine Meldung, die Seite wird gezeichnet', async ({
  wapPage,
}) => {
  await harnessBereit(wapPage);
  await zeige(wapPage, probeSeite(), { scale: 1, label: LABEL });
  await expect(
    wapPage.getByRole('document', { name: LABEL }).locator('span[data-wap-item]'),
  ).toHaveCount(2);
  await expect(wapPage.getByRole('alert')).toHaveCount(0);
  const erg = await wapPage.evaluate(async () => (await window.wapHarness?.schrift()) ?? null);
  expect(erg?.map((e) => e.ok)).toEqual([true, true]);
});
