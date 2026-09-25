import { Link, useNavigate } from '@tanstack/react-router';
import { type DragEvent, useState } from 'react';
import { Icon, type IconName } from '../components/Icon';
import { servicePeriod } from '../components/ProjectDialogs';
import {
  kindForFile,
  type LocalFileKind,
  pickLocalFile,
  receiveLocalFile,
} from '../components/projectActions';
import { demoProject } from '../io/demo';
import { remainingPeople } from '../model';
import type { Participation } from '../model/types';
import { useProject } from '../store';
import { openOverlay } from '../ui';
import { PersonEditor } from './PersonEditor';
import './pages.css';

const sourceCards: {
  kind: LocalFileKind;
  title: string;
  text: string;
  icon: IconName;
  accept: string;
}[] = [
  {
    kind: 'pisa',
    title: 'PISA-Liste',
    text: 'Personalbestand mit Versicherten-Nr., Grad und Funktion.',
    icon: 'sheet',
    accept: 'Excel oder CSV',
  },
  {
    kind: 'milo',
    title: 'MILOFFICE-Liste',
    text: 'Ergänzt Kontaktangaben, Zug und Führerausweise.',
    icon: 'sheet',
    accept: 'Excel oder CSV',
  },
  {
    kind: 'json',
    title: 'Projektdatei',
    text: 'Einen gesicherten Planstand weiterbearbeiten.',
    icon: 'folder',
    accept: 'JSON',
  },
];

export default function SourcesPage() {
  const project = useProject();
  const navigate = useNavigate();
  const [adding, setAdding] = useState(false);
  const archived = Boolean(project.archive);
  const empty = !project.persons.length && !project.dets.length;
  const count = (status: Participation) =>
    project.persons.filter((person) => person.planning.status === status).length;
  const free = remainingPeople(project).length;
  const review = project.persons.filter((person) => person.identityReview).length;
  const missingNumber = project.persons.filter((person) => !person.pnr).length;
  const showPeople = (filter?: Participation | 'review') => {
    openOverlay({ peopleIntent: { filter } });
    void navigate({ to: '/persons' });
  };
  return (
    <div className="page">
      <section className="page-intro">
        <div>
          <h2>Mit welcher Liste beginnst du?</h2>
          <p>
            Wähle eine Datei oder ziehe sie auf eine Karte. Die Datei wird ausschliesslich in diesem
            Browser gelesen – es gibt keinen Upload und keinen Server.
          </p>
        </div>
      </section>

      <div className="source-grid">
        {sourceCards.map((card) => (
          <SourceCard
            key={card.kind}
            {...card}
            disabled={archived && card.kind !== 'json'}
            status={
              card.kind === 'json'
                ? 'Ersetzt nach Rückfrage das aktive Projekt'
                : project.src[card.kind]
                  ? `${project.src[card.kind]?.datei} · ${project.src[card.kind]?.anz} Zeilen · ${new Date(project.src[card.kind]?.zeit ?? '').toLocaleDateString('de-CH')}`
                  : 'Noch nicht geladen'
            }
            loaded={card.kind !== 'json' && Boolean(project.src[card.kind])}
            primary={card.kind === 'pisa' && !project.persons.length}
          />
        ))}
      </div>

      {project.persons.length > 0 ? (
        <section className="card">
          <header className="card-head">
            <h2>
              <Icon name="users" /> Personalbestand
            </h2>
            <div className="row">
              {!archived && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setAdding(true)}
                >
                  <Icon name="plus" size={15} /> Person erfassen
                </button>
              )}
              <Link to="/persons" className="btn btn-sm">
                Alle ansehen
              </Link>
            </div>
          </header>
          <div className="stat-grid">
            <Stat label="Personen" value={project.persons.length} onClick={() => showPeople()} />
            <Stat
              label="Eingeplant"
              value={count('included')}
              tone="success"
              onClick={() => showPeople('included')}
            />
            <Stat
              label="Teilnahme klären"
              value={count('unreviewed')}
              tone={count('unreviewed') ? 'warning' : undefined}
              onClick={() => showPeople('unreviewed')}
            />
            <Stat
              label="Nicht eingeplant"
              value={count('excluded')}
              onClick={() => showPeople('excluded')}
            />
            <Stat
              label="Identität prüfen"
              value={review}
              tone={review ? 'warning' : undefined}
              onClick={() => showPeople('review')}
            />
            <Stat label="Ohne Versicherten-Nr." value={missingNumber} />
          </div>
        </section>
      ) : (
        <section className="card card-pad onboarding">
          <div className="onboarding-steps">
            {[
              [
                'upload',
                'Liste laden',
                'PISA und/oder MILOFFICE. Beide Quellen werden zusammengeführt.',
              ],
              [
                'board',
                'Detachemente planen',
                'Karten anlegen, Personen zuteilen, KVK → WK verbinden.',
              ],
              ['send', 'In PISA übertragen', 'Feld für Feld abgleichen, mit Kopieren-Knöpfen.'],
              ['archive', 'Sichern & archivieren', 'JSON, Excel, Kontakte – alles bleibt lokal.'],
            ].map(([icon, title, text], index) => (
              <div className="onboarding-step" key={title}>
                <span className="onboarding-icon">
                  <Icon name={icon as IconName} />
                </span>
                <div>
                  <strong>
                    {index + 1}. {title}
                  </strong>
                  <p>{text}</p>
                </div>
              </div>
            ))}
          </div>
          {empty && (
            <div className="onboarding-demo">
              <div>
                <strong>Erst ausprobieren?</strong>
                <p>Ein fiktives Beispiel mit zwei Detachementen und sechs erfundenen Personen.</p>
              </div>
              <button
                type="button"
                className="btn"
                onClick={() => openOverlay({ incoming: demoProject() })}
              >
                <Icon name="sparkle" size={16} /> Fiktives Beispiel laden
              </button>
            </div>
          )}
        </section>
      )}

      <section className="card card-pad service-summary">
        <div>
          <span className="eyebrow">Dienstleistung</span>
          <strong>{project.name}</strong>
          <p className="muted">
            {[project.settings.eigeneEinheit, servicePeriod(project)].filter(Boolean).join(' · ') ||
              'Einheit und Zeitraum sind optional.'}
          </p>
        </div>
        {!archived && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => openOverlay({ service: true })}
          >
            <Icon name="edit" size={15} /> Bearbeiten
          </button>
        )}
      </section>

      {project.persons.length > 0 && (
        <div className="next-step-bar">
          <div>
            <strong>
              {free
                ? `${free} Personen warten auf ein Detachement.`
                : 'Alle Personen sind verteilt.'}
            </strong>
            <p>Weiter mit der Planung: Detachemente anlegen und Personen zuteilen.</p>
          </div>
          <Link to="/" className="btn btn-primary">
            Zur Planung <Icon name="arrowRight" size={16} />
          </Link>
        </div>
      )}
      {adding && <PersonEditor onClose={() => setAdding(false)} />}
    </div>
  );
}

