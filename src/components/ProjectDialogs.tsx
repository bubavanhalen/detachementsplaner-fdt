import { useNavigate } from '@tanstack/react-router';
import { exportJson } from '../io/exports';
import { displayDate } from '../io/text';
import type { Project } from '../model/types';
import { ImportDialog } from '../pages/ImportDialog';
import { notify, replaceProject, useProject } from '../store';
import { openOverlay, useOverlays } from '../ui';
import { Modal } from './Modal';
import { ServiceDialog } from './ServiceDialog';

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

export function servicePeriod(project: Project): string {
  const { start, end } = project.service;
  if (!start && !end) return '';
  return `${start ? displayDate(start) : '…'} – ${end ? displayDate(end) : '…'}`;
}
