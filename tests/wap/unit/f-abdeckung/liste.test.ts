// @vitest-environment node
// F-ABDECKUNG (FT-A-01): Zeilen und CSV-Export der Listenansicht je Eintragstyp, Zeitform, Status, Spalten und
// Kategorie nach anhaenge/normalisierung.md Abschnitte 2–7 (Vertrag E1-08 §2; R-6-13, R-6-16, R-6-40). Fiktive Daten.
import { describe, expect, it } from 'vitest';
import { updateEntry } from '../../../../src/model/wap/commands/entries';
import {
  columnsText,
  csvValues,
  LIST_CSV_HEADER,
  type ListRow,
  listCsv,
  listRows,
  statusFromList,
  timeFields,
} from '../../../../src/model/wap/list/index';
import type { Column, Id, Plan } from '../../../../src/model/wap/types';
import { add, block, CTX, column, kpPlan, MO } from '../../support/i5/plan';

const DI = '2026-09-29';
const SO = '2026-10-04';
const MO2 = '2026-10-05';

/** Plan mit Nebenspalte «Det» im Spaltensatz «KVK Stufen» (vor Rap), wie im Kp-WAP. */
function withSecondary(plan: Plan): Plan {
  const [first, ...rest] = plan.columnSets;
  if (first === undefined) throw new Error('Spaltensatz fehlt');
  const det: Column = {
    id: 'c-det',
    name: 'Det',
    kind: 'secondary',
    weight: 'normal',
    labelOrientation: 'horizontal',
    defaultCategoryId: null,
    origin: 'manual',
  };
  const cols = [...first.columns];
  const rapIndex = cols.findIndex((c) => c.kind === 'rap');
  cols.splice(rapIndex, 0, det);
  return { ...plan, columnSets: [{ ...first, columns: cols }, ...rest] };
}

const rowOf = (plan: Plan, id: Id): ListRow => {
  const r = listRows(plan, 'plan').find((x) => x.entryId === id);
  if (r === undefined) throw new Error(`Zeile ${id} fehlt`);
  return r;
};

describe('F-ABDECKUNG Listenansicht: Zeitformen (normalisierung.md 6)', () => {
  it('[R-6-16] Zeitpunkt, von-bis, ab, bis: von/bis 4-stellig, leere Felder leer', () => {
    expect(timeFields({ form: 'point', at: 690 }, MO)).toEqual({
      zeitform: 'Zeitpunkt',
      von: '1130',
      bis: '',
      overMidnight: false,
    });
    expect(timeFields({ form: 'range', from: 540, to: 720 }, MO)).toMatchObject({
      zeitform: 'von-bis',
      von: '0900',
      bis: '1200',
      overMidnight: false,
    });
    expect(timeFields({ form: 'from', from: 1140 }, MO)).toMatchObject({
      zeitform: 'ab',
      von: '1900',
      bis: '',
    });
    expect(timeFields({ form: 'until', to: 720 }, MO)).toMatchObject({
      zeitform: 'bis',
      von: '',
      bis: '1200',
    });
  });

  it('[R-6-16] Frist: bis = Datum dd.mm.yyyy des Eintrags, mit Uhrzeit «dd.mm.yyyy hhmm»', () => {
    expect(timeFields({ form: 'deadline' }, '2026-10-21')).toMatchObject({
      zeitform: 'Frist',
      von: '',
      bis: '21.10.2026',
    });
    expect(timeFields({ form: 'deadline', to: 1020 }, '2026-10-21')).toMatchObject({
      bis: '21.10.2026 1700',
    });
  });

  it('[R-6-16] Grenzwert Mitternacht: Ende 2400 ist nicht «über Mitternacht», 2200–0200 schon', () => {
    expect(timeFields({ form: 'range', from: 1320, to: 1440 }, MO)).toMatchObject({
      bis: '2400',
      overMidnight: false,
    });
    const over = timeFields({ form: 'range', from: 1320, to: 1560 }, MO);
    expect(over.overMidnight).toBe(true);
    expect(over.von).toBe('2200');
  });
});

