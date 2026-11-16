/* اعتماد ملف ردود التحضير (Forms) على نسخة محلية من بيانات المنصة الحقيقية.
   البيانات لا تُحفظ في المستودع: QR_DATA مجلد فيه qrs/ meta/ marks/ notes/ sections/ بصيغة JSON، وQR_BOOK ملف الردود. */
const L = require('./lib');
const fs = require('fs');
const D = process.env.QR_DATA, BOOK = process.env.QR_BOOK;
if (!D || !BOOK || !fs.existsSync(BOOK)) { console.log('تخطٍّ: لم يُحدد QR_DATA وQR_BOOK'); process.exit(0); }
let pass = 0, fail = 0;
const ok = (c, n, x) => { if (c) { pass++; console.log('  ✓ ' + n); } else { fail++; console.log('  ✗ ' + n + (x !== undefined ? '  → ' + JSON.stringify(x).slice(0, 300) : '')); } };
const load = () => {
  const docs = {};
  for (const col of ['qrs', 'meta', 'marks', 'notes', 'sections']) for (const f of fs.readdirSync(D + '/' + col).filter((x) => /^[^.].*\.json$/.test(x))) docs[col + '/' + f.replace(/\.json$/, '')] = JSON.parse(fs.readFileSync(D + '/' + col + '/' + f));
  Object.values(L.ACC).forEach((a) => { docs['accounts/' + a.id] = a; });
  return docs;
};
const review = (p) => p.evaluate(async (b64) => { const bin = atob(b64), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); await qrXlsx(new File([u], 'ردود.xlsx')); const r = A.qrRes; return { ok: r.ok.length, bad: r.bad.length, old: r.old, again: r.again, typo: r.ok.filter((x) => x.typo).length, rev: r.ok.filter((x) => x.sid === 'WQ5ZYHMUJE').length, txt: document.querySelector('#modal').innerText }; }, fs.readFileSync(BOOK).toString('base64'));
(async () => {
  const b = await L.launch();
  let p = await L.open(b, 'admin', load());
  ok(await p.evaluate(() => qrCfg().timeCheck === false), 'الافتراضي: اعتماد ملف التحضير دون قيد زمني');
  const r1 = await review(p);
  ok(r1.ok === 28 && r1.again === 28 && r1.bad === 0, 'يُعاد فحص الردود المرفوضة سابقاً فيُقبل 28 رداً', r1);
  ok(r1.rev === 13, 'ردود فُتحت قبل إلغاء الرمز تُقبل (13)', r1.rev);
  ok(r1.typo >= 9, 'الرقم المكتوب خطأً لا يُسقط الحضور ويُذكر', r1.typo);
  ok(/ردود جلسات لاحقة ليست في هذا الملف/.test(r1.txt) && /74307|06\/06\/1448/.test(r1.txt), 'تنبيه: جلسات بدأت بعد أحدث رد في الملف (مثل 74307 اليوم)', r1.txt.slice(0, 600));
  ok(/أُعيد فحص 28 رداً/.test(r1.txt) && /رُفض سابقاً/.test(r1.txt), 'المراجعة تبيّن ذلك', r1.txt.slice(0, 200));
  await p.click('#modal [data-act="qr-apply"]'); await L.flush(p);
  const d = await L.dbDocs(p);
  ok(d['qrs/WQ5ZYHMUJE'].rej['69'].acc && d['qrs/WQ5ZYHMUJE'].rej['69'].acc.auto && d['qrs/WQ5ZYHMUJE'].ins['446179546'], 'الرد المرفوض سابقاً يُعلَّم مقبولاً ويُسجَّل حضوره');
  const code = await p.evaluate(() => H.code(A.m, '63858', '446179546', '01/06/1448'));
  ok(/^(ح|م)/.test(code || ''), 'الكشف: حضور في 01/06/1448', code);
  const r2 = await review(p);
  ok(r2.ok === 0 && r2.bad === 0, 'إعادة رفع الملف نفسه: لا جديد', r2);
  await p.evaluate(() => closeModal());
  // مع خيار التحقق من الوقت: تعود القيود الزمنية
  const docs2 = load(); docs2['meta/qrcfg'] = { timeCheck: true };
  const p2 = await L.open(b, 'admin', docs2);
  const r3 = await review(p2);
  ok(r3.ok < r1.ok && r3.ok > 0, 'خيار «التحقق من وقت الرد» يعيد القيود الزمنية', r3);
  ok(!p.errs.length && !p2.errs.length, 'لا أخطاء JavaScript', p.errs.concat(p2.errs).slice(0, 4));
  await b.close();
  console.log(`\n══ اعتماد ملف التحضير: ${pass} ناجح، ${fail} فاشل ══`); process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
