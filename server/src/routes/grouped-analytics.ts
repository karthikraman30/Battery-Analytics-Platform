import { Elysia, t } from 'elysia';
import * as groupedAnalytics from '../services/grouped-analytics';

function parseChargingStats(data: Record<string, unknown> | null) {
  if (!data) return null;
  return {
    device_id: data.device_id,
    total_sessions: Number(data.total_sessions) || 0,
    avg_duration_minutes: Number(data.avg_duration_minutes) || 0,
    avg_start_level: Number(data.avg_start_level) || 0,
    avg_charge_gained: Number(data.avg_charge_gained) || 0,
    complete_sessions: Number(data.complete_sessions) || 0,
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

export const groupedAnalyticsRoutes = new Elysia({ prefix: '/api/grouped/analytics' })
  
  .get('/battery-timeseries', async ({ query }) => {
    const { device_id, group_id, start_date, end_date, granularity } = query;
    const data = await groupedAnalytics.getBatteryTimeSeries(
      device_id,
      group_id,
      start_date,
      end_date,
      (granularity as 'raw' | 'hour' | 'day') || 'raw'
    );
    return { data, count: data.length };
  }, {
    query: t.Object({
      device_id: t.String(),
      group_id: t.String(),
      start_date: t.Optional(t.String()),
      end_date: t.Optional(t.String()),
      granularity: t.Optional(t.String())
    })
  })
  
  .get('/charging-sessions', async ({ query }) => {
    const { device_id, group_id, start_date, end_date } = query;
    const data = await groupedAnalytics.getChargingSessions(device_id, group_id, start_date, end_date);
    return { data, count: data.length };
  }, {
    query: t.Object({
      device_id: t.String(),
      group_id: t.String(),
      start_date: t.Optional(t.String()),
      end_date: t.Optional(t.String())
    })
  })
  
  .get('/charging-stats', async ({ query }) => {
    const { device_id, group_id } = query;
    const rawData = await groupedAnalytics.getChargingStats(device_id, group_id);
    const data = parseChargingStats(rawData as unknown as Record<string, unknown> | null);
    return { data };
  }, {
    query: t.Object({
      device_id: t.String(),
      group_id: t.String()
    })
  })
  
  .get('/charging-patterns', async ({ query }) => {
    const { device_id, group_id } = query;
    const rawData = await groupedAnalytics.getChargingPatterns(device_id, group_id);
    const data = parseChargingPatterns(rawData as unknown as Record<string, unknown>[]);
    return { data };
  }, {
    query: t.Optional(t.Object({
      device_id: t.Optional(t.String()),
      group_id: t.Optional(t.String())
    }))
  })
  
  .get('/app-usage', async ({ query }) => {
    const { device_id, group_id, group_by, limit } = query;
    const data = await groupedAnalytics.getAppUsage(
      device_id,
      group_id,
      (group_by as 'app' | 'category') || 'app',
      limit ? parseInt(limit) : 20
    );
    return { data, count: data.length };
  }, {
    query: t.Object({
      device_id: t.String(),
      group_id: t.String(),
      group_by: t.Optional(t.String()),
      limit: t.Optional(t.String())
    })
  })
  
  .get('/battery-distribution', async ({ query }) => {
    const { device_id, group_id } = query;
    const data = await groupedAnalytics.getBatteryDistribution(device_id, group_id);
    return { data };
  }, {
    query: t.Optional(t.Object({
      device_id: t.Optional(t.String()),
      group_id: t.Optional(t.String())
    }))
  });
