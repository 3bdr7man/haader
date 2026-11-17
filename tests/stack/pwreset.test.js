// «نسيت كلمة المرور؟» وطلبات المسؤول ورابط إعادة التعيين، والاستعلام عن المرشد (الخادم والويب). يُشغَّل بعد e2e.test.js.
const { chromium } = require('playwright');
const L = require('./lib');
const { sql, check } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const HEAD_ID = 'uhead000000000001';
(async () => {
  sql(`select set_config('haader.sys','1',false); delete from pw_reset; update doc set data = data || '{"email":"head.mail@example.org"}'::jsonb where col='accounts' and id='${HEAD_ID}';
    delete from doc where col='bosla'; insert into doc(col,id,data) values ('bosla','t1','{"rows":{"446000001":{"n":"متدرب","adv":"0000001","sp":"شبكات"}}}'::jsonb), ('bosla','adv','{"rows":{"0000001":{"n":"مرشد تجريبي","acct":"","t":"مرشد أكاديمي"}}}'::jsonb);`);
  const a = await L.login('aalkhathami', 'Admin#2026x'), t = await L.login('t.ahmed', 'Trainer1-pass'), s2 = await L.login('446000002', 'Zx7c-Q2wEr');
  check('دخول المسؤول والمدرب والمتدرب', a.ok && t.ok && s2.ok, [a.ok, t.ok, s2.ok]);
  /* ---------- الاستعلام عن المرشد ---------- */
  const adv = async (v, tok) => (await L.rpc('advisor_lookup', { p_id: v }, tok)).body;
  let r = await adv('446000001', t.token);
  check('المرشد: المدرب يرى اسم المرشد وحده', r.st === 'ok' && r.name === 'مرشد تجريبي' && Object.keys(r).sort().join() === 'name,st', r);
  check('المرشد: المتدرب يستعلم كذلك', (await adv('٤٤٦٠٠٠٠٠١', s2.token)).st === 'ok');
  check('المرشد: فارغ، غير صالح، غير موجود، بلا مرشد', (await adv('', t.token)).st === 'empty' && (await adv('44abc', t.token)).st === 'invalid' && (await adv('4460000011', t.token)).st === 'invalid' && (await adv('449999990', t.token)).st === 'not_found' && (await adv('446000002', t.token)).st === 'no_advisor');
  check('المرشد: لمن لم يسجل الدخول ممنوع', !(await L.rpc('advisor_lookup', { p_id: '446000001' })).ok);
  /* ---------- الطلب من صفحة الدخول ---------- */
  const req = async (v, as) => (await L.rpc('pw_reset_request', as ? { p_login: v, p_as: as } : { p_login: v })).body;
  const outs = [await req('446000002', 'trainer'), await req('head1', 'head'), await req('HEAD1 ', 'trainer'), await req('nobody.here', 'trainer'), await req('446000002', 'trainee'), await req('head.mail@example.org', 'head'), await req('x@y.com')];
  check('الطلب: الرد واحد دائماً (لا يكشف وجود الحساب)', outs.every((o) => JSON.stringify(o) === '{"ok": true}' || JSON.stringify(o) === '{"ok":true}'), outs);
  check('الطلب: يُسجَّل للحساب الموجود وحده بنوعه المختار، بلا تكرار للطلب المفتوح، ولا يطابق متدرباً اختار «مدرب»', sql(`select string_agg(kind||':'||ref||':'||via||':'||coalesce(asked,''), ',' order by id) from pw_reset`) === `staff:${HEAD_ID}:username:head,trainee:446000002:trainee_id:trainee`, sql(`select string_agg(kind||':'||ref||':'||via, ',' order by id) from pw_reset`));
  check('الطلب: لا يُخزَّن ما لم يطابق حساباً', !sql(`select coalesce(string_agg(row_to_json(p)::text, ','), '') from pw_reset p`).includes('nobody'));
  check('الطلب: الجدول لا تقرؤه الواجهة', (await L.req('/rest/v1/pw_reset?select=id', { token: a.token })).body.length === undefined || (await L.req('/rest/v1/pw_reset?select=id', { token: a.token })).status >= 400);
  /* ---------- المسؤول ---------- */
  check('القائمة لمسؤول المنصة وحده', !(await L.rpc('pw_reset_list', {}, t.token)).ok && !(await L.rpc('pw_reset_list', {}, s2.token)).ok);
  const list = (await L.rpc('pw_reset_list', {}, a.token)).body;
  const hr = list.find((x) => x.ref === HEAD_ID);
  check('القائمة: وقت الطلب وبيانات التعريف والبريد، بلا رمز', hr && hr.at && hr.who.login === 'head1' && hr.who.email === 'head.mail@example.org' && hr.who.role === 'head' && !('token_hash' in hr) && !('token' in hr), hr);
  check('الرابط لمسؤول المنصة وحده', !(await L.rpc('pw_reset_link', { p_id: hr.id }, t.token)).ok);
  /* ---------- الواجهة: صفحة الدخول ---------- */
  const b = await chromium.launch(), errs = [];
  const ctx = await b.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 1280, height: 860 } }), p = await ctx.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL0); await p.waitForSelector('#liU');
  await p.click('[data-act="pw-forgot"]'); await p.waitForSelector('#pfU');
  check('الواجهة: ثلاثة أنواع حسابات (متدرب، مدرب، رئيس القسم) والمتدرب مختار', await p.evaluate(() => [...document.querySelectorAll('input[name="pwas"]')].map((x) => x.value + (x.checked ? '*' : '')).join() === 'trainee*,trainer,head' && /الرقم التدريبي/.test(document.getElementById('gate').innerText)));
  await p.click('#pfB'); await p.waitForTimeout(200);
  check('الواجهة: الحقل الفارغ برسالة', /اكتب رقمك التدريبي/.test(await p.evaluate(() => document.getElementById('pfE').innerText)));
  await p.fill('#pfU', '12ab'); await p.click('#pfB'); await p.waitForTimeout(200);
  check('الواجهة: رقم تدريبي غير صالح للمتدرب', /9 أرقام/.test(await p.evaluate(() => document.getElementById('pfE').innerText)));
  await p.check('input[name="pwas"][value="trainer"]'); await p.waitForTimeout(150);
  check('الواجهة: اختيار «مدرب» يغيّر الحقل إلى اسم المستخدم أو البريد', /اسم المستخدم أو البريد المرتبط بحسابك/.test(await p.evaluate(() => document.getElementById('gate').innerText)));
  await p.fill('#pfU', 'nobody.at.all'); await p.click('#pfB'); await p.waitForFunction(() => /استلمنا طلبك/.test(document.getElementById('gate').innerText), null, { timeout: 8000 });
  const msgA = await p.evaluate(() => document.querySelector('#gate .okbox').innerText);
  await p.click('[data-act="pw-back"]'); await p.waitForSelector('#liU'); await p.click('[data-act="pw-forgot"]'); await p.waitForSelector('#pfU');
  await p.check('input[name="pwas"][value="trainer"]'); await p.waitForTimeout(150);
  await p.fill('#pfU', 't.ahmed'); await p.click('#pfB'); await p.waitForFunction(() => /استلمنا طلبك/.test(document.getElementById('gate').innerText), null, { timeout: 8000 });
  const msgB = await p.evaluate(() => document.querySelector('#gate .okbox').innerText);
  check('الواجهة: رسالة الاستلام نفسها لحساب موجود وغير موجود، وتذكر متابعة المسؤول', msgA === msgB && /مسؤول المنصة/.test(msgA) && /لن تُرسل إليك كلمة مرور/.test(msgA), [msgA, msgB]);
  await p.screenshot({ path: '/tmp/claude-0/-home-claude/da2fea53-9caa-5476-bb95-529d935e4850/scratchpad/pw-sent.png' });
  check('الواجهة: طلب المدرب سُجّل', sql(`select count(*) from pw_reset where ref='utrain00000000001'`) === '1');
  /* المسؤول يراجع */
  await p.click('[data-act="pw-back"]'); await p.waitForSelector('#liU');
  await p.fill('#liU', 'aalkhathami'); await p.fill('#liP', 'Admin#2026x'); await p.click('#liB');
  await p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh, null, { timeout: 30000 });
  await p.waitForFunction(() => window.HAADER_PW.R.list, null, { timeout: 8000 }); await p.waitForTimeout(300);
  const nav = await p.evaluate(() => { const x = document.querySelector('#nav a[data-v="pwreq"]'); return x ? { t: x.innerText, badge: x.querySelector('i').hidden ? '' : x.querySelector('i').textContent } : null; });
  check('المسؤول: «طلبات كلمة المرور» في القائمة بعدّاد الطلبات الجديدة', nav && /طلبات كلمة المرور/.test(nav.t) && nav.badge === '3', nav);
  await p.evaluate(() => go('pwreq')); await p.waitForSelector('[data-act="pwr-link"]');
  const tbl = await p.evaluate(() => document.querySelector('#main table').innerText);
  check('المسؤول: الجدول بالوقت والحساب والبريد والحالة ونوع الحساب المختار', /بصفته: رئيس القسم/.test(tbl) && /بصفته: مدرب/.test(tbl) && /head1/.test(tbl) && /head\.mail@example\.org/.test(tbl) && /جديد/.test(tbl) && /446000002@tvtc\.edu\.sa/.test(tbl), tbl.slice(0, 300));
  const hid = await p.evaluate((ref) => window.HAADER_PW.R.list.find((x) => x.ref === ref).id, HEAD_ID);
  await p.click(`[data-act="pwr-link"][data-id="${hid}"]`); await p.waitForSelector('#pwrL');
  const md = await p.evaluate(() => ({ link: document.getElementById('pwrL').value, mail: (document.querySelector('#modal a[href^="mailto:"]') || {}).href || '', txt: document.getElementById('modal').innerText }));
  const token = (md.link.match(/#reset=([0-9a-f]{64})$/) || [])[1];
  check('الرابط: رمز 64 خانة ورسالة بريد إلى البريد المسجل', !!token && md.mail.startsWith('mailto:head.mail%40example.org') && decodeURIComponent(md.mail).includes(md.link) && /مرة واحدة/.test(md.txt), md.mail.slice(0, 80));
  check('الرابط: الرسالة لا تحمل كلمة مرور، والقاعدة تحفظ بصمة الرمز لا الرمز', !/Head-pass-99/.test(decodeURIComponent(md.mail)) && sql(`select count(*) from pw_reset where token_hash = encode(extensions.digest('${token}','sha256'),'hex')`) === '1' && sql(`select count(*) from pw_reset p where row_to_json(p)::text like '%${token}%'`) === '0');
  await p.evaluate(() => closeModal());
  await p.waitForTimeout(500);
  check('الحالة: «أُرسل رابط» مع الإجراء ووقته ومنفّذه', /أُرسل رابط/.test(await p.evaluate(() => document.querySelector('#main table').innerText)) && sql(`select action_by_name is not null and action_at is not null from pw_reset where id=${hid}`) === 't');
  /* إغلاق طلب المتدرب بإجراء */
  const tid = await p.evaluate(() => window.HAADER_PW.R.list.find((x) => x.ref === '446000002').id);
  await p.click(`[data-act="pwr-close"][data-id="${tid}"]`); await p.waitForSelector('#pwrA');
  await p.fill('#pwrN', 'سُلّمت له شخصياً'); await p.click('#modal form button.btn.p'); await p.waitForTimeout(800);
  check('الإغلاق: يُسجَّل الإجراء ووقته', sql(`select status||'|'||(action like '%مؤقتة%سُلّمت له شخصياً%')::text from pw_reset where id=${tid}`) === 'closed|true');
  /* صاحب الرابط */
  const c2 = await b.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 390, height: 800 } }), q = await c2.newPage();
  q.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await q.goto(URL0 + '#reset=' + token); await q.waitForSelector('#prN', { timeout: 10000 });
  check('صفحة الرابط: تحذف الرمز من شريط العنوان وتعرض الحساب', !(await q.evaluate(() => location.hash)).includes('reset') && /head1/.test(await q.evaluate(() => document.getElementById('gate').innerText)));
  await q.fill('#prN', 'Short1'); await q.fill('#prR', 'Short1'); await q.click('#prB'); await q.waitForTimeout(150);
  check('صفحة الرابط: كلمة قصيرة تُرفض', /8 أحرف/.test(await q.evaluate(() => document.getElementById('prE').innerText)));
  await q.fill('#prN', 'New-Head-pass7'); await q.fill('#prR', 'Other-pass-77'); await q.click('#prB'); await q.waitForTimeout(150);
  check('صفحة الرابط: عدم التطابق يُرفض', /غير متطابقتين/.test(await q.evaluate(() => document.getElementById('prE').innerText)));
  await q.fill('#prN', 'New-Head-pass7'); await q.fill('#prR', 'New-Head-pass7'); await q.click('#prB');
  await q.waitForFunction(() => /تغيّرت كلمة المرور/.test(document.getElementById('gate').innerText), null, { timeout: 15000 });
  check('كلمة المرور الجديدة تعمل، والقديمة لا', (await L.login('head1', 'New-Head-pass7')).ok && !(await L.login('head1', 'Head-pass-99')).ok);
  check('الطلب اكتمل، ولا تُخزن كلمة المرور نصاً', sql(`select status from pw_reset where id=${hid}`) === 'done' && sql(`select count(*) from doc where data::text like '%New-Head-pass7%'`) === '0');
  check('الرابط لا يُستخدم مرتين', (await L.rpc('pw_reset_check', { p_token: token })).body.why === 'used' && !(await L.rpc('pw_reset_finish', { p_token: token, p_salt: '0'.repeat(32), p_iter: 150000, p_hash: '1'.repeat(64) })).ok);
  await q.goto(URL0 + '#reset=' + token); await q.waitForFunction(() => /استُخدم هذا الرابط/.test(document.getElementById('gate').innerText), null, { timeout: 10000 });
  check('صفحة الرابط المستخدم: رسالة وطلب جديد', true);
  /* انتهاء الصلاحية */
  const l2 = (await L.rpc('pw_reset_link', { p_id: sql(`select id from pw_reset where ref='utrain00000000001'`), p_hours: 1 }, a.token)).body;
  sql(`update pw_reset set token_exp = now() - interval '1 minute' where ref='utrain00000000001'`);
  check('الرابط المنتهي يُرفض', (await L.rpc('pw_reset_check', { p_token: l2.token })).body.why === 'expired' && !(await L.rpc('pw_reset_finish', { p_token: l2.token, p_salt: '0'.repeat(32), p_iter: 150000, p_hash: '1'.repeat(64) })).ok);
  await q.screenshot({ path: '/tmp/claude-0/-home-claude/da2fea53-9caa-5476-bb95-529d935e4850/scratchpad/pw-used.png' });
  check('لا أخطاء JavaScript', !errs.length, errs);
  await b.close();
  sql(`select set_config('haader.sys','1',false); delete from pw_reset; delete from doc where col='bosla';`);
  L.done('نسيت كلمة المرور والاستعلام عن المرشد (الخادم والويب)');
})().catch((e) => { console.error(e); process.exit(1); });
