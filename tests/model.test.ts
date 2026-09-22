import { describe, expect, it } from 'vitest';
import type { Person, Project } from '../src/model';
import {
  archiveSnapshot,
  assignPeople,
  connectGroups,
  createDetachment,
  createProject,
  derivePisa,
  directGroupIds,
  disconnectGroups,
  entrySignature,
  generatedEntryId,
  groupPeople,
  normalizeProject,
  projectSignature,
  remainingPeople,
  removePeople,
  resumeProject,
  validateProject,
  validEc,
} from '../src/model';

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error('Expected fictional fixture value.');
  return value;
}
function person(id: string): Person {
  return {
    id,
    name: `Fiktiv ${id}`,
    pnr: `TEST-${id}`,
    grad: 'Wm',
    funktion: 'Motf',
    lics: ['30'],
    raw: { Fictional: 'yes' },
    planning: { status: 'included', reason: '' },
  };
}
function fixture(): Project {
  const project = createProject();
  project.persons = [person('a'), person('b'), person('c')];
  const shared = {
    von: '08:00',
    ort: 'Testort',
    treffpunkt: 'Testtor',
    anzug: 'Testanzug',
    entlassungsort: 'Testort',
  };
  project.dets = [
    createDetachment({
      ...shared,
      id: 'kvk',
      name: 'KVK',
      ec: 'K1',
      datum: '2027-05-01',
      bisDatum: '2027-05-02',
    }),
    createDetachment({
      ...shared,
      id: 'wk',
      name: 'WK',
      ec: 'W1',
      datum: '2027-05-03',
      bisDatum: '2027-05-21',
    }),
  ];
  project.assign = { kvk: ['a'], wk: ['b', 'c'] };
  return project;
}
function confirmed(mode: 'separate' | 'continuous' = 'separate'): Project {
  const project = fixture();
  project.orderPolicy = { mode, confirmedBy: 'Fiktive KF-Bestätigung', confirmedAt: '2027-04-01' };
  connectGroups(project, 'kvk', 'wk');
  for (const entry of derivePisa(project).filter((entry) => entry.generated))
    project.generatedCodes[entry.id] = 'W2';
  return project;
}
const codes = (project: Project) => validateProject(project).map((issue) => issue.code);

