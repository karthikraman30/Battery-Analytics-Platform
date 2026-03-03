/**
 * Load the 2 problematic files: 001 and 010
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
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

function processCsvFile(filePath: string, fileName: string, deviceNumber: string): any[] {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const records: BatteryEvent[] = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    const device_id = `friend_device_${deviceNumber}`;

    return records.map((record, index) => {
      let formattedDate = record.date;
      if (record.date.match(/^\d{2}-\d{2}-\d{4}$/)) {
        const [day, month, year] = record.date.split('-');
        formattedDate = `${year}-${month}-${day}`;
      }

      let eventType = record.event_type;
      if (eventType === 'discharging') {
        eventType = 'power_disconnected';
      } else if (eventType === 'charging') {
        eventType = 'power_connected';
      }

      // Create truly unique ID using timestamp + random + sequence
      const timestampComponent = new Date(`${formattedDate} ${record.time}`).getTime();
      const randomComponent = Math.floor(Math.random() * 10000);
      const uniqueId = parseInt(`${deviceNumber}${record.id.toString().padStart(4, '0')}${timestampComponent.toString().slice(-4)}${randomComponent.toString().padStart(4, '0')}`);

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

async function loadProblemFiles() {
  const client = await pool.connect();
  const dataDir = '/Users/karthikraman/Workspace/bmp_data/new_data_users/battery_charging_data(with 94)';

  try {
    const problemFiles = [
      { file: 'battery_charging_data_001.csv', device: '001' },
      { file: 'battery_charging_data_010.csv', device: '010' }
    ];

    console.log(`🔄 Loading ${problemFiles.length} problematic files...`);

    for (const { file, device } of problemFiles) {
      const filePath = join(dataDir, file);

      try {
        console.log(`📊 Processing ${file}...`);

        const events = processCsvFile(filePath, file, device);

        if (events.length === 0) {
          console.log(`⚠️  No events found in ${file}`);
          continue;
        }

        // Insert events
        for (const event of events) {
          await client.query(`
            INSERT INTO battery_events (id, device_id, event_type, battery_level, event_timestamp, timezone, raw_file_name, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
          `, [event.id, event.device_id, event.event_type, event.battery_level, event.event_timestamp, event.timezone, event.raw_file_name]);
        }

        console.log(`✅ ${file}: ${events.length} events loaded`);

      } catch (error) {
        console.error(`❌ Error with ${file}:`, error.message);
      }
    }

    // Generate charging sessions for these devices
    console.log('🔄 Generating charging sessions...');
    for (const { device } of problemFiles) {
      const deviceEvents = await client.query(`
        SELECT * FROM battery_events 
        WHERE device_id = 'friend_device_${device}'
        ORDER BY event_timestamp
      `);

      const sessions: any[] = [];
      let currentSession: any = null;
      let sessionId = 1;

      deviceEvents.rows.forEach(event => {
        if (event.event_type === 'power_connected') {
          if (!currentSession) {
            const timestampComponent = new Date(event.event_timestamp).getTime();
            const randomComponent = Math.floor(Math.random() * 10000);
            const uniqueSessionId = parseInt(`${device}${sessionId.toString().padStart(4, '0')}${timestampComponent.toString().slice(-4)}${randomComponent.toString().padStart(4, '0')}`);

            currentSession = {
              id: uniqueSessionId,
              device_id: `friend_device_${device}`,
              session_start: event.event_timestamp,
              start_battery_level: event.battery_level,
              is_complete: false
            };
            sessionId++;
          }
        } else if (event.event_type === 'power_disconnected') {
          if (currentSession) {
            currentSession.session_end = event.event_timestamp;
            currentSession.end_battery_level = event.battery_level;
            currentSession.is_complete = true;
            sessions.push(currentSession);
            currentSession = null;
          }
        }
      });

      // Handle incomplete session
      if (currentSession) {
        sessions.push(currentSession);
      }

      // Insert sessions
      for (const session of sessions) {
        await client.query(`
          INSERT INTO charging_sessions (id, device_id, session_start, session_end, start_battery_level, end_battery_level, is_complete)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [session.id, session.device_id, session.session_start, session.session_end, session.start_battery_level, session.end_battery_level, session.is_complete]);
      }

      console.log(`✅ Device ${device}: ${sessions.length} charging sessions generated`);
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
      WHERE device_id IN ('friend_device_001', 'friend_device_010')
      GROUP BY device_id
      ON CONFLICT (device_id) DO UPDATE SET
        total_events = EXCLUDED.total_events,
        total_sessions = EXCLUDED.total_sessions,
        data_range_start = EXCLUDED.data_range_start,
        data_range_end = EXCLUDED.data_range_end,
        updated_at = NOW()
    `);

    // Refresh materialized views
    console.log('🔄 Refreshing materialized views...');
    await client.query('REFRESH MATERIALIZED VIEW device_daily_summary');
    await client.query('REFRESH MATERIALIZED VIEW battery_hourly_agg');

    // Check final count
    const finalCount = await client.query(`SELECT COUNT(DISTINCT raw_file_name) FROM battery_events WHERE raw_file_name NOT LIKE '%094%' AND raw_file_name NOT LIKE '%137%' AND raw_file_name NOT LIKE '%186%' AND raw_file_name NOT LIKE '%188%'`);

    console.log('🎉 Problem files loading completed!');
    console.log(`📊 Final file count: ${finalCount.rows[0].count}/273`);

  } catch (error) {
    console.error('❌ Loading failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  loadProblemFiles().catch(console.error);
}
