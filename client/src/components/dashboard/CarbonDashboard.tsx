import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { CarbonTrendsChart } from '@/components/charts/CarbonTrendsChart'
import {
  useCarbonSummary,
  useCarbonTrends,
  useCarbonComparisons,
  useCarbonByTimeOfDay,
  useCarbonByGroup,
  useCarbonInsights,
} from '@/hooks/useCarbonStats'
import type { CarbonInsight } from '@/lib/api'

function formatNumber(n: number, decimals = 2): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function InsightCard({ insight }: { insight: CarbonInsight }) {
  const bgColors = {
    tip: 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
    achievement: 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800',
    info: 'bg-muted border-border',
  }

  const icons = {
    tip: '💡',
    achievement: '🏆',
    warning: '⚠️',
    info: 'ℹ️',
  }

  return (
    <div className={`rounded-lg border p-4 ${bgColors[insight.type]}`}>
      <div className="flex items-start gap-3">
        <span className="text-xl">{icons[insight.type]}</span>
        <div className="flex-1">
          <div className="font-semibold text-sm">{insight.title}</div>
          <div className="text-sm text-muted-foreground mt-1">{insight.description}</div>
          {insight.metric && (
            <div className="text-lg font-bold mt-2">{insight.metric}</div>
          )}
          {insight.potential_savings_g && (
            <div className="text-xs text-green-600 dark:text-green-400 mt-1">
              Potential savings: {formatNumber(insight.potential_savings_g)}g CO2
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ComparisonCard({ label, value, unit, icon }: { label: string; value: number; unit: string; icon: string }) {
  return (
    <div className="rounded-lg border bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 p-4 text-center">
      <div className="text-3xl mb-2">{icon}</div>
      <div className="text-2xl font-bold text-green-700 dark:text-green-400">{formatNumber(value, 1)}</div>
      <div className="text-sm text-muted-foreground">{unit}</div>
      <div className="text-xs mt-1 text-green-600 dark:text-green-500">{label}</div>
    </div>
  )
}

function TimeOfDayBar({ data }: { data: { time_period: string; co2_kg: number; sessions: number }[] }) {
  const maxCO2 = Math.max(...data.map(d => d.co2_kg), 0.001)

  const periodColors: Record<string, string> = {
    'Night (12am-6am)': '#3b82f6',
    'Morning (6am-12pm)': '#f59e0b',
    'Afternoon (12pm-6pm)': '#ef4444',
    'Evening (6pm-12am)': '#8b5cf6',
  }

  return (
    <div className="space-y-3">
      {data.map((d) => (
        <div key={d.time_period}>
          <div className="flex justify-between text-sm mb-1">
            <span>{d.time_period}</span>
            <span className="font-medium">{formatNumber(d.co2_kg * 1000, 0)}g</span>
          </div>
          <div className="h-6 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.co2_kg / maxCO2) * 100}%`,
                backgroundColor: periodColors[d.time_period] || '#6b7280',
              }}
            />
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {d.sessions} sessions
          </div>
        </div>
      ))}
    </div>
  )
}

export function CarbonDashboard() {
  const { data: summary, isLoading: summaryLoading } = useCarbonSummary()
  const { data: trends, isLoading: trendsLoading } = useCarbonTrends()
  const { data: comparisons, isLoading: comparisonsLoading } = useCarbonComparisons()
  const { data: timeOfDay, isLoading: timeLoading } = useCarbonByTimeOfDay()
  const { data: groups, isLoading: groupsLoading } = useCarbonByGroup()
  const { data: insights, isLoading: insightsLoading } = useCarbonInsights()

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <span>🌍</span> Carbon Footprint
        </h2>
        <p className="text-muted-foreground">
          Environmental impact analysis from smartphone charging activity
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryLoading ? (
          <>
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </>
        ) : summary ? (
          <>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Total CO2 Emissions</CardDescription>
                <CardTitle className="text-3xl text-green-600 dark:text-green-400">
                  {formatNumber(summary.total_co2_kg)} kg
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  From {summary.total_sessions.toLocaleString()} charging sessions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Projected Annual (All Devices)</CardDescription>
                <CardTitle className="text-3xl text-amber-600 dark:text-amber-400">
                  {formatNumber(summary.projected_annual_kg)} kg
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Based on {summary.data_days} device-days of data
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Per Session Average</CardDescription>
                <CardTitle className="text-3xl text-blue-600 dark:text-blue-400">
                  {formatNumber(summary.avg_co2_per_session_g)} g
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Average charge: {formatNumber(summary.total_charge_gained / summary.total_sessions, 0)}%
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Devices Analyzed</CardDescription>
                <CardTitle className="text-3xl text-purple-600 dark:text-purple-400">
                  {summary.devices_count}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Over {summary.data_days} days collection period
                </p>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {trendsLoading ? (
            <Skeleton className="h-[400px]" />
          ) : (
            <CarbonTrendsChart data={trends ?? []} />
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Environmental Equivalents</CardTitle>
            <CardDescription>What {formatNumber(summary?.total_co2_kg ?? 0)} kg CO2 equals</CardDescription>
          </CardHeader>
          <CardContent>
            {comparisonsLoading ? (
              <Skeleton className="h-48" />
            ) : comparisons ? (
              <div className="grid grid-cols-2 gap-3">
                <ComparisonCard
                  label="Distance driven"
                  value={comparisons.driving_km}
                  unit="km"
                  icon="🚗"
                />
                <ComparisonCard
                  label="Trees to offset (1 year)"
                  value={comparisons.trees_to_offset}
                  unit="trees"
                  icon="🌳"
                />
                <ComparisonCard
                  label="LED bulb hours"
                  value={comparisons.led_bulb_hours}
                  unit="hours"
                  icon="💡"
                />
                <ComparisonCard
                  label="Video streaming"
                  value={comparisons.streaming_hours}
                  unit="hours"
                  icon="📺"
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Emissions by Time of Day</CardTitle>
            <CardDescription>When is the most carbon generated?</CardDescription>
          </CardHeader>
          <CardContent>
            {timeLoading ? (
              <Skeleton className="h-48" />
            ) : timeOfDay ? (
              <TimeOfDayBar data={timeOfDay} />
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emissions by Group</CardTitle>
            <CardDescription>Carbon footprint by research group</CardDescription>
          </CardHeader>
          <CardContent>
            {groupsLoading ? (
              <Skeleton className="h-48" />
            ) : groups ? (
                <div className="space-y-2 max-h-[250px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b text-left">
                      <th className="pb-2 font-medium">Group</th>
                      <th className="pb-2 font-medium text-right">CO2 (kg)</th>
                      <th className="pb-2 font-medium text-right">Devices</th>
                      <th className="pb-2 font-medium text-right">Per Device (g)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groups.map((g) => (
                      <tr key={g.group_id} className="border-b last:border-0">
                        <td className="py-2 truncate max-w-[120px]" title={g.group_id}>
                          {g.group_id}
                        </td>
                        <td className="py-2 text-right font-medium text-green-600 dark:text-green-400">
                          {formatNumber(g.co2_kg)}
                        </td>
                        <td className="py-2 text-right">{g.devices}</td>
                        <td className="py-2 text-right">{formatNumber(g.avg_co2_per_device_g, 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Insights & Recommendations</CardTitle>
          <CardDescription>Personalized tips based on charging behavior patterns</CardDescription>
        </CardHeader>
        <CardContent>
          {insightsLoading ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : insights ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {insights.map((insight, i) => (
                <InsightCard key={i} insight={insight} />
              ))}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800">
        <CardContent className="pt-6">
          <div className="text-center">
            <div className="text-4xl mb-2">🌱</div>
            <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">Did You Know?</h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-2 max-w-2xl mx-auto">
              The average smartphone charging session uses about 14.8 Wh of energy,
              costing approximately {formatNumber(summary?.avg_co2_per_session_g ?? 4.5)}g of CO2.
              While this seems small, with billions of smartphones worldwide,
              optimizing charging habits can have a meaningful collective impact.
            </p>
            <div className="mt-4 flex justify-center gap-4 text-xs text-green-600 dark:text-green-500">
              <span>📊 Based on India's grid: 663 gCO2/kWh</span>
              <span>🔋 Battery: 4000mAh @ 3.7V</span>
              <span>⚡ Efficiency: 85%</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
