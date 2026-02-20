import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { formatDistanceToNow, format } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

export function formatRelativeTime(dateStr: string): string {
  return formatDistanceToNow(new Date(dateStr), { addSuffix: true })
}

export function formatDateTime(dateStr: string): string {
  return format(new Date(dateStr), 'MMM d, yyyy HH:mm:ss')
}

export function truncateHash(hash: string | null | undefined, length = 8): string {
  if (!hash) return '—'
  return hash.substring(0, length)
}

export function statusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-accent-green'
    case 'running': return 'text-accent-blue'
    case 'failed': return 'text-accent-red'
    case 'pending': return 'text-text-secondary'
    case 'replaying': return 'text-accent-purple'
    case 'cancelled': return 'text-text-muted'
    default: return 'text-text-secondary'
  }
}

export function statusBg(status: string): string {
  switch (status) {
    case 'completed': return 'bg-accent-green/10 text-accent-green border border-accent-green/20'
    case 'running': return 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
    case 'failed': return 'bg-accent-red/10 text-accent-red border border-accent-red/20'
    case 'pending': return 'bg-surface-3 text-text-secondary border border-border'
    case 'replaying': return 'bg-accent-purple/10 text-accent-purple border border-accent-purple/20'
    case 'cancelled': return 'bg-surface-3 text-text-muted border border-border'
    default: return 'bg-surface-3 text-text-secondary border border-border'
  }
}

export function roleColor(role: string): string {
  switch (role) {
    case 'orchestrator': return 'text-accent-orange'
    case 'worker': return 'text-accent-blue'
    case 'validator': return 'text-accent-green'
    case 'monitor': return 'text-accent-purple'
    default: return 'text-text-secondary'
  }
}

export function roleBg(role: string): string {
  switch (role) {
    case 'orchestrator': return 'bg-accent-orange/10 text-accent-orange border border-accent-orange/20'
    case 'worker': return 'bg-accent-blue/10 text-accent-blue border border-accent-blue/20'
    case 'validator': return 'bg-accent-green/10 text-accent-green border border-accent-green/20'
    case 'monitor': return 'bg-accent-purple/10 text-accent-purple border border-accent-purple/20'
    default: return 'bg-surface-3 text-text-secondary border border-border'
  }
}
