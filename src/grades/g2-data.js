/* ====================================================================
   2) البيانات والعمليات: مجموعات مستقلة لا تمس بيانات التحضير ولا الإرشاد
      gcfg الإعدادات وسجل الاستيراد • gsec الشعب وتوزيعها وحالتها • gmarks الدرجات
      gsnap النسخ المجمدة • gops عمليات الرفع • glog سجل التدقيق (وثيقة لكل مستخدم، لا يكتب فيها غيره)
   ==================================================================== */
['gcfg', 'gsec', 'gmarks', 'gsnap', 'gops', 'glog', 'glogs'].forEach((c) => { A.raw[c] = {}; });
const GVIEW = new Set(['gdash', 'gsecs', 'gsec', 'gexams', 'gentry', 'greview', 'gsched', 'gsync', 'glog', 'greports', 'gcfg']);
const GX = { arch: [], uid: null, seq: 0, tab: {}, f: { q: '', sort: 'name', show: 'all', course: '' }, focus: null };
const RAYAT_GRADES = 'https://rytfac-oc.tvtc.gov.sa/FacultySelfService/ssb/gradeEntry#/gradebook';
const gWatch = (c) => watch(c, (s) => { const o = {}; s.docs.forEach((d) => { o[d.id] = overlay(c + '/' + d.id, d.data()); }); Q.forEach((w) => { if (w.op === 'set' && w.path.startsWith(c + '/') && w.path.split('/').length === 2) o[w.path.slice(c.length + 1)] = clone(w.patch); }); A.raw[c] = o; });
{ const o = boot; boot = async function () {
  await o(); if (!db) return;
  try { const u = window.claude && window.claude.use ? await window.claude.use('user') : null; GX.uid = u ? await u.id() : null; } catch (e) { GX.uid = null; }
  ['gcfg', 'gsec', 'gmarks', 'gsnap', 'gops', 'glog', 'glogs'].forEach(gWatch);
  setInterval(gTick, 30000);
}; }

/* ---------- الإعدادات والصلاحيات ---------- */
const gSet = () => Object.assign({ remindMin: 60 }, (A.raw.gcfg.main && A.raw.gcfg.main.set) || {});
const gNow = () => Date.now();
const gWho = () => ({ id: A.me ? A.me.id : '', name: A.me ? A.me.name : '' });
const gOwner = (crn) => { const o = secOwner(crn); if (o) return o; const s = A.raw.gsec[crn]; return s && s.trainer && A.raw.accounts[s.trainer] ? s.trainer : ''; };
const gOwnerName = (crn) => { const o = gOwner(crn); return o ? A.raw.accounts[o].name : 'غير مسندة'; };
/* العمل في الشعبة (إدخال، اعتماد، جدولة، رفع) لمدربها فقط؛ الشعبة غير المسندة يتولاها المسؤول */
const gMay = (crn) => { if (!A.me || isViewer() || !A.raw.gsec[crn]) return false; const o = gOwner(crn); return o ? o === A.me.id : isAdmin(); };
/* الاطلاع على الدرجات: المدرب لشعبه، ورئيس القسم ومسؤول المنصة للكل. حساب الاطلاع يرى الحالة دون الدرجات */
const gSee = (crn) => !!A.me && (isAdmin() || isHead() || gOwner(crn) === A.me.id);
const gList = (crn) => !!A.me && (isAdmin() || isHead() || isViewer() || gOwner(crn) === A.me.id);
/* الاعتماد وفك التجميد من صلاحيات مدرب المقرر وحده. رئيس القسم ومسؤول المنصة للاطلاع والمتابعة. */
const gCanUnlock = (crn) => gMay(crn);
const gNotMine = (crn) => `لا يمكن تنفيذ هذا الإجراء: الشعبة ${crn} مسندة إلى ${gOwnerName(crn)}، وهي لك للاطلاع فقط.`;
const gMarks = (crn) => A.raw.gmarks[crn] || { g: {} };
const gSecs = () => Object.values(A.raw.gsec).filter((s) => s && s.crn && gList(s.crn)).sort((a, b) => String(a.code).localeCompare(String(b.code), 'ar') || String(a.crn).localeCompare(String(b.crn)));
const gSt = (sec) => G.status(sec, gMarks(sec.crn), gNow(), gSet());
const gReady = () => !!(A.got.gsec && A.got.gmarks);
const gCourses = () => { const o = {}; gSecs().forEach((s) => { (o[s.code] = o[s.code] || { code: s.code, name: s.name, secs: [] }).secs.push(s); }); return Object.values(o); };

