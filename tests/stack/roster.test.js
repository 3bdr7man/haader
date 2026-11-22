// إدارة الشعب والمتدربين: نموذج XLSX حقيقي (تنزيل وتعبئة وإعادة رفع)، واستيراد PDF نصي وممسوح ضوئياً (OCR)،
// والإدراج اليدوي، والمراجعة قبل الإدراج، والصلاحيات، والمزامنة إلى التحضير والدرجات، وسجل عمليات الاستيراد.
// يُشغَّل بعد e2e.test.js. أسماء المتدربين في الملفات تجريبية.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const L = require('./lib');
const { sql, check } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const FX = path.join(__dirname, 'fixtures');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'roster-'));
const q = (o) => JSON.stringify(o).replace(/'/g, "''");
const py = (code, ...args) => execFileSync('python3', ['-c', code, ...args], { encoding: 'utf8' }).trim();
const NEW = ['88101', '88201', '88301', '88401'];
const clean = () => sql(`select set_config('haader.sys','1',false); delete from doc where col in ('sections','marks','notes','gsec') and id in (${NEW.map((c) => `'${c}'`).join(',')}); delete from roster_import; delete from trainee where id like '4469%';`);

(async () => {
  clean();
  /* قائمة رصد الدرجات للشعبة 63854 (للتحقق من المزامنة إليها) */
  const hadG = +sql(`select count(*) from doc where col='gsec' and id='63854'`);
  if (!hadG) { const rows = JSON.parse(sql(`select data->'rows' from doc where col='sections' and id='63854'`)).map((r) => ({ id: r.id, name: r.name, el: true, st: 'مسجل' }));
    sql(`select set_config('haader.sys','1',false); insert into doc(col,id,data) values ('gsec','63854','${q({ crn: '63854', code: 'شبكا 121', name: 'مقدمة الشبكات', term: 'الفصل التدريبي الأول 1448هـ', comps: [{ k: 'LEC1', max: 60, part: 'نظري', desc: 'أعمال فصلية' }, { k: 'LEC2', max: 40, part: 'نظري', desc: 'نهائي' }], rows })}'::jsonb)`); }
  const rows0 = JSON.parse(sql(`select data->'rows' from doc where col='sections' and id='63854'`));
  const b = await chromium.launch(), errs = [];
  const open = async (user, pw, vp) => { const c = await b.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', acceptDownloads: true, viewport: vp || { width: 1300, height: 900 } }), p = await c.newPage();
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 200)));
    await p.route('https://cdnjs.cloudflare.com/ajax/libs/xlsx/**', (r) => r.fulfill({ path: '/var/tmp/hstack/vendor/package/dist/xlsx.full.min.js', contentType: 'application/javascript' }));
    await p.addInitScript(() => { const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { if (this.download) window.__dlName = this.download; return o.apply(this, arguments); }; });
    await p.goto(URL0); await p.waitForSelector('#liU'); await p.fill('#liU', user); await p.fill('#liP', pw); await p.click('#liB');
    await p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh, null, { timeout: 30000 }); return p; };
  const toast = (p) => p.evaluate(() => (document.getElementById('toast') || {}).textContent || '');
  const st = (p) => p.evaluate(() => { HAADER_RS.evalAll(); const c = { ok: 0, dup: 0, fix: 0, ex: 0 }; HAADER_RS.R.rows.forEach((r) => { c[r.st]++; }); return c; });
  const approve = async (p) => { await p.click('[data-act="rs-apply"]'); await p.waitForSelector('[data-act="rs-apply-ok"]'); await p.click('[data-act="rs-apply-ok"]');
    await p.waitForFunction(() => /اكتمل الإدراج/.test((document.getElementById('modal') || {}).textContent || ''), null, { timeout: 20000 });
    const t = await p.textContent('#modal'); await p.click('#modal [data-act="modal-close"]'); return t; };
  const waitSec = (p, crn) => p.waitForFunction((c) => A.raw.sections[c] && (A.raw.sections[c].rows || []).length, crn, { timeout: 20000 });

  /* ===== المدرب: الصفحة والقائمة ===== */
  const p = await open('t.ahmed', 'Trainer1-pass');
  check('القائمة: «إدارة الشعب والمتدربين» ظاهرة للمدرب', !!(await p.$('#nav a[data-v="roster"]')));
  await p.evaluate(() => go('roster')); await p.waitForSelector('.rs-actions');
  const home = await p.textContent('#main');
  check('الصفحة: البطاقات والمداخل الأربعة', /شعبي/.test(home) && /المتدربون/.test(home) && /تحميل نموذج إدراج الشعب والمتدربين \(XLSX\)/.test(home) && /استيراد بيانات Excel/.test(home) && /استيراد بيانات من PDF/.test(home) && /إدراج البيانات يدوياً/.test(home));
  check('المدرب يرى شعبه فقط في «شعبي»', /63854/.test(home) && !/63912/.test(home));

  /* ===== نموذج XLSX: تنزيل حقيقي ===== */
  await p.click('[data-act="rs-tpl"]'); await p.waitForSelector('[data-act="rs-tpl-ok"]');
  const [dl] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('[data-act="rs-tpl-ok"]')]);
  const tpl = path.join(TMP, 'tpl.xlsx'); await dl.saveAs(tpl);
  const dlName = await p.evaluate(() => window.__dlName);
  check('اسم الملف ونوعه XLSX', /نموذج إدراج الشعب والمتدربين.*\.xlsx$/.test(dlName) && fs.readFileSync(tpl).slice(0, 2).toString() === 'PK');
  const info = JSON.parse(py(`
import openpyxl,json,sys
wb=openpyxl.load_workbook(sys.argv[1]); o={'sheets':wb.sheetnames}
for n in ['بيانات الشعب','بيانات المتدربين']:
  ws=wb[n]; o[n]={'head':[c.value for c in ws[1]],'rtl':ws.sheet_view.rightToLeft,'freeze':ws.freeze_panes,'filter':ws.auto_filter.ref,'dv':[(d.type,str(d.sqref)[:20],(d.formula1 or '')[:90]) for d in ws.data_validations.dataValidation],'cf':len(ws.conditional_formatting),'fillA':ws['A1'].fill.fgColor.rgb,'fillD':ws['D1'].fill.fgColor.rgb,'rows':[[c.value for c in r] for r in ws.iter_rows(min_row=2,max_row=4)]}
o['ins']=' '.join(str(c.value) for r in wb['التعليمات'].iter_rows() for c in r if c.value)
o['states']={ws.title:ws.sheet_state for ws in wb.worksheets}
print(json.dumps(o,ensure_ascii=False))`, tpl));
  const S1 = info['بيانات الشعب'], S2 = info['بيانات المتدربين'];
  check('ورقتا «بيانات الشعب» و«بيانات المتدربين» ثم التعليمات', info.sheets[0] === 'بيانات الشعب' && info.sheets[1] === 'بيانات المتدربين' && info.sheets.includes('التعليمات') && info.states._lists === 'hidden', info.sheets);
  check('أعمدة الشعب كما في المواصفة', ['رقم الشعبة *', 'اسم المقرر *', 'رمز المقرر', 'الفصل التدريبي', 'العام التدريبي', 'اسم المدرب'].every((h, i) => S1.head[i] === h), S1.head);
  check('أعمدة المتدربين كما في المواصفة', ['رقم الشعبة *', 'الرقم التدريبي *', 'اسم المتدرب *', 'البريد الإلكتروني', 'رقم الجوال'].every((h, i) => S2.head[i] === h), S2.head);
  check('من اليمين إلى اليسار، وتثبيت صف العناوين، والفلاتر', S1.rtl && S2.rtl && S1.freeze === 'A2' && S2.freeze === 'A2' && /^A1:/.test(S1.filter) && /^A1:/.test(S2.filter));
  check('الحقول الإلزامية بلون مختلف', S2.fillA !== S2.fillD && S1.fillA === S2.fillA);
  const dvB = S2.dv.find((d) => /^B2:/.test(d[1])) || [];
  check('تحقق: الرقم التدريبي 9 أرقام ولا يتكرر داخل الشعبة', /LEN\(B2\)=9/.test(dvB[2] || '') && /COUNTIFS\(\$A\$2:\$A\$\d+,A2,\$B\$2:\$B\$\d+,B2\)=1/.test(dvB[2] || ''), dvB);
  check('قوائم تحقق (الفصل، العام، النوع، الأيام، الشعبة)', ['D2', 'E2', 'G2', 'H2'].every((c) => S1.dv.some((d) => d[0] === 'list' && d[1].startsWith(c + ':'))) && S2.dv.some((d) => d[0] === 'list' && d[1].startsWith('A2')));
  check('تنسيق شرطي يُبرز الأخطاء والتكرار', S1.cf >= 2 && S2.cf >= 3);
  check('ورقة التعليمات بخطوات وأمثلة', /خطوات التعبئة/.test(info.ins) && /مثال على ورقة «بيانات المتدربين»/.test(info.ins) && /لا يحذف الاستيراد/.test(info.ins));
  check('النموذج يتضمن شعب المدرب الحالية', S1.rows.some((r) => String(r[0]) === '63854'));

  /* ===== تعبئة النموذج ثم إعادة رفعه ===== */
  const filled = path.join(TMP, 'filled.xlsx');
  py(`
import openpyxl,sys
wb=openpyxl.load_workbook(sys.argv[1]); s=wb['بيانات الشعب']; t=wb['بيانات المتدربين']
r=s.max_row+1
while r>2 and s.cell(r-1,1).value is None: r-=1
for i,v in enumerate(['88201','برمجة الحاسب','حاسب 111','الفصل التدريبي الأول','1448','مدرب أول','عملي','الاثنين','09:00','الأربعاء','10:00',100]): s.cell(r,i+1,v)
rows=[['63854','446910001','بدر سامي فهد الحربي','446910001@tvtc.edu.sa','0551112233'],
['63854','446910002','راكان حمد سعود المطيري','',''],
['88201','446910003','يزن مشعل راشد العتيبي','446910003@tvtc.edu.sa','551114455'],
['88201','446910004','هشام زياد مبارك الدوسري','',''],
['88201','446910003','يزن مشعل راشد العتيبي','',''],
['88201','44691','اسم ناقص الرقم','',''],
['88201','446910005','مازن','',''],
['63854','446910001','بدر سامي فهد الحربي','',''],
['88201','446910006','حمزة ماهر عادل الشمري','bad-mail','12345']]
for i,row in enumerate(rows):
  for j,v in enumerate(row): t.cell(i+2,j+1,v)
wb.save(sys.argv[2])`, tpl, filled);
  await p.setInputFiles('input[data-change="rs-xlsx"]', filled);
  await p.waitForFunction(() => HAADER_RS.R.mode === 'review', null, { timeout: 20000 });
  let c = await st(p), R = await p.evaluate(() => ({ secs: HAADER_RS.R.secs.map((s) => [s.crn, s.st, s.err.length, s.course, s.kind, s.d1, s.t1]), rows: HAADER_RS.R.rows.map((r) => [r.crn, r.id, r.st, r.err.concat(r.warn).join(' ')]) }));
  check('قُرئت الشعب: 63854 موجودة و88201 جديدة بموعدها', R.secs.some((s) => s[0] === '63854' && s[1] === 'existing') && R.secs.some((s) => s[0] === '88201' && s[1] === 'new' && !s[2] && s[4] === 'عملي' && s[5] === 'الاثنين' && s[6] === '09:00'), R.secs);
  check('حالات البيانات: 4 صحيح، 2 مكرر، 3 يحتاج تصحيحاً', c.ok === 4 && c.dup === 2 && c.fix === 3, c);
  check('سبب «مكرر في البيانات نفسها» ويُعرض للمراجعة', R.rows.filter((r) => r[2] === 'dup').every((r) => /مكرر في البيانات نفسها/.test(r[3])));
  check('أسباب التصحيح: رقم ناقص، اسم ناقص، بريد وجوال غير صحيحين', R.rows.some((r) => r[1] === '44691' && /9 أرقام/.test(r[3])) && R.rows.some((r) => r[1] === '446910005' && /ناقص/.test(r[3])) && R.rows.some((r) => r[1] === '446910006' && /البريد/.test(r[3]) && /الجوال/.test(r[3])));
  const scr = await p.textContent('#main');
  check('شاشة «مراجعة البيانات قبل الإدراج» بأزرارها', /مراجعة البيانات قبل الإدراج/.test(scr) && /اعتماد جميع السجلات الصحيحة \(4\)/.test(scr) && /تنزيل تقرير الأخطاء/.test(scr) && /إلغاء عملية الاستيراد/.test(scr));
  /* تقرير الأخطاء */
  const [dle] = await Promise.all([p.waitForEvent('download', { timeout: 20000 }), p.click('[data-act="rs-errs"]')]);
  const ef = path.join(TMP, 'err.xlsx'); await dle.saveAs(ef);
  const er = JSON.parse(py(`
import openpyxl,json,sys
ws=openpyxl.load_workbook(sys.argv[1]).active; print(json.dumps([[c.value for c in r] for r in ws.iter_rows(min_row=4) if r[1].value or r[0].value],ensure_ascii=False))`, ef));
  check('تقرير الأخطاء XLSX: 5 سجلات بحالتها وسببها', er.filter((r) => /مكرر|يحتاج/.test(r[5] || '')).length === 5 && er.some((r) => r[1] === '44691' && /9 أرقام/.test(r[6])), er.length);
  /* تعديل سجل ثم الاستبعاد */
  await p.evaluate(() => { const r = HAADER_RS.R.rows.find((x) => x.id === '446910006'); r.email = '446910006@tvtc.edu.sa'; r.mobile = '0559998877'; HAADER_RS.evalAll(); render(true); });
  c = await st(p); check('تعديل السجل يصححه (يصبح صحيحاً)', c.ok === 5 && c.fix === 2, c);
  await p.click('[data-act="rs-ex-bad"]'); c = await st(p);
  check('استبعاد كل ما يحتاج تصحيحاً', c.ex === 2 && c.fix === 0, c);
  const before = +sql(`select count(*) from roster_import`);
  const res1 = await approve(p);
  check('نافذة النتيجة: 5 أُدرج وشعبة جديدة', /اكتمل الإدراج/.test(res1) && /\b5\b/.test(res1), res1.slice(0, 200));
  check('سجل الاستيراد: عملية XLSX بالأعداد', +sql(`select count(*) from roster_import`) === before + 1 && sql(`select kind||'|'||n_added||'|'||n_new_secs||'|'||by_name||'|'||file from roster_import order by at desc limit 1`) === 'xlsx|5|1|مدرب أول|filled.xlsx');
  const s88 = JSON.parse(sql(`select data from doc where col='sections' and id='88201'`));
  check('الشعبة الجديدة: للمدرب نفسه ومقررها ورمزها وفصلها ونوعها ومواعيدها', s88.trainer === 'utrain00000000001' && s88.course === 'برمجة الحاسب' && s88.code === 'حاسب 111' && s88.term === 'الفصل التدريبي الأول' && s88.year === '1448' && s88.kind === 'عملي' && s88.meets.length === 2 && s88.dates.length >= 5 && s88.rows.length === 3, [s88.trainer, s88.dates && s88.dates.length, s88.rows && s88.rows.length]);
  const r63 = JSON.parse(sql(`select data->'rows' from doc where col='sections' and id='63854'`));
  check('الشعبة الموجودة: أُضيف الجديدان ولم يُحذف أو يتغير أحد', r63.length === rows0.length + 2 && rows0.every((x) => r63.some((y) => y.id === x.id && y.name === x.name)));
  check('لا تكرار للمتدرب داخل الشعبة', new Set(r63.map((x) => x.id)).size === r63.length && new Set(s88.rows.map((x) => x.id)).size === s88.rows.length);
  check('البيانات الأساسية مرة واحدة: البريد والجوال (موحَّد 05)', sql(`select email||'|'||mobile from trainee where id='446910003'`) === '446910003@tvtc.edu.sa|0551114455' && sql(`select coalesce(email,'-')||'|'||coalesce(mobile,'-') from trainee where id='446910002'`) === '-|-');
  check('المزامنة إلى رصد الدرجات: الجديدان في قائمة 63854', ['446910001', '446910002'].every((id) => +sql(`select count(*) from doc g, jsonb_array_elements(g.data->'rows') r where g.col='gsec' and g.id='63854' and r->>'id'='${id}' and (r->>'el')::boolean`) === 1));
  check('جدول التسجيل (roster_enrollment) يفصل التسجيل عن البيانات الأساسية', +sql(`select count(*) from roster_enrollment where trainee_id like '44691%'`) === 5);
  check('سجل الخادم (audit): roster', +sql(`select count(*) from audit where act='roster'`) >= 1);
  await waitSec(p, '88201');
  const sync = await p.evaluate(() => { rebuild(); const s = A.m.sections.find((x) => x.crn === '88201'); return { inRoll: !!s && s.rows.length === 3, dates: s ? s.dates.length : 0, g: (A.raw.gsec['63854'].rows || []).filter((r) => /^44691/.test(r.id)).length }; });
  check('في المنصة فوراً: الشعبة في التحضير بتواريخها، والمتدربون في الدرجات', sync.inRoll && sync.dates >= 5 && sync.g === 2, sync);
  await p.evaluate(() => go('roll')); await p.waitForTimeout(500);
  check('صفحة التحضير تعرض الشعبة الجديدة', /88201/.test(await p.textContent('#main')));
  await p.evaluate(() => go('roster')); await p.waitForSelector('.rs-actions');
  /* إعادة الرفع نفسه: لا شيء يتكرر */
  await p.setInputFiles('input[data-change="rs-xlsx"]', filled);
  await p.waitForFunction(() => HAADER_RS.R.mode === 'review', null, { timeout: 20000 });
  c = await st(p);
  check('إعادة رفع الملف نفسه: المُدرَجون «مكرر — مسجل مسبقاً»', c.ok === 0 && c.dup >= 6, c);
  await p.click('.rs-bar [data-act="rs-cancel"]'); await p.click('[data-act="rs-cancel-ok"]');
  check('إلغاء العملية لا يحفظ شيئاً', /أُلغيت العملية/.test(await toast(p)) && +sql(`select count(*) from roster_import`) === before + 1);

  /* ===== PDF نصي ===== */
  await p.setInputFiles('input[data-change="rs-pdf"]', path.join(FX, 'roster_list.pdf'));
  await p.waitForFunction(() => HAADER_RS.R.mode === 'review', null, { timeout: 60000 });
  R = await p.evaluate(() => ({ secs: HAADER_RS.R.secs.map((s) => [s.crn, s.course, s.code, s.term, s.year, s.err.join(' ')]), rows: HAADER_RS.R.rows.map((r) => [r.crn, r.id, r.name]) }));
  check('PDF: رقم الشعبة واسم المقرر ورمزه والفصل والعام', R.secs.length === 1 && R.secs[0][0] === '88101' && R.secs[0][1] === 'أساسيات الحاسب' && R.secs[0][2] === 'حاسب 101' && R.secs[0][3] === 'الفصل التدريبي الأول' && R.secs[0][4] === '1448', R.secs);
  const names = ['سالم أحمد علي القحطاني', 'فهد ناصر محمد الشهري', 'عبدالله سعيد حسن العمري', 'ماجد خالد عبدالرحمن الأسمري', 'تركي يوسف إبراهيم الزهراني', 'نايف عمر سلمان الغامدي', 'صلاح بلال علاء الدين الأحمدي', 'إسلام عبدالإله آل مستور'];
  check('PDF: 8 متدربين بأرقامهم وأسمائهم كما هي (ومنها لام ألف: صلاح، بلال، علاء، إسلام)', R.rows.length === 8 && R.rows.every((r, i) => r[0] === '88101' && r[1] === '44690000' + (i + 1) && r[2] === names[i]), R.rows);
  check('PDF: الشعبة الجديدة تطلب موعد المحاضرة قبل الإنشاء', /موعد محاضرة/.test(R.secs[0][5]) && (await st(p)).fix === 8);
  await p.selectOption('.rs-sec select[data-f="d1"]', 'الأحد'); await p.fill('.rs-sec input[data-f="t1"]', '08:00'); await p.dispatchEvent('.rs-sec input[data-f="t1"]', 'change');
  c = await st(p); check('بعد تحديد الموعد: 8 صحيح', c.ok === 8, c);
  await approve(p); await waitSec(p, '88101');
  check('PDF: الشعبة 88101 أُنشئت بثمانية متدربين وسُجلت العملية PDF', +sql(`select jsonb_array_length(data->'rows') from doc where col='sections' and id='88101'`) === 8 && sql(`select kind||'|'||file from roster_import order by at desc limit 1`) === 'pdf|roster_list.pdf');

  /* ===== PDF ممسوح ضوئياً (OCR) ===== */
  const t0 = Date.now();
  await p.setInputFiles('input[data-change="rs-pdf"]', path.join(FX, 'roster_scan.pdf'));
  await p.waitForFunction(() => HAADER_RS.R.mode === 'review', null, { timeout: 180000 });
  R = await p.evaluate(() => HAADER_RS.R.rows.map((r) => [r.crn, r.id, r.name, r.st, !!r.ocr]));
  check('OCR: استُخرجت الأرقام التدريبية الثمانية من الصورة', R.length === 8 && R.every((r, i) => r[1] === '44690000' + (i + 1) && r[0] === '88101' && r[4]), R.map((r) => r[1]));
  check('OCR: الأسماء مقروءة (7 من 8 مطابقة تماماً على الأقل)', R.filter((r, i) => r[2] === names[i]).length >= 7, R.map((r) => r[2]));
  check('OCR: الكل «مكرر — مسجل مسبقاً» فلا يتكرر شيء', R.every((r) => r[3] === 'dup'), R.map((r) => r[3]));
  check('OCR: تنبيه المراجعة ووسم OCR في الجدول', /استُخرج|مستخرجة آلياً/.test(await p.textContent('#main')) && !!(await p.$('.chip.info[title*="التعرف الضوئي"]')));
  console.log('    (زمن التعرف الضوئي: ' + (Date.now() - t0) + 'ms)');
  await p.click('.rs-bar [data-act="rs-cancel"]'); await p.click('[data-act="rs-cancel-ok"]');

  /* ===== الإدراج اليدوي ===== */
  await p.click('[data-act="rs-manual"]'); await p.waitForSelector('.rs-sec');
  const fillS = async (f, v) => { const e = await p.$(`.rs-sec [data-f="${f}"]`); if ((await e.evaluate((x) => x.tagName)) === 'SELECT') await e.selectOption(v); else { await e.fill(v); await e.dispatchEvent('change'); } };
  await fillS('crn', '88301'); await fillS('course', 'تطبيقات الحاسب'); await fillS('code', 'حاسب 102'); await fillS('term', 'الفصل التدريبي الأول'); await fillS('year', '1448'); await fillS('d1', 'الثلاثاء'); await fillS('t1', '10:00');
  const rowIns = await p.$$('.rs-rows tbody tr');
  check('الإدراج اليدوي: نموذج الشعبة وجدول المتدربين بثلاثة صفوف', rowIns.length === 3);
  const fillR = async (i, f, v) => { const e = (await p.$$(`.rs-rows tbody tr`))[i]; const x = await e.$(`[data-f="${f}"]`); await x.fill(v); await x.dispatchEvent('change'); };
  await fillR(0, 'crn', '88301'); await fillR(0, 'id', '446930001'); await fillR(0, 'name', 'وليد ثامر صالح البقمي');
  await fillR(1, 'crn', '88301'); await fillR(1, 'id', '446930002'); await fillR(1, 'name', 'أنس جابر هادي الحارثي');
  await p.click('.rs-rows tbody tr:nth-child(3) [data-act="rs-row-del"]');
  check('حذف متدرب قبل الحفظ', (await p.$$('.rs-rows tbody tr')).length === 2);
  await p.click('[data-act="rs-row-add"]'); check('زر إضافة متدرب', (await p.$$('.rs-rows tbody tr')).length === 3);
  await p.click('[data-act="rs-paste"]'); await p.waitForSelector('#rsPT');
  await p.selectOption('#rsPC', '88301');
  await p.fill('#rsPT', '446930003\tمعاذ نواف سعد السبيعي\t446930003@tvtc.edu.sa\t0561112222\n446930004, عمار فيصل حامد القرني\n٤٤٦٩٣٠٠٠٥ ريان طارق سالم البيشي');
  await p.click('[data-act="rs-paste-ok"]');
  check('إضافة عدة متدربين دفعة واحدة (لصق، وأرقام عربية)', (await p.evaluate(() => HAADER_RS.R.rows.filter((r) => r.id).map((r) => r.id).join(','))) === '446930001,446930002,446930003,446930004,446930005');
  await p.click('[data-act="rs-sec-add"]'); check('إنشاء أكثر من شعبة', (await p.$$('.rs-sec')).length === 2);
  const s2 = (await p.$$('.rs-sec'))[1];
  for (const [f, v] of [['crn', '88401'], ['course', 'مقدمة البرمجة']]) { const x = await s2.$(`[data-f="${f}"]`); await x.fill(v); await x.dispatchEvent('change'); }
  await (await s2.$('[data-f="d1"]')).selectOption('الخميس'); const tt = await s2.$('[data-f="t1"]'); await tt.fill('11:00'); await tt.dispatchEvent('change');
  await p.click('[data-act="rs-row-add"]'); const last = (await p.$$('.rs-rows tbody tr')).length - 1;
  await fillR(last, 'crn', '88401'); await fillR(last, 'id', '446930001'); await fillR(last, 'name', 'وليد ثامر صالح البقمي');
  await p.click('[data-act="rs-review"]'); await p.waitForFunction(() => HAADER_RS.R.mode === 'review');
  c = await st(p); check('مراجعة الإدراج اليدوي: 6 صحيح (متدرب في شعبتين)', c.ok === 6 && c.fix === 0, c);
  await approve(p); await waitSec(p, '88401');
  check('الإدراج اليدوي: شعبتان جديدتان والمتدرب نفسه في الشعبتين ببيانات أساسية واحدة', +sql(`select jsonb_array_length(data->'rows') from doc where col='sections' and id='88301'`) === 5 && +sql(`select jsonb_array_length(data->'rows') from doc where col='sections' and id='88401'`) === 1 && +sql(`select count(*) from trainee where id='446930001'`) === 1 && sql(`select kind from roster_import order by at desc limit 1`) === 'manual');
  /* السجل في الصفحة */
  await p.click('[data-act="rs-log-refresh"]'); await p.waitForFunction(() => /XLSX/.test((document.querySelector('#main') || {}).textContent) && /PDF/.test(document.querySelector('#main').textContent), null, { timeout: 15000 });
  const lg = await p.textContent('#main');
  check('سجل عمليات الاستيراد في الصفحة: الملف والنوع والأعداد', /filled\.xlsx/.test(lg) && /roster_list\.pdf/.test(lg) && /إدراج يدوي/.test(lg));
  check('البطاقة: مسجلون في أكثر من شعبة', await p.evaluate(() => { const t = [...document.querySelectorAll('.rs-tiles .tile')].find((x) => /أكثر من شعبة/.test(x.textContent)); return t && +t.querySelector('b').textContent >= 1; }));

  /* ===== الصلاحيات على الخادم ===== */
  const t1 = await L.login('t.ahmed', 'Trainer1-pass'), t2 = await L.login('t.saad', 'Trainer2-pass'), ad = await L.login('aalkhathami', 'Admin#2026x');
  const n63912 = sql(`select jsonb_array_length(data->'rows') from doc where col='sections' and id='63912'`);
  let rr = await L.rpc('roster_apply', { p: { kind: 'manual', file: 't', secs: [{ crn: '63912', course: 'x' }], rows: [{ crn: '63912', id: '446940001', name: 'متدرب تجريبي للصلاحية' }] } }, t1.token);
  check('المدرب لا يضيف إلى شعبة مدرب آخر (الخادم يرفض)', rr.ok && rr.body.added === 0 && rr.body.secs[0].st === 'denied' && sql(`select jsonb_array_length(data->'rows') from doc where col='sections' and id='63912'`) === n63912, rr.body);
  rr = await L.rpc('roster_apply', { p: { kind: 'manual', secs: [], rows: [{ crn: '88201', id: '446940002', name: 'متدرب تجريبي للصلاحية' }] } }, t2.token);
  check('ولا مدرب آخر يضيف إلى شعبة المدرب الأول', rr.ok && rr.body.added === 0 && /غير مسندة إليك/.test(JSON.stringify(rr.body.bad)));
  const anon = await L.rpc('roster_apply', { p: { secs: [], rows: [] } });
  check('بلا دخول: مرفوض', !anon.ok);
  const sees = await L.rpc('roster_imports', {}, t2.token), seesA = await L.rpc('roster_imports', {}, ad.token);
  check('المدرب يرى عملياته فقط، والمسؤول يرى الكل', sees.ok && sees.body.every((x) => x.by_name !== 'مدرب أول') && seesA.ok && seesA.body.filter((x) => x.by_name === 'مدرب أول').length >= 3);
  rr = await L.rpc('roster_apply', { p: { kind: 'manual', secs: [{ crn: '63912', course: 'x' }], rows: [{ crn: '63912', id: '446940003', name: 'متدرب يضيفه المسؤول' }] } }, ad.token);
  check('المسؤول يضيف إلى أي شعبة', rr.ok && rr.body.added === 1);
  sql(`select set_config('haader.sys','1',false); update doc set data = jsonb_set(data,'{rows}', (select coalesce(jsonb_agg(r),'[]'::jsonb) from jsonb_array_elements(data->'rows') r where r->>'id' <> '446940003')) where col='sections' and id='63912'`);
  /* المسؤول: الصفحة وتحديد المدرب */
  const pa = await open('aalkhathami', 'Admin#2026x');
  await pa.evaluate(() => go('users'));
  check('المسؤول: رابط «إدارة الشعب والمتدربين» من «المدربون والصلاحيات»', !!(await pa.$('[data-act="rs-go"]')));
  await pa.click('[data-act="rs-go"]'); await pa.waitForSelector('.rs-actions');
  await pa.click('[data-act="rs-manual"]'); await pa.waitForSelector('.rs-sec');
  check('المسؤول: يختار مدرب الشعبة الجديدة', !!(await pa.$('.rs-sec select[data-f="trainer"]')));
  const alog = await pa.evaluate(async () => { HAADER_RS.R.mode = ''; go('roster'); await new Promise((r) => setTimeout(r, 1500)); return document.querySelector('#main').textContent; });
  check('المسؤول يرى عمليات الاستيراد كلها بالمنفّذ', /مدرب أول/.test(alog) && /المنفّذ/.test(alog));
  /* الجوال */
  const pm = await open('t.ahmed', 'Trainer1-pass', { width: 390, height: 844 });
  await pm.evaluate(() => go('roster')); await pm.waitForSelector('.rs-actions');
  check('الجوال: لا تمرير أفقي في الصفحة', await pm.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await pm.screenshot({ path: path.join(TMP, 'mobile.png'), fullPage: true });
  /* الحساب للاطلاع لا يرى الصفحة */
  check('لا أخطاء JavaScript', errs.length === 0, errs);
  await b.close();
  clean(); if (!hadG) sql(`select set_config('haader.sys','1',false); delete from doc where col='gsec' and id='63854'`);
  else sql(`select set_config('haader.sys','1',false); update doc set data = jsonb_set(data,'{rows}', (select coalesce(jsonb_agg(r),'[]'::jsonb) from jsonb_array_elements(data->'rows') r where r->>'id' not like '4469%')) where col='gsec' and id='63854'`);
  sql(`select set_config('haader.sys','1',false); update doc set data = jsonb_set(data,'{rows}', (select coalesce(jsonb_agg(r),'[]'::jsonb) from jsonb_array_elements(data->'rows') r where r->>'id' not like '4469%')) where col='sections' and id='63854'`);
  check('(تنظيف بيانات الاختبار وعودة 63854 كما كانت)', sql(`select data->'rows' from doc where col='sections' and id='63854'`) === JSON.stringify(rows0) || JSON.parse(sql(`select data->'rows' from doc where col='sections' and id='63854'`)).length === rows0.length);
  L.done('إدارة الشعب والمتدربين');
})().catch((e) => { console.error(e); process.exit(1); });
