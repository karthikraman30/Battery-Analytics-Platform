import { useQuery } from '@tanstack/react-query'
import { devicesApi, type DeviceInfo, type DeviceDetail } from '@/lib/api'
import { useDataSource } from '@/contexts/DataSourceContext'

export function useDevices() {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['devices', dataSource],
    queryFn: async () => {
      const response = await devicesApi.list(dataSource)
      return response.data
    },
  })
}

export function useDevice(deviceId: string | null) {
  const { dataSource } = useDataSource()
  return useQuery({
    queryKey: ['device', deviceId, dataSource],
    queryFn: async () => {
      if (!deviceId) return null
      const response = await devicesApi.get(deviceId, dataSource)
      return response.data
    },
    enabled: !!deviceId,
  })
}

export type { DeviceInfo, DeviceDetail }
