// استبعاد البريد من قاعدة البيانات (الخادم + واجهة الويب). يُشغَّل بعد e2e.test.js. العناوين مصطنعة.
const { chromium } = require('playwright');
const L = require('./lib');
const { sql, check } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const GOV = 'someone' + '@' + 'tvtc.gov.sa', GOV2 = 'x.y' + '@' + 'Mail.TVTC.Gov.Sa';
(async () => {
  const a = await L.login('aalkhathami', 'Admin#2026x'), t = await L.login('t.ahmed', 'Trainer1-pass');
  check('دخول المسؤول والمدرب', a.ok && t.ok);
  const ck = async (v, tok) => (await L.rpc('email_check', { p: v }, tok || t.token)).body;
  check('email_check: tvtc.gov.sa ونطاقاته الفرعية مرفوضة، والصيغة الخاطئة، وغيرها مقبول', (await ck(GOV)) === 'gov' && (await ck(GOV2)) === 'gov' && (await ck('a@b')) === 'format' && (await ck('ok@example.com')) === null && (await ck('446000001@tvtc.edu.sa')) === null);
  check('email_check غير متاحة لمن لم يسجل الدخول', !(await L.rpc('email_check', { p: GOV })).ok);
  // كتابة وثيقة فيها بريد مستبعد
  sql(`select set_config('haader.sys','1',false); insert into doc(col,id,data) values ('meta','emailtest','{"t":"راسل ${GOV} أو 446000001@tvtc.edu.sa","list":["${GOV2}","keep@example.com"]}'::jsonb) on conflict (col,id) do update set data=excluded.data`);
  let d = JSON.parse(sql(`select data from doc where col='meta' and id='emailtest'`));
  check('مُشغّل الخادم يزيل بريد tvtc.gov.sa من أي وثيقة ويُبقي ما سواه', d.t === 'راسل  أو 446000001@tvtc.edu.sa' && d.list[0] === '' && d.list[1] === 'keep@example.com', d);
  // حساب صاحب المنصة: لا بريد له، وما يُكتب فيه تُحفظ بصمته
  const own = sql(`select owner_legacy()`);
  check('صاحب المنصة = أول حساب مسؤول', own === sql(`select legacy_id from app_user where username='aalkhathami'`), own);
  sql(`select set_config('haader.sys','1',false); update doc set data = data || '{"email":"owner.personal@example.org"}'::jsonb where col='accounts' and id='${own}'`);
  check('بريد حساب صاحب المنصة لا يُحفظ', sql(`select data ? 'email' from doc where col='accounts' and id='${own}'`) === 'f');
  check('وتُحفظ بصمته وحدها في جدول خاص', sql(`select count(*) from email_block where h = email_hash('owner.personal@example.org')`) === '1' && sql(`select count(*) from email_block where h like '%@%'`) === '0');
  check('فيُرفض بعدها في أي مكان', (await ck('Owner.Personal@example.org')) === 'owner');
  check('الجدول الخاص لا تقرؤه الواجهة', !(await L.req('/rest/v1/email_block?select=h', { token: a.token })).ok || (await L.req('/rest/v1/email_block?select=h', { token: a.token })).body.length === 0);
  sql(`select set_config('haader.sys','1',false); update doc set data = jsonb_build_object('t','تواصل: owner.personal@example.org') where col='meta' and id='emailtest'`);
  check('وبريد صاحب المنصة يُزال من أي وثيقة', JSON.parse(sql(`select data from doc where col='meta' and id='emailtest'`)).t === 'تواصل: ');
  const ba = await L.rpc('email_block_add', { p: 'owner.second@example.org' }, a.token), bt = await L.rpc('email_block_add', { p: 'x@example.org' }, t.token);
  check('إضافة بريد إلى الاستبعاد لصاحب المنصة وحده', ba.ok && !bt.ok && (await ck('owner.second@example.org')) === 'owner', [ba.status, bt.status]);
  sql(`select set_config('haader.sys','1',false); insert into audit(by_id, by_name, act, det) values (null, 'اختبار', 'email_test', 'أُرسل إلى ${GOV}')`);
  check('وسجل التدقيق كذلك', sql(`select det from audit where act='email_test' order by at desc limit 1`) === 'أُرسل إلى');
  // الواجهة
  const b = await chromium.launch(), errs = [];
  const c = await b.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 1366, height: 860 } }), p = await c.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL0); await p.waitForSelector('#liU'); await p.fill('#liU', 't.ahmed'); await p.fill('#liP', 'Trainer1-pass'); await p.click('#liB');
  await p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh, null, { timeout: 30000 });
  await p.evaluate(() => openEmailForm());
  await p.fill('#emV', GOV); await p.click('#modal form button.btn.p'); await p.waitForTimeout(500);
  check('الويب: بريد tvtc.gov.sa يُرفض برسالة واضحة في النافذة', await p.evaluate(() => { const m = document.querySelector('#emErr'); return !!m && !m.hidden && /tvtc\.gov\.sa/.test(m.textContent); }));
  await p.fill('#emV', 'owner.personal@example.org'); await p.click('#modal form button.btn.p'); await p.waitForTimeout(800);
  check('الويب: بريد صاحب المنصة يُرفض (من الخادم)', /يعود لصاحب المنصة/.test(await p.evaluate(() => document.querySelector('#emErr').textContent)));
  await p.check('input[name="emM"][value="manual"]'); await p.fill('#emV', 'trainer.manual@example.com'); await p.click('#modal form button.btn.p'); await p.waitForTimeout(800);
  const tr = sql(`select legacy_id from app_user where username='t.ahmed'`);
  check('الويب: الإدخال اليدوي يُستخدم ولا يُكتب في قاعدة البيانات', await p.evaluate(() => A.mailSelf === 'trainer.manual@example.com' && signature().includes('trainer.manual@example.com')) && !sql(`select coalesce(data->>'email','') from doc where col='accounts' and id='${tr}'`).includes('manual'));
  await p.evaluate(() => openEmailForm()); await p.check('input[name="emM"][value="save"]'); await p.fill('#emV', 'trainer.saved@example.com'); await p.click('#modal form button.btn.p'); await p.waitForTimeout(1500);
  check('الويب: حفظ بريد مقبول في الحساب', sql(`select data->>'email' from doc where col='accounts' and id='${tr}'`) === 'trainer.saved@example.com');
  check('لا أخطاء JavaScript', !errs.length, errs);
  await b.close();
  sql(`select set_config('haader.sys','1',false); delete from doc where col='meta' and id='emailtest'; delete from audit where act='email_test'; delete from email_block; update doc set data = data - 'email' where col='accounts' and id='${tr}'`);
  L.done('استبعاد البريد (الخادم والويب)');
})().catch((e) => { console.error(e); process.exit(1); });
