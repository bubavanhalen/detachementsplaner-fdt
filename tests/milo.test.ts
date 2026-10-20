import { describe, expect, it } from 'vitest';
import {
  compareImport,
  dateRange,
  guessListMapping,
  guessMapping,
  importMiloList,
  importRows,
} from '../src/io/import';
import {
  createDetachment,
  createProject,
  normalizeProject,
  syncWachePendenzen,
  updatePendenz,
} from '../src/model';
import { parseListDate } from '../src/model/dates';
import {
  dienstvollender,
  eingerueckt,
  fahrerliste,
  geburtstage,
  nzlInfo,
  verfuegbarkeit,
  wacheNachfuehrung,
  zuteilungskonflikte,
} from '../src/model/milo';
import { matchPerson } from '../src/model/personMatch';
import { personRefs, replacePersonId } from '../src/model/personRefs';
import type { Person, Project } from '../src/model/types';

// Wholly fictional people and lists; no real MILO data.

function person(id: string, patch: Partial<Person> = {}): Person {
  return {
    id,
    name: `Fiktiv ${id}`,
    grad: 'Sdt',
    funktion: 'Fiktiv',
    lics: [],
    raw: {},
    planning: { status: 'included', reason: '' },
    ...patch,
  };
}
function service(): Project {
  const project = createProject();
  project.service = { start: '2026-11-02', end: '2026-11-20', year: '2026', note: '' };
  return project;
}

describe('dates in lists', () => {
  it('reads Swiss, ISO and spreadsheet default dates and rejects others', () => {
    expect(parseListDate('24.03.1999')).toBe('1999-03-24');
    expect(parseListDate('4.3.1999')).toBe('1999-03-04');
    expect(parseListDate('1999-03-24')).toBe('1999-03-24');
    expect(parseListDate('3/24/99')).toBe('1999-03-24');
    expect(parseListDate('31.02.2000')).toBe('');
    expect(parseListDate('Fiktiv')).toBe('');
    expect(dateRange('03.11.2026 – 05.11.2026', '')).toEqual({
      von: '2026-11-03',
      bis: '2026-11-05',
    });
    expect(dateRange('03.11.2026', '')).toEqual({ von: '2026-11-03', bis: '2026-11-03' });
  });
});

describe('NZL and Dienstvollender', () => {
  it('counts down from the MILO list and marks the first day without duty', () => {
    const project = service();
    const p = person('a', { dt: '5', dtStand: '2026-11-02' });
    project.persons = [p];
    const info = nzlInfo(project, p, '2026-11-04');
    expect(info).toMatchObject({
      milo: 5,
      heute: 3,
      veraltetTage: 2,
      letzterDiensttag: '2026-11-06',
      dienstvollendAb: '2026-11-07',
    });
    expect(verfuegbarkeit(project, p, '2026-11-06').status).toBe('verfuegbar');
    expect(verfuegbarkeit(project, p, '2026-11-07').status).toBe('dienstvollend');
    expect(dienstvollender(project, '2026-11-04').map((entry) => entry.person.id)).toEqual(['a']);
  });
  it('a list from before the service counts from the first service day', () => {
    const project = service();
    const p = person('a', { dt: '3', dtStand: '2026-10-20' });
    expect(nzlInfo(project, p, '2026-10-25')).toMatchObject({
      heute: 3,
      veraltetTage: 0,
      dienstvollendAb: '2026-11-05',
    });
  });
  it('people serving to the end are not Dienstvollender; a fresh list is not out of date', () => {
    const project = service();
    const p = person('a', { dt: '40', dtStand: '2026-11-10' });
    expect(nzlInfo(project, p, '2026-11-10')).toMatchObject({
      veraltetTage: 0,
      dienstvollendAb: '',
    });
    expect(nzlInfo(project, person('b', { dt: 'offen' }), '2026-11-10')).toBeNull();
  });
});

