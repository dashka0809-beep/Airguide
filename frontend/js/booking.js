/* ============================================================
 * booking.js — Захиалга үүсгэх 3-алхамт modal flow
 *
 * Алхамууд:
 *   1) Зорчигч — Customer + passengers form
 *   2) Шалгах — Review + terms checkbox
 *   3) Төлбөр — Submit + success (Phase 3-д QPay сольно)
 *
 * State:
 *   currentStep, flight, passengers, classType, customer, passengersData
 * ============================================================ */

import { api } from './api.js';

let modalEl = null;

const state = {
  step: 1,                  // 1, 2, 3
  flight: null,             // full flight obj from /flights/:id
  passengerCount: 1,        // from search
  classType: 'economy',     // from search
  customer: null,           // { last_name, first_name, phone, email }
  passengers: [],           // [{last_name, ...}, ...]
  bookingResult: null       // POST /bookings -ийн хариу
};

const MNT = new Intl.NumberFormat('mn-MN', {
  style: 'currency', currency: 'MNT', maximumFractionDigits: 0
});

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('mn-MN', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ulaanbaatar'
  });
}

function priceFor(flight, classType) {
  return flight.price?.[classType] ?? flight.price?.economy ?? 0;
}

// ============================================================
// Step indicator (1 — 2 — 3)
// ============================================================
function renderStepIndicator() {
  const labels = ['Зорчигч', 'Шалгах', 'Төлбөр'];
  return `
    <div class="step-indicator">
      ${labels.map((label, i) => {
        const n = i + 1;
        const status = n < state.step ? 'done' : n === state.step ? 'active' : 'todo';
        return `
          <div class="step ${status}">
            <div class="step-circle">${status === 'done' ? '✓' : n}</div>
            <div class="step-label">${label}</div>
          </div>
          ${n < 3 ? `<div class="step-line ${n < state.step ? 'done' : ''}"></div>` : ''}
        `;
      }).join('')}
    </div>
  `;
}

// ============================================================
// Flight summary (top of every step)
// ============================================================
function renderFlightSummary() {
  const f = state.flight;
  const pricePerPax = priceFor(f, state.classType);
  const total = pricePerPax * state.passengerCount;
  return `
    <div class="booking-summary">
      <div class="bs-row">
        <span class="bs-airline">${escapeHtml(f.airline.name)} ${escapeHtml(f.flight_number)}</span>
        <span class="bs-class">${state.classType.toUpperCase()}</span>
      </div>
      <div class="bs-route">
        <strong>${escapeHtml(f.origin.code)}</strong> ${escapeHtml(f.origin.city)}
        <span class="bs-arrow">→</span>
        <strong>${escapeHtml(f.destination.code)}</strong> ${escapeHtml(f.destination.city)}
      </div>
      <div class="bs-times">${fmtDateTime(f.departure_time)} → ${fmtDateTime(f.arrival_time)}</div>
      <div class="bs-totals">
        ${state.passengerCount} × ${MNT.format(pricePerPax)}
        <strong>= ${MNT.format(total)}</strong>
      </div>
    </div>
  `;
}

