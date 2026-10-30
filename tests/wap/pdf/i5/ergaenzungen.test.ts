// @vitest-environment jsdom
// I5 D3: Layout- und PDF-Ergänzungen am fertigen PDF (Beschrieb 4.1, 4.6, 4.7, 10; Vertrag E1-10; B-Kp-55, -56, -100):
// gemeinsame Leitung diagonal geteilt, offenes Ende gewellt, Marker als flacher Block, Unterschrift als Bild (Vorgabe
// aus), A3, «Änderungen markieren». Dazu Schriftgrösse, Text im Rahmen und Kanten auf der Zeit. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { renderWeekPdf } from '../../../../src/io/wap-pdf/index';
import { updatePlanFields } from '../../../../src/model/wap/commands/settings';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { PageOptions } from '../../../../src/model/wap/layout/page/types';
import type { Id, Plan, Rgb } from '../../../../src/model/wap/types';
import { pageOptions } from '../../support/i3/seite';
import { add, block, CTX, kpPlan, MO } from '../../support/i5/plan';
import { pdfArtefakt } from '../../support/pdf/artefakt';
import { edgesOffTime, minFontSize, textOutsideFrames } from '../../support/pdf/checks';
import { type PdfInfo, readPdf } from '../../support/pdf/read';

const GELB: Rgb = { r: 255, g: 255, b: 153 };
const PFIRSICH: Rgb = { r: 253, g: 234, b: 218 };
const ROT: Rgb = { r: 192, g: 0, b: 0 };
/** Fiktives 1×1-PNG (transparent). */
const PNG_1X1 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const same = (a: Rgb | null, b: Rgb) => a !== null && a.r === b.r && a.g === b.g && a.b === b.b;
const cat = (plan: Plan, name: string): Id => plan.legend.find((c) => c.name === name)?.id ?? '';
const wk = (plan: Plan) => plan.weeks[0]?.id ?? '';

async function pdf(plan: Plan, fall: string, over: Partial<PageOptions> = {}): Promise<PdfInfo> {
  const r = await renderWeekPdf(plan, wk(plan), pageOptions(over), `I5 ${fall}`);
  await pdfArtefakt(`i5-${fall}`, r.bytes);
  return readPdf(r.bytes);
}

/** Block «Gemeinsam» 0800–1000 mit Ltg Kp und optional zweiter Kategorie Ltg Zfhr bzw. offenem Ende. */
function shared(second: boolean, openEnd = false): { plan: Plan; id: Id } {
  const base = kpPlan(1);
  return block(base, 'Gemeinsam', {
    categoryId: cat(base, 'Ltg Kp'),
    secondCategoryId: second ? cat(base, 'Ltg Zfhr') : null,
    openEnd,
  });
}

/** Rechteck des Blocks auf der Seite (Layout-Schicht, gleiche Werte wie im PDF). */
function blockRect(plan: Plan, id: Id) {
  const layout = layoutWeekPage(plan, wk(plan), pageOptions());
  const piece = layout.grid.entries.find((e) => e.entryId === id)?.pieces[0];
  if (piece === undefined) throw new Error('Block fehlt');
  return { rect: piece.rect, scale: layout.grid.timeScale };
}

