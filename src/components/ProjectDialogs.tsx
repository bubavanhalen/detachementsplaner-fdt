import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { exportJson } from '../io/exports';
import { displayDate, localError } from '../io/text';
import type { Project } from '../model/types';
import { ImportDialog } from '../pages/ImportDialog';
import { changeProject, notify, replaceProject, useProject } from '../store';
import { openOverlay, useOverlays } from '../ui';
import { ErrorBox, Modal } from './Modal';

/** Project-level dialogs can be opened from anywhere: sidebar, palette, or pages. */
export function ProjectDialogs() {
  const overlays = useOverlays();
  const navigate = useNavigate();
  return (
    <>
      {overlays.incoming && (
        <ProjectSwitchDialog
          incoming={overlays.incoming}
          onClose={() => openOverlay({ incoming: null })}
        />
      )}
      {overlays.service && <ServiceDialog onClose={() => openOverlay({ service: false })} />}
      {overlays.workbook && (
        <ImportDialog
          workbook={overlays.workbook.value}
          source={overlays.workbook.source}
          filename={overlays.workbook.filename}
          onClose={(imported) => {
            openOverlay({ workbook: null });
            if (imported) void navigate({ to: '/' });
          }}
        />
      )}
    </>
  );
}

function ProjectSwitchDialog({ incoming, onClose }: { incoming: Project; onClose: () => void }) {
  const project = useProject();
  const navigate = useNavigate();
  const empty = !project.persons.length && !project.dets.length;
  const switchTo = () => {
    replaceProject(incoming);
    onClose();
    notify(`«${incoming.name}» geöffnet.`, { tone: 'success' });
    void navigate({
      to: incoming.archive ? '/persons' : incoming.persons.length ? '/' : '/sources',
    });
  };
  return (
    <Modal
      title={empty ? 'Projekt öffnen' : 'Aktives Projekt ersetzen?'}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          {empty ? (
            <button type="button" className="btn btn-primary" onClick={switchTo}>
              Öffnen
            </button>
          ) : (
            <>
              <button type="button" className="btn" onClick={switchTo}>
                Ohne Sicherung wechseln
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  exportJson(project);
                  switchTo();
                }}
              >
                Sichern & wechseln
              </button>
            </>
          )}
        </>
      }
    >
      <div className="callout">
        <div className="callout-body">
          <strong>{incoming.name}</strong>
          {incoming.persons.length} Personen · {incoming.dets.length} Detachemente
          {incoming.archive
            ? ` · Archiv vom ${new Date(incoming.archive.at).toLocaleDateString('de-CH')}`
            : ''}
        </div>
      </div>
      {!empty && (
        <p>
          «{project.name}» wird ersetzt. Sichere den aktuellen Stand vorher als lokale JSON-Datei,
          wenn du ihn später wieder brauchst.
        </p>
      )}
    </Modal>
  );
}

export function ServiceDialog({ onClose }: { onClose: () => void }) {
  const project = useProject(),
    [error, setError] = useState('');
  const form = useForm({
    defaultValues: {
      name: project.name,
      unit: project.settings.eigeneEinheit,
      start: project.service.start,
      end: project.service.end,
      note: project.service.note,
    },
    onSubmit: ({ value }) => {
      try {
        if (!value.name.trim()) throw new Error('Bitte eine Bezeichnung eingeben.');
        if (value.start && value.end && value.end < value.start)
          throw new Error('Das Ende liegt vor dem Beginn.');
        changeProject((draft) => {
          draft.name = value.name.trim();
          draft.settings.eigeneEinheit = value.unit.trim();
          draft.service = {
            ...draft.service,
            start: value.start,
            end: value.end,
            note: value.note,
          };
        });
        notify('Dienstleistung gespeichert.', { tone: 'success' });
        onClose();
      } catch (failure) {
        setError(localError(failure));
      }
    },
  });
  return (
    <Modal
      title="Dienstleistung bearbeiten"
      description="Alle Angaben sind optional und nur für deine Übersicht."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form="service-form" className="btn btn-primary">
            Speichern
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <form
        id="service-form"
        onSubmit={(event) => {
          event.preventDefault();
          void form.handleSubmit();
        }}
      >
        <div className="form-grid">
          {(
            [
              ['name', 'Bezeichnung', 'text', 'z. B. WK 2027'],
              ['unit', 'Einheit', 'text', 'z. B. Inf Kp 12/3'],
              ['start', 'Beginn', 'date', ''],
              ['end', 'Ende', 'date', ''],
              ['note', 'Planungsnotiz', 'text', ''],
            ] as const
          ).map(([key, label, type, placeholder]) => (
            <form.Field key={key} name={key}>
              {(field) => (
                <label className={`field ${key === 'note' || key === 'name' ? 'span-all' : ''}`}>
                  {label}
                  <input
                    type={type}
                    value={field.state.value}
                    placeholder={placeholder}
                    onChange={(event) => field.handleChange(event.target.value)}
                  />
                </label>
              )}
            </form.Field>
          ))}
        </div>
      </form>
    </Modal>
  );
}

export function servicePeriod(project: Project): string {
  const { start, end } = project.service;
  if (!start && !end) return '';
  return `${start ? displayDate(start) : '…'} – ${end ? displayDate(end) : '…'}`;
}
