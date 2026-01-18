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

export function useOverallStats() {
  return useQuery({
    queryKey: ['overallStats'],
    queryFn: async () => {
      const response = await aggregatesApi.getStats()
      return response.data
    },
  })
}

export function useGlobalChargingPatterns() {
  return useQuery({
    queryKey: ['globalChargingPatterns'],
    queryFn: async () => {
      const response = await aggregatesApi.getChargingPatterns()
      return response.data
    },
  })
}

export function useTopApps(limit = 20) {
  return useQuery({
    queryKey: ['topApps', limit],
    queryFn: async () => {
      const response = await aggregatesApi.getTopApps(limit)
      return response.data
    },
  })
}

export function useGlobalBatteryDistribution() {
  return useQuery({
    queryKey: ['globalBatteryDistribution'],
    queryFn: async () => {
      const response = await aggregatesApi.getBatteryDistribution()
      return response.data
    },
  })
}

export function useBatteryBoxPlot(groupBy: 'device' | 'group' = 'device') {
  return useQuery({
    queryKey: ['batteryBoxPlot', groupBy],
    queryFn: async () => {
      const response = await aggregatesApi.getBatteryBoxPlot(groupBy)
      return response.data
    },
  })
}

export function useChargingDurationBoxPlot(groupBy: 'device' | 'group' = 'device') {
  return useQuery({
    queryKey: ['chargingDurationBoxPlot', groupBy],
    queryFn: async () => {
      const response = await aggregatesApi.getChargingDurationBoxPlot(groupBy)
      return response.data
    },
  })
}

export function useGroupStats() {
  return useQuery({
    queryKey: ['groupStats'],
    queryFn: async () => {
      const response = await aggregatesApi.getGroups()
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
  return useQuery({
    queryKey: ['appBatteryDrain', sortBy, limit, deviceId, groupId],
    queryFn: async () => {
      const response = await aggregatesApi.getAppBatteryDrain(sortBy, limit, deviceId, groupId)
      return response.data
    },
  })
}

export function useChargingByHour() {
  return useQuery({
    queryKey: ['chargingByHour'],
    queryFn: async () => {
      const response = await aggregatesApi.getChargingByHour()
      return response.data
    },
  })
}

export function useAppUsageByHour(topN = 5) {
  return useQuery({
    queryKey: ['appUsageByHour', topN],
    queryFn: async () => {
      const response = await aggregatesApi.getAppUsageByHour(topN)
      return response.data
    },
  })
}

export function useUserBehaviors() {
  return useQuery({
    queryKey: ['userBehaviors'],
    queryFn: async () => {
      const response = await aggregatesApi.getUserBehaviors()
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
