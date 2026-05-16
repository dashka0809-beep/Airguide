/**
 * services/admin.js — Admin бизнес логик
 *
 * - audit() — audit_log-д өөрчлөлт бичих helper
 * - listBookings / refundBooking
 * - listFlights / createFlight / updateFlight
 * - revenueReport
 */

import { query } from '../db.js';

class AdminError extends Error {
  constructor(code, message, statusCode = 422) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** audit_log-д бичих (алдаа гарвал үндсэн үйлдлийг блоклохгүй) */
export async function audit({ table, recordId, action, userId, oldData, newData, ip, ua }) {
  try {
    await query(
      `INSERT INTO audit_log
         (table_name, record_id, action, user_id, old_data, new_data, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        table, recordId, action, userId ?? null,
        oldData ? JSON.stringify(oldData) : null,
        newData ? JSON.stringify(newData) : null,
        ip ?? null, ua ?? null
      ]
    );
  } catch (e) {
    console.error('[audit] failed:', e.message);
  }
}

// ============================================================
// Bookings
// ============================================================
export async function listBookings(f) {
  const where = [];
  const params = [];
  let i = 1;
  if (f.status)      { where.push(`booking_status = $${i++}`); params.push(f.status); }
  if (f.from)        { where.push(`booking_date >= $${i++}::date`); params.push(f.from); }
  if (f.to)          { where.push(`booking_date < ($${i++}::date + 1)`); params.push(f.to); }
  if (f.customer_id) { where.push(`customer_id = $${i++}`); params.push(f.customer_id); }
  if (f.q)           { where.push(`(booking_code ILIKE $${i} OR customer_name ILIKE $${i} OR customer_phone ILIKE $${i})`); params.push(`%${f.q}%`); i++; }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (f.page - 1) * f.limit;

  const { rows: countRows } = await query(
    `SELECT COUNT(*)::int AS total FROM v_booking_details ${whereSql}`, params
  );
  const total = countRows[0].total;

  const { rows } = await query(
    `SELECT booking_id, booking_code, booking_date, booking_status, trip_type,
            customer_id, customer_name, customer_phone, customer_email,
            total_passengers, total_amount, paid_amount, balance_due,
            agent_name, created_at
     FROM v_booking_details ${whereSql}
     ORDER BY booking_date DESC
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, f.limit, offset]
  );

  return {
    data: rows.map(r => ({
      ...r,
      total_amount: Number(r.total_amount),
      paid_amount: Number(r.paid_amount),
      balance_due: Number(r.balance_due)
    })),
    meta: { total, page: f.page, limit: f.limit, pages: Math.ceil(total / f.limit) }
  };
}

/** Захиалгыг буцаах (refund) — payments-ийг refunded болгоно */
export async function refundBooking(bookingId, reason, actor) {
  const { rows } = await query(
    `SELECT booking_id, booking_code, status, paid_amount FROM bookings WHERE booking_id = $1`,
    [bookingId]
  );
  const b = rows[0];
  if (!b) throw new AdminError('NOT_FOUND', 'Захиалга олдсонгүй', 404);
  if (b.status === 'refunded') throw new AdminError('ALREADY_REFUNDED', 'Аль хэдийн буцаагдсан', 409);

  // success төлбөрүүдийг refunded болгоно (trigger paid_amount буулгана)
  await query(
    `UPDATE payments SET status='refunded' WHERE booking_id=$1 AND status='success'`,
    [bookingId]
  );
  // тийзүүдийг refunded (trigger suudal +1)
  await query(
    `UPDATE tickets SET status='refunded' WHERE booking_id=$1 AND status='issued'`,
    [bookingId]
  );
  await query(
    `UPDATE bookings
        SET status='refunded',
            notes = COALESCE(notes,'') || COALESCE(E'\nRefund: ' || $2::text, ''),
            updated_at=NOW()
      WHERE booking_id=$1`,
    [bookingId, reason]
  );

  await audit({
    table: 'bookings', recordId: bookingId, action: 'UPDATE',
    userId: actor.userId,
    oldData: { status: b.status, paid_amount: b.paid_amount },
    newData: { status: 'refunded', reason },
    ip: actor.ip, ua: actor.ua
  });

  const { rows: after } = await query(
    `SELECT booking_code, status, total_amount, paid_amount FROM bookings WHERE booking_id=$1`,
    [bookingId]
  );
  return {
    booking_code: after[0].booking_code,
    status: after[0].status,
    total_amount: Number(after[0].total_amount),
    paid_amount: Number(after[0].paid_amount)
  };
}

// ============================================================
// Flights
// ============================================================
export async function listFlights(f) {
  const where = [];
  const params = [];
  let i = 1;
  if (f.from)   { where.push(`origin_code = $${i++}`); params.push(f.from.toUpperCase()); }
  if (f.to)     { where.push(`dest_code = $${i++}`); params.push(f.to.toUpperCase()); }
  if (f.status) { where.push(`status = $${i++}`); params.push(f.status); }
  if (f.date)   { where.push(`departure_time::date = $${i++}::date`); params.push(f.date); }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (f.page - 1) * f.limit;

  const { rows: c } = await query(
    `SELECT COUNT(*)::int AS total FROM v_flight_details ${whereSql}`, params
  );
  const { rows } = await query(
    `SELECT flight_id, flight_number, airline_code, airline_name,
            origin_code, origin_city, dest_code, dest_city,
            departure_time, arrival_time, duration_minutes,
            economy_price, business_price, first_price,
            available_seats, status
     FROM v_flight_details ${whereSql}
     ORDER BY departure_time
     LIMIT $${i++} OFFSET $${i++}`,
    [...params, f.limit, offset]
  );
  return {
    data: rows.map(r => ({
      ...r,
      economy_price: r.economy_price !== null ? Number(r.economy_price) : null,
      business_price: r.business_price !== null ? Number(r.business_price) : null,
      first_price: r.first_price !== null ? Number(r.first_price) : null
    })),
    meta: { total: c[0].total, page: f.page, limit: f.limit, pages: Math.ceil(c[0].total / f.limit) }
  };
}

export async function createFlight(body, actor) {
  const { rows } = await query(
    `INSERT INTO flights
       (flight_number, airline_id, aircraft_id, origin_airport_id, destination_airport_id,
        departure_time, arrival_time, duration_minutes,
        economy_price, business_price, first_price, available_seats, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
     RETURNING flight_id`,
    [
      body.flight_number, body.airline_id, body.aircraft_id ?? null,
      body.origin_airport_id, body.destination_airport_id,
      body.departure_time, body.arrival_time, body.duration_minutes,
      body.economy_price, body.business_price ?? null, body.first_price ?? null,
      body.available_seats, body.status
    ]
  );
  const id = rows[0].flight_id;
  await audit({
    table: 'flights', recordId: id, action: 'INSERT',
    userId: actor.userId, newData: body, ip: actor.ip, ua: actor.ua
  });
  return { flight_id: id };
}

export async function updateFlight(id, patch, actor) {
  const { rows: before } = await query(`SELECT * FROM flights WHERE flight_id=$1`, [id]);
  if (!before[0]) throw new AdminError('NOT_FOUND', 'Нислэг олдсонгүй', 404);

  const cols = [];
  const params = [];
  let i = 1;
  for (const [k, v] of Object.entries(patch)) {
    cols.push(`${k} = $${i++}`);
    params.push(v);
  }
  params.push(id);
  await query(
    `UPDATE flights SET ${cols.join(', ')}, updated_at=NOW() WHERE flight_id=$${i}`,
    params
  );
  await audit({
    table: 'flights', recordId: id, action: 'UPDATE',
    userId: actor.userId,
    oldData: Object.fromEntries(Object.keys(patch).map(k => [k, before[0][k]])),
    newData: patch, ip: actor.ip, ua: actor.ua
  });
  return { flight_id: id, updated: Object.keys(patch) };
}

// ============================================================
// Reports
// ============================================================
export async function revenueReport(f) {
  // payments-ийн alias-гүй болон p. alias-тай хувилбар тус тусдаа build
  const parts = [`{p}status='success'`];
  const params = [];
  let i = 1;
  if (f.period) {
    parts.push(`to_char({p}paid_at,'YYYY-MM') = $${i++}`);
    params.push(f.period);
  } else {
    if (f.from) { parts.push(`{p}paid_at >= $${i++}::date`); params.push(f.from); }
    if (f.to)   { parts.push(`{p}paid_at < ($${i++}::date + 1)`); params.push(f.to); }
  }
  const whereBare = parts.map(s => s.replace(/\{p\}/g, '')).join(' AND ');
  const wherePfx  = parts.map(s => s.replace(/\{p\}/g, 'p.')).join(' AND ');

  const { rows: totalRows } = await query(
    `SELECT COALESCE(SUM(amount),0)::numeric AS revenue, COUNT(*)::int AS cnt
     FROM payments WHERE ${whereBare}`, params
  );

  const { rows: byMonth } = await query(
    `SELECT to_char(paid_at,'YYYY-MM') AS month,
            SUM(amount)::numeric AS revenue, COUNT(*)::int AS cnt
     FROM payments WHERE ${whereBare}
     GROUP BY 1 ORDER BY 1 DESC LIMIT 12`, params
  );

  const { rows: byAirline } = await query(
    `SELECT al.iata_code AS airline, al.name AS airline_name,
            SUM(p.amount)::numeric AS revenue, COUNT(DISTINCT p.booking_id)::int AS bookings
     FROM payments p
     JOIN tickets t  ON t.booking_id = p.booking_id
     JOIN flights f  ON f.flight_id = t.flight_id
     JOIN airlines al ON al.airline_id = f.airline_id
     WHERE ${wherePfx}
     GROUP BY 1,2 ORDER BY 3 DESC LIMIT 10`,
    params
  );

  return {
    period: f.period || (f.from ? `${f.from}..${f.to || 'now'}` : 'all'),
    total_revenue: Number(totalRows[0].revenue),
    payment_count: totalRows[0].cnt,
    by_month: byMonth.map(r => ({ month: r.month, revenue: Number(r.revenue), count: r.cnt })),
    by_airline: byAirline.map(r => ({
      airline: r.airline, airline_name: r.airline_name,
      revenue: Number(r.revenue), bookings: r.bookings
    }))
  };
}

export { AdminError };
