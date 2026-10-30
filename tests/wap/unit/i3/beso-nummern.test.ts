// @vitest-environment node
// I3 C2: Beso-Nummerierung (Beschrieb 5.3; F-13, F-14, F-52, F-64/Q-016) über die Befehle, die das Raster und das
// Seitenfeld verwenden (createEntry, updateTimeWindow, setBesoNumberFixed, renumberDay, applyStand). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import {
  renumberDay,
  renumberDayPreview,
  setBesoNumberFixed,
  updateTimeWindow,
} from '../../../../src/model/wap/commands/beso';
import { createEntry, updateEntry } from '../../../../src/model/wap/commands/entries';
import { agendaLinesForDate, resolveTitle } from '../../../../src/model/wap/derive/agenda';
import { applyStand } from '../../../../src/model/wap/stand/stand';
import type { Beso, Plan } from '../../../../src/model/wap/types';
import { CTX, kpPlan, undo } from '../../support/i3/plan';

const MO = '2026-10-05';
const DI = '2026-10-06';

function add(plan: Plan, at: number, title: string, date = MO): { plan: Plan; id: string } {
  const r = createEntry(
    plan,
    {
      type: 'beso',
      date,
      title: [{ text: title, bold: false }],
      windows: [{ time: { form: 'point', at } }],
    },
    CTX,
  );
  return { plan: r.plan, id: r.entryId };
}

function nr(plan: Plan, id: string): number | null {
  const e = plan.entries[id];
  return e?.type === 'beso' ? e.besoNumber : null;
}

function windowOf(plan: Plan, id: string): string {
  const e = plan.entries[id] as Beso;
  return e.windows[0]?.id ?? '';
}

function many(n: number, plan0 = kpPlan(2)): { plan: Plan; ids: string[] } {
  let plan = plan0;
  const ids: string[] = [];
  for (let i = 0; i < n; i++) {
    const r = add(plan, 420 + i * 30, `Beso ${i + 1}`);
    plan = r.plan;
    ids.push(r.id);
  }
  return { plan, ids };
}

