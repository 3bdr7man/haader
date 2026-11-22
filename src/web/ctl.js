/* ====================================================================
   الإدارة المركزية: تشغيل المنصة، وتكامل الأنظمة والمزامنة، والربط مع منصة تقني
   - الإعدادات تُقرأ من الخادم مرة واحدة (ctl_config) وتُخزَّن مؤقتاً برقم إصدار، وتُحدَّث كل 5 دقائق
     عند عودة التبويب، دون أي اتصال بأنظمة خارجية عند فتح الصفحات.
   - الإخفاء يتحكم في الظهور فقط؛ والتعطيل والتفويض يُفرضان على الخادم: لا تُعطى تذكرة مزامنة
     (sync_begin) لخدمة معطلة أو لغير المفوَّض، والجسر داخل رايات يتحقق من التذكرة (sync_check) قبل التنفيذ.
   - وضع الصيانة وإيقاف الوصول العام وقناة الإتاحة تُفرض على الخادم (me_role/my_trainee)؛ الواجهة تعرض الرسالة فقط.
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const WEB = !!window.HAADER_WEB;
  const MIR = () => !!(window.HAADER_MIRROR && window.HAADER_MIRROR.rpc && A.rpcOn && A.rpcOn());
  const SRV = (fn, a) => (WEB ? window.HAADER_WEB.rpc(fn, a || {}) : window.HAADER_MIRROR.rpc(fn, a || {}));
  const live = () => WEB || MIR();
  const errMsg = (e, d) => (e && e.message && /[؀-ۿ]/.test(e.message) ? e.message : d);
  const fmtAt = (iso) => { if (!iso) return '—'; try { return new Date(iso).toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso; } };
  const KEY = 'haader.ctl.v1';
  const DEF = { v: 0, mode: 'public', channel: 'both', claude: true, msg: '', svc: {}, taqni: false };
  const C = { cfg: Object.assign({}, DEF), at: 0, loading: null, ov: null, links: null, showAll: false, tq: null, ctx: null };
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.cfg) { C.cfg = Object.assign({}, DEF, s.cfg); } } catch (e) { /* */ }
  const SYS = { rayat: 'رايات', taqni: 'تقني' };
  const MODES = { public: ['ok', 'التشغيل العام'], maintenance: ['warn', 'وضع الصيانة'], closed: ['bad', 'إيقاف الوصول العام'] };
  const CHANNELS = { both: 'من القناتين (الموقع وتقني)', taqni: 'من داخل تقني فقط', web: 'من الموقع الخارجي فقط' };

  /* ---------- الإعدادات ---------- */
  function load(force) {
    if (!live()) { C.cfg = Object.assign({}, DEF, ((A.raw && A.raw.meta && A.raw.meta.ctl) || {})); return Promise.resolve(C.cfg); }
    if (C.loading) return C.loading;
    if (!force && C.at && Date.now() - C.at < 300000) return Promise.resolve(C.cfg);
    C.loading = SRV('ctl_config').then((c) => { const changed = c && c.v !== C.cfg.v; C.cfg = Object.assign({}, DEF, c || {}); C.at = Date.now();
      try { localStorage.setItem(KEY, JSON.stringify({ cfg: Object.assign({}, C.cfg, { svc: C.cfg.svc }), at: C.at })); } catch (e) { /* */ }
      if (changed && A.me) { try { buildNav(); render(true); } catch (e) { /* */ } }
      return C.cfg; }).catch(() => C.cfg).finally(() => { C.loading = null; });
    return C.loading;
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && A.me) load(false); });
  const svc = (id) => C.cfg.svc[id] || (live() ? { v: false, e: false, a: false } : { v: true, e: true, a: true });
  const vis = (id) => isAdmin() || !!svc(id).v;
  const ok = (id) => !!svc(id).e && !!svc(id).a;
  window.HAADER_CTL = { C, load, vis, ok, svc };

  /* ---------- بوابة الدخول في الويب: الإعدادات، ورابط تقني، والصيانة ---------- */
  const qs = new URLSearchParams(location.search);
  C.tq = qs.get('tq') || null;
  if (qs.get('embed') === '1' || C.tq) document.documentElement.classList.add('embed');
  if (WEB) {
    window.HAADER_WEB_AUTH_HOOK = async (who) => {
      await load(true);
      if (C.tq) {
        try { C.ctx = await SRV('taqni_enter', { p_tk: C.tq }); } catch (e) { C.ctx = { ok: false, msg: errMsg(e, 'تعذر التحقق من رابط الشعبة.') }; }
        if (C.ctx && C.ctx.ok) await load(true);
      }
      const admin = who && who.kind === 'staff' && who.role === 'admin';
      if (!admin && C.cfg.mode !== 'public') throw Object.assign(new Error(C.cfg.mode === 'maintenance' ? (C.cfg.msg || 'المنصة في صيانة مؤقتة.') : 'الوصول العام إلى منصة حاضر متوقف مؤقتاً من مسؤول المنصة.'), { status: 503, ctl: true });
      if (!admin && C.cfg.channel === 'taqni' && !(C.ctx && C.ctx.ok && C.ctx.gate)) throw Object.assign(new Error((C.ctx && C.ctx.msg) || 'منصة حاضر متاحة الآن من داخل منصة تقني فقط: افتحها من إعلان «منصة حاضر» في صفحة شعبتك.'), { status: 403, ctl: true });
      if (!admin && C.cfg.channel === 'web' && C.cfg.taqni) throw Object.assign(new Error('منصة حاضر متاحة الآن من رابطها المباشر فقط.'), { status: 403, ctl: true });
    };
    /* لافتة قبل الدخول: الصيانة أو رابط الشعبة */
    const pre = async () => {
      try { await load(true); } catch (e) { /* */ }
      if (C.tq) { try { C.pub = await SRV('taqni_public', { p_tk: C.tq }); } catch (e) { C.pub = null; } }
      paintBanner();
    };
    setTimeout(pre, 50);
  }
  function paintBanner() {
    let b = document.getElementById('ctlBanner');
    const pub = C.pub, m = C.cfg.mode;
    const html = [m !== 'public' ? `<div class="ctl-b ${MODES[m][0]}" role="status"><b>${MODES[m][1]}</b><span>${esc(m === 'maintenance' ? (C.cfg.msg || '') : 'الدخول متاح لمسؤولي المنصة فقط حالياً.')}</span></div>` : '',
      pub ? `<div class="ctl-b ${pub.ok ? 'info' : 'bad'}">${pub.ok ? `<b>${esc(pub.title || 'خدمات منصة حاضر')}</b><span>الشعبة ${esc(pub.crn)}${pub.course ? ' — ' + esc(pub.course) : ''}. سجّل الدخول بحسابك في حاضر.</span>` : `<b>رابط الشعبة</b><span>${esc(pub.msg || '')}</span>`}</div>` : ''].join('');
    if (!html) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement('div'); b.id = 'ctlBanner'; document.body.prepend(b); }
    b.innerHTML = html;
  }

  /* ---------- شريط الشعبة عند الدخول من تقني ---------- */
  function tqStrip() {
    const x = C.ctx; if (!x || !x.ok) return '';
    return `<div class="tq-strip"><div><b>${esc(x.title || 'خدمات منصة حاضر')}</b><span>الشعبة ${esc(x.crn)} — ${esc(x.course || '')}</span></div><div class="row">${(x.services || []).map((s) => `<button class="btn s" data-act="tq-go" data-v="${esc(s.v)}">${esc(s.n)}</button>`).join('')}</div></div>`;
  }
  ACT['tq-go'] = (e) => { const v = e.dataset.v, x = C.ctx; if (x && x.crn && A.m && A.m.secBy && A.m.secBy[x.crn]) A.crn = x.crn; if (VIEWS[v]) go(v); else go('home'); };

  /* ---------- القائمة والصفحات المحمية ---------- */
  const NEWV = [['ctlops', 'إدارة تشغيل المنصة'], ['ctlsync', 'إدارة التكامل والمزامنة'], ['taqni', 'الربط مع منصة تقني']];
  NAV.forEach(([g, items]) => { if (g === 'الإدارة') NEWV.forEach(([k, t]) => { if (!items.some((x) => x[0] === k)) items.push([k, t, 'admin']); }); });
  NEWV.forEach(([k]) => ADMIN_VIEWS.add(k));
  const baseNav = buildNav;
  buildNav = function () {
    baseNav.apply(this, arguments);
    const hide = (k) => { const a = document.querySelector(`#nav a[data-v="${k}"]`); if (a) a.remove(); };
    if (!isAdmin()) { if (!vis('rayat.att_push') && !vis('rayat.att_pull')) hide('sync'); if (!vis('rayat.grades_push') && !vis('rayat.grades_pull')) hide('gsync'); }
    if (A.me) load(false);
  };
  const guard = (view, ids, label) => { const base = VIEWS[view]; if (!base) return; VIEWS[view] = function () {
    if (!ids.some(vis)) return `${gHead(label, '')}<div class="gnote info">هذه الخدمة غير متاحة حالياً. يتحكم في إتاحتها مسؤول المنصة.</div>`;
    const h = base.apply(this, arguments), off = ids.filter((i) => vis(i) && !ok(i));
    return (off.length ? `<div class="gnote warn ctl-off">${off.map((i) => `«${esc(NAMES[i] || i)}»`).join(' و')} ${off.length > 1 ? 'معطلتان' : 'معطلة'} من مسؤول المنصة أو غير مفوَّضة لحسابك: لن تُنشأ حزمة مزامنة لها. التحضير والرصد اليدوي يعملان كالمعتاد.</div>` : '') + h; }; };
  const NAMES = { 'rayat.att_push': 'مزامنة التحضير اليومي', 'rayat.att_pull': 'مقارنة التحضير', 'rayat.grades_push': 'مزامنة إدخال الدرجات', 'rayat.grades_pull': 'مطابقة الدرجات' };
  guard('sync', ['rayat.att_push', 'rayat.att_pull'], 'مزامنة رايات');
  guard('gsync', ['rayat.grades_push', 'rayat.grades_pull'], 'المزامنة مع منصة رايات');
  { const bh = VIEWS.home; if (bh) VIEWS.home = function () { return tqStrip() + adminModeNote() + bh.apply(this, arguments); }; }
  const adminModeNote = () => (isAdmin() && C.cfg.mode !== 'public' ? `<div class="gnote ${MODES[C.cfg.mode][0]}">المنصة الآن في «${MODES[C.cfg.mode][1]}»: لا يدخلها غير مسؤولي المنصة. <button class="lnk" data-act="go-ctlops">إدارة التشغيل</button></div>` : '');
  ACT['go-ctlops'] = () => go('ctlops');

  /* ---------- الجسر داخل رايات (الإصدار 3): لا ينفّذ إلا بتذكرة صالحة من الخادم ---------- */
  (function patchBridge() {
    const el = document.getElementById('bridge-src'); if (!el) return;
    let b = el.textContent; if (b.includes('__hbChk')) return;
    const rep = (o, n) => { if (b.split(o).length !== 2) throw new Error('bridge:' + o.slice(0, 40)); b = b.replace(o, n); };
    try {
      rep('window.__HB&&window.__HB.show&&window.__HB.v>=2', 'window.__HB&&window.__HB.show&&window.__HB.v>=3');
      rep('window.__HB={v:2,', 'window.__HB={v:3,');
      rep('n.appendChild(C("متابعة","p",function(){try{var q=JSON.parse(t.value.trim());',
        'n.appendChild(C("متابعة","p",function(){var b0=this;try{var q=JSON.parse(t.value.trim());if(!/^haader(-grades)?3$/.test(q.app||""))throw 0;if(window.__HBok!==q.tk){b0.disabled=!0;return void window.__hbChk(q).then(function(r){b0.disabled=!1;if(!r||!r.ok)return E((r&&r.msg)||"تعذر التحقق من إذن المزامنة. لم يُنفَّذ شيء.");window.__HBok=q.tk;b0.click()})}q=JSON.parse(JSON.stringify(q));q.app=q.app.replace(/3$/,"");');
      const chk = 'window.__hbChk=function(q){var x=String(q.tk||"").split("."),exp=+x[1]||0,off=function(m){return exp*1e3>Date.now()?{ok:!0,offline:!0}:{ok:!1,msg:m||"انتهت صلاحية حزمة المزامنة. انسخها من حاضر من جديد."}};if(q.tk==="local"&&!q.sb)return Promise.resolve({ok:!0});if(!q.sb||!q.sb.u)return Promise.resolve({ok:!1,msg:"الحزمة بلا تذكرة من خادم حاضر. انسخها من المنصة مرة أخرى."});var ac=typeof AbortController!="undefined"?new AbortController:null,tm=setTimeout(function(){ac&&ac.abort()},15e3);return fetch(q.sb.u+"/rest/v1/rpc/sync_check",{method:"POST",headers:{apikey:q.sb.k,"Content-Type":"application/json"},body:JSON.stringify({p_tk:q.tk}),signal:ac?ac.signal:void 0}).then(function(r){clearTimeout(tm);return r.ok?r.json():off()},function(){clearTimeout(tm);return off()})};';
      b = chk + b;
      el.textContent = b;
    } catch (e) { console.warn('ctl: تعذر تحديث الجسر', e); el.dataset.ctlFail = '1'; }
  })();
  const sbOf = () => (WEB ? window.HAADER_WEB.sb : MIR() ? { u: 'https://urtdulwbpabslicxtsoa.supabase.co', k: 'sb_publishable_6VS8qehDCUIjjOOgB6hchg_w9J-4ubi' } : null);
  async function begin(id, key, detail) {
    if (!live()) return { id: 'local', tk: 'local' };
    await load(true);
    if (!ok(id)) throw new Error(svc(id).e ? 'لا تملك صلاحية تنفيذ هذه المزامنة. يحددها مسؤول المنصة.' : 'هذه المزامنة معطلة من مسؤول المنصة. لم تُنشأ حزمة.');
    return SRV('sync_begin', { p_svc: id, p_key: key, p_detail: detail || null });
  }
  function end(run, status, n, detail) { if (!run || run === 'local' || !live()) return; SRV('sync_end', { p_id: run, p_status: status, p_n: n == null ? null : n, p_detail: detail || null }).catch(() => { /* السجل يكتمل من الخادم عند انتهاء الصلاحية */ }); }
  const wrap3 = (pk, t) => { const sb = sbOf(); return Object.assign({}, pk, { app: pk.app + '3', tk: t.tk, run: t.id }, sb ? { sb } : {}); };
  ACT['sync-copy'] = async () => {
    if (document.getElementById('bridge-src').dataset.ctlFail) { toast('تعذر تجهيز الجسر المحدّث. حدّث الصفحة.'); return; }
    const pk = buildPackage(), id = pk.mode === 'pull' ? 'rayat.att_pull' : 'rayat.att_push';
    if (!pk.items.length) { toast('اختر محاضرة واحدة على الأقل.'); return; }
    let t; try { t = await begin(id, 'att:' + pk.mode + ':' + pk.items.map((i) => i.crn + '_' + (i.dk || i.d || '')).join(',').slice(0, 180), `${pk.items.length} محاضرة`); } catch (e) { toast(errMsg(e, 'تعذر بدء المزامنة.')); return; }
    A.sync.run = t.id; A.sync.runN = pk.items.length;
    copyText(JSON.stringify(wrap3(pk, t)), `نُسخت حزمة ${pk.items.length} محاضرة (صالحة 30 دقيقة). انتقل إلى تبويب رايات.`);
  };
  { const base = takeResult; takeResult = function (text) { const r = base.apply(this, arguments); try { const j = JSON.parse(String(text).trim()); if (j && j.app === 'haader-result' && A.sync.run) { const bad = (j.items || []).filter((i) => i.err || i.st === 'error').length; end(A.sync.run, bad ? 'partial' : 'ok', (j.items || []).length, bad ? `${bad} محاضرة لم تكتمل` : null); A.sync.run = null; } } catch (e) { /* */ } return r; }; }
  const gRuns = {};
  const gBegin = async (op) => begin(op.kind === 'read' ? 'rayat.grades_pull' : 'rayat.grades_push', 'g:' + op.id, `${op.crn || ''} ${op.kind || ''}`.trim());
  const gText = (op, t) => { const s = gPkgText(op); if (!s) return ''; return JSON.stringify(wrap3(JSON.parse(s), t)); };
  ACT['g-pkg'] = async (e) => { const op = gCurOp(A.raw.gsec[e.dataset.crn]); if (!op) return; let t; try { t = await gBegin(op); } catch (x) { toast(errMsg(x, 'تعذر بدء المزامنة.')); return; } gRuns[op.id] = t.id; copyText(gText(op, t), `نُسخت حزمة العملية ${op.id} (صالحة 30 دقيقة).`); };
  gUpGo = async function (crn, mode) {
    const prev = gSt(A.raw.gsec[crn]).op, kind = mode || (['partial', 'failed'].includes(prev.st) ? 'retry' : 'push');
    try { await load(true); const id = kind === 'read' ? 'rayat.grades_pull' : 'rayat.grades_push'; if (live() && !ok(id)) throw new Error(svc(id).e ? 'لا تملك صلاحية تنفيذ هذه المزامنة.' : 'مزامنة الدرجات مع رايات معطلة من مسؤول المنصة.'); } catch (x) { toast(errMsg(x, 'تعذر بدء المزامنة.')); return; }
    const op = await gStartOp(crn, kind); if (!op) return;
    let t; try { t = await gBegin(op); } catch (x) { toast(errMsg(x, 'تعذر بدء المزامنة.')); return; }
    gRuns[op.id] = t.id; closeModal(); A.gCrn = crn; GX.pkgFor = op.id;
    await copyText(gText(op, t), op.kind === 'read' ? `نُسخت حزمة القراءة ${op.id}. شغّل الجسر في تبويب رايات.` : `بدأت العملية ${op.id} ونُسخت الحزمة. شغّل الجسر في تبويب رايات.`);
    if (A.view !== 'gsync') go('gsync'); else render(true);
  };
  { const base = gTakeResult; gTakeResult = async function (text) { const op = await base.apply(this, arguments); if (op && gRuns[op.id]) { end(gRuns[op.id], op.st === 'ok' || op.st === 'done' ? 'ok' : op.st === 'partial' ? 'partial' : op.st === 'failed' ? 'fail' : 'ok', (op.res && op.res.n) || null, op.st); delete gRuns[op.id]; } return op; }; }

  /* ---------- صفحات المسؤول ---------- */
  const OV = () => SRV('ctl_overview');
  function loadOv(force) { if (!live()) return; if (C.ovBusy || (!force && C.ov && Date.now() - C.ovAt < 30000)) return; C.ovBusy = true;
    OV().then((o) => { C.ov = o; C.ovAt = Date.now(); C.ovErr = ''; }).catch((e) => { C.ovErr = errMsg(e, 'تعذر تحميل الإعدادات.'); }).finally(() => { C.ovBusy = false; if (['ctlops', 'ctlsync'].includes(A.view)) render(); }); }
  const needLive = (title) => `${gHead(title, '')}<div class="gnote info">هذه اللوحة تعمل على الخادم: افتحها من رابط المنصة، أو من حساب صاحب المنصة هنا مع ربط Supabase.</div>`;
  const sw = (on, act, attrs, label) => `<button class="ctl-sw ${on ? 'on' : ''}" role="switch" aria-checked="${on}" data-act="${act}" ${attrs}><i></i><span>${label}</span></button>`;
  const confirmBox = (title, body, act, attrs, danger) => modal(`<h2>${title}</h2><div class="sub">${body}</div><label>سبب التغيير (اختياري، يُحفظ في سجل التدقيق)<input type="text" id="ctlWhy" maxlength="300"></label>${danger ? `<label>للتأكيد اكتب «${danger}»<input type="text" id="ctlTyp" dir="rtl"></label>` : ''}<div class="row"><button class="btn ${danger ? 'd' : 'p'}" data-act="${act}" ${attrs} ${danger ? `data-typ="${danger}"` : ''}>تأكيد</button><button class="btn" data-act="modal-close">إلغاء</button></div>`);
  const why = () => (($('#ctlWhy') || {}).value || '').trim() || null;
  const typedOk = (e) => !e.dataset.typ || ((($('#ctlTyp') || {}).value || '').trim() === e.dataset.typ);
  async function call(fn, args, okMsg) { try { const r = await SRV(fn, args); closeModal(); await Promise.all([loadOv(true), load(true)]); toast(okMsg); return r; } catch (e) { toast(errMsg(e, 'لم يُحفظ التغيير. أعد المحاولة.')); return null; } }

  VIEWS.ctlsync = () => {
    if (!isAdmin()) return '';
    if (!live()) return needLive('إدارة تكامل الأنظمة والمزامنة');
    loadOv(false); const o = C.ov;
    if (!o) return `${gHead('إدارة تكامل الأنظمة والمزامنة', '')}<div class="sub">${C.ovErr ? esc(C.ovErr) : 'جارٍ التحميل…'}</div>`;
    const sv = o.services.filter((s) => C.showAll || s.impl), on = o.services.filter((s) => s.impl && s.enabled).length, offn = o.services.filter((s) => s.impl && !s.enabled).length;
    const lastRun = o.runs[0], trs = o.trainers || [];
    const authCell = (s) => `<select data-change="ctl-auth" data-id="${s.id}" aria-label="تفويض ${esc(s.name)}"><option value="all" ${s.auth_mode === 'all' ? 'selected' : ''}>كل المدربين</option><option value="roles" ${s.auth_mode === 'roles' ? 'selected' : ''}>أدوار محددة${s.auth_mode === 'roles' ? ': ' + s.auth_roles.map((r) => ({ admin: 'المسؤول', head: 'رئيس القسم', trainer: 'المدرب' })[r]).join('، ') : ''}</option><option value="users" ${s.auth_mode === 'users' ? 'selected' : ''}>مدربون محددون${s.auth_mode === 'users' ? ` (${s.auth_users.length})` : ''}</option></select>`;
    const st = (s) => (!s.impl ? '<span class="chip">غير مبنية</span>' : !s.visible ? '<span class="chip">مخفي</span>' : s.enabled ? '<span class="chip ok">مفعل</span>' : '<span class="chip bad">معطل</span>');
    return `${gHead('إدارة تكامل الأنظمة والمزامنة', 'لوحة إدارة المزامنة: لكل خدمة ثلاثة مستويات مستقلة — الظهور، والتفعيل (يُفرض على الخادم)، والتفويض.')}
      <div class="tiles"><div class="tile"><b>${o.systems.length}</b><span>أنظمة التكامل</span></div><div class="tile ok"><b>${on}</b><span>خدمات مفعلة</span></div><div class="tile bad"><b>${offn}</b><span>خدمات معطلة</span></div><div class="tile"><b>${lastRun ? esc(fmtAt(lastRun.at).split('،')[0]) : '—'}</b><span>آخر عملية مزامنة</span><small>${lastRun ? esc(SYS[(lastRun.svc || '').split('.')[0]] || '') + ' — ' + esc(lastRun.status) : ''}</small></div>
        ${o.systems.map((y) => `<div class="tile ${y.last_error_at && (!y.last_ok || y.last_error_at > y.last_ok) ? 'warn' : y.last_ok ? 'ok' : ''}"><b>${esc(SYS[y.id] || y.id)}</b><span>${y.last_error_at && (!y.last_ok || y.last_error_at > y.last_ok) ? 'آخر عملية فيها خطأ' : y.last_ok ? 'آخر اتصال ناجح' : 'لم يُستعمل بعد'}</span><small>${esc(fmtAt(y.last_ok))}</small></div>`).join('')}</div>
      <section class="panel"><div class="row between"><h2 style="margin:0">جدول التحكم</h2><label class="row ck"><input type="checkbox" data-change="ctl-all" ${C.showAll ? 'checked' : ''}> إظهار الخدمات المعرّفة غير المبنية</label></div>
        <div class="tw"><table class="ctl-t"><thead><tr><th>اسم الخدمة</th><th class="n">النظام</th><th class="n">الظهور</th><th class="n">التفعيل</th><th>التفويض</th><th class="n">الحالة</th><th class="n">آخر مزامنة</th></tr></thead><tbody>${sv.map((s) => `<tr class="${s.impl ? '' : 'dim'}"><td><b>${esc(s.name)}</b><small class="sub" style="display:block">${esc(s.descr || '')}</small></td><td class="n">${esc(SYS[s.system] || s.system)}</td>
          <td class="n">${sw(s.visible, 'ctl-svc', `data-id="${s.id}" data-f="visible" data-v="${!s.visible}" aria-label="ظهور ${esc(s.name)}"`, s.visible ? 'ظاهر' : 'مخفي')}</td>
          <td class="n">${s.impl ? sw(s.enabled, 'ctl-svc', `data-id="${s.id}" data-f="enabled" data-v="${!s.enabled}" aria-label="تفعيل ${esc(s.name)}"`, s.enabled ? 'مفعل' : 'معطل') : '<span class="sub">—</span>'}</td>
          <td>${s.impl ? authCell(s) : ''}</td><td class="n">${st(s)}</td><td class="n"><small>${esc(fmtAt(s.last_run))}${s.last_status ? '<br>' + esc(s.last_status) + (s.last_count != null ? ` (${s.last_count})` : '') : ''}</small></td></tr>`).join('')}</tbody></table></div>
        <div class="row" style="margin-top:10px;flex-wrap:wrap">${[['rayat', 'enabled', true, 'تفعيل جميع خدمات رايات'], ['rayat', 'enabled', false, 'تعطيل جميع خدمات رايات'], ['taqni', 'enabled', true, 'تفعيل جميع خدمات تقني'], ['taqni', 'enabled', false, 'تعطيل جميع خدمات تقني'], ['*', 'visible', true, 'إظهار جميع ميزات المزامنة'], ['*', 'visible', false, 'إخفاء جميع ميزات المزامنة']].map(([y, f, v, t]) => `<button class="btn s ${v ? '' : 'd'}" data-act="ctl-bulk" data-y="${y}" data-f="${f}" data-v="${v}">${t}</button>`).join('')}</div>
        <div class="legend" style="margin-top:8px"><span><i class="ctl-dot ok"></i>مفعل</span><span><i class="ctl-dot bad"></i>معطل</span><span><i class="ctl-dot"></i>مخفي</span><span class="sub">الإخفاء لا يحذف أي سجل، والتعطيل لا يمس الإدخال اليدوي ولا بقية وظائف المنصة.</span></div></section>
      ${o.systems.map((y) => `<section class="panel"><div class="row between"><h2 style="margin:0">${esc(y.name)}</h2><button class="btn s" data-act="ctl-sys" data-id="${y.id}">تعديل الإعدادات</button></div>
        <table class="kv"><tbody><tr><th>حالة الاتصال</th><td>${y.last_ok ? `آخر اتصال ناجح ${esc(fmtAt(y.last_ok))}` : 'لم تُسجَّل عملية ناجحة بعد'}</td></tr><tr><th>حالة المصادقة وطريقتها</th><td>${esc(y.auth_method || '—')}</td></tr><tr><th>عنوان خدمة التكامل</th><td dir="ltr" style="text-align:right">${esc(y.endpoint || '—')}</td></tr>
        <tr><th>آخر عملية مزامنة</th><td>${esc(fmtAt(y.last_sync))}</td></tr><tr><th>آخر خطأ</th><td>${y.last_error ? `${esc(y.last_error)} <small class="sub">(${esc(fmtAt(y.last_error_at))})</small>` : '—'}</td></tr>
        <tr><th>إعادة المحاولة</th><td>حتى ${y.retry.max} مرات، بفاصل ${y.retry.backoff_s} ث، ومهلة الاتصال ${y.retry.timeout_s} ث</td></tr><tr><th>ملاحظة</th><td>${esc(y.conn_note || '')}</td></tr></tbody></table></section>`).join('')}
      <section class="panel"><h2>عمليات المزامنة الأخيرة</h2>${o.runs.length ? `<div class="tw"><table><thead><tr><th class="n">الوقت</th><th>الخدمة</th><th>المنفّذ</th><th class="n">الحالة</th><th class="n">السجلات</th><th>التفاصيل</th></tr></thead><tbody>${o.runs.map((r) => `<tr><td class="n">${esc(fmtAt(r.at))}</td><td>${esc((o.services.find((s) => s.id === r.svc) || {}).name || r.svc)}</td><td>${esc(r.by_name || '')}</td><td class="n"><span class="chip ${r.status === 'ok' ? 'ok' : r.status === 'running' ? 'info' : r.status === 'partial' ? 'warn' : 'bad'}">${esc({ ok: 'نجحت', running: 'جارية', partial: 'جزئية', fail: 'فشلت', cancelled: 'أُوقفت', expired: 'انتهت صلاحيتها' }[r.status] || r.status)}</span></td><td class="n">${r.n == null ? '—' : r.n}</td><td><small>${esc(r.detail || '')}</small></td></tr>`).join('')}</tbody></table></div>` : '<div class="sub">لا توجد عمليات بعد.</div>'}</section>
      ${auditPanel(o.audit, 'sync')}`;
  };
  function auditPanel(rows, which) {
    const list = (rows || []).filter((a) => which === 'all' || (which === 'sync' ? a.sys !== 'platform' && a.sys !== 'claude' : a.sys === 'platform' || a.sys === 'claude')).slice(0, 40);
    const F = { visible: 'الظهور', enabled: 'التفعيل', auth: 'التفويض', mode: 'وضع التشغيل', channel: 'قناة الإتاحة', claude: 'إدارة Claude', msg: 'رسالة الصيانة', system: 'إعدادات النظام', link: 'رابط الشعبة', read: 'قراءة' };
    const val = (v) => (v === 'true' ? 'تشغيل' : v === 'false' ? 'إيقاف' : MODES[v] ? MODES[v][1] : CHANNELS[v] || (v && v.length > 60 ? v.slice(0, 60) + '…' : v || '—'));
    return `<section class="panel"><div class="row between"><h2 style="margin:0">سجل التدقيق</h2><button class="btn s" data-act="ctl-refresh">تحديث</button></div>${list.length ? `<div class="tw"><table><thead><tr><th class="n">الوقت</th><th>المسؤول</th><th class="n">القناة</th><th>النظام / الخدمة</th><th>الإعداد</th><th>السابق</th><th>الجديد</th><th>السبب</th><th class="n">IP</th></tr></thead><tbody>${list.map((a) => `<tr><td class="n">${esc(fmtAt(a.at))}</td><td>${esc(a.by_name || '')}</td><td class="n">${a.via === 'claude' ? '<span class="chip info">Claude</span>' : 'المنصة'}</td><td>${esc([SYS[a.sys] || (a.sys === 'platform' ? 'المنصة' : a.sys), a.svc].filter(Boolean).join(' — '))}</td><td>${esc(F[(a.field || '').split(':')[0]] || a.field || '')}</td><td><small>${esc(val(a.old_val))}</small></td><td><small>${esc(val(a.new_val))}</small></td><td><small>${esc(a.reason || '')}</small></td><td class="n"><small dir="ltr">${esc(a.ip || '—')}</small></td></tr>`).join('')}</tbody></table></div>` : '<div class="sub">لا توجد تغييرات مسجلة بعد.</div>'}</section>`;
  }
  ACT['ctl-refresh'] = () => { loadOv(true); load(true); };
  CHG['ctl-all'] = (e) => { C.showAll = e.checked; render(true); };
  ACT['ctl-svc'] = (e) => { const s = C.ov.services.find((x) => x.id === e.dataset.id), v = e.dataset.v === 'true', f = e.dataset.f;
    confirmBox(`${f === 'visible' ? (v ? 'إظهار' : 'إخفاء') : (v ? 'تفعيل' : 'تعطيل')} «${esc(s.name)}» — ${esc(SYS[s.system])}`, f === 'enabled' && !v ? 'يتوقف قبول طلبات المزامنة الجديدة لهذه الخدمة فوراً، وتُبطَل التذاكر المفتوحة. لا يُحذف أي سجل، ولا يتأثر الإدخال اليدوي.' : f === 'visible' && !v ? 'يختفي خيار المزامنة من واجهة المدربين. السجلات السابقة تبقى.' : 'يُطبَّق على المدربين المفوَّضين فوراً.', 'ctl-svc-ok', `data-id="${s.id}" data-f="${f}" data-v="${v}"`); };
  ACT['ctl-svc-ok'] = (e) => call('ctl_service_set', { p_id: e.dataset.id, p_field: e.dataset.f, p_value: e.dataset.v === 'true', p_reason: why() }, 'حُفظ التغيير وسُجّل.');
  ACT['ctl-bulk'] = (e) => { const y = e.dataset.y, f = e.dataset.f, v = e.dataset.v === 'true';
    confirmBox(e.textContent, `يُطبَّق على ${y === '*' ? 'جميع خدمات المزامنة المبنية' : 'كل خدمات ' + SYS[y] + ' المبنية'}، ويُسجَّل كل تغيير على حدة.`, 'ctl-bulk-ok', `data-y="${y}" data-f="${f}" data-v="${v}"`, v ? '' : 'تأكيد'); };
  ACT['ctl-bulk-ok'] = (e) => { if (!typedOk(e)) { toast('اكتب كلمة التأكيد كما هي.'); return; } call('ctl_bulk', { p_system: e.dataset.y, p_field: e.dataset.f, p_value: e.dataset.v === 'true', p_reason: why() }, 'نُفّذ الإجراء الجماعي.'); };
  CHG['ctl-auth'] = (e) => { const s = C.ov.services.find((x) => x.id === e.dataset.id), m = e.value, trs = (C.ov.trainers || []).filter((u) => u.role !== 'admin');
    modal(`<h2>تفويض «${esc(s.name)}»</h2><div class="sub">من يستطيع تنفيذ هذه المزامنة حين تكون مفعلة. مسؤول المنصة مفوَّض دائماً.</div>
      ${m === 'roles' ? `<div class="stack">${[['trainer', 'المدرب'], ['head', 'رئيس القسم']].map(([k, t]) => `<label class="row ck"><input type="checkbox" class="ctlR" value="${k}" ${s.auth_roles.includes(k) ? 'checked' : ''}> ${t}</label>`).join('')}</div>` : ''}
      ${m === 'users' ? `<div class="stack ctl-users">${trs.map((u) => `<label class="row ck"><input type="checkbox" class="ctlU" value="${esc(u.id)}" ${s.auth_users.includes(u.id) ? 'checked' : ''}> ${esc(u.name)}</label>`).join('') || '<span class="sub">لا يوجد مدربون.</span>'}</div>` : ''}
      ${m === 'all' ? '<div class="sub">كل المدربين ورؤساء الأقسام النشطين.</div>' : ''}
      <label>سبب التغيير (اختياري)<input type="text" id="ctlWhy" maxlength="300"></label>
      <div class="row"><button class="btn p" data-act="ctl-auth-ok" data-id="${s.id}" data-m="${m}">حفظ التفويض</button><button class="btn" data-act="ctl-auth-x">إلغاء</button></div>`); };
  ACT['ctl-auth-x'] = () => { closeModal(); render(true); };
  ACT['ctl-auth-ok'] = (e) => call('ctl_service_auth', { p_id: e.dataset.id, p_mode: e.dataset.m, p_roles: [...document.querySelectorAll('.ctlR:checked')].map((x) => x.value), p_users: [...document.querySelectorAll('.ctlU:checked')].map((x) => x.value), p_reason: why() }, 'حُفظ التفويض.');
  ACT['ctl-sys'] = (e) => { const y = C.ov.systems.find((x) => x.id === e.dataset.id);
    modal(`<h2>إعدادات ${esc(y.name)}</h2><div class="gnote info">لا تُكتب هنا كلمات مرور ولا مفاتيح: الخادم يرفضها. الأسرار — إن احتاجها تكامل مستقبلي — تُحفظ في خزنة الخادم فقط ولا تظهر في الواجهة أو السجلات.</div>
      <label>عنوان خدمة التكامل<input type="url" id="ctlEp" dir="ltr" value="${esc(y.endpoint || '')}"></label><label>طريقة المصادقة<input type="text" id="ctlAm" value="${esc(y.auth_method || '')}"></label><label>ملاحظة الاتصال<input type="text" id="ctlCn" value="${esc(y.conn_note || '')}"></label>
      <div class="rs-grid"><label>عدد مرات إعادة المحاولة<input type="number" id="ctlRm" min="0" max="5" value="${y.retry.max}"></label><label>الفاصل (ثانية)<input type="number" id="ctlRb" min="1" max="120" value="${y.retry.backoff_s}"></label><label>مهلة الاتصال (ثانية)<input type="number" id="ctlRt" min="5" max="120" value="${y.retry.timeout_s}"></label></div>
      <label>سبب التغيير (اختياري)<input type="text" id="ctlWhy" maxlength="300"></label><div class="row"><button class="btn p" data-act="ctl-sys-ok" data-id="${y.id}">حفظ</button><button class="btn" data-act="modal-close">إلغاء</button></div>`); };
  ACT['ctl-sys-ok'] = (e) => call('ctl_system_set', { p_id: e.dataset.id, p_patch: { endpoint: $('#ctlEp').value.trim(), auth_method: $('#ctlAm').value.trim(), conn_note: $('#ctlCn').value.trim(), retry: { max: +$('#ctlRm').value, backoff_s: +$('#ctlRb').value, timeout_s: +$('#ctlRt').value } }, p_reason: why() }, 'حُفظت إعدادات النظام.');

  /* ---------- إدارة تشغيل المنصة ---------- */
  const TOOLS = [['get_platform_status', 'اعرض حالة منصة حاضر'], ['enable_public_access', 'فعّل تشغيل المنصة'], ['disable_public_access', 'أوقف الوصول العام مؤقتاً'], ['enable_maintenance_mode', 'فعّل وضع الصيانة'], ['disable_maintenance_mode', 'أنهِ وضع الصيانة'], ['set_access_channel', 'اجعل حاضر من داخل تقني فقط'], ['get_users', 'اعرض الحسابات'], ['manage_users', 'عطّل/فعّل حساباً'], ['get_courses', 'اعرض المقررات'], ['get_sections', 'اعرض الشعب المرتبطة بتقني'], ['get_trainees', 'اعرض متدربي شعبة'], ['manage_sections', 'أضف شعبة'], ['manage_trainees', 'أضف متدربين لشعبة'], ['get_grades', 'اعرض درجات شعبة'], ['get_attendance', 'اعرض تقرير الحضور'], ['get_platform_reports', 'اعرض عدد المتدربين والعمليات'], ['get_audit_logs', 'اعرض عمليات الأسبوع'], ['get_taqni_integration_status', 'تحقق من سلامة الربط مع تقني'], ['manage_taqni_section_links', 'فعّل/أخفِ رابط حاضر لشعبة'], ['enable_taqni_integration', 'فعّل خدمات تقني'], ['disable_taqni_integration', 'عطّل خدمات تقني']];
  VIEWS.ctlops = () => {
    if (!isAdmin()) return '';
    if (!live()) return needLive('إدارة تشغيل منصة حاضر');
    loadOv(false); const o = C.ov; if (!o) return `${gHead('إدارة تشغيل منصة حاضر', '')}<div class="sub">${C.ovErr ? esc(C.ovErr) : 'جارٍ التحميل…'}</div>`;
    const c = o.ctl, M = MODES[c.mode];
    const access = c.mode === 'maintenance' ? 'maint' : c.mode === 'closed' ? 'closed' : c.channel;
    const OPTS = [['taqni', 'تشغيل حاضر من داخل تقني فقط', 'الموقع الخارجي لا يقبل دخول المدربين والمتدربين؛ يعمل الدخول من رابط الشعبة في تقني.'], ['web', 'تشغيل حاضر من الموقع الخارجي فقط', 'جلسات تقني لا تُقبل.'], ['both', 'تشغيل حاضر من القناتين', 'الوضع المعتاد.'], ['closed', 'إيقاف الوصول العام مع السماح للمسؤولين', 'لا يدخل غير مسؤولي المنصة.'], ['maint', 'وضع الصيانة', 'تظهر رسالة الصيانة للجميع، وتبقى الإدارة متاحة للمسؤولين.']];
    return `${gHead('إدارة تشغيل منصة حاضر والتحكم عن بُعد', 'أوضاع التشغيل وطريقة الإتاحة وإدارة Claude. كل تغيير يُفرض على الخادم ويُسجَّل في سجل التدقيق.')}
      <div class="tiles"><div class="tile ${M[0]}"><b>${M[1]}</b><span>حالة المنصة</span><small>منذ ${esc(fmtAt(c.at))}</small></div><div class="tile"><b>${c.channel === 'both' ? 'القناتان' : c.channel === 'taqni' ? 'تقني فقط' : 'الموقع فقط'}</b><span>طريقة الإتاحة</span></div><div class="tile ${c.claude ? 'ok' : ''}"><b>${c.claude ? 'مفعّلة' : 'معطّلة'}</b><span>إدارة Claude</span></div><div class="tile"><b>${c.ver}</b><span>إصدار الإعدادات</span><small>${esc(c.by_name || '')}</small></div></div>
      <section class="panel"><h2>طريقة إتاحة منصة حاضر</h2><div class="ctl-opts">${OPTS.map(([k, t, d]) => `<button class="ctl-opt ${access === k ? 'on' : ''}" data-act="ctl-access" data-k="${k}" aria-pressed="${access === k}"><b>${t}</b><span>${d}</span></button>`).join('')}</div>
        ${c.channel === 'taqni' || access === 'taqni' ? `<div class="gnote warn">«تقني فقط»: يدخل المستخدمون من رابط الشعبة الموقّع في تقني (الإدارة: «الربط مع منصة تقني»)، أو عبر LTI 1.3 عند تفعيله. الشعب بلا رابط مفعّل لا يدخلها غير المسؤول.</div>` : ''}
        <div class="row" style="margin-top:10px"><button class="btn ${c.mode === 'public' ? '' : 'p'}" data-act="ctl-access" data-k="${c.channel}" ${c.mode === 'public' ? 'disabled' : ''}>العودة إلى التشغيل العام بضغطة واحدة</button></div></section>
      <section class="panel"><h2>رسالة الصيانة</h2><textarea id="ctlMsg" rows="2" maxlength="500">${esc(c.msg)}</textarea><div class="row"><button class="btn s" data-act="ctl-msg">حفظ الرسالة</button><span class="sub">تظهر في صفحة الدخول وداخل تقني أثناء الصيانة.</span></div></section>
      <section class="panel"><div class="row between"><h2 style="margin:0">الإدارة عبر Claude</h2>${sw(c.claude, 'ctl-claude', `data-v="${!c.claude}"`, c.claude ? 'مفعّلة' : 'معطّلة')}</div>
        <div class="sub">يدير Claude المنصة بأدوات محددة على الخادم (claude_tool) بحسابك كمسؤول، ويُسجَّل كل أمر بقناة «Claude». تعطيلها يوقف الأدوات فوراً (عدا قراءة الحالة)، وإعادة تفعيلها من هنا فقط وليس من Claude. تعديل الدرجات لا يتم عبر Claude.</div>
        <details style="margin-top:8px"><summary>الأدوات المتاحة وأمثلة الأوامر</summary><div class="tw"><table><thead><tr><th>الأداة</th><th>مثال أمر</th></tr></thead><tbody>${TOOLS.map(([k, t]) => `<tr><td dir="ltr" style="text-align:right"><code>${k}</code></td><td>${t}</td></tr>`).join('')}</tbody></table></div></details></section>
      ${auditPanel(o.audit, 'ops')}`;
  };
  ACT['ctl-access'] = (e) => { const k = e.dataset.k, c = C.ov.ctl;
    const steps = k === 'maint' ? [['mode', 'maintenance']] : k === 'closed' ? [['mode', 'closed']] : [['channel', k], ['mode', 'public']];
    const label = { maint: 'تفعيل وضع الصيانة', closed: 'إيقاف الوصول العام', both: 'التشغيل من القناتين', taqni: 'التشغيل من داخل تقني فقط', web: 'التشغيل من الموقع فقط' }[k];
    const sens = k === 'maint' || k === 'closed' || k === 'taqni';
    C.pend = steps;
    confirmBox(label, k === 'maint' || k === 'closed' ? 'يُمنع المدربون والمتدربون من الدخول فوراً (على الخادم)، وتبقى البيانات وقاعدة البيانات كما هي، وتبقى الإدارة متاحة لك.' : c.mode !== 'public' ? 'تعود المنصة متاحة للمستخدمين المصرح لهم.' : 'تتغير قناة الدخول المقبولة للمستخدمين فوراً.', 'ctl-access-ok', '', sens ? 'تأكيد' : '');
  };
  ACT['ctl-access-ok'] = async (e) => { if (!typedOk(e)) { toast('اكتب كلمة التأكيد كما هي.'); return; } const r = why(); try { for (const [f, v] of C.pend) await SRV('ctl_platform_set', { p_field: f, p_value: v, p_reason: r }); closeModal(); await Promise.all([loadOv(true), load(true)]); toast('طُبّق التغيير وسُجّل.'); } catch (x) { toast(errMsg(x, 'لم يُطبَّق التغيير.')); } };
  ACT['ctl-msg'] = () => call('ctl_platform_set', { p_field: 'msg', p_value: $('#ctlMsg').value, p_reason: null }, 'حُفظت رسالة الصيانة.');
  ACT['ctl-claude'] = (e) => confirmBox(e.dataset.v === 'true' ? 'تفعيل الإدارة عبر Claude' : 'تعطيل الإدارة عبر Claude', e.dataset.v === 'true' ? 'يستطيع Claude تنفيذ أدوات الإدارة المحددة بحسابك، وكل أمر يُسجَّل.' : 'تتوقف أدوات Claude فوراً عدا قراءة حالة المنصة.', 'ctl-claude-ok', `data-v="${e.dataset.v}"`);
  ACT['ctl-claude-ok'] = (e) => call('ctl_platform_set', { p_field: 'claude', p_value: e.dataset.v, p_reason: why() }, 'حُفظ.');

  /* ---------- إدارة الربط مع منصة تقني ---------- */
  const appUrl = () => { const u = new URL(location.href); u.search = ''; u.hash = ''; return WEB ? u.href : 'https://3bdr7man.github.io/haader/'; };
  const linkUrl = (tk) => `${appUrl()}?tq=${encodeURIComponent(tk)}`;
  function loadLinks(force) { if (!live() || C.lkBusy || (!force && C.links && Date.now() - C.lkAt < 30000)) return; C.lkBusy = true;
    SRV('taqni_links').then((x) => { C.links = x; C.lkAt = Date.now(); C.lkErr = ''; }).catch((e) => { C.lkErr = errMsg(e, 'تعذر التحميل.'); }).finally(() => { C.lkBusy = false; if (A.view === 'taqni') render(); }); }
  const svcName = (k) => ((C.links && C.links.catalog) || []).find((c) => c.k === k) || { n: k };
  function annHtml(s, l, tk) {
    const sv = (l.services || []).filter((x) => x.on);
    return `<div style="border:1px solid #c9d6e8;border-radius:12px;padding:14px 16px;background:#f5f9ff;font-family:Tahoma,Arial,sans-serif;direction:rtl;text-align:right">
<div style="font-size:16px;font-weight:bold;color:#003366;margin-bottom:6px">📌 ${esc(l.title)}</div>
<div style="font-size:13px;color:#33415c;margin-bottom:10px">${esc(s.course || '')} — الشعبة ${esc(s.crn)}</div>
<a href="${esc(linkUrl(tk))}" style="display:inline-block;background:#0b6b4f;color:#fff;padding:8px 16px;border-radius:8px;text-decoration:none;font-weight:bold">${esc(l.link_label)}</a>
<ul style="margin:10px 0 0;padding-inline-start:18px;font-size:13px;color:#33415c">${sv.map((x) => `<li>${esc(svcName(x.k).n)}</li>`).join('')}</ul>
<div style="font-size:11px;color:#6b778c;margin-top:8px">يُطلب الدخول بحسابك في حاضر، وتُعرض بيانات هذه الشعبة لك وحدك.</div></div>`;
  }
  VIEWS.taqni = () => {
    if (!isAdmin()) return '';
    if (!live()) return needLive('إدارة الربط مع منصة تقني');
    loadLinks(false); const L = C.links;
    if (!L) return `${gHead('إدارة الربط مع منصة تقني', '')}<div class="sub">${C.lkErr ? esc(C.lkErr) : 'جارٍ التحميل…'}</div>`;
    const secs = L.sections, on = secs.filter((s) => s.link && s.link.enabled).length, posted = secs.filter((s) => s.link && s.link.posted_at).length;
    const emb = C.cfg.svc['taqni.embed'] || {};
    return `${gHead('إدارة الربط مع منصة تقني', 'رابط وإعلان «منصة حاضر» لكل شعبة، بخدمات وأدوار ومدة إتاحة مستقلة. الرابط موقّع ويتحقق الخادم من صلة المستخدم بالشعبة.')}
      <div class="tiles"><div class="tile"><b>${secs.length}</b><span>الشعب</span></div><div class="tile ok"><b>${on}</b><span>رابط مفعّل</span></div><div class="tile"><b>${posted}</b><span>أُضيف إعلانها في تقني</span><small>يسجله المسؤول بعد الإضافة</small></div><div class="tile ${emb.e ? 'ok' : 'bad'}"><b>${emb.e ? 'مفعّلة' : 'معطّلة'}</b><span>خدمة التشغيل من تقني</span></div><div class="tile ${(L.lti || []).some((x) => x.active) ? 'ok' : ''}"><b>${(L.lti || []).some((x) => x.active) ? 'مسجّل' : 'غير مسجّل'}</b><span>LTI 1.3</span><small>يتطلب مسؤول تقني</small></div></div>
      <section class="panel"><h2>الشعب</h2><div class="tw"><table><thead><tr><th class="n">الشعبة</th><th>المقرر</th><th>المدرب</th><th class="n">رابط حاضر</th><th>الخدمات</th><th class="n">مقرر تقني</th><th class="n">الإعلان</th><th></th></tr></thead><tbody>${secs.map((s) => { const l = s.link;
        return `<tr><td class="n"><b>${s.crn}</b></td><td>${esc(s.course || '')}</td><td>${esc(s.trainer || '—')}</td><td class="n">${l ? sw(l.enabled, 'tq-tog', `data-crn="${s.crn}" data-v="${!l.enabled}" aria-label="رابط ${s.crn}"`, l.enabled ? 'مفعّل' : 'موقوف') : '<span class="chip">غير مُعدّ</span>'}</td>
          <td><small>${l ? (l.services || []).filter((x) => x.on).map((x) => esc(svcName(x.k).n)).join('، ') || 'لا توجد' : '—'}</small></td><td class="n"><small dir="ltr">${esc((l && l.course_id) || '—')}</small></td><td class="n"><small>${l && l.posted_at ? `أُضيف ${esc(fmtAt(l.posted_at).split('،')[0])}` : 'لم يُضف'}</small></td><td><button class="btn s" data-act="tq-edit" data-crn="${s.crn}">${l ? 'إعداد ومعاينة' : 'إعداد الرابط'}</button></td></tr>`; }).join('')}</tbody></table></div></section>
      <section class="panel"><h2>طريقة التشغيل من داخل تقني</h2><ol class="ctl-steps">
        <li><b>الرابط الموقّع لكل شعبة (جاهز الآن):</b> يُضاف إعلان الشعبة في تقني برابطها؛ يفتح حاضر مع تحديد الشعبة، ويتحقق الخادم من أن الداخل مدربها أو متدرب مسجل فيها. لعرضه داخل صفحة المقرر دون مغادرة تقني يُضاف في تقني «رابط URL» بعرض «مضمَّن (Embed)» إلى الرابط نفسه، ويشير الإعلان إليه.</li>
        <li><b>LTI 1.3 (الدخول الموحد دون كلمة مرور):</b> يتطلب أن يسجّل مسؤول تقني حاضر أداةً خارجية ويزوّد حاضر بمعرّف العميل وعناوين المصادقة والمفاتيح. لا يُعتبر مكتملاً قبل اختبار التشغيل الفعلي.</li>
        <li>لا يضيف حاضر أي إعلان في تقني تلقائياً، ولا يحذف الإعلانات الحالية؛ «سجّل الإضافة» بعد إضافة الإعلان يدوياً حتى لا يتكرر.</li></ol></section>
      ${auditPanel((C.ov && C.ov.audit) || [], 'all').replace('<h2 style="margin:0">سجل التدقيق</h2>', '<h2 style="margin:0">سجل التدقيق (كل التغييرات)</h2>')}`;
  };
  ACT['tq-tog'] = (e) => confirmBox(`${e.dataset.v === 'true' ? 'تفعيل' : 'إيقاف'} رابط حاضر للشعبة ${e.dataset.crn}`, e.dataset.v === 'true' ? 'يعمل الرابط وإعلانه في تقني لهذه الشعبة.' : 'يتوقف الرابط مؤقتاً دون حذف إعدادات الشعبة، ويظهر لمن يفتحه أنه موقوف.', 'tq-save', `data-crn="${e.dataset.crn}" data-p='${JSON.stringify({ enabled: e.dataset.v === 'true' })}'`);
  ACT['tq-save'] = async (e) => { const r = await call('taqni_link_set', { p_crn: e.dataset.crn, p_patch: JSON.parse(e.dataset.p), p_reason: why() }, 'حُفظ رابط الشعبة وسُجّل.'); if (r) loadLinks(true); };
  ACT['tq-edit'] = (e) => {
    const s = C.links.sections.find((x) => x.crn === e.dataset.crn), l = s.link || { enabled: false, title: 'خدمات منصة حاضر', link_label: 'الدخول إلى منصة حاضر', services: [{ k: 'home', on: true, roles: ['trainer', 'trainee'] }, { k: 'attendance', on: true, roles: ['trainer', 'trainee'] }, { k: 'reports', on: true, roles: ['trainer', 'trainee'] }] };
    const cat = C.links.catalog, order = l.services.map((x) => x.k).concat(cat.map((c) => c.k).filter((k) => !l.services.some((x) => x.k === k)));
    C.tqEdit = { crn: s.crn, order };
    const row = (k) => { const x = l.services.find((y) => y.k === k) || { on: false, roles: ['trainer', 'trainee'] }; return `<tr data-k="${k}"><td><label class="row ck"><input type="checkbox" class="tqOn" ${x.on ? 'checked' : ''}> ${esc(svcName(k).n)}</label></td><td><label class="row ck"><input type="checkbox" class="tqT" ${x.roles.includes('trainer') ? 'checked' : ''}> المدرب</label></td><td><label class="row ck"><input type="checkbox" class="tqS" ${x.roles.includes('trainee') ? 'checked' : ''}> المتدرب</label></td><td class="n"><button class="lnk small" data-act="tq-up" aria-label="أعلى">▲</button> <button class="lnk small" data-act="tq-dn" aria-label="أسفل">▼</button></td></tr>`; };
    const d = (v) => (v ? new Date(v).toISOString().slice(0, 16) : '');
    modal(`<h2>رابط حاضر للشعبة ${s.crn} — ${esc(s.course || '')}</h2>
      <div class="rs-grid"><label>معرّف المقرر في تقني<input type="text" id="tqCid" dir="ltr" value="${esc(l.course_id || '')}" placeholder="مثل 270852"></label><label>اسم الإعلان<input type="text" id="tqTitle" value="${esc(l.title)}" maxlength="120"></label><label>عنوان الرابط<input type="text" id="tqLbl" value="${esc(l.link_label)}" maxlength="80"></label>
        <label>بداية الإتاحة<input type="datetime-local" id="tqS0" value="${d(l.start_at)}"></label><label>نهاية الإتاحة<input type="datetime-local" id="tqS1" value="${d(l.end_at)}"></label><label class="row ck" style="align-self:end"><input type="checkbox" id="tqEn" ${l.enabled ? 'checked' : ''}> الرابط مفعّل</label></div>
      <h3>الخدمات في إعلان الشعبة (بالترتيب، ولكل دور)</h3><div class="tw"><table class="tq-svc"><tbody>${order.map(row).join('')}</tbody></table></div>
      <label>سبب التغيير (اختياري)<input type="text" id="ctlWhy" maxlength="300"></label>
      <div class="row"><button class="btn p" data-act="tq-edit-ok">حفظ</button><button class="btn" data-act="tq-prev">معاينة الإعلان</button>${s.token ? '<button class="btn" data-act="tq-copy">نسخ الرابط</button><button class="btn" data-act="tq-copy-html">نسخ كود الإعلان (HTML)</button><button class="btn" data-act="tq-posted">سجّل إضافة الإعلان في تقني</button><button class="btn d" data-act="tq-revoke">إلغاء الرابط وإصدار رابط جديد</button>' : ''}<button class="btn" data-act="modal-close">إغلاق</button></div>
      <div id="tqPrev"></div>`);
  };
  const collect = () => { const rows = [...document.querySelectorAll('.tq-svc tr')]; return { course_id: $('#tqCid').value.trim(), title: $('#tqTitle').value.trim(), link_label: $('#tqLbl').value.trim(), enabled: $('#tqEn').checked,
    start_at: $('#tqS0').value ? new Date($('#tqS0').value).toISOString() : '', end_at: $('#tqS1').value ? new Date($('#tqS1').value).toISOString() : '',
    services: rows.map((r) => ({ k: r.dataset.k, on: r.querySelector('.tqOn').checked, roles: [r.querySelector('.tqT').checked ? 'trainer' : null, r.querySelector('.tqS').checked ? 'trainee' : null].filter(Boolean) })) }; };
  ACT['tq-up'] = (e) => { const tr = e.closest('tr'); if (tr.previousElementSibling) tr.parentNode.insertBefore(tr, tr.previousElementSibling); };
  ACT['tq-dn'] = (e) => { const tr = e.closest('tr'); if (tr.nextElementSibling) tr.parentNode.insertBefore(tr.nextElementSibling, tr); };
  ACT['tq-edit-ok'] = async () => { const crn = C.tqEdit.crn; const r = await call('taqni_link_set', { p_crn: crn, p_patch: collect(), p_reason: why() }, 'حُفظ رابط الشعبة وسُجّل.'); if (r) { loadLinks(true); } };
  const cur = () => C.links.sections.find((x) => x.crn === C.tqEdit.crn);
  ACT['tq-prev'] = () => { const s = cur(), l = Object.assign({}, s.link || {}, collect()); $('#tqPrev').innerHTML = `<h3>معاينة إعلان الشعبة</h3>${s.token ? annHtml(s, l, s.token) : '<div class="sub">احفظ الإعداد أولاً لإصدار الرابط الموقّع.</div>'}`; };
  ACT['tq-copy'] = () => { const s = cur(); copyText(linkUrl(s.token), 'نُسخ رابط الشعبة.'); };
  ACT['tq-copy-html'] = () => { const s = cur(); copyText(annHtml(s, Object.assign({}, s.link, collect()), s.token), 'نُسخ كود الإعلان. الصقه في محرر تقني بوضع HTML.'); };
  ACT['tq-posted'] = () => { const crn = C.tqEdit.crn; closeModal(); confirmBox(`تسجيل إضافة إعلان الشعبة ${crn} في تقني`, 'سجّل هذا بعد أن تضيف الإعلان فعلاً في صفحة الشعبة في تقني، حتى لا يُضاف مرة أخرى. لا يتصل حاضر بتقني.', 'tq-save', `data-crn="${crn}" data-p='${JSON.stringify({ posted: true })}'`); };
  ACT['tq-revoke'] = () => { const crn = C.tqEdit.crn; closeModal(); confirmBox(`إلغاء رابط الشعبة ${crn}`, 'يبطل الرابط الحالي فوراً (ومنه ما في الإعلان القديم)، ويصدر رابط جديد يجب وضعه في إعلان تقني.', 'tq-save', `data-crn="${crn}" data-p='${JSON.stringify({ revoke: true })}'`, 'إلغاء'); };

  if (typeof GACT !== 'undefined') Object.assign(GACT, { 'roster': GACT.roster || 'إدراج الشعب والمتدربين' });
})();
