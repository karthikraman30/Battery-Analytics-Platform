import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { AppUsage } from '@/lib/api'

interface AppUsageChartProps {
  data: AppUsage[]
  title?: string
  maxItems?: number
}

const COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316', '#22c55e',
  '#14b8a6', '#06b6d4', '#6366f1', '#a855f7', '#f43f5e',
]

function getCssVar(name: string): string {
  if (typeof window === 'undefined') return '#888'
  const style = getComputedStyle(document.documentElement)
  return style.getPropertyValue(name).trim() || '#888'
}

function formatAppName(name: string): string {
  if (name.includes('.')) {
    const parts = name.split('.')
    return parts[parts.length - 1]
  }
  return name.length > 20 ? name.substring(0, 17) + '...' : name
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}m`
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`
}

export function AppUsageChart({ data, title = "Top Apps by Usage", maxItems = 10 }: AppUsageChartProps) {
  const borderColor = getCssVar('--border')
  const foregroundColor = getCssVar('--foreground')
  
  const chartData = data
    .slice(0, maxItems)
    .map(app => ({
      ...app,
      displayName: formatAppName(app.name),
      formattedTime: formatMinutes(app.total_minutes),
    }))
    .reverse()

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>Most used apps by total time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            No app usage data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Most used apps by total screen time</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(300, chartData.length * 35)}>
          <BarChart data={chartData} layout="vertical" margin={{ left: 10, right: 30 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={borderColor} />
            <XAxis 
              type="number" 
              tickFormatter={(value) => formatMinutes(value)}
              tick={{ fill: foregroundColor }}
              stroke={borderColor}
            />
            <YAxis 
              type="category" 
              dataKey="displayName"
              width={120}
              tick={{ fontSize: 12, fill: foregroundColor }}
              stroke={borderColor}
            />
            <Tooltip
              formatter={(value) => [formatMinutes(value as number), 'Time']}
              labelFormatter={(label) => `App: ${label}`}
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null
                const data = payload[0].payload as AppUsage & { formattedTime: string }
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-md">
                    <p className="font-medium">{data.name}</p>
                    <p className="text-sm text-muted-foreground">{data.package_name}</p>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>Total time: <span className="font-medium">{data.formattedTime}</span></p>
                      <p>Sessions: <span className="font-medium">{data.session_count}</span></p>
                      <p>Avg session: <span className="font-medium">{Math.round(data.avg_session_seconds)}s</span></p>
                    </div>
                  </div>
                )
              }}
            />
            <Bar dataKey="total_minutes" radius={[0, 4, 4, 0]}>
              {chartData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