function SourceCard({
  kind,
  title,
  text,
  icon,
  accept,
  status,
  loaded,
  primary,
  disabled,
}: {
  kind: LocalFileKind;
  title: string;
  text: string;
  icon: IconName;
  accept: string;
  status: string;
  loaded: boolean;
  primary: boolean;
  disabled: boolean;
}) {
  const [over, setOver] = useState(false);
  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setOver(false);
    const file = event.dataTransfer.files[0];
    if (file && !disabled)
      void receiveLocalFile(file, kindForFile(file, kind === 'json' ? 'pisa' : kind));
  };
  return (
    <section
      className={`source-card dropzone ${over ? 'is-over' : ''} ${loaded ? 'is-loaded' : ''}`}
      aria-label={title}
      onDragOver={(event) => {
        if (disabled || !event.dataTransfer.types.includes('Files')) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
    >
      <div className="source-head">
        <span className="source-icon">
          <Icon name={loaded ? 'checkCircle' : icon} size={20} />
        </span>
        <span className="badge badge-outline">{accept}</span>
      </div>
      <h3>{title}</h3>
      <p className="muted">{text}</p>
      <p className={`source-status ${loaded ? 'is-loaded' : ''}`}>{status}</p>
      <button
        type="button"
        className={`btn ${primary ? 'btn-primary' : ''}`}
        disabled={disabled}
        onClick={() => pickLocalFile(kind)}
      >
        <Icon name={kind === 'json' ? 'folder' : 'upload'} size={16} />
        {kind === 'json' ? 'Projektdatei öffnen' : loaded ? 'Erneut laden' : `${title} laden`}
      </button>
      <span className="source-drop-hint">oder hierher ziehen</span>
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
  onClick,
}: {
  label: string;
  value: number;
  tone?: 'success' | 'warning';
  onClick?: () => void;
}) {
  const content = (
    <>
      <span className={`stat-value ${tone ? `is-${tone}` : ''}`}>{value}</span>
      <span className="stat-label">{label}</span>
    </>
  );
  return onClick ? (
    <button type="button" className="stat" onClick={onClick}>
      {content}
    </button>
  ) : (
    <div className="stat">{content}</div>
  );
}
