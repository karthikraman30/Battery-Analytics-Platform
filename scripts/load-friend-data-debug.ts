/**
 * Debug version to identify exactly which files fail and why
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

function extractDeviceId(filename: string): string {
  const match = filename.match(/battery_charging_data_(\d+)\.csv/);
  return match ? `friend_device_${match[1]}` : `friend_device_unknown`;
}

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

      const uniqueId = parseInt(`${device_id.split('_').pop() || '0'}${record.id.toString().padStart(4, '0')}`);

      return {
        id: uniqueId,
        device_id,
        event_type: eventType,
        battery_level: record.percentage,
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

async function debugLoad() {
  const client = await pool.connect();
  const dataDir = '/Users/karthikraman/Workspace/bmp_data/new_data_users/battery_charging_data(with 94)';

  try {
    const files = readdirSync(dataDir)
      .filter(file => file.endsWith('.csv') && file.startsWith('battery_charging_data_'))
      .sort();

    console.log(`📁 Found ${files.length} CSV files`);

    let successCount = 0;
    let errorCount = 0;
    const failedFiles: string[] = [];
    const errorDetails: {file: string, error: string}[] = [];

    for (const file of files) {
      const filePath = join(dataDir, file);
      
      try {
        console.log(`🔍 Checking ${file}...`);
        
        // Try to process the file
        const events = processCsvFile(filePath, file);
        
        if (events.length === 0) {
          console.log(`⚠️  No events found in ${file}`);
          errorCount++;
          failedFiles.push(file);
          errorDetails.push({file, error: 'No events found'});
          continue;
        }

        // Try to insert just one event to test
        const testEvent = events[0];
        await client.query(`
          INSERT INTO battery_events (id, device_id, event_type, battery_level, event_timestamp, timezone, raw_file_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [testEvent.id, testEvent.device_id, testEvent.event_type, testEvent.battery_level, testEvent.event_timestamp, testEvent.timezone, testEvent.raw_file_name]);

        // Remove the test event
        await client.query(`DELETE FROM battery_events WHERE id = $1`, [testEvent.id]);

        successCount++;
        console.log(`✅ ${file}: OK (${events.length} events)`);
        
      } catch (error) {
        console.error(`❌ Error with ${file}:`, error.message);
        errorCount++;
        failedFiles.push(file);
        errorDetails.push({file, error: error.message});
      }
    }

    console.log('\n📊 SUMMARY:');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`❌ Failed: ${errorCount}`);
    console.log(`📁 Total files: ${files.length}`);
    
    if (failedFiles.length > 0) {
      console.log('\n❌ Failed files:');
      failedFiles.forEach(file => console.log(`   ${file}`));
      
      console.log('\n🔍 Error details:');
      errorDetails.forEach(detail => console.log(`   ${detail.file}: ${detail.error}`));
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  debugLoad().catch(console.error);
}
