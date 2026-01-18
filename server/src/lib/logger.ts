/**
 * Comprehensive logging utility for Battery Analytics API
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  [key: string]: unknown;
}

const LOG_COLORS = {
  debug: '\x1b[36m',  // Cyan
  info: '\x1b[32m',   // Green
  warn: '\x1b[33m',   // Yellow
  error: '\x1b[31m',  // Red
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  bold: '\x1b[1m',
};

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const currentLogLevel = (process.env.LOG_LEVEL || 'debug') as LogLevel;

function formatTimestamp(): string {
  const now = new Date();
  return now.toISOString();
}

function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) return '';
  
  const formatted = Object.entries(context)
    .map(([key, value]) => {
      if (typeof value === 'object') {
        return `${key}=${JSON.stringify(value)}`;
      }
      return `${key}=${value}`;
    })
    .join(' ');
  
  return ` ${LOG_COLORS.dim}[${formatted}]${LOG_COLORS.reset}`;
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[currentLogLevel];
}

function log(level: LogLevel, message: string, context?: LogContext): void {
  if (!shouldLog(level)) return;
  
  const timestamp = formatTimestamp();
  const color = LOG_COLORS[level];
  const levelStr = level.toUpperCase().padEnd(5);
  const contextStr = formatContext(context);
  
  console.log(
    `${LOG_COLORS.dim}${timestamp}${LOG_COLORS.reset} ${color}${levelStr}${LOG_COLORS.reset} ${message}${contextStr}`
  );
}

export const logger = {
  debug: (message: string, context?: LogContext) => log('debug', message, context),
  info: (message: string, context?: LogContext) => log('info', message, context),
  warn: (message: string, context?: LogContext) => log('warn', message, context),
  error: (message: string, context?: LogContext) => log('error', message, context),
  
  // HTTP request logging
  request: (method: string, path: string, context?: LogContext) => {
    log('info', `→ ${method} ${path}`, context);
  },
  
  // HTTP response logging
  response: (method: string, path: string, status: number, duration: number, context?: LogContext) => {
    const statusColor = status >= 400 ? LOG_COLORS.error : status >= 300 ? LOG_COLORS.warn : LOG_COLORS.info;
    console.log(
      `${LOG_COLORS.dim}${formatTimestamp()}${LOG_COLORS.reset} ${LOG_COLORS.info}INFO ${LOG_COLORS.reset}` +
      `← ${method} ${path} ${statusColor}${status}${LOG_COLORS.reset} ${LOG_COLORS.dim}(${duration}ms)${LOG_COLORS.reset}` +
      formatContext(context)
    );
  },
  
  // Database query logging
  query: (sql: string, duration: number, rowCount?: number) => {
    const truncatedSql = sql.length > 100 ? sql.substring(0, 100) + '...' : sql;
    log('debug', `SQL: ${truncatedSql}`, { 
      duration: `${duration}ms`, 
      rows: rowCount 
    });
  },
  
  // Startup logging
  startup: (message: string) => {
    console.log(`${LOG_COLORS.bold}${LOG_COLORS.info}🚀 ${message}${LOG_COLORS.reset}`);
  },
  
  // Database connection logging
  db: (event: 'connect' | 'disconnect' | 'error', context?: LogContext) => {
    const messages = {
      connect: '✓ Database connected',
      disconnect: '✗ Database disconnected',
      error: '✗ Database error',
    };
    const level = event === 'error' ? 'error' : event === 'disconnect' ? 'warn' : 'info';
    log(level, messages[event], context);
  },
};

export default logger;