// ============================================================
// STEP 1 — Зорчигчийн мэдээлэл
// ============================================================
function renderStep1() {
  const c = state.customer || {};
  return `
    <form id="booking-form" class="booking-form">
      <fieldset class="form-fieldset">
        <legend>Захиалагч (холбогч)</legend>
        <div class="form-row">
          <label>
            <span>Овог *</span>
            <input type="text" name="customer_last_name" required maxlength="60" value="${escapeHtml(c.last_name || '')}" />
          </label>
          <label>
            <span>Нэр *</span>
            <input type="text" name="customer_first_name" required maxlength="60" value="${escapeHtml(c.first_name || '')}" />
          </label>
        </div>
        <div class="form-row">
          <label>
            <span>Утас *</span>
            <input type="tel" name="customer_phone" required pattern="\\+?\\d{6,15}" placeholder="99887766" value="${escapeHtml(c.phone || '')}" />
          </label>
          <label>
            <span>Имэйл</span>
            <input type="email" name="customer_email" maxlength="120" placeholder="info@example.mn" value="${escapeHtml(c.email || '')}" />
          </label>
        </div>
      </fieldset>

      ${Array.from({ length: state.passengerCount }, (_, i) => {
        const p = state.passengers[i] || {};
        return `
          <fieldset class="form-fieldset" data-pax-index="${i}">
            <legend>Зорчигч ${i + 1}</legend>
            <div class="form-row">
              <label>
                <span>Овог *</span>
                <input type="text" name="last_name" required maxlength="60" value="${escapeHtml(p.last_name || '')}" />
              </label>
              <label>
                <span>Нэр *</span>
                <input type="text" name="first_name" required maxlength="60" value="${escapeHtml(p.first_name || '')}" />
              </label>
            </div>
            <div class="form-row">
              <label>
                <span>Төрсөн өдөр *</span>
                <input type="date" name="birth_date" required max="2026-05-15" value="${escapeHtml(p.birth_date || '')}" />
              </label>
              <label>
                <span>Хүйс *</span>
                <select name="gender" required>
                  <option value="M" ${p.gender === 'M' ? 'selected' : ''}>Эр</option>
                  <option value="F" ${p.gender === 'F' ? 'selected' : ''}>Эм</option>
                  <option value="O" ${p.gender === 'O' ? 'selected' : ''}>Бусад</option>
                </select>
              </label>
            </div>
            <div class="form-row">
              <label>
                <span>Паспортын дугаар</span>
                <input type="text" name="passport_no" maxlength="20" placeholder="Олон улсын нислэгт заавал" value="${escapeHtml(p.passport_no || '')}" />
              </label>
              <label>
                <span>Паспорт хүчинтэй хүртэл</span>
                <input type="date" name="passport_expiry" value="${escapeHtml(p.passport_expiry || '')}" />
              </label>
            </div>
          </fieldset>
        `;
      }).join('')}

      <div class="form-error" id="booking-error" hidden></div>

      <div class="modal-footer">
        <button type="button" class="btn-cancel" data-action="close">Цуцлах</button>
        <button type="submit" class="btn-submit">Үргэлжлүүлэх →</button>
      </div>
    </form>
  `;
}

// ============================================================
// STEP 2 — Review
// ============================================================
function renderStep2() {
  const c = state.customer;
  const pricePerPax = priceFor(state.flight, state.classType);
  const total = pricePerPax * state.passengerCount;

  return `
    <div class="review-section">
      <h3 class="review-title">Захиалагч</h3>
      <div class="review-card">
        <div><span>Нэр:</span> <strong>${escapeHtml(c.last_name)} ${escapeHtml(c.first_name)}</strong></div>
        <div><span>Утас:</span> <strong>${escapeHtml(c.phone)}</strong></div>
        ${c.email ? `<div><span>Имэйл:</span> <strong>${escapeHtml(c.email)}</strong></div>` : ''}
      </div>

      <h3 class="review-title">Зорчигчид (${state.passengers.length})</h3>
      ${state.passengers.map((p, i) => `
        <div class="review-card">
          <div class="review-card-header">Зорчигч ${i + 1}</div>
          <div><span>Нэр:</span> <strong>${escapeHtml(p.last_name)} ${escapeHtml(p.first_name)}</strong></div>
          <div><span>Төрсөн:</span> <strong>${escapeHtml(p.birth_date)}</strong></div>
          <div><span>Хүйс:</span> <strong>${p.gender === 'M' ? 'Эр' : p.gender === 'F' ? 'Эм' : 'Бусад'}</strong></div>
          ${p.passport_no ? `<div><span>Паспорт:</span> <strong>${escapeHtml(p.passport_no)}</strong></div>` : ''}
        </div>
      `).join('')}

      <h3 class="review-title">Төлбөрийн нийт дүн</h3>
      <div class="review-total">
        <div class="rt-line"><span>Тийзний үнэ:</span> <span>${MNT.format(pricePerPax)} × ${state.passengerCount}</span></div>
        <div class="rt-line rt-grand"><span>Нийт төлөх:</span> <strong>${MNT.format(total)}</strong></div>
      </div>

      <label class="terms-check">
        <input type="checkbox" id="terms-agree" />
        <span>Үйлчилгээний нөхцөл, нууцлалын бодлогыг хүлээн зөвшөөрч байна.</span>
      </label>

      <div class="form-error" id="booking-error" hidden></div>

      <div class="modal-footer">
        <button type="button" class="btn-cancel" data-action="prev">← Буцах</button>
        <button type="button" class="btn-submit" data-action="submit">Захиалах →</button>
      </div>
    </div>
  `;
}

