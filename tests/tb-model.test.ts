// Wholly fictional persons, units and schedule entries.
import { describe, expect, it } from 'vitest';
import { createProject, normalizeProject } from '../src/model';
import {
  applyRules,
  buildOrder,
  buildOrders,
  createTbState,
  DEFAULT_TB_RULES,
  eligibleOfficers,
  emptyWeek,
  normalizeTbState,
  officerLines,
  rotationOfficer,
  rotationOrder,
  type TbEntry,
  type TbState,
  type TbWeek,
  weekFileLabel,
} from '../src/model/tagesbefehl';
import type { Person, Project } from '../src/model/types';

const UNIT = 'Fiktiv Kp 99/9';

function person(id: string, grad: string, patch: Partial<Person> = {}): Person {
  return {
    id,
    name: `Fiktiv ${id}`,
    vorname: 'Test',
    nachname: `Fiktiv${id.toUpperCase()}`,
    grad,
    funktion: 'Zugführer',
    lics: [],
    raw: {},
    einteilung: UNIT,
    tel: `+41 00 000 00 0${id.length}`,
    planning: { status: 'included', reason: '' },
    ...patch,
  };
}
function project(): Project {
  const value = createProject();
  value.settings.eigeneEinheit = UNIT;
  value.persons = [
    person('a', 'Lt'),
    person('b', 'Oblt'),
    person('c', 'Lt', { tel: '' }),
    person('kdt', 'Hptm', { funktion: 'Kommandant' }),
    person('stv', 'Oblt', { funktion: 'Kommandant Stellvertreter' }),
    person('other', 'Lt', { einteilung: 'Fiktiv Kp 11/1' }),
    person('sdt', 'Sdt'),
  ];
  return value;
}
function entry(id: string, patch: Partial<TbEntry>): TbEntry {
  return {
    id,
    day: 'Mo',
    section: 'dienstbetrieb',
    group: '',
    zeit: '',
    taetigkeit: '',
    verantwortlich: '',
    ort: '',
    ...patch,
  };
}
function week(sheet: string, startDate: string, days: TbWeek['days']): TbWeek {
  return { ...emptyWeek(sheet), startDate, days };
}

describe('Tagesbefehl state normalisation', () => {
  it('loads an old project without tb unchanged and keeps it optional', () => {
    const old = createProject() as Record<string, unknown>;
    delete old.tb;
    const loaded = normalizeProject(JSON.parse(JSON.stringify(old)));
    expect(loaded.tb).toBeUndefined();
    expect(normalizeProject(loaded)).toEqual(loaded);
  });

  it('tolerates garbage inside tb instead of rejecting the project', () => {
    const input = {
      ...createProject(),
      tb: {
        settings: { lk: 7, kdtName: null, gehtAn: 'kein Array' },
        regeln: 'kaputt',
        wochen: {
          KVK: {
            entries: [
              { day: 'Xx', taetigkeit: 'verworfen' },
              { day: 'Mo', section: 'unbekannt', group: 'G', zeit: 830, taetigkeit: 'Fiktiv' },
              'kein Objekt',
            ],
            days: ['Mo', 'Zz', 'Sa'],
            startDate: '07.01.2030',
            firstNumber: -3,
            parseConflicts: [{ day: 'Mo', id: 'x', entryIds: 'kaputt' }, { day: 'Nope' }],
            officers: { Mo: { personId: 'a' }, Zz: {} },
            wachtOf: { Sa: ['Fiktiv Wacht Of', 3] },
          },
        },
        offiziere: ['a', 3, null, 'b'],
        rotationStart: 'x',
      },
    };
    const loaded = normalizeProject(input);
    const tb = loaded.tb as TbState;
    expect(tb.settings.lk).toBe('7');
    expect(tb.settings.kdtName).toBe('');
    expect(tb.settings.gehtAn).toEqual(createTbState().settings.gehtAn);
    expect(tb.regeln).toEqual([...DEFAULT_TB_RULES]);
    const kvk = tb.wochen.KVK;
    expect(kvk.entries).toHaveLength(1);
    expect(kvk.entries[0]).toMatchObject({
      day: 'Mo',
      section: 'besonderes',
      group: '',
      zeit: '830',
    });
    expect(kvk.days).toEqual(['Mo', 'Sa']);
    expect(kvk.startDate).toBe('');
    expect(kvk.firstNumber).toBe(1);
    expect(kvk.parseConflicts).toEqual([
      { id: 'x', day: 'Mo', type: '', message: '', entryIds: [] },
    ]);
    expect(kvk.officers).toEqual({ Mo: { personId: 'a', text: '', tel: '' } });
    expect(kvk.wachtOf).toEqual({ Sa: ['Fiktiv Wacht Of'] });
    expect(tb.offiziere).toEqual(['a', 'b']);
    expect(tb.offiziereEntfernt).toEqual([]);
    expect(tb.rotationStart).toBe(0);
    expect(normalizeTbState(null)).toEqual(createTbState());
    expect(normalizeTbState('kaputt')).toEqual(createTbState());
  });

  it('starts with empty personal data and the documented defaults', () => {
    const tb = createTbState();
    expect(tb.settings.kdtName).toBe('');
    expect(tb.settings.lk).toBe('LK 1:50 000, Bl 217, 227');
    expect(tb.wochen).toEqual({});
    expect(tb.offiziere).toEqual([]);
  });
});

