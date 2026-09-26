import { useMemo, useRef, useState } from 'react';
import { searchText } from '../io/text';
import { remainingPeople } from '../model';
import type { Project } from '../model/types';
import { PEOPLE_DRAG_TYPE } from './DetachmentNode';
import { Icon } from './Icon';

/**
 * Everyone who still needs a direct detachement. Drag rows onto a card or mark several
 * and assign them in one step. Excluded people are not offered.
 */
export function PeopleTray({
  project,
  archived,
  onAssign,
  onOpenPerson,
  onClose,
}: {
  project: Project;
  archived: boolean;
  onAssign: (groupId: string, ids: string[]) => boolean;
  onOpenPerson: (id: string) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const [marked, setMarked] = useState<Set<string>>(() => new Set());
  const [target, setTarget] = useState('');
  const [onlyReview, setOnlyReview] = useState(false);
  const anchor = useRef<string | null>(null);
  const free = useMemo(() => remainingPeople(project), [project]);
  const review = free.filter((person) => person.planning.status === 'unreviewed').length;
  const visible = useMemo(() => {
    const words = searchText(query).split(' ').filter(Boolean);
    return free.filter((person) => {
      if (onlyReview && person.planning.status !== 'unreviewed') return false;
      const text = searchText(
        [person.name, person.grad, person.funktion, person.pnr, person.zug, ...person.lics].join(
          ' ',
        ),
      );
      return words.every((word) => text.includes(word));
    });
  }, [free, query, onlyReview]);
  // Marks only refer to people who are still free.
  const live = new Set([...marked].filter((id) => free.some((person) => person.id === id)));
  const toggle = (id: string, range: boolean) => {
    setMarked((old) => {
      const next = new Set([...old].filter((item) => free.some((person) => person.id === item)));
      if (range && anchor.current) {
        const ids = visible.map((person) => person.id);
        const [a, b] = [ids.indexOf(anchor.current), ids.indexOf(id)].sort((x, y) => x - y);
        if (a >= 0) {
          for (const item of ids.slice(a, b + 1)) next.add(item);
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchor.current = id;
      return next;
    });
  };
  const allVisibleMarked = visible.length > 0 && visible.every((person) => live.has(person.id));
  return (
    <aside className="tray" aria-label="Noch nicht zugeteilte Personen">
      <header className="tray-head">
        <div className="grow">
          <h2>
            Noch frei <span className="badge">{free.length}</span>
          </h2>
          <p>Auf eine Karte ziehen oder markieren und zuteilen.</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon btn-sm"
          aria-label="Liste schliessen"
          title="Liste schliessen (T)"
          onClick={onClose}
        >
          <Icon name="chevronLeft" />
        </button>
      </header>
      <div className="tray-tools">
        <label className="search-field">
          <Icon name="search" size={15} />
          <input
            type="search"
            aria-label="Freie Personen suchen"
            placeholder="Name, Funktion, Ausweis …"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <div className="chip-row">
          <button
            type="button"
            className="chip"
            aria-pressed={!onlyReview}
            onClick={() => setOnlyReview(false)}
          >
            Alle <span className="count">{free.length}</span>
          </button>
          <button
            type="button"
            className="chip"
            aria-pressed={onlyReview}
            disabled={!review && !onlyReview}
            onClick={() => setOnlyReview(true)}
          >
            Teilnahme klären <span className="count">{review}</span>
          </button>
        </div>
      </div>
      {free.length === 0 ? (
        <div className="empty tray-empty">
          <span className="empty-icon">
            <Icon name="checkCircle" />
          </span>
          <h3>Alle verteilt</h3>
          <p>Jede eingeplante Person hat ein direktes Detachement.</p>
        </div>
      ) : (
        <>
          <div className="tray-select">
            <label className="check">
              <input
                type="checkbox"
                checked={allVisibleMarked}
                disabled={archived || !visible.length}
                onChange={(event) =>
                  setMarked((old) => {
                    const next = new Set(old);
                    for (const person of visible)
                      if (event.target.checked) next.add(person.id);
                      else next.delete(person.id);
                    return next;
                  })
                }
              />
              {visible.length === free.length
                ? 'Alle markieren'
                : `${visible.length} Treffer markieren`}
            </label>
          </div>
          <ul className="tray-list">
            {visible.map((person) => {
              const isMarked = live.has(person.id);
              return (
                <li
                  key={person.id}
                  className={`tray-person ${isMarked ? 'is-marked' : ''}`}
                  draggable={!archived}
                  onDragStart={(event) => {
                    const ids = isMarked ? [...live] : [person.id];
                    event.dataTransfer.setData(PEOPLE_DRAG_TYPE, JSON.stringify(ids));
                    event.dataTransfer.effectAllowed = 'move';
                    const ghost = document.createElement('div');
                    ghost.className = 'drag-ghost';
                    ghost.textContent = ids.length > 1 ? `${ids.length} Personen` : person.name;
                    document.body.append(ghost);
                    event.dataTransfer.setDragImage(ghost, 12, 12);
                    window.setTimeout(() => ghost.remove(), 0);
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label={`${person.name} markieren`}
                    checked={isMarked}
                    disabled={archived}
                    onChange={() => {}}
                    onClick={(event) => toggle(person.id, event.shiftKey)}
                  />
                  <button
                    type="button"
                    className="tray-person-main"
                    onClick={() => onOpenPerson(person.id)}
                    title="Person öffnen"
                  >
                    <span className="truncate">
                      {person.grad && <span className="muted">{person.grad} </span>}
                      <strong>{person.name}</strong>
                    </span>
                    <small className="truncate">
                      {[person.funktion, ...person.lics].filter(Boolean).join(' · ') || '—'}
                    </small>
                  </button>
                  {person.planning.status === 'unreviewed' && (
                    <span className="badge badge-warning" title="Teilnahme noch klären">
                      klären
                    </span>
                  )}
                  <span className="tray-drag" aria-hidden="true">
                    <Icon name="grip" size={14} />
                  </span>
                </li>
              );
            })}
            {!visible.length && <li className="tray-none">Keine Treffer.</li>}
          </ul>
          {live.size > 0 && (
            <footer className="tray-foot">
              <strong>{live.size} markiert</strong>
              <div className="row">
                <select
                  aria-label="Detachement für markierte Personen"
                  value={target}
                  onChange={(event) => setTarget(event.target.value)}
                >
                  <option value="">Zuteilen an …</option>
                  {project.dets.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.ec ? `${group.ec} · ` : ''}
                      {group.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!target || archived}
                  onClick={() => {
                    if (onAssign(target, [...live])) setMarked(new Set());
                  }}
                >
                  Zuteilen
                </button>
              </div>
            </footer>
          )}
        </>
      )}
    </aside>
  );
}
