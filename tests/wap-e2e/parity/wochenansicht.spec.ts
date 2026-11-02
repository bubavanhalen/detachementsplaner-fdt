// Paket E1-02f: Wochenansicht am Bildschirm (R-5-01, R-L-05; Vertrag E1-02f, Notiz «Ausarbeitung Schritt 2»
// Abschnitte C «Fehlerverhalten», D1 bis D4, J W1 bis W6; Änderungsnotiz CR-03 Nr 3, 5 W8; V-02f-2). Aufbau,
// Namen, Abstand der Seiten, Overlay, Zustände der Bildschirmschrift, unbekannte Woche, Zoom und Neuberechnung.
// Zugriff über Rolle und Name; Projekt edge (Vite). Pseudonymisierte KVK-Fixture, KVK+ und fiktive Varianten aus
// der Node-Seite.
import { expect } from '@playwright/test';
import { type Konsolenmeldung, konsoleMitschneiden } from '../render/support/messen';
import { test } from '../support/fixtures';
import { edgePdf, keineKonsole, pruefeParitaet } from './support/ablauf';
import { nodeDaten } from './support/kindprozess';
import {
  container,
  harnessBereit,
  messeWoche,
  setzePlan,
  TOL_PX,
  warteBereit,
  ZOOM_100,
  zeigeWoche,
} from './support/messen-woche';

/** Texte der Meldung bei fehlender Bildschirmschrift (Vertrag E1-02c 3.3, SCREEN_FONT_MESSAGE). */
const URSACHE =
  'Die Schrift des WAP-Planers konnte nicht geladen werden. Ohne sie würden Umbrüche vom PDF abweichen.';
const NAECHSTER_SCHRITT =
  'Seite neu laden. Bleibt der Fehler, die Datei des WAP-Planers neu herunterladen.';

/** Abstand der Seiten in px, unabhängig vom Zoom (D1, V-02f-2). */
const ABSTAND_PX = 16;

let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  keineKonsole(konsole);
});

test.describe('Aufbau und Namen (R-5-01; D1, D2, J W1, V-02f-2)', () => {
  test('[R-5-01] (V-02f-2) KVK: genau ein document «Wochenseite KVK»; Fortsetzungsvariante: «Wochenseite KVK», «Fortsetzung 1 – KVK» untereinander, gleiche linke Kante, 16 px Abstand bei scale 1 und 2; mit zwei Fortsetzungsseiten zusätzlich «Fortsetzung 2 – KVK»', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const kvk = d.wochen.kvk[0];
    await setzePlan(wapPage, d.plaene.kvk);
    expect(await zeigeWoche(wapPage, { weekId: kvk?.weekId ?? '', scale: 1 })).toEqual({
      ok: true,
    });
    await warteBereit(wapPage, kvk?.seiten ?? [], 1);
    await expect(container(wapPage)).toHaveCount(1);
    await expect(
      wapPage.getByRole('document', { name: `Wochenseite ${kvk?.label ?? ''}` }),
    ).toHaveCount(1);
    expect(kvk?.label).toBe('KVK');

    const f = d.wochen.fortsetzung[0];
    expect(f?.seiten.length).toBe(2);
    await setzePlan(wapPage, d.plaene.fortsetzung);
    for (const scale of [1, 2]) {
      expect(await zeigeWoche(wapPage, { weekId: f?.weekId ?? '', scale })).toEqual({ ok: true });
      await warteBereit(wapPage, f?.seiten ?? [], scale);
      const m = await messeWoche(wapPage, scale);
      expect(m.map((s) => s.name)).toEqual(['Wochenseite KVK', 'Fortsetzung 1 – KVK']);
      const [a, b] = m;
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      if (a === undefined || b === undefined) return;
      expect(
        Math.abs(a.box.x - b.box.x),
        `scale ${String(scale)}: linke Kante`,
      ).toBeLessThanOrEqual(TOL_PX);
      expect(
        Math.abs(b.box.y - (a.box.y + a.box.h) - ABSTAND_PX),
        `scale ${String(scale)}: Oberkante 2 = Unterkante 1 + 16 px`,
      ).toBeLessThanOrEqual(TOL_PX);
    }

    // Zwei Fortsetzungsseiten: k zählt weiter (D2, TR-E102f-07).
    expect(d.variantenFehler.fortsetzung2).toBeUndefined();
    const f2 = d.varianten.fortsetzung2?.wochen[0];
    expect(f2?.seiten.length).toBe(3);
    await setzePlan(wapPage, d.varianten.fortsetzung2?.plan);
    expect(await zeigeWoche(wapPage, { weekId: f2?.weekId ?? '', scale: 1 })).toEqual({ ok: true });
    await warteBereit(wapPage, f2?.seiten ?? [], 1);
    const m2 = await messeWoche(wapPage, 1);
    expect(m2.map((s) => s.name)).toEqual([
      'Wochenseite KVK',
      'Fortsetzung 1 – KVK',
      'Fortsetzung 2 – KVK',
    ]);
    for (let i = 1; i < m2.length; i++) {
      const oben = m2[i - 1];
      const unten = m2[i];
      expect(Math.abs((unten?.box.x ?? 0) - (oben?.box.x ?? 1))).toBeLessThanOrEqual(TOL_PX);
      expect(
        Math.abs((unten?.box.y ?? 0) - ((oben?.box.y ?? 0) + (oben?.box.h ?? 0)) - ABSTAND_PX),
      ).toBeLessThanOrEqual(TOL_PX);
    }
  });
});