describe('default Verantwortlich / Ort rules', () => {
  const rules = DEFAULT_TB_RULES;
  it('fills only empty fields from the first matching rule', () => {
    expect(applyRules({ taetigkeit: 'MoE', verantwortlich: '', ort: '' }, rules)).toMatchObject({
      verantwortlich: 'Einh Four',
      ort: 'Ukft',
    });
    expect(
      applyRules({ taetigkeit: 'Tagwache', verantwortlich: 'Fiktiv Fw', ort: '' }, rules),
    ).toMatchObject({ verantwortlich: 'Fiktiv Fw', ort: 'Ukft' });
    const full = { taetigkeit: 'AV', verantwortlich: 'X', ort: 'Y' };
    expect(applyRules(full, rules)).toBe(full);
  });

  it('matches keywords at word starts only', () => {
    expect(
      applyRules({ taetigkeit: 'AVOR Kader', verantwortlich: '', ort: '' }, rules),
    ).toMatchObject({ verantwortlich: 'Kp Kdt', ort: 'Ukft' });
    expect(applyRules({ taetigkeit: 'AV / HV', verantwortlich: '', ort: '' }, rules)).toMatchObject(
      {
        ort: 'AV Platz',
      },
    );
    expect(
      applyRules({ taetigkeit: 'Fiktive Ausbildung', verantwortlich: '', ort: '' }, rules),
    ).toMatchObject({ verantwortlich: '', ort: '' });
  });

  it('uses the Leitung fallback only for boxes of that Leitung', () => {
    const blue = {
      taetigkeit: 'Fiktiver Bat Anlass',
      verantwortlich: '',
      ort: '',
      source: { leitung: 'bat' as const },
    };
    expect(applyRules(blue, rules)).toMatchObject({ verantwortlich: 'Bat', ort: 'gem Bat' });
    expect(applyRules({ ...blue, source: { leitung: 'kp' as const } }, rules)).toMatchObject({
      verantwortlich: '',
    });
    // Specific rules win over the Leitung fallback.
    expect(applyRules({ ...blue, taetigkeit: 'MiE' }, rules)).toMatchObject({
      verantwortlich: 'Einh Four',
    });
  });
});

