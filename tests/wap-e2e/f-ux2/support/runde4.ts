// F-UX2 Runde 4 (visual-qa-3 VQA-3-04/-05, code-reviewer-3 CR-3-01/-02/-06; Beschrieb 4.6, 5, 5.1, R-5-01): Bildschirm =
// PDF auch für Spaltenköpfe (Lage ≤ 0,05 pt) und den Terminbereich mit zusammengefasstem Wochenende (KVK Sa/So eine
// Terminspalte wie im PDF); Kantenzug und Shift+→ an Blöcken mit Teilblöcken erhalten Lücken; der äussere Griff am
// schmalen gewählten Block nimmt dem Nachbarn keinen Treffer; Shift+←/→ wirkt auf die ganze Auswahl. Fiktive Daten.
import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';
import type { Plan } from '../../../../src/model/wap/types';
import { add, kpPlan, MO } from '../../../wap/support/i5/plan';
import { type PdfTextRun, readPdf } from '../../../wap/support/pdf/read';
import { startWith } from '../../i5/support/ablauf';
import { planFile } from '../../i5/support/plaene';
import { test } from '../../support/fixtures';
import { columnsOf, planDetRand } from './plaene';

const SA = '2026-10-03';
const SO = '2026-10-04';

/** KVK-Woche mit Terminen am Sa und So (Wochenende kompakt: im PDF eine gemeinsame Terminspalte). */
export function planWochenende(): Plan {
  let plan = kpPlan(1);
  plan = add(plan, {
    type: 'dayRemark',
    date: MO,
    text: 'Tenue Ausgang ab Mittag',
  }).plan;
  plan = add(plan, {
    type: 'dayRemark',
    date: SA,
    text: 'Urlaub ab 1100 nach Hauptverlesen und Parkdienst',
  }).plan;
  plan = add(plan, {
    type: 'dayRemark',
    date: SO,
    text: 'Einrücken bis 2000 in die Unterkunft, Waffen und Material kontrollieren',
  }).plan;
  plan = add(plan, {
    type: 'dayRemark',
    date: SO,
    text: 'Wache ab 1800',
  }).plan;
  // Blöcke mit eindeutigen Titeln: Bezugspunkt Bildschirm ↔ PDF (Zeilen der Blöcke liegen ungerundet).
  const cols = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  ['Antreten Alpha', 'Theorie Bravo', 'Fahrschule Charlie', 'Sport Delta', 'Material Echo'].forEach(
    (title, i) => {
      plan = add(plan, {
        type: 'block',
        date: MO,
        time: { form: 'range', from: 480 + i * 120, to: 570 + i * 120 },
        columns: { kind: 'ids', ids: cols.map((c) => c.id) },
        title: [{ text: title, bold: true }],
      }).plan;
    },
  );
  return {
    ...plan,
    id: 'fux2-wochenende',
    exerciseName: 'Wochenende Übungsplan',
    service: 'FDT 2099',
  };
}

/** Zwei verknüpfte Teilblöcke in nicht benachbarten Spalten (Kp Kdt + Zfhr) und ein Nachbarblock. */
function planTeilblock(): Plan {
  let plan = kpPlan(1);
  const p = columnsOf(plan, 'KVK Stufen').filter((c) => c.kind === 'planning');
  const [a, , c, d] = p;
  if (a === undefined || c === undefined || d === undefined) throw new Error('Spalten fehlen');
  const block = (from: number, to: number, ids: string[], text: string) => ({
    type: 'block' as const,
    date: MO,
    time: { form: 'range' as const, from, to },
    columns: { kind: 'ids' as const, ids },
    title: [{ text, bold: true }],
  });
  plan = add(plan, block(480, 600, [a.id, c.id], 'Geteilt')).plan;
  plan = add(plan, block(660, 720, [a.id], 'Links')).plan;
  plan = add(plan, block(660, 720, [c.id], 'Rechts')).plan;
  if (p[1] === undefined) throw new Error('Spalte fehlt');
  plan = add(plan, block(900, 960, [a.id], 'Schmal')).plan;
  plan = add(plan, block(900, 960, [p[1].id], 'Nachbar')).plan;
  plan = add(plan, block(780, 840, [d.id], 'Fern')).plan;
  return {
    ...plan,
    id: 'fux2-teilblock',
    exerciseName: 'Teilblock Übungsplan',
    service: 'FDT 2099',
  };
}

