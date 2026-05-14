/**
 * schemas/airport.js — Airport endpoint-уудын Zod validation
 */

import { z } from 'zod';

/** GET /airports?q=&limit= */
export const airportSearchQuerySchema = z.object({
  q: z.string().trim().min(1, 'q is required').max(50),
  limit: z.coerce.number().int().min(1).max(50).default(10)
});
