// Paket E1-02l (R-10-54, R-10-55, R-14.3-04): Bildschirmraster aus der Layout-Schicht. In beiden Demoplänen
// («Realistisch» mit pseudonymisierten KVK-Daten und fiktiver FDT-Woche, «Belastungstest» fiktiv) und allen Wochen:
// keine Kürzung «…» in Spaltenköpfen, Rapportkürzeln und Beso-Nummern, vollständige Köpfe, keine fehlerhaften
// Überlappungen. Gewollt sind nur Beso-Kästchen über Blöcken und Marker über Einträgen (Beschrieb 4.6); gemessen
// wird im DOM (gefüllte Flächen der Ansichten, Zeichenumrisse der Textzeilen).
import { expect, type Page } from '@playwright/test';
import { test } from '../support/fixtures';

const URL = '/tests/wap-e2e/harness/e1-02l.html';

interface Zaehlung {
  readonly eintraege: number;
  readonly fehler: readonly string[];
  readonly gewollt: number;
  readonly ellipsen: number;
  readonly koepfe: readonly string[];
}

async function zaehle(page: Page): Promise<Zaehlung> {
  return page.evaluate(() => {
    type R = { x: number; y: number; w: number; h: number };
    const rect = (q: DOMRect): R => ({ x: q.x, y: q.y, w: q.width, h: q.height });
    const schnitt = (a: R, b: R) =>
      Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x) > 0.5 &&
      Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) > 0.5;
    const innen = (t: R, a: R) =>
      t.x >= a.x - 0.5 &&
      t.y >= a.y - 0.5 &&
      t.x + t.w <= a.x + a.w + 0.5 &&
      t.y + t.h <= a.y + a.h + 0.5;
    const texte = (el: Element): R[] => {
      const out: R[] = [];
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n !== null; n = w.nextNode()) {
        if ((n.textContent ?? '').trim() === '') continue;
        const r = document.createRange();
        r.selectNodeContents(n);
        for (const q of r.getClientRects()) out.push(rect(q));
      }
      return out;
    };
    const eintraege = [...document.querySelectorAll('.i2-grid-entry')].map((e) => {
      const art =
        [...e.classList].find((c) => /^i2-grid-(block|rapport|beso|marker|querbalken)$/.test(c)) ??
        '';
      // Gefüllte Flächen: das Element der Ansicht selbst (ein Rechteck) bzw. seine Formen (Teilstücke, Träger).
      const flaechen = [
        ...(e.hasAttribute('data-flaeche') ? [e] : []),
        ...e.querySelectorAll('[data-flaeche]'),
      ].map((p) => {
        // Der Rahmen liegt wie im PDF mittig auf der Kante: Fläche = Rahmenbox abzüglich halber Rahmenbreite.
        const r = rect(p.getBoundingClientRect());
        const d = Number.parseFloat(getComputedStyle(p).borderTopWidth) / 2 || 0;
        return { x: r.x + d, y: r.y + d, w: r.w - 2 * d, h: r.h - 2 * d };
      });
      const id = e.querySelector('[data-entry-id]')?.getAttribute('data-entry-id') ?? '';
      return { e, id, art: art.slice(8), flaechen, texte: texte(e) };
    });
    const fehler: string[] = [];
    let gewollt = 0;
    for (let i = 0; i < eintraege.length; i++) {
      for (let j = i + 1; j < eintraege.length; j++) {
        const a = eintraege[i];
        const b = eintraege[j];
        if (a === undefined || b === undefined || a.id === b.id) continue;
        if (a.flaechen.some((x) => b.flaechen.some((y) => schnitt(x, y)))) {
          const paar = [a.art, b.art].sort().join('/');
          if (paar === 'beso/block' || paar.includes('marker')) gewollt++;
          else fehler.push(`Fläche ${paar}`);
        }
        for (const s of a.texte)
          for (const t of b.texte)
            if (schnitt(s, t)) fehler.push(`Text über Text ${a.art}/${b.art}`);
      }
    }
    for (const a of eintraege)
      for (const t of a.texte)
        if (!a.flaechen.some((f) => innen(t, f))) fehler.push(`Text ausserhalb ${a.art}`);
    const koepfeEl = [...document.querySelectorAll('.i2-grid-column-heads')];
    const kopfTexte = koepfeEl.flatMap((h) => texte(h.querySelector('.i2-grid-lines') ?? h));
    for (let i = 0; i < kopfTexte.length; i++)
      for (let j = i + 1; j < kopfTexte.length; j++) {
        const a = kopfTexte[i];
        const b = kopfTexte[j];
        if (a !== undefined && b !== undefined && schnitt(a, b)) fehler.push('Kopf über Kopf');
      }
    let ellipsen = 0;
    for (const a of eintraege)
      if ((a.art === 'rapport' || a.art === 'beso') && (a.e.textContent ?? '').includes('…'))
        ellipsen++;
    for (const h of koepfeEl) if ((h.textContent ?? '').includes('…')) ellipsen++;
    const koepfe = koepfeEl.map((h) =>
      (h.querySelector('.i2-grid-lines')?.textContent ?? '').replace(/-/g, ''),
    );
    return { eintraege: eintraege.length, fehler, gewollt, ellipsen, koepfe };
  });
}

