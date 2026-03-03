/**
 * Initialize TimescaleDB schema for Friend's Battery Data
 * Simplified schema for battery charging events only
 * Run with: DB_PORT=5433 DB_NAME=battery_analytics_friend bun run init-friend-schema.ts
 */

import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: process.env.DB_NAME || 'battery_analytics_friend',
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
DROP TABLE IF EXISTS aggregate_statistics CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS charging_sessions CASCADE;
DROP TABLE IF EXISTS battery_events CASCADE;

-- Battery Events Table (main table for raw events)
CREATE TABLE battery_events (
  id BIGINT NOT NULL,
  device_id VARCHAR(50) NOT NULL,
  event_type VARCHAR(50) NOT NULL, -- 'power_connected' or 'power_disconnected'
  battery_level INTEGER NOT NULL CHECK (battery_level >= 0 AND battery_level <= 100),
  event_timestamp TIMESTAMPTZ NOT NULL,
  timezone VARCHAR(10) NOT NULL DEFAULT '+05:30',
  raw_file_name VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (event_timestamp, id)
);

-- Create TimescaleDB hypertable
SELECT create_hypertable('battery_events', 'event_timestamp', chunk_time_interval => INTERVAL '1 day');

-- Charging Sessions Table (derived from battery events)
CREATE TABLE charging_sessions (
  id BIGINT NOT NULL,
  device_id VARCHAR(50) NOT NULL,
  session_start TIMESTAMPTZ NOT NULL,
  session_end TIMESTAMPTZ,
  start_battery_level INTEGER NOT NULL,
  end_battery_level INTEGER,
  charge_gained INTEGER GENERATED ALWAYS AS (end_battery_level - start_battery_level) STORED,
  session_duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN session_end IS NOT NULL THEN 
        EXTRACT(EPOCH FROM (session_end - session_start)) / 60
      ELSE NULL 
    END
  ) STORED,
  is_complete BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (session_start, id)
);

-- Create TimescaleDB hypertable for charging sessions
SELECT create_hypertable('charging_sessions', 'session_start', chunk_time_interval => INTERVAL '1 day');

-- User Profiles Table (computed statistics)
CREATE TABLE user_profiles (
  device_id VARCHAR(50) PRIMARY KEY,
  total_events INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration_minutes DECIMAL(8,2),
  avg_charge_gained DECIMAL(8,2),
  most_active_hour INTEGER,
  data_range_start TIMESTAMPTZ,
  data_range_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Aggregate Statistics Table (global stats cache)
CREATE TABLE aggregate_statistics (
  id SERIAL PRIMARY KEY,
  metric_name VARCHAR(100) NOT NULL,
  metric_value NUMERIC,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  data_source VARCHAR(50) DEFAULT 'friend'
);

-- Indexes for better performance
CREATE INDEX idx_battery_events_device_timestamp ON battery_events (device_id, event_timestamp DESC);
CREATE INDEX idx_battery_events_type_timestamp ON battery_events (event_type, event_timestamp DESC);
CREATE INDEX idx_charging_sessions_device_start ON charging_sessions (device_id, session_start DESC);
CREATE INDEX idx_charging_sessions_complete ON charging_sessions (is_complete, session_start DESC);

-- Materialized Views for Analytics

-- Device Daily Summary
CREATE MATERIALIZED VIEW device_daily_summary AS
SELECT 
  device_id,
  DATE(event_timestamp) as event_date,
  COUNT(*) as total_events,
  COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) as connection_events,
  COUNT(CASE WHEN event_type = 'power_disconnected' THEN 1 END) as disconnection_events,
  MIN(battery_level) as min_battery_level,
  MAX(battery_level) as max_battery_level,
  AVG(battery_level) as avg_battery_level,
  MIN(event_timestamp) as first_event_time,
  MAX(event_timestamp) as last_event_time
FROM battery_events
GROUP BY device_id, DATE(event_timestamp);

-- Battery Hourly Aggregation
CREATE MATERIALIZED VIEW battery_hourly_agg AS
SELECT 
  device_id,
  DATE_TRUNC('hour', event_timestamp) as hour_bucket,
  COUNT(*) as event_count,
  AVG(battery_level) as avg_battery_level,
  MIN(battery_level) as min_battery_level,
  MAX(battery_level) as max_battery_level,
  COUNT(CASE WHEN event_type = 'power_connected' THEN 1 END) as connection_count
FROM battery_events
GROUP BY device_id, DATE_TRUNC('hour', event_timestamp);

-- Charging Patterns View
CREATE VIEW charging_patterns AS
SELECT 
  device_id,
  EXTRACT(HOUR FROM session_start)::int as hour_of_day,
  EXTRACT(DOW FROM session_start)::int as day_of_week,
  AVG(session_duration_minutes) as avg_duration,
  AVG(charge_gained) as avg_charge_gained,
  COUNT(*) as session_count
FROM charging_sessions
WHERE is_complete = TRUE
GROUP BY device_id, EXTRACT(HOUR FROM session_start), EXTRACT(DOW FROM session_start);

-- Functions for updating materialized views
CREATE OR REPLACE FUNCTION refresh_device_daily_summary() 
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY device_daily_summary;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_battery_hourly_agg() 
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY battery_hourly_agg;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_battery_events_updated_at 
  BEFORE UPDATE ON battery_events 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_charging_sessions_updated_at 
  BEFORE UPDATE ON charging_sessions 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at 
  BEFORE UPDATE ON user_profiles 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
`;

async function initializeSchema() {
  const client = await pool.connect();

  try {
    console.log('Initializing friend database schema...');

    await client.query('BEGIN');

    // Execute schema
    await client.query(schema);

    await client.query('COMMIT');

    console.log('✅ Friend database schema initialized successfully!');
    console.log('📊 Tables created: battery_events, charging_sessions, user_profiles, aggregate_statistics');
    console.log('📈 Views created: device_daily_summary, battery_hourly_agg, charging_patterns');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Schema initialization failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  initializeSchema().catch(console.error);
}

export { initializeSchema };
