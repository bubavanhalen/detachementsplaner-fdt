import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { PROJECT_KEY } from '../src/io/storage';
import { createDetachment, createProject } from '../src/model';
import { getBoardPositions } from '../src/model/board';
import PlanningPage from '../src/pages/PlanningPage';
import { projectStore, replaceProject } from '../src/store';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

function fixture() {
  const project = createProject();
  project.dets = [
    createDetachment({ id: 'fiction-early', name: 'Fiktiv KVK', ec: 'K1' }),
    createDetachment({ id: 'fiction-main', name: 'Fiktiv WK', ec: 'W1' }),
  ];
  project.assign = { 'fiction-early': [], 'fiction-main': [] };
  return project;
}

describe('interactive planning board with wholly fictional projects', () => {
  it('waits for graph measurement before focusing and selecting the new name', async () => {
    const user = userEvent.setup();
    const observers = new Map<
      ResizeObserver,
      { callback: ResizeObserverCallback; targets: Set<Element> }
    >();
    // A delayed browser measurement reproduces the hidden initial React Flow node.
    // The graph and card implementations remain real.
    vi.stubGlobal(
      'ResizeObserver',
      class implements ResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          observers.set(this, { callback, targets: new Set() });
        }
        observe(target: Element) {
          observers.get(this)?.targets.add(target);
        }
        unobserve(target: Element) {
          observers.get(this)?.targets.delete(target);
        }
        disconnect() {
          observers.delete(this);
        }
      },
    );
    replaceProject(createProject());
    const mounted = render(<PlanningPage />);
    try {
      await user.click(screen.getByRole('button', { name: '+ Detachement' }));
      const name = screen.getByLabelText('Name');
      expect(name).not.toBeVisible();
      expect(name).not.toHaveFocus();
      await act(async () => {
        for (const [observer, { callback, targets }] of observers) {
          callback(
            [...targets].map(
              (target) =>
                ({ target, contentRect: target.getBoundingClientRect() }) as ResizeObserverEntry,
            ),
            observer,
          );
        }
      });
      await waitFor(() => expect(name).toBeVisible());
      expect(name).toHaveFocus();
      expect((name as HTMLInputElement).selectionStart).toBe(0);
      expect((name as HTMLInputElement).selectionEnd).toBe('Neues Detachement'.length);
    } finally {
      mounted.unmount();
      vi.unstubAllGlobals();
    }
  });

  it('creates immediately and commits or cancels the inline name without a dialog', async () => {
    const user = userEvent.setup();
    replaceProject(createProject());
    render(<PlanningPage />);
    await user.click(screen.getByRole('button', { name: '+ Detachement' }));
    const name = await screen.findByRole('textbox', { name: 'Name' });
    expect(name).toHaveFocus();
    expect(projectStore.get().dets).toHaveLength(1);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.clear(name);
    await user.type(name, 'Fiktiv Fahrer{Enter}');
    expect(projectStore.get().dets[0].name).toBe('Fiktiv Fahrer');
    await user.clear(name);
    await user.type(name, 'Verworfener Testname{Escape}');
    expect(name).toHaveValue('Fiktiv Fahrer');
    expect(projectStore.get().dets[0].name).toBe('Fiktiv Fahrer');
    expect(screen.getByRole('button', { name: /Angaben ergänzen/ })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a blank inline name local and explains how to correct it', async () => {
    const user = userEvent.setup();
    replaceProject(fixture());
    render(<PlanningPage />);
    const names = await screen.findAllByRole('textbox', { name: 'Name' });
    await user.clear(names[0]);
    await user.keyboard('{Enter}');
    expect(names[0]).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Bitte einen Namen eingeben.');
    expect(projectStore.get().dets[0].name).toBe('Fiktiv KVK');
    await user.type(names[0], 'Fiktiv korrigiert{Enter}');
    expect(projectStore.get().dets[0].name).toBe('Fiktiv korrigiert');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows assignment conflicts on the affected card before opening PISA', async () => {
    const user = userEvent.setup();
    const project = fixture();
    project.persons = [
      {
        id: 'fiction-person',
        name: 'Fiktiv Ausgeschlossen',
        grad: 'Wm',
        funktion: 'Testfunktion',
        lics: [],
        raw: {},
        planning: { status: 'excluded', reason: 'Fiktiver Testgrund' },
      },
    ];
    project.assign['fiction-early'] = ['fiction-person'];
    replaceProject(project);
    render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    const conflict = within(card).getByRole('button', { name: /1 Konflikt/ });
    expect(conflict).toHaveTextContent('Trotz Ausschluss einem Detachement zugeteilt.');
    await user.click(conflict);
    expect(screen.getByText(/Fiktiv Ausgeschlossen:/)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Jetzt bearbeiten →' }).length).toBeGreaterThan(0);
  });

  it('keeps rejected connections and their error on the source card', async () => {
    const user = userEvent.setup();
    const project = fixture();
    project.dets.push(
      createDetachment({ id: 'fiction-third', name: 'Fiktives zweites Ziel', ec: 'W2' }),
    );
    project.assign['fiction-third'] = [];
    project.connections = [{ id: 'fiction-link', from: 'fiction-early', to: 'fiction-main' }];
    replaceProject(project);
    render(<PlanningPage />);
    const source = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    await user.click(within(source).getByRole('button', { name: 'Verbinden →' }));
    const target = screen.getByRole('article', { name: 'Detachement Fiktives zweites Ziel' });
    await user.click(
      within(target).getByRole('button', { name: 'Hier anschliessend Dienst leisten' }),
    );
    expect(within(source).getByRole('alert')).not.toBeEmptyDOMElement();
    expect(projectStore.get().connections).toEqual(project.connections);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('moves by click and reverses the layout without changing the service details', async () => {
    const user = userEvent.setup();
    const project = fixture();
    replaceProject(project);
    const initial = getBoardPositions(project);
    render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    await user.click(within(card).getByText('Position ändern', { selector: 'summary' }));
    await user.click(within(card).getByRole('button', { name: 'Karte → verschieben' }));
    expect(getBoardPositions(projectStore.get())['fiction-early'].x).toBe(
      initial['fiction-early'].x + 40,
    );
    expect(projectStore.get().dets).toEqual(project.dets);
    await user.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(getBoardPositions(projectStore.get())).toEqual(initial);
    await user.click(screen.getByRole('button', { name: 'Wiederholen' }));
    expect(getBoardPositions(projectStore.get())['fiction-early'].x).toBe(
      initial['fiction-early'].x + 40,
    );
  });

  it('persists native React Flow arrow-key movement and makes it undoable', async () => {
    const user = userEvent.setup();
    const project = fixture();
    replaceProject(project);
    const initial = getBoardPositions(project);
    const mounted = render(<PlanningPage />);
    const node = await screen.findByRole('group', { name: 'Detachement Fiktiv KVK' });
    await user.click(node);
    await user.keyboard('{ArrowRight}');
    const moved = getBoardPositions(projectStore.get());
    expect(moved['fiction-early'].x).toBeGreaterThan(initial['fiction-early'].x);
    expect(moved['fiction-early'].y).toBe(initial['fiction-early'].y);
    expect(JSON.parse(localStorage.getItem(PROJECT_KEY) ?? '{}').board.positions).toEqual(moved);
    mounted.unmount();
    render(<PlanningPage />);
    const reopened = await screen.findByRole('group', { name: 'Detachement Fiktiv KVK' });
    expect(reopened.style.transform).toContain(
      `translate(${moved['fiction-early'].x}px,${moved['fiction-early'].y}px)`,
    );
    await user.click(screen.getByRole('button', { name: 'Rückgängig' }));
    expect(getBoardPositions(projectStore.get())).toEqual(initial);
    expect(projectStore.get().dets).toEqual(project.dets);
  });

  it('merges panel details without overwriting concurrent inline name and EC edits', async () => {
    const user = userEvent.setup();
    replaceProject(fixture());
    render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    await user.click(within(card).getByRole('button', { name: 'Details' }));
    const panel = screen.getByRole('region', { name: 'Fiktiv KVK · Angaben' });
    await user.type(within(panel).getByLabelText('Einrückungsort'), 'Fiktiver neuer Ort');
    const name = within(card).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Fiktiver neuer Name{Enter}');
    const ec = within(card).getByRole('textbox', { name: 'EC' });
    await user.clear(ec);
    await user.type(ec, 'K2{Enter}');
    await user.click(within(panel).getByRole('button', { name: 'Änderungen speichern' }));
    expect(projectStore.get().dets[0]).toMatchObject({
      name: 'Fiktiver neuer Name',
      ec: 'K2',
      ort: 'Fiktiver neuer Ort',
    });
    expect(screen.queryByRole('region', { name: /Angaben/ })).not.toBeInTheDocument();
  });

  it('rejects competing edits of the same field while preserving both the card and panel draft', async () => {
    const user = userEvent.setup();
    replaceProject(fixture());
    render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    await user.click(within(card).getByRole('button', { name: 'Details' }));
    const panel = screen.getByRole('region', { name: 'Fiktiv KVK · Angaben' });
    const panelName = within(panel).getByRole('textbox', { name: 'Name' });
    await user.clear(panelName);
    await user.type(panelName, 'Fiktiver Entwurf im Bereich');
    await user.type(within(panel).getByLabelText('Einrückungsort'), 'Fiktiver Entwurfsort');
    const name = within(card).getByRole('textbox', { name: 'Name' });
    await user.clear(name);
    await user.type(name, 'Fiktiver neuer Kartenname{Enter}');
    await user.click(within(panel).getByRole('button', { name: 'Änderungen speichern' }));
    const alert = within(panel).getByRole('alert');
    expect(alert).toHaveTextContent('Diese Angabe wurde inzwischen auf der Karte geändert.');
    expect(alert).toHaveFocus();
    expect(projectStore.get().dets[0]).toMatchObject({
      name: 'Fiktiver neuer Kartenname',
      ort: '',
    });
    expect(panelName).toHaveValue('Fiktiver Entwurf im Bereich');
    expect(within(panel).getByLabelText('Einrückungsort')).toHaveValue('Fiktiver Entwurfsort');
  });

  it('opens person selection alongside the board and makes archive cards read-only', async () => {
    const user = userEvent.setup();
    const project = fixture();
    replaceProject(project);
    const mounted = render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    await user.click(within(card).getByRole('button', { name: /Personen auswählen/ }));
    expect(screen.getByRole('article', { name: 'Detachement Fiktiv KVK' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zuteilung speichern' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    mounted.unmount();
    project.archive = { id: 'fiction-archive', at: '2030-01-01' };
    replaceProject(project);
    render(<PlanningPage />);
    const archivedCard = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    expect(within(archivedCard).getByRole('textbox', { name: 'Name' })).toBeDisabled();
    expect(within(archivedCard).getByRole('button', { name: 'Verbinden →' })).toBeDisabled();
    expect(within(archivedCard).getByRole('button', { name: /Personen auswählen/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '+ Detachement' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();
  });
});
