import { Link } from '@tanstack/react-router';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { copyText } from '../components/CopyButton';
import { Icon } from '../components/Icon';
import { ErrorBox, errorText } from '../components/Modal';
import { DetSheetView, printDetSheet } from '../components/onsite/DetSheetView';
import {
  bestand,
  buildDetSheet,
  DEFAULT_DET_SHEET_OPTIONS,
  DET_SHEET_COLUMNS,
  type DetSheetOptions,
  detSheetText,
  exportDetSheet,
} from '../io/detSheet';
import { displayDate, localError, searchText } from '../io/text';
import {
  addSubDets,
  listName,
  moveToSubDet,
  onsiteView,
  parseSubDetNames,
  removeSubDet,
  renameSubDet,
  type SubDetGroup,
  setSubDetAuftrag,
  setSubDetChef,
  subDetSuggestions,
  subDetsOf,
} from '../model';
import type { Detachment, Person, Project } from '../model/types';
import { changeProject, notify, notifyUndoable, useProject } from '../store';
import { overlayStore, useOverlays } from '../ui';
import './pages.css';
import './onsite.css';

export default function OnsitePage() {
  const project = useProject();
  return <Onsite key={project.id} />;
}

function Onsite() {
  const project = useProject();
  const overlays = useOverlays();
  const [selectedId, setSelectedId] = useState(
    () => overlays.onsiteIntent?.id ?? project.dets[0]?.id ?? '',
  );
  const [tab, setTab] = useState<'split' | 'output'>('split');
  const [options, setOptions] = useState<DetSheetOptions>(DEFAULT_DET_SHEET_OPTIONS);
  // One-shot request from a planning card.
  useEffect(() => {
    const intent = overlays.onsiteIntent;
    if (!intent) return;
    overlayStore.setState((old) => ({ ...old, onsiteIntent: null }));
    setSelectedId(intent.id);
    setTab('split');
  }, [overlays.onsiteIntent]);
  const selected = project.dets.find((group) => group.id === selectedId) ?? project.dets[0];
  if (!selected)
    return (
      <div className="page">
        <div className="empty">
          <span className="empty-icon">
            <Icon name="layout" size={22} />
          </span>
          <h2>Noch keine Detachemente.</h2>
          <p>Vor Ort teilst du bestehende Detachemente in Untergruppen auf.</p>
          <Link to="/" className="btn btn-primary">
            Zur Planung
          </Link>
        </div>
      </div>
    );
  return (
    <div className="page page-wide onsite-page">
      <section className="page-intro no-print">
        <div>
          <h2>Vor Ort aufteilen und Listen ausgeben</h2>
          <p>
            Untergruppen wie «Det Mat» oder «Det VT» gelten nur für den Dienst vor Ort.
            PISA-Einträge, EC und die Einrückungsgruppen bleiben unverändert.
          </p>
        </div>
      </section>
      <div className="onsite-layout">
        <aside className="onsite-rail no-print">
          <div className="card">
            <ul className="entry-list" aria-label="Detachemente">
              {project.dets.map((group) => (
                <DetRailItem
                  key={group.id}
                  project={project}
                  group={group}
                  active={group.id === selected.id}
                  onSelect={() => setSelectedId(group.id)}
                />
              ))}
            </ul>
          </div>
        </aside>
        <div className="onsite-main" key={selected.id}>
          <header className="card onsite-head no-print">
            <span className={`ec ${selected.ec ? '' : 'is-missing'}`}>{selected.ec || '—'}</span>
            <div className="grow">
              <h2>{selected.name}</h2>
              <p>
                {[
                  selected.datum &&
                    `${displayDate(selected.datum)} – ${selected.bisDatum ? displayDate(selected.bisDatum) : '…'}`,
                  selected.ort,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Einrücken & Entlassung in der Planung ergänzen'}
              </p>
            </div>
            <div className="segmented" role="tablist" aria-label="Ansicht">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'split'}
                onClick={() => setTab('split')}
              >
                <Icon name="layout" size={15} /> Aufteilen
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'output'}
                onClick={() => setTab('output')}
              >
                <Icon name="printer" size={15} /> Liste ausgeben
              </button>
            </div>
          </header>
          {tab === 'split' ? (
            <SplitView project={project} group={selected} onOutput={() => setTab('output')} />
          ) : (
            <OutputView
              project={project}
              group={selected}
              options={options}
              onOptions={setOptions}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function DetRailItem({
  project,
  group,
  active,
  onSelect,
}: {
  project: Project;
  group: Detachment;
  active: boolean;
  onSelect: () => void;
}) {
  const view = onsiteView(project, group.id);
  const subs = view.groups.length;
  return (
    <li>
      <button type="button" className="entry-item" aria-pressed={active} onClick={onSelect}>
        <span className={`ec ${group.ec ? '' : 'is-missing'}`}>{group.ec || '—'}</span>
        <span className="grow">
          <span className="truncate">{group.name}</span>
          <small>
            {view.pool.length} Pers. ·{' '}
            {subs
              ? `${subs} ${subs === 1 ? 'Untergruppe' : 'Untergruppen'}${view.unassigned.length ? ` · ${view.unassigned.length} offen` : ''}`
              : 'nicht aufgeteilt'}
          </small>
        </span>
      </button>
    </li>
  );
}

/** «Det Mat» → «Mat» for the compact per-person buttons. */
function shortLabel(name: string): string {
  return name.replace(/^det(achement)?\.?\s+/i, '') || name;
}

function SplitView({
  project,
  group,
  onOutput,
}: {
  project: Project;
  group: Detachment;
  onOutput: () => void;
}) {
  const archived = Boolean(project.archive);
  const view = useMemo(() => onsiteView(project, group.id), [project, group.id]);
  const suggestions = subDetSuggestions(project, group.id);
  const [error, setError] = useState('');
  const [names, setNames] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [funktion, setFunktion] = useState('');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const anchor = useRef<string | null>(null);
  const list = useRef<HTMLUListElement>(null);
  const mutate = (callback: (draft: Project) => void): boolean => {
    try {
      changeProject(callback);
      setError('');
      return true;
    } catch (caught) {
      setError(errorText(caught));
      return false;
    }
  };
  const create = (values: string[]) => {
    const before = subDetsOf(project, group.id).length;
    if (mutate((draft) => addSubDets(draft, group.id, values))) {
      setNames('');
      const created = values.length > 1 ? `${values.length} Untergruppen` : `«${values[0]}»`;
      if (!before) notify(`${created} erstellt. Jetzt Personen einteilen.`, { tone: 'success' });
    }
  };
  const move = (subId: string | null, ids: string[]) =>
    mutate((draft) => moveToSubDet(draft, group.id, subId, ids));
  const functions = [...new Set(view.pool.map((person) => person.funktion).filter(Boolean))].sort(
    (a, b) => a.localeCompare(b, 'de-CH'),
  );
  const words = searchText(search).split(' ').filter(Boolean);
  const visible = view.pool.filter((person) => {
    const place = view.placement.get(person.id) ?? '';
    if (filter === 'open' ? place : filter !== 'all' && place !== filter) return false;
    if (funktion && person.funktion !== funktion) return false;
    const haystack = searchText(
      [person.grad, person.name, person.funktion, ...person.lics, person.zug].join(' '),
    );
    return words.every((word) => haystack.includes(word));
  });
  const chosen = [...selected].filter((id) => view.pool.some((person) => person.id === id));
  const toggle = (person: Person, range: boolean) => {
    const checked = !selected.has(person.id);
    let ids = [person.id];
    if (range && anchor.current) {
      const order = visible.map((item) => item.id);
      const [a, b] = [order.indexOf(anchor.current), order.indexOf(person.id)].sort(
        (x, y) => x - y,
      );
      if (a >= 0 && b >= 0) ids = order.slice(a, b + 1);
    }
    anchor.current = person.id;
    setSelected((old) => {
      const next = new Set(old);
      for (const id of ids) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };
  // Rows are keyed by person, so the target row stays mounted across the update and can be
  // focused right away; waiting for a frame would let fast typing hit the same row twice.
  const focusPerson = (id: string | undefined) => {
    if (!id) return;
    list.current
      ?.querySelector<HTMLInputElement>(`input[data-person="${CSS.escape(id)}"]`)
      ?.focus();
  };
  // Keyboard flow: focus a row, press 1–9 for a sub-group or 0 for «nicht eingeteilt».
  // The focus then moves on, so a whole list is split with one key per person.
  const onRowKey = (event: KeyboardEvent<HTMLLIElement>, person: Person, index: number) => {
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusPerson(visible[index + (event.key === 'ArrowDown' ? 1 : -1)]?.id);
      return;
    }
    if (archived || !/^[0-9]$/.test(event.key)) return;
    const number = Number(event.key);
    const target = number ? view.groups[number - 1] : undefined;
    if (number && !target) return;
    event.preventDefault();
    // At the end of the list stay on the row, unless the filter is about to hide it.
    const stays = filter === 'all' || filter === (target?.sub.id ?? 'open');
    const next = visible[index + 1]?.id ?? (stays ? person.id : visible[index - 1]?.id);
    if (move(target?.sub.id ?? null, [person.id])) focusPerson(next);
  };
  return (
    <>
      <section className="card no-print">
        <header className="card-head">
          <h2>
            <Icon name="layout" size={17} /> Untergruppen
          </h2>
          <span className="muted">
            {view.groups.length
              ? `${view.unassigned.length} von ${view.pool.length} noch nicht eingeteilt`
              : `${view.pool.length} Personen im Detachement`}
          </span>
        </header>
        <div className="card-body stack">
          <div className="subdet-add">
            {suggestions.slice(0, 6).map((name) => (
              <button
                type="button"
                key={name}
                className="chip"
                disabled={archived}
                onClick={() => create([name])}
              >
                <Icon name="plus" size={13} /> {name}
              </button>
            ))}
            {suggestions.length > 1 && !view.groups.length && (
              <button
                type="button"
                className="btn btn-sm btn-primary"
                disabled={archived}
                onClick={() => create(suggestions.slice(0, 3))}
              >
                {suggestions.slice(0, 3).join(', ')} erstellen
              </button>
            )}
            <form
              className="subdet-add-form"
              onSubmit={(event) => {
                event.preventDefault();
                create(parseSubDetNames(names));
              }}
            >
              <input
                aria-label="Neue Untergruppen"
                placeholder="Weitere, z. B. Det San, Det Fhr"
                value={names}
                disabled={archived}
                onChange={(event) => setNames(event.target.value)}
              />
              <button type="submit" className="btn btn-sm" disabled={archived || !names.trim()}>
                Hinzufügen
              </button>
            </form>
          </div>
          <ErrorBox message={error} />
          {view.groups.length > 0 ? (
            <div className="subdet-grid">
              {view.groups.map((item, index) => (
                <SubDetTile
                  key={item.sub.id}
                  item={item}
                  index={index}
                  pool={view.pool}
                  archived={archived}
                  onRename={(value) => mutate((draft) => renameSubDet(draft, item.sub.id, value))}
                  onAuftrag={(value) =>
                    mutate((draft) => setSubDetAuftrag(draft, item.sub.id, value))
                  }
                  onChef={(personId) =>
                    mutate((draft) => setSubDetChef(draft, item.sub.id, personId))
                  }
                  onRemove={() => {
                    if (mutate((draft) => removeSubDet(draft, item.sub.id))) {
                      if (filter === item.sub.id) setFilter('all');
                      notifyUndoable(`«${item.sub.name}» entfernt. Die Personen sind wieder frei.`);
                    }
                  }}
                />
              ))}
            </div>
          ) : (
            <p className="muted">
              Noch keine Untergruppen. Vorschlag anklicken oder Namen eingeben – mehrere mit Komma
              trennen.
            </p>
          )}
          {view.staleIds.length > 0 && (
            <div className="callout callout-warning">
              <Icon name="info" />
              <div className="callout-body">
                {view.staleIds.length === 1
                  ? '1 Einteilung betrifft eine Person, die nicht mehr in diesem Detachement ist.'
                  : `${view.staleIds.length} Einteilungen betreffen Personen, die nicht mehr in diesem Detachement sind.`}
              </div>
              <div className="callout-actions">
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={archived}
                  onClick={() => move(null, view.staleIds)}
                >
                  Bereinigen
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {view.groups.length > 0 && (
        <section className="card onsite-people no-print">
          <header className="card-head">
            <h2>
              <Icon name="users" size={17} /> Personen einteilen
            </h2>
            <span className="muted small-note">
              Zeile wählen, dann Taste <span className="kbd">1</span>–
              <span className="kbd">{Math.min(view.groups.length, 9)}</span> ·{' '}
              <span className="kbd">0</span> = nicht eingeteilt
            </span>
          </header>
          <div className="people-filters">
            <div className="toolbar">
              <label className="search-field grow">
                <Icon name="search" size={16} />
                <input
                  type="search"
                  aria-label="Personen suchen"
                  placeholder="Name, Grad, Funktion, Ausweis …"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </label>
              {functions.length > 1 && (
                <select
                  aria-label="Funktion"
                  value={funktion}
                  onChange={(event) => setFunktion(event.target.value)}
                  style={{ width: 'auto' }}
                >
                  <option value="">Alle Funktionen</option>
                  {functions.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <fieldset className="chip-row" aria-label="Anzeige">
              <button
                type="button"
                className="chip"
                aria-pressed={filter === 'all'}
                onClick={() => setFilter('all')}
              >
                Alle <span className="count">{view.pool.length}</span>
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={filter === 'open'}
                onClick={() => setFilter('open')}
              >
                Nicht eingeteilt <span className="count">{view.unassigned.length}</span>
              </button>
              {view.groups.map((item) => (
                <button
                  type="button"
                  key={item.sub.id}
                  className="chip"
                  aria-pressed={filter === item.sub.id}
                  onClick={() => setFilter(item.sub.id)}
                >
                  {item.sub.name} <span className="count">{item.people.length}</span>
                </button>
              ))}
            </fieldset>
          </div>
          <div className="picker-bar onsite-bar">
            {chosen.length ? (
              <>
                <strong>{chosen.length} ausgewählt</strong>
                <span className="muted">einteilen in</span>
                {view.groups.map((item) => (
                  <button
                    type="button"
                    key={item.sub.id}
                    className="btn btn-sm"
                    disabled={archived}
                    onClick={() => {
                      if (move(item.sub.id, chosen)) {
                        setSelected(new Set());
                        notifyUndoable(
                          `${chosen.length === 1 ? '1 Person' : `${chosen.length} Personen`} → «${item.sub.name}».`,
                        );
                      }
                    }}
                  >
                    {item.sub.name}
                  </button>
                ))}
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  disabled={archived}
                  onClick={() => move(null, chosen) && setSelected(new Set())}
                >
                  Nicht eingeteilt
                </button>
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={() => setSelected(new Set())}
                >
                  Auswahl aufheben
                </button>
              </>
            ) : (
              <>
                <strong>{visible.length} Treffer</strong>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={!visible.length || archived}
                  onClick={() => setSelected(new Set(visible.map((person) => person.id)))}
                >
                  Alle Treffer auswählen
                </button>
              </>
            )}
          </div>
          <ul className="picker-list onsite-list" ref={list}>
            {visible.map((person, index) => {
              const place = view.placement.get(person.id) ?? '';
              const isSelected = selected.has(person.id);
              return (
                <li
                  key={person.id}
                  className={`picker-row onsite-row ${isSelected ? 'is-selected' : ''}`}
                  onKeyDown={(event) => onRowKey(event, person, index)}
                  onClick={(event) => {
                    if ((event.target as HTMLElement).closest('input, button')) return;
                    toggle(person, event.shiftKey);
                  }}
                >
                  <input
                    type="checkbox"
                    data-person={person.id}
                    aria-label={`${person.name} auswählen`}
                    checked={isSelected}
                    onChange={() => {}}
                    onClick={(event) => toggle(person, event.shiftKey)}
                  />
                  <span className="person-main">
                    <span className="truncate">
                      {person.grad && <span className="muted">{person.grad} </span>}
                      <strong>{listName(person)}</strong>
                    </span>
                    <small className="truncate">
                      {[person.funktion, ...person.lics].filter(Boolean).join(' · ') ||
                        'Keine weiteren Angaben'}
                    </small>
                  </span>
                  <fieldset
                    className="segmented onsite-choice"
                    aria-label={`Untergruppe für ${person.name}`}
                  >
                    <button
                      type="button"
                      aria-pressed={!place}
                      disabled={archived}
                      title="Nicht eingeteilt (0)"
                      aria-label="Nicht eingeteilt"
                      onClick={() => move(null, [person.id])}
                    >
                      –
                    </button>
                    {view.groups.map((item, number) => (
                      <button
                        type="button"
                        key={item.sub.id}
                        aria-pressed={place === item.sub.id}
                        disabled={archived}
                        title={`${item.sub.name}${number < 9 ? ` (${number + 1})` : ''}`}
                        aria-label={item.sub.name}
                        onClick={() => move(item.sub.id, [person.id])}
                      >
                        {shortLabel(item.sub.name)}
                      </button>
                    ))}
                  </fieldset>
                </li>
              );
            })}
            {!visible.length && (
              <li className="empty">
                <p>Keine passenden Personen.</p>
              </li>
            )}
          </ul>
          <footer className="onsite-foot">
            <span className="muted">
              {view.unassigned.length
                ? `${view.unassigned.length} noch nicht eingeteilt`
                : 'Alle Personen eingeteilt.'}
            </span>
            <button type="button" className="btn btn-sm btn-primary" onClick={onOutput}>
              <Icon name="printer" size={15} /> Liste ausgeben
            </button>
          </footer>
        </section>
      )}
      {!view.pool.length && (
        <div className="callout callout-info no-print">
          <Icon name="info" />
          <div className="callout-body">
            Diesem Detachement sind noch keine Personen zugeteilt.{' '}
            <Link to="/">In der Planung zuteilen →</Link>
          </div>
        </div>
      )}
    </>
  );
}

function SubDetTile({
  item,
  index,
  pool,
  archived,
  onRename,
  onAuftrag,
  onChef,
  onRemove,
}: {
  item: SubDetGroup;
  index: number;
  pool: Person[];
  archived: boolean;
  onRename: (value: string) => boolean;
  onAuftrag: (value: string) => boolean;
  onChef: (personId: string) => boolean;
  onRemove: () => void;
}) {
  const members = new Set(item.people.map((person) => person.id));
  const auftragId = useId();
  const label = (person: Person) => [person.grad, listName(person)].filter(Boolean).join(' ');
  return (
    <article className="subdet-tile" aria-label={item.sub.name}>
      <header>
        {index < 9 && (
          <span className="kbd" title="Taste in der Personenliste">
            {index + 1}
          </span>
        )}
        <CommitInput
          label="Name der Untergruppe"
          className="subdet-name"
          value={item.sub.name}
          disabled={archived}
          onCommit={onRename}
        />
        <span className="count">{item.people.length}</span>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label={`${item.sub.name} entfernen`}
          title="Untergruppe entfernen"
          disabled={archived}
          onClick={onRemove}
        >
          <Icon name="trash" size={15} />
        </button>
      </header>
      <label className="field">
        Chef
        <select
          value={item.chef?.id ?? ''}
          disabled={archived}
          onChange={(event) => onChef(event.target.value)}
        >
          <option value="">— noch offen —</option>
          {item.people.length > 0 && (
            <optgroup label="In dieser Untergruppe">
              {item.people.map((person) => (
                <option key={person.id} value={person.id}>
                  {label(person)}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label="Übrige im Detachement">
            {pool
              .filter((person) => !members.has(person.id))
              .map((person) => (
                <option key={person.id} value={person.id}>
                  {label(person)}
                </option>
              ))}
          </optgroup>
        </select>
      </label>
      <div className="field">
        <label htmlFor={auftragId}>Auftrag / Ort</label>
        <CommitInput
          id={auftragId}
          label={`Auftrag ${item.sub.name}`}
          value={item.sub.auftrag}
          placeholder="z. B. Fassung, Ort, Fahrzeug"
          disabled={archived}
          onCommit={onAuftrag}
          allowEmpty
        />
      </div>
      <p className="subdet-summary">{bestand(item.people) || 'Noch niemand eingeteilt'}</p>
    </article>
  );
}

/** Text input that saves on Enter or blur and reverts on Escape. */
function CommitInput({
  id,
  label,
  value,
  onCommit,
  disabled,
  placeholder,
  className,
  allowEmpty = false,
}: {
  id?: string;
  label: string;
  value: string;
  onCommit: (value: string) => boolean;
  disabled: boolean;
  placeholder?: string;
  className?: string;
  allowEmpty?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  const cancelled = useRef(false);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = draft.trim();
    if (next === value || (!next && !allowEmpty)) {
      setDraft(value);
      return;
    }
    if (!onCommit(next)) setDraft(value);
  };
  return (
    <input
      id={id}
      aria-label={label}
      className={className}
      value={draft}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          event.currentTarget.blur();
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancelled.current = true;
          setDraft(value);
          event.currentTarget.blur();
        }
      }}
    />
  );
}

const OPTION_TOGGLES: [keyof Omit<DetSheetOptions, 'scope' | 'columns'>, string][] = [
  ['grouped', 'Nach Untergruppen gliedern'],
  ['pageBreaks', 'Jede Untergruppe auf neuer Seite'],
  ['checkColumn', 'Spalte zum Abhaken'],
];

function OutputView({
  project,
  group,
  options,
  onOptions,
}: {
  project: Project;
  group: Detachment;
  options: DetSheetOptions;
  onOptions: (options: DetSheetOptions) => void;
}) {
  const view = onsiteView(project, group.id);
  // A scope from another detachement or a removed sub-group falls back to the whole list.
  const effective =
    options.scope === 'all' || view.groups.some((item) => item.sub.id === options.scope)
      ? options
      : { ...options, scope: 'all' };
  const sheet = buildDetSheet(project, group.id, effective);
  const scoped = effective.scope !== 'all';
  const run = (action: () => void, done: string) => {
    try {
      action();
      notify(done, { tone: 'success' });
    } catch (failure) {
      notify(localError(failure), { tone: 'warning' });
    }
  };
  return (
    <>
      <section className="card onsite-output no-print">
        <div className="card-body stack">
          <div className="toolbar onsite-output-actions">
            <label className="field">
              Umfang
              <select
                value={effective.scope}
                onChange={(event) => onOptions({ ...options, scope: event.target.value })}
              >
                <option value="all">Ganzes Detachement ({view.pool.length})</option>
                {view.groups.map((item) => (
                  <option key={item.sub.id} value={item.sub.id}>
                    {item.sub.name} ({item.people.length})
                  </option>
                ))}
              </select>
            </label>
            <div className="spacer" />
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => printDetSheet(sheet)}
              title="Drucken oder im Druckdialog «Als PDF speichern» wählen"
            >
              <Icon name="printer" size={16} /> Drucken / PDF
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => run(() => exportDetSheet(sheet), 'Excel-Liste lokal gespeichert.')}
            >
              <Icon name="sheet" size={16} /> Excel
            </button>
            <button
              type="button"
              className="btn"
              onClick={async () => {
                if (await copyText(detSheetText(sheet)))
                  notify('Liste als Text in die Zwischenablage kopiert.', { tone: 'success' });
              }}
            >
              <Icon name="copy" size={16} /> Als Text kopieren
            </button>
          </div>
          <fieldset className="chip-row" aria-label="Spalten">
            <span className="muted onsite-chip-label">Spalten</span>
            {DET_SHEET_COLUMNS.map((column) => (
              <button
                type="button"
                key={column.key}
                className="chip"
                aria-pressed={options.columns[column.key]}
                onClick={() =>
                  onOptions({
                    ...options,
                    columns: { ...options.columns, [column.key]: !options.columns[column.key] },
                  })
                }
              >
                {column.label}
              </button>
            ))}
          </fieldset>
          <fieldset className="chip-row" aria-label="Gliederung">
            <span className="muted onsite-chip-label">Gliederung</span>
            {OPTION_TOGGLES.map(([key, label]) => (
              <button
                type="button"
                key={key}
                className="chip"
                aria-pressed={options[key]}
                disabled={key !== 'checkColumn' && (scoped || !view.groups.length)}
                onClick={() => onOptions({ ...options, [key]: !options[key] })}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <p className="muted small-note">
            <Icon name="shield" size={13} className="inline-icon" /> Die Liste entsteht auf diesem
            Gerät und enthält Personendaten. Ausdrucke und Dateien vertraulich behandeln.
          </p>
        </div>
      </section>
      <DetSheetView sheet={sheet} />
    </>
  );
}
