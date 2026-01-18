import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { BatteryDistribution } from '@/lib/api'

interface BatteryDistributionChartProps {
  data: BatteryDistribution[]
  title?: string
}

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '#888'
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue(name).trim() || '#888'
}

export function BatteryDistributionChart({ 
  data, 
  title = "Battery Level Distribution" 
}: BatteryDistributionChartProps) {
  const chartData = data.map(item => ({
    range: `${item.battery_range}-${item.battery_range + 9}%`,
    count: item.count,
    batteryRange: item.battery_range,
  }))

  const getBarColor = (batteryRange: number): string => {
    if (batteryRange < 20) return '#ef4444'
    if (batteryRange < 40) return '#f97316'
    if (batteryRange < 60) return '#eab308'
    if (batteryRange < 80) return '#84cc16'
    return '#22c55e'
  }

  const borderColor = getCssVar('--border')
  const foregroundColor = getCssVar('--foreground')

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Distribution of battery levels when charging began</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            No battery distribution data available
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
          How often the battery was at each level during charging events
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={borderColor} />
            <XAxis 
              dataKey="range" 
              tick={{ fontSize: 12, fill: foregroundColor }}
              stroke={borderColor}
            />
            <YAxis 
              label={{ value: 'Count', angle: -90, position: 'insideLeft', fill: foregroundColor }}
              tick={{ fill: foregroundColor }}
              stroke={borderColor}
            />
            <Tooltip
              formatter={(value) => [(value as number).toLocaleString(), 'Events']}
              labelFormatter={(label) => `Battery: ${label}`}
            />
            <Bar 
              dataKey="count" 
              radius={[4, 4, 0, 0]}
              fill="#3b82f6"
              shape={(props: any) => {
                const { x, y, width, height, payload } = props
                return (
                  <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    fill={getBarColor(payload.batteryRange)}
                    rx={4}
                    ry={4}
                  />
                )
              }}
            />
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-red-500" />
            <span>Critical (0-19%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-orange-500" />
            <span>Low (20-39%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-yellow-500" />
            <span>Medium (40-59%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-lime-500" />
            <span>Good (60-79%)</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="h-3 w-3 rounded bg-green-500" />
            <span>Full (80-100%)</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
