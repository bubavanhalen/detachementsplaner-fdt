import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { ErrorBox, Modal } from '../components/Modal';
import {
  checkIntake,
  connectFolder,
  disconnectFolder,
  downloadStand,
  pickIntakeFile,
  reauthorize,
  useExchange,
} from '../components/pendenzen/exchange';
import { localError, searchText } from '../io/text';
import {
  addPendenz,
  addPendenzNote,
  addPendenzSource,
  displayDay,
  effectivePhase,
  groupPendenzen,
  isActive,
  localDay,
  markPendenzenSeen,
  PENDENZ_GROUPS,
  PENDENZ_KANAL,
  PENDENZ_PHASE,
  PENDENZ_PRIO,
  PENDENZ_STATUS,
  type Pendenz,
  type PendenzKanal,
  type PendenzPhase,
  type PendenzPrio,
  type PendenzStatus,
  pendenzenOf,
  pendenzSummary,
  removePendenz,
  resolveProposal,
  updatePendenz,
} from '../model';
import type { Project } from '../model/types';
import { changeProject, notify, notifyUndoable, useProject } from '../store';
import './pages.css';
import './pendenzen.css';

type Scope = 'aktiv' | 'wartet' | 'zu' | 'alle';
const SCOPES: [Scope, string][] = [
  ['aktiv', 'Aktiv'],
  ['wartet', 'Wartet'],
  ['zu', 'Abgeschlossen'],
  ['alle', 'Alle'],
];
const kanalEntries = Object.entries(PENDENZ_KANAL) as [PendenzKanal, string][];

function run(action: () => void): boolean {
  try {
    action();
    return true;
  } catch (failure) {
    notify(localError(failure), { tone: 'warning' });
    return false;
  }
}

