'use client'

import { useState, useCallback, useEffect } from 'react'
import type { ReplayStep } from '@/types'
import { cn, formatDuration, statusBg, roleBg } from '@/lib/utils'
import { Play, Pause, SkipBack, SkipForward, StepForward, Cpu, Clock } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

interface ReplayTimelineProps {
  steps: ReplayStep[]
  onStepChange?: (step: ReplayStep | null, index: number) => void
}

export function ReplayTimeline({ steps, onStepChange }: ReplayTimelineProps) {
  const [currentIndex, setCurrentIndex] = useState(-1)
  const [playing, setPlaying] = useState(false)
  const [playSpeed, setPlaySpeed] = useState(800)

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(-1, Math.min(steps.length - 1, index))
      setCurrentIndex(clamped)
      onStepChange?.(clamped >= 0 ? steps[clamped] : null, clamped)
    },
    [steps, onStepChange]
  )

  useEffect(() => {
    if (!playing) return
    if (currentIndex >= steps.length - 1) {
      setPlaying(false)
      return
    }
    const timer = setTimeout(() => goTo(currentIndex + 1), playSpeed)
    return () => clearTimeout(timer)
  }, [playing, currentIndex, steps.length, playSpeed, goTo])

  const totalDuration = steps.length > 0 ? steps[steps.length - 1].cumulative_duration_ms : 0
  const progress = currentIndex >= 0 ? ((currentIndex + 1) / steps.length) * 100 : 0

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex items-center gap-3 rounded-lg border border-border bg-surface-1 px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goTo(-1)}
            title="Reset"
          >
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goTo(currentIndex - 1)}
            disabled={currentIndex < 0}
            title="Previous step"
          >
            <StepForward className="h-3.5 w-3.5 rotate-180" />
          </Button>
          <Button
            size="sm"
            variant={playing ? 'primary' : 'secondary'}
            onClick={() => {
              if (currentIndex >= steps.length - 1) goTo(-1)
              setPlaying(!playing)
            }}
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? 'Pause' : 'Play'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goTo(currentIndex + 1)}
            disabled={currentIndex >= steps.length - 1}
            title="Next step"
          >
            <StepForward className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => goTo(steps.length - 1)}
            title="Jump to end"
          >
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="mx-2 h-4 w-px bg-border" />

        <div className="flex items-center gap-2 text-xs text-text-secondary">
          <span>Speed:</span>
          {[2000, 800, 400, 150].map((ms) => (
            <button
              key={ms}
              onClick={() => setPlaySpeed(ms)}
              className={cn(
                'rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors',
                playSpeed === ms
                  ? 'bg-accent-blue/10 text-accent-blue'
                  : 'text-text-muted hover:text-text-secondary'
              )}
            >
              {ms >= 1000 ? `${ms / 1000}x` : `${Math.round(800 / ms)}x`}
            </button>
          ))}
        </div>

        <div className="ml-auto font-mono text-xs text-text-muted">
          {currentIndex + 1} / {steps.length} · {formatDuration(totalDuration)}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-full rounded-full bg-accent-blue transition-all duration-200"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step list */}
      <div className="overflow-auto rounded-lg border border-border bg-surface-1">
        <div className="divide-y divide-border">
          {steps.map((step, idx) => {
            const isActive = idx === currentIndex
            const isPast = idx < currentIndex

            return (
              <button
                key={step.node_id}
                onClick={() => goTo(idx)}
                className={cn(
                  'flex w-full items-start gap-3 px-4 py-3 text-left text-xs transition-colors',
                  isActive && 'bg-accent-blue/10',
                  !isActive && isPast && 'bg-surface-2',
                  !isActive && !isPast && 'hover:bg-surface-2'
                )}
              >
                {/* Step index */}
                <div
                  className={cn(
                    'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold font-mono',
                    isActive
                      ? 'bg-accent-blue text-surface'
                      : isPast
                      ? 'bg-surface-4 text-text-muted'
                      : 'bg-surface-3 text-text-muted'
                  )}
                >
                  {idx + 1}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        'font-medium font-mono truncate',
                        isActive ? 'text-text-primary' : isPast ? 'text-text-secondary' : 'text-text-muted'
                      )}
                    >
                      {step.task_name}
                    </span>
                    <Badge className={cn(statusBg(step.status), 'shrink-0')}>
                      {step.status}
                    </Badge>
                  </div>

                  <div className="mt-0.5 flex items-center gap-3 text-[10px] text-text-muted">
                    <span className="flex items-center gap-1">
                      <Cpu className="h-2.5 w-2.5" />
                      {step.agent_id}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-2.5 w-2.5" />
                      {formatDuration(step.duration_ms)}
                    </span>
                    <span className="font-mono text-text-muted">
                      T+{formatDuration(step.cumulative_duration_ms)}
                    </span>
                  </div>
                </div>

                {isActive && (
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-accent-blue animate-pulse" />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Active step detail */}
      {currentIndex >= 0 && steps[currentIndex] && (
        <StepDetail step={steps[currentIndex]} />
      )}
    </div>
  )
}

function StepDetail({ step }: { step: ReplayStep }) {
  return (
    <div className="rounded-lg border border-accent-blue/20 bg-accent-blue/5 p-4 text-xs animate-fade-in">
      <p className="mb-2 font-medium text-text-primary">Step {step.step_index + 1}: {step.task_name}</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">Inputs</p>
          <pre className="overflow-auto rounded bg-surface p-2 font-mono text-[10px] text-text-secondary max-h-32">
            {JSON.stringify(step.inputs, null, 2)}
          </pre>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text-muted">Outputs</p>
          <pre className="overflow-auto rounded bg-surface p-2 font-mono text-[10px] text-text-secondary max-h-32">
            {JSON.stringify(step.outputs, null, 2)}
          </pre>
        </div>
      </div>
    </div>
  )
}
