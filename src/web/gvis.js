/* ====================================================================
   إدارة ظهور الدرجات (Grade Visibility Management)
   - لكل شعبة رصد وثيقة gvis/<الشعبة> مستقلة عن الدرجات: { crn, v, prev, sched, hist }
     v[key] = { on, at, by, byName }، والمفاتيح ديناميكية من توزيع الشعبة:
       i:<المكوّن>:<البند>  بند تفصيلي (الواجبات، المشاركة، الاختبار الأول…)
       c:<المكوّن>           المكوّن نفسه (إجمالي أعمال الفصل، الاختبار النهائي النظري/العملي…)
       total                 الدرجة النهائية للمقرر
   - الإخفاء لا يمس الدرجات: يُطبَّق عند العرض للمتدرب. في الرابط يطبّقه الخادم (trainee_grades)،
     فالمخفي لا يصل إلى المتدرب أصلاً. وفي نسخة Claude يطبّقه HAADER_GV.apply على بيانات البوابة.
   - المكوّن المجمّع من بنود يُخفى إن خُفي أي بند منه، حتى لا يُستنتج المخفي من الإجمالي.
   - الجدولة: sched = [{ id, at, set: {key: on}, by, byName }]، تُطبَّق متى حل وقتها (على الخادم وهنا).
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  A.raw.gvis = A.raw.gvis || {};
  try { if (Array.isArray(HCOLS) && !HCOLS.includes('gvis')) HCOLS.push('gvis'); } catch (e) { /* النسخة الاحتياطية */ }
  { const o = boot; boot = async function () { await o(); if (typeof db !== 'undefined' && db) try { gWatch('gvis'); } catch (e) { /* */ } }; }
  GVIEW.add('gvis');

  const PART = (p) => (/نظري/.test(p || '') ? 'النظري' : /عملي/.test(p || '') ? 'العملي' : (p || ''));
  const isFinal = (c) => /2$/.test(c.k) || /نهائي/.test(c.desc || '');
  const ITEM = (n) => (/الشهري\s*(1|١|الأول)/.test(n) ? 'الاختبار الشهري الأول' : /الشهري\s*(2|٢|الثاني)/.test(n) ? 'الاختبار الشهري الثاني' : n);
  /* معايير التقييم الموجودة فعلاً في الشعبة، بترتيب العرض */
  function list(sec) {
    const out = [], comps = G.comps(sec).slice().sort((a, b) => (PART(a.part) === 'النظري' ? 0 : 1) - (PART(b.part) === 'النظري' ? 0 : 1) || String(a.k).localeCompare(String(b.k)));
    comps.forEach((c) => {
      const its = (sec.items || {})[c.k] || [], p = PART(c.part);
      its.forEach((it) => out.push({ key: `i:${c.k}:${it.n}`, label: `${ITEM(it.n)} — ${p}`, part: p, comp: c.k, max: it.max, kind: 'item' }));
      const label = isFinal(c) ? `الاختبار النهائي ${p}` : its.length ? `إجمالي درجات أعمال الفصل — ${p}` : `التقييم ${p} (${c.desc || c.k})`;
      out.push({ key: `c:${c.k}`, label, part: p, comp: c.k, max: c.max, kind: its.length ? 'sum' : 'comp', items: its.map((it) => `i:${c.k}:${it.n}`) });
    });
    out.push({ key: 'total', label: 'الدرجة النهائية للمقرر', part: '', max: G.total(sec), kind: 'total' });
    return out;
  }
  const doc = (crn) => (A.raw.gvis || {})[crn] || {};
  /* الحالة الفعلية الآن: الأساس ثم ما حلّ وقته من الجدولة */
  function eff(d, key, now) {
    let on = !(d && d.v && d.v[key] && d.v[key].on === false);
    ((d && d.sched) || []).filter((x) => x && x.set && Date.parse(x.at) <= (now || Date.now())).sort((a, b) => String(a.at).localeCompare(String(b.at))).forEach((x) => { if (key in x.set) on = !!x.set[key]; });
    return on;
  }
  /* تطبيق الظهور على درجات متدرب واحد (gr بشكل trainee_grades)، مطابق لما يفعله الخادم */
  function apply(gr, d, now) {
    if (!gr) return gr;
    const o = Object.assign({}, gr), g = {}, s = {}, hid = [], on = (k) => eff(d, k, now);
    (gr.comps || []).forEach((c) => {
      const its = (gr.items || {})[c.k] || [], sv = (gr.s || {})[c.k] || {}; let all = true; const keep = {};
      its.forEach((it) => { const k = `i:${c.k}:${it.n}`; if (on(k)) { if (it.n in sv) keep[it.n] = sv[it.n]; } else { hid.push(k); all = false; } });
      if (Object.keys(keep).length) s[c.k] = keep;
      if (on(`c:${c.k}`) && all) { if (c.k in (gr.g || {})) g[c.k] = gr.g[c.k]; } else if (!on(`c:${c.k}`)) hid.push(`c:${c.k}`);
    });
    if (!on('total')) hid.push('total');
    o.g = g; o.s = s; o.hid = hid;
    return o;
  }
  window.HAADER_GV = { list, eff, apply };

  /* ---------- الصفحة ---------- */
  const S = { crn: '', st: {}, pv: '' };   // st: التعديلات غير المحفوظة {key: on}
  const may = (crn) => gMay(crn) && !isViewer();
  const fmtAt = (iso) => { try { return new Date(iso).toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso || ''; } };
  const secsMine = () => gSecs().filter((s) => gSee(s.crn));
  NAV.forEach(([g, items]) => { if (/الاختبارات ورصد الدرجات/.test(g) && !items.some((x) => x[0] === 'gvis')) { const i = items.findIndex((x) => x[0] === 'gentry'); items.splice(i < 0 ? items.length : i + 1, 0, ['gvis', 'إدارة ظهور الدرجات']); } });
  const baseNav = buildNav;
  buildNav = function () { baseNav.apply(this, arguments); if (!A.me || isViewer() || !secsMine().length) { const a = document.querySelector('#nav a[data-v="gvis"]'); if (a) a.remove(); } };
  const stateOf = (crn, key) => (key in S.st ? S.st[key] : eff(doc(crn), key));
  const sw = (crn, it, edit) => { const on = stateOf(crn, it.key), dirty = it.key in S.st && S.st[it.key] !== eff(doc(crn), it.key);
    return `<button type="button" class="gvsw ${on ? 'on' : 'off'}${dirty ? ' dirty' : ''}" role="switch" aria-checked="${on}" aria-label="${esc(it.label)}: ${on ? 'ظاهر للمتدرب' : 'مخفي عن المتدرب'}" data-act="gv-tg" data-k="${esc(it.key)}" ${edit ? '' : 'disabled'}><i></i><span>${on ? '🟢 ظاهر للمتدرب' : '🔴 مخفي عن المتدرب'}</span></button>`; };
  VIEWS.gvis = () => {
    const secs = secsMine();
    if (!secs.length) return gNoData('إدارة ظهور الدرجات');
    if (!S.crn || !secs.some((s) => s.crn === S.crn)) { S.crn = (A.gCrn && secs.some((s) => s.crn === A.gCrn)) ? A.gCrn : secs[0].crn; S.st = {}; }
    const sec = A.raw.gsec[S.crn], d = doc(S.crn), L = list(sec), edit = may(S.crn), n = Object.keys(S.st).filter((k) => S.st[k] !== eff(d, k)).length;
    const now = Date.now(), pend = (d.sched || []).filter((x) => Date.parse(x.at) > now).sort((a, b) => String(a.at).localeCompare(String(b.at)));
    const rows = L.map((it) => { const v = (d.v || {})[it.key], sched = pend.filter((x) => it.key in x.set);
      return `<tr class="gv-${it.kind}"><td>${it.kind === 'item' ? '<span class="gvind">↳</span> ' : ''}<b>${esc(it.label)}</b>${it.kind === 'sum' ? '<small class="sub" style="display:block">يُخفى تلقائياً إن خُفي أحد بنوده</small>' : ''}</td><td class="n">${G.fmt(it.max)}</td><td>${sw(S.crn, it, edit)}</td><td class="n" style="font-size:12.5px">${v && v.at ? `${fmtAt(v.at)}<small style="display:block">${esc(v.byName || '')}</small>` : '<span class="sub">الافتراضي: ظاهر</span>'}${sched.length ? `<small class="gvsch" style="display:block">مجدول: ${sched.map((x) => `${x.set[it.key] ? 'إظهار' : 'إخفاء'} ${fmtAt(x.at)}`).join('، ')}</small>` : ''}</td></tr>`; }).join('');
    return `${gHead('إدارة ظهور الدرجات', 'حدّد ما يراه المتدربون من درجاتهم في كل شعبة. الإخفاء لا يحذف الدرجة ولا يغيّرها، ويُطبَّق على الخادم فلا تصل الدرجة المخفية إلى المتدرب.')}
    <section class="panel"><div class="row between"><div class="row">${secs.map((s) => `<button class="btn s ${s.crn === S.crn ? 'p' : ''}" data-act="gv-sec" data-crn="${s.crn}">${esc(s.code || '')} — ${s.crn}</button>`).join('')}</div></div>
      <div class="row between" style="margin-top:10px"><div><h2 style="margin:0">${esc(sec.code || '')} ${esc(sec.name || '')} — الشعبة ${S.crn}</h2><div class="sub">المدرب: ${esc(gOwnerName(S.crn))}${edit ? '' : ' • للاطلاع: التعديل لمدرب الشعبة'}</div></div>
      <div class="row">${edit ? `<button class="btn s" data-act="gv-all" data-on="1">إظهار جميع الدرجات</button><button class="btn s" data-act="gv-all" data-on="0">إخفاء جميع الدرجات</button>` : ''}<button class="btn s" data-act="gv-pv">معاينة واجهة المتدرب</button>${edit && d.prev ? '<button class="btn s" data-act="gv-prev">إعادة الإعداد السابق</button>' : ''}${edit ? '<button class="btn s" data-act="gv-sch">جدولة الإظهار</button>' : ''}${edit ? `<button class="btn s p" data-act="gv-save" ${n ? '' : 'disabled'}>حفظ التغييرات${n ? ` (${n})` : ''}</button>` : ''}</div></div>
      ${n ? `<div class="gnote warn">لديك ${n} تغييراً غير محفوظ. لا يتغير ما يراه المتدربون قبل «حفظ التغييرات».</div>` : ''}
      <div class="tw"><table class="gvtab"><thead><tr><th>معيار التقييم</th><th class="n">الدرجة القصوى</th><th>حالة الظهور للمتدرب</th><th class="n">آخر تعديل</th></tr></thead><tbody>${rows}</tbody></table></div>
      ${pend.length ? `<div class="gnote info"><b>جدولة قادمة:</b><ul>${pend.map((x) => `<li>${fmtAt(x.at)} — ${Object.entries(x.set).map(([k, v]) => `${v ? 'إظهار' : 'إخفاء'} ${esc((L.find((i) => i.key === k) || { label: k }).label)}`).join('، ')} <span class="sub">(${esc(x.byName || '')})</span>${edit ? ` <button class="lnk small" data-act="gv-sch-del" data-id="${esc(x.id)}">إلغاء</button>` : ''}</li>`).join('')}</ul></div>` : ''}
      <div class="sub">الإعداد لكل شعبة مستقل. كل تعديل يُسجَّل باسم من أجراه ووقته في سجل العمليات.</div></section>`;
  };
  ACT['gv-sec'] = (e) => { if (Object.keys(S.st).length) toast('أُلغيت التغييرات غير المحفوظة في الشعبة السابقة.'); S.crn = e.dataset.crn; S.st = {}; render(true); };
  ACT['gv-tg'] = (e) => { if (!may(S.crn)) return; const k = e.dataset.k; S.st[k] = !stateOf(S.crn, k); if (S.st[k] === eff(doc(S.crn), k)) delete S.st[k]; render(true); };
  ACT['gv-all'] = (e) => { if (!may(S.crn)) return; const on = e.dataset.on === '1'; list(A.raw.gsec[S.crn]).forEach((it) => { if (eff(doc(S.crn), it.key) !== on) S.st[it.key] = on; else delete S.st[it.key]; }); render(true); };
  const changes = () => { const d = doc(S.crn), L = list(A.raw.gsec[S.crn]); return Object.keys(S.st).filter((k) => S.st[k] !== eff(d, k)).map((k) => ({ k, on: S.st[k], label: (L.find((i) => i.key === k) || { label: k }).label })); };
  ACT['gv-save'] = () => {
    const ch = changes(); if (!ch.length) return;
    modal(`<h2>تأكيد تغيير ظهور الدرجات — الشعبة ${S.crn}</h2><div class="sub">سيُطبَّق فوراً على ما يراه متدربو الشعبة. الدرجات نفسها لا تتغير.</div>
      <ul>${ch.map((c) => `<li>${c.on ? '🟢 إظهار' : '🔴 إخفاء'}: <b>${esc(c.label)}</b></li>`).join('')}</ul>
      <div class="row"><button class="btn p" data-act="gv-save-ok">تأكيد وحفظ</button><button class="btn" data-act="modal-close">رجوع</button></div>`);
  };
  /* كتابة الوثيقة كاملة: الأساس = الحالة الفعلية الآن بعد التغييرات، وما حلّ من الجدولة يُدمج ويُحذف */
  function persist(next, logRows, extra) {
    const d = doc(S.crn), w = gWho(), iso = new Date().toISOString(), L = list(A.raw.gsec[S.crn]), v = {};
    L.forEach((it) => { const cur = eff(d, it.key), want = it.key in next ? next[it.key] : cur, old = (d.v || {})[it.key];
      v[it.key] = want !== cur || !old || old.on !== want ? { on: want, at: want !== cur ? iso : (old && old.on === want ? old.at : iso), by: want !== cur ? w.id : (old && old.on === want ? old.by : w.id), byName: want !== cur ? w.name : (old && old.on === want ? old.byName : w.name) } : old; });
    const prevV = {}; L.forEach((it) => { prevV[it.key] = { on: eff(d, it.key), at: ((d.v || {})[it.key] || {}).at || '', by: ((d.v || {})[it.key] || {}).by || '', byName: ((d.v || {})[it.key] || {}).byName || '' }; });
    const now = Date.now(), sched = ((extra && extra.sched) || d.sched || []).filter((x) => Date.parse(x.at) > now);
    const hist = [{ at: iso, by: w.id, byName: w.name, ch: logRows.map((r) => [r[3], r[5]]) }].concat(d.hist || []).slice(0, 40);
    const nd = { crn: S.crn, v, prev: extra && extra.noPrev ? (d.prev || null) : prevV, sched, hist, at: iso, by: w.id, byName: w.name };
    A.raw.gvis[S.crn] = nd;
    enqueue('gvis/' + S.crn, nd, 'set');
    if (logRows.length) gLog(logRows);
  }
  ACT['gv-save-ok'] = () => {
    const ch = changes(); if (!ch.length) { closeModal(); return; }
    const next = {}; ch.forEach((c) => { next[c.k] = c.on; });
    persist(next, ch.map((c) => ['vis', S.crn, '', c.k, c.on ? 'مخفي' : 'ظاهر', c.on ? 'ظاهر' : 'مخفي', c.label]));
    S.st = {}; closeModal(); toast('حُفظت إعدادات ظهور الدرجات، وتنعكس على المتدربين فوراً.'); render(true);
  };
  ACT['gv-prev'] = () => {
    const d = doc(S.crn); if (!d.prev) return; const L = list(A.raw.gsec[S.crn]);
    const ch = L.filter((it) => d.prev[it.key] && d.prev[it.key].on !== eff(d, it.key));
    if (!ch.length) { toast('الإعداد الحالي مطابق للإعداد السابق.'); return; }
    modal(`<h2>إعادة الإعداد السابق — الشعبة ${S.crn}</h2><ul>${ch.map((it) => `<li>${d.prev[it.key].on ? '🟢 إظهار' : '🔴 إخفاء'}: <b>${esc(it.label)}</b></li>`).join('')}</ul><div class="row"><button class="btn p" data-act="gv-prev-ok">تأكيد</button><button class="btn" data-act="modal-close">رجوع</button></div>`);
  };
  ACT['gv-prev-ok'] = () => { const d = doc(S.crn), L = list(A.raw.gsec[S.crn]), next = {}, log = [];
    L.forEach((it) => { if (d.prev && d.prev[it.key] && d.prev[it.key].on !== eff(d, it.key)) { next[it.key] = d.prev[it.key].on; log.push(['vis', S.crn, '', it.key, next[it.key] ? 'مخفي' : 'ظاهر', next[it.key] ? 'ظاهر' : 'مخفي', 'إعادة الإعداد السابق: ' + it.label]); } });
    persist(next, log); S.st = {}; closeModal(); toast('أُعيد الإعداد السابق.'); render(true); };
  ACT['gv-sch'] = () => {
    const L = list(A.raw.gsec[S.crn]), d = doc(S.crn), hidden = L.filter((it) => !eff(d, it.key));
    const t0 = new Date(Date.now() + 864e5); t0.setMinutes(0, 0, 0); const loc = new Date(t0.getTime() - t0.getTimezoneOffset() * 6e4).toISOString().slice(0, 16);
    modal(`<h2>جدولة إظهار الدرجات — الشعبة ${S.crn}</h2><div class="sub">تُظهر المعايير المحددة تلقائياً في الوقت المحدد (بتوقيت جهازك)، ويطبّقها الخادم دون تدخل.</div>
      <label>التاريخ والوقت<input type="datetime-local" id="gvAt" value="${loc}"></label>
      <div class="gxopt">${(hidden.length ? hidden : L).map((it) => `<label class="ck"><input type="checkbox" name="gvk" value="${esc(it.key)}" ${hidden.length ? 'checked' : ''}> ${esc(it.label)}</label>`).join('')}</div>
      ${hidden.length ? '' : '<div class="gnote info">لا توجد معايير مخفية الآن، والقائمة تعرض الكل.</div>'}
      <div class="row"><button class="btn p" data-act="gv-sch-ok">حفظ الجدولة</button><button class="btn" data-act="modal-close">رجوع</button></div>`);
  };
  ACT['gv-sch-ok'] = () => {
    const at = ($('#gvAt') || {}).value, keys = [...document.querySelectorAll('#modal input[name="gvk"]:checked')].map((x) => x.value), t = Date.parse(at);
    if (!at || !(t > Date.now())) { toast('اختر وقتاً قادماً.'); return; }
    if (!keys.length) { toast('اختر معياراً واحداً على الأقل.'); return; }
    const d = doc(S.crn), w = gWho(), set = {}; keys.forEach((k) => { set[k] = true; });
    const item = { id: 'S' + Date.now().toString(36), at: new Date(t).toISOString(), set, by: w.id, byName: w.name };
    persist({}, [['vis', S.crn, '', keys.join('، '), '', 'إظهار مجدول', fmtAt(item.at)]], { sched: (d.sched || []).concat([item]), noPrev: true });
    closeModal(); toast('حُفظت الجدولة.'); render(true);
  };
  ACT['gv-sch-del'] = (e) => { const d = doc(S.crn), id = e.dataset.id, x = (d.sched || []).find((y) => y.id === id); if (!x) return;
    persist({}, [['vis', S.crn, '', Object.keys(x.set).join('، '), 'إظهار مجدول', 'أُلغيت الجدولة', fmtAt(x.at)]], { sched: (d.sched || []).filter((y) => y.id !== id), noPrev: true }); render(true); };
  /* معاينة ما يراه متدرب من الشعبة بالإعداد المعروض (بما فيه التغييرات غير المحفوظة) */
  function pvBody() {
    const sec = A.raw.gsec[S.crn], rows = gElFirst(sec.rows || []); if (!S.pv || !rows.some((r) => r.id === S.pv)) S.pv = (rows.find((r) => r.el) || rows[0] || {}).id || '';
    const r = rows.find((x) => x.id === S.pv), gm = A.raw.gmarks[S.crn] || {}, d = clone(doc(S.crn)); d.v = d.v || {};
    Object.entries(S.st).forEach(([k, on]) => { d.v[k] = { on }; }); d.sched = (d.sched || []).filter((x) => Date.parse(x.at) <= Date.now());
    const gr = apply({ crn: S.crn, code: sec.code || '', name: sec.name || '', term: sec.term || '', pair: sec.pair || '', comps: sec.comps || [], items: sec.items || {}, exam: sec.exam || {}, row: r ? { el: r.el, st: r.st } : null, g: (gm.g || {})[S.pv] || {}, s: (gm.s || {})[S.pv] || {} }, d);
    return `<label>المتدرب <select data-change="gv-pv-t">${rows.map((x) => `<option value="${x.id}" ${x.id === S.pv ? 'selected' : ''}>${esc(x.name)} — ${x.id}${x.el ? '' : ' (غير قابل للرصد)'}</option>`).join('')}</select></label>
      ${Object.keys(S.st).length ? '<div class="gnote warn">المعاينة تشمل التغييرات غير المحفوظة.</div>' : ''}
      <div class="gvpv" dir="rtl">${window.HAADER_TPG ? window.HAADER_TPG.card(gr) : ''}</div>`;
  }
  ACT['gv-pv'] = () => { modal(`<h2>معاينة واجهة المتدرب — الشعبة ${S.crn}</h2><div id="gvPv">${pvBody()}</div><div class="row"><button class="btn" data-act="modal-close">إغلاق</button></div>`, 'wide'); };
  CHG['gv-pv-t'] = (e) => { S.pv = e.value; const b = document.getElementById('gvPv'); if (b) b.innerHTML = pvBody(); };
  Object.assign(GACT, { vis: 'ظهور الدرجات للمتدربين' });
})();
