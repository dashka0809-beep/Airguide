/**
 * utils/code.js — Booking code, ticket number generator
 *
 * Booking code: "AG" + 5 random чар (no I/0/O/1 хольгүй)
 * Ticket number: "{airline_iata}-{YYYY}-{4 digit random}"
 */

import { randomInt } from 'node:crypto';

// I/1, O/0 — confusion-аас зайлсхийсэн алфавит
const SAFE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DIGITS = '0123456789';

/** "AG" + 5 random чар, нийт 7 чар */
export function generateBookingCode() {
  let code = 'AG';
  for (let i = 0; i < 5; i++) {
    code += SAFE_CHARS[randomInt(0, SAFE_CHARS.length)];
  }
  return code;
}

/**
 * "{iata}-{year}-{4digit}" — MN өргөлзний билет
 * Жишээ: "OM-2026-4729"
 */
export function generateTicketNumber(airlineIata, year = new Date().getFullYear()) {
  let num = '';
  for (let i = 0; i < 4; i++) {
    num += DIGITS[randomInt(0, DIGITS.length)];
  }
  return `${airlineIata}-${year}-${num}`;
}
