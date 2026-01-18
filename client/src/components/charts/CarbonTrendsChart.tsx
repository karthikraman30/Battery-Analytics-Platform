import { useRef, useEffect, useMemo } from 'react'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { CarbonTrend } from '@/lib/api'

interface CarbonTrendsChartProps {
  data: CarbonTrend[]
  title?: string
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '#888'
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue(name).trim() || '#888'
}

export function CarbonTrendsChart({ data, title = "Daily CO2 Emissions" }: CarbonTrendsChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const uplotRef = useRef<uPlot | null>(null)

  const { timestamps, co2Values, sessionCounts } = useMemo(() => {
    const ts: number[] = []
    const co2: number[] = []
    const sessions: number[] = []
    
    data.forEach((d) => {
      ts.push(new Date(d.date).getTime() / 1000)
      co2.push(d.co2_grams)
      sessions.push(d.sessions)
    })
    
    return { timestamps: ts, co2Values: co2, sessionCounts: sessions }
  }, [data])

  useEffect(() => {
    if (!chartRef.current || timestamps.length === 0) return

    const maxCO2 = Math.max(...co2Values, 1)
    const maxSessions = Math.max(...sessionCounts, 1)

    const borderColor = getCssVar('--border')
    const chart1Color = getCssVar('--chart-1')
    const chart2Color = getCssVar('--chart-2')

    const opts: uPlot.Options = {
      width: chartRef.current.clientWidth,
      height: 300,
      cursor: {
        drag: { x: true, y: false },
      },
      scales: {
        x: { time: true },
        y: { range: [0, maxCO2 * 1.1] },
        sessions: { range: [0, maxSessions * 1.2] },
      },
      axes: [
        {
          stroke: borderColor,
          grid: { stroke: borderColor, width: 1 },
        },
        {
          stroke: chart1Color,
          grid: { stroke: borderColor, width: 1 },
          label: 'CO2 (grams)',
          labelSize: 14,
          side: 3,
        },
        {
          stroke: chart2Color,
          label: 'Sessions',
          labelSize: 14,
          scale: 'sessions',
          side: 1,
          grid: { show: false },
        },
      ],
      series: [
        {},
        {
          label: 'CO2 (g)',
          stroke: chart1Color,
          width: 2,
          fill: `${chart1Color}15`,
          points: { show: false },
        },
        {
          label: 'Sessions',
          stroke: chart2Color,
          width: 2,
          dash: [5, 5],
          scale: 'sessions',
          points: { show: false },
        },
      ],
    }

    const plotData: uPlot.AlignedData = [timestamps, co2Values, sessionCounts]
    
    if (uplotRef.current) {
      uplotRef.current.destroy()
    }
    
    uplotRef.current = new uPlot(opts, plotData, chartRef.current)

    const handleResize = () => {
      if (chartRef.current && uplotRef.current) {
        uplotRef.current.setSize({ 
          width: chartRef.current.clientWidth, 
          height: 300 
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
  }, [timestamps, co2Values, sessionCounts])

  const totalCO2 = co2Values.reduce((sum, v) => sum + v, 0)
  const avgDaily = timestamps.length > 0 ? totalCO2 / timestamps.length : 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {title}
          <span className="text-sm font-normal text-muted-foreground">
            {data.length} days
          </span>
        </CardTitle>
        <CardDescription>
          Daily carbon emissions from charging. Average: {avgDaily.toFixed(1)}g/day
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[300px] items-center justify-center text-muted-foreground">
            No carbon data available
          </div>
        ) : (
          <div ref={chartRef} />
        )}
      </CardContent>
    </Card>
  )
}
