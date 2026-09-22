import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Person } from '../src/model';
import { assignPeople, createDetachment, createProject } from '../src/model';
import { PersonEditor } from '../src/pages/PersonEditor';
import { changeProject, projectStore } from '../src/store';

function fixture() {
  const project = createProject();
  project.dets = [
    createDetachment({ id: 'early', name: 'Fiktiv KVK' }),
    createDetachment({ id: 'main', name: 'Fiktiv WK' }),
  ];
  project.persons = [
    {
      id: 'p',
      name: 'Fiktiv Muster',
      grad: 'Wm',
      pnr: 'TEST-001',
      funktion: 'Motf',
      lics: ['30'],
      tel: '+41 79 000 00 01',
      mail: 'fiction@example.invalid',
      raw: { Quelle: 'Erfundener Quellwert' },
      rawSources: { pisa: { Quelle: 'Erfundener Quellwert' } },
      planning: { status: 'included', reason: 'Fiktive Notiz' },
    },
  ];
  project.assign = { early: ['p'], main: [] };
  return project;
}
function editor() {
  const project = fixture();
  projectStore.setState(() => project);
  const close = vi.fn();
  render(<PersonEditor person={project.persons[0]} onClose={close} presentation="panel" />);
  return { project, close, user: userEvent.setup() };
}

