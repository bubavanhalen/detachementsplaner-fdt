import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { HistoryButtons } from '../src/components/HistoryButtons';
import { PROJECT_KEY } from '../src/io/storage';
import { createDetachment, createProject } from '../src/model';
import { getBoardPositions } from '../src/model/board';
import PlanningPage from '../src/pages/PlanningPage';
import { projectStore, replaceProject } from '../src/store';

const renderCounts = vi.hoisted(() => new Map<string, number>());
vi.mock('motion/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('motion/react')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    motion: {
      article: (props: React.ComponentProps<typeof actual.motion.article>) => {
        const label = props['aria-label'] ?? '';
        renderCounts.set(label, (renderCounts.get(label) ?? 0) + 1);
        return createElement(actual.motion.article, props);
      },
    },
  };
});
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
  project.board = {
    positions: { 'fiction-early': { x: 80, y: 60 }, 'fiction-main': { x: 520, y: 60 } },
  };
  return project;
}

async function settleLayout() {
  await act(async () => {
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  });
}

function mouse(target: Element | Window, type: string, init: MouseEventInit) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
  // Vitest's Window proxy fails jsdom's constructor brand check; d3 still needs event.view.
  Object.defineProperty(event, 'view', { value: window });
  fireEvent(target, event);
}

describe('planning board stability with wholly fictional projects', () => {
  it('opens and closes the person flyout without changing the viewport or card layout', async () => {
    const user = userEvent.setup();
    replaceProject(fixture());
    const mounted = render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    await settleLayout();
    const viewport = mounted.container.querySelector<HTMLElement>('.react-flow__viewport');
    const graphNode = card.closest<HTMLElement>('.react-flow__node');
    expect(viewport).not.toBeNull();
    const transform = viewport?.style.transform;
    const cardTransform = graphNode?.style.transform;
    const initial = structuredClone(projectStore.get());
    const opener = within(card).getByRole('button', { name: /Personen auswählen/ });
    await user.click(opener);
    const flyout = screen.getByRole('region', { name: 'Personen auswählen · Fiktiv KVK' });
    await settleLayout();
    expect(viewport?.style.transform).toBe(transform);
    expect(graphNode?.style.transform).toBe(cardTransform);
    expect(projectStore.get()).toEqual(initial);
    await user.click(within(flyout).getByRole('button', { name: 'Bereich schliessen' }));
    await settleLayout();
    expect(screen.queryByRole('region', { name: /Personen auswählen/ })).not.toBeInTheDocument();
    expect(viewport?.style.transform).toBe(transform);
    expect(graphNode?.style.transform).toBe(cardTransform);
    expect(opener).toHaveFocus();
  });

  it('keeps drag frames local, skips card content redraws, and saves one undoable gesture', async () => {
    const user = userEvent.setup();
    replaceProject(fixture());
    const initial = structuredClone(projectStore.get());
    render(
      <>
        <HistoryButtons />
        <PlanningPage />
      </>,
    );
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    await settleLayout();
    const grip = card.querySelector<HTMLElement>('.card-grip');
    if (!grip) throw new Error('Fictional card grip missing');
    const graphNode = card.closest<HTMLElement>('.react-flow__node');
    const beforeTransform = graphNode?.style.transform;
    const writes = vi.spyOn(Storage.prototype, 'setItem');
    try {
      // React Flow uses d3 mouse gestures on desktop. These are real graph events.
      mouse(grip, 'mousedown', { button: 0, buttons: 1, clientX: 100, clientY: 100 });
      mouse(window, 'mousemove', { buttons: 1, clientX: 130, clientY: 130 });
      mouse(window, 'mousemove', { buttons: 1, clientX: 140, clientY: 135 });
      await waitFor(() => expect(graphNode?.style.transform).not.toBe(beforeTransform));
      const afterSelection = new Map(renderCounts);
      for (const [clientX, clientY] of [
        [150, 140],
        [190, 170],
        [240, 190],
      ]) {
        mouse(window, 'mousemove', { buttons: 1, clientX, clientY });
        expect(projectStore.get()).toEqual(initial);
        expect(writes.mock.calls.filter(([key]) => key === PROJECT_KEY)).toHaveLength(0);
      }
      expect(renderCounts).toEqual(afterSelection);
      mouse(window, 'mouseup', { button: 0, clientX: 240, clientY: 190 });
      expect(getBoardPositions(projectStore.get())['fiction-early']).not.toEqual(
        initial.board?.positions['fiction-early'],
      );
      expect(projectStore.get().dets).toEqual(initial.dets);
      expect(writes.mock.calls.filter(([key]) => key === PROJECT_KEY)).toHaveLength(1);
      await user.click(screen.getByRole('button', { name: 'Rückgängig' }));
      expect(projectStore.get()).toEqual(initial);
      expect(screen.getByRole('button', { name: 'Rückgängig' })).toBeDisabled();
    } finally {
      writes.mockRestore();
    }
  });
});
