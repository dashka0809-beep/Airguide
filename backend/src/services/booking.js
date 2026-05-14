/**
 * services/booking.js — Booking transaction логик
 *
 * Захиалга үүсгэх — атомтай transaction-аар:
 *   1) Flights-уудыг FOR UPDATE lock
 *   2) available_seats шалгах
 *   3) UPSERT customer (by phone)
 *   4) INSERT booking → booking_code retry on conflict
 *   5) INSERT passengers × N
 *   6) INSERT tickets × N (trigger автомат suudal -1)
 *   7) COMMIT
 */

import { transaction, query } from '../db.js';
import { generateBookingCode, generateTicketNumber } from '../utils/code.js';

/** Алдаа гарвал HTTP code-той error throw хийх helper */
class BookingError extends Error {
  constructor(code, message, statusCode = 422) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Нэг flight-ийн class_type-н үнэ
 */
function priceFor(flight, classType) {
  const map = {
    economy:  flight.economy_price,
    business: flight.business_price,
    first:    flight.first_price
  };
  const price = map[classType];
  if (price === null || price === undefined) {
    throw new BookingError(
      'CLASS_UNAVAILABLE',
      `${classType} class is not available on flight ${flight.flight_number}`,
      422
    );
  }
  return Number(price);
}

/**
 * Олон удаа оролдоод unique booking_code үүсгэх
 * (давхар тохиолдох магадлал маш бага, гэхдээ retry хийнэ)
 */
async function createBookingRow(client, { customerId, createdBy, tripType, totalPax, totalAmount, notes, metadata }) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateBookingCode();
    try {
      const { rows } = await client.query(
        `
        INSERT INTO bookings
          (booking_code, customer_id, created_by, trip_type,
           total_passengers, total_amount, paid_amount, status, notes, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, 0, 'pending', $7, $8)
        RETURNING booking_id, booking_code, booking_date
        `,
        [code, customerId, createdBy, tripType, totalPax, totalAmount, notes ?? null, metadata ?? {}]
      );
      return rows[0];
    } catch (err) {
      // 23505 = unique_violation (booking_code давхардсан)
      if (err.code === '23505' && err.constraint?.includes('booking_code')) {
        continue;
      }
      throw err;
    }
  }
  throw new BookingError('CODE_COLLISION', 'Could not generate unique booking code', 500);
}

/**
 * Олон удаа оролдоод unique ticket_number үүсгэх
 */
async function createTicketRow(client, { bookingId, passengerId, flightId, classType, price, airlineIata, baggageKg }) {
  const year = new Date().getFullYear();
  for (let attempt = 0; attempt < 5; attempt++) {
    const ticketNo = generateTicketNumber(airlineIata, year);
    try {
      const { rows } = await client.query(
        `
        INSERT INTO tickets
          (ticket_number, booking_id, passenger_id, flight_id, class_type, price, baggage_kg, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'issued')
        RETURNING ticket_id, ticket_number
        `,
        [ticketNo, bookingId, passengerId, flightId, classType, price, baggageKg ?? 20]
      );
      return rows[0];
    } catch (err) {
      if (err.code === '23505' && err.constraint?.includes('ticket_number')) {
        continue;
      }
      // 23505 partial unique (passenger_id, flight_id, status='issued')
      if (err.code === '23505' && err.constraint?.includes('passenger_flight_issued')) {
        throw new BookingError(
          'DUPLICATE_TICKET',
          'Passenger already has an active ticket for this flight',
          409
        );
      }
      throw err;
    }
  }
  throw new BookingError('TICKET_CODE_COLLISION', 'Could not generate unique ticket number', 500);
}

/**
 * Үндсэн функц — захиалга үүсгэх
 *
 * @param {Object} input — Zod-аар validated body
 * @param {number|null} createdBy — Хэрэв ажилтан үүсгэсэн бол user_id
 * @returns {Promise<{booking_code, booking_id, total_amount, status, payment_deadline}>}
 */
