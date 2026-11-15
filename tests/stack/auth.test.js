// اختبار الدخول الموحد والصلاحيات على مستوى القاعدة وبوابة المتدرب والتحضير المباشر عبر QR
// على نسخة محلية حقيقية من Postgres + GoTrue + PostgREST (الأرقام والأسماء مصطنعة).
const L = require('./lib');
const crypto = require('crypto');
const { sql, login, rpc, req, docGet, docList, docSet, docAdd, docMerge, docDel, check, pwFields } = L;

const PW = { admin: 'Admin#2026x', t1: 'Trainer1-pass', t2: 'Trainer2-pass', head: 'Head-pass-99', view: 'Viewer-pass-1', old: 'Old-trainer-1', s1: 'Ab3d-K9mPq', s2: 'Zx7c-Q2wEr', s3: 'Mn4b-P8tYu' };
const IDS = { admin: 'uadmin00000000001', t1: 'utrain00000000001', t2: 'utrain00000000002', head: 'uhead000000000001', view: 'uview000000000001', old: 'utrain00000000009' };
const QA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const sig = (k, msg) => Array.from(crypto.createHmac('sha256', Buffer.from(k, 'base64')).update(msg).digest().subarray(0, 8), (b) => QA[b & 31]).join('');
const j = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
const acc = (id, username, name, role, pw, extra) => Object.assign({ id, username, name, role, active: true, perms: {}, createdAt: '2026-11-01T00:00:00Z' }, pwFields(pw), extra || {});
const riyadh = (d) => new Date(d.getTime() + 3 * 3600e3);
const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

function seed() {
  sql(`truncate doc, credential, trainee_account, trainee, audit, mark, note, enrollment, section, grade, grade_section cascade; delete from app_user; delete from auth.users;`);
  const now = new Date(), r = riyadh(now), day = DAYS[r.getUTCDay()];
  const lec = new Date(now.getTime() - 10 * 60000), lr = riyadh(lec);
  const start = String(lr.getUTCHours()).padStart(2, '0') + ':' + String(lr.getUTCMinutes()).padStart(2, '0');
  const docs = [
    ['accounts', IDS.admin, acc(IDS.admin, 'aalkhathami', 'مسؤول تجريبي', 'admin', PW.admin)],
    ['accounts', IDS.t1, acc(IDS.t1, 't.ahmed', 'مدرب أول', 'trainer', PW.t1)],
    ['accounts', IDS.t2, acc(IDS.t2, 't.saad', 'مدرب ثان', 'trainer', PW.t2)],
    ['accounts', IDS.head, acc(IDS.head, 'head1', 'رئيس قسم تجريبي', 'head', PW.head)],
    ['accounts', IDS.view, acc(IDS.view, 'user_999', 'حساب اطلاع', 'viewer', PW.view)],
    ['accounts', IDS.old, acc(IDS.old, 't.old', 'مدرب معطل', 'trainer', PW.old, { active: false })],
    ['sections', '63854', { crn: '63854', course: 'مقرر أ', kind: 'نظري', trainer: IDS.t1, meets: [{ day, start, dur: 100 }], dates: ['10/03/1448'], rows: [{ id: '446000001', name: 'متدرب أول' }, { id: '446000002', name: 'متدرب ثان' }] }],
    ['sections', '63912', { crn: '63912', course: 'مقرر ب', kind: 'نظري', trainer: IDS.t2, meets: [{ day, start: '07:30', dur: 100 }], dates: ['10/03/1448'], rows: [{ id: '446000002', name: 'متدرب ثان' }, { id: '446000003', name: 'متدرب ثالث' }] }],
    ['marks', '63854', { m: { '446000001': { d14480310: 'غ' }, '446000002': {} } }],
    ['marks', '63912', { m: { '446000002': { d14480310: 'ح' }, '446000003': { d14480310: 'غ' } } }],
    ['meta', 'settings', { warnT: 0.15, depT: 0.2 }],
    ['meta', 'calendar', { rows: [] }],
    ['meta', 'qrcfg', { lateGrace: 3 }],
    ['tacc', '446000001', Object.assign({ id: '446000001', user: '446000001', name: 'متدرب أول', st: 'new', temp: true }, pwFields(PW.s1))],
    ['tacc', '446000002', Object.assign({ id: '446000002', user: '446000002', name: 'متدرب ثان', st: 'new', temp: true }, pwFields(PW.s2))],
    ['tacc', '446000003', Object.assign({ id: '446000003', user: '446000003', name: 'متدرب ثالث', st: 'disabled', temp: true }, pwFields(PW.s3))],
    ['bviol', 'v1', { id: '446000003', crn: '63912', by: IDS.t2, type: 'غياب', desc: 'وصف' }],
    ['bcase', 'c1', { id: '446000003', by: IDS.t2, details: 'حالة سرية' }],
    ['warnlog', 'w1', { id: '446000001', crn: '63854', course: 'مقرر أ', type: 'warn', status: 'ok', at: '2026-11-10T08:00:00Z' }],
    ['warnlog', 'w2', { id: '446000003', crn: '63912', course: 'مقرر ب', type: 'warn', status: 'ok', at: '2026-11-10T08:00:00Z' }],
  ];
  docs.forEach(([c, id, d]) => sql(`insert into doc (col, id, data) values ('${c}', '${id}', ${j(d)})`));
  return { day, start };
}

