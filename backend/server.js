/**
 * server.js — Fastify entry point
 *
 * Эхлүүлэх:
 *   npm install
 *   cp .env.example .env  (тохиргоо засах)
 *   npm run dev           → http://localhost:3000
 *
 * Шалгах:
 *   curl http://localhost:3000/api/health
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { config } from './src/config.js';
import { checkDbHealth, closeDb } from './src/db.js';

// ============================================================
// Fastify instance
// ============================================================
const fastify = Fastify({
  logger: {
    level: config.logLevel,
    // pino redact — PII (passport, password) log-д орохгүй
    redact: {
      paths: ['req.headers.authorization', '*.password', '*.passport_no', '*.register_no'],
      remove: true
    },
    transport: config.isDevelopment
      ? { target: 'pino-pretty', options: { translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' } }
      : undefined
  },
  trustProxy: true
});

// ============================================================
// Plugins
// ============================================================

// CORS — Frontend-ийн origin-аас л зөвшөөрнө
await fastify.register(cors, {
  origin: config.cors.origin,
  credentials: false,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS']
});

// Rate limit — anti-DDoS / brute-force
await fastify.register(rateLimit, {
  max: 60,
  timeWindow: '1 minute',
  hook: 'onRequest',
  keyGenerator: (req) => req.ip
});

// ============================================================
// Routes (Phase 0 — зөвхөн health)
// Phase 1-д src/routes/ дотроос автомат бүртгэнэ.
// ============================================================

fastify.get('/api/health', async () => {
  const dbOk = await checkDbHealth();
  return {
    status: dbOk ? 'ok' : 'degraded',
    database: dbOk ? 'connected' : 'disconnected',
    env: config.env,
    timestamp: new Date().toISOString()
  };
});

fastify.get('/', async () => {
  return {
    name: 'Air Guide API',
    version: '0.1.0',
    docs: config.isDevelopment ? '/docs' : null,
    health: '/api/health'
  };
});

// ============================================================
// Error handler
// ============================================================
fastify.setErrorHandler((err, req, reply) => {
  fastify.log.error(err);

  // Zod validation errors
  if (err.name === 'ZodError') {
    return reply.code(400).send({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.errors[0]?.message ?? 'Invalid input',
        details: err.errors
      }
    });
  }

  // Rate limit
  if (err.statusCode === 429) {
    return reply.code(429).send({
      error: { code: 'RATE_LIMITED', message: 'Too many requests' }
    });
  }

  // Default
  const status = err.statusCode ?? 500;
  reply.code(status).send({
    error: {
      code: status === 500 ? 'INTERNAL_ERROR' : (err.code ?? 'UNKNOWN'),
      message: config.isProduction && status === 500
        ? 'Internal server error'
        : err.message
    }
  });
});

// ============================================================
// Graceful shutdown
// ============================================================
const closeGracefully = async (signal) => {
  fastify.log.info(`Received ${signal}, closing gracefully...`);
  await fastify.close();
  await closeDb();
  process.exit(0);
};

process.on('SIGINT', () => closeGracefully('SIGINT'));
process.on('SIGTERM', () => closeGracefully('SIGTERM'));

// ============================================================
// Start
// ============================================================
try {
  await fastify.listen({ port: config.port, host: '0.0.0.0' });
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}
