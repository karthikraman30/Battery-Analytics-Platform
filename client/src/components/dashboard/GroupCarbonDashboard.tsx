import { useMemo } from 'react'
import { Leaf, TrendingUp, Zap, Clock, AlertTriangle, CheckCircle, Info, Lightbulb } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { 
  useCarbonSummary, 
  useCarbonByGroup, 
  useCarbonByTimeOfDay,
  useCarbonInsights,
  useCarbonComparisons,
} from '@/hooks/useCarbonStats'
import type { CarbonInsight } from '@/lib/api'

export function GroupCarbonDashboard() {
  const { data: summary, isLoading: summaryLoading } = useCarbonSummary()
  const { data: byGroup, isLoading: groupLoading } = useCarbonByGroup()
  const { data: byTimeOfDay, isLoading: timeLoading } = useCarbonByTimeOfDay()
  const { data: insights } = useCarbonInsights()
  const { data: comparisons } = useCarbonComparisons()

  const sortedGroups = useMemo(() => {
    if (!byGroup) return []
    return [...byGroup].sort((a, b) => b.co2_kg - a.co2_kg)
  }, [byGroup])

  const maxCO2 = useMemo(() => {
    if (!sortedGroups.length) return 1
    return Math.max(...sortedGroups.map(g => g.co2_kg))
  }, [sortedGroups])

  if (summaryLoading) {
    return (
      <div className="space-y-6">
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Carbon Footprint Analysis</h2>
        <p className="text-muted-foreground">
          CO₂ emissions from smartphone charging across {summary?.devices_count ?? 0} devices
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total CO₂ Emissions</CardTitle>
            <Leaf className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.total_co2_kg.toFixed(2) ?? 0} kg</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_co2_grams.toFixed(0) ?? 0} grams total
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per Session</CardTitle>
            <Zap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.avg_co2_per_session_g.toFixed(2) ?? 0} g</div>
            <p className="text-xs text-muted-foreground">
              {summary?.total_sessions.toLocaleString() ?? 0} charging sessions
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projected Annual</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.projected_annual_kg.toFixed(1) ?? 0} kg</div>
            <p className="text-xs text-muted-foreground">
              If current patterns continue
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Coverage</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary?.data_days ?? 0} days</div>
            <p className="text-xs text-muted-foreground">
              {summary?.devices_count ?? 0} devices tracked
            </p>
          </CardContent>
        </Card>
      </div>

      {comparisons && (
        <Card>
          <CardHeader>
            <CardTitle>Environmental Equivalents</CardTitle>
            <CardDescription>
              {summary?.total_co2_kg.toFixed(2)} kg of CO₂ is equivalent to:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{comparisons.driving_km.toFixed(1)}</div>
                <div className="text-sm text-muted-foreground">km of driving</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{comparisons.trees_to_offset.toFixed(3)}</div>
                <div className="text-sm text-muted-foreground">trees (annual offset)</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{comparisons.led_bulb_hours.toLocaleString()}</div>
                <div className="text-sm text-muted-foreground">LED bulb hours</div>
              </div>
              <div className="text-center p-4 bg-muted/50 rounded-lg">
                <div className="text-2xl font-bold">{comparisons.streaming_hours.toFixed(0)}</div>
                <div className="text-sm text-muted-foreground">streaming hours</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>CO₂ Emissions by Group</CardTitle>
            <CardDescription>
              Total carbon footprint per research group
            </CardDescription>
          </CardHeader>
          <CardContent>
            {groupLoading ? (
              <Skeleton className="h-[400px]" />
            ) : (
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {sortedGroups.map(group => {
                  const width = (group.co2_kg / maxCO2) * 100
                  const intensity = group.co2_kg / maxCO2
                  
                  return (
                    <div key={group.group_id} className="flex items-center gap-2">
                      <div className="w-16 text-sm font-medium">{group.group_id}</div>
                      <div className="flex-1 h-6 bg-muted rounded overflow-hidden">
                        <div 
                          className={`h-full transition-all ${
                            intensity > 0.7 ? 'bg-red-500' :
                            intensity > 0.4 ? 'bg-orange-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="w-24 text-right text-sm">
                        {group.co2_kg.toFixed(3)} kg
                      </div>
                      <div className="w-16 text-right text-xs text-muted-foreground">
                        {group.devices} dev
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Emissions by Time of Day</CardTitle>
            <CardDescription>
              When does most charging (and CO₂ emission) occur?
            </CardDescription>
          </CardHeader>
          <CardContent>
            {timeLoading ? (
              <Skeleton className="h-[400px]" />
            ) : (
              <div className="space-y-4">
                {byTimeOfDay?.map(period => {
                  const maxPeriodCO2 = Math.max(...(byTimeOfDay?.map(p => p.co2_kg) ?? [1]))
                  const width = (period.co2_kg / maxPeriodCO2) * 100
                  
                  return (
                    <div key={period.time_period} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="font-medium">{period.time_period}</span>
                        <span>{period.co2_kg.toFixed(3)} kg</span>
                      </div>
                      <div className="h-8 bg-muted rounded overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{period.sessions.toLocaleString()} sessions</span>
                        <span>Avg start: {period.avg_start_level.toFixed(0)}%</span>
                        <span>Avg gained: {period.avg_charge_gained.toFixed(1)}%</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {insights && insights.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Insights & Recommendations</CardTitle>
            <CardDescription>
              Analysis of charging behavior and potential optimizations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              {insights.map((insight, idx) => (
                <InsightCard key={idx} insight={insight} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InsightCard({ insight }: { insight: CarbonInsight }) {
  const icons = {
    tip: <Lightbulb className="h-5 w-5 text-blue-500" />,
    achievement: <CheckCircle className="h-5 w-5 text-green-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-orange-500" />,
    info: <Info className="h-5 w-5 text-muted-foreground" />,
  }
  
  const bgColors = {
    tip: 'bg-blue-500/10 border-blue-500/20',
    achievement: 'bg-green-500/10 border-green-500/20',
    warning: 'bg-orange-500/10 border-orange-500/20',
    info: 'bg-muted/50 border-muted',
  }

  return (
    <div className={`p-4 rounded-lg border ${bgColors[insight.type]}`}>
      <div className="flex items-start gap-3">
        {icons[insight.type]}
        <div className="flex-1">
          <div className="font-medium">{insight.title}</div>
          <p className="text-sm text-muted-foreground mt-1">{insight.description}</p>
          {insight.metric && (
            <div className="mt-2 text-sm font-medium">{insight.metric}</div>
          )}
          {insight.potential_savings_g && (
            <div className="mt-2 text-sm text-green-600">
              Potential savings: {insight.potential_savings_g.toLocaleString()}g CO₂
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
