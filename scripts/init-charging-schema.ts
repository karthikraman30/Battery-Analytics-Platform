/**
 * Initialize schema for battery_charging_events database.
 * Creates tables: charging_events, charging_sessions, user_stats
 * 
 * Usage: npx tsx scripts/init-charging-schema.ts
 */
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5433'),
    database: 'battery_charging_events',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

async function initSchema() {
    const client = await pool.connect();

    try {
        console.log('🔌 Connected to battery_charging_events database');

        // Drop existing tables if they exist (for clean re-runs)
        await client.query(`
      DROP TABLE IF EXISTS user_stats CASCADE;
      DROP TABLE IF EXISTS charging_sessions CASCADE;
      DROP TABLE IF EXISTS charging_events CASCADE;
    `);
        console.log('🗑️  Dropped existing tables (if any)');

        // Table 1: Raw charging events
        await client.query(`
      CREATE TABLE charging_events (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        original_row_id INTEGER,
        event_type VARCHAR(20) NOT NULL,
        percentage INTEGER NOT NULL,
        event_date DATE NOT NULL,
        event_time TIME NOT NULL,
        timezone VARCHAR(10) NOT NULL,
        event_timestamp TIMESTAMPTZ NOT NULL,
        source_file VARCHAR(60) NOT NULL
      );
    `);
        console.log('✅ Created table: charging_events');

        // Table 2: Paired charging sessions
        await client.query(`
      CREATE TABLE charging_sessions (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        connect_time TIMESTAMPTZ NOT NULL,
        disconnect_time TIMESTAMPTZ,
        duration_minutes NUMERIC,
        start_percentage INTEGER NOT NULL,
        end_percentage INTEGER,
        charge_gained INTEGER,
        is_complete BOOLEAN DEFAULT FALSE
      );
    `);
        console.log('✅ Created table: charging_sessions');

        // Table 3: Per-user summary stats
        await client.query(`
      CREATE TABLE user_stats (
        user_id INTEGER PRIMARY KEY,
        total_events INTEGER DEFAULT 0,
        connect_count INTEGER DEFAULT 0,
        disconnect_count INTEGER DEFAULT 0,
        event_mismatch INTEGER DEFAULT 0,
        total_sessions INTEGER DEFAULT 0,
        complete_sessions INTEGER DEFAULT 0,
        avg_duration_minutes NUMERIC,
        avg_charge_gained NUMERIC,
        avg_connect_percentage NUMERIC,
        avg_disconnect_percentage NUMERIC,
        first_event TIMESTAMPTZ,
        last_event TIMESTAMPTZ,
        is_anomalous BOOLEAN DEFAULT FALSE,
        source_file VARCHAR(60)
      );
    `);
        console.log('✅ Created table: user_stats');

        // Create indexes
        await client.query(`
      CREATE INDEX idx_charging_events_user_id ON charging_events(user_id);
      CREATE INDEX idx_charging_events_event_type ON charging_events(event_type);
      CREATE INDEX idx_charging_events_timestamp ON charging_events(event_timestamp);
      CREATE INDEX idx_charging_events_user_timestamp ON charging_events(user_id, event_timestamp);
      CREATE INDEX idx_charging_sessions_user_id ON charging_sessions(user_id);
      CREATE INDEX idx_charging_sessions_connect_time ON charging_sessions(connect_time);
      CREATE INDEX idx_user_stats_anomalous ON user_stats(is_anomalous);
    `);
        console.log('✅ Created indexes');

        console.log('\n🎉 Schema initialization complete!');

    } catch (error) {
        console.error('❌ Schema initialization failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

initSchema().catch(err => {
    console.error(err);
    process.exit(1);
});
