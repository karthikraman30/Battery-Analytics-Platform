/**
 * Carbon Footprint Service
 * 
 * Calculates CO2 emissions from smartphone charging based on:
 * - Battery capacity: 14.8 Wh (4000mAh × 3.7V - typical smartphone)
 * - Charging efficiency: 85% (typical for Li-ion)
 * - India grid carbon intensity: 663 gCO2/kWh (2023 average)
 * 
 * Formula: CO2 (grams) = charge_gained% × CARBON_FACTOR
 * Where CARBON_FACTOR = (14.8 Wh / 0.85 / 1000 kWh) × 663 gCO2/kWh / 100%
 *                     = 0.1155 gCO2 per 1% charge
 */
import { query } from '../db/connection';
import { logger } from '../lib/logger';

// Carbon calculation constants
export const CARBON_CONSTANTS = {
  BATTERY_CAPACITY_WH: 14.8,        // 4000mAh × 3.7V
  CHARGING_EFFICIENCY: 0.85,         // 85% efficiency
  GRID_CARBON_INTENSITY: 663,        // gCO2/kWh for India (2023)
  // Derived: gCO2 per 1% charge = (14.8 / 0.85 / 1000) * 663 / 100 = 0.1155
  CARBON_FACTOR: 0.1155,
};

// Comparison metrics (per kg CO2)
export const CARBON_COMPARISONS = {
  DRIVING_KM_PER_KG: 4.8,           // Average car: ~208 gCO2/km
  TREE_ABSORPTION_KG_YEAR: 21.77,   // One tree absorbs ~21.77 kg CO2/year
  LED_BULB_HOURS_PER_KG: 105,       // 10W LED: 663g/kWh * 10W = 6.63g/hr
  STREAMING_HOURS_PER_KG: 27.8,     // Netflix: ~36 gCO2/hour
};

// Types
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

export interface CarbonInsight {
  type: 'tip' | 'achievement' | 'warning' | 'info';
  title: string;
  description: string;
  metric?: string;
  potential_savings_g?: number;
}

export interface CarbonByTimeOfDay {
  time_period: string;
  co2_kg: number;
  sessions: number;
  avg_start_level: number;
  avg_charge_gained: number;
}

export interface CarbonByGroup {
  group_id: string;
  co2_kg: number;
  sessions: number;
  devices: number;
  avg_co2_per_device_g: number;
}

/**
 * Get overall carbon footprint summary
 */
export async function getCarbonSummary(): Promise<CarbonSummary> {
  logger.debug('Fetching carbon summary');
  
  const result = await query<{
    total_sessions: string;
    total_charge_gained: string;
    total_device_days: string;
    devices_count: string;
  }>(`
    WITH device_days AS (
      SELECT 
        device_id, 
        group_id,
        (MAX(session_start::date) - MIN(session_start::date) + 1) as days_active
      FROM charging_sessions
      WHERE is_complete = TRUE AND charge_gained > 0
      GROUP BY device_id, group_id
    )
    SELECT 
      COUNT(*) as total_sessions,
      SUM(charge_gained) as total_charge_gained,
      (SELECT SUM(days_active) FROM device_days) as total_device_days,
      COUNT(DISTINCT (device_id, group_id)) as devices_count
    FROM charging_sessions
    WHERE is_complete = TRUE AND charge_gained > 0
  `);
  
  const row = result.rows[0];
  const totalSessions = Number(row.total_sessions) || 0;
  const totalChargeGained = Number(row.total_charge_gained) || 0;
  const totalDeviceDays = Number(row.total_device_days) || 1;
  const devicesCount = Number(row.devices_count) || 1;
  
  const totalCO2Grams = totalChargeGained * CARBON_CONSTANTS.CARBON_FACTOR;
  const totalCO2Kg = totalCO2Grams / 1000;
  const avgCO2PerSession = totalSessions > 0 ? totalCO2Grams / totalSessions : 0;
  
  // Project annual per device: (total CO2 / device-days) * 365
  const avgDailyPerDevice = totalCO2Kg / totalDeviceDays;
  const projectedAnnualKg = avgDailyPerDevice * 365 * devicesCount;
  
  logger.info('Fetched carbon summary', { totalCO2Kg, totalSessions, totalDeviceDays });
  
  return {
    total_co2_kg: Math.round(totalCO2Kg * 1000) / 1000,
    total_co2_grams: Math.round(totalCO2Grams * 10) / 10,
    total_sessions: totalSessions,
    total_charge_gained: Math.round(totalChargeGained * 10) / 10,
    avg_co2_per_session_g: Math.round(avgCO2PerSession * 100) / 100,
    projected_annual_kg: Math.round(projectedAnnualKg * 100) / 100,
    data_days: totalDeviceDays,
    devices_count: devicesCount,
  };
}

