/**
 * Aggregate Statistics API Routes
 */
import { Elysia, t } from 'elysia';
import * as analytics from '../services/analytics';

function parseNumericStats(data: Record<string, unknown>): Record<string, number> {
  return {
    total_devices: Number(data.total_devices) || 0,
    total_groups: Number(data.total_groups) || 0,
    total_battery_events: Number(data.total_battery_events) || 0,
    total_charging_sessions: Number(data.total_charging_sessions) || 0,
    total_app_events: Number(data.total_app_events) || 0,
    avg_charge_frequency: Number(data.avg_charge_frequency) || 0,
    avg_session_duration: Number(data.avg_session_duration) || 0,
    avg_battery_at_charge: Number(data.avg_battery_at_charge) || 0,
  };
}

function parseChargingPatterns(data: Record<string, unknown>[]) {
  return data.map(item => ({
    hour_of_day: Number(item.hour_of_day) || 0,
    day_of_week: Number(item.day_of_week) || 0,
    charge_count: Number(item.charge_count) || 0,
    avg_duration: Number(item.avg_duration) || 0,
    avg_start_level: Number(item.avg_start_level) || 0,
  }));
}

function parseBatteryDistribution(data: Record<string, unknown>[]) {
  return data.map(item => ({
    battery_range: Number(item.battery_range) || 0,
    count: Number(item.count) || 0,
  }));
}

function parseBoxPlotStats(data: Record<string, unknown>[]) {
  return data.map(item => ({
    group_id: String(item.group_id),
    device_id: String(item.device_id),
    min: Number(item.min) || 0,
    q1: Number(item.q1) || 0,
    median: Number(item.median) || 0,
    q3: Number(item.q3) || 0,
    max: Number(item.max) || 0,
    mean: Number(item.mean) || 0,
    count: Number(item.count) || 0,
  }));
}

function parseChargingDurationStats(data: Record<string, unknown>[]) {
  return data.map(item => ({
    group_id: String(item.group_id),
    device_id: String(item.device_id),
    min_duration: Number(item.min_duration) || 0,
    q1_duration: Number(item.q1_duration) || 0,
    median_duration: Number(item.median_duration) || 0,
    q3_duration: Number(item.q3_duration) || 0,
    max_duration: Number(item.max_duration) || 0,
    avg_duration: Number(item.avg_duration) || 0,
    session_count: Number(item.session_count) || 0,
  }));
}

function parseGroupStats(data: Record<string, unknown>[]) {
  return data.map(item => ({
    group_id: String(item.group_id),
    device_count: Number(item.device_count) || 0,
    battery_events: Number(item.battery_events) || 0,
    charging_sessions: Number(item.charging_sessions) || 0,
    avg_battery_level: Number(item.avg_battery_level) || 0,
    avg_charge_gained: Number(item.avg_charge_gained) || 0,
    avg_session_duration: Number(item.avg_session_duration) || 0,
    first_date: String(item.first_date),
    last_date: String(item.last_date),
  }));
}

function parseHourlyPatterns(data: Record<string, unknown>[]) {
  return data.map(item => ({
    hour_of_day: Number(item.hour_of_day) || 0,
    avg_battery_level: Number(item.avg_battery_level) || 0,
    charge_starts: Number(item.charge_starts) || 0,
    app_usage_minutes: Number(item.app_usage_minutes) || 0,
  }));
}

