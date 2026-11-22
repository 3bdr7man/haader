/* ====================================================================
   إدارة الشعب والمتدربين (منصة حاضر)
   - ثلاثة مداخل للبيانات: نموذج Excel (XLSX) يُنزَّل ويُعبّأ ثم يُرفع، وكشوف PDF (نصية أو ممسوحة
     ضوئياً بالتعرف الضوئي OCR)، والإدراج اليدوي. كلها تمر بشاشة واحدة: «مراجعة البيانات قبل الإدراج».
   - لا يُعتمد شيء قبل المراجعة. الحفظ على الخادم بدالة واحدة (roster_apply) تتحقق من الصلاحيات:
     المدرب يُنشئ شعبه ويضيف إلى شعبه وحدها، والمسؤول للجميع. لا حذف ولا استبدال لأي سجل قائم.
   - المزامنة: المتدرب يُسجَّل في الشعبة مرة واحدة (sections/<crn>.rows) فيظهر في التحضير والتقارير
     والإنذار ولوحات المعلومات وبوابة المتدرب، ويُضاف آلياً إلى قائمة رصد الدرجات (gsec) فيظهر في
     الدرجات وظهورها والاختبارات. بياناته الأساسية (البريد والجوال) في سجل المتدرب الموحد على الخادم.
   - كل عملية تُسجَّل في سجل عمليات الاستيراد (الملف، النوع، المدرب، الوقت، الأعداد، الأخطاء).
   ==================================================================== */
