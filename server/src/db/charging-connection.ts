import { Pool, QueryResult } from 'pg';
import { logger } from '../lib/logger';

/**
 * Charging database connection.
 * 
 * In production (Supabase): uses CHARGING_DATABASE_URL (or DATABASE_URL) + search_path=charging
 * In development: connects to local battery_charging_events DB on port 5433
 */

function buildConfig() {
    const url = process.env.CHARGING_DATABASE_URL || process.env.DATABASE_URL;
    if (url) {
        return {
            connectionString: url,
            ssl: { rejectUnauthorized: false },
            max: 10,
            idleTimeoutMillis: 30000,
            connectionTimeoutMillis: 10000,
        };
    }
    // Local development fallback
    const envPort = parseInt(process.env.DB_PORT || '5433');
    const actualPort = envPort === 5432 ? 5433 : envPort;
    return {
        host: process.env.DB_HOST || 'localhost',
        port: actualPort,
        database: 'battery_charging_events',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
    };
}

const connectionConfig = buildConfig();

logger.info('Charging database config initialized', {
    host: (process.env.CHARGING_DATABASE_URL || process.env.DATABASE_URL) ? '(supabase)' : (connectionConfig as any).host,
    port: (process.env.CHARGING_DATABASE_URL || process.env.DATABASE_URL) ? '(pooler)' : (connectionConfig as any).port,
    database: (process.env.CHARGING_DATABASE_URL || process.env.DATABASE_URL) ? 'postgres/charging' : (connectionConfig as any).database,
});

export const chargingPool = new Pool(connectionConfig);

// Set search_path for Supabase schema
chargingPool.on('connect', async (client) => {
    if (process.env.CHARGING_DATABASE_URL || process.env.DATABASE_URL) {
        await client.query("SET search_path TO charging, public");
    }
    logger.db('connect', { db: 'charging' });
});

chargingPool.on('error', (err) => {
    logger.db('error', { message: err.message, db: 'charging' });
});

export async function queryCharging<T = Record<string, unknown>>(
    text: string,
    params?: unknown[]
): Promise<QueryResult<T>> {
    const start = Date.now();
    try {
        const res = await chargingPool.query<T>(text, params);
        const duration = Date.now() - start;
        logger.query(text, duration, res.rowCount ?? undefined);
        if (duration > 100) {
            logger.warn('Slow query detected (charging)', { duration: `${duration}ms`, query: text.substring(0, 100) });
        }
        return res;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error('Query failed (charging)', { duration: `${duration}ms`, query: text.substring(0, 100), error: error instanceof Error ? error.message : String(error) });
        throw error;
    }
}

export async function testChargingConnection(): Promise<boolean> {
    try {
        const start = Date.now();
        await chargingPool.query('SELECT 1');
        const duration = Date.now() - start;
        logger.debug('Charging connection test successful', { duration: `${duration}ms` });
        return true;
    } catch (error) {
        logger.error('Charging connection test failed', { error: error instanceof Error ? error.message : String(error) });
        return false;
    }
}

export function getChargingPoolStats() {
    return {
        totalCount: chargingPool.totalCount,
        idleCount: chargingPool.idleCount,
        waitingCount: chargingPool.waitingCount,
    };
}
