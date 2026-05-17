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
import { MN_CITY_ALIAS } from '../services/search.js';

export default async function airportRoutes(fastify) {
  fastify.get('/airports', async (req, reply) => {
    const { q, limit } = airportSearchQuerySchema.parse(req.query);

    // Монгол/Кирилл хотын нэрийг IATA болгож хөрвүүлнэ (chat-тай ижил
    // alias). Ингэснээр "улаанбаатар" → "ULN" болж доорх SQL таарна.
    const term = MN_CITY_ALIAS[String(q).trim().toLowerCase()] ?? q;

    // Rank: exact iata > iata prefix > city prefix > city substring > similarity
    // Trigram threshold 0.15 болгож "ulan" → "Ulaanbaatar" (sim 0.21) ч таарна
    const { rows } = await query(
      `
      SELECT
        airport_id, iata_code, icao_code, name, city, country, timezone,
        GREATEST(
          CASE WHEN UPPER(iata_code) = UPPER($1)        THEN 1.00 ELSE 0 END,
          CASE WHEN iata_code ILIKE $1 || '%'           THEN 0.90 ELSE 0 END,
          CASE WHEN city      ILIKE $1 || '%'           THEN 0.85 ELSE 0 END,
          CASE WHEN city      ILIKE '%' || $1 || '%'    THEN 0.70 ELSE 0 END,
          CASE WHEN name      ILIKE '%' || $1 || '%'    THEN 0.65 ELSE 0 END,
          similarity(city, $1),
          similarity(name, $1) * 0.8
        ) AS rank
      FROM airports
      WHERE iata_code ILIKE $1 || '%'
         OR city      ILIKE $1 || '%'
         OR city      ILIKE '%' || $1 || '%'
         OR name      ILIKE '%' || $1 || '%'
         OR similarity(city, $1) > 0.15
         OR similarity(name, $1) > 0.20
      ORDER BY rank DESC, city ASC
      LIMIT $2
      `,
      [term, limit]
    );

    // Хариунд rank-г оруулахгүй (дотоод хэрэглээ)
    const data = rows.map(({ rank, ...rest }) => rest);
    return { data };
  });
}
