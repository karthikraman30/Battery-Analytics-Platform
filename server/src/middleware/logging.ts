/**
 * Request/Response logging middleware for Elysia
 */
import { Elysia } from 'elysia';
import { logger } from '../lib/logger';

export const loggingMiddleware = new Elysia({ name: 'logging' })
  .derive(({ request }) => {
    return {
      requestStart: Date.now(),
      requestId: crypto.randomUUID().substring(0, 8),
    };
  })
  .onRequest(({ request, requestId }) => {
    const url = new URL(request.url);
    logger.request(request.method, url.pathname, { 
      requestId,
      query: url.search || undefined,
    });
  })
  .onAfterResponse(({ request, set, requestStart, requestId }) => {
    const url = new URL(request.url);
    const duration = Date.now() - requestStart;
    const status = typeof set.status === 'number' ? set.status : 200;
    
    logger.response(request.method, url.pathname, status, duration, { requestId });
  })
  .onError(({ request, error, requestId, requestStart }) => {
    const url = new URL(request.url);
    const duration = Date.now() - (requestStart || Date.now());
    
    logger.error(`Request failed: ${error.message}`, {
      requestId,
      method: request.method,
      path: url.pathname,
      duration: `${duration}ms`,
      error: error.message,
    });
  });

export default loggingMiddleware;
