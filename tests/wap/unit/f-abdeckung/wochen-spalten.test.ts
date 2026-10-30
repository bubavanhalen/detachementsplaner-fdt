// @vitest-environment node
// F-ABDECKUNG (FT-A-01): Wochenbefehle (Beschrieb 4.2, 5.2; F-16, F-17) und Spaltenkopf je Tag oder Spaltensatz
// (I2b-A A8; Beschrieb 4.4, 5.2) mit allen Eintragstypen, Fehlerpfaden und Grenzfällen. Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { CommandError } from '../../../../src/model/wap/commands/command';
import { columnSetUsage, updateDayColumn } from '../../../../src/model/wap/commands/dayColumns';
import {
  deleteWeek,
  duplicateWeek,
  insertWeek,
  insertWeekPreview,
  renameWeek,
  restoreWeek,
  setWeekStart,
} from '../../../../src/model/wap/commands/weeks';
import type { Beso, Entry, Id, Plan, Weekday } from '../../../../src/model/wap/types';
import { undo } from '../../support/i3/plan';
import { add, block, CTX, column, kpPlan, MO } from '../../support/i5/plan';

const DI = '2026-09-29';
const wk = (plan: Plan, i = 0): Id => plan.weeks[i]?.id ?? '';
function fehler(fn: () => unknown, code: string, field: string | null): CommandError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(CommandError);
    const c = e as CommandError;
    expect([c.code, c.field]).toEqual([code, field]);
    expect(c.userMessage.nextStep).not.toBe('');
    return c;
  }
  throw new Error('kein Fehler geworfen');
}
const entryOf = (plan: Plan, id: Id): Entry => {
  const e = plan.entries[id];
  if (e === undefined) throw new Error(`Eintrag ${id} fehlt`);
  return e;
};

/** KVK mit je einem Eintrag jedes Typs, der ganz in der Woche liegt, plus einem Querbalken über die Wochengrenze. */
function volleWoche(): { plan: Plan; ids: Record<string, Id> } {
  let p = kpPlan(2);
  const ids: Record<string, Id> = {};
  const put = (name: string, r: { plan: Plan; id: Id }) => {
    p = r.plan;
    ids[name] = r.id;
  };
  put('block', block(p, 'Ausb'));
  put(
    'beso',
    add(p, {
      type: 'beso',
      date: MO,
      title: [{ text: 'Visite', bold: false }],
      windows: [{ time: { form: 'point', at: 600 } }],
    }),
  );
  put(
    'querInnen',
    add(p, {
      type: 'querbalken',
      fromDate: MO,
      toDate: DI,
      title: [{ text: 'Q innen', bold: false }],
    }),
  );
  put(
    'querAussen',
    add(p, {
      type: 'querbalken',
      fromDate: '2026-10-03',
      toDate: '2026-10-06',
      title: [{ text: 'Q aussen', bold: false }],
    }),
  );
  put(
    'wocheBem',
    add(p, { type: 'multiDayRemark', text: 'Woche', scope: { kind: 'week', weekId: wk(p) } }),
  );
  put(
    'zeitraumBem',
    add(p, {
      type: 'multiDayRemark',
      text: 'Zeitraum',
      scope: { kind: 'range', fromDate: MO, toDate: DI },
    }),
  );
  put('planBem', add(p, { type: 'multiDayRemark', text: 'Plan', scope: { kind: 'plan' } }));
  return { plan: p, ids };
}

