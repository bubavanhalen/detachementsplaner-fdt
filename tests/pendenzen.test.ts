// Wholly fictional fixtures only.
import { describe, expect, it } from 'vitest';
import {
  DONE_DIR,
  FAILED_DIR,
  GUIDE_FILE,
  INTAKE_DIR,
  type LocalDir,
  type LocalFile,
  moveIntakeFile,
  readIntake,
  STAND_FILE,
  writeStand,
} from '../src/io/austausch';
import {
  addPendenz,
  addPendenzNote,
  applyIntakeFiles,
  createDetachment,
  createProject,
  createStamm,
  EINGANG_FORMAT,
  effectivePhase,
  groupPendenzen,
  markPendenzenSeen,
  normalizeProject,
  pendenzenOf,
  pendenzSummary,
  resolveProposal,
  STAND_FORMAT,
  standDocument,
  updatePendenz,
  upsertPendenz,
} from '../src/model';
import type { Project } from '../src/model/types';

const NOW = '2026-10-20T08:00:00.000Z';
const LATER = '2026-10-20T09:00:00.000Z';
const LAST = '2026-10-20T10:00:00.000Z';
function fixture(): Project {
  const project = createProject();
  project.name = 'WK Fiktiv';
  project.persons = [
    {
      id: 'p1',
      name: 'Fiktiv Alpha',
      grad: 'Fw',
      funktion: 'Testfunktion',
      lics: [],
      raw: {},
      planning: { status: 'included', reason: '' },
    },
  ];
  project.dets = [createDetachment({ id: 'd1', name: 'KVK Fiktiv' })];
  project.assign = { d1: [] };
  return project;
}
const intake = (project: Project, changes: unknown[], agent = 'Mail-Agent') =>
  JSON.stringify({
    format: EINGANG_FORMAT,
    version: 1,
    projektId: project.id,
    agent,
    aenderungen: changes,
  });

describe('Pendenzen model', () => {
  it('creates, logs status changes and keeps old projects loadable', () => {
    const project = fixture();
    const pendenz = addPendenz(
      project,
      { titel: 'Unterkunft bestätigen', faellig: '2026-10-25' },
      NOW,
    );
    updatePendenz(project, pendenz.id, { status: 'wartet', zustaendig: 'Fw' }, { now: NOW });
    addPendenzNote(project, pendenz.id, 'Fw ruft morgen zurück.', NOW);
    const stored = pendenzenOf(project)[0];
    expect(stored.status).toBe('wartet');
    expect(stored.verlauf.map((entry) => entry.text)).toEqual([
      'Status: Offen → Wartet\nZuständig: Fw',
      'Fw ruft morgen zurück.',
    ]);
    const roundTrip = normalizeProject(JSON.parse(JSON.stringify(project)));
    expect(roundTrip.pendenzen).toEqual(project.pendenzen);
    expect(normalizeProject(JSON.parse(JSON.stringify(fixture()))).pendenzen).toBeUndefined();
  });

  it('rejects empty titles and drops unknown person links', () => {
    const project = fixture();
    expect(() => addPendenz(project, { titel: '  ' })).toThrow(/Titel/);
    const pendenz = addPendenz(project, {
      titel: 'X',
      personIds: ['p1', 'nobody'],
      detIds: ['d1', 'x'],
    });
    expect(pendenz.personIds).toEqual(['p1']);
    expect(pendenz.detIds).toEqual(['d1']);
  });

  it('groups by due date with agent changes first', () => {
    const project = fixture();
    addPendenz(project, { titel: 'Später', faellig: '2026-12-01' }, NOW);
    addPendenz(project, { titel: 'Überfällig', faellig: '2026-10-01' }, NOW);
    addPendenz(project, { titel: 'Heute', faellig: '2026-10-20' }, NOW);
    addPendenz(project, { titel: 'Ohne' }, NOW);
    const done = addPendenz(project, { titel: 'Fertig' }, NOW);
    updatePendenz(project, done.id, { status: 'erledigt' });
    applyIntakeFiles(project, [
      {
        datei: 'a.json',
        text: intake(project, [{ aktion: 'neu', pendenz: { titel: 'Vom Agent' } }]),
      },
    ]);
    const groups = groupPendenzen(pendenzenOf(project), '2026-10-20');
    expect(groups.map((group) => [group.group, group.items.map((item) => item.titel)])).toEqual([
      ['neu', ['Vom Agent']],
      ['ueberfaellig', ['Überfällig']],
      ['heute', ['Heute']],
      ['spaeter', ['Später']],
      ['ohne', ['Ohne']],
      ['zu', ['Fertig']],
    ]);
    expect(pendenzSummary(project, '2026-10-20')).toEqual({
      total: 6,
      active: 5,
      overdue: 1,
      neu: 1,
    });
  });
});

