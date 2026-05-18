/**
 * schemas/travelport.js — Travelport test-search query Zod validation
 */
import { z } from 'zod';

/** GET /travelport/test-search — query */
export const travelportSearchQuerySchema = z.object({
  from:           z.string().trim().length(3, 'from must be a 3-letter IATA code')
                   .transform(s => s.toUpperCase()),
  to:             z.string().trim().length(3, 'to must be a 3-letter IATA code')
                   .transform(s => s.toUpperCase()),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'departure_date must be YYYY-MM-DD')
});