/* ---------- التاريخ ---------- */
const gDT = (iso) => { if (!iso) return '—'; const d = new Date(iso); if (isNaN(+d)) return '—'; return d.toLocaleDateString('en-CA') + ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); };
const gDay = (iso) => { const d = new Date(iso); if (isNaN(+d)) return ''; return ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'][d.getDay()]; };
const gClock = (iso) => { const d = new Date(iso); if (isNaN(+d)) return ''; const h = d.getHours(), m = String(d.getMinutes()).padStart(2, '0'); return `${h % 12 || 12}:${m} ${h < 12 ? 'صباحاً' : h === 12 ? 'ظهراً' : 'مساءً'}`; };
const gWhen = (iso) => (iso ? `${gDay(iso)} ${new Date(iso).toLocaleDateString('en-CA')} الساعة ${gClock(iso)}` : 'يحدده المدرب');
const gLocalInput = (iso) => { const d = iso ? new Date(iso) : new Date(Date.now() + 3600e3); const p = (n) => String(n).padStart(2, '0'); return [`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`, `${p(d.getHours())}:${p(d.getMinutes())}`]; };
const gRel = (iso) => { const m = Math.round((Date.parse(iso) - gNow()) / 60000); if (isNaN(m)) return ''; const a = Math.abs(m), t = a < 60 ? `${a} دقيقة` : a < 1440 ? `${Math.round(a / 60)} ساعة` : `${Math.round(a / 1440)} يوماً`; return m >= 0 ? `بعد ${t}` : `منذ ${t}`; };

/* ---------- الكتابة ---------- */
function gPatch(crn, patch) { A.raw.gsec[crn] = merge(clone(A.raw.gsec[crn] || {}), clone(patch)); enqueue('gsec/' + crn, patch); }
function gPutDoc(col, id, data) { A.raw[col][id] = clone(data); enqueue(col + '/' + id, data, 'set'); }
/* سجل التدقيق: لا واجهة لتعديله أو حذفه، ووثيقة كل مستخدم لا يكتب فيها غيره (قاعدة {self} في قاعدة البيانات) */
const gLogCol = () => (GX.uid ? 'glog' : 'glogs');
const gLogId = () => GX.uid || 'acc-' + (A.me ? A.me.id : 'x');
function gLog(rows) {
  if (!rows.length || !A.me) return;
  const iso = new Date().toISOString(), col = gLogCol(), id = gLogId(), e = {};
  rows.forEach((r) => { const k = Date.now().toString(36) + '-' + (GX.seq++).toString(36).padStart(4, '0'); e[k] = [iso, A.me.id, A.me.name].concat(r.map((x) => (x === undefined || x === null ? '' : x))); });
  A.raw[col][id] = merge(clone(A.raw[col][id] || { e: {} }), { e: clone(e) });
  const keys = Object.keys(A.raw[col][id].e).sort();
  if (keys.length <= 520) { enqueue(col + '/' + id, { e, n: keys.length }); return; }
  /* الوثيقة محدودة الحجم: الأقدم يُنقل كما هو إلى أرشيف تحت وثيقة المستخدم نفسها ولا يُحذف */
  const old = {}, keep = {}; keys.forEach((k, i) => { (i < 320 ? old : keep)[k] = A.raw[col][id].e[k]; });
  enqueue(`${col}/${id}/a/${keys[0]}`, { e: old, from: keys[0], to: keys[319], n: 320 }, 'set');
  A.raw[col][id] = { e: keep, n: Object.keys(keep).length, arch: ((A.raw[col][id].arch) || 0) + 1 };
  enqueue(col + '/' + id, clone(A.raw[col][id]), 'set');
  GX.arch.push({ e: old });
}
async function gLoadArchive() {
  if (!db) return 0; const all = []; let n = 0;
  for (const c of ['glog', 'glogs']) for (const id of Object.keys(A.raw[c] || {})) { try { const s = await db.collection(`${c}/${id}/a`).get(); s.docs.forEach((d) => { all.push(d.data()); n += Object.keys((d.data() || {}).e || {}).length; }); } catch (e) { /* أرشيف غير متاح */ } }
  GX.arch = all; GX.archLoaded = true; return n;
}
const gLogRows = () => { const out = [], seen = {}; [Object.values(A.raw.glog || {}), Object.values(A.raw.glogs || {}), GX.arch].forEach((list) => list.forEach((d) => { Object.entries((d && d.e) || {}).forEach(([k, r]) => { if (Array.isArray(r) && !seen[k + r[1]]) { seen[k + r[1]] = 1; out.push({ k, at: r[0], by: r[1], byName: r[2], act: r[3], crn: r[4], id: r[5], comp: r[6], old: r[7], neu: r[8], det: r[9] }); } }); })); return out.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.k < b.k ? 1 : -1)); };
const GACT = { grade: 'إدخال درجة', gdel: 'مسح درجة', import: 'استيراد درجات', dist: 'استيراد توزيع الدرجات', distedit: 'تعديل توزيع الدرجات', roster: 'تحديث قائمة المتدربين', exam: 'إعداد الاختبار', approve: 'اعتماد وتجميد', unlock: 'فك التجميد', revoke: 'إلغاء الجاهزية آلياً', sched: 'جدولة الرفع', schedx: 'إلغاء الجدولة', schedp: 'إيقاف الجدولة مؤقتاً', schedr: 'استئناف الجدولة', opnew: 'بدء عملية رفع', opread: 'تحقق من حالة رايات', opres: 'نتيجة المزامنة', opfail: 'فشل رفع درجة', opunk: 'نتيجة غير معروفة', opcancel: 'إلغاء عملية الرفع', docx: 'توثيق حالات المطابقة', close: 'إغلاق عملية الرصد', corr: 'إجراء تصحيح', set: 'تعديل الإعدادات', blocked: 'محاولة مرفوضة' };
async function gSha(text) { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)); return hex(b); } catch (e) { return ''; } }
const gId = (p) => p + Date.now().toString(36).toUpperCase() + hex(crypto.getRandomValues(new Uint8Array(2))).toUpperCase();

