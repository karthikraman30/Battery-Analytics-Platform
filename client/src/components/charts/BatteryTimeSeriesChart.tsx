import { useRef, useEffect, useMemo } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { BatteryEvent } from '@/lib/api'

interface BatteryTimeSeriesChartProps {
  data: BatteryEvent[]
  title?: string
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '#888'
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue(name).trim() || '#888'
}

export function BatteryTimeSeriesChart({ data, title = "Battery Level Over Time" }: BatteryTimeSeriesChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const uplotRef = useRef<uPlot | null>(null)

  const { timestamps, batteryLevels, chargingIndices } = useMemo(() => {
    const ts: number[] = []
    const levels: number[] = []
    const charging: number[] = []
    
    data.forEach((d, i) => {
      ts.push(new Date(d.timestamp).getTime() / 1000)
      levels.push(d.battery_level)
      if (d.event_type === 'power_connected') {
        charging.push(i)
      }
    })
    
    return { timestamps: ts, batteryLevels: levels, chargingIndices: charging }
  }, [data])

  useEffect(() => {
    if (!chartRef.current || timestamps.length === 0) return

    const borderColor = getCssVar('--border')
    const chart1Color = getCssVar('--chart-1')
    const destructiveColor = getCssVar('--destructive')
    const chart3Color = getCssVar('--chart-3')

    const opts: uPlot.Options = {
      width: chartRef.current.clientWidth,
      height: 400,
      cursor: {
        drag: { x: true, y: false },
      },
      scales: {
        x: { time: true },
        y: { range: [0, 100] },
      },
      axes: [
        {
          stroke: borderColor,
          grid: { stroke: borderColor, width: 1 },
        },
        {
          stroke: borderColor,
          grid: { stroke: borderColor, width: 1 },
          label: 'Battery %',
          labelSize: 14,
        },
      ],
      series: [
        {},
        {
          label: 'Battery',
          stroke: chart1Color,
          width: 2,
          fill: `${chart1Color}15`,
          points: {
            show: false,
          },
        },
      ],
      hooks: {
        draw: [
          (u: uPlot) => {
            const ctx = u.ctx
            const { left } = u.bbox

            ctx.save()
            ctx.strokeStyle = destructiveColor
            ctx.setLineDash([5, 5])
            const y20 = Math.round(u.valToPos(20, 'y', true))
            ctx.beginPath()
            ctx.moveTo(left, y20)
            ctx.lineTo(left + u.bbox.width, y20)
            ctx.stroke()

            ctx.strokeStyle = chart3Color
            const y80 = Math.round(u.valToPos(80, 'y', true))
            ctx.beginPath()
            ctx.moveTo(left, y80)
            ctx.lineTo(left + u.bbox.width, y80)
            ctx.stroke()
            ctx.restore()

            if (chargingIndices.length > 0 && chargingIndices.length < 500) {
              ctx.save()
              ctx.fillStyle = chart3Color
              ctx.strokeStyle = chart3Color
              chargingIndices.forEach(i => {
                if (i < timestamps.length) {
                  const x = u.valToPos(timestamps[i], 'x', true)
                  const y = u.valToPos(batteryLevels[i], 'y', true)
                  ctx.beginPath()
                  ctx.arc(x, y, 4, 0, Math.PI * 2)
                  ctx.fill()
                  ctx.stroke()
                }
              })
              ctx.restore()
            }
          },
        ],
      },
    }

    const plotData: uPlot.AlignedData = [timestamps, batteryLevels]
    
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
  }, [timestamps, batteryLevels, chargingIndices])

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <span className="text-sm font-normal text-muted-foreground">
            {data.length.toLocaleString()} events
          </span>
        </CardTitle>
        <CardDescription>
          Battery level with charging events highlighted. Drag to zoom, double-click to reset.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[400px] items-center justify-center text-muted-foreground">
            No battery data available
          </div>
        ) : (
          <div ref={chartRef} />
        )}
      </CardContent>
    </Card>
  )
}