describe('availability', () => {
  it('combines roster status, leave and commands in one rule', () => {
    const project = service();
    const a = person('a', { miloStatus: 'Eingerückt', lics: ['B'] }),
      b = person('b', { miloStatus: 'Nicht eingerückt', lics: ['C'] }),
      c = person('c', { miloStatus: 'Eingerückt', lics: ['B'] }),
      d = person('d', { miloStatus: 'Eingerückt', lics: ['B'] });
    project.persons = [a, b, c, d];
    project.milo = {
      stand: '2026-11-03',
      listen: {},
      absences: [{ id: 'u1', personId: 'c', art: 'Urlaub', von: '2026-11-05', bis: '2026-11-06' }],
      commands: [{ id: 'k1', personId: 'd', text: 'Wache', von: '2026-11-05', bis: '2026-11-05' }],
      statusEingerueckt: {},
    };
    expect(eingerueckt(project, a)).toBe(true);
    expect(eingerueckt(project, b)).toBe(false);
    expect(verfuegbarkeit(project, c, '2026-11-05').status).toBe('urlaub');
    expect(verfuegbarkeit(project, c, '2026-11-07').status).toBe('verfuegbar');
    expect(verfuegbarkeit(project, d, '2026-11-05').status).toBe('kommandiert');
    const drivers = fahrerliste(project, '2026-11-05');
    expect(drivers.verfuegbar.map((entry) => entry.person.id)).toEqual(['a']);
    expect(drivers.nichtVerfuegbar.map((entry) => entry.verfuegbarkeit.status)).toEqual([
      'nicht-eingerueckt',
      'urlaub',
      'kommandiert',
    ]);
    // The user's classification of a status text wins over the suggestion.
    project.milo.statusEingerueckt = { 'nicht eingerückt': true };
    expect(eingerueckt(project, b)).toBe(true);
  });
  it('reports assigned people who are away during their detachement', () => {
    const project = service();
    project.persons = [person('a')];
    const det = createDetachment({
      id: 'det',
      name: 'Fiktiv',
      datum: '2026-11-04',
      bisDatum: '2026-11-06',
    });
    project.dets = [det];
    project.assign = { det: ['a'] };
    project.milo = {
      stand: '',
      listen: {},
      absences: [{ id: 'u1', personId: 'a', art: 'Urlaub', von: '2026-11-06', bis: '2026-11-06' }],
      commands: [],
      statusEingerueckt: {},
    };
    expect(zuteilungskonflikte(project, '2026-11-01')).toMatchObject([
      { tag: '2026-11-06', verfuegbarkeit: { status: 'urlaub' } },
    ]);
  });
});

describe('standard lists', () => {
  it('lists birthdays in the service with the age reached', () => {
    const project = service();
    project.persons = [
      person('a', { geburtsdatum: '2000-11-10' }),
      person('b', { geburtsdatum: '2001-12-24' }),
      person('c', { geburtsdatum: '2004-02-29' }),
    ];
    expect(
      geburtstage(project, '2026-11-02', '2026-11-20').map((entry) => [
        entry.person.id,
        entry.alter,
      ]),
    ).toEqual([['a', 26]]);
    expect(geburtstage(project, '2026-02-01', '2026-03-01')[0]).toMatchObject({
      datum: '2026-02-28',
      alter: 22,
    });
  });
  it('derives guard commands to enter in MILO and checks them against the MILO list', () => {
    const project = service();
    project.persons = [person('a'), person('b'), person('c')];
    const det = createDetachment({
      id: 'wache',
      name: 'Wache',
      datum: '2026-11-09',
      bisDatum: '2026-11-11',
      miloKommandierung: true,
    });
    project.dets = [det, createDetachment({ id: 'other', name: 'Fiktiv' })];
    project.assign = { wache: ['a', 'b'], other: ['c'] };
    project.milo = {
      stand: '',
      listen: {},
      absences: [],
      commands: [
        { id: 'k1', personId: 'a', text: 'Wache', von: '2026-11-09', bis: '2026-11-11' },
        { id: 'k2', personId: 'c', text: 'Wache', von: '2026-11-15', bis: '2026-11-15' },
      ],
      statusEingerueckt: {},
    };
    expect(wacheNachfuehrung(project).map((item) => [item.ref, item.status])).toEqual([
      ['wache:wache:a', 'in-milo'],
      ['wache:wache:b', 'offen'],
      ['milo:k2', 'nur-in-milo'],
    ]);
  });
});