/* ---------- إدخال الدرجات: كل طريق للكتابة يمر من هنا ---------- */
function gGate(crn) {
  const sec = A.raw.gsec[crn];
  if (!sec) return 'الشعبة غير موجودة في قاعدة بيانات الدرجات.';
  if (isViewer()) return 'هذا الحساب للاطلاع فقط.';
  if (!gMay(crn)) return gNotMine(crn);
  const f = sec.flow || {};
  if (f.closed && f.closed.at && !(f.corr && f.corr.open)) return 'عملية الرصد مغلقة. أي تعديل يتطلب إجراء تصحيح موثقاً ومراجعة جديدة.';
  if (f.op && f.op.st === 'prepared') return 'توجد عملية رفع جارية لهذه الشعبة. أنهِها أو ألغِها قبل التعديل.';
  if (f.lock && f.lock.on) return 'الدرجات مجمدة بعد الاعتماد. التعديل يتطلب فك التجميد ممن يملك الصلاحية.';
  return '';
}
function gSetGrades(crn, list, src) {
  const gate = gGate(crn), sec = A.raw.gsec[crn], ok = [], bad = [];
  if (gate) { gLog([['blocked', crn, '', '', '', '', gate]]); return { ok, bad: list.map((x) => Object.assign({ msg: gate }, x)), gate }; }
  const marks = gMarks(crn), seen = {}, patchG = {}, patchT = {}, logs = [], iso = new Date().toISOString();
  list.forEach((x) => {
    const row = sec.rows.find((r) => r.id === x.id), key = x.id + '|' + x.k;
    if (!row) { bad.push(Object.assign({ msg: `الرقم التدريبي ${x.id} غير موجود في الشعبة ${crn}.` }, x)); return; }
    if (seen[key]) { bad.push(Object.assign({ msg: `الرقم التدريبي ${x.id} مكرر في المكوّن ${x.k}.` }, x)); return; }
    seen[key] = 1;
    const clearing = x.raw === null || x.raw === undefined || String(x.raw).trim() === '';
    if (!row.el && !clearing) { bad.push(Object.assign({ msg: `لا يمكن رصد درجة للمتدرب ${row.name}: غير قابل للرصد (${row.st || 'حالة القيد'}).` }, x)); return; }
    const c = G.check(sec, x.k, x.raw);
    if (!c.ok) { bad.push(Object.assign({ msg: c.msg, code: c.code, name: row.name }, x)); return; }
    const old = G.val(marks, x.id, x.k);
    if ((old === null && c.v === null) || old === c.v) { ok.push(Object.assign({ v: c.v, same: true }, x)); return; }
    (patchG[x.id] = patchG[x.id] || {})[x.k] = c.v; (patchT[x.id] = patchT[x.id] || {})[x.k] = [iso, A.me.id];
    logs.push([c.v === null ? 'gdel' : 'grade', crn, x.id, x.k, old === null ? '' : old, c.v === null ? '' : c.v, src || 'يدوي']);
    ok.push(Object.assign({ v: c.v, old }, x));
  });
  if (logs.length) {
    A.raw.gmarks[crn] = merge(clone(A.raw.gmarks[crn] || { g: {}, t: {} }), { g: clone(patchG), t: clone(patchT) });
    enqueue('gmarks/' + crn, { g: patchG, t: patchT });
    gLog(logs);
  }
  if (bad.length) gLog(bad.slice(0, 20).map((b) => ['blocked', crn, b.id, b.k, '', String(b.raw === undefined ? '' : b.raw).slice(0, 20), b.msg]));
  return { ok, bad, n: logs.length };
}

