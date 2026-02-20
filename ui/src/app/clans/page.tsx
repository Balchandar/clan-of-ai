'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { clanApi } from '@/lib/api'
import type { ClanListItem } from '@/types'
import { formatRelativeTime, roleBg } from '@/lib/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Users, Plus, Trash2, ArrowRight, Cpu } from 'lucide-react'

export default function ClansPage() {
  const router = useRouter()
  const [clans, setClans] = useState<ClanListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [formValues, setFormValues] = useState({ name: '', description: '' })

  const loadClans = () => {
    setLoading(true)
    clanApi
      .list()
      .then(setClans)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadClans() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const clan = await clanApi.create({
        name: formValues.name,
        description: formValues.description,
        config: {},
      })
      router.push(`/clans/${clan.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Create failed')
      setCreating(false)
    }
  }

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this clan and all its data?')) return
    try {
      await clanApi.delete(id)
      setClans((prev) => prev.filter((c) => c.id !== id))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Delete failed')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-text-primary">Clans</h1>
          <p className="mt-0.5 text-sm text-text-muted">Manage your AI agent teams</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
          <Plus className="h-3.5 w-3.5" /> New Clan
        </Button>
      </div>

      {error && <ErrorAlert message={error} />}

      {showForm && (
        <Card className="border-accent-blue/20 bg-accent-blue/5">
          <h2 className="mb-3 text-sm font-medium text-text-primary">Create Clan</h2>
          <form onSubmit={handleCreate} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Name *</label>
              <input
                required
                value={formValues.name}
                onChange={(e) => setFormValues((p) => ({ ...p, name: e.target.value }))}
                placeholder="my-research-clan"
                className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Description</label>
              <input
                value={formValues.description}
                onChange={(e) => setFormValues((p) => ({ ...p, description: e.target.value }))}
                placeholder="Optional description"
                className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-accent-blue focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" loading={creating}>
                Create
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {loading ? (
        <PageSpinner />
      ) : clans.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="No clans yet"
          description="Create your first clan to get started"
          action={
            <Button variant="primary" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Create Clan
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {clans.map((clan) => (
            <Link key={clan.id} href={`/clans/${clan.id}`}>
              <Card hoverable className="flex items-center gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-3">
                  <Users className="h-4 w-4 text-text-secondary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-text-primary">{clan.name}</p>
                  <p className="mt-0.5 truncate text-xs text-text-muted">{clan.description || '—'}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-text-muted">
                    <Cpu className="h-3 w-3" />
                    {clan.agent_count} agents
                  </span>
                  <span className="text-text-muted">{formatRelativeTime(clan.updated_at)}</span>
                </div>
                <button
                  onClick={(e) => handleDelete(e, clan.id)}
                  className="rounded p-1 text-text-muted transition-colors hover:bg-accent-red/10 hover:text-accent-red"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <ArrowRight className="h-4 w-4 text-text-muted" />
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