describe('F-ABDECKUNG Woche einfügen und duplizieren (R-5.2-02, R-5.2-03; F-16)', () => {
  it('[R-5.2-02] Einfügen nach der letzten Woche: Start + 7 Tage, Spaltensätze und Darstellung wie die Vorwoche, Kurzname frei', () => {
    const p = kpPlan(1);
    expect(insertWeekPreview(p, wk(p))).toEqual({
      startDate: '2026-10-05',
      collides: false,
      shifted: [],
    });
    const r = insertWeek(p, wk(p), { shiftFollowing: false }, CTX);
    const neu = r.plan.weeks[1];
    expect(neu).toMatchObject({
      id: r.weekId,
      startDate: '2026-10-05',
      label: 'Woche 1',
      shortName: 'Wo1',
      weekGoals: [],
    });
    expect(neu?.days.map((d) => [d.columnSetId, d.display])).toEqual(
      p.weeks[0]?.days.map((d) => [d.columnSetId, d.display]),
    );
    expect(r.label).toBe('Woche «Woche 1» eingefügt');
  });

  it('[R-5.2-02] Folgewoche belegt: ohne Verschieben Fehler mit Datum und nächstem Schritt; mit Verschieben wandern Wochen und Einträge', () => {
    let p = kpPlan(3);
    const r0 = block(p, 'In Wo1', { date: '2026-10-05' });
    p = r0.plan;
    const c = fehler(
      () => insertWeek(p, wk(p), { shiftFollowing: false }, CTX),
      'invalidDate',
      'startDate',
    );
    expect(c.userMessage.cause).toBe('Ab 05.10.2026 liegt schon eine Woche des Plans.');
    const pv = insertWeekPreview(p, wk(p));
    expect(pv.collides).toBe(true);
    expect(pv.shifted.map((s) => [s.from, s.to])).toEqual([
      ['2026-10-05', '2026-10-12'],
      ['2026-10-12', '2026-10-19'],
    ]);
    const r = insertWeek(p, wk(p), { shiftFollowing: true }, CTX);
    expect(r.plan.weeks.map((w) => w.startDate)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
      '2026-10-19',
    ]);
    expect((entryOf(r.plan, r0.id) as { date: string }).date).toBe('2026-10-12');
    expect(r.plan.weeks[1]?.shortName).toBe('Wo3');
    expect(undo(r)).toEqual(p);
  });

  it('[R-5.2-02] Nur zusammenhängende Folgewochen weichen; nach einer Lücke bleibt alles', () => {
    const p = kpPlan(2);
    const w2 = p.weeks[1];
    if (w2 === undefined) throw new Error('Woche fehlt');
    const mitLuecke: Plan = {
      ...p,
      weeks: [...p.weeks, { ...w2, id: 'w-spaet', shortName: 'Wo9', startDate: '2026-10-26' }],
    };
    expect(insertWeekPreview(mitLuecke, wk(p)).shifted.map((s) => s.weekId)).toEqual([w2.id]);
  });

  it('[R-5.2-03] Duplizieren: Einträge der Woche als Kopien + 7 Tage; Beso neu nummeriert und nicht fixiert; Wochenbemerkung an der Kopie', () => {
    const { plan, ids } = volleWoche();
    const ohneWo1: Plan = { ...plan, weeks: plan.weeks.slice(0, 1) };
    const r = duplicateWeek(ohneWo1, wk(plan), { shiftFollowing: false }, CTX);
    const kopie = r.plan.weeks.find((w) => w.id === r.weekId);
    expect(kopie).toMatchObject({
      label: 'KVK (Kopie)',
      shortName: 'Wo1',
      startDate: '2026-10-05',
    });
    const neu = Object.values(r.plan.entries).filter((e) => !Object.hasOwn(ohneWo1.entries, e.id));
    const titel = (e: Entry) =>
      e.type === 'multiDayRemark'
        ? e.text
        : 'title' in e
          ? e.title.map((t) => t.text).join('')
          : '';
    expect(neu.map(titel).sort()).toEqual(['Ausb', 'Q innen', 'Visite', 'Woche', 'Zeitraum']);
    const beso = neu.find((e): e is Beso => e.type === 'beso');
    expect(beso).toMatchObject({ date: '2026-10-05', besoNumber: 10, numberFixed: false });
    expect(beso?.windows[0]?.id).not.toBe((entryOf(plan, ids.beso ?? '') as Beso).windows[0]?.id);
    const bem = neu.find((e) => e.type === 'multiDayRemark' && e.text === 'Woche');
    expect(bem).toMatchObject({ scope: { kind: 'week', weekId: r.weekId } });
    const zr = neu.find((e) => e.type === 'multiDayRemark' && e.text === 'Zeitraum');
    expect(zr).toMatchObject({
      scope: { kind: 'range', fromDate: '2026-10-05', toDate: '2026-10-06' },
    });
    const q = neu.find((e) => e.type === 'querbalken');
    expect(q).toMatchObject({ fromDate: '2026-10-05', toDate: '2026-10-06' });
    expect(r.label).toBe('Woche «KVK» dupliziert');
  });

  it('[R-5.2-03] Duplizieren: Kopie übernimmt Wochenziele (neue IDs), Bereitschaft, Sonnenzeiten und Notizen; Kollision ohne Verschieben → Fehler', () => {
    const p = kpPlan(2);
    const w = p.weeks[0];
    if (w === undefined) throw new Error('Woche fehlt');
    const mit: Plan = {
      ...p,
      weeks: [
        {
          ...w,
          weekGoals: [{ id: 'g-alt', text: 'Ziel', group: null }],
          heightenedReadiness: 'Pikett',
          sunOverride: { sunrise: 420, sunset: 1140 },
          days: w.days.map((d, i) =>
            i === 0 ? { ...d, internalNote: 'Notiz' } : d,
          ) as unknown as typeof w.days,
        },
        ...p.weeks.slice(1),
      ],
    };
    fehler(
      () => duplicateWeek(mit, wk(p), { shiftFollowing: false }, CTX),
      'invalidDate',
      'startDate',
    );
    const r = duplicateWeek(mit, wk(p), { shiftFollowing: true }, CTX);
    const kopie = r.plan.weeks.find((x) => x.id === r.weekId);
    expect(kopie?.weekGoals.map((g) => g.text)).toEqual(['Ziel']);
    expect(kopie?.weekGoals[0]?.id).not.toBe('g-alt');
    expect(kopie).toMatchObject({
      heightenedReadiness: 'Pikett',
      sunOverride: { sunrise: 420, sunset: 1140 },
    });
    expect(kopie?.days[0]?.internalNote).toBe('Notiz');
    expect(r.plan.weeks.map((x) => x.startDate)).toEqual([
      '2026-09-28',
      '2026-10-05',
      '2026-10-12',
    ]);
  });

  it('[R-5.2-02] Fehlerpfad: unbekannte Woche bei Vorschau, Einfügen und Duplizieren → unknownWeek', () => {
    const p = kpPlan(1);
    fehler(() => insertWeekPreview(p, 'w-weg'), 'unknownWeek', null);
    fehler(() => insertWeek(p, 'w-weg', { shiftFollowing: true }, CTX), 'unknownWeek', null);
    fehler(() => duplicateWeek(p, 'w-weg', { shiftFollowing: true }, CTX), 'unknownWeek', null);
  });
});

