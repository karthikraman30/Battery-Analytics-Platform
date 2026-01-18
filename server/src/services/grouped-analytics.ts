import { queryGrouped } from '../db/grouped-connection';
import { logger } from '../lib/logger';
import type { 
  BatteryEvent, 
  ChargingSession, 
  ChargingStats,
  AppUsageStats,
  ChargingPattern,
  DeviceInfo,
  OverallStats
} from '../types';

export async function getDevices(): Promise<DeviceInfo[]> {
  logger.debug('Fetching all devices (grouped)');
  const result = await queryGrouped<DeviceInfo>(`
    SELECT 
      b.device_id,
      b.group_id,
      MIN(b.timestamp)::date::text as first_date,
      MAX(b.timestamp)::date::text as last_date,
      (MAX(b.timestamp)::date - MIN(b.timestamp)::date + 1) as total_days,
      COUNT(b.id) as battery_events,
      COALESCE(cs.session_count, 0) as charging_sessions
    FROM battery_events b
    LEFT JOIN (
      SELECT device_id, group_id, COUNT(*) as session_count 
      FROM charging_sessions 
      GROUP BY device_id, group_id
    ) cs ON b.device_id = cs.device_id AND b.group_id = cs.group_id
    GROUP BY b.device_id, b.group_id, cs.session_count
    ORDER BY b.group_id, battery_events DESC
  `);
  logger.info('Fetched devices (grouped)', { count: result.rows.length });
  return result.rows;
}

export async function getBatteryTimeSeries(
  deviceId: string,
  groupId: string,
  startDate?: string,
  endDate?: string,
  granularity: 'raw' | 'hour' | 'day' = 'raw'
): Promise<any[]> {
  logger.debug('Fetching battery time series (grouped)', { deviceId, groupId, startDate, endDate, granularity });
  
  if (granularity === 'raw') {
    const result = await queryGrouped<BatteryEvent>(`
      SELECT id, device_id, timestamp, event_type, battery_level
      FROM battery_events
      WHERE device_id = $1 AND group_id = $2
        ${startDate ? `AND timestamp >= $3` : ''}
        ${endDate ? `AND timestamp <= $${startDate ? 4 : 3}` : ''}
      ORDER BY timestamp ASC
      LIMIT 50000
    `, [deviceId, groupId, startDate, endDate].filter(Boolean));
    logger.info('Fetched battery time series (grouped)', { deviceId, groupId, granularity, rows: result.rows.length });
    return result.rows;
  } else if (granularity === 'hour') {
    const result = await queryGrouped(`
      SELECT 
        time_bucket('1 hour', timestamp) as timestamp,
        AVG(battery_level) as avg_battery_level,
        MIN(battery_level) as min_battery_level,
        MAX(battery_level) as max_battery_level,
        COUNT(*) as event_count
      FROM battery_events
      WHERE device_id = $1 AND group_id = $2
        ${startDate ? `AND timestamp >= $3` : ''}
        ${endDate ? `AND timestamp <= $${startDate ? 4 : 3}` : ''}
      GROUP BY 1
      ORDER BY 1 ASC
    `, [deviceId, groupId, startDate, endDate].filter(Boolean));
    logger.info('Fetched battery time series (grouped)', { deviceId, groupId, granularity, rows: result.rows.length });
    return result.rows;
  } else {
    const result = await queryGrouped(`
      SELECT 
        time_bucket('1 day', timestamp) as timestamp,
        AVG(battery_level) as avg_battery_level,
        MIN(battery_level) as min_battery_level,
        MAX(battery_level) as max_battery_level,
        COUNT(*) as event_count
      FROM battery_events
      WHERE device_id = $1 AND group_id = $2
        ${startDate ? `AND timestamp >= $3` : ''}
        ${endDate ? `AND timestamp <= $${startDate ? 4 : 3}` : ''}
      GROUP BY 1
      ORDER BY 1 ASC
    `, [deviceId, groupId, startDate, endDate].filter(Boolean));
    logger.info('Fetched battery time series (grouped)', { deviceId, groupId, granularity, rows: result.rows.length });
    return result.rows;
  }
}

