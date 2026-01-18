import { useRef, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ChargingByHour } from '@/lib/api'

interface ChargingByHourChartProps {
  data: ChargingByHour[]
  title?: string
}

export function ChargingByHourChart({ data, title = "Charging Behavior by Hour" }: ChargingByHourChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: ChargingByHour } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 350 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect
      setDimensions({ width, height: 350 })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || data.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    const padding = { top: 30, right: 60, bottom: 50, left: 50 }
    const chartWidth = dimensions.width - padding.left - padding.right
    const chartHeight = dimensions.height - padding.top - padding.bottom

    ctx.clearRect(0, 0, dimensions.width, dimensions.height)

    const maxSessions = Math.max(...data.map(d => d.sessions))
    const barWidth = chartWidth / 24 * 0.7
    const barGap = chartWidth / 24 * 0.3

    ctx.strokeStyle = '#e5e7eb'
    ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartHeight * i / 4)
      ctx.beginPath()
      ctx.moveTo(padding.left, y)
      ctx.lineTo(dimensions.width - padding.right, y)
      ctx.stroke()
      
      const val = Math.round(maxSessions * (1 - i / 4))
      ctx.fillStyle = '#6b7280'
      ctx.font = '11px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(val.toString(), padding.left - 8, y + 4)
    }

    data.forEach((item, i) => {
      const x = padding.left + (i * (chartWidth / 24)) + barGap / 2
      const barHeight = (item.sessions / maxSessions) * chartHeight
      const y = padding.top + chartHeight - barHeight

      const hue = ((100 - item.avg_start_level) / 100) * 120
      ctx.fillStyle = `hsl(${hue}, 70%, 50%)`
      
      ctx.beginPath()
      ctx.roundRect(x, y, barWidth, barHeight, [4, 4, 0, 0])
      ctx.fill()

      if (i % 3 === 0) {
        ctx.fillStyle = '#6b7280'
        ctx.font = '11px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText(`${item.hour}:00`, x + barWidth / 2, dimensions.height - padding.bottom + 20)
      }
    })

    ctx.fillStyle = '#374151'
    ctx.font = '11px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('Hour of Day', dimensions.width / 2, dimensions.height - 10)

    ctx.save()
    ctx.translate(15, dimensions.height / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('Charging Sessions', 0, 0)
    ctx.restore()

    const legendY = padding.top - 15
    ctx.font = '10px system-ui'
    ctx.textAlign = 'left'
    
    const gradient = ctx.createLinearGradient(dimensions.width - 180, 0, dimensions.width - 60, 0)
    gradient.addColorStop(0, 'hsl(120, 70%, 50%)')
    gradient.addColorStop(1, 'hsl(0, 70%, 50%)')
    
    ctx.fillStyle = gradient
    ctx.fillRect(dimensions.width - 180, legendY - 8, 120, 10)
    
    ctx.fillStyle = '#6b7280'
    ctx.fillText('High', dimensions.width - 180, legendY + 12)
    ctx.textAlign = 'right'
    ctx.fillText('Low', dimensions.width - 60, legendY + 12)
    ctx.textAlign = 'center'
    ctx.fillText('Start Battery %', dimensions.width - 120, legendY + 12)

  }, [data, dimensions])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const padding = { left: 50, right: 60 }
    const chartWidth = dimensions.width - padding.left - padding.right

    const hourIndex = Math.floor((x - padding.left) / (chartWidth / 24))
    if (hourIndex >= 0 && hourIndex < data.length) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, item: data[hourIndex] })
    } else {
      setTooltip(null)
    }
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            No charging data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>
          Bar height = session count, color = battery level when charging started (green=high, red=low)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="relative">
          <canvas
            ref={canvasRef}
            style={{ width: dimensions.width, height: dimensions.height }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setTooltip(null)}
          />
          {tooltip && (
            <div 
              className="absolute pointer-events-none z-10 rounded-lg border bg-background p-3 shadow-lg text-sm"
              style={{ left: Math.min(tooltip.x + 10, dimensions.width - 180), top: tooltip.y - 10 }}
            >
              <p className="font-semibold">{tooltip.item.hour}:00 - {tooltip.item.hour}:59</p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Sessions:</span>
                <span className="font-medium">{tooltip.item.sessions}</span>
                <span className="text-muted-foreground">Avg start level:</span>
                <span className="font-medium">{tooltip.item.avg_start_level}%</span>
                <span className="text-muted-foreground">Avg charge gained:</span>
                <span className="font-medium">+{tooltip.item.avg_charge_gained}%</span>
                <span className="text-muted-foreground">Avg duration:</span>
                <span className="font-medium">{tooltip.item.avg_duration.toFixed(0)} min</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
