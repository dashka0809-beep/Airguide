/* ============================================================
 * i18n.js — Олон хэлний дэмжлэг (MN / EN)
 *
 * - Хэлний сонголтыг localStorage-д хадгална
 * - [data-i18n="key"]            → element.textContent
 * - [data-i18n-placeholder="key"]→ element.placeholder
 * - [data-i18n-title="key"]      → element.title
 * - Хэлний товч (.lang-switch) сэлгэх target хэлийг харуулна
 *
 * JS-ээр render хийсэн агуулга (modal, flight card) одоогоор MN.
 * Бүрэн динамик i18n нь Phase 6 (locales/*.json).
 * ============================================================ */

const STORAGE_KEY = 'airguide:lang';
const DEFAULT_LANG = 'mn';

const dict = {
  mn: {
    'title': 'Air Guide — Таны зорилгодоо хүрэх нислэг',
    // Nav
    'nav.search': 'Нислэг хайх',
    'nav.lookup': 'Захиалга шалгах',
    'nav.about': 'Бидний тухай',
    'nav.contact': 'Холбоо барих',
    'lang.switch': '🌐 EN',
    // Hero
    'hero.title': 'Таны зорилгодоо хүрэх нислэг',
    'hero.subtitle': 'Дэлхийн 500+ хотод хямд, найдвартай тийз захиалах',
    // Trip tabs
    'trip.round': 'Очиж буцах',
    'trip.oneway': 'Нэг талын',
    'trip.multi': 'Олон чиглэл',
    // Search form
    'field.from': 'Хаанаас',
    'field.to': 'Хаашаа',
    'field.depart': 'Явах',
    'field.return': 'Буцах',
    'field.pax': 'Зорчигч',
    'field.autocomplete': 'Хайлт автомат',
    'field.date': 'Огноо',
    'field.economy': 'Энгийн зэрэглэл',
    'field.placeholder.city': 'Хот эсвэл IATA код',
    'pax.1': '1 насанд хүрэгч',
    'pax.2': '2 насанд хүрэгч',
    'pax.3': '3 насанд хүрэгч',
    'pax.4': '4 насанд хүрэгч',
    'search.btn': '🔍 Хайх',
    'swap.title': 'Чиглэлийг солих',
    // Sections
    'sec.results': 'Хайлтын үр дүн',
    'sec.results.sub': 'Сонгож, захиалах боломжтой',
    'sec.dest': 'Алдартай чиглэлүүд',
    'sec.dest.sub': 'UB-аас шууд нислэгтэй хотууд',
    'sec.seeall': 'Бүгдийг үзэх →',
    'dest.daily': 'Өдөр бүр шууд нислэгтэй',
    'dest.action': 'Өдөр сонгох',
    'sec.faq': 'Түгээмэл асуултууд',
    'sec.faq.sub': 'Хамгийн их асуудаг асуултын хариулт',
    // Features
    'feat.cheap': 'Хамгийн хямд үнэ',
    'feat.fast': 'Хурдан захиалга',
    'feat.secure': 'Найдвартай төлбөр',
    'feat.support': '24/7 тусламж',
    // FAQ
    'faq.q1': 'Нислэгийн тийз хэрхэн захиалах вэ?',
    'faq.q2': 'Төлбөрийг яаж хийх вэ?',
    'faq.q3': 'Тийз авсаны дараа огноо өөрчлөх боломжтой юу?',
    'faq.q4': 'Хүүхдийн тийзийг хэрхэн захиалах вэ?',
    'faq.q5': 'НӨАТ-ын баримт өгдөг үү?',
    // Footer
    'foot.services': 'Үйлчилгээ',
    'foot.help': 'Тусламж',
    'foot.contact': 'Холбоо барих'
  },
  en: {
    'title': 'Air Guide — Your flight to your destination',
    'nav.search': 'Search flights',
    'nav.lookup': 'Manage booking',
    'nav.about': 'About us',
    'nav.contact': 'Contact',
    'lang.switch': '🌐 MN',
    'hero.title': 'Your flight to your destination',
    'hero.subtitle': 'Cheap and reliable tickets to 500+ cities worldwide',
    'trip.round': 'Round trip',
    'trip.oneway': 'One way',
    'trip.multi': 'Multi-city',
    'field.from': 'From',
    'field.to': 'To',
    'field.depart': 'Depart',
    'field.return': 'Return',
    'field.pax': 'Passengers',
    'field.autocomplete': 'Auto-search',
    'field.date': 'Date',
    'field.economy': 'Economy class',
    'field.placeholder.city': 'City or IATA code',
    'pax.1': '1 adult',
    'pax.2': '2 adults',
    'pax.3': '3 adults',
    'pax.4': '4 adults',
    'search.btn': '🔍 Search',
    'swap.title': 'Swap direction',
    'sec.results': 'Search results',
    'sec.results.sub': 'Pick and book',
    'sec.dest': 'Popular destinations',
    'sec.dest.sub': 'Direct flights from UB',
    'sec.seeall': 'See all →',
    'dest.daily': 'Daily direct flights',
    'dest.action': 'Pick a date',
    'sec.faq': 'Frequently asked questions',
    'sec.faq.sub': 'Answers to common questions',
    'feat.cheap': 'Best prices',
    'feat.fast': 'Fast booking',
    'feat.secure': 'Secure payment',
    'feat.support': '24/7 support',
    'faq.q1': 'How do I book a flight ticket?',
    'faq.q2': 'How do I pay?',
    'faq.q3': 'Can I change the date after purchase?',
    'faq.q4': 'How do I book a child ticket?',
    'faq.q5': 'Do you provide a VAT receipt?',
    'foot.services': 'Services',
    'foot.help': 'Help',
    'foot.contact': 'Contact'
  }
};

export function getLang() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_LANG;
}

export function setLang(lang) {
  if (!dict[lang]) return;
  localStorage.setItem(STORAGE_KEY, lang);
  document.documentElement.lang = lang;
  applyTranslations();
}

export function t(key) {
  const lang = getLang();
  return dict[lang]?.[key] ?? dict[DEFAULT_LANG]?.[key] ?? key;
}

export function applyTranslations() {
  // textContent
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n);
    if (v) el.textContent = v;
  });
  // placeholder
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const v = t(el.dataset.i18nPlaceholder);
    if (v) el.placeholder = v;
  });
  // title attr
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const v = t(el.dataset.i18nTitle);
    if (v) el.title = v;
  });
  // <title>
  const titleEl = document.querySelector('title');
  if (titleEl) titleEl.textContent = t('title');
}

document.addEventListener('DOMContentLoaded', () => {
  document.documentElement.lang = getLang();
  applyTranslations();

  const langBtn = document.querySelector('.lang-switch');
  if (langBtn) {
    langBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setLang(getLang() === 'mn' ? 'en' : 'mn');
    });
  }
});
