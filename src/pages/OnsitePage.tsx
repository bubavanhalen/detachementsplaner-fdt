import { Link } from '@tanstack/react-router';
import { type KeyboardEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { copyText } from '../components/CopyButton';
import { Icon } from '../components/Icon';
import { ErrorBox, errorText, Modal } from '../components/Modal';
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
  copyEvent,
  createEvent,
  eventsForDet,
  groupPeople,
  licenseCategories,
  listName,
  moveToSubDet,
  onsiteEvents,
  onsiteView,
  parseSubDetNames,
  removeEvent,
  removeSubDet,
  renameSubDet,
  type SubDetGroup,
  setSubDetAuftrag,
  setSubDetChef,
  shortFunction,
  subDetSuggestions,
  subDetsOf,
  updateEvent,
} from '../model';
import type { OnsiteEvent, Person, Project } from '../model/types';
import { changeProject, notify, notifyUndoable, projectStore, useProject } from '../store';
import { overlayStore, useOverlays } from '../ui';
import './pages.css';
import './onsite.css';

export default function OnsitePage() {
  const project = useProject();
  return <Onsite key={project.id} />;
}

/** «26.04.–30.04.2027» */
function shortPeriod(event: OnsiteEvent): string {
  if (!event.von && !event.bis) return '';
  if (!event.von || !event.bis || event.von === event.bis)
    return displayDate(event.von || event.bis);
  return `${displayDate(event.von).slice(0, 6)}–${displayDate(event.bis)}`;
}

function Onsite() {
  const project = useProject();
  const overlays = useOverlays();
  const archived = Boolean(project.archive);
  const events = onsiteEvents(project);
  const [selectedId, setSelectedId] = useState(() => events[0]?.id ?? '');
  const [tab, setTab] = useState<'split' | 'output'>('split');
  const [options, setOptions] = useState<DetSheetOptions>(DEFAULT_DET_SHEET_OPTIONS);
  // undefined: closed; otherwise the PISA detachements preselected for a new event.
  const [creating, setCreating] = useState<string[] | undefined>(undefined);
  // One-shot request from a planning card: open its event or prepare a new one.
  useEffect(() => {
    const intent = overlays.onsiteIntent;
    if (!intent) return;
    overlayStore.setState((old) => ({ ...old, onsiteIntent: null }));
    const current = projectStore.get();
    const forDet = eventsForDet(current, intent.id);
    if (current.onsiteEvents?.some((event) => event.id === intent.id)) setSelectedId(intent.id);
    else if (forDet.length) setSelectedId(forDet[0].id);
    else if (!archived && current.dets.some((group) => group.id === intent.id))
      setCreating([intent.id]);
    setTab('split');
  }, [overlays.onsiteIntent, archived]);
  const selected = events.find((event) => event.id === selectedId) ?? events[0];
  const mutate = (callback: (draft: Project) => void): boolean => {
    try {
      changeProject(callback);
      return true;
    } catch (failure) {
      notify(localError(failure), { tone: 'warning' });
      return false;
    }
  };
  const dialog = creating && (
    <NewEventDialog
      project={project}
      detIds={creating}
      onClose={() => setCreating(undefined)}
      onCreated={(id) => {
        setCreating(undefined);
        setSelectedId(id);
        setTab('split');
      }}
    />
  );
  if (!selected)
    return (
      <div className="page">
        <div className="empty">
          <span className="empty-icon">
            <Icon name="calendar" size={22} />
          </span>
          <h2>Noch kein Event.</h2>
          <p>
            Ein Event (z. B. «KVK» vom … bis …) enthält die Detachemente vor Ort wie Det Mat, Det VT
            oder Det Kp. Die PISA-Detachemente dienen als Filter.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={archived}
            onClick={() => setCreating([])}
          >
            <Icon name="plus" size={16} /> Neues Event
          </button>
        </div>
        {dialog}
      </div>
    );
  return (
    <div className="page page-wide onsite-page">
      <section className="page-intro no-print">
        <div>
          <h2>Events vor Ort</h2>
          <p>
            Pro Event (z. B. «KVK») Detachemente wie «Det Mat» oder «Det VT» bilden. Die
            PISA-Detachemente filtern nur, wer zur Auswahl steht; PISA-Einträge, EC und die Planung
            bleiben unverändert.
          </p>
        </div>
      </section>
      <div className="onsite-layout">
        <aside className="onsite-rail no-print">
          <div className="card">
            <p className="onsite-rail-label">Events</p>
            <ul className="entry-list" aria-label="Events">
              {events.map((event) => (
                <EventRailItem
                  key={event.id}
                  project={project}
                  event={event}
                  active={event.id === selected.id}
                  onSelect={() => setSelectedId(event.id)}
                />
              ))}
            </ul>
            <div className="onsite-rail-foot">
              <button
                type="button"
                className="btn btn-sm btn-block"
                disabled={archived}
                onClick={() => setCreating([])}
              >
                <Icon name="plus" size={15} /> Neues Event
              </button>
            </div>
          </div>
        </aside>
        <div className="onsite-main" key={selected.id}>
          <EventHeader
            project={project}
            event={selected}
            tab={tab}
            onTab={setTab}
            onCopy={() => {
              let id = '';
              if (
                mutate((draft) => {
                  id = copyEvent(draft, selected.id).id;
                })
              ) {
                setSelectedId(id);
                notifyUndoable(`«${selected.name}» kopiert.`);
              }
            }}
            onRemove={() => {
              if (mutate((draft) => removeEvent(draft, selected.id))) {
                setSelectedId('');
                notifyUndoable(
                  `Event «${selected.name}» gelöscht. Die Planung bleibt unverändert.`,
                );
              }
            }}
          />
          {tab === 'split' ? (
            <SplitView project={project} eventId={selected.id} onOutput={() => setTab('output')} />
          ) : (
            <OutputView
              project={project}
              eventId={selected.id}
              options={options}
              onOptions={setOptions}
            />
          )}
        </div>
      </div>
      {dialog}
    </div>
  );
}

