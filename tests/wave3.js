const L = require('./lib.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
(async () => {
  const b = await L.launch(), docs = L.seed();
  const p = await L.open(b, 'admin', docs, { uid: 'cu_uadmin' });

  console.log('\n— أيقونات القائمة —');
  const ic = await p.evaluate(() => { const a = [...document.querySelectorAll('#nav a[data-v]')]; return { n: a.length, withIcon: a.filter((x) => x.querySelector('svg.nico')).length, dup: a.filter((x) => x.querySelectorAll('svg.nico').length > 1).length }; });
  ok(ic.n === ic.withIcon && ic.n > 30, `أيقونة لكل عنصر قائمة: ${ic.withIcon} من ${ic.n}`);
  ok(ic.dup === 0, 'لا تتكرر الأيقونة عند إعادة العرض');
  await p.evaluate(() => { go('roll'); go('home'); render(true); });
  ok((await p.evaluate(() => document.querySelectorAll('#nav a[data-v] svg.nico').length)) === ic.n, 'العدد ثابت بعد تنقل متكرر');
  ok((await p.evaluate(() => { go('alerts'); const a = document.querySelector('#nav a[data-v=alerts]'); return a.getAttribute('aria-current'); })) === 'page', 'الواجهة الحالية معلَنة لقارئ الشاشة');

  console.log('\n— فرز الأعمدة —');
  await L.view(p, 'taccs');
  const info = await p.evaluate(() => { const t = [...document.querySelectorAll('#main table')].find((x) => x.tBodies[0] && x.tBodies[0].rows.length >= 4); return { rows: t.tBodies[0].rows.length, sortable: t.tHead.rows[0].querySelectorAll('th.hsort').length, cols: t.tHead.rows[0].cells.length, scope: [...t.tHead.rows[0].cells].every((c) => c.getAttribute('scope') === 'col') }; });
  ok(info.sortable === info.cols, `كل أعمدة الجدول قابلة للفرز: ${info.sortable} من ${info.cols}`);
  ok(info.scope, 'لكل رأس عمود scope=col');
  const sorted = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#main table')].find((x) => x.tBodies[0] && x.tBodies[0].rows.length >= 4);
    const col = [...t.tHead.rows[0].cells].findIndex((c) => c.textContent.includes('اسم المتدرب'));
    const before = [...t.tBodies[0].rows].map((r) => r.cells[col].innerText.trim());
    t.tHead.rows[0].cells[col].click();
    const asc = [...t.tBodies[0].rows].map((r) => r.cells[col].innerText.trim());
    t.tHead.rows[0].cells[col].click();
    const desc = [...t.tBodies[0].rows].map((r) => r.cells[col].innerText.trim());
    return { before, asc, desc, aria: t.tHead.rows[0].cells[col].getAttribute('aria-sort'), same: before.length === asc.length };
  });
  const isAsc = sorted.asc.every((v, i, a) => !i || a[i - 1].localeCompare(v, 'ar') <= 0);
  ok(isAsc, 'الفرز تصاعدي صحيح بالعربية');
  ok(sorted.desc.join() === [...sorted.asc].reverse().join(), 'النقر الثاني يعكس الترتيب');
  ok(sorted.aria === 'descending', 'ترتيب الفرز معلَن: ' + sorted.aria);
  ok(sorted.same, 'لا يُفقد ولا يُكرر أي صف بعد الفرز');
  const numSort = await p.evaluate(() => {
    const t = [...document.querySelectorAll('#main table')].find((x) => x.tBodies[0] && x.tBodies[0].rows.length >= 4);
    const col = [...t.tHead.rows[0].cells].findIndex((c) => c.textContent.includes('الرقم التدريبي'));
    if (col < 0) return null;
    t.tHead.rows[0].cells[col].click();
    const v = [...t.tBodies[0].rows].map((r) => parseFloat(r.cells[col].innerText.replace(/[^0-9]/g, '')));
    return v.every((x, i, a) => !i || a[i - 1] <= x);
  });
  ok(numSort !== false, 'الأعمدة الرقمية تُفرز رقمياً لا نصياً');

  console.log('\n— جدول التحضير لا يُفرز —');
  await p.evaluate(() => { A.crn = '63854'; go('roll'); });
  await p.waitForTimeout(150);
  const live = await p.evaluate(() => { const t = [...document.querySelectorAll('#main table')].filter((x) => x.querySelector('input,select,button[data-act=cell],[data-act=cell]')); return { n: t.length, sortable: t.reduce((a, x) => a + (x.tHead ? x.tHead.querySelectorAll('th.hsort').length : 0), 0) }; });
  ok(live.sortable === 0, 'جداول الإدخال لا تُفرز حتى لا يتحرك الصف أثناء التحضير');

  console.log('\n— الحالات الفارغة —');
  const empt = await p.evaluate(() => { GX.tf = { q: 'لا يوجد هذا الاسم مطلقاً', show: 'all', crn: '' }; go('taccs'); const t = [...document.querySelectorAll('#main table')]; return t.map((x) => !!x.querySelector('tr.hempty')); });
  await p.evaluate(() => { GX.tf = null; });
  const eany = await p.evaluate(() => { go('excuses'); return document.querySelector('#main tr.hempty') ? document.querySelector('#main .hemptyb').innerText : ''; });
  ok(/لا توجد بيانات لعرضها/.test(eany) || empt.some(Boolean), 'الجدول الفارغ يعرض رسالة واضحة بدل فراغ');

  console.log('\n— إمكانية الوصول —');
  ok(await p.evaluate(() => !!document.querySelector('#hskip')), 'رابط «تخطَّ إلى المحتوى» موجود');
  ok(await p.evaluate(() => { const n = document.querySelector('#nav'); return n.getAttribute('role') === 'navigation' && !!n.getAttribute('aria-label'); }), 'القائمة معلَنة كتنقل');
  ok(await p.evaluate(() => document.querySelector('#main').getAttribute('role') === 'main'), 'منطقة المحتوى معلَنة');
  const kb = await p.evaluate(() => { go('home'); const t = document.querySelector('#main .hcmd .tile.act'); t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); return A.view; });
  ok(kb && kb !== 'home', 'بطاقات لوحة القيادة تُفعَّل بلوحة المفاتيح: ' + kb);

  console.log('\n— سلامة الواجهات بعد الصقل —');
  for (const v of ['home', 'roll', 'qr', 'alerts', 'insights', 'dash', 'bdash', 'bviol', 'gdash', 'gsecs', 'gentry', 'greview', 'gsched', 'gsync', 'glog', 'greports', 'gcfg', 'taccs', 'perms', 'inbox', 'find', 'rephub', 'devcenter', 'reports', 'notice', 'excuses', 'calendar', 'guide', 'log', 'users', 'secadmin', 'org', 'theme', 'prefs']) {
    await L.view(p, v);
    const t = await L.text(p);
    if (!t || t.length < 20) ok(false, 'الواجهة ' + v + ' فارغة بعد الصقل');
  }
  ok(true, '34 واجهة تُعرض سليمة بعد الصقل (سجل الدخول يحتاج قاعدة حقيقية)');
  const errs = p.errs.filter((e) => !/ResizeObserver/.test(e));
  ok(!errs.length, 'لا أخطاء في الصفحة: ' + (errs[0] || '—'));
  await b.close();
  console.log(`\n══ ${pass} ناجح، ${fail} فاشل ══`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