// ============================================================
// STEP 3 — Success + payment placeholder
// ============================================================
function renderStep3() {
  const r = state.bookingResult;
  return `
    <div class="modal-success">
      <div class="success-icon">✅</div>
      <p class="success-msg">Захиалга баталгаажлаа. Захиалгын код:</p>
      <div class="booking-code">${escapeHtml(r.booking_code)}</div>

      <div class="success-details">
        <div><span>Нийт төлөх:</span> <strong>${MNT.format(r.total_amount)}</strong></div>
        <div><span>Төлбөрийн төлөв:</span> <strong>${escapeHtml(r.status)}</strong></div>
        <div><span>Төлбөрийн хугацаа:</span> <strong>${fmtDateTime(r.payment_deadline)}</strong></div>
        ${r.tickets?.length ? `
          <div><span>Билет:</span> <strong>${r.tickets.map(t => escapeHtml(t.ticket_number)).join(', ')}</strong></div>
        ` : ''}
      </div>

      <p class="success-note">
        ⚠️ Захиалгаа 24 цагийн дотор төлж баталгаажуулна уу.
        Захиалгын кодыг бичиж авах эсвэл screenshot хадгалаарай.
      </p>

      <div class="payment-options">
        <div class="payment-title">Төлбөр төлөх (Phase 3-д идэвхжинэ)</div>
        <div class="payment-methods">
          <button type="button" class="payment-method" disabled>
            <span class="pm-icon">💳</span>
            <span class="pm-label">Карт</span>
          </button>
          <button type="button" class="payment-method" disabled>
            <span class="pm-icon">📱</span>
            <span class="pm-label">QPay</span>
          </button>
          <button type="button" class="payment-method" disabled>
            <span class="pm-icon">🏦</span>
            <span class="pm-label">Шилжүүлэг</span>
          </button>
        </div>
      </div>

      <div class="modal-footer">
        <button type="button" class="btn-cancel" data-action="close">Дуусгах</button>
      </div>
    </div>
  `;
}

// ============================================================
// Render dispatch
// ============================================================
function renderCurrentStep() {
  let body;
  if (state.step === 1) body = renderStep1();
  else if (state.step === 2) body = renderStep2();
  else body = renderStep3();

  return `
    <div class="modal-header">
      <h2>${state.step === 3 ? 'Захиалга баталгаажлаа' : 'Захиалга үүсгэх'}</h2>
      <button type="button" class="modal-close" aria-label="Хаах" data-action="close">×</button>
    </div>
    <div class="modal-body">
      ${renderStepIndicator()}
      ${state.step !== 3 ? renderFlightSummary() : ''}
      ${body}
    </div>
  `;
}

function refresh() {
  modalEl.querySelector('.modal-dialog').innerHTML = renderCurrentStep();
  bindStepHandlers();
}

// ============================================================
// Event handlers per step
// ============================================================
function bindStepHandlers() {
  // Close buttons / overlay
  modalEl.querySelectorAll('[data-action="close"]').forEach(b =>
    b.addEventListener('click', closeBookingModal)
  );

  if (state.step === 1) {
    const form = modalEl.querySelector('#booking-form');
    form?.addEventListener('submit', handleStep1Submit);
  } else if (state.step === 2) {
    modalEl.querySelector('[data-action="prev"]')?.addEventListener('click', () => {
      state.step = 1;
      refresh();
    });
    modalEl.querySelector('[data-action="submit"]')?.addEventListener('click', handleStep2Submit);
  }
}

function collectStep1(form) {
  const f = new FormData(form);
  const customer = {
    last_name:  (f.get('customer_last_name') || '').trim(),
    first_name: (f.get('customer_first_name') || '').trim(),
    phone:      (f.get('customer_phone') || '').trim(),
    email:      (f.get('customer_email') || '').trim()
  };
  const passengers = [];
  form.querySelectorAll('fieldset[data-pax-index]').forEach(fs => {
    const get = (name) => (fs.querySelector(`[name="${name}"]`)?.value ?? '').trim();
    passengers.push({
      last_name:       get('last_name'),
      first_name:      get('first_name'),
      birth_date:      get('birth_date'),
      gender:          get('gender'),
      passport_no:     get('passport_no'),
      passport_expiry: get('passport_expiry'),
      passenger_type:  'adult'
    });
  });
  return { customer, passengers };
}