describe('agent intake', () => {
  it('creates items and applies changes made on the basis the agent saw', () => {
    const project = fixture();
    const own = addPendenz(project, { titel: 'Fahrzeugliste an Fw' }, NOW);
    const [first] = applyIntakeFiles(
      project,
      [
        {
          datei: '01.json',
          text: intake(project, [
            {
              aktion: 'neu',
              pendenz: { titel: 'Planner: Funkgeräte bestellen', personIds: ['p1'] },
              quelle: { kanal: 'planner', ref: 'TASK-1', von: 'Teams Planner' },
              notiz: 'Neu im Planner.',
            },
            {
              aktion: 'aendern',
              id: own.id,
              basis: own.geaendert,
              felder: { status: 'wartet', zustaendig: 'Fw' },
              notiz: 'Fw hat per WhatsApp zugesagt.',
              quelle: { kanal: 'whatsapp', ref: 'chat-1', von: 'Fw Fiktiv' },
            },
            { aktion: 'aendern', id: 'pendenz_unbekannt', felder: { status: 'erledigt' } },
          ]),
        },
      ],
      LATER,
    );
    expect(first).toMatchObject({
      status: 'angewendet',
      result: {
        neu: 1,
        geaendert: 1,
        konflikte: 0,
        uebersprungen: ['Änderung 3: Pendenz nicht gefunden.'],
      },
    });
    const updated = pendenzenOf(project).find((item) => item.id === own.id);
    expect(updated).toMatchObject({ status: 'wartet', zustaendig: 'Fw', neu: true });
    expect(updated?.vorschlag).toBeUndefined();
    expect(updated?.quellen.map((source) => source.kanal)).toEqual(['whatsapp']);
    expect(updated?.verlauf.at(-1)).toMatchObject({ autor: 'agent', agent: 'Mail-Agent' });
  });

  it('never silently overwrites a change the user made after the agent read the state', () => {
    const project = fixture();
    const own = addPendenz(project, { titel: 'Unterkunft bestätigen', zustaendig: 'ich' }, NOW);
    const seen = own.geaendert;
    // The user changes the status after the agent wrote its file.
    updatePendenz(project, own.id, { status: 'wartet' }, { now: LATER });
    applyIntakeFiles(
      project,
      [
        {
          datei: '01.json',
          text: intake(project, [
            {
              aktion: 'aendern',
              id: own.id,
              basis: seen,
              vorher: { status: 'offen', zustaendig: 'ich' },
              felder: { status: 'erledigt', zustaendig: 'Gemeinde' },
              notiz: 'Gemeinde bestätigt per Mail.',
            },
          ]),
        },
      ],
      LAST,
    );
    const stored = pendenzenOf(project)[0];
    // «zustaendig» was still what the agent saw, «status» was not.
    expect(stored).toMatchObject({ status: 'wartet', zustaendig: 'Gemeinde', neu: true });
    expect(stored.vorschlag).toMatchObject({ felder: { status: 'erledigt' }, agent: 'Mail-Agent' });
    expect(stored.verlauf.at(-1)?.text).toContain('Vorschlag zum Prüfen');
    resolveProposal(project, own.id, true);
    expect(pendenzenOf(project)[0]).toMatchObject({ status: 'erledigt', neu: false });
    expect(pendenzenOf(project)[0].vorschlag).toBeUndefined();
  });

  it('upserts by known source without duplicates and without overwriting', () => {
    const project = fixture();
    const neu = (status?: string) =>
      intake(project, [
        {
          aktion: 'neu',
          pendenz: { titel: 'Planner: Funkgeräte bestellen', ...(status ? { status } : {}) },
          quelle: { kanal: 'planner', ref: 'TASK-1' },
        },
      ]);
    applyIntakeFiles(project, [{ datei: '01.json', text: neu() }], NOW);
    const [second] = applyIntakeFiles(
      project,
      [{ datei: '02.json', text: neu('erledigt') }],
      LATER,
    );
    expect(second).toMatchObject({ result: { neu: 0, geaendert: 1, konflikte: 1 } });
    expect(pendenzenOf(project)).toHaveLength(1);
    expect(pendenzenOf(project)[0]).toMatchObject({
      status: 'offen',
      vorschlag: { felder: { status: 'erledigt' } },
    });
    // The same proposal again changes nothing and is not logged twice.
    const entries = pendenzenOf(project)[0].verlauf.length;
    const [third] = applyIntakeFiles(
      project,
      [{ datei: '03.json', text: `${neu('erledigt')} ` }],
      LAST,
    );
    expect(third).toMatchObject({ result: { neu: 0, geaendert: 0, unveraendert: 1 } });
    expect(pendenzenOf(project)[0].verlauf).toHaveLength(entries);
  });

  it('rejects files that try to change anything but Pendenzen fields', () => {
    const project = fixture();
    const target = addPendenz(project, { titel: 'X' }, NOW);
    const attempts: unknown[] = [
      { aktion: 'aendern', id: target.id, felder: { neu: false } },
      { aktion: 'aendern', id: target.id, felder: { verlauf: [] } },
      { aktion: 'neu', pendenz: { titel: 'Y', id: 'pendenz_eigen' } },
      { aktion: 'neu', pendenz: { titel: 'Y' }, persons: [] },
      { aktion: 'loeschen', id: target.id },
      { aktion: 'aendern', id: target.id, felder: { status: 'geloescht' } },
      { aktion: 'aendern', id: target.id, felder: { faellig: 'morgen' } },
      { aktion: 'neu', pendenz: { titel: 'Y' }, quelle: { kanal: 'fax', ref: '1' } },
      { aktion: 'neu', pendenz: { titel: 'x'.repeat(301) } },
    ];
    for (const attempt of attempts) {
      const [outcome] = applyIntakeFiles(project, [
        { datei: 'x.json', text: intake(project, [attempt]) },
      ]);
      expect(outcome.status, JSON.stringify(attempt).slice(0, 60)).toBe('ungueltig');
    }
    const extraTop = JSON.stringify({ ...JSON.parse(intake(project, [])), stamm: {} });
    expect(applyIntakeFiles(project, [{ datei: 'y.json', text: extraTop }])[0].status).toBe(
      'ungueltig',
    );
    expect(pendenzenOf(project)).toHaveLength(1);
    expect(pendenzenOf(project)[0].verlauf).toHaveLength(0);
  });

  it('never applies the same file twice and leaves other services alone', () => {
    const project = fixture();
    const text = intake(project, [{ aktion: 'neu', pendenz: { titel: 'Einmal' } }]);
    applyIntakeFiles(project, [{ datei: 'a.json', text }]);
    expect(applyIntakeFiles(project, [{ datei: 'a-copy.json', text }])).toEqual([
      { datei: 'a-copy.json', status: 'bekannt' },
    ]);
    const other = JSON.stringify({ ...JSON.parse(text), projektId: 'project_anderes' });
    expect(applyIntakeFiles(project, [{ datei: 'b.json', text: other }])[0].status).toBe(
      'andereDienstleistung',
    );
    expect(applyIntakeFiles(project, [{ datei: 'c.json', text: '{nicht json' }])[0]).toMatchObject({
      status: 'ungueltig',
    });
    expect(pendenzenOf(project)).toHaveLength(1);
  });

  it('marks agent changes as new until the user sees or edits them', () => {
    const project = fixture();
    applyIntakeFiles(project, [
      { datei: 'a.json', text: intake(project, [{ aktion: 'neu', pendenz: { titel: 'Neu' } }]) },
    ]);
    const [pendenz] = pendenzenOf(project);
    expect(pendenz.neu).toBe(true);
    expect(pendenz.erstelltVon).toBe('agent');
    markPendenzenSeen(project);
    expect(pendenzenOf(project)[0].neu).toBe(false);
  });

  it('lets automatic checks such as the MILO reconciliation upsert idempotently', () => {
    const project = fixture();
    const quelle = { kanal: 'milo' as const, ref: 'wache:d1:p1', von: '', am: '', betreff: '' };
    const by = { autor: 'agent' as const, agent: 'MILO-Abgleich' };
    const felder = { titel: 'In MILO kommandieren: Fw Fiktiv Alpha', personIds: ['p1'] };
    expect(upsertPendenz(project, { quelle, felder }, by, NOW)?.status).toBe('neu');
    expect(upsertPendenz(project, { quelle, felder }, by, LATER)?.status).toBe('unveraendert');
    // Found in MILO: close it, but only if it is still in the state the check last saw.
    const done = upsertPendenz(
      project,
      { quelle, felder: { status: 'erledigt' }, vorher: { status: 'offen' } },
      by,
      LAST,
    );
    expect(done).toMatchObject({ status: 'geaendert', vorschlag: [] });
    expect(pendenzenOf(project)).toHaveLength(1);
    expect(
      upsertPendenz(project, { quelle: { ...quelle, ref: 'x' }, felder: {}, anlegen: false }, by),
    ).toBeNull();
  });

  it('refuses archived projects', () => {
    const project = fixture();
    project.archive = { id: 'archive_x', at: NOW };
    expect(() =>
      applyIntakeFiles(project, [
        { datei: 'a.json', text: intake(project, [{ aktion: 'neu', pendenz: { titel: 'X' } }]) },
      ]),
    ).toThrow(/schreibgeschützt/);
  });
});

