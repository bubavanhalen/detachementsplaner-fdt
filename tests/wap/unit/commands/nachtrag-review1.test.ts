// @vitest-environment jsdom
// Nachtrag zur Code-Review Runde 1 (Vertrag E1-03, Zeile «Orchestrator, 04.10.2026 (Code-Review Runde 1)»
// (a), (b), (c), (e), (f); Befunde CR-E103-01 bis -06; Test-Review TR-E103-13 bis -18). Nur fiktive Daten.
import { describe, expect, it } from 'vitest';
import { addTimeWindow, updateTimeWindow } from '../../../../src/model/wap/commands/beso';
import {
  type BlockDraft,
  copyEntryToDates,
  createEntry,
  moveEntries,
  updateEntries,
  updateEntry,
} from '../../../../src/model/wap/commands/entries';
import { assignNumbers } from '../../../../src/model/wap/commands/numbering';
import type { Entry, Plan } from '../../../../src/model/wap/types';
import {
  besoUm,
  besoVon,
  ctx,
  DI,
  eintrag,
  expectKeineWirkung,
  MO,
  planMit,
  run,
} from '../../support/commands/helpers';
import { beso, block, CAT, rapport, roundTrip, rt } from '../../support/model/builders';

/** Geschütztes Leerzeichen U+00A0 (als Zeichencode, damit es im Quelltext sichtbar bleibt). */
const NBSP = String.fromCharCode(0xa0);

describe('(a) updateEntries und «zuletzt verwendet»', () => {
  it('[R-4.7-12] (V-03-4, Orchestrator a) Blöcke behalten ihre Kategorie → ohne Wirkung, «zuletzt verwendet» bleibt', () => {
    const plan = planMit(
      [block('e1', 1, { categoryId: CAT.extern }), block('e2', 2, { categoryId: CAT.extern })],
      { lastUsedCategoryId: CAT.kp },
    );
    const r = updateEntries(plan, ['e1', 'e2'], { categoryId: CAT.extern }, ctx);
    expectKeineWirkung(plan, r);
  });

  it('[R-4.7-12] (V-03-4, Orchestrator a) nur ein Beso ändert die Kategorie, der Block nicht → «zuletzt verwendet» bleibt', () => {
    const plan = planMit(
      [block('e1', 1, { categoryId: CAT.extern }), besoUm('e2', 2, MO, 480, 10)],
      { lastUsedCategoryId: CAT.kp },
    );
    const r = run(plan, (p) => updateEntries(p, ['e1', 'e2'], { categoryId: CAT.extern }, ctx));
    expect(eintrag(r.plan, 'e2')).toMatchObject({ categoryId: CAT.extern });
    expect(r.plan.lastUsedCategoryId).toBe(CAT.kp);
  });

  it('[R-4.7-12] (V-03-4, Orchestrator a) ein Block erhält eine andere Kategorie → «zuletzt verwendet» gesetzt', () => {
    const plan = planMit(
      [block('e1', 1, { categoryId: CAT.extern }), block('e2', 2, { categoryId: CAT.kp })],
      { lastUsedCategoryId: CAT.kp },
    );
    const r = run(plan, (p) => updateEntries(p, ['e1', 'e2'], { categoryId: CAT.extern }, ctx));
    expect(eintrag(r.plan, 'e2')).toMatchObject({ categoryId: CAT.extern });
    expect(r.plan.lastUsedCategoryId).toBe(CAT.extern);
  });
});

describe('(a) Statusänderung ohne Kategoriewechsel', () => {
  it('[R-4.7-12] (V-03-4, Orchestrator a) Block nur im Status geändert, Kategorie gleich → «zuletzt verwendet» bleibt', () => {
    const plan = planMit([block('e1', 1, { categoryId: CAT.extern })], {
      lastUsedCategoryId: CAT.kp,
    });
    const r = run(plan, (p) =>
      updateEntries(p, ['e1'], { categoryId: CAT.extern, status: 'open' }, ctx),
    );
    expect(eintrag(r.plan, 'e1')).toMatchObject({ status: 'open', categoryId: CAT.extern });
    expect(r.plan.lastUsedCategoryId).toBe(CAT.kp);
  });
});

