// Paket E1-02f: Parität Bildschirm ↔ PDF (R-5-01, Leitplanke 2; Vertrag E1-02f, Notiz «Ausarbeitung Schritt 2»
// Abschnitte B, D, G, J X1, X3 bis X7; Änderungsnotiz CR-03 Nr 5 X9; ADR-004 Punkt 5; ADR-010 §7.4). Für dieselbe
// Eingabe (Plan, Woche, PageOptions) werden die Wochenansicht im Zustand «bereit» und das im selben Tab erzeugte
// PDF (renderWeekPdf, gelesen mit readPdf) Lauf für Lauf, Strich für Strich und Form für Form verglichen.
// Projekt edge (Vite). Pseudonymisierte KVK-Fixture, KVK+, synthetischer Plan und fiktive Varianten; die Pläne
// baut die Node-Seite im Kindprozess.
import { expect } from '@playwright/test';
import { type Konsolenmeldung, konsoleMitschneiden } from '../render/support/messen';
import { test } from '../support/fixtures';
import { edgePdf, keineKonsole, liste, pruefeParitaet, zeigeUndMiss } from './support/ablauf';
import { nodeDaten } from './support/kindprozess';
import {
  bildschirmTexte,
  container,
  harnessBereit,
  messeWoche,
  setzePlan,
  warteBereit,
  ZOOM_100,
  zeigeWoche,
} from './support/messen-woche';
import type { PlanName, VariantenName } from './support/node-seite';
import { anzahlenPdf, vergleicheSeiten } from './support/vergleich';

let konsole: Konsolenmeldung[] = [];
test.beforeEach(({ wapPage }) => {
  konsole = konsoleMitschneiden(wapPage);
});
test.afterEach(() => {
  keineKonsole(konsole);
});

