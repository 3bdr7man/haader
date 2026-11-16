/* ====================================================================
   طبقة مشتركة بين نسخة الويب ونسخة Claude:
   - إظهار كلمة المرور وإخفاؤها في كل خانة كلمة مرور
   - اسم القسم تحت شعار المؤسسة في القائمة الجانبية
   - الدخول بحساب المدرب من حساب المسؤول (لصاحب المنصة وحده)
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
})();
