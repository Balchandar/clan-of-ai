'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { clanApi, executionApi } from '@/lib/api'
import type { Clan, ExecutionListItem } from '@/types'
import { formatRelativeTime, formatDateTime, formatDuration, statusBg, roleBg, truncateHash } from '@/lib/utils'
import { PageSpinner } from '@/components/ui/Spinner'
import { ErrorAlert } from '@/components/ui/ErrorAlert'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { StatusDot } from '@/components/ui/StatusDot'
import { EmptyState } from '@/components/ui/EmptyState'
import {
  Users,
  Plus,
  Trash2,
  Play,
  Copy,
  Settings,
  ChevronLeft,
  Cpu,
  Clock,
  Hash,
} from 'lucide-react'

type Tab = 'agents' | 'executions' | 'governance'

export default function ClanDetailPage() {
  const params = useParams()
  const router = useRouter()
  const clanId = params.id as string

  const [clan, setClan] = useState<Clan | null>(null)
  const [executions, setExecutions] = useState<ExecutionListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [execLoading, setExecLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('agents')
  const [showRunForm, setShowRunForm] = useState(false)
  const [showAgentForm, setShowAgentForm] = useState(false)
  const [runTask, setRunTask] = useState('')
  const [running, setRunning] = useState(false)
  const [agentForm, setAgentForm] = useState({ agent_id: '', name: '', role: 'worker' })
  const [addingAgent, setAddingAgent] = useState(false)

  useEffect(() => {
    Promise.all([
      clanApi.get(clanId),
      executionApi.listByClan(clanId),
    ])
      .then(([clanData, execs]) => {
        setClan(clanData)
        setExecutions(execs)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clanId])

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault()
    setRunning(true)
    try {
      const exec = await executionApi.run(clanId, {
        task: runTask,
        inputs: {},
        override_governance: {},
      })
      router.push(`/executions/${exec.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Run failed')
      setRunning(false)
    }
  }

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddingAgent(true)
    try {
      await clanApi.addAgent(clanId, { ...agentForm, config: {} })
      const updated = await clanApi.get(clanId)
      setClan(updated)
      setShowAgentForm(false)
      setAgentForm({ agent_id: '', name: '', role: 'worker' })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Add agent failed')
    } finally {
      setAddingAgent(false)
    }
  }

  const handleRemoveAgent = async (agentId: string) => {
    if (!confirm(`Remove agent ${agentId}?`)) return
    try {
      await clanApi.removeAgent(clanId, agentId)
      const updated = await clanApi.get(clanId)
      setClan(updated)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Remove failed')
    }
  }

  const handleClone = async () => {
    const newName = prompt('Enter name for cloned clan:')
    if (!newName) return
    try {
      const cloned = await clanApi.clone(clanId, { new_name: newName, override_config: {} })
      router.push(`/clans/${cloned.id}`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Clone failed')
    }
  }

  if (loading) return <PageSpinner />
  if (!clan) return <ErrorAlert message={error || 'Clan not found'} className="m-6" />

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <Link href="/clans" className="mb-3 flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary">
          <ChevronLeft className="h-3 w-3" /> Clans
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-semibold text-text-primary">{clan.name}</h1>
            <p className="mt-0.5 text-sm text-text-muted">{clan.description || '—'}</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={handleClone}>
              <Copy className="h-3.5 w-3.5" /> Clone
            </Button>
            <Button size="sm" variant="primary" onClick={() => setShowRunForm(true)}>
              <Play className="h-3.5 w-3.5" /> Run Task
            </Button>
          </div>
        </div>
      </div>

      {error && <ErrorAlert message={error} />}

      {/* Run form */}
      {showRunForm && (
        <Card className="border-accent-green/20 bg-accent-green/5">
          <h2 className="mb-3 text-sm font-medium text-text-primary">Run Task</h2>
          <form onSubmit={handleRun} className="space-y-3">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Task Description *</label>
              <input
                required
                value={runTask}
                onChange={(e) => setRunTask(e.target.value)}
                placeholder="Describe what this clan should do..."
                className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary placeholder-text-muted focus:border-accent-green focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" variant="primary" size="sm" loading={running}>
                <Play className="h-3.5 w-3.5" /> Execute
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowRunForm(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Tabs */}
      <div className="border-b border-border">
        <div className="flex gap-4">
          {(['agents', 'executions', 'governance'] as Tab[]).map((tab) => (
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
              {tab === 'agents' && (
                <span className="ml-1.5 rounded-full bg-surface-3 px-1.5 text-[10px] text-text-muted">
                  {clan.agents.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'agents' && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" variant="secondary" onClick={() => setShowAgentForm(true)}>
              <Plus className="h-3.5 w-3.5" /> Add Agent
            </Button>
          </div>

          {showAgentForm && (
            <Card className="border-accent-blue/20 bg-accent-blue/5">
              <h3 className="mb-3 text-sm font-medium text-text-primary">Add Agent</h3>
              <form onSubmit={handleAddAgent} className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Agent ID *</label>
                  <input required value={agentForm.agent_id} onChange={(e) => setAgentForm((p) => ({ ...p, agent_id: e.target.value }))}
                    placeholder="agent-1" className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 font-mono text-sm text-text-primary focus:border-accent-blue focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Name *</label>
                  <input required value={agentForm.name} onChange={(e) => setAgentForm((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Research Agent" className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-text-muted">Role *</label>
                  <select value={agentForm.role} onChange={(e) => setAgentForm((p) => ({ ...p, role: e.target.value }))}
                    className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue focus:outline-none">
                    <option value="orchestrator">orchestrator</option>
                    <option value="worker">worker</option>
                    <option value="validator">validator</option>
                    <option value="monitor">monitor</option>
                  </select>
                </div>
                <div className="col-span-3 flex gap-2">
                  <Button type="submit" variant="primary" size="sm" loading={addingAgent}>Add</Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowAgentForm(false)}>Cancel</Button>
                </div>
              </form>
            </Card>
          )}

          {clan.agents.length === 0 ? (
            <EmptyState icon={<Cpu className="h-8 w-8" />} title="No agents in this clan" description="Add agents to get started" />
          ) : (
            <div className="space-y-2">
              {clan.agents.map((agent) => (
                <Card key={agent.id} className="flex items-center gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-surface-3">
                    <Cpu className="h-4 w-4 text-text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-text-primary">{agent.name}</p>
                    <p className="font-mono text-xs text-text-muted">{agent.agent_id}</p>
                  </div>
                  <Badge className={roleBg(agent.role)}>{agent.role}</Badge>
                  <button onClick={() => handleRemoveAgent(agent.agent_id)}
                    className="rounded p-1 text-text-muted hover:bg-accent-red/10 hover:text-accent-red">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'executions' && (
        <div>
          {executions.length === 0 ? (
            <EmptyState title="No executions yet" description="Run a task to see execution history" />
          ) : (
            <div className="space-y-2">
              {executions.map((ex) => (
                <Link key={ex.id} href={`/executions/${ex.id}`}>
                  <Card hoverable className="flex items-center gap-4">
                    <StatusDot status={ex.status} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate text-sm font-medium text-text-primary">{ex.task}</p>
                      <p className="font-mono text-xs text-text-muted">{formatDateTime(ex.started_at)}</p>
                    </div>
                    <div className="text-right text-xs">
                      <Badge className={statusBg(ex.status)}>{ex.status}</Badge>
                      {ex.execution_hash && (
                        <p className="mt-0.5 font-mono text-text-muted">{truncateHash(ex.execution_hash)}</p>
                      )}
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'governance' && (
        <GovernanceTab clanId={clanId} />
      )}
    </div>
  )
}

function GovernanceTab({ clanId }: { clanId: string }) {
  const [gov, setGov] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>(null)
  const { governanceApi } = require('@/lib/api')

  useEffect(() => {
    governanceApi.get(clanId)
      .then((g: any) => { setGov(g); setForm(g) })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [clanId])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const updated = await governanceApi.update(clanId, {
        max_retries: form.max_retries,
        timeout_s: form.timeout_s,
        max_concurrent_executions: form.max_concurrent_executions,
        allowed_agent_roles: form.allowed_agent_roles,
        rules: form.rules,
        require_determinism_verification: form.require_determinism_verification,
      })
      setGov(updated)
      setEditing(false)
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) return <PageSpinner />
  if (error) return <ErrorAlert message={error} />
  if (!gov) return null

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" variant="secondary" onClick={() => setEditing(!editing)}>
          <Settings className="h-3.5 w-3.5" /> {editing ? 'Cancel' : 'Edit'}
        </Button>
      </div>

      {editing ? (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="mb-1 block text-xs text-text-muted">Max Retries</label>
              <input type="number" min="0" max="10" value={form.max_retries}
                onChange={(e) => setForm((p: any) => ({ ...p, max_retries: +e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Timeout (s)</label>
              <input type="number" min="1" max="3600" value={form.timeout_s}
                onChange={(e) => setForm((p: any) => ({ ...p, timeout_s: +e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue focus:outline-none" />
            </div>
            <div>
              <label className="mb-1 block text-xs text-text-muted">Max Concurrent</label>
              <input type="number" min="1" max="50" value={form.max_concurrent_executions}
                onChange={(e) => setForm((p: any) => ({ ...p, max_concurrent_executions: +e.target.value }))}
                className="w-full rounded border border-border bg-surface-2 px-3 py-1.5 text-sm text-text-primary focus:border-accent-blue focus:outline-none" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="det-verify" checked={form.require_determinism_verification}
              onChange={(e) => setForm((p: any) => ({ ...p, require_determinism_verification: e.target.checked }))}
              className="rounded border-border" />
            <label htmlFor="det-verify" className="text-sm text-text-secondary">Require Determinism Verification</label>
          </div>
          <Button type="submit" variant="primary" size="sm">Save Governance</Button>
        </form>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <p className="text-xs text-text-muted">Max Retries</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{gov.max_retries}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Timeout</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{gov.timeout_s}s</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Max Concurrent Executions</p>
            <p className="mt-1 text-xl font-semibold text-text-primary">{gov.max_concurrent_executions}</p>
          </Card>
          <Card>
            <p className="text-xs text-text-muted">Determinism Verification</p>
            <p className={`mt-1 text-xl font-semibold ${gov.require_determinism_verification ? 'text-accent-green' : 'text-text-muted'}`}>
              {gov.require_determinism_verification ? 'Required' : 'Disabled'}
            </p>
          </Card>
        </div>
      )}
    </div>
  )
}
