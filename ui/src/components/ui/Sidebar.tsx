'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Users,
  Play,
  GitCompare,
  Cpu,
} from 'lucide-react'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clans', label: 'Clans', icon: Users },
  { href: '/diff', label: 'Diff Viewer', icon: GitCompare },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-surface-1">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Cpu className="h-5 w-5 text-accent-blue" />
        <div>
          <span className="text-sm font-semibold text-text-primary">Clan</span>
          <span className="text-sm font-semibold text-accent-blue">-of-AI</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        <div className="mb-1">
          <p className="px-2 py-1 text-xs font-medium text-text-muted uppercase tracking-wider">Navigation</p>
        </div>
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2.5 rounded px-2 py-1.5 text-sm transition-colors',
                active
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        <p className="text-xs text-text-muted">v1.0.0 · IntentusNet</p>
      </div>
    </aside>
  )
}
