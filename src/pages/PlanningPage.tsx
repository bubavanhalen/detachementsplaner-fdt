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
import { errorText, Modal } from '../components/Modal';
import { PeoplePicker } from '../components/PeoplePicker';
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
import { changeProject, redoProject, undoProject, useHistory, useProject } from '../store';
import { PersonEditor } from './PersonEditor';
import '@xyflow/react/dist/style.css';
import './planning-board.css';

type Panel =
  | { kind: 'people' | 'details' | 'issues'; id: string }
  | { kind: 'person'; id: string }
  | { kind: 'remaining' }
  | null;
export default function PlanningPage() {
  return (
    <MotionConfig reducedMotion="user">
      <ReactFlowProvider>
        <PlanningBoard />
      </ReactFlowProvider>
    </MotionConfig>
  );
}

function PlanningBoard() {
  const project = useProject();
  const history = useHistory();
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
  const [target, setTarget] = useState('');
  const issues = useMemo(() => boardIssues(project), [project]);
  const free = useMemo(() => remainingPeople(project), [project]);
  const conflicts = new Set(
    [...Object.values(issues.byGroup).flat(), ...issues.global]
      .filter((issue) => issue.severity === 'conflict')
      .map((issue) => `${issue.code}:${issue.personId ?? ''}:${issue.groupId ?? ''}`),
  ).size;
  const policyOpen = issues.global.some((issue) => issue.code === 'policy-unconfirmed');
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
    setTarget('');
    setError((current) => (current.message ? { id: '', message: '' } : current));
    setFocusName('');
  }, []);
  const remove = useCallback(
    (id: string) => {
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
      }
    },
    [mutate],
  );
  const baseNodes = useMemo<PlanningNode[]>(
    () =>
      project.dets.map((group) => ({
        id: group.id,
        type: 'detachment',
        position: { x: 0, y: 0 },
        dragHandle: '.card-grip',
        draggable: !archived,
        connectable: !archived,
        ariaLabel: `Detachement ${group.name}`,
        data: {
          group,
          direct: (project.assign[group.id] ?? []).length,
          inherited: groupPeople(project, group.id).filter(
            (person) => !(project.assign[group.id] ?? []).includes(person.id),
          ).length,
          issues: issues.byGroup[group.id] ?? [],
          policyOpen,
          globalOpen: issues.global.length > 0,
          archived,
          newCard: focusName === group.id,
          connecting: Boolean(connectFrom),
          source: connectFrom === group.id,
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
          onMove: (dx, dy) =>
            mutate((draft) => {
              const next = getBoardPositions(draft);
              next[group.id] = { x: next[group.id].x + dx, y: next[group.id].y + dy };
              saveBoardPositions(draft, next);
            }, group.id),
        },
      })),
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
          return {
            id: link.id,
            source: link.from,
            target: link.to,
            type: 'smoothstep',
            label: broken
              ? 'Verbindung prüfen'
              : `danach · ${(project.assign[link.from] ?? []).length} Pers.`,
            markerEnd: { type: MarkerType.ArrowClosed, color: broken ? '#aa3737' : '#687b60' },
            style: { stroke: broken ? '#aa3737' : '#687b60', strokeWidth: 2.2 },
            labelStyle: { fill: broken ? '#8e2727' : '#3f5634', fontSize: 12 },
            labelBgStyle: { fill: '#f4f3ed' },
            labelBgPadding: [8, 5],
            labelBgBorderRadius: 5,
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
  }, []);
  const add = () => {
    const group = createDetachment({ name: 'Neues Detachement' });
    const bounds = canvas.current?.getBoundingClientRect();
    const center = flow.screenToFlowPosition({
      x: bounds ? bounds.left + bounds.width / 2 : 500,
      y: bounds ? bounds.top + bounds.height / 2 : 300,
    });
    const position = { x: center.x - 163, y: center.y - 195 };
    while (
      Object.values(positions).some(
        (point) => Math.abs(point.x - position.x) < 340 && Math.abs(point.y - position.y) < 430,
      )
    ) {
      position.x += 380;
    }
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
      requestAnimationFrame(() => {
        const height = canvas.current?.clientHeight || 500;
        const width = canvas.current?.clientWidth || 700;
        const zoom = Math.max(0.5, Math.min(1, (height - 50) / 420, (width - 35) / 326));
        void flow.setViewport({
          x: width / 2 - (position.x + 163) * zoom,
          y: height / 2 - (position.y + 195) * zoom,
          zoom,
        });
      });
    }
  };
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
      <header className="planning-heading">
        <div>
          <p className="eyebrow">DEIN PLANUNGSTISCH</p>
          <h1>Gruppen planen.</h1>
          <p>Anlegen, Personen auswählen und den Dienstablauf verbinden.</p>
        </div>
        <Link className="button button-secondary" to="/pisa">
          PISA vorbereiten →
        </Link>
      </header>
      <div className="planning-toolbar">
        <button type="button" disabled={archived} onClick={add}>
          + Detachement
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={archived || !free.length || !project.dets.length}
          onClick={() => openPanel({ kind: 'remaining' })}
        >
          Rest verteilen <span className="toolbar-count">{free.length}</span>
        </button>
        <div className="history-buttons">
          <button
            type="button"
            className="button-secondary"
            disabled={archived || !history.canUndo}
            onClick={() => {
              undoProject();
              setPanel(null);
              setFocusName('');
            }}
            aria-label="Rückgängig"
          >
            ↶
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={archived || !history.canRedo}
            onClick={() => {
              redoProject();
              setPanel(null);
              setFocusName('');
            }}
            aria-label="Wiederholen"
          >
            ↷
          </button>
        </div>
        <span className="toolbar-status">
          {project.dets.length} Gruppen · {project.persons.length} Personen
          {conflicts > 0 && (
            <strong>
              {' '}
              · {conflicts} {conflicts === 1 ? 'Konflikt' : 'Konflikte'}
            </strong>
          )}
        </span>
        <button
          type="button"
          className="text-button"
          onClick={() => void flow.fitView({ padding: 0.16, maxZoom: 1 })}
        >
          Alles anzeigen
        </button>
        <button
          type="button"
          className="text-button"
          disabled={archived || !project.dets.length}
          onClick={() => {
            mutate((draft) => {
              delete draft.board;
              saveBoardPositions(draft, getBoardPositions(draft));
            });
          }}
        >
          Anordnen
        </button>
      </div>
      {archived && <div className="notice">Archivstand · Die Planung ist schreibgeschützt.</div>}
      {issues.global.length > 0 && (
        <details className="board-global-issues">
          <summary>
            {free.length > 0
              ? `${free.length} Personen noch zu verteilen`
              : !project.persons.length
                ? 'Mit einer Datenquelle anfangen'
                : 'Übergreifende Hinweise'}
            {policyOpen ? ' · Aufgebotsart noch bestätigen' : ''}
          </summary>
          <div>
            {issues.global.map((issue, index) => (
              <p key={`${issue.code}-${issue.personId ?? index}`}>
                {issue.personId
                  ? `${project.persons.find((person) => person.id === issue.personId)?.name ?? 'Person'}: `
                  : ''}
                {issue.message}
              </p>
            ))}
            <Link to={!project.persons.length ? '/files' : policyOpen ? '/pisa' : '/persons'}>
              Offene Punkte bearbeiten →
            </Link>
          </div>
        </details>
      )}
      {error.message && !error.id && (
        <p className="notice notice-error" role="alert">
          {error.message}
        </p>
      )}
      <div className={`planning-workspace ${panel ? 'has-panel' : ''}`}>
        <div className="planning-canvas" ref={canvas}>
          <PlanningCanvas
            key={project.id}
            nodes={nodes}
            edges={edges}
            archived={archived}
            onPositions={savePositions}
            onConnect={connect}
            onInspect={inspect}
            onPaneClick={clearSelection}
          />
          {!project.dets.length && (
            <div className="canvas-empty">
              <span>01</span>
              <h2>Welche Gruppen brauchst du?</h2>
              <p>Ein Klick, eine Karte. Name genügt – alles Weitere kommt später.</p>
              <button type="button" onClick={add} disabled={archived}>
                Erstes Detachement erstellen
              </button>
              {!project.persons.length && (
                <Link to="/files">PISA- oder MILO-Liste lokal laden</Link>
              )}
            </div>
          )}
          {connectFrom && (
            <div className="connect-instruction" role="status">
              Von <strong>{project.dets.find((group) => group.id === connectFrom)?.name}</strong>:
              Zielkarte wählen.
              <button type="button" onClick={() => setConnectFrom(null)}>
                Abbrechen
              </button>
            </div>
          )}
          <p className="canvas-instruction">
            Am Griff verschieben · Verbindungspunkte ziehen oder «Verbinden» wählen · Positionen
            bleiben lokal
          </p>
        </div>
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
          <PlanningPanel title={`${selectedGroup.name} · Prüfung`} onClose={() => setPanel(null)}>
            <p className="muted">
              Fehlende Angaben kannst du später ergänzen. Konflikte betreffen bereits die Planung.
            </p>
            <div className="board-issue-list">
              {(issues.byGroup[selectedGroup.id] ?? []).map((issue) => (
                <div
                  key={`${issue.code}:${issue.personId ?? ''}:${issue.entryId ?? ''}:${issue.message}`}
                  className={`board-issue ${issue.severity}`}
                >
                  <strong>{issue.severity === 'conflict' ? 'Konflikt' : 'Noch ergänzen'}</strong>
                  <p>
                    {issue.personId
                      ? `${project.persons.find((person) => person.id === issue.personId)?.name ?? 'Fehlende Person'}: `
                      : ''}
                    {issue.message}
                  </p>
                  {!archived &&
                    (issue.action === 'pisa' ? (
                      <Link to="/pisa">In PISA-Vorschau ergänzen →</Link>
                    ) : issue.action !== 'connections' ? (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => actionable(issue, selectedGroup.id)}
                      >
                        {issue.code === 'missing-person'
                          ? 'Fehlende Zuteilung entfernen'
                          : 'Jetzt bearbeiten →'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="text-button"
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
            </div>
            {policyOpen && (
              <p className="notice">
                Aufgebotsart noch bestätigen. <Link to="/pisa">KF-Auskunft erfassen →</Link>
              </p>
            )}
            <h3>Dienstablauf</h3>
            {project.connections
              .filter((link) => link.from === selectedGroup.id || link.to === selectedGroup.id)
              .map((link) => (
                <div className="board-issue" key={link.id}>
                  <p>
                    {project.dets.find((group) => group.id === link.from)?.name} →{' '}
                    {project.dets.find((group) => group.id === link.to)?.name}
                  </p>
                  <button
                    type="button"
                    className="text-button"
                    disabled={archived}
                    onClick={() => mutate((draft) => disconnectGroups(draft, link.id))}
                  >
                    Verbindung lösen
                  </button>
                </div>
              ))}
            {selectedGroup.zusatzIds.length > 0 && (
              <p className="notice">
                Übernommene Zusatz-MB bleiben erhalten. <Link to="/pisa">In PISA prüfen →</Link>
              </p>
            )}
          </PlanningPanel>
        )}
        {panel?.kind === 'remaining' && (
          <PlanningPanel title="Restliche Personen verteilen" onClose={() => setPanel(null)}>
            <p>{free.length} Personen sind noch keinem Detachement direkt zugeteilt.</p>
            <label>
              Zuteilen zu
              <select value={target} onChange={(event) => setTarget(event.target.value)}>
                <option value="">Detachement wählen …</option>
                {project.dets.map((group) => (
                  <option value={group.id} key={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              disabled={!target || archived}
              onClick={() => {
                if (
                  mutate((draft) =>
                    assignPeople(
                      draft,
                      target,
                      remainingPeople(draft).map((person) => person.id),
                    ),
                  )
                )
                  setPanel(null);
              }}
            >
              {free.length} Personen zuteilen
            </button>
          </PlanningPanel>
        )}
      </div>
      {removalGroup && !archived && (
        <Modal
          title="Detachement entfernen?"
          onClose={() => setPendingRemoval(null)}
          footer={
            <>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setPendingRemoval(null)}
              >
                Abbrechen
              </button>
              <button type="button" onClick={() => remove(removalGroup.id)}>
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
          {error.id === removalGroup.id && error.message && <p role="alert">{error.message}</p>}
        </Modal>
      )}
    </main>
  );
}