/* ---------- التجميد الأكاديمي (Grade Lock) ---------- */
async function gSaveSnap(sec, kind) {
  const snap = G.snapshot(sec, gMarks(sec.crn), kind, gWho(), new Date().toISOString());
  snap.id = gId('S'); snap.sha = await gSha(JSON.stringify([snap.crn, snap.comps, snap.rows]));
  gPutDoc('gsnap', snap.id, snap);
  return snap;
}
const gSnapOk = (snap) => !!snap && G.snapSig(snap) === snap.sig;
async function gApprove(crn) {
  const gate = gGate(crn); if (gate) { toast(gate); return false; }
  const sec = A.raw.gsec[crn], s = G.stats(sec, gMarks(crn));
  if (!s.complete) { toast(s.issues.length ? s.issues[0].t : s.err ? 'توجد درجات غير صحيحة. صحّحها قبل الاعتماد.' : `لا يمكن اعتماد درجات ناقصة: بقي ${s.left} درجة.`); return false; }
  const snap = await gSaveSnap(sec, 'approve'), w = gWho(), iso = snap.at;
  gPatch(crn, { flow: { lock: { on: true, at: iso, by: w.id, byName: w.name, snap: snap.id, sig: snap.sig }, changed: { at: null, why: null } } });
  gLog([['approve', crn, '', '', '', snap.sig, `النسخة ${snap.id} • ${snap.n} متدرباً • SHA-256 ${snap.sha.slice(0, 16)}`]]);
  return true;
}
function gUnlock(crn, why) {
  if (!gMay(crn)) { toast(gNotMine(crn)); return false; }
  const sec = A.raw.gsec[crn], f = sec.flow || {}, w = gWho(), iso = new Date().toISOString();
  if (f.op && f.op.st === 'prepared') { toast('توجد عملية رفع جارية لهذه الشعبة. أنهِها أو ألغِها أولاً.'); return false; }
  const after = (f.sync && f.sync.st) || (f.closed && f.closed.at), patch = { lock: { on: false }, sched: { st: f.sched && f.sched.st && f.sched.st !== 'none' ? 'cancelled' : 'none' }, changed: { at: iso, why: after ? 'فُتح إجراء تصحيح بعد الرفع' : 'فُك التجميد للتعديل' } };
  if (after) patch.corr = { open: true, at: iso, by: w.id, byName: w.name, why, n: ((f.corr && f.corr.n) || 0) + 1 };
  gPatch(crn, { flow: patch });
  gLog([[after ? 'corr' : 'unlock', crn, '', '', (f.lock || {}).sig || '', '', why]]);
  return true;
}
/* إذا تغيرت الدرجات أو القابلون للرصد أو التوزيع بعد الاعتماد أو الجدولة: تُلغى الجاهزية آلياً ويُشعر المدرب */
function gGuard() {
  if (!A.me || !gReady() || Q.length || isViewer()) return;
  GX.mis = GX.mis || {};
  Object.values(A.raw.gsec).forEach((sec) => {
    const f = (sec && sec.flow) || {}; if (!sec || !sec.crn || !(f.lock && f.lock.on) || !gMay(sec.crn)) { if (sec && sec.crn) delete GX.mis[sec.crn]; return; }
    if (f.lock.sig === G.sig(sec, gMarks(sec.crn))) { delete GX.mis[sec.crn]; return; }
    /* مهلة قصيرة حتى لا يُحتسب وصول التحديثات من جهاز آخر بترتيب مختلف تغييراً */
    if (!GX.mis[sec.crn]) { GX.mis[sec.crn] = Date.now(); setTimeout(() => { try { gGuard(); } catch (e) { /* يعاد عند التحديث التالي */ } }, 12500); return; }
    if (Date.now() - GX.mis[sec.crn] < 12000) return;
    delete GX.mis[sec.crn];
    const iso = new Date().toISOString();
    gPatch(sec.crn, { flow: { lock: { on: false }, sched: { st: f.sched && f.sched.st && f.sched.st !== 'none' ? 'cancelled' : 'none' }, changed: { at: iso, why: 'تغيرت الدرجات أو قائمة القابلين للرصد أو التوزيع بعد الاعتماد' } } });
    gLog([['revoke', sec.crn, '', '', f.lock.sig, G.sig(sec, gMarks(sec.crn)), 'أُلغيت الجاهزية والجدولة آلياً']]);
    toast(`الشعبة ${sec.crn}: تغيرت الدرجات بعد الاعتماد، فأُلغيت الجاهزية والجدولة. راجعها واعتمدها من جديد.`);
  });
}
{ const o = rebuild; rebuild = function () { o(); try { gGuard(); } catch (e) { /* لا يمنع العرض */ } }; }

