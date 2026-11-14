/* ====================================================================
   الموجة الثالثة: الصقل البصري وإمكانية الوصول
   1) فرز الأعمدة وتجميد الرؤوس في جداول الواجهات، تلقائياً وبلا تعديل أي واجهة.
   2) مجموعة أيقونات موحدة في القائمة الجانبية.
   3) حالة فارغة واضحة لكل جدول لا بيانات فيه.
   4) إمكانية الوصول: تخطٍّ إلى المحتوى، aria-current، scope للأعمدة،
      تفعيل البطاقات بلوحة المفاتيح، وإعلان ترتيب الفرز.
   تعمل كلها بعد كل عرض، ولا تمس منطق أي وظيفة ولا بياناتها.
   ==================================================================== */
const HICON = {
  home: 'M4 11.2 12 4l8 7.2M6 10v10h12V10',
  inbox: 'M4 13h4l2 3h4l2-3h4M4 13 6.5 5h11L20 13v6H4z',
  find: 'M10.5 17a6.5 6.5 0 110-13 6.5 6.5 0 010 13zm4.8-1.7L20 20',
  roll: 'M5 6.5h14M5 12h14M5 17.5h9M19.5 16.2 17 18.7l-1.5-1.5',
  qr: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zm4 0h2v2h-2zm-4 4h6v2h-6z',
  sync: 'M12 20V5m0 0 5 5m-5-5-5 5M4 21h16',
  alerts: 'M12 3.6 2.6 20h18.8L12 3.6zm0 5.6v5.3m0 2.4v.9',
  insights: 'M4 20V9m5 11V4m5 16v-8m5 8V7',
  dash: 'M20.5 18a9 9 0 10-17 0M12 13l4-3.5',
  gdash: 'M20.5 18a9 9 0 10-17 0M12 13l4-3.5',
  gsecs: 'M3.5 5.5h17v13h-17zM3.5 10h17M9.5 10v8.5M15 10v8.5',
  gexams: 'M6 3.5h9l4 4V20.5H6zM15 3.5v4h4M9 13h6M9 16.5h4',
  gentry: 'M4 20h4L19 9a2.5 2.5 0 00-3.5-3.5L4.5 16.5 4 20z',
  greview: 'M12 21a9 9 0 110-18 9 9 0 010 18zm-3.8-9.2L11 14.6l5-5.4',
  gsched: 'M12 21a9 9 0 110-18 9 9 0 010 18zm0-13.5V12l3.5 2',
  gsync: 'M12 20V5m0 0 5 5m-5-5-5 5M4 21h16',
  glog: 'M5 4.5h14v15H5zM8.5 9h7M8.5 12.5h7M8.5 16h4',
  greports: 'M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h4',
  gcfg: 'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.5 1.5m8.4 8.4 1.5 1.5m0-11.4-1.5 1.5M7.8 16.2l-1.5 1.5',
  bdash: 'M12 11.5a3.8 3.8 0 100-7.6 3.8 3.8 0 000 7.6zM4.6 20.2a7.4 7.4 0 0114.8 0',
  binbox: 'M4 13h4l2 3h4l2-3h4M4 13 6.5 5h11L20 13v6H4z',
  bviol: 'M12 3.6 2.6 20h18.8L12 3.6zm0 5.6v5.3m0 2.4v.9',
  bcases: 'M4 7.5h16v12H4zM9 7.5V5h6v2.5M4 13h16',
  bpeople: 'M9 11a3.4 3.4 0 100-6.8A3.4 3.4 0 009 11zm-6 9a6.6 6.6 0 0112 0M16 11.4a2.8 2.8 0 100-5.6M18 20a5 5 0 00-2-4',
  bforms: 'M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h3',
  breports: 'M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h4',
  rephub: 'M4 7.5h5l2 2.5h9v9.5H4zM4 7.5V5h5',
  reports: 'M6 3.5h12v17H6zM9 8h6M9 12h6M9 16h4',
  notice: 'M6 3.5h9l4 4V20.5H6zM15 3.5v4h4M9.5 12h6M9.5 15.5h4',
  excuses: 'M5 5.5h14v13H5zM5 10h14M9 3.5v4M15 3.5v4',
  calendar: 'M4 6.5h16v13H4zM4 11h16M8.5 3.5v4M15.5 3.5v4',
  guide: 'M5 4.5h6.5a2 2 0 012 2V20H7a2 2 0 00-2 2zM19 4.5h-5a2 2 0 00-2 2V20h5a2 2 0 012 2z',
  taccs: 'M14.5 10.5a3.5 3.5 0 10-3.5 3.5M10.5 14 4 20.5V22h3v-2h2v-2h1.5z',
  perms: 'M12 3.5 5 6v6c0 4.3 3 7.6 7 8.5 4-.9 7-4.2 7-8.5V6l-7-2.5zm-2.6 8.3 2.1 2.2 3.5-3.6',
  devcenter: 'M4 5.5 9.5 4l5 1.5L20 4v14.5L14.5 20l-5-1.5L4 20zM9.5 4v14.5M14.5 5.5V20',
  users: 'M9 11a3.4 3.4 0 100-6.8A3.4 3.4 0 009 11zm-6 9a6.6 6.6 0 0112 0M16 11.4a2.8 2.8 0 100-5.6M18 20a5 5 0 00-2-4',
  secadmin: 'M3.5 5.5h17v13h-17zM3.5 10h17M9.5 10v8.5M15 10v8.5',
  org: 'M12 3.5 20 8v12H4V8l8-4.5zM9.5 20v-6h5v6',
  logins: 'M10 4.5H5v15h5M14 8l4 4-4 4M9 12h9',
  theme: 'M12 3.5a8.5 8.5 0 000 17c1.4 0 2-1 2-2s-.7-2-2-2h-1a2 2 0 010-4h3a5 5 0 005-5c0-2.3-3-4-7-4z',
  prefs: 'M12 15.2a3.2 3.2 0 100-6.4 3.2 3.2 0 000 6.4zM4 12h2m12 0h2M12 4v2m0 12v2M6.3 6.3l1.5 1.5m8.4 8.4 1.5 1.5m0-11.4-1.5 1.5M7.8 16.2l-1.5 1.5',
  log: 'M5 4.5h14v15H5zM8.5 9h7M8.5 12.5h7M8.5 16h4',
  sec: 'M3.5 5.5h17v13h-17z',
};
const hSvg = (k) => `<svg class="nico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${HICON[k] || HICON.sec}"/></svg>`;
function hNavIcons() {
  const nav = $('#nav'); if (!nav) return;
  nav.querySelectorAll('a[data-v]').forEach((a) => {
    if (!a.querySelector('.nico')) a.insertAdjacentHTML('afterbegin', hSvg(a.dataset.v));
    if (a.dataset.v === A.view) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}
/* ---------- فرز الأعمدة ---------- */
const hNum = (s) => { const t = String(s).trim().replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[\s,٬%٪]/g, ''); return /^-?\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null; };
function hSortTable(tb, ci, dir) {
  const body = tb.tBodies[0]; if (!body) return;
  const rows = [...body.rows];
  const key = (r) => { const c = r.cells[ci]; return c ? (c.innerText || '').trim() : ''; };
  const num = rows.every((r) => { const v = key(r); return v === '' || v === '—' || hNum(v) !== null; });
  rows.sort((a, b) => {
    const x = key(a), y = key(b);
    if (num) { const nx = hNum(x), ny = hNum(y); return ((nx === null ? -Infinity : nx) - (ny === null ? -Infinity : ny)) * dir; }
    return x.localeCompare(y, 'ar') * dir;
  });
  rows.forEach((r) => body.appendChild(r));
}
function hEnhanceTables() {
  const main = $('#main'); if (!main) return;
  main.querySelectorAll('table').forEach((tb) => {
    const head = tb.tHead, body = tb.tBodies[0];
    if (!head || !body) return;
    /* الجداول التي يُدخل فيها المدرب بيانات لا تُفرز: الفرز يُقلق موضع الصف أثناء العمل */
    const live = !!tb.querySelector('input,select,textarea,[contenteditable]');
    if (body.rows.length && !body.querySelector('.hempty')) {
      if (!live && body.rows.length >= 4 && !tb.dataset.hs) {
        tb.dataset.hs = '1';
        const tw = tb.closest('.tw');
        if (tw && tw.scrollHeight > tw.clientHeight + 4) tb.classList.add('thsticky');
        [...head.rows[0].cells].forEach((th, i) => {
          th.setAttribute('scope', 'col');
          if (th.classList.contains('nos')) return;
          th.classList.add('hsort'); th.tabIndex = 0; th.title = 'انقر للفرز';
          const run = () => {
            const cur = th.dataset.dir === 'asc' ? -1 : 1;
            [...head.rows[0].cells].forEach((o) => { delete o.dataset.dir; o.removeAttribute('aria-sort'); o.classList.remove('up', 'dn'); });
            th.dataset.dir = cur === 1 ? 'asc' : 'desc';
            th.setAttribute('aria-sort', cur === 1 ? 'ascending' : 'descending');
            th.classList.add(cur === 1 ? 'up' : 'dn');
            hSortTable(tb, i, cur);
          };
          th.addEventListener('click', run);
          th.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); run(); } });
        });
      } else if (live) [...head.rows[0].cells].forEach((th) => th.setAttribute('scope', 'col'));
    } else if (!body.rows.length) {
      [...head.rows[0].cells].forEach((th) => th.setAttribute('scope', 'col'));
      const cols = head.rows[0].cells.length, tr = body.insertRow();
      tr.className = 'hempty';
      const td = tr.insertCell(); td.colSpan = cols;
      td.innerHTML = '<div class="hemptyb"><b>لا توجد بيانات لعرضها</b><span>سيظهر الجدول هنا بعد إضافة البيانات أو تغيير التصفية.</span></div>';
    }
  });
}
/* ---------- إمكانية الوصول ---------- */
function hA11y() {
  const main = $('#main'); if (!main) return;
  if (!main.id) main.id = 'main';
  main.setAttribute('role', 'main');
  if (!$('#hskip')) {
    const s = document.createElement('a');
    s.id = 'hskip'; s.href = '#main'; s.textContent = 'تخطَّ إلى المحتوى';
    s.addEventListener('click', (e) => { e.preventDefault(); const m = $('#main'); if (m) { m.tabIndex = -1; m.focus(); } });
    document.body.insertBefore(s, document.body.firstChild);
  }
  const nav = $('#nav'); if (nav) { nav.setAttribute('role', 'navigation'); nav.setAttribute('aria-label', 'أقسام المنصة'); }
  main.querySelectorAll('.tile.act').forEach((t) => {
    if (t.dataset.ha) return; t.dataset.ha = '1';
    t.addEventListener('keydown', (ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); t.click(); } });
  });
}
{
  const prev = render;
  render = function (keep) {
    prev(keep);
    try { hNavIcons(); hEnhanceTables(); hA11y(); } catch (e) { /* الصقل لا يمنع العرض */ }
  };
}

