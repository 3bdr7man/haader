/* ====================================================================
   نسخة Claude للاطلاع، مرآة للرابط (قاعدة بيانات Supabase)
   - الرابط https://3bdr7man.github.io/haader/ هو مكان الإدخال الوحيد
   - نسخة Claude للاطلاع فقط: لا تكتب في قاعدة بياناتها شيئاً من الواجهة
   - وتجلب البيانات من الرابط تلقائياً عبر موصل Supabase في حساب صاحب المنصة
     (استعلامات قراءة SELECT ثابتة)، فتحدّث قاعدة بيانات نسخة Claude بما تغيّر،
     عند الفتح وكل دقيقة ما دامت الصفحة ظاهرة، وبزر «مزامنة الآن»
   لا تُنقل الحسابات ولا كلمات المرور ولا سجلات الدخول.
   ==================================================================== */
if (document.getElementById('shell') && !window.HAADER_WEB) (() => {
  const SRV = 'Supabase', PROJECT = 'urtdulwbpabslicxtsoa', EVERY = 10000;
  const COLS = ['sections', 'marks', 'notes', 'meta', 'qrs', 'warnlog', 'bosla', 'bviol', 'bcase', 'bforms', 'gsec', 'gmarks', 'gcfg', 'gsnap', 'gops', 'accounts', 'tacc'];
  /* الحسابات: تُنقل بياناتها (الاسم والدور والصلاحيات والحالة وآخر دخول) دون بصمات كلمات المرور،
     ولا يُحذف منها شيء هنا. دخول نسخة Claude لصاحب المنصة بحسابه في Claude، فلا يتأثر بتغيير كلمة المرور */
  const CRED = ['salt', 'iter', 'hash', 'mustChange'];
  const NODEL = { accounts: true, tacc: true };
  const shape = (col, id, data) => {
    if (col !== 'accounts' && col !== 'tacc') return data;
    const loc = ((A.raw || {})[col] || {})[id] || {}, d = Object.assign({}, data);
    CRED.forEach((k) => { delete d[k]; if (k in loc) d[k] = loc[k]; });
    return d;
  };
  const KEEP = { meta: ['qrkey', 'audit', 'mirror', 'emailblock'] };   // خاصة بنسخة Claude لا تُستبدل ولا تُحذف
  const kept = (c, id) => (KEEP[c] || []).includes(id);
  A.readOnly = !window.__HAADER_RW;
  const M = { mcp: null, state: 'init', code: '', at: null, n: 0, busy: false, tried: false, sig: '', owner: false };
  const colsSql = () => COLS.map((c) => "'" + c + "'").join(',');
  const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
  /* نتيجة execute_sql: نص يضم مصفوفة JSON بين وسمي untrusted-data */
  function rowsOf(res) {
    if (Array.isArray(res)) return res;
    let t = res;
    if (t && typeof t === 'object') t = typeof t.result === 'string' ? t.result : Array.isArray(t.result) ? t.result : JSON.stringify(t);
    if (Array.isArray(t)) return t;
    t = String(t || '');
    const m = /<untrusted-data-[^>]*>\s*([\s\S]*?)\s*<\/untrusted-data-/.exec(t), body = m ? m[1] : t;
    const i = body.indexOf('['), j = body.lastIndexOf(']');
    if (i < 0 || j < i) throw Object.assign(new Error('bad'), { code: 'parse' });
    return JSON.parse(body.slice(i, j + 1));
  }
  async function sql(query) {
    const r = await M.mcp.callTool(SRV, 'execute_sql', { project_id: PROJECT, query }, { cache: false });
    let p = r && r.payload;
    if (p === undefined && r && r.content && r.content[0]) p = r.content[0].text;
    return rowsOf(p);
  }
  async function pull(manual) {
    if (M.busy || !M.mcp || !db) return;
    if (!manual && document.hidden) return;
    M.busy = true; M.tried = true; if (manual) { M.state = 'pulling'; paint(); }
    try {
      const list = (await sql(`select col, id, updated_at::text as u from doc where col in (${COLS.map(q).join(',')}) order by col, id`)).filter((r) => !kept(r.col, r.id));
      if (!list.some((r) => r.col === 'sections') || !list.some((r) => r.col === 'marks')) throw Object.assign(new Error('empty'), { code: 'parse' });
      const prev = ((A.raw.meta || {}).mirror || {}).u || {};
      const changed = list.filter((r) => prev[r.col + '/' + r.id] !== r.u || !(A.raw[r.col] || {})[r.id]);
      for (let i = 0; i < changed.length; i += 10) {
        const part = changed.slice(i, i + 10);
        const rows = await sql(`select col, id, data from doc where (col, id) in (${part.map((r) => `(${q(r.col)},${q(r.id)})`).join(',')})`);
        for (const r of rows) { if (r && r.col && r.id && r.data && typeof r.data === 'object') await db.doc(r.col + '/' + r.id).set(shape(r.col, r.id, r.data)); }
      }
      /* ما حُذف من الرابط يُحذف هنا (للمجموعات المحمّلة وحدها) */
      const have = new Set(list.map((r) => r.col + '/' + r.id)); let del = 0;
      for (const c of COLS) {
        const loc = A.raw[c]; if (!loc || typeof loc !== 'object' || NODEL[c]) continue;
        for (const id of Object.keys(loc)) if (!kept(c, id) && !have.has(c + '/' + id)) { await db.doc(c + '/' + id).delete(); del++; }
      }
      const u = {}; list.forEach((r) => { u[r.col + '/' + r.id] = r.u; });
      const at = new Date().toISOString();
      if (changed.length || del || !((A.raw.meta || {}).mirror)) await db.doc('meta/mirror').set({ u, at, n: changed.length + del });
      M.state = 'ok'; M.code = ''; M.at = at; M.n = changed.length + del;
      M.sig = list.length + '|' + list.reduce((x, r) => (r.u > x ? r.u : x), '');
    } catch (e) {
      M.state = 'err'; M.code = (e && e.code) || 'upstream_error';
    } finally { M.busy = false; paint(); }
  }
  /* فحص خفيف كل 10 ثوانٍ: عدد الوثائق وآخر وقت تعديل؛ فإن تغيّر أحدهما جُلب ما تغيّر */
  const STOP = { needs_reauth: 1, server_not_connected: 1, not_in_manifest: 1, approval_required: 1, blocked_by_policy: 1, selection_required: 1 };
  async function probe() {
    if (M.busy || !M.mcp || !db || document.hidden || (M.state === 'err' && STOP[M.code])) return;   // حالات تحتاج إجراءً من المستخدم: لا إعادة تلقائية
    try {
      const r = (await sql(`select count(*)::int as n, coalesce(max(updated_at)::text, '') as m from doc where col in (${colsSql()}) and not (col = 'meta' and id in ('qrkey','audit','mirror','emailblock'))`))[0] || {};
      const sig = r.n + '|' + r.m;
      if (sig !== M.sig) await pull(false);
    } catch (e) { M.state = 'err'; M.code = (e && e.code) || 'upstream_error'; paint(); }
  }
  const WHY = {
    needs_reauth: 'انتهى ربط Supabase بحسابك. أعد ربطه من إعدادات claude.ai ← الموصلات، ثم اضغط «مزامنة الآن».',
    server_not_connected: 'موصل Supabase غير مضاف في حساب من يفتح هذه النسخة. أضفه من إعدادات claude.ai ← الموصلات لتصل بيانات الرابط هنا.',
    selection_required: 'في حسابك أكثر من موصل باسم Supabase: اختر واحداً عندما يطلب claude.ai ذلك.',
    not_in_manifest: 'لم يُسمح لهذه الصفحة باستخدام Supabase. اضغط «مزامنة الآن» واسمح بها.',
    approval_required: 'تحتاج المزامنة موافقتك على استخدام Supabase. اضغط «مزامنة الآن» ووافق.',
    blocked_by_policy: 'سياسة المؤسسة تمنع استخدام Supabase من هذه الصفحة.',
    tool_error: 'رفض Supabase الاستعلام. اضغط «مزامنة الآن» لإعادة المحاولة.',
    parse: 'وصل رد غير متوقع من Supabase. اضغط «مزامنة الآن» لإعادة المحاولة.'
  };
  const hm = (iso) => { try { return new Date(iso).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' }); } catch (e) { return ''; } };
  function bar() {
    const last = M.at || ((A.raw.meta || {}).mirror || {}).at;
    let msg, cls = '';
    if (!M.mcp) msg = 'تُعرض آخر بيانات جُلبت من الرابط. لجلب الجديد افتح هذه النسخة من حسابك المرتبط بـ Supabase.';
    else if (M.state === 'pulling' || (M.state === 'init' && !M.tried)) msg = 'جارٍ جلب آخر البيانات من الرابط…';
    else if (M.state === 'err') { msg = WHY[M.code] || 'تعذّر الوصول إلى الرابط الآن. تبقى آخر بيانات جُلبت ظاهرة.'; cls = ' warn'; }
    else msg = `تُجلب البيانات من الرابط تلقائياً خلال ثوانٍ من أي تعديل فيه${M.n ? ` • حُدّثت ${M.n} وثيقة في آخر مزامنة` : ''}.`;
    if (A.wtOn && A.wtOn()) return `<section class="mirbar${cls}" id="mirBar" role="status"><b>مزامنة رايات تعمل من هنا</b><span>نتيجة الجسر واعتماد الفروقات تُحفظ في الرابط مباشرة، وتعود إلى هذه النسخة خلال ثوانٍ. ${M.state === 'err' ? msg : ''}${last ? ` آخر مزامنة: ${hm(last)}.` : ''}</span><button class="btn s" data-mir="pull" ${M.busy ? 'disabled' : ''}>${M.busy ? 'جارٍ الجلب…' : 'مزامنة الآن'}</button></section>`;
    return `<section class="mirbar${cls}" id="mirBar" role="status"><b>نسخة Claude للاطلاع فقط</b><span>سجّل التحضير والتعديلات من الرابط <span dir="ltr">3bdr7man.github.io/haader</span>. ${msg}${last ? ` آخر مزامنة: ${hm(last)}.` : ''}</span>${M.mcp ? `<button class="btn s" data-mir="pull" ${M.busy ? 'disabled' : ''}>${M.busy ? 'جارٍ الجلب…' : 'مزامنة الآن'}</button>` : ''}</section>`;
  }
  function paint() {
    if (!A.readOnly || !A.me) return;
    const main = document.getElementById('main'); if (!main) return;
    const old = document.getElementById('mirBar'), h = bar();
    if (old) { old.outerHTML = h; return; }
    const tl = document.getElementById('tlBar');
    if (tl && tl.parentNode === main) tl.insertAdjacentHTML('afterend', h); else main.insertAdjacentHTML('afterbegin', h);
  }
  document.addEventListener('click', (ev) => { const b = ev.target.closest && ev.target.closest('[data-mir="pull"]'); if (b) pull(true); });

  /* ---------- مزامنة رايات من نسخة Claude ----------
     الرابط محجوب على شبكة الكلية، ورايات لا يُفتح إلا من الحاسب، فصفحة «مزامنة رايات» هنا تعمل لصاحب المنصة وحده:
     نتيجة الجسر واعتماد فروقاته تُكتب في قاعدة الرابط مباشرة عبر موصل Supabase، ثم تعود إلى هنا بالمرآة.
     لا يُكتب غير: meta/rayat و marks/<الشعبة> و meta/lectures، وسطور السجل meta/audit إلحاقاً. */
  const WT_PATH = /^(meta\/(rayat|lectures|audit)|marks\/[0-9A-Za-z_-]+)$/;
  A.wtOn = () => !!(A.readOnly && M.mcp && M.owner && A.view === 'sync');
  const WQ = [], SENT = new Set(); let wBusy = false, wTimer = null;
  const lit = (o) => { const s = JSON.stringify(o); let t = 'hz'; while (s.includes('$' + t + '$')) t += Math.random().toString(36).slice(2, 6); return '$' + t + '$' + s + '$' + t + '$'; };
  function wtPush(path, patch, op) {
    const last = WQ[WQ.length - 1];
    if (last && last.path === path && last.op === op && path !== 'meta/audit') { if (op === 'update') merge(last.patch, clone(patch)); else last.patch = clone(patch); }
    else WQ.push({ path, patch: clone(patch), op });
    saved('جارٍ الحفظ في الرابط…');
    clearTimeout(wTimer); wTimer = setTimeout(wtFlush, 400);
  }
  async function newAudit(rows) {
    let have = new Set();
    try { const s = await db.doc('meta/audit').get(); if (s.exists) have = new Set(((s.data() || {}).rows || []).map((r) => JSON.stringify(r))); } catch (e) { /* */ }
    return rows.filter((r) => { const k = JSON.stringify(r); return !have.has(k) && !SENT.has(k); });
  }
  async function wtFlush() {
    if (wBusy || !WQ.length) return; wBusy = true;
    const batch = WQ.splice(0, WQ.length), st = [], aud = [];
    try {
      for (const w of batch) {
        const i = w.path.indexOf('/'), c = w.path.slice(0, i), id = w.path.slice(i + 1);
        if (w.path === 'meta/audit') { (await newAudit((w.patch && w.patch.rows) || [])).forEach((r) => { aud.push(r); SENT.add(JSON.stringify(r)); }); continue; }
        st.push(`insert into doc (col, id, data) values (${q(c)}, ${q(id)}, ${lit(w.patch)}::jsonb) on conflict (col, id) do update set data = ${w.op === 'set' ? 'excluded.data' : 'jsonb_deep_merge(doc.data, excluded.data)'}`);
      }
      if (aud.length) st.push(`with cur as (select coalesce((select data->'rows' from doc where col = 'meta' and id = 'audit'), '[]'::jsonb) || ${lit(aud)}::jsonb as r) insert into doc (col, id, data) select 'meta', 'audit', jsonb_build_object('rows', coalesce((select jsonb_agg(x.e order by x.i) from jsonb_array_elements(cur.r) with ordinality as x(e, i) where x.i > jsonb_array_length(cur.r) - 800), '[]'::jsonb)) from cur on conflict (col, id) do update set data = excluded.data`);
      if (st.length) await sql(st.join(';\n') + ';\nselect 1 as ok;');
      saved('حُفظ في الرابط');
      setTimeout(() => pull(false), 300);
    } catch (e) {
      aud.forEach((r) => SENT.delete(JSON.stringify(r)));
      saved('تعذر الحفظ');
      toast('لم تُحفظ نتيجة المزامنة في الرابط' + (WHY[e && e.code] ? ': ' + WHY[e.code] : '. تحقق من ربط Supabase ثم أعد لصق النتيجة.'));
      batch.forEach((w) => reload(w.path));
    } finally { wBusy = false; if (WQ.length) wtFlush(); }
  }
  const reload = (path) => {
    const [c, ...rest] = String(path).split('/'), id = rest.join('/');
    if (db && A.raw[c] && id) db.doc(path).get().then((s) => { if (s.exists) A.raw[c][id] = s.data(); else delete A.raw[c][id]; try { rebuild(); render(true); } catch (e) { /* */ } }).catch(() => {});
  };

  /* لا كتابة من الواجهة في نسخة الاطلاع (عدا مزامنة رايات أعلاه): يُعاد ما تغيّر في الذاكرة من قاعدة البيانات */
  let lastToast = 0;
  const baseEnqueue = enqueue;
  enqueue = function (path, patch, op) {
    if (!A.readOnly) return baseEnqueue.apply(this, arguments);
    if (patch && typeof patch === 'object' && Object.keys(patch).every((k) => k === 'lastLogin')) return;   // تسجيل آخر دخول: يتولاه الرابط
    if (A.wtOn() && WT_PATH.test(String(path))) return wtPush(String(path), patch, op || 'update');
    if (Date.now() - lastToast > 4000) { lastToast = Date.now(); toast('نسخة Claude للاطلاع فقط: سجّل من الرابط، وتصل التعديلات هنا تلقائياً.'); }
    reload(path);
  };

  const baseRender = render;
  render = function () {
    const r = baseRender.apply(this, arguments);
    try { paint(); } catch (e) { /* العرض أولاً */ }
    return r;
  };
  /* صاحب المنصة يدخل نسخة الاطلاع بحسابه في Claude (لا بكلمة مرور منفصلة قد تختلف عن الرابط) */
  let noAuto = false;
  const baseLogout = logout;
  logout = function () { noAuto = true; return baseLogout.apply(this, arguments); };
  async function autoOwner() {
    try {
      const cl = window.claude, u = cl && cl.use ? await cl.use('user') : null;
      if (!u || !(await u.isOwner())) return;
      M.owner = true; if (A.view === 'sync') try { render(true); } catch (e) { /* */ }
      const tryIn = () => {
        if (noAuto || A.me) return;
        const o = typeof ownerAcc === 'function' ? ownerAcc() : null;
        if (!o) { setTimeout(tryIn, 700); return; }
        if (o.active === false) return;
        enter(o, 'دخول تلقائي لصاحب المنصة بحسابه في Claude (نسخة الاطلاع)');
      };
      tryIn();
    } catch (e) { /* تبقى شاشة الدخول */ }
  }
  (async () => {
    try { const cl = window.claude; M.mcp = cl && cl.use ? await cl.use('mcp') : null; } catch (e) { M.mcp = null; }
    if (!A.readOnly) return;
    autoOwner();
    paint();
    if (!M.mcp) return;
    const go = () => { if (db && A.fresh) pull(false); else setTimeout(go, 800); };
    go();
    setInterval(probe, EVERY);
    setInterval(() => pull(false), 5 * 60000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) probe(); });
    window.addEventListener('focus', () => probe());
  })();
  window.HAADER_MIRROR = { pull, M, rowsOf };
})();