(async () => {
  console.log('تهيئة بيانات اختبارية…');
  seed();
  const T = {};

  console.log('\n— الدخول —');
  for (const [k, u] of [['admin', 'aalkhathami'], ['t1', 't.ahmed'], ['t2', 't.saad'], ['head', 'head1'], ['view', 'user_999']]) {
    const r = await login(u, PW[k]); T[k] = r; check(`دخول ${u} باسم المستخدم`, r.ok, r);
  }
  const rU = await login('AAlkhathami ', PW.admin); check('اسم المستخدم لا يتأثر بالأحرف الكبيرة والمسافات', rU.ok, rU);
  T.s1 = await login('446000001', PW.s1); check('دخول المتدرب بالرقم التدريبي', T.s1.ok, T.s1);
  T.s2 = await login('446000002', PW.s2); check('دخول متدرب ثان', T.s2.ok, T.s2);
  const bad = await login('t.ahmed', 'wrong-pass'); check('كلمة مرور خاطئة تُرفض', !bad.ok && bad.status === 400, bad);
  const nou = await login('nobody.here', 'whatever1'); check('اسم مستخدم غير موجود يُرفض بالرسالة نفسها', !nou.ok && nou.status === 400 && nou.err === bad.err, [nou.err, bad.err]);
  const dis = await login('t.old', PW.old); check('حساب مدرب معطل يُمنع', !dis.ok && dis.status === 400 && /banned/i.test(JSON.stringify(dis.body)), dis.body);
  const dis3 = await login('446000003', PW.s3); check('حساب متدرب معطل يُمنع', !dis3.ok && dis3.status === 400 && /banned/i.test(JSON.stringify(dis3.body)), dis3.body);
  const s1 = await rpc('login_salt', { p_user: 'nobody.here' }), s2 = await rpc('login_salt', { p_user: 'nobody.here' });
  check('ملح الاسم غير الموجود ثابت (لا يكشف وجود الحساب)', s1.body.salt === s2.body.salt && s1.body.salt.length === 32);

  console.log('\n— الهوية والأدوار من الخادم —');
  const who = async (k) => (await rpc('whoami', {}, T[k].token)).body;
  const wa = await who('admin'); check('المسؤول: دوره admin ومعرّفه حسابه في المنصة', wa.role === 'admin' && wa.id === IDS.admin, wa);
  const wt = await who('t1'); check('المدرب: trainer', wt.role === 'trainer' && wt.id === IDS.t1, wt);
  const wh = await who('head'); check('رئيس القسم: head', wh.role === 'head', wh);
  const wv = await who('view'); check('الاطلاع: viewer', wv.role === 'viewer', wv);
  const ws = await who('s1'); check('المتدرب: kind=trainee برقمه', ws.kind === 'trainee' && ws.id === '446000001', ws);

  console.log('\n— الجلسة —');
  const rf = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: T.t2.refresh } });
  check('تجديد الجلسة برمز التجديد', rf.ok, rf.body);
  const lo = await req('/auth/v1/logout', { method: 'POST', token: rf.body.access_token });
  check('تسجيل الخروج', lo.status === 204, lo);
  const rf2 = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: rf.body.refresh_token } });
  check('بعد الخروج لا تتجدد الجلسة', !rf2.ok, rf2.body);
  T.t2 = await login('t.saad', PW.t2);

  console.log('\n— القراءة حسب الدور —');
  const secIds = async (k) => ((await docList('sections', T[k].token)).body || []).map((x) => x.id).sort().join(',');
  check('المدرب الأول يرى شعبته فقط', (await secIds('t1')) === '63854');
  check('المدرب الثاني يرى شعبته فقط', (await secIds('t2')) === '63912');
  check('رئيس القسم يرى كل الشعب', (await secIds('head')) === '63854,63912');
  check('الاطلاع يرى كل الشعب', (await secIds('view')) === '63854,63912');
  const accs = (await docList('accounts', T.admin.token)).body;
  check('بصمات كلمات المرور لا تُقرأ من القاعدة', accs.length === 6 && accs.every((a) => !('hash' in a.data)), accs.map((a) => Object.keys(a.data)));
  const cr = await req('/rest/v1/credential?select=*', { token: T.admin.token });
  check('جدول بيانات الدخول غير مقروء حتى للمسؤول', !cr.ok || (cr.body || []).length === 0, cr.status);
  const an = await req('/rest/v1/doc?select=id');
  check('غير المسجَّل لا يقرأ أي وثيقة', !an.ok || (an.body || []).length === 0, an.status);
  const v2 = (await docList('bviol', T.t1.token)).body || [];
  check('سجل المخالفات الموحد: المدرب الأول يرى مخالفة سجّلها الثاني', v2.some((x) => x.id === 'v1'));
  const c2 = (await docList('bcase', T.t1.token)).body || [];
  check('الحالة الإرشادية سرية عن غير أطرافها', !c2.length, c2);
  const c3 = (await docList('bcase', T.head.token)).body || [];
  check('رئيس القسم يرى الحالة', c3.length === 1);
  const lg = (await docList('logins', T.t1.token)).body || [];
  check('سجل الدخول لا يقرؤه المدرب', !lg.length);

  console.log('\n— الكتابة حسب الدور —');
  let r = await docMerge('marks', '63854', { m: { '446000002': { d14480310: 'ح' } } }, T.t1.token);
  check('المدرب يحضّر في شعبته', r.ok, r);
  r = await docMerge('marks', '63912', { m: { '446000003': { d14480310: 'ح' } } }, T.t1.token);
  check('المدرب لا يحضّر في شعبة غيره', !r.ok, r.status);
  check('…ولم يتغير شيء', sql(`select data->'m'->'446000003'->>'d14480310' from doc where col='marks' and id='63912'`) === 'غ');
  r = await docMerge('marks', '63912', { m: { '446000002': { d14480310: 'غ' } } }, T.head.token);
  check('رئيس القسم لا يعدّل التحضير', !r.ok);
  r = await docMerge('marks', '63912', { m: { '446000002': { d14480310: 'غ' } } }, T.view.token);
  check('حساب الاطلاع لا يكتب', !r.ok);
  r = await docMerge('sections', '63854', { trainer: IDS.t2 }, T.t1.token);
  check('المدرب لا يغيّر مدرب الشعبة', !r.ok && /مسؤول/.test(JSON.stringify(r.body)), r.body);
  r = await docMerge('accounts', IDS.t1, { role: 'admin' }, T.t1.token);
  check('المدرب لا يرفع صلاحيته إلى مسؤول', !r.ok, r.body);
  check('…ودوره على الخادم باقٍ trainer', sql(`select role from app_user where legacy_id='${IDS.t1}'`) === 'trainer');
  r = await docMerge('accounts', IDS.t1, { lastLogin: '2026-11-15T10:00:00Z' }, T.t1.token);
  check('المدرب يحدّث آخر دخوله في حسابه', r.ok, r.body);
  r = await docMerge('accounts', IDS.t2, { name: 'تغيير' }, T.t1.token);
  check('المدرب لا يعدّل حساب غيره', !r.ok);
  r = await docMerge('bviol', 'v1', { dir: { decision: 'approve' } }, T.head.token);
  check('رئيس القسم يعتمد في سجل المخالفة', r.ok, r.body);
  r = await docDel('bviol', 'v1', T.admin.token);
  check('لا تُحذف المخالفة حتى من المسؤول', (r.body || []).length === 0 && sql(`select count(*) from doc where col='bviol'`) === '1', r);
  r = await docDel('marks', '63854', T.t1.token);
  check('المدرب لا يحذف وثائق', (r.body || []).length === 0 && sql(`select count(*) from doc where col='marks'`) === '2');
  r = await docAdd('logins', 'lx1', { at: 'x', username: 't.ahmed', ok: true }, T.t1.token);
  check('تسجيل الدخول يُضاف إلى السجل', r.ok, r.body);
  r = await docMerge('meta', 'settings', { warnT: 0.5 }, T.t1.token);
  check('المدرب لا يغيّر إعدادات المنصة', !r.ok);
  r = await docMerge('meta', 'audit', { rows: [['x']] }, T.t1.token);
  check('المدرب يكتب في سجل العمليات', r.ok, r.body);

  console.log('\n— إدارة الحسابات —');
  const nt = acc('utrain00000000003', 't.new', 'مدرب جديد', 'trainer', 'New-trainer-7', { mustChange: true });
  r = await docSet('accounts', nt.id, nt, T.admin.token);
  check('المسؤول ينشئ حساب مدرب من المنصة', r.ok, r.body);
  const ln = await login('t.new', 'New-trainer-7'); check('…ويدخل به المدرب فوراً', ln.ok, ln);
  r = await docSet('accounts', 'uhack', acc('uhack', 'hacker', 'x', 'admin', 'Hack-pass-123'), T.t1.token);
  check('المدرب لا ينشئ حسابات', !r.ok);
  const np = pwFields('Admin#2027y');
  r = await docMerge('accounts', IDS.admin, np, T.admin.token);
  check('تغيير كلمة المرور يُحفظ', r.ok, r.body);
  check('…والجديدة تعمل', (await login('aalkhathami', 'Admin#2027y')).ok);
  check('…والقديمة لا تعمل', !(await login('aalkhathami', PW.admin)).ok);
  r = await docMerge('accounts', IDS.t2, { active: false }, T.admin.token);
  check('المسؤول يعطّل حساباً', r.ok, r.body);
  { const x = await login('t.saad', PW.t2); check('…فيُمنع دخوله', !x.ok && x.status === 400, x.body); }
  const rf3 = await req('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: T.t2.refresh } });
  check('…وتنتهي جلسته القائمة', !rf3.ok, rf3.body);
  r = await docMerge('accounts', IDS.t2, { active: true }, T.admin.token);
  check('إعادة التفعيل تعيد الدخول', r.ok && (await login('t.saad', PW.t2)).ok);
  const dup = acc('udup', 'T.Ahmed', 'مكرر', 'trainer', 'Dup-pass-12');
  r = await docSet('accounts', 'udup', dup, T.admin.token);
  check('لا يتكرر اسم المستخدم', !r.ok && /مستخدم لحساب آخر/.test(JSON.stringify(r.body)), r.body);
  const su = await req('/auth/v1/signup', { method: 'POST', body: { email: 'someone@gmail.com', password: 'Some-pass-123' } });
  check('التسجيل الذاتي مغلق', !su.ok, su.status);

  console.log('\n— حسابات المتدربين —');
  r = await docSet('tacc', '446000002', Object.assign({ id: '446000002', user: '446000002', name: 'متدرب ثان', st: 'new', temp: true }, pwFields('Re-issued-22')), T.t1.token);
  check('مدرب الشعبة يعيد إصدار كلمة مرور متدربه', r.ok, r.body);
  check('…والجديدة تعمل للمتدرب', (await login('446000002', 'Re-issued-22')).ok);
  r = await docMerge('tacc', '446000003', { st: 'new' }, T.t1.token);
  check('المدرب لا يدير حساب متدرب ليس في شعبه', !r.ok);
  r = await docMerge('tacc', '446000001', { user: '999' }, T.t1.token);
  check('اسم مستخدم المتدرب (رقمه) لا يُعدَّل', !r.ok);
  const tr = (await docList('doc', T.s1.token));
  const tdocs = (await req('/rest/v1/doc?select=col,id', { token: T.s1.token })).body || [];
  check('المتدرب لا يقرأ وثائق المنصة', Array.isArray(tdocs) && tdocs.length === 0, tdocs.length);
  r = await docMerge('marks', '63854', { m: { '446000001': { d14480310: 'ح' } } }, T.s1.token);
  check('المتدرب لا يعدّل التحضير', !r.ok);
  const me = (await rpc('trainee_me', {}, T.s1.token)).body;
  check('بوابة المتدرب: بياناته فقط', me.id === '446000001' && Object.keys(me.sections).join() === '63854' && me.sections['63854'].rows.length === 1, me);
  check('…وتحضيره هو', JSON.stringify(me.marks) === JSON.stringify({ 63854: { m: { 446000001: { d14480310: 'غ' } } } }), me.marks);
  check('…وإنذاراته هو', me.warn.length === 1 && me.warn[0].crn === '63854', me.warn);
  check('…واسم مدربه', me.sections['63854'].trainerName === 'مدرب أول');
  const T2 = await login('446000002', 'Re-issued-22');
  const me2 = (await rpc('trainee_me', {}, T2.token)).body;
  check('متدرب في شعبتين يرى الشعبتين وصفه وحده في كل منهما', Object.keys(me2.sections).sort().join() === '63854,63912' && Object.values(me2.sections).every((s) => s.rows.length === 1 && s.rows[0].id === '446000002'), me2.sections);
  const np2 = pwFields('Mine-new-pass9');
  r = await rpc('trainee_set_password', { p_salt: np2.salt, p_iter: np2.iter, p_hash: np2.hash }, T.s1.token);
  check('المتدرب يغيّر كلمة مروره', r.ok, r.body);
  check('…فتعمل الجديدة', (await login('446000001', 'Mine-new-pass9')).ok);
  r = await rpc('trainee_touch', {}, T.s1.token);
  check('تسجيل أول دخول للمتدرب', r.ok && sql(`select data->'first'->>'at' is not null from doc where col='tacc' and id='446000001'`) === 't', r.body);

  console.log('\n— التحضير المباشر عبر QR —');
  const key = crypto.randomBytes(32).toString('base64');
  r = await docSet('meta', 'qrkey', { k: key, at: new Date().toISOString() }, T.t1.token);
  check('المدرب ينشئ مفتاح QR لأول مرة', r.ok, r.body);
  r = await docSet('meta', 'qrkey', { k: 'AAAA', at: 'x' }, T.t2.token);
  check('…ولا يستبدله أحد بعد ذلك', !r.ok && sql(`select data->>'k' from doc where col='meta' and id='qrkey'`) === key);
  const now = Date.now(), sid = 'ABCDEFGH23';
  const sess = { sid, crn: '63854', d: '10/03/1448', dk: 'd14480310', course: 'مقرر أ', trainer: IDS.t1, trainerName: 'مدرب أول', gen: 1, status: 'open', start: new Date(now - 10 * 60000).toISOString(), end: new Date(now + 15 * 60000).toISOString(), mins: 15, rotate: 30, grace: 90, static: false, ins: {}, rej: {}, log: {} };
  r = await docSet('qrs', sid, sess, T.t1.token);
  check('المدرب يفتح جلسة QR لشعبته', r.ok, r.body);
  r = await docSet('qrs', 'ZZZZZZZZZZ', Object.assign({}, sess, { sid: 'ZZZZZZZZZZ', crn: '63912' }), T.t1.token);
  check('…ولا يفتحها لشعبة غيره', !r.ok);
  const slot = Math.floor(now / 1000 / 30), code = `H1.${sid}.${slot}.${sig(key, `${sid}.1.${slot}`)}`;
  const T1b = await login('446000001', 'Mine-new-pass9');
  r = await rpc('qr_checkin', { p_code: code }, T1b.token);
  check('المتدرب يحضّر بمسح الرمز', r.ok && r.body.ok, r.body);
  check('…وتأخره بالدقائق من بداية المحاضرة (≈10 د)', r.body.code === 'م' + r.body.late && r.body.late >= 9 && r.body.late <= 11, r.body);
  check('…ويظهر في كشف التحضير فوراً', sql(`select data->'m'->'446000001'->>'d14480310' from doc where col='marks' and id='63854'`) === r.body.code);
  check('…ومع ملاحظة وقت المسح', /^QR: مسح \d\d:\d\d، تأخر \d+ د$/.test(sql(`select data->'n'->'446000001'->>'d14480310' from doc where col='notes' and id='63854'`)));
  check('…وفي سجل الجلسة', sql(`select data->'ins'->'446000001'->>'direct' from doc where col='qrs' and id='${sid}'`) === 'true');
  check('…وفي سجل التدقيق', sql(`select count(*) from audit where act='qr-direct' and trainee_id='446000001'`) === '1');
  r = await rpc('qr_checkin', { p_code: code }, T1b.token);
  check('لا يُسجَّل الحضور مرتين', r.body.ok === false && r.body.why === 'dup', r.body);
  const T3 = await login('446000002', 'Re-issued-22');
  r = await rpc('qr_checkin', { p_code: code.slice(0, -1) + (code.slice(-1) === 'A' ? 'B' : 'A') }, T3.token);
  check('رمز معدّل يُرفض', r.body.why === 'forged', r.body);
  const oldSlot = slot - 10, oldCode = `H1.${sid}.${oldSlot}.${sig(key, `${sid}.1.${oldSlot}`)}`;
  r = await rpc('qr_checkin', { p_code: oldCode }, T3.token);
  check('صورة رمز قديمة تُرفض', r.body.why === 'stale', r.body);
  r = await rpc('qr_checkin', { p_code: code }, T3.token);
  check('متدرب ثان في الشعبة نفسها يحضّر', r.body.ok === true, r.body);
  check('…وحالته السابقة «ح» تبقى كما هي', r.body.applied === 'بقي «ح»' || r.body.prev === '', r.body);
  const sid2 = 'QWERTYUPAS';
  sql(`insert into doc (col,id,data) values ('qrs','${sid2}', ${j(Object.assign({}, sess, { sid: sid2, crn: '63912', trainer: IDS.t2 }))})`);
  const code2 = `H1.${sid2}.${slot}.${sig(key, `${sid2}.1.${slot}`)}`;
  r = await rpc('qr_checkin', { p_code: code2 }, T1b.token);
  check('رمز شعبة لا يتبعها المتدرب يُرفض', r.body.why === 'notin', r.body);
  sql(`update doc set data = data || '{"gen":2}'::jsonb where col='qrs' and id='${sid2}'`);
  const T4 = await login('446000002', 'Re-issued-22');
  r = await rpc('qr_checkin', { p_code: code2 }, T4.token);
  check('رمز أُلغي وأعيد توليده يُرفض', r.body.why === 'revoked', r.body);
  sql(`update doc set data = data || jsonb_build_object('status','closed','closedAt','${new Date(now - 1000).toISOString()}', 'gen', 1) where col='qrs' and id='${sid2}'`);
  r = await rpc('qr_checkin', { p_code: code2 }, T4.token);
  check('رمز جلسة مغلقة يُرفض', r.body.why === 'late', r.body);
  r = await rpc('qr_checkin', { p_code: code }, T.t1.token);
  check('حساب المدرب لا يحضّر بالرمز', r.body.ok === false && r.body.why === 'notrainee', r.body);

  L.done('اختبار الخادم');
})().catch((e) => { console.error(e); process.exit(1); });
