/* ============================================================
 * api.js — Backend API дуудлагын wrapper
 *   - timeout 15 секунд
 *   - JSON хариу автомат parse
 *   - Алдааны мэдээллийг нэг тогтсон форматтай болгоно
 * ============================================================ */

import { API_BASE } from './config.js';

class ApiError extends Error {
  constructor(message, code, status, details) {
    super(message);
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

async function request(path, { method = 'GET', body, timeout = 15000 } = {}) {
  const url = `${API_BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal
    });

    const isJson = res.headers.get('content-type')?.includes('application/json');
    const payload = isJson ? await res.json() : null;

    if (!res.ok) {
      const err = payload?.error ?? {};
      throw new ApiError(
        err.message || `HTTP ${res.status}`,
        err.code || 'HTTP_ERROR',
        res.status,
        err.details
      );
    }
    return payload;
  } catch (e) {
    if (e.name === 'AbortError') {
      throw new ApiError('Хүсэлт хэт удаан үргэлжилсэн (timeout)', 'TIMEOUT', 0);
    }
    if (e instanceof ApiError) throw e;
    throw new ApiError(e.message || 'Network алдаа', 'NETWORK_ERROR', 0);
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  airports: (q, limit = 8) =>
    request(`/airports?q=${encodeURIComponent(q)}&limit=${limit}`),

  airlines: () => request('/airlines'),

  searchFlights: ({ from, to, departure_date, return_date, passengers = 1 }) => {
    const params = new URLSearchParams({ from, to, departure_date, passengers });
    if (return_date) params.set('return_date', return_date);
    return request(`/flights/search?${params}`);
  },

  flight: (id) => request(`/flights/${id}`),

  createBooking: (body) => request('/bookings', { method: 'POST', body }),
  getBooking: (code) => request(`/bookings/${code}`),
  cancelBooking: (code, reason) =>
    request(`/bookings/${code}/cancel`, { method: 'POST', body: { reason } })
};

export { ApiError };
