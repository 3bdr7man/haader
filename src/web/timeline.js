/* ====================================================================
   الخط الزمني لأعمال الفصل التدريبي: تنبيه في كل الحسابات (المسؤول ورئيس القسم
   والمدربين في كل واجهة ولكل الشعب) وفي بوابة المتدرب.
   المصدر وثيقة meta/timeline في قاعدة بيانات المنصة: { title, source, show, tl:[{n,g,t,w,from,to,note,one,chk}] }
   والتواريخ هجرية (أم القرى) كما وردت في تعميم الإدارة العامة لشؤون المتدربين.
   يعرض التنبيه ما يجري الآن وما يبدأ خلال 30 يوماً، والجدول كاملاً في نافذة.
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const SOON = 30;
  const pad = (n) => String(n).padStart(2, '0');
  let fmtH = null;
  try { fmtH = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Asia/Riyadh' }); } catch (e) { fmtH = null; }
  const hOf = (d) => { if (!fmtH) return ''; const p = {}; fmtH.formatToParts(d).forEach((x) => { p[x.type] = x.value; }); return `${p.year}-${pad(p.month)}-${pad(p.day)}`; };
  /* جدول الأيام: تاريخ هجري ← عدد الأيام من اليوم (يُبنى مرة في اليوم) */
  let cache = { day: '', map: {} };
  function days() {
    const today = hOf(new Date());
    if (cache.day !== today) {
      const map = {}, base = Date.now();
      for (let i = -400; i <= 500; i++) { const h = hOf(new Date(base + i * 864e5)); if (!(h in map)) map[h] = i; }
      cache = { day: today, map };
    }
    return cache;
  }
  const off = (h) => { const m = days().map; return h in m ? m[h] : null; };
  const showD = (h) => (h ? `${h}هـ` : '');
  /* حالة البند: now يجري الآن، soon لم يبدأ، done انتهى، open بلا تاريخ بداية محدد */
  function state(r) {
    const today = days().day, from = r.chk ? null : r.from, to = r.to;
    if (!today) return { k: 'open' };
    if (to && today > to) return { k: 'done' };
    if (from && today < from) { const d = off(from); return { k: 'soon', d }; }
    if (from && today >= from && (!to || today <= to)) { const d = to ? off(to) : null; return { k: 'now', d }; }
    return { k: 'open', d: to ? off(to) : null };
  }
  const daysTxt = (n) => (n === 1 ? 'يوم واحد' : n === 2 ? 'يومان' : n >= 3 && n <= 10 ? `${n} أيام` : `${n} يوماً`);
  function badge(r, s) {
    if (s.k === 'now') return s.d === 0 || r.one ? '<span class="chip bad">اليوم</span>' : `<span class="chip warn">جارٍ الآن${s.d != null ? ' — يبقى ' + daysTxt(s.d) : ''}</span>`;
    if (s.k === 'soon') return `<span class="chip info">${s.d != null ? (s.d === 1 ? 'يبدأ غداً' : 'يبدأ بعد ' + daysTxt(s.d)) : 'قادم'}</span>`;
    if (s.k === 'done') return '<span class="chip">انتهى</span>';
    return '';
  }
  const period = (r) => (r.one || (r.from && r.from === r.to) ? showD(r.from || r.to) : r.from && r.to ? `${showD(r.from)} ← ${showD(r.to)}` : r.to ? `${r.note ? esc(r.note) + ' ← ' : ''}${showD(r.to)}` : esc(r.note || ''));
  function picks(doc) {
    const all = ((doc && doc.tl) || []).map((r) => ({ r, s: state(r) }));
    const now = all.filter((x) => x.s.k === 'now').sort((a, b) => (a.s.d ?? 999) - (b.s.d ?? 999));
    const up = all.filter((x) => x.s.k === 'soon' && x.s.d != null).sort((a, b) => a.s.d - b.s.d);
    let soon = up.filter((x) => x.s.d <= SOON);
    if (!soon.length && up.length) soon = up.filter((x) => x.s.d === up[0].s.d);
    return { now, soon, all };
  }
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* تفضيل للجلسة */ } } };
  const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';

  /* التنبيه: where = 'staff' أعلى كل واجهة، أو 'tp' في بوابة المتدرب */
  function bar(doc, where) {
    if (!doc || doc.show === false || !(doc.tl || []).length) return '';
    const p = picks(doc), list = p.now.concat(p.soon);
    const min = ss.get('haader.tlMin') === (doc.at || '1');
    const head = `<div class="tlh"><span class="tli">${ICON}</span><div class="tlt"><b>${esc(doc.title || 'الخط الزمني لأعمال الفصل التدريبي')}</b><small>اليوم ${showD(days().day)}${doc.source ? ' • ' + esc(doc.source) : ''}</small></div><div class="tlb"><button class="btn s" data-tl="all">الخط الزمني كاملاً</button><button class="btn s" data-tl="${min ? 'max' : 'min'}" aria-expanded="${!min}">${min ? 'إظهار' : 'تصغير'}</button></div></div>`;
    const items = list.length ? `<ul class="tll">${list.map(({ r, s }) => `<li class="${s.k}">${badge(r, s)}<span class="tlx"><b>${esc(r.t)}</b><small>${esc(r.w || '')} • ${period(r)}</small></span></li>`).join('')}</ul>` : '<p class="sub">لا مواعيد جارية ولا قادمة في الخط الزمني.</p>';
    return `<section class="${where === 'tp' ? 'tp-card ' : ''}tlbar${min ? ' min' : ''}" id="${where === 'tp' ? 'tlBarTp' : 'tlBar'}" role="note" aria-label="تنبيه: الخط الزمني لأعمال الفصل التدريبي">${head}${min ? '' : items}</section>`;
  }
  function full(doc) {
    if (!doc) return;
    const p = picks(doc), groups = [];
    p.all.forEach((x) => { let g = groups.find((y) => y.g === x.r.g); if (!g) groups.push(g = { g: x.r.g, rows: [] }); g.rows.push(x); });
    const ov = document.createElement('div'); ov.className = 'tl-ov'; ov.dir = 'rtl';
    ov.innerHTML = `<div class="tl-box" role="dialog" aria-modal="true" aria-label="${esc(doc.title || '')}"><div class="tlh"><span class="tli">${ICON}</span><div class="tlt"><b>${esc(doc.title || '')}</b><small>اليوم ${showD(days().day)}${doc.source ? ' • ' + esc(doc.source) : ''}</small></div><div class="tlb"><button class="btn s" data-tl="close">إغلاق</button></div></div>
      <div class="tw tl-tw"><table class="tl-t"><thead><tr><th class="n">م</th><th>المهمة</th><th>الجهة المسؤولة</th><th>بداية الفترة</th><th>نهاية الفترة</th><th>الحالة</th></tr></thead><tbody>${groups.map((g) => `<tr class="tlg"><th colspan="6">${esc(g.g)}</th></tr>${g.rows.map(({ r, s }) => {
        const one = r.one || (r.from && r.from === r.to) || (!r.from && !r.to);
        const a = one ? `<td colspan="2" class="n">${r.from || r.to ? showD(r.from || r.to) : esc(r.note || '')}</td>` : `<td class="n">${r.from ? showD(r.from) : `<span class="tln">${esc(r.note || '')}</span>`}</td><td class="n">${showD(r.to)}</td>`;
        return `<tr class="${s.k}"><td class="n">${r.n}</td><td>${esc(r.t)}${r.chk ? `<small class="tlc">${esc(r.chk)}</small>` : ''}</td><td>${esc(r.w || '')}</td>${a}<td>${badge(r, s)}</td></tr>`;
      }).join('')}`).join('')}</tbody></table></div></div>`;
    document.body.appendChild(ov);
    const b = ov.querySelector('[data-tl="close"]'); if (b) b.focus();
  }
  const staffDoc = () => (typeof A !== 'undefined' && A.raw && A.raw.meta ? A.raw.meta.timeline : null);
  const portalDoc = () => { const P = window.HAADER_PORTAL && window.HAADER_PORTAL.P; return P && P.data && P.data.meta ? P.data.meta.timeline : null; };
  const docNow = () => (document.getElementById('tportal') ? portalDoc() : staffDoc());
  function refresh() {
    [['tlBar', 'staff', staffDoc], ['tlBarTp', 'tp', portalDoc]].forEach(([id, w, f]) => { const old = document.getElementById(id); if (!old) return; const h = bar(f(), w); if (h) old.outerHTML = h; else old.remove(); });
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('[data-tl]');
    if (!b) { if (ev.target.classList && ev.target.classList.contains('tl-ov')) ev.target.remove(); return; }
    const k = b.dataset.tl, d = docNow();
    if (k === 'all') full(d);
    else if (k === 'close') { const o = b.closest('.tl-ov'); if (o) o.remove(); }
    else if (k === 'min' || k === 'max') { ss.set('haader.tlMin', k === 'min' ? ((d && d.at) || '1') : ''); refresh(); }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') { const o = document.querySelector('.tl-ov'); if (o) { o.remove(); ev.stopPropagation(); } } }, true);

  /* كل الحسابات: أعلى كل واجهة في المنصة */
  const baseRender = render;
  render = function () {
    const r = baseRender.apply(this, arguments);
    try {
      const main = document.getElementById('main');
      if (main && A.me && !document.getElementById('tlBar')) { const h = bar(staffDoc(), 'staff'); if (h) main.insertAdjacentHTML('afterbegin', h); }
    } catch (e) { /* العرض أولاً */ }
    return r;
  };
  window.HAADER_TL = { bar, full, state, picks, today: () => days().day };
})();
