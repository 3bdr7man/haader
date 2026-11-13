/* ====================================================================
   3) الواجهات: قسم «إدارة الاختبارات ورصد الدرجات» بنوافذه العشر
   ==================================================================== */
NAV.splice(2, 0, ['إدارة الاختبارات ورصد الدرجات', [['gdash', 'لوحة قيادة الاختبارات'], ['gsecs', 'المقررات والشعب'], ['gexams', 'إدارة الاختبارات'], ['gentry', 'إدخال درجات المتدربين'], ['greview', 'مراجعة واعتماد الدرجات'], ['gsched', 'جدولة رفع الدرجات'], ['gsync', 'المزامنة مع منصة رايات'], ['glog', 'سجل عمليات الرصد والمزامنة'], ['greports', 'تقارير الدرجات'], ['gcfg', 'إعدادات توزيع الدرجات']]]);
SUB_OF.gsec = 'gsecs';

/* ---------- عناصر مشتركة ---------- */
const gHead = (title, sub, extra) => `<div class="head hero"><div><h1>${title}</h1><div class="sub">${sub}</div></div><div class="row">${extra || ''}</div></div>`;
const gStChip = (st) => `<span class="chip ${st.tone}"${st.why ? ` data-tip="${esc(st.why)}"` : ''}>${st.label}</span>`;
const gBar = (p, tone) => `<span class="gbar ${tone || ''}"><i style="width:${Math.round(p * 100)}%"></i></span><b class="gpc">${Math.round(p * 100)}%</b>`;
const gDistText = (sec) => { const p = G.parts(sec); return Object.keys(p).map((k) => `${k}: ${p[k].map((c) => `${c.k} ${G.fmt(c.max)}`).join(' + ')} = ${G.fmt(p[k].reduce((a, c) => a + c.max, 0))}`).join(' • '); };
const gLoading = () => (gReady() ? '' : '<div class="chip warn">جارٍ تحميل بيانات الدرجات…</div>');
const gNoData = (title) => `${gHead(title, 'لم تُحمَّل بيانات المقررات والشعب بعد.')}<section class="panel empty"><h2>${gReady() ? 'لا توجد شعب في قسم الدرجات' : 'جارٍ تحميل بيانات الدرجات…'}</h2>${gReady() ? `<p>${isAdmin() ? 'استورد ملف «درجات المقررات والشعب» من إعدادات توزيع الدرجات.' : 'يستورد مسؤول المنصة ملف توزيع الدرجات، ثم تظهر هنا الشعب المسندة إليك.'}</p>${isAdmin() ? '<a class="btn p" href="#gcfg">إعدادات توزيع الدرجات</a>' : ''}` : ''}</section>`;
const gHas = () => gSecs().length > 0;
const gSecTabs = (cur, act) => `<div class="tabs" role="tablist">${gSecs().map((s) => { const st = gSt(s); return `<button class="tab ${s.crn === cur ? 'on' : ''}" role="tab" aria-selected="${s.crn === cur}" data-act="${act}" data-crn="${s.crn}">${esc(s.code)} — ${s.crn}<small>${st.label}${gMay(s.crn) ? '' : ' • اطلاع'}</small></button>`; }).join('')}</div>`;
const gPick = () => { const l = gSecs(); if (!l.some((s) => s.crn === A.gCrn)) A.gCrn = (l.find((s) => gMay(s.crn)) || l[0] || {}).crn || null; return A.gCrn ? A.raw.gsec[A.gCrn] : null; };
const gStageStrip = (sec) => `<ol class="gstages">${G.stages(sec, gMarks(sec.crn), gNow(), gSet()).map((x) => `<li class="${x.s}"><b>${x.n}</b><span>${x.name}</span><small>${esc(x.t)}</small></li>`).join('')}</ol>`;
/* الإجراء التالي في الجدول الرئيسي */
function gNext(sec, st) {
  if (!gMay(sec.crn)) return ['g-open', 'عرض', ''];
  const due = st.k === 'sched' && st.why === 'حان موعد الرفع';
  return { none: ['g-enter', 'بدء الإدخال', ''], entry: ['g-enter', 'استكمال', ''], incomplete: ['g-enter', 'استكمال', ''], complete: ['g-approve-ask', 'مراجعة واعتماد', 'p'], review: ['g-go-review', 'مراجعة', ''], ready: ['g-up', 'رفع الدرجات', 'p'], sched: due ? ['g-up', 'رفع الدرجات', 'p'] : ['g-sched-ask', 'تعديل الموعد', ''], syncing: ['g-go-sync', 'متابعة المزامنة', 'p'], retry: ['g-go-sync', 'تحقق وأعد المحاولة', 'p'], failed: ['g-go-sync', 'تحقق وأعد المحاولة', 'p'], synced: ['g-close-ask', 'إغلاق الرصد', 'p'], closed: ['g-open', 'عرض', ''] }[st.k];
}
const gUpWhen = (sec, st) => { const s = (sec.flow || {}).sched || {}; if (st.k === 'closed' || st.k === 'synced') { const y = (sec.flow || {}).sync || {}; return y.at ? `رُفعت ${gDT(y.at)}` : '—'; } if (s.st === 'on' && s.at) return gWhen(s.at); if (s.st === 'paused' && s.at) return `${gWhen(s.at)} (موقوف)`; return 'يحدده المدرب'; };

