// تغيير المدرب كلمة مروره متى شاء، وتسجيل ذلك في سجل المنصة (سجل الخادم وسجل الدخول). يُشغَّل بعد e2e.test.js.
const { chromium } = require('playwright');
const L = require('./lib');
const { sql, check } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const OLD = 'Trainer1-pass', NEW = 'Shabaka#2026x';
(async () => {
  const t0 = sql(`select count(*) from audit where act in ('pw-change','pw-set')`);
  const b = await chromium.launch(), errs = [];
  /* الجوال: الزر ظاهر */
  const c = await b.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }), p = await c.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL0); await p.waitForSelector('#liU'); await p.fill('#liU', 't.ahmed'); await p.fill('#liP', OLD); await p.click('#liB');
  await p.waitForFunction(() => typeof A !== 'undefined' && A.me && !document.querySelector('#shell').hidden, null, { timeout: 30000 });
  check('الجوال: زر «كلمة المرور» ظاهر للمدرب', await p.evaluate(() => { const x = document.querySelector('#who [data-act="change-pw"]'); if (!x) return false; const r = x.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(x).display !== 'none'; }));
  await p.click('#who [data-act="change-pw"]'); await p.waitForSelector('#cpN');
  check('النافذة تعرض القواعد وأن التغيير يُسجَّل', /8 أحرف/.test(await p.textContent('#modal')) && /يُسجَّل التغيير في سجل المنصة/.test(await p.textContent('#modal')));
  const tryPw = async (cur, nw, rp) => { await p.fill('#cpC', cur); await p.fill('#cpN', nw); await p.fill('#cpR', rp); await p.click('#modal form[data-submit="changePw"] .btn.p'); await p.waitForTimeout(700); return p.evaluate(() => { const e = document.getElementById('cpE'); return e && !e.hidden ? e.textContent : (document.getElementById('cpN') ? '' : 'CLOSED'); }); };
  check('كلمة المرور الحالية الخاطئة تُرفض', /الحالية غير صحيحة/.test(await tryPw('wrong-pass', NEW, NEW)));
  check('الأرقام فقط تُرفض', /أرقاماً فقط/.test(await tryPw(OLD, '123456789', '123456789')));
  check('تضمين اسم المستخدم يُرفض', /اسم المستخدم/.test(await tryPw(OLD, 'x-t.ahmed-9', 'x-t.ahmed-9')));
  check('عدم التطابق يُرفض', /غير متطابقين/.test(await tryPw(OLD, NEW, NEW + 'z')));
  check('مطابقة الحالية تُرفض', /تختلف عن الحالية/.test(await tryPw(OLD, OLD, OLD)));
  check('لا شيء سُجّل في السجل بعد المحاولات المرفوضة', sql(`select count(*) from audit where act in ('pw-change','pw-set')`) === t0);
  const r = await tryPw(OLD, NEW, NEW);
  check('التغيير الصحيح يُحفظ', r === 'CLOSED' && /تغيّرت كلمة المرور/.test(await p.evaluate(() => document.getElementById('toast').textContent)), r);
  await p.waitForTimeout(800);
  const au = sql(`select a.act || '|' || a.by_name || '|' || a.det from audit a join app_user u on u.id = a.by_id where u.username = 't.ahmed' and a.act = 'pw-change' order by a.at desc limit 1`);
  check('سجل الخادم: «غيّر كلمة مرور حسابه» باسم المدرب ووقته', /^pw-change\|مدرب أول\|غيّر كلمة مرور حسابه \(t\.ahmed\)$/.test(au), au);
  check('السجل لا يحوي كلمة المرور ولا بصمتها', !sql(`select coalesce(string_agg(det || coalesce(old_val,'') || coalesce(new_val,''), ' '), '') from audit where act='pw-change'`).includes(NEW));
  check('وقت آخر تغيير في الحساب (pwAt)، والبصمة لا تُخزَّن في الوثيقة', /^\d{4}-\d\d-\d\dT/.test(sql(`select data->>'pwAt' from doc where col='accounts' and id='utrain00000000001'`)) && sql(`select coalesce(data->>'hash','') from doc where col='accounts' and id='utrain00000000001'`) === '');
  check('سجل الدخول: «تغيير كلمة المرور»', +sql(`select count(*) from doc where col='logins' and data->>'username'='t.ahmed' and data->>'note'='تغيير كلمة المرور'`) >= 1);
  const ln = await L.login('t.ahmed', NEW), lo = await L.login('t.ahmed', OLD);
  check('الدخول بالجديدة يعمل، وبالقديمة لا', ln.ok && !lo.ok, [ln.ok, lo.ok]);
  /* المسؤول يعيّن كلمة مرور مدرب آخر: pw-set */
  const a = await L.login('aalkhathami', 'Admin#2026x');
  const rs = await L.docMerge('accounts', 'utrain00000000002', Object.assign({ mustChange: false }, L.pwFields('Trainer2-pass')), a.token);
  check('تعيين المسؤول لكلمة مرور غيره يُسجَّل pw-set باسم الحساب', rs.ok && /عيّن كلمة مرور جديدة لحساب .*t\.saad/.test(sql(`select det from audit where act='pw-set' order by at desc limit 1`)), rs.status);
  /* صفحة «سجل الدخول» للمسؤول: سجل تغيير كلمات المرور */
  const pa = await b.newPage(); pa.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await pa.goto(URL0); await pa.waitForSelector('#liU'); await pa.fill('#liU', 'aalkhathami'); await pa.fill('#liP', 'Admin#2026x'); await pa.click('#liB');
  await pa.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh, null, { timeout: 30000 });
  await pa.evaluate(() => go('logins')); await pa.waitForSelector('#pwLog table', { timeout: 15000 });
  const lt = await pa.textContent('#pwLog');
  check('سجل الدخول للمسؤول: «سجل تغيير كلمات المرور» بالمنفّذ والعملية', /غيّر كلمة مروره/.test(lt) && /مدرب أول/.test(lt) && /عيّن كلمة مرور لحساب/.test(lt), lt.slice(0, 300));
  const tl = await L.rpc('pw_change_log', {}, ln.token);
  check('المدرب يرى ما يخصه فقط من السجل', tl.ok && tl.body.length >= 1 && tl.body.every((x) => x.by === 'مدرب أول'), tl.body && tl.body.length);
  const anon = await L.rpc('pw_change_log', {});
  check('بلا دخول: لا وصول إلى السجل', !anon.ok, anon.status);
  check('لا أخطاء JavaScript', errs.length === 0, errs);
  await b.close();
  /* إعادة كلمة مرور المدرب للاختبارات الأخرى */
  const back = await L.docMerge('accounts', 'utrain00000000001', Object.assign({ mustChange: false }, L.pwFields(OLD)), a.token);
  check('(إعادة كلمة المرور الأصلية للاختبارات الأخرى)', back.ok && (await L.login('t.ahmed', OLD)).ok);
  L.done('تغيير كلمة مرور المدرب وتسجيله');
})().catch((e) => { console.error(e); process.exit(1); });
