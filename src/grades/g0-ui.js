/* ====================================================================
   نظام النوافذ الموحد لمنصة حاضر — أربعة أنماط لكل نافذة بحسب محتواها:
   sm صغيرة وسطية للتأكيد • md وسطية واسعة للنماذج
   wide عريضة من أعلى مساحة المحتوى للجداول والبيانات • side لوحة جانبية للتفاصيل
   يغيّر العرض والتفاعل فقط، ولا يمس محتوى أي نافذة ولا منطقها.
   ==================================================================== */
const MSVG = {
  info: '<path d="M12 3a9 9 0 110 18 9 9 0 010-18zm0 7.4v6M12 7.6v.9"/>',
  warn: '<path d="M12 3.6 2.6 20h18.8L12 3.6zm0 5.6v5.3m0 2.4v.9"/>',
  edit: '<path d="M4 20h4L19 9a2.5 2.5 0 00-3.5-3.5L4.5 16.5 4 20z"/>',
  table: '<path d="M3.5 5.5h17v13h-17zM3.5 10h17M9.5 10v8.5M15 10v8.5"/>',
  user: '<path d="M12 11.5a3.8 3.8 0 100-7.6 3.8 3.8 0 000 7.6zM4.6 20.2a7.4 7.4 0 0114.8 0"/>',
  up: '<path d="M12 20V5m0 0 5.2 5.2M12 5 6.8 10.2M4 21h16"/>',
};
const mIcon = (k) => `<span class="micon ${k}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${MSVG[k] || MSVG.info}</svg></span>`;
const M = { open: null, scroll: 0, from: null };
/* اختيار النمط من محتوى النافذة نفسه، ما لم يُحدَّد صراحة */
function mSize(el) {
  if (el.querySelector('.t360')) return 'side';
  /* جدول بيانات حقيقي (ثلاثة أعمدة فأكثر) أو كشف داخل إطار يستحق النمط العريض، أما جدول «المفتاح والقيمة» فلا */
  const bigTable = [...el.querySelectorAll('table')].some((t) => [...t.rows].some((r) => r.cells.length >= 3));
  if (el.querySelector('.wfrec, .bkrun, .tw, .gstages, .gsteps') || bigTable) return 'wide';
  const n = el.querySelectorAll('input:not([type=hidden]),select,textarea').length, ta = el.querySelector('textarea');
  const kv = [...el.querySelectorAll('table')].some((t) => t.rows.length >= 5);
  return n >= 3 || kv || (ta && (+ta.getAttribute('rows') || 2) >= 4) ? 'md' : 'sm';
}
const mDanger = (t, el) => /حذف|إلغاء|إغلاق|تغييب|فك التجميد|إعادة تعيين|إيقاف|رفض/.test(t) || !!el.querySelector('.gnote.bad');
function mAutoIcon(size, title, el) { if (/رفع|مزامنة|إرسال/.test(title)) return 'up'; if (mDanger(title, el)) return 'warn'; return { wide: 'table', side: 'user', md: 'edit', sm: 'info' }[size]; }
/* يبني النافذة: رأس ثابت، ومحتوى يتمرر وحده، وتذييل الأزرار يبقى ظاهراً */
modal = function (html, opts) {
  const o = typeof opts === 'string' ? { size: opts } : opts || {};
  closeModal(true);
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  const h2 = tmp.querySelector('h2'); let title = o.title || '', sub = o.sub || '';
  if (h2 && !o.keepTitle) {
    title = title || h2.innerHTML;
    const nx = h2.nextElementSibling;
    if (!sub && nx && nx.classList.contains('sub') && !nx.querySelector('button,input,select,a')) { sub = nx.innerHTML; nx.remove(); }
    h2.remove();
  }
  const size = o.size || mSize(tmp), icon = o.icon || mAutoIcon(size, String(title).replace(/<[^>]*>/g, ''), tmp);
  const w = document.createElement('div');
  w.id = 'modal'; w.dir = 'rtl'; w.lang = 'ar'; w.className = 'm-' + size;
  w.innerHTML = `<div class="box" role="dialog" aria-modal="true"${title ? ' aria-label="' + String(title).replace(/<[^>]*>/g, '').replace(/"/g, '&quot;').slice(0, 120) + '"' : ''}>
    <div class="mhead">${mIcon(icon)}<div class="mtt"><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div><button type="button" class="mx" data-act="modal-close" aria-label="إغلاق النافذة" title="إغلاق (Esc)">✕</button><div class="mbar" hidden><i></i></div></div>
    <div class="mbody"></div></div>`;
  w.querySelector('.mbody').append(...tmp.childNodes);
  const sideW = innerWidth > 860 ? (($('#side') || {}).offsetWidth || 0) : 0;
  w.style.setProperty('--mside', sideW + 'px');
  M.scroll = window.scrollY; M.from = document.activeElement; M.open = { size, dirty: false };
  document.body.appendChild(w); document.body.classList.add('mopen');
  /* النماذج الطويلة تُوزَّع على عمودين في النوافذ الواسعة */
  if (size !== 'sm' && !o.oneCol) w.querySelectorAll('.mbody form, .mbody>.stack').forEach((fm) => { const k = [...fm.children], lb = k.filter((c) => c.tagName === 'LABEL').length, fs = k.filter((c) => c.tagName === 'FIELDSET').length; if (lb >= 3 && lb + fs >= 4) fm.classList.add('grid2'); });
  const f = w.querySelector('.mbody input:not([type=hidden]):not([disabled]),.mbody textarea,.mbody select,.mbody button:not([disabled])') || w.querySelector('.mx');
  if (f) setTimeout(() => { try { f.focus({ preventScroll: true }); if (f.select && f.tagName === 'INPUT' && f.type === 'text') f.select(); } catch (e) { /* لا يمنع الفتح */ } }, 20);
  return w;
};
closeModal = function (quiet) {
  const m = $('#modal'); if (!m) return;
  m.remove(); document.body.classList.remove('mopen'); M.open = null;
  if (!quiet) { try { if (M.from && document.body.contains(M.from)) M.from.focus({ preventScroll: true }); } catch (e) { /* تجاهل */ } window.scrollTo({ top: M.scroll }); }
};
/* مؤشر التحميل داخل النافذة وعلى الزر الذي بدأ العملية */
function modalBusy(on, text) {
  const b = $('#modal .mbar'); if (b) { b.hidden = !on; b.title = text || ''; }
  const h = $('#modal .mhead'); if (h) h.setAttribute('aria-busy', on ? 'true' : 'false');
}
function busyOn(el) { if (!el || !el.tagName) return null; if (el.tagName === 'BUTTON' || el.tagName === 'A') { el.classList.add('busy'); el.setAttribute('aria-busy', 'true'); if (el.tagName === 'BUTTON') el.disabled = true; } modalBusy(true); return el; }
function busyOff(el) { modalBusy(false); if (!el || !document.body.contains(el)) return; el.classList.remove('busy'); el.removeAttribute('aria-busy'); if (el.tagName === 'BUTTON') el.disabled = false; }
/* كل إجراء غير متزامن يُظهر مؤشره تلقائياً */
function wrapBusy(map, getEl) { Object.keys(map).forEach((k) => { const f = map[k]; map[k] = function (a, b) { let r; try { r = f.call(this, a, b); } catch (e) { busyOff(getEl(a)); throw e; } if (r && typeof r.then === 'function') { const el = busyOn(getEl(a)); return r.then((v) => { busyOff(el); return v; }, (e) => { busyOff(el); throw e; }); } return r; }; }); }
wrapBusy(ACT, (el) => el);
wrapBusy(CHG, (el) => (el && el.closest ? el.closest('label') : null) && null);
wrapBusy(SUBMIT, () => ($('#modal .mbody .row .btn.p') || $('#modal .mbody button[type=submit]')));
/* تنبيه قبل فقدان ما أُدخل: شريط داخل النافذة نفسها، فلا تتداخل نافذتان */
document.addEventListener('input', (ev) => { if (M.open && ev.target.closest && ev.target.closest('#modal .mbody')) M.open.dirty = true; });
document.addEventListener('change', (ev) => { if (M.open && ev.target.closest && ev.target.closest('#modal .mbody')) M.open.dirty = true; });
function mTryClose() {
  const m = $('#modal'); if (!m) return;
  if (!M.open || !M.open.dirty || m.querySelector('.mwarn')) { closeModal(); return; }
  const bar = document.createElement('div');
  bar.className = 'mwarn';
  bar.innerHTML = '<span>لديك تعديلات لم تُحفظ في هذه النافذة.</span><span class="row"><button type="button" class="btn s d" data-act="modal-force">إغلاق دون حفظ</button><button type="button" class="btn s" data-act="modal-keep">رجوع</button></span>';
  m.querySelector('.box').appendChild(bar);
  const b = bar.querySelector('.btn'); if (b) b.focus();
}
ACT['modal-close'] = mTryClose;
ACT['modal-force'] = () => closeModal();
ACT['modal-keep'] = () => { const w = $('#modal .mwarn'); if (w) w.remove(); const f = $('#modal .mbody input,#modal .mbody textarea,#modal .mbody select'); if (f) f.focus(); };
VIEW_ACTS.add('modal-close'); VIEW_ACTS.add('modal-force'); VIEW_ACTS.add('modal-keep');
/* Esc والنقر على الخلفية يمران بالتنبيه نفسه، وTab يبقى داخل النافذة */
document.addEventListener('keydown', (ev) => {
  if (!$('#modal')) return;
  if (ev.key === 'Escape') { ev.stopPropagation(); mTryClose(); return; }
  if (ev.key !== 'Tab') return;
  const box = $('#modal .box'), f = [...box.querySelectorAll('a[href],button:not([disabled]),input:not([type=hidden]):not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])')].filter((x) => x.offsetParent !== null);
  if (!f.length) return;
  const first = f[0], last = f[f.length - 1];
  if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
  else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
}, true);
document.addEventListener('click', (ev) => { if (ev.target.id === 'modal') { ev.stopPropagation(); mTryClose(); } }, true);

/* ---------- ترتيب القائمة: تجميع الوظائف المتشابهة وإبراز الأكثر استعمالاً ---------- */
(() => {
  const top = NAV[0][1], stay = top.filter((x) => x[0] === 'home'), move = top.filter((x) => x[0] !== 'home');
  const d = move.find((x) => x[0] === 'dash'); if (d) d[1] = 'مؤشرات التحضير';
  const ord = ['roll', 'qr', 'sync', 'alerts', 'insights', 'dash'];
  move.sort((a, b) => (ord.indexOf(a[0]) + 1 || 99) - (ord.indexOf(b[0]) + 1 || 99));
  NAV[0][1] = stay;
  NAV.splice(1, 0, ['التحضير والمتابعة', move]);
  const want = ['', 'التحضير والمتابعة', 'إدارة الاختبارات ورصد الدرجات', 'الإرشاد والسلوك', 'التقارير', 'الأدوات', 'الإدارة'];
  NAV.sort((a, b) => (want.indexOf(a[0]) + 1 || 50) - (want.indexOf(b[0]) + 1 || 50));
})();
