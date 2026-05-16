/* ============================================================
 * lookup.js — Захиалга шалгах / цуцлах modal
 *
 * Урсгал:
 *   1) "Захиалга шалгах" дарагдсан → код оруулах форм
 *   2) GET /bookings/:code → дэлгэрэнгүй харуулна
 *   3) Хэрэглэгч цуцалбал POST /bookings/:code/cancel
 * ============================================================ */

import { api } from './api.js';

let modalEl = null;

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

const STATUS_LABEL = {
  pending:   'Төлбөр хүлээгдэж буй',
  confirmed: 'Баталгаажсан',
  cancelled: 'Цуцлагдсан',
  completed: 'Дууссан',
  refunded:  'Буцаагдсан'
};

const STATUS_CLASS = {
  pending:   'st-pending',
  confirmed: 'st-confirmed',
  cancelled: 'st-cancelled',
  completed: 'st-confirmed',
  refunded:  'st-cancelled'
};

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
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeLookupModal();
  });
  return modalEl;
}

function show(html) {
  ensureModalEl();
  modalEl.querySelector('.modal-dialog').innerHTML = html;
  modalEl.hidden = false;
  document.body.style.overflow = 'hidden';
  modalEl.querySelectorAll('[data-action="close"]').forEach(b =>
    b.addEventListener('click', closeLookupModal)
  );
}

export function closeLookupModal() {
  if (!modalEl) return;
  modalEl.hidden = true;
  document.body.style.overflow = '';
}

// ============================================================
// Step 1 — Код оруулах форм
// ============================================================
function renderCodeForm(prefill = '', errorMsg = '') {
  return `
    <div class="modal-header">
      <h2>Захиалга шалгах</h2>
      <button type="button" class="modal-close" data-action="close" aria-label="Хаах">×</button>
    </div>
    <div class="modal-body">
      <p class="lookup-hint">Захиалгын кодоо оруулна уу (жишээ: AG7X9P2)</p>
      <form id="lookup-form" class="lookup-form">
        <input type="text" name="code" class="lookup-input"
               placeholder="AG#####" maxlength="10" autocomplete="off"
               value="${escapeHtml(prefill)}"
               style="text-transform:uppercase" required />
        ${errorMsg ? `<div class="form-error" style="display:block;">${escapeHtml(errorMsg)}</div>` : ''}
        <div class="modal-footer">
          <button type="button" class="btn-cancel" data-action="close">Хаах</button>
          <button type="submit" class="btn-submit">Шалгах →</button>
        </div>
      </form>
    </div>
  `;
}

// ============================================================
// Step 2 — Захиалгын дэлгэрэнгүй
// ============================================================
function renderBookingDetail(b) {
  const statusLabel = STATUS_LABEL[b.status] || b.status;
  const statusClass = STATUS_CLASS[b.status] || 'st-pending';
  const canCancel = ['pending', 'confirmed'].includes(b.status);

  return `
    <div class="modal-header">
      <h2>Захиалга: ${escapeHtml(b.booking_code)}</h2>
      <button type="button" class="modal-close" data-action="close" aria-label="Хаах">×</button>
    </div>
    <div class="modal-body">
      <div class="lookup-status ${statusClass}">${escapeHtml(statusLabel)}</div>

      <h3 class="review-title">Захиалагч</h3>
      <div class="review-card">
        <div><span>Нэр:</span> <strong>${escapeHtml(b.customer.name)}</strong></div>
        <div><span>Утас:</span> <strong>${escapeHtml(b.customer.phone)}</strong></div>
        ${b.customer.email ? `<div><span>Имэйл:</span> <strong>${escapeHtml(b.customer.email)}</strong></div>` : ''}
      </div>

      <h3 class="review-title">Билетүүд (${b.tickets.length})</h3>
      ${b.tickets.map(t => `
        <div class="review-card">
          <div class="review-card-header">${escapeHtml(t.ticket_number)} · ${escapeHtml(t.status)}</div>
          <div><span>Нислэг:</span> <strong>${escapeHtml(t.flight.airline.code)} ${escapeHtml(t.flight.flight_number)}</strong></div>
          <div><span>Чиглэл:</span> <strong>${escapeHtml(t.flight.origin.code)} → ${escapeHtml(t.flight.destination.code)}</strong></div>
          <div><span>Хөөрөх:</span> <strong>${fmtDateTime(t.flight.departure_time)}</strong></div>
          <div><span>Зэрэглэл:</span> <strong>${escapeHtml(t.class_type)}</strong></div>
          <div><span>Үнэ:</span> <strong>${MNT.format(t.price)}</strong></div>
        </div>
      `).join('')}

      <h3 class="review-title">Төлбөр</h3>
      <div class="review-total">
        <div class="rt-line"><span>Нийт дүн:</span> <span>${MNT.format(b.total_amount)}</span></div>
        <div class="rt-line"><span>Төлсөн:</span> <span>${MNT.format(b.paid_amount)}</span></div>
        <div class="rt-line rt-grand"><span>Үлдэгдэл:</span> <strong>${MNT.format(b.balance_due)}</strong></div>
      </div>

      <div class="form-error" id="lookup-error" hidden></div>

      <div class="modal-footer">
        <button type="button" class="btn-cancel" data-action="back">← Өөр код</button>
        ${canCancel ? `<button type="button" class="btn-danger" data-action="cancel">Захиалга цуцлах</button>` : ''}
        <button type="button" class="btn-submit" data-action="close">Хаах</button>
      </div>
    </div>
  `;
}

