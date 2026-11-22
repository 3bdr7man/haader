/* ====================================================================
   بوابة المتدرب: يدخل برقمه التدريبي، ويرى مقرراته وشعبه وسجل حضوره
   وغيابه ونسبته وحالة الإنذار والحرمان وتنبيهاته، ودرجاته (أعمال السنة والاختبار
   الأول والثاني والنهائي، نظري وعملي) — بياناته وحده.
   ويسجّل حضوره بمسح رمز QR الذي يعرضه المدرب في القاعة.
   البيانات من دالة trainee_me على الخادم، والحساب بمحرك المنصة نفسه.
   ومعاينة المسؤول: يرى البوابة كما يراها متدرب بعينه (للاطلاع والتطوير)،
   من trainee_preview في الويب، ومن بيانات المنصة نفسها في نسخة Claude.
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const W = window.HAADER_WEB || null;
  const P = { me: null, data: null, m: null, qr: null, busy: false, err: '', pv: null };
  const DAYS_AR = { 'ح': 'حاضر', 'غ': 'غائب', 'س': 'مستأذن', 'ملغ': 'محاضرة ملغاة', 'سحب': 'منسحب' };
  const codeText = (c) => (!c ? '—' : H.isLate(c) ? `متأخر ${H.lateMin(c)} د` : DAYS_AR[c] || c);
  const codeTone = (c) => (!c ? '' : c === 'ح' ? 'ok' : c === 'غ' ? 'bad' : H.isLate(c) ? 'warn' : c === 'س' ? 'info' : '');
  const WHY = {
    format: 'هذا ليس رمز تحضير من منصة حاضر.', unknown: 'الرمز لا يخص أي جلسة تحضير.', forged: 'الرمز غير صحيح.',
    revoked: 'ألغى المدرب هذا الرمز وأصدر رمزاً جديداً. امسح الرمز المعروض الآن.', early: 'لم يبدأ التحضير بعد.',
    late: 'انتهى وقت التحضير لهذه المحاضرة. راجع مدرب المقرر.', stale: 'الرمز قديم (صورة أو رابط معاد إرساله). امسح الرمز المعروض في القاعة الآن.',
    notin: 'لست مسجلاً في هذه الشعبة.', dup: 'حضورك مسجل مسبقاً في هذه المحاضرة.', notrainee: 'هذا الرمز للمتدربين.',
  };

  async function start(me) {
    P.me = me;
    $('#gate').hidden = true; $('#shell').hidden = true;
    let root = $('#tportal');
    if (!root) { root = document.createElement('div'); root.id = 'tportal'; root.dir = 'rtl'; root.lang = 'ar'; document.body.appendChild(root); }
    paint();
    try { await W.rpc('trainee_touch', {}); } catch (e) { /* لا يمنع العرض */ }
    const code = W.takeQr();
    if (code) await checkin(code);
    await load();
  }
  /* بيانات المتدرب من قاعدة المنصة نفسها (نسخة Claude) بالشكل الذي تعيده trainee_me */
  function localData(t) {
    const secs = {}, mks = {}, has = (x) => JSON.stringify(x || '').includes('"' + t + '"');
    Object.entries(A.raw.sections || {}).forEach(([crn, sec]) => {
      const row = (sec.rows || []).find((r) => r.id === t); if (!row) return;
      const c = Object.assign({}, sec); delete c.sheet; c.rows = [row]; c.trainerName = ((A.raw.accounts || {})[sec.trainer] || {}).name || '';
      secs[crn] = c; mks[crn] = { m: { [t]: (((A.raw.marks || {})[crn] || {}).m || {})[t] || {} } };
    });
    const M = A.raw.meta || {}, rowsOf = (k) => ({ rows: ((M[k] || {}).rows || []).filter(has) });
    const name = Object.values(secs).map((x) => x.rows[0].name).find(Boolean) || '';
    const warn = Object.values(A.raw.warnlog || {}).filter((w) => w && w.id === t && (w.status || 'ok') === 'ok').sort((a, b) => String(b.at).localeCompare(String(a.at))).map((w) => ({ at: w.at, crn: w.crn, course: w.course, type: w.type, reason: w.reason }));
    const ta = (A.raw.tacc || {})[t];
    const grades = {};
    Object.entries(A.raw.gsec || {}).forEach(([crn, g]) => {
      const row = (g.rows || []).find((r) => r.id === t); if (!row) return;
      const gm = (A.raw.gmarks || {})[crn] || {};
      grades[crn] = { crn, code: g.code || '', name: g.name || '', term: g.term || '', pair: g.pair || '', comps: g.comps || [], items: g.items || {}, exam: g.exam || {}, row: { el: row.el, st: row.st }, g: (gm.g || {})[t] || {}, s: (gm.s || {})[t] || {} };
    });
    return { id: t, name, grades, sections: secs, marks: mks, meta: { calendar: M.calendar || {}, settings: M.settings || {}, timeline: M.timeline || null, excuses: rowsOf('excuses'), reinstated: rowsOf('reinstated') }, warn, acc: ta ? { temp: !!ta.temp, st: ta.st || '' } : null };
  }
  async function load() {
    P.busy = true; P.err = ''; paint();
    try {
      P.data = P.pv ? (W ? await W.rpc('trainee_preview', { p_id: P.pv }) : localData(P.pv)) : await W.rpc('trainee_me', {});
      const meta = P.data.meta || {};
      P.m = H.build({ sections: P.data.sections, marks: P.data.marks, notes: {}, calendar: (meta.calendar || {}).rows || [], settings: meta.settings || {}, excuses: (meta.excuses || {}).rows || [], reinstated: (meta.reinstated || {}).rows || [] });
    } catch (e) { P.err = e.message || 'تعذر تحميل بياناتك.'; }
    P.busy = false; paint();
    if (!P.pv && P.data && P.data.acc && P.data.acc.temp && !P.askedPw) { P.askedPw = true; pwBox(true); }
  }
  async function checkin(code) {
    P.qr = { busy: true }; paint();
    try { P.qr = await W.rpc('qr_checkin', { p_code: code }); }
    catch (e) { P.qr = { ok: false, why: '', msg: e.message }; }
    paint();
  }

  /* ---------- الحساب لكل مقرر ---------- */
  function rowsOf() {
    if (!P.m) return [];
    return P.m.sections.map((sec) => {
      const row = sec.rows.find((r) => r.id === P.data.id); if (!row) return null;
      const st = H.stat(P.m, sec, row), [warn, dep] = H.limits(P.m, sec);
      const dur = Math.max(0, ...(sec.meets || []).map((x) => +x.dur || 0)) || 0;
      const absMin = st.absent * dur;
      const status = st.withdrawn ? ['منسحب', ''] : st.cat === 2 ? ['محروم', 'bad'] : st.cat === 1 ? (dep - st.absent <= 1 ? ['إنذار — قريب من الحرمان', 'bad'] : ['إنذار', 'warn']) : warn - st.absent <= 1 && st.absent > 0 ? ['قريب من الإنذار', 'warn'] : ['منتظم', 'ok'];
      const log = sec.dates.map((d, i) => ({ d, c: st.codes[i], cal: P.m.calBy[d] })).filter((x) => x.c);
      return { sec, st, warn, dep, dur, absMin, status, log };
    }).filter(Boolean);
  }
  const hrs = (min) => { const h = Math.floor(min / 60), m = min % 60; return min ? `${h ? h + ' س' : ''}${h && m ? ' و' : ''}${m ? m + ' د' : ''}` : '0'; };
  const pct = (x) => (x * 100).toFixed(1).replace(/\.0$/, '') + '%';

  /* ---------- العرض ---------- */
  function qrCard() {
    const q = P.qr; if (!q) return '';
    if (q.busy) return '<section class="tp-card tp-qr"><h2>جارٍ تسجيل حضورك…</h2><div class="gspin"></div></section>';
    if (q.ok) return `<section class="tp-card tp-qr ok" role="status"><div class="tp-big">✓</div><h2>سُجّل حضورك</h2><p>${esc(q.course || '')} — الشعبة ${esc(q.crn || '')} • ${esc(q.d || '')}هـ</p><p class="tp-st">${q.late ? `متأخر ${q.late} دقيقة` : 'حاضر'}${q.applied && q.applied.startsWith('بقي') ? ` <small>(${esc(q.applied)} في الكشف)</small>` : ''}</p><p class="sub">وقت التسجيل: ${new Date(q.at).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' })}</p></section>`;
    return `<section class="tp-card tp-qr bad" role="alert"><div class="tp-big">!</div><h2>لم يُسجَّل الحضور</h2><p>${esc(q.msg || WHY[q.why] || 'تعذر التسجيل.')}</p>${q.course ? `<p class="sub">${esc(q.course)}</p>` : ''}</section>`;
  }
  /* ---------- درجاتي: أعمال السنة (البنود والاختبار الأول والثاني) والاختبار النهائي، نظري وعملي ---------- */
  const gnum = (v) => typeof v === 'number' && isFinite(v);
  const gfmt = (v) => String(Math.round(v * 100) / 100);
  const ITEM_LABEL = (n) => (/الشهري\s*(1|١|الأول)/.test(n) ? 'الاختبار الأول' : /الشهري\s*(2|٢|الثاني)/.test(n) ? 'الاختبار الثاني' : n);
  const PART_ORDER = (p) => (p === 'نظري' ? 0 : p === 'عملي' ? 1 : 2);
  function gradeModel(gr) {
    const comps = (gr.comps || []).slice().sort((a, b) => PART_ORDER(a.part) - PART_ORDER(b.part) || String(a.k).localeCompare(String(b.k)));
    const parts = [...new Set(comps.map((c) => c.part || 'أخرى'))];
    const isFinal = (c) => /2$/.test(c.k) || /نهائي/.test(c.desc || '');
    const cols = parts.map((p) => {
      const cs = comps.filter((c) => (c.part || 'أخرى') === p);
      const work = cs.find((c) => !isFinal(c)) || null, fin = cs.find(isFinal) || null;
      return { p, work, fin, other: cs.filter((c) => c !== work && c !== fin) };
    });
    const itemNames = []; cols.forEach((c) => ((c.work && (gr.items || {})[c.work.k]) || []).forEach((it) => { if (!itemNames.includes(it.n)) itemNames.push(it.n); }));
    const g = gr.g || {}, s = gr.s || {};
    const cell = (v, max, cls) => `<td class="n${cls ? ' ' + cls : ''}"${gnum(v) && gnum(max) && typeof gToneAt === 'function' ? gToneAt(v, max) : ''}>${gnum(v) ? `<b>${gfmt(v)}</b>` : '<span class="tp-gx">—</span>'}${gnum(max) ? `<small> / ${gfmt(max)}</small>` : ''}</td>`;
    const rows = [];
    itemNames.forEach((n) => rows.push(`<tr><th>${esc(ITEM_LABEL(n))}</th>${cols.map((c) => { const it = c.work && ((gr.items || {})[c.work.k] || []).find((x) => x.n === n); return it ? cell((s[c.work.k] || {})[n], it.max) : '<td></td>'; }).join('')}</tr>`));
    const workVal = (c) => { if (!c.work) return null; const v = g[c.work.k]; if (gnum(v)) return v; const its = (gr.items || {})[c.work.k] || [], sv = s[c.work.k] || {}; const got = its.filter((it) => gnum(sv[it.n])); return got.length ? { partial: Math.round(got.reduce((a, it) => a + sv[it.n], 0) * 100) / 100 } : null; };
    rows.push(`<tr class="sum"><th>مجموع أعمال السنة</th>${cols.map((c) => { if (!c.work) return '<td></td>'; const v = workVal(c); return v && typeof v === 'object' ? `<td class="n"><b>${gfmt(v.partial)}</b><small> / ${gfmt(c.work.max)}</small><em class="tp-gp">حتى الآن</em></td>` : cell(v, c.work.max); }).join('')}</tr>`);
    cols.forEach((c) => c.other.forEach((o) => rows.push(`<tr><th>${esc(o.desc || o.k)}</th>${cols.map((x) => (x === c ? cell(g[o.k], o.max) : '<td></td>')).join('')}</tr>`)));
    rows.push(`<tr class="fin"><th>الاختبار النهائي</th>${cols.map((c) => (c.fin ? cell(g[c.fin.k], c.fin.max) : '<td></td>')).join('')}</tr>`);
    const partTot = cols.map((c) => { const cs = [c.work, c.fin].concat(c.other).filter(Boolean); const max = cs.reduce((a, x) => a + (+x.max || 0), 0), got = cs.filter((x) => gnum(g[x.k])); return { max, v: got.length ? got.reduce((a, x) => a + g[x.k], 0) : null, full: got.length === cs.length }; });
    if (cols.length > 1) rows.push(`<tr class="sum tot"><th>مجموع الجزء</th>${partTot.map((t) => cell(t.v, t.max)).join('')}</tr>`);
    const max = comps.reduce((a, c) => a + (+c.max || 0), 0), got = comps.filter((c) => gnum(g[c.k])), tot = got.reduce((a, c) => a + g[c.k], 0);
    return { cols, rows, max, tot, n: got.length, need: comps.length };
  }
  function gradesCards() {
    const G0 = P.data && P.data.grades; if (!G0) return '';
    const list = Object.values(G0).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar') || String(a.crn).localeCompare(String(b.crn)));
    if (!list.length) return '<section class="tp-card tp-grades"><h2>درجاتي</h2><p class="sub">لا توجد لك شعبة رصد درجات في المنصة بعد.</p></section>';
    return list.map((gr) => {
      const m = gradeModel(gr), el = !gr.row || gr.row.el !== false;
      const chip = !m.n ? ['لم تُرصد بعد', ''] : m.n === m.need ? [`${gfmt(m.tot)} من ${gfmt(m.max)}`, 'ok'] : [`المرصود ${gfmt(m.tot)}`, 'info'];
      const ex = gr.exam || {}, exTxt = [ex.date, ex.time, ex.place].filter(Boolean).map(esc).join(' • ');
      return `<section class="tp-card tp-grades"><div class="tp-ch"><div><h2>درجاتي — ${esc(gr.name)}</h2><p class="sub">${esc(gr.code)} • شعبة الرصد ${esc(gr.crn)}${gr.pair ? ` (العملي في الشعبة ${esc(gr.pair)})` : ''}${gr.term ? ' • ' + esc(gr.term) : ''}</p></div><span class="chip ${chip[1]}">${chip[0]}</span></div>
        ${el ? '' : `<div class="tp-gnote warn">حالتك في رايات «${esc((gr.row && gr.row.st) || '')}»، فلا تُرصد لك درجات في هذه الشعبة. راجع مدرب المقرر.</div>`}
        <div class="tw"><table class="tp-gt"><thead><tr><th>البند</th>${m.cols.map((c) => `<th class="n">${esc(c.p)}</th>`).join('')}</tr></thead><tbody>${m.rows.join('')}</tbody></table></div>
        ${typeof gToneKey === 'string' ? `<div class="sub" style="margin-top:4px">${gToneKey}</div>` : ''}
        ${exTxt ? `<p class="sub">موعد الاختبار النهائي: ${exTxt}</p>` : ''}
        <p class="sub">${m.n ? `رُصد ${m.n} من ${m.need} مكوّنات. ` : 'لم يرصد المدرب درجاتك في هذا المقرر بعد، والجدول يبيّن توزيع الدرجات المعتمد. '}الدرجات كما رصدها مدرب المقرر في المنصة، والمعتمد النهائي ما يُرصد في رايات.</p></section>`;
    }).join('');
  }
  function paint() {
    const root = $('#tportal'); if (!root) return;
    const rows = rowsOf(), name = (P.data && P.data.name) || (P.me && P.me.name) || '';
    const alerts = [];
    rows.forEach((r) => {
      if (r.st.withdrawn) return;
      if (r.st.cat === 2) alerts.push(['bad', `حُرمت من مقرر «${r.sec.course}» لبلوغ غيابك ${r.st.absent} محاضرات.`]);
      else if (r.st.cat === 1) alerts.push([r.dep - r.st.absent <= 1 ? 'bad' : 'warn', `بلغت حد الإنذار في «${r.sec.course}». يبقى ${r.dep - r.st.absent} قبل الحرمان.`]);
      else if (r.st.absent && r.warn - r.st.absent <= 1) alerts.push(['warn', `اقتربت من الإنذار في «${r.sec.course}»: يبقى غياب واحد.`]);
    });
    ((P.data && P.data.warn) || []).forEach((w) => alerts.push(['info', `أُرسل إليك ${w.type === 'dep' ? 'إشعار حرمان' : w.type === 'warn' ? 'إنذار' : 'تنبيه'} في «${w.course || w.crn}» بتاريخ ${String(w.at || '').slice(0, 10)}.`]));
    const dept = ((P.m && P.m.sections.find((x) => x.dept)) || {}).dept || DEPT;
    const pv = P.pv ? `<div class="tp-pv" role="status"><span>معاينة كما يراها المتدرب — للاطلاع فقط، ولا يُسجَّل أي إجراء باسمه.</span><span class="row"><button class="btn s" data-tp="pv-other">متدرب آخر</button><button class="btn s" data-tp="pv-end">العودة إلى المنصة</button></span></div>` : '';
    root.innerHTML = `${pv}<header class="tp-head"><div class="tp-org"><div class="lgplate"><img src="${LOGO}" alt="${LOGO_ALT}"></div><div class="lgdept">${esc(dept)}</div></div><div class="tp-who"><b>${esc(name)}</b><small>الرقم التدريبي ${esc((P.data && P.data.id) || (P.me && P.me.id) || '')}</small></div><div class="tp-act">${P.pv ? '' : '<button class="btn" data-tp="pw">كلمة المرور</button><button class="btn" data-tp="out">خروج</button>'}</div></header>
    <main class="tp-main">
      ${qrCard()}
      ${P.busy ? '<section class="tp-card"><h2>جارٍ تحميل بياناتك…</h2><div class="gspin"></div></section>' : ''}
      ${P.err ? `<section class="tp-card bad"><h2>تعذر تحميل بياناتك</h2><p>${esc(P.err)}</p><button class="btn p" data-tp="reload">إعادة المحاولة</button></section>` : ''}
      ${!P.busy && P.data ? `
      <section class="tp-card"><h2>التنبيهات</h2>${alerts.length ? `<ul class="tp-alerts">${alerts.map((a) => `<li class="${a[0]}">${esc(a[1])}</li>`).join('')}</ul>` : '<p class="sub">لا تنبيهات. استمر على انتظامك.</p>'}</section>
      ${window.HAADER_TL ? window.HAADER_TL.bar((P.data.meta || {}).timeline, 'tp') : ''}
      ${gradesCards()}
      ${window.HAADER_ADV ? window.HAADER_ADV.portalCard(P.data.id) : ''}
      ${rows.length ? rows.map((r) => `<section class="tp-card tp-course"><div class="tp-ch"><div><h2>${esc(r.sec.course)}</h2><p class="sub">${esc(r.sec.kind || '')} • الشعبة ${esc(r.sec.crn)}${r.sec.trainerName ? ' • المدرب: ' + esc(r.sec.trainerName) : ''}${(r.sec.meets || []).length ? ' • ' + r.sec.meets.map((x) => esc(x.day + ' ' + x.start)).join('، ') : ''}</p></div><span class="chip ${r.status[1]}">${r.status[0]}</span></div>
        <div class="tp-kpi"><div><b>${r.st.pres + r.st.late}</b><span>حضور</span></div><div><b>${r.st.absent}</b><span>غياب محتسب</span></div><div><b>${hrs(r.absMin)}</b><span>ساعات الغياب</span></div><div><b>${pct(r.st.rate)}</b><span>نسبة الغياب</span></div><div><b>${r.st.late}</b><span>تأخير${r.st.lateMins ? ` (${r.st.lateMins} د)` : ''}</span></div></div>
        <div class="tp-bar" role="img" aria-label="الغياب ${r.st.absent} من حد الحرمان ${r.dep}"><i style="width:${Math.min(100, (r.st.absent / Math.max(1, r.dep)) * 100)}%" class="${r.status[1]}"></i><em style="inset-inline-start:${(r.warn / Math.max(1, r.dep)) * 100}%"></em></div>
        <p class="sub">حد الإنذار ${r.warn} وحد الحرمان ${r.dep} محاضرات غياب. ${r.st.withdrawn ? '' : `يبقى ${typeof r.st.leftWarn === 'number' ? r.st.leftWarn + ' قبل الإنذار و' : ''}${typeof r.st.leftDep === 'number' ? r.st.leftDep + ' قبل الحرمان' : 'بلغت حد الحرمان'}.`}${r.st.lateAbs ? ` التأخير أكثر من ${P.m.s.lateLimit} دقيقة يُحتسب غياباً (${r.st.lateAbs}).` : ''}</p>
        <details><summary>سجل الحضور (${r.log.length} محاضرة)</summary>${r.log.length ? `<div class="tw"><table><thead><tr><th>التاريخ</th><th>اليوم</th><th>الحالة</th></tr></thead><tbody>${r.log.slice().reverse().map((x) => `<tr><td class="n">${esc(x.d)}</td><td>${esc((x.cal && x.cal.day) || '')}</td><td><span class="chip ${codeTone(x.c)}">${esc(codeText(x.c))}</span></td></tr>`).join('')}</tbody></table></div>` : '<p class="sub">لم يُسجَّل شيء بعد.</p>'}</details></section>`).join('') : '<section class="tp-card"><h2>لا مقررات</h2><p class="sub">لا تظهر لك شعب في المنصة بعد. راجع مدرب المقرر.</p></section>'}
      <section class="tp-card"><h2>تسجيل الحضور بـQR</h2><p class="sub">امسح الرمز المعروض في القاعة بكاميرا الجوال، فيفتح هذه الصفحة ويُسجَّل حضورك مباشرة. الرمز يتجدد كل نصف دقيقة، فلا تنفع صورته خارج القاعة.</p></section>` : ''}
    </main>
    <footer class="tp-foot">${ORG} — ${COLLEGE}</footer>`;
  }
  function pwBox(force) {
    const w = document.createElement('div'); w.className = 'tp-modal'; w.dir = 'rtl';
    w.innerHTML = `<form class="tp-card stack" data-tpf="pw"><h2>${force ? 'غيّر كلمة المرور المؤقتة' : 'تغيير كلمة المرور'}</h2>${force ? '<p class="sub">استلمت كلمة مرور مؤقتة من مدرب المقرر. اختر كلمة مرور خاصة بك.</p>' : ''}
      <label>كلمة المرور الجديدة<input type="password" id="tpN" dir="ltr" minlength="8" autocomplete="new-password" required></label><label>تأكيدها<input type="password" id="tpR" dir="ltr" minlength="8" autocomplete="new-password" required></label>
      <div class="err" id="tpE" hidden></div><div class="row"><button class="btn p" type="submit">حفظ</button><button class="btn" type="button" data-tp="close">${force ? 'لاحقاً' : 'إلغاء'}</button></div></form>`;
    document.body.appendChild(w); setTimeout(() => $('#tpN').focus(), 30);
  }
  document.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-tp]'); if (!b) return;
    const k = b.dataset.tp;
    if (k === 'out') { if (W) W.signOut(); }
    else if (k === 'pv-end') endPreview();
    else if (k === 'pv-other') pickTrainee();
    else if (k === 'reload') load();
    else if (k === 'pw') pwBox(false);
    else if (k === 'close') { const m = b.closest('.tp-modal'); if (m) m.remove(); }
  });
  document.addEventListener('submit', async (ev) => {
    const f = ev.target.closest('[data-tpf="pw"]'); if (!f) return;
    ev.preventDefault(); ev.stopPropagation();
    const n = $('#tpN').value, r = $('#tpR').value, e = $('#tpE');
    const fail = (t) => { e.hidden = false; e.textContent = t; };
    if (n.length < 8) return fail('كلمة المرور 8 أحرف على الأقل.');
    if (n !== r) return fail('كلمتا المرور غير متطابقتين.');
    if (/^\d+$/.test(n) || n === (P.data && P.data.id)) return fail('اختر كلمة مرور لا تكون أرقاماً فقط ولا رقمك التدريبي.');
    try {
      const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
      const hash = await W.pbkdf2(n, salt, 150000);
      await W.rpc('trainee_set_password', { p_salt: salt, p_iter: 150000, p_hash: hash });
      f.closest('.tp-modal').remove(); if (P.data && P.data.acc) P.data.acc.temp = false;
      toast('تغيّرت كلمة المرور.');
    } catch (x) { fail(x.message || 'لم تُحفظ كلمة المرور.'); }
  }, true);
  /* رمز QR ممسوح والصفحة مفتوحة أصلاً */
  window.addEventListener('hashchange', () => {
    const q = /(?:^#|&)qr=([^&]+)/.exec(location.hash); if (!q || !W || W.phase !== 'trainee' || P.pv) return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    checkin(decodeURIComponent(q[1])).then(load);
  });
  /* ---------- معاينة المسؤول ---------- */
  const mayPreview = () => !!(A.me && A.me.role === 'admin' && !A.asTrainer);
  function trainees() {
    const o = {};
    Object.values(A.raw.sections || {}).forEach((s) => (s.rows || []).forEach((r) => { const x = o[r.id] || (o[r.id] = { id: r.id, name: r.name, secs: [] }); x.secs.push(s.crn); }));
    return Object.values(o).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ar'));
  }
  const listHtml = (q) => { const n = String(q || '').trim(), L = trainees().filter((t) => !n || t.id.includes(n) || String(t.name).includes(n)); return L.slice(0, 80).map((t) => `<button data-act="tp-preview-go" data-id="${esc(t.id)}"><span>${esc(t.name)}</span><small>${esc(t.id)} • ${t.secs.map(esc).join('، ')}</small></button>`).join('') || '<p class="sub">لا نتائج.</p>'; };
  function pickTrainee() {
    if (!mayPreview()) return;
    if (P.pv) endPreview(true);
    modal(`<h2>معاينة بوابة المتدرب</h2><div class="sub">اختر متدرباً لترى البوابة كما تظهر له: مقرراته ودرجاته وحضوره وغيابه وتنبيهاته. للاطلاع فقط، ولا يُسجَّل أي إجراء باسمه.</div><label>بحث بالاسم أو الرقم التدريبي<input type="search" id="tpvQ" autocomplete="off"></label><div class="tpv-list" id="tpvL">${listHtml('')}</div><div class="row"><button class="btn" data-act="modal-close">إغلاق</button></div>`);
    setTimeout(() => { const i = document.getElementById('tpvQ'); if (i) i.focus(); }, 30);
  }
  document.addEventListener('input', (ev) => { if (ev.target && ev.target.id === 'tpvQ') { const l = document.getElementById('tpvL'); if (l) l.innerHTML = listHtml(ev.target.value); } });
  async function preview(id) {
    if (!mayPreview()) return;
    closeModal();
    P.pv = id; P.data = null; P.m = null; P.qr = null; P.err = '';
    let root = $('#tportal');
    if (!root) { root = document.createElement('div'); root.id = 'tportal'; root.dir = 'rtl'; root.lang = 'ar'; document.body.appendChild(root); }
    root.hidden = false; $('#shell').hidden = true; window.scrollTo(0, 0);
    await load();
    try { audit([[new Date().toISOString(), '—', id, 'معاينة بوابة المتدرب', '', '', 'معاينة البوابة كما يراها المتدرب', 'معاينة', A.me ? A.me.name : '']]); } catch (e) { /* السجل لا يمنع العرض */ }
  }
  function endPreview(keep) {
    P.pv = null; P.data = null; P.m = null;
    const root = $('#tportal'); if (root) root.remove();
    $('#shell').hidden = false; if (!keep) { render(true); window.scrollTo(0, 0); }
  }
  /* أثناء المعاينة تبقى المنصة مخفية حتى لو أُعيد رسمها بتحديث البيانات */
  const baseRenderPv = render;
  render = function () { const r = baseRenderPv.apply(this, arguments); if (P.pv) { const sh = $('#shell'); if (sh) sh.hidden = true; } return r; };
  ACT['tp-preview'] = () => pickTrainee();
  ACT['tp-preview-go'] = (e) => preview(e.dataset.id);
  /* زر في بطاقة الحساب (يظهر أيضاً في نافذة الملف الشخصي) */
  const baseBuildNav = buildNav;
  buildNav = function () {
    baseBuildNav();
    const c = $('#who'); if (!c || !mayPreview()) return;
    const b = document.createElement('button'); b.className = 'wbtn swtr tpv'; b.dataset.act = 'tp-preview'; b.textContent = 'معاينة بوابة المتدرب';
    const row = c.querySelector('.row'); (row || c).insertAdjacentElement(row ? 'beforebegin' : 'beforeend', b);
  };
  window.HAADER_PORTAL = { start, load, P, preview, endPreview, localData };
})();
