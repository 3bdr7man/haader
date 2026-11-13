/* اختبار حسابات المتدربين: ثبات الرقم التدريبي، تشفير كلمات المرور، خلو المصنف المتداول منها، الملكية */
const L = require('./lib.js');
const XLSX = require('/home/claude/work/tools/node_modules/xlsx');
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };
const grab = async (p, i = 0) => Buffer.from(await p.evaluate(async (k) => Array.from(new Uint8Array(await window.__DL[k].blob.arrayBuffer())), i));
const sheets = (buf) => { const wb = XLSX.read(buf); return Object.fromEntries(wb.SheetNames.map((n) => [n, XLSX.utils.sheet_to_csv(wb.Sheets[n])])); };

(async () => {
  const b = await L.launch();
  const docs = L.seed();
  const shared = { id: '441999001', name: 'متدرب مشترك تجريبي' };
  docs['sections/63854'].rows.push(shared); docs['sections/63856'].rows.push(shared);
  const p = await L.open(b, 't1', docs);
  await L.view(p, 'taccs');

  console.log('\n— القائمة والحصر —');
  ok(await p.evaluate(() => !!document.querySelector('#nav a[data-v=taccs]')), 'عنصر «حسابات المتدربين» في قائمة الأدوات');
  const r = await p.evaluate(() => tRoster().map((t) => ({ id: t.id, n: t.secs.length })));
  ok(r.filter((x) => x.id === shared.id).length === 1 && r.find((x) => x.id === shared.id).n === 2, 'المتدرب المسجل في شعبتين يظهر مرة واحدة بشعبتيه');
  ok(!r.some((x) => x.id.includes('6390') || x.id.includes('6391')), 'لا تظهر متدربات شعب مدرب آخر (63905/63912)');
  ok((await L.text(p)).includes('إجمالي المتدربين'), 'لوحة المؤشرات تظهر');
  ok((await L.text(p)).includes('بوابة المتدرب لا تعمل على الرابط الحالي'), 'تنبيه صريح بأن الدخول لا يعمل على الرابط الحالي');

  console.log('\n— إنشاء الحسابات —');
  await p.evaluate(() => ACT['t-make']());
  await p.waitForSelector('#tmC');
  const courses = await p.evaluate(() => [...document.querySelectorAll('#tmC option')].map((o) => o.textContent));
  ok(courses.length >= 2, 'يمكن اختيار مقرر واحد أو كل المقررات: ' + courses.length);
  await p.evaluate(() => ACT['t-make-go']());
  await p.waitForFunction(() => document.querySelector('#modal') && /تظهر مرة واحدة/.test(document.querySelector('#modal').innerText), null, { timeout: 15000 });
  await L.flush(p);
  const made = await p.evaluate(() => A.tMade.map((m) => ({ id: m.id, pw: m.pw })));
  const n0 = await p.evaluate(() => Object.keys(A.raw.tacc).length);
  ok(made.length === r.length && n0 === r.length, `أُنشئ حساب لكل متدرب (${n0} من ${r.length})`);
  ok(made.every((m) => m.pw.length >= 9 && /[A-Za-z]/.test(m.pw) && /\d/.test(m.pw)), 'كلمات المرور قوية: حروف وأرقام وطول كافٍ');
  ok(new Set(made.map((m) => m.pw)).size === made.length, 'كلمة مرور مختلفة لكل متدرب');
  ok(made.every((m) => !m.pw.includes(m.id) && !m.id.includes(m.pw.replace('-', '')) && m.pw !== m.id), 'كلمة المرور غير مشتقة من الرقم التدريبي');
  const d = await L.dbDocs(p), t0 = d['tacc/' + made[0].id];
  ok(t0 && t0.user === made[0].id, 'اسم المستخدم هو الرقم التدريبي نفسه');
  ok(t0 && t0.hash && t0.salt && t0.iter === 150000 && t0.alg === 'PBKDF2-SHA256', 'الحساب يحفظ بصمة مشفّرة بملح و150 ألف دورة');
  const plain = Object.keys(d).filter((k) => k.startsWith('tacc/')).some((k) => JSON.stringify(d[k]).includes(made.find((m) => k.endsWith(m.id)).pw));
  ok(!plain, 'لا توجد كلمة مرور نصية في أي حساب داخل القاعدة');
  const vfy = await p.evaluate(async ({ id, pw }) => { const a = A.raw.tacc[id]; return (await hashPw(pw, a.salt, a.iter)) === a.hash; }, made[0]);
  ok(vfy, 'البصمة تطابق كلمة المرور المعروضة (الدخول سيعمل)');

  console.log('\n— سجل التدقيق —');
  const log = await p.evaluate(() => ['glog', 'glogs'].flatMap((c) => Object.values(A.raw[c] || {}).flatMap((d) => Object.values((d && d.e) || {}))));
  ok(log.some((x) => x[3] === 'acc-new'), 'إنشاء الحساب يُسجَّل في سجل التدقيق');
  ok(!made.some((m) => JSON.stringify(log).includes(m.pw)), 'لا تظهر أي كلمة مرور في سجل التدقيق');

  console.log('\n— المصنف المتداول بين المدربين —');
  await p.evaluate(() => { window.__DL.length = 0; ACT['t-book'](); });
  await p.waitForFunction(() => window.__DL.length === 1, null, { timeout: 20000 });
  const bk = sheets(await grab(p)), all = Object.values(bk).join('\n');
  ok(!made.some((m) => all.includes(m.pw)), 'المصنف المتداول لا يحتوي كلمة مرور واحدة');
  ok(/اسم المستخدم/.test(all) && /حالة تسليم كلمة المرور/.test(all) && /اسم المتدرب/.test(all) && /الرقم التدريبي/.test(all), 'يحتوي الاسم والرقم التدريبي واسم المستخدم وحالة التسليم');
  ok(Object.keys(bk).length >= 4 && Object.keys(bk).some((n) => n.startsWith('الشعبة')), 'ورقة ملخص وورقة لكل شعبة: ' + Object.keys(bk).length);
  ok((await p.evaluate(() => window.__DL[0].filename)).includes('كشف حسابات المتدربين'), 'اسم الملف واضح');

  console.log('\n— ملف كلمات المرور المؤقتة —');
  await p.evaluate(() => { window.__DL.length = 0; ACT['t-pwfile'](document.createElement('button')); });
  await p.waitForFunction(() => window.__DL.length === 1, null, { timeout: 20000 });
  const pb = sheets(await grab(p));
  ok(made.every((m) => Object.values(pb).join('\n').includes(m.pw)), 'ملف التوزيع يحتوي كلمات المرور');
  ok(!!pb['بطاقات التوزيع'] && pb['بطاقات التوزيع'].includes('غيّر كلمة المرور عند أول دخول'), 'ورقة بطاقات التوزيع جاهزة للطباعة');
  const lg2 = await p.evaluate(() => ['glog', 'glogs'].flatMap((c) => Object.values(A.raw[c] || {}).flatMap((d) => Object.values((d && d.e) || {}))));
  ok(lg2.some((x) => x[3] === 'acc-pwfile') && !made.some((m) => JSON.stringify(lg2).includes(m.pw)), 'تنزيل الملف يُسجَّل دون كلمات المرور');

  console.log('\n— التسليم وإعادة الإصدار —');
  const id1 = made[0].id, h1 = await p.evaluate((i) => A.raw.tacc[i].hash, id1);
  await p.evaluate((i) => { ACT['t-deliv']({ dataset: { id: i } }); }, id1);
  await p.waitForSelector('#tdH');
  await p.evaluate(() => { document.querySelector('#tdH').value = 'بطاقة مطبوعة'; ACT['t-deliv-go'](); });
  await L.flush(p);
  const dv = await p.evaluate((i) => A.raw.tacc[i].deliv, id1);
  ok(dv && dv.at && dv.how === 'بطاقة مطبوعة' && dv.by === 'ut1', 'تسجيل التسليم يحفظ الطريقة والوقت والمسلِّم');
  await p.evaluate((i) => { ACT['t-reissue']({ dataset: { id: i } }); }, id1);
  await p.waitForFunction(() => document.querySelector('#modal') && /إعادة إصدار/.test(document.querySelector('#modal').innerText));
  await p.evaluate(() => ACT['t-reissue-go']());
  await p.waitForFunction(() => document.querySelector('#modal') && /تظهر مرة واحدة/.test(document.querySelector('#modal').innerText), null, { timeout: 15000 });
  await L.flush(p);
  const a2 = await p.evaluate((i) => A.raw.tacc[i], id1), pw2 = await p.evaluate(() => A.tMade[0].pw);
  ok(a2.hash !== h1, 'إعادة الإصدار تبدل البصمة فتبطل الكلمة السابقة');
  ok(!(a2.deliv && a2.deliv.at), 'إعادة الإصدار تصفّر حالة التسليم');
  ok(await p.evaluate(async ({ i, pw }) => (await hashPw(pw, A.raw.tacc[i].salt, A.raw.tacc[i].iter)) === A.raw.tacc[i].hash, { i: id1, pw: pw2 }), 'الكلمة الجديدة تطابق البصمة الجديدة');
  await p.evaluate(() => closeModal());

  console.log('\n— استيراد كلمات مرور من مصنف (مصنف مَسار) —');
  const rost = await p.evaluate(() => tRoster().slice(0, 4).map((t) => ({ id: t.id, name: t.name })));
  const aoa = [['كلمات مرور منصة مَسار'], ['سري'], ['م', 'الشعبة', 'الرقم التدريبي', 'اسم المتدرب', 'كلمة المرور']]
    .concat(rost.map((t, i) => [i + 1, '63856', t.id, t.name, 'mSar-' + (1000 + i)]))
    .concat([[5, '63856', '449000999', 'متدرب خارج شعبي', 'xXxX-1111']]);
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), 'الشعبة 63856');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  await p.setInputFiles('[data-change=t-import]', { name: 'كلمات مرور منصة مَسار.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf });
  await p.waitForFunction(() => document.querySelector('#modal') && /استيراد كلمات مرور/.test(document.querySelector('#modal').innerText), null, { timeout: 20000 });
  const rv = await p.evaluate(() => document.querySelector('#modal').innerText);
  ok(/متدربون مطابقون\s*4/.test(rv.replace(/\n/g, ' ')), 'المراجعة تعرض عدد المطابقين قبل الاعتماد');
  ok(/أرقام خارج شعبك\s*1/.test(rv.replace(/\n/g, ' ')), 'الأرقام خارج شعب المدرب تُستثنى وتُعلن');
  await p.evaluate(() => ACT['t-import-ok']());
  await L.flush(p);
  const chk = await p.evaluate(async (rs) => { const o = []; for (let i = 0; i < rs.length; i++) { const a = A.raw.tacc[rs[i].id]; o.push((await hashPw('mSar-' + (1000 + i), a.salt, a.iter)) === a.hash && a.temp === true); } return o; }, rost);
  ok(chk.every(Boolean), 'كلمات مصنف مَسار صارت كلمات الدخول نفسها لهؤلاء المتدربين');
  ok(!(await p.evaluate(() => !!A.raw.tacc['449000999'])), 'لم يُنشأ حساب لرقم ليس في شعب المدرب');
  const d3 = await L.dbDocs(p);
  ok(!JSON.stringify(d3).includes('mSar-1000'), 'الكلمات المستوردة لا تُخزَّن نصاً في القاعدة ولا في السجل');

  console.log('\n— الملكية والصلاحيات —');
  const p2 = await L.open(b, 't2', docs, { uid: 'cu_ut2' });
  await L.view(p2, 'taccs');
  const r2 = await p2.evaluate(() => tRoster().map((t) => t.id));
  ok(r2.length && r2.every((x) => x.includes('6390') || x.includes('6391')), 'المدرب الثاني يرى متدربي شعبه فقط');
  const before = await p2.evaluate((i) => !!A.raw.tacc[i], '441999001');
  await p2.evaluate(() => ACT['t-make-one']({ dataset: { id: '441999001' } }));
  await p2.waitForTimeout(300);
  ok((await p2.evaluate((i) => !!A.raw.tacc[i], '441999001')) === before, 'لا يستطيع المدرب إنشاء حساب لمتدرب ليس في شعبه');
  await p2.evaluate(() => ACT['t-make-go'] && ACT['t-make']());
  await p2.waitForSelector('#tmC');
  const c2 = await p2.evaluate(() => [...document.querySelectorAll('#tmC option')].map((o) => o.textContent).join('|'));
  ok(/تطبيقات/.test(c2) && !/توجيه/.test(c2), 'مصنف مستقل لكل مقرر: خيارات المدرب الثاني مقرره وحده');
  await p2.evaluate(() => closeModal());

  const pv = await L.open(b, 'viewer', docs, { uid: 'cu_uview' });
  await L.view(pv, 'taccs');
  const tv = await L.text(pv), tvb = await pv.evaluate(() => [...document.querySelectorAll('#main [data-act]')].map((b) => b.dataset.act).filter((a) => a.startsWith('t-')));
  ok(!tvb.length && !/إنشاء حسابات المتدربين/.test(tv), 'حساب الاطلاع لا يرى أزرار الإدارة: ' + tvb.join(','));
  ok(/إجمالي المتدربين/.test(tv), 'حساب الاطلاع يرى الحالة فقط');
  const ph = await L.open(b, 'head', docs, { uid: 'cu_uhead' });
  await L.view(ph, 'taccs');
  ok(!/إنشاء حسابات المتدربين/.test(await L.text(ph)), 'رئيس القسم لا ينشئ حسابات ولا يعيد إصدار كلمات المرور');

  const pa = await L.open(b, 'admin', docs, { uid: 'cu_uadmin' });
  await L.view(pa, 'taccs');
  await pa.evaluate(() => ACT['t-make']());
  await pa.waitForSelector('#tmC');
  await pa.evaluate(() => ACT['t-make-go']());
  await pa.waitForFunction(() => document.querySelector('#modal') && /تظهر مرة واحدة/.test(document.querySelector('#modal').innerText), null, { timeout: 20000 });
  await pa.evaluate(() => closeModal());
  await L.flush(pa);
  const aid = await pa.evaluate(() => Object.keys(A.raw.tacc)[0]);
  ok((await pa.evaluate(() => Object.keys(A.raw.tacc).length)) > 60, 'مسؤول المنصة ينشئ حسابات كل شعب القسم: ' + (await pa.evaluate(() => Object.keys(A.raw.tacc).length)));
  await pa.evaluate((i) => ACT['t-toggle']({ dataset: { id: i } }), aid);
  await L.flush(pa);
  ok((await pa.evaluate((i) => A.raw.tacc[i].st, aid)) === 'disabled', 'مسؤول المنصة يعطّل حساباً');
  ok(/معطّل/.test(await L.text(pa)), 'الحساب المعطّل يظهر معطّلاً في الجدول');

  const errs = [...p.errs, ...p2.errs, ...pv.errs, ...ph.errs, ...pa.errs].filter((e) => !/ResizeObserver/.test(e));
  ok(!errs.length, 'لا أخطاء في الصفحة: ' + (errs[0] || '—'));
  await b.close();
  console.log(`\n══ ${pass} ناجح، ${fail} فاشل ══`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
