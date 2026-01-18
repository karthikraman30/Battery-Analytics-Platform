/**
 * Battery Analytics API Server
 * Built with Bun + Elysia
 */
import { Elysia } from 'elysia';
import { cors } from '@elysiajs/cors';
import { swagger } from '@elysiajs/swagger';
import { logger } from './lib/logger';
import { loggingMiddleware } from './middleware/logging';
import { testConnection, getPoolStats } from './db/connection';
import { analyticsRoutes } from './routes/analytics';
import { deviceRoutes } from './routes/devices';
import { aggregateRoutes } from './routes/aggregates';
import { carbonRoutes } from './routes/carbon';
import { groupedDeviceRoutes } from './routes/grouped-devices';
import { groupedAnalyticsRoutes } from './routes/grouped-analytics';
import { groupedAggregateRoutes } from './routes/grouped-aggregates';
import { groupedCarbonRoutes } from './routes/grouped-carbon';
import { testGroupedConnection, getGroupedPoolStats } from './db/grouped-connection';

const PORT = parseInt(process.env.PORT || '3001');
const NODE_ENV = process.env.NODE_ENV || 'development';

logger.startup('Battery Analytics API Server starting...');
logger.info('Environment', { NODE_ENV, PORT });

const app = new Elysia()
  // Logging middleware (must be first)
  .use(loggingMiddleware)
  
  // CORS for frontend
  .use(cors({
    origin: ['http://localhost:5173', 'http://localhost:3000'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  }))
  
  // Swagger documentation
  .use(swagger({
    documentation: {
      info: {
        title: 'Battery Analytics API',
        version: '1.0.0',
        description: 'API for smartphone battery and usage analytics'
      },
      tags: [
        { name: 'Analytics', description: 'Device-level analytics endpoints' },
        { name: 'Devices', description: 'Device management endpoints' },
        { name: 'Aggregates', description: 'Global statistics endpoints' }
      ]
    }
  }))
  
  // Health check
  .get('/health', async () => {
    const dbConnected = await testConnection();
    const groupedDbConnected = await testGroupedConnection();
    const poolStats = getPoolStats();
    const groupedPoolStats = getGroupedPoolStats();
    
    return { 
      status: dbConnected && groupedDbConnected ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      databases: {
        consolidated: {
          connected: dbConnected,
          pool: poolStats,
        },
        grouped: {
          connected: groupedDbConnected,
          pool: groupedPoolStats,
        },
      },
    };
  })
  
  // API info
  .get('/api', () => ({
    name: 'Battery Analytics API',
    version: '1.0.0',
    environment: NODE_ENV,
    endpoints: {
      devices: '/api/devices',
      analytics: '/api/analytics',
      aggregates: '/api/aggregates',
      carbon: '/api/carbon',
      grouped: {
        devices: '/api/grouped/devices',
        analytics: '/api/grouped/analytics',
        aggregates: '/api/grouped/aggregates',
        carbon: '/api/grouped/carbon',
      },
      swagger: '/swagger',
      health: '/health',
    }
  }))
  
  // Mount routes
  .use(analyticsRoutes)
  .use(deviceRoutes)
  .use(aggregateRoutes)
  .use(carbonRoutes)
  .use(groupedDeviceRoutes)
  .use(groupedAnalyticsRoutes)
  .use(groupedAggregateRoutes)
  .use(groupedCarbonRoutes)
  
  // Global error handling
  .onError(({ code, error, request }) => {
    const url = new URL(request.url);
    logger.error(`Unhandled error [${code}]`, {
      path: url.pathname,
      error: error.message,
      stack: NODE_ENV === 'development' ? error.stack : undefined,
    });
    
    return {
      error: error.message || 'Internal server error',
      code,
      timestamp: new Date().toISOString(),
    };
  })
  
  .listen(PORT);

// Startup complete
logger.startup(`Server listening on http://localhost:${PORT}`);
logger.info('Available endpoints', {
  swagger: `http://localhost:${PORT}/swagger`,
  health: `http://localhost:${PORT}/health`,
  api: `http://localhost:${PORT}/api`,
});

// Test database connections on startup
testConnection().then(connected => {
  if (connected) {
    logger.info('Consolidated database connection verified on startup');
  } else {
    logger.warn('Consolidated database not available on startup - will retry on requests');
  }
});

testGroupedConnection().then(connected => {
  if (connected) {
    logger.info('Grouped database connection verified on startup');
  } else {
    logger.warn('Grouped database not available on startup - will retry on requests');
  }
});

export type App = typeof app;
