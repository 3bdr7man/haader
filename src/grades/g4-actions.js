/* ====================================================================
   4) Excel: استيراد ملف «درجات المقررات والشعب» وتصديره
   ==================================================================== */
const gCell = (v) => (v === null || v === undefined ? '' : String(v).trim());
const gFindHeader = (aoa, must) => { for (let i = 0; i < Math.min(aoa.length, 40); i++) { const r = (aoa[i] || []).map(gCell); if (must.every((m) => r.includes(m))) return i; } return -1; };
/* يقرأ المصنف كنموذج مترابط: توزيع الدرجات ← المقررات ← أوراق الشعب، ولا يعتمد على مواضع ثابتة للخلايا */
function gParseBook(X, wb) {
  const out = { secs: {}, errs: [], meta: {} }, sheets = {};
  wb.SheetNames.forEach((n) => { sheets[n] = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }); });
  const first = Object.values(sheets)[0] || [], h0 = gCell((first[0] || [])[0]);
  out.meta.termCode = (h0.match(/\((\d{6})\)/) || [])[1] || '';
  Object.values(sheets).forEach((a) => a.forEach((r) => { const t = gCell((r || [])[0]); if (t.startsWith('المصدر:')) { out.meta.source = t.replace(/^المصدر:\s*/, ''); out.meta.extracted = (t.match(/تاريخ الاستخراج:\s*([^\s]+)/) || [])[1] || ''; } if (t.startsWith('ملاحظة:')) out.meta.note = t.replace(/^ملاحظة:\s*/, ''); }));
  /* توزيع الدرجات */
  const dn = wb.SheetNames.find((n) => gFindHeader(sheets[n], ['الرقم المرجعي', 'رمز المكون', 'الدرجة القصوى']) >= 0);
  if (!dn) { out.errs.push('لم أجد ورقة توزيع الدرجات (أعمدة: الرقم المرجعي، رمز المكون، الدرجة القصوى).'); return out; }
  const da = sheets[dn], dh = gFindHeader(da, ['الرقم المرجعي', 'رمز المكون', 'الدرجة القصوى']), dc = da[dh].map(gCell), col = (name) => dc.indexOf(name);
  for (let i = dh + 1; i < da.length; i++) {
    const r = da[i] || [], crn = gCell(r[col('الرقم المرجعي')]), k = gCell(r[col('رمز المكون')]);
    if (!/^\d{4,6}$/.test(crn) || !k) continue;
    const max = r[col('الدرجة القصوى')], s = out.secs[crn] || (out.secs[crn] = { crn, code: gCell(r[col('رمز المقرر')]), name: gCell(r[col('اسم المقرر')]), term: '', termCode: out.meta.termCode, hours: null, comps: [], rows: [], grades: {}, sheet: '' });
    if (typeof max !== 'number' || !(max > 0)) { out.errs.push(`الشعبة ${crn}: الدرجة القصوى للمكوّن ${k} غير رقمية.`); continue; }
    if (s.comps.some((c) => c.k === k)) { out.errs.push(`الشعبة ${crn}: المكوّن ${k} مكرر في التوزيع.`); continue; }
    s.comps.push({ k, desc: gCell(r[col('وصف المكون')]), part: gCell(r[col('الجزء')]), max, mustPass: gCell(r[col('يجب الاجتياز')]), due: gCell(r[col('آخر موعد للرصد')]), scale: gCell(r[col('نموذج التوزيع في رايات')]) });
  }
  /* بيانات المقررات */
  const cn = wb.SheetNames.find((n) => gFindHeader(sheets[n], ['رمز المقرر', 'رقم الشعبة']) >= 0);
  if (cn) { const ca = sheets[cn], ch = gFindHeader(ca, ['رمز المقرر', 'رقم الشعبة']), cc = ca[ch].map(gCell); for (let i = ch + 1; i < ca.length; i++) { const r = ca[i] || [], crn = gCell(r[cc.indexOf('رقم الشعبة')]), s = out.secs[crn]; if (!s) continue; s.code = gCell(r[cc.indexOf('رمز المقرر')]) || s.code; s.name = gCell(r[cc.indexOf('اسم المقرر')]) || s.name; const h = r[cc.indexOf('الساعات المعتمدة')]; s.hours = typeof h === 'number' ? h : Number(h) || null; s.term = gCell(r[cc.indexOf('الفصل التدريبي')]); } }
  /* أوراق الشعب */
  wb.SheetNames.forEach((n) => {
    const a = sheets[n], hi = gFindHeader(a, ['اسم المتدرب', 'الرقم التدريبي']); if (hi < 0) return;
    let crn = (n.match(/(\d{5,6})\s*$/) || [])[1];
    if (!crn) a.slice(0, hi).forEach((r) => (r || []).forEach((v, j) => { if (gCell(v) === 'الرقم المرجعي للشعبة') crn = gCell(r.slice(j + 1).find((x) => x !== null)); }));
    const s = out.secs[crn]; if (!s) { out.errs.push(`الورقة «${n}»: لا يوجد لها توزيع درجات.`); return; }
    const hc = a[hi].map(gCell), ci = (name) => hc.indexOf(name); s.sheet = n;
    const compCols = s.comps.map((c) => [c.k, ci(c.k)]).filter((x) => x[1] >= 0), fixed = new Set(['م', 'اسم المتدرب', 'الرقم التدريبي', 'حالة القيد في رايات', 'قابل للرصد', 'النظري', 'العملي', 'المجموع', 'النسبة', 'حالة الإدخال', 'ساعات الحضور (رايات)', 'آخر حضور (رايات)', '']);
    hc.forEach((h) => { if (!fixed.has(h) && !s.comps.some((c) => c.k === h) && /^[A-Za-z]{2,6}\d{0,2}$/.test(h)) out.errs.push(`الورقة «${n}»: العمود ${h} ليس مكوّناً معتمداً في توزيع الشعبة ${crn}، فلم يُقرأ.`); });
    s.comps.forEach((c) => { if (ci(c.k) < 0) out.errs.push(`الورقة «${n}»: لا يوجد عمود للمكوّن ${c.k}.`); });
    for (let i = hi + 1; i < a.length; i++) {
      const r = a[i] || [], id = gCell(r[ci('الرقم التدريبي')]).replace(/\.0$/, ''), name = gCell(r[ci('اسم المتدرب')]);
      if (!id && !name) { if (s.rows.length) break; continue; }
      if (!/^\d{6,12}$/.test(id)) { if (s.rows.length && !name) break; out.errs.push(`الورقة «${n}» الصف ${i + 1}: رقم تدريبي غير صحيح «${id}».`); continue; }
      if (s.rows.some((x) => x.id === id)) { out.errs.push(`الشعبة ${crn}: الرقم التدريبي ${id} مكرر في الملف.`); continue; }
      const el = gCell(r[ci('قابل للرصد')]), hrs = r[ci('ساعات الحضور (رايات)')];
      s.rows.push({ id, name, st: gCell(r[ci('حالة القيد في رايات')]), el: el === 'نعم', hrs: typeof hrs === 'number' ? hrs : null, last: gCell(r[ci('آخر حضور (رايات)')]) });
      compCols.forEach(([k, j]) => { const v = r[j]; if (v !== null && v !== undefined && gCell(v) !== '') (s.grades[id] = s.grades[id] || {})[k] = v; });
    }
  });
  Object.values(out.secs).forEach((s) => { if (!s.rows.length) out.errs.push(`الشعبة ${s.crn}: لا توجد لها ورقة متدربين في الملف.`); });
  return out;
}
const gSecDoc = (p, old, src) => ({ crn: p.crn, code: p.code, name: p.name, term: p.term, termCode: p.termCode, hours: p.hours, comps: p.comps, rows: p.rows, src, exam: (old && old.exam) || { date: '', time: '', place: '', note: '' }, flow: (old && old.flow) || {} });
/* استيراد التوزيع والشعب (مسؤول المنصة): تُعرض الاختلافات أولاً، ولا تُمس الدرجات المحفوظة */
async function gDistImport(file) {
  if (!isAdmin()) { toast('استيراد ملف توزيع الدرجات لمسؤول المنصة.'); return; }
  let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
  const p = gParseBook(X, X.read(await file.arrayBuffer(), { type: 'array' })), crns = Object.keys(p.secs).filter((c) => p.secs[c].rows.length && p.secs[c].comps.length);
  if (!crns.length) { modal(`<h2>تعذر الاستيراد</h2><div class="gnote bad">${p.errs.map(esc).join('<br>') || 'الملف لا يطابق هيكل «درجات المقررات والشعب».'}</div><button class="btn" data-act="modal-close">إغلاق</button>`); return; }
  const plan = { file: file.name, p, items: crns.map((crn) => { const old = A.raw.gsec[crn] || null, neu = p.secs[crn], ch = G.diffSection(old, neu); /* من له درجات لا يُحذف من القائمة */
    const keep = old ? old.rows.filter((r) => !neu.rows.some((x) => x.id === r.id) && Object.values((gMarks(crn).g || {})[r.id] || {}).some((v) => v !== null && v !== undefined)) : [];
    return { crn, old, neu, ch, keep, hit: old ? G.impact(old, gMarks(crn), ch) : [], busy: old && old.flow && old.flow.op && old.flow.op.st === 'prepared', ng: Object.values(neu.grades).reduce((a, g) => a + Object.keys(g).length, 0) }; }) };
  A.gPlan = plan;
  const tot = plan.items.reduce((a, x) => a + x.ch.length, 0), hits = plan.items.reduce((a, x) => a + x.hit.length, 0), ng = plan.items.reduce((a, x) => a + x.ng, 0);
  modal(`<h2>مراجعة استيراد توزيع الدرجات</h2><div><b>${esc(file.name)}</b> — ${plan.items.length} شعبة • ${plan.items.reduce((a, x) => a + x.neu.rows.length, 0)} متدرباً • ${plan.items.reduce((a, x) => a + x.neu.comps.length, 0)} صف توزيع</div>${p.meta.source ? `<div class="sub">المصدر: ${esc(p.meta.source)}</div>` : ''}
  ${p.errs.length ? `<div class="gnote warn"><b>ملاحظات القراءة:</b><ul>${p.errs.slice(0, 12).map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}
  <div class="tw" style="max-height:44vh;overflow:auto"><table><thead><tr><th class="n">الشعبة</th><th>المقرر</th><th>التوزيع في الملف</th><th>الاختلافات عن المحفوظ</th></tr></thead><tbody>${plan.items.map((x) => `<tr><td class="n"><b>${x.crn}</b></td><td>${esc(x.neu.code)}<br><small class="sub">${esc(x.neu.name)}</small></td><td style="font-size:12.5px">${esc(gDistText(x.neu))}<br>${x.neu.rows.length} متدرباً، ${x.neu.rows.filter((r) => r.el).length} قابلاً للرصد</td><td style="font-size:12.5px">${x.busy ? '<span class="chip bad">عملية رفع جارية: لن تُحدَّث</span>' : !x.old ? '<span class="chip info">شعبة جديدة</span>' : x.ch.length ? `<ul class="gul">${x.ch.slice(0, 14).map((c) => `<li>${esc(c.text)}</li>`).join('')}${x.ch.length > 14 ? `<li>و${x.ch.length - 14} تغييراً آخر</li>` : ''}</ul>` : '<span class="chip ok">لا اختلاف</span>'}${x.hit.length ? `<div class="gnote bad"><b>درجات محفوظة تتأثر:</b><ul>${x.hit.slice(0, 8).map((h) => `<li>${esc(h)}</li>`).join('')}</ul></div>` : ''}${x.keep.length ? `<div class="sub">يبقى في القائمة غير قابل للرصد لأن له درجات محفوظة: ${x.keep.map((r) => esc(r.name)).join('، ')}</div>` : ''}</td></tr>`).join('')}</tbody></table></div>
  ${ng ? `<div class="gnote info">في الملف ${ng} درجة مدخلة. هذه النافذة لا تستورد الدرجات: يستوردها مدرب كل شعبة من «إدخال درجات المتدربين».</div>` : ''}
  ${hits ? `<label class="ck gnote warn"><input type="checkbox" id="gdOk"> اطلعت على الدرجات المتأثرة (${hits}) وأوافق على تحديث التوزيع والقوائم. الدرجات المحفوظة لا تُحذف، والشعب المعتمدة تُلغى جاهزيتها وتحتاج اعتماداً جديداً.</label>` : tot ? '<div class="sub">الشعب المعتمدة التي تغيّر توزيعها أو قائمتها تُلغى جاهزيتها وتحتاج اعتماداً جديداً.</div>' : ''}
  <div class="row"><button class="btn p" data-act="g-dist-ok">اعتماد الاستيراد</button><button class="btn" data-act="modal-close">إلغاء</button></div>`);
}
function gDistApply() {
  const plan = A.gPlan; if (!plan || !isAdmin()) return;
  const hits = plan.items.reduce((a, x) => a + x.hit.length, 0);
  if (hits && !($('#gdOk') && $('#gdOk').checked)) { toast('وافق على تحديث الشعب التي لها درجات متأثرة أولاً.'); return; }
  const iso = new Date().toISOString(), id = gId('I'), w = gWho(), logs = [], done = [];
  plan.items.forEach((x) => {
    if (x.busy) return;
    const src = { file: plan.file, at: iso, by: w.id, byName: w.name, importId: id, source: plan.p.meta.source || '', extracted: plan.p.meta.extracted || '', note: plan.p.meta.note || '' };
    const neu = clone(x.neu); delete neu.grades; delete neu.sheet;
    x.keep.forEach((r) => neu.rows.push(Object.assign({}, r, { el: false, st: 'غير موجود في آخر ملف مستورد' })));
    if (!x.old) gPutDoc('gsec', x.crn, gSecDoc(neu, null, src));
    else if (x.ch.length) gPatch(x.crn, { code: neu.code, name: neu.name, term: neu.term, termCode: neu.termCode, hours: neu.hours, comps: neu.comps, rows: neu.rows, src });
    else gPatch(x.crn, { src });
    done.push(x.crn);
    logs.push(['dist', x.crn, '', '', '', '', !x.old ? `شعبة جديدة من ${plan.file}: ${neu.rows.length} متدرباً، ${gDistText(neu)}` : x.ch.length ? `${plan.file}: ${x.ch.slice(0, 6).map((c) => c.text).join('؛ ')}${x.ch.length > 6 ? `؛ و${x.ch.length - 6} أخرى` : ''}` : `${plan.file}: لا اختلاف`]);
  });
  const rec = { id, at: iso, by: w.id, byName: w.name, file: plan.file, sections: done, rows: plan.items.reduce((a, x) => a + x.neu.rows.length, 0), comps: plan.items.reduce((a, x) => a + x.neu.comps.length, 0), source: plan.p.meta.source || '', extracted: plan.p.meta.extracted || '', summary: `${plan.items.filter((x) => !x.old).length} جديدة • ${plan.items.filter((x) => x.old && x.ch.length).length} تغيّرت • ${plan.items.filter((x) => x.old && !x.ch.length).length} بلا اختلاف` };
  A.raw.gcfg.main = merge(clone(A.raw.gcfg.main || {}), { imports: { [id]: rec } }); enqueue('gcfg/main', { imports: { [id]: rec } });
  gLog(logs); A.gPlan = null; closeModal(); rebuild(); render(true); toast(`اعتُمد استيراد ${done.length} شعبة.`);
}
/* استيراد الدرجات (مدرب الشعبة): كل خلية تمر بمحرك التحقق، والمحفوظ لا يُستبدل إلا بموافقة صريحة */
async function gGradesImport(file, only) {
  let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
  const wb = X.read(await file.arrayBuffer(), { type: 'array' }), plan = { file: file.name, items: [], skip: [] };
  wb.SheetNames.forEach((n) => {
    const a = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }), hi = gFindHeader(a, ['الرقم التدريبي']); if (hi < 0) return;
    let crn = (n.match(/(\d{5,6})\s*$/) || [])[1]; if (!crn && only && wb.SheetNames.filter((x) => gFindHeader(X.utils.sheet_to_json(wb.Sheets[x], { header: 1, raw: true, defval: null }), ['الرقم التدريبي']) >= 0).length === 1) crn = only;
    const sec = crn && A.raw.gsec[crn]; if (!sec || (only && crn !== only)) return;
    const gate = gGate(crn); if (gate) { plan.skip.push(`${crn}: ${gate}`); return; }
    const hc = a[hi].map(gCell), idc = hc.indexOf('الرقم التدريبي'), it = { crn, add: [], chg: [], same: 0, bad: [] }, marks = gMarks(crn), seen = {};
    hc.forEach((h) => { if (/^[A-Za-z]{2,6}\d{1,2}$/.test(h) && !G.compBy(sec, h)) it.bad.push({ msg: `العمود ${h} ليس مكوّناً معتمداً في توزيع الشعبة ${crn}، فلم يُستورد.` }); });
    const cols = G.comps(sec).map((c) => [c.k, hc.indexOf(c.k)]).filter((x) => x[1] >= 0);
    for (let i = hi + 1; i < a.length; i++) {
      const r = a[i] || [], id = gCell(r[idc]).replace(/\.0$/, ''); if (!/^\d{6,12}$/.test(id)) continue;
      const vals = cols.map(([k, j]) => [k, r[j]]).filter(([, v]) => v !== null && v !== undefined && gCell(v) !== ''); if (!vals.length) continue;
      const row = sec.rows.find((x) => x.id === id);
      if (seen[id]) { it.bad.push({ msg: `الرقم التدريبي ${id} مكرر في الملف (الصف ${i + 1}).` }); continue; } seen[id] = 1;
      if (!row) { it.bad.push({ msg: `الرقم التدريبي ${id} غير موجود في الشعبة ${crn}.` }); continue; }
      if (!row.el) { it.bad.push({ msg: `${row.name}: غير قابل للرصد (${row.st || ''})، فلم تُستورد درجاته.` }); continue; }
      vals.forEach(([k, v]) => { const c = G.check(sec, k, v), old = G.val(marks, id, k); if (!c.ok) it.bad.push({ msg: `${row.name}: ${c.msg}` }); else if (old === null) it.add.push({ id, k, raw: c.v, name: row.name }); else if (old === c.v) it.same++; else it.chg.push({ id, k, raw: c.v, old, name: row.name }); });
    }
    plan.items.push(it);
  });
  if (!plan.items.length) { modal(`<h2>لا شيء للاستيراد</h2><div class="gnote ${plan.skip.length ? 'warn' : 'bad'}">${plan.skip.length ? plan.skip.map(esc).join('<br>') : 'لم أجد في الملف ورقة لشعبة مسندة إليك فيها عمود «الرقم التدريبي» وأعمدة المكوّنات.'}</div><button class="btn" data-act="modal-close">إغلاق</button>`); return; }
  A.gPlan = plan;
  const sum = (k) => plan.items.reduce((a, x) => a + (typeof x[k] === 'number' ? x[k] : x[k].length), 0);
  modal(`<h2>مراجعة استيراد الدرجات</h2><div><b>${esc(file.name)}</b> — ${plan.items.map((x) => x.crn).join('، ')}</div><div class="grev"><span>درجات جديدة <b>${sum('add')}</b></span><span>تخالف المحفوظ <b class="${sum('chg') ? 'gred' : ''}">${sum('chg')}</b></span><span>مطابقة للمحفوظ <b>${sum('same')}</b></span><span>مرفوضة <b class="${sum('bad') ? 'gred' : ''}">${sum('bad')}</b></span></div>
  ${sum('bad') ? `<div class="gnote bad"><b>لن تُستورد:</b><ul>${plan.items.flatMap((x) => x.bad).slice(0, 25).map((b) => `<li>${esc(b.msg)}</li>`).join('')}${sum('bad') > 25 ? `<li>و${sum('bad') - 25} أخرى</li>` : ''}</ul></div>` : ''}
  ${sum('chg') ? `<div class="gnote warn"><b>درجات محفوظة يخالفها الملف:</b><div class="tw" style="max-height:28vh;overflow:auto"><table><thead><tr><th class="n">الشعبة</th><th>المتدرب</th><th class="n">المكوّن</th><th class="n">المحفوظة</th><th class="n">في الملف</th></tr></thead><tbody>${plan.items.flatMap((x) => x.chg.map((c) => `<tr><td class="n">${x.crn}</td><td>${esc(c.name)}</td><td class="n">${esc(c.k)}</td><td class="n">${G.fmt(c.old)}</td><td class="n"><b>${G.fmt(c.raw)}</b></td></tr>`)).join('')}</tbody></table></div><label class="ck"><input type="checkbox" id="giOver"> استبدل الدرجات المحفوظة بما في الملف (${sum('chg')})</label><span class="sub">دون هذه الموافقة تبقى الدرجات المحفوظة كما هي.</span></div>` : ''}
  ${plan.skip.length ? `<div class="gnote warn">${plan.skip.map(esc).join('<br>')}</div>` : ''}
  <div class="row"><button class="btn p" data-act="g-xin-ok" ${sum('add') + sum('chg') ? '' : 'disabled'}>اعتماد الاستيراد</button><button class="btn" data-act="modal-close">إلغاء</button></div>`);
}
function gGradesApply() {
  const plan = A.gPlan; if (!plan) return;
  const over = !!($('#giOver') && $('#giOver').checked); let n = 0, bad = 0;
  plan.items.forEach((it) => { const r = gSetGrades(it.crn, it.add.concat(over ? it.chg : []).map((x) => ({ id: x.id, k: x.k, raw: x.raw })), `استيراد ${plan.file}`); n += r.n || 0; bad += r.bad.length; if (r.n) gLog([['import', it.crn, '', '', '', r.n, `${plan.file}${over && it.chg.length ? ` • استُبدلت ${it.chg.length} درجة محفوظة بموافقة المدرب` : ''}`]]); });
  A.gPlan = null; closeModal(); rebuild(); render(true); toast(`استُوردت ${n} درجة${bad ? `، ورُفضت ${bad}` : ''}.`);
}
const gSheetName = (s) => `${String(s.code).replace(/\s+/g, '')}_${s.crn}`.slice(0, 31);
function gSecAoa(sec, withGrades) {
  const cs = G.comps(sec), parts = G.parts(sec), s = G.stats(sec, gMarks(sec.crn)), head = ['م', 'اسم المتدرب', 'الرقم التدريبي', 'حالة القيد في رايات', 'قابل للرصد'];
  Object.keys(parts).forEach((p) => { parts[p].forEach((c) => head.push(c.k)); head.push(p); });
  head.push('المجموع', 'حالة الإدخال', 'ساعات الحضور (رايات)', 'آخر حضور (رايات)');
  const lim = ['', 'الحد الأعلى لكل مكوّن', '', '', '']; Object.keys(parts).forEach((p) => { parts[p].forEach((c) => lim.push(c.max)); lim.push(parts[p].reduce((a, c) => a + c.max, 0)); }); lim.push(G.total(sec), '', '', '');
  const rows = sec.rows.map((r, i) => { const rs = s.rs[r.id], o = [i + 1, r.name, r.id, r.st || '', r.el ? 'نعم' : 'لا']; Object.keys(parts).forEach((p) => { parts[p].forEach((c) => o.push(withGrades && r.el && G.isNum(rs.g[c.k]) ? rs.g[c.k] : null)); o.push(withGrades && r.el && rs.part[p] != null ? rs.part[p] : null); }); o.push(withGrades && r.el ? rs.total : null, G.ROW_ST[rs.st], r.hrs == null ? null : r.hrs, r.last || ''); return o; });
  return [[`كشف رصد الدرجات — ${sec.code} ${sec.name} — الشعبة ${sec.crn}`], ['الرقم المرجعي للشعبة', sec.crn, '', 'الفصل التدريبي', sec.term || '', '', 'توزيع الدرجات', gDistText(sec)], lim, head].concat(rows);
}
async function gExport(crns, name) {
  toast('جارٍ تجهيز الملف…');
  let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
  const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
  const add = (aoa, n) => { const ws = X.utils.aoa_to_sheet(aoa); ws['!views'] = [{ RTL: true }]; X.utils.book_append_sheet(wb, ws, n.slice(0, 31)); };
  const secs = crns.map((c) => A.raw.gsec[c]).filter(Boolean), tc = (secs[0] || {}).termCode || '';
  add([[`${ORG} — ${COLLEGE} — ${(secs[0] || {}).term || ''} (${tc})`], ['بيانات المقررات والشعب'], [], ['م', 'رمز المقرر', 'اسم المقرر', 'رقم الشعبة', 'عدد المتدربين', 'درجة النظري', 'درجة العملي', 'الدرجة الكلية', 'القابلون للرصد', 'الساعات المعتمدة', 'الفصل التدريبي', 'حالة الرصد']].concat(secs.map((s, i) => { const p = G.parts(s), t = gSt(s), sm = (k) => (p[k] || []).reduce((a, c) => a + c.max, 0); return [i + 1, s.code, s.name, s.crn, t.stats.n, sm('نظري'), sm('عملي'), G.total(s), t.stats.elig, s.hours, s.term, t.label]; })), 'بيانات المقررات');
  add([[`${ORG} — ${COLLEGE} (${tc})`], ['توزيع الدرجات المعتمد لكل مقرر وشعبة'], [], ['م', 'الرقم المرجعي', 'رمز المقرر', 'اسم المقرر', 'رمز المكون', 'وصف المكون', 'الجزء', 'الدرجة القصوى', 'يجب الاجتياز', 'آخر موعد للرصد', 'نموذج التوزيع في رايات']].concat(secs.flatMap((s) => G.comps(s).map((c) => [s.crn, s.code, s.name, c.k, c.desc || '', c.part || '', c.max, c.mustPass || '', c.due || '', c.scale || ''])).map((r, i) => [i + 1].concat(r))), 'توزيع الدرجات');
  secs.forEach((s) => add(gSecAoa(s, gSee(s.crn)), gSheetName(s)));
  await save(name, new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
async function gLogExport() {
  let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
  if (!GX.archLoaded) await gLoadArchive();
  const rows = gLogRows().filter(gLogVisible), wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
  const ws = X.utils.aoa_to_sheet([['الوقت', 'المستخدم', 'الإجراء', 'الشعبة', 'الرقم التدريبي', 'اسم المتدرب', 'المكوّن', 'الدرجة القديمة', 'الدرجة الجديدة', 'التفاصيل']].concat(rows.map((r) => [gDT(r.at), r.byName, GACT[r.act] || r.act, r.crn, r.id, r.id ? gNameOf(r.crn, r.id) : '', r.comp, r.old, r.neu, r.det])));
  ws['!views'] = [{ RTL: true }]; X.utils.book_append_sheet(wb, ws, 'سجل التدقيق');
  const ops = Object.values(A.raw.gops).filter((o) => o && gList(o.crn)).sort((a, b) => (a.at < b.at ? 1 : -1));
  const w2 = X.utils.aoa_to_sheet([['رقم العملية', 'الشعبة', 'النوع', 'وقت التنفيذ', 'المنفذ', 'الحالة', 'رُفعت', 'فشلت', 'مطابق', 'الإجمالي', 'النسخة المجمدة', 'البصمة']].concat(ops.map((o) => [o.id, o.crn, o.kind, gDT(o.at), o.byName, RES_ST[o.st] || o.st, o.res && o.res.applied ? o.res.applied.done : '', o.res && o.res.applied ? o.res.applied.failed.length : '', o.res ? o.res.okN : '', o.res ? o.res.total : '', o.snap, o.sig])));
  w2['!views'] = [{ RTL: true }]; X.utils.book_append_sheet(wb, w2, 'عمليات الرفع');
  await save('سجل عمليات الرصد والمزامنة.xlsx', new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
}
/* تحديث قائمة المتدربين وقابليتهم للرصد مما قرأه الجسر من رايات */
function gRosterApply(crn) {
  const sec = A.raw.gsec[crn], last = gOpsOf(crn).find((o) => o.res), gate = gGate(crn);
  if (gate) { toast(gate); return; }
  const d = gRosterDiff(sec, last); if (!d.length) return;
  const rows = clone(sec.rows);
  d.forEach((x) => { const r = rows.find((y) => y.id === x.id); if (x.t === 'add') rows.push({ id: x.id, name: x.name, st: x.st || '', el: x.el, hrs: null, last: '' }); else if (x.t === 'el' && r) { r.el = x.el; r.st = x.st || r.st; } else if (x.t === 'gone' && r) { r.el = false; r.st = 'غير موجود في رايات'; } });
  gPatch(crn, { rows });
  gLog([['roster', crn, '', '', '', '', `من قراءة رايات في العملية ${last.id}: ${d.slice(0, 8).map((x) => x.text).join('؛ ')}`]]);
  rebuild(); render(true); toast('حُدّثت قائمة المتدربين من رايات.');
}

/* ====================================================================
   5) الأفعال
   ==================================================================== */
const gCrnOf = (e) => e.dataset.crn;
Object.assign(ACT, {
  'g-open': (e) => { A.gCrn = e.dataset.crn; closeModal(); go('gsec'); },
  'g-pick': (e) => { A.gCrn = e.dataset.crn; render(true); },
  'g-course': (e) => { GX.f.course = e.dataset.v; render(true); },
  'g-tab': (e) => { GX.tab[e.dataset.g] = e.dataset.v; render(true); },
  'g-enter': (e) => { A.gCrn = e.dataset.crn; go('gentry'); },
  'g-go-sync': (e) => { A.gCrn = e.dataset.crn; closeModal(); go('gsync'); },
  'g-go-review': (e) => { A.gCrn = e.dataset.crn; closeModal(); go('greview'); },
  'g-exam': (e) => gExamForm(e.dataset.crn),
  'g-preview': (e) => gPreview(e.dataset.crn, false),
  'g-approve-ask': (e) => { const g = gGate(e.dataset.crn); if (g) { toast(g); return; } gPreview(e.dataset.crn, true); },
  'g-approve': async (e) => { if (await gApprove(e.dataset.crn)) { closeModal(); render(true); toast('اعتُمدت الدرجات وجُمّدت. الشعبة جاهزة للرفع.'); } },
  'g-unlock-ask': (e) => { const crn = e.dataset.crn, st = gSt(A.raw.gsec[crn]), after = st.k === 'closed' || st.k === 'synced'; gReasonForm(after ? 'فتح إجراء تصحيح' : 'فك تجميد الدرجات', after ? 'رُفعت درجات هذه الشعبة. التصحيح يفك التجميد ويُوثَّق، ثم يلزم اعتماد جديد ورفع ومطابقة جديدان.' : 'يُفك التجميد وتُلغى الجاهزية والجدولة. بعد التعديل يلزم اعتماد جديد.', 'gUnlockDo', crn, after ? 'فتح إجراء التصحيح' : 'فك التجميد', true); },
  'g-clear': (e) => { const r = gSetGrades(e.dataset.crn, [{ id: e.dataset.id, k: e.dataset.k, raw: '' }], 'مسح'); if (r.bad.length) toast(r.bad[0].msg); rebuild(); render(true); },
  'g-sched-ask': (e) => gSchedForm(e.dataset.crn),
  'g-sched-x': (e) => { gSchedSet(e.dataset.crn, 'cancelled'); render(true); toast('أُلغيت الجدولة. الدرجات باقية معتمدة ومجمدة.'); },
  'g-sched-p': (e) => { gSchedSet(e.dataset.crn, 'paused'); render(true); toast('أُوقفت الجدولة مؤقتاً.'); },
  'g-sched-r': (e) => { gSchedSet(e.dataset.crn, 'on'); render(true); toast('استؤنفت الجدولة.'); },
  'g-ics': (e) => gIcs(e.dataset.crn),
  'g-up': (e) => gUpAsk(e.dataset.crn),
  'g-up-go': (e) => gUpGo(e.dataset.crn),
  'g-read': (e) => gUpGo(e.dataset.crn, 'read'),
  'g-pkg': (e) => { const op = gCurOp(A.raw.gsec[e.dataset.crn]); if (op) copyText(gPkgText(op), `نُسخت حزمة العملية ${op.id}.`); },
  'g-unk': (e) => { gOpUnknown(e.dataset.crn); render(true); toast('سُجّل أن النتيجة غير معروفة. تحقق من حالة رايات قبل أي إعادة إرسال.'); },
  'g-opx': (e) => { gOpCancel(e.dataset.crn); render(true); toast('أُلغيت العملية. يلزم التحقق من رايات قبل عملية جديدة.'); },
  'g-doc-ask': (e) => gReasonForm('توثيق حالات المطابقة', 'اكتب ما تحققت منه يدوياً في رايات لكل حالة تعذر التحقق منها آلياً. بعد التوثيق تُعد المزامنة مكتملة.', 'gDocEx', e.dataset.crn, 'حفظ التوثيق', true),
  'g-close-ask': (e) => { const crn = e.dataset.crn, sec = A.raw.gsec[crn]; modal(`<h2>إغلاق عملية الرصد — ${crn}</h2><div>تحققت مطابقة درجات ${esc(sec.name)} مع رايات. بعد الإغلاق لا تُعدَّل الدرجات إلا بإجراء تصحيح موثق.</div><div class="row"><button class="btn p" data-act="g-close" data-crn="${crn}">تأكيد الإغلاق</button><button class="btn" data-act="modal-close">رجوع</button></div>`); },
  'g-close': (e) => { gClose(e.dataset.crn); closeModal(); render(true); },
  'g-roster': (e) => gRosterApply(e.dataset.crn),
  'g-snap': (e) => { const x = A.raw.gsnap[e.dataset.id]; if (!x || !gSee(x.crn)) return; modal(`<h2>النسخة <span dir="ltr">${esc(x.id)}</span></h2><div class="sub">${esc(x.name || '')} (${esc(x.crn)}) • ${gDT(x.at)} • ${esc(x.byName || '')} • البصمة <span dir="ltr">${esc(x.sig)}</span>${x.sha ? ` • SHA-256 <span dir="ltr">${esc(x.sha.slice(0, 24))}…</span>` : ''} • ${gSnapOk(x) ? 'سليمة' : 'لا تطابق بصمتها'}</div>${gGradeTable(x.comps, x.rows)}<div class="row"><button class="btn" data-act="modal-close">إغلاق</button></div>`); },
  'g-op': (e) => gOpModal(e.dataset.id),
  'g-arch': async () => { const n = await gLoadArchive(); render(true); toast(n ? `حُمّل ${n} قيداً أقدم.` : 'لا قيود أقدم.'); },
  'g-log-x': gLogExport,
  'g-xout': (e) => gExport([e.dataset.crn], `كشف درجات ${e.dataset.crn}.xlsx`),
  'g-xall': () => gExport(gSecs().map((s) => s.crn), 'درجات المقررات والشعب - منصة حاضر.xlsx'),
  'g-print': (e) => gPrintSheet(e.dataset.crn),
  'g-rep-ready': gPrintReady,
  'g-rep-recon': (e) => gPrintRecon(e.dataset.id),
  'g-max': (e) => gMaxForm(e.dataset.crn, e.dataset.k),
  'g-dist-ok': gDistApply,
  'g-xin-ok': gGradesApply,
});
Object.assign(CHG, {
  'g-cell': gCellChange,
  'g-f': (e) => { GX.f[e.dataset.k] = e.value; e.blur(); render(true); },
  'g-logf': (e) => { GX.logF = Object.assign({}, GX.logF, { [e.dataset.k]: e.value }); e.blur(); render(true); },
  'g-res': async (e) => { const t = e.value; if (!t.trim()) return; e.value = ''; e.blur(); const op = await gTakeResult(t); if (op) { rebuild(); render(true); toast(`العملية ${op.id}: ${RES_ST[op.st] || op.st}.`); } },
  'g-xin': (e) => { const f = e.files[0], crn = e.dataset.crn; e.value = ''; if (f) gGradesImport(f, crn).catch(() => toast('تعذرت قراءة الملف. تأكد أنه ملف Excel صحيح.')); },
  'g-dist-in': (e) => { const f = e.files[0]; e.value = ''; if (f) gDistImport(f).catch(() => toast('تعذرت قراءة الملف. تأكد أنه ملف Excel صحيح.')); },
  'g-set': (e) => { if (!isAdmin()) return; const k = e.dataset.k, v = e.type === 'checkbox' ? e.checked : k === 'remindMin' ? Math.min(1440, Math.max(5, parseInt(e.value, 10) || 60)) : e.value, old = gSet()[k]; A.raw.gcfg.main = merge(clone(A.raw.gcfg.main || {}), { set: { [k]: v } }); enqueue('gcfg/main', { set: { [k]: v } }); gLog([['set', '', '', '', String(old), String(v), { remindMin: 'مهلة التنبيه' }[k] || k]]); render(true); },
});
document.addEventListener('paste', (ev) => { if (ev.target && ev.target.id === 'gRes') { const t = (ev.clipboardData || {}).getData ? ev.clipboardData.getData('text') : ''; if (t) { ev.preventDefault(); ev.target.blur(); CHG['g-res']({ value: t, blur() {} }); } } });
/* ما يُسمح به لحساب الاطلاع: التنقل والعرض فقط */
['g-open', 'g-pick', 'g-course', 'g-tab', 'g-go-sync', 'g-go-review', 'g-rep-ready'].forEach((a) => VIEW_ACTS.add(a));
['g-f', 'g-logf'].forEach((a) => VIEW_CHG.add(a));
/* الأفعال التي تمس شعبة بعينها تمر بفحص إسناد الشعبة قبل تنفيذها */
['g-exam', 'g-approve-ask', 'g-approve', 'g-clear', 'g-sched-ask', 'g-sched-x', 'g-sched-p', 'g-sched-r', 'g-ics', 'g-up', 'g-up-go', 'g-read', 'g-pkg', 'g-unk', 'g-opx', 'g-doc-ask', 'g-close-ask', 'g-close', 'g-roster'].forEach((a) => {
  const f = ACT[a];
  ACT[a] = (e) => { const crn = e.dataset.crn; if (!gMay(crn)) { closeModal(); toast(gNotMine(crn)); if (a === 'g-up' || a === 'g-up-go' || a === 'g-read') gLog([['blocked', crn, '', '', '', '', 'محاولة رفع شعبة غير مسندة إلى المستخدم']]); return undefined; } return f(e); };
});
