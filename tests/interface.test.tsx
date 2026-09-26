import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DetachmentDialog } from '../src/components/DetachmentDialog';
import { PeoplePicker } from '../src/components/PeoplePicker';
import { createDetachment, createProject, derivePisa } from '../src/model';
import type { Person } from '../src/model/types';
import PisaPage from '../src/pages/PisaPage';
import PlanningPage from '../src/pages/PlanningPage';
import { projectStore } from '../src/store';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

function person(id: string, name: string, grad: string, lics: string[] = []): Person {
  return {
    id,
    name,
    grad,
    lics,
    funktion: 'Testfunktion',
    raw: {},
    pnr: `FICTION-${id}`,
    planning: { status: 'included', reason: '' },
  };
}
function fixture() {
  const project = createProject();
  project.persons = [
    person('a', 'Fiktiv Alpha', 'Wm', ['B']),
    person('b', 'Fiktiv Bravo', 'Wm', ['C']),
    person('c', 'Fiktiv Charlie', 'Sdt', ['B']),
  ];
  project.dets = [
    createDetachment({ id: 'early', name: 'KVK Test', ec: 'K1' }),
    createDetachment({ id: 'main', name: 'WK Test', ec: 'W1' }),
  ];
  project.assign = { early: [], main: ['a'] };
  return project;
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

describe('planning interface with fictional people', () => {
  it('combines facets, retains hidden selections, and explicitly moves selected people', async () => {
    const user = userEvent.setup();
    const project = fixture();
    projectStore.setState(() => project);
    const close = vi.fn();
    render(<PeoplePicker project={project} group={project.dets[0]} onClose={close} />);
    await user.click(screen.getByText('Grad', { selector: 'summary' }));
    await user.click(screen.getByRole('checkbox', { name: /^Wm\d/ }));
    await user.click(screen.getByText('Fahrausweis', { selector: 'summary' }));
    await user.click(screen.getByRole('checkbox', { name: /^B\d/ }));
    expect(screen.getByText('1 Treffer')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Alle Treffer auswählen' }));
    await user.click(screen.getByRole('button', { name: 'Filter zurücksetzen' }));
    await user.type(screen.getByRole('searchbox'), 'Charlie');
    expect(
      screen.queryByRole('checkbox', { name: 'Fiktiv Alpha auswählen' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Alle Treffer auswählen' }));
    expect(screen.getByText('2 ausgewählt · 1 werden hierher verschoben')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    expect(projectStore.get().assign).toEqual({ early: ['a', 'c'], main: [] });
    expect(close).toHaveBeenCalledOnce();
  });

  it('keeps a rejected change visible and focused inside its dialog', async () => {
    const user = userEvent.setup();
    const project = fixture();
    project.archive = { id: 'fiction-archive', at: '2030-01-01' };
    projectStore.setState(() => project);
    render(<PeoplePicker project={project} group={project.dets[0]} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Zuteilung speichern' }));
    const alert = screen.getByRole('alert');
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toBe(alert);
    expect(alert).toHaveFocus();
    expect(projectStore.get().assign).toEqual(project.assign);
  });

  it('creates a card without dates and stores optional details through TanStack Form', async () => {
    const user = userEvent.setup();
    projectStore.setState(() => createProject());
    const close = vi.fn();
    const mounted = render(<DetachmentDialog onClose={close} />);
    await user.type(screen.getByRole('textbox', { name: 'Name' }), 'Fiktives Detachement');
    await user.click(screen.getByRole('button', { name: 'Detachement erstellen' }));
    expect(projectStore.get().dets[0].datum).toBe('');
    expect(close).toHaveBeenCalledOnce();
    mounted.unmount();
    render(<DetachmentDialog group={projectStore.get().dets[0]} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Einrücken · Datum'), {
      target: { value: '2030-01-07' },
    });
    await user.type(screen.getByLabelText('Einrückungsort'), 'Fiktiver Übungsplatz');
    await user.click(screen.getByRole('button', { name: 'Änderungen speichern' }));
    expect(projectStore.get().dets[0]).toMatchObject({
      name: 'Fiktives Detachement',
      datum: '2030-01-07',
      ort: 'Fiktiver Übungsplatz',
    });
  });

  it('connects two cards without adding a duplicate planning card', async () => {
    const user = userEvent.setup();
    const project = fixture();
    projectStore.setState(() => project);
    render(<PlanningPage />);
    await user.click((await screen.findAllByRole('button', { name: 'Verbinden' }))[0]);
    await user.click(screen.getByRole('button', { name: 'Hier anschliessend Dienst leisten' }));
    expect(projectStore.get().connections).toEqual([
      expect.objectContaining({ from: 'early', to: 'main' }),
    ]);
    expect(projectStore.get().dets).toHaveLength(2);
    expect(screen.getByText('danach · 0 Pers.')).toBeInTheDocument();
  });

  it('requires KF confirmation before interpreting connections and persists a generated EC', async () => {
    const user = userEvent.setup();
    const project = fixture();
    project.assign = { early: ['a'], main: ['b', 'c'] };
    project.connections = [{ id: 'link', from: 'early', to: 'main' }];
    projectStore.setState(() => project);
    render(<PisaPage />);
    expect(screen.getByText('Aufgebotsart noch bestätigen')).toBeInTheDocument();
    expect(screen.getByText('Personenzuteilung erst nach KF-Bestätigung.')).toBeInTheDocument();
    expect(screen.queryByText(/Personen diesem EC direkt zuteilen/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Personenliste kopieren' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Plan abschliessend abgleichen' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'KF-Auskunft erfassen' }));
    await user.click(screen.getByRole('radio', { name: /Separate KVK-/ }));
    await user.type(
      screen.getByLabelText('Bestätigung durch KF / Referenz'),
      'Fiktive KF-Testauskunft',
    );
    expect(screen.getByRole('button', { name: 'Auswahl speichern' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: /Diese Aufgebotsart wurde/ }));
    await user.click(screen.getByRole('button', { name: 'Auswahl speichern' }));
    expect(projectStore.get().orderPolicy.mode).toBe('separate');
    await user.click(screen.getByRole('button', { name: /^EC\?/ }));
    await user.click(screen.getByRole('button', { name: 'EC bearbeiten' }));
    await user.type(screen.getByRole('textbox', { name: 'EC' }), 'W2');
    await user.click(screen.getByRole('button', { name: 'EC speichern' }));
    expect(derivePisa(projectStore.get()).find((entry) => entry.generated)?.ec).toBe('W2');
    expect(projectStore.get().dets).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Plan abschliessend abgleichen' })).toBeDisabled();
  });

  it('does not require a KVK interpretation for an ordinary unconnected detachment', () => {
    const project = fixture();
    projectStore.setState(() => project);
    render(<PisaPage />);
    expect(screen.queryByText('Aufgebotsart noch bestätigen')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'KF-Auskunft erfassen' })).not.toBeInTheDocument();
    expect(screen.getByText('0 Personen diesem EC direkt zuteilen.')).toBeInTheDocument();
  });

  it('identifies each unresolved person and links to local resolution without URL data', () => {
    const project = fixture();
    project.persons[0].planning.status = 'unreviewed';
    project.persons[1].planning.status = 'unreviewed';
    projectStore.setState(() => project);
    render(<PisaPage />);
    for (const name of ['Wm Fiktiv Alpha', 'Wm Fiktiv Bravo']) {
      const link = screen
        .getAllByRole('link', { name })
        .find((item) => item.parentElement?.textContent?.includes('Teilnahme noch klären.'));
      expect(link).toHaveAttribute('href', '/persons');
    }
    expect(screen.getAllByRole('link', { name: 'KVK Test' })[0]).toHaveAttribute('href', '/');
  });
});
