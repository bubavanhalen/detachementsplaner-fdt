import {
  applyNodeChanges,
  Background,
  type Connection,
  Controls,
  type Edge,
  MiniMap,
  type NodeChange,
  type OnNodeDrag,
  ReactFlow,
} from '@xyflow/react';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import type { BoardPosition } from '../model/board';
import { DetachmentNode, type PlanningNode } from './DetachmentNode';

const nodeTypes = { detachment: DetachmentNode };
const fitViewOptions = { padding: 0.12, minZoom: 0.7, maxZoom: 1 };
const ariaLabelConfig = {
  'node.a11yDescription.default':
    'Mit Tab auswählen. Pfeiltasten verschieben die Karte. Eingabefelder direkt bearbeiten.',
  'controls.zoomIn.ariaLabel': 'Vergrössern',
  'controls.zoomOut.ariaLabel': 'Verkleinern',
  'controls.fitView.ariaLabel': 'Alle Detachemente anzeigen',
  'minimap.ariaLabel': 'Übersichtskarte',
};

/** Pointer frames stay inside the graph; persist once after a completed gesture. */
export const PlanningCanvas = memo(function PlanningCanvas({
  nodes: incoming,
  edges,
  archived,
  onPositions,
  onConnect,
  onInspect,
  onPaneClick,
  onPaneDoubleClick,
  minimap = false,
}: {
  nodes: PlanningNode[];
  edges: Edge[];
  archived: boolean;
  onPositions: (positions: Record<string, BoardPosition>) => void;
  onConnect: (connection: Connection) => void;
  onInspect: (id: string) => void;
  onPaneClick: () => void;
  onPaneDoubleClick?: (point: { x: number; y: number }) => void;
  minimap?: boolean;
}) {
  const [nodes, setNodes] = useState(incoming);
  const nodesRef = useRef(nodes);
  const dragging = useRef(false);
  useEffect(() => {
    const previous = new Map(nodesRef.current.map((node) => [node.id, node]));
    const next = incoming.map((node) => ({ ...previous.get(node.id), ...node }));
    nodesRef.current = next;
    setNodes(next);
  }, [incoming]);
  const onNodesChange = useCallback(
    (changes: NodeChange<PlanningNode>[]) => {
      const next = applyNodeChanges(changes, nodesRef.current);
      nodesRef.current = next;
      setNodes(next);
      if (archived || dragging.current) return;
      const positions = Object.fromEntries(
        changes.flatMap((change) =>
          change.type === 'position' && change.position && change.dragging !== true
            ? [[change.id, change.position]]
            : [],
        ),
      );
      if (Object.keys(positions).length) onPositions(positions);
    },
    [archived, onPositions],
  );
  const onNodeDragStart = useCallback(() => {
    dragging.current = true;
  }, []);
  const onNodeDragStop = useCallback<OnNodeDrag<PlanningNode>>(
    (_, _node, moved) => {
      dragging.current = false;
      onPositions(Object.fromEntries(moved.map((node) => [node.id, node.position])));
    },
    [onPositions],
  );
  const onEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => onInspect(edge.source),
    [onInspect],
  );
  const onDoubleClick = useCallback(
    (event: React.MouseEvent) => {
      if ((event.target as HTMLElement).classList.contains('react-flow__pane'))
        onPaneDoubleClick?.({ x: event.clientX, y: event.clientY });
    },
    [onPaneDoubleClick],
  );
  return (
    <ReactFlow<PlanningNode>
      onDoubleClick={onDoubleClick}
      zoomOnDoubleClick={false}
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onNodeDragStart={onNodeDragStart}
      onNodeDragStop={onNodeDragStop}
      onConnect={onConnect}
      onEdgeClick={onEdgeClick}
      onPaneClick={onPaneClick}
      deleteKeyCode={null}
      minZoom={0.35}
      maxZoom={1.5}
      fitView
      fitViewOptions={fitViewOptions}
      nodesDraggable={!archived}
      nodesConnectable={!archived}
      autoPanOnNodeFocus={false}
      zoomOnScroll={false}
      panOnScroll
      ariaLabelConfig={ariaLabelConfig}
    >
      <Background gap={22} size={1.4} color="var(--canvas-dot)" />
      <Controls showInteractive={false} showFitView={false} position="bottom-right" />
      {minimap && (
        <MiniMap
          pannable
          zoomable
          position="top-right"
          ariaLabel="Übersichtskarte"
          nodeBorderRadius={10}
          maskColor="rgb(120 130 124 / 0.12)"
        />
      )}
    </ReactFlow>
  );
});
