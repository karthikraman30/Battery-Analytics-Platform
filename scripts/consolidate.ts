/**
 * Data Consolidation Pipeline for Battery Analytics Platform
 * 
 * Scans extracted_data/ and sample_data/ directories for CSV files,
 * extracts device/group IDs from file paths, and consolidates into
 * standardized format ready for database import.
 * 
 * Run with: bun run consolidate.ts
 */

import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

// ============================================
// TYPES
// ============================================

interface BatteryEvent {
  device_id: string;
  group_id: string;
  timestamp: string;
  event_type: string;
  battery_level: number;
}

interface AppUsageEvent {
  device_id: string;
  group_id: string;
  start_timestamp: string;
  end_timestamp: string;
  duration_seconds: number;
  package_name: string;
  app_name: string;
  is_screen_off: boolean;
}

interface NetworkEvent {
  device_id: string;
  group_id: string;
  timestamp: string;
  ssid: string;
  is_wifi: boolean;
  signal_strength: number;
}

interface SensorEvent {
  device_id: string;
  group_id: string;
  timestamp: string;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  gyro_x: number;
  gyro_y: number;
  gyro_z: number;
  mag_x: number;
  mag_y: number;
  mag_z: number;
  light: number;
}

interface ConsolidationStats {
  battery_events: number;
  app_usage_events: number;
  network_events: number;
  sensor_events: number;
  devices_found: Set<string>;
  groups_found: Set<string>;
  files_processed: number;
  files_skipped: number;
  errors: string[];
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Extract device ID from file path
 * Examples:
 *   - Device1_battery_charging_data.csv -> Device1
 *   - device_1/battery_charging_data.csv -> device_1
 *   - P3_battery_charging_data.csv -> P3
 *   - Archan.csv -> Archan
 */
function extractDeviceId(filePath: string): string {
  const fileName = path.basename(filePath, '.csv');
  const dirName = path.basename(path.dirname(filePath));

  // Check if directory name looks like a device ID
  if (/^device[_-]?\d+$/i.test(dirName)) {
    return dirName.toLowerCase().replace(/[_-]/g, '_');
  }

  // Check if filename has device prefix pattern
  const deviceMatch = fileName.match(/^(Device\d+|device[_-]?\d+|P\d+|[A-Z][a-z]+)(?:[_-]|$)/i);
  if (deviceMatch) {
    return deviceMatch[1].toLowerCase().replace(/[_-]/g, '_');
  }

  // Use filename without data type suffix
  const cleanName = fileName
    .replace(/[_-]?(battery|charging|sensor|network|fg)[_-]?(data|events)?$/i, '')
    .replace(/[_-]?(data|events)$/i, '');

  return cleanName.toLowerCase().replace(/\s+/g, '_') || dirName.toLowerCase();
}

/**
 * Extract group ID from file path
 * Examples:
 *   - extracted_data/Group_15/... -> Group_15
 *   - extracted_data/HCI_Group_9/... -> HCI_Group_9
 */
function extractGroupId(filePath: string): string {
  const parts = filePath.split(path.sep);
  const extractedIdx = parts.findIndex(p => p === 'extracted_data' || p === 'sample_data');

  if (extractedIdx >= 0 && parts.length > extractedIdx + 1) {
    return parts[extractedIdx + 1];
  }

  return 'unknown';
}

/**
 * Parse date + time + timezone into ISO timestamp
 * Input: date="2024-10-25", time="10:37:25", timezone="+05:30"
 * Output: "2024-10-25T10:37:25+05:30"
 */
function parseTimestamp(date: string, time: string, timezone: string = '+05:30'): string {
  if (!date || !time) return '';

  // Clean up inputs
  const cleanDate = date.trim();
  const cleanTime = time.trim();
  const cleanTz = timezone?.trim() || '+05:30';

  // Validate date format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    return '';
  }

  return `${cleanDate}T${cleanTime}${cleanTz}`;
}

/**
 * Identify CSV file type based on filename and headers
 */
function identifyFileType(filePath: string, headers: string[]): 'battery' | 'fg_events' | 'network' | 'sensor' | 'unknown' {
  const fileName = path.basename(filePath).toLowerCase();
  const headerSet = new Set(headers.map(h => h.toLowerCase()));

  // Check filename patterns
  if (fileName.includes('battery') || fileName.includes('charging')) {
    return 'battery';
  }
  if (fileName.includes('fg_event') || fileName.includes('foreground')) {
    return 'fg_events';
  }
  if (fileName.includes('network')) {
    return 'network';
  }
  if (fileName.includes('sensor')) {
    return 'sensor';
  }

  // Check headers
  if (headerSet.has('event_type') && headerSet.has('percentage')) {
    return 'battery';
  }
  if (headerSet.has('event_package_name') || headerSet.has('start_date')) {
    return 'fg_events';
  }
  if (headerSet.has('ssid') || headerSet.has('is_wifi')) {
    return 'network';
  }
  if (headerSet.has('accel_x') || headerSet.has('gyro_x')) {
    return 'sensor';
  }

  return 'unknown';
}

