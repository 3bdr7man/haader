/* نسخة Claude: صفحات الإدارة المركزية بلا خادم تعرض تنبيهاً واضحاً، والمزامنة تعمل محلياً دون تذكرة خادم. */
const L = require('./lib');
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };
(async () => {
  const b = await L.launch(), docs = L.seed();
  const p = await L.open(b, 'admin', docs), errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  ok(await p.evaluate(() => ['ctlops', 'ctlsync', 'taqni'].every((v) => !!document.querySelector(`#nav a[data-v="${v}"]`))), 'القائمة: الصفحات الثلاث للمسؤول');
  for (const v of ['ctlops', 'ctlsync', 'taqni']) { await p.evaluate((v) => go(v), v); await p.waitForTimeout(300); ok(/تعمل على الخادم/.test(await p.textContent('#main')), `«${v}» بلا خادم: تنبيه واضح`); }
  ok(await p.evaluate(() => !document.getElementById('bridge-src').dataset.ctlFail && /__hbChk/.test(document.getElementById('bridge-src').textContent)), 'الجسر محدّث (الإصدار 3)');
  ok(await p.evaluate(() => HAADER_CTL.ok('rayat.att_push') && HAADER_CTL.vis('rayat.grades_push')), 'بلا خادم: الخدمات متاحة كما كانت');
  const t = await L.open(b, 't1', docs);
  ok(await t.evaluate(() => !document.querySelector('#nav a[data-v="ctlops"]')), 'المدرب لا يرى صفحات الإدارة المركزية');
  ok(errs.length === 0, 'لا أخطاء JavaScript', errs);
  await b.close();
  console.log(`\n══ نسخة Claude: الإدارة المركزية: ${pass} ناجح، ${fail} فاشل ══`); if (fail) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
