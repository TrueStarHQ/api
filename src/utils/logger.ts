import pino from 'pino';
import type { LoggerOptions, Logger } from 'pino';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { getConfig } from '../config/config.js';

export const logger: Logger =
  getConfig().NODE_ENV === 'test' ? createNoOpLogger() : createLogger();

export function createLogger(options?: LoggerOptions): Logger {
  const defaultOptions = getPinoOptions();
  const finalOptions = { ...defaultOptions, ...options };
  return pino(finalOptions);
}

const getLogLevel = () => getConfig().LOG_LEVEL;

const SENSITIVE_PATHS = [
  'apiKey',
  'password',
  'token',
  'authorization',
  'cookie',
  '*.apiKey',
  '*.password',
  '*.token',
  'headers.authorization',
  'headers.cookie',
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

const getPinoOptions = (): LoggerOptions => {
  const baseOptions: LoggerOptions = {
    level: getLogLevel(),
    timestamp: pino.stdTimeFunctions.isoTime,
    serializers,
    redact: {
      paths: SENSITIVE_PATHS,
      remove: true,
    },
  };

  if (getConfig().NODE_ENV === 'development') {
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
};

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
