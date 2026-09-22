import { Handle, type Node, type NodeProps, Position } from '@xyflow/react';
import { motion } from 'motion/react';
import { memo, useEffect, useRef, useState } from 'react';
import type { BoardIssue } from '../model/board';
import type { Detachment } from '../model/types';

export type DetachmentNodeData = {
  group: Detachment;
  direct: number;
  inherited: number;
  issues: BoardIssue[];
  policyOpen: boolean;
  globalOpen: boolean;
  archived: boolean;
  newCard: boolean;
  connecting: boolean;
  source: boolean;
  error: string;
  onEdit: (field: 'name' | 'ec', value: string) => void;
  onPeople: () => void;
  onDetails: () => void;
  onIssues: () => void;
  onConnect: () => void;
  onTarget: () => void;
  onDelete: () => void;
  onMove: (dx: number, dy: number) => void;
};
export type PlanningNode = Node<DetachmentNodeData, 'detachment'>;

export const DetachmentNode = memo(function DetachmentNode({
  data,
  selected,
  width,
}: NodeProps<PlanningNode>) {
  const conflicts = data.issues.filter((issue) => issue.severity === 'conflict');
  const incomplete = data.issues.filter((issue) => issue.severity === 'incomplete');
  const state =
    conflicts.length || data.error
      ? 'conflict'
      : incomplete.length || data.policyOpen
        ? 'incomplete'
        : 'ready';
  return (
    <motion.article
      className={`canvas-card ${selected ? 'is-selected' : ''} ${data.source ? 'is-source' : ''}`}
      aria-label={`Detachement ${data.group.name}`}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
    >
      <Handle
        type="target"
        position={Position.Left}
        aria-label={`Verbindung zu ${data.group.name}`}
        isConnectable={!data.archived}
      />
      <div
        className="card-grip"
        title="Hier ziehen oder Karte fokussieren und Pfeiltasten verwenden"
      >
        <span aria-hidden="true">⠿</span>
        <span>DETACHEMENT</span>
        <span className="drag-hint">verschieben</span>
        <button
          type="button"
          className="card-remove nodrag nopan"
          aria-label={`${data.group.name} entfernen`}
          title="Detachement entfernen"
          disabled={data.archived}
          onClick={data.onDelete}
        >
          ×
        </button>
      </div>
      <div className="canvas-card-body nodrag nopan">
        <div className="card-identity">
          <InlineValue
            label="Name"
            value={data.group.name}
            disabled={data.archived}
            focus={data.newCard && Boolean(width)}
            onSave={(value) => data.onEdit('name', value)}
          />
          <InlineValue
            label="EC"
            value={data.group.ec}
            disabled={data.archived}
            onSave={(value) => data.onEdit('ec', value)}
          />
        </div>
        <div className="canvas-count">
          <strong>{data.direct}</strong>
          <span>
            direkt zugeteilt
            {data.inherited > 0 && <small>+ {data.inherited} anschliessend dabei</small>}
          </span>
        </div>
        <button
          type="button"
          className="canvas-people"
          disabled={data.archived}
          onClick={data.onPeople}
        >
          Personen auswählen <span aria-hidden="true">↗</span>
        </button>
        <button type="button" className={`card-health ${state}`} onClick={data.onIssues}>
          <span aria-hidden="true">
            {state === 'conflict' ? '!' : state === 'ready' ? '✓' : '○'}
          </span>
          <span>
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
                  ? data.direct + data.inherited === 0
                    ? 'Angaben später ergänzen'
                    : `${incomplete.length} offene Punkte · weiterplanen möglich`
                  : 'Prüfung und Hinweise')}
            </small>
          </span>
          <span aria-hidden="true">›</span>
        </button>
        {data.error && (
          <p className="card-inline-error" role="alert">
            {data.error}
          </p>
        )}
        <div className="card-quick-actions">
          <button type="button" onClick={data.onDetails} disabled={data.archived}>
            Details
          </button>
          <button type="button" onClick={data.onConnect} disabled={data.archived}>
            {data.source ? 'Abbrechen' : 'Verbinden →'}
          </button>
        </div>
        {data.connecting && !data.source && (
          <button type="button" className="connection-target" onClick={data.onTarget}>
            Hier anschliessend Dienst leisten
          </button>
        )}
        <details className="card-position">
          <summary>Position ändern</summary>
          <div>
            {(
              [
                [0, -40, '↑'],
                [-40, 0, '←'],
                [40, 0, '→'],
                [0, 40, '↓'],
              ] as const
            ).map(([x, y, label]) => (
              <button
                type="button"
                key={label}
                disabled={data.archived}
                aria-label={`Karte ${label} verschieben`}
                onClick={() => data.onMove(x, y)}
              >
                {label}
              </button>
            ))}
          </div>
        </details>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        aria-label={`Danach von ${data.group.name}`}
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
  label: string;
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
    <label className={label === 'EC' ? 'inline-ec' : 'inline-name'}>
      <span>{label}</span>
      <input
        ref={input}
        value={draft}
        disabled={disabled}
        aria-invalid={invalid}
        maxLength={label === 'EC' ? 2 : 120}
        placeholder={label === 'EC' ? '—' : 'Name eingeben'}
        onChange={(event) => setDraft(event.target.value)}
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
      {invalid && <small role="alert">Bitte einen Namen eingeben.</small>}
    </label>
  );
}