describe('MILO import', () => {
  const header = ['Name', 'AHV', 'Grad', 'NZL', 'Geburtsdatum', 'Status'];
  function project(): Project {
    const value = createProject();
    value.persons = [
      person('p1', { name: 'Alex Muster', pnr: 'TEST-001', grad: 'Wm', milo: true, pisa: true }),
      person('p2', { name: 'Kim Beispiel', pnr: 'TEST-002', milo: true }),
    ];
    return value;
  }
  it('guesses the new roster columns without disturbing the known ones', () => {
    expect(guessMapping(header)).toMatchObject({
      name: 0,
      pnr: 1,
      grad: 2,
      dt: 3,
      geburtsdatum: 4,
      miloStatus: 5,
    });
    expect(guessListMapping(['Name', 'Versicherten-Nr.', 'Von', 'Bis', 'Art'])).toEqual({
      name: 0,
      pnr: 1,
      von: 2,
      bis: 3,
      art: 4,
    });
  });
  it('MILO leads NZL, birth date and status; PISA keeps the rank; missing people are only marked', () => {
    const before = project(),
      after = structuredClone(before);
    const result = importRows(
      after,
      'milo',
      [header, ['Muster, Alex', 'TEST.001', 'Kpl', '12', '01.02.2003', 'Eingerückt']],
      0,
      guessMapping(header),
      'fiktiv-milo.xlsx',
      false,
      { stand: '2026-11-03' },
    );
    const alex = after.persons[0];
    expect(alex).toMatchObject({
      grad: 'Wm',
      dt: '12',
      dtStand: '2026-11-03',
      geburtsdatum: '2003-02-01',
      miloStatus: 'Eingerückt',
    });
    expect(result.abweichungen).toEqual([
      { personId: 'p1', feld: 'grad', wert: 'Wm', liste: 'Kpl' },
    ]);
    expect(result.nichtMehr).toEqual(['p2']);
    expect(after.persons).toHaveLength(2);
    expect(after.persons[1].nichtInMilo).toBe('2026-11-03');
    expect(after.milo?.stand).toBe('2026-11-03');
    const comparison = compareImport(before, after);
    expect(comparison.nichtMehr).toEqual(['p2']);
    expect(comparison.geaendert.map((change) => change.feld)).toEqual(
      expect.arrayContaining(['dt', 'geburtsdatum', 'miloStatus']),
    );
  });
  it('replaces the leave list and never creates people from it', () => {
    const value = project();
    const rows = [
      ['Name', 'AHV', 'Von', 'Bis', 'Art'],
      ['Muster, Alex', 'TEST-001', '05.11.2026', '06.11.2026', 'Urlaub'],
      ['Unbekannt, Fiktiv', 'TEST-999', '05.11.2026', '', 'Urlaub'],
      ['Beispiel, Kim', 'TEST-002', 'offen', '', 'Urlaub'],
    ];
    const result = importMiloList(
      value,
      'urlaub',
      rows,
      0,
      guessListMapping(rows[0]),
      'fiktiv.xlsx',
    );
    expect(result).toEqual({ count: 1, ohnePerson: ['Fiktiv Unbekannt'], ohneDatum: 1 });
    expect(value.persons).toHaveLength(2);
    expect(value.milo?.absences).toMatchObject([
      { personId: 'p1', von: '2026-11-05', bis: '2026-11-06' },
    ]);
    importMiloList(value, 'urlaub', [rows[0]], 0, guessListMapping(rows[0]), 'fiktiv.xlsx');
    expect(value.milo?.absences).toEqual([]);
  });
  it('round-trips through the project format and drops broken MILO parts', () => {
    const value = project();
    value.persons[0].geburtsdatum = '2003-02-01';
    value.dets = [createDetachment({ id: 'wache', miloKommandierung: true })];
    value.assign = { wache: [] };
    value.milo = {
      stand: '2026-11-03',
      listen: { urlaub: { datei: 'fiktiv.xlsx', zeit: '2026-11-03T08:00:00Z', anz: 1 } },
      absences: [
        { id: 'u1', personId: 'p1', art: 'Urlaub', von: '2026-11-05', bis: '2026-11-06' },
        { id: '', personId: 'p1', art: 'kaputt', von: 'x', bis: '' } as never,
      ],
      commands: [],
      statusEingerueckt: { eingerückt: true, kaputt: 'ja' as never },
    };
    const loaded = normalizeProject(JSON.parse(JSON.stringify(value)));
    expect(loaded.persons[0].geburtsdatum).toBe('2003-02-01');
    expect(loaded.dets[0].miloKommandierung).toBe(true);
    expect(loaded.milo?.absences).toHaveLength(1);
    expect(loaded.milo?.statusEingerueckt).toEqual({ eingerückt: true });
    expect(
      normalizeProject({ ...JSON.parse(JSON.stringify(value)), milo: 'kaputt' }).milo,
    ).toBeUndefined();
  });
});