describe('F-ABDECKUNG Woche umbenennen und Startdatum (R-4.2-01, R-4.2-02, R-5.2-04)', () => {
  it('[R-4.2-01][R-5.2-04] Bezeichnung und Kurzname getrimmt; leer → Fehler je Feld; Kurzname einer anderen Woche → Fehler', () => {
    const p = kpPlan(2);
    const r = renameWeek(p, wk(p), { label: ' FDT Woche 0 ', shortName: ' Wo0 ' }, CTX);
    expect(r.plan.weeks[0]).toMatchObject({ label: 'FDT Woche 0', shortName: 'Wo0' });
    expect(r.label).toBe('Woche «FDT Woche 0» umbenannt');
    expect(renameWeek(p, wk(p), { label: 'KVK', shortName: 'KVK' }, CTX).plan).toBe(p);
    const l = fehler(
      () => renameWeek(p, wk(p), { label: ' ', shortName: 'X' }, CTX),
      'invalidEntry',
      'label',
    );
    expect(l.userMessage.cause).toBe('Die Bezeichnung der Woche ist leer.');
    const s = fehler(
      () => renameWeek(p, wk(p), { label: 'X', shortName: '' }, CTX),
      'invalidEntry',
      'shortName',
    );
    expect(s.userMessage.cause).toBe('Der Kurzname der Woche ist leer.');
    const d = fehler(
      () => renameWeek(p, wk(p), { label: 'X', shortName: 'Wo1' }, CTX),
      'invalidEntry',
      'shortName',
    );
    expect(d.userMessage.cause).toBe('Den Kurznamen «Wo1» trägt schon eine andere Woche.');
  });

  it('[R-4.2-02] Startdatum: anderer Tag als Montag und ungültiges Datum → Fehler mit eigener Ursache', () => {
    const p = kpPlan(1);
    const c = fehler(() => setWeekStart(p, wk(p), '2026-09-29', CTX), 'invalidDate', 'startDate');
    expect(c.userMessage.cause).toBe('Der 29.09.2026 ist kein Montag. Wochen beginnen am Montag.');
    const u = fehler(() => setWeekStart(p, wk(p), '2026-02-30', CTX), 'invalidDate', 'startDate');
    expect(u.userMessage.cause).toBe('Das Startdatum ist kein gültiges Datum.');
  });

  it('[R-4.2-02] Startdatum verschieben: Einträge der Woche wandern mit, Plan-Bemerkung nicht; gleiches Datum → keine Änderung', () => {
    const { plan, ids } = volleWoche();
    const nur: Plan = { ...plan, weeks: plan.weeks.slice(0, 1) };
    const r = setWeekStart(nur, wk(plan), '2026-10-12', CTX);
    expect(r.label).toBe('Startdatum von «KVK» auf 12.10.2026 gesetzt');
    expect(entryOf(r.plan, ids.block ?? '')).toMatchObject({ date: '2026-10-12' });
    expect(entryOf(r.plan, ids.querInnen ?? '')).toMatchObject({
      fromDate: '2026-10-12',
      toDate: '2026-10-13',
    });
    expect(entryOf(r.plan, ids.zeitraumBem ?? '')).toMatchObject({
      scope: { kind: 'range', fromDate: '2026-10-12', toDate: '2026-10-13' },
    });
    // Querbalken über die Wochengrenze liegt nicht ganz in der Woche: bleibt.
    expect(entryOf(r.plan, ids.querAussen ?? '')).toEqual(entryOf(nur, ids.querAussen ?? ''));
    expect(entryOf(r.plan, ids.planBem ?? '')).toEqual(entryOf(nur, ids.planBem ?? ''));
    expect(setWeekStart(nur, wk(plan), '2026-09-28', CTX).plan).toBe(nur);
  });

  it('[R-4.2-02] Startdatum, das eine andere Woche überdeckt → Fehler; unbekannte Woche → unknownWeek', () => {
    const p = kpPlan(2);
    fehler(() => setWeekStart(p, wk(p), '2026-10-05', CTX), 'invalidDate', 'startDate');
    fehler(() => setWeekStart(p, 'w-weg', '2026-10-05', CTX), 'unknownWeek', null);
  });
});

