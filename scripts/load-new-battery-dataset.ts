/**
 * Load the new battery dataset CSV into battery_charging_events database.
 * 
 * This script:
 * 1. Reads battery_data/battery_dataset.csv (single file, 107 users, ~7188 events)
 * 2. Truncates all existing data (charging_events, charging_sessions, user_stats)
 * 3. Inserts raw events into charging_events
 * 4. Builds charging sessions by pairing connect/disconnect events
 * 5. Computes per-user summary stats in user_stats
 * 
 * Connection: Uses CHARGING_DATABASE_URL env var if set (Supabase),
 *             otherwise falls back to local DB on port 5433.
 * 
 * Usage:
 *   bun run scripts/load-new-battery-dataset.ts
 *   # or with env:
 *   CHARGING_DATABASE_URL=... bun run scripts/load-new-battery-dataset.ts
 */
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

// ─── Connection setup ───────────────────────────────────────────────────────

function buildConfig() {
    const url = process.env.CHARGING_DATABASE_URL || process.env.DATABASE_URL;
    if (url) {
        const isLocal = url.includes('localhost') || url.includes('127.0.0.1');
        return {
            connectionString: url,
            ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
            max: 5,
            connectionTimeoutMillis: 15000,
        };
    }
    // Local dev fallback
    return {
        host: process.env.DB_HOST || 'localhost',
        port: parseInt(process.env.DB_PORT || '5433'),
        database: 'battery_charging_events',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 5,
        connectionTimeoutMillis: 10000,
    };
}

const pool = new Pool(buildConfig());

// Set search_path for Supabase (charging schema)
pool.on('connect', async (client) => {
    const url = process.env.CHARGING_DATABASE_URL || process.env.DATABASE_URL;
    if (url && !url.includes('localhost') && !url.includes('127.0.0.1')) {
        await client.query("SET search_path TO charging, public");
    }
});

const CSV_PATH = path.resolve(
    import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
    '../battery_data/battery_dataset.csv'
);

// ─── CSV parsing ────────────────────────────────────────────────────────────

interface CsvRow {
    user_id: number;
    event_type: string;
    percentage: number;
    date: string;
    time: string;
    timezone: string;
}

