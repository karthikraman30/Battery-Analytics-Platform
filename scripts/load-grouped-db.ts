import { parse } from 'csv-parse/sync';
import * as fs from 'fs';
import * as path from 'path';
import { Pool } from 'pg';

const BATCH_SIZE = 5000;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'battery_analytics_grouped',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

interface LoadStats {
  battery_events: number;
  app_usage_events: number;
  network_events: number;
  charging_sessions: number;
  errors: string[];
}

function escapeSQL(str: string): string {
  if (!str) return '';
  return str.replace(/'/g, "''").replace(/\\/g, '\\\\');
}

async function loadBatteryEvents(filePath: string, stats: LoadStats): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.log('   ⚠️  battery_events.csv not found, skipping');
    return;
  }
  
  console.log('   Loading battery_events...');
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true });
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const values = batch.map((row: any) => 
      `('${escapeSQL(row.device_id)}', '${escapeSQL(row.group_id)}', '${row.timestamp}', '${escapeSQL(row.event_type)}', ${parseFloat(row.battery_level) || 0})`
    ).join(',\n');
    
    const sql = `INSERT INTO battery_events (device_id, group_id, timestamp, event_type, battery_level) VALUES ${values} ON CONFLICT DO NOTHING;`;
    
    try {
      await pool.query(sql);
      stats.battery_events += batch.length;
    } catch (error) {
      stats.errors.push(`Battery batch ${i}: ${error}`);
    }
    
    if ((i + BATCH_SIZE) % 10000 === 0) {
      console.log(`      Loaded ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
    }
  }
  
  console.log(`   ✅ Loaded ${stats.battery_events} battery events`);
}

async function loadAppUsageEvents(filePath: string, stats: LoadStats): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.log('   ⚠️  app_usage_events.csv not found, skipping');
    return;
  }
  
  console.log('   Loading app_usage_events (this may take a while)...');
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true });
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const values = batch.map((row: any) => 
      `('${escapeSQL(row.device_id)}', '${escapeSQL(row.group_id)}', '${row.start_timestamp}', '${row.end_timestamp}', ${parseFloat(row.duration_seconds) || 0}, '${escapeSQL(row.package_name)}', '${escapeSQL(row.app_name)}', ${row.is_screen_off === 'true'})`
    ).join(',\n');
    
    const sql = `INSERT INTO app_usage_events (device_id, group_id, start_timestamp, end_timestamp, duration_seconds, package_name, app_name, is_screen_off) VALUES ${values} ON CONFLICT DO NOTHING;`;
    
    try {
      await pool.query(sql);
      stats.app_usage_events += batch.length;
    } catch (error) {
      stats.errors.push(`App usage batch ${i}: ${error}`);
    }
    
    if ((i + BATCH_SIZE) % 50000 === 0) {
      console.log(`      Loaded ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
    }
  }
  
  console.log(`   ✅ Loaded ${stats.app_usage_events} app usage events`);
}

async function loadNetworkEvents(filePath: string, stats: LoadStats, limit: number = 200000): Promise<void> {
  if (!fs.existsSync(filePath)) {
    console.log('   ⚠️  network_events.csv not found, skipping');
    return;
  }
  
  console.log(`   Loading network_events (limiting to ${limit.toLocaleString()} for performance)...`);
  const content = fs.readFileSync(filePath, 'utf-8');
  const allRecords = parse(content, { columns: true, skip_empty_lines: true });
  
  const records = allRecords.length > limit 
    ? allRecords.filter((_: any, i: number) => i % Math.ceil(allRecords.length / limit) === 0).slice(0, limit)
    : allRecords;
  
  console.log(`      Sampling ${records.length} of ${allRecords.length} records`);
  
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const values = batch.map((row: any) => 
      `('${escapeSQL(row.device_id)}', '${escapeSQL(row.group_id)}', '${row.timestamp}', '${escapeSQL(row.ssid)}', ${row.is_wifi === 'true'}, ${parseFloat(row.signal_strength) || 0})`
    ).join(',\n');
    
    const sql = `INSERT INTO network_events (device_id, group_id, timestamp, ssid, is_wifi, signal_strength) VALUES ${values} ON CONFLICT DO NOTHING;`;
    
    try {
      await pool.query(sql);
      stats.network_events += batch.length;
    } catch (error) {
      stats.errors.push(`Network batch ${i}: ${error}`);
    }
    
    if ((i + BATCH_SIZE) % 100000 === 0) {
      console.log(`      Loaded ${Math.min(i + BATCH_SIZE, records.length)} / ${records.length}`);
    }
  }
  
  console.log(`   ✅ Loaded ${stats.network_events} network events`);
}

