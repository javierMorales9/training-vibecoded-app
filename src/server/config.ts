import 'dotenv/config'
import path from 'node:path'
import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  APP_PASSWORD: z.string().min(8),
  SESSION_SECRET: z.string().min(32),
  APP_ORIGIN: z.url(),
  DATABASE_PATH: z.string().min(1),
  LOCAL_MEDIA_PATH: z.string().min(1),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
})

let cachedConfig: AppConfig | undefined

export interface AppConfig {
  nodeEnv: 'development' | 'test' | 'production'
  appPassword: string
  sessionSecret: string
  appOrigin: string
  databasePath: string
  localMediaPath: string
  logLevel: string
}

export function getConfig(): AppConfig {
  if (cachedConfig) return cachedConfig

  const parsed = environmentSchema.parse({
    ...process.env,
    APP_PASSWORD:
      process.env.APP_PASSWORD ??
      (process.env.NODE_ENV === 'test' ? 'test-password' : undefined),
    SESSION_SECRET:
      process.env.SESSION_SECRET ??
      (process.env.NODE_ENV === 'test'
        ? 'test-session-secret-at-least-32-characters'
        : undefined),
    APP_ORIGIN: process.env.APP_ORIGIN ?? 'http://localhost:3000',
    DATABASE_PATH: process.env.DATABASE_PATH ?? './data/training.sqlite',
    LOCAL_MEDIA_PATH:
      process.env.LOCAL_MEDIA_PATH ??
      './Desencadenado-Entrenos con peso corporal/files',
  })

  const resolveFromRoot = (value: string) =>
    path.isAbsolute(value) ? value : path.resolve(process.cwd(), value)
  cachedConfig = {
    nodeEnv: parsed.NODE_ENV,
    appPassword: parsed.APP_PASSWORD,
    sessionSecret: parsed.SESSION_SECRET,
    appOrigin: parsed.APP_ORIGIN.replace(/\/$/, ''),
    databasePath: resolveFromRoot(parsed.DATABASE_PATH),
    localMediaPath: resolveFromRoot(parsed.LOCAL_MEDIA_PATH),
    logLevel: parsed.LOG_LEVEL,
  }
  return cachedConfig
}

export function resetConfigForTests() {
  cachedConfig = undefined
}
