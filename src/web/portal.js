/* ====================================================================
   بوابة المتدرب: يدخل برقمه التدريبي، ويرى مقرراته وشعبه وسجل حضوره
   وغيابه ونسبته وحالة الإنذار والحرمان وتنبيهاته — بياناته وحده.
   ويسجّل حضوره بمسح رمز QR الذي يعرضه المدرب في القاعة.
   البيانات من دالة trainee_me على الخادم، والحساب بمحرك المنصة نفسه.
   ==================================================================== */
if (window.HAADER_WEB) (() => {
  const W = window.HAADER_WEB;
  const P = { me: null, data: null, m: null, qr: null, busy: false, err: '' };
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
  async function load() {
    P.busy = true; P.err = ''; paint();
    try {
      P.data = await W.rpc('trainee_me', {});
      const meta = P.data.meta || {};
      P.m = H.build({ sections: P.data.sections, marks: P.data.marks, notes: {}, calendar: (meta.calendar || {}).rows || [], settings: meta.settings || {}, excuses: (meta.excuses || {}).rows || [], reinstated: (meta.reinstated || {}).rows || [] });
    } catch (e) { P.err = e.message || 'تعذر تحميل بياناتك.'; }
    P.busy = false; paint();
    if (P.data && P.data.acc && P.data.acc.temp && !P.askedPw) { P.askedPw = true; pwBox(true); }
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
    root.innerHTML = `<header class="tp-head"><div class="tp-org"><div class="lgplate"><img src="${LOGO}" alt="${LOGO_ALT}"></div><div class="lgdept">${esc(dept)}</div></div><div class="tp-who"><b>${esc(name)}</b><small>الرقم التدريبي ${esc((P.data && P.data.id) || (P.me && P.me.id) || '')}</small></div><div class="tp-act"><button class="btn" data-tp="pw">كلمة المرور</button><button class="btn" data-tp="out">خروج</button></div></header>
    <main class="tp-main">
      ${qrCard()}
      ${P.busy ? '<section class="tp-card"><h2>جارٍ تحميل بياناتك…</h2><div class="gspin"></div></section>' : ''}
      ${P.err ? `<section class="tp-card bad"><h2>تعذر تحميل بياناتك</h2><p>${esc(P.err)}</p><button class="btn p" data-tp="reload">إعادة المحاولة</button></section>` : ''}
      ${!P.busy && P.data ? `
      <section class="tp-card"><h2>التنبيهات</h2>${alerts.length ? `<ul class="tp-alerts">${alerts.map((a) => `<li class="${a[0]}">${esc(a[1])}</li>`).join('')}</ul>` : '<p class="sub">لا تنبيهات. استمر على انتظامك.</p>'}</section>
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
    if (k === 'out') W.signOut();
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
    const q = /(?:^#|&)qr=([^&]+)/.exec(location.hash); if (!q || W.phase !== 'trainee') return;
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    checkin(decodeURIComponent(q[1])).then(load);
  });
  window.HAADER_PORTAL = { start, load, P };
})();