describe('local project boundary and historical files', () => {
  it.each([2, 3, 4])(
    'migrates v%i without merging namesakes or ambiguous assignments',
    (version) => {
      const input = { ...fixture(), v: version, unknownExtension: { keep: true } };
      input.persons[1].name = input.persons[0].name;
      input.persons[0].raw.Preserve = 'yes';
      input.assign.wk.push('a');
      const result = normalizeProject(input);
      expect(result.v).toBe(5);
      expect(result.persons).toHaveLength(3);
      expect(result.unknownExtension).toEqual({ keep: true });
      expect(result.persons[0].raw.Preserve).toBe('yes');
      expect(directGroupIds(result, 'a')).toEqual(['kvk', 'wk']);
      expect(codes(result)).toContain('multiple-assignments');
      expect(input.v).toBe(version);
    },
  );
  it('adds missing planning defaults and preserves future person fields', () => {
    const result = normalizeProject({
      persons: [{ id: 'a', customValue: { nested: 1 }, pnr: 123 }],
      dets: [],
    });
    expect(result.persons[0].planning).toEqual({ status: 'unreviewed', reason: '' });
    expect(result.persons[0].customValue).toEqual({ nested: 1 });
    expect(result.persons[0].pnr).toBe('123');
  });
  it('never selects an order interpretation based on legacy periods', () => {
    const result = normalizeProject({ v: 4, persons: [], dets: fixture().dets });
    expect(result.orderPolicy.mode).toBe('unconfirmed');
    expect(result.connections).toEqual([]);
  });
  it('preserves legacy Zusatz relationships, cohort metadata and direct assignments', () => {
    const input = fixture();
    input.dets[1].zusatzIds = ['kvk'];
    input.dets[1].generatedFrom = 'original-main';
    input.assign.kvk = [];
    input.assign.wk = ['a'];
    const result = normalizeProject({ ...input, v: 4 });
    expect(result.dets[1].generatedFrom).toBe('original-main');
    expect(result.assign.wk).toEqual(['a']);
    expect(result.dets[1].zusatzIds).toEqual(['kvk']);
    expect(result.migrationNotes).toHaveLength(1);
    expect(groupPeople(result, 'kvk').map((value) => value.id)).toEqual(['a']);
    expect(derivePisa(result).find((value) => value.id === 'kvk')?.personIds).toEqual([]);
    expect(normalizeProject(result).migrationNotes).toHaveLength(1);
  });
  it.each([
    { persons: [{ id: 'x' }, { id: 'x' }] },
    { persons: [{}] },
    { persons: [], dets: [{ id: 'x' }, { id: 'x' }] },
    { persons: [], assign: { x: 'a' } },
    { persons: [], assign: { x: [1] } },
    { persons: [{ id: '__proto__' }] },
    { persons: [], dets: 'wrong' },
    { persons: [], connections: {} },
    { persons: [], v: 6 },
  ])('rejects invalid structures atomically', (input) => {
    const before = structuredClone(input);
    expect(() => normalizeProject(input)).toThrow();
    expect(input).toEqual(before);
  });
  it('preserves dangling references for visible repair instead of losing evidence', () => {
    const input = fixture();
    input.assign.kvk.push('missing');
    const result = normalizeProject(input);
    expect(result.assign.kvk).toContain('missing');
    expect(codes(result)).toContain('missing-person');
  });
  it('deep copies input rather than sharing imported nested structures', () => {
    const input = fixture(),
      result = normalizeProject(input);
    result.persons[0].raw.Fictional = 'changed';
    expect(input.persons[0].raw.Fictional).toBe('yes');
  });
  it('preserves prototype-named raw fields as data without changing object prototypes', () => {
    const input = JSON.parse(
      '{"persons":[{"id":"a","raw":{"__proto__":"fictional source value","constructor":"fictional constructor","toString":"fictional text"}}],"dets":[],"__proto__":{"polluted":"never"}}',
    );
    const project = normalizeProject(input);
    expect(Object.hasOwn(project.persons[0].raw, '__proto__')).toBe(true);
    expect(Object.getOwnPropertyDescriptor(project.persons[0].raw, '__proto__')?.value).toBe(
      'fictional source value',
    );
    expect(Object.getPrototypeOf(project)).toBe(Object.prototype);
    expect(Object.hasOwn(Object.prototype, 'polluted')).toBe(false);
  });
  it('creates real empty assignments for historically valid prototype-named group IDs', () => {
    const project = normalizeProject({
      persons: [],
      dets: [{ id: 'toString', name: 'Fiktive Gruppe' }],
    });
    expect(Object.hasOwn(project.assign, 'toString')).toBe(true);
    expect(project.assign.toString).toEqual([]);
    expect(groupPeople(project, 'toString')).toEqual([]);
  });
});

