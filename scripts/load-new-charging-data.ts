/**
 * Load battery charging data into battery_charging_new database
 * Handles data inconsistencies: duplicate rows, date formats, event type mappings
 * Run with: DB_PORT=5433 DB_NAME=battery_charging_new bun run load-new-charging-data.ts
 */

import { Pool } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { parse } from 'csv-parse/sync';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'battery_charging_new',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

interface RawCsvRow {
  id: string;
  event_type: string;
  percentage: string;
  date: string;
  time: string;
  timezone: string;
}

interface ProcessedEvent {
  user_id: string;
  original_id: number;
  event_type: string;
  battery_level: number;
  event_timestamp: string;
  event_date: string;
  event_time: string;
  timezone: string;
  source_file: string;
  is_duplicate: boolean;
}

interface DataQualityIssue {
  user_id: string;
  issue_type: string;
  description: string;
  affected_rows: number;
  source_file: string;
}

const DATA_DIR = '/Users/karthikraman/Workspace/bmp_data/new_data_users/battery_charging_data(with 94)';

function extractUserId(filename: string): string {
  const match = filename.match(/battery_charging_data_(\d+)\.csv/);
  return match ? `user_${match[1]}` : 'user_unknown';
}

function normalizeEventType(eventType: string): string {
  const type = eventType.toLowerCase().trim();
  if (type === 'charging' || type === 'power_connected') return 'power_connected';
  if (type === 'discharging' || type === 'power_disconnected') return 'power_disconnected';
  return type;
}