export async function createBooking(input, createdBy = null) {
  return transaction(async (client) => {
    // -------------------------------------------------------
    // 1) Flights-уудыг LOCK хийх (FOR UPDATE)
    // -------------------------------------------------------
    const flightIds = [input.outbound_flight_id];
    if (input.return_flight_id) flightIds.push(input.return_flight_id);

    const { rows: flights } = await client.query(
      `
      SELECT f.flight_id, f.flight_number, f.status, f.departure_time,
             f.economy_price, f.business_price, f.first_price,
             f.available_seats,
             a.iata_code AS airline_iata
      FROM flights f
      JOIN airlines a ON a.airline_id = f.airline_id
      WHERE f.flight_id = ANY($1::bigint[])
      FOR UPDATE OF f
      `,
      [flightIds]
    );

    // Бүх flight олдсон эсэх
    if (flights.length !== flightIds.length) {
      throw new BookingError('FLIGHT_NOT_FOUND', 'One or more flights not found', 404);
    }

    // Эхлээгүй / cancelled нислэг хааж байгаа эсэх
    const now = new Date();
    for (const f of flights) {
      if (f.status === 'cancelled' || f.status === 'departed' || f.status === 'arrived') {
        throw new BookingError('FLIGHT_DEPARTED', `Flight ${f.flight_number} is no longer bookable`, 422);
      }
      if (new Date(f.departure_time) <= now) {
        throw new BookingError('FLIGHT_DEPARTED', `Flight ${f.flight_number} has already departed`, 422);
      }
      if (f.available_seats < input.passengers.length) {
        throw new BookingError('SEATS_UNAVAILABLE',
          `Only ${f.available_seats} seat(s) available on flight ${f.flight_number}`, 409);
      }
    }

    // Order map: outbound first, then return
    const flightById = Object.fromEntries(flights.map(f => [String(f.flight_id), f]));
    const outbound = flightById[String(input.outbound_flight_id)];
    const inbound = input.return_flight_id ? flightById[String(input.return_flight_id)] : null;

    // -------------------------------------------------------
    // 2) Total amount тооцох
    // -------------------------------------------------------
    const pricePerPaxOutbound = priceFor(outbound, input.class_type);
    const pricePerPaxInbound  = inbound ? priceFor(inbound, input.class_type) : 0;
    const totalAmount = (pricePerPaxOutbound + pricePerPaxInbound) * input.passengers.length;

    // -------------------------------------------------------
    // 3) SELECT-then-INSERT (phone is not UNIQUE in current schema)
    //    Ирээдүйд UNIQUE(phone) болгох эсвэл customer matching-г
    //    илүү ухаалаг болгох (нэр+утас, регистр)
    // -------------------------------------------------------
    const c = input.customer;
    let customerId;
    const { rows: existing } = await client.query(
      `SELECT customer_id FROM customers WHERE phone = $1 ORDER BY customer_id LIMIT 1`,
      [c.phone]
    );
    if (existing.length > 0) {
      customerId = existing[0].customer_id;
      // Шинэ мэдээллээр баяжуул
      await client.query(
        `
        UPDATE customers
           SET last_name  = $1,
               first_name = $2,
               email      = COALESCE(NULLIF($3, ''), email),
               updated_at = NOW()
         WHERE customer_id = $4
        `,
        [c.last_name, c.first_name, c.email || '', customerId]
      );
    } else {
      const { rows: inserted } = await client.query(
        `
        INSERT INTO customers (last_name, first_name, phone, email)
        VALUES ($1, $2, $3, NULLIF($4, ''))
        RETURNING customer_id
        `,
        [c.last_name, c.first_name, c.phone, c.email || '']
      );
      customerId = inserted[0].customer_id;
    }

    // -------------------------------------------------------
    // 4) INSERT booking (retry on booking_code collision)
    // -------------------------------------------------------
    const bookingRow = await createBookingRow(client, {
      customerId,
      createdBy,
      tripType: input.trip_type,
      totalPax: input.passengers.length,
      totalAmount,
      notes: input.notes,
      metadata: input.metadata
    });

    // -------------------------------------------------------
    // 5) INSERT passengers + tickets
    // -------------------------------------------------------
    const ticketSummaries = [];
    for (const p of input.passengers) {
      // 5a) passenger
      const { rows: paxRows } = await client.query(
        `
        INSERT INTO passengers
          (booking_id, last_name, first_name, passport_no, passport_expiry,
           birth_date, gender, nationality, passenger_type, meal_preference)
        VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, '')::date,
                $6, $7, $8, $9, $10)
        RETURNING passenger_id
        `,
        [bookingRow.booking_id, p.last_name, p.first_name,
         p.passport_no || '', p.passport_expiry || '',
         p.birth_date, p.gender, p.nationality, p.passenger_type, p.meal_preference || null]
      );
      const passengerId = paxRows[0].passenger_id;

      // 5b) tickets — outbound (+ inbound)
      const outboundTicket = await createTicketRow(client, {
        bookingId: bookingRow.booking_id,
        passengerId,
        flightId: outbound.flight_id,
        classType: input.class_type,
        price: pricePerPaxOutbound,
        airlineIata: outbound.airline_iata
      });
      ticketSummaries.push({ ticket_number: outboundTicket.ticket_number, leg: 'outbound' });

      if (inbound) {
        const inboundTicket = await createTicketRow(client, {
          bookingId: bookingRow.booking_id,
          passengerId,
          flightId: inbound.flight_id,
          classType: input.class_type,
          price: pricePerPaxInbound,
          airlineIata: inbound.airline_iata
        });
        ticketSummaries.push({ ticket_number: inboundTicket.ticket_number, leg: 'inbound' });
      }
    }

    // -------------------------------------------------------
    // 6) Хариу
    // -------------------------------------------------------
    const paymentDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 цаг

    return {
      booking_code: bookingRow.booking_code,
      booking_id: bookingRow.booking_id,
      status: 'pending',
      total_amount: totalAmount,
      currency: 'MNT',
      payment_deadline: paymentDeadline.toISOString(),
      payment_url: `/api/payments/qpay/invoice?booking_code=${bookingRow.booking_code}`,
      tickets: ticketSummaries
    };
  });
}

