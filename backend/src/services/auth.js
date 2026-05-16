/**
 * services/auth.js — Нэвтрэх логик
 *
 * login()   — username/password шалгаж access+refresh token гаргана
 * refresh() — refresh token-оор шинэ access token
 *
 * Login attempt-ийг audit_log-д бичнэ (амжилт/амжилтгүй).
 */

import { query } from '../db.js';
import { verifyPassword, signToken, verifyToken } from '../utils/crypto.js';
import { config } from '../config.js';

class AuthError extends Error {
  constructor(code, message, statusCode = 401) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

/** audit_log-д login оролдлого бичих (PII-гүй) */
async function logAttempt(username, success, userId, ip, ua) {
  try {
    await query(
      `INSERT INTO audit_log (table_name, record_id, action, user_id, new_data, ip_address, user_agent)
       VALUES ('users', $1, 'UPDATE', $2, $3, $4, $5)`,
      [
        userId ?? 0,
        userId ?? null,
        JSON.stringify({ event: success ? 'login_success' : 'login_failed', username }),
        ip ?? null,
        ua ?? null
      ]
    );
  } catch (_) { /* audit-ийн алдаа login-г блоклохгүй */ }
}

/**
 * Нэвтрэх
 * @returns {Promise<{access_token, refresh_token, expires_in, user}>}
 */
export async function login(username, password, ctx = {}) {
  const { rows } = await query(
    `SELECT user_id, username, password_hash, full_name, email, role, is_active
     FROM users WHERE username = $1`,
    [username]
  );

  const user = rows[0];
  if (!user) {
    await logAttempt(username, false, null, ctx.ip, ctx.ua);
    throw new AuthError('INVALID_CREDENTIALS', 'Нэр эсвэл нууц үг буруу');
  }
  if (!user.is_active) {
    await logAttempt(username, false, user.user_id, ctx.ip, ctx.ua);
    throw new AuthError('ACCOUNT_DISABLED', 'Бүртгэл идэвхгүй байна', 403);
  }

  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) {
    await logAttempt(username, false, user.user_id, ctx.ip, ctx.ua);
    throw new AuthError('INVALID_CREDENTIALS', 'Нэр эсвэл нууц үг буруу');
  }

  // last_login_at шинэчлэх
  await query(`UPDATE users SET last_login_at = NOW() WHERE user_id = $1`, [user.user_id]);
  await logAttempt(username, true, user.user_id, ctx.ip, ctx.ua);

  const claims = { sub: String(user.user_id), username: user.username, role: user.role };
  const access = await signToken(claims, config.auth.accessTtl, 'access');
  const refresh = await signToken(claims, config.auth.refreshTtl, 'refresh');

  return {
    access_token: access,
    refresh_token: refresh,
    expires_in: config.auth.accessTtl,
    user: {
      user_id: user.user_id,
      username: user.username,
      full_name: user.full_name,
      email: user.email,
      role: user.role
    }
  };
}

/** Refresh token-оор шинэ access token */
export async function refresh(refreshToken) {
  let payload;
  try {
    payload = await verifyToken(refreshToken);
  } catch {
    throw new AuthError('INVALID_TOKEN', 'Refresh token хүчингүй');
  }
  if (payload.typ !== 'refresh') {
    throw new AuthError('INVALID_TOKEN', 'Энэ нь refresh token биш');
  }

  // User идэвхтэй хэвээр эсэхийг шалгах
  const { rows } = await query(
    `SELECT user_id, username, role, is_active FROM users WHERE user_id = $1`,
    [payload.sub]
  );
  const user = rows[0];
  if (!user || !user.is_active) {
    throw new AuthError('ACCOUNT_DISABLED', 'Бүртгэл идэвхгүй', 403);
  }

  const claims = { sub: String(user.user_id), username: user.username, role: user.role };
  const access = await signToken(claims, config.auth.accessTtl, 'access');
  return { access_token: access, expires_in: config.auth.accessTtl };
}

export { AuthError };
