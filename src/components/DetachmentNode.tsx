import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import { displayDate } from '../io/text';
import type { BoardIssue } from '../model/board';
import type { Detachment } from '../model/types';
import { Icon } from './Icon';
import { Menu, MenuItem, MenuLabel, MenuSeparator } from './Menu';

export const PEOPLE_DRAG_TYPE = 'application/x-detplaner-people';

export type DetachmentNodeData = {
  group: Detachment;
  direct: number;
  inherited: number;
  preview: string[];
  issues: BoardIssue[];
  policyOpen: boolean;
  globalOpen: boolean;
  archived: boolean;
  newCard: boolean;
  connecting: boolean;
  source: boolean;
  connected: boolean;
  error: string;
  onEdit: (field: 'name' | 'ec', value: string) => void;
  onPeople: () => void;
  onDetails: () => void;
  onIssues: () => void;
  onConnect: () => void;
  onTarget: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onDisconnect: () => void;
  onDropPeople: (ids: string[]) => void;
  onMove: (dx: number, dy: number) => void;
};
export type PlanningNode = Node<DetachmentNodeData, 'detachment'>;

function period(group: Detachment): string {
  const start = group.datum ? displayDate(group.datum).slice(0, 6) : '';
  const end = group.bisDatum ? displayDate(group.bisDatum) : '';
  if (!start && !end) return '';
  return `${start || '…'} – ${end || '…'}${group.von ? ` · ${group.von}` : ''}`;
}

export const DetachmentNode = memo(function DetachmentNode({
  data,
  selected,
  width,
}: NodeProps<PlanningNode>) {
  const [dropping, setDropping] = useState(false);
  const conflicts = data.issues.filter((issue) => issue.severity === 'conflict');
  const incomplete = data.issues.filter((issue) => issue.severity === 'incomplete');
  const state =
    conflicts.length || data.error
      ? 'conflict'
      : incomplete.length || data.policyOpen
        ? 'incomplete'
        : 'ready';
  const when = period(data.group);
  const total = data.direct + data.inherited;
  const name = data.group.name;
  return (
    <motion.article
      className={`det-card is-${state} ${selected ? 'is-selected' : ''} ${data.source ? 'is-source' : ''} ${dropping ? 'is-dropping' : ''}`}
      aria-label={`Detachement ${name}`}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.16 }}
      onDragOver={(event) => {
        if (data.archived || !event.dataTransfer.types.includes(PEOPLE_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        setDropping(true);
      }}
      onDragLeave={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as HTMLElement | null))
          setDropping(false);
      }}
      onDrop={(event) => {
        setDropping(false);
        const raw = event.dataTransfer.getData(PEOPLE_DRAG_TYPE);
        if (!raw || data.archived) return;
        event.preventDefault();
        try {
          const ids: unknown = JSON.parse(raw);
          if (Array.isArray(ids)) data.onDropPeople(ids.filter((id) => typeof id === 'string'));
        } catch {
          /* Ignore foreign drag payloads. */
        }
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        aria-label={`Verbindung zu ${name}`}
        isConnectable={!data.archived}
      />
      <header
        className="det-head card-grip"
        title="Ziehen zum Verschieben · Karte fokussieren und Pfeiltasten verwenden"
      >
        <span className="det-grip" aria-hidden="true">
          <Icon name="grip" size={14} />
        </span>
        <div className="det-identity nodrag nopan">
          <InlineValue
            label="EC"
            value={data.group.ec}
            disabled={data.archived}
            onSave={(value) => data.onEdit('ec', value)}
          />
          <InlineValue
            label="Name"
            value={name}
            disabled={data.archived}
            focus={data.newCard && Boolean(width)}
            onSave={(value) => data.onEdit('name', value)}
          />
        </div>
        <Menu label={`Aktionen für ${name}`} trigger={<Icon name="more" size={17} />}>
          <MenuItem icon="users" onSelect={data.onPeople} disabled={data.archived}>
            Personen auswählen
          </MenuItem>
          <MenuItem icon="calendar" onSelect={data.onDetails} disabled={data.archived}>
            Angaben bearbeiten
          </MenuItem>
          <MenuItem icon="duplicate" onSelect={data.onDuplicate} disabled={data.archived}>
            Duplizieren
          </MenuItem>
          {data.connected && (
            <MenuItem icon="unlink" onSelect={data.onDisconnect} disabled={data.archived}>
              Verbindung lösen
            </MenuItem>
          )}
          <MenuSeparator />
          <MenuLabel>Position ändern</MenuLabel>
          <fieldset className="det-move" aria-label="Position ändern">
            {(
              [
                [-40, 0, '←'],
                [0, -40, '↑'],
                [0, 40, '↓'],
                [40, 0, '→'],
              ] as const
            ).map(([x, y, arrow]) => (
              <button
                type="button"
                role="menuitem"
                key={arrow}
                className="menu-item"
                disabled={data.archived}
                aria-label={`Karte ${arrow} verschieben`}
                onClick={() => data.onMove(x, y)}
              >
                {arrow}
              </button>
            ))}
          </fieldset>
          <MenuSeparator />
          <MenuItem icon="trash" danger onSelect={data.onDelete} disabled={data.archived}>
            Detachement entfernen …
          </MenuItem>
        </Menu>
      </header>

      <div className="det-body nodrag nopan">
        <button
          type="button"
          className="det-people"
          disabled={data.archived}
          onClick={data.onPeople}
        >
          <span className="det-count">
            <strong>{data.direct}</strong>
            <span>
              direkt zugeteilt
              {data.inherited > 0 && <small>+ {data.inherited} anschliessend dabei</small>}
            </span>
            <span className="det-people-cta">
              Personen auswählen <Icon name="chevronRight" size={13} />
            </span>
          </span>
          {data.preview.length > 0 ? (
            <span className="det-names">
              {data.preview.map((person) => (
                <span className="det-name" key={person}>
                  {person}
                </span>
              ))}
              {data.direct > data.preview.length && (
                <span className="det-name is-more">+{data.direct - data.preview.length}</span>
              )}
            </span>
          ) : (
            <span className="det-empty">
              {total
                ? 'Personen folgen über die Verbindung'
                : 'Personen hierher ziehen oder auswählen'}
            </span>
          )}
        </button>

        <button
          type="button"
          className={`det-meta ${when || data.group.ort ? '' : 'is-empty'}`}
          onClick={data.onDetails}
          disabled={data.archived}
          title="Einrücken und Entlassung bearbeiten"
        >
          <Icon name="calendar" size={14} />
          <span className="truncate">{when || 'Einrücken & Entlassung offen'}</span>
          {data.group.ort && (
            <>
              <Icon name="pin" size={14} />
              <span className="truncate">{data.group.ort}</span>
            </>
          )}
        </button>

        <button type="button" className={`det-health is-${state}`} onClick={data.onIssues}>
          <span className="det-health-icon" aria-hidden="true">
            <Icon
              name={state === 'conflict' ? 'alert' : state === 'ready' ? 'check' : 'circle'}
              size={14}
            />
          </span>
          <span className="grow">
            {conflicts.length
              ? `${conflicts.length} Konflikt${conflicts.length === 1 ? '' : 'e'}`
              : data.error
                ? 'Verbindung nicht möglich'
                : incomplete.length
                  ? 'Angaben ergänzen'
                  : data.policyOpen
                    ? 'Aufgebotsart noch offen'
                    : data.globalOpen
                      ? 'Karte vollständig'
                      : 'Für PISA bereit'}
            <small>
              {conflicts[0]?.message ||
                (incomplete.length
                  ? total === 0
                    ? 'Angaben später ergänzen'
                    : `${incomplete.length} offene Punkte · weiterplanen möglich`
                  : 'Prüfung und Hinweise')}
            </small>
          </span>
          <Icon name="chevronRight" size={14} />
        </button>
        {data.error && (
          <p className="det-error" role="alert">
            {data.error}
          </p>
        )}
      </div>

      <footer className="det-actions nodrag nopan">
        <button
          type="button"
          className="det-action"
          onClick={data.onDetails}
          disabled={data.archived}
        >
          <Icon name="edit" size={14} /> Angaben
        </button>
        <button
          type="button"
          className={`det-action ${data.source ? 'is-active' : ''}`}
          onClick={data.onConnect}
          disabled={data.archived}
        >
          <Icon name={data.source ? 'x' : 'link'} size={14} />
          {data.source ? 'Abbrechen' : 'Verbinden'}
        </button>
      </footer>

      {data.connecting && !data.source && (
        <button type="button" className="det-target nodrag nopan" onClick={data.onTarget}>
          <Icon name="arrowRight" size={16} /> Hier anschliessend Dienst leisten
        </button>
      )}
      <Handle
        type="source"
        position={Position.Right}
        aria-label={`Danach von ${name}`}
        isConnectable={!data.archived}
      />
    </motion.article>
  );
}, sameCardContent);

