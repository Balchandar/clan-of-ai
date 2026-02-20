'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { executionApi } from '@/lib/api'
import type { Execution, DAGNode, ReplayResult, ReplayStep } from '@/types'
import {
  formatDateTime,
  formatDuration,
  formatRelativeTime,
  statusBg,
  truncateHash,
} from '@/lib/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { ChevronLeft, Play, Hash, Clock, Cpu, CheckCircle, GitCompare } from 'lucide-react'
import { ReplayTimeline } from '@/components/replay/ReplayTimeline'

// Lazy load ReactFlow to avoid SSR issues
const ExecutionGraph = dynamic(
  () => import('@/components/dag/ExecutionGraph').then((m) => ({ default: m.ExecutionGraph })),
  { ssr: false, loading: () => <PageSpinner /> }
)

type Tab = 'graph' | 'replay' | 'metadata'

export default function ExecutionDetailPage() {
  const params = useParams()
  const executionId = params.id as string

  const [execution, setExecution] = useState<Execution | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('graph')
  const [selectedNode, setSelectedNode] = useState<DAGNode | null>(null)
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null)
  const [replay, setReplay] = useState<ReplayResult | null>(null)
  const [replayLoading, setReplayLoading] = useState(false)
  const [replayError, setReplayError] = useState<string | null>(null)

  useEffect(() => {
    executionApi
      .get(executionId)
      .then(setExecution)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [executionId])

  const handleLoadReplay = async () => {
    setReplayLoading(true)
    setReplayError(null)
    try {
      const result = await executionApi.replay(executionId, {})
      setReplay(result)
    } catch (err: unknown) {
      setReplayError(err instanceof Error ? err.message : 'Replay failed')
    } finally {
      setReplayLoading(false)
    }
  }

  const handleReplayStepChange = (step: ReplayStep | null) => {
    setHighlightedNodeId(step ? step.node_id : null)
  }

  if (loading) return <div className="p-6"><PageSpinner /></div>
  if (!execution) return <ErrorAlert message={error || 'Execution not found'} className="m-6" />

  const isCompleted = execution.status === 'completed'
  const meta = execution.metadata_record

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-border px-6 py-4">
        <Link href={`/clans/${execution.clan_id}`} className="mb-2 flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary">
          <ChevronLeft className="h-3 w-3" /> Clan
        </Link>
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StatusDot status={execution.status} />
              <h1 className="truncate text-base font-semibold text-text-primary">{execution.task}</h1>
              <Badge className={statusBg(execution.status)}>{execution.status}</Badge>
            </div>
            <div className="mt-1 flex items-center gap-4 text-xs text-text-muted">
              <span className="flex items-center gap-1">
                <Hash className="h-3 w-3" />
                <span className="font-mono">{truncateHash(execution.execution_hash, 12)}</span>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDateTime(execution.started_at)}
              </span>
              {meta && (
                <span className="flex items-center gap-1">
                  <Cpu className="h-3 w-3" />
                  {meta.node_count} nodes · {formatDuration(meta.duration_ms)}
                </span>
              )}
              {execution.determinism_verified && (
                <span className="flex items-center gap-1 text-accent-green">
                  <CheckCircle className="h-3 w-3" />
                  deterministic
                </span>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <Link href={`/diff?a=${executionId}`}>
              <Button size="sm" variant="secondary">
                <GitCompare className="h-3.5 w-3.5" /> Compare
              </Button>
            </Link>
          </div>
        </div>

        {execution.error_message && (
          <div className="mt-3 rounded border border-accent-red/20 bg-accent-red/10 px-3 py-2 text-xs text-accent-red">
            <span className="font-medium">{execution.error_class}:</span> {execution.error_message}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-4 flex gap-4">
          {(['graph', 'replay', 'metadata'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`border-b-2 pb-2 text-sm capitalize transition-colors ${
                activeTab === tab
                  ? 'border-accent-blue text-accent-blue'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'graph' && (
          <>
            {execution.dag ? (
              <div className="h-[600px]">
                <ExecutionGraph
                  dag={execution.dag}
                  highlightedNodeId={highlightedNodeId}
                  onNodeSelect={setSelectedNode}
                />
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center text-text-muted text-sm">
                No execution graph available
              </div>
            )}
          </>
        )}

        {activeTab === 'replay' && (
          <div className="space-y-4">
            {!replay && !replayLoading && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Play className="mb-3 h-8 w-8 text-text-muted" />
                <p className="text-sm text-text-muted">Load replay to step through execution</p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mt-4"
                  onClick={handleLoadReplay}
                  disabled={!isCompleted}
                >
                  <Play className="h-3.5 w-3.5" /> Load Replay
                </Button>
                {!isCompleted && (
                  <p className="mt-2 text-xs text-text-muted">Only completed executions can be replayed</p>
                )}
              </div>
            )}
            {replayLoading && <PageSpinner />}
            {replayError && <ErrorAlert message={replayError} />}
            {replay && (
              <ReplayTimeline steps={replay.steps} onStepChange={handleReplayStepChange} />
            )}
          </div>
        )}

        {activeTab === 'metadata' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <p className="text-xs text-text-muted">Execution ID</p>
                <p className="mt-1 font-mono text-xs text-text-primary break-all">{execution.id}</p>
              </Card>
              <Card>
                <p className="text-xs text-text-muted">Execution Hash</p>
                <p className="mt-1 font-mono text-xs text-text-primary break-all">{execution.execution_hash || '—'}</p>
              </Card>
              <Card>
                <p className="text-xs text-text-muted">Started At</p>
                <p className="mt-1 text-sm text-text-primary">{formatDateTime(execution.started_at)}</p>
              </Card>
              <Card>
                <p className="text-xs text-text-muted">Completed At</p>
                <p className="mt-1 text-sm text-text-primary">
                  {execution.completed_at ? formatDateTime(execution.completed_at) : '—'}
                </p>
              </Card>
              {meta && (
                <>
                  <Card>
                    <p className="text-xs text-text-muted">Duration</p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">{formatDuration(meta.duration_ms)}</p>
                  </Card>
                  <Card>
                    <p className="text-xs text-text-muted">Node Count</p>
                    <p className="mt-1 text-sm font-semibold text-text-primary">{meta.node_count}</p>
                  </Card>
                </>
              )}
            </div>

            {meta && (
              <>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Task Inputs</p>
                  <pre className="overflow-auto rounded-lg border border-border bg-surface-1 p-4 font-mono text-xs text-text-secondary">
                    {JSON.stringify(execution.task_inputs, null, 2)}
                  </pre>
                </div>
                <div>
                  <p className="mb-2 text-xs font-medium uppercase tracking-wider text-text-muted">Final Outputs</p>
                  <pre className="overflow-auto rounded-lg border border-border bg-surface-1 p-4 font-mono text-xs text-text-secondary">
                    {JSON.stringify(meta.outputs, null, 2)}
                  </pre>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
