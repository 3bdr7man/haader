// اختبار استيراد الدرجات من مصنف «توزيع الدرجات وكشوف الرصد» (صيغة المدرب) على الخادم المحلي.
// المصنف نفسه لا يُحفظ في المستودع (فيه بيانات متدربين): مساره في GRADES_XLSX.
// الدرجات المعبأة في نسخة الاختبار مصطنعة، والحسابات محلية فقط.
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const fs = require('fs');
const L = require('./lib');
const { sql, check, pwFields } = L;
const URL0 = 'http://127.0.0.1:8080/haader/?sb=' + encodeURIComponent(L.BASE);
const WB = process.env.GRADES_XLSX;
const OUT = process.env.OUT || '/tmp/claude-0/-home-claude/da2fea53-9caa-5476-bb95-529d935e4850/scratchpad/gtest';
if (!WB || !fs.existsSync(WB)) { console.log('تخطٍّ: لم يُحدد GRADES_XLSX'); process.exit(0); }
fs.mkdirSync(OUT, { recursive: true });
const j = (o) => "'" + JSON.stringify(o).replace(/'/g, "''") + "'::jsonb";

/* نسخة معبأة: قيم ثابتة بدل المعادلات، ثم درجات تجريبية لبعض المتدربين القابلين للرصد */
const FILLED = OUT + '/filled.xlsx';
const py = `
import openpyxl, sys, json, warnings
warnings.filterwarnings('ignore')
wb = openpyxl.load_workbook(sys.argv[1], data_only=True)
info = {}
for ws in wb.worksheets[3:]:
    crn = ws.title.split()[0]
    hdr = [c.value for c in ws[6]]
    rows = [r for r in range(7, ws.max_row + 1) if ws.cell(r, 3).value and ws.cell(r, 5).value == 'نعم']
    info[crn] = {'rows': [], 'hdr': hdr}
    for r in range(7, ws.max_row + 1):
        if ws.cell(r, 3).value: info[crn]['rows'].append([str(ws.cell(r, 3).value), ws.cell(r, 2).value, ws.cell(r, 4).value, ws.cell(r, 5).value == 'نعم'])
    col = {h: i + 1 for i, h in enumerate(hdr)}
    if crn == '63854':
        a, b, c, d = rows[:4]
        for k, v in zip([6, 7, 8, 9, 11, 13, 14, 15, 16, 18], [5, 4, 8, 9.5, 18, 6, 3, 10, 7, 15]): ws.cell(a, k).value = v      # كامل
        for k, v in zip([6, 7], [4, 3]): ws.cell(b, k).value = v                                                               # بنود ناقصة
        ws.cell(c, 6).value = 7; ws.cell(c, 7).value = 4; ws.cell(c, 8).value = 9; ws.cell(c, 9).value = 9                      # بند يتجاوز حده
        ws.cell(d, 11).value = 19.25                                                                                           # مكوّن مباشر
        info[crn]['probe'] = [str(ws.cell(x, 3).value) for x in (a, b, c, d)]
    if crn == '63905':
        a = rows[0]; ws.cell(a, col['LAB1 (60)']).value = 55; ws.cell(a, col['LAB2 (40)']).value = 30
        info[crn]['probe'] = [str(ws.cell(a, 3).value)]
wb.save(sys.argv[2])
print(json.dumps(info, ensure_ascii=False))
`;
const INFO = JSON.parse(execFileSync('python3', ['-c', py, WB, FILLED]).toString());
const IDS = { admin: 'uadmin00000000001', t1: 'utrain00000000001' };
const PW = { admin: 'Admin#2026x', t1: 'Trainer1-pass' };

function seed() {
  sql(`truncate doc, credential, trainee_account, trainee, audit cascade; delete from app_user; delete from auth.users;`);
  const acc = (id, username, name, role, pw) => Object.assign({ id, username, name, role, active: true, perms: { past: true, sync: true, export: true }, createdAt: '2026-11-01T00:00:00Z' }, pwFields(pw));
  const sec = (crn, course) => ({ crn, course, kind: 'نظري', order: 0, dept: 'قسم الحاسب وتقنية المعلومات', trainer: IDS.t1, meets: [{ day: 'الأحد', start: '08:00', dur: 100 }], dates: [], rows: INFO[crn].rows.map((r) => ({ id: r[0], name: r[1] })) });
  [['accounts', IDS.admin, acc(IDS.admin, 'aalkhathami', 'مسؤول تجريبي', 'admin', PW.admin)],
    ['accounts', IDS.t1, acc(IDS.t1, 't.ahmed', 'مدرب أول', 'trainer', PW.t1)],
    ['sections', '63854', sec('63854', 'التوجيه والتحويل 1')], ['sections', '63905', sec('63905', 'تطبيقات الحاسب المتقدمة')],
    ['marks', '63854', { m: {} }], ['marks', '63905', { m: {} }], ['notes', '63854', { n: {} }], ['notes', '63905', { n: {} }],
    ['meta', 'settings', { warnT: 3, depT: 5, warnP: 8, depP: 10 }], ['meta', 'calendar', { rows: [] }],
  ].forEach(([c, id, d]) => sql(`insert into doc (col, id, data) values ('${c}', '${id}', ${j(d)})`));
}
const gm = (crn) => JSON.parse(sql(`select data from doc where col='gmarks' and id='${crn}'`) || '{}');
const gs = (crn) => JSON.parse(sql(`select data from doc where col='gsec' and id='${crn}'`) || 'null');

(async () => {
  seed();
  const browser = await chromium.launch(), errs = [];
  const mk = async () => { const c = await browser.newContext({ timezoneId: 'Asia/Riyadh', locale: 'ar-SA', viewport: { width: 1366, height: 860 }, acceptDownloads: true }); const p = await c.newPage(); await p.route('https://cdnjs.cloudflare.com/ajax/libs/xlsx/**', (r) => r.fulfill({ path: '/var/tmp/hstack/vendor/package/dist/xlsx.full.min.js', contentType: 'application/javascript' })); p.on('pageerror', (e) => errs.push(String(e).slice(0, 200))); return [c, p]; };
  const login = async (p, u, pw) => { await p.goto(URL0); await p.waitForSelector('#liU'); await p.fill('#liU', u); await p.fill('#liP', pw); await p.click('#liB'); await p.waitForFunction(() => typeof A !== 'undefined' && A.me && A.fresh && gReady(), null, { timeout: 30000 }); };
  const upload = async (p, f) => { await p.click('[data-act="gx-imp"]'); await p.waitForSelector('#modal input[data-change="gx-file"]', { state: 'attached' }); await p.check('#modal input[name="gxs"][value="one"]'); await p.setInputFiles('#modal input[data-change="gx-file"]', f); };
  const applyImp = async (p) => { await p.click('#modal [data-act="g-xin-ok"]'); await p.waitForFunction(() => /حُفظت الدرجات|اكتمل الاستيراد|لم يُحفظ/.test((document.querySelector('#modal h2') || {}).textContent || ''), null, { timeout: 15000 }); await p.click('#modal [data-act="modal-close"]'); };
  const saved = (p) => p.waitForFunction(() => /محفوظة/.test(document.querySelector('#saved').textContent), null, { timeout: 15000 });

  // 1) المسؤول يستورد التوزيع والشعب من المصنف الأصلي كما هو
  let [c, p] = await mk();
  await login(p, 'aalkhathami', PW.admin);
  await p.evaluate(() => go('gcfg'));
  await p.setInputFiles('input[data-change="g-dist-in"]', WB);
  await p.waitForSelector('#modal [data-act="g-dist-ok"]', { timeout: 15000 });
  const mt = await p.textContent('#modal');
  check('المصنف الأصلي يُقرأ: خمس شعب و111 متدرباً', /5 شعبة/.test(mt) && /111 متدرباً/.test(mt), mt.slice(0, 200));
  check('لا ملاحظات قراءة على المصنف الأصلي', !/ملاحظات القراءة/.test(mt), mt.slice(0, 600));
  await p.screenshot({ path: OUT + '/dist-review.png' });
  await p.click('#modal [data-act="g-dist-ok"]'); await saved(p);
  const s54 = gs('63854'), s05 = gs('63905');
  check('التوزيع محفوظ في الخادم: 63854 = LAB1 30 + LAB2 20 + LEC1 30 + LEC2 20', s54 && s54.comps.map((x) => x.k + x.max).sort().join(',') === 'LAB130,LAB220,LEC130,LEC220', s54 && s54.comps);
  check('بنود أعمال السنة محفوظة (الواجبات 6، المشاركة 4، الشهري 1 10، الشهري 2 10)', s54 && JSON.stringify(s54.items.LEC1) === JSON.stringify([{ n: 'الواجبات', max: 6 }, { n: 'المشاركة', max: 4 }, { n: 'الشهري 1', max: 10 }, { n: 'الشهري 2', max: 10 }]) && s54.items.LAB1.length === 4, s54 && s54.items);
  check('الشعبة العملية المرتبطة محفوظة (63856)', s54 && s54.pair === '63856', s54 && s54.pair);
  check('63905 = LAB1 60 + LAB2 40 بلا بنود', s05 && s05.comps.map((x) => x.k + x.max).sort().join(',') === 'LAB160,LAB240' && !Object.keys(s05.items || {}).length);
  check('قائمة 63854 وحالات القيد كما في الملف (23، 17 قابلاً)', s54 && s54.rows.length === 23 && s54.rows.filter((r) => r.el).length === 17);
  check('الفصل التدريبي مقروء', s54 && /الفصل التدريبي الأول 1448/.test(s54.term), s54 && s54.term);
  check('سجل الاستيراد محفوظ', /"imports"/.test(sql(`select data::text from doc where col='gcfg' and id='main'`)));
  await c.close();
  if (process.env.DIST_ONLY) { await browser.close(); return L.done('استيراد التوزيع فقط'); }

  // 2) مدرب الشعبة يرفع الدرجات بالمصنف نفسه (معبأ)
  [c, p] = await mk();
  await login(p, 't.ahmed', PW.t1);
  await p.evaluate(() => { A.gCrn = '63854'; go('gentry'); });
  await p.waitForSelector('[data-act="gx-imp"]', { timeout: 15000 });
  await upload(p, FILLED);
  await p.waitForSelector('#modal [data-act="g-xin-ok"]', { timeout: 15000 });
  const rt = await p.textContent('#modal');
  const [a, b, cc, d] = INFO['63854'].probe;
  check('المراجعة: 5 درجات جديدة (4 للأول، وLEC2 للرابع)', /درجات جديدة\s*5/.test(rt), rt.slice(0, 300));
  check('تُرفض البنود الناقصة برسالة واضحة', /بنود LEC1 ناقصة \(الشهري 1، الشهري 2\)/.test(rt), rt);
  check('يُرفض البند الذي يتجاوز حده', /الواجبات في LEC1: 7 تتجاوز حد البند 6/.test(rt), rt);
  await p.screenshot({ path: OUT + '/grades-review.png' });
  await applyImp(p);
  let m = gm('63854');
  check('LEC1 = مجموع البنود (5+4+8+9.5 = 26.5)', m.g && m.g[a] && m.g[a].LEC1 === 26.5, m.g && m.g[a]);
  check('LAB1 = 6+3+10+7 = 26، وLEC2 18، وLAB2 15', m.g[a].LAB1 === 26 && m.g[a].LEC2 === 18 && m.g[a].LAB2 === 15, m.g[a]);
  check('البنود التفصيلية محفوظة لكل متدرب', m.s && m.s[a] && m.s[a].LEC1['الشهري 2'] === 9.5 && m.s[b] && m.s[b].LEC1['الواجبات'] === 4, m.s);
  check('البنود الناقصة لا تنتج درجة LEC1', !(m.g[b] || {}).LEC1);
  check('المتدرب ذو البند المتجاوز لم تُحفظ له درجة', !m.g[cc] && !((m.s || {})[cc]));
  check('الدرجة المباشرة لعمود المكوّن تُقبل (LEC2 = 19.25)', m.g[d] && m.g[d].LEC2 === 19.25, m.g[d]);
  // 3) التصدير بالهيكل نفسه
  const exp = await p.evaluate((id) => { const a = gSecAoa(A.raw.gsec['63854'], true); return { head: a[3], row: a.slice(4).find((r) => r[2] === id) }; }, a);
  const li = exp.head.indexOf('LEC1 (30)');
  check('كشف التصدير فيه أعمدة البنود قبل مكوّنها', li > 4 && exp.head.slice(li - 4, li + 2).join('|') === 'الواجبات (6)|المشاركة (4)|الشهري 1 (10)|الشهري 2 (10)|LEC1 (30)|LEC2', exp.head);
  check('…وبنود المتدرب ودرجته في الكشف', exp.row[li - 4] === 5 && exp.row[li - 1] === 9.5 && exp.row[li] === 26.5, exp.row);
  await p.evaluate(() => gExport(['63854'], 'x.xlsx')).catch(() => {});
  // 4) إعادة استيراد الملف نفسه: لا تغيير
  await upload(p, FILLED);
  await p.waitForFunction(() => /معاينة|لا شيء/.test((document.querySelector('#modal h2') || {}).textContent || ''), null, { timeout: 15000 });
  const rt2 = await p.textContent('#modal');
  check('إعادة الاستيراد: لا جديد، والمطابق 5', /درجات جديدة\s*0/.test(rt2) && /مطابقة للمحفوظ\s*5/.test(rt2), rt2.slice(0, 300));
  await p.click('#modal [data-act="modal-close"]');
  // 5) تعديل بند واحد في ملف آخر = تغيير يحتاج موافقة
  const F2 = OUT + '/filled2.xlsx';
  execFileSync('python3', ['-c', `import openpyxl,sys,warnings\nwarnings.filterwarnings('ignore')\nwb=openpyxl.load_workbook(sys.argv[1])\nws=wb['63854 التوجيه وا']\nfor r in range(7,ws.max_row+1):\n  if str(ws.cell(r,3).value)==sys.argv[3]: ws.cell(r,6).value=6\nwb.save(sys.argv[2])`, FILLED, F2, a]);
  await upload(p, F2);
  await p.waitForSelector('#modal [data-act="g-xin-ok"]', { timeout: 15000 });
  const rt3 = await p.textContent('#modal');
  check('تعديل بند الواجبات (5←6) يظهر تغييراً في LEC1 يحتاج موافقة', /تخالف المحفوظ\s*1/.test(rt3) && /26\.5/.test(rt3) && /27\.5/.test(rt3), rt3.slice(0, 500));
  await p.check('#giOver'); await applyImp(p);
  m = gm('63854');
  check('بعد الموافقة: LEC1 = 27.5 والبند محدَّث', m.g[a].LEC1 === 27.5 && m.s[a].LEC1['الواجبات'] === 6, [m.g[a], m.s[a]]);
  // 6) شعبة بلا بنود (63905): أعمدة المكوّنات مباشرة
  await p.evaluate(() => { A.gCrn = '63905'; go('gentry'); });
  await p.waitForFunction(() => document.querySelector('[data-act="gx-imp"]') && document.querySelector('[data-act="gx-imp"]').dataset.crn === '63905');
  await upload(p, FILLED);
  await p.waitForSelector('#modal [data-act="g-xin-ok"]', { timeout: 15000 });
  await applyImp(p);
  const m5 = gm('63905'), p5 = INFO['63905'].probe[0];
  check('63905: LAB1 55 وLAB2 30', m5.g && m5.g[p5] && m5.g[p5].LAB1 === 55 && m5.g[p5].LAB2 === 30, m5.g);
  check('لا أخطاء JavaScript', errs.length === 0, errs);
  await c.close(); await browser.close();
  L.done('استيراد الدرجات من مصنف المدرب');
})().catch((e) => { console.error(e); process.exit(1); });