/**
 * Get carbon footprint by device
 */
export async function getCarbonByDevice(limit = 50): Promise<CarbonByDevice[]> {
  logger.debug('Fetching carbon by device', { limit });
  
  const result = await query<{
    device_id: string;
    group_id: string;
    sessions: string;
    charge_gained: string;
  }>(`
    SELECT 
      device_id, 
      group_id,
      COUNT(*) as sessions,
      SUM(charge_gained) as charge_gained
    FROM charging_sessions
    WHERE is_complete = TRUE AND charge_gained > 0
    GROUP BY device_id, group_id
    ORDER BY charge_gained DESC
    LIMIT $1
  `, [limit]);
  
  const data = result.rows.map(row => {
    const chargeGained = Number(row.charge_gained) || 0;
    const sessions = Number(row.sessions) || 0;
    const co2Grams = chargeGained * CARBON_CONSTANTS.CARBON_FACTOR;
    
    return {
      device_id: row.device_id,
      group_id: row.group_id,
      co2_kg: Math.round(co2Grams / 1000 * 1000) / 1000,
      co2_grams: Math.round(co2Grams * 10) / 10,
      sessions,
      charge_gained: Math.round(chargeGained * 10) / 10,
      avg_co2_per_session_g: sessions > 0 ? Math.round(co2Grams / sessions * 100) / 100 : 0,
    };
  });
  
  logger.info('Fetched carbon by device', { count: data.length });
  return data;
}

/**
 * Get daily carbon trends
 */
export async function getCarbonTrends(): Promise<CarbonTrend[]> {
  logger.debug('Fetching carbon trends');
  
  const result = await query<{
    date: string;
    sessions: string;
    charge_gained: string;
  }>(`
    SELECT 
      session_start::date::text as date,
      COUNT(*) as sessions,
      SUM(charge_gained) as charge_gained
    FROM charging_sessions
    WHERE is_complete = TRUE AND charge_gained > 0
    GROUP BY 1
    ORDER BY 1
  `);
  
  const data = result.rows.map(row => {
    const chargeGained = Number(row.charge_gained) || 0;
    return {
      date: row.date,
      co2_grams: Math.round(chargeGained * CARBON_CONSTANTS.CARBON_FACTOR * 10) / 10,
      sessions: Number(row.sessions) || 0,
      charge_gained: Math.round(chargeGained * 10) / 10,
    };
  });
  
  logger.info('Fetched carbon trends', { days: data.length });
  return data;
}

/**
 * Get carbon comparisons (equivalencies)
 */
export async function getCarbonComparisons(): Promise<CarbonComparison> {
  logger.debug('Fetching carbon comparisons');
  
  const summary = await getCarbonSummary();
  const co2Kg = summary.total_co2_kg;
  
  const comparisons = {
    total_co2_kg: co2Kg,
    driving_km: Math.round(co2Kg * CARBON_COMPARISONS.DRIVING_KM_PER_KG * 10) / 10,
    trees_to_offset: Math.round(co2Kg / CARBON_COMPARISONS.TREE_ABSORPTION_KG_YEAR * 1000) / 1000,
    led_bulb_hours: Math.round(co2Kg * CARBON_COMPARISONS.LED_BULB_HOURS_PER_KG),
    streaming_hours: Math.round(co2Kg * CARBON_COMPARISONS.STREAMING_HOURS_PER_KG * 10) / 10,
  };
  
  logger.info('Fetched carbon comparisons', comparisons);
  return comparisons;
}

