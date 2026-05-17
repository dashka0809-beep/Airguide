/* ============================================================
 * chatbot.js — Air Guide AI туслах (floating widget)
 *
 * Доош баруун буланд хөвөгч товч → дарвал чат панел нээгдэнэ.
 * POST /api/chat руу ярианы түүхийг илгээж, хариуг харуулна.
 * Хоёр хэл: bot нь хэрэглэгчийн бичсэн хэлээр хариулна.
 * ============================================================ */

import { API_BASE } from './config.js';

const STORAGE_KEY = 'airguide:chat:history';
const MAX_HISTORY = 24; // backend 30-аар хязгаарласан, бид бага барина

let panelEl = null;
let listEl = null;
let inputEl = null;
let sendBtn = null;
let busy = false;

/** [{role, content}] — localStorage-д хадгална */
function loadHistory() {
  try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}
function saveHistory(h) {
  try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(h.slice(-MAX_HISTORY))); }
  catch { /* ignore */ }
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Энгийн markdown-ish: **bold**, мөр таслалт, • bullet */
function renderText(t) {
  return esc(t)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

function addBubble(role, text, opts = {}) {
  const div = document.createElement('div');
  div.className = `cb-msg cb-${role}` + (opts.typing ? ' cb-typing' : '');
  div.innerHTML = opts.typing
    ? '<span></span><span></span><span></span>'
    : renderText(text);
  listEl.appendChild(div);
  listEl.scrollTop = listEl.scrollHeight;
  return div;
}

async function send() {
  const text = inputEl.value.trim();
  if (!text || busy) return;
  inputEl.value = '';
  inputEl.style.height = 'auto';

  const history = loadHistory();
  history.push({ role: 'user', content: text });
  saveHistory(history);
  addBubble('user', text);

  busy = true;
  sendBtn.disabled = true;
  const typing = addBubble('bot', '', { typing: true });

  try {
    const res = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) })
    });
    const payload = await res.json();
    typing.remove();

    if (!res.ok) {
      const msg = payload?.error?.code === 'CHAT_DISABLED'
        ? 'AI туслах одоогоор идэвхгүй байна. / The assistant is currently unavailable.'
        : (payload?.error?.message || 'Алдаа гарлаа. Дахин оролдоно уу.');
      addBubble('bot', msg);
      return;
    }

    const reply = payload.data.reply;
    history.push({ role: 'assistant', content: reply });
    saveHistory(history);
    addBubble('bot', reply);
  } catch (e) {
    typing.remove();
    addBubble('bot', 'Сүлжээний алдаа. / Network error. Дахин оролдоно уу.');
  } finally {
    busy = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }
}

function buildUI() {
  // Launcher товч
  const launcher = document.createElement('button');
  launcher.className = 'cb-launcher';
  launcher.setAttribute('aria-label', 'AI туслах');
  launcher.innerHTML = '💬';

  // Панел
  panelEl = document.createElement('div');
  panelEl.className = 'cb-panel';
  panelEl.hidden = true;
  panelEl.innerHTML = `
    <div class="cb-head">
      <div>
        <div class="cb-title">Air Guide туслах</div>
        <div class="cb-sub">Нислэг хайх · Захиалга шалгах</div>
      </div>
      <button class="cb-close" aria-label="Хаах">×</button>
    </div>
    <div class="cb-list"></div>
    <form class="cb-form">
      <textarea class="cb-input" rows="1"
        placeholder="Асуултаа бичнэ үү… / Ask me anything…"></textarea>
      <button type="submit" class="cb-send" aria-label="Илгээх">➤</button>
    </form>
  `;

  document.body.appendChild(launcher);
  document.body.appendChild(panelEl);

  listEl = panelEl.querySelector('.cb-list');
  inputEl = panelEl.querySelector('.cb-input');
  sendBtn = panelEl.querySelector('.cb-send');

  // Өмнөх яриа сэргээх, эсвэл угтах мэндчилгээ
  const history = loadHistory();
  if (history.length === 0) {
    addBubble('bot',
      'Сайн байна уу! 👋 Би Air Guide-ийн туслах. Нислэг хайх, ' +
      'захиалга шалгахад тусална.\n\nЖишээ: *"Улаанбаатараас Сөүл рүү ' +
      '6-р сарын 15-нд нислэг байна уу?"*');
  } else {
    history.forEach(m => addBubble(m.role === 'user' ? 'user' : 'bot', m.content));
  }

  // Эвентүүд
  function toggle(open) {
    panelEl.hidden = open === false ? true : !panelEl.hidden;
    launcher.classList.toggle('cb-open', !panelEl.hidden);
    if (!panelEl.hidden) setTimeout(() => inputEl.focus(), 50);
  }
  launcher.addEventListener('click', () => toggle());
  panelEl.querySelector('.cb-close').addEventListener('click', () => toggle(false));
  panelEl.querySelector('.cb-form').addEventListener('submit', (e) => {
    e.preventDefault(); send();
  });
  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + 'px';
  });
}

export function initChatbot() {
  if (document.querySelector('.cb-launcher')) return;
  buildUI();
}
