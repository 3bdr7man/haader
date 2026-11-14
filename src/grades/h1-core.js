/* ====================================================================
   الموجة الأولى من خطة التطوير: سد الثغرات
   1) سجل تدقيق موحد ومحمي: تعديلات التحضير والإرشاد تذهب أيضاً إلى
      السجل المحمي (وثيقة لكل مستخدم، أرشفة لا حذف، تصفية وتصدير).
   2) مصفوفة صلاحيات معلنة في صفحة واحدة.
   3) مركز إشعارات موحد يجمع ما تفرّق في الأقسام.
   4) تصدير شامل (نسخة احتياطية) لكل بيانات المنصة.
   5) مركز تطوير حاضر: خريطة الهيكل وحالة كل تحسين.
   لا يحذف شيئاً ولا يغيّر منطق وظيفة قائمة.
   ==================================================================== */
Object.assign(GACT, { att: 'تعديل تحضير', attdel: 'مسح تحضير', bosla: 'إجراء إرشادي', backup: 'تصدير نسخة احتياطية' });
/* سجل التحضير والإرشاد يُكتب في موضعه القديم (meta/audit) ويُضاف إلى السجل المحمي */
{
  const prev = audit;
  audit = function (rows) {
    prev(rows);
    try {
      const out = (rows || []).map((r) => {
        const bosla = r[3] === 'الإرشاد والسلوك' || r[7] === 'بوصلة';
        return bosla ? ['bosla', '', r[2] === '—' ? '' : r[2], '', r[5] || '', r[6] || '', 'بوصلة']
          : [r[6] ? 'att' : 'attdel', r[1] || '', r[2] || '', r[4] || '', r[5] || '', r[6] || '', r[7] || 'يدوي'];
      });
      if (out.length) gLog(out.slice(0, 200));
    } catch (e) { /* السجل القديم محفوظ على أي حال */ }
  };
}
/* ---------- 2) مصفوفة الصلاحيات المعلنة ---------- */
const PROLE = [['admin', 'مسؤول المنصة'], ['trainer', 'مدرب المقرر'], ['head', 'رئيس القسم'], ['viewer', 'حساب الاطلاع'], ['trainee', 'المتدرب']];
const PCAP = [
  ['التحضير والمتابعة', [
    ['عرض التحضير', 'كل الشعب', 'شعبه', 'كل الشعب', 'كل الشعب', '—'],
    ['تعديل التحضير', 'الشعب غير المسندة', 'شعبه وحده', '—', '—', '—'],
    ['التحضير عبر QR', 'الشعب غير المسندة', 'شعبه', '—', '—', '—'],
    ['مزامنة التحضير مع رايات', 'بصلاحية المزامنة', 'بصلاحية المزامنة', '—', '—', '—'],
  ]],
  ['الدرجات', [
    ['عرض الدرجات', 'كل الشعب', 'شعبه', 'كل الشعب', 'الحالات بلا درجات', '—'],
    ['إدخال الدرجات', 'الشعب غير المسندة', 'شعبه وحده', '—', '—', '—'],
    ['الاعتماد والتجميد وفك التجميد', 'الشعب غير المسندة', 'شعبه وحده', '—', '—', '—'],
    ['جدولة الرفع والرفع إلى رايات', 'الشعب غير المسندة', 'شعبه وحده', '—', '—', '—'],
    ['استيراد توزيع الدرجات', 'نعم', '—', '—', '—', '—'],
  ]],
  ['حسابات المتدربين', [
    ['إنشاء حساب وإعادة إصدار كلمة المرور', 'كل المتدربين', 'متدربو شعبه', '—', '—', '—'],
    ['تعطيل حساب وإعادة تفعيله', 'نعم', '—', '—', '—', '—'],
    ['تغيير كلمة المرور الخاصة', '—', '—', '—', '—', 'نعم (بعد الاستضافة)'],
    ['تغيير الرقم التدريبي', '—', '—', '—', '—', '—'],
  ]],
  ['الإرشاد والسلوك', [
    ['سجل المخالفات والحالات', 'كامل', 'متدربوه', 'اطلاع', 'اطلاع', '—'],
    ['إجراءات الإرشاد ومسار العمل', 'كامل', 'متدربوه', '—', '—', '—'],
  ]],
  ['التقارير والسجلات', [
    ['التقارير والطباعة', 'كامل', 'شعبه', 'كامل', 'بصلاحية التصدير', '—'],
    ['التصدير إلى Excel', 'نعم', 'بصلاحية التصدير', 'بصلاحية التصدير', 'بصلاحية التصدير', '—'],
    ['سجل التدقيق المحمي', 'كل العمليات', 'عملياته وشعبه', 'كل العمليات', '—', '—'],
    ['النسخة الاحتياطية الشاملة', 'نعم', '—', '—', '—', '—'],
  ]],
  ['إدارة النظام', [
    ['المدربون والصلاحيات والشعب والقسم', 'نعم', '—', '—', '—', '—'],
    ['الإعدادات وسمات الألوان', 'نعم', '—', '—', '—', '—'],
  ]],
];
const pRoleNow = () => (!A.me ? '' : isAdmin() ? 'admin' : isHead() ? 'head' : isViewer() ? 'viewer' : 'trainer');
const pCell = (v) => (v === '—' ? '<span class="chip">لا</span>' : v === 'نعم' || v === 'كامل' ? `<span class="chip ok">${esc(v)}</span>` : `<span class="chip info">${esc(v)}</span>`);
VIEWS.perms = () => {
  const me = pRoleNow();
  return `${gHead('مصفوفة الصلاحيات', 'من يستطيع ماذا في منصة حاضر، مكتوبةً في مكان واحد ومطابقةً لما تفحصه الشيفرة فعلاً.', dl && can('export') ? '<button class="btn" data-act="p-print">طباعة المصفوفة</button>' : '')}
  <div class="gnote info">دورك الحالي: <b>${esc((PROLE.find((r) => r[0] === me) || ['', 'غير محدد'])[1])}</b>. العمود الخاص بدورك مظلّل. والشعبة لمدربها: لا يعدّل أحد شعبة غيره، ومسؤول المنصة يتولى الشعب غير المسندة فقط.</div>
  ${PCAP.map(([grp, rows]) => `<section class="panel"><h2>${esc(grp)}</h2><div class="tw"><table><thead><tr><th>الإجراء</th>${PROLE.map((r) => `<th class="n"${r[0] === me ? ' style="background:var(--infobg)"' : ''}>${esc(r[1])}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td>${r.slice(1).map((v, i) => `<td class="n"${PROLE[i][0] === me ? ' style="background:var(--infobg)"' : ''}>${pCell(v)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`).join('')}
  <section class="panel"><h2>ما لا تستطيعه المنصة اليوم</h2><div class="gnote warn">المتدرب لا يستطيع الدخول على الرابط الحالي، ولا يرى رئيس القسم ولا مدرب آخر البيانات على رابط واحد: المنصة تعمل داخل Claude وقاعدتها تتيح الكتابة لمالكها وحده. الحسابات والصلاحيات أعلاه مُهيّأة وتعمل فور نقل المنصة إلى استضافة مفتوحة.</div></section>`;
};
ACT['p-print'] = () => {
  const body = `${gDocTop('مصفوفة الصلاحيات', null)}${PCAP.map(([grp, rows]) => `<h3>${esc(grp)}</h3><table><thead><tr><th>الإجراء</th>${PROLE.map((r) => `<th>${esc(r[1])}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r[0])}</td>${r.slice(1).map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`).join('')}<p>طُبعت ${gDT(new Date().toISOString())}</p>`;
  printDoc('مصفوفة الصلاحيات', body);
};
/* ---------- 3) مركز الإشعارات الموحد ---------- */
const hToday = () => { const s = today(), c = ((A.m && A.m.cal) || []).find((x) => x.serial === s); return c ? c.hijri : ''; };
function hInbox() {
  const out = [], m = A.m;
  /* أ) شعب اليوم التي لم تُحضَّر */
  const d = hToday();
  if (d && m) m.sections.forEach((s) => {
    if (!mayEdit(s.crn) || !s.dates.includes(d)) return;
    const n = s.rows.filter((r) => H.code(m, s.crn, r.id, d)).length;
    if (!n) out.push({ p: 1, kind: 'تحضير', text: `لم تُحضَّر الشعبة ${s.crn} (${s.course}) اليوم`, view: 'roll', crn: s.crn });
    else if (n < s.rows.length) out.push({ p: 2, kind: 'تحضير', text: `تحضير الشعبة ${s.crn} غير مكتمل: ${n} من ${s.rows.length}`, view: 'roll', crn: s.crn });
  });
  /* ب) المقتربون من الإنذار والحرمان */
  try {
    const a = alertRows(m), dep = a.near.filter((x) => x.stage === 'dep'), warn = a.near.filter((x) => x.stage === 'warn');
    if (dep.length) out.push({ p: 1, kind: 'إنذار', text: `${dep.length} متدرباً يفصلهم غياب واحد عن الحرمان`, view: 'alerts' });
    if (warn.length) out.push({ p: 2, kind: 'إنذار', text: `${warn.length} متدرباً يفصلهم غياب واحد عن الإنذار`, view: 'alerts' });
    if (a.reached.length) out.push({ p: 2, kind: 'إنذار', text: `${a.reached.length} متدرباً بلغ حد الإنذار أو الحرمان`, view: 'alerts' });
  } catch (e) { /* لا يمنع بقية الإشعارات */ }
  /* ج) الإرشاد: مخالفات وحالات مفتوحة */
  try {
    const vi = Object.values(A.raw.bviol || {}).filter((v) => v && v.status && !/مغلق|ملغ/.test(v.status)).length;
    const cs = Object.values(A.raw.bcase || {}).filter((c) => c && c.status && !/مغلق/.test(c.status)).length;
    if (vi) out.push({ p: 2, kind: 'إرشاد', text: `${vi} مخالفة قيد المتابعة`, view: 'bviol' });
    if (cs) out.push({ p: 2, kind: 'إرشاد', text: `${cs} حالة إرشادية مفتوحة`, view: 'bcases' });
  } catch (e) { /* */ }
  /* د) الدرجات: إشعارات الجدولة والرفع */
  try { gNotices().forEach((n) => out.push({ p: n.tone === 'bad' ? 1 : n.todo ? 2 : 3, kind: 'درجات', text: n.text, view: n.crn ? 'gsched' : 'gdash', crn: n.crn })); } catch (e) { /* */ }
  /* هـ) حسابات المتدربين */
  try {
    const list = tRoster().filter((t) => tMine(t));
    const none = list.filter((t) => !tAcc(t.id)).length, nd = list.filter((t) => { const a = tAcc(t.id); return a && !(a.deliv && a.deliv.at); }).length;
    if (none) out.push({ p: 3, kind: 'حسابات', text: `${none} متدرباً بلا حساب دخول`, view: 'taccs' });
    if (nd) out.push({ p: 3, kind: 'حسابات', text: `${nd} حساباً لم تُسلَّم كلمة مروره`, view: 'taccs' });
  } catch (e) { /* */ }
  return out.sort((a, b) => a.p - b.p);
}
const HP = { 1: ['عاجل', 'bad'], 2: ['مهم', 'warn'], 3: ['للعلم', 'info'] };
VIEWS.inbox = () => {
  const rows = hInbox(), n1 = rows.filter((r) => r.p === 1).length;
  return `${gHead('مركز الإشعارات', 'كل ما يحتاج تدخلك اليوم، من التحضير والإنذار والإرشاد والدرجات والحسابات، في مكان واحد.')}
  <div class="tiles kpi"><div class="tile ${n1 ? 'bad' : 'ok'}"><b>${n1}</b><span>عاجل</span></div><div class="tile warn"><b>${rows.filter((r) => r.p === 2).length}</b><span>مهم</span></div><div class="tile"><b>${rows.filter((r) => r.p === 3).length}</b><span>للعلم</span></div><div class="tile"><b>${rows.length}</b><span>الإجمالي</span></div></div>
  ${rows.length ? `<section class="panel"><div class="tw"><table><thead><tr><th class="n">الأهمية</th><th class="n">القسم</th><th>الإشعار</th><th class="n">الإجراء</th></tr></thead><tbody>${rows.map((r) => `<tr><td class="n"><span class="chip ${HP[r.p][1]}">${HP[r.p][0]}</span></td><td class="n">${esc(r.kind)}</td><td>${esc(r.text)}</td><td class="n"><button class="btn s" data-act="h-go" data-v="${r.view}" data-crn="${r.crn || ''}">افتح</button></td></tr>`).join('')}</tbody></table></div></section>`
    : '<section class="panel empty"><h2>لا يوجد ما يحتاج تدخلاً الآن</h2><div class="sub">التحضير مكتمل، ولا إنذارات قريبة، ولا عمليات رصد معلّقة.</div></section>'}`;
};
ACT['h-go'] = (e) => { const v = e.dataset.v, crn = e.dataset.crn; if (crn) { A.crn = crn; A.homeCrn = crn; if (A.raw.gsec[crn]) A.gCrn = crn; } go(v); };
VIEW_ACTS.add('h-go');
NAV_BADGE.inbox = () => { try { return hInbox().filter((r) => r.p === 1).length; } catch (e) { return 0; } };
/* ---------- 4) النسخة الاحتياطية الشاملة ---------- */
const HCOLS = ['accounts', 'sections', 'marks', 'notes', 'meta', 'qrs', 'warnlog', 'bosla', 'bviol', 'bcase', 'bforms', 'gcfg', 'gsec', 'gmarks', 'gsnap', 'gops', 'glog', 'glogs', 'tacc'];
ACT['h-backup'] = async () => {
  if (!isAdmin()) { toast('التصدير الشامل لمسؤول المنصة.'); return; }
  const data = { app: 'haader', kind: 'backup', at: new Date().toISOString(), by: A.me.name, org: ORG, college: COLLEGE, dept: orgInfo().dept, cols: {} };
  HCOLS.forEach((c) => { data.cols[c] = clone(A.raw[c] || {}); });
  const n = HCOLS.reduce((a, c) => a + Object.keys(data.cols[c] || {}).length, 0);
  const txt = JSON.stringify(data);
  await save(`نسخة احتياطية - منصة حاضر - ${todayISO()}.json`, new Blob([txt], { type: 'application/json' }));
  gLog([['backup', '', '', '', '', String(n), `${HCOLS.length} مجموعة، ${(txt.length / 1024).toFixed(0)} كيلوبايت`]]);
  toast(`صُدِّرت نسخة احتياطية: ${n} وثيقة.`);
};
/* ---------- 5) مركز تطوير حاضر ---------- */
const HROAD = [
  ['سد الثغرات', [
    ['سجل تدقيق موحد ومحمي للتحضير والإرشاد', 'done', 'تعديلات التحضير والإرشاد تُكتب أيضاً في السجل المحمي: وثيقة لكل مستخدم لا يكتب فيها غيره، أرشفة عند الامتلاء لا حذف، وتصفية وتصدير.'],
    ['مصفوفة صلاحيات معلنة', 'done', 'صفحة واحدة تعرض من يستطيع ماذا، مطابقة لما تفحصه الشيفرة.'],
    ['مركز إشعارات موحد', 'done', 'يجمع تحضير اليوم الناقص، والمقتربين من الإنذار والحرمان، والمخالفات والحالات المفتوحة، وإشعارات رفع الدرجات، وحسابات المتدربين غير المسلَّمة.'],
    ['نسخة احتياطية شاملة', 'done', 'تصدير كل مجموعات البيانات في ملف واحد، ويُسجَّل التصدير.'],
    ['خريطة الهيكل وحالة التطوير', 'done', 'هذه الصفحة.'],
  ]],
  ['إعادة التنظيم', [
    ['لوحة قيادة واحدة ببطاقات قابلة للنقر', 'done', 'عشر بطاقات في أعلى الرئيسية: الإشعارات العاجلة، المتدربون، حضور اليوم، المقتربون من الإنذار، من بلغ الحد، المخالفات، الحالات، رصد الدرجات، الجاهز للرفع، الحسابات غير المسلَّمة. كل بطاقة تفتح موضعها.'],
    ['إعادة تجميع القائمة: مدخل واحد لكل وظيفة', 'done', 'أعلى القائمة صار: الرئيسية، مركز الإشعارات، البحث الموحد. والتقارير يتصدرها مركز التقارير. ولم تُحذف ولا نُقلت أي واجهة من قسمها.'],
    ['بحث موحد: متدرب، شعبة، واجهة', 'done', 'بحث واحد بالاسم أو الرقم التدريبي أو رقم الشعبة أو اسم الواجهة، ونتائجه تفتح التحضير أو الإرشاد أو الحساب أو الدرجات مباشرة.'],
    ['مسار تنقل وزر رجوع للصفحات العميقة', 'done', 'كل واجهة تعرض: الرئيسية ← القسم ← الواجهة، مع زر رجوع. والواجهات التي لا تظهر في القائمة صار لها موضع معلوم.'],
    ['مركز تقارير واحد', 'done', 'ثماني وجهات تقارير وسجلات من مدخل واحد: التحضير، الإنذار، الاستئذان، الدرجات، الإرشاد، التحليلات، وسجل العمليات والتدقيق.'],
  ]],
  ['الصقل البصري', [
    ['فرز الأعمدة وتجميد الرؤوس في جداول الواجهات', 'done', 'كل جدول عرض من أربعة صفوف يُفرز بالنقر على رأس العمود، تصاعدياً وتنازلياً، ورقمياً للأعمدة الرقمية. وجداول الإدخال مستثناة حتى لا يتحرك الصف أثناء التحضير.'],
    ['مجموعة أيقونات موحدة وحالات فارغة لكل واجهة', 'done', 'أيقونة خطية موحدة لكل عنصر في القائمة، ورسالة واضحة داخل أي جدول لا بيانات فيه بدل الفراغ.'],
    ['توحيد نقاط الانكسار وتقليص الأنماط المضمنة', 'next', 'الأنماط الجديدة كلها بمتغيّرات التصميم وبثلاث نقاط انكسار، أما 241 نمطاً مضمناً و120 لوناً في الواجهات القديمة فتُنقل تدريجياً مع كل تعديل على واجهتها — لا دفعة واحدة، لأن استبدالها جملةً يخاطر بالتخطيط بلا مقابل ظاهر.'],
    ['إمكانية الوصول: لوحة المفاتيح وقارئ الشاشة', 'done', 'رابط «تخطَّ إلى المحتوى»، وإعلان الواجهة الحالية في القائمة، وscope لكل رأس عمود، وإعلان ترتيب الفرز، وتفعيل بطاقات لوحة القيادة بلوحة المفاتيح.'],
    ['أنواع رسوم بيانية إضافية', 'plan', 'المنصة اليوم فيها نوع واحد: أشرطة أفقية.'],
  ]],
  ['ما ينتظر قراراً', [
    ['اللون الرئيسي للهوية', 'ask', 'هوية التدريب التقني أزرق #003366 و#0066CC وخط Cairo، وطلبت الأخضر رئيسياً. توصيتي: الأزرق للهوية والأخضر للإنجاز والتميّز.'],
    ['صفحة متدرب واحدة تجمع التحضير والسلوك والدرجات والحساب', 'plan', ''],
    ['توسيع إدارة المدربين، والأسئلة الشائعة وطلب الدعم', 'plan', ''],
    ['القاعات والمعامل والجداول التدريبية', 'hold', 'لا مصدر بيانات لها عند المدرب، وإدخالها يدوياً عبء بلا مقابل.'],
    ['الاستضافة الخارجية: دخول المتدربين والاستخدام المشترك', 'hold', 'قرارك الحالي: البقاء داخل Claude هذا الفصل. الحسابات والمصنفات جاهزة وتعمل فور النقل.'],
  ]],
];
const HST = { done: ['منفَّذ', 'ok'], next: ['قيد التنفيذ', 'info'], plan: ['مخطَّط', ''], ask: ['ينتظر قرارك', 'warn'], hold: ['مؤجَّل بقرار', 'bad'] };
const hCount = (k) => HROAD.reduce((a, [, items]) => a + items.filter((x) => x[1] === k).length, 0);
VIEWS.devcenter = () => {
  const groups = NAV.map(([g, items]) => ({ label: g || 'الرئيسية', n: items.length }));
  const all = HROAD.reduce((a, [, i]) => a + i.length, 0);
  return `${gHead('مركز تطوير حاضر', 'خريطة الهيكل، ومقترحات التطوير، وحالة تنفيذ كل تحسين — تتحدث مع كل إصدار.', dl && can('export') ? '<button class="btn" data-act="h-road-print">طباعة الخطة</button>' : '')}
  <div class="tiles kpi"><div class="tile ok"><b>${hCount('done')}</b><span>منفَّذ</span></div><div class="tile info"><b>${hCount('next')}</b><span>قيد التنفيذ</span></div><div class="tile"><b>${hCount('plan')}</b><span>مخطَّط</span></div><div class="tile warn"><b>${hCount('ask')}</b><span>ينتظر قرارك</span></div><div class="tile"><b>${all}</b><span>إجمالي البنود</span></div></div>
  ${hbars('حجم كل قسم في القائمة (عدد الواجهات)', groups.map((g) => ({ label: g.label, عناصر: g.n })), [['عناصر', 'عناصر', 'c5']])}
  <section class="panel"><h2>خريطة الهيكل الحالية</h2><div class="tw"><table><thead><tr><th>القسم</th><th class="n">الواجهات</th><th>المحتوى</th></tr></thead><tbody>${NAV.map(([g, items]) => `<tr><td><b>${esc(g || 'الرئيسية')}</b></td><td class="n">${items.length}</td><td style="font-size:12.5px">${items.map((x) => esc(x[1])).join(' • ')}</td></tr>`).join('')}</tbody></table></div><div class="sub">إجمالي الواجهات المتاحة لدورك: ${NAV.reduce((a, [, i]) => a + i.length, 0)}</div></section>
  ${HROAD.map(([g, items]) => `<section class="panel"><h2>${esc(g)}</h2><div class="tw"><table><thead><tr><th>البند</th><th class="n">الحالة</th><th>التفصيل</th></tr></thead><tbody>${items.map((x) => `<tr><td><b>${esc(x[0])}</b></td><td class="n"><span class="chip ${HST[x[1]][1]}">${HST[x[1]][0]}</span></td><td style="font-size:12.5px">${esc(x[2] || '—')}</td></tr>`).join('')}</tbody></table></div></section>`).join('')}
  <section class="panel"><h2>النسخة الاحتياطية</h2><div>تصدير كل بيانات المنصة في ملف واحد يبقى عندك، ويُسجَّل التصدير في سجل التدقيق.</div><div class="row">${isAdmin() ? '<button class="btn p" data-act="h-backup">تصدير نسخة احتياطية الآن</button>' : '<span class="sub">التصدير الشامل لمسؤول المنصة.</span>'}</div></section>`;
};
ACT['h-road-print'] = () => {
  const body = `${gDocTop('خطة تطوير منصة حاضر', null)}${HROAD.map(([g, items]) => `<h3>${esc(g)}</h3><table><thead><tr><th>البند</th><th>الحالة</th><th>التفصيل</th></tr></thead><tbody>${items.map((x) => `<tr><td>${esc(x[0])}</td><td>${HST[x[1]][0]}</td><td>${esc(x[2] || '')}</td></tr>`).join('')}</tbody></table>`).join('')}<p>طُبعت ${gDT(new Date().toISOString())}</p>`;
  printDoc('خطة تطوير منصة حاضر', body);
};
/* ---------- القائمة: مدخل الإشعارات أولاً، والمصفوفة والمركز في الإدارة والأدوات ---------- */
NAV[0][1].push(['inbox', 'مركز الإشعارات']);
NAV.find((g) => g[0] === 'الأدوات')[1].push(['perms', 'مصفوفة الصلاحيات']);
NAV.find((g) => g[0] === 'الإدارة')[1].push(['devcenter', 'مركز تطوير حاضر', 'admin']);

/* واجهة «السجلات» القديمة تبقى كما هي، ويُضاف إليها مدخل للسجل المحمي */
{
  const prev = VIEWS.log;
  VIEWS.log = () => prev() + `<section class="panel"><h2>السجل المحمي</h2><div>كل ما تراه أعلاه يُكتب أيضاً في سجل التدقيق المحمي: وثيقة لكل مستخدم لا يكتب فيها غيره، وأرشفة عند الامتلاء لا حذف، مع تصفية وتصدير إلى Excel.</div><div class="row"><button class="btn p" data-act="h-go" data-v="glog" data-crn="">افتح سجل العمليات والتدقيق</button></div></section>`;
}
