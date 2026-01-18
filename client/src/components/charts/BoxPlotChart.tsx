import { useRef, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { BoxPlotStats } from '@/lib/api'

interface BoxPlotChartProps {
  data: BoxPlotStats[]
  title?: string
  description?: string
  valueLabel?: string
  maxItems?: number
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '#888'
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue(name).trim() || '#888'
}

const getColors = (): string[] => [
  getCssVar('--chart-1'),
  getCssVar('--chart-2'),
  getCssVar('--chart-3'),
  getCssVar('--chart-4'),
  getCssVar('--chart-5'),
]

export function BoxPlotChart({ 
  data, 
  title = "Battery Level Distribution",
  description = "Box plot showing min, Q1, median, Q3, max battery levels",
  valueLabel = "Battery %",
  maxItems = 20
}: BoxPlotChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; item: BoxPlotStats } | null>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 })

  const chartData = data.slice(0, maxItems)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      const { width } = entries[0].contentRect
      setDimensions({ width, height: Math.max(400, chartData.length * 35 + 80) })
    })
    observer.observe(container)
    return () => observer.disconnect()
  }, [chartData.length])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || chartData.length === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = dimensions.width * dpr
    canvas.height = dimensions.height * dpr
    ctx.scale(dpr, dpr)

    const padding = { top: 40, right: 30, bottom: 40, left: 150 }
    const chartWidth = dimensions.width - padding.left - padding.right
    const chartHeight = dimensions.height - padding.top - padding.bottom
    const barHeight = Math.min(25, (chartHeight / chartData.length) * 0.7)
    const barGap = (chartHeight / chartData.length) - barHeight

    ctx.clearRect(0, 0, dimensions.width, dimensions.height)

    const minVal = Math.min(...chartData.map(d => d.min))
    const maxVal = Math.max(...chartData.map(d => d.max))
    const range = maxVal - minVal || 1
    const scale = (val: number) => padding.left + ((val - minVal) / range) * chartWidth

    ctx.strokeStyle = getCssVar('--border')
    ctx.lineWidth = 1
    const gridLines = 5
    for (let i = 0; i <= gridLines; i++) {
      const val = minVal + (range * i / gridLines)
      const x = scale(val)
      ctx.beginPath()
      ctx.moveTo(x, padding.top)
      ctx.lineTo(x, dimensions.height - padding.bottom)
      ctx.stroke()
      
      ctx.fillStyle = getCssVar('--muted-foreground')
      ctx.font = '11px system-ui'
      ctx.textAlign = 'center'
      ctx.fillText(`${Math.round(val)}%`, x, dimensions.height - padding.bottom + 20)
    }

    const COLORS = getColors()
    chartData.forEach((item, i) => {
      const y = padding.top + i * (barHeight + barGap) + barHeight / 2
      const color = COLORS[i % COLORS.length]

      const x1 = scale(item.min)
      const x2 = scale(item.q1)
      const x3 = scale(item.median)
      const x4 = scale(item.q3)
      const x5 = scale(item.max)

      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x1, y)
      ctx.lineTo(x2, y)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(x4, y)
      ctx.lineTo(x5, y)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(x1, y - barHeight / 3)
      ctx.lineTo(x1, y + barHeight / 3)
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(x5, y - barHeight / 3)
      ctx.lineTo(x5, y + barHeight / 3)
      ctx.stroke()

      ctx.fillStyle = color + '40'
      ctx.strokeStyle = color
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.rect(x2, y - barHeight / 2, x4 - x2, barHeight)
      ctx.fill()
      ctx.stroke()

      ctx.strokeStyle = getCssVar('--foreground')
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(x3, y - barHeight / 2)
      ctx.lineTo(x3, y + barHeight / 2)
      ctx.stroke()

      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(scale(item.mean), y, 4, 0, Math.PI * 2)
      ctx.fill()

      const label = item.device_id === 'all' 
        ? item.group_id.substring(0, 18) 
        : `${item.device_id}`.substring(0, 18)
      ctx.fillStyle = getCssVar('--foreground')
      ctx.font = '12px system-ui'
      ctx.textAlign = 'right'
      ctx.fillText(label, padding.left - 10, y + 4)
    })

    ctx.fillStyle = getCssVar('--foreground')
    ctx.font = 'bold 12px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText(valueLabel, dimensions.width / 2, dimensions.height - 5)

  }, [chartData, dimensions, valueLabel])

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const y = e.clientY - rect.top
    const padding = { top: 40 }
    const chartHeight = dimensions.height - 80
    const barHeight = Math.min(25, (chartHeight / chartData.length) * 0.7)
    const barGap = (chartHeight / chartData.length) - barHeight

    const index = Math.floor((y - padding.top) / (barHeight + barGap))
    if (index >= 0 && index < chartData.length) {
      setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, item: chartData[index] })
    } else {
      setTooltip(null)
    }
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            No data available
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
            {chartData.length} items
          </span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
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
              style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}
            >
              <p className="font-semibold">
                {tooltip.item.device_id === 'all' ? tooltip.item.group_id : `${tooltip.item.group_id} / ${tooltip.item.device_id}`}
              </p>
              <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <span className="text-muted-foreground">Min:</span>
                <span className="font-medium">{tooltip.item.min}%</span>
                <span className="text-muted-foreground">Q1:</span>
                <span className="font-medium">{tooltip.item.q1}%</span>
                <span className="text-muted-foreground">Median:</span>
                <span className="font-medium">{tooltip.item.median}%</span>
                <span className="text-muted-foreground">Q3:</span>
                <span className="font-medium">{tooltip.item.q3}%</span>
                <span className="text-muted-foreground">Max:</span>
                <span className="font-medium">{tooltip.item.max}%</span>
                <span className="text-muted-foreground">Mean:</span>
                <span className="font-medium">{tooltip.item.mean}%</span>
                <span className="text-muted-foreground">Events:</span>
                <span className="font-medium">{tooltip.item.count.toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
