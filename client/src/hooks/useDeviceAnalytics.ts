import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/lib/api'
import type {
  BatteryEvent,
  ChargingSession,
  ChargingStats,
  ChargingPattern,
  AppUsage,
  BatteryDistribution,
  DateRangeParams,
} from '@/lib/api'

export function useBatteryTimeSeries(
  deviceId: string | null, 
  groupId: string | null,
  granularity: 'raw' | 'hour' | 'day' = 'raw',
  dateRange?: DateRangeParams
) {
  return useQuery({
    queryKey: ['batteryTimeSeries', deviceId, groupId, granularity, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      if (!deviceId || !groupId) return []
      const response = await analyticsApi.getBatteryTimeSeries(deviceId, groupId, granularity, dateRange)
      return response.data
    },
    enabled: !!deviceId && !!groupId,
  })
}

export function useChargingSessions(
  deviceId: string | null, 
  groupId: string | null,
  dateRange?: DateRangeParams
) {
  return useQuery({
    queryKey: ['chargingSessions', deviceId, groupId, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      if (!deviceId || !groupId) return []
      const response = await analyticsApi.getChargingSessions(deviceId, groupId, dateRange)
      return response.data
    },
    enabled: !!deviceId && !!groupId,
  })
}

export function useChargingStats(
  deviceId: string | null, 
  groupId: string | null,
  dateRange?: DateRangeParams
) {
  return useQuery({
    queryKey: ['chargingStats', deviceId, groupId, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      if (!deviceId || !groupId) return null
      const response = await analyticsApi.getChargingStats(deviceId, groupId, dateRange)
      return response.data
    },
    enabled: !!deviceId && !!groupId,
  })
}

export function useChargingPatterns(
  deviceId?: string | null, 
  groupId?: string | null,
  dateRange?: DateRangeParams
) {
  return useQuery({
    queryKey: ['chargingPatterns', deviceId, groupId, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      const response = await analyticsApi.getChargingPatterns(
        deviceId || undefined,
        groupId || undefined,
        dateRange
      )
      return response.data
    },
  })
}

export function useAppUsage(
  deviceId: string | null, 
  groupId: string | null, 
  limit = 20,
  dateRange?: DateRangeParams
) {
  return useQuery({
    queryKey: ['appUsage', deviceId, groupId, limit, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      if (!deviceId || !groupId) return []
      const response = await analyticsApi.getAppUsage(deviceId, groupId, limit, dateRange)
      return response.data
    },
    enabled: !!deviceId && !!groupId,
  })
}

export function useBatteryDistribution(
  deviceId?: string | null, 
  groupId?: string | null,
  dateRange?: DateRangeParams
) {
  return useQuery({
    queryKey: ['batteryDistribution', deviceId, groupId, dateRange?.startDate, dateRange?.endDate],
    queryFn: async () => {
      const response = await analyticsApi.getBatteryDistribution(
        deviceId || undefined,
        groupId || undefined,
        dateRange
      )
      return response.data
    },
  })
}

export type {
  BatteryEvent,
  ChargingSession,
  ChargingStats,
  ChargingPattern,
  AppUsage,
  BatteryDistribution,
  DateRangeParams,
}
