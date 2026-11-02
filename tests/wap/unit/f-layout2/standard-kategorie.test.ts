// @vitest-environment node
// Paket F-LAYOUT2, Entscheid Auftraggeber 19.10.2026 «15: ja» (UX-H-14, TE-HUI2-01; Beschrieb 4.7 «Ein neuer Block
// ohne Ltg erhält die Standard-Leitungskategorie der Spalte, sonst die zuletzt verwendete»; R-4.4-03, R-4.7-11,
// R-4.7-12, R-4.9-19; revidiert V-03-1): Die Kp-Vorlage belegt die Standard-Kategorie je Planungsspalte aus ihrer
// Funktionsliste (Spaltenname = Funktionskürzel: «Kp Kdt» → Ltg Kp, «Zfhr» → Ltg Zfhr, übrige leer). Ohne Standard und
// ohne zuletzt verwendete Kategorie erhält ein neuer Block «Ltg Kp». Keine neue Datenablage: Funktionsliste und
// Column.defaultCategoryId bestehen schon. Fiktive Titel.
import { describe, expect, it } from 'vitest';
import { createEntry } from '../../../../src/model/wap/commands/entries';
import { createPlanFromTemplate } from '../../../../src/model/wap/factories';
import { builtInTemplates, kpTemplate } from '../../../../src/model/wap/template';
import { applyNewPlanDays } from '../../../../src/model/wap/template/newPlanDays';
import type { Block, Column, Id, Plan } from '../../../../src/model/wap/types';

const CTX = { templates: builtInTemplates() };
const MO = '2026-09-28';

/** Neuer Plan wie «Neuer Plan aus Vorlage» (Mo–Di «KVK Stufen»). */
function neu(): Plan {
  const t = kpTemplate();
  return applyNewPlanDays(
    createPlanFromTemplate(t, { planId: 'p-f-layout2', startDate: MO, weekCount: 1 }),
    t,
  );
}

const kat = (p: Plan, name: string): Id => p.legend.find((c) => c.name === name)?.id ?? '';
const spalte = (p: Plan, name: string): Column =>
  p.columnSets.flatMap((s) => s.columns).find((c) => c.name === name) as Column;

function neuerBlock(p: Plan, columnName: string): { plan: Plan; block: Block } {
  const r = createEntry(
    p,
    {
      type: 'block',
      date: MO,
      time: { form: 'range', from: 480, to: 600 },
      columns: { kind: 'ids', ids: [spalte(p, columnName).id] },
      title: [{ text: 'Ausb Thema', bold: true }],
    },
    CTX,
  );
  return { plan: r.plan, block: r.plan.entries[r.entryId] as Block };
}

describe('F-LAYOUT2 Punkt 15: Standard-Kategorie je Spalte aus der Funktionsliste', () => {
  it('[R-4.9-19][R-4.4-03] neuer Kp-Plan: «Kp Kdt» → Ltg Kp, «Zfhr» → Ltg Zfhr, alle übrigen Spalten ohne Standard', () => {
    const p = neu();
    const byId = new Map(p.legend.map((c) => [c.id, c.name]));
    const belegt = p.columnSets
      .flatMap((s) => s.columns)
      .map((c) => [c.name, c.defaultCategoryId === null ? null : byId.get(c.defaultCategoryId)]);
    expect(belegt.filter(([, k]) => k !== null)).toEqual([
      ['Kp Kdt', 'Ltg Kp'],
      ['Zfhr', 'Ltg Zfhr'],
    ]);
  });

  it('[R-4.7-11] neuer Block ohne Kategorie in «Kp Kdt» → Ltg Kp, in «Zfhr» → Ltg Zfhr', () => {
    const p = neu();
    expect(neuerBlock(p, 'Kp Kdt').block.categoryId).toBe(kat(p, 'Ltg Kp'));
    expect(neuerBlock(p, 'Zfhr').block.categoryId).toBe(kat(p, 'Ltg Zfhr'));
  });

  it('[R-4.7-12] (V-03-1 revidiert) Spalte ohne Standard, nichts zuletzt verwendet → Ltg Kp statt der ersten Legendenkategorie (Ltg Bat)', () => {
    const p = neu();
    expect(p.lastUsedCategoryId).toBeNull();
    expect(p.legend[0]?.name).toBe('Ltg Bat');
    expect(neuerBlock(p, 'Uof').block.categoryId).toBe(kat(p, 'Ltg Kp'));
  });

  it('[R-4.7-12] zuletzt verwendete Kategorie geht dem Rückfall vor (Spalte ohne Standard)', () => {
    const p = { ...neu(), lastUsedCategoryId: null };
    const zfhr = neuerBlock(p, 'Zfhr').plan;
    expect(zfhr.lastUsedCategoryId).toBe(kat(p, 'Ltg Zfhr'));
    expect(neuerBlock(zfhr, 'Trp').block.categoryId).toBe(kat(p, 'Ltg Zfhr'));
  });
});