test.describe('Overlay nur auf der Wochenseite (R-5-01; D3, J W2)', () => {
  test('[R-5-01] (V-02f-2) Overlay «Prüfmarke» nur im ersten Container; mit semanticsProvidedByOverlay ist nur dessen Papier aria-hidden, nicht das der Fortsetzungsseite', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const f = d.wochen.fortsetzung[0];
    const weekId = f?.weekId ?? '';
    await setzePlan(wapPage, d.plaene.fortsetzung);
    expect(await zeigeWoche(wapPage, { weekId, scale: 1, overlay: true })).toEqual({ ok: true });
    const c = container(wapPage);
    await expect(c.nth(0).getByRole('button', { name: 'Prüfmarke' })).toHaveCount(1, {
      timeout: 30_000,
    });
    await warteBereit(wapPage, f?.seiten ?? [], 1);
    await expect(c.nth(1).getByRole('button', { name: 'Prüfmarke' })).toHaveCount(0);
    await expect(wapPage.getByRole('button', { name: 'Prüfmarke' })).toHaveCount(1);
    await expect(c.nth(0).locator(':scope > :first-child')).not.toHaveAttribute(
      'aria-hidden',
      'true',
    );

    expect(
      await zeigeWoche(wapPage, {
        weekId,
        scale: 1,
        overlay: true,
        semanticsProvidedByOverlay: true,
      }),
    ).toEqual({ ok: true });
    await expect(c.nth(0).locator(':scope > :first-child')).toHaveAttribute('aria-hidden', 'true');
    await expect(c.nth(1).locator(':scope > :first-child')).not.toHaveAttribute(
      'aria-hidden',
      'true',
    );
    await expect(c.nth(1).locator('span[data-wap-item]')).toHaveCount(
      f?.seiten[1]?.textItems ?? -1,
    );
    await expect(c.nth(0).getByRole('button', { name: 'Prüfmarke' })).toHaveCount(1);
  });
});

test.describe('Zustände der Bildschirmschrift (R-5-01, R-L-05; D3, T-4, J W3, W4)', () => {
  test('[R-5-01][R-L-05] Fortsetzungsvariante, Schrift gesperrt (FontFace entfernt): genau ein alert mit Ursache und nächstem Schritt, kein document, kein [data-wap-item]', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    await wapPage.addInitScript(() => {
      Reflect.deleteProperty(window, 'FontFace');
    });
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    await setzePlan(wapPage, d.plaene.fortsetzung);
    expect(
      await zeigeWoche(wapPage, { weekId: d.wochen.fortsetzung[0]?.weekId ?? '', scale: 1 }),
    ).toEqual({ ok: true });
    const meldung = wapPage.getByRole('alert');
    await expect(meldung).toHaveCount(1);
    const absaetze = meldung.locator('p');
    await expect(absaetze).toHaveCount(2);
    await expect(absaetze.nth(0)).toHaveText(URSACHE);
    await expect(absaetze.nth(1)).toHaveText(NAECHSTER_SCHRITT);
    await expect(container(wapPage)).toHaveCount(0);
    await expect(wapPage.locator('[data-wap-item]')).toHaveCount(0);
    await expect(wapPage.getByRole('alert')).toHaveCount(1);
  });

  test('[R-5-01] (V-02f-2) Schrift hinter einem Tor: zwei document mit aria-busy, leer, in Seitengrösse, kein alert; nach dem Öffnen kein aria-busy und die Zeilen', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    await wapPage.addInitScript(() => {
      let oeffnen: () => void = () => {};
      const tor = new Promise<void>((r) => {
        oeffnen = r;
      });
      (window as unknown as { wapTorOeffnen: () => void }).wapTorOeffnen = () => oeffnen();
      const laden = FontFace.prototype.load;
      FontFace.prototype.load = function (this: FontFace) {
        return tor.then(() => laden.call(this));
      };
    });
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const f = d.wochen.fortsetzung[0];
    await setzePlan(wapPage, d.plaene.fortsetzung);
    expect(await zeigeWoche(wapPage, { weekId: f?.weekId ?? '', scale: 1 })).toEqual({ ok: true });
    const c = container(wapPage);
    await expect(wapPage.locator('#root [role="document"][aria-busy="true"]')).toHaveCount(2);
    await expect(c).toHaveCount(2);
    await expect(wapPage.locator('[data-wap-item]')).toHaveCount(0);
    await expect(wapPage.getByRole('alert')).toHaveCount(0);
    await expect(wapPage.getByRole('document', { name: 'Wochenseite KVK' })).toHaveCount(1);
    await expect(wapPage.getByRole('document', { name: 'Fortsetzung 1 – KVK' })).toHaveCount(1);
    for (const [i, s] of (f?.seiten ?? []).entries()) {
      expect(
        await c.nth(i).evaluate((el) => el.childElementCount),
        `Platzhalter ${String(i + 1)} leer`,
      ).toBe(0);
      const b = await c.nth(i).boundingBox();
      expect(Math.abs((b?.width ?? 0) - s.widthPt)).toBeLessThanOrEqual(TOL_PX);
      expect(Math.abs((b?.height ?? 0) - s.heightPt)).toBeLessThanOrEqual(TOL_PX);
    }
    await wapPage.evaluate(() =>
      (window as unknown as { wapTorOeffnen: () => void }).wapTorOeffnen(),
    );
    await warteBereit(wapPage, f?.seiten ?? [], 1);
    await expect(wapPage.locator('#root [aria-busy="true"]')).toHaveCount(0);
  });
});

