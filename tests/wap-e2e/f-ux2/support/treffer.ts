// F-UX2 P4 (Rückmeldung N4 vom 19.10.2026: «man erwischt oft den falschen Block … ziehen auf nur eine Det-Spalte
// verhält sich nicht immer ganz natürlich»; Beschrieb 5.1; Gestaltung raster-bedienung-v2 §2–3): Messung «falscher
// Eintrag getroffen» über eine dichte fiktive Woche. Soll = der Eintrag, der an der Stelle sichtbar ist (kleinste
// gezeichnete Fläche, die den Punkt enthält). Klicks (wählen) und Ziehen (verschieben/Grösse) an Punkten in der Mitte
// und nahe den Kanten; Ziehen in die schmale Nebenspalte «Det» bei 100 % und 50 %. Die Quote steht in
// test-results/wap/f-ux2-treffer.json (lokal, nicht versioniert). Nur fiktive Daten.
import { writeFileSync } from 'node:fs';
import { expect, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planDicht } from './plaene';

interface Ziel {
  readonly key: string;
  readonly x: number;
  readonly y: number;
}

/** Zufallszahlen mit festem Startwert (gleiche Punkte bei jedem Lauf). */
function zufall(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/**
 * Prüfpunkte je sichtbarem Eintrag: Mitte, 3 px unter der Oberkante und über der Unterkante seiner grössten Fläche;
 * nur Punkte, an denen der Eintrag sichtbar ist (kleinste gezeichnete Fläche, die den Punkt enthält). Nur Punkte im
 * sichtbaren Teil des Rasters.
 */
async function prüfpunkte(page: Page): Promise<Ziel[]> {
  return page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>('.i2-grid-scroll');
    const frame = scroll?.getBoundingClientRect();
    const heads = document.querySelector('.i2-grid-day-head')?.getBoundingClientRect();
    const top = Math.max(frame?.top ?? 0, heads?.bottom ?? 0) + 4;
    const items: { key: string; rects: DOMRect[]; area: number }[] = [];
    for (const hit of document.querySelectorAll<HTMLElement>('.i2-grid-entry-hit[data-entry-id]')) {
      const el = hit.parentElement;
      if (el === null) continue;
      const fills = [
        ...(el.hasAttribute('data-flaeche') ? [el] : []),
        ...el.querySelectorAll<HTMLElement>('[data-flaeche]'),
      ]
        .map((f) => f.getBoundingClientRect())
        .filter((r) => r.width > 2 && r.height > 2);
      const rects = fills.length > 0 ? fills : [el.getBoundingClientRect()];
      items.push({
        key: `${hit.dataset.entryId ?? ''}:${hit.dataset.windowId ?? ''}`,
        rects,
        area: rects.reduce((a, r) => a + r.width * r.height, 0),
      });
    }
    const inside = (r: DOMRect, x: number, y: number) =>
      x >= r.left + 0.5 && x <= r.right - 0.5 && y >= r.top + 0.5 && y <= r.bottom - 0.5;
    const sichtbar = (x: number, y: number): string | null => {
      const hits = items.filter((i) => i.rects.some((r) => inside(r, x, y)));
      hits.sort((a, b) => a.area - b.area);
      return hits[0]?.key ?? null;
    };
    const out: { key: string; x: number; y: number }[] = [];
    for (const i of items) {
      const r = [...i.rects].sort((a, b) => b.width * b.height - a.width * a.height)[0];
      if (r === undefined) continue;
      const x = r.left + r.width / 2;
      for (const y of [r.top + r.height / 2, r.top + 3, r.bottom - 3]) {
        if (y < top || y > (frame?.bottom ?? 0) - 20 || x < (frame?.left ?? 0) + 50) continue;
        if (x > (frame?.right ?? 0) - 20) continue;
        // Nur eindeutige Punkte: auch 2 px daneben ist derselbe Eintrag sichtbar (keine Grenze genau getroffen).
        const eindeutig = [
          [0, 0],
          [2, 0],
          [-2, 0],
          [0, 2],
          [0, -2],
        ].every(([dx, dy]) => sichtbar(x + (dx ?? 0), y + (dy ?? 0)) === i.key);
        if (eindeutig) out.push({ key: i.key, x, y });
      }
    }
    return out;
  });
}

