/**
 * routes/admin/flights.js
 *
 * GET   /admin/flights        Жагсаалт (filter + pagination) — admin/manager/agent
 * POST  /admin/flights        Шинэ нислэг                    — admin/manager
 * PATCH /admin/flights/:id    Засах                          — admin/manager
 */

import {
  adminFlightsQuerySchema, adminFlightCreateSchema,
  adminFlightPatchSchema, idParamSchema
} from '../../schemas/admin.js';
import { listFlights, createFlight, updateFlight, AdminError } from '../../services/admin.js';

export default async function adminFlightRoutes(fastify) {
  fastify.get('/flights', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin', 'manager', 'agent')]
  }, async (req) => {
    const f = adminFlightsQuerySchema.parse(req.query);
    return await listFlights(f);
  });

  fastify.post('/flights', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin', 'manager')]
  }, async (req, reply) => {
    const body = adminFlightCreateSchema.parse(req.body);
    const actor = { userId: Number(req.user.sub), ip: req.ip, ua: req.headers['user-agent'] };
    try {
      const result = await createFlight(body, actor);
      reply.code(201);
      return { data: result };
    } catch (err) {
      if (err instanceof AdminError) {
        reply.code(err.statusCode);
        return { error: { code: err.code, message: err.message } };
      }
      // FK / constraint алдаа → 422
      if (err.code === '23503' || err.code === '23514') {
        reply.code(422);
        return { error: { code: 'INVALID_REFERENCE', message: err.detail || err.message } };
      }
      throw err;
    }
  });

  fastify.patch('/flights/:id', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin', 'manager')]
  }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const patch = adminFlightPatchSchema.parse(req.body);
    const actor = { userId: Number(req.user.sub), ip: req.ip, ua: req.headers['user-agent'] };
    try {
      const result = await updateFlight(id, patch, actor);
      return { data: result };
    } catch (err) {
      if (err instanceof AdminError) {
        reply.code(err.statusCode);
        return { error: { code: err.code, message: err.message } };
      }
      throw err;
    }
  });
}
