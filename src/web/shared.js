/* ====================================================================
   طبقة مشتركة بين نسخة الويب ونسخة Claude:
   - إظهار كلمة المرور وإخفاؤها في كل خانة كلمة مرور
   - اسم القسم تحت شعار المؤسسة في القائمة الجانبية
   - الدخول بحساب المدرب من حساب المسؤول (لصاحب المنصة وحده)
   - البريد الإلكتروني للمدرب ورئيس القسم: يُعدَّل من المنصة ويُحفظ في قاعدة بياناتها،
     ولا يُكتب أي بريد في الشيفرة
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const WEB = window.HAADER_WEB || null;
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

  /* الدخول بحساب المدرب من حساب المسؤول: لصاحب المنصة وحده (aalkhathami)
     العرض يصبح عرض مدرب: شعبه فقط، بلا أدوات الإدارة. ويعود إلى المسؤول بضغطة. */
  const SELF_TRAINER = 'aalkhathami';
  /* في الويب يُشترط أن تكون جلسة الخادم نفسها لحساب aalkhathami؛ وفي نسخة Claude حساب المنصة نفسه */
  const canSwitch = () => !!(A.me && A.me.role === 'admin' && String(A.me.username).toLowerCase() === SELF_TRAINER && (!WEB || (WEB.me && WEB.me.username === SELF_TRAINER)));
  const ss = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { if (v === null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* تفضيل للجلسة فقط */ } } };
  A.asTrainer = ss.get('haader.asTrainer') === '1';
  function setAsTrainer(on) {
    A.asTrainer = !!on && canSwitch();
    ss.set('haader.asTrainer', A.asTrainer ? '1' : null);
    A.view = 'home'; A.crn = null; A.qrCrn = null;
    buildNav(); rebuild(); render(true); window.scrollTo(0, 0);
    toast(A.asTrainer ? 'دخلت بحسابك كمدرب: شعبك فقط، بلا أدوات الإدارة.' : 'عدت إلى حساب مسؤول المنصة.');
  }
  const baseBuildNav = buildNav;
  buildNav = function () {
    if (A.asTrainer && !canSwitch()) A.asTrainer = false;
    baseBuildNav();
    const c = $('#who'); if (!c || !canSwitch()) return;
    const b = document.createElement('button');
    b.className = 'wbtn swtr' + (A.asTrainer ? ' on' : ''); b.dataset.act = 'as-trainer';
    b.textContent = A.asTrainer ? 'العودة لحساب المسؤول' : 'الدخول بحسابي كمدرب';
    const row = c.querySelector('.row'); (row || c).insertAdjacentElement(row ? 'beforebegin' : 'beforeend', b);
    if (A.asTrainer) { const sm = c.querySelector('small'); if (sm) sm.textContent = 'مدرب — وضع المدرب لحساب المسؤول'; }
  };
  ACT['as-trainer'] = () => setAsTrainer(!A.asTrainer);

  const baseRender = render;
  render = function (force) {
    const r = baseRender.apply(this, arguments);
    document.body.classList.toggle('astr', !!A.asTrainer);
    try { deptLine(); } catch (e) { /* العرض أولاً */ }
    return r;
  };

  /* ---------- البريد الإلكتروني للمدرب ورئيس القسم ----------
     لا يُكتب أي بريد في الشيفرة: كل بريد يُدخله صاحبه أو المسؤول من المنصة، ويُحفظ في قاعدة بياناتها.
     - المسؤول: خانة «البريد الإلكتروني» في نموذج الحساب (مدرب، رئيس قسم، اطلاع، مسؤول)
     - كل مستخدم: زر «بريدي الإلكتروني» في بطاقة الحساب، ويظهر كذلك في نافذة الملف الشخصي
     - رئيس القسم: خانة بريده في «القسم والتخصصات»، يُرفض فيها البريد غير الصحيح، ويُنبَّه إن كانت فارغة */
  const emailOk = (v) => !v || EMAIL_RE.test(v);

  /* خانة البريد في نموذج الحساب، بعد اسم المستخدم */
  const baseUserForm = userForm;
  userForm = function (u) {
    baseUserForm.apply(this, arguments);
    const un = $('#uU'), host = un && un.closest('label');
    if (!host || $('#uE')) return;
    const lab = document.createElement('label');
    lab.innerHTML = 'البريد الإلكتروني (اختياري)<input type="email" id="uE" dir="ltr" inputmode="email" autocomplete="off">';
    lab.querySelector('input').value = (u && u.email) || '';
    host.insertAdjacentElement('afterend', lab);
  };
  const baseSaveUser = SUBMIT.saveUser;
  SUBMIT.saveUser = async function () {
    const el = $('#uE');
    if (!el) return baseSaveUser.apply(this, arguments);
    const v = el.value.trim();
    if (!emailOk(v)) { toast('اكتب بريداً إلكترونياً صحيحاً، أو اترك الخانة فارغة.'); el.focus(); return; }
    const id0 = A.editUser, before = id0 ? A.raw.accounts[id0] : null, known = new Set(Object.keys(A.raw.accounts || {}));
    await baseSaveUser.apply(this, arguments);
    /* الحساب الذي حُفظ فعلاً: المعدَّل إن تبدّل كائنه، أو الجديد الذي لم يكن موجوداً. وإلا فالحفظ لم يتم (رسالة تحقق) */
    const acc = id0 ? A.raw.accounts[id0] : Object.values(A.raw.accounts || {}).find((x) => !known.has(x.id));
    if (!acc || acc === before || (acc.email || '') === v) return;
    acc.email = v;
    if (A.me && A.me.id === acc.id) A.me.email = v;
    /* يُضاف إلى كتابة الحساب المنتظرة نفسها إن وُجدت، فيُحفظ الحساب ببريده في كتابة واحدة */
    const pend = Q.find((q) => !q.busy && q.op === 'set' && q.path === 'accounts/' + acc.id);
    if (pend) pend.patch.email = v; else enqueue('accounts/' + acc.id, { email: v });
    render(true);
  };

  /* زر «بريدي الإلكتروني» في بطاقة الحساب: لكل من يملك حساباً غير حساب الاطلاع */
  const navBeforeEmail = buildNav;
  buildNav = function () {
    navBeforeEmail();
    const row = $('#who .row');
    if (!row || !A.me || isViewer() || row.querySelector('[data-act="email-edit"]')) return;
    const b = document.createElement('button'); b.className = 'wbtn'; b.dataset.act = 'email-edit'; b.textContent = 'بريدي الإلكتروني';
    const pw = row.querySelector('[data-act="change-pw"]');
    if (pw) pw.insertAdjacentElement('afterend', b); else row.insertAdjacentElement('afterbegin', b);
  };

  /* بريد رئيس القسم في «القسم والتخصصات» */
  const baseOrgF = CHG['org-f'];
  CHG['org-f'] = function (e) {
    if (e.dataset.k === 'headEmail' && !emailOk(e.value.trim())) { toast('اكتب بريداً إلكترونياً صحيحاً لرئيس القسم، أو اترك الخانة فارغة.'); render(true); return; }
    baseOrgF.apply(this, arguments);
    toast('حُفظت بيانات القسم.');
  };
  const baseOrgView = VIEWS.org;
  VIEWS.org = function () {
    const h = baseOrgView.apply(this, arguments), o = orgInfo();
    const miss = [!o.head && 'اسم رئيس القسم', !o.headEmail && 'بريد رئيس القسم'].filter(Boolean);
    const note = `<div class="sub" id="orgMailNote" style="margin-top:8px">${miss.length ? `<span class="chip warn">لم يُسجَّل بعد: ${miss.join(' و')}</span> ` : ''}يُحفظ اسم رئيس القسم وبريده في قاعدة بيانات المنصة، ويُضاف بريده نسخةً (CC) في إشعارات الغياب. ويعدّل كل مدرب بريده من «بريدي الإلكتروني» في بطاقة حسابه، ويعدّله المسؤول من «المدربون والصلاحيات».</div>`;
    const mark = 'data-k="headEmail"></label></div>';
    return h.includes(mark) ? h.replace(mark, mark + note) : h + note;
  };
})();
