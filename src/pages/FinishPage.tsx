import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { Modal } from '../components/Modal';
import { bundleHtml, download, exportJson, exportName, exportWorkbook } from '../io/exports';
import { offlineTemplate } from '../io/offline';
import { readArchives } from '../io/storage';
import { localError, searchText } from '../io/text';
import { projectSignature } from '../model';
import type { Project } from '../model/types';
import { archiveCurrent, notify, reopenCurrent, useProject } from '../store';
import { openOverlay } from '../ui';
import './pages.css';

export default function FinishPage() {
  const project = useProject();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [archiveOpen, setArchiveOpen] = useState(false);
  const verified = project.pisa.verified?.signature === projectSignature(project);
  let archives: Project[] = [],
    archiveError = '';
  try {
    archives = readArchives();
  } catch (failure) {
    archiveError = localError(failure);
  }
  const run = (action: () => void, done: string) => {
    try {
      action();
      notify(done, { tone: 'success' });
    } catch (failure) {
      notify(localError(failure), { tone: 'warning' });
    }
  };
  const filtered = archives
    .filter((item) =>
      searchText(
        [item.name, ...item.persons.map((person) => `${person.name} ${person.pnr || ''}`)].join(
          ' ',
        ),
      ).includes(searchText(query)),
    )
    .sort((a, b) => (b.archive?.at ?? '').localeCompare(a.archive?.at ?? ''));
  const exportsList: {
    icon: IconName;
    title: string;
    text: string;
    badge?: string;
    action: () => void;
    label: string;
  }[] = [
    {
      icon: 'download',
      title: 'Projektdatei (JSON)',
      text: 'Vollständige Sicherung zum späteren Weiterarbeiten oder für ein anderes Gerät.',
      badge: 'Empfohlen',
      label: 'JSON sichern',
      action: () => run(() => exportJson(project), 'JSON-Sicherung lokal gespeichert.'),
    },
    {
      icon: 'sheet',
      title: 'Excel-Arbeitsliste',
      text: 'Detachemente und Personen als Tabelle für die Kaderarbeit.',
      label: 'Excel erstellen',
      action: () => run(() => exportWorkbook(project), 'Excel-Arbeitsliste lokal gespeichert.'),
    },
    {
      icon: 'file',
      title: 'Offline-HTML mit Daten',
      text: 'Eine einzelne Datei inkl. Anwendung – öffnet ohne Installation. Privat halten.',
      label: 'HTML erstellen',
      action: () =>
        run(
          () =>
            download(
              exportName(project, 'html'),
              bundleHtml(offlineTemplate, project),
              'text/html',
            ),
          'Offline-HTML lokal gespeichert.',
        ),
    },
    {
      icon: 'printer',
      title: 'Drucken',
      text: 'Die aktuelle Ansicht drucken oder als PDF auf dem Gerät speichern.',
      label: 'Drucken',
      action: () => window.print(),
    },
  ];
  return (
    <div className="page">
      <section className="page-intro">
        <div>
          <h2>Planstand sichern und ablegen</h2>
          <p>
            Exporte entstehen auf diesem Gerät und enthalten private Daten. Speichere sie nur lokal
            und veröffentliche sie nie.
          </p>
        </div>
      </section>

      {!project.archive &&
        (verified ? (
          <div className="callout callout-success">
            <Icon name="checkCircle" />
            <div className="callout-body">
              <strong>PISA-Abgleich abgeschlossen.</strong>
              Der Planstand ist bereit zum Archivieren.
            </div>
          </div>
        ) : (
          <div className="callout callout-warning">
            <Icon name="info" />
            <div className="callout-body">
              <strong>PISA-Abgleich noch offen.</strong>
              Sichern geht jederzeit. Ein Archiv bleibt sonst als unvollständiger Arbeitsstand
              erkennbar.
            </div>
            <div className="callout-actions">
              <Link to="/pisa" className="btn btn-sm">
                Zum Abgleich
              </Link>
            </div>
          </div>
        ))}

      <section>
        <div className="section-title">
          <h2>Sichern & exportieren</h2>
        </div>
        <div className="export-grid">
          {exportsList.map((item) => (
            <div className="card export-card" key={item.title}>
              <div className="row">
                <span className="export-icon">
                  <Icon name={item.icon} />
                </span>
                {item.badge && <span className="badge badge-accent">{item.badge}</span>}
              </div>
              <h3>{item.title}</h3>
              <p className="muted">{item.text}</p>
              <button type="button" className="btn btn-sm" onClick={item.action}>
                {item.label}
              </button>
            </div>
          ))}
          <div className="card export-card">
            <div className="row">
              <span className="export-icon">
                <Icon name="contact" />
              </span>
            </div>
            <h3>Kontakt-CSV</h3>
            <p className="muted">Auswahl und Vorschau im Google-Kontakte-Format, nur lokal.</p>
            <Link to="/contacts" className="btn btn-sm">
              Kontakte vorbereiten
            </Link>
          </div>
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>
            <Icon name="archive" /> {project.archive ? 'Archivstand' : 'Archivieren'}
          </h2>
          {project.archive && (
            <span className="badge badge-info">
              {new Date(project.archive.at).toLocaleDateString('de-CH')}
            </span>
          )}
        </header>
        <div className="card-body archive-body">
          <p className="text-2">
            {project.archive
              ? 'Dieser Stand ist schreibgeschützt und dient zum Nachschlagen. Zum Weiterplanen entsteht eine separate Arbeitskopie; das Archiv bleibt unverändert.'
              : 'Speichert einen separaten, schreibgeschützten Planstand in diesem Browser. Danach öffnet die Personensuche für schnelles Nachschlagen.'}
          </p>
          {project.archive ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                run(() => {
                  reopenCurrent();
                  void navigate({ to: '/' });
                }, 'Arbeitskopie geöffnet.')
              }
            >
              <Icon name="edit" size={16} /> Als Arbeitskopie öffnen
            </button>
          ) : (
            <button
              type="button"
              className={`btn ${verified ? 'btn-primary' : ''}`}
              onClick={() => setArchiveOpen(true)}
            >
              <Icon name="archive" size={16} /> Dienstleistung archivieren
            </button>
          )}
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>
            <Icon name="folder" /> Frühere Dienstleistungen
          </h2>
          <span className="muted">{archives.length} auf diesem Gerät</span>
        </header>
        <div className="card-body stack">
          {archives.length > 3 && (
            <label className="search-field">
              <Icon name="search" size={16} />
              <input
                type="search"
                aria-label="Im Archiv suchen"
                placeholder="Dienstleistung, Person oder Nummer"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
          {archiveError && (
            <div className="error-box" role="alert">
              <Icon name="alert" />
              {archiveError}
            </div>
          )}
          {filtered.length > 0 && (
            <ul className="archive-list">
              {filtered.map((item) => (
                <li key={item.archive?.id}>
                  <span className="avatar">
                    <Icon name="archive" size={15} />
                  </span>
                  <div className="grow">
                    <strong>{item.name}</strong>
                    <p className="muted">
                      {item.archive ? new Date(item.archive.at).toLocaleDateString('de-CH') : ''} ·{' '}
                      {item.persons.length} Personen · {item.dets.length} Detachemente
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => openOverlay({ incoming: item })}
                  >
                    Öffnen
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!filtered.length && !archiveError && (
            <p className="muted">
              {archives.length
                ? 'Keine passenden Archivstände.'
                : 'Noch keine Archivstände auf diesem Gerät.'}
            </p>
          )}
        </div>
      </section>

      {archiveOpen && (
        <Modal
          title="Dienstleistung archivieren?"
          onClose={() => setArchiveOpen(false)}
          footer={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setArchiveOpen(false)}>
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  try {
                    archiveCurrent();
                    setArchiveOpen(false);
                    notify('Archiviert. Personen können jetzt nachgeschlagen werden.', {
                      tone: 'success',
                    });
                    void navigate({ to: '/persons' });
                  } catch (failure) {
                    setArchiveOpen(false);
                    notify(localError(failure), { tone: 'warning' });
                  }
                }}
              >
                Archivieren
              </button>
            </>
          }
        >
          <p>Ein separater, schreibgeschützter Planstand wird auf diesem Gerät gespeichert.</p>
          {!verified && (
            <div className="callout callout-warning">
              <Icon name="alert" />
              <div className="callout-body">
                PISA-Abschluss noch nicht bestätigt. Das Archiv bleibt als unvollständiger
                Arbeitsstand erkennbar.
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
