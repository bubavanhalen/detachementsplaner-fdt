import { describe, expect, it, vi } from 'vitest';
import { demoProject } from '../src/io/demo';
import {
  bundleHtml,
  contactCsv,
  contactNames,
  contactRows,
  contactWarnings,
  createWorkbook,
  hasContactData,
} from '../src/io/exports';
import { findHeader, guessMapping, importRows, normalizePhone, splitName } from '../src/io/import';
import {
  ARCHIVE_KEY,
  PROJECT_KEY,
  readArchives,
  readProject,
  saveArchive,
  saveProject,
} from '../src/io/storage';
import { XLSX } from '../src/io/workbook';
import type { Person, Project } from '../src/model';
import {
  archiveSnapshot,
  createProject,
  derivePisa,
  groupPeople,
  normalizeProject,
  remainingPeople,
  resumeProject,
  validateProject,
} from '../src/model';

function fictionalPerson(id: string, number: string): Person {
  return {
    id,
    name: 'Alex Muster',
    pnr: number,
    grad: 'Wm',
    funktion: 'Inf Sdt',
    lics: [],
    raw: { Original: 'Erfundener Wert' },
    planning: { status: 'included', reason: 'Fiktive Notiz' },
  };
}
function sourceProject(): Project {
  const project = createProject();
  project.persons = [fictionalPerson('one', 'TEST-001'), fictionalPerson('two', 'TEST-002')];
  return project;
}
function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}
function csvRows(csv: string): string[][] {
  const workbook = XLSX.read(csv, { type: 'string', raw: true });
  return XLSX.utils.sheet_to_json<string[]>(workbook.Sheets[workbook.SheetNames[0]], {
    header: 1,
    raw: true,
    defval: '',
  });
}
function readyDemo(): Project {
  const project = demoProject();
  project.orderPolicy = { mode: 'separate', confirmedAt: '2027-04-01', confirmedBy: 'Fiktive KF' };
  for (const entry of derivePisa(project).filter((entry) => entry.generated))
    project.generatedCodes[entry.id] = 'W2';
  return project;
}