function EventRailItem({
  project,
  event,
  active,
  onSelect,
}: {
  project: Project;
  event: OnsiteEvent;
  active: boolean;
  onSelect: () => void;
}) {
  const view = onsiteView(project, event.id);
  const subs = view.groups.length;
  return (
    <li>
      <button type="button" className="entry-item" aria-pressed={active} onClick={onSelect}>
        <span className="grow">
          <span className="truncate">{event.name}</span>
          <small>
            {[
              shortPeriod(event),
              `${view.pool.length} Pers.`,
              subs
                ? `${subs} Det${view.unassigned.length ? ` · ${view.unassigned.length} offen` : ''}`
                : 'nicht aufgeteilt',
            ]
              .filter(Boolean)
              .join(' · ')}
          </small>
        </span>
      </button>
    </li>
  );
}

function EventHeader({
  project,
  event,
  tab,
  onTab,
  onCopy,
  onRemove,
}: {
  project: Project;
  event: OnsiteEvent;
  tab: 'split' | 'output';
  onTab: (tab: 'split' | 'output') => void;
  onCopy: () => void;
  onRemove: () => void;
}) {
  const archived = Boolean(project.archive);
  const [error, setError] = useState('');
  const vonId = useId(),
    bisId = useId();
  const update = (patch: Parameters<typeof updateEvent>[2]): boolean => {
    try {
      changeProject((draft) => updateEvent(draft, event.id, patch));
      setError('');
      return true;
    } catch (caught) {
      setError(errorText(caught));
      return false;
    }
  };
  return (
    <header className="card onsite-head no-print">
      <div className="onsite-head-main">
        <span className="ec">
          <Icon name="calendar" size={16} />
        </span>
        <div className="grow">
          <CommitInput
            label="Name des Events"
            className="onsite-event-name"
            value={event.name}
            disabled={archived}
            onCommit={(name) => update({ name })}
          />
          <div className="onsite-dates">
            <label htmlFor={vonId}>Von</label>
            <input
              id={vonId}
              type="date"
              value={event.von}
              disabled={archived}
              onChange={(change) => update({ von: change.target.value })}
            />
            <label htmlFor={bisId}>Bis</label>
            <input
              id={bisId}
              type="date"
              value={event.bis}
              disabled={archived}
              onChange={(change) => update({ bis: change.target.value })}
            />
          </div>
        </div>
        {!archived && (
          <div className="row">
            <button type="button" className="btn btn-sm btn-ghost" onClick={onCopy}>
              <Icon name="duplicate" size={15} /> Kopieren
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onRemove}>
              <Icon name="trash" size={15} /> Löschen
            </button>
          </div>
        )}
        <div className="segmented" role="tablist" aria-label="Ansicht">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'split'}
            onClick={() => onTab('split')}
          >
            <Icon name="layout" size={15} /> Aufteilen
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'output'}
            onClick={() => onTab('output')}
          >
            <Icon name="printer" size={15} /> Liste ausgeben
          </button>
        </div>
      </div>
      <fieldset className="chip-row" aria-label="PISA-Detachemente">
        <span className="muted onsite-chip-label">PISA-Det</span>
        <button
          type="button"
          className="chip"
          aria-pressed={!event.detIds.length}
          disabled={archived}
          onClick={() => update({ detIds: [] })}
          title="Ohne Filter stehen alle Personen der Dienstleistung zur Auswahl"
        >
          Alle
        </button>
        {project.dets.map((group) => {
          const active = event.detIds.includes(group.id);
          return (
            <button
              type="button"
              key={group.id}
              className="chip"
              aria-pressed={active}
              disabled={archived}
              onClick={() =>
                update({
                  detIds: active
                    ? event.detIds.filter((id) => id !== group.id)
                    : [...event.detIds, group.id],
                })
              }
            >
              {group.name}
              <span className="count">{groupPeople(project, group.id).length}</span>
            </button>
          );
        })}
      </fieldset>
      <ErrorBox message={error} />
    </header>
  );
}