describe('one planning board', () => {
  it('creates cards and assigns people before entering details', () => {
    const project = createProject(),
      card = createDetachment({ id: 'draft', name: 'Fiktive Gruppe' });
    project.dets.push(card);
    project.persons.push(person('a'));
    assignPeople(project, card.id, ['a']);
    expect(card.datum).toBe('');
    expect(card.ec).toBe('');
    expect(groupPeople(project, card.id)).toHaveLength(1);
    expect(codes(project)).toContain('missing-details');
  });
  it('moves a selection once and preserves existing planning notes', () => {
    const project = fixture();
    project.persons[0].planning.reason = 'Fiktive Notiz';
    assignPeople(project, 'wk', ['a', 'a']);
    expect(project.assign.kvk).toEqual([]);
    expect(project.assign.wk).toEqual(['b', 'c', 'a']);
    expect(project.persons[0].planning.reason).toBe('Fiktive Notiz');
  });
  it('explicit reassignment reincludes excluded people and clears obsolete exclusion reason', () => {
    const project = fixture();
    project.persons[0].planning = { status: 'excluded', reason: 'Fiktiver Ausschluss' };
    assignPeople(project, 'wk', ['a']);
    expect(project.persons[0].planning).toEqual({ status: 'included', reason: '' });
  });
  it('rejects missing selected people before changing any assignments', () => {
    const project = fixture(),
      before = structuredClone(project);
    expect(() => assignPeople(project, 'wk', ['a', 'missing'])).toThrow();
    expect(project).toEqual(before);
  });
  it('remaining people exclude excluded records but retain unreviewed people for explicit selection', () => {
    const project = fixture();
    project.assign = {};
    project.persons[0].planning.status = 'excluded';
    project.persons[1].planning.status = 'unreviewed';
    expect(remainingPeople(project).map((value) => value.id)).toEqual(['b', 'c']);
  });
  it('connection keeps two cards and adds inherited people without moving source membership', () => {
    const project = fixture();
    connectGroups(project, 'kvk', 'wk');
    expect(project.dets).toHaveLength(2);
    expect(project.assign).toEqual({ kvk: ['a'], wk: ['b', 'c'] });
    expect(groupPeople(project, 'wk').map((value) => value.id)).toEqual(['a', 'b', 'c']);
    disconnectGroups(project, project.connections[0].id);
    expect(groupPeople(project, 'wk').map((value) => value.id)).toEqual(['b', 'c']);
    expect(project.assign.kvk).toEqual(['a']);
  });
  it('resolves only source/chosen destination legacy overlap', () => {
    const project = fixture();
    project.assign.wk.push('a');
    connectGroups(project, 'kvk', 'wk');
    expect(project.assign.kvk).toEqual(['a']);
    expect(project.assign.wk).toEqual(['b', 'c']);
    expect(groupPeople(project, 'wk')).toHaveLength(3);
  });
  it.each(['missing', 'excluded', 'other'])(
    'does not change a blocked connection (%s)',
    (problem) => {
      const project = fixture();
      if (problem === 'missing') project.assign.kvk.push('missing');
      if (problem === 'excluded') project.persons[0].planning.status = 'excluded';
      if (problem === 'other') {
        project.dets.push(createDetachment({ id: 'other' }));
        project.assign.other = ['a'];
      }
      const before = structuredClone(project);
      expect(() => connectGroups(project, 'kvk', 'wk')).toThrow();
      expect(project).toEqual(before);
    },
  );
  it('allows repeated identical connection without duplicating it', () => {
    const project = fixture();
    connectGroups(project, 'kvk', 'wk');
    connectGroups(project, 'kvk', 'wk');
    expect(project.connections).toHaveLength(1);
  });
  it('blocks cycles, chains and more than one onward destination', () => {
    const project = fixture();
    project.dets.push(createDetachment({ id: 'third' }));
    connectGroups(project, 'kvk', 'wk');
    expect(() => connectGroups(project, 'wk', 'kvk')).toThrow();
    expect(() => connectGroups(project, 'wk', 'third')).toThrow(/Verbindungsketten/);
    expect(() => connectGroups(project, 'kvk', 'third')).toThrow(/bereits/);
  });
  it('does not combine legacy explicit Zusatz relationships with new progression links', () => {
    const project = fixture();
    project.dets[1].zusatzIds = ['kvk'];
    expect(() => connectGroups(project, 'kvk', 'wk')).toThrow(/Alte und neue/);
  });
  it('removing a direct assignment does not silently change participation', () => {
    const project = fixture();
    removePeople(project, 'kvk', ['a']);
    expect(project.persons[0].planning.status).toBe('included');
    expect(codes(project)).toContain('person-unassigned');
  });
});

