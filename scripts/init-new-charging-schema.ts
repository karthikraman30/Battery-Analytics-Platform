/**
 * Initialize TimescaleDB schema for New Battery Charging Data
 * Database: battery_charging_new
 * Run with: DB_PORT=5433 DB_NAME=battery_charging_new bun run init-new-charging-schema.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'battery_charging_new',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const schema = `
-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Drop existing objects (for fresh start)
DROP MATERIALIZED VIEW IF EXISTS hourly_charging_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS daily_charging_summary CASCADE;
DROP MATERIALIZED VIEW IF EXISTS user_event_balance CASCADE;
DROP VIEW IF EXISTS charging_patterns_by_hour CASCADE;
DROP VIEW IF EXISTS charging_patterns_by_day CASCADE;
DROP TABLE IF EXISTS data_quality_issues CASCADE;
DROP TABLE IF EXISTS aggregate_statistics CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS charging_sessions CASCADE;
DROP TABLE IF EXISTS battery_events CASCADE;

-- ============================================
-- RAW EVENT TABLE (Main Hypertable)
-- ============================================

-- Battery events (raw charging connect/disconnect events)
CREATE TABLE battery_events (
  id BIGSERIAL,
  user_id VARCHAR(50) NOT NULL,              -- Extracted from filename (e.g., 'user_001')
  original_id INTEGER NOT NULL,              -- Original 'id' from CSV
  event_type VARCHAR(50) NOT NULL,           -- 'power_connected' or 'power_disconnected'
  battery_level INTEGER NOT NULL CHECK (battery_level >= 0 AND battery_level <= 100),
  event_timestamp TIMESTAMPTZ NOT NULL,
  event_date DATE NOT NULL,
  event_time TIME NOT NULL,
  timezone VARCHAR(10) NOT NULL DEFAULT '+05:30',
  source_file VARCHAR(255) NOT NULL,
  is_duplicate BOOLEAN DEFAULT FALSE,        -- Flag for detected duplicates
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_timestamp, id)
);

-- Create TimescaleDB hypertable
SELECT create_hypertable('battery_events', 'event_timestamp', chunk_time_interval => INTERVAL '7 days');

-- Indexes for performance
CREATE INDEX idx_battery_events_user ON battery_events(user_id, event_timestamp DESC);
CREATE INDEX idx_battery_events_type ON battery_events(event_type, event_timestamp DESC);
CREATE INDEX idx_battery_events_date ON battery_events(event_date);
CREATE INDEX idx_battery_events_level ON battery_events(battery_level);

-- ============================================
-- CHARGING SESSIONS TABLE (Derived)
-- ============================================

CREATE TABLE charging_sessions (
  id BIGSERIAL,
  user_id VARCHAR(50) NOT NULL,
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,
  start_battery_level INTEGER NOT NULL,
  end_battery_level INTEGER,
  charge_gained INTEGER GENERATED ALWAYS AS (
    CASE WHEN end_battery_level IS NOT NULL THEN end_battery_level - start_battery_level ELSE NULL END
  ) STORED,
  duration_minutes REAL,
  charging_rate REAL,                        -- Percentage points per minute
  is_complete BOOLEAN DEFAULT FALSE,
  start_event_id BIGINT,
  end_event_id BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_start, id)
);

-- Create hypertable for sessions
SELECT create_hypertable('charging_sessions', 'session_start', chunk_time_interval => INTERVAL '30 days');

CREATE INDEX idx_sessions_user ON charging_sessions(user_id, session_start DESC);
CREATE INDEX idx_sessions_complete ON charging_sessions(is_complete);
CREATE INDEX idx_sessions_duration ON charging_sessions(duration_minutes);

-- ============================================
-- USER PROFILES TABLE (Computed Statistics)
-- ============================================

CREATE TABLE user_profiles (
  user_id VARCHAR(50) PRIMARY KEY,
  total_events INTEGER DEFAULT 0,
  total_connect_events INTEGER DEFAULT 0,
  total_disconnect_events INTEGER DEFAULT 0,
  event_balance INTEGER DEFAULT 0,           -- connect - disconnect (should be 0 or 1)
  total_sessions INTEGER DEFAULT 0,
  complete_sessions INTEGER DEFAULT 0,
  
  -- Charging behavior metrics
  avg_session_duration_minutes REAL,
  median_session_duration_minutes REAL,
  min_session_duration_minutes REAL,
  max_session_duration_minutes REAL,
  
  avg_charge_gained REAL,
  avg_start_battery_level REAL,
  avg_end_battery_level REAL,
  
  -- Temporal patterns
  most_common_charging_hour INTEGER,
  most_common_charging_day INTEGER,          -- 0=Sunday, 6=Saturday
  
  -- Data quality
  data_start_date DATE,
  data_end_date DATE,
  data_days INTEGER,
  duplicate_events INTEGER DEFAULT 0,
  
  -- Flags
  has_imbalanced_events BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DATA QUALITY TRACKING
-- ============================================

CREATE TABLE data_quality_issues (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) NOT NULL,
  issue_type VARCHAR(100) NOT NULL,          -- 'duplicate', 'date_format', 'event_type_mapping', 'imbalanced'
  description TEXT,
  affected_rows INTEGER,
  source_file VARCHAR(255),
  detected_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- AGGREGATE STATISTICS CACHE
-- ============================================

CREATE TABLE aggregate_statistics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL UNIQUE,
  metric_value NUMERIC,
  metric_json JSONB,
  category VARCHAR(50),
  computed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MATERIALIZED VIEWS FOR ANALYTICS
-- ============================================

-- Daily charging summary per user
CREATE MATERIALIZED VIEW daily_charging_summary AS
SELECT 
  user_id,
  event_date,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) as connect_events,
  COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END) as disconnect_events,
  MIN(battery_level) as min_battery_level,
  MAX(battery_level) as max_battery_level,
  AVG(battery_level)::REAL as avg_battery_level,
  MIN(event_timestamp) as first_event,
  MAX(event_timestamp) as last_event
FROM battery_events
WHERE is_duplicate = FALSE
GROUP BY user_id, event_date;

CREATE UNIQUE INDEX idx_daily_summary_pk ON daily_charging_summary(user_id, event_date);

-- Hourly charging patterns (aggregated across all users)
CREATE MATERIALIZED VIEW hourly_charging_summary AS
SELECT 
  EXTRACT(HOUR FROM event_timestamp)::INTEGER as hour_of_day,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) as connect_events,
  COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END) as disconnect_events,
  AVG(battery_level)::REAL as avg_battery_level,
  COUNT(DISTINCT user_id) as unique_users
FROM battery_events
WHERE is_duplicate = FALSE
GROUP BY EXTRACT(HOUR FROM event_timestamp);

CREATE UNIQUE INDEX idx_hourly_summary_pk ON hourly_charging_summary(hour_of_day);

-- User event balance view (for finding anomalous users)
CREATE MATERIALIZED VIEW user_event_balance AS
SELECT 
  user_id,
  COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) as connect_count,
  COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END) as disconnect_count,
  COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) - 
    COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END) as balance_diff,
  ABS(COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) - 
      COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END)) as abs_balance_diff
FROM battery_events
WHERE is_duplicate = FALSE
GROUP BY user_id;

CREATE UNIQUE INDEX idx_user_balance_pk ON user_event_balance(user_id);

-- ============================================
-- VIEWS FOR ANALYSIS
-- ============================================

-- Charging patterns by hour of day
CREATE VIEW charging_patterns_by_hour AS
SELECT 
  user_id,
  EXTRACT(HOUR FROM session_start)::INTEGER as hour_of_day,
  COUNT(*) as session_count,
  AVG(duration_minutes) as avg_duration_minutes,
  AVG(charge_gained) as avg_charge_gained,
  AVG(start_battery_level) as avg_start_level,
  AVG(end_battery_level) as avg_end_level
FROM charging_sessions
WHERE is_complete = TRUE
GROUP BY user_id, EXTRACT(HOUR FROM session_start);

-- Charging patterns by day of week
CREATE VIEW charging_patterns_by_day AS
SELECT 
  user_id,
  EXTRACT(DOW FROM session_start)::INTEGER as day_of_week,
  COUNT(*) as session_count,
  AVG(duration_minutes) as avg_duration_minutes,
  AVG(charge_gained) as avg_charge_gained
FROM charging_sessions
WHERE is_complete = TRUE
GROUP BY user_id, EXTRACT(DOW FROM session_start);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to refresh all materialized views
CREATE OR REPLACE FUNCTION refresh_all_views() 
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_charging_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY hourly_charging_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_event_balance;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_timestamp 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Success message
SELECT 'Schema for battery_charging_new initialized successfully!' AS status;
`;

async function initSchema(): Promise<void> {
  console.log('🔧 Initializing schema for battery_charging_new database...');
  console.log(`   Database: ${pool.options.database}`);
  console.log(`   Host: ${pool.options.host}:${pool.options.port}`);
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query(schema);
    await client.query('COMMIT');
    
    // Verify tables created
    const result = await client.query(`
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
    const hypertables = await client.query(`
      SELECT hypertable_name 
      FROM timescaledb_information.hypertables;
    `);
    
    console.log('\n⏱️  Hypertables:');
    hypertables.rows.forEach((row: { hypertable_name: string }) => {
      console.log(`   - ${row.hypertable_name}`);
    });
    
    // Check materialized views
    const views = await client.query(`
      SELECT matviewname 
      FROM pg_matviews 
      WHERE schemaname = 'public';
    `);
    
    console.log('\n📈 Materialized Views:');
    views.rows.forEach((row: { matviewname: string }) => {
      console.log(`   - ${row.matviewname}`);
    });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error initializing schema:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initSchema();