describe('F-ABDECKUNG Woche löschen und wiederherstellen (R-5.2-05, R-5.2-06; F-17)', () => {
  it('[R-5.2-05][R-5.2-06] Löschen: Einträge ganz in der Woche gehen mit; Wiederherstellen stellt alles identisch her', () => {
    const { plan, ids } = volleWoche();
    const r = deleteWeek(plan, wk(plan), CTX);
    expect(r.label).toBe('Woche «KVK» gelöscht');
    expect(r.plan.weeks.map((w) => w.shortName)).toEqual(['Wo1']);
    const weg = r.plan.deletedWeeks[0]?.entries.map((e) => e.id).sort();
    expect(weg).toEqual(
      [ids.block, ids.beso, ids.querInnen, ids.wocheBem, ids.zeitraumBem].map(String).sort(),
    );
    expect(Object.hasOwn(r.plan.entries, ids.querAussen ?? '')).toBe(true);
    expect(Object.hasOwn(r.plan.entries, ids.planBem ?? '')).toBe(true);
    const back = restoreWeek(r.plan, 0, CTX);
    expect(back.label).toBe('Woche «KVK» wiederhergestellt');
    expect(back.plan.weeks.map((w) => w.id)).toEqual(plan.weeks.map((w) => w.id));
    expect(back.plan.entries).toEqual(plan.entries);
    expect(back.plan.deletedWeeks).toEqual([]);
  });

  it('[R-5.2-05] Fehlerpfade: einzige Woche, unbekannte Woche; Wiederherstellen ohne Eintrag bzw. auf belegte Daten', () => {
    const eine = kpPlan(1);
    const c = fehler(() => deleteWeek(eine, wk(eine), CTX), 'unknownWeek', null);
    expect(c.userMessage.cause).toBe('Das ist die einzige Woche des Plans.');
    fehler(() => deleteWeek(kpPlan(2), 'w-weg', CTX), 'unknownWeek', null);
    fehler(() => restoreWeek(eine, 0, CTX), 'unknownWeek', null);
    const p = kpPlan(2);
    const geloescht = deleteWeek(p, wk(p, 1), CTX).plan;
    const belegt = insertWeek(geloescht, wk(p), { shiftFollowing: false }, CTX).plan;
    const k = fehler(() => restoreWeek(belegt, 0, CTX), 'invalidDate', 'startDate');
    expect(k.userMessage.cause).toBe('Ab 05.10.2026 liegt schon eine Woche des Plans.');
  });
});

