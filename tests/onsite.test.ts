// Wholly fictional people and detachements only.
import { describe, expect, it } from 'vitest';
import {
  bestand,
  buildDetSheet,
  DEFAULT_DET_SHEET_OPTIONS,
  detSheetText,
  detSheetWorkbook,
} from '../src/io/detSheet';
import { XLSX } from '../src/io/workbook';
import {
  addSubDets,
  archiveSnapshot,
  copyEvent,
  createEvent,
  derivePisa,
  entrySignature,
  eventsForDet,
  licenseCategories,
  moveToSubDet,
  normalizeProject,
  onsiteEvents,
  onsiteSummary,
  onsiteView,
  parseSubDetNames,
  projectSignature,
  rankCategory,
  removeDetFromOnsite,
  removeEvent,
  removeSubDet,
  renameSubDet,
  setEventNote,
  setSubDetAuftrag,
  setSubDetChef,
  shortFunction,
  shortLicense,
  sortByRank,
  subDetSuggestions,
  subDetsOf,
  updateEvent,
  validateProject,
} from '../src/model';
import type { Person, Project } from '../src/model/types';
import { onsiteFixture, person, withSecondKvk } from './onsite-fixtures';

const ids = (people: Person[]) => people.map((item) => item.id);
function kvkEvent(project: Project, detIds = ['kvk'], name = 'KVK') {
  return createEvent(project, { name, von: '2027-04-26', bis: '2027-04-30', detIds });
}