export const aggregateRoutes = new Elysia({ prefix: '/api/aggregates' })
  
  .get('/stats', async () => {
    const rawData = await analytics.getOverallStats();
    const data = parseNumericStats(rawData as unknown as Record<string, unknown>);
    return { data };
  })
  
  .get('/charging-patterns', async () => {
    const rawData = await analytics.getChargingPatterns();
    const data = parseChargingPatterns(rawData as unknown as Record<string, unknown>[]);
    return { data };
  })
  
  .get('/top-apps', async ({ query }) => {
    const limit = query.limit ? parseInt(query.limit) : 20;
    const data = await analytics.getTopApps(limit);
    return { data, count: data.length };
  }, {
    query: t.Optional(t.Object({
      limit: t.Optional(t.String())
    }))
  })
  
  .get('/battery-distribution', async () => {
    const rawData = await analytics.getBatteryDistribution();
    const data = parseBatteryDistribution(rawData as unknown as Record<string, unknown>[]);
    return { data };
  })
  
  .get('/battery-boxplot', async ({ query }) => {
    const groupBy = (query.group_by as 'device' | 'group') || 'device';
    const rawData = await analytics.getBatteryBoxPlotStats(groupBy);
    const data = parseBoxPlotStats(rawData as unknown as Record<string, unknown>[]);
    return { data, count: data.length };
  }, {
    query: t.Optional(t.Object({
      group_by: t.Optional(t.String())
    }))
  })
  
  .get('/charging-duration-boxplot', async ({ query }) => {
    const groupBy = (query.group_by as 'device' | 'group') || 'device';
    const rawData = await analytics.getChargingDurationBoxPlot(groupBy);
    const data = parseChargingDurationStats(rawData as unknown as Record<string, unknown>[]);
    return { data, count: data.length };
  }, {
    query: t.Optional(t.Object({
      group_by: t.Optional(t.String())
    }))
  })
  
  .get('/groups', async () => {
    const rawData = await analytics.getGroupStats();
    const data = parseGroupStats(rawData as unknown as Record<string, unknown>[]);
    return { data, count: data.length };
  })
  
  .get('/hourly-patterns', async ({ query }) => {
    const { device_id, group_id } = query;
    const rawData = await analytics.getHourlyUsagePatterns(device_id, group_id);
    const data = parseHourlyPatterns(rawData as unknown as Record<string, unknown>[]);
    return { data };
  }, {
    query: t.Optional(t.Object({
      device_id: t.Optional(t.String()),
      group_id: t.Optional(t.String())
    }))
  })
  
  .get('/charging-by-hour', async () => {
    const rawData = await analytics.getChargingByHour();
    const data = rawData.map(item => ({
      hour: Number(item.hour),
      avg_start_level: Number(item.avg_start_level),
      sessions: Number(item.sessions),
      avg_charge_gained: Number(item.avg_charge_gained),
      avg_duration: Number(item.avg_duration),
    }));
    return { data };
  })
  
  .get('/app-impact', async ({ query }) => {
    const limit = query.limit ? parseInt(query.limit) : 20;
    const rawData = await analytics.getAppBatteryImpact(limit);
    const data = rawData.map(item => ({
      app_name: String(item.app_name),
      devices: Number(item.devices),
      total_hours: Number(item.total_hours),
      total_sessions: Number(item.total_sessions),
      avg_session_minutes: Number(item.avg_session_minutes),
    }));
    return { data, count: data.length };
  }, {
    query: t.Optional(t.Object({
      limit: t.Optional(t.String())
    }))
  })
  
  .get('/daily-summary', async ({ query }) => {
    const { device_id, group_id } = query;
    const rawData = await analytics.getDailyUsageSummary(device_id, group_id);
    const data = rawData.map(item => ({
      date: String(item.date),
      total_screen_time_hours: Number(item.total_screen_time_hours),
      charging_sessions: Number(item.charging_sessions),
      avg_battery_level: Number(item.avg_battery_level),
      unique_apps: Number(item.unique_apps),
    }));
    return { data };
  }, {
    query: t.Optional(t.Object({
      device_id: t.Optional(t.String()),
      group_id: t.Optional(t.String())
    }))
  })
  
  .get('/user-behaviors', async () => {
    const rawData = await analytics.getUserBehaviorClusters();
    const data = rawData.map(item => ({
      device_id: String(item.device_id),
      group_id: String(item.group_id),
      avg_charge_level: Number(item.avg_charge_level),
      charge_frequency: Number(item.charge_frequency),
      avg_session_duration: Number(item.avg_session_duration),
      screen_time_hours: Number(item.screen_time_hours),
      top_app: String(item.top_app),
      behavior_type: String(item.behavior_type),
    }));
    return { data, count: data.length };
  })
  
  .get('/app-battery-drain', async ({ query }) => {
    const sortBy = (query.sort_by as 'hours' | 'drain' | 'sessions' | 'devices') || 'hours';
    const limit = query.limit ? parseInt(query.limit) : 20;
    const rawData = await analytics.getAppBatteryDrain(sortBy, limit, query.device_id, query.group_id);
    const data = rawData.map(item => ({
      app_name: String(item.app_name),
      sessions: Number(item.sessions),
      devices: Number(item.devices),
      total_hours: Number(item.total_hours),
      avg_session_minutes: Number(item.avg_session_minutes),
      avg_battery_drain: Number(item.avg_battery_drain) || 0,
      drain_per_hour: Number(item.drain_per_hour) || 0,
    }));
    return { data, count: data.length };
  }, {
    query: t.Optional(t.Object({
      sort_by: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      device_id: t.Optional(t.String()),
      group_id: t.Optional(t.String())
    }))
  })
  
  .get('/app-usage-by-hour', async ({ query }) => {
    const topN = query.top_n ? parseInt(query.top_n) : 5;
    const rawData = await analytics.getAppUsageByHour(topN);
    const data = rawData.map(item => ({
      hour: Number(item.hour),
      app_name: String(item.app_name),
      usage_minutes: Number(item.usage_minutes),
      sessions: Number(item.sessions),
    }));
    return { data };
  }, {
    query: t.Optional(t.Object({
      top_n: t.Optional(t.String())
    }))
  });
