// Wholly fictional people and detachements only.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addSubDets,
  archiveSnapshot,
  createEvent,
  moveToSubDet,
  onsiteView,
  projectSignature,
  subDetsOf,
} from '../src/model';
import type { Project } from '../src/model/types';
import OnsitePage from '../src/pages/OnsitePage';
import PlanningPage from '../src/pages/PlanningPage';
import { projectStore, replaceProject } from '../src/store';
import { openOverlay, overlayStore } from '../src/ui';
import { onsiteFixture, withSecondKvk } from './onsite-fixtures';

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
  mocks.download.mockReset();
  mocks.navigate.mockReset();
  overlayStore.setState((old) => ({ ...old, onsiteIntent: null }));
});

function withEvent(project: Project, detIds = ['kvk'], name = 'KVK') {
  const event = createEvent(project, { name, von: '2027-04-26', bis: '2027-04-30', detIds });
  return { project, event };
}

describe('on-site page', () => {
  it('creates an event filtered by a PISA detachement and splits it quickly', async () => {
    const user = userEvent.setup();
    replaceProject(onsiteFixture());
    const signature = projectSignature(projectStore.get());
    render(<OnsitePage />);
    expect(screen.getByRole('heading', { name: 'Noch kein Event.' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Neues Event/ }));
    const dialog = screen.getByRole('dialog', { name: 'Neues Event' });
    await user.type(within(dialog).getByRole('textbox', { name: 'Name' }), 'KVK');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Fiktiv KVK (EC K1)' }));
    fireEvent.change(within(dialog).getByLabelText('Von'), { target: { value: '2027-04-26' } });
    fireEvent.change(within(dialog).getByLabelText('Bis'), { target: { value: '2027-04-30' } });
    await user.click(within(dialog).getByRole('button', { name: 'Event erstellen' }));
    const [event] = projectStore.get().onsiteEvents ?? [];
    expect(event).toMatchObject({
      name: 'KVK',
      von: '2027-04-26',
      bis: '2027-04-30',
      detIds: ['kvk'],
    });
    expect(screen.getByRole('textbox', { name: 'Name des Events' })).toHaveValue('KVK');

    await user.click(screen.getByRole('button', { name: 'Det Mat, Det VT, Det Kp erstellen' }));
    const [mat, vt, kp] = subDetsOf(projectStore.get(), event.id);
    // One click per person.
    const berta = screen.getByRole('group', { name: 'Untergruppe für Berta Beispiel' });
    await user.click(within(berta).getByRole('button', { name: 'Det Mat' }));
    expect(onsiteView(projectStore.get(), event.id).placement.get('p-wm')).toBe(mat.id);
    // One key per person, typed straight through: the focus moves on with every key.
    screen.getByRole('checkbox', { name: 'Anton Fiktiv auswählen' }).focus();
    await user.keyboard('23');
    expect(onsiteView(projectStore.get(), event.id).placement.get('p-lt')).toBe(vt.id);
    expect(onsiteView(projectStore.get(), event.id).placement.get('p-four')).toBe(kp.id);
    expect(screen.getByRole('checkbox', { name: 'Berta Beispiel auswählen' })).toHaveFocus();
    await user.keyboard('{ArrowUp}');
    expect(screen.getByRole('checkbox', { name: 'Emil Test auswählen' })).toHaveFocus();
    // Everyone still open goes to one detachement at once.
    await user.click(
      within(screen.getByRole('group', { name: 'Anzeige' })).getByRole('button', {
        name: /^Nicht eingeteilt/,
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Alle Treffer auswählen' }));
    const bar = screen.getByText('2 ausgewählt').closest('.picker-bar') as HTMLElement;
    await user.click(within(bar).getByRole('button', { name: 'Det Kp' }));
    const view = onsiteView(projectStore.get(), event.id);
    expect(view.unassigned).toEqual([]);
    expect(view.groups.map((group) => group.people.length)).toEqual([1, 1, 3]);
    // Leader and task per detachement; the PISA handover is untouched.
    const tile = screen.getByRole('article', { name: 'Det Mat' });
    await user.selectOptions(within(tile).getByRole('combobox', { name: 'Chef' }), 'p-sdt1');
    expect(subDetsOf(projectStore.get(), event.id)[0].chefId).toBe('p-sdt1');
    await user.type(
      within(tile).getByRole('textbox', { name: 'Auftrag Det Mat' }),
      'Fassung{Enter}',
    );
    expect(subDetsOf(projectStore.get(), event.id)[0].auftrag).toBe('Fassung');
    expect(projectSignature(projectStore.get())).toBe(signature);
  });

  it('filters by PISA detachements and shows where people come from', async () => {
    const user = userEvent.setup();
    const { project, event } = withEvent(withSecondKvk(onsiteFixture()));
    addSubDets(project, event.id, ['Det Mat']);
    replaceProject(project);
    render(<OnsitePage />);
    const filter = screen.getByRole('group', { name: 'PISA-Detachemente' });
    expect(within(filter).getByRole('button', { name: /^Fiktiv KVK5/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.queryByText(/Fiktiv KVK Ost ·/)).not.toBeInTheDocument();
    await user.click(within(filter).getByRole('button', { name: /^Fiktiv KVK Ost/ }));
    expect(projectStore.get().onsiteEvents?.[0].detIds).toEqual(['kvk', 'kvk-ost']);
    expect(onsiteView(projectStore.get(), event.id).pool).toHaveLength(7);
    // People now come from two PISA detachements, so each row names it.
    expect(screen.getByText('Fiktiv KVK Ost · Mat Uof · C')).toBeInTheDocument();
    await user.click(within(filter).getByRole('button', { name: 'Alle' }));
    expect(projectStore.get().onsiteEvents?.[0].detIds).toEqual([]);
    expect(onsiteView(projectStore.get(), event.id).candidates).toHaveLength(8);
  });

  it('copies an event with its detachements and deletes events', async () => {
    const user = userEvent.setup();
    const { project, event } = withEvent(onsiteFixture());
    const [mat] = addSubDets(project, event.id, ['Det Mat']);
    moveToSubDet(project, event.id, mat.id, ['p-wm']);
    replaceProject(project);
    render(<OnsitePage />);
    await user.click(screen.getByRole('button', { name: /Kopieren/ }));
    const events = projectStore.get().onsiteEvents ?? [];
    expect(events.map((item) => item.name)).toEqual(['KVK', 'KVK (Kopie)']);
    expect(screen.getByRole('textbox', { name: 'Name des Events' })).toHaveValue('KVK (Kopie)');
    expect(
      onsiteView(projectStore.get(), events[1].id).groups[0].people.map((item) => item.id),
    ).toEqual(['p-wm']);
    await user.click(screen.getByRole('button', { name: /Löschen/ }));
    expect(projectStore.get().onsiteEvents?.map((item) => item.name)).toEqual(['KVK']);
    expect(subDetsOf(projectStore.get(), events[1].id)).toEqual([]);
    expect(screen.getByRole('textbox', { name: 'Name des Events' })).toHaveValue('KVK');
  });

  it('prints, exports and copies the list of one detachement', async () => {
    const user = userEvent.setup();
    const { project, event } = withEvent(onsiteFixture());
    const [mat] = addSubDets(project, event.id, ['Det Mat', 'Det VT']);
    moveToSubDet(project, event.id, mat.id, ['p-wm', 'p-sdt1']);
    replaceProject(project);
    const print = vi.fn();
    window.print = print;
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    render(<OnsitePage />);
    await user.click(screen.getByRole('tab', { name: /Liste ausgeben/ }));
    const whole = screen.getByRole('article', { name: 'Liste KVK' });
    // People not placed yet stay off the list unless asked for.
    const unassigned = screen.getByRole('checkbox', { name: /Nicht eingeteilte zeigen/ });
    expect(unassigned).not.toBeChecked();
    expect(within(whole).queryByRole('heading', { name: 'Nicht eingeteilt' })).toBeNull();
    await user.click(unassigned);
    expect(within(whole).getByRole('heading', { name: 'Nicht eingeteilt' })).toBeInTheDocument();
    await user.click(unassigned);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Umfang' }), mat.id);
    const sheet = screen.getByRole('article', { name: 'Liste KVK · Det Mat' });
    expect(within(sheet).getByText('+41 00 000 00 01')).toBeInTheDocument();
    expect(within(sheet).queryByText('Dario')).not.toBeInTheDocument();

    const title = document.title;
    await user.click(screen.getByRole('button', { name: /Drucken \/ PDF/ }));
    expect(print).toHaveBeenCalledOnce();
    expect(document.documentElement).toHaveClass('det-print');
    expect(document.title).toMatch(/^KVK_Det_Mat_/);
    fireEvent(window, new Event('afterprint'));
    expect(document.documentElement).not.toHaveClass('det-print');
    expect(document.title).toBe(title);

    await user.click(screen.getByRole('button', { name: /Excel/ }));
    expect(mocks.download).toHaveBeenCalledOnce();
    expect(mocks.download.mock.calls[0][0]).toMatch(/^KVK_Det_Mat_\d{4}-\d{2}-\d{2}\.xlsx$/);

    await user.click(screen.getByRole('button', { name: /Als Text kopieren/ }));
    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0][0]).toContain('Det Mat – 2 Pers.');

    await user.click(screen.getByRole('button', { name: 'Telefon' }));
    expect(
      within(screen.getByRole('article', { name: 'Liste KVK · Det Mat' })).queryByText(
        '+41 00 000 00 01',
      ),
    ).not.toBeInTheDocument();

    // An optional signature column with its own heading, and a text stored with the event.
    const current = () => screen.getByRole('article', { name: 'Liste KVK · Det Mat' });
    expect(within(current()).getByRole('columnheader', { name: 'Zug' })).toBeInTheDocument();
    expect(within(current()).queryByRole('columnheader', { name: 'Visum' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Visum' }));
    expect(within(current()).getByRole('columnheader', { name: 'Visum' })).toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: 'Überschrift der Visum-Spalte' }),
      'Visum Mat',
    );
    expect(within(current()).getByRole('columnheader', { name: 'Visum Mat' })).toBeInTheDocument();
    const note = screen.getByRole('textbox', { name: /Zusatztext auf der Liste/ });
    await user.type(note, 'Der AdA bestätigt den Erhalt von:{Enter}- Schutzmaske{Enter}- Helm');
    await user.tab();
    expect(projectStore.get().onsiteEvents?.[0].hinweis).toBe(
      'Der AdA bestätigt den Erhalt von:\n- Schutzmaske\n- Helm',
    );
    expect(within(current()).getByText('Der AdA bestätigt den Erhalt von:')).toBeInTheDocument();
    expect(
      within(current())
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual(['Schutzmaske', 'Helm']);
  });

  it('opens events from a planning card', async () => {
    const user = userEvent.setup();
    const { project, event } = withEvent(onsiteFixture());
    replaceProject(project);
    render(<PlanningPage />);
    const card = await screen.findByRole('article', { name: 'Detachement Fiktiv KVK' });
    await user.click(within(card).getByText('Vor Ort: KVK'));
    expect(overlayStore.get().onsiteIntent).toEqual({ id: event.id });
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/vor-ort' });
    const other = await screen.findByRole('article', { name: 'Detachement Fiktiv WK' });
    await user.click(within(other).getByRole('button', { name: 'Aktionen für Fiktiv WK' }));
    await user.click(screen.getByRole('menuitem', { name: 'Vor Ort aufteilen …' }));
    expect(overlayStore.get().onsiteIntent).toEqual({ id: 'wk' });
  });

  it('prepares a new event for a card without one, prefilled with its dates', () => {
    replaceProject(onsiteFixture());
    openOverlay({ onsiteIntent: { id: 'kvk' } });
    render(<OnsitePage />);
    const dialog = screen.getByRole('dialog', { name: 'Neues Event' });
    expect(within(dialog).getByRole('textbox', { name: 'Name' })).toHaveValue('Fiktiv KVK');
    expect(within(dialog).getByLabelText('Von')).toHaveValue('2027-04-26');
    expect(within(dialog).getByLabelText('Bis')).toHaveValue('2027-04-30');
    expect(within(dialog).getByRole('checkbox', { name: 'Fiktiv KVK (EC K1)' })).toBeChecked();
    expect(overlayStore.get().onsiteIntent).toBeNull();
  });

  it('stays read-only in an archive', () => {
    const { project, event } = withEvent(onsiteFixture(), ['wk'], 'WK');
    addSubDets(project, event.id, ['Det Kp']);
    replaceProject(archiveSnapshot(project));
    render(<OnsitePage />);
    expect(screen.getByRole('textbox', { name: 'Name des Events' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Neues Event/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Kopieren/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Det Kp entfernen' })).toBeDisabled();
    const row = screen.getByRole('group', { name: 'Untergruppe für Fritz Probe' });
    for (const button of within(row).getAllByRole('button')) expect(button).toBeDisabled();
  });
});