describe('(b) Rapport-Kürzel am Rand getrimmt gespeichert', () => {
  it('[R-4.6-18] (2a, Orchestrator b) createEntry: « KR » und KR mit U+00A0 an beiden Rändern → «KR»', () => {
    for (const code of [' KR ', `${NBSP}KR${NBSP}`]) {
      const r = run(planMit([]), (p) =>
        createEntry(p, { type: 'rapport', date: MO, code, time: { form: 'point', at: 1080 } }, ctx),
      );
      expect(eintrag(r.plan, 'e100')).toMatchObject({ code: 'KR', categoryId: CAT.kp });
    }
  });

  it('[R-4.6-18] (2a, Orchestrator b) createEntry: « BR 0 » und mit U+00A0 → «BR 0» (innerer Leerraum bleibt), Ltg Bat aus der Rapportliste', () => {
    for (const code of [' BR 0 ', `${NBSP}BR 0${NBSP}`]) {
      const r = run(planMit([]), (p) =>
        createEntry(p, { type: 'rapport', date: MO, code, time: { form: 'point', at: 1080 } }, ctx),
      );
      expect(eintrag(r.plan, 'e100')).toMatchObject({ code: 'BR 0', categoryId: CAT.bat });
    }
  });

  it('[R-4.6-18] (2a updateEntry, Orchestrator b) updateEntry: DR mit U+00A0 und Leerzeichen → «DR»', () => {
    const plan = planMit([rapport('e1', 1, { date: MO })]);
    const r = run(plan, (p) => updateEntry(p, 'e1', 'rapport', { code: `${NBSP}DR ` }, ctx));
    expect(eintrag(r.plan, 'e1')).toMatchObject({ code: 'DR' });
  });

  it('[R-4.6-18] (2a updateEntry, 1a Schritt 4, Orchestrator b) « KR » auf «KR» → ohne Wirkung', () => {
    const plan = planMit([rapport('e1', 1, { date: MO, code: 'KR' })]);
    expectKeineWirkung(plan, updateEntry(plan, 'e1', 'rapport', { code: ' KR ' }, ctx));
  });
});

