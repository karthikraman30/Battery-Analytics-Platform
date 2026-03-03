/**
 * Load friend's battery charging data into TimescaleDB
 * Processes CSV files from new_data_users/battery_charging_data(with 94)/
 * Run with: DB_PORT=5433 DB_NAME=battery_analytics_friend bun run load-friend-data.ts
 */

import { Pool } from 'pg';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parse } from 'csv-parse/sync';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'battery_analytics_friend',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

interface BatteryEvent {
  id: number;
  event_type: string;
  percentage: number;
  date: string;
  time: string;
  timezone: string;
}

interface ProcessedEvent {
  id: number;
  device_id: string;
  event_type: string;
  battery_level: number;
  event_timestamp: string;
  timezone: string;
  raw_file_name: string;
}

// Extract device_id from filename
function extractDeviceId(filename: string): string {
  const match = filename.match(/battery_charging_data_(\d+)\.csv/);
  return match ? `friend_device_${match[1]}` : `friend_device_unknown`;
}

// Process a single CSV file
function processCsvFile(filePath: string, fileName: string): ProcessedEvent[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const records: BatteryEvent[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const device_id = extractDeviceId(fileName);

    return records.map((record, index) => {
      // Handle different date formats: YYYY-MM-DD and DD-MM-YYYY
      let formattedDate = record.date;
      if (record.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
        // DD-MM-YYYY format, convert to YYYY-MM-DD
        const [day, month, year] = record.date.split('-');
        formattedDate = `${year}-${month}-${day}`;
      }

      // Handle different event types
      let eventType = record.event_type;
      if (eventType === 'discharging') {
        eventType = 'power_disconnected';
      } else if (eventType === 'charging') {
        eventType = 'power_connected';
      }

      // Create unique ID by combining device_id, record id, and a timestamp component
      const timestampComponent = new Date(`${formattedDate} ${record.time}`).getTime();
      const uniqueId = parseInt(`${device_id.split('_').pop() || '0'}${record.id.toString().padStart(4, '0')}${timestampComponent.toString().slice(-6)}`);

      return {
        id: uniqueId,
        device_id,
        event_type: eventType,
        battery_level: Math.round(parseFloat(record.percentage.toString())),
        event_timestamp: `${formattedDate} ${record.time}${record.timezone}`,
        timezone: record.timezone,
        raw_file_name: fileName
      };
    });
  } catch (error) {
    console.error(`Error processing ${fileName}:`, error);
    return [];
  }
}

// Generate charging sessions from battery events
function generateChargingSessions(events: ProcessedEvent[]): any[] {
  const sessions: any[] = [];
  const deviceEvents = events.reduce((acc, event) => {
    if (!acc[event.device_id]) {
      acc[event.device_id] = [];
    }
    acc[event.device_id].push(event);
    return acc;
  }, {} as Record<string, ProcessedEvent[]>);

  Object.entries(deviceEvents).forEach(([device_id, deviceEvents]) => {
    // Sort by timestamp
    deviceEvents.sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime());

    let currentSession: any = null;
    let sessionId = 1;

    deviceEvents.forEach(event => {
      if (event.event_type === 'power_connected') {
        // Start new session if not already in one
        if (!currentSession) {
          // Create unique session ID
          const timestampComponent = new Date(event.event_timestamp).getTime();
          const uniqueSessionId = parseInt(`${device_id.split('_').pop() || '0'}${sessionId.toString().padStart(4, '0')}${timestampComponent.toString().slice(-6)}`);
          currentSession = {
            id: uniqueSessionId,
            device_id,
            session_start: event.event_timestamp,
            start_battery_level: event.battery_level,
            is_complete: false
          };
          sessionId++;
        }
      } else if (event.event_type === 'power_disconnected') {
        // End current session if exists
        if (currentSession) {
          currentSession.session_end = event.event_timestamp;
          currentSession.end_battery_level = event.battery_level;
          currentSession.is_complete = true;
          sessions.push(currentSession);
          currentSession = null;
        }
      }
    });

    // Handle incomplete session (still charging)
    if (currentSession) {
      sessions.push(currentSession);
    }
  });

  return sessions;
}

