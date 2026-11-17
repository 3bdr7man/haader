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
  const SRV = 'Supabase', PROJECT = 'urtdulwbpabslicxtsoa', EVERY = 60000;
  const COLS = ['sections', 'marks', 'notes', 'meta', 'qrs', 'warnlog', 'bosla', 'bviol', 'bcase', 'bforms', 'gsec', 'gmarks', 'gcfg', 'gsnap', 'gops'];
  const KEEP = { meta: ['qrkey', 'audit', 'mirror', 'emailblock'] };   // خاصة بنسخة Claude لا تُستبدل ولا تُحذف
  const kept = (c, id) => (KEEP[c] || []).includes(id);
  A.readOnly = !window.__HAADER_RW;
  const M = { mcp: null, state: 'init', code: '', at: null, n: 0, busy: false, tried: false };
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
        for (const r of rows) { if (r && r.col && r.id && r.data && typeof r.data === 'object') await db.doc(r.col + '/' + r.id).set(r.data); }
      }
      /* ما حُذف من الرابط يُحذف هنا (للمجموعات المحمّلة وحدها) */
      const have = new Set(list.map((r) => r.col + '/' + r.id)); let del = 0;
      for (const c of COLS) {
        const loc = A.raw[c]; if (!loc || typeof loc !== 'object') continue;
        for (const id of Object.keys(loc)) if (!kept(c, id) && !have.has(c + '/' + id)) { await db.doc(c + '/' + id).delete(); del++; }
      }
      const u = {}; list.forEach((r) => { u[r.col + '/' + r.id] = r.u; });
      const at = new Date().toISOString();
      if (changed.length || del || !((A.raw.meta || {}).mirror)) await db.doc('meta/mirror').set({ u, at, n: changed.length + del });
      M.state = 'ok'; M.code = ''; M.at = at; M.n = changed.length + del;
    } catch (e) {
      M.state = 'err'; M.code = (e && e.code) || 'upstream_error';
    } finally { M.busy = false; paint(); }
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
    else msg = `تُجلب البيانات من الرابط تلقائياً كل دقيقة${M.n ? ` • حُدّثت ${M.n} وثيقة في آخر مزامنة` : ''}.`;
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

  /* لا كتابة من الواجهة في نسخة الاطلاع: يُعاد ما تغيّر في الذاكرة من قاعدة البيانات */
  let lastToast = 0;
  const baseEnqueue = enqueue;
  enqueue = function (path) {
    if (!A.readOnly) return baseEnqueue.apply(this, arguments);
    if (Date.now() - lastToast > 4000) { lastToast = Date.now(); toast('نسخة Claude للاطلاع فقط: سجّل من الرابط، وتصل التعديلات هنا تلقائياً.'); }
    const [c, ...rest] = String(path).split('/'), id = rest.join('/');
    if (db && A.raw[c] && id) db.doc(path).get().then((s) => { if (s.exists) A.raw[c][id] = s.data(); else delete A.raw[c][id]; try { rebuild(); render(true); } catch (e) { /* */ } }).catch(() => {});
  };

  const baseRender = render;
  render = function () {
    const r = baseRender.apply(this, arguments);
    try { paint(); } catch (e) { /* العرض أولاً */ }
    return r;
  };
  (async () => {
    try { const cl = window.claude; M.mcp = cl && cl.use ? await cl.use('mcp') : null; } catch (e) { M.mcp = null; }
    if (!A.readOnly) return;
    paint();
    if (!M.mcp) return;
    const go = () => { if (db && A.fresh) pull(false); else setTimeout(go, 800); };
    go();
    setInterval(() => pull(false), EVERY);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pull(false); });
  })();
  window.HAADER_MIRROR = { pull, M, rowsOf };
})();
