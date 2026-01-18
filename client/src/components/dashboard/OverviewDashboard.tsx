import { Battery, Smartphone, Zap, Clock, AppWindow, TrendingUp } from 'lucide-react'
import { StatsCard } from './StatsCard'
import { ChargingHeatmap } from '@/components/charts/ChargingHeatmap'
import { AppUsageChart } from '@/components/charts/AppUsageChart'
import { BatteryDistributionChart } from '@/components/charts/BatteryDistributionChart'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  useOverallStats, 
  useGlobalChargingPatterns, 
  useTopApps, 
  useGlobalBatteryDistribution 
} from '@/hooks'

export function OverviewDashboard() {
  const { data: stats, isLoading: statsLoading } = useOverallStats()
  const { data: patterns, isLoading: patternsLoading } = useGlobalChargingPatterns()
  const { data: topApps, isLoading: appsLoading } = useTopApps(15)
  const { data: distribution, isLoading: distLoading } = useGlobalBatteryDistribution()

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Overview</h2>
        <p className="text-muted-foreground">
          Aggregate statistics across all {stats?.total_devices} devices
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatsCard
          title="Total Devices"
          value={stats?.total_devices ?? 0}
          description={`Across ${stats?.total_groups ?? 0} groups`}
          icon={<Smartphone className="h-5 w-5" />}
        />
        <StatsCard
          title="Battery Events"
          value={(stats?.total_battery_events ?? 0).toLocaleString()}
          description="Total charging events recorded"
          icon={<Battery className="h-5 w-5" />}
        />
        <StatsCard
          title="Charging Sessions"
          value={(stats?.total_charging_sessions ?? 0).toLocaleString()}
          description="Complete charge cycles"
          icon={<Zap className="h-5 w-5" />}
        />
        <StatsCard
          title="App Events"
          value={(stats?.total_app_events ?? 0).toLocaleString()}
          description="Foreground app usage events"
          icon={<AppWindow className="h-5 w-5" />}
        />
        <StatsCard
          title="Avg Charges/Day"
          value={stats?.avg_charge_frequency?.toFixed(1) ?? '0'}
          description="Average charging frequency"
          icon={<TrendingUp className="h-5 w-5" />}
        />
        <StatsCard
          title="Avg Session Duration"
          value={`${Math.round(stats?.avg_session_duration ?? 0)} min`}
          description="Average time plugged in"
          icon={<Clock className="h-5 w-5" />}
        />
        <StatsCard
          title="Avg Battery at Charge"
          value={`${Math.round(stats?.avg_battery_at_charge ?? 0)}%`}
          description="When users typically plug in"
          icon={<Battery className="h-5 w-5" />}
        />
        <StatsCard
          title="Data Coverage"
          value={`${stats?.total_devices ?? 0} users`}
          description="7-14 days per user"
          icon={<Smartphone className="h-5 w-5" />}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {patternsLoading ? (
          <Skeleton className="h-96" />
        ) : (
          <ChargingHeatmap 
            data={patterns ?? []} 
            title="Global Charging Patterns"
          />
        )}
        
        {distLoading ? (
          <Skeleton className="h-80" />
        ) : (
          <BatteryDistributionChart 
            data={distribution ?? []} 
            title="Battery Level at Charge Start"
          />
        )}
      </div>

      <div>
        {appsLoading ? (
          <Skeleton className="h-[500px]" />
        ) : (
          <AppUsageChart 
            data={topApps ?? []} 
            title="Most Used Apps (All Users)"
            maxItems={15}
          />
        )}
      </div>
    </div>
  )
}
