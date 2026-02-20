'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { executionApi } from '@/lib/api'
import type { DiffResult } from '@/types'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Button } from '@/components/ui/Button'
import { DiffViewer } from '@/components/diff/DiffViewer'
import { GitCompare } from 'lucide-react'
import { Suspense } from 'react'

function DiffPageContent() {
  const searchParams = useSearchParams()
  const [execAId, setExecAId] = useState(searchParams.get('a') || '')
  const [execBId, setExecBId] = useState(searchParams.get('b') || '')
  const [diff, setDiff] = useState<DiffResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDiff = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!execAId.trim() || !execBId.trim()) return
    setLoading(true)
    setError(null)
    setDiff(null)
    try {
      const result = await executionApi.diff({
        execution_a_id: execAId.trim(),
        execution_b_id: execBId.trim(),
      })
      setDiff(result)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Diff failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Execution Diff</h1>
        <p className="mt-0.5 text-sm text-text-muted">Compare two executions node-by-node</p>
      </div>

      <form onSubmit={handleDiff} className="rounded-lg border border-border bg-surface-1 p-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Execution A ID *</label>
            <input
              required
              value={execAId}
              onChange={(e) => setExecAId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-text-muted">Execution B ID *</label>
            <input
              required
              value={execBId}
              onChange={(e) => setExecBId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button type="submit" variant="primary" size="sm" loading={loading}>
            <GitCompare className="h-3.5 w-3.5" /> Compare Executions
          </Button>
        </div>
      </form>

      {error && <ErrorAlert message={error} />}
      {loading && <PageSpinner />}
      {diff && <DiffViewer diff={diff} />}

      {!diff && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <GitCompare className="mb-3 h-10 w-10 text-text-muted" />
          <p className="text-sm text-text-muted">Enter two execution IDs to compare them</p>
          <p className="mt-1 text-xs text-text-muted">
            Both executions must be in completed status
          </p>
        </div>
      )}
    </div>
  )
}

export default function DiffPage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <DiffPageContent />
    </Suspense>
  )
}
