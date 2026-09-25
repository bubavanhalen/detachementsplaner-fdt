import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { CopyButton } from '../components/CopyButton';
import { type DataColumn, DataTable } from '../components/DataTable';
import { personInitials } from '../components/format';
import { Icon } from '../components/Icon';
import { displayDate, searchText } from '../io/text';
import { derivePisa, directGroupIds, groupPeople, validateProject } from '../model';
import type { Person } from '../model/types';
import { changeProject, notifyUndoable, useProject } from '../store';
import { isTyping, overlayStore, useOverlays } from '../ui';
import { PersonEditor } from './PersonEditor';
import './pages.css';

export const participationLabel = {
  unreviewed: 'Teilnahme klären',
  included: 'Eingeplant',
  excluded: 'Nicht eingeplant',
};
const participationTone = {
  unreviewed: 'badge-warning',
  included: 'badge-success',
  excluded: '',
};
type Filter = 'all' | 'included' | 'unreviewed' | 'excluded' | 'issues' | 'review';

export default function PeoplePage() {
  const project = useProject();
  const { peopleIntent: intent } = useOverlays();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState<Filter>(intent?.filter ?? 'all'),
    [selected, setSelected] = useState<string | null>(intent?.personId ?? null),
    [editing, setEditing] = useState<Person | 'new' | null>(null);
  const search = useRef<HTMLInputElement>(null);
  useEffect(() => {
    // A preset from another page or the palette applies once and is then cleared.
    if (!intent) return;
    if (intent.personId) {
      setSelected(intent.personId);
      setQuery('');
      setFilter('all');
    }
    if (intent.filter) setFilter(intent.filter);
    overlayStore.setState((old) => ({ ...old, peopleIntent: null }));
  }, [intent]);
  const entries = useMemo(() => derivePisa(project), [project]);
  const issues = useMemo(() => validateProject(project), [project]);
  const groupsOf = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const group of project.dets)
      for (const person of groupPeople(project, group.id))
        map.set(person.id, [...(map.get(person.id) ?? []), group.id]);
    return map;
  }, [project]);
  const counts: Record<Filter, number> = {
    all: project.persons.length,
    included: project.persons.filter((person) => person.planning.status === 'included').length,
    unreviewed: project.persons.filter((person) => person.planning.status === 'unreviewed').length,
    excluded: project.persons.filter((person) => person.planning.status === 'excluded').length,
    issues: project.persons.filter((person) => issues.some((issue) => issue.personId === person.id))
      .length,
    review: project.persons.filter((person) => person.identityReview).length,
  };
  const people = project.persons.filter((person) => {
    const groups = project.dets.filter((group) => groupsOf.get(person.id)?.includes(group.id));
    const text = searchText(
      [
        person.name,
        person.grad,
        person.pnr,
        (person.pnr || '').replace(/\D/g, ''),
        person.funktion,
        person.zug,
        person.mail,
        ...groups.flatMap((group) => [group.name, group.ec, group.ort]),
      ].join(' '),
    );
    return (
      searchText(query)
        .split(' ')
        .every((token) => text.includes(token)) &&
      (filter === 'all' ||
        (filter === 'issues' && issues.some((issue) => issue.personId === person.id)) ||
        (filter === 'review' && Boolean(person.identityReview)) ||
        person.planning.status === filter)
    );
  });
  const person = people.find((item) => item.id === selected) || people[0];

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (document.querySelector('dialog[open]')) return;
      if (event.key === '/' && !isTyping(event.target)) {
        event.preventDefault();
        search.current?.focus();
        return;
      }
      if (isTyping(event.target) || !['j', 'k'].includes(event.key)) return;
      event.preventDefault();
      const index = people.findIndex((item) => item.id === person?.id);
      const next =
        people[Math.max(0, Math.min(people.length - 1, index + (event.key === 'j' ? 1 : -1)))];
      if (next) setSelected(next.id);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [people, person?.id]);

  const columns: DataColumn<Person>[] = [
    {
      id: 'name',
      header: 'Person',
      value: (item) => item.name,
      cell: (item) => (
        <button type="button" className="person-cell" onClick={() => setSelected(item.id)}>
          <span className="avatar" aria-hidden="true">
            {personInitials(item)}
          </span>
          <span>
            <strong>{item.name}</strong>
            <small>{[item.grad, item.pnr || 'Nummer offen'].filter(Boolean).join(' · ')}</small>
          </span>
        </button>
      ),
    },
    {
      id: 'funktion',
      header: 'Funktion',
      value: (item) => item.funktion,
      cell: (item) => item.funktion || <span className="muted">—</span>,
    },
    {
      id: 'group',
      header: 'Detachement',
      value: (item) =>
        directGroupIds(project, item.id)
          .map((id) => project.dets.find((group) => group.id === id)?.name ?? '')
          .join(', '),
      cell: (item) =>
        directGroupIds(project, item.id)
          .map((id) => project.dets.find((group) => group.id === id)?.name)
          .filter(Boolean)
          .join(', ') || <span className="muted">—</span>,
    },
    {
      id: 'status',
      header: 'Teilnahme',
      value: (item) => item.planning.status,
      cell: (item) => (
        <span className={`badge ${participationTone[item.planning.status]}`}>
          {participationLabel[item.planning.status]}
        </span>
      ),
    },
  ];
  const personIssues = person ? issues.filter((issue) => issue.personId === person.id) : [];
  const personEntries = person
    ? entries.filter((entry) => entry.personIds.includes(person.id))
    : [];
  return (
    <div className="page page-wide">
      <section className="page-intro">
        <div>
          <h2>Wer ist wo eingeteilt?</h2>
          <p>Suche nach Name, Nummer, Funktion, Detachement oder Ort. Mit J / K blättern.</p>
        </div>
        {!project.archive && (
          <div className="actions">
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <Icon name="plus" size={16} /> Person erfassen
            </button>
          </div>
        )}
      </section>
      {!project.persons.length ? (
        <section className="card empty">
          <span className="empty-icon">
            <Icon name="users" />
          </span>
          <h2>Noch keine Personen</h2>
          <p>Lade eine PISA- oder MILOFFICE-Liste oder erfasse Personen manuell.</p>
          <div className="actions">
            <Link to="/sources" className="btn btn-primary">
              <Icon name="upload" size={16} /> Liste laden
            </Link>
          </div>
        </section>
      ) : (
        <div className="people-layout">
          <section className="card people-list-card">
            <div className="people-filters">
              <label className="search-field">
                <Icon name="search" size={16} />
                <input
                  ref={search}
                  type="search"
                  aria-label="Person suchen"
                  placeholder="Name, Versicherten-Nr., Funktion …"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
                <span className="kbd" aria-hidden="true">
                  /
                </span>
              </label>
              <fieldset className="chip-row" aria-label="Teilnahme">
                {(
                  [
                    ['all', 'Alle'],
                    ['included', 'Eingeplant'],
                    ['unreviewed', 'Teilnahme klären'],
                    ['excluded', 'Nicht eingeplant'],
                    ['issues', 'Mit offenen Punkten'],
                    ['review', 'Identität prüfen'],
                  ] as const
                )
                  .filter(([key]) => key === 'all' || counts[key] > 0 || filter === key)
                  .map(([key, label]) => (
                    <button
                      type="button"
                      key={key}
                      className="chip"
                      aria-pressed={filter === key}
                      onClick={() => setFilter(key)}
                    >
                      {label} <span className="count">{counts[key]}</span>
                    </button>
                  ))}
              </fieldset>
            </div>
            <DataTable
              data={people}
              columns={columns}
              getRowId={(item) => item.id}
              selectedId={person?.id}
              onRowClick={(item) => setSelected(item.id)}
              emptyMessage="Keine passende Person gefunden."
            />
          </section>
          <aside className="card dossier" aria-label="Personendossier">
            {person ? (
              <>
                <header className="dossier-head">
                  <span className="avatar is-lg" aria-hidden="true">
                    {personInitials(person)}
                  </span>
                  <div className="grow">
                    <h2>
                      {person.grad} {person.name}
                    </h2>
                    <p className="row">
                      <span className="mono">{person.pnr || 'Versicherten-Nr. offen'}</span>
                      {person.pnr && (
                        <CopyButton value={person.pnr} label="Versicherten-Nr. kopieren" />
                      )}
                    </p>
                  </div>
                  {!project.archive && (
                    <button type="button" className="btn btn-sm" onClick={() => setEditing(person)}>
                      <Icon name="edit" size={15} /> Bearbeiten
                    </button>
                  )}
                </header>
                <div className="dossier-section">
                  <div className="row wrap">
                    <span className={`badge ${participationTone[person.planning.status]}`}>
                      {participationLabel[person.planning.status]}
                    </span>
                    {[person.pisa ? 'PISA' : '', person.milo ? 'MILOFFICE' : '']
                      .filter(Boolean)
                      .map((source) => (
                        <span className="badge badge-outline" key={source}>
                          {source}
                        </span>
                      ))}
                    {!person.pisa && !person.milo && (
                      <span className="badge badge-outline">Manuell</span>
                    )}
                  </div>
                  {person.planning.reason && <p className="text-2">{person.planning.reason}</p>}
                  {person.planning.status === 'unreviewed' && !project.archive && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => {
                        changeProject((draft) => {
                          const target = draft.persons.find((item) => item.id === person.id);
                          if (target) target.planning = { ...target.planning, status: 'included' };
                        });
                        notifyUndoable(`${person.name} eingeplant.`);
                      }}
                    >
                      <Icon name="check" size={15} /> Einplanen
                    </button>
                  )}
                </div>
                {personIssues.length > 0 && (
                  <div className="dossier-section">
                    <h3>Offene Punkte</h3>
                    {personIssues.map((issue) => (
                      <div
                        className="callout callout-warning"
                        key={`${issue.code}-${issue.message}`}
                      >
                        <Icon name="alert" />
                        <div className="callout-body">{issue.message}</div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="dossier-section">
                  <h3>Aufgebote</h3>
                  {personEntries.map((entry) => (
                    <div className="assignment" key={entry.id}>
                      <span className={`ec ${entry.ec ? '' : 'is-missing'}`}>
                        {entry.ec || '—'}
                      </span>
                      <div className="grow">
                        <strong>{entry.name}</strong>
                        <p>
                          {displayDate(entry.details.datum)} – {displayDate(entry.details.bisDatum)}
                          {entry.details.von ? ` · ${entry.details.von}` : ''}
                        </p>
                        <p>
                          {[entry.details.ort, entry.details.treffpunkt]
                            .filter(Boolean)
                            .join(' · ') || 'Ort noch offen'}
                        </p>
                        {entry.extraIds.length > 0 && (
                          <p>
                            Zusatz-MB:{' '}
                            {entry.extraIds
                              .map((id) => {
                                const extra = entries.find((item) => item.id === id);
                                return extra
                                  ? `${extra.ec || 'EC offen'} · ${extra.name}`
                                  : 'Verknüpfung offen';
                              })
                              .join(', ')}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                  {!personEntries.length && (
                    <p className="muted">Noch kein Hauptaufgebot zugeteilt.</p>
                  )}
                </div>
                <div className="dossier-section">
                  <h3>Angaben</h3>
                  <dl className="kv">
                    <dt>Funktion</dt>
                    <dd>{person.funktion || '—'}</dd>
                    <dt>Führerausweise</dt>
                    <dd>{person.lics.join(', ') || '—'}</dd>
                    <dt>Zug / Element</dt>
                    <dd>{person.zug || '—'}</dd>
                    <dt>Telefon</dt>
                    <dd>{person.tel || '—'}</dd>
                    <dt>E-Mail</dt>
                    <dd>{person.mail || '—'}</dd>
                  </dl>
                </div>
                {Object.keys(person.raw).length > 0 && (
                  <div className="dossier-section">
                    <details className="disclosure">
                      <summary>
                        <Icon name="chevronRight" size={15} className="chev" /> Originaldaten aus
                        den Quellen
                      </summary>
                      <div className="disclosure-body">
                        <dl className="kv">
                          {Object.entries(person.raw).map(([key, value]) => (
                            <div key={key} style={{ display: 'contents' }}>
                              <dt>{key}</dt>
                              <dd>{value}</dd>
                            </div>
                          ))}
                        </dl>
                      </div>
                    </details>
                  </div>
                )}
              </>
            ) : (
              <div className="empty">Keine Person ausgewählt.</div>
            )}
          </aside>
        </div>
      )}
      {editing && (
        <PersonEditor
          person={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
