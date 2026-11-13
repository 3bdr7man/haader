/* ====================================================================
   حسابات المتدربين: الرقم التدريبي اسم مستخدم ثابت، وكلمة مرور مؤقتة
   يولّدها النظام ويسلمها المدرب. لا تُخزَّن كلمة المرور نصاً صريحاً،
   ولا تظهر في سجل العمليات ولا في مصنف الحسابات المتداول.
   ==================================================================== */
A.raw.tacc = {};
{ const o = boot; boot = async function () { await o(); if (!db) return; gWatch('tacc'); }; }
const TPW_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
function tGenPw(used) {
  for (let i = 0; i < 60; i++) {
    const b = crypto.getRandomValues(new Uint8Array(9));
    const s = [...b].map((x) => TPW_ALPHA[x % TPW_ALPHA.length]).join('');
    const pw = s.slice(0, 4) + '-' + s.slice(4);
    const core = pw.replace('-', '');
    if (/[A-Za-z]/.test(core) && /\d/.test(core) && !used.has(pw)) { used.add(pw); return pw; }
  }
  return null;
}
const tAcc = (id) => A.raw.tacc[id] || null;
const TST = { new: ['منشأ', 'info'], active: ['مفعّل', 'ok'], disabled: ['معطّل', 'bad'], none: ['لم يُنشأ', ''] };
const tState = (a) => (!a ? 'none' : a.st === 'disabled' ? 'disabled' : a.first && a.first.at ? 'active' : 'new');
/* المتدربون في الشعب المسندة للمستخدم: حساب واحد لكل متدرب مهما تعددت شعبه */
function tRoster() {
  const out = {}, all = isAdmin() || isHead() || isViewer();
  ((A.m && A.m.sections) || []).forEach((s) => {
    if (!all && secOwner(s.crn) !== A.me.id) return;
    (s.rows || []).forEach((r) => {
      const t = out[r.id] || (out[r.id] = { id: r.id, name: r.name, secs: [], mine: false });
      if (!t.secs.some((x) => x.crn === s.crn)) t.secs.push({ crn: s.crn, course: s.course, kind: s.kind, trainer: secOwner(s.crn) });
      if (secOwner(s.crn) === A.me.id) t.mine = true;
      if (r.name && r.name.length > (t.name || '').length) t.name = r.name;
    });
  });
  Object.values(A.raw.gsec || {}).forEach((g) => { if (!g || !g.rows) return; if (!all && gOwner(g.crn) !== A.me.id) return; g.rows.forEach((r) => { const t = out[r.id] || (out[r.id] = { id: r.id, name: r.name, secs: [], mine: gOwner(g.crn) === A.me.id }); if (!t.secs.some((x) => x.crn === g.crn)) t.secs.push({ crn: g.crn, course: g.name, kind: 'درجات', trainer: gOwner(g.crn) }); }); });
  return Object.values(out).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
}
const tMine = (t) => isAdmin() || t.mine;
const tCourses = (t) => [...new Set(t.secs.map((s) => s.course))];
const tSecs = (t) => t.secs.map((s) => s.crn).join('، ');
const tMay = () => !!A.me && !isViewer() && !isHead();
function tStats(list) {
  const o = { n: list.length, made: 0, active: 0, notActive: 0, deliv: 0, notDeliv: 0, logged: 0, never: 0, disabled: 0 };
  list.forEach((t) => { const a = tAcc(t.id); if (!a) return; o.made++; if (a.st === 'disabled') o.disabled++; const st = tState(a); if (st === 'active') { o.active++; o.logged++; } else { o.notActive++; o.never++; } if (a.deliv && a.deliv.at) o.deliv++; else o.notDeliv++; });
  o.never = o.n - o.logged;
  return o;
}
/* ---------- إنشاء الحسابات ---------- */
async function tCreate(list, opts) {
  const made = [], iso = new Date().toISOString(), w = gWho(), used = new Set();
  Object.values(A.raw.tacc).forEach(() => {});
  for (const t of list) {
    const old = tAcc(t.id);
    if (old && !opts.reissue) continue;
    if (!tMine(t)) continue;
    const pw = opts.pw ? opts.pw[t.id] : tGenPw(used);
    if (!pw) continue;
    const f = await pwFields(pw);
    const doc = Object.assign({}, old || {}, { id: t.id, user: t.id, name: t.name, salt: f.salt, iter: f.iter, hash: f.hash, alg: 'PBKDF2-SHA256', temp: true, st: old && old.st === 'disabled' ? 'disabled' : 'new', pwAt: iso, pwBy: w.id, pwByName: w.name, reissued: (old && old.reissued ? old.reissued : 0) + (old ? 1 : 0) });
    if (!old) doc.made = { at: iso, by: w.id, byName: w.name };
    if (old) doc.deliv = { at: null, by: null, byName: null, how: '' };
    A.raw.tacc[t.id] = doc; enqueue('tacc/' + t.id, doc, 'set');
    made.push({ id: t.id, name: t.name, pw, secs: tSecs(t), courses: tCourses(t).join('، '), reissue: !!old });
  }
  if (made.length) gLog(made.slice(0, 200).map((m) => [m.reissue ? 'acc-pw' : 'acc-new', '', m.id, '', '', '', opts.pw ? 'كلمة مرور مستوردة من مصنف' : 'كلمة مرور مؤقتة مولّدة']));
  return made;
}
function tSet(id, patch, act, det) {
  const a = tAcc(id); if (!a) return;
  A.raw.tacc[id] = merge(clone(a), clone(patch)); enqueue('tacc/' + id, patch);
  if (act) gLog([[act, '', id, '', '', '', det || '']]);
}
const tDeliver = (id, how) => tSet(id, { deliv: { at: new Date().toISOString(), by: A.me.id, byName: A.me.name, how } }, 'acc-deliv', how);
/* ---------- المصنفات ---------- */
const tFileName = (s) => `${s} - ${(A.me.name || '').replace(/[\\/:*?"<>|]/g, '')} - ${(Object.values(A.raw.gsec)[0] || {}).term || 'الفصل التدريبي الحالي'}.xlsx`;
async function tBook(list) {
  let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
  const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
  const add = (aoa, n, cols) => { const ws = X.utils.aoa_to_sheet(aoa); ws['!views'] = [{ RTL: true }]; ws['!cols'] = cols; ws['!autofilter'] = { ref: X.utils.encode_range({ s: { r: 2, c: 0 }, e: { r: aoa.length - 1, c: aoa[2].length - 1 } }) }; ws['!freeze'] = { xSplit: 0, ySplit: 3 }; X.utils.book_append_sheet(wb, ws, n.slice(0, 31)); };
  const head = (t) => [[`${ORG} — ${COLLEGE} — ${orgInfo().dept}`], [`${t} — ${A.me.name} — ${gDT(new Date().toISOString())}`]];
  add(head('كشف حسابات المتدربين (لا يتضمن كلمات المرور)').concat([['م', 'اسم المتدرب', 'الرقم التدريبي', 'المقررات', 'الشعب', 'اسم المستخدم', 'حالة الحساب', 'حالة تسليم كلمة المرور', 'آخر تسجيل دخول']],
    list.map((t, i) => { const a = tAcc(t.id); return [i + 1, t.name, t.id, tCourses(t).join('، '), tSecs(t), a ? a.user : '—', TST[tState(a)][0], a && a.deliv && a.deliv.at ? 'تم التسليم' : a ? 'لم تُسلَّم' : '—', a && a.last && a.last.at ? gDT(a.last.at) : 'لم يسجل الدخول']; })),
  'ملخص الحسابات', [{ wch: 5 }, { wch: 38 }, { wch: 14 }, { wch: 26 }, { wch: 16 }, { wch: 14 }, { wch: 12 }, { wch: 18 }, { wch: 18 }]);
  const secs = [...new Set(list.flatMap((t) => t.secs.map((s) => s.crn)))].sort();
  secs.forEach((crn) => {
    const rows = list.filter((t) => t.secs.some((s) => s.crn === crn)), c = (rows[0] ? (rows[0].secs.find((s) => s.crn === crn) || {}).course : '') || '';
    add(head(`حسابات متدربي الشعبة ${crn} — ${c}`).concat([['م', 'اسم المتدرب', 'الرقم التدريبي', 'اسم المستخدم', 'حالة إنشاء الحساب', 'حالة التفعيل']],
      rows.map((t, i) => { const a = tAcc(t.id); return [i + 1, t.name, t.id, a ? a.user : '—', a ? 'منشأ' : 'لم يُنشأ', a ? TST[tState(a)][0] : '—']; })),
    'الشعبة ' + crn, [{ wch: 5 }, { wch: 38 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 12 }]);
  });
  await save(tFileName('كشف حسابات المتدربين'), new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  gLog([['acc-book', '', '', '', '', String(list.length), 'كشف حسابات المتدربين بلا كلمات مرور']]);
}
/* ملف كلمات المرور: يُنزَّل مرة واحدة عند الإنشاء أو إعادة الإصدار، ويُسجَّل تنزيله */
async function tPwBook(made, label) {
  let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return false; }
  const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
  const add = (aoa, n, cols) => { const ws = X.utils.aoa_to_sheet(aoa); ws['!views'] = [{ RTL: true }]; ws['!cols'] = cols; X.utils.book_append_sheet(wb, ws, n.slice(0, 31)); };
  const head = (t) => [[`كلمات مرور منصة حاضر — ${t}`], ['سري — لا يُنشر ولا يُرسل في مجموعات، ويُسلَّم لكل متدرب على حدة.']];
  const cols = [{ wch: 5 }, { wch: 10 }, { wch: 14 }, { wch: 38 }, { wch: 14 }];
  add(head(label).concat([['م', 'الشعب', 'الرقم التدريبي', 'اسم المتدرب', 'كلمة المرور']], made.map((m, i) => [i + 1, m.secs, m.id, m.name, m.pw])), 'كل المتدربين', cols);
  const bySec = {}; made.forEach((m) => m.secs.split('، ').forEach((c) => (bySec[c] = bySec[c] || []).push(m)));
  Object.keys(bySec).sort().forEach((crn) => add(head('الشعبة ' + crn).concat([['م', 'الشعبة', 'الرقم التدريبي', 'اسم المتدرب', 'كلمة المرور']], bySec[crn].map((m, i) => [i + 1, crn, m.id, m.name, m.pw])), 'الشعبة ' + crn, cols));
  const cards = [];
  for (let i = 0; i < made.length; i += 2) {
    const c = (m) => (m ? [`منصة حاضر — ${COLLEGE}`, `${m.name} — ${m.secs}`, `اسم المستخدم: ${m.id}`, `كلمة المرور: ${m.pw}`, 'غيّر كلمة المرور عند أول دخول.'] : ['', '', '', '', '']);
    const a = c(made[i]), b = c(made[i + 1]);
    for (let r = 0; r < 5; r++) cards.push([a[r], '', b[r]]);
    cards.push(['', '', '']);
  }
  add(cards, 'بطاقات التوزيع', [{ wch: 46 }, { wch: 4 }, { wch: 46 }]);
  await save(tFileName('كلمات المرور المؤقتة'), new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  gLog([['acc-pwfile', '', '', '', '', String(made.length), `تنزيل ملف كلمات المرور المؤقتة — ${label} (بلا تسجيل الكلمات نفسها)`]]);
  return true;
}
/* ---------- الواجهة ---------- */
NAV.find((g) => g[0] === 'الأدوات')[1].unshift(['taccs', 'حسابات المتدربين']);
const tChip = (a) => `<span class="chip ${TST[tState(a)][1]}">${TST[tState(a)][0]}</span>`;
VIEWS.taccs = () => {
  const list = tRoster(), s = tStats(list), F = Object.assign({ q: '', show: 'all', crn: '' }, GX.tf);
  if (!list.length) return `${gHead('إدارة حسابات المتدربين', 'حساب لكل متدرب في شعبك: الرقم التدريبي اسم المستخدم، وكلمة مرور مؤقتة يولّدها النظام.')}<section class="panel empty"><h2>لا يوجد متدربون في شعب مسندة إليك</h2></section>`;
  const secs = [...new Set(list.flatMap((t) => t.secs.map((x) => x.crn)))].sort();
  const rows = list.filter((t) => (!F.crn || t.secs.some((x) => x.crn === F.crn)) && ({ all: () => true, none: (x) => !tAcc(x.id), made: (x) => !!tAcc(x.id), active: (x) => tState(tAcc(x.id)) === 'active', notactive: (x) => tAcc(x.id) && tState(tAcc(x.id)) !== 'active', deliv: (x) => { const a = tAcc(x.id); return a && a.deliv && a.deliv.at; }, notdeliv: (x) => { const a = tAcc(x.id); return a && !(a.deliv && a.deliv.at); } }[F.show] || (() => true))(t));
  const noAcc = list.filter((t) => !tAcc(t.id) && tMine(t)).length;
  const byCrn = secs.map((crn) => { const l = list.filter((t) => t.secs.some((x) => x.crn === crn)); const st = tStats(l); return { label: 'الشعبة ' + crn, مفعّل: st.active, 'منشأ غير مفعّل': st.made - st.active, 'بلا حساب': st.n - st.made }; });
  return `${gHead('إدارة حسابات المتدربين', `${isAdmin() || isHead() ? 'كل متدربي القسم' : 'متدربو شعبك'} • حساب واحد لكل متدرب مهما تعددت شعبه`, `${tMay() ? `<button class="btn p" data-act="t-make">إنشاء حسابات المتدربين${noAcc ? ` (${noAcc})` : ''}</button>` : ''}${dl && can('export') ? '<button class="btn" data-act="t-book">إنشاء مصنف بيانات حسابات المتدربين</button>' : ''}${tMay() ? '<label class="btn">استيراد كلمات مرور من مصنف<input type="file" accept=".xlsx" hidden data-change="t-import"></label>' : ''}`)}
  <div class="tiles kpi"><div class="tile"><b>${s.n}</b><span>إجمالي المتدربين</span></div><div class="tile"><b>${s.made}</b><span>الحسابات المنشأة</span></div><div class="tile ok"><b>${s.active}</b><span>المفعّلة</span></div><div class="tile warn"><b>${s.n - s.active}</b><span>غير المفعّلة</span></div><div class="tile ok"><b>${s.deliv}</b><span>سُلّمت كلمة المرور</span></div><div class="tile warn"><b>${s.notDeliv}</b><span>لم تُسلَّم</span></div><div class="tile"><b>${s.logged}</b><span>سجّلوا الدخول</span></div><div class="tile"><b>${s.never}</b><span>لم يسجلوا الدخول</span></div></div>
  <div class="gnote warn"><b>قبل الاعتماد:</b> بوابة المتدرب لا تعمل على الرابط الحالي، لأن منصة حاضر تعمل داخل Claude ولا تفتح إلا لمن لديه حساب Claude ودعوة. الحسابات وكلمات المرور والمصنفات تُنشأ وتُحفظ هنا من الآن، وتصبح صالحة للدخول فور نقل المنصة إلى استضافة مفتوحة.</div>
  ${hbars('تفعيل الحسابات لكل شعبة', byCrn, [['مفعّل', 'مفعّل', 'c5'], ['منشأ غير مفعّل', 'منشأ غير مفعّل', 'c3'], ['بلا حساب', 'بلا حساب', 'c1']])}
  <section class="panel"><div class="row gtools"><input type="search" id="gQ" placeholder="بحث بالاسم أو الرقم التدريبي" aria-label="بحث" value="${esc(F.q)}"><label>الشعبة <select data-change="t-f" data-k="crn"><option value="">الكل</option>${secs.map((c) => `<option value="${c}" ${F.crn === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label><label>التصفية <select data-change="t-f" data-k="show">${[['all', 'الكل'], ['none', 'بلا حساب'], ['made', 'لها حساب'], ['active', 'مفعّلة'], ['notactive', 'غير مفعّلة'], ['deliv', 'سُلّمت'], ['notdeliv', 'لم تُسلَّم']].map(([k, t]) => `<option value="${k}" ${F.show === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label>${tMay() ? '<button class="btn s" data-act="t-deliv-all">تسجيل تسليم الظاهرين</button>' : ''}</div>
  <div class="tw" style="max-height:62vh;overflow:auto"><table><thead><tr><th class="n">م</th><th>اسم المتدرب</th><th class="n">الرقم التدريبي</th><th>المقررات والشعب</th><th class="n">اسم المستخدم</th><th class="n">حالة الحساب</th><th class="n">تسليم كلمة المرور</th><th class="n">آخر دخول</th><th>الإجراءات</th></tr></thead><tbody id="gBody">${rows.map((t, i) => { const a = tAcc(t.id), d = a && a.deliv && a.deliv.at, key = G.normName(t.name + ' ' + t.id), q = G.normName(F.q);
    const b = [];
    if (tMine(t) && tMay()) { if (!a) b.push(`<button class="btn s p" data-act="t-make-one" data-id="${t.id}">إنشاء حساب</button>`); else { b.push(`<button class="btn s" data-act="t-reissue" data-id="${t.id}">إعادة إصدار</button>`); if (!d) b.push(`<button class="btn s" data-act="t-deliv" data-id="${t.id}">تسليم</button>`); } }
    if (a && isAdmin()) b.push(`<button class="btn s ${a.st === 'disabled' ? '' : 'd'}" data-act="t-toggle" data-id="${t.id}">${a.st === 'disabled' ? 'تفعيل' : 'تعطيل'}</button>`);
    return `<tr data-s="${esc(key)}"${q && !key.includes(q) ? ' hidden' : ''}><td class="n">${i + 1}</td><td><b>${esc(t.name)}</b></td><td class="n" dir="ltr">${esc(t.id)}</td><td style="font-size:12.5px">${esc(tCourses(t).join('، '))}<br><small class="sub">${esc(tSecs(t))}</small></td><td class="n" dir="ltr">${a ? esc(a.user) : '—'}</td><td class="n">${tChip(a)}${a && a.temp ? '<br><small class="sub">مؤقتة</small>' : ''}</td><td class="n">${d ? `<span class="chip ok">تم التسليم</span><br><small class="sub">${esc(a.deliv.how || '')}</small>` : a ? '<span class="chip warn">لم تُسلَّم</span>' : '—'}</td><td class="n" style="font-size:12.5px">${a && a.last && a.last.at ? gDT(a.last.at) : '—'}</td><td><div class="row">${b.join('') || '<span class="sub">—</span>'}</div></td></tr>`; }).join('')}</tbody></table></div>
  <div class="sub" style="margin-top:6px">الرقم التدريبي اسم مستخدم ثابت لا يُعدَّل. كلمة المرور تُحفظ مشفّرة (PBKDF2-SHA256 بملح و150 ألف دورة) ولا تظهر في سجل العمليات ولا في مصنف الحسابات، وتظهر مرة واحدة عند الإنشاء أو إعادة الإصدار.</div></section>`;
};
/* ---------- الأفعال ---------- */
function tShowMade(made, label) {
  const html = `<h2>بيانات الدخول المؤقتة — ${esc(label)}</h2><div class="gnote warn"><b>تظهر مرة واحدة.</b> نزّل الملف أو انسخ البيانات الآن، فبعد إغلاق هذه النافذة لا يمكن عرض كلمات المرور مرة أخرى، ولا تُحفظ في المنصة إلا مشفّرة. وإن فُقدت، أعد إصدار كلمة مرور للمتدرب.</div>
  <div class="tw" style="max-height:46vh;overflow:auto"><table><thead><tr><th class="n">م</th><th>اسم المتدرب</th><th class="n">اسم المستخدم</th><th class="n">كلمة المرور المؤقتة</th><th class="n">الشعب</th></tr></thead><tbody>${made.map((m, i) => `<tr><td class="n">${i + 1}</td><td>${esc(m.name)}</td><td class="n" dir="ltr">${esc(m.id)}</td><td class="n" dir="ltr"><b>${esc(m.pw)}</b></td><td class="n">${esc(m.secs)}</td></tr>`).join('')}</tbody></table></div>
  <div class="row">${dl && can('export') ? '<button class="btn p" data-act="t-pwfile">تنزيل ملف كلمات المرور وبطاقات التوزيع</button>' : ''}<button class="btn" data-act="t-pwcopy">نسخ القائمة</button><button class="btn" data-act="modal-close">تم، أغلق</button></div>`;
  A.tMade = made; A.tLabel = label;
  modal(html, 'wide');
}
const tCoursePick = (list) => [...new Set(list.flatMap((t) => tCourses(t)))];
function tMakeAsk() {
  const list = tRoster().filter((t) => tMine(t)), none = list.filter((t) => !tAcc(t.id)), courses = tCoursePick(none);
  if (!none.length) { toast('كل متدربي شعبك لهم حسابات. لإعادة إصدار كلمة مرور استخدم زر «إعادة إصدار».'); return; }
  modal(`<h2>إنشاء حسابات المتدربين</h2><div>سيُنشأ حساب لكل متدرب بلا حساب في شعبك، باسم مستخدم هو رقمه التدريبي وكلمة مرور مؤقتة عشوائية مستقلة.</div>
  <label>المقرر<select id="tmC"><option value="">كل المقررات (${none.length} متدرباً)</option>${courses.map((c) => `<option value="${esc(c)}">${esc(c)} (${none.filter((t) => tCourses(t).includes(c)).length} متدرباً)</option>`).join('')}</select></label>
  <div class="gnote info">المتدرب المسجل في أكثر من شعبة يحصل على حساب واحد فقط. ولن تُمس حسابات أُنشئت من قبل.</div>
  <div class="row"><button class="btn p" data-act="t-make-go">إنشاء الحسابات</button><button class="btn" data-act="modal-close">إلغاء</button></div>`, 'md');
}
Object.assign(ACT, {
  't-make': tMakeAsk,
  't-make-go': async () => {
    const c = $('#tmC') ? $('#tmC').value : '', list = tRoster().filter((t) => tMine(t) && !tAcc(t.id) && (!c || tCourses(t).includes(c)));
    closeModal(); if (!list.length) { toast('لا توجد حسابات لإنشائها.'); return; }
    const made = await tCreate(list, {});
    rebuild(); render(true);
    if (made.length) tShowMade(made, c || 'كل المقررات'); else toast('لم يُنشأ أي حساب.');
  },
  't-make-one': async (e) => { const t = tRoster().find((x) => x.id === e.dataset.id); if (!t || !tMine(t)) return; const made = await tCreate([t], {}); rebuild(); render(true); if (made.length) tShowMade(made, t.name); },
  't-reissue': (e) => { const t = tRoster().find((x) => x.id === e.dataset.id); if (!t || !tMine(t)) return; A.tOne = t.id; modal(`<h2>إعادة إصدار كلمة المرور</h2><div>سيحصل <b>${esc(t.name)}</b> (${esc(t.id)}) على كلمة مرور مؤقتة جديدة، وتبطل السابقة فوراً، ويُطلب منه تغييرها عند أول دخول.</div><div class="row"><button class="btn p" data-act="t-reissue-go">إعادة الإصدار</button><button class="btn" data-act="modal-close">إلغاء</button></div>`, 'sm'); },
  't-reissue-go': async () => { const t = tRoster().find((x) => x.id === A.tOne); closeModal(); if (!t) return; const made = await tCreate([t], { reissue: true }); rebuild(); render(true); if (made.length) tShowMade(made, t.name); },
  't-deliv': (e) => { A.tOne = e.dataset.id; const t = tRoster().find((x) => x.id === e.dataset.id); modal(`<h2>تسجيل تسليم بيانات الدخول</h2><div>${esc(t ? t.name : '')} (${esc(e.dataset.id)})</div><label>طريقة التسليم<select id="tdH"><option>حضورياً</option><option>بطاقة مطبوعة</option><option>رسالة خاصة</option><option>البريد الرسمي</option><option>أخرى</option></select></label><div class="row"><button class="btn p" data-act="t-deliv-go">تسجيل التسليم</button><button class="btn" data-act="modal-close">إلغاء</button></div>`, 'sm'); },
  't-deliv-go': () => { const how = $('#tdH') ? $('#tdH').value : ''; tDeliver(A.tOne, how); closeModal(); render(true); toast('سُجّل التسليم.'); },
  't-deliv-all': () => { const ids = [...document.querySelectorAll('#gBody tr:not([hidden])')].map((tr) => (tr.querySelector('[data-act=t-deliv]') || {}).dataset).filter(Boolean).map((d) => d.id); if (!ids.length) { toast('لا توجد حسابات ظاهرة بانتظار التسليم.'); return; } A.tAll = ids; modal(`<h2>تسجيل تسليم جماعي</h2><div>سيُسجَّل تسليم بيانات الدخول لـ<b>${ids.length}</b> متدرباً من الظاهرين في القائمة.</div><label>طريقة التسليم<select id="tdH"><option>حضورياً</option><option>بطاقة مطبوعة</option><option>رسالة خاصة</option><option>أخرى</option></select></label><div class="row"><button class="btn p" data-act="t-deliv-all-go">تسجيل</button><button class="btn" data-act="modal-close">إلغاء</button></div>`, 'sm'); },
  't-deliv-all-go': () => { const how = $('#tdH') ? $('#tdH').value : ''; (A.tAll || []).forEach((id) => tDeliver(id, how)); closeModal(); render(true); toast(`سُجّل تسليم ${(A.tAll || []).length} حساباً.`); },
  't-toggle': (e) => { if (!isAdmin()) return; const a = tAcc(e.dataset.id); if (!a) return; const off = a.st !== 'disabled'; tSet(e.dataset.id, { st: off ? 'disabled' : 'new' }, off ? 'acc-dis' : 'acc-en', ''); render(true); toast(off ? 'عُطّل الحساب.' : 'أُعيد تفعيل الحساب.'); },
  't-book': () => tBook(tRoster()),
  't-pwfile': async (e) => { if (await tPwBook(A.tMade || [], A.tLabel || '')) { const b = e; if (b && b.tagName === 'BUTTON') b.textContent = 'نُزّل الملف ✓'; } },
  't-pwcopy': () => copyText((A.tMade || []).map((m) => `${m.name}\t${m.id}\t${m.pw}`).join('\n'), 'نُسخت القائمة. الصقها في مكان آمن.'),
});
Object.assign(CHG, {
  't-f': (e) => { GX.tf = Object.assign({}, GX.tf, { [e.dataset.k]: e.value }); e.blur(); render(true); },
  't-import': (e) => { const f = e.files[0]; e.value = ''; if (f) tImport(f).catch(() => toast('تعذرت قراءة الملف.')); },
});
/* استيراد كلمات مرور جاهزة من مصنف (الرقم التدريبي + كلمة المرور) */
async function tImport(file) {
  if (!tMay()) { toast('هذا الإجراء لمدرب الشعبة.'); return; }
  let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
  const wb = X.read(await file.arrayBuffer(), { type: 'array' }), roster = tRoster(), pw = {}, hit = [], miss = [], dup = [];
  wb.SheetNames.forEach((n) => {
    const a = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: false, defval: null }), hi = gFindHeader(a, ['الرقم التدريبي', 'كلمة المرور']);
    if (hi < 0) return;
    const h = a[hi].map(gCell), ci = h.indexOf('الرقم التدريبي'), cp = h.indexOf('كلمة المرور');
    for (let i = hi + 1; i < a.length; i++) {
      const r = a[i] || [], id = gCell(r[ci]).replace(/\.0$/, ''), p = gCell(r[cp]);
      if (!/^\d{6,12}$/.test(id) || !p) continue;
      if (pw[id]) { if (pw[id] !== p) dup.push(id); continue; }
      const t = roster.find((x) => x.id === id && tMine(x));
      if (!t) { miss.push(id); continue; }
      if (p.length < 6) { miss.push(id + ' (كلمة مرور قصيرة)'); continue; }
      pw[id] = p; hit.push(t);
    }
  });
  if (!hit.length) { modal(`<h2>لا شيء للاستيراد</h2><div class="gnote bad">لم أجد في الملف أعمدة «الرقم التدريبي» و«كلمة المرور» بأرقام متدربين في شعبك.${miss.length ? `<br>${miss.length} رقماً في الملف ليس في شعبك.` : ''}</div><div class="row"><button class="btn" data-act="modal-close">إغلاق</button></div>`, 'sm'); return; }
  A.tImp = { pw, hit, file: file.name };
  const neu = hit.filter((t) => !tAcc(t.id)).length;
  modal(`<h2>استيراد كلمات مرور من مصنف</h2><div><b>${esc(file.name)}</b></div><div class="grev"><span>متدربون مطابقون <b>${hit.length}</b></span><span>حسابات جديدة <b>${neu}</b></span><span>حسابات ستُحدَّث كلمتها <b>${hit.length - neu}</b></span><span>أرقام خارج شعبك <b>${miss.length}</b></span></div>
  <div class="gnote info">تُحفظ كلمات المرور مشفّرة، ولا تُخزَّن ولا تُسجَّل نصاً صريحاً. وتبقى «مؤقتة» يُطلب تغييرها عند أول دخول. الملف الذي استوردته يبقى عندك، والمنصة لا تنشئ نسخة منه.</div>
  <div class="tw" style="max-height:34vh;overflow:auto"><table><thead><tr><th class="n">م</th><th>اسم المتدرب</th><th class="n">الرقم التدريبي</th><th class="n">الحالة</th></tr></thead><tbody>${hit.map((t, i) => `<tr><td class="n">${i + 1}</td><td>${esc(t.name)}</td><td class="n" dir="ltr">${esc(t.id)}</td><td class="n">${tAcc(t.id) ? 'تحديث كلمة المرور' : 'حساب جديد'}</td></tr>`).join('')}</tbody></table></div>
  <div class="row"><button class="btn p" data-act="t-import-ok">اعتماد الاستيراد</button><button class="btn" data-act="modal-close">إلغاء</button></div>`, 'wide');
}
ACT['t-import-ok'] = async () => {
  const p = A.tImp; if (!p) return;
  closeModal();
  const made = await tCreate(p.hit, { pw: p.pw, reissue: true });
  gLog([['acc-import', '', '', '', '', String(made.length), `كلمات مرور مستوردة من ${p.file}`]]);
  A.tImp = null; rebuild(); render(true);
  toast(`حُفظت كلمات مرور ${made.length} متدرباً مشفّرة.`);
};
Object.assign(GACT, { 'acc-new': 'إنشاء حساب متدرب', 'acc-pw': 'إصدار كلمة مرور مؤقتة', 'acc-deliv': 'تسليم بيانات الدخول', 'acc-dis': 'تعطيل حساب متدرب', 'acc-en': 'تفعيل حساب متدرب', 'acc-book': 'تنزيل كشف الحسابات', 'acc-pwfile': 'تنزيل ملف كلمات المرور', 'acc-import': 'استيراد كلمات مرور', 'acc-login': 'دخول متدرب' });
VIEW_CHG.add('t-f');