async function gewählt(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.i2-grid-entry-hit[aria-pressed="true"]')].map(
      (h) => `${h.dataset.entryId ?? ''}:${h.dataset.windowId ?? ''}`,
    ),
  );
}

async function namen(page: Page): Promise<Map<string, string>> {
  const list = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.i2-grid-entry-hit[data-entry-id]')].map(
      (h) =>
        [
          `${h.dataset.entryId ?? ''}:${h.dataset.windowId ?? ''}`,
          h.getAttribute('aria-label') ?? '',
        ] as const,
    ),
  );
  return new Map(list);
}

async function detSpalte(page: Page, tag: string) {
  return page.evaluate((t) => {
    const head = [...document.querySelectorAll<HTMLElement>('.i2-grid-day-head')].find((h) =>
      (h.textContent ?? '').includes(t),
    );
    const btn = [...(head?.querySelectorAll<HTMLElement>('.i2-grid-colhead') ?? [])].find(
      (b) => b.getAttribute('aria-label') === 'Spaltenkopf Det',
    );
    const r = btn?.parentElement?.getBoundingClientRect();
    return r === undefined ? null : { left: r.left, right: r.right };
  }, tag);
}

export function registerTrefferTests(url: () => string, bericht: string | null): void {
  test('[R-5.1-01][R-5.1-14] F-UX2 P4: dichte Woche – Klick und Ziehen treffen den sichtbaren Eintrag (Fehltreffer 0), auch nahe den Kanten und nach einer Auswahl', async ({
    wapPage,
  }) => {
    test.setTimeout(240_000);
    await startWith(wapPage, `${url()}#leer`, 'Dicht.wap.json', planFile(planDicht()));
    const punkte = await prüfpunkte(wapPage);
    expect(punkte.length).toBeGreaterThan(150);
    const r = zufall(19102026);
    const klicks = [...punkte].sort(() => r() - 0.5).slice(0, 160);
    let klickFehl = 0;
    const fehler: string[] = [];
    for (const p of klicks) {
      await wapPage.mouse.click(p.x, p.y);
      const sel = await gewählt(wapPage);
      if (sel.length !== 1 || sel[0] !== p.key) {
        klickFehl++;
        fehler.push(`${p.key} @${Math.round(p.x)},${Math.round(p.y)} → ${sel.join('|')}`);
      }
    }
    // Ziehen um 30 Minuten nach unten: genau der Eintrag am Druckpunkt ändert sich; danach Rückgängig.
    // Ziehen nur fern vom unteren Rand (kein Rollen am Rand, A4).
    const unten = await wapPage
      .locator('.i2-grid-scroll')
      .evaluate((n) => n.getBoundingClientRect().bottom);
    const züge = klicks.filter((p, i) => i % 3 === 0 && p.y < unten - 80).slice(0, 40);
    let zugFehl = 0;
    let ohneÄnderung = 0;
    for (const p of züge) {
      const vorher = await namen(wapPage);
      await wapPage.mouse.move(p.x, p.y);
      await wapPage.mouse.down();
      await wapPage.mouse.move(p.x, p.y + 24, { steps: 4 });
      await wapPage.mouse.up();
      try {
        await expect
          .poll(
            async () => {
              const nachher = await namen(wapPage);
              return [...nachher].filter(([k, v]) => vorher.get(k) !== v).length;
            },
            { timeout: 2000 },
          )
          .toBeGreaterThan(0);
      } catch {
        // Nichts geändert: zählt unten als Fehltreffer.
      }
      const nachher = await namen(wapPage);
      const geändert = [...nachher].filter(([k, v]) => vorher.get(k) !== v).map(([k]) => k);
      // Ohne Änderung (z.B. Variante c lehnt ab: Nachbar ganz überdeckt) ist kein Fehltreffer; gezählt wird, wenn
      // ein anderer Eintrag als der am Druckpunkt geändert wurde.
      if (geändert.length === 0) ohneÄnderung++;
      else if (!geändert.includes(p.key)) {
        zugFehl++;
        fehler.push(
          `Zug ${vorher.get(p.key) ?? p.key} @${Math.round(p.x)},${Math.round(p.y)} → ${geändert.join('|')}`,
        );
      }
      if (geändert.length > 0) {
        await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
        await expect.poll(async () => (await namen(wapPage)).get(p.key)).toBe(vorher.get(p.key));
      }
    }
    // Det (schmale Nebenspalte, Mi): Block aus der Nachbarspalte «Sph» in «Det» ziehen, bei 100 % und 50 %.
    let detFehl = 0;
    let detVersuche = 0;
    for (const stufe of ['100 %', '50 %']) {
      if (stufe === '50 %') {
        const k = wapPage.getByRole('button', { name: 'Verkleinern', exact: true });
        await k.click();
        await k.click();
        await expect(wapPage.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText(
          '50 %',
        );
      }
      const det = await detSpalte(wapPage, 'Mi 30.09.2026');
      expect(det).not.toBeNull();
      if (det === null) continue;
      const kandidaten = await wapPage.evaluate(
        ({ left, right }) =>
          [...document.querySelectorAll<HTMLElement>('.i2-grid-entry-hit[data-entry-id]')]
            .map((h) => ({ h, r: h.parentElement?.getBoundingClientRect() }))
            .filter(
              ({ h, r }) =>
                r !== undefined &&
                /^Block (Zugschule|Waffendrill|Theorie Karte|Fahrschule) /.test(
                  h.getAttribute('aria-label') ?? '',
                ) &&
                r.right <= left + 1 &&
                r.right >= left - 80 &&
                r.width < 120,
            )
            .slice(0, 4)
            .map(({ h, r }) => ({
              key: `${h.dataset.entryId ?? ''}:`,
              x: (r?.left ?? 0) + (r?.width ?? 0) / 2,
              y: (r?.top ?? 0) + (r?.height ?? 0) / 2,
              ziel: (left + right) / 2,
            })),
        det,
      );
      // Gezielt wird ungenau: 7 px links bzw. rechts der Mitte der Det-Spalte (bei 50 % ausserhalb ihrer 12 px,
      // innerhalb der Mindest-Trefferbreite 16 px).
      for (const [n, k] of kandidaten.entries()) {
        detVersuche++;
        await wapPage.mouse.move(k.x, k.y);
        await wapPage.mouse.down();
        await wapPage.mouse.move(k.ziel + (n % 2 === 0 ? -7 : 7), k.y, { steps: 6 });
        await wapPage.mouse.up();
        const lage = await wapPage.evaluate((key) => {
          const id = key.split(':')[0] ?? '';
          const h = document.querySelector<HTMLElement>(
            `.i2-grid-entry-hit[data-entry-id="${id}"]`,
          );
          const r = h?.parentElement?.getBoundingClientRect();
          return r === undefined ? null : { left: r.left, right: r.right };
        }, k.key);
        const imDet = lage !== null && lage.left >= det.left - 1.5 && lage.right <= det.right + 1.5;
        if (!imDet) detFehl++;
        else await wapPage.getByRole('button', { name: 'Rückgängig', exact: true }).click();
      }
    }
    const ergebnis = {
      klicks: klicks.length,
      klickFehltreffer: klickFehl,
      zuege: züge.length,
      zugFehltreffer: zugFehl,
      zuegeOhneAenderung: ohneÄnderung,
      detVersuche,
      detFehltreffer: detFehl,
      fehler,
    };
    if (bericht !== null) writeFileSync(bericht, `${JSON.stringify(ergebnis, null, 1)}\n`);
    expect(detVersuche).toBeGreaterThanOrEqual(4);
    expect(ergebnis).toEqual({
      ...ergebnis,
      klickFehltreffer: 0,
      zugFehltreffer: 0,
      detFehltreffer: 0,
    });
  });
}
