import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import type { ChargingPattern } from '@/lib/api'

interface ChargingHeatmapProps {
  data: ChargingPattern[]
  title?: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const HOURS = Array.from({ length: 24 }, (_, i) => 
  i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
)

export function ChargingHeatmap({ data, title = "Charging Patterns" }: ChargingHeatmapProps) {
  const matrix: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0))
  
  let maxCount = 0
  data.forEach(pattern => {
    const dayIndex = pattern.day_of_week
    const hourIndex = pattern.hour_of_day
    if (dayIndex >= 0 && dayIndex < 7 && hourIndex >= 0 && hourIndex < 24) {
      matrix[dayIndex][hourIndex] = pattern.charge_count
      maxCount = Math.max(maxCount, pattern.charge_count)
    }
  })

  const getColor = (value: number): string => {
    if (maxCount === 0) return 'rgba(59, 130, 246, 0.1)'
    const intensity = value / maxCount
    return `rgba(59, 130, 246, ${intensity * 0.85 + 0.1})`
  }

  const getTextColor = (value: number): string => {
    if (maxCount === 0) return 'inherit'
    return value / maxCount > 0.5 ? 'white' : 'inherit'
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>When do users typically charge their phones?</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex h-48 items-center justify-center text-muted-foreground">
            No charging pattern data available
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
          Hour of day vs day of week charging frequency (darker = more charges)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="inline-block">
            <div className="flex">
              <div className="w-10" />
              {HOURS.map((hour) => (
                <div 
                  key={hour} 
                  className="w-7 text-center text-[10px] text-muted-foreground pb-1"
                >
                  {hour}
                </div>
              ))}
            </div>
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="flex items-center">
                <div className="w-10 text-xs text-muted-foreground pr-2 text-right">
                  {day}
                </div>
                {HOURS.map((_, hourIndex) => {
                  const value = matrix[dayIndex][hourIndex]
                  return (
                    <div
                      key={hourIndex}
                      className="w-7 h-7 flex items-center justify-center text-[10px] rounded-sm m-[1px] cursor-default transition-transform hover:scale-110"
                      style={{
                        backgroundColor: getColor(value),
                        color: getTextColor(value),
                      }}
                      title={`${day} ${HOURS[hourIndex]}: ${value} charges`}
                    >
                      {value > 0 ? value : ''}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="flex gap-0.5">
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((intensity) => (
              <div
                key={intensity}
                className="h-3 w-3 rounded-sm"
                style={{ background: `rgba(59, 130, 246, ${intensity})` }}
              />
            ))}
          </div>
          <span>More</span>
        </div>
      </CardContent>
    </Card>
  )
}