export async function getChargingSessions(
  deviceId: string,
  groupId: string,
  startDate?: string,
  endDate?: string
): Promise<ChargingSession[]> {
  logger.debug('Fetching charging sessions (grouped)', { deviceId, groupId, startDate, endDate });
  const result = await queryGrouped<ChargingSession>(`
    SELECT *
    FROM charging_sessions
    WHERE device_id = $1 AND group_id = $2
      ${startDate ? `AND session_start >= $3` : ''}
      ${endDate ? `AND session_start <= $${startDate ? 4 : 3}` : ''}
    ORDER BY session_start DESC
    LIMIT 5000
  `, [deviceId, groupId, startDate, endDate].filter(Boolean));
  logger.info('Fetched charging sessions (grouped)', { deviceId, groupId, rows: result.rows.length });
  return result.rows;
}

export async function getChargingStats(
  deviceId: string, 
  groupId: string,
  startDate?: string,
  endDate?: string
): Promise<ChargingStats | null> {
  logger.debug('Fetching charging stats (grouped)', { deviceId, groupId, startDate, endDate });
  
  const conditions = ['device_id = $1', 'group_id = $2'];
  const params: string[] = [deviceId, groupId];
  
  if (startDate) {
    params.push(startDate);
    conditions.push(`session_start >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`session_start <= $${params.length}`);
  }
  
  const result = await queryGrouped<ChargingStats>(`
    SELECT 
      device_id,
      COUNT(*) as total_sessions,
      AVG(duration_minutes)::numeric(10,2) as avg_duration_minutes,
      AVG(start_battery_level)::numeric(10,2) as avg_start_level,
      AVG(charge_gained)::numeric(10,2) as avg_charge_gained,
      COUNT(*) FILTER (WHERE is_complete) as complete_sessions
    FROM charging_sessions
    WHERE ${conditions.join(' AND ')}
    GROUP BY device_id
  `, params);
  logger.info('Fetched charging stats (grouped)', { deviceId, groupId, found: !!result.rows[0] });
  return result.rows[0] || null;
}

export async function getChargingPatterns(
  deviceId?: string, 
  groupId?: string,
  startDate?: string,
  endDate?: string
): Promise<ChargingPattern[]> {
  logger.debug('Fetching charging patterns (grouped)', { deviceId: deviceId || 'all', groupId: groupId || 'all', startDate, endDate });
  
  const conditions: string[] = ['is_complete = TRUE'];
  const params: string[] = [];
  
  if (deviceId) {
    params.push(deviceId);
    conditions.push(`device_id = $${params.length}`);
  }
  if (groupId) {
    params.push(groupId);
    conditions.push(`group_id = $${params.length}`);
  }
  if (startDate) {
    params.push(startDate);
    conditions.push(`session_start >= $${params.length}`);
  }
  if (endDate) {
    params.push(endDate);
    conditions.push(`session_start <= $${params.length}`);
  }
  
  const result = await queryGrouped<ChargingPattern>(`
    SELECT 
      EXTRACT(HOUR FROM session_start)::int as hour_of_day,
      EXTRACT(DOW FROM session_start)::int as day_of_week,
      COUNT(*) as charge_count,
      AVG(duration_minutes)::numeric(10,2) as avg_duration,
      AVG(start_battery_level)::numeric(10,2) as avg_start_level
    FROM charging_sessions
    WHERE ${conditions.join(' AND ')}
    GROUP BY 1, 2
    ORDER BY 1, 2
  `, params);
  logger.info('Fetched charging patterns (grouped)', { deviceId: deviceId || 'all', groupId: groupId || 'all', rows: result.rows.length });
  return result.rows;
}

export async function getAppUsage(
  deviceId: string,
  groupId: string,
  groupBy: 'app' | 'category' = 'app',
  limit: number = 20
): Promise<AppUsageStats[]> {
  logger.debug('Fetching app usage (grouped)', { deviceId, groupId, groupBy, limit });
  const result = await queryGrouped<AppUsageStats>(`
    SELECT 
      COALESCE(app_name, package_name) as name,
      package_name,
      SUM(duration_seconds) / 60.0 as total_minutes,
      COUNT(*) as session_count,
      AVG(duration_seconds)::numeric(10,2) as avg_session_seconds
    FROM app_usage_events
    WHERE device_id = $1 AND group_id = $2
      AND is_screen_off = FALSE
      AND package_name IS NOT NULL
      AND package_name != ''
    GROUP BY app_name, package_name
    ORDER BY total_minutes DESC
    LIMIT $3
  `, [deviceId, groupId, limit]);
  logger.info('Fetched app usage (grouped)', { deviceId, groupId, rows: result.rows.length });
  return result.rows;
}

export async function getTopApps(limit: number = 20): Promise<AppUsageStats[]> {
  logger.debug('Fetching top apps (grouped)', { limit });
  const result = await queryGrouped<AppUsageStats>(`
    SELECT 
      COALESCE(app_name, package_name) as name,
      package_name,
      SUM(duration_seconds) / 60.0 as total_minutes,
      COUNT(*) as session_count,
      AVG(duration_seconds)::numeric(10,2) as avg_session_seconds
    FROM app_usage_events
    WHERE is_screen_off = FALSE
      AND package_name IS NOT NULL
      AND package_name != ''
    GROUP BY app_name, package_name
    ORDER BY total_minutes DESC
    LIMIT $1
  `, [limit]);
  logger.info('Fetched top apps (grouped)', { rows: result.rows.length });
  return result.rows;
}

export async function getOverallStats(): Promise<OverallStats> {
  logger.debug('Fetching overall stats (grouped)');
  const result = await queryGrouped<OverallStats>(`
    SELECT
      (SELECT COUNT(DISTINCT (device_id, group_id)) FROM battery_events) as total_devices,
      (SELECT COUNT(DISTINCT group_id) FROM battery_events) as total_groups,
      (SELECT COUNT(*) FROM battery_events) as total_battery_events,
      (SELECT COUNT(*) FROM charging_sessions) as total_charging_sessions,
      (SELECT COUNT(*) FROM app_usage_events) as total_app_events,
      COALESCE((
        SELECT AVG(daily_count)::numeric(10,2)
        FROM (
          SELECT device_id, group_id, COUNT(*)::float / NULLIF(MAX(session_start::date) - MIN(session_start::date) + 1, 0) as daily_count
          FROM charging_sessions
          GROUP BY device_id, group_id
        ) t
      ), 0) as avg_charge_frequency,
      COALESCE((SELECT AVG(duration_minutes)::numeric(10,2) FROM charging_sessions WHERE is_complete), 0) as avg_session_duration,
      COALESCE((SELECT AVG(start_battery_level)::numeric(10,2) FROM charging_sessions), 0) as avg_battery_at_charge
  `);
  logger.info('Fetched overall stats (grouped)', { 
    devices: result.rows[0]?.total_devices,
    sessions: result.rows[0]?.total_charging_sessions 
  });
  return result.rows[0];
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

export async function getBatteryBoxPlotStats(groupBy: 'device' | 'group' = 'device'): Promise<BoxPlotStats[]> {
  logger.debug('Fetching battery box plot stats (grouped)', { groupBy });
  
  if (groupBy === 'group') {
    const result = await queryGrouped<BoxPlotStats>(`
      SELECT 
        group_id,
        'all' as device_id,
        MIN(battery_level) as min,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY battery_level) as q1,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY battery_level) as median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY battery_level) as q3,
        MAX(battery_level) as max,
        AVG(battery_level)::numeric(5,1) as mean,
        COUNT(*) as count
      FROM battery_events
      GROUP BY group_id
      HAVING COUNT(*) >= 50
      ORDER BY median DESC
    `);
    logger.info('Fetched battery box plot stats by group (grouped)', { rows: result.rows.length });
    return result.rows;
  } else {
    const result = await queryGrouped<BoxPlotStats>(`
      SELECT 
        group_id,
        device_id,
        MIN(battery_level) as min,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY battery_level) as q1,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY battery_level) as median,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY battery_level) as q3,
        MAX(battery_level) as max,
        AVG(battery_level)::numeric(5,1) as mean,
        COUNT(*) as count
      FROM battery_events
      GROUP BY group_id, device_id
      HAVING COUNT(*) >= 50
      ORDER BY median DESC
      LIMIT 30
    `);
    logger.info('Fetched battery box plot stats by device (grouped)', { rows: result.rows.length });
    return result.rows;
  }
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

export async function getChargingDurationBoxPlot(groupBy: 'device' | 'group' = 'device'): Promise<ChargingDurationStats[]> {
  logger.debug('Fetching charging duration box plot (grouped)', { groupBy });
  
  if (groupBy === 'group') {
    const result = await queryGrouped<ChargingDurationStats>(`
      SELECT 
        group_id,
        'all' as device_id,
        MIN(duration_minutes) as min_duration,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY duration_minutes) as q1_duration,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes) as median_duration,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY duration_minutes) as q3_duration,
        MAX(duration_minutes) as max_duration,
        AVG(duration_minutes)::numeric(10,1) as avg_duration,
        COUNT(*) as session_count
      FROM charging_sessions
      WHERE is_complete = TRUE AND duration_minutes > 0 AND duration_minutes < 1440
      GROUP BY group_id
      HAVING COUNT(*) >= 5
      ORDER BY median_duration DESC
    `);
    logger.info('Fetched charging duration box plot by group (grouped)', { rows: result.rows.length });
    return result.rows;
  } else {
    const result = await queryGrouped<ChargingDurationStats>(`
      SELECT 
        group_id,
        device_id,
        MIN(duration_minutes) as min_duration,
        PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY duration_minutes) as q1_duration,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_minutes) as median_duration,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY duration_minutes) as q3_duration,
        MAX(duration_minutes) as max_duration,
        AVG(duration_minutes)::numeric(10,1) as avg_duration,
        COUNT(*) as session_count
      FROM charging_sessions
      WHERE is_complete = TRUE AND duration_minutes > 0 AND duration_minutes < 1440
      GROUP BY group_id, device_id
      HAVING COUNT(*) >= 5
      ORDER BY median_duration DESC
      LIMIT 30
    `);
    logger.info('Fetched charging duration box plot by device (grouped)', { rows: result.rows.length });
    return result.rows;
  }
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

export async function getGroupStats(): Promise<GroupStats[]> {
  logger.debug('Fetching group statistics (grouped)');
  const result = await queryGrouped<GroupStats>(`
    SELECT 
      b.group_id,
      COUNT(DISTINCT b.device_id) as device_count,
      COUNT(b.id) as battery_events,
      COALESCE(cs.total_sessions, 0) as charging_sessions,
      AVG(b.battery_level)::numeric(5,1) as avg_battery_level,
      COALESCE(cs.avg_charge, 0) as avg_charge_gained,
      COALESCE(cs.avg_duration, 0) as avg_session_duration,
      MIN(b.timestamp)::date::text as first_date,
      MAX(b.timestamp)::date::text as last_date
    FROM battery_events b
    LEFT JOIN (
      SELECT 
        group_id,
        COUNT(*) as total_sessions,
        AVG(charge_gained)::numeric(5,1) as avg_charge,
        AVG(duration_minutes)::numeric(5,1) as avg_duration
      FROM charging_sessions
      WHERE is_complete = TRUE
      GROUP BY group_id
    ) cs ON b.group_id = cs.group_id
    GROUP BY b.group_id, cs.total_sessions, cs.avg_charge, cs.avg_duration
    ORDER BY battery_events DESC
  `);
  logger.info('Fetched group stats (grouped)', { rows: result.rows.length });
  return result.rows;
}

export interface HourlyUsagePattern {
  hour_of_day: number;
  avg_battery_level: number;
  charge_starts: number;
  app_usage_minutes: number;
}

export async function getHourlyUsagePatterns(deviceId?: string, groupId?: string): Promise<HourlyUsagePattern[]> {
  logger.debug('Fetching hourly usage patterns (grouped)', { deviceId, groupId });
  
  const conditions: string[] = [];
  const params: string[] = [];
  
  if (deviceId) {
    params.push(deviceId);
    conditions.push(`device_id = $${params.length}`);
  }
  if (groupId) {
    params.push(groupId);
    conditions.push(`group_id = $${params.length}`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await queryGrouped<HourlyUsagePattern>(`
    WITH battery_hourly AS (
      SELECT 
        EXTRACT(HOUR FROM timestamp)::int as hour_of_day,
        AVG(battery_level)::numeric(5,1) as avg_battery_level
      FROM battery_events
      ${whereClause}
      GROUP BY 1
    ),
    charge_hourly AS (
      SELECT 
        EXTRACT(HOUR FROM session_start)::int as hour_of_day,
        COUNT(*) as charge_starts
      FROM charging_sessions
      ${whereClause}
      GROUP BY 1
    ),
    app_hourly AS (
      SELECT 
        EXTRACT(HOUR FROM start_timestamp)::int as hour_of_day,
        SUM(duration_seconds) / 60.0 as app_usage_minutes
      FROM app_usage_events
      ${whereClause.replace('device_id', 'device_id').replace('group_id', 'group_id')}
      ${whereClause ? '' : 'WHERE'} ${whereClause ? 'AND' : ''} is_screen_off = FALSE
      GROUP BY 1
    )
    SELECT 
      COALESCE(b.hour_of_day, c.hour_of_day, a.hour_of_day) as hour_of_day,
      COALESCE(b.avg_battery_level, 0) as avg_battery_level,
      COALESCE(c.charge_starts, 0) as charge_starts,
      COALESCE(a.app_usage_minutes, 0)::numeric(10,1) as app_usage_minutes
    FROM battery_hourly b
    FULL OUTER JOIN charge_hourly c ON b.hour_of_day = c.hour_of_day
    FULL OUTER JOIN app_hourly a ON COALESCE(b.hour_of_day, c.hour_of_day) = a.hour_of_day
    ORDER BY 1
  `, params);
  logger.info('Fetched hourly usage patterns (grouped)', { rows: result.rows.length });
  return result.rows;
}

export async function getBatteryDistribution(deviceId?: string, groupId?: string): Promise<any[]> {
  logger.debug('Fetching battery distribution (grouped)', { deviceId: deviceId || 'all', groupId: groupId || 'all' });
  
  const conditions: string[] = [];
  const params: string[] = [];
  
  if (deviceId) {
    params.push(deviceId);
    conditions.push(`device_id = $${params.length}`);
  }
  if (groupId) {
    params.push(groupId);
    conditions.push(`group_id = $${params.length}`);
  }
  
  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  const result = await queryGrouped(`
    SELECT 
      FLOOR(battery_level / 10) * 10 as battery_range,
      COUNT(*) as count
    FROM battery_events
    ${whereClause}
    GROUP BY 1
    ORDER BY 1
  `, params);
  logger.info('Fetched battery distribution (grouped)', { rows: result.rows.length });
  return result.rows;
}

export interface ChargingByHour {
  hour: number;
  avg_start_level: number;
  sessions: number;
  avg_charge_gained: number;
  avg_duration: number;
}

export async function getChargingByHour(): Promise<ChargingByHour[]> {
  logger.debug('Fetching charging by hour (grouped)');
  const result = await queryGrouped<ChargingByHour>(`
    SELECT 
      EXTRACT(HOUR FROM session_start)::int as hour,
      AVG(start_battery_level)::numeric(5,1) as avg_start_level,
      COUNT(*) as sessions,
      AVG(charge_gained)::numeric(5,1) as avg_charge_gained,
      AVG(duration_minutes)::numeric(5,1) as avg_duration
    FROM charging_sessions
    WHERE is_complete = TRUE
    GROUP BY 1
    ORDER BY 1
  `);
  logger.info('Fetched charging by hour (grouped)', { rows: result.rows.length });
  return result.rows;
}

export interface AppBatteryImpact {
  app_name: string;
  devices: number;
  total_hours: number;
  total_sessions: number;
  avg_session_minutes: number;
}

export async function getAppBatteryImpact(limit = 20): Promise<AppBatteryImpact[]> {
  logger.debug('Fetching app battery impact (grouped)', { limit });
  const result = await queryGrouped<AppBatteryImpact>(`
    SELECT 
      COALESCE(app_name, package_name) as app_name,
      COUNT(DISTINCT (device_id, group_id)) as devices,
      SUM(duration_seconds) / 3600.0 as total_hours,
      COUNT(*) as total_sessions,
      AVG(duration_seconds / 60.0)::numeric(5,1) as avg_session_minutes
    FROM app_usage_events
    WHERE is_screen_off = FALSE 
      AND duration_seconds > 0
      AND (app_name IS NOT NULL OR package_name IS NOT NULL)
      AND app_name NOT IN ('device_locked', 'APP_OPENED', 'app_open', '')
    GROUP BY COALESCE(app_name, package_name)
    HAVING COUNT(*) >= 10
    ORDER BY total_hours DESC
    LIMIT $1
  `, [limit]);
  logger.info('Fetched app battery impact (grouped)', { rows: result.rows.length });
  return result.rows;
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

export async function getAppBatteryDrain(
  sortBy: 'hours' | 'drain' | 'sessions' | 'devices' = 'hours',
  limit = 20,
  deviceId?: string,
  groupId?: string
): Promise<AppBatteryDrain[]> {
  logger.debug('Fetching app battery drain (grouped)', { sortBy, limit, deviceId, groupId });
  
  const conditions: string[] = [
    'a.is_screen_off = FALSE',
    'a.duration_seconds BETWEEN 60 AND 7200',
    "(a.app_name IS NOT NULL OR a.package_name IS NOT NULL)"
  ];
  const params: (string | number)[] = [];
  
  if (deviceId) {
    params.push(deviceId);
    conditions.push(`a.device_id = $${params.length}`);
  }
  if (groupId) {
    params.push(groupId);
    conditions.push(`a.group_id = $${params.length}`);
  }
  
  const orderByMap = {
    hours: 'total_hours DESC',
    drain: 'drain_per_hour DESC NULLS LAST',
    sessions: 'sessions DESC',
    devices: 'devices DESC'
  };
  
  params.push(limit);
  
  const result = await queryGrouped<AppBatteryDrain>(`
    WITH app_battery_correlation AS (
      SELECT 
        a.device_id,
        a.group_id,
        COALESCE(a.app_name, a.package_name) as app_name,
        a.duration_seconds,
        b_start.battery_level as battery_at_start,
        b_end.battery_level as battery_at_end
      FROM app_usage_events a
      LEFT JOIN LATERAL (
        SELECT battery_level 
        FROM battery_events b 
        WHERE b.device_id = a.device_id 
          AND b.group_id = a.group_id
          AND b.timestamp <= a.start_timestamp
        ORDER BY b.timestamp DESC 
        LIMIT 1
      ) b_start ON true
      LEFT JOIN LATERAL (
        SELECT battery_level 
        FROM battery_events b 
        WHERE b.device_id = a.device_id 
          AND b.group_id = a.group_id
          AND b.timestamp >= a.end_timestamp
        ORDER BY b.timestamp ASC 
        LIMIT 1
      ) b_end ON true
      WHERE ${conditions.join(' AND ')}
    )
    SELECT 
      app_name,
      COUNT(*) as sessions,
      COUNT(DISTINCT (device_id, group_id)) as devices,
      (SUM(duration_seconds) / 3600.0)::numeric(10,1) as total_hours,
      AVG(duration_seconds / 60.0)::numeric(10,1) as avg_session_minutes,
      AVG(battery_at_start - battery_at_end)::numeric(10,1) as avg_battery_drain,
      AVG(
        CASE WHEN duration_seconds > 300 
        THEN (battery_at_start - battery_at_end)::numeric * 60.0 / (duration_seconds / 60.0) 
        ELSE NULL END
      )::numeric(10,2) as drain_per_hour
    FROM app_battery_correlation
    WHERE battery_at_start IS NOT NULL AND battery_at_end IS NOT NULL
      AND battery_at_start >= battery_at_end
      AND app_name NOT IN ('device_locked', 'APP_OPENED', 'app_open', '', 'One UI Home', 'System Launcher')
    GROUP BY app_name
    HAVING COUNT(*) >= 5 AND SUM(duration_seconds) > 300
    ORDER BY ${orderByMap[sortBy]}
    LIMIT $${params.length}
  `, params);
  
  logger.info('Fetched app battery drain (grouped)', { rows: result.rows.length });
  return result.rows;
}

export interface AppUsageByHour {
  hour: number;
  app_name: string;
  usage_minutes: number;
  sessions: number;
}

export interface UserBehaviorCluster {
  device_id: string;
  group_id: string;
  avg_charge_level: number;
  charge_frequency: number;
  avg_session_duration: number;
  screen_time_hours: number;
  top_app: string;
  behavior_type: string;
}

export async function getUserBehaviorClusters(): Promise<UserBehaviorCluster[]> {
  logger.debug('Fetching user behavior clusters (grouped)');
  const result = await queryGrouped<UserBehaviorCluster>(`
    WITH device_charging AS (
      SELECT 
        device_id, group_id,
        AVG(start_battery_level)::numeric(10,1) as avg_charge_level,
        COUNT(*)::numeric / NULLIF(MAX(session_start::date) - MIN(session_start::date) + 1, 0) as charge_frequency,
        AVG(duration_minutes)::numeric(10,1) as avg_session_duration
      FROM charging_sessions
      WHERE is_complete = TRUE
      GROUP BY device_id, group_id
    ),
    device_apps AS (
      SELECT DISTINCT ON (device_id, group_id)
        device_id, group_id,
        SUM(duration_seconds) OVER (PARTITION BY device_id, group_id) / 3600.0 as screen_time_hours,
        COALESCE(app_name, package_name) as top_app
      FROM app_usage_events
      WHERE is_screen_off = FALSE AND (app_name IS NOT NULL OR package_name IS NOT NULL)
        AND app_name NOT IN ('device_locked', 'One UI Home', 'System Launcher', '')
      ORDER BY device_id, group_id, duration_seconds DESC
    )
    SELECT 
      c.device_id,
      c.group_id,
      c.avg_charge_level,
      c.charge_frequency::numeric(10,2),
      c.avg_session_duration,
      COALESCE(a.screen_time_hours, 0)::numeric(10,1) as screen_time_hours,
      COALESCE(a.top_app, 'Unknown') as top_app,
      CASE 
        WHEN c.avg_charge_level < 25 THEN 'Low Battery User'
        WHEN c.avg_charge_level > 50 THEN 'Anxious Charger'
        WHEN c.charge_frequency > 3 THEN 'Frequent Charger'
        ELSE 'Average User'
      END as behavior_type
    FROM device_charging c
    LEFT JOIN device_apps a ON c.device_id = a.device_id AND c.group_id = a.group_id
    ORDER BY c.avg_charge_level
  `);
  logger.info('Fetched user behavior clusters (grouped)', { rows: result.rows.length });
  return result.rows;
}

export async function getAppUsageByHour(topN = 5): Promise<AppUsageByHour[]> {
  logger.debug('Fetching app usage by hour (grouped)', { topN });
  
  const result = await queryGrouped<AppUsageByHour>(`
    WITH top_apps AS (
      SELECT COALESCE(app_name, package_name) as app_name
      FROM app_usage_events
      WHERE is_screen_off = FALSE 
        AND (app_name IS NOT NULL OR package_name IS NOT NULL)
        AND app_name NOT IN ('device_locked', 'APP_OPENED', 'app_open', '', 'One UI Home', 'System Launcher')
      GROUP BY 1
      ORDER BY SUM(duration_seconds) DESC
      LIMIT $1
    )
    SELECT 
      EXTRACT(HOUR FROM start_timestamp)::int as hour,
      COALESCE(a.app_name, a.package_name) as app_name,
      (SUM(a.duration_seconds) / 60.0)::numeric(10,1) as usage_minutes,
      COUNT(*) as sessions
    FROM app_usage_events a
    WHERE is_screen_off = FALSE
      AND COALESCE(a.app_name, a.package_name) IN (SELECT app_name FROM top_apps)
    GROUP BY 1, 2
    ORDER BY 1, usage_minutes DESC
  `, [topN]);
  
  logger.info('Fetched app usage by hour (grouped)', { rows: result.rows.length });
  return result.rows;
}