describe('local source import', () => {
  it('preserves prototype-named source column headers as plain raw data', () => {
    const project = createProject();
    importRows(
      project,
      'pisa',
      [
        ['Name', '__proto__', 'constructor'],
        ['Muster, Alex', 'Fictional raw value', 'Fictional constructor'],
      ],
      0,
      { name: 0 },
      'fiction.csv',
    );
    expect(Object.hasOwn(project.persons[0].raw, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(project.persons[0].raw, '__proto__')?.value).toBe(
      'Fictional raw value',
    );
    expect(Object.getPrototypeOf(project.persons[0].raw)).toBe(Object.prototype);
  });
  it('identifies a header below a title and guesses independent source columns', () => {
    const headers = [
      'Name / Vorname',
      'Grad',
      'Versicherten-Nr.',
      'Funktion',
      'Militärische Führerausweise',
      'Einheit',
      'Zug',
      'Diensttage',
      'Mobiltelefon',
      'E-Mail',
      'Wohnort',
    ];
    expect(findHeader([['Fiktive Liste'], [], headers, ['Muster, Alex', 'Wm']])).toBe(2);
    expect(guessMapping(headers)).toEqual({
      name: 0,
      grad: 1,
      pnr: 2,
      funktion: 3,
      lics: 4,
      einteilung: 5,
      zug: 6,
      dt: 7,
      tel: 8,
      mail: 9,
      wohnort: 10,
    });
  });
  it('splits explicit comma names and preserves ambiguous unseparated names intact', () => {
    expect(splitName(' von Muster, Alex Marie ')).toEqual({
      first: 'Alex Marie',
      last: 'von Muster',
      name: 'Alex Marie von Muster',
    });
    expect(splitName('Alex Marie von Muster')).toEqual({
      first: 'Alex Marie von Muster',
      last: '',
      name: 'Alex Marie von Muster',
    });
  });
  it.each(['079 000 00 01', '0041 79 000 00 01', '+41 79 000 00 01'])(
    'normalizes Swiss phone %s locally',
    (value) => {
      expect(normalizePhone(value)).toBe('+41 79 000 00 01');
    },
  );
  it('retains an international phone instead of converting it to Swiss', () => {
    expect(normalizePhone('+49 30 123456')).toBe('+49 30 123456');
    expect(normalizePhone('+43 1 234567')).toBe('+43 1 234567');
  });
  it('matches a unique canonical number, keeps namesakes separate and preserves old notes/raw fields', () => {
    const project = sourceProject();
    const result = importRows(
      project,
      'pisa',
      [
        ['Name', 'AHV', 'Funktion'],
        ['Muster, Alex', 'TEST.001', 'Motf'],
        ['Muster, Alex', 'TEST-003', 'Inf Sdt'],
      ],
      0,
      { name: 0, pnr: 1, funktion: 2 },
      'fictional.csv',
    );
    expect(result).toEqual({ added: 1, updated: 1 });
    expect(project.persons).toHaveLength(3);
    expect(project.persons[0].id).toBe('one');
    expect(project.persons[0].funktion).toBe('Motf');
    expect(project.persons[0].planning.reason).toBe('Fiktive Notiz');
    expect(project.persons[0].raw.Original).toBe('Erfundener Wert');
    expect(project.persons[0].rawSources?.pisa?.AHV).toBe('TEST.001');
    expect(project.persons[1].pnr).toBe('TEST-002');
    expect(project.persons[2].planning.status).toBe('unreviewed');
    expect(project.src.pisa?.anz).toBe(2);
  });
  it('PISA is authoritative while MILO fills missing values and retains its source values', () => {
    const project = sourceProject();
    importRows(
      project,
      'pisa',
      [
        ['Name', 'AHV', 'Funktion', 'Telefon'],
        ['Muster, Alex', 'TEST-001', 'Fiktiv PISA', '0790000001'],
      ],
      0,
      { name: 0, pnr: 1, funktion: 2, tel: 3 },
      'pisa-fiction.csv',
    );
    importRows(
      project,
      'milo',
      [
        ['Name', 'AHV', 'Funktion', 'E-Mail'],
        ['Muster, Alex', 'TEST-001', 'Fiktiv MILO', 'a@example.invalid'],
      ],
      0,
      { name: 0, pnr: 1, funktion: 2, mail: 3 },
      'milo-fiction.csv',
    );
    const person = project.persons[0];
    expect(person.funktion).toBe('Fiktiv PISA');
    expect(person.mail).toBe('a@example.invalid');
    expect(person.tel).toBe('+41 79 000 00 01');
    expect(person.rawSources?.pisa?.Funktion).toBe('Fiktiv PISA');
    expect(person.rawSources?.milo?.Funktion).toBe('Fiktiv MILO');
    expect(person.pisa).toBe(true);
    expect(person.milo).toBe(true);
  });
  it('does not silently update either record when a source number is already ambiguous', () => {
    const project = sourceProject();
    project.persons[1].pnr = 'TEST.001';
    importRows(
      project,
      'pisa',
      [
        ['Name', 'AHV', 'Funktion'],
        ['Muster, Alex', 'TEST-001', 'New function'],
      ],
      0,
      { name: 0, pnr: 1, funktion: 2 },
      'fiction.csv',
      true,
    );
    expect(project.persons).toHaveLength(3);
    expect(project.persons.slice(0, 2).every((person) => person.funktion === 'Inf Sdt')).toBe(true);
    expect(
      validateProject(project).filter((issue) => issue.code === 'duplicate-number'),
    ).toHaveLength(3);
  });
  it('optional name matching cannot merge people carrying distinct numbers', () => {
    const project = sourceProject();
    importRows(
      project,
      'pisa',
      [
        ['Name', 'AHV'],
        ['Muster, Alex', 'TEST-003'],
      ],
      0,
      { name: 0, pnr: 1 },
      'fiction.csv',
      true,
    );
    expect(project.persons).toHaveLength(3);
  });
  it('name-only merge is explicit and requires local identity review', () => {
    const project = sourceProject();
    project.persons.pop();
    importRows(
      project,
      'milo',
      [
        ['Name', 'Funktion'],
        ['Muster, Alex', 'Motf'],
      ],
      0,
      { name: 0, funktion: 1 },
      'fiction.csv',
      true,
    );
    expect(project.persons).toHaveLength(1);
    expect(project.persons[0].identityReview).toBeTruthy();
  });
  it('requires explicit name-only matching and skips blank rows', () => {
    const project = sourceProject();
    project.persons.pop();
    importRows(
      project,
      'milo',
      [
        ['Name', 'Funktion'],
        ['', ''],
        ['Muster, Alex', 'Motf'],
      ],
      0,
      { name: 0, funktion: 1 },
      'fiction.csv',
    );
    expect(project.persons).toHaveLength(2);
  });
  it('rejects absent mapping, invalid header and archive changes before mutation', () => {
    const project = sourceProject(),
      before = structuredClone(project);
    expect(() => importRows(project, 'pisa', [['Name']], 0, {}, 'fiction.csv')).toThrow(
      /Namensspalte/,
    );
    expect(() => importRows(project, 'pisa', [['Name']], 3, { name: 0 }, 'fiction.csv')).toThrow(
      /Kopfzeile/,
    );
    expect(project).toEqual(before);
    const archived = archiveSnapshot(project),
      snapshot = structuredClone(archived);
    expect(() =>
      importRows(
        archived,
        'pisa',
        [['Name'], ['New fictional person']],
        0,
        { name: 0 },
        'fiction.csv',
      ),
    ).toThrow(/schreibgeschützt/);
    expect(archived).toEqual(snapshot);
  });
  it('rejects out-of-range column mapping instead of recording a successful empty import', () => {
    const project = sourceProject(),
      before = structuredClone(project);
    expect(() =>
      importRows(
        project,
        'pisa',
        [
          ['Name', 'AHV'],
          ['Muster, Alex', 'TEST-001'],
        ],
        0,
        { name: 8, pnr: 1 },
        'fiction.csv',
      ),
    ).toThrow();
    expect(project).toEqual(before);
  });
});

describe('private contact CSV and workbook exports', () => {
  it('escapes Unicode, quotes, commas and line breaks while retaining international phones', () => {
    const project = readyDemo(),
      person = project.persons[0];
    person.name = 'Zoë "Test", Muster';
    person.tel = '+41 79 000 00 01';
    person.mail = 'zoe@example.invalid';
    const csv = contactCsv(project, [person], {
      rank: true,
      groups: true,
      label: 'Dienst, "Fiktiv"\n2027',
    });
    expect(csv.startsWith('\uFEFF')).toBe(true);
    const rows = csvRows(csv);
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('Wm');
    expect(rows[1][1]).toBe(person.name);
    expect(rows[1][2]).toBe('');
    expect(rows[1][6]).toBe('+41 79 000 00 01');
    expect(rows[1][7]).toContain('Dienst, "Fiktiv"\n2027');
    expect(rows[1][7]).toContain('DET 1 · KVK');
    expect(rows[1][7]).toContain('MAIN DET · WK');
    expect(csv).not.toContain(person.pnr);
    expect(csv).not.toContain('Fiktive Testperson');
  });
  it('keeps explicit first/last names only when they still match the displayed full name', () => {
    const person = fictionalPerson('one', 'TEST-001');
    person.vorname = 'Alex';
    person.nachname = 'Muster';
    expect(contactNames(person)).toEqual({ first: 'Alex', last: 'Muster' });
    person.name = 'Alex Neuername';
    expect(contactNames(person)).toEqual({ first: 'Alex Neuername', last: '' });
  });
  it('exports selected subset and can omit rank/group labels', () => {
    const project = readyDemo();
    const rows = contactRows(project, [project.persons[2]], {
      rank: false,
      groups: false,
      label: 'Nur Test',
    });
    expect(rows).toHaveLength(2);
    expect(rows[1][0]).toBe('');
    expect(rows[1][7]).toBe('Nur Test');
  });
  it('flags absent contact data and malformed values without mutating people', () => {
    const person = fictionalPerson('one', 'TEST-001');
    expect(hasContactData(person)).toBe(false);
    expect(contactWarnings(person)).toContain('Telefon und E-Mail fehlen');
    person.tel = '0790000001';
    person.mail = 'invalid';
    const before = structuredClone(person);
    expect(contactWarnings(person)).toEqual(['Telefonformat prüfen', 'E-Mail prüfen']);
    expect(person).toEqual(before);
  });
  it('refuses empty and oversized exports', () => {
    const project = readyDemo(),
      options = { rank: true, groups: true, label: '' };
    expect(() => contactCsv(project, [], options)).toThrow(/auswählen/);
    expect(() =>
      contactCsv(
        project,
        Array.from({ length: 3001 }, (_, index) =>
          fictionalPerson(`person-${index}`, `TEST-${index}`),
        ),
        options,
      ),
    ).toThrow(/3000/);
  });
  it('archived CSV is read-only and preserves service/group context in local labels', () => {
    const project = archiveSnapshot(readyDemo()),
      before = structuredClone(project);
    const rows = csvRows(
      contactCsv(project, [project.persons[0]], { rank: true, groups: true, label: project.name }),
    );
    expect(rows[1][7]).toContain(project.name);
    expect(rows[1][7]).toContain('KVK');
    expect(project).toEqual(before);
  });
  it('Excel roundtrip includes all people, full MB details and only direct main personnel rows', () => {
    const project = readyDemo();
    const workbook = XLSX.read(
      XLSX.write(createWorkbook(project), { type: 'array', bookType: 'xlsx' }),
      { type: 'array' },
    );
    const people = XLSX.utils.sheet_to_json(workbook.Sheets.Personal);
    const details = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets.Einrückungsdetails,
    );
    const assignments = XLSX.utils.sheet_to_json<Record<string, string>>(
      workbook.Sheets['PISA-Zuteilungen'],
    );
    expect(people).toHaveLength(6);
    expect(details).toHaveLength(3);
    expect(assignments).toHaveLength(4);
    expect(assignments.every((row) => row['Haupt-EC'] !== 'K1')).toBe(true);
    expect(assignments.filter((row) => row['Zusatz-EC'] === 'K1')).toHaveLength(2);
    expect(details.find((row) => row.EC === 'W2')).toMatchObject({
      Einrückdatum: '2027-05-03',
      Entlassungsdatum: '2027-05-21',
      Anzug: 'Uniform',
      Entlassungsort: 'Beispielort',
    });
    expect(assignments.filter((row) => row['Versicherten-Nr.'] === 'DEMO-000')).toHaveLength(1);
  });
});

