'use client'

import { useMemo } from 'react'
import type { DiffResult, NodeDiff } from '@/types'
import { cn } from '@/lib/utils'
import { CheckCircle, XCircle, AlertTriangle, GitCompare } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'

interface DiffViewerProps {
  diff: DiffResult
}

export function DiffViewer({ diff }: DiffViewerProps) {
  const divergedDiffs = useMemo(
    () => diff.node_diffs.filter((d) => d.is_diverged),
    [diff.node_diffs]
  )
  const cleanDiffs = useMemo(
    () => diff.node_diffs.filter((d) => !d.is_diverged),
    [diff.node_diffs]
  )

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div
        className={cn(
          'flex items-start gap-3 rounded-lg border p-4',
          diff.diverged
            ? 'border-accent-red/20 bg-accent-red/5'
            : 'border-accent-green/20 bg-accent-green/5'
        )}
      >
        {diff.diverged ? (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent-red" />
        ) : (
          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-accent-green" />
        )}
        <div>
          <p className={cn('font-medium', diff.diverged ? 'text-accent-red' : 'text-accent-green')}>
            {diff.diverged ? 'Executions Diverged' : 'Executions Identical'}
          </p>
          <p className="mt-0.5 text-sm text-text-secondary">{diff.summary}</p>
          {diff.divergence_node && (
            <p className="mt-1 font-mono text-xs text-text-muted">
              First divergence at node: <span className="text-accent-orange">{diff.divergence_node}</span>
            </p>
          )}
        </div>
        <div className="ml-auto text-right text-xs text-text-muted">
          <p>{divergedDiffs.length} diverged fields</p>
          <p>{cleanDiffs.length} matching fields</p>
        </div>
      </div>

      {/* Execution ID headers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-surface-1 px-4 py-2.5">
          <p className="text-xs text-text-muted">Execution A</p>
          <p className="font-mono text-sm text-text-primary">{diff.execution_a_id}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface-1 px-4 py-2.5">
          <p className="text-xs text-text-muted">Execution B</p>
          <p className="font-mono text-sm text-text-primary">{diff.execution_b_id}</p>
        </div>
      </div>

      {/* Diverged diffs */}
      {divergedDiffs.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-accent-red" />
            <h3 className="text-sm font-medium text-text-primary">Diverged Fields</h3>
            <Badge className="bg-accent-red/10 text-accent-red border-accent-red/20 border">
              {divergedDiffs.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {divergedDiffs.map((d, i) => (
              <DiffRow key={i} diff={d} variant="diverged" />
            ))}
          </div>
        </div>
      )}

      {/* Clean diffs */}
      {cleanDiffs.length > 0 && (
        <div>
          <div className="mb-2 flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-accent-green" />
            <h3 className="text-sm font-medium text-text-primary">Matching Fields</h3>
            <Badge className="bg-accent-green/10 text-accent-green border-accent-green/20 border">
              {cleanDiffs.length}
            </Badge>
          </div>
          <div className="space-y-2">
            {cleanDiffs.map((d, i) => (
              <DiffRow key={i} diff={d} variant="clean" />
            ))}
          </div>
        </div>
      )}

      {diff.node_diffs.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <GitCompare className="mb-3 h-8 w-8 text-text-muted" />
          <p className="text-sm text-text-muted">No field-level differences found</p>
        </div>
      )}
    </div>
  )
}

function DiffRow({ diff, variant }: { diff: NodeDiff; variant: 'diverged' | 'clean' }) {
  const isDiverged = variant === 'diverged'

  return (
    <div
      className={cn(
        'rounded-lg border text-xs overflow-hidden',
        isDiverged ? 'border-accent-red/20' : 'border-border'
      )}
    >
      <div
        className={cn(
          'flex items-center gap-2 border-b px-3 py-2',
          isDiverged ? 'border-accent-red/20 bg-accent-red/5' : 'border-border bg-surface-2'
        )}
      >
        <span className="font-mono font-medium text-text-secondary">{diff.node_id}</span>
        <span className="text-text-muted">›</span>
        <span className={cn('font-mono', isDiverged ? 'text-accent-red' : 'text-text-secondary')}>
          {diff.field}
        </span>
      </div>

      <div className="grid grid-cols-2 divide-x divide-border">
        <div className="p-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">Execution A</p>
          <pre
            className={cn(
              'overflow-auto rounded p-2 font-mono text-[10px] max-h-24',
              isDiverged
                ? 'bg-accent-red/5 text-accent-red'
                : 'bg-surface text-text-secondary'
            )}
          >
            {JSON.stringify(diff.value_a, null, 2)}
          </pre>
        </div>
        <div className="p-3">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">Execution B</p>
          <pre
            className={cn(
              'overflow-auto rounded p-2 font-mono text-[10px] max-h-24',
              isDiverged
                ? 'bg-accent-orange/5 text-accent-orange'
                : 'bg-surface text-text-secondary'
            )}
          >
            {JSON.stringify(diff.value_b, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
