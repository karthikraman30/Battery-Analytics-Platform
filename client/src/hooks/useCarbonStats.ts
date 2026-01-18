import { useQuery } from '@tanstack/react-query'
import { carbonApi } from '@/lib/api'
import type {
  CarbonSummary,
  CarbonByDevice,
  CarbonByGroup,
  CarbonTrend,
  CarbonComparison,
  CarbonByTimeOfDay,
  CarbonInsight,
  CarbonConstants,
} from '@/lib/api'

export function useCarbonSummary() {
  return useQuery({
    queryKey: ['carbonSummary'],
    queryFn: async () => {
      const response = await carbonApi.getSummary()
      return response.data
    },
  })
}

export function useCarbonByDevice(limit = 50) {
  return useQuery({
    queryKey: ['carbonByDevice', limit],
    queryFn: async () => {
      const response = await carbonApi.getByDevice(limit)
      return response.data
    },
  })
}

export function useCarbonByGroup() {
  return useQuery({
    queryKey: ['carbonByGroup'],
    queryFn: async () => {
      const response = await carbonApi.getByGroup()
      return response.data
    },
  })
}

export function useCarbonTrends() {
  return useQuery({
    queryKey: ['carbonTrends'],
    queryFn: async () => {
      const response = await carbonApi.getTrends()
      return response.data
    },
  })
}

export function useCarbonComparisons() {
  return useQuery({
    queryKey: ['carbonComparisons'],
    queryFn: async () => {
      const response = await carbonApi.getComparisons()
      return response.data
    },
  })
}

export function useCarbonByTimeOfDay() {
  return useQuery({
    queryKey: ['carbonByTimeOfDay'],
    queryFn: async () => {
      const response = await carbonApi.getByTimeOfDay()
      return response.data
    },
  })
}

export function useCarbonInsights() {
  return useQuery({
    queryKey: ['carbonInsights'],
    queryFn: async () => {
      const response = await carbonApi.getInsights()
      return response.data
    },
  })
}

export function useCarbonConstants() {
  return useQuery({
    queryKey: ['carbonConstants'],
    queryFn: async () => {
      const response = await carbonApi.getConstants()
      return response.data
    },
    staleTime: Infinity,
  })
}

export type {
  CarbonSummary,
  CarbonByDevice,
  CarbonByGroup,
  CarbonTrend,
  CarbonComparison,
  CarbonByTimeOfDay,
  CarbonInsight,
  CarbonConstants,
}