// React Flow moves the outer wrapper. Position/dragging changes do not change
// the card's form, counters or validation and must not repaint that subtree.
function sameCardContent(previous: NodeProps<PlanningNode>, next: NodeProps<PlanningNode>) {
  return (
    previous.data === next.data &&
    previous.selected === next.selected &&
    previous.width === next.width
  );
}

function InlineValue({
  label,
  value,
  disabled,
  focus,
  onSave,
}: {
  label: 'Name' | 'EC';
  value: string;
  disabled: boolean;
  focus?: boolean;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);
  useEffect(() => {
    setDraft(value);
    setInvalid(false);
  }, [value]);
  useEffect(() => {
    if (focus) {
      input.current?.focus();
      input.current?.select();
    }
  }, [focus]);
  const commit = () => {
    if (cancelled.current) {
      cancelled.current = false;
      return;
    }
    const next = label === 'EC' ? draft.trim().toUpperCase() : draft.trim();
    if (label === 'Name' && !next) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    setDraft(next);
    if (next !== value) onSave(next);
  };
  return (
    <label
      className={label === 'EC' ? 'inline-ec' : 'inline-name'}
      title={label === 'EC' ? 'Einrückungscode (2 Zeichen)' : undefined}
    >
      <span className="visually-hidden">{label}</span>
      <input
        ref={input}
        value={draft}
        disabled={disabled}
        aria-invalid={invalid}
        maxLength={label === 'EC' ? 2 : 120}
        placeholder={label === 'EC' ? 'EC' : 'Name eingeben'}
        spellCheck={false}
        onChange={(event) =>
          setDraft(label === 'EC' ? event.target.value.toUpperCase() : event.target.value)
        }
        onBlur={commit}
        onKeyDown={(event) => {
          event.stopPropagation();
          if (event.key === 'Enter') {
            event.preventDefault();
            input.current?.blur();
          }
          if (event.key === 'Escape') {
            event.preventDefault();
            cancelled.current = true;
            setDraft(value);
            setInvalid(false);
            input.current?.blur();
          }
        }}
      />
      {invalid && (
        <small className="inline-error" role="alert">
          Bitte einen Namen eingeben.
        </small>
      )}
    </label>
  );
}
