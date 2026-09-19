import pino from 'pino'
import { getConfig } from './config'

let logger: pino.Logger | undefined

export function getLogger() {
  logger ??= pino({
    level: getConfig().logLevel,
    redact: {
      paths: [
        'req.headers.authorization',
        'password',
        '*.password',
        'token',
        '*.token',
      ],
      censor: '[REDACTED]',
    },
  })
  return logger
}
