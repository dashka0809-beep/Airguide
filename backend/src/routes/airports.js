/**
 * routes/airports.js
 *
 * GET /airports?q=&limit=     Autocomplete (pg_trgm + ILIKE prefix)
 *
 * Жишээ:
 *   curl 'https://api.airguide.mn/api/airports?q=ulan'
 */

import { query } from '../db.js';
import { airportSearchQuerySchema } from '../schemas/airport.js';

export default async function airportRoutes(fastify) {
  fastify.get('/airports', async (req, reply) => {
    const { q, limit } = airportSearchQuerySchema.parse(req.query);

    // 3 нэр хайх + trigram similarity-аар rank
    // - iata_code prefix хамгийн өндөр rank
    // - city prefix дараагийнх
    // - name дотор substring
    // - тригам similarity (typo үед)
    const { rows } = await query(
      `
      SELECT
        airport_id, iata_code, icao_code, name, city, country, timezone,
        GREATEST(
          similarity(city, $1),
          similarity(name, $1),
          CASE WHEN iata_code ILIKE $1 || '%' THEN 1.0 ELSE 0 END
        ) AS rank
      FROM airports
      WHERE city ILIKE $1 || '%'
         OR name ILIKE '%' || $1 || '%'
         OR iata_code ILIKE $1 || '%'
         OR city % $1
         OR name % $1
      ORDER BY rank DESC, city ASC
      LIMIT $2
      `,
      [q, limit]
    );

    // Хариунд rank-г оруулахгүй (дотоод хэрэглээ)
    const data = rows.map(({ rank, ...rest }) => rest);
    return { data };
  });
}
