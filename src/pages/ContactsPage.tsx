// biome-ignore-all lint/suspicious/noArrayIndexKey: CSV preview cells use a fixed, non-reorderable field schema.
import { useMemo, useState } from 'react';
import { type DataColumn, DataTable } from '../components/DataTable';
import {
  contactCsv,
  contactNames,
  contactRows,
  contactWarnings,
  download,
  exportName,
  hasContactData,
} from '../io/exports';
import { localError, searchText } from '../io/text';
import { groupPeople } from '../model';
import type { Person } from '../model/types';
import { useProject } from '../store';
import { PersonEditor } from './PersonEditor';

export default function ContactsPage() {
  const project = useProject();
  return <Contacts key={project.id} />;
}
function Contacts() {
  const project = useProject();
  const [selected, setSelected] = useState(
    () =>
      new Set(
        project.persons
          .filter((person) => person.planning.status === 'included' && hasContactData(person))
          .map((person) => person.id),
      ),
  );
  const [query, setQuery] = useState(''),
    [group, setGroup] = useState(''),
    [scope, setScope] = useState('all');
  const [rank, setRank] = useState(false),
    [groups, setGroups] = useState(false),
    [label, setLabel] = useState(project.name);
  const [editing, setEditing] = useState<Person | null>(null),
    [error, setError] = useState('');
  const options = { rank, groups, label };
  const groupIds = group ? new Set(groupPeople(project, group).map((person) => person.id)) : null;
  const visible = project.persons.filter(
    (person) =>
      (!groupIds || groupIds.has(person.id)) &&
      (scope !== 'selected' || selected.has(person.id)) &&
      (scope !== 'missing' || !hasContactData(person)) &&
      searchText(
        [person.name, person.grad, person.tel, person.mail, person.funktion].join(' '),
      ).includes(searchText(query)),
  );
  const chosen = project.persons.filter((person) => selected.has(person.id));
  const hiddenCount = chosen.filter(
    (person) => !visible.some((item) => item.id === person.id),
  ).length;
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const key of ['tel', 'mail'] as const) {
      const seen = new Map<string, string>();
      for (const person of chosen) {
        const value =
          key === 'tel'
            ? (person[key] || '').replace(/\D/g, '').replace(/^00/, '')
            : (person[key] || '').trim().toLowerCase();
        if (!value) continue;
        const prior = seen.get(value);
        if (prior) {
          ids.add(prior);
          ids.add(person.id);
        } else seen.set(value, person.id);
      }
    }
    return ids;
  }, [chosen]);
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const columns: DataColumn<Person>[] = [
    {
      id: 'select',
      header: 'Auswahl',
      cell: (person) => (
        <input
          type="checkbox"
          aria-label={`${person.name} auswählen`}
          checked={selected.has(person.id)}
          onChange={() => toggle(person.id)}
        />
      ),
    },
    {
      id: 'name',
      header: 'Name in CSV',
      value: (person) => person.name,
      cell: (person) => {
        const names = contactNames(person);
        return (
          <strong>
            {[rank ? person.grad : '', names.first, names.last].filter(Boolean).join(' ')}
          </strong>
        );
      },
    },
    { id: 'phone', header: 'Telefon', cell: (person) => person.tel || '—' },
    { id: 'mail', header: 'E-Mail', cell: (person) => person.mail || '—' },
    {
      id: 'warnings',
      header: 'Prüfung',
      cell: (person) => (
        <small>
          {[
            ...contactWarnings(person),
            ...(duplicateIds.has(person.id) ? ['Kontaktangabe mehrfach'] : []),
          ].join(' · ') || 'Bereit'}
        </small>
      ),
    },
    {
      id: 'edit',
      header: '',
      cell: (person) =>
        project.archive ? null : (
          <button type="button" className="button" onClick={() => setEditing(person)}>
            Bearbeiten
          </button>
        ),
    },
  ];
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <span className="eyebrow">LOKALER KONTAKTEXPORT</span>
          <h1>Kontakte vorbereiten.</h1>
          <p className="muted">
            Vorschau und CSV im Google-Kontakte-Format. Die Datei bleibt auf deinem Gerät.
          </p>
        </div>
        <button
          type="button"
          className="button primary"
          disabled={!chosen.length}
          onClick={() => {
            try {
              download(
                `Kontakte_${exportName(project, 'csv')}`,
                contactCsv(project, chosen, options),
                'text/csv;charset=utf-8',
              );
              setError('');
            } catch (failure) {
              setError(localError(failure));
            }
          }}
        >
          CSV herunterladen · {chosen.length}
        </button>
      </header>
      <div className="notice">
        Keine Übertragung zu Google oder anderen Diensten. Die Offline-Grenze gilt auch für die
        heruntergeladene Datei.
      </div>
      {error && (
        <div role="alert" className="notice warning">
          {error}
        </div>
      )}
      <div className="toolbar">
        <label className="field grow">
          Kontakte suchen
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <label className="field">
          Detachement
          <select value={group} onChange={(event) => setGroup(event.target.value)}>
            <option value="">Alle Detachemente</option>
            {project.dets.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Anzeige
          <select value={scope} onChange={(event) => setScope(event.target.value)}>
            <option value="all">Alle Kontakte</option>
            <option value="selected">Ausgewählt</option>
            <option value="missing">Kontaktdaten fehlen</option>
          </select>
        </label>
      </div>
      <div className="toolbar">
        <label className="check">
          <input
            type="checkbox"
            checked={rank}
            onChange={(event) => setRank(event.target.checked)}
          />{' '}
          Grad vor Name
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={groups}
            onChange={(event) => setGroups(event.target.checked)}
          />{' '}
          Detachemente als Labels
        </label>
        <label className="field">
          Gemeinsames Label
          <input value={label} onChange={(event) => setLabel(event.target.value)} />
        </label>
      </div>
      <div className="toolbar">
        <button
          type="button"
          className="button"
          onClick={() =>
            setSelected((previous) => new Set([...previous, ...visible.map((person) => person.id)]))
          }
        >
          Alle {visible.length} Treffer auswählen
        </button>
        <button type="button" className="button" onClick={() => setSelected(new Set())}>
          Auswahl leeren
        </button>
        <span>
          {chosen.length} ausgewählt · {hiddenCount} ausserhalb des Filters
        </span>
      </div>
      <section className="panel">
        <DataTable
          data={visible}
          columns={columns}
          getRowId={(person) => person.id}
          emptyMessage="Keine passenden Kontakte."
        />
      </section>
      <details className="panel">
        <summary>CSV-Vorschau ({chosen.length} Kontakte)</summary>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {contactRows(project, [], options)[0].map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contactRows(project, chosen.slice(0, 10), options)
                .slice(1)
                .map((row, i) => (
                  <tr key={chosen[i].id}>
                    {row.map((value, j) => (
                      <td key={`${j}-${contactRows(project, [], options)[0][j]}`}>{value}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {chosen.length > 10 && (
          <p className="muted">
            Vorschau der ersten 10 Kontakte. Die Datei enthält alle ausgewählten Kontakte.
          </p>
        )}
      </details>
      {editing && <PersonEditor person={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
