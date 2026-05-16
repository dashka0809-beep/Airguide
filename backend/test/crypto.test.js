/**
 * crypto.test.js — utils/crypto.js (bcrypt + JWT)
 *
 * crypto.js нь config.js-г import хийдэг (DATABASE_URL шаардана).
 * Тиймээс dummy env-г static import-оос ӨМНӨ тохируулж,
 * crypto.js-г dynamic import-оор ачаална.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

// config.js-ийн Zod parse-г хангах dummy env (бодит холболт хийхгүй)
process.env.DATABASE_URL ||= 'postgresql://test:test@localhost:5432/testdb';
process.env.JWT_SECRET   ||= 'unit_test_secret_min_32_chars_xxxxxxxxxx';

const { hashPassword, verifyPassword, signToken, verifyToken } =
  await import('../src/utils/crypto.js');

test('bcrypt: hash → verify round trip', async () => {
  const hash = await hashPassword('S3cret!');
  assert.match(hash, /^\$2[aby]\$\d{2}\$/);
  assert.equal(await verifyPassword('S3cret!', hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('JWT: sign → verify, payload хадгалагдана', async () => {
  const token = await signToken({ sub: '1', username: 'admin', role: 'admin' }, 900, 'access');
  const payload = await verifyToken(token);
  assert.equal(payload.sub, '1');
  assert.equal(payload.username, 'admin');
  assert.equal(payload.role, 'admin');
  assert.equal(payload.typ, 'access');
  assert.ok(payload.exp > payload.iat);
});

test('JWT: гажуудуулсан token → verify алдаа', async () => {
  const token = await signToken({ sub: '1' }, 900);
  const tampered = token.slice(0, -3) + 'AAA';
  await assert.rejects(() => verifyToken(tampered));
});

test('JWT: хугацаа дууссан token → verify алдаа', async () => {
  const expired = await signToken({ sub: '1' }, -10); // 10с өмнө дуссан
  await assert.rejects(() => verifyToken(expired));
});

test('JWT: refresh typ ялгаатай', async () => {
  const r = await verifyToken(await signToken({ sub: '2' }, 900, 'refresh'));
  assert.equal(r.typ, 'refresh');
});
