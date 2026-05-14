/**
 * routes/airlines.js
 *
 * GET /airlines     Бүх идэвхтэй агаарын компанийн жагсаалт
 *
 * Cache-чилэлт: response-д Cache-Control: 1 цаг (бараг өөрчлөгддөггүй)
 *
 * Жишээ:
 *   curl 'https://api.airguide.mn/api/airlines'
 */

import { query } from '../db.js';

export default async function airlineRoutes(fastify) {
  fastify.get('/airlines', async (req, reply) => {
    const { rows } = await query(
      `
      SELECT
        airline_id, iata_code, icao_code, name, country, logo_url, website
      FROM airlines
      WHERE is_active = TRUE
      ORDER BY name
      `
    );

    // Browser/CDN-д 1 цаг cache хийгээрэй
    reply.header('Cache-Control', 'public, max-age=3600');

    return { data: rows, meta: { total: rows.length } };
  });
}