describe('F-ABDECKUNG Listenansicht: Status (normalisierung.md 5.9)', () => {
  it('[R-6-13] Status der Zeile: bestätigt, geändert, gestrichen, offen', () => {
    let { plan, id } = block(kpPlan(1), 'Ausb A');
    expect(rowOf(plan, id).status).toBe('bestätigt');
    plan = updateEntry(plan, id, 'block', { changed: true }, CTX).plan;
    expect(rowOf(plan, id).status).toBe('geändert');
    plan = updateEntry(plan, id, 'block', { status: 'cancelled' }, CTX).plan;
    expect(rowOf(plan, id).status).toBe('gestrichen');
    plan = updateEntry(plan, id, 'block', { status: 'open', changed: false }, CTX).plan;
    expect(rowOf(plan, id).status).toBe('offen');
  });

  it('[R-6-15] Statuswert aus der Liste → Modell, jede der vier Stufen', () => {
    expect(statusFromList('gestrichen')).toEqual({ status: 'cancelled', changed: false });
    expect(statusFromList('offen')).toEqual({ status: 'open', changed: false });
    expect(statusFromList('geändert')).toEqual({ status: 'confirmed', changed: true });
    expect(statusFromList('bestätigt')).toEqual({ status: 'confirmed', changed: false });
  });
});

describe('F-ABDECKUNG Listenansicht: Spalten (normalisierung.md 7)', () => {
  const base = withSecondary(kpPlan(1));
  const cols = base.columnSets[0]?.columns ?? [];
  const planningIds = cols.filter((c) => c.kind === 'planning').map((c) => c.id);
  const byKind = (k: Column['kind']): Id => cols.find((c) => c.kind === k)?.id ?? '';

  it('[R-6-16] «alle» bleibt «alle»; alle Planungsspalten einzeln gewählt → «alle», mit Nebenspalte «alle|Det»', () => {
    expect(columnsText({ kind: 'all' }, cols)).toBe('alle');
    expect(columnsText({ kind: 'ids', ids: planningIds }, cols)).toBe('alle');
    expect(columnsText({ kind: 'ids', ids: [...planningIds, byKind('secondary')] }, cols)).toBe(
      'alle|Det',
    );
  });

  it('[R-6-16] Teilmenge: Namen von links nach rechts mit «|», ohne Leerzeichen; Rap und Beso kanonisch', () => {
    const [a, b] = planningIds;
    expect(columnsText({ kind: 'ids', ids: [b ?? '', a ?? ''] }, cols)).toBe('Kp Kdt|Stv');
    expect(columnsText({ kind: 'ids', ids: [byKind('rap'), byKind('beso')] }, cols)).toBe(
      'Rap|Beso',
    );
  });

  it('[R-6-16] Grenzfall: Tag ohne Planungsspalten → nie «alle», sondern die gewählten Namen bzw. leer', () => {
    const only = cols.filter((c) => c.kind !== 'planning');
    expect(columnsText({ kind: 'ids', ids: [byKind('secondary')] }, only)).toBe('Det');
    expect(columnsText({ kind: 'ids', ids: [] }, only)).toBe('');
  });

  it('[R-6-16] Spaltenname mit Zeilenumbruch erscheint einzeilig (Abschnitt 4 Punkt 4)', () => {
    const odd = cols.map((c) => (c.id === planningIds[0] ? { ...c, name: 'Kp\nKdt ' } : c));
    expect(columnsText({ kind: 'ids', ids: [planningIds[0] ?? ''] }, odd)).toBe('Kp Kdt');
  });
});

