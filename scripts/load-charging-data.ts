/**
 * Load battery charging data from CSV files into battery_charging_events database.
 * 
 * Reads all CSV files from new_data_users/battery_charging_data(with 94)/,
 * inserts raw events, builds charging sessions, and computes user stats.
 * 
 * Usage: npx tsx scripts/load-charging-data.ts
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

const DATA_DIR = path.resolve(
    import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
    '../new_data_users/battery_charging_data(with 94)'
);

interface CsvRow {
    original_id: number;
    event_type: string;
    percentage: number;
    date: string;
    time: string;
    timezone: string;
}

/**
 * Normalize date to YYYY-MM-DD format.
 * Detected formats in the CSV data:
 *   - YYYY-MM-DD (e.g., 2025-10-22) — standard
 *   - DD-MM-YYYY (e.g., 22-10-2025) — day-first with dashes
 *   - MM/DD/YYYY (e.g., 10/22/2025, 11/1/2025) — US format with slashes, variable-length
 */
function normalizeDate(dateStr: string): string {
    // Format: YYYY-MM-DD (already correct)
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;

    // Format: DD-MM-YYYY (dashes, day-first)
    const ddmmyyyy = dateStr.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (ddmmyyyy) {
        const [, a, b, year] = ddmmyyyy;
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        // If first number > 12, it must be a day
        if (aNum > 12) {
            return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
        }
        // If second number > 12, it must be a day — so format is MM-DD-YYYY
        if (bNum > 12) {
            return `${year}-${a.padStart(2, '0')}-${b.padStart(2, '0')}`;
        }
        // Both <= 12 — ambiguous, assume DD-MM-YYYY (European, as per dominant pattern in data)
        return `${year}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
    }

    // Format: MM/DD/YYYY (slashes, US format, variable-length month/day)
    const slashFormat = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashFormat) {
        const [, month, day, year] = slashFormat;
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    return dateStr; // Return as-is, will fail in DB if invalid
}

function parseCsvLine(line: string): CsvRow | null {
    const parts = line.split(',');
    if (parts.length < 6) return null;

    // Handle float values like "1.0" -> 1
    const original_id = Math.round(parseFloat(parts[0].trim()));
    const event_type = parts[1].trim();
    const percentage = Math.round(parseFloat(parts[2].trim()));
    const rawDate = parts[3].trim();
    const time = parts[4].trim();
    const timezone = parts[5].trim();

    if (isNaN(original_id) || isNaN(percentage)) return null;
    if (!event_type || !rawDate || !time || !timezone) return null;

    const date = normalizeDate(rawDate);

    return { original_id, event_type, percentage, date, time, timezone };
}

function extractUserId(filename: string): number {
    const match = filename.match(/battery_charging_data_(\d+)\.csv/);
    if (!match) throw new Error(`Cannot extract user_id from filename: ${filename}`);
    return parseInt(match[1]);
}

async function loadCsvFiles() {
    const client = await pool.connect();

    try {
        console.log(`📂 Reading CSV files from: ${DATA_DIR}`);

        const files = fs.readdirSync(DATA_DIR)
            .filter(f => f.endsWith('.csv'))
            .sort();

        console.log(`📄 Found ${files.length} CSV files\n`);

        // Clear existing data
        await client.query('TRUNCATE charging_events, charging_sessions, user_stats RESTART IDENTITY CASCADE');
        console.log('🗑️  Cleared existing data\n');

        let totalRows = 0;
        let skippedFiles = 0;
        let filesWithIssues: string[] = [];

        // Process each CSV file
        for (const file of files) {
            const userId = extractUserId(file);
            const filePath = path.join(DATA_DIR, file);
            const content = fs.readFileSync(filePath, 'utf-8');
            const lines = content.trim().split('\n');

            // Skip header line
            const dataLines = lines.slice(1);

            if (dataLines.length === 0) {
                console.log(`  ⚠️  ${file} (user ${userId}): EMPTY - no data rows, skipping`);
                filesWithIssues.push(`${file} (empty)`);
                skippedFiles++;
                continue;
            }

            // Parse rows
            const rows: CsvRow[] = [];
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

            if (parseErrors > 0) {
                filesWithIssues.push(`${file} (${parseErrors} unparseable rows)`);
            }

            if (rows.length === 0) {
                console.log(`  ⚠️  ${file} (user ${userId}): No valid rows after parsing, skipping`);
                skippedFiles++;
                continue;
            }

            // Batch insert using parameterized query
            const values: unknown[] = [];
            const placeholders: string[] = [];
            let paramIdx = 1;

            for (const row of rows) {
                // Compute event_timestamp from date + time + timezone
                const timestampStr = `${row.date} ${row.time}${row.timezone}`;

                placeholders.push(
                    `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
                );
                values.push(
                    userId,
                    row.original_id,
                    row.event_type,
                    row.percentage,
                    row.date,
                    row.time,
                    row.timezone,
                    timestampStr
                );
            }

            // Insert in chunks of 500 rows to avoid parameter limits
            const CHUNK_SIZE = 500;
            let insertedForFile = 0;

            for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
                const chunkRows = rows.slice(i, i + CHUNK_SIZE);
                const chunkValues: unknown[] = [];
                const chunkPlaceholders: string[] = [];
                let chunkParamIdx = 1;

                for (const row of chunkRows) {
                    const timestampStr = `${row.date} ${row.time}${row.timezone}`;
                    chunkPlaceholders.push(
                        `($${chunkParamIdx++}, $${chunkParamIdx++}, $${chunkParamIdx++}, $${chunkParamIdx++}, $${chunkParamIdx++}, $${chunkParamIdx++}, $${chunkParamIdx++}, $${chunkParamIdx++}, $${chunkParamIdx++})`
                    );
                    chunkValues.push(
                        userId,
                        row.original_id,
                        row.event_type,
                        row.percentage,
                        row.date,
                        row.time,
                        row.timezone,
                        timestampStr,
                        file
                    );
                }

                await client.query(
                    `INSERT INTO charging_events (user_id, original_row_id, event_type, percentage, event_date, event_time, timezone, event_timestamp, source_file)
           VALUES ${chunkPlaceholders.join(', ')}`,
                    chunkValues
                );
                insertedForFile += chunkRows.length;
            }

            totalRows += insertedForFile;
            const status = rows.length <= 2 ? '⚠️ ' : '✅';
            console.log(`  ${status} ${file} → user ${userId}: ${insertedForFile} events`);
        }

        console.log(`\n📊 Total events inserted: ${totalRows.toLocaleString()}`);
        console.log(`📄 Files processed: ${files.length - skippedFiles}, skipped: ${skippedFiles}`);

        if (filesWithIssues.length > 0) {
            console.log(`\n⚠️  Files with issues:`);
            for (const issue of filesWithIssues) {
                console.log(`   - ${issue}`);
            }
        }

        // ------------------------------------------------------------------
        // Build charging sessions by pairing connect/disconnect events
        // ------------------------------------------------------------------
        console.log('\n🔧 Building charging sessions...');

        const userIds = await client.query(
            'SELECT DISTINCT user_id FROM charging_events ORDER BY user_id'
        );

        let totalSessions = 0;
        let completeSessions = 0;

        for (const { user_id } of userIds.rows) {
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
                    // If there's already a pending connect, create an incomplete session
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
                        const durationMs = new Date(evt.event_timestamp).getTime() - new Date(pendingConnect.time).getTime();
                        const durationMinutes = Math.max(0, durationMs / 60000);
                        const chargeGained = evt.percentage - pendingConnect.percentage;

                        await client.query(
                            `INSERT INTO charging_sessions 
                (user_id, connect_time, disconnect_time, duration_minutes, start_percentage, end_percentage, charge_gained, is_complete)
               VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
                            [user_id, pendingConnect.time, evt.event_timestamp, durationMinutes.toFixed(2), pendingConnect.percentage, evt.percentage, chargeGained]
                        );
                        totalSessions++;
                        completeSessions++;
                        pendingConnect = null;
                    } else {
                        // Disconnect without a preceding connect — orphan event
                        // We skip it for session building (tracked in event_mismatch)
                    }
                }
            }

            // Handle trailing unpaired connect
            if (pendingConnect) {
                await client.query(
                    `INSERT INTO charging_sessions (user_id, connect_time, start_percentage, is_complete)
           VALUES ($1, $2, $3, FALSE)`,
                    [user_id, pendingConnect.time, pendingConnect.percentage]
                );
                totalSessions++;
            }
        }

        console.log(`✅ Built ${totalSessions.toLocaleString()} sessions (${completeSessions.toLocaleString()} complete, ${(totalSessions - completeSessions).toLocaleString()} incomplete)`);

        // ------------------------------------------------------------------
        // Compute user_stats
        // ------------------------------------------------------------------
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
        const anomalousCount = await client.query('SELECT COUNT(*) as cnt FROM user_stats WHERE is_anomalous = TRUE');

        console.log(`✅ Computed stats for ${statsCount.rows[0].cnt} users`);
        console.log(`⚠️  Anomalous users (mismatch > 1): ${anomalousCount.rows[0].cnt}`);

        // Final summary
        console.log('\n' + '='.repeat(60));
        console.log('📋 FINAL SUMMARY');
        console.log('='.repeat(60));

        const eventCount = await client.query('SELECT COUNT(*) as cnt FROM charging_events');
        const sessionCount = await client.query('SELECT COUNT(*) as cnt FROM charging_sessions');
        const completeCount = await client.query('SELECT COUNT(*) as cnt FROM charging_sessions WHERE is_complete = TRUE');

        console.log(`  Events:     ${parseInt(eventCount.rows[0].cnt).toLocaleString()}`);
        console.log(`  Sessions:   ${parseInt(sessionCount.rows[0].cnt).toLocaleString()} (${parseInt(completeCount.rows[0].cnt).toLocaleString()} complete)`);
        console.log(`  Users:      ${statsCount.rows[0].cnt}`);
        console.log(`  Anomalous:  ${anomalousCount.rows[0].cnt} users`);
        console.log('='.repeat(60));

    } catch (error) {
        console.error('❌ Data loading failed:', error);
        throw error;
    } finally {
        client.release();
        await pool.end();
    }
}

loadCsvFiles().catch(err => {
    console.error(err);
    process.exit(1);
});
