/**
 * db.js — PostgreSQL connection pool
 *
 * Бүх query энэ pool-аар явна. Transaction-ы үед `pool.connect()`-ээр
 * client авч BEGIN/COMMIT хийнэ.
 *
 * Жишээ:
 *   import { pool, query } from './db.js';
 *   const { rows } = await query('SELECT * FROM airports WHERE iata_code = $1', ['ULN']);
 */

import pg from 'pg';
import { config } from './config.js';

/** PostgreSQL connection pool */
export const pool = new pg.Pool({
  connectionString: config.db.url,
  max: config.db.poolMax,
  idleTimeoutMillis: config.db.idleTimeout,
  // Production-д SSL заавал
  ssl: config.isProduction ? { rejectUnauthorized: false } : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle client', err);
});

/**
 * Parameterized query — XSS/SQL injection-эс хамгаалагдсан
 * @param {string} text — SQL хүсэлт, $1, $2 placeholders
 * @param {Array} params — placeholders-ийн утга
 */
export async function query(text, params) {
  const start = Date.now();
  const result = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 200) {
    console.warn(`[slow query ${duration}ms]`, text);
  }
  return result;
}

/**
 * Health check — DB холбогдсон эсэхийг шалгана
 * @returns {Promise<boolean>}
 */
export async function checkDbHealth() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch {
    return false;
  }
}

/**
 * Transaction helper — BEGIN/COMMIT/ROLLBACK автоматаар хийнэ
 *
 * Хэрэглэх:
 *   const result = await transaction(async (client) => {
 *     await client.query('SELECT ... FOR UPDATE', [id]);
 *     await client.query('INSERT INTO ...');
 *     return { ok: true };
 *   });
 *
 * Алдаа гарвал автоматаар ROLLBACK хийгээд error-г re-throw хийнэ.
 */
export async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try { await client.query('ROLLBACK'); } catch (_) { /* swallow */ }
    throw err;
  } finally {
    client.release();
  }
}

/** Graceful shutdown — pool дуусгана */
export async function closeDb() {
  await pool.end();
}
