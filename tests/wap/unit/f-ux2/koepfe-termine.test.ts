// @vitest-environment node
// F-UX2 Runde 2 (visual-qa-2: VQA-2-01 blockierend, VQA-2-02 hoch; Beschrieb 5, R-5-01 «Lage, Farben, Umbrüche»):
// Spaltenköpfe und Termine am Bildschirm = Wochenseite des PDF. Köpfe mit derselben Silbentrennung und Grösse, Lage
// ≤ 0,05 pt; Terminzeilen unter der «Was»-Zeile an der Lage der Seite (nicht direkt unter dem Raster), bei 50 %,
// 100 % und 200 %. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  type DayBox,
  dayBoxes,
  pageBasis,
  pageScaleOf,
} from '../../../../src/components/wap/i2/geometry';
import {
  pageAgendaFrame,
  pageHeads,
  screenAgenda,
  screenFactor,
} from '../../../../src/components/wap/i2/layoutViews';
import { addDays } from '../../../../src/model/wap/calendar';
import { agendaAvailPt } from '../../../../src/model/wap/layout/page/agendaScreen';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { TextItem } from '../../../../src/model/wap/layout/pageModel';
import { builtInTemplates, templateById } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import {
  basePlan,
  beso,
  col,
  dayRemark,
  rt,
  setStufen,
  win,
  withEntries,
} from '../../support/model/builders';

const MO = '2026-09-28';
const DI = '2026-09-29';
const template = templateById('kp', builtInTemplates());

/** KVK-Stufen mit langen Spaltennamen (Silbentrennung bzw. Rückfallgrösse im Kopf), Termine Mo und Di. */
function plan(): Plan {
  const stufen = setStufen();
  const names = ['SERVIZIO', 'Stellvertreter', 'COBRA 10', 'Uof', 'höh Uof', 'Transportzug'];
  const set = {
    ...stufen,
    columns: stufen.columns.map((c, i) =>
      i < names.length ? col(c.id, names[i] ?? c.name, c.kind) : c,
    ),
  };
  const p = basePlan({ id: 'fux2-koepfe', columnSets: [set, ...basePlan().columnSets.slice(1)] });
  return withEntries(p, [
    beso('t1', 1, {
      date: MO,
      title: rt(
        'Arztvisite Sanitätsdienst Kontrolle der persönlichen Ausrüstung und der Unterkunft',
      ),
      windows: [win('w1', { time: { form: 'range', from: 600, to: 630 } })],
      besoNumber: 1,
    }),
    beso('t2', 2, {
      date: DI,
      title: rt('Materialfassung Zeughaus'),
      windows: [win('w2', { time: { form: 'point', at: 840 } })],
      besoNumber: 2,
    }),
    dayRemark('r1', 3, {
      date: MO,
      text: 'Tenue Ausgang ab Mittag, Fahrzeuge vollgetankt abgeben',
    }),
  ]);
}

function boxes(p: Plan, scale: ReturnType<typeof pageScaleOf>): readonly DayBox[] {
  const w = p.weeks[0];
  if (w === undefined) throw new Error('Woche fehlt');
  return dayBoxes(
    w.days.map((config, index) => {
      const set = p.columnSets.find((s) => s.id === config.columnSetId);
      return {
        date: addDays(w.startDate, index),
        weekday: config.weekday,
        display: config.display,
        setId: set?.id ?? null,
        columns: set?.columns ?? [],
      };
    }),
    scale,
  );
}