describe('local storage and archives', () => {
  it('uses established storage keys and normalizes historical local JSON without rewriting it', () => {
    const storage = memoryStorage(),
      historical = JSON.stringify({
        v: 2,
        name: 'Fiktives Altprojekt',
        persons: [{ id: 'one', name: 'Alex Muster' }],
        dets: [],
      });
    expect(PROJECT_KEY).toBe('detplaner.v2');
    expect(ARCHIVE_KEY).toBe('detplaner.archives.v1');
    expect(readProject(storage)).toBeNull();
    storage.setItem(PROJECT_KEY, historical);
    expect(readProject(storage)?.v).toBe(5);
    expect(readProject(storage)?.persons[0].name).toBe('Alex Muster');
    expect(storage.getItem(PROJECT_KEY)).toBe(historical);
  });
  it('preserves corrupt active and archive contents on failed reads/writes', () => {
    const storage = memoryStorage();
    storage.setItem(PROJECT_KEY, 'broken-local-json');
    storage.setItem(ARCHIVE_KEY, 'broken-archives');
    expect(() => readProject(storage)).toThrow(/nicht lesbar/);
    expect(() => readArchives(storage)).toThrow(/nicht lesbar/);
    expect(() => saveArchive(archiveSnapshot(sourceProject()), storage)).toThrow(/nicht lesbar/);
    expect(storage.getItem(PROJECT_KEY)).toBe('broken-local-json');
    expect(storage.getItem(ARCHIVE_KEY)).toBe('broken-archives');
  });
  it('retains active project and existing archive on quota failure without leaking underlying error details', () => {
    const storage = memoryStorage(),
      project = sourceProject();
    saveProject(project, storage);
    const original = storage.getItem(PROJECT_KEY);
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new Error('Fictional sensitive backend detail');
    });
    expect(() => saveProject(project, storage)).toThrow(
      'Browserablage nicht verfügbar oder voll. Bitte den aktuellen Stand als JSON sichern.',
    );
    expect(() => saveArchive(archiveSnapshot(project), storage)).toThrow(
      /Das aktive Projekt bleibt erhalten/,
    );
    expect(storage.getItem(PROJECT_KEY)).toBe(original);
    expect(project.archive).toBeNull();
    expect(storage.getItem(ARCHIVE_KEY)).toBeNull();
  });
  it('saving a resumed working copy cannot overwrite an immutable snapshot', () => {
    const storage = memoryStorage(),
      snapshot = archiveSnapshot(sourceProject());
    saveArchive(snapshot, storage);
    const saved = storage.getItem(ARCHIVE_KEY),
      working = resumeProject(snapshot);
    working.persons[0].name = 'Changed fictional person';
    saveProject(working, storage);
    expect(storage.getItem(ARCHIVE_KEY)).toBe(saved);
    expect(readArchives(storage)[0].persons[0].name).toBe('Alex Muster');
    saveArchive(snapshot, storage);
    expect(readArchives(storage)).toHaveLength(1);
  });
  it('rejects non-array archives and active projects pretending to be archive snapshots', () => {
    const storage = memoryStorage();
    storage.setItem(ARCHIVE_KEY, '{}');
    expect(() => readArchives(storage)).toThrow();
    storage.setItem(ARCHIVE_KEY, JSON.stringify([sourceProject()]));
    expect(() => readArchives(storage)).toThrow();
  });
  it('reports unavailable active storage generically', () => {
    const storage = memoryStorage();
    vi.spyOn(storage, 'getItem').mockImplementation(() => {
      throw new Error('Fictional storage implementation detail');
    });
    expect(() => readProject(storage)).toThrow(/nicht lesbar/);
  });
  it('rejects an archive snapshot without a stable archive ID', () => {
    const storage = memoryStorage();
    storage.setItem(
      ARCHIVE_KEY,
      JSON.stringify([{ ...sourceProject(), archive: { at: '2027-04-01' } }]),
    );
    expect(() => readArchives(storage)).toThrow(/nicht lesbar/);
  });
});

