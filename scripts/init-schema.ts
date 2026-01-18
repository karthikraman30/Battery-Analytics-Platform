/**
 * Initialize TimescaleDB schema for Battery Analytics Platform
 * Run with: DB_PORT=5433 bun run init-schema.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'battery_analytics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const schema = `
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Drop existing objects (for fresh start)
DROP MATERIALIZED VIEW IF EXISTS device_daily_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS battery_hourly_agg CASCADE;
DROP VIEW IF EXISTS charging_patterns CASCADE;
DROP VIEW IF EXISTS top_apps_by_usage CASCADE;
DROP TABLE IF EXISTS aggregate_statistics CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS sensor_events CASCADE;
DROP TABLE IF EXISTS network_events CASCADE;
DROP TABLE IF EXISTS app_usage_events CASCADE;
DROP TABLE IF EXISTS charging_sessions CASCADE;
DROP TABLE IF EXISTS battery_events CASCADE;

-- ============================================
-- RAW EVENT TABLES (Hypertables)
-- ============================================

-- Battery events (charging connect/disconnect with percentage)
CREATE TABLE battery_events (
  id BIGSERIAL,
  device_id VARCHAR(100) NOT NULL,
  group_id VARCHAR(100),
  timestamp TIMESTAMPTZ NOT NULL,
  event_type VARCHAR(50) NOT NULL,  -- 'power_connected' or 'power_disconnected'
  battery_level REAL CHECK (battery_level >= 0 AND battery_level <= 100),
  data_quality_flags TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, timestamp, id)
);

SELECT create_hypertable('battery_events', 'timestamp', 
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_battery_device ON battery_events(device_id, timestamp DESC);
CREATE INDEX idx_battery_event_type ON battery_events(event_type, timestamp DESC);

-- Charging sessions (derived from battery events)
-- Note: For hypertables, the time column must be part of any unique constraint
CREATE TABLE charging_sessions (
  session_id UUID DEFAULT gen_random_uuid(),
  device_id VARCHAR(100) NOT NULL,
  group_id VARCHAR(100),
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,
  duration_minutes REAL,
  start_battery_level REAL,
  end_battery_level REAL,
  charge_gained REAL,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, session_start, session_id)
);

SELECT create_hypertable('charging_sessions', 'session_start',
  chunk_time_interval => INTERVAL '30 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_charging_device ON charging_sessions(device_id, session_start DESC);

-- App usage events (foreground events)
CREATE TABLE app_usage_events (
  id BIGSERIAL,
  device_id VARCHAR(100) NOT NULL,
  group_id VARCHAR(100),
  start_timestamp TIMESTAMPTZ NOT NULL,
  end_timestamp TIMESTAMPTZ,
  duration_seconds REAL,
  package_name VARCHAR(255),
  app_name VARCHAR(255),
  is_screen_off BOOLEAN DEFAULT FALSE,  -- True if package is 'device_locked_package'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, start_timestamp, id)
);

SELECT create_hypertable('app_usage_events', 'start_timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_app_usage_device ON app_usage_events(device_id, start_timestamp DESC);
CREATE INDEX idx_app_usage_package ON app_usage_events(package_name, start_timestamp DESC);

-- Network events
CREATE TABLE network_events (
  id BIGSERIAL,
  device_id VARCHAR(100) NOT NULL,
  group_id VARCHAR(100),
  timestamp TIMESTAMPTZ NOT NULL,
  ssid VARCHAR(255),
  is_wifi BOOLEAN,  -- True for WiFi, False for mobile data
  signal_strength REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, timestamp, id)
);

SELECT create_hypertable('network_events', 'timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_network_device ON network_events(device_id, timestamp DESC);

-- Sensor events
CREATE TABLE sensor_events (
  id BIGSERIAL,
  device_id VARCHAR(100) NOT NULL,
  group_id VARCHAR(100),
  timestamp TIMESTAMPTZ NOT NULL,
  accel_x REAL,
  accel_y REAL,
  accel_z REAL,
  gyro_x REAL,
  gyro_y REAL,
  gyro_z REAL,
  mag_x REAL,
  mag_y REAL,
  mag_z REAL,
  light REAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (device_id, timestamp, id)
);

SELECT create_hypertable('sensor_events', 'timestamp',
  chunk_time_interval => INTERVAL '7 days',
  if_not_exists => TRUE
);

CREATE INDEX idx_sensor_device ON sensor_events(device_id, timestamp DESC);

-- ============================================
-- AGGREGATED TABLES & PROFILES
-- ============================================

-- User/Device profiles (computed from raw data)
CREATE TABLE user_profiles (
  device_id VARCHAR(100) PRIMARY KEY,
  group_id VARCHAR(100),
  data_start_date DATE,
  data_end_date DATE,
  total_days INT,
  total_battery_events INT,
  total_charging_sessions INT,
  avg_daily_charge_count REAL,
  avg_charge_duration_min REAL,
  avg_charge_start_level REAL,
  avg_daily_screen_time_min REAL,
  top_apps JSONB,
  preferred_charge_hours INT[],
  behavioral_segment VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregate statistics (global level)
CREATE TABLE aggregate_statistics (
  stat_id SERIAL PRIMARY KEY,
  stat_name VARCHAR(200) UNIQUE NOT NULL,
  stat_value JSONB,
  stat_category VARCHAR(100),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- HELPER VIEWS
-- ============================================

-- View: charging patterns by hour and day of week
CREATE OR REPLACE VIEW charging_patterns AS
SELECT
  device_id,
  EXTRACT(HOUR FROM session_start) AS hour_of_day,
  EXTRACT(DOW FROM session_start) AS day_of_week,
  COUNT(*) AS charge_count,
  AVG(duration_minutes) AS avg_duration,
  AVG(start_battery_level) AS avg_start_level,
  AVG(charge_gained) AS avg_charge_gained
FROM charging_sessions
WHERE is_complete = TRUE
GROUP BY device_id, hour_of_day, day_of_week;

-- View: top apps by usage
CREATE OR REPLACE VIEW top_apps_by_usage AS
SELECT
  device_id,
  package_name,
  app_name,
  COUNT(*) AS session_count,
  SUM(duration_seconds) / 60.0 AS total_minutes,
  AVG(duration_seconds) AS avg_session_seconds
FROM app_usage_events
WHERE is_screen_off = FALSE AND package_name IS NOT NULL
GROUP BY device_id, package_name, app_name
ORDER BY total_minutes DESC;

-- Success message
SELECT 'Schema initialized successfully!' AS status;
`;

async function initSchema(): Promise<void> {
  console.log('🔧 Initializing TimescaleDB schema...');
  console.log(`   Database: ${pool.options.database}`);
  console.log(`   Host: ${pool.options.host}:${pool.options.port}`);
  
  try {
    // Execute schema
    await pool.query(schema);
    
    // Verify tables created
    const result = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    
    console.log('\n✅ Schema initialized successfully!');
    console.log('\n📊 Tables created:');
    result.rows.forEach((row: { table_name: string }) => {
      console.log(`   - ${row.table_name}`);
    });
    
    // Check hypertables
    const hypertables = await pool.query(`
      SELECT hypertable_name 
      FROM timescaledb_information.hypertables;
    `);
    
    console.log('\n⏱️  Hypertables (time-series optimized):');
    hypertables.rows.forEach((row: { hypertable_name: string }) => {
      console.log(`   - ${row.hypertable_name}`);
    });
    
  } catch (error) {
    console.error('❌ Error initializing schema:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

initSchema();
