const L = require('./lib.js');
const XLSX = require('/home/claude/work/tools/node_modules/xlsx');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
(async () => {
  const b = await L.launch(), docs = L.seed();
  const p = await L.open(b, 't1', docs);

  console.log('\n— السجل المحمي للتحضير —');
  const d0 = await p.evaluate(() => A.m.sections[0].dates[0]);
  const crn = await p.evaluate(() => A.m.sections[0].crn);
  const id0 = await p.evaluate(() => A.m.sections[0].rows[0].id);
  await p.evaluate(({ crn, id, d }) => setMarks([{ crn, id, d, code: 'غ' }], 'يدوي'), { crn, id: id0, d: d0 });
  await L.flush(p);
  const rows = await p.evaluate(() => gLogRows().map((r) => ({ act: r.act, crn: r.crn, id: r.id, neu: r.neu, by: r.by })));
  const att = rows.filter((r) => r.act === 'att');
  ok(att.length === 1 && att[0].crn === crn && att[0].id === id0 && att[0].neu === 'غ', 'تعديل التحضير يُكتب في السجل المحمي بالشعبة والمتدرب والقيمة');
  ok(att[0].by === 'ut1', 'السجل يحفظ من فعل التعديل');
  const old = await p.evaluate(() => ((A.raw.meta.audit || {}).rows || []).length);
  ok(old === 1, 'السجل القديم (meta/audit) ما زال يعمل كما كان: ' + old);
  const docsNow = await L.dbDocs(p);
  ok(Object.keys(docsNow).some((k) => k.startsWith('glog/')), 'السجل المحمي محفوظ في وثيقة المستخدم: ' + Object.keys(docsNow).filter((k) => k.startsWith('glog/')).join(','));
  await p.evaluate(({ crn, id, d }) => setMarks([{ crn, id, d, code: '' }], 'يدوي'), { crn, id: id0, d: d0 });
  await L.flush(p);
  ok((await p.evaluate(() => gLogRows().filter((r) => r.act === 'attdel').length)) === 1, 'مسح التحضير يُسجَّل بإجراء مستقل');

  console.log('\n— سجل الإرشاد —');
  await p.evaluate(() => audit([[new Date().toISOString(), '—', '441000001', 'الإرشاد والسلوك', '', 'مفتوحة', 'تسجيل مخالفة', 'بوصلة', A.me.name]]));
  await L.flush(p);
  ok((await p.evaluate(() => gLogRows().filter((r) => r.act === 'bosla').length)) === 1, 'إجراءات الإرشاد تُسجَّل في السجل المحمي');

  console.log('\n— واجهة السجل والتصدير —');
  await L.view(p, 'glog');
  const lg = await L.text(p);
  ok(/تعديل تحضير|مسح تحضير/.test(lg), 'سجل العمليات يعرض تعديلات التحضير بمسمى عربي');
  await p.evaluate(() => { window.__DL.length = 0; ACT['g-log-x'] ? ACT['g-log-x']() : ACT['glog-x'] && ACT['glog-x'](); });
  await p.waitForTimeout(200);

  console.log('\n— مصفوفة الصلاحيات —');
  await L.view(p, 'perms');
  const pm = await L.text(p);
  ok(/مصفوفة الصلاحيات/.test(pm) && /مدرب المقرر/.test(pm) && /رئيس القسم/.test(pm), 'الصفحة تعرض الأدوار الخمسة');
  ok(/دورك الحالي/.test(pm) && /مدرب المقرر/.test(pm), 'تُبرز دور المستخدم الحالي');
  ok(/المتدرب لا يستطيع الدخول على الرابط الحالي/.test(pm), 'تصرّح بحد الدخول الحالي');

  console.log('\n— مركز الإشعارات —');
  await L.view(p, 'inbox');
  const ib = await L.text(p);
  ok(/مركز الإشعارات/.test(ib), 'الصفحة تُعرض');
  /* يجعل أول يوم في التقويم هو اليوم، لتظهر إشعارات تحضير اليوم */
  await p.evaluate(() => { A.raw.meta.calendar.rows[0][0] = today(); rebuild(); render(true); });
  const items = await p.evaluate(() => hInbox().map((r) => r.kind));
  ok(items.length > 0, 'يجمع إشعارات فعلية: ' + [...new Set(items)].join('، '));
  ok(items.includes('تحضير'), 'يُنبّه على تحضير اليوم أو نقصه');
  ok((await p.evaluate(() => hInbox().filter((r) => r.kind === 'تحضير' && r.p === 1).length)) > 0, 'الشعبة غير المحضَّرة اليوم تظهر «عاجل»');
  const badge = await p.evaluate(() => NAV_BADGE.inbox());
  ok(typeof badge === 'number', 'شارة القائمة تعمل: ' + badge);
  const goOk = await p.evaluate(() => { const r = hInbox()[0]; ACT['h-go']({ dataset: { v: r.view, crn: r.crn || '' } }); return A.view; });
  ok(!!goOk, 'زر «افتح» ينقل إلى الواجهة المعنية: ' + goOk);

  console.log('\n— مركز تطوير حاضر والنسخة الاحتياطية —');
  const pa = await L.open(b, 'admin', docs, { uid: 'cu_uadmin' });
  await L.view(pa, 'devcenter');
  const dc = await L.text(pa);
  ok(/مركز تطوير حاضر/.test(dc) && /منفَّذ/.test(dc), 'صفحة مركز التطوير تعرض حالة البنود');
  ok(/خريطة الهيكل الحالية/.test(dc), 'تعرض خريطة الهيكل');
  ok(/ينتظر قرارك/.test(dc), 'تُظهر البنود التي تنتظر قرار المستخدم');
  await pa.evaluate(() => { window.__DL.length = 0; ACT['h-backup'](); });
  await pa.waitForFunction(() => window.__DL.length === 1, null, { timeout: 15000 });
  const bk = await pa.evaluate(() => { const t = JSON.parse(window.__DL[0].text); return { app: t.app, cols: Object.keys(t.cols).length, secs: Object.keys(t.cols.sections || {}).length, name: window.__DL[0].filename }; });
  ok(bk.app === 'haader' && bk.cols >= 18 && bk.secs === 8, `النسخة الاحتياطية تضم كل المجموعات: ${bk.cols} مجموعة، ${bk.secs} شعبة`);
  ok(/نسخة احتياطية - منصة حاضر/.test(bk.name), 'اسم ملف واضح');
  ok((await pa.evaluate(() => gLogRows().filter((r) => r.act === 'backup').length)) === 1, 'التصدير الشامل يُسجَّل في سجل التدقيق');

  console.log('\n— الصلاحيات —');
  const pv = await L.open(b, 'viewer', docs, { uid: 'cu_uview' });
  await L.view(pv, 'devcenter');
  ok(!/تصدير نسخة احتياطية الآن/.test(await L.text(pv)), 'حساب الاطلاع لا يرى زر النسخة الاحتياطية');
  await pv.evaluate(() => ACT['h-backup']());
  await pv.waitForTimeout(200);
  ok((await pv.evaluate(() => window.__DL.length)) === 0, 'النسخة الاحتياطية لا تُصدَّر لغير المسؤول');
  const nav = await pv.evaluate(() => [...document.querySelectorAll('#nav a')].map((a) => a.dataset.v));
  ok(nav.includes('inbox') && nav.includes('perms') && !nav.includes('devcenter'), 'القائمة: الإشعارات والمصفوفة للجميع، ومركز التطوير للمسؤول');

  const errs = [...p.errs, ...pa.errs, ...pv.errs].filter((e) => !/ResizeObserver/.test(e));
  ok(!errs.length, 'لا أخطاء في الصفحة: ' + (errs[0] || '—'));
  await b.close();
  console.log(`\n══ ${pass} ناجح، ${fail} فاشل ══`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
