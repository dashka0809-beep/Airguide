/**
 * services/search.js — Chatbot tool-уудад зориулсан хайлтын функцууд
 *
 * Token хэмнэхийн тулд compact (товч) өгөгдөл буцаана — бүтэн объект биш.
 * routes/flights.js, routes/airports.js-тэй ижил SQL ашиглана.
 */

import { query } from '../db.js';

/**
 * Монгол (Кирилл) хот → DB-н Англи нэр/IATA. Загвар андуурахаас
 * сэргийлэх deterministic давхарга. Жижиг үсгээр харьцуулна.
 */
const MN_CITY_ALIAS = {
  'улаанбаатар': 'ULN', 'уб': 'ULN', 'ulaanbaatar': 'ULN',
  'сөүл': 'ICN', 'соул': 'ICN', 'сеул': 'ICN', 'seoul': 'ICN',
  'бээжин': 'PEK', 'пекин': 'PEK', 'beijing': 'PEK',
  'токио': 'NRT', 'токьё': 'NRT', 'tokyo': 'NRT',
  'бангкок': 'BKK', 'банкок': 'BKK', 'bangkok': 'BKK',
  'гонконг': 'HKG', 'хонконг': 'HKG', 'hong kong': 'HKG',
  'стамбул': 'IST', 'истанбул': 'IST', 'istanbul': 'IST',
  'франкфурт': 'FRA', 'frankfurt': 'FRA',
  'дубай': 'DXB', 'dubai': 'DXB',
  'сингапур': 'SIN', 'singapore': 'SIN',
  'москва': 'SVO', 'moscow': 'SVO',
  'ховд': 'HVD', 'khovd': 'HVD',
  'мөрөн': 'MXV', 'мурэн': 'MXV', 'murun': 'MXV',
  'хөххот': 'HET', 'хөх хот': 'HET', 'hohhot': 'HET',
  'астана': 'AST', 'astana': 'AST'
};

/** Нисэх буудал хайх. Кирилл/Монгол нэрийг эхлээд alias-аар шийднэ. */
export async function searchAirports(q) {
  const norm = String(q || '').trim().toLowerCase();
  const aliasCode = MN_CITY_ALIAS[norm];
  if (aliasCode) {
    // Alias олдвол IATA-аар нь шууд буудлуудыг буцаана
    const { rows } = await query(
      `SELECT iata_code, city, country, name FROM airports
       WHERE iata_code = $1`,
      [aliasCode]
    );
    if (rows.length) {
      return rows.map(r => ({
        iata: r.iata_code, city: r.city, country: r.country, name: r.name
      }));
    }
  }
  const { rows } = await query(
    `
    SELECT iata_code, city, country, name
    FROM airports
    WHERE iata_code ILIKE $1 || '%'
       OR city      ILIKE $1 || '%'
       OR city      ILIKE '%' || $1 || '%'
       OR name      ILIKE '%' || $1 || '%'
       OR similarity(city, $1) > 0.15
    ORDER BY
      GREATEST(
        CASE WHEN UPPER(iata_code) = UPPER($1) THEN 1.0 ELSE 0 END,
        CASE WHEN city ILIKE $1 || '%'         THEN 0.8 ELSE 0 END,
        similarity(city, $1)
      ) DESC,
      city ASC
    LIMIT 6
    `,
    [q]
  );
  return rows.map(r => ({
    iata: r.iata_code, city: r.city, country: r.country, name: r.name
  }));
}

/** Нислэг хайх — нэг чиглэл, нэг өдөр. Дээд тал нь 8 нислэг. */
export async function searchFlights({ from, to, departure_date }) {
  const { rows } = await query(
    `
    SELECT flight_number, airline_code, airline_name,
           origin_code, origin_city, dest_code, dest_city,
           departure_time, arrival_time, duration_minutes,
           economy_price, business_price, available_seats, status
    FROM v_flight_details
    WHERE origin_code = $1
      AND dest_code   = $2
      AND departure_time::date = $3::date
      AND status = 'scheduled'
    ORDER BY economy_price ASC, departure_time ASC
    LIMIT 8
    `,
    [String(from).toUpperCase(), String(to).toUpperCase(), departure_date]
  );
  return rows.map(r => ({
    flight: r.flight_number,
    airline: `${r.airline_code} ${r.airline_name}`,
    route: `${r.origin_code} ${r.origin_city} → ${r.dest_code} ${r.dest_city}`,
    depart: r.departure_time,
    arrive: r.arrival_time,
    duration_min: r.duration_minutes,
    economy_mnt: r.economy_price !== null ? Number(r.economy_price) : null,
    business_mnt: r.business_price !== null ? Number(r.business_price) : null,
    seats_left: r.available_seats
  }));
}
