/* ====================================================================
   الموجة الثانية: إعادة التنظيم
   1) لوحة قيادة واحدة ببطاقات قابلة للنقر تتصدر الرئيسية.
   2) بحث موحد: متدرب أو شعبة أو واجهة، من مكان واحد.
   3) مركز التقارير: مدخل واحد لكل تقارير المنصة بلا نقل أي واجهة.
   4) مسار تنقل وزر رجوع في كل واجهة.
   تُضيف ولا تحذف: كل واجهة ووظيفة سابقة باقية كما هي.
   ==================================================================== */
/* ---------- 1) لوحة القيادة الموحدة ---------- */
function hKpi() {
  const m = A.m, t = today(), d = H.dashboard(m, t, nowMin());
  const tot = d.pres + d.abs + d.late + d.exc;
  const o = { trainees: d.unique, rate: tot ? Math.round(((d.pres + d.late) / tot) * 100) : null, abs: d.abs, late: d.late, exc: d.exc, near: 0, reached: 0, viol: 0, cases: 0, gopen: 0, gready: 0, tacc: 0, urgent: 0 };
  try { const a = alertRows(m); o.near = a.near.length; o.reached = a.reached.length; } catch (e) { /* */ }
  try { o.viol = Object.values(A.raw.bviol || {}).filter((v) => v && v.status && !/مغلق|ملغ/.test(v.status)).length; } catch (e) { /* */ }
  try { o.cases = Object.values(A.raw.bcase || {}).filter((c) => c && c.status && !/مغلق/.test(c.status)).length; } catch (e) { /* */ }
  try { const secs = gSecs().filter((s) => gList(s.crn)); o.gopen = secs.filter((s) => { const k = gSt(s).k; return k !== 'closed' && k !== 'synced'; }).length; o.gready = secs.filter((s) => gSt(s).k === 'ready' || gSt(s).k === 'sched').length; } catch (e) { /* */ }
  try { o.tacc = tRoster().filter((x) => tMine(x)).filter((x) => { const a = tAcc(x.id); return !a || !(a.deliv && a.deliv.at); }).length; } catch (e) { /* */ }
  try { o.urgent = hInbox().filter((r) => r.p === 1).length; } catch (e) { /* */ }
  return o;
}
const hTile = (v, label, sub, view, kind) => `<div class="tile act ${kind || ''}" data-act="h-go" data-v="${view}" data-crn="" role="button" tabindex="0" title="افتح ${esc(label)}"><b>${v === null ? '—' : v}</b><span>${esc(label)}</span><small>${esc(sub)}</small></div>`;
function hCommand() {
  let k; try { k = hKpi(); } catch (e) { return ''; }
  return `<section class="panel hcmd"><div class="row between"><h2 style="margin:0">لوحة القيادة</h2><div class="sub">كل بطاقة تفتح موضعها</div></div>
  <div class="tiles kpi">
    ${hTile(k.urgent, 'يحتاج تدخلاً عاجلاً', 'مركز الإشعارات', 'inbox', k.urgent ? 'bad' : 'ok')}
    ${hTile(k.trainees, 'المتدربون', 'في شعبك', 'roll')}
    ${hTile(k.rate === null ? null : k.rate + '%', 'حضور اليوم', `غياب ${k.abs} • تأخر ${k.late} • عذر ${k.exc}`, 'roll', k.rate !== null && k.rate < 85 ? 'warn' : 'ok')}
    ${hTile(k.near, 'يفصلهم غياب واحد', 'عن الإنذار أو الحرمان', 'alerts', k.near ? 'warn' : '')}
    ${hTile(k.reached, 'بلغوا الحد', 'إنذار أو حرمان', 'alerts', k.reached ? 'bad' : '')}
    ${hTile(k.viol, 'مخالفات قيد المتابعة', 'الإرشاد والسلوك', 'bviol', k.viol ? 'warn' : '')}
    ${hTile(k.cases, 'حالات إرشادية مفتوحة', 'الإرشاد والسلوك', 'bcases')}
    ${hTile(k.gopen, 'شعب لم يُغلق رصدها', 'إدارة الاختبارات', 'gsecs')}
    ${hTile(k.gready, 'جاهزة للرفع إلى رايات', 'جدولة الرفع', 'gsched', k.gready ? 'ok' : '')}
    ${hTile(k.tacc, 'حسابات لم تُسلَّم', 'حسابات المتدربين', 'taccs', k.tacc ? 'warn' : 'ok')}
  </div></section>`;
}
/* تُركَّب اللوحة بعد رأس الصفحة في الرئيسية، فلا تُمس شيفرة الواجهة القديمة */
/* ---------- 2) البحث الموحد ---------- */
const HVIEWS = () => { const o = []; NAV.forEach(([g, items]) => items.forEach((x) => o.push({ k: x[0], label: x[1], grp: g || 'الرئيسية', perm: x[2] }))); return o; };
function hFind(q) {
  const n = G.normName(q), out = { people: [], secs: [], views: [] };
  if (!n || n.length < 2) return out;
  const seen = {};
  ((A.m && A.m.sections) || []).forEach((s) => {
    if (G.normName(`${s.crn} ${s.course} ${s.kind}`).includes(n)) out.secs.push({ crn: s.crn, course: s.course, kind: s.kind, n: s.rows.length });
    s.rows.forEach((r) => {
      if (!G.normName(`${r.name} ${r.id}`).includes(n) || seen[r.id]) return;
      seen[r.id] = 1; out.people.push({ id: r.id, name: r.name, crn: s.crn, course: s.course });
    });
  });
  HVIEWS().forEach((v) => { if (G.normName(v.label + ' ' + v.grp).includes(n) && (!v.perm || (v.perm === 'admin' ? isAdmin() : can(v.perm)))) out.views.push(v); });
  return out;
}
VIEWS.find = () => {
  const q = A.hq || '', r = hFind(q);
  const sec = (title, rows) => (rows.length ? `<section class="panel"><h2>${title} (${rows.length})</h2><div class="tw" style="max-height:38vh;overflow:auto"><table><tbody>${rows.join('')}</tbody></table></div></section>` : '');
  return `${gHead('البحث الموحد', 'ابحث باسم المتدرب أو رقمه التدريبي أو رقم الشعبة أو اسم واجهة، وافتح الموضع مباشرة.')}
  <section class="panel"><div class="row"><input type="search" id="hQ" placeholder="اسم متدرب، رقم تدريبي، رقم شعبة، اسم واجهة…" value="${esc(q)}" data-change="h-q" style="flex:1;min-width:240px" autofocus><button class="btn" data-act="h-qgo">ابحث</button></div>
  <div class="sub">${q.length >= 2 ? `نتائج البحث عن «${esc(q)}»: ${r.people.length + r.secs.length + r.views.length}` : 'اكتب حرفين على الأقل.'}</div></section>
  ${sec('متدربون', r.people.slice(0, 60).map((x) => `<tr><td><b>${esc(x.name)}</b><br><small class="sub">${esc(x.course)} — الشعبة ${x.crn}</small></td><td class="n" dir="ltr">${esc(x.id)}</td><td class="n"><div class="row"><button class="btn s" data-act="h-go" data-v="roll" data-crn="${x.crn}">التحضير</button><button class="btn s" data-act="h-go" data-v="bpeople" data-crn="">الإرشاد</button><button class="btn s" data-act="h-go" data-v="taccs" data-crn="">الحساب</button></div></td></tr>`))}
  ${sec('شعب', r.secs.map((x) => `<tr><td><b>الشعبة ${esc(x.crn)}</b><br><small class="sub">${esc(x.course)} — ${esc(x.kind)} — ${x.n} متدرباً</small></td><td class="n"><div class="row"><button class="btn s" data-act="h-go" data-v="roll" data-crn="${x.crn}">التحضير</button><button class="btn s" data-act="h-go" data-v="gsec" data-crn="${x.crn}">الدرجات</button></div></td></tr>`))}
  ${sec('واجهات', r.views.map((x) => `<tr><td><b>${esc(x.label)}</b><br><small class="sub">${esc(x.grp)}</small></td><td class="n"><button class="btn s" data-act="h-go" data-v="${x.k}" data-crn="">افتح</button></td></tr>`))}`;
};
Object.assign(CHG, { 'h-q': (e) => { A.hq = e.value; clearTimeout(A.hqT); A.hqT = setTimeout(() => { if (A.view === 'find') { render(true); const i = $('#hQ'); if (i) { i.focus(); i.setSelectionRange(i.value.length, i.value.length); } } }, 220); } });
ACT['h-qgo'] = () => { const i = $('#hQ'); if (i) A.hq = i.value; render(true); };
VIEW_CHG.add('h-q'); VIEW_ACTS.add('h-qgo');
/* ---------- 3) مركز التقارير ---------- */
const HREP = [
  ['reports', 'تقارير التحضير', 'كشوف الحضور والغياب والنسب لكل شعبة ومتدرب، مع الطباعة والتصدير.'],
  ['notice', 'نماذج الإنذار', 'نموذج إنذار جاهز للطباعة لكل متدرب بلغ الحد.'],
  ['excuses', 'سجل الاستئذان', 'الأعذار المسجلة وحالاتها.'],
  ['greports', 'تقارير الدرجات', 'كشوف الرصد والتوزيع وحالات الاعتماد والرفع.'],
  ['breports', 'تقارير الإرشاد والسلوك', 'المخالفات والحالات والإجراءات.'],
  ['alerts', 'الإنذار المبكر', 'من يقترب من الإنذار والحرمان قبل وقوعه.'],
  ['insights', 'التحليلات الذكية', 'مؤشرات وتحليلات على بيانات التحضير.'],
  ['glog', 'سجل العمليات والتدقيق', 'كل العمليات الحساسة، قابلة للتصفية والتصدير.'],
];
VIEWS.rephub = () => {
  const av = new Set(HVIEWS().map((v) => v.k));
  return `${gHead('مركز التقارير', 'كل تقارير المنصة من مدخل واحد: التحضير والإنذار والدرجات والإرشاد والسجلات.')}
  <section class="panel"><div class="tw"><table><thead><tr><th>التقرير</th><th>ما يعرضه</th><th class="n">الإجراء</th></tr></thead><tbody>${HREP.filter((r) => av.has(r[0]) || VIEWS[r[0]]).map((r) => `<tr><td><b>${esc(r[1])}</b></td><td style="font-size:12.5px">${esc(r[2])}</td><td class="n"><button class="btn s p" data-act="h-go" data-v="${r[0]}" data-crn="">افتح</button></td></tr>`).join('')}</tbody></table></div></section>
  ${dl && can('export') ? '<div class="gnote info">كل تقرير يُطبع أو يُصدَّر من داخله: الطباعة بهوية الكلية، والتصدير إلى Excel حيث يتاح.</div>' : ''}`;
};
/* ---------- 4) مسار التنقل وزر الرجوع ---------- */
const HCRUMB = { gsec: ['إدارة الاختبارات ورصد الدرجات', 'تفاصيل الشعبة'], report: ['التقارير', 'تقرير مفصل'], weekly: ['التقارير', 'التقرير الأسبوعي'], find: ['', 'البحث الموحد'], rephub: ['التقارير', 'مركز التقارير'] };
const HBACK = [];
function hCrumbNow() {
  const main = $('#main'); if (!main) return;
  const old = main.querySelector('.hcrumb'); if (old) old.remove();
  if (!A.me || A.view === 'home') return;
  let grp = '', label = '';
  const v = HVIEWS().find((x) => x.k === A.view);
  if (v) { grp = v.grp === 'الرئيسية' ? '' : v.grp; label = v.label; }
  else if (HCRUMB[A.view]) { grp = HCRUMB[A.view][0]; label = HCRUMB[A.view][1]; }
  else return;
  const back = HBACK.length > 1 ? HBACK[HBACK.length - 2] : null;
  const bl = back ? (HVIEWS().find((x) => x.k === back) || {}).label || (HCRUMB[back] || [])[1] || 'السابق' : '';
  const el = document.createElement('nav');
  el.className = 'hcrumb'; el.setAttribute('aria-label', 'مسار التنقل');
  el.innerHTML = `${back ? `<button class="btn s" data-act="h-back" title="رجوع إلى ${esc(bl)}">رجوع</button>` : ''}<a href="#home" data-v="home">الرئيسية</a>${grp ? `<i>›</i><span>${esc(grp)}</span>` : ''}<i>›</i><b>${esc(label)}</b>`;
  main.insertBefore(el, main.firstChild);
}
ACT['h-back'] = () => { HBACK.pop(); const to = HBACK.pop() || 'home'; go(to); };
VIEW_ACTS.add('h-back');
{
  const prev = render;
  render = function (keep) {
    prev(keep);
    try {
      if (A.me && A.view && HBACK[HBACK.length - 1] !== A.view) { HBACK.push(A.view); if (HBACK.length > 12) HBACK.shift(); }
      hCrumbNow();
      if (A.me && A.view === 'home') { const main = $('#main'); if (main && !main.querySelector('.hcmd')) { const head = main.querySelector('.head'), box = document.createElement('div'); box.innerHTML = hCommand(); const el = box.firstElementChild; if (el) { if (head && head.nextSibling) main.insertBefore(el, head.nextSibling); else main.appendChild(el); } } }
    } catch (e) { /* لا يمنع العرض */ }
  };
}
/* ---------- القائمة: مدخلان جديدان بلا نقل أي واجهة ---------- */
NAV.find((g) => g[0] === 'التقارير')[1].unshift(['rephub', 'مركز التقارير']);
(() => {
  /* مركز الإشعارات والبحث في أعلى القائمة: كلاهما يخدم كل الأقسام */
  NAV.forEach((g, i) => { if (!i) return; const k = g[1].findIndex((x) => x[0] === 'inbox'); if (k >= 0) g[1].splice(k, 1); });
  const top = NAV[0][1];
  if (!top.some((x) => x[0] === 'inbox')) top.splice(1, 0, ['inbox', 'مركز الإشعارات']);
  if (!top.some((x) => x[0] === 'find')) top.push(['find', 'البحث الموحد']);
  const gl = NAV.find((g) => g[0] === 'إدارة الاختبارات ورصد الدرجات');
  if (gl) { const it = gl[1].find((x) => x[0] === 'glog'); if (it) it[1] = 'سجل العمليات والتدقيق'; }
})();
