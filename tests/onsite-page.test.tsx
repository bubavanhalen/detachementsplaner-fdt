// Wholly fictional people and detachements only.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addSubDets,
  archiveSnapshot,
  moveToSubDet,
  onsiteView,
  projectSignature,
  subDetsOf,
} from '../src/model';
import OnsitePage from '../src/pages/OnsitePage';
import PlanningPage from '../src/pages/PlanningPage';
import { projectStore, replaceProject } from '../src/store';
import { openOverlay, overlayStore } from '../src/ui';
import { onsiteFixture } from './onsite-fixtures';

const mocks = vi.hoisted(() => ({ download: vi.fn(), navigate: vi.fn() }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to, className }: { children: ReactNode; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  useNavigate: () => mocks.navigate,
}));
vi.mock('../src/io/exports', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/io/exports')>()),
  download: mocks.download,
}));

beforeEach(() => {
  mocks.download.mockReset();
  mocks.navigate.mockReset();
  overlayStore.setState((old) => ({ ...old, onsiteIntent: null }));
});

describe('on-site page', () => {
  it('splits a detachement into the usual sub-groups and assigns people quickly', async () => {
    const user = userEvent.setup();
    replaceProject(onsiteFixture());
    const signature = projectSignature(projectStore.get());
    render(<OnsitePage />);
    expect(screen.getByRole('heading', { name: 'Fiktiv KVK' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Det Mat, Det VT, Det Kp erstellen' }));
    const [mat, vt, kp] = subDetsOf(projectStore.get(), 'kvk');
    expect([mat.name, vt.name, kp.name]).toEqual(['Det Mat', 'Det VT', 'Det Kp']);

    // One click per person.
    const berta = screen.getByRole('group', { name: 'Untergruppe für Berta Beispiel' });
    await user.click(within(berta).getByRole('button', { name: 'Det Mat' }));
    expect(onsiteView(projectStore.get(), 'kvk').placement.get('p-wm')).toBe(mat.id);
    expect(within(berta).getByRole('button', { name: 'Det Mat' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // One key per person, typed straight through: the focus moves on with every key.
    screen.getByRole('checkbox', { name: 'Anton Fiktiv auswählen' }).focus();
    await user.keyboard('23');
    expect(onsiteView(projectStore.get(), 'kvk').placement.get('p-lt')).toBe(vt.id);
    expect(onsiteView(projectStore.get(), 'kvk').placement.get('p-four')).toBe(kp.id);
    expect(screen.getByRole('checkbox', { name: 'Berta Beispiel auswählen' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('checkbox', { name: 'Emil Test auswählen' })).toHaveFocus();

    // Everyone still open goes to one sub-group at once.
    await user.click(
      within(screen.getByRole('group', { name: 'Anzeige' })).getByRole('button', {
        name: /^Nicht eingeteilt/,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Alle Treffer auswählen' }));
    expect(screen.getByText('2 ausgewählt')).toBeInTheDocument();
    const bar = screen.getByText('2 ausgewählt').closest('.picker-bar') as HTMLElement;
    await user.click(within(bar).getByRole('button', { name: 'Det Kp' }));
    const view = onsiteView(projectStore.get(), 'kvk');
    expect(view.unassigned).toEqual([]);
    expect(view.groups.map((group) => group.people.length)).toEqual([1, 1, 3]);

    // Leader and task are kept per sub-group; the PISA handover is untouched.
    const tile = screen.getByRole('article', { name: 'Det Mat' });
    await user.selectOptions(within(tile).getByRole('combobox', { name: 'Chef' }), 'p-sdt1');
    expect(subDetsOf(projectStore.get(), 'kvk')[0].chefId).toBe('p-sdt1');
    expect(onsiteView(projectStore.get(), 'kvk').placement.get('p-sdt1')).toBe(mat.id);
    const task = within(tile).getByRole('textbox', { name: 'Auftrag Det Mat' });
    await user.type(task, 'Fassung{Enter}');
    expect(subDetsOf(projectStore.get(), 'kvk')[0].auftrag).toBe('Fassung');
    expect(projectSignature(projectStore.get())).toBe(signature);
  });

  it('prints, exports and copies the list of one sub-group', async () => {
    const user = userEvent.setup();
    const project = onsiteFixture();
    const [mat] = addSubDets(project, 'kvk', ['Det Mat', 'Det VT']);
    moveToSubDet(project, 'kvk', mat.id, ['p-wm', 'p-sdt1']);
    replaceProject(project);
    const print = vi.fn();
    window.print = print;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<OnsitePage />);
    await user.click(screen.getByRole('tab', { name: /Liste ausgeben/ }));
    expect(screen.getByRole('article', { name: 'Liste Fiktiv KVK' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Umfang' }), mat.id);
    const sheet = screen.getByRole('article', { name: 'Liste Fiktiv KVK · Det Mat' });
    expect(within(sheet).getByText('+41 00 000 00 01')).toBeInTheDocument();
    expect(within(sheet).queryByText('Dario')).not.toBeInTheDocument();

    const title = document.title;
    await user.click(screen.getByRole('button', { name: /Drucken \/ PDF/ }));
    expect(print).toHaveBeenCalledOnce();
    expect(document.documentElement).toHaveClass('det-print');
    expect(document.title).toMatch(/^Fiktiv_KVK_Det_Mat_/);
    fireEvent(window, new Event('afterprint'));
    expect(document.documentElement).not.toHaveClass('det-print');
    expect(document.title).toBe(title);

    await user.click(screen.getByRole('button', { name: /Excel/ }));
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.download.mock.calls[0][0]).toMatch(/^Fiktiv_KVK_Det_Mat_\d{4}-\d{2}-\d{2}\.xlsx$/);

    await user.click(screen.getByRole('button', { name: /Als Text kopieren/ }));
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('Det Mat – 2 Pers.');

    await user.click(screen.getByRole('button', { name: 'Telefon' }));
    expect(
      within(screen.getByRole('article', { name: 'Liste Fiktiv KVK · Det Mat' })).queryByText(
        '+41 00 000 00 01',
      ),
    ).not.toBeInTheDocument();
  });

  it('opens the detachement requested from a planning card', async () => {
    const user = userEvent.setup();
    const project = onsiteFixture();
    const [mat] = addSubDets(project, 'kvk', ['Det Mat']);
    moveToSubDet(project, 'kvk', mat.id, ['p-wm']);
    replaceProject(project);
    render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    expect(within(card).getByText('Det Mat 1')).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Aktionen für Fiktiv KVK' }));
    await user.click(screen.getByRole('menuitem', { name: 'Vor Ort aufteilen …' }));
    expect(overlayStore.get().onsiteIntent).toEqual({ id: 'kvk' });
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/vor-ort' });
  });

  it('selects a requested detachement and stays read-only in an archive', () => {
    const project = onsiteFixture();
    addSubDets(project, 'wk', ['Det Kp']);
    replaceProject(archiveSnapshot(project));
    openOverlay({ onsiteIntent: { id: 'wk' } });
    render(<OnsitePage />);
    expect(screen.getByRole('heading', { name: 'Fiktiv WK' })).toBeInTheDocument();
    expect(overlayStore.get().onsiteIntent).toBeNull();
    expect(screen.getByRole('button', { name: /Det Mat/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Det Kp entfernen' })).toBeDisabled();
    const row = screen.getByRole('group', { name: 'Untergruppe für Fritz Probe' });
    for (const button of within(row).getAllByRole('button')) expect(button).toBeDisabled();
  });
});