function validateStep1({ customer, passengers }) {
  if (!customer.last_name || !customer.first_name || !customer.phone) {
    return 'Захиалагчийн нэр, утас заавал бөглөнө үү.';
  }
  if (!/^\+?\d{6,15}$/.test(customer.phone)) {
    return 'Утасны формат буруу (6-15 цифр, эхэнд + байж болно).';
  }
  if (customer.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(customer.email)) {
    return 'Имэйл буруу.';
  }
  for (const [i, p] of passengers.entries()) {
    if (!p.last_name || !p.first_name || !p.birth_date || !p.gender) {
      return `Зорчигч ${i + 1}-н бүх заавал бөглөх талбар оруулна уу.`;
    }
  }
  return null;
}

function handleStep1Submit(e) {
  e.preventDefault();
  const { customer, passengers } = collectStep1(e.currentTarget);
  const err = validateStep1({ customer, passengers });
  const errorEl = modalEl.querySelector('#booking-error');
  if (err) {
    errorEl.textContent = err;
    errorEl.hidden = false;
    errorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  state.customer = customer;
  state.passengers = passengers;
  state.step = 2;
  refresh();
}

async function handleStep2Submit() {
  const errorEl = modalEl.querySelector('#booking-error');
  const termsEl = modalEl.querySelector('#terms-agree');
  if (!termsEl?.checked) {
    errorEl.textContent = 'Үйлчилгээний нөхцөлийг зөвшөөрнө үү.';
    errorEl.hidden = false;
    return;
  }
  errorEl.hidden = true;

  const submitBtn = modalEl.querySelector('[data-action="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Илгээж байна...';

  try {
    const result = await api.createBooking({
      trip_type: 'one_way',
      outbound_flight_id: Number(state.flight.flight_id),
      class_type: state.classType,
      customer: state.customer,
      passengers: state.passengers
    });
    state.bookingResult = result.data;
    state.step = 3;
    refresh();
  } catch (err) {
    console.error('Booking failed', err);
    errorEl.textContent = err.message || 'Захиалга үүсгэхэд алдаа гарлаа.';
    errorEl.hidden = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Захиалах →';
  }
}

// ============================================================
// Modal lifecycle
// ============================================================
function ensureModalEl() {
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'modal-overlay';
  modalEl.hidden = true;
  modalEl.innerHTML = `<div class="modal-dialog" role="dialog" aria-modal="true"></div>`;
  document.body.appendChild(modalEl);

  // Outside click → close
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeBookingModal();
  });

  // Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalEl && !modalEl.hidden) closeBookingModal();
  });

  return modalEl;
}

function showModal(html) {
  ensureModalEl();
  modalEl.querySelector('.modal-dialog').innerHTML = html;
  modalEl.hidden = false;
  document.body.style.overflow = 'hidden';
}

export function closeBookingModal() {
  if (!modalEl) return;
  modalEl.hidden = true;
  document.body.style.overflow = '';
  // State цэвэрлэнэ ингэснээр дараагийн нээлт цэвэр эхэлнэ
  state.step = 1;
  state.flight = null;
  state.customer = null;
  state.passengers = [];
  state.bookingResult = null;
}

// ============================================================
// Public API
// ============================================================
export async function openBookingModal({ flightId, passengers = 1, classType = 'economy' }) {
  state.step = 1;
  state.passengerCount = passengers;
  state.classType = classType;
  state.customer = null;
  state.passengers = [];
  state.bookingResult = null;

  // Loading state
  showModal(`
    <div class="modal-header"><h2>Захиалга бэлдэж байна...</h2></div>
    <div class="modal-body" style="text-align:center;padding:60px 20px;">
      <div class="spinner"></div>
    </div>
  `);

  try {
    const res = await api.flight(flightId);
    state.flight = res.data;
    refresh();
  } catch (err) {
    showModal(`
      <div class="modal-header">
        <h2>Алдаа гарлаа</h2>
        <button type="button" class="modal-close" data-action="close" aria-label="Хаах">×</button>
      </div>
      <div class="modal-body">
        <div class="form-error" style="display:block;">${escapeHtml(err.message)}</div>
        <div class="modal-footer">
          <button type="button" class="btn-cancel" data-action="close">Хаах</button>
        </div>
      </div>
    `);
    modalEl.querySelectorAll('[data-action="close"]').forEach(b =>
      b.addEventListener('click', closeBookingModal)
    );
  }
}