describe('F-ABDECKUNG Spaltenkopf je Tag oder Spaltensatz (I2b-A A8)', () => {
  it('[R-4.4-01][R-4.4-09] Satz nur an einem Tag: Änderung im Satz selbst, ohne Kopie; Name getrimmt; Breite', () => {
    const p = kpPlan(1);
    const w = p.weeks[0];
    if (w === undefined) throw new Error('Woche fehlt');
    const set = p.columnSets[2];
    // «Wochenende kompakt» nur am Samstag: Sonntag auf «KVK Mi–Fr».
    const einTag: Plan = {
      ...p,
      weeks: [
        {
          ...w,
          days: w.days.map((d, i) =>
            i === 6 ? { ...d, columnSetId: p.columnSets[1]?.id ?? null } : d,
          ) as unknown as typeof w.days,
        },
      ],
    };
    expect(columnSetUsage(einTag, set?.id ?? '')).toBe(1);
    const kp = set?.columns[0];
    const r = updateDayColumn(
      einTag,
      wk(p),
      'Sa',
      kp?.id ?? '',
      { name: ' Kp neu ', weight: 'wide' },
      'day',
      CTX,
    );
    expect(r.label).toBe('Spalte «Kp neu» umbenannt');
    expect(r.plan.columnSets).toHaveLength(einTag.columnSets.length);
    expect(r.plan.columnSets[2]?.columns[0]).toMatchObject({
      id: kp?.id,
      name: 'Kp neu',
      weight: 'wide',
    });
  });

  it('[R-4.4-09] Satz an mehreren Tagen, Bereich «set»: alle Tage folgen; nur Breite → «geändert»', () => {
    const p = kpPlan(1);
    const set = p.columnSets[0];
    const c0 = set?.columns[0];
    const r = updateDayColumn(p, wk(p), 'Mo', c0?.id ?? '', { weight: 'narrow' }, 'set', CTX);
    expect(r.label).toBe(`Spalte «${c0?.name ?? ''}» geändert`);
    expect(r.plan.columnSets[0]?.columns[0]?.weight).toBe('narrow');
    expect(r.plan.weeks[0]?.days.map((d) => d.columnSetId)).toEqual(
      p.weeks[0]?.days.map((d) => d.columnSetId),
    );
  });

  it('[R-4.4-09][R-5.2-08] Bereich «day» bei geteiltem Satz: Kopie mit neuen IDs nur für den Tag; alle Eintragstypen folgen in die Kopie', () => {
    let p = kpPlan(1);
    const c0 = column(p, 0).id;
    const c1 = column(p, 1).id;
    const put = (r: { plan: Plan; id: Id }) => {
      p = r.plan;
      return r.id;
    };
    const b = put(block(p, 'Ausb', { columns: { kind: 'ids', ids: [c0, c1] } }));
    const alle = put(block(p, 'Alle', { columns: { kind: 'all' } }));
    const m = put(
      add(p, {
        type: 'marker',
        date: MO,
        at: 1350,
        kind: 'ABV',
        columns: { kind: 'ids', ids: [c0] },
      }),
    );
    const rap = put(
      add(p, {
        type: 'rapport',
        date: MO,
        code: 'KR',
        time: { form: 'point', at: 1080 },
        display: 'alsoInColumns',
        displayColumns: { kind: 'ids', ids: [c1] },
      }),
    );
    const rapAlle = put(
      add(p, {
        type: 'rapport',
        date: MO,
        code: 'DR',
        time: { form: 'point', at: 1140 },
        display: 'alsoInColumns',
        displayColumns: { kind: 'all' },
      }),
    );
    const beso = put(
      add(p, {
        type: 'beso',
        date: MO,
        title: [{ text: 'Visite', bold: false }],
        windows: [
          { time: { form: 'point', at: 600 }, columnId: c0 },
          { time: { form: 'point', at: 700 } },
        ],
      }),
    );
    const bem = put(add(p, { type: 'dayRemark', date: MO, text: 'Bem' }));
    const di = put(block(p, 'Dienstag', { date: DI, columns: { kind: 'ids', ids: [c0] } }));
    const r = updateDayColumn(p, wk(p), 'Mo', c0, { name: 'Chef' }, 'day', CTX);
    expect(r.label).toBe('Spalte «Chef» umbenannt (nur Mo 28.09.2026)');
    const copy = r.plan.columnSets.at(-1);
    expect(copy?.name).toBe('KVK Stufen (Mo 28.09.26)');
    expect(r.plan.weeks[0]?.days[0]?.columnSetId).toBe(copy?.id);
    expect(r.plan.weeks[0]?.days[1]?.columnSetId).toBe(p.weeks[0]?.days[1]?.columnSetId);
    const [n0, n1] = copy?.columns ?? [];
    expect(n0?.name).toBe('Chef');
    expect(n0?.id).not.toBe(c0);
    expect(entryOf(r.plan, b)).toMatchObject({ columns: { kind: 'ids', ids: [n0?.id, n1?.id] } });
    expect(entryOf(r.plan, alle)).toMatchObject({ columns: { kind: 'all' } });
    expect(entryOf(r.plan, m)).toMatchObject({ columns: { kind: 'ids', ids: [n0?.id] } });
    expect(entryOf(r.plan, rap)).toMatchObject({ displayColumns: { kind: 'ids', ids: [n1?.id] } });
    expect(entryOf(r.plan, rapAlle)).toMatchObject({ displayColumns: { kind: 'all' } });
    expect((entryOf(r.plan, beso) as Beso).windows.map((w) => w.columnId)).toEqual([n0?.id, null]);
    expect(entryOf(r.plan, bem)).toEqual(entryOf(p, bem));
    expect(entryOf(r.plan, di)).toEqual(entryOf(p, di));
    expect(undo(r)).toEqual(p);
  });

  it('[R-4.4-01] Fehlerpfade: unbekannter Tag, Tag ohne Spaltensatz, leerer Name, unbekannte Spalte', () => {
    const p = kpPlan(1);
    const c0 = column(p, 0).id;
    fehler(() => updateDayColumn(p, 'w-weg', 'Mo', c0, {}, 'day', CTX), 'unknownWeek', null);
    fehler(
      () => updateDayColumn(p, wk(p), 'Xx' as Weekday, c0, {}, 'day', CTX),
      'unknownWeek',
      null,
    );
    const w = p.weeks[0];
    if (w === undefined) throw new Error('Woche fehlt');
    const ohneSatz: Plan = {
      ...p,
      weeks: [
        {
          ...w,
          days: w.days.map((d, i) =>
            i === 0 ? { ...d, columnSetId: null } : d,
          ) as unknown as typeof w.days,
        },
      ],
    };
    const s = fehler(
      () => updateDayColumn(ohneSatz, wk(p), 'Mo', c0, {}, 'day', CTX),
      'unknownColumnSet',
      null,
    );
    expect(s.userMessage.nextStep).toBe('Dem Tag zuerst einen Spaltensatz zuweisen.');
    fehler(
      () => updateDayColumn(p, wk(p), 'Mo', c0, { name: '  ' }, 'day', CTX),
      'invalidColumnSet',
      'name',
    );
    const u = fehler(
      () => updateDayColumn(p, wk(p), 'Mo', 'c-weg', { name: 'X' }, 'day', CTX),
      'unknownColumn',
      'columnId',
    );
    expect(u.userMessage.cause).toBe('Die Spalte ist im Spaltensatz «KVK Stufen» nicht vorhanden.');
  });

  it('[R-5.2-06] Verwendung zählt auch Tage gelöschter Wochen', () => {
    const p = kpPlan(2);
    const set = p.columnSets[0]?.id ?? '';
    const vorher = columnSetUsage(p, set);
    expect(vorher).toBe(4);
    expect(columnSetUsage(deleteWeek(p, wk(p, 1), CTX).plan, set)).toBe(4);
    expect(columnSetUsage(p, 's-weg')).toBe(0);
  });
});
