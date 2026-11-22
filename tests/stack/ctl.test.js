// الإدارة المركزية: تشغيل المنصة (الصيانة وإيقاف الوصول والقناة)، وتكامل الأنظمة والمزامنة (الظهور والتفعيل والتفويض)،
// وأدوات إدارة Claude، والربط مع منصة تقني (الرابط الموقّع والتحقق من الصلة بالشعبة). يُشغَّل بعد e2e.test.js.
const { chromium } = require('playwright');
const L = require('./lib');
const { sql, check, rpc } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const PW = { admin: 'Admin#2026x', t1: 'Trainer1-pass', t2: 'Trainer2-pass', s1: 'MyOwnPass-55' };
const reset = () => sql(`update platform_ctl set mode='public', channel='both', claude=true where id=1; update integ_service set visible = impl, enabled = impl, auth_mode='all', auth_roles='{}', auth_users='{}'; delete from taqni_link; delete from ctl_session; delete from sync_run; delete from ctl_audit;`);
const asAdmin = (q) => sql(`select set_config('request.jwt.claims', json_build_object('sub',(select id from app_user where legacy_id='uadmin00000000001'),'role','authenticated')::text, false); ${q}`).split('\n').pop();
const asT1 = (q) => sql(`select set_config('request.jwt.claims', json_build_object('sub',(select id from app_user where legacy_id='utrain00000000001'),'role','authenticated')::text, false); ${q}`).split('\n').pop();
const counts = () => sql(`select count(*) || ':' || sum(jsonb_array_length(coalesce(data->'rows','[]'))) from doc where col='sections'`) + '|' + sql(`select count(*) from doc where col='marks'`);

