/* ============================================================
 * admin/js/core.js — Admin panel-ийн shared logic
 *   - Session (token) localStorage-д
 *   - adminApi() — Bearer token-той fetch, 401 → login
 *   - requireAuth() — token шалгах, байхгүй бол login руу
 *   - renderShell() — sidebar nav (role-аар)
 * ============================================================ */

export const API_BASE = 'https://airguide-production-ec87.up.railway.app/api';

const TOKEN_KEY   = 'airguide:admin:token';
const REFRESH_KEY = 'airguide:admin:refresh';
const USER_KEY    = 'airguide:admin:user';

export function saveSession({ access_token, refresh_token, user }) {
  localStorage.setItem(TOKEN_KEY, access_token);
  if (refresh_token) localStorage.setItem(REFRESH_KEY, refresh_token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}
export function getToken()  { return localStorage.getItem(TOKEN_KEY); }
export function getUser()   { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch { return null; } }
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}
export function logout() {
  clearSession();
  location.href = 'login.html';
}

/** Token байхгүй бол login руу. Буцаах: user object */
export function requireAuth(roles = null) {
  const token = getToken();
  const user = getUser();
  if (!token || !user) {
    location.href = 'login.html';
    return null;
  }
  if (roles && !roles.includes(user.role)) {
    document.body.innerHTML = '<div style="padding:80px;text-align:center;font-family:sans-serif">' +
      '<h2>⛔ Эрх хүрэхгүй</h2><p>Энэ хуудсыг үзэх эрхгүй байна.</p>' +
      '<a href="index.html">← Самбар руу буцах</a></div>';
    return null;
  }
  return user;
}

/** Bearer token-той API дуудлага. 401 → session цэвэрлээд login */
export async function adminApi(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${getToken()}`,
      ...(body ? { 'Content-Type': 'application/json' } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  if (res.status === 401) {
    clearSession();
    location.href = 'login.html';
    throw new Error('Session дууссан');
  }
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const payload = isJson ? await res.json() : null;
  if (!res.ok) {
    const e = payload?.error ?? {};
    const err = new Error(e.message || `HTTP ${res.status}`);
    err.code = e.code;
    err.status = res.status;
    throw err;
  }
  return payload;
}

const NAV = [
  { href: 'index.html',    label: '📊 Самбар',        roles: ['admin', 'manager', 'agent'] },
  { href: 'bookings.html', label: '🎫 Захиалгууд',    roles: ['admin', 'manager', 'agent'] },
  { href: 'flights.html',  label: '✈️ Нислэгүүд',     roles: ['admin', 'manager', 'agent'] },
  { href: 'reports.html',  label: '💰 Орлогын тайлан', roles: ['admin'] }
];

/** Sidebar + topbar render. activePage = filename */
export function renderShell(activePage) {
  const user = getUser();
  const links = NAV
    .filter(n => n.roles.includes(user.role))
    .map(n => `<a href="${n.href}" class="${n.href === activePage ? 'active' : ''}">${n.label}</a>`)
    .join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <div class="admin-layout">
      <aside class="admin-sidebar">
        <div class="admin-logo">Air Guide<span>admin</span></div>
        <nav>${links}</nav>
        <div class="admin-user">
          <div class="au-name">${user.full_name || user.username}</div>
          <div class="au-role">${user.role}</div>
          <button id="logout-btn" class="au-logout">Гарах</button>
        </div>
      </aside>
      <main class="admin-main" id="admin-main"></main>
    </div>
  `);
  document.getElementById('logout-btn').addEventListener('click', logout);
  return document.getElementById('admin-main');
}

/** Мөнгө формат */
export const fmtMNT = (n) =>
  new Intl.NumberFormat('mn-MN', { style: 'currency', currency: 'MNT', maximumFractionDigits: 0 })
    .format(Number(n) || 0);

export const fmtDateTime = (iso) =>
  iso ? new Date(iso).toLocaleString('mn-MN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ulaanbaatar'
  }) : '—';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