test('[R-10-54][R-10-55][R-14.3-04] E1-02l: in beiden Demoplänen und allen Wochen keine «…» in Köpfen, Rapporten und Beso, Köpfe vollständig, keine fehlerhafte Überlappung', async ({
  wapPage,
}) => {
  await wapPage.goto(URL);
  const woche = wapPage.getByRole('combobox', { name: 'Woche', exact: true });
  await expect(woche).toBeVisible();
  for (const demo of ['Realistisch', 'Belastungstest']) {
    await wapPage
      .getByRole('combobox', { name: 'Demoplan', exact: true })
      .selectOption({ label: demo });
    const n = await woche.locator('option').count();
    expect(n).toBeGreaterThan(1);
    for (let i = 0; i < n; i++) {
      await woche.selectOption({ index: i });
      await expect(wapPage.locator('.i2-grid-entry').first()).toBeVisible();
      const z = await zaehle(wapPage);
      expect(z.eintraege, `${demo} Woche ${String(i)}: Einträge`).toBeGreaterThan(0);
      expect(z.fehler, `${demo} Woche ${String(i)}: Überlappungen`).toEqual([]);
      expect(z.ellipsen, `${demo} Woche ${String(i)}: «…»`).toBe(0);
      // Vollständig: jeder Spaltenname des Tages steht (ohne Leerraum, ohne Trennstrich) in seinem Kopfbereich.
      const namen = await wapPage
        .getByRole('button', { name: /^Spaltenkopf / })
        .evaluateAll((els) => els.map((e) => (e.getAttribute('aria-label') ?? '').slice(12)));
      const alle = z.koepfe.join('|').replace(/\s/g, '');
      for (const name of namen) {
        const soll = name.replace(/\s/g, '');
        if (soll === 'Beso' || soll === 'Rap') continue;
        expect(alle, `${demo} Woche ${String(i)}: Kopf «${name}»`).toContain(soll);
      }
    }
  }
  // Im Belastungstest gibt es gewollte Überdeckungen (Beso über Block, Marker); sie sind keine Fehler.
  const z = await zaehle(wapPage);
  expect(z.gewollt).toBeGreaterThan(0);
});

test('[R-10-54] E1-02l: langer Spaltenname in schmaler Spalte – Kopf vollständig, nie überlappend, Befund «zu viele Spalten für diesen Tag» mit Ursache und nächstem Schritt', async ({
  wapPage,
}) => {
  await wapPage.goto(URL);
  const name = 'Ausbildungsdetachement Munition und Fahrschulgarten';
  await wapPage.getByRole('button', { name: 'Spaltenkopf Det' }).first().press('F2');
  await wapPage.getByRole('textbox', { name: 'Spaltenname' }).fill(name);
  await wapPage.keyboard.press('Enter');
  await wapPage.getByRole('button', { name: 'Nur dieser Tag' }).click();
  await expect(wapPage.getByRole('button', { name: `Spaltenkopf ${name}` })).toBeVisible();
  const befund = wapPage.getByRole('img', { name: /^Zu viele Spalten für diesen Tag/ });
  await expect(befund).toHaveCount(1);
  await expect(befund).toHaveAttribute('aria-label', /Spalten schmaler stellen/);
  const z = await zaehle(wapPage);
  expect(z.fehler).toEqual([]);
  expect(z.ellipsen).toBe(0);
  expect(z.koepfe.join('|').replace(/\s/g, '')).toContain(name.replace(/\s/g, ''));
});
