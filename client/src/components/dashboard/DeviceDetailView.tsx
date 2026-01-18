import { useState, useMemo } from 'react'
import { Battery, Zap, Clock, Calendar } from 'lucide-react'
import { DeviceSelector, parseDeviceKey, makeDeviceKey } from './DeviceSelector'
import { StatsCard } from './StatsCard'
import { BatteryTimeSeriesChart } from '@/components/charts/BatteryTimeSeriesChart'
import { ChargingSessionsChart } from '@/components/charts/ChargingSessionsChart'
import { ChargingHeatmap } from '@/components/charts/ChargingHeatmap'
import { AppUsageChart } from '@/components/charts/AppUsageChart'
import { BatteryDistributionChart } from '@/components/charts/BatteryDistributionChart'
import { Skeleton } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { DateRangePicker, type DateRange } from '@/components/ui/date-range-picker'
import { 
  useDevices,
  useBatteryTimeSeries,
  useChargingSessions,
  useChargingStats,
  useChargingPatterns,
  useAppUsage,
  useBatteryDistribution,
} from '@/hooks'

type Granularity = 'raw' | 'hour' | 'day'

export function DeviceDetailView() {
  const [selectedDeviceKey, setSelectedDeviceKey] = useState<string | null>(null)
  const [granularity, setGranularity] = useState<Granularity>('raw')
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null })
  
  const { data: devices, isLoading: devicesLoading } = useDevices()
  
  const parsedKey = useMemo(() => 
    selectedDeviceKey ? parseDeviceKey(selectedDeviceKey) : null
  , [selectedDeviceKey])

  // Convert DateRange to DateRangeParams for API calls
  const dateRangeParams = useMemo(() => ({
    startDate: dateRange.startDate || undefined,
    endDate: dateRange.endDate || undefined
  }), [dateRange.startDate, dateRange.endDate])
  
  const { data: batteryData, isLoading: batteryLoading } = useBatteryTimeSeries(
    parsedKey?.deviceId ?? null, 
    parsedKey?.groupId ?? null,
    granularity,
    dateRangeParams
  )
  const { data: sessions, isLoading: sessionsLoading } = useChargingSessions(
    parsedKey?.deviceId ?? null,
    parsedKey?.groupId ?? null,
    dateRangeParams
  )
  const { data: stats, isLoading: statsLoading } = useChargingStats(
    parsedKey?.deviceId ?? null,
    parsedKey?.groupId ?? null,
    dateRangeParams
  )
  const { data: patterns, isLoading: patternsLoading } = useChargingPatterns(
    parsedKey?.deviceId ?? null,
    parsedKey?.groupId ?? null,
    dateRangeParams
  )
  const { data: appUsage, isLoading: appsLoading } = useAppUsage(
    parsedKey?.deviceId ?? null,
    parsedKey?.groupId ?? null,
    15,
    dateRangeParams
  )
  const { data: distribution, isLoading: distLoading } = useBatteryDistribution(
    parsedKey?.deviceId ?? null,
    parsedKey?.groupId ?? null,
    dateRangeParams
  )

  const selectedDevice = devices?.find(d => 
    d.device_id === parsedKey?.deviceId && d.group_id === parsedKey?.groupId
  )

  if (!selectedDeviceKey && devices && devices.length > 0) {
    setSelectedDeviceKey(makeDeviceKey(devices[0].device_id, devices[0].group_id))
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Device Analytics</h2>
          <p className="text-muted-foreground">
            Detailed analysis for individual devices
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <DeviceSelector
            devices={devices ?? []}
            selectedDeviceId={selectedDeviceKey}
            onDeviceChange={setSelectedDeviceKey}
            isLoading={devicesLoading}
          />
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-muted-foreground">
              Granularity:
            </label>
            <Select
              options={[
                { value: 'raw', label: 'Raw Events' },
                { value: 'hour', label: 'Hourly' },
                { value: 'day', label: 'Daily' },
              ]}
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as Granularity)}
              className="w-32"
            />
          </div>
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            minDate={selectedDevice?.first_date}
            maxDate={selectedDevice?.last_date}
          />
        </div>
      </div>

      {!selectedDeviceKey ? (
        <div className="flex h-64 items-center justify-center rounded-lg border border-dashed">
          <p className="text-muted-foreground">Select a device to view analytics</p>
        </div>
      ) : (
        <>
          {statsLoading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatsCard
                title="Total Sessions"
                value={stats?.total_sessions ?? 0}
                description={`${stats?.complete_sessions ?? 0} complete`}
                icon={<Zap className="h-5 w-5" />}
              />
              <StatsCard
                title="Avg Duration"
                value={`${Math.round(stats?.avg_duration_minutes ?? 0)} min`}
                description="Per charging session"
                icon={<Clock className="h-5 w-5" />}
              />
              <StatsCard
                title="Avg Start Level"
                value={`${Math.round(stats?.avg_start_level ?? 0)}%`}
                description="When plugged in"
                icon={<Battery className="h-5 w-5" />}
              />
              <StatsCard
                title="Avg Charge Gained"
                value={`+${Math.round(stats?.avg_charge_gained ?? 0)}%`}
                description="Per session"
                icon={<Battery className="h-5 w-5" />}
              />
            </div>
          )}

          {selectedDevice && (
            <div className="rounded-lg border bg-muted/50 px-4 py-2">
              <div className="flex flex-wrap gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Date range:</span>
                  <span className="font-medium">{selectedDevice.first_date} to {selectedDevice.last_date}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Group:</span>
                  <span className="font-medium">{selectedDevice.group_id}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Battery events:</span>
                  <span className="font-medium">{selectedDevice.battery_events.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          <div>
            {batteryLoading ? (
              <Skeleton className="h-[450px]" />
            ) : (
              <BatteryTimeSeriesChart 
                data={batteryData ?? []}
                title={`Battery Level - ${granularity === 'raw' ? 'Raw Events' : granularity === 'hour' ? 'Hourly Average' : 'Daily Average'}`}
              />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {sessionsLoading ? (
              <Skeleton className="h-[450px]" />
            ) : (
              <ChargingSessionsChart 
                data={sessions ?? []}
                title="Charging Sessions"
              />
            )}
            
            {patternsLoading ? (
              <Skeleton className="h-96" />
            ) : (
              <ChargingHeatmap 
                data={patterns ?? []}
                title="Charging Patterns"
              />
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {distLoading ? (
              <Skeleton className="h-80" />
            ) : (
              <BatteryDistributionChart 
                data={distribution ?? []}
                title="Battery Level Distribution"
              />
            )}
            
            {appsLoading ? (
              <Skeleton className="h-[500px]" />
            ) : (
              <AppUsageChart 
                data={appUsage ?? []}
                title="Top Apps"
                maxItems={10}
              />
            )}
          </div>
        </>
      )}
    </div>
  )
}
