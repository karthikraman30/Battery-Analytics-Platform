import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'postgresql://postgres.rzqofppbzsaxilnyoxsv:zEN10OAQ8hCvrPQF@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';
const BASE_DIR = path.resolve(__dirname, '..');

// Duplicate groups: keep first (lowest), remove rest
const DUPLICATE_GROUPS = [
    ['033', '076', '077', '095', '207'],
    ['058', '067', '131', '157', '209'],
    ['059', '066', '133', '164', '211'],
    ['060', '101', '130', '162', '217'],
    ['002', '004', '093'],
    ['061', '069', '098'],
    ['132', '160', '210'],
    ['134', '158', '213'],
    ['135', '153', '214'],
    ['136', '161', '215'],
    ['005', '224'],
    ['035', '203'],
    ['043', '071'],
    ['055', '155'],
    ['064', '091'],
    ['065', '085'],
    ['084', '185'],
    ['119', '223'],
    ['156', '208'],
    ['159', '216'],
    ['165', '212'],
    ['172', '220'],
    ['192', '193'],
    ['222', '236'],
    ['239', '260'],
    ['240', '261'],
    ['241', '262'],
    ['242', '263'],
    ['243', '264'],
    ['244', '265'],
    ['245', '266'],
    ['246', '267'],
    ['247', '268'],
    ['248', '269'],
    ['249', '270'],
    ['250', '271'],
    ['251', '272'],
    ['252', '273'],
    ['253', '274'],
];

// Clean CSV files by removing rows with duplicate user_ids
function cleanCSVFiles(toRemove: Set<number>): void {
    console.log('\n═══ CLEANING CSV FILES ═══');
    const csvFiles = [
        { name: 'clean_charging_events.csv', userIdCol: 'user_id' },
        { name: 'clean_charging_sessions.csv', userIdCol: 'user_id' },
        { name: 'clean_users_summary.csv', userIdCol: 'user_id' },
    ];

    for (const { name, userIdCol } of csvFiles) {
        const filePath = path.join(BASE_DIR, name);
        if (!fs.existsSync(filePath)) {
            console.log(`  ⚠️  ${name} not found, skipping`);
            continue;
        }

        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');
        const header = lines[0];
        const cols = header.split(',');
        const userIdIdx = cols.indexOf(userIdCol);

        if (userIdIdx === -1) {
            console.log(`  ⚠️  ${name}: column '${userIdCol}' not found, skipping`);
            continue;
        }

        const beforeCount = lines.length - 1; // exclude header
        const kept: string[] = [header];
        let removed = 0;

        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            const fields = line.split(',');
            const userId = parseInt(fields[userIdIdx], 10);
            if (toRemove.has(userId)) {
                removed++;
            } else {
                kept.push(line);
            }
        }

        // Write cleaned file (overwrite original)
        fs.writeFileSync(filePath, kept.join('\n') + '\n');
        console.log(`  ✅ ${name}: ${beforeCount} → ${kept.length - 1} rows (removed ${removed})`);
    }
}

async function cleanDatabase(pool: Pool, label: string, toRemove: number[], schema?: string): Promise<{ events: string; sessions: string; users: string } | null> {
    try {
        if (schema) {
            await pool.query(`SET search_path TO ${schema}, public`);
        }
        await pool.query('SELECT 1');
        console.log('✅ Connected');
    } catch (err: any) {
        console.log(`⚠️  ${label} not available (${err.code || err.message}). Skipping.`);
        await pool.end().catch(() => {});
        return null;
    }

    // Before counts
    const beforeEvents = await pool.query('SELECT COUNT(*) as cnt FROM charging_events');
    const beforeSessions = await pool.query('SELECT COUNT(*) as cnt FROM charging_sessions');
    const beforeUsers = await pool.query('SELECT COUNT(DISTINCT user_id) as cnt FROM charging_events');
    console.log(`  Before: ${beforeUsers.rows[0].cnt} users, ${beforeEvents.rows[0].cnt} events, ${beforeSessions.rows[0].cnt} sessions`);

    // Delete from charging_sessions first (may reference user_id)
    const delSessions = await pool.query('DELETE FROM charging_sessions WHERE user_id = ANY($1::int[])', [toRemove]);
    console.log(`  Deleted ${delSessions.rowCount} sessions`);

    // Delete from charging_events
    const delEvents = await pool.query('DELETE FROM charging_events WHERE user_id = ANY($1::int[])', [toRemove]);
    console.log(`  Deleted ${delEvents.rowCount} events`);

    // Delete from user_stats (may not exist)
    try {
        const delStats = await pool.query('DELETE FROM user_stats WHERE user_id = ANY($1::int[])', [toRemove]);
        console.log(`  Deleted ${delStats.rowCount} user_stats rows`);
    } catch {
        console.log('  ℹ️  user_stats table not found, skipping');
    }

    // After counts
    const afterEvents = await pool.query('SELECT COUNT(*) as cnt FROM charging_events');
    const afterSessions = await pool.query('SELECT COUNT(*) as cnt FROM charging_sessions');
    const afterUsers = await pool.query('SELECT COUNT(DISTINCT user_id) as cnt FROM charging_events');
    console.log(`  After:  ${afterUsers.rows[0].cnt} users, ${afterEvents.rows[0].cnt} events, ${afterSessions.rows[0].cnt} sessions`);

    return { events: afterEvents.rows[0].cnt, sessions: afterSessions.rows[0].cnt, users: afterUsers.rows[0].cnt };
}