/* ---------- المقررات والشعب: الواجهة الرئيسية للقسم ---------- */
VIEWS.gsecs = () => {
  if (!gHas()) return gNoData('المقررات والشعب');
  const courses = gCourses(), cur = courses.some((c) => c.code === GX.f.course) ? GX.f.course : '';
  const rows = gSecs().filter((s) => !cur || s.code === cur);
  return `${gHead('المقررات والشعب', isAdmin() || isHead() || isViewer() ? 'كل المقررات والشعب في القسم. اختر المقرر ثم الشعبة لفتح نافذتها.' : 'المقررات المسندة إليك. اختر المقرر ثم الشعبة لفتح نافذتها.')}${gLoading()}
  <div class="tabs" role="tablist"><button class="tab ${cur ? '' : 'on'}" data-act="g-course" data-v="">كل المقررات<small>${gSecs().length} شعب</small></button>${courses.map((c) => `<button class="tab ${c.code === cur ? 'on' : ''}" data-act="g-course" data-v="${esc(c.code)}">${esc(c.name)}<small>${esc(c.code)} • ${c.secs.length} شعب</small></button>`).join('')}</div>
  <section class="panel"><div class="tw"><table class="gmain"><thead><tr><th>المقرر</th><th class="n">الشعبة</th><th class="n">عدد المتدربين</th><th>اكتمال الرصد</th><th>موعد الرفع</th><th class="n">الحالة</th><th class="n">الإجراء</th></tr></thead><tbody>${rows.map((s) => { const st = gSt(s), nx = gNext(s, st); return `<tr><td><b>${esc(s.name)}</b><br><small class="sub">${esc(s.code)}${isAdmin() || isHead() || isViewer() ? ' • ' + esc(gOwnerName(s.crn)) : ''}</small></td><td class="n"><button class="lnk gcrn" data-act="g-open" data-crn="${s.crn}">${s.crn}</button></td><td class="n"><b>${st.stats.n}</b><br><small class="sub">${st.stats.elig} قابلاً للرصد</small></td><td>${gBar(st.stats.pct, st.stats.err ? 'bad' : st.stats.pct === 1 ? 'ok' : '')}<br><small class="sub">${st.stats.have} من ${st.stats.need} درجة</small></td><td style="font-size:13px">${esc(gUpWhen(s, st))}</td><td class="n">${gStChip(st)}</td><td class="n"><button class="btn s ${nx[2]}" data-act="${nx[0]}" data-crn="${s.crn}">${nx[1]}</button></td></tr>`; }).join('')}</tbody></table></div></section>
  <div class="sub">الشعب العملية في منصة تقني (63856، 63858، 74307) ليست أرقاماً مرجعية مستقلة في رايات، فمكوّنات العملي تُرصد ضمن الرقم المرجعي للشعبة النظرية المقابلة.</div>`;
};

