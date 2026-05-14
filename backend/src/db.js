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

/** Graceful shutdown — pool дуусгана */
export async function closeDb() {
  await pool.end();
}