describe('F-ABDECKUNG Listenansicht: Zeilen je Typ (normalisierung.md 5)', () => {
  it('[R-6-13][R-6-16] Block mit offenem Ende: Zeitform «ab», bis leer, Kennzeichen «offenes Ende»', () => {
    const { plan, id } = block(kpPlan(1), 'Fahrschule', { openEnd: true });
    expect(rowOf(plan, id)).toMatchObject({
      typ: 'Block',
      zeitform: 'ab',
      von: '0800',
      bis: '',
      bemerkung: 'offenes Ende',
    });
  });

  it('[R-6-16] Block über Mitternacht: eine Zeile am Starttag mit Kennzeichen «über Mitternacht»', () => {
    const { plan, id } = block(kpPlan(1), 'Nachtübung', {
      time: { form: 'range', from: 1320, to: 1560 },
    });
    expect(rowOf(plan, id)).toMatchObject({
      tag: 'Mo',
      von: '2200',
      bis: '0200',
      bemerkung: 'über Mitternacht',
    });
    expect(listRows(plan, 'plan').filter((r) => r.entryId === id)).toHaveLength(1);
  });

  it('[R-6-16] Kategorie: neutral → «neutral»; zwei Kategorien in Reihenfolge der Legende «A+B»', () => {
    const p = kpPlan(1);
    const neutral = p.legend.find((c) => c.neutral)?.id ?? '';
    const [bat, kp] = p.legend;
    let { plan, id } = block(p, 'Zweifarbig', {
      categoryId: kp?.id ?? '',
      secondCategoryId: bat?.id ?? null,
    });
    expect(rowOf(plan, id).kategorie).toBe('Leitung Bat+Leitung Kp');
    plan = updateEntry(
      plan,
      id,
      'block',
      { categoryId: bat?.id ?? '', secondCategoryId: kp?.id ?? null },
      CTX,
    ).plan;
    expect(rowOf(plan, id).kategorie).toBe('Leitung Bat+Leitung Kp');
    plan = updateEntry(
      plan,
      id,
      'block',
      { categoryId: neutral, secondCategoryId: null },
      CTX,
    ).plan;
    expect(rowOf(plan, id).kategorie).toBe('neutral');
  });

  it('[R-6-16] Kategorie: unbekannte Kategorie-ID ergibt leeres Feld, eine bekannte zweite bleibt stehen', () => {
    const p = kpPlan(1);
    const { plan, id } = block(p, 'Ohne Legende');
    const e = plan.entries[id];
    if (e?.type !== 'block') throw new Error('Block fehlt');
    const kp = p.legend[1]?.id ?? null;
    const broken: Plan = {
      ...plan,
      entries: { ...plan.entries, [id]: { ...e, categoryId: 'k-weg', secondCategoryId: kp } },
    };
    expect(rowOf(broken, id).kategorie).toBe('Leitung Kp');
    const none: Plan = {
      ...plan,
      entries: { ...plan.entries, [id]: { ...e, categoryId: 'k-weg', secondCategoryId: null } },
    };
    expect(rowOf(none, id).kategorie).toBe('');
  });

  it('[R-6-16] Marker: Titel = Art ohne Zeit, Zeitform Zeitpunkt, Kategorie leer; freie Art mit ihrem Namen', () => {
    let p = kpPlan(1);
    const av = add(p, {
      type: 'marker',
      date: MO,
      at: 1350,
      kind: 'ABV',
      columns: { kind: 'all' },
    });
    p = av.plan;
    const frei = add(p, {
      type: 'marker',
      date: MO,
      at: 360,
      kind: 'custom',
      customKind: 'Tagwach',
      columns: { kind: 'all' },
    });
    p = frei.plan;
    expect(rowOf(p, av.id)).toMatchObject({
      typ: 'Marker',
      titel: 'ABV',
      zeitform: 'Zeitpunkt',
      von: '2230',
      bis: '',
      spalten: 'alle',
      kategorie: '',
    });
    expect(rowOf(p, frei.id).titel).toBe('Tagwach');
  });

  it('[R-6-16] Rapport: Rap-Spalte → «Rap»; auch in Spalten → «Rap|‹Spalten›»; nur in Spalten → nur diese', () => {
    let p = kpPlan(1);
    const c0 = column(p, 0).id;
    const nurRap = add(p, {
      type: 'rapport',
      date: MO,
      code: 'KR',
      time: { form: 'point', at: 1080 },
      ort: 'KP (fiktiv)',
    });
    p = nurRap.plan;
    const auch = add(p, {
      type: 'rapport',
      date: MO,
      code: 'DR',
      time: { form: 'range', from: 1200, to: 1260 },
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: [c0] },
    });
    p = auch.plan;
    const nur = add(p, {
      type: 'rapport',
      date: MO,
      code: 'AR1',
      time: { form: 'point', at: 600 },
      display: 'onlyInColumns',
      displayColumns: { kind: 'ids', ids: [c0] },
    });
    p = nur.plan;
    expect(rowOf(p, nurRap.id)).toMatchObject({
      typ: 'Rapport',
      titel: 'KR',
      spalten: 'Rap',
      zeitform: 'Zeitpunkt',
      von: '1800',
      ort: 'KP (fiktiv)',
      kategorie: 'Leitung Kp',
    });
    expect(rowOf(p, auch.id)).toMatchObject({ spalten: 'Rap|Kp Kdt', zeitform: 'von-bis' });
    expect(rowOf(p, nur.id).spalten).toBe('Kp Kdt');
  });

  it('[R-6-16] Rapport «auch in Spalten» ohne passende Spalte am Tag → «Rap»; über Mitternacht gekennzeichnet', () => {
    const p = kpPlan(1);
    const r = add(p, {
      type: 'rapport',
      date: MO,
      code: 'KR',
      time: { form: 'range', from: 1380, to: 1500 },
      display: 'alsoInColumns',
      displayColumns: { kind: 'ids', ids: [column(p, 0).id] },
    });
    const e = r.plan.entries[r.id];
    if (e?.type !== 'rapport') throw new Error('Rapport fehlt');
    const leer: Plan = {
      ...r.plan,
      entries: { ...r.plan.entries, [r.id]: { ...e, displayColumns: { kind: 'ids', ids: [] } } },
    };
    expect(rowOf(leer, r.id)).toMatchObject({ spalten: 'Rap', bemerkung: 'über Mitternacht' });
  });

  it('[R-6-16] Beso: eine Zeile je Zeitfenster mit gleicher Nr, Spalte des Fensters, Zusatz in «Bemerkung»', () => {
    const p = kpPlan(1);
    const c0 = column(p, 0);
    const r = add(p, {
      type: 'beso',
      date: MO,
      title: [{ text: 'Besuch Werkhof', bold: false }],
      ltg: 'Four',
      ort: 'Halle 2',
      windows: [
        { time: { form: 'point', at: 600 }, supplement: 'Teil 1' },
        { time: { form: 'range', from: 840, to: 900 }, columnId: c0.id },
        { time: { form: 'range', from: 1410, to: 1470 }, supplement: '  ' },
      ],
    });
    const zeilen = listRows(r.plan, 'plan').filter((x) => x.entryId === r.id);
    expect(zeilen.map((z) => [z.von, z.spalten, z.nr, z.bemerkung])).toEqual([
      ['1000', 'Beso', '10', 'Zusatz: Teil 1'],
      ['1400', 'Kp Kdt', '10', ''],
      ['2330', 'Beso', '10', 'über Mitternacht'],
    ]);
    expect(zeilen.every((z) => z.titel === 'Besuch Werkhof' && z.ltg === 'Four')).toBe(true);
    expect(new Set(zeilen.map((z) => z.windowId)).size).toBe(3);
  });

  it('[R-6-16] Beso ohne Nummer (Nummernkreis voll) → Nr leer; Fenster in fremder Spalte → «Beso»', () => {
    const p = kpPlan(1);
    const r = add(p, {
      type: 'beso',
      date: MO,
      title: [{ text: 'Visite', bold: false }],
      windows: [{ time: { form: 'point', at: 600 }, columnId: column(p, 0).id }],
    });
    const e = r.plan.entries[r.id];
    if (e?.type !== 'beso') throw new Error('Beso fehlt');
    const ohneNr: Plan = {
      ...r.plan,
      entries: {
        ...r.plan.entries,
        [r.id]: {
          ...e,
          besoNumber: null,
          windows: e.windows.map((w) => ({ ...w, columnId: 'c-fremd' })),
        },
      },
    };
    expect(rowOf(ohneNr, r.id)).toMatchObject({ nr: '', spalten: 'Beso' });
  });

  it('[R-6-16] Ganztägige Bemerkung: Typ TagBemerkung, Zeitform «ganztags», übrige Felder leer', () => {
    const r = add(kpPlan(1), { type: 'dayRemark', date: DI, text: 'Retablierung\nganzer Tag' });
    expect(rowOf(r.plan, r.id)).toMatchObject({
      tag: 'Di',
      typ: 'TagBemerkung',
      titel: 'Retablierung ganzer Tag',
      zeitform: 'ganztags',
      von: '',
      bis: '',
      spalten: '',
      kategorie: '',
      nr: '',
    });
  });

  it('[R-6-16][R-4.6-10] Querbalken über die Wochengrenze: je Woche eine Zeile, Tag = erster Tag der Woche, gleiches von/bis', () => {
    const p = kpPlan(2);
    const r = add(p, {
      type: 'querbalken',
      title: [{ text: 'Messe fiktiv', bold: false }],
      fromDate: '2026-10-01',
      toDate: '2026-10-07',
      columns: { kind: 'all' },
    });
    const zeilen = listRows(r.plan, 'plan').filter((x) => x.entryId === r.id);
    expect(zeilen.map((z) => [z.woche, z.tag, z.zeitform, z.von, z.bis, z.spalten])).toEqual([
      ['KVK', 'Do', 'Datum', '01.10.2026', '07.10.2026', 'alle'],
      ['Wo1', 'Mo', 'Datum', '01.10.2026', '07.10.2026', 'alle'],
    ]);
    // Nur die gewählte Woche: genau eine Zeile.
    const wo1 = r.plan.weeks[1]?.id ?? '';
    expect(listRows(r.plan, { weekId: wo1 }).filter((x) => x.entryId === r.id)).toHaveLength(1);
  });

  it('[R-6-16] Mehrtägige Bemerkung: Tag leer, Nr wie gedruckt; mit Zeitraum Zeitform «Datum», sonst leer', () => {
    let p = kpPlan(1);
    const plan = add(p, {
      type: 'multiDayRemark',
      text: 'Gilt durchgehend',
      scope: { kind: 'plan' },
    });
    p = plan.plan;
    const range = add(p, {
      type: 'multiDayRemark',
      text: 'Wache\tverstärkt',
      scope: { kind: 'range', fromDate: DI, toDate: '2026-10-01' },
    });
    p = range.plan;
    const a = rowOf(p, plan.id);
    const b = rowOf(p, range.id);
    expect(a).toMatchObject({ tag: '', typ: 'MehrtagBemerkung', zeitform: '', von: '', bis: '' });
    expect(b).toMatchObject({
      tag: '',
      titel: 'Wache verstärkt',
      zeitform: 'Datum',
      von: '29.09.2026',
      bis: '01.10.2026',
    });
    const e = p.entries[plan.id];
    if (e?.type !== 'multiDayRemark') throw new Error('Bemerkung fehlt');
    const mitNummer = (number: number | null): Plan => ({
      ...p,
      entries: { ...p.entries, [plan.id]: { ...e, number } },
    });
    expect(rowOf(mitNummer(null), plan.id).nr).toBe('');
    expect(rowOf(mitNummer(7), plan.id).nr).toBe('7');
  });

  it('[R-6-13] Einträge ausserhalb der gewählten Woche erscheinen nicht; Sonntag liegt noch in der Woche', () => {
    let p = kpPlan(2);
    const so = add(p, { type: 'dayRemark', date: SO, text: 'Sonntag' });
    p = so.plan;
    const mo2 = add(p, { type: 'dayRemark', date: MO2, text: 'Montag Wo1' });
    p = mo2.plan;
    const kvk = p.weeks[0]?.id ?? '';
    const ids = listRows(p, { weekId: kvk }).map((r) => r.entryId);
    expect(ids).toContain(so.id);
    expect(ids).not.toContain(mo2.id);
    expect(listRows(p, { weekId: 'w-unbekannt' })).toEqual([]);
  });
});

