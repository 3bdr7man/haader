/* ---------- إدارة الاختبارات: دورة العمل بمراحلها الثماني ---------- */
VIEWS.gexams = () => {
  if (!gHas()) return gNoData('إدارة الاختبارات');
  const td = new Date().toLocaleDateString('en-CA');
  return `${gHead('إدارة الاختبارات', 'دورة عمل كل شعبة من إعداد الاختبار حتى إغلاق عملية الرصد، ولكل مرحلة حالتها.')}${gLoading()}
  <div class="legend gleg"><span><i class="gdot done"></i>منجزة</span><span><i class="gdot cur"></i>الحالية</span><span><i class="gdot bad"></i>تحتاج إجراء</span><span><i class="gdot wait"></i>لم تبدأ</span></div>
  ${gSecs().map((sec) => { const st = gSt(sec), nx = gNext(sec, st), ex = sec.exam || {}; return `<section class="panel gexam"><div class="row between"><div><b>${esc(sec.name)}</b> — الشعبة <button class="lnk gcrn" data-act="g-open" data-crn="${sec.crn}">${sec.crn}</button> ${gStChip(st)} <small class="sub">${esc(gOwnerName(sec.crn))}</small></div><div class="row"><span class="sub">${ex.date ? `الاختبار: ${esc(ex.date)}${ex.time ? ' ' + esc(ex.time) : ''}${ex.place ? ' • ' + esc(ex.place) : ''}${ex.date <= td ? ' • نُفّذ' : ''}` : 'لم يُحدَّد موعد الاختبار'}</span>${gMay(sec.crn) ? `<button class="btn s" data-act="g-exam" data-crn="${sec.crn}">إعداد الاختبار</button><button class="btn s ${nx[2]}" data-act="${nx[0]}" data-crn="${sec.crn}">${nx[1]}</button>` : ''}</div></div>${gStageStrip(sec)}${st.why ? `<div class="sub">${esc(st.why)}</div>` : ''}</section>`; }).join('')}`;
};
function gExamForm(crn) {
  const sec = A.raw.gsec[crn], ex = sec.exam || {};
  A.gEdit = crn;
  modal(`<h2>إعداد الاختبار — ${esc(sec.name)} (${crn})</h2><form data-submit="gExam" class="stack"><div class="row"><label>تاريخ الاختبار<input type="date" id="geD" value="${esc(ex.date || '')}"></label><label>الوقت<input type="time" id="geT" value="${esc(ex.time || '')}"></label></div><label>المكان<input type="text" id="geP" value="${esc(ex.place || '')}" placeholder="المعمل أو القاعة"></label><label>ملاحظات<input type="text" id="geN" value="${esc(ex.note || '')}"></label><div class="sub">توزيع الدرجات المعتمد: ${esc(gDistText(sec))}</div><div class="row"><button class="btn p">حفظ</button><button type="button" class="btn" data-act="modal-close">إلغاء</button></div></form>`);
}
SUBMIT.gExam = () => {
  const crn = A.gEdit; if (!gMay(crn)) { toast(gNotMine(crn)); return; }
  const ex = { date: $('#geD').value, time: $('#geT').value, place: $('#geP').value.trim(), note: $('#geN').value.trim() };
  gPatch(crn, { exam: ex }); gLog([['exam', crn, '', '', '', ex.date, [ex.time, ex.place, ex.note].filter(Boolean).join(' • ')]]);
  closeModal(); render(true); toast('حُفظ إعداد الاختبار.');
};

