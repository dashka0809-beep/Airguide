/**
 * schemas/booking.js — Booking endpoint-уудын Zod validation
 */

import { z } from 'zod';

/** Phone — MN: 8 цифр, эсвэл олон улсын формат (+976...) */
const phone = z.string().trim()
  .regex(/^(\+?\d{6,15})$/, 'Phone must be 6-15 digits, optional + prefix');

/** Email — optional, гэхдээ оруулсан бол хүчинтэй байх */
const optionalEmail = z.string().trim().email().optional().or(z.literal(''));

/** ISO date YYYY-MM-DD */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

/** Passenger sub-schema */
const passengerSchema = z.object({
  last_name:       z.string().trim().min(1).max(60),
  first_name:      z.string().trim().min(1).max(60),
  passport_no:     z.string().trim().max(20).optional().or(z.literal('')),
  passport_expiry: isoDate.optional().or(z.literal('')),
  birth_date:      isoDate,
  gender:          z.enum(['M', 'F', 'O']),
  nationality:     z.string().trim().max(60).default('Mongolian'),
  passenger_type:  z.enum(['adult', 'child', 'infant']).default('adult'),
  meal_preference: z.string().trim().max(30).optional()
});

/** POST /bookings — body */
export const createBookingBodySchema = z.object({
  trip_type:           z.enum(['one_way', 'round_trip', 'multi_city']).default('one_way'),
  outbound_flight_id:  z.coerce.number().int().positive(),
  return_flight_id:    z.coerce.number().int().positive().optional(),
  class_type:          z.enum(['economy', 'business', 'first']).default('economy'),
  customer: z.object({
    last_name:   z.string().trim().min(1).max(60),
    first_name:  z.string().trim().min(1).max(60),
    email:       optionalEmail,
    phone:       phone
  }),
  passengers: z.array(passengerSchema).min(1).max(9),
  notes:    z.string().trim().max(500).optional(),
  metadata: z.record(z.string(), z.any()).optional()
}).refine(
  d => d.trip_type !== 'round_trip' || !!d.return_flight_id,
  { message: 'return_flight_id is required for round_trip', path: ['return_flight_id'] }
).refine(
  d => !d.return_flight_id || d.return_flight_id !== d.outbound_flight_id,
  { message: 'return_flight_id must differ from outbound_flight_id', path: ['return_flight_id'] }
);

/** GET /bookings/:code — params */
export const bookingCodeParamSchema = z.object({
  code: z.string().trim().regex(/^[A-Z0-9]{6,10}$/i, 'Invalid booking code')
});

/** POST /bookings/:code/cancel — optional body */
export const cancelBookingBodySchema = z.object({
  reason: z.string().trim().max(255).optional()
});
