// @vitest-environment node
// I2b-B B1/B2: gemeinsames Verschieben der Auswahl mit Nachbarn nach Variante c (I2b-A A7), Dauer per Tastatur;
// je Aktion genau ein Undo-Schritt. Nur fiktive Daten.
import { applyPatches } from 'immer';
import { describe, expect, it } from 'vitest';
import { moveSelection, resizeEnd } from '../../../../src/components/wap/i2/selectionCommands';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Plan } from '../../../../src/model/wap/types';
import { basePlan, block, rapport, rt, withEntries } from '../../support/model/builders';

const ctx = { templates: builtInTemplates() };
const MO = '2026-09-28';
const kdt = { kind: 'ids', ids: ['c8'] } as const;

function range(from: number, to: number) {
  return { form: 'range', from, to } as const;
}

/** Kp Kdt: A 0800–0900, B 0900–1000 (beide gewählt), N 1000–1200 (Nachbar ausserhalb der Auswahl). */
function plan(): Plan {
  return withEntries(basePlan(), [
    block('eA', 1, { title: rt('Alpha'), time: range(480, 540), columns: kdt }),
    block('eB', 2, { title: rt('Bravo'), time: range(540, 600), columns: kdt }),
    block('eN', 3, { title: rt('Nachbar'), time: range(600, 720), columns: kdt }),
  ]);
}

function span(p: Plan, id: string): [number, number] | null {
  const e = p.entries[id];
  return e?.type === 'block' && e.time.form === 'range' ? [e.time.from, e.time.to] : null;
}

describe('I2b-B Mehrfachverschieben mit Variante c', () => {
  it('[R-5.1-14] Auswahl um 30 Min: der Nachbar ausserhalb wird gekürzt, die gewählten nie gegeneinander', () => {
    const before = plan();
    const r = moveSelection(before, ['eA', 'eB'], { deltaMinutes: 30 }, 'adjust', ctx);
    expect(span(r.plan, 'eA')).toEqual([510, 570]);
    expect(span(r.plan, 'eB')).toEqual([570, 630]);
    expect(span(r.plan, 'eN')).toEqual([630, 720]);
    expect(r.label).toBe('2 Einträge verschoben');
    // Ein Undo-Schritt: die inversen Patches stellen alles wieder her.
    expect(applyPatches(r.plan, r.inversePatches as never)).toEqual(before);
    expect(applyPatches(before, r.patches as never)).toEqual(r.plan);
  });

  it('[R-5.1-14] Shift: Folgeblöcke rücken nach; Alt («none»): keine Anpassung', () => {
    const shift = moveSelection(plan(), ['eA', 'eB'], { deltaMinutes: 30 }, 'shift', ctx);
    expect(span(shift.plan, 'eN')).toEqual([630, 750]);
    const none = moveSelection(plan(), ['eA', 'eB'], { deltaMinutes: 30 }, 'none', ctx);
    expect(span(none.plan, 'eN')).toEqual([600, 720]);
  });

  it('[R-5.1-16] Tag und Spalte: alle um denselben Tag bzw. dieselbe Spalte; über 2400 abgelehnt', () => {
    const day = moveSelection(plan(), ['eA', 'eN'], { dayOffset: 1 }, 'adjust', ctx);
    const a = day.plan.entries.eA;
    const n = day.plan.entries.eN;
    expect(a?.type === 'block' ? a.date : null).toBe('2026-09-29');
    expect(n?.type === 'block' ? n.date : null).toBe('2026-09-29');
    const col = moveSelection(plan(), ['eA'], { columnShift: 1 }, 'adjust', ctx);
    const moved = col.plan.entries.eA;
    expect(moved?.type === 'block' ? moved.columns : null).toEqual({ kind: 'ids', ids: ['c9'] });
    expect(() => moveSelection(plan(), ['eN'], { deltaMinutes: 900 }, 'adjust', ctx)).toThrow();
  });

  it('[R-5.1-14] Mehrfachauswahl mit verschiedenen Typen: Rapport verschiebt sich mit', () => {
    const before = withEntries(plan(), [
      rapport('eR', 4, { date: MO, code: 'KR', time: range(480, 510) }),
    ]);
    const r = moveSelection(before, ['eA', 'eR'], { deltaMinutes: 30 }, 'adjust', ctx);
    const rap = r.plan.entries.eR;
    expect(rap?.type === 'rapport' ? rap.time : null).toEqual(range(510, 540));
    expect(span(r.plan, 'eA')).toEqual([510, 570]);
    // Bravo liegt ausserhalb der Auswahl und wird überdeckt: gekürzt.
    expect(span(r.plan, 'eB')).toEqual([570, 600]);
  });
});

describe('I2b-B Dauer per Tastatur (Shift+↑/↓)', () => {
  it('[R-5.1-14] Ende +15: der angrenzende Nachbar folgt (Variante c), mindestens 15 Min', () => {
    const r = resizeEnd(plan(), 'eB', 15, ctx);
    expect(span(r.plan, 'eB')).toEqual([540, 615]);
    expect(span(r.plan, 'eN')).toEqual([615, 720]);
    const short = resizeEnd(plan(), 'eA', -60, ctx);
    expect(span(short.plan, 'eA')).toEqual([480, 495]);
    const rap = resizeEnd(
      withEntries(plan(), [rapport('eR', 4, { date: MO, code: 'KR', time: range(480, 510) })]),
      'eR',
      15,
      ctx,
    );
    const r2 = rap.plan.entries.eR;
    expect(r2?.type === 'rapport' ? r2.time : null).toEqual(range(480, 525));
  });
});
