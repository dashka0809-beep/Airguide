/**
 * schemas.test.js — Zod schema validation
 * Pure (config-гүй) тул DB-гүй ажиллана.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { flightSearchQuerySchema, flightIdParamSchema } from '../src/schemas/flight.js';
import { createBookingBodySchema } from '../src/schemas/booking.js';
import { loginBodySchema } from '../src/schemas/auth.js';
import { airportSearchQuerySchema } from '../src/schemas/airport.js';

// ----- flight search -----
test('flightSearch: зөв утга → pass, IATA том үсэг рүү', () => {
  const r = flightSearchQuerySchema.parse({ from: 'uln', to: 'icn', departure_date: '2026-06-15' });
  assert.equal(r.from, 'ULN');
  assert.equal(r.to, 'ICN');
  assert.equal(r.passengers, 1);
});

test('flightSearch: from == to → алдаа', () => {
  assert.throws(() =>
    flightSearchQuerySchema.parse({ from: 'ULN', to: 'ULN', departure_date: '2026-06-15' }));
});

test('flightSearch: буруу огнооны формат → алдаа', () => {
  assert.throws(() =>
    flightSearchQuerySchema.parse({ from: 'ULN', to: 'ICN', departure_date: '15-06-2026' }));
});

test('flightSearch: return_date < departure_date → алдаа', () => {
  assert.throws(() => flightSearchQuerySchema.parse({
    from: 'ULN', to: 'ICN', departure_date: '2026-06-15', return_date: '2026-06-10'
  }));
});

test('flightIdParam: тоо болгож хувиргана', () => {
  assert.equal(flightIdParamSchema.parse({ id: '42' }).id, 42);
  assert.throws(() => flightIdParamSchema.parse({ id: 'abc' }));
});

// ----- booking -----
const validBooking = {
  trip_type: 'one_way',
  outbound_flight_id: 1,
  class_type: 'economy',
  customer: { last_name: 'Test', first_name: 'User', phone: '99001122', email: '' },
  passengers: [{ last_name: 'Test', first_name: 'User', birth_date: '1990-01-01', gender: 'M' }]
};

test('createBooking: зөв body → pass', () => {
  const r = createBookingBodySchema.parse(structuredClone(validBooking));
  assert.equal(r.passengers.length, 1);
  assert.equal(r.passengers[0].passenger_type, 'adult'); // default
});

test('createBooking: round_trip-д return_flight_id заавал', () => {
  const b = structuredClone(validBooking);
  b.trip_type = 'round_trip';
  assert.throws(() => createBookingBodySchema.parse(b));
});

test('createBooking: зорчигчгүй → алдаа', () => {
  const b = structuredClone(validBooking);
  b.passengers = [];
  assert.throws(() => createBookingBodySchema.parse(b));
});

test('createBooking: буруу утасны формат → алдаа', () => {
  const b = structuredClone(validBooking);
  b.customer.phone = 'abc';
  assert.throws(() => createBookingBodySchema.parse(b));
});

// ----- auth -----
test('login: зөв → pass; хоосон → алдаа', () => {
  assert.deepEqual(
    loginBodySchema.parse({ username: 'admin', password: 'x' }),
    { username: 'admin', password: 'x' }
  );
  assert.throws(() => loginBodySchema.parse({ username: '', password: '' }));
});

// ----- airport -----
test('airportSearch: q заавал, limit default 10', () => {
  const r = airportSearchQuerySchema.parse({ q: 'ulan' });
  assert.equal(r.limit, 10);
  assert.throws(() => airportSearchQuerySchema.parse({ q: '' }));
});
