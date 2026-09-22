import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PeoplePicker } from '../src/components/PeoplePicker';
import { PlanningPanel } from '../src/components/PlanningPanel';
import { assignPeople, createDetachment, createProject } from '../src/model';
import { changeProject, projectStore } from '../src/store';

function fixture() {
  const project = createProject();
  project.persons = [
    {
      id: 'a',
      name: 'Fiktiv Alpha',
      grad: 'Wm',
      funktion: 'Motf',
      lics: ['30'],
      raw: {},
      planning: { status: 'included' as const, reason: '' },
    },
    {
      id: 'b',
      name: 'Fiktiv Bravo',
      grad: 'Sdt',
      funktion: 'Inf Sdt',
      lics: [],
      raw: {},
      planning: { status: 'included' as const, reason: '' },
    },
  ];
  project.dets = [
    createDetachment({ id: 'special', name: 'Fiktives Spezialdetachement' }),
    createDetachment({ id: 'main', name: 'Fiktives Hauptdetachement' }),
  ];
  project.assign = { special: [], main: ['a'] };
  return project;
}
function Workspace() {
  const [open, setOpen] = useState(false),
    [actions, setActions] = useState(0);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Panel öffnen
      </button>
      <button type="button" onClick={() => setActions((value) => value + 1)}>
        Board bedienen
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Anderes Detachement wählen
      </button>
      <span>{actions} Boardaktionen</span>
      {open && (
        <PlanningPanel
          title="Fiktives Detachement"
          onClose={() => setOpen(false)}
          footer={
            <button type="button" onClick={() => setOpen(false)}>
              Fertig
            </button>
          }
        >
          <label>
            Fiktiver Name
            <input />
          </label>
        </PlanningPanel>
      )}
    </div>
  );
}

beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', {
    configurable: true,
    value() {
      this.setAttribute('open', '');
    },
  });
  Object.defineProperty(HTMLDialogElement.prototype, 'close', {
    configurable: true,
    value() {
      this.removeAttribute('open');
    },
  });
});

