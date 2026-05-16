/**
 * schemas/admin.js — Admin endpoint-уудын Zod validation
 */

import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(100).default(20);

/** GET /admin/bookings?status=&from=&to=&customer_id=&page=&limit= */
export const adminBookingsQuerySchema = z.object({
  status: z.enum(['pending', 'confirmed', 'cancelled', 'completed', 'refunded']).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  customer_id: z.coerce.number().int().positive().optional(),
  q: z.string().trim().max(40).optional(),
  page,
  limit
});

/** PATCH /admin/bookings/:id */
export const adminBookingPatchSchema = z.object({
  action: z.enum(['cancel', 'refund']),
  reason: z.string().trim().max(255).optional()
});

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive()
});

/** GET /admin/flights */
export const adminFlightsQuerySchema = z.object({
  from: z.string().trim().length(3).optional(),
  to: z.string().trim().length(3).optional(),
  status: z.enum(['scheduled', 'boarding', 'departed', 'arrived', 'cancelled', 'delayed']).optional(),
  date: isoDate.optional(),
  page,
  limit
});

/** POST /admin/flights */
export const adminFlightCreateSchema = z.object({
  flight_number: z.string().trim().min(2).max(10),
  airline_id: z.coerce.number().int().positive(),
  aircraft_id: z.coerce.number().int().positive().optional(),
  origin_airport_id: z.coerce.number().int().positive(),
  destination_airport_id: z.coerce.number().int().positive(),
  departure_time: z.string().datetime({ offset: true }),
  arrival_time: z.string().datetime({ offset: true }),
  duration_minutes: z.coerce.number().int().positive(),
  economy_price: z.coerce.number().nonnegative(),
  business_price: z.coerce.number().nonnegative().optional(),
  first_price: z.coerce.number().nonnegative().optional(),
  available_seats: z.coerce.number().int().nonnegative(),
  status: z.enum(['scheduled', 'boarding', 'departed', 'arrived', 'cancelled', 'delayed']).default('scheduled')
}).refine(d => d.origin_airport_id !== d.destination_airport_id, {
  message: 'origin and destination must differ', path: ['destination_airport_id']
}).refine(d => new Date(d.departure_time) < new Date(d.arrival_time), {
  message: 'departure must be before arrival', path: ['arrival_time']
});

/** PATCH /admin/flights/:id — partial */
export const adminFlightPatchSchema = z.object({
  economy_price: z.coerce.number().nonnegative().optional(),
  business_price: z.coerce.number().nonnegative().optional(),
  first_price: z.coerce.number().nonnegative().optional(),
  available_seats: z.coerce.number().int().nonnegative().optional(),
  departure_time: z.string().datetime({ offset: true }).optional(),
  arrival_time: z.string().datetime({ offset: true }).optional(),
  status: z.enum(['scheduled', 'boarding', 'departed', 'arrived', 'cancelled', 'delayed']).optional()
}).refine(d => Object.keys(d).length > 0, { message: 'No fields to update' });

/** GET /admin/reports/revenue?period=YYYY-MM | from=&to= */
export const revenueQuerySchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  from: isoDate.optional(),
  to: isoDate.optional()
});
