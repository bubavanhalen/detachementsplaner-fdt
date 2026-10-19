// «Dienst und Einheit» with wholly fictional persons and file bytes.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ServiceDialog } from '../src/components/ServiceDialog';
import { createProject, MAX_BILD_BYTES, normalizeProject } from '../src/model';
import { createTbState } from '../src/model/tagesbefehl';
import type { Person } from '../src/model/types';
import { projectStore } from '../src/store';

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);

function person(id: string, patch: Partial<Person> = {}): Person {
  return {
    id,
    name: `Fiktiv ${id}`,
    grad: 'Lt',
    funktion: 'Zugführer',
    lics: [],
    raw: {},
    vorname: id,
    nachname: 'Fiktiv',
    planning: { status: 'included', reason: '' },
    ...patch,
  };
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

describe('Dienst und Einheit', () => {
  it('maintains service, unit, commander and pictures in one place', async () => {
    const user = userEvent.setup({ applyAccept: false });
    const project = createProject();
    project.persons = [
      person('Anna', { grad: 'Hptm', funktion: 'Kommandant' }),
      person('Beat', { grad: 'Oblt', funktion: 'Kommandant Stellvertreter' }),
    ];
    projectStore.setState(() => project);
    const onClose = vi.fn();
    render(<ServiceDialog onClose={onClose} />);

    // Pasting keeps the test fast; typing behaviour is covered by the shared inputs.
    const fill = async (label: string, value: string) => {
      await user.clear(screen.getByLabelText(label));
      await user.click(screen.getByLabelText(label));
      await user.paste(value);
    };
    await fill('Bezeichnung', 'WK 2031');
    await fill('Einheit', ' Fiktiv Kp 9/9 ');
    await fill('Übergeordnete Einheit', 'Fiktiv Bat 9');
    await fill('Dateikürzel', 'WK_2031');
    expect(screen.getByText(/Tagesbefehle_KVK_WK_2031\.xlsx/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Kommandant aus Personenliste'), 'Anna');
    const kdt = within(screen.getByRole('group', { name: 'Kommandant' }));
    expect(kdt.getByLabelText('Grad')).toHaveValue('Hptm');
    expect(kdt.getByLabelText('Vorname')).toHaveValue('Anna');
    expect(kdt.getByLabelText('Name')).toHaveValue('Fiktiv');
    await user.upload(
      screen.getByLabelText('Wappen (PNG) wählen'),
      new File([PNG_BYTES], 'fiktives-wappen.png', { type: 'image/png' }),
    );
    expect(await screen.findByAltText('Wappen des Dienstes')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));

    const saved = projectStore.get();
    expect(onClose).toHaveBeenCalledOnce();
    expect(saved.name).toBe('WK 2031');
    expect(saved.stamm.einheit).toBe('Fiktiv Kp 9/9');
    expect(saved.stamm.uebergeordneteEinheit).toBe('Fiktiv Bat 9');
    expect(saved.stamm.dateikuerzel).toBe('WK_2031');
    expect(saved.stamm.kader).toEqual([
      {
        rolle: 'kdt',
        personId: 'Anna',
        grad: 'Hptm',
        vorname: 'Anna',
        name: 'Fiktiv',
        funktion: 'Kommandant',
      },
    ]);
    expect(saved.stamm.grafiken.wappen?.name).toBe('fiktives-wappen.png');
    // The pictures travel with the project file and survive a reload.
    expect(normalizeProject(JSON.parse(JSON.stringify(saved))).stamm).toEqual(saved.stamm);
  });

  it('asks to check a migrated commander and clears the hint on saving', async () => {
    const user = userEvent.setup();
    const project = normalizeProject({
      ...createProject(),
      v: 5,
      stamm: undefined,
      tb: { ...createTbState(), settings: { kdtName: 'Hptm Hans Muster' } },
    });
    projectStore.setState(() => project);
    render(<ServiceDialog onClose={() => {}} />);
    expect(screen.getByTestId('kader-pruefen-kdt')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().stamm.kader[0]).not.toHaveProperty('pruefen');
    expect(projectStore.get().stamm.kader[0]).toMatchObject({ grad: 'Hptm', name: 'Muster' });
  });

  it('shows differences to the person list and takes them over only on request', async () => {
    const user = userEvent.setup();
    const project = createProject();
    project.persons = [person('Anna', { grad: 'Maj', funktion: 'Kommandant' })];
    project.stamm.kader = [
      {
        rolle: 'kdt',
        personId: 'Anna',
        grad: 'Hptm',
        vorname: 'Anna',
        name: 'Fiktiv',
        funktion: 'Kommandant',
      },
    ];
    projectStore.setState(() => project);
    render(<ServiceDialog onClose={() => {}} />);
    expect(screen.getByTestId('kader-abweichung-kdt')).toHaveTextContent('Grad');
    expect(projectStore.get().stamm.kader[0].grad).toBe('Hptm');
    await user.click(screen.getByRole('button', { name: 'Aus Personenliste übernehmen' }));
    expect(screen.queryByTestId('kader-abweichung-kdt')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Speichern' }));
    expect(projectStore.get().stamm.kader[0].grad).toBe('Maj');
  });

  it('rejects pictures that are not PNG or too large, without changing the project', async () => {
    const user = userEvent.setup({ applyAccept: false });
    projectStore.setState(() => createProject());
    render(<ServiceDialog onClose={() => {}} />);
    await user.upload(
      screen.getByLabelText('Unterschrift (PNG) wählen'),
      new File(['kein Bild'], 'fiktiv.png', { type: 'image/png' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('PNG-Datei');
    const large = new Uint8Array(MAX_BILD_BYTES + 1);
    large.set(PNG_BYTES);
    await user.upload(
      screen.getByLabelText('Wappen (PNG) wählen'),
      new File([large], 'gross.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('grösser als 512 KB'));
    expect(screen.getByTestId('stamm-bild-wappen')).toHaveTextContent('Noch nicht gespeichert');
    expect(projectStore.get().stamm.grafiken).toEqual({});
  });
});
