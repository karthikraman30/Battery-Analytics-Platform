import { Pool, QueryResult } from 'pg';
import { logger } from '../lib/logger';

/**
 * Database connection configuration
 * 
 * IMPORTANT: Due to Colima's port forwarding limitations, we use an SSH tunnel
 * to connect to PostgreSQL running in Docker. The tunnel forwards port 5433
 * on localhost to the container's port 5432.
 * 
 * To set up the tunnel, run: ./scripts/setup-database.sh start
 */
// IMPORTANT: Due to Colima port forwarding issues, we MUST use port 5433 (SSH tunnel)
// The .env file may have port 5432 which won't work - this code enforces 5433
const envPort = parseInt(process.env.DB_PORT || '5433');
const actualPort = envPort === 5432 ? 5433 : envPort; // Force 5433 if 5432 specified

const connectionConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: actualPort,  // SSH tunnel port (must be 5433 for Colima)
  database: process.env.DB_NAME || 'battery_analytics',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

logger.info('Database config initialized', {
  host: connectionConfig.host,
  port: connectionConfig.port,
  database: connectionConfig.database,
  user: connectionConfig.user,
  maxConnections: connectionConfig.max,
});

export const pool = new Pool(connectionConfig);

pool.on('error', (err) => {
  logger.db('error', { message: err.message });
});

pool.on('connect', () => {
  logger.db('connect');
});

pool.on('remove', () => {
  logger.debug('Database connection removed from pool');
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
      logger.warn('Slow query detected', { 
        duration: `${duration}ms`, 
        query: text.substring(0, 100) 
      });
    }
    
    return res;
  } catch (error) {
    const duration = Date.now() - start;
    logger.error('Query failed', { 
      duration: `${duration}ms`, 
      query: text.substring(0, 100),
      error: error instanceof Error ? error.message : String(error)
    });
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
    logger.error('Connection test failed', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    return false;
  }
}

// Get connection pool stats
export function getPoolStats() {
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
