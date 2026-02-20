'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { clanApi } from '@/lib/api'
import type { ClanListItem } from '@/types'
import { formatRelativeTime } from '@/lib/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Card } from '@/components/ui/Card'
import { Users, Cpu, Activity, ArrowRight, Plus } from 'lucide-react'

export default function DashboardPage() {
  const [clans, setClans] = useState<ClanListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    clanApi
      .list(0, 100)
      .then(setClans)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const totalAgents = clans.reduce((sum, c) => sum + c.agent_count, 0)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-text-primary">Dashboard</h1>
        <p className="mt-0.5 text-sm text-text-muted">Clan-of-AI Control Plane</p>
      </div>

      {loading ? (
        <PageSpinner />
      ) : error ? (
        <ErrorAlert message={error} />
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard
              label="Total Clans"
              value={clans.length}
              icon={<Users className="h-4 w-4 text-accent-blue" />}
            />
            <StatCard
              label="Total Agents"
              value={totalAgents}
              icon={<Cpu className="h-4 w-4 text-accent-orange" />}
            />
            <StatCard
              label="Active Clans"
              value={clans.length}
              icon={<Activity className="h-4 w-4 text-accent-green" />}
            />
          </div>

          {/* Recent clans */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-medium text-text-primary">Recent Clans</h2>
              <Link
                href="/clans"
                className="flex items-center gap-1 text-xs text-accent-blue hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            {clans.length === 0 ? (
              <Card className="text-center py-10">
                <Users className="mx-auto mb-2 h-8 w-8 text-text-muted" />
                <p className="text-sm text-text-muted">No clans yet</p>
                <Link
                  href="/clans"
                  className="mt-3 inline-flex items-center gap-1 text-xs text-accent-blue hover:underline"
                >
                  <Plus className="h-3 w-3" /> Create your first clan
                </Link>
              </Card>
            ) : (
              <div className="space-y-2">
                {clans.slice(0, 6).map((clan) => (
                  <Link key={clan.id} href={`/clans/${clan.id}`}>
                    <Card hoverable className="flex items-center gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-text-primary">{clan.name}</p>
                        <p className="mt-0.5 truncate text-xs text-text-muted">{clan.description || '—'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs text-text-secondary">
                          <span className="font-medium">{clan.agent_count}</span> agents
                        </p>
                        <p className="text-[10px] text-text-muted">{formatRelativeTime(clan.updated_at)}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-text-muted" />
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div>
            <h2 className="mb-3 text-sm font-medium text-text-primary">Quick Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/clans"
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-text-secondary transition-colors hover:border-border-subtle hover:bg-surface-2"
              >
                <Plus className="h-4 w-4 text-accent-blue" />
                Create New Clan
              </Link>
              <Link
                href="/diff"
                className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3 text-sm text-text-secondary transition-colors hover:border-border-subtle hover:bg-surface-2"
              >
                <Activity className="h-4 w-4 text-accent-purple" />
                Compare Executions
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-text-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-text-primary">{value}</p>
        </div>
        {icon}
      </div>
    </Card>
  )
}
