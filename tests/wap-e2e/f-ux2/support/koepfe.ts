// F-UX2 Runde 2 (visual-qa-2: VQA-2-01 blockierend, VQA-2-02 hoch; Beschrieb 5, R-5-01): Spaltenköpfe am Bildschirm
// mit denselben Zeilen (Trennung) wie im PDF; Terminbereich mit «Was»-Zeile, die erste Terminzeile liegt unter ihr im
// selben Abstand wie auf der Wochenseite. Fiktive Daten.
import { readFileSync } from 'node:fs';
import { expect } from '@playwright/test';
import { readPdf } from '../../../wap/support/pdf/read';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planKoepfe } from './plaene';

export function registerKoepfeTests(url: () => string): void {
  test('[R-5-01] F-UX2 VQA-2-01/-02: Spaltenköpfe wie im PDF (gleiche Trennung), Termine unter der «Was»-Zeile im Abstand der Wochenseite', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Koepfe.wap.json', planFile(planKoepfe()));
    const dom = await wapPage.evaluate(() => {
      const heads = [
        ...document.querySelectorAll<HTMLElement>('.i2-grid-column-heads .i2-grid-line'),
      ].map((l) => l.textContent ?? '');
      const mo = document.querySelector<HTMLElement>(
        'td.i2-grid-agenda[aria-label^="Terminbereich Mo"]',
      );
      const was = [...(mo?.querySelectorAll<HTMLElement>('.i2-grid-line') ?? [])].find(
        (l) => l.textContent === 'Was',
      );
      const first = mo?.querySelector<HTMLElement>('.i2-grid-agenda-line .i2-grid-line');
      return {
        heads,
        was: was === undefined ? null : was.getBoundingClientRect().top,
        first: first === null || first === undefined ? null : first.getBoundingClientRect().top,
        firstText: first?.textContent ?? '',
        firstFont:
          first === null || first === undefined
            ? 0
            : Number.parseFloat(getComputedStyle(first).fontSize),
      };
    });
    const pending = wapPage.waitForEvent('download');
    await wapPage.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
    await wapPage
      .getByRole('dialog', { name: 'PDF dieser Woche', exact: true })
      .getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ })
      .click();
    const pfad = await (await pending).path();
    if (pfad === null) throw new Error('PDF fehlt.');
    const pdf = await readPdf(new Uint8Array(readFileSync(pfad)));
    const texte = new Map<string, number>();
    for (const t of pdf.texts) texte.set(t.text, (texte.get(t.text) ?? 0) + 1);
    // VQA-2-01: jede Kopfzeile des Bildschirms steht so im PDF (u.a. die Trennung von «SERVIZIO»).
    expect(dom.heads.length).toBeGreaterThan(10);
    const fehlt = dom.heads.filter((h) => {
      const n = texte.get(h) ?? 0;
      if (n > 0) texte.set(h, n - 1);
      return n === 0;
    });
    expect(fehlt, 'Kopfzeilen, die im PDF fehlen').toEqual([]);
    // VQA-2-02: «Was» und Abstand zur ersten Terminzeile wie auf der Seite.
    expect(dom.was, '«Was»-Zeile im Terminbereich Mo').not.toBeNull();
    expect(dom.first).not.toBeNull();
    const wasPdf = pdf.texts.find((t) => t.text === 'Was');
    const firstPdf = pdf.texts.find((t) => t.text === dom.firstText);
    if (wasPdf === undefined || firstPdf === undefined || dom.was === null || dom.first === null)
      throw new Error('Termine fehlen im PDF');
    const f = dom.firstFont / firstPdf.sizePt;
    const abstandPdf = firstPdf.baselineY - firstPdf.sizePt - (wasPdf.baselineY - wasPdf.sizePt);
    const abstandDom = (dom.first - dom.was) / f;
    expect(
      Math.abs(Math.abs(abstandDom) - Math.abs(abstandPdf)),
      'Abstand «Was» → erste Terminzeile (pt)',
    ).toBeLessThan(0.3);
  });
}
