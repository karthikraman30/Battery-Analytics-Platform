import { Select } from '@/components/ui/select'
import type { DeviceInfo } from '@/lib/api'

// Helper to create composite key from device_id and group_id
export function makeDeviceKey(deviceId: string, groupId: string): string {
  return `${deviceId}::${groupId}`
}

// Helper to parse composite key back to device_id and group_id
export function parseDeviceKey(key: string): { deviceId: string; groupId: string } | null {
  const parts = key.split('::')
  if (parts.length !== 2) return null
  return { deviceId: parts[0], groupId: parts[1] }
}

interface DeviceSelectorProps {
  devices: DeviceInfo[]
  selectedDeviceId: string | null
  onDeviceChange: (deviceId: string) => void
  isLoading?: boolean
}

export function DeviceSelector({ 
  devices, 
  selectedDeviceId, 
  onDeviceChange,
  isLoading 
}: DeviceSelectorProps) {
  // Use composite key (device_id::group_id) for unique identification
  const options = devices.map(device => ({
    value: makeDeviceKey(device.device_id, device.group_id),
    label: `${device.device_id} (${device.group_id}) - ${device.total_days} days`,
  }))

  if (isLoading) {
    return (
      <div className="h-10 w-64 animate-pulse rounded-md bg-muted" />
    )
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-muted-foreground">
        Device:
      </label>
      <Select
        options={options}
        value={selectedDeviceId || ''}
        onChange={(e) => onDeviceChange(e.target.value)}
        className="w-80"
      />
    </div>
  )
}
