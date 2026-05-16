/**
 * routes/auth.js
 *
 * POST /auth/login    Ажилтан нэвтрэх → access + refresh token
 * POST /auth/refresh  Refresh token-оор шинэ access token
 * POST /auth/logout   Stateless (client token-оо устгана) — 204
 * GET  /auth/me       Одоогийн хэрэглэгчийн мэдээлэл (token шаардана)
 */

import { loginBodySchema, refreshBodySchema } from '../schemas/auth.js';
import { login, refresh, AuthError } from '../services/auth.js';

export default async function authRoutes(fastify) {
  fastify.post('/auth/login', async (req, reply) => {
    const body = loginBodySchema.parse(req.body);
    try {
      const result = await login(body.username, body.password, {
        ip: req.ip,
        ua: req.headers['user-agent']
      });
      return { data: result };
    } catch (err) {
      if (err instanceof AuthError) {
        reply.code(err.statusCode);
        return { error: { code: err.code, message: err.message } };
      }
      throw err;
    }
  });

  fastify.post('/auth/refresh', async (req, reply) => {
    const body = refreshBodySchema.parse(req.body);
    try {
      const result = await refresh(body.refresh_token);
      return { data: result };
    } catch (err) {
      if (err instanceof AuthError) {
        reply.code(err.statusCode);
        return { error: { code: err.code, message: err.message } };
      }
      throw err;
    }
  });

  // Stateless JWT — серверт хадгалах зүйлгүй. Client token-оо устгана.
  fastify.post('/auth/logout', async (req, reply) => {
    reply.code(204);
    return null;
  });

  // Одоогийн хэрэглэгч (token шалгана)
  fastify.get('/auth/me', { preHandler: [fastify.authenticate] }, async (req) => {
    return { data: req.user };
  });
}
