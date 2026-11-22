// اختبار نموذج إدخال الدرجات من البداية إلى النهاية على الخادم المحلي:
// تنزيل النموذج من المنصة ← فحص المصنف ← إدخال درجات ← رفعه ← معاينة ← اعتماد ← حفظ على الخادم
// ← تحديث ← تراجع ← رفض مصنف فصل آخر ومصنف مدرب آخر ← تحقق الخادم من الصلاحيات والقيم.
// قوائم المتدربين من المصنف الحقيقي (GRADES_XLSX، لا يُحفظ في المستودع)، والدرجات مصطنعة.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const L = require('./lib');
const { sql, check, pwFields } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const WB = process.env.GRADES_XLSX;
const OUT = process.env.OUT || '/tmp/claude-0/-home-claude/da2fea53-9caa-5476-bb95-529d935e4850/scratchpad/gxtest';
if (!WB || !fs.existsSync(WB)) { console.log('تخطٍّ: لم يُحدد GRADES_XLSX'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const j = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";
const py = (code, ...args) => execFileSync('python3', ['-W', 'ignore', '-c', code, ...args], { encoding: 'utf8' }).trim();

const INFO = JSON.parse(py(`
import openpyxl, sys, json
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
o = {}
for ws in wb.worksheets[3:]:
    crn = ws.title.split()[0]
    o[crn] = [[str(ws.cell(r, 3).value), ws.cell(r, 2).value] for r in range(7, ws.max_row + 1) if ws.cell(r, 3).value]
print(json.dumps(o, ensure_ascii=False))`, WB));
const IDS = { admin: 'uadmin00000000001', t1: 'utrain00000000001', t2: 'utrain00000000002' };
const PW = { admin: 'Admin#2026x', t1: 'Trainer1-pass', t2: 'Trainer2-pass' };
function seed() {
  sql(`truncate doc, credential, trainee_account, trainee, audit, grade_import cascade; delete from app_user; delete from auth.users;`);
  const acc = (id, username, name, role, pw) => Object.assign({ id, username, name, role, active: true, perms: { past: true, sync: true, export: true }, createdAt: '2026-11-01T00:00:00Z' }, pwFields(pw));
  const sec = (crn, course, tr) => ({ crn, course, kind: 'نظري', order: 0, dept: 'قسم الحاسب وتقنية المعلومات', trainer: tr, meets: [{ day: 'الأحد', start: '08:00', dur: 100 }], dates: [], rows: INFO[crn].map((r) => ({ id: r[0], name: r[1] })) });
  [['accounts', IDS.admin, acc(IDS.admin, 'aalkhathami', 'مسؤول تجريبي', 'admin', PW.admin)],
    ['accounts', IDS.t1, acc(IDS.t1, 't.ahmed', 'مدرب أول', 'trainer', PW.t1)], ['accounts', IDS.t2, acc(IDS.t2, 't.saad', 'مدرب ثان', 'trainer', PW.t2)],
    ['sections', '63854', sec('63854', 'التوجيه والتحويل 1', IDS.t1)], ['sections', '63905', sec('63905', 'تطبيقات الحاسب المتقدمة', IDS.t1)], ['sections', '63912', sec('63912', 'تطبيقات الحاسب المتقدمة', IDS.t2)],
    ['meta', 'settings', { warnT: 3, depT: 5, warnP: 8, depP: 10 }], ['meta', 'calendar', { rows: [] }],
  ].forEach(([c, id, d]) => sql(`insert into doc (col, id, data) values ('${c}', '${id}', ${j(d)})`));
}
const gm = (crn) => JSON.parse(sql(`select coalesce((select data from doc where col='gmarks' and id='${crn}'), '{}'::jsonb)`));
const gs = (crn) => JSON.parse(sql(`select data from doc where col='gsec' and id='${crn}'`) || 'null');

(async () => {
  seed();
  const browser = await chromium.launch(), errs = [];
  const mk = async () => { const c = await browser.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 1366, height: 860 }, acceptDownloads: true }); const p = await c.newPage(); await p.route('https://cdnjs.cloudflare.com/ajax/libs/xlsx/**', (r) => r.fulfill({ path: '/var/tmp/hstack/vendor/package/dist/xlsx.full.min.js', contentType: 'application/javascript' })); p.on('pageerror', (e) => errs.push(String(e).slice(0, 300))); return [c, p]; };
  const login = async (p, u, pw) => { await p.goto(URL0); await p.waitForSelector('#liU'); await p.fill('#liU', u); await p.fill('#liP', pw); await p.click('#liB'); await p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh && gReady(), null, { timeout: 30000 }); };
  const saved = (p) => p.waitForFunction(() => /محفوظة/.test(document.querySelector('#saved').textContent), null, { timeout: 15000 });
  const dl = async (p, sel, path) => { const [d] = await Promise.all([p.waitForEvent('download', { timeout: 30000 }), p.click(sel)]); await d.saveAs(path); return d.suggestedFilename(); };
  const entry = async (p, crn) => { await p.evaluate((c) => { A.gCrn = c; go('gentry'); }, crn); await p.waitForSelector(`[data-act="gx-imp"][data-crn="${crn}"]`, { timeout: 15000 }); };
  const upload = async (p, crn, file, all, over) => {
    await p.click(`[data-act="gx-imp"][data-crn="${crn}"]`);
    await p.waitForSelector('#modal input[data-change="gx-file"]', { state: 'attached' });
    await p.check(`#modal input[name="gxs"][value="${all ? 'all' : 'one'}"]`);
    if (over) await p.check('#gxo');
    await p.setInputFiles('#modal input[data-change="gx-file"]', file);
    await p.waitForFunction(() => /معاينة استيراد الدرجات|لا شيء للاستيراد/.test(document.querySelector('#modal').textContent), null, { timeout: 20000 });
    return p.textContent('#modal');
  };
  const approve = async (p) => { await p.click('#modal [data-act="g-xin-ok"]'); await p.waitForFunction(() => /حُفظت الدرجات في قاعدة البيانات|اكتمل الاستيراد جزئياً|لم يُحفظ الاستيراد/.test(document.querySelector('#modal').textContent), null, { timeout: 20000 }); return p.textContent('#modal'); };
  const close = (p) => p.click('#modal [data-act="modal-close"]');

  // 0) المسؤول يعتمد التوزيع من مصنف الدرجات الأصلي
  let [c, p] = await mk();
  await login(p, 'aalkhathami', PW.admin);
  await p.evaluate(() => go('gcfg'));
  await p.setInputFiles('input[data-change="g-dist-in"]', WB);
  await p.waitForSelector('#modal [data-act="g-dist-ok"]', { timeout: 15000 });
  await p.click('#modal [data-act="g-dist-ok"]'); await saved(p);
  check('التوزيع معتمد في المنصة (5 شعب)', Number(sql(`select count(*) from doc where col='gsec'`)) === 5);
  await c.close();

  // 1) المدرب ينزّل النموذج من المنصة
  [c, p] = await mk();
  await login(p, 't.ahmed', PW.t1);
  await entry(p, '63854');
  const TPL = OUT + '/tpl.xlsx';
  const fname = await dl(p, '[data-act="gx-tpl"]', TPL);
  check('زر «تحميل نموذج إدخال الدرجات Excel» ينزّل مصنفاً', fs.existsSync(TPL) && fs.statSync(TPL).size > 10000, fname);
  await p.screenshot({ path: OUT + '/entry.png' });

  // 2) فحص المصنف
  const X = JSON.parse(py(`
import openpyxl, sys, json, zipfile
p = sys.argv[1]
wb = openpyxl.load_workbook(p)
o = {'sheets': wb.sheetnames, 'states': {ws.title: ws.sheet_state for ws in wb.worksheets}}
o['meta'] = json.loads(wb['_haader']['A2'].value)
s = wb['63854']
o['rtl'] = s.sheet_view.rightToLeft; o['freeze'] = s.freeze_panes; o['filter'] = s.auto_filter.ref; o['prot'] = bool(s.protection.sheet)
o['footer'] = s.oddFooter.center.text if s.oddFooter and s.oddFooter.center else ''
hdr = [c.value for c in s[5]]
o['hdr'] = hdr
ids = [str(s.cell(r, 2).value) for r in range(6, s.max_row + 1) if s.cell(r, 2).value and str(s.cell(r, 2).value).isdigit()]
o['ids'] = ids
o['unlocked'] = sum(1 for row in s.iter_rows(min_row=6) for c in row if c.protection and c.protection.locked is False)
o['dv'] = sum(len(list(d.sqref.ranges)) for d in s.data_validations.dataValidation)
o['dvsample'] = s.data_validations.dataValidation[0].formula1 if s.data_validations.dataValidation else ''
o['cf'] = len(s.conditional_formatting)
z = zipfile.ZipFile(p)
o['charts'] = [n for n in z.namelist() if n.startswith('xl/charts/')]
o['s5'] = [c.value for c in wb['63905'][5]]
o['homeA1'] = wb['الرئيسية']['A1'].value
print(json.dumps(o, ensure_ascii=False, default=str))`, TPL));
  check('أوراق المصنف: الرئيسية، التعليمات، ورقة لكل شعبة باسم رقمها، التوزيع، الإعدادات', JSON.stringify(X.sheets) === JSON.stringify(['الرئيسية', 'التعليمات', '63854', '63905', 'توزيع الدرجات', 'الإعدادات', '_haader']), X.sheets);
  check('شعب المدرب وحده (63912 لمدرب آخر ليست فيه)', !X.sheets.includes('63912'));
  check('ورقة المعرّف مخفية تماماً', X.states._haader === 'veryHidden');
  check('المعرّف: الفصل والمدرب والشعب والبصمة', X.meta.trainer === IDS.t1 && /الفصل التدريبي الأول 1448/.test(X.meta.term) && X.meta.crns.join() === '63854,63905' && X.meta.sigs['63854'] && /^HGB-/.test(X.meta.id), X.meta);
  check('كل متدربي الشعبة بأرقامهم ودون تكرار، وغير القابلين للرصد في آخر الورقة', JSON.stringify(X.ids) === JSON.stringify(gs('63854').rows.filter((r) => r.el).concat(gs('63854').rows.filter((r) => !r.el)).map((r) => r.id)) && new Set(X.ids).size === X.ids.length, X.ids.length);
  check('RTL وتثبيت العناوين والفلاتر والحماية', X.rtl === true && X.freeze === 'D6' && /^A5:/.test(X.filter || '') && X.prot, [X.rtl, X.freeze, X.filter, X.prot]);
  check('تذييل: الكلية التقنية ببيشة – منصة حاضر Haader', /الكلية التقنية ببيشة – منصة حاضر Haader/.test(X.footer), X.footer);
  check('الخلايا المفتوحة للإدخال = القابلون للرصد × خلايا الإدخال (17 × 10)', X.unlocked === 170, X.unlocked);
  check('تحقق على كل خلية إدخال (رقم، 0 إلى الحد، خانتان)', X.dv === 170 && /ISNUMBER/.test(X.dvsample) && /ROUND/.test(X.dvsample), [X.dv, X.dvsample]);
  check('تنسيق شرطي للناقص والخاطئ والمكتمل والمكرر', X.cf >= 12, X.cf);
  check('العناوين وفق التوزيع المعتمد (البنود ثم LEC1 ثم LEC2 والمجاميع والتقدير والحالة)', X.hdr.includes('LEC1 أعمال الفصل (30)') && X.hdr.includes('LEC2 الاختبار النهائي (20)') && X.hdr.includes('الواجبات (6)') && X.hdr.includes('التقدير') && X.hdr.includes('الحالة') && X.hdr.includes('المجموع (100)'), X.hdr);
  check('شعبة بلا بنود: LAB1 60 وLAB2 40 مباشرة', X.s5.includes('LAB1 أعمال الفصل (60)') && X.s5.includes('LAB2 الاختبار النهائي (40)'), X.s5);
  check('رسمان بيانيان في الصفحة الرئيسية', X.charts.filter((n) => /chart\d\.xml$/.test(n)).length === 2, X.charts);

  // 3) إدخال درجات مصطنعة في المصنف (كما يفعل المدرب في Excel)
  const el54 = gs('63854').rows.filter((r) => r.el).map((r) => r.id), el05 = gs('63905').rows.filter((r) => r.el).map((r) => r.id), inel = gs('63854').rows.find((r) => !r.el).id;
  const F1 = OUT + '/filled1.xlsx';
  py(`
import openpyxl, sys, json
wb = openpyxl.load_workbook(sys.argv[1]); ids = json.loads(sys.argv[3])
def put(sh, tid, vals):
    s = wb[sh]; hdr = [c.value for c in s[5]]
    for r in range(6, s.max_row + 1):
        if str(s.cell(r, 2).value) == tid:
            seen = {}
            for h, v in vals:
                idx = [i for i, x in enumerate(hdr) if x == h]
                k = seen.get(h, 0); seen[h] = k + 1
                s.cell(r, idx[k] + 1).value = v
for n, tid in enumerate(ids['a']):
    # الواجبات والمشاركة والشهريان للنظري ثم العملي (العنوان نفسه مكرر: الأول للنظري)
    put('63854', tid, [('الواجبات (6)', 5), ('المشاركة (4)', 4), ('الشهري 1 (10)', 8), ('الشهري 2 (10)', 9.5), ('LEC2 الاختبار النهائي (20)', 18), ('الواجبات (6)', 6), ('المشاركة (4)', 3), ('الشهري 1 (10)', 10), ('الشهري 2 (10)', 7), ('LAB2 الاختبار النهائي (20)', 15)])
put('63854', ids['part'], [('الواجبات (6)', 4)])
put('63854', ids['bad'], [('LEC2 الاختبار النهائي (20)', 25)])
put('63905', ids['b'], [('LAB1 أعمال الفصل (60)', 55), ('LAB2 الاختبار النهائي (40)', 30)])
wb.save(sys.argv[2])`, TPL, F1, JSON.stringify({ a: el54.slice(0, 3), part: el54[3], bad: el54[4], b: el05[0] }));

  // 4) إعادة الحساب في برنامج جداول حقيقي (LibreOffice) للتحقق من المعادلات
  let recalc = null;
  try {
    execFileSync('soffice', ['--headless', '--calc', '--convert-to', 'xlsx:Calc MS Excel 2007 XML', '--outdir', OUT + '/lo', F1], { stdio: 'pipe', timeout: 120000 });
    recalc = JSON.parse(py(`
import openpyxl, sys, json
wb = openpyxl.load_workbook(sys.argv[1], data_only=True); s = wb['63854']; hdr = [c.value for c in s[5]]
col = lambda h, k=0: [i for i, x in enumerate(hdr) if x == h][k] + 1
row = lambda tid: [r for r in range(6, s.max_row + 1) if str(s.cell(r, 2).value) == tid][0]
a, p_, b = sys.argv[2], sys.argv[3], sys.argv[4]
o = {'lec1': s.cell(row(a), col('LEC1 أعمال الفصل (30)')).value, 'tot': s.cell(row(a), col('المجموع (100)')).value, 'gr': s.cell(row(a), col('التقدير')).value, 'st': s.cell(row(a), col('الحالة')).value,
     'pst': s.cell(row(p_), col('الحالة')).value, 'plec1': s.cell(row(p_), col('LEC1 أعمال الفصل (30)')).value, 'bst': s.cell(row(b), col('الحالة')).value}
h = wb['الرئيسية']
o['home'] = [[h.cell(r, c).value for c in range(1, 12)] for r in range(21, 25)]
print(json.dumps(o, ensure_ascii=False, default=str))`, OUT + '/lo/filled1.xlsx', el54[0], el54[3], el54[4]));
  } catch (e) { recalc = { err: String(e).slice(0, 200) }; }
  check('المعادلات بعد إعادة الحساب: LEC1 = 26.5 والمجموع 85.5 والتقدير ب+ والحالة مكتمل', recalc && recalc.lec1 === 26.5 && recalc.tot === 85.5 && recalc.gr === 'ب+' && recalc.st === 'مكتمل', recalc);
  check('البنود الناقصة: LEC1 فارغة لا صفر، والحالة «ناقص»', recalc && (recalc.plec1 === null || recalc.plec1 === '') && recalc.pst === 'ناقص', recalc && [recalc.plec1, recalc.pst]);
  check('الدرجة المتجاوزة للحد: «خطأ في الإدخال»', recalc && recalc.bst === 'خطأ في الإدخال', recalc && recalc.bst);
  check('الصفحة الرئيسية: المؤشرات تُحسب من أوراق الشعب', recalc && recalc.home && recalc.home[1] && recalc.home[1][1] === '63854' && recalc.home[1][7] === 3 && recalc.home[1][5] === 32, recalc && recalc.home);

  // 5) رفع المصنف لكل الشعب ← معاينة ← اعتماد
  await entry(p, '63854');
  let t = await upload(p, '63854', F1, true, false);
  check('المعاينة: معرّف المصنف ظاهر', /HGB-/.test(t) && /الفصل التدريبي الأول 1448/.test(t), t.slice(0, 200));
  check('المعاينة: 3×4 + 2 = 14 درجة جديدة في الشعبتين', /درجات جديدة\s*14/.test(t), t.slice(0, 400));
  check('المعاينة: المرفوض بأسبابه (التجاوز والبنود الناقصة)', /تتجاوز|الحد الأعلى/.test(t) && /ناقصة/.test(t), t);
  check('زر تنزيل تقرير الأخطاء متاح', !!(await p.$('#modal [data-act="gx-err"]')));
  const ER = OUT + '/errors.xlsx'; await dl(p, '#modal [data-act="gx-err"]', ER);
  const erows = JSON.parse(py(`
import openpyxl, sys, json
s = openpyxl.load_workbook(sys.argv[1]).active
print(json.dumps([[c.value for c in r] for r in s.iter_rows(min_row=5, values_only=False)], ensure_ascii=False, default=str))`, ER));
  check('تقرير الأخطاء: الشعبة والرقم والسبب', erows.length >= 2 && erows.some((r) => r[1] === '63854' && String(r[2]) === el54[4]), erows.slice(0, 3));
  await p.screenshot({ path: OUT + '/preview.png' });
  t = await approve(p);
  check('رسالة النجاح بعد تأكيد الخادم', /حُفظت الدرجات في قاعدة البيانات/.test(t) && /أكد الخادم حفظ 14 درجة/.test(t), t.slice(0, 300));
  await p.screenshot({ path: OUT + '/result.png' });
  let m = gm('63854');
  check('حُفظت في قاعدة البيانات: LEC1 = 26.5 وLEC2 18 وLAB1 26 وLAB2 15', m.g[el54[0]].LEC1 === 26.5 && m.g[el54[0]].LEC2 === 18 && m.g[el54[0]].LAB1 === 26 && m.g[el54[0]].LAB2 === 15, m.g[el54[0]]);
  check('…والبنود التفصيلية، والبنود الناقصة محفوظة بلا درجة مكوّن', m.s[el54[0]].LEC1['الشهري 2'] === 9.5 && m.s[el54[3]].LEC1['الواجبات'] === 4 && !(m.g[el54[3]] || {}).LEC1, m.s[el54[3]]);
  check('الدرجة المتجاوزة لم تُحفظ', !(m.g[el54[4]] || {}).LEC2);
  check('الشعبة الثانية 63905: LAB1 55 وLAB2 30', gm('63905').g[el05[0]].LAB1 === 55 && gm('63905').g[el05[0]].LAB2 === 30);
  const gi = JSON.parse(sql(`select coalesce(jsonb_agg(jsonb_build_object('crn',crn,'by',by_legacy,'name',by_name,'add',n_add,'wb',wb->>'id','file',file) order by crn), '[]') from grade_import`));
  check('سجل الاستيراد على الخادم: المدرب والوقت والملف والمعرّف لكل شعبة', gi.length === 2 && gi.every((x) => x.by === IDS.t1 && x.name === 'مدرب أول' && /^HGB-/.test(x.wb)) && gi[0].add === 12, gi);
  check('سجل التدقيق: سطر لكل درجة', Number(sql(`select count(*) from audit where act='grade_import'`)) === 14);
  check('انعكاس الدرجات في المنصة فوراً', await p.evaluate((id) => G.val(gMarks('63854'), id, 'LEC1') === 26.5, el54[0]));
  await close(p);

  // 6) تصدير الدرجات وإعادة الاستيراد دون فقدان
  await entry(p, '63854');
  const T2 = OUT + '/tpl2.xlsx'; await dl(p, '[data-act="gx-tpl"]', T2);
  const pre = JSON.parse(py(`
import openpyxl, sys, json
s = openpyxl.load_workbook(sys.argv[1])['63854']; hdr = [c.value for c in s[5]]
r = [r for r in range(6, s.max_row + 1) if str(s.cell(r, 2).value) == sys.argv[2]][0]
print(json.dumps([s.cell(r, i + 1).value for i in range(len(hdr))], default=str))`, T2, el54[0]));
  check('النموذج المنزّل يأتي بالدرجات المحفوظة', pre.includes(9.5) && pre.includes(18) && pre.includes(15), pre);
  t = await upload(p, '63854', T2, false, false);
  check('إعادة رفع المصنف المنزّل دون تعديل: لا جديد ولا تغيير', /درجات جديدة\s*0/.test(t) && /تخالف المحفوظ\s*0/.test(t), t.slice(0, 300));
  await close(p);

  // 7) تحديث الدرجات السابقة: دون الخيار تبقى، ومعه تُستبدل مع عرض القديمة والجديدة
  const F3 = OUT + '/filled3.xlsx';
  py(`
import openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1]); s = wb['63854']; hdr = [c.value for c in s[5]]
r = [r for r in range(6, s.max_row + 1) if str(s.cell(r, 2).value) == sys.argv[3]][0]
s.cell(r, hdr.index('LEC2 الاختبار النهائي (20)') + 1).value = 19.5
wb.save(sys.argv[2])`, T2, F3, el54[0]);
  t = await upload(p, '63854', F3, false, false);
  check('المعاينة تعرض القديمة 18 والجديدة 19.5', /تخالف المحفوظ\s*1/.test(t) && /18/.test(t) && /19\.5/.test(t), t.slice(0, 500));
  t = await approve(p);
  check('دون «تحديث الدرجات السابقة» تبقى المحفوظة (18)', gm('63854').g[el54[0]].LEC2 === 18 && /أُبقيت 1 درجة/.test(t), [gm('63854').g[el54[0]].LEC2, t.slice(0, 200)]);
  await close(p);
  t = await upload(p, '63854', F3, false, true);
  check('خيار التحديث محدد مسبقاً في المعاينة', await p.isChecked('#giOver'));
  t = await approve(p);
  check('مع «تحديث الدرجات السابقة»: 19.5', gm('63854').g[el54[0]].LEC2 === 19.5, gm('63854').g[el54[0]]);
  await close(p);

  // 8) التراجع عن آخر عملية
  await entry(p, '63854');
  await p.waitForSelector('#gxHist [data-act="gx-undo"]', { timeout: 15000 });
  const hist = await p.textContent('#gxHist');
  check('سجل استيراد الدرجات ظاهر في نافذة الإدخال', /سجل استيراد الدرجات/.test(hist) && /HGB-|GI/.test(hist), hist.slice(0, 200));
  await p.click('#gxHist [data-act="gx-undo"]');
  await p.click('#modal [data-act="gx-undo-ok"]');
  await p.waitForFunction(() => /تم التراجع/.test(document.querySelector('#modal').textContent), null, { timeout: 15000 });
  check('التراجع يعيد القيمة السابقة (18)', gm('63854').g[el54[0]].LEC2 === 18, gm('63854').g[el54[0]]);
  check('…ويُسجَّل على الخادم', sql(`select status from grade_import order by at desc limit 1`) === 'undone' && Number(sql(`select count(*) from audit where act='grade_import_undo'`)) === 1);

  await close(p);
  // 8ب) رصد الدرجات دفعة واحدة من لوحة قيادة الاختبارات، والبند التفصيلي المخالف للمحفوظ لا يُستبدل دون موافقة
  const old54 = gm('63854').s[el54[0]].LEC1['الواجبات'], new54 = old54 === 2 ? 3 : 2, F4b = OUT + '/filled4.xlsx';
  py(`
import openpyxl, sys
wb = openpyxl.load_workbook(sys.argv[1]); s = wb['63854']; hdr = [c.value for c in s[5]]
r = [r for r in range(6, s.max_row + 1) if str(s.cell(r, 2).value) == sys.argv[3]][0]
s.cell(r, hdr.index('الواجبات (6)') + 1).value = float(sys.argv[4])
wb.save(sys.argv[2])`, T2, F4b, el54[0], String(new54));
  await p.evaluate(() => go('gdash'));
  await p.waitForSelector('.gxall input[data-change="gx-file-all"]', { state: 'attached', timeout: 15000 });
  check('لوحة قيادة الاختبارات: «رصد الدرجات دفعة واحدة» بزر الاستيراد لجميع المقررات والشعب', /رصد الدرجات دفعة واحدة/.test(await p.textContent('.gxall')) && /استيراد المصنف لجميع المقررات والشعب/.test(await p.textContent('.gxall')));
  await p.setInputFiles('.gxall input[data-change="gx-file-all"]', F4b);
  await p.waitForFunction(() => /معاينة استيراد الدرجات|لا شيء للاستيراد/.test(document.querySelector('#modal').textContent), null, { timeout: 20000 });
  t = await p.textContent('#modal');
  check('معاينة واحدة لكل المقررات والشعب: المقرر والشعبة وعدد المتدربين', /الشعب\s*2/.test(t) && /التوجيه والتحويل/.test(t) && /تطبيقات الحاسب/.test(t) && /63854/.test(t) && /63905/.test(t), t.slice(0, 500));
  check('البند التفصيلي المخالف للمحفوظ ظاهر بالقديمة والجديدة', /تخالف المحفوظ\s*1/.test(t) && /LEC1 › الواجبات/.test(t), t.slice(0, 600));
  t = await approve(p);
  check('دون «تحديث الدرجات السابقة» يبقى البند المحفوظ', gm('63854').s[el54[0]].LEC1['الواجبات'] === old54, [old54, gm('63854').s[el54[0]].LEC1]);
  await close(p);
  await p.evaluate(() => go('gdash'));
  await p.waitForSelector('.gxall input[data-change="gx-file-all"]', { state: 'attached', timeout: 15000 });
  await p.setInputFiles('.gxall input[data-change="gx-file-all"]', F4b);
  await p.waitForSelector('#giOver', { timeout: 20000 }); await p.check('#giOver');
  t = await approve(p);
  check('ومع الموافقة يُستبدل', gm('63854').s[el54[0]].LEC1['الواجبات'] === new54, gm('63854').s[el54[0]].LEC1);
  await close(p);
  // 8ج) تلوين الدرجات
  await entry(p, '63854');
  const tone = await p.evaluate(() => ({ lo: gTone(1, 10), hi: gTone(9, 10), mid: gTone(5, 10), none: gTone(null, 10), cells: [...document.querySelectorAll('#gBody td.gitc[style], #gBody .gin[style], #gBody td.gtot[style], #gBody td.gsumc[style]')].length, items: document.querySelectorAll('#gBody td.gitc').length, key: !!document.querySelector('.gtkey') }));
  check('تلوين الدرجات: المنخفضة بالأحمر والمرتفعة بالأزرق، ومفتاح الألوان', /220,38,38/.test(tone.lo) && /37,99,235/.test(tone.hi) && tone.none === '' && tone.key, tone);
  check('جدول الإدخال يعرض البنود التفصيلية ملوّنة', tone.items > 0 && tone.cells > 0, tone);
  const cf = JSON.parse(py(`
import openpyxl, sys, json
wb = openpyxl.load_workbook(sys.argv[1]); s = wb['63854']
print(json.dumps(sum(1 for r in s.conditional_formatting for x in r.rules if x.type == 'colorScale')))`, T2));
  check('نموذج Excel: تدرج لوني للدرجات والمجاميع', cf >= 10, cf);

  // 9) مصنف فصل تدريبي سابق: مرفوض
  const F4 = OUT + '/oldterm.xlsx';
  py(`
import openpyxl, sys, json
wb = openpyxl.load_workbook(sys.argv[1]); m = json.loads(wb['_haader']['A2'].value); m['term'] = 'الفصل التدريبي الثاني 1447هـ'; wb['_haader']['A2'].value = json.dumps(m, ensure_ascii=False); wb.save(sys.argv[2])`, F3, F4);
  t = await upload(p, '63854', F4, true, true);
  check('مصنف فصل سابق يُرفض برسالة واضحة', /لا شيء للاستيراد/.test(t) && /1447/.test(t) && /فصل تدريبي آخر/.test(t), t);
  await close(p);
  await c.close();

  // 10) مصنف مدرب آخر: مرفوض. ومن الخادم مباشرة: لا استيراد لشعبة غير مسندة
  [c, p] = await mk();
  await login(p, 't.saad', PW.t2);
  await entry(p, '63912');
  t = await upload(p, '63912', F3, true, false);
  check('مصنف مدرب آخر يُرفض', /لا شيء للاستيراد/.test(t) && /أُنشئ لحساب «مدرب أول»/.test(t), t);
  await close(p);
  const srv = await p.evaluate(async (id) => {
    const o = {};
    try { await HAADER_WEB.rpc('grades_import', { p_crn: '63854', p_rows: [{ id, k: 'LEC2', v: 20 }], p_items: {}, p_overwrite: true, p_file: 'x', p_wb: {} }); o.foreign = 'ok'; } catch (e) { o.foreign = e.message; }
    try { await HAADER_WEB.rpc('doc_merge', { p_col: 'gmarks', p_id: '63854', p_patch: { g: { [id]: { LEC2: 20 } } } }); o.direct = 'ok'; } catch (e) { o.direct = e.message; }
    return o;
  }, el54[0]);
  check('الخادم يرفض استيراد مدرب لشعبة غير مسندة إليه', /غير مسندة إليك/.test(srv.foreign), srv.foreign);
  check('الخادم يرفض الكتابة المباشرة على درجات شعبة أخرى', srv.direct !== 'ok', srv.direct);
  check('الدرجة لم تتغير (18)', gm('63854').g[el54[0]].LEC2 === 18);
  await c.close();

  // 11) حارس الخادم على الكتابة المباشرة (حتى من مدرب الشعبة نفسه)
  [c, p] = await mk();
  await login(p, 't.ahmed', PW.t1);
  const g2 = await p.evaluate(async (a) => {
    const o = {}, t = async (k, patch) => { try { await HAADER_WEB.rpc('doc_merge', { p_col: 'gmarks', p_id: '63854', p_patch: patch }); o[k] = 'ok'; } catch (e) { o[k] = e.message; } };
    await t('over', { g: { [a.id]: { LEC2: 99 } } });
    await t('neg', { g: { [a.id]: { LEC2: -1 } } });
    await t('text', { g: { [a.id]: { LEC2: 'abc' } } });
    await t('dec', { g: { [a.id]: { LEC2: 10.123 } } });
    await t('comp', { g: { [a.id]: { XYZ1: 5 } } });
    await t('inel', { g: { [a.inel]: { LEC2: 5 } } });
    await t('ok', { g: { [a.id]: { LEC2: 17.25 } } });
    try { const r = await HAADER_WEB.rpc('grades_import', { p_crn: '63854', p_rows: [{ id: a.id, k: 'LEC2', v: 21 }, { id: a.id2, k: 'LEC1', v: 10 }], p_items: { [a.id3]: { LEC1: { 'الواجبات': 7 } } }, p_overwrite: true, p_file: 'x', p_wb: {} }); o.rpcbad = r.bad.map((b) => b.msg); o.rpcn = r.add + r.chg; } catch (e) { o.rpcbad = e.message; }
    try { await HAADER_WEB.rpc('grades_import', { p_crn: '63854', p_rows: [{ id: a.id, k: 'LEC2', v: 5 }], p_items: {}, p_overwrite: true, p_file: 'x', p_wb: { id: 'HGB-X', term: 'الفصل التدريبي الثاني 1447هـ', trainer: 'utrain00000000001', crns: ['63854'] } }); o.term = 'ok'; } catch (e) { o.term = e.message; }
    return o;
  }, { id: el54[0], id2: el54[1], id3: el54[2], inel });
  check('الخادم يرفض: فوق الحد، السالب، النص، الخانات الزائدة، المكوّن غير المعتمد، غير القابل للرصد', ['over', 'neg', 'text', 'dec', 'comp', 'inel'].every((k) => g2[k] !== 'ok'), g2);
  check('…ويقبل الصحيحة (17.25)', g2.ok === 'ok' && gm('63854').g[el54[0]].LEC2 === 17.25, g2.ok);
  check('دالة الاستيراد على الخادم ترفض: 21 فوق الحد، وLEC1 مباشرة لها بنود، وبند 7 فوق 6', Array.isArray(g2.rpcbad) && g2.rpcbad.length === 3 && g2.rpcn === 0, g2.rpcbad);
  check('…وترفض معرّف فصل آخر', /1447/.test(g2.term || ''), g2.term);
  check('لا أخطاء JavaScript', errs.length === 0, errs);
  await c.close(); await browser.close();
  L.done('نموذج إدخال الدرجات Excel من البداية إلى النهاية');
})().catch((e) => { console.error(e); process.exit(1); });