/**
 * Parse numeric value safely
 */
function parseNumber(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? 0 : num;
}

// ============================================
// CSV PROCESSORS
// ============================================

function processBatteryCSV(
  filePath: string,
  deviceId: string,
  groupId: string
): BatteryEvent[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });

  const events: BatteryEvent[] = [];

  for (const row of records) {
    const timestamp = parseTimestamp(row.date, row.time, row.timezone);
    if (!timestamp) continue;

    events.push({
      device_id: deviceId,
      group_id: groupId,
      timestamp,
      event_type: row.event_type || 'unknown',
      battery_level: parseNumber(row.percentage),
    });
  }

  return events;
}

function processFgEventsCSV(
  filePath: string,
  deviceId: string,
  groupId: string
): AppUsageEvent[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });

  const events: AppUsageEvent[] = [];

  for (const row of records) {
    const startTimestamp = parseTimestamp(row.start_date, row.start_time, row.start_timezone);
    const endTimestamp = parseTimestamp(row.end_date, row.end_time, row.end_timezone);

    if (!startTimestamp) continue;

    // Calculate duration
    let durationSeconds = 0;
    if (startTimestamp && endTimestamp) {
      const start = new Date(startTimestamp);
      const end = new Date(endTimestamp);
      durationSeconds = Math.max(0, (end.getTime() - start.getTime()) / 1000);
    }

    const packageName = row.event_package_name || '';
    const isScreenOff = packageName === 'device_locked_package';

    events.push({
      device_id: deviceId,
      group_id: groupId,
      start_timestamp: startTimestamp,
      end_timestamp: endTimestamp || startTimestamp,
      duration_seconds: durationSeconds,
      package_name: packageName,
      app_name: row.event_name || '',
      is_screen_off: isScreenOff,
    });
  }

  return events;
}

function processNetworkCSV(
  filePath: string,
  deviceId: string,
  groupId: string
): NetworkEvent[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });

  const events: NetworkEvent[] = [];

  for (const row of records) {
    const timestamp = parseTimestamp(row.date, row.time, row.timezone);
    if (!timestamp) continue;

    const isWifiValue = parseNumber(row.is_wifi);
    const isWifi = isWifiValue !== -1;

    events.push({
      device_id: deviceId,
      group_id: groupId,
      timestamp,
      ssid: row.ssid || '',
      is_wifi: isWifi,
      signal_strength: parseNumber(row.strength),
    });
  }

  return events;
}

function processSensorCSV(
  filePath: string,
  deviceId: string,
  groupId: string
): SensorEvent[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });

  const events: SensorEvent[] = [];

  for (const row of records) {
    const timestamp = parseTimestamp(row.date, row.time, row.timezone);
    if (!timestamp) continue;

    events.push({
      device_id: deviceId,
      group_id: groupId,
      timestamp,
      accel_x: parseNumber(row.accel_x),
      accel_y: parseNumber(row.accel_y),
      accel_z: parseNumber(row.accel_z),
      gyro_x: parseNumber(row.gyro_x),
      gyro_y: parseNumber(row.gyro_y),
      gyro_z: parseNumber(row.gyro_z),
      mag_x: parseNumber(row.mag_x),
      mag_y: parseNumber(row.mag_y),
      mag_z: parseNumber(row.mag_z),
      light: parseNumber(row.light),
    });
  }

  return events;
}

// ============================================
// MAIN CONSOLIDATION FUNCTION
// ============================================