/* ---------- مراجعة واعتماد الدرجات والتجميد الأكاديمي ---------- */
const gSnapRow = (x) => `<tr><td dir="ltr" style="text-align:right">${esc(x.id)}</td><td class="n">${esc(x.crn)}</td><td>${{ approve: 'اعتماد', schedule: 'جدولة', upload: 'إرسال', uploaded: 'ما سُجّل في رايات', read: 'قراءة للتحقق' }[x.kind] || esc(x.kind)}</td><td class="n">${gDT(x.at)}</td><td>${esc(x.byName || '')}</td><td class="n">${x.n}</td><td class="n" dir="ltr">${esc(x.sig)}</td><td class="n">${gSnapOk(x) ? '<span class="chip ok">سليمة</span>' : '<span class="chip bad">لا تطابق بصمتها</span>'}</td><td>${gSee(x.crn) ? `<button class="btn s" data-act="g-snap" data-id="${esc(x.id)}">عرض</button>` : ''}</td></tr>`;
VIEWS.greview = () => {
  if (!gHas()) return gNoData('مراجعة واعتماد الدرجات');
  const snaps = Object.values(A.raw.gsnap).filter((x) => x && gList(x.crn)).sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 25);
  return `${gHead('مراجعة واعتماد الدرجات', 'اعتماد المدرب يجمّد الدرجات ويحفظ نسخة ثابتة ببصمتها. أي تغيير بعد ذلك يلغي الجاهزية ويتطلب اعتماداً جديداً.')}${gLoading()}
  <div class="gnote info">الاعتماد وفك التجميد من صلاحيات مدرب المقرر وحده، ولا يحتاج موافقة أحد. ولرئيس القسم ومسؤول المنصة متابعة الاكتمال والاطلاع على الدرجات وسجل التدقيق دون تعديل.</div>
  ${gSecs().map((sec) => {
    const st = gSt(sec), s = st.stats, f = sec.flow || {}, crn = sec.crn, mine = gMay(crn), lk = f.lock || {}, b = [];
    if (gSee(crn)) b.push(`<button class="btn s" data-act="g-preview" data-crn="${crn}">معاينة الدرجات</button>`);
    if (mine && !lk.on && s.complete) b.push(`<button class="btn s p" data-act="g-approve-ask" data-crn="${crn}">اعتماد الدرجات وتجميدها</button>`);
    if (mine && !lk.on && !s.complete) b.push(`<button class="btn s" data-act="g-enter" data-crn="${crn}">استكمال الإدخال</button>`);
    if (lk.on && mine && st.k !== 'syncing') b.push(`<button class="btn s" data-act="g-unlock-ask" data-crn="${crn}">${st.k === 'closed' || st.k === 'synced' ? 'فتح إجراء تصحيح' : 'فك التجميد'}</button>`);
    return `<section class="panel"><div class="row between"><div><b>${esc(sec.name)}</b> — الشعبة <button class="lnk gcrn" data-act="g-open" data-crn="${crn}">${crn}</button> ${gStChip(st)} <small class="sub">${esc(gOwnerName(crn))}</small></div><div class="row">${b.join('')}</div></div>
    <div class="grev"><span>القابلون للرصد <b>${s.elig}</b></span><span>مكتمل <b>${s.done}</b></span><span>ناقص <b>${s.part + s.none}</b></span><span>أخطاء <b class="${s.err ? 'gred' : ''}">${s.err}</b></span>${gSee(crn) ? `<span>المتوسط <b>${s.avg == null ? '—' : G.fmt(s.avg)}</b></span><span>الأعلى <b>${s.max == null ? '—' : G.fmt(s.max)}</b></span><span>الأدنى <b>${s.min == null ? '—' : G.fmt(s.min)}</b></span>` : ''}<span>${gBar(s.pct, s.err ? 'bad' : s.pct === 1 ? 'ok' : '')}</span></div>
    ${lk.on ? `<div class="sub">🔒 ${st.lockedOk ? 'مجمدة' : '<b class="gred">تغيرت بعد التجميد</b>'} منذ ${gDT(lk.at)} — ${esc(lk.byName || '')} — النسخة <span dir="ltr">${esc(lk.snap || '')}</span> — البصمة <span dir="ltr">${esc(lk.sig || '')}</span></div>` : ''}
    ${s.issues.map((x) => `<div class="gnote ${x.warn ? 'warn' : 'bad'}">${esc(x.t)}</div>`).join('')}</section>`;
  }).join('')}
  <section class="panel"><h2>النسخ المجمدة — آخر ${snaps.length}</h2>${snaps.length ? `<div class="tw"><table><thead><tr><th>النسخة</th><th class="n">الشعبة</th><th>النوع</th><th class="n">الوقت</th><th>المنفذ</th><th class="n">المتدربون</th><th class="n">البصمة</th><th class="n">السلامة</th><th></th></tr></thead><tbody>${snaps.map(gSnapRow).join('')}</tbody></table></div><div class="sub" style="margin-top:6px">النسخ لا تُعدَّل ولا تُحذف من المنصة. بصمة كل نسخة مسجلة في سجل التدقيق، فأي عبث بها يظهر هنا.</div>` : '<div class="sub">لا توجد نسخ مجمدة بعد.</div>'}</section>`;
};
const gGradeTable = (comps, rows) => `<div class="tw" style="max-height:52vh;overflow:auto"><table><thead><tr><th class="n">م</th><th>اسم المتدرب</th><th class="n">الرقم التدريبي</th>${comps.map((c) => `<th class="n">${esc(c.k)}<small style="display:block;font-weight:500">من ${G.fmt(c.max)}</small></th>`).join('')}<th class="n">المجموع</th></tr></thead><tbody>${rows.map((r, i) => `<tr><td class="n">${i + 1}</td><td>${esc(r.name)}</td><td class="n" dir="ltr">${esc(r.id)}</td>${comps.map((c) => `<td class="n">${r.g[c.k] == null ? '<span class="gred">—</span>' : G.fmt(r.g[c.k])}</td>`).join('')}<td class="n"><b>${r.total == null ? '—' : G.fmt(r.total)}</b></td></tr>`).join('')}</tbody></table></div>`;
function gPreview(crn, confirm) {
  const sec = A.raw.gsec[crn], snap = G.snapshot(sec, gMarks(crn), 'preview', gWho(), new Date().toISOString()), s = G.stats(sec, gMarks(crn));
  A.gEdit = crn;
  modal(`<h2>${confirm ? 'اعتماد الدرجات وتجميدها' : 'معاينة الدرجات'} — ${esc(sec.name)} (${crn})</h2><div class="grev"><span>القابلون للرصد <b>${s.elig}</b></span><span>مكتمل <b>${s.done}</b></span><span>المتوسط <b>${s.avg == null ? '—' : G.fmt(s.avg)}</b></span><span>الأعلى <b>${s.max == null ? '—' : G.fmt(s.max)}</b></span><span>الأدنى <b>${s.min == null ? '—' : G.fmt(s.min)}</b></span><span>البصمة <b dir="ltr">${snap.sig}</b></span></div>${gGradeTable(snap.comps, snap.rows)}
  ${confirm ? `<div class="gnote warn">الاعتماد صلاحيتك بصفتك مدرب المقرر. بعده تُجمَّد الدرجات وتُحفظ نسخة ثابتة منها، ولا تُعدَّل إلا بفك التجميد بسبب يُسجَّل في سجل التدقيق.</div><div class="row"><button class="btn p" data-act="g-approve" data-crn="${crn}" ${s.complete ? '' : 'disabled'}>تأكيد الاعتماد والتجميد</button><button class="btn" data-act="modal-close">رجوع</button></div>` : '<div class="row"><button class="btn" data-act="modal-close">إغلاق</button></div>'}`);
}
function gReasonForm(title, text, submit, crn, btn, must) {
  A.gEdit = crn;
  modal(`<h2>${title}</h2><div>${text}</div><form data-submit="${submit}" class="stack"><label>${must ? 'السبب (يُسجَّل في سجل التدقيق)' : 'ملاحظة'}<textarea id="grW" rows="3" ${must ? 'required minlength="5"' : ''}></textarea></label><div class="row"><button class="btn p">${btn}</button><button type="button" class="btn" data-act="modal-close">رجوع</button></div></form>`);
}
Object.assign(SUBMIT, {
  gUnlockDo: () => { const w = $('#grW').value.trim(); if (w.length < 5) { toast('اكتب السبب.'); return; } if (gUnlock(A.gEdit, w)) { closeModal(); render(true); toast('فُك التجميد وأُلغيت الجاهزية. بعد التعديل يلزم اعتماد جديد.'); } },
  gDocEx: () => { const w = $('#grW').value.trim(); if (w.length < 5) { toast('اكتب توثيق الحالات.'); return; } gDocExceptions(A.gEdit, w); closeModal(); render(true); toast('وُثّقت الحالات.'); },
});