function block(page: Page, title: string): Locator {
  return page.getByRole('button', { name: new RegExp(`^Block ${title} `) });
}

async function fläche(entry: Locator) {
  const b = await entry.locator('xpath=..').boundingBox();
  if (b === null) throw new Error('Fläche fehlt');
  return b;
}

interface DomLine {
  readonly where: 'kopf' | 'termin' | 'block';
  readonly date: string;
  readonly text: string;
  readonly left: number;
  readonly top: number;
  readonly fontPx: number;
}

/** Zeilen von Köpfen und Terminen relativ zur linken oberen Ecke der Tagesfläche des Rasters (Mo, px). */
async function domLines(
  page: Page,
): Promise<{ lines: DomLine[]; origin: { x: number; y: number } }> {
  return page.evaluate(() => {
    const mo = document.querySelector<HTMLElement>('td[data-day="2026-09-28"]');
    if (mo === null) throw new Error('Raster fehlt');
    const o = mo.getBoundingClientRect();
    const lines: DomLine[] = [];
    const take = (where: 'kopf' | 'termin' | 'block', root: Element, date: string) => {
      for (const l of root.querySelectorAll<HTMLElement>('.i2-grid-line')) {
        if (getComputedStyle(l).transform !== 'none' || l.classList.contains('is-sideways'))
          continue;
        const r = l.getBoundingClientRect();
        lines.push({
          where,
          date,
          text: l.textContent ?? '',
          left: r.left - o.left,
          top: r.top - o.top,
          fontPx: Number.parseFloat(getComputedStyle(l).fontSize),
        });
      }
    };
    const ths = [...document.querySelectorAll<HTMLElement>('th.i2-grid-day-head')];
    [...document.querySelectorAll<HTMLElement>('td[data-day]')].forEach((td, i) => {
      const date = td.dataset.day ?? '';
      const head = ths[i]?.querySelector('.i2-grid-column-heads');
      if (head) take('kopf', head, date);
      const agenda = td.parentElement?.querySelector('td.i2-grid-agenda .i2-grid-agenda-list');
      if (agenda) take('termin', agenda, date);
      for (const e of td.querySelectorAll('.i2-grid-entry')) take('block', e, date);
    });
    return { lines, origin: { x: o.left, y: o.top } };
  });
}

async function vergleich(wapPage: Page, url: string) {
  const plan = planWochenende();
  await startWith(wapPage, `${url}#leer`, 'R4Wochenende.wap.json', planFile(plan));
  await expect(wapPage.locator('td.i2-grid-agenda .i2-grid-agenda-line').first()).toBeVisible();
  const { lines } = await domLines(wapPage);
  const pending = wapPage.waitForEvent('download');
  await wapPage.getByRole('button', { name: 'PDF dieser Woche', exact: true }).click();
  await wapPage
    .getByRole('dialog', { name: 'PDF dieser Woche', exact: true })
    .getByRole('button', { name: /^(Exportieren|Trotzdem exportieren)$/ })
    .click();
  const pfad = await (await pending).path();
  if (pfad === null) throw new Error('PDF fehlt.');
  const alle = (await readPdf(new Uint8Array(readFileSync(pfad)))).texts;
  const erste = Math.min(...alle.map((t) => t.page));
  const seite = alle.filter((t) => t.page === erste);
  const pdf = seite.filter((t) => t.rotation === 0);
  // Am Bildschirm gedrehte Zeilen (im PDF nur gedreht vorhanden) vergleicht dieser Test nicht.
  const nurGedreht = (text: string) =>
    !pdf.some((t) => t.text === text) && seite.some((t) => t.text === text);
  // Bezug: Zeilen der Blöcke mit eindeutigem Text (Median der Versätze in pt).
  const once = (text: string) => pdf.filter((t) => t.text === text).length === 1;
  const lage = (l: DomLine, t: PdfTextRun) => {
    const f = l.fontPx / t.sizePt;
    return { x: l.left / f - t.x, y: l.top / f - (t.baselineY - t.sizePt) };
  };
  const bezug = lines
    .filter((l) => l.where === 'block' && once(l.text))
    .map((l) => lage(l, pdf.find((t) => t.text === l.text) as PdfTextRun));
  expect(bezug.length).toBeGreaterThan(4);
  const median = (v: number[]) => [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)] ?? 0;
  const o = { x: median(bezug.map((b) => b.x)), y: median(bezug.map((b) => b.y)) };
  const abweichung = (l: DomLine) => {
    let best = Number.POSITIVE_INFINITY;
    for (const t of pdf.filter((x) => x.text === l.text)) {
      const d = lage(l, t);
      best = Math.min(best, Math.max(Math.abs(d.x - o.x), Math.abs(d.y - o.y)));
    }
    return best;
  };
  const heads = lines.filter((l) => l.where === 'kopf' && !nurGedreht(l.text));
  const terms = lines.filter((l) => l.where === 'termin' && !nurGedreht(l.text));
  expect(heads.length).toBeGreaterThan(10);
  expect(terms.length).toBeGreaterThan(4);
  const runde = (v: number) => Math.round(v * 1000) / 1000;
  return {
    kopf: heads.map((l) => ({ text: l.text, d: runde(abweichung(l)) })),
    termine: terms.map((l) => ({ date: l.date, text: l.text, d: runde(abweichung(l)) })),
  };
}

