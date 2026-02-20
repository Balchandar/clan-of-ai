import { cn } from '@/lib/utils'

interface StatusDotProps {
  status: string
  className?: string
}

const dotColors: Record<string, string> = {
  completed: 'bg-accent-green',
  running: 'bg-accent-blue animate-pulse',
  failed: 'bg-accent-red',
  pending: 'bg-text-muted',
  replaying: 'bg-accent-purple animate-pulse',
  cancelled: 'bg-text-muted',
}

export function StatusDot({ status, className }: StatusDotProps) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 rounded-full',
        dotColors[status] ?? 'bg-text-muted',
        className
      )}
    />
  )
}
