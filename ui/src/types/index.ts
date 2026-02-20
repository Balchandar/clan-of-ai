export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'replaying' | 'cancelled'
export type AgentRole = 'orchestrator' | 'worker' | 'validator' | 'monitor'

export interface Agent {
  id: string
  clan_id: string
  agent_id: string
  name: string
  role: AgentRole
  config: Record<string, unknown>
  created_at: string
}

export interface Clan {
  id: string
  name: string
  description: string
  config: Record<string, unknown>
  agents: Agent[]
  created_at: string
  updated_at: string
}

export interface ClanListItem {
  id: string
  name: string
  description: string
  agent_count: number
  created_at: string
  updated_at: string
}

export interface DAGNode {
  node_id: string
  agent_id: string
  task_name: string
  status: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  duration_ms: number
  dependencies: string[]
  error?: string | null
}

export interface ExecutionDAG {
  nodes: DAGNode[]
  edges: [string, string][]
  metadata: Record<string, unknown>
}

export interface ExecutionMetadata {
  id: string
  execution_id: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  duration_ms: number
  node_count: number
  determinism_verified: boolean
}

export interface Execution {
  id: string
  clan_id: string
  task: string
  task_inputs: Record<string, unknown>
  status: ExecutionStatus
  execution_hash: string | null
  dag: ExecutionDAG | null
  started_at: string
  completed_at: string | null
  error_message: string | null
  error_class: string | null
  retry_count: number
  determinism_verified: boolean
  metadata_record?: ExecutionMetadata | null
}

export interface ExecutionListItem {
  id: string
  clan_id: string
  task: string
  status: ExecutionStatus
  execution_hash: string | null
  started_at: string
  completed_at: string | null
  retry_count: number
}

export interface ReplayStep {
  step_index: number
  node_id: string
  agent_id: string
  task_name: string
  status: string
  inputs: Record<string, unknown>
  outputs: Record<string, unknown>
  duration_ms: number
  cumulative_duration_ms: number
}

export interface ReplayResult {
  execution_id: string
  total_steps: number
  steps: ReplayStep[]
}

export interface NodeDiff {
  node_id: string
  field: string
  value_a: unknown
  value_b: unknown
  is_diverged: boolean
}

export interface DiffResult {
  execution_a_id: string
  execution_b_id: string
  diverged: boolean
  divergence_node: string | null
  node_diffs: NodeDiff[]
  summary: string
}

export interface GovernanceRule {
  rule_id: string
  name: string
  condition: string
  action: string
  enabled: boolean
  priority: number
}

export interface Governance {
  id: string
  clan_id: string
  max_retries: number
  timeout_s: number
  max_concurrent_executions: number
  allowed_agent_roles: string[]
  rules: GovernanceRule[]
  require_determinism_verification: boolean
  updated_at: string
}
