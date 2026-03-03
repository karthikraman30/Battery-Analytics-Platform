import { Pool } from 'pg';
import { readFileSync } from 'fs';

const SUPABASE_URL = 'postgresql://postgres.rzqofppbzsaxilnyoxsv:zEN10OAQ8hCvrPQF@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';
const pool = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });

function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
            else inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            result.push(current); current = '';
        } else current += line[i];
    }
    result.push(current);
    return result;
}

async function main() {
    const content = readFileSync('/tmp/bce_user_stats.csv', 'utf-8');
    const lines = content.trim().split('\n');
    const headers = parseCSVLine(lines[0]);
    const rows = lines.slice(1).map(l => parseCSVLine(l));

    console.log(`Importing ${rows.length} user_stats rows...`);
    const quotedHeaders = headers.map(h => `"${h}"`).join(', ');

    const allParams: unknown[] = [];
    const valueRows: string[] = [];
    let pIdx = 1;
    for (const row of rows) {
        const placeholders: string[] = [];
        for (const val of row) {
            placeholders.push(`$${pIdx++}`);
            allParams.push(val === '' ? null : val);
        }
        valueRows.push(`(${placeholders.join(', ')})`);
    }

    const sql = `INSERT INTO charging.user_stats (${quotedHeaders}) VALUES ${valueRows.join(', ')} ON CONFLICT DO NOTHING`;
    await pool.query(sql, allParams);
    console.log(`✅ ${rows.length} user_stats rows imported!`);
    await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