/**
 * Get carbon footprint by time of day
 */
export async function getCarbonByTimeOfDay(): Promise<CarbonByTimeOfDay[]> {
  logger.debug('Fetching carbon by time of day');
  
  const result = await query<{
    time_period: string;
    sessions: string;
    charge_gained: string;
    avg_start_level: string;
    avg_charge_gained: string;
  }>(`
    SELECT 
      CASE 
        WHEN EXTRACT(HOUR FROM session_start) BETWEEN 0 AND 5 THEN 'Night (12am-6am)'
        WHEN EXTRACT(HOUR FROM session_start) BETWEEN 6 AND 11 THEN 'Morning (6am-12pm)'
        WHEN EXTRACT(HOUR FROM session_start) BETWEEN 12 AND 17 THEN 'Afternoon (12pm-6pm)'
        ELSE 'Evening (6pm-12am)'
      END as time_period,
      COUNT(*) as sessions,
      SUM(charge_gained) as charge_gained,
      AVG(start_battery_level)::numeric(5,1) as avg_start_level,
      AVG(charge_gained)::numeric(5,1) as avg_charge_gained
    FROM charging_sessions
    WHERE is_complete = TRUE AND charge_gained > 0
    GROUP BY 1
    ORDER BY 
      CASE 
        WHEN EXTRACT(HOUR FROM MIN(session_start)) BETWEEN 0 AND 5 THEN 1
        WHEN EXTRACT(HOUR FROM MIN(session_start)) BETWEEN 6 AND 11 THEN 2
        WHEN EXTRACT(HOUR FROM MIN(session_start)) BETWEEN 12 AND 17 THEN 3
        ELSE 4
      END
  `);
  
  const data = result.rows.map(row => ({
    time_period: row.time_period,
    co2_kg: Math.round(Number(row.charge_gained) * CARBON_CONSTANTS.CARBON_FACTOR / 1000 * 1000) / 1000,
    sessions: Number(row.sessions) || 0,
    avg_start_level: Number(row.avg_start_level) || 0,
    avg_charge_gained: Number(row.avg_charge_gained) || 0,
  }));
  
  logger.info('Fetched carbon by time of day', { periods: data.length });
  return data;
}

/**
 * Get carbon footprint by group
 */
export async function getCarbonByGroup(): Promise<CarbonByGroup[]> {
  logger.debug('Fetching carbon by group');
  
  const result = await query<{
    group_id: string;
    sessions: string;
    charge_gained: string;
    devices: string;
  }>(`
    SELECT 
      group_id,
      COUNT(*) as sessions,
      SUM(charge_gained) as charge_gained,
      COUNT(DISTINCT device_id) as devices
    FROM charging_sessions
    WHERE is_complete = TRUE AND charge_gained > 0
    GROUP BY group_id
    ORDER BY charge_gained DESC
  `);
  
  const data = result.rows.map(row => {
    const chargeGained = Number(row.charge_gained) || 0;
    const devices = Number(row.devices) || 1;
    const co2Grams = chargeGained * CARBON_CONSTANTS.CARBON_FACTOR;
    
    return {
      group_id: row.group_id,
      co2_kg: Math.round(co2Grams / 1000 * 1000) / 1000,
      sessions: Number(row.sessions) || 0,
      devices,
      avg_co2_per_device_g: Math.round(co2Grams / devices * 100) / 100,
    };
  });
  
  logger.info('Fetched carbon by group', { groups: data.length });
  return data;
}

/**
 * Generate carbon insights and tips
 */