describe('Tagesoffizier rotation', () => {
  function rotationState(): TbState {
    const tb = createTbState();
    tb.offiziere = ['a', 'b', 'c'];
    // Inserted out of date order on purpose: the rotation follows the dates.
    tb.wochen['Wo 1'] = week('Wo 1', '2030-01-14', ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']);
    tb.wochen.KVK = week('KVK', '2030-01-07', ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
    return tb;
  }

  it('selects only Lt/Oblt of the own unit without Kdt and Kdt Stv', () => {
    expect(eligibleOfficers(project()).map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('continues across weeks in date order and skips weekends', () => {
    const p = project(),
      tb = rotationState();
    expect(
      ['Mo', 'Di', 'Mi', 'Do', 'Fr'].map((d) => rotationOfficer(p, tb, 'KVK', d as 'Mo')),
    ).toEqual(['a', 'b', 'c', 'a', 'b']);
    expect(rotationOfficer(p, tb, 'KVK', 'Sa')).toBe('');
    expect(rotationOfficer(p, tb, 'Wo 1', 'Mo')).toBe('c');
    tb.rotationStart = 1;
    expect(rotationOfficer(p, tb, 'KVK', 'Mo')).toBe('b');
    expect(rotationOfficer(p, tb, 'Wo 1', 'Mo')).toBe('a');
  });

  it('puts planned officers into the rotation without any manual list', () => {
    const p = project(),
      tb = rotationState();
    tb.offiziere = [];
    expect(rotationOrder(p, tb)).toEqual(['a', 'b', 'c']);
    expect(rotationOfficer(p, tb, 'KVK', 'Mo')).toBe('a');
    expect(officerLines(p, tb, tb.wochen.KVK, 'Di')).toEqual([
      'Oblt Test FiktivB',
      '+41 00 000 00 01',
    ]);
  });

  it('keeps a fixed order first, appends new planned officers and honours removals', () => {
    const p = project(),
      tb = rotationState();
    tb.offiziere = ['c', 'sdt'];
    tb.offiziereEntfernt = ['b'];
    expect(rotationOrder(p, tb)).toEqual(['c', 'sdt', 'a']);
    p.persons.push(person('d', 'Lt'));
    expect(rotationOrder(p, tb)).toEqual(['c', 'sdt', 'a', 'd']);
    // Persons marked as not planned leave the rotation, even when fixed by hand.
    (p.persons.find((x) => x.id === 'c') as Person).planning.status = 'excluded';
    expect(rotationOrder(p, tb)).toEqual(['sdt', 'a', 'd']);
  });

  it('matches common spellings of grade, unit and commander functions', () => {
    const p = project();
    p.persons = [
      person('dot', 'Oblt.'),
      person('long', 'Oberleutnant'),
      person('lower', 'lt', { einteilung: 'fiktiv kp 99 / 9' }),
      person('nounit', 'Lt', { einteilung: '' }),
      person('stv1', 'Oblt', { funktion: 'Kdt Stv' }),
      person('stv2', 'Oblt', { funktion: 'Stv Kdt' }),
      person('stv3', 'Oblt', { funktion: 'Kommandant-Stellvertreter' }),
      person('away', 'Lt', { planning: { status: 'excluded', reason: 'Fiktiv' } }),
      person('foreign', 'Lt', { einteilung: 'Fiktiv Kp 11/1' }),
      person('wm', 'Wm'),
    ];
    expect(eligibleOfficers(p).map((x) => x.id)).toEqual(['dot', 'long', 'lower', 'nounit']);
  });

  it('applies per-day overrides, free text and weekend Wacht Of lines', () => {
    const p = project(),
      tb = rotationState(),
      kvk = tb.wochen.KVK;
    expect(officerLines(p, tb, kvk, 'Mo')).toEqual(['Lt Test FiktivA', '+41 00 000 00 01']);
    kvk.officers.Di = { personId: 'c', text: '', tel: '+41 00 000 00 99' };
    expect(officerLines(p, tb, kvk, 'Di')).toEqual(['Lt Test FiktivC', '+41 00 000 00 99']);
    kvk.officers.Mi = { personId: '', text: 'Lt Fiktiv Gast, Fiktiv Kp 11/1', tel: '' };
    expect(officerLines(p, tb, kvk, 'Mi')).toEqual(['Lt Fiktiv Gast, Fiktiv Kp 11/1']);
    kvk.officers.Do = { personId: '', text: '', tel: '' };
    expect(officerLines(p, tb, kvk, 'Do')).toEqual(['Lt Test FiktivA', '+41 00 000 00 01']);
    kvk.wachtOf.Sa = ['Wacht Of Fiktiv Kp 11/1', 'Tel folgt'];
    expect(officerLines(p, tb, kvk, 'Sa')).toEqual(['Wacht Of Fiktiv Kp 11/1', 'Tel folgt']);
    expect(officerLines(p, tb, kvk, 'So')).toEqual([]);
  });
});

describe('order builder', () => {
  function orderFixture() {
    const p = project(),
      tb = createTbState();
    tb.settings.kdtName = 'Hptm Test Fiktiv';
    tb.settings.zK = ['Kdt Fiktiv Bat 99'];
    const kvk = week('KVK', '2030-01-07', ['Mo', 'Mi', 'Sa']);
    kvk.firstNumber = 1;
    kvk.groups = { Mi: ['Zug Zwei', 'Zug Eins'] };
    kvk.entries = [
      entry('m1', { day: 'Mi', group: 'Zug Eins', zeit: '0800', taetigkeit: 'Fiktiv A' }),
      entry('m2', { day: 'Mi', zeit: '0600', taetigkeit: 'Tagwache' }),
      entry('m3', { day: 'Mi', section: 'rapporte', zeit: '1700', taetigkeit: 'KR' }),
      entry('m4', { day: 'Mi', group: 'Zug Zwei', zeit: '0900', taetigkeit: 'Fiktiv B' }),
      entry('m5', { day: 'Mi', section: 'besonderes', taetigkeit: 'Fiktiver Besuch' }),
      entry('m6', { day: 'Mi', group: 'Zug Drei', taetigkeit: 'Fiktiv C' }),
      entry('s1', { day: 'Sa', zeit: '0800', taetigkeit: 'Fiktiver Sport' }),
      entry('s2', { day: 'Sa', section: 'rapporte', taetigkeit: 'Nicht gedruckt' }),
    ];
    tb.wochen.KVK = kvk;
    return { p, tb, kvk };
  }

  it('orders sections, known groups before new groups, and numbers from Monday', () => {
    const { p, tb, kvk } = orderFixture();
    const order = buildOrder(p, tb, kvk, 'Mi');
    expect(order.title).toBe('Tagesbefehl Nr 3 für Mittwoch, 09.01.2030');
    expect(order.index).toBe(3);
    expect(order.date).toBe('2030-01-09');
    expect(
      order.blocks.map((block) => (block.kind === 'entry' ? block.entryId : block.heading)),
    ).toEqual([
      '1 Dienstbetrieb / Ausbildung',
      'm2',
      'Zug Zwei',
      'm4',
      'Zug Eins',
      'm1',
      'Zug Drei',
      'm6',
      '2 Besonderes',
      'm5',
      '3 Rapporte',
      'm3',
    ]);
    expect(order.officer.label).toBe('Tagesoffizier');
    expect(order.signature).toEqual({
      einheit: UNIT,
      name: 'Hptm Test Fiktiv',
      funktion: 'Kommandant',
    });
  });

  it('replaces the {Einheit} placeholder in the Verteiler and omits Rapporte on weekends', () => {
    const { p, tb, kvk } = orderFixture();
    const orders = buildOrders(p, tb, kvk);
    expect(orders.map((order) => order.day)).toEqual(['Mo', 'Mi', 'Sa']);
    expect(orders[0].verteiler).toEqual({
      gehtAn: [`Kader ${UNIT}`, `${UNIT} (via Anschlag)`],
      zK: ['Kdt Fiktiv Bat 99'],
    });
    const saturday = orders[2];
    expect(saturday.weekend).toBe(true);
    expect(saturday.number).toBe(6);
    expect(saturday.officer.label).toBe('Wochenend Wacht Of');
    expect(saturday.blocks.map((b) => (b.kind === 'entry' ? b.entryId : b.heading))).toEqual([
      '1 Dienstbetrieb / Ausbildung',
      's1',
      '2 Besonderes',
    ]);
  });

  it('keeps the title without a date until the start date is known', () => {
    const { p, tb, kvk } = orderFixture();
    kvk.startDate = '';
    expect(buildOrder(p, tb, kvk, 'Mo').title).toBe('Tagesbefehl Nr 1 für Montag');
    expect(weekFileLabel('Wo 1')).toBe('Wo_1');
  });
});