describe('PISA projection and confirmation', () => {
  it('does not infer a KVK/WK policy from a connection', () => {
    const project = fixture();
    connectGroups(project, 'kvk', 'wk');
    expect(project.orderPolicy.mode).toBe('unconfirmed');
    expect(derivePisa(project)).toHaveLength(2);
    expect(derivePisa(project).every((entry) => !entry.generated)).toBe(true);
    expect(codes(project)).toContain('policy-unconfirmed');
  });
  it('separate mode creates zero-person extra plus distinct ordinary and KVK/WK main cohorts', () => {
    const project = confirmed(),
      entries = derivePisa(project);
    expect(entries).toHaveLength(3);
    expect(entries.find((entry) => entry.id === 'kvk')).toMatchObject({
      kind: 'additional',
      personIds: [],
      extraIds: [],
    });
    expect(entries.find((entry) => entry.id === 'wk')).toMatchObject({
      kind: 'main',
      personIds: ['b', 'c'],
      extraIds: [],
    });
    expect(entries.find((entry) => entry.generated)).toMatchObject({
      ec: 'W2',
      personIds: ['a'],
      extraIds: ['kvk'],
      details: { datum: '2027-05-03', bisDatum: '2027-05-21' },
    });
    expect(validateProject(project)).toEqual([]);
  });
  it('continuous mode derives a covering order from initial reporting details and final release', () => {
    const project = confirmed('continuous');
    project.dets[0].ort = 'Früher Testort';
    const entries = derivePisa(project),
      combined = required(entries.find((entry) => entry.generated));
    expect(entries).toHaveLength(2);
    expect(combined.extraIds).toEqual([]);
    expect(combined.personIds).toEqual(['a']);
    expect(combined.details).toMatchObject({
      datum: '2027-05-01',
      ort: 'Früher Testort',
      bisDatum: '2027-05-21',
      entlassungsort: 'Testort',
    });
    expect(validateProject(project)).toEqual([]);
  });
  it('derivation is pure and editing shared main details updates every generated main cohort', () => {
    const project = confirmed(),
      before = structuredClone(project);
    derivePisa(project);
    expect(project).toEqual(before);
    project.dets[1].ort = 'Neuer Testort';
    expect(
      derivePisa(project)
        .filter((entry) => entry.kind === 'main')
        .every((entry) => entry.details.ort === 'Neuer Testort'),
    ).toBe(true);
  });
  it('generated codes stay bound to stable IDs after membership and card ordering change', () => {
    const project = confirmed(),
      entryId = required(derivePisa(project).find((entry) => entry.generated)).id;
    assignPeople(project, 'kvk', ['b']);
    project.dets.reverse();
    expect(derivePisa(project).find((entry) => entry.id === entryId)?.ec).toBe('W2');
    expect(generatedEntryId('x:y', ['a,b', 'c'], 'separate')).not.toBe(
      generatedEntryId('x:y', ['a', 'b,c'], 'separate'),
    );
  });
  it('omits an empty ordinary main when everyone arrives through a special card', () => {
    const project = confirmed();
    assignPeople(project, 'kvk', ['b', 'c']);
    const entries = derivePisa(project);
    expect(entries).toHaveLength(2);
    expect(entries.find((entry) => entry.kind === 'main')?.personIds).toHaveLength(3);
  });
  it('multiple special cards become independent cohorts with unique stable keys', () => {
    const project = confirmed();
    project.dets.push(
      createDetachment({ ...project.dets[0], id: 'drivers', name: 'Fahrer', ec: 'K2' }),
    );
    assignPeople(project, 'drivers', ['b']);
    connectGroups(project, 'drivers', 'wk');
    const generated = derivePisa(project).filter((entry) => entry.generated);
    expect(generated).toHaveLength(2);
    expect(new Set(generated.map((entry) => entry.id)).size).toBe(2);
    expect(generated.map((entry) => entry.personIds)).toEqual(
      expect.arrayContaining([['a'], ['b']]),
    );
  });
  it('mode without KF identity/date is not a confirmation', () => {
    const project = confirmed();
    project.orderPolicy.confirmedBy = '';
    expect(codes(project)).toContain('policy-unconfirmed');
    project.orderPolicy.confirmedBy = 'Fiktiv';
    project.orderPolicy.confirmedAt = '';
    expect(codes(project)).toContain('policy-unconfirmed');
  });
  it('entry markers invalidate on people, linked detail and policy changes', () => {
    const project = confirmed();
    const signature = () =>
      entrySignature(project, required(derivePisa(project).find((entry) => entry.generated)));
    const first = signature();
    project.dets[0].ort = 'Anderer Testort';
    expect(signature()).not.toBe(first);
    const second = signature();
    project.persons[0].pnr = 'TEST-NEW';
    expect(signature()).not.toBe(second);
    const third = signature();
    project.orderPolicy.confirmedAt = '2027-04-02';
    expect(signature()).not.toBe(third);
  });
  it('plan signature excludes acknowledgement bookkeeping but includes contact, assignments and details', () => {
    const project = confirmed(),
      signature = projectSignature(project);
    project.pisa.verified = { at: '2027-04-01', signature };
    project.pisa.entered.wk = { at: '2027-04-01', signature: 'test' };
    expect(projectSignature(project)).toBe(signature);
    project.persons[0].mail = 'test@example.invalid';
    expect(projectSignature(project)).not.toBe(signature);
  });
});