export async function getCarbonInsights(): Promise<CarbonInsight[]> {
  logger.debug('Generating carbon insights');
  
  const insights: CarbonInsight[] = [];
  
  // Get summary for context
  const summary = await getCarbonSummary();
  const timeOfDay = await getCarbonByTimeOfDay();
  
  // Get charging behavior stats
  const behaviorResult = await query<{
    avg_start_level: string;
    full_charge_pct: string;
    night_charge_pct: string;
    top_up_pct: string;
  }>(`
    WITH charging_analysis AS (
      SELECT 
        AVG(start_battery_level) as avg_start_level,
        COUNT(*) FILTER (WHERE end_battery_level >= 95) * 100.0 / NULLIF(COUNT(*), 0) as full_charge_pct,
        COUNT(*) FILTER (WHERE EXTRACT(HOUR FROM session_start) BETWEEN 0 AND 5) * 100.0 / NULLIF(COUNT(*), 0) as night_charge_pct,
        COUNT(*) FILTER (WHERE charge_gained < 30) * 100.0 / NULLIF(COUNT(*), 0) as top_up_pct
      FROM charging_sessions
      WHERE is_complete = TRUE AND charge_gained > 0
    )
    SELECT * FROM charging_analysis
  `);
  
  const behavior = behaviorResult.rows[0];
  const avgStartLevel = Number(behavior.avg_start_level) || 0;
  const fullChargePct = Number(behavior.full_charge_pct) || 0;
  const nightChargePct = Number(behavior.night_charge_pct) || 0;
  const topUpPct = Number(behavior.top_up_pct) || 0;
  
  // Insight 1: Per-device daily average
  const avgDailyCO2PerDevice = summary.devices_count > 0 
    ? (summary.total_co2_grams / summary.data_days / summary.devices_count) 
    : 0;
  
  insights.push({
    type: 'info',
    title: 'Daily Carbon Footprint',
    description: `On average, each device produces ${avgDailyCO2PerDevice.toFixed(1)}g of CO2 per day from charging.`,
    metric: `${avgDailyCO2PerDevice.toFixed(1)}g/day`,
  });
  
  // Insight 2: Night charging (potentially cleaner grid at off-peak)
  const nightPeriod = timeOfDay.find(t => t.time_period.includes('Night'));
  if (nightChargePct > 20) {
    insights.push({
      type: 'tip',
      title: 'Night Charging Detected',
      description: `${nightChargePct.toFixed(0)}% of charging happens at night. Off-peak charging can be more grid-efficient in some regions.`,
      metric: `${nightChargePct.toFixed(0)}%`,
    });
  }
  
  // Insight 3: Full charge impact
  if (fullChargePct > 40) {
    const potentialSavings = summary.total_co2_grams * 0.15; // ~15% savings by charging to 80%
    insights.push({
      type: 'tip',
      title: 'Optimize Charge Levels',
      description: `${fullChargePct.toFixed(0)}% of sessions charge to 100%. Charging to 80% can save ~15% energy and extend battery life.`,
      potential_savings_g: Math.round(potentialSavings),
    });
  }
  
  // Insight 4: Low battery charging (good or bad)
  if (avgStartLevel < 25) {
    insights.push({
      type: 'warning',
      title: 'Low Battery Charging',
      description: `Average charge starts at ${avgStartLevel.toFixed(0)}% battery. Frequent deep discharges can reduce battery lifespan.`,
      metric: `${avgStartLevel.toFixed(0)}%`,
    });
  } else if (avgStartLevel > 50) {
    insights.push({
      type: 'achievement',
      title: 'Good Charging Habits',
      description: `Average charge starts at ${avgStartLevel.toFixed(0)}% battery. This helps preserve battery health!`,
      metric: `${avgStartLevel.toFixed(0)}%`,
    });
  }
  
  // Insight 5: Top-up charging
  if (topUpPct > 30) {
    insights.push({
      type: 'info',
      title: 'Frequent Top-ups',
      description: `${topUpPct.toFixed(0)}% of charges are small top-ups (<30%). This is generally good for battery longevity.`,
      metric: `${topUpPct.toFixed(0)}%`,
    });
  }
  
  // Insight 6: Comparison context
  const comparisons = await getCarbonComparisons();
  insights.push({
    type: 'info',
    title: 'Environmental Context',
    description: `Total charging CO2 equals ${comparisons.driving_km.toFixed(1)}km of driving or ${comparisons.streaming_hours.toFixed(0)} hours of video streaming.`,
    metric: `${summary.total_co2_kg.toFixed(2)}kg CO2`,
  });
  
  logger.info('Generated carbon insights', { count: insights.length });
  return insights;
}