export default function PendenzenPage() {
  const project = useProject();
  return <Pendenzen key={project.id} />;
}
function Pendenzen() {
  const project = useProject();
  const archived = Boolean(project.archive);
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState<Scope>('aktiv');
  const [phase, setPhase] = useState<PendenzPhase | ''>('');
  const [kanal, setKanal] = useState<PendenzKanal | ''>('');
  const [editing, setEditing] = useState<string | null>(null);
  const today = localDay();
  const summary = pendenzSummary(project, today);
  const all = pendenzenOf(project);
  const visible = all.filter(
    (pendenz) =>
      (scope === 'alle' ||
        (scope === 'aktiv' && (isActive(pendenz) || pendenz.neu)) ||
        (scope === 'wartet' && pendenz.status === 'wartet') ||
        (scope === 'zu' && !isActive(pendenz))) &&
      (!phase || effectivePhase(project, pendenz, today) === phase) &&
      (!kanal || pendenz.quellen.some((source) => source.kanal === kanal)) &&
      searchText(pendenzText(project, pendenz)).includes(searchText(query)),
  );
  const groups = groupPendenzen(visible, today);
  const newIds = all.filter((pendenz) => pendenz.neu).map((pendenz) => pendenz.id);

  return (
    <div className="page page-wide">
      <section className="page-intro">
        <div>
          <h2>Alle Pendenzen an einem Ort</h2>
          <p>
            Mails, WhatsApp, SMS, Anrufe und Teams Planner hier zusammenführen. Ein Agent liest den
            Stand im Austauschordner und ergänzt neue Hinweise direkt.
          </p>
        </div>
      </section>
      {!archived && <QuickAdd />}
      <div className="pz-layout">
        <section className="card pz-list-card">
          <div className="people-filters">
            <div className="toolbar">
              <label className="search-field grow">
                <Icon name="search" size={16} />
                <input
                  type="search"
                  aria-label="Pendenzen suchen"
                  placeholder="Titel, Person, Absender, Stand …"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <select
                aria-label="Phase"
                value={phase}
                onChange={(event) => setPhase(event.target.value as PendenzPhase | '')}
                style={{ width: 'auto' }}
              >
                <option value="">Alle Phasen</option>
                {Object.entries(PENDENZ_PHASE).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                aria-label="Kanal"
                value={kanal}
                onChange={(event) => setKanal(event.target.value as PendenzKanal | '')}
                style={{ width: 'auto' }}
              >
                <option value="">Alle Kanäle</option>
                {kanalEntries.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar">
              <fieldset className="segmented" aria-label="Anzeige">
                {SCOPES.map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={scope === value}
                    onClick={() => setScope(value)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
              {newIds.length > 0 && !archived && (
                <button
                  type="button"
                  className="btn btn-sm spacer"
                  onClick={() =>
                    run(() => changeProject((draft) => markPendenzenSeen(draft, newIds)))
                  }
                >
                  <Icon name="check" size={15} /> {newIds.length} neue als gesehen markieren
                </button>
              )}
            </div>
          </div>
          {groups.length ? (
            groups.map(({ group, items }) => (
              <section key={group} className="pz-group" aria-label={PENDENZ_GROUPS[group]}>
                <h3 className={`pz-group-head is-${group}`}>
                  {PENDENZ_GROUPS[group]} <span className="count">{items.length}</span>
                </h3>
                <ul className="pz-items">
                  {items.map((pendenz) => (
                    <PendenzRow
                      key={pendenz.id}
                      pendenz={pendenz}
                      project={project}
                      today={today}
                      onOpen={() => setEditing(pendenz.id)}
                    />
                  ))}
                </ul>
              </section>
            ))
          ) : (
            <div className="empty">
              <h2>{all.length ? 'Keine passenden Pendenzen.' : 'Noch keine Pendenzen.'}</h2>
              <p className="muted">
                {all.length
                  ? 'Filter anpassen oder «Alle» wählen.'
                  : 'Oben eine Pendenz erfassen oder den Austauschordner für den Agent verbinden.'}
              </p>
            </div>
          )}
        </section>
        <aside className="pz-aside">
          <section className="card card-pad pz-summary">
            <div className="stat-grid">
              <div className="stat">
                <span className="stat-value">{summary.active}</span>
                <span className="stat-label">Aktiv</span>
              </div>
              <div className="stat">
                <span className={`stat-value ${summary.overdue ? 'warning-text' : ''}`}>
                  {summary.overdue}
                </span>
                <span className="stat-label">Überfällig</span>
              </div>
              <div className="stat">
                <span className="stat-value">{summary.neu}</span>
                <span className="stat-label">Neu vom Agent</span>
              </div>
            </div>
          </section>
          <ExchangeCard archived={archived} />
        </aside>
      </div>
      {editing && <PendenzEditor id={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function pendenzText(project: Project, pendenz: Pendenz): string {
  return [
    pendenz.titel,
    pendenz.beschreibung,
    pendenz.zustaendig,
    pendenz.tags.join(' '),
    ...pendenz.quellen.flatMap((source) => [source.von, source.betreff]),
    ...pendenz.verlauf.map((entry) => entry.text),
    ...personNames(project, pendenz.personIds),
    ...project.dets.filter((det) => pendenz.detIds.includes(det.id)).map((det) => det.name),
  ].join(' ');
}
function personNames(project: Project, ids: string[]): string[] {
  return project.persons
    .filter((person) => ids.includes(person.id))
    .map((person) => [person.grad, person.name].filter(Boolean).join(' '));
}

function QuickAdd() {
  const [titel, setTitel] = useState('');
  const [kanal, setKanal] = useState<PendenzKanal | ''>('');
  const [von, setVon] = useState('');
  const [faellig, setFaellig] = useState('');
  return (
    <form
      className="card pz-quick"
      aria-label="Pendenz erfassen"
      onSubmit={(event) => {
        event.preventDefault();
        if (!titel.trim()) return;
        const ok = run(() =>
          changeProject((draft) => {
            addPendenz(draft, {
              titel,
              faellig,
              ...(kanal
                ? {
                    quelle: {
                      kanal,
                      ref: '',
                      von,
                      am: new Date().toISOString(),
                      betreff: '',
                    },
                  }
                : {}),
            });
          }),
        );
        if (ok) {
          notifyUndoable('Pendenz erfasst.');
          setTitel('');
          setVon('');
          setFaellig('');
        }
      }}
    >
      <label className="search-field grow">
        <Icon name="plus" size={16} />
        <input
          aria-label="Neue Pendenz"
          placeholder="Neue Pendenz, z. B. «Fw zurückrufen wegen Fahrzeugliste»"
          value={titel}
          onChange={(event) => setTitel(event.target.value)}
        />
      </label>
      <select
        aria-label="Eingang über"
        value={kanal}
        onChange={(event) => setKanal(event.target.value as PendenzKanal | '')}
      >
        <option value="">Kanal …</option>
        {kanalEntries.map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      {kanal && (
        <input
          aria-label="Von"
          placeholder="Von"
          value={von}
          onChange={(event) => setVon(event.target.value)}
          className="pz-quick-from"
        />
      )}
      <input
        type="date"
        aria-label="Fällig"
        value={faellig}
        onChange={(event) => setFaellig(event.target.value)}
      />
      <button type="submit" className="btn btn-primary" disabled={!titel.trim()}>
        Erfassen
      </button>
    </form>
  );
}

function PendenzRow({
  pendenz,
  project,
  today,
  onOpen,
}: {
  pendenz: Pendenz;
  project: Project;
  today: string;
  onOpen: () => void;
}) {
  const archived = Boolean(project.archive);
  const done = !isActive(pendenz);
  const last = pendenz.verlauf.at(-1);
  const people = personNames(project, pendenz.personIds);
  const channels = [...new Set(pendenz.quellen.map((source) => source.kanal))];
  const phase = effectivePhase(project, pendenz, today);
  const overdue = !done && pendenz.faellig && pendenz.faellig < today;
  return (
    <li className={`pz-item ${done ? 'is-done' : ''} ${pendenz.neu ? 'is-new' : ''}`}>
      <input
        type="checkbox"
        aria-label={`${pendenz.titel} erledigt`}
        checked={pendenz.status === 'erledigt'}
        disabled={archived}
        onChange={(event) => {
          const status: PendenzStatus = event.target.checked ? 'erledigt' : 'offen';
          if (run(() => changeProject((draft) => updatePendenz(draft, pendenz.id, { status }))))
            notifyUndoable(status === 'erledigt' ? 'Pendenz erledigt.' : 'Pendenz wieder offen.');
        }}
      />
      <button type="button" className="pz-item-main" onClick={onOpen}>
        <span className="pz-item-title">
          {pendenz.neu && <span className="badge badge-info">Neu</span>}
          {pendenz.vorschlag && <span className="badge badge-warning">Prüfen</span>}
          {pendenz.prio === 'hoch' && <span className="badge badge-danger">Hoch</span>}
          <strong>{pendenz.titel}</strong>
        </span>
        <span className="pz-item-meta">
          {pendenz.status === 'wartet' && (
            <span className="badge badge-warning">
              Wartet{pendenz.zustaendig ? ` auf ${pendenz.zustaendig}` : ''}
            </span>
          )}
          {pendenz.status === 'verworfen' && <span className="badge">Verworfen</span>}
          {pendenz.status !== 'wartet' && pendenz.zustaendig && (
            <span>Zuständig: {pendenz.zustaendig}</span>
          )}
          {channels.map((channel) => (
            <span key={channel} className="badge badge-outline">
              {PENDENZ_KANAL[channel]}
            </span>
          ))}
          {phase && phase !== 'vordienstlich' && (
            <span
              title={
                pendenz.phase
                  ? 'Phase fest gesetzt'
                  : `Phase berechnet aus ${pendenz.faellig ? 'Fälligkeit' : 'heutigem Datum'} und Dienstperiode`
              }
            >
              {PENDENZ_PHASE[phase]}
              {!pendenz.phase && ' (auto)'}
            </span>
          )}
          {people.length > 0 && <span>{people.join(', ')}</span>}
        </span>
        {last && (
          <span className="pz-item-last muted">
            {last.autor === 'agent' && <Icon name="sparkle" size={13} className="inline-icon" />}{' '}
            {last.text.split('\n').at(-1)}
          </span>
        )}
      </button>
      <span className={`pz-due ${overdue ? 'is-overdue' : ''}`}>
        {pendenz.faellig ? displayDay(pendenz.faellig) : ''}
      </span>
    </li>
  );
}

function ExchangeCard({ archived }: { archived: boolean }) {
  const exchange = useExchange();
  const time = (value: number) =>
    value
      ? new Date(value).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })
      : '—';
  return (
    <section className="card card-pad pz-exchange" aria-label="Agent-Austausch">
      <h3>
        <Icon name="sparkle" size={16} /> Agent-Austausch
      </h3>
      {exchange.supported ? (
        exchange.folder ? (
          <>
            <p>
              <span
                className={`dot ${exchange.access === 'granted' ? 'dot-success' : 'dot-warning'}`}
              />{' '}
              Ordner <strong>{exchange.folder}</strong>
              {exchange.access === 'granted' ? ' verbunden' : ' wartet auf Freigabe'}
            </p>
            {exchange.access === 'granted' ? (
              <>
                <p className="muted small-note">
                  Stand geschrieben: {time(exchange.writtenAt)} · Eingang geprüft:{' '}
                  {time(exchange.checkedAt)}
                  {exchange.waiting > 0 &&
                    ` · ${exchange.waiting} Datei(en) für eine andere Dienstleistung`}
                </p>
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  disabled={archived}
                  onClick={() => void checkIntake()}
                >
                  <Icon name="download" size={16} /> Eingang jetzt prüfen
                </button>
              </>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={() => void reauthorize()}
              >
                <Icon name="folder" size={16} /> Ordner wieder freigeben
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void disconnectFolder()}
            >
              Ordner trennen
            </button>
          </>
        ) : (
          <>
            <p className="muted">
              Einen lokalen Ordner wählen. Die App legt dort den aktuellen Stand und die Anleitung
              für den Agent ab und übernimmt dessen Dateien aus <code>eingang/</code>.
            </p>
            <p className="warning-text small-note">
              <Icon name="alert" size={13} className="inline-icon" /> Keinen Ordner wählen, der mit
              OneDrive, Dropbox, iCloud oder Google Drive synchronisiert wird (z. B. «Dokumente» bei
              aktiver OneDrive-Sicherung). Sonst gelangt das ganze Projekt in die Cloud.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-block"
              onClick={() => void connectFolder()}
            >
              <Icon name="folder" size={16} /> Austauschordner verbinden
            </button>
          </>
        )
      ) : (
        <p className="muted">
          Dieser Browser kann keinen Ordner verbinden (Chrome oder Edge können es). Stattdessen den
          Stand herunterladen und die Datei des Agents einlesen.
        </p>
      )}
      {exchange.error && <p className="warning-text">{exchange.error}</p>}
      <details className="disclosure">
        <summary>
          <Icon name="chevronRight" size={15} className="chev" /> Ohne Ordner
        </summary>
        <div className="disclosure-body stack">
          <button type="button" className="btn btn-sm" onClick={downloadStand}>
            <Icon name="download" size={15} /> Stand herunterladen
          </button>
          <button type="button" className="btn btn-sm" disabled={archived} onClick={pickIntakeFile}>
            <Icon name="upload" size={15} /> Agent-Datei einlesen
          </button>
        </div>
      </details>
      <p className="muted small-note">
        <Icon name="shield" size={13} className="inline-icon" /> Die App sendet nichts. Der Agent
        liest den vollständigen Projektstand aus diesem Ordner (vom Owner freigegeben). Der Ordner
        darf nicht mit einer Cloud synchronisiert werden.
      </p>
    </section>
  );
}

function PendenzEditor({ id, onClose }: { id: string; onClose: () => void }) {
  const project = useProject();
  const pendenz = pendenzenOf(project).find((item) => item.id === id);
  const archived = Boolean(project.archive);
  const [draft, setDraft] = useState(() => (pendenz ? structuredClone(pendenz) : null));
  const [tags, setTags] = useState(() => pendenz?.tags.join(', ') ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [personPick, setPersonPick] = useState('');
  const [source, setSource] = useState({ kanal: 'mail' as PendenzKanal, von: '', betreff: '' });
  const people = useMemo(
    () => [...project.persons].sort((a, b) => a.name.localeCompare(b.name, 'de-CH')),
    [project.persons],
  );
  if (!pendenz || !draft)
    return (
      <Modal title="Pendenz" onClose={onClose}>
        <p>Diese Pendenz ist nicht mehr vorhanden.</p>
      </Modal>
    );
  const autoPhase = effectivePhase(project, { ...draft, phase: '' });
  const patch = (fields: Partial<Pendenz>) =>
    setDraft((old) => (old ? { ...old, ...fields } : old));
  const save = () => {
    try {
      changeProject((next) =>
        updatePendenz(next, id, {
          titel: draft.titel,
          beschreibung: draft.beschreibung,
          status: draft.status,
          prio: draft.prio,
          phase: draft.phase,
          faellig: draft.faellig,
          zustaendig: draft.zustaendig,
          personIds: draft.personIds,
          detIds: draft.detIds,
          tags: tags
            .split(',')
            .map((tag) => tag.trim())
            .filter(Boolean),
        }),
      );
      notifyUndoable('Pendenz gespeichert.');
      onClose();
    } catch (failure) {
      setError(localError(failure));
    }
  };
  return (
    <Modal
      title={archived ? 'Pendenz (Archiv)' : 'Pendenz bearbeiten'}
      description={pendenz.erstelltVon === 'agent' ? 'Vom Agent erfasst' : undefined}
      onClose={onClose}
      wide
      footer={
        archived ? (
          <button type="button" className="btn" onClick={onClose}>
            Schliessen
          </button>
        ) : (
          <>
            <button
              type="button"
              className="btn btn-ghost btn-danger"
              onClick={() => {
                if (run(() => changeProject((next) => removePendenz(next, id)))) {
                  notifyUndoable('Pendenz gelöscht.');
                  onClose();
                }
              }}
            >
              <Icon name="trash" size={15} /> Löschen
            </button>
            <span className="spacer" />
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Abbrechen
            </button>
            <button type="submit" form="pendenz-form" className="btn btn-primary">
              Speichern
            </button>
          </>
        )
      }
    >
      <ErrorBox message={error} />
      {pendenz.vorschlag && (
        <div className="callout callout-warning">
          <Icon name="alert" />
          <div className="callout-body">
            <strong>Vorschlag von {pendenz.vorschlag.agent || 'Agent'} prüfen</strong>
            Die Pendenz wurde geändert, nachdem der Agent sie gelesen hat. Nicht übernommen:{' '}
            {Object.entries(pendenz.vorschlag.felder)
              .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`)
              .join('; ')}
            {!archived && (
              <div className="callout-actions">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  onClick={() => {
                    if (run(() => changeProject((next) => resolveProposal(next, id, true))))
                      onClose();
                  }}
                >
                  Übernehmen
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() =>
                    run(() => changeProject((next) => resolveProposal(next, id, false)))
                  }
                >
                  Verwerfen
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      <form
        id="pendenz-form"
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          save();
        }}
      >
        <fieldset className="form-grid" disabled={archived}>
          <label className="field span-all">
            Titel
            <input value={draft.titel} onChange={(event) => patch({ titel: event.target.value })} />
          </label>
          <label className="field">
            Status
            <select
              value={draft.status}
              onChange={(event) => patch({ status: event.target.value as PendenzStatus })}
            >
              {Object.entries(PENDENZ_STATUS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Fällig
            <input
              type="date"
              value={draft.faellig}
              onChange={(event) => patch({ faellig: event.target.value })}
            />
          </label>
          <label className="field">
            Zuständig
            <input
              value={draft.zustaendig}
              placeholder="z. B. ich, Fw, KF"
              onChange={(event) => patch({ zustaendig: event.target.value })}
            />
          </label>
          <label className="field">
            Priorität
            <select
              value={draft.prio}
              onChange={(event) => patch({ prio: event.target.value as PendenzPrio })}
            >
              {Object.entries(PENDENZ_PRIO).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Phase
            <select
              value={draft.phase}
              onChange={(event) => patch({ phase: event.target.value as PendenzPhase | '' })}
            >
              <option value="">
                Automatisch
                {autoPhase ? ` (${PENDENZ_PHASE[autoPhase]})` : ' (Dienstperiode fehlt)'}
              </option>
              {Object.entries(PENDENZ_PHASE).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {!draft.phase && (
              <span className="hint">
                Berechnet, nicht gespeichert:{' '}
                {draft.faellig
                  ? 'aus Fälligkeit und Dienstperiode.'
                  : 'ohne Fälligkeit aus dem heutigen Datum, wechselt also mit der Zeit.'}
              </span>
            )}
          </label>
          <label className="field">
            Stichworte
            <input
              value={tags}
              placeholder="mit Komma trennen"
              onChange={(event) => setTags(event.target.value)}
            />
          </label>
          <label className="field span-all">
            Beschreibung
            <textarea
              value={draft.beschreibung}
              onChange={(event) => patch({ beschreibung: event.target.value })}
            />
          </label>
          <div className="field span-all">
            Personen
            <div className="chip-row">
              {draft.personIds.map((personId) => {
                const person = project.persons.find((item) => item.id === personId);
                return (
                  <button
                    type="button"
                    key={personId}
                    className="chip is-active"
                    aria-label={`${person?.name ?? 'Person'} entfernen`}
                    onClick={() =>
                      patch({ personIds: draft.personIds.filter((item) => item !== personId) })
                    }
                  >
                    {[person?.grad, person?.name].filter(Boolean).join(' ')}{' '}
                    <Icon name="x" size={13} />
                  </button>
                );
              })}
              {people.length > 0 && (
                <select
                  aria-label="Person verknüpfen"
                  value={personPick}
                  style={{ width: 'auto' }}
                  onChange={(event) => {
                    const value = event.target.value;
                    setPersonPick('');
                    if (value && !draft.personIds.includes(value))
                      patch({ personIds: [...draft.personIds, value] });
                  }}
                >
                  <option value="">Person verknüpfen …</option>
                  {people
                    .filter((person) => !draft.personIds.includes(person.id))
                    .map((person) => (
                      <option key={person.id} value={person.id}>
                        {[person.grad, person.name].filter(Boolean).join(' ')}
                      </option>
                    ))}
                </select>
              )}
            </div>
          </div>
          {project.dets.length > 0 && (
            <div className="field span-all">
              Detachemente
              <div className="chip-row">
                {project.dets.map((det) => (
                  <button
                    type="button"
                    key={det.id}
                    className="chip"
                    aria-pressed={draft.detIds.includes(det.id)}
                    onClick={() =>
                      patch({
                        detIds: draft.detIds.includes(det.id)
                          ? draft.detIds.filter((item) => item !== det.id)
                          : [...draft.detIds, det.id],
                      })
                    }
                  >
                    {det.name || 'Ohne Namen'}
                  </button>
                ))}
              </div>
            </div>
          )}
        </fieldset>
      </form>

      <section className="pz-detail-section" aria-label="Stand der Sache">
        <h3>Stand der Sache</h3>
        {!archived && (
          <div className="pz-note">
            <textarea
              aria-label="Neuer Stand"
              placeholder="Was ist passiert? z. B. «Angerufen, Antwort bis Freitag»"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={!note.trim()}
              onClick={() => {
                if (run(() => changeProject((next) => addPendenzNote(next, id, note)))) setNote('');
              }}
            >
              Stand ergänzen
            </button>
          </div>
        )}
        {pendenz.verlauf.length ? (
          <ol className="pz-log">
            {[...pendenz.verlauf].reverse().map((entry) => (
              <li key={entry.id} className={entry.autor === 'agent' ? 'is-agent' : ''}>
                <span className="muted small-note">
                  {entry.am ? new Date(entry.am).toLocaleString('de-CH') : ''} ·{' '}
                  {entry.autor === 'agent' ? (entry.agent ?? 'Agent') : 'Ich'}
                </span>
                <p>{entry.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="muted">Noch kein Eintrag.</p>
        )}
      </section>

      <section className="pz-detail-section" aria-label="Quellen">
        <h3>Quellen</h3>
        {pendenz.quellen.length ? (
          <ul className="pz-sources">
            {pendenz.quellen.map((item) => (
              <li key={`${item.kanal}-${item.ref}-${item.am}-${item.von}-${item.betreff}`}>
                <span className="badge badge-outline">{PENDENZ_KANAL[item.kanal]}</span>{' '}
                {[item.von, item.betreff].filter(Boolean).join(' · ') || 'ohne Angaben'}
                {item.am && (
                  <span className="muted small-note">
                    {' '}
                    · {new Date(item.am).toLocaleDateString('de-CH')}
                  </span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Keine Quelle erfasst.</p>
        )}
        {!archived && (
          <div className="pz-source-add">
            <select
              aria-label="Kanal der Quelle"
              value={source.kanal}
              onChange={(event) =>
                setSource({ ...source, kanal: event.target.value as PendenzKanal })
              }
            >
              {kanalEntries.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              aria-label="Von"
              placeholder="Von"
              value={source.von}
              onChange={(event) => setSource({ ...source, von: event.target.value })}
            />
            <input
              aria-label="Betreff"
              placeholder="Betreff / Inhalt"
              value={source.betreff}
              onChange={(event) => setSource({ ...source, betreff: event.target.value })}
            />
            <button
              type="button"
              className="btn btn-sm"
              disabled={!source.von.trim() && !source.betreff.trim()}
              onClick={() => {
                if (
                  run(() =>
                    changeProject((next) =>
                      addPendenzSource(next, id, {
                        ...source,
                        ref: '',
                        am: new Date().toISOString(),
                      }),
                    ),
                  )
                )
                  setSource({ ...source, von: '', betreff: '' });
              }}
            >
              Quelle hinzufügen
            </button>
          </div>
        )}
      </section>
    </Modal>
  );
}
