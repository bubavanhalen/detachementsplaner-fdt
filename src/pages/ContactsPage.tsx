// biome-ignore-all lint/suspicious/noArrayIndexKey: CSV preview cells use a fixed, non-reorderable field schema.
import { useMemo, useState } from 'react';
import { type DataColumn, DataTable } from '../components/DataTable';
import { Icon } from '../components/Icon';
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
import { notify, useProject } from '../store';
import { PersonEditor } from './PersonEditor';
import './pages.css';

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
  const [editing, setEditing] = useState<Person | null>(null);
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
  const warningsFor = (person: Person) => [
    ...contactWarnings(person),
    ...(duplicateIds.has(person.id) ? ['Kontaktangabe mehrfach'] : []),
  ];
  const withWarnings = chosen.filter((person) => warningsFor(person).length).length;
  const toggle = (id: string) =>
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allVisible = visible.length > 0 && visible.every((person) => selected.has(person.id));
  const columns: DataColumn<Person>[] = [
    {
      id: 'select',
      header: '',
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
    {
      id: 'phone',
      header: 'Telefon',
      cell: (person) => person.tel || <span className="muted">—</span>,
    },
    {
      id: 'mail',
      header: 'E-Mail',
      cell: (person) => person.mail || <span className="muted">—</span>,
    },
    {
      id: 'warnings',
      header: 'Prüfung',
      cell: (person) => {
        const warnings = warningsFor(person);
        return warnings.length ? (
          <span className="badge badge-warning" title={warnings.join(' · ')}>
            <Icon name="alert" /> {warnings.join(' · ')}
          </span>
        ) : (
          <span className="badge badge-success">
            <Icon name="check" /> Bereit
          </span>
        );
      },
    },
    {
      id: 'edit',
      header: '',
      cell: (person) =>
        project.archive ? null : (
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label={`${person.name} bearbeiten`}
            title="Bearbeiten"
            onClick={() => setEditing(person)}
          >
            <Icon name="edit" size={15} />
          </button>
        ),
    },
  ];
  const header = contactRows(project, [], options)[0];
  return (
    <div className="page page-wide">
      <section className="page-intro">
        <div>
          <h2>Kontaktliste als lokale CSV-Datei</h2>
          <p>
            CSV im Google-Kontakte-Format. Die Datei entsteht auf diesem Gerät; die App überträgt
            nichts zu Google oder anderen Diensten.
          </p>
        </div>
      </section>
      <div className="contacts-layout">
        <section className="card people-list-card">
          <div className="people-filters">
            <div className="toolbar">
              <label className="search-field grow">
                <Icon name="search" size={16} />
                <input
                  type="search"
                  aria-label="Kontakte suchen"
                  placeholder="Name, Telefon, E-Mail …"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                />
              </label>
              <select
                aria-label="Detachement"
                value={group}
                onChange={(event) => setGroup(event.target.value)}
                style={{ width: 'auto' }}
              >
                <option value="">Alle Detachemente</option>
                {project.dets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="toolbar">
              <fieldset className="segmented" aria-label="Anzeige">
                {(
                  [
                    ['all', 'Alle'],
                    ['selected', 'Ausgewählt'],
                    ['missing', 'Kontaktdaten fehlen'],
                  ] as const
                ).map(([value, text]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={scope === value}
                    onClick={() => setScope(value)}
                  >
                    {text}
                  </button>
                ))}
              </fieldset>
              <label className="check spacer">
                <input
                  type="checkbox"
                  checked={allVisible}
                  disabled={!visible.length}
                  onChange={(event) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      for (const person of visible)
                        if (event.target.checked) next.add(person.id);
                        else next.delete(person.id);
                      return next;
                    })
                  }
                />
                Alle {visible.length} Treffer auswählen
              </label>
            </div>
          </div>
          <DataTable
            data={visible}
            columns={columns}
            getRowId={(person) => person.id}
            onRowClick={(person) => toggle(person.id)}
            emptyMessage="Keine passenden Kontakte."
            pageSize={50}
          />
        </section>
        <aside className="contacts-aside">
          <section className="card contacts-summary">
            <div>
              <span className="big">{chosen.length}</span>
              <p className="muted">
                Kontakte ausgewählt
                {hiddenCount > 0 && ` · ${hiddenCount} ausserhalb des Filters`}
              </p>
              {withWarnings > 0 && (
                <p className="warning-text">
                  <Icon name="alert" size={14} className="inline-icon" /> {withWarnings} mit
                  Hinweisen
                </p>
              )}
            </div>
            <hr />
            <label className="check">
              <input
                type="checkbox"
                checked={rank}
                onChange={(event) => setRank(event.target.checked)}
              />
              Grad vor Name
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={groups}
                onChange={(event) => setGroups(event.target.checked)}
              />
              Detachemente als Labels
            </label>
            <label className="field">
              Gemeinsames Label
              <input value={label} onChange={(event) => setLabel(event.target.value)} />
            </label>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={!chosen.length}
              onClick={() => {
                try {
                  download(
                    `Kontakte_${exportName(project, 'csv')}`,
                    contactCsv(project, chosen, options),
                    'text/csv;charset=utf-8',
                  );
                  notify('Kontakt-CSV lokal gespeichert.', { tone: 'success' });
                } catch (failure) {
                  notify(localError(failure), { tone: 'warning' });
                }
              }}
            >
              <Icon name="download" size={16} /> CSV herunterladen · {chosen.length}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!chosen.length}
              onClick={() => setSelected(new Set())}
            >
              Auswahl leeren
            </button>
            <p className="muted small-note">
              <Icon name="shield" size={13} className="inline-icon" /> Die Offline-Grenze gilt auch
              für die heruntergeladene Datei.
            </p>
          </section>
          <details className="disclosure">
            <summary>
              <Icon name="chevronRight" size={15} className="chev" /> CSV-Vorschau
            </summary>
            <div className="disclosure-body">
              <div className="table-scroll" style={{ maxHeight: 280 }}>
                <table className="table">
                  <thead>
                    <tr>
                      {header.map((name) => (
                        <th key={name}>{name}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contactRows(project, chosen.slice(0, 10), options)
                      .slice(1)
                      .map((row, i) => (
                        <tr key={chosen[i].id}>
                          {row.map((value, j) => (
                            <td key={`${j}-${header[j]}`}>{value}</td>
                          ))}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {chosen.length > 10 && (
                <p className="muted small-note">
                  Vorschau der ersten 10 Kontakte. Die Datei enthält alle ausgewählten.
                </p>
              )}
            </div>
          </details>
        </aside>
      </div>
      {editing && <PersonEditor person={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
