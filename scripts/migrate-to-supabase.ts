import { Pool } from 'pg';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'postgresql://postgres.rzqofppbzsaxilnyoxsv:zEN10OAQ8hCvrPQF@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

const pool = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });

function parseCSV(path: string): { headers: string[], rows: string[][] } {
    const content = readFileSync(path, 'utf-8');
    const lines = content.trim().split('\n');
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(l => parseCSVLine(l));
    return { headers, rows };
}

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (line[i] === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += line[i];
        }
    }
    result.push(current);
    return result;
}

async function importCSV(csvPath: string, schemaTable: string, batchSize = 500) {
    console.log(`\nImporting ${csvPath} → ${schemaTable}...`);
    const { headers, rows } = parseCSV(csvPath);
    console.log(`  ${rows.length} rows, ${headers.length} columns`);

    const quotedHeaders = headers.map(h => `"${h}"`).join(', ');
    let imported = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const valueParts: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        for (const row of batch) {
            const placeholders = row.map(val => {
                if (val === '' || val === null || val === undefined) {
                    paramIdx++;
                    params.push(null);
                } else {
                    params.push(val);
                }
                return `$${paramIdx++ - 1}`;
            });
            // Fix: recalculate
            valueParts.push(`(${row.map(_ => `$${paramIdx - row.length + row.indexOf(_)}`).join(', ')})`);
        }

        // Simpler approach: build parameterized values
        const allParams: unknown[] = [];
        const valueRows: string[] = [];
        let pIdx = 1;
        for (const row of batch) {
            const placeholders: string[] = [];
            for (const val of row) {
                placeholders.push(`$${pIdx++}`);
                allParams.push(val === '' ? null : val);
            }
            valueRows.push(`(${placeholders.join(', ')})`);
        }

        const sql = `INSERT INTO ${schemaTable} (${quotedHeaders}) VALUES ${valueRows.join(', ')} ON CONFLICT DO NOTHING`;
        await pool.query(sql, allParams);
        imported += batch.length;
        process.stdout.write(`\r  ${imported}/${rows.length} rows imported`);
    }
    console.log(' ✓');
}

async function main() {
    console.log('Testing Supabase connection...');
    const test = await pool.query('SELECT 1 as ok');
    console.log('Connected!');

    // Consolidated schema (battery_analytics)
    await importCSV('/tmp/ba_battery_events.csv', 'consolidated.battery_events', 200);
    await importCSV('/tmp/ba_charging_sessions.csv', 'consolidated.charging_sessions', 200);

    // Charging schema (battery_charging_events)
    await importCSV('/tmp/bce_charging_events.csv', 'charging.charging_events', 200);
    await importCSV('/tmp/bce_charging_sessions.csv', 'charging.charging_sessions', 200);
    await importCSV('/tmp/bce_user_stats.csv', 'charging.user_stats', 200);

    console.log('\n✅ All data migrated to Supabase!');
    await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
