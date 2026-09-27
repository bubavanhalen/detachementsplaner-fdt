import { useMemo, useRef, useState } from 'react';
import { searchText } from '../io/text';
import { assignPeople, removePeople } from '../model';
import type { Detachment, Person, Project } from '../model/types';
import { changeProject, notifyUndoable } from '../store';
import { personInitials } from './format';
import { Icon } from './Icon';
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
  const anchor = useRef<string | null>(null);
  const selected = new Set(project.assign[group.id] ?? []);
  for (const [id, checked] of selectionEdits) {
    if (checked) selected.add(id);
    else selected.delete(id);
  }
  const [error, setError] = useState('');
  const eligible = project.persons.filter((person) => person.planning.status !== 'excluded');
  const assignedElsewhere = useMemo(() => {
    const where = new Map<string, string[]>();
    for (const item of project.dets)
      for (const id of project.assign[item.id] ?? [])
        if (item.id !== group.id) where.set(id, [...(where.get(id) ?? []), item.name]);
    return where;
  }, [project, group.id]);
  const isAssigned = (id: string) => Object.values(project.assign).some((ids) => ids.includes(id));
  const matchesText = (person: Person) => {
    const words = searchText(search).split(' ').filter(Boolean);
    const haystack = searchText(
      [
        person.name,
        person.pnr,
        person.grad,
        person.funktion,
        ...person.lics,
        person.einteilung,
        person.zug,
      ].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  };
  const matches = eligible.filter(
    (person) =>
      matchesText(person) &&
      (!onlyFree || !isAssigned(person.id)) &&
      facets.every(
        ([key, , values]) =>
          !filters[key]?.length || values(person).some((value) => filters[key]?.includes(value)),
      ),
  );
  const activeFilters = Object.values(filters).reduce((sum, list) => sum + list.length, 0);
  const moved = [...selected].filter(
    (id) =>
      selectionEdits.get(id) === true &&
      Object.entries(project.assign).some(
        ([groupId, ids]) => groupId !== group.id && ids.includes(id),
      ),
  ).length;
  const changes = [...selectionEdits].filter(
    ([id, checked]) => checked !== (project.assign[group.id] ?? []).includes(id),
  ).length;
  const setMany = (ids: string[], checked: boolean) =>
    setSelectionEdits((old) => {
      const next = new Map(old);
      for (const id of ids) next.set(id, checked);
      return next;
    });
  const toggle = (person: Person, range: boolean) => {
    const checked = !selected.has(person.id);
    if (range && anchor.current) {
      const ids = matches.map((item) => item.id);
      const [a, b] = [ids.indexOf(anchor.current), ids.indexOf(person.id)].sort((x, y) => x - y);
      if (a >= 0 && b >= 0) {
        setMany(ids.slice(a, b + 1), checked);
        anchor.current = person.id;
        return;
      }
    }
    anchor.current = person.id;
    setMany([person.id], checked);
  };
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
      if (changes) notifyUndoable(`Zuteilung von «${group.name}» gespeichert.`);
      onClose();
    } catch (caught) {
      setError(errorText(caught));
    }
  };
  const Surface = presentation === 'panel' ? PlanningPanel : Modal;
  return (
    <Surface
      title={`Personen auswählen · ${group.name}`}
      description="Filter kombinieren, Treffer anklicken. Shift+Klick wählt einen Bereich."
      onClose={onClose}
      wide
      footer={
        <>
          <span className="selection-count">
            {selected.size} ausgewählt{moved > 0 && ` · ${moved} werden hierher verschoben`}
          </span>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" onClick={save}>
            Zuteilung speichern
          </button>
        </>
      }
    >
      <ErrorBox message={error} />
      <div className="picker-search">
        <label className="search-field">
          <Icon name="search" size={16} />
          <input
            type="search"
            aria-label="Personen suchen"
            placeholder="Name, Grad, Funktion, Ausweis oder Nummer …"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <div className="picker-filters">
          <button
            type="button"
            className="chip"
            aria-pressed={onlyFree}
            onClick={() => setOnlyFree((value) => !value)}
          >
            Nur noch nicht zugeteilte Personen
          </button>
          {facets.map(([key, label, values]) => {
            const counts = new Map<string, number>();
            for (const person of eligible)
              for (const value of new Set(values(person)))
                if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
            const options = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'de-CH'));
            const active = filters[key]?.length ?? 0;
            if (!options.length) return null;
            return (
              <details className={`filter-menu ${active ? 'is-active' : ''}`} key={key}>
                <summary>
                  {label}
                  {active > 0 && <span className="count">{active}</span>}
                  <Icon name="chevronDown" />
                </summary>
                <div className="filter-options">
                  {options.map((option) => (
                    <label className="check" key={option}>
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
                      <span className="count">{counts.get(option)}</span>
                    </label>
                  ))}
                </div>
              </details>
            );
          })}
          {(activeFilters > 0 || search || onlyFree) && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                setFilters({});
                setSearch('');
                setOnlyFree(false);
              }}
            >
              <Icon name="x" size={14} /> Filter zurücksetzen
            </button>
          )}
        </div>
      </div>
      <div className="picker-bar">
        <strong>{matches.length} Treffer</strong>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!matches.length}
          onClick={() =>
            setMany(
              matches.map((person) => person.id),
              true,
            )
          }
        >
          Alle Treffer auswählen
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={!matches.length}
          onClick={() =>
            setMany(
              matches.map((person) => person.id),
              false,
            )
          }
        >
          Trefferauswahl aufheben
        </button>
      </div>
      <ul className="picker-list">
        {matches.map((person) => {
          const isSelected = selected.has(person.id);
          const elsewhere = assignedElsewhere.get(person.id);
          return (
            // biome-ignore lint/a11y/useKeyWithClickEvents: The row click is a pointer shortcut; the checkbox is the keyboard control.
            <li
              key={person.id}
              className={`picker-row ${isSelected ? 'is-selected' : ''}`}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('input')) return;
                toggle(person, event.shiftKey);
              }}
            >
              <input
                type="checkbox"
                aria-label={`${person.name} auswählen`}
                checked={isSelected}
                onChange={() => {}}
                onClick={(event) => toggle(person, event.shiftKey)}
              />
              <span className="avatar" aria-hidden="true">
                {personInitials(person)}
              </span>
              <span className="person-main">
                <span className="truncate">
                  {person.grad && <span className="muted">{person.grad} </span>}
                  <strong>{person.name}</strong>
                </span>
                <small className="truncate">
                  {[person.funktion, ...person.lics, person.pnr].filter(Boolean).join(' · ') ||
                    'Keine weiteren Angaben'}
                </small>
              </span>
              {person.planning.status === 'unreviewed' && (
                <span className="badge badge-warning">klären</span>
              )}
              {elsewhere ? (
                <span className="badge where" title={`Direkt zugeteilt: ${elsewhere.join(', ')}`}>
                  {elsewhere.join(', ')}
                </span>
              ) : (
                !(project.assign[group.id] ?? []).includes(person.id) && (
                  <span className="badge badge-accent where">frei</span>
                )
              )}
            </li>
          );
        })}
        {!matches.length && (
          <li className="empty">
            <p>Keine passenden Personen. Ausgeschlossene Personen werden hier nicht angeboten.</p>
          </li>
        )}
      </ul>
    </Surface>
  );
}