/** Name, period and the PISA detachements to filter by; dates follow the chosen cards. */
function NewEventDialog({
  project,
  detIds,
  onClose,
  onCreated,
}: {
  project: Project;
  detIds: string[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const preset = project.dets.filter((group) => detIds.includes(group.id));
  const [name, setName] = useState(() => preset.map((group) => group.name).join(' + '));
  const [von, setVon] = useState(
    () =>
      preset
        .map((group) => group.datum)
        .filter(Boolean)
        .sort()[0] ?? '',
  );
  const [bis, setBis] = useState(
    () =>
      preset
        .map((group) => group.bisDatum)
        .filter(Boolean)
        .sort()
        .at(-1) ?? '',
  );
  const [chosen, setChosen] = useState(() => new Set(detIds));
  const [error, setError] = useState('');
  const nameId = useId(),
    vonId = useId(),
    bisId = useId();
  const save = () => {
    let id = '';
    try {
      changeProject((draft) => {
        id = createEvent(draft, { name, von, bis, detIds: [...chosen] }).id;
      });
      notify('Event erstellt. Jetzt Detachemente bilden.', { tone: 'success' });
      onCreated(id);
    } catch (caught) {
      setError(errorText(caught));
    }
  };
  return (
    <Modal
      title="Neues Event"
      description="Z. B. «KVK» oder «WK Woche 1». Die PISA-Detachemente filtern, wer zur Auswahl steht; ohne Auswahl stehen alle zur Verfügung."
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Abbrechen
          </button>
          <button type="button" className="btn btn-primary" disabled={!name.trim()} onClick={save}>
            Event erstellen
          </button>
        </>
      }
    >
      <div className="stack">
        <ErrorBox message={error} />
        <div className="field">
          <label htmlFor={nameId}>Name</label>
          <input
            id={nameId}
            value={name}
            placeholder="z. B. KVK"
            onChange={(change) => setName(change.target.value)}
          />
        </div>
        <div className="form-grid">
          <div className="field">
            <label htmlFor={vonId}>Von</label>
            <input
              id={vonId}
              type="date"
              value={von}
              onChange={(change) => setVon(change.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor={bisId}>Bis</label>
            <input
              id={bisId}
              type="date"
              value={bis}
              onChange={(change) => setBis(change.target.value)}
            />
          </div>
        </div>
        <fieldset className="combine-list" aria-label="PISA-Detachemente">
          {project.dets.map((group) => (
            <label key={group.id} className="check combine-option">
              <input
                type="checkbox"
                aria-label={group.ec ? `${group.name} (EC ${group.ec})` : group.name}
                checked={chosen.has(group.id)}
                onChange={(change) =>
                  setChosen((old) => {
                    const next = new Set(old);
                    if (change.target.checked) next.add(group.id);
                    else next.delete(group.id);
                    return next;
                  })
                }
              />
              <span className={`ec ${group.ec ? '' : 'is-missing'}`}>{group.ec || '—'}</span>
              <span className="grow">{group.name}</span>
              <span className="muted">{groupPeople(project, group.id).length} Pers.</span>
            </label>
          ))}
        </fieldset>
        <p className="muted small-note">
          {chosen.size
            ? `${chosen.size} PISA-Detachement${chosen.size === 1 ? '' : 'e'} als Filter.`
            : 'Ohne Auswahl stehen alle Personen der Dienstleistung zur Auswahl.'}
        </p>
      </div>
    </Modal>
  );
}

/** «Det Mat» → «Mat» for the compact per-person buttons. */
function shortLabel(name: string): string {
  return name.replace(/^det(achement)?\.?\s+/i, '') || name;
}

function SplitView({
  project,
  eventId,
  onOutput,
}: {
  project: Project;
  eventId: string;
  onOutput: () => void;
}) {
  const archived = Boolean(project.archive);
  const view = useMemo(() => onsiteView(project, eventId), [project, eventId]);
  const suggestions = subDetSuggestions(project, eventId);
  // The PISA card is shown per person as soon as people come from more than one.
  const showOrigin = new Set([...view.origin.values()].map((group) => group.id)).size > 1;
  const [error, setError] = useState('');
  const [names, setNames] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
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
    const before = subDetsOf(project, eventId).length;
    if (mutate((draft) => addSubDets(draft, eventId, values))) {
      setNames('');
      const created = values.length > 1 ? `${values.length} Untergruppen` : `«${values[0]}»`;
      if (!before) notify(`${created} erstellt. Jetzt Personen einteilen.`, { tone: 'success' });
    }
  };
  const move = (subId: string | null, ids: string[]) =>
    mutate((draft) => moveToSubDet(draft, eventId, subId, ids));
  const words = searchText(search).split(' ').filter(Boolean);
  const visible = view.pool.filter((person) => {
    const place = view.placement.get(person.id) ?? '';
    if (filter === 'open' ? place : filter !== 'all' && place !== filter) return false;
    const haystack = searchText(
      [
        person.grad,
        person.name,
        person.funktion,
        shortFunction(project, person.funktion),
        ...person.lics,
        ...licenseCategories(project, person),
        person.zug,
        view.origin.get(person.id)?.name,
      ].join(' '),
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
            <Icon name="layout" size={17} /> Detachemente vor Ort
          </h2>
          <span className="muted">
            {view.groups.length
              ? `${view.unassigned.length} von ${view.pool.length} noch nicht eingeteilt`
              : `${view.pool.length} Personen im Event`}
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
              Noch keine Detachemente. Vorschlag anklicken oder Namen eingeben – mehrere mit Komma
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
                      {[
                        showOrigin ? view.origin.get(person.id)?.name : '',
                        shortFunction(project, person.funktion),
                        ...licenseCategories(project, person),
                      ]
                        .filter(Boolean)
                        .join(' · ') || 'Keine weiteren Angaben'}
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
            Im Filter sind keine Personen. Oben PISA-Detachemente wählen oder{' '}
            <Link to="/">in der Planung zuteilen →</Link>
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
          <optgroup label="Übrige im Event">
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
  eventId,
  options,
  onOptions,
}: {
  project: Project;
  eventId: string;
  options: DetSheetOptions;
  onOptions: (options: DetSheetOptions) => void;
}) {
  const view = onsiteView(project, eventId);
  const multiOrigin = new Set([...view.origin.values()].map((group) => group.id)).size > 1;
  // Without detachements everyone is still open, so the whole event is listed.
  const placed = view.groups.length ? view.pool.length - view.unassigned.length : view.pool.length;
  // A scope from another detachement or a removed sub-group falls back to the whole list.
  const effective =
    options.scope === 'all' || view.groups.some((item) => item.sub.id === options.scope)
      ? options
      : { ...options, scope: 'all' };
  const sheet = buildDetSheet(project, eventId, effective);
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
                <option value="all">
                  Ganzes Event ({options.unassigned ? view.pool.length : placed})
                </option>
                {view.groups.map((item) => (
                  <option key={item.sub.id} value={item.sub.id}>
                    {item.sub.name} ({item.people.length})
                  </option>
                ))}
              </select>
            </label>
            <label className="check onsite-unassigned">
              <input
                type="checkbox"
                checked={options.unassigned}
                disabled={scoped || !view.groups.length}
                onChange={(event) => onOptions({ ...options, unassigned: event.target.checked })}
              />
              Nicht eingeteilte zeigen ({view.unassigned.length})
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
            {DET_SHEET_COLUMNS.filter((column) => column.key !== 'herkunft' || multiOrigin).map(
              (column) => (
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
              ),
            )}
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
      <div className="det-sheet-scroll">
        <DetSheetView sheet={sheet} />
      </div>
    </>
  );
}