describe('F-ABDECKUNG Listenansicht: Reihenfolge (normalisierung.md 2)', () => {
  it('[R-6-13] Woche → Tag → Typ (Querbalken, Marker, Block, Rapport, Beso, TagBemerkung, MehrtagBemerkung) → von → Spalten → Nr', () => {
    let p = kpPlan(1);
    const c0 = column(p, 0).id;
    const c1 = column(p, 1).id;
    const steps: Array<(x: Plan) => { plan: Plan; id: Id }> = [
      (x) => add(x, { type: 'multiDayRemark', text: 'M', scope: { kind: 'plan' } }),
      (x) => add(x, { type: 'dayRemark', date: MO, text: 'T' }),
      (x) => block(x, 'B2 Stv 0800', { columns: { kind: 'ids', ids: [c1] } }),
      (x) => block(x, 'B1 Kdt 0800', { columns: { kind: 'ids', ids: [c0] } }),
      (x) => block(x, 'B0 0700', { time: { form: 'range', from: 420, to: 480 } }),
      (x) => block(x, 'Di', { date: DI }),
      (x) =>
        add(x, {
          type: 'rapport',
          date: MO,
          code: 'KR',
          time: { form: 'point', at: 300 },
        }),
      (x) =>
        add(x, {
          type: 'beso',
          date: MO,
          title: [{ text: 'Beso', bold: false }],
          windows: [{ time: { form: 'point', at: 300 } }],
        }),
      (x) => add(x, { type: 'marker', date: MO, at: 1350, kind: 'ABV', columns: { kind: 'all' } }),
      (x) =>
        add(x, {
          type: 'querbalken',
          title: [{ text: 'Q', bold: false }],
          fromDate: MO,
          toDate: DI,
          columns: { kind: 'all' },
        }),
    ];
    for (const s of steps) p = s(p).plan;
    const rows = listRows(p, 'plan');
    expect(rows.map((r) => `${r.tag}:${r.typ}:${r.titel}`)).toEqual([
      'Mo:Querbalken:Q',
      'Mo:Marker:ABV',
      'Mo:Block:B0 0700',
      'Mo:Block:B1 Kdt 0800',
      'Mo:Block:B2 Stv 0800',
      'Mo:Rapport:KR',
      'Mo:Beso:Beso',
      'Mo:TagBemerkung:T',
      'Di:Block:Di',
      ':MehrtagBemerkung:M',
    ]);
  });

  it('[R-6-13] Gleicher Schlüssel: Beso nach Nr, sonst Erfassungsreihenfolge bleibt erhalten', () => {
    let p = kpPlan(1);
    const ids: Id[] = [];
    for (const t of ['Erst', 'Zweit']) {
      const r = add(p, {
        type: 'beso',
        date: MO,
        title: [{ text: t, bold: false }],
        windows: [{ time: { form: 'point', at: 600 } }],
      });
      p = r.plan;
      ids.push(r.id);
    }
    const rows = listRows(p, 'plan').filter((r) => r.typ === 'Beso');
    expect(rows.map((r) => r.nr)).toEqual(['10', '11']);
    expect(rows.map((r) => r.entryId)).toEqual(ids);
  });
});

