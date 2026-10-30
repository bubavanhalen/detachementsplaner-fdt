// @vitest-environment node
// H-UI, Befund CR-H-U-04 (R-5-01; Leitplanke 2, ADR-004 Punkt 4, Beschrieb 10): Der Terminbereich am Bildschirm zeichnet
// vorberechnete Zeilen der Layout-Schicht nach denselben Regeln wie die Termine der PDF-Wochenseite (Einheiten,
// Umbruch mit hängendem Einzug, gemeinsame Grösse je Spalte von Standard bis Mindestgrösse); die Zoomstufe skaliert
// nur, die Umbrüche bleiben. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import type { Scale } from '../../../../src/components/wap/i2/geometry';
import { screenAgenda, screenFactor } from '../../../../src/components/wap/i2/layoutViews';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import {
  agendaAvailPt,
  layoutAgendaScreen,
} from '../../../../src/model/wap/layout/page/agendaScreen';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import { pageGeometryFor } from '../../../../src/model/wap/layout/page/geometry';
import { pageLage } from '../../../../src/model/wap/layout/page/geometryKpLage';
import type { TextItem } from '../../../../src/model/wap/layout/pageModel';
import { measureRuns } from '../../../../src/model/wap/layout/text/measure';
import { builtInTemplates, templateById } from '../../../../src/model/wap/template';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { pageOptions } from '../../support/i3/seite';
import { add, CTX, kpPlan, MO } from '../../support/i5/plan';

const LANG =
  'Materialfassung und Kontrolle der persönlichen Ausrüstung im Zeughaus mit Abgabe der Leihgeräte';

function planMitTerminen(): { plan: Plan; beso: Id; bemerkung: Id } {
  let plan = kpPlan(1);
  const b = add(plan, {
    type: 'beso',
    date: MO,
    title: [
      { text: 'Material', bold: true },
      { text: LANG.slice('Material'.length), bold: false },
    ],
    windows: [{ time: { form: 'range', from: 600, to: 630 } }],
  });
  plan = b.plan;
  const r = add(plan, { type: 'dayRemark', date: MO, text: 'Retablierung bis Mittag' });
  plan = r.plan;
  return { plan, beso: b.id, bemerkung: r.id };
}

const template = templateById('kp', builtInTemplates());
const lage = pageLage(pageGeometryFor(template.pageGeometryId));

function textOf(t: TextItem): string {
  return t.runs.map((r) => r.text).join('');
}

/** Terminzeilen der PDF-Wochenseite (Seite 1) für den Montag in Zeichenreihenfolge. */
function pdfLines(plan: Plan): TextItem[] {
  const week = plan.weeks[0];
  if (week === undefined) throw new Error('Woche fehlt');
  const layout = layoutWeekPage(plan, week.id, pageOptions());
  const page = layout.pages[0];
  if (page === undefined) throw new Error('Seite fehlt');
  return page.items.filter(
    (i): i is TextItem =>
      i.kind === 'text' &&
      i.role === 'agenda' &&
      i.entryId !== undefined &&
      (plan.entries[i.entryId] as { date?: string } | undefined)?.date === MO,
  );
}