describe('phase and reference', () => {
  it('derives the phase from the due date and the service period unless overridden', () => {
    const project = fixture();
    project.service.start = '2026-11-02';
    project.service.end = '2026-11-20';
    const before = addPendenz(project, { titel: 'A', faellig: '2026-10-25' });
    const during = addPendenz(project, { titel: 'B', faellig: '2026-11-05' });
    const after = addPendenz(project, { titel: 'C', faellig: '2026-11-30' });
    const fixed = addPendenz(project, {
      titel: 'D',
      faellig: '2026-11-05',
      phase: 'vordienstlich',
    });
    const undated = addPendenz(project, { titel: 'E' });
    expect(
      [before, during, after, fixed, undated].map((item) =>
        effectivePhase(project, item, '2026-10-20'),
      ),
    ).toEqual(['vordienstlich', 'dienst', 'nachdienstlich', 'vordienstlich', 'vordienstlich']);
    // Moving the service updates derived phases.
    project.service.start = '2026-10-01';
    expect(effectivePhase(project, before, '2026-10-20')).toBe('dienst');
    expect(effectivePhase(createProject(), before)).toBe('');
  });

  it('gives the agent the complete project, images included (owner decision)', () => {
    const project = fixture();
    project.stamm = {
      ...createStamm(),
      einheit: 'Fiktiv Kp',
      grafiken: { unterschrift: { name: 'sig.png', base64: 'AAAA', savedAt: NOW } },
    };
    const stand = standDocument(project, NOW);
    expect(stand.projekt).toEqual(project);
    expect(JSON.stringify(stand)).toContain('AAAA');
  });
});

