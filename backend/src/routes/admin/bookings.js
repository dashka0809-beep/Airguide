/**
 * routes/admin/bookings.js
 *
 * GET   /admin/bookings         Жагсаалт (filter + pagination)  — admin/manager/agent
 * PATCH /admin/bookings/:id     cancel / refund                 — admin/manager
 */

import { adminBookingsQuerySchema, adminBookingPatchSchema, idParamSchema } from '../../schemas/admin.js';
import { listBookings, refundBooking, AdminError } from '../../services/admin.js';
import { cancelBooking, BookingError } from '../../services/booking.js';
import { query } from '../../db.js';

export default async function adminBookingRoutes(fastify) {
  fastify.get('/bookings', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin', 'manager', 'agent')]
  }, async (req) => {
    const f = adminBookingsQuerySchema.parse(req.query);
    return await listBookings(f);
  });

  fastify.patch('/bookings/:id', {
    preHandler: [fastify.authenticate, fastify.requireRole('admin', 'manager')]
  }, async (req, reply) => {
    const { id } = idParamSchema.parse(req.params);
    const { action, reason } = adminBookingPatchSchema.parse(req.body);
    const actor = { userId: Number(req.user.sub), ip: req.ip, ua: req.headers['user-agent'] };

    try {
      if (action === 'refund') {
        const result = await refundBooking(id, reason, actor);
        return { data: result };
      }
      // action === 'cancel' → booking_code-оор cancelBooking үйлчилгээ
      const { rows } = await query(`SELECT booking_code FROM bookings WHERE booking_id=$1`, [id]);
      if (!rows[0]) {
        reply.code(404);
        return { error: { code: 'NOT_FOUND', message: 'Захиалга олдсонгүй' } };
      }
      const result = await cancelBooking(rows[0].booking_code, reason);
      return { data: result };
    } catch (err) {
      if (err instanceof AdminError || err instanceof BookingError) {
        reply.code(err.statusCode);
        return { error: { code: err.code, message: err.message } };
      }
      throw err;
    }
  });
}
