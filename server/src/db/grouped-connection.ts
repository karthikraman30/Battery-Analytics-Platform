import { Pool, QueryResult } from 'pg';
import { logger } from '../lib/logger';

const envPort = parseInt(process.env.DB_PORT || '5433');
const actualPort = envPort === 5432 ? 5433 : envPort;

const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: actualPort,
  database: 'battery_analytics_grouped',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

logger.info('Grouped database config initialized', {
  host: connectionConfig.host,
  port: connectionConfig.port,
  database: connectionConfig.database,
});

export const groupedPool = new Pool(connectionConfig);

groupedPool.on('error', (err) => {
  logger.db('error', { message: err.message, db: 'grouped' });
});

groupedPool.on('connect', () => {
  logger.db('connect', { db: 'grouped' });
});

export async function queryGrouped<T = Record<string, unknown>>(
  text: string, 
  params?: unknown[]
): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await groupedPool.query<T>(text, params);
    const duration = Date.now() - start;
    
    logger.query(text, duration, res.rowCount ?? undefined);
    
    if (duration > 100) {
      logger.warn('Slow query detected (grouped)', { 
        duration: `${duration}ms`, 
        query: text.substring(0, 100) 
      });
    }
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query failed (grouped)', { 
      duration: `${duration}ms`, 
      query: text.substring(0, 100),
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}

export async function testGroupedConnection(): Promise<boolean> {
  try {
    const start = Date.now();
    await groupedPool.query('SELECT 1');
    const duration = Date.now() - start;
    logger.debug('Grouped connection test successful', { duration: `${duration}ms` });
    return true;
  } catch (error) {
    logger.error('Grouped connection test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

export function getGroupedPoolStats() {
  return {
    totalCount: groupedPool.totalCount,
    idleCount: groupedPool.idleCount,
    waitingCount: groupedPool.waitingCount,
  };
}