describe('F-UX2 Runde 2: Spaltenköpfe und Termine wie auf der Wochenseite', () => {
  const p = plan();
  const page = layoutWeekPage(p, 'w26', {
    paper: 'A4',
    showStatus: true,
    templates: builtInTemplates(),
  });
  const items = (page.pages[0]?.items ?? []).filter((i): i is TextItem => i.kind === 'text');
  const pdfDay = (date: string) => page.grid.days.find((d) => d.date === date);
  const basis = pageBasis(
    page.frame.grid,
    (p.weeks[0]?.days ?? []).map((d) => d.display),
    p.displayRange.to - p.displayRange.from,
  );

  it.each([0.5, 1, 2].map((z) => [z] as const))(
    '[R-5-01] Zoom %s: Kopfzeilen am Bildschirm = Kopfzeilen der Seite (Text, Trennung, Grösse, Lage ≤ 0,05 pt)',
    (zoom) => {
      const f = (0.8 / basis.ptPerMinute) * zoom;
      const scale = pageScaleOf(basis, f);
      expect(screenFactor(scale)).toBe(f);
      const heads = pageHeads(page, scale);
      const top = page.frame.grid.rect.y + page.frame.grid.dayHeaderHeightPt;
      let n = 0;
      for (const d of page.grid.days) {
        const pdf = items.filter(
          (t) =>
            t.role === 'columnHeader' && t.frame.x >= d.x - 1e-6 && t.frame.x < d.x + d.w - 1e-6,
        );
        const screen = heads.get(d.date)?.lines ?? [];
        expect(screen.map((l) => l.runs.map((r) => r.text).join(''))).toEqual(
          pdf.map((t) => t.runs.map((r) => r.text).join('')),
        );
        pdf.forEach((t, i) => {
          const l = screen[i];
          expect(Math.abs((l?.left ?? Number.NaN) / f - (t.x - d.x))).toBeLessThan(0.05);
          expect(
            Math.abs((l?.top ?? Number.NaN) / f - (t.baselineY - t.sizePt - top)),
          ).toBeLessThan(0.05);
          expect((l?.fontPx ?? 0) / f).toBeCloseTo(t.sizePt, 6);
          n++;
        });
      }
      expect(n).toBeGreaterThan(20);
      // Silbentrennung wie im PDF: «SERVIZIO» ist am Mo getrennt (beide Teile stehen in den Zeilen).
      const mo = (heads.get(MO)?.lines ?? []).map((l) => l.runs.map((r) => r.text).join(''));
      expect(mo.join('|')).toMatch(/SER|VIZ/);
      expect(mo.some((t) => t.endsWith('-'))).toBe(true);
    },
  );

  it.each([0.5, 1, 2].map((z) => [z] as const))(
    '[R-5-01] Zoom %s: Terminzeilen unter der «Was»-Zeile an der Lage der Seite (Text, Lage ≤ 0,05 pt)',
    (zoom) => {
      const f = (0.8 / basis.ptPerMinute) * zoom;
      const scale = pageScaleOf(basis, f);
      const frame = pageAgendaFrame(page, template, scale);
      const yTo = page.frame.grid.rect.y + page.frame.grid.rect.h;
      const availPt = agendaAvailPt(p, 'w26', template);
      const days = boxes(p, scale);
      let n = 0;
      for (const date of [MO, DI]) {
        const d = pdfDay(date);
        const box = days.find((x) => x.date === date);
        if (d === undefined || box === undefined) throw new Error('Tag fehlt');
        const pdf = items.filter(
          (t) => t.role === 'agenda' && t.entryId !== undefined && t.x >= d.x && t.x < d.x + d.w,
        );
        const laid = screenAgenda({ plan: p, date, widthPx: box.width, availPt, scale, template });
        const screen = laid.units.flatMap((u) =>
          u.lines.map((l) => ({
            text: l.runs.map((r) => r.text).join(''),
            x: l.left / f,
            y: (frame.textTopPx + u.top + l.top) / f,
          })),
        );
        expect(screen.map((s) => s.text)).toEqual(
          pdf.map((t) => t.runs.map((r) => r.text).join('')),
        );
        pdf.forEach((t, i) => {
          const s = screen[i];
          expect(Math.abs((s?.x ?? Number.NaN) - (t.x - d.x))).toBeLessThan(0.05);
          expect(Math.abs((s?.y ?? Number.NaN) - (t.baselineY - t.sizePt - yTo))).toBeLessThan(
            0.05,
          );
          n++;
        });
        // «Was» je Tag aus der Seite.
        expect((frame.was.get(date) ?? []).map((l) => l.runs.map((r) => r.text).join(''))).toEqual([
          'Was',
        ]);
      }
      expect(n).toBeGreaterThan(3);
      expect(frame.textTopPx).toBeGreaterThan(frame.wasLinePx);
      expect(frame.wasLinePx).toBeGreaterThan(frame.topLinePx);
    },
  );
});
