import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import type { AppBatteryDrain } from '@/lib/api'

interface AppBatteryDrainChartProps {
  data: AppBatteryDrain[]
  title?: string
  onSortChange?: (sortBy: 'hours' | 'drain' | 'sessions' | 'devices') => void
  currentSort?: 'hours' | 'drain' | 'sessions' | 'devices'
}

const COLORS = {
  hours: '#3b82f6',
  drain: '#ef4444',
  sessions: '#22c55e',
  devices: '#8b5cf6',
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`
  return `${hours.toFixed(1)}h`
}

function formatDrain(drain: number): string {
  if (drain === 0 || isNaN(drain)) return '-'
  return `${drain.toFixed(0)}%/hr`
}

export function AppBatteryDrainChart({ 
  data, 
  title = "App Battery Impact",
  onSortChange,
  currentSort = 'hours'
}: AppBatteryDrainChartProps) {
  const maxValue = Math.max(...data.map(d => {
    switch (currentSort) {
      case 'hours': return d.total_hours
      case 'drain': return d.drain_per_hour
      case 'sessions': return d.sessions
      case 'devices': return d.devices
      default: return d.total_hours
    }
  }))

  const getValue = (item: AppBatteryDrain) => {
    switch (currentSort) {
      case 'hours': return item.total_hours
      case 'drain': return item.drain_per_hour
      case 'sessions': return item.sessions
      case 'devices': return item.devices
      default: return item.total_hours
    }
  }

  const formatValue = (item: AppBatteryDrain) => {
    switch (currentSort) {
      case 'hours': return formatHours(item.total_hours)
      case 'drain': return formatDrain(item.drain_per_hour)
      case 'sessions': return item.sessions.toLocaleString()
      case 'devices': return item.devices.toString()
      default: return formatHours(item.total_hours)
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
            No app data available
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {currentSort === 'drain' 
                ? 'Battery drain rate per hour of usage' 
                : currentSort === 'hours'
                ? 'Total usage time across all devices'
                : currentSort === 'sessions'
                ? 'Number of app sessions'
                : 'Number of unique devices'}
            </CardDescription>
          </div>
          {onSortChange && (
            <Select
              options={[
                { value: 'hours', label: 'By Usage Time' },
                { value: 'drain', label: 'By Drain Rate' },
                { value: 'sessions', label: 'By Sessions' },
                { value: 'devices', label: 'By Devices' },
              ]}
              value={currentSort}
              onChange={(e) => onSortChange(e.target.value as 'hours' | 'drain' | 'sessions' | 'devices')}
              className="w-36"
            />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {data.map((item, i) => {
            const value = getValue(item)
            const percentage = maxValue > 0 ? (value / maxValue) * 100 : 0
            
            return (
              <div key={item.app_name} className="group">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground w-5">{i + 1}</span>
                    <span className="font-medium text-sm truncate max-w-[180px]" title={item.app_name}>
                      {item.app_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-muted-foreground">
                      {item.devices} device{item.devices !== 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold min-w-[60px] text-right" style={{ color: COLORS[currentSort] }}>
                      {formatValue(item)}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300"
                    style={{ 
                      width: `${percentage}%`,
                      backgroundColor: COLORS[currentSort]
                    }}
                  />
                </div>
                <div className="hidden group-hover:flex gap-4 mt-1 text-xs text-muted-foreground">
                  <span>Total: {formatHours(item.total_hours)}</span>
                  <span>Avg session: {item.avg_session_minutes.toFixed(1)}m</span>
                  <span>Drain: {formatDrain(item.drain_per_hour)}</span>
                  <span>Sessions: {item.sessions}</span>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
