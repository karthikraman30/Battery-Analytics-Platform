import { useQuery } from '@tanstack/react-query'
import { chargingApi } from '@/lib/api'
import type {
    ChargingDbStats,
    ChargingDbUser,
    ChargingDbUserDetail,
    ChargingTimePatterns,
    ChargingDistBucket,
    ChargingLevelDist,
    AnomalyImpact,
    DailySessionCount,
    ChargingComparison,
    UserDateRanges,
    DeepAnalysis,
} from '@/lib/api'

export function useChargingStats() {
    return useQuery({
        queryKey: ['chargingStats'],
        queryFn: async () => {
            const response = await chargingApi.getStats()
            return response.data
        },
    })
}

export function useChargingUsers(sortBy?: string, order?: string) {
    return useQuery({
        queryKey: ['chargingUsers', sortBy, order],
        queryFn: async () => {
            const response = await chargingApi.getUsers(sortBy, order)
            return response.data
        },
    })
}

export function useChargingUserDetail(userId: number | null) {
    return useQuery({
        queryKey: ['chargingUserDetail', userId],
        queryFn: async () => {
            if (!userId) return null
            const response = await chargingApi.getUserDetail(userId)
            return response.data
        },
        enabled: userId !== null,
    })
}

export function useChargingTimePatterns() {
    return useQuery({
        queryKey: ['chargingTimePatterns'],
        queryFn: async () => {
            const response = await chargingApi.getTimePatterns()
            return response.data
        },
    })
}

export function useChargingDurationDist() {
    return useQuery({
        queryKey: ['chargingDurationDist'],
        queryFn: async () => {
            const response = await chargingApi.getDurationDistribution()
            return response.data
        },
    })
}

export function useChargingLevelDist() {
    return useQuery({
        queryKey: ['chargingLevelDist'],
        queryFn: async () => {
            const response = await chargingApi.getLevelDistribution()
            return response.data
        },
    })
}

export function useChargingAnomalousUsers() {
    return useQuery({
        queryKey: ['chargingAnomalousUsers'],
        queryFn: async () => {
            const response = await chargingApi.getAnomalousUsers()
            return response.data
        },
    })
}

export function useChargingAnomalyImpact() {
    return useQuery({
        queryKey: ['chargingAnomalyImpact'],
        queryFn: async () => {
            const response = await chargingApi.getAnomalyImpact()
            return response.data
        },
    })
}

export function useChargingChargeGainedDist() {
    return useQuery({
        queryKey: ['chargingChargeGainedDist'],
        queryFn: async () => {
            const response = await chargingApi.getChargeGainedDistribution()
            return response.data
        },
    })
}

export function useChargingDailySessions() {
    return useQuery({
        queryKey: ['chargingDailySessions'],
        queryFn: async () => {
            const response = await chargingApi.getDailySessions()
            return response.data
        },
    })
}

export function useChargingComparison() {
    return useQuery({
        queryKey: ['chargingComparison'],
        queryFn: async () => {
            const response = await chargingApi.getComparison()
            return response.data
        },
    })
}

export function useUserDateRanges() {
    return useQuery({
        queryKey: ['userDateRanges'],
        queryFn: async () => {
            const response = await chargingApi.getUserDateRanges()
            return response.data
        },
    })
}

export function useDeepAnalysis() {
    return useQuery({
        queryKey: ['deepAnalysis'],
        queryFn: async () => {
            const response = await chargingApi.getDeepAnalysis()
            return response.data
        },
    })
}

export type {
    ChargingDbStats,
    ChargingDbUser,
    ChargingDbUserDetail,
    ChargingTimePatterns,
    ChargingDistBucket,
    ChargingLevelDist,
    AnomalyImpact,
    DailySessionCount,
    ChargingComparison,
    UserDateRanges,
    DeepAnalysis,
}
