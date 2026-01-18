import { useQuery } from '@tanstack/react-query'
import { devicesApi, type DeviceInfo, type DeviceDetail } from '@/lib/api'

export function useDevices() {
  return useQuery({
    queryKey: ['devices'],
    queryFn: async () => {
      const response = await devicesApi.list()
      return response.data
    },
  })
}

export function useDevice(deviceId: string | null) {
  return useQuery({
    queryKey: ['device', deviceId],
    queryFn: async () => {
      if (!deviceId) return null
      const response = await devicesApi.get(deviceId)
      return response.data
    },
    enabled: !!deviceId,
  })
}

export type { DeviceInfo, DeviceDetail }
