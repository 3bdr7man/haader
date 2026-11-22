/* نسخة Claude للاطلاع، مرآة للرابط: تجلب من Supabase (موصل وهمي هنا) وتمنع الكتابة من الواجهة */
const L = require('./lib');
if (!process.env.HAADER_FILE) process.env.HAADER_FILE = L.ROOT + '/dist/artifact/index.html';
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };
/* موصل Supabase وهمي: يجيب عن استعلامَي المرآة من window.__WEB بصيغة execute_sql (نص بين وسمي untrusted-data) */
const MCP = `(() => {
  window.__CALLS = [];
  const wrap = (rows) => { const t = JSON.stringify({ result: 'Below is the result of the SQL query.\\n\\n<untrusted-data-abc>\\n' + JSON.stringify(rows) + '\\n</untrusted-data-abc>\\n\\nUse this data' }); return { content: [{ type: 'text', text: t }], payload: JSON.parse(t) }; };
  window.__MCP = { async callTool(server, tool, input) {
    window.__CALLS.push([server, tool, input.query.slice(0, 40)]);
    if (window.__MCPERR) return Promise.reject({ code: window.__MCPERR });
    if (server !== 'Supabase' || tool !== 'execute_sql' || input.project_id !== 'urtdulwbpabslicxtsoa') return Promise.reject({ code: 'bad_request' });
    const W = window.__WEB || {};
    if (/grades_import/.test(input.query) && /request\\.jwt\\.claims/.test(input.query)) { (window.__RPCQ = window.__RPCQ || []).push(input.query); if (window.__RPCERR) return { content: [{ type: 'text', text: JSON.stringify({ error: { name: 'HttpException', message: 'Failed to run sql query: ERROR:  P0001: الشعبة 63854 غير مسندة إليك، فلا تُستورد درجاتها.' } }) }] }; return wrap([{ r: { id: 'GI-TEST', add: 1, chg: 0, same: 0, kept: 0, bad: [], changes: [], s: {} } }]); }
    if (/^\\s*(insert|with) /i.test(input.query)) {   /* كتابة مزامنة رايات: تُطبَّق على الرابط الوهمي */
      if (window.__WERR) return Promise.reject({ code: window.__WERR });
      (window.__SQLW = window.__SQLW || []).push(input.query);
      const dm = (a, b) => { if (!a || typeof a !== 'object' || !b || typeof b !== 'object' || Array.isArray(b)) return b; const o = Object.assign({}, a); for (const k in b) o[k] = k in a ? dm(a[k], b[k]) : b[k]; return o; };
      const stamp = '2026-11-18 0' + (++window.__WN || (window.__WN = 1)) + ':00:00+00';
      for (const m of input.query.matchAll(/values \\('([^']+)', '([^']+)', \\$(\\w+)\\$([\\s\\S]*?)\\$\\3\\$::jsonb\\) on conflict \\(col, id\\) do update set data = (excluded\\.data|jsonb_deep_merge)/g)) {
        const k = m[1] + '/' + m[2], v = JSON.parse(m[4]), cur = W[k] ? W[k].data : null;
        W[k] = { u: stamp, data: m[5] === 'excluded.data' ? v : dm(cur || {}, v) };
      }
      const au = /'\\[\\]'::jsonb\\) \\|\\| \\$(\\w+)\\$([\\s\\S]*?)\\$\\1\\$::jsonb/.exec(input.query);
      if (au) window.__AUD = (window.__AUD || []).concat(JSON.parse(au[2]));
      return wrap([{ ok: 1 }]);
    }
    if (!/^\\s*select /i.test(input.query)) return Promise.reject({ code: 'bad_request' });
    if (/count\\(\\*\\)/.test(input.query)) { const ks = Object.keys(W); return wrap([{ n: window.__EMPTY ? 0 : ks.length, m: window.__EMPTY ? '' : ks.reduce((x, k) => (W[k].u > x ? W[k].u : x), '') }]); }
    if (/updated_at/.test(input.query)) return wrap(window.__EMPTY ? [] : Object.keys(W).map((k) => ({ col: k.split('/')[0], id: k.split('/').slice(1).join('/'), u: W[k].u })));
    const pairs = [...input.query.matchAll(/\\('([^']+)','([^']+)'\\)/g)].map((m) => m[1] + '/' + m[2]);
    return wrap(pairs.filter((k) => W[k]).map((k) => ({ col: k.split('/')[0], id: k.split('/').slice(1).join('/'), data: W[k].data })));
  } };
})();`;
(async () => {
  const b = await L.launch();
  const docs = L.seed();
  docs['qrs/OLD1'] = { crn: '63854', d: '01/01/1448', status: 'open' };
  docs['meta/qrkey'] = { k: 'local-secret' };
  const web = {};
  Object.keys(docs).filter((k) => /^(sections|marks|notes|meta|qrs|warnlog|gsec|gmarks|gcfg|accounts)\//.test(k) && k !== 'qrs/OLD1' && k !== 'meta/qrkey').forEach((k) => { web[k] = { u: '2026-11-17 06:00:00+00', data: JSON.parse(JSON.stringify(docs[k])) }; });
  const crn = '63854', tid = docs['sections/63854'].rows[0].id;
  docs['marks/63854'].m[tid] = { d14480606: 'ح' }; web['marks/63854'].data.m[tid] = { d14480606: 'ح' };
  web['marks/' + crn].data.m[tid].d14480607 = 'غ'; web['marks/' + crn].u = '2026-11-17 07:00:00+00';
  docs['accounts/ut1'].salt = 'aa'; docs['accounts/ut1'].hash = 'localhash';
  web['accounts/ut1'] = { u: '2026-11-17 07:00:00+00', data: Object.assign({}, docs['accounts/ut1'], { name: 'م. مدرب أول (من الرابط)', salt: 'websalt', hash: undefined, lastLogin: '2026-11-17T08:00:00Z' }) };
  delete web['accounts/ut1'].data.hash;
  web['qrs/NEW1'] = { u: '2026-11-17 07:00:00+00', data: { crn, d: '07/06/1448', status: 'open', ins: {} } };
  const init = `window.__WEB = ${JSON.stringify(web)};` + MCP;
  const p = await L.open(b, 'admin', docs, { ro: true, mcp: init });
  await p.waitForFunction(() => A.raw.meta && A.raw.meta.mirror, null, { timeout: 15000 }).catch(async (e) => { console.log('DBG', await p.evaluate(() => JSON.stringify(HAADER_MIRROR.M)), p.errs); throw e; }); await p.waitForTimeout(400);
  let d = await L.dbDocs(p);
  ok(d['marks/' + crn].m[tid].d14480607 === 'غ' && d['qrs/NEW1'] && !d['qrs/OLD1'], 'المرآة تجلب ما تغيّر في الرابط وتحذف ما حُذف منه', [d['marks/' + crn].m[tid].d14480607, !!d['qrs/NEW1'], !!d['qrs/OLD1']]);
  ok(d['meta/qrkey'] && d['meta/qrkey'].k === 'local-secret' && d['accounts/uhead'] && d['accounts/uview'], 'لا تمس مفتاح QR المحلي، ولا تحذف حساباً غير موجود في الرابط');
  ok(d['accounts/ut1'].name === 'م. مدرب أول (من الرابط)' && d['accounts/ut1'].lastLogin === '2026-11-17T08:00:00Z' && d['accounts/ut1'].salt === 'aa' && d['accounts/ut1'].hash === 'localhash', 'بيانات الحساب من الرابط، دون بصمات كلمة المرور', d['accounts/ut1']);
  ok(await p.evaluate((x) => A.raw.marks[x[0]].m[x[1]].d14480607 === 'غ', [crn, tid]), 'وتظهر في الواجهة مباشرة');
  ok(await p.evaluate(() => window.__CALLS.every((c) => c[0] === 'Supabase' && c[1] === 'execute_sql' && /^select/i.test(c[2].trim()))), 'استعلامات قراءة SELECT فقط', await p.evaluate(() => window.__CALLS));
  const bar = await p.evaluate(() => { const e = document.getElementById('mirBar'); return e ? e.innerText : ''; });
  ok(/نسخة Claude للاطلاع فقط/.test(bar) && /3bdr7man\.github\.io\/haader/.test(bar) && /آخر مزامنة/.test(bar) && /مزامنة الآن/.test(bar), 'شريط المرآة: للاطلاع، والرابط، وآخر مزامنة، وزر المزامنة', bar);
  ok(await p.evaluate((c) => !mayEdit(c) && document.body.classList.contains('ro') && !isViewer() && isAdmin(), crn), 'لا تعديل في الكشوف، والمسؤول يبقى مسؤولاً (يرى الدرجات والإعدادات)');
  /* محاولة كتابة من الواجهة */
  const before = await p.evaluate(() => window.__W.length);
  await p.evaluate((x) => { A.raw.marks[x[0]].m[x[1]].d14480607 = 'ح'; enqueue('marks/' + x[0], { m: { [x[1]]: { d14480607: 'ح' } } }); }, [crn, tid]);
  await p.waitForTimeout(600);
  ok(await p.evaluate((n) => window.__W.length === n, before) && /للاطلاع فقط/.test(await L.toast(p)) && await p.evaluate((x) => A.raw.marks[x[0]].m[x[1]].d14480607 === 'غ', [crn, tid]), 'الكتابة من الواجهة تُمنع برسالة، ويعود المعروض إلى المحفوظ', await L.toast(p));
  /* مزامنة بلا تغيير، ثم تغيير وزر «مزامنة الآن» */
  let w0 = await p.evaluate(() => window.__W.length);
  await p.evaluate(() => HAADER_MIRROR.pull(true)); await p.waitForTimeout(300);
  ok(await p.evaluate((n) => window.__W.length === n, w0), 'مزامنة بلا تغيير لا تكتب شيئاً');
  await p.evaluate((x) => { window.__WEB['notes/' + x].data = { n: { t: { d: 'ملاحظة من الرابط' } } }; window.__WEB['notes/' + x].u = '2026-11-17 08:00:00+00'; }, crn).catch(async () => { await p.evaluate((x) => { window.__WEB['notes/' + x] = { u: '2026-11-17 08:00:00+00', data: { n: { t: { d: 'ملاحظة من الرابط' } } } }; }, crn); });
  await p.waitForFunction((x) => A.raw.notes[x] && A.raw.notes[x].n && A.raw.notes[x].n.t, crn, { timeout: 14000 });
  d = await L.dbDocs(p);
  ok(d['notes/' + crn] && d['notes/' + crn].n.t.d === 'ملاحظة من الرابط', 'التعديل في الرابط يصل تلقائياً خلال ثوانٍ (فحص كل 10 ثوانٍ)');
  await p.evaluate((x) => { window.__WEB['marks/' + x[0]].data.m[x[1]].d14480608 = 'م5'; window.__WEB['marks/' + x[0]].u = '2026-11-17 09:00:00+00'; }, [crn, tid]);
  await p.click('#mirBar [data-mir="pull"]'); await p.waitForTimeout(600);
  ok(await p.evaluate((x) => A.raw.marks[x[0]].m[x[1]].d14480608 === 'م5', [crn, tid]), 'وزر «مزامنة الآن» يجلب فوراً');
  /* رد فارغ أو مريب: لا حذف */
  await p.evaluate(() => { window.__EMPTY = true; }); await p.evaluate(() => HAADER_MIRROR.pull(true)); await p.waitForTimeout(300);
  d = await L.dbDocs(p);
  ok(Object.keys(d).filter((k) => k.startsWith('sections/')).length > 0 && d['marks/' + crn], 'رد فارغ لا يحذف شيئاً من نسخة Claude');
  const lastLoginToast = await p.evaluate(() => { const t0 = document.getElementById('toast').textContent; enqueue('accounts/uadmin', { lastLogin: 'x' }); return [t0, document.getElementById('toast').textContent]; });
  ok(lastLoginToast[0] === lastLoginToast[1], 'تسجيل آخر دخول لا يُظهر رسالة «للاطلاع فقط»');
  await p.evaluate(() => { window.__EMPTY = false; window.__MCPERR = 'needs_reauth'; }); await p.evaluate(() => HAADER_MIRROR.pull(true)); await p.waitForTimeout(300);
  ok(/أعد ربطه/.test(await p.evaluate(() => document.getElementById('mirBar').innerText)) && await p.evaluate(() => document.getElementById('mirBar').classList.contains('warn')), 'انتهاء ربط Supabase: رسالة إعادة الربط');
  /* صاحب المنصة يدخل بحسابه في Claude دون كلمة مرور منفصلة */
  const po = await L.open(b, 'admin', docs, { ro: true, mcp: init + 'window.__USERCAP = { isOwner: async () => true, id: async () => "cu_uadmin" };', noSession: true });
  ok(await po.evaluate(() => A.me && A.me.id === 'uadmin' && document.getElementById('gate').hidden), 'صاحب المنصة يدخل نسخة الاطلاع بحسابه في Claude تلقائياً');
  await po.evaluate(() => logout()); await po.waitForTimeout(1500);
  ok(await po.evaluate(() => !A.me), 'وبعد الخروج لا يُعاد الدخول تلقائياً');
  /* مزامنة رايات من نسخة Claude: صاحب المنصة وحده، وفي صفحة «مزامنة رايات» وحدها، تُكتب في الرابط */
  const docs2 = JSON.parse(JSON.stringify(docs)); docs2['sections/' + crn].trainer = 'uadmin';   // شعب صاحب المنصة كما في الواقع
  const web2 = JSON.parse(JSON.stringify(web)); web2['sections/' + crn].data.trainer = 'uadmin';
  const init2 = `window.__WEB = ${JSON.stringify(web2)};` + MCP;
  const po2 = await L.open(b, 'admin', docs2, { ro: true, mcp: init2 + 'window.__USERCAP = { isOwner: async () => true, id: async () => "cu_uadmin" };' });
  await po2.waitForFunction(() => A.raw.meta && A.raw.meta.mirror && HAADER_MIRROR.M.owner, null, { timeout: 15000 });
  ok(await po2.evaluate((c) => !mayEdit(c), crn), 'خارج «مزامنة رايات» تبقى النسخة للاطلاع');
  await po2.evaluate(() => { A.view = 'sync'; render(true); }); await po2.waitForTimeout(300);
  const sv = await po2.evaluate((c) => { const sec = A.m.secBy[c]; A.sync.sel = new Set([c + '_' + H.dk(sec.dates[0])]); render(true); return { me: mayEdit(c), n: buildPackage().items.length, bar: (document.getElementById('mirBar') || {}).innerText || '', copy: !document.querySelector('[data-act="sync-copy"]').disabled }; }, crn);
  ok(sv.me && sv.n > 0 && sv.copy && /مزامنة رايات تعمل من هنا/.test(sv.bar), 'في «مزامنة رايات»: الحزمة تُبنى وزر النسخ يعمل، والشريط يوضح الحفظ في الرابط', sv);
  const res = await po2.evaluate((x) => { const sec = A.m.secBy[x[0]], d = sec.dates[0], code = H.code(A.m, x[0], x[1], d); return { app: 'haader-result', v: 1, at: '2026-11-18T07:30:00.000Z', items: [{ crn: x[0], dk: H.dk(d), status: 'ok', s: { [x[1]]: code === 'غ' ? 'p' : 'a' }, x: {} }] }; }, [crn, tid]);
  await po2.evaluate((t) => { const e = document.getElementById('resT'); e.value = t; e.dispatchEvent(new Event('change', { bubbles: true })); }, JSON.stringify(res));
  await po2.waitForFunction(() => window.__WEB['meta/rayat'] && (window.__WEB['meta/rayat'].data.diffs || []).length, null, { timeout: 8000 }).catch(() => {});
  let wr = await po2.evaluate(() => ({ w: window.__WEB['meta/rayat'] && window.__WEB['meta/rayat'].data, sql: (window.__SQLW || []).length, loc: window.__W.length, toast: document.getElementById('toast').textContent }));
  ok(wr.w && wr.w.diffs.length === 1 && wr.w.lastAt === '2026-11-18T07:30:00.000Z' && wr.sql >= 1 && !/للاطلاع فقط/.test(wr.toast), 'لصق نتيجة الجسر يُحفظ في الرابط (حالة المحاضرات والفروقات)', wr);
  await po2.waitForFunction(() => (((A.raw.meta.rayat || {}).diffs) || []).length === 1 && document.querySelector('[data-act="diff-take"]'), null, { timeout: 8000 }).catch(() => {});
  ok(await po2.evaluate(() => !!document.querySelector('[data-act="diff-take"]')), 'وتعود الفروقات إلى نسخة Claude بالمرآة وتظهر للاعتماد');
  await po2.click('[data-act="diff-take"]');
  await po2.waitForFunction((x) => (window.__AUD || []).some((r) => r[1] === x[0] && r[2] === x[1] && r[7] === 'رايات'), [crn, tid], { timeout: 8000 }).catch(() => {});
  wr = await po2.evaluate((x) => ({ code: (((window.__WEB['marks/' + x[0]] || {}).data || {}).m || {})[x[1]], diffs: (window.__WEB['meta/rayat'].data.diffs || []).length, aud: (window.__AUD || []).filter((r) => r[7] === 'رايات').length }), [crn, tid]);
  ok(wr.diffs === 0 && wr.aud === 1 && Object.values(wr.code || {}).includes(res.items[0].s[tid] === 'a' ? 'غ' : 'ح'), '«اعتماد رايات» يكتب الرمز في كشف الرابط ويُلحق سطر السجل (بلا تكرار)', wr);
  ok(await po2.evaluate(() => window.__CALLS.filter((c) => /^\s*(insert|with)/i.test(c[2])).length >= 2 && (window.__SQLW || []).every((q) => !/delete|drop|update doc set|accounts|tacc/i.test(q.replace(/do update set data/g, '')))), 'الكتابة محصورة في الكشوف ونتيجة رايات وسجلها، دون حذف ولا حسابات');
  /* فشل الحفظ: لا رسالة نجاح، ويعود المعروض إلى المحفوظ */
  await po2.evaluate(() => { window.__WERR = 'tool_error'; });
  const before2 = await po2.evaluate(() => JSON.stringify(A.raw.meta.rayat));
  await po2.evaluate((t) => takeResult(t), JSON.stringify(Object.assign({}, res, { at: '2026-11-18T08:00:00.000Z' })));
  await po2.waitForTimeout(1500);
  wr = await po2.evaluate(() => ({ t: document.getElementById('toast').textContent, s: document.getElementById('saved').textContent, at: (A.raw.meta.rayat || {}).lastAt }));
  ok(/لم تُحفظ نتيجة المزامنة في الرابط/.test(wr.t) && /تعذر/.test(wr.s) && wr.at !== '2026-11-18T08:00:00.000Z', 'فشل الحفظ في الرابط: رسالة واضحة، ولا يبقى المعروض على غير المحفوظ', wr);
  /* استيراد الدرجات من نسخة Claude: بدالة الخادم نفسها وبحساب صاحب المنصة */
  await po2.evaluate(() => { window.__WERR = null; A.view = 'home'; render(true); });
  const rp = await po2.evaluate(async () => { const r = await HAADER_MIRROR.rpc('grades_import', { p_crn: '63854', p_rows: [{ id: 'x', k: 'LEC2', v: 18 }], p_items: {}, p_overwrite: false, p_file: 'f.xlsx', p_wb: {} }); return { on: A.rpcOn(), r, q: (window.__RPCQ || []).slice(-1)[0] || '' }; });
  ok(rp.on && rp.r && rp.r.id === 'GI-TEST' && /legacy_id = 'uadmin'/.test(rp.q) && /grades_import\(a->>'p_crn'/.test(rp.q) && /"LEC2"/.test(rp.q), 'استيراد الدرجات من نسخة Claude: دالة الخادم بحساب صاحب المنصة', [rp.on, rp.r, rp.q.slice(0, 200)]);
  const rerr = await po2.evaluate(async () => { window.__RPCERR = true; try { await HAADER_MIRROR.rpc('grades_import', { p_crn: '63854', p_rows: [] }); return 'no-error'; } catch (e) { return e.message; } finally { window.__RPCERR = false; } });
  ok(/غير مسندة إليك/.test(rerr), 'ورفض الخادم يظهر برسالته، دون نجاح وهمي', rerr);
  /* غير صاحب المنصة: لا كتابة حتى في «مزامنة رايات» */
  const pn = await L.open(b, 'admin', docs2, { ro: true, mcp: init2 });
  await pn.waitForTimeout(800);
  ok(await pn.evaluate((c) => { A.view = 'sync'; render(true); return !mayEdit(c) && !A.wtOn() && !A.rpcOn(); }, crn), 'من لا يملك المنصة: «مزامنة رايات» واستيراد الدرجات للاطلاع فقط');
  /* بلا موصل */
  const p2 = await L.open(b, 'admin', L.seed(), { ro: true });
  await p2.waitForTimeout(800);
  const b2 = await p2.evaluate(() => { const e = document.getElementById('mirBar'); return e ? { t: e.innerText, btn: !!e.querySelector('[data-mir]') } : null; });
  ok(b2 && /المرتبط بـ Supabase/.test(b2.t) && !b2.btn, 'بلا موصل: للاطلاع على آخر ما جُلب، دون زر', b2);
  /* الجوال */
  const p3 = await L.open(b, 'admin', docs, { ro: true, mcp: init, w: 390, h: 800 });
  await p3.waitForTimeout(1200);
  ok(await p3.evaluate(() => !!document.getElementById('mirBar') && document.documentElement.scrollWidth - document.documentElement.clientWidth <= 1), 'الجوال: الشريط ظاهر بلا تمرير أفقي');
  ok(![p, p2, p3, po].some((x) => x.errs.length), 'لا أخطاء JavaScript', [p, p2, p3, po].flatMap((x) => x.errs).slice(0, 4));
  await p3.screenshot({ path: __dirname + '/out/mirror-phone.png' });
  await b.close();
  console.log(`\n══ نسخة Claude للاطلاع (مرآة الرابط): ${pass} ناجح، ${fail} فاشل ══`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
