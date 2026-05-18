/**
 * routes/travelport.js — Travelport sandbox прототайп (ТУСГААРЛАСАН)
 *
 * GET /travelport/health       → { enabled, env }
 * GET /travelport/test-search  → mapped sandbox results | 503 | 502
 *
 * ⚠️ Одоогийн /api/flights/search болон захиалгад ОГТ хүрэхгүй.
 *    Нэвтрэх эрхгүй бол graceful 503 (chat-тай ижил).
 */
import { config } from '../config.js';
import { travelportSearchQuerySchema } from '../schemas/travelport.js';
import { searchFlights } from '../services/travelport.js';
import { captureException } from '../sentry.js';

export default async function travelportRoutes(fastify) {
  fastify.get('/travelport/health', async () => ({
    enabled: config.travelport.enabled,
    env: config.travelport.env
  }));

  fastify.get('/travelport/test-search', async (req, reply) => {
    if (!config.travelport.enabled) {
      reply.code(503);
      return {
        error: {
          code: 'TRAVELPORT_DISABLED',
          message: 'Travelport credentials not configured'
        }
      };
    }
    // Буруу query → ZodError → глобал error handler 400 болгоно
    const q = travelportSearchQuerySchema.parse(req.query);
    try {
      const results = await searchFlights({
        from: q.from, to: q.to, departureDate: q.departure_date
      });
      return {
        source: `travelport-${config.travelport.env}`,
        count: results.length,
        results
      };
    } catch (err) {
      captureException(err, { method: req.method, url: req.url, ip: req.ip });
      reply.code(502);
      return {
        error: {
          code: err.code || 'TRAVELPORT_UPSTREAM',
          message: 'Travelport request failed'
        }
      };
    }
  });
}
