/* ====================================================================
   «نسيت كلمة المرور؟» (نسخة الويب: الدخول وكلمات المرور فيها وحدها)
   - صفحة الدخول: طلب باسم المستخدم أو الرقم التدريبي أو البريد المرتبط بالحساب. الرد واحد دائماً
     فلا يُكشف هل الحساب مسجل. يصل الطلب إلى مسؤول المنصة.
   - مسؤول المنصة: نافذة «طلبات كلمة المرور» بوقت الطلب والإجراء المتخذ ومنفّذه. المعالجة برابط
     إعادة تعيين لمرة واحدة محدود المدة يُرسل إلى بريد صاحب الحساب (لا كلمة مرور في أي رسالة)،
     أو بإغلاق الطلب بالإجراء المتخذ.
   - صاحب الرابط: يعيّن كلمة مرور جديدة بنفسه؛ تصل إلى الخادم بصمة PBKDF2 لا الكلمة.
   الخادم: supabase/11_pw_reset.sql
   ==================================================================== */
if (document.getElementById('shell') && window.HAADER_WEB) (() => {
  const W = window.HAADER_WEB;
  const F = { mode: '', sent: false, err: '', busy: false, token: '', check: null, done: '' };
  const mt = /(?:^#|&)reset=([0-9a-f]{64})(?:&|$)/.exec(location.hash || '');
  if (mt) {
    F.mode = 'reset'; F.token = mt[1];
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* يبقى الرمز في الذاكرة */ }
  }
  const refresh = () => { try { if (window.HAADER_WEB_RENDER) window.HAADER_WEB_RENDER(); else render(true); } catch (e) { /* */ } };
  const back = '<p class="sub gatehelp"><button type="button" class="linkbtn" data-act="pw-back">العودة إلى تسجيل الدخول</button></p>';
  const tm = (iso) => { try { return new Date(iso).toLocaleString('ar-SA-u-nu-latn-ca-gregory', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Riyadh' }); } catch (e) { return String(iso || ''); } };

  function gate() {
    if (F.mode === 'forgot') {
      const as = F.as || 'trainee';
      const AS = { trainee: ['متدرب', 'الرقم التدريبي أو بريدك التدريبي', 'numeric', 'بريدك التدريبي (الرقم التدريبي@tvtc.edu.sa)'], trainer: ['مدرب', 'اسم المستخدم أو البريد المرتبط بحسابك', 'text', 'بريدك المسجل في المنصة'], head: ['رئيس القسم', 'اسم المستخدم أو البريد المرتبط بحسابك', 'text', 'بريدك المسجل في المنصة'] };
      const a = AS[as];
      if (F.sent) return { key: 'pw-sent' + as, inner: `<h2>استلمنا طلبك</h2><div class="okbox" role="status">إن كان ما كتبته مرتبطاً بحساب ${a[0] === 'متدرب' ? 'متدرب' : a[0]} في المنصة فقد وصل طلبك إلى مسؤول المنصة، وسيتولى متابعة حالتك. يصلك على ${a[3]} رابط آمن لمرة واحدة تعيّن به كلمة مرور جديدة بنفسك. لن تُرسل إليك كلمة مرور في أي رسالة.</div>${back}` };
      return { key: 'pw-forgot' + as + (F.busy ? 'b' : '') + (F.err ? 'e' + F.err.length : ''), inner: `<h2>نسيت كلمة المرور؟</h2><p class="sub">اختر نوع حسابك، واكتب ما يعرّف به، ثم أرسل الطلب إلى مسؤول المنصة.</p>
        <form class="stack" data-pwf novalidate><div class="pwas" role="radiogroup" aria-label="نوع الحساب">${Object.keys(AS).map((k) => `<label class="pwas-o${k === as ? ' on' : ''}"><input type="radio" name="pwas" value="${k}" ${k === as ? 'checked' : ''}> ${AS[k][0]}</label>`).join('')}</div>
        <label>${a[1]}<input type="text" id="pfU" dir="ltr" inputmode="${a[2]}" autocomplete="username" autocapitalize="none" spellcheck="false" maxlength="200" value="${esc(F.v || '')}"></label>
        <div id="pfE" class="err" role="alert" ${F.err ? '' : 'hidden'}>${esc(F.err)}</div>
        <button class="btn p" id="pfB" type="submit" ${F.busy ? 'disabled' : ''}>${F.busy ? 'جارٍ الإرسال…' : 'إرسال الطلب'}</button></form>${back}` };
    }
    if (F.mode === 'reset') {
      if (F.done) return { key: 'pw-done', inner: `<h2>تغيّرت كلمة المرور</h2><div class="okbox" role="status">عُيّنت كلمة المرور الجديدة للحساب <b dir="ltr">${esc(F.done)}</b>. سجّل الدخول بها الآن.</div><p class="sub gatehelp"><button type="button" class="btn p" data-act="pw-back">تسجيل الدخول</button></p>` };
      const c = F.check;
      if (!c) return { key: 'pw-check', inner: '<h2>إعادة تعيين كلمة المرور</h2><p class="sub">جارٍ التحقق من الرابط…</p><div class="gspin" aria-hidden="true"></div>' };
      if (!c.ok) {
        const why = c.why === 'used' ? 'استُخدم هذا الرابط من قبل.' : c.why === 'expired' ? 'انتهت صلاحية هذا الرابط.' : c.why === 'net' ? 'تعذر التحقق من الرابط الآن. تحقق من الاتصال وأعد فتحه.' : 'هذا الرابط غير صالح.';
        return { key: 'pw-bad' + c.why, inner: `<h2>إعادة تعيين كلمة المرور</h2><div class="err" role="alert">${why}</div><p class="sub">اطلب رابطاً جديداً من «نسيت كلمة المرور؟».</p><p class="sub gatehelp"><button type="button" class="btn" data-act="pw-forgot">طلب جديد</button> <button type="button" class="linkbtn" data-act="pw-back">العودة إلى تسجيل الدخول</button></p>` };
      }
      return { key: 'pw-reset' + (F.busy ? 'b' : '') + (F.err ? 'e' + F.err.length : ''), inner: `<h2>تعيين كلمة مرور جديدة</h2><p class="sub">للحساب <b dir="ltr">${esc(c.login || '')}</b>. الرابط صالح مرة واحدة حتى ${esc(tm(c.exp))}.</p>
        <form class="stack" data-pwr novalidate><label>كلمة المرور الجديدة (8 أحرف فأكثر)<input type="password" id="prN" dir="ltr" autocomplete="new-password" minlength="8"></label><label>تأكيد كلمة المرور<input type="password" id="prR" dir="ltr" autocomplete="new-password" minlength="8"></label>
        <div id="prE" class="err" role="alert" ${F.err ? '' : 'hidden'}>${esc(F.err)}</div>
        <button class="btn p" id="prB" type="submit" ${F.busy ? 'disabled' : ''}>${F.busy ? 'جارٍ الحفظ…' : 'حفظ كلمة المرور'}</button></form>${back}` };
    }
    return null;
  }
  async function checkToken() {
    try { F.check = await W.rpc('pw_reset_check', { p_token: F.token }); } catch (e) { F.check = { ok: false, why: 'net' }; }
    refresh();
  }
  if (F.mode === 'reset') checkToken();
  /* فتح رابط آخر والصفحة مفتوحة (تغيّر الجزء بعد # دون إعادة تحميل) */
  window.addEventListener('hashchange', () => {
    const m2 = /(?:^#|&)reset=([0-9a-f]{64})(?:&|$)/.exec(location.hash || ''); if (!m2) return;
    Object.assign(F, { mode: 'reset', token: m2[1], check: null, done: '', err: '', busy: false, sent: false });
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ }
    refresh(); checkToken();
  });

  ACT['pw-forgot'] = () => { F.mode = 'forgot'; F.sent = false; F.err = ''; F.v = ''; F.as = F.as || 'trainee'; refresh(); setTimeout(() => { const u = document.getElementById('pfU'); if (u) u.focus(); }, 30); };
  document.addEventListener('change', (ev) => { const r = ev.target; if (r && r.name === 'pwas') { const u = document.getElementById('pfU'); F.v = u ? u.value : F.v; F.as = r.value; F.err = ''; refresh(); setTimeout(() => { const u2 = document.getElementById('pfU'); if (u2) u2.focus(); }, 20); } });
  ACT['pw-back'] = () => { F.mode = ''; F.sent = false; F.err = ''; F.token = ''; F.check = null; F.done = ''; refresh(); };

  document.addEventListener('submit', async (ev) => {
    const f = ev.target;
    if (f.matches && f.matches('form[data-pwf]')) {
      ev.preventDefault(); ev.stopPropagation();
      const v = String($('#pfU').value || '').trim(); F.v = v;
      if (!v) { F.err = (F.as || 'trainee') === 'trainee' ? 'اكتب رقمك التدريبي أو بريدك التدريبي.' : 'اكتب اسم المستخدم أو البريد المرتبط بحسابك.'; refresh(); return; }
      if ((F.as || 'trainee') === 'trainee' && v.indexOf('@') < 0 && !/^[0-9٠-٩]{9}$/.test(v)) { F.err = 'الرقم التدريبي 9 أرقام.'; refresh(); return; }
      F.busy = true; F.err = ''; refresh();
      try { await W.rpc('pw_reset_request', { p_login: v, p_as: F.as || 'trainee' }); F.sent = true; F.v = ''; }
      catch (e) { F.err = 'تعذر إرسال الطلب الآن. تحقق من الاتصال وأعد المحاولة.'; }
      F.busy = false; refresh();
      return;
    }
    if (f.matches && f.matches('form[data-pwr]')) {
      ev.preventDefault(); ev.stopPropagation();
      const n = $('#prN').value, r = $('#prR').value, login = (F.check && F.check.login) || '';
      const fail = (t) => { F.err = t; F.busy = false; refresh(); };
      if (n.length < 8) return fail('كلمة المرور 8 أحرف على الأقل.');
      if (n !== r) return fail('كلمتا المرور غير متطابقتين.');
      if (/^\d+$/.test(n) || n.toLowerCase() === login.toLowerCase()) return fail('اختر كلمة مرور لا تكون أرقاماً فقط ولا اسم المستخدم أو الرقم التدريبي.');
      F.busy = true; F.err = ''; refresh();
      try {
        const salt = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
        const hash = await W.pbkdf2(n, salt, 150000);
        const res = await W.rpc('pw_reset_finish', { p_token: F.token, p_salt: salt, p_iter: 150000, p_hash: hash });
        F.done = (res && res.login) || login; F.token = ''; F.busy = false; refresh();
      } catch (e) { fail((e && e.message) || 'لم تُحفظ كلمة المرور. أعد المحاولة.'); }
    }
  }, true);

  /* ---------- مسؤول المنصة: طلبات كلمة المرور ---------- */
  const R = { list: null, at: 0, err: '', all: false, busy: false, told: false };
  NAV.forEach(([g, items]) => { if (g === 'الإدارة' && !items.some((x) => x[0] === 'pwreq')) items.splice(1, 0, ['pwreq', 'طلبات كلمة المرور', 'admin']); });
  ADMIN_VIEWS.add('pwreq');
  NAV_BADGE.pwreq = () => (R.list || []).filter((x) => x.status === 'new').length;
  async function load(force) {
    if (!A.me || !isAdmin() || R.busy) return;
    if (!force && R.list && Date.now() - R.at < 20000) return;
    R.busy = true;
    try { R.list = await W.rpc('pw_reset_list', {}); R.err = ''; } catch (e) { R.err = (e && e.message) || 'تعذر تحميل الطلبات.'; }
    R.at = Date.now(); R.busy = false;
    const n = NAV_BADGE.pwreq();
    if (n && !R.told) { R.told = true; toast(`وصل ${n === 1 ? 'طلب' : n + ' طلبات'} لاستعادة كلمة المرور. راجعها من «طلبات كلمة المرور».`); }
    try { badges(); if (A.view === 'pwreq') render(true); } catch (e) { /* */ }
  }
  setInterval(() => { if (!document.hidden) load(true); }, 120000);
  const ROLE = { admin: 'مسؤول المنصة', head: 'رئيس القسم', trainer: 'مدرب', viewer: 'حساب اطلاع', trainee: 'متدرب' };
  const VIA = { username: 'اسم المستخدم', trainee_id: 'الرقم التدريبي', email: 'البريد الإلكتروني' }, ASKED = { trainee: 'متدرب', trainer: 'مدرب', head: 'رئيس القسم' };
  const STAT = { new: ['warn', 'جديد'], link: ['info', 'أُرسل رابط'], done: ['ok', 'اكتمل'], closed: ['', 'مغلق'] };
  VIEWS.pwreq = () => {
    if (!R.list && !R.err) { setTimeout(() => load(true), 0); }
    else setTimeout(() => load(false), 0);
    const L = (R.list || []).filter((x) => R.all || x.status === 'new' || x.status === 'link');
    const row = (x) => {
      const w = x.who || {}, s = STAT[x.status] || ['', x.status], open = x.status === 'new' || x.status === 'link';
      return `<tr><td class="n" style="white-space:nowrap">${esc(tm(x.at))}</td><td><b>${esc(w.name || '—')}</b><br><small dir="ltr">${esc(w.login || x.ref)}</small></td><td>${esc(ROLE[w.role] || '')}${w.active === false ? ' <span class="chip bad">معطّل</span>' : ''}</td><td>${esc(VIA[x.via] || '')}${x.asked ? `<br><small>بصفته: ${esc(ASKED[x.asked] || x.asked)}</small>` : ''}</td><td dir="ltr" style="text-align:right">${esc(w.email || '—')}</td><td class="n"><span class="chip ${s[0]}">${s[1]}</span></td>
        <td>${x.action ? `${esc(x.action)}<br><small>${esc(tm(x.action_at))}${x.action_by_name ? ' • ' + esc(x.action_by_name) : ''}</small>` : '<small>لم يُتخذ إجراء بعد</small>'}${x.status === 'link' && x.token_exp ? `<br><small>الرابط صالح حتى ${esc(tm(x.token_exp))}</small>` : ''}</td>
        <td>${open ? `<div class="row"><button class="btn s p" data-act="pwr-link" data-id="${x.id}">${x.status === 'link' ? 'رابط جديد' : 'رابط إعادة تعيين'}</button><button class="btn s" data-act="pwr-close" data-id="${x.id}">إغلاق الطلب</button></div>` : ''}</td></tr>`;
    };
    return `<div class="head hero"><div><h1>طلبات استعادة كلمة المرور</h1><div class="sub">تصل من «نسيت كلمة المرور؟» في صفحة الدخول. لا تُرسل كلمة مرور في أي رسالة: أنشئ رابط إعادة تعيين لمرة واحدة وأرسله إلى بريد صاحب الحساب، فيعيّن كلمته بنفسه.</div></div><div class="row"><button class="btn" data-act="pwr-reload">تحديث</button></div></div>
    <section class="panel"><div class="row between"><h2 style="margin:0">${R.all ? 'كل الطلبات' : 'الطلبات المفتوحة'}</h2><label class="ck"><input type="checkbox" data-change="pwr-all" ${R.all ? 'checked' : ''}> عرض المكتمل والمغلق</label></div>
    ${R.err ? `<div class="chip bad" style="margin-top:8px">${esc(R.err)}</div>` : ''}
    ${!R.list && !R.err ? '<p class="sub">جارٍ التحميل…</p>' : L.length ? `<div class="tw"><table><thead><tr><th class="n">وقت الطلب</th><th>الحساب</th><th>النوع</th><th>طُلب بـ</th><th>البريد المسجل</th><th class="n">الحالة</th><th>الإجراء المتخذ</th><th></th></tr></thead><tbody>${L.map(row).join('')}</tbody></table></div>` : '<p class="sub">لا توجد طلبات.</p>'}</section>`;
  };
  CHG['pwr-all'] = (e) => { R.all = e.checked; render(true); };
  ACT['pwr-reload'] = () => load(true);
  ACT['pwr-link'] = async (e) => {
    const id = +e.dataset.id, x = (R.list || []).find((r) => r.id === id); if (!x) return;
    let res;
    try { res = await W.rpc('pw_reset_link', { p_id: id, p_hours: 24 }); } catch (err) { toast((err && err.message) || 'تعذر إنشاء الرابط.'); return; }
    const w = res.who || {}, link = location.origin + location.pathname + '#reset=' + res.token;
    const body = `السلام عليكم ${w.name || ''}،\n\nوصلنا طلب استعادة كلمة المرور لحسابك في منصة حاضر (${w.login || ''}).\nلتعيين كلمة مرور جديدة افتح الرابط التالي، وهو صالح مرة واحدة حتى ${tm(res.exp)}:\n${link}\n\nإن لم تطلب ذلك فتجاهل هذه الرسالة وأبلغ مسؤول المنصة. لا نرسل كلمات المرور في الرسائل.\n\n${A.me.name || ''}\nمسؤول منصة حاضر — ${COLLEGE}`;
    const mail = w.email ? 'mailto:' + encodeURIComponent(w.email) + '?subject=' + encodeURIComponent('منصة حاضر: رابط إعادة تعيين كلمة المرور') + '&body=' + encodeURIComponent(body) : '';
    A.pwrLink = link;
    modal(`<h2>رابط إعادة تعيين كلمة المرور</h2><p class="sub">للحساب <b>${esc(w.name || '')}</b> (<span dir="ltr">${esc(w.login || '')}</span>). صالح مرة واحدة حتى ${esc(tm(res.exp))}، ويُلغي أي رابط سابق للحساب.</p>
      <label>الرابط<input type="text" id="pwrL" dir="ltr" readonly value="${esc(link)}"></label>
      <div class="sub">يظهر الرابط هذه المرة فقط. ${w.email ? `أرسله إلى البريد المسجل <span dir="ltr">${esc(w.email)}</span>.` : 'لا بريد مسجل لهذا الحساب: انسخ الرابط وسلّمه لصاحبه مباشرة.'}</div>
      <div class="row">${mail ? `<a class="btn p" href="${esc(mail)}">فتح رسالة إلى بريده</a>` : ''}<button type="button" class="btn" data-act="pwr-copy">نسخ الرابط</button><button type="button" class="btn" data-act="modal-close">إغلاق</button></div>`);
    load(true);
  };
  ACT['pwr-copy'] = () => { copyText(A.pwrLink || '', 'نُسخ الرابط.'); };
  ACT['pwr-close'] = (e) => {
    const id = +e.dataset.id, x = (R.list || []).find((r) => r.id === id); if (!x) return;
    A.pwrId = id;
    modal(`<h2>إغلاق طلب استعادة كلمة المرور</h2><p class="sub">${esc((x.who || {}).name || '')} (<span dir="ltr">${esc((x.who || {}).login || x.ref)}</span>)</p>
      <form data-submit="pwrClose" class="stack"><label>الإجراء المتخذ<select id="pwrA"><option>عولج بإصدار كلمة مرور مؤقتة سُلّمت لصاحب الحساب مباشرة</option><option>تواصل صاحب الحساب وتذكّر كلمة مروره</option><option>طلب مكرر</option><option>الحساب معطل أو غير مستحق</option><option value="">أخرى (اكتبها)</option></select></label>
      <label>ملاحظة (اختيارية)<input type="text" id="pwrN" maxlength="200"></label><div class="row"><button class="btn p">إغلاق الطلب</button><button type="button" class="btn" data-act="modal-close">إلغاء</button></div></form>`);
  };
  SUBMIT.pwrClose = async () => {
    const a = [$('#pwrA').value, $('#pwrN').value.trim()].filter(Boolean).join(' — ');
    if (!a) { toast('اكتب الإجراء المتخذ.'); return; }
    try { await W.rpc('pw_reset_close', { p_id: A.pwrId, p_action: a }); closeModal(); toast('أُغلق الطلب وسُجّل الإجراء.'); load(true); }
    catch (e) { toast((e && e.message) || 'لم يُغلق الطلب.'); }
  };
  /* عند دخول المسؤول: تحميل الطلبات للتنبيه والعدّاد */
  const baseRender = render;
  render = function () { const r = baseRender.apply(this, arguments); if (A.me && isAdmin() && !R.list && !R.busy && !R.err) setTimeout(() => load(true), 300); return r; };
  /* سجل تغيير كلمات المرور (من سجل الخادم) في صفحة «سجل الدخول» للمسؤول */
  const PL = { rows: null, busy: false, err: '' };
  async function loadPl() { if (PL.busy) return; PL.busy = true; try { PL.rows = await W.rpc('pw_change_log', { p_limit: 200 }); PL.err = ''; } catch (e) { PL.err = 'تعذر تحميل سجل كلمات المرور.'; } PL.busy = false; if (A.view === 'logins') render(true); }
  const PACT = { 'pw-change': 'غيّر كلمة مروره', 'pw-set': 'عيّن كلمة مرور لحساب', 'pw-reset-done': 'استعادة كلمة المرور', 'pw-reset-link': 'رابط استعادة' };
  const baseLogins = VIEWS.logins;
  VIEWS.logins = function () {
    const h = baseLogins.apply(this, arguments);
    if (!isAdmin()) return h;
    if (!PL.rows && !PL.busy && !PL.err) setTimeout(loadPl, 0);
    const fmt = (x) => { try { return new Date(x).toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return x; } };
    return h + `<section class="panel" id="pwLog"><div class="row between"><h2 style="margin:0">سجل تغيير كلمات المرور</h2><button class="btn s" data-act="pwlog-refresh">تحديث</button></div>
      <div class="sub">من سجل الخادم: كل تغيير لكلمة مرور حساب في المنصة بهوية من أجراه ووقته. لا تُسجَّل كلمة المرور نفسها.</div>
      ${PL.err ? `<div class="gnote bad">${esc(PL.err)}</div>` : !PL.rows ? '<div class="sub">جارٍ التحميل…</div>' : !PL.rows.length ? '<div class="sub">لا تغييرات مسجلة بعد.</div>'
        : `<div class="tw"><table><thead><tr><th>الوقت</th><th>المنفّذ</th><th>العملية</th><th>التفاصيل</th></tr></thead><tbody>${PL.rows.map((x) => `<tr><td style="white-space:nowrap">${esc(fmt(x.at))}</td><td>${esc(x.by || '—')}</td><td>${esc(PACT[x.act] || x.act)}</td><td>${esc(x.det || '')}</td></tr>`).join('')}</tbody></table></div>`}</section>`;
  };
  ACT['pwlog-refresh'] = () => { PL.rows = null; loadPl(); };
  window.HAADER_PW = { gate, F, R, load, PL };
})();
