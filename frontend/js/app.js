/* ============================================================
 * app.js — Нүүр хуудасны үндсэн үйлдлүүд
 *   - FAQ нээх/хаах
 *   - Аяллын төрөл сонгох (Round / Oneway / Multi)
 *   - Mobile menu toggle
 *
 * ES module — index.html-д <script type="module"> -р оруулна.
 * ============================================================ */

/**
 * FAQ item нээх/хаах
 * @param {HTMLElement} questionEl — .faq-q element
 */
export function toggleFaq(questionEl) {
  const item = questionEl.parentElement;
  item.classList.toggle('open');
}

/**
 * Аяллын төрөл сонгох (round / oneway / multi)
 * @param {HTMLElement} btn — дарагдсан .trip-tab товч
 * @param {string} type — 'round' | 'oneway' | 'multi'
 */
export function setTrip(btn, type) {
  document.querySelectorAll('.trip-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  // Ирээдүйд: form-ын өгөгдөл, "Буцах" талбарыг идэвхгүй болгох гэх мэт
}

/**
 * Гар утсан дээрх menu (☰) дарвал нав цэс гарч ирэх/хаагдах
 */
function initMobileMenu() {
  const toggle = document.querySelector('.menu-toggle');
  if (!toggle) return;

  toggle.addEventListener('click', () => {
    const links = document.querySelector('.nav-links');
    if (!links) return;

    const visible = links.style.display === 'flex';
    if (visible) {
      links.style.display = 'none';
      return;
    }
    Object.assign(links.style, {
      display: 'flex',
      position: 'absolute',
      top: '76px',
      left: '0',
      right: '0',
      flexDirection: 'column',
      background: 'white',
      padding: '16px 20px',
      borderBottom: '1px solid var(--border)',
      gap: '12px',
      boxShadow: 'var(--shadow)'
    });
  });
}

/* ============================================================
 * DOM бэлэн болсон үед эхлүүлэх
 * ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();

  // FAQ — inline onclick="" -г сольж event delegation хийсэн
  document.querySelectorAll('.faq-q').forEach(q => {
    q.addEventListener('click', () => toggleFaq(q));
  });

  // Trip tabs
  document.querySelectorAll('.trip-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.trip || 'round';
      setTrip(btn, type);
    });
  });
});
