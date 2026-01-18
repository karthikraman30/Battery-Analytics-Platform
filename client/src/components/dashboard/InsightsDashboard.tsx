import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { BoxPlotChart } from '@/components/charts/BoxPlotChart'
import { AppBatteryDrainChart } from '@/components/charts/AppBatteryDrainChart'
import { ChargingByHourChart } from '@/components/charts/ChargingByHourChart'
import { ChargingHeatmap } from '@/components/charts/ChargingHeatmap'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { 
  useBatteryBoxPlot, 
  useAppBatteryDrain,
  useChargingByHour,
  useGlobalChargingPatterns,
  useUserBehaviors,
  useGroupStats,
} from '@/hooks/useAggregateStats'

export function InsightsDashboard() {
  const [boxPlotGroupBy, setBoxPlotGroupBy] = useState<'device' | 'group'>('device')
  const [appSortBy, setAppSortBy] = useState<'hours' | 'drain' | 'sessions' | 'devices'>('hours')
  
  const { data: boxPlotData, isLoading: boxPlotLoading } = useBatteryBoxPlot(boxPlotGroupBy)
  const { data: appDrainData, isLoading: appDrainLoading } = useAppBatteryDrain(appSortBy, 15)
  const { data: chargingByHour, isLoading: chargingByHourLoading } = useChargingByHour()
  const { data: chargingPatterns, isLoading: patternsLoading } = useGlobalChargingPatterns()
  const { data: userBehaviors, isLoading: behaviorsLoading } = useUserBehaviors()
  const { data: groupStats, isLoading: groupsLoading } = useGroupStats()

  const behaviorCounts = userBehaviors?.reduce((acc, u) => {
    acc[u.behavior_type] = (acc[u.behavior_type] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Insights & Analytics</h2>
        <p className="text-muted-foreground">
          Cross-device patterns, app impact analysis, and user behavior clusters
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Battery Level Distribution</h3>
            <Select
              options={[
                { value: 'device', label: 'By Device' },
                { value: 'group', label: 'By Group' },
              ]}
              value={boxPlotGroupBy}
              onChange={(e) => setBoxPlotGroupBy(e.target.value as 'device' | 'group')}
              className="w-32"
            />
          </div>
          {boxPlotLoading ? (
            <Skeleton className="h-[500px]" />
          ) : (
            <BoxPlotChart 
              data={boxPlotData ?? []}
              title="Battery Level Box Plot"
              description="Compare battery level distributions across devices/groups"
            />
          )}
        </div>

        <div>
          {appDrainLoading ? (
            <Skeleton className="h-[500px]" />
          ) : (
            <AppBatteryDrainChart 
              data={appDrainData ?? []}
              title="App Battery Impact"
              onSortChange={setAppSortBy}
              currentSort={appSortBy}
            />
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {chargingByHourLoading ? (
          <Skeleton className="h-[400px]" />
        ) : (
          <ChargingByHourChart 
            data={chargingByHour ?? []}
            title="When Do Users Charge?"
          />
        )}

        {patternsLoading ? (
          <Skeleton className="h-[400px]" />
        ) : (
          <ChargingHeatmap 
            data={chargingPatterns ?? []}
            title="Global Charging Patterns"
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>User Behavior Types</CardTitle>
            <CardDescription>Classification based on charging habits</CardDescription>
          </CardHeader>
          <CardContent>
            {behaviorsLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="space-y-3">
                {Object.entries(behaviorCounts).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ 
                          backgroundColor: type === 'Low Battery User' ? '#ef4444' 
                            : type === 'Anxious Charger' ? '#22c55e'
                            : type === 'Frequent Charger' ? '#f97316'
                            : '#6b7280'
                        }}
                      />
                      <span className="text-sm">{type}</span>
                    </div>
                    <span className="font-semibold">{count}</span>
                  </div>
                ))}
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  <p><strong>Low Battery User:</strong> Typically charges at &lt;25%</p>
                  <p><strong>Anxious Charger:</strong> Charges at &gt;50%</p>
                  <p><strong>Frequent Charger:</strong> Charges &gt;3x/day</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Group Statistics</CardTitle>
            <CardDescription>Data collection summary by research group</CardDescription>
          </CardHeader>
          <CardContent>
            {groupsLoading ? (
              <Skeleton className="h-32" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Group</th>
                      <th className="pb-2 font-medium text-right">Devices</th>
                      <th className="pb-2 font-medium text-right">Events</th>
                      <th className="pb-2 font-medium text-right">Sessions</th>
                      <th className="pb-2 font-medium text-right">Avg Battery</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groupStats?.slice(0, 10).map((group) => (
                      <tr key={group.group_id} className="border-b last:border-0">
                        <td className="py-2 truncate max-w-[150px]" title={group.group_id}>
                          {group.group_id}
                        </td>
                        <td className="py-2 text-right">{group.device_count}</td>
                        <td className="py-2 text-right">{group.battery_events.toLocaleString()}</td>
                        <td className="py-2 text-right">{group.charging_sessions}</td>
                        <td className="py-2 text-right">{group.avg_battery_level}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Insights</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold text-blue-500">
                {chargingByHour?.reduce((max, h) => h.sessions > max.sessions ? h : max, chargingByHour[0])?.hour || 0}:00
              </div>
              <div className="text-sm text-muted-foreground">Peak Charging Hour</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold text-red-500">
                {chargingByHour?.reduce((min, h) => h.avg_start_level < min.avg_start_level ? h : min, chargingByHour[0])?.avg_start_level?.toFixed(0) || 0}%
              </div>
              <div className="text-sm text-muted-foreground">Lowest Avg Start Level</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold text-green-500">
                {appDrainData?.[0]?.app_name || 'N/A'}
              </div>
              <div className="text-sm text-muted-foreground">Most Used App</div>
            </div>
            <div className="rounded-lg border p-4">
              <div className="text-2xl font-bold text-purple-500">
                {groupStats?.length || 0}
              </div>
              <div className="text-sm text-muted-foreground">Research Groups</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
