import { useState, useMemo } from 'react'
import { 
  Users, 
  Battery, 
  Clock, 
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
  Leaf,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useGroupStats } from '@/hooks'
import { useCarbonByGroup } from '@/hooks/useCarbonStats'
import type { GroupStats, CarbonByGroup } from '@/lib/api'
import { GroupDetailView } from './GroupDetailView'

type SortField = 'group_id' | 'device_count' | 'battery_events' | 'charging_sessions' | 'avg_battery_level' | 'avg_charge_gained' | 'avg_session_duration' | 'co2_kg'
type SortDirection = 'asc' | 'desc'

interface GroupWithCarbon extends GroupStats {
  co2_kg?: number
  co2_per_device?: number
}

export function GroupAnalyticsDashboard() {
  const { data: groups, isLoading: groupsLoading } = useGroupStats()
  const { data: carbonByGroup } = useCarbonByGroup()
  
  const [sortField, setSortField] = useState<SortField>('device_count')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null)

  const groupsWithCarbon = useMemo(() => {
    if (!groups) return []
    
    const carbonMap = new Map<string, CarbonByGroup>()
    carbonByGroup?.forEach(c => carbonMap.set(c.group_id, c))
    
    return groups.map(g => ({
      ...g,
      co2_kg: carbonMap.get(g.group_id)?.co2_kg ?? 0,
      co2_per_device: carbonMap.get(g.group_id)?.avg_co2_per_device_g ?? 0,
    }))
  }, [groups, carbonByGroup])

  const sortedGroups = useMemo(() => {
    if (!groupsWithCarbon.length) return []
    
    return [...groupsWithCarbon].sort((a, b) => {
      let aVal: number | string = a[sortField as keyof GroupWithCarbon] ?? 0
      let bVal: number | string = b[sortField as keyof GroupWithCarbon] ?? 0
      
      if (sortField === 'group_id') {
        const aNum = parseInt(String(aVal).replace(/\D/g, '')) || 0
        const bNum = parseInt(String(bVal).replace(/\D/g, '')) || 0
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }
      
      const diff = Number(aVal) - Number(bVal)
      return sortDirection === 'asc' ? diff : -diff
    })
  }, [groupsWithCarbon, sortField, sortDirection])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const summaryStats = useMemo(() => {
    if (!groupsWithCarbon.length) return null
    
    const totalDevices = groupsWithCarbon.reduce((s, g) => s + g.device_count, 0)
    const totalSessions = groupsWithCarbon.reduce((s, g) => s + g.charging_sessions, 0)
    const totalEvents = groupsWithCarbon.reduce((s, g) => s + g.battery_events, 0)
    const totalCO2 = groupsWithCarbon.reduce((s, g) => s + (g.co2_kg ?? 0), 0)
    const avgBatteryLevel = groupsWithCarbon.reduce((s, g) => s + g.avg_battery_level * g.device_count, 0) / totalDevices
    const avgSessionDuration = groupsWithCarbon.reduce((s, g) => s + g.avg_session_duration * g.charging_sessions, 0) / totalSessions
    
    return {
      totalGroups: groupsWithCarbon.length,
      totalDevices,
      totalSessions,
      totalEvents,
      totalCO2,
      avgBatteryLevel,
      avgSessionDuration,
    }
  }, [groupsWithCarbon])

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
    return sortDirection === 'asc' 
      ? <ChevronUp className="ml-1 h-3 w-3" />
      : <ChevronDown className="ml-1 h-3 w-3" />
  }

  if (selectedGroup) {
    return (
      <GroupDetailView 
        groupId={selectedGroup} 
        onBack={() => setSelectedGroup(null)} 
      />
    )
  }

  if (groupsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[600px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Group Analysis</h2>
        <p className="text-muted-foreground">
          Comparative analysis across {summaryStats?.totalGroups ?? 0} research groups
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Groups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats?.totalGroups ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {summaryStats?.totalDevices ?? 0} devices total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Battery at Charge</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats?.avgBatteryLevel.toFixed(1) ?? 0}%</div>
            <p className="text-xs text-muted-foreground">
              Across all groups
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Session Duration</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats?.avgSessionDuration.toFixed(0) ?? 0} min</div>
            <p className="text-xs text-muted-foreground">
              {summaryStats?.totalSessions.toLocaleString() ?? 0} total sessions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CO₂ Emissions</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summaryStats?.totalCO2.toFixed(2) ?? 0} kg</div>
            <p className="text-xs text-muted-foreground">
              From charging activity
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Group Comparison</CardTitle>
          <CardDescription>
            Click on a group to view detailed device-level analysis. Click column headers to sort.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th 
                    className="cursor-pointer px-3 py-3 text-left font-medium hover:bg-muted/50"
                    onClick={() => handleSort('group_id')}
                  >
                    <span className="flex items-center">
                      Group <SortIcon field="group_id" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('device_count')}
                  >
                    <span className="flex items-center justify-end">
                      Devices <SortIcon field="device_count" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('charging_sessions')}
                  >
                    <span className="flex items-center justify-end">
                      Sessions <SortIcon field="charging_sessions" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('avg_battery_level')}
                  >
                    <span className="flex items-center justify-end">
                      Avg Battery <SortIcon field="avg_battery_level" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('avg_charge_gained')}
                  >
                    <span className="flex items-center justify-end">
                      Avg Charge Gained <SortIcon field="avg_charge_gained" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('avg_session_duration')}
                  >
                    <span className="flex items-center justify-end">
                      Avg Duration <SortIcon field="avg_session_duration" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('co2_kg')}
                  >
                    <span className="flex items-center justify-end">
                      CO₂ (kg) <SortIcon field="co2_kg" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Data Period
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedGroups.map((group, idx) => (
                  <tr 
                    key={group.group_id}
                    className={`cursor-pointer border-b transition-colors hover:bg-muted/50 ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                    onClick={() => setSelectedGroup(group.group_id)}
                  >
                    <td className="px-3 py-3 font-medium">{group.group_id}</td>
                    <td className="px-3 py-3 text-right">{group.device_count}</td>
                    <td className="px-3 py-3 text-right">{group.charging_sessions.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">
                      <span className={group.avg_battery_level < 30 ? 'text-red-500' : group.avg_battery_level > 60 ? 'text-green-500' : ''}>
                        {group.avg_battery_level.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">{group.avg_charge_gained.toFixed(1)}%</td>
                    <td className="px-3 py-3 text-right">{group.avg_session_duration.toFixed(0)} min</td>
                    <td className="px-3 py-3 text-right">{group.co2_kg?.toFixed(3) ?? '—'}</td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                      {new Date(group.first_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' - '}
                      {new Date(group.last_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <GroupMetricChart 
          groups={sortedGroups} 
          metric="avg_battery_level"
          title="Average Battery Level at Charge Start"
          description="Lower values indicate users wait longer before charging"
          unit="%"
          colorScale="battery"
        />
        <GroupMetricChart 
          groups={sortedGroups} 
          metric="avg_session_duration"
          title="Average Charging Session Duration"
          description="Time spent charging per session"
          unit=" min"
          colorScale="neutral"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GroupMetricChart 
          groups={sortedGroups} 
          metric="avg_charge_gained"
          title="Average Charge Gained per Session"
          description="How much battery is typically gained per charge"
          unit="%"
          colorScale="neutral"
        />
        <GroupMetricChart 
          groups={sortedGroups} 
          metric="co2_kg"
          title="Total CO₂ Emissions by Group"
          description="Carbon footprint from charging activity"
          unit=" kg"
          colorScale="carbon"
        />
      </div>
    </div>
  )
}

interface GroupMetricChartProps {
  groups: GroupWithCarbon[]
  metric: keyof GroupWithCarbon
  title: string
  description: string
  unit: string
  colorScale: 'battery' | 'carbon' | 'neutral'
}

function GroupMetricChart({ groups, metric, title, description, unit, colorScale }: GroupMetricChartProps) {
  const sortedByMetric = useMemo(() => {
    return [...groups].sort((a, b) => {
      const aVal = Number(a[metric]) || 0
      const bVal = Number(b[metric]) || 0
      return bVal - aVal
    }).slice(0, 15)
  }, [groups, metric])

  const maxValue = Math.max(...sortedByMetric.map(g => Number(g[metric]) || 0))

  const getBarColor = (value: number) => {
    if (colorScale === 'battery') {
      if (value < 30) return 'bg-red-500'
      if (value < 50) return 'bg-orange-500'
      if (value < 70) return 'bg-yellow-500'
      return 'bg-green-500'
    }
    if (colorScale === 'carbon') {
      const intensity = value / maxValue
      if (intensity > 0.7) return 'bg-red-500'
      if (intensity > 0.4) return 'bg-orange-500'
      return 'bg-green-500'
    }
    return 'bg-primary'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {sortedByMetric.map(group => {
            const value = Number(group[metric]) || 0
            const width = maxValue > 0 ? (value / maxValue) * 100 : 0
            
            return (
              <div key={group.group_id} className="flex items-center gap-2">
                <div className="w-16 text-sm font-medium">{group.group_id}</div>
                <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                  <div 
                    className={`h-full ${getBarColor(value)} transition-all`}
                    style={{ width: `${width}%` }}
                  />
                </div>
                <div className="w-20 text-right text-sm">
                  {metric === 'co2_kg' ? value.toFixed(3) : value.toFixed(1)}{unit}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
