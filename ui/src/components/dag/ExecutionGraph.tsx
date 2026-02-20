'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type NodeProps,
  Handle,
  Position,
  MarkerType,
  useNodesState,
  useEdgesState,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import type { DAGNode, ExecutionDAG } from '@/types'
import { cn, formatDuration, statusBg, roleBg } from '@/lib/utils'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ChevronRight, Clock, Cpu, AlertCircle } from 'lucide-react'

interface NodeData extends Record<string, unknown> {
  dagNode: DAGNode
  isHighlighted: boolean
  isSelected: boolean
}

function DAGNodeComponent({ data, selected }: NodeProps<NodeData>) {
  const { dagNode, isHighlighted } = data
  const isError = dagNode.status === 'failed'

  return (
    <div
      className={cn(
        'min-w-[180px] rounded-lg border bg-surface-2 px-3 py-2.5 text-xs shadow-lg transition-all',
        isHighlighted ? 'border-accent-blue shadow-accent-blue/20 shadow-md' : 'border-border',
        selected && 'border-accent-blue ring-1 ring-accent-blue',
        isError && 'border-accent-red/40'
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!border-border-subtle !bg-surface-4 !h-2 !w-2"
      />

      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono font-semibold text-text-primary truncate">{dagNode.task_name}</span>
        <span className={cn('shrink-0 rounded px-1 py-0.5 text-[10px] font-medium', statusBg(dagNode.status))}>
          {dagNode.status}
        </span>
      </div>

      <div className="flex items-center gap-2 text-text-muted">
        <Cpu className="h-3 w-3 shrink-0" />
        <span className="truncate font-mono text-[10px]">{dagNode.agent_id}</span>
      </div>

      <div className="mt-1.5 flex items-center gap-1 text-text-muted">
        <Clock className="h-3 w-3 shrink-0" />
        <span className="font-mono text-[10px]">{formatDuration(dagNode.duration_ms)}</span>
      </div>

      {isError && dagNode.error && (
        <div className="mt-1.5 flex items-start gap-1">
          <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-accent-red" />
          <span className="text-[10px] text-accent-red line-clamp-2">{dagNode.error}</span>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!border-border-subtle !bg-surface-4 !h-2 !w-2"
      />
    </div>
  )
}

const nodeTypes = { dagNode: DAGNodeComponent }

interface ExecutionGraphProps {
  dag: ExecutionDAG
  highlightedNodeId?: string | null
  onNodeSelect?: (node: DAGNode | null) => void
}

function buildLayout(dag: ExecutionDAG): { nodes: Node<NodeData>[]; edges: Edge[] } {
  const nodeMap = new Map<string, DAGNode>()
  for (const n of dag.nodes) nodeMap.set(n.node_id, n)

  // Compute depth via topological sort
  const depth = new Map<string, number>()
  const depthOf = (nodeId: string): number => {
    if (depth.has(nodeId)) return depth.get(nodeId)!
    const node = nodeMap.get(nodeId)
    if (!node || node.dependencies.length === 0) {
      depth.set(nodeId, 0)
      return 0
    }
    const d = Math.max(...node.dependencies.map(depthOf)) + 1
    depth.set(nodeId, d)
    return d
  }
  dag.nodes.forEach((n) => depthOf(n.node_id))

  // Group by depth
  const columns = new Map<number, string[]>()
  for (const [id, d] of depth.entries()) {
    if (!columns.has(d)) columns.set(d, [])
    columns.get(d)!.push(id)
  }

  const X_STEP = 240
  const Y_STEP = 110
  const nodePositions = new Map<string, { x: number; y: number }>()

  for (const [col, ids] of columns.entries()) {
    const x = col * X_STEP
    ids.forEach((id, row) => {
      const y = row * Y_STEP - ((ids.length - 1) * Y_STEP) / 2
      nodePositions.set(id, { x, y })
    })
  }

  const nodes: Node<NodeData>[] = dag.nodes.map((dagNode) => ({
    id: dagNode.node_id,
    type: 'dagNode',
    position: nodePositions.get(dagNode.node_id) ?? { x: 0, y: 0 },
    data: { dagNode, isHighlighted: false, isSelected: false },
  }))

  const edges: Edge[] = dag.edges.map(([source, target]) => ({
    id: `${source}->${target}`,
    source,
    target,
    markerEnd: { type: MarkerType.ArrowClosed, color: '#373e47', width: 12, height: 12 },
    style: { stroke: '#373e47', strokeWidth: 1.5 },
    animated: false,
  }))

  return { nodes, edges }
}

export function ExecutionGraph({ dag, highlightedNodeId, onNodeSelect }: ExecutionGraphProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)

  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildLayout(dag),
    [dag]
  )

  const nodesWithState = useMemo(
    () =>
      initialNodes.map((n) => ({
        ...n,
        data: {
          ...n.data,
          isHighlighted: n.id === highlightedNodeId,
          isSelected: n.id === selectedNodeId,
        },
      })),
    [initialNodes, highlightedNodeId, selectedNodeId]
  )

  const [nodes, , onNodesChange] = useNodesState(nodesWithState)
  const [edges, , onEdgesChange] = useEdgesState(initialEdges)

  const selectedDagNode = useMemo(
    () => dag.nodes.find((n) => n.node_id === selectedNodeId) ?? null,
    [dag.nodes, selectedNodeId]
  )

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node<NodeData>) => {
      const dagNode = node.data.dagNode
      setSelectedNodeId(dagNode.node_id)
      onNodeSelect?.(dagNode)
    },
    [onNodeSelect]
  )

  const handlePaneClick = useCallback(() => {
    setSelectedNodeId(null)
    onNodeSelect?.(null)
  }, [onNodeSelect])

  return (
    <div className="flex h-full gap-4">
      <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-surface">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.3}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="#2d333b"
          />
          <Controls
            showInteractive={false}
            className="!border-border !bg-surface-2 [&>button]:!border-border [&>button]:!bg-surface-2 [&>button]:!text-text-secondary [&>button:hover]:!bg-surface-3"
          />
          <MiniMap
            nodeColor="#2d333b"
            maskColor="rgba(15,17,23,0.8)"
            className="!border-border !bg-surface-1 !rounded"
          />
        </ReactFlow>
      </div>

      {selectedDagNode && (
        <NodeInspector node={selectedDagNode} onClose={() => { setSelectedNodeId(null); onNodeSelect?.(null) }} />
      )}
    </div>
  )
}

