// @vitest-environment node
// Paket F-LAYOUT2, Entscheid Auftraggeber 19.10.2026 «1: ja» (TE-I3-01; Beschrieb 10 «Status», R-10-27 bis R-10-29,
// R-10-31): Die Status-Darstellung folgt nur der Option `showStatus` (pro PDF abschaltbar); der Übergangsschalter
// `statusRendering` ist entfernt. Fiktive Einträge.
import { describe, expect, it } from 'vitest';
import { STATUS_RED } from '../../../../src/model/wap/layout/entries/status';
import { layoutWeekPage } from '../../../../src/model/wap/layout/page/compose';
import type { PageOptions } from '../../../../src/model/wap/layout/page/types';
import type { TextItem } from '../../../../src/model/wap/layout/pageModel';
import { builtInTemplates } from '../../../../src/model/wap/template';
import type { Id, Plan } from '../../../../src/model/wap/types';
import { add, block, kpPlan, MO } from '../../support/i5/plan';

const optionen = (showStatus: boolean): PageOptions => ({
  paper: 'A4',
  showStatus,
  templates: builtInTemplates(),
});

function plan(): { plan: Plan; offen: Id; gestrichen: Id; beso: Id } {
  let p = kpPlan(1);
  const a = block(p, 'Ausb Offen', { status: 'open' });
  p = a.plan;
  const b = block(p, 'Ausb Weg', {
    status: 'cancelled',
    time: { form: 'range', from: 720, to: 840 },
  });
  p = b.plan;
  const c = add(p, {
    type: 'beso',
    date: MO,
    title: [{ text: 'Visite offen', bold: false }],
    windows: [{ time: { form: 'point', at: 900 }, columnId: null, supplement: '' }],
    status: 'open',
  });
  return { plan: c.plan, offen: a.id, gestrichen: b.id, beso: c.id };
}

const texte = (L: ReturnType<typeof layoutWeekPage>, id: Id): TextItem[] =>
  (L.pages[0]?.items ?? []).filter((i): i is TextItem => i.kind === 'text' && i.entryId === id);

const rot = (t: TextItem) =>
  t.runs.some(
    (r) => r.color.r === STATUS_RED.r && r.color.g === STATUS_RED.g && r.color.b === STATUS_RED.b,
  );

describe('F-LAYOUT2 Punkt 1: Status immer gemäss Optionen (TE-I3-01)', () => {
  it('[R-10-27][R-10-29] showStatus ohne weiteren Schalter: offener Titel rot, gestrichener Eintrag rot durchgestrichen, offene Terminzeile rot', () => {
    const { plan: p, offen, gestrichen, beso } = plan();
    const L = layoutWeekPage(p, p.weeks[0]?.id as Id, optionen(true));
    expect(texte(L, offen).some(rot)).toBe(true);
    const weg = texte(L, gestrichen);
    expect(weg.length).toBeGreaterThan(0);
    expect(weg.every((t) => t.runs.every((r) => r.strike && rot(t)))).toBe(true);
    const termin = (L.pages[0]?.items ?? []).filter(
      (i): i is TextItem =>
        i.kind === 'text' && i.role === 'agenda' && i.runs.some((r) => r.text.includes('Visite')),
    );
    expect(termin.length).toBeGreaterThan(0);
    expect(termin.every(rot)).toBe(true);
    expect(texte(L, beso).length).toBeGreaterThan(0);
  });

  it('[R-10-31] showStatus false: kein Rot, keine Durchstreichung', () => {
    const { plan: p } = plan();
    const L = layoutWeekPage(p, p.weeks[0]?.id as Id, optionen(false));
    const alle = (L.pages[0]?.items ?? []).filter((i): i is TextItem => i.kind === 'text');
    expect(alle.some(rot)).toBe(false);
    expect(alle.some((t) => t.runs.some((r) => r.strike))).toBe(false);
  });
});