if (document.getElementById('shell')) (() => {
  const WEB = !!window.HAADER_WEB;
  const MIR = () => !!(window.HAADER_MIRROR && window.HAADER_MIRROR.rpc && A.rpcOn && A.rpcOn());
  const SRV = (fn, a) => (WEB ? window.HAADER_WEB.rpc(fn, a) : window.HAADER_MIRROR.rpc(fn, a));
  const canWrite = () => !!A.me && !isViewer() && (A.me.role === 'admin' || A.me.role === 'trainer') && (WEB || MIR() || !A.readOnly);
  const allowed = () => !!A.me && (A.me.role === 'admin' || A.me.role === 'trainer');
  const FONT = 'Arial', NAVY = 'FF003366', BLUE = 'FF0066CC', REQ = 'FFFCE4D6', OPT = 'FFDDEBF7', LINE = 'FFBFC8D6';
  const TERMS = ['الفصل التدريبي الأول', 'الفصل التدريبي الثاني', 'الفصل التدريبي الصيفي'];
  const YEARS = () => { const y = +((((A.m && A.m.cal && A.m.cal[0]) || {}).hijri || '').match(/^(14\d\d)/) || [])[1] || 1448; return [y - 1, y, y + 1].map(String); };
  const KINDS = ['نظري', 'عملي'];
  const digits = (v) => String(v == null ? '' : v).replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
  const clean = (v) => digits(v).replace(/[‎‏‪-‮⁦-⁩]/g, '').replace(/\s+/g, ' ').trim();
  const nameOf = (v) => clean(v).normalize('NFKC').replace(/[ـ]/g, '').replace(/\s+/g, ' ').trim();
  const normName = (v) => nameOf(v).replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/\s+/g, '');
  const idOf = (v) => clean(v).replace(/\.0+$/, '').replace(/[\s-]/g, '');
  const crnOf = (v) => clean(v).replace(/\.0+$/, '').replace(/\s/g, '');
  const mobOf = (v) => { const d = clean(v).replace(/[^0-9]/g, ''); return /^05\d{8}$/.test(d) ? d : /^5\d{8}$/.test(d) ? '0' + d : /^9665\d{8}$/.test(d) ? '0' + d.slice(3) : /^009665\d{8}$/.test(d) ? '0' + d.slice(5) : ''; };
  const EMAIL = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  const fmtAt = (iso) => { try { return new Date(iso).toLocaleString('ar-SA-u-nu-latn', { timeZone: 'Asia/Riyadh', dateStyle: 'medium', timeStyle: 'short' }); } catch (e) { return iso || ''; } };
  const errMsg = (e, d) => (e && e.message && /[؀-ۿ]/.test(e.message) ? e.message : d);
  function loadScript(src, test) { return new Promise((res, rej) => { if (test()) return res(); const s = document.createElement('script'); s.src = src; s.onload = () => (test() ? res() : rej(new Error('load'))); s.onerror = () => rej(new Error('load')); document.head.appendChild(s); }); }
  const loadExcel = () => loadScript('vendor/exceljs-4.4.0.min.js', () => !!window.ExcelJS);

  /* الحالة: R.mode = '' | 'manual' | 'review' */
  const R = { mode: '', kind: '', file: '', secs: [], rows: [], seq: 0, busy: false, log: null, logAt: 0, contacts: null, result: null, bulkCrn: '' };
  const ownSecs = () => Object.values(A.raw.sections || {}).filter((s) => s && s.crn && (isAdmin() || (A.me && s.trainer === A.me.id))).sort((a, b) => String(a.crn).localeCompare(String(b.crn)));
  const trainerName = (id) => ((A.raw.accounts || {})[id] || {}).name || '';
  const newRow = (o) => Object.assign({ k: 'r' + (++R.seq), crn: '', id: '', name: '', email: '', mobile: '', src: '', ex: false }, o || {});
  const newSec = (o) => Object.assign({ crn: '', course: '', code: '', term: '', year: '', trainerName: '', trainer: '', kind: 'نظري', d1: '', t1: '', d2: '', t2: '', dur: 100, src: '' }, o || {});
  const DAYN = (d) => { const x = clean(d).replace(/^يوم\s*/, '').replace(/^ال/, ''); return DAYS.find((y) => y.replace(/^ال/, '') === x || y === clean(d)) || ''; };
  const TIME = (t) => { let s = clean(t); if (!s) return ''; if (/^\d*\.\d+$/.test(s)) { const m = Math.round(parseFloat(s) * 1440); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; }
    const m = s.match(/(\d{1,2})[:.٫](\d{2})/); if (!m) return ''; let h = +m[1]; const pm = /م|pm|PM|مساء/.test(s), am = /ص|am|AM|صباح/.test(s); if (pm && h < 12) h += 12; if (am && h === 12) h = 0; return h < 24 && +m[2] < 60 ? `${String(h).padStart(2, '0')}:${m[2]}` : ''; };
  const meetsOf = (s) => [[s.d1, s.t1], [s.d2, s.t2]].map(([d, t]) => ({ day: DAYN(d), start: TIME(t), dur: +s.dur || 100 })).filter((x) => x.day && x.start);
  const datesOf = (meets) => { const days = meets.map((x) => x.day); return ((A.m && A.m.cal) || []).filter((c) => days.includes(c.day) && c.week !== 'إجازة منتصف العام').map((c) => c.hijri); };
  const termOf = (v) => { const s = clean(v); if (!s) return ''; if (/صيف|ثالث|3/.test(s)) return TERMS[2]; if (/ثان|2/.test(s)) return TERMS[1]; if (/أول|اول|1/.test(s)) return TERMS[0]; return s; };
  const yearOf = (v) => (clean(v).match(/(1[34]\d\d)/) || [])[1] || clean(v);
  const matchTrainer = (nm) => { const n = normName(String(nm || '').replace(/^(م|أ|د)\s*\.\s*/, '')); if (!n) return ''; const a = accList().filter((u) => u.role !== 'viewer' && u.active !== false).find((u) => { const x = normName(String(u.name || '').replace(/^(م|أ|د)\s*\.\s*/, '')); return x && (x === n || x.includes(n) || n.includes(x)); }); return a ? a.id : ''; };

  /* ---------- التحقق ---------- */
  function evalAll() {
    const fileSecs = {}; R.secs.forEach((s) => { s.crn = crnOf(s.crn); });
    R.secs.forEach((s) => {
      const ex = A.raw.sections[s.crn], err = [], warn = [];
      if (!/^\d{5}$/.test(s.crn)) err.push('رقم الشعبة 5 أرقام.');
      else if (R.secs.filter((x) => crnOf(x.crn) === s.crn).length > 1 && R.secs.find((x) => crnOf(x.crn) === s.crn) !== s) err.push('الشعبة مكررة في البيانات.');
      if (ex) {
        s.st = !isAdmin() && ex.trainer !== (A.me && A.me.id) ? 'denied' : 'existing';
        if (s.st === 'denied') err.push('الشعبة مسندة إلى مدرب آخر.');
        if (s.course && ex.course && normName(s.course) !== normName(ex.course)) warn.push(`المقرر المحفوظ «${ex.course}»؛ يبقى كما هو.`);
      } else {
        s.st = 'new';
        if (!clean(s.course)) err.push('اسم المقرر مطلوب لإنشاء الشعبة.');
        if (!meetsOf(s).length) err.push('حدد موعد محاضرة واحداً على الأقل (اليوم والوقت) ليُبنى كشف التحضير.');
        if (isAdmin()) { if (!s.trainer) s.trainer = matchTrainer(s.trainerName) || A.me.id; }
        else if (s.trainerName && A.me && normName(s.trainerName) && !normName(A.me.name).includes(normName(s.trainerName).replace(/^م/, '')) && !normName(s.trainerName).includes(normName(A.me.name).replace(/^م/, ''))) warn.push('اسم المدرب في الملف يختلف عن حسابك؛ تُنشأ الشعبة باسمك.');
      }
      s.err = err; s.warn = warn; if (/^\d{5}$/.test(s.crn) && !fileSecs[s.crn]) fileSecs[s.crn] = s;
    });
    const seen = {}, idName = {};
    R.rows.forEach((r) => { r.id = idOf(r.id); r.crn = crnOf(r.crn); r.name = nameOf(r.name); r.email = clean(r.email).toLowerCase(); r.mobile = clean(r.mobile); if (!r.ex && /^\d{9}$/.test(r.id) && r.name) (idName[r.id] = idName[r.id] || new Set()).add(normName(r.name)); });
    const known = {}; Object.values(A.raw.sections || {}).forEach((s) => (s.rows || []).forEach((x) => { if (!known[x.id]) known[x.id] = x.name; }));
    R.rows.forEach((r) => {
      const err = [], warn = [], sec = fileSecs[r.crn], ex = A.raw.sections[r.crn]; r.secErr = false;
      if (!/^\d{5}$/.test(r.crn)) err.push('رقم الشعبة مفقود أو غير صحيح.');
      else if (sec && sec.err.length) { err.push('الشعبة تحتاج تصحيحاً أولاً (أعلاه).'); r.secErr = true; }
      else if (!sec && !ex) err.push(`الشعبة ${r.crn} غير موجودة: أضفها في بيانات الشعب.`);
      else if (!sec && ex && !isAdmin() && ex.trainer !== A.me.id) err.push('الشعبة مسندة إلى مدرب آخر.');
      if (!/^\d{9}$/.test(r.id)) err.push('الرقم التدريبي 9 أرقام.');
      if (r.name.length < 5 || /\d/.test(r.name)) err.push('اسم المتدرب ناقص أو غير صحيح.');
      else if (r.name.split(' ').length < 2) warn.push('الاسم كلمة واحدة: تأكد منه.');
      if (r.email && !EMAIL.test(r.email)) err.push('البريد الإلكتروني غير صحيح (احذفه أو صحّحه).');
      else if (/@tvtc\.gov\.sa$/i.test(r.email)) warn.push('البريد الرسمي tvtc.gov.sa لا يُحفظ؛ يُدرج المتدرب دونه.');
      if (r.mobile && !mobOf(r.mobile)) err.push('رقم الجوال غير صحيح (05xxxxxxxx).');
      if (/^\d{9}$/.test(r.id) && idName[r.id] && idName[r.id].size > 1) err.push('الرقم نفسه بأسماء مختلفة في البيانات: وحّد الاسم.');
      if (known[r.id] && r.name && normName(known[r.id]) !== normName(r.name)) warn.push(`الاسم المحفوظ «${known[r.id]}»؛ يبقى المحفوظ.`);
      let st = err.length ? 'fix' : 'ok';
      const key = r.crn + ':' + r.id;
      if (!r.ex && st === 'ok') {
        if (seen[key]) { st = 'dup'; warn.unshift('مكرر في البيانات نفسها (يُدرج مرة واحدة).'); }
        else if (ex && (ex.rows || []).some((x) => x.id === r.id)) { st = 'dup'; warn.unshift('مسجل مسبقاً في الشعبة (لا يتكرر).'); }
        seen[key] = true;
      }
      r.st = r.ex ? 'ex' : st; r.err = err; r.warn = warn;
    });
  }
  const counts = () => { const c = { ok: 0, dup: 0, fix: 0, ex: 0 }; R.rows.forEach((r) => { c[r.st] = (c[r.st] || 0) + 1; }); return c; };
  const ST = { ok: ['ok', 'صحيح'], dup: ['warn', 'مكرر'], fix: ['bad', 'يحتاج تصحيحاً'], ex: ['', 'مستبعد'] };
  const SST = { new: ['info', 'شعبة جديدة'], existing: ['ok', 'موجودة'], denied: ['bad', 'مسندة لمدرب آخر'] };

  /* ---------- نموذج Excel (XLSX) ---------- */
  const SEC_COLS = [['رقم الشعبة', 1, 12], ['اسم المقرر', 1, 26], ['رمز المقرر', 0, 13], ['الفصل التدريبي', 0, 22], ['العام التدريبي', 0, 14], ['اسم المدرب', 0, 24], ['نوع الشعبة', 0, 12], ['اليوم الأول', 0, 12], ['وقت المحاضرة الأولى', 0, 14], ['اليوم الثاني', 0, 12], ['وقت المحاضرة الثانية', 0, 14], ['مدة المحاضرة (دقيقة)', 0, 14]];
  const TR_COLS = [['رقم الشعبة', 1, 13], ['الرقم التدريبي', 1, 16], ['اسم المتدرب', 1, 34], ['البريد الإلكتروني', 0, 30], ['رقم الجوال', 0, 15]];
  const N = 1500;
  async function buildTemplate(withMine) {
    await loadExcel();
    const wb = new window.ExcelJS.Workbook(); wb.creator = 'منصة حاضر'; wb.company = 'الكلية التقنية ببيشة'; wb.title = 'نموذج إدراج الشعب والمتدربين'; wb.created = new Date();
    const bd = { top: { style: 'thin', color: { argb: LINE } }, bottom: { style: 'thin', color: { argb: LINE } }, left: { style: 'thin', color: { argb: LINE } }, right: { style: 'thin', color: { argb: LINE } } };
    const fillOf = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
    const head = (ws, cols) => {
      ws.columns = cols.map(([h, , w]) => ({ header: h, width: w }));
      const r = ws.getRow(1); r.height = 30;
      cols.forEach(([h, req], i) => { const c = r.getCell(i + 1); c.value = h + (req ? ' *' : ''); c.font = { name: FONT, bold: true, size: 11, color: { argb: req ? 'FF9C2A00' : NAVY } }; c.fill = fillOf(req ? REQ : OPT); c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true, readingOrder: 'rtl' }; c.border = bd; });
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
      for (let i = 2; i <= 400; i++) { const row = ws.getRow(i); cols.forEach((c, j) => { const x = row.getCell(j + 1); x.font = { name: FONT, size: 11 }; x.alignment = { horizontal: j === 0 || /رقم|الرمز|وقت|مدة|العام/.test(c[0]) ? 'center' : 'right', vertical: 'middle', readingOrder: 'rtl' }; x.border = bd; }); }
    };
    /* ورقة الشعب */
    const ws1 = wb.addWorksheet('بيانات الشعب', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1, showGridLines: false }], properties: { tabColor: { argb: NAVY } } });
    head(ws1, SEC_COLS);
    ['A', 'C', 'E'].forEach((L) => { ws1.getColumn(L).numFmt = '@'; });
    ['I', 'K'].forEach((L) => { ws1.getColumn(L).numFmt = 'hh:mm'; });
    if (withMine) ownSecs().forEach((s, i) => { const m = s.meets || []; ws1.getRow(i + 2).values = [s.crn, s.course || '', s.code || '', s.term || '', s.year || '', trainerName(s.trainer), s.kind || '', (m[0] || {}).day || '', (m[0] || {}).start || '', (m[1] || {}).day || '', (m[1] || {}).start || '', (m[0] || {}).dur || '']; });
    /* ورقة المتدربين */
    const ws2 = wb.addWorksheet('بيانات المتدربين', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 1, showGridLines: false }], properties: { tabColor: { argb: BLUE } } });
    head(ws2, TR_COLS);
    ['A', 'B', 'E'].forEach((L) => { ws2.getColumn(L).numFmt = '@'; });
    /* القوائم المرجعية (ورقة مخفية) */
    const wl = wb.addWorksheet('_lists', { state: 'hidden' });
    TERMS.forEach((t, i) => { wl.getCell(i + 1, 1).value = t; }); YEARS().forEach((t, i) => { wl.getCell(i + 1, 2).value = t; }); KINDS.forEach((t, i) => { wl.getCell(i + 1, 3).value = t; }); DAYS.forEach((t, i) => { wl.getCell(i + 1, 4).value = t; });
    const R2 = (c) => `${c}2:${c}${N}`, dv = (ws, c, o) => ws.dataValidations.add(R2(c), Object.assign({ allowBlank: true, showErrorMessage: true, errorStyle: 'stop' }, o));
    const list = (ws, col, ref, title, msg) => dv(ws, col, { type: 'list', formulae: [ref], errorTitle: title, error: msg, showInputMessage: true, promptTitle: title, prompt: msg });
    dv(ws1, 'A', { type: 'custom', formulae: [`AND(LEN(A2)=5,ISNUMBER(--A2),COUNTIF($A$2:$A$${N},A2)=1)`], errorTitle: 'رقم الشعبة', error: 'رقم الشعبة 5 أرقام، ولا يتكرر في الورقة.', showInputMessage: true, promptTitle: 'رقم الشعبة', prompt: '5 أرقام كما في رايات، مثل 63854' });
    dv(ws1, 'L', { type: 'whole', operator: 'between', formulae: [30, 300], errorTitle: 'المدة', error: 'المدة بالدقائق بين 30 و300.' });
    ['I', 'K'].forEach((L) => dv(ws1, L, { type: 'time', operator: 'between', formulae: [new Date(Date.UTC(1899, 11, 30, 6, 0)), new Date(Date.UTC(1899, 11, 30, 22, 0))], errorTitle: 'وقت المحاضرة', error: 'اكتب الوقت بصيغة 08:00 أو 13:30.', showInputMessage: true, promptTitle: 'وقت المحاضرة', prompt: 'مثل 08:00 أو 13:30' }));
    dv(ws2, 'A', { type: 'list', formulae: [`'بيانات الشعب'!$A$2:$A$300`], errorStyle: 'warning', errorTitle: 'رقم الشعبة', error: 'الشعبة غير موجودة في ورقة «بيانات الشعب». أضفها هناك أولاً، أو تابع إن كانت موجودة في المنصة.', showInputMessage: true, promptTitle: 'رقم الشعبة', prompt: 'اختر الشعبة من القائمة (من ورقة بيانات الشعب)' });
    dv(ws2, 'B', { type: 'custom', formulae: [`AND(LEN(B2)=9,ISNUMBER(--B2),COUNTIFS($A$2:$A$${N},A2,$B$2:$B$${N},B2)=1)`], errorTitle: 'الرقم التدريبي', error: 'الرقم التدريبي 9 أرقام، ولا يتكرر داخل الشعبة الواحدة.', showInputMessage: true, promptTitle: 'الرقم التدريبي', prompt: '9 أرقام، مثل 446123456' });
    dv(ws2, 'D', { type: 'custom', formulae: ['AND(ISNUMBER(SEARCH("@",D2)),ISNUMBER(SEARCH(".",D2)))'], errorStyle: 'warning', errorTitle: 'البريد الإلكتروني', error: 'تحقق من صيغة البريد، مثل 446123456@tvtc.edu.sa' });
    dv(ws2, 'E', { type: 'custom', formulae: ['AND(LEN(E2)=10,LEFT(E2,2)="05",ISNUMBER(--E2))'], errorStyle: 'warning', errorTitle: 'رقم الجوال', error: 'رقم الجوال 10 أرقام يبدأ بـ 05.', showInputMessage: true, promptTitle: 'رقم الجوال', prompt: 'مثل 0551234567' });
    list(ws1, 'D', `'_lists'!$A$1:$A$${TERMS.length}`, 'الفصل التدريبي', 'اختر الفصل من القائمة.');
    list(ws1, 'E', `'_lists'!$B$1:$B$3`, 'العام التدريبي', 'اختر العام من القائمة، مثل 1448.');
    list(ws1, 'G', `'_lists'!$C$1:$C$2`, 'نوع الشعبة', 'نظري أو عملي.');
    list(ws1, 'H', `'_lists'!$D$1:$D$${DAYS.length}`, 'اليوم الأول', 'اختر يوم المحاضرة.');
    list(ws1, 'J', `'_lists'!$D$1:$D$${DAYS.length}`, 'اليوم الثاني', 'اختر يوم المحاضرة الثانية (إن وجدت).');
    /* تمييز الأخطاء والتكرار أثناء التعبئة */
    const bad = { font: { color: { argb: 'FF9C0006' }, bold: true }, fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFFC7CE' } } };
    ws2.addConditionalFormatting({ ref: `B2:B${N}`, rules: [{ type: 'expression', priority: 1, formulae: [`AND(B2<>"",COUNTIFS($A$2:$A$${N},$A2,$B$2:$B$${N},$B2)>1)`], style: bad }, { type: 'expression', priority: 2, formulae: ['AND(B2<>"",OR(LEN(B2)<>9,ISERROR(--B2)))'], style: bad }] });
    ws2.addConditionalFormatting({ ref: `A2:A${N}`, rules: [{ type: 'expression', priority: 3, formulae: ['AND(B2<>"",A2="")'], style: bad }] });
    ws2.addConditionalFormatting({ ref: `C2:C${N}`, rules: [{ type: 'expression', priority: 4, formulae: ['AND(B2<>"",C2="")'], style: bad }] });
    ws1.addConditionalFormatting({ ref: `A2:A${N}`, rules: [{ type: 'expression', priority: 5, formulae: [`AND(A2<>"",OR(LEN(A2)<>5,COUNTIF($A$2:$A$${N},A2)>1))`], style: bad }] });
    ws1.addConditionalFormatting({ ref: `B2:B${N}`, rules: [{ type: 'expression', priority: 6, formulae: ['AND(A2<>"",B2="")'], style: bad }] });
    /* التعليمات والأمثلة */
    const wi = wb.addWorksheet('التعليمات', { views: [{ rightToLeft: true, showGridLines: false }], properties: { tabColor: { argb: 'FF7F7F7F' } } });
    wi.columns = [{ width: 4 }, { width: 24 }, { width: 18 }, { width: 30 }, { width: 22 }, { width: 18 }];
    const put = (r, c, v, o) => { const x = wi.getCell(r, c); x.value = v; x.font = Object.assign({ name: FONT, size: 11 }, (o && o.font) || {}); x.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true, readingOrder: 'rtl' }; if (o && o.fill) x.fill = fillOf(o.fill); if (o && o.border) x.border = bd; return x; };
    wi.mergeCells('B1:F1'); put(1, 2, 'نموذج إدراج الشعب والمتدربين — منصة حاضر', { font: { bold: true, size: 15, color: { argb: 'FFFFFFFF' } }, fill: NAVY }); wi.getRow(1).height = 32;
    wi.mergeCells('B2:F2'); put(2, 2, `${orgInfo().dept || 'قسم الحاسب وتقنية المعلومات'} — الكلية التقنية ببيشة`, { font: { color: { argb: NAVY } } });
    const steps = [
      'عبّئ ورقة «بيانات الشعب»: شعبة في كل صف. رقم الشعبة واسم المقرر إلزاميان (الخلايا البرتقالية)، والبقية اختيارية (الخلايا الزرقاء).',
      'للشعبة الجديدة حدّد يوم المحاضرة ووقتها على الأقل، فتُبنى منها تواريخ كشف التحضير من التقويم التدريبي. الشعبة الموجودة في المنصة لا تتغير بياناتها.',
      'عبّئ ورقة «بيانات المتدربين»: متدرب في كل صف، برقم شعبته ورقمه التدريبي (9 أرقام) واسمه الكامل. البريد والجوال اختياريان.',
      'لا يتكرر الرقم التدريبي داخل الشعبة الواحدة، ويُسجَّل المتدرب نفسه في أكثر من شعبة بصف لكل شعبة، فتُحفظ بياناته الأساسية مرة واحدة.',
      'الخلية الحمراء تعني خطأً (رقم ناقص أو مكرر أو حقل إلزامي فارغ). صحّحه قبل الرفع، وإلا ظهر في شاشة المراجعة.',
      'احفظ الملف بصيغة XLSX، ثم ارفعه من «استيراد بيانات Excel» في صفحة «إدارة الشعب والمتدربين»، وراجع البيانات قبل اعتمادها.',
      'لا يحذف الاستيراد أي متدرب أو شعبة، ولا يستبدل الأسماء المحفوظة: يضيف الجديد فقط، ويبلّغ عن أي اختلاف.'
    ];
    put(4, 2, 'خطوات التعبئة', { font: { bold: true, size: 12, color: { argb: NAVY } } });
    steps.forEach((t, i) => { wi.mergeCells(5 + i, 3, 5 + i, 6); put(5 + i, 2, `${i + 1}`, { font: { bold: true, color: { argb: BLUE } } }).alignment = { horizontal: 'center', vertical: 'middle' }; put(5 + i, 3, t); wi.getRow(5 + i).height = 34; });
    let r0 = 6 + steps.length;
    put(r0, 2, 'مثال على ورقة «بيانات الشعب» (للتوضيح فقط، لا يُستورد)', { font: { bold: true, size: 12, color: { argb: NAVY } } });
    const ex1 = [['رقم الشعبة', 'اسم المقرر', 'رمز المقرر', 'الفصل التدريبي', 'العام التدريبي'], ['12345', 'مقدمة الشبكات', 'شبكا 121', TERMS[0], YEARS()[1]]];
    ex1.forEach((row, i) => row.forEach((v, j) => put(r0 + 1 + i, j + 2, v, { border: true, fill: i ? null : OPT, font: i ? {} : { bold: true } })));
    r0 += 4;
    put(r0, 2, 'مثال على ورقة «بيانات المتدربين» (للتوضيح فقط، لا يُستورد)', { font: { bold: true, size: 12, color: { argb: NAVY } } });
    const ex2 = [['رقم الشعبة', 'الرقم التدريبي', 'اسم المتدرب', 'البريد الإلكتروني', 'رقم الجوال'], ['12345', '446000000', 'محمد عبدالله سعد الغامدي', '446000000@tvtc.edu.sa', '0550000000']];
    ex2.forEach((row, i) => row.forEach((v, j) => put(r0 + 1 + i, j + 2, v, { border: true, fill: i ? null : OPT, font: i ? {} : { bold: true } })));
    r0 += 4;
    put(r0, 2, 'دليل الألوان', { font: { bold: true, size: 12, color: { argb: NAVY } } });
    put(r0 + 1, 2, 'حقل إلزامي', { fill: REQ, border: true }); put(r0 + 2, 2, 'حقل اختياري', { fill: OPT, border: true }); put(r0 + 3, 2, 'خطأ أو تكرار', { fill: 'FFFFC7CE', border: true, font: { color: { argb: 'FF9C0006' }, bold: true } });
    const mws = wb.addWorksheet('_haader', { state: 'veryHidden' }); mws.getCell('A1').value = 'haader-roster'; mws.getCell('A2').value = JSON.stringify({ app: 'haader-roster', v: 1, by: A.me ? A.me.id : '', at: new Date().toISOString() });
    wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }];
    const buf = await wb.xlsx.writeBuffer();
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }

  /* ---------- قراءة Excel ---------- */
  const H = {
    crn: /رقم\s*الشعب|^الشعبة|^شعبة|crn|section/i, id: /الرقم\s*التدريبي|رقم\s*المتدرب|الرقم\s*الأكاديمي|الرقم\s*الجامعي|رقم\s*الطالب|student\s*id|^id$/i,
    name: /اسم\s*المتدرب|^الاسم|اسم\s*الطالب|^اسم$|name/i, email: /البريد|e-?mail/i, mobile: /الجوال|الهاتف|رقم\s*التواصل|mobile|phone/i,
    course: /اسم\s*المقرر|^المقرر|course\s*name|^course$/i, code: /رمز\s*المقرر|^الرمز|^رمز|course\s*code/i, term: /الفصل/i, year: /العام/i, trainer: /المدرب|المحاضر|instructor/i,
    kind: /نوع/i, d1: /اليوم\s*الأول|^اليوم$/i, t1: /وقت\s*المحاضرة\s*الأولى|الوقت\s*الأول|^الوقت$/i, d2: /اليوم\s*الثاني/i, t2: /وقت\s*المحاضرة\s*الثانية|الوقت\s*الثاني/i, dur: /المدة|مدة/i
  };
  const ORDER = ['id', 'crn', 'email', 'mobile', 'code', 'course', 'name', 'term', 'year', 'trainer', 'd2', 't2', 'd1', 't1', 'kind', 'dur'];
  function mapHead(row) {
    const m = {}; row.forEach((h, i) => { const t = clean(h).replace(/\*$/, '').trim(); if (!t) return; for (const k of ORDER) { if (m[k] === undefined && H[k].test(t)) { m[k] = i; break; } } });
    return m;
  }
  /* بيانات أعلى الكشف (رقم الشعبة واسم المقرر…) كما في كشوف رايات */
  function scanMeta(text) {
    const t = clean(text), o = {};
    let m = t.match(/(?:رقم\s*)?الشعبة\s*[:：\-]?\s*(\d{5})(?!\d)/) || t.match(/\bCRN\s*[:：]?\s*(\d{5})\b/i); if (m) o.crn = m[1];
    m = t.match(/رمز\s*المقرر\s*[:：\-]?\s*([؀-ۿA-Za-z]{2,8}\s?\d{2,4})/); if (m) o.code = m[1].trim();
    m = t.match(/(?:اسم\s*)?المقرر\s*[:：\-]\s*([؀-ۿ][؀-ۿ\s()]{2,60}?)(?=\s*(?:رمز|رقم|الشعبة|المدرب|الفصل|العام|\||$|\d))/); if (m) o.course = m[1].trim();
    m = t.match(/المدرب\s*[:：\-]\s*([؀-ۿ.][؀-ۿ.\s]{3,50}?)(?=\s*(?:رمز|رقم|الشعبة|المقرر|الفصل|العام|\||$|\d))/); if (m) o.trainerName = m[1].trim();
    m = t.match(/الفصل\s*(?:التدريبي)?\s*[:：\-]?\s*(الأول|الاول|الثاني|الصيفي|الثالث)/); if (m) o.term = termOf(m[1]);
    m = t.match(/(?:العام|السنة)\s*(?:التدريبي)?\s*[:：\-]?\s*(1[34]\d\d)/); if (m) o.year = m[1];
    return o;
  }
  function addSecMeta(meta, src) {
    if (!meta.crn) return null; let s = R.secs.find((x) => crnOf(x.crn) === meta.crn);
    if (!s) { s = newSec({ crn: meta.crn, src }); R.secs.push(s); const ex = A.raw.sections[meta.crn]; if (ex) Object.assign(s, { course: ex.course || '', code: ex.code || '', term: ex.term || '', year: ex.year || '', kind: ex.kind || 'نظري' }); }
    ['course', 'code', 'term', 'year', 'trainerName'].forEach((k) => { if (meta[k] && !s[k]) s[k] = meta[k]; });
    return s;
  }
  function readBook(X, wb, file) {
    let nSec = 0, nRow = 0;
    wb.SheetNames.forEach((sn) => {
      if (/^_|التعليمات/.test(sn)) return;
      const aoa = X.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: false, defval: '' });
      let hi = -1, map = null, best = 0;
      for (let i = 0; i < Math.min(aoa.length, 20); i++) { const m = mapHead(aoa[i] || []), n = Object.keys(m).length; if (n > best && (m.id !== undefined || (m.crn !== undefined && m.course !== undefined))) { best = n; hi = i; map = m; } }
      if (hi < 0) return;
      const meta = scanMeta(aoa.slice(0, hi).map((r) => r.join(' ')).join(' | ') + ' | ' + sn);
      const g = (row, k) => (map[k] === undefined ? '' : row[map[k]]);
      if (map.id !== undefined && map.name !== undefined) {
        const s = map.crn === undefined ? addSecMeta(meta, sn) : null;
        aoa.slice(hi + 1).forEach((row, i) => { const id = g(row, 'id'), nm = g(row, 'name'); if (!clean(id) && !clean(nm)) return; if (/^\s*(مثال|example)/i.test(clean(row.join(' ')))) return;
          R.rows.push(newRow({ crn: clean(g(row, 'crn')) || (s ? s.crn : meta.crn || ''), id, name: nm, email: g(row, 'email'), mobile: g(row, 'mobile'), src: `${sn} — صف ${hi + i + 2}` })); nRow++; });
      } else {
        aoa.slice(hi + 1).forEach((row) => { const crn = crnOf(g(row, 'crn')); if (!crn && !clean(g(row, 'course'))) return;
          const o = { crn, course: clean(g(row, 'course')), code: clean(g(row, 'code')), term: termOf(g(row, 'term')), year: yearOf(g(row, 'year')), trainerName: clean(g(row, 'trainer')), kind: /عملي/.test(g(row, 'kind')) ? 'عملي' : 'نظري', d1: g(row, 'd1'), t1: TIME(g(row, 't1')), d2: g(row, 'd2'), t2: TIME(g(row, 't2')), dur: +clean(g(row, 'dur')) || 100, src: sn };
          const s = R.secs.find((x) => crnOf(x.crn) === crn && crn); if (s) Object.keys(o).forEach((k) => { if (o[k] && (!s[k] || k === 'kind')) s[k] = o[k]; }); else R.secs.push(newSec(o)); nSec++; });
      }
    });
    return { nSec, nRow };
  }
  /* الشعب الموجودة التي ذكرها الملف دون أن يذكر بياناتها: تُضاف للمراجعة ببياناتها المحفوظة */
  function fillSecs() { [...new Set(R.rows.map((r) => crnOf(r.crn)).filter((c) => /^\d{5}$/.test(c)))].forEach((c) => { if (!R.secs.some((s) => crnOf(s.crn) === c)) { const ex = A.raw.sections[c]; R.secs.push(newSec(ex ? { crn: c, course: ex.course || '', code: ex.code || '', term: ex.term || '', year: ex.year || '', kind: ex.kind || 'نظري', src: 'المنصة' } : { crn: c, src: 'من بيانات المتدربين' })); } }); }

  /* ---------- قراءة PDF (نصي، أو ممسوح ضوئياً بالتعرف الضوئي) ---------- */
  const loadPdf = async () => { await loadScript('vendor/pdfjs/pdf.min.js', () => !!window.pdfjsLib); window.pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('vendor/pdfjs/pdf.worker.min.js', location.href).href; return window.pdfjsLib; };
  const loadOcr = () => loadScript('vendor/tess/tesseract.min.js', () => !!window.Tesseract);
  const prog = (t) => { const b = document.getElementById('rsProg'); if (b) b.textContent = t; };
  async function pdfLines(buf) {
    const pdfjs = await loadPdf(), doc = await pdfjs.getDocument({ data: new Uint8Array(buf), isEvalSupported: false }).promise, out = [];
    let ocr = 0, worker = null, dworker = null;
    try {
      for (let p = 1; p <= doc.numPages; p++) {
        prog(`قراءة الصفحة ${p} من ${doc.numPages}…`);
        const page = await doc.getPage(p), tc = await page.getTextContent(), items = tc.items.filter((x) => x.str && x.str.trim());
        const chars = items.reduce((a, x) => a + x.str.trim().length, 0);
        let own = null; if (chars >= 40) try { own = await opLines(pdfjs, page); } catch (e) { own = null; }
        const nId = (arr) => arr.reduce((a, t) => a + ((digits(t).match(/(?<!\d)\d{9}(?!\d)/g) || []).length), 0);
        if (own && own.length && nId(own) >= nId(items.map((x) => x.str)) && own.some((t) => /[\u0621-\u064A]/.test(t))) { own.forEach((t) => out.push({ p, t: t.normalize('NFKC') })); continue; }
        if (chars >= 40) {
          const L = []; items.forEach((x) => { const y = x.transform[5], h = Math.abs(x.transform[3]) || x.height || 8; let l = L.find((q) => Math.abs(q.y - y) < Math.max(3, h * 0.45)); if (!l) { l = { y, it: [] }; L.push(l); } l.it.push({ x: x.transform[4], w: x.width, s: x.str, h }); });
          L.sort((a, b) => b.y - a.y).forEach((l) => { l.it.sort((a, b) => b.x + b.w - (a.x + a.w)); let s = '', prev = null; l.it.forEach((q) => { if (prev) { const gap = prev.x - (q.x + q.w); s += gap > q.h * 1.5 ? ' | ' : gap > q.h * 0.12 ? ' ' : ''; } s += q.s; prev = q; }); out.push({ p, t: fixLig(s.normalize('NFKC')) }); });
        } else {
          if (!worker) { prog('تجهيز التعرف الضوئي على النص (OCR)…'); await loadOcr(); const base = new URL('vendor/tess/', location.href).href; worker = await window.Tesseract.createWorker('ara+eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, workerBlobURL: false, logger: (m) => { if (m.status === 'recognizing text') prog(`التعرف الضوئي: الصفحة ${p} من ${doc.numPages} — ${Math.round((m.progress || 0) * 100)}%`); } }); await worker.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: String((window.RS_OCR || {}).psm || '6') }); }
          const vp = page.getViewport({ scale: (window.RS_OCR || {}).scale || 2.6 }), cv = document.createElement('canvas'); cv.width = Math.ceil(vp.width); cv.height = Math.ceil(vp.height);
          const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); await page.render({ canvasContext: cx, viewport: vp }).promise;
          const r = await worker.recognize(cv); ocr++;
          const lines = (r.data.lines && r.data.lines.length ? r.data.lines.map((l) => ({ t: l.text, b: l.bbox })) : String(r.data.text || '').split('\n').map((t) => ({ t }))).map((l) => Object.assign(l, { t: fixLig(digits(l.t).normalize('NFKC')).replace(/\s+$/, '') })).filter((l) => l.t.trim());
          /* قراءة ثانية للأرقام وحدها: تُكمل الرقم التدريبي الذي لم يُقرأ في سطر فيه اسم (حدود الجداول تُربك القراءة الأولى) */
          const miss = lines.filter((l) => l.b && !/(?<!\d)\d{9}(?!\d)/.test(l.t) && /[\u0621-\u064A]{2,}\s+[\u0621-\u064A]{2,}/.test(l.t) && /^\s*\d{1,3}\s/.test(l.t));
          if (miss.length) {
            if (!dworker) { const base = new URL('vendor/tess/', location.href).href; dworker = await window.Tesseract.createWorker('eng', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true, workerBlobURL: false }); await dworker.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '11' }); }
            prog(`التعرف الضوئي: استكمال الأرقام التدريبية في الصفحة ${p}…`);
            const r2 = await dworker.recognize(cv), W = (r2.data.words || []).filter((w) => /^\d{9}$/.test(w.text));
            miss.forEach((l) => { const cy = (l.b.y0 + l.b.y1) / 2, h = l.b.y1 - l.b.y0; const w = W.find((x) => Math.abs((x.bbox.y0 + x.bbox.y1) / 2 - cy) < h * 0.6 && !lines.some((o) => o.t.includes(x.text))); if (w) { l.t += ' ' + w.text; l.fill = true; } });
          }
          lines.forEach((l) => out.push({ p, t: l.t, ocr: true }));
        }
      }
    } finally { [worker, dworker].forEach((w) => { if (w) try { w.terminate(); } catch (e) { /* */ } }); }
    return { lines: out, pages: doc.numPages, ocr };
  }
  /* حرف لام ألف (لا، لأ، لإ، لآ) في كثير من ملفات PDF العربية رسم واحد يُكتب في ToUnicode حرفين، فيقلبه
     الاستخراج المعتاد («صلاح» ← «صالح»). لذلك تُبنى الأسطر من رسوم الصفحة نفسها: ترتيب الرسوم المرئي يُحوَّل
     إلى الترتيب المنطقي برسم الحرف كاملاً، فتبقى لام ألف كما هي. وإن تعذر ذلك يُصحَّح الشكل المؤكد (األ ← الأ). */
  const fixLig = (t) => t.replace(/ا([أإآ])ل/g, 'ال$1');
  async function opLines(pdfjs, page) {
    const O = pdfjs.OPS, ol = await page.getOperatorList(), runs = [];
    const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
    const I = [1, 0, 0, 1, 0, 0]; let ctm = I.slice(), tm = I.slice(), tlm = I.slice(), fs = 10, cs = 0, ws = 0, hs = 1, lead = 0; const st = [];
    const move = (x, y) => { tlm = mul([1, 0, 0, 1, x, y], tlm); tm = tlm.slice(); };
    ol.fnArray.forEach((f, i) => { const a = ol.argsArray[i];
      if (f === O.save) st.push(ctm.slice()); else if (f === O.restore) ctm = st.pop() || I.slice(); else if (f === O.transform) ctm = mul(a, ctm);
      else if (f === O.paintFormXObjectBegin) { st.push(ctm.slice()); if (a && Array.isArray(a[0])) ctm = mul(a[0], ctm); } else if (f === O.paintFormXObjectEnd) ctm = st.pop() || I.slice();
      else if (f === O.beginText) { tm = I.slice(); tlm = I.slice(); } else if (f === O.setTextMatrix) { tm = a.slice(0, 6); tlm = tm.slice(); }
      else if (f === O.moveText) move(a[0], a[1]); else if (f === O.setLeadingMoveText) { lead = -a[1]; move(a[0], a[1]); } else if (f === O.nextLine || f === O.nextLineShowText || f === O.nextLineSetSpacingShowText) move(0, -lead);
      else if (f === O.setLeading) lead = a[0]; else if (f === O.setFont) fs = Math.abs(a[1]) || fs; else if (f === O.setCharSpacing) cs = a[0]; else if (f === O.setWordSpacing) ws = a[0]; else if (f === O.setHScale) hs = (a[0] || 100) / 100;
      if (f === O.showText || f === O.showSpacedText || f === O.nextLineShowText || f === O.nextLineSetSpacingShowText) {
        const gl = a[a.length - 1]; if (!Array.isArray(gl)) return;
        const m0 = mul(tm, ctm), sc = Math.hypot(m0[0], m0[1]) || 1, g = []; let x = 0;
        gl.forEach((q) => { if (typeof q === 'number') { x -= q / 1000 * fs * hs; return; } if (!q) return; const u = q.unicode || '', w = ((q.width || 0) * fs / 1000 + cs + (q.isSpace ? ws : 0)) * hs, m = mul([1, 0, 0, 1, x, 0], m0); if (u) g.push({ u, x: m[4], w: w * sc }); x += w; });
        tm = mul([1, 0, 0, 1, x, 0], tm);
        if (g.length) runs.push({ y: m0[5], h: fs * sc, g });
      } });
    const L = []; runs.forEach((r) => { let l = L.find((q) => Math.abs(q.y - r.y) < Math.max(2, r.h * 0.45)); if (!l) { l = { y: r.y, g: [] }; L.push(l); } r.g.forEach((q) => { q.h = r.h; l.g.push(q); }); });
    const isL = (u) => /^[0-9A-Za-z@._%+-]+$/.test(u);
    return L.sort((a, b) => b.y - a.y).map((l) => {
      const v = l.g.sort((a, b) => a.x - b.x), seq = []; let prev = null;
      v.forEach((q) => { if (prev) { const gap = q.x - (prev.x + prev.w); if (gap > q.h * 1.2) seq.push(' | '); else if (gap > q.h * 0.18 && prev.u !== ' ' && q.u !== ' ') seq.push(' '); } seq.push(q.u); prev = q; });
      const out = []; let i = 0;
      while (i < seq.length) { const l2 = isL(seq[i]); let j = i; while (j < seq.length && isL(seq[j]) === l2) j++; out.unshift(l2 ? seq.slice(i, j).join('') : seq.slice(i, j).reverse().join('')); i = j; }
      return out.join('').replace(/\s+/g, ' ').trim();
    }).filter(Boolean);
  }
  const STOPW = new Set(['نشط', 'نشطة', 'مسجل', 'مسجلة', 'منتظم', 'منسحب', 'معلق', 'مُعلَّق', 'معتذر', 'سعودي', 'سعودية', 'ذكر', 'أنثى', 'انثى', 'متدرب', 'حاضر', 'غائب', 'الاسم', 'الحالة', 'ملاحظات', 'مطوي', 'قيده']);
  const STOP = /غير\s*سعودي|اسم\s*المتدرب|الرقم\s*التدريبي/g;
  const GLUE = /(نشط|نشطة|منسحب|معلق|منتظم|مسجل)$/;
  const stripStop = (t) => t.replace(STOP, ' ').split(/\s+/).map((w) => (w.length > 5 && GLUE.test(w) && !STOPW.has(w) ? w.replace(GLUE, '') : w)).filter((w) => w && !STOPW.has(w)).join(' ');
  function parsePdfLines(lines, file) {
    let ctx = null, n = 0, ocr = false;
    const head = scanMeta(lines.slice(0, 25).map((l) => l.t).join(' | '));
    if (head.crn) ctx = addSecMeta(head, file);
    lines.forEach((l, i) => {
      const t = clean(l.t); if (l.ocr) ocr = true;
      const ids = t.match(/(?<!\d)\d{9}(?!\d)/g) || [];
      /* سطر في الجدول فيه رقم تسلسلي واسم دون رقم تدريبي مقروء: يُعرض للتصحيح ولا يُهمل */
      if (!ids.length && n && /^\s*\d{1,3}\s+[\u0621-\u064A]/.test(t) && !scanMeta(t).crn) { const part = (t.match(/(?<!\d)\d{6,11}(?!\d)/) || [])[0] || ''; const nm = stripStop(t.replace(/\d+/g, ' ').replace(/[^\u0621-\u064A\u0671-\u06D3A-Za-z\s]/g, ' ')).replace(/\s+/g, ' ').trim(); if (nm.split(' ').length >= 2) { R.rows.push(newRow({ crn: ctx ? ctx.crn : '', id: part, name: nm, src: `${file} — ص${l.p} س${i + 1}: لم يُقرأ الرقم التدريبي`, ocr: l.ocr })); n++; return; } }
      if (!ids.length) { const m = scanMeta(t); if (m.crn) ctx = addSecMeta(Object.assign({}, head.crn === m.crn ? head : {}, m), file); else if (ctx && (m.course || m.code)) ['course', 'code'].forEach((k) => { if (m[k] && !ctx[k]) ctx[k] = m[k]; }); return; }
      if (ids.length > 1) { ids.forEach((id) => { R.rows.push(newRow({ crn: ctx ? ctx.crn : '', id, name: '', src: `${file} — ص${l.p} س${i + 1}`, ocr: l.ocr })); n++; }); return; }
      const id = ids[0], rest = t.replace(id, ' ');
      const crn = (rest.match(/(?<!\d)\d{5}(?!\d)/) || [])[0] || '';
      const email = (rest.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [])[0] || '';
      const mobile = (rest.replace(email, '').match(/(?<!\d)(?:\+?966|0)?5\d{8}(?!\d)/) || [])[0] || '';
      const name = stripStop(rest.replace(email, ' ').replace(mobile, ' ').replace(/[^ء-يٱ-ۓA-Za-z\s]/g, ' ')).replace(/\s+/g, ' ').trim();
      if (crn && !A.raw.sections[crn] && !R.secs.some((s) => crnOf(s.crn) === crn) && !(ctx && ctx.crn === crn)) addSecMeta({ crn }, file);
      R.rows.push(newRow({ crn: crn || (ctx ? ctx.crn : ''), id, name, email, mobile, src: `${file} — ص${l.p} س${i + 1}`, ocr: l.ocr })); n++;
    });
    return { n, ocr };
  }

  /* ---------- المداخل ---------- */
  function startReview(kind, file) { R.kind = kind; R.file = file || ''; fillSecs(); R.mode = 'review'; R.result = null; evalAll(); render(true); window.scrollTo(0, 0); }
  function reset() { R.mode = ''; R.secs = []; R.rows = []; R.kind = ''; R.file = ''; R.bulkCrn = ''; }
  const fileBtn = (act, label, accept, cls) => `<label class="btn ${cls || ''} rs-file">${label}<input type="file" accept="${accept}" data-change="${act}" hidden></label>`;
  CHG['rs-xlsx'] = async (e) => {
    const f = e.files && e.files[0]; e.value = ''; if (!f) return;
    if (!/\.(xlsx|xlsm|xls|csv)$/i.test(f.name)) { toast('اختر ملف Excel بصيغة XLSX.'); return; }
    if (R.mode === 'review' && R.rows.length && !confirmDrop()) return;
    reset(); toast('جارٍ قراءة الملف…');
    try { const X = await loadXLSX(), wb = X.read(await f.arrayBuffer(), { type: 'array', cellDates: false }); const r = readBook(X, wb, f.name);
      if (!r.nRow && !r.nSec) { toast('لم أجد في الملف ورقة «بيانات الشعب» أو «بيانات المتدربين» بعناوينها. استخدم نموذج المنصة.'); render(true); return; }
      startReview('xlsx', f.name); toast(`قُرئ ${r.nSec} شعبة و${r.nRow} متدرب. راجعها قبل الإدراج.`);
    } catch (x) { console.error(x); toast('تعذرت قراءة الملف. تأكد أنه ملف Excel سليم.'); render(true); }
  };
  CHG['rs-pdf'] = async (e) => {
    const f = e.files && e.files[0]; e.value = ''; if (!f) return;
    if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { toast('اختر ملف PDF.'); return; }
    if (R.mode === 'review' && R.rows.length && !confirmDrop()) return;
    reset(); R.busy = true; render(true); prog('جارٍ فتح الملف…');
    try {
      const r = await pdfLines(await f.arrayBuffer()), p = parsePdfLines(r.lines, f.name);
      R.busy = false;
      if (!p.n) { toast(r.ocr ? 'لم يُتعرف على أرقام تدريبية في الصور. جرّب ملفاً أوضح (300 نقطة في البوصة) أو الإدراج اليدوي.' : 'لم أجد في الملف أرقاماً تدريبية (9 أرقام).'); render(true); return; }
      startReview('pdf', f.name);
      toast(`استُخرج ${p.n} متدرباً من ${r.pages} صفحة${r.ocr ? ` (منها ${r.ocr} بالتعرف الضوئي)` : ''}. راجع الأسماء والأرقام قبل الإدراج.`);
    } catch (x) { console.error(x); R.busy = false; toast(/password/i.test(String(x && x.name)) ? 'الملف محمي بكلمة مرور.' : 'تعذرت قراءة ملف PDF.'); render(true); }
  };
  const confirmDrop = () => { toast('أُلغيت المراجعة السابقة وفُتح الملف الجديد.'); return true; };

  /* ---------- الحفظ ---------- */
  const LB = {   /* نسخة Claude غير المرتبطة بالخادم: الحفظ في قاعدة بياناتها بالقواعد نفسها */
    apply(p) {
      const w = gWho(), iid = 'RI' + Date.now().toString(36).toUpperCase(), res = { id: iid, secs: [], added: 0, existing: 0, new_secs: 0, rows: 0, bad: [] }, ok = {};
      p.secs.forEach((s) => { const ex = A.raw.sections[s.crn];
        if (ex) { if (!isAdmin() && ex.trainer !== w.id) { res.bad.push({ crn: s.crn, msg: 'الشعبة مسندة إلى مدرب آخر.' }); res.secs.push({ crn: s.crn, st: 'denied' }); return; } const patch = {}; ['code', 'term', 'year'].forEach((k) => { if (!ex[k] && s[k]) patch[k] = s[k]; }); if (Object.keys(patch).length) { Object.assign(ex, patch); enqueue('sections/' + s.crn, patch); } ok[s.crn] = 1; res.secs.push({ crn: s.crn, st: 'existing' }); return; }
        const order = Math.max(0, ...Object.values(A.raw.sections).map((x) => x.order || 0)) + 1, o = orgInfo();
        const sec = { crn: s.crn, order, course: s.course, code: s.code || undefined, kind: s.kind, term: s.term || undefined, year: s.year || undefined, sheet: `${s.course} ${s.crn}`, title: s.title, meets: s.meets, dates: s.dates, rows: [], trainer: isAdmin() ? (s.trainer || w.id) : w.id, spec: o.defaultSpec, dept: o.dept, src: { import: iid, kind: p.kind, file: p.file } };
        Object.keys(sec).forEach((k) => sec[k] === undefined && delete sec[k]);
        A.raw.sections[s.crn] = sec; A.raw.marks[s.crn] = { m: {} }; A.raw.notes[s.crn] = { n: {} };
        enqueue('sections/' + s.crn, sec, 'set'); enqueue('marks/' + s.crn, { m: {} }, 'set'); enqueue('notes/' + s.crn, { n: {} }, 'set');
        ok[s.crn] = 1; res.new_secs++; res.secs.push({ crn: s.crn, st: 'created' }); });
      const tc = clone(((A.raw.meta || {}).tcontacts) || {}), touched = new Set(), gt = new Set();
      p.rows.forEach((r) => { res.rows++; const sec = A.raw.sections[r.crn];
        if (!ok[r.crn] && !(sec && (isAdmin() || sec.trainer === w.id))) { res.bad.push({ crn: r.crn, id: r.id, msg: 'الشعبة غير موجودة أو غير مسندة إليك.' }); return; }
        const cur = Object.values(A.raw.sections).map((s) => (s.rows || []).find((x) => x.id === r.id)).find(Boolean);
        if (cur && normName(cur.name) !== normName(r.name)) res.bad.push({ crn: r.crn, id: r.id, name: r.name, warn: true, msg: `الاسم المحفوظ «${cur.name}» يختلف عن «${r.name}»؛ بقي المحفوظ.` });
        if (r.email || r.mobile) { tc[r.id] = Object.assign({}, tc[r.id] || {}, r.email && !/@tvtc\.gov\.sa$/i.test(r.email) ? { email: r.email } : {}, mobOf(r.mobile) ? { mobile: mobOf(r.mobile) } : {}); }
        if ((sec.rows || []).some((x) => x.id === r.id)) { res.existing++; } else { sec.rows = (sec.rows || []).concat([{ id: r.id, name: cur ? cur.name : r.name }]); touched.add(r.crn); res.added++; }
        Object.values(A.raw.gsec || {}).filter((g) => g && (g.crn === r.crn || g.pair === r.crn) && !(g.rows || []).some((x) => x.id === r.id)).forEach((g) => { g.rows = (g.rows || []).concat([{ id: r.id, name: cur ? cur.name : r.name, el: true, st: 'مسجل', hrs: null, last: '' }]); gt.add(g.crn); });
      });
      touched.forEach((c) => enqueue('sections/' + c, { rows: A.raw.sections[c].rows }));
      gt.forEach((c) => enqueue('gsec/' + c, { rows: A.raw.gsec[c].rows }));
      if (Object.keys(tc).length) saveMeta('tcontacts', tc);
      const log = (((A.raw.meta || {}).rosterlog) || {}).rows || [];
      saveMeta('rosterlog', { rows: [{ id: iid, at: new Date().toISOString(), by_name: w.name, file: p.file, kind: p.kind, n_secs: res.secs.length, n_new_secs: res.new_secs, n_rows: res.rows, n_added: res.added, n_existing: res.existing, n_bad: res.bad.filter((b) => !b.warn).length, secs: res.secs, errors: res.bad }].concat(log).slice(0, 200) });
      rebuild(); return res;
    },
    imports() { return clone((((A.raw.meta || {}).rosterlog) || {}).rows || []); }
  };
  const BK = {
    apply: (p) => (WEB || MIR() ? SRV('roster_apply', { p }) : Promise.resolve(LB.apply(p))),
    imports: () => (WEB || MIR() ? SRV('roster_imports', { p_limit: 50 }) : Promise.resolve(LB.imports())),
    contacts: () => (WEB || MIR() ? SRV('roster_contacts', {}) : Promise.resolve(clone(((A.raw.meta || {}).tcontacts) || {}))),
    sync: () => { try { if (WEB) ['sections', 'gsec', 'marks', 'notes'].forEach((c) => window.HAADER_WEB.bump(c)); else if (MIR()) setTimeout(() => window.HAADER_MIRROR.pull(false), 300); } catch (e) { /* التحديث الدوري يكمل */ } }
  };
  function loadLog(force) {
    if (R.logBusy || (!force && R.log && Date.now() - R.logAt < 60000)) return;
    R.logBusy = true;
    Promise.all([BK.imports(), BK.contacts().catch(() => null)]).then(([l, c]) => { R.log = l || []; R.contacts = c; R.logAt = Date.now(); }).catch(() => { R.log = R.log || []; R.logErr = true; }).finally(() => { R.logBusy = false; if (A.view === 'roster') render(); });
  }
  function payload() {
    evalAll();
    const rows = R.rows.filter((r) => r.st === 'ok').map((r) => ({ crn: r.crn, id: r.id, name: r.name, email: r.email || '', mobile: mobOf(r.mobile) || '' }));
    const used = new Set(rows.map((r) => r.crn));
    const secs = R.secs.filter((s) => !s.err.length && s.st !== 'denied' && (used.has(s.crn) || s.st === 'new')).map((s) => { const meets = meetsOf(s), o = { crn: s.crn, course: clean(s.course), code: clean(s.code), kind: s.kind === 'عملي' ? 'عملي' : 'نظري', term: termOf(s.term), year: yearOf(s.year) };
      if (s.st === 'new') Object.assign(o, { meets, dates: datesOf(meets), title: `${clean(s.course)} — شعبة ${o.kind} رقم ${s.crn} — ${meets.map((m) => `يوم ${m.day} الساعة ${m.start.replace(/^0/, '')}`).join(' و')}`, trainer: isAdmin() ? s.trainer : '' });
      return o; });
    return { kind: R.kind || 'manual', file: R.file || (R.kind === 'manual' ? 'إدراج يدوي' : ''), secs, rows };
  }
  ACT['rs-apply'] = () => {
    if (!canWrite()) { toast(A.readOnly ? 'هذه النسخة للاطلاع: الإدراج من رابط المنصة أو من حساب صاحب المنصة.' : 'لا تملك صلاحية الإدراج.'); return; }
    const p = payload(), c = counts(), newS = p.secs.filter((s) => !A.raw.sections[s.crn]);
    if (!p.rows.length && !newS.length) { toast('لا توجد سجلات صحيحة للاعتماد.'); return; }
    modal(`<h2>اعتماد البيانات</h2><div class="sub">تُضاف السجلات الصحيحة وحدها. لا يُحذف أي متدرب أو شعبة، ولا يُستبدل اسم محفوظ.</div>
      <ul><li>شعب جديدة تُنشأ: <b>${newS.length}</b>${newS.length ? ` (${newS.map((s) => s.crn).join('، ')})` : ''}</li><li>متدربون يُدرجون: <b>${p.rows.length}</b> في ${new Set(p.rows.map((r) => r.crn)).size} شعبة</li>
      <li>لا يُدرج: ${c.dup} مكرر، ${c.fix} يحتاج تصحيحاً، ${c.ex} مستبعد</li></ul>
      <div class="gnote info">بعد الإدراج يظهر المتدربون تلقائياً في التحضير والتقارير والإنذار ولوحات المعلومات، وفي رصد الدرجات وظهورها والاختبارات، وفي بوابة المتدرب.</div>
      <div class="row"><button class="btn p" data-act="rs-apply-ok">اعتماد وإدراج</button><button class="btn" data-act="modal-close">رجوع</button></div>`);
  };
  ACT['rs-apply-ok'] = async (e) => {
    if (R.busy) return; R.busy = true; if (e) e.disabled = true;
    const p = payload(); let r;
    try { r = await BK.apply(p); }
    catch (x) { R.busy = false; if (e) e.disabled = false; closeModal(); toast(errMsg(x, 'تعذر الحفظ على الخادم، ولم يُحفظ شيء. أعد المحاولة.')); return; }
    R.busy = false; closeModal();
    if (!r || !r.id) { toast('لم يؤكد الخادم الحفظ. أعد تحميل الصفحة وتحقق من السجل.'); return; }
    R.result = r; R.log = null; BK.sync();
    try { gLog([['roster', (r.secs || []).map((s) => s.crn).join('،'), '', '', '', '', `${p.kind === 'xlsx' ? 'استيراد Excel' : p.kind === 'pdf' ? 'استيراد PDF' : 'إدراج يدوي'} ${p.file || ''}: أُضيف ${r.added}، موجود ${r.existing}، شعب جديدة ${r.new_secs} (${r.id})`]]); } catch (x) { /* سجل الخادم يكفي */ }
    const hard = (r.bad || []).filter((b) => !b.warn);
    showResult(r, p);
    reset(); render(true);
    toast(hard.length ? `أُدرج ${r.added} متدرباً، ورُفض ${hard.length} سجلاً (التفاصيل في النافذة).` : `أُدرج ${r.added} متدرباً${r.new_secs ? ` وأُنشئت ${r.new_secs} شعبة` : ''}.`);
  };
  function showResult(r, p) {
    const bad = r.bad || [], hard = bad.filter((b) => !b.warn), warn = bad.filter((b) => b.warn);
    A.rsLast = { r, p };
    modal(`<h2>${hard.length ? 'اكتمل الإدراج مع ملاحظات' : 'اكتمل الإدراج'}</h2>
      <div class="tiles"><div class="tile ok"><b>${r.added}</b><span>متدرب أُدرج</span></div><div class="tile"><b>${r.existing}</b><span>مسجل مسبقاً</span></div><div class="tile info"><b>${r.new_secs}</b><span>شعبة جديدة</span></div><div class="tile ${hard.length ? 'bad' : ''}"><b>${hard.length}</b><span>مرفوض</span></div></div>
      ${(r.secs || []).length ? `<div class="sub" style="margin-top:8px">الشعب: ${(r.secs || []).map((s) => `${s.crn} (${s.st === 'created' ? 'أُنشئت' : s.st === 'denied' ? 'مرفوضة' : 'موجودة'})`).join('، ')}</div>` : ''}
      ${hard.length ? `<div class="gnote bad"><b>مرفوض:</b><ul>${hard.slice(0, 30).map((b) => `<li>${esc([b.crn, b.id, b.name].filter(Boolean).join(' — '))}: ${esc(b.msg)}</li>`).join('')}</ul></div>` : ''}
      ${warn.length ? `<div class="gnote warn"><b>ملاحظات:</b><ul>${warn.slice(0, 30).map((b) => `<li>${esc([b.crn, b.id].filter(Boolean).join(' — '))}: ${esc(b.msg)}</li>`).join('')}</ul></div>` : ''}
      <div class="sub">رقم العملية: ${esc(r.id)}</div>
      <div class="row">${bad.length ? '<button class="btn" data-act="rs-errs-last">تنزيل تقرير الأخطاء</button>' : ''}<button class="btn p" data-act="modal-close">تم</button></div>`);
  }

  /* ---------- تقرير الأخطاء ---------- */
  async function errorReport(rows, secs, extra, name) {
    await loadExcel();
    const wb = new window.ExcelJS.Workbook(), ws = wb.addWorksheet('تقرير الأخطاء', { views: [{ rightToLeft: true, state: 'frozen', ySplit: 3, showGridLines: false }] });
    ws.columns = [{ width: 12 }, { width: 15 }, { width: 32 }, { width: 26 }, { width: 14 }, { width: 14 }, { width: 60 }, { width: 26 }];
    ws.mergeCells('A1:H1'); const t = ws.getCell('A1'); t.value = `تقرير أخطاء إدراج الشعب والمتدربين — ${name || ''} — ${fmtAt(new Date().toISOString())}`; t.font = { name: FONT, bold: true, size: 13, color: { argb: 'FFFFFFFF' } }; t.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }; t.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }; ws.getRow(1).height = 28;
    const hd = ['رقم الشعبة', 'الرقم التدريبي', 'اسم المتدرب', 'البريد الإلكتروني', 'رقم الجوال', 'حالة البيانات', 'السبب', 'المصدر'];
    ws.getRow(3).values = hd; ws.getRow(3).eachCell((c) => { c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } }; c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLUE } }; c.alignment = { horizontal: 'center', vertical: 'middle', readingOrder: 'rtl' }; });
    const all = [].concat(secs.map((s) => [s.crn, '', '', '', '', 'شعبة: يحتاج تصحيحاً', s.err.join(' '), s.src || '']), rows.map((r) => [r.crn, r.id, r.name, r.email, r.mobile, ST[r.st][1], r.err.concat(r.warn).join(' '), r.src || '']), extra || []);
    all.forEach((v, i) => { const row = ws.getRow(4 + i); row.values = v; row.eachCell({ includeEmpty: true }, (c, j) => { c.font = { name: FONT, size: 11, color: /يحتاج|مرفوض/.test(v[5]) && j === 6 ? { argb: 'FF9C0006' } : undefined }; c.alignment = { horizontal: j <= 2 || j === 5 ? 'center' : 'right', vertical: 'middle', wrapText: true, readingOrder: 'rtl' }; c.numFmt = '@'; }); });
    ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: 8 } };
    ws.getCell(`A${5 + all.length}`).value = `عدد السجلات: ${all.length}`; ws.getCell(`A${5 + all.length}`).font = { name: FONT, bold: true };
    return new Blob([await wb.xlsx.writeBuffer()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  ACT['rs-errs'] = async () => { evalAll(); const rows = R.rows.filter((r) => r.st !== 'ok'), secs = R.secs.filter((s) => s.err.length); if (!rows.length && !secs.length) { toast('لا توجد أخطاء أو تكرارات.'); return; }
    try { await save(`تقرير أخطاء الإدراج - ${R.file || 'إدراج يدوي'}.xlsx`.replace(/\.(xlsx|pdf|xls|csv)(?=\.xlsx$)/i, ''), await errorReport(rows, secs, [], R.file)); } catch (x) { console.error(x); toast('تعذر إنشاء التقرير.'); } };
  ACT['rs-errs-last'] = async () => { const L = A.rsLast; if (!L) return; try { await save(`تقرير نتيجة الإدراج - ${L.r.id}.xlsx`, await errorReport([], [], (L.r.bad || []).map((b) => [b.crn || '', b.id || '', b.name || '', '', '', b.warn ? 'ملاحظة' : 'مرفوض', b.msg, L.p.file || '']), L.p.file)); } catch (x) { toast('تعذر إنشاء التقرير.'); } };
  ACT['rs-log-errs'] = async (e) => { const x = (R.log || []).find((y) => y.id === e.dataset.id); if (!x) return; try { await save(`تقرير عملية ${x.id}.xlsx`, await errorReport([], [], (x.errors || []).map((b) => [b.crn || '', b.id || '', b.name || '', '', '', b.warn ? 'ملاحظة' : 'مرفوض', b.msg, x.file || '']), x.file)); } catch (y) { toast('تعذر إنشاء التقرير.'); } };

  /* ---------- الإدراج اليدوي ---------- */
  ACT['rs-manual'] = () => { if (!canWrite()) { toast(A.readOnly ? 'هذه النسخة للاطلاع: الإدراج من رابط المنصة.' : 'لا تملك صلاحية الإدراج.'); return; } reset(); R.mode = 'manual'; R.kind = 'manual'; R.file = 'إدراج يدوي';
    const mine = ownSecs(); R.secs.push(newSec(mine.length ? {} : {})); R.rows.push(newRow(), newRow(), newRow()); render(true); };
  ACT['rs-sec-add'] = () => { R.secs.push(newSec()); render(true); };
  ACT['rs-sec-del'] = (e) => { const i = +e.dataset.i, s = R.secs[i]; if (!s) return; const c = crnOf(s.crn); R.secs.splice(i, 1); if (c) R.rows = R.rows.filter((r) => crnOf(r.crn) !== c || R.secs.some((x) => crnOf(x.crn) === c)); render(true); };
  ACT['rs-row-add'] = (e) => { const crn = e.dataset.crn || R.bulkCrn || ''; const n = +e.dataset.n || 1; for (let i = 0; i < n; i++) R.rows.push(newRow({ crn })); render(true); const ins = document.querySelectorAll('.rs-rows tbody tr:last-child input'); if (ins[1]) ins[1].focus(); };
  ACT['rs-row-del'] = (e) => { R.rows = R.rows.filter((r) => r.k !== e.dataset.k); if (R.mode === 'review') evalAll(); render(true); };
  ACT['rs-row-ex'] = (e) => { const r = R.rows.find((x) => x.k === e.dataset.k); if (!r) return; r.ex = !r.ex; evalAll(); render(true); };
  ACT['rs-ex-bad'] = () => { evalAll(); let n = 0; R.rows.forEach((r) => { if (r.st === 'fix') { r.ex = true; n++; } }); evalAll(); render(true); toast(n ? `استُبعد ${n} سجلاً يحتاج تصحيحاً.` : 'لا توجد سجلات تحتاج تصحيحاً.'); };
  ACT['rs-edit'] = (e) => { const r = R.rows.find((x) => x.k === e.dataset.k); if (!r) return; r.edit = !r.edit; render(true); };
  ACT['rs-paste'] = () => {
    const opts = [...new Set(R.secs.map((s) => crnOf(s.crn)).filter((c) => /^\d{5}$/.test(c)).concat(ownSecs().map((s) => s.crn)))];
    modal(`<h2>إضافة عدة متدربين دفعة واحدة</h2><div class="sub">الصق من Excel أو رايات: كل سطر متدرب — الرقم التدريبي ثم الاسم، ثم البريد والجوال اختيارياً (مفصولة بمسافة جدولة أو فاصلة).</div>
      <label>الشعبة<select id="rsPC"><option value="">— اختر —</option>${opts.map((c) => `<option ${c === R.bulkCrn ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label>البيانات<textarea id="rsPT" rows="10" dir="rtl" placeholder="446000000	محمد عبدالله الغامدي	446000000@tvtc.edu.sa	0550000000"></textarea></label>
      <div class="row"><button class="btn p" data-act="rs-paste-ok">إضافة</button><button class="btn" data-act="modal-close">إلغاء</button></div>`);
  };
  ACT['rs-paste-ok'] = () => {
    const crn = ($('#rsPC') || {}).value || '', txt = ($('#rsPT') || {}).value || ''; let n = 0;
    if (!crn) { toast('اختر الشعبة.'); return; }
    txt.split(/\r?\n/).forEach((l) => { const t = digits(l).trim(); if (!t) return; const id = (t.match(/(?<!\d)\d{9}(?!\d)/) || [])[0]; if (!id) return;
      const parts = t.split(/\t|\s*[,،;|]\s*/).map((x) => x.trim()).filter(Boolean);
      const email = (t.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/) || [])[0] || '', mobile = (t.replace(id, '').match(/(?<!\d)(?:\+?966|0)?5\d{8}(?!\d)/) || [])[0] || '';
      let name = parts.find((x) => /[ء-ي]/.test(x) && !/@/.test(x)) || t.replace(id, '').replace(email, '').replace(mobile, '');
      name = name.replace(/[^ء-يٱ-ۓA-Za-z\s]/g, ' ').replace(/\s+/g, ' ').trim();
      R.rows = R.rows.filter((r) => r.id || r.name || r.email || r.mobile); R.rows.push(newRow({ crn, id, name, email, mobile, src: 'لصق' })); n++; });
    R.bulkCrn = crn; closeModal(); if (R.mode === 'review') evalAll(); render(true); toast(n ? `أُضيف ${n} متدرباً.` : 'لم أجد أرقاماً تدريبية (9 أرقام) في النص.');
  };
  ACT['rs-review'] = () => {
    R.rows = R.rows.filter((r) => clean(r.id) || clean(r.name) || clean(r.email) || clean(r.mobile));
    R.secs = R.secs.filter((s) => clean(s.crn) || clean(s.course));
    if (!R.rows.length && !R.secs.length) { toast('أدخل شعبة أو متدرباً واحداً على الأقل.'); return; }
    startReview('manual', 'إدراج يدوي');
  };
  ACT['rs-back'] = () => { R.mode = R.kind === 'manual' ? 'manual' : ''; if (R.mode === '') reset(); render(true); };
  ACT['rs-cancel'] = () => { modal(`<h2>إلغاء العملية</h2><div class="sub">تُلغى البيانات المعروضة ولا يُحفظ منها شيء.</div><div class="row"><button class="btn d" data-act="rs-cancel-ok">إلغاء العملية</button><button class="btn" data-act="modal-close">رجوع</button></div>`); };
  ACT['rs-cancel-ok'] = () => { closeModal(); reset(); render(true); toast('أُلغيت العملية، ولم يُحفظ شيء.'); };
  ACT['rs-bulk'] = () => { const c = crnOf(($('#rsBulk') || {}).value || ''); if (!/^\d{5}$/.test(c)) { toast('اختر الشعبة.'); return; } let n = 0; R.rows.forEach((r) => { if (!r.ex && !/^\d{5}$/.test(crnOf(r.crn))) { r.crn = c; n++; } }); R.bulkCrn = c; fillSecs(); evalAll(); render(true); toast(n ? `حُددت الشعبة ${c} لـ${n} سجلاً.` : 'لا توجد سجلات بلا شعبة.'); };
  ACT['rs-tpl'] = () => { modal(`<h2>تحميل نموذج إدراج الشعب والمتدربين (XLSX)</h2><div class="sub">ملف Excel فيه ورقة «بيانات الشعب» وورقة «بيانات المتدربين» وورقة تعليمات وأمثلة، بقوائم اختيار وتحقق يمنع تكرار الرقم التدريبي داخل الشعبة.</div>
      <label class="ck"><input type="checkbox" id="rsMine" ${ownSecs().length ? 'checked' : ''}> تضمين شعبي الحالية في ورقة الشعب (لإضافة متدربين إليها)</label>
      <div class="row"><button class="btn p" data-act="rs-tpl-ok">تحميل النموذج</button><button class="btn" data-act="modal-close">إلغاء</button></div>`); };
  ACT['rs-tpl-ok'] = async () => { const mine = !!($('#rsMine') || {}).checked; closeModal(); toast('جارٍ إنشاء النموذج…');
    try { const b = await buildTemplate(mine); await save('نموذج إدراج الشعب والمتدربين - منصة حاضر.xlsx', b); try { gLog([['roster-tpl', '', '', '', '', '', 'تنزيل نموذج إدراج الشعب والمتدربين']]); } catch (x) { /* */ } } catch (x) { console.error(x); toast('تعذر إنشاء النموذج. أعد المحاولة.'); } };
  ACT['rs-log-refresh'] = () => { loadLog(true); };
  /* حقول الإدخال: تُحفظ القيم دون إعادة رسم الصفحة (لا يضيع موضع الكتابة) */
  const setField = (e) => { const k = e.dataset.f, r = e.dataset.k ? R.rows.find((x) => x.k === e.dataset.k) : R.secs[+e.dataset.i]; if (!r) return; r[k] = e.value; return r; };
  CHG['rs-f'] = (e) => { setField(e); if (R.mode === 'review') { evalAll(); render(true); } };
  document.addEventListener('input', (ev) => { const t = ev.target; if (t && t.dataset && t.dataset.change === 'rs-f') setField(t); });

  /* ---------- الصفحة ---------- */
  const inp = (o, f, attrs) => `<input type="text" data-change="rs-f" data-f="${f}" ${o.k ? `data-k="${o.k}"` : `data-i="${o.i}"`} value="${esc(o.v[f] == null ? '' : o.v[f])}" ${attrs || ''}>`;
  const sel = (o, f, list, blank) => `<select data-change="rs-f" data-f="${f}" ${o.k ? `data-k="${o.k}"` : `data-i="${o.i}"`}>${blank ? '<option value="">—</option>' : ''}${list.map((x) => { const [v, t] = Array.isArray(x) ? x : [x, x]; return `<option value="${esc(v)}" ${String(o.v[f]) === String(v) ? 'selected' : ''}>${esc(t)}</option>`; }).join('')}</select>`;
  function secForm(s, i, review) {
    const o = { i, v: s }, ex = A.raw.sections[crnOf(s.crn)], st = review ? SST[s.st] : null, ts = accList().filter((u) => u.role !== 'viewer' && u.active !== false);
    const fixed = review && ex;
    return `<div class="rs-sec ${review && s.err && s.err.length ? 'bad' : ''}"><div class="row between"><b>الشعبة ${esc(s.crn || 'الجديدة')}</b><span class="row">${st ? `<span class="chip ${st[0]}">${st[1]}</span>` : ''}${review ? '' : `<button class="lnk small" data-act="rs-sec-del" data-i="${i}">حذف الشعبة</button>`}</span></div>
      ${fixed ? `<div class="sub">${esc(ex.course || '')}${ex.code ? ' — ' + esc(ex.code) : ''} • ${esc(ex.kind || '')} • المدرب: ${esc(trainerName(ex.trainer) || '—')} • ${(ex.rows || []).length} متدرب${(s.code && !ex.code) || (s.term && !ex.term) || (s.year && !ex.year) ? ' • تُكمَّل الحقول الفارغة فقط' : ''}</div>`
      : `<div class="rs-grid"><label>رقم الشعبة *${inp(o, 'crn', 'inputmode="numeric" maxlength="5" dir="ltr" placeholder="5 أرقام"')}</label><label>اسم المقرر *${inp(o, 'course', 'list="rsCourses"')}</label><label>رمز المقرر${inp(o, 'code', 'placeholder="مثل شبكا 121"')}</label>
        <label>الفصل التدريبي${sel(o, 'term', TERMS, true)}</label><label>العام التدريبي${sel(o, 'year', YEARS(), true)}</label><label>النوع${sel(o, 'kind', KINDS)}</label>
        ${isAdmin() ? `<label>المدرب${sel(o, 'trainer', ts.map((u) => [u.id, u.name]), true)}</label>` : ''}
        <label>اليوم الأول *${sel(o, 'd1', DAYS, true)}</label><label>الوقت *<input type="time" data-change="rs-f" data-f="t1" data-i="${i}" value="${esc(TIME(s.t1))}"></label>
        <label>اليوم الثاني${sel(o, 'd2', DAYS, true)}</label><label>الوقت<input type="time" data-change="rs-f" data-f="t2" data-i="${i}" value="${esc(TIME(s.t2))}"></label><label>المدة (دقيقة)${inp(o, 'dur', 'inputmode="numeric" dir="ltr"')}</label></div>`}
      ${review && s.err && s.err.length ? `<div class="rs-msg bad">${s.err.map(esc).join(' ')}</div>` : ''}${review && s.warn && s.warn.length ? `<div class="rs-msg warn">${s.warn.map(esc).join(' ')}</div>` : ''}</div>`;
  }
  function rowsTable(review) {
    const list = R.rows, secOpts = [...new Set(R.secs.map((s) => crnOf(s.crn)).filter(Boolean).concat(review ? [] : ownSecs().map((s) => s.crn)))];
    const body = list.map((r, n) => { const o = { k: r.k, v: r }, st = ST[r.st] || ST.ok, edit = !review || r.edit || (r.st === 'fix' && !(r.secErr && r.err.length === 1));
      const cell = (f, attrs, txt) => (edit && !r.ex ? `<td>${inp(o, f, attrs)}</td>` : `<td ${attrs && /dir="ltr"/.test(attrs) ? 'class="n" dir="ltr"' : ''}>${esc(txt != null ? txt : r[f]) || '<span class="sub">—</span>'}</td>`);
      return `<tr class="rs-${review ? r.st : 'ed'}">${review ? `<td class="n">${n + 1}</td>` : ''}<td>${edit && !r.ex ? `<input type="text" data-change="rs-f" data-f="crn" data-k="${r.k}" value="${esc(r.crn)}" list="rsCrns" inputmode="numeric" maxlength="5" dir="ltr" class="rs-crn">` : `<b>${esc(r.crn)}</b>`}</td>
        ${cell('id', 'inputmode="numeric" maxlength="9" dir="ltr" class="rs-id"')}${cell('name', 'class="rs-name"')}${cell('email', 'dir="ltr" class="rs-em"')}${cell('mobile', 'inputmode="tel" dir="ltr" class="rs-mob"')}
        ${review ? `<td><span class="chip ${st[0]}">${st[1]}</span>${r.ocr ? ' <span class="chip info" title="استُخرج بالتعرف الضوئي: تحقق من الرقم والاسم">OCR</span>' : ''}${r.err.concat(r.warn).length ? `<small class="rs-why">${r.err.concat(r.warn).map(esc).join(' ')}</small>` : ''}${r.src ? `<small class="sub" style="display:block">${esc(r.src)}</small>` : ''}</td>
          <td class="rs-act">${r.ex ? `<button class="btn s" data-act="rs-row-ex" data-k="${r.k}">إعادة</button>` : `${r.st === 'ok' ? '<span class="chip ok">اعتماد</span> ' : ''}${r.st !== 'fix' || (r.secErr && r.err.length === 1) ? `<button class="btn s" data-act="rs-edit" data-k="${r.k}">${r.edit ? 'تم' : r.st === 'dup' ? 'مراجعة' : 'تعديل'}</button>` : ''}<button class="btn s" data-act="rs-row-ex" data-k="${r.k}">استبعاد</button>`}</td>`
        : `<td><button class="lnk small" data-act="rs-row-del" data-k="${r.k}" aria-label="حذف المتدرب">حذف</button></td>`}</tr>`; }).join('');
    return `<datalist id="rsCrns">${secOpts.map((c) => `<option value="${c}">`).join('')}</datalist>
      <div class="tw rs-rows"><table><thead><tr>${review ? '<th class="n">م</th>' : ''}<th>رقم الشعبة</th><th>الرقم التدريبي</th><th>اسم المتدرب</th><th>البريد الإلكتروني</th><th>رقم الجوال</th>${review ? '<th>حالة البيانات</th><th>الإجراء</th>' : '<th></th>'}</tr></thead><tbody>${body || `<tr><td colspan="8" class="sub">لا يوجد متدربون بعد.</td></tr>`}</tbody></table></div>`;
  }
  const courses = () => `<datalist id="rsCourses">${[...new Set(Object.values(A.raw.sections || {}).map((s) => s.course).filter(Boolean))].map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`;
  function manualView() {
    return `<section class="panel"><div class="row between"><h2 style="margin:0">إدراج البيانات يدوياً</h2><button class="btn s" data-act="rs-cancel">إلغاء</button></div>
      <div class="sub">أضف شعبة جديدة أو أكثر، أو اترك بيانات الشعب واكتب رقم شعبة موجودة لك في جدول المتدربين. الحقول المعلَّمة * إلزامية.</div>
      <h3>بيانات الشعب</h3>${R.secs.map((s, i) => secForm(s, i, false)).join('')}${courses()}
      <div class="row"><button class="btn s" data-act="rs-sec-add">+ إضافة شعبة أخرى</button></div>
      <h3>بيانات المتدربين</h3>${rowsTable(false)}
      <div class="row"><button class="btn s" data-act="rs-row-add">+ إضافة متدرب</button><button class="btn s" data-act="rs-row-add" data-n="5">+ 5 صفوف</button><button class="btn s" data-act="rs-paste">إضافة عدة متدربين دفعة واحدة (لصق)</button></div>
      <div class="row" style="margin-top:12px"><button class="btn p" data-act="rs-review">مراجعة البيانات قبل الإدراج</button></div></section>`;
  }
  function reviewView() {
    const c = counts(), nb = R.rows.filter((r) => !r.ex && !/^\d{5}$/.test(crnOf(r.crn))).length, secErr = R.secs.filter((s) => s.err.length).length;
    const opts = [...new Set(R.secs.map((s) => crnOf(s.crn)).filter((x) => /^\d{5}$/.test(x)).concat(ownSecs().map((s) => s.crn)))];
    return `<section class="panel"><div class="row between"><div><h2 style="margin:0">مراجعة البيانات قبل الإدراج</h2><div class="sub">${R.kind === 'xlsx' ? 'ملف Excel' : R.kind === 'pdf' ? 'ملف PDF' : 'إدراج يدوي'}${R.file && R.kind !== 'manual' ? `: ${esc(R.file)}` : ''} • لا يُحفظ شيء قبل «اعتماد».</div></div>
      <div class="row">${R.kind === 'manual' ? '<button class="btn s" data-act="rs-back">رجوع للتعديل</button>' : ''}<button class="btn s" data-act="rs-cancel">إلغاء عملية الاستيراد</button></div></div>
      <div class="tiles" style="margin-top:10px"><div class="tile"><b>${R.secs.length}</b><span>شعبة</span><small>${R.secs.filter((s) => s.st === 'new').length} جديدة</small></div><div class="tile ok"><b>${c.ok}</b><span>صحيح</span><small>يُدرج</small></div><div class="tile warn"><b>${c.dup}</b><span>مكرر</span><small>لا يتكرر</small></div><div class="tile bad"><b>${c.fix}</b><span>يحتاج تصحيحاً</span></div><div class="tile"><b>${c.ex}</b><span>مستبعد</span></div></div>
      ${R.kind === 'pdf' ? '<div class="gnote warn">البيانات مستخرجة آلياً من PDF: راجع الأرقام التدريبية والأسماء سطراً سطراً، خصوصاً المستخرجة بالتعرف الضوئي (OCR) والأسماء المتشابهة.</div>' : ''}
      ${nb ? `<div class="gnote warn row"><span>${nb} سجلاً بلا رقم شعبة.</span><select id="rsBulk"><option value="">اختر الشعبة</option>${opts.map((x) => `<option ${x === R.bulkCrn ? 'selected' : ''}>${x}</option>`).join('')}</select><button class="btn s" data-act="rs-bulk">تحديد الشعبة لها</button></div>` : ''}
      <h3>الشعب</h3>${R.secs.length ? R.secs.map((s, i) => secForm(s, i, true)).join('') : '<div class="sub">لا توجد شعب في البيانات.</div>'}${courses()}
      <h3>المتدربون</h3>${rowsTable(true)}
      <div class="row" style="margin-top:8px"><button class="btn s" data-act="rs-row-add">+ إضافة متدرب</button><button class="btn s" data-act="rs-paste">إضافة عدة متدربين (لصق)</button>${c.fix ? '<button class="btn s" data-act="rs-ex-bad">استبعاد كل ما يحتاج تصحيحاً</button>' : ''}</div>
      <div class="row rs-bar"><button class="btn p" data-act="rs-apply" ${c.ok || R.secs.some((s) => s.st === 'new' && !s.err.length) ? '' : 'disabled'}>اعتماد جميع السجلات الصحيحة (${c.ok})</button><button class="btn" data-act="rs-errs" ${c.dup + c.fix + c.ex + secErr ? '' : 'disabled'}>تنزيل تقرير الأخطاء</button><button class="btn" data-act="rs-cancel">إلغاء</button></div>
      ${secErr ? `<div class="sub">${secErr} شعبة تحتاج تصحيحاً: لا تُنشأ ولا يُدرج متدربوها حتى تُصحّح.</div>` : ''}</section>`;
  }
  function logView() {
    loadLog(false);
    const L = R.log;
    return `<section class="panel"><div class="row between"><h2 style="margin:0">سجل عمليات الاستيراد</h2><button class="btn s" data-act="rs-log-refresh">تحديث</button></div>
      ${!L ? '<div class="sub">جارٍ التحميل…</div>' : !L.length ? `<div class="sub">${R.logErr ? 'تعذر تحميل السجل.' : 'لا توجد عمليات بعد.'}</div>` : `<div class="tw"><table><thead><tr><th class="n">التاريخ</th><th>الملف</th><th class="n">النوع</th>${isAdmin() ? '<th>المنفّذ</th>' : ''}<th class="n">الشعب</th><th class="n">المتدربون</th><th class="n">ناجح</th><th class="n">موجود</th><th class="n">مرفوض</th><th>الأخطاء المكتشفة</th></tr></thead><tbody>${L.map((x) => { const errs = x.errors || [];
        return `<tr><td class="n" style="white-space:nowrap">${esc(fmtAt(x.at))}</td><td>${esc(x.file || '—')}</td><td class="n">${x.kind === 'xlsx' ? 'XLSX' : x.kind === 'pdf' ? 'PDF' : 'يدوي'}</td>${isAdmin() ? `<td>${esc(x.by_name || '')}</td>` : ''}<td class="n">${x.n_secs}${x.n_new_secs ? ` <small class="sub">(${x.n_new_secs} جديدة)</small>` : ''}</td><td class="n">${x.n_rows}</td><td class="n"><b>${x.n_added}</b></td><td class="n">${x.n_existing}</td><td class="n">${x.n_bad ? `<span class="chip bad">${x.n_bad}</span>` : '0'}</td><td>${errs.length ? `<small>${esc(errs.slice(0, 2).map((b) => b.msg).join(' • '))}${errs.length > 2 ? ` … (+${errs.length - 2})` : ''}</small> <button class="lnk small" data-act="rs-log-errs" data-id="${esc(x.id)}">تنزيل</button>` : '<span class="sub">—</span>'}</td></tr>`; }).join('')}</tbody></table></div>`}</section>`;
  }
  function mineView() {
    const secs = ownSecs(); if (!secs.length) return '';
    const gOf = (crn) => Object.values(A.raw.gsec || {}).find((g) => g && (g.crn === crn || g.pair === crn));
    return `<section class="panel"><h2>${isAdmin() ? 'الشعب في المنصة' : 'شعبي'}</h2><div class="tw"><table><thead><tr><th class="n">الشعبة</th><th>المقرر</th><th class="n">الرمز</th><th class="n">النوع</th><th>الفصل</th>${isAdmin() ? '<th>المدرب</th>' : ''}<th class="n">المتدربون</th><th class="n">في رصد الدرجات</th><th class="n">المحاضرات</th></tr></thead><tbody>${secs.map((s) => { const g = gOf(s.crn), gn = g ? (g.rows || []).filter((r) => (s.rows || []).some((x) => x.id === r.id)).length : null;
      return `<tr><td class="n"><b>${s.crn}</b></td><td>${esc(s.course || '')}</td><td class="n">${esc(s.code || '')}</td><td class="n">${esc(s.kind || '')}</td><td>${esc([s.term, s.year].filter(Boolean).join(' ') || '—')}</td>${isAdmin() ? `<td>${esc(trainerName(s.trainer) || '—')}</td>` : ''}<td class="n">${(s.rows || []).length}</td><td class="n">${g ? (gn === (s.rows || []).length ? `<span class="chip ok">${gn} ✓</span>` : `<span class="chip warn">${gn}</span>`) : '<span class="sub">لا توجد قائمة رصد</span>'}</td><td class="n">${(s.dates || []).length}</td></tr>`; }).join('')}</tbody></table></div>
      <div class="sub">«في رصد الدرجات»: عدد متدربي الشعبة الموجودين في قائمة رصد الدرجات المرتبطة بها. الإدراج من هذه الصفحة يضيفهم إليها تلقائياً.</div></section>`;
  }
  VIEWS.roster = () => {
    if (!allowed()) return `<div class="head hero"><div><h1>إدارة الشعب والمتدربين</h1><div class="sub">هذه الصفحة للمدربين ومسؤول المنصة.</div></div></div>`;
    const secs = ownSecs(), ids = new Set(), multi = {}; secs.forEach((s) => (s.rows || []).forEach((r) => { ids.add(r.id); multi[r.id] = (multi[r.id] || 0) + 1; }));
    const nMulti = Object.values(multi).filter((n) => n > 1).length, last = (R.log || [])[0], nc = R.contacts ? [...ids].filter((i) => R.contacts[i] && (R.contacts[i].email || R.contacts[i].mobile)).length : null;
    const w = canWrite();
    return `${gHead('إدارة الشعب والمتدربين', 'أضف شعبك ومتدربيها مرة واحدة من نموذج Excel أو كشف PDF أو يدوياً، فتظهر تلقائياً في التحضير والدرجات والاختبارات والتقارير ولوحات المعلومات.', isAdmin() ? '<button class="btn s" data-act="rs-go-users">المدربون والصلاحيات</button>' : '')}
      <div class="tiles rs-tiles"><div class="tile"><b>${secs.length}</b><span>${isAdmin() ? 'الشعب' : 'شعبي'}</span><small>${secs.reduce((a, s) => a + ((s.dates || []).length ? 1 : 0), 0)} بكشف تحضير</small></div><div class="tile ok"><b>${ids.size}</b><span>المتدربون</span><small>بلا تكرار</small></div><div class="tile"><b>${nMulti}</b><span>مسجلون في أكثر من شعبة</span><small>ببيانات أساسية واحدة</small></div><div class="tile"><b>${nc == null ? '…' : nc}</b><span>ببيانات اتصال</span><small>بريد أو جوال</small></div><div class="tile"><b>${last ? esc(fmtAt(last.at).split('،')[0]) : '—'}</b><span>آخر استيراد</span><small>${last ? `${last.n_added} أُضيف` : 'لا يوجد'}</small></div></div>
      ${A.readOnly && !w ? '<div class="gnote info">هذه النسخة للاطلاع. الإدراج والاستيراد من رابط المنصة، أو من حساب صاحب المنصة هنا مع ربط Supabase.</div>' : ''}
      ${R.mode === 'review' ? reviewView() : R.mode === 'manual' ? manualView() : `<section class="panel"><h2>إضافة البيانات</h2><div class="rs-actions">
        <button class="rs-card" data-act="rs-tpl"><b>📥 تحميل نموذج إدراج الشعب والمتدربين (XLSX)</b><span>ملف Excel جاهز بورقتين: الشعب والمتدربون، بقوائم اختيار وتحقق وأمثلة.</span></button>
        <label class="rs-card ${w ? '' : 'off'}"><b>📊 استيراد بيانات Excel</b><span>ارفع النموذج بعد تعبئته، أو أي كشف فيه الرقم التدريبي والاسم.</span><input type="file" accept=".xlsx,.xlsm,.xls,.csv" data-change="rs-xlsx" ${w ? '' : 'disabled'} hidden></label>
        <label class="rs-card ${w ? '' : 'off'}"><b>📄 استيراد بيانات من PDF</b><span>كشوف نصية أو ممسوحة ضوئياً (تعرف ضوئي OCR)، ثم مراجعة قبل الإدراج.</span><input type="file" accept=".pdf,application/pdf" data-change="rs-pdf" ${w ? '' : 'disabled'} hidden></label>
        <button class="rs-card ${w ? '' : 'off'}" data-act="rs-manual" ${w ? '' : 'disabled'}><b>✍️ إدراج البيانات يدوياً</b><span>شعبة أو أكثر، وإضافة متدربين صفاً صفاً أو لصق عدة متدربين دفعة واحدة.</span></button></div>
        ${R.busy ? '<div class="gnote info" id="rsProg" role="status">جارٍ القراءة…</div>' : ''}
        <div class="sub">الصلاحيات: ${isAdmin() ? 'مسؤول المنصة: كل الشعب، وتحديد مدرب الشعبة الجديدة، والاطلاع على كل عمليات الاستيراد.' : 'المدرب: شعبه المسندة إليه فقط، والشعب الجديدة تُنشأ باسمه.'} لا يحذف الإدراج أي سجل قائم ولا يستبدله.</div></section>`}
      ${R.mode ? '' : mineView()}${logView()}`;
  };
  ACT['rs-go-users'] = () => go('users');
  /* القائمة: في «الأدوات» للمدرب والمسؤول، ورابط من «المدربون والصلاحيات» و«إدارة الشعب» */
  NAV.forEach(([g, items]) => { if (g === 'الأدوات' && !items.some((x) => x[0] === 'roster')) items.unshift(['roster', 'إدارة الشعب والمتدربين']); });
  const baseNav = buildNav;
  buildNav = function () { baseNav.apply(this, arguments); if (!allowed()) { const a = document.querySelector('#nav a[data-v="roster"]'); if (a) a.remove(); } };
  { const bu = VIEWS.users; if (bu) VIEWS.users = function () { const h = bu.apply(this, arguments); return h.replace('<button class="btn p" data-act="user-new">', '<button class="btn" data-act="rs-go">إدارة الشعب والمتدربين</button><button class="btn p" data-act="user-new">'); }; }
  { const bs = VIEWS.secadmin; if (bs) VIEWS.secadmin = function () { const h = bs.apply(this, arguments); return h.replace('<button class="btn p" data-act="sec-new">', '<button class="btn" data-act="rs-go">استيراد الشعب والمتدربين</button><button class="btn p" data-act="sec-new">'); }; }
  ACT['rs-go'] = () => go('roster');
  if (typeof GACT !== 'undefined') Object.assign(GACT, { roster: 'إدراج الشعب والمتدربين', 'roster-tpl': 'نموذج إدراج الشعب والمتدربين' });
  window.HAADER_RS = { R, evalAll, readBook, parsePdfLines, pdfLines, buildTemplate, payload, scanMeta };
})();