function NodeInspector({ node, onClose }: { node: DAGNode; onClose: () => void }) {
  return (
    <div className="w-72 shrink-0 overflow-y-auto rounded-lg border border-border bg-surface-1 p-4 text-xs animate-slide-up">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-medium text-text-primary">Node Inspector</h3>
        <button onClick={onClose} className="text-text-muted hover:text-text-primary">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-3">
        <Section title="Identity">
          <Field label="Node ID" value={node.node_id} mono />
          <Field label="Agent" value={node.agent_id} mono />
          <Field label="Task" value={node.task_name} />
        </Section>

        <Section title="Execution">
          <Field label="Status" value={<Badge className={statusBg(node.status)}>{node.status}</Badge>} />
          <Field label="Duration" value={formatDuration(node.duration_ms)} mono />
          <Field label="Dependencies" value={node.dependencies.join(', ') || '—'} mono />
        </Section>

        {node.error && (
          <Section title="Error">
            <p className="rounded bg-accent-red/10 p-2 font-mono text-[10px] text-accent-red break-all">
              {node.error}
            </p>
          </Section>
        )}

        <Section title="Inputs">
          <JsonView data={node.inputs} />
        </Section>

        <Section title="Outputs">
          <JsonView data={node.outputs} />
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  )
}

function Field({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 text-text-muted">{label}</span>
      <span className={cn('text-right text-text-secondary break-all', mono && 'font-mono text-[10px]')}>
        {value}
      </span>
    </div>
  )
}

function JsonView({ data }: { data: Record<string, unknown> }) {
  if (Object.keys(data).length === 0) return <p className="text-text-muted italic">empty</p>
  return (
    <pre className="overflow-auto rounded bg-surface p-2 font-mono text-[10px] text-text-secondary">
      {JSON.stringify(data, null, 2)}
    </pre>
  )
}