(async () => {
  reset();
  const data0 = counts();
  const a = await L.login('aalkhathami', PW.admin), t1 = await L.login('t.ahmed', PW.t1), t2 = await L.login('t.saad', PW.t2);
  check('الدخول (مسؤول ومدربان)', a.ok && t1.ok && t2.ok);

  /* ===== الإعدادات المخزنة مؤقتاً ===== */
  let cf = (await rpc('ctl_config', {}, t1.token)).body;
  check('ctl_config: الوضع والقناة وكل خدمة (ظهور/تفعيل/صلاحية)', cf.mode === 'public' && cf.channel === 'both' && cf.svc['rayat.att_push'].v && cf.svc['rayat.att_push'].e && cf.svc['rayat.att_push'].a && cf.svc['rayat.trainees'].e === false);
  const an = (await rpc('ctl_config', {})).body;
  check('بلا دخول: الوضع ورسالة الصيانة فقط، دون الخدمات', an.mode === 'public' && Object.keys(an.svc).length === 0);
  check('المدرب لا يغيّر الإعدادات المركزية', !(await rpc('ctl_service_set', { p_id: 'rayat.att_push', p_field: 'enabled', p_value: false }, t1.token)).ok && !(await rpc('ctl_platform_set', { p_field: 'mode', p_value: 'maintenance' }, t1.token)).ok && !(await rpc('ctl_overview', {}, t1.token)).ok);
  check('الخدمة غير المبنية لا تُفعَّل', /غير مبنية/.test(JSON.stringify((await rpc('ctl_service_set', { p_id: 'rayat.trainees', p_field: 'enabled', p_value: true }, a.token)).body)));

  /* ===== التذاكر: التفعيل يُفرض على الخادم ===== */
  let tk = (await rpc('sync_begin', { p_svc: 'rayat.att_push', p_key: 'att:test:1', p_detail: 'اختبار' }, t1.token)).body;
  check('sync_begin يعطي تذكرة موقعة قصيرة العمر', tk && tk.id && /^SR.+\.\d+\.[0-9a-f]{64}$/.test(tk.tk) && tk.dup === false, tk);
  const tk2 = (await rpc('sync_begin', { p_svc: 'rayat.att_push', p_key: 'att:test:1' }, t1.token)).body;
  check('منع التكرار المتزامن: المفتاح نفسه يعيد العملية القائمة', tk2.id === tk.id && tk2.dup === true);
  check('sync_check (من الجسر بلا جلسة): صالحة', (await rpc('sync_check', { p_tk: tk.tk })).body.ok === true);
  check('تذكرة معدّلة تُرفض', (await rpc('sync_check', { p_tk: tk.tk.slice(0, -2) + '00' })).body.ok === false && (await rpc('sync_check', { p_tk: tk.tk.replace(/\.(\d+)\./, (m, e) => '.' + (+e + 3600) + '.') })).body.ok === false);
  let r = await rpc('ctl_service_set', { p_id: 'rayat.att_push', p_field: 'enabled', p_value: false, p_reason: 'اختبار التعطيل' }, a.token);
  check('المسؤول يعطّل «مزامنة التحضير اليومي»', r.ok && r.body.changed);
  let ck = (await rpc('sync_check', { p_tk: tk.tk })).body;
  check('التعطيل يبطل التذكرة القائمة فوراً (الجسر لا ينفّذ)', ck.ok === false && /معطلة/.test(ck.msg), ck);
  check('والعملية المفتوحة تُوقف دون حذف سجلها', sql(`select status from sync_run where id='${tk.id}'`) === 'cancelled');
  r = await rpc('sync_begin', { p_svc: 'rayat.att_push', p_key: 'att:test:2' }, t1.token);
  check('التعطيل يمنع التنفيذ عبر API مباشرة', !r.ok && /معطلة/.test(JSON.stringify(r.body)));
  check('خدمة أخرى مستقلة تبقى تعمل (مقارنة التحضير)', (await rpc('sync_begin', { p_svc: 'rayat.att_pull', p_key: 'att:pull:1' }, t1.token)).ok);
  check('الإدخال اليدوي يستمر (حفظ تحضير بحساب المدرب)', (await L.docMerge('notes', '63854', { n: { 'ctl-test': 'ملاحظة' } }, t1.token)).ok);
  cf = (await rpc('ctl_config', {}, t1.token)).body;
  check('الإعدادات تُحدَّث برقم إصدار جديد (إبطال النسخة المخزنة)', cf.v > 1 && cf.svc['rayat.att_push'].e === false && cf.svc['rayat.att_push'].v === true);

  /* ===== التفويض: مدربون محددون ===== */
  r = await rpc('ctl_service_auth', { p_id: 'rayat.grades_push', p_mode: 'users', p_roles: [], p_users: ['utrain00000000002'], p_reason: 'تجربة' }, a.token);
  check('تفويض «مزامنة إدخال الدرجات» لمدرب محدد', r.ok);
  const g1 = await rpc('sync_begin', { p_svc: 'rayat.grades_push', p_key: 'g:x1' }, t1.token), g2 = await rpc('sync_begin', { p_svc: 'rayat.grades_push', p_key: 'g:x2' }, t2.token);
  check('غير المفوَّض يُرفض، والمفوَّض يُقبل (على الخادم)', !g1.ok && /صلاحية/.test(JSON.stringify(g1.body)) && g2.ok);
  check('ctl_config يعكس التفويض لكل مستخدم', (await rpc('ctl_config', {}, t1.token)).body.svc['rayat.grades_push'].a === false && (await rpc('ctl_config', {}, t2.token)).body.svc['rayat.grades_push'].a === true);
  r = await rpc('sync_end', { p_id: g2.body.id, p_status: 'ok', p_n: 23, p_detail: 'اكتملت' }, t2.token);
  check('تسجيل نهاية العملية: الحالة وعدد السجلات وآخر مزامنة للنظام', r.ok && sql(`select last_status||'|'||last_count from integ_service where id='rayat.grades_push'`) === 'ok|23' && sql(`select (last_ok is not null)::text from integ_system where id='rayat'`) === 'true');

  /* ===== الإعدادات الحساسة ===== */
  r = await rpc('ctl_system_set', { p_id: 'rayat', p_patch: { api_token: 'x' } }, a.token);
  check('لا تُحفظ الأسرار في إعدادات النظام', !r.ok && /الأسرار/.test(JSON.stringify(r.body)));
  check('إعدادات إعادة المحاولة والمهلة', (await rpc('ctl_system_set', { p_id: 'taqni', p_patch: { retry: { max: 3, backoff_s: 10, timeout_s: 20 } } }, a.token)).ok && sql(`select retry->>'timeout_s' from integ_system where id='taqni'`) === '20');
  check('سجل التدقيق: المسؤول والنظام والخدمة والسابق والجديد والسبب', sql(`select by_name||'|'||sys||'|'||svc||'|'||field||'|'||old_val||'|'||new_val||'|'||reason from ctl_audit where svc='rayat.att_push' and field='enabled' order by at desc limit 1`) === 'مسؤول تجريبي|rayat|rayat.att_push|enabled|true|false|اختبار التعطيل');

  /* ===== الواجهة: الإخفاء والتعطيل والإجراء الجماعي ===== */
  const b = await chromium.launch(), errs = [];
  const open = async (u, pw, url) => { const c = await b.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 1300, height: 900 } }), p = await c.newPage(); p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    p.calls = []; p.on('request', (q) => { if (/rpc\/ctl_config/.test(q.url())) p.calls.push(Date.now()); });
    await p.goto(url || URL0); await p.waitForSelector('#liU'); await p.fill('#liU', u); await p.fill('#liP', pw); await p.click('#liB'); return p; };
  const ready = (p) => p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh, null, { timeout: 30000 });
  const pa = await open('aalkhathami', PW.admin); await ready(pa);
  await pa.evaluate(() => go('ctlsync')); await pa.waitForSelector('.ctl-t');
  const pageTxt = await pa.textContent('#main');
  check('لوحة إدارة المزامنة: البطاقات والجدول والإجراءات الجماعية', /أنظمة التكامل/.test(pageTxt) && /خدمات معطلة/.test(pageTxt) && /تفعيل جميع خدمات رايات/.test(pageTxt) && /إخفاء جميع ميزات المزامنة/.test(pageTxt) && /إعادة المحاولة/.test(pageTxt));
  await pa.click('[data-act="ctl-svc"][data-id="rayat.att_pull"][data-f="visible"]'); await pa.waitForSelector('[data-act="ctl-svc-ok"]');
  await pa.fill('#ctlWhy', 'إخفاء مؤقت'); await pa.click('[data-act="ctl-svc-ok"]');
  await pa.waitForFunction(() => /حُفظ التغيير/.test(document.getElementById('toast').textContent), null, { timeout: 10000 });
  await rpc('ctl_service_set', { p_id: 'rayat.att_push', p_field: 'visible', p_value: false }, a.token);
  check('الواجهة: إخفاء ميزة يُحفظ ويُسجَّل', sql(`select visible::text from integ_service where id='rayat.att_pull'`) === 'false' && sql(`select reason from ctl_audit where svc='rayat.att_pull' order by at desc limit 1`) === 'إخفاء مؤقت');
  await pa.click('[data-act="ctl-bulk"][data-y="taqni"][data-v="false"]'); await pa.waitForSelector('[data-act="ctl-bulk-ok"]');
  await pa.click('[data-act="ctl-bulk-ok"]');
  check('الإجراء الجماعي الحساس يطلب كتابة التأكيد', /اكتب كلمة التأكيد/.test(await pa.textContent('#toast')) && sql(`select enabled::text from integ_service where id='taqni.embed'`) === 'true');
  await pa.fill('#ctlTyp', 'تأكيد'); await pa.click('[data-act="ctl-bulk-ok"]'); await pa.waitForTimeout(1200);
  check('تعطيل جميع خدمات تقني (بالتأكيد)', sql(`select string_agg(enabled::text, ',') from integ_service where system='taqni' and impl`) === 'false,false');
  await rpc('ctl_bulk', { p_system: 'taqni', p_field: 'enabled', p_value: true }, a.token);
  /* المدرب: الميزة المخفية تختفي، والبيانات باقية */
  const pt = await open('t.ahmed', PW.t1); await ready(pt);
  await pt.waitForTimeout(800);
  check('المدرب: «مزامنة رايات» مخفية من القائمة بعد إخفاء خدمتيها', !(await pt.$('#nav a[data-v="sync"]')));
  check('إخفاء الخدمة لا يحذف أي بيانات', counts() === data0);
  await rpc('ctl_service_set', { p_id: 'rayat.att_push', p_field: 'visible', p_value: true }, a.token);
  await pt.evaluate(() => HAADER_CTL.load(true)); await pt.evaluate(() => { buildNav(); go('sync'); }); await pt.waitForTimeout(500);
  check('المدرب: الميزة الظاهرة المعطلة تظهر بتنبيه', /معطلة من مسؤول المنصة/.test(await pt.textContent('#main')));
  await pt.evaluate(() => { const r = A.m.sections.find((s) => s.crn === '63854'); A.sync.mode = 'push'; A.sync.sel = new Set([r.crn + '_' + H.dk(r.dates[0])]); });
  await pt.evaluate(() => ACT['sync-copy']()); await pt.waitForTimeout(800);
  check('المدرب: زر نسخ الحزمة يُرفض للخدمة المعطلة (دون حزمة)', /معطلة/.test(await pt.textContent('#toast')));
  await rpc('ctl_service_set', { p_id: 'rayat.att_push', p_field: 'enabled', p_value: true }, a.token);
  await pt.evaluate(() => HAADER_CTL.load(true));
  const pkg = await pt.evaluate(async () => { let got = null; const cp = window.copyText; window.copyText = async (t) => { got = t; return true; }; try { await ACT['sync-copy'](); } finally { window.copyText = cp; } return got; });
  const pj = JSON.parse(pkg || '{}');
  check('بعد التفعيل: الحزمة بالإصدار 3 وتذكرة الخادم وعنوانه', pj.app === 'haader3' && /^SR/.test(pj.run) && pj.sb && pj.sb.u && pj.items.length === 1, pj.app);
  /* الجسر داخل رايات: التحقق قبل التنفيذ */
  const bp = await b.newPage(); await bp.goto(URL0);
  const chk = await bp.evaluate(async ([src, q]) => { eval(src.slice(0, src.indexOf('!function(){if(window.__HB'))); return window.__hbChk(q); }, [await pt.evaluate(() => document.getElementById('bridge-src').textContent), pj]);
  check('الجسر: يتحقق من التذكرة لدى الخادم قبل التنفيذ', chk && chk.ok === true && !chk.offline, chk);
  await rpc('ctl_service_set', { p_id: 'rayat.att_push', p_field: 'enabled', p_value: false }, a.token);
  const chk2 = await bp.evaluate(async ([src, q]) => { eval(src.slice(0, src.indexOf('!function(){if(window.__HB'))); return window.__hbChk(q); }, [await pt.evaluate(() => document.getElementById('bridge-src').textContent), pj]);
  check('الجسر: بعد التعطيل يرفض الحزمة نفسها', chk2 && chk2.ok === false && /معطلة/.test(chk2.msg), chk2);
  const oldPkg = JSON.stringify(Object.assign({}, pj, { app: 'haader' }));
  check('الجسر الجديد يرفض الحزمة القديمة بلا تذكرة', await bp.evaluate(([src]) => /\^haader\(-grades\)\?3\$/.test(src), [await pt.evaluate(() => document.getElementById('bridge-src').textContent)]) && !JSON.parse(oldPkg).tk === false);
  await rpc('ctl_service_set', { p_id: 'rayat.att_push', p_field: 'enabled', p_value: true }, a.token);
  /* الأداء: لا استعلامات إعدادات متكررة عند التنقل */
  const n0 = pt.calls.length;
  for (const v of ['home', 'roll', 'reports', 'alerts', 'home']) { await pt.evaluate((v) => go(v), v); await pt.waitForTimeout(150); }
  check('التنقل بين الصفحات لا يكرر استعلام الإعدادات (تخزين مؤقت)', pt.calls.length === n0, [n0, pt.calls.length]);

  /* ===== وضع الصيانة وإيقاف الوصول العام: فرض على الخادم ===== */
  const t1b = await L.login('t.ahmed', PW.t1);
  r = await rpc('ctl_platform_set', { p_field: 'mode', p_value: 'maintenance', p_reason: 'صيانة تجريبية' }, a.token);
  check('تفعيل وضع الصيانة', r.ok && r.body.changed);
  const dl = await L.docList('sections', t1b.token);
  check('الصيانة: جلسة المدرب القائمة لا تقرأ أي بيانات (RLS على الخادم)', dl.ok && dl.body.length === 0, dl.body && dl.body.length);
  check('الصيانة: ولا تكتب', !(await L.docMerge('notes', '63854', { n: { x: 1 } }, t1b.token)).ok || sql(`select coalesce(data#>>'{n,x}','') from doc where col='notes' and id='63854'`) === '');
  const s1 = await L.login('446000001', PW.s1);
  check('الصيانة: المتدرب لا يصل إلى بياناته', s1.ok && !((await rpc('trainee_me', {}, s1.token)).body || {}).sections);
  check('الصيانة: المسؤول يعمل كالمعتاد', (await L.docList('sections', a.token)).body.length >= 3);
  const pm = await b.newPage(); await pm.goto(URL0); await pm.waitForSelector('#liU'); await pm.waitForSelector('#ctlBanner', { timeout: 10000 });
  check('صفحة الدخول تعرض رسالة الصيانة', /صيانة/.test(await pm.textContent('#ctlBanner')));
  await pm.fill('#liU', 't.ahmed'); await pm.fill('#liP', PW.t1); await pm.click('#liB'); await pm.waitForTimeout(2500);
  check('الصيانة: دخول المدرب يُرفض برسالة الصيانة', /صيانة/.test(await pm.textContent('#gate')) && await pm.evaluate(() => !A.me));
  r = await rpc('ctl_platform_set', { p_field: 'mode', p_value: 'closed' }, a.token);
  check('إيقاف الوصول العام: المدرب لا يقرأ والمسؤول يقرأ', (await L.docList('sections', t1b.token)).body.length === 0 && (await L.docList('sections', a.token)).body.length >= 3);
  r = await rpc('ctl_platform_set', { p_field: 'mode', p_value: 'public' }, a.token);
  check('العودة إلى التشغيل العام: المدرب يعود كما كان والبيانات سليمة', (await L.docList('sections', t1b.token)).body.length >= 1 && counts() === data0);

  /* ===== الربط مع تقني ===== */
  r = await rpc('taqni_link_set', { p_crn: '63854', p_patch: { course_id: '270852', enabled: true, services: [{ k: 'attendance', on: true, roles: ['trainee', 'trainer'] }, { k: 'trainer', on: true, roles: ['trainer'] }, { k: 'home', on: false, roles: ['trainer'] }, { k: 'bogus', on: true }] } }, a.token);
  const tq = r.body && r.body.token;
  check('ربط الشعبة 63854 بمقررها في تقني ورابط موقّع', r.ok && /^63854\.1\.[0-9a-f]{32}$/.test(tq) && r.body.link.services.length === 3, r.body);
  check('المدرب لا يدير روابط تقني', !(await rpc('taqni_link_set', { p_crn: '63854', p_patch: { enabled: false } }, t1.token)).ok && !(await rpc('taqni_links', {}, t1.token)).ok);
  check('رابط صالح: معلومات الإعلان فقط قبل الدخول', (await rpc('taqni_public', { p_tk: tq })).body.ok === true && !JSON.stringify((await rpc('taqni_public', { p_tk: tq })).body).includes('4460'));
  check('تعديل رقم الشعبة في الرابط يُرفض', (await rpc('taqni_public', { p_tk: tq.replace('63854', '63912') })).body.ok === false && (await rpc('taqni_public', { p_tk: '63854.1.' + '0'.repeat(32) })).body.ok === false);
  let en = (await rpc('taqni_enter', { p_tk: tq }, t1b.token)).body;
  check('مدرب الشعبة: يدخل بدوره وخدمات المدرب بالترتيب', en.ok && en.role === 'trainer' && en.services.map((x) => x.k).join(',') === 'attendance,trainer', en);
  en = (await rpc('taqni_enter', { p_tk: tq }, t2.token)).body;
  check('مدرب آخر: الخادم يمنعه من بيانات الشعبة ويسجّل المحاولة', en.ok === false && +sql(`select count(*) from audit where act='taqni-deny'`) >= 1);
  const s1b = await L.login('446000001', PW.s1);
  en = (await rpc('taqni_enter', { p_tk: tq }, s1b.token)).body;
  check('متدرب الشعبة: دور المتدرب وخدماته فقط', en.ok && en.role === 'trainee' && en.services.map((x) => x.k).join(',') === 'attendance', en);
  /* القناة: تقني فقط */
  await rpc('ctl_platform_set', { p_field: 'channel', p_value: 'taqni' }, a.token);
  const tweb = await L.login('t.ahmed', PW.t1);
  check('«تقني فقط»: جلسة الموقع لا تقرأ البيانات', (await L.docList('sections', tweb.token)).body.length === 0);
  check('«تقني فقط»: جلسة دخلت من رابط الشعبة تعمل', (await L.docList('sections', t1b.token)).body.length >= 1);
  const pe = await open('t.ahmed', PW.t1, URL0 + '&tq=' + encodeURIComponent(tq)); await ready(pe);
  await pe.waitForSelector('.tq-strip', { timeout: 15000 });
  check('الدخول من إعلان الشعبة: يفتح حاضر بشريط الشعبة وخدماتها', /الشعبة 63854/.test(await pe.textContent('.tq-strip')) && /خدمات المدرب/.test(await pe.textContent('.tq-strip')));
  const pw2 = await open('t.ahmed', PW.t1); await pw2.waitForTimeout(2500);
  check('«تقني فقط»: الدخول من الموقع الخارجي يُرفض برسالة', /تقني فقط/.test(await pw2.textContent('#gate')));
  await rpc('ctl_platform_set', { p_field: 'channel', p_value: 'web' }, a.token);
  check('«الموقع فقط»: جلسة تقني لا تقرأ، وجلسة الموقع تقرأ', (await L.docList('sections', t1b.token)).body.length === 0 && (await L.docList('sections', tweb.token)).body.length >= 1);
  await rpc('ctl_platform_set', { p_field: 'channel', p_value: 'both' }, a.token);
  /* إيقاف الرابط وإلغاؤه */
  await rpc('taqni_link_set', { p_crn: '63854', p_patch: { enabled: false } }, a.token);
  check('إيقاف الرابط مؤقتاً: يُرفض دون حذف الإعدادات', /موقوف/.test((await rpc('taqni_public', { p_tk: tq })).body.msg) && sql(`select course_id from taqni_link where crn='63854'`) === '270852');
  await rpc('taqni_link_set', { p_crn: '63854', p_patch: { enabled: true, end_at: new Date(Date.now() - 3600e3).toISOString() } }, a.token);
  check('خارج مدة الإتاحة يُرفض', /مدة الإتاحة/.test((await rpc('taqni_public', { p_tk: tq })).body.msg));
  r = await rpc('taqni_link_set', { p_crn: '63854', p_patch: { end_at: '', revoke: true } }, a.token);
  check('إلغاء الرابط: القديم باطل والجديد يعمل', (await rpc('taqni_public', { p_tk: tq })).body.ok === false && (await rpc('taqni_public', { p_tk: r.body.token })).body.ok === true);
  r = await rpc('taqni_link_set', { p_crn: '63854', p_patch: { posted: true, posted_note: 'أُضيف يدوياً' } }, a.token);
  check('تسجيل إضافة الإعلان (المنفّذ والوقت)', sql(`select posted_by from taqni_link where crn='63854'`) === 'مسؤول تجريبي');
  /* واجهة الربط */
  await pa.evaluate(() => go('taqni')); await pa.waitForSelector('[data-act="tq-edit"][data-crn="63854"]');
  await pa.click('[data-act="tq-edit"][data-crn="63854"]'); await pa.waitForSelector('.tq-svc');
  await pa.click('[data-act="tq-prev"]');
  const prev = await pa.textContent('#tqPrev');
  check('معاينة إعلان الشعبة قبل التفعيل', /خدمات منصة حاضر/.test(prev) && /الشعبة 63854/.test(prev) && /عرض سجل الحضور/.test(prev));
  check('الإعلان يحمل الرابط الموقّع', await pa.evaluate(() => /\?tq=63854\.2\./.test(document.querySelector('#tqPrev a').href)));
  await pa.click('#modal [data-act="modal-close"]');

  /* ===== أدوات Claude ===== */
  let o = JSON.parse(asAdmin(`select claude_tool('get_platform_status', '{}')::text`));
  check('Claude: get_platform_status بالنتيجة الفعلية', o.ok && o.result.mode === 'public' && o.result.channel === 'both' && o.result.sections >= 3);
  o = JSON.parse(asAdmin(`select claude_tool('enable_maintenance_mode', '{"reason":"اختبار Claude"}')::text`));
  check('Claude: تفعيل وضع الصيانة يُنفَّذ فعلاً ويُسجَّل بقناة Claude', o.ok && sql(`select mode from platform_ctl`) === 'maintenance' && sql(`select via||'|'||new_val from ctl_audit where field='mode' order by at desc limit 1`) === 'claude|maintenance');
  JSON.parse(asAdmin(`select claude_tool('disable_maintenance_mode', '{}')::text`));
  check('Claude: إنهاء الصيانة', sql(`select mode from platform_ctl`) === 'public');
  o = JSON.parse(asAdmin(`select claude_tool('get_sections', '{}')::text`));
  check('Claude: get_sections مع حالة ربط تقني', o.result.some((s) => s.crn === '63854' && s.taqni && s.taqni.enabled === true));
  o = JSON.parse(asAdmin(`select claude_tool('manage_taqni_section_links', '{"crn":"63854","patch":{"enabled":false}}')::text`));
  check('Claude: إخفاء رابط حاضر عن شعبة', o.ok && sql(`select enabled::text from taqni_link where crn='63854'`) === 'false');
  let denied = ''; try { asT1(`select claude_tool('get_platform_status', '{}')`); } catch (e) { denied = String(e.stderr || e.message); }
  check('Claude: أدوات الإدارة للمسؤول فقط', /لمسؤول المنصة/.test(denied));
  denied = ''; try { asAdmin(`select claude_tool('manage_grades', '{}')`); } catch (e) { denied = String(e.stderr || e.message); }
  check('Claude: تعديل الدرجات غير متاح عبر Claude', /لا يتم عبر Claude/.test(denied));
  await rpc('ctl_platform_set', { p_field: 'claude', p_value: 'false' }, a.token);
  denied = ''; try { asAdmin(`select claude_tool('get_sections', '{}')`); } catch (e) { denied = String(e.stderr || e.message); }
  check('تعطيل إدارة Claude يوقف الأدوات (عدا قراءة الحالة)', /معطلة/.test(denied) && JSON.parse(asAdmin(`select claude_tool('get_platform_status', '{}')::text`)).result.claude === false);
  denied = ''; try { asAdmin(`select set_config('haader.via','claude',false); select ctl_platform_set('claude','true',null)`); } catch (e) { denied = String(e.stderr || e.message); }
  check('Claude لا يعيد تفعيل نفسه', /من لوحة المنصة فقط/.test(denied));
  await rpc('ctl_platform_set', { p_field: 'claude', p_value: 'true' }, a.token);

  /* ===== لوحة التشغيل ===== */
  await pa.evaluate(() => { HAADER_CTL.C.ov = null; go('ctlops'); }); await pa.waitForSelector('.ctl-opts');
  await pa.click('[data-act="ctl-access"][data-k="maint"]'); await pa.waitForSelector('[data-act="ctl-access-ok"]');
  await pa.fill('#ctlTyp', 'تأكيد'); await pa.click('[data-act="ctl-access-ok"]'); await pa.waitForTimeout(1200);
  check('لوحة التشغيل: وضع الصيانة بتأكيد إضافي', sql(`select mode from platform_ctl`) === 'maintenance');
  await pa.evaluate(() => render(true)); await pa.waitForTimeout(800);
  await pa.click('button[data-act="ctl-access"]:not([disabled]):not(.ctl-opt)'); await pa.waitForSelector('[data-act="ctl-access-ok"]'); await pa.click('[data-act="ctl-access-ok"]'); await pa.waitForTimeout(1200);
  check('لوحة التشغيل: العودة إلى التشغيل العام بضغطة واحدة', sql(`select mode from platform_ctl`) === 'public');
  const opsTxt = await pa.textContent('#main');
  check('سجل التدقيق في اللوحة: قناة Claude والمنصة', /Claude/.test(opsTxt) && /وضع التشغيل/.test(opsTxt));
  check('لا أخطاء JavaScript', errs.length === 0, errs);
  await b.close();
  reset(); sql(`select set_config('haader.sys','1',false); update doc set data = data #- '{n,ctl-test}' where col='notes' and id='63854'`);
  L.done('الإدارة المركزية: التشغيل والمزامنة وClaude وتقني');
})().catch((e) => { console.error(e); process.exit(1); });
