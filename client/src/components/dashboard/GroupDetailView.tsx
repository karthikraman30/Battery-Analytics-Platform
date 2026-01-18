import { useMemo, useState } from 'react'
import { 
  ArrowLeft, 
  Battery, 
  Zap, 
  Clock, 
  Smartphone,
  ChevronUp,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChargingHeatmap } from '@/components/charts/ChargingHeatmap'
import { useDevices } from '@/hooks'
import { analyticsApi } from '@/lib/api'
import { useDataSource } from '@/contexts/DataSourceContext'
import { useQuery } from '@tanstack/react-query'

interface GroupDetailViewProps {
  groupId: string
  onBack: () => void
}

type SortField = 'device_id' | 'battery_events' | 'charging_sessions' | 'total_days'
type SortDirection = 'asc' | 'desc'

export function GroupDetailView({ groupId, onBack }: GroupDetailViewProps) {
  const { data: allDevices, isLoading } = useDevices()
  const { dataSource } = useDataSource()
  
  const [sortField, setSortField] = useState<SortField>('charging_sessions')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { data: chargingPatterns } = useQuery({
    queryKey: ['groupChargingPatterns', groupId, dataSource],
    queryFn: async () => {
      const response = await analyticsApi.getChargingPatterns(undefined, groupId, undefined, dataSource)
      return response.data
    },
  })

  const groupDevices = useMemo(() => {
    if (!allDevices) return []
    return allDevices.filter(d => d.group_id === groupId)
  }, [allDevices, groupId])

  const sortedDevices = useMemo(() => {
    if (!groupDevices.length) return []
    
    return [...groupDevices].sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal)
      }
      
      const diff = Number(aVal) - Number(bVal)
      return sortDirection === 'asc' ? diff : -diff
    })
  }, [groupDevices, sortField, sortDirection])

  const groupStats = useMemo(() => {
    if (!groupDevices.length) return null
    
    const totalEvents = groupDevices.reduce((s, d) => s + d.battery_events, 0)
    const totalSessions = groupDevices.reduce((s, d) => s + d.charging_sessions, 0)
    const avgDays = groupDevices.reduce((s, d) => s + d.total_days, 0) / groupDevices.length
    
    const dates = groupDevices.flatMap(d => [new Date(d.first_date), new Date(d.last_date)])
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())))
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())))
    
    return {
      deviceCount: groupDevices.length,
      totalEvents,
      totalSessions,
      avgDays,
      dateRange: `${minDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${maxDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    }
  }, [groupDevices])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="ml-1 h-3 w-3 opacity-30" />
    return sortDirection === 'asc' 
      ? <ChevronUp className="ml-1 h-3 w-3" />
      : <ChevronDown className="ml-1 h-3 w-3" />
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-[400px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Groups
        </button>
      </div>

      <div>
        <h2 className="text-2xl font-bold tracking-tight">Group {groupId}</h2>
        <p className="text-muted-foreground">
          Detailed analysis of {groupStats?.deviceCount ?? 0} devices in this research group
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Devices</CardTitle>
            <Smartphone className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupStats?.deviceCount ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              In this group
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Battery Events</CardTitle>
            <Battery className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupStats?.totalEvents.toLocaleString() ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Total recorded
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Charging Sessions</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupStats?.totalSessions.toLocaleString() ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              Complete cycles
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Data Days</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groupStats?.avgDays.toFixed(1) ?? 0}</div>
            <p className="text-xs text-muted-foreground">
              {groupStats?.dateRange ?? ''}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Devices in {groupId}</CardTitle>
          <CardDescription>
            Click column headers to sort
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th 
                    className="cursor-pointer px-3 py-3 text-left font-medium hover:bg-muted/50"
                    onClick={() => handleSort('device_id')}
                  >
                    <span className="flex items-center">
                      Device ID <SortIcon field="device_id" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('battery_events')}
                  >
                    <span className="flex items-center justify-end">
                      Battery Events <SortIcon field="battery_events" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('charging_sessions')}
                  >
                    <span className="flex items-center justify-end">
                      Charging Sessions <SortIcon field="charging_sessions" />
                    </span>
                  </th>
                  <th 
                    className="cursor-pointer px-3 py-3 text-right font-medium hover:bg-muted/50"
                    onClick={() => handleSort('total_days')}
                  >
                    <span className="flex items-center justify-end">
                      Data Days <SortIcon field="total_days" />
                    </span>
                  </th>
                  <th className="px-3 py-3 text-right font-medium">
                    Data Period
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedDevices.map((device, idx) => (
                  <tr 
                    key={device.device_id}
                    className={`border-b ${idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}`}
                  >
                    <td className="px-3 py-3 font-mono text-xs">{device.device_id}</td>
                    <td className="px-3 py-3 text-right">{device.battery_events.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">{device.charging_sessions.toLocaleString()}</td>
                    <td className="px-3 py-3 text-right">{device.total_days}</td>
                    <td className="px-3 py-3 text-right text-xs text-muted-foreground">
                      {new Date(device.first_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      {' - '}
                      {new Date(device.last_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {chargingPatterns && chargingPatterns.length > 0 && (
        <ChargingHeatmap 
          data={chargingPatterns}
          title={`Charging Patterns for ${groupId}`}
        />
      )}
    </div>
  )
}