// Main loading function
async function loadFriendData() {
  const client = await pool.connect();
  const dataDir = '/Users/karthikraman/Workspace/bmp_data/new_data_users/battery_charging_data(with 94)';

  try {
    console.log('🔄 Starting friend data loading...');

    // Get all CSV files
    const files = readdirSync(dataDir)
      .filter(file => file.endsWith('.csv') && file.startsWith('battery_charging_data_'))
      .sort();

    console.log(`📁 Found ${files.length} CSV files`);

    let totalEvents = 0;
    let totalSessions = 0;
    let processedFiles = 0;

    for (const file of files) {
      const filePath = join(dataDir, file);

      try {
        console.log(`📊 Processing ${file}...`);

        // Process events
        const events = processCsvFile(filePath, file);
        if (events.length === 0) {
          console.log(`⚠️  No events found in ${file}`);
          continue;
        }

        // Insert battery events
        for (const event of events) {
          await client.query(`
            INSERT INTO battery_events (id, device_id, event_type, battery_level, event_timestamp, timezone, raw_file_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [event.id, event.device_id, event.event_type, event.battery_level, event.event_timestamp, event.timezone, event.raw_file_name]);
        }

        // Generate and insert charging sessions
        const sessions = generateChargingSessions(events);
        for (const session of sessions) {
          await client.query(`
            INSERT INTO charging_sessions (id, device_id, session_start, session_end, start_battery_level, end_battery_level, is_complete)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
          `, [session.id, session.device_id, session.session_start, session.session_end, session.start_battery_level, session.end_battery_level, session.is_complete]);
        }

        totalEvents += events.length;
        totalSessions += sessions.length;
        processedFiles++;

        console.log(`✅ ${file}: ${events.length} events, ${sessions.length} sessions`);

      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error);
      }
    }

    // Update user profiles
    console.log('🔄 Updating user profiles...');
    await client.query(`
      INSERT INTO user_profiles (device_id, total_events, total_sessions, data_range_start, data_range_end)
      SELECT 
        device_id,
        COUNT(*) as total_events,
        COUNT(DISTINCT id) as total_sessions,
        MIN(event_timestamp) as data_range_start,
        MAX(event_timestamp) as data_range_end
      FROM battery_events
      GROUP BY device_id
      ON CONFLICT (device_id) DO UPDATE SET
        total_events = EXCLUDED.total_events,
        total_sessions = EXCLUDED.total_sessions,
        data_range_start = EXCLUDED.data_range_start,
        data_range_end = EXCLUDED.data_range_end,
        updated_at = NOW()
    `);

    // Update aggregate statistics
    console.log('🔄 Updating aggregate statistics...');
    await client.query(`
      INSERT INTO aggregate_statistics (metric_name, metric_value)
      VALUES 
        ('total_devices', (SELECT COUNT(DISTINCT device_id) FROM battery_events)),
        ('total_events', $1),
        ('total_sessions', $2),
        ('avg_events_per_device', (SELECT AVG(event_count) FROM (SELECT COUNT(*) as event_count FROM battery_events GROUP BY device_id) t)),
        ('data_files_processed', $3)
    `, [totalEvents, totalSessions, processedFiles]);

    // Refresh materialized views
    console.log('🔄 Refreshing materialized views...');
    await client.query('REFRESH MATERIALIZED VIEW device_daily_summary');
    await client.query('REFRESH MATERIALIZED VIEW battery_hourly_agg');

    console.log('🎉 Friend data loading completed!');
    console.log(`📊 Summary:`);
    console.log(`   - Files processed: ${processedFiles}`);
    console.log(`   - Total events: ${totalEvents}`);
    console.log(`   - Total sessions: ${totalSessions}`);
    console.log(`   - Devices: ${processedFiles} (one per file)`);

  } catch (error) {
    console.error('❌ Data loading failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  loadFriendData().catch(console.error);
}

export { loadFriendData };
