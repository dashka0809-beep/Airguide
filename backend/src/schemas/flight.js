/**
 * schemas/flight.js — Flight endpoint-уудын Zod validation
 */

import { z } from 'zod';

/** IATA код 3 үсэгтэй (томруулна, шалгана) */
const iataCode = z.string().trim().length(3, 'IATA code must be 3 letters')
  .transform(s => s.toUpperCase());

/** YYYY-MM-DD формат */
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD');

/** GET /flights/search */
export const flightSearchQuerySchema = z.object({
  from: iataCode,
  to: iataCode,
  departure_date: isoDate,
  return_date: isoDate.optional(),
  passengers: z.coerce.number().int().min(1).max(9).default(1),
  class: z.enum(['economy', 'business', 'first']).optional()
}).refine(d => d.from !== d.to, {
  message: 'from and to must be different',
  path: ['to']
}).refine(d => !d.return_date || d.return_date >= d.departure_date, {
  message: 'return_date must be on or after departure_date',
  path: ['return_date']
});

/** GET /flights/:id */
export const flightIdParamSchema = z.object({
  id: z.coerce.number().int().positive()
});
