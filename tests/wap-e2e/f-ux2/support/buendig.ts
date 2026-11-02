// F-UX2 P3 (Rückmeldung N3 vom 19.10.2026: «Blöcke sind teilweise nicht ganz bündig zur Seitenlinie»; Beschrieb 5
// «dieselbe Anordnung wie das PDF»; Gestaltung raster-bedienung-v2 §6): Pixelmessung im Browser bei 50 %, 100 %,
// 200 % und «Einpassen». Jede Blockkante liegt auf ganzen Pixeln genau auf einer Spalten- bzw. Tageslinie (links,
// rechts) und – bei Zeiten auf voller oder halber Stunde – auf einer Stunden- bzw. Halbstundenlinie (oben, unten).
// Linie der Stärke s ab round(x) − ⌊s/2⌋; Tageskante innen am rechten Rand. Nur fiktive Daten.
import { expect, type Page } from '@playwright/test';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { planDicht } from './plaene';

interface Messung {
  readonly bloecke: number;
  readonly kanten: number;
  readonly abweichungen: readonly string[];
  readonly gebrochen: number;
}

async function messen(page: Page): Promise<Messung> {
  return page.evaluate(() => {
    const abweichungen: string[] = [];
    let kanten = 0;
    let bloecke = 0;
    let gebrochen = 0;
    const nah = (a: number, list: readonly number[]) => list.some((b) => Math.abs(a - b) < 0.01);
    for (const td of document.querySelectorAll<HTMLElement>('td[data-day]')) {
      const box = td.getBoundingClientRect();
      const linien = [...td.querySelectorAll<HTMLElement>('[data-linie]')].map((l) => ({
        art: l.dataset.linie ?? '',
        r: l.getBoundingClientRect(),
      }));
      // Ohne Linien (alte Darstellung) ist nichts bündig messbar: jede Kante zählt als Abweichung.
      const senk = [
        box.left,
        ...linien
          .filter((l) => l.art === 'spalte')
          .map((l) => l.r.left + Math.floor(l.r.width / 2)),
        ...linien.filter((l) => l.art === 'tag').map((l) => l.r.right),
      ];
      const waag = linien
        .filter((l) => l.art === 'stunde' || l.art === 'halb')
        .map((l) => l.r.top + Math.floor(l.r.height / 2));
      for (const el of td.querySelectorAll<HTMLElement>(
        '.i2-grid-entry.i2-grid-block[data-flaeche]',
      )) {
        const hit = el.querySelector<HTMLElement>('.i2-grid-entry-hit');
        const name = hit?.getAttribute('aria-label') ?? '';
        const m = / (\d{2})(\d{2})-(\d{2})(\d{2}) /.exec(name);
        const r = el.getBoundingClientRect();
        bloecke++;
        for (const v of [r.left, r.right, r.top, r.bottom])
          if (Math.abs(v - Math.round(v)) > 0.01) gebrochen++;
        const prüfe = (wert: number, liste: readonly number[], was: string) => {
          kanten++;
          if (!nah(wert, liste)) abweichungen.push(`${name} ${was} ${wert.toFixed(2)}`);
        };
        prüfe(r.left, senk, 'links');
        prüfe(r.right, senk, 'rechts');
        if (m !== null) {
          if (Number(m[2]) % 30 === 0) prüfe(r.top, waag, 'oben');
          if (Number(m[4]) % 30 === 0 && !(m[3] === '24' && m[4] === '00'))
            prüfe(r.bottom, waag, 'unten');
        }
      }
    }
    return { bloecke, kanten, abweichungen: abweichungen.slice(0, 12), gebrochen };
  });
}

export function registerBuendigTests(url: () => string): void {
  test('[R-5-01] F-UX2 P3: Blockränder exakt auf Spalten-, Tages- und Zeitlinien (ganze Pixel) bei 50 %, 100 %, 200 % und Einpassen', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'Buendig.wap.json', planFile(planDicht()));
    const zoom = wapPage.getByRole('status', { name: 'Zoomstufe', exact: true });
    const kleiner = wapPage.getByRole('button', { name: 'Verkleinern', exact: true });
    const grösser = wapPage.getByRole('button', { name: 'Vergrössern', exact: true });
    const stufen: [string, () => Promise<void>][] = [
      ['100 %', async () => undefined],
      [
        '50 %',
        async () => {
          await kleiner.click();
          await kleiner.click();
        },
      ],
      [
        '200 %',
        async () => {
          for (let i = 0; i < 6; i++) await grösser.click();
        },
      ],
      [
        'Einpassen',
        async () => {
          await wapPage.getByRole('button', { name: 'Einpassen', exact: true }).click();
        },
      ],
    ];
    for (const [name, stelle] of stufen) {
      await stelle();
      if (name !== 'Einpassen') await expect(zoom).toHaveText(name);
      const m = await messen(wapPage);
      expect(m.bloecke, name).toBeGreaterThan(100);
      expect(m.abweichungen, `${name}: Kanten ohne Linie`).toEqual([]);
      expect(m.gebrochen, `${name}: Kanten auf Bruchteilen von Pixeln`).toBe(0);
      expect(m.kanten).toBeGreaterThan(300);
    }
  });
}