// ============================================================
// Step 3 — Цуцлалт батлах
// ============================================================
function renderCancelConfirm(b) {
  return `
    <div class="modal-header">
      <h2>Захиалга цуцлах уу?</h2>
      <button type="button" class="modal-close" data-action="close" aria-label="Хаах">×</button>
    </div>
    <div class="modal-body">
      <p class="cancel-warn">
        ⚠️ <strong>${escapeHtml(b.booking_code)}</strong> захиалгыг цуцлах гэж байна.
        Энэ үйлдлийг буцаах боломжгүй.
      </p>
      <p class="lookup-hint">Буцаалтын дүн нь нислэгийн хугацаанаас хамаарна:</p>
      <ul class="refund-rules">
        <li>24+ цаг өмнө: <strong>100% буцаалт</strong></li>
        <li>4–24 цаг өмнө: <strong>50% буцаалт</strong></li>
        <li>4 цаг дотор: <strong>буцаалтгүй</strong></li>
      </ul>
      <label class="lookup-reason">
        <span>Цуцлах шалтгаан (заавал биш)</span>
        <input type="text" id="cancel-reason" maxlength="255" placeholder="Жишээ: Төлөвлөгөө өөрчлөгдсөн" />
      </label>
      <div class="form-error" id="lookup-error" hidden></div>
      <div class="modal-footer">
        <button type="button" class="btn-cancel" data-action="back-detail">← Болих</button>
        <button type="button" class="btn-danger" data-action="confirm-cancel">Тийм, цуцлах</button>
      </div>
    </div>
  `;
}

// ============================================================
// Step 4 — Цуцлалт амжилттай
// ============================================================
function renderCancelResult(r) {
  return `
    <div class="modal-header">
      <h2>Захиалга цуцлагдлаа</h2>
      <button type="button" class="modal-close" data-action="close" aria-label="Хаах">×</button>
    </div>
    <div class="modal-body modal-success">
      <div class="success-icon">✅</div>
      <div class="success-details">
        <div><span>Захиалгын код:</span> <strong>${escapeHtml(r.booking_code)}</strong></div>
        <div><span>Төлөв:</span> <strong>Цуцлагдсан</strong></div>
        <div><span>Нийт төлсөн:</span> <strong>${MNT.format(r.paid_amount)}</strong></div>
        <div><span>Буцаах дүн:</span> <strong>${MNT.format(r.refund_amount)}</strong></div>
        <div><span>Цуцлалтын шимтгэл:</span> <strong>${MNT.format(r.cancellation_fee)}</strong></div>
      </div>
      <p class="success-note">
        Буцаах дүнг 3-5 ажлын өдөрт шилжүүлнэ. Асуулт байвал ${'info@airguide.mn'} -руу хандана уу.
      </p>
      <div class="modal-footer">
        <button type="button" class="btn-submit" data-action="close">Дуусгах</button>
      </div>
    </div>
  `;
}

// ============================================================
// State + handlers
// ============================================================
let currentBooking = null;

async function lookupCode(code) {
  show(`
    <div class="modal-header"><h2>Шалгаж байна...</h2></div>
    <div class="modal-body" style="text-align:center;padding:60px;">
      <div class="spinner"></div>
    </div>
  `);
  try {
    const res = await api.getBooking(code);
    currentBooking = res.data;
    show(renderBookingDetail(currentBooking));
    bindDetailHandlers();
  } catch (err) {
    const msg = err.code === 'NOT_FOUND'
      ? `"${code}" кодтой захиалга олдсонгүй. Кодоо шалгана уу.`
      : (err.message || 'Алдаа гарлаа.');
    show(renderCodeForm(code, msg));
    bindFormHandler();
  }
}

function bindFormHandler() {
  const form = modalEl.querySelector('#lookup-form');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = form.code.value.trim().toUpperCase();
    if (!/^[A-Z0-9]{6,10}$/.test(code)) {
      show(renderCodeForm(code, 'Кодын формат буруу (6-10 тэмдэгт).'));
      bindFormHandler();
      return;
    }
    lookupCode(code);
  });
}

function bindDetailHandlers() {
  modalEl.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    show(renderCodeForm());
    bindFormHandler();
  });
  modalEl.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
    show(renderCancelConfirm(currentBooking));
    bindCancelHandlers();
  });
}

function bindCancelHandlers() {
  modalEl.querySelector('[data-action="back-detail"]')?.addEventListener('click', () => {
    show(renderBookingDetail(currentBooking));
    bindDetailHandlers();
  });
  modalEl.querySelector('[data-action="confirm-cancel"]')?.addEventListener('click', async () => {
    const reason = modalEl.querySelector('#cancel-reason')?.value.trim() || undefined;
    const btn = modalEl.querySelector('[data-action="confirm-cancel"]');
    const errEl = modalEl.querySelector('#lookup-error');
    btn.disabled = true;
    btn.textContent = 'Цуцалж байна...';
    try {
      const res = await api.cancelBooking(currentBooking.booking_code, reason);
      show(renderCancelResult(res.data));
      modalEl.querySelectorAll('[data-action="close"]').forEach(b =>
        b.addEventListener('click', closeLookupModal)
      );
    } catch (err) {
      errEl.textContent = err.message || 'Цуцлахад алдаа гарлаа.';
      errEl.hidden = false;
      btn.disabled = false;
      btn.textContent = 'Тийм, цуцлах';
    }
  });
}

// ============================================================
// Public
// ============================================================
export function openLookupModal() {
  show(renderCodeForm());
  bindFormHandler();
}
