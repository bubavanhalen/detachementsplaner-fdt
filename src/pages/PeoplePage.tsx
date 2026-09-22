import { useMemo, useState } from 'react';
import { type DataColumn, DataTable } from '../components/DataTable';
import { displayDate, searchText } from '../io/text';
import { derivePisa, groupPeople, validateProject } from '../model';
import type { Person } from '../model/types';
import { useProject } from '../store';
import { PersonEditor } from './PersonEditor';

export const participationLabel = {
  unreviewed: 'Teilnahme klären',
  included: 'Eingeplant',
  excluded: 'Nicht eingeplant',
};
export default function PeoplePage() {
  const project = useProject();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState('all'),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<Person | 'new' | null>(null);
  const entries = useMemo(() => derivePisa(project), [project]);
  const issues = useMemo(() => validateProject(project), [project]);
  const people = project.persons.filter((person) => {
    const groups = project.dets.filter((group) =>
      groupPeople(project, group.id).some((item) => item.id === person.id),
    );
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
        person.planning.status === filter)
    );
  });
  const person = people.find((item) => item.id === selected) || people[0];
  const columns: DataColumn<Person>[] = [
    {
      id: 'name',
      header: 'Person',
      value: (item) => item.name,
      cell: (item) => (
        <button type="button" className="text-button" onClick={() => setSelected(item.id)}>
          <strong>{item.name}</strong>
          <small>
            {item.grad} · {item.pnr || 'Nummer offen'}
          </small>
        </button>
      ),
    },
    {
      id: 'funktion',
      header: 'Funktion',
      value: (item) => item.funktion,
      cell: (item) => item.funktion || '—',
    },
    {
      id: 'status',
      header: 'Teilnahme',
      value: (item) => item.planning.status,
      cell: (item) => <span className="badge">{participationLabel[item.planning.status]}</span>,
    },
  ];
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">PERSONEN & NACHKONTROLLE</span>
          <h1>Eine Person. Alle Angaben.</h1>
          <p className="muted">Suche nach Name, Nummer, Funktion, Detachement oder Ort.</p>
        </div>
        {!project.archive && (
          <button type="button" className="button primary" onClick={() => setEditing('new')}>
            Person erfassen
          </button>
        )}
      </header>
      <div className="toolbar">
        <label className="field grow">
          Person suchen
          <input
            type="search"
            placeholder="Name, Versicherten-Nr., Funktion …"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="field">
          Teilnahme
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="all">Alle Personen</option>
            <option value="included">Eingeplant</option>
            <option value="unreviewed">Teilnahme klären</option>
            <option value="excluded">Nicht eingeplant</option>
            <option value="issues">Mit offenen Punkten</option>
          </select>
        </label>
      </div>
      <div className="split-view">
        <section className="panel">
          <DataTable
            data={people}
            columns={columns}
            getRowId={(item) => item.id}
            emptyMessage="Keine passende Person gefunden."
          />
        </section>
        <aside className="panel person-dossier">
          {person ? (
            <>
              <span className="eyebrow">PERSONENDOSSIER</span>
              <h2>
                {person.grad} {person.name}
              </h2>
              <p className="muted">
                {person.pnr || 'Versicherten-Nr. offen'} ·{' '}
                {[person.pisa ? 'PISA' : '', person.milo ? 'MILOFFICE' : '']
                  .filter(Boolean)
                  .join(' + ') || 'Manuell'}
              </p>
              {!project.archive && (
                <button type="button" className="button" onClick={() => setEditing(person)}>
                  Teilnahme & Angaben bearbeiten
                </button>
              )}
              <h3>Aufgebote</h3>
              {entries
                .filter((entry) => entry.personIds.includes(person.id))
                .map((entry) => (
                  <div className="notice" key={entry.id}>
                    <strong>
                      {entry.ec || 'EC offen'} · {entry.name}
                    </strong>
                    <p>
                      {displayDate(entry.details.datum)} – {displayDate(entry.details.bisDatum)}
                      <br />
                      {entry.details.von} · {entry.details.ort} · {entry.details.treffpunkt}
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
                ))}
              {!entries.some((entry) => entry.personIds.includes(person.id)) && (
                <p className="muted">Noch kein Hauptaufgebot zugeteilt.</p>
              )}
              <dl className="detail-grid">
                <dt>Teilnahme</dt>
                <dd>{participationLabel[person.planning.status]}</dd>
                <dt>Begründung</dt>
                <dd>{person.planning.reason || '—'}</dd>
                <dt>Funktion</dt>
                <dd>{person.funktion || '—'}</dd>
                <dt>Führerausweise</dt>
                <dd>{person.lics.join(', ') || '—'}</dd>
                <dt>Telefon</dt>
                <dd>{person.tel || '—'}</dd>
                <dt>E-Mail</dt>
                <dd>{person.mail || '—'}</dd>
              </dl>
              {issues
                .filter((issue) => issue.personId === person.id)
                .map((issue) => (
                  <p key={`${issue.code}-${issue.message}`} className="notice warning">
                    {issue.message}
                  </p>
                ))}
              <details>
                <summary>Originaldaten aus den Quellen</summary>
                <dl>
                  {Object.entries(person.raw).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            </>
          ) : (
            <div className="empty-state">Keine Person ausgewählt.</div>
          )}
        </aside>
      </div>
      {editing && (
        <PersonEditor
          person={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
