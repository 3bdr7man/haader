/* ====================================================================
   الإصدار البصري المطوّر (v2): شريط علوي زجاجي، ونافذة ملف شخصي، وأيقونات
   للبطاقات الإحصائية، وظهور تدريجي عند تغيير الصفحة، وتدرج للرسوم البيانية.
   لا يغيّر أي وظيفة: يضيف عناصر عرض فقط، ويُلغى كله من «المظهر المطوّر».
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const KEY = 'haader.look';
  const getLook = () => { try { return localStorage.getItem(KEY) || 'v2'; } catch (e) { return 'v2'; } };
  const setLook = (v) => { try { localStorage.setItem(KEY, v); } catch (e) { /* تفضيل للعرض فقط */ } document.documentElement.setAttribute('data-look', v); };
  document.documentElement.setAttribute('data-look', getLook());

  /* تدرجات الرسوم البيانية (تُستخدم بـ url(#v2bar)) */
  const defs = document.createElement('div');
  defs.setAttribute('aria-hidden', 'true');
  defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  defs.innerHTML = '<svg width="0" height="0"><defs><linearGradient id="v2bar" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0066CC"/><stop offset=".7" stop-color="#3B82F6"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient><linearGradient id="v2barh" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#0BBCB2"/><stop offset="1" stop-color="#7C5CFF"/></linearGradient></defs></svg>';
  document.body.appendChild(defs);

  /* ---------- أيقونات البطاقات الإحصائية ---------- */
  const P = {
    people: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    check: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/>',
    alert: '<path d="m10.29 3.86-8.47 14.7A2 2 0 0 0 3.54 21h16.92a2 2 0 0 0 1.72-2.44L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.93 4.93 14.14 14.14"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 5-6"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5z"/><path d="M4 19.5V21h16"/>',
    grade: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    compass: '<circle cx="12" cy="12" r="10"/><path d="m16.24 7.76-2.12 6.36-6.36 2.12 2.12-6.36z"/>',
    pct: '<path d="M19 5 5 19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    bolt: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  };
  const RULES = [
    [/حرمان|محروم|بلغوا الحد|سحب/, 'ban'], [/إنذار|إنذارات|تدخل|عاجل|مخالف/, 'alert'], [/تأخر|تأخير|متأخر|وقت|دقائق/, 'clock'],
    [/حضور|حاضر|نسبة|معدل|متوسط|٪|%/, 'pct'], [/غياب|يفصلهم|مستحقة|لم يُحضَّر|لم تُحضّر/, 'flag'], [/متدرب|المتدربون|متدربين|حساب/, 'people'],
    [/شعب|شعبة|مقرر/, 'layers'], [/محاضر|جلسة|أسبوع|يوم|تاريخ|موعد|جدول/, 'cal'], [/درجة|درجات|رصد|اختبار/, 'grade'],
    [/رفع|مزامنة|رايات/, 'upload'], [/مجمد|مقفل|اعتماد|مغلق/, 'lock'], [/كلمة المرور|تسليم/, 'key'], [/إرشاد|حالات|سلوك/, 'compass'],
    [/مكتمل|جاهز|تم|منفذة/, 'check'], [/تحليل|مقارنة|مؤشر/, 'chart'],
  ];
  const iconFor = (t) => { for (const [re, k] of RULES) if (re.test(t)) return k; return 'bolt'; };
  function decorateTiles(root) {
    if (document.documentElement.getAttribute('data-look') !== 'v2') return;
    (root || document).querySelectorAll('#main .tile:not(.has-ic)').forEach((el) => {
      const w = el.offsetWidth || 0, num = ((el.querySelector('b') || {}).textContent || '').trim(); if (w && (w < 96 || (w < 170 && num.length > 3))) return;
      const lab = (el.querySelector('span') || el).textContent || '';
      const i = document.createElement('i'); i.className = 'v2-ic'; i.setAttribute('aria-hidden', 'true');
      i.innerHTML = `<svg viewBox="0 0 24 24">${P[iconFor(lab)]}</svg>`;
      el.classList.add('has-ic'); if (w && w < 170) el.classList.add('ic-n'); el.appendChild(i);
    });
  }

  /* ---------- الشريط العلوي ---------- */
  const shell = document.getElementById('shell'), main = document.getElementById('main');
  const top = document.createElement('header'); top.id = 'topbar'; top.setAttribute('dir', 'rtl');
  shell.insertBefore(top, main);
  const initial = () => (A.me && A.me.name ? String(A.me.name).replace(/^(م|د|أ)\.\s*/, '').trim().charAt(0) : 'ح') || 'ح';
  const roleLabel = () => (!A.me ? '' : A.asTrainer ? 'مدرب (من حساب المسؤول)' : isAdmin() ? 'مسؤول المنصة' : isViewer() ? 'اطلاع فقط' : A.me.role === 'head' ? 'رئيس القسم' : 'مدرب');
  const avBtn = (cls) => `<button class="v2-av ${cls || ''}" data-v2prof aria-haspopup="dialog" aria-label="الملف الشخصي"><span class="v2-ava">${esc(initial())}</span><span class="nm">${esc((A.me && A.me.name) || '')}</span></button>`;
  /* التاريخ من تقويم المنصة نفسه (كما في لوحة المتابعة) */
  const dateText = () => { try { const t = today(), c = A.m && A.m.cal ? A.m.cal.find((x) => x.serial === t) : null; return c ? `${c.day} ${c.hijri}هـ • ${gregText(t)}م` : `${gregText(t)}م`; } catch (e) { return ''; } };
  function paintTop() {
    if (!A.me || shell.hidden) return;
    const on = document.querySelector('#nav a.on'); let grp = '';
    if (on) { let p = on.previousElementSibling; while (p && !p.classList.contains('grp')) p = p.previousElementSibling; grp = p ? p.textContent : ''; }
    const title = on ? on.textContent.replace(/\d+$/, '').trim() : 'منصة حاضر';
    const key = [title, grp, A.me.name, A.asTrainer ? 1 : 0, new Date().toDateString()].join('|');
    if (top.dataset.k === key) return; top.dataset.k = key;
    top.innerHTML = `<div class="tb-t"><small>${esc(grp || 'منصة حاضر')}</small><b>${esc(title)}</b></div><span class="tb-sp"></span><span class="tb-date">${esc(dateText())}</span>${avBtn()}`;
  }
  function paintWho() {
    const w = document.getElementById('who'); if (!w || !A.me || w.querySelector('.v2-av')) return;
    const row = w.querySelector('.row'); (row || w).insertAdjacentHTML('afterbegin', avBtn('mob'));
  }

  /* ---------- نافذة الملف الشخصي ---------- */
  const prof = document.createElement('div'); prof.id = 'v2prof'; prof.setAttribute('role', 'dialog'); prof.setAttribute('aria-label', 'الملف الشخصي'); prof.setAttribute('dir', 'rtl'); prof.setAttribute('lang', 'ar'); prof.hidden = true;
  document.body.appendChild(prof);
  const fmtDT = (iso) => { try { return new Date(iso).toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return ''; } };
  function openProf(anchor) {
    if (!A.me) return;
    const me = A.me, mine = Object.values(A.raw.sections || {}).filter((s) => s.trainer === me.id).length;
    const acts = [...document.querySelectorAll('#who [data-act]')].filter((b) => b.dataset.act !== 'logout').map((b) => `<button class="btn" data-act="${esc(b.dataset.act)}">${esc(b.textContent.trim())}</button>`).join('');
    const rows = [['اسم المستخدم', `<span dir="ltr">${esc(me.username || '')}</span>`], ['القسم', esc(me.dept || DEPT)], ['الجهة', esc(COLLEGE)], mine ? ['الشعب المسندة', String(mine)] : null, me.lastLogin ? ['آخر دخول', esc(fmtDT(me.lastLogin))] : null].filter(Boolean);
    const v2 = document.documentElement.getAttribute('data-look') === 'v2';
    prof.innerHTML = `<div class="pf-h"><span class="v2-ava">${esc(initial())}</span><div><b>${esc(me.name || '')}</b><small>${esc(roleLabel())}</small></div><button class="pf-x" data-v2close aria-label="إغلاق">✕</button></div>
      <dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      <div class="pf-sw"><div>المظهر المطوّر<small>الزجاج واللمسات البنفسجية والحركات</small></div><button class="v2-tg" role="switch" aria-checked="${v2}" data-v2look aria-label="المظهر المطوّر"></button></div>
      <div class="pf-a">${acts}<button class="btn" data-act="logout">تسجيل الخروج</button></div>`;
    prof.hidden = false;
    if (anchor && window.innerWidth > 860) { const r = anchor.getBoundingClientRect(), h = prof.offsetHeight || 420; prof.style.insetBlockStart = Math.max(12, Math.min(Math.round(r.bottom + 8), window.innerHeight - h - 12)) + 'px'; } else prof.style.insetBlockStart = '';
    const f = prof.querySelector('.v2-tg'); if (f) f.focus({ preventScroll: true });
    openProf.from = anchor || null;
  }
  const closeProf = () => { if (prof.hidden) return; prof.hidden = true; if (openProf.from && document.contains(openProf.from)) try { openProf.from.focus({ preventScroll: true }); } catch (e) { /* */ } };
  document.addEventListener('click', (ev) => {
    const t = ev.target;
    const av = t.closest && t.closest('[data-v2prof]');
    if (av) { ev.preventDefault(); ev.stopPropagation(); if (prof.hidden) openProf(av); else closeProf(); return; }
    if (t.closest && t.closest('[data-v2close]')) { closeProf(); return; }
    const sw = t.closest && t.closest('[data-v2look]');
    if (sw) { const on = sw.getAttribute('aria-checked') !== 'true'; sw.setAttribute('aria-checked', String(on)); setLook(on ? 'v2' : 'classic'); top.dataset.k = ''; if (on) { paintTop(); decorateTiles(); } return; }
    if (!prof.hidden && !prof.contains(t)) closeProf();
    else if (!prof.hidden && t.closest && t.closest('[data-act]')) setTimeout(closeProf, 0);
  }, true);
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && !prof.hidden) { ev.stopPropagation(); closeProf(); } }, true);

  /* ---------- الإشعارات: تمييز رسائل الخطأ ---------- */
  const baseToast = toast;
  const BAD = /تعذر|خطأ|لا يمكن|فشل|رُفض|مرفوض|غير صحيح|لا يُقبل|لا تُقبل|انتهت/;
  toast = function (t) { baseToast(t); const e = document.getElementById('toast'); if (e) { e.classList.toggle('v2-bad', BAD.test(String(t || ''))); e.style.animation = 'none'; void e.offsetWidth; e.style.animation = ''; } };
  window.toast = toast;

  /* ---------- الربط بالعرض: بعد كل رسم ---------- */
  let lastView = null;
  const baseRender = render;
  render = function (force) {
    const r = baseRender.apply(this, arguments);
    try {
      if (A.me && !shell.hidden) {
        paintTop(); paintWho(); decorateTiles();
        if (A.view !== lastView) {
          if (lastView !== null && document.documentElement.getAttribute('data-look') === 'v2') { main.classList.remove('v2-in'); void main.offsetWidth; main.classList.add('v2-in'); clearTimeout(render.v2t); render.v2t = setTimeout(() => main.classList.remove('v2-in'), 900); }
          lastView = A.view; closeProf();
        }
      } else { closeProf(); }
    } catch (e) { /* العرض أولاً: لا تمنع زخرفة فاشلة رسم الصفحة */ }
    return r;
  };
  window.HAADER_V2 = { setLook, getLook, decorateTiles, openProf, closeProf };
})();
