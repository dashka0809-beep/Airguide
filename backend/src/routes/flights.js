/**
 * routes/flights.js
 *
 * GET /flights/search?from=ULN&to=ICN&departure_date=2026-06-15  Нислэг хайх
 * GET /flights/:id                                                Нэг нислэгийн дэлгэрэнгүй
 *
 * Жишээ:
 *   curl 'https://api.airguide.mn/api/flights/search?from=ULN&to=ICN&departure_date=2026-06-15'
 *   curl 'https://api.airguide.mn/api/flights/1'
 */

import { query } from '../db.js';
import { flightSearchQuerySchema, flightIdParamSchema } from '../schemas/flight.js';

/** v_flight_details-аас flight row-ыг API-н хэлбэрт хөрвүүлэх */
function shapeFlight(row) {
  return {
    flight_id:        row.flight_id,
    flight_number:    row.flight_number,
    airline: {
      airline_id: row.airline_id,
      code:       row.airline_code,
      name:       row.airline_name,
      logo_url:   row.airline_logo
    },
    origin: {
      airport_id: row.origin_airport_id,
      code:       row.origin_code,
      name:       row.origin_name,
      city:       row.origin_city,
      country:    row.origin_country
    },
    destination: {
      airport_id: row.dest_airport_id,
      code:       row.dest_code,
      name:       row.dest_name,
      city:       row.dest_city,
      country:    row.dest_country
    },
    departure_time:    row.departure_time,
    arrival_time:      row.arrival_time,
    duration_minutes:  row.duration_minutes,
    price: {
      economy:  row.economy_price !== null ? Number(row.economy_price)   : null,
      business: row.business_price !== null ? Number(row.business_price) : null,
      first:    row.first_price !== null ? Number(row.first_price)       : null
    },
    available_seats: row.available_seats,
    status:          row.status,
    aircraft: row.aircraft_model ? {
      model:       row.aircraft_model,
      total_seats: row.aircraft_total_seats
    } : null,
    currency: 'MNT'
  };
}

export default async function flightRoutes(fastify) {
  /**
   * GET /flights/search
   * Outbound + (optionally) inbound нислэгүүдийг хайна.
   */
  fastify.get('/flights/search', async (req, reply) => {
    const params = flightSearchQuerySchema.parse(req.query);

    // Outbound: from → to, departure_date өдөр
    const { rows: outboundRows } = await query(
      `
      SELECT *
      FROM v_flight_details
      WHERE origin_code = $1
        AND dest_code   = $2
        AND departure_time::date = $3::date
        AND status = 'scheduled'
        AND available_seats >= $4
      ORDER BY departure_time
      `,
      [params.from, params.to, params.departure_date, params.passengers]
    );

    // Inbound (хэрэв round-trip)
    let inboundRows = [];
    if (params.return_date) {
      const result = await query(
        `
        SELECT *
        FROM v_flight_details
        WHERE origin_code = $1
          AND dest_code   = $2
          AND departure_time::date = $3::date
          AND status = 'scheduled'
          AND available_seats >= $4
        ORDER BY departure_time
        `,
        [params.to, params.from, params.return_date, params.passengers]
      );
      inboundRows = result.rows;
    }

    return {
      data: {
        outbound: outboundRows.map(shapeFlight),
        inbound:  inboundRows.map(shapeFlight)
      },
      meta: {
        outbound_count: outboundRows.length,
        inbound_count:  inboundRows.length,
        passengers:     params.passengers
      }
    };
  });

  /**
   * GET /flights/:id
   * Нэг нислэгийн дэлгэрэнгүй.
   */
  fastify.get('/flights/:id', async (req, reply) => {
    const { id } = flightIdParamSchema.parse(req.params);

    const { rows } = await query(
      `SELECT * FROM v_flight_details WHERE flight_id = $1`,
      [id]
    );

    if (rows.length === 0) {
      return reply.code(404).send({
        error: { code: 'NOT_FOUND', message: 'Flight not found' }
      });
    }

    return { data: shapeFlight(rows[0]) };
  });
}