/* ---------- نافذة الشعبة ---------- */
const gSumTiles = (s) => `<div class="tiles kpi" id="gSum"><div class="tile"><b>${s.have} / ${s.need}</b><span>الدرجات المدخلة</span></div><div class="tile ${s.pct === 1 ? 'ok' : ''}"><b>${Math.round(s.pct * 100)}%</b><span>نسبة الاكتمال</span></div><div class="tile ok"><b>${s.done}</b><span>مكتمل</span></div><div class="tile warn"><b>${s.part}</b><span>غير مكتمل</span></div><div class="tile"><b>${s.none}</b><span>لم يُدخل</span></div><div class="tile ${s.err ? 'bad' : ''}"><b>${s.err}</b><span>أخطاء</span></div><div class="tile"><b>${s.avg == null ? '—' : G.fmt(s.avg)}</b><span>متوسط المجموع</span><small>${s.max == null ? '' : `أعلى ${G.fmt(s.max)} • أدنى ${G.fmt(s.min)}`}</small></div></div>`;
const gBanner = (sec, st) => {
  const f = sec.flow || {}, out = [];
  if (st.k === 'closed') out.push(`<div class="gnote ok">عملية الرصد مغلقة منذ ${gDT(f.closed.at)}. أي تعديل يتطلب إجراء تصحيح موثقاً ومراجعة جديدة.</div>`);
  else if (f.lock && f.lock.on && st.lockedOk) out.push(`<div class="gnote info">🔒 الدرجات مجمدة منذ ${gDT(f.lock.at)} (${esc(f.lock.byName || '')}) — النسخة ${esc(f.lock.snap || '')} • البصمة <span dir="ltr">${esc(f.lock.sig || '')}</span>. التعديل يتطلب فك التجميد.</div>`);
  if (f.corr && f.corr.open) out.push(`<div class="gnote warn">إجراء تصحيح مفتوح منذ ${gDT(f.corr.at)}: ${esc(f.corr.why || '')}. بعد التعديل يلزم اعتماد جديد ثم رفع ومطابقة.</div>`);
  if (f.changed && f.changed.at && !(f.lock && f.lock.on)) out.push(`<div class="gnote warn">${esc(f.changed.why || 'أُلغيت الجاهزية')} (${gDT(f.changed.at)}). يلزم اعتماد جديد قبل الرفع.</div>`);
  st.stats.issues.forEach((x) => out.push(`<div class="gnote ${x.warn ? 'warn' : 'bad'}">${esc(x.t)}${x.warn ? ' — لن تُرفع هذه الدرجات.' : ''}</div>`));
  return out.join('');
};
const gActions = (sec, st, inEntry) => {
  if (!gMay(sec.crn)) return '';
  const b = [], crn = sec.crn, k = st.k;
  if (!inEntry && ['none', 'entry', 'incomplete'].includes(k)) b.push(`<button class="btn" data-act="g-enter" data-crn="${crn}">إدخال الدرجات</button>`);
  if (k === 'complete' || (k === 'review' && !st.lockedOk && st.stats.complete)) b.push(`<button class="btn p" data-act="g-approve-ask" data-crn="${crn}">اعتماد الدرجات وتجميدها</button>`);
  if (k === 'ready' || k === 'sched') b.push(`<button class="btn p" data-act="g-up" data-crn="${crn}">رفع درجات الشعبة إلى رايات</button><button class="btn" data-act="g-sched-ask" data-crn="${crn}">${k === 'sched' ? 'تعديل موعد الرفع' : 'جدولة الرفع'}</button>`);
  if (['syncing', 'retry', 'failed'].includes(k)) b.push(`<button class="btn p" data-act="g-go-sync" data-crn="${crn}">متابعة المزامنة</button>`);
  if (k === 'synced') b.push(`<button class="btn p" data-act="g-close-ask" data-crn="${crn}">إغلاق عملية الرصد</button>`);
  if ((sec.flow || {}).lock && sec.flow.lock.on) b.push(`<button class="btn" data-act="g-unlock-ask" data-crn="${crn}">${k === 'closed' || k === 'synced' ? 'فتح إجراء تصحيح' : 'فك التجميد'}</button>`);
  return b.join('');
};
VIEWS.gsec = () => {
  const sec = A.gCrn ? A.raw.gsec[A.gCrn] : null;
  if (!sec || !gList(sec.crn)) { A.view = 'gsecs'; return VIEWS.gsecs(); }
  const st = gSt(sec), s = st.stats, ex = sec.exam || {}, src = sec.src || {};
  return `${gHead(`${esc(sec.name)} — الشعبة ${sec.crn}`, `${esc(sec.code)} • ${esc(sec.term || '')} • المدرب: ${esc(gOwnerName(sec.crn))}`, `<a class="btn" href="#gsecs">كل الشعب</a>${gActions(sec, st)}`)}
  ${gStageStrip(sec)}${gBanner(sec, st)}
  <div class="two"><section class="panel"><h2>بيانات المقرر</h2><table class="kv"><tbody>
    <tr><th>اسم المقرر</th><td>${esc(sec.name)}</td></tr><tr><th>رمز المقرر</th><td>${esc(sec.code)}</td></tr><tr><th>رقم الشعبة المرجعي في رايات</th><td><b>${sec.crn}</b></td></tr><tr><th>الفصل التدريبي</th><td>${esc(sec.term || '—')}${sec.termCode ? ` (${esc(sec.termCode)})` : ''}</td></tr>
    <tr><th>عدد المتدربين</th><td>${s.n}</td></tr><tr><th>القابلون للرصد</th><td>${s.elig}</td></tr><tr><th>توزيع الدرجات</th><td>${esc(gDistText(sec))} • الدرجة النهائية ${G.fmt(G.total(sec))}</td></tr>
    <tr><th>موعد الاختبار</th><td>${ex.date ? `${esc(ex.date)}${ex.time ? ' الساعة ' + esc(ex.time) : ''}${ex.place ? ' • ' + esc(ex.place) : ''}` : 'لم يُحدَّد'} ${gMay(sec.crn) ? `<button class="btn s" data-act="g-exam" data-crn="${sec.crn}">تعديل</button>` : ''}</td></tr>
    <tr><th>موعد رفع الدرجات</th><td>${esc(gUpWhen(sec, st))}</td></tr><tr><th>تاريخ الاستحقاق في رايات</th><td>${esc((G.comps(sec)[0] || {}).due || '—')}</td></tr><tr><th>حالة الرصد</th><td>${gStChip(st)}${st.why ? ` <small class="sub">${esc(st.why)}</small>` : ''}</td></tr>
    <tr><th>مصدر التوزيع</th><td><small class="sub">${esc(src.file || '—')} • استُورد ${gDT(src.at)}${src.byName ? ' • ' + esc(src.byName) : ''}${src.extracted ? ' • استُخرج من رايات ' + esc(src.extracted) : ''}</small></td></tr></tbody></table></section>
  <section class="panel"><h2>ملخص الرصد</h2>${gSee(sec.crn) ? gSumTiles(s) : '<div class="sub">تفاصيل الدرجات تظهر لمدرب الشعبة ورئيس القسم ومسؤول المنصة.</div>'}<h2 style="margin-top:14px">المكوّنات</h2><div class="tw"><table><thead><tr><th>المكوّن</th><th>الوصف</th><th class="n">الجزء</th><th class="n">الحد الأعلى</th><th class="n">يجب الاجتياز</th><th>المدخل</th></tr></thead><tbody>${G.comps(sec).map((c) => { const b = s.byComp[c.k] || { have: 0, need: 0 }; return `<tr><td><b>${esc(c.k)}</b></td><td>${esc(c.desc || '')}</td><td class="n">${esc(c.part || '')}</td><td class="n"><b>${G.fmt(c.max)}</b></td><td class="n">${esc(c.mustPass || '—')}</td><td>${gBar(b.need ? b.have / b.need : 0)} <small class="sub">${b.have}/${b.need}</small></td></tr>`; }).join('')}</tbody></table></div></section></div>
  ${gGrid(sec)}`;
};

