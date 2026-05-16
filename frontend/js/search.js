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

// ----- Filter / sort state -----
let lastSearch = { outbound: [], inbound: [], meta: null };
const filters = {
  sort: 'price_asc',
  airlines: new Set(),  // хоосон = бүгд
  times: new Set()      // хоосон = бүгд; 'morning'|'afternoon'|'evening'
};

function depHour(iso) {
  const s = new Date(iso).toLocaleString('en-GB', {
    hour: '2-digit', hour12: false, timeZone: 'Asia/Ulaanbaatar'
  });
  return parseInt(s, 10) || 0;
}

function timeBucket(iso) {
  const h = depHour(iso);
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}

const SORT_CMP = {
  price_asc:  (a, b) => (a.price.economy ?? 1e15) - (b.price.economy ?? 1e15),
  price_desc: (a, b) => (b.price.economy ?? 0) - (a.price.economy ?? 0),
  dep_early:  (a, b) => new Date(a.departure_time) - new Date(b.departure_time),
  duration:   (a, b) => a.duration_minutes - b.duration_minutes
};

function applyFilters(list) {
  const filtered = list.filter(f => {
    if (filters.airlines.size && !filters.airlines.has(f.airline.code)) return false;
    if (filters.times.size && !filters.times.has(timeBucket(f.departure_time))) return false;
    return true;
  });
  return filtered.sort(SORT_CMP[filters.sort] || SORT_CMP.price_asc);
}

function renderToolbar() {
  const all = [...lastSearch.outbound, ...lastSearch.inbound];
  const airlineMap = new Map(all.map(f => [f.airline.code, f.airline.name]));
  const airlines = [...airlineMap.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const sortOpts = [
    ['price_asc',  'Үнэ: бага → их'],
    ['price_desc', 'Үнэ: их → бага'],
    ['dep_early',  'Хөөрөх: эрт → орой'],
    ['duration',   'Хугацаа: богино']
  ];
  const times = [
    ['morning',   '🌅 Өглөө (00–12)'],
    ['afternoon', '☀️ Өдөр (12–18)'],
    ['evening',   '🌙 Орой (18–24)']
  ];

  return `
    <div class="filter-toolbar">
      <div class="ft-group">
        <label class="ft-label">Эрэмбэлэх</label>
        <select id="ft-sort" class="ft-select">
          ${sortOpts.map(([v, l]) =>
            `<option value="${v}" ${filters.sort === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
      </div>
      <div class="ft-group">
        <label class="ft-label">Цаг</label>
        <div class="ft-chips">
          ${times.map(([v, l]) =>
            `<button type="button" class="ft-chip ${filters.times.has(v) ? 'on' : ''}" data-time="${v}">${l}</button>`
          ).join('')}
        </div>
      </div>
      <div class="ft-group">
        <label class="ft-label">Агаарын компани</label>
        <div class="ft-chips">
          ${airlines.map(([code, name]) =>
            `<button type="button" class="ft-chip ${filters.airlines.has(code) ? 'on' : ''}" data-airline="${code}">${escapeHtml(name)}</button>`
          ).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderLegList() {
  const out = applyFilters(lastSearch.outbound);
  const inb = applyFilters(lastSearch.inbound);
  let html = '';
  if (lastSearch.outbound.length > 0) {
    html += `
      <div class="results-leg">
        <h3 class="leg-title">✈ Очих (${out.length}/${lastSearch.outbound.length})</h3>
        <div class="flight-list">
          ${out.length ? out.map(renderFlightCard).join('') : '<div class="results-empty"><p>Шүүлтэд тохирох нислэг алга</p></div>'}
        </div>
      </div>
    `;
  }
  if (lastSearch.inbound.length > 0) {
    html += `
      <div class="results-leg">
        <h3 class="leg-title">🔄 Буцах (${inb.length}/${lastSearch.inbound.length})</h3>
        <div class="flight-list">
          ${inb.length ? inb.map(renderFlightCard).join('') : '<div class="results-empty"><p>Шүүлтэд тохирох нислэг алга</p></div>'}
        </div>
      </div>
    `;
  }
  return html;
}

function renderResults({ outbound, inbound }, meta) {
  // Reset filter state on new search
  lastSearch = { outbound, inbound, meta };
  filters.sort = 'price_asc';
  filters.airlines.clear();
  filters.times.clear();

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

  return `
    ${renderToolbar()}
    <div id="filtered-list">${renderLegList()}</div>
  `;
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
    // Захиалах товч
    const btn = e.target.closest('.btn-book');
    if (btn) {
      const flightId = btn.dataset.flightId;
      const passengers = parseInt(btn.dataset.passengers, 10) || 1;
      const classType = btn.dataset.class || 'economy';
      openBookingModal({ flightId, passengers, classType });
      return;
    }
    // Filter chip (цаг / компани toggle)
    const chip = e.target.closest('.ft-chip');
    if (chip) {
      if (chip.dataset.time) {
        const v = chip.dataset.time;
        filters.times.has(v) ? filters.times.delete(v) : filters.times.add(v);
      } else if (chip.dataset.airline) {
        const v = chip.dataset.airline;
        filters.airlines.has(v) ? filters.airlines.delete(v) : filters.airlines.add(v);
      }
      chip.classList.toggle('on');
      const listEl = document.querySelector('#filtered-list');
      if (listEl) listEl.innerHTML = renderLegList();
    }
  });

  // Sort dropdown өөрчлөгдөх
  resultsContent.addEventListener('change', (e) => {
    if (e.target.id === 'ft-sort') {
      filters.sort = e.target.value;
      const listEl = document.querySelector('#filtered-list');
      if (listEl) listEl.innerHTML = renderLegList();
    }
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
