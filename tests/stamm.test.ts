// Master data (ADR-0001, stage S2) with wholly fictional values.
import { describe, expect, it } from 'vitest';
import {
  commanderSignature,
  createProject,
  kaderAbweichungen,
  kaderName,
  normalizeProject,
  normalizeStamm,
  splitLegacyName,
} from '../src/model';
import { buildOrder, createTbState, emptyWeek } from '../src/model/tagesbefehl';
import type { Person } from '../src/model/types';

const PNG_BASE64 = 'iVBORw0KGgoAAQ==';

/** A project as saved by the previous version (format v5). */
function v5Project(tbSettings?: Record<string, unknown>) {
  const { stamm: _stamm, ...rest } = createProject();
  return {
    ...rest,
    v: 5,
    settings: { eigeneEinheit: 'Fiktiv Kp 9/9', puffer: 60, nurMilo: false },
    ...(tbSettings ? { tb: { ...createTbState(), settings: tbSettings } } : {}),
  };
}

function person(patch: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    name: 'Beispiel Anna',
    grad: 'Hptm',
    funktion: 'Kommandant',
    lics: [],
    raw: {},
    vorname: 'Anna',
    nachname: 'Beispiel',
    planning: { status: 'included', reason: '' },
    ...patch,
  };
}

describe('master data in project format v6', () => {
  it('starts new projects with empty master data', () => {
    const project = createProject();
    expect(project.v).toBe(6);
    expect(project.stamm).toEqual({
      einheit: '',
      uebergeordneteEinheit: '',
      uebungsname: '',
      dateikuerzel: '',
      standort: '',
      klassifizierung: '',
      motto: '',
      nameOrder: 'vornameName',
      kader: [],
      grafiken: {},
    });
    expect(project.settings).not.toHaveProperty('eigeneEinheit');
  });

  it('moves the v5 unit, commander and file suffix into the master data once', () => {
    const input = v5Project({
      lk: 'LK fiktiv',
      kdtName: 'Hptm Hans Muster',
      kdtFunktion: 'Kommandant',
      gehtAn: [],
      zK: [],
      dienstleistung: 'WK_2031',
    });
    const before = structuredClone(input);
    const project = normalizeProject(input);
    expect(input).toEqual(before);
    expect(project.v).toBe(6);
    expect(project.stamm.einheit).toBe('Fiktiv Kp 9/9');
    expect(project.stamm.dateikuerzel).toBe('WK_2031');
    expect(project.stamm.kader).toEqual([
      {
        rolle: 'kdt',
        personId: '',
        grad: 'Hptm',
        vorname: 'Hans',
        name: 'Muster',
        funktion: 'Kommandant',
        pruefen: true,
      },
    ]);
    // The former fields are gone, so nothing is maintained twice.
    expect(project.settings).not.toHaveProperty('eigeneEinheit');
    expect(project.tb?.settings).toEqual({ lk: 'LK fiktiv', gehtAn: [], zK: [] });
    // Tagesbefehle are signed exactly as before the migration.
    const week = { ...emptyWeek('KVK'), startDate: '2031-01-06', days: ['Mo' as const] };
    expect(buildOrder(project, createTbState(), week, 'Mo').signature).toEqual({
      einheit: 'Fiktiv Kp 9/9',
      name: 'Hptm Hans Muster',
      funktion: 'Kommandant',
    });
    // Normalizing again keeps the migrated master data unchanged.
    expect(normalizeProject(JSON.parse(JSON.stringify(project)))).toEqual(project);
  });

  it('keeps the former defaults of v5 projects', () => {
    expect(normalizeProject(v5Project()).stamm.dateikuerzel).toBe('');
    // A v5 Tagesbefehl state without a stored suffix used FDT_2026.
    expect(normalizeProject(v5Project({ lk: 'LK' })).stamm.dateikuerzel).toBe('FDT_2026');
    // A changed function without a name is not lost.
    expect(
      normalizeProject(v5Project({ kdtName: '', kdtFunktion: 'Kdt a i' })).stamm.kader,
    ).toEqual([
      { rolle: 'kdt', personId: '', grad: '', vorname: '', name: '', funktion: 'Kdt a i' },
    ]);
    expect(
      normalizeProject(v5Project({ kdtName: '', kdtFunktion: 'Kommandant' })).stamm.kader,
    ).toEqual([]);
  });

  it('prefers stored master data over leftover v5 fields', () => {
    const project = createProject();
    project.stamm.einheit = 'Neue Fiktiv Kp';
    const loaded = normalizeProject({
      ...project,
      settings: { ...project.settings, eigeneEinheit: 'Alte Fiktiv Kp' },
    });
    expect(loaded.stamm.einheit).toBe('Neue Fiktiv Kp');
    expect(loaded.settings).not.toHaveProperty('eigeneEinheit');
  });

  it('tolerates broken master data parts instead of rejecting the project', () => {
    const stamm = normalizeStamm({
      einheit: 12,
      nameOrder: 'quer',
      kader: [
        { rolle: 'kdt', grad: 'Maj', vorname: 'Eva', name: 'Fiktiv', funktion: 'Kdt' },
        { rolle: 'kdt', grad: 'doppelt' },
        { rolle: 'chef' },
        'kein Objekt',
      ],
      grafiken: { unterschrift: { base64: 'nicht base64!' }, wappen: { base64: PNG_BASE64 } },
    });
    expect(stamm.einheit).toBe('12');
    expect(stamm.nameOrder).toBe('vornameName');
    expect(stamm.kader).toHaveLength(1);
    expect(stamm.kader[0].grad).toBe('Maj');
    expect(stamm.grafiken).toEqual({ wappen: { name: '', base64: PNG_BASE64, savedAt: '' } });
    expect(normalizeProject({ ...createProject(), stamm: 'kaputt' }).stamm.kader).toEqual([]);
  });
});

describe('commander names', () => {
  it.each(['Hptm Hans Muster', 'Oblt Anna Maria Beispiel', 'Hans Muster', 'Muster', 'Hptm'])(
    'splits «%s» losslessly',
    (text) => {
      const entry = { rolle: 'kdt' as const, personId: '', funktion: '', ...splitLegacyName(text) };
      expect(kaderName(entry, 'vornameName')).toBe(text);
    },
  );

  it('writes names in the chosen order and keeps the default function', () => {
    const entry = {
      rolle: 'kdt' as const,
      personId: '',
      grad: 'Hptm',
      vorname: 'Hans',
      name: 'Muster',
      funktion: 'Kommandant',
    };
    expect(kaderName(entry, 'nameVorname')).toBe('Hptm Muster Hans');
    const stamm = normalizeStamm({ kader: [entry], nameOrder: 'nameVorname' });
    expect(commanderSignature(stamm)).toEqual({ name: 'Hptm Muster Hans', funktion: 'Kommandant' });
    expect(commanderSignature(normalizeStamm({}))).toEqual({ name: '', funktion: 'Kommandant' });
  });

  it('reports differences to the linked person instead of overwriting them', () => {
    const entry = {
      rolle: 'kdt' as const,
      personId: 'p1',
      grad: 'Hptm',
      vorname: 'Anna',
      name: 'Beispiel',
      funktion: 'Kommandant',
    };
    expect(kaderAbweichungen(entry, [person()])).toEqual([]);
    expect(kaderAbweichungen(entry, [person({ grad: 'Maj' })])).toEqual(['Grad']);
    expect(kaderAbweichungen(entry, [])).toEqual(['Person nicht mehr in der Personenliste']);
    expect(kaderAbweichungen({ ...entry, personId: '' }, [])).toEqual([]);
  });
});