describe('(c) übergebene Eingabeobjekte werden kopiert', () => {
  it('[R-4.7-11] (Orchestrator c) createEntry Block: Entwurf, time, columns nicht eingefroren, unverändert; spätere Änderung am Entwurf ändert den Plan nicht', () => {
    const time: { form: 'range'; from: number; to: number } = { form: 'range', from: 480, to: 600 };
    const columns: { kind: 'ids'; ids: string[] } = { kind: 'ids', ids: ['c9'] };
    const entwurf: BlockDraft = { type: 'block', date: MO, time, columns, title: rt('Ausb') };
    const vorher = roundTrip(entwurf);
    const r = run(planMit([]), (p) => createEntry(p, entwurf, ctx));
    expect(Object.isFrozen(entwurf)).toBe(false);
    expect(Object.isFrozen(time)).toBe(false);
    expect(Object.isFrozen(columns)).toBe(false);
    expect(Object.isFrozen(columns.ids)).toBe(false);
    expect(entwurf).toEqual(vorher);
    const abzug = roundTrip(eintrag(r.plan, 'e100'));
    time.to = 660;
    columns.ids.push('c10');
    expect(eintrag(r.plan, 'e100')).toEqual(abzug);
    // derselbe Entwurf ist wiederverwendbar
    const r2 = run(r.plan, (p) => createEntry(p, entwurf, ctx));
    expect(eintrag(r2.plan, 'e101')).toMatchObject({
      time: { form: 'range', from: 480, to: 660 },
      columns: { kind: 'ids', ids: ['c9', 'c10'] },
    });
  });

  it('[R-5.1-17] (Orchestrator c) updateEntry: übergebene Änderungen nicht eingefroren; spätere Änderung ändert den Plan nicht', () => {
    const plan = planMit([block('e1', 1, { date: MO })]);
    const aenderung: {
      time: { form: 'point'; at: number };
      columns: { kind: 'ids'; ids: string[] };
    } = {
      time: { form: 'point', at: 600 },
      columns: { kind: 'ids', ids: ['c10'] },
    };
    const r = run(plan, (p) => updateEntry(p, 'e1', 'block', aenderung, ctx));
    expect(Object.isFrozen(aenderung)).toBe(false);
    expect(Object.isFrozen(aenderung.time)).toBe(false);
    expect(Object.isFrozen(aenderung.columns)).toBe(false);
    expect(Object.isFrozen(aenderung.columns.ids)).toBe(false);
    expect(aenderung).toEqual({
      time: { form: 'point', at: 600 },
      columns: { kind: 'ids', ids: ['c10'] },
    });
    const abzug = roundTrip(eintrag(r.plan, 'e1'));
    aenderung.time.at = 700;
    aenderung.columns.ids.push('c11');
    expect(eintrag(r.plan, 'e1')).toEqual(abzug);
  });

  it('[R-4.6-25] (Orchestrator c) addTimeWindow: Fensterangabe nicht eingefroren; spätere Änderung ändert den Plan nicht', () => {
    const plan = planMit([besoUm('e2', 2, MO, 480, 10)]);
    const fenster: { time: { form: 'point'; at: number } } = { time: { form: 'point', at: 900 } };
    const r = run(plan, (p) => addTimeWindow(p, 'e2', fenster, ctx));
    expect(Object.isFrozen(fenster)).toBe(false);
    expect(Object.isFrozen(fenster.time)).toBe(false);
    expect(fenster).toEqual({ time: { form: 'point', at: 900 } });
    const abzug = roundTrip(besoVon(r.plan, 'e2'));
    fenster.time.at = 1000;
    expect(besoVon(r.plan, 'e2')).toEqual(abzug);
  });

  it('[R-4.6-25] (Orchestrator c) createEntry Beso: windows[i] und time nicht eingefroren; spätere Änderung ändert den Plan nicht', () => {
    const fenster: { time: { form: 'point'; at: number } } = { time: { form: 'point', at: 600 } };
    const r = run(planMit([]), (p) =>
      createEntry(p, { type: 'beso', date: MO, title: rt('Kontrl Fsg'), windows: [fenster] }, ctx),
    );
    expect(Object.isFrozen(fenster)).toBe(false);
    expect(Object.isFrozen(fenster.time)).toBe(false);
    expect(fenster).toEqual({ time: { form: 'point', at: 600 } });
    const abzug = roundTrip(besoVon(r.plan, 'e100'));
    fenster.time.at = 1000;
    expect(besoVon(r.plan, 'e100')).toEqual(abzug);
  });

  it('[R-4.6-25] (Orchestrator c) updateTimeWindow: changes.time nicht eingefroren; spätere Änderung ändert den Plan nicht', () => {
    const plan = planMit([besoUm('e2', 2, MO, 480, 10)]);
    const changes: { time: { form: 'point'; at: number } } = { time: { form: 'point', at: 700 } };
    const r = run(plan, (p) => updateTimeWindow(p, 'e2', 'te2', changes, ctx));
    expect(Object.isFrozen(changes)).toBe(false);
    expect(Object.isFrozen(changes.time)).toBe(false);
    expect(changes).toEqual({ time: { form: 'point', at: 700 } });
    const abzug = roundTrip(besoVon(r.plan, 'e2'));
    changes.time.at = 1000;
    expect(besoVon(r.plan, 'e2')).toEqual(abzug);
  });
});

describe('(c) übergebene Eingabeobjekte bei Rapport, Querbalken und Marker', () => {
  it('[R-4.6-18] (Orchestrator c) createEntry Rapport: time und displayColumns nicht eingefroren; spätere Änderung ändert den Plan nicht', () => {
    const time: { form: 'range'; from: number; to: number } = {
      form: 'range',
      from: 1080,
      to: 1110,
    };
    const displayColumns: { kind: 'ids'; ids: string[] } = { kind: 'ids', ids: [] };
    const r = run(planMit([]), (p) =>
      createEntry(p, { type: 'rapport', date: MO, code: 'KR', time, displayColumns }, ctx),
    );
    expect(Object.isFrozen(time)).toBe(false);
    expect(Object.isFrozen(displayColumns)).toBe(false);
    expect(Object.isFrozen(displayColumns.ids)).toBe(false);
    const abzug = roundTrip(eintrag(r.plan, 'e100'));
    time.to = 1140;
    displayColumns.ids.push('c9');
    expect(eintrag(r.plan, 'e100')).toEqual(abzug);
  });

  it('[R-5.1-19] (Orchestrator c) createEntry Querbalken und Marker: columns nicht eingefroren; spätere Änderung ändert den Plan nicht', () => {
    const qColumns: { kind: 'ids'; ids: string[] } = { kind: 'ids', ids: ['c9'] };
    const q = run(planMit([]), (p) =>
      createEntry(
        p,
        { type: 'querbalken', fromDate: MO, toDate: DI, title: rt('Messe'), columns: qColumns },
        ctx,
      ),
    );
    expect(Object.isFrozen(qColumns)).toBe(false);
    expect(Object.isFrozen(qColumns.ids)).toBe(false);
    const qAbzug = roundTrip(eintrag(q.plan, 'e100'));
    qColumns.ids.push('c10');
    expect(eintrag(q.plan, 'e100')).toEqual(qAbzug);

    const mColumns: { kind: 'ids'; ids: string[] } = { kind: 'ids', ids: ['c9'] };
    const m = run(planMit([]), (p) =>
      createEntry(p, { type: 'marker', date: MO, at: 420, kind: 'AV', columns: mColumns }, ctx),
    );
    expect(Object.isFrozen(mColumns)).toBe(false);
    expect(Object.isFrozen(mColumns.ids)).toBe(false);
    const mAbzug = roundTrip(eintrag(m.plan, 'e100'));
    mColumns.ids.push('c10');
    expect(eintrag(m.plan, 'e100')).toEqual(mAbzug);
  });
});

