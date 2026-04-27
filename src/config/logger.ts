import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

const { combine, timestamp, colorize, simple, json, errors } = winston.format

const isDevelopment = process.env.NODE_ENV !== 'production'
const logLevel = process.env.LOG_LEVEL ?? 'info'

const devFormat = combine(errors({ stack: true }), timestamp(), colorize(), simple())

const prodFormat = combine(errors({ stack: true }), timestamp(), json())

const transports: winston.transport[] = []

if (isDevelopment) {
  transports.push(
    new winston.transports.Console({
      format: devFormat,
    })
  )
} else {
  transports.push(
    new winston.transports.Console({
      format: prodFormat,
    }),
    new DailyRotateFile({
      filename: './logs/app-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '14d',
      maxSize: '20m',
      format: prodFormat,
    })
  )
}

/** Application-wide Winston logger */
const logger = winston.createLogger({
  level: logLevel,
  transports,
})

export default logger

/**
 * Returns a child logger scoped to the given namespace.
 * @param namespace - Label identifying the calling module
 */
export function childLogger(namespace: string): winston.Logger {
  return logger.child({ namespace })
}
