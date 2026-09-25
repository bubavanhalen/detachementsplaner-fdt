import { Link } from '@tanstack/react-router';
import {
  type Connection,
  type Edge,
  MarkerType,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import { MotionConfig } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DetachmentDialog } from '../components/DetachmentDialog';
import type { PlanningNode } from '../components/DetachmentNode';
import { Icon } from '../components/Icon';
import { errorText, Modal } from '../components/Modal';
import { PeoplePicker } from '../components/PeoplePicker';
import { PeopleTray } from '../components/PeopleTray';
import { PlanningCanvas } from '../components/PlanningCanvas';
import { PlanningPanel } from '../components/PlanningPanel';
import {
  assignPeople,
  connectGroups,
  createDetachment,
  disconnectGroups,
  groupPeople,
  remainingPeople,
  removePeople,
} from '../model';
import {
  type BoardIssue,
  type BoardPosition,
  boardIssues,
  getBoardPositions,
  saveBoardPositions,
} from '../model/board';
import type { Project } from '../model/types';
import { changeProject, notifyUndoable, useProject } from '../store';
import { isTyping, overlayStore, setPreference, useOverlays, usePreferences } from '../ui';
import { PersonEditor } from './PersonEditor';
import '@xyflow/react/dist/style.css';
import './planning-board.css';

type Panel =
  | { kind: 'people' | 'details' | 'issues'; id: string }
  | { kind: 'person'; id: string }
  | null;
const CARD = { width: 300, height: 330 };

export default function PlanningPage() {
  return (
    <MotionConfig reducedMotion="user">
      <ReactFlowProvider>
        <PlanningBoard />
      </ReactFlowProvider>
    </MotionConfig>
  );
}

function shortName(person: Project['persons'][number]): string {
  return [person.grad, person.nachname || person.name.split(' ').at(-1) || person.name]
    .filter(Boolean)
    .join(' ');
}

