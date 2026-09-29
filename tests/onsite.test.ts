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
  derivePisa,
  entrySignature,
  moveToSubDet,
  normalizeProject,
  onsiteView,
  parseSubDetNames,
  projectSignature,
  rankCategory,
  removePeople,
  removeSubDet,
  renameSubDet,
  setSubDetAuftrag,
  setSubDetChef,
  sortByRank,
  subDetSuggestions,
  subDetsOf,
  validateProject,
} from '../src/model';
import type { Person } from '../src/model/types';
import { onsiteFixture, person } from './onsite-fixtures';

const ids = (people: Person[]) => people.map((item) => item.id);

describe('on-site sub-groups', () => {
  it('creates named sub-groups once per detachement and suggests the usual names', () => {
    const project = onsiteFixture();
    expect(subDetSuggestions(project, 'kvk')).toEqual(['Det Mat', 'Det VT', 'Det Kp']);
    addSubDets(project, 'kvk', parseSubDetNames('Det Mat, det  mat; Det VT'));
    expect(subDetsOf(project, 'kvk').map((sub) => sub.name)).toEqual(['Det Mat', 'Det VT']);
    expect(() => addSubDets(project, 'kvk', ['DET MAT'])).toThrow('besteht bereits');
    expect(() => addSubDets(project, 'kvk', ['  '])).toThrow('Namen');
    expect(() => addSubDets(project, 'missing', ['Det X'])).toThrow('existiert nicht');
    expect(subDetSuggestions(project, 'kvk')).toEqual(['Det Kp']);
    // Names used elsewhere in the service come first for the next detachement.
    addSubDets(project, 'kvk', ['Det San']);
    expect(subDetSuggestions(project, 'wk')).toEqual(['Det Mat', 'Det VT', 'Det San', 'Det Kp']);
    const [first, second] = subDetsOf(project, 'kvk');
    expect(() => renameSubDet(project, second.id, 'det mat')).toThrow('besteht bereits');
    renameSubDet(project, first.id, '  Det   Material ');
    expect(first.name).toBe('Det Material');
    removeSubDet(project, second.id);
    expect(subDetsOf(project, 'kvk').map((sub) => sub.name)).toEqual(['Det Material', 'Det San']);
  });

  it('places each person in at most one sub-group of a detachement', () => {
    const project = onsiteFixture();
    const [mat, vt] = addSubDets(project, 'kvk', ['Det Mat', 'Det VT']);
    moveToSubDet(project, 'kvk', mat.id, ['p-wm', 'p-sdt1']);
    moveToSubDet(project, 'kvk', vt.id, ['p-sdt1', 'p-sdt2']);
    const view = onsiteView(project, 'kvk');
    // Highest grade first: Gfr before Sdt, Oblt before Four.
    expect(view.groups.map((group) => ids(group.people))).toEqual([['p-wm'], ['p-sdt2', 'p-sdt1']]);
    expect(ids(view.unassigned)).toEqual(['p-lt', 'p-four']);
    expect(() => moveToSubDet(project, 'kvk', mat.id, ['p-main'])).toThrow('Nur Personen');
    // The following detachement includes the connected people and has its own sub-groups.
    const [kp] = addSubDets(project, 'wk', ['Det Kp']);
    moveToSubDet(project, 'wk', kp.id, ['p-sdt1', 'p-main']);
    expect(onsiteView(project, 'kvk').placement.get('p-sdt1')).toBe(vt.id);
    expect(onsiteView(project, 'wk').placement.get('p-sdt1')).toBe(kp.id);
    expect(() => moveToSubDet(project, 'kvk', kp.id, ['p-sdt1'])).toThrow('anderen Detachement');
    moveToSubDet(project, 'kvk', null, ['p-sdt1']);
    expect(onsiteView(project, 'kvk').placement.has('p-sdt1')).toBe(false);
    expect(onsiteView(project, 'wk').placement.get('p-sdt1')).toBe(kp.id);
  });

  it('keeps the leader inside the sub-group and first in its list', () => {
    const project = onsiteFixture();
    const [mat, vt] = addSubDets(project, 'kvk', ['Det Mat', 'Det VT']);
    moveToSubDet(project, 'kvk', mat.id, ['p-wm']);
    setSubDetChef(project, mat.id, 'p-sdt1');
    const group = onsiteView(project, 'kvk').groups[0];
    expect(group.chef?.id).toBe('p-sdt1');
    expect(ids(group.people)).toEqual(['p-sdt1', 'p-wm']);
    moveToSubDet(project, 'kvk', vt.id, ['p-sdt1']);
    expect(mat.chefId).toBe('');
    expect(() => setSubDetChef(project, mat.id, 'p-main')).toThrow('Nur Personen');
    setSubDetAuftrag(project, mat.id, '  Fassung Zeughaus  ');
    expect(mat.auftrag).toBe('Fassung Zeughaus');
  });

  it('never changes PISA entries, validation, assignments or confirmed signatures', () => {
    const project = onsiteFixture();
    project.orderPolicy = { mode: 'separate', confirmedBy: 'Fiktiv KF', confirmedAt: '2027-01-01' };
    const entries = derivePisa(project),
      issues = validateProject(project),
      signature = projectSignature(project),
      entrySignatures = entries.map((entry) => entrySignature(project, entry)),
      assign = structuredClone(project.assign);
    const [mat] = addSubDets(project, 'kvk', ['Det Mat', 'Det VT']);
    moveToSubDet(project, 'kvk', mat.id, ['p-wm', 'p-sdt1']);
    setSubDetChef(project, mat.id, 'p-wm');
    expect(derivePisa(project)).toEqual(entries);
    expect(validateProject(project)).toEqual(issues);
    expect(projectSignature(project)).toBe(signature);
    expect(entries.map((entry) => entrySignature(project, entry))).toEqual(entrySignatures);
    expect(project.assign).toEqual(assign);
  });

  it('reports entries of people who left the detachement until they are cleared', () => {
    const project = onsiteFixture();
    const [mat] = addSubDets(project, 'kvk', ['Det Mat']);
    moveToSubDet(project, 'kvk', mat.id, ['p-wm', 'p-sdt1']);
    removePeople(project, 'kvk', ['p-wm']);
    const view = onsiteView(project, 'kvk');
    expect(view.staleIds).toEqual(['p-wm']);
    expect(ids(view.groups[0].people)).toEqual(['p-sdt1']);
    moveToSubDet(project, 'kvk', null, view.staleIds);
    expect(mat.personIds).toEqual(['p-sdt1']);
  });

  it('round-trips through the local JSON boundary and protects archives', () => {
    const project = onsiteFixture();
    const [mat] = addSubDets(project, 'kvk', ['Det Mat']);
    setSubDetChef(project, mat.id, 'p-wm');
    const json = JSON.parse(JSON.stringify(project));
    expect(normalizeProject(json).subDets).toEqual(project.subDets);
    const { subDets: _subDets, ...old } = json;
    expect(normalizeProject(old).subDets).toBeUndefined();
    expect(() => normalizeProject({ ...json, subDets: {} })).toThrow('kein gültiges Projekt');
    expect(() =>
      normalizeProject({ ...json, subDets: [{ id: 's', parentId: 'kvk', personIds: 'x' }] }),
    ).toThrow('kein gültiges Projekt');
    const archived = archiveSnapshot(project);
    expect(() => addSubDets(archived, 'kvk', ['Det VT'])).toThrow('schreibgeschützt');
    expect(() => moveToSubDet(archived, 'kvk', null, ['p-wm'])).toThrow('schreibgeschützt');
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
    const [mat, vt] = addSubDets(project, 'kvk', ['Det Mat', 'Det VT']);
    moveToSubDet(project, 'kvk', mat.id, ['p-sdt1', 'p-wm']);
    setSubDetChef(project, mat.id, 'p-wm');
    setSubDetAuftrag(project, mat.id, 'Fassung');
    moveToSubDet(project, 'kvk', vt.id, ['p-sdt2']);
    return { project, mat, vt };
  }

  it('groups by sub-group with the leader first and the remaining people last', () => {
    const { project } = split();
    const sheet = buildDetSheet(project, 'kvk', DEFAULT_DET_SHEET_OPTIONS);
    expect(sheet.title).toBe('Fiktiv KVK');
    expect(sheet.sections.map((section) => section.title)).toEqual([
      'Det Mat',
      'Det VT',
      'Nicht eingeteilt',
    ]);
    expect(ids(sheet.sections[0].people)).toEqual(['p-wm', 'p-sdt1']);
    expect(sheet.sections[0].chef?.id).toBe('p-wm');
    expect(ids(sheet.sections[2].people)).toEqual(['p-lt', 'p-four']);
    expect(sheet.details).toContainEqual(['Einrücken', 'Mo 26.04.2027 · 08:00 Uhr · Fiktivort']);
    expect(sheet.details).toContainEqual(['Entlassung', 'Fr 30.04.2027 · Fiktivort']);
    expect(sheet.total).toBe(5);
    expect(sheet.bestand).toBe('1 Of · 1 Höh Uof · 1 Uof · 2 Mannschaft');
    expect(sheet.licenses).toEqual([
      ['B', 2],
      ['C', 1],
      ['C1', 1],
    ]);
    expect(sheet.columns.map((column) => column.label)).toEqual([
      'Funktion',
      'Fahrausweise',
      'Telefon',
    ]);
    expect(sheet.fileStem).toMatch(/^Fiktiv_KVK_\d{4}-\d{2}-\d{2}$/);
  });

  it('limits the list to one sub-group and only to the chosen columns', () => {
    const { project, mat } = split();
    const options = { ...DEFAULT_DET_SHEET_OPTIONS, scope: mat.id };
    const sheet = buildDetSheet(project, 'kvk', options);
    expect(sheet.title).toBe('Fiktiv KVK · Det Mat');
    expect(sheet.sections).toHaveLength(1);
    expect(sheet.fileStem).toMatch(/^Fiktiv_KVK_Det_Mat_/);
    const text = detSheetText(sheet);
    expect(text).toContain('Det Mat – 2 Pers. · Chef: Wm Beispiel Berta');
    expect(text).toContain('Auftrag: Fassung');
    expect(text).toContain('1. Wm Beispiel Berta · Mat Uof · B, C · +41 00 000 00 01');
    expect(text).not.toContain('Dario');
    const withoutPhone = detSheetText(
      buildDetSheet(project, 'kvk', {
        ...options,
        columns: { ...options.columns, tel: false },
      }),
    );
    expect(withoutPhone).not.toContain('+41');
    // An unknown or removed scope falls back to the whole detachement.
    expect(buildDetSheet(project, 'kvk', { ...options, scope: 'other' }).sections).toHaveLength(3);
  });

  it('lists the whole detachement ungrouped when asked', () => {
    const { project } = split();
    const sheet = buildDetSheet(project, 'kvk', { ...DEFAULT_DET_SHEET_OPTIONS, grouped: false });
    expect(sheet.sections).toHaveLength(1);
    expect(sheet.sections[0].title).toBe('');
    expect(ids(sheet.sections[0].people)).toEqual(['p-lt', 'p-four', 'p-wm', 'p-sdt2', 'p-sdt1']);
  });

  it('writes the same list to Excel with valid, unique sheet names', () => {
    const { project, vt } = split();
    renameSubDet(project, vt.id, 'Det [VT]/Fahrer* mit sehr langem Namen');
    addSubDets(project, 'kvk', ['Det [VT]/Fahrer* mit sehr langem Namen 2']);
    const workbook = detSheetWorkbook(buildDetSheet(project, 'kvk', DEFAULT_DET_SHEET_OPTIONS));
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
    expect(rows).toHaveLength(5);
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