test.describe('Unbekannte Woche (R-5-01; C, J W5)', () => {
  test('[R-5-01] zuerst KVK mit bekannter Woche bereit; danach unbekannte Woche: zeigeWoche ergibt ok false mit ModelError «unknownWeek», kein document', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const kvk = d.wochen.kvk[0];
    await setzePlan(wapPage, d.plaene.kvk);
    expect(await zeigeWoche(wapPage, { weekId: kvk?.weekId ?? '', scale: 1 })).toEqual({
      ok: true,
    });
    await warteBereit(wapPage, kvk?.seiten ?? [], 1);
    const r = await zeigeWoche(wapPage, { weekId: 'w-fehlt', scale: 1 });
    expect(r).toMatchObject({ ok: false, name: 'ModelError', code: 'unknownWeek' });
    await expect(container(wapPage)).toHaveCount(0);
    await expect(wapPage.locator('[data-wap-item]')).toHaveCount(0);
    // Nach dem gefangenen Fehler zeigt der nächste Aufruf die bekannte Woche wieder.
    expect(await zeigeWoche(wapPage, { weekId: kvk?.weekId ?? '', scale: 1 })).toEqual({
      ok: true,
    });
    await warteBereit(wapPage, kvk?.seiten ?? [], 1);
  });
});

test.describe('Zoom ändert nur die Darstellung (R-5-01; D4, J W6)', () => {
  test('[R-5-01] KVK bei scale 1, danach 2: je Seite gleiche Zahl und gleiche Texte der Zeilen; Containergrösse = Seitengrösse · scale ± 1/64 px', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const kvk = d.wochen.kvk[0];
    const weekId = kvk?.weekId ?? '';
    await setzePlan(wapPage, d.plaene.kvk);
    expect(await zeigeWoche(wapPage, { weekId, scale: 1 })).toEqual({ ok: true });
    await warteBereit(wapPage, kvk?.seiten ?? [], 1);
    const eins = await messeWoche(wapPage, 1);
    const texte = (m: typeof eins) =>
      m.map((s) => s.zeilen.map((z) => z.laeufe.map((l) => l.text).join('')));
    expect(texte(eins)).toEqual(kvk?.seiten.map((s) => s.zeilen));
    expect(await zeigeWoche(wapPage, { weekId, scale: 2 })).toEqual({ ok: true });
    await warteBereit(wapPage, kvk?.seiten ?? [], 2);
    const zwei = await messeWoche(wapPage, 2);
    expect(zwei.map((s) => s.zeilen.length)).toEqual(eins.map((s) => s.zeilen.length));
    expect(texte(zwei)).toEqual(texte(eins));
    for (const [i, s] of (kvk?.seiten ?? []).entries()) {
      expect(Math.abs((zwei[i]?.box.w ?? 0) - s.widthPt * 2)).toBeLessThanOrEqual(TOL_PX);
      expect(Math.abs((zwei[i]?.box.h ?? 0) - s.heightPt * 2)).toBeLessThanOrEqual(TOL_PX);
    }
  });
});

