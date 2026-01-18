/**
 * API client for Battery Analytics backend
 */

const API_BASE = import.meta.env.VITE_API_URL || '/api';

interface ApiResponse<T> {
  data: T;
  count?: number;
  error?: string;
}

async function fetchApi<T>(endpoint: string): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

// Device APIs
export const devicesApi = {
  list: () => fetchApi<DeviceInfo[]>('/devices'),
  get: (deviceId: string) => fetchApi<DeviceDetail>(`/devices/${deviceId}`),
};

// Analytics APIs
export interface DateRangeParams {
  startDate?: string
  endDate?: string
}

export const analyticsApi = {
  getBatteryTimeSeries: (deviceId: string, groupId: string, granularity = 'raw', dateRange?: DateRangeParams) => {
    const params = new URLSearchParams({
      device_id: deviceId,
      group_id: groupId,
      granularity
    })
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    return fetchApi<BatteryEvent[]>(`/analytics/battery-timeseries?${params.toString()}`)
  },
  
  getChargingSessions: (deviceId: string, groupId: string, dateRange?: DateRangeParams) => {
    const params = new URLSearchParams({
      device_id: deviceId,
      group_id: groupId
    })
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    return fetchApi<ChargingSession[]>(`/analytics/charging-sessions?${params.toString()}`)
  },
  
  getChargingStats: (deviceId: string, groupId: string, dateRange?: DateRangeParams) => {
    const params = new URLSearchParams({
      device_id: deviceId,
      group_id: groupId
    })
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    return fetchApi<ChargingStats>(`/analytics/charging-stats?${params.toString()}`)
  },
  
  getChargingPatterns: (deviceId?: string, groupId?: string, dateRange?: DateRangeParams) => {
    const params = new URLSearchParams()
    if (deviceId) params.set('device_id', deviceId)
    if (groupId) params.set('group_id', groupId)
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    const queryStr = params.toString()
    return fetchApi<ChargingPattern[]>(`/analytics/charging-patterns${queryStr ? `?${queryStr}` : ''}`)
  },
  
  getAppUsage: (deviceId: string, groupId: string, limit = 20, dateRange?: DateRangeParams) => {
    const params = new URLSearchParams({
      device_id: deviceId,
      group_id: groupId,
      limit: String(limit)
    })
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    return fetchApi<AppUsage[]>(`/analytics/app-usage?${params.toString()}`)
  },
  
  getBatteryDistribution: (deviceId?: string, groupId?: string, dateRange?: DateRangeParams) => {
    const params = new URLSearchParams()
    if (deviceId) params.set('device_id', deviceId)
    if (groupId) params.set('group_id', groupId)
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    const queryStr = params.toString()
    return fetchApi<BatteryDistribution[]>(`/analytics/battery-distribution${queryStr ? `?${queryStr}` : ''}`)
  },
};

// Aggregate APIs
export const aggregatesApi = {
  getStats: () => fetchApi<OverallStats>('/aggregates/stats'),
  getChargingPatterns: () => fetchApi<ChargingPattern[]>('/aggregates/charging-patterns'),
  getTopApps: (limit = 20) => fetchApi<AppUsage[]>(`/aggregates/top-apps?limit=${limit}`),
  getBatteryDistribution: () => fetchApi<BatteryDistribution[]>('/aggregates/battery-distribution'),
  getBatteryBoxPlot: (groupBy: 'device' | 'group' = 'device') => 
    fetchApi<BoxPlotStats[]>(`/aggregates/battery-boxplot?group_by=${groupBy}`),
  getChargingDurationBoxPlot: (groupBy: 'device' | 'group' = 'device') =>
    fetchApi<ChargingDurationStats[]>(`/aggregates/charging-duration-boxplot?group_by=${groupBy}`),
  getGroups: () => fetchApi<GroupStats[]>('/aggregates/groups'),
  getHourlyPatterns: (deviceId?: string, groupId?: string) => {
    const params = new URLSearchParams()
    if (deviceId) params.set('device_id', deviceId)
    if (groupId) params.set('group_id', groupId)
    const queryStr = params.toString()
    return fetchApi<HourlyUsagePattern[]>(`/aggregates/hourly-patterns${queryStr ? `?${queryStr}` : ''}`)
  },
  getChargingByHour: () => fetchApi<ChargingByHour[]>('/aggregates/charging-by-hour'),
  getAppBatteryDrain: (sortBy: 'hours' | 'drain' | 'sessions' | 'devices' = 'hours', limit = 20, deviceId?: string, groupId?: string) => {
    const params = new URLSearchParams({ sort_by: sortBy, limit: String(limit) })
    if (deviceId) params.set('device_id', deviceId)
    if (groupId) params.set('group_id', groupId)
    return fetchApi<AppBatteryDrain[]>(`/aggregates/app-battery-drain?${params.toString()}`)
  },
  getAppUsageByHour: (topN = 5) => fetchApi<AppUsageByHour[]>(`/aggregates/app-usage-by-hour?top_n=${topN}`),
  getUserBehaviors: () => fetchApi<UserBehavior[]>('/aggregates/user-behaviors'),
};

// Types
export interface DeviceInfo {
  device_id: string;
  group_id: string;
  first_date: string;
  last_date: string;
  total_days: number;
  battery_events: number;
  charging_sessions: number;
}