/* ---------- جدول المتدربين وإدخال الدرجات ---------- */
const gRowSt = (rs) => `<span class="chip ${{ done: 'ok', err: 'bad', part: 'warn', none: '', na: 'org' }[rs.st]}"${rs.bad.length ? ` data-tip="${esc(rs.bad.join(' • '))}"` : ''}>${G.ROW_ST[rs.st]}</span>`;
function gGrid(sec) {
  const crn = sec.crn;
  if (!gSee(crn)) return '<section class="panel"><div class="sub">جدول المتدربين ودرجاتهم يظهر لمدرب الشعبة ورئيس القسم ومسؤول المنصة.</div></section>';
  const marks = gMarks(crn), st = gSt(sec), s = st.stats, gate = gGate(crn), edit = !gate, parts = G.parts(sec), pk = Object.keys(parts), F = GX.f;
  const ord = { name: (a, b) => String(a.name).localeCompare(String(b.name), 'ar'), id: (a, b) => String(a.id).localeCompare(String(b.id)), total: (a, b) => (s.rs[b.id].total ?? -1) - (s.rs[a.id].total ?? -1), state: (a, b) => 'err part none done na'.split(' ').indexOf(s.rs[a.id].st) - 'err part none done na'.split(' ').indexOf(s.rs[b.id].st), file: () => 0 };
  const show = { all: () => true, elig: (r) => r.el, done: (r) => s.rs[r.id].st === 'done', part: (r) => s.rs[r.id].st === 'part', none: (r) => s.rs[r.id].st === 'none', err: (r) => s.rs[r.id].st === 'err', na: (r) => !r.el };
  const rows = sec.rows.filter(show[F.show] || show.all).slice().sort(ord[F.sort] || ord.name);
  const cell = (r, c, rs) => {
    const v = rs.g[c.k], bad = G.storedBad(sec, c.k, v);
    if (!r.el) return `<td class="n gna">${G.isNum(v) ? `<span class="gstale" data-tip="درجة محفوظة لمتدرب غير قابل للرصد، ولن تُرفع">${G.fmt(v)}</span>${edit ? ` <button class="lnk small" data-act="g-clear" data-crn="${crn}" data-id="${r.id}" data-k="${c.k}">مسح</button>` : ''}` : '—'}</td>`;
    if (!edit) return `<td class="n ${bad ? 'gbadc' : ''}">${v === null || v === undefined ? '<span class="sub">—</span>' : esc(G.fmt(v))}</td>`;
    return `<td class="n"><input class="gin ${bad ? 'g-bad' : ''}" type="text" inputmode="decimal" autocomplete="off" dir="ltr" aria-label="${esc(c.k)} — ${esc(r.name)} — الحد الأعلى ${G.fmt(c.max)}" data-change="g-cell" data-crn="${crn}" data-id="${r.id}" data-k="${esc(c.k)}" value="${v === null || v === undefined ? '' : esc(G.fmt(v))}"></td>`;
  };
  const q = G.normName(F.q);
  const body = rows.map((r, i) => { const rs = s.rs[r.id], key = G.normName(r.name) + ' ' + r.id; return `<tr class="${r.el ? '' : 'gnarow'}" data-s="${esc(key)}"${q && !key.includes(q) ? ' hidden' : ''}><td class="n">${i + 1}</td><td class="gnm"><b>${esc(r.name)}</b></td><td class="n" dir="ltr">${esc(r.id)}</td><td style="font-size:12.5px">${esc(r.st || '')}</td>${pk.map((p) => parts[p].map((c) => cell(r, c, rs)).join('') + `<td class="n gsumc" data-gp="${r.id}|${esc(p)}">${rs.part[p] == null ? '' : G.fmt(rs.part[p])}</td>`).join('')}<td class="n gtot" data-gt="${r.id}">${rs.total == null ? '' : G.fmt(rs.total)}</td><td class="n" data-gst="${r.id}">${gRowSt(rs)}</td></tr>`; }).join('');
  return `<section class="panel"><div class="row between"><h2 style="margin:0">جدول المتدربين — ${s.n} متدرباً، ${s.elig} قابلاً للرصد</h2><div class="row">${edit ? `<label class="btn s">استيراد الدرجات من Excel<input type="file" accept=".xlsx" hidden data-change="g-xin" data-crn="${crn}"></label>` : ''}${dl && can('export') ? `<button class="btn s" data-act="g-xout" data-crn="${crn}">تنزيل الكشف Excel</button><button class="btn s" data-act="g-print" data-crn="${crn}">طباعة الكشف</button>` : ''}</div></div>
  <div class="row gtools"><input type="search" id="gQ" placeholder="بحث بالاسم أو الرقم التدريبي" aria-label="بحث في المتدربين" value="${esc(F.q)}"><label>الفرز <select data-change="g-f" data-k="sort">${[['name', 'الاسم'], ['id', 'الرقم التدريبي'], ['total', 'المجموع'], ['state', 'حالة الرصد'], ['file', 'ترتيب رايات']].map(([k, t]) => `<option value="${k}" ${F.sort === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label><label>التصفية <select data-change="g-f" data-k="show">${[['all', 'الكل'], ['elig', 'القابلون للرصد'], ['done', 'مكتمل'], ['part', 'غير مكتمل'], ['none', 'لم يُدخل'], ['err', 'أخطاء'], ['na', 'غير القابلين للرصد']].map(([k, t]) => `<option value="${k}" ${F.show === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
  ${gate && gMay(crn) ? `<div class="gnote info">${esc(gate)}</div>` : ''}<div id="gMsg" class="gmsg" role="alert" aria-live="assertive" hidden></div>
  <div class="tw" data-keep="g${crn}"><table class="gtab"><thead><tr><th rowspan="2" class="n">م</th><th rowspan="2">اسم المتدرب</th><th rowspan="2" class="n">الرقم التدريبي</th><th rowspan="2">الحالة</th>${pk.map((p) => `<th class="n gph" colspan="${parts[p].length + 1}">${esc(p)}</th>`).join('')}<th rowspan="2" class="n">المجموع<small>من ${G.fmt(G.total(sec))}</small></th><th rowspan="2" class="n">حالة الرصد</th></tr><tr>${pk.map((p) => parts[p].map((c) => `<th class="n" data-tip="${esc(c.desc || '')}">${esc(c.k)}<small>من ${G.fmt(c.max)}</small></th>`).join('') + `<th class="n">${esc(p)}<small>من ${G.fmt(parts[p].reduce((a, c) => a + c.max, 0))}</small></th>`).join('')}</tr></thead><tbody id="gBody">${body || `<tr><td colspan="${6 + pk.reduce((a, p) => a + parts[p].length + 1, 0)}" class="n sub">لا يوجد متدربون بهذه التصفية.</td></tr>`}</tbody></table></div>
  <div class="sub" style="margin-top:6px">${edit ? 'اكتب الدرجة ثم Enter للانتقال إلى المتدرب التالي. الحدود العليا تُقرأ من توزيع الدرجات المستورد، والخانة الفارغة ليست صفراً.' : 'الجدول للقراءة فقط.'}</div></section>`;
}
function gCellChange(el) {
  const crn = el.dataset.crn, id = el.dataset.id, k = el.dataset.k, sec = A.raw.gsec[crn], old = G.val(gMarks(crn), id, k), box = $('#gMsg');
  const r = gSetGrades(crn, [{ id, k, raw: el.value }], 'يدوي');
  if (r.bad.length) {
    const msg = r.bad[0].msg;
    el.value = old === null ? '' : G.fmt(old); el.classList.add('g-bad');
    if (box) { box.hidden = false; box.textContent = msg; }
    toast(msg);
    setTimeout(() => { if (document.body.contains(el)) { el.focus(); el.select(); } }, 30);
    if (r.gate) { A.dirty = false; render(true); }
    return;
  }
  el.classList.remove('g-bad'); el.value = r.ok[0].v === null ? '' : G.fmt(r.ok[0].v);
  if (box) box.hidden = true;
  const s = G.stats(sec, gMarks(crn)), rs = s.rs[id];
  document.querySelectorAll(`[data-gp^="${id}|"]`).forEach((c) => { const p = c.dataset.gp.split('|')[1]; c.textContent = rs.part[p] == null ? '' : G.fmt(rs.part[p]); });
  const t = document.querySelector(`[data-gt="${id}"]`); if (t) t.textContent = rs.total == null ? '' : G.fmt(rs.total);
  const c = document.querySelector(`[data-gst="${id}"]`); if (c) c.innerHTML = gRowSt(rs);
  const sum = $('#gSum'); if (sum) sum.outerHTML = gSumTiles(s);
  A.dirty = true; /* يُعاد رسم الصفحة كاملة عند الخروج من خانات الإدخال */
}
document.addEventListener('keydown', (ev) => {
  const t = ev.target; if (!t || !t.classList || !t.classList.contains('gin') || !['Enter', 'ArrowDown', 'ArrowUp'].includes(ev.key)) return;
  ev.preventDefault();
  const col = [...document.querySelectorAll(`.gin[data-k="${t.dataset.k}"]`)], i = col.indexOf(t), nx = col[i + (ev.key === 'ArrowUp' ? -1 : 1)];
  if (nx) { nx.focus(); nx.select(); } else t.blur();
});
document.addEventListener('input', (ev) => {
  const t = ev.target; if (!t) return;
  if (t.id === 'gQ') { GX.f.q = t.value; const q = G.normName(t.value); document.querySelectorAll('#gBody tr[data-s]').forEach((tr) => { tr.hidden = !!q && !tr.dataset.s.includes(q); }); }
  if (t.id === 'gLogQ') { const q = G.normName(t.value); GX.logQ = t.value; document.querySelectorAll('#gLogBody tr[data-s]').forEach((tr) => { tr.hidden = !!q && !tr.dataset.s.includes(q); }); }
  if (t.classList && t.classList.contains('gin')) t.classList.remove('g-bad');
});

/* ---------- إدخال درجات المتدربين ---------- */
VIEWS.gentry = () => {
  if (!gHas()) return gNoData('إدخال درجات المتدربين');
  const sec = gPick(), st = gSt(sec);
  return `${gHead('إدخال درجات المتدربين', 'تُدخل درجة كل مكوّن مستقلة، يدوياً أو من ملف Excel، وتُرفض أي درجة تخالف توزيع الدرجات المعتمد.', gActions(sec, st, true))}${gLoading()}
  ${gSecTabs(sec.crn, 'g-pick')}
  <section class="panel"><div class="row between"><div><b>${esc(sec.name)}</b> — الشعبة ${sec.crn} ${gStChip(st)}</div><div class="sub">${esc(gDistText(sec))}</div></div>${gSee(sec.crn) ? gSumTiles(st.stats) : ''}</section>
  ${gBanner(sec, st)}${gGrid(sec)}`;
};