/* ---------- الجدولة ---------- */
async function gSchedule(crn, iso) {
  if (!gMay(crn)) { toast(gNotMine(crn)); return false; }
  const sec = A.raw.gsec[crn], st = gSt(sec);
  if (!st.approved) { toast('لا تُجدول إلا شعبة معتمدة ومجمدة الدرجات.'); return false; }
  if (!iso || isNaN(Date.parse(iso)) || Date.parse(iso) < gNow() - 60000) { toast('اختر موعداً في المستقبل.'); return false; }
  const snap = await gSaveSnap(sec, 'schedule'), w = gWho();
  gPatch(crn, { flow: { sched: { st: 'on', at: new Date(iso).toISOString(), setAt: snap.at, by: w.id, byName: w.name, snap: snap.id, sig: snap.sig } } });
  gLog([['sched', crn, '', '', '', new Date(iso).toISOString(), `النسخة ${snap.id}`]]);
  return true;
}
function gSchedSet(crn, st) {
  if (!gMay(crn)) { toast(gNotMine(crn)); return; }
  gPatch(crn, { flow: { sched: { st } } });
  gLog([[st === 'paused' ? 'schedp' : st === 'on' ? 'schedr' : 'schedx', crn, '', '', '', '', '']]);
}

/* ---------- عملية الرفع: معرف فريد لكل عملية، ولا يُعاد إرسال ما نجح ---------- */
const gOp = (id) => A.raw.gops[id] || null;
const gOpsOf = (crn) => Object.values(A.raw.gops).filter((o) => o && o.crn === crn).sort((a, b) => (a.at < b.at ? 1 : -1));
const gCurOp = (sec) => { const f = sec.flow || {}; return f.op && f.op.id ? gOp(f.op.id) : null; };
async function gStartOp(crn, mode) {
  if (!gMay(crn)) { toast(gNotMine(crn)); gLog([['blocked', crn, '', '', '', '', 'محاولة رفع شعبة غير مسندة']]); return null; }
  const sec = A.raw.gsec[crn], f = sec.flow || {}, st = gSt(sec), w = gWho();
  if (mode !== 'read') {
    const bl = G.blockers(sec, gMarks(crn), gNow(), gSet(), {}).filter((b) => !(mode === 'retry' && /عملية سابقة/.test(b)));
    if (bl.length) { toast(bl[0]); return null; }
    if (f.sync && f.sync.st === 'ok' && f.sync.sig === st.sig) { toast(`هذه الدرجات نفسها رُفعت وتحققت مطابقتها في العملية ${f.sync.opId}. لا يُعاد إرسالها.`); return null; }
    const cur = gCurOp(sec);
    if (cur && cur.st === 'prepared' && cur.sig === st.sig && cur.kind !== 'read') return cur; /* العملية نفسها: تُنسخ حزمتها من جديد دون عملية ثانية */
  }
  const snap = mode === 'read' && f.lock && f.lock.on && A.raw.gsnap[f.lock.snap] ? A.raw.gsnap[f.lock.snap] : await gSaveSnap(sec, mode === 'read' ? 'read' : 'upload');
  const d = new Date(), id = `R${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${crn}-${hex(crypto.getRandomValues(new Uint8Array(2))).toUpperCase()}`;
  const prev = mode === 'read' ? (f.op && f.op.id) || null : null;
  const op = { id, crn, kind: mode || 'push', at: d.toISOString(), by: w.id, byName: w.name, snap: snap.id, sig: snap.sig, st: 'prepared', n: snap.n, prev };
  gPutDoc('gops', id, op);
  if (mode !== 'read') gPatch(crn, { flow: { op: { id, st: 'prepared', at: op.at, sig: snap.sig, why: null }, sched: { st: f.sched && f.sched.st === 'on' ? 'done' : (f.sched && f.sched.st) || 'none' } } });
  gLog([[mode === 'read' ? 'opread' : 'opnew', crn, '', '', '', id, `النسخة ${snap.id} • ${snap.n} متدرباً${mode === 'retry' ? ' • إعادة محاولة' : ''}`]]);
  return op;
}
const gPkgText = (op) => { const snap = A.raw.gsnap[op.snap]; return snap ? JSON.stringify(G.pkg(snap, op.id, op.kind === 'read' ? 'read' : 'push', new Date().toISOString())) : ''; };
function gOpUnknown(crn) {
  const sec = A.raw.gsec[crn], op = gCurOp(sec); if (!op || !gMay(crn)) return;
  A.raw.gops[op.id] = Object.assign({}, op, { st: 'unknown' }); enqueue('gops/' + op.id, { st: 'unknown' });
  gPatch(crn, { flow: { op: { st: 'unknown' } } });
  gLog([['opunk', crn, '', '', '', op.id, 'لم تصل نتيجة الجسر (انقطاع أو إغلاق). يلزم التحقق من رايات قبل أي إعادة إرسال']]);
}
function gOpCancel(crn) {
  const sec = A.raw.gsec[crn], op = gCurOp(sec); if (!op || !gMay(crn) || op.st !== 'prepared') return;
  A.raw.gops[op.id] = Object.assign({}, op, { st: 'unknown' }); enqueue('gops/' + op.id, { st: 'unknown', cancelled: new Date().toISOString() });
  gPatch(crn, { flow: { op: { st: 'unknown' } } });
  gLog([['opcancel', crn, '', '', '', op.id, 'أُلغيت قبل وصول النتيجة. لا يُعرف هل شُغّل الجسر، فيلزم التحقق من رايات']]);
}
/* استلام نتيجة الجسر: لا تُعد المزامنة ناجحة إلا بعد مطابقة ما قُرئ من رايات فعلياً */
async function gTakeResult(text) {
  const j = G.parseResult(text);
  if (!j) { toast('النص ليس نتيجة صالحة من جسر الدرجات.'); return null; }
  const crn = String(j.crn), sec = A.raw.gsec[crn];
  if (!sec) { toast(`الشعبة ${crn} غير موجودة في حاضر.`); return null; }
  if (!gMay(crn)) { toast(gNotMine(crn)); return null; }
  let op = j.op ? gOp(j.op) : null;
  if (op && op.crn !== crn) { toast('معرف العملية لا يخص هذه الشعبة.'); return null; }
  const f = sec.flow || {};
  if (!op) { toast('معرف العملية غير معروف في حاضر. ابدأ العملية من المنصة ثم الصق نتيجتها.'); return null; }
  if (op.res && op.res.at === j.at) { toast('هذه النتيجة سُجّلت من قبل.'); return op; }
  const snap = A.raw.gsnap[op.snap];
  if (!snap || !gSnapOk(snap)) { toast('النسخة المجمدة لهذه العملية غير سليمة. أعد الاعتماد وابدأ عملية جديدة.'); return null; }
  const rec = G.reconcile(snap, j), ap = j.applied || null, iso = new Date().toISOString(), w = gWho();
  const target = op.kind === 'read' && op.prev && gOp(op.prev) ? gOp(op.prev) : op; /* قراءة التحقق تحسم العملية السابقة */
  let st, why = '';
  if (rec.ok) st = 'ok';
  else if (rec.head.length) { st = op.kind === 'read' ? (target.st === 'prepared' ? 'unknown' : target.st) : 'failed'; why = rec.head[0]; }
  else if (rec.distBad.length) { st = 'failed'; why = 'توزيع الدرجات في رايات لا يطابق حاضر: ' + rec.distBad[0]; }
  else if (rec.sum.ok > 0 || (ap && ap.done > 0)) st = 'partial';
  else { st = 'failed'; why = 'لم تصل أي درجة إلى رايات'; }
  const manualOnly = !rec.ok && !rec.head.length && !rec.distBad.length && rec.rows.every((r) => r.st === 'ok' || r.st === 'manual' || r.st === 'unverified');
  /* ما سُجّل في رايات فعلياً حسب إعادة القراءة */
  let up = null;
  if (!rec.head.length && rec.rows.some((r) => r.r)) {
    up = { id: gId('U'), crn, code: snap.code, name: snap.name, term: snap.term, kind: 'uploaded', at: iso, by: w.id, byName: w.name, op: target.id, comps: snap.comps, rows: rec.rows.filter((r) => r.r && !r.extra).map((r) => ({ id: r.id, name: r.rName || r.name, g: r.r, total: r.rTotal })) };
    up.n = up.rows.length; up.sig = G.snapSig(up); up.sha = await gSha(JSON.stringify([up.crn, up.comps, up.rows]));
    gPutDoc('gsnap', up.id, up);
  }
  const resDoc = { at: j.at, got: iso, mode: j.mode || '', status: j.status || '', applied: ap ? { done: ap.done || 0, sent: ap.sent || 0, failed: (ap.failed || []).slice(0, 80) } : null, sum: rec.sum, okN: rec.okN, total: rec.total, head: rec.head, distBad: rec.distBad, rows: rec.rows.map((r) => ({ id: r.id, name: r.name, st: r.st, why: r.why, g: r.g, r: r.r, total: r.total, rTotal: r.rTotal, extra: !!r.extra })), all: (j.all || []).slice(0, 200), upSnap: up ? up.id : null };
  A.raw.gops[op.id] = Object.assign({}, op, { st: op.kind === 'read' ? 'read' : st, why, res: resDoc }); enqueue('gops/' + op.id, { st: op.kind === 'read' ? 'read' : st, why, res: resDoc });
  if (target !== op) { A.raw.gops[target.id] = Object.assign({}, target, { st, why, res: resDoc, checkedBy: op.id }); enqueue('gops/' + target.id, { st, why, res: resDoc, checkedBy: op.id }); }
  const isCur = f.op && f.op.id === target.id, live = f.lock && f.lock.on && f.lock.sig === snap.sig;
  const pureRead = op.kind === 'read' && target === op; /* قراءة للتحقق دون عملية رفع سابقة: لا تغيّر حالة الرفع */
  const fl = {};
  if (isCur && !pureRead) fl.op = { id: target.id, st, why, at: target.at, sig: target.sig };
  if (live && !rec.head.length && (!pureRead || rec.ok)) fl.sync = { st: rec.ok ? 'ok' : manualOnly ? 'review' : 'bad', at: iso, opId: target.id, sig: snap.sig, okN: rec.okN, total: rec.total, idMis: rec.sum.idmis + rec.sum.nostudent, upSnap: up ? up.id : null, doc: { at: null, note: null, by: null, byName: null } };
  if (live && manualOnly && fl.op) fl.op.st = 'ok';
  if (Object.keys(fl).length) gPatch(crn, { flow: fl });
  const logs = [['opres', crn, '', '', '', target.id, `${RES_ST[st] || st}${ap ? ` • نُفذ ${ap.done || 0} وفشل ${(ap.failed || []).length}` : ' • قراءة فقط'} • مطابق ${rec.okN} من ${rec.total}${why ? ' • ' + why : ''}`]];
  rec.rows.filter((r) => r.st !== 'ok').slice(0, 60).forEach((r) => logs.push(['opfail', crn, r.id, '', '', G.RC[r.st], r.why.join('؛ ')]));
  gLog(logs);
  return A.raw.gops[target.id];
}
const RES_ST = { ok: 'تمت المزامنة وتحققت المطابقة', partial: 'رُفع جزء من الدرجات', failed: 'فشلت المزامنة', unknown: 'النتيجة غير معروفة', prepared: 'قيد المزامنة', read: 'قراءة للتحقق', cancelled: 'ملغاة' };
function gDocExceptions(crn, note) {
  if (!gMay(crn)) { toast(gNotMine(crn)); return; }
  const w = gWho(), iso = new Date().toISOString();
  gPatch(crn, { flow: { sync: { doc: { at: iso, note, by: w.id, byName: w.name } } } });
  gLog([['docx', crn, '', '', '', '', note]]);
}
function gClose(crn) {
  if (!gMay(crn)) { toast(gNotMine(crn)); return; }
  const sec = A.raw.gsec[crn], st = gSt(sec);
  if (st.k !== 'synced') { toast('لا تُغلق عملية الرصد قبل نجاح المطابقة مع رايات أو توثيق ما تعذر التحقق منه.'); return; }
  const w = gWho(), iso = new Date().toISOString();
  gPatch(crn, { flow: { closed: { at: iso, by: w.id, byName: w.name }, corr: { open: false } } });
  gLog([['close', crn, '', '', '', (sec.flow.sync || {}).opId || '', st.why || '']]);
}

