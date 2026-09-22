import { useForm } from '@tanstack/react-form';
import { useNavigate } from '@tanstack/react-router';
import { useRef, useState } from 'react';
import { Modal } from '../components/Modal';
import { demoProject } from '../io/demo';
import { bundleHtml, download, exportJson, exportName, exportWorkbook } from '../io/exports';
import { readArchives } from '../io/storage';
import { localError, searchText } from '../io/text';
import { readWorkbook, type XLSX } from '../io/workbook';
import { createProject, normalizeProject, projectSignature } from '../model';
import type { Project, Source } from '../model/types';
import {
  archiveCurrent,
  changeProject,
  notify,
  reopenCurrent,
  replaceProject,
  useProject,
} from '../store';
import { ImportDialog } from './ImportDialog';

export let offlineTemplate = '';
export function setOfflineTemplate(value: string): void {
  offlineTemplate = value;
}

export default function FilesPage() {
  const project = useProject(),
    navigate = useNavigate();
  const picker = useRef<HTMLInputElement>(null),
    source = useRef<Source | 'json'>('json');
  const [error, setError] = useState(''),
    [query, setQuery] = useState('');
  const [incoming, setIncoming] = useState<Project | null>(null),
    [archiveOpen, setArchiveOpen] = useState(false),
    [serviceOpen, setServiceOpen] = useState(false);
  const [workbook, setWorkbook] = useState<{
    value: XLSX.WorkBook;
    source: Source;
    filename: string;
  } | null>(null);
  let archives: Project[] = [],
    archiveError = '';
  try {
    archives = readArchives();
  } catch (failure) {
    archiveError = localError(failure);
  }
  const run = (action: () => void) => {
    try {
      action();
      setError('');
    } catch (failure) {
      setError(localError(failure));
    }
  };
  const open = (kind: Source | 'json') => {
    if (!picker.current) return;
    source.current = kind;
    picker.current.accept = kind === 'json' ? '.json' : '.xlsx,.xls,.csv';
    picker.current.value = '';
    picker.current.click();
  };
  const receive = async (file: File) => {
    try {
      if (source.current === 'json') {
        let value: unknown;
        try {
          value = JSON.parse(await file.text());
        } catch {
          throw new Error('Die Datei enthält kein lesbares JSON-Projekt.');
        }
        setIncoming(normalizeProject(value));
      } else
        setWorkbook({
          value: await readWorkbook(file),
          source: source.current,
          filename: file.name,
        });
      setError('');
    } catch (failure) {
      setError(localError(failure));
    }
  };
  const switchTo = () => {
    if (!incoming) return;
    replaceProject(incoming);
    setIncoming(null);
    void navigate({ to: incoming.archive ? '/persons' : '/' });
  };
  const filtered = archives.filter((item) =>
    searchText(
      [item.name, ...item.persons.map((person) => `${person.name} ${person.pnr || ''}`)].join(' '),
    ).includes(searchText(query)),
  );
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">DATEN BLEIBEN HIER</span>
          <h1>Quellen, Sicherungen & Archiv.</h1>
          <p className="muted">
            Dateien werden nur auf diesem Gerät gelesen. Kein Upload, kein Datenserver.
          </p>
        </div>
      </header>
      {error && (
        <div role="alert" className="notice warning">
          {error}
        </div>
      )}
      <input
        ref={picker}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void receive(file);
        }}
      />
      <section className="panel">
        <span className="eyebrow">AKTUELLE DIENSTLEISTUNG</span>
        <h2>{project.name}</h2>
        <p>
          {project.persons.length} Personen · {project.dets.length} Detachemente
        </p>
        <div className="toolbar">
          {!project.archive && (
            <button type="button" className="button" onClick={() => setServiceOpen(true)}>
              Dienstleistung bearbeiten
            </button>
          )}
          <button type="button" className="button primary" onClick={() => exportJson(project)}>
            JSON sichern
          </button>
          <button
            type="button"
            className="button"
            onClick={() =>
              run(() =>
                download(
                  exportName(project, 'html'),
                  bundleHtml(offlineTemplate, project),
                  'text/html',
                ),
              )
            }
          >
            Offline-HTML mit Daten
          </button>
          <button
            type="button"
            className="button"
            onClick={() => run(() => exportWorkbook(project))}
          >
            Excel-Arbeitsliste
          </button>
          <button type="button" className="button" onClick={() => window.print()}>
            Drucken
          </button>
        </div>
        <p className="muted">
          Exporte enthalten private Daten. Ausschliesslich lokal speichern; niemals veröffentlichen.
        </p>
      </section>
      <section className="panel">
        <span className="eyebrow">PERSONENLISTEN EINLESEN</span>
        <h2>Mit einer Quelle anfangen.</h2>
        <p className="muted">PISA, MILOFFICE oder beide. Excel und CSV werden lokal verarbeitet.</p>
        <div className="toolbar">
          <button
            type="button"
            className="button"
            disabled={!!project.archive}
            onClick={() => open('pisa')}
          >
            PISA-Liste laden
          </button>
          <button
            type="button"
            className="button"
            disabled={!!project.archive}
            onClick={() => open('milo')}
          >
            MILOFFICE-Liste laden
          </button>
          <button type="button" className="button" onClick={() => open('json')}>
            Projektdatei öffnen
          </button>
        </div>
        {(['pisa', 'milo'] as const).map((key) => (
          <p key={key} className="muted">
            {key.toUpperCase()}:{' '}
            {project.src[key]
              ? `${project.src[key].datei} · ${project.src[key].anz} Zeilen · ${new Date(project.src[key].zeit).toLocaleDateString('de-CH')}`
              : 'Noch keine Quelle geladen'}
          </p>
        ))}
      </section>
      <section className="panel">
        <span className="eyebrow">PLANSTAND ABSCHLIESSEN</span>
        <h2>Nach der Planung schnell nachschlagen.</h2>
        <p className="muted">
          Ein Archivstand ist schreibgeschützt. Zum Weiterplanen entsteht eine separate
          Arbeitskopie.
        </p>
        <div className="toolbar">
          {project.archive ? (
            <button
              type="button"
              className="button"
              onClick={() =>
                run(() => {
                  reopenCurrent();
                  void navigate({ to: '/' });
                })
              }
            >
              Als Arbeitskopie öffnen
            </button>
          ) : (
            <button type="button" className="button" onClick={() => setArchiveOpen(true)}>
              Dienstleistung archivieren
            </button>
          )}
          <button type="button" className="button" onClick={() => setIncoming(createProject())}>
            Neue Dienstleistung
          </button>
          {!project.persons.length && !project.dets.length && (
            <button type="button" className="button" onClick={() => setIncoming(demoProject())}>
              Fiktives Beispiel laden
            </button>
          )}
        </div>
      </section>
      <section className="panel">
        <span className="eyebrow">LOKALE ARCHIVABLAGE</span>
        <h2>Frühere Dienstleistungen</h2>
        <label className="field">
          Im Archiv suchen
          <input
            type="search"
            placeholder="Dienstleistung, Person oder Nummer"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {archiveError && (
          <p className="notice warning" role="alert">
            {archiveError}
          </p>
        )}
        {filtered.map((item) => (
          <div className="archive-row" key={item.archive?.id}>
            <div>
              <strong>{item.name}</strong>
              <p className="muted">
                {item.archive ? new Date(item.archive.at).toLocaleDateString('de-CH') : ''} ·{' '}
                {item.persons.length} Personen
              </p>
            </div>
            <button type="button" className="button" onClick={() => setIncoming(item)}>
              Öffnen
            </button>
          </div>
        ))}
        {!filtered.length && !archiveError && (
          <p className="muted">Keine passenden Archivstände auf diesem Gerät.</p>
        )}
      </section>
      {incoming && (
        <Modal
          title="Projekt wechseln"
          onClose={() => setIncoming(null)}
          footer={
            <>
              <button type="button" className="button" onClick={() => setIncoming(null)}>
                Abbrechen
              </button>
              <button type="button" className="button" onClick={switchTo}>
                Ohne Sicherung wechseln
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  exportJson(project);
                  switchTo();
                }}
              >
                Sichern & wechseln
              </button>
            </>
          }
        >
          <p>
            Das aktive Projekt wird durch «{incoming.name}» ersetzt. Sichere den aktuellen Stand
            vorher als lokale Datei.
          </p>
        </Modal>
      )}
      {archiveOpen && (
        <Modal
          title="Dienstleistung archivieren"
          onClose={() => setArchiveOpen(false)}
          footer={
            <>
              <button type="button" className="button" onClick={() => setArchiveOpen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  try {
                    archiveCurrent();
                    setArchiveOpen(false);
                    void navigate({ to: '/persons' });
                  } catch (failure) {
                    setError(localError(failure));
                    setArchiveOpen(false);
                  }
                }}
              >
                Archivieren
              </button>
            </>
          }
        >
          <p>Ein separater, schreibgeschützter Planstand wird auf diesem Gerät gespeichert.</p>
          {project.pisa.verified?.signature !== projectSignature(project) && (
            <div className="notice warning">
              PISA-Abschluss noch nicht bestätigt. Das Archiv bleibt als unvollständiger
              Arbeitsstand erkennbar.
            </div>
          )}
        </Modal>
      )}
      {serviceOpen && <ServiceDialog onClose={() => setServiceOpen(false)} />}
      {workbook && (
        <ImportDialog
          workbook={workbook.value}
          source={workbook.source}
          filename={workbook.filename}
          onClose={() => {
            setWorkbook(null);
            void navigate({ to: '/' });
          }}
        />
      )}
    </div>
  );
}
function ServiceDialog({ onClose }: { onClose: () => void }) {
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
        notify('Dienstleistung gespeichert.');
        onClose();
      } catch (failure) {
        setError(localError(failure));
      }
    },
  });
  return (
    <Modal
      title="Dienstleistung bearbeiten"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button" onClick={onClose}>
            Abbrechen
          </button>
          <button type="submit" form="service-form" className="button primary">
            Speichern
          </button>
        </>
      }
    >
      {error && (
        <div role="alert" className="notice warning">
          {error}
        </div>
      )}
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
              ['name', 'Bezeichnung', 'text'],
              ['unit', 'Einheit', 'text'],
              ['start', 'Beginn', 'date'],
              ['end', 'Ende', 'date'],
              ['note', 'Planungsnotiz', 'text'],
            ] as const
          ).map(([key, label, type]) => (
            <form.Field key={key} name={key}>
              {(field) => (
                <label className="field">
                  {label}
                  <input
                    type={type}
                    value={field.state.value}
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
