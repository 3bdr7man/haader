/* ====================================================================
   الدرجات من مصنف Excel بصيغة «توزيع الدرجات وكشوف الرصد» (نسخة المدرب)
   - يقرأ صيغتين: ملف رايات «درجات المقررات والشعب»، ومصنف المدرب الذي فيه
     «الشعبة» و«المكوّن» و«شعبة الرصد» وبنود تفصيلية لأعمال السنة.
   - البنود التفصيلية (الواجبات، المشاركة، الشهري 1، الشهري 2) تُقرأ من عناوين
     أعمدة كشف الشعبة «اسم البند (الحد)»، وكل بند يتبع أول عمود مكوّن بعده
     (LEC1 أو LAB1). مجموع حدود البنود يجب أن يساوي حد المكوّن المعتمد.
   - درجة المكوّن المرفوعة إلى رايات = مجموع بنوده (أو قيمة عمود المكوّن إن
     لم تكن له بنود). كل بند يُتحقق منه: رقم، غير سالب، لا يتجاوز حده، خانتان.
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const WEB = !!window.HAADER_WEB;
  const norm = (s) => String(s == null ? '' : s).replace(/[ً-ْـ]/g, '').replace(/\s+/g, ' ').trim();
  const cellOf = (v) => (v === null || v === undefined ? '' : String(v).trim());
  const hidx = (hdr, names) => { const h = hdr.map(norm); for (const n of names) { const i = h.indexOf(norm(n)); if (i >= 0) return i; } return -1; };
  const findHdr = (aoa, groups) => { for (let i = 0; i < Math.min(aoa.length, 40); i++) { const r = (aoa[i] || []); if (groups.every((g) => hidx(r, g) >= 0)) return i; } return -1; };
  const COMP_RE = /^([A-Za-z]{2,6}\d{1,2})(?:\s|\(|$)/;
  const ITEM_RE = /^(.+?)\s*\(\s*(\d+(?:\.\d+)?)\s*\)\s*$/;
  const NOT_ITEM = new Set(['النظري', 'العملي', 'المجموع', 'النسبة', 'الجزء النظري', 'الجزء العملي']);
  const isEmpty = (v) => v === null || v === undefined || cellOf(v) === '' || /^[—–-]+$/.test(cellOf(v));
  const r2 = (v) => Math.round(v * 100) / 100;

  /* أعمدة كشف الشعبة: المكوّنات والبنود التابعة لها */
  function sheetLayout(hdr, sec) {
    const comps = {}, items = [];
    hdr.forEach((h0, j) => {
      const h = norm(h0); if (!h) return;
      const m = COMP_RE.exec(h);
      if (m && G.compBy(sec, m[1].toUpperCase())) { comps[m[1].toUpperCase()] = j; return; }
      const it = ITEM_RE.exec(h);
      if (it && !NOT_ITEM.has(norm(it[1])) && !/^(مجموع|المجموع|الجزء|النظري|العملي|نظري|عملي|النسبة|التقدير|الحالة)/.test(norm(it[1])) && !COMP_RE.test(h)) items.push({ j, n: norm(it[1]), max: Number(it[2]) });
    });
    const compCols = Object.entries(comps).sort((a, b) => a[1] - b[1]);
    const byComp = {};
    items.forEach((it) => { const c = compCols.find(([, j]) => j > it.j); if (c) (byComp[c[0]] = byComp[c[0]] || []).push(it); });
    return { comps, byComp };
  }

  /* قراءة المصنف بصيغتيه */
  function parseBook(X, wb) {
    const out = { secs: {}, errs: [], meta: {} }, sheets = {};
    wb.SheetNames.forEach((n) => { sheets[n] = X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }); });
    const first = Object.values(sheets)[0] || [], h0 = cellOf((first[0] || [])[0]);
    out.meta.termCode = (h0.match(/\((\d{6})\)/) || [])[1] || '';
    Object.values(sheets).forEach((a) => a.forEach((r) => { const t = cellOf((r || [])[0]); if (t.startsWith('المصدر:')) { out.meta.source = t.replace(/^المصدر:\s*/, ''); out.meta.extracted = (t.match(/تاريخ الاستخراج:\s*([^\s]+)/) || [])[1] || ''; } if (t.startsWith('ملاحظة:')) out.meta.note = t.replace(/^ملاحظة:\s*/, ''); }));
    const CRN = ['الرقم المرجعي', 'الشعبة', 'شعبة الرصد', 'رقم الشعبة'], COMP = ['رمز المكون', 'المكوّن', 'المكون'], MAX = ['الدرجة القصوى'];
    /* توزيع الدرجات */
    const dn = wb.SheetNames.find((n) => findHdr(sheets[n], [CRN, COMP, MAX]) >= 0);
    if (!dn) { out.errs.push('لم أجد ورقة توزيع الدرجات (أعمدة: الشعبة، المكوّن، الدرجة القصوى).'); return out; }
    const da = sheets[dn], dh = findHdr(da, [CRN, COMP, MAX]), dc = da[dh], c = (names) => hidx(dc, names);
    const ci = { crn: c(CRN), k: c(COMP), max: c(MAX), code: c(['رمز المقرر']), name: c(['اسم المقرر']), desc: c(['وصف المكون', 'وصف المكوّن']), part: c(['الجزء']), must: c(['يجب الاجتياز']), due: c(['آخر موعد للرصد']), scale: c(['نموذج التوزيع في رايات']) };
    for (let i = dh + 1; i < da.length; i++) {
      const r = da[i] || [], crn = cellOf(r[ci.crn]).replace(/\.0$/, ''), k = cellOf(r[ci.k]).toUpperCase();
      if (!/^\d{4,6}$/.test(crn) || !k) continue;
      const max = r[ci.max], s = out.secs[crn] || (out.secs[crn] = { crn, code: cellOf(r[ci.code]), name: cellOf(r[ci.name]), term: '', termCode: out.meta.termCode, hours: null, comps: [], rows: [], grades: {}, sub: {}, items: {}, sheet: '' });
      if (typeof max !== 'number' || !(max > 0)) { out.errs.push(`الشعبة ${crn}: الدرجة القصوى للمكوّن ${k} غير رقمية.`); continue; }
      if (s.comps.some((x) => x.k === k)) { out.errs.push(`الشعبة ${crn}: المكوّن ${k} مكرر في التوزيع.`); continue; }
      const g = (j) => (j >= 0 ? cellOf(r[j]) : '');
      s.comps.push({ k, desc: g(ci.desc), part: g(ci.part), max, mustPass: g(ci.must), due: g(ci.due), scale: g(ci.scale) });
    }
    /* بيانات المقررات */
    const cn = wb.SheetNames.find((n) => n !== dn && findHdr(sheets[n], [['رمز المقرر'], ['رقم الشعبة', 'شعبة الرصد']]) >= 0);
    if (cn) {
      const ca = sheets[cn], ch = findHdr(ca, [['رمز المقرر'], ['رقم الشعبة', 'شعبة الرصد']]), cc = ca[ch], x = (names) => hidx(cc, names);
      const cx = { crn: x(['رقم الشعبة', 'شعبة الرصد']), code: x(['رمز المقرر']), name: x(['اسم المقرر']), hours: x(['الساعات المعتمدة']), term: x(['الفصل التدريبي']), pair: x(['الشعبة العملية المرتبطة']) };
      for (let i = ch + 1; i < ca.length; i++) {
        const r = ca[i] || [], s = out.secs[cellOf(r[cx.crn]).replace(/\.0$/, '')]; if (!s) continue;
        if (cx.code >= 0) s.code = cellOf(r[cx.code]) || s.code; if (cx.name >= 0) s.name = cellOf(r[cx.name]) || s.name;
        if (cx.hours >= 0) { const h = r[cx.hours]; s.hours = typeof h === 'number' ? h : Number(h) || null; }
        if (cx.term >= 0) s.term = cellOf(r[cx.term]);
        if (cx.pair >= 0) { const p = cellOf(r[cx.pair]).replace(/\.0$/, ''); if (/^\d{4,6}$/.test(p)) s.pair = p; }
      }
    }
    { let t = null; Object.values(sheets).some((a) => a.slice(0, 4).some((r) => (r || []).some((v) => { const m = cellOf(v).match(/الفصل التدريبي\s+[^—–\-()]*?\d{4}\s*هـ?/); if (m) t = m[0].trim(); return !!t; })));
      if (t) Object.values(out.secs).forEach((s) => { if (!s.term) s.term = t; }); }
    /* أوراق الشعب */
    wb.SheetNames.forEach((n) => {
      const a = sheets[n], hi = findHdr(a, [['اسم المتدرب'], ['الرقم التدريبي']]); if (hi < 0) return;
      let crn = (n.match(/(\d{5,6})/) || [])[1];
      if (!crn || !out.secs[crn]) a.slice(0, hi).forEach((r) => (r || []).forEach((v, j) => { const t = cellOf(v); if (t === 'الرقم المرجعي للشعبة') crn = cellOf((r.slice(j + 1).find((y) => y !== null))); const m = t.match(/(?:الشعبة|شعبة الرصد)[^\d]*(\d{5,6})/); if (m && !out.secs[crn]) crn = m[1]; }));
      const s = out.secs[crn]; if (!s) { out.errs.push(`الورقة «${n}»: لا يوجد لها توزيع درجات.`); return; }
      const hc = a[hi], ix = (names) => hidx(hc, names); s.sheet = n;
      const L = sheetLayout(hc, s);
      s.comps.forEach((cp) => { if (L.comps[cp.k] === undefined && !L.byComp[cp.k]) out.errs.push(`الورقة «${n}»: لا يوجد عمود للمكوّن ${cp.k}.`); });
      Object.entries(L.byComp).forEach(([k, its]) => {
        const cp = G.compBy(s, k), sum = r2(its.reduce((t, x) => t + x.max, 0));
        if (sum !== cp.max) { out.errs.push(`الشعبة ${crn}: مجموع حدود بنود ${k} (${sum}) لا يساوي الحد المعتمد (${cp.max})، فلم تُعتمد البنود.`); delete L.byComp[k]; return; }
        s.items[k] = its.map((x) => ({ n: x.n, max: x.max }));
      });
      const idc = ix(['الرقم التدريبي']), nc = ix(['اسم المتدرب']), stc = ix(['حالة القيد في رايات', 'حالة القيد']), elc = ix(['قابل للرصد']), hrc = ix(['ساعات الحضور (رايات)']), lc = ix(['آخر حضور (رايات)']);
      for (let i = hi + 1; i < a.length; i++) {
        const r = a[i] || [], id = cellOf(r[idc]).replace(/\.0$/, ''), name = cellOf(r[nc]);
        if (!id && !name) { if (s.rows.length) break; continue; }
        if (!/^\d{6,12}$/.test(id)) { if (s.rows.length && (!id || !name)) break; if (/^\d+(\.\d+)?$/.test(name) || /الحد/.test(name)) continue; out.errs.push(`الورقة «${n}» الصف ${i + 1}: رقم تدريبي غير صحيح «${id}».`); continue; }
        if (s.rows.some((x) => x.id === id)) { out.errs.push(`الشعبة ${crn}: الرقم التدريبي ${id} مكرر في الملف.`); continue; }
        const el = cellOf(r[elc]), hrs = hrc >= 0 ? r[hrc] : null;
        s.rows.push({ id, name, st: stc >= 0 ? cellOf(r[stc]) : '', el: el === 'نعم', hrs: typeof hrs === 'number' ? hrs : null, last: lc >= 0 ? cellOf(r[lc]) : '' });
        s.comps.forEach((cp) => {
          const its = L.byComp[cp.k];
          if (its) {
            const vals = its.map((x) => [x, r[x.j]]), filled = vals.filter(([, v]) => !isEmpty(v));
            if (!filled.length) return;
            (s.sub[id] = s.sub[id] || {})[cp.k] = {};
            vals.forEach(([x, v]) => { if (!isEmpty(v)) s.sub[id][cp.k][x.n] = v; });
            return;
          }
          const j = L.comps[cp.k]; if (j === undefined) return;
          const v = r[j]; if (!isEmpty(v)) (s.grades[id] = s.grades[id] || {})[cp.k] = v;
        });
      }
    });
    Object.values(out.secs).forEach((s) => { if (!s.rows.length) out.errs.push(`الشعبة ${s.crn}: لا توجد لها ورقة متدربين في الملف.`); });
    return out;
  }

  /* درجة المكوّن من بنوده: كل بند يُتحقق منه، والمكوّن = المجموع عند اكتمال البنود */
  const AR = { '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9', '٫': '.' };
  function compFromItems(its, k, subVals) {
    const bad = [], v = {};
    its.forEach((it) => {
      const raw = subVals[it.n];
      if (isEmpty(raw)) return;
      const t = typeof raw === 'number' ? String(raw) : cellOf(raw).replace(/[٠-٩٫]/g, (ch) => AR[ch]);
      if (!/^\d+(\.\d+)?$/.test(t)) { bad.push(`${it.n} في ${k}: «${cellOf(raw).slice(0, 12)}» ليست رقماً`); return; }
      const n = Number(t);
      if (n > it.max) { bad.push(`${it.n} في ${k}: ${n} تتجاوز حد البند ${it.max}`); return; }
      if ((t.split('.')[1] || '').length > 2) { bad.push(`${it.n} في ${k}: أكثر من خانتين عشريتين`); return; }
      v[it.n] = n;
    });
    const miss = its.filter((it) => !(it.n in v)).map((it) => it.n);
    return { v, bad, miss, total: miss.length || bad.length ? null : r2(its.reduce((t, it) => t + v[it.n], 0)) };
  }
  const subOf = (crn) => ((A.raw.gmarks[crn] || {}).s) || {};

  /* ---------- خلفية الحفظ ----------
     نسخة الويب: دوال الخادم (grades_import وgrades_import_undo وgrades_imports) تتحقق وتحفظ وتسجّل.
     نسخة Claude: المنطق نفسه في الصفحة، والحفظ عبر gSetGrades (بسجله وحارس الاعتماد)، وسجل العمليات
     في مجموعة gimp داخل قاعدة بيانات المنصة، لتبقى النسختان بالسلوك والرسائل نفسها. */
  const LB = (() => {
    const isoNow = () => new Date().toISOString();
    const rid = (crn) => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `GI${String(d.getUTCFullYear()).slice(2)}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}-${crn}-${Math.random().toString(16).slice(2, 6)}`; };
    const fail = (m) => { throw new Error(m); };
    async function imp(a) {
      const crn = a.p_crn, sec = A.raw.gsec[crn], wb = a.p_wb || {}, me = A.me.id;
      if (!gMay(crn)) fail(`الشعبة ${crn} غير مسندة إليك، فلا تُستورد درجاتها.`);
      if (!sec) fail('الشعبة غير موجودة في قاعدة بيانات الدرجات.');
      const gate = gGate(crn); if (gate) fail(gate);
      if (wb.id) {
        if ((wb.term || '') !== (sec.term || '')) fail(`هذا المصنف للفصل «${wb.term}» والشعبة ${crn} مسجلة في «${sec.term}». نزّل نموذجاً جديداً من المنصة.`);
        if ((wb.trainer || '') !== me) fail('هذا المصنف أُنشئ لحساب مدرب آخر، فلا تُستورد منه درجات بحسابك.');
        if (!(wb.crns || []).includes(crn)) fail(`الشعبة ${crn} ليست ضمن شعب هذا المصنف.`);
      }
      const marks = gMarks(crn), oldS = subOf(crn), bad = [], vals = [], subsOld = {}, subsNew = {};
      const rowOf = (id) => sec.rows.find((r) => r.id === id);
      Object.entries(a.p_items || {}).forEach(([tid, kv]) => {
        const row = rowOf(tid);
        if (!row) { bad.push({ id: tid, msg: `الرقم التدريبي ${tid} غير موجود في الشعبة ${crn}.` }); return; }
        if (!row.el) { bad.push({ id: tid, msg: `${row.name}: غير قابل للرصد (${row.st || ''})، فلم تُستورد درجاته.` }); return; }
        Object.entries(kv).forEach(([k, sv]) => {
          const its = (sec.items || {})[k], cp = G.compBy(sec, k);
          if (!its) { bad.push({ id: tid, k, msg: `${row.name}: المكوّن ${k} بلا بنود في التوزيع المعتمد.` }); return; }
          if (!cp) { bad.push({ id: tid, k, msg: `المكوّن ${k} غير معتمد في توزيع الشعبة ${crn}.` }); return; }
          if (r2(its.reduce((t, x) => t + x.max, 0)) !== cp.max) { bad.push({ id: tid, k, msg: `مجموع حدود بنود ${k} لا يساوي حدها المعتمد ${cp.max}.` }); return; }
          const x = compFromItems(its, k, sv);
          if (x.bad.length) { x.bad.forEach((b) => bad.push({ id: tid, k, msg: `${row.name}: ${b}` })); return; }
          if (!Object.keys(x.v).length) return;
          (subsOld[tid] = subsOld[tid] || {})[k] = ((oldS[tid] || {})[k]) || null;
          (subsNew[tid] = subsNew[tid] || {})[k] = x.v;
          if (x.total === null) bad.push({ id: tid, k, msg: `${row.name}: بنود ${k} ناقصة (${its.length - x.miss.length} من ${its.length})، فحُفظت البنود ولم تُحسب درجة ${k}.` });
          else vals.push({ id: tid, k, v: x.total });
        });
      });
      (a.p_rows || []).forEach((r) => { if ((sec.items || {})[r.k]) bad.push({ id: r.id, k: r.k, msg: `درجة ${r.k} تُحسب من بنودها، فلا تُستورد مباشرة.` }); else vals.push(r); });
      const seen = {}, list = [], changes = []; let nAdd = 0, nChg = 0, nSame = 0, nKept = 0;
      vals.forEach((r) => {
        if (isEmpty(r.v)) return;
        const key = r.id + '|' + r.k; if (seen[key]) { bad.push({ id: r.id, k: r.k, msg: `الرقم التدريبي ${r.id} مكرر في المكوّن ${r.k}.` }); return; } seen[key] = 1;
        const row = rowOf(r.id);
        if (!row) { bad.push({ id: r.id, k: r.k, msg: `الرقم التدريبي ${r.id} غير موجود في الشعبة ${crn}.` }); return; }
        if (!row.el) { bad.push({ id: r.id, k: r.k, msg: `${row.name}: غير قابل للرصد (${row.st || ''}).` }); return; }
        const c = G.check(sec, r.k, r.v);
        if (!c.ok) { bad.push({ id: r.id, k: r.k, msg: `${row.name}: ${c.msg}` }); return; }
        const old = G.val(marks, r.id, r.k);
        if (old !== null && old === c.v) { nSame++; return; }
        if (old !== null && !a.p_overwrite) { nKept++; return; }
        if (old === null) nAdd++; else nChg++;
        changes.push([r.id, r.k, old, c.v]); list.push({ id: r.id, k: r.k, raw: c.v });
      });
      const out = { id: null, add: 0, chg: 0, same: nSame, kept: nKept, bad, changes: [], s: {} };
      if (!list.length && !Object.keys(subsNew).length) return out;
      const id = rid(crn), at = isoNow();
      if (list.length) {
        const res = gSetGrades(crn, list, 'استيراد Excel ' + id);
        if (res.gate) fail(res.gate);
        res.bad.forEach((b) => { bad.push({ id: b.id, k: b.k, msg: b.msg }); const i = changes.findIndex((c) => c[0] === b.id && c[1] === b.k); if (i >= 0) { if (changes[i][2] === null) nAdd--; else nChg--; changes.splice(i, 1); } });
      }
      if (Object.keys(subsNew).length) {
        A.raw.gmarks[crn] = merge(clone(A.raw.gmarks[crn] || { g: {}, t: {} }), { s: clone(subsNew) });
        enqueue('gmarks/' + crn, { s: subsNew });
      }
      gPutDoc('gimp', id, { id, crn, at, by: A.me.id, byName: A.me.name || '', file: String(a.p_file || '').slice(0, 200), wb: a.p_wb || {}, overwrite: !!a.p_overwrite, add: nAdd, chg: nChg, same: nSame, kept: nKept, nbad: bad.length, changes, subs: subsOld, subsNew, bad: bad.slice(0, 300), status: 'done' });
      return { id, add: nAdd, chg: nChg, same: nSame, kept: nKept, bad, changes, s: subsNew, at, by: A.me.id };
    }
    async function undo(id) {
      const gi = (A.raw.gimp || {})[id]; if (!gi) fail('عملية الاستيراد غير موجودة.');
      if (!gMay(gi.crn)) fail(`لا يملك هذا الحساب التراجع عن استيراد الشعبة ${gi.crn}.`);
      if (gi.status === 'undone') fail('تم التراجع عن هذه العملية من قبل.');
      const gate = gGate(gi.crn); if (gate) fail(gate);
      const marks = gMarks(gi.crn), S = subOf(gi.crn), done = [], skip = [], list = [], ps = {};
      (gi.changes || []).forEach(([tid, k, oldV, newV]) => {
        const cur = G.val(marks, tid, k);
        if (cur !== newV) { skip.push([tid, k, cur, newV]); return; }
        list.push({ id: tid, k, raw: oldV === null || oldV === undefined ? null : oldV }); done.push([tid, k, newV, oldV === undefined ? null : oldV]);
      });
      Object.entries(gi.subs || {}).forEach(([tid, kv]) => Object.entries(kv).forEach(([k, ov]) => {
        if (JSON.stringify((S[tid] || {})[k] || null) !== JSON.stringify(((gi.subsNew || {})[tid] || {})[k] || null)) return;
        (ps[tid] = ps[tid] || {})[k] = ov === undefined ? null : ov;
      }));
      if (list.length) { const r = gSetGrades(gi.crn, list, 'تراجع عن ' + id); if (r.gate) fail(r.gate); }
      if (Object.keys(ps).length) { A.raw.gmarks[gi.crn] = merge(clone(A.raw.gmarks[gi.crn] || { g: {}, t: {} }), { s: clone(ps) }); enqueue('gmarks/' + gi.crn, { s: ps }); }
      const at = isoNow();
      A.raw.gimp[id] = Object.assign(clone(gi), { status: 'undone', undoneAt: at, undoneBy: A.me.name || A.me.id, undoSkip: skip });
      enqueue('gimp/' + id, { status: 'undone', undoneAt: at, undoneBy: A.me.name || A.me.id, undoSkip: skip });
      return { id, restored: done, skipped: skip, s: ps, at };
    }
    async function list(crn) {
      return Object.values(A.raw.gimp || {}).filter((x) => x.crn === crn).sort((a, b) => String(b.at).localeCompare(String(a.at)))
        .map((x) => ({ id: x.id, at: x.at, by: x.byName, file: x.file, overwrite: x.overwrite, add: x.add, chg: x.chg, same: x.same, kept: x.kept, bad: x.nbad || 0, status: x.status, undone_at: x.undoneAt || null, undone_by: x.undoneBy || null, changes: x.changes || [], skip: x.undoSkip || [], wb: x.wb || {} }));
    }
    return { imp, undo, list, sync: () => {} };
  })();
  const BK = WEB
    ? { imp: (a) => window.HAADER_WEB.rpc('grades_import', a), list: (crn) => window.HAADER_WEB.rpc('grades_imports', { p_crn: crn }), undo: (id) => window.HAADER_WEB.rpc('grades_import_undo', { p_id: id }), sync: () => { try { window.HAADER_WEB.bump('gmarks'); } catch (e) { /* التحديث الدوري يكمل */ } } }
    : LB;
  if (!WEB) {
    A.raw.gimp = A.raw.gimp || {};
    const o = boot; boot = async function () { await o(); if (typeof db !== 'undefined' && db) try { gWatch('gimp'); } catch (e) { /* سجل الاستيراد يبقى محلياً حتى التحميل التالي */ } };
  }

  /* استيراد التوزيع: كما هو، مع حفظ البنود التفصيلية في الشعبة */
  gParseBook = parseBook;
  const baseDistApply = gDistApply;
  gDistApply = function () {
    const plan = A.gPlan; if (!plan || !isAdmin()) return baseDistApply();
    const items = {}, pairs = {};
    plan.items.forEach((x) => { if (x.busy) return; items[x.crn] = x.neu.items || {}; if (x.neu.pair) pairs[x.crn] = x.neu.pair; });
    const r = baseDistApply();
    if (A.gPlan) return r;   // لم يُعتمد (موافقة ناقصة)
    Object.keys(items).forEach((crn) => { if (!A.raw.gsec[crn]) return; const patch = { items: items[crn] }; if (pairs[crn]) patch.pair = pairs[crn]; gPatch(crn, patch); });
    return r;
  };
  ACT['g-dist-ok'] = () => gDistApply();

  /* ---------- معرّف المصنف (الورقة الخفية _haader) ---------- */
  const readMeta = (X, wb) => {
    if (!wb.SheetNames.includes('_haader')) return null;
    const a = X.utils.sheet_to_json(wb.Sheets._haader, { header: 1, raw: true, defval: null });
    try { const m = JSON.parse(cellOf((a[1] || [])[0])); return m && m.app === 'haader-grades' ? m : null; } catch (e) { return null; }
  };
  const fileTerm = (a, hi) => { let t = ''; a.slice(0, hi).forEach((r) => (r || []).forEach((v) => { const m = cellOf(v).match(/الفصل التدريبي\s+[^—–•\-()]*?1[34]\d{2}\s*هـ?/); if (m && !t) t = m[0].trim(); })); return t; };
  const tnorm = (t) => norm(t).replace(/\s*هـ$/, '').replace(/\s+/g, ' ');
  function metaCheck(meta, sec, a, hi) {
    if (meta) {
      if (meta.trainer !== A.me.id) return { block: `هذا المصنف أُنشئ لحساب «${meta.trainerName || meta.trainer}»، فلا تُستورد منه درجات بحسابك. نزّل نموذجك من المنصة.` };
      if (tnorm(meta.term) !== tnorm(sec.term)) return { block: `هذا المصنف للفصل «${meta.term || 'غير محدد'}» والشعبة مسجلة في «${sec.term || 'غير محدد'}». لا يُرفع مصنف فصل تدريبي آخر.` };
      if (!(meta.crns || []).includes(sec.crn)) return { block: `الشعبة ${sec.crn} ليست ضمن شعب هذا المصنف.` };
      const sig = window.HAADER_GX ? window.HAADER_GX.secSig(sec) : '';
      if (sig && meta.sigs && meta.sigs[sec.crn] && meta.sigs[sec.crn] !== sig) return { warn: `تغيّرت قائمة الشعبة ${sec.crn} أو توزيعها بعد تنزيل هذا المصنف. تُطابق الدرجات بالرقم التدريبي، والأفضل تنزيل نموذج جديد.` };
      return {};
    }
    const ft = fileTerm(a, hi);
    if (ft && sec.term && !tnorm(ft).includes(tnorm(sec.term).replace(/^الفصل التدريبي\s*/, '')) && !tnorm(sec.term).includes(tnorm(ft).replace(/^الفصل التدريبي\s*/, ''))) return { block: `الملف للفصل «${ft}» والشعبة مسجلة في «${sec.term}». لا يُرفع ملف فصل تدريبي آخر.` };
    return { warn: 'الملف بلا معرّف من منصة حاضر (ملف قديم أو من خارج المنصة). تأكد أنه للفصل الحالي، والأفضل استخدام «تحميل نموذج إدخال الدرجات Excel».' };
  }

  /* ---------- قراءة المصنف ومعاينته (لا يُحفظ شيء هنا) ---------- */
  gGradesImport = async function (file, only, opts) {
    opts = opts || {};
    let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
    const wb = X.read(await file.arrayBuffer(), { type: 'array' }), meta = readMeta(X, wb), plan = { file: file.name, items: [], skip: [], meta, over: !!opts.over, only: only || null };
    if (meta && meta.trainer !== A.me.id) { modal(`<h2>لا شيء للاستيراد</h2><div class="gnote bad">هذا المصنف أُنشئ لحساب «${esc(meta.trainerName || meta.trainer)}»، فلا تُستورد منه درجات بحسابك. نزّل نموذجك من «تحميل نموذج إدخال الدرجات Excel».</div><button class="btn" data-act="modal-close">إغلاق</button>`); return; }
    const sheets = wb.SheetNames.filter((n) => n !== '_haader').map((n) => [n, X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null })]).map(([n, a]) => [n, a, findHdr(a, [['اسم المتدرب'], ['الرقم التدريبي']])]).filter((x) => x[2] >= 0);
    const crnOf = (n, a, hi) => { const m = n.match(/(\d{5,6})/); if (m && A.raw.gsec[m[1]]) return m[1]; let c = ''; a.slice(0, hi).forEach((r) => (r || []).forEach((v, j) => { const t = cellOf(v); if (t === 'الرقم المرجعي للشعبة') c = cellOf((r.slice(j + 1).find((y) => y !== null))); const mm = t.match(/الشعبة\s+(\d{5,6})/); if (!c && mm && A.raw.gsec[mm[1]]) c = mm[1]; })); return A.raw.gsec[c] ? c : (only && sheets.length === 1 ? only : ''); };
    sheets.forEach(([n, a, hi]) => {
      const crn = crnOf(n, a, hi), sec = crn && A.raw.gsec[crn];
      if (!crn) { const d = (n.match(/^\s*(\d{5,6})\s*$/) || [])[1]; if (d && (!only || d === only)) plan.skip.push(`الورقة «${n}»: الشعبة غير مسندة إليك أو غير موجودة في قاعدة بيانات الدرجات.`); return; }
      if (!sec) { plan.skip.push(`الورقة «${n}»: الشعبة غير موجودة في قاعدة بيانات الدرجات.`); return; }
      if (only && crn !== only) return;
      if (!gMay(crn)) { plan.skip.push(`${crn}: ${gNotMine(crn)}`); return; }
      const gate = gGate(crn); if (gate) { plan.skip.push(`${crn}: ${gate}`); return; }
      const mc = metaCheck(meta, sec, a, hi);
      if (mc.block) { plan.skip.push(`${crn}: ${mc.block}`); return; }
      const hc = a[hi], it = { crn, add: [], chg: [], same: 0, bad: [], sub: {}, direct: [], items: {}, warn: mc.warn || '' }, marks = gMarks(crn), seen = {};
      const L = sheetLayout(hc, sec), idc = hidx(hc, ['الرقم التدريبي']), its = {};
      const B = (o) => it.bad.push(Object.assign({ crn }, o));
      hc.forEach((h0) => { const m = COMP_RE.exec(norm(h0)); if (m && !G.compBy(sec, m[1].toUpperCase())) B({ k: m[1], msg: `العمود ${m[1]} ليس مكوّناً معتمداً في توزيع الشعبة ${crn}، فلم يُستورد.` }); });
      Object.entries(L.byComp).forEach(([k, list]) => {
        const cp = G.compBy(sec, k), sum = r2(list.reduce((t, x) => t + x.max, 0)), si = (sec.items || {})[k];
        if (sum !== cp.max) { B({ k, msg: `مجموع حدود بنود ${k} في الملف (${sum}) لا يساوي حدها المعتمد (${cp.max})، فلم تُستورد درجات ${k}.` }); return; }
        if (!si) { B({ k, msg: `في الملف بنود لـ${k} والتوزيع المعتمد للشعبة بلا بنود. يستورد مسؤول المنصة التوزيع من الملف نفسه أولاً.` }); return; }
        its[k] = list;
      });
      for (let i = hi + 1; i < a.length; i++) {
        const r = a[i] || [], id = cellOf(r[idc]).replace(/\.0$/, ''); if (!/^\d{6,12}$/.test(id)) continue;
        const vals = [], sub = {};
        G.comps(sec).forEach((cp) => {
          if (its[cp.k]) { const sv = {}; its[cp.k].forEach((x) => { if (!isEmpty(r[x.j])) sv[x.n] = r[x.j]; }); if (Object.keys(sv).length) sub[cp.k] = sv; return; }
          if (L.byComp[cp.k]) return;   // بنود مرفوضة: لا يُقرأ عمود المكوّن (قد يكون معادلة)
          const j = L.comps[cp.k]; if (j !== undefined && !isEmpty(r[j])) vals.push([cp.k, r[j]]);
        });
        if (!vals.length && !Object.keys(sub).length) continue;
        const row = sec.rows.find((x) => x.id === id), name = row ? row.name : '';
        if (seen[id]) { B({ id, msg: `الرقم التدريبي ${id} مكرر في الملف (الصف ${i + 1}).` }); continue; } seen[id] = 1;
        if (!row) { B({ id, msg: `الرقم التدريبي ${id} غير موجود في الشعبة ${crn}.` }); continue; }
        if (!row.el) { B({ id, name, msg: `غير قابل للرصد (${row.st || ''})، فلم تُستورد درجاته.` }); continue; }
        Object.entries(sub).forEach(([k, sv]) => {
          (it.items[id] = it.items[id] || {})[k] = sv;
          const x = compFromItems(its[k], k, sv);
          x.bad.forEach((b) => B({ id, name, k, msg: b }));
          if (x.bad.length) return;
          (it.sub[id] = it.sub[id] || {})[k] = x.v;
          if (x.total === null) { B({ id, name, k, msg: `بنود ${k} ناقصة (${x.miss.join('، ')})، فلم تُحسب درجة ${k}. تُحفظ البنود المدخلة.` }); return; }
          vals.push([k, x.total, true]);
        });
        vals.forEach(([k, v, fromItems]) => {
          if (!fromItems) it.direct.push({ id, k, v });
          const c = G.check(sec, k, v), old = G.val(marks, id, k);
          if (!c.ok) B({ id, name, k, raw: v, msg: c.msg }); else if (old === null) it.add.push({ id, k, raw: c.v, name }); else if (old === c.v) it.same++; else it.chg.push({ id, k, raw: c.v, old, name });
        });
      }
      plan.items.push(it);
    });
    if (!plan.items.length) { modal(`<h2>لا شيء للاستيراد</h2><div class="gnote ${plan.skip.length ? 'warn' : 'bad'}">${plan.skip.length ? plan.skip.map(esc).join('<br>') : 'لم أجد في الملف ورقة لشعبة مسندة إليك فيها عمود «الرقم التدريبي» وأعمدة الدرجات.'}</div><button class="btn" data-act="modal-close">إغلاق</button>`); return; }
    A.gPlan = plan;
    A.gErr = { file: file.name, rows: plan.items.flatMap((x) => x.bad).concat(plan.skip.map((m) => ({ msg: m }))) };
    const sum = (k) => plan.items.reduce((a, x) => a + (typeof x[k] === 'number' ? x[k] : x[k].length), 0);
    const nsub = plan.items.reduce((a, x) => a + Object.keys(x.items).length, 0);
    const mline = meta ? `معرّف المصنف <b dir="ltr">${esc(meta.id)}</b> • ${esc(meta.term)} • ${esc(meta.trainerName || '')} • أُنشئ ${esc(new Date(meta.at).toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }))}` : 'مصنف بلا معرّف من المنصة';
    modal(`<h2>معاينة استيراد الدرجات</h2><div><b>${esc(file.name)}</b></div><div class="sub">${mline}</div>
    <div class="grev"><span>درجات جديدة <b>${sum('add')}</b></span><span>تخالف المحفوظ <b class="${sum('chg') ? 'gred' : ''}">${sum('chg')}</b></span><span>مطابقة للمحفوظ <b>${sum('same')}</b></span><span>مرفوضة <b class="${sum('bad') ? 'gred' : ''}">${sum('bad')}</b></span></div>
    <div class="tw"><table><thead><tr><th class="n">الشعبة</th><th class="n">جديدة</th><th class="n">تخالف المحفوظ</th><th class="n">مطابقة</th><th class="n">مرفوضة</th><th>ملاحظات</th></tr></thead><tbody>${plan.items.map((x) => `<tr><td class="n"><b>${x.crn}</b></td><td class="n">${x.add.length}</td><td class="n">${x.chg.length}</td><td class="n">${x.same}</td><td class="n">${x.bad.length}</td><td style="font-size:12.5px">${esc(x.warn)}</td></tr>`).join('')}</tbody></table></div>
    ${nsub ? `<div class="gnote info">درجات أعمال الفصل تُحسب من بنودها لـ${nsub} متدرباً، ويُرفع المجموع وحده إلى رايات.</div>` : ''}
    ${sum('bad') ? `<div class="gnote bad"><b>لن تُستورد:</b><ul>${plan.items.flatMap((x) => x.bad).slice(0, 25).map((b) => `<li>${b.crn ? `${b.crn} — ` : ''}${b.name ? esc(b.name) + ': ' : ''}${esc(b.msg)}</li>`).join('')}${sum('bad') > 25 ? `<li>و${sum('bad') - 25} أخرى في تقرير الأخطاء</li>` : ''}</ul></div>` : ''}
    ${sum('chg') ? `<div class="gnote warn"><b>درجات محفوظة يخالفها الملف (القديمة والجديدة):</b><div class="tw" style="max-height:28vh;overflow:auto"><table><thead><tr><th class="n">الشعبة</th><th>المتدرب</th><th class="n">المكوّن</th><th class="n">المحفوظة</th><th class="n">في الملف</th></tr></thead><tbody>${plan.items.flatMap((x) => x.chg.map((c) => `<tr><td class="n">${x.crn}</td><td>${esc(c.name)}</td><td class="n">${esc(c.k)}</td><td class="n">${G.fmt(c.old)}</td><td class="n"><b>${G.fmt(c.raw)}</b></td></tr>`)).join('')}</tbody></table></div><label class="ck"><input type="checkbox" id="giOver"${plan.over ? ' checked' : ''}> تحديث الدرجات السابقة: استبدل المحفوظ بما في الملف (${sum('chg')})</label><span class="sub">دون هذا الخيار تبقى الدرجات المحفوظة كما هي.</span></div>` : ''}
    ${plan.skip.length ? `<div class="gnote warn"><b>لم تُقرأ:</b><br>${plan.skip.map(esc).join('<br>')}</div>` : ''}
    <div class="sub">لا يُحفظ شيء قبل «اعتماد الاستيراد». الحفظ على الخادم بعد التحقق من صلاحيتك ومن كل درجة مرة أخرى.</div>
    <div class="row"><button class="btn p" data-act="g-xin-ok" ${sum('add') + sum('chg') + nsub ? '' : 'disabled'}>اعتماد الاستيراد</button>${A.gErr.rows.length ? '<button class="btn" data-act="gx-err">تنزيل تقرير الأخطاء</button>' : ''}<button class="btn" data-act="modal-close">إلغاء</button></div>`);
  };

  /* ---------- الاعتماد: الحفظ في قاعدة البيانات عبر الخادم ---------- */
  function applyLocal(crn, r) {
    const m = A.raw.gmarks[crn] = clone(A.raw.gmarks[crn] || { g: {}, t: {} }); m.g = m.g || {}; m.t = m.t || {};
    (r.changes || []).forEach(([id, k, , nv]) => { (m.g[id] = m.g[id] || {})[k] = nv; (m.t[id] = m.t[id] || {})[k] = [r.at, r.by]; });
    if (r.s && Object.keys(r.s).length) m.s = merge(m.s || {}, clone(r.s));
  }
  gGradesApply = async function () {
    const plan = A.gPlan; if (!plan || plan.busy) return; plan.busy = true;
    const over = $('#giOver') ? $('#giOver').checked : plan.over, res = [];
    const btn = $('[data-act="g-xin-ok"]'); if (btn) { btn.disabled = true; btn.textContent = 'جارٍ الحفظ…'; }
    const wbArg = plan.meta ? { id: plan.meta.id, term: plan.meta.term, trainer: plan.meta.trainer, crns: plan.meta.crns } : {};
    for (const it of plan.items) {
      if (!it.direct.length && !Object.keys(it.items).length) continue;
      try {
        const r = await BK.imp({ p_crn: it.crn, p_rows: it.direct, p_items: it.items, p_overwrite: !!over, p_file: plan.file, p_wb: wbArg });
        applyLocal(it.crn, r); res.push({ crn: it.crn, ok: true, r });
        if (r.id) gLog([['import', it.crn, '', '', '', (r.add || 0) + (r.chg || 0), `${plan.file} • ${r.id} • جديدة ${r.add}، حُدّثت ${r.chg}، مطابقة ${r.same}، أُبقيت ${r.kept}، رُفضت ${(r.bad || []).length}`]]);
      } catch (e) { res.push({ crn: it.crn, ok: false, msg: (e && e.message) || 'تعذر الحفظ' }); }
    }
    A.gPlan = null; GXH.cache = {};
    BK.sync();
    const errs = []; res.forEach((x) => { if (x.ok) (x.r.bad || []).forEach((b) => errs.push({ crn: x.crn, id: b.id || '', name: gNameOf(x.crn, b.id || ''), k: b.k || '', msg: b.msg })); else errs.push({ crn: x.crn, msg: 'لم تُحفظ: ' + x.msg }); });
    A.gErr = { file: plan.file, rows: errs };
    closeModal(); rebuild(); render(true);
    const ok = res.filter((x) => x.ok), fail = res.filter((x) => !x.ok), tot = (k) => ok.reduce((a, x) => a + (x.r[k] || 0), 0);
    modal(`<h2>${fail.length ? (ok.length ? 'اكتمل الاستيراد جزئياً' : 'لم يُحفظ الاستيراد') : 'حُفظت الدرجات في قاعدة البيانات'}</h2>
      ${ok.length ? `<div class="gnote ok">${WEB ? 'أكد الخادم حفظ' : 'حُفظت'} ${tot('add') + tot('chg')} درجة في ${ok.length} شعبة: جديدة ${tot('add')}، حُدّثت ${tot('chg')}، مطابقة للمحفوظ ${tot('same')}${tot('kept') ? `، وأُبقيت ${tot('kept')} درجة محفوظة دون تحديث` : ''}.</div>` : ''}
      <div class="tw"><table><thead><tr><th class="n">الشعبة</th><th>النتيجة</th><th class="n">جديدة</th><th class="n">حُدّثت</th><th class="n">مطابقة</th><th class="n">مرفوضة</th><th class="n">رقم العملية</th></tr></thead><tbody>${res.map((x) => x.ok ? `<tr><td class="n"><b>${x.crn}</b></td><td><span class="chip ok">حُفظت</span></td><td class="n">${x.r.add}</td><td class="n">${x.r.chg}</td><td class="n">${x.r.same}</td><td class="n">${(x.r.bad || []).length}</td><td class="n" dir="ltr" style="font-size:12px">${esc(x.r.id || '—')}</td></tr>` : `<tr><td class="n"><b>${x.crn}</b></td><td colspan="6"><span class="chip bad">لم تُحفظ</span> ${esc(x.msg)}</td></tr>`).join('')}</tbody></table></div>
      ${errs.length ? `<div class="gnote warn">${WEB ? 'رفض الخادم' : 'رُفضت'} ${errs.length} قيمة. التفاصيل في تقرير الأخطاء.</div>` : ''}
      <div class="row">${ok.length ? `<button class="btn p" data-act="gx-exp" data-crns="${ok.map((x) => x.crn).join(',')}">تصدير تقرير الدرجات</button>` : ''}${errs.length ? '<button class="btn" data-act="gx-err">تنزيل تقرير الأخطاء</button>' : ''}<button class="btn" data-act="modal-close">إغلاق</button></div>`);
    if (ok.length && !fail.length) toast('حُفظت الدرجات في قاعدة البيانات.');
  };
  ACT['g-xin-ok'] = () => gGradesApply();

  /* ---------- تقرير الأخطاء ---------- */
  ACT['gx-err'] = async () => {
    const E = A.gErr; if (!E || !E.rows.length) { toast('لا أخطاء.'); return; }
    let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
    const wb = X.utils.book_new(); wb.Workbook = { Views: [{ RTL: true }] };
    const ws = X.utils.aoa_to_sheet([[`تقرير أخطاء استيراد الدرجات — ${E.file}`], [`أُنشئ ${new Date().toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh' })} — ${A.me.name}`], [], ['م', 'الشعبة', 'الرقم التدريبي', 'اسم المتدرب', 'المكوّن', 'القيمة', 'السبب']].concat(E.rows.map((b, i) => [i + 1, b.crn || '', b.id || '', b.name || (b.id && b.crn ? gNameOf(b.crn, b.id) : ''), b.k || '', b.raw === undefined ? '' : b.raw, b.msg])));
    ws['!views'] = [{ RTL: true }]; ws['!cols'] = [{ wch: 5 }, { wch: 9 }, { wch: 13 }, { wch: 34 }, { wch: 8 }, { wch: 8 }, { wch: 80 }];
    X.utils.book_append_sheet(wb, ws, 'الأخطاء');
    await save(`تقرير أخطاء استيراد الدرجات - ${String(E.file).replace(/\.xlsx$/i, '')}.xlsx`, new Blob([X.write(wb, { type: 'array', bookType: 'xlsx' })], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  };

  /* ---------- خيارات الاستيراد ---------- */
  ACT['gx-imp'] = (e) => {
    const crn = e.dataset.crn, n = window.HAADER_GX ? window.HAADER_GX.mine().length : 1;
    modal(`<h2>استيراد درجات Excel</h2><div class="sub">ارفع المصنف بعد إدخال الدرجات. تُعرض معاينة كاملة قبل الحفظ.</div>
      <div class="gxopt"><label class="ck"><input type="radio" name="gxs" value="one" checked> الشعبة ${esc(crn)} وحدها</label>
      <label class="ck"><input type="radio" name="gxs" value="all"> جميع الشعب المسندة إليّ في المصنف (${n})</label>
      <label class="ck"><input type="checkbox" id="gxo"> تحديث الدرجات السابقة إن اختلفت (تُعرض القديمة والجديدة قبل الاعتماد)</label></div>
      <div class="row"><label class="btn p">اختيار المصنف<input type="file" accept=".xlsx" hidden data-change="gx-file" data-crn="${esc(crn)}"></label><button class="btn" data-act="modal-close">إلغاء</button></div>`);
  };
  CHG['gx-file'] = (e) => {
    const f = e.files[0], crn = e.dataset.crn, all = ($('input[name="gxs"]:checked') || {}).value === 'all', over = !!($('#gxo') && $('#gxo').checked); e.value = '';
    if (f) gGradesImport(f, all ? null : crn, { over }).catch((x) => { console.error(x); toast('تعذرت قراءة الملف. تأكد أنه ملف Excel صحيح.'); });
  };
  CHG['g-xin'] = (e) => { const f = e.files[0], crn = e.dataset.crn; e.value = ''; if (f) gGradesImport(f, crn, {}).catch(() => toast('تعذرت قراءة الملف. تأكد أنه ملف Excel صحيح.')); };

  /* ---------- التنزيل: النموذج الرسمي (بالدرجات المحفوظة) ---------- */
  ACT['gx-tpl'] = () => { const c = window.HAADER_GX.mine(); if (!c.length) { toast('لا توجد شعب درجات مسندة إلى حسابك.'); return; } window.HAADER_GX.download(c, { withGrades: true }); };
  ACT['gx-exp'] = (e) => window.HAADER_GX.download(String(e.dataset.crns || '').split(',').filter(Boolean), { withGrades: true, name: `تقرير الدرجات بعد الاعتماد - ${new Date().toISOString().slice(0, 10)}.xlsx` });
  ACT['g-xout'] = (e) => window.HAADER_GX.download([e.dataset.crn], { withGrades: true });
  ACT['g-xall'] = () => window.HAADER_GX.download(gSecs().map((s) => s.crn), { withGrades: true, name: 'درجات المقررات والشعب - منصة حاضر.xlsx' });

  /* ---------- سجل استيراد الدرجات والتراجع ---------- */
  const GXH = { cache: {}, busy: {} };
  const histHtml = (crn) => {
    const c = GXH.cache[crn];
    if (!c) return '<div class="sub">جارٍ التحميل…</div>';
    if (c.err) return `<div class="sub">${esc(c.err)}</div>`;
    if (!c.list.length) return '<div class="sub">لا عمليات استيراد لهذه الشعبة بعد.</div>';
    const may = gMay(crn) && !gGate(crn);
    return `<div class="tw"><table><thead><tr><th class="n">الوقت</th><th>المستخدم</th><th>الملف</th><th class="n">جديدة</th><th class="n">حُدّثت</th><th class="n">مرفوضة</th><th>الحالة</th><th class="n"></th></tr></thead><tbody>${c.list.map((x) => `<tr><td class="n" style="white-space:nowrap">${gDT(x.at)}</td><td>${esc(x.by || '')}</td><td style="font-size:12px">${esc(x.file || '')}<br><small class="sub" dir="ltr">${esc(x.id)}</small></td><td class="n">${x.add}</td><td class="n">${x.chg}</td><td class="n">${x.bad}</td><td>${x.status === 'undone' ? `<span class="chip">تم التراجع ${x.undone_at ? gDT(x.undone_at) : ''}</span>` : '<span class="chip ok">محفوظة</span>'}</td><td class="n">${x.status === 'done' && may && (x.add + x.chg) ? `<button class="btn s" data-act="gx-undo" data-id="${esc(x.id)}" data-crn="${crn}">تراجع</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  };
  async function loadHist(crn, force) {
    const c = GXH.cache[crn]; if (!force && c && Date.now() - c.at < 30000) return;
    if (GXH.busy[crn]) return; GXH.busy[crn] = 1;
    try { const list = await BK.list(crn); GXH.cache[crn] = { at: Date.now(), list: list || [] }; }
    catch (e) { GXH.cache[crn] = { at: Date.now(), list: [], err: 'تعذر تحميل سجل الاستيراد.' }; }
    GXH.busy[crn] = 0;
    const el = document.querySelector(`#gxHist[data-crn="${crn}"] .gxh-body`); if (el) el.innerHTML = histHtml(crn);
  }
  ACT['gx-undo'] = (e) => {
    const id = e.dataset.id, crn = e.dataset.crn, x = ((GXH.cache[crn] || {}).list || []).find((y) => y.id === id); if (!x) return;
    modal(`<h2>التراجع عن عملية الاستيراد</h2><div>العملية <b dir="ltr">${esc(id)}</b> — ${esc(x.file || '')} — ${gDT(x.at)}</div>
      <div class="gnote warn">تعود ${x.add + x.chg} درجة إلى قيمتها قبل الاستيراد (الجديدة تُمسح، والمحدَّثة تعود لقيمتها السابقة). الدرجة التي عُدّلت بعد الاستيراد لا تُمس ويظهر لك بيانها.</div>
      <div class="row"><button class="btn p" data-act="gx-undo-ok" data-id="${esc(id)}" data-crn="${crn}">تأكيد التراجع</button><button class="btn" data-act="modal-close">إلغاء</button></div>`);
  };
  ACT['gx-undo-ok'] = async (e) => {
    const id = e.dataset.id, crn = e.dataset.crn; e.disabled = true;
    let r; try { r = await BK.undo(id); } catch (x) { e.disabled = false; toast((x && x.message) || 'تعذر التراجع.'); return; }
    const m = A.raw.gmarks[crn] = clone(A.raw.gmarks[crn] || { g: {}, t: {} }); m.g = m.g || {};
    (r.restored || []).forEach(([tid, k, , to]) => { (m.g[tid] = m.g[tid] || {})[k] = to; });
    Object.entries(r.s || {}).forEach(([tid, kv]) => Object.entries(kv).forEach(([k, ov]) => { m.s = m.s || {}; m.s[tid] = m.s[tid] || {}; if (ov === null) delete m.s[tid][k]; else m.s[tid][k] = ov; }));
    gLog([['undo', crn, '', '', '', (r.restored || []).length, `تراجع عن ${id}${(r.skipped || []).length ? `، ولم تُمس ${r.skipped.length} درجة عُدّلت بعده` : ''}`]]);
    BK.sync();
    delete GXH.cache[crn]; closeModal(); rebuild(); render(true);
    modal(`<h2>تم التراجع</h2><div class="gnote ok">أُعيدت ${(r.restored || []).length} درجة إلى قيمتها السابقة.</div>${(r.skipped || []).length ? `<div class="gnote warn">لم تُمس ${r.skipped.length} درجة لأنها عُدّلت بعد الاستيراد:<ul>${r.skipped.slice(0, 15).map(([tid, k, cur]) => `<li>${esc(gNameOf(crn, tid))} — ${esc(k)}: ${cur == null ? '—' : G.fmt(cur)}</li>`).join('')}</ul></div>` : ''}<button class="btn" data-act="modal-close">إغلاق</button>`);
  };
  Object.assign(GACT, { tpl: 'تنزيل نموذج الدرجات', undo: 'تراجع عن استيراد' });

  /* ---------- نافذة الإدخال: الأزرار وسجل الاستيراد ---------- */
  function distPanel(sec) {
    const its = sec.items || {}, st = G.stats(sec, gMarks(sec.crn));
    const rows = G.comps(sec).map((c) => `<tr><td class="n"><b>${esc(c.k)}</b></td><td>${esc(c.desc || '')}</td><td class="n">${esc(c.part || '')}</td><td class="n"><b>${G.fmt(c.max)}</b></td><td class="n">${esc(c.mustPass || '')}</td><td>${its[c.k] ? its[c.k].map((x) => `${esc(x.n)} <b>${G.fmt(x.max)}</b>`).join(' + ') : '—'}</td></tr>`).join('');
    return `<section class="panel gdist"><div class="row between"><h2 style="margin:0">توزيع درجات المقرر — ${esc(sec.code || '')} ${esc(sec.name || '')}</h2><span class="sub">المعتمد في رايات${Object.keys(its).length ? '، وبنود أعمال السنة تُجمع في مكوّنها ويُرفع المجموع وحده' : ''}</span></div>
      <div class="tw"><table><thead><tr><th class="n">المكوّن</th><th>الوصف</th><th class="n">الجزء</th><th class="n">الدرجة القصوى</th><th class="n">يجب الاجتياز</th><th>البنود التفصيلية</th></tr></thead><tbody>${rows}<tr class="tot"><td class="n">المجموع</td><td></td><td class="n"></td><td class="n">${G.fmt(G.total(sec))}</td><td></td><td></td></tr></tbody></table></div>
      ${st.have ? '' : `<div class="gnote info">لم تُدخل درجات لهذه الشعبة بعد: ${st.need} درجة مطلوبة لـ${st.elig != null ? st.elig : (sec.rows || []).filter((r) => r.el).length} متدرباً قابلاً للرصد. أدخلها في الجدول أدناه، أو نزّل نموذج إدخال الدرجات Excel وارفعه بعد التعبئة.</div>`}</section>`;
  }
  const baseEntry = VIEWS.gentry;
  VIEWS.gentry = () => {
    let h = baseEntry(), crn = '';
    h = h.replace(/<label class="btn s">استيراد الدرجات من Excel<input type="file" accept="\.xlsx" hidden data-change="g-xin" data-crn="(\d+)"><\/label>/, (m0, c) => { crn = c; return `<button class="btn s p" data-act="gx-tpl">تحميل نموذج إدخال الدرجات Excel</button><button class="btn s" data-act="gx-imp" data-crn="${c}">استيراد درجات Excel</button>`; });
    if (!crn) { const sec = A.gCrn && A.raw.gsec[A.gCrn]; if (sec && gList(sec.crn)) crn = sec.crn; }
    /* توزيع درجات المقرر (المعتمد وبنود أعمال السنة) فوق جدول المتدربين */
    const dsec = crn && A.raw.gsec[crn];
    if (dsec) h = h.replace('<section class="panel"><div class="row between"><h2 style="margin:0">جدول المتدربين', (m0) => distPanel(dsec) + m0);
    if (crn && (gMay(crn) || isAdmin() || isHead())) { h += `<section class="panel" id="gxHist" data-crn="${crn}"><div class="row between"><h2 style="margin:0">سجل استيراد الدرجات — الشعبة ${crn}</h2><span class="sub">كل عملية بقيمها القديمة والجديدة، ويمكن التراجع عنها ما لم تُعدَّل الدرجات بعدها.</span></div><div class="gxh-body">${histHtml(crn)}</div></section>`; setTimeout(() => loadHist(crn), 0); }
    return h;
  };

  /* التصدير بالهيكل نفسه: أعمدة البنود قبل مكوّنها، فيُعاد استيراده كما هو */
  gSecAoa = function (sec, withGrades) {
    const parts = G.parts(sec), s = G.stats(sec, gMarks(sec.crn)), sub = subOf(sec.crn), its = sec.items || {}, head = ['م', 'اسم المتدرب', 'الرقم التدريبي', 'حالة القيد في رايات', 'قابل للرصد'];
    const lim = ['', 'الحد الأعلى لكل مكوّن', '', '', ''];
    Object.keys(parts).forEach((p) => {
      parts[p].forEach((c) => { (its[c.k] || []).forEach((it) => { head.push(`${it.n} (${it.max})`); lim.push(it.max); }); head.push(its[c.k] ? `${c.k} (${c.max})` : c.k); lim.push(c.max); });
      head.push(p); lim.push(parts[p].reduce((a, c) => a + c.max, 0));
    });
    head.push('المجموع', 'حالة الإدخال', 'ساعات الحضور (رايات)', 'آخر حضور (رايات)'); lim.push(G.total(sec), '', '', '');
    const rows = gElFirst(sec.rows).map((r, i) => {
      const rs = s.rs[r.id], o = [i + 1, r.name, r.id, r.st || '', r.el ? 'نعم' : 'لا'], show = withGrades && r.el;
      Object.keys(parts).forEach((p) => { parts[p].forEach((c) => { (its[c.k] || []).forEach((it) => { const v = (((sub[r.id] || {})[c.k]) || {})[it.n]; o.push(show && G.isNum(v) ? v : null); }); o.push(show && G.isNum(rs.g[c.k]) ? rs.g[c.k] : null); }); o.push(show && rs.part[p] != null ? rs.part[p] : null); });
      o.push(show ? rs.total : null, G.ROW_ST[rs.st], r.hrs == null ? null : r.hrs, r.last || ''); return o;
    });
    return [[`كشف رصد الدرجات — ${sec.code} ${sec.name} — الشعبة ${sec.crn}`], ['الرقم المرجعي للشعبة', sec.crn, '', 'الفصل التدريبي', sec.term || '', '', 'توزيع الدرجات', gDistText(sec)], lim, head].concat(rows);
  };
  window.HAADER_GRADES_WEB = { parseBook, compFromItems, sheetLayout, readMeta, metaCheck, GXH };
})();
