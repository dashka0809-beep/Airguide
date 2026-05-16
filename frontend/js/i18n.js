/* ============================================================
 * i18n.js — Олон хэлний дэмжлэг (MN / EN)
 *
 * Phase 2-д бүрэн хэрэгжинэ. Одоогоор:
 *   - Хэлний сонголтыг localStorage-д хадгална
 *   - DOM дотор [data-i18n="key"] атрибуттай element-үүдийг текстээр солино
 *
 * Хэрэглэх жишээ HTML-д:
 *   <h1 data-i18n="hero.title">Таны зорилгодоо хүрэх нислэг</h1>
 *
 * Дараа нэмэх:
 *   - Огнооны формат (mn vs en)
 *   - Үнэ тэмдэгт (₮ vs $)
 *   - Долоо хоногийн өдрийн нэр
 * ============================================================ */

const STORAGE_KEY = 'airguide:lang';
const DEFAULT_LANG = 'mn';

/** Орчуулгын dictionary — ирээдүйд locales/{mn,en}.json-аас ачаалж болно */
const dict = {
  mn: {
    'nav.search': 'Нислэг хайх',
    'nav.lookup': 'Захиалга шалгах',
    'nav.schedule': 'Нислэгийн хуваарь',
    'nav.about': 'Бидний тухай',
    'nav.contact': 'Холбоо барих',
    'hero.title': 'Таны зорилгодоо хүрэх нислэг',
    'hero.subtitle': 'Дэлхийн 500+ хотод хямд, найдвартай тийз захиалах',
    'search.btn': '🔍 Хайх'
  },
  en: {
    'nav.search': 'Search flights',
    'nav.lookup': 'Manage booking',
    'nav.schedule': 'Flight schedule',
    'nav.about': 'About us',
    'nav.contact': 'Contact',
    'hero.title': 'Your flight to your destination',
    'hero.subtitle': 'Cheap and reliable tickets to 500+ cities worldwide',
    'search.btn': '🔍 Search'
  }
};

/** Одоогийн хэлийг буцаана ('mn' | 'en') */
export function getLang() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
}

/** Хэл солих, DOM-ыг шинэчилэх */
export function setLang(lang) {
  if (!dict[lang]) return;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  applyTranslations();
}

/** Нэг key-ийн орчуулгыг буцаана */
export function t(key) {
  const lang = getLang();
  return dict[lang]?.[key] ?? key;
}

/** DOM дотор [data-i18n] атрибуттай element-үүдийг солих */
export function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    const text = t(key);
    if (text) el.textContent = text;
  });
}

/* ============================================================
 * DOM-д орсон үед автомат ачаалах
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = getLang();
  applyTranslations();

  // "MN / EN" товчийг дарвал хэл солих
  const langBtn = document.querySelector('.lang-switch');
  if (langBtn) {
    langBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setLang(getLang() === 'mn' ? 'en' : 'mn');
    });
  }
});
