// اختبار شامل في متصفح حقيقي (Chromium) على نسخة الويب المبنية docs/index.html،
// متصلة بخادم محلي حقيقي (Postgres + GoTrue + PostgREST). الحسابات والأسماء مصطنعة.
const { chromium, devices } = require('playwright');
const crypto = require('crypto');
const L = require('./lib');
const { sql, check, pwFields } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const OUT = process.env.OUT || '/tmp/claude-0/-home-claude/da2fea53-9caa-5476-bb95-529d935e4850/scratchpad/e2e';
require('fs').mkdirSync(OUT, { recursive: true });

const IDS = { admin: 'uadmin00000000001', t1: 'utrain00000000001', t2: 'utrain00000000002', head: 'uhead000000000001', old: 'utrain00000000009' };
const PW = { admin: 'Admin#2026x', t1: 'Trainer1-pass', t2: 'Trainer2-pass', head: 'Head-pass-99', old: 'Old-trainer-1', s1: 'Ab3d-K9mPq', s2: 'Zx7c-Q2wEr' };
const j = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const serial = (d) => Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - Date.UTC(1899, 11, 30)) / 864e5);

function seed() {
  sql(`truncate doc, credential, trainee_account, trainee, audit cascade; delete from app_user; delete from auth.users;`);
  const now = new Date(), rd = new Date(now.getTime() + 3 * 3600e3), day = DAYS[rd.getUTCDay()];
  const today = serial(new Date(rd.getUTCFullYear(), rd.getUTCMonth(), rd.getUTCDate()));
  const hij = (k) => String(1 + k).padStart(2, '0') + '/05/1448';
  // أربع محاضرات سابقة أسبوعياً ثم اليوم
  const dates = [hij(0), hij(7), hij(14), hij(21), '29/05/1448'];
  const cal = dates.map((h, i) => [today - (4 - i) * 7, h, day, i + 1, '', 'نعم']);
  const lec = new Date(now.getTime() - 8 * 60000), lr = new Date(lec.getTime() + 3 * 3600e3);
  const start = String(lr.getUTCHours()).padStart(2, '0') + ':' + String(lr.getUTCMinutes()).padStart(2, '0');
  const acc = (id, username, name, role, pw, extra) => Object.assign({ id, username, name, role, active: true, perms: { past: true, sync: true, export: true }, spec: 'تقنية شبكات الحاسب', createdAt: '2026-11-01T00:00:00Z' }, pwFields(pw), extra || {});
  const rows = (ids) => ids.map((x) => ({ id: x[0], name: x[1] }));
  const docs = [
    ['accounts', IDS.admin, acc(IDS.admin, 'aalkhathami', 'مسؤول تجريبي', 'admin', PW.admin)],
    ['accounts', IDS.t1, acc(IDS.t1, 't.ahmed', 'مدرب أول', 'trainer', PW.t1)],
    ['accounts', IDS.t2, acc(IDS.t2, 't.saad', 'مدرب ثان', 'trainer', PW.t2)],
    ['accounts', IDS.head, acc(IDS.head, 'head1', 'رئيس قسم تجريبي', 'head', PW.head)],
    ['accounts', IDS.old, acc(IDS.old, 't.old', 'مدرب معطل', 'trainer', PW.old, { active: false })],
    ['sections', '63854', { crn: '63854', course: 'التوجيه والتحويل 1', kind: 'نظري', order: 0, spec: 'تقنية شبكات الحاسب', dept: 'قسم الحاسب وتقنية المعلومات', trainer: IDS.t1, meets: [{ day, start, dur: 100 }], dates, rows: rows([['446000001', 'متدرب أول تجريبي'], ['446000002', 'متدرب ثان تجريبي'], ['446000004', 'متدرب رابع تجريبي']]) }],
    ['sections', '63912', { crn: '63912', course: 'تطبيقات الحاسب المتقدمة', kind: 'نظري', order: 1, spec: 'تقنية شبكات الحاسب', dept: 'قسم الحاسب وتقنية المعلومات', trainer: IDS.t2, meets: [{ day, start: '07:30', dur: 100 }], dates, rows: rows([['446000002', 'متدرب ثان تجريبي'], ['446000003', 'متدرب ثالث تجريبي']]) }],
    ['marks', '63854', { m: { 446000001: { d14480501: 'ح', d14480508: 'غ', d14480515: 'غ', d14480522: 'م5' }, 446000002: { d14480501: 'ح', d14480508: 'ح', d14480515: 'ح', d14480522: 'ح' }, 446000004: { d14480501: 'غ', d14480508: 'غ', d14480515: 'غ', d14480522: 'غ' } } }],
    ['marks', '63912', { m: { 446000002: { d14480501: 'ح' }, 446000003: { d14480501: 'غ' } } }],
    ['notes', '63854', { n: {} }], ['notes', '63912', { n: {} }],
    ['meta', 'settings', { warnT: 3, depT: 5, warnP: 8, depP: 10, lateLimit: 15 }],
    ['meta', 'calendar', { rows: cal }],
    ['meta', 'qrcfg', { lateGrace: 3 }],
    ['tacc', '446000001', Object.assign({ id: '446000001', user: '446000001', name: 'متدرب أول تجريبي', st: 'new', temp: true }, pwFields(PW.s1))],
    ['tacc', '446000002', Object.assign({ id: '446000002', user: '446000002', name: 'متدرب ثان تجريبي', st: 'new', temp: false }, pwFields(PW.s2))],
  ];
  docs.forEach(([c, id, d]) => sql(`insert into doc (col, id, data) values ('${c}', '${id}', ${j(d)})`));
  return { today: '29/05/1448', dk: 'd14480529' };
}

