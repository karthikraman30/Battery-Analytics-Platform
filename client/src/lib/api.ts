const API_BASE = import.meta.env.VITE_API_URL || '/api';

export type DataSource = 'grouped' | 'consolidated' | 'charging'

interface ApiResponse<T> {
  data: T;
  count?: number;
  error?: string;
}

function getPrefix(dataSource: DataSource): string {
  return dataSource === 'grouped' ? '/grouped' : ''
}

async function fetchApi<T>(endpoint: string, dataSource: DataSource = 'consolidated'): Promise<ApiResponse<T>> {
  const prefix = getPrefix(dataSource)
  const response = await fetch(`${API_BASE}${prefix}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

export const devicesApi = {
  list: (dataSource: DataSource = 'consolidated') => fetchApi<DeviceInfo[]>('/devices', dataSource),
  get: (deviceId: string, dataSource: DataSource = 'consolidated') => fetchApi<DeviceDetail>(`/devices/${deviceId}`, dataSource),
};

export interface DateRangeParams {
  startDate?: string
  endDate?: string
}

export const analyticsApi = {
  getBatteryTimeSeries: (deviceId: string, groupId: string, granularity = 'raw', dateRange?: DateRangeParams, dataSource: DataSource = 'consolidated') => {
    const params = new URLSearchParams({
      device_id: deviceId,
      group_id: groupId,
      granularity
    })
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    return fetchApi<BatteryEvent[]>(`/analytics/battery-timeseries?${params.toString()}`, dataSource)
  },

  getChargingSessions: (deviceId: string, groupId: string, dateRange?: DateRangeParams, dataSource: DataSource = 'consolidated') => {
    const params = new URLSearchParams({
      device_id: deviceId,
      group_id: groupId
    })
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    return fetchApi<ChargingSession[]>(`/analytics/charging-sessions?${params.toString()}`, dataSource)
  },

  getChargingStats: (deviceId: string, groupId: string, dateRange?: DateRangeParams, dataSource: DataSource = 'consolidated') => {
    const params = new URLSearchParams({
      device_id: deviceId,
      group_id: groupId
    })
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    return fetchApi<ChargingStats>(`/analytics/charging-stats?${params.toString()}`, dataSource)
  },

  getChargingPatterns: (deviceId?: string, groupId?: string, dateRange?: DateRangeParams, dataSource: DataSource = 'consolidated') => {
    const params = new URLSearchParams()
    if (deviceId) params.set('device_id', deviceId)
    if (groupId) params.set('group_id', groupId)
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    const queryStr = params.toString()
    return fetchApi<ChargingPattern[]>(`/analytics/charging-patterns${queryStr ? `?${queryStr}` : ''}`, dataSource)
  },

  getAppUsage: (deviceId: string, groupId: string, limit = 20, dateRange?: DateRangeParams, dataSource: DataSource = 'consolidated') => {
    const params = new URLSearchParams({
      device_id: deviceId,
      group_id: groupId,
      limit: String(limit)
    })
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    return fetchApi<AppUsage[]>(`/analytics/app-usage?${params.toString()}`, dataSource)
  },

  getBatteryDistribution: (deviceId?: string, groupId?: string, dateRange?: DateRangeParams, dataSource: DataSource = 'consolidated') => {
    const params = new URLSearchParams()
    if (deviceId) params.set('device_id', deviceId)
    if (groupId) params.set('group_id', groupId)
    if (dateRange?.startDate) params.set('start_date', dateRange.startDate)
    if (dateRange?.endDate) params.set('end_date', dateRange.endDate)
    const queryStr = params.toString()
    return fetchApi<BatteryDistribution[]>(`/analytics/battery-distribution${queryStr ? `?${queryStr}` : ''}`, dataSource)
  },
};

export const aggregatesApi = {
  getStats: (dataSource: DataSource = 'consolidated') => fetchApi<OverallStats>('/aggregates/stats', dataSource),
  getChargingPatterns: (dataSource: DataSource = 'consolidated') => fetchApi<ChargingPattern[]>('/aggregates/charging-patterns', dataSource),
  getTopApps: (limit = 20, dataSource: DataSource = 'consolidated') => fetchApi<AppUsage[]>(`/aggregates/top-apps?limit=${limit}`, dataSource),
  getBatteryDistribution: (dataSource: DataSource = 'consolidated') => fetchApi<BatteryDistribution[]>('/aggregates/battery-distribution', dataSource),
  getBatteryBoxPlot: (groupBy: 'device' | 'group' = 'device', dataSource: DataSource = 'consolidated') =>
    fetchApi<BoxPlotStats[]>(`/aggregates/battery-boxplot?group_by=${groupBy}`, dataSource),
  getChargingDurationBoxPlot: (groupBy: 'device' | 'group' = 'device', dataSource: DataSource = 'consolidated') =>
    fetchApi<ChargingDurationStats[]>(`/aggregates/charging-duration-boxplot?group_by=${groupBy}`, dataSource),
  getGroups: (dataSource: DataSource = 'consolidated') => fetchApi<GroupStats[]>('/aggregates/groups', dataSource),
  getHourlyPatterns: (deviceId?: string, groupId?: string, dataSource: DataSource = 'consolidated') => {
    const params = new URLSearchParams()
    if (deviceId) params.set('device_id', deviceId)
    if (groupId) params.set('group_id', groupId)
    const queryStr = params.toString()
    return fetchApi<HourlyUsagePattern[]>(`/aggregates/hourly-patterns${queryStr ? `?${queryStr}` : ''}`, dataSource)
  },
  getChargingByHour: (dataSource: DataSource = 'consolidated') => fetchApi<ChargingByHour[]>('/aggregates/charging-by-hour', dataSource),
  getAppBatteryDrain: (sortBy: 'hours' | 'drain' | 'sessions' | 'devices' = 'hours', limit = 20, deviceId?: string, groupId?: string, dataSource: DataSource = 'consolidated') => {
    const params = new URLSearchParams({ sort_by: sortBy, limit: String(limit) })
    if (deviceId) params.set('device_id', deviceId)
    if (groupId) params.set('group_id', groupId)
    return fetchApi<AppBatteryDrain[]>(`/aggregates/app-battery-drain?${params.toString()}`, dataSource)
  },
  getAppUsageByHour: (topN = 5, dataSource: DataSource = 'consolidated') => fetchApi<AppUsageByHour[]>(`/aggregates/app-usage-by-hour?top_n=${topN}`, dataSource),
  getUserBehaviors: (dataSource: DataSource = 'consolidated') => fetchApi<UserBehavior[]>('/aggregates/user-behaviors', dataSource),
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
  getSummary: (dataSource: DataSource = 'consolidated') => fetchApi<CarbonSummary>('/carbon/summary', dataSource),
  getByDevice: (limit = 50, dataSource: DataSource = 'consolidated') => fetchApi<CarbonByDevice[]>(`/carbon/by-device?limit=${limit}`, dataSource),
  getByGroup: (dataSource: DataSource = 'consolidated') => fetchApi<CarbonByGroup[]>('/carbon/by-group', dataSource),
  getTrends: (dataSource: DataSource = 'consolidated') => fetchApi<CarbonTrend[]>('/carbon/trends', dataSource),
  getComparisons: (dataSource: DataSource = 'consolidated') => fetchApi<CarbonComparison>('/carbon/comparisons', dataSource),
  getByTimeOfDay: (dataSource: DataSource = 'consolidated') => fetchApi<CarbonByTimeOfDay[]>('/carbon/by-time-of-day', dataSource),
  getInsights: (dataSource: DataSource = 'consolidated') => fetchApi<CarbonInsight[]>('/carbon/insights', dataSource),
  getConstants: (dataSource: DataSource = 'consolidated') => fetchApi<CarbonConstants>('/carbon/constants', dataSource),
};

// ─── Charging Data API (separate database) ──────────────────────────────────

async function fetchChargingApi<T>(endpoint: string): Promise<ApiResponse<T>> {
  const response = await fetch(`${API_BASE}/charging${endpoint}`);
  if (!response.ok) {
    throw new Error(`API error: ${response.statusText}`);
  }
  return response.json();
}

export const chargingApi = {
  getStats: () => fetchChargingApi<ChargingDbStats>('/stats'),
  getUsers: (sortBy?: string, order?: string) => {
    const params = new URLSearchParams()
    if (sortBy) params.set('sort_by', sortBy)
    if (order) params.set('order', order)
    const q = params.toString()
    return fetchChargingApi<ChargingDbUser[]>(`/users${q ? `?${q}` : ''}`)
  },
  getUserDetail: (userId: number) => fetchChargingApi<ChargingDbUserDetail>(`/users/${userId}`),
  getSessions: (userId?: number, completeOnly?: boolean) => {
    const params = new URLSearchParams()
    if (userId) params.set('user_id', String(userId))
    if (completeOnly) params.set('complete_only', 'true')
    return fetchChargingApi<ChargingDbSession[]>(`/sessions?${params.toString()}`)
  },
  getTimePatterns: () => fetchChargingApi<ChargingTimePatterns>('/time-patterns'),
  getDurationDistribution: () => fetchChargingApi<ChargingDistBucket[]>('/duration-distribution'),
  getLevelDistribution: () => fetchChargingApi<ChargingLevelDist>('/level-distribution'),
  getAnomalousUsers: () => fetchChargingApi<ChargingDbUser[]>('/anomalous-users'),
  getAnomalyImpact: () => fetchChargingApi<AnomalyImpact>('/anomaly-impact'),
  getChargeGainedDistribution: () => fetchChargingApi<ChargingDistBucket[]>('/charge-gained-distribution'),
  getDailySessions: () => fetchChargingApi<DailySessionCount[]>('/daily-sessions'),
  getComparison: () => fetchChargingApi<ChargingComparison>('/comparison'),
  getUserDateRanges: () => fetchChargingApi<UserDateRanges>('/user-date-ranges'),
  getDeepAnalysis: () => fetchChargingApi<DeepAnalysis>('/deep-analysis'),
};

// ─── Charging Data Types ────────────────────────────────────────────────────

export interface ChargingDbStats {
  total_users: number;
  total_events: number;
  total_sessions: number;
  complete_sessions: number;
  anomalous_users: number;
  avg_duration_minutes: number;
  avg_charge_gained: number;
  avg_connect_level: number;
  avg_disconnect_level: number;
  data_start: string;
  data_end: string;
}

export interface ChargingDbUser {
  user_id: number;
  total_events: number;
  connect_count: number;
  disconnect_count: number;
  event_mismatch: number;
  total_sessions: number;
  complete_sessions: number;
  avg_duration_minutes: number;
  avg_charge_gained: number;
  avg_connect_percentage: number;
  avg_disconnect_percentage: number;
  first_event: string;
  last_event: string;
  is_anomalous: boolean;
}

export interface ChargingDbUserDetail {
  stats: ChargingDbUser | null;
  sessions: ChargingDbSession[];
}

export interface ChargingDbSession {
  id: number;
  user_id: number;
  connect_time: string;
  disconnect_time: string | null;
  duration_minutes: number | null;
  start_percentage: number;
  end_percentage: number | null;
  charge_gained: number | null;
  is_complete: boolean;
}

export interface ChargingTimePatterns {
  hourly: { hour: number; session_count: number; avg_duration: number; avg_start_level: number; avg_charge_gained: number }[];
  daily: { day_of_week: number; session_count: number; avg_duration: number; avg_start_level: number }[];
  heatmap: { day_of_week: number; hour: number; session_count: number }[];
}

export interface ChargingDistBucket {
  bucket: string;
  bucket_order: number;
  count: number;
  avg_charge_gained?: number;
}

export interface ChargingLevelDist {
  connect: { level_bucket: number; count: number }[];
  disconnect: { level_bucket: number; count: number }[];
}

export interface AnomalyImpact {
  total_users: number; total_events: number; total_sessions: number; complete_sessions: number;
  avg_duration: number; avg_charge: number;
  anomalous_users: number; anomalous_events: number; anomalous_sessions: number; anomalous_complete: number;
  anomalous_avg_duration: number; anomalous_avg_charge: number;
  clean_users: number; clean_events: number; clean_sessions: number; clean_complete: number;
  clean_avg_duration: number; clean_avg_charge: number;
  pct_users: number; pct_events: number; pct_sessions: number;
}

export interface DailySessionCount {
  date: string;
  session_count: number;
  complete_count: number;
  avg_duration: number;
  active_users: number;
}

export interface ComparisonSide {
  users: number; sessions: number; complete: number;
  avg_connect: number; avg_disconnect: number;
  avg_charge: number; avg_duration: number;
  stddev_duration: number; stddev_charge: number;
  median_duration: number; median_charge: number;
}

export interface ChargingComparison {
  summary: {
    all_users: number; all_sessions: number; all_complete: number;
    all_avg_connect: number; all_avg_disconnect: number; all_avg_charge: number; all_avg_duration: number;
    all_stddev_duration: number; all_stddev_charge: number; all_median_duration: number; all_median_charge: number;
    clean_users: number; clean_sessions: number; clean_complete: number;
    clean_avg_connect: number; clean_avg_disconnect: number; clean_avg_charge: number; clean_avg_duration: number;
    clean_stddev_duration: number; clean_stddev_charge: number; clean_median_duration: number; clean_median_charge: number;
  };
  allHourly: { hour: number; count: number }[];
  cleanHourly: { hour: number; count: number }[];
  allDuration: { bucket: string; bucket_order: number; count: number }[];
  cleanDuration: { bucket: string; bucket_order: number; count: number }[];
}

export interface UserDateRanges {
  buckets: { bucket: string; bucket_order: number; user_count: number; avg_days: number }[];
  stats: { avg_days: number; median_days: number; min_days: number; max_days: number; short_users: number; total_users: number };
  perUser: { user_id: number; days_of_data: number; is_anomalous: boolean; total_sessions: number }[];
}

export interface DeepAnalysis {
  plugInByHour: { hour: number; count: number }[];
  plugOutByHour: { hour: number; count: number }[];
  chargeTargetDist: { level_bucket: number; count: number; avg_charge_target: number; median_charge_target: number }[];
  chargeTargetStat: { avg_charge_target: number; median_charge_target: number; full_charge_sessions: number; partial_charge_sessions: number; total_sessions: number };
  overnight: { overnight_sessions: number; overnight_users: number; total_complete: number; total_users: number };
  usageBetweenCharges: { bucket: string; bucket_order: number; count: number; avg_gap_hours: number }[];
  usageGapStat: { avg_gap_hours: number; median_gap_hours: number };
  drainRate: { avg_drain_pct_per_hour: number; median_drain_pct_per_hour: number; avg_hours_per_pct: number; p25_drain: number; p75_drain: number; data_points: number };
  drainByHour: { hour: number; avg_drain_pct_per_hour: number; samples: number }[];
}
