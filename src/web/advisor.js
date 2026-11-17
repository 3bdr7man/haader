/* ====================================================================
   الاستعلام عن المرشد التدريبي برقم المتدرب التدريبي
   - المدرب ورئيس القسم ومسؤول المنصة: نافذة «الاستعلام عن المرشد» في القائمة (الأدوات)
   - المتدرب: بطاقة في بوابته
   لا يُعرض إلا اسم المرشد. الحالات: الحقل فارغ، رقم غير صالح، لا متدرب بهذا الرقم، لا مرشد مسجل.
   المصدر: في الويب advisor_lookup على الخادم، وفي نسخة Claude بيانات الإرشاد في قاعدة بياناتها.
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const W = window.HAADER_WEB || null;
  const DIG = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9' };
  const norm = (v) => String(v == null ? '' : v).replace(/\s+/g, '').replace(/[٠-٩۰-۹]/g, (c) => DIG[c]);
  const check = (v) => (!v ? 'empty' : /^\d{9}$/.test(v) ? null : 'invalid');
  /* نسخة Claude: من بيانات الإرشاد والكشوف المحلية */
  function local(t) {
    const B = (A.raw && A.raw.bosla) || {}, r = ((B['t' + t.slice(-1)] || {}).rows || {})[t];
    if (!r) {
      const inSec = ['sections', 'gsec'].some((c) => Object.values((A.raw && A.raw[c]) || {}).some((s) => (s.rows || []).some((x) => x.id === t)));
      return { st: inSec ? 'no_advisor' : 'not_found' };
    }
    if (!r.adv) return { st: 'no_advisor' };
    const a = ((B.adv || {}).rows || {})[r.adv];
    if (!a) return { st: 'no_advisor' };
    const acc = a.acct ? ((A.raw.accounts || {})[a.acct] || {}) : {};
    const name = String(acc.name || a.n || '').trim();
    return name ? { st: 'ok', name } : { st: 'no_advisor' };
  }
  async function lookup(raw) {
    const t = norm(raw), bad = check(t);
    if (bad) return { st: bad, id: t };
    try {
      const r = W ? await W.rpc('advisor_lookup', { p_id: t }) : local(t);
      return Object.assign({ id: t }, r && r.st ? r : { st: 'error' });
    } catch (e) { return { st: 'error', id: t, msg: (e && e.message) || '' }; }
  }
  const MSG = {
    empty: ['warn', 'اكتب الرقم التدريبي للمتدرب أولاً.'],
    invalid: ['warn', 'الرقم التدريبي غير صالح: يتكون من 9 أرقام دون حروف أو رموز.'],
    not_found: ['bad', 'لم يُعثر على متدرب بهذا الرقم التدريبي. تحقق من الرقم وأعد البحث.'],
    no_advisor: ['info', 'لا يوجد مرشد تدريبي مسجل لهذا المتدرب حتى الآن. راجع رئيس القسم.'],
    error: ['bad', 'تعذّر الاستعلام الآن. تحقق من الاتصال وأعد المحاولة.']
  };
  function resultHTML(r) {
    if (!r) return '';
    if (r.st === 'ok') return `<div class="advq-res ok"><small>المرشد التدريبي للمتدرب صاحب الرقم <span dir="ltr">${esc(r.id)}</span></small><b class="advq-name">${esc(r.name)}</b></div>`;
    const m = MSG[r.st] || MSG.error;
    return `<div class="advq-res ${m[0]}">${esc(m[1])}</div>`;
  }
  const formHTML = (pre, val, res, busy) => `<form class="advq-f" data-advq="${pre}" novalidate><label>الرقم التدريبي<input type="text" id="${pre}Id" inputmode="numeric" dir="ltr" maxlength="14" autocomplete="off" placeholder="مثال: 446000000" value="${esc(val || '')}" aria-describedby="${pre}Out"></label><button class="btn p" ${busy ? 'disabled' : ''}>${busy ? 'جارٍ البحث…' : 'بحث'}</button></form><div id="${pre}Out" class="advq-out" role="status" aria-live="polite">${resultHTML(res)}</div>`;

  /* ---------- المدرب ورئيس القسم ومسؤول المنصة: نافذة في القائمة ---------- */
  const S = { val: '', res: null, busy: false };
  const allowed = () => !!(A.me && !isViewer());
  NAV.forEach(([g, items]) => { if (g === 'الأدوات' && !items.some((x) => x[0] === 'advq')) items.unshift(['advq', 'الاستعلام عن المرشد']); });
  const baseNav = buildNav;
  buildNav = function () { baseNav.apply(this, arguments); if (!allowed()) { const a = document.querySelector('#nav a[data-v="advq"]'); if (a) a.remove(); } };
  VIEWS.advq = () => {
    if (!allowed()) return '<div class="panel empty"><h2>الاستعلام عن المرشد</h2><p>هذه النافذة للمتدرب والمدرب ورئيس القسم.</p></div>';
    return `<div class="head hero"><div><h1>الاستعلام عن المرشد التدريبي</h1><div class="sub">اكتب الرقم التدريبي للمتدرب ثم اضغط «بحث» لمعرفة مرشده التدريبي.</div></div></div>
    <section class="panel advq">${formHTML('advq', S.val, S.res, S.busy)}</section>`;
  };
  /* ---------- المتدرب: بطاقة في بوابته ---------- */
  const T = { val: null, res: null, busy: false };
  function portalCard(myId) {
    if (T.val === null) T.val = myId || '';
    return `<section class="tp-card advq tp-advq"><h2>الاستعلام عن المرشد التدريبي</h2><p class="sub">اكتب الرقم التدريبي ثم اضغط «بحث».</p>${formHTML('tpAdv', T.val, T.res, T.busy)}</section>`;
  }
  async function run(pre) {
    const st = pre === 'advq' ? S : T, inp = document.getElementById(pre + 'Id');
    st.val = inp ? inp.value : st.val; st.busy = true; repaint(pre);
    st.res = await lookup(st.val); st.busy = false; repaint(pre);
    const out = document.getElementById(pre + 'Out'), i2 = document.getElementById(pre + 'Id');
    if (i2 && st.res && st.res.st !== 'ok') { i2.setAttribute('aria-invalid', 'true'); i2.focus(); }
    if (out) out.scrollIntoView({ block: 'nearest' });
  }
  function repaint(pre) {
    const f = document.querySelector(`form[data-advq="${pre}"]`); if (!f) return;
    const st = pre === 'advq' ? S : T, out = document.getElementById(pre + 'Out'), btn = f.querySelector('button');
    if (btn) { btn.disabled = st.busy; btn.textContent = st.busy ? 'جارٍ البحث…' : 'بحث'; }
    if (out) out.innerHTML = st.busy ? '' : resultHTML(st.res);
  }
  document.addEventListener('submit', (ev) => {
    const f = ev.target.closest && ev.target.closest('form[data-advq]'); if (!f) return;
    ev.preventDefault(); ev.stopPropagation(); run(f.dataset.advq);
  }, true);
  document.addEventListener('input', (ev) => { const i = ev.target; if (i && (i.id === 'advqId' || i.id === 'tpAdvId')) { (i.id === 'advqId' ? S : T).val = i.value; i.removeAttribute('aria-invalid'); } });
  window.HAADER_ADV = { lookup, portalCard, norm, check, local };
})();
