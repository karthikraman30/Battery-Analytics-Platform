import { Pool } from 'pg';

const SUPABASE_URL = 'postgresql://postgres.rzqofppbzsaxilnyoxsv:zEN10OAQ8hCvrPQF@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function main() {
    const localPool = new Pool({ host: 'localhost', port: 5433, database: 'battery_charging_events', user: 'postgres', password: 'postgres' });
    const supaPool = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });

    await localPool.query('SELECT 1');
    await supaPool.query('SELECT 1');
    console.log('✅ Connected to both DBs');

    // Migrate charging_events
    console.log('\n=== Migrating charging_events ===');
    await supaPool.query('DROP TABLE IF EXISTS charging.charging_events CASCADE');

    const evCols = await localPool.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns WHERE table_name = 'charging_events' ORDER BY ordinal_position
  `);

    const typeMap: Record<string, string> = {
        'integer': 'INTEGER', 'bigint': 'BIGINT', 'double precision': 'DOUBLE PRECISION',
        'numeric': 'NUMERIC', 'real': 'REAL', 'text': 'TEXT', 'character varying': 'VARCHAR',
        'boolean': 'BOOLEAN', 'timestamp without time zone': 'TIMESTAMP',
        'timestamp with time zone': 'TIMESTAMPTZ', 'date': 'DATE', 'json': 'JSON', 'jsonb': 'JSONB',
    };

    const evColDefs = evCols.rows.map((c: any) => {
        let type = typeMap[c.data_type] || c.data_type.toUpperCase();
        if (c.data_type === 'character varying' && c.character_maximum_length) type = `VARCHAR(${c.character_maximum_length})`;
        return `"${c.column_name}" ${type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`;
    });

    await supaPool.query(`CREATE TABLE charging.charging_events (${evColDefs.join(', ')})`);
    console.log('✅ Table created');

    const evTotal = parseInt((await localPool.query('SELECT COUNT(*) as cnt FROM charging_events')).rows[0].cnt);
    const evColNames = evCols.rows.map((c: any) => `"${c.column_name}"`).join(', ');
    const evColCount = evCols.rows.length;
    let migrated = 0;
    const BATCH = 500;

    while (migrated < evTotal) {
        const batch = await localPool.query(`SELECT * FROM charging_events ORDER BY id LIMIT ${BATCH} OFFSET ${migrated}`);
        if (batch.rows.length === 0) break;
        const values: any[] = [];
        const placeholders: string[] = [];
        batch.rows.forEach((row: any, ri: number) => {
            const rp: string[] = [];
            evCols.rows.forEach((col: any, ci: number) => { values.push(row[col.column_name]); rp.push(`$${ri * evColCount + ci + 1}`); });
            placeholders.push(`(${rp.join(', ')})`);
        });
        await supaPool.query(`INSERT INTO charging.charging_events (${evColNames}) VALUES ${placeholders.join(', ')}`, values);
        migrated += batch.rows.length;
        process.stdout.write(`\r  ${migrated}/${evTotal} (${((migrated / evTotal) * 100).toFixed(0)}%)`);
    }
    console.log('\n✅ charging_events migrated');

    // Migrate user_stats
    console.log('\n=== Migrating user_stats ===');
    await supaPool.query('DROP TABLE IF EXISTS charging.user_stats CASCADE');

    const usCols = await localPool.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable
    FROM information_schema.columns WHERE table_name = 'user_stats' ORDER BY ordinal_position
  `);

    const usColDefs = usCols.rows.map((c: any) => {
        let type = typeMap[c.data_type] || c.data_type.toUpperCase();
        if (c.data_type === 'character varying' && c.character_maximum_length) type = `VARCHAR(${c.character_maximum_length})`;
        return `"${c.column_name}" ${type}${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`;
    });

    await supaPool.query(`CREATE TABLE charging.user_stats (${usColDefs.join(', ')})`);
    console.log('✅ Table created');

    const usTotal = parseInt((await localPool.query('SELECT COUNT(*) as cnt FROM user_stats')).rows[0].cnt);
    const usColNames = usCols.rows.map((c: any) => `"${c.column_name}"`).join(', ');
    const usColCount = usCols.rows.length;

    const allUsers = await localPool.query('SELECT * FROM user_stats ORDER BY user_id');
    const uValues: any[] = [];
    const uPlaceholders: string[] = [];
    allUsers.rows.forEach((row: any, ri: number) => {
        const rp: string[] = [];
        usCols.rows.forEach((col: any, ci: number) => { uValues.push(row[col.column_name]); rp.push(`$${ri * usColCount + ci + 1}`); });
        uPlaceholders.push(`(${rp.join(', ')})`);
    });
    await supaPool.query(`INSERT INTO charging.user_stats (${usColNames}) VALUES ${uPlaceholders.join(', ')}`, uValues);
    console.log(`✅ user_stats migrated (${usTotal} rows)`);

    // Verify all
    console.log('\n📊 Final Verification:');
    for (const table of ['charging_events', 'charging_sessions', 'user_stats']) {
        const local = parseInt((await localPool.query(`SELECT COUNT(*) as cnt FROM ${table}`)).rows[0].cnt);
        const supa = parseInt((await supaPool.query(`SELECT COUNT(*) as cnt FROM charging.${table}`)).rows[0].cnt);
        console.log(`  ${table}: local=${local}, supabase=${supa} ${local === supa ? '✅' : '❌'}`);
    }

    // Create additional indexes
    await supaPool.query('CREATE INDEX IF NOT EXISTS idx_ce_user_id ON charging.charging_events(user_id)');
    await supaPool.query('CREATE INDEX IF NOT EXISTS idx_us_user_id ON charging.user_stats(user_id)');
    console.log('\n✅ All indexes created');

    await localPool.end();
    await supaPool.end();
    console.log('🎉 Full migration complete!');
}

main().catch(err => { console.error('Failed:', err); process.exit(1); });
