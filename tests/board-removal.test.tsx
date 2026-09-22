import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDetachment, createProject } from '../src/model';
import PlanningPage from '../src/pages/PlanningPage';
import { projectStore, replaceProject } from '../src/store';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

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

function fixture() {
  const project = createProject();
  project.dets = [
    createDetachment({ id: 'fiction-early', name: 'Fiktiv KVK', ec: 'K1' }),
    createDetachment({ id: 'fiction-main', name: 'Fiktiv WK', ec: 'W1' }),
  ];
  project.persons = [
    {
      id: 'fiction-person',
      name: 'Fiktiv Beispiel',
      grad: 'Wm',
      funktion: 'Testfunktion',
      lics: [],
      raw: {},
      planning: { status: 'included', reason: '' },
    },
  ];
  project.assign = { 'fiction-early': ['fiction-person'], 'fiction-main': [] };
  project.connections = [{ id: 'fiction-link', from: 'fiction-early', to: 'fiction-main' }];
  project.board = {
    positions: { 'fiction-early': { x: 80, y: 60 }, 'fiction-main': { x: 520, y: 60 } },
  };
  return project;
}

describe('confirmed card removal with wholly fictional data', () => {
  it('places an accessible X in each header and leaves the project intact on cancellation', async () => {
    const user = userEvent.setup();
    replaceProject(fixture());
    const before = structuredClone(projectStore.get());
    render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    const remove = within(card).getByRole('button', { name: 'Fiktiv KVK entfernen' });
    expect(remove.closest('.card-grip')).not.toBeNull();
    expect(remove).toHaveClass('nodrag', 'nopan');
    expect(remove).toHaveTextContent('×');
    expect(screen.getAllByRole('button', { name: /Fiktiv .* entfernen/ })).toHaveLength(2);
    await user.click(remove);
    const dialog = screen.getByRole('dialog', { name: 'Detachement entfernen?' });
    expect(dialog).toHaveTextContent('Die Personen bleiben erhalten');
    expect(projectStore.get()).toEqual(before);
    await user.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(projectStore.get()).toEqual(before);
    expect(remove).toHaveFocus();
    await user.click(remove);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(projectStore.get()).toEqual(before);
  });

  it('removes the confirmed group and connections, retains people, and undoes the whole operation', async () => {
    const user = userEvent.setup();
    replaceProject(fixture());
    const before = structuredClone(projectStore.get());
    render(<PlanningPage />);
    await user.click(await screen.findByRole('button', { name: 'Fiktiv KVK entfernen' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Detachement entfernen' }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(projectStore.get().dets.map((group) => group.id)).toEqual(['fiction-main']);
    expect(projectStore.get().assign['fiction-early']).toBeUndefined();
    expect(projectStore.get().connections).toEqual([]);
    expect(projectStore.get().persons).toEqual(before.persons);
    expect(projectStore.get().board?.positions['fiction-early']).toBeUndefined();
    await user.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(projectStore.get()).toEqual(before);
  });

  it('disables every removal button in an archive', async () => {
    const user = userEvent.setup();
    const project = fixture();
    project.archive = { id: 'fiction-archive', at: '2030-01-01' };
    replaceProject(project);
    render(<PlanningPage />);
    for (const button of await screen.findAllByRole('button', { name: /Fiktiv .* entfernen/ })) {
      expect(button).toBeDisabled();
      await user.click(button);
    }
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(projectStore.get().dets).toHaveLength(2);
  });

  it('dismisses a stale confirmation when another project is opened', async () => {
    const user = userEvent.setup();
    replaceProject(fixture());
    render(<PlanningPage />);
    await user.click(await screen.findByRole('button', { name: 'Fiktiv KVK entfernen' }));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    const replacement = fixture();
    act(() => replaceProject(replacement));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(projectStore.get().dets).toHaveLength(2);
  });
});