export function registerRunde4Tests(url: () => string): void {
  test('[R-5-01] F-UX2 VQA-3-05: Spaltenköpfe liegen am Bildschirm wie im PDF (≤ 0,05 pt, alle Tage)', async ({
    wapPage,
  }) => {
    const { kopf } = await vergleich(wapPage, url());
    expect(kopf.length).toBeGreaterThan(10);
    expect(
      kopf.filter((r) => r.d > 0.05),
      'Kopfzeilen mit Abweichung > 0,05 pt',
    ).toEqual([]);
  });

  test('[R-5-01] F-UX2 VQA-3-04: KVK-Wochenende – Termine von Sa und So in einer gemeinsamen Spalte wie im PDF (≤ 0,3 pt)', async ({
    wapPage,
  }) => {
    const { termine } = await vergleich(wapPage, url());
    expect(termine.length).toBeGreaterThan(4);
    expect(
      termine.filter((r) => r.d > 0.3),
      'Terminzeilen ohne Gegenstück am selben Ort (> 0,3 pt)',
    ).toEqual([]);
    // So hat keine eigene Terminspalte: alle Terminzeilen des Wochenendes stehen unter dem Sa.
    expect(termine.filter((l) => l.date === SO).map((l) => l.text)).toEqual([]);
    expect(termine.filter((l) => l.date === SA).length).toBeGreaterThan(2);
  });

  test('[R-4.6-60][R-4.6-61] F-UX2 CR-3-01: Kantenzug rechts an einem Block mit Teilblöcken in nicht benachbarten Spalten ändert nur die äussere Grenze, die Lücke bleibt', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R4Kante.wap.json', planFile(planTeilblock()));
    const teile = () =>
      block(wapPage, 'Geteilt')
        .locator('xpath=..')
        .evaluate((el) =>
          [...el.querySelectorAll<HTMLElement>('[data-flaeche]')].map((f) => {
            const r = f.getBoundingClientRect();
            return { x: r.left, w: r.width };
          }),
        );
    const vorher = await teile();
    expect(vorher.length).toBe(2);
    const [erster, letzter] = vorher as [{ x: number; w: number }, { x: number; w: number }];
    const box = await block(wapPage, 'Geteilt').boundingBox();
    if (box === null) throw new Error('Block fehlt');
    const y = box.y + box.height / 2;
    await wapPage.mouse.click(letzter.x + letzter.w / 2, y);
    await expect(block(wapPage, 'Geteilt')).toHaveAttribute('aria-pressed', 'true');
    const x = letzter.x + letzter.w - 3;
    await wapPage.mouse.move(x, y);
    await wapPage.mouse.down();
    await wapPage.mouse.move(x + letzter.w, y, { steps: 6 });
    await wapPage.mouse.up();
    // Weiter zwei Teilblöcke (Lücke in Stv bleibt); der rechte reicht eine Spalte weiter, der linke bleibt.
    await expect.poll(async () => (await teile()).length).toBe(2);
    const nachher = await teile();
    expect(Math.abs((nachher[0]?.x ?? 0) - erster.x)).toBeLessThan(1);
    expect(Math.abs((nachher[0]?.w ?? 0) - erster.w)).toBeLessThan(1);
    expect(Math.abs((nachher[1]?.x ?? 0) - letzter.x)).toBeLessThan(1);
    expect(nachher[1]?.w ?? 0).toBeGreaterThan(letzter.w * 1.6);
  });

  test('[R-5.1-26] F-UX2 CR-3-02: der äussere Griff am schmalen gewählten Block nimmt dem anliegenden Nachbarblock keinen Klick', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R4Griff.wap.json', planFile(planTeilblock()));
    const k = wapPage.getByRole('button', { name: 'Verkleinern', exact: true });
    await k.click();
    await k.click();
    await expect(wapPage.getByRole('status', { name: 'Zoomstufe', exact: true })).toHaveText(
      '50 %',
    );
    const schmal = await fläche(block(wapPage, 'Schmal'));
    expect(schmal.width).toBeLessThan(24);
    await wapPage.mouse.click(schmal.x + schmal.width / 2, schmal.y + schmal.height / 2);
    await expect(block(wapPage, 'Schmal')).toHaveAttribute('aria-pressed', 'true');
    // Direkt rechts liegt «Nachbar» (Stv): 2 px in ihm ist er gemeint, nicht der Griff von «Schmal».
    const nachbar = await fläche(block(wapPage, 'Nachbar'));
    await wapPage.mouse.click(nachbar.x + 2, nachbar.y + nachbar.height / 2);
    await expect(block(wapPage, 'Nachbar')).toHaveAttribute('aria-pressed', 'true');
    await expect(block(wapPage, 'Schmal')).toHaveAttribute('aria-pressed', 'false');
    expect((await fläche(block(wapPage, 'Schmal'))).width).toBeLessThan(schmal.width + 1.5);
    // Wo nichts anderes liegt (rechts neben «Rechts» in Zfhr: leere Spalte), greift der äussere Griff weiter.
    const rechts = await fläche(block(wapPage, 'Rechts'));
    await wapPage.mouse.click(rechts.x + rechts.width / 2, rechts.y + rechts.height / 2);
    await expect(block(wapPage, 'Rechts')).toHaveAttribute('aria-pressed', 'true');
    await wapPage.mouse.move(rechts.x + rechts.width + 2, rechts.y + rechts.height / 2);
    await expect
      .poll(() =>
        wapPage.locator(`td[data-day="${MO}"]`).evaluate((e) => getComputedStyle(e).cursor),
      )
      .toBe('ew-resize');
  });

  test('[R-5.1-14] F-UX2 CR-3-06: Shift+→ / Shift+← wirken auf alle gewählten Blöcke', async ({
    wapPage,
  }) => {
    await startWith(wapPage, `${url()}#leer`, 'R4Mehr.wap.json', planFile(planDetRand()));
    const schmal = await fläche(block(wapPage, 'Schmal'));
    const verwaist = await fläche(block(wapPage, 'Verwaist'));
    await wapPage.mouse.click(schmal.x + schmal.width / 2, schmal.y + schmal.height / 2);
    await wapPage.keyboard.down('Control');
    await wapPage.mouse.click(verwaist.x + verwaist.width / 2, verwaist.y + verwaist.height / 2);
    await wapPage.keyboard.up('Control');
    await expect(block(wapPage, 'Schmal')).toHaveAttribute('aria-pressed', 'true');
    await expect(block(wapPage, 'Verwaist')).toHaveAttribute('aria-pressed', 'true');
    await wapPage.keyboard.press('Shift+ArrowRight');
    await expect
      .poll(async () => (await fläche(block(wapPage, 'Schmal'))).width)
      .toBeGreaterThan(schmal.width * 1.6);
    await expect
      .poll(async () => (await fläche(block(wapPage, 'Verwaist'))).width)
      .toBeGreaterThan(verwaist.width * 1.6);
    await wapPage.keyboard.press('Control+z');
    await expect
      .poll(async () => (await fläche(block(wapPage, 'Schmal'))).width)
      .toBeLessThan(schmal.width + 1.5);
    await expect
      .poll(async () => (await fläche(block(wapPage, 'Verwaist'))).width)
      .toBeLessThan(verwaist.width + 1.5);
  });
}