/* ---------- سمة «حاضر»: أزرق الهوية لوناً رئيسياً وأخضر الإنجاز لوناً مميزاً ---------- */
SKINS.unshift(['haader', 'حاضر: أزرق الهوية وأخضر الإنجاز', ['#003366', '#0066CC', '#1B9E63']]);
{
  const prev = VIEWS.theme;
  VIEWS.theme = () => prev() + `<section class="panel"><h2>عن سمة «حاضر»</h2>
  <div>هوية المؤسسة العامة للتدريب التقني والمهني تعتمد الأزرق الداكن <b dir="ltr">#003366</b> والأزرق الفاتح <b dir="ltr">#0066CC</b> وخط Cairo للعربية، وتمنع تعديل الهوية في وحداتها. ولأن المنصة تُعرض داخل الكلية وتُطبع تقاريرها باسمها، تحافظ سمة «حاضر» على أزرق الهوية في الرأس والقائمة والطباعة، وتجعل <b>الأخضر لون الإنجاز والانتظام</b> في المؤشرات وأشرطة التقدم وبطاقات لوحة القيادة.</div>
  <div class="sub" style="margin-top:6px">وإن أردت الأخضر لوناً رئيسياً كاملاً فسمة «أخضر وطني» و«ألوان الشعار» متاحتان أعلاه، والتبديل فوري ويُطبَّق على كل المستخدمين.</div></section>`;
}