async function exportCSVFromSupabase(pool: Pool): Promise<void> {
    console.log('\n═══ EXPORTING FINAL CSVs FROM SUPABASE ═══');

    // Export charging_events
    const events = await pool.query(`
        SELECT id, user_id, event_type, percentage, event_date, event_time, event_timestamp
        FROM charging_events ORDER BY user_id, event_timestamp
    `);
    const eventsHeader = 'id,user_id,event_type,percentage,event_date,event_time,event_timestamp';
    const eventsRows = events.rows.map(r =>
        `${r.id},${r.user_id},${r.event_type},${r.percentage},${r.event_date},${r.event_time},${r.event_timestamp}`
    );
    const eventsPath = path.join(BASE_DIR, 'clean_charging_events.csv');
    fs.writeFileSync(eventsPath, [eventsHeader, ...eventsRows].join('\n') + '\n');
    console.log(`  ✅ clean_charging_events.csv: ${eventsRows.length} rows`);

    // Export charging_sessions
    const sessions = await pool.query(`
        SELECT id, user_id, connect_time, disconnect_time, start_percentage, end_percentage,
               duration_minutes, charge_gained, is_complete
        FROM charging_sessions ORDER BY user_id, connect_time
    `);
    const sessionsHeader = 'id,user_id,connect_time,disconnect_time,start_percentage,end_percentage,duration_minutes,charge_gained,is_complete';
    const sessionsRows = sessions.rows.map(r =>
        `${r.id},${r.user_id},${r.connect_time},${r.disconnect_time},${r.start_percentage},${r.end_percentage},${r.duration_minutes},${r.charge_gained},${r.is_complete}`
    );
    const sessionsPath = path.join(BASE_DIR, 'clean_charging_sessions.csv');
    fs.writeFileSync(sessionsPath, [sessionsHeader, ...sessionsRows].join('\n') + '\n');
    console.log(`  ✅ clean_charging_sessions.csv: ${sessionsRows.length} rows`);

    // Export user_stats
    try {
        const stats = await pool.query(`SELECT * FROM user_stats ORDER BY user_id`);
        if (stats.rows.length > 0) {
            const cols = Object.keys(stats.rows[0]);
            const statsHeader = cols.join(',');
            const statsRows = stats.rows.map(r => cols.map(c => r[c]).join(','));
            const statsPath = path.join(BASE_DIR, 'clean_users_summary.csv');
            fs.writeFileSync(statsPath, [statsHeader, ...statsRows].join('\n') + '\n');
            console.log(`  ✅ clean_users_summary.csv: ${statsRows.length} rows`);
        }
    } catch {
        console.log('  ℹ️  user_stats table not found, skipping export');
    }
}

async function main() {
    // Collect all user_ids to remove (keep lowest in each group)
    const toRemove: number[] = [];
    for (const group of DUPLICATE_GROUPS) {
        const sorted = group.map(Number).sort((a, b) => a - b);
        toRemove.push(...sorted.slice(1)); // keep first, remove rest
    }
    const toRemoveSet = new Set(toRemove);

    console.log(`\n🗑️  Will remove ${toRemove.length} duplicate user IDs:`);
    console.log(`   ${toRemove.sort((a, b) => a - b).join(', ')}`);

    // 1. Local DB (skip gracefully if not running)
    console.log('\n═══ LOCAL DATABASE ═══');
    const localPool = new Pool({
        host: 'localhost', port: 5433,
        database: 'battery_charging_events',
        user: 'postgres', password: 'postgres',
        connectionTimeoutMillis: 5000,
    });
    const localResult = await cleanDatabase(localPool, 'Local DB', toRemove);
    await localPool.end().catch(() => {});

    // 2. Supabase
    console.log('\n═══ SUPABASE ═══');
    const supaPool = new Pool({
        connectionString: SUPABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });
    const supaResult = await cleanDatabase(supaPool, 'Supabase', toRemove, 'charging');

    // 3. Export final CSVs from Supabase (source of truth)
    if (supaResult) {
        await exportCSVFromSupabase(supaPool);
    } else {
        // Fallback: clean existing CSV files directly
        console.log('\n⚠️  Supabase not available, cleaning CSV files directly...');
        cleanCSVFiles(toRemoveSet);
    }

    // 4. Verification
    console.log('\n═══ VERIFICATION ═══');
    if (localResult && supaResult) {
        console.log(`  Local events:     ${localResult.events}`);
        console.log(`  Supabase events:  ${supaResult.events}`);
        console.log(`  Match: ${localResult.events === supaResult.events ? '✅' : '❌'}`);
        console.log(`  Local users:      ${localResult.users}`);
        console.log(`  Supabase users:   ${supaResult.users}`);
        console.log(`  Match: ${localResult.users === supaResult.users ? '✅' : '❌'}`);
    } else if (supaResult) {
        console.log(`  Supabase: ${supaResult.users} users, ${supaResult.events} events, ${supaResult.sessions} sessions`);
        console.log('  ℹ️  Local DB was not available for comparison');
    } else if (localResult) {
        console.log(`  Local: ${localResult.users} users, ${localResult.events} events, ${localResult.sessions} sessions`);
    } else {
        console.log('  ⚠️  Neither DB was available. CSV files cleaned directly.');
    }

    await supaPool.end().catch(() => {});

    // Final summary
    console.log('\n═══ FINAL CSV FILES ═══');
    for (const name of ['clean_charging_events.csv', 'clean_charging_sessions.csv', 'clean_users_summary.csv']) {
        const fp = path.join(BASE_DIR, name);
        if (fs.existsSync(fp)) {
            const lines = fs.readFileSync(fp, 'utf-8').split('\n').filter(l => l.trim());
            console.log(`  📄 ${name}: ${lines.length - 1} rows`);
        }
    }

    console.log('\n🎉 Deduplication complete!');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