describe('person editing alongside a live planning board', () => {
  it('merges contact edits while preserving concurrent assignments and untouched imported fields', async () => {
    const { user, close } = editor();
    await user.clear(screen.getByRole('textbox', { name: 'Telefon' }));
    await user.type(screen.getByRole('textbox', { name: 'Telefon' }), '+41 79 000 00 02');
    act(() =>
      changeProject((draft) => {
        assignPeople(draft, 'main', ['p']);
        draft.persons[0].grad = 'Obwm';
        draft.persons[0].lics = ['30', '40'];
        draft.persons[0].raw.NewField = 'Neuer fiktiver Quellwert';
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().assign).toEqual({ early: [], main: ['p'] });
    expect(projectStore.get().persons[0]).toMatchObject({
      tel: '+41 79 000 00 02',
      grad: 'Obwm',
      lics: ['30', '40'],
      raw: { Quelle: 'Erfundener Quellwert', NewField: 'Neuer fiktiver Quellwert' },
      planning: { status: 'included', reason: 'Fiktive Notiz' },
    });
    expect(close).toHaveBeenCalledOnce();
  });
  it('does not reset a participation decision made by a board assignment', async () => {
    const project = fixture();
    project.assign.early = [];
    project.persons[0].planning.status = 'unreviewed';
    projectStore.setState(() => project);
    const user = userEvent.setup();
    render(<PersonEditor person={project.persons[0]} onClose={vi.fn()} presentation="panel" />);
    await user.clear(screen.getByRole('textbox', { name: 'E-Mail' }));
    await user.type(screen.getByRole('textbox', { name: 'E-Mail' }), 'changed@example.invalid');
    act(() => changeProject((draft) => assignPeople(draft, 'main', ['p'])));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().persons[0].planning.status).toBe('included');
    expect(projectStore.get().assign.main).toEqual(['p']);
  });
  it('preserves ambiguous legacy assignments during unrelated contact editing', async () => {
    const project = fixture();
    project.assign.main = ['p'];
    projectStore.setState(() => project);
    const user = userEvent.setup();
    render(<PersonEditor person={project.persons[0]} onClose={vi.fn()} presentation="panel" />);
    expect(screen.getByRole('combobox', { name: 'Direktes Detachement' })).toHaveValue(
      '__multiple__',
    );
    await user.type(screen.getByRole('textbox', { name: 'Zug / Element' }), 'Fiktiv 2');
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().assign).toEqual({ early: ['p'], main: ['p'] });
    expect(projectStore.get().persons[0].zug).toBe('Fiktiv 2');
  });
  it('resolves legacy assignments only after explicitly choosing a destination', async () => {
    const project = fixture();
    project.assign.main = ['p'];
    projectStore.setState(() => project);
    const user = userEvent.setup();
    render(<PersonEditor person={project.persons[0]} onClose={vi.fn()} presentation="panel" />);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Direktes Detachement' }),
      'main',
    );
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().assign).toEqual({ early: [], main: ['p'] });
  });
  it.each([
    ['Telefon', 'tel', '+41 79 000 00 02', '+41 79 000 00 03'],
    ['Grad', 'grad', 'Lt', 'Obwm'],
    ['Funktion', 'funktion', 'Fiktive Funktion A', 'Fiktive Funktion B'],
    ['Versicherten-Nr.', 'pnr', 'TEST-002', 'TEST-003'],
    ['E-Mail', 'mail', 'a@example.invalid', 'b@example.invalid'],
  ] as const)(
    'blocks conflicting edits of %s without committing other form changes',
    async (label, key, desired, concurrent) => {
      const { user, close } = editor();
      await user.clear(screen.getByRole('textbox', { name: label }));
      await user.type(screen.getByRole('textbox', { name: label }), desired);
      await user.type(screen.getByRole('textbox', { name: 'Einheit' }), 'Unsaved fictional unit');
      act(() =>
        changeProject((draft) => {
          draft.persons[0][key] = concurrent;
        }),
      );
      const before = structuredClone(projectStore.get());
      await user.click(screen.getByRole('button', { name: 'Speichern' }));
      expect(screen.getByRole('alert')).toHaveTextContent('inzwischen geändert');
      expect(screen.getByRole('alert')).toHaveFocus();
      expect(projectStore.get()).toEqual(before);
      expect(close).not.toHaveBeenCalled();
    },
  );
  it('blocks conflicting assignment changes rather than clearing a newer board decision', async () => {
    const { user, close } = editor();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Direktes Detachement' }), '');
    act(() => changeProject((draft) => assignPeople(draft, 'main', ['p'])));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByRole('alert')).toHaveTextContent('inzwischen geändert');
    expect(projectStore.get().assign.main).toEqual(['p']);
    expect(close).not.toHaveBeenCalled();
  });
  it('accepts an explicit assignment already applied by a board action', async () => {
    const { user, close } = editor();
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Direktes Detachement' }),
      'main',
    );
    act(() => changeProject((draft) => assignPeople(draft, 'main', ['p'])));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().assign.main).toEqual(['p']);
    expect(close).toHaveBeenCalledOnce();
  });
  it('explicit exclusion requires a reason and clears direct assignments', async () => {
    const { user } = editor();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Teilnahme' }), 'excluded');
    await user.clear(screen.getByRole('textbox', { name: 'Begründung / Planungsnotiz' }));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Ausschluss begründen');
    await user.type(
      screen.getByRole('textbox', { name: 'Begründung / Planungsnotiz' }),
      'Fiktiver Entscheid',
    );
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().persons[0].planning).toEqual({
      status: 'excluded',
      reason: 'Fiktiver Entscheid',
    });
    expect(projectStore.get().assign).toEqual({ early: [], main: [] });
  });
  it('does not clear an identity-review warning that changed after opening', async () => {
    const project = fixture();
    const person: Person = project.persons[0];
    person.identityReview = 'Erste fiktive Prüfung';
    projectStore.setState(() => project);
    const user = userEvent.setup();
    render(<PersonEditor person={person} onClose={vi.fn()} presentation="panel" />);
    await user.click(screen.getByRole('checkbox', { name: /Identität mit Quelle geprüft/ }));
    act(() =>
      changeProject((draft) => {
        draft.persons[0].identityReview = 'Neue fiktive Prüfung';
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByRole('alert')).toHaveTextContent('inzwischen geändert');
    expect(projectStore.get().persons[0].identityReview).toBe('Neue fiktive Prüfung');
  });
  it('creates a new person and assignment atomically', async () => {
    const project = fixture();
    projectStore.setState(() => project);
    const close = vi.fn(),
      user = userEvent.setup();
    render(<PersonEditor onClose={close} presentation="panel" />);
    await user.type(
      screen.getByRole('textbox', { name: 'Vorname / vollständiger Name' }),
      'Neue Fiktivperson',
    );
    await user.selectOptions(screen.getByRole('combobox', { name: 'Teilnahme' }), 'included');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Direktes Detachement' }),
      'main',
    );
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().persons).toHaveLength(2);
    expect(projectStore.get().assign.main).toEqual([projectStore.get().persons[1].id]);
    expect(close).toHaveBeenCalledOnce();
  });
  it('saving an unchanged legacy person does not rewrite contact-name metadata or sources', async () => {
    const { project, user } = editor();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().persons[0]).toEqual(project.persons[0]);
  });
  it('does not save into a different project or recreate a deleted person', async () => {
    const { user } = editor();
    act(() =>
      changeProject((draft) => {
        draft.persons = [];
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Person nicht gefunden');
    const other = fixture();
    act(() => projectStore.setState(() => other));
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Dienstleistung wurde gewechselt');
    expect(projectStore.get()).toEqual(other);
  });
});