describe('H-UI CR-H-U-04: Terminbereich aus der Layout-Schicht', () => {
  it('[R-5-01] gleiche Spaltenbreite und Höhe wie die Wochenseite: dieselben Zeilen, Grössen und relativen Lagen wie im PDF', () => {
    const { plan } = planMitTerminen();
    const pdf = pdfLines(plan);
    expect(pdf.length).toBeGreaterThan(1);
    const first = pdf[0] as TextItem;
    const week = plan.weeks[0];
    if (week === undefined) throw new Error('Woche fehlt');
    const screen = layoutAgendaScreen({
      plan,
      dates: [MO],
      columnWidthPt: first.frame.w + 2 * lage.agendaX,
      availPt: agendaAvailPt(plan, week.id, template),
      template,
      showStatus: true,
    });
    const lines = screen.units.flatMap((u) => u.lines);
    expect(lines.map(textOf)).toEqual(pdf.map(textOf));
    expect(lines.map((l) => l.sizePt)).toEqual(pdf.map((l) => l.sizePt));
    const s0 = lines[0] as TextItem;
    for (const [i, l] of lines.entries()) {
      const p = pdf[i] as TextItem;
      expect(l.x - s0.x).toBeCloseTo(p.x - first.x, 6);
      expect(l.baselineY - s0.baselineY).toBeCloseTo(p.baselineY - first.baselineY, 6);
      expect(l.runs.map((r) => [r.weight, r.strike])).toEqual(
        p.runs.map((r) => [r.weight, r.strike]),
      );
    }
  });

  it('[R-5-01] schmale Spalte: Umbruch an Wortgrenzen, hängender Einzug nach der Nummer, keine Zeile breiter als die Textfläche', () => {
    const { plan, beso } = planMitTerminen();
    const width = 60;
    const r = layoutAgendaScreen({
      plan,
      dates: [MO],
      columnWidthPt: width,
      availPt: 400,
      template,
      showStatus: true,
    });
    const unit = r.units.find((u) => u.entryId === beso);
    expect(unit).toBeDefined();
    const lines = unit?.lines ?? [];
    expect(lines.length).toBeGreaterThan(2);
    expect(r.sizePt).toBe(template.fontSizes.standard);
    const firstLine = lines[0] as TextItem;
    const nr = textOf(firstLine).split(' ')[0] ?? '';
    expect(nr).toMatch(/^\d+$/);
    const indent = measureRuns([{ text: `${nr} `, weight: 'bold' }], r.sizePt);
    for (const l of lines.slice(1)) expect(l.x - firstLine.x).toBeCloseTo(indent, 6);
    for (const l of lines) {
      const w = measureRuns(
        l.runs.map((x) => ({ text: x.text, weight: x.weight })),
        l.sizePt,
      );
      expect(l.x - firstLine.x + w).toBeLessThanOrEqual(width - 2 * lage.agendaX + 1e-6);
    }
    // Kein Zeichen geht verloren (ausser den Leerzeichen an den Umbrüchen).
    const joined = lines.map(textOf).join(' ').replace(/\s+/g, ' ');
    expect(joined.endsWith(`${LANG.split(' ').at(-1) ?? ''}.`)).toBe(true);
  });

  it('[R-5-01] wenig Höhe: alle Zeilen der Spalte gemeinsam verkleinert bis höchstens zur Mindestgrösse; zu wenig: Mindestgrösse und Überlauf', () => {
    const { plan } = planMitTerminen();
    const full = layoutAgendaScreen({
      plan,
      dates: [MO],
      columnWidthPt: 60,
      availPt: 400,
      template,
      showStatus: true,
    });
    const tight = layoutAgendaScreen({
      plan,
      dates: [MO],
      columnWidthPt: 60,
      availPt: full.heightPt * 0.85,
      template,
      showStatus: true,
    });
    expect(tight.sizePt).toBeLessThan(template.fontSizes.standard);
    expect(tight.sizePt).toBeGreaterThanOrEqual(template.fontSizes.min);
    expect(tight.heightPt).toBeLessThanOrEqual(tight.availPt + 1e-6);
    expect(tight.overflow).toBe(false);
    const tiny = layoutAgendaScreen({
      plan,
      dates: [MO],
      columnWidthPt: 60,
      availPt: 8,
      template,
      showStatus: true,
    });
    expect(tiny.overflow).toBe(true);
    expect(tiny.sizePt).toBe(template.fontSizes.min);
    expect(tiny.units.length).toBe(full.units.length);
  });

  it('[R-5-01] gestrichener Beso: Terminzeile durchgestrichen wie im PDF', () => {
    const base = planMitTerminen();
    const plan = updateEntry(base.plan, base.beso, 'beso', { status: 'cancelled' }, CTX).plan;
    const r = layoutAgendaScreen({
      plan,
      dates: [MO],
      columnWidthPt: 120,
      availPt: 400,
      template,
      showStatus: true,
    });
    const unit = r.units.find((u) => u.entryId === base.beso);
    expect(unit?.lines.flatMap((l) => l.runs).every((x) => x.strike || x.text.trim() === '')).toBe(
      true,
    );
  });

  it('[R-5-01] Bildschirm: Zoom skaliert nur (gleiche Zeilen, Schrift und Lage im Verhältnis), Höhe aus der Wochenseite', () => {
    const { plan } = planMitTerminen();
    const week = plan.weeks[0];
    if (week === undefined) throw new Error('Woche fehlt');
    const availPt = agendaAvailPt(plan, week.id, template);
    expect(availPt).toBeGreaterThan(10);
    const at = (scale: Scale) =>
      screenAgenda({
        plan,
        date: MO,
        widthPx: scale.day,
        availPt,
        scale,
        template,
      });
    const a = at({ minute: 0.8, day: 360 });
    const b = at({ minute: 1.6, day: 720 });
    const lines = (s: ReturnType<typeof at>) =>
      s.units.flatMap((u) => u.lines.map((l) => l.runs.map((r) => r.text).join('')));
    expect(lines(a).length).toBeGreaterThan(0);
    expect(lines(b)).toEqual(lines(a));
    const fa = screenFactor({ minute: 0.8, day: 360 });
    const fb = screenFactor({ minute: 1.6, day: 720 });
    expect(a.heightPx).toBeCloseTo(availPt * fa, 0);
    expect(b.heightPx).toBeCloseTo(availPt * fb, 0);
    const la = a.units[0]?.lines[0];
    const lb = b.units[0]?.lines[0];
    expect(lb?.fontPx).toBeCloseTo((la?.fontPx ?? 0) * 2, 6);
    expect(a.units[1]?.top ?? 0).toBeGreaterThan(0);
    expect(b.units[1]?.top).toBeCloseTo((a.units[1]?.top ?? 0) * 2, 6);
  });
});
