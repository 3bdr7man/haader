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
    if (server !== 'Supabase' || tool !== 'execute_sql' || input.project_id !== 'urtdulwbpabslicxtsoa' || !/^\\s*select /i.test(input.query)) return Promise.reject({ code: 'bad_request' });
    const W = window.__WEB || {};
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
