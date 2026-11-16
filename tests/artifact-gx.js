/* نسخة Claude: نموذج إدخال الدرجات Excel، والاستيراد بمعاينته، وسجله والتراجع، والمظهر المطوّر.
   يعمل على dist/artifact/index.html (HAADER_FILE) بقاعدة البيانات الوهمية في tests/lib.js. */
const L = require('./lib');
const fs = require('fs');
const { execFileSync } = require('child_process');
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 400) : '')); } };
const OUT = __dirname + '/out'; fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await L.launch();
  const docs = L.seed();
  const p = await L.open(b, 't1', docs);
  ok(await p.evaluate(() => document.documentElement.dataset.look === 'v2' && !!document.getElementById('topbar')), 'المظهر المطوّر والشريط العلوي في نسخة Claude');
  await p.evaluate(() => { A.gCrn = '63854'; go('gentry'); }); await p.waitForTimeout(150);
  ok(await p.evaluate(() => !!document.querySelector('[data-act="gx-tpl"]') && !!document.querySelector('[data-act="gx-imp"]')), 'زرا «تحميل نموذج إدخال الدرجات Excel» و«استيراد درجات Excel»');
  ok(await p.evaluate(() => /سجل استيراد الدرجات/.test(document.querySelector('#gxHist') ? document.querySelector('#gxHist').innerText : '')), 'لوحة سجل الاستيراد');

  // 1) النموذج
  await p.click('[data-act="gx-tpl"]');
  await p.waitForFunction(() => window.__DL.some((d) => /نموذج إدخال الدرجات/.test(d.filename)), null, { timeout: 30000 });
  const b64 = await p.evaluate(async () => { const d = window.__DL.find((x) => /نموذج إدخال الدرجات/.test(x.filename)); const buf = new Uint8Array(await d.blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); return btoa(s); });
  const TPL = OUT + '/artifact-template.xlsx'; fs.writeFileSync(TPL, Buffer.from(b64, 'base64'));
  const info = JSON.parse(execFileSync('python3', ['-c', `
import openpyxl, json, sys, warnings
warnings.filterwarnings('ignore')
wb = openpyxl.load_workbook(sys.argv[1])
meta = json.loads(wb['_haader']['A2'].value)
ws = wb['63854']; hdr = [c.value for c in ws[5]]
print(json.dumps({'sheets': wb.sheetnames, 'state': wb['_haader'].sheet_state, 'meta': meta, 'hdr': hdr, 'rtl': ws.sheet_view.rightToLeft, 'prot': ws.protection.sheet, 'charts': len(wb['الرئيسية']._charts)}, ensure_ascii=False))`, TPL]).toString());
  ok(['الرئيسية', 'التعليمات', '63854', '63857', '74306', 'توزيع الدرجات', 'الإعدادات', '_haader'].every((n) => info.sheets.includes(n)) && !info.sheets.includes('63905'), 'المصنف: شعب المدرب وحده، ورقة لكل شعبة باسم رقمها', info.sheets);
  ok(info.state === 'veryHidden' && info.meta.trainer === 'ut1' && info.meta.crns.join() === '63854,63857,74306', 'المعرّف الخفي: المدرب والشعب', info.meta);
  ok(info.rtl && info.prot, 'من اليمين إلى اليسار ومحمي');

  // 2) تعبئة وإعادة الرفع
  const ids = await p.evaluate(() => G.eligible(A.raw.gsec['63854']).slice(0, 3).map((r) => r.id));
  const F1 = OUT + '/artifact-filled.xlsx';
  execFileSync('python3', ['-c', `
import openpyxl, sys, json, warnings
warnings.filterwarnings('ignore')
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['63854']; ids = json.loads(sys.argv[3])
hdr = {str(c.value).split()[0]: i + 1 for i, c in enumerate(ws[5]) if c.value}
vals = {ids[0]: {'LEC1': 25, 'LEC2': 18}, ids[1]: {'LEC1': 31}, ids[2]: {'LEC1': 20.5}}
for r in range(6, ws.max_row + 1):
    v = vals.get(str(ws.cell(r, 2).value))
    if v:
        for k, x in v.items(): ws.cell(r, hdr[k]).value = x
wb.save(sys.argv[2])`, TPL, F1, JSON.stringify(ids)]);
  const upload = async (f, over) => { await p.click('[data-act="gx-imp"]'); await p.waitForSelector('#modal input[data-change="gx-file"]', { state: 'attached' }); if (over) await p.check('#gxo'); await p.setInputFiles('#modal input[data-change="gx-file"]', f); await p.waitForFunction(() => /معاينة|لا شيء/.test((document.querySelector('#modal h2') || {}).textContent || ''), null, { timeout: 20000 }); return p.evaluate(() => document.querySelector('#modal').innerText); };
  let pv = await upload(F1);
  ok(/درجات جديدة\s*3/.test(pv) && /31/.test(pv), 'المعاينة: 3 جديدة، وتُرفض 31 لتجاوزها الحد', pv.slice(0, 500));
  await p.click('#modal [data-act="g-xin-ok"]');
  await p.waitForFunction(() => /حُفظت الدرجات|اكتمل الاستيراد/.test((document.querySelector('#modal h2') || {}).textContent || ''), null, { timeout: 15000 });
  const res = await p.evaluate(() => document.querySelector('#modal').innerText);
  ok(/حُفظت 3 درجة/.test(res), 'نتيجة الحفظ', res.slice(0, 300));
  await p.click('#modal [data-act="modal-close"]'); await L.flush(p);
  let d = await L.dbDocs(p);
  ok(d['gmarks/63854'] && d['gmarks/63854'].g[ids[0]].LEC1 === 25 && d['gmarks/63854'].g[ids[0]].LEC2 === 18 && d['gmarks/63854'].g[ids[2]].LEC1 === 20.5, 'حُفظت في قاعدة بيانات المنصة', d['gmarks/63854']);
  const gi = Object.keys(d).filter((k) => k.startsWith('gimp/'));
  ok(gi.length === 1 && d[gi[0]].changes.length === 3 && d[gi[0]].byName === 'م. مدرب أول', 'سجل العملية في gimp باسم المدرب', gi.map((k) => d[k]));
  ok(JSON.stringify(Object.entries(d).filter(([k]) => /^glogs?\//.test(k)).map(([, v]) => v)).includes('استيراد Excel GI'), 'كل درجة مستوردة في سجل التدقيق برقم العملية');

  // 3) تحديث سابق: بدون الخيار يُبقى، ومعه يتغير
  const F2 = OUT + '/artifact-filled2.xlsx';
  execFileSync('python3', ['-c', `
import openpyxl, sys, warnings
warnings.filterwarnings('ignore')
wb = openpyxl.load_workbook(sys.argv[1]); ws = wb['63854']
hdr = {str(c.value).split()[0]: i + 1 for i, c in enumerate(ws[5]) if c.value}
for r in range(6, ws.max_row + 1):
    if str(ws.cell(r, 2).value) == sys.argv[3]: ws.cell(r, hdr['LEC1']).value = 27
wb.save(sys.argv[2])`, F1, F2, ids[0]]);
  pv = await upload(F2, true);
  ok(/تخالف المحفوظ\s*1/.test(pv) && /25/.test(pv) && /27/.test(pv), 'المعاينة تعرض القديمة والجديدة', pv.slice(0, 400));
  await p.click('#modal [data-act="g-xin-ok"]');
  await p.waitForFunction(() => /حُفظت الدرجات|اكتمل الاستيراد/.test((document.querySelector('#modal h2') || {}).textContent || ''), null, { timeout: 15000 });
  await p.click('#modal [data-act="modal-close"]'); await L.flush(p);
  d = await L.dbDocs(p);
  ok(d['gmarks/63854'].g[ids[0]].LEC1 === 27, 'تحديث الدرجة السابقة بالموافقة');

  // 4) التراجع عن آخر عملية
  await p.evaluate(() => { A.gCrn = '63854'; go('gentry'); }); await p.waitForTimeout(400);
  const h = await p.evaluate(() => document.querySelector('#gxHist').innerText);
  ok((h.match(/محفوظة/g) || []).length >= 2, 'السجل يعرض العمليتين', h.slice(0, 300));
  await p.click('#gxHist [data-act="gx-undo"]'); await p.click('#modal [data-act="gx-undo-ok"]');
  await p.waitForFunction(() => /تم التراجع/.test((document.querySelector('#modal h2') || {}).textContent || ''), null, { timeout: 10000 });
  await p.click('#modal [data-act="modal-close"]'); await L.flush(p);
  d = await L.dbDocs(p);
  const last = Object.keys(d).filter((k) => k.startsWith('gimp/')).map((k) => d[k]).sort((a, c) => c.at.localeCompare(a.at))[0];
  ok(d['gmarks/63854'].g[ids[0]].LEC1 === 25 && last.status === 'undone', 'التراجع يعيد 25 ويعلّم العملية', [d['gmarks/63854'].g[ids[0]], last && last.status]);

  // 5) مصنف مدرب آخر لا يُقبل
  const F3 = OUT + '/artifact-other.xlsx';
  execFileSync('python3', ['-c', `
import openpyxl, sys, json, warnings
warnings.filterwarnings('ignore')
wb = openpyxl.load_workbook(sys.argv[1]); m = json.loads(wb['_haader']['A2'].value); m['trainer'] = 'ut2'; wb['_haader']['A2'].value = json.dumps(m, ensure_ascii=False); wb.save(sys.argv[2])`, F1, F3]);
  pv = await upload(F3);
  ok(/فلا تُستورد منه درجات بحسابك/.test(pv), 'مصنف مدرب آخر يُرفض', pv.slice(0, 300));
  await p.click('#modal [data-act="modal-close"]').catch(() => {});

  // 6) الملف الشخصي
  await p.click('#topbar [data-v2prof]');
  ok(await p.evaluate(() => !document.getElementById('v2prof').hidden && /م. مدرب أول/.test(document.getElementById('v2prof').innerText)), 'نافذة الملف الشخصي');
  ok(!p.errs.length, 'لا أخطاء JavaScript', p.errs.slice(0, 5));
  await b.close();
  console.log(`\n══ نسخة Claude: ${pass} ناجح، ${fail} فاشل ══`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
