/* ============================================================
 * autocomplete.js — Дахин ашиглах autocomplete helper
 *
 * Хэрэглэх:
 *   attachAutocomplete(inputEl, async (q) => {
 *     const res = await api.airports(q);
 *     return res.data.map(a => ({
 *       value: a.iata_code,
 *       label: `${a.city} (${a.iata_code})`,
 *       sub: a.name
 *     }));
 *   });
 *
 * Сонгосон item-ын `value`-г input-н `dataset.value`-д хадгална.
 * ============================================================ */

import { SEARCH_CONFIG } from './config.js';

/**
 * @param {HTMLInputElement} input — Хайлт оруулах textbox
 * @param {(q: string) => Promise<Array<{value, label, sub?}>>} fetchSuggestions
 * @param {Object} options
 *   - onSelect: callback(item) — хэрэглэгч сонгомогц
 *   - minChars: хамгийн бага тэмдэгт (default 2)
 */
export function attachAutocomplete(input, fetchSuggestions, options = {}) {
  const { onSelect, minChars = 2 } = options;
  const debounceMs = SEARCH_CONFIG.autocompleteDebounceMs;

  // Dropdown элемент үүсгэх
  const dropdown = document.createElement('div');
  dropdown.className = 'ac-dropdown';
  dropdown.hidden = true;
  input.parentElement.style.position = 'relative';
  input.parentElement.appendChild(dropdown);

  let debounceTimer = null;
  let currentItems = [];
  let activeIndex = -1;

  function renderItems(items) {
    dropdown.innerHTML = '';
    if (items.length === 0) {
      dropdown.hidden = true;
      return;
    }
    items.forEach((item, i) => {
      const el = document.createElement('div');
      el.className = 'ac-item';
      el.dataset.value = item.value;
      el.innerHTML = `
        <div class="ac-label">${escapeHtml(item.label)}</div>
        ${item.sub ? `<div class="ac-sub">${escapeHtml(item.sub)}</div>` : ''}
      `;
      el.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectItem(items[i]);
      });
      el.addEventListener('mouseenter', () => setActive(i));
      dropdown.appendChild(el);
    });
    dropdown.hidden = false;
    currentItems = items;
    activeIndex = -1;
  }

  function setActive(i) {
    [...dropdown.children].forEach((el, idx) => {
      el.classList.toggle('active', idx === i);
    });
    activeIndex = i;
  }

  function selectItem(item) {
    input.value = item.label;
    input.dataset.value = item.value;
    dropdown.hidden = true;
    if (onSelect) onSelect(item);
  }

  async function runSearch(q) {
    try {
      const items = await fetchSuggestions(q);
      renderItems(items);
    } catch (e) {
      console.error('Autocomplete fetch failed', e);
      dropdown.hidden = true;
    }
  }

  input.addEventListener('input', () => {
    input.dataset.value = '';  // хэрэглэгч засаж байгаа тул сонголтыг арилгана
    const q = input.value.trim();
    clearTimeout(debounceTimer);
    if (q.length < minChars) {
      dropdown.hidden = true;
      return;
    }
    debounceTimer = setTimeout(() => runSearch(q), debounceMs);
  });

  input.addEventListener('focus', () => {
    if (currentItems.length > 0 && input.value.trim().length >= minChars) {
      dropdown.hidden = false;
    }
  });

  input.addEventListener('blur', () => {
    // mousedown handler-аас өмнө гэдгээ итгэж, бяцхан delay-тэйгээр хаах
    setTimeout(() => { dropdown.hidden = true; }, 150);
  });

  input.addEventListener('keydown', (e) => {
    if (dropdown.hidden || currentItems.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, currentItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectItem(currentItems[activeIndex]);
    } else if (e.key === 'Escape') {
      dropdown.hidden = true;
    }
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}
