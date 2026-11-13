/* ====================================================================
   إدارة الاختبارات ورصد الدرجات — منصة حاضر
   1) المحرك: دوال نقية بلا DOM. الحدود القصوى تُقرأ من توزيع الدرجات
      المستورد (sec.comps) ولا يوجد أي حد مكتوب في البرمجة.
   ==================================================================== */
const G = (function () {
  const AR_DIG = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.', '،': '.' };
  const DEC = 2; /* خانتان عشريتان كحد أقصى كما في رايات (decimalPlacesForDisplay) */
  const fmt = (v) => (v == null || v === '' ? '' : String(Math.round(v * 100) / 100));
  const isNum = (v) => typeof v === 'number' && isFinite(v);
  const round2 = (v) => Math.round(v * 100) / 100;
  const normName = (s) => String(s || '').replace(/[ًٌٍَُِّْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();
  const partOrder = (p) => (p === 'نظري' ? 0 : p === 'عملي' ? 1 : 2);
  const comps = (sec) => ((sec && sec.comps) || []).slice().sort((a, b) => partOrder(a.part) - partOrder(b.part) || String(a.k).localeCompare(String(b.k)));
  const compBy = (sec, k) => ((sec && sec.comps) || []).find((c) => c.k === k) || null;
  const parts = (sec) => { const o = {}; comps(sec).forEach((c) => { (o[c.part || 'أخرى'] = o[c.part || 'أخرى'] || []).push(c); }); return o; };
  const total = (sec) => round2(comps(sec).reduce((a, c) => a + (isNum(c.max) ? c.max : 0), 0));
  const eligible = (sec) => ((sec && sec.rows) || []).filter((r) => r.el);
  const val = (marks, id, k) => { const v = marks && marks.g && marks.g[id] ? marks.g[id][k] : null; return v === undefined ? null : v; };

  /* ---------- التحقق من درجة واحدة ---------- */
  function check(sec, k, raw) {
    const c = compBy(sec, k);
    if (!c) return { ok: false, code: 'comp', msg: `لا يمكن حفظ الدرجة: المكوّن ${k} غير معتمد في توزيع درجات الشعبة ${sec ? sec.crn : ''}.` };
    if (!isNum(c.max) || c.max <= 0) return { ok: false, code: 'dist', msg: `لا يمكن حفظ الدرجة: الحد الأعلى للمكوّن ${k} غير معرّف في توزيع الدرجات.` };
    if (raw === null || raw === undefined) return { ok: true, v: null };
    let s = typeof raw === 'number' ? String(raw) : String(raw).trim().replace(/[٠-٩٫،]/g, (ch) => AR_DIG[ch]);
    if (s === '') return { ok: true, v: null };
    if (!/^-?\d+(\.\d+)?$/.test(s)) return { ok: false, code: 'text', msg: `لا يمكن حفظ «${String(raw).slice(0, 20)}» في ${k}: حقل الدرجة يقبل الأرقام فقط.` };
    const v = Number(s);
    if (!isFinite(v)) return { ok: false, code: 'text', msg: `لا يمكن حفظ «${String(raw).slice(0, 20)}» في ${k}: حقل الدرجة يقبل الأرقام فقط.` };
    if (v < 0) return { ok: false, code: 'neg', msg: `لا يمكن حفظ الدرجة ${fmt(v)} في ${k}: لا تُقبل الدرجات السالبة.` };
    if (v > c.max) return { ok: false, code: 'max', msg: `لا يمكن حفظ الدرجة ${fmt(v)} في ${k}، الحد الأعلى المعتمد لهذا المكون هو ${fmt(c.max)} درجة.` };
    if ((s.split('.')[1] || '').length > DEC) return { ok: false, code: 'dec', msg: `لا يمكن حفظ الدرجة ${s} في ${k}: تُقبل خانتان عشريتان على الأكثر كما في رايات.` };
    return { ok: true, v };
  }
  /* فحص قيمة مخزنة (قد تكون كُتبت خارج الواجهة) */
  function storedBad(sec, k, v) {
    if (v === null || v === undefined) return '';
    if (!isNum(v)) return 'قيمة غير رقمية';
    const c = compBy(sec, k);
    if (!c) return 'مكوّن غير معتمد';
    if (v < 0) return 'درجة سالبة';
    if (v > c.max) return `تتجاوز الحد ${fmt(c.max)}`;
    if (round2(v) !== v) return 'أكثر من خانتين عشريتين';
    return '';
  }

  /* ---------- حالة المتدرب ---------- */
  function rowState(sec, marks, row) {
    const cs = comps(sec), g = {}, bad = [];
    let n = 0, sum = 0; const part = {};
    cs.forEach((c) => {
      const v = val(marks, row.id, c.k); g[c.k] = v;
      const b = storedBad(sec, c.k, v); if (b) bad.push(`${c.k}: ${b}`);
      if (isNum(v)) { n++; sum += v; part[c.part] = round2((part[c.part] || 0) + v); }
    });
    let st;
    if (!row.el) st = 'na'; else if (bad.length) st = 'err'; else if (n === cs.length && cs.length) st = 'done'; else if (n === 0) st = 'none'; else st = 'part';
    return { st, g, n, need: cs.length, total: n ? round2(sum) : null, part, bad, hasAny: n > 0 };
  }
  const ROW_ST = { na: 'غير قابل للرصد', err: 'خطأ', done: 'مكتمل', part: 'غير مكتمل', none: 'لم يُدخل' };

  /* ---------- سلامة بيانات الشعبة ---------- */
  function issues(sec, marks) {
    const out = [], rows = (sec && sec.rows) || [], cs = comps(sec);
    if (!cs.length) out.push({ k: 'dist', t: 'لا يوجد توزيع درجات معتمد لهذه الشعبة' });
    const seenC = {}; cs.forEach((c) => { if (seenC[c.k]) out.push({ k: 'dist', t: `المكوّن ${c.k} مكرر في توزيع الدرجات` }); seenC[c.k] = 1; if (!isNum(c.max) || c.max <= 0) out.push({ k: 'dist', t: `الحد الأعلى للمكوّن ${c.k} غير صحيح` }); });
    if (cs.length && total(sec) !== 100) out.push({ k: 'dist', t: `مجموع توزيع الدرجات ${fmt(total(sec))} وليس 100` });
    const seen = {}; rows.forEach((r) => { if (seen[r.id]) out.push({ k: 'dup', id: r.id, t: `الرقم التدريبي ${r.id} مكرر داخل الشعبة` }); seen[r.id] = 1; if (!/^\d{6,12}$/.test(String(r.id))) out.push({ k: 'id', id: r.id, t: `الرقم التدريبي «${r.id}» غير صحيح` }); });
    const g = (marks && marks.g) || {};
    Object.keys(g).forEach((id) => {
      const row = rows.find((r) => r.id === id), has = Object.keys(g[id] || {}).filter((k) => g[id][k] !== null && g[id][k] !== undefined);
      if (!has.length) return;
      if (!row) { out.push({ k: 'ghost', id, warn: true, t: `درجات محفوظة لرقم تدريبي غير موجود في الشعبة: ${id}` }); return; }
      if (!row.el) { out.push({ k: 'inelig', id, warn: true, t: `درجات محفوظة لمتدرب غير قابل للرصد: ${row.name}` }); return; }
      has.forEach((k) => { const b = !compBy(sec, k) ? 'مكوّن غير معتمد' : storedBad(sec, k, g[id][k]); if (b) out.push({ k: 'val', id, comp: k, t: `${row.name} — ${k}: ${b}` }); });
    });
    return out;
  }

  /* ---------- إحصاءات الشعبة ---------- */
  function stats(sec, marks) {
    const rows = (sec && sec.rows) || [], cs = comps(sec), el = eligible(sec);
    const o = { n: rows.length, elig: el.length, need: el.length * cs.length, have: 0, done: 0, part: 0, none: 0, err: 0, pct: 0, avg: null, max: null, min: null, left: 0, byComp: {}, rs: {} };
    cs.forEach((c) => { o.byComp[c.k] = { have: 0, need: el.length }; });
    const tots = [];
    rows.forEach((r) => {
      const s = rowState(sec, marks, r); o.rs[r.id] = s;
      if (!r.el) return;
      o[s.st]++;
      cs.forEach((c) => { if (isNum(s.g[c.k]) && !storedBad(sec, c.k, s.g[c.k])) { o.have++; o.byComp[c.k].have++; } });
      if (s.st === 'done') tots.push(s.total);
    });
    o.left = o.need - o.have; o.pct = o.need ? o.have / o.need : 0;
    if (tots.length) { o.avg = round2(tots.reduce((a, b) => a + b, 0) / tots.length); o.max = Math.max(...tots); o.min = Math.min(...tots); }
    o.issues = issues(sec, marks); o.blocking = o.issues.filter((x) => !x.warn);
    o.complete = o.elig > 0 && o.done === o.elig && !o.err && !o.blocking.length;
    return o;
  }

  /* ---------- البصمة: تتغير عند تغير أي درجة أو التوزيع أو القابلين للرصد ---------- */
  function cyrb(str) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < str.length; i++) { const ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0'); }
  const canon = (sec, marks) => { const cs = comps(sec); return JSON.stringify([sec.crn, cs.map((c) => [c.k, c.max]), eligible(sec).map((r) => r.id).sort().map((id) => [id, cs.map((c) => { const v = val(marks, id, c.k); return isNum(v) ? v : null; })])]); };
  const sig = (sec, marks) => cyrb(canon(sec, marks));
  const snapMarks = (snap) => { const g = {}; (snap.rows || []).forEach((r) => { g[r.id] = r.g; }); return { g }; };
  const snapSig = (snap) => cyrb(JSON.stringify([snap.crn, (snap.comps || []).map((c) => [c.k, c.max]), (snap.rows || []).map((r) => r.id).sort().map((id) => { const r = snap.rows.find((x) => x.id === id); return [id, (snap.comps || []).map((c) => (isNum(r.g[c.k]) ? r.g[c.k] : null))]; })]));

  /* ---------- النسخة المجمدة ---------- */
  function snapshot(sec, marks, kind, who, at) {
    const cs = comps(sec);
    const rows = eligible(sec).map((r) => { const g = {}; let t = 0, n = 0; cs.forEach((c) => { const v = val(marks, r.id, c.k); g[c.k] = isNum(v) ? v : null; if (isNum(v)) { t += v; n++; } }); return { id: r.id, name: r.name, g, total: n ? round2(t) : null }; });
    const s = { crn: sec.crn, code: sec.code, name: sec.name, term: sec.termCode || '', kind, at, by: who.id, byName: who.name, comps: cs.map((c) => ({ k: c.k, max: c.max, part: c.part })), rows, n: rows.length };
    s.sig = snapSig(s);
    return s;
  }

  /* ---------- دورة العمل: المراحل الثماني والحالة ---------- */
  const STAGES = ['إعداد الاختبار', 'تسجيل الدرجات', 'مراجعة الدرجات', 'اكتمال الرصد', 'جدولة الرفع', 'تنفيذ المزامنة مع رايات', 'التحقق من نجاح المزامنة', 'إغلاق عملية الرصد'];
  const ST = {
    none: ['لم يبدأ', ''], entry: ['قيد الإدخال', 'info'], incomplete: ['غير مكتمل', 'warn'], complete: ['مكتمل', 'ok'], review: ['يحتاج مراجعة', 'warn'], ready: ['جاهز للرفع', 'ok'],
    sched: ['مجدول', 'info'], syncing: ['قيد المزامنة', 'info'], synced: ['تمت المزامنة', 'ok'], failed: ['فشلت المزامنة', 'bad'], retry: ['يحتاج إعادة محاولة', 'warn'], closed: ['مغلق', 'org'],
  };
  function status(sec, marks, now, cfg) {
    const f = sec.flow || {}, s = stats(sec, marks), cur = sig(sec, marks);
    const lock = f.lock || {}, sch = f.sched || {}, syn = f.sync || {};
    /* الاعتماد صلاحية مدرب المقرر وحده: متى جُمّدت الدرجات على بصمتها الحالية فهي معتمدة */
    const lockedOk = !!lock.on && lock.sig === cur, approved = lockedOk;
    /* حالة آخر عملية رفع لا تُعتبر إلا إذا كانت للدرجات المعتمدة الحالية نفسها */
    const op = f.op && f.op.id && f.op.sig === cur && lockedOk ? f.op : {};
    let k, why = '';
    if (f.closed && f.closed.at && !(f.corr && f.corr.open)) k = 'closed';
    else if (op.st === 'prepared') { k = 'syncing'; why = 'نُسخت الحزمة وتنتظر المنصة نتيجة الجسر'; }
    else if (op.st === 'unknown') { k = 'retry'; why = 'لم تصل نتيجة العملية. تحقق من حالة رايات قبل أي إعادة إرسال'; }
    else if (op.st === 'partial') { k = 'retry'; why = 'لم تُسجَّل بعض الدرجات في رايات'; }
    else if (op.st === 'failed') { k = 'failed'; why = op.why || 'لم تُسجَّل الدرجات في رايات'; }
    else if (syn.st === 'ok' && syn.sig === cur && lockedOk) k = 'synced';
    else if (syn.st === 'review' && syn.sig === cur && lockedOk) { if (syn.doc && syn.doc.at) { k = 'synced'; why = 'مع حالات موثقة تعذر التحقق منها'; } else { k = 'review'; why = 'المطابقة مع رايات فيها حالات تحتاج مراجعة يدوية'; } }
    else if (lock.on && !lockedOk) { k = 'review'; why = 'تغيرت الدرجات بعد الاعتماد فأُلغيت الجاهزية'; }
    else if (approved && sch.st === 'on' && sch.at) { k = 'sched'; if (now && Date.parse(sch.at) <= now) why = 'حان موعد الرفع'; }
    else if (approved && sch.st === 'paused') { k = 'sched'; why = 'الجدولة موقوفة مؤقتاً'; }
    else if (approved) k = 'ready';
    else if (s.err || s.blocking.length) { k = 'incomplete'; why = s.blocking.length ? s.blocking[0].t : 'توجد درجات غير صحيحة'; }
    else if (!s.elig) { k = 'none'; why = 'لا يوجد متدربون قابلون للرصد'; }
    else if (s.complete) { k = f.changed && f.changed.at ? 'review' : 'complete'; if (k === 'review') why = 'تغيرت الدرجات بعد الاعتماد وتحتاج اعتماداً جديداً'; }
    else if (!s.have) k = 'none';
    else { const overdue = (sch.at && now && Date.parse(sch.at) <= now) || (f.changed && f.changed.at) || (sec.exam && sec.exam.dueAt && now && Date.parse(sec.exam.dueAt) <= now); k = overdue ? 'incomplete' : 'entry'; if (overdue) why = f.changed && f.changed.at ? 'أُلغيت الجاهزية والدرجات ناقصة' : 'حلّ الموعد والدرجات ناقصة'; }
    /* المرحلة الحالية من الثماني */
    let stage;
    if (k === 'closed') stage = 8; else if (k === 'synced') stage = 8; else if (k === 'syncing' || k === 'failed' || k === 'retry') stage = op.st === 'prepared' ? 6 : 7;
    else if (k === 'sched' || k === 'ready') stage = k === 'ready' ? 5 : 6; else if (k === 'review' || k === 'complete') stage = 3;
    else if (k === 'none' && !(sec.exam && sec.exam.date)) stage = 1; else stage = 2;
    return { k, label: ST[k][0], tone: ST[k][1], why, stage, stats: s, sig: cur, lockedOk, approved, op };
  }
  /* حالة كل مرحلة من الثماني: done | cur | wait | bad */
  function stages(sec, marks, now, cfg) {
    const st = status(sec, marks, now, cfg), f = sec.flow || {}, s = st.stats;
    const exam = !!(sec.exam && sec.exam.date), sch = f.sched || {}, op = st.op, syn = f.sync && f.sync.sig === st.sig ? f.sync : {};
    const v = [];
    v.push({ s: exam ? 'done' : s.have ? 'done' : 'cur', t: exam ? `موعد الاختبار ${sec.exam.date}${sec.exam.time ? ' ' + sec.exam.time : ''}` : 'لم يُحدَّد موعد الاختبار' });
    v.push({ s: s.complete ? 'done' : s.err || s.blocking.length ? 'bad' : s.have ? 'cur' : exam ? 'cur' : 'wait', t: `${s.have} من ${s.need} درجة${s.err ? ` • ${s.err} خطأ` : ''}` });
    v.push({ s: st.approved ? 'done' : st.k === 'review' ? 'bad' : s.complete ? 'cur' : 'wait', t: st.approved ? `اعتمدها مدرب المقرر وجُمّدت${f.lock && f.lock.byName ? ' — ' + f.lock.byName : ''}` : st.k === 'review' ? st.why : 'لم يعتمدها مدرب المقرر بعد' });
    v.push({ s: st.approved ? 'done' : s.complete ? 'cur' : 'wait', t: st.approved ? 'الرصد مكتمل ومعتمد' : s.complete ? 'الدرجات مكتملة وتنتظر الاعتماد' : `بقي ${s.left} درجة` });
    v.push({ s: !st.approved ? 'wait' : sch.st === 'on' || sch.st === 'paused' ? 'done' : op.id || syn.st ? 'done' : 'cur', t: sch.st === 'on' ? `مجدول ${sch.at}` : sch.st === 'paused' ? 'موقوف مؤقتاً' : op.id || syn.st ? 'رفع فوري' : 'لم يُحدَّد موعد الرفع' });
    v.push({ s: op.st === 'prepared' ? 'cur' : op.st === 'failed' ? 'bad' : syn.st || op.st === 'ok' || op.st === 'partial' || op.st === 'unknown' ? 'done' : st.approved ? 'cur' : 'wait', t: op.st === 'prepared' ? 'الحزمة جاهزة وتنتظر تشغيل الجسر في رايات' : op.st === 'failed' ? 'فشل التنفيذ' : op.id ? `العملية ${op.id}` : 'لم يُنفَّذ' });
    v.push({ s: st.k === 'synced' || st.k === 'closed' ? 'done' : st.k === 'retry' || st.k === 'failed' || (st.k === 'review' && syn.st === 'review') ? 'bad' : op.st === 'prepared' ? 'wait' : op.id ? 'cur' : 'wait', t: syn.st === 'ok' ? `مطابق لرايات (${syn.okN || 0} متدرباً)` : syn.st === 'review' ? 'حالات تحتاج مراجعة' : st.k === 'retry' ? st.why : 'لم يُتحقق بعد' });
    v.push({ s: st.k === 'closed' ? 'done' : st.k === 'synced' ? 'cur' : 'wait', t: st.k === 'closed' ? `أُغلقت${f.closed.byName ? ' — ' + f.closed.byName : ''}` : 'مفتوحة' });
    return v.map((x, i) => Object.assign({ n: i + 1, name: STAGES[i] }, x));
  }

  /* ---------- موانع الرفع ---------- */
  function blockers(sec, marks, now, cfg, env) {
    const st = status(sec, marks, now, cfg), s = st.stats, f = sec.flow || {}, out = [];
    if (!s.elig) out.push('لا يوجد متدربون قابلون للرصد في الشعبة');
    if (s.left > 0) out.push(`توجد ${s.left} درجة ناقصة`);
    if (s.err) out.push(`توجد درجات تتجاوز الحدود المعتمدة أو غير صحيحة لدى ${s.err} متدرباً`);
    s.issues.filter((x) => x.k === 'dist').forEach((x) => out.push('خطأ في توزيع الدرجات: ' + x.t));
    s.issues.filter((x) => x.k === 'dup' || x.k === 'id' || x.k === 'val').forEach((x) => out.push(x.t));
    if (!(f.lock && f.lock.on)) out.push('لم تُعتمد الدرجات وتُجمَّد بعد');
    else if (!st.lockedOk) out.push('تغيرت الدرجات بعد الاعتماد، ويلزم اعتماد جديد');
    else if (!st.approved) out.push('لم يعتمد رئيس القسم عملية المراجعة');
    const rec = f.sync && f.sync.sig === st.sig && f.sync.idMis; if (rec) out.push(`توجد ${rec} أرقام تدريبية غير متطابقة مع رايات في آخر مطابقة`);
    if (env && env.noRef) out.push('الرقم المرجعي للشعبة غير موجود في رايات حسب آخر قراءة');
    if (env && env.notOwner) out.push('الشعبة غير مسندة إليك');
    if (st.op.st === 'unknown') out.push('عملية سابقة لم تُعرف نتيجتها: تحقق من حالة رايات أولاً');
    if (f.closed && f.closed.at && !(f.corr && f.corr.open)) out.push('عملية الرصد مغلقة. أي تعديل يتطلب إجراء تصحيح موثقاً');
    return out;
  }

  /* ---------- حزمة الجسر ---------- */
  function pkg(snap, opId, mode, at) {
    return { app: 'haader-grades', v: 1, mode: mode || 'push', op: opId, crn: snap.crn, term: snap.term, code: snap.code, name: snap.name, at, sig: snap.sig, comps: snap.comps.map((c) => ({ k: c.k, max: c.max })), rows: snap.rows.map((r) => ({ id: r.id, n: r.name, g: r.g })) };
  }
  function parseResult(text) {
    let j; try { j = JSON.parse(String(text).trim()); } catch (e) { return null; }
    if (!j || j.app !== 'haader-grades-result' || !j.crn) return null;
    return j;
  }

  /* ---------- المطابقة العكسية بين حاضر ورايات ---------- */
  const RC = { ok: 'مطابق بالكامل', diff: 'الدرجة غير متطابقة', missing: 'لم تصل الدرجة إلى رايات', nostudent: 'المتدرب غير موجود', idmis: 'اختلاف في الرقم التدريبي', unverified: 'تعذر التحقق', manual: 'يحتاج مراجعة يدوية' };
  function reconcile(snap, res) {
    const rows = [], rr = (res && res.roster) || {}, rc = {}; ((res && res.comps) || []).forEach((c) => { rc[c.k] = c; });
    const head = [];
    if (!res || res.status === 'error') head.push('تعذرت قراءة رايات' + (res && res.error ? ': ' + res.error : ''));
    if (res && res.status === 'nosection') head.push(`الرقم المرجعي ${snap.crn} غير موجود في مقررات المدرب في رايات`);
    if (res && String(res.crn) !== String(snap.crn)) head.push(`النتيجة لشعبة أخرى (${res.crn})`);
    const subj = res && res.sec ? normName(`${res.sec.subject || ''} ${res.sec.courseNumber || ''}`) : '';
    if (subj && snap.code && subj !== normName(snap.code)) head.push(`رمز المقرر في رايات «${res.sec.subject} ${res.sec.courseNumber}» يخالف «${snap.code}»`);
    const distBad = [];
    snap.comps.forEach((c) => { const x = rc[c.k]; if (!x) distBad.push(`المكوّن ${c.k} غير موجود في رايات`); else if (Number(x.max) !== Number(c.max)) distBad.push(`الحد الأعلى للمكوّن ${c.k} في رايات ${x.max} وفي حاضر ${c.max}`); });
    Object.keys(rc).forEach((k) => { if (!snap.comps.some((c) => c.k === k)) distBad.push(`المكوّن ${k} موجود في رايات وغير موجود في حاضر`); });
    const byName = {}; Object.keys(rr).forEach((id) => { byName[normName(rr[id].n)] = id; });
    const fatal = head.length > 0;
    snap.rows.forEach((r) => {
      const o = { id: r.id, name: r.name, g: r.g, total: r.total, r: null, rTotal: null, st: 'ok', why: [] };
      if (fatal) { o.st = 'unverified'; o.why.push(head[0]); rows.push(o); return; }
      const x = rr[r.id];
      if (!x) {
        const other = byName[normName(r.name)];
        if (other) { o.st = 'idmis'; o.why.push(`الاسم نفسه مسجل في رايات بالرقم ${other}`); o.rid = other; }
        else { o.st = 'nostudent'; o.why.push('غير موجود في كشف المكونات في رايات (غير مسجل أو غير قابل للرصد)'); }
        rows.push(o); return;
      }
      o.r = {}; let t = 0, n = 0, st = 'ok';
      snap.comps.forEach((c) => {
        const have = x.g ? x.g[c.k] : undefined, want = r.g[c.k];
        o.r[c.k] = have === undefined ? null : have;
        if (isNum(have)) { t += have; n++; }
        if (have === undefined || (x.e && x.e[c.k])) { if (st === 'ok') st = 'unverified'; o.why.push(`${c.k}: تعذرت قراءته من رايات`); }
        else if (!isNum(want)) { if (isNum(have)) { st = st === 'ok' || st === 'unverified' ? 'manual' : st; o.why.push(`${c.k}: في رايات ${fmt(have)} وفي حاضر فارغ`); } }
        else if (have === null) { if (st !== 'diff') st = 'missing'; o.why.push(`${c.k}: ${fmt(want)} لم تصل إلى رايات`); }
        else if (round2(Number(have)) !== round2(want)) { st = 'diff'; o.why.push(`${c.k}: في حاضر ${fmt(want)} وفي رايات ${fmt(have)}`); }
      });
      o.rTotal = n ? round2(t) : null;
      if (st === 'ok' && o.total !== null && o.rTotal !== null && round2(o.total) !== round2(o.rTotal)) { st = 'diff'; o.why.push(`المجموع في حاضر ${fmt(o.total)} وفي رايات ${fmt(o.rTotal)}`); }
      if (st === 'ok' && normName(x.n) !== normName(r.name)) { st = 'manual'; o.why.push(`الاسم في رايات «${x.n}»`); }
      o.rName = x.n; o.st = st; rows.push(o);
    });
    /* مسجلون في مكونات رايات وغير موجودين في النسخة */
    const extra = fatal ? [] : Object.keys(rr).filter((id) => !snap.rows.some((r) => r.id === id) && !rows.some((r) => r.rid === id)).map((id) => ({ id, name: rr[id].n, g: null, total: null, r: rr[id].g || {}, rTotal: null, st: 'manual', why: ['قابل للرصد في رايات وغير موجود ضمن القابلين للرصد في حاضر'], extra: true }));
    const all = rows.concat(extra), sum = {}; Object.keys(RC).forEach((k) => { sum[k] = all.filter((r) => r.st === k).length; });
    return { rows: all, sum, head, distBad, ok: !fatal && !distBad.length && all.length > 0 && all.every((r) => r.st === 'ok'), okN: sum.ok, total: all.length };
  }

  /* ---------- مقارنة توزيع/قائمة مستوردة بما في المنصة ---------- */
  function diffSection(old, neu) {
    const ch = [];
    if (!old) return [{ t: 'new', text: `شعبة جديدة ${neu.crn} — ${neu.name}` }];
    const oc = {}; comps(old).forEach((c) => { oc[c.k] = c; });
    comps(neu).forEach((c) => { const p = oc[c.k]; if (!p) ch.push({ t: 'comp+', k: c.k, text: `مكوّن جديد ${c.k} بحد أعلى ${fmt(c.max)}` }); else { if (Number(p.max) !== Number(c.max)) ch.push({ t: 'max', k: c.k, from: p.max, to: c.max, text: `الحد الأعلى للمكوّن ${c.k}: ${fmt(p.max)} ← ${fmt(c.max)}` }); if ((p.part || '') !== (c.part || '')) ch.push({ t: 'part', k: c.k, text: `جزء المكوّن ${c.k}: ${p.part || '—'} ← ${c.part || '—'}` }); if ((p.due || '') !== (c.due || '')) ch.push({ t: 'due', k: c.k, text: `موعد ${c.k}: ${p.due || '—'} ← ${c.due || '—'}` }); } delete oc[c.k]; });
    Object.keys(oc).forEach((k) => ch.push({ t: 'comp-', k, text: `المكوّن ${k} لم يعد في التوزيع` }));
    const or = {}; (old.rows || []).forEach((r) => { or[r.id] = r; });
    (neu.rows || []).forEach((r) => { const p = or[r.id]; if (!p) ch.push({ t: 'row+', id: r.id, text: `متدرب جديد: ${r.name} (${r.id})${r.el ? '' : ' — غير قابل للرصد'}` }); else { if (!!p.el !== !!r.el) ch.push({ t: 'el', id: r.id, to: !!r.el, text: `${r.name}: ${r.el ? 'أصبح قابلاً للرصد' : 'لم يعد قابلاً للرصد'} (${r.st || ''})` }); else if ((p.st || '') !== (r.st || '')) ch.push({ t: 'st', id: r.id, text: `${r.name}: حالة القيد ${p.st || '—'} ← ${r.st || '—'}` }); if (normName(p.name) !== normName(r.name)) ch.push({ t: 'name', id: r.id, text: `تغيّر الاسم: ${p.name} ← ${r.name}` }); } delete or[r.id]; });
    Object.keys(or).forEach((id) => ch.push({ t: 'row-', id, text: `لم يعد في الملف: ${or[id].name} (${id})` }));
    return ch;
  }
  /* درجات محفوظة تتأثر بتغييرات الاستيراد (تحتاج موافقة صريحة) */
  function impact(old, marks, changes) {
    const hit = [], g = (marks && marks.g) || {}, has = (id, k) => g[id] && g[id][k] !== null && g[id][k] !== undefined;
    changes.forEach((c) => {
      if (c.t === 'max') (old.rows || []).forEach((r) => { if (has(r.id, c.k) && g[r.id][c.k] > c.to) hit.push(`${r.name}: ${c.k} = ${fmt(g[r.id][c.k])} تتجاوز الحد الجديد ${fmt(c.to)}`); });
      if (c.t === 'comp-') { const n = (old.rows || []).filter((r) => has(r.id, c.k)).length; if (n) hit.push(`${n} درجة مسجلة في المكوّن ${c.k} الذي لم يعد في التوزيع`); }
      if (c.t === 'row-' || (c.t === 'el' && !c.to)) { const ks = Object.keys(g[c.id] || {}).filter((k) => has(c.id, k)); if (ks.length) { const r = (old.rows || []).find((x) => x.id === c.id); hit.push(`${r ? r.name : c.id}: له ${ks.length} درجة مسجلة`); } }
    });
    return hit;
  }

  return { DEC, fmt, isNum, round2, normName, comps, compBy, parts, total, eligible, val, check, storedBad, rowState, ROW_ST, issues, stats, sig, cyrb, snapshot, snapSig, snapMarks, STAGES, ST, status, stages, blockers, pkg, parseResult, RC, reconcile, diffSection, impact };
})();