/* ---------- الإشعارات ---------- */
function gNotices() {
  const out = [], now = gNow(), rem = gSet().remindMin * 60000;
  gSecs().forEach((sec) => {
    const f = sec.flow || {}, st = gSt(sec), mine = gMay(sec.crn), sch = f.sched || {}, op = gCurOp(sec);
    if (mine && sch.st === 'on' && sch.at && st.k === 'sched') { const t = Date.parse(sch.at); if (t <= now) out.push({ k: `due_${sec.crn}_${sch.at}`, tone: 'bad', crn: sec.crn, text: `حان موعد رفع درجات الشعبة ${sec.crn} (${gWhen(sch.at)})`, act: 'g-up', label: 'بدء الرفع', todo: 1 }); else if (t - now <= rem) out.push({ k: `pre_${sec.crn}_${sch.at}`, tone: 'warn', crn: sec.crn, text: `موعد رفع درجات الشعبة ${sec.crn} ${gRel(sch.at)}`, act: 'g-open', label: 'فتح الشعبة' }); }
    if (mine && op && op.st === 'prepared') out.push({ k: `run_${op.id}`, tone: 'info', crn: sec.crn, text: `بدأت عملية الرفع ${op.id} في ${gDT(op.at)} وتنتظر نتيجة الجسر`, act: 'g-go-sync', label: 'متابعة', todo: 1 });
    if (mine && op && op.res && op.st !== 'prepared' && now - Date.parse(op.res.got || op.at) < 864e5) out.push({ k: `end_${op.id}_${op.st}`, tone: op.st === 'ok' ? 'ok' : 'bad', crn: sec.crn, text: `انتهت عملية الرفع ${op.id}: ${RES_ST[op.st] || op.st}`, act: 'g-go-sync', label: 'التقرير', todo: op.st === 'ok' ? 0 : 1 });
    if (mine && f.changed && f.changed.at && !(f.lock && f.lock.on)) out.push({ k: `chg_${sec.crn}_${f.changed.at}`, tone: 'warn', crn: sec.crn, text: `الشعبة ${sec.crn}: ${f.changed.why || 'أُلغيت الجاهزية'}، ويلزم اعتماد جديد`, act: 'g-open', label: 'فتح الشعبة', todo: 1 });
  });
  return out;
}
const gSeen = { get() { try { return JSON.parse(localStorage.getItem('haader.gSeen') || '{}'); } catch (e) { return GX.seen || {}; } }, add(k) { const o = this.get(); o[k] = Date.now(); Object.keys(o).forEach((x) => { if (Date.now() - o[x] > 14 * 864e5) delete o[x]; }); GX.seen = o; try { localStorage.setItem('haader.gSeen', JSON.stringify(o)); } catch (e) { /* محلي فقط */ } } };
function gTick() {
  if (!A.me || !gReady()) return;
  const seen = gSeen.get(), fresh = gNotices().filter((n) => !seen[n.k]);
  if (fresh.length) { fresh.forEach((n) => gSeen.add(n.k)); toast(fresh[0].text + (fresh.length > 1 ? ` (و${fresh.length - 1} إشعار آخر)` : '')); }
  try { gGuard(); } catch (e) { /* لا يمنع العرض */ }
  if (GVIEW.has(A.view) && !$('#modal')) render();
}
NAV_BADGE.gsched = () => (gReady() ? gNotices().filter((n) => n.todo).length : 0);
