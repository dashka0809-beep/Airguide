/* ============================================================
 * search.js — Хайлтын форм + үр дүн харуулагч
 *
 * - Form submit-д Backend API дуудах
 * - Үр дүнг #search-results-section дотор render хийх
 * - From ↔ To swap, огнооны валидаци
 * ============================================================ */

import { api } from './api.js';
import { attachAutocomplete } from './autocomplete.js';
import { openBookingModal } from './booking.js';

// Search state — modal-руу transfer хийнэ
const searchState = { passengers: 1, classType: 'economy' };

// ----- Forint utility -----
const MNT = new Intl.NumberFormat('mn-MN', {
  style: 'currency',
  currency: 'MNT',
  maximumFractionDigits: 0
});

function fmtPrice(p) {
  if (p == null) return '—';
  return MNT.format(p);
}

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('mn-MN', {
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ulaanbaatar'
  });
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('mn-MN', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Ulaanbaatar'
  });
}

function fmtDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}ц ${m}м`;
}

// ----- Render flight card -----
function renderFlightCard(f) {
  return `
    <article class="flight-card" data-flight-id="${f.flight_id}">
      <div class="flight-airline">
        <div class="airline-name">${escapeHtml(f.airline.name)}</div>
        <div class="airline-code">${escapeHtml(f.flight_number)}</div>
      </div>

      <div class="flight-route">
        <div class="route-point">
          <div class="route-time">${fmtTime(f.departure_time)}</div>
          <div class="route-code">${escapeHtml(f.origin.code)}</div>
          <div class="route-city">${escapeHtml(f.origin.city)}</div>
        </div>

        <div class="route-line">
          <div class="route-duration">${fmtDuration(f.duration_minutes)}</div>
          <div class="route-arrow">✈</div>
          <div class="route-direct">Шууд</div>
        </div>

        <div class="route-point">
          <div class="route-time">${fmtTime(f.arrival_time)}</div>
          <div class="route-code">${escapeHtml(f.destination.code)}</div>
          <div class="route-city">${escapeHtml(f.destination.city)}</div>
        </div>
      </div>

      <div class="flight-price">
        <div class="price-amount">${fmtPrice(f.price.economy)}</div>
        <div class="price-label">Эконом</div>
        <div class="price-seats">${f.available_seats} суудал</div>
        <button class="btn-book"
                data-flight-id="${f.flight_id}"
                data-passengers="${searchState.passengers}"
                data-class="${searchState.classType}">Захиалах</button>
      </div>
    </article>
  `;
}

function renderResults({ outbound, inbound }, meta) {
  const totalCount = meta.outbound_count + meta.inbound_count;
  if (totalCount === 0) {
    return `
      <div class="results-empty">
        <div class="empty-icon">🛫</div>
        <h3>Уг чиглэлд нислэг олдсонгүй</h3>
        <p>Өөр өдөр, чиглэл сонгож үзнэ үү.</p>
      </div>
    `;
  }

  let html = '';
  if (outbound.length > 0) {
    html += `
      <div class="results-leg">
        <h3 class="leg-title">✈ Очих ${outbound.length > 1 ? `(${outbound.length} нислэг)` : ''}</h3>
        <div class="flight-list">
          ${outbound.map(renderFlightCard).join('')}
        </div>
      </div>
    `;
  }
  if (inbound.length > 0) {
    html += `
      <div class="results-leg">
        <h3 class="leg-title">🔄 Буцах ${inbound.length > 1 ? `(${inbound.length} нислэг)` : ''}</h3>
        <div class="flight-list">
          ${inbound.map(renderFlightCard).join('')}
        </div>
      </div>
    `;
  }
  return html;
}

function showLoading(container) {
  container.innerHTML = `
    <div class="results-loading">
      <div class="spinner"></div>
      <p>Хайж байна...</p>
    </div>
  `;
}

function showError(container, message) {
  container.innerHTML = `
    <div class="results-error">
      <div class="error-icon">⚠️</div>
      <h3>Алдаа гарлаа</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ============================================================