describe('F-ABDECKUNG Listen-Export CSV (normalisierung.md 2)', () => {
  it('[R-6-16] Kopfzeile exakt, jede Zeile 14 Felder in Reihenfolge der Kopfzeile, abschliessendes LF', () => {
    const { plan } = block(kpPlan(1), 'Ausb Mö');
    const csv = listCsv(plan, 'plan');
    const lines = csv.split('\n');
    expect(lines[0]).toBe(
      'Woche;Tag;Typ;Titel;Zeitform;von;bis;Spalten;Kategorie;Ltg;Ort;Nr;Status;Bemerkung',
    );
    expect(LIST_CSV_HEADER).toBe(lines[0]);
    expect(lines[1]).toBe('KVK;Mo;Block;Ausb Mö;von-bis;0800;1000;Kp Kdt;Leitung Kp;;;;bestätigt;');
    expect(lines[2]).toBe('');
    expect(lines).toHaveLength(3);
    const row = listRows(plan, 'plan')[0];
    if (row === undefined) throw new Error('Zeile fehlt');
    expect(csvValues(row)).toHaveLength(14);
  });

  it('[R-6-16] Leerer Plan: nur die Kopfzeile', () => {
    expect(listCsv(kpPlan(1), 'plan')).toBe(`${LIST_CSV_HEADER}\n`);
  });

  it('[R-6-16] RFC 4180: «;» und «"» gequotet, «"» verdoppelt; Zeilenumbruch im Titel wird zu einem Leerzeichen', () => {
    const { plan } = block(kpPlan(1), 'Teil "A"; Teil\r\nB');
    const line = listCsv(plan, 'plan').split('\n')[1] ?? '';
    expect(line).toContain(';"Teil ""A""; Teil B";');
    expect(listCsv(plan, 'plan').includes('\r')).toBe(false);
  });

  it('[R-6-40] Interne Notiz des Eintrags und des Tages erscheint weder in den Zeilen noch im CSV', () => {
    let { plan, id } = block(kpPlan(1), 'Ausb');
    plan = updateEntry(plan, id, 'block', { internalNote: 'Kennwort-Fiktiv-77' }, CTX).plan;
    const week = plan.weeks[0];
    if (week === undefined) throw new Error('Woche fehlt');
    const days = week.days.map((d, i) => (i === 0 ? { ...d, internalNote: 'Kennwort-Tag-88' } : d));
    plan = {
      ...plan,
      weeks: [{ ...week, days: days as unknown as typeof week.days }, ...plan.weeks.slice(1)],
    };
    const csv = listCsv(plan, 'plan');
    expect(csv).not.toContain('Kennwort-Fiktiv-77');
    expect(csv).not.toContain('Kennwort-Tag-88');
    expect(JSON.stringify(listRows(plan, 'plan'))).not.toContain('Kennwort');
  });
});