describe('I3 C2 Beso-Nummerierung (Beschrieb 5.3)', () => {
  it('[R-5.3-03] vor dem ersten Stand laufend nach Sortierzeit: 1400, 0800, 1000 → 12, 10, 11', () => {
    let p = kpPlan(2);
    const a = add(p, 840, 'A');
    const b = add(a.plan, 480, 'B');
    const c = add(b.plan, 600, 'C');
    p = c.plan;
    expect([nr(p, a.id), nr(p, b.id), nr(p, c.id)]).toEqual([12, 10, 11]);
    // Terminbereich nach Nummer: dieselben Nummern wie die Kästchen (ein Objekt, R-5.3-01).
    expect(agendaLinesForDate(p, MO).map((l) => l.number)).toEqual([10, 11, 12]);
  });

  it('[R-5.3-04] Verschieben vor dem Stand nummeriert Quell- und Zieltag neu', () => {
    const { plan, ids } = many(3);
    const [b10, b11, b12] = ids as [string, string, string];
    const moved = updateTimeWindow(
      plan,
      b12,
      windowOf(plan, b12),
      { time: { form: 'point', at: 360 } },
      CTX,
    );
    expect([nr(moved.plan, b12), nr(moved.plan, b10), nr(moved.plan, b11)]).toEqual([10, 11, 12]);
    const toDi = updateEntry(moved.plan, b10, 'beso', { date: DI }, CTX);
    expect(nr(toDi.plan, b10)).toBe(20);
    expect([nr(toDi.plan, b12), nr(toDi.plan, b11)]).toEqual([10, 11]);
    expect(nr(undo(toDi), b10)).toBe(11);
  });

  it('[R-5.3-05] fixierte Nummer bleibt beim Verschieben (F-13); Lösen nummeriert wieder laufend', () => {
    const { plan, ids } = many(4);
    const b13 = ids[3] as string;
    const fixed = setBesoNumberFixed(plan, b13, true, null, CTX);
    expect(fixed.label).toBe('Nr 13 fixiert');
    const moved = updateTimeWindow(
      fixed.plan,
      b13,
      windowOf(plan, b13),
      { time: { form: 'point', at: 300 } },
      CTX,
    );
    expect(nr(moved.plan, b13)).toBe(13);
    expect(ids.slice(0, 3).map((id) => nr(moved.plan, id))).toEqual([10, 11, 12]);
    // Fixierung lösen: der Tag wird wieder laufend nummeriert (0500 zuerst).
    const loose = setBesoNumberFixed(moved.plan, b13, false, null, CTX);
    expect(nr(loose.plan, b13)).toBe(10);
    expect(ids.slice(0, 3).map((id) => nr(loose.plan, id))).toEqual([11, 12, 13]);
  });

  it('[R-5.3-06] ab dem ersten Stand ändert Verschieben keine Nummer; [R-5.3-07] neuer Beso erhält die nächste freie Nummer unabhängig von der Zeit', () => {
    const { plan, ids } = many(4);
    const stand = applyStand(plan, { date: '2026-09-17' }, CTX).plan;
    const b10 = ids[0] as string;
    const moved = updateTimeWindow(
      stand,
      b10,
      windowOf(stand, b10),
      { time: { form: 'point', at: 1200 } },
      CTX,
    );
    expect(ids.map((id) => nr(moved.plan, id))).toEqual([10, 11, 12, 13]);
    const early = add(moved.plan, 300, 'Früh');
    expect(nr(early.plan, early.id)).toBe(14);
  });

  it('[R-5.3-08] «Tag neu nummerieren» ab dem Stand: Vorschau alt → neu, Befehl nummeriert nach Sortierzeit, Undo stellt her', () => {
    const { plan, ids } = many(3);
    const stand = applyStand(plan, { date: '2026-09-17' }, CTX).plan;
    const last = ids[2] as string;
    const moved = updateTimeWindow(
      stand,
      last,
      windowOf(stand, last),
      { time: { form: 'point', at: 300 } },
      CTX,
    ).plan;
    expect(nr(moved, last)).toBe(12);
    const preview = renumberDayPreview(moved, MO);
    expect(preview.map((p) => `${p.from}→${p.to}`)).toEqual(['12→10', '10→11', '11→12']);
    expect(nr(moved, last)).toBe(12);
    const r = renumberDay(moved, MO, CTX);
    expect(ids.map((id) => nr(r.plan, id))).toEqual([11, 12, 10]);
    expect(ids.map((id) => nr(undo(r), id))).toEqual([10, 11, 12]);
  });

  it('[R-5.3-09] (a) gestrichener Beso behält seine Nummer; neuer Beso erhält 13, nicht 12', () => {
    const { plan, ids } = many(3);
    const stand = applyStand(plan, { date: '2026-09-17' }, CTX).plan;
    const cancelled = updateEntry(
      stand,
      ids[2] as string,
      'beso',
      { status: 'cancelled' },
      CTX,
    ).plan;
    expect(nr(cancelled, ids[2] as string)).toBe(12);
    const fresh = add(cancelled, 480, 'Neu');
    expect(nr(fresh.plan, fresh.id)).toBe(13);
  });

  it('[R-5.3-09] (b) bis (e) und [R-5.3-10]: voller Kreis, 11. Beso ohne Nummer (nie 20), neuer Stand vergibt frei gewordene Nummern (F-64)', () => {
    const { plan, ids } = many(10);
    const stand = applyStand(plan, { date: '2026-09-17' }, CTX).plan;
    expect(ids.map((id) => nr(stand, id))).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    // (b) Beso 12 gestrichen, kein neuer Stand → neuer Beso ohne Nummer (P17, F-14), nie 20.
    const c12 = updateEntry(stand, ids[2] as string, 'beso', { status: 'cancelled' }, CTX).plan;
    const x = add(c12, 900, 'X');
    expect(nr(x.plan, x.id)).toBeNull();
    // (d) Neuer Stand → Beso 12 entfernt, X trägt 12, übrige unverändert.
    const s2 = applyStand(x.plan, { date: '2026-09-18' }, CTX).plan;
    expect(s2.entries[ids[2] as string]).toBeUndefined();
    expect(nr(s2, x.id)).toBe(12);
    expect(ids.filter((_, i) => i !== 2).map((id) => nr(s2, id))).toEqual([
      10, 11, 13, 14, 15, 16, 17, 18, 19,
    ]);
    // (e) 12 und 15 gestrichen, drei ohne Nummer X 1400, Y 0800, Z 1000 → Y 12, Z 15, X ohne Nummer.
    let e = applyStand(plan, { date: '2026-09-17' }, CTX).plan;
    e = updateEntry(e, ids[2] as string, 'beso', { status: 'cancelled' }, CTX).plan;
    e = updateEntry(e, ids[5] as string, 'beso', { status: 'cancelled' }, CTX).plan;
    const X = add(e, 840, 'X');
    const Y = add(X.plan, 480, 'Y');
    const Z = add(Y.plan, 600, 'Z');
    expect([X.id, Y.id, Z.id].map((id) => nr(Z.plan, id))).toEqual([null, null, null]);
    const s3 = applyStand(Z.plan, { date: '2026-09-18' }, CTX).plan;
    expect([nr(s3, Y.id), nr(s3, Z.id), nr(s3, X.id)]).toEqual([12, 15, null]);
  });

  it('[R-5.3-12] Verweise auf Beso-Nummern im Titel werden bei Umnummerierung nachgeführt', () => {
    const { plan, ids } = many(2);
    const ref = createEntry(
      plan,
      {
        type: 'block',
        date: MO,
        time: { form: 'range', from: 900, to: 960 },
        columns: { kind: 'all' },
        title: [{ text: 'Begehung (11)', bold: true }],
      },
      CTX,
    );
    const title = (p: Plan) =>
      resolveTitle(p, (p.entries[ref.entryId] as { title: Beso['title'] }).title)
        .map((r) => r.text)
        .join('');
    expect(title(ref.plan)).toBe('Begehung (11)');
    const second = ids[1] as string;
    const moved = updateTimeWindow(
      ref.plan,
      second,
      windowOf(ref.plan, second),
      { time: { form: 'point', at: 300 } },
      CTX,
    );
    expect(nr(moved.plan, second)).toBe(10);
    expect(title(moved.plan)).toBe('Begehung (10)');
  });

  it('[R-5.3-13] Beso ohne Zeit wird ganztägige Bemerkung ohne Nummer; die Nummer wird frei', () => {
    const { plan, ids } = many(2);
    const first = ids[0] as string;
    const r = updateTimeWindow(plan, first, windowOf(plan, first), { time: null }, CTX);
    expect(r.plan.entries[first]?.type).toBe('dayRemark');
    expect(nr(r.plan, ids[1] as string)).toBe(10);
    expect(agendaLinesForDate(r.plan, MO).map((l) => l.number)).toEqual([10, null]);
  });
});