describe('I5 D3 Layout-Ergänzungen im PDF', () => {
  it('[R-4.7-03][R-14.2-01] B-Kp-55 gemeinsame Leitung: zwei Dreiecke in beiden Legendenfarben über der Blockfläche (positiv)', async () => {
    const { plan, id } = shared(true);
    const { rect } = blockRect(plan, id);
    const info = await pdf(plan, 'gemeinsam');
    const flaechen = info.strokes.filter(
      (s) =>
        s.kind === 'path' &&
        Math.abs(s.bbox.x - rect.x) < 0.05 &&
        Math.abs(s.bbox.y - rect.y) < 0.05 &&
        Math.abs(s.bbox.w - rect.w) < 0.05 &&
        Math.abs(s.bbox.h - rect.h) < 0.05,
    );
    expect(flaechen.some((s) => same(s.fill, GELB))).toBe(true);
    expect(flaechen.some((s) => same(s.fill, PFIRSICH))).toBe(true);
  });

  it('[R-4.7-03] gemeinsame Leitung (negativ): ohne zweite Kategorie eine Füllung, keine zweite Farbe', async () => {
    const { plan, id } = shared(false);
    const { rect } = blockRect(plan, id);
    const info = await pdf(plan, 'einfach');
    const imBlock = info.strokes.filter(
      (s) =>
        s.fill !== null &&
        s.bbox.x >= rect.x - 0.05 &&
        s.bbox.x + s.bbox.w <= rect.x + rect.w + 0.05 &&
        s.bbox.y >= rect.y - 0.05 &&
        s.bbox.y + s.bbox.h <= rect.y + rect.h + 0.05,
    );
    expect(imBlock.some((s) => same(s.fill, PFIRSICH))).toBe(false);
    expect(imBlock.some((s) => same(s.fill, GELB))).toBe(true);
  });

  it('[R-4.7-13][R-14.2-01] B-Kp-56 offenes Ende: Rahmen als Pfad mit gewelltem unterem Rand, Kanten auf der Zeit (positiv)', async () => {
    const { plan, id } = shared(false, true);
    const { rect, scale } = blockRect(plan, id);
    const layout = layoutWeekPage(plan, wk(plan), pageOptions());
    const own = layout.pages[0]?.items.filter((i) => i.entryId === id && i.kind === 'path') ?? [];
    const rahmen = own.find((i) => i.kind === 'path' && i.stroke !== null);
    expect(rahmen?.kind === 'path' && /C /.test(rahmen.d)).toBe(true);
    const info = await pdf(plan, 'offenes-ende');
    const pfad = info.strokes.find(
      (s) =>
        s.kind === 'path' &&
        s.fill === null &&
        Math.abs(s.bbox.x - rect.x) < 0.5 &&
        Math.abs(s.bbox.w - rect.w) < 0.5,
    );
    expect(pfad).toBeDefined();
    if (pfad === undefined) return;
    // Oberkante und tiefster Punkt der Welle liegen auf ihrer Zeit (0800 bzw. 1000).
    expect(
      edgesOffTime([pfad.bbox.y, pfad.bbox.y + pfad.bbox.h], { ...scale }, 0.6 + pfad.widthPt),
    ).toEqual([]);
    expect(Math.abs(pfad.bbox.y + pfad.bbox.h - (rect.y + rect.h))).toBeLessThan(0.6);
  });

  it('[R-4.7-13] offenes Ende (negativ): ohne Option gerader Rahmen ohne Kurven', () => {
    const { plan, id } = shared(false, false);
    const layout = layoutWeekPage(plan, wk(plan), pageOptions());
    const own = layout.pages[0]?.items.filter((i) => i.entryId === id) ?? [];
    expect(own.some((i) => i.kind === 'path' && /C /.test(i.d))).toBe(false);
    expect(own.some((i) => i.kind === 'rect' && i.stroke !== null)).toBe(true);
  });

  it('[R-4.6-15] Marker als flacher Block: Rechteck mit Füllung statt Linie, Beschriftung gleich (positiv und negativ)', async () => {
    const base = kpPlan(1);
    const linie = add(base, {
      type: 'marker',
      date: MO,
      at: 600,
      kind: 'AV',
      columns: { kind: 'all' },
    });
    const flach = add(base, {
      type: 'marker',
      date: MO,
      at: 600,
      kind: 'AV',
      columns: { kind: 'all' },
      asFlatBlock: true,
    });
    const items = (p: Plan, id: Id) =>
      layoutWeekPage(p, wk(p), pageOptions()).pages[0]?.items.filter((i) => i.entryId === id) ?? [];
    const l = items(linie.plan, linie.id);
    const f = items(flach.plan, flach.id);
    expect(l.some((i) => i.kind === 'line')).toBe(true);
    expect(f.some((i) => i.kind === 'line')).toBe(false);
    expect(f.filter((i) => i.kind === 'rect' && i.fill !== null).length).toBeGreaterThanOrEqual(1);
    const text = (list: typeof l) =>
      list.flatMap((i) => (i.kind === 'text' ? i.runs.map((r) => r.text) : [])).join('');
    expect(text(f)).toBe(text(l));
    const info = await pdf(flach.plan, 'flacher-marker');
    expect(info.texts.some((t) => t.text.includes('AV'))).toBe(true);
  });

  it('[R-4.1-08] Unterschrift als Bild: Vorgabe aus → kein Bild; eingeschaltet → ein Bild im Unterschriftblock', async () => {
    const base = updatePlanFields(
      kpPlan(1),
      { signatureImage: { mime: 'image/png', dataBase64: PNG_1X1 } },
      CTX,
    ).plan;
    expect(base.signatureEnabled).toBe(false);
    const aus = await pdf(base, 'unterschrift-aus');
    expect(aus.images).toBe(0);
    const an = updatePlanFields(base, { signatureEnabled: true }, CTX).plan;
    const info = await pdf(an, 'unterschrift-an');
    expect(info.images).toBe(1);
    const lage = info.imagePlacements[0]?.bbox;
    const seite = info.pages[0];
    expect(lage).toBeDefined();
    if (lage === undefined || seite === undefined) return;
    // In der Seitenleiste rechts unten.
    expect(lage.x).toBeGreaterThan(seite.widthPt * 0.6);
    expect(lage.y).toBeGreaterThan(seite.heightPt * 0.5);
  });

  it('[R-10-04] A3: Seite 1190,55 × 841,89 pt, gleiche Texte und Umbrüche, Grössen um √2 skaliert', async () => {
    let plan = block(kpPlan(1), 'Ausb Mö Sch').plan;
    plan = add(plan, {
      type: 'beso',
      date: MO,
      title: [{ text: 'Arztvisite', bold: false }],
      windows: [{ time: { form: 'point', at: 600 } }],
    }).plan;
    const a4 = await pdf(plan, 'a4');
    const a3 = await pdf(plan, 'a3', { paper: 'A3' });
    expect(a3.pages[0]?.widthPt).toBeCloseTo(1190.55, 1);
    expect(a3.pages[0]?.heightPt).toBeCloseTo(841.89, 1);
    expect(a3.texts.map((t) => t.text)).toEqual(a4.texts.map((t) => t.text));
    const k = 1190.55 / 841.89;
    a3.texts.forEach((t, i) => {
      const o = a4.texts[i];
      if (o === undefined) return;
      expect(t.sizePt).toBeCloseTo(o.sizePt * k, 2);
      expect(t.x).toBeCloseTo(o.x * k, 1);
    });
    expect(minFontSize(a3)).toBeGreaterThanOrEqual(4.5 * k - 0.01);
  });

  it('[R-4.6-33][R-14.2-01] B-Kp-100 «Änderungen markieren»: geänderter Eintrag rot (#c00000), übrige schwarz; ohne Option kein Rot', async () => {
    let plan = block(kpPlan(1), 'Unverändert').plan;
    const neu = block(plan, 'Seit Stand neu', { date: '2026-09-29' });
    plan = neu.plan;
    const an = await pdf(plan, 'aenderungen', { changedEntryIds: [neu.id] });
    const rot = an.texts.filter((t) => same(t.color, ROT));
    expect(rot.length).toBeGreaterThan(0);
    expect(rot.every((t) => /Seit|Stand|neu|\d/.test(t.text))).toBe(true);
    expect(
      an.texts.filter((t) => t.text.includes('Unverändert')).every((t) => !same(t.color, ROT)),
    ).toBe(true);
    const aus = await pdf(plan, 'aenderungen-aus');
    expect(aus.texts.some((t) => same(t.color, ROT))).toBe(false);
  });

  it('[R-10-04][R-14.2-01] Prüfung am fertigen PDF mit allen Ergänzungen: keine Schrift unter 4,5 pt, jeder Text in seinem Rahmen', async () => {
    const base = kpPlan(1);
    let plan = shared(true, true).plan;
    plan = add(plan, {
      type: 'marker',
      date: '2026-09-29',
      at: 720,
      kind: 'ABV',
      columns: { kind: 'all' },
      asFlatBlock: true,
    }).plan;
    plan = updatePlanFields(
      plan,
      { signatureImage: { mime: 'image/png', dataBase64: PNG_1X1 }, signatureEnabled: true },
      CTX,
    ).plan;
    expect(base.weeks.length).toBe(1);
    const layout = layoutWeekPage(plan, wk(plan), pageOptions());
    const frames = (layout.pages[0]?.items ?? []).flatMap((i) =>
      i.kind === 'text' ? [i.frame] : [],
    );
    const info = await pdf(plan, 'alle-ergaenzungen');
    expect(minFontSize(info)).toBeGreaterThanOrEqual(4.5);
    expect(textOutsideFrames(info, frames).map((t) => t.text)).toEqual([]);
  });
});

describe('I5 D1 Prüfmarken nur am Bildschirm', () => {
  it('[R-5-03] Plan mit Befunden P1, P16, P17: das PDF enthält keine Befund- oder Auswahlmarke (Farben der Marken, Zeichen «!»)', async () => {
    const { plan } = block(kpPlan(1), 'Mit Befund', {
      columns: { kind: 'ids', ids: ['c-gibt-es-nicht'] },
    });
    const info = await pdf(plan, 'marken');
    const marken: Rgb[] = [
      { r: 194, g: 58, b: 47 },
      { r: 138, g: 82, b: 0 },
      { r: 45, g: 99, b: 181 },
    ];
    expect(info.strokes.some((s) => marken.some((m) => same(s.fill, m) || same(s.color, m)))).toBe(
      false,
    );
    expect(info.texts.some((t) => t.text.trim() === '!')).toBe(false);
    expect(info.texts.some((t) => t.text.includes('Mit Befund'))).toBe(true);
  });
});
