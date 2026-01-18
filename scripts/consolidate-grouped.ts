import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import * as fs from 'fs';
import * as path from 'path';

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

function isValidDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  if (year < 2020 || year > 2030) return false;
  
  // Check days per month
  const daysInMonth = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (day > daysInMonth[month]) return false;
  
  return true;
}

function normalizeDate(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.trim();
  
  // YYYY-MM-DD format (already correct)
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleaned)) {
    const [year, month, day] = cleaned.split('-').map(Number);
    if (isValidDate(year, month, day)) {
      return cleaned;
    }
    return '';
  }
  
  // DD-MM-YYYY format
  if (/^\d{2}-\d{2}-\d{4}$/.test(cleaned)) {
    const [p1, p2, year] = cleaned.split('-');
    const day = parseInt(p1, 10);
    const month = parseInt(p2, 10);
    const yearNum = parseInt(year, 10);
    
    if (isValidDate(yearNum, month, day)) {
      return `${year}-${p2}-${p1}`;
    }
    // Try swapped (MM-DD-YYYY)
    if (isValidDate(yearNum, day, month)) {
      return `${year}-${p1}-${p2}`;
    }
    return '';
  }
  
  // Slash-separated dates: could be DD/MM/YYYY or MM/DD/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(cleaned)) {
    const parts = cleaned.split('/');
    const p1 = parseInt(parts[0], 10);
    const p2 = parseInt(parts[1], 10);
    const year = parseInt(parts[2], 10);
    
    // Try DD/MM/YYYY first (more common internationally)
    if (isValidDate(year, p2, p1)) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    // Try MM/DD/YYYY (US format)
    if (isValidDate(year, p1, p2)) {
      return `${parts[2]}-${parts[0].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
    }
    return '';
  }
  
  // YYYY/MM/DD format
  if (/^\d{4}\/\d{2}\/\d{2}$/.test(cleaned)) {
    const normalized = cleaned.replace(/\//g, '-');
    const [year, month, day] = normalized.split('-').map(Number);
    if (isValidDate(year, month, day)) {
      return normalized;
    }
    return '';
  }
  
  return '';
}

function parseTimestamp(date: string, time: string, timezone: string = '+05:30'): string {
  if (!date || !time) return '';
  
  const normalizedDate = normalizeDate(date);
  if (!normalizedDate) return '';
  
  const cleanTime = time.trim();
  const cleanTz = timezone?.trim() || '+05:30';
  
  return `${normalizedDate}T${cleanTime}${cleanTz}`;
}

function extractGroupId(filePath: string): string {
  const parts = filePath.split(path.sep);
  const groupedIdx = parts.findIndex(p => p === 'grouped_data');
  
  if (groupedIdx >= 0 && parts.length > groupedIdx + 1) {
    let groupFolder = parts[groupedIdx + 1];
    if (groupFolder === 'No_grp') {
      return 'No_grp';
    }
    groupFolder = groupFolder.replace(/[_-]?(DATA|Data)$/i, '');
    return groupFolder;
  }
  
  return 'unknown';
}

function extractDeviceId(filePath: string, groupId: string): string {
  const fileName = path.basename(filePath);
  const fileNameNoExt = fileName.replace(/\.(csv|txt)$/i, '');
  const dirName = path.basename(path.dirname(filePath));
  
  // Pattern: phone-1, phone-2 folder structure (G28)
  if (/^phone[-_]?\d+$/i.test(dirName)) {
    return dirName.toLowerCase().replace(/[-_]/g, '_');
  }
  
  // Pattern: User1.csv, User21.csv (G10)
  const userMatch = fileNameNoExt.match(/^User(\d+)$/i);
  if (userMatch) {
    return `user_${userMatch[1]}`;
  }
  
  // Pattern: battery_charging_data_abhishek.csv (suffix is device name)
  const suffixPatterns = [
    /^(?:battery_charging_data|fg_events|sensor_data|network_data)[_-](.+)$/i,
    /^(.+)[_-](?:battery|charging|sensor|network|fg)[_-]?(?:data|events)?$/i,
  ];
  
  for (const pattern of suffixPatterns) {
    const match = fileNameNoExt.match(pattern);
    if (match && match[1]) {
      const deviceName = match[1].toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
      if (deviceName && deviceName.length > 1) {
        return deviceName;
      }
    }
  }
  
  // Pattern: P1, P2, p1, p2 prefix
  const pMatch = fileNameNoExt.match(/^[Pp](\d+)[_-]/);
  if (pMatch) {
    return `p${pMatch[1]}`;
  }
  
  // Pattern: numbered suffix like battery_charging_data_1.csv
  const numberedMatch = fileNameNoExt.match(/[_-](\d+)$/);
  if (numberedMatch) {
    return `device_${numberedMatch[1]}`;
  }
  
  // Pattern: phone1_battery-charging.csv
  const phoneMatch = fileNameNoExt.match(/^phone(\d+)[_-]/i);
  if (phoneMatch) {
    return `phone_${phoneMatch[1]}`;
  }
  
  // Default: use first part of filename or group-based default
  const firstPart = fileNameNoExt.split(/[_-]/)[0].toLowerCase();
  if (firstPart && firstPart.length > 1 && !/^(battery|charging|sensor|network|fg|data|events|master)$/i.test(firstPart)) {
    return firstPart;
  }
  
  return `${groupId.toLowerCase()}_device`;
}

function identifyFileType(filePath: string, headers: string[]): 'battery' | 'fg_events' | 'network' | 'sensor' | 'unknown' {
  const fileName = path.basename(filePath).toLowerCase();
  const headerSet = new Set(headers.map(h => h.toLowerCase().replace(/"/g, '')));
  
  if (fileName.includes('battery') || fileName.includes('charging')) {
    return 'battery';
  }
  if (fileName.includes('fg_event') || fileName.includes('fg_') || fileName.includes('foreground')) {
    return 'fg_events';
  }
  if (fileName.includes('network')) {
    return 'network';
  }
  if (fileName.includes('sensor')) {
    return 'sensor';
  }
  
  if (headerSet.has('event_type') && headerSet.has('percentage')) {
    return 'battery';
  }
  if (headerSet.has('event_package_name') || (headerSet.has('start_date') && headerSet.has('end_date'))) {
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

function findHeaderRow(content: string): { headerLine: string; skipRows: number } {
  const lines = content.split('\n');
  const knownHeaders = ['id', 'event_type', 'percentage', 'date', 'time', 'timezone', 'datetime', 'session', 'event', 'battery_percentage'];
  
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].toLowerCase();
    const matchCount = knownHeaders.filter(h => line.includes(h)).length;
    if (matchCount >= 3) {
      return { headerLine: lines[i], skipRows: i };
    }
  }
  
  return { headerLine: lines[0], skipRows: 0 };
}

function parseNumber(value: string | number | undefined): number {
  if (value === undefined || value === null || value === '') return 0;
  const num = typeof value === 'number' ? value : parseFloat(value);
  return isNaN(num) ? 0 : num;
}

function parseDatetimeColumn(datetimeStr: string, timezone: string = '+05:30'): string {
  if (!datetimeStr) return '';
  const cleaned = datetimeStr.trim();
  
  const match = cleaned.match(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})$/);
  if (match) {
    const [, date, time] = match;
    const [year, month, day] = date.split('-').map(Number);
    if (isValidDate(year, month, day)) {
      return `${date}T${time}${timezone}`;
    }
  }
  return '';
}

function processBatteryCSVContent(content: string, deviceId: string, groupId: string): BatteryEvent[] {
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
  
  const events: BatteryEvent[] = [];
  
  for (const row of records) {
    let timestamp: string;
    let eventType: string;
    let batteryLevel: number;
    
    if (row.datetime) {
      timestamp = parseDatetimeColumn(row.datetime);
      eventType = row.event || 'unknown';
      batteryLevel = parseNumber(row.battery_percentage);
    } else {
      timestamp = parseTimestamp(row.date, row.time, row.timezone);
      eventType = row.event_type || 'unknown';
      batteryLevel = parseNumber(row.percentage);
    }
    
    if (!timestamp) continue;
    
    events.push({
      device_id: deviceId,
      group_id: groupId,
      timestamp,
      event_type: eventType,
      battery_level: batteryLevel,
    });
  }
  
  return events;
}

function processFgEventsCSVContent(content: string, deviceId: string, groupId: string): AppUsageEvent[] {
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
  
  const events: AppUsageEvent[] = [];
  
  for (const row of records) {
    const startTimestamp = parseTimestamp(row.start_date, row.start_time, row.start_timezone);
    const endTimestamp = parseTimestamp(row.end_date, row.end_time, row.end_timezone);
    
    if (!startTimestamp) continue;
    
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

function processNetworkCSVContent(content: string, deviceId: string, groupId: string): NetworkEvent[] {
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
  
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

function processSensorCSVContent(content: string, deviceId: string, groupId: string): SensorEvent[] {
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
  
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

function findDataFiles(dir: string): string[] {
  const files: string[] = [];
  
  if (!fs.existsSync(dir)) return files;
  
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.name.startsWith('.') || entry.name === '__MACOSX') {
      continue;
    }
    
    if (entry.isDirectory()) {
      files.push(...findDataFiles(fullPath));
    } else if (entry.isFile() && (entry.name.endsWith('.csv') || entry.name.endsWith('.txt'))) {
      if (entry.name.toLowerCase().includes('survey')) {
        continue;
      }
      files.push(fullPath);
    }
  }
  
  return files;
}

async function consolidateGrouped(): Promise<void> {
  console.log('🔄 Starting grouped data consolidation pipeline...\n');
  
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
  
  const allBatteryEvents: BatteryEvent[] = [];
  const allAppUsageEvents: AppUsageEvent[] = [];
  const allNetworkEvents: NetworkEvent[] = [];
  const allSensorEvents: SensorEvent[] = [];
  
  const baseDir = path.resolve(__dirname, '..');
  const groupedDataDir = path.join(baseDir, 'grouped_data');
  
  console.log('📂 Scanning grouped_data directory...');
  
  const dataFiles = findDataFiles(groupedDataDir);
  console.log(`   Found ${dataFiles.length} data files\n`);
  
  for (const filePath of dataFiles) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const { headerLine, skipRows } = findHeaderRow(content);
      const headers = headerLine.split(',').map(h => h.trim().replace(/"/g, ''));
      
      const groupId = extractGroupId(filePath);
      const deviceId = extractDeviceId(filePath, groupId);
      const fileType = identifyFileType(filePath, headers);
      
      if (fileType === 'unknown') {
        stats.files_skipped++;
        continue;
      }
      
      stats.devices_found.add(`${groupId}:${deviceId}`);
      stats.groups_found.add(groupId);
      
      const contentToProcess = skipRows > 0 
        ? content.split('\n').slice(skipRows).join('\n')
        : content;
      
      switch (fileType) {
        case 'battery': {
          const events = processBatteryCSVContent(contentToProcess, deviceId, groupId);
          allBatteryEvents.push(...events);
          stats.battery_events += events.length;
          break;
        }
        case 'fg_events': {
          const events = processFgEventsCSVContent(contentToProcess, deviceId, groupId);
          allAppUsageEvents.push(...events);
          stats.app_usage_events += events.length;
          break;
        }
        case 'network': {
          const events = processNetworkCSVContent(contentToProcess, deviceId, groupId);
          allNetworkEvents.push(...events);
          stats.network_events += events.length;
          break;
        }
        case 'sensor': {
          const events = processSensorCSVContent(contentToProcess, deviceId, groupId);
          allSensorEvents.push(...events);
          stats.sensor_events += events.length;
          break;
        }
      }
      
      stats.files_processed++;
      
      if (stats.files_processed % 50 === 0) {
        console.log(`   Processed ${stats.files_processed} files...`);
      }
      
    } catch (error) {
      stats.errors.push(`${filePath}: ${error}`);
      stats.files_skipped++;
    }
  }
  
  const outputDir = path.join(baseDir, 'consolidated_grouped_data');
  fs.mkdirSync(outputDir, { recursive: true });
  
  console.log('\n📝 Writing consolidated CSV files...');
  
  if (allBatteryEvents.length > 0) {
    const batteryCSV = stringify(allBatteryEvents, { header: true });
    fs.writeFileSync(path.join(outputDir, 'battery_events.csv'), batteryCSV);
    console.log(`   ✅ battery_events.csv (${allBatteryEvents.length} rows)`);
  }
  
  if (allAppUsageEvents.length > 0) {
    const appCSV = stringify(allAppUsageEvents, { header: true });
    fs.writeFileSync(path.join(outputDir, 'app_usage_events.csv'), appCSV);
    console.log(`   ✅ app_usage_events.csv (${allAppUsageEvents.length} rows)`);
  }
  
  if (allNetworkEvents.length > 0) {
    const networkCSV = stringify(allNetworkEvents, { header: true });
    fs.writeFileSync(path.join(outputDir, 'network_events.csv'), networkCSV);
    console.log(`   ✅ network_events.csv (${allNetworkEvents.length} rows)`);
  }
  
  if (allSensorEvents.length > 0) {
    const sensorCSV = stringify(allSensorEvents, { header: true });
    fs.writeFileSync(path.join(outputDir, 'sensor_events.csv'), sensorCSV);
    console.log(`   ✅ sensor_events.csv (${allSensorEvents.length} rows)`);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 GROUPED DATA CONSOLIDATION SUMMARY');
  console.log('='.repeat(50));
  console.log(`Files processed:    ${stats.files_processed}`);
  console.log(`Files skipped:      ${stats.files_skipped}`);
  console.log(`Groups found:       ${stats.groups_found.size}`);
  console.log(`Devices found:      ${stats.devices_found.size}`);
  console.log('');
  console.log('Groups: ' + Array.from(stats.groups_found).sort().join(', '));
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
  
  console.log('\n✅ Grouped data consolidation complete!');
}

consolidateGrouped().catch(console.error);
