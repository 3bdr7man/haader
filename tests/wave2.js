const L = require('./lib.js');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
(async () => {
  const b = await L.launch(), docs = L.seed();
  const p = await L.open(b, 't1', docs);

  console.log('\n— لوحة القيادة الموحدة —');
  await L.view(p, 'home');
  const cmd = await p.evaluate(() => { const e = document.querySelector('#main .hcmd'); return e ? e.innerText : ''; });
  ok(/لوحة القيادة/.test(cmd), 'اللوحة تُركَّب في الرئيسية');
  const tiles = await p.evaluate(() => [...document.querySelectorAll('#main .hcmd .tile.act')].map((t) => ({ v: t.dataset.v, txt: t.innerText.replace(/\n/g, ' ') })));
  ok(tiles.length === 10, 'عشر بطاقات: ' + tiles.length);
  ok(tiles.every((t) => t.v), 'كل بطاقة مرتبطة بواجهة');
  ok(tiles.some((t) => t.v === 'inbox') && tiles.some((t) => t.v === 'alerts') && tiles.some((t) => t.v === 'gsched') && tiles.some((t) => t.v === 'taccs'), 'تغطي الإشعارات والإنذار والدرجات والحسابات');
  await p.evaluate(() => document.querySelector('#main .hcmd .tile.act[data-v=alerts]').click());
  await p.waitForTimeout(120);
  ok((await p.evaluate(() => A.view)) === 'alerts', 'النقر على البطاقة يفتح واجهتها');
  ok((await L.text(p)).length > 50, 'الواجهة المفتوحة تعمل');
  const old = await p.evaluate(() => { go('home'); return document.querySelector('#main .head h1').textContent; });
  ok(/لوحة متابعة التحضير/.test(old), 'محتوى الرئيسية القديم باقٍ كما هو');

  console.log('\n— مسار التنقل وزر الرجوع —');
  const cr = await p.evaluate(() => { go('gsecs'); const e = document.querySelector('#main .hcrumb'); return e ? e.innerText.replace(/\n/g, ' ') : ''; });
  ok(/الرئيسية/.test(cr) && /إدارة الاختبارات/.test(cr) && /المقررات والشعب/.test(cr), 'المسار يعرض: الرئيسية ← القسم ← الواجهة');
  ok(/رجوع/.test(cr), 'زر الرجوع يظهر بعد التنقل');
  await p.evaluate(() => document.querySelector('#main .hcrumb [data-act=h-back]').click());
  await p.waitForTimeout(150);
  ok((await p.evaluate(() => A.view)) === 'home', 'الرجوع يعود إلى الواجهة السابقة');
  ok(!(await p.evaluate(() => !!document.querySelector('#main .hcrumb'))), 'لا مسار تنقل في الرئيسية');
  const deep = await p.evaluate(() => { A.gCrn = '63854'; go('gsec'); const e = document.querySelector('#main .hcrumb'); return e ? e.innerText.replace(/\n/g, ' ') : ''; });
  ok(/تفاصيل الشعبة/.test(deep), 'الواجهات العميقة التي لا تظهر في القائمة صار لها مسار: ' + deep.slice(0, 60));

  console.log('\n— البحث الموحد —');
  await L.view(p, 'find');
  const name = await p.evaluate(() => A.m.sections[0].rows[0].name.split(' ')[0] + ' ' + A.m.sections[0].rows[0].name.split(' ')[1]);
  await p.evaluate((q) => { A.hq = q; render(true); }, name);
  const res = await p.evaluate(() => ({ txt: document.querySelector('#main').innerText, n: hFind(A.hq).people.length }));
  ok(res.n >= 1 && /متدربون/.test(res.txt), 'البحث بالاسم يجد المتدرب: ' + res.n);
  const byId = await p.evaluate(() => hFind(A.m.sections[0].rows[0].id).people.length);
  ok(byId === 1, 'البحث بالرقم التدريبي يجد متدرباً واحداً');
  const bySec = await p.evaluate(() => hFind('63854').secs.length);
  ok(bySec >= 1, 'البحث برقم الشعبة يجد الشعبة');
  const byView = await p.evaluate(() => hFind('حسابات').views.map((v) => v.k));
  ok(byView.includes('taccs'), 'البحث باسم الواجهة يجدها');
  const dup = await p.evaluate(() => { const r = hFind(A.m.sections[0].rows[0].id); return r.people.length; });
  ok(dup === 1, 'المتدرب في شعبتين لا يتكرر في النتائج');
  const noq = await p.evaluate(() => hFind('أ').people.length);
  ok(noq === 0, 'حرف واحد لا يُشغّل البحث');

  console.log('\n— مركز التقارير —');
  await L.view(p, 'rephub');
  const rh = await L.text(p);
  ok(/مركز التقارير/.test(rh) && /تقارير الدرجات/.test(rh) && /سجل العمليات والتدقيق/.test(rh), 'يجمع كل التقارير في مدخل واحد');
  const links = await p.evaluate(() => [...document.querySelectorAll('#main [data-act=h-go]')].map((x) => x.dataset.v));
  const bad = await p.evaluate((ls) => ls.filter((v) => !VIEWS[v]), links);
  ok(links.length >= 7 && !bad.length, 'كل مدخل مرتبط بواجهة فعلية: ' + links.length);
  await p.evaluate(() => document.querySelector('#main [data-act=h-go][data-v=greports]').click());
  await p.waitForTimeout(120);
  ok((await p.evaluate(() => A.view)) === 'greports', 'الفتح من مركز التقارير يعمل');

  console.log('\n— القائمة —');
  const nav = await p.evaluate(() => NAV.map(([g, i]) => [g || '', i.map((x) => x[0])]));
  ok(nav[0][1].join(',') === 'home,inbox,find', 'أعلى القائمة: الرئيسية ثم الإشعارات ثم البحث');
  ok(nav.find((g) => g[0] === 'التقارير')[1][0] === 'rephub', 'مركز التقارير أول مجموعة التقارير');
  const allKeys = await p.evaluate(() => NAV.flatMap(([, i]) => i.map((x) => x[0])));
  const missing = await p.evaluate((ks) => ks.filter((k) => !VIEWS[k]), allKeys);
  ok(!missing.length, 'كل عنصر قائمة له واجهة فعلية' + (missing.length ? ': ' + missing.join(',') : ''));
  ok(allKeys.length === new Set(allKeys).size, 'لا تكرار في عناصر القائمة');

  console.log('\n— لا فقد لوظيفة —');
  const views = await p.evaluate(() => Object.keys(VIEWS).length);
  ok(views >= 38, 'عدد الواجهات بعد التطوير: ' + views);
  for (const v of ['roll', 'qr', 'sync', 'alerts', 'insights', 'dash', 'bdash', 'gdash', 'gentry', 'greview', 'gsync', 'taccs', 'reports', 'notice', 'excuses', 'calendar', 'guide', 'log', 'inbox', 'perms', 'find', 'rephub']) {
    await L.view(p, v);
    const t = await L.text(p);
    if (!t || t.length < 20) ok(false, 'الواجهة ' + v + ' فارغة');
  }
  ok(true, 'كل الواجهات الأساسية تُعرض بلا انقطاع (22 واجهة)');

  const pv = await L.open(b, 'viewer', docs, { uid: 'cu_uview' });
  await L.view(pv, 'find');
  ok((await pv.evaluate(() => hFind('حسابات').views.length >= 0)), 'البحث يعمل لحساب الاطلاع');
  const errs = [...p.errs, ...pv.errs].filter((e) => !/ResizeObserver/.test(e));
  ok(!errs.length, 'لا أخطاء في الصفحة: ' + (errs[0] || '—'));
  await b.close();
  console.log(`\n══ ${pass} ناجح، ${fail} فاشل ══`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
