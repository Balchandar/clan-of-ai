import axios from 'axios'
import type {
  Clan,
  ClanListItem,
  DiffResult,
  Execution,
  ExecutionListItem,
  Governance,
  ReplayResult,
} from '@/types'

const apiClient = axios.create({
  baseURL: '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      'Unknown error'
    return Promise.reject(new Error(message))
  }
)

// Clans
export const clanApi = {
  list: (offset = 0, limit = 50) =>
    apiClient.get<ClanListItem[]>('/clans', { params: { offset, limit } }).then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Clan>(`/clans/${id}`).then((r) => r.data),

  create: (payload: { name: string; description: string; config: Record<string, unknown> }) =>
    apiClient.post<Clan>('/clans', payload).then((r) => r.data),

  delete: (id: string) =>
    apiClient.delete(`/clans/${id}`),

  clone: (id: string, payload: { new_name: string; override_config: Record<string, unknown> }) =>
    apiClient.post<Clan>(`/clans/${id}/clone`, payload).then((r) => r.data),

  addAgent: (
    clanId: string,
    payload: { agent_id: string; name: string; role: string; config: Record<string, unknown> }
  ) => apiClient.post(`/clans/${clanId}/agents`, payload).then((r) => r.data),

  removeAgent: (clanId: string, agentId: string) =>
    apiClient.delete(`/clans/${clanId}/agents/${agentId}`),
}

// Executions
export const executionApi = {
  run: (
    clanId: string,
    payload: { task: string; inputs: Record<string, unknown>; override_governance: Record<string, unknown> }
  ) => apiClient.post<Execution>(`/clans/${clanId}/run`, payload).then((r) => r.data),

  listByClan: (clanId: string, offset = 0, limit = 50) =>
    apiClient
      .get<ExecutionListItem[]>(`/clans/${clanId}/executions`, { params: { offset, limit } })
      .then((r) => r.data),

  get: (id: string) =>
    apiClient.get<Execution>(`/executions/${id}`).then((r) => r.data),

  replay: (id: string, payload: { step_limit?: number }) =>
    apiClient.post<ReplayResult>(`/executions/${id}/replay`, payload).then((r) => r.data),

  diff: (payload: { execution_a_id: string; execution_b_id: string }) =>
    apiClient.post<DiffResult>('/executions/diff', payload).then((r) => r.data),
}

// Governance
export const governanceApi = {
  get: (clanId: string) =>
    apiClient.get<Governance>(`/clans/${clanId}/governance`).then((r) => r.data),

  update: (clanId: string, payload: Omit<Governance, 'id' | 'clan_id' | 'updated_at'>) =>
    apiClient.put<Governance>(`/clans/${clanId}/governance`, payload).then((r) => r.data),
}

export default apiClient