function normalizeDate(dateStr: string): string {
  if (dateStr.match(/^\d{2}-\d{2}-\d{4}$/)) {
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`;
  }
  return dateStr;
}

function processFile(filePath: string): { events: ProcessedEvent[], issues: DataQualityIssue[] } {
  const fileName = basename(filePath);
  const userId = extractUserId(fileName);
  const events: ProcessedEvent[] = [];
  const issues: DataQualityIssue[] = [];
  
  const content = readFileSync(filePath, 'utf-8');
  const rows: RawCsvRow[] = parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  });
  
  if (rows.length === 0) {
    issues.push({
      user_id: userId,
      issue_type: 'empty_file',
      description: 'File contains no data rows',
      affected_rows: 0,
      source_file: fileName,
    });
    return { events, issues };
  }

  let dateFormatIssues = 0;
  let eventTypeMappings = 0;
  const seenRows = new Set<string>();
  let duplicateCount = 0;

  for (const row of rows) {
    const originalDate = row.date;
    const normalizedDate = normalizeDate(originalDate);
    if (normalizedDate !== originalDate) dateFormatIssues++;

    const originalEventType = row.event_type;
    const normalizedEventType = normalizeEventType(originalEventType);
    if (normalizedEventType !== originalEventType.toLowerCase()) eventTypeMappings++;

    const rowKey = `${row.event_type}|${row.percentage}|${row.date}|${row.time}`;
    const isDuplicate = seenRows.has(rowKey);
    if (isDuplicate) {
      duplicateCount++;
    } else {
      seenRows.add(rowKey);
    }

    const timestamp = `${normalizedDate} ${row.time}${row.timezone}`;
    
    events.push({
      user_id: userId,
      original_id: parseInt(row.id) || 0,
      event_type: normalizedEventType,
      battery_level: Math.min(100, Math.max(0, parseInt(row.percentage) || 0)),
      event_timestamp: timestamp,
      event_date: normalizedDate,
      event_time: row.time,
      timezone: row.timezone || '+05:30',
      source_file: fileName,
      is_duplicate: isDuplicate,
    });
  }

  if (dateFormatIssues > 0) {
    issues.push({
      user_id: userId,
      issue_type: 'date_format',
      description: `DD-MM-YYYY format converted to YYYY-MM-DD`,
      affected_rows: dateFormatIssues,
      source_file: fileName,
    });
  }

  if (eventTypeMappings > 0) {
    issues.push({
      user_id: userId,
      issue_type: 'event_type_mapping',
      description: `Event types normalized (charging→power_connected, discharging→power_disconnected)`,
      affected_rows: eventTypeMappings,
      source_file: fileName,
    });
  }

  if (duplicateCount > 0) {
    issues.push({
      user_id: userId,
      issue_type: 'duplicate',
      description: `Duplicate rows detected and flagged`,
      affected_rows: duplicateCount,
      source_file: fileName,
    });
  }

  return { events, issues };
}

async function insertEvents(client: any, events: ProcessedEvent[]): Promise<number> {
  if (events.length === 0) return 0;

  const BATCH_SIZE = 500;
  let inserted = 0;

  for (let i = 0; i < events.length; i += BATCH_SIZE) {
    const batch = events.slice(i, i + BATCH_SIZE);
    const values: any[] = [];
    const placeholders: string[] = [];

    batch.forEach((e, idx) => {
      const offset = idx * 10;
      placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
      values.push(
        e.user_id,
        e.original_id,
        e.event_type,
        e.battery_level,
        e.event_timestamp,
        e.event_date,
        e.event_time,
        e.timezone,
        e.source_file,
        e.is_duplicate
      );
    });

    await client.query(`
      INSERT INTO battery_events (user_id, original_id, event_type, battery_level, event_timestamp, event_date, event_time, timezone, source_file, is_duplicate)
      VALUES ${placeholders.join(', ')}
      ON CONFLICT DO NOTHING
    `, values);

    inserted += batch.length;
  }

  return inserted;
}

async function insertIssues(client: any, issues: DataQualityIssue[]): Promise<void> {
  for (const issue of issues) {
    await client.query(`
      INSERT INTO data_quality_issues (user_id, issue_type, description, affected_rows, source_file)
      VALUES ($1, $2, $3, $4, $5)
    `, [issue.user_id, issue.issue_type, issue.description, issue.affected_rows, issue.source_file]);
  }
}

async function generateChargingSessions(client: any): Promise<number> {
  const result = await client.query(`
    WITH ordered_events AS (
      SELECT 
        id,
        user_id,
        event_type,
        battery_level,
        event_timestamp,
        LEAD(event_type) OVER (PARTITION BY user_id ORDER BY event_timestamp) as next_event_type,
        LEAD(battery_level) OVER (PARTITION BY user_id ORDER BY event_timestamp) as next_battery_level,
        LEAD(event_timestamp) OVER (PARTITION BY user_id ORDER BY event_timestamp) as next_timestamp,
        LEAD(id) OVER (PARTITION BY user_id ORDER BY event_timestamp) as next_id
      FROM battery_events
      WHERE is_duplicate = FALSE
    )
    INSERT INTO charging_sessions (user_id, session_start, session_end, start_battery_level, end_battery_level, duration_minutes, is_complete, start_event_id, end_event_id)
    SELECT 
      user_id,
      event_timestamp as session_start,
      next_timestamp as session_end,
      battery_level as start_battery_level,
      next_battery_level as end_battery_level,
      EXTRACT(EPOCH FROM (next_timestamp - event_timestamp)) / 60.0 as duration_minutes,
      TRUE as is_complete,
      id as start_event_id,
      next_id as end_event_id
    FROM ordered_events
    WHERE event_type = 'power_connected' 
      AND next_event_type = 'power_disconnected'
    RETURNING id
  `);
  
  return result.rowCount || 0;
}

async function updateUserProfiles(client: any): Promise<void> {
  await client.query(`
    INSERT INTO user_profiles (
      user_id, total_events, total_connect_events, total_disconnect_events, event_balance,
      total_sessions, complete_sessions, avg_session_duration_minutes, avg_charge_gained,
      avg_start_battery_level, avg_end_battery_level, data_start_date, data_end_date, data_days,
      duplicate_events, has_imbalanced_events
    )
    SELECT 
      e.user_id,
      COUNT(*) as total_events,
      COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) as total_connect_events,
      COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END) as total_disconnect_events,
      COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) - 
        COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END) as event_balance,
      COALESCE(s.total_sessions, 0),
      COALESCE(s.complete_sessions, 0),
      s.avg_duration,
      s.avg_charge,
      s.avg_start,
      s.avg_end,
      MIN(e.event_date) as data_start_date,
      MAX(e.event_date) as data_end_date,
      (MAX(e.event_date) - MIN(e.event_date) + 1) as data_days,
      COUNT(CASE WHEN e.is_duplicate THEN 1 END) as duplicate_events,
      ABS(COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) - 
          COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END)) > 1 as has_imbalanced_events
    FROM battery_events e
    LEFT JOIN (
      SELECT 
        user_id,
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN is_complete THEN 1 END) as complete_sessions,
        AVG(duration_minutes) as avg_duration,
        AVG(charge_gained) as avg_charge,
        AVG(start_battery_level) as avg_start,
        AVG(end_battery_level) as avg_end
      FROM charging_sessions
      GROUP BY user_id
    ) s ON e.user_id = s.user_id
    GROUP BY e.user_id, s.total_sessions, s.complete_sessions, s.avg_duration, s.avg_charge, s.avg_start, s.avg_end
    ON CONFLICT (user_id) DO UPDATE SET
      total_events = EXCLUDED.total_events,
      total_connect_events = EXCLUDED.total_connect_events,
      total_disconnect_events = EXCLUDED.total_disconnect_events,
      event_balance = EXCLUDED.event_balance,
      total_sessions = EXCLUDED.total_sessions,
      complete_sessions = EXCLUDED.complete_sessions,
      avg_session_duration_minutes = EXCLUDED.avg_session_duration_minutes,
      avg_charge_gained = EXCLUDED.avg_charge_gained,
      avg_start_battery_level = EXCLUDED.avg_start_battery_level,
      avg_end_battery_level = EXCLUDED.avg_end_battery_level,
      data_start_date = EXCLUDED.data_start_date,
      data_end_date = EXCLUDED.data_end_date,
      data_days = EXCLUDED.data_days,
      duplicate_events = EXCLUDED.duplicate_events,
      has_imbalanced_events = EXCLUDED.has_imbalanced_events,
      updated_at = NOW()
  `);
}

async function updateAggregateStats(client: any, totalEvents: number, totalSessions: number, filesProcessed: number): Promise<void> {
  const stats = [
    ['total_users', 'SELECT COUNT(DISTINCT user_id) FROM battery_events'],
    ['total_events', `SELECT ${totalEvents}`],
    ['total_events_excluding_duplicates', 'SELECT COUNT(*) FROM battery_events WHERE is_duplicate = FALSE'],
    ['total_duplicate_events', 'SELECT COUNT(*) FROM battery_events WHERE is_duplicate = TRUE'],
    ['total_sessions', `SELECT ${totalSessions}`],
    ['files_processed', `SELECT ${filesProcessed}`],
    ['avg_events_per_user', 'SELECT AVG(cnt) FROM (SELECT COUNT(*) as cnt FROM battery_events WHERE is_duplicate = FALSE GROUP BY user_id) t'],
    ['users_with_imbalanced_events', 'SELECT COUNT(*) FROM user_profiles WHERE has_imbalanced_events = TRUE'],
    ['data_date_range', "SELECT json_build_object('start', MIN(event_date), 'end', MAX(event_date)) FROM battery_events"],
  ];

  for (const [name, query] of stats) {
    const result = await client.query(query);
    const value = result.rows[0]?.[Object.keys(result.rows[0])[0]];
    
    if (typeof value === 'object') {
      await client.query(`
        INSERT INTO aggregate_statistics (metric_name, metric_json, category)
        VALUES ($1, $2, 'summary')
        ON CONFLICT (metric_name) DO UPDATE SET metric_json = $2, computed_at = NOW()
      `, [name, value]);
    } else {
      await client.query(`
        INSERT INTO aggregate_statistics (metric_name, metric_value, category)
        VALUES ($1, $2, 'summary')
        ON CONFLICT (metric_name) DO UPDATE SET metric_value = $2, computed_at = NOW()
      `, [name, value]);
    }
  }
}

async function loadData(): Promise<void> {
  console.log('🔄 Loading battery charging data into battery_charging_new...\n');
  
  const client = await pool.connect();
  
  try {
    const files = readdirSync(DATA_DIR)
      .filter(f => f.endsWith('.csv') && f.startsWith('battery_charging_data_'))
      .sort();
    
    console.log(`📁 Found ${files.length} CSV files to process\n`);
    
    let totalEvents = 0;
    let totalIssues = 0;
    let filesWithIssues = 0;
    const allIssues: DataQualityIssue[] = [];

    console.log('📊 Processing files...');
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filePath = join(DATA_DIR, file);
      
      const { events, issues } = processFile(filePath);
      
      const inserted = await insertEvents(client, events);
      totalEvents += inserted;
      
      if (issues.length > 0) {
        allIssues.push(...issues);
        totalIssues += issues.length;
        filesWithIssues++;
      }
      
      if ((i + 1) % 50 === 0 || i === files.length - 1) {
        console.log(`   Processed ${i + 1}/${files.length} files (${totalEvents} events)`);
      }
    }

    console.log('\n📝 Recording data quality issues...');
    await insertIssues(client, allIssues);
    
    console.log('🔗 Generating charging sessions...');
    const sessionsCreated = await generateChargingSessions(client);
    
    console.log('👤 Updating user profiles...');
    await updateUserProfiles(client);
    
    console.log('📈 Updating aggregate statistics...');
    await updateAggregateStats(client, totalEvents, sessionsCreated, files.length);
    
    console.log('🔄 Refreshing materialized views...');
    await client.query('REFRESH MATERIALIZED VIEW daily_charging_summary');
    await client.query('REFRESH MATERIALIZED VIEW hourly_charging_summary');
    await client.query('REFRESH MATERIALIZED VIEW user_event_balance');

    console.log('\n' + '='.repeat(60));
    console.log('✅ DATA LOADING COMPLETE');
    console.log('='.repeat(60));
    console.log(`\n📊 Summary:`);
    console.log(`   Files processed:     ${files.length}`);
    console.log(`   Total events:        ${totalEvents}`);
    console.log(`   Charging sessions:   ${sessionsCreated}`);
    console.log(`   Files with issues:   ${filesWithIssues}`);
    console.log(`   Total issues logged: ${totalIssues}`);
    
    const issueBreakdown = allIssues.reduce((acc, i) => {
      acc[i.issue_type] = (acc[i.issue_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    if (Object.keys(issueBreakdown).length > 0) {
      console.log(`\n⚠️  Data Quality Issues Breakdown:`);
      Object.entries(issueBreakdown).forEach(([type, count]) => {
        console.log(`   ${type}: ${count} files affected`);
      });
    }

  } catch (error) {
    console.error('❌ Error loading data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

loadData();
