// Testhilfen I5 (Schnellspur AE-005/AE-006): fiktive Pläne für Prüfregeln, Stand und Layout-Ergänzungen. Ohne
// Layout-Schicht, damit auch E2E-Tests (Node-Lader von Playwright) sie laden können. Nur fiktive Daten.
import { setDayColumnSet, setDayDisplay } from '../../../../src/model/wap/commands/days';
import { createEntry, type EntryDraft } from '../../../../src/model/wap/commands/entries';
import type { Column, Entry, Id, IsoDate, Plan } from '../../../../src/model/wap/types';
import { CTX, kpPlan as fullPlan } from '../i3/plan';

export { CTX };

/**
 * Fiktiver Kp-Plan wie im KVK: Mo–Di «KVK Stufen», Mi–Fr «KVK Mi–Fr», Sa–So «Wochenende kompakt» (kompakt), damit
 * die Spaltenköpfe passen (sonst meldet P8 «zu viele Spalten» an jedem Tag).
 */
export function kpPlan(weeks = 1): Plan {
  let plan = fullPlan(weeks);
  const [, mid, weekend] = plan.columnSets;
  if (mid === undefined || weekend === undefined) throw new Error('Spaltensätze fehlen');
  for (const w of plan.weeks) {
    plan = setDayColumnSet(plan, w.id, ['Mi', 'Do', 'Fr'], mid.id, CTX).plan;
    plan = setDayColumnSet(plan, w.id, ['Sa', 'So'], weekend.id, CTX).plan;
    plan = setDayDisplay(plan, w.id, ['Sa', 'So'], 'compact', CTX).plan;
  }
  return plan;
}

/** Montag der ersten Woche der Testpläne. */
export const MO: IsoDate = '2026-09-28';

/** Planungsspalten des ersten Spaltensatzes (alle Tage, wie «Neuer Plan aus Vorlage»). */
export function planning(plan: Plan): readonly Column[] {
  return (plan.columnSets[0]?.columns ?? []).filter((c) => c.kind === 'planning');
}

export function column(plan: Plan, index: number): Column {
  const c = planning(plan)[index];
  if (c === undefined) throw new Error(`Spalte ${index} fehlt`);
  return c;
}

/** Eintrag anlegen; liefert Plan und ID. */
export function add(plan: Plan, draft: EntryDraft): { plan: Plan; id: Id } {
  const r = createEntry(plan, draft, CTX);
  return { plan: r.plan, id: r.entryId };
}

/** Block mit Titel in den angegebenen Spalten (Standard: erste Planungsspalte), 0800–1000. */
export function block(
  plan: Plan,
  title: string,
  over: Partial<Extract<EntryDraft, { type: 'block' }>> = {},
): { plan: Plan; id: Id } {
  return add(plan, {
    type: 'block',
    date: MO,
    time: { form: 'range', from: 480, to: 600 },
    columns: { kind: 'ids', ids: [column(plan, 0).id] },
    title: [{ text: title, bold: true }],
    ...over,
  });
}

/** n Beso am selben Tag, je 30 Minuten versetzt ab 0700. */
export function besos(plan: Plan, n: number, date: IsoDate = MO): { plan: Plan; ids: Id[] } {
  let p = plan;
  const ids: Id[] = [];
  for (let i = 0; i < n; i++) {
    const r = add(p, {
      type: 'beso',
      date,
      title: [{ text: `Visite ${String(i + 1)}`, bold: false }],
      windows: [{ time: { form: 'point', at: 420 + i * 30 } }],
    });
    p = r.plan;
    ids.push(r.id);
  }
  return { plan: p, ids };
}

export function entry(plan: Plan, id: Id): Entry {
  const e = plan.entries[id];
  if (e === undefined) throw new Error(`Eintrag ${id} fehlt`);
  return e;
}
