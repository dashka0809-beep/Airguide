/**
 * routes/bookings.js
 *
 * POST   /bookings                    Шинэ захиалга үүсгэх (transaction)
 * GET    /bookings/:code              Захиалгын дэлгэрэнгүй
 * POST   /bookings/:code/cancel       Захиалга цуцлах
 */

import {
  createBookingBodySchema,
  bookingCodeParamSchema,
  cancelBookingBodySchema
} from '../schemas/booking.js';
import {
  createBooking,
  getBookingByCode,
  cancelBooking,
  BookingError
} from '../services/booking.js';

export default async function bookingRoutes(fastify) {
  /**
   * POST /bookings
   */
  fastify.post('/bookings', async (req, reply) => {
    const body = createBookingBodySchema.parse(req.body);
    try {
      const result = await createBooking(body);
      reply.code(201);
      return { data: result };
    } catch (err) {
      if (err instanceof BookingError) {
        reply.code(err.statusCode);
        return { error: { code: err.code, message: err.message } };
      }
      throw err;
    }
  });

  /**
   * GET /bookings/:code
   */
  fastify.get('/bookings/:code', async (req, reply) => {
    const { code } = bookingCodeParamSchema.parse(req.params);
    const booking = await getBookingByCode(code);
    if (!booking) {
      reply.code(404);
      return { error: { code: 'NOT_FOUND', message: 'Booking not found' } };
    }
    return { data: booking };
  });

  /**
   * POST /bookings/:code/cancel
   */
  fastify.post('/bookings/:code/cancel', async (req, reply) => {
    const { code } = bookingCodeParamSchema.parse(req.params);
    const body = cancelBookingBodySchema.parse(req.body ?? {});
    try {
      const result = await cancelBooking(code, body.reason);
      return { data: result };
    } catch (err) {
      if (err instanceof BookingError) {
        reply.code(err.statusCode);
        return { error: { code: err.code, message: err.message } };
      }
      throw err;
    }
  });
}