describe('nonmodal planning side panel', () => {
  it('names its region, focuses its heading and leaves board actions interactive', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(screen.getByRole('button', { name: 'Panel öffnen' }));
    const panel = screen.getByRole('region', { name: 'Fiktives Detachement' });
    expect(within(panel).getByRole('heading', { name: 'Fiktives Detachement' })).toHaveFocus();
    expect(panel).not.toHaveAttribute('aria-modal');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Board bedienen' }));
    expect(screen.getByText('1 Boardaktionen')).toBeInTheDocument();
    expect(panel).toBeInTheDocument();
  });
  it('restores the opener after closing with the explicit close button', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    const opener = screen.getByRole('button', { name: 'Panel öffnen' });
    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Bereich schliessen' }));
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
  it('supports Escape inside the panel and restores keyboard focus', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    const opener = screen.getByRole('button', { name: 'Panel öffnen' });
    await user.click(opener);
    await user.click(screen.getByRole('textbox', { name: 'Fiktiver Name' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });
  it('does not steal focus when a board action replaces the active panel', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(screen.getByRole('button', { name: 'Panel öffnen' }));
    const other = screen.getByRole('button', { name: 'Anderes Detachement wählen' });
    await user.click(other);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
    expect(other).toHaveFocus();
  });
  it('does not handle Escape from the board outside the panel', async () => {
    const user = userEvent.setup();
    render(<Workspace />);
    await user.click(screen.getByRole('button', { name: 'Panel öffnen' }));
    const board = screen.getByRole('button', { name: 'Board bedienen' });
    await user.click(board);
    fireEvent.keyDown(board, { key: 'Escape' });
    expect(screen.getByRole('region')).toBeInTheDocument();
  });
});

describe('PeoplePicker presentation compatibility', () => {
  it('retains dialog presentation by default', () => {
    const project = fixture();
    projectStore.setState(() => project);
    render(<PeoplePicker project={project} group={project.dets[0]} onClose={vi.fn()} />);
    expect(
      screen.getByRole('dialog', { name: 'Personen auswählen · Fiktives Spezialdetachement' }),
    ).toBeInTheDocument();
  });
  it('retains filters, hidden selections, move warnings and atomic assignment inside a side panel', async () => {
    const project = fixture();
    projectStore.setState(() => project);
    const close = vi.fn(),
      user = userEvent.setup();
    render(
      <PeoplePicker
        project={project}
        group={project.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    const panel = screen.getByRole('region', {
      name: 'Personen auswählen · Fiktives Spezialdetachement',
    });
    await user.click(within(panel).getByText('Grad', { selector: 'summary' }));
    await user.click(within(panel).getByRole('checkbox', { name: 'Wm' }));
    expect(within(panel).getByText('1 Treffer')).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Alle Treffer auswählen' }));
    await user.click(within(panel).getByRole('button', { name: 'Filter zurücksetzen' }));
    await user.type(within(panel).getByRole('searchbox'), 'Bravo');
    expect(
      within(panel).queryByRole('checkbox', { name: 'Fiktiv Alpha auswählen' }),
    ).not.toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Alle Treffer auswählen' }));
    expect(
      within(panel).getByText('2 ausgewählt · 1 werden hierher verschoben'),
    ).toBeInTheDocument();
    await user.click(within(panel).getByRole('button', { name: 'Zuteilung speichern' }));
    expect(projectStore.get().assign).toEqual({ special: ['a', 'b'], main: [] });
    expect(close).toHaveBeenCalledOnce();
  });
  it('keeps rejected changes visible and focused in the panel', async () => {
    const project = fixture();
    project.archive = { id: 'fictional-archive', at: '2030-01-01' };
    projectStore.setState(() => project);
    const close = vi.fn(),
      user = userEvent.setup();
    render(
      <PeoplePicker
        project={project}
        group={project.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    const alert = within(screen.getByRole('region')).getByRole('alert');
    expect(alert).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
    expect(projectStore.get().assign).toEqual(project.assign);
  });
  it('does not move unchanged initial members back after a board reassignment', async () => {
    const project = fixture();
    project.assign = { special: ['a'], main: [] };
    projectStore.setState(() => project);
    const user = userEvent.setup(),
      close = vi.fn();
    const mounted = render(
      <PeoplePicker
        project={project}
        group={project.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    act(() => changeProject((draft) => assignPeople(draft, 'main', ['a'])));
    const updated = projectStore.get();
    mounted.rerender(
      <PeoplePicker
        project={updated}
        group={updated.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Fiktiv Alpha auswählen' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    expect(projectStore.get().assign).toEqual({ special: [], main: ['a'] });
  });
  it('keeps newly assigned board members while applying an explicit deselection', async () => {
    const project = fixture();
    project.assign = { special: ['a'], main: [] };
    projectStore.setState(() => project);
    const user = userEvent.setup(),
      close = vi.fn();
    const mounted = render(
      <PeoplePicker
        project={project}
        group={project.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Fiktiv Alpha auswählen' }));
    act(() => changeProject((draft) => assignPeople(draft, 'special', ['b'])));
    const updated = projectStore.get();
    mounted.rerender(
      <PeoplePicker
        project={updated}
        group={updated.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Fiktiv Bravo auswählen' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Fiktiv Alpha auswählen' })).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    expect(projectStore.get().assign.special).toEqual(['b']);
  });
  it('retains unsaved additions while accepting independent board moves', async () => {
    const project = fixture();
    project.assign = { special: ['a'], main: [] };
    projectStore.setState(() => project);
    const user = userEvent.setup(),
      close = vi.fn();
    const mounted = render(
      <PeoplePicker
        project={project}
        group={project.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Fiktiv Bravo auswählen' }));
    act(() => changeProject((draft) => assignPeople(draft, 'main', ['a'])));
    const updated = projectStore.get();
    mounted.rerender(
      <PeoplePicker
        project={updated}
        group={updated.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    expect(screen.getByRole('checkbox', { name: 'Fiktiv Bravo auswählen' })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    expect(projectStore.get().assign).toEqual({ special: ['b'], main: ['a'] });
  });
  it('does not reinclude a person excluded on the board after the panel selection', async () => {
    const project = fixture();
    projectStore.setState(() => project);
    const user = userEvent.setup(),
      close = vi.fn();
    render(
      <PeoplePicker
        project={project}
        group={project.dets[0]}
        onClose={close}
        presentation="panel"
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Fiktiv Bravo auswählen' }));
    act(() =>
      changeProject((draft) => {
        draft.persons[1].planning = { status: 'excluded', reason: 'Fiktiver Ausschluss' };
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    expect(screen.getByRole('alert')).toHaveTextContent('inzwischen ausgeschlossen');
    expect(projectStore.get().persons[1].planning.status).toBe('excluded');
    expect(projectStore.get().assign.special).toEqual([]);
    expect(close).not.toHaveBeenCalled();
  });
  it('does not silently resolve legacy multiple assignments without a selection edit', async () => {
    const project = fixture();
    project.assign.special = ['a'];
    projectStore.setState(() => project);
    const user = userEvent.setup();
    render(
      <PeoplePicker
        project={project}
        group={project.dets[0]}
        onClose={vi.fn()}
        presentation="panel"
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    expect(projectStore.get().assign).toEqual({ special: ['a'], main: ['a'] });
  });
  it('rejects saving a stale selection into a different service', async () => {
    const project = fixture();
    projectStore.setState(() => project);
    const user = userEvent.setup();
    render(
      <PeoplePicker
        project={project}
        group={project.dets[0]}
        onClose={vi.fn()}
        presentation="panel"
      />,
    );
    await user.click(screen.getByRole('checkbox', { name: 'Fiktiv Bravo auswählen' }));
    const other = fixture();
    act(() => projectStore.setState(() => other));
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Dienstleistung wurde gewechselt');
    expect(projectStore.get()).toEqual(other);
  });
});
