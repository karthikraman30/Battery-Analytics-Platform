import { Pool } from 'pg';

const SUPABASE_URL = 'postgresql://postgres.rzqofppbzsaxilnyoxsv:zEN10OAQ8hCvrPQF@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres';

async function main() {
    // 1. Connect to local DB
    let localPort = 5432;
    let localPool: Pool | null = null;

    for (const port of [5433, 5432]) {
        try {
            const pool = new Pool({ host: 'localhost', port, database: 'battery_charging_events', user: 'postgres', password: 'postgres' });
            await pool.query('SELECT 1');
            localPool = pool;
            localPort = port;
            console.log(`✅ Connected to local DB on port ${port}`);
            break;
        } catch (e: any) {
            console.log(`❌ Port ${port}: ${e.message}`);
        }
    }

    if (!localPool) {
        console.error('Could not connect to local charging DB on any port');
        process.exit(1);
    }

    // 2. Check local schema
    const tables = await localPool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`);
    console.log('\n📋 Local tables:', tables.rows.map(r => r.tablename));

    for (const t of tables.rows) {
        const count = await localPool.query(`SELECT COUNT(*) as cnt FROM "${t.tablename}"`);
        console.log(`  ${t.tablename}: ${count.rows[0].cnt} rows`);
    }

    // 3. Get charging_sessions schema
    const cols = await localPool.query(`
    SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
    FROM information_schema.columns 
    WHERE table_name = 'charging_sessions' 
    ORDER BY ordinal_position
  `);
    console.log('\n📋 charging_sessions columns:');
    cols.rows.forEach((c: any) => console.log(`  ${c.column_name}: ${c.data_type}${c.character_maximum_length ? `(${c.character_maximum_length})` : ''} ${c.is_nullable === 'NO' ? 'NOT NULL' : ''} ${c.column_default ? `DEFAULT ${c.column_default}` : ''}`));

    // 4. Connect to Supabase
    const supaPool = new Pool({ connectionString: SUPABASE_URL, ssl: { rejectUnauthorized: false } });
    await supaPool.query('SELECT 1');
    console.log('\n✅ Connected to Supabase');

    // 5. Check if charging schema exists on Supabase
    const schemaCheck = await supaPool.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'charging'`);
    console.log(`\nCharging schema on Supabase: ${schemaCheck.rows.length > 0 ? 'EXISTS' : 'DOES NOT EXIST'}`);

    if (schemaCheck.rows.length > 0) {
        const supaTables = await supaPool.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'charging'`);
        console.log('Supabase charging tables:', supaTables.rows.map((r: any) => r.tablename));
        for (const t of supaTables.rows) {
            const count = await supaPool.query(`SELECT COUNT(*) as cnt FROM charging."${(t as any).tablename}"`);
            console.log(`  charging.${(t as any).tablename}: ${count.rows[0].cnt} rows`);
        }
    }

    // 6. Create charging schema if doesn't exist
    await supaPool.query('CREATE SCHEMA IF NOT EXISTS charging');
    console.log('\n✅ charging schema ready');

    // 7. Drop existing charging_sessions table on Supabase (fresh start with new data)
    await supaPool.query('DROP TABLE IF EXISTS charging.charging_sessions CASCADE');
    console.log('✅ Dropped old charging.charging_sessions');

    // 8. Build CREATE TABLE from local schema
    const typeMap: Record<string, string> = {
        'integer': 'INTEGER',
        'bigint': 'BIGINT',
        'double precision': 'DOUBLE PRECISION',
        'numeric': 'NUMERIC',
        'real': 'REAL',
        'text': 'TEXT',
        'character varying': 'VARCHAR',
        'boolean': 'BOOLEAN',
        'timestamp without time zone': 'TIMESTAMP',
        'timestamp with time zone': 'TIMESTAMPTZ',
        'date': 'DATE',
        'json': 'JSON',
        'jsonb': 'JSONB',
        'uuid': 'UUID',
        'ARRAY': 'TEXT[]',
    };

    const colDefs = cols.rows.map((c: any) => {
        let type = typeMap[c.data_type] || c.data_type.toUpperCase();
        if (c.data_type === 'character varying' && c.character_maximum_length) {
            type = `VARCHAR(${c.character_maximum_length})`;
        }
        const nullable = c.is_nullable === 'NO' ? ' NOT NULL' : '';
        return `"${c.column_name}" ${type}${nullable}`;
    });

    const createSQL = `CREATE TABLE charging.charging_sessions (\n  ${colDefs.join(',\n  ')}\n)`;
    console.log('\n📝 Creating table on Supabase:');
    console.log(createSQL.substring(0, 500) + '...');
    await supaPool.query(createSQL);
    console.log('✅ Table created');

    // 9. Migrate data in batches
    const totalRows = await localPool.query('SELECT COUNT(*) as cnt FROM charging_sessions');
    const total = parseInt(totalRows.rows[0].cnt);
    console.log(`\n📦 Migrating ${total} rows...`);

    const BATCH_SIZE = 500;
    let migrated = 0;

    // Get column names
    const columnNames = cols.rows.map((c: any) => `"${c.column_name}"`).join(', ');
    const colCount = cols.rows.length;

    while (migrated < total) {
        const batch = await localPool.query(`SELECT * FROM charging_sessions ORDER BY id LIMIT ${BATCH_SIZE} OFFSET ${migrated}`);

        if (batch.rows.length === 0) break;

        const values: any[] = [];
        const placeholders: string[] = [];

        batch.rows.forEach((row: any, rowIdx: number) => {
            const rowPlaceholders: string[] = [];
            cols.rows.forEach((col: any, colIdx: number) => {
                values.push(row[col.column_name]);
                rowPlaceholders.push(`$${rowIdx * colCount + colIdx + 1}`);
            });
            placeholders.push(`(${rowPlaceholders.join(', ')})`);
        });

        await supaPool.query(
            `INSERT INTO charging.charging_sessions (${columnNames}) VALUES ${placeholders.join(', ')}`,
            values
        );

        migrated += batch.rows.length;
        process.stdout.write(`\r  Migrated: ${migrated}/${total} (${((migrated / total) * 100).toFixed(0)}%)`);
    }

    console.log('\n✅ Migration complete!');

    // 10. Verify
    const supaCount = await supaPool.query('SELECT COUNT(*) as cnt FROM charging.charging_sessions');
    console.log(`\n📊 Verification:`);
    console.log(`  Local:    ${total} rows`);
    console.log(`  Supabase: ${supaCount.rows[0].cnt} rows`);
    console.log(`  Match: ${total === parseInt(supaCount.rows[0].cnt) ? '✅ YES' : '❌ NO'}`);

    // 11. Create indexes for performance
    console.log('\n📝 Creating indexes...');
    await supaPool.query('CREATE INDEX IF NOT EXISTS idx_cs_user_id ON charging.charging_sessions(user_id)');
    await supaPool.query('CREATE INDEX IF NOT EXISTS idx_cs_connect_time ON charging.charging_sessions(connect_time)');
    await supaPool.query('CREATE INDEX IF NOT EXISTS idx_cs_is_complete ON charging.charging_sessions(is_complete)');
    console.log('✅ Indexes created');

    await localPool.end();
    await supaPool.end();
    console.log('\n🎉 Done! Charging data migrated to Supabase.');
}

main().catch(err => { console.error('Migration failed:', err); process.exit(1); });
