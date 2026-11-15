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
if (window.HAADER_WEB) (() => {
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
      if (it && !NOT_ITEM.has(norm(it[1])) && !COMP_RE.test(h)) items.push({ j, n: norm(it[1]), max: Number(it[2]) });
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

  /* استيراد الدرجات من المصنف نفسه (مدرب الشعبة) */
  gGradesImport = async function (file, only) {
    let X; try { X = await loadXLSX(); } catch (e) { toast('تعذر تحميل مكتبة Excel.'); return; }
    const wb = X.read(await file.arrayBuffer(), { type: 'array' }), plan = { file: file.name, items: [], skip: [] };
    const sheets = wb.SheetNames.map((n) => [n, X.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null })]).map(([n, a]) => [n, a, findHdr(a, [['اسم المتدرب'], ['الرقم التدريبي']])]).filter((x) => x[2] >= 0);
    const crnOf = (n, a, hi) => { const m = n.match(/(\d{5,6})/); if (m && A.raw.gsec[m[1]]) return m[1]; let c = ''; a.slice(0, hi).forEach((r) => (r || []).forEach((v, j) => { const t = cellOf(v); if (t === 'الرقم المرجعي للشعبة') c = cellOf((r.slice(j + 1).find((y) => y !== null))); const mm = t.match(/الشعبة\s+(\d{5,6})/); if (!c && mm && A.raw.gsec[mm[1]]) c = mm[1]; })); return A.raw.gsec[c] ? c : (only && sheets.length === 1 ? only : ''); };
    sheets.forEach(([n, a, hi]) => {
      const crn = crnOf(n, a, hi), sec = crn && A.raw.gsec[crn]; if (!sec || (only && crn !== only)) return;
      const gate = gGate(crn); if (gate) { plan.skip.push(`${crn}: ${gate}`); return; }
      const hc = a[hi], it = { crn, add: [], chg: [], same: 0, bad: [], sub: {} }, marks = gMarks(crn), seen = {};
      const L = sheetLayout(hc, sec), idc = hidx(hc, ['الرقم التدريبي']), its = {};
      hc.forEach((h0) => { const m = COMP_RE.exec(norm(h0)); if (m && !G.compBy(sec, m[1].toUpperCase())) it.bad.push({ msg: `العمود ${m[1]} ليس مكوّناً معتمداً في توزيع الشعبة ${crn}، فلم يُستورد.` }); });
      Object.entries(L.byComp).forEach(([k, list]) => {
        const cp = G.compBy(sec, k), sum = r2(list.reduce((t, x) => t + x.max, 0));
        if (sum !== cp.max) { it.bad.push({ msg: `الشعبة ${crn}: مجموع حدود بنود ${k} في الملف (${sum}) لا يساوي حدها المعتمد (${cp.max})، فلم تُستورد درجات ${k}.` }); return; }
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
        const row = sec.rows.find((x) => x.id === id);
        if (seen[id]) { it.bad.push({ msg: `الرقم التدريبي ${id} مكرر في الملف (الصف ${i + 1}).` }); continue; } seen[id] = 1;
        if (!row) { it.bad.push({ msg: `الرقم التدريبي ${id} غير موجود في الشعبة ${crn}.` }); continue; }
        if (!row.el) { it.bad.push({ msg: `${row.name}: غير قابل للرصد (${row.st || ''})، فلم تُستورد درجاته.` }); continue; }
        Object.entries(sub).forEach(([k, sv]) => {
          const x = compFromItems(its[k], k, sv);
          x.bad.forEach((b) => it.bad.push({ msg: `${row.name}: ${b}` }));
          if (x.bad.length) return;
          (it.sub[id] = it.sub[id] || {})[k] = x.v;
          if (x.total === null) { it.bad.push({ msg: `${row.name}: بنود ${k} ناقصة (${x.miss.join('، ')})، فلم تُحسب درجة ${k}. تُحفظ البنود المدخلة.` }); return; }
          vals.push([k, x.total]);
        });
        vals.forEach(([k, v]) => { const c = G.check(sec, k, v), old = G.val(marks, id, k); if (!c.ok) it.bad.push({ msg: `${row.name}: ${c.msg}` }); else if (old === null) it.add.push({ id, k, raw: c.v, name: row.name }); else if (old === c.v) it.same++; else it.chg.push({ id, k, raw: c.v, old, name: row.name }); });
      }
      it.its = its;
      plan.items.push(it);
    });
    if (!plan.items.length) { modal(`<h2>لا شيء للاستيراد</h2><div class="gnote ${plan.skip.length ? 'warn' : 'bad'}">${plan.skip.length ? plan.skip.map(esc).join('<br>') : 'لم أجد في الملف كشف شعبة مسندة إليك فيه عمود «الرقم التدريبي» وأعمدة الدرجات.'}</div><button class="btn" data-act="modal-close">إغلاق</button>`); return; }
    A.gPlan = plan;
    const sum = (k) => plan.items.reduce((a, x) => a + (typeof x[k] === 'number' ? x[k] : x[k].length), 0);
    const nsub = plan.items.reduce((a, x) => a + Object.keys(x.sub).length, 0);
    modal(`<h2>مراجعة استيراد الدرجات</h2><div><b>${esc(file.name)}</b> — ${plan.items.map((x) => x.crn).join('، ')}</div><div class="grev"><span>درجات جديدة <b>${sum('add')}</b></span><span>تخالف المحفوظ <b class="${sum('chg') ? 'gred' : ''}">${sum('chg')}</b></span><span>مطابقة للمحفوظ <b>${sum('same')}</b></span><span>مرفوضة <b class="${sum('bad') ? 'gred' : ''}">${sum('bad')}</b></span></div>
    ${nsub ? `<div class="gnote info">درجات أعمال السنة تُحسب من بنودها (الواجبات والمشاركة والاختبارات الشهرية) لـ${nsub} متدرباً، ويُرفع المجموع وحده إلى رايات.</div>` : ''}
    ${sum('bad') ? `<div class="gnote bad"><b>لن تُستورد:</b><ul>${plan.items.flatMap((x) => x.bad).slice(0, 25).map((b) => `<li>${esc(b.msg)}</li>`).join('')}${sum('bad') > 25 ? `<li>و${sum('bad') - 25} أخرى</li>` : ''}</ul></div>` : ''}
    ${sum('chg') ? `<div class="gnote warn"><b>درجات محفوظة يخالفها الملف:</b><div class="tw" style="max-height:28vh;overflow:auto"><table><thead><tr><th class="n">الشعبة</th><th>المتدرب</th><th class="n">المكوّن</th><th class="n">المحفوظة</th><th class="n">في الملف</th></tr></thead><tbody>${plan.items.flatMap((x) => x.chg.map((c) => `<tr><td class="n">${x.crn}</td><td>${esc(c.name)}</td><td class="n">${esc(c.k)}</td><td class="n">${G.fmt(c.old)}</td><td class="n"><b>${G.fmt(c.raw)}</b></td></tr>`)).join('')}</tbody></table></div><label class="ck"><input type="checkbox" id="giOver"> استبدل الدرجات المحفوظة بما في الملف (${sum('chg')})</label><span class="sub">دون هذه الموافقة تبقى الدرجات المحفوظة كما هي.</span></div>` : ''}
    ${plan.skip.length ? `<div class="gnote warn">${plan.skip.map(esc).join('<br>')}</div>` : ''}
    <div class="row"><button class="btn p" data-act="g-xin-ok" ${sum('add') + sum('chg') + nsub ? '' : 'disabled'}>اعتماد الاستيراد</button><button class="btn" data-act="modal-close">إلغاء</button></div>`);
  };
  const baseGradesApply = gGradesApply;
  gGradesApply = function () {
    const plan = A.gPlan; if (!plan) return;
    plan.items.forEach((it) => {
      if (!Object.keys(it.sub || {}).length || gGate(it.crn)) return;
      const cur = (A.raw.gsec[it.crn] || {}).items || {}, add = {};
      Object.entries(it.its || {}).forEach(([k, list]) => { if (!cur[k]) add[k] = list.map((x) => ({ n: x.n, max: x.max })); });
      if (Object.keys(add).length) gPatch(it.crn, { items: add });
      A.raw.gmarks[it.crn] = merge(clone(A.raw.gmarks[it.crn] || { g: {}, t: {} }), { s: clone(it.sub) });
      enqueue('gmarks/' + it.crn, { s: it.sub });
    });
    return baseGradesApply();
  };
  ACT['g-xin-ok'] = () => gGradesApply();

  /* التصدير بالهيكل نفسه: أعمدة البنود قبل مكوّنها، فيُعاد استيراده كما هو */
  gSecAoa = function (sec, withGrades) {
    const parts = G.parts(sec), s = G.stats(sec, gMarks(sec.crn)), sub = subOf(sec.crn), its = sec.items || {}, head = ['م', 'اسم المتدرب', 'الرقم التدريبي', 'حالة القيد في رايات', 'قابل للرصد'];
    const lim = ['', 'الحد الأعلى لكل مكوّن', '', '', ''];
    Object.keys(parts).forEach((p) => {
      parts[p].forEach((c) => { (its[c.k] || []).forEach((it) => { head.push(`${it.n} (${it.max})`); lim.push(it.max); }); head.push(its[c.k] ? `${c.k} (${c.max})` : c.k); lim.push(c.max); });
      head.push(p); lim.push(parts[p].reduce((a, c) => a + c.max, 0));
    });
    head.push('المجموع', 'حالة الإدخال', 'ساعات الحضور (رايات)', 'آخر حضور (رايات)'); lim.push(G.total(sec), '', '', '');
    const rows = sec.rows.map((r, i) => {
      const rs = s.rs[r.id], o = [i + 1, r.name, r.id, r.st || '', r.el ? 'نعم' : 'لا'], show = withGrades && r.el;
      Object.keys(parts).forEach((p) => { parts[p].forEach((c) => { (its[c.k] || []).forEach((it) => { const v = (((sub[r.id] || {})[c.k]) || {})[it.n]; o.push(show && G.isNum(v) ? v : null); }); o.push(show && G.isNum(rs.g[c.k]) ? rs.g[c.k] : null); }); o.push(show && rs.part[p] != null ? rs.part[p] : null); });
      o.push(show ? rs.total : null, G.ROW_ST[rs.st], r.hrs == null ? null : r.hrs, r.last || ''); return o;
    });
    return [[`كشف رصد الدرجات — ${sec.code} ${sec.name} — الشعبة ${sec.crn}`], ['الرقم المرجعي للشعبة', sec.crn, '', 'الفصل التدريبي', sec.term || '', '', 'توزيع الدرجات', gDistText(sec)], lim, head].concat(rows);
  };
  window.HAADER_GRADES_WEB = { parseBook, compFromItems, sheetLayout };
})();
