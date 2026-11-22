// إدارة ظهور الدرجات: الخادم يحجب المخفي عن المتدرب، والصلاحيات، والجدولة، وواجهة المدرب. يُشغَّل بعد e2e.test.js.
const { chromium } = require('playwright');
const L = require('./lib');
const { sql, check } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const q = (o) => JSON.stringify(o).replace(/'/g, "''");
(async () => {
  const tid = sql(`select r->>'id' from doc s, jsonb_array_elements(s.data->'rows') r where s.col='sections' order by 1 limit 1`);
  const a = await L.login('aalkhathami', 'Admin#2026x'), t1 = await L.login('t.ahmed', 'Trainer1-pass');
  check('دخول المسؤول والمدرب', a.ok && t1.ok);
  const its = [{ n: 'الواجبات', max: 6 }, { n: 'المشاركة', max: 4 }, { n: 'الشهري 1', max: 10 }, { n: 'الشهري 2', max: 10 }];
  const gsec = { crn: '99001', code: 'شبكا 121', name: 'مقرر ظهور تجريبي', term: 'الفصل التدريبي الأول 1448هـ',
    comps: [{ k: 'LAB1', max: 30, part: 'عملي', desc: 'أعمال فصلية' }, { k: 'LAB2', max: 20, part: 'عملي', desc: 'نهائي' }, { k: 'LEC1', max: 30, part: 'نظري', desc: 'أعمال فصلية' }, { k: 'LEC2', max: 20, part: 'نظري', desc: 'نهائي' }],
    items: { LEC1: its, LAB1: its }, rows: [{ id: tid, name: 'متدرب', el: true, st: 'مسجل' }] };
  const gm = { g: { [tid]: { LEC1: 25, LEC2: 17, LAB1: 24, LAB2: 13 } }, s: { [tid]: { LEC1: { 'الواجبات': 5, 'المشاركة': 4, 'الشهري 1': 8, 'الشهري 2': 8 }, LAB1: { 'الواجبات': 6, 'المشاركة': 4, 'الشهري 1': 7, 'الشهري 2': 7 } } } };
  sql(`select set_config('haader.sys','1',false); delete from doc where col in ('gsec','gmarks','gvis') and id='99001'; insert into doc(col,id,data) values ('gsec','99001','${q(gsec)}'::jsonb),('gmarks','99001','${q(gm)}'::jsonb);`);
  const marks0 = sql(`select data::text from doc where col='gmarks' and id='99001'`);
  const view = async () => ((await L.rpc('trainee_preview', { p_id: tid }, a.token)).body.grades || {})['99001'];
  let g = await view();
  check('بلا إعداد: كل الدرجات ظاهرة كما كانت', g && g.g.LEC2 === 17 && g.g.LEC1 === 25 && g.s.LEC1['الشهري 2'] === 8 && g.hid.length === 0, g);

  // 1) إخفاء النهائي النظري وبند من أعمال الفصل النظري، والدرجة النهائية
  let r = await L.docSet('gvis', '99001', { v: { 'c:LEC2': { on: false }, 'i:LEC1:الشهري 2': { on: false }, total: { on: false } } }, a.token);
  check('المسؤول يحفظ الإعداد', r.ok, r.status);
  g = await view();
  check('النهائي النظري لا يصل إلى المتدرب', g && !('LEC2' in g.g) && g.hid.includes('c:LEC2'), g && g.g);
  check('النهائي العملي يبقى ظاهراً مستقلاً', g && g.g.LAB2 === 13, g && g.g);
  check('البند المخفي لا يصل، وبقية البنود تصل', g && !('الشهري 2' in g.s.LEC1) && g.s.LEC1['الشهري 1'] === 8 && g.hid.includes('i:LEC1:الشهري 2'), g && g.s);
  check('إجمالي أعمال الفصل النظري يُحجب حتى لا يُستنتج البند المخفي منه', g && !('LEC1' in g.g) && g.g.LAB1 === 24, g && g.g);
  check('الدرجة النهائية للمقرر مخفية', g && g.hid.includes('total'));
  check('لا تظهر القيمة المخفية في أي موضع من الرد', !JSON.stringify(g.g).includes('17') && !/"الشهري 2":8/.test(JSON.stringify(g.s.LEC1)), g);
  check('الإخفاء لا يمس الدرجات المحفوظة', sql(`select data::text from doc where col='gmarks' and id='99001'`) === marks0);

  // 2) العكس: إخفاء العملي وحده
  await L.docSet('gvis', '99001', { v: { 'c:LAB2': { on: false } } }, a.token); g = await view();
  check('إخفاء النهائي العملي لا يخفي النهائي النظري', g && !('LAB2' in g.g) && g.g.LEC2 === 17 && g.g.LEC1 === 25, g && g.g);

  // 3) الجدولة: ما حلّ وقته يُطبَّق، والقادم لا
  const past = new Date(Date.now() - 60000).toISOString(), fut = new Date(Date.now() + 3600e3).toISOString();
  await L.docSet('gvis', '99001', { v: { 'c:LEC2': { on: false }, 'c:LAB2': { on: false } }, sched: [{ id: 's1', at: past, set: { 'c:LEC2': true } }, { id: 's2', at: fut, set: { 'c:LAB2': true } }] }, a.token);
  g = await view();
  check('الجدولة التي حلّ وقتها تُظهر الدرجة الأصلية', g && g.g.LEC2 === 17, g && g.g);
  check('الجدولة القادمة لا تُظهر قبل وقتها', g && !('LAB2' in g.g), g && g.g);

  // 4) الصلاحيات والوصول المباشر
  const crnMine = sql(`select id from doc where col='sections' and data->>'trainer'='utrain00000000001' order by 1 limit 1`), crnOther = sql(`select id from doc where col='sections' and data->>'trainer'='utrain00000000002' order by 1 limit 1`);
  r = await L.docSet('gvis', crnMine, { v: { 'c:LEC2': { on: false } } }, t1.token);
  check('المدرب يحفظ إعداد شعبته', r.ok && sql(`select crn from doc where col='gvis' and id='${crnMine}'`) === crnMine, r.status);
  r = await L.docSet('gvis', crnOther, { v: { 'c:LEC2': { on: false } } }, t1.token);
  check('المدرب لا يعدّل إعداد شعبة غير مسندة إليه', !r.ok && sql(`select count(*) from doc where col='gvis' and id='${crnOther}'`) === '0', r.status);
  r = await L.docSet('gvis', crnMine, { crn: crnOther, v: {} }, t1.token);
  check('ولا بتغيير رقم الشعبة داخل الوثيقة', sql(`select crn from doc where col='gvis' and id='${crnMine}'`) === crnMine);
  const an = await L.docGet('gmarks', '99001'), av = await L.docGet('gvis', '99001'), ag = await L.rpc('trainee_grades', { t: tid });
  check('بلا دخول: لا وصول مباشر إلى الدرجات ولا إلى إعداد الظهور ولا إلى دالة الدرجات', (!an.ok || !an.body.length) && (!av.ok || !av.body.length) && !ag.ok, [an.status, av.status, ag.status]);
  const tq = await L.rpc('trainee_grades', { t: tid }, t1.token);
  check('ولا من حساب مدرب', !tq.ok, tq.status);

  // 5) الواجهة: إدارة الظهور من حساب المسؤول، والمعاينة، وبوابة المتدرب
  sql(`select set_config('haader.sys','1',false); delete from doc where col='gvis' and id='99001';`);
  const b = await chromium.launch(), errs = [];
  const c = await b.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 1366, height: 860 } }), p = await c.newPage();
  p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
  await p.goto(URL0); await p.waitForSelector('#liU'); await p.fill('#liU', 'aalkhathami'); await p.fill('#liP', 'Admin#2026x'); await p.click('#liB');
  await p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh && A.raw.gsec['99001'], null, { timeout: 30000 });
  check('القائمة: «إدارة ظهور الدرجات» في مجموعة الدرجات', await p.evaluate(() => !!document.querySelector('#nav a[data-v="gvis"]')));
  await p.evaluate(() => go('gvis')); await p.click('[data-act="gv-sec"][data-crn="99001"]');
  const ui = await p.evaluate(() => [...document.querySelectorAll('.gvtab tbody tr')].map((tr) => tr.cells[0].innerText.split('\n')[0].replace('↳', '').trim()));
  check('قائمة المعايير ديناميكية من توزيع الشعبة (البنود، الإجمالي، النهائيان، الدرجة النهائية)', ui.includes('الاختبار الشهري الأول — النظري') && ui.includes('إجمالي درجات أعمال الفصل — النظري') && ui.includes('الاختبار النهائي النظري') && ui.includes('الاختبار النهائي العملي') && ui.includes('الدرجة النهائية للمقرر') && ui.length === 13, ui);
  await p.click('[data-act="gv-tg"][data-k="c:LEC2"]');
  check('التبديل لا يُطبَّق قبل الحفظ', await p.evaluate(() => /تغييراً غير محفوظ/.test(document.getElementById('main').innerText)) && sql(`select count(*) from doc where col='gvis' and id='99001'`) === '0');
  await p.click('[data-act="gv-pv"]'); await p.waitForSelector('#modal .gvpv');
  const pv = await p.evaluate(() => document.querySelector('#modal .gvpv').innerText);
  check('معاينة واجهة المتدرب قبل الحفظ: «الدرجة غير متاحة حالياً» مكان النهائي النظري', /الدرجة غير متاحة حالياً/.test(pv), pv.slice(0, 300));
  await p.click('#modal [data-act="modal-close"]');
  await p.click('[data-act="gv-save"]'); await p.waitForSelector('#modal [data-act="gv-save-ok"]');
  check('تأكيد قبل الحفظ يذكر التغيير', /إخفاء/.test(await p.textContent('#modal')) && /الاختبار النهائي النظري/.test(await p.textContent('#modal')));
  await p.click('#modal [data-act="gv-save-ok"]');
  await p.waitForFunction(() => true); await p.waitForTimeout(1500);
  const saved = JSON.parse(sql(`select coalesce((select data from doc where col='gvis' and id='99001'), '{}'::jsonb)::text`));
  check('حُفظ في قاعدة البيانات بهوية المعدِّل ووقته', saved.v && saved.v['c:LEC2'] && saved.v['c:LEC2'].on === false && saved.v['c:LEC2'].byName && saved.v['c:LEC2'].at && saved.crn === '99001', saved.v && saved.v['c:LEC2']);
  g = await view();
  check('ينعكس على المتدرب فور الحفظ', g && !('LEC2' in g.g) && g.g.LAB2 === 13, g && g.g);
  await p.waitForTimeout(800);
  check('سجل العمليات: سطر لكل تعديل ظهور', await p.evaluate(() => gLogRows().some((r) => r.act === 'vis' && r.crn === '99001')));
  // الإعداد السابق
  await p.evaluate(() => render(true)); await p.click('[data-act="gv-prev"]'); await p.click('#modal [data-act="gv-prev-ok"]'); await p.waitForTimeout(1500);
  g = await view();
  check('إعادة الإعداد السابق تُظهر القيمة الأصلية المحفوظة (17)', g && g.g.LEC2 === 17, g && g.g);
  // إخفاء الكل ثم بوابة المتدرب في معاينة المسؤول
  await p.click('[data-act="gv-all"][data-on="0"]'); await p.click('[data-act="gv-save"]'); await p.click('#modal [data-act="gv-save-ok"]'); await p.waitForTimeout(1500);
  g = await view();
  check('إخفاء جميع الدرجات: لا تصل أي درجة', g && Object.keys(g.g).length === 0 && Object.keys(g.s).length === 0 && g.hid.includes('total'), g);
  check('والدرجات المحفوظة كما هي', sql(`select data::text from doc where col='gmarks' and id='99001'`) === marks0);
  await p.click('[data-act="gv-all"][data-on="1"]'); await p.click('[data-act="gv-save"]'); await p.click('#modal [data-act="gv-save-ok"]'); await p.waitForTimeout(1500);
  g = await view();
  check('إظهار جميع الدرجات يعيدها كما هي', g && g.g.LEC2 === 17 && g.g.LEC1 === 25 && g.s.LEC1['الشهري 2'] === 8 && g.hid.length === 0, g);
  check('لا أخطاء JavaScript', errs.length === 0, errs);
  await b.close();
  sql(`select set_config('haader.sys','1',false); delete from doc where col in ('gsec','gmarks','gvis') and id='99001'; delete from doc where col='gvis' and id='${crnMine}';`);
  L.done('إدارة ظهور الدرجات');
})().catch((e) => { console.error(e); process.exit(1); });
