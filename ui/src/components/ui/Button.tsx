import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  children: React.ReactNode
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  children,
  className,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center gap-2 rounded font-medium transition-colors focus:outline-none focus:ring-1 focus:ring-accent-blue disabled:opacity-50 disabled:cursor-not-allowed',
        {
          'bg-accent-blue text-surface hover:bg-accent-blue/80': variant === 'primary',
          'bg-surface-3 text-text-primary border border-border hover:bg-surface-4': variant === 'secondary',
          'bg-accent-red/10 text-accent-red border border-accent-red/20 hover:bg-accent-red/20': variant === 'danger',
          'text-text-secondary hover:text-text-primary hover:bg-surface-2': variant === 'ghost',
        },
        {
          'px-2 py-1 text-xs': size === 'sm',
          'px-3 py-1.5 text-sm': size === 'md',
          'px-4 py-2 text-sm': size === 'lg',
        },
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="h-3 w-3 animate-spin" />}
      {children}
    </button>
  )
}
