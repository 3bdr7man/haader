// اختبار المظهر المطوّر (v2): كل الواجهات تعمل بلا أخطاء ولا تمرير أفقي على الحاسب والآيباد والهاتف،
// والشريط العلوي ونافذة الملف الشخصي تعمل، والرجوع إلى المظهر الكلاسيكي يعيد المظهر السابق ويُحفظ.
const { chromium, devices } = require('playwright');
const L = require('./lib');
const { check } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);

(async () => {
  const b = await chromium.launch(), errs = [];
  const open = async (o) => {
    const c = await b.newContext(Object.assign({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA' }, o)); const p = await c.newPage();
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await p.goto(URL0); await p.waitForSelector('#liU'); await p.fill('#liU', 'aalkhathami'); await p.fill('#liP', 'Admin#2026x'); await p.click('#liB');
    await p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh, null, { timeout: 30000 });
    return [c, p];
  };
  for (const [name, o] of [['الحاسب', { viewport: { width: 1440, height: 900 } }], ['الآيباد', devices['iPad Pro 11']], ['الهاتف', devices['iPhone 13']]]) {
    const [c, p] = await open(o);
    check(`${name}: المظهر المطوّر مفعّل افتراضياً`, await p.evaluate(() => document.documentElement.dataset.look) === 'v2');
    const views = await p.evaluate(() => [...document.querySelectorAll('#nav a[data-v]')].map((a) => a.dataset.v));
    const bad = [], wide = [];
    for (const v of views) {
      const before = errs.length;
      await p.evaluate((x) => go(x), v); await p.waitForTimeout(250);
      if (errs.length > before) bad.push(v);
      const ov = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (ov > 1) wide.push(`${v} (${ov}px)`);
    }
    check(`${name}: ${views.length} واجهة بلا أخطاء`, !bad.length, bad);
    check(`${name}: لا تمرير أفقي للصفحة`, !wide.length, wide);
    if (name === 'الحاسب') {
      await p.evaluate(() => go('home')); await p.waitForTimeout(300);
      const tb = await p.evaluate(() => { const t = document.getElementById('topbar'); return { vis: getComputedStyle(t).display !== 'none', txt: t.textContent }; });
      check('الشريط العلوي ظاهر بعنوان الصفحة والتاريخ', tb.vis && /الرئيسية/.test(tb.txt) && /1448/.test(tb.txt), tb);
      check('أيقونات البطاقات الإحصائية', await p.evaluate(() => document.querySelectorAll('#main .tile .v2-ic').length) > 5);
      await p.click('#topbar [data-v2prof]');
      const pf = await p.evaluate(() => { const e = document.getElementById('v2prof'); return { shown: !e.hidden, txt: e.textContent }; });
      check('نافذة الملف الشخصي: الاسم والدور واسم المستخدم والقسم', pf.shown && /مسؤول المنصة/.test(pf.txt) && /aalkhathami/.test(pf.txt) && /قسم الحاسب/.test(pf.txt), pf.txt.slice(0, 120));
      await p.keyboard.press('Escape');
      check('Esc يغلق نافذة الملف الشخصي', await p.evaluate(() => document.getElementById('v2prof').hidden));
      await p.click('#topbar [data-v2prof]'); await p.click('#v2prof [data-act="change-pw"]'); await p.waitForTimeout(300);
      check('أزرار الملف الشخصي تنفّذ وظائفها الأصلية (كلمة المرور)', await p.evaluate(() => !document.getElementById('modal').hidden && document.getElementById('v2prof').hidden));
      await p.evaluate(() => closeModal());
      // الرجوع إلى المظهر الكلاسيكي
      await p.click('#topbar [data-v2prof]'); await p.click('#v2prof [data-v2look]');
      const cl = await p.evaluate(() => ({ look: document.documentElement.dataset.look, top: getComputedStyle(document.getElementById('topbar')).display, ic: getComputedStyle(document.querySelector('.v2-ic') || document.body).display, rad: getComputedStyle(document.querySelector('.panel')).borderRadius }));
      check('المظهر الكلاسيكي: يختفي الشريط العلوي والأيقونات وتعود اللوحات كما كانت', cl.look === 'classic' && cl.top === 'none' && cl.ic === 'none' && cl.rad === '18px', cl);
      await p.reload(); await p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh, null, { timeout: 30000 });
      check('اختيار المظهر يُحفظ بعد إعادة التحميل', await p.evaluate(() => document.documentElement.dataset.look) === 'classic');
      check('زر الملف الشخصي متاح في المظهر الكلاسيكي لإعادة التفعيل', await p.evaluate(() => getComputedStyle(document.querySelector('#who .v2-av')).display !== 'none'));
      await p.click('#who [data-v2prof]'); await p.click('#v2prof [data-v2look]');
      check('إعادة تفعيل المظهر المطوّر', await p.evaluate(() => document.documentElement.dataset.look) === 'v2');
    }
    if (name === 'الهاتف') {
      await p.click('#who [data-v2prof]');
      check('الهاتف: نافذة الملف الشخصي داخل الشاشة', await p.evaluate(() => { const r = document.getElementById('v2prof').getBoundingClientRect(); return !document.getElementById('v2prof').hidden && r.left >= 0 && r.right <= innerWidth; }));
    }
    await c.close();
  }
  // تقليل الحركة: لا حركات
  const [c, p] = await open({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  await p.evaluate(() => go('roll')); await p.waitForTimeout(100);
  check('تقليل الحركة يُحترم', await p.evaluate(() => getComputedStyle(document.querySelector('#main > *')).animationName) === 'none');
  await c.close();
  check('لا أخطاء JavaScript', !errs.length, errs.slice(0, 5));
  await b.close();
  L.done('المظهر المطوّر');
})().catch((e) => { console.error(e); process.exit(1); });