/**
 * Захиалга цуцлах
 *
 * Дүрэм (хялбар хувилбар Phase 1):
 *   - departure-аас 24+ цаг өмнө: 100% буцаалт
 *   - departure-аас 4-24 цаг өмнө: 50% буцаалт
 *   - departure-аас 4 цаг дотор: буцаалт байхгүй
 *
 * @param {string} bookingCode
 * @param {string?} reason
 */
export async function cancelBooking(bookingCode, reason = null) {
  return transaction(async (client) => {
    // 1) Захиалга lock хийх
    const { rows: bookingRows } = await client.query(
      `SELECT booking_id, status, total_amount, paid_amount FROM bookings WHERE booking_code = $1 FOR UPDATE`,
      [bookingCode]
    );
    if (bookingRows.length === 0) {
      throw new BookingError('NOT_FOUND', 'Booking not found', 404);
    }
    const booking = bookingRows[0];

    if (booking.status === 'cancelled' || booking.status === 'refunded') {
      throw new BookingError('ALREADY_CANCELLED', 'Booking is already cancelled', 409);
    }
    if (booking.status === 'completed') {
      throw new BookingError('ALREADY_COMPLETED', 'Cannot cancel a completed booking', 409);
    }

    // 2) Тийзний нислэг хамгийн эрт нь — refund policy дүрэм
    const { rows: ticketRows } = await client.query(
      `
      SELECT t.ticket_id, t.status, f.departure_time, t.price
      FROM tickets t
      JOIN flights f ON f.flight_id = t.flight_id
      WHERE t.booking_id = $1 AND t.status = 'issued'
      ORDER BY f.departure_time
      `,
      [booking.booking_id]
    );

    let refundPercent = 1.0;
    if (ticketRows.length > 0) {
      const firstDeparture = new Date(ticketRows[0].departure_time);
      const hoursToDeparture = (firstDeparture.getTime() - Date.now()) / 36e5;
      if      (hoursToDeparture >= 24) refundPercent = 1.0;
      else if (hoursToDeparture >= 4)  refundPercent = 0.5;
      else                              refundPercent = 0.0;
    }

    const paidAmount = Number(booking.paid_amount);
    const totalAmount = Number(booking.total_amount);
    const refundAmount = Math.round(paidAmount * refundPercent);
    const cancellationFee = paidAmount - refundAmount;

    // 3) Тийзнүүдийг cancel (trigger автомат suudал +1)
    await client.query(
      `UPDATE tickets SET status='cancelled' WHERE booking_id=$1 AND status='issued'`,
      [booking.booking_id]
    );

    // 4) Захиалга cancel
    await client.query(
      `
      UPDATE bookings
         SET status = 'cancelled',
             notes  = COALESCE(notes, '') || CASE WHEN $2 IS NOT NULL THEN E'\nCancelled: ' || $2 ELSE '' END,
             updated_at = NOW()
       WHERE booking_id = $1
      `,
      [booking.booking_id, reason]
    );

    return {
      booking_code: bookingCode,
      status: 'cancelled',
      total_amount: totalAmount,
      paid_amount: paidAmount,
      refund_amount: refundAmount,
      cancellation_fee: cancellationFee,
      currency: 'MNT'
    };
  });
}

