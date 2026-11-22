/* نسخة Claude: صفحة «إدارة الشعب والمتدربين» بقاعدة بياناتها (دون خادم): الإدراج اليدوي، والنموذج، والسجل. */
const L = require('./lib');
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 400) : '')); } };
(async () => {
  const b = await L.launch(), docs = L.seed();
  const p = await L.open(b, 't1', docs), errs = [];
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  ok(await p.evaluate(() => !!document.querySelector('#nav a[data-v="roster"]')), 'القائمة: «إدارة الشعب والمتدربين»');
  await p.evaluate(() => go('roster')); await p.waitForSelector('.rs-actions');
  await p.click('[data-act="rs-tpl"]'); await p.click('[data-act="rs-tpl-ok"]');
  await p.waitForFunction(() => (window.__DL || []).some((d) => /نموذج إدراج الشعب والمتدربين/.test(d.filename)), null, { timeout: 30000 });
  ok(true, 'تنزيل النموذج XLSX في نسخة Claude');
  const crn = await p.evaluate(() => Object.values(A.raw.sections).find((s) => s.trainer === A.me.id).crn);
  const n0 = await p.evaluate((c) => A.raw.sections[c].rows.length, crn);
  await p.click('[data-act="rs-manual"]'); await p.waitForSelector('.rs-sec');
  await p.evaluate((c) => { const R = HAADER_RS.R; R.secs = []; R.rows = [{ k: 'x1', crn: c, id: '446950001', name: 'متدرب نسخة كلود الأول', email: '', mobile: '' }, { k: 'x2', crn: c, id: '446950002', name: 'متدرب نسخة كلود الثاني', email: '', mobile: '0551231234' }]; render(true); }, crn);
  await p.click('[data-act="rs-review"]'); await p.waitForFunction(() => HAADER_RS.R.mode === 'review');
  ok(await p.evaluate(() => HAADER_RS.R.rows.every((r) => r.st === 'ok')), 'المراجعة: صحيح');
  await p.click('[data-act="rs-apply"]'); await p.click('[data-act="rs-apply-ok"]');
  await p.waitForFunction(() => /اكتمل الإدراج/.test((document.getElementById('modal') || {}).textContent || ''), null, { timeout: 10000 });
  const r = await p.evaluate((c) => ({ n: A.raw.sections[c].rows.length, g: Object.values(A.raw.gsec || {}).filter((g) => g.crn === c || g.pair === c).every((g) => g.rows.some((x) => x.id === '446950001')), log: ((A.raw.meta.rosterlog || {}).rows || []).length, tc: (A.raw.meta.tcontacts || {})['446950002'] }), crn);
  ok(r.n === n0 + 2, 'أُضيف المتدربان إلى الشعبة', r);
  ok(r.g, 'والمزامنة إلى قائمة رصد الدرجات', r);
  ok(r.log === 1 && r.tc && r.tc.mobile === '0551231234', 'سجل العملية وبيانات الاتصال', r);
  ok(errs.length === 0, 'لا أخطاء JavaScript', errs);
  await b.close();
  console.log(`\n══ نسخة Claude: إدارة الشعب والمتدربين: ${pass} ناجح، ${fail} فاشل ══`); if (fail) process.exitCode = 1;
})().catch((e) => { console.error(e); process.exit(1); });