function PlanningBoard() {
  const project = useProject();
  const preferences = usePreferences();
  const overlays = useOverlays();
  const flow = useReactFlow<PlanningNode>();
  const canvas = useRef<HTMLDivElement>(null);
  const archived = Boolean(project.archive);
  const positions = useMemo(() => getBoardPositions(project), [project]);
  const [selection, setSelection] = useState<string[]>([]);
  const [panel, setPanel] = useState<Panel>(null);
  const [pendingRemoval, setPendingRemoval] = useState<{ projectId: string; id: string } | null>(
    null,
  );
  const removalGroup =
    pendingRemoval?.projectId === project.id
      ? project.dets.find((group) => group.id === pendingRemoval.id)
      : undefined;
  const [connectFrom, setConnectFrom] = useState<string | null>(null);
  const [focusName, setFocusName] = useState('');
  const [error, setError] = useState({ id: '', message: '' });
  const issues = useMemo(() => boardIssues(project), [project]);
  const free = useMemo(() => remainingPeople(project), [project]);
  const conflictGroups = project.dets.filter((group) =>
    (issues.byGroup[group.id] ?? []).some((issue) => issue.severity === 'conflict'),
  );
  const conflicts = new Set(
    [...Object.values(issues.byGroup).flat(), ...issues.global]
      .filter((issue) => issue.severity === 'conflict')
      .map((issue) => `${issue.code}:${issue.personId ?? ''}:${issue.groupId ?? ''}`),
  ).size;
  const policyOpen = issues.global.some((issue) => issue.code === 'policy-unconfirmed');
  const trayOpen = preferences.tray && project.persons.length > 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset transient UI only when a different project is opened.
  useEffect(() => {
    setPanel(null);
    setPendingRemoval(null);
    setConnectFrom(null);
    setSelection([]);
    setError({ id: '', message: '' });
  }, [project.id]);
  const mutate = useCallback((callback: (draft: Project) => void, id = '') => {
    try {
      changeProject((draft) => {
        // Freeze the initial arrangement before any semantic change can affect defaults.
        if (!draft.board) saveBoardPositions(draft, getBoardPositions(draft));
        callback(draft);
      });
      setError((current) => (current.message ? { id: '', message: '' } : current));
      return true;
    } catch (caught) {
      setError({ id, message: errorText(caught) });
      return false;
    }
  }, []);
  const connect = useCallback(
    ({ source, target }: Connection) => {
      if (mutate((draft) => connectGroups(draft, source, target), source)) setConnectFrom(null);
    },
    [mutate],
  );
  const openPanel = useCallback((next: Panel) => {
    setPanel(next);
    setError((current) => (current.message ? { id: '', message: '' } : current));
    setFocusName('');
  }, []);
  const remove = useCallback(
    (id: string) => {
      const name = project.dets.find((group) => group.id === id)?.name ?? 'Detachement';
      if (
        mutate((draft) => {
          draft.dets = draft.dets.filter((group) => group.id !== id);
          delete draft.assign[id];
          draft.connections = draft.connections.filter(
            (link) => link.from !== id && link.to !== id,
          );
          for (const group of draft.dets)
            group.zusatzIds = group.zusatzIds.filter((extra) => extra !== id);
          if (draft.board) delete draft.board.positions[id];
        }, id)
      ) {
        setPanel(null);
        setConnectFrom(null);
        setPendingRemoval(null);
        notifyUndoable(`«${name}» entfernt. Die Personen bleiben erhalten.`);
      }
    },
    [mutate, project.dets],
  );
  const freeSpot = useCallback(
    (start: BoardPosition) => {
      const position = { ...start };
      while (
        Object.values(positions).some(
          (point) =>
            Math.abs(point.x - position.x) < CARD.width + 20 &&
            Math.abs(point.y - position.y) < CARD.height + 20,
        )
      )
        position.x += CARD.width + 60;
      return position;
    },
    [positions],
  );
  const add = useCallback(
    (at?: BoardPosition, template?: Project['dets'][number]) => {
      let patch: Partial<Project['dets'][number]> = { name: 'Neues Detachement' };
      if (template) {
        // A copy shares the service details only: new identity, no EC, no people or links.
        const { id: _id, generatedFrom: _generated, ...details } = template;
        patch = { ...details, name: `${template.name} (Kopie)`, ec: '', zusatzIds: [] };
      }
      const group = createDetachment(patch);
      const bounds = canvas.current?.getBoundingClientRect();
      const center =
        at ??
        flow.screenToFlowPosition({
          x: bounds ? bounds.left + bounds.width / 2 : 500,
          y: bounds ? bounds.top + bounds.height / 2 : 300,
        });
      const position = at
        ? { x: at.x - CARD.width / 2, y: at.y - 40 }
        : freeSpot({ x: center.x - CARD.width / 2, y: center.y - CARD.height / 2 });
      if (
        mutate((draft) => {
          draft.dets.push(group);
          draft.assign[group.id] = [];
          saveBoardPositions(draft, { ...getBoardPositions(draft), [group.id]: position });
        })
      ) {
        setFocusName(group.id);
        setSelection([group.id]);
        setPanel(null);
        if (template) notifyUndoable(`«${template.name}» dupliziert.`);
        requestAnimationFrame(() => {
          const height = canvas.current?.clientHeight || 500;
          const width = canvas.current?.clientWidth || 700;
          const zoom = Math.max(
            0.5,
            Math.min(1, (height - 50) / (CARD.height + 60), (width - 35) / CARD.width),
          );
          if (!at)
            void flow.setViewport({
              x: width / 2 - (position.x + CARD.width / 2) * zoom,
              y: height / 2 - (position.y + CARD.height / 2) * zoom,
              zoom,
            });
        });
      }
    },
    [flow, freeSpot, mutate],
  );
  const assign = useCallback(
    (groupId: string, ids: string[]) => {
      const name = project.dets.find((group) => group.id === groupId)?.name ?? 'Detachement';
      const done = mutate((draft) => assignPeople(draft, groupId, ids), groupId);
      if (done && ids.length)
        notifyUndoable(
          `${ids.length === 1 ? '1 Person' : `${ids.length} Personen`} → «${name}» zugeteilt.`,
        );
      return done;
    },
    [mutate, project.dets],
  );
  const baseNodes = useMemo<PlanningNode[]>(
    () =>
      project.dets.map((group) => {
        const direct = project.assign[group.id] ?? [];
        const people = project.persons.filter((person) => direct.includes(person.id));
        return {
          id: group.id,
          type: 'detachment',
          position: { x: 0, y: 0 },
          dragHandle: '.card-grip',
          draggable: !archived,
          connectable: !archived,
          ariaLabel: `Detachement ${group.name}`,
          data: {
            group,
            direct: direct.length,
            inherited: groupPeople(project, group.id).filter(
              (person) => !direct.includes(person.id),
            ).length,
            preview: people.slice(0, direct.length > 5 ? 4 : 5).map(shortName),
            issues: issues.byGroup[group.id] ?? [],
            policyOpen,
            globalOpen: issues.global.length > 0,
            archived,
            newCard: focusName === group.id,
            connecting: Boolean(connectFrom),
            source: connectFrom === group.id,
            connected: project.connections.some(
              (link) => link.from === group.id || link.to === group.id,
            ),
            error: error.id === group.id ? error.message : '',
            onEdit: (field, value) => {
              mutate((draft) => {
                const current = draft.dets.find((item) => item.id === group.id);
                if (current) current[field] = value;
              }, group.id);
              setFocusName('');
            },
            onPeople: () => openPanel({ kind: 'people', id: group.id }),
            onDetails: () => openPanel({ kind: 'details', id: group.id }),
            onIssues: () => openPanel({ kind: 'issues', id: group.id }),
            onConnect: () => {
              setError({ id: '', message: '' });
              setConnectFrom((current) => (current === group.id ? null : group.id));
            },
            onTarget: () => {
              if (connectFrom)
                connect({
                  source: connectFrom,
                  target: group.id,
                  sourceHandle: null,
                  targetHandle: null,
                });
            },
            onDelete: () => setPendingRemoval({ projectId: project.id, id: group.id }),
            onDuplicate: () => {
              const at = positions[group.id];
              add(at ? { x: at.x + CARD.width / 2 + 40, y: at.y + 80 } : undefined, group);
            },
            onDisconnect: () =>
              mutate((draft) => {
                draft.connections = draft.connections.filter(
                  (link) => link.from !== group.id && link.to !== group.id,
                );
              }, group.id) && notifyUndoable('Verbindung gelöst.'),
            onDropPeople: (ids) => assign(group.id, ids),
            onMove: (dx, dy) =>
              mutate((draft) => {
                const next = getBoardPositions(draft);
                next[group.id] = { x: next[group.id].x + dx, y: next[group.id].y + dy };
                saveBoardPositions(draft, next);
              }, group.id),
          },
        };
      }),
    [
      project,
      archived,
      issues,
      policyOpen,
      focusName,
      connectFrom,
      error,
      mutate,
      openPanel,
      connect,
      add,
      assign,
      positions,
    ],
  );
  const nodes = useMemo(
    () =>
      baseNodes.map((node) => ({
        ...node,
        position: positions[node.id] ?? { x: 0, y: 0 },
        selected: selection.includes(node.id),
      })),
    [baseNodes, positions, selection],
  );
  const edges = useMemo<Edge[]>(
    () =>
      project.connections
        .filter(
          (link) =>
            project.dets.some((group) => group.id === link.from) &&
            project.dets.some((group) => group.id === link.to),
        )
        .map((link) => {
          const broken = (issues.byGroup[link.from] ?? []).some(
            (issue) => issue.action === 'connections' && issue.severity === 'conflict',
          );
          const color = broken ? 'var(--edge-conflict)' : 'var(--edge)';
          return {
            id: link.id,
            source: link.from,
            target: link.to,
            type: 'smoothstep',
            className: broken ? 'is-broken' : undefined,
            label: broken
              ? 'Verbindung prüfen'
              : `danach · ${(project.assign[link.from] ?? []).length} Pers.`,
            markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
            style: { stroke: color, strokeWidth: 2 },
            labelBgPadding: [8, 4] as [number, number],
            labelBgBorderRadius: 999,
            interactionWidth: 28,
            ariaLabel: `${project.dets.find((group) => group.id === link.from)?.name} anschliessend ${project.dets.find((group) => group.id === link.to)?.name}`,
          };
        }),
    [project, issues],
  );
  const savePositions = useCallback(
    (moved: Record<string, BoardPosition>) => {
      mutate((draft) => saveBoardPositions(draft, { ...getBoardPositions(draft), ...moved }));
    },
    [mutate],
  );
  const inspect = useCallback((id: string) => openPanel({ kind: 'issues', id }), [openPanel]);
  const clearSelection = useCallback(() => {
    setSelection([]);
    setFocusName('');
    setConnectFrom(null);
  }, []);
  const createAt = useCallback(
    (point: { x: number; y: number }) => {
      if (!archived) add(flow.screenToFlowPosition(point));
    },
    [add, archived, flow],
  );
  const focusGroup = useCallback(
    (id: string) => {
      const at = positions[id];
      if (!at) return;
      setSelection([id]);
      void flow.setCenter(at.x + CARD.width / 2, at.y + CARD.height / 2, {
        zoom: Math.max(flow.getZoom(), 0.85),
        duration: 350,
      });
    },
    [flow, positions],
  );

  // One-shot requests from the command palette.
  useEffect(() => {
    const intent = overlays.planningIntent;
    if (!intent) return;
    overlayStore.setState((old) => ({ ...old, planningIntent: null }));
    if (intent.kind === 'add' && !archived) add();
    if (intent.kind === 'focus') requestAnimationFrame(() => focusGroup(intent.id));
  }, [overlays.planningIntent, add, focusGroup, archived]);

  // Board shortcuts: N new card, F fit view, T toggle the list of free people.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTyping(event.target)) return;
      if (document.querySelector('dialog[open]')) return;
      const key = event.key.toLowerCase();
      if (key === 'n' && !archived) {
        event.preventDefault();
        add();
      } else if (key === 'f') {
        event.preventDefault();
        void flow.fitView({ padding: 0.16, maxZoom: 1, duration: 300 });
      } else if (key === 't') {
        event.preventDefault();
        setPreference('tray', !preferences.tray);
      } else if (key === 'escape' && connectFrom) setConnectFrom(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [add, archived, flow, preferences.tray, connectFrom]);

  const selectedGroup =
    panel && 'id' in panel ? project.dets.find((group) => group.id === panel.id) : undefined;
  const selectedPerson =
    panel?.kind === 'person' ? project.persons.find((person) => person.id === panel.id) : undefined;
  const actionable = (issue: BoardIssue, groupId: string) => {
    if (issue.code === 'missing-person' && issue.personId) {
      const personId = issue.personId;
      mutate((draft) => removePeople(draft, groupId, [personId]), groupId);
    } else if (issue.personId && project.persons.some((person) => person.id === issue.personId))
      openPanel({ kind: 'person', id: issue.personId });
    else if (issue.action === 'people') openPanel({ kind: 'people', id: groupId });
    else if (issue.action === 'details')
      openPanel({ kind: 'details', id: issue.correctionGroupId ?? groupId });
  };
  return (
    <main className="planning-page">
      <div className="planning-toolbar">
        <button type="button" className="btn btn-primary" disabled={archived} onClick={() => add()}>
          <Icon name="plus" size={16} /> Neues Detachement
          <span className="kbd kbd-on-accent" aria-hidden="true">
            N
          </span>
        </button>
        {project.persons.length > 0 && (
          <button
            type="button"
            className="btn btn-ghost"
            aria-pressed={trayOpen}
            onClick={() => setPreference('tray', !preferences.tray)}
            title="Liste der freien Personen (T)"
          >
            <Icon name="users" size={16} /> Noch frei <span className="count">{free.length}</span>
          </button>
        )}
        <div className="toolbar-status">
          {conflicts > 0 && (
            <button
              type="button"
              className="badge badge-danger status-chip"
              onClick={() => {
                const first = conflictGroups[0];
                if (first) {
                  focusGroup(first.id);
                  openPanel({ kind: 'issues', id: first.id });
                }
              }}
            >
              <Icon name="alert" /> {conflicts} {conflicts === 1 ? 'Konflikt' : 'Konflikte'}
            </button>
          )}
          {policyOpen && (
            <Link to="/pisa" className="badge badge-warning status-chip">
              <Icon name="info" /> Aufgebotsart noch bestätigen
            </Link>
          )}
          {!conflicts && project.dets.length > 0 && !free.length && project.persons.length > 0 && (
            <span className="badge badge-success">
              <Icon name="check" /> Alle Personen verteilt
            </span>
          )}
        </div>
        <span className="toolbar-meta">
          {project.dets.length} {project.dets.length === 1 ? 'Gruppe' : 'Gruppen'} ·{' '}
          {project.persons.length} Personen
        </span>
        <div className="btn-group">
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Alles anzeigen"
            title="Alles anzeigen (F)"
            onClick={() => void flow.fitView({ padding: 0.16, maxZoom: 1, duration: 300 })}
          >
            <Icon name="fit" size={17} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Anordnen"
            title="Karten automatisch anordnen"
            disabled={archived || !project.dets.length}
            onClick={() => {
              if (
                mutate((draft) => {
                  delete draft.board;
                  saveBoardPositions(draft, getBoardPositions(draft));
                })
              ) {
                notifyUndoable('Karten neu angeordnet.');
                requestAnimationFrame(
                  () => void flow.fitView({ padding: 0.16, maxZoom: 1, duration: 300 }),
                );
              }
            }}
          >
            <Icon name="layout" size={17} />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon btn-sm"
            aria-label="Übersichtskarte"
            aria-pressed={preferences.minimap}
            title="Übersichtskarte ein/aus"
            onClick={() => setPreference('minimap', !preferences.minimap)}
          >
            <Icon name="map" size={17} />
          </button>
        </div>
      </div>
      {error.message && !error.id && (
        <p className="error-box planning-error" role="alert">
          <Icon name="alert" /> {error.message}
        </p>
      )}
      <div className={`planning-workspace ${trayOpen ? 'has-tray' : ''}`}>
        {trayOpen && (
          <PeopleTray
            project={project}
            archived={archived}
            onAssign={assign}
            onOpenPerson={(id) => openPanel({ kind: 'person', id })}
            onClose={() => setPreference('tray', false)}
          />
        )}
        <div className="planning-canvas" ref={canvas}>
          <PlanningCanvas
            key={project.id}
            nodes={nodes}
            edges={edges}
            archived={archived}
            minimap={preferences.minimap}
            onPositions={savePositions}
            onConnect={connect}
            onInspect={inspect}
            onPaneClick={clearSelection}
            onPaneDoubleClick={createAt}
          />
          {!project.dets.length && (
            <div className="canvas-empty">
              <span className="empty-icon">
                <Icon name="board" size={22} />
              </span>
              <h2>Welche Gruppen brauchst du?</h2>
              <p>
                Eine Karte pro Einrückungsgruppe, z. B. «KVK Fahrer» und «WK». Der Name genügt –
                Daten und Orte ergänzt du später.
              </p>
              <div className="actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => add()}
                  disabled={archived}
                >
                  <Icon name="plus" size={16} /> Erstes Detachement erstellen
                </button>
                {!project.persons.length && (
                  <Link to="/sources" className="btn">
                    <Icon name="upload" size={16} /> Zuerst Personen laden
                  </Link>
                )}
              </div>
              <small>Tipp: Doppelklick auf die Fläche erstellt eine Karte an dieser Stelle.</small>
            </div>
          )}
          {connectFrom && (
            <div className="connect-instruction" role="status">
              <Icon name="link" size={16} />
              <span>
                Von <strong>{project.dets.find((group) => group.id === connectFrom)?.name}</strong>{' '}
                – jetzt die Karte wählen, die danach Dienst leistet.
              </span>
              <button type="button" className="btn btn-sm" onClick={() => setConnectFrom(null)}>
                Abbrechen{' '}
                <span className="kbd" aria-hidden="true">
                  Esc
                </span>
              </button>
            </div>
          )}
          {project.dets.length > 0 && !connectFrom && (
            <p className="canvas-hint">
              Kopf ziehen zum Verschieben · Punkt rechts auf eine andere Karte ziehen zum Verbinden
              · Doppelklick für neue Karte
            </p>
          )}
          {panel?.kind === 'people' && selectedGroup && (
            <PeoplePicker
              key={selectedGroup.id}
              project={project}
              group={selectedGroup}
              presentation="panel"
              onClose={() => setPanel(null)}
            />
          )}
          {panel?.kind === 'details' && selectedGroup && (
            <DetachmentDialog
              key={selectedGroup.id}
              group={selectedGroup}
              presentation="panel"
              onClose={() => setPanel(null)}
            />
          )}
          {panel?.kind === 'person' && selectedPerson && (
            <PersonEditor
              key={selectedPerson.id}
              person={selectedPerson}
              presentation="panel"
              onClose={() => setPanel(null)}
            />
          )}
          {panel?.kind === 'issues' && selectedGroup && (
            <PlanningPanel
              title={`${selectedGroup.name} · Prüfung`}
              description="Konflikte betreffen die Planung. Fehlende Angaben kannst du später ergänzen."
              onClose={() => setPanel(null)}
            >
              <div className="issue-cards">
                {(issues.byGroup[selectedGroup.id] ?? []).map((issue) => (
                  <div
                    key={`${issue.code}:${issue.personId ?? ''}:${issue.entryId ?? ''}:${issue.message}`}
                    className={`issue-card is-${issue.severity}`}
                  >
                    <span className="issue-tag">
                      <Icon name={issue.severity === 'conflict' ? 'alert' : 'circle'} size={14} />
                      {issue.severity === 'conflict' ? 'Konflikt' : 'Noch ergänzen'}
                    </span>
                    <p>
                      {issue.personId
                        ? `${project.persons.find((person) => person.id === issue.personId)?.name ?? 'Fehlende Person'}: `
                        : ''}
                      {issue.message}
                    </p>
                    {!archived &&
                      (issue.action === 'pisa' ? (
                        <Link to="/pisa" className="btn-link">
                          In PISA-Vorschau ergänzen <Icon name="arrowRight" size={14} />
                        </Link>
                      ) : issue.action !== 'connections' ? (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() => actionable(issue, selectedGroup.id)}
                        >
                          {issue.code === 'missing-person'
                            ? 'Fehlende Zuteilung entfernen'
                            : 'Jetzt bearbeiten →'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-link"
                          onClick={() =>
                            openPanel({
                              kind: 'details',
                              id: issue.correctionGroupId ?? selectedGroup.id,
                            })
                          }
                        >
                          Angaben prüfen →
                        </button>
                      ))}
                  </div>
                ))}
                {!(issues.byGroup[selectedGroup.id] ?? []).length && (
                  <div className="callout callout-success">
                    <Icon name="checkCircle" />
                    <div className="callout-body">
                      <strong>Keine offenen Punkte.</strong>
                      Diese Karte ist für die PISA-Übertragung bereit.
                    </div>
                  </div>
                )}
              </div>
              {policyOpen && (
                <div className="callout callout-warning">
                  <Icon name="info" />
                  <div className="callout-body">
                    <strong>Aufgebotsart noch bestätigen.</strong>
                    <Link to="/pisa">KF-Auskunft erfassen →</Link>
                  </div>
                </div>
              )}
              <h3>Dienstablauf</h3>
              {project.connections.filter(
                (link) => link.from === selectedGroup.id || link.to === selectedGroup.id,
              ).length === 0 && (
                <p className="muted">
                  Keine Verbindung. Mit «Verbinden» legst du fest, welche Gruppe danach Dienst
                  leistet.
                </p>
              )}
              {project.connections
                .filter((link) => link.from === selectedGroup.id || link.to === selectedGroup.id)
                .map((link) => (
                  <div className="flow-row" key={link.id}>
                    <span className="grow">
                      {project.dets.find((group) => group.id === link.from)?.name}
                      <Icon name="arrowRight" size={14} className="inline-icon" />
                      {project.dets.find((group) => group.id === link.to)?.name}
                    </span>
                    <button
                      type="button"
                      className="btn btn-sm btn-ghost"
                      disabled={archived}
                      onClick={() =>
                        mutate((draft) => disconnectGroups(draft, link.id)) &&
                        notifyUndoable('Verbindung gelöst.')
                      }
                    >
                      <Icon name="unlink" size={15} /> Verbindung lösen
                    </button>
                  </div>
                ))}
              {selectedGroup.zusatzIds.length > 0 && (
                <div className="callout callout-info">
                  <Icon name="info" />
                  <div className="callout-body">
                    Übernommene Zusatz-MB bleiben erhalten. <Link to="/pisa">In PISA prüfen →</Link>
                  </div>
                </div>
              )}
            </PlanningPanel>
          )}
        </div>
      </div>
      {removalGroup && !archived && (
        <Modal
          title="Detachement entfernen?"
          onClose={() => setPendingRemoval(null)}
          footer={
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setPendingRemoval(null)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => remove(removalGroup.id)}
              >
                Detachement entfernen
              </button>
            </>
          }
        >
          <p>
            <strong>{removalGroup.name}</strong> mit seinen Zuteilungen und Verbindungen entfernen?
          </p>
          <p>
            Die Personen bleiben erhalten und können neu zugeteilt werden. Du kannst das Entfernen
            anschliessend rückgängig machen.
          </p>
          {error.id === removalGroup.id && error.message && (
            <p className="error-box" role="alert">
              {error.message}
            </p>
          )}
        </Modal>
      )}
    </main>
  );
}
