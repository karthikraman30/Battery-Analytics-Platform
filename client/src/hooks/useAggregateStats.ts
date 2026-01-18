import { useQuery } from '@tanstack/react-query'
import { aggregatesApi } from '@/lib/api'
import type { 
  OverallStats, 
  ChargingPattern, 
  AppUsage, 
  BatteryDistribution,
  BoxPlotStats,
  ChargingDurationStats,
  GroupStats,
  AppBatteryDrain,
  ChargingByHour,
  AppUsageByHour,
  UserBehavior,
} from '@/lib/api'
import { useDataSource } from '@/contexts/DataSourceContext'

export function useOverallStats() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['overallStats', dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getStats(dataSource)
      return response.data
    },
  })
}

export function useGlobalChargingPatterns() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['globalChargingPatterns', dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getChargingPatterns(dataSource)
      return response.data
    },
  })
}

export function useTopApps(limit = 20) {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['topApps', limit, dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getTopApps(limit, dataSource)
      return response.data
    },
  })
}

export function useGlobalBatteryDistribution() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['globalBatteryDistribution', dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getBatteryDistribution(dataSource)
      return response.data
    },
  })
}

export function useBatteryBoxPlot(groupBy: 'device' | 'group' = 'device') {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['batteryBoxPlot', groupBy, dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getBatteryBoxPlot(groupBy, dataSource)
      return response.data
    },
  })
}

export function useChargingDurationBoxPlot(groupBy: 'device' | 'group' = 'device') {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['chargingDurationBoxPlot', groupBy, dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getChargingDurationBoxPlot(groupBy, dataSource)
      return response.data
    },
  })
}

export function useGroupStats() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['groupStats', dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getGroups(dataSource)
      return response.data
    },
  })
}

export function useAppBatteryDrain(
  sortBy: 'hours' | 'drain' | 'sessions' | 'devices' = 'hours',
  limit = 20,
  deviceId?: string,
  groupId?: string
) {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['appBatteryDrain', sortBy, limit, deviceId, groupId, dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getAppBatteryDrain(sortBy, limit, deviceId, groupId, dataSource)
      return response.data
    },
  })
}

export function useChargingByHour() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['chargingByHour', dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getChargingByHour(dataSource)
      return response.data
    },
  })
}

export function useAppUsageByHour(topN = 5) {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['appUsageByHour', topN, dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getAppUsageByHour(topN, dataSource)
      return response.data
    },
  })
}

export function useUserBehaviors() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['userBehaviors', dataSource],
    queryFn: async () => {
      const response = await aggregatesApi.getUserBehaviors(dataSource)
      return response.data
    },
  })
}

export type { 
  OverallStats, 
  ChargingPattern, 
  AppUsage, 
  BatteryDistribution,
  BoxPlotStats,
  ChargingDurationStats,
  GroupStats,
  AppBatteryDrain,
  ChargingByHour,
  AppUsageByHour,
  UserBehavior,
}