/**
 * Захиалгын дэлгэрэнгүй
 */
export async function getBookingByCode(bookingCode) {
  const { rows: bookings } = await query(
    `SELECT * FROM v_booking_details WHERE booking_code = $1`,
    [bookingCode]
  );
  if (bookings.length === 0) return null;

  const booking = bookings[0];

  // passengers
  const { rows: passengers } = await query(
    `
    SELECT passenger_id, last_name, first_name, passport_no, passport_expiry,
           birth_date, gender, nationality, passenger_type, meal_preference
    FROM passengers
    WHERE booking_id = $1
    ORDER BY passenger_id
    `,
    [booking.booking_id]
  );

  // tickets — flight info-той хамт
  const { rows: tickets } = await query(
    `
    SELECT t.ticket_id, t.ticket_number, t.passenger_id, t.flight_id,
           t.class_type, t.price, t.baggage_kg, t.status, t.issued_at,
           f.flight_number, f.departure_time, f.arrival_time,
           f.origin_airport_id, oa.iata_code AS origin_code, oa.city AS origin_city,
           f.destination_airport_id, da.iata_code AS dest_code, da.city AS dest_city,
           f.airline_id, al.iata_code AS airline_code, al.name AS airline_name
    FROM tickets t
    JOIN flights  f  ON f.flight_id  = t.flight_id
    JOIN airports oa ON oa.airport_id = f.origin_airport_id
    JOIN airports da ON da.airport_id = f.destination_airport_id
    JOIN airlines al ON al.airline_id = f.airline_id
    WHERE t.booking_id = $1
    ORDER BY f.departure_time
    `,
    [booking.booking_id]
  );

  // payments
  const { rows: payments } = await query(
    `
    SELECT payment_id, amount, currency, payment_method, transaction_no, status, paid_at
    FROM payments
    WHERE booking_id = $1
    ORDER BY paid_at DESC
    `,
    [booking.booking_id]
  );

  return {
    booking_code:    booking.booking_code,
    status:          booking.booking_status,
    trip_type:       booking.trip_type,
    customer: {
      customer_id: booking.customer_id,
      name:        booking.customer_name,
      phone:       booking.customer_phone,
      email:       booking.customer_email
    },
    total_passengers: Number(booking.total_passengers),
    total_amount:     Number(booking.total_amount),
    paid_amount:      Number(booking.paid_amount),
    balance_due:      Number(booking.balance_due),
    currency:         'MNT',
    agent_name:       booking.agent_name,
    metadata:         booking.metadata,
    passengers: passengers.map(p => ({
      ...p,
      price: undefined
    })),
    tickets: tickets.map(t => ({
      ticket_number: t.ticket_number,
      passenger_id:  t.passenger_id,
      class_type:    t.class_type,
      price:         Number(t.price),
      baggage_kg:    t.baggage_kg,
      status:        t.status,
      issued_at:     t.issued_at,
      flight: {
        flight_id:        t.flight_id,
        flight_number:    t.flight_number,
        airline:          { code: t.airline_code, name: t.airline_name },
        origin:           { code: t.origin_code, city: t.origin_city },
        destination:      { code: t.dest_code,   city: t.dest_city },
        departure_time:   t.departure_time,
        arrival_time:     t.arrival_time
      }
    })),
    payments: payments.map(p => ({
      payment_id:     p.payment_id,
      amount:         Number(p.amount),
      currency:       p.currency,
      payment_method: p.payment_method,
      transaction_no: p.transaction_no,
      status:         p.status,
      paid_at:        p.paid_at
    })),
    created_at: booking.created_at,
    updated_at: booking.updated_at
  };
}

export { BookingError };
