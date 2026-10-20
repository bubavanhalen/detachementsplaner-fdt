// Wholly fictional fixtures only.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyIntakeFiles, createProject, EINGANG_FORMAT, pendenzenOf } from '../src/model';
import PendenzenPage from '../src/pages/PendenzenPage';
import { changeProject, projectStore, undoProject } from '../src/store';

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
  projectStore.setState(() => createProject());
});

describe('Pendenzen page', () => {
  it('captures a Pendenz with its channel and completes it', async () => {
    const user = userEvent.setup();
    render(<PendenzenPage />);
    expect(screen.getByText('Noch keine Pendenzen.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Neue Pendenz'), 'Fw zurückrufen');
    await user.selectOptions(screen.getByLabelText('Eingang über'), 'anruf');
    await user.type(screen.getByLabelText('Von'), 'Fw Fiktiv');
    await user.click(screen.getByRole('button', { name: 'Erfassen' }));
    const group = screen.getByRole('region', { name: 'Ohne Termin' });
    expect(within(group).getByText('Fw zurückrufen')).toBeInTheDocument();
    expect(within(group).getByText('Anruf')).toBeInTheDocument();
    expect(pendenzenOf(projectStore.get())[0].quellen[0]).toMatchObject({
      kanal: 'anruf',
      von: 'Fw Fiktiv',
    });

    await user.click(screen.getByLabelText('Fw zurückrufen erledigt'));
    expect(pendenzenOf(projectStore.get())[0].status).toBe('erledigt');
    // Active view hides it; undo brings it back.
    expect(screen.queryByText('Fw zurückrufen')).not.toBeInTheDocument();
    undoProject();
    expect(await screen.findByText('Fw zurückrufen')).toBeInTheDocument();
  });

  it('shows agent changes as new and logs the state of affairs', async () => {
    const user = userEvent.setup();
    const project = projectStore.get();
    changeProject((draft) => {
      applyIntakeFiles(draft, [
        {
          datei: 'a.json',
          text: JSON.stringify({
            format: EINGANG_FORMAT,
            version: 1,
            projektId: project.id,
            agent: 'Mail-Agent',
            aenderungen: [
              {
                aktion: 'neu',
                pendenz: { titel: 'Unterkunft Fiktivdorf bestätigen', prio: 'hoch' },
                quelle: { kanal: 'mail', ref: 'm-1', von: 'Gemeinde Fiktivdorf' },
                notiz: 'Antwort bis Freitag erbeten.',
              },
            ],
          }),
        },
      ]);
    });
    render(<PendenzenPage />);
    const group = screen.getByRole('region', { name: 'Neu vom Agent' });
    expect(within(group).getByText('Unterkunft Fiktivdorf bestätigen')).toBeInTheDocument();
    expect(within(group).getByText('Antwort bis Freitag erbeten.')).toBeInTheDocument();

    await user.click(screen.getByText('Unterkunft Fiktivdorf bestätigen'));
    const dialog = screen.getByRole('dialog');
    await user.type(within(dialog).getByLabelText('Neuer Stand'), 'Gemeinde angerufen.');
    await user.click(within(dialog).getByRole('button', { name: 'Stand ergänzen' }));
    expect(within(dialog).getByText('Gemeinde angerufen.')).toBeInTheDocument();
    const stored = pendenzenOf(projectStore.get())[0];
    expect(stored.neu).toBe(false);
    expect(stored.verlauf.map((entry) => entry.autor)).toEqual(['agent', 'ich']);
  });
});
