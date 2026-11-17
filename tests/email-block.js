/* استبعاد البريد من قاعدة البيانات (نسخة Claude المبنية):
   - كل بريد ينتهي بـ tvtc.gov.sa (وأي نطاق فرعي منه) يُرفض في كل خانة برسالة واضحة، ويُزال من أي كتابة
   - بريد صاحب المنصة (أول حساب مسؤول): لا يُحفظ لحسابه بريد، وما يكتبه تُحفظ بصمته فيُرفض في أي حساب
   - الإدخال اليدوي لهذه الجلسة دون حفظ
   العناوين كلها مصطنعة. */
const L = require('./lib');
if (!process.env.HAADER_FILE) process.env.HAADER_FILE = L.ROOT + '/dist/artifact/index.html';
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };
const sec = (t) => console.log('\n■ ' + t);
const GOV = ['someone' + '@' + 'tvtc.gov.sa', 'Someone.Else' + '@' + 'Sub.TVTC.Gov.Sa'];
const save = async (p) => { await p.click('#modal form button.btn.p'); await p.waitForTimeout(400); };
const writes = (p, path) => p.evaluate((x) => window.__W.filter((w) => w[1] === x), path);
(async () => {
  const b = await L.launch();
  sec('القاعدة العامة');
  const docs = L.seed();
  docs['accounts/uadmin'].email = 'admin.old' + '@' + 'tvtc.gov.sa';
  docs['notes/63854'] = Object.assign({}, docs['notes/63854'] || {}, { memo: 'راسل ' + GOV[0] + ' أو 446000001@tvtc.edu.sa' });
  const p = await L.open(b, 'admin', docs);
  const v = await p.evaluate((g) => ({ a: emailGov(g[0]), b: emailGov(g[1]), c: emailGov('x@nottvtc.gov.sa'), d: emailGov('446000001@tvtc.edu.sa'), e: emailGov('x@tvtc.gov.sa.example.com') }), GOV);
  ok(v.a && v.b && !v.c && !v.d && !v.e, 'tvtc.gov.sa ونطاقاته الفرعية فقط (لا tvtc.edu.sa ولا نطاق يشبهه)', v);
  ok(await p.evaluate(() => sha256hex('abc') === 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'), 'بصمة SHA-256 صحيحة');

  sec('تنظيف الموجود عند فتح المسؤول للمنصة');
  await p.waitForTimeout(1800); await L.flush(p);
  let d = await L.dbDocs(p);
  ok(!JSON.stringify(d).match(/tvtc\.gov\.sa/i), 'لا يبقى أي بريد tvtc.gov.sa في قاعدة البيانات', Object.keys(d).filter((k) => /tvtc\.gov\.sa/i.test(JSON.stringify(d[k]))));
  ok(d['accounts/uadmin'].email === '' && d['notes/63854'].memo.includes('446000001@tvtc.edu.sa') && d['notes/63854'].memo.startsWith('راسل '), 'يُزال البريد وحده ويبقى باقي النص وبريد المتدربين', d['notes/63854'].memo);

  sec('نموذج الحساب');
  await L.view(p, 'users');
  await p.click('[data-act="user-edit"][data-id="ut1"]');
  for (const g of GOV) {
    await p.fill('#uE', g); await save(p);
    const t = await L.toast(p);
    ok(/لا يُقبل البريد/.test(t) && /tvtc\.gov\.sa/.test(t) && await p.evaluate(() => { const m = document.querySelector('#uE').parentNode.querySelector('.emerr'); return !!m && !m.hidden && !!document.querySelector('#modal'); }) && !(await writes(p, 'accounts/ut1')).length, 'يُرفض ' + g + ' برسالة واضحة ولا يُحفظ', t);
  }
  await p.click('#modal [data-act="modal-close"]').catch(() => {}); await p.click('#modal [data-act="modal-force"]').catch(() => {});
  await p.click('[data-act="user-edit"][data-id="uadmin"]');
  ok(await p.evaluate(() => { const e = document.querySelector('#uE'); return e.disabled && e.value === '' && /صاحب المنصة/.test(e.parentNode.innerText); }), 'حساب صاحب المنصة: خانة البريد معطلة مع السبب');
  await p.click('#modal [data-act="modal-close"]').catch(() => {}); await p.click('#modal [data-act="modal-force"]', { timeout: 1500 }).catch(() => {});
  ok(await p.evaluate(() => !document.querySelector('#modal')), 'النافذة أُغلقت دون حفظ');

  sec('بريد رئيس القسم');
  await L.view(p, 'org');
  await p.fill('#oE', GOV[0]); await p.locator('#oE').dispatchEvent('change'); await p.waitForTimeout(200); await L.flush(p);
  d = await L.dbDocs(p);
  ok(/لا يُقبل البريد/.test(await L.toast(p)) && !(d['meta/org'] && d['meta/org'].headEmail), 'بريد tvtc.gov.sa لرئيس القسم يُرفض ولا يُحفظ', await L.toast(p));

  sec('بريد صاحب المنصة');
  await p.click('#who [data-act="email-edit"]').catch(async () => { await p.evaluate(() => openEmailForm()); });
  if (!(await p.evaluate(() => !!document.querySelector('#emV')))) await p.evaluate(() => openEmailForm());
  ok(await p.evaluate(() => document.querySelector('input[name="emM"][value="save"]').disabled && document.querySelector('input[name="emM"][value="manual"]').checked), 'صاحب المنصة: «الحفظ في حسابي» معطل، والإدخال اليدوي مختار');
  await p.fill('#emV', 'owner.personal@example.org'); await save(p); await L.flush(p);
  d = await L.dbDocs(p);
  const h = await p.evaluate(() => sha256hex('owner.personal@example.org'));
  ok(d['meta/emailblock'] && d['meta/emailblock'].h.includes(h) && !JSON.stringify(d).includes('owner.personal@example.org'), 'تُحفظ بصمة بريده وحدها، لا البريد نفسه');
  ok(await p.evaluate(() => A.mailSelf === 'owner.personal@example.org' && signature().includes('owner.personal@example.org')), 'ويُستخدم يدوياً في توقيع هذه الجلسة');
  await L.view(p, 'users'); await p.waitForTimeout(300);
  ok(!(await writes(p, 'accounts/uadmin')).some((w) => w[0] === 'set' && w[2] && w[2].name), 'لم يُحفظ حساب المسؤول من غير قصد');
  await p.click('[data-act="user-edit"][data-id="ut2"]');
  await p.fill('#uE', 'Owner.Personal@Example.org'); await save(p);
  ok(/يعود لصاحب المنصة/.test(await L.toast(p)) && !(await writes(p, 'accounts/ut2')).length, 'بريد صاحب المنصة يُرفض في حساب آخر', [await L.toast(p), await p.evaluate(() => [A.editUser, JSON.stringify(A.raw.meta.emailblock), JSON.stringify(window.__W.filter((w) => /accounts|emailblock/.test(w[1])).map((w) => w.slice(0, 2)))])]);
  await p.click('#modal [data-act="modal-close"]').catch(() => {}); await p.click('#modal [data-act="modal-force"]').catch(() => {});
  await p.evaluate(() => enqueue('notes/63857', { memo: 'تواصل: owner.personal@example.org' })); await L.flush(p);
  d = await L.dbDocs(p);
  ok(d['notes/63857'].memo === 'تواصل: ', 'ويُزال من أي كتابة في قاعدة البيانات', d['notes/63857'].memo);
  await p.evaluate((g) => enqueue('notes/63905', { memo: 'x ' + g }), GOV[1]); await L.flush(p);
  d = await L.dbDocs(p);
  ok(d['notes/63905'].memo === 'x ', 'وكذلك أي بريد tvtc.gov.sa يُكتب برمجياً', d['notes/63905'].memo);

  sec('مدرب: حفظ أو إدخال يدوي');
  const d2 = L.seed(); d2['meta/emailblock'] = d['meta/emailblock'];
  const p2 = await L.open(b, 't1', d2);
  await p2.click('#who [data-act="email-edit"]');
  await p2.fill('#emV', GOV[0]); await save(p2);
  ok(await p2.evaluate(() => { const m = document.querySelector('#emErr'); return !!m && !m.hidden && /tvtc\.gov\.sa/.test(m.textContent) && document.querySelector('#emV').getAttribute('aria-invalid') === 'true'; }) && !(await writes(p2, 'accounts/ut1')).length, 'بريد tvtc.gov.sa: رسالة واضحة في النافذة ولا يُحفظ');
  await p2.fill('#emV', 'owner.personal@example.org'); await save(p2);
  ok(/يعود لصاحب المنصة/.test(await p2.evaluate(() => document.querySelector('#emErr').textContent)), 'وبريد صاحب المنصة يُرفض للمدرب أيضاً');
  await p2.check('input[name="emM"][value="manual"]'); await p2.fill('#emV', 'trainer.manual@example.com'); await save(p2); await L.flush(p2);
  ok(await p2.evaluate(() => A.mailSelf === 'trainer.manual@example.com' && !A.me.email && signature().includes('trainer.manual@example.com')) && !(await writes(p2, 'accounts/ut1')).length, 'الإدخال اليدوي: يُستخدم في هذه الجلسة ولا يُكتب في قاعدة البيانات');
  await L.view(p2, 'alerts');
  ok(/يدوي لهذه الجلسة/.test(await L.text(p2)), 'ويظهر في صفحة الإنذار أنه يدوي غير محفوظ');
  await p2.click('#who [data-act="email-edit"]');
  await p2.check('input[name="emM"][value="save"]'); await p2.fill('#emV', 'trainer.saved@example.com'); await save(p2); await L.flush(p2);
  d = await L.dbDocs(p2);
  ok(d['accounts/ut1'].email === 'trainer.saved@example.com', 'والحفظ في الحساب لبريد مقبول');
  ok(![p, p2].some((x) => x.errs.length), 'لا أخطاء JavaScript', [p, p2].flatMap((x) => x.errs).slice(0, 4));
  await b.close();
  console.log(`\n══ استبعاد البريد: ${pass} ناجح، ${fail} فاشل ══`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
