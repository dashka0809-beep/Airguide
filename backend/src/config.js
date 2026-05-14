/**
 * config.js — process.env-ээс уншиж typed config үүсгэх
 *
 * Хэрэглэх жишээ:
 *   import { config } from './src/config.js';
 *   console.log(config.port);
 */

import { z } from 'zod';

/** Environment variables-ийг шалгах schema */
const envSchema = z.object({
  // Server
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),

  // Database
  DATABASE_URL: z.string().url(),
  DB_POOL_MAX: z.coerce.number().int().positive().default(10),
  DB_POOL_IDLE_TIMEOUT: z.coerce.number().int().nonnegative().default(30000),

  // Auth
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 chars').default('dev_only_change_in_production_min_32_chars'),
  JWT_ACCESS_TTL: z.coerce.number().int().positive().default(900),
  JWT_REFRESH_TTL: z.coerce.number().int().positive().default(2592000),
  BCRYPT_COST: z.coerce.number().int().min(8).max(15).default(12),

  // CORS
  FRONTEND_ORIGIN: z.string().default('http://localhost:5173'),

  // QPay (optional хүртэл Phase 3)
  QPAY_BASE_URL: z.string().optional(),
  QPAY_USERNAME: z.string().optional(),
  QPAY_PASSWORD: z.string().optional(),
  QPAY_INVOICE_CODE: z.string().optional(),

  // Email (optional хүртэл Phase 3)
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),

  // Monitoring (optional)
  SENTRY_DSN: z.string().optional()
});

let parsed;
try {
  parsed = envSchema.parse(process.env);
} catch (err) {
  console.error('❌ Invalid environment variables:');
  console.error(err.errors);
  process.exit(1);
}

export const config = {
  port: parsed.PORT,
  env: parsed.NODE_ENV,
  isProduction: parsed.NODE_ENV === 'production',
  isDevelopment: parsed.NODE_ENV === 'development',
  logLevel: parsed.LOG_LEVEL,

  db: {
    url: parsed.DATABASE_URL,
    poolMax: parsed.DB_POOL_MAX,
    idleTimeout: parsed.DB_POOL_IDLE_TIMEOUT
  },

  auth: {
    jwtSecret: parsed.JWT_SECRET,
    accessTtl: parsed.JWT_ACCESS_TTL,
    refreshTtl: parsed.JWT_REFRESH_TTL,
    bcryptCost: parsed.BCRYPT_COST
  },

  cors: {
    origin: parsed.FRONTEND_ORIGIN
  },

  qpay: {
    baseUrl: parsed.QPAY_BASE_URL,
    username: parsed.QPAY_USERNAME,
    password: parsed.QPAY_PASSWORD,
    invoiceCode: parsed.QPAY_INVOICE_CODE
  },

  email: {
    resendApiKey: parsed.RESEND_API_KEY,
    from: parsed.EMAIL_FROM
  },

  sentry: {
    dsn: parsed.SENTRY_DSN
  }
};