describe('shared person rules', () => {
  it('a unique number joins, different numbers never join over names, names need review', () => {
    const people = [
      person('a', { name: 'Alex Muster', pnr: 'TEST-001' }),
      person('b', { name: 'Kim Beispiel' }),
    ];
    expect(matchPerson(people, { name: 'Wer auch immer', pnr: 'test.001' }, false).person?.id).toBe(
      'a',
    );
    expect(
      matchPerson(people, { name: 'Alex Muster', pnr: 'TEST-777' }, true).person,
    ).toBeUndefined();
    expect(matchPerson(people, { name: 'Kim Beispiel' }, false).person).toBeUndefined();
    expect(matchPerson(people, { name: 'Kim Beispiel' }, true)).toMatchObject({
      person: { id: 'b' },
      review: expect.any(String),
    });
  });
  it('finds and replaces every reference to a person', () => {
    const project = service();
    project.persons = [person('old'), person('new')];
    project.dets = [createDetachment({ id: 'det', name: 'Fiktiv' })];
    project.assign = { det: ['old', 'new'] };
    project.subDets = [
      { id: 's', parentId: 'det', name: 'Det Mat', chefId: 'old', auftrag: '', personIds: ['old'] },
    ];
    project.stamm.kader = [
      { rolle: 'kdt', personId: 'old', grad: '', vorname: '', name: '', funktion: '' },
    ];
    project.milo = {
      stand: '',
      listen: {},
      absences: [{ id: 'u', personId: 'old', art: '', von: '2026-11-05', bis: '2026-11-05' }],
      commands: [{ id: 'k', personId: 'old', text: '', von: '2026-11-05', bis: '2026-11-05' }],
      statusEingerueckt: {},
    };
    (project as Record<string, unknown>).pendenzen = [{ id: 'x', personIds: ['old'] }];
    expect(personRefs(project, 'old')).toHaveLength(7);
    expect(replacePersonId(project, 'old', 'new')).toBe(7);
    expect(personRefs(project, 'old')).toEqual([]);
    expect(project.assign.det).toEqual(['new']);
    expect(project.subDets[0]).toMatchObject({ chefId: 'new', personIds: ['new'] });
  });
});

describe('guard commands as Pendenzen', () => {
  function guard(): Project {
    const project = service();
    project.persons = [person('a'), person('b')];
    project.dets = [
      createDetachment({
        id: 'wache',
        name: 'Wache',
        datum: '2026-11-09',
        bisDatum: '2026-11-10',
        miloKommandierung: true,
      }),
    ];
    project.assign = { wache: ['a', 'b'] };
    project.milo = {
      stand: '',
      listen: {},
      absences: [],
      commands: [],
      statusEingerueckt: {},
    };
    return project;
  }
  const wache = (project: Project) =>
    (project.pendenzen ?? []).map((item) => [item.personIds[0], item.status]);

  it('creates one Pendenz per person, idempotently, and closes it once MILO lists it', () => {
    const project = guard();
    expect(syncWachePendenzen(project, '2026-11-03T08:00:00.000Z')).toMatchObject({ neu: 2 });
    expect(syncWachePendenzen(project, '2026-11-03T08:05:00.000Z')).toEqual({
      neu: 0,
      geaendert: 0,
      vorschlaege: 0,
    });
    expect(wache(project)).toEqual([
      ['a', 'offen'],
      ['b', 'offen'],
    ]);
    expect(project.pendenzen?.[0]).toMatchObject({
      faellig: '2026-11-09',
      detIds: ['wache'],
      quellen: [{ kanal: 'milo', ref: 'wache:wache:a' }],
    });
    project.milo?.commands.push({
      id: 'k',
      personId: 'a',
      text: 'Wache',
      von: '2026-11-09',
      bis: '2026-11-10',
    });
    syncWachePendenzen(project, '2026-11-04T08:00:00.000Z');
    expect(wache(project)).toEqual([
      ['a', 'erledigt'],
      ['b', 'offen'],
    ]);
  });
  it('reopens a ticked Pendenz only when a newer MILO list still lacks it', () => {
    const project = guard();
    syncWachePendenzen(project, '2026-11-03T08:00:00.000Z');
    const b = project.pendenzen?.[1];
    if (!b) throw new Error('missing');
    updatePendenz(project, b.id, { status: 'erledigt' }, { now: '2026-11-03T09:00:00.000Z' });
    syncWachePendenzen(project, '2026-11-03T09:05:00.000Z');
    expect(wache(project)[1]).toEqual(['b', 'erledigt']);
    if (project.milo)
      project.milo.listen.kommandierung = {
        datei: 'fiktiv.xlsx',
        zeit: '2026-11-04T07:00:00.000Z',
        anz: 0,
      };
    syncWachePendenzen(project, '2026-11-04T07:01:00.000Z');
    expect(wache(project)[1]).toEqual(['b', 'offen']);
    expect(project.pendenzen?.[1].verlauf.at(-1)?.text).toContain('nicht gefunden');
  });
  it('discards Pendenzen of removed assignments and never overrides the user', () => {
    const project = guard();
    syncWachePendenzen(project, '2026-11-03T08:00:00.000Z');
    const a = project.pendenzen?.[0];
    if (!a) throw new Error('missing');
    updatePendenz(project, a.id, { status: 'wartet' }, { now: '2026-11-03T09:00:00.000Z' });
    project.assign.wache = [];
    const result = syncWachePendenzen(project, '2026-11-03T10:00:00.000Z');
    expect(wache(project)).toEqual([
      ['a', 'wartet'],
      ['b', 'verworfen'],
    ]);
    expect(result.vorschlaege).toBe(1);
    expect(project.pendenzen?.[0].vorschlag?.felder.status).toBe('verworfen');
  });
});