describe('(e) Beschriftung bei einem Tag', () => {
  it('[R-5.1-19] (1c, Orchestrator e) copyEntryToDates mit einem Datum → «… an 1 Tag kopiert»', () => {
    const plan = planMit([block('e1', 1, { date: MO, columns: { kind: 'all' } })]);
    const r = run(plan, (p) => copyEntryToDates(p, 'e1', [DI], ctx));
    expect(r.label).toBe('Block «Ausb Thema» an 1 Tag kopiert');
  });

  it('[R-5.1-19] (1c, 2a, Orchestrator e) n nach Bereinigung: [eigenes Datum, Di, Di] → «… an 1 Tag kopiert»', () => {
    const plan = planMit([block('e1', 1, { date: MO, columns: { kind: 'all' } })]);
    const r = run(plan, (p) => copyEntryToDates(p, 'e1', [MO, DI, DI], ctx));
    expect(r.newIds).toEqual(['e100']);
    expect(r.label).toBe('Block «Ausb Thema» an 1 Tag kopiert');
  });
});

describe('(f) Beso ohne Zeitfenster in der Sortierung', () => {
  function mitReihenfolge(entries: readonly Entry[]): Plan {
    const p = planMit([]);
    const map: Record<string, Entry> = {};
    for (const e of entries) map[e.id] = e;
    return { ...p, entries: map };
  }
  const mitFenster = besoUm('e1', 9, MO, 1400, null, {
    windows: [{ id: 't1', time: { form: 'deadline' }, columnId: null, supplement: '' }],
  });
  const ohneA = beso('e7', 2, { date: MO, besoNumber: null, windows: [] });
  const ohneB = beso('e3', 5, { date: MO, besoNumber: null, windows: [] });
  const ohneC = beso('e5', 5, { date: MO, besoNumber: null, windows: [] });

  it('[R-5.3-03] (§3, Orchestrator f) ohne Zeitfenster: nach allen mit Zeitfenster, untereinander nach createdSeq, dann id; unabhängig von der Schlüsselreihenfolge', () => {
    const erwartet = { e1: 10, e7: 11, e3: 12, e5: 13 };
    const a = mitReihenfolge([mitFenster, ohneA, ohneB, ohneC]);
    const b = mitReihenfolge([ohneC, ohneB, ohneA, mitFenster]);
    expect(Object.fromEntries(assignNumbers(a, MO))).toEqual(erwartet);
    expect(Object.fromEntries(assignNumbers(b, MO))).toEqual(erwartet);
  });

  it('[R-5.3-04] (§3, Orchestrator f) Befehl am Tag nummeriert Beso ohne Zeitfenster gleich, unabhängig von der Schlüsselreihenfolge', () => {
    // e1 (Frist, Sortierzeit 0) und e8 (0600) haben Zeitfenster und stehen vor allen ohne
    const erwartet = { e1: 10, e8: 11, e7: 12, e3: 13, e5: 14 };
    for (const reihenfolge of [
      [mitFenster, ohneA, ohneB, ohneC],
      [ohneC, ohneB, ohneA, mitFenster],
    ]) {
      const plan = mitReihenfolge([...reihenfolge, besoUm('e8', 20, DI, 600, 20)]);
      const r = moveEntries(plan, ['e8'], { dayOffset: -1 }, ctx);
      const nummern: Record<string, number | null> = {};
      for (const e of Object.values(r.plan.entries))
        if (e.type === 'beso') nummern[e.id] = e.besoNumber;
      expect(nummern).toEqual(erwartet);
    }
  });
});
