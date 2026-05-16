/**
 * code.test.js — utils/code.js (booking/ticket код генератор)
 * Хамаарал байхгүй (node:crypto л) тул DB-гүй ажиллана.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateBookingCode, generateTicketNumber } from '../src/utils/code.js';

test('generateBookingCode: AG + 5 чар, нийт 7', () => {
  const code = generateBookingCode();
  assert.match(code, /^AG[A-Z0-9]{5}$/);
  assert.equal(code.length, 7);
});

test('generateBookingCode: будлиантай тэмдэг (I,O,0,1) ороогүй', () => {
  for (let n = 0; n < 500; n++) {
    const c = generateBookingCode().slice(2); // AG-аас хойш
    assert.ok(!/[IO01]/.test(c), `Будлиантай тэмдэг: ${c}`);
  }
});

test('generateBookingCode: 2000 удаа давталтанд давхардал бараг алга', () => {
  const set = new Set();
  for (let n = 0; n < 2000; n++) set.add(generateBookingCode());
  // 32^5 ≈ 33M орон зай — 2000-д бараг бүгд unique
  assert.ok(set.size >= 1999, `Хэт олон давхардал: ${2000 - set.size}`);
});

test('generateTicketNumber: {IATA}-{year}-{4 цифр}', () => {
  const t = generateTicketNumber('OM', 2026);
  assert.match(t, /^OM-2026-\d{4}$/);
});

test('generateTicketNumber: default year = одоогийн он', () => {
  const y = new Date().getFullYear();
  const t = generateTicketNumber('KE');
  assert.match(t, new RegExp(`^KE-${y}-\\d{4}$`));
});
