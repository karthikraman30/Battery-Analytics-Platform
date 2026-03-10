import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BASE_DIR = path.resolve(__dirname, '..');

const SUPABASE_URL = 'postgresql://postgres.rzqofppbzsaxilnyoxsv:zEN10OAQ8hCvrPQF@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function main() {
    const pool = new Pool({
        connectionString: SUPABASE_URL,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 15000,
    });

    await pool.query("SET search_path TO charging, public");
    console.log('Connected to Supabase');

    // Query using original event_date, event_time, timezone columns (not derived from event_timestamp)
    const result = await pool.query(`
        SELECT 
            LPAD(user_id::text, 3, '0') as user_id,
            event_type,
            percentage::float as percentage,
            TO_CHAR(event_date, 'YYYY-MM-DD') as date,
            event_time::text as time,
            timezone
        FROM charging_events
        ORDER BY user_id, event_timestamp
    `);

    console.log('Retrieved ' + result.rows.length + ' rows');

    // Build CSV
    const header = 'user_id,event_type,percentage,date,time,timezone';
    const rows = result.rows.map(r =>
        r.user_id + ',' + r.event_type + ',' + Number(r.percentage).toFixed(1) + ',' + r.date + ',' + r.time + ',' + r.timezone
    );

    const outPath = path.join(BASE_DIR, 'battery_data', 'battery_data.csv');
    fs.writeFileSync(outPath, [header, ...rows].join('\n') + '\n');
    console.log('Written to battery_data/battery_data.csv: ' + rows.length + ' rows');

    // Quick sanity check
    const users = new Set(result.rows.map(r => r.user_id));
    console.log('Unique users: ' + users.size);

    await pool.end();
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