async function consolidate(): Promise<void> {
  console.log('🔄 Starting data consolidation pipeline...\n');

  const stats: ConsolidationStats = {
    battery_events: 0,
    app_usage_events: 0,
    network_events: 0,
    sensor_events: 0,
    devices_found: new Set(),
    groups_found: new Set(),
    files_processed: 0,
    files_skipped: 0,
    errors: [],
  };

  // Collect all events
  const allBatteryEvents: BatteryEvent[] = [];
  const allAppUsageEvents: AppUsageEvent[] = [];
  const allNetworkEvents: NetworkEvent[] = [];
  const allSensorEvents: SensorEvent[] = [];

  // Find all CSV files
  const baseDir = path.resolve(__dirname, '..');
  const searchDirs = ['extracted_data', 'sample_data'];

  function findCSVFiles(dir: string): string[] {
    const files: string[] = [];

    if (!fs.existsSync(dir)) return files;

    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      // Skip __MACOSX and hidden directories
      if (entry.name.startsWith('.') || entry.name === '__MACOSX') {
        continue;
      }

      if (entry.isDirectory()) {
        files.push(...findCSVFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.csv')) {
        // Skip survey files
        if (entry.name.toLowerCase().includes('survey')) {
          continue;
        }
        files.push(fullPath);
      }
    }

    return files;
  }

  console.log('📂 Scanning directories for CSV files...');

  const csvFiles: string[] = [];
  for (const searchDir of searchDirs) {
    const dirPath = path.join(baseDir, searchDir);
    csvFiles.push(...findCSVFiles(dirPath));
  }

  console.log(`   Found ${csvFiles.length} CSV files\n`);

  // Process each file
  for (const filePath of csvFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const firstLine = content.split('\n')[0];
      const headers = firstLine.split(',').map(h => h.trim());

      const fileType = identifyFileType(filePath, headers);
      const deviceId = extractDeviceId(filePath);
      const groupId = extractGroupId(filePath);

      if (fileType === 'unknown') {
        stats.files_skipped++;
        continue;
      }

      stats.devices_found.add(deviceId);
      stats.groups_found.add(groupId);

      switch (fileType) {
        case 'battery': {
          const events = processBatteryCSV(filePath, deviceId, groupId);
          allBatteryEvents.push(...events);
          stats.battery_events += events.length;
          break;
        }
        case 'fg_events': {
          const events = processFgEventsCSV(filePath, deviceId, groupId);
          allAppUsageEvents.push(...events);
          stats.app_usage_events += events.length;
          break;
        }
        case 'network': {
          const events = processNetworkCSV(filePath, deviceId, groupId);
          allNetworkEvents.push(...events);
          stats.network_events += events.length;
          break;
        }
        case 'sensor': {
          const events = processSensorCSV(filePath, deviceId, groupId);
          allSensorEvents.push(...events);
          stats.sensor_events += events.length;
          break;
        }
      }

      stats.files_processed++;

      // Progress indicator
      if (stats.files_processed % 50 === 0) {
        console.log(`   Processed ${stats.files_processed} files...`);
      }

    } catch (error) {
      stats.errors.push(`${filePath}: ${error}`);
      stats.files_skipped++;
    }
  }

  // Write consolidated CSV files
  const outputDir = path.join(baseDir, 'consolidated_data');
  fs.mkdirSync(outputDir, { recursive: true });

  console.log('\n📝 Writing consolidated CSV files...');

  // Battery events
  if (allBatteryEvents.length > 0) {
    const batteryCSV = stringify(allBatteryEvents, { header: true });
    fs.writeFileSync(path.join(outputDir, 'battery_events.csv'), batteryCSV);
    console.log(`   ✅ battery_events.csv (${allBatteryEvents.length} rows)`);
  }

  // App usage events
  if (allAppUsageEvents.length > 0) {
    const appCSV = stringify(allAppUsageEvents, { header: true });
    fs.writeFileSync(path.join(outputDir, 'app_usage_events.csv'), appCSV);
    console.log(`   ✅ app_usage_events.csv (${allAppUsageEvents.length} rows)`);
  }

  // Network events
  if (allNetworkEvents.length > 0) {
    const networkCSV = stringify(allNetworkEvents, { header: true });
    fs.writeFileSync(path.join(outputDir, 'network_events.csv'), networkCSV);
    console.log(`   ✅ network_events.csv (${allNetworkEvents.length} rows)`);
  }

  // Sensor events
  if (allSensorEvents.length > 0) {
    const sensorCSV = stringify(allSensorEvents, { header: true });
    fs.writeFileSync(path.join(outputDir, 'sensor_events.csv'), sensorCSV);
    console.log(`   ✅ sensor_events.csv (${allSensorEvents.length} rows)`);
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log('📊 CONSOLIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Files processed:    ${stats.files_processed}`);
  console.log(`Files skipped:      ${stats.files_skipped}`);
  console.log(`Devices found:      ${stats.devices_found.size}`);
  console.log(`Groups found:       ${stats.groups_found.size}`);
  console.log('');
  console.log('Events by type:');
  console.log(`  Battery events:   ${stats.battery_events.toLocaleString()}`);
  console.log(`  App usage events: ${stats.app_usage_events.toLocaleString()}`);
  console.log(`  Network events:   ${stats.network_events.toLocaleString()}`);
  console.log(`  Sensor events:    ${stats.sensor_events.toLocaleString()}`);
  console.log('');
  console.log(`Total events:       ${(stats.battery_events + stats.app_usage_events + stats.network_events + stats.sensor_events).toLocaleString()}`);
  console.log('');
  console.log(`Output directory:   ${outputDir}`);

  if (stats.errors.length > 0) {
    console.log(`\n⚠️  Errors (${stats.errors.length}):`);
    stats.errors.slice(0, 10).forEach(e => console.log(`   - ${e}`));
    if (stats.errors.length > 10) {
      console.log(`   ... and ${stats.errors.length - 10} more`);
    }
  }

  console.log('\n✅ Consolidation complete!');
}

// Run
consolidate().catch(console.error);