export interface DeviceDetail extends DeviceInfo {
  charging_stats: ChargingStats | null;
  top_apps: AppUsage[];
}

export interface BatteryEvent {
  id: number;
  device_id: string;
  timestamp: string;
  event_type: string;
  battery_level: number;
}

export interface ChargingSession {
  session_id: string;
  device_id: string;
  session_start: string;
  session_end: string | null;
  duration_minutes: number | null;
  start_battery_level: number;
  end_battery_level: number | null;
  charge_gained: number | null;
  is_complete: boolean;
}

export interface ChargingStats {
  device_id: string;
  total_sessions: number;
  avg_duration_minutes: number;
  avg_start_level: number;
  avg_charge_gained: number;
  complete_sessions: number;
}

export interface ChargingPattern {
  hour_of_day: number;
  day_of_week: number;
  charge_count: number;
  avg_duration: number;
  avg_start_level: number;
}

export interface AppUsage {
  name: string;
  package_name: string;
  total_minutes: number;
  session_count: number;
  avg_session_seconds: number;
}

export interface BatteryDistribution {
  battery_range: number;
  count: number;
}

export interface OverallStats {
  total_devices: number;
  total_groups: number;
  total_battery_events: number;
  total_charging_sessions: number;
  total_app_events: number;
  avg_charge_frequency: number;
  avg_session_duration: number;
  avg_battery_at_charge: number;
}

export interface BoxPlotStats {
  group_id: string;
  device_id: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
  count: number;
}

export interface ChargingDurationStats {
  group_id: string;
  device_id: string;
  min_duration: number;
  q1_duration: number;
  median_duration: number;
  q3_duration: number;
  max_duration: number;
  avg_duration: number;
  session_count: number;
}

export interface GroupStats {
  group_id: string;
  device_count: number;
  battery_events: number;
  charging_sessions: number;
  avg_battery_level: number;
  avg_charge_gained: number;
  avg_session_duration: number;
  first_date: string;
  last_date: string;
}

export interface HourlyUsagePattern {
  hour_of_day: number;
  avg_battery_level: number;
  charge_starts: number;
  app_usage_minutes: number;
}

export interface AppBatteryDrain {
  app_name: string;
  sessions: number;
  devices: number;
  total_hours: number;
  avg_session_minutes: number;
  avg_battery_drain: number;
  drain_per_hour: number;
}

export interface AppUsageByHour {
  hour: number;
  app_name: string;
  usage_minutes: number;
  sessions: number;
}

export interface ChargingByHour {
  hour: number;
  avg_start_level: number;
  sessions: number;
  avg_charge_gained: number;
  avg_duration: number;
}

export interface UserBehavior {
  device_id: string;
  group_id: string;
  avg_charge_level: number;
  charge_frequency: number;
  avg_session_duration: number;
  screen_time_hours: number;
  top_app: string;
  behavior_type: string;
}

export interface CarbonSummary {
  total_co2_kg: number;
  total_co2_grams: number;
  total_sessions: number;
  total_charge_gained: number;
  avg_co2_per_session_g: number;
  projected_annual_kg: number;
  data_days: number;
  devices_count: number;
}

export interface CarbonByDevice {
  device_id: string;
  group_id: string;
  co2_kg: number;
  co2_grams: number;
  sessions: number;
  charge_gained: number;
  avg_co2_per_session_g: number;
}

export interface CarbonByGroup {
  group_id: string;
  co2_kg: number;
  sessions: number;
  devices: number;
  avg_co2_per_device_g: number;
}

export interface CarbonTrend {
  date: string;
  co2_grams: number;
  sessions: number;
  charge_gained: number;
}

export interface CarbonComparison {
  total_co2_kg: number;
  driving_km: number;
  trees_to_offset: number;
  led_bulb_hours: number;
  streaming_hours: number;
}

export interface CarbonByTimeOfDay {
  time_period: string;
  co2_kg: number;
  sessions: number;
  avg_start_level: number;
  avg_charge_gained: number;
}

export interface CarbonInsight {
  type: 'tip' | 'achievement' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: string;
  potential_savings_g?: number;
}

export interface CarbonConstants {
  carbon_factor: number;
  battery_capacity_wh: number;
  charging_efficiency: number;
  grid_carbon_intensity: number;
  comparisons: {
    DRIVING_KM_PER_KG: number;
    TREE_ABSORPTION_KG_YEAR: number;
    LED_BULB_HOURS_PER_KG: number;
    STREAMING_HOURS_PER_KG: number;
  };
}

export const carbonApi = {
  getSummary: () => fetchApi<CarbonSummary>('/carbon/summary'),
  getByDevice: (limit = 50) => fetchApi<CarbonByDevice[]>(`/carbon/by-device?limit=${limit}`),
  getByGroup: () => fetchApi<CarbonByGroup[]>('/carbon/by-group'),
  getTrends: () => fetchApi<CarbonTrend[]>('/carbon/trends'),
  getComparisons: () => fetchApi<CarbonComparison>('/carbon/comparisons'),
  getByTimeOfDay: () => fetchApi<CarbonByTimeOfDay[]>('/carbon/by-time-of-day'),
  getInsights: () => fetchApi<CarbonInsight[]>('/carbon/insights'),
  getConstants: () => fetchApi<CarbonConstants>('/carbon/constants'),
};
