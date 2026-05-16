/**
 * utils/crypto.js — Нууц үг hash, JWT sign/verify
 *
 * - bcrypt: нууц үг (cost config-оос)
 * - jose:   JWT (HS256, JWT_SECRET-ээр)
 */

import bcrypt from 'bcrypt';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';

const secret = new TextEncoder().encode(config.auth.jwtSecret);

/** Нууц үгийг hash-тай тулгах */
export function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

/** Шинэ нууц үг hash хийх (admin user CRUD-д хэрэгтэй) */
export function hashPassword(plain) {
  return bcrypt.hash(plain, config.auth.bcryptCost);
}

/**
 * JWT гаргах
 * @param {object} payload — { sub, username, role }
 * @param {number} ttlSeconds
 * @param {'access'|'refresh'} type
 */
export async function signToken(payload, ttlSeconds, type = 'access') {
  return new SignJWT({ ...payload, typ: type })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret);
}

/**
 * JWT шалгах. Алдаатай бол throw.
 * @returns {Promise<object>} payload
 */
export async function verifyToken(token) {
  const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
  return payload;
}