function parseCsvLine(line: string): CsvRow | null {
    // Remove \r if present
    line = line.replace(/\r$/, '');
    const parts = line.split(',');
    if (parts.length < 6) return null;

    const user_id = parseInt(parts[0].trim());
    const event_type = parts[1].trim();
    const percentage = parseInt(parts[2].trim());
    const date = parts[3].trim();
    const time = parts[4].trim();
    const timezone = parts[5].trim();

    if (isNaN(user_id) || isNaN(percentage)) return null;
    if (!event_type || !date || !time || !timezone) return null;

    return { user_id, event_type, percentage, date, time, timezone };
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
    const client = await pool.connect();

    try {
        console.log('🔌 Connected to database');
        console.log(`📂 Reading CSV: ${CSV_PATH}`);

        // Read and parse CSV
        const content = fs.readFileSync(CSV_PATH, 'utf-8');
        const lines = content.trim().split('\n');
        const dataLines = lines.slice(1); // skip header

        console.log(`📊 Total data rows: ${dataLines.length}`);

        const rows: CsvRow[] = [];
        let parseErrors = 0;

        for (const line of dataLines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            const parsed = parseCsvLine(trimmed);
            if (parsed) {
                rows.push(parsed);
            } else {
                parseErrors++;
            }
        }

        console.log(`✅ Parsed ${rows.length} valid rows (${parseErrors} parse errors)`);

        // Get unique user IDs
        const uniqueUsers = new Set(rows.map(r => r.user_id));
        console.log(`👥 Unique users: ${uniqueUsers.size}`);

        // ──────────────────────────────────────────────────────────────────
        // Step 1: Clear existing data
        // ──────────────────────────────────────────────────────────────────
        console.log('\n🗑️  Clearing existing data...');
        await client.query('DELETE FROM user_stats');
        await client.query('DELETE FROM charging_sessions');
        await client.query('DELETE FROM charging_events');
        // Reset sequences
        await client.query("SELECT setval(pg_get_serial_sequence('charging_events', 'id'), 1, false)").catch(() => {});
        await client.query("SELECT setval(pg_get_serial_sequence('charging_sessions', 'id'), 1, false)").catch(() => {});
        console.log('✅ Cleared all existing data');

        // ──────────────────────────────────────────────────────────────────
        // Step 2: Insert raw events in chunks
        // ──────────────────────────────────────────────────────────────────
        console.log('\n📥 Inserting charging events...');
        const CHUNK_SIZE = 500;
        let totalInserted = 0;
        let globalRowId = 1; // Generate IDs manually since Supabase may not have auto-increment

        for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
            const chunk = rows.slice(i, i + CHUNK_SIZE);
            const values: unknown[] = [];
            const placeholders: string[] = [];
            let paramIdx = 1;

            for (const row of chunk) {
                // Build timestamp string: "YYYY-MM-DD HH:MM:SS+05:30"
                const timestampStr = `${row.date} ${row.time}${row.timezone}`;

                placeholders.push(
                    `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
                );
                values.push(
                    globalRowId++,        // id
                    row.user_id,
                    null,                 // original_row_id (not applicable for single CSV)
                    row.event_type,
                    row.percentage,
                    row.date,
                    row.time,
                    row.timezone,
                    timestampStr,
                    'battery_dataset.csv'
                );
            }

            await client.query(
                `INSERT INTO charging_events 
                 (id, user_id, original_row_id, event_type, percentage, event_date, event_time, timezone, event_timestamp, source_file)
                 VALUES ${placeholders.join(', ')}`,
                values
            );
            totalInserted += chunk.length;
            process.stdout.write(`\r  Inserted ${totalInserted}/${rows.length} events`);
        }
        console.log(`\n✅ Inserted ${totalInserted} events`);

        // ──────────────────────────────────────────────────────────────────
        // Step 3: Build charging sessions (in memory, then batch insert)
        // ──────────────────────────────────────────────────────────────────
        console.log('\n🔧 Building charging sessions...');

        // Fetch all events sorted by user_id, timestamp
        const allEvents = await client.query(
            `SELECT user_id, event_type, percentage, event_timestamp
             FROM charging_events
             ORDER BY user_id, event_timestamp ASC, id ASC`
        );

        // Build sessions in memory
        interface SessionRow {
            id: number;
            user_id: number;
            connect_time: string;
            disconnect_time: string | null;
            duration_minutes: string | null;
            start_percentage: number;
            end_percentage: number | null;
            charge_gained: number | null;
            is_complete: boolean;
        }

        const sessions: SessionRow[] = [];
        let sessionId = 1;
        let currentUserId: number | null = null;
        let pendingConnect: { time: string; percentage: number } | null = null;

        for (const evt of allEvents.rows) {
            // When user changes, flush pending connect
            if (evt.user_id !== currentUserId) {
                if (pendingConnect && currentUserId !== null) {
                    sessions.push({
                        id: sessionId++, user_id: currentUserId,
                        connect_time: pendingConnect.time, disconnect_time: null,
                        duration_minutes: null, start_percentage: pendingConnect.percentage,
                        end_percentage: null, charge_gained: null, is_complete: false,
                    });
                }
                pendingConnect = null;
                currentUserId = evt.user_id;
            }

            if (evt.event_type === 'power_connected') {
                if (pendingConnect) {
                    sessions.push({
                        id: sessionId++, user_id: currentUserId!,
                        connect_time: pendingConnect.time, disconnect_time: null,
                        duration_minutes: null, start_percentage: pendingConnect.percentage,
                        end_percentage: null, charge_gained: null, is_complete: false,
                    });
                }
                pendingConnect = { time: evt.event_timestamp, percentage: evt.percentage };
            } else if (evt.event_type === 'power_disconnected') {
                if (pendingConnect) {
                    const durationMs = new Date(evt.event_timestamp).getTime() - new Date(pendingConnect.time).getTime();
                    const durationMinutes = Math.max(0, durationMs / 60000);
                    const chargeGained = evt.percentage - pendingConnect.percentage;

                    sessions.push({
                        id: sessionId++, user_id: currentUserId!,
                        connect_time: pendingConnect.time, disconnect_time: evt.event_timestamp,
                        duration_minutes: durationMinutes.toFixed(2),
                        start_percentage: pendingConnect.percentage,
                        end_percentage: evt.percentage,
                        charge_gained: chargeGained, is_complete: true,
                    });
                    pendingConnect = null;
                }
                // else: orphan disconnect — skip
            }
        }

        // Flush last user's pending connect
        if (pendingConnect && currentUserId !== null) {
            sessions.push({
                id: sessionId++, user_id: currentUserId,
                connect_time: pendingConnect.time, disconnect_time: null,
                duration_minutes: null, start_percentage: pendingConnect.percentage,
                end_percentage: null, charge_gained: null, is_complete: false,
            });
        }

        const completeSessions = sessions.filter(s => s.is_complete).length;
        console.log(`  Built ${sessions.length} sessions in memory (${completeSessions} complete)`);

        // Batch insert sessions
        const SESSION_CHUNK = 200;
        for (let i = 0; i < sessions.length; i += SESSION_CHUNK) {
            const chunk = sessions.slice(i, i + SESSION_CHUNK);
            const values: unknown[] = [];
            const placeholders: string[] = [];
            let paramIdx = 1;

            for (const s of chunk) {
                placeholders.push(
                    `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
                );
                values.push(s.id, s.user_id, s.connect_time, s.disconnect_time, s.duration_minutes,
                    s.start_percentage, s.end_percentage, s.charge_gained, s.is_complete);
            }

            await client.query(
                `INSERT INTO charging_sessions
                 (id, user_id, connect_time, disconnect_time, duration_minutes, start_percentage, end_percentage, charge_gained, is_complete)
                 VALUES ${placeholders.join(', ')}`,
                values
            );
            process.stdout.write(`\r  Inserted ${Math.min(i + SESSION_CHUNK, sessions.length)}/${sessions.length} sessions`);
        }

        console.log(`\n✅ Inserted ${sessions.length} sessions (${completeSessions} complete, ${sessions.length - completeSessions} incomplete)`);

        // ──────────────────────────────────────────────────────────────────
        // Step 4: Compute user_stats
        // ──────────────────────────────────────────────────────────────────
        console.log('\n🔧 Computing user stats...');

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
                'battery_dataset.csv'
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

        // ──────────────────────────────────────────────────────────────────
        // Step 5: Final summary
        // ──────────────────────────────────────────────────────────────────
        const eventCount = await client.query('SELECT COUNT(*) as cnt FROM charging_events');
        const sessionCount = await client.query('SELECT COUNT(*) as cnt FROM charging_sessions');
        const completeCount = await client.query('SELECT COUNT(*) as cnt FROM charging_sessions WHERE is_complete = TRUE');
        const statsCount = await client.query('SELECT COUNT(*) as cnt FROM user_stats');
        const anomalousCount = await client.query('SELECT COUNT(*) as cnt FROM user_stats WHERE is_anomalous = TRUE');
        const cleanCount = await client.query('SELECT COUNT(*) as cnt FROM user_stats WHERE is_anomalous = FALSE');

        const dateRange = await client.query(
            `SELECT MIN(event_timestamp)::date as start_date, MAX(event_timestamp)::date as end_date FROM charging_events`
        );

        console.log('\n' + '═'.repeat(60));
        console.log('📋 FINAL SUMMARY — New Battery Dataset');
        console.log('═'.repeat(60));
        console.log(`  Events:       ${parseInt(eventCount.rows[0].cnt).toLocaleString()}`);
        console.log(`  Sessions:     ${parseInt(sessionCount.rows[0].cnt).toLocaleString()} (${parseInt(completeCount.rows[0].cnt).toLocaleString()} complete)`);
        console.log(`  Users:        ${parseInt(statsCount.rows[0].cnt)}`);
        console.log(`  Clean:        ${parseInt(cleanCount.rows[0].cnt)} users`);
        console.log(`  Anomalous:    ${parseInt(anomalousCount.rows[0].cnt)} users (mismatch > 1)`);
        console.log(`  Date range:   ${dateRange.rows[0].start_date} → ${dateRange.rows[0].end_date}`);
        console.log('═'.repeat(60));
        console.log('\n🎉 Data loading complete! Restart the server to see updated visualizations.');

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
