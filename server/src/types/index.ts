/**
 * TypeScript type definitions for Battery Analytics API
 */

// Battery Events
export interface BatteryEvent {
  id: number;
  device_id: string;
  group_id: string;
  timestamp: string;
  event_type: string;
  battery_level: number;
}

// Charging Sessions
export interface ChargingSession {
  session_id: string;
  device_id: string;
  group_id: string;
  session_start: string;
  session_end: string | null;
  duration_minutes: number | null;
  start_battery_level: number;
  end_battery_level: number | null;
  charge_gained: number | null;
  is_complete: boolean;
}

// App Usage Events
export interface AppUsageEvent {
  id: number;
  device_id: string;
  group_id: string;
  start_timestamp: string;
  end_timestamp: string;
  duration_seconds: number;
  package_name: string;
  app_name: string;
  is_screen_off: boolean;
}

// Network Events
export interface NetworkEvent {
  id: number;
  device_id: string;
  group_id: string;
  timestamp: string;
  ssid: string;
  is_wifi: boolean;
  signal_strength: number;
}

// API Response Types
export interface DeviceInfo {
  device_id: string;
  group_id: string;
  first_date: string;
  last_date: string;
  total_days: number;
  battery_events: number;
  charging_sessions: number;
}

export interface ChargingStats {
  device_id: string;
  total_sessions: number;
  avg_duration_minutes: number;
  avg_start_level: number;
  avg_charge_gained: number;
  complete_sessions: number;
}

export interface AppUsageStats {
  name: string;
  package_name: string;
  total_minutes: number;
  session_count: number;
  avg_session_seconds: number;
}

export interface ChargingPattern {
  hour_of_day: number;
  day_of_week: number;
  charge_count: number;
  avg_duration: number;
  avg_start_level: number;
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

// API Query Parameters
export interface TimeRangeQuery {
  start_date?: string;
  end_date?: string;
}

export interface DeviceQuery extends TimeRangeQuery {
  device_id: string;
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}