// Form initialization
// ============================================================
export function initSearchForm() {
  const fromInput = document.querySelector('input[name="from"]');
  const toInput   = document.querySelector('input[name="to"]');
  const depInput  = document.querySelector('input[name="departure_date"]');
  const retInput  = document.querySelector('input[name="return_date"]');
  const paxSelect = document.querySelector('select[name="passengers"]');
  const searchBtn = document.querySelector('.search-btn');
  const tripTabs  = document.querySelectorAll('.trip-tab');
  const swapBtn   = document.querySelector('.swap-btn');

  const resultsSection = document.querySelector('#search-results');
  const resultsContent = document.querySelector('#search-results-content');

  if (!fromInput || !toInput || !depInput || !searchBtn) {
    console.warn('Search form elements not found');
    return;
  }

  // ----- Autocomplete -----
  const airportFetcher = async (q) => {
    const res = await api.airports(q, 8);
    return res.data.map(a => ({
      value: a.iata_code,
      label: `${a.city} (${a.iata_code})`,
      sub: a.name
    }));
  };
  attachAutocomplete(fromInput, airportFetcher);
  attachAutocomplete(toInput, airportFetcher);

  // ----- Swap button -----
  if (swapBtn) {
    swapBtn.addEventListener('click', (e) => {
      e.preventDefault();
      [fromInput.value, toInput.value] = [toInput.value, fromInput.value];
      [fromInput.dataset.value, toInput.dataset.value] = [
        toInput.dataset.value || '', fromInput.dataset.value || ''
      ];
    });
  }

  // ----- Огнооны валидаци -----
  depInput.addEventListener('change', () => {
    if (retInput && retInput.value && retInput.value < depInput.value) {
      retInput.value = depInput.value;
    }
    if (retInput) retInput.min = depInput.value;
  });

  // ----- Trip type tabs (return талбарыг идэвхгүй болгох) -----
  tripTabs.forEach(t => t.addEventListener('click', () => {
    const tripType = t.dataset.trip || 'round';
    if (retInput) {
      retInput.disabled = (tripType === 'oneway');
      retInput.parentElement.classList.toggle('disabled', tripType === 'oneway');
    }
  }));

  // ----- Захиалах товч (event delegation) -----
  resultsContent.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-book');
    if (!btn) return;
    const flightId = btn.dataset.flightId;
    const passengers = parseInt(btn.dataset.passengers, 10) || 1;
    const classType = btn.dataset.class || 'economy';
    openBookingModal({ flightId, passengers, classType });
  });

  // ----- Search button -----
  searchBtn.addEventListener('click', async (e) => {
    e.preventDefault();

    const from = (fromInput.dataset.value || fromInput.value).toUpperCase().trim();
    const to   = (toInput.dataset.value || toInput.value).toUpperCase().trim();
    const departure_date = depInput.value;
    const return_date    = retInput && !retInput.disabled ? retInput.value : '';
    const passengers     = paxSelect ? parseInt(paxSelect.value, 10) || 1 : 1;

    // Modal-руу transfer хийх state хадгална
    searchState.passengers = passengers;
    searchState.classType = 'economy';

    // Validate
    if (!/^[A-Z]{3}$/.test(from)) {
      alert('Хаанаас: IATA код (3 үсэгтэй) сонгох эсвэл жагсаалтаас сонго');
      fromInput.focus();
      return;
    }
    if (!/^[A-Z]{3}$/.test(to)) {
      alert('Хаашаа: IATA код (3 үсэгтэй) сонгох эсвэл жагсаалтаас сонго');
      toInput.focus();
      return;
    }
    if (from === to) {
      alert('Хаанаас, Хаашаа адил байж болохгүй');
      return;
    }
    if (!departure_date) {
      alert('Явах өдрөө сонгоно уу');
      depInput.focus();
      return;
    }

    // Show results section + loading
    resultsSection.hidden = false;
    showLoading(resultsContent);
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    try {
      const res = await api.searchFlights({
        from, to, departure_date,
        return_date: return_date || undefined,
        passengers
      });
      resultsContent.innerHTML = renderResults(res.data, res.meta);
    } catch (err) {
      console.error(err);
      showError(resultsContent, err.message || 'Тодорхойгүй алдаа');
    }
  });
}
