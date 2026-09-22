import { useMemo, useState } from 'react';
import { assignPeople, removePeople } from '../model';
import type { Detachment, Person, Project } from '../model/types';
import { changeProject } from '../store';
import { type DataColumn, DataTable } from './DataTable';
import { ErrorBox, errorText, Modal } from './Modal';
import { PlanningPanel } from './PlanningPanel';

const facets = [
  ['rank', 'Grad', (person: Person) => [person.grad]],
  ['function', 'Funktion', (person: Person) => [person.funktion]],
  ['license', 'Fahrausweis', (person: Person) => person.lics],
  ['unit', 'Einteilung', (person: Person) => [person.einteilung ?? '']],
  ['platoon', 'Zug', (person: Person) => [person.zug ?? '']],
  [
    'source',
    'Datenquelle',
    (person: Person) => [person.pisa ? 'PISA' : '', person.milo ? 'MILO' : ''].filter(Boolean),
  ],
] as const;

export function PeoplePicker({
  project,
  group,
  onClose,
  presentation = 'dialog',
}: {
  project: Project;
  group: Detachment;
  onClose: () => void;
  presentation?: 'dialog' | 'panel';
}) {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<Record<string, string[]>>({});
  const [onlyFree, setOnlyFree] = useState(false);
  // Keep only explicit user edits. Board changes remain live while this nonmodal panel is open.
  const [selectionEdits, setSelectionEdits] = useState<Map<string, boolean>>(() => new Map());
  const selected = new Set(project.assign[group.id] ?? []);
  for (const [id, checked] of selectionEdits) {
    if (checked) selected.add(id);
    else selected.delete(id);
  }
  const [error, setError] = useState('');
  const eligible = project.persons.filter((person) => person.planning.status !== 'excluded');
  const matches = eligible.filter((person) => {
    const words = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const haystack = [
      person.name,
      person.pnr,
      person.grad,
      person.funktion,
      ...person.lics,
      person.einteilung,
      person.zug,
    ]
      .join(' ')
      .toLocaleLowerCase();
    return (
      words.every((word) => haystack.includes(word)) &&
      (!onlyFree || !Object.values(project.assign).some((ids) => ids.includes(person.id))) &&
      facets.every(
        ([key, , values]) =>
          !filters[key]?.length || values(person).some((value) => filters[key]?.includes(value)),
      )
    );
  });
  const columns = useMemo<DataColumn<Person>[]>(
    () => [
      {
        id: 'select',
        header: 'Auswahl',
        cell: (person) => (
          <input
            type="checkbox"
            aria-label={`${person.name} auswählen`}
            checked={selected.has(person.id)}
            onChange={(event) =>
              setSelectionEdits((old) => new Map(old).set(person.id, event.target.checked))
            }
          />
        ),
      },
      {
        id: 'name',
        header: 'Person',
        value: (person) => person.name,
        cell: (person) => (
          <>
            <strong>{person.name}</strong>
            <small>{person.pnr || 'Keine Personennummer'}</small>
          </>
        ),
      },
      {
        id: 'rank',
        header: 'Grad',
        value: (person) => person.grad,
        cell: (person) => person.grad || '—',
      },
      {
        id: 'function',
        header: 'Funktion / Ausweis',
        value: (person) => person.funktion,
        cell: (person) => (
          <>
            {person.funktion || '—'}
            <small>{person.lics.join(', ')}</small>
          </>
        ),
      },
      {
        id: 'assignment',
        header: 'Direkt zugeteilt',
        cell: (person) =>
          project.dets
            .filter((item) => project.assign[item.id]?.includes(person.id))
            .map((item) => item.name)
            .join(', ') || <span className="muted">Noch frei</span>,
      },
    ],
    [selected, project],
  );
  const moved = [...selected].filter(
    (id) =>
      selectionEdits.get(id) === true &&
      Object.entries(project.assign).some(
        ([groupId, ids]) => groupId !== group.id && ids.includes(id),
      ),
  ).length;
  const save = () => {
    setError('');
    try {
      changeProject((draft) => {
        if (draft.id !== project.id)
          throw new Error('Die Dienstleistung wurde gewechselt. Bitte die Auswahl erneut öffnen.');
        const added = [...selectionEdits].filter(([, checked]) => checked).map(([id]) => id);
        const removed = [...selectionEdits].filter(([, checked]) => !checked).map(([id]) => id);
        if (
          draft.persons.some(
            (person) => added.includes(person.id) && person.planning.status === 'excluded',
          )
        )
          throw new Error(
            'Eine ausgewählte Person wurde inzwischen ausgeschlossen. Bitte die Auswahl prüfen.',
          );
        removePeople(draft, group.id, removed);
        assignPeople(draft, group.id, added);
      });
      onClose();
    } catch (caught) {
      setError(errorText(caught));
    }
  };
  const Surface = presentation === 'panel' ? PlanningPanel : Modal;
  return (
    <Surface
      title={`Personen auswählen · ${group.name}`}
      onClose={onClose}
      wide
      footer={
        <>
          <span className="selection-count">
            {selected.size} ausgewählt{moved > 0 && ` · ${moved} werden hierher verschoben`}
          </span>
          <button type="button" className="button-secondary" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" onClick={save}>
            Zuteilung speichern
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <p className="muted">
        Filter kombinieren, Treffer auswählen und weiterfiltern. Deine Auswahl bleibt erhalten.
        Ausgeschlossene Personen werden hier nicht angeboten.
      </p>
      <label className="search-label">
        Personen suchen
        <input
          type="search"
          placeholder="Name, Grad, Funktion, Ausweis oder Nummer …"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <div className="filter-grid">
        {facets.map(([key, label, values]) => {
          const options = [...new Set(eligible.flatMap(values).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, 'de-CH'),
          );
          return (
            <details className="filter-menu" key={key}>
              <summary>
                {label}
                {filters[key]?.length ? ` (${filters[key]?.length})` : ''}
              </summary>
              <div className="filter-options">
                {options.length ? (
                  options.map((option) => (
                    <label className="check-label" key={option}>
                      <input
                        type="checkbox"
                        checked={filters[key]?.includes(option) ?? false}
                        onChange={(event) =>
                          setFilters((old) => ({
                            ...old,
                            [key]: event.target.checked
                              ? [...(old[key] ?? []), option]
                              : (old[key] ?? []).filter((value) => value !== option),
                          }))
                        }
                      />
                      {option}
                    </label>
                  ))
                ) : (
                  <span className="muted">Keine Angaben</span>
                )}
              </div>
            </details>
          );
        })}
      </div>
      <div className="selection-toolbar">
        <label className="check-label">
          <input
            type="checkbox"
            checked={onlyFree}
            onChange={(event) => setOnlyFree(event.target.checked)}
          />
          Nur noch nicht zugeteilte Personen
        </label>
        <button
          type="button"
          className="text-button"
          onClick={() => {
            setFilters({});
            setSearch('');
            setOnlyFree(false);
          }}
        >
          Filter zurücksetzen
        </button>
      </div>
      <div className="selection-toolbar">
        <strong>{matches.length} Treffer</strong>
        <div className="button-row">
          <button
            type="button"
            className="button-secondary"
            onClick={() =>
              setSelectionEdits((old) => {
                const next = new Map(old);
                for (const person of matches) next.set(person.id, true);
                return next;
              })
            }
          >
            Alle Treffer auswählen
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setSelectionEdits((old) => {
                const next = new Map(old);
                for (const person of matches) next.set(person.id, false);
                return next;
              })
            }
          >
            Trefferauswahl aufheben
          </button>
        </div>
      </div>
      <DataTable data={matches} columns={columns} getRowId={(person) => person.id} />
    </Surface>
  );
}
