/* ====================================================================
   منصة حاضر على الويب — طبقة الاتصال بالخادم (Supabase)
   تقدّم للمنصة الواجهة نفسها التي تقدّمها بيئة Claude (claude.use)
   فتعمل شيفرة المنصة كما هي، وبياناتها وصلاحياتها على الخادم.

   الدخول: اسم المستخدم (أو الرقم التدريبي) وكلمة المرور، في خطوة واحدة.
   كلمة المرور لا تغادر المتصفح: تُحسب بصمتها PBKDF2 بالملح القادم من الخادم،
   وتُرسل البصمة إلى نظام المصادقة. الدور يأتي من الخادم لا من الواجهة.
   ==================================================================== */
(() => {
  const qs = new URLSearchParams(location.search);
  const local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const CFG = Object.assign({}, window.HAADER_CFG, local && qs.get('sb') ? { url: qs.get('sb'), key: 'local' } : {});
  const REST = CFG.url + '/rest/v1/', AUTH = CFG.url + '/auth/v1/';
  const KEY = 'haader.auth.v2';
  const S = { token: null, refresh: null, exp: 0, uid: null, me: null, ready: null, done: null, refreshing: null, timer: null, phase: 'boot', flash: '' };
  S.ready = new Promise((r) => { S.done = r; });

  /* ---------- التخزين: المتصفح، ثم الذاكرة إن مُنع ---------- */
  const mem = {};
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return mem[k] || null; } },
    set(k, v) { mem[k] = v; try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* الذاكرة تكفي */ } },
  };
  const sstore = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return mem['s.' + k] || null; } },
    set(k, v) { mem['s.' + k] = v; try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) { /* */ } },
  };

  /* ---------- رسائل الأخطاء بالعربية ---------- */
  class HErr extends Error { constructor(msg, status, code) { super(msg); this.status = status; this.code = code || ''; } }
  const arabic = (t) => /[؀-ۿ]/.test(t || '');
  function errOf(status, j, t) {
    const m = (j && (j.message || j.msg || j.error_description || j.error)) || t || '';
    if (arabic(m)) return new HErr(m, status, (j && j.code) || '');
    if (status === 401) return new HErr('انتهت الجلسة. سجّل الدخول من جديد.', status, 'unauthenticated');
    if (status === 403 || (j && j.code === '42501')) return new HErr('لا تملك صلاحية هذه العملية.', status, 'permission_denied');
    if (status === 409 || (j && j.code === '23505')) return new HErr('القيمة مستخدمة مسبقاً.', status, 'conflict');
    if (status >= 500) return new HErr('تعذر الحفظ في الخادم. أعد المحاولة بعد قليل.', status, 'unavailable');
    return new HErr('تعذر تنفيذ الطلب (' + status + ').', status, (j && j.code) || '');
  }

  /* ---------- الجلسة ---------- */
  function keep(j) {
    S.token = j.access_token; S.refresh = j.refresh_token; S.exp = Date.now() + (j.expires_in || 3600) * 1000;
    S.uid = (j.user || {}).id || S.uid;
    store.set(KEY, { r: S.refresh, a: S.token, e: S.exp, u: S.uid });
    clearTimeout(S.timer);
    S.timer = setTimeout(() => { refresh(); }, Math.max(30000, S.exp - Date.now() - 120000));
    if (RT) { try { RT.realtime.setAuth(S.token); } catch (e) { /* */ } }
  }
  function clearSession() { clearTimeout(S.timer); S.token = S.refresh = null; S.exp = 0; store.set(KEY, null); }
  async function authCall(path, body, token) {
    let r;
    try { r = await fetch(AUTH + path, { method: 'POST', headers: Object.assign({ apikey: CFG.key, 'Content-Type': 'application/json' }, token ? { Authorization: 'Bearer ' + token } : {}), body: JSON.stringify(body || {}) }); }
    catch (e) { throw new HErr('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.', 0, 'unavailable'); }
    const t = await r.text(); let j = {}; try { j = t ? JSON.parse(t) : {}; } catch (e) { /* */ }
    if (!r.ok) { const e = new HErr(j.error_description || j.msg || j.message || 'تعذر الدخول', r.status, j.error_code || j.error || ''); throw e; }
    return j;
  }
  /* تجديد واحد في كل مرة مهما تعددت الطلبات، ويُستفاد من تجديد تبويب آخر */
  function refresh() {
    if (S.refreshing) return S.refreshing;
    S.refreshing = (async () => {
      const saved = store.get(KEY);
      if (saved && saved.r && saved.r !== S.refresh && saved.e > Date.now() + 60000) { S.refresh = saved.r; S.token = saved.a; S.exp = saved.e; S.uid = saved.u; return true; }
      if (!S.refresh) return false;
      try { keep(await authCall('token?grant_type=refresh_token', { refresh_token: S.refresh })); return true; }
      catch (e) {
        if (e.status === 0) return false;                 // انقطاع مؤقت: تبقى الجلسة
        const again = store.get(KEY);                      // تبويب آخر جدّد في اللحظة نفسها
        if (again && again.r && again.r !== S.refresh) { S.refresh = again.r; S.token = again.a; S.exp = again.e; return true; }
        clearSession(); expired(); return false;
      } finally { setTimeout(() => { S.refreshing = null; }, 0); }
    })();
    return S.refreshing;
  }
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return;
    const v = store.get(KEY);
    if (v && v.r) { S.refresh = v.r; S.token = v.a; S.exp = v.e; }
    else if (S.token && S.phase !== 'login') { S.token = null; location.reload(); }   // خروج من تبويب آخر
  });
  function expired() {
    if (S.phase === 'login') return;
    sstore.set('haader.flash', 'انتهت جلستك أو أُوقف الحساب. سجّل الدخول من جديد.');
    location.reload();
  }

  /* ---------- طبقة الوصول إلى القاعدة ---------- */
  async function api(path, opts = {}, retried) {
    if (S.token && S.exp - Date.now() < 60000) await refresh();
    const o = Object.assign({}, opts);
    o.headers = Object.assign({ apikey: CFG.key, 'Content-Type': 'application/json' }, S.token ? { Authorization: 'Bearer ' + S.token } : {}, opts.headers || {});
    let r;
    try { r = await fetch(REST + path, o); }
    catch (e) { throw new HErr('تعذر الاتصال بالخادم. تحقق من اتصالك بالإنترنت.', 0, 'unavailable'); }
    if (r.status === 401 && S.refresh && !retried) { if (await refresh()) return api(path, opts, true); }
    const t = await r.text(); let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
    if (!r.ok) {
      const e = errOf(r.status, j, t);
      if (arabic(e.message) && window.toast && e.status !== 0) setTimeout(() => { try { window.toast(e.message); } catch (x) { /* */ } }, 50);
      throw e;
    }
    return j;
  }
  const rpc = (fn, args) => api('rpc/' + fn, { method: 'POST', body: JSON.stringify(args || {}) });
  const esc = (v) => encodeURIComponent(v);

  /* ---------- مجموعات الوثائق: الواجهة نفسها التي تستخدمها المنصة ---------- */
  const snapOf = (rows) => {
    const docs = (rows || []).map((r) => { const d = r.data || {}; return { id: r.id, exists: true, data: () => JSON.parse(JSON.stringify(d)), metadata: { fromCache: false } }; });
    return { docs, size: docs.length, empty: !docs.length, metadata: { fromCache: false, hasPendingWrites: false }, docChanges: () => [] };
  };
  const SUBS = {};
  let RT = null, poll = null;
  const fetchCol = (col) => api('doc?col=eq.' + esc(col) + '&select=id,data');
  function bump(col) {
    const L = SUBS[col]; if (!L || !L.length) return;
    clearTimeout(L.t);
    L.t = setTimeout(async () => {
      try { const rows = await fetchCol(col); L.forEach((x) => x.fn(snapOf(rows))); }
      catch (e) { L.forEach((x) => { if (x.err) x.err({ code: e.code || 'unavailable', message: e.message }); }); }
    }, 120);
  }
  async function startRealtime() {
    if (RT || !window.supabase || !S.token) return;
    try {
      RT = window.supabase.createClient(CFG.url, CFG.key, { auth: { persistSession: false, autoRefreshToken: false } });
      RT.realtime.setAuth(S.token);
      RT.channel('doc-all').on('postgres_changes', { event: '*', schema: 'public', table: 'doc' }, (p) => {
        const col = (p.new && p.new.col) || (p.old && p.old.col); if (col) bump(col);
      }).subscribe();
    } catch (e) { RT = null; }
  }
  function docRef(col, id) {
    return {
      id, path: col + '/' + id,
      async get() {
        const rows = await api('doc?col=eq.' + esc(col) + '&id=eq.' + esc(id) + '&select=id,data');
        const r = rows && rows[0];
        return { id, exists: !!r, data: () => (r ? JSON.parse(JSON.stringify(r.data || {})) : undefined), metadata: { fromCache: false } };
      },
      async set(data) {
        await api('doc?on_conflict=col,id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify({ col, id, data }) });
        bump(col);
      },
      async update(patch) { await rpc('doc_merge', { p_col: col, p_id: id, p_patch: patch, p_crn: null }); bump(col); },
      async delete() {
        const rows = await api('doc?col=eq.' + esc(col) + '&id=eq.' + esc(id), { method: 'DELETE', headers: { Prefer: 'return=representation' } });
        if (!rows || !rows.length) throw new HErr('لا تملك صلاحية الحذف، أو أن هذا السجل لا يُحذف.', 403, 'permission_denied');
        bump(col);
      },
      collection(sub) { return colRef(col + '/' + id + '/' + sub); },
    };
  }
  const newId = () => 'x' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function colRef(col) {
    return {
      path: col,
      onSnapshot(fn, err) {
        const x = { fn, err };
        (SUBS[col] = SUBS[col] || []).push(x);
        bump(col);
        if (!poll) poll = setInterval(() => Object.keys(SUBS).forEach(bump), 45000);
        startRealtime();
        return () => { SUBS[col] = (SUBS[col] || []).filter((f) => f !== x); };
      },
      async get() { return snapOf(await fetchCol(col)); },
      doc(id) { return docRef(col, id || newId()); },
      async add(d) {
        const id = newId();
        await api('doc', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ col, id, data: d }) });
        bump(col); return docRef(col, id);
      },
    };
  }
  const DB = { collection: colRef, doc: (p) => { const i = p.lastIndexOf('/'); return docRef(p.slice(0, i), p.slice(i + 1)); } };

  /* ---------- التنزيلات: من المتصفح مباشرة ---------- */
  const DL = {
    async save({ filename, data }) {
      const blob = data instanceof Blob ? data : new Blob([data], { type: 'application/octet-stream' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = filename || 'file';
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    },
  };

  /* ---------- الدخول ---------- */
  async function pbkdf2(pw, saltHex, iter) {
    const salt = Uint8Array.from(saltHex.match(/../g).map((x) => parseInt(x, 16)));
    const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveBits']);
    const b = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter }, k, 256);
    return Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('');
  }
  async function credentialsFor(user, pw) {
    const s = await rpc('login_salt', { p_user: user });
    return { email: s.email, password: await pbkdf2(pw, s.salt, s.iter) };
  }
  function loginMessage(e) {
    if (e.status === 0) return e.message;
    if (/banned/i.test(e.code + e.message)) return 'هذا الحساب معطّل. راجع مسؤول المنصة أو مدرب المقرر.';
    if (e.status === 429 || /rate|too many/i.test(e.code + e.message)) return 'محاولات كثيرة متتالية. انتظر دقائق ثم أعد المحاولة.';
    if (e.status === 400 || e.status === 401 || /invalid/i.test(e.code + e.message)) return 'اسم المستخدم أو كلمة المرور غير صحيحة.';
    return 'تعذر تسجيل الدخول الآن. أعد المحاولة بعد قليل.';
  }
  async function login(user, pw) {
    user = String(user || '').trim(); pw = String(pw || '');
    if (!user || !pw) throw new HErr('أدخل اسم المستخدم وكلمة المرور.', 400);
    let c;
    try { c = await credentialsFor(user, pw); } catch (e) { throw new HErr(e.status === 0 ? e.message : 'تعذر الاتصال بالخادم. أعد المحاولة.', e.status); }
    try { keep(await authCall('token?grant_type=password', c)); }
    catch (e) { throw new HErr(loginMessage(e), e.status, e.code); }
    await afterAuth(true);
  }
  /* التحقق من كلمة المرور الحالية (لتغييرها) دون المساس بالجلسة */
  async function verifyPassword(user, pw) {
    try { const c = await credentialsFor(user, pw); await authCall('token?grant_type=password', c); return true; } catch (e) { return false; }
  }
  async function afterAuth(fresh) {
    let who;
    try { who = await rpc('whoami', {}); } catch (e) { clearSession(); throw new HErr('تعذر التحقق من الحساب. أعد المحاولة.', e.status); }
    if (!who || who.kind === 'none' || (who.kind === 'staff' && !who.active)) {
      await signOut(true);
      throw new HErr('هذا الحساب غير مرتبط بالمنصة أو معطّل. راجع مسؤول المنصة.', 403);
    }
    S.me = who;
    if (who.kind === 'staff') {
      S.phase = 'staff';
      if (fresh) { try { await api('doc', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ col: 'logins', id: newId(), data: { at: new Date().toISOString(), username: who.username, ok: true, note: 'دخول', ua: (navigator.userAgent.match(/(Edg|Chrome|Firefox|Safari)\/[\d]+/) || ['متصفح'])[0] } }) }); } catch (e) { /* السجل لا يمنع الدخول */ } }
      S.done(true);
    } else {
      S.phase = 'trainee';
      if (window.HAADER_PORTAL) window.HAADER_PORTAL.start(who, fresh);
    }
    if (window.HAADER_WEB_RENDER) window.HAADER_WEB_RENDER();
  }
  async function signOut(silent) {
    try { if (S.token) await authCall('logout?scope=local', {}, S.token); } catch (e) { /* يكفي مسح الجلسة محلياً */ }
    clearSession();
    if (!silent) { try { history.replaceState(null, '', location.pathname); } catch (e) { /* */ } location.reload(); }
  }

  /* ---------- واجهة claude كما تتوقعها المنصة ---------- */
  const CAP = {
    db: DB,
    downloads: DL,
    assets: null,
    user: {
      id: async () => S.uid,
      isOwner: async () => !!(S.me && S.me.role === 'admin'),
      can: async () => !!(S.me && S.me.role !== 'viewer'),
      canEdit: async () => !!(S.me && S.me.role !== 'viewer'),
      me: async () => ({ id: S.uid, name: (S.me && S.me.name) || '' }),
    },
  };
  window.claude = { use: async (n) => { await S.ready; return CAP[n] || null; } };

  /* رمز QR في الرابط: يُحفظ حتى يكتمل الدخول */
  const qrIn = /(?:^#|&)qr=([^&]+)/.exec(location.hash);
  if (qrIn) { sstore.set('haader.qr', decodeURIComponent(qrIn[1])); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* */ } }

  window.HAADER_WEB = {
    S, CFG, api, rpc, login, signOut, verifyPassword, pbkdf2, bump, store, sstore, HErr,
    get phase() { return S.phase; },
    get me() { return S.me; },
    takeFlash() { const f = sstore.get('haader.flash'); sstore.set('haader.flash', null); return f || ''; },
    takeQr() { const q = sstore.get('haader.qr'); sstore.set('haader.qr', null); return q || ''; },
    peekQr() { return sstore.get('haader.qr') || ''; },
    qrLink(code) { return location.origin + location.pathname + '#qr=' + encodeURIComponent(code); },
  };

  /* ---------- الإقلاع: جلسة محفوظة أو شاشة الدخول ---------- */
  document.addEventListener('DOMContentLoaded', async () => {
    const saved = store.get(KEY);
    if (saved && saved.r) {
      S.refresh = saved.r; S.token = saved.a; S.exp = saved.e || 0; S.uid = saved.u;
      const ok = S.exp - Date.now() > 90000 ? true : await refresh();
      if (ok) { try { await afterAuth(false); return; } catch (e) { S.flash = e.message; } }
    }
    S.phase = 'login';
    if (window.HAADER_WEB_RENDER) window.HAADER_WEB_RENDER();
  });
})();
