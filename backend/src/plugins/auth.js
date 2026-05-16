/**
 * plugins/auth.js — JWT баталгаажуулах Fastify plugin
 *
 * fastify.authenticate           — preHandler: Bearer token шалгана
 * fastify.requireRole('admin')   — preHandler: role шаардлага
 *
 * Хэрэглэх (route дотор):
 *   fastify.get('/admin/x', { preHandler: [fastify.authenticate, fastify.requireRole('admin','manager')] }, handler)
 *
 * Token зөв бол req.user = { sub, username, role } болно.
 */

import fp from 'fastify-plugin';
import { verifyToken } from '../utils/crypto.js';

async function authPlugin(fastify) {
  // Bearer token шалгах
  fastify.decorate('authenticate', async (req, reply) => {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) {
      return reply.code(401).send({
        error: { code: 'UNAUTHORIZED', message: 'Authorization header байхгүй' }
      });
    }
    try {
      const payload = await verifyToken(token);
      if (payload.typ !== 'access') {
        return reply.code(401).send({
          error: { code: 'INVALID_TOKEN', message: 'Access token биш' }
        });
      }
      req.user = { sub: payload.sub, username: payload.username, role: payload.role };
    } catch {
      return reply.code(401).send({
        error: { code: 'INVALID_TOKEN', message: 'Token хүчингүй эсвэл хугацаа дууссан' }
      });
    }
  });

  // Role шаардлага (authenticate-ийн ДАРАА ажиллана)
  fastify.decorate('requireRole', (...roles) => {
    return async (req, reply) => {
      if (!req.user) {
        return reply.code(401).send({
          error: { code: 'UNAUTHORIZED', message: 'Нэвтрээгүй' }
        });
      }
      if (!roles.includes(req.user.role)) {
        return reply.code(403).send({
          error: { code: 'FORBIDDEN', message: 'Энэ үйлдэлд эрх хүрэхгүй' }
        });
      }
    };
  });
}

export default fp(authPlugin, { name: 'auth' });