// In-memory stand-in for the File System Access API.
class FakeDir implements LocalDir {
  kind = 'directory' as const;
  dirs = new Map<string, FakeDir>();
  files = new Map<string, string>();
  constructor(public name: string) {}
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    let dir = this.dirs.get(name);
    if (!dir) {
      if (!options?.create) throw new DOMException('missing', 'NotFoundError');
      dir = new FakeDir(name);
      this.dirs.set(name, dir);
    }
    return dir;
  }
  async getFileHandle(name: string, options?: { create?: boolean }): Promise<LocalFile> {
    if (!this.files.has(name) && !options?.create)
      throw new DOMException('missing', 'NotFoundError');
    return this.file(name);
  }
  private file(name: string): LocalFile {
    return {
      kind: 'file',
      name,
      getFile: async () => ({ text: async () => this.files.get(name) ?? '' }),
      createWritable: async () => {
        let buffer = '';
        return {
          write: async (data: string) => {
            buffer += data;
          },
          close: async () => {
            this.files.set(name, buffer);
          },
        };
      },
    };
  }
  async removeEntry(name: string) {
    this.files.delete(name);
  }
  async *values() {
    for (const dir of this.dirs.values()) yield dir;
    for (const name of this.files.keys()) yield this.file(name);
  }
}

describe('exchange folder', () => {
  it('writes the full state and guide, reads only finished json files and moves them', async () => {
    const project = fixture();
    addPendenz(project, { titel: 'Referenz' });
    const root = new FakeDir('Austausch');
    await writeStand(root, project);
    const stand = JSON.parse(root.files.get(STAND_FILE) ?? '{}');
    expect(stand).toMatchObject({ format: STAND_FORMAT, projektId: project.id, pendenzenAktiv: 1 });
    expect(stand.projekt.persons[0].name).toBe('Fiktiv Alpha');
    expect(root.files.get(GUIDE_FILE)).toContain('wk-suite/pendenzen-eingang');
    const inbox = await root.getDirectoryHandle(INTAKE_DIR);
    inbox.files.set('01.json', intake(project, [{ aktion: 'neu', pendenz: { titel: 'A' } }]));
    inbox.files.set('02.json.tmp', 'halb geschrieben');
    inbox.files.set('03.json', 'kaputt');
    const files = await readIntake(root);
    expect(files.map((file) => file.datei).sort()).toEqual(['01.json', '03.json']);
    await moveIntakeFile(root, files[0], DONE_DIR);
    await moveIntakeFile(root, files[1], FAILED_DIR, 'Eingangsdatei ist kein lesbares JSON.');
    expect([...inbox.files.keys()]).toEqual(['02.json.tmp']);
    expect([...(await inbox.getDirectoryHandle(DONE_DIR)).files.keys()]).toEqual(['01.json']);
    expect([...(await inbox.getDirectoryHandle(FAILED_DIR)).files.keys()]).toEqual([
      '03.json',
      '03.json.fehler.txt',
    ]);
  });
});
