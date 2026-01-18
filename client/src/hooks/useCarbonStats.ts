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
import { useDataSource } from '@/contexts/DataSourceContext'

export function useCarbonSummary() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['carbonSummary', dataSource],
    queryFn: async () => {
      const response = await carbonApi.getSummary(dataSource)
      return response.data
    },
  })
}

export function useCarbonByDevice(limit = 50) {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['carbonByDevice', limit, dataSource],
    queryFn: async () => {
      const response = await carbonApi.getByDevice(limit, dataSource)
      return response.data
    },
  })
}

export function useCarbonByGroup() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['carbonByGroup', dataSource],
    queryFn: async () => {
      const response = await carbonApi.getByGroup(dataSource)
      return response.data
    },
  })
}

export function useCarbonTrends() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['carbonTrends', dataSource],
    queryFn: async () => {
      const response = await carbonApi.getTrends(dataSource)
      return response.data
    },
  })
}

export function useCarbonComparisons() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['carbonComparisons', dataSource],
    queryFn: async () => {
      const response = await carbonApi.getComparisons(dataSource)
      return response.data
    },
  })
}

export function useCarbonByTimeOfDay() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['carbonByTimeOfDay', dataSource],
    queryFn: async () => {
      const response = await carbonApi.getByTimeOfDay(dataSource)
      return response.data
    },
  })
}

export function useCarbonInsights() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['carbonInsights', dataSource],
    queryFn: async () => {
      const response = await carbonApi.getInsights(dataSource)
      return response.data
    },
  })
}

export function useCarbonConstants() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['carbonConstants', dataSource],
    queryFn: async () => {
      const response = await carbonApi.getConstants(dataSource)
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