describe('on-site events', () => {
  it('creates, checks and orders events; the PISA filter keeps board order', () => {
    const project = withSecondKvk(onsiteFixture());
    const event = createEvent(project, {
      name: '  KVK   gesamt ',
      von: '2027-04-26',
      bis: '2027-04-30',
      detIds: ['kvk-ost', 'kvk'],
    });
    expect(event.name).toBe('KVK gesamt');
    expect(event.detIds).toEqual(['kvk', 'kvk-ost']);
    const fields = { name: 'X', von: '', bis: '', detIds: [] };
    expect(() => createEvent(project, { ...fields, name: ' ' })).toThrow('Namen');
    expect(() => createEvent(project, { ...fields, von: '2027-02-30' })).toThrow('ungültig');
    expect(() => createEvent(project, { ...fields, von: '2027-05-02', bis: '2027-05-01' })).toThrow(
      'endet vor',
    );
    expect(() => createEvent(project, { ...fields, detIds: ['missing'] })).toThrow(
      'existiert nicht mehr',
    );
    const earlier = createEvent(project, { ...fields, name: 'Rekognoszierung', von: '2027-04-20' });
    const undated = createEvent(project, { ...fields, name: 'Abgabe' });
    expect(onsiteEvents(project).map((item) => item.id)).toEqual([
      earlier.id,
      event.id,
      undated.id,
    ]);
    updateEvent(project, event.id, { name: 'KVK', bis: '2027-05-01', detIds: ['kvk-ost'] });
    expect(event).toMatchObject({ name: 'KVK', bis: '2027-05-01', detIds: ['kvk-ost'] });
    expect(() => updateEvent(project, event.id, { bis: '2027-04-01' })).toThrow('endet vor');
    expect(eventsForDet(project, 'kvk-ost').map((item) => item.id)).toEqual([event.id]);
  });

  it('offers the people of the filtered PISA detachements, yet anyone can be placed', () => {
    const project = withSecondKvk(onsiteFixture());
    const event = kvkEvent(project, ['kvk', 'kvk-ost']);
    let view = onsiteView(project, event.id);
    expect(ids(view.candidates).sort()).toEqual(
      ['p-lt', 'p-wm', 'p-sdt1', 'p-sdt2', 'p-four', 'p-ost1', 'p-ost2'].sort(),
    );
    // Highest grade first.
    expect(ids(view.pool)).toEqual([
      'p-lt',
      'p-four',
      'p-wm',
      'p-ost1',
      'p-sdt2',
      'p-sdt1',
      'p-ost2',
    ]);
    const [mat] = addSubDets(project, event.id, ['Det Mat']);
    moveToSubDet(project, event.id, mat.id, ['p-main']);
    view = onsiteView(project, event.id);
    expect(ids(view.groups[0].people)).toEqual(['p-main']);
    expect(ids(view.pool)).toContain('p-main');
    expect(ids(view.unassigned)).not.toContain('p-main');
    expect(view.origin.get('p-sdt1')?.id).toBe('kvk');
    expect(view.origin.get('p-ost1')?.id).toBe('kvk-ost');
    expect(view.origin.get('p-main')?.id).toBe('wk');
    // Without a filter everyone except excluded people is offered.
    const four = project.persons.find((item) => item.id === 'p-four');
    if (four) four.planning = { status: 'excluded', reason: 'Fiktiv' };
    const all = createEvent(project, { name: 'Alle', von: '', bis: '', detIds: [] });
    expect(ids(onsiteView(project, all.id).candidates)).not.toContain('p-four');
    expect(onsiteView(project, all.id).candidates).toHaveLength(7);
    expect(() => moveToSubDet(project, event.id, mat.id, ['missing'])).toThrow(
      'nicht mehr vorhandene',
    );
  });

  it('creates on-site detachements once per event and suggests the usual names', () => {
    const project = onsiteFixture();
    const event = kvkEvent(project);
    const other = kvkEvent(project, ['wk'], 'WK');
    expect(subDetSuggestions(project, event.id)).toEqual(['Det Mat', 'Det VT', 'Det Kp']);
    addSubDets(project, event.id, parseSubDetNames('Det Mat, det  mat; Det VT'));
    expect(subDetsOf(project, event.id).map((sub) => sub.name)).toEqual(['Det Mat', 'Det VT']);
    expect(() => addSubDets(project, event.id, ['DET MAT'])).toThrow('besteht bereits');
    expect(() => addSubDets(project, event.id, ['  '])).toThrow('Namen');
    expect(() => addSubDets(project, 'missing', ['Det X'])).toThrow('nicht mehr vorhanden');
    addSubDets(project, event.id, ['Det San']);
    expect(subDetSuggestions(project, other.id)).toEqual([
      'Det Mat',
      'Det VT',
      'Det San',
      'Det Kp',
    ]);
    const [first, second] = subDetsOf(project, event.id);
    expect(() => renameSubDet(project, second.id, 'det mat')).toThrow('besteht bereits');
    renameSubDet(project, first.id, '  Det   Material ');
    expect(first.name).toBe('Det Material');
    removeSubDet(project, second.id);
    expect(subDetsOf(project, event.id).map((sub) => sub.name)).toEqual([
      'Det Material',
      'Det San',
    ]);
  });

  it('places each person in at most one detachement per event, with the leader first', () => {
    const project = onsiteFixture();
    const event = kvkEvent(project);
    const [mat, vt] = addSubDets(project, event.id, ['Det Mat', 'Det VT']);
    moveToSubDet(project, event.id, mat.id, ['p-wm', 'p-sdt1']);
    moveToSubDet(project, event.id, vt.id, ['p-sdt1', 'p-sdt2']);
    const view = onsiteView(project, event.id);
    expect(view.groups.map((group) => ids(group.people))).toEqual([['p-wm'], ['p-sdt2', 'p-sdt1']]);
    expect(ids(view.unassigned)).toEqual(['p-lt', 'p-four']);
    // Another event has its own placement.
    const week = kvkEvent(project, ['wk'], 'WK');
    const [kp] = addSubDets(project, week.id, ['Det Kp']);
    moveToSubDet(project, week.id, kp.id, ['p-sdt1']);
    expect(onsiteView(project, event.id).placement.get('p-sdt1')).toBe(vt.id);
    expect(() => moveToSubDet(project, event.id, kp.id, ['p-sdt1'])).toThrow('anderen Event');
    setSubDetChef(project, mat.id, 'p-sdt1');
    expect(ids(onsiteView(project, event.id).groups[0].people)).toEqual(['p-sdt1', 'p-wm']);
    moveToSubDet(project, event.id, vt.id, ['p-sdt1']);
    expect(mat.chefId).toBe('');
    setSubDetAuftrag(project, mat.id, '  Fassung Zeughaus  ');
    expect(mat.auftrag).toBe('Fassung Zeughaus');
    moveToSubDet(project, event.id, null, ['p-sdt1']);
    expect(onsiteView(project, event.id).placement.has('p-sdt1')).toBe(false);
  });

  it('copies an event completely and independently', () => {
    const project = onsiteFixture();
    const event = kvkEvent(project);
    const [mat] = addSubDets(project, event.id, ['Det Mat']);
    moveToSubDet(project, event.id, mat.id, ['p-wm', 'p-sdt1']);
    setSubDetChef(project, mat.id, 'p-wm');
    setSubDetAuftrag(project, mat.id, 'Fassung');
    const copy = copyEvent(project, event.id);
    expect(copy).toMatchObject({ name: 'KVK (Kopie)', von: event.von, bis: event.bis });
    expect(copy.detIds).toEqual(event.detIds);
    const [copied] = subDetsOf(project, copy.id);
    expect(copied).toMatchObject({ name: 'Det Mat', chefId: 'p-wm', auftrag: 'Fassung' });
    expect(copied.id).not.toBe(mat.id);
    moveToSubDet(project, copy.id, null, ['p-sdt1']);
    expect(mat.personIds).toEqual(['p-wm', 'p-sdt1']);
    expect(copyEvent(project, event.id).name).toBe('KVK (Kopie) 2');
    removeEvent(project, copy.id);
    expect(project.onsiteEvents?.some((item) => item.id === copy.id)).toBe(false);
    expect(subDetsOf(project, copy.id)).toEqual([]);
    expect(subDetsOf(project, event.id)).toHaveLength(1);
  });

  it('keeps events when a planning card goes; the card only leaves the filters', () => {
    const project = withSecondKvk(onsiteFixture());
    const event = kvkEvent(project, ['kvk', 'kvk-ost']);
    const [mat] = addSubDets(project, event.id, ['Det Mat']);
    moveToSubDet(project, event.id, mat.id, ['p-ost1']);
    project.dets = project.dets.filter((group) => group.id !== 'kvk-ost');
    removeDetFromOnsite(project, 'kvk-ost');
    expect(event.detIds).toEqual(['kvk']);
    expect(onsiteView(project, event.id).placement.get('p-ost1')).toBe(mat.id);
    expect(onsiteSummary(project, 'kvk')).toEqual({ text: 'Vor Ort: KVK', target: event.id });
    expect(onsiteSummary(project, 'wk')).toBeNull();
  });

  it('never changes PISA entries, validation, assignments or confirmed signatures', () => {
    const project = onsiteFixture();
    project.orderPolicy = { mode: 'separate', confirmedBy: 'Fiktiv KF', confirmedAt: '2027-01-01' };
    const entries = derivePisa(project),
      issues = validateProject(project),
      signature = projectSignature(project),
      entrySignatures = entries.map((entry) => entrySignature(project, entry)),
      assign = structuredClone(project.assign);
    const event = kvkEvent(project);
    const [mat] = addSubDets(project, event.id, ['Det Mat', 'Det VT']);
    moveToSubDet(project, event.id, mat.id, ['p-wm', 'p-sdt1']);
    setSubDetChef(project, mat.id, 'p-wm');
    copyEvent(project, event.id);
    expect(derivePisa(project)).toEqual(entries);
    expect(validateProject(project)).toEqual(issues);
    expect(projectSignature(project)).toBe(signature);
    expect(entries.map((entry) => entrySignature(project, entry))).toEqual(entrySignatures);
    expect(project.assign).toEqual(assign);
  });

  it('round-trips through the local JSON boundary and protects archives', () => {
    const project = onsiteFixture();
    const event = kvkEvent(project);
    const [mat] = addSubDets(project, event.id, ['Det Mat']);
    setSubDetChef(project, mat.id, 'p-wm');
    const json = JSON.parse(JSON.stringify(project));
    const loaded = normalizeProject(json);
    expect(loaded.onsiteEvents).toEqual(project.onsiteEvents);
    expect(loaded.subDets).toEqual(project.subDets);
    const { subDets: _subDets, onsiteEvents: _events, ...old } = json;
    expect(normalizeProject(old).onsiteEvents).toBeUndefined();
    expect(() => normalizeProject({ ...json, onsiteEvents: {} })).toThrow('kein gültiges Projekt');
    expect(() =>
      normalizeProject({ ...json, subDets: [{ id: 's', parentId: 'kvk', personIds: 'x' }] }),
    ).toThrow('kein gültiges Projekt');
    const archived = archiveSnapshot(project);
    expect(() => kvkEvent(archived)).toThrow('schreibgeschützt');
    expect(() => copyEvent(archived, event.id)).toThrow('schreibgeschützt');
    expect(() => moveToSubDet(archived, event.id, null, ['p-wm'])).toThrow('schreibgeschützt');
  });

  it('turns sub-groups of earlier drafts into events without losing placements', () => {
    const project = withSecondKvk(onsiteFixture());
    const json = JSON.parse(JSON.stringify(project));
    json.onsiteUnits = [{ id: 'unit-1', name: 'KVK gesamt', detIds: ['kvk', 'kvk-ost'] }];
    json.subDets = [
      { id: 's1', parentId: 'kvk', name: 'Det Mat', chefId: '', auftrag: '', personIds: ['p-wm'] },
      {
        id: 's2',
        parentId: 'unit-1',
        name: 'Det VT',
        chefId: '',
        auftrag: '',
        personIds: ['p-ost1'],
      },
    ];
    const loaded = normalizeProject(json);
    expect(loaded.onsiteUnits).toBeUndefined();
    expect(loaded.onsiteEvents).toEqual([
      { id: 'unit-1', name: 'KVK gesamt', von: '', bis: '', detIds: ['kvk', 'kvk-ost'] },
      { id: 'kvk', name: 'Fiktiv KVK', von: '2027-04-26', bis: '2027-04-30', detIds: ['kvk'] },
    ]);
    expect(onsiteView(loaded, 'kvk').placement.get('p-wm')).toBe('s1');
    expect(onsiteView(loaded, 'unit-1').placement.get('p-ost1')).toBe('s2');
  });

  it('orders lists by grade and summarises the strength', () => {
    const grades = ['Sdt', 'Hptm', 'Wm', '', 'Oberstlt', 'Adj Uof', 'Unbekannt', 'Obgfr', 'Kpl'];
    const people = grades.map((grad, index) => person(`g${index}`, grad, 'Fiktiv', `N${index}`));
    expect(sortByRank(people).map((item) => item.grad)).toEqual([
      'Oberstlt',
      'Hptm',
      'Adj Uof',
      'Wm',
      'Kpl',
      'Obgfr',
      'Sdt',
      '',
      'Unbekannt',
    ]);
    expect(['Lt', 'Hptfw', 'Kpl', 'Sdt', 'Rekr', ''].map(rankCategory)).toEqual([
      'of',
      'hoehUof',
      'uof',
      'mannschaft',
      'mannschaft',
      'other',
    ]);
    expect(bestand(people)).toBe('2 Of · 1 Höh Uof · 2 Uof · 2 Mannschaft · 2 Ohne Grad');
  });
});

