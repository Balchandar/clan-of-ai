import { AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ErrorAlertProps {
  message: string
  className?: string
}

export function ErrorAlert({ message, className }: ErrorAlertProps) {
  return (
    <div className={cn('flex items-start gap-2 rounded border border-accent-red/20 bg-accent-red/10 px-3 py-2.5', className)}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-red" />
      <p className="text-sm text-accent-red">{message}</p>
    </div>
  )
}