async function deriveChargingSessions(stats: LoadStats): Promise<void> {
  console.log('   Deriving charging sessions...');
  
  const sql = `
    WITH ordered_events AS (
      SELECT 
        device_id,
        group_id,
        timestamp,
        event_type,
        battery_level,
        LEAD(timestamp) OVER (PARTITION BY device_id ORDER BY timestamp) AS next_timestamp,
        LEAD(event_type) OVER (PARTITION BY device_id ORDER BY timestamp) AS next_event_type,
        LEAD(battery_level) OVER (PARTITION BY device_id ORDER BY timestamp) AS next_battery_level
      FROM battery_events
    )
    INSERT INTO charging_sessions (
      device_id, group_id, session_start, session_end, 
      duration_minutes, start_battery_level, end_battery_level, 
      charge_gained, is_complete
    )
    SELECT 
      device_id,
      group_id,
      timestamp AS session_start,
      next_timestamp AS session_end,
      EXTRACT(EPOCH FROM (next_timestamp - timestamp)) / 60.0 AS duration_minutes,
      battery_level AS start_battery_level,
      next_battery_level AS end_battery_level,
      next_battery_level - battery_level AS charge_gained,
      next_event_type = 'power_disconnected' AS is_complete
    FROM ordered_events
    WHERE event_type = 'power_connected'
      AND next_timestamp IS NOT NULL
      AND next_timestamp > timestamp
      AND EXTRACT(EPOCH FROM (next_timestamp - timestamp)) < 86400
    ON CONFLICT DO NOTHING;
  `;
  
  try {
    await pool.query(sql);
    
    const result = await pool.query('SELECT COUNT(*) FROM charging_sessions;');
    stats.charging_sessions = parseInt(result.rows[0].count) || 0;
    console.log(`   ✅ Derived ${stats.charging_sessions} charging sessions`);
  } catch (error) {
    stats.errors.push(`Charging sessions: ${error}`);
    console.log(`   ❌ Error: ${error}`);
  }
}

async function loadGroupedData(): Promise<void> {
  console.log('📥 Loading grouped data into TimescaleDB...');
  console.log(`   Host: ${pool.options.host}:${pool.options.port}`);
  console.log(`   Database: ${pool.options.database}`);
  console.log('');
  
  const stats: LoadStats = {
    battery_events: 0,
    app_usage_events: 0,
    network_events: 0,
    charging_sessions: 0,
    errors: [],
  };
  
  const baseDir = path.resolve(__dirname, '..');
  const dataDir = path.join(baseDir, 'consolidated_grouped_data');
  
  if (!fs.existsSync(dataDir)) {
    console.error('❌ consolidated_grouped_data directory not found. Run consolidate-grouped.ts first.');
    process.exit(1);
  }
  
  await loadBatteryEvents(path.join(dataDir, 'battery_events.csv'), stats);
  await loadAppUsageEvents(path.join(dataDir, 'app_usage_events.csv'), stats);
  await loadNetworkEvents(path.join(dataDir, 'network_events.csv'), stats, 200000);
  
  await deriveChargingSessions(stats);
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 GROUPED DATA LOAD SUMMARY');
  console.log('='.repeat(50));
  console.log(`Battery events:     ${stats.battery_events.toLocaleString()}`);
  console.log(`App usage events:   ${stats.app_usage_events.toLocaleString()}`);
  console.log(`Network events:     ${stats.network_events.toLocaleString()}`);
  console.log(`Charging sessions:  ${stats.charging_sessions.toLocaleString()}`);
  
  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 5).forEach(e => console.log(`   - ${e}`));
  }
  
  console.log('\n✅ Grouped data loading complete!');
  
  await pool.end();
}

loadGroupedData();
