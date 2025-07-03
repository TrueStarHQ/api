import { requestContext } from '@fastify/request-context';
import type { FastifyBaseLogger, FastifyReply, FastifyRequest } from 'fastify';
import type { Logger, LoggerOptions } from 'pino';
import { pino } from 'pino';

import { getConfig } from '../config/config.js';

const SENSITIVE_FIELD_NAMES = [
  'apiKey',
  'authorization',
  'cookie',
  'password',
  'token',
];

const SENSITIVE_PATHS = [
  ...SENSITIVE_FIELD_NAMES,
  ...SENSITIVE_FIELD_NAMES.map((fieldName) => `*.${fieldName}`),
];

const serializers = {
  req: (req: FastifyRequest) => ({
    method: req.method,
    url: req.url,
    headers: {
      'user-agent': req.headers['user-agent'] as string | undefined,
      'x-forwarded-for': req.headers['x-forwarded-for'] as string | undefined,
    },
  }),
  res: (res: FastifyReply) => ({
    statusCode: res.statusCode,
  }),
  err: pino.stdSerializers.err,
};

export function getPinoOptions(): LoggerOptions {
  const config = getConfig();

  const baseOptions: LoggerOptions = {
    level: config.LOG_LEVEL,
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers,
    redact: {
      paths: SENSITIVE_PATHS,
      remove: true,
    },
  };

  if (config.NODE_ENV === 'development') {
    return {
      ...baseOptions,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss',
          ignore: 'pid,hostname',
        },
      },
    };
  }

  return baseOptions;
}

function createNoOpLogger(): Logger {
  const noop = () => {};
  Object.defineProperty(noop, 'name', { value: 'no-op' });

  return {
    fatal: noop,
    error: noop,
    warn: noop,
    info: noop,
    debug: noop,
    trace: noop,
    child: () => createNoOpLogger(),
  } as unknown as Logger;
}

function createDefaultLogger(): Logger {
  const isTest = getConfig().NODE_ENV === 'test';
  return isTest ? createNoOpLogger() : pino(getPinoOptions());
}

const defaultLogger = createDefaultLogger();

/**
 * Main logger instance that automatically uses the correct logger based on context:
 * - Inside a Fastify request: uses the request-scoped logger (with request ID, etc.)
 * - Outside a Fastify request: uses the default application logger
 *
 * Usage: log.info('Hello world')
 */
export const log = new Proxy({} as Logger, {
  get(_target, property, receiver) {
    const currentLogger = requestContext.get('logger') ?? defaultLogger;
    return Reflect.get(currentLogger, property, receiver);
  },
});

declare module '@fastify/request-context' {
  interface RequestContextData {
    logger: FastifyBaseLogger;
  }
}