/* ---------- جدولة رفع الدرجات إلى رايات ---------- */
const SCH_ST = { none: ['غير مجدول', ''], on: ['مجدول', 'info'], paused: ['موقوف مؤقتاً', 'warn'], cancelled: ['أُلغيت الجدولة', ''], done: ['نُفذ', 'ok'] };
const gNoticeList = (list) => (list.length ? `<ul class="gnotices">${list.map((n) => `<li class="${n.tone}"><span>${esc(n.text)}</span><button class="btn s" data-act="${n.act}" data-crn="${n.crn}">${n.label}</button></li>`).join('')}</ul>` : '<div class="sub">لا إشعارات حالياً.</div>');
VIEWS.gsched = () => {
  if (!gHas()) return gNoData('جدولة رفع الدرجات إلى رايات');
  const now = gNow();
  return `${gHead('جدولة رفع الدرجات إلى رايات', 'لكل شعبة موعدها المستقل، ورفع شعبة لا يرفع غيرها.')}${gLoading()}
  <div class="gnote info">كيف تعمل الجدولة: عند تحديد الموعد تُحفظ نسخة ثابتة من الدرجات التي ستُرسل. وعند حلوله تنبهك المنصة، ثم تنفّذ الرفع أنت من تبويب رايات بجلستك. المنصة لا ترفع في غيابك، لأن رايات لا يقبل الدخول إلا منك ولا تُخزَّن كلمة مرورك هنا.</div>
  <section class="panel"><h2>الإشعارات</h2>${gNoticeList(gNotices())}</section>
  <section class="panel"><h2>لوحة الجدولة</h2><div class="tw"><table><thead><tr><th>اسم المقرر</th><th class="n">رقم الشعبة</th><th class="n">عدد المتدربين</th><th class="n">الدرجات المكتملة</th><th>نسبة اكتمال الرصد</th><th>الموعد المحدد</th><th class="n">حالة الجدولة</th><th>الإجراءات</th></tr></thead><tbody>${gSecs().map((sec) => {
    const st = gSt(sec), s = st.stats, sch = (sec.flow || {}).sched || {}, crn = sec.crn, mine = gMay(crn), k = sch.st && SCH_ST[sch.st] ? sch.st : 'none', due = k === 'on' && sch.at && Date.parse(sch.at) <= now, b = [];
    if (mine && st.approved && !['syncing', 'synced', 'closed'].includes(st.k)) {
      b.push(`<button class="btn s" data-act="g-sched-ask" data-crn="${crn}">${k === 'on' || k === 'paused' ? 'تعديل الموعد' : 'تحديد الموعد'}</button>`);
      if (k === 'on' || k === 'paused') b.push(`<button class="btn s" data-act="g-sched-x" data-crn="${crn}">إلغاء الجدولة</button>`);
      if (k === 'on') b.push(`<button class="btn s" data-act="g-sched-p" data-crn="${crn}">إيقاف مؤقت</button>`);
      if (k === 'paused') b.push(`<button class="btn s" data-act="g-sched-r" data-crn="${crn}">استئناف</button>`);
      if (k === 'on' && dl) b.push(`<button class="btn s" data-act="g-ics" data-crn="${crn}">تذكير للتقويم</button>`);
      b.push(`<button class="btn s p" data-act="g-up" data-crn="${crn}">التنفيذ</button>`);
    }
    return `<tr><td><b>${esc(sec.name)}</b><br><small class="sub">${esc(sec.code)}</small></td><td class="n"><button class="lnk gcrn" data-act="g-open" data-crn="${crn}">${crn}</button></td><td class="n">${s.elig}<br><small class="sub">من ${s.n}</small></td><td class="n">${s.have} / ${s.need}</td><td>${gBar(s.pct, s.err ? 'bad' : s.pct === 1 ? 'ok' : '')}</td><td style="font-size:13px">${(k === 'on' || k === 'paused') && sch.at ? `${esc(gWhen(sch.at))}<br><small class="sub ${due ? 'gred' : ''}">${due ? 'حان الموعد' : gRel(sch.at)}</small>` : '<span class="sub">يحدده المدرب</span>'}</td><td class="n"><span class="chip ${due ? 'bad' : SCH_ST[k][1]}">${due ? 'حان الموعد' : SCH_ST[k][0]}</span><br>${gStChip(st)}</td><td><div class="row">${b.join('') || `<span class="sub">${!mine ? 'للاطلاع' : st.approved ? '—' : 'تُجدول بعد الاعتماد'}</span>`}</div></td></tr>`;
  }).join('')}</tbody></table></div></section>`;
};
function gSchedForm(crn) {
  const sec = A.raw.gsec[crn], st = gSt(sec), sch = (sec.flow || {}).sched || {};
  if (!gMay(crn)) { toast(gNotMine(crn)); return; }
  if (!st.approved) { toast('لا تُجدول إلا شعبة معتمدة ومجمدة الدرجات.'); return; }
  const [d, t] = gLocalInput(sch.st === 'on' || sch.st === 'paused' ? sch.at : null);
  A.gEdit = crn;
  modal(`<h2>موعد رفع الدرجات — ${esc(sec.name)} (${crn})</h2><form data-submit="gSched" class="stack"><label class="ck"><input type="radio" name="gsW" value="now"> رفع فوري الآن</label><label class="ck"><input type="radio" name="gsW" value="at" checked> في موعد محدد</label><div class="row"><label>التاريخ<input type="date" id="gsD" value="${d}" min="${gLocalInput(new Date().toISOString())[0]}"></label><label>الساعة<input type="time" id="gsT" value="${t}"></label></div><div class="sub">تُحفظ الآن نسخة ثابتة من ${st.stats.elig} متدرباً ببصمتها. عند الموعد تنبهك المنصة، والتنفيذ يتم منك في تبويب رايات.</div><div class="row"><button class="btn p">حفظ</button><button type="button" class="btn" data-act="modal-close">إلغاء</button></div></form>`);
}
SUBMIT.gSched = async () => {
  const crn = A.gEdit, w = (document.querySelector('input[name=gsW]:checked') || {}).value;
  if (w === 'now') { closeModal(); gUpAsk(crn); return; }
  const d = $('#gsD').value, t = $('#gsT').value; if (!d || !t) { toast('حدد التاريخ والساعة.'); return; }
  if (await gSchedule(crn, new Date(`${d}T${t}:00`).toISOString())) { closeModal(); render(true); toast('حُفظ الموعد وجُمّدت نسخة الدرجات.'); }
};
function gIcs(crn) {
  const sec = A.raw.gsec[crn], sch = (sec.flow || {}).sched || {}; if (!sch.at) return;
  const z = (iso) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''), end = new Date(Date.parse(sch.at) + 30 * 60000).toISOString();
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Haader//Grades//AR', 'BEGIN:VEVENT', `UID:haader-${crn}-${z(sch.at)}@haader`, `DTSTAMP:${z(new Date().toISOString())}`, `DTSTART:${z(sch.at)}`, `DTEND:${z(end)}`, `SUMMARY:رفع درجات الشعبة ${crn} إلى رايات — ${sec.name}`, 'DESCRIPTION:افتح منصة حاضر ← المزامنة مع منصة رايات ثم نفّذ الرفع من تبويب رايات.', 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:موعد رفع الدرجات', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  save(`موعد رفع درجات ${crn}.ics`, new Blob([ics], { type: 'text/calendar' }));
}