test.describe('Parität KVK, KVK+, Fortsetzung, synthetischer Plan (R-5-01; G, J X1, X3 bis X5)', () => {
  test('[R-5-01] KVK bei scale 1, 4/3 und 2: vergleicheSeiten = [] je Seite; Containerzahl = pageCount = Seiten von readPdf', async ({
    wapPage,
  }) => {
    test.setTimeout(240_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const w = d.wochen.kvk[0];
    expect(w).toBeDefined();
    const weekId = w?.weekId ?? '';
    const pdf = await edgePdf(wapPage, d.plaene.kvk, weekId, 'kvk');
    for (const scale of [1, ZOOM_100, 2]) {
      const m = await zeigeUndMiss(wapPage, d.plaene.kvk, weekId, w?.seiten ?? [], scale);
      pruefeParitaet(m, pdf, `KVK scale ${scale.toFixed(3)}`);
    }
  });

  test('[R-5-01] KVK+ bei scale 4/3: Parität einschliesslich Bildlage des Wappens und Klassifizierungsfeld', async ({
    wapPage,
  }) => {
    test.setTimeout(180_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const plan = d.plaene.kvkPlus;
    const w = d.wochen.kvkPlus[0];
    const weekId = w?.weekId ?? '';
    const pdf = await edgePdf(wapPage, plan, weekId, 'kvk-plus');
    const m = await zeigeUndMiss(wapPage, plan, weekId, w?.seiten ?? [], ZOOM_100);
    expect(pdf.info.imagePlacements.length, 'Bildlage des Wappens im PDF').toBe(1);
    expect(m[0]?.formen.filter((f) => f.art === 'bild').length, 'Wappen am Bildschirm').toBe(1);
    expect(plan.classification).not.toBe('');
    expect(bildschirmTexte(m)).toContain(plan.classification);
    expect(pdf.info.texts.map((t) => t.text)).toContain(plan.classification);
    pruefeParitaet(m, pdf, 'KVK+ scale 4/3');
  });

  test('[R-5-01] (V-02f-2) Fortsetzungsvariante: zwei Seiten, beide mit vergleicheSeiten = []', async ({
    wapPage,
  }) => {
    test.setTimeout(180_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const w = d.wochen.fortsetzung[0];
    const weekId = w?.weekId ?? '';
    expect(w?.seiten.length).toBe(2);
    const pdf = await edgePdf(wapPage, d.plaene.fortsetzung, weekId, 'kvk-fortsetzung');
    expect(pdf.info.pages.length).toBe(2);
    const m = await zeigeUndMiss(wapPage, d.plaene.fortsetzung, weekId, w?.seiten ?? [], ZOOM_100);
    expect(m.map((s) => s.name)).toEqual([
      `Wochenseite ${w?.label ?? ''}`,
      `Fortsetzung 1 – ${w?.label ?? ''}`,
    ]);
    pruefeParitaet(m, pdf, 'Fortsetzung scale 4/3');
  });

  test('[R-5-01] synthetischer Plan, alle vier Wochen bei scale 1: je Woche und Seite vergleicheSeiten = []', async ({
    wapPage,
  }) => {
    test.setTimeout(420_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const plan = d.plaene.synthetisch;
    expect(d.wochen.synthetisch.length).toBe(4);
    for (const w of d.wochen.synthetisch) {
      const pdf = await edgePdf(wapPage, plan, w.weekId, `synthetisch-${w.weekId}`);
      const m = await zeigeUndMiss(wapPage, plan, w.weekId, w.seiten, 1);
      pruefeParitaet(m, pdf, `synthetisch ${w.label}`);
    }
  });
});

test.describe('Gegenprobe des Vergleichers (R-5-01; G9, J X6)', () => {
  test('[R-5-01] Bildschirm der KVK gegen das PDF dreier Varianten mit gleichen Anzahlen: verschobener Block → «lage», ersetzter Buchstabe → «text», andere Füllfarbe → «form»; nie «anzahl»', async ({
    wapPage,
  }) => {
    test.setTimeout(300_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const w = d.wochen.kvk[0];
    const weekId = w?.weekId ?? '';
    const kvkPdf = await edgePdf(wapPage, d.plaene.kvk, weekId, 'x6-kvk');
    const varianten: readonly { name: VariantenName; art: 'lage' | 'text' | 'form' }[] = [
      { name: 'x6Lage', art: 'lage' },
      { name: 'x6Text', art: 'text' },
      { name: 'x6Farbe', art: 'form' },
    ];
    const pdfs = [];
    for (const v of varianten) {
      // Fehler beim Bilden einer Variante melden sich nur hier (TR-E102f-08).
      expect(d.variantenFehler[v.name]).toBeUndefined();
      pdfs.push(await edgePdf(wapPage, d.varianten[v.name]?.plan, weekId, `x6-${v.art}`));
    }
    for (const [i, v] of varianten.entries()) {
      expect(
        anzahlenPdf(pdfs[i]?.info ?? kvkPdf.info),
        `${v.name}: gleiche Anzahlen wie KVK`,
      ).toEqual(anzahlenPdf(kvkPdf.info));
    }
    const m = await zeigeUndMiss(wapPage, d.plaene.kvk, weekId, w?.seiten ?? [], ZOOM_100);
    for (const [i, v] of varianten.entries()) {
      const pdf = pdfs[i];
      expect(pdf).toBeDefined();
      if (pdf === undefined) continue;
      const abw = vergleicheSeiten(m, pdf.info);
      expect(
        abw.filter((a) => a.art === 'anzahl'),
        `${v.name}: keine Abweichung «anzahl»\n${liste(abw)}`,
      ).toEqual([]);
      expect(
        abw.filter((a) => a.art === v.art).length,
        `${v.name}: mindestens eine Abweichung «${v.art}»`,
      ).toBeGreaterThanOrEqual(1);
    }
  });
});

test.describe('Vorbedingung der Fixtures (R-5-01; G8, J X7)', () => {
  test('[R-5-01] zuerst je Container [data-wap-item] = Zahl der TextItem > 0; dann enthält kein Bildschirmtext von KVK, KVK+, Fortsetzung und synthetischem Plan einen Codepunkt aus LINE_EXCLUDED_CODEPOINTS oder einen Zweitcodepunkt aus SHARED_GLYPH_PRIMARY', async ({
    wapPage,
  }) => {
    test.setTimeout(300_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const verboten = (c: number) =>
      d.ausgeschlossen.some(([a, b]) => c >= a && c <= b) || d.zweitCodepunkte.includes(c);
    const faelle: readonly PlanName[] = ['kvk', 'kvkPlus', 'fortsetzung', 'synthetisch'];
    for (const name of faelle) {
      for (const w of d.wochen[name]) {
        const m = await zeigeUndMiss(wapPage, d.plaene[name], w.weekId, w.seiten, 1);
        const texte = bildschirmTexte(m);
        expect(texte.length, `${name} ${w.weekId}: Texte`).toBeGreaterThan(0);
        const treffer = texte
          .flatMap((t) => [...t].map((z) => z.codePointAt(0) ?? 0))
          .filter(verboten)
          .map((c) => `U+${c.toString(16).toUpperCase().padStart(4, '0')}`);
        expect(treffer, `${name} ${w.weekId}: verbotene Codepunkte`).toEqual([]);
      }
    }
  });
});

test.describe('Wappen nicht einbettbar (R-5-01; CR-03 Nr 2, 5 X9)', () => {
  test('[R-5-01] KVK+ mit PNG nur aus IHDR bei scale 4/3: zuerst [data-wap-item] = Zahl der TextItem > 0; kein SVG-image im Container; vergleicheSeiten gegen pdfWoche = []', async ({
    wapPage,
  }) => {
    test.setTimeout(180_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const plan = d.plaene.kvkPlusIhdr;
    const w = d.wochen.kvkPlusIhdr[0];
    const weekId = w?.weekId ?? '';
    await setzePlan(wapPage, plan);
    const z = await zeigeWoche(wapPage, { weekId, scale: ZOOM_100 });
    expect(z).toEqual({ ok: true });
    await warteBereit(wapPage, w?.seiten ?? [], ZOOM_100);
    await expect(container(wapPage).locator('svg image')).toHaveCount(0);
    const m = await messeWoche(wapPage, ZOOM_100);
    expect(m.flatMap((s) => s.formen).filter((f) => f.art === 'bild')).toEqual([]);
    // setzePlan in edgePdf rendert nicht neu; verglichen wird die soeben gemessene Ansicht.
    const pdf = await edgePdf(wapPage, plan, weekId, 'kvk-plus-ihdr');
    expect(pdf.info.images).toBe(0);
    pruefeParitaet(m, pdf, 'KVK+ mit PNG nur aus IHDR');
  });
});

test.describe('Nie ein ungeprüftes Wappen am Bildschirm (R-5-01; CR-03 Nr 3; Notiz Test-Review Runde 1 Nr 2, X10)', () => {
  test('[R-5-01] KVK bereit; danach KVK+ mit PNG (leeres IDAT, von sanitizeImageBytes angenommen, von pdf-lib abgelehnt): zu keinem Zeitpunkt ein SVG-image; danach vergleicheSeiten gegen pdfWoche = []', async ({
    wapPage,
  }) => {
    test.setTimeout(180_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const kvk = d.wochen.kvk[0];
    await setzePlan(wapPage, d.plaene.kvk);
    expect(await zeigeWoche(wapPage, { weekId: kvk?.weekId ?? '', scale: ZOOM_100 })).toEqual({
      ok: true,
    });
    await warteBereit(wapPage, kvk?.seiten ?? [], ZOOM_100);
    expect(d.x10Vorbedingung).toBe(true);
    expect(d.variantenFehler.x10).toBeUndefined();
    const x10 = d.varianten.x10;
    const w = x10?.wochen[0];
    const weekId = w?.weekId ?? '';
    expect(x10?.neu.length).toBeGreaterThan(0);

    await wapPage.evaluate(() => {
      const stand = { bild: false };
      const wurzel = document.getElementById('root');
      const pruefe = () => {
        if (wurzel?.querySelector('[role="document"] svg image') != null) stand.bild = true;
      };
      const beobachter = new MutationObserver(pruefe);
      if (wurzel !== null) {
        beobachter.observe(wurzel, { subtree: true, childList: true, attributes: true });
      }
      pruefe();
      (window as unknown as { wapX10: { stand: typeof stand; ende: () => void } }).wapX10 = {
        stand,
        ende: () => beobachter.disconnect(),
      };
    });
    await setzePlan(wapPage, x10?.plan);
    expect(await zeigeWoche(wapPage, { weekId, scale: ZOOM_100 })).toEqual({ ok: true });
    await expect
      .poll(
        () =>
          wapPage.evaluate((neu) => {
            const da = new Set(
              [...document.querySelectorAll('#root [data-wap-item]')].map((e) => e.textContent),
            );
            return neu.every((t) => da.has(t));
          }, x10?.neu ?? []),
        { timeout: 30_000 },
      )
      .toBe(true);
    await warteBereit(wapPage, w?.seiten ?? [], ZOOM_100);
    const m = await messeWoche(wapPage, ZOOM_100);
    const bild = await wapPage.evaluate(() => {
      const x = (window as unknown as { wapX10: { stand: { bild: boolean }; ende: () => void } })
        .wapX10;
      x.ende();
      return x.stand.bild;
    });
    expect(bild).toBe(false);
    await expect(container(wapPage).locator('svg image')).toHaveCount(0);
    expect(m.flatMap((s) => s.formen).filter((f) => f.art === 'bild')).toEqual([]);
    const pdf = await edgePdf(wapPage, x10?.plan, weekId, 'x10-leeres-idat');
    expect(pdf.info.images).toBe(0);
    pruefeParitaet(m, pdf, 'KVK+ mit PNG (leeres IDAT)');
  });
});

test.describe('Erstes Zeichnen mit ungeprüftem Wappen (R-5-01; CR-03 Nr 3; TR-E102f-11)', () => {
  test('[R-5-01] KVK bereit; unbekannte Woche setzt die Ansicht über die Fehlergrenze zurück; neue Ansicht KVK+ mit PNG (leeres IDAT) bei bereiter Schrift: zu keinem Zeitpunkt ein SVG-image', async ({
    wapPage,
  }) => {
    test.setTimeout(120_000);
    const d = await nodeDaten();
    await harnessBereit(wapPage);
    const kvk = d.wochen.kvk[0];
    await setzePlan(wapPage, d.plaene.kvk);
    expect(await zeigeWoche(wapPage, { weekId: kvk?.weekId ?? '', scale: ZOOM_100 })).toEqual({
      ok: true,
    });
    await warteBereit(wapPage, kvk?.seiten ?? [], ZOOM_100);
    expect(await zeigeWoche(wapPage, { weekId: 'w-fehlt', scale: ZOOM_100 })).toMatchObject({
      ok: false,
      code: 'unknownWeek',
    });
    await expect(container(wapPage)).toHaveCount(0);
    expect(d.x10Vorbedingung).toBe(true);
    expect(d.variantenFehler.x10).toBeUndefined();
    const x10 = d.varianten.x10;
    const w = x10?.wochen[0];

    await wapPage.evaluate(() => {
      const stand = { bild: false };
      const wurzel = document.getElementById('root');
      const pruefe = () => {
        if (wurzel?.querySelector('[role="document"] svg image') != null) stand.bild = true;
      };
      const beobachter = new MutationObserver(pruefe);
      if (wurzel !== null) {
        beobachter.observe(wurzel, { subtree: true, childList: true, attributes: true });
      }
      pruefe();
      (window as unknown as { wapX10e: { stand: typeof stand; ende: () => void } }).wapX10e = {
        stand,
        ende: () => beobachter.disconnect(),
      };
    });
    await setzePlan(wapPage, x10?.plan);
    expect(await zeigeWoche(wapPage, { weekId: w?.weekId ?? '', scale: ZOOM_100 })).toEqual({
      ok: true,
    });
    await warteBereit(wapPage, w?.seiten ?? [], ZOOM_100);
    await expect(container(wapPage).locator('svg image')).toHaveCount(0);
    const bild = await wapPage.evaluate(() => {
      const x = (window as unknown as { wapX10e: { stand: { bild: boolean }; ende: () => void } })
        .wapX10e;
      x.ende();
      return x.stand.bild;
    });
    expect(bild).toBe(false);
  });
});
