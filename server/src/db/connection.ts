import { Pool, QueryResult } from 'pg';
import { logger } from '../lib/logger';

/**
 * Consolidated database connection.
 * 
 * In production (Supabase): uses DATABASE_URL + search_path=consolidated
 * In development: connects to local battery_analytics DB on port 5433
 */

function buildConfig() {
  if (process.env.DATABASE_URL) {
    const isLocal = process.env.DATABASE_URL.includes('localhost') || process.env.DATABASE_URL.includes('127.0.0.1');
    return {
      connectionString: process.env.DATABASE_URL,
      ...(isLocal ? {} : { ssl: { rejectUnauthorized: false } }),
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
    database: process.env.DB_NAME || 'battery_analytics',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const connectionConfig = buildConfig();

logger.info('Database config initialized', {
  host: process.env.DATABASE_URL ? '(supabase)' : (connectionConfig as any).host,
  port: process.env.DATABASE_URL ? '(pooler)' : (connectionConfig as any).port,
  database: process.env.DATABASE_URL ? 'postgres/consolidated' : (connectionConfig as any).database,
  user: process.env.DATABASE_URL ? 'postgres' : (connectionConfig as any).user,
  maxConnections: connectionConfig.max,
});

export const pool = new Pool(connectionConfig);

// Set search_path for Supabase schema
pool.on('connect', async (client) => {
  if (process.env.DATABASE_URL) {
    await client.query("SET search_path TO consolidated, public");
  }
  logger.db('connect', { db: 'consolidated' });
});

pool.on('error', (err) => {
  logger.db('error', { message: err.message });
});

export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.query(text, duration, res.rowCount ?? undefined);
    if (duration > 100) {
      logger.warn('Slow query detected', { duration: `${duration}ms`, query: text.substring(0, 100) });
    }
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query failed', { duration: `${duration}ms`, query: text.substring(0, 100), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function testConnection(): Promise<boolean> {
  try {
    const start = Date.now();
    await pool.query('SELECT 1');
    const duration = Date.now() - start;
    logger.debug('Connection test successful', { duration: `${duration}ms` });
    return true;
  } catch (error) {
    logger.error('Connection test failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
