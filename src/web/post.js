/* ====================================================================
   منصة حاضر على الويب — ربط شاشة الدخول والجلسة بالخادم
   شاشة دخول واحدة: اسم المستخدم (أو الرقم التدريبي) وكلمة المرور.
   المدرب ورئيس القسم والمسؤول إلى المنصة، والمتدرب إلى بوابته.
   ==================================================================== */
if (window.HAADER_WEB) (() => {
  const W = window.HAADER_WEB;
  window.toast = toast;
  let firstMe = true;

  /* الجلسة تأتي من الخادم: حساب المنصة هو المربوط بحساب الدخول */
  restoreSession = function () {
    const me = W.me; if (!me || me.kind !== 'staff') return;
    const u = (A.raw.accounts || {})[me.id];
    if (u && u.active !== false) A.me = u;
  };
  const gateCard = (inner) => `${gateBg()}<div class="gatecard"><div class="lgplate"><img src="${LOGO}" alt="${LOGO_ALT}"></div><div class="gatebrand"><b>ح</b><div><strong>منصة حاضر</strong><small>${COLLEGE} • ${DEPT}</small></div></div>${inner}</div>`;
  let gateKey = '';
  renderGate = function () {
    const g = $('#gate');
    if (W.phase === 'trainee') { g.hidden = true; $('#shell').hidden = true; return; }
    $('#shell').hidden = true; g.hidden = false;
    let key, inner;
    if (W.phase === 'login') {
      key = 'login';
      const flash = W.S.flash || W.takeFlash(); W.S.flash = '';
      const qr = W.peekQr();
      inner = `<h2>تسجيل الدخول</h2><p class="sub">${qr ? 'سجّل دخولك برقمك التدريبي ليُسجَّل حضورك في المحاضرة.' : 'المدرب ورئيس القسم باسم المستخدم، والمتدرب برقمه التدريبي.'}</p>
      <form data-submit="login" class="stack" novalidate><label>اسم المستخدم أو الرقم التدريبي<input type="text" id="liU" required dir="ltr" autocomplete="username" autocapitalize="none" spellcheck="false" inputmode="text"></label>
      <label>كلمة المرور<input type="password" id="liP" required dir="ltr" autocomplete="current-password"></label>
      <div id="liE" class="err" role="alert" ${flash ? '' : 'hidden'}>${esc(flash)}</div>
      <button class="btn p" id="liB" type="submit">دخول</button></form>
      <p class="sub gatehelp">نسيت كلمة المرور؟ المتدرب يراجع مدرب المقرر، والمدرب يراجع مسؤول المنصة لإعادة إصدارها.</p>`;
    } else if (W.phase === 'staff' && A.got.accounts && !A.me) {
      key = 'nolink';
      inner = `<h2>تعذر فتح حسابك</h2><p class="sub">دخلت بنجاح، لكن حساب المنصة المرتبط بك غير موجود أو معطّل. راجع مسؤول المنصة.</p><button class="btn" data-act="web-out">تسجيل الخروج</button>`;
    } else if (A.err && A.err !== 'nodb') {
      key = 'err';
      inner = `<h2>تعذر تحميل البيانات</h2><p class="sub">تحقق من اتصالك بالإنترنت ثم أعد تحميل الصفحة.</p><div class="row"><button class="btn p" data-act="web-reload">إعادة التحميل</button><button class="btn" data-act="web-out">تسجيل الخروج</button></div>`;
    } else {
      key = 'load';
      inner = `<h2>${W.phase === 'staff' ? 'جارٍ تحميل بياناتك…' : 'جارٍ التحقق من الجلسة…'}</h2><p class="sub">لحظات.</p><div class="gspin" aria-hidden="true"></div>`;
    }
    if (gateKey === key && g.innerHTML) return;
    gateKey = key; g.dataset.mode = key;
    g.innerHTML = gateCard(inner);
    applySkin();
    if (key === 'login') setTimeout(() => { const u = $('#liU'); if (u) u.focus(); }, 30);
  };
  window.HAADER_WEB_RENDER = () => { gateKey = ''; render(true); };

  SUBMIT.login = async function () {
    const e = $('#liE'), b = $('#liB'), u = $('#liU').value, p = $('#liP').value;
    const fail = (t) => { e.hidden = false; e.textContent = t; b.disabled = false; b.textContent = 'دخول'; };
    if (!u.trim() || !p) { fail('أدخل اسم المستخدم وكلمة المرور.'); return; }
    e.hidden = true; b.disabled = true; b.textContent = 'جارٍ الدخول…';
    try { await W.login(u, p); } catch (x) { fail(x.message); $('#liP').value = ''; $('#liP').focus(); }
  };
  SUBMIT.setup = async function () { toast('الحسابات تُنشأ من «المدربون والصلاحيات» بحساب المسؤول.'); };
  SUBMIT.ownerReset = async function () { toast('إعادة تعيين كلمة مرور المسؤول تتم من حساب مسؤول آخر.'); };
  /* تغيير كلمة المرور: يُتحقق من الحالية على الخادم، والبصمة الجديدة تصبح كلمة الدخول فوراً */
  SUBMIT.changePw = async function () {
    const p = $('#cpN').value, u = A.me;
    if (!A.forceChange && !(await W.verifyPassword(u.username, $('#cpC').value))) { toast('كلمة المرور الحالية غير صحيحة.'); return; }
    if (p.length < 8 || p !== $('#cpR').value) { toast('تحقق من كلمة المرور وتطابقها، 8 أحرف على الأقل.'); return; }
    const f = await pwFields(p);
    try { await db.doc('accounts/' + u.id).update(Object.assign({ mustChange: false }, f)); }
    catch (x) { toast(x.message || 'لم تُحفظ كلمة المرور.'); return; }
    Object.assign(u, { mustChange: false, salt: f.salt, iter: f.iter }); A.forceChange = false; closeModal(); toast('تغيّرت كلمة المرور. استخدمها في الدخول القادم.');
  };
  const baseLogout = logout;
  logout = function () { try { if (A.me) logLogin(A.me.username, true, 'خروج'); } catch (e) { /* */ } A.me = null; W.signOut(); };
  Object.assign(ACT, {
    logout: () => logout(),
    'web-out': () => W.signOut(),
    'web-reload': () => location.reload(),
  });

  /* إظهار كلمة المرور وإخفاؤها: زر بأيقونة عين في كل خانة كلمة مرور (الدخول، وتغييرها، وبوابة المتدرب) */
  const EYE_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.2"/></svg>';
  const EYE_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z"/><circle cx="12" cy="12" r="3.2"/><path d="M3 3l18 18"/></svg>';
  function eyeify(root) {
    (root.querySelectorAll ? root : document).querySelectorAll('input[type=password]:not([data-eye])').forEach((i) => {
      i.dataset.eye = '1';
      const w = document.createElement('span'); w.className = 'pwwrap';
      i.parentNode.insertBefore(w, i); w.appendChild(i);
      const b = document.createElement('button'); b.type = 'button'; b.className = 'pweye';
      b.setAttribute('aria-label', 'إظهار كلمة المرور'); b.title = 'إظهار كلمة المرور'; b.setAttribute('aria-pressed', 'false'); b.innerHTML = EYE_ON;
      w.appendChild(b);
    });
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest && ev.target.closest('.pweye'); if (!b) return;
    ev.preventDefault(); ev.stopPropagation();
    const i = b.parentNode.querySelector('input'); if (!i) return;
    const show = i.type === 'password'; i.type = show ? 'text' : 'password';
    const t = show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور';
    b.setAttribute('aria-label', t); b.title = t; b.setAttribute('aria-pressed', String(show)); b.innerHTML = show ? EYE_OFF : EYE_ON;
    i.focus(); try { const n = i.value.length; i.setSelectionRange(n, n); } catch (e) { /* */ }
  }, true);
  new MutationObserver((ms) => { if (ms.some((m) => m.addedNodes.length)) eyeify(document); }).observe(document.documentElement, { childList: true, subtree: true });
  eyeify(document);

  /* اسم قسم المستخدم تحت شعار المؤسسة العامة للتدريب التقني والمهني */
  const myDept = () => (A.me && A.me.dept) || orgInfo().dept || DEPT;
  function deptLine() {
    const plate = $('#side .lgplate'); if (!plate || !A.me) return;
    let d = $('#sidedept');
    if (!d) { d = document.createElement('div'); d.id = 'sidedept'; d.className = 'lgdept'; plate.insertAdjacentElement('afterend', d); }
    const t = myDept(); if (d.textContent !== t) d.textContent = t;
  }

  /* بعد الدخول: آخر دخول، وطلب تغيير كلمة المرور المؤقتة */
  const baseRender = render;
  render = function (force) {
    baseRender(force);
    deptLine();
    if (A.me && firstMe) {
      firstMe = false;
      enqueue('accounts/' + A.me.id, { lastLogin: new Date().toISOString() });
      if (A.me.mustChange) setTimeout(() => openChangePw(true), 300);
      if (W.takeQr()) toast('رمز QR للمتدربين: يسجّل المتدرب دخوله برقمه التدريبي من جواله.');
    }
  };

  /* ---------- نقل البيانات من نسخة Claude (نسخة احتياطية شاملة) ---------- */
  const IMP_COLS = ['accounts', 'sections', 'marks', 'notes', 'meta', 'qrs', 'warnlog', 'bosla', 'bviol', 'bcase', 'bforms', 'gcfg', 'gsec', 'gmarks', 'gsnap', 'gops', 'glog', 'glogs', 'tacc'];
  const IMP_NAMES = { accounts: 'الحسابات', sections: 'الشعب', marks: 'التحضير', notes: 'الملاحظات', meta: 'الإعدادات والتقويم والسجلات', qrs: 'جلسات QR', warnlog: 'سجل الإنذارات', bosla: 'الإرشاد (المتدربون والمرشدون)', bviol: 'المخالفات', bcase: 'الحالات الإرشادية', bforms: 'النماذج', gcfg: 'إعدادات الدرجات', gsec: 'شعب الدرجات', gmarks: 'الدرجات', gsnap: 'نسخ الدرجات', gops: 'عمليات الرفع', glog: 'سجل التدقيق', glogs: 'سجل التدقيق', tacc: 'حسابات المتدربين' };
  const importPanel = () => (isAdmin() ? `<section class="panel" id="webimp"><h2>نقل البيانات من نسخة Claude</h2><div class="sub">صدّر «نسخة احتياطية شاملة» من منصة حاضر في Claude (مركز تطوير حاضر)، ثم اخترها هنا. تظهر مراجعة بالأعداد قبل الاعتماد، وتحل الوثائق في الملف محل نظيراتها هنا، ولا يُحذف شيء. الحسابات وكلمات مرورها تنتقل كما هي، فيدخل كل مستخدم بكلمة مروره المعتادة.</div><label class="btn p">اختيار ملف النسخة<input type="file" accept=".json,application/json" data-change="web-imp" hidden></label></section>` : '');
  const prefsWeb = VIEWS.prefs; VIEWS.prefs = () => prefsWeb() + importPanel();
  const homeWeb = VIEWS.home; VIEWS.home = () => (isAdmin() && !Object.keys(A.raw.sections || {}).length ? importPanel() : '') + homeWeb();
  CHG['web-imp'] = async (el) => {
    const f = el.files && el.files[0]; el.value = ''; if (!f) return;
    let j; try { j = JSON.parse(await f.text()); } catch (e) { toast('الملف ليس نسخة احتياطية صالحة.'); return; }
    if (!j || j.app !== 'haader' || !j.cols) { toast('هذا ليس ملف نسخة احتياطية من منصة حاضر.'); return; }
    const rows = []; IMP_COLS.forEach((c) => Object.entries(j.cols[c] || {}).forEach(([id, data]) => { if (data && typeof data === 'object') rows.push({ col: c, id, data }); }));
    const by = {}; rows.forEach((r) => { by[r.col] = (by[r.col] || 0) + 1; });
    A.webImp = rows;
    modal(`<h2>مراجعة النقل</h2><div class="sub">النسخة: ${esc(j.at ? new Date(j.at).toLocaleString('ar-SA-u-nu-latn') : '—')}${j.by ? ' • صدّرها ' + esc(j.by) : ''} • ${rows.length} وثيقة</div>
      <div class="tw"><table><thead><tr><th>البيانات</th><th class="n">العدد</th><th class="n">موجود هنا الآن</th></tr></thead><tbody>${Object.keys(by).map((c) => `<tr><td>${esc(IMP_NAMES[c] || c)}</td><td class="n">${by[c]}</td><td class="n">${Object.keys(A.raw[c] || {}).length}</td></tr>`).join('')}</tbody></table></div>
      <div class="sub">بعد الاعتماد يُعاد تحميل المنصة.</div><div class="row"><button class="btn p" data-act="web-imp-go">اعتماد النقل</button><button class="btn" data-act="modal-close">إلغاء</button></div><div class="sub" id="impst" role="status"></div>`);
  };
  ACT['web-imp-go'] = async (b) => {
    const rows = A.webImp || []; if (!rows.length) return;
    b.disabled = true; const st = $('#impst'); let n = 0, bad = [];
    for (let i = 0; i < rows.length; i += 40) {
      const part = rows.slice(i, i + 40);
      try { await W.api('doc?on_conflict=col,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(part) }); n += part.length; }
      catch (e) { for (const r of part) { try { await W.api('doc?on_conflict=col,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([r]) }); n++; } catch (x) { bad.push(r.col + '/' + r.id + ': ' + x.message); } } }
      if (st) st.textContent = `نُقل ${n} من ${rows.length}…`;
    }
    A.webImp = null;
    if (bad.length) { if (st) st.innerHTML = `نُقل ${n} وتعذر ${bad.length}:<br>${bad.slice(0, 8).map(esc).join('<br>')}`; b.disabled = false; return; }
    if (st) st.textContent = `اكتمل النقل: ${n} وثيقة. يُعاد التحميل…`;
    setTimeout(() => location.reload(), 1200);
  };

  /* صفحة QR: تحديث سريع للحضور القادم من جوالات المتدربين */
  setInterval(() => { if (A.me && A.view === 'qr' && !document.hidden) { W.bump('qrs'); W.bump('marks'); W.bump('notes'); } }, 5000);

  /* نسخة أحدث على الخادم: يُعرض تنبيه بإعادة التحميل */
  const BUILD = window.HAADER_BUILD || '';
  async function checkVersion() {
    try {
      const r = await fetch('version.json?t=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      const v = await r.json(); if (!v.build || !BUILD || v.build === BUILD) return;
      if (!A.me && W.phase !== 'trainee') { location.reload(); return; }
      if (!$('#webupd')) { const d = document.createElement('div'); d.id = 'webupd'; d.dir = 'rtl'; d.innerHTML = 'يتوفر تحديث للمنصة. <button class="btn p" data-act="web-reload">تحديث الآن</button>'; document.body.appendChild(d); }
    } catch (e) { /* يُعاد لاحقاً */ }
  }
  setInterval(checkVersion, 5 * 60000); setTimeout(checkVersion, 20000);
})();
