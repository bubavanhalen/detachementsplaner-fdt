// @vitest-environment jsdom
// Paket H-LAYOUT, Befund SA-H-01 (Gate S A1; R-10-47, R-10-48, R-7-11): Teilaufgaben am fertigen PDF. Variante der
// pseudonymisierten KVK-Fixture: Block e35 (Mo 0900–1725) mit fiktiven Teilaufgaben wie im Referenzblock (je Titel fett,
// darunter Ltg/Ort normal, Leerzeile dazwischen, zentriert, kein Einzug; Q-041). Gelesen wird nur das PDF (readPdf);
// das Seitenmodell liefert nur den Blockrahmen und die Rückfallereignisse.
import { describe, expect, it } from 'vitest';
import type { WeekPageLayout } from '../../../../src/model/wap/layout/page/types';
import type { Rect } from '../../../../src/model/wap/layout/pageModel';
import { lineHeightPt } from '../../../../src/model/wap/layout/text/metrics';
import type { Block, Plan } from '../../../../src/model/wap/types';
import { rt } from '../../support/model/builders';
import { fahrerRep, fsgFz } from '../../support/model/teilaufgaben';
import { laeufe, type Zeile, zeilen } from '../../support/page/pdf-seite';
import { einmal, seitePdf } from '../../support/page/seite';
import { KVK_WOCHE, kvk } from '../../support/page/varianten';
import type { PdfInfo } from '../../support/pdf/read';

const MIN = 4.5;

function variante(over: Partial<Block> = {}): Plan {
  const p = kvk();
  const e35 = p.entries.e35 as Block;
  const neu: Block = {
    ...e35,
    title: rt('Fsg Mat', true),
    ltg: 'Kp Kdt',
    subtasks: [fsgFz(), fahrerRep()],
    ...over,
  };
  return { ...p, entries: { ...p.entries, e35: neu } };
}

function blockRect(l: WeekPageLayout): Rect {
  const g = l.grid.entries.find((e) => e.entryId === 'e35');
  const r = g?.pieces.find((x) => x.kind === 'block')?.rect;
  expect(r).toBeDefined();
  return r as Rect;
}

/** Zeilen des PDF, deren Umriss im Blockrahmen liegt, in y-Reihenfolge. */
function blockZeilen(info: PdfInfo, r: Rect): Zeile[] {
  return zeilen(laeufe(info))
    .filter((z) => z.rotation === 0)
    .filter(
      (z) =>
        z.umriss.x >= r.x - 0.01 &&
        z.umriss.x + z.umriss.w <= r.x + r.w + 0.01 &&
        z.umriss.y >= r.y - 0.01 &&
        z.umriss.y + z.umriss.h <= r.y + r.h + 0.01,
    )
    .sort((a, b) => a.baselineY - b.baselineY);
}

const lang = einmal(() => seitePdf('h-layout-teilaufgaben', variante(), KVK_WOCHE));

describe('Teilaufgaben im PDF (R-10-47)', () => {
  it('[R-10-47] Text in y-Reihenfolge: Blocktitel fett, Ltg normal, «Fsg Fz» fett, «Zfhr (Halle 3)» normal, «Fahrer Rep anschl Vs Ukft» fett; nichts entfällt', async () => {
    const { layout, info } = await lang();
    const z = blockZeilen(info, blockRect(layout));
    const text = z.map((x) => x.text);
    expect(text.join(' ').replace(/-\s/g, '')).toBe(
      'Fsg Mat Kp Kdt Fsg Fz Zfhr (Halle 3) Fahrer Rep anschl Vs Ukft',
    );
    // Umbruch im schmalen Block an Wortgrenzen; Schnitt je Zeile: Titel fett, Ltg/Ort normal.
    // Zeilen nur aus Wörtern von Ltg und Ort (der Block ist seit «12: ja», Nebenspalte Gewicht 2, schmaler; «(Halle 3)»
    // kann umbrechen, F-LAYOUT2).
    const normal = new Set(['Kp', 'Kdt', 'Zfhr', '(Halle', '3)']);
    for (const x of z) {
      const soll = !x.text.split(' ').every((w) => normal.has(w));
      expect(
        x.laeufe.every((l) => l.bold === soll),
        x.text,
      ).toBe(true);
    }
    expect(layout.fallbacks.filter((e) => e.entryId === 'e35')).toEqual([]);
  });

  it('[R-10-47] zentriert zur Blockmitte (±0,5 pt), kein Einzug; Leerzeile vor jeder Teilaufgabe = eine Zeilenhöhe; Schrift ≥ 4,5 pt; im Rahmen', async () => {
    const { layout, info } = await lang();
    const r = blockRect(layout);
    const z = blockZeilen(info, r);
    for (const x of z) {
      expect(Math.abs(x.x + x.breite / 2 - (r.x + r.w / 2))).toBeLessThanOrEqual(0.5);
      expect(x.sizePt).toBeGreaterThanOrEqual(MIN);
    }
    const i = (t: string) => z.findIndex((x) => x.text.startsWith(t));
    const ltg = z[i('Kp Kdt')] as Zeile;
    const fz = z[i('Fsg Fz')] as Zeile;
    const zfhr = z[i('Zfhr')] as Zeile;
    const ort = z[i('Fahrer') - 1] as Zeile;
    const fahrer = z[i('Fahrer')] as Zeile;
    // Abstand der Oberkanten: Zeile + Leerzeile (Standardgrösse der Ltg-Zeile).
    const top = (x: Zeile) => x.umriss.y;
    const lh = lineHeightPt(ltg.sizePt);
    expect(Math.abs(top(fz) - top(ltg) - 2 * lh)).toBeLessThanOrEqual(0.6);
    expect(Math.abs(top(fahrer) - top(ort) - 2 * lh)).toBeLessThanOrEqual(0.6);
    // Ohne Leerzeile direkt darunter: Titel → Ltg-Zeile eine Zeilenhöhe.
    expect(top(zfhr) - top(fz)).toBeLessThan(1.5 * lineHeightPt(fz.sizePt));
  });

  it('[R-10-48][R-7-11] kurzer Block: Teilaufgaben gekürzt, Rückfallereignis mit Teilaufgaben-Arten, kein Text ausserhalb des Rahmens im PDF', async () => {
    const plan = variante({ time: { form: 'range', from: 540, to: 600 } });
    const { layout, info } = await seitePdf('h-layout-teilaufgaben-kurz', plan, KVK_WOCHE);
    const r = blockRect(layout);
    const ev = layout.fallbacks.filter((e) => e.entryId === 'e35');
    expect(ev).toHaveLength(1);
    expect(ev[0]?.dropped.some((d) => d.startsWith('subtask'))).toBe(true);
    const imBlock = zeilen(laeufe(info)).filter(
      (z) =>
        z.umriss.x < r.x + r.w &&
        z.umriss.x + z.umriss.w > r.x &&
        z.umriss.y < r.y + r.h &&
        z.umriss.y + z.umriss.h > r.y &&
        z.text.includes('Fsg'),
    );
    expect(imBlock.length).toBeGreaterThan(0);
    for (const z of imBlock) {
      expect(z.umriss.y + z.umriss.h).toBeLessThanOrEqual(r.y + r.h + 0.01);
      expect(z.umriss.y).toBeGreaterThanOrEqual(r.y - 0.01);
    }
  });
});
