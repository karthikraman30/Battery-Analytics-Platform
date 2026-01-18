import { useRef, useEffect, useMemo, useState } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ChargingSession } from '@/lib/api'

interface ChargingSessionsChartProps {
  data: ChargingSession[]
  title?: string
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '#888'
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue(name).trim() || '#888'
}

interface ProcessedSession {
  duration: number
  chargeGained: number
  startLevel: number
  endLevel: number
  date: string
  timestamp: number
}

export function ChargingSessionsChart({ data, title = "Charging Sessions" }: ChargingSessionsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const uplotRef = useRef<uPlot | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; session: ProcessedSession } | null>(null)

  const { sessions, durations, chargeGained } = useMemo(() => {
    const filtered: ProcessedSession[] = []
    const durs: number[] = []
    const gains: number[] = []
    
    data.forEach(session => {
      if (session.is_complete && session.duration_minutes && session.charge_gained !== null) {
        const processed: ProcessedSession = {
          duration: session.duration_minutes,
          chargeGained: session.charge_gained,
          startLevel: session.start_battery_level,
          endLevel: session.end_battery_level ?? 0,
          date: new Date(session.session_start).toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
          }),
          timestamp: new Date(session.session_start).getTime(),
        }
        filtered.push(processed)
        durs.push(session.duration_minutes)
        gains.push(session.charge_gained)
      }
    })
    
    return { sessions: filtered, durations: durs, chargeGained: gains }
  }, [data])

  useEffect(() => {
    if (!chartRef.current || durations.length === 0) return

    const maxDuration = Math.max(...durations, 60)
    const minGain = Math.min(...chargeGained, -10)
    const maxGain = Math.max(...chargeGained, 100)

    const borderColor = getCssVar('--border')
    const chart1Color = getCssVar('--chart-1')

    const opts: uPlot.Options = {
      width: chartRef.current.clientWidth,
      height: 400,
      mode: 2,
      cursor: {
        drag: { x: true, y: true },
        points: {
          size: 8,
          fill: chart1Color,
        },
      },
      scales: {
        x: {
          time: false,
          range: [0, maxDuration * 1.1],
        },
        y: {
          range: [Math.min(minGain - 10, -10), Math.max(maxGain + 10, 110)],
        },
      },
      axes: [
        {
          stroke: borderColor,
          grid: { stroke: borderColor, width: 1 },
          label: 'Duration (minutes)',
          labelSize: 14,
          values: (_u, vals) => vals.map(v => `${Math.round(v)} min`),
        },
        {
          stroke: borderColor,
          grid: { stroke: borderColor, width: 1 },
          label: 'Charge Gained (%)',
          labelSize: 14,
          values: (_u, vals) => vals.map(v => `${Math.round(v)}%`),
        },
      ],
      series: [
        {
          label: 'Duration',
        },
        {
          label: 'Charge Gained',
          stroke: chart1Color,
          fill: `${chart1Color}99`,
          paths: () => null,
          points: {
            show: true,
            size: 8,
            fill: chart1Color,
            stroke: chart1Color,
          },
        },
      ],
      hooks: {
        setCursor: [
          (u: uPlot) => {
            const idx = u.cursor.idx
            if (idx != null && idx >= 0 && idx < sessions.length) {
              const left = u.cursor.left ?? 0
              const top = u.cursor.top ?? 0
              setTooltip({ x: left, y: top, session: sessions[idx] })
            } else {
              setTooltip(null)
            }
          },
        ],
        draw: [
          (u: uPlot) => {
            const ctx = u.ctx
            const { left, width } = u.bbox

            ctx.save()
            ctx.strokeStyle = borderColor
            ctx.setLineDash([5, 5])
            const y0 = Math.round(u.valToPos(0, 'y', true))
            ctx.beginPath()
            ctx.moveTo(left, y0)
            ctx.lineTo(left + width, y0)
            ctx.stroke()
            ctx.restore()
          },
        ],
      },
    }

    const plotData: uPlot.AlignedData = [durations, chargeGained]
    
    if (uplotRef.current) {
      uplotRef.current.destroy()
    }
    
    uplotRef.current = new uPlot(opts, plotData, chartRef.current)

    const handleResize = () => {
      if (chartRef.current && uplotRef.current) {
        uplotRef.current.setSize({ 
          width: chartRef.current.clientWidth, 
          height: 400 
        })
      }
    }

    window.addEventListener('resize', handleResize)
    
    return () => {
      window.removeEventListener('resize', handleResize)
      if (uplotRef.current) {
        uplotRef.current.destroy()
        uplotRef.current = null
      }
    }
  }, [durations, chargeGained, sessions])

  if (sessions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Duration vs charge gained per session</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            No complete charging sessions available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <span className="text-sm font-normal text-muted-foreground">
            {sessions.length.toLocaleString()} sessions
          </span>
        </CardTitle>
        <CardDescription>
          Each dot represents a charging session. Drag to zoom, double-click to reset.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="relative">
          <div ref={chartRef} />
          {tooltip && (
            <div 
              className="pointer-events-none absolute z-10 rounded-lg border bg-background p-3 shadow-md"
              style={{ 
                left: Math.min(tooltip.x + 10, (chartRef.current?.clientWidth ?? 300) - 180),
                top: tooltip.y - 80,
              }}
            >
              <p className="font-medium">{tooltip.session.date}</p>
              <div className="mt-2 space-y-1 text-sm">
                <p>Duration: <span className="font-medium">{Math.round(tooltip.session.duration)} min</span></p>
                <p>Charge gained: <span className="font-medium">{Math.round(tooltip.session.chargeGained)}%</span></p>
                <p>Start level: <span className="font-medium">{Math.round(tooltip.session.startLevel)}%</span></p>
                <p>End level: <span className="font-medium">{Math.round(tooltip.session.endLevel)}%</span></p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