describe('completion checks and immutable snapshots', () => {
  it('validates allowed EC characters and duplicate case', () => {
    expect(validEc('£!')).toBe(true);
    expect(validEc('A_')).toBe(false);
    expect(validEc('ABC')).toBe(false);
    const project = fixture();
    project.dets[1].ec = 'k1';
    expect(codes(project)).toContain('duplicate-ec');
  });
  it('flags malformed dates, times, reversed periods and oversized remarks', () => {
    const project = fixture();
    Object.assign(project.dets[0], {
      datum: '2027-02-30',
      bisDatum: '2027-01-01',
      von: '25:00',
      bem: 'x'.repeat(241),
    });
    expect(codes(project)).toEqual(
      expect.arrayContaining([
        'invalid-date',
        'reversed-period',
        'invalid-time',
        'remark-too-long',
      ]),
    );
  });
  it('flags missing extras and more than five', () => {
    const project = fixture();
    project.dets[1].zusatzIds = ['one', 'two', 'three', 'four', 'five', 'six'];
    expect(codes(project)).toEqual(
      expect.arrayContaining(['too-many-extras', 'invalid-legacy-link']),
    );
  });
  it('flags imported connection chains without infinite traversal', () => {
    const project = fixture();
    project.connections = [
      { id: 'one', from: 'kvk', to: 'wk' },
      { id: 'two', from: 'wk', to: 'kvk' },
    ];
    expect(groupPeople(project, 'wk')).toHaveLength(3);
    expect(codes(project)).toContain('connection-chain');
  });
  it('flags duplicate canonical identifiers without merging them', () => {
    const project = fixture();
    project.persons[1].pnr = 'TEST.a';
    expect(
      validateProject(project).filter((issue) => issue.code === 'duplicate-number'),
    ).toHaveLength(2);
    expect(project.persons).toHaveLength(3);
  });
  it('flags unreviewed, excluded and identity states', () => {
    const project = fixture();
    project.persons[0].planning = { status: 'excluded', reason: '' };
    project.persons[1].planning.status = 'unreviewed';
    project.persons[2].identityReview = 'Fiktive Prüfung';
    expect(codes(project)).toEqual(
      expect.arrayContaining([
        'excluded-assigned',
        'excluded-reason',
        'participation-unreviewed',
        'identity-review',
      ]),
    );
  });
  it('archives without changing active input, and resumes an independent project', () => {
    const project = fixture(),
      snapshot = archiveSnapshot(project),
      working = resumeProject(snapshot);
    expect(project.archive).toBeNull();
    expect(snapshot.archive).not.toBeNull();
    expect(working.archive).toBeNull();
    expect(working.id).not.toBe(project.id);
    working.persons[0].name = 'Changed fictional name';
    expect(snapshot.persons[0].name).toBe('Fiktiv a');
    expect(archiveSnapshot(snapshot).archive).toEqual(snapshot.archive);
  });
  it('every domain mutation refuses an archived project atomically', () => {
    const snapshot = archiveSnapshot(confirmed()),
      before = structuredClone(snapshot);
    expect(() => assignPeople(snapshot, 'wk', ['a'])).toThrow(/Archiv/);
    expect(() => removePeople(snapshot, 'wk', ['b'])).toThrow(/Archiv/);
    expect(() => connectGroups(snapshot, 'kvk', 'wk')).toThrow(/Archiv/);
    expect(() => disconnectGroups(snapshot, snapshot.connections[0].id)).toThrow(/Archiv/);
    expect(snapshot).toEqual(before);
  });
});