test.describe('Neuberechnung ohne Zwischenzustand (R-5-01; CR-03 Nr 3, 5 W8)', () => {
  test('[R-5-01] KVK+ mit gültigem Wappen bereit; nach neuem Plan (geänderter Blocktitel, neues Wappen-Objekt) bis zum neuen Ergebnis nie aria-busy und nie ein Container ohne Zeilen; danach der geänderte Titel', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const plus = d.wochen.kvkPlus[0];
    const weekId = plus?.weekId ?? '';
    await setzePlan(wapPage, d.plaene.kvkPlus);
    expect(await zeigeWoche(wapPage, { weekId, scale: ZOOM_100 })).toEqual({ ok: true });
    await warteBereit(wapPage, plus?.seiten ?? [], ZOOM_100);
    expect(d.variantenFehler.w8).toBeUndefined();
    const w8 = d.varianten.w8;
    expect(w8?.neu.length).toBeGreaterThan(0);

    await wapPage.evaluate(() => {
      const stand = { busy: false, ohneZeilen: false, mutationen: 0 };
      const pruefe = () => {
        const wurzel = document.getElementById('root');
        if (wurzel === null) return;
        if (wurzel.querySelector('[aria-busy="true"]') !== null) stand.busy = true;
        const cs = [...wurzel.querySelectorAll('[role="document"]')];
        if (cs.length === 0 || cs.some((c) => c.querySelectorAll('[data-wap-item]').length === 0)) {
          stand.ohneZeilen = true;
        }
      };
      const beobachter = new MutationObserver(() => {
        stand.mutationen += 1;
        pruefe();
      });
      const wurzel = document.getElementById('root');
      if (wurzel !== null) {
        beobachter.observe(wurzel, {
          subtree: true,
          childList: true,
          attributes: true,
          attributeFilter: ['aria-busy'],
        });
      }
      pruefe();
      (window as unknown as { wapW8: { stand: typeof stand; ende: () => void } }).wapW8 = {
        stand,
        ende: () => beobachter.disconnect(),
      };
    });
    await setzePlan(wapPage, w8?.plan);
    expect(await zeigeWoche(wapPage, { weekId, scale: ZOOM_100 })).toEqual({ ok: true });
    const neu = w8?.neu[0] ?? '';
    await expect
      .poll(
        () =>
          wapPage.evaluate(
            (t) =>
              [...document.querySelectorAll('#root [data-wap-item]')].some(
                (e) => e.textContent === t,
              ),
            neu,
          ),
        { timeout: 30_000 },
      )
      .toBe(true);
    const stand = await wapPage.evaluate(() => {
      const w8 = (
        window as unknown as {
          wapW8: { stand: { busy: boolean; ohneZeilen: boolean }; ende: () => void };
        }
      ).wapW8;
      w8.ende();
      return w8.stand;
    });
    expect(stand).toEqual(expect.objectContaining({ busy: false, ohneZeilen: false }));
    await warteBereit(wapPage, w8?.wochen[0]?.seiten ?? [], ZOOM_100);
    const texte = await container(wapPage).nth(0).locator('span[data-wap-item]').allTextContents();
    for (const t of w8?.neu ?? []) expect(texte).toContain(t);
  });
});

test.describe('Andere Optionen am Bildschirm (R-5-01; B3, D4, G1; Notiz Test-Review Runde 1 Nr 4, W9)', () => {
  test('[R-5-01] gleicher Plan, zuerst ohne, dann mit standOverride 01.10.2026 (nur zeigeWoche): danach die Zeilen des Layouts mit dieser Option und vergleicheSeiten gegen pdfWoche mit demselben standOverride = []', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const kvk = d.wochen.kvk[0];
    const weekId = kvk?.weekId ?? '';
    await setzePlan(wapPage, d.plaene.kvk);
    expect(await zeigeWoche(wapPage, { weekId, scale: ZOOM_100 })).toEqual({ ok: true });
    await warteBereit(wapPage, kvk?.seiten ?? [], ZOOM_100);
    const { standOverride, wochen } = d.stand;
    const soll = wochen[0]?.seiten.map((s) => s.zeilen);
    expect(soll).not.toEqual(kvk?.seiten.map((s) => s.zeilen));
    expect(await zeigeWoche(wapPage, { weekId, scale: ZOOM_100, standOverride })).toEqual({
      ok: true,
    });
    await expect
      .poll(() =>
        wapPage.evaluate(() =>
          [...document.querySelectorAll('#root [role="document"]')].map((c) =>
            [...c.querySelectorAll('span[data-wap-item]')].map((e) => e.textContent ?? ''),
          ),
        ),
      )
      .toEqual(soll);
    await warteBereit(wapPage, wochen[0]?.seiten ?? [], ZOOM_100);
    const m = await messeWoche(wapPage, ZOOM_100);
    const pdf = await edgePdf(wapPage, d.plaene.kvk, weekId, 'w9-stand', { standOverride });
    pruefeParitaet(m, pdf, 'KVK mit standOverride');
  });
});
