// @vitest-environment jsdom
// Der synthetische Plan ist ein gültiges Dokument mit der vertraglichen Verteilung
// (Vertrag E1-02a Abschnitt 6; ADR-010 §8). Geprüft über die Modellfunktionen.
import { describe, expect, it } from 'vitest';
import { weekDates } from '../../../../src/model/wap/calendar';
import { agendaLinesForDate } from '../../../../src/model/wap/derive/agenda';
import { dayColumns } from '../../../../src/model/wap/derive/columns';
import { entriesOnDate } from '../../../../src/model/wap/derive/entries';
import type { Block, Entry, Querbalken } from '../../../../src/model/wap/types';
import { validateColumnSet, validateEntry } from '../../../../src/model/wap/validate';
import { SYNTHETIC_COUNTS, SYNTHETIC_SEED, syntheticPlan } from '../../support/synthetic-plan';

const plan = syntheticPlan();

describe('synthetischer Plan', () => {
  it('[R-4.6-01] alle 1000 Einträge und alle Spaltensätze sind strukturell gültig; Plan deterministisch je Startwert', () => {
    for (const s of plan.columnSets) expect(validateColumnSet(s), s.name).toEqual([]);
    for (const e of Object.values(plan.entries)) expect(validateEntry(plan, e), e.id).toEqual([]);
    expect(Object.keys(plan.entries)).toHaveLength(SYNTHETIC_COUNTS.entries);
    expect(syntheticPlan(SYNTHETIC_SEED)).toEqual(plan);
    expect(syntheticPlan(SYNTHETIC_SEED + 1).entries).not.toEqual(plan.entries);
  });

  it('[R-4.4-09] je Tag 5–8 Planungsspalten aus wiederverwendeten Spaltensätzen, Nebenspalte an genau 6 Tagen', () => {
    let withSecondary = 0;
    for (const w of plan.weeks) {
      expect(weekDates(w.startDate)).toHaveLength(7);
      for (const d of w.days) {
        const cols = dayColumns(plan, w.id, d.weekday);
        const planning = cols.filter((c) => c.kind === 'planning').length;
        expect(planning).toBeGreaterThanOrEqual(SYNTHETIC_COUNTS.planningColumnsMin);
        expect(planning).toBeLessThanOrEqual(SYNTHETIC_COUNTS.planningColumnsMax);
        if (cols.some((c) => c.kind === 'secondary')) withSecondary++;
      }
    }
    expect(withSecondary).toBe(SYNTHETIC_COUNTS.daysWithSecondaryColumn);
    expect(plan.weeks).toHaveLength(SYNTHETIC_COUNTS.weeks);
    expect(plan.columnSets.length).toBeLessThan(plan.weeks.length * 7);
  });

  it('[R-4.6-04] Verteilung je Typ über die Tage des Plans; 5 Querbalken über eine Wochengrenze', () => {
    const seen = new Map<string, Entry>();
    for (const w of plan.weeks)
      for (const d of weekDates(w.startDate))
        for (const e of entriesOnDate(plan, d)) seen.set(e.id, e);
    const all = [...seen.values()];
    const count = (t: Entry['type']) => all.filter((e) => e.type === t).length;
    expect(count('block')).toBe(SYNTHETIC_COUNTS.blocks);
    expect(count('beso')).toBe(SYNTHETIC_COUNTS.beso);
    expect(count('rapport')).toBe(SYNTHETIC_COUNTS.rapports);
    expect(count('marker')).toBe(SYNTHETIC_COUNTS.markers);
    expect(count('querbalken')).toBe(SYNTHETIC_COUNTS.querbalken);
    expect(count('dayRemark')).toBe(SYNTHETIC_COUNTS.dayRemarks);
    const across = all.filter(
      (e): e is Querbalken =>
        e.type === 'querbalken' &&
        plan.weeks.some((w) => w.startDate > e.fromDate && w.startDate <= e.toDate),
    );
    expect(across).toHaveLength(SYNTHETIC_COUNTS.querbalkenAcrossWeeks);
  });

  it('[R-4.6-01] 40 verknüpfte Blöcke (nicht benachbarte Spalten) und 60 Blöcke mit Aussparung', () => {
    const blocks = Object.values(plan.entries).filter((e): e is Block => e.type === 'block');
    let linked = 0;
    let cutout = 0;
    for (const b of blocks) {
      const week = plan.weeks.find((w) => weekDates(w.startDate).includes(b.date));
      expect(week).toBeDefined();
      if (!week) continue;
      const day = week.days[weekDates(week.startDate).indexOf(b.date)];
      const cols = dayColumns(plan, week.id, day?.weekday ?? 'Mo');
      if (b.columns.kind === 'ids' && b.columns.ids.length > 1) {
        const idx = b.columns.ids
          .map((id) => cols.findIndex((c) => c.id === id))
          .sort((x, y) => x - y);
        if (idx.some((v, i) => i > 0 && v - (idx[i - 1] ?? v) > 1)) linked++;
      }
      if (b.columns.kind === 'all' && b.time.form === 'range') {
        const { from, to } = b.time;
        const inside = blocks.some(
          (o) =>
            o.id !== b.id &&
            o.date === b.date &&
            o.columns.kind === 'ids' &&
            o.time.form === 'range' &&
            o.time.from > from &&
            o.time.to < to,
        );
        if (inside) cutout++;
      }
    }
    expect(linked).toBe(SYNTHETIC_COUNTS.linkedBlocks);
    expect(cutout).toBe(SYNTHETIC_COUNTS.blocksWithCutout);
  });

  it('[R-4.8-09] höchstens 8 Beso je Tag mit 1–3 Zeitfenstern; Terminzeilen nach Nummer sortiert', () => {
    for (const w of plan.weeks) {
      for (const d of weekDates(w.startDate)) {
        const lines = agendaLinesForDate(plan, d).filter((l) => l.number !== null);
        expect(lines.length).toBeLessThanOrEqual(SYNTHETIC_COUNTS.besoPerDayMax);
        const nums = lines.map((l) => l.number ?? 0);
        expect(nums).toEqual([...nums].sort((a, b) => a - b));
      }
    }
    for (const e of Object.values(plan.entries)) {
      if (e.type === 'beso') {
        expect(e.windows.length).toBeGreaterThanOrEqual(1);
        expect(e.windows.length).toBeLessThanOrEqual(3);
      }
    }
  });
});