async function loginUI(page, user, pw) {
  await page.goto(URL0, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#liU', { timeout: 15000 });
  await page.fill('#liU', user); await page.fill('#liP', pw);
  await page.click('#liB');
}
const shellUp = (page) => page.waitForFunction(() => typeof A !== 'undefined' && A.me && !document.querySelector('#shell').hidden, null, { timeout: 20000 });

(async () => {
  const S = seed();
  const browser = await chromium.launch();
  const ctxOpts = { timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 1366, height: 860 } };
  const errs = [];
  const mk = async (opts) => { const c = await browser.newContext(Object.assign({}, ctxOpts, opts || {})); const p = await c.newPage(); p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|supabase\.js|ERR_|net::/.test(m.text())) errs.push(m.text()); }); return [c, p]; };

  console.log('— شاشة الدخول —');
  let [c, p] = await mk();
  await p.goto(URL0); await p.waitForSelector('#liU');
  check('شاشة دخول واحدة: اسم المستخدم وكلمة المرور', await p.isVisible('#liU') && await p.isVisible('#liP') && (await p.$$('input[type=email]')).length === 0);
  await p.screenshot({ path: OUT + '/login.png' });
  await p.fill('#liP', 'Secret-123');
  await p.click('#gate .pweye');
  check('زر العين يُظهر كلمة المرور', await p.getAttribute('#liP', 'type') === 'text' && await p.getAttribute('#gate .pweye', 'aria-pressed') === 'true');
  await p.screenshot({ path: OUT + '/login-eye.png' });
  await p.click('#gate .pweye');
  check('…ويخفيها مرة أخرى', await p.getAttribute('#liP', 'type') === 'password' && await p.inputValue('#liP') === 'Secret-123');
  await loginUI(p, 't.ahmed', 'wrong-pass');
  await p.waitForFunction(() => { const e = document.querySelector('#liE'); return e && !e.hidden && e.textContent.length > 3; });
  check('كلمة مرور خاطئة: رسالة واضحة', (await p.textContent('#liE')).includes('اسم المستخدم أو كلمة المرور غير صحيحة'), await p.textContent('#liE'));
  await loginUI(p, 'no.such.user', 'whatever123');
  await p.waitForFunction(() => { const e = document.querySelector('#liE'); return e && !e.hidden && e.textContent.length > 3; });
  check('اسم مستخدم غير موجود: الرسالة نفسها', (await p.textContent('#liE')).includes('اسم المستخدم أو كلمة المرور غير صحيحة'));
  await loginUI(p, 't.old', PW.old);
  await p.waitForFunction(() => { const e = document.querySelector('#liE'); return e && !e.hidden && e.textContent.length > 3; });
  check('حساب معطل: يُمنع برسالة', (await p.textContent('#liE')).includes('معطّل'), await p.textContent('#liE'));
  await c.close();

  console.log('\n— مسؤول المنصة —');
  [c, p] = await mk();
  await loginUI(p, 'aalkhathami', PW.admin); await shellUp(p);
  check('المسؤول يدخل مباشرة إلى المنصة (بلا شاشة دخول ثانية)', await p.evaluate(() => A.me.role === 'admin' && document.querySelector('#gate').hidden));
  check('القائمة تُظهر أدوات الإدارة', await p.isVisible('#nav a[data-v="users"]'));
  await p.waitForFunction(() => A.m && A.m.sections.length === 2, null, { timeout: 15000 });
  check('المسؤول يرى كل الشعب', await p.evaluate(() => A.m.sections.length) === 2);
  // الدخول بحسابه كمدرب (لصاحب المنصة وحده)
  check('زر «الدخول بحسابي كمدرب» يظهر لحساب aalkhathami', await p.isVisible('#who [data-act="as-trainer"]'));
  await p.click('#who [data-act="as-trainer"]');
  await p.waitForFunction(() => A.asTrainer === true && !document.querySelector('#nav a[data-v="users"]'));
  check('وضع المدرب: أدوات الإدارة مخفية', !(await p.isVisible('#nav a[data-v="users"]')) && await p.evaluate(() => !isAdmin()));
  check('…والشعب المعروضة شعبه وحده', await p.evaluate((id) => A.m.sections.every((s) => s.trainer === id), IDS.admin));
  await p.evaluate(() => { location.hash = 'users'; }); await p.waitForTimeout(500);
  check('…وصفحات الإدارة لا تُفتح فيه', await p.evaluate(() => A.view) === 'home');
  await p.screenshot({ path: OUT + '/admin-as-trainer.png' });
  await p.reload(); await shellUp(p);
  check('…ويبقى الوضع بعد إعادة التحميل', await p.evaluate(() => A.asTrainer === true));
  await p.click('#who [data-act="as-trainer"]');
  await p.waitForFunction(() => A.asTrainer === false && A.m.sections.length === 2);
  check('العودة لحساب المسؤول تعيد الإدارة وكل الشعب', await p.isVisible('#nav a[data-v="users"]'));
  await p.reload(); await shellUp(p);
  check('إعادة تحميل الصفحة تحافظ على الجلسة', await p.evaluate(() => A.me && A.me.username) === 'aalkhathami');
  await p.screenshot({ path: OUT + '/admin-home.png' });
  // إنشاء مدرب من شاشة الصلاحيات (الدالة نفسها التي يستدعيها النموذج)
  await p.evaluate(async () => { go('users'); });
  const made = await p.evaluate(async () => {
    const id = genId('u'), acc = Object.assign({ id, username: 't.fahad', name: 'مدرب جديد تجريبي', role: 'trainer', active: true, perms: {}, createdAt: new Date().toISOString(), mustChange: true }, await pwFields('Fahad-temp-77'));
    A.raw.accounts[id] = acc; enqueue('accounts/' + id, acc, 'set'); await new Promise((r) => setTimeout(r, 2500)); return id;
  });
  check('المسؤول ينشئ حساب مدرب ويُحفظ على الخادم', sql(`select count(*) from app_user where username='t.fahad' and role='trainer'`) === '1');
  // نقل البيانات من نسخة Claude: ملف نسخة احتياطية بالبنية التي تصدّرها المنصة هناك
  const bk = { app: 'haader', kind: 'backup', at: new Date().toISOString(), by: 'اختبار', cols: {
    sections: { 70001: { crn: '70001', course: 'مقرر منقول', kind: 'نظري', trainer: IDS.t2, meets: [], dates: [], rows: [{ id: '446000009', name: 'متدرب منقول' }] } },
    tacc: { 446000009: Object.assign({ id: '446000009', user: '446000009', name: 'متدرب منقول', st: 'new', temp: true }, pwFields('Moved-pass-9')) },
    bosla: { cfg: { settings: { headNo: '123' } } } } };
  const bkFile = OUT + '/backup-test.json'; require('fs').writeFileSync(bkFile, JSON.stringify(bk));
  await p.evaluate(() => go('prefs')); await p.waitForSelector('#webimp');
  await p.setInputFiles('#webimp input[type=file]', bkFile);
  await p.waitForSelector('[data-act="web-imp-go"]');
  check('النقل يعرض مراجعة بالأعداد قبل الاعتماد', (await p.textContent('#modal')).includes('3 وثيقة'));
  await p.click('[data-act="web-imp-go"]');
  await p.waitForFunction(() => /اكتمل النقل/.test((document.querySelector('#impst') || {}).textContent || ''), null, { timeout: 15000 });
  check('النقل يكتب الوثائق في القاعدة', sql(`select count(*) from doc where (col='sections' and id='70001') or (col='tacc' and id='446000009') or (col='bosla' and id='cfg')`) === '3');
  check('…وحساب المتدرب المنقول يعمل بكلمة مروره', (await L.login('446000009', 'Moved-pass-9')).ok);
  await shellUp(p);
  await p.click('#who [data-act="logout"]');
  await p.waitForSelector('#liU', { timeout: 15000 });
  check('تسجيل الخروج ينهي الجلسة ويعيد شاشة الدخول', await p.isVisible('#liU'));
  await p.reload(); await p.waitForSelector('#liU', { timeout: 15000 });
  check('…ولا تعود الجلسة بإعادة التحميل', await p.isVisible('#liU'));
  await c.close();

  console.log('\n— المدرب —');
  [c, p] = await mk();
  await loginUI(p, 't.fahad', 'Fahad-temp-77'); await shellUp(p);
  await p.waitForSelector('#modal', { timeout: 8000 }).catch(() => {});
  check('المدرب الجديد يدخل، ويُطلب منه تغيير كلمة المرور المؤقتة', await p.evaluate(() => !!document.querySelector('#modal') && A.forceChange === true));
  check('زر العين في نافذة تغيير كلمة المرور', (await p.$$('#modal .pweye')).length === 2);
  await p.fill('#cpN', 'Fahad-own-pass1'); await p.fill('#cpR', 'Fahad-own-pass1');
  await p.click('#modal form[data-submit="changePw"] .btn.p'); await p.waitForTimeout(2500);
  const lp = await L.login('t.fahad', 'Fahad-own-pass1');
  check('…وتغييرها يعمل في الدخول التالي', lp.ok, lp.err);
  await c.close();

  [c, p] = await mk();
  await loginUI(p, 't.ahmed', PW.t1); await shellUp(p);
  await p.waitForFunction(() => A.m && A.m.sections.length >= 1, null, { timeout: 15000 });
  check('المدرب يرى شعبته وحدها', await p.evaluate(() => A.m.sections.map((s) => s.crn).join()) === '63854');
  check('اسم قسم المدرب تحت شعار المؤسسة', (await p.textContent('#sidedept')) === 'قسم الحاسب وتقنية المعلومات' && await p.evaluate(() => document.querySelector('#side .lgplate').nextElementSibling.id === 'sidedept'));
  check('زر الدخول كمدرب لا يظهر لغير صاحب المنصة', (await p.$$('#who [data-act="as-trainer"]')).length === 0);
  check('أدوات الإدارة مخفية عن المدرب', !(await p.isVisible('#nav a[data-v="users"]')));
  await p.evaluate(() => { location.hash = 'users'; }); await p.waitForTimeout(600);
  check('فتح صفحة الإدارة برابط مباشر يُعاد إلى الرئيسية', await p.evaluate(() => A.view) === 'home');
  await p.evaluate((d) => setMarks([{ crn: '63854', id: '446000004', d, code: 'ح' }], 'اختبار'), S.today);
  await p.waitForFunction(() => document.querySelector('#saved') && /محفوظة/.test(document.querySelector('#saved').textContent), null, { timeout: 10000 });
  check('التحضير يُحفظ في قاعدة البيانات فعلاً', sql(`select data->'m'->'446000004'->>'${S.dk}' from doc where col='marks' and id='63854'`) === 'ح');
  check('…ومعه سجل العملية', sql(`select data->'rows'->-1->>6 from doc where col='meta' and id='audit'`) === 'ح');
  const forb = await p.evaluate(async () => { try { await db.doc('marks/63912').update({ m: { 446000003: { d14480501: 'ح' } } }); return 'saved'; } catch (e) { return e.message; } });
  check('محاولة الكتابة في شعبة غيره تُرفض من الخادم برسالة', forb !== 'saved' && /صلاحية|لا تملك/.test(forb), forb);
  check('…ولم يتغير شيء', sql(`select data->'m'->'446000003'->>'d14480501' from doc where col='marks' and id='63912'`) === 'غ');
  await p.screenshot({ path: OUT + '/trainer-home.png' });

  console.log('\n— التحضير عبر QR من القاعة إلى جوال المتدرب —');
  await p.evaluate(() => { A.qrCrn = '63854'; go('qr'); });
  await p.waitForSelector('[data-act="qr-start"]', { timeout: 10000 });
  await p.click('[data-act="qr-start"]');
  await p.waitForFunction(() => Object.values(A.raw.qrs || {}).some((s) => s.status === 'open') && Object.values(QRC).length, null, { timeout: 15000 });
  await p.waitForFunction(() => document.querySelector('#saved') && /محفوظة/.test(document.querySelector('#saved').textContent), null, { timeout: 10000 });
  const link = await p.evaluate(async () => { const s = Object.values(A.raw.qrs).find((x) => x.status === 'open'); return qrUrl(await qrCodeOf(s, qrSlot(s, Date.now()))); });
  check('رمز QR يفتح بوابة المتدرب نفسها', link.startsWith('http://127.0.0.1:8080/haader/') && /#qr=H1\./.test(link), link);
  check('الجلسة محفوظة على الخادم', sql(`select count(*) from doc where col='qrs' and data->>'status'='open'`) === '1');
  await p.screenshot({ path: OUT + '/trainer-qr.png' });

  const iphone = devices['iPhone 13'];
  const [c2, m] = await mk(Object.assign({}, iphone, { timezoneId: 'Asia/Riyadh', locale: 'ar-SA' }));
  await m.goto(link.replace('/haader/', '/haader/?sb=' + encodeURIComponent(L.BASE)).replace('?sb=' + encodeURIComponent(L.BASE) + '#', '?sb=' + encodeURIComponent(L.BASE) + '#'));
  await m.waitForSelector('#liU', { timeout: 15000 });
  check('المتدرب يمسح الرمز فتطلب منه الصفحة الدخول برقمه', (await m.textContent('#gate')).includes('ليُسجَّل حضورك'));
  await m.fill('#liU', '446000001'); await m.fill('#liP', PW.s1); await m.click('#liB');
  await m.waitForSelector('.tp-qr.ok, .tp-qr.bad', { timeout: 20000 });
  const qrText = await m.textContent('.tp-qr');
  check('…ويظهر له تأكيد تسجيل الحضور', qrText.includes('سُجّل حضورك'), qrText);
  check('…بحالته وفق قاعدة التأخير (الجلسة فُتحت بعد بداية المحاضرة فالسماح من فتحها)', /حاضر/.test(qrText), qrText);
  await m.waitForSelector('.tp-modal', { timeout: 8000 }).catch(() => {});
  check('كلمة المرور المؤقتة: يُطلب تغييرها', await m.isVisible('.tp-modal'));
  check('زر العين في بوابة المتدرب', (await m.$$('.tp-modal .pweye')).length === 2);
  await m.fill('#tpN', 'MyOwnPass-55'); await m.fill('#tpR', 'MyOwnPass-55'); await m.click('.tp-modal button[type=submit]');
  await m.waitForSelector('.tp-modal', { state: 'detached', timeout: 8000 }).catch(() => {});
  check('…ويُحفظ التغيير', (await L.login('446000001', 'MyOwnPass-55')).ok);
  await m.waitForSelector('.tp-course', { timeout: 15000 });
  const card = await m.textContent('.tp-course');
  check('اسم القسم تحت الشعار في بوابة المتدرب', (await m.textContent('.tp-head .lgdept')) === 'قسم الحاسب وتقنية المعلومات');
  check('بوابة المتدرب: مقرره وشعبته', card.includes('التوجيه والتحويل 1') && card.includes('63854'));
  check('…وغيابه المحتسب ونسبته', card.includes('غياب محتسب') && card.includes('نسبة الغياب'));
  check('…وحالة الإنذار', /إنذار|قريب من/.test(card), card.slice(0, 200));
  check('…ولا يرى متدربين آخرين', !card.includes('متدرب ثان') && !card.includes('446000002'));
  await m.screenshot({ path: OUT + '/trainee-iphone.png', fullPage: true });
  const code1 = sql(`select data->'m'->'446000001'->>'${S.dk}' from doc where col='marks' and id='63854'`);
  check('الحضور في كشف المدرب على الخادم', code1 === 'ح', code1);
  await p.waitForFunction(() => Object.values(A.raw.qrs).some((s) => s.ins && s.ins['446000001']), null, { timeout: 12000 }).catch(() => {});
  check('…ويظهر في صفحة QR عند المدرب خلال ثوانٍ', await p.evaluate(() => Object.values(A.raw.qrs).some((s) => s.ins && s.ins['446000001'])));
  await p.waitForFunction((d) => H.code(A.m, '63854', '446000001', d) === 'ح', S.today, { timeout: 12000 }).catch(() => {});
  check('…وفي كشف التحضير عنده', await p.evaluate((d) => H.code(A.m, '63854', '446000001', d), S.today) === code1);
  await m.goto(link.replace('/haader/#', '/haader/?sb=' + encodeURIComponent(L.BASE) + '#'));
  await m.waitForFunction(() => /مسجل مسبقاً/.test((document.querySelector('.tp-qr') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  check('مسح الرمز مرة ثانية: «مسجل مسبقاً»', (await m.textContent('.tp-qr')).includes('مسجل مسبقاً'));
  await m.click('[data-tp="out"]'); await m.waitForSelector('#liU', { timeout: 15000 });
  check('خروج المتدرب', await m.isVisible('#liU'));
  await m.screenshot({ path: OUT + '/login-iphone.png' });
  await c2.close();
  await c.close();

  console.log('\n— رئيس القسم —');
  [c, p] = await mk();
  await loginUI(p, 'head1', PW.head); await shellUp(p);
  const nsec = +sql(`select count(*) from doc where col='sections'`);
  await p.waitForFunction((n) => A.m && A.m.sections.length === n, nsec, { timeout: 15000 });
  check('رئيس القسم يدخل ويرى كل الشعب', await p.evaluate((n) => A.me.role === 'head' && A.m.sections.length === n, nsec));
  const hw = await p.evaluate(async () => { try { await db.doc('marks/63854').update({ m: { 446000002: { d14480501: 'غ' } } }); return 'saved'; } catch (e) { return e.message; } });
  check('…ولا لرئيس القسم', (await p.$$('#who [data-act="as-trainer"]')).length === 0);
  check('رئيس القسم لا يعدّل التحضير (من الخادم)', hw !== 'saved', hw);
  await c.close();

  console.log('\n— جهاز آخر وتبويب آخر —');
  [c, p] = await mk({ viewport: { width: 820, height: 1180 }, userAgent: devices['iPad Mini'].userAgent });
  await loginUI(p, 't.saad', PW.t2); await shellUp(p);
  const p2 = await c.newPage(); await p2.goto(URL0); await shellUp(p2);
  check('الجلسة نفسها تعمل في تبويب ثان', await p2.evaluate(() => A.me.username) === 't.saad');
  await p.screenshot({ path: OUT + '/trainer-ipad.png' });
  await c.close();

  check('لا أخطاء JavaScript في الصفحات', errs.length === 0, errs.slice(0, 5));
  await browser.close();
  L.done('الاختبار الشامل في المتصفح');
})().catch((e) => { console.error(e); process.exit(1); });
