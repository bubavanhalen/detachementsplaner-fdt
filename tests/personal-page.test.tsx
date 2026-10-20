import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { XLSX } from '../src/io/workbook';
import { createDetachment, createProject } from '../src/model';
import { ImportDialog } from '../src/pages/ImportDialog';
import PersonalPage from '../src/pages/PersonalPage';
import { projectStore } from '../src/store';

// Wholly fictional people and lists; nothing here resembles real MILO data.

function fixture() {
  const project = createProject();
  project.service = { start: '2026-11-02', end: '2026-11-20', year: '2026', note: '' };
  project.persons = [
    {
      id: 'a',
      name: 'Fiktiv Alpha',
      grad: 'Wm',
      funktion: 'Motf',
      lics: ['B'],
      pnr: 'TEST-001',
      dt: '3',
      dtStand: '2026-11-02',
      geburtsdatum: '2001-11-10',
      miloStatus: 'Eingerückt',
      milo: true,
      raw: {},
      planning: { status: 'included' as const, reason: '' },
    },
    {
      id: 'b',
      name: 'Fiktiv Bravo',
      grad: 'Sdt',
      funktion: 'Motf',
      lics: ['C'],
      pnr: 'TEST-002',
      miloStatus: 'Nicht eingerückt',
      milo: true,
      raw: {},
      planning: { status: 'included' as const, reason: '' },
    },
  ];
  project.dets = [
    createDetachment({
      id: 'wache',
      name: 'Fiktive Wache',
      datum: '2026-11-09',
      bisDatum: '2026-11-10',
    }),
  ];
  project.assign = { wache: ['a'] };
  return project;
}
function workbook(rows: string[][]): XLSX.WorkBook {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Fiktiv');
  return book;
}

describe('personnel page', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-04T09:00:00'));
    projectStore.setState(() => fixture());
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
  afterEach(() => {
    vi.useRealTimers();
  });

  it('warns about an out-of-date MILO list and lists Dienstvollender, birthdays and drivers', () => {
    projectStore.setState((project) => ({
      ...project,
      milo: { stand: '2026-11-02', listen: {}, absences: [], commands: [], statusEingerueckt: {} },
    }));
    render(<PersonalPage />);
    expect(screen.getByRole('status').textContent).toContain('2 Tage out of date');
    expect(screen.getByText('05.11.2026')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Geburtstage/ }));
    expect(screen.getByText('25')).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: /Fahrer/ }));
    expect(screen.getByText('Wm Fiktiv Alpha')).toBeTruthy();
    expect(screen.queryByText('Sdt Fiktiv Bravo')).toBeNull();
    fireEvent.click(screen.getByRole('checkbox', { name: /Nicht verfügbare Fahrer/ }));
    expect(screen.getByText('MILO: Nicht eingerückt')).toBeTruthy();
  });

  it('marks a guard detachement and lists the commands still to enter in MILO', () => {
    render(<PersonalPage />);
    fireEvent.click(screen.getByRole('tab', { name: /Wache/ }));
    expect(screen.getByText('Keine Wachdetachemente markiert.')).toBeTruthy();
    act(() => {
      fireEvent.click(screen.getByRole('checkbox', { name: /Fiktive Wache/ }));
    });
    expect(projectStore.get().dets[0].miloKommandierung).toBe(true);
    expect(screen.getByText('in MILO kommandieren')).toBeTruthy();
  });

  it('shows the comparison before a MILO roster is taken over', () => {
    const onClose = vi.fn();
    render(
      <ImportDialog
        workbook={workbook([
          ['Name', 'AHV', 'NZL', 'Status'],
          ['Alpha, Fiktiv', 'TEST-001', '1', 'Eingerückt'],
        ])}
        source="milo"
        filename="fiktiv.xlsx"
        onClose={onClose}
      />,
    );
    expect(screen.getByText(/nicht mehr in MILO/).textContent).toContain('1');
    expect(screen.getByLabelText('Eingerückt')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Abgleich übernehmen/ }));
    const project = projectStore.get();
    expect(project.persons[0]).toMatchObject({ dt: '1', dtStand: '2026-11-04' });
    expect(project.persons[1].nichtInMilo).toBe('2026-11-04');
    expect(project.milo?.statusEingerueckt).toEqual({ eingerückt: true });
    expect(onClose).toHaveBeenCalledWith(true);
  });

  it('takes over a MILO leave list without creating people', () => {
    render(
      <ImportDialog
        workbook={workbook([
          ['Name', 'AHV', 'Von', 'Bis', 'Art'],
          ['Alpha, Fiktiv', 'TEST-001', '09.11.2026', '10.11.2026', 'Urlaub'],
          ['Unbekannt, Fiktiv', 'TEST-999', '09.11.2026', '', 'Urlaub'],
        ])}
        source="urlaub"
        filename="fiktiv-urlaub.xlsx"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Zeilen ohne passende Person/).textContent).toContain(
      'Fiktiv Unbekannt',
    );
    fireEvent.click(screen.getByRole('button', { name: /Liste übernehmen/ }));
    const project = projectStore.get();
    expect(project.persons).toHaveLength(2);
    expect(project.milo?.absences).toMatchObject([
      { personId: 'a', von: '2026-11-09', bis: '2026-11-10' },
    ]);
  });
});
