import { Pool, QueryResult } from 'pg';
import { logger } from '../lib/logger';

/**
 * Grouped database connection.
 * 
 * This database is NOT deployed to Supabase (too large).
 * In production, grouped queries will gracefully fail.
 * In development: connects to local battery_analytics_grouped DB on port 5433
 */

function buildConfig() {
  if (process.env.GROUPED_DATABASE_URL) {
    return {
      connectionString: process.env.GROUPED_DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }
  // Skip if no local DB and no URL
  if (process.env.DATABASE_URL && !process.env.GROUPED_DATABASE_URL) {
    logger.info('Grouped database not configured — grouped routes will be disabled');
    return null;
  }
  // Local development fallback
  const envPort = parseInt(process.env.DB_PORT || '5433');
  const actualPort = envPort === 5432 ? 5433 : envPort;
  return {
    host: process.env.DB_HOST || 'localhost',
    port: actualPort,
    database: 'battery_analytics_grouped',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
}

const connectionConfig = buildConfig();

if (connectionConfig) {
  logger.info('Grouped database config initialized', {
    host: process.env.GROUPED_DATABASE_URL ? '(supabase)' : (connectionConfig as any).host,
    port: process.env.GROUPED_DATABASE_URL ? '(pooler)' : (connectionConfig as any).port,
    database: process.env.GROUPED_DATABASE_URL ? 'postgres/grouped' : (connectionConfig as any).database,
  });
}

export const groupedPool = connectionConfig ? new Pool(connectionConfig) : null;

if (groupedPool) {
  groupedPool.on('error', (err) => {
    logger.db('error', { message: err.message, db: 'grouped' });
  });

  groupedPool.on('connect', () => {
    logger.db('connect', { db: 'grouped' });
  });
}

export async function queryGrouped<T = Record<string, unknown>>(
  text: string,
  params?: unknown[]
): Promise<QueryResult<T>> {
  if (!groupedPool) {
    throw new Error('Grouped database not configured');
  }
  const start = Date.now();
  try {
    const res = await groupedPool.query<T>(text, params);
    const duration = Date.now() - start;
    logger.query(text, duration, res.rowCount ?? undefined);
    if (duration > 100) {
      logger.warn('Slow query detected (grouped)', { duration: `${duration}ms`, query: text.substring(0, 100) });
    }
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query failed (grouped)', { duration: `${duration}ms`, query: text.substring(0, 100), error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function testGroupedConnection(): Promise<boolean> {
  if (!groupedPool) return false;
  try {
    const start = Date.now();
    await groupedPool.query('SELECT 1');
    const duration = Date.now() - start;
    logger.debug('Grouped connection test successful', { duration: `${duration}ms` });
    return true;
  } catch (error) {
    logger.error('Grouped connection test failed', { error: error instanceof Error ? error.message : String(error) });
    return false;
  }
}

export function getGroupedPoolStats() {
  if (!groupedPool) return { totalCount: 0, idleCount: 0, waitingCount: 0 };
  return {
    totalCount: groupedPool.totalCount,
    idleCount: groupedPool.idleCount,
    waitingCount: groupedPool.waitingCount,
  };
}
