/* البريد الإلكتروني للمدرب ورئيس القسم: يُعدَّل من المنصة ويُحفظ في قاعدة بياناتها، ولا بريد ولا اسم في الشيفرة.
   يعمل على نسخة Claude المبنية (الطبقة المشتركة):  python3 tools/build_artifact.py && node tests/emails.js
   كل العناوين هنا مصطنعة على example.com. */
const L = require('./lib');
if (!process.env.HAADER_FILE) process.env.HAADER_FILE = L.ROOT + '/dist/artifact/index.html';
if (!L.fs.existsSync(process.env.HAADER_FILE)) { console.error('ابنِ نسخة Claude أولاً: python3 tools/build_artifact.py'); process.exit(1); }
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };
const sec = (t) => console.log('\n■ ' + t);
const FILE = process.env.HAADER_FILE;
const writes = (p, path) => p.evaluate((x) => window.__W.filter((w) => w[1] === x).map((w) => w[0]), path);
const save = async (p) => { await p.click('#modal form button.btn.p'); await p.waitForTimeout(120); };
const modalOpen = (p) => p.evaluate(() => !!document.querySelector('#modal'));
(async () => {
  const b = await L.launch();

  sec('لا بريد ولا اسم في الشيفرة');
  const src = L.fs.readFileSync(FILE, 'utf8');
  ok(!/@tvtc\.gov\.sa/i.test(src), 'لا يوجد أي بريد على tvtc.gov.sa في الصفحة المبنية');
  for (const f of ['index.html', 'base/haader-v20.html', 'docs/index.html']) ok(!/@tvtc\.gov\.sa/i.test(L.fs.readFileSync(L.ROOT + '/' + f, 'utf8')), 'ولا في ' + f);
  const docs = L.seed();
  const p = await L.open(b, 'admin', docs);
  ok(await p.evaluate(() => !A.raw.meta.org && orgInfo().head === '' && orgInfo().headEmail === ''), 'القيم الافتراضية لرئيس القسم وبريده فارغة');
  ok(await p.evaluate(() => mailOf({ id: '440000001', cat: 1, course: 'م', crn: '63854' }).cc === ''), 'ولا نسخة (CC) في إشعار الغياب قبل تسجيل بريد رئيس القسم');

  sec('المسؤول يعدّل بريد المدرب من نموذج الحساب');
  await L.view(p, 'users');
  await p.click('[data-act="user-edit"][data-id="ut1"]');
  ok(await p.evaluate(() => { const e = document.querySelector('#uE'); return !!e && e.value === '' && e.type === 'email' && document.querySelector('#uU').closest('label').nextElementSibling === e.closest('label'); }), 'خانة «البريد الإلكتروني» بعد اسم المستخدم، فارغة لحساب بلا بريد');
  await p.fill('#uE', 'ليس-بريداً'); await save(p);
  ok(await modalOpen(p) && !(await writes(p, 'accounts/ut1')).length, 'نص ليس بريداً: لا يُحفظ');
  await p.fill('#uE', 'a@b'); await save(p);
  ok(/بريداً إلكترونياً صحيحاً/.test(await L.toast(p)) && await modalOpen(p) && !(await writes(p, 'accounts/ut1')).length, 'بريد ناقص (a@b): يُرفض برسالة واضحة', await L.toast(p));
  await p.fill('#uE', '  t1@example.com '); await save(p); await L.flush(p);
  let d = await L.dbDocs(p);
  ok(d['accounts/ut1'].email === 't1@example.com' && !(await modalOpen(p)), 'بريد صحيح: حُفظ في حساب المدرب (بعد حذف الفراغات)', d['accounts/ut1'].email);
  ok(JSON.stringify(await writes(p, 'accounts/ut1')) === '["set"]', 'في كتابة واحدة مع بيانات الحساب', await writes(p, 'accounts/ut1'));
  ok(d['accounts/ut1'].username === 't1' && d['accounts/ut1'].role === 'trainer' && d['accounts/ut1'].perms.sync === true, 'وباقي بيانات الحساب كما هي');
  ok((await L.text(p)).includes('t1@example.com'), 'ويظهر البريد في جدول المدربين');
  await p.click('[data-act="user-edit"][data-id="ut1"]');
  ok(await p.evaluate(() => document.querySelector('#uE').value === 't1@example.com'), 'ويظهر في النموذج عند إعادة فتحه');
  await p.fill('#uE', ''); await save(p); await L.flush(p);
  d = await L.dbDocs(p);
  ok(d['accounts/ut1'].email === '', 'ويمكن إفراغه');

  sec('حساب جديد، واسم مستخدم مكرر');
  await p.click('[data-act="user-new"]');
  await p.fill('#uN', 'م. مدرب جديد'); await p.fill('#uU', 'newt'); await p.fill('#uP', 'Temp-12345'); await p.fill('#uE', 'new@example.com');
  await save(p); await p.waitForFunction(() => !document.querySelector('#modal'), null, { timeout: 8000 }); await L.flush(p);
  d = await L.dbDocs(p);
  const nk = Object.keys(d).find((k) => k.startsWith('accounts/') && d[k].username === 'newt');
  ok(nk && d[nk].email === 'new@example.com' && d[nk].role === 'trainer', 'مدرب جديد يُحفظ ببريده', nk && d[nk].email);
  ok(nk && JSON.stringify(await writes(p, nk)) === '["set"]', 'في كتابة واحدة');
  await p.click('[data-act="user-new"]');
  await p.fill('#uN', 'م. مكرر'); await p.fill('#uU', 't2'); await p.fill('#uP', 'Temp-12345'); await p.fill('#uE', 'dup@example.com');
  await save(p); await L.flush(p);
  d = await L.dbDocs(p);
  ok(/مستخدم لحساب آخر/.test(await L.toast(p)) && d['accounts/ut2'].email === undefined && !(await writes(p, 'accounts/ut2')).length, 'اسم مستخدم مكرر: يُرفض ولا يُمسّ بريد الحساب القائم', [await L.toast(p), d['accounts/ut2'].email]);
  await p.click('#modal .row [data-act="modal-close"]');
  ok(await p.evaluate(() => !!document.querySelector('#modal .mwarn')), 'والإلغاء بعد كتابة بريد ينبّه إلى تعديلات لم تُحفظ');
  await p.click('#modal [data-act="modal-force"]');
  await p.click('[data-act="user-edit"][data-id="uhead"]');
  ok(await p.evaluate(() => { document.querySelector('#modal .mx').click(); return !document.querySelector('#modal'); }), 'وفتح النموذج دون تعديل يُغلق بلا تنبيه');
  await p.click('[data-act="user-edit"][data-id="uhead"]');
  await p.fill('#uE', 'head.account@example.com'); await save(p); await L.flush(p);
  d = await L.dbDocs(p);
  ok(d['accounts/uhead'].email === 'head.account@example.com' && d['accounts/uhead'].role === 'head', 'وحساب رئيس القسم يُعدَّل بريده كذلك');

  sec('بريد رئيس القسم في «القسم والتخصصات»');
  await L.view(p, 'org');
  let note = await L.text(p, '#orgMailNote');
  ok(/لم يُسجَّل بعد: اسم رئيس القسم وبريد رئيس القسم/.test(note), 'تنبيه بأن الاسم والبريد لم يُسجَّلا', note);
  await p.fill('#oE', 'x@y'); await p.locator('#oE').dispatchEvent('change'); await L.flush(p);
  d = await L.dbDocs(p);
  ok(/بريداً إلكترونياً صحيحاً لرئيس القسم/.test(await L.toast(p)) && !(d['meta/org'] && d['meta/org'].headEmail), 'بريد غير صحيح: يُرفض ولا يُحفظ', await L.toast(p));
  ok(await p.evaluate(() => document.querySelector('#oE').value === ''), 'وتعود الخانة إلى قيمتها المحفوظة');
  await p.fill('#oE', 'head@example.com'); await p.locator('#oE').dispatchEvent('change'); await L.flush(p);
  await p.fill('#oH', 'م. رئيس تجريبي'); await p.locator('#oH').dispatchEvent('change'); await L.flush(p);
  d = await L.dbDocs(p);
  ok(d['meta/org'].headEmail === 'head@example.com' && d['meta/org'].head === 'م. رئيس تجريبي', 'بريد صحيح واسم: يُحفظان في إعدادات القسم', d['meta/org']);
  note = await L.text(p, '#orgMailNote');
  ok(note && !/لم يُسجَّل بعد/.test(note), 'ويزول التنبيه');
  ok(await p.evaluate(() => mailOf({ id: '440000001', cat: 1, course: 'م', crn: '63854' }).cc === 'head@example.com'), 'ويُضاف نسخةً (CC) في إشعار الغياب');
  ok(await p.evaluate(() => pledgeHTML('', null).includes('م. رئيس تجريبي')), 'واسم رئيس القسم في نموذج التعهد من الإعدادات');
  await p.fill('#oE', ''); await p.locator('#oE').dispatchEvent('change'); await L.flush(p);
  d = await L.dbDocs(p);
  ok(d['meta/org'].headEmail === '', 'ويمكن إفراغ بريد رئيس القسم');

  sec('كل مستخدم يعدّل بريده من بطاقة حسابه');
  const p2 = await L.open(b, 't1', L.seed());
  ok(await p2.evaluate(() => { const x = document.querySelector('#who .row [data-act="email-edit"]'); return !!x && x.textContent === 'بريدي الإلكتروني' && x.previousElementSibling.dataset.act === 'change-pw'; }), 'زر «بريدي الإلكتروني» في بطاقة حساب المدرب');
  await p2.click('#who [data-act="email-edit"]');
  await p2.fill('#emV', 'trainer@example.com'); await save(p2); await L.flush(p2);
  d = await L.dbDocs(p2);
  ok(d['accounts/ut1'].email === 'trainer@example.com' && JSON.stringify(await writes(p2, 'accounts/ut1')) === '["update"]', 'المدرب يحفظ بريده بنفسه', d['accounts/ut1'].email);
  ok(await p2.evaluate(() => signature().trim().endsWith('trainer@example.com')), 'ويظهر في توقيع رسائله');
  ok(await p2.evaluate(() => document.querySelectorAll('#who [data-act="email-edit"]').length === 1), 'ولا يتكرر الزر بعد إعادة الرسم');
  const p3 = await L.open(b, 'head', L.seed());
  ok(await p3.evaluate(() => !!document.querySelector('#who [data-act="email-edit"]')), 'ورئيس القسم يرى الزر في حسابه');
  const p4 = await L.open(b, 'viewer', L.seed());
  ok(await p4.evaluate(() => !document.querySelector('#who [data-act="email-edit"]')), 'وحساب الاطلاع لا يراه');

  sec('الجوال ونافذة الملف الشخصي');
  const p5 = await L.open(b, 't2', L.seed(), { w: 390, h: 800 });
  ok(await p5.evaluate(() => getComputedStyle(document.querySelector('#who [data-act="email-edit"]')).display === 'none'), 'في الجوال يُخفى الزر من الشريط كزر كلمة المرور');
  const hasProf = await p5.evaluate(() => !!(window.HAADER_V2 && window.HAADER_V2.openProf));
  if (hasProf) {
    await p5.evaluate(() => window.HAADER_V2.openProf(null));
    ok(await p5.evaluate(() => { const f = document.querySelector('#v2prof'); return !f.hidden && /البريد الإلكتروني\s*غير مسجل/.test(f.innerText) && !!f.querySelector('[data-act="email-edit"]'); }), 'ونافذة الملف الشخصي تعرض البريد وزر تعديله');
    await p5.click('#v2prof [data-act="email-edit"]');
    await p5.fill('#emV', 'mobile@example.com'); await save(p5); await L.flush(p5);
    d = await L.dbDocs(p5);
    ok(d['accounts/ut2'].email === 'mobile@example.com', 'ويُحفظ البريد من الجوال');
    await p5.evaluate(() => window.HAADER_V2.openProf(null));
    ok(await p5.evaluate(() => document.querySelector('#v2prof').innerText.includes('mobile@example.com')), 'ويظهر في الملف الشخصي بعد الحفظ');
  } else console.log('  (الصفحة بلا المظهر المطوّر: تُخطّى اختبارات نافذة الملف الشخصي)');

  const errs = [p, p2, p3, p4, p5].flatMap((x) => x.errs);
  ok(!errs.length, 'لا أخطاء JavaScript', errs.slice(0, 4));
  await p.screenshot({ path: __dirname + '/out/emails-org.png' });
  await b.close();
  console.log(`\n══ البريد الإلكتروني للمدرب ورئيس القسم: ${pass} ناجح، ${fail} فاشل ══`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