/* ---------- زر الرفع: نافذة التأكيد ثم العملية ---------- */
function gUpAsk(crn) {
  const sec = A.raw.gsec[crn];
  if (!sec) return;
  if (!gMay(crn)) { toast(gNotMine(crn)); gLog([['blocked', crn, '', '', '', '', 'محاولة رفع شعبة غير مسندة']]); return; }
  const st = gSt(sec), s = st.stats, bl = G.blockers(sec, gMarks(crn), gNow(), gSet(), {}), f = sec.flow || {};
  const dup = f.sync && f.sync.st === 'ok' && f.sync.sig === st.sig, cur = gCurOp(sec), running = cur && cur.st === 'prepared';
  const errs = s.err + s.issues.filter((x) => !x.warn).length;
  A.gEdit = crn;
  modal(`<h2>رفع درجات الشعبة إلى رايات</h2><table class="kv"><tbody><tr><th>المقرر</th><td>${esc(sec.name)} (${esc(sec.code)})</td></tr><tr><th>الشعبة</th><td><b>${crn}</b></td></tr><tr><th>القابلون للرصد</th><td>${s.elig}</td></tr><tr><th>الدرجات المكتملة</th><td>${s.have} من ${s.need}</td></tr><tr><th>عدد الأخطاء</th><td class="${errs ? 'gred' : ''}">${errs}</td></tr><tr><th>توزيع الدرجات</th><td>${G.comps(sec).map((c) => `${esc(c.k)}: ${G.fmt(c.max)}`).join(' • ')}</td></tr><tr><th>النسخة المجمدة</th><td>${f.lock && f.lock.on ? `<span dir="ltr">${esc(f.lock.snap)}</span> • البصمة <span dir="ltr">${esc(f.lock.sig)}</span>` : '—'}</td></tr><tr><th>حالة الجاهزية</th><td>${dup ? '<span class="chip ok">مرفوعة ومطابقة</span>' : bl.length ? '<span class="chip bad">غير جاهز</span>' : '<span class="chip ok">جاهز للرفع</span>'}</td></tr></tbody></table>
  ${dup ? `<div class="gnote ok">هذه الدرجات نفسها رُفعت وتحققت مطابقتها في العملية ${esc(f.sync.opId)}. لا يُعاد إرسالها.</div>` : bl.length ? `<div class="gnote bad"><b>لا يمكن بدء الرفع:</b><ul>${bl.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div>` : `<div class="gnote info">${running ? `العملية ${esc(cur.id)} ما زالت مفتوحة، وستُنسخ حزمتها نفسها دون عملية جديدة.` : 'عند التأكيد تُنشأ عملية بمعرف فريد وتُنسخ حزمة هذه الشعبة وحدها.'} يكتب الجسر في رايات ما اختلف فقط، ثم يعيد القراءة للتحقق. لا تُعد الدرجات مرفوعة حتى تلصق نتيجة الجسر هنا وتنجح المطابقة.</div>`}
  <div class="row">${!dup && !bl.length ? `<button class="btn p" data-act="g-up-go" data-crn="${crn}">تأكيد وبدء رفع الدرجات</button>` : ''}<button class="btn" data-act="modal-close">${dup || bl.length ? 'إغلاق' : 'رجوع'}</button></div>`);
}
async function gUpGo(crn, mode) {
  const prev = gSt(A.raw.gsec[crn]).op;
  const op = await gStartOp(crn, mode || (['partial', 'failed'].includes(prev.st) ? 'retry' : 'push'));
  if (!op) return;
  closeModal(); A.gCrn = crn; GX.pkgFor = op.id;
  await copyText(gPkgText(op), op.kind === 'read' ? `نُسخت حزمة القراءة ${op.id}. شغّل الجسر في تبويب رايات.` : `بدأت العملية ${op.id} ونُسخت الحزمة. شغّل الجسر في تبويب رايات.`);
  if (A.view !== 'gsync') go('gsync'); else render(true);
}

/* ---------- المزامنة مع منصة رايات (Rayat Integration Engine) ---------- */
const gReconTable = (res) => { const bad = (res.rows || []).filter((r) => r.st !== 'ok'); return bad.length ? `<div class="tw"><table><thead><tr><th>المتدرب</th><th class="n">الرقم التدريبي</th><th class="n">في حاضر</th><th class="n">في رايات</th><th class="n">الحالة</th><th>السبب</th></tr></thead><tbody>${bad.map((r) => `<tr><td>${esc(r.name)}</td><td class="n" dir="ltr">${esc(r.id)}</td><td class="n">${r.total == null ? '—' : G.fmt(r.total)}</td><td class="n">${r.rTotal == null ? '—' : G.fmt(r.rTotal)}</td><td class="n"><span class="chip ${r.st === 'manual' || r.st === 'unverified' ? 'warn' : 'bad'}">${G.RC[r.st]}</span></td><td style="font-size:12.5px">${esc((r.why || []).join('؛ '))}</td></tr>`).join('')}</tbody></table></div>` : ''; };
const gReconSum = (res) => `<div class="grev">${Object.keys(G.RC).map((k) => `<span>${G.RC[k]} <b class="${k !== 'ok' && res.sum[k] ? 'gred' : ''}">${res.sum[k] || 0}</b></span>`).join('')}</div>`;
function gRosterDiff(sec, op) {
  const all = op && op.res && op.res.all; if (!all || !all.length) return [];
  const by = {}; sec.rows.forEach((r) => { by[r.id] = r; }); const out = [];
  all.forEach((x) => { const r = by[x.id], el = x.gr === 'Y' || x.gr === true; if (!r) out.push({ t: 'add', id: x.id, name: x.n, st: x.st, el, text: `في رايات وغير موجود في حاضر: ${x.n} (${x.id}) — ${x.st || ''}` }); else if (!!r.el !== el) out.push({ t: 'el', id: x.id, name: r.name, st: x.st, el, text: `${r.name}: ${el ? 'قابل للرصد في رايات وغير قابل في حاضر' : 'غير قابل للرصد في رايات وقابل في حاضر'} (${x.st || ''})` }); delete by[x.id]; });
  Object.values(by).forEach((r) => out.push({ t: 'gone', id: r.id, name: r.name, text: `في حاضر وغير موجود في رايات: ${r.name} (${r.id})` }));
  return out;
}
function gSyncCard(sec) {
  const crn = sec.crn, st = gSt(sec), f = sec.flow || {}, mine = gMay(crn), op = gCurOp(sec), last = gOpsOf(crn).find((o) => o.res), bl = G.blockers(sec, gMarks(crn), gNow(), gSet(), {}), run = op && op.st === 'prepared', b = [];
  const dup = f.sync && f.sync.st === 'ok' && f.sync.sig === st.sig;
  if (mine && !run) {
    if (st.op.st === 'unknown') b.push(`<button class="btn p" data-act="g-read" data-crn="${crn}">التحقق من حالة رايات أولاً</button>`);
    else if (['partial', 'failed'].includes(st.op.st)) b.push(`<button class="btn p" data-act="g-up" data-crn="${crn}">إعادة المحاولة (المختلف فقط)</button><button class="btn" data-act="g-read" data-crn="${crn}">قراءة رايات للتحقق</button>`);
    else { b.push(`<button class="btn ${bl.length ? '' : 'p'}" data-act="g-up" data-crn="${crn}" ${dup ? 'disabled' : ''}>رفع درجات الشعبة إلى رايات</button>`); b.push(`<button class="btn" data-act="g-read" data-crn="${crn}">قراءة رايات للمطابقة فقط</button>`); }
    if (st.k === 'review' && f.sync && f.sync.st === 'review') b.push(`<button class="btn" data-act="g-doc-ask" data-crn="${crn}">توثيق الحالات</button>`);
    if (st.k === 'synced') b.push(`<button class="btn p" data-act="g-close-ask" data-crn="${crn}">إغلاق عملية الرصد</button>`);
  }
  const rd = mine && last ? gRosterDiff(sec, last) : [];
  return `<section class="panel gsyncc"><div class="row between"><div><b>${esc(sec.name)}</b> — الشعبة <button class="lnk gcrn" data-act="g-open" data-crn="${crn}">${crn}</button> ${gStChip(st)} <small class="sub">${esc(gOwnerName(crn))}</small></div><div class="row">${b.join('')}</div></div>
  ${st.why ? `<div class="sub">${esc(st.why)}</div>` : ''}
  ${mine && !run && !dup && bl.length && !['closed', 'synced'].includes(st.k) ? `<div class="sub">لا يظهر التنفيذ حتى تزول الموانع: ${bl.map(esc).join(' • ')}</div>` : ''}
  ${run ? `<div class="gop"><div class="row between"><b>العملية <span dir="ltr">${esc(op.id)}</span></b><span class="sub">بدأت ${gDT(op.at)} • ${op.kind === 'read' ? 'قراءة فقط' : op.n + ' متدرباً'}</span></div><div class="gprog" role="progressbar" aria-valuemin="0" aria-valuemax="3" aria-valuenow="1"><i style="width:34%"></i></div>
    <ol class="gsteps"><li class="done"><b>الحزمة جاهزة</b><span>نُسخت إلى الحافظة.</span>${mine ? `<button class="btn s" data-act="g-pkg" data-crn="${crn}">نسخ الحزمة مرة أخرى</button>` : ''}</li><li class="cur"><b>شغّل الجسر في رايات</b><span>افتح صفحة إدخال الدرجات، واضغط إشارة «جسر حاضر»، والصق الحزمة، وراجع الفروقات، ثم اضغط التطبيق.</span><a class="btn s" href="${RAYAT_GRADES}" target="_blank" rel="noopener">فتح رايات</a></li><li><b>الصق النتيجة هنا</b>${mine ? `<textarea id="gRes" rows="2" dir="ltr" data-change="g-res" placeholder="نتيجة الجسر" aria-label="نتيجة الجسر"></textarea>` : ''}<span>تُطابق المنصة ما قُرئ من رايات مع النسخة المجمدة.</span></li></ol>
    ${mine ? `<div class="row"><button class="btn s" data-act="g-unk" data-crn="${crn}">انقطع الاتصال أو لم تصلني النتيجة</button><button class="btn s d" data-act="g-opx" data-crn="${crn}">إلغاء العملية</button></div>` : ''}</div>` : ''}
  ${last && gSee(crn) ? `<div class="gres"><div class="row between"><b>آخر نتيجة — العملية <span dir="ltr">${esc(last.id)}</span></b><span class="chip ${last.st === 'ok' ? 'ok' : last.st === 'read' ? 'info' : 'bad'}">${RES_ST[last.st] || last.st}</span></div><div class="sub">${gDT(last.res.got)} • ${esc(last.byName || '')}${last.res.applied ? ` • رُفعت ${last.res.applied.done} درجة • فشل ${last.res.applied.failed.length}` : ' • قراءة فقط دون كتابة'} • مطابق ${last.res.okN} من ${last.res.total}</div>${gReconSum(last.res)}${(last.res.head || []).concat(last.res.distBad || []).map((h) => `<div class="gnote bad">${esc(h)}</div>`).join('')}${last.res.applied && last.res.applied.failed.length ? `<div class="gnote bad">درجات رفضها رايات: ${last.res.applied.failed.slice(0, 12).map((x) => `${esc(x.n || x.id)} ${esc(x.k)}: ${esc(x.why || '')}`).join(' • ')}</div>` : ''}${gReconTable(last.res)}${f.sync && f.sync.doc && f.sync.doc.at ? `<div class="gnote info">توثيق الحالات (${esc(f.sync.doc.byName)}، ${gDT(f.sync.doc.at)}): ${esc(f.sync.doc.note)}</div>` : ''}<div class="row">${dl && can('export') ? `<button class="btn s" data-act="g-rep-recon" data-id="${esc(last.id)}">طباعة تقرير المطابقة</button>` : ''}</div></div>` : ''}
  ${rd.length ? `<div class="gnote warn"><b>قائمة المتدربين في رايات تخالف حاضر (${rd.length}):</b><ul>${rd.slice(0, 12).map((x) => `<li>${esc(x.text)}</li>`).join('')}</ul>${st.k === 'closed' || (f.lock && f.lock.on) ? '<span class="sub">فك التجميد أولاً لتحديث القائمة.</span>' : `<button class="btn s" data-act="g-roster" data-crn="${crn}">تحديث قائمة المتدربين من رايات</button>`}</div>` : ''}</section>`;
}
VIEWS.gsync = () => {
  if (!gHas()) return gNoData('المزامنة مع منصة رايات');
  const secs = gSecs(), pick = A.gCrn && secs.some((s) => s.crn === A.gCrn) ? [A.raw.gsec[A.gCrn]].concat(secs.filter((s) => s.crn !== A.gCrn)) : secs;
  return `${gHead('المزامنة مع منصة رايات', 'محرك التكامل Rayat Integration Engine: لكل شعبة زر رفع مستقل، والمزامنة لا تُعد ناجحة إلا بعد قراءة رايات ومطابقته.')}${gLoading()}
  <section class="panel"><h2>حالة التكامل</h2><table class="kv"><tbody><tr><th>الطريقة</th><td>«جسر حاضر»: إشارة مرجعية تعمل داخل تبويب رايات بجلستك أنت، وتستخدم الطلبات نفسها التي تستخدمها صفحة «سجل الدرجات».</td></tr><tr><th>واجهة API رسمية</th><td>لا توجد واجهة معلنة للمدربين. إن وفّرتها المؤسسة يُستبدل الجسر بها دون تغيير بقية القسم.</td></tr><tr><th>الدخول</th><td>لا تُطلب كلمة مرور رايات ولا تُخزَّن، ولا يُتجاوز التحقق. إن انتهت جلستك في رايات يتوقف الجسر.</td></tr><tr><th>الكتابة</th><td>بضغطة صريحة منك بعد عرض الفروقات، وللمختلف فقط، ثم إعادة قراءة. <b>اختُبرت الكتابة على رايات تجريبي فقط</b>، فابدأ بشعبة واحدة وراجع نتيجتها في رايات.</td></tr><tr><th>منع التكرار</th><td>لكل عملية معرف فريد، والدرجة المطابقة في رايات لا تُرسل ثانية.</td></tr></tbody></table></section>
  ${pick.map(gSyncCard).join('')}
  <section class="panel"><h2>تثبيت الجسر</h2><div class="row"><a id="bm" class="bm" href="#" draggable="true" data-act="bm-hint">جسر حاضر</a><span class="sub">اسحب الزر إلى شريط الإشارات في المتصفح.</span><button class="btn s" data-act="bm-copy">نسخ كود الجسر</button></div><div class="gnote warn" style="margin-top:8px">إن كنت ثبّتّ «جسر حاضر» قبل إضافة قسم الدرجات فاحذف الإشارة القديمة وثبّتها من جديد، لأن الإشارة تحتفظ بالكود وقت تثبيتها. علامة القديمة: تظهر «النص ليس حزمة صالحة» عند لصق حزمة الدرجات.</div></section>`;
};