describe('Det lists', () => {
  function split() {
    const project = onsiteFixture();
    const event = kvkEvent(project);
    const [mat, vt] = addSubDets(project, event.id, ['Det Mat', 'Det VT']);
    moveToSubDet(project, event.id, mat.id, ['p-sdt1', 'p-wm']);
    setSubDetChef(project, mat.id, 'p-wm');
    setSubDetAuftrag(project, mat.id, 'Fassung');
    moveToSubDet(project, event.id, vt.id, ['p-sdt2']);
    return { project, event, mat, vt };
  }

  it('groups by detachement with the leader first and, on request, the remaining people', () => {
    const { project, event } = split();
    // By default only placed people are listed.
    const placed = buildDetSheet(project, event.id, DEFAULT_DET_SHEET_OPTIONS);
    expect(placed.sections.map((section) => section.title)).toEqual(['Det Mat', 'Det VT']);
    expect(placed.total).toBe(3);
    expect(placed.bestand).toBe('1 Uof · 2 Mannschaft');
    const sheet = buildDetSheet(project, event.id, {
      ...DEFAULT_DET_SHEET_OPTIONS,
      unassigned: true,
    });
    expect(sheet.title).toBe('KVK');
    expect(sheet.ec).toBe('K1');
    expect(sheet.sections.map((section) => section.title)).toEqual([
      'Det Mat',
      'Det VT',
      'Nicht eingeteilt',
    ]);
    expect(ids(sheet.sections[0].people)).toEqual(['p-wm', 'p-sdt1']);
    expect(sheet.sections[0].chef?.id).toBe('p-wm');
    expect(ids(sheet.sections[2].people)).toEqual(['p-lt', 'p-four']);
    expect(sheet.details).toEqual([
      ['Zeitraum', 'Mo 26.04.2027 – Fr 30.04.2027'],
      ['Detachement', 'Fiktiv KVK (EC K1)'],
      ['Einrücken', 'Mo 26.04.2027 · 08:00 Uhr · Fiktivort'],
      ['Treffpunkt', 'Tor A'],
      ['Anzug', 'Tenue B'],
      ['Entlassung', 'Fr 30.04.2027 · Fiktivort'],
    ]);
    expect(sheet.total).toBe(5);
    expect(sheet.bestand).toBe('1 Of · 1 Höh Uof · 1 Uof · 2 Mannschaft');
    expect(sheet.licenses).toEqual([
      ['B', 2],
      ['C', 1],
      ['C1', 1],
    ]);
    // All people come from one PISA detachement: no origin column.
    expect(sheet.columns.map((column) => column.label)).toEqual([
      'Funktion',
      'Fahrausweise',
      'Zug',
      'Telefon',
    ]);
    expect(sheet.visum).toBe('');
    expect(sheet.note).toBe('');
    expect(sheet.fileStem).toMatch(/^KVK_\d{4}-\d{2}-\d{2}$/);
  });

  it('limits the list to one detachement and only to the chosen columns', () => {
    const { project, event, mat } = split();
    const options = { ...DEFAULT_DET_SHEET_OPTIONS, scope: mat.id };
    const sheet = buildDetSheet(project, event.id, options);
    expect(sheet.title).toBe('KVK · Det Mat');
    expect(sheet.sections).toHaveLength(1);
    expect(sheet.fileStem).toMatch(/^KVK_Det_Mat_/);
    const text = detSheetText(sheet);
    expect(text).toContain('Det Mat – 2 Pers. · Chef: Wm Beispiel Berta');
    expect(text).toContain('Auftrag: Fassung');
    expect(text).toContain('1. Wm Beispiel Berta · Mat Uof · B, C · +41 00 000 00 01');
    expect(text).not.toContain('Dario');
    const withoutPhone = detSheetText(
      buildDetSheet(project, event.id, {
        ...options,
        columns: { ...options.columns, tel: false },
      }),
    );
    expect(withoutPhone).not.toContain('+41');
    // An unknown or removed scope falls back to the whole event.
    expect(buildDetSheet(project, event.id, { ...options, scope: 'other' }).sections).toHaveLength(
      2,
    );
  });

  it('lists the whole event ungrouped when asked', () => {
    const { project, event } = split();
    const options = { ...DEFAULT_DET_SHEET_OPTIONS, grouped: false };
    const sheet = buildDetSheet(project, event.id, options);
    expect(sheet.sections).toHaveLength(1);
    expect(sheet.sections[0].title).toBe('');
    expect(ids(sheet.sections[0].people)).toEqual(['p-wm', 'p-sdt2', 'p-sdt1']);
    const everyone = buildDetSheet(project, event.id, { ...options, unassigned: true });
    expect(ids(everyone.sections[0].people)).toEqual([
      'p-lt',
      'p-four',
      'p-wm',
      'p-sdt2',
      'p-sdt1',
    ]);
    // Before any detachement exists, everyone is open and listed.
    const fresh = kvkEvent(project, ['kvk'], 'Neu');
    expect(buildDetSheet(project, fresh.id, DEFAULT_DET_SHEET_OPTIONS).total).toBe(5);
  });

  it('shows the PISA detachement of every person when several are filtered', () => {
    const project = withSecondKvk(onsiteFixture());
    const event = kvkEvent(project, ['kvk', 'kvk-ost'], 'KVK gesamt');
    const [mat] = addSubDets(project, event.id, ['Det Mat']);
    moveToSubDet(project, event.id, mat.id, ['p-wm', 'p-ost1']);
    const sheet = buildDetSheet(project, event.id, DEFAULT_DET_SHEET_OPTIONS);
    expect(sheet.ec).toBe('K1 · K2');
    expect(sheet.details).toEqual([
      ['Zeitraum', 'Mo 26.04.2027 – Fr 30.04.2027'],
      ['Detachemente', 'Fiktiv KVK (EC K1) · Fiktiv KVK Ost (EC K2)'],
      [
        'Einrücken',
        'Fiktiv KVK: Mo 26.04.2027 · 08:00 Uhr · Fiktivort · Fiktiv KVK Ost: Mo 26.04.2027 · 09:00 Uhr · Fiktivdorf',
      ],
      ['Treffpunkt', 'Tor A'],
      ['Anzug', 'Tenue B'],
      [
        'Entlassung',
        'Fiktiv KVK: Fr 30.04.2027 · Fiktivort · Fiktiv KVK Ost: Fr 30.04.2027 · Fiktivdorf',
      ],
    ]);
    expect(sheet.columns[0].label).toBe('Detachement');
    expect(sheet.sections[0].people.map((item) => sheet.columns[0].value(item))).toEqual([
      'Fiktiv KVK',
      'Fiktiv KVK Ost',
    ]);
    expect(sheet.total).toBe(2);
    expect(
      buildDetSheet(project, event.id, { ...DEFAULT_DET_SHEET_OPTIONS, unassigned: true }).total,
    ).toBe(7);
  });

  it('prints functions and driving licences in the short forms of the cards', () => {
    const project = onsiteFixture();
    expect(
      [
        '21 L Motorwagen geländegängig',
        '22 L Motorwagen nicht geländegäng',
        '97 Sehhilfe',
        '45 Feldumschlaggerät FUG',
        '50 Fiktives Gerät',
        'B',
      ].map((value) => shortLicense(project, value)),
    ).toEqual(['G-Klasse', 'PW', '', 'FUG', 'Fiktives Gerät', 'B']);
    expect(
      [
        'Späheroffizier',
        'Aufklärer/Fahrer B',
        'Infanterieeinheitssanitäter/Fahrer C1',
        'Führungsstaffelsoldat/Fahrer C1',
        'Aufklärungsunteroffizier',
        'Fiktivfunktion',
      ].map((value) => shortFunction(project, value)),
    ).toEqual([
      'Späher Of',
      'Aufkl/Fahr B',
      'Inf Einh San/Fahr C1',
      'Fhr St Sdt/Fahr C1',
      'Aufkl Uof',
      'Fiktivfunktion',
    ]);
    // Overrides kept from earlier versions win; an empty one hides the entry.
    project.maps.fkt['Mat Uof'] = 'Mat';
    project.maps.lic['22 L Motorwagen nicht geländegäng'] = 'Personenwagen';
    project.maps.lic['45 Feldumschlaggerät FUG'] = '';
    const berta = project.persons.find((item) => item.id === 'p-wm');
    if (berta)
      berta.lics = [
        '21 L Motorwagen geländegängig',
        '23 L Motorwagen GG mit Anhänger',
        '22 L Motorwagen nicht geländegäng',
        '45 Feldumschlaggerät FUG',
        '97 Sehhilfe',
      ];
    // The trailer variant replaces its base category.
    expect(berta && licenseCategories(project, berta)).toEqual([
      'G-Klasse mit Anh',
      'Personenwagen',
    ]);
    const event = kvkEvent(project);
    const [mat] = addSubDets(project, event.id, ['Det Mat']);
    moveToSubDet(project, event.id, mat.id, ['p-wm', 'p-sdt1']);
    const sheet = buildDetSheet(project, event.id, { ...DEFAULT_DET_SHEET_OPTIONS, scope: mat.id });
    const column = (key: string) => sheet.columns.find((item) => item.key === key);
    expect(berta && column('funktion')?.value(berta)).toBe('Mat');
    expect(berta && column('lics')?.value(berta)).toBe('G-Klasse mit Anh, Personenwagen');
    expect(sheet.licenses).toEqual([
      ['B', 1],
      ['G-Klasse mit Anh', 1],
      ['Personenwagen', 1],
    ]);
    const text = detSheetText(sheet);
    expect(text).not.toContain('Motorwagen');
    expect(text).not.toContain('Sehhilfe');
  });

  it('adds a signature column and an event text to the list', () => {
    const { project, event } = split();
    expect(() => setEventNote(project, 'missing', 'x')).toThrow('nicht mehr vorhanden');
    expect(() => setEventNote(project, event.id, 'x'.repeat(2001))).toThrow('höchstens');
    setEventNote(
      project,
      event.id,
      '\n  Der AdA bestätigt den Erhalt von:   \r\n- Schutzmaske\n- Gehörschutz  \n\n',
    );
    expect(event.hinweis).toBe('Der AdA bestätigt den Erhalt von:\n- Schutzmaske\n- Gehörschutz');
    // The text travels with copies and through the JSON boundary.
    expect(copyEvent(project, event.id).hinweis).toBe(event.hinweis);
    expect(normalizeProject(JSON.parse(JSON.stringify(project))).onsiteEvents?.[0].hinweis).toBe(
      event.hinweis,
    );
    const options = { ...DEFAULT_DET_SHEET_OPTIONS, visum: true };
    const sheet = buildDetSheet(project, event.id, options);
    expect(sheet.visum).toBe('Visum');
    expect(sheet.note).toBe(event.hinweis);
    expect(detSheetText(sheet)).toContain('Der AdA bestätigt den Erhalt von:\n- Schutzmaske');
    const workbook = detSheetWorkbook(sheet);
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(workbook.Sheets.Liste, {
      defval: '',
    });
    expect(Object.keys(rows[0])).toEqual(expect.arrayContaining(['Zug', 'Anwesend', 'Visum']));
    const details = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Angaben, { header: 1 });
    expect(details).toContainEqual(['Zusatztext', event.hinweis]);
    expect(
      buildDetSheet(project, event.id, { ...options, visumLabel: '  Visum   Mat-Fassung ' }).visum,
    ).toBe('Visum Mat-Fassung');
    // A heading equal to another column keeps both columns in Excel.
    const clash = detSheetWorkbook(
      buildDetSheet(project, event.id, { ...options, visumLabel: 'Telefon' }),
    );
    const clashRows = XLSX.utils.sheet_to_json<Record<string, string>>(clash.Sheets.Liste, {
      defval: '',
    });
    expect(clashRows[0]).toMatchObject({ Telefon: '+41 00 000 00 01', 'Telefon (Visum)': '' });
    setEventNote(project, event.id, '   ');
    expect(event.hinweis).toBeUndefined();
    expect(() => setEventNote(archiveSnapshot(project), event.id, 'x')).toThrow('schreibgeschützt');
  });

  it('writes the same list to Excel with valid, unique sheet names', () => {
    const { project, event, vt } = split();
    renameSubDet(project, vt.id, 'Det [VT]/Fahrer* mit sehr langem Namen');
    addSubDets(project, event.id, ['Det [VT]/Fahrer* mit sehr langem Namen 2']);
    const workbook = detSheetWorkbook(buildDetSheet(project, event.id, DEFAULT_DET_SHEET_OPTIONS));
    expect(workbook.SheetNames[0]).toBe('Liste');
    expect(workbook.SheetNames.at(-1)).toBe('Angaben');
    expect(new Set(workbook.SheetNames.map((name) => name.toLowerCase())).size).toBe(
      workbook.SheetNames.length,
    );
    for (const name of workbook.SheetNames) {
      expect(name.length).toBeLessThanOrEqual(31);
      expect(name).not.toMatch(/[[\]:*?/\\]/);
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(workbook.Sheets.Liste);
    expect(rows).toHaveLength(3);
    expect(rows[0]).toMatchObject({
      Nr: 1,
      Untergruppe: 'Det Mat',
      Rolle: 'Chef',
      Grad: 'Wm',
      Name: 'Beispiel Berta',
      Telefon: '+41 00 000 00 01',
    });
    expect(Object.keys(rows[0])).toContain('Anwesend');
  });
});
