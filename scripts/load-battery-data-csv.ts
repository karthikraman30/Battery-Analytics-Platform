/**
 * Load battery charging data from battery_data/battery_data.csv into battery_charging_events database.
 *
 * This replaces ALL existing data in the database with the new consolidated CSV.
 * - Truncates charging_events, charging_sessions, user_stats
 * - Inserts raw events from the CSV
 * - Builds charging sessions (pairing connect/disconnect)
 * - Computes per-user stats
 *
 * Usage: cd scripts && DB_PORT=5433 bun run load-battery-data-csv.ts
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  database: 'battery_charging_events',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

const CSV_PATH = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  '../battery_data/battery_data.csv'
);

interface ParsedRow {
  userId: number;
  eventType: string;
  percentage: number;
  date: string;
  time: string;
  timezone: string;
}

function normalizeEventType(eventType: string): string {
  const t = eventType.toLowerCase().trim();
  if (t === 'charging' || t === 'power_connected') return 'power_connected';
  if (t === 'discharging' || t === 'power_disconnected') return 'power_disconnected';
  return t;
}

function parseCsvLine(line: string): ParsedRow | null {
  const parts = line.split(',');
  if (parts.length < 6) return null;

  const userId = parseInt(parts[0].trim(), 10);
  const eventType = normalizeEventType(parts[1].trim());
  const percentage = Math.min(100, Math.max(0, Math.round(parseFloat(parts[2].trim()))));
  const date = parts[3].trim();
  const time = parts[4].trim();
  const timezone = parts[5].trim();

  if (isNaN(userId) || isNaN(percentage)) return null;
  if (!eventType || !date || !time || !timezone) return null;

  return { userId, eventType, percentage, date, time, timezone };
}

async function main() {
  const client = await pool.connect();

  try {
    console.log('🔌 Connected to battery_charging_events database');
    console.log(`📂 Reading CSV: ${CSV_PATH}\n`);

    // ── Read and parse CSV ────────────────────────────────────────────────
    const content = fs.readFileSync(CSV_PATH, 'utf-8');
    const lines = content.trim().split('\n');
    const header = lines[0];
    console.log(`   Header: ${header}`);

    const dataLines = lines.slice(1);
    console.log(`   Total data lines: ${dataLines.length}`);

    const rows: ParsedRow[] = [];
    let parseErrors = 0;

    for (const line of dataLines) {
      if (!line.trim()) continue;
      const parsed = parseCsvLine(line);
      if (parsed) {
        rows.push(parsed);
      } else {
        parseErrors++;
      }
    }

    console.log(`   Parsed rows: ${rows.length}`);
    if (parseErrors > 0) console.log(`   ⚠️  Parse errors: ${parseErrors}`);

    const uniqueUsers = new Set(rows.map(r => r.userId));
    console.log(`   Unique users: ${uniqueUsers.size}\n`);

    // ── Truncate existing data ────────────────────────────────────────────
    await client.query('TRUNCATE charging_events, charging_sessions, user_stats RESTART IDENTITY CASCADE');
    console.log('🗑️  Cleared existing data\n');

    // ── Insert events in batches ──────────────────────────────────────────
    console.log('📥 Inserting events...');

    // Track per-user row counters for original_row_id
    const userRowCounter = new Map<number, number>();

    const CHUNK_SIZE = 500;
    let totalInserted = 0;

    for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
      const chunk = rows.slice(i, i + CHUNK_SIZE);
      const values: unknown[] = [];
      const placeholders: string[] = [];
      let paramIdx = 1;

      for (const row of chunk) {
        const counter = (userRowCounter.get(row.userId) ?? 0) + 1;
        userRowCounter.set(row.userId, counter);

        const timestampStr = `${row.date} ${row.time}${row.timezone}`;

        placeholders.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
        );
        values.push(
          row.userId,
          counter,
          row.eventType,
          row.percentage,
          row.date,
          row.time,
          row.timezone,
          timestampStr,
          'battery_data.csv'
        );
      }

      await client.query(
        `INSERT INTO charging_events
          (user_id, original_row_id, event_type, percentage, event_date, event_time, timezone, event_timestamp, source_file)
         VALUES ${placeholders.join(', ')}`,
        values
      );

      totalInserted += chunk.length;
      if (totalInserted % 5000 === 0 || i + CHUNK_SIZE >= rows.length) {
        console.log(`   ${totalInserted.toLocaleString()} / ${rows.length.toLocaleString()} events inserted`);
      }
    }

    console.log(`✅ Inserted ${totalInserted.toLocaleString()} events\n`);

    // ── Build charging sessions ───────────────────────────────────────────
    console.log('🔧 Building charging sessions...');

    const userIdsResult = await client.query(
      'SELECT DISTINCT user_id FROM charging_events ORDER BY user_id'
    );

    let totalSessions = 0;
    let completeSessions = 0;

    for (const { user_id } of userIdsResult.rows) {
      const events = await client.query(
        `SELECT event_type, percentage, event_timestamp
         FROM charging_events
         WHERE user_id = $1
         ORDER BY event_timestamp ASC, original_row_id ASC`,
        [user_id]
      );

      let pendingConnect: { time: string; percentage: number } | null = null;

      for (const evt of events.rows) {
        if (evt.event_type === 'power_connected') {
          // If already pending, create incomplete session
          if (pendingConnect) {
            await client.query(
              `INSERT INTO charging_sessions (user_id, connect_time, start_percentage, is_complete)
               VALUES ($1, $2, $3, FALSE)`,
              [user_id, pendingConnect.time, pendingConnect.percentage]
            );
            totalSessions++;
          }
          pendingConnect = { time: evt.event_timestamp, percentage: evt.percentage };
        } else if (evt.event_type === 'power_disconnected') {
          if (pendingConnect) {
            const durationMs =
              new Date(evt.event_timestamp).getTime() - new Date(pendingConnect.time).getTime();
            const durationMinutes = Math.max(0, durationMs / 60000);
            const chargeGained = evt.percentage - pendingConnect.percentage;

            await client.query(
              `INSERT INTO charging_sessions
                (user_id, connect_time, disconnect_time, duration_minutes, start_percentage, end_percentage, charge_gained, is_complete)
               VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
              [
                user_id,
                pendingConnect.time,
                evt.event_timestamp,
                durationMinutes.toFixed(2),
                pendingConnect.percentage,
                evt.percentage,
                chargeGained,
              ]
            );
            totalSessions++;
            completeSessions++;
            pendingConnect = null;
          }
          // else: orphan disconnect — skip
        }
      }

      // Trailing unpaired connect
      if (pendingConnect) {
        await client.query(
          `INSERT INTO charging_sessions (user_id, connect_time, start_percentage, is_complete)
           VALUES ($1, $2, $3, FALSE)`,
          [user_id, pendingConnect.time, pendingConnect.percentage]
        );
        totalSessions++;
      }
    }

    console.log(
      `✅ Built ${totalSessions.toLocaleString()} sessions ` +
      `(${completeSessions.toLocaleString()} complete, ${(totalSessions - completeSessions).toLocaleString()} incomplete)\n`
    );

    // ── Compute user_stats ────────────────────────────────────────────────
    console.log('🔧 Computing user stats...');

    await client.query(`
      INSERT INTO user_stats (
        user_id, total_events, connect_count, disconnect_count, event_mismatch,
        total_sessions, complete_sessions,
        avg_duration_minutes, avg_charge_gained,
        avg_connect_percentage, avg_disconnect_percentage,
        first_event, last_event, is_anomalous, source_file
      )
      SELECT
        e.user_id,
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE e.event_type = 'power_connected') as connect_count,
        COUNT(*) FILTER (WHERE e.event_type = 'power_disconnected') as disconnect_count,
        ABS(
          COUNT(*) FILTER (WHERE e.event_type = 'power_connected') -
          COUNT(*) FILTER (WHERE e.event_type = 'power_disconnected')
        ) as event_mismatch,
        COALESCE(s.total_sessions, 0),
        COALESCE(s.complete_sessions, 0),
        s.avg_duration_minutes,
        s.avg_charge_gained,
        AVG(e.percentage) FILTER (WHERE e.event_type = 'power_connected'),
        AVG(e.percentage) FILTER (WHERE e.event_type = 'power_disconnected'),
        MIN(e.event_timestamp),
        MAX(e.event_timestamp),
        ABS(
          COUNT(*) FILTER (WHERE e.event_type = 'power_connected') -
          COUNT(*) FILTER (WHERE e.event_type = 'power_disconnected')
        ) > 1 as is_anomalous,
        MIN(e.source_file)
      FROM charging_events e
      LEFT JOIN (
        SELECT
          user_id,
          COUNT(*) as total_sessions,
          COUNT(*) FILTER (WHERE is_complete) as complete_sessions,
          AVG(duration_minutes) FILTER (WHERE is_complete) as avg_duration_minutes,
          AVG(charge_gained) FILTER (WHERE is_complete) as avg_charge_gained
        FROM charging_sessions
        GROUP BY user_id
      ) s ON e.user_id = s.user_id
      GROUP BY e.user_id, s.total_sessions, s.complete_sessions, s.avg_duration_minutes, s.avg_charge_gained
      ORDER BY e.user_id
    `);

    const statsCount = await client.query('SELECT COUNT(*) as cnt FROM user_stats');
    const anomalousCount = await client.query(
      'SELECT COUNT(*) as cnt FROM user_stats WHERE is_anomalous = TRUE'
    );

    console.log(`✅ Computed stats for ${statsCount.rows[0].cnt} users`);
    console.log(`⚠️  Anomalous users (mismatch > 1): ${anomalousCount.rows[0].cnt}\n`);

    // ── Final summary ─────────────────────────────────────────────────────
    const eventCount = await client.query('SELECT COUNT(*) as cnt FROM charging_events');
    const sessionCount = await client.query('SELECT COUNT(*) as cnt FROM charging_sessions');
    const completeCount = await client.query(
      'SELECT COUNT(*) as cnt FROM charging_sessions WHERE is_complete = TRUE'
    );
    const negativeCount = await client.query(
      'SELECT COUNT(*) as cnt FROM charging_sessions WHERE charge_gained < 0'
    );
    const cleanUserCount = await client.query(`
      SELECT COUNT(*) as cnt FROM user_stats
      WHERE event_mismatch <= 10
        AND (last_event - first_event) >= INTERVAL '8 days'
    `);

    console.log('='.repeat(60));
    console.log('📋 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(`  Events:            ${parseInt(eventCount.rows[0].cnt).toLocaleString()}`);
    console.log(`  Sessions:          ${parseInt(sessionCount.rows[0].cnt).toLocaleString()} (${parseInt(completeCount.rows[0].cnt).toLocaleString()} complete)`);
    console.log(`  Users:             ${statsCount.rows[0].cnt}`);
    console.log(`  Anomalous:         ${anomalousCount.rows[0].cnt} users`);
    console.log(`  Clean users:       ${cleanUserCount.rows[0].cnt} (mismatch ≤ 10, ≥ 8 observation days)`);
    console.log(`  Negative charges:  ${negativeCount.rows[0].cnt} sessions`);
    console.log('='.repeat(60));

  } catch (error) {
    console.error('❌ Data loading failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