describe('standalone local HTML exports and fictional demo integration', () => {
  const template =
    '<!DOCTYPE html><html data-offline="true"><head><title>Offline planner</title></head><body><div id="root"></div><script>window.__APP_LOADED=true;</script></body></html>';
  it('escapes script-closing text and can be re-exported without duplicate boot data', () => {
    const project = sourceProject();
    project.name = 'Fiktiv $& </script><script>throw new Error("never");</script>';
    const first = bundleHtml(template, project);
    project.name = 'Second fictional $& <safe>';
    const second = bundleHtml(first, project),
      parsed = new DOMParser().parseFromString(second, 'text/html');
    expect(parsed.querySelectorAll('#boot-data')).toHaveLength(1);
    expect(parsed.querySelectorAll('script')).toHaveLength(2);
    expect(second).toContain('\\u003csafe>');
    expect(first).toContain('\\u003c/script>');
    const script = parsed.getElementById('boot-data')?.textContent ?? '';
    const embedded = JSON.parse(script.slice('window.__BOOTDATA='.length, -1));
    expect(normalizeProject(embedded)).toEqual(project);
    expect(parsed.querySelector('script')?.id).toBe('boot-data');
  });
  it('rejects incomplete/non-offline templates without mutating the project', () => {
    const project = sourceProject(),
      before = structuredClone(project);
    expect(() => bundleHtml('<html><script></script></html>', project)).toThrow(/Produktionsbuild/);
    expect(() => bundleHtml('<html data-offline="true"><body></body></html>', project)).toThrow(
      /unvollständig/,
    );
    expect(project).toEqual(before);
  });
  it('demo contains only fictional local records and exercises connected cards with remaining people', () => {
    const project = demoProject();
    expect(project.persons.every((person) => person.mail?.endsWith('@example.invalid'))).toBe(true);
    expect(project.persons.every((person) => person.raw.Hinweis === 'Fiktive Testperson')).toBe(
      true,
    );
    expect(project.connections).toHaveLength(1);
    expect(project.dets).toHaveLength(2);
    expect(groupPeople(project, 'demo-main')).toHaveLength(4);
    expect(remainingPeople(project)).toHaveLength(2);
    expect(project.orderPolicy.mode).toBe('unconfirmed');
    expect(validateProject(project).map((issue) => issue.code)).toContain('policy-unconfirmed');
  });
});
