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
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { config } from './src/config.js';
import { checkDbHealth, closeDb } from './src/db.js';

// Plugins
import authPlugin from './src/plugins/auth.js';

// Phase 1 routes
import airportRoutes from './src/routes/airports.js';
import airlineRoutes from './src/routes/airlines.js';
import flightRoutes  from './src/routes/flights.js';
import bookingRoutes from './src/routes/bookings.js';

// Phase 4 routes
import authRoutes from './src/routes/auth.js';
import adminBookingRoutes from './src/routes/admin/bookings.js';
import adminFlightRoutes from './src/routes/admin/flights.js';
import adminReportRoutes from './src/routes/admin/reports.js';

// Phase 6 routes
import chatRoutes from './src/routes/chat.js';

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

// Auth decorator (fastify.authenticate, fastify.requireRole)
await fastify.register(authPlugin);

// OpenAPI spec + Swagger UI (/docs) — route-уудаас өмнө бүртгэнэ
await fastify.register(swagger, {
  openapi: {
    info: {
      title: 'Air Guide API',
      description: 'Нислэгийн тийз захиалгын REST API',
      version: '0.1.0'
    },
    servers: [{ url: '/' }],
    tags: [
      { name: 'public', description: 'Нээлттэй endpoint' },
      { name: 'booking', description: 'Захиалга' },
      { name: 'auth', description: 'Нэвтрэлт' },
      { name: 'admin', description: 'Оператор (JWT шаардана)' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  }
});
await fastify.register(swaggerUi, {
  routePrefix: '/docs',
  uiConfig: { docExpansion: 'list', deepLinking: true }
});

// ============================================================
// Routes
// ============================================================

// Public endpoints
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
    docs: '/docs',
    health: '/api/health',
    endpoints: [
      'GET  /api/airports?q=&limit=',
      'GET  /api/airlines',
      'GET  /api/flights/search?from=&to=&departure_date=&return_date=',
      'GET  /api/flights/:id',
      'POST /api/bookings',
      'GET  /api/bookings/:code',
      'POST /api/bookings/:code/cancel',
      'POST /api/auth/login',
      'POST /api/auth/refresh',
      'GET  /api/auth/me',
      'GET  /api/admin/bookings',
      'PATCH /api/admin/bookings/:id',
      'GET  /api/admin/flights',
      'POST /api/admin/flights',
      'PATCH /api/admin/flights/:id',
      'GET  /api/admin/reports/revenue',
      'POST /api/chat',
      'GET  /api/chat/health'
    ]
  };
});

// Phase 1 route bundles (/api prefix)
await fastify.register(airportRoutes, { prefix: '/api' });
await fastify.register(airlineRoutes, { prefix: '/api' });
await fastify.register(flightRoutes,  { prefix: '/api' });
await fastify.register(bookingRoutes, { prefix: '/api' });

// Phase 4 route bundles
await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(adminBookingRoutes, { prefix: '/api/admin' });
await fastify.register(adminFlightRoutes,  { prefix: '/api/admin' });
await fastify.register(adminReportRoutes,  { prefix: '/api/admin' });

// Phase 6 route bundles
await fastify.register(chatRoutes, { prefix: '/api' });

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
